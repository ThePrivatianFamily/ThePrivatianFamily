/* ═══════════════════════════════════════════════════════════
   THE PRIVATIAN FAMILY — Supabase Configuration
   Central database connection for all pages
═══════════════════════════════════════════════════════════ */

const PRIVATIAN_SUPABASE_URL = 'https://aenhajqjsgskimfzvlfr.supabase.co';
const PRIVATIAN_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';

// Initialize Supabase client
function initSupabaseClient() {
  if (window.supabase && window.supabase.createClient) {
    window._sb = window.supabase.createClient(PRIVATIAN_SUPABASE_URL, PRIVATIAN_SUPABASE_KEY);
    return window._sb;
  }
  return null;
}

// ── SECTIONS ─────────────────────────────────────────────────

async function db_getSections() {
  const sb = window._sb;
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.warn('[Supabase] getSections failed:', e.message);
    return null;
  }
}

async function db_saveSections(allSections) {
  const sb = window._sb;
  if (!sb) return false;
  try {
    // Step 1: Delete all non-locked sections
    const { error: delErr } = await sb.from('sections').delete().eq('locked', false);
    if (delErr) throw delErr;

    // Step 2: Re-insert all sections with current state
    const rows = allSections
      .filter(function(s) { return s.id && s.id !== 'all' && !s.locked; })
      .map(function(s, i) {
        return {
          name:          s.name,
          name_bn:       s.name_bn || '',
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

async function db_getArticles(sectionSlug, limit) {
  const sb = window._sb;
  if (!sb) return null;
  try {
    let query = sb.from('articles')
      .select('*')
      .order('published_at', { ascending: false });
    if (sectionSlug) query = query.eq('section_slug', sectionSlug);
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.warn('[Supabase] getArticles failed:', e.message);
    return null;
  }
}

async function db_saveArticle(article) {
  const sb = window._sb;
  if (!sb) return false;
  try {
    const row = {
      title: article.title,
      slug: article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      excerpt: article.excerpt || '',
      content: article.content || '',
      section_slug: article.section_slug || article.sectionId || '',
      author: article.author || 'The Privatian Family',
      featured_image: article.featured_image || article.image || '',
      is_featured: article.is_featured || false,
      published_at: article.published_at || new Date().toISOString()
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
  const sb = window._sb;
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
  if (window.supabase && window.supabase.createClient) {
    initSupabaseClient();
  }
});

// ── ADMIN SECTIONS SYNC (cross-browser real-time) ────────────────

function _sectionToRow(s, order) {
  return {
    name:          s.name,
    name_bn:       s.name_bn || '',
    slug:          s.slug || s.id,
    display_order: order || 0,
    is_active:     !s.deleted && !s.locked,
    locked:        s.locked  || false,
    is_deleted:    s.deleted || false,
    deleted_at:    s.deleted ? (s.deletedAt || new Date().toISOString()) : null,
    admin_id:      s.id
  };
}

function _rowToSection(row) {
  return {
    id:        row.admin_id || row.slug,
    name:      row.name,
    name_bn:   row.name_bn || '',
    slug:      row.slug || '',
    locked:    row.locked     || false,
    deleted:   row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at || new Date().toISOString()
  };
}

async function db_getAllAdminSections() {
  const sb = window._sb;
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('sections')
      .select('*')
      .order('display_order');
    if (error) throw error;
    return (data || []).map(_rowToSection);
  } catch(e) {
    console.warn('[Supabase] getAllAdminSections failed:', e.message);
    return null;
  }
}

async function db_syncSection(s, order) {
  // Sync handled by Apply Changes; no-op for individual operations
  return true;
}

async function db_syncAllAdminSections(sections) {
  const sb = window._sb;
  if (!sb) return false;
  try {
    for (let i = 0; i < sections.length; i++) {
      await db_syncSection(sections[i], i);
    }
    return true;
  } catch(e) {
    console.warn('[Supabase] syncAllAdminSections failed:', e.message);
    return false;
  }
}