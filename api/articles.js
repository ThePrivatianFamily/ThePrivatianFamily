/**
 * api/articles.js — Single endpoint for all article operations
 * Routes via ?action= query param to stay within Vercel Hobby 12-function limit
 *
 * GET  /api/articles?action=list           — list all articles (requireAuth)
 * GET  /api/articles?action=get&id=X       — get single article (requireAuth)
 * POST /api/articles?action=save           — create or update (requireAuth)
 * POST /api/articles?action=publish&id=X   — toggle draft/published (requireAdmin)
 * DELETE /api/articles?action=delete&id=X  — delete permanently (requireAdmin)
 */

const { requireAuth, requireAdmin } = require('./_lib/auth');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100) || 'untitled';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id } = req.query;

  // ── PUBLIC: list published articles (no auth) ───────────────────
  if (action === 'public' && req.method === 'GET') {
    const section = req.query.section || '';
    const limit   = Math.min(parseInt(req.query.limit  || '50', 10), 100);
    const offset  = Math.max(parseInt(req.query.offset || '0',  10), 0);
    let query = sb().from('articles')
      .select('id, slug, title, deck, section, author, published_at, hero_img_url, tags')
      .eq('status', 'published')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (section && section !== 'all') {
      query = query.ilike('section', '%' + section.replace(/-/g, '%') + '%');
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // ── PUBLIC GET: single published article by slug, or any article by Unique ID (preview/draft) ─────
  if (action === 'public-get' && req.method === 'GET') {
    const slug = req.query.slug || '';
    let query = sb().from('articles').select('*')
      .or('is_deleted.is.null,is_deleted.eq.false');
    if (id) {
      // By Unique ID -> accessible for preview & draft lookup
      query = query.eq('id', id);
    } else if (slug) {
      // By slug -> published articles only on public site
      query = query.eq('slug', slug).eq('status', 'published');
    } else {
      return res.status(400).json({ error: 'id or slug required' });
    }

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: 'Article not found or not published' });
    return res.status(200).json(data);
  }

  // ── LIST (admin — active only) ────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;
    const { data, error } = await sb()
      .from('articles')
      .select('id, slug, title, deck, section, author, status, created_at, updated_at, published_at, hero_img_url')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // ── TRASH LIST (admin) ──────────────────────────────────────
  if (action === 'trash' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;
    const { data, error } = await sb()
      .from('articles')
      .select('id, slug, title, section, author, status, deleted_at, hero_img_url')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // ── RESTORE (from trash) ────────────────────────────────────
  if (action === 'restore' && req.method === 'PATCH') {
    const session = await requireAuth(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb().from('articles')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // ── GET (admin — any status) ───────────────────────────────
  if (action === 'get' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data, error } = await sb().from('articles').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Article not found' });
    return res.status(200).json(data);
  }

  // ── SAVE (create or update) ───────────────────────────────────────
  if (action === 'save' && req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const {
      id: bodyId, title = '', deck = '', section = '', author = '', author_role = '',
      author_bio = '', author_photo_url = '', hero_img_url = '', hero_img_alt = '',
      hero_caption = '', hero_credit = '', content_html = '', slug: bodySlug,
      seo_title = '', meta_description = '', tags = '', status: bodyStatus,
    } = req.body || {};

    const client = sb();

    if (bodyId) {
      // UPDATE
      const updates = {
        title, deck, section, author, author_role, author_bio, author_photo_url,
        hero_img_url, hero_img_alt, hero_caption, hero_credit, content_html,
        seo_title, meta_description, tags,
        updated_at: new Date().toISOString(),
      };
      if (bodyStatus) {
        updates.status = bodyStatus;
        if (bodyStatus === 'published') {
          updates.published_at = new Date().toISOString();
        } else if (bodyStatus === 'draft') {
          updates.published_at = null;
        }
      }
      if (bodySlug) updates.slug = slugify(bodySlug);
      const { data, error } = await client.from('articles').update(updates).eq('id', bodyId).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } else {
      // CREATE — custom slug or auto unique slug from title
      let rawSlug = (bodySlug || '').trim() ? slugify(bodySlug) : slugify(title || 'untitled');
      let slug = rawSlug;
      const { data: existing } = await client.from('articles').select('id, slug').ilike('slug', rawSlug + '%');
      if (existing && existing.length > 0) {
        const hasExact = existing.some(a => a.slug === rawSlug);
        if (hasExact) {
          const nums = existing.map(a => { const m = a.slug.match(/-(\d+)$/); return m ? parseInt(m[1]) : 0; });
          slug = rawSlug + '-' + (Math.max(...nums, 0) + 1);
        }
      }
      const newArticle = {
        slug, title, deck, section, author, author_role, author_bio, author_photo_url,
        hero_img_url, hero_img_alt, hero_caption, hero_credit, content_html,
        seo_title, meta_description, tags,
        status: bodyStatus || 'draft',
        created_by: session.email,
      };
      if (bodyId) newArticle.id = bodyId;
      if (bodyStatus === 'published') newArticle.published_at = new Date().toISOString();
      const { data, error } = await client.from('articles').insert(newArticle).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
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
    return res.status(200).json(data);
  }

  // ── DELETE ─────────────────────────────────────────────────────
  if (action === 'delete' && req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' });
    const mode = req.query.mode;
    if (mode === 'permanent') {
      // Hard delete — STRICTLY requires Admin role with live DB check
      const session = await requireAdmin(req, res);
      if (!session) return;
      const { error } = await sb().from('articles').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, permanent: true });
    }
    // Soft delete — move to trash (allowed for authenticated staff)
    const session = await requireAuth(req, res);
    if (!session) return;
    const { error } = await sb().from('articles')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, soft: true });
  }

  // ── UPLOAD (image) ───────────────────────────────────────────────
  // POST /api/articles?action=upload  multipart/form-data  field: file
  if (action === 'upload' && req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

    // Parse multipart — use built-in formidable-style via Vercel's body parser
    // Vercel does NOT auto-parse multipart; we need the raw buffer.
    // Best approach: store in Supabase Storage via signed upload URL pattern.
    // Since we don't have formidable, store image as base64 data URL temporarily
    // and let the client handle it via Supabase Storage JS SDK.
    // HOWEVER: simplest production approach — return a Supabase Storage signed URL
    // for client-side direct upload.

    const { createClient: sc } = require('@supabase/supabase-js');
    const client = sc(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const fileName = 'article-imgs/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';

    // Create a signed upload URL (client will PUT the file directly to Supabase Storage)
    const { data: signedData, error: signErr } = await client.storage
      .from('article-images')
      .createSignedUploadUrl(fileName);

    if (signErr) return res.status(500).json({ error: signErr.message });
    const publicUrl = client.storage.from('article-images').getPublicUrl(fileName).data.publicUrl;
    return res.status(200).json({
      uploadUrl: signedData.signedUrl,
      token: signedData.token,
      path: fileName,
      publicUrl,
    });
  }

  return res.status(400).json({ error: 'Unknown action or method' });
};
