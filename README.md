# URL Shortener

A simple and fast URL shortening service with admin panel.

## Features

- **Create** shortened URLs with custom codes
- **Read** all URLs and statistics  
- **Update** existing URLs and codes
- **Delete** URLs from database
- **Admin Panel** with web interface
- **Click Tracking** with timestamps

## Quick Start

1. Copy config file:
```bash
cp config.example.js config.js
```

2. Edit `config.js` with your settings

3. Install and run:
```bash
npm install
npm start
```

Server runs on `http://localhost:3001` (default port from config)

## Cloudflare Tunnel Support

This application is optimized for Cloudflare tunnels with:
- CORS headers for cross-origin requests
- Trusted proxy configuration  
- Protocol detection for HTTPS tunnels
- Cache optimization for redirects

## Admin Panel

Access: `http://localhost:3001/admin`

Set your auth token in `config.js` (copy from `config.example.js`)

### Features:
- Login with auth token
- View all URLs and statistics
- Create URLs with custom codes
- Edit existing URLs
- Delete URLs
- Real-time click tracking

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | API info | No |
| POST | `/new` | Create short URL | Yes |
| GET | `/:code` | Redirect to original URL | No |
| GET | `/api/urls` | List all URLs | Yes |
| PUT | `/api/urls/:code` | Update URL | Yes |
| DELETE | `/api/urls/:code` | Delete URL | Yes |

## Authentication

Use `Authorization: Bearer <token>` header or `?auth=<token>` query parameter.

## Deployment

### Local Development
```bash
npm start
```

### Cloudflare Tunnel
```bash
# Install cloudflared
# Create tunnel
cloudflared tunnel create url-shortener

# Configure tunnel
cloudflared tunnel route dns url-shortener yourdomain.com

# Run tunnel
cloudflared tunnel run url-shortener
```

The application automatically detects Cloudflare and adjusts headers accordingly.
