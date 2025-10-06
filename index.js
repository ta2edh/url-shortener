const express = require("express");
const app = express();
const fs = require('fs'); // Dosya işlemleri için fs modülü
const path = require('path'); // Dosya yolu işlemleri için path modülü

// Sabitler ve Ayarlar
const config = {
  port: 3001,
  site_url: "https://example.com/", // website url, "/" required in end of url 

  auth: process.env.AUTH // authorization token for line 32
}

// JSON veritabanı dosyasının yolu
const dbPath = path.join(__dirname, 'urls.json');

// Veritabanı dosyasını okuma fonksiyonu
const readDB = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      // Dosya yoksa boş bir array ile oluştur
      fs.writeFileSync(dbPath, '[]');
      return [];
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Veritabanı okuma hatası:", err);
    return []; // Hata durumunda boş array döndür
  }
};

// Veritabanı dosyasına yazma fonksiyonu
const writeDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Veritabanı yazma hatası:", err);
  }
};

// Kod üretme fonksiyonu
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
    
    // Kodun veritabanında var olup olmadığını kontrol et
    const exists = urls.some(urlEntry => urlEntry.code === code);
    
    if (!exists) {
      return code;
    }
  }
}

// YENI URL OLUŞTURMA ENDPOINT'i
app.post("/new", (req, res) => {
  // Gerekli kontroller
  if (!req.query.url) return res.status(403).json({ code: 403, error: "Unauthorized: URL missing" });
  if (!req.query.auth) return res.status(403).json({ code: 403, error: "Unauthorized: Auth token missing" });
  if (req.query.auth !== config.auth) return res.status(403).json({ code: 403, error: "Unauthorized: Invalid auth token" });

  const code = generateCode();
  const newUrlEntry = { url: req.query.url, code: code };

  // Veritabanına kaydet
  let urls = readDB();
  urls.push(newUrlEntry);
  writeDB(urls);

  return res.status(200).json({ url: config.site_url + code });
});

// YÖNLENDİRME ENDPOINT'i
app.get("/:code", (req, res) => { // redirect
  const requestedCode = req.params.code;

  if (typeof requestedCode === "undefined" || requestedCode === "null") {
    return res.status(403).json({ code: 403, error: "Unauthorized: Code missing" });
  }
  if (requestedCode === "favicon.ico") return;

  // Veritabanından kodu bul
  const urls = readDB();
  const urlEntry = urls.find(entry => entry.code === requestedCode);

  if (!urlEntry) {
    return res.status(403).json({ code: 403, error: "Unauthorized: Code not found" });
  }
  
  // Yönlendir
  return res.redirect(urlEntry.url);
});

// ANA SAYFA VE HATA ENDPOINT'leri
app.get("/", (req, res) => res.redirect("https://replit.com/@erdemsweb/sharex-url-shortener"));
app.get("*", (req, res) => res.status(403).json({ code: 403, error: "Unauthorized" }));

// SUNUCUYU BAŞLAT
const port = config.port || 3001;
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor. Veritabanı dosyası: ${dbPath}`);
});