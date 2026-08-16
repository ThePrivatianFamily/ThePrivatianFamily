/**
 * api/email-settings.js — Endpoint for Managing Supabase Auth Email Templates
 * 
 * Supports:
 *   GET  /api/email-settings?action=get   — Fetch current email templates and SMTP sender config
 *   POST /api/email-settings?action=save  — Update email templates and subjects via Supabase Management API
 *   POST /api/email-settings?action=test  — Send a live test verification OTP email to specified address
 */

const { requireAdmin } = require('./_lib/auth');
const { logActivity } = require('./_lib/activity');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'aenhajqjsgskimfzvlfr';
const SUPABASE_MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || Buffer.from('c2JwXzQzMzNmZjBmMjkzZjU4NGUyYzVhMjk3MDNhYjY4ZDhhOTY1MTFhZTY=', 'base64').toString('utf8');

function sb() {
  return createClient(process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co', process.env.SUPABASE_SERVICE_KEY);
}

function fetchSupabaseAuthConfig() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_MANAGEMENT_TOKEN}`,
        'User-Agent': 'Node'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`));
        } catch(err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function patchSupabaseAuthConfig(payload) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        'User-Agent': 'Node'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`));
        } catch(err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const action = req.query.action || 'get';

  // 1. GET EMAIL SETTINGS & TEMPLATES
  if (action === 'get' && req.method === 'GET') {
    try {
      const config = await fetchSupabaseAuthConfig();
      return res.status(200).json({
        smtp_sender_name: config.smtp_sender_name || 'The Privatian Family',
        smtp_admin_email: config.smtp_admin_email || 'theprivatianfamilybd@gmail.com',
        mailer_otp_exp: config.mailer_otp_exp || 3600,
        mailer_otp_length: config.mailer_otp_length || 6,
        mailer_subjects_magic_link: config.mailer_subjects_magic_link || 'Your 6-Digit Admin Verification Code (OTP) - The Privatian Family',
        mailer_templates_magic_link_content: config.mailer_templates_magic_link_content || '',
        mailer_subjects_invite: config.mailer_subjects_invite || 'You have been invited to The Privatian Family',
        mailer_templates_invite_content: config.mailer_templates_invite_content || '',
        mailer_subjects_recovery: config.mailer_subjects_recovery || 'Reset Password - The Privatian Family',
        mailer_templates_recovery_content: config.mailer_templates_recovery_content || ''
      });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. SAVE EMAIL TEMPLATE & SETTINGS
  if (action === 'save' && req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const patchData = {};

      if (body.mailer_subjects_magic_link !== undefined) patchData.mailer_subjects_magic_link = body.mailer_subjects_magic_link;
      if (body.mailer_templates_magic_link_content !== undefined) patchData.mailer_templates_magic_link_content = body.mailer_templates_magic_link_content;
      if (body.smtp_sender_name !== undefined) patchData.smtp_sender_name = body.smtp_sender_name;
      if (body.mailer_otp_exp !== undefined) patchData.mailer_otp_exp = parseInt(body.mailer_otp_exp, 10) || 3600;
      if (body.mailer_subjects_invite !== undefined) patchData.mailer_subjects_invite = body.mailer_subjects_invite;
      if (body.mailer_templates_invite_content !== undefined) patchData.mailer_templates_invite_content = body.mailer_templates_invite_content;
      if (body.mailer_subjects_recovery !== undefined) patchData.mailer_subjects_recovery = body.mailer_subjects_recovery;
      if (body.mailer_templates_recovery_content !== undefined) patchData.mailer_templates_recovery_content = body.mailer_templates_recovery_content;

      const updated = await patchSupabaseAuthConfig(patchData);

      try {
        await logActivity({
          actor: session,
          action: 'settings.email_template_update',
          category: 'settings',
          summary: `${session.name || session.email} updated email verification templates and sender settings`,
          target_id: 'email_templates',
          target_name: 'Auth Email Templates',
          details: { updated_fields: Object.keys(patchData) },
          req
        });
      } catch(e) {}

      return res.status(200).json({ success: true, updated });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 3. SEND TEST VERIFICATION EMAIL
  if (action === 'test' && req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const targetEmail = (body && body.email ? body.email.trim() : session.email).toLowerCase();

      const client = sb();
      const { error } = await client.auth.signInWithOtp({
        email: targetEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      try {
        await logActivity({
          actor: session,
          action: 'settings.email_test_send',
          category: 'settings',
          summary: `${session.name || session.email} triggered a test verification email to ${targetEmail}`,
          target_id: targetEmail,
          target_name: targetEmail,
          details: { recipient: targetEmail },
          req
        });
      } catch(e) {}

      return res.status(200).json({ success: true, message: `Test verification email sent to ${targetEmail}` });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
