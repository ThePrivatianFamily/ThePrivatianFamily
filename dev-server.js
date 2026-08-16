const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple .env parser
['.env.production.local', '.env.local', '.env'].forEach(filename => {
  const p = path.join(__dirname, filename);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
});

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Handle /api/* routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').split('/')[0].split('?')[0];
    const apiFilePath = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(apiFilePath)) {
      try {
        delete require.cache[require.resolve(apiFilePath)];
        const handler = require(apiFilePath);

        req.query = parsedUrl.query;
        req.cookies = {};

        // Parse JSON body if present
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          if (body) {
            try { req.body = JSON.parse(body); } catch(e) { req.body = body; }
          } else {
            req.body = {};
          }

          // Polyfill status and json helpers on res
          res.status = function(code) { res.statusCode = code; return res; };
          res.json = function(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          try {
            await (handler.default || handler)(req, res);
          } catch(err) {
            console.error('API Error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          }
        });
        return;
      } catch(err) {
        console.error('API Load Error:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  // Handle URL Rewrites
  if (pathname === '/') pathname = '/index.html';
  else if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  else if (pathname === '/events' || pathname === '/events/') pathname = '/events.html';
  else if (pathname === '/section' || pathname === '/section/' || pathname.startsWith('/section/')) pathname = '/section.html';
  else if (pathname.startsWith('/article/')) pathname = '/article.html';
  else if (!path.extname(pathname) && fs.existsSync(path.join(__dirname, pathname + '.html'))) {
    pathname = pathname + '.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Development server running at http://localhost:${PORT}`);
});
