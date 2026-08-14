/**
 * THE PRIVATIAN FAMILY — Local Development Server
 * Zero-dependency Node.js server that serves static frontend files & executes /api serverless functions.
 * Run with: node dev-server.js (or npm start)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// Load environment variables from .env or .env.local if present
function loadEnv() {
  ['.env', '.env.local'].forEach(file => {
    const p = path.join(__dirname, file);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
          }
        }
      });
    }
  });

  // Default Supabase fallbacks for seamless out-of-the-box local testing
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = 'https://aenhajqjsgskimfzvlfr.supabase.co';
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
  }
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'privatian_dev_session_secret_12345';
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = reqUrl.pathname || '/';

  // ── Handle /api/* serverless routes ────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace(/^\/api\//, '').split('/')[0].replace(/\.js$/, '');
    const apiFile = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(apiFile)) {
      try {
        // Collect request body
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const rawBuffer = Buffer.concat(chunks);
        const rawBody = rawBuffer.toString('utf8');

        // Parse body
        let parsedBody = null;
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json') && rawBody.trim()) {
          try { parsedBody = JSON.parse(rawBody); } catch(e) {}
        } else if (rawBody) {
          parsedBody = rawBody;
        }

        // Attach serverless helper properties
        req.query = Object.fromEntries(reqUrl.searchParams.entries());
        req.body = parsedBody;
        req.rawBody = rawBuffer;

        // Response helpers
        res.status = function(code) {
          this.statusCode = code;
          return this;
        };
        res.json = function(data) {
          this.setHeader('Content-Type', 'application/json');
          this.end(JSON.stringify(data));
          return this;
        };

        // Clear require cache for hot-reload in dev
        delete require.cache[require.resolve(apiFile)];
        const handler = require(apiFile);

        return await handler(req, res);
      } catch (err) {
        console.error('[API Error]', pathname, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: `API route /api/${apiName} not found` }));
    }
  }

  // ── Static Files ──────────────────────────────────────────────────
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, pathname);

  // Security check: keep inside directory
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<h1>404 Not Found</h1><p><a href="/">Return to Home</a></p>');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  The Privatian Family Dev Server`);
  console.log(`  Local URL:    http://localhost:${PORT}`);
  console.log(`  Admin URL:    http://localhost:${PORT}/admin.html`);
  console.log(`  Articles API: http://localhost:${PORT}/api/articles?action=list`);
  console.log('════════════════════════════════════════════════════════════════');
});
