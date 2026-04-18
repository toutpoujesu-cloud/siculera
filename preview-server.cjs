const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = 8080;
const API_PORT = 4000;
const ROOT     = path.join(__dirname, 'ecommerce', 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

function proxyToBackend(req, res) {
  const opts = {
    hostname: '127.0.0.1',
    port:     API_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `localhost:${API_PORT}` },
  };
  const proxy = http.request(opts, (backRes) => {
    res.writeHead(backRes.statusCode, backRes.headers);
    backRes.pipe(res, { end: true });
  });
  proxy.on('error', () => { res.writeHead(502); res.end('Backend unavailable'); });
  req.pipe(proxy, { end: true });
}

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // If path escapes ROOT (e.g. /api/*, /assets/siculera-chat.js from backend),
  // proxy it to the backend on port 4000.
  if (!filePath.startsWith(ROOT)) {
    return proxyToBackend(req, res);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found locally — proxy to backend (handles /api/*, /assets/*, etc.)
      return proxyToBackend(req, res);
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Siculera preview  →  http://localhost:${PORT}`);
  console.log(`Backend proxy     →  http://localhost:${API_PORT}`);
});
