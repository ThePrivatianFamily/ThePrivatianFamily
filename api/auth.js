/**
 * api/auth.js — Single endpoint for all auth operations
 * Routes via ?action= query param
 *
 * POST /api/auth?action=verify   — Google OAuth login
 * GET  /api/auth?action=me       — get current session info
 * POST /api/auth?action=logout   — clear session cookie
 */

const { OAuth2Client } = require('google-auth-library');
const { createClient }  = require('@supabase/supabase-js');
const jwt               = require('jsonwebtoken');
const { verifySession } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── ME ──────────────────────────────────────────────────────────
  if (action === 'me') {
    const s = verifySession(req);
    if (!s) return res.status(401).json({ error: 'Not authenticated' });
    return res.status(200).json({ email: s.email, role: s.role, name: s.name || s.email, picture: s.picture || '' });
  }

  // ── LOGOUT ──────────────────────────────────────────────────────
  if (action === 'logout') {
    res.setHeader('Set-Cookie', 'privatian_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
    return res.status(200).json({ success: true });
  }

  // ── VERIFY (Google OAuth) ────────────────────────────────────────
  if (action === 'verify' && req.method === 'POST') {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    try {
      const googleClientId = process.env.GOOGLE_CLIENT_ID || '998492025686-flk32n9j8s28b5r3s98l1k18k2h7h51o.apps.googleusercontent.com';
      const gClient = new OAuth2Client(googleClientId);
      const ticket  = await gClient.verifyIdToken({
        idToken:  credential,
        audience: googleClientId,
      });
      const gp = ticket.getPayload();
      if (!gp.email_verified) return res.status(401).json({ error: 'Email not verified with Google' });

      const email   = gp.email.toLowerCase();
      const name    = gp.name    || email;
      const picture = gp.picture || '';

      const sbUrl = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
      const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
      const sb = createClient(sbUrl, sbKey);
      const { data: admin, error } = await sb
        .from('allowed_admins')
        .select('*')
        .eq('email', email)
        .eq('status', 'active')
        .single();

      if (error || !admin) {
        return res.status(403).json({
          error: 'This Google account is not authorized to access the admin panel.',
          email
        });
      }

      const sessionSecret = process.env.SESSION_SECRET || 'theprivatianfamily_secret_jwt_key_2026_secure';
      const token = jwt.sign(
        { email: admin.email, role: admin.role, name, picture },
        sessionSecret,
        { expiresIn: '24h' }
      );

      res.setHeader('Set-Cookie',
        `privatian_session=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
      );

      return res.status(200).json({
        success: true, token,
        user: { email: admin.email, role: admin.role, name, picture }
      });

    } catch(e) {
      console.error('[auth/verify]', e.message);
      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
