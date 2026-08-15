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
          href: '/section/findings',
          description: 'A series of profound questions explored by The Privatian Family experts.',
          enabled: true
        }
      ],
      exploreTitle: 'Explore the Privatian',
      explore: [
        { id: 'exp-1', label: 'Events', href: '/events', target: '_self', enabled: true },
        { id: 'exp-2', label: 'Article archive', href: '/', target: '_self', enabled: true },
        { id: 'exp-3', label: 'About us', href: '/', target: '_self', enabled: true },
        { id: 'exp-4', label: 'News+', href: '/', target: '_self', enabled: true },
        { id: 'exp-5', label: 'Podcast', href: '/', target: '_self', enabled: true }
      ],
      latestTitle: 'Read the latest',
      latestMode: 'curated',
      latest: [
        {
          id: 'latest-1',
          title: "For families in transition, 'not all traditions are equal'",
          href: '/section/community-heritage',
          imageUrl: 'img1.png',
          enabled: true
        },
        {
          id: 'latest-2',
          title: 'The art of the pen: How writing shapes cultural identity',
          href: '/section/culture',
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

  // ── HEADER CONFIGURATION (GET / POST) ───────────────────────────────────
  if (action === 'header') {
    const DEFAULT_HEADER_CONFIG = {
      siteTitle: 'The Privatian Family',
      tabTagline: 'Insights, Stories & Heritage',
      browserTabTitle: 'The Privatian Family — Insights, Stories & Heritage',
      metaDescription: 'The Official Publication of The Privatian Society — Cambridge, Massachusetts.',
      faviconUrl: '',
      logoSvg: null,
      logoHeight: 80,
      enabledNavSections: null,
      subsections: [
        { id: 'sub-1', label: 'FAMILY LEGACY', href: '/section/community-heritage', icon: null, enabled: true },
        { id: 'sub-2', label: 'EXPERIENCE', href: '/section/culture', icon: null, enabled: true },
        { id: 'sub-3', label: 'THE PRIVATIAN READS', href: '/section/findings', icon: null, enabled: true },
        { id: 'sub-4', label: 'EVENTS', href: '/events', icon: 'calendar', enabled: true }
      ]
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'site_header_config').maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__header_config__').maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') return res.status(200).json(parsed);
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_HEADER_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const headerConfig = req.body || {};

      let saved = false;
      try {
        const { error } = await sb.from('site_settings').upsert({
          key: 'site_header_config',
          value: headerConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!error) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__header_config__').maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(headerConfig),
              slug: '__header_config__',
              display_order: 9998,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', '__header_config__');
          } else {
            await sb.from('sections').insert({
              admin_id: '__header_config__',
              name: JSON.stringify(headerConfig),
              slug: '__header_config__',
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
      return res.status(200).json({ ok: true, data: headerConfig });
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
            tag: 'Heritage Archive',
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

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'site_homepage_config').maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__homepage_config__').maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') return res.status(200).json(parsed);
        }
      } catch(e) {}

      return res.status(200).json(DEFAULT_HOMEPAGE_CONFIG);
    }

    if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;
      const homepageConfig = req.body || {};

      let saved = false;
      try {
        const { error } = await sb.from('site_settings').upsert({
          key: 'site_homepage_config',
          value: homepageConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!error) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__homepage_config__').maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(homepageConfig),
              slug: '__homepage_config__',
              display_order: 9997,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', '__homepage_config__');
          } else {
            await sb.from('sections').insert({
              admin_id: '__homepage_config__',
              name: JSON.stringify(homepageConfig),
              slug: '__homepage_config__',
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
      return res.status(200).json({ ok: true, data: homepageConfig });
    }
  }

  // ── FOOTER CONFIGURATION (GET / POST) ───────────────────────────────────
  if (action === 'footer') {
    const DEFAULT_FOOTER_CONFIG = {
      sectionsTitle: 'Sections',
      enabledSections: null,
      exploreTitle: 'Explore the Privatian',
      explore: [
        { id: 'f-exp-1', label: 'Events', href: '/events', target: '_self', enabled: true },
        { id: 'f-exp-2', label: 'Article archive', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-3', label: 'About us', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-4', label: 'News+', href: '/', target: '_self', enabled: true },
        { id: 'f-exp-5', label: 'Podcast', href: '/', target: '_self', enabled: true }
      ],
      seriesTitle: 'Our recent series',
      series: [
        {
          id: 'f-ser-1',
          title: 'Wondering',
          href: '/section/findings',
          description: 'A series of profound questions explored by The Privatian Family experts.',
          enabled: true
        },
        {
          id: 'f-ser-2',
          title: 'Life | Heritage',
          href: '/section/community-heritage',
          description: 'A series focused on the personal side of Privatian family research and tradition.',
          enabled: true
        }
      ],
      socialTitle: 'Follow us on',
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
      tagline: 'The Official Publication of The Privatian Society — Cambridge, Massachusetts',
      copyright: '© 2026 The Privatian Family. All rights reserved.',
      bottomLinks: [
        { id: 'f-bot-1', label: 'For Media & Journalists', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-2', label: 'Family News & Archives', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-3', label: 'Digital Accessibility', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-4', label: 'Privacy Policy', href: '#', target: '_self', enabled: true },
        { id: 'f-bot-5', label: 'Trademark', href: '#', target: '_self', enabled: true }
      ]
    };

    if (req.method === 'GET') {
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'site_footer_config').maybeSingle();
        if (data && data.value) return res.status(200).json(data.value);
      } catch(e) {}

      // Fallback read from sections table
      try {
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__footer_config__').maybeSingle();
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

      let saved = false;
      try {
        const { error } = await sb.from('site_settings').upsert({
          key: 'site_footer_config',
          value: footerConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!error) saved = true;
      } catch(err) {}

      if (!saved) {
        // Fallback save in sections table
        try {
          const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__footer_config__').maybeSingle();
          if (existing) {
            await sb.from('sections').update({
              name: JSON.stringify(footerConfig),
              slug: '__footer_config__',
              display_order: 9996,
              is_active: false,
              locked: true,
              is_deleted: true
            }).eq('admin_id', '__footer_config__');
          } else {
            await sb.from('sections').insert({
              admin_id: '__footer_config__',
              name: JSON.stringify(footerConfig),
              slug: '__footer_config__',
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
      return res.status(200).json({ ok: true, data: footerConfig });
    }
  }

  // ── INDIVIDUAL SECTION CUSTOM CONFIGURATION (GET / POST) ────────────────
  if (action === 'section-config') {
    const slug = (req.query && req.query.slug) || (req.body && req.body.slug) || 'all';

    if (req.method === 'GET') {
      let allConfigs = {};
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'sections_custom_configs').maybeSingle();
        if (data && data.value && typeof data.value === 'object') {
          allConfigs = data.value;
        }
      } catch(e) {}

      if (Object.keys(allConfigs).length === 0) {
        try {
          const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__section_configs__').maybeSingle();
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
      let allConfigs = {};
      try {
        const { data } = await sb.from('site_settings').select('value').eq('key', 'sections_custom_configs').maybeSingle();
        if (data && data.value && typeof data.value === 'object') {
          allConfigs = data.value;
        }
      } catch(e) {}

      if (Object.keys(allConfigs).length === 0) {
        try {
          const { data: sData } = await sb.from('sections').select('name').eq('admin_id', '__section_configs__').maybeSingle();
          if (sData && sData.name) {
            const parsed = JSON.parse(sData.name);
            if (parsed && typeof parsed === 'object') allConfigs = parsed;
          }
        } catch(e) {}
      }

      allConfigs[slug] = {
        featuredArticleId: payload.featuredArticleId || null,
        selectedArticleIds: Array.isArray(payload.selectedArticleIds) ? payload.selectedArticleIds.slice(0, 4) : [],
        customTitle: payload.customTitle || '',
        description: payload.description || '',
        updatedAt: new Date().toISOString()
      };

      let saved = false;
      try {
        const { error } = await sb.from('site_settings').upsert({
          key: 'sections_custom_configs',
          value: allConfigs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!error) saved = true;
      } catch(err) {
        console.warn('[Sections config save error]:', err.message);
      }

      // Fallback save in sections table
      try {
        const { data: existing } = await sb.from('sections').select('id').eq('admin_id', '__section_configs__').maybeSingle();
        if (existing) {
          await sb.from('sections').update({
            name: JSON.stringify(allConfigs),
            slug: '__section_configs__',
            display_order: 9995,
            is_active: false,
            locked: true,
            is_deleted: true
          }).eq('admin_id', '__section_configs__');
        } else {
          await sb.from('sections').insert({
            admin_id: '__section_configs__',
            name: JSON.stringify(allConfigs),
            slug: '__section_configs__',
            display_order: 9995,
            is_active: false,
            locked: true,
            is_deleted: true
          });
        }
      } catch(err) {
        console.warn('[DB fallback section config save error]:', err.message);
      }

      return res.status(200).json({ ok: true, data: allConfigs[slug] });
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

    const rows = (data || []).filter(r => r.admin_id !== '__menu_config__' && r.admin_id !== '__header_config__' && r.admin_id !== '__homepage_config__' && r.admin_id !== '__footer_config__' && r.admin_id !== '__section_configs__');

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

    if (id === 'all' || id.toLowerCase() === 'all') {
      return res.status(400).json({ error: 'The "All" section is a permanent core section and cannot be deleted.' });
    }

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