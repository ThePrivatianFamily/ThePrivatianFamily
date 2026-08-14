// THE PRIVATIAN FAMILY — Main Page Script (index.html)
//
// Full Database-Driven Homepage Synchronization:
// 1. Instant zero-flash cache application from localStorage ('privatian_homepage_settings')
// 2. Background API fetch from /api/sections?action=homepage to update Supabase data in real time
// 3. Sections & All News columns live label synchronization

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Immediate fallback from localStorage cache ─────────────────
  (function applyImmediateCache() {
    try {
      var cached = localStorage.getItem('privatian_homepage_settings');
      if (cached) {
        var cfg = JSON.parse(cached);
        if (cfg && typeof cfg === 'object') applyHomepageConfig(cfg);
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

});

/**
 * Fetch persistent homepage configuration from API and apply to DOM.
 */
async function fetchHomepageConfigFromAPI() {
  try {
    const res = await fetch('/api/sections?action=homepage');
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg && typeof cfg === 'object') {
      try {
        localStorage.setItem('privatian_homepage_settings', JSON.stringify(cfg));
      } catch(e) {}
      applyHomepageConfig(cfg);
    }
  } catch(err) {
    console.warn('[Privatian] Homepage config fetch fallback:', err.message);
  }
}

/**
 * Apply homepage configuration to DOM elements on index.html.
 */
function applyHomepageConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;

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
            if (main.title) heroLink.textContent = main.title;
            if (main.href) heroLink.href = main.href;
          }

          var heroWrapLink = document.getElementById('hero-main-article-link');
          if (heroWrapLink && main.href) heroWrapLink.href = main.href;

          var heroSub = heroMainEl.querySelector('.hero-subtitle');
          if (heroSub && main.subtitle !== undefined) heroSub.textContent = main.subtitle;
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
            if (sTitle && s.title) sTitle.textContent = s.title;

            var sDesc = sideEl.querySelector('.hero-sidebar-desc');
            if (sDesc && s.description !== undefined) sDesc.textContent = s.description;

            var sLink = document.getElementById('hero-sidebar-link-' + (idx + 1));
            if (sLink && s.href) sLink.href = s.href;

            var sTag = sideEl.querySelector('.hero-sidebar-tag');
            if (sTag) {
              if (s.tag) {
                sTag.style.display = '';
                sTag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ` + escapeHtmlText(s.tag);
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
          if (cTitle && card.title) cTitle.textContent = card.title;

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
      if (headingEl && evSec.eventsHeading) headingEl.textContent = evSec.eventsHeading;

      var seeAllEl = document.getElementById('see-all-events-link');
      if (seeAllEl) {
        if (evSec.seeAllText) seeAllEl.textContent = evSec.seeAllText;
        if (evSec.seeAllHref) seeAllEl.href = evSec.seeAllHref;
      }

      var events = evSec.events;
      if (Array.isArray(events)) {
        var eventsListHtml = '';
        events.forEach(function(ev, idx) {
          if (ev.enabled === false) return;
          if (idx > 0 && eventsListHtml) eventsListHtml += '<hr class="event-divider" />';
          eventsListHtml += `
            <div class="event-item" id="event-item-${idx + 1}">
              <div class="event-date">${escapeHtmlText(ev.date || '')}</div>
              <div class="event-body">
                <h3 class="event-title">${escapeHtmlText(ev.title || '')}</h3>
                <p class="event-meta">${escapeHtmlText(ev.meta || '')}</p>
              </div>
            </div>
          `;
        });
        if (eventsListHtml) {
          // Replace existing event items while keeping heading and see all link
          var oldItems = evPanel.querySelectorAll('.event-item, .event-divider');
          oldItems.forEach(function(el) { el.remove(); });
          if (seeAllEl) {
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
        if (fTitle && feat.title) fTitle.textContent = feat.title;

        var fDesc = featEl.querySelector('.events-featured-desc');
        if (fDesc && feat.description !== undefined) fDesc.textContent = feat.description;

        var fLink = document.getElementById('events-featured-link');
        if (fLink && feat.href) fLink.href = feat.href;
      }
    }
  }

  // 4. All News Sections (6 Columns)
  if (cfg.allNews) {
    var allNewsHeadingEl = document.querySelector('.all-news-heading');
    if (allNewsHeadingEl && cfg.allNews.heading) {
      allNewsHeadingEl.textContent = cfg.allNews.heading;
    }

    var cols = cfg.allNews.columns;
    if (Array.isArray(cols)) {
      var allColEls = document.querySelectorAll('.news-column');
      cols.forEach(function(col, idx) {
        var colEl = allColEls[idx];
        if (!colEl) return;

        // Label
        var lbl = colEl.querySelector('.news-col-label');
        if (lbl && col.label) lbl.textContent = col.label.toUpperCase();
        if (col.sectionSlug) colEl.setAttribute('data-section-slug', col.sectionSlug);

        // Lead story
        if (col.lead) {
          var lead = col.lead;
          var leadImg = colEl.querySelector('.news-main-img');
          if (leadImg && lead.imageUrl) leadImg.src = lead.imageUrl;

          var leadTitle = colEl.querySelector('.news-main-title');
          if (leadTitle && lead.title) leadTitle.textContent = lead.title;

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
              subHtml += `<article class="news-sub-item"><a href="${escapeHtmlText(sub.href || '#')}">${escapeHtmlText(sub.title || '')}</a></article>`;
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
 * Update All News column labels and visibility from a sections array.
 */
function updateAllNewsLabels(sections) {
  if (!Array.isArray(sections)) return;
  var cols = document.querySelectorAll('.news-column[data-section-slug]');
  if (!cols.length) return;

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
      labelEl.textContent = sec.name.toUpperCase();
    }

    col.querySelectorAll('a.news-section-link').forEach(function(a) {
      a.href = 'section.html?slug=' + sec.slug;
    });
  });
}