const DEFAULT_SUPABASE_URL = 'https://aenhajqjsgskimfzvlfr.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
const DEFAULT_SESSION_SECRET = 'theprivatianfamily_secret_jwt_key_2026_secure';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
  return createClient(url, key);
}

function verifySession(req) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token && req.headers.cookie) {
    const m = req.headers.cookie.match(/privatian_session=([^;]+)/);
    if (m) token = m[1];
  }
  if (!token) return null;
  try { return jwt.verify(token, process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET); }
  catch(e) { return null; }
}

function requireAuth(req, res) {
  const s = verifySession(req);
  if (!s) { res.status(401).json({ error: 'Not authenticated', redirect: '/admin-login.html' }); return null; }
  return s;
}

/**
 * requireAdmin: JWT check + live DB role check.
 * Prevents stale-JWT privilege escalation when a user is downgraded mid-session.
 * Returns the session object on success, null on failure (after sending error response).
 */
async function requireAdmin(req, res) {
  const s = requireAuth(req, res);
  if (!s) return null;

  // Live DB check: verify the role in DB is still 'Admin' and account is active.
  // This catches mid-session role downgrades (Admin → Moderator) even before JWT expires.
  try {
    const sb = getSupabaseClient();
    const { data } = await sb
      .from('allowed_admins')
      .select('role, status')
      .ilike('email', s.email)
      .maybeSingle();

    if (!data || data.status !== 'active' || data.role !== 'Admin') {
      res.status(403).json({
        error: 'Admin role required',
        reason: !data ? 'not_found' : data.role !== 'Admin' ? 'role_changed' : data.status
      });
      return null;
    }
  } catch(e) {
    // If DB check fails (network/config), fall back to JWT role as a safety net
    if (s.role !== 'Admin') {
      res.status(403).json({ error: 'Admin role required' });
      return null;
    }
  }

  return s;
}

module.exports = { verifySession, requireAuth, requireAdmin };
