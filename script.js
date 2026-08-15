// THE PRIVATIAN FAMILY — Main Page Script (index.html)
//
// Full Database-Driven & Bilingual Homepage Synchronization:
// 1. Instant zero-flash cache application from localStorage ('privatian_homepage_settings')
// 2. Bilingual rendering for English and Bengali
// 3. Background API fetch from /api/sections?action=homepage to update Supabase data in real time
// 4. Sections & All News columns live label synchronization

var _lastHomepageConfig = null;

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Immediate fallback from localStorage cache ─────────────────
  (function applyImmediateCache() {
    try {
      var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';
      var cached = localStorage.getItem(isBn ? 'privatian_homepage_settings_bn' : 'privatian_homepage_settings');
      if (cached) {
        var cfg = JSON.parse(cached);
        if (cfg && typeof cfg === 'object') {
          _lastHomepageConfig = cfg;
          applyHomepageConfig(cfg);
        }
      }
    } catch(e) {}
  })();

  // ── 2. Background live fetch from Supabase database ───────────────
  fetchHomepageConfigFromAPI();

  // ── 3. Listen for sections-loaded event for column slugs ──────────
  document.addEventListener('privatian:sections-loaded', function(e) {
    var sections = e && e.detail && e.detail.sections;
    if (sections) updateAllNewsLabels(sections);
  });

  // ── 4. Reactive language change listener ─────────────────────────
  document.addEventListener('privatian:language-changed', function() {
    var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';
    try {
      var cached = localStorage.getItem(isBn ? 'privatian_homepage_settings_bn' : 'privatian_homepage_settings');
      if (cached) {
        var cfg = JSON.parse(cached);
        if (cfg) {
          _lastHomepageConfig = cfg;
          applyHomepageConfig(cfg);
        }
      } else if (_lastHomepageConfig) {
        applyHomepageConfig(_lastHomepageConfig);
      }
    } catch(e) {
      if (_lastHomepageConfig) applyHomepageConfig(_lastHomepageConfig);
    }
    fetchHomepageConfigFromAPI();
    try {
      var rawSecs = localStorage.getItem('privatian_applied_sections') || localStorage.getItem('privatian_sections');
      if (rawSecs) {
        var d = JSON.parse(rawSecs);
        var sList = Array.isArray(d) ? d : (d.sections || []);
        updateAllNewsLabels(sList);
      }
    } catch(e) {}
  });

});

/**
 * Fetch persistent homepage configuration from API and apply to DOM.
 */
async function fetchHomepageConfigFromAPI() {
  try {
    var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';
    const res = await fetch('/api/sections?action=homepage' + (isBn ? '&lang=bn' : ''));
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg && typeof cfg === 'object') {
      _lastHomepageConfig = cfg;
      try {
        localStorage.setItem(isBn ? 'privatian_homepage_settings_bn' : 'privatian_homepage_settings', JSON.stringify(cfg));
      } catch(e) {}
      applyHomepageConfig(cfg);
    }
  } catch(err) {
    console.warn('[Privatian] Homepage config fetch fallback:', err.message);
  }
}

/**
 * Apply homepage configuration to DOM elements on index.html with bilingual support.
 */
function applyHomepageConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  _lastHomepageConfig = cfg;
  var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';
  var pick = function(en, bn) {
    if (window.PrivatianLang && window.PrivatianLang.pickLang) {
      return window.PrivatianLang.pickLang(en, bn);
    }
    return isBn ? (bn || en) : en;
  };

  // 1. Hero Section
  if (cfg.hero) {
    var main = cfg.hero.main;
    if (main) {
      var heroMainEl = document.querySelector('.hero-main');
      if (heroMainEl) {
        if (main.enabled === false) {
          heroMainEl.style.display = 'none';
        } else {
          heroMainEl.style.display = '';
          var heroImg = heroMainEl.querySelector('.hero-main-img');
          if (heroImg && main.imageUrl) heroImg.src = main.imageUrl;

          var heroLink = document.getElementById('hero-headline-link');
          if (heroLink) {
            var title = pick(main.title, main.title_bn);
            if (title) heroLink.textContent = title;
            if (main.href) heroLink.href = main.href;
          }

          var heroWrapLink = document.getElementById('hero-main-article-link');
          if (heroWrapLink && main.href) heroWrapLink.href = main.href;

          var heroSub = heroMainEl.querySelector('.hero-subtitle');
          if (heroSub) {
            var sub = pick(main.subtitle, main.subtitle_bn);
            if (sub !== undefined) heroSub.textContent = sub;
          }
        }
      }
    }

    var sidebar = cfg.hero.sidebar;
    if (Array.isArray(sidebar)) {
      sidebar.forEach(function(s, idx) {
        var sideEl = document.getElementById('hero-sidebar-' + (idx + 1));
        if (sideEl) {
          if (s.enabled === false) {
            sideEl.style.display = 'none';
          } else {
            sideEl.style.display = '';
            var sImg = sideEl.querySelector('.hero-sidebar-img');
            if (sImg && s.imageUrl) sImg.src = s.imageUrl;

            var sTitle = sideEl.querySelector('.hero-sidebar-title');
            var title = pick(s.title, s.title_bn);
            if (sTitle && title) sTitle.textContent = title;

            var sDesc = sideEl.querySelector('.hero-sidebar-desc');
            var desc = pick(s.description, s.description_bn);
            if (sDesc && desc !== undefined) sDesc.textContent = desc;

            var sLink = document.getElementById('hero-sidebar-link-' + (idx + 1));
            if (sLink && s.href) sLink.href = s.href;

            var sTag = sideEl.querySelector('.hero-sidebar-tag');
            if (sTag) {
              var tag = pick(s.tag, s.tag_bn);
              if (tag) {
                sTag.style.display = '';
                sTag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ` + escapeHtmlText(tag);
              } else {
                sTag.style.display = 'none';
              }
            }
          }
        }
      });
    }
  }

  // 2. Small Articles (3 Cards)
  if (Array.isArray(cfg.smallArticles)) {
    cfg.smallArticles.forEach(function(card, idx) {
      var cardEl = document.getElementById('small-article-' + (idx + 1));
      if (cardEl) {
        if (card.enabled === false) {
          cardEl.style.display = 'none';
        } else {
          cardEl.style.display = '';
          var cImg = cardEl.querySelector('.small-article-img');
          if (cImg && card.imageUrl) cImg.src = card.imageUrl;

          var cTitle = cardEl.querySelector('.small-article-title');
          var title = pick(card.title, card.title_bn);
          if (cTitle && title) cTitle.textContent = title;

          var cLink = document.getElementById('small-article-link-' + (idx + 1));
          if (cLink && card.href) cLink.href = card.href;
        }
      }
    });
  }

  // 3. Events Panel & Featured Spotlight
  if (cfg.eventsSection) {
    var evSec = cfg.eventsSection;
    var evPanel = document.getElementById('events-panel');
    if (evPanel) {
      var headingEl = evPanel.querySelector('.section-heading-label');
      var eventsHeading = pick(evSec.eventsHeading || 'Upcoming Events', evSec.eventsHeading_bn || (window.PrivatianLang ? window.PrivatianLang.t('upcomingEvents') : 'আসন্ন অনুষ্ঠানসমূহ'));
      if (headingEl && eventsHeading) headingEl.textContent = eventsHeading;

      var seeAllEl = document.getElementById('see-all-events-link');
      var seeAllText = pick(evSec.seeAllText || 'See all events', evSec.seeAllText_bn || (window.PrivatianLang ? window.PrivatianLang.t('seeAllEvents') : 'সকল অনুষ্ঠান দেখুন'));
      if (seeAllEl) {
        if (seeAllText) seeAllEl.textContent = seeAllText;
        if (evSec.seeAllHref) seeAllEl.href = evSec.seeAllHref;
      }

      var events = evSec.events;
      if (Array.isArray(events)) {
        var activeEvents = events.filter(function(ev) { return ev && ev.enabled !== false; });
        var top2Events = activeEvents.slice(0, 2); // Show strictly top 2 active events on homepage
        var eventsListHtml = '';
        top2Events.forEach(function(ev, idx) {
          if (idx > 0 && eventsListHtml) eventsListHtml += '<hr class="event-divider" />';
          var eDate = isBn ? (ev.date_bn || (window.PrivatianLang ? window.PrivatianLang.toBengaliNumber(ev.date) : ev.date)) : (ev.date || '');
          var eTitle = pick(ev.title, ev.title_bn);
          var eMeta = pick(ev.meta, ev.meta_bn);
          eventsListHtml += `
            <div class="event-item" id="event-item-${idx + 1}">
              <div class="event-date">${escapeHtmlText(eDate)}</div>
              <div class="event-body">
                <h3 class="event-title">${escapeHtmlText(eTitle)}</h3>
                <p class="event-meta">${escapeHtmlText(eMeta)}</p>
              </div>
            </div>
          `;
        });
        if (eventsListHtml) {
          // Replace existing event items while keeping heading and see all link
          var oldItems = evPanel.querySelectorAll('.event-item, .event-divider');
          oldItems.forEach(function(el) { el.remove(); });
          if (seeAllEl) {
            seeAllEl.href = evSec.seeAllHref || '/events';
            seeAllEl.textContent = seeAllText;
            seeAllEl.insertAdjacentHTML('beforebegin', eventsListHtml);
          }
        }
      }
    }

    var feat = evSec.featured;
    var featEl = document.getElementById('events-featured-article');
    if (featEl && feat) {
      if (feat.enabled === false) {
        featEl.style.display = 'none';
      } else {
        featEl.style.display = '';
        var fImg = featEl.querySelector('.events-featured-img');
        if (fImg && feat.imageUrl) fImg.src = feat.imageUrl;

        var fTitle = featEl.querySelector('.events-featured-title');
        var featTitle = pick(feat.title, feat.title_bn);
        if (fTitle && featTitle) fTitle.textContent = featTitle;

        var fDesc = featEl.querySelector('.events-featured-desc');
        var featDesc = pick(feat.description, feat.description_bn);
        if (fDesc && featDesc !== undefined) fDesc.textContent = featDesc;

        var fLink = document.getElementById('events-featured-link');
        if (fLink && feat.href) fLink.href = feat.href;
      }
    }
  }

  // 4. All News Sections (6 Columns)
  if (cfg.allNews) {
    var allNewsHeadingEl = document.querySelector('.all-news-heading');
    if (allNewsHeadingEl) {
      var allNewsH = pick(cfg.allNews.heading || 'All News', cfg.allNews.heading_bn || (window.PrivatianLang ? window.PrivatianLang.t('allNews') : 'সকল খবর'));
      allNewsHeadingEl.textContent = allNewsH;
    }

    var cols = cfg.allNews.columns;
    if (Array.isArray(cols)) {
      var allColEls = document.querySelectorAll('.news-column');
      cols.forEach(function(col, idx) {
        var colEl = allColEls[idx];
        if (!colEl) return;

        // Label
        var lbl = colEl.querySelector('.news-col-label');
        var colLabel = pick(col.label, col.label_bn);
        if (lbl && colLabel) lbl.textContent = colLabel.toUpperCase();
        if (col.sectionSlug) colEl.setAttribute('data-section-slug', col.sectionSlug);

        // Lead story
        if (col.lead) {
          var lead = col.lead;
          var leadImg = colEl.querySelector('.news-main-img');
          if (leadImg && lead.imageUrl) leadImg.src = lead.imageUrl;

          var leadTitle = colEl.querySelector('.news-main-title');
          var lTitle = pick(lead.title, lead.title_bn);
          if (leadTitle && lTitle) leadTitle.textContent = lTitle;

          var leadLink = colEl.querySelector('.news-main-article a');
          if (leadLink && lead.href) leadLink.href = lead.href;
        }

        // Sub articles
        if (Array.isArray(col.subArticles)) {
          var subListEl = colEl.querySelector('.news-sub-list');
          if (subListEl) {
            var subHtml = '';
            col.subArticles.forEach(function(sub, sIdx) {
              if (sub.enabled === false) return;
              if (sIdx > 0) subHtml += '<hr class="news-divider" />';
              var sTitle = pick(sub.title, sub.title_bn);
              subHtml += `<article class="news-sub-item"><a href="${escapeHtmlText(sub.href || '#')}">${escapeHtmlText(sTitle)}</a></article>`;
            });
            if (subHtml) subListEl.innerHTML = subHtml;
          }
        }
      });
    }
  }
}

function escapeHtmlText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Update All News column labels and visibility from a sections array with bilingual support.
 */
function updateAllNewsLabels(sections) {
  if (!Array.isArray(sections)) return;
  var cols = document.querySelectorAll('.news-column[data-section-slug]');
  if (!cols.length) return;
  var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';

  cols.forEach(function(col) {
    var slug = col.getAttribute('data-section-slug');
    if (!slug) return;

    var sec = null;
    for (var i = 0; i < sections.length; i++) {
      if ((sections[i].slug || sections[i].id) === slug) { sec = sections[i]; break; }
    }

    var labelEl = col.querySelector('.news-col-label');

    if (!sec) {
      col.hidden = true;
      col.setAttribute('aria-hidden', 'true');
      return;
    }

    col.hidden = false;
    col.removeAttribute('aria-hidden');

    if (labelEl) {
      var name = isBn ? (sec.name_bn || sec.name) : sec.name;
      labelEl.textContent = (name || '').toUpperCase();
    }

    col.querySelectorAll('a.news-section-link').forEach(function(a) {
      a.href = '/section/' + sec.slug;
    });
  });
}