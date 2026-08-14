/* ═══════════════════════════════════════════════════════════
   THE PRIVATIAN FAMILY — Supabase & Data Layer Configuration
   Central database connection & API helper for all pages
═══════════════════════════════════════════════════════════ */

const PRIVATIAN_SUPABASE_URL = 'https://aenhajqjsgskimfzvlfr.supabase.co';
const PRIVATIAN_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';

// Initialize Supabase client
function initSupabaseClient() {
  if (window.supabase && window.supabase.createClient) {
    try {
      window._sb = window.supabase.createClient(PRIVATIAN_SUPABASE_URL, PRIVATIAN_SUPABASE_KEY);
      return window._sb;
    } catch(e) {
      console.warn('[Supabase] Client init failed:', e.message);
    }
  }
  return null;
}

// ── SECTIONS ─────────────────────────────────────────────────

async function db_getSections() {
  // Try API first
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/sections?status=active');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      }
    } catch(e) {}
  }

  // Fallback to Supabase direct
  const sb = window._sb || initSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('sections')
        .select('*')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('display_order');
      if (!error && data) return data;
    } catch(e) {
      console.warn('[Supabase] getSections direct failed:', e.message);
    }
  }
  return null;
}

async function db_saveSections(allSections) {
  const sb = window._sb || initSupabaseClient();
  if (!sb) return false;
  try {
    const { error: delErr } = await sb.from('sections').delete().eq('locked', false);
    if (delErr) throw delErr;

    const rows = allSections
      .filter(function(s) { return s.id && s.id !== 'all' && !s.locked; })
      .map(function(s, i) {
        return {
          name:          s.name,
          slug:          s.slug || s.id,
          display_order: i + 1,
          is_active:     !s.deleted,
          locked:        false,
          is_deleted:    s.deleted  || false,
          deleted_at:    s.deleted ? (s.deletedAt || new Date().toISOString()) : null,
          admin_id:      s.id
        };
      });

    if (rows.length > 0) {
      const { error: insErr } = await sb.from('sections').insert(rows);
      if (insErr) throw insErr;
    }
    return true;
  } catch(e) {
    console.warn('[Supabase] saveSections failed:', e.message);
    return false;
  }
}

// ── ARTICLES ─────────────────────────────────────────────────

async function db_getArticles(sectionFilter, limit) {
  // 1. Try API first (works seamlessly on live site & local server)
  if (window.location.protocol !== 'file:') {
    try {
      let url = '/api/articles?action=list&status=published';
      if (sectionFilter) url += '&section=' + encodeURIComponent(sectionFilter);
      if (limit) url += '&limit=' + encodeURIComponent(limit);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch(e) {}
  }

  // 2. Fallback to Supabase direct client if available
  const sb = window._sb || initSupabaseClient();
  if (sb) {
    try {
      let query = sb.from('articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (sectionFilter) {
        query = query.or(`section.ilike.%${sectionFilter}%,slug.ilike.%${sectionFilter}%`);
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (!error && data) return data;
    } catch(e) {
      console.warn('[Supabase] getArticles direct fallback failed:', e.message);
    }
  }
  return null;
}

async function db_getArticle(idOrSlug) {
  if (!idOrSlug) return null;

  // 1. Try API first
  if (window.location.protocol !== 'file:') {
    try {
      const isId = /^[0-9a-f-]{36}$/i.test(idOrSlug) || !isNaN(idOrSlug);
      const param = isId ? 'id=' + encodeURIComponent(idOrSlug) : 'slug=' + encodeURIComponent(idOrSlug);
      const res = await fetch('/api/articles?action=get&' + param);
      if (res.ok) {
        return await res.json();
      }
    } catch(e) {}
  }

  // 2. Fallback to Supabase direct client
  const sb = window._sb || initSupabaseClient();
  if (sb) {
    try {
      let query = sb.from('articles').select('*');
      if (/^[0-9a-f-]{36}$/i.test(idOrSlug)) {
        query = query.eq('id', idOrSlug);
      } else {
        query = query.eq('slug', idOrSlug);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
    } catch(e) {
      console.warn('[Supabase] getArticle direct failed:', e.message);
    }
  }
  return null;
}

async function db_saveArticle(article) {
  const sb = window._sb || initSupabaseClient();
  if (!sb) return false;
  try {
    const row = {
      title:        article.title,
      slug:         article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      deck:         article.deck || article.excerpt || '',
      content_html: article.content_html || article.content || '',
      section:      article.section || article.section_slug || '',
      author:       article.author || 'The Privatian Family',
      author_role:  article.author_role || '',
      author_bio:   article.author_bio || '',
      hero_img_url: article.hero_img_url || article.featured_image || article.image || '',
      hero_caption: article.hero_caption || '',
      hero_credit:  article.hero_credit || '',
      status:       article.status || 'draft',
      published_at: article.published_at || (article.status === 'published' ? new Date().toISOString() : null),
      updated_at:   new Date().toISOString()
    };
    const { error } = article.id
      ? await sb.from('articles').update(row).eq('id', article.id)
      : await sb.from('articles').insert(row);
    if (error) throw error;
    return true;
  } catch(e) {
    console.warn('[Supabase] saveArticle failed:', e.message);
    return false;
  }
}

async function db_deleteArticle(id) {
  const sb = window._sb || initSupabaseClient();
  if (!sb) return false;
  try {
    const { error } = await sb.from('articles').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch(e) {
    console.warn('[Supabase] deleteArticle failed:', e.message);
    return false;
  }
}

// Auto-init when script loads
document.addEventListener('DOMContentLoaded', function() {
  initSupabaseClient();
});