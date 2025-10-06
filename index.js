import express from 'express';
import fs from 'fs'; // File system module for file operations
import path from 'path'; // Path module for file path operations
import { fileURLToPath } from 'url'; // For __dirname in ES6 modules
import config from './config.js'; // Import config file

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Query string parser for better URL handling
app.use((req, res, next) => {
  // Ensure URL is properly decoded
  if (req.query.url) {
    try {
      req.query.url = decodeURIComponent(req.query.url);
    } catch (e) {
      // If decoding fails, keep original
    }
  }
  next();
});

// CORS middleware for Cloudflare compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Trust proxy for Cloudflare
app.set('trust proxy', true);

// Alternative to __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON database file path
const dbPath = path.join(__dirname, 'urls.json');

// Database read function
const readDB = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      // Create empty array if file doesn't exist
      fs.writeFileSync(dbPath, '[]');
      return [];
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Database read error:", err);
    return []; // Return empty array on error
  }
};

// Database write function
const writeDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Database write error:", err);
  }
};

// Code generation function
const generateCode = () => {
  const keys = "qwertyuopasdfghjklizxcvbnm1234567890";
  const length = 10;
  let code = "";
  let urls = readDB();

  while (true) {
    code = "";
    for (let x = 0; x < length; x++) {
      const n = parseInt(Math.random() * keys.length);
      code += keys[n].toUpperCase();
    }
    
    // Check if code exists in database
    const exists = urls.some(urlEntry => urlEntry.code === code);
    
    if (!exists) {
      return code;
    }
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const queryToken = req.query.auth;
  
  const providedToken = token || queryToken;
  
  if (!providedToken) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Authentication token is required"
    });
  }
  
  if (providedToken !== config.auth) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid authentication token"
    });
  }
  
  next();
};

// NEW URL CREATION ENDPOINT
app.post("/new", (req, res) => {
  // Debug logging
  console.log('POST /new request:', {
    query: req.query,
    body: req.body,
    headers: req.headers.authorization
  });

  // Required validations
  if (!req.query.url && !req.body.url) {
    return res.status(400).json({ 
      success: false,
      error: "Bad Request", 
      message: "URL parameter is required" 
    });
  }
  
  if (!req.query.auth && !req.headers.authorization) {
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized", 
      message: "Authentication token is required" 
    });
  }
  
  const authToken = req.query.auth || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (authToken !== config.auth) {
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized", 
      message: "Invalid authentication token" 
    });
  }

  const url = req.query.url || req.body.url;
  const customCode = req.query.code || req.body.code || null;
  
  // Check if custom code already exists (only if provided)
  if (customCode && customCode.trim() !== '') {
    const trimmedCode = customCode.trim();
    
    // Check for reserved keywords
    const reservedWords = ['admin', 'api', 'new', 'favicon.ico'];
    if (reservedWords.includes(trimmedCode.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Custom code cannot be a reserved keyword"
      });
    }
    
    const urls = readDB();
    const exists = urls.some(urlEntry => urlEntry.code === trimmedCode);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "Custom code already exists"
      });
    }
  }
  
  const code = (customCode && customCode.trim() !== '') ? customCode.trim() : generateCode();
  const newUrlEntry = { 
    url: url, 
    code: code,
    created_at: new Date().toISOString(),
    clicks: 0
  };

  // Save to database
  let urls = readDB();
  urls.push(newUrlEntry);
  writeDB(urls);

  return res.status(201).json({ 
    success: true,
    data: {
      original_url: url,
      short_url: config.site_url + code,
      code: code,
      created_at: newUrlEntry.created_at,
      clicks: newUrlEntry.clicks
    }
  });
});

// GET ALL URLs (Admin only)
app.get("/api/urls", authenticateToken, (req, res) => {
  const urls = readDB();
  return res.status(200).json({
    success: true,
    data: {
      total: urls.length,
      urls: urls
    }
  });
});

// GET SINGLE URL INFO (Admin only)
app.get("/api/urls/:code", authenticateToken, (req, res) => {
  const code = req.params.code;
  const urls = readDB();
  const urlEntry = urls.find(entry => entry.code === code);
  
  if (!urlEntry) {
    return res.status(404).json({
      success: false,
      error: "Not Found",
      message: "URL not found"
    });
  }
  
  return res.status(200).json({
    success: true,
    data: urlEntry
  });
});

