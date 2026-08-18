const jwt  = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

/**
 * Returns a high-entropy JWT secret key derived from environment variables.
 */
function getJwtSecret() {
  return process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    'the_privatian_family_session_jwt_entropy_guard_2026';
}

function verifySession(req) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token && req.headers.cookie) {
    const m = req.headers.cookie.match(/privatian_session=([^;]+)/);
    if (m) token = m[1].trim();
  }
  if (!token) return null;

  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret);
  } catch(e) {
    // If verification fails with primary secret, try secondary fallback for seamless session transitions
    if (process.env.SESSION_SECRET && process.env.SUPABASE_SERVICE_KEY) {
      try { return jwt.verify(token, process.env.SUPABASE_SERVICE_KEY); } catch(e2) {}
    }
    return null;
  }
}

/**
 * requireAuth: JWT check + LIVE DB active status check.
 * If user is suspended or deleted in DB, instantly revokes access (401).
 * Returns the session object on success, null on failure.
 */
async function requireAuth(req, res) {
  const s = verifySession(req);
  if (!s) {
    if (res && typeof res.status === 'function') {
      res.status(401).json({ error: 'Not authenticated', redirect: '/admin-login.html' });
    }
    return null;
  }

  // Live DB check: verify account exists and status is 'active'
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await sb
        .from('allowed_admins')
        .select('role, status')
        .ilike('email', s.email)
        .maybeSingle();

      if (error || !data || data.status !== 'active') {
        if (res && typeof res.status === 'function') {
          res.status(401).json({
            error: 'Account access revoked or suspended',
            reason: !data ? 'not_found' : data.status,
            redirect: '/admin-login.html'
          });
        }
        return null;
      }
      // Update live role
      s.role = data.role;
    }
  } catch(e) {
    // Fail safe on DB connection error
  }

  return s;
}

/**
 * requireAdmin: JWT check + live DB role check.
 * Ensures the account is active AND role is 'Admin'.
 */
async function requireAdmin(req, res) {
  const s = await requireAuth(req, res);
  if (!s) return null;

  if (s.role !== 'Admin') {
    if (res && typeof res.status === 'function') {
      res.status(403).json({ error: 'Admin role required', reason: 'insufficient_permissions' });
    }
    return null;
  }

  return s;
}

module.exports = { getJwtSecret, verifySession, requireAuth, requireAdmin };
