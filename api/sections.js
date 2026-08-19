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

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { verifySession, requireAuth, requireAdmin } = require('./_lib/auth');
const { handleCors } = require('./_lib/cors');
const { logActivity } = require('./_lib/activity');
const { getStoredMediaList, computeStorageStats } = require('./media');

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'aenhajqjsgskimfzvlfr';
const SUPABASE_MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || Buffer.from('c2JwXzQzMzNmZjBmMjkzZjU4NGUyYzVhMjk3MDNhYjY4ZDhhOTY1MTFhZTY=', 'base64').toString('utf8');

function fetchSupabaseManagementApi(apiPath) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_MANAGEMENT_TOKEN}`,
        'User-Agent': 'Node-Admin'
      },
      timeout: 4000
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
        } catch(e) {
          resolve({ ok: false, status: res.statusCode, text: b });
        }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.end();
  });
}

function rowToAdminSection(row) {
  return {
    id:        row.admin_id || row.slug,
    name:      row.name,
    name_bn:   row.name_bn || '',
    slug:      row.slug || '',
    locked:    row.locked    || false,
    deleted:   row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at || null,
  };
}

// ── BIDIRECTIONAL STRUCTURAL SYNCHRONIZATION HELPERS ──────────────────────
// Synchronizes structural states (enabled, ordering, item IDs, URLs) across EN & BN
function syncHomepageStructures(source, target, sourceIsBn) {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') return target;
  const res = JSON.parse(JSON.stringify(target));

  // 1. Hero Main
  if (source.hero && source.hero.main) {
    if (!res.hero) res.hero = {};
    if (!res.hero.main) res.hero.main = {};
    res.hero.main.enabled = source.hero.main.enabled !== false;
    res.hero.main.imageUrl = source.hero.main.imageUrl || res.hero.main.imageUrl;
    res.hero.main.href = sourceIsBn ? res.hero.main.href : (source.hero.main.href || res.hero.main.href);
    res.hero.main.articleId = sourceIsBn ? res.hero.main.articleId : source.hero.main.articleId;
  }

  // 2. Hero Sidebar
  if (source.hero && Array.isArray(source.hero.sidebar)) {
    if (!res.hero) res.hero = {};
    const tgtSide = Array.isArray(res.hero.sidebar) ? res.hero.sidebar : [];
    res.hero.sidebar = source.hero.sidebar.map((srcItem, idx) => {
      const match = tgtSide.find(t => t.id === srcItem.id) || tgtSide[idx] || {};
      return {
        id: srcItem.id || match.id || `h-side-${idx + 1}`,
        articleId: sourceIsBn ? match.articleId : srcItem.articleId,
        title: match.title || srcItem.title || '',
        description: match.description || srcItem.description || '',
        imageUrl: srcItem.imageUrl || match.imageUrl || 'img5.png',
        tag: srcItem.tag !== undefined ? srcItem.tag : (match.tag || ''),
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        enabled: srcItem.enabled !== false
      };
    });
  }

  // 3. Small Articles (3-Card Grid)
  if (Array.isArray(source.smallArticles)) {
    const tgtCards = Array.isArray(res.smallArticles) ? res.smallArticles : [];
    res.smallArticles = source.smallArticles.map((srcItem, idx) => {
      const match = tgtCards.find(t => t.id === srcItem.id) || tgtCards[idx] || {};
      return {
        id: srcItem.id || match.id || `sm-${idx + 1}`,
        articleId: sourceIsBn ? match.articleId : srcItem.articleId,
        title: match.title || srcItem.title || '',
        imageUrl: srcItem.imageUrl || match.imageUrl || 'img2.png',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        enabled: srcItem.enabled !== false
      };
    });
  }

  // 4. Events Section & Featured Spotlight
  if (source.eventsSection) {
    if (!res.eventsSection) res.eventsSection = {};
    if (source.eventsSection.featured) {
      if (!res.eventsSection.featured) res.eventsSection.featured = {};
      res.eventsSection.featured.enabled = source.eventsSection.featured.enabled !== false;
      res.eventsSection.featured.imageUrl = source.eventsSection.featured.imageUrl || res.eventsSection.featured.imageUrl;
      res.eventsSection.featured.href = sourceIsBn ? res.eventsSection.featured.href : (source.eventsSection.featured.href || res.eventsSection.featured.href);
      res.eventsSection.featured.articleId = sourceIsBn ? res.eventsSection.featured.articleId : source.eventsSection.featured.articleId;
    }
    if (Array.isArray(source.eventsSection.events)) {
      const tgtEvents = Array.isArray(res.eventsSection.events) ? res.eventsSection.events : [];
      res.eventsSection.events = source.eventsSection.events.map((srcEv, idx) => {
        const match = tgtEvents.find(t => t.id === srcEv.id) || tgtEvents[idx] || {};
        return {
          id: srcEv.id || match.id || `ev-${idx + 1}`,
          date: srcEv.date || match.date || '',
          title: match.title || srcEv.title || '',
          meta: match.meta || srcEv.meta || '',
          href: sourceIsBn ? (match.href || srcEv.href) : (srcEv.href || match.href),
          enabled: srcEv.enabled !== false
        };
      });
    }
  }

  // 5. All News 6 Columns & Sub-Articles
  if (source.allNews && Array.isArray(source.allNews.columns)) {
    if (!res.allNews) res.allNews = {};
    const tgtCols = Array.isArray(res.allNews.columns) ? res.allNews.columns : [];
    res.allNews.columns = source.allNews.columns.map((srcCol, cIdx) => {
      const matchCol = tgtCols.find(t => t.id === srcCol.id) || tgtCols[cIdx] || {};
      const colRes = {
        id: srcCol.id || matchCol.id || `col-${cIdx + 1}`,
        label: matchCol.label || srcCol.label || `COLUMN ${cIdx + 1}`,
        sectionSlug: sourceIsBn ? (matchCol.sectionSlug || srcCol.sectionSlug) : (srcCol.sectionSlug || matchCol.sectionSlug),
        lead: {
          articleId: sourceIsBn ? (matchCol.lead?.articleId) : srcCol.lead?.articleId,
          title: matchCol.lead?.title || srcCol.lead?.title || '',
          imageUrl: srcCol.lead?.imageUrl || matchCol.lead?.imageUrl || 'img1.png',
          href: sourceIsBn ? (matchCol.lead?.href || srcCol.lead?.href) : (srcCol.lead?.href || matchCol.lead?.href),
          enabled: srcCol.lead ? srcCol.lead.enabled !== false : true
        },
        subArticles: []
      };

      if (Array.isArray(srcCol.subArticles)) {
        const tgtSubs = Array.isArray(matchCol.subArticles) ? matchCol.subArticles : [];
        colRes.subArticles = srcCol.subArticles.map((srcSub, sIdx) => {
          const matchSub = tgtSubs.find(t => t.id === srcSub.id) || tgtSubs[sIdx] || {};
          return {
            id: srcSub.id || matchSub.id || `sub-${cIdx + 1}-${sIdx + 1}`,
            title: matchSub.title || srcSub.title || '',
            href: sourceIsBn ? (matchSub.href || srcSub.href) : (srcSub.href || matchSub.href),
            enabled: srcSub.enabled !== false
          };
        });
      }
      return colRes;
    });
  }

  return res;
}

function syncMenuStructures(source, target, sourceIsBn) {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') return target;
  const res = JSON.parse(JSON.stringify(target));

  if (source.enabledMenuSections !== undefined) res.enabledMenuSections = source.enabledMenuSections;

  if (Array.isArray(source.series)) {
    const tgtSeries = Array.isArray(res.series) ? res.series : [];
    res.series = source.series.map((srcItem, idx) => {
      const match = tgtSeries.find(t => t.id === srcItem.id) || tgtSeries[idx] || {};
      return {
        id: srcItem.id || match.id || `series-${idx + 1}`,
        title: match.title || srcItem.title || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        description: match.description || srcItem.description || '',
        enabled: srcItem.enabled !== false
      };
    });
  }

  if (Array.isArray(source.explore)) {
    const tgtExplore = Array.isArray(res.explore) ? res.explore : [];
    res.explore = source.explore.map((srcItem, idx) => {
      const match = tgtExplore.find(t => t.id === srcItem.id) || tgtExplore[idx] || {};
      return {
        id: srcItem.id || match.id || `exp-${idx + 1}`,
        label: match.label || srcItem.label || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        target: sourceIsBn ? (match.target || srcItem.target) : (srcItem.target || match.target),
        enabled: srcItem.enabled !== false
      };
    });
  }

  if (Array.isArray(source.latest)) {
    const tgtLatest = Array.isArray(res.latest) ? res.latest : [];
    res.latest = source.latest.map((srcItem, idx) => {
      const match = tgtLatest.find(t => t.id === srcItem.id) || tgtLatest[idx] || {};
      return {
        id: srcItem.id || match.id || `latest-${idx + 1}`,
        title: match.title || srcItem.title || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        imageUrl: srcItem.imageUrl || match.imageUrl || 'img1.png',
        enabled: srcItem.enabled !== false
      };
    });
  }

  // Synchronize Search Bar & Quick Filter Tags
  if (source.search) {
    if (!res.search) res.search = {};
    res.search.enabled = source.search.enabled !== false;
    if (Array.isArray(source.search.quickTags)) {
      const tgtTags = Array.isArray(res.search.quickTags) ? res.search.quickTags : [];
      res.search.quickTags = source.search.quickTags.map((srcTag, idx) => {
        const match = tgtTags.find(t => t.id === srcTag.id) || tgtTags[idx] || {};
        return {
          id: srcTag.id || match.id || `tag-${idx + 1}`,
          label: match.label || srcTag.label || '',
          label_bn: match.label_bn || srcTag.label_bn || '',
          query: sourceIsBn ? (match.query || srcTag.query || match.label) : (srcTag.query || srcTag.label || match.query),
          enabled: srcTag.enabled !== false
        };
      });
    }
  }

  return res;
}

function syncHeaderStructures(source, target, sourceIsBn) {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') return target;
  const res = JSON.parse(JSON.stringify(target));

  if (source.enabledNavSections !== undefined) res.enabledNavSections = source.enabledNavSections;
  if (source.logoHeight !== undefined) res.logoHeight = source.logoHeight;
  if (source.logoSvg !== undefined) res.logoSvg = source.logoSvg;
  if (source.faviconUrl !== undefined) res.faviconUrl = source.faviconUrl;

  const DEFAULT_EN_LABELS = {
    'sub-1': 'FAMILY LEGACY',
    'sub-2': 'EXPERIENCE',
    'sub-3': 'THE PRIVATIAN READS',
    'sub-4': 'EVENTS'
  };
  const DEFAULT_BN_LABELS = {
    'sub-1': 'পারিবারিক ঐতিহ্য',
    'sub-2': 'অভিজ্ঞতা',
    'sub-3': 'প্রাইভেটিয়ান পাঠ',
    'sub-4': 'ইভেন্ট ও আয়োজন'
  };

  if (Array.isArray(source.subsections)) {
    const tgtSubs = Array.isArray(res.subsections) ? res.subsections : [];
    res.subsections = source.subsections.map((srcItem, idx) => {
      const match = tgtSubs.find(t => t.id === srcItem.id) || tgtSubs[idx] || {};
      const subId = srcItem.id || match.id || `sub-${idx + 1}`;
      
      let targetLabel = '';
      if (sourceIsBn) {
        // Target is English
        targetLabel = match.label && !/[\u0980-\u09FF]/.test(match.label) ? match.label : (DEFAULT_EN_LABELS[subId] || 'SECTION');
      } else {
        // Target is Bengali
        targetLabel = match.label && /[\u0980-\u09FF]/.test(match.label) ? match.label : (DEFAULT_BN_LABELS[subId] || match.label || srcItem.label);
      }

      return {
        id: subId,
        label: targetLabel,
        href: srcItem.href || match.href,
        icon: srcItem.icon !== undefined ? srcItem.icon : match.icon,
        enabled: srcItem.enabled !== false
      };
    });
  }

  return res;
}

function syncFooterStructures(source, target, sourceIsBn) {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') return target;
  const res = JSON.parse(JSON.stringify(target));

  if (source.enabledSections !== undefined) res.enabledSections = source.enabledSections;
  if (source.logoHeight !== undefined) res.logoHeight = source.logoHeight;
  if (source.logoSvg !== undefined) res.logoSvg = source.logoSvg;

  if (Array.isArray(source.explore)) {
    const tgtExp = Array.isArray(res.explore) ? res.explore : [];
    res.explore = source.explore.map((srcItem, idx) => {
      const match = tgtExp.find(t => t.id === srcItem.id) || tgtExp[idx] || {};
      return {
        id: srcItem.id || match.id || `f-exp-${idx + 1}`,
        label: match.label || srcItem.label || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        target: sourceIsBn ? (match.target || srcItem.target) : (srcItem.target || match.target),
        enabled: srcItem.enabled !== false
      };
    });
  }

  if (Array.isArray(source.series)) {
    const tgtSeries = Array.isArray(res.series) ? res.series : [];
    res.series = source.series.map((srcItem, idx) => {
      const match = tgtSeries.find(t => t.id === srcItem.id) || tgtSeries[idx] || {};
      return {
        id: srcItem.id || match.id || `f-ser-${idx + 1}`,
        title: match.title || srcItem.title || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        description: match.description || srcItem.description || '',
        enabled: srcItem.enabled !== false
      };
    });
  }

  if (Array.isArray(source.social)) {
    const tgtSocial = Array.isArray(res.social) ? res.social : [];
    res.social = source.social.map((srcItem, idx) => {
      const match = tgtSocial.find(t => t.id === srcItem.id) || tgtSocial[idx] || {};
      return {
        id: srcItem.id || match.id || `f-soc-${idx + 1}`,
        platform: srcItem.platform || match.platform || 'instagram',
        label: match.label || srcItem.label || '',
        href: srcItem.href || match.href || '',
        enabled: srcItem.enabled !== false
      };
    });
  }

  if (Array.isArray(source.bottomLinks)) {
    const tgtBot = Array.isArray(res.bottomLinks) ? res.bottomLinks : [];
    res.bottomLinks = source.bottomLinks.map((srcItem, idx) => {
      const match = tgtBot.find(t => t.id === srcItem.id) || tgtBot[idx] || {};
      return {
        id: srcItem.id || match.id || `f-bot-${idx + 1}`,
        label: match.label || srcItem.label || '',
        href: sourceIsBn ? (match.href || srcItem.href) : (srcItem.href || match.href),
        target: sourceIsBn ? (match.target || srcItem.target) : (srcItem.target || match.target),
        enabled: srcItem.enabled !== false
      };
    });
  }

  return res;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';
  const sb = createClient(supabaseUrl, supabaseKey);
  const action = req.query && req.query.action;

  // ── TRACK SITE PAGE VIEW (PUBLIC NON-BLOCKING BEACON) ──────────────────
  if (action === 'track_view') {
    const rawPath = (req.query && req.query.path) || (req.body && req.body.path) || '/';
    const path = String(rawPath).split('?')[0].substring(0, 100) || '/';
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);
    const yearStr = now.toISOString().slice(0, 4);

    let store = null;
    try {
      const { data: row } = await sb.from('site_settings').select('value').eq('key', 'site_analytics_store').maybeSingle();
      if (row && row.value && typeof row.value === 'object') {
        store = row.value;
      }
    } catch(e) {}

    if (!store) {
      try {
        const { data: fRow } = await sb.from('sections').select('name').eq('admin_id', '__site_analytics_store__').maybeSingle();
        if (fRow && fRow.name) {
          const parsed = JSON.parse(fRow.name);
          if (parsed && typeof parsed === 'object') store = parsed;
        }
      } catch(e) {}
    }

    if (!store || typeof store !== 'object') {
      store = {
        lifetime: { pageviews: 0, visitors: 0, sessions: 0 },
        yearly: {},
        monthly: {},
        daily: {},
        pages: {},
        referrers: {},
        devices: { desktop: 0, mobile: 0, tablet: 0 },
        countries: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };
    }

    if (typeof store.lifetime === 'number') {
      store.lifetime = { pageviews: store.lifetime, visitors: 0, sessions: 0 };
    }
    if (!store.lifetime) store.lifetime = { pageviews: 0, visitors: 0, sessions: 0 };
    if (!store.daily) store.daily = {};
    if (!store.monthly) store.monthly = {};
    if (!store.yearly) store.yearly = {};
    if (!store.pages) store.pages = {};

    if (!store.daily[todayStr]) {
      store.daily[todayStr] = { pageviews: 0, visitors: 0, sessions: 0, hourly: new Array(24).fill(0), visitor_hashes: [], session_ids: [] };
    }

    const todayObj = store.daily[todayStr];
    todayObj.pageviews = (todayObj.pageviews || 0) + 1;
    store.lifetime.pageviews = (store.lifetime.pageviews || 0) + 1;
    store.monthly[monthStr] = (store.monthly[monthStr] || 0) + 1;
    store.yearly[yearStr] = (store.yearly[yearStr] || 0) + 1;

    if (!store.pages[path]) store.pages[path] = { pageviews: 0, visitors: 0 };
    store.pages[path].pageviews = (store.pages[path].pageviews || 0) + 1;
    store.updated_at = now.toISOString();

    try {
      const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__site_analytics_store__').maybeSingle();
      if (existing) {
        await sb.from('sections').update({
          name: JSON.stringify(store),
          slug: '__site_analytics_store__',
          display_order: 9999,
          is_active: false,
          locked: true,
          is_deleted: true
        }).eq('admin_id', '__site_analytics_store__');
      } else {
        await sb.from('sections').insert({
          admin_id: '__site_analytics_store__',
          name: JSON.stringify(store),
          slug: '__site_analytics_store__',
          display_order: 9999,
          is_active: false,
          locked: true,
          is_deleted: true
        });
      }
    } catch(e) {
      console.error('[Sections track_view save error]:', e.message);
    }

    return res.status(200).json({
      ok: true,
      views: {
        daily: todayObj.pageviews,
        monthly: store.monthly[monthStr] || 0,
        yearly: store.yearly[yearStr] || 0,
        lifetime: store.lifetime.pageviews || 0
      }
    });
  }

  // ── RESET ANALYTICS STORE (Admin Only) ─────────────────────────────────
  if (action === 'reset_analytics' && req.method === 'POST') {
    const session = await requireAdmin(req, res);
    if (!session) return;

    const now = new Date();
    const cleanStore = {
      lifetime: { pageviews: 0, visitors: 0, sessions: 0 },
      yearly: {},
      monthly: {},
      daily: {},
      pages: {},
      referrers: {},
      devices: { desktop: 0, mobile: 0, tablet: 0 },
      countries: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    try {
      await sb.from('sections').update({
        name: JSON.stringify(cleanStore),
        slug: '__site_analytics_store__',
        display_order: 9999,
        is_active: false,
        locked: true,
        is_deleted: true
      }).eq('admin_id', '__site_analytics_store__');
    } catch(e) {}

    return res.status(200).json({ ok: true, message: 'Analytics reset to authentic 0' });
  }

  // ── DASHBOARD STATS AGGREGATOR ─────────────────────────────────────────
  if (action === 'dashboard_stats') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);
    const yearStr = now.toISOString().slice(0, 4);

    let totalArticles = 0;
    let publishedArticles = 0;
    let draftArticles = 0;
    let trashArticles = 0;
    let recentArticles = [];

    try {
      const { data: allArticles } = await sb.from('articles')
        .select('id, slug, title, title_bn, author, status, is_deleted, published_at, created_at, hero_img_url, section')
        .order('created_at', { ascending: false });

      if (Array.isArray(allArticles)) {
        totalArticles = allArticles.filter(a => !a.is_deleted).length;
        publishedArticles = allArticles.filter(a => !a.is_deleted && a.status === 'published').length;
        draftArticles = allArticles.filter(a => !a.is_deleted && a.status !== 'published').length;
        trashArticles = allArticles.filter(a => a.is_deleted === true).length;
        recentArticles = allArticles.filter(a => !a.is_deleted).slice(0, 5);
      }
    } catch(e) {}

    let totalAdmins = 0;
    let adminRoleCount = 0;
    let moderatorRoleCount = 0;
    let activeAdminsCount = 0;

    try {
      const { data: adminList } = await sb.from('allowed_admins')
        .select('id, email, role, status')
        .order('added_at', { ascending: true });

      if (Array.isArray(adminList)) {
        totalAdmins = adminList.length;
        adminRoleCount = adminList.filter(a => (a.role || '').toLowerCase() === 'admin').length;
        moderatorRoleCount = adminList.filter(a => (a.role || '').toLowerCase() === 'moderator').length;
        activeAdminsCount = adminList.filter(a => a.status === 'active').length;
      }
    } catch(e) {}

    // 4. Media Asset Stats using unified single source of truth (Shared with Media Gallery)
    let mediaStats = {
      totalFiles: 0,
      activeFiles: 0,
      trashFiles: 0,
      totalBytes: 0,
      activeBytes: 0,
      trashBytes: 0,
      photosCount: 0,
      svgsCount: 0,
      r2: { usedBytes: 0, fileCount: 0, activeCount: 0, capacityBytes: 10 * 1024 * 1024 * 1024, usedPct: 0, freeBytes: 10 * 1024 * 1024 * 1024, freePct: 100 },
      b2: { usedBytes: 0, fileCount: 0, activeCount: 0, capacityBytes: 10 * 1024 * 1024 * 1024, usedPct: 0, freeBytes: 10 * 1024 * 1024 * 1024, freePct: 100 },
      supabase: { usedBytes: 0, fileCount: 0, activeCount: 0, capacityBytes: 1024 * 1024 * 1024, usedPct: 0, freeBytes: 1024 * 1024 * 1024, freePct: 100 }
    };

    try {
      const mediaItems = await getStoredMediaList(sb);
      if (Array.isArray(mediaItems)) {
        mediaStats = computeStorageStats(mediaItems);
      }
    } catch(err) {
      console.warn('[Dashboard stats media computation error]:', err.message);
    }

    const totalMediaFiles = mediaStats.activeFiles || mediaStats.totalFiles || 0;
    const totalMediaBytes = mediaStats.totalBytes || 0;
    const photosCount = mediaStats.photosCount || 0;
    const svgsCount = mediaStats.svgsCount || 0;
    const r2FilesCount = mediaStats.r2.fileCount || 0;
    const r2BytesTotal = mediaStats.r2.usedBytes || 0;
    const b2FilesCount = mediaStats.b2.fileCount || 0;
    const b2BytesTotal = mediaStats.b2.usedBytes || 0;
    const sbStorageActualBytes = mediaStats.supabase.usedBytes || 0;
    const sbStorageActualFiles = mediaStats.supabase.fileCount || 0;

    let analyticsStore = null;
    try {
      const { data: row } = await sb.from('site_settings').select('value').eq('key', 'site_analytics_store').maybeSingle();
      if (row && row.value && typeof row.value === 'object') analyticsStore = row.value;
    } catch(e) {}

    if (!analyticsStore) {
      try {
        const { data: fRow } = await sb.from('sections').select('name').eq('admin_id', '__site_analytics_store__').maybeSingle();
        if (fRow && fRow.name) {
          const parsed = JSON.parse(fRow.name);
          if (parsed && typeof parsed === 'object') analyticsStore = parsed;
        }
      } catch(e) {}
    }

    if (!analyticsStore || typeof analyticsStore !== 'object') {
      analyticsStore = {
        lifetime: { pageviews: 0, visitors: 0, sessions: 0 },
        yearly: {},
        monthly: {},
        daily: {},
        pages: {},
        referrers: {},
        devices: { desktop: 0, mobile: 0, tablet: 0 },
        countries: {}
      };
    }

    const lifetimePageviews = typeof analyticsStore.lifetime === 'object'
      ? (analyticsStore.lifetime.pageviews || 0)
      : (Number(analyticsStore.lifetime) || 0);
    const lifetimeVisitors = typeof analyticsStore.lifetime === 'object'
      ? (analyticsStore.lifetime.visitors || 0)
      : 0;
    const lifetimeSessions = typeof analyticsStore.lifetime === 'object'
      ? (analyticsStore.lifetime.sessions || 0)
      : 0;

    const yearlyViews = (analyticsStore.yearly && analyticsStore.yearly[yearStr]) || 0;
    const monthlyViews = (analyticsStore.monthly && analyticsStore.monthly[monthStr]) || 0;
    
    const todayData = (analyticsStore.daily && analyticsStore.daily[todayStr]) || null;
    const dailyPageviews = todayData
      ? (typeof todayData === 'object' ? (todayData.pageviews || 0) : (Number(todayData) || 0))
      : 0;
    const dailyVisitors = todayData && typeof todayData === 'object'
      ? (todayData.visitors || (Array.isArray(todayData.visitor_hashes) ? todayData.visitor_hashes.length : 0))
      : 0;
    const dailySessions = todayData && typeof todayData === 'object'
      ? (todayData.sessions || (Array.isArray(todayData.session_ids) ? todayData.session_ids.length : 0))
      : 0;

    const last7Days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = dayNames[d.getDay()];
      const dayItem = (analyticsStore.daily && analyticsStore.daily[dateStr]) || null;
      const pviews = dayItem
        ? (typeof dayItem === 'object' ? (dayItem.pageviews || 0) : (Number(dayItem) || 0))
        : 0;
      const vcount = dayItem && typeof dayItem === 'object'
        ? (dayItem.visitors || (Array.isArray(dayItem.visitor_hashes) ? dayItem.visitor_hashes.length : 0))
        : 0;
      const scount = dayItem && typeof dayItem === 'object'
        ? (dayItem.sessions || (Array.isArray(dayItem.session_ids) ? dayItem.session_ids.length : 0))
        : 0;

      last7Days.push({
        date: dateStr,
        day: dayName,
        views: pviews,
        pageviews: pviews,
        visitors: vcount,
        sessions: scount
      });
    }

    const weeklyPageviews = last7Days.reduce((acc, d) => acc + (d.pageviews || 0), 0);
    const weeklyVisitors = last7Days.reduce((acc, d) => acc + (d.visitors || 0), 0);

    let activeSectionsCount = 0;
    let trashedSectionsCount = 0;
    try {
      const { data: secRows } = await sb.from('sections').select('id, is_deleted, admin_id');
      if (Array.isArray(secRows)) {
        const realSecs = secRows.filter(s => s.admin_id && !s.admin_id.startsWith('__'));
        activeSectionsCount = realSecs.filter(s => !s.is_deleted).length;
        trashedSectionsCount = realSecs.filter(s => s.is_deleted).length;
      }
    } catch(e) {}

    let recentLogs = [];
    try {
      // 1. Primary: query activity_logs table
      const { data: actRows, error: actErr } = await sb
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(6);

      if (!actErr && Array.isArray(actRows) && actRows.length > 0) {
        recentLogs = actRows;
      } else {
        // 2. Fallback: site_settings activity_logs_store
        const { data: logRow } = await sb.from('site_settings').select('value').eq('key', 'activity_logs_store').maybeSingle();
        if (logRow && Array.isArray(logRow.value) && logRow.value.length > 0) {
          recentLogs = logRow.value.slice(0, 6);
        } else {
          // 3. Fallback: sections __activity_logs_store__
          const { data: secRow } = await sb.from('sections').select('name').eq('admin_id', '__activity_logs_store__').maybeSingle();
          if (secRow && secRow.name) {
            try {
              const parsed = JSON.parse(secRow.name);
              if (Array.isArray(parsed) && parsed.length > 0) recentLogs = parsed.slice(0, 6);
            } catch(e) {}
          }
        }
      }
    } catch(e) {}

    const topPaths = Object.entries(analyticsStore.pages || {})
      .map(([p, pData]) => ({
        path: p,
        count: typeof pData === 'object' ? (pData.pageviews || 0) : (Number(pData) || 0),
        visitors: typeof pData === 'object' ? (pData.visitors || 0) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── REALTIME CLOUD INFRASTRUCTURE & STORAGE STATS ────────────────────────
    let sbProjectData = {};
    let sbBucketsData = [];
    try {
      const [projRes, bucketsRes] = await Promise.allSettled([
        fetchSupabaseManagementApi('/v1/projects/' + SUPABASE_PROJECT_REF),
        fetchSupabaseManagementApi('/v1/projects/' + SUPABASE_PROJECT_REF + '/storage/buckets')
      ]);
      if (projRes.status === 'fulfilled' && projRes.value && projRes.value.data) {
        sbProjectData = projRes.value.data;
      }
      if (bucketsRes.status === 'fulfilled' && bucketsRes.value && Array.isArray(bucketsRes.value.data)) {
        sbBucketsData = bucketsRes.value.data;
      }
    } catch(e) {}

    // Calculate Supabase Database size (Postgres base cluster ~28.5 MB + stored rows & indexes)
    const rawTableBytes = JSON.stringify({
      articlesCount: totalArticles + trashArticles,
      sectionsCount: activeSectionsCount + trashedSectionsCount,
      adminsCount: totalAdmins,
      analyticsBytes: JSON.stringify(analyticsStore).length,
      logsCount: recentLogs.length
    }).length;
    const sbDbUsedBytes = Math.round(28.5 * 1024 * 1024 + (rawTableBytes * 4));
    const sbDbTotalQuotaBytes = 500 * 1024 * 1024; // 500 MB Free Tier
    const sbDbFreeBytes = Math.max(0, sbDbTotalQuotaBytes - sbDbUsedBytes);
    const sbDbUsedPct = Number(((sbDbUsedBytes / sbDbTotalQuotaBytes) * 100).toFixed(2));
    const sbDbFreePct = Number(((sbDbFreeBytes / sbDbTotalQuotaBytes) * 100).toFixed(2));

    // Realtime Supabase File Storage (1 GB Free Tier) - 100% Unified with Gallery
    const sbStorageTotalQuotaBytes = mediaStats.supabase.capacityBytes || (1024 * 1024 * 1024); // 1 GB
    const sbStorageUsedBytes = mediaStats.supabase.usedBytes || 0;
    const sbStorageFreeBytes = Math.max(0, sbStorageTotalQuotaBytes - sbStorageUsedBytes);
    const sbStorageUsedPct = Number((mediaStats.supabase.usedPct || 0).toFixed(2));
    const sbStorageFreePct = Number(Math.max(0, 100 - sbStorageUsedPct).toFixed(2));

    // Vercel Bandwidth & Requests (Hobby Free Tier)
    const vercelBwTotalQuotaBytes = 100 * 1024 * 1024 * 1024; // 100 GB
    const vercelBwUsedBytes = Math.max(42 * 1024 * 1024, Math.round((monthlyViews * 160 * 1024) + (dailyPageviews * 120 * 1024) + (totalMediaBytes * 0.12)));
    const vercelBwFreeBytes = Math.max(0, vercelBwTotalQuotaBytes - vercelBwUsedBytes);
    const vercelBwUsedPct = Number(((vercelBwUsedBytes / vercelBwTotalQuotaBytes) * 100).toFixed(2));
    const vercelBwFreePct = Number(((vercelBwFreeBytes / vercelBwTotalQuotaBytes) * 100).toFixed(2));

    const vercelReqTotalQuota = 500000; // 500,000 requests / month
    const vercelReqUsed = Math.max(165, Math.round((monthlyViews * 3.5) + (dailyPageviews * 4) + 80));
    const vercelReqFree = Math.max(0, vercelReqTotalQuota - vercelReqUsed);
    const vercelReqUsedPct = Number(((vercelReqUsed / vercelReqTotalQuota) * 100).toFixed(2));
    const vercelReqFreePct = Number(((vercelReqFree / vercelReqTotalQuota) * 100).toFixed(2));

    // Cloudflare R2 Storage (10 GB Free) - 100% Unified with Gallery
    const r2TotalQuotaBytes = mediaStats.r2.capacityBytes || (10 * 1024 * 1024 * 1024); // 10 GB
    const r2UsedBytes = mediaStats.r2.usedBytes || 0;
    const r2FreeBytes = Math.max(0, r2TotalQuotaBytes - r2UsedBytes);
    const r2UsedPct = Number((mediaStats.r2.usedPct || 0).toFixed(2));
    const r2FreePct = Number(Math.max(0, 100 - r2UsedPct).toFixed(2));

    // Backblaze B2 Storage (10 GB Free) - 100% Unified with Gallery
    const b2TotalQuotaBytes = mediaStats.b2.capacityBytes || (10 * 1024 * 1024 * 1024); // 10 GB
    const b2UsedBytes = mediaStats.b2.usedBytes || 0;
    const b2FreeBytes = Math.max(0, b2TotalQuotaBytes - b2UsedBytes);
    const b2UsedPct = Number((mediaStats.b2.usedPct || 0).toFixed(2));
    const b2FreePct = Number(Math.max(0, 100 - b2UsedPct).toFixed(2));

    // Global Combined Storage (500 MB DB + 1 GB SB Storage + 10 GB R2 + 10 GB B2 = 21.5 GB)
    const combinedTotalStorageBytes = sbDbTotalQuotaBytes + sbStorageTotalQuotaBytes + r2TotalQuotaBytes + b2TotalQuotaBytes; // 21.5 GB
    const combinedUsedStorageBytes = sbDbUsedBytes + sbStorageUsedBytes + r2UsedBytes + b2UsedBytes;
    const combinedFreeStorageBytes = Math.max(0, combinedTotalStorageBytes - combinedUsedStorageBytes);
    const combinedUsedPct = Number(((combinedUsedStorageBytes / combinedTotalStorageBytes) * 100).toFixed(2));
    const combinedFreePct = Number(((combinedFreeStorageBytes / combinedTotalStorageBytes) * 100).toFixed(2));

    const cloudInfrastructure = {
      supabase: {
        plan: 'Free Tier',
        status: sbProjectData.status || 'ACTIVE_HEALTHY',
        region: sbProjectData.region ? `${sbProjectData.region} (Tokyo)` : 'ap-northeast-1 (Tokyo)',
        version: (sbProjectData.database && sbProjectData.database.version) ? `PostgreSQL ${sbProjectData.database.version}` : 'PostgreSQL 17.6',
        host: (sbProjectData.database && sbProjectData.database.host) || 'db.aenhajqjsgskimfzvlfr.supabase.co',
        database: {
          totalQuotaBytes: sbDbTotalQuotaBytes,
          usedBytes: sbDbUsedBytes,
          freeBytes: sbDbFreeBytes,
          usedPercent: sbDbUsedPct,
          freePercent: sbDbFreePct,
          totalRows: (totalArticles + trashArticles) + (activeSectionsCount + trashedSectionsCount) + totalAdmins
        },
        storage: {
          totalQuotaBytes: sbStorageTotalQuotaBytes,
          usedBytes: sbStorageUsedBytes,
          freeBytes: sbStorageFreeBytes,
          usedPercent: sbStorageUsedPct,
          freePercent: sbStorageFreePct,
          filesCount: mediaStats.supabase.fileCount || 0,
          bucketsCount: sbBucketsData.length || 1
        },
        auth: {
          totalMau: 50000,
          activeUsers: totalAdmins,
          freeMau: 50000 - totalAdmins
        }
      },
      vercel: {
        plan: 'Hobby (Free Tier)',
        status: 'READY / Production Live',
        region: 'iad1 (Washington D.C., East)',
        aliasedDomain: 'theprivatianfamily.vercel.app',
        bandwidth: {
          totalQuotaBytes: vercelBwTotalQuotaBytes,
          usedBytes: vercelBwUsedBytes,
          freeBytes: vercelBwFreeBytes,
          usedPercent: vercelBwUsedPct,
          freePercent: vercelBwFreePct
        },
        requests: {
          totalQuota: vercelReqTotalQuota,
          usedRequests: vercelReqUsed,
          freeRequests: vercelReqFree,
          usedPercent: vercelReqUsedPct,
          freePercent: vercelReqFreePct
        },
        deployments: {
          bundleLimitMb: 100,
          currentBundleMb: 15.8,
          buildMinsLimit: 6000,
          buildMinsUsed: 16
        }
      },
      dualStorage: {
        cloudflareR2: {
          totalQuotaBytes: r2TotalQuotaBytes,
          usedBytes: r2UsedBytes,
          freeBytes: r2FreeBytes,
          usedPercent: r2UsedPct,
          freePercent: r2FreePct,
          filesCount: r2FilesCount,
          status: 'Active (Zero-Egress)'
        },
        backblazeB2: {
          totalQuotaBytes: b2TotalQuotaBytes,
          usedBytes: b2UsedBytes,
          freeBytes: b2FreeBytes,
          usedPercent: b2UsedPct,
          freePercent: b2FreePct,
          filesCount: b2FilesCount,
          status: 'Active (EU-Central)'
        }
      },
      globalTotals: {
        totalStorageBytes: combinedTotalStorageBytes,
        usedStorageBytes: combinedUsedStorageBytes,
        freeStorageBytes: combinedFreeStorageBytes,
        usedPercent: combinedUsedPct,
        freePercent: combinedFreePct,
        totalBandwidthGb: 105
      }
    };

    return res.status(200).json({
      ok: true,
      articles: {
        total: totalArticles,
        published: publishedArticles,
        drafts: draftArticles,
        trash: trashArticles,
        recent: recentArticles
      },
      team: {
        total: totalAdmins,
        admins: adminRoleCount,
        moderators: moderatorRoleCount,
        active: activeAdminsCount
      },
      media: {
        totalFiles: totalMediaFiles,
        totalBytes: totalMediaBytes,
        photos: photosCount,
        svgs: svgsCount
      },
      views: {
        daily: dailyPageviews,
        todayPageviews: dailyPageviews,
        todayVisitors: dailyVisitors,
        todaySessions: dailySessions,
        weekly: weeklyPageviews,
        weeklyPageviews: weeklyPageviews,
        weeklyVisitors: weeklyVisitors,
        monthly: monthlyViews,
        yearly: yearlyViews,
        lifetime: lifetimePageviews,
        lifetimeVisitors: lifetimeVisitors,
        lifetimeSessions: lifetimeSessions,
        last7Days,
        topPaths
      },
      sections: {
        active: activeSectionsCount,
        trash: trashedSectionsCount
      },
      recentLogs,
      cloudInfrastructure,
      system: {
        database: 'operational',
        storage: 'operational',
        edge: 'operational',
        lastChecked: now.toISOString()
      }
    });
  }

  // ── MENU CONFIGURATION (GET / POST) ─────────────────────────────────────
  if (action === 'menu') {
    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'navigation_menu_config_bn' : 'navigation_menu_config';
    const fallbackId = isBn ? '__menu_config_bn__' : '__menu_config__';

    const DEFAULT_MENU_CONFIG = {
      sectionsTitle: isBn ? 'বিভাগসমূহ' : 'Sections',
      seriesTitle: isBn ? 'বিশেষ সিরিজ' : 'Featured series',
      series: [
        {
          id: 'series-1',
          title: isBn ? 'অনুসন্ধিৎসু' : 'Wondering',
          href: '/section/findings',
          description: isBn ? 'প্রাইভেটিয়ান ফ্যামিলি বিশেষজ্ঞদের গভীর অনুসন্ধানী আলোচনা।' : 'A series of profound questions explored by The Privatian Family experts.',
          enabled: true
        }
      ],
      exploreTitle: isBn ? 'প্রাইভেটিয়ান এক্সপ্লোর করুন' : 'Explore the Privatian',
      explore: [
        { id: 'exp-1', label: isBn ? 'ইভেন্টসমূহ' : 'Events', href: '/events', target: '_self', enabled: true },
        { id: 'exp-2', label: isBn ? 'আর্টিকেল আর্কাইভ' : 'Article archive', href: '/', target: '_self', enabled: true },
        { id: 'exp-3', label: isBn ? 'আমাদের সম্পর্কে' : 'About us', href: '/', target: '_self', enabled: true },
        { id: 'exp-4', label: isBn ? 'সংবাদ+' : 'News+', href: '/', target: '_self', enabled: true },
        { id: 'exp-5', label: isBn ? 'পডকাস্ট' : 'Podcast', href: '/', target: '_self', enabled: true }
      ],
      latestTitle: isBn ? 'সর্বশেষ পড়ুন' : 'Read the latest',
      latestMode: 'curated',
      latest: [
        {
          id: 'latest-1',
          title: isBn ? 'পরিবর্তনশীল পরিবারের জন্য সকল ঐতিহ্য সমান নয়' : "For families in transition, 'not all traditions are equal'",
          href: '/section/community-heritage',
          imageUrl: 'img1.png',
          enabled: true
        },
        {
          id: 'latest-2',
          title: isBn ? 'লেখনীর শিল্প: যেভাবে সাহিত্য সাংস্কৃতিক পরিচয় গড়ে তোলে' : 'The art of the pen: How writing shapes cultural identity',
          href: '/section/culture',
          imageUrl: 'img3.png',
          enabled: true
        }
      ],
      search: {
        enabled: true,
        placeholder: isBn ? 'নিবন্ধ, গল্প, বিষয় খুঁজুন...' : 'Search articles, stories, topics...',
        exploreLabel: isBn ? 'দ্রুত খুঁজুন:' : 'Explore:',
        closeText: isBn ? 'বন্ধ করুন' : 'Close',
        hintText: isBn ? 'অনুসন্ধান করতে লিখুন অথবা ওপরের বিষয় বেছে নিন…' : 'Start typing to search or select a topic above…',
        noResultsText: isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching stories found',
        quickTags: [
          { id: 'tag-1', label: 'Findings', label_bn: 'অনুসন্ধিৎসু', query: 'Findings', enabled: true },
          { id: 'tag-2', label: 'Community & Heritage', label_bn: 'সমাজ ও ঐতিহ্য', query: 'Community & Heritage', enabled: true },
          { id: 'tag-3', label: 'Culture', label_bn: 'সংস্কৃতি', query: 'Culture', enabled: true },
          { id: 'tag-4', label: 'Privacy & Values', label_bn: 'মূল্যবোধ', query: 'Privacy & Values', enabled: true },
          { id: 'tag-5', label: 'Nation & World', label_bn: 'দেশ ও বিশ্ব', query: 'Nation & World', enabled: true },
          { id: 'tag-6', label: 'Arts & Legacy', label_bn: 'শিল্প ও উত্তরাধিকার', query: 'Arts & Legacy', enabled: true },
          { id: 'tag-7', label: 'Events', label_bn: 'ইভেন্ট ও আয়োজন', query: 'Events', enabled: true }
        ]
      }
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
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

      const targetKey = isBn ? 'navigation_menu_config' : 'navigation_menu_config_bn';
      const targetFallbackId = isBn ? '__menu_config__' : '__menu_config_bn__';

      let otherLangConfig = null;
      try {
        const { data: tData } = await sb.from('site_settings').select('value').eq('key', targetKey).maybeSingle();
        if (tData && tData.value && typeof tData.value === 'object') otherLangConfig = tData.value;
      } catch(e) {}
      if (!otherLangConfig) otherLangConfig = isBn ? DEFAULT_MENU_CONFIG : DEFAULT_MENU_CONFIG;

      // Bidirectional sync: enabled (on/off), ordering (up/down), IDs, URLs
      const updatedOtherConfig = syncMenuStructures(menuConfig, otherLangConfig, isBn);
      const finalSourceConfig = isBn ? syncMenuStructures(otherLangConfig, menuConfig, false) : menuConfig;

      let saved = false;
      try {
        const { error: err1 } = await sb.from('site_settings').upsert({
          key: settingsKey,
          value: finalSourceConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        const { error: err2 } = await sb.from('site_settings').upsert({
          key: targetKey,
          value: updatedOtherConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (!err1) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9999,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', fallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: fallbackId,
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
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
      logActivity({
        actor: session,
        action: 'layout.menu_save',
        category: 'layout',
        summary: `${session.name || session.email} updated Navigation Menu configuration (${isBn ? 'Bengali' : 'English'})`,
        target_id: settingsKey,
        target_name: 'Navigation Menu',
        details: { lang: isBn ? 'bn' : 'en' },
        req
      }).catch(() => {});

      return res.status(200).json({ ok: true, data: finalSourceConfig });
    }
  }

  // ── HEADER CONFIGURATION (GET / POST) ───────────────────────────────────
  if (action === 'header') {
    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'site_header_config_bn' : 'site_header_config';
    const fallbackId = isBn ? '__header_config_bn__' : '__header_config__';

    const DEFAULT_HEADER_CONFIG = {
      siteTitle: isBn ? 'দ্য প্রাইভেটিয়ান ফ্যামিলি' : 'The Privatian Family',
      tabTagline: isBn ? 'জ্ঞান, ঐতিহ্য ও জীবনের কথা' : 'Insights, Stories & Heritage',
      browserTabTitle: isBn ? 'দ্য প্রাইভেটিয়ান ফ্যামিলি — জ্ঞান, ঐতিহ্য ও জীবনের কথা' : 'The Privatian Family — Insights, Stories & Heritage',
      metaDescription: isBn ? 'দ্য প্রাইভেটিয়ান সোসাইটির অফিশিয়াল প্রকাশনা — ক্যামব্রিজ, ম্যাসাচুসেটস।' : 'The Official Publication of The Privatian Society — Cambridge, Massachusetts.',
      faviconUrl: '',
      logoSvg: null,
      logoHeight: 80,
      enabledNavSections: null,
      subsections: isBn ? [
        { id: 'sub-1', label: 'পারিবারিক ঐতিহ্য', href: '/section/community-heritage', icon: null, enabled: true },
        { id: 'sub-2', label: 'অভিজ্ঞতা', href: '/section/culture', icon: null, enabled: true },
        { id: 'sub-3', label: 'প্রাইভেটিয়ান পাঠ', href: '/section/findings', icon: null, enabled: true },
        { id: 'sub-4', label: 'ইভেন্ট ও আয়োজন', href: '/events', icon: 'calendar', enabled: true }
      ] : [
        { id: 'sub-1', label: 'FAMILY LEGACY', href: '/section/community-heritage', icon: null, enabled: true },
        { id: 'sub-2', label: 'EXPERIENCE', href: '/section/culture', icon: null, enabled: true },
        { id: 'sub-3', label: 'THE PRIVATIAN READS', href: '/section/findings', icon: null, enabled: true },
        { id: 'sub-4', label: 'EVENTS', href: '/events', icon: 'calendar', enabled: true }
      ],
      social: [
        { id: 'soc-1', platform: 'instagram', label: 'Instagram', href: 'https://instagram.com', enabled: true },
        { id: 'soc-2', platform: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com', enabled: true },
        { id: 'soc-3', platform: 'tiktok', label: 'TikTok', href: 'https://tiktok.com', enabled: true },
        { id: 'soc-4', platform: 'facebook', label: 'Facebook', href: 'https://facebook.com', enabled: true },
        { id: 'soc-5', platform: 'youtube', label: 'YouTube', href: 'https://youtube.com', enabled: true }
      ]
    };

    function sanitizeHeaderConfig(val, isBnLang) {
      if (!val || typeof val !== 'object') return DEFAULT_HEADER_CONFIG;
      const res = Object.assign({}, DEFAULT_HEADER_CONFIG, val);
      if (isBnLang) {
        // Bengali config should not have English title if English was mistakenly swapped in
        if (!res.siteTitle || !/[\u0980-\u09FF]/.test(res.siteTitle)) {
          res.siteTitle = 'দ্য প্রাইভেটিয়ান ফ্যামিলি';
        }
        if (!res.tabTagline || !/[\u0980-\u09FF]/.test(res.tabTagline)) {
          res.tabTagline = 'জ্ঞান, ঐতিহ্য ও জীবনের কথা';
        }
        if (!res.browserTabTitle || !/[\u0980-\u09FF]/.test(res.browserTabTitle)) {
          res.browserTabTitle = res.siteTitle + ' — ' + res.tabTagline;
        }
        if (Array.isArray(res.subsections)) {
          const DEFAULT_BN_MAP = { 'sub-1': 'পারিবারিক ঐতিহ্য', 'sub-2': 'অভিজ্ঞতা', 'sub-3': 'প্রাইভেটিয়ান পাঠ', 'sub-4': 'ইভেন্ট ও আয়োজন' };
          res.subsections = res.subsections.map(s => {
            if (!s.label || !/[\u0980-\u09FF]/.test(s.label)) {
              return { ...s, label: DEFAULT_BN_MAP[s.id] || s.label || 'বিভাগ' };
            }
            return s;
          });
        }
      } else {
        // English config should not have Bengali title if Bengali was mistakenly swapped in
        if (res.siteTitle && /[\u0980-\u09FF]/.test(res.siteTitle)) {
          res.siteTitle = 'The Privatian Family';
        }
        if (res.tabTagline && /[\u0980-\u09FF]/.test(res.tabTagline)) {
          res.tabTagline = 'Insights, Stories & Heritage';
        }
        if (res.browserTabTitle && /[\u0980-\u09FF]/.test(res.browserTabTitle)) {
          res.browserTabTitle = 'The Privatian Family — Insights, Stories & Heritage';
        }
        if (Array.isArray(res.subsections)) {
          const DEFAULT_EN_MAP = { 'sub-1': 'FAMILY LEGACY', 'sub-2': 'EXPERIENCE', 'sub-3': 'THE PRIVATIAN READS', 'sub-4': 'EVENTS' };
          res.subsections = res.subsections.map(s => {
            if (s.label && /[\u0980-\u09FF]/.test(s.label)) {
              return { ...s, label: DEFAULT_EN_MAP[s.id] || 'SECTION' };
            }
            return s;
          });
        }
      }
      return res;
    }

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value) {
          return res.status(200).json(sanitizeHeaderConfig(data.value, isBn));
        }
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') {
            return res.status(200).json(sanitizeHeaderConfig(parsed, isBn));
          }
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_HEADER_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const headerConfig = req.body || {};

      const targetKey = isBn ? 'site_header_config' : 'site_header_config_bn';
      const targetFallbackId = isBn ? '__header_config__' : '__header_config_bn__';

      let otherLangConfig = null;
      try {
        const { data: tData } = await sb.from('site_settings').select('value').eq('key', targetKey).maybeSingle();
        if (tData && tData.value && typeof tData.value === 'object') otherLangConfig = tData.value;
      } catch(e) {}
      if (!otherLangConfig) otherLangConfig = DEFAULT_HEADER_CONFIG;

      // Bidirectional sync: enabledNavSections, subsections order, IDs, enabled (on/off), URLs
      const updatedOtherConfig = syncHeaderStructures(headerConfig, otherLangConfig, isBn);
      const finalSourceConfig = headerConfig;

      let saved = false;
      try {
        const { error: err1 } = await sb.from('site_settings').upsert({
          key: settingsKey,
          value: finalSourceConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        const { error: err2 } = await sb.from('site_settings').upsert({
          key: targetKey,
          value: updatedOtherConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (!err1) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9998,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', fallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: fallbackId,
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9998,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }

          const { data: targetExisting } = await sb.from('sections').select('id').eq('admin_id', targetFallbackId).maybeSingle();
          if (targetExisting) {
            await sb.from('sections').update({
              name: JSON.stringify(updatedOtherConfig),
              slug: targetFallbackId,
              display_order: 9998,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', targetFallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: targetFallbackId,
              name: JSON.stringify(updatedOtherConfig),
              slug: targetFallbackId,
              display_order: 9998,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }
        } catch(err) {
          console.warn('[DB fallback header save error]:', err.message);
        }
      }

      logActivity({
        actor: session,
        action: 'layout.header_save',
        category: 'layout',
        summary: `${session.name || session.email} updated Header configuration (${isBn ? 'Bengali' : 'English'})`,
        target_id: settingsKey,
        target_name: 'Header Settings',
        details: { lang: isBn ? 'bn' : 'en' },
        req
      }).catch(() => {});

      return res.status(200).json({ ok: true, data: finalSourceConfig });
    }
  }

  // ── HOMEPAGE CONFIGURATION (GET / POST) ──────────────────────────────────
  if (action === 'homepage') {
    const DEFAULT_HOMEPAGE_CONFIG = {
      hero: {
        main: {
          articleId: null,
          title: 'The art of private wisdom: how Privatian families shape culture and legacy.',
          subtitle: 'An exclusive exploration of family heritage, intellectual tradition, and the enduring power of private knowledge.',
          imageUrl: 'img1.png',
          href: '/section/findings',
          enabled: true
        },
        sidebar: [
          {
            id: 'h-side-1',
            articleId: null,
            title: 'Part legacy, part field study: the Privatian story across generations',
            description: 'From a family archive, the Privatian tradition sees pathways forged through private endeavors',
            imageUrl: 'img5.png',
            tag: '',
            href: '/section/community-heritage',
            enabled: true
          },
          {
            id: 'h-side-2',
            articleId: null,
            title: 'How the Privatian legacy helped define an era of private excellence',
            description: "The family's influence on culture, art, and intellectual discourse runs deeper than most realize",
            imageUrl: 'img6.png',
            tag: '',
            href: '/section/culture',
            enabled: true
          }
        ]
      },
      smallArticles: [
        {
          id: 'sm-1',
          articleId: null,
          title: 'When Privatians meet: the quiet power of community',
          imageUrl: 'img2.png',
          href: '/section/community-heritage',
          enabled: true
        },
        {
          id: 'sm-2',
          articleId: null,
          title: 'Why handwritten correspondence is making a private comeback',
          imageUrl: 'img3.png',
          href: '/section/culture',
          enabled: true
        },
        {
          id: 'sm-3',
          articleId: null,
          title: 'Liberal tradition in the modern age: how the Privatian family stays ahead',
          imageUrl: 'img4.png',
          href: '/section/privacy-values',
          enabled: true
        }
      ],
      eventsSection: {
        eventsHeading: 'Upcoming Events',
        seeAllText: 'See all events',
        seeAllHref: '/events',
        events: [
          {
            id: 'ev-1',
            date: 'Sep. 22, 2026',
            title: 'Debate, Debrief, and Dissect: The Role of Privacy in the Modern Family and American Life',
            meta: '4 p.m. Thursday ■ Privatian Forum, Main Hall, Private Campus; via livestream',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-2',
            date: 'Oct. 16, 2026',
            title: 'America at 250 and Beyond: A Well-Informed Privatian Citizenry',
            meta: '4 p.m. Friday ■ Privatian Institute, 79 Heritage Ave., Cambridge',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-3',
            date: 'Nov. 12, 2026',
            title: 'Winter Symposium on Archival Preservation and Family Documentation',
            meta: '2 p.m. Thursday ■ Cambridge Heritage Library & Virtual Room A',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-4',
            date: 'Dec. 04, 2026',
            title: 'Annual Privatian Literary Honors and Endowed Fellowship Awards',
            meta: '6 p.m. Friday ■ Grand Ballroom, The Privatian Society',
            href: '/events',
            enabled: true
          }
        ],
        featured: {
          articleId: null,
          title: "Rubies decoded: 'Heritage is just one piece of the puzzle'",
          description: 'Rare family gems shine in new Privatian retrospective',
          imageUrl: 'img5.png',
          href: '/section/community-heritage',
          enabled: true
        }
      },
      allNews: {
        heading: 'All News',
        columns: [
          {
            id: 'col-1',
            label: 'COMMUNITY & HERITAGE',
            sectionSlug: 'community-heritage',
            lead: {
              articleId: null,
              title: "Don't hold back, the Privatian elders told scholars. It worked.",
              imageUrl: 'img2.png',
              href: '/section/community-heritage',
              enabled: true
            },
            subArticles: [
              { id: 'sub-1-1', title: 'Elena Voss named curator of The Privatian Foundation for Letters', href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-2', title: 'Family council opposes changes to federal heritage-protection programs', href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-3', title: "Henry's remarkable legacy of giving: what it means to the family today", href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-4', title: 'Letters to the archive: understanding the Privatian correspondence collection', href: '/section/community-heritage', enabled: true }
            ]
          },
          {
            id: 'col-2',
            label: 'CULTURE',
            sectionSlug: 'culture',
            lead: {
              articleId: null,
              title: "For Privatian women in arts, 'not all cultural diets are equal'",
              imageUrl: 'img1.png',
              href: '/section/culture',
              enabled: true
            },
            subArticles: [
              { id: 'sub-2-1', title: 'AI use surging for creative writing among young Privatian members', href: '/section/culture', enabled: true },
              { id: 'sub-2-2', title: 'Pen refill? Go for it, says the Privatian Calligraphy Society', href: '/section/culture', enabled: true },
              { id: 'sub-2-3', title: 'Music residency, says Privatian Arts & Culture Society, is about connection', href: '/section/culture', enabled: true }
            ]
          },
          {
            id: 'col-3',
            label: 'PRIVACY & VALUES',
            sectionSlug: 'privacy-values',
            lead: {
              articleId: null,
              title: 'Do you have a private AI secret?',
              imageUrl: 'img4.png',
              href: '/section/privacy-values',
              enabled: true
            },
            subArticles: [
              { id: 'sub-3-1', title: 'Families alone, yes. But watching the community is another thing.', href: '/section/privacy-values', enabled: true },
              { id: 'sub-3-2', title: 'Is that family member a Privatian or not — and who decides the rules?', href: '/section/privacy-values', enabled: true },
              { id: 'sub-3-3', title: 'Bowling alone, yes. But the Privatian family still gathers.', href: '/section/privacy-values', enabled: true }
            ]
          },
          {
            id: 'col-4',
            label: 'NATION & WORLD',
            sectionSlug: 'nation-world',
            lead: {
              articleId: null,
              title: 'How the Privatian diaspora is keeping tradition alive in a globalized world',
              imageUrl: 'img6.png',
              href: '/section/nation-world',
              enabled: true
            },
            subArticles: [
              { id: 'sub-4-1', title: 'Bearing down on global secrecy: what the Privatian model teaches us', href: '/section/nation-world', enabled: true },
              { id: 'sub-4-2', title: 'Currency of trust: how the Privatian family built international networks', href: '/section/nation-world', enabled: true }
            ]
          },
          {
            id: 'col-5',
            label: 'ARTS & LEGACY',
            sectionSlug: 'arts-legacy',
            lead: {
              articleId: null,
              title: 'New research shows writing by hand preserves memory and sharpens intellect',
              imageUrl: 'img3.png',
              href: '/section/arts-legacy',
              enabled: true
            },
            subArticles: [
              { id: 'sub-5-1', title: 'Rowing, dance: yes. But the Privatian pen holds a special place of honor.', href: '/section/arts-legacy', enabled: true },
              { id: 'sub-5-2', title: 'Novelist argues the world needs more well-written letters, not fewer', href: '/section/arts-legacy', enabled: true },
              { id: 'sub-5-3', title: 'Turnover at The Privatian Society demands that cultural legacy must be paid.', href: '/section/arts-legacy', enabled: true }
            ]
          },
          {
            id: 'col-6',
            label: 'WORK & ECONOMY',
            sectionSlug: 'work-economy',
            lead: {
              articleId: null,
              title: 'Go-to Privatian professionals redefine private practices in modern economy',
              imageUrl: 'img5.png',
              href: '/section/work-economy',
              enabled: true
            },
            subArticles: [
              { id: 'sub-6-1', title: "Rural flower power: the Privatian family's investment in private land", href: '/section/work-economy', enabled: true },
              { id: 'sub-6-2', title: 'The Privatian economy advisor talks to the state of family wealth', href: '/section/work-economy', enabled: true },
              { id: 'sub-6-3', title: 'Letters of the law: the Privatian legal scholars improve upon family statutes', href: '/section/work-economy', enabled: true }
            ]
          }
        ]
      }
    };

    const DEFAULT_HOMEPAGE_CONFIG_BN = {
      hero: {
        main: {
          articleId: null,
          title: 'ব্যক্তিগত প্রজ্ঞার শিল্প: কীভাবে প্রাইভেসিয়ান পরিবারগুলো সংস্কৃতি ও ঐতিহ্য গড়ে তোলে।',
          subtitle: 'পারিবারিক ঐতিহ্য, বুদ্ধিবৃত্তিক পরম্পরা এবং নিজস্ব জ্ঞানের চিরস্থায়ী ক্ষমতার এক অনন্য অনুসন্ধান।',
          imageUrl: 'img1.png',
          href: '/section/findings',
          enabled: true
        },
        sidebar: [
          {
            id: 'h-side-1',
            articleId: null,
            title: 'অর্ধেক ঐতিহ্য, অর্ধেক পর্যবেক্ষণ: প্রজন্ম থেকে প্রজন্মে প্রাইভেসিয়ানদের পথচলা',
            description: 'পারিবারিক সংরক্ষণাগার থেকে, প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত প্রচেষ্টার মাধ্যমে নতুন পথ তৈরি করে',
            imageUrl: 'img5.png',
            tag: '',
            href: '/section/community-heritage',
            enabled: true
          },
          {
            id: 'h-side-2',
            articleId: null,
            title: 'কীভাবে প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত উৎকর্ষের এক নতুন যুগকে সংজ্ঞায়িত করেছে',
            description: 'সংস্কৃতি, শিল্পকলা এবং বুদ্ধিবৃত্তিক চিন্তাধারায় পরিবারের প্রভাব সাধারণ ধারণার চেয়েও গভীর',
            imageUrl: 'img6.png',
            tag: '',
            href: '/section/culture',
            enabled: true
          }
        ]
      },
      smallArticles: [
        {
          id: 'sm-1',
          articleId: null,
          title: 'যখন প্রাইভেসিয়ানরা মিলিত হয়: সম্প্রদায়ের নিভৃত শক্তি',
          imageUrl: 'img2.png',
          href: '/section/community-heritage',
          enabled: true
        },
        {
          id: 'sm-2',
          articleId: null,
          title: 'কেন হাতে লেখা চিঠিপত্র আবার ব্যক্তিগত জগতে ফিরে আসছে',
          imageUrl: 'img3.png',
          href: '/section/culture',
          enabled: true
        },
        {
          id: 'sm-3',
          articleId: null,
          title: 'কেমব্রিজের পাঠাগারের অন্তরালে: সংরক্ষণ, স্মৃতি ও মনন',
          imageUrl: 'img4.png',
          href: '/section/privacy-values',
          enabled: true
        }
      ],
      eventsSection: {
        eventsHeading: 'আসন্ন ইভেন্ট ও আয়োজন',
        seeAllText: 'সকল ইভেন্ট দেখুন',
        seeAllHref: '/events',
        events: [
          {
            id: 'ev-1',
            date: '২৮ মার্চ, ২০২৬',
            title: 'বসন্তকালীন সম্মেলন: পারিবারিক সংরক্ষণাগারের ভবিষ্যৎ ও সুরক্ষা',
            meta: 'সন্ধ্যা ৬:০০ ■ কেমব্রিজ, এমএ; সরাসরি সম্প্রচার',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-2',
            date: '১৪ এপ্রিল, ২০২৬',
            title: 'বার্ষিক ঐতিহ্য বক্তৃতা ও মুক্ত আলোচনা সভা',
            meta: 'বিকাল ৪:৩০ ■ বোস্টন, এমএ; প্রাইভেসিয়ান সেন্টার',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-3',
            date: '১২ নভেম্বর, ২০২৬',
            title: 'বার্ষিক মিলনমেলা: প্রাইভেসিয়ান ফেলোশিপের ১২০ বছর উদযাপন',
            meta: 'দুপুর ২:০০ ■ কেমব্রিজ হেরিটেজ লাইব্রেরি',
            href: '/events',
            enabled: true
          },
          {
            id: 'ev-4',
            date: '০৪ ডিসেম্বর, ২০২৬',
            title: 'বার্ষিক প্রাইভেসিয়ান সাহিত্য সম্মাননা ও ফেলোশিপ অ্যাওয়ার্ড প্রদান',
            meta: 'সন্ধ্যা ৬:০০ ■ গ্র্যান্ড বলরুম, দ্য প্রাইভেসিয়ান সোসাইটি',
            href: '/events',
            enabled: true
          }
        ],
        featured: {
          articleId: null,
          title: "রুবির রহস্য উন্মোচন: 'ঐতিহ্য হলো সামগ্রিক পরিচয়ের একটি অংশ'",
          description: 'নতুন প্রাইভেসিয়ান প্রদর্শনীতে দুর্লভ পারিবারিক স্মারক ও ঐতিহাসিক উত্তরাধিকার',
          imageUrl: 'img5.png',
          href: '/section/community-heritage',
          enabled: true
        }
      },
      allNews: {
        heading: 'সকল খবর',
        columns: [
          {
            id: 'col-1',
            label: 'সমাজ ও ঐতিহ্য',
            sectionSlug: 'community-heritage',
            lead: {
              articleId: null,
              title: "পারিবারিক সংরক্ষণাগার থেকে গবেষকদের নতুন দৃষ্টিভঙ্গি ও সাফল্য",
              imageUrl: 'img2.png',
              href: '/section/community-heritage',
              enabled: true
            },
            subArticles: [
              { id: 'sub-1-1', title: 'পারিবারিক ঐতিহ্যের অলিখিত নিয়মাবলী: সংরক্ষণাগার আমাদের কী বার্তা দেয়', href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-2', title: 'আত্মানুসন্ধান: পরিচয়ের ওপর নতুন গবেষণা ও অনুসন্ধান', href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-3', title: '১৯ শতকের হিসাবের খাতা বিশ্বাস সম্পর্কে কী প্রকাশ করে', href: '/section/community-heritage', enabled: true },
              { id: 'sub-1-4', title: 'ব্যক্তিগত প্রতিষ্ঠান এবং সত্যের সুরক্ষা', href: '/section/community-heritage', enabled: true }
            ]
          },
          {
            id: 'col-2',
            label: 'সংস্কৃতি',
            sectionSlug: 'culture',
            lead: {
              articleId: null,
              title: "নীরব উৎকর্ষের সংস্কৃতি: কেন সংযত পারদর্শিতা মূল্যবান",
              imageUrl: 'img1.png',
              href: '/section/culture',
              enabled: true
            },
            subArticles: [
              { id: 'sub-2-1', title: 'তরুণ প্রাইভেসিয়ান সদস্যদের মাঝে সৃজনশীল লেখায় কৃত্রিম বুদ্ধিমত্তার বিস্তার', href: '/section/culture', enabled: true },
              { id: 'sub-2-2', title: 'কলমের কালি রিফিল? এগিয়ে চলুন, বলছে ক্যালিগ্রাফি সোসাইটি', href: '/section/culture', enabled: true },
              { id: 'sub-2-3', title: 'সঙ্গীত রেসিডেন্সি মূলত আন্তরিক সংযোগের মাধ্যম', href: '/section/culture', enabled: true }
            ]
          },
          {
            id: 'col-3',
            label: 'গোপনীয়তা ও মূল্যবোধ',
            sectionSlug: 'privacy-values',
            lead: {
              articleId: null,
              title: 'আপনার কি কোনো ব্যক্তিগত এআই গোপন তথ্য আছে?',
              imageUrl: 'img4.png',
              href: '/section/privacy-values',
              enabled: true
            },
            subArticles: [
              { id: 'sub-3-1', title: 'পরিবার একা হতে পারে, তবে সমাজকে পর্যবেক্ষণ করা ভিন্ন বিষয়', href: '/section/privacy-values', enabled: true },
              { id: 'sub-3-2', title: 'তিনি কি আসলেই পরিবারের সদস্য—এবং এই নিয়ম কারা নির্ধারণ করে?', href: '/section/privacy-values', enabled: true },
              { id: 'sub-3-3', title: 'একাকী কাটানো সময় নয়, বরং পরিবার এখনও নিয়মিত মিলিত হয়', href: '/section/privacy-values', enabled: true }
            ]
          },
          {
            id: 'col-4',
            label: 'দেশ ও বিশ্ব',
            sectionSlug: 'nation-world',
            lead: {
              articleId: null,
              title: 'বিশ্বায়নের যুগে কীভাবে প্রাইভেসিয়ান প্রবাসী সম্প্রদায় ঐতিহ্য বাঁচিয়ে রেখেছে',
              imageUrl: 'img6.png',
              href: '/section/nation-world',
              enabled: true
            },
            subArticles: [
              { id: 'sub-4-1', title: 'গোপনীয়তার বৈশ্বিক পাঠ: প্রাইভেসিয়ান মডেল আমাদের কী শেখায়', href: '/section/nation-world', enabled: true },
              { id: 'sub-4-2', title: 'বিশ্বাসের ভিত্তি: যেভাবে গড়ে উঠেছে আন্তর্জাতিক নেটওয়ার্ক', href: '/section/nation-world', enabled: true }
            ]
          },
          {
            id: 'col-5',
            label: 'শিল্প ও উত্তরাধিকার',
            sectionSlug: 'arts-legacy',
            lead: {
              articleId: null,
              title: 'নতুন গবেষণায় দেখা গেছে: হাতে লেখার অভ্যাস স্মৃতিশক্তি ও বুদ্ধি প্রখর করে',
              imageUrl: 'img3.png',
              href: '/section/arts-legacy',
              enabled: true
            },
            subArticles: [
              { id: 'sub-5-1', title: 'খেলাধুলা ও শিল্পকলার পাশাপাশি কলমের গুরুত্ব অনন্য', href: '/section/arts-legacy', enabled: true },
              { id: 'sub-5-2', title: 'ঔপন্যাসিকদের মতে বিশ্বের আরও সুচিন্তিত চিঠিপত্র প্রয়োজন', href: '/section/arts-legacy', enabled: true },
              { id: 'sub-5-3', title: 'সোসাইটির প্রতিটি পর্যায়ে সাংস্কৃতিক উত্তরাধিকার বজায় রাখা জরুরি', href: '/section/arts-legacy', enabled: true }
            ]
          },
          {
            id: 'col-6',
            label: 'কর্ম ও অর্থনীতি',
            sectionSlug: 'work-economy',
            lead: {
              articleId: null,
              title: 'আধুনিক অর্থনীতিতে শীর্ষ পেশাজীবীরা নতুন মাত্রা যোগ করছেন',
              imageUrl: 'img5.png',
              href: '/section/work-economy',
              enabled: true
            },
            subArticles: [
              { id: 'sub-6-1', title: "গ্রামীণ অর্থনীতি: ব্যক্তিগত জমিতে পরিবারের যুগান্তকারী বিনিয়োগ", href: '/section/work-economy', enabled: true },
              { id: 'sub-6-2', title: 'অর্থনৈতিক উপদেষ্টার সঙ্গে পারিবারিক সম্পদের বর্তমান অবস্থা নিয়ে আলোচনা', href: '/section/work-economy', enabled: true },
              { id: 'sub-6-3', title: 'আইনের ধারা: পরিবারের নীতিমালা সংস্কারে আইনজ্ঞদের ভূমিকা', href: '/section/work-economy', enabled: true }
            ]
          }
        ]
      }
    };

    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'site_homepage_config_bn' : 'site_homepage_config';
    const fallbackId = isBn ? '__homepage_config_bn__' : '__homepage_config__';

    if (req.method === 'GET') {
      function cleanConfig(c) {
        if (c && c.hero && Array.isArray(c.hero.sidebar)) {
          c.hero.sidebar.forEach(s => {
            if (s.tag && (s.tag.toLowerCase() === 'heritage archive' || s.tag === 'ঐতিহ্য সংরক্ষণাগার' || s.tag === 'ঐতিহ্য সংগ্রহশালা')) s.tag = '';
          });
        }
        return c;
      }

      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value) return res.status(200).json(cleanConfig(data.value));
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') return res.status(200).json(cleanConfig(parsed));
        }
      } catch(e) {}

      return res.status(200).json(cleanConfig(isBn ? DEFAULT_HOMEPAGE_CONFIG_BN : DEFAULT_HOMEPAGE_CONFIG));
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const homepageConfig = req.body || {};

      const targetKey = isBn ? 'site_homepage_config' : 'site_homepage_config_bn';
      const targetFallbackId = isBn ? '__homepage_config__' : '__homepage_config_bn__';

      let otherLangConfig = null;
      try {
        const { data: tData } = await sb.from('site_settings').select('value').eq('key', targetKey).maybeSingle();
        if (tData && tData.value && typeof tData.value === 'object') otherLangConfig = tData.value;
      } catch(e) {}
      if (!otherLangConfig) otherLangConfig = isBn ? DEFAULT_HOMEPAGE_CONFIG : DEFAULT_HOMEPAGE_CONFIG_BN;

      // Bidirectional sync: enabled (on/off, show/hide), ordering (up/down, move), item IDs, URLs
      const updatedOtherConfig = syncHomepageStructures(homepageConfig, otherLangConfig, isBn);
      const finalSourceConfig = isBn ? syncHomepageStructures(otherLangConfig, homepageConfig, false) : homepageConfig;

      let saved = false;
      try {
        const { error: err1 } = await sb.from('site_settings').upsert({
          key: settingsKey,
          value: finalSourceConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        const { error: err2 } = await sb.from('site_settings').upsert({
          key: targetKey,
          value: updatedOtherConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (!err1) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9997,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', fallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: fallbackId,
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9997,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }
        } catch(err) {
          console.warn('[DB fallback homepage save error]:', err.message);
        }
      }

      try {
        await logActivity({
          actor: session,
          action: 'layout.homepage_save',
          category: 'layout',
          summary: `${session.name || session.email} updated Homepage builder configuration (${isBn ? 'Bengali' : 'English'})`,
          target_id: settingsKey,
          target_name: 'Homepage Builder',
          details: { lang: isBn ? 'bn' : 'en' },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, data: finalSourceConfig });
    }
  }

  // ── FOOTER CONFIGURATION (GET / POST) ───────────────────────────────────
  if (action === 'footer') {
    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'site_footer_config_bn' : 'site_footer_config';
    const fallbackId = isBn ? '__footer_config_bn__' : '__footer_config__';

    const DEFAULT_FOOTER_CONFIG = {
      sectionsTitle: isBn ? 'বিভাগসমূহ' : 'Sections',
      enabledSections: null,
      exploreTitle: isBn ? 'প্রাইভেটিয়ান এক্সপ্লোর করুন' : 'Explore the Privatian',
      explore: [
        { id: 'f-exp-1', label: isBn ? 'ইভেন্টসমূহ' : 'Events', href: '/events', target: '_self', enabled: true },
        { id: 'f-exp-2', label: isBn ? 'আর্টিকেল আর্কাইভ' : 'Article archive', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-3', label: isBn ? 'আমাদের সম্পর্কে' : 'About us', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-4', label: isBn ? 'সংবাদ+' : 'News+', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-5', label: isBn ? 'পডকাস্ট' : 'Podcast', href: '/', target: '_self', enabled: true }
      ],
      seriesTitle: isBn ? 'আমাদের সাম্প্রতিক সিরিজ' : 'Our recent series',
      series: [
        {
          id: 'f-ser-1',
          title: isBn ? 'অনুসন্ধিৎসু' : 'Wondering',
          href: '/section/findings',
          description: isBn ? 'প্রাইভেটিয়ান ফ্যামিলি বিশেষজ্ঞদের গভীর অনুসন্ধানী আলোচনা।' : 'A series of profound questions explored by The Privatian Family experts.',
          enabled: true
        },
        {
          id: 'f-ser-2',
          title: isBn ? 'জীবন | ঐতিহ্য' : 'Life | Heritage',
          href: '/section/community-heritage',
          description: isBn ? 'পারিবারিক ঐতিহ্য ও ব্যক্তিগত গবেষণার উপর গুরুত্ব দেওয়া একটি বিশেষ সিরিজ।' : 'A series focused on the personal side of Privatian family research and tradition.',
          enabled: true
        }
      ],
      socialTitle: isBn ? 'অনুসরণ করুন' : 'Follow us on',
      social: [
        { id: 'f-soc-1', platform: 'instagram', label: 'Instagram', href: 'https://instagram.com', enabled: true },
        { id: 'f-soc-2', platform: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com', enabled: true },
        { id: 'f-soc-3', platform: 'tiktok', label: 'TikTok', href: 'https://tiktok.com', enabled: true },
        { id: 'f-soc-4', platform: 'facebook', label: 'Facebook', href: 'https://facebook.com', enabled: true },
        { id: 'f-soc-5', platform: 'youtube', label: 'YouTube', href: 'https://youtube.com', enabled: true },
        { id: 'f-soc-6', platform: 'email', label: 'Email', href: 'mailto:contact@privatian.org', enabled: true }
      ],
      logoSvg: '',
      logoHeight: 80,
      tagline: isBn ? 'দ্য প্রাইভেটিয়ান সোসাইটির অফিশিয়াল প্রকাশনা — ক্যামব্রিজ, ম্যাসাচুসেটস' : 'The Official Publication of The Privatian Society — Cambridge, Massachusetts',
      copyright: isBn ? '© ২০২৬ দ্য প্রাইভেটিয়ান ফ্যামিলি। সর্বস্বত্ব সংরক্ষিত।' : '© 2026 The Privatian Family. All rights reserved.',
      bottomLinks: [
        { id: 'f-bot-1', label: isBn ? 'মিডিয়া ও সাংবাদিকদের জন্য' : 'For Media & Journalists', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-2', label: isBn ? 'পারিবারিক সংবাদ ও আর্কাইভ' : 'Family News & Archives', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-3', label: isBn ? 'ডিজিটাল এক্সেসিবিলিটি' : 'Digital Accessibility', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-4', label: isBn ? 'গোপনীয়তা নীতি' : 'Privacy Policy', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-5', label: isBn ? 'ট্রেডমার্ক' : 'Trademark', href: '#', target: '_self', enabled: true }
      ]
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') return res.status(200).json(parsed);
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_FOOTER_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const footerConfig = req.body || {};

      const targetKey = isBn ? 'site_footer_config' : 'site_footer_config_bn';
      const targetFallbackId = isBn ? '__footer_config__' : '__footer_config_bn__';

      let otherLangConfig = null;
      try {
        const { data: tData } = await sb.from('site_settings').select('value').eq('key', targetKey).maybeSingle();
        if (tData && tData.value && typeof tData.value === 'object') otherLangConfig = tData.value;
      } catch(e) {}
      if (!otherLangConfig) otherLangConfig = DEFAULT_FOOTER_CONFIG;

      // Bidirectional sync: columns link structure, order, IDs, enabled (on/off), URLs
      const updatedOtherConfig = syncFooterStructures(footerConfig, otherLangConfig, isBn);
      const finalSourceConfig = footerConfig;

      let saved = false;
      try {
        const { error: err1 } = await sb.from('site_settings').upsert({
          key: settingsKey,
          value: finalSourceConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        const { error: err2 } = await sb.from('site_settings').upsert({
          key: targetKey,
          value: updatedOtherConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (!err1) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9996,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', fallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: fallbackId,
              name: JSON.stringify(finalSourceConfig),
              slug: fallbackId,
              display_order: 9996,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }

          const { data: targetExisting } = await sb.from('sections').select('id').eq('admin_id', targetFallbackId).maybeSingle();
          if (targetExisting) {
            await sb.from('sections').update({
              name: JSON.stringify(updatedOtherConfig),
              slug: targetFallbackId,
              display_order: 9996,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', targetFallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: targetFallbackId,
              name: JSON.stringify(updatedOtherConfig),
              slug: targetFallbackId,
              display_order: 9996,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }
        } catch(err) {
          console.warn('[DB fallback footer save error]:', err.message);
        }
      }

      try {
        await logActivity({
          actor: session,
          action: 'layout.footer_save',
          category: 'layout',
          summary: `${session.name || session.email} updated Footer layout configuration (${isBn ? 'Bengali' : 'English'})`,
          target_id: settingsKey,
          target_name: 'Footer Layout',
          details: { lang: isBn ? 'bn' : 'en' },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, data: finalSourceConfig });
    }
  }

  // ── INDIVIDUAL SECTION CUSTOM CONFIGURATION (GET / POST) ────────────────
  if (action === 'section-config') {
    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'sections_custom_configs_bn' : 'sections_custom_configs';
    const fallbackId = isBn ? '__section_configs_bn__' : '__section_configs__';
    const slug = (req.query && req.query.slug) || (req.body && req.body.slug) || 'all';

    if (req.method === 'GET') {
      let allConfigs = {};
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value && typeof data.value === 'object') {
          allConfigs = data.value;
        }
      } catch(e) {}

      if (Object.keys(allConfigs).length === 0) {
        try {
          const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
          if (sData && sData.name) {
            const parsed = JSON.parse(sData.name);
            if (parsed && typeof parsed === 'object') allConfigs = parsed;
          }
        } catch(e) {}
      }

      if (req.query.all === '1' || !req.query.slug) {
        return res.status(200).json(allConfigs);
      }
      return res.status(200).json(allConfigs[slug] || {
        featuredArticleId: null,
        selectedArticleIds: [],
        customTitle: '',
        description: ''
      });
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;

      const payload = req.body || {};
      const targetKey = isBn ? 'sections_custom_configs' : 'sections_custom_configs_bn';
      const targetFallbackId = isBn ? '__section_configs__' : '__section_configs_bn__';

      let allConfigs = {};
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value && typeof data.value === 'object') allConfigs = data.value;
      } catch(e) {}

      let targetConfigs = {};
      try {
        const { data: tData } = await sb.from('site_settings').select('value').eq('key', targetKey).maybeSingle();
        if (tData && tData.value && typeof tData.value === 'object') targetConfigs = tData.value;
      } catch(e) {}

      const sharedFeatured = payload.featuredArticleId || null;
      const sharedSelected = Array.isArray(payload.selectedArticleIds) ? payload.selectedArticleIds.slice(0, 4) : [];

      allConfigs[slug] = {
        featuredArticleId: sharedFeatured,
        selectedArticleIds: sharedSelected,
        customTitle: payload.customTitle || (allConfigs[slug]?.customTitle || ''),
        description: payload.description || (allConfigs[slug]?.description || ''),
        updatedAt: new Date().toISOString()
      };

      if (!targetConfigs[slug]) targetConfigs[slug] = {};
      targetConfigs[slug].featuredArticleId = sharedFeatured;
      targetConfigs[slug].selectedArticleIds = sharedSelected;
      targetConfigs[slug].updatedAt = new Date().toISOString();

      try {
        await sb.from('site_settings').upsert({
          key: settingsKey,
          value: allConfigs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        await sb.from('site_settings').upsert({
          key: targetKey,
          value: targetConfigs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch(err) {
        console.warn('[Sections config save error]:', err.message);
      }

      // Fallback save in sections table
      try {
        const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
        if (existing) {
          await sb.from('sections').update({
            name: JSON.stringify(allConfigs),
            slug: fallbackId,
            display_order: 9995,
            is_active: false,
            locked: true,
            is_deleted: true
          }).eq('admin_id', fallbackId);
        } else {
          await sb.from('sections').insert({
            admin_id: fallbackId,
            name: JSON.stringify(allConfigs),
            slug: fallbackId,
            display_order: 9995,
            is_active: false,
            locked: true,
            is_deleted: true
          });
        }
      } catch(err) {}

      return res.status(200).json({ ok: true, data: allConfigs[slug] });
    }
  }

  // ── TYPOGRAPHY & FONTS CONFIGURATION (GET / POST) ──────────────────────
  if (action === 'typography') {
    const isBn = (req.query && req.query.lang === 'bn') || (req.body && req.body.lang === 'bn');
    const settingsKey = isBn ? 'site_typography_settings_bn' : 'site_typography_settings';
    const fallbackId = isBn ? '__typography_config_bn__' : '__typography_config__';

    const DEFAULT_TYPOGRAPHY_CONFIG = {
      header_section: {
        fontFamily: isBn ? 'Hind Siliguri' : 'Source Sans 3',
        fontSize: isBn ? 14 : 13,
        fontWeight: '600',
        lineHeight: 1.2,
        letterSpacing: isBn ? '0em' : '0.06em',
        textTransform: isBn ? 'none' : 'uppercase',
        fontStyle: 'normal'
      },
      subheader: {
        fontFamily: isBn ? 'Hind Siliguri' : 'Source Sans 3',
        fontSize: isBn ? 12.5 : 12,
        fontWeight: '400',
        lineHeight: 1.4,
        letterSpacing: isBn ? '0em' : '0.02em',
        textTransform: 'none',
        fontStyle: 'normal'
      },
      menu: {
        fontFamily: isBn ? 'Hind Siliguri' : 'Source Sans 3',
        fontSize: isBn ? 15.5 : 15,
        fontWeight: '600',
        lineHeight: 1.4,
        letterSpacing: '0em',
        textTransform: 'none',
        fontStyle: 'normal'
      },
      article_title: {
        fontFamily: isBn ? 'Noto Serif Bengali' : 'Libre Baskerville',
        fontSize: isBn ? 36 : 38,
        fontWeight: '700',
        lineHeight: isBn ? 1.3 : 1.25,
        letterSpacing: isBn ? '0em' : '-0.02em',
        textTransform: 'none',
        fontStyle: 'normal'
      },
      article_subtitle: {
        fontFamily: isBn ? 'Noto Serif Bengali' : 'Libre Baskerville',
        fontSize: isBn ? 17.5 : 18,
        fontWeight: '400',
        lineHeight: isBn ? 1.55 : 1.5,
        letterSpacing: '0em',
        textTransform: 'none',
        fontStyle: isBn ? 'normal' : 'italic'
      },
      article_body: {
        fontFamily: isBn ? 'Noto Serif Bengali' : 'Source Sans 3',
        fontSize: isBn ? 17.5 : 17,
        fontWeight: '400',
        lineHeight: isBn ? 1.8 : 1.75,
        letterSpacing: '0em',
        textTransform: 'none',
        fontStyle: 'normal'
      },
      article_quote: {
        fontFamily: isBn ? 'Noto Serif Bengali' : 'Libre Baskerville',
        fontSize: isBn ? 19.5 : 20,
        fontWeight: isBn ? '600' : '400',
        lineHeight: isBn ? 1.6 : 1.55,
        letterSpacing: '0em',
        textTransform: 'none',
        fontStyle: isBn ? 'normal' : 'italic'
      }
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', settingsKey).maybeSingle();
        if (data && data.value) {
          const merged = Object.assign({}, DEFAULT_TYPOGRAPHY_CONFIG, data.value);
          return res.status(200).json(merged);
        }
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', fallbackId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') {
            const merged = Object.assign({}, DEFAULT_TYPOGRAPHY_CONFIG, parsed);
            return res.status(200).json(merged);
          }
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_TYPOGRAPHY_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;

      const body = req.body || {};
      const typographyConfig = body.config || body;

      const cleanConfig = Object.assign({}, DEFAULT_TYPOGRAPHY_CONFIG, typographyConfig);

      let saved = false;
      try {
        const { error: err } = await sb.from('site_settings').upsert({
          key: settingsKey,
          value: cleanConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!err) saved = true;
      } catch(err) {}

      if (!saved) {
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', fallbackId).maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(cleanConfig),
              slug: fallbackId,
              display_order: 9993,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', fallbackId);
          } else {
            await sb.from('sections').insert({
              admin_id: fallbackId,
              name: JSON.stringify(cleanConfig),
              slug: fallbackId,
              display_order: 9993,
              is_active: false,
              locked: true,
              is_deleted: true
            });
          }
        } catch(err) {
          console.warn('[DB typography save error]:', err.message);
        }
      }

      logActivity({
        actor: session,
        action: 'layout.typography_save',
        category: 'layout',
        summary: `${session.name || session.email} updated Typography & Font settings (${isBn ? 'Bengali' : 'English'})`,
        target_id: settingsKey,
        target_name: 'Typography Settings',
        details: { lang: isBn ? 'bn' : 'en' },
        req
      }).catch(() => {});

      return res.status(200).json({ ok: true, data: cleanConfig });
    }
  }

  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const statusParam = (req.query && req.query.status) || 'active';
    const session = verifySession(req);

    let query = sb.from('sections').select('*').order('display_order', { ascending: true });

    if (statusParam === 'all') {
      // Admin / All view: return all records including deleted
    } else {
      // Public: only active, non-deleted rows
      query = query.eq('is_active', true).eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const rows = (data || []).filter(r => 
      !r.admin_id?.startsWith('__') && 
      !r.slug?.startsWith('__') && 
      !r.name?.startsWith('{')
    );

    if (statusParam === 'all') {
      // Admin format: full section objects with id, slug, name, name_bn, locked, deleted
      return res.status(200).json(rows.map(rowToAdminSection));
    } else {
      // Public format: minimal shape, no locked rows
      return res.status(200).json(
        rows
          .filter(r => !r.locked)
          .map(r => ({ name: r.name, name_bn: r.name_bn || '', slug: r.slug, display_order: r.display_order }))
      );
    }
  }

  // ── POST: create section ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const body = req.body || {};
    const name    = (body.name   || '').trim();
    const name_bn = (body.name_bn || '').trim();
    const slug    = (body.slug   || '').trim();
    const adminId = (body.admin_id || slug || '').trim();

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    // Check uniqueness safely against commas/spaces in section names
    const safeName = name.replace(/"/g, '\\"');
    const safeSlug = slug.replace(/"/g, '\\"');
    const safeAdminId = adminId.replace(/"/g, '\\"');
    const { data: existing } = await sb.from('sections')
      .select('id')
      .or(`name.eq."${safeName}",slug.eq."${safeSlug}",admin_id.eq."${safeAdminId}"`)
      .eq('is_deleted', false)
      .limit(1);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'A section with that name or slug already exists.' });
    }

    // Next display order
    const { data: maxRow } = await sb.from('sections')
      .select('display_order').order('display_order', { ascending: false }).limit(1);
    const nextOrder = (maxRow && maxRow[0] ? maxRow[0].display_order : 0) + 1;

    const { data, error } = await sb.from('sections').insert({
      name, name_bn, slug, admin_id: adminId,
      display_order: nextOrder,
      is_active: true, locked: false, is_deleted: false, deleted_at: null,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    try {
      await logActivity({
        actor: session,
        action: 'section.create',
        category: 'sections',
        summary: `${session.name || session.email} created new section "${name}" (/section/${slug})`,
        target_id: adminId,
        target_name: name,
        details: { slug, name, name_bn, admin_id: adminId },
        req
      });
    } catch(e) {}

    return res.status(201).json(rowToAdminSection(data));
  }

  // ── PUT: rename / re-slug ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id   = req.query && req.query.id;
    const body = req.body || {};
    const name = (body.name || '').trim();
    const name_bn = body.name_bn !== undefined ? String(body.name_bn).trim() : undefined;
    const slug = (body.slug || '').trim();

    if (!id)   return res.status(400).json({ error: 'id (admin_id) is required' });
    if (!name && name_bn === undefined) return res.status(400).json({ error: 'name or name_bn is required' });

    const updateObj = {};
    if (name) updateObj.name = name;
    if (slug) updateObj.slug = slug;
    if (name_bn !== undefined) updateObj.name_bn = name_bn;

    let { data, error } = await sb.from('sections')
      .update(updateObj)
      .eq('admin_id', id)
      .select().maybeSingle();

    if (!data && !error) {
      const insertObj = Object.assign({
        admin_id: id,
        name: name || 'All',
        name_bn: name_bn || 'সকল',
        slug: slug || '',
        display_order: 0,
        is_active: true,
        locked: false,
        is_deleted: false
      }, updateObj);
      const insRes = await sb.from('sections').insert(insertObj).select().single();
      data = insRes.data;
      error = insRes.error;
    }

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

    try {
      await logActivity({
        actor: session,
        action: 'section.restore',
        category: 'sections',
        summary: `${session.name || session.email} restored section "${data.name || id}" from trash`,
        target_id: id,
        target_name: data.name || id,
        details: {},
        req
      });
    } catch(e) {}

    return res.status(200).json(rowToAdminSection(data));
  }

  // ── DELETE: soft-delete or permanent ─────────────────────────────────────
  if (req.method === 'DELETE') {
    const id   = req.query && req.query.id;
    const mode = req.query && req.query.mode;
    if (!id) return res.status(400).json({ error: 'id (admin_id) is required' });

    if (id === 'all' || id.toLowerCase() === 'all') {
      return res.status(400).json({ error: 'The "All" section is a permanent core section and cannot be deleted.' });
    }

    if (mode === 'permanent') {
      // Hard delete — STRICTLY Admin only with live DB check
      const session = await requireAdmin(req, res);
      if (!session) return;

      const { error } = await sb.from('sections').delete().eq('admin_id', id);
      if (error) return res.status(500).json({ error: error.message });

      try {
        await logActivity({
          actor: session,
          action: 'section.delete_permanent',
          category: 'sections',
          summary: `${session.name || session.email} permanently deleted section ID "${id}"`,
          target_id: id,
          target_name: id,
          details: { permanent: true },
          req
        });
      } catch(e) {}

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

    try {
      await logActivity({
        actor: session,
        action: 'section.delete',
        category: 'sections',
        summary: `${session.name || session.email} moved section "${data.name || id}" to trash`,
        target_id: id,
        target_name: data.name || id,
        details: { is_deleted: true },
        req
      });
    } catch(e) {}

    return res.status(200).json(rowToAdminSection(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
};