// UPDATE URL (Admin only)
app.put("/api/urls/:code", authenticateToken, (req, res) => {
  const code = req.params.code;
  const { url: newUrl, newCode } = req.body;
  
  let urls = readDB();
  const urlIndex = urls.findIndex(entry => entry.code === code);
  
  if (urlIndex === -1) {
    return res.status(404).json({
      success: false,
      error: "Not Found",
      message: "URL not found"
    });
  }
  
  // Check if new code already exists (if changing code)
  if (newCode && newCode !== code) {
    const codeExists = urls.some(entry => entry.code === newCode);
    if (codeExists) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "New code already exists"
      });
    }
  }
  
  // Update the entry
  if (newUrl) urls[urlIndex].url = newUrl;
  if (newCode) urls[urlIndex].code = newCode;
  urls[urlIndex].updated_at = new Date().toISOString();
  
  writeDB(urls);
  
  return res.status(200).json({
    success: true,
    data: urls[urlIndex]
  });
});

// DELETE URL (Admin only)
app.delete("/api/urls/:code", authenticateToken, (req, res) => {
  const code = req.params.code;
  let urls = readDB();
  const urlIndex = urls.findIndex(entry => entry.code === code);
  
  if (urlIndex === -1) {
    return res.status(404).json({
      success: false,
      error: "Not Found",
      message: "URL not found"
    });
  }
  
  const deletedUrl = urls[urlIndex];
  urls.splice(urlIndex, 1);
  writeDB(urls);
  
  return res.status(200).json({
    success: true,
    message: "URL deleted successfully",
    data: deletedUrl
  });
});

// ADMIN PANEL ROUTE (must be before /:code route)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// REDIRECT ENDPOINT
app.get("/:code", (req, res) => {
  const requestedCode = req.params.code;

  if (typeof requestedCode === "undefined" || requestedCode === "null") {
    return res.status(400).json({ 
      success: false,
      error: "Bad Request", 
      message: "Short code is required" 
    });
  }
  
  if (requestedCode === "favicon.ico") return res.status(204).send();
  
  // Skip reserved routes
  if (requestedCode === "admin" || requestedCode === "api") {
    return res.status(404).json({ 
      success: false,
      error: "Not Found", 
      message: "The requested endpoint does not exist" 
    });
  }

  // Find code in database
  let urls = readDB();
  const urlIndex = urls.findIndex(entry => entry.code === requestedCode);

  if (urlIndex === -1) {
    return res.status(404).json({ 
      success: false,
      error: "Not Found", 
      message: "Short URL not found" 
    });
  }
  
  // Increment click counter
  urls[urlIndex].clicks = (urls[urlIndex].clicks || 0) + 1;
  urls[urlIndex].last_accessed = new Date().toISOString();
  writeDB(urls);
  
  // Redirect to original URL with cache headers for Cloudflare
  res.set({
    'Cache-Control': 'public, max-age=300', // 5 minutes cache
    'CF-Cache-Tag': 'redirect'
  });
  return res.redirect(301, urls[urlIndex].url);
});

// HOME PAGE AND ERROR ENDPOINTS
app.get("/", (req, res) => {
  // Get proper protocol and host for Cloudflare tunnels
  const protocol = req.get('CF-Visitor') ? JSON.parse(req.get('CF-Visitor')).scheme : req.protocol;
  const host = req.get('host');
  
  res.status(200).json({
    success: true,
    data: {
      name: "URL Shortener API",
      version: "1.0.0",
      description: "A simple and fast URL shortening service",
      admin_panel: `${protocol}://${host}/admin`,
      endpoints: {
        "POST /new": {
          description: "Create a new shortened URL",
          parameters: {
            url: "The URL to shorten (required)",
            auth: "Authentication token (required)",
            code: "Custom short code (optional)"
          }
        },
        "GET /:code": {
          description: "Redirect to original URL using short code",
          parameters: {
            code: "Short code from shortened URL"
          }
        },
        "GET /api/urls": {
          description: "Get all URLs (Admin only)",
          auth_required: true
        },
        "PUT /api/urls/:code": {
          description: "Update URL (Admin only)",
          parameters: {
            url: "New URL",
            newCode: "New code (optional)"
          },
          auth_required: true
        },
        "DELETE /api/urls/:code": {
          description: "Delete URL (Admin only)",
          auth_required: true
        }
      },
      repository: "https://github.com/ta2edh/url-shortener"
    }
  });
});

// Catch-all route for Express 5.x
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: "Not Found", 
    message: "The requested endpoint does not exist" 
  });
});

// START SERVER
const port = config.port || process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${port}`);
    console.log(`📁 Database file: ${dbPath}`);
    console.log(`🌐 Ready for Cloudflare tunnel connections`);
});