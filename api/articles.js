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
const { handleCors } = require('./_lib/cors');
const { logActivity } = require('./_lib/activity');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
  return createClient(supabaseUrl, supabaseKey);
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
  if (handleCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  const { action, id } = req.query;

  // ── PUBLIC: list published articles (no auth) ───────────────────
  if (action === 'public' && req.method === 'GET') {
    const section = req.query.section || '';
    const limit   = Math.min(parseInt(req.query.limit  || '50', 10), 100);
    const offset  = Math.max(parseInt(req.query.offset || '0',  10), 0);
    let query = sb().from('articles')
      .select('id, slug, title, title_bn, deck, deck_bn, section, author, author_bn, published_at, hero_img_url, tags')
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

  // ── GET SINGLE ARTICLE: by slug (public live) OR by Unique ID (admin draft/preview only) ─────
  if (action === 'public-get' && req.method === 'GET') {
    const slug = req.query.slug || '';
    if (id) {
      // By Unique ID (Draft Preview Mode) -> STRICTLY require authenticated admin session
      const session = await requireAuth(req, res);
      if (!session) return; // requireAuth sends 401/403

      let query = sb().from('articles').select('*')
        .eq('id', id)
        .or('is_deleted.is.null,is_deleted.eq.false');

      const { data, error } = await query.single();
      if (error || !data) return res.status(404).json({ error: 'Article not found' });

      // If accessed via preview mode with id, and there is a working draft stored in content, merge it for preview
      if (req.query.preview === '1' && data.content) {
        try {
          const draftObj = JSON.parse(data.content);
          if (draftObj && typeof draftObj === 'object') {
            Object.assign(data, draftObj);
          }
        } catch(e) {}
      }

      return res.status(200).json(data);
    } else if (slug) {
      // By slug -> public live site, published articles only (no auth required)
      let query = sb().from('articles').select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .or('is_deleted.is.null,is_deleted.eq.false');

      const { data, error } = await query.single();
      if (error || !data) return res.status(404).json({ error: 'Article not found or not published' });

      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: 'id or slug required' });
    }
  }

  // ── LIST (admin — active only) ────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;
    const { data, error } = await sb()
      .from('articles')
      .select('id, slug, title, title_bn, deck, deck_bn, section, author, author_bn, status, created_at, updated_at, published_at, hero_img_url, content')
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
      .select('id, slug, title, title_bn, section, author, author_bn, status, deleted_at, hero_img_url')
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

    // If there is an active working draft in content, merge it so editor shows working draft
    if (data.content) {
      try {
        const draftObj = JSON.parse(data.content);
        if (draftObj && typeof draftObj === 'object') {
          data._has_draft = true;
          Object.assign(data, draftObj);
        }
      } catch(e) {}
    }

    return res.status(200).json(data);
  }

  // ── SAVE (create, update draft, or publish live) ──────────────────
  if (action === 'save' && req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const {
      id: bodyId, author_id = null, title = '', title_bn = '', deck = '', deck_bn = '', section = '', author = '', author_bn = '', author_role = '', author_role_bn = '',
      author_bio = '', author_bio_bn = '', author_photo_url = '', hero_img_url = '', hero_img_alt = '',
      hero_caption = '', hero_caption_bn = '', hero_credit = '', hero_credit_bn = '', content_html = '', content_html_bn = '', slug: bodySlug,
      seo_title = '', seo_title_bn = '', meta_description = '', meta_description_bn = '', tags = '', tags_bn = '', status: bodyStatus,
      is_draft = false,
    } = req.body || {};

    const client = sb();

    let existing = null;
    if (bodyId) {
      const { data } = await client.from('articles').select('id, status, content').eq('id', bodyId).maybeSingle();
      existing = data;
    }

    if (bodyId && existing) {
      // IF ARTICLE IS PUBLISHED AND ACTION IS "SAVE DRAFT":
      // We ONLY update the working draft in the `content` column without touching the live published article!
      if (existing.status === 'published' && is_draft) {
        const draftPayload = {
          title, title_bn, deck, deck_bn, section, author_id, author, author_bn, author_role, author_role_bn, author_bio, author_bio_bn, author_photo_url,
          hero_img_url, hero_img_alt, hero_caption, hero_caption_bn, hero_credit, hero_credit_bn, content_html, content_html_bn,
          seo_title, seo_title_bn, meta_description, meta_description_bn, tags, tags_bn,
          draft_saved_at: new Date().toISOString()
        };
        const { data, error } = await client.from('articles')
          .update({ content: JSON.stringify(draftPayload) })
          .eq('id', bodyId)
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });

        return res.status(200).json({ ...data, ...draftPayload, _is_working_draft: true });
      }

      // OTHERWISE: DIRECT LIVE PUBLISH OR DRAFT ARTICLE UPDATE
      const updates = {
        title: title || (title_bn ? title_bn : 'Untitled'),
        title_bn, deck, deck_bn, section, author_id, author, author_bn, author_role, author_role_bn, author_bio, author_bio_bn, author_photo_url,
        hero_img_url, hero_img_alt, hero_caption, hero_caption_bn, hero_credit, hero_credit_bn, content_html, content_html_bn,
        seo_title, seo_title_bn, meta_description, meta_description_bn, tags, tags_bn,
        content: null, // Clear working draft because live article is now updated
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

      if (bodyStatus === 'published') {
        try {
          await logActivity({
            actor: session,
            action: 'article.publish',
            category: 'articles',
            summary: `${session.name || session.email} published article "${title || title_bn || data.title || bodyId}"`,
            target_id: bodyId,
            target_name: title || title_bn || data.title || bodyId,
            details: { status: data.status, section: data.section },
            req
          });
        } catch(e) {}
      }

      return res.status(200).json(data);
    } else {
      // CREATE — custom slug or auto unique slug from title
      const baseTitle = title || title_bn || 'untitled';
      let rawSlug = (bodySlug || '').trim() ? slugify(bodySlug) : slugify(baseTitle);
      if (!rawSlug) rawSlug = 'draft-' + Date.now().toString(36);
      let slug = rawSlug;
      const { data: existingSlugs } = await client.from('articles').select('id, slug').ilike('slug', rawSlug + '%');
      if (existingSlugs && existingSlugs.length > 0) {
        const hasExact = existingSlugs.some(a => a.slug === rawSlug && a.id !== bodyId);
        if (hasExact) {
          const nums = existingSlugs.map(a => { const m = a.slug.match(/-(\d+)$/); return m ? parseInt(m[1]) : 0; });
          slug = rawSlug + '-' + (Math.max(...nums, 0) + 1);
        }
      }
      const newArticle = {
        slug,
        title: title || (title_bn ? title_bn : 'Untitled'),
        title_bn, deck, deck_bn, section, author_id, author, author_bn, author_role, author_role_bn, author_bio, author_bio_bn, author_photo_url,
        hero_img_url, hero_img_alt, hero_caption, hero_caption_bn, hero_credit, hero_credit_bn, content_html, content_html_bn,
        seo_title, seo_title_bn, meta_description, meta_description_bn, tags, tags_bn,
        status: bodyStatus || 'draft',
        created_by: session.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (bodyId) newArticle.id = bodyId;
      if (bodyStatus === 'published') newArticle.published_at = new Date().toISOString();
      const { data, error } = await client.from('articles').insert(newArticle).select().single();
      if (error) return res.status(500).json({ error: error.message });

      try {
        await logActivity({
          actor: session,
          action: bodyStatus === 'published' ? 'article.publish' : 'article.create',
          category: 'articles',
          summary: `${session.name || session.email} created new article "${data.title || 'Untitled'}" (${data.status})`,
          target_id: data.id,
          target_name: data.title || 'Untitled',
          details: { status: data.status, section: data.section },
          req
        });
      } catch(e) {}

      return res.status(201).json(data);
    }
  }

  // ── PUBLISH ──────────────────────────────────────────────────────
  if (action === 'publish' && req.method === 'POST') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const client = sb();
    const { data: existing } = await client.from('articles').select('*').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // If there is a working draft in content, apply it to the live columns
    let liveUpdates = {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      content: null, // Clear working draft
    };
    if (existing.content) {
      try {
        const draftObj = JSON.parse(existing.content);
        if (draftObj && typeof draftObj === 'object') {
          Object.assign(liveUpdates, draftObj);
          delete liveUpdates.draft_saved_at;
        }
      } catch(e) {}
    }

    const { data, error } = await client.from('articles').update(liveUpdates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      await logActivity({
        actor: session,
        action: 'article.publish',
        category: 'articles',
        summary: `${session.name || session.email} published article "${data.title || existing.title || id}"`,
        target_id: id,
        target_name: data.title || existing.title || id,
        details: { status: 'published' },
        req
      });
    } catch(e) {}

    return res.status(200).json(data);
  }

  // ── UNPUBLISH ────────────────────────────────────────────────────
  if (action === 'unpublish' && req.method === 'POST') {
    const session = await requireAdmin(req, res);
    if (!session) return;
    if (!id) return res.status(400).json({ error: 'id required' });
    const client = sb();
    const { data, error } = await client.from('articles').update({
      status: 'draft',
      published_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      await logActivity({
        actor: session,
        action: 'article.unpublish',
        category: 'articles',
        summary: `${session.name || session.email} unpublished article "${data.title || id}" to draft`,
        target_id: id,
        target_name: data.title || id,
        details: { status: 'draft' },
        req
      });
    } catch(e) {}

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

      try {
        await logActivity({
          actor: session,
          action: 'article.delete_permanent',
          category: 'articles',
          summary: `${session.name || session.email} permanently deleted article ID "${id}"`,
          target_id: id,
          target_name: id,
          details: { permanent: true },
          req
        });
      } catch(e) {}

      return res.status(200).json({ success: true, permanent: true });
    }
    // Soft delete — move to trash (allowed for authenticated staff)
    const session = await requireAuth(req, res);
    if (!session) return;
    const { error } = await sb().from('articles')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    try {
      await logActivity({
        actor: session,
        action: 'article.move_to_trash',
        category: 'articles',
        summary: `${session.name || session.email} moved article ID "${id}" to trash`,
        target_id: id,
        target_name: id,
        details: { is_deleted: true },
        req
      });
    } catch(e) {}

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
