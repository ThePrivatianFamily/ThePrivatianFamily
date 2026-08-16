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
const { verifySession, requireAuth } = require('./_lib/auth');
const { logActivity }   = require('./_lib/activity');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── ME ──────────────────────────────────────────────────────────
  if (action === 'me') {
    const s = await requireAuth(req, res);
    if (!s) return;
    return res.status(200).json({ email: s.email, role: s.role, name: s.name || s.email, picture: s.picture || '' });
  }

  // ── LOGOUT ──────────────────────────────────────────────────────
  if (action === 'logout') {
    const s = verifySession(req);
    if (s) {
      try {
        await logActivity({
          actor: s,
          action: 'auth.logout',
          category: 'auth',
          summary: `${s.name || s.email} logged out of Admin Panel`,
          target_id: s.email,
          target_name: s.email,
          details: {},
          req
        });
      } catch(err) {
        console.warn('[auth/logout log error]:', err.message);
      }
    }
    res.setHeader('Set-Cookie', 'privatian_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
    return res.status(200).json({ success: true });
  }

  // ── VERIFY (Google OAuth) ────────────────────────────────────────
  if (action === 'verify' && req.method === 'POST') {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    try {
      const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket  = await gClient.verifyIdToken({
        idToken:  credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const gp = ticket.getPayload();
      if (!gp.email_verified) return res.status(401).json({ error: 'Email not verified with Google' });

      const email   = gp.email.toLowerCase();
      const name    = gp.name    || email;
      const picture = gp.picture || '';

      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
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

      const token = jwt.sign(
        { email: admin.email, role: admin.role, name, picture },
        process.env.SESSION_SECRET,
        { expiresIn: '24h' }
      );

      res.setHeader('Set-Cookie',
        `privatian_session=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
      );

      // Record Activity Log for login — properly awaited before response
      try {
        await logActivity({
          actor: { email: admin.email, name, role: admin.role },
          action: 'auth.login',
          category: 'auth',
          summary: `${name} (${admin.email}) logged in successfully via Google OAuth`,
          target_id: admin.id || admin.email,
          target_name: admin.email,
          details: { method: 'Google OAuth', role: admin.role },
          req
        });
      } catch(logErr) {
        console.warn('[auth/verify log error]:', logErr.message);
      }

      return res.status(200).json({
        success: true, token,
        user: { email: admin.email, role: admin.role, name, picture }
      });

    } catch(e) {
      console.error('[auth/verify]', e.message);
      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  }

  // ── CHECK WHITELIST & PROGRESSIVE OTP RATE LIMIT ────────────────
  if (action === 'check-whitelist' && req.method === 'POST') {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    try {
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { data: admin, error } = await sb
        .from('allowed_admins')
        .select('*')
        .ilike('email', emailNorm)
        .eq('status', 'active')
        .single();

      if (error || !admin) {
        return res.status(403).json({
          allowed: false,
          error: 'This email is not authorized to access the admin panel. Contact an administrator to request access.',
          email: emailNorm
        });
      }

      // Check progressive rate limits
      // Tier 1 (1st request): 60s (1 minute)
      // Tier 2 (2nd request): 60s (1 minute)
      // Tier 3 (3rd request): 600s (10 minutes)
      // Tier 4 (4th request): 3600s (1 hour)
      // Tier 5 (5th+ request): 86400s (24 hours - MAX limit)
      const now = new Date();
      const { data: rateRow } = await sb
        .from('otp_rate_limits')
        .select('*')
        .eq('email', admin.email)
        .single();

      if (rateRow && rateRow.locked_until) {
        const lockedUntil = new Date(rateRow.locked_until);
        if (lockedUntil > now) {
          const remainingSec = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
          let durationText = '';
          if (remainingSec >= 3600) {
            const h = Math.ceil(remainingSec / 3600);
            durationText = `${h} hour${h > 1 ? 's' : ''}`;
          } else if (remainingSec >= 60) {
            const m = Math.ceil(remainingSec / 60);
            durationText = `${m} minute${m > 1 ? 's' : ''}`;
          } else {
            durationText = `${remainingSec} second${remainingSec !== 1 ? 's' : ''}`;
          }

          return res.status(429).json({
            allowed: false,
            rateLimited: true,
            lockoutRemaining: remainingSec,
            error: `Too many OTP requests. For security, please wait ${durationText} before requesting another code, or enter the 6-digit code already sent to your email.`,
            email: admin.email
          });
        }
      }

      let attempts = 1;
      if (rateRow && rateRow.last_requested_at) {
        const lastReq = new Date(rateRow.last_requested_at);
        const diffMs = now.getTime() - lastReq.getTime();
        // Reset streak if inactive for > 24 hours
        if (diffMs < 24 * 60 * 60 * 1000) {
          attempts = (rateRow.attempts || 0) + 1;
        }
      }

      // Calculate cooldown seconds
      let cooldownSec = 60;
      if (attempts <= 2) {
        cooldownSec = 60; // 1 min
      } else if (attempts === 3) {
        cooldownSec = 600; // 10 min
      } else if (attempts === 4) {
        cooldownSec = 3600; // 1 hour
      } else {
        cooldownSec = 86400; // 24 hours MAX limit
      }

      const nextLockedUntil = new Date(now.getTime() + cooldownSec * 1000);
      await sb.from('otp_rate_limits').upsert({
        email: admin.email,
        attempts: attempts,
        last_requested_at: now.toISOString(),
        locked_until: nextLockedUntil.toISOString()
      });

      return res.status(200).json({
        allowed: true,
        email: admin.email,
        role: admin.role,
        cooldownSeconds: cooldownSec,
        attempts: attempts
      });
    } catch(e) {
      console.error('[auth/check-whitelist]', e.message);
      return res.status(500).json({ error: 'Failed to verify authorization. Please try again.' });
    }
  }

  // ── VERIFY EMAIL OTP (Supabase OTP) ───────────────────────────
  if ((action === 'verify-otp' || action === 'verify-magic-link') && req.method === 'POST') {
    const { access_token } = req.body || {};
    if (!access_token || typeof access_token !== 'string') {
      return res.status(400).json({ error: 'No access token provided.' });
    }

    try {
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { data: { user }, error: userErr } = await sb.auth.getUser(access_token);

      if (userErr || !user || !user.email) {
        return res.status(401).json({
          error: 'The verification code is invalid, expired, or has already been used. Please request a new code.'
        });
      }

      const email = user.email.toLowerCase();

      // Live whitelist verification
      const { data: admin, error: adminErr } = await sb
        .from('allowed_admins')
        .select('*')
        .ilike('email', email)
        .eq('status', 'active')
        .single();

      if (adminErr || !admin) {
        return res.status(403).json({
          error: 'This email is not authorized to access the admin panel.',
          email
        });
      }

      const name    = user.user_metadata?.full_name || user.user_metadata?.name || admin.name || email.split('@')[0];
      const picture = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      const token = jwt.sign(
        { email: admin.email, role: admin.role, name, picture },
        process.env.SESSION_SECRET,
        { expiresIn: '24h' }
      );

      res.setHeader('Set-Cookie',
        `privatian_session=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
      );

      // Reset rate limit streak on successful login
      try {
        await sb.from('otp_rate_limits').delete().eq('email', admin.email);
      } catch(rateClearErr) {
        console.warn('[auth/clear-rate-limit]', rateClearErr.message);
      }

      // Record Activity Log for OTP login
      try {
        await logActivity({
          actor: { email: admin.email, name, role: admin.role },
          action: 'auth.login',
          category: 'auth',
          summary: `${name} (${admin.email}) logged in successfully via Email Verification Code (OTP)`,
          target_id: admin.id || admin.email,
          target_name: admin.email,
          details: { method: 'Email OTP (Supabase)', role: admin.role },
          req
        });
      } catch(logErr) {
        console.warn('[auth/verify-otp log error]:', logErr.message);
      }

      return res.status(200).json({
        success: true,
        token,
        user: { email: admin.email, role: admin.role, name, picture }
      });

    } catch(e) {
      console.error('[auth/verify-otp]', e.message);
      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
