// THE PRIVATIAN FAMILY — Main Page Script (index.html)
//
// Architecture:
//   1. components.js renders the header/nav instantly from localStorage (no flash)
//   2. components.js then fetches /api/sections async, updates localStorage & re-renders nav
//   3. This script handles ALL NEWS label initialization and the sections-loaded event
//
// All News label lifecycle:
//   - HTML has hardcoded fallback labels (shown instantly, no blank flash)
//   - data-section-slug attributes connect each column to a section slug
//   - When privatian:sections-loaded fires, labels are updated from live DB
//   - Deleted sections: their column is hidden gracefully

document.addEventListener('DOMContentLoaded', function () {

  // ── Immediate fallback: update labels from localStorage cache ──────
  // This runs synchronously so labels are correct even before API responds.
  (function applyLocalStorageSections() {
    var APPLIED_KEY = 'privatian_applied_sections';
    var SECTIONS_KEY = 'privatian_sections';
    try {
      var raw = localStorage.getItem(APPLIED_KEY) || localStorage.getItem(SECTIONS_KEY);
      if (!raw) return;
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      updateAllNewsLabels(list);
    } catch(e) { /* silent fallback to hardcoded HTML */ }
  })();

  // ── Listen for live API data from components.js ────────────────────
  document.addEventListener('privatian:sections-loaded', function(e) {
    var sections = e && e.detail && e.detail.sections;
    if (sections) updateAllNewsLabels(sections);
  });

});

/**
 * Update All News column labels and visibility from a sections array.
 * Each .news-column with a data-section-slug attribute is mapped to a section.
 * If the section is not found (deleted), the column is hidden gracefully.
 *
 * @param {Array} sections - array of { name, slug } objects
 */
function updateAllNewsLabels(sections) {
  if (!Array.isArray(sections)) return;
  var cols = document.querySelectorAll('.news-column[data-section-slug]');
  if (!cols.length) return;

  cols.forEach(function(col) {
    var slug = col.getAttribute('data-section-slug');
    if (!slug) return;

    // Find the matching section by slug
    var sec = null;
    for (var i = 0; i < sections.length; i++) {
      if ((sections[i].slug || sections[i].id) === slug) { sec = sections[i]; break; }
    }

    var labelEl = col.querySelector('.news-col-label');

    if (!sec) {
      // Section deleted or inactive — hide column
      col.hidden = true;
      col.setAttribute('aria-hidden', 'true');
      return;
    }

    // Restore if it was previously hidden
    col.hidden = false;
    col.removeAttribute('aria-hidden');

    // Update label text to reflect current section name from DB
    if (labelEl) {
      labelEl.textContent = sec.name.toUpperCase();
    }

    // Update any section-link hrefs in this column
    col.querySelectorAll('a.news-section-link').forEach(function(a) {
      a.href = 'section.html?slug=' + sec.slug;
    });
  });
}