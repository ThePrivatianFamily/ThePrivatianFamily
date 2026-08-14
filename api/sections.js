/**
 * /api/sections — Full CRUD handler for the Sections feature.
 *
 * GET  ?status=active     Public — returns active, non-deleted, non-locked sections.
 * GET  ?status=all        Auth required — returns all sections (admin panel view).
 * POST                    Auth — create a new section.
 * PUT  ?id=<admin_id>     Auth — rename/re-slug a section.
 * PATCH ?id=<admin_id>    Auth — restore a trashed section.
 * DELETE ?id=<admin_id>             Auth — soft-delete (move to trash).
 * DELETE ?id=<admin_id>&mode=permanent  Auth — permanently delete.
 */

const { createClient } = require('@supabase/supabase-js');
const { verifySession } = require('./_lib/auth');

function rowToAdminSection(row) {
  return {
    id:        row.admin_id || row.slug,
    name:      row.name,
    slug:      row.slug || '',
    locked:    row.locked    || false,
    deleted:   row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at || null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
  const sb = createClient(url, key);

  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const statusParam = (req.query && req.query.status) || 'active';
    const session = verifySession(req);

    let query = sb.from('sections').select('*').order('display_order', { ascending: true });

    if (statusParam === 'all' && session) {
      // Authenticated admin: return everything including deleted
    } else {
      // Public: only active, non-deleted rows
      query = query.eq('is_active', true).eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];

    if (statusParam === 'all' && session) {
      // Admin format: full section objects
      return res.status(200).json(rows.map(rowToAdminSection));
    } else {
      // Public format: minimal shape, no locked rows
      return res.status(200).json(
        rows
          .filter(r => !r.locked)
          .map(r => ({ name: r.name, slug: r.slug, display_order: r.display_order }))
      );
    }
  }

  // ── All mutations require auth ────────────────────────────────────────────
  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated', redirect: '/admin-login.html' });

  // ── POST: create section ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const name    = (body.name   || '').trim();
    const slug    = (body.slug   || '').trim();
    const adminId = (body.admin_id || slug || '').trim();

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    // Check uniqueness
    const { data: existing } = await sb.from('sections')
      .select('id').or(`name.eq.${name},slug.eq.${slug},admin_id.eq.${adminId}`).eq('is_deleted', false).limit(1);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'A section with that name or slug already exists.' });
    }

    // Next display order
    const { data: maxRow } = await sb.from('sections')
      .select('display_order').order('display_order', { ascending: false }).limit(1);
    const nextOrder = (maxRow && maxRow[0] ? maxRow[0].display_order : 0) + 1;

    const { data, error } = await sb.from('sections').insert({
      name, slug, admin_id: adminId,
      display_order: nextOrder,
      is_active: true, locked: false, is_deleted: false, deleted_at: null,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(rowToAdminSection(data));
  }

  // ── PUT: rename / re-slug ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const id   = req.query && req.query.id;
    const body = req.body || {};
    const name = (body.name || '').trim();
    const slug = (body.slug || '').trim();

    if (!id)   return res.status(400).json({ error: 'id (admin_id) is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await sb.from('sections')
      .update({ name, slug })
      .eq('admin_id', id)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(rowToAdminSection(data));
  }

  // ── PATCH: restore from trash ─────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: 'id (admin_id) is required' });

    const { data, error } = await sb.from('sections')
      .update({ is_active: true, is_deleted: false, deleted_at: null })
      .eq('admin_id', id)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(rowToAdminSection(data));
  }

  // ── DELETE: soft-delete or permanent ─────────────────────────────────────
  if (req.method === 'DELETE') {
    const id   = req.query && req.query.id;
    const mode = req.query && req.query.mode;
    if (!id) return res.status(400).json({ error: 'id (admin_id) is required' });

    if (mode === 'permanent') {
      const { error } = await sb.from('sections').delete().eq('admin_id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // Soft delete (move to trash)
    const { data, error } = await sb.from('sections')
      .update({ is_active: false, is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('admin_id', id)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(rowToAdminSection(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
};