/**
 * api/articles.js — Single endpoint for all article operations
 * Routes via ?action= query param to stay within Vercel Hobby 12-function limit
 *
 * GET    /api/articles?action=list                  — list articles (public: published only; auth: all)
 * GET    /api/articles?action=get&id=X (or &slug=X) — get single article (public: published only; auth: all)
 * POST   /api/articles?action=save                  — create or update (requireAuth)
 * POST   /api/articles?action=publish&id=X          — toggle draft/published (requireAdmin)
 * DELETE /api/articles?action=delete&id=X           — delete permanently (requireAdmin)
 * POST   /api/articles?action=upload                — upload image (requireAuth)
 */

const { verifySession, requireAuth, requireAdmin } = require('./_lib/auth');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  const url = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
  return createClient(url, key);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100) || 'untitled';
}

function normalizeArticle(row) {
  if (!row) return null;
  return {
    id:               row.id,
    slug:             row.slug || '',
    title:            row.title || '',
    deck:             row.deck || row.excerpt || '',
    section:          row.section || row.section_slug || '',
    author:           row.author || 'The Privatian Family',
    author_role:      row.author_role || '',
    author_bio:       row.author_bio || '',
    author_photo_url: row.author_photo_url || '',
    hero_img_url:     row.hero_img_url || row.featured_image || '',
    hero_caption:     row.hero_caption || '',
    hero_credit:      row.hero_credit || '',
    content_html:     row.content_html || row.content || '',
    status:           row.status || (row.is_featured !== undefined ? 'published' : 'draft'),
    created_by:       row.created_by || '',
    created_at:       row.created_at || null,
    updated_at:       row.updated_at || row.created_at || null,
    published_at:     row.published_at || row.created_at || null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id, slug: querySlug, section, limit, status } = req.query || {};

  // ── LIST ────────────────────────────────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const session = verifySession(req);
    const client = sb();
    let query = client.from('articles').select('*');

    const { data, error } = await query;
    if (error) {
      // Return empty array gracefully if table is empty or permission denied
      console.warn('[Articles API] list error:', error.message);
      return res.status(200).json([]);
    }

    let rows = (data || []).map(normalizeArticle);

    // Public / unauthenticated callers only get published articles
    if (!session) {
      rows = rows.filter(a => a.status === 'published');
    } else if (status) {
      rows = rows.filter(a => a.status === status);
    }

    if (section && section !== 'all') {
      const sLower = section.toLowerCase();
      rows = rows.filter(a => (a.section || '').toLowerCase() === sLower || (a.slug || '').toLowerCase().includes(sLower));
    }

    // Sort by published_at or updated_at DESC
    rows.sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0));

    if (limit) {
      const l = parseInt(limit, 10);
      if (!isNaN(l) && l > 0) rows = rows.slice(0, l);
    }

    return res.status(200).json(rows);
  }

  // ── GET ─────────────────────────────────────────────────────────
  if (action === 'get' && req.method === 'GET') {
    const session = verifySession(req);
    const client = sb();

    if (!id && !querySlug) {
      return res.status(400).json({ error: 'id or slug required' });
    }

    let query = client.from('articles').select('*');
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', querySlug);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Article not found' });

    const normalized = normalizeArticle(data);

    // If unauthenticated and article is still a draft, do not expose
    if (!session && normalized.status !== 'published') {
      return res.status(404).json({ error: 'Article not found' });
    }

    return res.status(200).json(normalized);
  }

  // ── SAVE (create or update) ──────────────────────────────────────
  if (action === 'save' && req.method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return;

    const {
      id: bodyId, title = '', deck = '', section = '', author = '', author_role = '',
      author_bio = '', author_photo_url = '', hero_img_url = '', hero_caption = '',
      hero_credit = '', content_html = '', slug: bodySlug
    } = req.body || {};

    const client = sb();

    if (bodyId) {
      // UPDATE
      const updates = {
        title, deck, section, author, author_role, author_bio, author_photo_url,
        hero_img_url, hero_caption, hero_credit, content_html,
        updated_at: new Date().toISOString(),
      };
      if (bodySlug) updates.slug = bodySlug.toLowerCase().trim();
      const { data, error } = await client.from('articles').update(updates).eq('id', bodyId).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(normalizeArticle(data));
    } else {
      // CREATE — auto unique slug
      let slug = bodySlug ? slugify(bodySlug) : slugify(title || 'untitled');
      const { data: existing } = await client.from('articles').select('slug').ilike('slug', slug + '%');
      if (existing && existing.length > 0) {
        const nums = existing.map(a => { const m = a.slug.match(/-(\d+)$/); return m ? parseInt(m[1]) : 0; });
        slug = slug + '-' + (Math.max(...nums) + 1);
      }
      const { data, error } = await client.from('articles').insert({
        slug, title, deck, section, author, author_role, author_bio, author_photo_url,
        hero_img_url, hero_caption, hero_credit, content_html,
        status: 'draft', created_by: session.email,
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(normalizeArticle(data));
    }
  }

  // ── PUBLISH (toggle) ────────────────────────────────────────────
  if (action === 'publish' && req.method === 'POST') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const client = sb();
    const { data: article } = await client.from('articles').select('status').eq('id', id).single();
    if (!article) return res.status(404).json({ error: 'Not found' });
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    const { data, error } = await client.from('articles').update({
      status: newStatus,
      published_at: newStatus === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(normalizeArticle(data));
  }

  // ── DELETE ──────────────────────────────────────────────────────
  if (action === 'delete' && req.method === 'DELETE') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb().from('articles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // ── UPLOAD (image) ───────────────────────────────────────────────
  if (action === 'upload' && req.method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return;

    try {
      if (req.body && req.body.image) {
        return res.status(200).json({ url: req.body.image });
      }
      if (req.body && typeof req.body === 'object' && req.body.data) {
        return res.status(200).json({ url: req.body.data });
      }
      if (req.rawBody) {
        const base64 = `data:image/jpeg;base64,${req.rawBody.toString('base64')}`;
        return res.status(200).json({ url: base64 });
      }

      // Signed Supabase Storage upload URL pattern
      const client = sb();
      const fileName = 'article-imgs/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
      const { data: signedData, error: signErr } = await client.storage
        .from('article-images')
        .createSignedUploadUrl(fileName);

      if (signedData && !signErr) {
        const publicUrl = client.storage.from('article-images').getPublicUrl(fileName).data.publicUrl;
        return res.status(200).json({
          uploadUrl: signedData.signedUrl,
          token: signedData.token,
          path: fileName,
          publicUrl,
          url: publicUrl,
        });
      }

      return res.status(200).json({
        url: req.body?.url || 'assets/images/img1.png',
        success: true
      });
    } catch (e) {
      return res.status(500).json({ error: 'Image upload failed: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action or method' });
};
