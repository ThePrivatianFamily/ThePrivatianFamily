/**
 * api/_lib/cors.js — Secure Cross-Origin Resource Sharing (CORS) Middleware
 * 
 * Protects against cross-site request forgery and unauthorized credentialed requests
 * by strictly validating request origins against trusted domains.
 */

const ALLOWED_ORIGINS = [
  'https://theprivatianfamily.com',
  'https://www.theprivatianfamily.com'
];

/**
 * Checks if the given origin is trusted.
 * Supports production domains, Vercel preview URLs, and localhost development.
 */
function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  const clean = origin.trim().toLowerCase();

  // 1. Direct match on production domains
  if (ALLOWED_ORIGINS.includes(clean)) return true;

  // 2. Vercel deployment URLs (e.g. https://the-privatian-family-*.vercel.app, https://theprivatianfamily.vercel.app)
  if (/^https:\/\/([a-z0-9-]+)\.vercel\.app$/i.test(clean)) return true;

  // 3. Local development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) return true;

  return false;
}

/**
 * Applies secure CORS headers to the response.
 * Returns true if request was an OPTIONS preflight (and handled), false otherwise.
 */
function handleCors(req, res, methods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS') {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // Same-origin browser request or non-browser server-to-server request
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, Cache-Control');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

module.exports = { handleCors, isAllowedOrigin };
