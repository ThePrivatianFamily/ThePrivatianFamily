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
const { verifySession, requireAuth, requireAdmin } = require('./_lib/auth');

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

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const action = req.query && req.query.action;

  // ── MENU CONFIGURATION (GET / POST) ─────────────────────────────────────
  if (action === 'menu') {
    const DEFAULT_MENU_CONFIG = {
      sectionsTitle: 'Sections',
      seriesTitle: 'Featured series',
      series: [
        {
          id: 'series-1',
          title: 'Wondering',
          href: 'section.html?slug=findings',
          description: 'A series of profound questions explored by The Privatian Family experts.',
          enabled: true
        }
      ],
      exploreTitle: 'Explore the Privatian',
      explore: [
        { id: 'exp-1', label: 'Events', href: 'index.html#events-section', target: '_self', enabled: true },
        { id: 'exp-2', label: 'Article archive', href: 'index.html', target: '_self', enabled: true },
        { id: 'exp-3', label: 'About us', href: 'index.html', target: '_self', enabled: true },
        { id: 'exp-4', label: 'News+', href: 'index.html', target: '_self', enabled: true },
        { id: 'exp-5', label: 'Podcast', href: 'index.html', target: '_self', enabled: true }
      ],
      latestTitle: 'Read the latest',
      latestMode: 'curated',
      latest: [
        {
          id: 'latest-1',
          title: "For families in transition, 'not all traditions are equal'",
          href: 'section.html?slug=community-heritage',
          imageUrl: 'img1.png',
          enabled: true
        },
        {
          id: 'latest-2',
          title: 'The art of the pen: How writing shapes cultural identity',
          href: 'section.html?slug=culture',
          imageUrl: 'img3.png',
          enabled: true
        }
      ]
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'navigation_menu_config').maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__menu_config__').maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') return res.status(200).json(parsed);
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_MENU_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const menuConfig = req.body || {};

      let saved = false;
      try {
        const { error } = await sb.from('site_settings').upsert({
          key: 'navigation_menu_config',
          value: menuConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!error) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__menu_config__').maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(menuConfig),
              slug: '__menu_config__',
              display_order: 9999,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', '__menu_config__');
          } else {
            await sb.from('sections').insert({
              admin_id: '__menu_config__',
              name: JSON.stringify(menuConfig),
              slug: '__menu_config__',
              display_order: 9999,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }
        } catch(err) {
          console.warn('[DB fallback save error]:', err.message);
        }
      }
      return res.status(200).json({ ok: true, data: menuConfig });
    }
  }

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

    const rows = (data || []).filter(r => r.admin_id !== '__menu_config__');

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

  // ── POST: create section ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

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
    const session = await requireAuth(req, res);
    if (!session) return;

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
    const session = await requireAuth(req, res);
    if (!session) return;

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
      // Hard delete — STRICTLY Admin only with live DB check
      const session = await requireAdmin(req, res);
      if (!session) return;

      const { error } = await sb.from('sections').delete().eq('admin_id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // Soft delete (move to trash)
    const session = await requireAuth(req, res);
    if (!session) return;

    const { data, error } = await sb.from('sections')
      .update({ is_active: false, is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('admin_id', id)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(rowToAdminSection(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
};