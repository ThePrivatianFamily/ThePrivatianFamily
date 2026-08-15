/**
 * api/admins.js — Single endpoint for all admin management operations
 * Routes via ?action= query param
 *
 * GET    /api/admins?action=list                 — list all admins
 * GET    /api/admins?action=check                — check own access + DB role
 * POST   /api/admins?action=add                  — add new admin
 * PATCH  /api/admins?action=update&id=X          — update role/status
 * DELETE /api/admins?action=remove&id=X          — soft-delete (to recycle)
 * DELETE /api/admins?action=purge&id=X           — permanently delete recycled account
 */

const { requireAuth, requireAdmin } = require('./_lib/auth');
const { logActivity } = require('./_lib/activity');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function countGmailAdmins(client, excludeId) {
  const { data } = await client
    .from('allowed_admins')
    .select('id, email, role')
    .eq('status', 'active')
    .eq('role', 'Admin');
  return (data || [])
    .filter(a => a.email.toLowerCase().endsWith('@gmail.com') && a.id !== excludeId)
    .length;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id } = req.query;
  const client = sb();

  // ── LIST ────────────────────────────────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    const { data, error } = await client
      .from('allowed_admins')
      .select('id, email, role, status, added_by, added_at, modified_by, modified_at, modified_action')
      .order('added_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // ── CHECK (own access) ───────────────────────────────────────────
  if (action === 'check' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const { verifySession } = require('./_lib/auth');
    const session = verifySession(req);
    if (!session) return res.status(401).json({ ok: false, reason: 'invalid_token' });
    const { data } = await client
      .from('allowed_admins')
      .select('status, role')
      .ilike('email', session.email)
      .single();
    if (!data) return res.status(200).json({ ok: false, reason: 'not_found' });
    if (data.status !== 'active') return res.status(200).json({ ok: false, reason: data.status });
    return res.status(200).json({ ok: true, role: data.role });
  }

  // ── ADD ─────────────────────────────────────────────────────────
  if (action === 'add' && req.method === 'POST') {
    const session = await requireAdmin(req, res);
    if (!session) return;

    const { email, role } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: 'email and role are required' });
    if (!['Admin', 'Moderator'].includes(role)) return res.status(400).json({ error: 'role must be Admin or Moderator' });

    const emailNorm = email.toLowerCase().trim();
    const { data: existing } = await client.from('allowed_admins').select('status').ilike('email', emailNorm).maybeSingle();
    if (existing) {
      if (existing.status === 'active')    return res.status(400).json({ error: 'already_active', message: 'This email already has active access.' });
      if (existing.status === 'suspended') return res.status(400).json({ error: 'already_suspended', message: 'This email is currently suspended. Go to the Suspended tab and restore them instead.' });
      if (existing.status === 'deleted')   return res.status(400).json({ error: 'already_in_recycle', message: 'This email is in the Recycle bin. Go to the Recycle tab and restore them instead.' });
    }

    const { data, error } = await client
      .from('allowed_admins')
      .insert({ email: emailNorm, role, added_by: session.email, status: 'active' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    logActivity({
      actor: session,
      action: 'admin.add',
      category: 'admins',
      summary: `${session.name || session.email} added "${emailNorm}" to whitelist as ${role}`,
      target_id: data.id,
      target_name: emailNorm,
      details: { role, target_email: emailNorm },
      req
    }).catch(() => {});

    return res.status(201).json(data);
  }

  // ── UPDATE (role / status) ───────────────────────────────────────
  if (action === 'update' && req.method === 'PATCH') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { status, role } = req.body || {};
    const updates = {};
    if (status && ['active', 'suspended', 'deleted'].includes(status)) updates.status = status;
    if (role   && ['Admin', 'Moderator'].includes(role))               updates.role   = role;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid updates' });

    const { data: target } = await client.from('allowed_admins').select('*').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Admin not found' });

    if (target.email.toLowerCase() === session.email.toLowerCase()) {
      if (updates.status === 'suspended' || updates.status === 'deleted')
        return res.status(400).json({ error: 'You cannot suspend or remove your own account.' });
    }

    const isGmailAdmin = target.email.toLowerCase().endsWith('@gmail.com') && target.role === 'Admin';
    const willDeactivate = (updates.status === 'suspended' || updates.status === 'deleted') && target.status === 'active';
    if (willDeactivate && isGmailAdmin) {
      const remaining = await countGmailAdmins(client, id);
      if (remaining < 2) return res.status(400).json({ error: 'min_admins', message: 'At least 2 Gmail Admin accounts must remain active. Add another Gmail Admin first.' });
    }

    const willDowngrade = updates.role === 'Moderator' && target.role === 'Admin';
    if (willDowngrade && isGmailAdmin && target.status === 'active') {
      const remaining = await countGmailAdmins(client, id);
      if (remaining < 2) return res.status(400).json({ error: 'min_admins', message: 'At least 2 Gmail Admin accounts must remain active. Add another Gmail Admin before downgrading this one.' });
    }

    let auditAction = null;
    let actionSummary = '';
    if (updates.status === 'suspended') {
      auditAction = 'suspended';
      actionSummary = `${session.name || session.email} suspended account "${target.email}"`;
    }
    if (updates.status === 'active' && target.status === 'suspended') {
      auditAction = 'unsuspended';
      actionSummary = `${session.name || session.email} unsuspended/restored account "${target.email}"`;
    }
    if (updates.status === 'active' && target.status === 'deleted') {
      auditAction = 'restored';
      actionSummary = `${session.name || session.email} restored account "${target.email}" from recycle bin`;
    }
    if (updates.status === 'deleted') {
      auditAction = 'deleted';
      actionSummary = `${session.name || session.email} moved account "${target.email}" to recycle bin`;
    }
    if (updates.role && updates.role !== target.role) {
      auditAction = 'role_changed_to_' + updates.role;
      actionSummary = `${session.name || session.email} changed role of "${target.email}" from ${target.role} to ${updates.role}`;
    }

    if (auditAction) {
      updates.modified_by     = session.email;
      updates.modified_at     = new Date().toISOString();
      updates.modified_action = auditAction;
    }

    const { data, error } = await client.from('allowed_admins').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    if (auditAction) {
      logActivity({
        actor: session,
        action: 'admin.' + auditAction,
        category: 'admins',
        summary: actionSummary,
        target_id: target.id,
        target_name: target.email,
        details: { old: target, updates },
        req
      }).catch(() => {});
    }

    return res.status(200).json(data);
  }

  // ── REMOVE (soft-delete → recycle) ──────────────────────────────
  if (action === 'remove' && req.method === 'DELETE') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { data: target } = await client.from('allowed_admins').select('*').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Admin not found' });

    if (target.email.toLowerCase() === session.email.toLowerCase())
      return res.status(400).json({ error: 'You cannot remove your own account.' });

    const isGmailAdmin = target.status === 'active' && target.role === 'Admin' && target.email.toLowerCase().endsWith('@gmail.com');
    if (isGmailAdmin) {
      const count = await countGmailAdmins(client, id);
      if (count < 2) return res.status(400).json({ error: 'min_admins', message: 'At least 2 Gmail Admin accounts must remain active. Add another Gmail Admin first.' });
    }

    const { error } = await client.from('allowed_admins').update({
      status: 'deleted', modified_by: session.email,
      modified_at: new Date().toISOString(), modified_action: 'deleted'
    }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    logActivity({
      actor: session,
      action: 'admin.remove_to_recycle',
      category: 'admins',
      summary: `${session.name || session.email} moved account "${target.email}" to Recycle bin`,
      target_id: target.id,
      target_name: target.email,
      details: { previousStatus: target.status },
      req
    }).catch(() => {});

    return res.status(200).json({ success: true });
  }

  // ── PURGE (permanent delete from recycle) ───────────────────────
  if (action === 'purge' && req.method === 'DELETE') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { data: target } = await client.from('allowed_admins').select('status, email').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (target.status !== 'deleted') return res.status(400).json({ error: 'Account must be in Recycle before permanent deletion.' });

    const { error } = await client.from('allowed_admins').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    logActivity({
      actor: session,
      action: 'admin.purge_permanent',
      category: 'admins',
      summary: `${session.name || session.email} permanently deleted account "${target.email}" from whitelist`,
      target_id: id,
      target_name: target.email,
      details: {},
      req
    }).catch(() => {});

    return res.status(200).json({ success: true, email: target.email });
  }

  return res.status(400).json({ error: 'Unknown action or method' });
};

