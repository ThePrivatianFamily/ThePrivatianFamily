/* =================================================================
   THE PRIVATIAN FAMILY - ADMIN JS
   Sections CRUD - Supabase API - Toast - Modal
================================================================= */

// ── Global State Variables (Hoisted to prevent TDZ ReferenceErrors) ──
var sections = [];
var currentTab = 'active';
var activeTab = 'active';
var _currentAdminPage = 'dashboard';
var _allArticles = [];
var _currentArticlesView = 'active';
var _hsInstance = null;
var appliedHeaderConfig = null;
var headerDraftConfig = null;
var appliedMenuConfig = null;
var menuDraftConfig = null;
var menuUndoStack = [];
var menuRedoStack = [];
var appliedHomepageConfig = null;
var homepageDraftConfig = null;
var homepageUndoStack = [];
var homepageRedoStack = [];
var homepageArticlesList = [];
var activeHpTab = 'canvas';
var appliedFooterConfig = null;
var footerDraftConfig = null;
var footerUndoStack = [];
var footerRedoStack = [];
var _activeFooterTab = 'preview';
var _lastAccessCheck = 0;
var _accessRevoked = false;

var HEADER_SETTINGS_KEY = 'privatian_header_settings';

var DEFAULT_HEADER_SUBSECTIONS_EN = [
  { id: 'sub-1', label: 'FAMILY LEGACY', href: '/section/community-heritage', icon: null, enabled: true },
  { id: 'sub-2', label: 'EXPERIENCE', href: '/section/culture', icon: null, enabled: true },
  { id: 'sub-3', label: 'THE PRIVATIAN READS', href: '/section/findings', icon: null, enabled: true },
  { id: 'sub-4', label: 'EVENTS', href: '/events', icon: 'calendar', enabled: true }
];

var DEFAULT_HEADER_SUBSECTIONS_BN = [
  { id: 'sub-1', label: 'পারিবারিক ঐতিহ্য', href: '/section/community-heritage', icon: null, enabled: true },
  { id: 'sub-2', label: 'অভিজ্ঞতা', href: '/section/culture', icon: null, enabled: true },
  { id: 'sub-3', label: 'প্রাইভেটিয়ান পাঠ', href: '/section/findings', icon: null, enabled: true },
  { id: 'sub-4', label: 'ইভেন্ট ও আয়োজন', href: '/events', icon: 'calendar', enabled: true }
];

var DEFAULT_HEADER_SETTINGS_EN = {
  siteTitle: 'The Privatian Family',
  tabTagline: 'Insights, Stories & Heritage',
  browserTabTitle: 'The Privatian Family — Insights, Stories & Heritage',
  metaDescription: 'The Official Publication of The Privatian Society — Cambridge, Massachusetts.',
  faviconUrl: '',
  cloudflareAnalyticsToken: 'ce994487070d403ba18f466602524948',
  logoSvg: null,
  logoHeight: 80,
  enabledNavSections: null,
  subsections: DEFAULT_HEADER_SUBSECTIONS_EN.map(s => ({...s}))
};

var DEFAULT_HEADER_SETTINGS_BN = {
  siteTitle: 'দ্য প্রাইভেটিয়ান ফ্যামিলি',
  tabTagline: 'জ্ঞান, ঐতিহ্য ও জীবনের কথা',
  browserTabTitle: 'দ্য প্রাইভেটিয়ান ফ্যামিলি — জ্ঞান, ঐতিহ্য ও জীবনের কথা',
  metaDescription: 'দ্য প্রাইভেটিয়ান সোসাইটির অফিশিয়াল প্রকাশনা — ক্যামব্রিজ, ম্যাসাচুসেটস।',
  faviconUrl: '',
  cloudflareAnalyticsToken: 'ce994487070d403ba18f466602524948',
  logoSvg: null,
  logoHeight: 80,
  enabledNavSections: null,
  subsections: DEFAULT_HEADER_SUBSECTIONS_BN.map(s => ({...s}))
};

function getHeaderDefaultSettings(lang) {
  const isBn = (lang === 'bn');
  return JSON.parse(JSON.stringify(isBn ? DEFAULT_HEADER_SETTINGS_BN : DEFAULT_HEADER_SETTINGS_EN));
}

// -- Authentication & API helpers --
function _getAuthToken() {
  return window.PRIVATIAN_TOKEN || localStorage.getItem('privatian_token') || '';
}

function _authHeaders() {
  const tok = _getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(tok ? { 'Authorization': 'Bearer ' + tok } : {})
  };
}

async function _apiGet(url) {
  const tok = _getAuthToken();
  const headers = tok ? { 'Authorization': 'Bearer ' + tok } : {};
  const r = await fetch(url, { headers });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

async function _apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: _authHeaders(), body: JSON.stringify(body) });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

async function _apiPut(url, body) {
  const r = await fetch(url, { method: 'PUT', headers: _authHeaders(), body: JSON.stringify(body) });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

async function _apiPatch(url, body) {
  const r = await fetch(url, { method: 'PATCH', headers: _authHeaders(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

async function _apiDelete(url) {
  const tok = _getAuthToken();
  const headers = tok ? { 'Authorization': 'Bearer ' + tok } : {};
  const r = await fetch(url, { method: 'DELETE', headers });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

// ── Universal Micro-Activity Logger ──────────────────────────────────────
async function recordActivityLog({ action, category = 'general', summary, target_id = null, target_name = null, details = {} }) {
  if (!action || !summary) return;
  try {
    const payload = {
      action,
      category,
      summary,
      target_id: target_id ? String(target_id) : null,
      target_name: target_name ? String(target_name) : null,
      details: {
        ...details,
        url: window.location.href,
        clientTime: new Date().toISOString()
      }
    };
    await _apiPost('/api/activity-log?action=log', payload).catch(() => {});
  } catch(e) {}
}
window.recordActivityLog = recordActivityLog;

// ── INDEPENDENT SECTION-BY-SECTION LANGUAGE CONTROLS (EN / BN) ───────────
var _sectionsLang = localStorage.getItem('privatian_admin_lang_sections') || 'en';
var _headerLang   = localStorage.getItem('privatian_admin_lang_header')   || 'en';
var _menuLang     = localStorage.getItem('privatian_admin_lang_menu')     || 'en';
var _homepageLang = localStorage.getItem('privatian_admin_lang_homepage') || 'en';
var _footerLang   = localStorage.getItem('privatian_admin_lang_footer')   || 'en';

window.getSectionLang  = () => _sectionsLang  || 'en';
window.getHeaderLang    = () => _headerLang    || 'en';
window.getMenuLang      = () => _menuLang      || 'en';
window.getHomepageLang  = () => _homepageLang  || 'en';
window.getFooterLang    = () => _footerLang    || 'en';

function updateSectionLangUI() {
  const en = document.getElementById('sec-lang-en');
  const bn = document.getElementById('sec-lang-bn');
  if (en) en.classList.toggle('active', _sectionsLang === 'en');
  if (bn) bn.classList.toggle('active', _sectionsLang === 'bn');
}

function updateHeaderLangUI() {
  const en = document.getElementById('hd-lang-en');
  const bn = document.getElementById('hd-lang-bn');
  if (en) en.classList.toggle('active', _headerLang === 'en');
  if (bn) bn.classList.toggle('active', _headerLang === 'bn');
}

function updateMenuLangUI() {
  const en = document.getElementById('menu-lang-en');
  const bn = document.getElementById('menu-lang-bn');
  if (en) en.classList.toggle('active', _menuLang === 'en');
  if (bn) bn.classList.toggle('active', _menuLang === 'bn');
}

function updateHomepageLangUI() {
  const en = document.getElementById('hp-lang-en');
  const bn = document.getElementById('hp-lang-bn');
  if (en) en.classList.toggle('active', _homepageLang === 'en');
  if (bn) bn.classList.toggle('active', _homepageLang === 'bn');
}

function updateFooterLangUI() {
  const en = document.getElementById('ft-lang-en');
  const bn = document.getElementById('ft-lang-bn');
  if (en) en.classList.toggle('active', _footerLang === 'en');
  if (bn) bn.classList.toggle('active', _footerLang === 'bn');
}

function updateAllAdminLangButtons() {
  updateSectionLangUI();
  updateHeaderLangUI();
  updateMenuLangUI();
  updateHomepageLangUI();
  updateFooterLangUI();
}

window.setSectionLang = function(lang) {
  _sectionsLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_lang_sections', _sectionsLang); } catch(e) {}
  updateSectionLangUI();
  if (typeof showToast === 'function') {
    showToast('info', _sectionsLang === 'bn' ? 'Sections editor switched to Bengali (বাংলা)' : 'Sections editor switched to English');
  }
  if (typeof loadSectionsFromAPI === 'function') loadSectionsFromAPI();
};

window.setHeaderLang = function(lang) {
  _headerLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_lang_header', _headerLang); } catch(e) {}
  updateHeaderLangUI();
  if (typeof showToast === 'function') {
    showToast('info', _headerLang === 'bn' ? 'Header editor switched to Bengali (বাংলা)' : 'Header editor switched to English');
  }
  if (typeof initHeaderPage === 'function') initHeaderPage();
};

window.setMenuLang = function(lang) {
  _menuLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_lang_menu', _menuLang); } catch(e) {}
  updateMenuLangUI();
  if (typeof showToast === 'function') {
    showToast('info', _menuLang === 'bn' ? 'Navigation Menu editor switched to Bengali (বাংলা)' : 'Navigation Menu editor switched to English');
  }
  if (typeof initMenuPage === 'function') initMenuPage();
};

window.setHomepageLang = function(lang) {
  _homepageLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_lang_homepage', _homepageLang); } catch(e) {}
  updateHomepageLangUI();
  if (typeof showToast === 'function') {
    showToast('info', _homepageLang === 'bn' ? 'Homepage editor switched to Bengali (বাংলা)' : 'Homepage editor switched to English');
  }
  if (typeof initHomepagePage === 'function') initHomepagePage();
};

window.setFooterLang = function(lang) {
  _footerLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_lang_footer', _footerLang); } catch(e) {}
  updateFooterLangUI();
  if (typeof showToast === 'function') {
    showToast('info', _footerLang === 'bn' ? 'Footer editor switched to Bengali (বাংলা)' : 'Footer editor switched to English');
  }
  if (typeof initFooterPage === 'function') initFooterPage();
};

// Backwards compatibility alias
window.setAdminContentLang = function(lang, targetSec) {
  const sec = targetSec || _currentAdminPage;
  if (sec === 'header') window.setHeaderLang(lang);
  else if (sec === 'sections') window.setSectionLang(lang);
  else if (sec === 'menu') window.setMenuLang(lang);
  else if (sec === 'homepage') window.setHomepageLang(lang);
  else if (sec === 'footer') window.setFooterLang(lang);
  else window.setHeaderLang(lang);
};

document.addEventListener('DOMContentLoaded', () => {
  updateAllAdminLangButtons();
});

// -- Core "All" section (always available, editable, permanent/cannot be deleted) --
const ALL_SECTION = {
  id: 'all', name: 'All', name_bn: 'সকল', slug: '', locked: false, isPermanent: true,
  deleted: false, createdAt: '2024-01-01T00:00:00Z'
};

// -- Load all sections (active + trashed) from API / Supabase --
async function loadSectionsFromAPI() {
  updateGlobalSyncStatus('syncing', 'Loading sections from database...');
  let loaded = null;

  const isSystemConfig = r => {
    const adminId = r.admin_id || r.id || '';
    const slug = r.slug || '';
    const name = r.name || '';
    return adminId.startsWith('__') || 
           slug.startsWith('__') || 
           adminId.endsWith('_config__') || 
           name.startsWith('{') ||
           ['__homepage_config__', '__header_config__', '__menu_config__', '__footer_config__', '__section_configs__', '__activity_logs_store__'].includes(adminId);
  };

  try {
    const data = await _apiGet('/api/sections?status=all');
    if (Array.isArray(data)) {
      const allRow = data.find(r => (r.admin_id === 'all' || r.id === 'all' || r.slug === ''));
      if (allRow) {
        ALL_SECTION.name = allRow.name || 'All';
        ALL_SECTION.name_bn = allRow.name_bn || 'সকল';
        ALL_SECTION.slug = allRow.slug || '';
      }
      loaded = data.filter(r => !isSystemConfig(r)).map(r => ({
        id:        r.id || r.admin_id || r.slug,
        name:      r.name,
        name_bn:   r.name_bn || '',
        slug:      r.slug || '',
        locked:    r.locked || false,
        deleted:   r.deleted || r.is_deleted || false,
        deletedAt: r.deletedAt || r.deleted_at || null,
        createdAt: r.createdAt || r.created_at || new Date().toISOString()
      }));
    }
  } catch(e) {
    console.warn('[Admin] loadSectionsFromAPI endpoint failed, trying Supabase direct:', e.message);
  }

  if (!loaded) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { data, error } = await sb.from('sections').select('*').order('display_order');
        if (!error && Array.isArray(data)) {
          loaded = data.filter(r => !isSystemConfig(r)).map(r => ({
            id:        r.admin_id || r.slug,
            name:      r.name,
            name_bn:   r.name_bn || '',
            slug:      r.slug || '',
            locked:    r.locked || false,
            deleted:   r.is_deleted || false,
            deletedAt: r.deleted_at || null,
            createdAt: r.created_at || new Date().toISOString()
          }));
        }
      }
    } catch(err) {}
  }

  if (!loaded) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/sections?select=*&order=display_order.asc`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            loaded = data.filter(r => !isSystemConfig(r)).map(r => ({
              id:        r.admin_id || r.slug,
              name:      r.name,
              name_bn:   r.name_bn || '',
              slug:      r.slug || '',
              locked:    r.locked || false,
              deleted:   r.is_deleted || false,
              deletedAt: r.deleted_at || null,
              createdAt: r.created_at || new Date().toISOString()
            }));
          }
        }
      }
    } catch(err) {}
  }

  if (loaded) {
    sections = [ALL_SECTION, ...loaded];
    render();
    updateGlobalSyncStatus('synced', 'Synced with database');
  } else {
    sections = [ALL_SECTION];
    render();
    updateGlobalSyncStatus('error', 'Sync error (offline/cache)');
  }

  // Refresh dependent tabs if currently open
  if (_currentAdminPage === 'footer' && typeof refreshActiveFooterTab === 'function') {
    refreshActiveFooterTab();
  }
}


// -- SVG icons --
const ICONS = {
  pencil:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`,
  xCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  lock:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  plus:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`,
  warn:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  xSmall:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  upload:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
};
function genId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
}

function genSlug(name) {
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function validateSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── State ────────────────────────────────────────────────────────
editingId  = null;   // for modal edit mode
pendingDeleteId = null;  // for confirm modal
undoTimer  = null;

// â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sectionsTable  = document.getElementById('sections-tbody');
const trashTable     = document.getElementById('trash-tbody');
const countActive    = document.getElementById('count-active');
const countTrash     = document.getElementById('count-trash');
const tabActiveBtn   = document.getElementById('tab-active');
const tabTrashBtn    = document.getElementById('tab-trash');
const panelActive    = document.getElementById('panel-active');
const panelTrash     = document.getElementById('panel-trash');
const activeEmpty    = document.getElementById('active-empty');
const trashEmpty     = document.getElementById('trash-empty');
const topbarActions  = document.getElementById('topbar-actions');
const toastContainer = document.getElementById('toast-container');

// Modal — add/edit
const modalOverlay   = document.getElementById('modal-overlay');
const modalTitle     = document.getElementById('modal-title');
const modalSaveBtn   = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const nameInput      = document.getElementById('section-name-input');
const modalError     = document.getElementById('modal-error');

// Modal — confirm delete
const confirmOverlay    = document.getElementById('confirm-overlay');
const confirmTitle      = document.getElementById('confirm-title');
const confirmSectionName= document.getElementById('confirm-section-name');
const confirmDeleteBtn  = document.getElementById('confirm-delete-btn');
const confirmCancelBtn  = document.getElementById('confirm-cancel-btn');

// â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function render() {
  const active = sections.filter(s => !s.deleted);
  const trash  = sections.filter(s =>  s.deleted);

  countActive.textContent = active.length;
  countTrash.textContent  = trash.length;

  renderActive(active);
  renderTrash(trash);
}

function renderActive(active) {
  if (!sectionsTable) return;
  sectionsTable.innerHTML = '';

  if (!active || active.length === 0) {
    if (activeEmpty) {
      activeEmpty.hidden = false;
      activeEmpty.style.display = 'flex';
    }
    return;
  }
  if (activeEmpty) {
    activeEmpty.hidden = true;
    activeEmpty.style.display = 'none';
  }

  // Pin "All" first
  const sorted = [
    ...active.filter(s => s.id === 'all'),
    ...active.filter(s => s.id !== 'all'),
  ];

  // Populate Section Quick Studio Picker
  const quickPicker = document.getElementById('section-quick-picker');
  if (quickPicker) {
    quickPicker.innerHTML = '<option value="">Choose a section to edit…</option>' +
      sorted.map(s => {
        const lbl = (_sectionsLang === 'bn' && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
        return `<option value="${s.id}">${escapeHtml(lbl)} (${s.slug ? '/section/' + s.slug : '/'})</option>`;
      }).join('');
  }

  sorted.forEach(s => {
    const isPermanent = s.id === 'all' || s.isPermanent;
    const tr = document.createElement('tr');
    const nameHtml = (_sectionsLang === 'bn' && s.name_bn)
      ? `<strong>${escapeHtml(s.name_bn)}</strong> <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">(${escapeHtml(s.name)})</span>`
      : (s.name_bn
          ? `${escapeHtml(s.name)} <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">[${escapeHtml(s.name_bn)}]</span>`
          : escapeHtml(s.name)
        );

    tr.innerHTML = `
      <td>
        <div class="section-name-cell">
          <span class="section-name-text">${nameHtml}</span>
        </div>
      </td>
      <td class="col-slug">
        ${s.slug
            ? `<span class="section-slug-cell" title="/section/${escapeHtml(s.slug)}">${escapeHtml(s.slug)}</span>`
            : (isPermanent
                ? '<span class="section-slug-cell" title="/">(all articles)</span>'
                : '<span class="section-slug-cell--empty">not set</span>'
              )
        }
      </td>
      <td class="articles-count articles-count--dash col-articles">—</td>
      <td class="created-date">${formatDate(s.createdAt)}</td>
      <td>
        <span class="badge badge--active">Active</span>
      </td>
      <td>
        <div class="action-group">
          <button class="action-btn action-btn--edit" data-id="${s.id}" title="Edit Section &amp; Layout" aria-label="Edit ${escapeHtml(s.name)}">${ICONS.pencil}</button>
          ${!isPermanent ? `
            <button class="action-btn action-btn--delete" data-id="${s.id}" title="Move to trash" aria-label="Delete ${escapeHtml(s.name)}">${ICONS.trash}</button>
          ` : `
            <button class="action-btn" disabled style="opacity:0.25;cursor:not-allowed;" title="Permanent core section (cannot be deleted)" aria-label="Cannot delete">${ICONS.trash}</button>
          `}
        </div>
      </td>
    `;
    sectionsTable.appendChild(tr);
  });

  // Bind row actions
  sectionsTable.querySelectorAll('.action-btn--edit').forEach(btn => {
    btn.addEventListener('click', () => openSectionStudio(btn.dataset.id));
  });
  sectionsTable.querySelectorAll('.action-btn--delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSectionConfirm(btn.dataset.id));
  });
}

function renderTrash(trash) {
  if (!trashTable) return;
  trashTable.innerHTML = '';

  if (!trash || trash.length === 0) {
    if (trashEmpty) {
      trashEmpty.hidden = false;
      trashEmpty.style.display = 'flex';
    }
    return;
  }
  if (trashEmpty) {
    trashEmpty.hidden = true;
    trashEmpty.style.display = 'none';
  }

  const isAdmin = Boolean(window.PRIVATIAN_USER && window.PRIVATIAN_USER.role === 'Admin');
  trash.forEach(s => {
    const tr = document.createElement('tr');
    const permBtn = isAdmin
      ? `<button class="action-btn action-btn--perm-delete" data-id="${s.id}" title="Delete permanently (Admin only)" aria-label="Permanently delete ${escapeHtml(s.name)}">${ICONS.xCircle}</button>`
      : '';
    tr.innerHTML = `
      <td>
        <div class="section-name-cell" style="color: var(--text-muted); text-decoration: line-through;">
          ${escapeHtml(s.name)} ${s.name_bn ? `[${escapeHtml(s.name_bn)}]` : ''}
        </div>
      </td>
      <td class="articles-count articles-count--dash col-articles">—</td>
      <td class="created-date">${formatDate(s.deletedAt)}</td>
      <td>
        <div class="action-group">
          <button class="action-btn action-btn--restore" data-id="${s.id}" title="Restore section" aria-label="Restore ${escapeHtml(s.name)}">${ICONS.restore}</button>
          ${permBtn}
        </div>
      </td>
    `;
    trashTable.appendChild(tr);
  });

  trashTable.querySelectorAll('.action-btn--restore').forEach(btn => {
    btn.addEventListener('click', () => restoreSection(btn.dataset.id));
  });
  trashTable.querySelectorAll('.action-btn--perm-delete').forEach(btn => {
    btn.addEventListener('click', () => permanentDeleteSectionConfirm(btn.dataset.id));
  });
}

function deleteSectionConfirm(id) {
  const s = sections.find(s => s.id === id);
  if (!s || s.id === 'all' || s.isPermanent) {
    showToast('error', 'The "All" section is a permanent core section and cannot be deleted.');
    return;
  }
  _confirmModal({
    title: 'Move Section to Trash',
    body: `Are you sure you want to move "<strong>${escapeHtml(s.name)}</strong>" to Trash?<br><br>It will be hidden from the public navigation and footer menus. You can restore it anytime from the Section Trash tab.`,
    confirmText: 'Move to Trash',
    confirmColor: '#dc2626',
    variant: 'danger',
    onConfirm: () => deleteSection(id)
  });
}

function permanentDeleteSectionConfirm(id) {
  const s = sections.find(s => s.id === id);
  if (!s) return;
  _confirmModal({
    title: 'Delete Section Permanently',
    body: `<strong style="color:#dc2626">Warning: This action cannot be undone!</strong><br><br>Permanently delete section "<strong>${escapeHtml(s.name)}</strong>" from the database?`,
    confirmText: 'Delete Forever',
    confirmColor: '#dc2626',
    variant: 'danger',
    onConfirm: () => permanentlyDelete(id)
  });
}

// ── Actions ──────────────────────────────────────────────────
async function addSection(name, slug, name_bn = '') {
  const trimmed = name.trim();
  const slugVal = slug.trim();
  const bnVal = (name_bn || '').trim();
  // Optimistic duplicate check (in-memory, fast)
  if (sections.some(s => !s.deleted && s.name.toLowerCase() === trimmed.toLowerCase()))
    return 'A section with that name already exists.';
  if (slugVal && sections.some(s => !s.deleted && s.slug === slugVal))
    return 'A section with that URL slug already exists.';
  
  updateGlobalSyncStatus('syncing', 'Saving to database...');
  try {
    const created = await _apiPost('/api/sections', {
      name: trimmed, name_bn: bnVal, slug: slugVal, admin_id: genId(trimmed)
    });
    sections.push(created);
    render();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', `Section "${trimmed}" created.`);
    recordActivityLog({
      action: 'section.create',
      category: 'sections',
      summary: `Created section "${trimmed}" (/section/${slugVal || genSlug(trimmed)})`,
      target_id: created?.id || slugVal,
      target_name: trimmed,
      details: { name: trimmed, name_bn: bnVal, slug: slugVal }
    });
    return null;
  } catch(e) {
    updateGlobalSyncStatus('error', 'Sync error');
    return e.message || 'Failed to create section.';
  }
}

async function renameSection(id, name, slug, name_bn = '') {
  const trimmed = name.trim();
  const slugVal = slug.trim();
  const bnVal = (name_bn || '').trim();
  // Optimistic duplicate check
  if (sections.some(s => s.id !== id && !s.deleted && s.name.toLowerCase() === trimmed.toLowerCase()))
    return 'A section with that name already exists.';
  if (slugVal && sections.some(s => s.id !== id && !s.deleted && s.slug === slugVal))
    return 'A section with that URL slug already exists.';
  
  if (id === 'all') {
    ALL_SECTION.name = trimmed;
    ALL_SECTION.name_bn = bnVal || 'সকল';
    ALL_SECTION.slug = slugVal;
    const local = sections.find(s => s.id === 'all');
    if (local) { local.name = trimmed; local.name_bn = bnVal || 'সকল'; local.slug = slugVal; }
    updateGlobalSyncStatus('syncing', 'Saving to database...');
    try {
      await _apiPut('/api/sections?id=all', { name: trimmed, name_bn: bnVal, slug: slugVal });
    } catch(e) {}
    render();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', `Renamed to "${trimmed}".`);
    recordActivityLog({
      action: 'section.rename',
      category: 'sections',
      summary: `Renamed core section to "${trimmed}"`,
      target_id: 'all',
      target_name: trimmed,
      details: { name: trimmed, name_bn: bnVal, slug: slugVal }
    });
    return null;
  }

  updateGlobalSyncStatus('syncing', 'Saving to database...');
  try {
    const updated = await _apiPut(`/api/sections?id=${encodeURIComponent(id)}`, { name: trimmed, name_bn: bnVal, slug: slugVal });
    const local = sections.find(s => s.id === id);
    if (local) { local.name = updated.name; local.name_bn = updated.name_bn || bnVal; local.slug = updated.slug; }
    render();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', `Renamed to "${trimmed}".`);
    recordActivityLog({
      action: 'section.rename',
      category: 'sections',
      summary: `Renamed section to "${trimmed}" (/section/${slugVal || genSlug(trimmed)})`,
      target_id: id,
      target_name: trimmed,
      details: { name: trimmed, name_bn: bnVal, slug: slugVal }
    });
    return null;
  } catch(e) {
    updateGlobalSyncStatus('error', 'Sync error');
    return e.message || 'Failed to rename section.';
  }
}

async function deleteSection(id) {
  const s = sections.find(s => s.id === id);
  if (!s || s.id === 'all' || s.isPermanent) {
    showToast('error', 'The "All" section is a permanent core section and cannot be deleted.');
    return;
  }
  const name = s.name;
  // Optimistic UI update
  s.deleted = true;
  s.deletedAt = new Date().toISOString();
  render();
  updateGlobalSyncStatus('syncing', 'Updating database...');
  showToast('warning', `"${name}" moved to Trash.`, 'Undo', async () => {
    // Undo: restore via API
    try {
      updateGlobalSyncStatus('syncing', 'Restoring in database...');
      await _apiPatch(`/api/sections?id=${encodeURIComponent(id)}`);
      s.deleted = false; delete s.deletedAt;
      render();
      updateGlobalSyncStatus('synced', 'Synced with database');
      showToast('success', `"${name}" restored.`);
      recordActivityLog({
        action: 'section.restore',
        category: 'sections',
        summary: `Restored section "${name}" from Trash`,
        target_id: id,
        target_name: name,
        details: { id }
      });
    } catch(e) {
      showToast('error', 'Undo failed: ' + e.message);
      await loadSectionsFromAPI();
    }
  });
  // Persist to DB
  try {
    await _apiDelete(`/api/sections?id=${encodeURIComponent(id)}`);
    updateGlobalSyncStatus('synced', 'Synced with database');
    recordActivityLog({
      action: 'section.trash',
      category: 'sections',
      summary: `Moved section "${name}" to Trash`,
      target_id: id,
      target_name: name,
      details: { id }
    });
  } catch(e) {
    // Rollback optimistic update on failure
    s.deleted = false; delete s.deletedAt;
    render();
    updateGlobalSyncStatus('error', 'Sync error');
    showToast('error', 'Failed to delete: ' + e.message);
  }
}

async function restoreSection(id) {
  const s = sections.find(s => s.id === id);
  if (!s) return;
  updateGlobalSyncStatus('syncing', 'Restoring in database...');
  try {
    await _apiPatch(`/api/sections?id=${encodeURIComponent(id)}`);
    s.deleted = false; delete s.deletedAt;
    render();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', `"${s.name}" restored to Active.`);
    recordActivityLog({
      action: 'section.restore',
      category: 'sections',
      summary: `Restored section "${s.name}" to Active list`,
      target_id: id,
      target_name: s.name,
      details: { id }
    });
  } catch(e) {
    showToast('error', 'Restore failed: ' + e.message);
    await loadSectionsFromAPI();
  }
}

async function permanentlyDelete(id) {
  const idx = sections.findIndex(s => s.id === id);
  if (idx === -1) return;
  const name = sections[idx].name;
  sections.splice(idx, 1);
  render();
  updateGlobalSyncStatus('syncing', 'Deleting from database...');
  try {
    await _apiDelete(`/api/sections?id=${encodeURIComponent(id)}&mode=permanent`);
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('error', `"${name}" permanently deleted.`);
    recordActivityLog({
      action: 'section.delete_permanent',
      category: 'sections',
      summary: `Permanently deleted section "${name}" from database`,
      target_id: id,
      target_name: name,
      details: { id, permanent: true }
    });
  } catch(e) {
    showToast('error', 'Permanent delete failed: ' + e.message);
    await loadSectionsFromAPI();
  }
}

// â”€â”€ Modal — Add / Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const slugInput   = document.getElementById('section-slug-input');
const slugPreview = document.getElementById('slug-preview');
let slugManuallyEdited = false;

function updateSlugPreview() {
  if (!slugPreview) return;
  const slug = slugInput ? slugInput.value.trim() : '';
  if (!slug) {
    slugPreview.textContent = '';
    slugPreview.style.color = '';
    return;
  }
  const valid = validateSlug(slug);
  slugPreview.textContent = valid
    ? `URL will be: /section/${slug}`
    : 'Only lowercase letters, numbers and hyphens allowed';
  slugPreview.style.color = valid ? 'var(--text-muted)' : 'var(--danger)';
}

function openAddModal() {
  editingId = null;
  slugManuallyEdited = false;
  modalTitle.textContent = 'New Section';
  modalSaveBtn.textContent = 'Save Section';
  nameInput.value = '';
  const nameBnInp = document.getElementById('section-name-bn-input');
  if (nameBnInp) nameBnInp.value = '';
  if (slugInput) slugInput.value = '';
  if (slugPreview) slugPreview.textContent = '';
  hideModalError();
  modalOverlay.hidden = false;
  setTimeout(() => nameInput.focus(), 60);
}

function openEditModal(id) {
  const s = sections.find(s => s.id === id);
  if (!s) return;
  editingId = id;
  slugManuallyEdited = true; // don't auto-override slug when editing
  modalTitle.textContent = 'Edit Section';
  modalSaveBtn.textContent = 'Save Changes';
  nameInput.value = s.name;
  const nameBnInp = document.getElementById('section-name-bn-input');
  if (nameBnInp) nameBnInp.value = s.name_bn || '';
  if (slugInput) slugInput.value = s.slug || '';
  updateSlugPreview();
  hideModalError();
  modalOverlay.hidden = false;
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
}

function closeModal() {
  modalOverlay.hidden = true;
  editingId = null;
  slugManuallyEdited = false;
  hideModalError();
}

// ── UNIFIED SECTION STUDIO (METADATA, LIVE LAYOUT & ALL ARTICLES) ─────────
var _studioAllArticles = [];
var _studioSectionArticles = [];
var _studioCurrentSection = null;
var _studioActiveTab = 'general';

async function openSectionStudio(id) {
  const s = sections.find(sec => sec.id === id);
  if (!s) return;
  _studioCurrentSection = s;

  const modal = document.getElementById('modal-section-studio');
  if (!modal) return;

  const titleEl = document.getElementById('studio-sec-name-title');
  const switcherEl = document.getElementById('studio-sec-switcher');
  const liveLinkEl = document.getElementById('studio-live-link');
  const idEl = document.getElementById('studio-sec-id');
  const slugEl = document.getElementById('studio-sec-slug');
  const nameInput = document.getElementById('studio-name-input');
  const nameBnInput = document.getElementById('studio-name-bn-input');
  const slugInput = document.getElementById('studio-slug-input');
  const descInput = document.getElementById('studio-desc-input');
  const writeArtBtn = document.getElementById('studio-write-art-btn');

  if (titleEl) titleEl.textContent = (_sectionsLang === 'bn' && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
  if (idEl) idEl.value = s.id;
  if (slugEl) slugEl.value = s.slug || 'all';
  if (nameInput) nameInput.value = s.name;
  if (nameBnInput) nameBnInput.value = s.name_bn || '';
  if (slugInput) {
    slugInput.value = s.slug || '';
    const isBn = _sectionsLang === 'bn';
    if (isBn) {
      slugInput.readOnly = true;
      slugInput.style.opacity = '0.55';
      slugInput.style.cursor = 'not-allowed';
      slugInput.style.backgroundColor = '#f8fafc';
      slugInput.title = '[Locked] Section URL Slug is unified in backend and defined strictly in English';
    } else {
      slugInput.readOnly = s.id === 'all' || s.isPermanent;
      slugInput.style.opacity = (s.id === 'all' || s.isPermanent) ? '0.55' : '1';
      slugInput.style.cursor = (s.id === 'all' || s.isPermanent) ? 'not-allowed' : '';
      slugInput.style.backgroundColor = '';
      slugInput.title = '';
    }
  }

  // Set Section Switcher dropdown options
  if (switcherEl) {
    switcherEl.innerHTML = sections
      .filter(sec => !sec.deleted)
      .map(sec => {
        const secLabel = (_sectionsLang === 'bn' && sec.name_bn) ? `${sec.name_bn} (${sec.name})` : sec.name;
        return `<option value="${sec.id}" ${sec.id === s.id ? 'selected' : ''}>${escapeHtml(secLabel)}</option>`;
      })
      .join('');
  }

  // Set Live Link
  if (liveLinkEl) {
    liveLinkEl.href = s.slug ? `/section/${s.slug}` : '/section/all';
  }

  // Set Write Article Link pre-selected for this section
  if (writeArtBtn) {
    writeArtBtn.href = `admin-article-editor.html?section=${encodeURIComponent(s.name)}`;
  }

  updateStudioSlugPreview();

  // Load all published & draft articles
  await loadAllArticlesForStudio();

  // Filter articles for this section
  const secSlug = (s.slug || 'all').toLowerCase();
  const secNameLower = s.name.toLowerCase();
  const isAll = s.id === 'all' || secSlug === 'all';

  _studioSectionArticles = isAll
    ? _studioAllArticles
    : _studioAllArticles.filter(a => {
        const aSec = (a.section || '').toLowerCase();
        return aSec === secNameLower || aSec.includes(secNameLower) || aSec.includes(secSlug.replace(/-/g, ' '));
      });

  // Update Article Count Badge
  const countBadge = document.getElementById('studio-art-count-badge');
  if (countBadge) countBadge.textContent = _studioSectionArticles.length;

  // Load existing configuration for this section
  let existingConfig = { featuredArticleId: null, selectedArticleIds: [], customTitle: '', description: '' };
  try {
    const res = await _apiGet(`/api/sections?action=section-config&slug=${encodeURIComponent(s.slug || 'all')}${_sectionsLang === 'bn' ? '&lang=bn' : ''}`);
    if (res && typeof res === 'object') existingConfig = res;
  } catch(e) {}

  if (descInput) descInput.value = existingConfig.description || '';

  // Populate Hero Featured Select (using published articles)
  const publishedSecArts = _studioSectionArticles.filter(a => a.status === 'published' || !a.status);
  const heroSelect = document.getElementById('studio-hero-select');
  if (heroSelect) {
    heroSelect.innerHTML = `<option value="">(Auto-Latest Published Article with Image)</option>` +
      publishedSecArts.map(a => `<option value="${a.id}" ${existingConfig.featuredArticleId === a.id ? 'selected' : ''}>${escapeHtml(a.title || 'Untitled')} (${a.author || 'Author'} • ${formatDate(a.published_at || a.created_at)})</option>`).join('');
    updateStudioHeroPreview(heroSelect.value);
  }

  // Populate 4 Selected Article Slots
  const selIds = Array.isArray(existingConfig.selectedArticleIds) ? existingConfig.selectedArticleIds : [];
  for (let slot = 1; slot <= 4; slot++) {
    const slotSelect = document.getElementById(`studio-slot-${slot}-select`);
    const currentVal = selIds[slot - 1] || '';
    if (slotSelect) {
      slotSelect.innerHTML = `<option value="">(Auto: Top Story ${slot})</option>` +
        publishedSecArts.map(a => `<option value="${a.id}" ${currentVal === a.id ? 'selected' : ''}>${escapeHtml(a.title || 'Untitled')} (${a.author || 'Author'})</option>`).join('');
      updateStudioSlotPreview(slot, slotSelect.value);
    }
  }

  // Render Section Articles Table
  renderStudioArticlesTable(_studioSectionArticles);

  // Switch to active tab
  switchStudioTab(_studioActiveTab || 'general');

  modal.hidden = false;
}

function closeSectionStudio() {
  const modal = document.getElementById('modal-section-studio');
  if (modal) modal.hidden = true;
  _studioCurrentSection = null;
}

function switchStudioTab(tabName) {
  _studioActiveTab = tabName;
  ['general', 'layout', 'articles'].forEach(t => {
    const btn = document.getElementById(`studio-tab-${t}`);
    const pane = document.getElementById(`studio-pane-${t}`);
    if (btn) {
      const isActive = t === tabName;
      btn.style.borderBottomColor = isActive ? 'var(--brand-navy, #0a528e)' : 'transparent';
      btn.style.color = isActive ? 'var(--brand-navy, #0a528e)' : 'var(--text-muted)';
      btn.classList.toggle('active', isActive);
    }
    if (pane) {
      pane.style.display = t === tabName ? 'block' : 'none';
    }
  });
}

function updateStudioSlugPreview() {
  const nameInput = document.getElementById('studio-name-input');
  const slugInput = document.getElementById('studio-slug-input');
  const previewText = document.getElementById('studio-slug-preview-text');
  if (!slugInput || !previewText) return;

  const val = slugInput.value.trim() || genSlug(nameInput?.value || '');
  if (_studioCurrentSection && _studioCurrentSection.id === 'all') {
    previewText.textContent = 'Primary Core Section URL: /section/all (or root /)';
    previewText.style.color = 'var(--text-muted)';
  } else if (val) {
    previewText.textContent = `Live Section URL: https://theprivatianfamily.vercel.app/section/${val}`;
    previewText.style.color = 'var(--text-muted)';
  } else {
    previewText.textContent = 'URL slug will be generated automatically.';
    previewText.style.color = 'var(--text-muted)';
  }
}

async function loadAllArticlesForStudio() {
  if (_studioAllArticles.length > 0) return;
  try {
    const list = await _apiGet('/api/articles?action=list');
    if (Array.isArray(list)) _studioAllArticles = list;
  } catch(e) {}

  if (_studioAllArticles.length === 0) {
    try {
      const pubList = await _apiGet('/api/articles?action=public');
      if (Array.isArray(pubList)) _studioAllArticles = pubList;
    } catch(err) {}
  }
}

function updateStudioHeroPreview(articleId) {
  const prevBox = document.getElementById('studio-hero-preview');
  const prevImg = document.getElementById('studio-hero-prev-img');
  const prevTitle = document.getElementById('studio-hero-prev-title');
  const prevMeta = document.getElementById('studio-hero-prev-meta');
  const editLink = document.getElementById('studio-hero-edit-link');
  if (!prevBox) return;

  if (!articleId) {
    prevBox.style.display = 'none';
    return;
  }
  const art = _studioAllArticles.find(a => a.id === articleId);
  if (!art) {
    prevBox.style.display = 'none';
    return;
  }
  prevBox.style.display = 'flex';
  if (prevImg) prevImg.src = art.hero_img_url || '/img1.png';
  if (prevTitle) prevTitle.textContent = art.title || 'Untitled';
  if (prevMeta) prevMeta.textContent = `${art.section || 'General'} • ${art.author || 'Author'} • ${formatDate(art.published_at || art.created_at)}`;
  if (editLink) editLink.href = `admin-article-editor.html?id=${art.id}`;
}

function updateStudioSlotPreview(slotIndex, articleId) {
  const prevEl = document.getElementById(`studio-slot-${slotIndex}-prev`);
  const editLink = document.getElementById(`studio-slot-${slotIndex}-edit`);
  if (!prevEl) return;

  if (!articleId) {
    prevEl.style.display = 'none';
    prevEl.textContent = '';
    if (editLink) editLink.style.display = 'none';
    return;
  }
  const art = _studioAllArticles.find(a => a.id === articleId);
  if (art) {
    prevEl.style.display = 'block';
    prevEl.textContent = `Selected: "${art.title}" (${art.author || 'Author'})`;
    if (editLink) {
      editLink.style.display = 'inline';
      editLink.href = `admin-article-editor.html?id=${art.id}`;
    }
  } else {
    prevEl.style.display = 'none';
    if (editLink) editLink.style.display = 'none';
  }
}

function renderStudioArticlesTable(articlesList) {
  const tbody = document.getElementById('studio-articles-tbody');
  const emptyEl = document.getElementById('studio-articles-empty');
  if (!tbody) return;

  if (!articlesList || articlesList.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = articlesList.map(a => {
    const isPub = a.status === 'published' || !a.status;
    const thumb = a.hero_img_url
      ? `<img src="${a.hero_img_url}" style="width:52px;height:34px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;" />`
      : `<div style="width:52px;height:34px;background:#e2e8f0;border-radius:4px;"></div>`;
    const artUrl = a.slug ? `/article/${a.slug}` : `/article/${a.id}`;
    return `
      <tr>
        <td style="padding:10px 12px;vertical-align:middle;">${thumb}</td>
        <td style="padding:10px 12px;vertical-align:middle;">
          <div style="font-weight:600;color:var(--text-primary);line-height:1.3;margin-bottom:2px;">
            <a href="admin-article-editor.html?id=${a.id}" target="_blank" style="color:inherit;text-decoration:none;">${escapeHtml(a.title || 'Untitled')}</a>
          </div>
          ${a.deck ? `<div style="font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">${escapeHtml(a.deck)}</div>` : ''}
        </td>
        <td style="padding:10px 12px;vertical-align:middle;font-size:12px;color:var(--text-secondary);">${escapeHtml(a.author || '—')}</td>
        <td style="padding:10px 12px;vertical-align:middle;">
          <span class="badge ${isPub ? 'badge--active' : 'badge--inactive'}" style="font-size:10.5px;padding:2px 7px;">
            ${isPub ? 'Published' : 'Draft'}
          </span>
        </td>
        <td style="padding:10px 12px;vertical-align:middle;font-size:12px;color:var(--text-muted);">${formatDate(a.published_at || a.created_at)}</td>
        <td style="padding:10px 12px;vertical-align:middle;text-align:right;">
          <div style="display:inline-flex;align-items:center;gap:5px;justify-content:flex-end;">
            <a href="admin-article-editor.html?id=${a.id}" target="_blank" class="action-btn" title="Edit Article in Editor" style="font-size:12px;text-decoration:none;display:inline-flex;align-items:center;padding:4px 6px;">
              ${ICONS.pencil}
            </a>
            <a href="${artUrl}" target="_blank" class="action-btn" title="View Public Article" style="font-size:12px;text-decoration:none;display:inline-flex;align-items:center;padding:4px 6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            <button type="button" class="action-btn" title="Set as Hero Story" onclick="makeStudioHero('${a.id}')" style="color:#d97706;padding:4px 6px;display:inline-flex;align-items:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <button type="button" class="action-btn" title="Pin to Slot 1" onclick="pinStudioSlot('${a.id}', 1)" style="font-size:11px;font-weight:600;padding:3px 7px;border:1px solid #cbd5e1;border-radius:4px;color:var(--brand-navy,#0a528e);">
              Slot 1
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterStudioArticlesList(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderStudioArticlesTable(_studioSectionArticles);
    return;
  }
  const filtered = _studioSectionArticles.filter(a =>
    (a.title || '').toLowerCase().includes(q) ||
    (a.author || '').toLowerCase().includes(q) ||
    (a.deck || '').toLowerCase().includes(q)
  );
  renderStudioArticlesTable(filtered);
}

function makeStudioHero(articleId) {
  const heroSelect = document.getElementById('studio-hero-select');
  if (heroSelect) {
    heroSelect.value = articleId;
    updateStudioHeroPreview(articleId);
  }
  switchStudioTab('layout');
  showToast('success', 'Article selected as Hero Featured Story for this section.');
  recordActivityLog({
    action: 'sections.hero_select',
    category: 'sections',
    summary: `Selected article "${articleId}" as Hero Featured Story for section "${_studioCurrentSection?.name || ''}"`,
    target_id: articleId,
    target_name: _studioCurrentSection?.name || 'Section Hero',
    details: { sectionId: _studioCurrentSection?.id, articleId }
  });
}

function pinStudioSlot(articleId, slotNum) {
  const slotSelect = document.getElementById(`studio-slot-${slotNum}-select`);
  if (slotSelect) {
    slotSelect.value = articleId;
    updateStudioSlotPreview(slotNum, articleId);
  }
  switchStudioTab('layout');
  showToast('success', `Article pinned to Slot ${slotNum}.`);
  recordActivityLog({
    action: 'sections.slot_pin',
    category: 'sections',
    summary: `Pinned article "${articleId}" to Slot ${slotNum} for section "${_studioCurrentSection?.name || ''}"`,
    target_id: articleId,
    target_name: `Slot ${slotNum}`,
    details: { sectionId: _studioCurrentSection?.id, slotNum, articleId }
  });
}

async function lookupHeroArticleById(rawInput) {
  const id = (rawInput || '').trim();
  if (!id) {
    showToast('info', 'Please enter an Article ID.');
    return;
  }

  await loadAllArticlesForStudio();
  let art = _studioAllArticles.find(a => a.id === id || a.slug === id);

  if (!art) {
    try {
      const direct = await _apiGet(`/api/articles?id=${encodeURIComponent(id)}`);
      if (direct && direct.id) {
        art = direct;
        _studioAllArticles.push(art);
      }
    } catch(e) {}
  }

  if (!art) {
    showToast('error', `Article with ID "${id}" was not found.`);
    return;
  }

  const heroSelect = document.getElementById('studio-hero-select');
  if (heroSelect) {
    let opt = heroSelect.querySelector(`option[value="${art.id}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = art.id;
      opt.textContent = `${art.title || 'Untitled'} (${art.author || 'Author'})`;
      heroSelect.appendChild(opt);
    }
    heroSelect.value = art.id;
    updateStudioHeroPreview(art.id);
  }
  showToast('success', `Applied Hero Featured Story: "${art.title || art.id}".`);
  recordActivityLog({
    action: 'sections.hero_lookup',
    category: 'sections',
    summary: `Looked up and set article "${art.title || art.id}" as Hero Story for section "${_studioCurrentSection?.name || ''}"`,
    target_id: art.id,
    target_name: art.title || art.id,
    details: { sectionId: _studioCurrentSection?.id, articleId: art.id, title: art.title }
  });
}

async function saveSectionStudio() {
  if (!_studioCurrentSection) return;
  const saveBtn = document.getElementById('studio-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving Changes…'; }

  const id = _studioCurrentSection.id;
  const newName = (document.getElementById('studio-name-input')?.value || '').trim();
  const newNameBn = (document.getElementById('studio-name-bn-input')?.value || '').trim();
  const newSlug = (document.getElementById('studio-slug-input')?.value || '').trim();
  const desc = (document.getElementById('studio-desc-input')?.value || '').trim();
  const heroArtId = document.getElementById('studio-hero-select')?.value || null;

  const selIds = [];
  for (let slot = 1; slot <= 4; slot++) {
    const val = document.getElementById(`studio-slot-${slot}-select`)?.value;
    if (val) selIds.push(val);
  }

  if (!newName) {
    showToast('error', 'Section name cannot be empty.');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Save Section Changes`; }
    return;
  }

  updateGlobalSyncStatus('syncing', 'Saving section changes...');

  try {
    // 1. If name, name_bn, or slug changed:
    if (id !== 'all' && (newName !== _studioCurrentSection.name || newNameBn !== (_studioCurrentSection.name_bn || '') || newSlug !== _studioCurrentSection.slug)) {
      await _apiPut(`/api/sections?id=${encodeURIComponent(id)}`, {
        name: newName,
        name_bn: newNameBn,
        slug: newSlug || genSlug(newName)
      });
      _studioCurrentSection.name = newName;
      _studioCurrentSection.name_bn = newNameBn;
      _studioCurrentSection.slug = newSlug || genSlug(newName);
    }

    // 2. Save section custom configuration (hero, selected slots, description)
    const configSlug = _studioCurrentSection.slug || 'all';
    await _apiPost(`/api/sections?action=section-config&slug=${encodeURIComponent(configSlug)}${_sectionsLang === 'bn' ? '&lang=bn' : ''}`, {
      slug: configSlug,
      lang: _sectionsLang,
      featuredArticleId: heroArtId,
      selectedArticleIds: selIds,
      description: desc
    });

    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', `Section "${newName}" and website layout saved successfully.`);

    recordActivityLog({
      action: 'sections.studio_save',
      category: 'sections',
      summary: `Saved Section Studio configuration for "${newName}" (Hero: ${heroArtId || 'Auto'}, ${selIds.length} Pinned Slots)`,
      target_id: id,
      target_name: newName,
      details: { name: newName, name_bn: newNameBn, slug: newSlug, heroArticleId: heroArtId, slotArticleIds: selIds, description: desc }
    });

    // Refresh sections list
    await loadSectionsFromAPI();
  } catch(e) {
    updateGlobalSyncStatus('error', 'Sync error');
    showToast('error', 'Failed to save section changes: ' + e.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Save Section Changes`;
    }
  }
}

// Alias helper
const loadSections = loadSectionsFromAPI;
window.loadSections = loadSectionsFromAPI;

function showModalError(msg) {
  modalError.textContent = msg;
  modalError.hidden = false;
  nameInput.style.borderColor = 'var(--danger)';
}

function hideModalError() {
  modalError.hidden = true;
  modalError.textContent = '';
  nameInput.style.borderColor = '';
}

// Auto-generate slug from name (when not manually edited)
nameInput.addEventListener('input', () => {
  hideModalError();
  if (!slugManuallyEdited && slugInput) {
    slugInput.value = genSlug(nameInput.value);
    updateSlugPreview();
  }
});

if (slugInput) {
  slugInput.addEventListener('input', () => {
    slugManuallyEdited = true;
    updateSlugPreview();
  });
}

modalSaveBtn.addEventListener('click', async () => {
  const nameVal = nameInput.value.trim();
  const nameBnVal = (document.getElementById('section-name-bn-input')?.value || '').trim();
  const slugVal = slugInput ? slugInput.value.trim() : '';
  if (!nameVal) { showModalError('Section name cannot be empty.'); return; }
  if (slugVal && !validateSlug(slugVal)) {
    showModalError('URL slug: only lowercase letters, numbers, and hyphens allowed.');
    return;
  }
  modalSaveBtn.disabled = true;
  const err = editingId
    ? await renameSection(editingId, nameVal, slugVal, nameBnVal)
    : await addSection(nameVal, slugVal, nameBnVal);
  modalSaveBtn.disabled = false;
  if (err) { showModalError(err); return; }
  closeModal();
});

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') modalSaveBtn.click(); });
modalCancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

// â”€â”€ Confirm Delete Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openConfirmDelete(id) {
  const s = sections.find(s => s.id === id);
  if (!s) return;
  pendingDeleteId = id;
  confirmSectionName.textContent = `"${s.name}"`;
  confirmOverlay.hidden = false;
}

function closeConfirmModal() {
  confirmOverlay.hidden = true;
  pendingDeleteId = null;
}

confirmDeleteBtn.addEventListener('click', async () => {
  if (pendingDeleteId) await permanentlyDelete(pendingDeleteId);
  closeConfirmModal();
});
confirmCancelBtn.addEventListener('click', closeConfirmModal);
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirmModal(); });

// â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!modalOverlay.hidden) closeModal();
    if (!confirmOverlay.hidden) closeConfirmModal();
  }
});

// â”€â”€ Tab switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchTab(tab) {
  currentTab = tab;
  tabActiveBtn.classList.toggle('active', tab === 'active');
  tabTrashBtn.classList.toggle('active', tab === 'trash');
  panelActive.hidden = tab !== 'active';
  panelTrash.hidden  = tab !== 'trash';
}

tabActiveBtn.addEventListener('click', () => switchTab('active'));
tabTrashBtn.addEventListener('click',  () => switchTab('trash'));

// ── Universal Database Sync Management Engine ────────────────────────
_currentAdminPage = 'sections';

function isMenuModified() {
  if (!appliedMenuConfig || !menuDraftConfig) return false;
  return JSON.stringify(appliedMenuConfig) !== JSON.stringify(menuDraftConfig);
}

function isHomepageModified() {
  if (!appliedHomepageConfig || !homepageDraftConfig) return false;
  return JSON.stringify(appliedHomepageConfig) !== JSON.stringify(homepageDraftConfig);
}

function isHeaderModified() {
  if (!_hsInstance || !window._appliedHeaderConfig) return false;
  return JSON.stringify(window._appliedHeaderConfig) !== JSON.stringify(_hsInstance);
}

function isFooterModified() {
  if (!appliedFooterConfig || !footerDraftConfig) return false;
  return JSON.stringify(appliedFooterConfig) !== JSON.stringify(footerDraftConfig);
}

function updateGlobalSyncStatus(forcedState, forcedText) {
  let state = 'synced';
  let text = 'Synced with database';

  if (forcedState) {
    state = forcedState;
    text = forcedText || (state === 'synced' ? 'Synced with database' : (state === 'unsaved' ? 'Unsaved changes' : (state === 'error' ? 'Sync error (offline/cache)' : 'Syncing with database...')));
  } else {
    if (_currentAdminPage === 'footer') {
      if (typeof isFooterModified === 'function' && isFooterModified()) {
        state = 'unsaved';
        text = 'Unsaved footer changes';
      }
    } else if (_currentAdminPage === 'menu') {
      if (typeof isMenuModified === 'function' && isMenuModified()) {
        state = 'unsaved';
        text = 'Unsaved menu changes';
      }
    } else if (_currentAdminPage === 'homepage') {
      if (typeof isHomepageModified === 'function' && isHomepageModified()) {
        state = 'unsaved';
        text = 'Unsaved homepage changes';
      }
    } else if (_currentAdminPage === 'header') {
      if (typeof isHeaderModified === 'function' && isHeaderModified()) {
        state = 'unsaved';
        text = 'Unsaved header changes';
      }
    } else {
      // Check if any background section has unsaved edits
      if (typeof isFooterModified === 'function' && isFooterModified()) {
        state = 'unsaved';
        text = 'Unsaved footer changes';
      } else if (typeof isMenuModified === 'function' && isMenuModified()) {
        state = 'unsaved';
        text = 'Unsaved menu changes';
      } else if (typeof isHomepageModified === 'function' && isHomepageModified()) {
        state = 'unsaved';
        text = 'Unsaved homepage changes';
      } else if (typeof isHeaderModified === 'function' && isHeaderModified()) {
        state = 'unsaved';
        text = 'Unsaved header changes';
      } else {
        state = 'synced';
        text = 'Synced with database';
      }
    }
  }

  // 1. Update Global Sidebar Badge (Below The Privatian / Admin Panel)
  const gWrap = document.getElementById('global-sync-status-wrap');
  const gDot = document.getElementById('global-status-dot');
  const gText = document.getElementById('global-sync-status');
  if (gWrap) {
    gWrap.className = 'sidebar-sync-badge ' + state;
  }
  if (gDot) {
    gDot.className = 'ft-pulse-dot' + (state !== 'synced' ? ' ' + state : '');
  }
  if (gText) {
    gText.textContent = text;
  }

  // 2. Update In-Page Badges for all pages (strictly isolated to their own section)
  const inPageBadges = [
    { wrap: 'sections-save-status-wrap', dot: 'sections-status-dot', text: 'sections-save-status', page: 'sections' },
    { wrap: 'access-save-status-wrap', dot: 'access-status-dot', text: 'access-save-status', page: 'access' },
    { wrap: 'ft-save-status-wrap', dot: 'ft-status-dot', text: 'ft-save-status', page: 'footer' },
    { wrap: 'menu-save-status-wrap', dot: 'menu-status-dot', text: 'menu-save-status', page: 'menu' },
    { wrap: 'hp-save-status-wrap', dot: 'hp-status-dot', text: 'hp-save-status', page: 'homepage' },
    { wrap: 'header-save-status-wrap', dot: 'header-status-dot', text: 'header-save-status', page: 'header' }
  ];

  inPageBadges.forEach(b => {
    const w = document.getElementById(b.wrap);
    const d = document.getElementById(b.dot);
    const t = document.getElementById(b.text);
    if (!w) return;

    let pageState = 'synced';
    let pageText = 'Synced with database';

    if (forcedState && _currentAdminPage === b.page) {
      pageState = forcedState;
      pageText = forcedText || (pageState === 'synced' ? 'Synced with database' : (pageState === 'unsaved' ? 'Unsaved changes' : (pageState === 'error' ? 'Sync error (offline/cache)' : 'Syncing with database...')));
    } else {
      if (b.page === 'footer') {
        pageState = typeof isFooterModified === 'function' && isFooterModified() ? 'unsaved' : 'synced';
        pageText = pageState === 'unsaved' ? 'Unsaved changes' : 'Synced with database';
      } else if (b.page === 'menu') {
        pageState = typeof isMenuModified === 'function' && isMenuModified() ? 'unsaved' : 'synced';
        pageText = pageState === 'unsaved' ? 'Unsaved changes' : 'Synced with database';
      } else if (b.page === 'homepage') {
        pageState = typeof isHomepageModified === 'function' && isHomepageModified() ? 'unsaved' : 'synced';
        pageText = pageState === 'unsaved' ? 'Unsaved changes' : 'Synced with database';
      } else if (b.page === 'header') {
        pageState = typeof isHeaderModified === 'function' && isHeaderModified() ? 'unsaved' : 'synced';
        pageText = pageState === 'unsaved' ? 'Unsaved changes' : 'Synced with database';
      } else {
        pageState = 'synced';
        pageText = 'Synced with database';
      }
    }

    w.className = 'ft-header-badge ' + pageState;
    if (d) d.className = 'ft-pulse-dot' + (pageState !== 'synced' ? ' ' + pageState : '');
    if (t) t.textContent = pageText;
  });
}

// ── Live Database Connection & Verification Engine ───────────────
var _isVerifyingDb = false;

async function verifyDatabaseSync(shouldToast = false) {
  if (_isVerifyingDb) return;
  _isVerifyingDb = true;

  if (shouldToast) {
    updateGlobalSyncStatus('syncing', 'Testing database...');
  }

  let dbOk = false;
  try {
    const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
    if (sb) {
      const { data, error } = await sb.from('sections').select('id').limit(1);
      if (!error && Array.isArray(data)) dbOk = true;
    }
  } catch(e) {}

  if (!dbOk) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/sections?select=id&limit=1`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) dbOk = true;
      }
    } catch(e) {}
  }

  _isVerifyingDb = false;

  if (dbOk) {
    updateGlobalSyncStatus();
    if (shouldToast) {
      showToast('success', 'Database connection verified & synchronized');
    }
  } else {
    updateGlobalSyncStatus('error', 'Sync error (offline/cache)');
    if (shouldToast) {
      showToast('error', 'Database connection error. Working with local cache.');
    }
  }
}

// ── Page navigation ───────────────────────────────────────────
const PAGE_CONFIG = {
  dashboard: { title: 'Dashboard & Overview', breadcrumb: 'Dashboard' },
  sections:  { title: 'Sections',  breadcrumb: 'Sections' },
  homepage:  { title: 'Homepage Manager', breadcrumb: 'Homepage' },
  menu:      { title: 'Navigation Menu', breadcrumb: 'Navigation Menu' },
  header:    { title: 'Header Settings', breadcrumb: 'Header' },
  footer:    { title: 'Footer Settings', breadcrumb: 'Footer' },
  articles:  { title: 'Articles',  breadcrumb: 'Articles' },
  gallery:   { title: 'Media Gallery & Asset Library', breadcrumb: 'Gallery' },
  settings:  { title: 'Settings',  breadcrumb: 'Settings' },
  access:    { title: 'Manage Access', breadcrumb: 'Manage Access' },
  activity:  { title: 'Activity Log & Audit Trail', breadcrumb: 'Activity Log' },
};

function navigateTo(page) {
  _currentAdminPage = page || 'dashboard';

  // Persist current page to URL Hash and localStorage
  try {
    if (window.location.hash !== '#' + _currentAdminPage) {
      history.replaceState(null, '', '#' + _currentAdminPage);
    }
    localStorage.setItem('pf_admin_current_page', _currentAdminPage);
  } catch (e) {}

  document.querySelectorAll('.sidebar-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === _currentAdminPage);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${_currentAdminPage}`);
  });

  const cfg = PAGE_CONFIG[_currentAdminPage] || { title: _currentAdminPage, breadcrumb: _currentAdminPage };
  const pageTitleEl = document.getElementById('page-title');
  const breadcrumbEl = document.getElementById('breadcrumb-current');
  if (pageTitleEl) pageTitleEl.textContent = cfg.title;
  if (breadcrumbEl) breadcrumbEl.textContent = cfg.breadcrumb;

  // Inject topbar action buttons
  topbarActions.innerHTML = '';
  if (_currentAdminPage === 'dashboard') { initDashboardPage(); }
  if (_currentAdminPage === 'access')    { loadAccessList(); }
  if (_currentAdminPage === 'homepage')  { initHomepagePage(); }
  if (_currentAdminPage === 'menu')      { initMenuPage(); }
  if (_currentAdminPage === 'header')    { initHeaderPage(); }
  if (_currentAdminPage === 'footer')    { initFooterPage(); }
  if (_currentAdminPage === 'articles')  { initArticlesPage(); }
  if (_currentAdminPage === 'activity')  { loadActivityLogs(); }
  if (_currentAdminPage === 'settings')  { initSettingsPage(); }
  if (_currentAdminPage === 'gallery')   {
    loadGalleryAssets();
  }
  if (_currentAdminPage === 'sections') {
    render();
    loadSectionsFromAPI();
  }

  // Update Global Sync status and language switcher buttons immediately
  updateGlobalSyncStatus();
  updateAllAdminLangButtons();
}

document.querySelectorAll('.sidebar-nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(el.dataset.page);
    // Silent access check on every navigation action
    if (Date.now() - _lastAccessCheck > 60000) checkMyAccess();
  });
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD ENGINE — Real-time Metrics & Analytics
═══════════════════════════════════════════════════════════════ */
var _isDashboardLoading = false;
var _cachedDashboardStats = null;

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function initDashboardPage(forceRefresh = false) {
  if (_isDashboardLoading) return;

  if (_cachedDashboardStats && !forceRefresh) {
    renderDashboardUI(_cachedDashboardStats);
    return;
  }

  _isDashboardLoading = true;
  const refreshBtn = document.getElementById('db-refresh-btn');
  const refreshIcon = document.getElementById('db-refresh-icon');
  if (refreshIcon) refreshIcon.style.animation = 'spin 0.8s linear infinite';
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const res = await fetch('/api/sections?action=dashboard_stats', { headers: _authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        _cachedDashboardStats = data;
        renderDashboardUI(data);
      }
    }
  } catch (e) {
    console.warn('[Dashboard load error]:', e);
  } finally {
    _isDashboardLoading = false;
    if (refreshIcon) refreshIcon.style.animation = '';
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function refreshDashboardMetrics() {
  initDashboardPage(true).then(() => {
    showToast('success', 'Dashboard metrics synchronized with live database');
  });
}

function renderDashboardUI(stats) {
  if (!stats) return;

  // 1. Views & Multi-Period Traffic
  const views = stats.views || {};
  const elLifetime = document.getElementById('db-stat-views-lifetime');
  const elLifetimeCard = document.getElementById('db-stat-views-lifetime-card');
  const elToday = document.getElementById('db-stat-views-today');
  const elVisitorsToday = document.getElementById('db-stat-visitors-today');
  const elWeek = document.getElementById('db-stat-views-week');
  const elMonth = document.getElementById('db-stat-views-month');
  const elYear = document.getElementById('db-stat-views-year');

  // Strip Chips
  const elStripTodayViews = document.getElementById('db-stat-strip-today-views');
  const elStripTodayVisitors = document.getElementById('db-stat-strip-today-visitors');
  const elStripWeekViews = document.getElementById('db-stat-strip-week-views');
  const elStripWeekVisitors = document.getElementById('db-stat-strip-week-visitors');
  const elStripMonthViews = document.getElementById('db-stat-strip-month-views');
  const elStripYearViews = document.getElementById('db-stat-strip-year-views');
  const elStripLifetimeViews = document.getElementById('db-stat-strip-lifetime-views');
  const elStripLifetimeVisitors = document.getElementById('db-stat-strip-lifetime-visitors');

  const lifetimePageviews = typeof views.lifetime === 'object'
    ? (views.lifetime.pageviews || 0)
    : (Number(views.lifetime) || 0);
  const lifetimeVisitors = typeof views.lifetime === 'object'
    ? (views.lifetime.visitors || 0)
    : (views.lifetimeVisitors || 0);

  const todayViews = typeof views.todayPageviews === 'number'
    ? views.todayPageviews
    : (Number(views.daily) || 0);
  const todayVisitors = typeof views.todayVisitors === 'number'
    ? views.todayVisitors
    : 0;

  const weeklyViews = typeof views.weeklyPageviews === 'number'
    ? views.weeklyPageviews
    : (typeof views.weekly === 'number' ? views.weekly : 0);
  const weeklyVisitors = typeof views.weeklyVisitors === 'number'
    ? views.weeklyVisitors
    : 0;

  const monthlyViews = Number(views.monthly) || 0;
  const yearlyViews = Number(views.yearly) || 0;

  // Card 4
  if (elLifetime) elLifetime.textContent = formatNumber(lifetimePageviews);
  if (elLifetimeCard) elLifetimeCard.textContent = `${formatNumber(lifetimePageviews)} views`;
  if (elToday) elToday.textContent = `${formatNumber(todayViews)} views`;
  if (elVisitorsToday) elVisitorsToday.textContent = formatNumber(todayVisitors);
  if (elWeek) elWeek.textContent = `${formatNumber(weeklyViews)} views`;
  if (elMonth) elMonth.textContent = `${formatNumber(monthlyViews)} views`;
  if (elYear) elYear.textContent = `${formatNumber(yearlyViews)} views`;

  // 5-Tier Strip
  if (elStripTodayViews) elStripTodayViews.textContent = formatNumber(todayViews);
  if (elStripTodayVisitors) elStripTodayVisitors.textContent = formatNumber(todayVisitors);
  if (elStripWeekViews) elStripWeekViews.textContent = formatNumber(weeklyViews);
  if (elStripWeekVisitors) elStripWeekVisitors.textContent = formatNumber(weeklyVisitors);
  if (elStripMonthViews) elStripMonthViews.textContent = formatNumber(monthlyViews);
  if (elStripYearViews) elStripYearViews.textContent = formatNumber(yearlyViews);
  if (elStripLifetimeViews) elStripLifetimeViews.textContent = formatNumber(lifetimePageviews);
  if (elStripLifetimeVisitors) elStripLifetimeVisitors.textContent = formatNumber(lifetimeVisitors);

  // 2. Articles
  const arts = stats.articles || {};
  const elArtTotal = document.getElementById('db-stat-articles-total');
  const elArtPub = document.getElementById('db-stat-articles-pub');
  const elArtDraft = document.getElementById('db-stat-articles-draft');
  const elArtTrash = document.getElementById('db-stat-articles-trash');
  if (elArtTotal) elArtTotal.textContent = formatNumber(arts.total || 0);
  if (elArtPub) elArtPub.textContent = formatNumber(arts.published || 0);
  if (elArtDraft) elArtDraft.textContent = formatNumber(arts.drafts || 0);
  if (elArtTrash) elArtTrash.textContent = formatNumber(arts.trash || 0);

  // 3. Team
  const team = stats.team || {};
  const elTeamTotal = document.getElementById('db-stat-team-total');
  const elTeamAdmins = document.getElementById('db-stat-team-admins');
  const elTeamMods = document.getElementById('db-stat-team-mods');
  if (elTeamTotal) elTeamTotal.textContent = formatNumber(team.total || 0);
  if (elTeamAdmins) elTeamAdmins.textContent = formatNumber(team.admins || 0);
  if (elTeamMods) elTeamMods.textContent = formatNumber(team.moderators || 0);

  // 4. Media
  const media = stats.media || {};
  const elMediaTotal = document.getElementById('db-stat-media-total');
  const elMediaPhotos = document.getElementById('db-stat-media-photos');
  const elMediaSvgs = document.getElementById('db-stat-media-svgs');
  const elMediaSize = document.getElementById('db-stat-media-size');
  if (elMediaTotal) elMediaTotal.textContent = formatNumber(media.totalFiles || 0);
  if (elMediaPhotos) elMediaPhotos.textContent = formatNumber(media.photos || 0);
  if (elMediaSvgs) elMediaSvgs.textContent = formatNumber(media.svgs || 0);
  if (elMediaSize) elMediaSize.textContent = formatBytes(media.totalBytes || 0);

  // 5. 7-Day Chart Visualizer
  render7DayChart(views.last7Days || []);

  // 6. Recent Articles Table
  renderRecentArticlesTable(arts.recent || []);

  // 7. Recent Activity Feed
  renderRecentActivityFeed(stats.recentLogs || []);

  // 8. Update time label
  const elUpdated = document.getElementById('db-last-updated-text');
  if (elUpdated) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    elUpdated.textContent = `Live (${timeStr})`;
  }
}

function render7DayChart(daysArray) {
  const container = document.getElementById('db-chart-bars');
  if (!container) return;

  if (!daysArray || !daysArray.length) {
    container.innerHTML = `<div style="width:100%;text-align:center;color:var(--text-muted);font-size:12px;padding:32px;">No historical view data recorded yet</div>`;
    return;
  }

  const rawMax = Math.max(...daysArray.map(d => (d.pageviews !== undefined ? d.pageviews : (d.views || 0))), 0);
  const maxViews = rawMax > 0 ? rawMax : 10;
  const totalViews = daysArray.reduce((acc, d) => acc + (d.pageviews !== undefined ? d.pageviews : (d.views || 0)), 0);
  const avgDaily = Math.round(totalViews / daysArray.length);

  const avgEl = document.getElementById('db-avg-daily-val');
  if (avgEl) avgEl.textContent = `${formatNumber(avgDaily)} / day`;

  container.innerHTML = daysArray.map(d => {
    const v = d.pageviews !== undefined ? d.pageviews : (d.views || 0);
    const visitors = d.visitors || 0;
    const pct = rawMax > 0 ? Math.round((v / maxViews) * 100) : 0;
    const formattedDate = d.date ? d.date.slice(5) : ''; // MM-DD
    const tooltip = `${escapeHtml(d.day || '')} (${escapeHtml(d.date || '')}): ${formatNumber(v)} pageviews • ${formatNumber(visitors)} unique visitors`;

    return `
      <div class="db-bar-col">
        <div class="db-bar-wrap" title="${tooltip}">
          <div class="db-bar-val-badge">${formatNumber(v)} views</div>
          <div class="db-bar-fill" style="height:${pct > 0 ? Math.max(8, pct) : 0}%;opacity:${v > 0 ? '1' : '0.2'};"></div>
        </div>
        <span class="db-bar-day">${escapeHtml(d.day || '')}</span>
        <span class="db-bar-date">${escapeHtml(formattedDate)}</span>
      </div>
    `;
  }).join('');
}


function renderRecentArticlesTable(recentList) {
  const tbody = document.getElementById('db-recent-articles-tbody');
  if (!tbody) return;

  if (!recentList || !recentList.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:36px;color:var(--text-muted);font-size:13px;">
          No articles published yet. <a href="admin-article-editor.html" style="color:var(--brand);font-weight:600;margin-left:4px;">Write your first article →</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recentList.map(art => {
    const isPub = art.status === 'published';
    const pillClass = isPub ? 'db-art-pill--pub' : 'db-art-pill--draft';
    const statusText = isPub ? 'Published' : 'Draft';
    const title = art.title || art.title_bn || 'Untitled Story';
    const author = art.author || 'The Privatian Society';
    const sec = art.section || 'General';

    return `
      <tr>
        <td>
          <div style="font-weight:600;color:#0f172a;line-height:1.3;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(title)}">
            ${escapeHtml(title)}
          </div>
        </td>
        <td><span class="db-art-sec-badge">${escapeHtml(sec)}</span></td>
        <td style="color:#64748b;font-size:12.5px;">${escapeHtml(author)}</td>
        <td><span class="db-art-pill ${pillClass}">${statusText}</span></td>
        <td class="tar">
          <a href="admin-article-editor.html?id=${encodeURIComponent(art.id)}" class="btn btn--secondary btn--xs" style="padding:4px 10px;font-size:11.5px;text-decoration:none;">Edit</a>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecentActivityFeed(logs) {
  const feed = document.getElementById('db-activity-feed');
  if (!feed) return;

  if (!logs || !logs.length) {
    feed.innerHTML = `
      <div style="text-align:center;padding:32px;color:var(--text-muted);font-size:12.5px;">
        No recent administrative activity recorded.
      </div>
    `;
    return;
  }

  feed.innerHTML = logs.slice(0, 5).map(log => {
    const actorEmail = (log.actor && (log.actor.name || log.actor.email)) || log.user_email || 'System';
    const initials = actorEmail.charAt(0).toUpperCase();
    const summary = log.summary || log.action || 'System modification';
    const timeStr = log.created_at ? formatRelativeTime(new Date(log.created_at)) : 'Recently';

    return `
      <div class="db-activity-item">
        <div class="db-activity-avatar" title="${escapeHtml(actorEmail)}">${initials}</div>
        <div class="db-activity-body">
          <span class="db-activity-summary">${escapeHtml(summary)}</span>
          <span class="db-activity-time">${escapeHtml(timeStr)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function formatRelativeTime(date) {
  if (!date || isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════
   UNSAVED MODIFICATIONS BROWSER LEAVE / REFRESH PROTECTION
═══════════════════════════════════════════════════════════════ */
window.addEventListener('beforeunload', function (e) {
  let hasUnsaved = false;
  if (typeof isHeaderModified === 'function' && isHeaderModified()) hasUnsaved = true;
  if (typeof isFooterModified === 'function' && isFooterModified()) hasUnsaved = true;
  if (typeof isMenuModified === 'function' && isMenuModified()) hasUnsaved = true;
  if (typeof isHomepageModified === 'function' && isHomepageModified()) hasUnsaved = true;
  if (window._hasUnsavedAdminChanges === true) hasUnsaved = true;

  if (hasUnsaved) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes in the admin panel. Are you sure you want to leave or refresh?';
    return e.returnValue;
  }
});

// ── Toast ───────────────────────────────────────────────────────
function showToast(type, message, actionLabel, actionFn) {
  const iconMap = { success: ICONS.check, warning: ICONS.warn, error: ICONS.error };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || ''}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    ${actionLabel ? `<button class="toast-action" id="toast-undo">${actionLabel}</button>` : ''}
    <button class="toast-dismiss" aria-label="Dismiss">${ICONS.xSmall}</button>
  `;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 210);
  };

  if (actionLabel && actionFn) {
    toast.querySelector('#toast-undo').addEventListener('click', () => {
      actionFn();
      dismiss();
    });
  }

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  setTimeout(dismiss, 4500);
}

// ── Helpers ─────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// -- INIT: Boot initial page based on URL hash or localStorage, default to dashboard --
const _initialPage = window.location.hash.replace(/^#/, '') || localStorage.getItem('pf_admin_current_page') || 'dashboard';
navigateTo(_initialPage);
sections = [ALL_SECTION]; // show immediately while API loads
render();
loadSectionsFromAPI();   // async: fetches /api/sections?status=all
initAccessPage();        // boot access page guard immediately

// -- Sync utility (API-based) --
let _lastSyncedAt = null;

function updateSyncBadge(done) {
  _lastSyncedAt = new Date();
  const el = document.getElementById('sync-badge');
  if (!el) return;
  el.textContent = 'Synced';
  el.title = _lastSyncedAt.toLocaleTimeString();
}

// Auto-refresh from API when tab becomes visible
let _lastVisibleSync = 0;
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    const since = Date.now() - _lastVisibleSync;
    if (since > 20000) {
      _lastVisibleSync = Date.now();
      loadSectionsFromAPI();
    }
  }
});

// Inject sync badge (click to refresh)
(function() {
  function injectSyncBadge() {
    var pageHeader = document.querySelector('.page-header');
    if (!pageHeader || document.getElementById('sync-badge')) return;
    var badge = document.createElement('span');
    badge.id = 'sync-badge';
    badge.style.cssText = 'font-size:11px;color:#9ca3af;margin-left:8px;cursor:pointer;';
    badge.title = 'Click to refresh from database';
    badge.textContent = 'Loading...';
    badge.onclick = function() { loadSectionsFromAPI(); };
    pageHeader.appendChild(badge);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSyncBadge);
  } else {
    setTimeout(injectSyncBadge, 500);
  }
})();

// =================================================================
// MANAGE ACCESS PAGE
// =================================================================

function initAccessPage() {
  const user = window.PRIVATIAN_USER;
  const li = document.getElementById('nav-access-li');
  if (li) {
    if (!user || user.role === 'Admin') {
      li.style.display = '';
    } else {
      li.style.display = 'none';
    }
  }
  const addBtn = document.getElementById('access-add-btn');
  if (addBtn && !addBtn._hasClick) {
    addBtn._hasClick = true;
    addBtn.addEventListener('click', addAdminEmail);
  }
  const emailInput = document.getElementById('access-email-input');
  if (emailInput && !emailInput._hasEnter) {
    emailInput._hasEnter = true;
    emailInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addAdminEmail();
      }
    });
  }
}

// ── Reusable confirmation modal ─────────────────────────────────
function _confirmModal({ title, body, message, confirmText, confirmLabel, confirmColor, variant, danger, onConfirm }) {
  var _body    = body || message || '';
  var _btnText = confirmText || confirmLabel || 'Confirm';
  var _variant = variant || (danger === false ? 'success' : (danger === true ? 'danger' : 'navy'));
  if (confirmColor && confirmColor === '#dc2626') _variant = 'danger';
  else if (confirmColor && (confirmColor === '#d97706' || confirmColor === '#f59e0b')) _variant = 'warning';
  else if (confirmColor && confirmColor === '#059669') _variant = 'success';
  else if (confirmColor && confirmColor === '#7c3aed') _variant = 'purple';

  var themes = {
    danger:  {
      iconBg: '#fee2e2',
      iconBorder: '#fecaca',
      iconColor: '#dc2626',
      btnBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      btnShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
    },
    warning: {
      iconBg: '#fef3c7',
      iconBorder: '#fde68a',
      iconColor: '#d97706',
      btnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      btnShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
      icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    },
    success: {
      iconBg: '#d1fae5',
      iconBorder: '#a7f3d0',
      iconColor: '#059669',
      btnBg: 'linear-gradient(135deg, #10b981, #059669)',
      btnShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
      icon: '<circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 15 10"/>'
    },
    purple:  {
      iconBg: '#ede9fe',
      iconBorder: '#ddd6fe',
      iconColor: '#7c3aed',
      btnBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      btnShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
      icon: '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M4 20h16"/>'
    },
    navy:    {
      iconBg: '#e0f2fe',
      iconBorder: '#bae6fd',
      iconColor: '#0284c7',
      btnBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
      btnShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
      icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    }
  };
  var t = themes[_variant] || themes.navy;
  var ex = document.getElementById('_confirm-modal-overlay');
  if (ex) ex.remove();
  if (!document.getElementById('_cm-style')) {
    var s = document.createElement('style'); s.id = '_cm-style';
    s.textContent = '@keyframes _cmFIn{from{opacity:0}to{opacity:1}}@keyframes _cmSlUp{from{opacity:0;transform:translateY(20px) scale(.94)}to{opacity:1;transform:none}}._cm-card{animation:_cmSlUp .22s cubic-bezier(0.16, 1, 0.3, 1) both}._cm-btn{transition:all .15s ease;font-family:inherit;cursor:pointer;border:none;outline:none;}._cm-btn:hover{filter:brightness(1.06);transform:translateY(-1px);}._cm-btn:active{transform:scale(.97)}';
    document.head.appendChild(s);
  }
  var overlay = document.createElement('div');
  overlay.id = '_confirm-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.6);backdrop-filter:blur(8px);animation:_cmFIn .15s ease;padding:20px;';
  overlay.innerHTML = '<div class="_cm-card" style="background:#fff;border-radius:20px;padding:32px 28px 26px;max-width:440px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,.25),0 0 0 1px rgba(0,0,0,.06);text-align:center;position:relative;">'
    + '<button id="_cm-x" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:#94a3b8;padding:6px;border-radius:8px;font-size:18px;line-height:1;transition:all .15s;" onmouseover="this.style.color=\'#334155\';this.style.background=\'#f1f5f9\';" onmouseout="this.style.color=\'#94a3b8\';this.style.background=\'none\';">&times;</button>'
    + '<div style="width:54px;height:54px;border-radius:14px;background:' + t.iconBg + ';border:1.5px solid ' + t.iconBorder + ';display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="' + t.iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26">' + t.icon + '</svg></div>'
    + '<h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px;letter-spacing:-.015em;">' + escapeHtml(title) + '</h3>'
    + '<div style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 24px;">' + _body + '</div>'
    + '<div style="display:flex;gap:10px;justify-content:center;">'
    + '<button id="_cm-cancel" class="_cm-btn" style="background:#f8fafc;color:#475569;padding:10px 22px;border-radius:10px;font-size:13.5px;font-weight:600;border:1px solid #cbd5e1;">Cancel</button>'
    + '<button id="_cm-ok" class="_cm-btn" style="background:' + t.btnBg + ';color:#fff;padding:10px 24px;border-radius:10px;font-size:13.5px;font-weight:700;box-shadow:' + t.btnShadow + ';min-width:120px;">' + escapeHtml(_btnText) + '</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  var close = function(){ overlay.remove(); };
  overlay.querySelector('#_cm-cancel').onclick = close;
  overlay.querySelector('#_cm-x').onclick      = close;
  overlay.querySelector('#_cm-ok').onclick     = function(){ close(); onConfirm(); };
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
  setTimeout(function(){ var ok=overlay.querySelector('#_cm-ok'); if(ok)ok.focus(); }, 50);
}

// ── Min-admins info popup ────────────────────────────────────────
function _minAdminPopup(extra) {
  const body = `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;text-align:left;margin:6px 0 16px;">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#92400e;font-size:13.5px;margin-bottom:6px;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        At least 2 Gmail Admins Required
      </div>
      <div style="font-size:12.5px;color:#78350f;line-height:1.5;">
        The system security policy mandates at least <strong>2 active @gmail.com Administrator</strong> accounts at all times to prevent account lockout.
      </div>
    </div>
    <div style="font-size:13px;color:#475569;line-height:1.5;">
      ${extra ? `<p style="margin:0 0 8px;color:#dc2626;font-weight:600;">${extra}</p>` : ''}
      Please add or promote another <code style="background:#f1f5f9;color:#0f172a;padding:2px 6px;border-radius:5px;font-weight:600;border:1px solid #e2e8f0;">@gmail.com</code> Admin account before modifying or removing this user.
    </div>
  `;
  _confirmModal({
    title: 'Security Policy Requirement',
    body,
    confirmText: 'Understood',
    variant: 'navy',
    onConfirm: () => {}
  });
}

// ── Tab & Filter state ───────────────────────────────────────────
let _accessTab = 'active';
let _accessSearchQuery = '';
let _accessRoleFilter = 'all';
let _rawAdminList = [];

function _selectGrantRole(role) {
  const options = document.querySelectorAll('.access-role-card-opt');
  options.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.role === role);
  });
  const sel = document.getElementById('access-role-select');
  if (sel) sel.value = role;
}
window._selectGrantRole = _selectGrantRole;

function _setAccessTab(tab) {
  _accessTab = tab;
  ['active', 'suspended', 'recycle'].forEach(t => {
    const btn = document.getElementById('access-tab-' + t);
    const pnl = document.getElementById('access-panel-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (pnl) pnl.hidden = (t !== tab);
  });
  renderAccessLists();
}
window._setAccessTab = _setAccessTab;

function _handleAccessSearch() {
  const inp = document.getElementById('access-search-input');
  const clearBtn = document.getElementById('access-search-clear');
  _accessSearchQuery = inp ? inp.value.trim().toLowerCase() : '';
  if (clearBtn) clearBtn.style.display = _accessSearchQuery ? 'block' : 'none';
  renderAccessLists();
}
window._handleAccessSearch = _handleAccessSearch;

function _clearAccessSearch() {
  const inp = document.getElementById('access-search-input');
  const clearBtn = document.getElementById('access-search-clear');
  if (inp) { inp.value = ''; inp.focus(); }
  if (clearBtn) clearBtn.style.display = 'none';
  _accessSearchQuery = '';
  renderAccessLists();
}
window._clearAccessSearch = _clearAccessSearch;

function _handleAccessFilterChange() {
  const sel = document.getElementById('access-role-filter');
  _accessRoleFilter = sel ? sel.value : 'all';
  renderAccessLists();
}
window._handleAccessFilterChange = _handleAccessFilterChange;

function _getAvatarGradient(email) {
  const gradients = [
    'linear-gradient(135deg, #0a528e, #083d6b)',
    'linear-gradient(135deg, #0f172a, #1e293b)',
    'linear-gradient(135deg, #1e3a5f, #0a528e)',
    'linear-gradient(135deg, #1e293b, #334155)',
    'linear-gradient(135deg, #071e38, #0a528e)',
    'linear-gradient(135deg, #172554, #1e3a8a)'
  ];
  let hash = 0;
  const str = email || 'U';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % gradients.length;
  const namePart = str.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const initials = namePart.length >= 2 ? (namePart[0] + namePart[1]).toUpperCase() : (namePart[0] || 'U').toUpperCase();
  return { gradient: gradients[idx], initials };
}

function _auditLine(a) {
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const LABELS = {
    suspended:                 'Suspended by',
    unsuspended:               'Unsuspended by',
    deleted:                   'Moved to Recycle by',
    restored:                  'Restored by',
    role_changed_to_Admin:     'Promoted to Admin by',
    role_changed_to_Moderator: 'Set to Moderator by',
  };
  if (a.modified_by && a.modified_action) {
    const label = LABELS[a.modified_action] || (a.modified_action + ' by');
    return `<span>${escapeHtml(label)} <strong>${escapeHtml(a.modified_by)}</strong> &middot; ${fmt(a.modified_at)}</span>`;
  }
  return `<span>Added by <strong>${escapeHtml(a.added_by || 'system')}</strong> &middot; ${fmt(a.added_at)}</span>`;
}

function renderAccessLists() {
  const all = _rawAdminList || [];
  const me = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();

  // 1. Update KPI counters
  const totalWhitelisted = all.length;
  const activeAdmins     = all.filter(a => a.status === 'active' && a.role === 'Admin').length;
  const activeMods       = all.filter(a => a.status === 'active' && a.role === 'Moderator').length;
  const revokedCount     = all.filter(a => a.status === 'suspended' || a.status === 'deleted').length;

  const elTotal = document.getElementById('access-kpi-total');
  const elAdmins = document.getElementById('access-kpi-admins');
  const elMods   = document.getElementById('access-kpi-moderators');
  const elRevoked = document.getElementById('access-kpi-revoked');
  if (elTotal) elTotal.textContent = totalWhitelisted;
  if (elAdmins) elAdmins.textContent = activeAdmins;
  if (elMods) elMods.textContent = activeMods;
  if (elRevoked) elRevoked.textContent = revokedCount;

  // 2. Update Tab count badges
  const cActive    = all.filter(a => a.status === 'active').length;
  const cSuspended = all.filter(a => a.status === 'suspended').length;
  const cRecycle   = all.filter(a => a.status === 'deleted').length;

  const tcA = document.getElementById('access-tab-count-active');
  const tcS = document.getElementById('access-tab-count-suspended');
  const tcR = document.getElementById('access-tab-count-recycle');
  if (tcA) tcA.textContent = cActive;
  if (tcS) tcS.textContent = cSuspended;
  if (tcR) tcR.textContent = cRecycle;

  // 3. Filter list by Tab, Search query, and Role dropdown
  function filterItems(statusTarget) {
    return all.filter(a => {
      // Tab status match
      const statusMatch = (statusTarget === 'recycle') ? (a.status === 'deleted') : (a.status === statusTarget);
      if (!statusMatch) return false;

      // Role dropdown filter
      if (_accessRoleFilter !== 'all' && a.role !== _accessRoleFilter) return false;

      // Search query
      if (_accessSearchQuery) {
        const text = `${a.email} ${a.role} ${a.full_name || ''} ${a.university || ''} ${a.university_id || ''} ${a.university_mail || ''} ${a.mobile_number || ''} ${a.added_by || ''} ${a.modified_by || ''} ${a.modified_action || ''}`.toLowerCase();
        if (!text.includes(_accessSearchQuery)) return false;
      }
      return true;
    });
  }

  const activeFiltered    = filterItems('active');
  const suspendedFiltered = filterItems('suspended');
  const recycleFiltered   = filterItems('recycle');

  function renderRow(a, panel) {
    const isSelf = a.email.toLowerCase() === me;
    const { gradient, initials } = _getAvatarGradient(a.email);
    const isAdmin = (a.role === 'Admin');

    const roleBadge = isAdmin
      ? `<span class="access-role-pill admin"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M4 20h16"/></svg> Admin</span>`
      : `<span class="access-role-pill moderator"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Moderator</span>`;

    let statusBadge = '';
    if (a.status === 'active') {
      statusBadge = `<span class="access-status-pill active"><span class="access-tab-dot active"></span> Active</span>`;
    } else if (a.status === 'suspended') {
      statusBadge = `<span class="access-status-pill suspended"><span class="access-tab-dot suspended"></span> Suspended</span>`;
    } else {
      statusBadge = `<span class="access-status-pill recycle"><span class="access-tab-dot recycle"></span> In Recycle</span>`;
    }

    const profileBtn = `
      <button class="access-action-btn secondary" title="View & Edit User Profile" onclick="openAdminProfileModal('${a.id}')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Profile
      </button>
    `;

    let actionsHtml = '';
    if (isSelf) {
      actionsHtml = `
        ${profileBtn}
        <span class="access-user-you-tag" title="Protected: Your active session cannot be modified by yourself"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Active (You)</span>
      `;
    } else if (panel === 'recycle') {
      actionsHtml = `
        <button class="access-action-btn success" onclick="restoreAdmin('${a.id}','${escapeHtml(a.email)}','${a.role || ''}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
          Restore
        </button>
        <button class="access-action-btn danger" onclick="purgeAdmin('${a.id}','${escapeHtml(a.email)}','${a.role || ''}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete Forever
        </button>
      `;
    } else {
      const targetRole = isAdmin ? 'Moderator' : 'Admin';
      const roleToggleBtn = `
        <button class="access-action-btn secondary" title="Switch role to ${targetRole}" onclick="changeAdminRole('${a.id}','${escapeHtml(a.email)}','${targetRole}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Set as ${targetRole}
        </button>
      `;

      const suspendLabel = a.status === 'active' ? 'Suspend' : 'Unsuspend';
      const suspendNew   = a.status === 'active' ? 'suspended' : 'active';
      const suspendBtn = `
        <button class="access-action-btn warning" onclick="toggleAdminStatus('${a.id}','${suspendNew}','${escapeHtml(a.email)}','${a.role || ''}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          ${suspendLabel}
        </button>
      `;

      const removeBtn = `
        <button class="access-action-btn danger" onclick="removeAdmin('${a.id}','${escapeHtml(a.email)}','${a.role || ''}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Move to Recycle
        </button>
      `;

      actionsHtml = `${profileBtn} ${roleToggleBtn} ${suspendBtn} ${removeBtn}`;
    }

    const avatarHtml = a.profile_pic
      ? `<div class="access-avatar" style="background:transparent;padding:0;overflow:hidden;border:2px solid #0a528e;border-radius:50%;"><img src="${escapeHtml(a.profile_pic)}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" /></div>`
      : `<div class="access-avatar" style="background:${gradient};border-radius:50%;" title="${escapeHtml(a.email)}">${initials}</div>`;

    const userEmailHtml = a.full_name
      ? `<span class="access-user-fullname" style="font-weight:700;color:#0f172a;margin-right:6px;font-size:14px;">${escapeHtml(a.full_name)}</span><span class="access-user-email" style="font-size:12.5px;color:#64748b;font-weight:500;">(${escapeHtml(a.email)})</span>`
      : `<span class="access-user-email">${escapeHtml(a.email)}</span>`;

    const extraProfileDetails = (a.university || a.university_id || a.university_mail || a.mobile_number)
      ? `<div style="font-size:11.5px;color:#475569;margin-top:4px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">` +
          (a.university ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;padding:2px 7px;border-radius:5px;border:1px solid #e2e8f0;">🏛️ ${escapeHtml(a.university)}</span>` : '') +
          (a.university_id ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;padding:2px 7px;border-radius:5px;border:1px solid #e2e8f0;">🪪 ID: ${escapeHtml(a.university_id)}</span>` : '') +
          (a.university_mail ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;padding:2px 7px;border-radius:5px;border:1px solid #e2e8f0;">✉️ ${escapeHtml(a.university_mail)}</span>` : '') +
          (a.mobile_number ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;padding:2px 7px;border-radius:5px;border:1px solid #e2e8f0;">📱 ${escapeHtml(a.mobile_number)}</span>` : '') +
        `</div>`
      : '';

    return `
      <div class="access-user-card">
        ${avatarHtml}
        <div class="access-user-details">
          <div class="access-user-main-row">
            ${userEmailHtml}
            ${isSelf ? '<span class="access-user-you-tag">You</span>' : ''}
            ${roleBadge}
            ${statusBadge}
          </div>
          ${extraProfileDetails}
          <div class="access-user-meta">
            ${_auditLine(a)}
          </div>
        </div>
        <div class="access-actions-wrap">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  function renderEmpty(msg, submsg) {
    return `
      <div style="text-align:center;padding:48px 20px;color:#94a3b8;">
        <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#cbd5e1" stroke-width="1.6" style="margin:0 auto 12px;display:block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <div style="font-size:14.5px;font-weight:700;color:#475569;margin-bottom:4px;">${msg}</div>
        <div style="font-size:12.5px;color:#94a3b8;">${submsg || 'No users found matching your criteria.'}</div>
      </div>
    `;
  }

  const pA = document.getElementById('access-panel-active');
  const pS = document.getElementById('access-panel-suspended');
  const pR = document.getElementById('access-panel-recycle');

  if (pA) {
    pA.innerHTML = activeFiltered.length
      ? activeFiltered.map(a => renderRow(a, 'active')).join('')
      : renderEmpty('No Active Users Found', _accessSearchQuery ? 'Try clearing your search query or role filter.' : 'Add your first whitelisted email above.');
  }
  if (pS) {
    pS.innerHTML = suspendedFiltered.length
      ? suspendedFiltered.map(a => renderRow(a, 'suspended')).join('')
      : renderEmpty('No Suspended Accounts', 'Suspended accounts will appear here and can be unsuspended at any time.');
  }
  if (pR) {
    pR.innerHTML = recycleFiltered.length
      ? recycleFiltered.map(a => renderRow(a, 'recycle')).join('')
      : renderEmpty('Recycle Bin is Empty', 'Removed accounts are safely archived here before permanent deletion.');
  }
}

// ── Admin Profile Modal & Update Functions ─────────────────────────
function openAdminProfileModal(id) {
  const admin = _rawAdminList.find(x => x.id === id);
  if (!admin) {
    showToast('error', 'User not found in whitelist.');
    return;
  }

  const { gradient, initials } = _getAvatarGradient(admin.email);
  const currentPic = admin.profile_pic || '';

  const oldModal = document.getElementById('admin-profile-modal-overlay');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-profile-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(5px);z-index:99990;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:fadeIn .2s ease;';

  modal.innerHTML = `
    <div style="background:#ffffff;border-radius:20px;max-width:540px;width:100%;padding:26px 28px;box-shadow:0 25px 60px rgba(0,0,0,0.25);border:1px solid #e2e8f0;position:relative;box-sizing:border-box;max-height:92vh;overflow-y:auto;">
      
      <!-- Close Button -->
      <button type="button" onclick="closeAdminProfileModal()" style="position:absolute;top:20px;right:20px;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <!-- Header with Circular Avatar -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #f1f5f9;">
        <div id="prof-modal-avatar-preview" style="width:68px;height:68px;border-radius:50%;overflow:hidden;flex-shrink:0;border:3px solid #0a528e;display:flex;align-items:center;justify-content:center;background:${gradient};color:#fff;font-size:24px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          ${currentPic ? `<img src="${escapeHtml(currentPic)}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" />` : `<span>${initials}</span>`}
        </div>
        <div style="min-width:0;flex:1;">
          <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 3px;">User Profile</h3>
          <div style="font-size:13px;font-weight:500;color:#64748b;word-break:break-all;">${escapeHtml(admin.email)}</div>
          <div style="margin-top:5px;display:flex;gap:6px;">
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#eff6ff;color:#1d4ed8;">${escapeHtml(admin.role)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#f0fdf4;color:#16a34a;">${escapeHtml(admin.status)}</span>
          </div>
        </div>
      </div>

      <!-- Profile Form -->
      <form id="admin-profile-form" onsubmit="handleSaveAdminProfile(event, '${admin.id}')" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        
        <div style="grid-column:1 / -1;">
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">Full Name (Optional)</label>
          <input type="text" id="prof-input-full-name" value="${escapeHtml(admin.full_name || '')}" placeholder="e.g. Rizwan Ahmed" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
        </div>

        <div style="grid-column:1 / -1;">
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">Profile Picture (Circle Avatar, Optional)</label>
          <div style="display:flex;gap:8px;">
            <input type="url" id="prof-input-pic-url" value="${escapeHtml(admin.profile_pic || '')}" placeholder="https://... or choose from Media Gallery" oninput="updateProfileModalAvatarLive(this.value, '${escapeHtml(admin.email)}')" style="flex:1;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
            <button type="button" onclick="openProfileMediaPicker('${escapeHtml(admin.email)}')" style="padding:0 14px;background:linear-gradient(135deg, #0a528e, #0284c7);border:none;border-radius:10px;font-size:12.5px;font-weight:600;color:#ffffff;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:all .2s;box-shadow:0 2px 8px rgba(10,82,142,0.25);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Media Gallery &amp; Upload
            </button>
            <input type="file" id="prof-pic-file-input" accept="image/*" style="display:none;" onchange="handleProfileModalFileUpload(event, '${escapeHtml(admin.email)}')" />
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Upload from your computer or choose an existing photo from Cloudflare R2 Media Gallery.</div>
        </div>

        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">University (Optional)</label>
          <input type="text" id="prof-input-university" value="${escapeHtml(admin.university || '')}" placeholder="e.g. North South University" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
        </div>

        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">University ID (Optional)</label>
          <input type="text" id="prof-input-uni-id" value="${escapeHtml(admin.university_id || '')}" placeholder="e.g. 2121234" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
        </div>

        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">University Email (Optional)</label>
          <input type="email" id="prof-input-uni-mail" value="${escapeHtml(admin.university_mail || '')}" placeholder="e.g. student@nsu.edu" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
        </div>

        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;">Mobile Number (Optional)</label>
          <input type="tel" id="prof-input-mobile" value="${escapeHtml(admin.mobile_number || '')}" placeholder="e.g. +880 1700-000000" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#0a528e'" onblur="this.style.borderColor='#cbd5e1'" />
        </div>

        <div style="grid-column:1 / -1;display:flex;justify-content:flex-end;gap:10px;margin-top:10px;padding-top:16px;border-top:1px solid #f1f5f9;">
          <button type="button" onclick="closeAdminProfileModal()" style="padding:10px 18px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;transition:all .2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">Cancel</button>
          <button type="submit" id="prof-modal-save-btn" style="padding:10px 22px;background:linear-gradient(135deg, #0a528e, #0284c7);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(10,82,142,0.35);display:flex;align-items:center;gap:6px;transition:all .2s;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Profile
          </button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(modal);
}

function openProfileMediaPicker(email) {
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Choose or Upload Profile Picture',
      subtitle: 'Upload a photo from PC, paste URL, or select from Cloudflare R2 Media Gallery',
      defaultTab: 'upload',
      allowIdInput: true,
      targetFolder: 'Avatars & Profiles',
      onSelect: item => {
        const picUrl = (item && item.url) || '';
        if (!picUrl) return;
        const inp = document.getElementById('prof-input-pic-url');
        if (inp) inp.value = picUrl;
        updateProfileModalAvatarLive(picUrl, email);
        showToast('success', `Profile picture selected from Media Gallery: ${item.title || item.uniqueId || 'Asset'}`);
      }
    });
  } else {
    const directFileInp = document.getElementById('prof-pic-file-input');
    if (directFileInp) directFileInp.click();
  }
}

function closeAdminProfileModal() {
  const modal = document.getElementById('admin-profile-modal-overlay');
  if (modal) modal.remove();
}

function updateProfileModalAvatarLive(url, email) {
  const container = document.getElementById('prof-modal-avatar-preview');
  if (!container) return;
  const trimmed = (url || '').trim();
  if (trimmed) {
    container.innerHTML = `<img src="${escapeHtml(trimmed)}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.parentElement.innerHTML='<span style=\\'font-size:20px;\\'>⚠️</span>';" />`;
  } else {
    const { initials } = _getAvatarGradient(email || '');
    container.innerHTML = `<span>${initials}</span>`;
  }
}

function handleProfileModalFileUpload(event, email) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('error', 'Please select a valid image file (JPG, PNG, WebP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const input = document.getElementById('prof-input-pic-url');
      if (input) input.value = dataUrl;
      updateProfileModalAvatarLive(dataUrl, email);
      showToast('success', 'Image processed! Click "Save Profile" to save.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function handleSaveAdminProfile(event, id) {
  event.preventDefault();
  const btn = document.getElementById('prof-modal-save-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span> Saving...';
  }

  const fullName   = (document.getElementById('prof-input-full-name')?.value || '').trim();
  const picUrl     = (document.getElementById('prof-input-pic-url')?.value || '').trim();
  const university = (document.getElementById('prof-input-university')?.value || '').trim();
  const uniId      = (document.getElementById('prof-input-uni-id')?.value || '').trim();
  const uniMail    = (document.getElementById('prof-input-uni-mail')?.value || '').trim();
  const mobile     = (document.getElementById('prof-input-mobile')?.value || '').trim();

  try {
    const res = await fetch('/api/admins?action=update-profile&id=' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: _authHeaders(),
      body: JSON.stringify({
        full_name: fullName,
        profile_pic: picUrl,
        university: university,
        university_id: uniId,
        university_mail: uniMail,
        mobile_number: mobile
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save profile');

    showToast('success', 'Profile updated successfully in database!');

    // Update local cache
    const targetIdx = _rawAdminList.findIndex(x => x.id === id);
    if (targetIdx !== -1) {
      _rawAdminList[targetIdx] = {
        ..._rawAdminList[targetIdx],
        full_name: fullName,
        profile_pic: picUrl,
        university: university,
        university_id: uniId,
        university_mail: uniMail,
        mobile_number: mobile
      };
    }

    // If edited self, update current session
    const meEmail = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
    const admin = _rawAdminList.find(x => x.id === id);
    if (admin && admin.email.toLowerCase() === meEmail) {
      if (window.PRIVATIAN_USER) {
        window.PRIVATIAN_USER.name = fullName || admin.email.split('@')[0];
        window.PRIVATIAN_USER.full_name = fullName;
        window.PRIVATIAN_USER.picture = picUrl;
        window.PRIVATIAN_USER.profile_pic = picUrl;
        window.PRIVATIAN_USER.university = university;
        window.PRIVATIAN_USER.university_id = uniId;
        window.PRIVATIAN_USER.university_mail = uniMail;
        window.PRIVATIAN_USER.mobile_number = mobile;
      }
      // Re-inject sidebar user
      if (typeof window.injectSidebarUser === 'function') {
        window.injectSidebarUser(window.PRIVATIAN_USER);
      }
    }

    renderAccessLists();
    closeAdminProfileModal();

  } catch(err) {
    console.error('[handleSaveAdminProfile error]', err);
    showToast('error', err.message || 'Failed to save profile');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Profile';
    }
  }
}

// ── Load list from API / Supabase ─────────────────────────────────
async function loadAccessList() {
  const statusDot = document.getElementById('access-status-dot');
  const statusTxt = document.getElementById('access-save-status');
  if (statusDot) statusDot.style.background = '#f59e0b';
  if (statusTxt) statusTxt.textContent = 'Syncing...';

  try {
    let all = null;
    try {
      const res = await fetch('/api/admins?action=list&include_deleted=true', {
        headers: _authHeaders()
      });
      if (res.ok) {
        all = await res.json();
      }
    } catch(e) {}

    // Supabase fallback if API unreachable
    if (!Array.isArray(all)) {
      try {
        const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
        if (sb) {
          const { data, error } = await sb.from('allowed_admins').select('*');
          if (!error && Array.isArray(data)) all = data;
        }
      } catch(err) {}
    }

    if (!Array.isArray(all)) throw new Error('Failed to load admin list');

    _rawAdminList = all;
    renderAccessLists();

    if (statusDot) statusDot.style.background = '#10b981';
    if (statusTxt) statusTxt.textContent = 'Synced with database';
  } catch(e) {
    if (statusDot) statusDot.style.background = '#ef4444';
    if (statusTxt) statusTxt.textContent = 'Sync Error';
    console.warn('[Admin] loadAccessList error:', e.message);
  }
}

// ── Add admin ────────────────────────────────────────────────────
async function addAdminEmail() {
  const emailInput = document.getElementById('access-email-input');
  const roleSelect = document.getElementById('access-role-select');
  const email = (emailInput.value || '').trim().toLowerCase();
  const role  = roleSelect ? roleSelect.value : 'Admin';
  if (!email || !email.includes('@') || !email.includes('.')) { showToast('error', 'Please enter a valid email address.'); return; }
  try {
    const res  = await fetch('/api/admins?action=add', {
      method: 'POST', headers: _authHeaders(),
      body: JSON.stringify({ email, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    emailInput.value = '';
    showToast('success', email + ' added as ' + role + '.');
    loadAccessList();
    recordActivityLog({
      action: 'access.add_whitelist',
      category: 'access',
      summary: `Added "${email}" to Access Whitelist as ${role}`,
      target_id: email,
      target_name: email,
      details: { email, role }
    });
  } catch(e) { showToast('error', e.message || 'Failed to add.'); }
}

// ── Change role ──────────────────────────────────────────────────
function changeAdminRole(id, email, newRole) {
  const isPromote = (newRole === 'Admin');
  const targetTitle = isPromote ? 'Promote to Administrator' : 'Change to Moderator';
  const targetBody = isPromote
    ? `Promote <strong>${escapeHtml(email)}</strong> to <strong>Administrator</strong>?<br><div style="margin-top:10px;font-size:12.5px;color:#5b21b6;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Full Administrative Access:</strong> This user will receive unrestricted access including system settings, menus, header/footer, user access management, and activity logs.</div>`
    : `Change <strong>${escapeHtml(email)}</strong> to <strong>Moderator</strong>?<br><div style="margin-top:10px;font-size:12.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Editorial Privileges Only:</strong> Their administrative privileges will be limited to writing/publishing articles, managing media, and curating Section Studio.</div>`;

  _confirmModal({
    title:        targetTitle,
    body:         targetBody,
    confirmText:  isPromote ? 'Yes, Promote to Admin' : 'Yes, Change to Moderator',
    variant:      isPromote ? 'purple' : 'warning',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ role: newRole })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup('Cannot downgrade: Demoting this administrator would leave fewer than 2 active Gmail Admins.'); return; }
          throw new Error(data.error || 'Failed');
        }
        showToast('success', email + ' is now ' + newRole + '.');
        loadAccessList();
        recordActivityLog({
          action: 'access.change_role',
          category: 'access',
          summary: `Changed role for "${email}" to ${newRole}`,
          target_id: id,
          target_name: email,
          details: { id, email, newRole }
        });
      } catch(e) { showToast('error', e.message || 'Failed to change role.'); }
    }
  });
}

// ── Toggle status (suspend / unsuspend) ─────────────────────────
function toggleAdminStatus(id, newStatus, email, role) {
  const me = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
  if (email && email.toLowerCase() === me) { showToast('error', 'You cannot change your own status.'); return; }

  const u = _rawAdminList.find(x => x.id === id || (email && x.email.toLowerCase() === email.toLowerCase()));
  const userRole = (role || (u && u.role) || 'User');
  const roleLabel = (userRole === 'Moderator' ? 'Moderator' : 'Admin');
  const isSuspending = (newStatus === 'suspended');
  const actionLabel = isSuspending ? 'Suspend' : 'Unsuspend';

  const bodyHtml = isSuspending
    ? `Suspend access for ${roleLabel} <strong>${escapeHtml(email)}</strong>?<br><div style="margin-top:10px;font-size:12.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Temporary Suspension:</strong> This account will be immediately blocked on their next session check. You can unsuspend and restore their access at any time.</div>`
    : `Restore active access for ${roleLabel} <strong>${escapeHtml(email)}</strong>?<br><div style="margin-top:10px;font-size:12.5px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Immediate Access:</strong> This user will immediately regain full ${roleLabel} privileges upon next login.</div>`;

  _confirmModal({
    title:       `${actionLabel} ${roleLabel}`,
    body:        bodyHtml,
    confirmText: `${actionLabel} ${roleLabel}`,
    variant:     isSuspending ? 'warning' : 'success',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup('Cannot suspend: Suspending this administrator would leave fewer than 2 active Gmail Admins.'); return; }
          throw new Error(data.error || 'Failed');
        }
        showToast('success', `${roleLabel} status updated to ${newStatus}.`);
        loadAccessList();
        recordActivityLog({
          action: isSuspending ? 'access.suspend' : 'access.unsuspend',
          category: 'access',
          summary: `${actionLabel}ed ${roleLabel} access for "${email}"`,
          target_id: id,
          target_name: email,
          details: { id, email, status: newStatus, role: userRole }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Remove (soft-delete → Recycle) ──────────────────────────────
function removeAdmin(id, email, role) {
  const me = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
  if (email && email.toLowerCase() === me) { showToast('error', 'You cannot remove your own account.'); return; }

  const u = _rawAdminList.find(x => x.id === id || (email && x.email.toLowerCase() === email.toLowerCase()));
  const userRole = (role || (u && u.role) || 'User');
  const roleLabel = (userRole === 'Moderator' ? 'Moderator' : 'Admin');

  _confirmModal({
    title:       `Remove ${roleLabel}`,
    body:        `Move ${roleLabel} <strong>${escapeHtml(email)}</strong> to the Recycle Bin?<br><div style="margin-top:10px;font-size:12.5px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Safe Archival:</strong> This user will lose panel access immediately. The account is safely retained in the Recycle Bin and can be restored whenever needed.</div>`,
    confirmText: 'Move to Recycle',
    variant:     'danger',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=remove&id=' + id, { method: 'DELETE', headers: _authHeaders() });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup('Cannot remove: Removing this administrator would leave fewer than 2 active Gmail Admins.'); return; }
          throw new Error(data.message || data.error || 'Failed');
        }
        showToast('success', email + ' moved to Recycle.');
        loadAccessList();
        recordActivityLog({
          action: 'access.recycle',
          category: 'access',
          summary: `Moved admin "${email}" to Recycle Bin`,
          target_id: id,
          target_name: email,
          details: { id, email }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Restore from Recycle ─────────────────────────────────────────
function restoreAdmin(id, email, role) {
  const u = _rawAdminList.find(x => x.id === id || (email && x.email.toLowerCase() === email.toLowerCase()));
  const userRole = (role || (u && u.role) || 'Account');
  const roleLabel = (userRole === 'Moderator' ? 'Moderator' : (userRole === 'Admin' ? 'Admin' : 'Account'));

  _confirmModal({
    title:       `Restore ${roleLabel}`,
    body:        `Restore ${roleLabel} <strong>${escapeHtml(email)}</strong> back to <strong>Active</strong> status?<br><div style="margin-top:10px;font-size:12.5px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;">They will immediately regain their previous administrative privileges.</div>`,
    confirmText: `Yes, Restore ${roleLabel}`,
    variant:     'success',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ status: 'active' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', `${roleLabel} ${email} restored to Active.`);
        _setAccessTab('active');
        loadAccessList();
        recordActivityLog({
          action: 'access.restore',
          category: 'access',
          summary: `Restored ${roleLabel} "${email}" to Active status`,
          target_id: id,
          target_name: email,
          details: { id, email, role: userRole }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Permanent delete from Recycle ────────────────────────────────
function purgeAdmin(id, email, role) {
  const u = _rawAdminList.find(x => x.id === id || (email && x.email.toLowerCase() === email.toLowerCase()));
  const userRole = (role || (u && u.role) || 'Account');
  const roleLabel = (userRole === 'Moderator' ? 'Moderator' : (userRole === 'Admin' ? 'Admin' : 'Account'));

  _confirmModal({
    title:       `Permanently Delete ${roleLabel}`,
    body:        `<div style="margin-bottom:12px;font-size:12.5px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;text-align:left;line-height:1.5;"><strong style="display:block;margin-bottom:2px;">Irreversible Action:</strong> This will completely erase this record from the database. This action cannot be rolled back.</div>Are you sure you want to permanently delete <strong>${escapeHtml(email)}</strong>?`,
    confirmText: 'Delete Permanently',
    variant:     'danger',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=purge&id=' + id, { method: 'DELETE', headers: _authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', `${roleLabel} ${email} permanently deleted.`);
        loadAccessList();
        recordActivityLog({
          action: 'access.purge',
          category: 'access',
          summary: `Permanently purged ${roleLabel} account "${email}" from the database`,
          target_id: id,
          target_name: email,
          details: { id, email, role: userRole }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Silent access check ──────────────────────────────────────────
_lastAccessCheck = 0;
_accessRevoked   = false;

async function checkMyAccess() {
  const tok = _getAuthToken();
  if (_accessRevoked || !tok) return;
  _lastAccessCheck = Date.now();
  try {
    const res  = await fetch('/api/admins?action=check', { headers: { 'Authorization': 'Bearer ' + tok } });
    if (res.status === 401) { _revokeAccess('session_expired'); return; }
    const data = await res.json();
    if (!data.ok) { _revokeAccess(data.reason || 'revoked'); return; }
    // Role mismatch: DB role changed mid-session — force re-login so JWT is reissued correctly
    const jwtRole = window.PRIVATIAN_USER && window.PRIVATIAN_USER.role;
    if (data.role && jwtRole && data.role !== jwtRole) {
      _revokeAccess('role_changed');
    }
  } catch(e) { console.warn('[Admin] Access check error:', e.message); }
}

function _revokeAccess(reason) {
  if (_accessRevoked) return;
  _accessRevoked = true;
  const msg = reason === 'suspended'    ? 'Your account has been suspended.'
            : reason === 'deleted'      ? 'Your account has been removed.'
            : reason === 'role_changed' ? 'Your role has been updated. Please sign in again.'
            : reason === 'session_expired' ? 'Your session has expired.'
            : 'Your admin access has been revoked.';
  showToast('error', msg + ' Redirecting to login...');
  setTimeout(() => {
    // Clear ALL session data so login page cannot auto-login a suspended/deleted user
    localStorage.removeItem('privatian_token');
    document.cookie = 'privatian_session=; Max-Age=0; path=/';
    window.PRIVATIAN_TOKEN = null;
    window.location.replace('/admin-login.html');
  }, 3000);
}

setInterval(checkMyAccess, 30 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - _lastAccessCheck > 5 * 60 * 1000) checkMyAccess();
});
setTimeout(checkMyAccess, 10000);

window.addEventListener('privatian:ready', () => { initAccessPage(); checkMyAccess(); });

// HEADER SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════

function sanitizeLoadedHeaderData(data, lang) {
  const isBn = (lang === 'bn');
  const defaults = getHeaderDefaultSettings(lang);
  const res = Object.assign({}, defaults, data || {});

  if (isBn) {
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
      const BN_LABEL_MAP = { 'sub-1': 'পারিবারিক ঐতিহ্য', 'sub-2': 'অভিজ্ঞতা', 'sub-3': 'প্রাইভেটিয়ান পাঠ', 'sub-4': 'ইভেন্ট ও আয়োজন' };
      res.subsections = res.subsections.map(s => {
        if (!s.label || !/[\u0980-\u09FF]/.test(s.label)) {
          return { ...s, label: BN_LABEL_MAP[s.id] || s.label || 'বিভাগ' };
        }
        return s;
      });
    }
  } else {
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
      const EN_LABEL_MAP = { 'sub-1': 'FAMILY LEGACY', 'sub-2': 'EXPERIENCE', 'sub-3': 'THE PRIVATIAN READS', 'sub-4': 'EVENTS' };
      res.subsections = res.subsections.map(s => {
        if (s.label && /[\u0980-\u09FF]/.test(s.label)) {
          return { ...s, label: EN_LABEL_MAP[s.id] || 'SECTION' };
        }
        return s;
      });
    }
  }

  if (!res.subsections || !res.subsections.length) {
    res.subsections = defaults.subsections;
  }
  return res;
}

async function loadHeaderSettings() {
  const currentLang = _headerLang || 'en';
  const defaults = getHeaderDefaultSettings(currentLang);

  try {
    const data = await _apiGet('/api/sections?action=header' + (currentLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') {
      return sanitizeLoadedHeaderData(data, currentLang);
    }
  } catch(err) {
    console.warn('[Admin] loadHeaderSettings API failed (trying fallback):', err.message);
  }

  try {
    const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
    if (sb) {
      const targetAdminId = (currentLang === 'bn') ? '__header_config_bn__' : '__header_config__';
      const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
      if (sData && sData.name) {
        const parsed = JSON.parse(sData.name);
        if (parsed && typeof parsed === 'object') {
          return sanitizeLoadedHeaderData(parsed, currentLang);
        }
      }
    }
  } catch(e) {}

  return defaults;
}

// ── Header Settings Tab Switcher (Matches Navigation Menu standard) ──
function switchHeaderTab(tabKey) {
  const tabAliases = {
    '0': 'favicon', '1': 'logo', '2': 'nav', '3': 'subtabs', '4': 'preview',
    'tabcard': 'favicon', 'logo': 'logo', 'nav': 'nav', 'sub': 'subtabs', 'subtabs': 'subtabs', 'preview': 'preview', 'favicon': 'favicon'
  };
  const target = tabAliases[tabKey] || 'favicon';
  const tabs = ['favicon', 'logo', 'nav', 'subtabs', 'preview'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-hs-${t}`);
    const panel = document.getElementById(`panel-hs-${t}`);
    if (btn) btn.classList.toggle('active', t === target);
    if (panel) panel.style.display = (t === target ? 'block' : 'none');
  });
  
  if (target === 'preview') {
    renderHeaderPreviewCanvas();
  }
}

// Backward-compatibility aliases
function switchHeaderSlide(indexOrKey) {
  switchHeaderTab(indexOrKey);
}

function navigateHeaderSlide(delta) {
  const tabs = ['favicon', 'logo', 'nav', 'subtabs', 'preview'];
  const activeBtn = document.querySelector('.header-tab-bar .tab-btn.active');
  let currentIdx = 0;
  if (activeBtn) {
    const id = activeBtn.id.replace('tab-hs-', '');
    currentIdx = tabs.indexOf(id);
    if (currentIdx === -1) currentIdx = 0;
  }
  const nextIdx = Math.max(0, Math.min(tabs.length - 1, currentIdx + delta));
  switchHeaderTab(tabs[nextIdx]);
}

function initHeaderSliderGestures() {
  // Tabs naturally support horizontal scrolling on mobile
}

// ── Favicon Studio Helpers ───────────────────────────────────────
function updateFaviconPreviews(url) {
  const p16 = document.getElementById('hs-favicon-preview-16');
  const p32 = document.getElementById('hs-favicon-preview-32');
  const p48 = document.getElementById('hs-favicon-preview-48');
  const simTab = document.getElementById('browser-tab-sim-favicon');
  const simHover = document.getElementById('hover-card-sim-favicon');

  const cleanUrl = (url || '').trim();

  const setImgOrMonogram = (el, size, fontSize, borderRadius) => {
    if (!el) return;
    if (cleanUrl) {
      el.innerHTML = `<img src="${cleanUrl}" alt="Favicon" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML='P';this.parentElement.style.background='#0a528e';this.parentElement.style.color='#fff';">`;
      el.style.background = 'transparent';
    } else {
      el.innerHTML = 'P';
      el.style.background = '#0a528e';
      el.style.color = '#fff';
      el.style.fontSize = fontSize + 'px';
      el.style.fontWeight = '900';
    }
  };

  setImgOrMonogram(p16, 16, 9, 3);
  setImgOrMonogram(p32, 32, 14, 6);
  setImgOrMonogram(p48, 48, 20, 8);
  setImgOrMonogram(simTab, 14, 8, 7);
  setImgOrMonogram(simHover, 18, 10, 4);
}

function onFaviconUrlInput(url) {
  if (!_hsInstance) return;
  _hsInstance.faviconUrl = (url || '').trim();
  updateFaviconPreviews(_hsInstance.faviconUrl);
  updateGlobalSyncStatus();
}

/**
 * Universal Common Image Upload Modal for Favicon
 */
function openFaviconMediaModal() {
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Upload or Select Website Favicon',
      subtitle: 'Upload .ico / .png / .svg from PC, drag & drop, or browse Cloudflare R2 gallery',
      defaultTab: 'upload',
      allowIdInput: true,
      targetFolder: 'Logos & Icons',
      onSelect: item => {
        const inp = document.getElementById('hs-favicon-input');
        if (inp) inp.value = item.url;
        onFaviconUrlInput(item.url);
        showToast('success', `Favicon applied: ${item.title || item.uniqueId || 'Asset'}`);
      }
    });
  } else {
    const inp = document.getElementById('hs-favicon-file-input');
    if (inp) inp.click();
  }
}

// Export for backward compatibility
const openFaviconGalleryPicker = openFaviconMediaModal;

async function handleFaviconFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  
  showToast('info', 'Uploading favicon to Cloudflare R2...');
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const r = await fetch('/api/media?action=upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: e.target.result,
            filename: file.name,
            mimeType: file.type || 'image/png',
            fileSize: file.size,
            folder: 'Logos & Icons'
          })
        });
        const d = await r.json();
        if (!r.ok || !d.ok || !d.media) throw new Error(d.error || 'Upload failed');
        
        const inp = document.getElementById('hs-favicon-input');
        if (inp) inp.value = d.media.url;
        onFaviconUrlInput(d.media.url);
        showToast('success', `Favicon uploaded successfully! (${d.media.unique_id})`);
      } catch(err) {
        showToast('error', 'Favicon upload failed: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  } catch(e) {
    showToast('error', 'Favicon read failed: ' + e.message);
  }
  event.target.value = '';
}

function resetFaviconToDefault() {
  if (!_hsInstance) return;
  _hsInstance.faviconUrl = '';
  const inp = document.getElementById('hs-favicon-input');
  if (inp) inp.value = '';
  updateFaviconPreviews('');
  updateGlobalSyncStatus();
  showToast('info', 'Favicon reset to default monogram.');
}

function selectAllHeaderSections(selectBool) {
  const cbs = document.querySelectorAll('#hs-nav-sections-list input[type="checkbox"]');
  cbs.forEach(cb => { cb.checked = !!selectBool; });
  if (_hsInstance) {
    _hsInstance.enabledNavSections = getEnabledNavSections();
    updateGlobalSyncStatus();
  }
  showToast('info', selectBool ? 'All sections enabled in header navigation' : 'All sections disabled in header navigation');
}

// ── Interactive Header Preview Controls ───────────────────────────
var _headerPreviewViewport = 'desktop';
var _headerPreviewLang = null; // null => follow _headerLang

function setHeaderPreviewViewport(vp) {
  _headerPreviewViewport = vp || 'desktop';
  const wrap = document.getElementById('hs-preview-viewport-wrapper');
  if (wrap) {
    if (vp === 'mobile') {
      wrap.style.maxWidth = '390px';
    } else if (vp === 'tablet') {
      wrap.style.maxWidth = '768px';
    } else {
      wrap.style.maxWidth = '100%';
    }
  }
  ['desktop', 'tablet', 'mobile'].forEach(m => {
    const b = document.getElementById(`hs-vp-${m}`);
    if (b) {
      const active = (m === _headerPreviewViewport);
      b.classList.toggle('active', active);
      b.style.background = active ? '#38bdf8' : 'transparent';
      b.style.color = active ? '#0f172a' : '#94a3b8';
      b.style.fontWeight = active ? '700' : '500';
    }
  });
  renderHeaderPreviewCanvas();
}

function setHeaderPreviewLang(lang) {
  _headerPreviewLang = lang;
  ['en', 'bn'].forEach(l => {
    const b = document.getElementById(`hs-prevlang-${l}`);
    if (b) {
      const active = (l === (_headerPreviewLang || _headerLang));
      b.classList.toggle('active', active);
      b.style.background = active ? '#38bdf8' : 'transparent';
      b.style.color = active ? '#0f172a' : '#94a3b8';
      b.style.fontWeight = active ? '700' : '500';
    }
  });
  renderHeaderPreviewCanvas();
}

function renderHeaderPreviewCanvas() {
  const box = document.getElementById('hs-live-preview-box');
  if (!box || !_hsInstance) return;

  const previewLang = _headerPreviewLang || _headerLang || 'en';
  const isBn = (previewLang === 'bn');

  // Update preview language toggle buttons state
  ['en', 'bn'].forEach(l => {
    const b = document.getElementById(`hs-prevlang-${l}`);
    if (b) {
      const active = (l === previewLang);
      b.classList.toggle('active', active);
      b.style.background = active ? '#38bdf8' : 'transparent';
      b.style.color = active ? '#0f172a' : '#94a3b8';
      b.style.fontWeight = active ? '700' : '500';
    }
  });

  const allSecs = (sections || []).filter(s => !s.deleted);
  const enabledIds = Array.isArray(_hsInstance.enabledNavSections) ? _hsInstance.enabledNavSections : allSecs.map(s => s.slug || s.id);
  const orderedNavList = allSecs.filter(s => enabledIds.includes(s.slug || s.id));
  
  // Sort in the exact order specified by enabledIds
  orderedNavList.sort((a, b) => {
    const idA = a.slug || a.id;
    const idB = b.slug || b.id;
    return enabledIds.indexOf(idA) - enabledIds.indexOf(idB);
  });

  const subList = (_hsInstance.subsections || []).filter(s => s.enabled !== false);
  const logoH = _hsInstance.logoHeight || 80;
  const scaledH = Math.min(Math.max(logoH * 0.55, 32), 52);
  const renderedLogo = formatSvgWithSize(_hsInstance.logoSvg, scaledH);

  // Active titles & descriptions
  const siteTitle = _hsInstance.siteTitle || (isBn ? 'দ্য প্রাইভেটিয়ান ফ্যামিলি' : 'The Privatian Family');
  const tagline = _hsInstance.tabTagline || (isBn ? 'জ্ঞান, ঐতিহ্য ও জীবনের কথা' : 'Insights, Stories & Heritage');
  const browserTitle = _hsInstance.browserTabTitle || (siteTitle + (tagline ? ' — ' + tagline : ''));
  const faviconUrl = _hsInstance.faviconUrl || '';

  const faviconHtml = faviconUrl
    ? `<img src="${escapeHtml(faviconUrl)}" style="width:14px;height:14px;object-fit:cover;border-radius:2px;display:block;" onerror="this.outerHTML='<span style=\\'display:inline-block;width:14px;height:14px;background:#0a528e;color:#fff;border-radius:2px;font-size:9px;font-weight:900;text-align:center;line-height:14px;\\'>P</span>';">`
    : `<span style="display:inline-block;width:14px;height:14px;background:#0a528e;color:#fff;border-radius:2px;font-size:9px;font-weight:900;text-align:center;line-height:14px;">P</span>`;

  box.innerHTML = `
    <!-- Browser Mockup Window Chrome -->
    <div style="background:#1e293b;padding:9px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;user-select:none;">
      <div style="display:flex;align-items:center;gap:12px;">
        <!-- Window dots -->
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:11px;height:11px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
          <span style="width:11px;height:11px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
          <span style="width:11px;height:11px;border-radius:50%;background:#10b981;display:inline-block;"></span>
        </div>
        <!-- Active Browser Tab -->
        <div style="display:flex;align-items:center;gap:7px;background:#0f172a;padding:5px 14px;border-radius:6px 6px 0 0;border:1px solid #334155;border-bottom:none;max-width:280px;">
          ${faviconHtml}
          <span style="font-size:11.5px;color:#f8fafc;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(browserTitle)}</span>
        </div>
      </div>

      <!-- Address bar -->
      <div style="background:#0f172a;border:1px solid #334155;padding:4px 16px;border-radius:20px;display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8;flex:1;max-width:320px;margin:0 14px;">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style="color:#e2e8f0;font-weight:500;">theprivatianfamily.vercel.app</span>
      </div>

      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;">
        ${_headerPreviewViewport.toUpperCase()} PREVIEW
      </div>
    </div>

    <!-- Main Site Header -->
    <header class="preview-site-header" style="background:#ffffff;border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px;position:relative;z-index:2;">
      <!-- Logo & Tagline -->
      <div style="display:flex;flex-direction:column;align-items:flex-start;flex-shrink:0;">
        <div style="height:${scaledH}px;display:flex;align-items:center;">
          ${renderedLogo}
        </div>
        ${tagline ? `<span style="font-size:10.5px;color:#64748b;font-family:'Playfair Display',serif;letter-spacing:0.04em;margin-top:2px;font-style:italic;">${escapeHtml(tagline)}</span>` : ''}
      </div>

      <!-- Navigation Categories -->
      <nav style="display:flex;align-items:center;gap:8px;overflow-x:auto;flex:1;justify-content:center;padding:4px 0;scrollbar-width:none;">
        ${orderedNavList.map((s, idx) => `
          <a href="#" onclick="return false;" style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${idx === 0 ? '#0a528e' : '#334155'};white-space:nowrap;padding:5px 10px;border-radius:4px;background:${idx === 0 ? '#e0f2fe' : 'transparent'};border:${idx === 0 ? '1px solid #bae6fd' : '1px solid transparent'};text-decoration:none;transition:all 0.15s ease;">
            ${escapeHtml(isBn && s.name_bn ? s.name_bn : s.name)}
          </a>
        `).join('')}
      </nav>

      <!-- Right Header Actions (Language, Menu, Search) -->
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <!-- Language Switcher Pill -->
        <div style="display:flex;align-items:center;background:#f8fafc;border:1px solid #cbd5e1;border-radius:20px;padding:2px 4px;cursor:pointer;" onclick="setHeaderPreviewLang('${isBn ? 'en' : 'bn'}')" title="Click to test language switch in preview">
          <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:${!isBn ? '#0a528e' : 'transparent'};color:${!isBn ? '#ffffff' : '#64748b'};">EN</span>
          <span style="font-size:10px;color:#cbd5e1;margin:0 1px;">|</span>
          <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:${isBn ? '#0a528e' : 'transparent'};color:${isBn ? '#ffffff' : '#64748b'};">বাংলা</span>
        </div>

        <button type="button" style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #cbd5e1;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#0f172a;cursor:pointer;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span>${isBn ? 'মেন্যু' : 'Menu'}</span>
        </button>

        <!-- Search Button -->
        <div style="width:34px;height:34px;border-radius:50%;background:#f8fafc;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;color:#0f172a;cursor:pointer;" title="Search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </div>
    </header>

    <!-- Sub-header Bar -->
    <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:7px 24px;display:flex;align-items:center;gap:18px;overflow-x:auto;scrollbar-width:none;">
      ${subList.map(sub => `
        <a href="#" onclick="return false;" style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#475569;text-transform:uppercase;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;text-decoration:none;padding:2px 0;">
          ${sub.icon === 'calendar' ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#0a528e" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' : ''}
          <span>${escapeHtml(sub.label)}</span>
        </a>
      `).join('')}
    </div>

    <!-- Simulated Page Context (Hero Area Underneath) -->
    <div style="background:linear-gradient(180deg, #f1f5f9 0%, #ffffff 100%);padding:28px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0a528e;background:#e0f2fe;padding:3px 10px;border-radius:20px;margin-bottom:8px;">
        ${isBn ? 'কেমব্রিজ, ম্যাসাচুসেটস • অফিশিয়াল প্রকাশনা' : 'Cambridge, Massachusetts • Official Publication'}
      </span>
      <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:700;color:#0f172a;margin:4px 0 8px;">
        ${isBn ? 'জ্ঞান, ঐতিহ্য ও জীবনের সন্ধানে দ্য প্রাইভেটিয়ান ফ্যামিলি' : 'Documenting the Timeless Pursuit of Truth, Heritage & Distinction'}
      </h2>
      <p style="font-size:12.5px;color:#64748b;max-width:540px;margin:0 auto;line-height:1.5;">
        ${isBn ? 'এই লাইভ সিমুলেশনে ব্রাউজারের উপরে থাকা হেডার, লোগো স্কেল, সাব-হেডার ও ক্যাটাগরির অবস্থান পরীক্ষা করুন।' : 'Test and verify how your brand logo scale, navigation ordering, favicon badge, and multilingual strings appear across visitor devices.'}
      </p>
    </div>
  `;
}

// ── Browser Tab & Hover Card (SEO) ──────────────────────────────
function renderHsTabCard(hs) {
  const siteTitleInp = document.getElementById('hs-site-title-input');
  const tabTaglineInp = document.getElementById('hs-tab-tagline-input');
  const customTitleInp = document.getElementById('hs-tab-title-custom-input');
  const metaDescInp = document.getElementById('hs-meta-desc-input');
  const faviconInp = document.getElementById('hs-favicon-input');
  const tabPreview = document.getElementById('browser-tab-preview-title');
  const hoverPreview = document.getElementById('hover-card-preview-title');

  const isBn = (_headerLang === 'bn');
  const def = getHeaderDefaultSettings(_headerLang);

  if (siteTitleInp) siteTitleInp.value = hs.siteTitle || def.siteTitle;
  if (tabTaglineInp) tabTaglineInp.value = (hs.tabTagline !== undefined && hs.tabTagline !== null) ? hs.tabTagline : def.tabTagline;
  if (customTitleInp) customTitleInp.value = hs.browserTabTitle || '';
  if (metaDescInp) metaDescInp.value = hs.metaDescription || def.metaDescription;
  if (faviconInp) faviconInp.value = hs.faviconUrl || '';

  updateFaviconPreviews(hs.faviconUrl || '');

  function refreshTabCardPreview() {
    const brand = (siteTitleInp ? siteTitleInp.value.trim() : '') || def.siteTitle;
    const tag = (tabTaglineInp ? tabTaglineInp.value.trim() : '');
    const custom = customTitleInp ? customTitleInp.value.trim() : '';

    const finalTitle = custom || (brand + (tag ? ' — ' + tag : ''));
    if (tabPreview) tabPreview.textContent = finalTitle;
    if (hoverPreview) hoverPreview.textContent = finalTitle;
  }
  refreshTabCardPreview();

  if (siteTitleInp) {
    siteTitleInp.oninput = () => {
      hs.siteTitle = siteTitleInp.value.trim();
      if (!customTitleInp.value.trim() || customTitleInp.dataset.manual !== 'true') {
        const brand = hs.siteTitle || def.siteTitle;
        const tag = (tabTaglineInp ? tabTaglineInp.value.trim() : '');
        hs.browserTabTitle = brand + (tag ? ' — ' + tag : '');
        if (customTitleInp) customTitleInp.placeholder = hs.browserTabTitle;
      }
      refreshTabCardPreview();
      updateGlobalSyncStatus();
      renderHeaderPreviewCanvas();
    };
  }

  if (tabTaglineInp) {
    tabTaglineInp.oninput = () => {
      hs.tabTagline = tabTaglineInp.value.trim();
      if (!customTitleInp.value.trim() || customTitleInp.dataset.manual !== 'true') {
        const brand = (siteTitleInp ? siteTitleInp.value.trim() : '') || def.siteTitle;
        const tag = hs.tabTagline;
        hs.browserTabTitle = brand + (tag ? ' — ' + tag : '');
        if (customTitleInp) customTitleInp.placeholder = hs.browserTabTitle;
      }
      refreshTabCardPreview();
      updateGlobalSyncStatus();
      renderHeaderPreviewCanvas();
    };
  }

  if (customTitleInp) {
    customTitleInp.oninput = () => {
      customTitleInp.dataset.manual = customTitleInp.value.trim() ? 'true' : 'false';
      hs.browserTabTitle = customTitleInp.value.trim();
      refreshTabCardPreview();
      updateGlobalSyncStatus();
      renderHeaderPreviewCanvas();
    };
  }

  if (metaDescInp) {
    metaDescInp.oninput = () => {
      hs.metaDescription = metaDescInp.value.trim();
      updateGlobalSyncStatus();
    };
  }

  if (faviconInp) {
    faviconInp.oninput = () => {
      hs.faviconUrl = faviconInp.value.trim();
      updateFaviconPreviews(hs.faviconUrl);
      updateGlobalSyncStatus();
      renderHeaderPreviewCanvas();
    };
  }

  const cfTokenInp = document.getElementById('hs-cf-token-input');
  const cfStatusEl = document.getElementById('hs-cf-token-status');
  if (cfTokenInp) {
    cfTokenInp.value = hs.cloudflareAnalyticsToken || '';
    if (cfStatusEl) {
      cfStatusEl.textContent = hs.cloudflareAnalyticsToken ? 'Active & Tracking' : 'Not configured';
      cfStatusEl.style.color = hs.cloudflareAnalyticsToken ? '#10b981' : '#64748b';
    }
    cfTokenInp.oninput = () => {
      hs.cloudflareAnalyticsToken = cfTokenInp.value.trim();
      if (cfStatusEl) {
        cfStatusEl.textContent = hs.cloudflareAnalyticsToken ? 'Active & Tracking' : 'Not configured';
        cfStatusEl.style.color = hs.cloudflareAnalyticsToken ? '#10b981' : '#64748b';
      }
      updateGlobalSyncStatus();
    };
  }
}

async function saveHeaderSettings(hs) {
  const currentLang = _headerLang || 'en';
  hs.updatedAt = new Date().toISOString();
  hs.lang = currentLang;

  try {
    await _apiPost('/api/sections?action=header' + (currentLang === 'bn' ? '&lang=bn' : ''), hs);
  } catch(err) {
    console.warn('[Admin] saveHeaderSettings API error:', err.message);
  }
}

// ── HEADER BRAND LOGO & LIVE PREVIEW (MATCHING FOOTER STYLE) ─────────────
function handleHeaderSvgFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
    showToast('error', 'Only .svg files are supported!');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    if (text && text.trim().indexOf('<svg') !== -1) {
      const cleanSvg = text.trim();
      onHeaderLogoSvgInput(cleanSvg);
      const textarea = document.getElementById('hs-logo-svg-input');
      if (textarea) textarea.value = cleanSvg;
      showToast('success', 'Header SVG Logo loaded successfully!');
    } else {
      showToast('error', 'Invalid SVG file: Could not find <svg> element.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function openHeaderLogoPicker(opts = {}) {
  const defaultTab = typeof opts === 'string' ? opts : (opts && opts.defaultTab ? opts.defaultTab : 'gallery');
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Select or Upload Header SVG Logo',
      subtitle: 'Pick an SVG logo from gallery or upload new SVG file',
      targetFolder: 'Logos & Icons',
      defaultTab: defaultTab,
      type: 'svg',
      onSelect: async (item) => {
        if (!item) return;
        try {
          showToast('info', 'Loading SVG logo content...');
          let text = '';
          // 1. Try reading via backend proxy / read_text endpoint (CORS-safe & direct from R2)
          try {
            const token = _getAuthToken();
            const res = await fetch(`/api/media?action=read_text&id=${encodeURIComponent(item.unique_id || item.id || '')}&key=${encodeURIComponent(item.r2_key || '')}`, {
              headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.content) text = data.content;
            }
          } catch(e) {}

          // 2. Fallback to direct URL fetch
          if (!text && item.url) {
            try {
              const uRes = await fetch(item.url);
              if (uRes.ok) text = await uRes.text();
            } catch(e) {}
          }

          if (text && text.includes('<svg')) {
            const cleanSvg = text.trim();
            onHeaderLogoSvgInput(cleanSvg);
            const textarea = document.getElementById('hs-logo-svg-input');
            if (textarea) textarea.value = cleanSvg;
            showToast('success', 'Header SVG Logo loaded from Media Gallery!');
          } else {
            showToast('error', 'Selected file does not contain valid SVG code.');
          }
        } catch(err) {
          showToast('error', 'Failed to load SVG: ' + err.message);
        }
      }
    });
  } else {
    const fileInp = document.getElementById('hs-logo-file-input');
    if (fileInp) fileInp.click();
  }
}

function onHeaderLogoSvgInput(svgCode) {
  if (!_hsInstance) return;
  _hsInstance.logoSvg = svgCode ? svgCode.trim() : null;
  updateGlobalSyncStatus();
  updateHeaderLogoPreview();
  recordActivityLog({
    action: 'layout.header_logo_update',
    category: 'layout',
    summary: `Updated Header logo SVG in Header Settings`,
    target_id: 'header_logo',
    target_name: 'Header Logo',
    details: {}
  });
}

function onHeaderLogoHeightInput(heightVal) {
  if (!_hsInstance) return;
  const h = parseInt(heightVal) || 80;
  _hsInstance.logoHeight = h;
  const label = document.getElementById('hs-logo-height-val');
  if (label) label.textContent = h;
  updateGlobalSyncStatus();
  updateHeaderLogoPreview();
  recordActivityLog({
    action: 'layout.header_logo_resize',
    category: 'layout',
    summary: `Resized Header logo to ${h}px`,
    target_id: 'header_logo',
    target_name: 'Header Logo',
    details: { height: h }
  });
}

function resetHeaderLogoToDefault() {
  if (!_hsInstance) return;
  _hsInstance.logoSvg = null;
  _hsInstance.logoHeight = 80;
  const textarea = document.getElementById('hs-logo-svg-input');
  if (textarea) textarea.value = '';
  const slider = document.getElementById('hs-logo-height-slider') || document.getElementById('hs-logo-height');
  if (slider) slider.value = 80;
  const label = document.getElementById('hs-logo-height-val');
  if (label) label.textContent = 80;
  updateGlobalSyncStatus();
  updateHeaderLogoPreview();
  showToast('info', 'Header logo reset to default.');
  recordActivityLog({
    action: 'layout.header_logo_reset',
    category: 'layout',
    summary: `Reset Header logo to default in Header Settings`,
    target_id: 'header_logo',
    target_name: 'Header Logo',
    details: {}
  });
}

function updateHeaderLogoPreview() {
  if (!_hsInstance) return;
  const logoRenderEl = document.getElementById('hs-logo-render-preview');
  const taglineEl = document.getElementById('hs-tagline-preview-text');

  if (logoRenderEl) {
    logoRenderEl.innerHTML = formatSvgWithSize(_hsInstance.logoSvg, _hsInstance.logoHeight);
  }

  if (taglineEl) {
    taglineEl.textContent = _hsInstance.tabTagline || (_headerLang === 'bn' ? 'জ্ঞান, ঐতিহ্য ও জীবনের কথা' : 'Insights, Stories & Heritage');
    taglineEl.style.display = _hsInstance.tabTagline ? 'block' : 'none';
  }
}

function renderHsLogoCard(hs) {
  _hsInstance = hs;
  const svgInput = document.getElementById('hs-logo-svg-input');
  const slider = document.getElementById('hs-logo-height-slider') || document.getElementById('hs-logo-height');
  const heightVal = document.getElementById('hs-logo-height-val');

  if (svgInput) svgInput.value = hs.logoSvg || '';
  if (slider) {
    slider.value = hs.logoHeight || 80;
    if (heightVal) heightVal.textContent = slider.value;
  }

  updateHeaderLogoPreview();
}

// ── Nav sections card ───────────────────────────────────────────
function renderHsNavSections(hs) {
  const container = document.getElementById('hs-nav-sections-list');
  if (!container) return;

  const allSecs = (sections || []).filter(s => !s.deleted);
  if (!allSecs.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:8px 0">No sections found. Add sections in the Sections page first.</p>';
    return;
  }

  // Initialize or align ordered list
  let orderedSecs = [...allSecs];
  const enabledIds = Array.isArray(hs.enabledNavSections) ? hs.enabledNavSections : null;
  if (enabledIds) {
    orderedSecs.sort((a, b) => {
      const idA = a.slug || a.id;
      const idB = b.slug || b.id;
      const idxA = enabledIds.indexOf(idA);
      const idxB = enabledIds.indexOf(idB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }

  const isBn = (_headerLang === 'bn');
  container.innerHTML = '';
  orderedSecs.forEach((s, idx) => {
    const sectionId = s.slug || s.id;
    const isEnabled = (enabledIds === null) ? true : enabledIds.includes(sectionId);
    const row = document.createElement('div');
    row.className = 'hs-section-row';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;';
    
    const displayName = (isBn && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:6px;flex-shrink:0;">#${idx + 1}</span>
        <div style="display:flex;gap:3px;flex-shrink:0;">
          <button type="button" class="action-btn hs-move-btn" onclick="moveHsNavSection(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up (Earlier in Navbar)" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === 0 ? 'not-allowed' : 'pointer'};opacity:${idx === 0 ? '0.4' : '1'};font-size:11px;display:inline-flex;align-items:center;justify-content:center;">
            ▲
          </button>
          <button type="button" class="action-btn hs-move-btn" onclick="moveHsNavSection(${idx}, 1)" ${idx === orderedSecs.length - 1 ? 'disabled' : ''} title="Move Down (Later in Navbar)" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === orderedSecs.length - 1 ? 'not-allowed' : 'pointer'};opacity:${idx === orderedSecs.length - 1 ? '0.4' : '1'};font-size:11px;display:inline-flex;align-items:center;justify-content:center;">
            ▼
          </button>
        </div>
        <div class="hs-section-info" style="min-width:0;flex:1;">
          <span class="hs-section-name" style="font-weight:600;font-size:13.5px;color:#0f172a;">${escapeHtml(displayName)}</span>
          <span class="hs-slug-chip" style="margin-left:6px;font-size:11px;color:#64748b;">${escapeHtml(sectionId)}</span>
        </div>
      </div>
      <label class="hs-toggle" title="${isEnabled ? 'Visible in header nav' : 'Hidden from header nav'}" style="flex-shrink:0;margin-left:12px;">
        <input type="checkbox" data-sec-id="${escapeHtml(sectionId)}" ${isEnabled ? 'checked' : ''}>
        <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
      </label>
    `;

    row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      hs.enabledNavSections = getEnabledNavSections();
      updateGlobalSyncStatus();
      recordActivityLog({
        action: 'layout.header_toggle_section',
        category: 'layout',
        summary: `${e.target.checked ? 'Enabled' : 'Disabled'} section "${s.name}" in Header Navigation Bar`,
        target_id: sectionId,
        target_name: s.name,
        details: { sectionId, enabled: e.target.checked }
      });
    });
    container.appendChild(row);
  });
}

function moveHsNavSection(index, dir) {
  if (!_hsInstance) return;
  const allSecs = (sections || []).filter(s => !s.deleted);
  let orderedSecs = [...allSecs];
  const enabledIds = Array.isArray(_hsInstance.enabledNavSections) ? _hsInstance.enabledNavSections : allSecs.map(s => s.slug || s.id);
  
  orderedSecs.sort((a, b) => {
    const idA = a.slug || a.id;
    const idB = b.slug || b.id;
    const idxA = enabledIds.indexOf(idA);
    const idxB = enabledIds.indexOf(idB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const targetIndex = index + dir;
  if (targetIndex < 0 || targetIndex >= orderedSecs.length) return;

  const item = orderedSecs.splice(index, 1)[0];
  orderedSecs.splice(targetIndex, 0, item);

  // Preserve enabled/checked state while ordering
  const currentChecked = Array.from(document.querySelectorAll('#hs-nav-sections-list input[type="checkbox"]')).filter(c => c.checked).map(c => c.getAttribute('data-sec-id'));
  
  _hsInstance.enabledNavSections = orderedSecs
    .filter(s => currentChecked.includes(s.slug || s.id))
    .map(s => s.slug || s.id);

  renderHsNavSections(_hsInstance);
  updateGlobalSyncStatus();
}

function getEnabledNavSections() {
  const cbs = document.querySelectorAll('#hs-nav-sections-list input[type="checkbox"]');
  if (!cbs.length) return null;
  return Array.from(cbs).filter(c => c.checked).map(c => c.getAttribute('data-sec-id'));
}

// ── Sub-header tabs card ────────────────────────────────────────
function renderHsSubsections(hs) {
  const container = document.getElementById('hs-subsections-list');
  if (!container) return;
  container.innerHTML = '';
  hs.subsections.forEach((sub, idx) => buildHsSubRow(container, sub, hs, idx, hs.subsections.length));
  updateGlobalSyncStatus();
}

function moveHsSubRow(id, dir, hs) {
  const items = hs.subsections || [];
  const idx = items.findIndex(s => s.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderHsSubsections(hs);
  updateGlobalSyncStatus();
  recordActivityLog({
    action: 'layout.header_reorder_tab',
    category: 'layout',
    summary: `Reordered sub-header tab "${temp.label || id}" (${dir < 0 ? 'Moved Up' : 'Moved Down'}) in Header`,
    target_id: id,
    target_name: temp.label || id,
    details: { id, dir }
  });
}

function buildHsSubRow(container, sub, hs, idx, total) {
  const row = document.createElement('div');
  row.className = 'hs-sub-row' + (sub.enabled !== false ? '' : ' hs-sub-row--off');
  row.dataset.subId = sub.id;

  const calSvg = '<span class="hs-icon-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>calendar</span>';
  const calBadge = sub.icon === 'calendar' ? calSvg : '';

  row.innerHTML = `
    <div class="hs-sub-main">
      <div style="display:flex;align-items:center;gap:4px;margin-right:8px;">
        <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveHsSubRow('${sub.id}', -1, _hsInstance)">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === total - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveHsSubRow('${sub.id}', 1, _hsInstance)">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <div class="hs-sub-info">
        <span class="hs-sub-lbl">${escapeHtml(sub.label)}</span>
        ${calBadge}
        <span class="hs-sub-url">${escapeHtml(sub.href)}</span>
      </div>
      <div class="hs-sub-actions">
        <label class="hs-toggle hs-toggle--sm" title="Toggle visibility">
          <input type="checkbox" ${sub.enabled !== false ? 'checked' : ''} class="hs-sub-toggle-cb">
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button class="hs-icon-btn hs-edit-sub-btn" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="hs-icon-btn hs-icon-btn--danger hs-del-sub-btn" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
    <div class="hs-sub-edit-form" hidden>
      <div class="hs-edit-grid">
        <div class="form-group">
          <label class="form-label">Label (displayed in uppercase)</label>
          <input type="text" class="form-input hs-edit-label" value="${escapeHtml(sub.label)}" maxlength="40">
        </div>
        <div class="form-group">
          <label class="form-label">Link URL</label>
          <input type="text" class="form-input hs-edit-href" value="${escapeHtml(sub.href)}">
        </div>
        <div class="form-group">
          <label class="form-label">Icon</label>
          <select class="form-input hs-edit-icon">
            <option value="">None</option>
            <option value="calendar" ${sub.icon === 'calendar' ? 'selected' : ''}>Calendar</option>
          </select>
        </div>
        <div class="hs-edit-save-row">
          <button class="btn btn--primary btn--sm hs-save-edit-btn">Save</button>
          <button class="btn btn--ghost btn--sm hs-cancel-edit-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // Toggle enable
  row.querySelector('.hs-sub-toggle-cb').addEventListener('change', e => {
    sub.enabled = e.target.checked;
    row.classList.toggle('hs-sub-row--off', !sub.enabled);
    updateGlobalSyncStatus();
    recordActivityLog({
      action: 'layout.header_toggle_tab',
      category: 'layout',
      summary: `${sub.enabled ? 'Enabled' : 'Disabled'} sub-header tab "${sub.label}" in Header`,
      target_id: sub.id,
      target_name: sub.label,
      details: { id: sub.id, enabled: sub.enabled, href: sub.href }
    });
  });

  // Edit toggle
  const editForm = row.querySelector('.hs-sub-edit-form');
  row.querySelector('.hs-edit-sub-btn').addEventListener('click', () => {
    editForm.hidden = !editForm.hidden;
  });

  // Save edit
  row.querySelector('.hs-save-edit-btn').addEventListener('click', () => {
    const newLabel = row.querySelector('.hs-edit-label').value.trim();
    const newHref  = row.querySelector('.hs-edit-href').value.trim();
    const newIcon  = row.querySelector('.hs-edit-icon').value || null;
    if (!newLabel) { showToast('error', 'Label cannot be empty.'); return; }
    if (!newHref)  { showToast('error', 'URL cannot be empty.'); return; }
    sub.label = newLabel.toUpperCase();
    sub.href  = newHref;
    sub.icon  = newIcon;
    // Update display
    row.querySelector('.hs-sub-lbl').textContent = sub.label;
    row.querySelector('.hs-sub-url').textContent = sub.href;
    const badgeEl = row.querySelector('.hs-icon-badge');
    if (sub.icon === 'calendar') {
      if (badgeEl) badgeEl.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>calendar';
      else row.querySelector('.hs-sub-info').insertAdjacentHTML('afterbegin', calSvg);
    } else if (badgeEl) { badgeEl.remove(); }
    editForm.hidden = true;
    updateGlobalSyncStatus();
    recordActivityLog({
      action: 'layout.header_edit_tab',
      category: 'layout',
      summary: `Updated sub-header tab "${sub.label}" (${sub.href}) in Header`,
      target_id: sub.id,
      target_name: sub.label,
      details: { id: sub.id, label: sub.label, href: sub.href, icon: sub.icon }
    });
  });

  // Cancel edit
  row.querySelector('.hs-cancel-edit-btn').addEventListener('click', () => { editForm.hidden = true; });

  // Delete
  row.querySelector('.hs-del-sub-btn').addEventListener('click', () => {
    if (!confirm('Delete tab "' + sub.label + '"? This cannot be undone.')) return;
    const idx = hs.subsections.findIndex(s => s.id === sub.id);
    if (idx !== -1) {
      const removed = hs.subsections.splice(idx, 1)[0];
      renderHsSubsections(hs);
      updateGlobalSyncStatus();
      recordActivityLog({
        action: 'layout.header_delete_tab',
        category: 'layout',
        summary: `Deleted sub-header tab "${removed?.label || sub.label}" from Header`,
        target_id: sub.id,
        target_name: removed?.label || sub.label,
        details: { id: sub.id }
      });
    }
  });

  container.appendChild(row);
}

// ── Add tab form ────────────────────────────────────────────────
function bindHsAddForm(hs) {
  const addBtn     = document.getElementById('hs-add-subsection-btn');
  const addForm    = document.getElementById('hs-add-form');
  const confirmBtn = document.getElementById('hs-add-confirm-btn');
  const cancelBtn  = document.getElementById('hs-add-cancel-btn');

  if (addBtn) addBtn.addEventListener('click', () => { if (addForm) addForm.hidden = false; addBtn.style.display = 'none'; });
  if (cancelBtn) cancelBtn.addEventListener('click', () => { if (addForm) addForm.hidden = true; if (addBtn) addBtn.style.display = ''; });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const label = (document.getElementById('hs-new-label').value || '').trim();
      const href  = (document.getElementById('hs-new-href').value  || '').trim();
      const icon  = document.getElementById('hs-new-icon').value || null;
      if (!label) { showToast('error', 'Tab label is required.'); return; }
      if (!href)  { showToast('error', 'Link URL is required.'); return; }
      const newSub = { id: 'sub-' + Date.now(), label: label.toUpperCase(), href, icon: icon || null, enabled: true };
      hs.subsections.push(newSub);
      const container = document.getElementById('hs-subsections-list');
      if (container) buildHsSubRow(container, newSub, hs);
      document.getElementById('hs-new-label').value = '';
      document.getElementById('hs-new-href').value  = '';
      document.getElementById('hs-new-icon').value  = '';
      if (addForm) addForm.hidden = true;
      if (addBtn) addBtn.style.display = '';
      updateGlobalSyncStatus();
      showToast('success', 'Tab added! Click "Apply Header Changes" to save.');
      recordActivityLog({
        action: 'layout.header_add_tab',
        category: 'layout',
        summary: `Added sub-header tab "${newSub.label}" (${newSub.href}) in Header`,
        target_id: newSub.id,
        target_name: newSub.label,
        details: newSub
      });
    });
  }
}

// ── Save button ─────────────────────────────────────────────────
function bindHsSaveBtn(hs) {
  const saveBtn = document.getElementById('hs-save-btn');
  if (!saveBtn) return;
  saveBtn.onclick = async () => {
    const currentInstance = _hsInstance || hs;
    const def = getHeaderDefaultSettings(_headerLang);

    // Collect Browser Tab & SEO
    const siteTitleInp = document.getElementById('hs-site-title-input');
    const tabTaglineInp = document.getElementById('hs-tab-tagline-input');
    const customTitleInp = document.getElementById('hs-tab-title-custom-input');
    const metaDescInp = document.getElementById('hs-meta-desc-input');
    const faviconInp = document.getElementById('hs-favicon-input');

    if (siteTitleInp) currentInstance.siteTitle = siteTitleInp.value.trim() || def.siteTitle;
    if (tabTaglineInp) currentInstance.tabTagline = tabTaglineInp.value.trim();
    if (customTitleInp) currentInstance.browserTabTitle = customTitleInp.value.trim() || (currentInstance.siteTitle + (currentInstance.tabTagline ? ' — ' + currentInstance.tabTagline : ''));
    if (metaDescInp) currentInstance.metaDescription = metaDescInp.value.trim() || def.metaDescription;
    if (faviconInp) currentInstance.faviconUrl = faviconInp.value.trim() || '';

    // Collect enabled nav sections
    currentInstance.enabledNavSections = getEnabledNavSections();
    // Collect logo
    const svgInput = document.getElementById('hs-logo-svg-input');
    const slider   = document.getElementById('hs-logo-height');
    if (svgInput) currentInstance.logoSvg = svgInput.value.trim() || null;
    if (slider) currentInstance.logoHeight = parseInt(slider.value) || 80;

    const orig = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `Saving to database...`;
    updateGlobalSyncStatus('syncing', 'Saving to database...');

    try {
      await saveHeaderSettings(currentInstance);
      window._appliedHeaderConfig = JSON.parse(JSON.stringify(currentInstance));
      updateGlobalSyncStatus('synced', 'Synced with database');
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Changes Applied!`;
      saveBtn.style.background = 'var(--success, #1a7a4a)';
      showToast('success', `Header (${_headerLang === 'bn' ? 'বাংলা' : 'English'}) settings saved & applied!`);
      renderHeaderPreviewCanvas();
      recordActivityLog({
        action: 'layout.header_save',
        category: 'layout',
        summary: `Applied Header Settings (${_headerLang === 'bn' ? 'BN' : 'EN'}: "${currentInstance.siteTitle}", Logo: ${currentInstance.logoHeight}px, ${currentInstance.subsections.length} Tabs)`,
        target_id: 'site_header_config',
        target_name: 'Header Settings',
        details: { siteTitle: currentInstance.siteTitle, tabTagline: currentInstance.tabTagline, metaDescription: currentInstance.metaDescription, logoHeight: currentInstance.logoHeight, tabsCount: currentInstance.subsections.length, lang: _headerLang }
      });
    } catch(err) {
      updateGlobalSyncStatus('error', 'Sync error (offline/cache)');
      showToast('error', 'Failed to save header settings: ' + err.message);
    } finally {
      setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.style.background = ''; saveBtn.disabled = false; }, 2500);
    }
  };
}

_hsInstance = null;
window._appliedHeaderConfig = null;

async function initHeaderPage() {
  _hsInstance = await loadHeaderSettings();
  window._appliedHeaderConfig = JSON.parse(JSON.stringify(_hsInstance));
  renderHsTabCard(_hsInstance);
  renderHsLogoCard(_hsInstance);
  renderHsNavSections(_hsInstance);
  renderHsSubsections(_hsInstance);
  bindHsAddForm(_hsInstance);
  bindHsSaveBtn(_hsInstance);
  renderHeaderPreviewCanvas();
  updateGlobalSyncStatus();
}

// ══════════════════════════════════════════════════════════════════
// ARTICLES PAGE
// ══════════════════════════════════════════════════════════════════

_allArticles = [];

async function initArticlesPage() {
  const loading = document.getElementById('articles-loading');
  const table   = document.getElementById('articles-table');
  const empty   = document.getElementById('articles-empty');

  if (loading) loading.style.display = 'block';
  if (table) table.style.display     = 'none';
  if (empty) empty.style.display     = 'none';
  updateGlobalSyncStatus('syncing', 'Loading articles...');

  _allArticles = [];

  // Tier 1: Try API list
  try {
    const res = await fetch('/api/articles?action=list', {
      headers: _authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) _allArticles = data;
    }
  } catch(e) {}

  // Tier 2: Try API public
  if (_allArticles.length === 0) {
    try {
      const res = await fetch('/api/articles?action=public&limit=100');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) _allArticles = data;
      }
    } catch(e) {}
  }

  // Tier 3: Try Supabase JS client
  if (_allArticles.length === 0) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { data, error } = await sb
          .from('articles')
          .select('id, slug, title, title_bn, deck, deck_bn, section, author, author_bn, status, created_at, updated_at, published_at, hero_img_url')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('updated_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          _allArticles = data;
        }
      }
    } catch(err) {}
  }

  // Tier 4: Direct Supabase REST fetch
  if (_allArticles.length === 0) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/articles?select=id,slug,title,title_bn,deck,deck_bn,section,author,author_bn,status,created_at,updated_at,published_at,hero_img_url&or=(is_deleted.is.null,is_deleted.eq.false)&order=updated_at.desc`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) _allArticles = data;
        }
      }
    } catch(err) {}
  }

  if (loading) loading.style.display = 'none';
  _populateSectionFilter();
  renderArticlesTable(_allArticles);
  _loadArticleTrash(); // update trash count badge
  switchArticlesView(_currentArticlesView || 'active');
  updateGlobalSyncStatus('synced', 'Synced with database');
}

function _populateSectionFilter() {
  const secSelect = document.getElementById('articles-filter-section');
  if (!secSelect) return;
  const currentVal = secSelect.value;
  const secList = Array.from(new Set(_allArticles.map(a => a.section).filter(Boolean))).sort();

  secSelect.innerHTML = '<option value="">All Sections</option>' +
    secList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  if (secList.includes(currentVal)) {
    secSelect.value = currentVal;
  }
}

function copyTextToClipboard(text, msg = 'Copied to clipboard!') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('success', msg);
    }).catch(() => {
      _fallbackCopy(text, msg);
    });
  } else {
    _fallbackCopy(text, msg);
  }
}
function _fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('success', msg);
  } catch(e) {
    showToast('info', 'Copy text: ' + text);
  }
  document.body.removeChild(ta);
}

function renderArticlesTable(articles) {
  const tbody = document.getElementById('articles-tbody');
  const table = document.getElementById('articles-table');
  const empty = document.getElementById('articles-empty');

  if (!articles || articles.length === 0) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (table) table.style.display = 'table';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = articles.map(a => {
    const updated = a.updated_at
      ? new Date(a.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const isPublished = a.status === 'published';
    const statusBadge = isPublished
      ? `<span class="art-status-pill art-status--published"><svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor"><circle cx="3" cy="3" r="3"/></svg>Published</span>`
      : `<span class="art-status-pill art-status--draft"><svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor"><circle cx="3" cy="3" r="3"/></svg>Draft</span>`;

    const thumb = a.hero_img_url
      ? `<img src="${escapeHtml(a.hero_img_url)}" alt="" class="art-thumb" loading="lazy" />`
      : `<div class="art-thumb-ph"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

    const sectionBadge = a.section
      ? `<span class="art-badge-sec">${escapeHtml(a.section)}</span>`
      : `<span style="color:#94a3b8;font-size:12px;">—</span>`;

    const displayTitle = a.title || a.title_bn || 'Untitled Draft';
    const displayAuthor = a.author || a.author_bn || '—';
    const shortId = a.id ? (a.id.length > 12 ? a.id.slice(0, 8) + '…' : a.id) : '—';
    const idBadge = a.id ? `<span class="art-id-badge" onclick="copyTextToClipboard('${escapeHtml(a.id)}', 'Article Unique ID copied!')" title="Click to copy permanent Article Unique ID: ${escapeHtml(a.id)}"><span style="opacity:.6;font-size:9.5px;">ID:</span>${escapeHtml(shortId)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>` : '';

    return `<tr>
      <td>
        <div class="art-media-wrap">
          ${thumb}
          <div class="art-title-meta">
            <div class="art-row-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
              ${idBadge}
              <span class="art-row-slug" title="/article/${escapeHtml(a.slug || a.id)}">/${escapeHtml(a.slug || a.id)}</span>
            </div>
          </div>
        </div>
      </td>
      <td>${sectionBadge}</td>
      <td><span class="art-author-txt">${escapeHtml(displayAuthor)}</span></td>
      <td>${statusBadge}</td>
      <td><span class="art-date-txt">${updated}</span></td>
      <td class="tar">
        <div class="art-btn-group">
          <a href="admin-article-editor.html?id=${escapeHtml(a.id)}" class="art-action-btn art-action-btn--edit" title="Edit article in editor">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </a>
          ${isPublished ? `<a href="${a.slug ? '/article/' + escapeHtml(a.slug) : 'article.html?id=' + escapeHtml(a.id)}" target="_blank" class="art-action-btn art-action-btn--view" title="View live published article">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
             View
          </a>` : ''}
          <button type="button" onclick="deleteArticleConfirm('${a.id}', '${escapeHtml((displayTitle).replace(/'/g,"\\'"))}')" class="art-action-btn art-action-btn--trash" title="Move to Recycle Bin">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterArticles() {
  const q       = (document.getElementById('articles-search').value || '').toLowerCase().trim();
  const status  = document.getElementById('articles-filter-status').value;
  const section = document.getElementById('articles-filter-section') ? document.getElementById('articles-filter-section').value : '';

  const filtered = _allArticles.filter(a => {
    const matchQ = !q ||
      (a.title   || '').toLowerCase().includes(q) ||
      (a.author  || '').toLowerCase().includes(q) ||
      (a.slug    || '').toLowerCase().includes(q) ||
      (a.section || '').toLowerCase().includes(q) ||
      (a.id      || '').toLowerCase().includes(q);
    const matchStatus  = !status  || a.status === status;
    const matchSection = !section || a.section === section;
    return matchQ && matchStatus && matchSection;
  });
  renderArticlesTable(filtered);
}

// ── Article Trash Management ────────────────────────────────────

function deleteArticleConfirm(id, title) {
  _confirmModal({
    title: 'Move to Trash',
    body: `"<strong>${escapeHtml(title)}</strong>" will be moved to the Recycle Bin and removed from public view. You can restore it anytime from the Trash tab.`,
    confirmText: 'Move to Trash',
    variant: 'danger',
    onConfirm: () => _doDeleteArticle(id)
  });
}

async function _doDeleteArticle(id) {
  const art = _allArticles.find(a => a.id === id);
  const displayTitle = art?.title || art?.title_bn || 'Article';

  // 1. Instant optimistic UI removal with smooth animation
  const tbody = document.getElementById('articles-tbody');
  if (tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const targetRow = rows.find(r => r.innerHTML.includes(`'${id}'`));
    if (targetRow) {
      targetRow.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      targetRow.style.opacity = '0';
      targetRow.style.transform = 'scale(0.96)';
      setTimeout(() => targetRow.remove(), 200);
    }
  }

  // Update in-memory state and counts immediately
  _allArticles = _allArticles.filter(a => a.id !== id);
  filterArticles();
  
  // Show instant confirmation toast
  showToast('success', `"${displayTitle}" moved to Recycle Bin.`);

  // 2. Perform backend deletion asynchronously
  try {
    let ok = false;
    try {
      const res  = await fetch('/api/articles?action=delete&id=' + id, {
        method: 'DELETE', headers: _authHeaders()
      });
      if (res.ok) ok = true;
    } catch(e) {}

    if (!ok) {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { error } = await sb.from('articles').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
        if (!error) ok = true;
      }
    }

    _loadArticleTrash();

    recordActivityLog({
      action: 'articles.trash',
      category: 'articles',
      summary: `Moved article "${displayTitle}" to Recycle Bin`,
      target_id: id,
      target_name: displayTitle,
      details: { id, title: art?.title, slug: art?.slug }
    });
  } catch(e) {
    showToast('error', 'Failed to move to Recycle Bin: ' + e.message);
    await initArticlesPage();
  }
}

function restoreArticleConfirm(id, title) {
  _confirmModal({
    title: 'Restore Article',
    body: `Restore "<strong>${escapeHtml(title)}</strong>"? It will be moved back to your active articles list.`,
    confirmText: 'Restore Article',
    variant: 'success',
    onConfirm: () => _doRestoreArticle(id, title)
  });
}

async function _doRestoreArticle(id, title) {
  // Instant optimistic UI removal from trash table
  const tbody = document.getElementById('art-trash-tbody');
  const countEl = document.getElementById('art-trash-count');
  if (tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const targetRow = rows.find(r => r.innerHTML.includes(`'${id}'`));
    if (targetRow) {
      targetRow.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      targetRow.style.opacity = '0';
      targetRow.style.transform = 'scale(0.96)';
      setTimeout(() => targetRow.remove(), 200);
      if (countEl) {
        const current = parseInt(countEl.textContent || '1', 10);
        countEl.textContent = Math.max(0, current - 1);
      }
    }
  }

  showToast('success', `"${title || 'Article'}" restored to active articles.`);

  try {
    let ok = false;
    try {
      const res = await fetch('/api/articles?action=restore&id=' + id, {
        method: 'PATCH', headers: _authHeaders()
      });
      if (res.ok) ok = true;
    } catch(e) {}

    if (!ok) {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { error } = await sb.from('articles').update({ is_deleted: false, deleted_at: null }).eq('id', id);
        if (!error) ok = true;
      }
    }

    recordActivityLog({
      action: 'articles.restore',
      category: 'articles',
      summary: `Restored article "${title || id}" from Recycle Bin`,
      target_id: id,
      target_name: title || id,
      details: { id }
    });

    await initArticlesPage();
  } catch(e) {
    showToast('error', 'Failed to restore article: ' + e.message);
    await _loadArticleTrash();
  }
}

function permanentDeleteArticleConfirm(id, title) {
  _confirmModal({
    title: 'Delete Permanently',
    body: `Warning: This action <strong>cannot be undone</strong>. "<strong>${escapeHtml(title)}</strong>" will be permanently deleted from the database.`,
    confirmText: 'Delete Forever',
    variant: 'danger',
    onConfirm: () => _doPermanentDeleteArticle(id, title)
  });
}

async function _doPermanentDeleteArticle(id, title) {
  // Instant optimistic UI removal from trash table
  const tbody = document.getElementById('art-trash-tbody');
  const countEl = document.getElementById('art-trash-count');
  if (tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const targetRow = rows.find(r => r.innerHTML.includes(`'${id}'`));
    if (targetRow) {
      targetRow.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      targetRow.style.opacity = '0';
      targetRow.style.transform = 'scale(0.96)';
      setTimeout(() => targetRow.remove(), 200);
      if (countEl) {
        const current = parseInt(countEl.textContent || '1', 10);
        countEl.textContent = Math.max(0, current - 1);
      }
    }
  }

  showToast('success', `"${title || 'Article'}" permanently deleted.`);

  try {
    let ok = false;
    try {
      const res  = await fetch('/api/articles?action=delete&id=' + id + '&mode=permanent', {
        method: 'DELETE', headers: _authHeaders()
      });
      if (res.ok) ok = true;
    } catch(e) {}

    if (!ok) {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { error } = await sb.from('articles').delete().eq('id', id);
        if (!error) ok = true;
      }
    }

    recordActivityLog({
      action: 'articles.permanent_delete',
      category: 'articles',
      summary: `Permanently deleted article "${title || id}" from database`,
      target_id: id,
      target_name: title || id,
      details: { id }
    });

    await _loadArticleTrash();
  } catch(e) {
    showToast('error', 'Failed to permanently delete: ' + e.message);
    await _loadArticleTrash();
  }
}

_currentArticlesView = 'active';

function switchArticlesView(view) {
  _currentArticlesView = view;
  const activePanel = document.getElementById('art-active-panel');
  const trashPanel  = document.getElementById('art-trash-panel');
  const activeBtn   = document.getElementById('art-view-active');
  const trashBtn    = document.getElementById('art-view-trash');

  if (view === 'trash') {
    if (activePanel) activePanel.style.display = 'none';
    if (trashPanel)  trashPanel.style.display  = 'block';
    if (activeBtn)   activeBtn.classList.remove('active');
    if (trashBtn)    trashBtn.classList.add('active');
    _loadArticleTrash();
  } else {
    if (activePanel) activePanel.style.display = 'block';
    if (trashPanel)  trashPanel.style.display  = 'none';
    if (activeBtn)   activeBtn.classList.add('active');
    if (trashBtn)    trashBtn.classList.remove('active');
    filterArticles();
  }
}

async function _loadArticleTrash() {
  const tbody   = document.getElementById('art-trash-tbody');
  const table   = document.getElementById('art-trash-table');
  const empty   = document.getElementById('art-trash-empty');
  const loading = document.getElementById('art-trash-loading');
  const count   = document.getElementById('art-trash-count');

  if (!tbody) return;
  if (loading) loading.style.display = 'block';
  if (table)   table.style.display   = 'none';
  if (empty)   empty.style.display   = 'none';

  let arts = [];

  // Tier 1: Try API trash
  try {
    const res  = await fetch('/api/articles?action=trash', {
      headers: _authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) arts = data;
    }
  } catch(e) {}

  // Tier 2: Try Supabase JS client
  if (arts.length === 0) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { data, error } = await sb
          .from('articles')
          .select('id, slug, title, section, author, status, deleted_at, hero_img_url')
          .eq('is_deleted', true)
          .order('deleted_at', { ascending: false });
        if (!error && Array.isArray(data)) arts = data;
      }
    } catch(e) {}
  }

  // Tier 3: Try Supabase REST fetch
  if (arts.length === 0) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/articles?select=id,slug,title,section,author,status,deleted_at,hero_img_url&is_deleted=eq.true&order=deleted_at.desc`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) arts = data;
        }
      }
    } catch(e) {}
  }

  if (count) count.textContent = Array.isArray(arts) ? arts.length : '0';
  if (loading) loading.style.display = 'none';
  if (!Array.isArray(arts) || arts.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (table) table.style.display = 'none';
    return;
  }
  if (table) table.style.display = 'table';
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const isAdmin = Boolean(window.PRIVATIAN_USER && window.PRIVATIAN_USER.role === 'Admin');
  tbody.innerHTML = arts.map(a => {
    const thumb = a.hero_img_url
      ? `<img src="${escapeHtml(a.hero_img_url)}" alt="" class="art-thumb" style="opacity:.75;" loading="lazy"/>`
      : `<div class="art-thumb-ph"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
    const permDeleteBtn = isAdmin
      ? `<button type="button" onclick="permanentDeleteArticleConfirm('${a.id}','${escapeHtml((a.title||'Untitled').replace(/'/g,"\\'"))}')" class="art-action-btn art-action-btn--delete-perm" title="Permanently delete from database (Admin only)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/></svg>
          Delete Forever
        </button>`
      : '';
    return `<tr>
      <td>
        <div class="art-media-wrap">
          ${thumb}
          <div class="art-title-meta">
            <div class="art-row-title" style="color:#64748b;" title="${escapeHtml(a.title||'Untitled')}">${escapeHtml(a.title||'Untitled')}</div>
            <div class="art-row-slug" title="/article/${escapeHtml(a.slug || a.id)}">${escapeHtml(a.slug || a.id)}</div>
          </div>
        </div>
      </td>
      <td><span class="art-badge-sec" style="background:#f1f5f9;color:#64748b;border-color:#e2e8f0;">${escapeHtml(a.section||'—')}</span></td>
      <td><span class="art-date-txt" style="color:#dc2626;font-weight:600;">${fmt(a.deleted_at)}</span></td>
      <td class="tar">
        <div class="art-btn-group">
          <button type="button" onclick="restoreArticleConfirm('${a.id}','${escapeHtml((a.title||'Untitled').replace(/'/g,"\\'"))}')" class="art-action-btn art-action-btn--restore" title="Restore back to active articles">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Restore
          </button>
          ${permDeleteBtn}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Handle dynamic navigation via hashchange (e.g. browser back/forward, bookmarks)
window.addEventListener('hashchange', () => {
  const targetPage = window.location.hash.replace(/^#/, '');
  if (targetPage && targetPage !== _currentAdminPage) {
    navigateTo(targetPage);
  }
});

/* =================================================================
   MENU MANAGER (HEADER MENU OVERLAY CUSTOMIZATION)
================================================================= */

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
  ],
  search: {
    enabled: true,
    placeholder: 'Search articles, stories, topics...',
    exploreLabel: 'Explore:',
    closeText: 'Close',
    hintText: 'Start typing to search or select a topic above…',
    noResultsText: 'No matching stories found',
    quickTags: [
      { id: 'tag-1', label: 'Findings', label_bn: 'অনুসন্ধিৎসু', query: 'Findings', enabled: true },
      { id: 'tag-2', label: 'Community & Heritage', label_bn: 'সমাজ ও ঐতিহ্য', query: 'Community & Heritage', enabled: true },
      { id: 'tag-3', label: 'Culture', label_bn: 'সংস্কৃতি', query: 'Culture', enabled: true },
      { id: 'tag-4', label: 'Privacy & Values', label_bn: 'মূল্যবোধ', query: 'Privacy & Values', enabled: true },
      { id: 'tag-5', label: 'Nation & World', label_bn: 'দেশ ও বিশ্ব', query: 'Nation & World', enabled: true },
      { id: 'tag-6', label: 'Arts & Legacy', label_bn: 'শিল্প ও উত্তরাধিকার', query: 'Arts & Legacy', enabled: true },
      { id: 'tag-7', label: 'Events', label_bn: 'অনুষ্ঠান', query: 'Events', enabled: true }
    ]
  },
  enabledMenuSections: []
};

// State:
appliedMenuConfig = null; // Baseline saved on server
menuDraftConfig = null;   // Active working copy for edits
menuUndoStack = [];
menuRedoStack = [];
var _menuInitialized = false;

// SVGs for Menu Manager:
const MENU_ICONS = {
  up: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`,
  down: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`,
};

// Record snapshot before mutation
function pushMenuHistory() {
  if (!menuDraftConfig) return;
  menuUndoStack.push(JSON.stringify(menuDraftConfig));
  if (menuUndoStack.length > 50) menuUndoStack.shift();
  menuRedoStack = [];
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('menu-undo-btn');
  const redoBtn = document.getElementById('menu-redo-btn');
  if (undoBtn) undoBtn.disabled = (menuUndoStack.length === 0);
  if (redoBtn) redoBtn.disabled = (menuRedoStack.length === 0);
}

function undoMenuAction() {
  if (menuUndoStack.length === 0) return;
  menuRedoStack.push(JSON.stringify(menuDraftConfig));
  menuDraftConfig = JSON.parse(menuUndoStack.pop());
  syncMenuDraftToUI();
  updateUndoRedoButtons();
  updateGlobalSyncStatus();
  showToast('info', 'Undone last menu change');
}

function redoMenuAction() {
  if (menuRedoStack.length === 0) return;
  menuUndoStack.push(JSON.stringify(menuDraftConfig));
  menuDraftConfig = JSON.parse(menuRedoStack.pop());
  syncMenuDraftToUI();
  updateUndoRedoButtons();
  updateGlobalSyncStatus();
  showToast('info', 'Redone menu change');
}

function markMenuDirty() {
  updateGlobalSyncStatus();
}

function onMenuTitleInput(field, val) {
  pushMenuHistory();
  if (menuDraftConfig) menuDraftConfig[field] = val;
  renderMenuPreview();
  updateGlobalSyncStatus();
}

async function initMenuPage() {
  await loadMenuSettings();
  syncMenuDraftToUI();
  _menuInitialized = true;
  updateGlobalSyncStatus();
}

async function loadMenuSettings() {
  let loaded = null;
  try {
    const data = await _apiGet('/api/sections?action=menu' + (_menuLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') {
      loaded = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)), data);
    }
  } catch(err) {}

  if (!loaded) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = (_menuLang === 'bn') ? '__menu_config_bn__' : '__menu_config__';
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') loaded = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)), parsed);
        }
      }
    } catch(e) {}
  }

  if (!loaded) {
    loaded = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
  }

  // Set distinct working baseline and draft copies
  appliedMenuConfig = JSON.parse(JSON.stringify(loaded));
  menuDraftConfig = JSON.parse(JSON.stringify(loaded));
  menuUndoStack = [];
  menuRedoStack = [];
  updateUndoRedoButtons();
  updateGlobalSyncStatus();
}

function syncMenuDraftToUI() {
  if (!menuDraftConfig) return;

  const secTitleInput = document.getElementById('menu-sections-title-input');
  if (secTitleInput) secTitleInput.value = menuDraftConfig.sectionsTitle || 'Sections';

  const serTitleInput = document.getElementById('menu-series-title-input');
  if (serTitleInput) serTitleInput.value = menuDraftConfig.seriesTitle || 'Featured series';

  const expTitleInput = document.getElementById('menu-explore-title-input');
  if (expTitleInput) expTitleInput.value = menuDraftConfig.exploreTitle || 'Explore the Privatian';

  const latTitleInput = document.getElementById('menu-latest-title-input');
  if (latTitleInput) latTitleInput.value = menuDraftConfig.latestTitle || 'Read the latest';

  renderSeriesList();
  renderExploreList();
  renderLatestList();
  renderMenuSearch();
  renderMenuSectionsList();
  renderMenuPreview();
}

function switchMenuTab(tabKey) {
  const tabs = ['series', 'explore', 'latest', 'search', 'sections', 'preview'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-menu-${t}`);
    const panel = document.getElementById(`panel-menu-${t}`);
    if (btn) btn.classList.toggle('active', t === tabKey);
    if (panel) panel.style.display = (t === tabKey ? 'block' : 'none');
  });
  if (tabKey === 'search') {
    renderMenuSearch();
  }
  if (tabKey === 'preview') {
    renderMenuPreview();
  }
}

// ── SEARCH BAR & QUICK FILTER TAGS IN NAVIGATION MENU ───────────

function renderMenuSearch() {
  if (!menuDraftConfig) return;
  if (!menuDraftConfig.search) {
    menuDraftConfig.search = {
      enabled: true,
      placeholder: _menuLang === 'bn' ? 'নিবন্ধ, গল্প, বিষয় খুঁজুন...' : 'Search articles, stories, topics...',
      exploreLabel: _menuLang === 'bn' ? 'দ্রুত খুঁজুন:' : 'Explore:',
      closeText: _menuLang === 'bn' ? 'বন্ধ করুন' : 'Close',
      hintText: _menuLang === 'bn' ? 'অনুসন্ধান করতে লিখুন অথবা ওপরের বিষয় বেছে নিন…' : 'Start typing to search or select a topic above…',
      noResultsText: _menuLang === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching stories found',
      quickTags: [
        { id: 'tag-1', label: 'Findings', label_bn: 'অনুসন্ধিৎসু', query: 'Findings', enabled: true },
        { id: 'tag-2', label: 'Community & Heritage', label_bn: 'সমাজ ও ঐতিহ্য', query: 'Community & Heritage', enabled: true },
        { id: 'tag-3', label: 'Culture', label_bn: 'সংস্কৃতি', query: 'Culture', enabled: true },
        { id: 'tag-4', label: 'Privacy & Values', label_bn: 'মূল্যবোধ', query: 'Privacy & Values', enabled: true },
        { id: 'tag-5', label: 'Nation & World', label_bn: 'দেশ ও বিশ্ব', query: 'Nation & World', enabled: true },
        { id: 'tag-6', label: 'Arts & Legacy', label_bn: 'শিল্প ও উত্তরাধিকার', query: 'Arts & Legacy', enabled: true },
        { id: 'tag-7', label: 'Events', label_bn: 'অনুষ্ঠান', query: 'Events', enabled: true }
      ]
    };
  }

  const s = menuDraftConfig.search;
  const toggleEl = document.getElementById('menu-search-enabled-toggle');
  if (toggleEl) toggleEl.checked = (s.enabled !== false);

  const phInput = document.getElementById('menu-search-placeholder-input');
  if (phInput) phInput.value = s.placeholder || '';

  const expInput = document.getElementById('menu-search-explore-label-input');
  if (expInput) expInput.value = s.exploreLabel || '';

  const closeInput = document.getElementById('menu-search-close-text-input');
  if (closeInput) closeInput.value = s.closeText || '';

  const hintInput = document.getElementById('menu-search-hint-text-input');
  if (hintInput) hintInput.value = s.hintText || '';

  // Update Live Preview inside Search panel
  const isBn = (_menuLang === 'bn');
  const previewInput = document.getElementById('menu-search-preview-input');
  if (previewInput) previewInput.placeholder = s.placeholder || (isBn ? 'নিবন্ধ, গল্প, বিষয় খুঁজুন...' : 'Search articles, stories, topics...');

  const previewClose = document.getElementById('menu-search-preview-close');
  if (previewClose) previewClose.textContent = s.closeText || (isBn ? 'বন্ধ করুন' : 'Close');

  const previewExplore = document.getElementById('menu-search-preview-explore');
  if (previewExplore) previewExplore.textContent = s.exploreLabel || (isBn ? 'দ্রুত খুঁজুন:' : 'Explore:');

  const previewTagsContainer = document.getElementById('menu-search-preview-tags');
  if (previewTagsContainer) {
    const activeTags = (s.quickTags || []).filter(t => t.enabled !== false);
    let tagsHtml = `<span class="admin-sp-explore-label" id="menu-search-preview-explore">${escapeHtml(s.exploreLabel || (isBn ? 'দ্রুত খুঁজুন:' : 'Explore:'))}</span>`;
    activeTags.forEach(t => {
      const displayLabel = isBn ? (t.label_bn || t.label) : (t.label || t.label_bn);
      const query = t.query || t.label || t.label_bn;
      tagsHtml += `<button type="button" class="admin-sp-tag-chip" data-tag-id="${t.id}" onclick="selectAdminSpTag('${escapeHtml(query)}', '${t.id}')">${escapeHtml(displayLabel)}</button>`;
    });
    previewTagsContainer.innerHTML = tagsHtml;
  }

  // Refresh live sample search simulation in preview
  const currentVal = previewInput ? previewInput.value : '';
  onAdminSpPreviewSearch(currentVal);

  // Render Tags Grid
  renderSearchTagsList();
}

const SAMPLE_ADMIN_SEARCH_STORIES = [
  { title: "For families in transition, 'not all traditions are equal'", tag: "Community & Heritage", tag_bn: "সমাজ ও ঐতিহ্য" },
  { title: "The art of the pen: How writing shapes cultural identity", tag: "Culture", tag_bn: "সংস্কৃতি" },
  { title: "Wondering: A series of profound questions by Cambridge scholars", tag: "Findings", tag_bn: "অনুসন্ধিৎসু" },
  { title: "The Privatian Society Annual Gala & Legacy Heritage Ceremony", tag: "Events", tag_bn: "অনুষ্ঠান" },
  { title: "Preserving generational wisdom through privacy, values and ethics", tag: "Privacy & Values", tag_bn: "মূল্যবোধ" },
  { title: "Global perspectives on family archives, ancestry and cultural legacy", tag: "Nation & World", tag_bn: "দেশ ও বিশ্ব" }
];

function onAdminSpPreviewSearch(query) {
  const resultsContainer = document.getElementById('menu-search-preview-results');
  const clearBtn = document.getElementById('menu-search-preview-clear-btn');
  if (!resultsContainer || !menuDraftConfig) return;

  const isBn = (_menuLang === 'bn');
  const s = menuDraftConfig.search || {};
  const q = (query || '').trim();

  if (clearBtn) {
    clearBtn.style.display = q ? 'flex' : 'none';
  }

  if (!q) {
    const hint = s.hintText || (isBn ? 'অনুসন্ধান করতে লিখুন অথবা ওপরের বিষয় বেছে নিন…' : 'Start typing to search or select a topic above…');
    resultsContainer.innerHTML = `
      <div class="admin-sp-hint" id="menu-search-preview-hint">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span id="menu-search-preview-hint-text">${escapeHtml(hint)}</span>
      </div>
    `;
    return;
  }

  const lower = q.toLowerCase();
  const matches = SAMPLE_ADMIN_SEARCH_STORIES.filter(item => {
    const tag = isBn ? (item.tag_bn || item.tag) : item.tag;
    return item.title.toLowerCase().includes(lower) || tag.toLowerCase().includes(lower);
  });

  if (!matches.length) {
    resultsContainer.innerHTML = `
      <div style="text-align:center;padding:12px;color:rgba(254,202,202,0.9);font-size:12.5px;">
        ${isBn ? `<strong>"${escapeHtml(q)}"</strong> এর জন্য কোনো ফলাফল পাওয়া যায়নি` : `No results found for <strong>"${escapeHtml(q)}"</strong>`}
      </div>
    `;
    return;
  }

  function highlight(text, matchQuery) {
    if (!matchQuery) return escapeHtml(text);
    const re = new RegExp('(' + matchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escapeHtml(text).replace(re, '<mark class="admin-sp-match">$1</mark>');
  }

  resultsContainer.innerHTML = `
    <div class="admin-sp-card-grid">
      ${matches.map(m => {
        const tag = isBn ? (m.tag_bn || m.tag) : m.tag;
        return `
          <div class="admin-sp-result-card">
            <div class="admin-sp-card-tag">${escapeHtml(tag)}</div>
            <div class="admin-sp-card-title">${highlight(m.title, q)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function selectAdminSpTag(query, tagId) {
  const input = document.getElementById('menu-search-preview-input');
  if (input) {
    input.value = query;
    onAdminSpPreviewSearch(query);
  }
  document.querySelectorAll('.admin-sp-tag-chip').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-tag-id') === tagId);
  });
}

function clearAdminSpPreviewSearch() {
  const input = document.getElementById('menu-search-preview-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  document.querySelectorAll('.admin-sp-tag-chip').forEach(btn => btn.classList.remove('is-active'));
  onAdminSpPreviewSearch('');
}

function renderSearchTagsList() {
  const container = document.getElementById('menu-search-tags-container');
  const countEl = document.getElementById('count-menu-search');
  if (!container || !menuDraftConfig || !menuDraftConfig.search) return;

  const tags = menuDraftConfig.search.quickTags || [];
  if (countEl) countEl.textContent = tags.length;

  if (tags.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;grid-column:1/-1;">No search filter tags added. Click "Add Search Tag" above to create one.</div>`;
    return;
  }

  const isBn = (_menuLang === 'bn');
  container.innerHTML = tags.map((t, idx) => {
    const mainLabel = isBn ? (t.label_bn || t.label) : (t.label || t.label_bn);
    const subLabel = isBn ? (t.label ? `EN: ${t.label}` : '') : (t.label_bn ? `BN: ${t.label_bn}` : '');
    return `
      <div class="menu-item-card ${t.enabled === false ? 'menu-item-card--disabled' : ''}">
        <div class="menu-item-left">
          <div class="menu-item-reorder-btns">
            <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveSearchTag('${t.id}', -1)">${MENU_ICONS.up}</button>
            <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === tags.length - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveSearchTag('${t.id}', 1)">${MENU_ICONS.down}</button>
          </div>
          <div class="menu-item-details">
            <div class="menu-item-title" style="display:flex;align-items:center;gap:6px;">
              <span>${escapeHtml(mainLabel || 'Untitled Tag')}</span>
              ${subLabel ? `<span style="font-size:11px;color:var(--text-muted);font-weight:400;">(${escapeHtml(subLabel)})</span>` : ''}
            </div>
            <div class="menu-item-meta">
              <span class="hs-slug-chip" style="background:rgba(56,189,248,0.1);color:#0284c7;border-color:rgba(56,189,248,0.25);">Query: "${escapeHtml(t.query || t.label || '')}"</span>
            </div>
          </div>
        </div>
        <div class="menu-item-right">
          <label class="hs-toggle" title="Toggle visibility">
            <input type="checkbox" ${t.enabled !== false ? 'checked' : ''} onchange="toggleSearchTag('${t.id}')" />
            <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
          </label>
          <button type="button" class="art-action-btn art-action-btn--edit" title="Edit Search Tag" onclick="openSearchTagModal('${t.id}')">
            ${ICONS.pencil}
          </button>
          <button type="button" class="art-action-btn art-action-btn--trash" title="Delete Search Tag" onclick="deleteSearchTag('${t.id}')">
            ${ICONS.trash}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function onMenuSearchInput(field, val) {
  pushMenuHistory();
  if (!menuDraftConfig.search) menuDraftConfig.search = {};
  menuDraftConfig.search[field] = val;
  renderMenuSearch();
  renderMenuPreview();
  updateGlobalSyncStatus();
}

function toggleMenuSearchEnabled(checked) {
  pushMenuHistory();
  if (!menuDraftConfig.search) menuDraftConfig.search = {};
  menuDraftConfig.search.enabled = checked;
  renderMenuSearch();
  renderMenuPreview();
  updateGlobalSyncStatus();
  recordActivityLog({
    action: 'layout.menu_toggle_search',
    category: 'layout',
    summary: `${checked ? 'Enabled' : 'Disabled'} Menubar Search Bar in Navigation Menu`,
    target_id: 'menu_search',
    target_name: 'Menubar Search',
    details: { enabled: checked }
  });
}

function openSearchTagModal(id) {
  const modal = document.getElementById('modal-menu-search-tag');
  const titleEl = document.getElementById('modal-search-tag-title');
  const idInput = document.getElementById('search-tag-edit-id');
  const labelInput = document.getElementById('search-tag-label-input');
  const labelBnInput = document.getElementById('search-tag-label-bn-input');
  const queryInput = document.getElementById('search-tag-query-input');
  const enabledInput = document.getElementById('search-tag-enabled-input');

  if (!modal) return;

  if (id) {
    const item = ((menuDraftConfig && menuDraftConfig.search && menuDraftConfig.search.quickTags) || []).find(t => t.id === id);
    if (!item) return;
    if (titleEl) titleEl.textContent = 'Edit Search Tag';
    if (idInput) idInput.value = item.id;
    if (labelInput) labelInput.value = item.label || '';
    if (labelBnInput) labelBnInput.value = item.label_bn || '';
    if (queryInput) queryInput.value = item.query || item.label || '';
    if (enabledInput) enabledInput.checked = (item.enabled !== false);
  } else {
    if (titleEl) titleEl.textContent = 'Add Search Tag';
    if (idInput) idInput.value = '';
    if (labelInput) labelInput.value = '';
    if (labelBnInput) labelBnInput.value = '';
    if (queryInput) queryInput.value = '';
    if (enabledInput) enabledInput.checked = true;
  }

  modal.removeAttribute('hidden');
  if (labelInput) labelInput.focus();
}

function closeSearchTagModal() {
  const modal = document.getElementById('modal-menu-search-tag');
  if (modal) modal.setAttribute('hidden', '');
}

function saveSearchTagModal() {
  const idInput = document.getElementById('search-tag-edit-id');
  const labelInput = document.getElementById('search-tag-label-input');
  const labelBnInput = document.getElementById('search-tag-label-bn-input');
  const queryInput = document.getElementById('search-tag-query-input');
  const enabledInput = document.getElementById('search-tag-enabled-input');

  const editId = idInput ? idInput.value : '';
  const label = labelInput ? labelInput.value.trim() : '';
  const labelBn = labelBnInput ? labelBnInput.value.trim() : '';
  const query = queryInput ? queryInput.value.trim() : (label || labelBn);
  const enabled = enabledInput ? enabledInput.checked : true;

  if (!label && !labelBn) {
    showToast('error', 'Please enter a Tag Label');
    return;
  }

  pushMenuHistory();

  if (!menuDraftConfig.search) menuDraftConfig.search = {};
  if (!menuDraftConfig.search.quickTags) menuDraftConfig.search.quickTags = [];

  if (editId) {
    const item = menuDraftConfig.search.quickTags.find(t => t.id === editId);
    if (item) {
      item.label = label || item.label;
      item.label_bn = labelBn || item.label_bn;
      item.query = query || item.query;
      item.enabled = enabled;
    }
  } else {
    const newId = 'tag-' + Date.now();
    menuDraftConfig.search.quickTags.push({
      id: newId,
      label: label || labelBn,
      label_bn: labelBn || label,
      query: query || label || labelBn,
      enabled
    });
  }

  closeSearchTagModal();
  renderMenuSearch();
  renderMenuPreview();
  updateGlobalSyncStatus();
  showToast('success', editId ? 'Search tag updated!' : 'Search tag added!');

  recordActivityLog({
    action: editId ? 'layout.menu_edit_search_tag' : 'layout.menu_add_search_tag',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} search tag "${label || labelBn}" in Navigation Menu`,
    target_id: editId || 'tag-new',
    target_name: label || labelBn,
    details: { label, label_bn: labelBn, query, enabled }
  });
}

function deleteSearchTag(id) {
  if (!menuDraftConfig || !menuDraftConfig.search) return;
  const item = (menuDraftConfig.search.quickTags || []).find(t => t.id === id);
  pushMenuHistory();
  menuDraftConfig.search.quickTags = (menuDraftConfig.search.quickTags || []).filter(t => t.id !== id);
  renderMenuSearch();
  renderMenuPreview();
  updateGlobalSyncStatus();
  showToast('info', 'Search tag deleted');
  if (item) {
    recordActivityLog({
      action: 'layout.menu_delete_search_tag',
      category: 'layout',
      summary: `Deleted search tag "${item.label || id}" from Navigation Menu`,
      target_id: id,
      target_name: item.label || id,
      details: { id }
    });
  }
}

function toggleSearchTag(id) {
  if (!menuDraftConfig || !menuDraftConfig.search) return;
  const item = (menuDraftConfig.search.quickTags || []).find(t => t.id === id);
  if (item) {
    pushMenuHistory();
    item.enabled = (item.enabled === false ? true : false);
    renderMenuSearch();
    renderMenuPreview();
    updateGlobalSyncStatus();
    recordActivityLog({
      action: 'layout.menu_toggle_search_tag',
      category: 'layout',
      summary: `${item.enabled ? 'Enabled' : 'Disabled'} search tag "${item.label || id}" in Navigation Menu`,
      target_id: item.id,
      target_name: item.label,
      details: { id: item.id, enabled: item.enabled }
    });
  }
}

function moveSearchTag(id, dir) {
  if (!menuDraftConfig || !menuDraftConfig.search) return;
  const items = menuDraftConfig.search.quickTags || [];
  const idx = items.findIndex(t => t.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  pushMenuHistory();
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderMenuSearch();
  renderMenuPreview();
  updateGlobalSyncStatus();
}

// ── FEATURED SERIES CRUD ─────────────────────────────────────────

function renderSeriesList() {
  const container = document.getElementById('menu-series-list-container');
  const countEl = document.getElementById('count-menu-series');
  if (!container) return;

  const items = (menuDraftConfig && menuDraftConfig.series) || [];
  if (countEl) countEl.textContent = items.length;

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">No series cards added yet. Click "Add New Series" above.</div>`;
    return;
  }

  container.innerHTML = items.map((s, idx) => `
    <div class="menu-item-card ${s.enabled === false ? 'menu-item-card--disabled' : ''}">
      <div class="menu-item-left">
        <div class="menu-item-reorder-btns">
          <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveSeriesItem('${s.id}', -1)">${MENU_ICONS.up}</button>
          <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === items.length - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveSeriesItem('${s.id}', 1)">${MENU_ICONS.down}</button>
        </div>
        <div class="menu-item-details">
          <div class="menu-item-title">${escapeHtml(s.title || 'Untitled Series')}</div>
          <div class="menu-item-meta">
            <span class="hs-slug-chip">${escapeHtml(s.href || '#')}</span>
          </div>
          <div class="menu-item-desc">${escapeHtml(s.description || 'No description')}</div>
        </div>
      </div>
      <div class="menu-item-right">
        <label class="hs-toggle" title="Toggle visibility">
          <input type="checkbox" ${s.enabled !== false ? 'checked' : ''} onchange="toggleSeriesItem('${s.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" title="Edit Series" onclick="openSeriesModal('${s.id}')">
          ${ICONS.pencil}
        </button>
        <button type="button" class="art-action-btn art-action-btn--trash" title="Delete Series" onclick="deleteSeriesItem('${s.id}')">
          ${ICONS.trash}
        </button>
      </div>
    </div>
  `).join('');
}

function openSeriesModal(id) {
  const modal = document.getElementById('modal-series-overlay');
  const titleEl = document.getElementById('modal-series-title');
  const editIdInput = document.getElementById('series-edit-id');
  const nameInput = document.getElementById('series-name-input');
  const hrefInput = document.getElementById('series-href-input');
  const descInput = document.getElementById('series-desc-input');
  const enabledInput = document.getElementById('series-enabled-input');
  const hrefLockNote = document.getElementById('series-href-lock-note');
  const isBn = _menuLang === 'bn';

  if (id) {
    const item = ((menuDraftConfig && menuDraftConfig.series) || []).find(s => s.id === id);
    if (!item) return;
    titleEl.textContent = 'Edit Featured Series';
    editIdInput.value = item.id;
    nameInput.value = item.title || '';
    if (hrefInput) {
      hrefInput.value = item.href || '';
      hrefInput.readOnly = isBn;
      hrefInput.style.opacity = isBn ? '0.55' : '1';
      hrefInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      hrefInput.style.cursor = isBn ? 'not-allowed' : '';
      hrefInput.title = isBn ? '[Locked] URL is unified in backend and defined strictly in English' : '';
    }
    descInput.value = item.description || '';
    enabledInput.checked = item.enabled !== false;
  } else {
    titleEl.textContent = 'Add Featured Series';
    editIdInput.value = '';
    nameInput.value = '';
    if (hrefInput) {
      hrefInput.value = 'section.html?slug=findings';
      hrefInput.readOnly = isBn;
      hrefInput.style.opacity = isBn ? '0.55' : '1';
      hrefInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      hrefInput.style.cursor = isBn ? 'not-allowed' : '';
      hrefInput.title = isBn ? '[Locked] URL is unified in backend and defined strictly in English' : '';
    }
    descInput.value = '';
    enabledInput.checked = true;
  }
  if (hrefLockNote) hrefLockNote.style.display = isBn ? 'block' : 'none';
  modal.removeAttribute('hidden');
  nameInput.focus();
}

function closeSeriesModal() {
  const modal = document.getElementById('modal-series-overlay');
  if (modal) modal.setAttribute('hidden', '');
}

function saveSeriesItem() {
  const editId = document.getElementById('series-edit-id').value;
  const title = document.getElementById('series-name-input').value.trim();
  const href = document.getElementById('series-href-input').value.trim();
  const desc = document.getElementById('series-desc-input').value.trim();
  const enabled = document.getElementById('series-enabled-input').checked;
  const isBn = _menuLang === 'bn';

  if (!title) {
    showToast('error', 'Series Title is required');
    return;
  }

  pushMenuHistory();
  if (!menuDraftConfig.series) menuDraftConfig.series = [];

  if (editId) {
    const item = menuDraftConfig.series.find(s => s.id === editId);
    if (item) {
      item.title = title;
      if (!isBn) item.href = href;
      item.description = desc;
      item.enabled = enabled;
    }
  } else {
    menuDraftConfig.series.push({
      id: 'series-' + Date.now(),
      title,
      href,
      description: desc,
      enabled
    });
  }

  closeSeriesModal();
  renderSeriesList();
  renderMenuPreview();

  recordActivityLog({
    action: editId ? 'layout.menu_edit_series' : 'layout.menu_add_series',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} featured series "${title}" in Navigation Menu`,
    target_id: editId || 'series-new',
    target_name: title,
    details: { title, href, description: desc, enabled }
  });
}

function deleteSeriesItem(id) {
  const item = (menuDraftConfig.series || []).find(s => s.id === id);
  pushMenuHistory();
  menuDraftConfig.series = (menuDraftConfig.series || []).filter(s => s.id !== id);
  renderSeriesList();
  renderMenuPreview();
  if (item) {
    recordActivityLog({
      action: 'layout.menu_delete_series',
      category: 'layout',
      summary: `Deleted featured series "${item.title || id}" from Navigation Menu`,
      target_id: id,
      target_name: item.title || id,
      details: { id }
    });
  }
}

function toggleSeriesItem(id) {
  const item = (menuDraftConfig.series || []).find(s => s.id === id);
  if (item) {
    pushMenuHistory();
    item.enabled = (item.enabled === false ? true : false);
    renderSeriesList();
    renderMenuPreview();
    recordActivityLog({
      action: 'layout.menu_toggle_series',
      category: 'layout',
      summary: `${item.enabled ? 'Enabled' : 'Disabled'} featured series "${item.title || id}" in Navigation Menu`,
      target_id: item.id,
      target_name: item.title,
      details: { seriesId: item.id, enabled: item.enabled, href: item.href }
    });
  }
}

function moveSeriesItem(id, dir) {
  const items = menuDraftConfig.series || [];
  const idx = items.findIndex(s => s.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  pushMenuHistory();
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderSeriesList();
  renderMenuPreview();
  recordActivityLog({
    action: 'layout.menu_reorder_series',
    category: 'layout',
    summary: `Reordered series "${temp.title || id}" (${dir < 0 ? 'Moved Up' : 'Moved Down'}) in Navigation Menu`,
    target_id: id,
    target_name: temp.title || id,
    details: { id, dir }
  });
}

// ── EXPLORE LINKS CRUD ───────────────────────────────────────────

function renderExploreList() {
  const container = document.getElementById('menu-explore-list-container');
  const countEl = document.getElementById('count-menu-explore');
  if (!container) return;

  const items = (menuDraftConfig && menuDraftConfig.explore) || [];
  if (countEl) countEl.textContent = items.length;

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">No explore links added yet. Click "Add Explore Link" above.</div>`;
    return;
  }

  container.innerHTML = items.map((e, idx) => `
    <div class="menu-item-card ${e.enabled === false ? 'menu-item-card--disabled' : ''}">
      <div class="menu-item-left">
        <div class="menu-item-reorder-btns">
          <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveExploreItem('${e.id}', -1)">${MENU_ICONS.up}</button>
          <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === items.length - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveExploreItem('${e.id}', 1)">${MENU_ICONS.down}</button>
        </div>
        <div class="menu-item-details">
          <div class="menu-item-title">${escapeHtml(e.label || 'Untitled Link')}</div>
          <div class="menu-item-meta">
            <span class="hs-slug-chip">${escapeHtml(e.href || '#')}</span>
            <span style="font-size:11px;color:var(--text-muted);">${e.target === '_blank' ? 'New Tab' : 'Same Tab'}</span>
          </div>
        </div>
      </div>
      <div class="menu-item-right">
        <label class="hs-toggle" title="Toggle visibility">
          <input type="checkbox" ${e.enabled !== false ? 'checked' : ''} onchange="toggleExploreItem('${e.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" title="Edit Link" onclick="openExploreModal('${e.id}')">
          ${ICONS.pencil}
        </button>
        <button type="button" class="art-action-btn art-action-btn--trash" title="Delete Link" onclick="deleteExploreItem('${e.id}')">
          ${ICONS.trash}
        </button>
      </div>
    </div>
  `).join('');
}

function openExploreModal(id) {
  const modal = document.getElementById('modal-explore-overlay');
  const titleEl = document.getElementById('modal-explore-title');
  const editIdInput = document.getElementById('explore-edit-id');
  const labelInput = document.getElementById('explore-label-input');
  const hrefInput = document.getElementById('explore-href-input');
  const targetInput = document.getElementById('explore-target-input');
  const enabledInput = document.getElementById('explore-enabled-input');
  const hrefLockNote = document.getElementById('explore-href-lock-note');
  const isBn = _menuLang === 'bn';

  if (id) {
    const item = ((menuDraftConfig && menuDraftConfig.explore) || []).find(e => e.id === id);
    if (!item) return;
    titleEl.textContent = 'Edit Explore Link';
    editIdInput.value = item.id;
    labelInput.value = item.label || '';
    if (hrefInput) {
      hrefInput.value = item.href || '';
      hrefInput.readOnly = isBn;
      hrefInput.style.opacity = isBn ? '0.55' : '1';
      hrefInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      hrefInput.style.cursor = isBn ? 'not-allowed' : '';
      hrefInput.title = isBn ? '[Locked] URL is unified in backend and defined strictly in English' : '';
    }
    if (targetInput) {
      targetInput.value = item.target || '_self';
      targetInput.disabled = isBn;
    }
    enabledInput.checked = item.enabled !== false;
  } else {
    titleEl.textContent = 'Add Explore Link';
    editIdInput.value = '';
    labelInput.value = '';
    if (hrefInput) {
      hrefInput.value = 'index.html';
      hrefInput.readOnly = isBn;
      hrefInput.style.opacity = isBn ? '0.55' : '1';
      hrefInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      hrefInput.style.cursor = isBn ? 'not-allowed' : '';
      hrefInput.title = isBn ? '[Locked] URL is unified in backend and defined strictly in English' : '';
    }
    if (targetInput) {
      targetInput.value = '_self';
      targetInput.disabled = isBn;
    }
    enabledInput.checked = true;
  }
  if (hrefLockNote) hrefLockNote.style.display = isBn ? 'block' : 'none';
  modal.removeAttribute('hidden');
  labelInput.focus();
}

function closeExploreModal() {
  const modal = document.getElementById('modal-explore-overlay');
  if (modal) modal.setAttribute('hidden', '');
}

function saveExploreItem() {
  const editId = document.getElementById('explore-edit-id').value;
  const label = document.getElementById('explore-label-input').value.trim();
  const href = document.getElementById('explore-href-input').value.trim();
  const target = document.getElementById('explore-target-input').value;
  const enabled = document.getElementById('explore-enabled-input').checked;
  const isBn = _menuLang === 'bn';

  if (!label) {
    showToast('error', 'Link Label is required');
    return;
  }

  pushMenuHistory();
  if (!menuDraftConfig.explore) menuDraftConfig.explore = [];

  if (editId) {
    const item = menuDraftConfig.explore.find(e => e.id === editId);
    if (item) {
      item.label = label;
      if (!isBn) {
        item.href = href;
        item.target = target;
      }
      item.enabled = enabled;
    }
  } else {
    menuDraftConfig.explore.push({
      id: 'exp-' + Date.now(),
      label,
      href,
      target,
      enabled
    });
  }

  closeExploreModal();
  renderExploreList();
  renderMenuPreview();

  recordActivityLog({
    action: editId ? 'layout.menu_edit_explore' : 'layout.menu_add_explore',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} explore link "${label}" in Navigation Menu`,
    target_id: editId || 'explore-new',
    target_name: label,
    details: { label, href, target, enabled }
  });
}

function deleteExploreItem(id) {
  const item = (menuDraftConfig.explore || []).find(e => e.id === id);
  pushMenuHistory();
  menuDraftConfig.explore = (menuDraftConfig.explore || []).filter(e => e.id !== id);
  renderExploreList();
  renderMenuPreview();
  if (item) {
    recordActivityLog({
      action: 'layout.menu_delete_explore',
      category: 'layout',
      summary: `Deleted explore link "${item.label || id}" from Navigation Menu`,
      target_id: id,
      target_name: item.label || id,
      details: { id }
    });
  }
}

function toggleExploreItem(id) {
  const item = (menuDraftConfig.explore || []).find(e => e.id === id);
  if (item) {
    pushMenuHistory();
    item.enabled = (item.enabled === false ? true : false);
    renderExploreList();
    renderMenuPreview();
    recordActivityLog({
      action: 'layout.menu_toggle_explore',
      category: 'layout',
      summary: `${item.enabled ? 'Enabled' : 'Disabled'} explore link "${item.label || id}" in Navigation Menu`,
      target_id: item.id,
      target_name: item.label,
      details: { id: item.id, enabled: item.enabled, href: item.href }
    });
  }
}

function moveExploreItem(id, dir) {
  const items = menuDraftConfig.explore || [];
  const idx = items.findIndex(e => e.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  pushMenuHistory();
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderExploreList();
  renderMenuPreview();
  recordActivityLog({
    action: 'layout.menu_reorder_explore',
    category: 'layout',
    summary: `Reordered explore link "${temp.label || id}" (${dir < 0 ? 'Moved Up' : 'Moved Down'}) in Navigation Menu`,
    target_id: id,
    target_name: temp.label || id,
    details: { id, dir }
  });
}

// ── READ THE LATEST CRUD ─────────────────────────────────────────

function renderLatestList() {
  const container = document.getElementById('menu-latest-list-container');
  const countEl = document.getElementById('count-menu-latest');
  if (!container) return;

  const items = (menuDraftConfig && menuDraftConfig.latest) || [];
  if (countEl) countEl.textContent = items.length;

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">No story highlights added yet. Click "Add Story Highlight" above.</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="menu-item-card ${item.enabled === false ? 'menu-item-card--disabled' : ''}">
      <div class="menu-item-left">
        <div class="menu-item-reorder-btns">
          <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveLatestItem('${item.id}', -1)">${MENU_ICONS.up}</button>
          <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === items.length - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveLatestItem('${item.id}', 1)">${MENU_ICONS.down}</button>
        </div>
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" class="menu-item-img" onerror="this.style.display='none'" />` : ''}
        <div class="menu-item-details">
          <div class="menu-item-title">${escapeHtml(item.title || 'Untitled Story')}</div>
          <div class="menu-item-meta">
            <span class="hs-slug-chip">${escapeHtml(item.href || '#')}</span>
          </div>
        </div>
      </div>
      <div class="menu-item-right">
        <label class="hs-toggle" title="Toggle visibility">
          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleLatestItem('${item.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" title="Edit Story" onclick="openLatestModal('${item.id}')">
          ${ICONS.pencil}
        </button>
        <button type="button" class="art-action-btn art-action-btn--trash" title="Delete Story" onclick="deleteLatestItem('${item.id}')">
          ${ICONS.trash}
        </button>
      </div>
    </div>
  `).join('');
}

function openLatestModal(id) {
  const modal = document.getElementById('modal-latest-overlay');
  const titleEl = document.getElementById('modal-latest-title');
  const editIdInput = document.getElementById('latest-edit-id');
  const headlineInput = document.getElementById('latest-headline-input');
  const hrefInput = document.getElementById('latest-href-input');
  const imageInput = document.getElementById('latest-image-input');
  const enabledInput = document.getElementById('latest-enabled-input');

  if (id) {
    const item = ((menuDraftConfig && menuDraftConfig.latest) || []).find(l => l.id === id);
    if (!item) return;
    titleEl.textContent = 'Edit Story Highlight';
    editIdInput.value = item.id;
    headlineInput.value = item.title || '';
    hrefInput.value = item.href || '';
    imageInput.value = item.imageUrl || '';
    enabledInput.checked = item.enabled !== false;
  } else {
    titleEl.textContent = 'Add Story Highlight';
    editIdInput.value = '';
    headlineInput.value = '';
    hrefInput.value = 'section.html?slug=findings';
    imageInput.value = 'img1.png';
    enabledInput.checked = true;
  }
  updateLatestImagePreview();
  modal.removeAttribute('hidden');
  headlineInput.focus();
}

function updateLatestImagePreview() {
  const imgInput = document.getElementById('latest-image-input');
  const imgEl = document.getElementById('latest-image-preview-img');
  if (imgInput && imgEl) {
    imgEl.src = imgInput.value.trim() || 'img1.png';
  }
}

function closeLatestModal() {
  const modal = document.getElementById('modal-latest-overlay');
  if (modal) modal.setAttribute('hidden', '');
}

function saveLatestItem() {
  const editId = document.getElementById('latest-edit-id').value;
  const title = document.getElementById('latest-headline-input').value.trim();
  const href = document.getElementById('latest-href-input').value.trim();
  const imageUrl = document.getElementById('latest-image-input').value.trim();
  const enabled = document.getElementById('latest-enabled-input').checked;

  if (!title) {
    showToast('error', 'Headline / Title is required');
    return;
  }

  pushMenuHistory();
  if (!menuDraftConfig.latest) menuDraftConfig.latest = [];

  if (editId) {
    const item = menuDraftConfig.latest.find(l => l.id === editId);
    if (item) {
      item.title = title;
      item.href = href;
      item.imageUrl = imageUrl;
      item.enabled = enabled;
    }
  } else {
    menuDraftConfig.latest.push({
      id: 'latest-' + Date.now(),
      title,
      href,
      imageUrl,
      enabled
    });
  }

  closeLatestModal();
  renderLatestList();
  renderMenuPreview();

  recordActivityLog({
    action: editId ? 'layout.menu_edit_latest' : 'layout.menu_add_latest',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} story highlight "${title}" in Navigation Menu`,
    target_id: editId || 'latest-new',
    target_name: title,
    details: { title, href, imageUrl, enabled }
  });
}

function deleteLatestItem(id) {
  const item = (menuDraftConfig.latest || []).find(l => l.id === id);
  pushMenuHistory();
  menuDraftConfig.latest = (menuDraftConfig.latest || []).filter(l => l.id !== id);
  renderLatestList();
  renderMenuPreview();
  if (item) {
    recordActivityLog({
      action: 'layout.menu_delete_latest',
      category: 'layout',
      summary: `Deleted story highlight "${item.title || id}" from Navigation Menu`,
      target_id: id,
      target_name: item.title || id,
      details: { id }
    });
  }
}

function toggleLatestItem(id) {
  const item = (menuDraftConfig.latest || []).find(l => l.id === id);
  if (item) {
    pushMenuHistory();
    item.enabled = (item.enabled === false ? true : false);
    renderLatestList();
    renderMenuPreview();
    recordActivityLog({
      action: 'layout.menu_toggle_latest',
      category: 'layout',
      summary: `${item.enabled ? 'Enabled' : 'Disabled'} story highlight "${item.title || id}" in Navigation Menu`,
      target_id: item.id,
      target_name: item.title,
      details: { id: item.id, enabled: item.enabled }
    });
  }
}

function moveLatestItem(id, dir) {
  const items = menuDraftConfig.latest || [];
  const idx = items.findIndex(l => l.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  pushMenuHistory();
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderLatestList();
  renderMenuPreview();
  recordActivityLog({
    action: 'layout.menu_reorder_latest',
    category: 'layout',
    summary: `Reordered story highlight "${temp.title || id}" (${dir < 0 ? 'Moved Up' : 'Moved Down'}) in Navigation Menu`,
    target_id: id,
    target_name: temp.title || id,
    details: { id, dir }
  });
}

// ── SECTIONS COLUMN IN MENU ──────────────────────────────────────

function renderMenuSectionsList() {
  const container = document.getElementById('menu-sections-list-container');
  if (!container || !menuDraftConfig) return;

  const validSecs = (sections || []).filter(s => !s.deleted);
  if (validSecs.length === 0) {
    container.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px;">No active sections available.</div>`;
    return;
  }

  const enabledSlugs = Array.isArray(menuDraftConfig.enabledMenuSections) ? menuDraftConfig.enabledMenuSections : null;
  let orderedSecs = [...validSecs];
  if (enabledSlugs) {
    orderedSecs.sort((a, b) => {
      const idA = a.slug || a.id;
      const idB = b.slug || b.id;
      const idxA = enabledSlugs.indexOf(idA);
      const idxB = enabledSlugs.indexOf(idB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }

  const isBn = (_menuLang === 'bn');
  container.innerHTML = orderedSecs.map((s, idx) => {
    const slug = s.slug || s.id;
    const isChecked = (enabledSlugs === null) ? true : enabledSlugs.includes(slug);
    const displayName = (isBn && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
    return `
      <div class="hs-section-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:6px;flex-shrink:0;">#${idx + 1}</span>
          <div style="display:flex;gap:3px;flex-shrink:0;">
            <button type="button" class="action-btn" onclick="moveMenuSection(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === 0 ? 'not-allowed' : 'pointer'};opacity:${idx === 0 ? '0.4' : '1'};font-size:11px;">
              ▲
            </button>
            <button type="button" class="action-btn" onclick="moveMenuSection(${idx}, 1)" ${idx === orderedSecs.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === orderedSecs.length - 1 ? 'not-allowed' : 'pointer'};opacity:${idx === orderedSecs.length - 1 ? '0.4' : '1'};font-size:11px;">
              ▼
            </button>
          </div>
          <div class="hs-section-info" style="min-width:0;flex:1;">
            <span class="hs-section-name" style="font-weight:600;font-size:13.5px;color:#0f172a;">${escapeHtml(displayName)}</span>
            <span class="hs-slug-chip" style="margin-left:6px;font-size:11px;color:#64748b;">${s.slug ? '/section/' + escapeHtml(s.slug) : '/ (all)'}</span>
          </div>
        </div>
        <label class="hs-toggle" style="flex-shrink:0;margin-left:12px;">
          <input type="checkbox" data-menu-section-slug="${escapeHtml(slug)}" ${isChecked ? 'checked' : ''} onchange="onMenuSectionToggle()" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
      </div>
    `;
  }).join('');
}

function moveMenuSection(index, dir) {
  if (!menuDraftConfig) return;
  pushMenuHistory();
  const validSecs = (sections || []).filter(s => !s.deleted);
  let orderedSecs = [...validSecs];
  const enabledSlugs = Array.isArray(menuDraftConfig.enabledMenuSections) ? menuDraftConfig.enabledMenuSections : validSecs.map(s => s.slug || s.id);

  orderedSecs.sort((a, b) => {
    const idA = a.slug || a.id;
    const idB = b.slug || b.id;
    const idxA = enabledSlugs.indexOf(idA);
    const idxB = enabledSlugs.indexOf(idB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const targetIndex = index + dir;
  if (targetIndex < 0 || targetIndex >= orderedSecs.length) return;

  const item = orderedSecs.splice(index, 1)[0];
  orderedSecs.splice(targetIndex, 0, item);

  const currentChecked = Array.from(document.querySelectorAll('input[data-menu-section-slug]')).filter(c => c.checked).map(c => c.dataset.menuSectionSlug);
  menuDraftConfig.enabledMenuSections = orderedSecs
    .filter(s => currentChecked.includes(s.slug || s.id))
    .map(s => s.slug || s.id);

  renderMenuSectionsList();
  renderMenuPreview();
  updateGlobalSyncStatus();
}

function onMenuSectionToggle() {
  const checkboxes = document.querySelectorAll('input[data-menu-section-slug]');
  const selected = [];
  checkboxes.forEach(cb => {
    if (cb.checked) selected.push(cb.dataset.menuSectionSlug);
  });
  pushMenuHistory();
  menuDraftConfig.enabledMenuSections = selected;
  renderMenuSectionsList();
  renderMenuPreview();

  recordActivityLog({
    action: 'layout.menu_toggle_section',
    category: 'layout',
    summary: `Updated visible sections in Navigation Menu column (${selected.join(', ') || 'None'})`,
    target_id: 'menu_sections',
    target_name: 'Navigation Menu Sections',
    details: { enabledSections: selected }
  });
}

// ── LIVE PREVIEW IN ADMIN ────────────────────────────────────────

function renderMenuPreview() {
  const box = document.getElementById('menu-live-preview-box');
  if (!box || !menuDraftConfig) return;

  // Collect updated titles
  const secTitle = (document.getElementById('menu-sections-title-input') || {}).value || menuDraftConfig.sectionsTitle || 'Sections';
  const serTitle = (document.getElementById('menu-series-title-input') || {}).value || menuDraftConfig.seriesTitle || 'Featured series';
  const expTitle = (document.getElementById('menu-explore-title-input') || {}).value || menuDraftConfig.exploreTitle || 'Explore the Privatian';
  const latTitle = (document.getElementById('menu-latest-title-input') || {}).value || menuDraftConfig.latestTitle || 'Read the latest';

  // Search preview
  const searchCfg = menuDraftConfig.search || {};
  const isBn = (_menuLang === 'bn');
  const searchHtml = (searchCfg.enabled !== false) ? `
    <div style="background:radial-gradient(circle at 50% 0%, #081a38 0%, #030a16 80%);border:1.5px solid rgba(56,189,248,0.2);border-radius:14px;padding:16px 18px;margin-bottom:20px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.6);">
      <div class="admin-sp-header-bar" style="max-width:560px;margin:0 auto 10px;">
        <div class="admin-sp-input-wrap" style="height:40px;">
          <svg class="admin-sp-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="admin-sp-input" readonly placeholder="${escapeHtml(searchCfg.placeholder || (isBn ? 'নিবন্ধ, গল্প, বিষয় খুঁজুন...' : 'Search articles, stories, topics...'))}" style="cursor:default;font-size:13.5px;" />
        </div>
        <button type="button" class="admin-sp-close-btn" style="pointer-events:none;height:40px;padding:0 12px;font-size:12px;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>${escapeHtml(searchCfg.closeText || (isBn ? 'বন্ধ করুন' : 'Close'))}</span>
        </button>
      </div>
      <div class="admin-sp-tags-bar" style="margin-top:8px;">
        <span class="admin-sp-explore-label">${escapeHtml(searchCfg.exploreLabel || (isBn ? 'দ্রুত খুঁজুন:' : 'Explore:'))}</span>
        ${(searchCfg.quickTags || []).filter(t => t.enabled !== false).map(t => {
          const l = isBn ? (t.label_bn || t.label) : (t.label || t.label_bn);
          return `<span class="admin-sp-tag-chip" style="font-size:11px;padding:3px 10px;cursor:default;">${escapeHtml(l)}</span>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  // Sections
  const validSecs = (sections || []).filter(s => !s.deleted);
  const enabledSlugs = menuDraftConfig.enabledMenuSections || [];
  const activeSecs = (enabledSlugs.length === 0)
    ? validSecs
    : validSecs.filter(s => enabledSlugs.includes(s.slug || s.id));

  // Series
  const seriesArr = (menuDraftConfig.series || []).filter(s => s.enabled !== false);
  // Explore
  const exploreArr = (menuDraftConfig.explore || []).filter(e => e.enabled !== false);
  // Latest
  const latestArr = (menuDraftConfig.latest || []).filter(l => l.enabled !== false);

  box.innerHTML = `
    ${searchHtml}
    <div class="menu-preview-cols">
      <!-- Col 1: Sections -->
      <div class="menu-preview-col">
        <div class="menu-preview-col-title">${escapeHtml(secTitle)}</div>
        <ul class="menu-preview-list">
          ${activeSecs.map(s => {
            const href = s.slug ? `/section/${escapeHtml(s.slug)}` : '/';
            return `<li><a href="${href}">${escapeHtml(s.name)}</a></li>`;
          }).join('')}
        </ul>
      </div>

      <!-- Col 2: Series & Explore -->
      <div class="menu-preview-col">
        <div class="menu-preview-col-title">${escapeHtml(serTitle)}</div>
        ${seriesArr.map(s => `
          <div class="menu-preview-series-item">
            <div class="menu-preview-series-name"><a href="${s.href}" style="color:#60a5fa;text-decoration:none;">${escapeHtml(s.title)}</a></div>
            <div class="menu-preview-series-desc">${escapeHtml(s.description)}</div>
          </div>
        `).join('')}
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.15);margin:16px 0;" />
        <div class="menu-preview-col-title">${escapeHtml(expTitle)}</div>
        <ul class="menu-preview-list">
          ${exploreArr.map(e => `<li><a href="${e.href}">${escapeHtml(e.label)}</a></li>`).join('')}
        </ul>
      </div>

      <!-- Col 3: Latest Reads -->
      <div class="menu-preview-col">
        <div class="menu-preview-col-title">${escapeHtml(latTitle)}</div>
        ${latestArr.map(item => `
          <div class="menu-preview-latest-item">
            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" class="menu-preview-latest-img" onerror="this.style.display='none'" />` : ''}
            <div class="menu-preview-latest-title"><a href="${item.href}" style="color:#f1f5f9;text-decoration:none;">${escapeHtml(item.title)}</a></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  updateGlobalSyncStatus();
}

// ── SAVE & APPLY MENU SETTINGS (DATABASE FIRST) ──────────────────

async function saveMenuSettings() {
  const saveBtn = document.getElementById('menu-save-btn');

  if (!menuDraftConfig) return;

  // Collect titles from inputs
  menuDraftConfig.sectionsTitle = (document.getElementById('menu-sections-title-input') || {}).value || 'Sections';
  menuDraftConfig.seriesTitle   = (document.getElementById('menu-series-title-input') || {}).value || 'Featured series';
  menuDraftConfig.exploreTitle  = (document.getElementById('menu-explore-title-input') || {}).value || 'Explore the Privatian';
  menuDraftConfig.latestTitle   = (document.getElementById('menu-latest-title-input') || {}).value || 'Read the latest';

  if (menuDraftConfig.search) {
    const phInput = document.getElementById('menu-search-placeholder-input');
    if (phInput && phInput.value.trim()) menuDraftConfig.search.placeholder = phInput.value.trim();
    const expInput = document.getElementById('menu-search-explore-label-input');
    if (expInput && expInput.value.trim()) menuDraftConfig.search.exploreLabel = expInput.value.trim();
    const closeInput = document.getElementById('menu-search-close-text-input');
    if (closeInput && closeInput.value.trim()) menuDraftConfig.search.closeText = closeInput.value.trim();
    const hintInput = document.getElementById('menu-search-hint-text-input');
    if (hintInput && hintInput.value.trim()) menuDraftConfig.search.hintText = hintInput.value.trim();
  }

  if (saveBtn) saveBtn.disabled = true;
  updateGlobalSyncStatus('syncing', 'Saving to database...');

  try {
    // 1. Save to Supabase database via API
    menuDraftConfig.lang = _menuLang;
    await _apiPost('/api/sections?action=menu' + (_menuLang === 'bn' ? '&lang=bn' : ''), menuDraftConfig);

    // 2. Reset base and undo/redo stacks to the new applied state
    appliedMenuConfig = JSON.parse(JSON.stringify(menuDraftConfig));
    menuUndoStack = [];
    menuRedoStack = [];
    updateUndoRedoButtons();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', 'Navigation Menu changes applied and published!');

    recordActivityLog({
      action: 'layout.menu_save',
      category: 'layout',
      summary: `Published Navigation Menu layout (${(menuDraftConfig.series || []).length} Series, ${(menuDraftConfig.explore || []).length} Links, ${(menuDraftConfig.latest || []).length} Stories)`,
      target_id: 'navigation_menu_config',
      target_name: 'Navigation Menu',
      details: {
        sectionsTitle: menuDraftConfig.sectionsTitle,
        seriesTitle: menuDraftConfig.seriesTitle,
        exploreTitle: menuDraftConfig.exploreTitle,
        latestTitle: menuDraftConfig.latestTitle,
        series: (menuDraftConfig.series || []).map(s => ({ title: s.title, enabled: s.enabled !== false })),
        explore: (menuDraftConfig.explore || []).map(e => ({ label: e.label, enabled: e.enabled !== false })),
        latest: (menuDraftConfig.latest || []).map(l => ({ title: l.title, enabled: l.enabled !== false })),
        enabledMenuSections: menuDraftConfig.enabledMenuSections
      }
    });
  } catch(err) {
    console.warn('[Admin] saveMenuSettings server error:', err.message);
    appliedMenuConfig = JSON.parse(JSON.stringify(menuDraftConfig));
    menuUndoStack = [];
    menuRedoStack = [];
    updateUndoRedoButtons();
    updateGlobalSyncStatus('error', 'Error syncing with database');
    showToast('error', 'Failed to save menu changes to database: ' + err.message);

    recordActivityLog({
      action: 'layout.menu_save',
      category: 'layout',
      summary: `Saved Navigation Menu configuration (local cache fallback)`,
      target_id: 'navigation_menu_config',
      target_name: 'Navigation Menu',
      details: { offlineFallback: true }
    });
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Global Keyboard Shortcut for Undo/Redo in Navigation Menu
document.addEventListener('keydown', (e) => {
  const activePage = document.querySelector('.sidebar-nav-item.active');
  if (!activePage || activePage.dataset.page !== 'menu') return;

  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement ? document.activeElement.tagName : '');
  if (isInput) return; // Allow browser text undo inside inputs

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undoMenuAction();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redoMenuAction();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HOMEPAGE MANAGER (Full Database Sync & Visual Interactive Editor)
// ═══════════════════════════════════════════════════════════════════════════

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
          href: 'section.html?slug=culture',
          enabled: true
        },
        subArticles: [
          { id: 'sub-2-1', title: 'AI use surging for creative writing among young Privatian members', href: 'section.html?slug=culture', enabled: true },
          { id: 'sub-2-2', title: 'Pen refill? Go for it, says the Privatian Calligraphy Society', href: 'section.html?slug=culture', enabled: true },
          { id: 'sub-2-3', title: 'Music residency, says Privatian Arts & Culture Society, is about connection', href: 'section.html?slug=culture', enabled: true }
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
          href: 'section.html?slug=privacy-values',
          enabled: true
        },
        subArticles: [
          { id: 'sub-3-1', title: 'Families alone, yes. But watching the community is another thing.', href: 'section.html?slug=privacy-values', enabled: true },
          { id: 'sub-3-2', title: 'Is that family member a Privatian or not — and who decides the rules?', href: 'section.html?slug=privacy-values', enabled: true },
          { id: 'sub-3-3', title: 'Bowling alone, yes. But the Privatian family still gathers.', href: 'section.html?slug=privacy-values', enabled: true }
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
          href: 'section.html?slug=nation-world',
          enabled: true
        },
        subArticles: [
          { id: 'sub-4-1', title: 'Bearing down on global secrecy: what the Privatian model teaches us', href: 'section.html?slug=nation-world', enabled: true },
          { id: 'sub-4-2', title: 'Currency of trust: how the Privatian family built international networks', href: 'section.html?slug=nation-world', enabled: true }
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
          href: 'section.html?slug=arts-legacy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-5-1', title: 'Rowing, dance: yes. But the Privatian pen holds a special place of honor.', href: 'section.html?slug=arts-legacy', enabled: true },
          { id: 'sub-5-2', title: 'Novelist argues the world needs more well-written letters, not fewer', href: 'section.html?slug=arts-legacy', enabled: true },
          { id: 'sub-5-3', title: 'Turnover at The Privatian Society demands that cultural legacy must be paid.', href: 'section.html?slug=arts-legacy', enabled: true }
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
          href: 'section.html?slug=work-economy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-6-1', title: "Rural flower power: the Privatian family's investment in private land", href: 'section.html?slug=work-economy', enabled: true },
          { id: 'sub-6-2', title: 'The Privatian economy advisor talks to the state of family wealth', href: 'section.html?slug=work-economy', enabled: true },
          { id: 'sub-6-3', title: 'Letters of the law: the Privatian legal scholars improve upon family statutes', href: 'section.html?slug=work-economy', enabled: true }
        ]
      }
    ]
  }
};

homepageDraftConfig = null;
appliedHomepageConfig = null;
homepageUndoStack = [];
homepageRedoStack = [];
homepageArticlesList = [];
activeHpTab = 'canvas';

// ── INIT HOMEPAGE PAGE ───────────────────────────────────────────
async function initHomepagePage() {
  await Promise.all([
    loadHomepageSettings(),
    loadArticlesForHomepagePicker()
  ]);
  switchHpTab(activeHpTab || 'canvas');
}

async function loadArticlesForHomepagePicker() {
  homepageArticlesList = [];
  try {
    const list = await _apiGet('/api/articles?action=list');
    if (Array.isArray(list)) homepageArticlesList = list.filter(a => a.status === 'published' || !a.status);
  } catch(e) {}

  if (homepageArticlesList.length === 0) {
    try {
      const pubList = await _apiGet('/api/articles?action=public');
      if (Array.isArray(pubList)) homepageArticlesList = pubList;
    } catch(err) {}
  }

  if (homepageArticlesList.length === 0) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const { data, error } = await sb
          .from('articles')
          .select('id, slug, title, deck, section, author, status, created_at, updated_at, published_at, hero_img_url')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('updated_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          homepageArticlesList = data.filter(a => a.status === 'published' || !a.status);
        }
      }
    } catch(err) {}
  }

  if (homepageArticlesList.length === 0) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/articles?select=id,slug,title,deck,section,author,status,created_at,updated_at,published_at,hero_img_url&or=(is_deleted.is.null,is_deleted.eq.false)&order=updated_at.desc`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) homepageArticlesList = data.filter(a => a.status === 'published' || !a.status);
        }
      }
    } catch(err) {}
  }
}

async function loadHomepageSettings() {
  let loaded = null;
  try {
    const data = await _apiGet('/api/sections?action=homepage' + (_homepageLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') loaded = data;
  } catch(err) {}

  if (!loaded) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _homepageLang === 'bn' ? '__homepage_config_bn__' : '__homepage_config__';
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') loaded = parsed;
        }
      }
    } catch(e) {}
  }

  if (!loaded) {
    loaded = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
  }

  homepageDraftConfig = loaded ? JSON.parse(JSON.stringify(loaded)) : JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
  ensureHomepageConfigDefaults();
  appliedHomepageConfig = JSON.parse(JSON.stringify(homepageDraftConfig));
  homepageUndoStack = [];
  homepageRedoStack = [];
  updateHomepageUndoRedoBtns();
  updateGlobalSyncStatus('synced', 'Synced with database');
}

function ensureHomepageConfigDefaults() {
  if (!homepageDraftConfig) homepageDraftConfig = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
  if (!homepageDraftConfig.hero) homepageDraftConfig.hero = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.hero));
  if (!homepageDraftConfig.hero.main) homepageDraftConfig.hero.main = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.hero.main));
  if (!Array.isArray(homepageDraftConfig.hero.sidebar)) homepageDraftConfig.hero.sidebar = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.hero.sidebar));
  if (!Array.isArray(homepageDraftConfig.smallArticles)) homepageDraftConfig.smallArticles = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.smallArticles));
  if (!homepageDraftConfig.eventsSection) homepageDraftConfig.eventsSection = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.eventsSection));
  if (!Array.isArray(homepageDraftConfig.eventsSection.events)) homepageDraftConfig.eventsSection.events = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.eventsSection.events));
  if (!homepageDraftConfig.eventsSection.featured) homepageDraftConfig.eventsSection.featured = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.eventsSection.featured));
  if (!homepageDraftConfig.allNews) homepageDraftConfig.allNews = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.allNews));
  if (!Array.isArray(homepageDraftConfig.allNews.columns)) homepageDraftConfig.allNews.columns = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG.allNews.columns));
}

// ── UNDO / REDO HISTORY ──────────────────────────────────────────
function pushHomepageHistory() {
  if (!homepageDraftConfig) return;
  homepageUndoStack.push(JSON.stringify(homepageDraftConfig));
  if (homepageUndoStack.length > 50) homepageUndoStack.shift();
  homepageRedoStack = [];
  updateHomepageUndoRedoBtns();
}

function undoHomepageAction() {
  if (!homepageUndoStack.length) return;
  homepageRedoStack.push(JSON.stringify(homepageDraftConfig));
  const prev = homepageUndoStack.pop();
  homepageDraftConfig = JSON.parse(prev);
  renderActiveHpTab();
  updateHomepageUndoRedoBtns();
  updateGlobalSyncStatus();
  showToast('info', 'Undone last change');
}

function redoHomepageAction() {
  if (!homepageRedoStack.length) return;
  homepageUndoStack.push(JSON.stringify(homepageDraftConfig));
  const next = homepageRedoStack.pop();
  homepageDraftConfig = JSON.parse(next);
  renderActiveHpTab();
  updateHomepageUndoRedoBtns();
  updateGlobalSyncStatus();
  showToast('info', 'Redone change');
}

function updateHomepageUndoRedoBtns() {
  const undoBtn = document.getElementById('hp-undo-btn');
  const redoBtn = document.getElementById('hp-redo-btn');
  if (undoBtn) undoBtn.disabled = homepageUndoStack.length === 0;
  if (redoBtn) redoBtn.disabled = homepageRedoStack.length === 0;
}

// ── TAB SWITCHING ────────────────────────────────────────────────
function switchHpTab(tab) {
  activeHpTab = tab;
  document.querySelectorAll('.tab-btn[id^="tab-hp-"]').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-hp-${tab}`);
  });
  document.querySelectorAll('.hp-tab-panel').forEach(panel => {
    panel.style.display = panel.id === `panel-hp-${tab}` ? 'block' : 'none';
  });
  renderActiveHpTab();
}

function renderActiveHpTab() {
  const isBn = _homepageLang === 'bn';
  const saveBtn = document.getElementById('hp-save-btn');
  if (saveBtn) {
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> ${isBn ? 'Apply Changes (বাংলা)' : 'Apply Homepage Changes'}`;
  }
  const langPill = document.getElementById('hp-canvas-lang-pill');
  if (langPill) {
    langPill.textContent = isBn ? 'বাংলা এডিটর (BN)' : 'English Editor (EN)';
    langPill.style.background = isBn ? '#f0fdf4' : '#e0f2fe';
    langPill.style.color = isBn ? '#15803d' : '#0369a1';
    langPill.style.borderColor = isBn ? '#bbf7d0' : '#bae6fd';
  }

  if (activeHpTab === 'canvas') renderHomepageVisualCanvas();
  else if (activeHpTab === 'hero') renderHeroEditor();
  else if (activeHpTab === 'cards') renderCardsEditor();
  else if (activeHpTab === 'events') renderEventsEditor();
  else if (activeHpTab === 'news') renderNewsEditor();
  updateGlobalSyncStatus();
}

// ── RENDER VISUAL CANVAS (WYSIWYG Replica) ───────────────────────
function renderHomepageVisualCanvas() {
  const container = document.getElementById('hp-canvas-container');
  if (!container || !homepageDraftConfig) return;

  const cfg = homepageDraftConfig;
  const heroMain = cfg.hero.main || {};
  const heroSide = cfg.hero.sidebar || [];
  const smallCards = cfg.smallArticles || [];
  const evSec = cfg.eventsSection || {};
  const events = evSec.events || [];
  const featured = evSec.featured || {};
  const allNews = cfg.allNews || {};
  const columns = allNews.columns || [];

  let html = `
    <!-- SECTION 1: HERO SECTION -->
    <div style="margin-bottom:28px;">
      <div class="hp-section-header-box">
        <span class="hp-section-header-title">Hero Lead &amp; Sidebar Section</span>
        <button type="button" class="btn btn--ghost btn--sm" onclick="switchHpTab('hero')">Edit In Detail</button>
      </div>
      <div class="hp-canvas-hero-grid">
        <!-- Hero Main Slot -->
        <div class="hp-slot-card ${heroMain.enabled === false ? 'hp-slot-card--disabled' : ''}" onclick="openHpSlotModal('hero.main', 'Hero Main Lead Story')">
          <div class="hp-slot-badge">Hero Main Story ${heroMain.enabled === false ? '(Disabled)' : ''}</div>
          <div class="hp-slot-edit-hint">${ICONS.pencil} Click to edit</div>
          <div class="hp-canvas-img-wrap hp-canvas-img-wrap--hero">
            <img src="${escapeHtml(heroMain.imageUrl || 'img1.png')}" alt="" class="hp-canvas-img" onerror="this.src='img1.png'" />
          </div>
          <h2 class="hp-canvas-headline hp-canvas-headline--hero">${escapeHtml(heroMain.title || 'Untitled Lead Story')}</h2>
          <p class="hp-canvas-subtitle">${escapeHtml(heroMain.subtitle || '')}</p>
          <div class="hp-canvas-link-url">${escapeHtml(heroMain.href || '#')}</div>
        </div>

        <!-- Hero Sidebar Slots -->
        <div style="display:flex;flex-direction:column;gap:18px;">
          ${heroSide.map((side, sIdx) => `
            <div class="hp-slot-card ${side.enabled === false ? 'hp-slot-card--disabled' : ''}" onclick="openHpSlotModal('hero.sidebar.${sIdx}', 'Hero Sidebar Story ${sIdx + 1}')">
              <div class="hp-slot-badge hp-slot-badge--sidebar">Sidebar Story ${sIdx + 1} ${side.enabled === false ? '(Disabled)' : ''}</div>
              <div class="hp-slot-edit-hint">${ICONS.pencil} Click to edit</div>
              <div class="hp-canvas-img-wrap hp-canvas-img-wrap--side">
                <img src="${escapeHtml(side.imageUrl || 'img5.png')}" alt="" class="hp-canvas-img" onerror="this.src='img5.png'" />
              </div>
              <h3 class="hp-canvas-headline" style="font-size:15px;">${escapeHtml(side.title || 'Untitled Sidebar')}</h3>
              <p class="hp-canvas-subtitle" style="font-size:12.5px;">${escapeHtml(side.description || '')}</p>
              ${side.tag ? `<span class="hp-canvas-tag">${escapeHtml(side.tag)}</span>` : ''}
              <div class="hp-canvas-link-url">${escapeHtml(side.href || '#')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <hr class="hp-canvas-section-divider" />

    <!-- SECTION 2: SMALL 3-CARD GRID -->
    <div style="margin-bottom:28px;">
      <div class="hp-section-header-box">
        <span class="hp-section-header-title">Small Articles (3-Card Grid)</span>
        <button type="button" class="btn btn--ghost btn--sm" onclick="switchHpTab('cards')">Edit In Detail</button>
      </div>
      <div class="hp-canvas-cards-grid">
        ${smallCards.map((card, cIdx) => `
          <div class="hp-slot-card ${card.enabled === false ? 'hp-slot-card--disabled' : ''}" onclick="openHpSlotModal('smallArticles.${cIdx}', 'Small Card ${cIdx + 1}')">
            <div class="hp-slot-badge hp-slot-badge--card">Card ${cIdx + 1} ${card.enabled === false ? '(Disabled)' : ''}</div>
            <div class="hp-slot-edit-hint">${ICONS.pencil} Click to edit</div>
            <div class="hp-canvas-img-wrap">
              <img src="${escapeHtml(card.imageUrl || 'img2.png')}" alt="" class="hp-canvas-img" onerror="this.src='img2.png'" />
            </div>
            <h3 class="hp-canvas-headline" style="font-size:15px;">${escapeHtml(card.title || 'Untitled Card')}</h3>
            <div class="hp-canvas-link-url">${escapeHtml(card.href || '#')}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <hr class="hp-canvas-section-divider" />

    <!-- SECTION 3: EVENTS & SPOTLIGHT -->
    <div style="margin-bottom:28px;">
      <div class="hp-section-header-box">
        <span class="hp-section-header-title">Events Panel &amp; Featured Spotlight</span>
        <button type="button" class="btn btn--ghost btn--sm" onclick="switchHpTab('events')">Edit In Detail</button>
      </div>
      <div class="hp-canvas-events-grid">
        <!-- Events Left Panel -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div>
              <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">${escapeHtml(evSec.eventsHeading || 'Upcoming Events')}</h3>
              <span style="font-size:11px;color:#64748b;">Showing top 2 active events on Homepage</span>
            </div>
            <button type="button" class="btn btn--primary btn--sm" onclick="switchHpTab('events')">Manage All Events</button>
          </div>
          ${(() => {
            const activeEvents = events.filter(e => e.enabled !== false);
            const top2 = activeEvents.slice(0, 2);
            if (top2.length === 0) return '<div style="font-size:12.5px;color:#94a3b8;padding:16px 0;">No active events to display on homepage.</div>';
            return top2.map((ev, eIdx) => `
              <div class="hp-event-item-card" onclick="openHpEventModal('${ev.id}')" style="cursor:pointer;margin-bottom:8px;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span class="hp-event-date-chip">${escapeHtml(ev.date || 'TBA')}</span>
                    <span style="background:${eIdx === 0 ? '#16a34a' : '#0284c7'};color:#fff;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:3px;">Homepage #${eIdx + 1}</span>
                  </div>
                  <div style="font-size:13.5px;font-weight:600;color:#0f172a;">${escapeHtml(ev.title || 'Untitled Event')}</div>
                  <div style="font-size:12px;color:#64748b;margin-top:2px;">${escapeHtml(ev.meta || '')}</div>
                </div>
                <div style="display:flex;gap:4px;">
                  <button type="button" class="art-action-btn art-action-btn--edit" title="Edit Event">${ICONS.pencil}</button>
                </div>
              </div>
            `).join('');
          })()}
          ${events.length > 2 ? `<div style="font-size:11.5px;color:#64748b;margin-top:8px;padding:4px 8px;background:#f1f5f9;border-radius:4px;display:inline-block;">+ ${events.length - 2} more event(s) listed on <a href="/events" target="_blank" style="color:#0a528e;font-weight:600;">/events</a></div>` : ''}
          <div style="margin-top:10px;font-size:13px;font-weight:600;color:#0a528e;cursor:pointer;" onclick="switchHpTab('events')">
            ${escapeHtml(evSec.seeAllText || 'See all events')} &rarr;
          </div>
        </div>

        <!-- Featured Spotlight Right -->
        <div class="hp-slot-card ${featured.enabled === false ? 'hp-slot-card--disabled' : ''}" onclick="openHpSlotModal('eventsSection.featured', 'Events Featured Spotlight Story')">
          <div class="hp-slot-badge hp-slot-badge--events">Featured Spotlight ${featured.enabled === false ? '(Disabled)' : ''}</div>
          <div class="hp-slot-edit-hint">${ICONS.pencil} Click to edit</div>
          <div class="hp-canvas-img-wrap" style="height:200px;">
            <img src="${escapeHtml(featured.imageUrl || 'img5.png')}" alt="" class="hp-canvas-img" onerror="this.src='img5.png'" />
          </div>
          <h3 class="hp-canvas-headline">${escapeHtml(featured.title || 'Untitled Featured Story')}</h3>
          <p class="hp-canvas-subtitle">${escapeHtml(featured.description || '')}</p>
          <div class="hp-canvas-link-url">${escapeHtml(featured.href || '#')}</div>
        </div>
      </div>
    </div>

    <hr class="hp-canvas-section-divider" />

    <!-- SECTION 4 & 5: ALL NEWS COLUMNS -->
    <div>
      <div class="hp-section-header-box">
        <span class="hp-section-header-title">${escapeHtml(allNews.heading || 'All News')} (6 Columns Grid)</span>
        <button type="button" class="btn btn--ghost btn--sm" onclick="switchHpTab('news')">Edit In Detail</button>
      </div>
      <div class="hp-canvas-news-grid">
        ${columns.map((col, colIdx) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:14px;">
            <div style="font-size:13px;font-weight:800;color:#0a528e;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #0a528e;padding-bottom:4px;">
              ${escapeHtml(col.label || `COLUMN ${colIdx + 1}`)}
            </div>

            <!-- Column Lead Story -->
            <div class="hp-slot-card ${col.lead && col.lead.enabled === false ? 'hp-slot-card--disabled' : ''}" onclick="openHpSlotModal('allNews.columns.${colIdx}.lead', '${escapeHtml(col.label)}: Lead Article')">
              <div class="hp-slot-badge hp-slot-badge--col">Column Lead</div>
              <div class="hp-slot-edit-hint">${ICONS.pencil} Edit</div>
              <div class="hp-canvas-img-wrap" style="height:120px;">
                <img src="${escapeHtml((col.lead && col.lead.imageUrl) || 'img1.png')}" alt="" class="hp-canvas-img" onerror="this.src='img1.png'" />
              </div>
              <h4 class="hp-canvas-headline" style="font-size:14px;">${escapeHtml((col.lead && col.lead.title) || 'Untitled Story')}</h4>
              <div class="hp-canvas-link-url">${escapeHtml((col.lead && col.lead.href) || '#')}</div>
            </div>

            <!-- Column Sub Articles List -->
            <div>
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
                <span>Sub-Articles (${(col.subArticles || []).length})</span>
                <button type="button" class="btn btn--ghost btn--sm" style="padding:2px 6px;font-size:10px;" onclick="event.stopPropagation(); addHpSubArticle(${colIdx})">+ Add</button>
              </div>
              ${(col.subArticles || []).map((sub, sIdx) => `
                <div class="hp-sub-headline-item" onclick="openHpSlotModal('allNews.columns.${colIdx}.subArticles.${sIdx}', '${escapeHtml(col.label)}: Sub Story ${sIdx + 1}')" style="cursor:pointer;">
                  <span style="flex:1;line-height:1.35;${sub.enabled === false ? 'text-decoration:line-through;opacity:0.5;' : ''}">${escapeHtml(sub.title || 'Untitled Headline')}</span>
                  <button type="button" class="art-action-btn art-action-btn--edit" title="Edit">${ICONS.pencil}</button>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ── RENDER HERO EDITOR TAB ───────────────────────────────────────
function renderHeroEditor() {
  const container = document.getElementById('hp-hero-editor-container');
  if (!container || !homepageDraftConfig) return;

  const hero = homepageDraftConfig.hero;
  const main = hero.main || {};
  const side = hero.sidebar || [];

  container.innerHTML = `
    <div class="card" style="padding:22px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:10px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0;">Hero Main Lead Story</h3>
        <button type="button" class="btn btn--primary btn--sm" onclick="openHpSlotModal('hero.main', 'Hero Main Lead Story')">Edit Lead Story</button>
      </div>
      <div style="display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:center;">
        <img src="${escapeHtml(main.imageUrl || 'img1.png')}" alt="" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" onerror="this.src='img1.png'" />
        <div>
          <h4 style="font-family:'Libre Baskerville',serif;font-size:16px;font-weight:700;margin:0 0 6px;">${escapeHtml(main.title || 'Untitled')}</h4>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 4px;">${escapeHtml(main.subtitle || '')}</p>
          <span class="hs-slug-chip">${escapeHtml(main.href || '#')}</span>
        </div>
      </div>
    </div>

    <div class="card" style="padding:22px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0 0 16px;border-bottom:1px solid var(--border);padding-bottom:10px;">Hero Sidebar Stories (2 Slots)</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
        ${side.map((s, idx) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="hp-slot-badge hp-slot-badge--sidebar">Sidebar Story ${idx + 1}</span>
                <span style="font-size:11px;color:${s.enabled !== false ? '#16a34a' : '#94a3b8'};font-weight:600;">${s.enabled !== false ? 'Active' : 'Disabled'}</span>
              </div>
              <img src="${escapeHtml(s.imageUrl || 'img5.png')}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:10px;" onerror="this.src='img5.png'" />
              <h4 style="font-size:14px;font-weight:700;margin:0 0 6px;">${escapeHtml(s.title || 'Untitled')}</h4>
              <p style="font-size:12.5px;color:var(--text-muted);margin:0 0 6px;">${escapeHtml(s.description || '')}</p>
              ${s.tag ? `<span class="hp-canvas-tag">${escapeHtml(s.tag)}</span>` : ''}
            </div>
            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
              <span class="hs-slug-chip">${escapeHtml(s.href || '#')}</span>
              <button type="button" class="btn btn--ghost btn--sm" onclick="openHpSlotModal('hero.sidebar.${idx}', 'Hero Sidebar Story ${idx + 1}')">Edit</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── RENDER 3-CARDS TAB ───────────────────────────────────────────
function renderCardsEditor() {
  const container = document.getElementById('hp-cards-editor-container');
  if (!container || !homepageDraftConfig) return;

  const cards = homepageDraftConfig.smallArticles || [];

  container.innerHTML = `
    <div class="card" style="padding:22px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0 0 16px;border-bottom:1px solid var(--border);padding-bottom:10px;">3 Small Articles Row</h3>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:18px;">
        ${cards.map((c, idx) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="hp-slot-badge hp-slot-badge--card">Card ${idx + 1}</span>
                <span style="font-size:11px;color:${c.enabled !== false ? '#16a34a' : '#94a3b8'};font-weight:600;">${c.enabled !== false ? 'Active' : 'Disabled'}</span>
              </div>
              <img src="${escapeHtml(c.imageUrl || 'img2.png')}" alt="" style="width:100%;height:130px;object-fit:cover;border-radius:6px;margin-bottom:10px;" onerror="this.src='img2.png'" />
              <h4 style="font-size:14px;font-weight:700;margin:0 0 6px;">${escapeHtml(c.title || 'Untitled')}</h4>
            </div>
            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
              <span class="hs-slug-chip">${escapeHtml(c.href || '#')}</span>
              <button type="button" class="btn btn--ghost btn--sm" onclick="openHpSlotModal('smallArticles.${idx}', 'Card ${idx + 1}')">Edit</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── RENDER EVENTS TAB ────────────────────────────────────────────
function renderEventsEditor() {
  const container = document.getElementById('hp-events-editor-container');
  if (!container || !homepageDraftConfig) return;

  const evSec = homepageDraftConfig.eventsSection || {};
  const events = evSec.events || [];
  const featured = evSec.featured || {};

  let activeCount = 0;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px;">
      <!-- Events Settings Card -->
      <div class="card" style="padding:22px;">
        <div style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:12.5px;color:#0369a1;line-height:1.45;">
          <strong>ℹ Event Display Rule:</strong> The top <strong>2 active events</strong> in this list will automatically show on the Homepage "Upcoming Events" section. All scheduled events will be displayed on the dedicated <a href="/events" target="_blank" style="color:#0284c7;font-weight:700;text-decoration:underline;">All Events Page (/events)</a>. Use the <strong>▲ / ▼</strong> arrows to reorder events.
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" for="hp-events-heading-input">Homepage Events Heading</label>
          <input type="text" id="hp-events-heading-input" class="form-input" value="${escapeHtml(evSec.eventsHeading || 'Upcoming Events')}" oninput="onHpSectionTitleInput('eventsHeading', this.value)" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
          <div class="form-group">
            <label class="form-label" for="hp-events-seeall-text">"See All" Text</label>
            <input type="text" id="hp-events-seeall-text" class="form-input" value="${escapeHtml(evSec.seeAllText || 'See all events')}" oninput="onHpSectionTitleInput('seeAllText', this.value)" />
          </div>
          <div class="form-group">
            <label class="form-label" for="hp-events-seeall-href">"See All" Link URL</label>
            <input type="text" id="hp-events-seeall-href" class="form-input" value="${escapeHtml(evSec.seeAllHref || '/events')}" oninput="onHpSectionTitleInput('seeAllHref', this.value)" />
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-top:1px solid var(--border);padding-top:14px;">
          <div>
            <h4 style="font-size:14px;font-weight:700;margin:0;">All Events List (${events.length})</h4>
            <span style="font-size:11px;color:var(--text-muted);">Reorder to pick which 2 events appear on the Homepage</span>
          </div>
          <button type="button" class="btn btn--primary btn--sm" onclick="openHpEventModal()">+ Add Event</button>
        </div>
        ${events.length === 0 ? `<div style="font-size:12.5px;color:var(--text-muted);padding:16px 0;">No events listed yet. Click "+ Add Event" above.</div>` : ''}
        ${events.map((ev, idx) => {
          const isActive = ev.enabled !== false;
          let slotBadge = '';
          if (isActive) {
            activeCount++;
            if (activeCount === 1) slotBadge = `<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;">Homepage #1</span>`;
            else if (activeCount === 2) slotBadge = `<span style="background:#0284c7;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;">Homepage #2</span>`;
          }

          return `
            <div class="hp-event-item-card ${!isActive ? 'menu-item-card--disabled' : ''}">
              <div class="menu-item-reorder-btns">
                <button type="button" class="menu-reorder-btn" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveHpEvent('${ev.id}', -1)">${MENU_ICONS.up}</button>
                <button type="button" class="menu-reorder-btn" title="Move Down" ${idx === events.length - 1 ? 'disabled style="opacity:0.3;"' : ''} onclick="moveHpEvent('${ev.id}', 1)">${MENU_ICONS.down}</button>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                  <span class="hp-event-date-chip">${escapeHtml(ev.date || 'TBA')}</span>
                  ${slotBadge}
                  <span style="font-size:11px;color:${isActive ? '#16a34a' : '#94a3b8'};">${isActive ? 'Active' : 'Disabled'}</span>
                </div>
                <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ev.title || 'Untitled Event')}</div>
                <div style="font-size:12px;color:var(--text-muted);">${escapeHtml(ev.meta || '')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <label class="hs-toggle" title="Toggle visibility">
                  <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleHpEvent('${ev.id}')" />
                  <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
                </label>
                <button type="button" class="art-action-btn art-action-btn--edit" onclick="openHpEventModal('${ev.id}')" title="Edit Event">${ICONS.pencil}</button>
                <button type="button" class="art-action-btn art-action-btn--trash" onclick="deleteHpEvent('${ev.id}')" title="Delete Event">${ICONS.trash}</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Featured Spotlight Card -->
      <div class="card" style="padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px;">
          <h4 style="font-size:14px;font-weight:700;margin:0;">Featured Spotlight Story</h4>
          <button type="button" class="btn btn--primary btn--sm" onclick="openHpSlotModal('eventsSection.featured', 'Events Featured Spotlight Story')">Edit Spotlight</button>
        </div>
        <img src="${escapeHtml(featured.imageUrl || 'img5.png')}" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-bottom:12px;" onerror="this.src='img5.png'" />
        <h4 style="font-family:'Libre Baskerville',serif;font-size:16px;font-weight:700;margin:0 0 6px;">${escapeHtml(featured.title || 'Untitled')}</h4>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 8px;">${escapeHtml(featured.description || '')}</p>
        <span class="hs-slug-chip">${escapeHtml(featured.href || '#')}</span>
      </div>
    </div>
  `;
}

// ── RENDER ALL NEWS TAB ──────────────────────────────────────────
function renderNewsEditor() {
  const container = document.getElementById('hp-news-editor-container');
  if (!container || !homepageDraftConfig) return;

  const allNews = homepageDraftConfig.allNews || {};
  const cols = allNews.columns || [];

  container.innerHTML = `
    <div class="card" style="padding:22px;margin-bottom:20px;">
      <div class="form-group" style="max-width:400px;">
        <label class="form-label" for="hp-allnews-heading-input">All News Section Main Title</label>
        <input type="text" id="hp-allnews-heading-input" class="form-input" value="${escapeHtml(allNews.heading || 'All News')}" oninput="onHpSectionTitleInput('allNewsHeading', this.value)" />
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;">
      ${cols.map((col, cIdx) => `
        <div class="card" style="padding:18px;background:#ffffff;">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:11px;font-weight:700;">Column ${cIdx + 1} Label</label>
            <input type="text" class="form-input" value="${escapeHtml(col.label || '')}" oninput="onHpColumnLabelInput(${cIdx}, this.value)" style="font-weight:700;color:#0a528e;" />
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:11px;">Section Slug Link ${_homepageLang === 'bn' ? '<span style="color:#d97706;font-size:10px;font-weight:600;">([Locked] Set in English)</span>' : ''}</label>
            <input type="text" class="form-input" value="${escapeHtml(col.sectionSlug || '')}" ${_homepageLang === 'bn' ? 'readonly style="opacity:0.55;cursor:not-allowed;background:#f8fafc;" title="[Locked] Section Slug is unified in backend and defined strictly in English"' : `oninput="onHpColumnSlugInput(${cIdx}, this.value)"`} placeholder="e.g. culture" />
          </div>

          <!-- Lead Story Preview -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span class="hp-slot-badge hp-slot-badge--col" style="font-size:9.5px;">Lead Story</span>
              <button type="button" class="btn btn--ghost btn--sm" style="padding:2px 7px;font-size:11px;" onclick="openHpSlotModal('allNews.columns.${cIdx}.lead', '${escapeHtml(col.label)}: Lead Article')">Edit</button>
            </div>
            <div style="font-size:12.5px;font-weight:700;line-height:1.3;color:#0f172a;">${escapeHtml((col.lead && col.lead.title) || 'Untitled')}</div>
          </div>

          <!-- Sub Articles List -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);">Sub-Headlines (${(col.subArticles || []).length})</span>
              <button type="button" class="btn btn--ghost btn--sm" style="padding:2px 7px;font-size:11px;" onclick="addHpSubArticle(${cIdx})">+ Add</button>
            </div>
            ${(col.subArticles || []).map((sub, sIdx) => `
              <div class="hp-sub-headline-item" style="padding:6px 10px;">
                <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sub.title || 'Untitled')}</span>
                <div style="display:flex;gap:4px;">
                  <button type="button" class="art-action-btn art-action-btn--edit" style="width:24px;height:24px;padding:0;" onclick="openHpSlotModal('allNews.columns.${cIdx}.subArticles.${sIdx}', '${escapeHtml(col.label)}: Sub Story ${sIdx + 1}')">${ICONS.pencil}</button>
                  <button type="button" class="art-action-btn art-action-btn--trash" style="width:24px;height:24px;padding:0;" onclick="deleteHpSubArticle(${cIdx}, ${sIdx})">${ICONS.trash}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── SLOT MODAL & ARTICLE PICKER ──────────────────────────────────
function getHpObjectByPath(path) {
  if (!homepageDraftConfig) return null;
  const parts = path.split('.');
  let curr = homepageDraftConfig;
  for (const part of parts) {
    if (curr == null) return null;
    curr = curr[part];
  }
  return curr;
}

function setHpObjectByPath(path, val) {
  if (!homepageDraftConfig) return;
  const parts = path.split('.');
  let curr = homepageDraftConfig;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (curr[part] == null) curr[part] = {};
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = val;
}

function openHpSlotModal(path, roleName) {
  const modal = document.getElementById('modal-homepage-slot');
  const titleEl = document.getElementById('modal-hp-slot-title');
  const badgeEl = document.getElementById('modal-hp-slot-badge');
  const pathInput = document.getElementById('hp-slot-path');
  const headlineInput = document.getElementById('hp-slot-headline-input');
  const subtitleInput = document.getElementById('hp-slot-subtitle-input');
  const subtitleGroup = document.getElementById('hp-slot-subtitle-group');
  const linkInput = document.getElementById('hp-slot-link-input');
  const imageInput = document.getElementById('hp-slot-image-input');
  const imageGroup = document.getElementById('hp-slot-image-group');
  const tagInput = document.getElementById('hp-slot-tag-input');
  const tagGroup = document.getElementById('hp-slot-tag-group');
  const enabledInput = document.getElementById('hp-slot-enabled-input');
  const articleSelect = document.getElementById('hp-slot-article-select');
  const idSearchInput = document.getElementById('hp-slot-id-search');
  const matchedChip = document.getElementById('hp-slot-matched-article');

  if (!modal) return;

  pathInput.value = path;
  titleEl.textContent = 'Edit Homepage Slot';
  badgeEl.textContent = roleName || path;

  if (idSearchInput) idSearchInput.value = '';
  if (matchedChip) matchedChip.style.display = 'none';

  // Populate Published Article Selector dropdown with [ID] prefix
  if (articleSelect) {
    articleSelect.innerHTML = `<option value="">— Or pick from recent database articles list —</option>` +
      homepageArticlesList.map(a => {
        const sid = a.id ? a.id.slice(0, 8) : '';
        return `<option value="${escapeHtml(a.id || a.slug)}">${sid ? `[${sid}] ` : ''}${escapeHtml(a.title)} (${escapeHtml(a.section || 'General')})</option>`;
      }).join('');
  }

  const slotData = getHpObjectByPath(path) || {};

  const isBn = _homepageLang === 'bn';
  headlineInput.value = slotData.title || '';
  if (subtitleInput) subtitleInput.value = slotData.subtitle || slotData.description || '';
  if (linkInput) {
    linkInput.value = slotData.href || '';
    linkInput.readOnly = isBn;
    linkInput.style.opacity = isBn ? '0.55' : '1';
    linkInput.style.backgroundColor = isBn ? '#f8fafc' : '';
    linkInput.style.cursor = isBn ? 'not-allowed' : '';
    linkInput.title = isBn ? '[Locked] URL is unified in backend and defined strictly in English' : '';
  }
  const linkLockNote = document.getElementById('hp-slot-link-lock-note');
  if (linkLockNote) linkLockNote.style.display = isBn ? 'block' : 'none';

  if (imageInput) imageInput.value = slotData.imageUrl || '';
  if (tagInput) tagInput.value = slotData.tag || '';
  if (enabledInput) enabledInput.checked = slotData.enabled !== false;

  // Auto detect if current slot link corresponds to an existing article
  if (slotData.href) {
    const rawHref = slotData.href.replace('/article/', '').replace('/article.html?id=', '').trim();
    const existingArt = homepageArticlesList.find(a => a.id === rawHref || a.slug === rawHref) ||
                        _allArticles.find(a => a.id === rawHref || a.slug === rawHref);
    if (existingArt) {
      showHpSlotMatchedArticle(existingArt);
    }
  }

  // Show / hide fields depending on whether slot needs image/subtitle/tag
  const isSubArticle = path.includes('subArticles');
  if (subtitleGroup) subtitleGroup.style.display = isSubArticle ? 'none' : 'block';
  if (imageGroup) imageGroup.style.display = isSubArticle ? 'none' : 'block';
  if (tagGroup) tagGroup.style.display = path.includes('sidebar') ? 'block' : 'none';

  updateHpSlotImagePreview();
  modal.removeAttribute('hidden');
  headlineInput.focus();
}

function showHpSlotMatchedArticle(article) {
  const matchedChip = document.getElementById('hp-slot-matched-article');
  const matchedTitle = document.getElementById('hp-slot-matched-title');
  const matchedId = document.getElementById('hp-slot-matched-id');
  const idSearchInput = document.getElementById('hp-slot-id-search');
  const articleSelect = document.getElementById('hp-slot-article-select');

  if (matchedChip && matchedTitle && matchedId) {
    matchedTitle.textContent = article.title || 'Untitled Article';
    matchedId.textContent = article.id ? `ID: ${article.id.slice(0, 8)}...` : '';
    matchedId.title = `Full Unique ID: ${article.id || ''}`;
    matchedChip.style.display = 'flex';
  }
  if (idSearchInput && article.id) {
    idSearchInput.value = article.id;
  }
  if (articleSelect) {
    articleSelect.value = article.id || article.slug || '';
  }
}

function clearHpSlotArticleSelection() {
  const matchedChip = document.getElementById('hp-slot-matched-article');
  const idSearchInput = document.getElementById('hp-slot-id-search');
  const articleSelect = document.getElementById('hp-slot-article-select');
  if (matchedChip) matchedChip.style.display = 'none';
  if (idSearchInput) idSearchInput.value = '';
  if (articleSelect) articleSelect.value = '';
}

function onHpArticleIdInput(value) {
  const q = (value || '').trim();
  if (!q) {
    clearHpSlotArticleSelection();
    return;
  }
  // Fast match in memory if typed/pasted 8+ chars of ID or exact slug
  const directMatch = homepageArticlesList.find(a =>
    a.id === q ||
    (a.id && a.id.toLowerCase().startsWith(q.toLowerCase()) && q.length >= 8) ||
    a.slug === q
  ) || _allArticles.find(a =>
    a.id === q ||
    (a.id && a.id.toLowerCase().startsWith(q.toLowerCase()) && q.length >= 8) ||
    a.slug === q
  );

  if (directMatch) {
    applyHpArticleToSlot(directMatch);
  }
}

async function fetchArticleByIdForHpSlot(searchQuery) {
  const q = (searchQuery || '').trim();
  if (!q) {
    showToast('info', 'Please enter an Article Unique ID or Title to search');
    return;
  }

  // 1. Search locally in homepageArticlesList and _allArticles
  let match = homepageArticlesList.find(a =>
    a.id === q ||
    (a.id && a.id.toLowerCase().includes(q.toLowerCase())) ||
    (a.slug && a.slug.toLowerCase().includes(q.toLowerCase())) ||
    (a.title && a.title.toLowerCase().includes(q.toLowerCase()))
  ) || _allArticles.find(a =>
    a.id === q ||
    (a.id && a.id.toLowerCase().includes(q.toLowerCase())) ||
    (a.slug && a.slug.toLowerCase().includes(q.toLowerCase())) ||
    (a.title && a.title.toLowerCase().includes(q.toLowerCase()))
  );

  // 2. If not found in memory, query live Supabase database
  if (!match) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        // Try exact ID match first
        const { data: byId } = await sb.from('articles').select('*').eq('id', q).single();
        if (byId) {
          match = byId;
        } else {
          // Try search by slug or title
          const { data: byText } = await sb.from('articles')
            .select('*')
            .or(`slug.eq.${q},title.ilike.%${q}%`)
            .limit(1);
          if (byText && byText[0]) match = byText[0];
        }
      }
    } catch(e) {}
  }

  if (match) {
    applyHpArticleToSlot(match);
    showToast('success', `Found article: "${match.title}"`);
  } else {
    showToast('error', `No article found matching ID or query "${q}"`);
  }
}

function applyHpArticleToSlot(article) {
  if (!article) return;
  const headlineInput = document.getElementById('hp-slot-headline-input');
  const subtitleInput = document.getElementById('hp-slot-subtitle-input');
  const linkInput = document.getElementById('hp-slot-link-input');
  const imageInput = document.getElementById('hp-slot-image-input');
  const tagInput = document.getElementById('hp-slot-tag-input');

  if (headlineInput) headlineInput.value = article.title || '';
  if (subtitleInput) subtitleInput.value = article.deck || article.subtitle || '';
  if (linkInput) linkInput.value = article.slug ? `/article/${article.slug}` : `/article/${article.id}`;
  if (imageInput && article.hero_img_url) imageInput.value = article.hero_img_url;
  if (tagInput && article.section) tagInput.value = article.section.toUpperCase();

  showHpSlotMatchedArticle(article);
  updateHpSlotImagePreview();
}

function onHpArticleSelected(articleIdOrSlug) {
  if (!articleIdOrSlug) {
    clearHpSlotArticleSelection();
    return;
  }
  const article = homepageArticlesList.find(a => a.id === articleIdOrSlug || a.slug === articleIdOrSlug) ||
                  _allArticles.find(a => a.id === articleIdOrSlug || a.slug === articleIdOrSlug);
  if (article) {
    applyHpArticleToSlot(article);
  }
}

function updateHpSlotImagePreview() {
  const imgInput = document.getElementById('hp-slot-image-input');
  const imgEl = document.getElementById('hp-slot-image-preview');
  if (imgInput && imgEl) {
    imgEl.src = imgInput.value.trim() || 'img1.png';
  }
}

function saveHpSlotModal() {
  const path = document.getElementById('hp-slot-path').value;
  const headline = document.getElementById('hp-slot-headline-input').value.trim();
  const subtitle = document.getElementById('hp-slot-subtitle-input') ? document.getElementById('hp-slot-subtitle-input').value.trim() : '';
  const link = document.getElementById('hp-slot-link-input').value.trim();
  const image = document.getElementById('hp-slot-image-input') ? document.getElementById('hp-slot-image-input').value.trim() : '';
  const tag = document.getElementById('hp-slot-tag-input') ? document.getElementById('hp-slot-tag-input').value.trim() : '';
  const enabled = document.getElementById('hp-slot-enabled-input').checked;

  if (!headline) {
    showToast('error', 'Headline / Title is required');
    return;
  }

  pushHomepageHistory();

  let slotData = getHpObjectByPath(path);
  if (!slotData || typeof slotData !== 'object') {
    slotData = {};
    setHpObjectByPath(path, slotData);
  }

  const isBn = _homepageLang === 'bn';
  slotData.title = headline;
  if (path.includes('hero.main')) slotData.subtitle = subtitle;
  else if (path.includes('sidebar') || path.includes('featured')) slotData.description = subtitle;

  if (!isBn) {
    slotData.href = link || '#';
  }
  if (!path.includes('subArticles')) slotData.imageUrl = image || 'img1.png';
  if (path.includes('sidebar')) slotData.tag = tag;
  slotData.enabled = enabled;

  closeHpSlotModal();
  renderActiveHpTab();
  showToast('success', 'Homepage slot updated');

  recordActivityLog({
    action: 'layout.homepage_slot_update',
    category: 'layout',
    summary: `Updated Homepage slot "${path}" ("${headline}")`,
    target_id: path,
    target_name: headline,
    details: { path, title: headline, subtitle, link, enabled }
  });
}

function closeHpSlotModal() {
  const modal = document.getElementById('modal-homepage-slot');
  if (modal) modal.setAttribute('hidden', '');
}

// ── EVENT MODAL CRUD ─────────────────────────────────────────────
function openHpEventModal(id) {
  const modal = document.getElementById('modal-homepage-event');
  const titleEl = document.getElementById('modal-hp-event-title');
  const editIdInput = document.getElementById('hp-event-edit-id');
  const dateInput = document.getElementById('hp-event-date-input');
  const titleInput = document.getElementById('hp-event-title-input');
  const metaInput = document.getElementById('hp-event-meta-input');
  const linkInput = document.getElementById('hp-event-link-input');
  const enabledInput = document.getElementById('hp-event-enabled-input');
  const linkLockNote = document.getElementById('hp-event-link-lock-note');
  const isBn = _homepageLang === 'bn';

  if (!modal) return;

  if (id) {
    const events = (homepageDraftConfig && homepageDraftConfig.eventsSection && homepageDraftConfig.eventsSection.events) || [];
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    titleEl.textContent = 'Edit Event';
    editIdInput.value = ev.id;
    dateInput.value = ev.date || '';
    titleInput.value = ev.title || '';
    metaInput.value = ev.meta || '';
    if (linkInput) {
      linkInput.value = ev.href || '';
      linkInput.readOnly = isBn;
      linkInput.style.opacity = isBn ? '0.55' : '1';
      linkInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      linkInput.style.cursor = isBn ? 'not-allowed' : '';
      linkInput.title = isBn ? '[Locked] Event URL is unified in backend and defined strictly in English' : '';
    }
    enabledInput.checked = ev.enabled !== false;
  } else {
    titleEl.textContent = 'Add Event';
    editIdInput.value = '';
    dateInput.value = 'Oct. 24, 2026';
    titleInput.value = '';
    metaInput.value = '4 p.m. Friday ■ Privatian Hall, Cambridge';
    if (linkInput) {
      linkInput.value = 'index.html#events';
      linkInput.readOnly = isBn;
      linkInput.style.opacity = isBn ? '0.55' : '1';
      linkInput.style.backgroundColor = isBn ? '#f8fafc' : '';
      linkInput.style.cursor = isBn ? 'not-allowed' : '';
      linkInput.title = isBn ? '[Locked] Event URL is unified in backend and defined strictly in English' : '';
    }
    enabledInput.checked = true;
  }
  if (linkLockNote) linkLockNote.style.display = isBn ? 'block' : 'none';

  modal.removeAttribute('hidden');
  titleInput.focus();
}

function saveHpEventModal() {
  const editId = document.getElementById('hp-event-edit-id').value;
  const date = document.getElementById('hp-event-date-input').value.trim();
  const title = document.getElementById('hp-event-title-input').value.trim();
  const meta = document.getElementById('hp-event-meta-input').value.trim();
  const link = document.getElementById('hp-event-link-input').value.trim();
  const enabled = document.getElementById('hp-event-enabled-input').checked;
  const isBn = _homepageLang === 'bn';

  if (!title) {
    showToast('error', 'Event Title is required');
    return;
  }

  pushHomepageHistory();
  if (!homepageDraftConfig.eventsSection) homepageDraftConfig.eventsSection = {};
  if (!homepageDraftConfig.eventsSection.events) homepageDraftConfig.eventsSection.events = [];

  const events = homepageDraftConfig.eventsSection.events;

  if (editId) {
    const ev = events.find(e => e.id === editId);
    if (ev) {
      ev.date = date;
      ev.title = title;
      ev.meta = meta;
      if (!isBn) ev.href = link;
      ev.enabled = enabled;
    }
  } else {
    events.push({
      id: 'ev-' + Date.now(),
      date,
      title,
      meta,
      href: link,
      enabled
    });
  }

  closeHpEventModal();
  renderActiveHpTab();
  showToast('success', editId ? 'Event updated' : 'Event added');

  recordActivityLog({
    action: editId ? 'layout.homepage_edit_event' : 'layout.homepage_add_event',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} event "${title}" on Homepage Events`,
    target_id: editId || 'event-new',
    target_name: title,
    details: { date, title, meta, href: link, enabled }
  });
}

function deleteHpEvent(id) {
  if (!homepageDraftConfig || !homepageDraftConfig.eventsSection || !homepageDraftConfig.eventsSection.events) return;
  const ev = homepageDraftConfig.eventsSection.events.find(e => e.id === id);
  pushHomepageHistory();
  homepageDraftConfig.eventsSection.events = homepageDraftConfig.eventsSection.events.filter(e => e.id !== id);
  renderActiveHpTab();
  showToast('info', 'Event removed');

  recordActivityLog({
    action: 'layout.homepage_delete_event',
    category: 'layout',
    summary: `Deleted event "${ev?.title || id}" from Homepage Events`,
    target_id: id,
    target_name: ev?.title || id,
    details: { id }
  });
}

function moveHpEvent(id, dir) {
  if (!homepageDraftConfig || !homepageDraftConfig.eventsSection || !homepageDraftConfig.eventsSection.events) return;
  const items = homepageDraftConfig.eventsSection.events;
  const idx = items.findIndex(e => e.id === id);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  pushHomepageHistory();
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  renderActiveHpTab();
  showToast('info', 'Event reordered');

  recordActivityLog({
    action: 'layout.homepage_reorder_event',
    category: 'layout',
    summary: `Reordered event "${temp.title || id}" (${dir < 0 ? 'Moved Up' : 'Moved Down'}) in Homepage Events list`,
    target_id: id,
    target_name: temp.title || id,
    details: { id, dir }
  });
}

function toggleHpEvent(id) {
  if (!homepageDraftConfig || !homepageDraftConfig.eventsSection || !homepageDraftConfig.eventsSection.events) return;
  const ev = homepageDraftConfig.eventsSection.events.find(e => e.id === id);
  if (!ev) return;
  pushHomepageHistory();
  ev.enabled = ev.enabled === false ? true : false;
  renderActiveHpTab();
  showToast('info', ev.enabled ? 'Event enabled' : 'Event disabled');

  recordActivityLog({
    action: 'layout.homepage_toggle_event',
    category: 'layout',
    summary: `${ev.enabled ? 'Enabled' : 'Disabled'} event "${ev.title || id}" on Homepage`,
    target_id: id,
    target_name: ev.title || id,
    details: { id, enabled: ev.enabled }
  });
}

function closeHpEventModal() {
  const modal = document.getElementById('modal-homepage-event');
  if (modal) modal.setAttribute('hidden', '');
}

// ── ALL NEWS COLUMN & SUB-ARTICLE HELPERS ─────────────────────────
function onHpColumnLabelInput(colIdx, val) {
  if (!homepageDraftConfig || !homepageDraftConfig.allNews || !homepageDraftConfig.allNews.columns) return;
  pushHomepageHistory();
  if (homepageDraftConfig.allNews.columns[colIdx]) {
    homepageDraftConfig.allNews.columns[colIdx].label = val;
  }
}

function onHpColumnSlugInput(colIdx, val) {
  if (!homepageDraftConfig || !homepageDraftConfig.allNews || !homepageDraftConfig.allNews.columns) return;
  pushHomepageHistory();
  if (homepageDraftConfig.allNews.columns[colIdx]) {
    homepageDraftConfig.allNews.columns[colIdx].sectionSlug = val;
  }
}

function onHpSectionTitleInput(field, val) {
  if (!homepageDraftConfig) return;
  pushHomepageHistory();
  if (field === 'eventsHeading' && homepageDraftConfig.eventsSection) {
    homepageDraftConfig.eventsSection.eventsHeading = val;
  } else if (field === 'seeAllText' && homepageDraftConfig.eventsSection) {
    homepageDraftConfig.eventsSection.seeAllText = val;
  } else if (field === 'seeAllHref' && homepageDraftConfig.eventsSection) {
    homepageDraftConfig.eventsSection.seeAllHref = val;
  } else if (field === 'allNewsHeading' && homepageDraftConfig.allNews) {
    homepageDraftConfig.allNews.heading = val;
  }
}

function addHpSubArticle(colIdx) {
  if (!homepageDraftConfig || !homepageDraftConfig.allNews || !homepageDraftConfig.allNews.columns) return;
  const col = homepageDraftConfig.allNews.columns[colIdx];
  if (!col) return;
  if (!Array.isArray(col.subArticles)) col.subArticles = [];

  pushHomepageHistory();
  col.subArticles.push({
    id: 'sub-' + colIdx + '-' + Date.now(),
    title: 'New Story Headline in ' + (col.label || 'Section'),
    href: 'section.html?slug=' + (col.sectionSlug || 'community-heritage'),
    enabled: true
  });
  renderActiveHpTab();
  showToast('success', 'Sub-article headline added');

  recordActivityLog({
    action: 'layout.homepage_add_sub_article',
    category: 'layout',
    summary: `Added sub-article headline in Column ${colIdx + 1} (${col.label || 'Section'})`,
    target_id: `col-${colIdx}`,
    target_name: col.label || `Column ${colIdx + 1}`,
    details: { colIdx }
  });
}

function deleteHpSubArticle(colIdx, subIdx) {
  if (!homepageDraftConfig || !homepageDraftConfig.allNews || !homepageDraftConfig.allNews.columns) return;
  const col = homepageDraftConfig.allNews.columns[colIdx];
  if (!col || !Array.isArray(col.subArticles)) return;

  pushHomepageHistory();
  const removed = col.subArticles.splice(subIdx, 1)[0];
  renderActiveHpTab();
  showToast('info', 'Sub-article headline removed');

  recordActivityLog({
    action: 'layout.homepage_delete_sub_article',
    category: 'layout',
    summary: `Removed sub-article headline "${removed?.title || ''}" from Column ${colIdx + 1} (${col.label || 'Section'})`,
    target_id: `col-${colIdx}`,
    target_name: col.label || `Column ${colIdx + 1}`,
    details: { colIdx, subIdx }
  });
}

// ── SAVE HOMEPAGE SETTINGS TO SUPABASE DATABASE ──────────────────
async function saveHomepageSettings() {
  const saveBtn = document.getElementById('hp-save-btn');
  const isBn = _homepageLang === 'bn';

  if (saveBtn) saveBtn.disabled = true;
  updateGlobalSyncStatus('syncing', 'Saving to database...');

  try {
    homepageDraftConfig.lang = _homepageLang;
    const res = await _apiPost('/api/sections?action=homepage' + (isBn ? '&lang=bn' : ''), homepageDraftConfig);
    appliedHomepageConfig = JSON.parse(JSON.stringify(homepageDraftConfig));
    homepageUndoStack = [];
    homepageRedoStack = [];
    updateHomepageUndoRedoBtns();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', isBn ? 'বাংলা হোমপেজের পরিবর্তন সফলভাবে সংরক্ষিত ও প্রকাশিত হয়েছে!' : 'English Homepage changes published and synced with database!');

    recordActivityLog({
      action: 'layout.homepage_save',
      category: 'layout',
      summary: `Published Homepage Builder layout & curation updates (${isBn ? 'Bengali' : 'English'}) to database`,
      target_id: isBn ? 'site_homepage_config_bn' : 'site_homepage_config',
      target_name: isBn ? 'বাংলা হোমপেজ কনফিগারেশন' : 'Homepage Builder',
      details: {
        lang: _homepageLang,
        heroTitle: homepageDraftConfig.hero?.main?.title,
        eventsCount: (homepageDraftConfig.eventsSection?.events || []).length,
        columnsCount: (homepageDraftConfig.allNews?.columns || []).length
      }
    });
  } catch(err) {
    console.warn('[Admin] saveHomepageSettings server error:', err.message);
    appliedHomepageConfig = JSON.parse(JSON.stringify(homepageDraftConfig));
    homepageUndoStack = [];
    homepageRedoStack = [];
    updateHomepageUndoRedoBtns();
    updateGlobalSyncStatus('error', 'Error saving to database');
    showToast('error', 'Failed to save homepage settings: ' + err.message);

    recordActivityLog({
      action: 'layout.homepage_save',
      category: 'layout',
      summary: `Saved Homepage Builder configuration (${isBn ? 'Bengali' : 'English'}, local cache fallback)`,
      target_id: isBn ? 'site_homepage_config_bn' : 'site_homepage_config',
      target_name: 'Homepage Builder',
      details: { lang: _homepageLang, offlineFallback: true }
    });
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Global Keyboard Shortcut for Undo/Redo in Homepage, Navigation Menu, and Footer Manager
document.addEventListener('keydown', (e) => {
  const activePage = document.querySelector('.sidebar-nav-item.active');
  if (!activePage) return;

  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement ? document.activeElement.tagName : '');
  if (isInput) return; // Allow browser text undo inside inputs

  if (activePage.dataset.page === 'footer') {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoFooterAction();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redoFooterAction();
    }
    return;
  }

  if (activePage.dataset.page === 'homepage') {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoHomepageAction();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redoHomepageAction();
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   FOOTER SETTINGS MANAGER LOGIC
═══════════════════════════════════════════════════════════════ */

const FOOTER_SETTINGS_KEY = 'privatian_footer_settings';

const FOOTER_LOGO_DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="240 582 3365 640" preserveAspectRatio="xMinYMin meet" class="logo-cover-svg" id="footer-logo-svg" aria-label="The Privatian Family" style="height:90px;width:auto;display:block;flex-shrink:0;"><defs><g/><clipPath id="3e2e9e006a"><rect x="0" width="561" y="0" height="1121"/></clipPath><clipPath id="5439340641"><rect x="0" width="3354" y="0" height="302"/></clipPath><clipPath id="0e3ea0e472"><path d="M 2790 1154 L 2867 1154 L 2867 1170.730469 L 2790 1170.730469 Z M 2790 1154 " clip-rule="nonzero"/></clipPath><clipPath id="e41def51e2"><path d="M 2774.386719 981.066406 L 2881.792969 981.066406 L 2881.792969 1151 L 2774.386719 1151 Z M 2774.386719 981.066406 " clip-rule="nonzero"/></clipPath></defs><g transform="matrix(1, 0, 0, 1, 861, 349)"><g clip-path="url(#3e2e9e006a)"><g fill="#ffffff" fill-opacity="1"><g transform="translate(0.604266, 858.319785)"><g><path d="M 21.375 -620.578125 C 27.207031 -621.554688 30.9375 -622.046875 32.5625 -622.046875 C 43.570312 -622.046875 61.710938 -621.394531 86.984375 -620.09375 C 100.265625 -619.769531 109.335938 -619.609375 114.203125 -619.609375 C 121.328125 -619.609375 136.390625 -620.257812 159.390625 -621.5625 L 242.015625 -626.421875 C 263.722656 -628.359375 288.992188 -629.328125 317.828125 -629.328125 C 368.691406 -629.328125 409.1875 -622.117188 439.3125 -607.703125 C 469.445312 -593.285156 492.691406 -570.6875 509.046875 -539.90625 C 525.410156 -509.132812 533.59375 -478.519531 533.59375 -448.0625 C 533.59375 -397.195312 515.773438 -353.296875 480.140625 -316.359375 C 444.503906 -279.429688 396.554688 -260.96875 336.296875 -260.96875 C 319.441406 -260.96875 305.34375 -262.664062 294 -266.0625 C 282.664062 -269.46875 269.710938 -276.03125 255.140625 -285.75 C 248.984375 -289.957031 245.253906 -294.332031 243.953125 -298.875 C 245.253906 -301.132812 247.035156 -302.753906 249.296875 -303.734375 C 253.835938 -303.734375 258.535156 -302.757812 263.390625 -300.8125 C 274.410156 -296.925781 288.34375 -294.984375 305.1875 -294.984375 C 330.78125 -294.984375 355 -301.300781 377.84375 -313.9375 C 400.6875 -326.570312 417.9375 -344.550781 429.59375 -367.875 C 441.257812 -391.207031 447.09375 -415.832031 447.09375 -441.75 C 447.09375 -467.019531 440.9375 -491.5625 428.625 -515.375 C 416.3125 -539.1875 400.113281 -558.21875 380.03125 -572.46875 C 368.6875 -580.570312 351.269531 -587.375 327.78125 -592.875 C 304.289062 -598.382812 286.066406 -601.140625 273.109375 -601.140625 C 232.941406 -601.140625 209.128906 -598.222656 201.671875 -592.390625 L 201.1875 -585.59375 L 203.140625 -530.671875 L 202.65625 -520.953125 C 202 -512.210938 201.671875 -498.769531 201.671875 -480.625 C 201.671875 -414.53125 202.644531 -373.382812 204.59375 -357.1875 L 204.59375 -329.96875 L 210.90625 -107.890625 C 210.90625 -104.648438 210.5 -98.65625 209.6875 -89.90625 C 208.882812 -81.15625 208.484375 -73.539062 208.484375 -67.0625 C 208.484375 -51.507812 209.78125 -39.6875 212.375 -31.59375 C 220.144531 -29.320312 242.820312 -23.972656 280.40625 -15.546875 C 297.894531 -11.335938 307.453125 -8.910156 309.078125 -8.265625 C 311.671875 -7.285156 313.9375 -5.175781 315.875 -1.9375 C 314.582031 2.914062 312.882812 6.070312 310.78125 7.53125 C 308.675781 8.988281 304.546875 9.71875 298.390625 9.71875 C 294.492188 9.71875 285.421875 8.910156 271.171875 7.296875 C 243.304688 4.378906 221.4375 2.921875 205.5625 2.921875 L 120.03125 6.3125 L 69 4.859375 C 65.757812 4.859375 56.367188 5.179688 40.828125 5.828125 L 40.328125 -6.796875 L 103.515625 -18.953125 C 113.878906 -21.867188 120.195312 -24.785156 122.46875 -27.703125 C 125.707031 -32.234375 127.328125 -41.140625 127.328125 -54.421875 C 127.328125 -57.335938 127.488281 -63.65625 127.8125 -73.375 C 128.132812 -80.1875 128.296875 -89.582031 128.296875 -101.5625 C 128.296875 -139.789062 126.675781 -221.273438 123.4375 -346.015625 C 122.144531 -404.328125 121.5 -463.613281 121.5 -523.875 L 121.5 -532.140625 C 121.5 -555.460938 117.929688 -570.203125 110.796875 -576.359375 C 98.804688 -587.046875 68.835938 -595.796875 20.890625 -602.609375 C 19.273438 -606.171875 18.46875 -609.082031 18.46875 -611.34375 C 18.46875 -613.9375 19.4375 -617.015625 21.375 -620.578125 Z M 21.375 -620.578125 "/></g></g></g></g></g><g transform="matrix(1, 0, 0, 1, 245, 931)"><g clip-path="url(#5439340641)"><g fill="#ffffff" fill-opacity="1"><g transform="translate(0.871153, 235.96386)"><g><path d="M 97.296875 0 L 97.296875 -165.578125 L 166.09375 -165.578125 L 166.09375 -179.6875 L 5.140625 -179.6875 L 5.140625 -165.578125 L 73.9375 -165.578125 L 73.9375 0 Z M 97.296875 0 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(172.076148, 235.96386)"><g><path d="M 54.171875 -89.328125 L 161.71875 -89.328125 L 161.71875 0 L 185.078125 0 L 185.078125 -179.6875 L 161.71875 -179.6875 L 161.71875 -101.140625 L 54.171875 -101.140625 L 54.171875 -179.6875 L 30.796875 -179.6875 L 30.796875 0 L 54.171875 0 Z M 54.171875 -89.328125 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(387.94332, 235.96386)"><g><path d="M 30.796875 -179.6875 L 30.796875 0 L 146.828125 0 L 146.828125 -14.125 L 54.171875 -14.125 L 54.171875 -89.328125 L 133.75 -89.328125 L 133.75 -101.140625 L 54.171875 -101.140625 L 54.171875 -165.578125 L 146.828125 -165.578125 L 146.828125 -179.6875 Z M 30.796875 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(542.485004, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(632.322705, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(722.160406, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(901.844513, 235.96386)"><g><path d="M 30.796875 -179.6875 L 30.796875 0 L 54.171875 0 L 54.171875 -79.328125 L 65.453125 -79.328125 C 70.242188 -79.328125 74.222656 -78.894531 77.390625 -78.03125 C 80.554688 -77.175781 83.421875 -75.722656 85.984375 -73.671875 C 88.554688 -71.617188 90.953125 -68.96875 93.171875 -65.71875 C 95.398438 -62.46875 98.054688 -58.445312 101.140625 -53.65625 L 121.421875 -23.609375 C 123.984375 -19.679688 126.503906 -16.085938 128.984375 -12.828125 C 131.472656 -9.578125 134.171875 -6.796875 137.078125 -4.484375 C 139.984375 -2.179688 143.273438 -0.347656 146.953125 1.015625 C 150.640625 2.390625 155.050781 3.078125 160.1875 3.078125 C 163.945312 3.078125 167.023438 2.90625 169.421875 2.5625 C 171.816406 2.21875 174.210938 1.363281 176.609375 0 L 176.609375 -9.5 C 175.753906 -9.320312 174.898438 -9.191406 174.046875 -9.109375 C 173.191406 -9.023438 172.335938 -8.984375 171.484375 -8.984375 C 167.890625 -8.984375 164.722656 -9.492188 161.984375 -10.515625 C 159.242188 -11.546875 156.675781 -13.046875 154.28125 -15.015625 C 151.882812 -16.984375 149.570312 -19.378906 147.34375 -22.203125 C 145.125 -25.023438 142.816406 -28.234375 140.421875 -31.828125 C 133.234375 -42.265625 127.671875 -50.609375 123.734375 -56.859375 C 119.796875 -63.109375 116.671875 -67.941406 114.359375 -71.359375 C 112.046875 -74.785156 110.160156 -77.269531 108.703125 -78.8125 C 107.253906 -80.351562 105.503906 -81.632812 103.453125 -82.65625 L 100.890625 -83.9375 L 100.890625 -84.96875 C 109.097656 -85.476562 116.15625 -87.273438 122.0625 -90.359375 C 127.96875 -93.441406 132.800781 -97.289062 136.5625 -101.90625 C 140.332031 -106.53125 143.070312 -111.535156 144.78125 -116.921875 C 146.488281 -122.316406 147.34375 -127.582031 147.34375 -132.71875 C 147.34375 -137.332031 146.441406 -142.378906 144.640625 -147.859375 C 142.847656 -153.335938 139.769531 -158.425781 135.40625 -163.125 C 131.039062 -167.832031 125.09375 -171.769531 117.5625 -174.9375 C 110.039062 -178.101562 100.546875 -179.6875 89.078125 -179.6875 Z M 54.171875 -168.390625 L 80.09375 -168.390625 C 86.59375 -168.390625 92.453125 -167.445312 97.671875 -165.5625 C 102.890625 -163.6875 107.378906 -161.078125 111.140625 -157.734375 C 114.910156 -154.398438 117.78125 -150.421875 119.75 -145.796875 C 121.71875 -141.179688 122.703125 -136.132812 122.703125 -130.65625 C 122.703125 -126.039062 121.800781 -121.378906 120 -116.671875 C 118.207031 -111.960938 115.515625 -107.679688 111.921875 -103.828125 C 108.328125 -99.984375 103.921875 -96.863281 98.703125 -94.46875 C 93.484375 -92.070312 87.453125 -90.875 80.609375 -90.875 L 54.171875 -90.875 Z M 54.171875 -168.390625 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1086.140135, 235.96386)"><g><path d="M 41.078125 -179.6875 L 41.078125 0 L 64.4375 0 L 64.4375 -179.6875 Z M 41.078125 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1191.635268, 235.96386)"><g><path d="M 7.703125 -179.6875 L 82.921875 0 L 98.3125 0 L 171.21875 -179.6875 L 157.875 -179.6875 L 98.0625 -31.828125 L 97.03125 -31.828125 L 35.421875 -179.6875 Z M 7.703125 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1370.540616, 235.96386)"><g><path d="M 130.65625 -52.875 L 155.3125 0 L 180.203125 0 L 96.515625 -179.6875 L 83.6875 -179.6875 L 7.703125 0 L 19.515625 0 L 42.09375 -52.875 Z M 125.265625 -64.4375 L 46.984375 -64.4375 L 83.9375 -150.9375 L 84.96875 -150.9375 Z M 125.265625 -64.4375 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1558.429803, 235.96386)"><g><path d="M 97.296875 0 L 97.296875 -165.578125 L 166.09375 -165.578125 L 166.09375 -179.6875 L 5.140625 -179.6875 L 5.140625 -165.578125 L 73.9375 -165.578125 L 73.9375 0 Z M 97.296875 0 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1729.634757, 235.96386)"><g><path d="M 41.078125 -179.6875 L 41.078125 0 L 64.4375 0 L 64.4375 -179.6875 Z M 41.078125 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(1835.129932, 235.96386)"><g><path d="M 130.65625 -52.875 L 155.3125 0 L 180.203125 0 L 96.515625 -179.6875 L 83.6875 -179.6875 L 7.703125 0 L 19.515625 0 L 42.09375 -52.875 Z M 125.265625 -64.4375 L 46.984375 -64.4375 L 83.9375 -150.9375 L 84.96875 -150.9375 Z M 125.265625 -64.4375 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2023.019035, 235.96386)"><g><path d="M 175.578125 -179.6875 L 175.578125 -42.359375 L 174.5625 -42.359375 L 32.09375 -182.765625 L 30.796875 -182.765625 L 30.796875 0 L 42.609375 0 L 42.609375 -137.34375 L 43.640625 -137.34375 L 186.109375 3.078125 L 187.390625 3.078125 L 187.390625 -179.6875 Z M 175.578125 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2241.196307, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2331.033987, 235.96386)"><g><path d="M 30.796875 -179.6875 L 30.796875 0 L 54.171875 0 L 54.171875 -89.328125 L 133.75 -89.328125 L 133.75 -101.140625 L 54.171875 -101.140625 L 54.171875 -165.578125 L 146.828125 -165.578125 L 146.828125 -179.6875 Z M 30.796875 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2485.557655, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2575.395356, 235.96386)"><g/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2665.237374, 235.96386)"><g><path d="M 48.265625 -179.6875 L 30.796875 -179.6875 L 30.796875 0 L 42.09375 0 L 42.09375 -146.578125 L 43.125 -146.578125 L 122.453125 3.078125 L 127.0625 3.078125 L 208.1875 -145.546875 L 209.21875 -145.546875 L 209.21875 0 L 232.578125 0 L 232.578125 -179.6875 L 214.859375 -179.6875 L 131.6875 -25.40625 L 130.65625 -25.40625 Z M 48.265625 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(2928.590174, 235.96386)"><g><path d="M 41.078125 -179.6875 L 41.078125 0 L 64.4375 0 L 64.4375 -179.6875 Z M 41.078125 -179.6875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(3034.085328, 235.96386)"><g><path d="M 30.796875 0 L 30.796875 -179.6875 L 54.171875 -179.6875 L 54.171875 -14.125 L 146.828125 -14.125 L 146.828125 0 Z M 30.796875 0 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(3188.606131, 235.96386)"><g><path d="M 7.703125 -179.6875 L 69.828125 -68.03125 L 69.828125 0 L 93.1875 0 L 93.1875 -70.34375 L 156.328125 -179.6875 L 142.46875 -179.6875 L 87.53125 -84.96875 L 86.515625 -84.96875 L 34.140625 -179.6875 Z M 7.703125 -179.6875 "/></g></g></g></g></g><g clip-path="url(#0e3ea0e472)"><path fill="#ffffff" d="M 2793.894531 1154.117188 L 2790.078125 1171.03125 C 2794.308594 1171.03125 2861.871094 1171.03125 2866.101562 1171.03125 L 2862.28125 1154.117188 C 2860.355469 1154.117188 2795.824219 1154.117188 2793.894531 1154.117188 " fill-opacity="1" fill-rule="nonzero"/></g><g clip-path="url(#e41def51e2)"><path fill="#ffffff" d="M 2861.273438 1150.296875 C 2865.835938 1128.109375 2872.757812 1107.109375 2881.792969 1087.175781 C 2856.460938 1069.894531 2842.941406 1031.542969 2831.167969 990.078125 C 2832.453125 989.128906 2833.289062 987.613281 2833.289062 985.894531 C 2833.289062 983.699219 2831.921875 981.832031 2829.992188 981.066406 C 2829.992188 989.628906 2829.992188 1092.195312 2829.992188 1096.921875 C 2834.589844 1097.808594 2838.042969 1101.847656 2838.042969 1106.695312 C 2838.042969 1112.1875 2833.59375 1116.652344 2828.089844 1116.652344 C 2822.597656 1116.652344 2818.132812 1112.1875 2818.132812 1106.695312 C 2818.132812 1101.847656 2821.601562 1097.808594 2826.183594 1096.921875 C 2826.183594 1092.195312 2826.183594 989.628906 2826.183594 981.066406 C 2824.257812 981.832031 2822.886719 983.699219 2822.886719 985.894531 C 2822.886719 987.613281 2823.722656 989.128906 2825.007812 990.078125 C 2813.234375 1031.542969 2799.714844 1069.894531 2774.386719 1087.175781 C 2783.417969 1107.109375 2790.34375 1128.109375 2794.902344 1150.296875 C 2796.769531 1150.296875 2859.40625 1150.296875 2861.273438 1150.296875 " fill-opacity="1" fill-rule="nonzero"/></g></svg>`;

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

const DEFAULT_FOOTER_CONFIG_BN = {
  sectionsTitle: 'বিভাগসমূহ',
  enabledSections: null,
  exploreTitle: 'প্রাইভেটিয়ান এক্সপ্লোর করুন',
  explore: [
    { id: 'f-exp-1', label: 'ইভেন্টসমূহ', href: '/events', target: '_self', enabled: true },
    { id: 'f-exp-2', label: 'আর্টিকেল আর্কাইভ', href: '/', target: '_self', enabled: true },
    { id: 'f-exp-3', label: 'আমাদের সম্পর্কে', href: '/', target: '_self', enabled: true },
    { id: 'f-exp-4', label: 'সংবাদ+', href: '/', target: '_self', enabled: true },
    { id: 'f-exp-5', label: 'পডকাস্ট', href: '/', target: '_self', enabled: true }
  ],
  seriesTitle: 'আমাদের সাম্প্রতিক সিরিজ',
  series: [
    {
      id: 'f-ser-1',
      title: 'অনুসন্ধিৎসু',
      href: '/section/findings',
      description: 'প্রাইভেটিয়ান ফ্যামিলি বিশেষজ্ঞদের গভীর অনুসন্ধানী আলোচনা।',
      enabled: true
    },
    {
      id: 'f-ser-2',
      title: 'জীবন | ঐতিহ্য',
      href: '/section/community-heritage',
      description: 'পারিবারিক ঐতিহ্য ও ব্যক্তিগত গবেষণার উপর গুরুত্ব দেওয়া একটি বিশেষ সিরিজ।',
      enabled: true
    }
  ],
  socialTitle: 'অনুসরণ করুন',
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
  tagline: 'দ্য প্রাইভেটিয়ান সোসাইটির অফিশিয়াল প্রকাশনা — ক্যামব্রিজ, ম্যাসাচুসেটস',
  copyright: '© ২০২৬ দ্য প্রাইভেটিয়ান ফ্যামিলি। সর্বস্বত্ব সংরক্ষিত।',
  bottomLinks: [
    { id: 'f-bot-1', label: 'মিডিয়া ও সাংবাদিকদের জন্য', href: '#', target: '_self', enabled: true },
    { id: 'f-bot-2', label: 'পারিবারিক সংবাদ ও আর্কাইভ', href: '#', target: '_self', enabled: true },
    { id: 'f-bot-3', label: 'ডিজিটাল এক্সেসিবিলিটি', href: '#', target: '_self', enabled: true },
    { id: 'f-bot-4', label: 'গোপনীয়তা নীতি', href: '#', target: '_self', enabled: true },
    { id: 'f-bot-5', label: 'ট্রেডমার্ক', href: '#', target: '_self', enabled: true }
  ]
};

function getFooterDefaultSettings(lang) {
  return lang === 'bn' ? DEFAULT_FOOTER_CONFIG_BN : DEFAULT_FOOTER_CONFIG;
}

const FT_ICONS = {
  sections: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  explore:  `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  series:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  social:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  brand:    `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  legal:    `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M12 3v18"/><line x1="4" y1="7" x2="20" y2="7"/><path d="M6 7l-3 6a3 3 0 0 0 6 0l-3-6"/><path d="M18 7l-3 6a3 3 0 0 0 6 0l-3-6"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-1px;margin-right:2px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  pencil:   `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-1px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  upArrow:  `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`,
  downArrow:`<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`
};

function formatSvgWithSize(svgCode, height) {
  const rawSvg = (svgCode && svgCode.trim().indexOf('<svg') !== -1) ? svgCode.trim() : FOOTER_LOGO_DEFAULT_SVG;
  const h = parseInt(height) || 80;
  return rawSvg.replace(/<svg\b([^>]*)>/i, function(match, attrs) {
    const cleanAttrs = attrs
      .replace(/\b(height|width)=["'][^"']*["']/gi, '')
      .replace(/\bstyle=["'][^"']*["']/gi, '');
    return '<svg ' + cleanAttrs.trim() + ' height="' + h + '" style="height:' + h + 'px;max-width:100%;width:auto;display:block;">';
  });
}

appliedFooterConfig = null;
footerDraftConfig = null;
footerUndoStack = [];
footerRedoStack = [];
_activeFooterTab = 'preview';

function getSocialIconSvgForAdmin(platform) {
  const p = (platform || '').toLowerCase();
  if (p === 'instagram') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
  if (p === 'linkedin') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>`;
  if (p === 'tiktok') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.72a8.28 8.28 0 004.84 1.55V6.81a4.85 4.85 0 01-1.07-.12z"/></svg>`;
  if (p === 'facebook') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
  if (p === 'youtube') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon></svg>`;
  if (p === 'email') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
  if (p === 'twitter' || p === 'x') return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
}

async function initFooterPage() {
  updateGlobalSyncStatus('syncing', 'Loading footer settings...');

  // Sync lang switcher buttons in footer
  const ftEn = document.getElementById('ft-lang-en');
  const ftBn = document.getElementById('ft-lang-bn');
  if (ftEn) ftEn.classList.toggle('active', _footerLang === 'en');
  if (ftBn) ftBn.classList.toggle('active', _footerLang === 'bn');

  let loadedConfig = null;

  // Tier 1: Try API
  try {
    const data = await _apiGet('/api/sections?action=footer' + (_footerLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      loadedConfig = data;
    }
  } catch(e) {}

  // Tier 2: Try direct Supabase query on sections table (__footer_config__)
  if (!loadedConfig) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _footerLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') loadedConfig = parsed;
        }
      }
    } catch(e) {}
  }

  // Tier 3: Try Supabase REST fetch
  if (!loadedConfig) {
    try {
      if (typeof PRIVATIAN_SUPABASE_URL !== 'undefined' && typeof PRIVATIAN_SUPABASE_KEY !== 'undefined') {
        const targetAdminId = _footerLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/sections?admin_id=eq.${targetAdminId}&select=name`, {
          headers: {
            'apikey': PRIVATIAN_SUPABASE_KEY,
            'Authorization': 'Bearer ' + PRIVATIAN_SUPABASE_KEY
          }
        });
        if (res.ok) {
          const arr = await res.json();
          if (arr && arr[0] && arr[0].name) {
            const parsed = JSON.parse(arr[0].name);
            if (parsed && typeof parsed === 'object') loadedConfig = parsed;
          }
        }
      }
    } catch(e) {}
  }

  // Tier 5: Default Config based on active language
  if (!loadedConfig) {
    loadedConfig = JSON.parse(JSON.stringify(getFooterDefaultSettings(_footerLang)));
  }

  appliedFooterConfig = JSON.parse(JSON.stringify(loadedConfig));
  footerDraftConfig = JSON.parse(JSON.stringify(loadedConfig));

  footerUndoStack = [];
  footerRedoStack = [];
  updateFooterUndoRedoButtons();
  updateGlobalSyncStatus('synced', `Synced (${_footerLang === 'bn' ? 'বাংলা' : 'English'})`);
  switchFooterTab(_activeFooterTab || 'preview');
}

function recordFooterState(desc) {
  if (!footerDraftConfig) return;
  footerUndoStack.push({
    state: JSON.parse(JSON.stringify(footerDraftConfig)),
    desc: desc || 'Change'
  });
  if (footerUndoStack.length > 50) footerUndoStack.shift();
  footerRedoStack = [];
  updateFooterUndoRedoButtons();
}

function undoFooterAction() {
  if (footerUndoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(footerDraftConfig));
  const prev = footerUndoStack.pop();
  footerRedoStack.push({ state: currentSnapshot, desc: prev.desc });
  footerDraftConfig = prev.state;
  updateFooterUndoRedoButtons();
  updateGlobalSyncStatus();
  refreshActiveFooterTab();
  showToast('warning', `Undo: ${prev.desc || 'Action'}`);
}

function redoFooterAction() {
  if (footerRedoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(footerDraftConfig));
  const next = footerRedoStack.pop();
  footerUndoStack.push({ state: currentSnapshot, desc: next.desc });
  footerDraftConfig = next.state;
  updateFooterUndoRedoButtons();
  updateGlobalSyncStatus();
  refreshActiveFooterTab();
  showToast('success', `Redo: ${next.desc || 'Action'}`);
}

function updateFooterUndoRedoButtons() {
  const uBtn = document.getElementById('ft-undo-btn');
  const rBtn = document.getElementById('ft-redo-btn');
  if (uBtn) uBtn.disabled = (footerUndoStack.length === 0);
  if (rBtn) rBtn.disabled = (footerRedoStack.length === 0);
}

function isFooterModified() {
  if (!appliedFooterConfig || !footerDraftConfig) return false;
  return JSON.stringify(appliedFooterConfig) !== JSON.stringify(footerDraftConfig);
}

function switchFooterTab(tab) {
  _activeFooterTab = tab;
  document.querySelectorAll('#ft-tabs-nav .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-ft-${tab}`);
  });

  const panels = ['preview', 'explore', 'series', 'social', 'sections', 'brand'];
  panels.forEach(p => {
    const pnl = document.getElementById(`panel-ft-${p}`);
    if (pnl) pnl.style.display = (p === tab ? 'block' : 'none');
  });

  refreshActiveFooterTab();
}

function refreshActiveFooterTab() {
  if (!footerDraftConfig) return;
  if (_activeFooterTab === 'preview')  renderFooterPreview();
  if (_activeFooterTab === 'explore')  renderFooterExplore();
  if (_activeFooterTab === 'series')   renderFooterSeries();
  if (_activeFooterTab === 'social')   renderFooterSocial();
  if (_activeFooterTab === 'sections') renderFooterSections();
  if (_activeFooterTab === 'brand')    renderFooterBrand();
  updateGlobalSyncStatus();
}

function onFooterTitleInput(key, value) {
  if (!footerDraftConfig) return;
  recordFooterState(`Update ${key}`);
  footerDraftConfig[key] = value;
  updateGlobalSyncStatus();
  if (key === 'tagline' || key === 'copyright') {
    updateFooterLogoPreview();
  }
}

// ── TAB: LIVE INTERACTIVE VISUAL CANVAS ───────────────────────────
function renderFooterPreview() {
  const box = document.getElementById('ft-live-preview-box');
  if (!box || !footerDraftConfig) return;

  const cfg = footerDraftConfig;
  const activeSecs = sections.filter(s => !s.deleted);
  const enabledSet = Array.isArray(cfg.enabledSections) ? cfg.enabledSections : null;
  const displaySecs = activeSecs.filter(s => enabledSet ? enabledSet.includes(s.slug || s.id) : true);

  const isBn = (_footerLang === 'bn');
  const exploreList = cfg.explore || [];
  const seriesList = cfg.series || [];
  const socialList = cfg.social || [];
  const bottomList = cfg.bottomLinks || [];

  box.innerHTML = `
    <div class="ft-preview-grid">
      <!-- Col 1: Sections -->
      <div class="ft-interactive-col">
        <div class="ft-col-header-bar">
          <span class="ft-col-title-badge">${FT_ICONS.sections}${escapeHtml(cfg.sectionsTitle || (isBn ? 'বিভাগসমূহ' : 'Sections'))}</span>
          <button type="button" class="ft-col-quick-btn" onclick="switchFooterTab('sections')">
            ${FT_ICONS.settings}Edit (${displaySecs.length})
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${displaySecs.length === 0 ? '<span style="font-size:12px;color:#64748b;font-style:italic;">No sections enabled.</span>' : ''}
          ${displaySecs.map(s => {
            const secSlug = s.slug || s.id;
            const displayName = (isBn && s.name_bn) ? s.name_bn : s.name;
            return `
              <div class="ft-visual-item" onclick="switchFooterTab('sections')" title="Manage section visibility">
                <span style="font-size:12.5px;color:#e2e8f0;">${escapeHtml(displayName)}</span>
                <span style="font-size:10px;color:#38bdf8;">${s.slug ? '/section/' + escapeHtml(s.slug) : '/ (all)'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Col 2: Explore Links -->
      <div class="ft-interactive-col">
        <div class="ft-col-header-bar">
          <span class="ft-col-title-badge">${FT_ICONS.explore}${escapeHtml(cfg.exploreTitle || 'Explore')}</span>
          <div style="display:flex;gap:4px;">
            <button type="button" class="ft-col-quick-btn" onclick="openFooterExploreModal()" title="Add Explore Link">+ Add</button>
            <button type="button" class="ft-col-quick-btn" onclick="switchFooterTab('explore')" title="Manage Explore List">List</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${exploreList.length === 0 ? '<span style="font-size:12px;color:#64748b;font-style:italic;">No explore links added yet.</span>' : ''}
          ${exploreList.map(e => `
            <div class="ft-visual-item ${e.enabled === false ? 'disabled' : ''}" onclick="openFooterExploreModal('${e.id}')" title="Click to edit link">
              <span style="font-size:13px;font-weight:500;color:#f1f5f9;">${escapeHtml(e.label || 'Untitled')}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:10.5px;color:#94a3b8;font-family:monospace;">${escapeHtml(e.href || '/')}</span>
                <span style="color:#38bdf8;font-size:11px;">${FT_ICONS.pencil}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Col 3: Recent Series -->
      <div class="ft-interactive-col">
        <div class="ft-col-header-bar">
          <span class="ft-col-title-badge">${FT_ICONS.series}${escapeHtml(cfg.seriesTitle || 'Our recent series')}</span>
          <div style="display:flex;gap:4px;">
            <button type="button" class="ft-col-quick-btn" onclick="openFooterSeriesModal()" title="Add Series">+ Add</button>
            <button type="button" class="ft-col-quick-btn" onclick="switchFooterTab('series')" title="Manage Series List">List</button>
          </div>
        </div>
        <div>
          ${seriesList.length === 0 ? '<span style="font-size:12px;color:#64748b;font-style:italic;">No series highlights configured.</span>' : ''}
          ${seriesList.map(s => `
            <div class="ft-visual-series-card ${s.enabled === false ? 'disabled' : ''}" onclick="openFooterSeriesModal('${s.id}')" title="Click to edit series">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <div style="font-family:var(--font-serif);font-size:14px;font-weight:700;color:#ffffff;">${escapeHtml(s.title || 'Untitled Series')}</div>
                <span style="color:#38bdf8;font-size:11px;">${FT_ICONS.pencil}</span>
              </div>
              ${s.description ? `<div style="font-size:11.5px;color:#94a3b8;line-height:1.35;margin-bottom:4px;">${escapeHtml(s.description)}</div>` : ''}
              <div style="font-size:10.5px;color:#38bdf8;font-family:monospace;">${escapeHtml(s.href || '/')}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Col 4: Social & Channels -->
      <div class="ft-interactive-col">
        <div class="ft-col-header-bar">
          <span class="ft-col-title-badge">${FT_ICONS.social}${escapeHtml(cfg.socialTitle || 'Follow us on')}</span>
          <div style="display:flex;gap:4px;">
            <button type="button" class="ft-col-quick-btn" onclick="openFooterSocialModal()" title="Add Social Channel">+ Add</button>
            <button type="button" class="ft-col-quick-btn" onclick="switchFooterTab('social')" title="Manage Social List">List</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:6px;">
          ${socialList.length === 0 ? '<span style="font-size:12px;color:#64748b;font-style:italic;">No social channels added.</span>' : ''}
          ${socialList.map(sc => `
            <div class="ft-social-chip ft-social-chip--${escapeHtml(sc.platform || 'custom')} ${sc.enabled === false ? 'disabled' : ''}" onclick="openFooterSocialModal('${sc.id}')" title="Click to edit ${escapeHtml(sc.label || sc.platform)}">
              ${getSocialIconSvgForAdmin(sc.platform)}
              <span style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sc.label || sc.platform)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Bottom Bar Interactive -->
    <div class="ft-preview-bottom">
      <div class="ft-interactive-col" style="flex:1;min-width:280px;cursor:pointer;" onclick="switchFooterTab('brand')" title="Click to edit Footer Logo, Tagline &amp; Copyright">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="ft-col-title-badge" style="font-size:11px;">${FT_ICONS.brand}Brand Identity</span>
          <span class="ft-col-quick-btn" style="padding:1px 6px;font-size:10px;">${FT_ICONS.pencil}Edit Logo &amp; Brand</span>
        </div>
        <div style="display:inline-block;margin-bottom:8px;max-width:100%;">
          ${formatSvgWithSize(cfg.logoSvg, cfg.logoHeight)}
        </div>
        ${cfg.tagline ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;line-height:1.4;">${escapeHtml(cfg.tagline)}</div>` : ''}
        ${cfg.copyright ? `<div style="font-size:11.5px;color:rgba(255,255,255,0.45);margin-top:4px;">${escapeHtml(cfg.copyright)}</div>` : ''}
      </div>

      <div class="ft-interactive-col" style="flex:1;min-width:260px;">
        <div class="ft-col-header-bar" style="margin-bottom:8px;">
          <span class="ft-col-title-badge" style="font-size:11px;">${FT_ICONS.legal}Legal Links</span>
          <button type="button" class="ft-col-quick-btn" onclick="openFooterBottomLinkModal()" title="Add Legal Link">+ Add Link</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${bottomList.length === 0 ? '<span style="font-size:11px;color:#64748b;">No legal links added.</span>' : ''}
          ${bottomList.map(b => `
            <span class="ft-visual-item ${b.enabled === false ? 'disabled' : ''}" style="display:inline-flex;padding:3px 8px;font-size:11px;margin:0;" onclick="openFooterBottomLinkModal('${b.id}')" title="Click to edit link">
              <span>${escapeHtml(b.label || 'Link')}</span>
              <span style="color:#38bdf8;margin-left:4px;font-size:10px;">${FT_ICONS.pencil}</span>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── TAB: EXPLORE LINKS ────────────────────────────────────────────
function renderFooterExplore() {
  const container = document.getElementById('ft-explore-list-container');
  const titleInput = document.getElementById('ft-explore-title-input');
  if (titleInput && footerDraftConfig) titleInput.value = footerDraftConfig.exploreTitle || 'Explore the Privatian';
  if (!container || !footerDraftConfig) return;

  const items = footerDraftConfig.explore || [];
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text-muted);font-size:13.5px;">No explore links configured yet. Click <strong>"Add Explore Link"</strong> above.</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="ft-item-card ${item.enabled === false ? 'disabled' : ''}">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <div class="ft-drag-handle">
          <button type="button" class="action-btn" onclick="moveFooterItem('explore', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:2px 4px;font-size:10px;">${FT_ICONS.upArrow}</button>
          <button type="button" class="action-btn" onclick="moveFooterItem('explore', ${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:2px 4px;font-size:10px;">${FT_ICONS.downArrow}</button>
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14.5px;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span>${escapeHtml(item.label || 'Untitled Link')}</span>
            <span class="ft-target-badge">${item.target === '_blank' ? 'New Tab ↗' : 'Same Tab'}</span>
          </div>
          <div style="margin-top:4px;">
            <span class="ft-url-badge">${escapeHtml(item.href || '/')}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <label class="hs-toggle" title="Enable or disable this link">
          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleFooterExplore('${item.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" onclick="openFooterExploreModal('${item.id}')" title="Edit Link">${ICONS.pencil}</button>
        <button type="button" class="art-action-btn art-action-btn--delete" onclick="deleteFooterExplore('${item.id}')" title="Delete Link">${ICONS.trash}</button>
      </div>
    </div>
  `).join('');
}

// ── TAB: RECENT SERIES ────────────────────────────────────────────
function renderFooterSeries() {
  const container = document.getElementById('ft-series-list-container');
  const titleInput = document.getElementById('ft-series-title-input');
  if (titleInput && footerDraftConfig) titleInput.value = footerDraftConfig.seriesTitle || 'Our recent series';
  if (!container || !footerDraftConfig) return;

  const items = footerDraftConfig.series || [];
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text-muted);font-size:13.5px;">No series highlights configured yet. Click <strong>"Add Series Highlight"</strong> above.</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="ft-item-card ${item.enabled === false ? 'disabled' : ''}">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <div class="ft-drag-handle">
          <button type="button" class="action-btn" onclick="moveFooterItem('series', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:2px 4px;font-size:10px;">${FT_ICONS.upArrow}</button>
          <button type="button" class="action-btn" onclick="moveFooterItem('series', ${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:2px 4px;font-size:10px;">${FT_ICONS.downArrow}</button>
        </div>
        <div style="min-width:0;">
          <div style="font-family:var(--font-serif);font-weight:700;font-size:15px;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            ${FT_ICONS.series}
            <span>${escapeHtml(item.title || 'Untitled Series')}</span>
          </div>
          ${item.description ? `<div style="font-size:12.5px;color:var(--text-muted);margin:3px 0 5px;line-height:1.4;">${escapeHtml(item.description)}</div>` : ''}
          <div>
            <span class="ft-url-badge">${escapeHtml(item.href || '/')}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <label class="hs-toggle" title="Enable or disable series">
          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleFooterSeries('${item.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" onclick="openFooterSeriesModal('${item.id}')" title="Edit Series">${ICONS.pencil}</button>
        <button type="button" class="art-action-btn art-action-btn--delete" onclick="deleteFooterSeries('${item.id}')" title="Delete Series">${ICONS.trash}</button>
      </div>
    </div>
  `).join('');
}

// ── TAB: SOCIAL & CHANNELS ────────────────────────────────────────
function renderFooterSocial() {
  const container = document.getElementById('ft-social-list-container');
  const titleInput = document.getElementById('ft-social-title-input');
  if (titleInput && footerDraftConfig) titleInput.value = footerDraftConfig.socialTitle || 'Follow us on';
  if (!container || !footerDraftConfig) return;

  const items = footerDraftConfig.social || [];
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text-muted);font-size:13.5px;">No social accounts configured yet. Click <strong>"Add Social Channel"</strong> above.</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="ft-item-card ${item.enabled === false ? 'disabled' : ''}">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <div class="ft-drag-handle">
          <button type="button" class="action-btn" onclick="moveFooterItem('social', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:2px 4px;font-size:10px;">${FT_ICONS.upArrow}</button>
          <button type="button" class="action-btn" onclick="moveFooterItem('social', ${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:2px 4px;font-size:10px;">${FT_ICONS.downArrow}</button>
        </div>
        <div class="ft-social-chip ft-social-chip--${escapeHtml(item.platform || 'custom')}" style="padding:8px 12px;border-radius:8px;">
          ${getSocialIconSvgForAdmin(item.platform)}
          <span>${escapeHtml(item.platform ? item.platform.toUpperCase() : 'WEB')}</span>
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${escapeHtml(item.label || item.platform)}</div>
          <div style="margin-top:3px;"><span class="ft-url-badge">${escapeHtml(item.href || '#')}</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <label class="hs-toggle" title="Enable or disable social channel">
          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleFooterSocial('${item.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" onclick="openFooterSocialModal('${item.id}')" title="Edit Channel">${ICONS.pencil}</button>
        <button type="button" class="art-action-btn art-action-btn--delete" onclick="deleteFooterSocial('${item.id}')" title="Delete Channel">${ICONS.trash}</button>
      </div>
    </div>
  `).join('');
}

// ── TAB: SECTIONS COLUMN ──────────────────────────────────────────
function renderFooterSections() {
  const container = document.getElementById('ft-sections-list-container');
  const titleInput = document.getElementById('ft-sections-title-input');
  if (titleInput && footerDraftConfig) titleInput.value = footerDraftConfig.sectionsTitle || 'Sections';
  if (!container || !footerDraftConfig) return;

  const activeSecs = (sections || []).filter(s => !s.deleted);
  if (activeSecs.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">No active sections found in the database.</div>`;
    return;
  }

  // Align ordered list
  let orderedSecs = [...activeSecs];
  const enabledSet = Array.isArray(footerDraftConfig.enabledSections) ? footerDraftConfig.enabledSections : null;
  if (enabledSet) {
    orderedSecs.sort((a, b) => {
      const idA = a.slug || a.id;
      const idB = b.slug || b.id;
      const idxA = enabledSet.indexOf(idA);
      const idxB = enabledSet.indexOf(idB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }

  const isBn = (_footerLang === 'bn');
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${orderedSecs.map((s, idx) => {
        const secSlug = s.slug || s.id;
        const isChecked = enabledSet === null ? true : enabledSet.includes(secSlug);
        const displayName = (isBn && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
        return `
          <div class="ft-section-pill-card ${isChecked ? 'selected' : ''}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <span style="font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:6px;flex-shrink:0;">#${idx + 1}</span>
              <div style="display:flex;gap:3px;flex-shrink:0;">
                <button type="button" class="action-btn" onclick="moveFooterSection(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === 0 ? 'not-allowed' : 'pointer'};opacity:${idx === 0 ? '0.4' : '1'};font-size:11px;">
                  ▲
                </button>
                <button type="button" class="action-btn" onclick="moveFooterSection(${idx}, 1)" ${idx === orderedSecs.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:4px 6px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:${idx === orderedSecs.length - 1 ? 'not-allowed' : 'pointer'};opacity:${idx === orderedSecs.length - 1 ? '0.4' : '1'};font-size:11px;">
                  ▼
                </button>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:13.5px;color:#0f172a;">${escapeHtml(displayName)}</div>
                <div style="font-size:11px;color:#64748b;">${s.slug ? '/section/' + escapeHtml(s.slug) : '/ (all)'}</div>
              </div>
            </div>
            <label class="hs-toggle" title="${isChecked ? 'Active in footer' : 'Hidden in footer'}" style="flex-shrink:0;margin-left:12px;">
              <input type="checkbox" value="${secSlug}" ${isChecked ? 'checked' : ''} onchange="onFooterSectionToggle('${secSlug}', this.checked)" />
              <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
            </label>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function moveFooterSection(index, dir) {
  if (!footerDraftConfig) return;
  recordFooterState('Move Footer Section');
  const activeSecs = (sections || []).filter(s => !s.deleted);
  let orderedSecs = [...activeSecs];
  const enabledSet = Array.isArray(footerDraftConfig.enabledSections) ? footerDraftConfig.enabledSections : activeSecs.map(s => s.slug || s.id);
  
  orderedSecs.sort((a, b) => {
    const idA = a.slug || a.id;
    const idB = b.slug || b.id;
    const idxA = enabledSet.indexOf(idA);
    const idxB = enabledSet.indexOf(idB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const targetIndex = index + dir;
  if (targetIndex < 0 || targetIndex >= orderedSecs.length) return;

  const item = orderedSecs.splice(index, 1)[0];
  orderedSecs.splice(targetIndex, 0, item);

  const currentChecked = Array.from(document.querySelectorAll('#ft-sections-list-container input[type="checkbox"]')).filter(c => c.checked).map(c => c.value);
  footerDraftConfig.enabledSections = orderedSecs
    .filter(s => currentChecked.includes(s.slug || s.id))
    .map(s => s.slug || s.id);

  renderFooterSections();
  updateGlobalSyncStatus();
}

function onFooterSectionToggle(slug, checked) {
  if (!footerDraftConfig) return;
  recordFooterState('Toggle Footer Section');
  const activeSecs = (sections || []).filter(s => !s.deleted);
  if (!Array.isArray(footerDraftConfig.enabledSections)) {
    footerDraftConfig.enabledSections = activeSecs.map(s => s.slug || s.id);
  }
  if (checked) {
    if (!footerDraftConfig.enabledSections.includes(slug)) footerDraftConfig.enabledSections.push(slug);
  } else {
    footerDraftConfig.enabledSections = footerDraftConfig.enabledSections.filter(x => x !== slug);
  }
  renderFooterSections();
  updateGlobalSyncStatus();
  recordActivityLog({
    action: 'layout.footer_toggle_section',
    category: 'layout',
    summary: `${checked ? 'Enabled' : 'Disabled'} section "${slug}" in Footer column`,
    target_id: slug,
    target_name: slug,
    details: { slug, enabled: checked }
  });
}

function selectAllFooterSections(enableAll) {
  if (!footerDraftConfig) return;
  recordFooterState(enableAll ? 'Select All Sections' : 'Deselect All Sections');
  const activeSecs = sections.filter(s => !s.deleted);
  footerDraftConfig.enabledSections = enableAll ? activeSecs.map(s => s.slug || s.id) : [];
  updateGlobalSyncStatus();
  renderFooterSections();
  showToast('success', enableAll ? 'All sections enabled for footer.' : 'All sections hidden from footer.');
  recordActivityLog({
    action: 'layout.footer_toggle_all_sections',
    category: 'layout',
    summary: `${enableAll ? 'Enabled all' : 'Disabled all'} sections in Footer column`,
    target_id: 'footer_sections_all',
    target_name: 'Footer Sections',
    details: { enableAll }
  });
}

// ── TAB: BRAND & LEGAL LINKS ──────────────────────────────────────
function renderFooterBrand() {
  if (!footerDraftConfig) return;
  const svgInput = document.getElementById('ft-logo-svg-input');
  const heightSlider = document.getElementById('ft-logo-height-slider');
  const heightVal = document.getElementById('ft-logo-height-val');
  const taglineInput = document.getElementById('ft-tagline-input');
  const copyrightInput = document.getElementById('ft-copyright-input');
  const container = document.getElementById('ft-bottom-links-container');

  if (svgInput) svgInput.value = footerDraftConfig.logoSvg || '';
  if (heightSlider) {
    heightSlider.value = footerDraftConfig.logoHeight || 80;
    if (heightVal) heightVal.textContent = heightSlider.value;
  }
  if (taglineInput) taglineInput.value = footerDraftConfig.tagline || '';
  if (copyrightInput) copyrightInput.value = footerDraftConfig.copyright || '';

  updateFooterLogoPreview();

  if (!container) return;

  const items = footerDraftConfig.bottomLinks || [];
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">No bottom legal links added yet. Click <strong>"Add Legal Link"</strong> above.</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="ft-item-card ${item.enabled === false ? 'disabled' : ''}">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <div class="ft-drag-handle">
          <button type="button" class="action-btn" onclick="moveFooterItem('bottomLinks', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding:2px 4px;font-size:10px;">${FT_ICONS.upArrow}</button>
          <button type="button" class="action-btn" onclick="moveFooterItem('bottomLinks', ${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''} title="Move Down" style="padding:2px 4px;font-size:10px;">${FT_ICONS.downArrow}</button>
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span style="display:flex;align-items:center;gap:4px;">${FT_ICONS.legal}${escapeHtml(item.label || 'Untitled Link')}</span>
            <span class="ft-target-badge">${item.target === '_blank' ? 'New Tab ↗' : 'Same Tab'}</span>
          </div>
          <div style="margin-top:4px;"><span class="ft-url-badge">${escapeHtml(item.href || '#')}</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <label class="hs-toggle" title="Enable or disable link">
          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleFooterBottomLink('${item.id}')" />
          <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
        </label>
        <button type="button" class="art-action-btn art-action-btn--edit" onclick="openFooterBottomLinkModal('${item.id}')" title="Edit Link">${ICONS.pencil}</button>
        <button type="button" class="art-action-btn art-action-btn--delete" onclick="deleteFooterBottomLink('${item.id}')" title="Delete Link">${ICONS.trash}</button>
      </div>
    </div>
  `).join('');
}

function handleFooterSvgFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
    showToast('error', 'Only .svg files are supported!');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    if (text && text.trim().indexOf('<svg') !== -1) {
      const cleanSvg = text.trim();
      onFooterLogoSvgInput(cleanSvg);
      const textarea = document.getElementById('ft-logo-svg-input');
      if (textarea) textarea.value = cleanSvg;
      showToast('success', 'SVG Logo loaded successfully!');
    } else {
      showToast('error', 'Invalid SVG file: Could not find <svg> element.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function openFooterLogoPicker(opts = {}) {
  const defaultTab = typeof opts === 'string' ? opts : (opts && opts.defaultTab ? opts.defaultTab : 'gallery');
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Select or Upload Footer SVG Logo',
      subtitle: 'Pick an SVG logo from gallery or upload new SVG file',
      targetFolder: 'Logos & Icons',
      defaultTab: defaultTab,
      type: 'svg',
      onSelect: async (item) => {
        if (!item) return;
        try {
          showToast('info', 'Loading SVG logo content...');
          let text = '';
          // 1. Try reading via backend proxy / read_text endpoint (CORS-safe & direct from R2)
          try {
            const token = _getAuthToken();
            const res = await fetch(`/api/media?action=read_text&id=${encodeURIComponent(item.unique_id || item.id || '')}&key=${encodeURIComponent(item.r2_key || '')}`, {
              headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.content) text = data.content;
            }
          } catch(e) {}

          // 2. Fallback to direct URL fetch
          if (!text && item.url) {
            try {
              const uRes = await fetch(item.url);
              if (uRes.ok) text = await uRes.text();
            } catch(e) {}
          }

          if (text && text.includes('<svg')) {
            const cleanSvg = text.trim();
            onFooterLogoSvgInput(cleanSvg);
            const textarea = document.getElementById('ft-logo-svg-input');
            if (textarea) textarea.value = cleanSvg;
            showToast('success', 'Footer SVG Logo loaded from Media Gallery!');
          } else {
            showToast('error', 'Selected file does not contain valid SVG code.');
          }
        } catch(err) {
          showToast('error', 'Failed to load SVG: ' + err.message);
        }
      }
    });
  } else {
    const fileInp = document.getElementById('ft-logo-file-input');
    if (fileInp) fileInp.click();
  }
}

function onFooterLogoSvgInput(svgCode) {
  if (!footerDraftConfig) return;
  recordFooterState('Change Footer Logo SVG');
  footerDraftConfig.logoSvg = svgCode ? svgCode.trim() : '';
  updateGlobalSyncStatus();
  updateFooterLogoPreview();
  recordActivityLog({
    action: 'layout.footer_logo_update',
    category: 'layout',
    summary: `Updated Footer logo SVG in Footer Settings`,
    target_id: 'footer_logo',
    target_name: 'Footer Logo',
    details: {}
  });
}

function onFooterLogoHeightInput(heightVal) {
  if (!footerDraftConfig) return;
  const h = parseInt(heightVal) || 80;
  recordFooterState('Resize Footer Logo');
  footerDraftConfig.logoHeight = h;
  const label = document.getElementById('ft-logo-height-val');
  if (label) label.textContent = h;
  updateGlobalSyncStatus();
  updateFooterLogoPreview();
  recordActivityLog({
    action: 'layout.footer_logo_resize',
    category: 'layout',
    summary: `Resized Footer logo to ${h}px`,
    target_id: 'footer_logo',
    target_name: 'Footer Logo',
    details: { height: h }
  });
}

function resetFooterLogoToDefault() {
  if (!footerDraftConfig) return;
  recordFooterState('Reset Footer Logo to Default');
  footerDraftConfig.logoSvg = '';
  footerDraftConfig.logoHeight = 80;
  const textarea = document.getElementById('ft-logo-svg-input');
  if (textarea) textarea.value = '';
  const slider = document.getElementById('ft-logo-height-slider');
  if (slider) slider.value = 80;
  const label = document.getElementById('ft-logo-height-val');
  if (label) label.textContent = 80;
  updateGlobalSyncStatus();
  updateFooterLogoPreview();
  showToast('info', 'Footer logo reset to default.');
  recordActivityLog({
    action: 'layout.footer_logo_reset',
    category: 'layout',
    summary: `Reset Footer logo to default in Footer Settings`,
    target_id: 'footer_logo',
    target_name: 'Footer Logo',
    details: {}
  });
}

function updateFooterLogoPreview() {
  if (!footerDraftConfig) return;
  const logoRenderEl = document.getElementById('ft-logo-render-preview');
  const taglineEl = document.getElementById('ft-tagline-preview-text');
  const copyrightEl = document.getElementById('ft-copyright-preview-text');

  if (logoRenderEl) {
    logoRenderEl.innerHTML = formatSvgWithSize(footerDraftConfig.logoSvg, footerDraftConfig.logoHeight);
  }

  if (taglineEl) {
    taglineEl.textContent = footerDraftConfig.tagline || '';
    taglineEl.style.display = footerDraftConfig.tagline ? 'block' : 'none';
  }

  if (copyrightEl) {
    copyrightEl.textContent = footerDraftConfig.copyright || '';
    copyrightEl.style.display = footerDraftConfig.copyright ? 'block' : 'none';
  }
}

// ── REORDERING HELPER ─────────────────────────────────────────────
function moveFooterItem(type, index, dir) {
  if (!footerDraftConfig || !Array.isArray(footerDraftConfig[type])) return;
  const arr = footerDraftConfig[type];
  const targetIndex = index + dir;
  if (targetIndex < 0 || targetIndex >= arr.length) return;
  recordFooterState(`Reorder ${type}`);
  const temp = arr[index];
  arr[index] = arr[targetIndex];
  arr[targetIndex] = temp;
  refreshActiveFooterTab();
  recordActivityLog({
    action: `layout.footer_reorder_${type}`,
    category: 'layout',
    summary: `Reordered item in Footer ${type} (${dir < 0 ? 'Moved Up' : 'Moved Down'})`,
    target_id: temp?.id || type,
    target_name: temp?.label || temp?.title || type,
    details: { type, dir }
  });
}

// ── MODALS: EXPLORE ───────────────────────────────────────────────
function openFooterExploreModal(id) {
  const modal = document.getElementById('modal-footer-explore');
  const title = document.getElementById('modal-ft-exp-title');
  const editId = document.getElementById('ft-exp-edit-id');
  const labelInput = document.getElementById('ft-exp-label-input');
  const hrefInput = document.getElementById('ft-exp-href-input');
  const targetSelect = document.getElementById('ft-exp-target-select');
  if (!modal) return;

  if (id && footerDraftConfig) {
    const item = (footerDraftConfig.explore || []).find(e => e.id === id);
    if (!item) return;
    title.textContent = 'Edit Explore Link';
    editId.value = item.id;
    labelInput.value = item.label || '';
    hrefInput.value = item.href || '';
    targetSelect.value = item.target || '_self';
  } else {
    title.textContent = 'Add Explore Link';
    editId.value = '';
    labelInput.value = '';
    hrefInput.value = '';
    targetSelect.value = '_self';
  }
  modal.hidden = false;
  setTimeout(() => labelInput.focus(), 60);
}

function closeFooterExploreModal() {
  const modal = document.getElementById('modal-footer-explore');
  if (modal) modal.hidden = true;
}

function saveFooterExploreModal() {
  const editId = document.getElementById('ft-exp-edit-id').value;
  const label = document.getElementById('ft-exp-label-input').value.trim();
  const href = document.getElementById('ft-exp-href-input').value.trim();
  const target = document.getElementById('ft-exp-target-select').value;
  if (!label) { showToast('error', 'Please enter a link label.'); return; }
  if (!href) { showToast('error', 'Please enter a target URL.'); return; }

  recordFooterState(editId ? 'Edit Explore Link' : 'Add Explore Link');
  if (!Array.isArray(footerDraftConfig.explore)) footerDraftConfig.explore = [];

  if (editId) {
    const item = footerDraftConfig.explore.find(e => e.id === editId);
    if (item) { item.label = label; item.href = href; item.target = target; }
  } else {
    footerDraftConfig.explore.push({
      id: 'f-exp-' + Date.now(),
      label, href, target, enabled: true
    });
  }
  closeFooterExploreModal();
  renderFooterExplore();
  showToast('success', 'Explore link updated.');

  recordActivityLog({
    action: editId ? 'layout.footer_edit_explore' : 'layout.footer_add_explore',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} explore link "${label}" in Footer`,
    target_id: editId || 'footer-exp-new',
    target_name: label,
    details: { label, href, target }
  });
}

function toggleFooterExplore(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.explore || []).find(e => e.id === id);
  if (!item) return;
  recordFooterState('Toggle Explore Link');
  item.enabled = (item.enabled === false ? true : false);
  renderFooterExplore();

  recordActivityLog({
    action: 'layout.footer_toggle_explore',
    category: 'layout',
    summary: `${item.enabled ? 'Enabled' : 'Disabled'} explore link "${item.label || id}" in Footer`,
    target_id: item.id,
    target_name: item.label,
    details: { id: item.id, enabled: item.enabled }
  });
}

function deleteFooterExplore(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.explore || []).find(e => e.id === id);
  recordFooterState('Delete Explore Link');
  footerDraftConfig.explore = (footerDraftConfig.explore || []).filter(e => e.id !== id);
  renderFooterExplore();
  showToast('warning', 'Explore link removed.');

  recordActivityLog({
    action: 'layout.footer_delete_explore',
    category: 'layout',
    summary: `Deleted explore link "${item?.label || id}" from Footer`,
    target_id: id,
    target_name: item?.label || id,
    details: { id }
  });
}

// ── MODALS: SERIES ────────────────────────────────────────────────
function openFooterSeriesModal(id) {
  const modal = document.getElementById('modal-footer-series');
  const title = document.getElementById('modal-ft-ser-title');
  const editId = document.getElementById('ft-ser-edit-id');
  const titleInput = document.getElementById('ft-ser-title-input');
  const hrefInput = document.getElementById('ft-ser-href-input');
  const descInput = document.getElementById('ft-ser-desc-input');
  if (!modal) return;

  if (id && footerDraftConfig) {
    const item = (footerDraftConfig.series || []).find(s => s.id === id);
    if (!item) return;
    title.textContent = 'Edit Series Highlight';
    editId.value = item.id;
    titleInput.value = item.title || '';
    hrefInput.value = item.href || '';
    descInput.value = item.description || '';
  } else {
    title.textContent = 'Add Series Highlight';
    editId.value = '';
    titleInput.value = '';
    hrefInput.value = '';
    descInput.value = '';
  }
  modal.hidden = false;
  setTimeout(() => titleInput.focus(), 60);
}

function closeFooterSeriesModal() {
  const modal = document.getElementById('modal-footer-series');
  if (modal) modal.hidden = true;
}

function saveFooterSeriesModal() {
  const editId = document.getElementById('ft-ser-edit-id').value;
  const title = document.getElementById('ft-ser-title-input').value.trim();
  const href = document.getElementById('ft-ser-href-input').value.trim();
  const desc = document.getElementById('ft-ser-desc-input').value.trim();
  if (!title) { showToast('error', 'Please enter a series title.'); return; }
  if (!href) { showToast('error', 'Please enter a target URL.'); return; }

  recordFooterState(editId ? 'Edit Series Highlight' : 'Add Series Highlight');
  if (!Array.isArray(footerDraftConfig.series)) footerDraftConfig.series = [];

  if (editId) {
    const item = footerDraftConfig.series.find(s => s.id === editId);
    if (item) { item.title = title; item.href = href; item.description = desc; }
  } else {
    footerDraftConfig.series.push({
      id: 'f-ser-' + Date.now(),
      title, href, description: desc, enabled: true
    });
  }
  closeFooterSeriesModal();
  renderFooterSeries();
  showToast('success', 'Series highlight updated.');

  recordActivityLog({
    action: editId ? 'layout.footer_edit_series' : 'layout.footer_add_series',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} series highlight "${title}" in Footer`,
    target_id: editId || 'footer-ser-new',
    target_name: title,
    details: { title, href, description: desc }
  });
}

function toggleFooterSeries(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.series || []).find(s => s.id === id);
  if (!item) return;
  recordFooterState('Toggle Series');
  item.enabled = (item.enabled === false ? true : false);
  renderFooterSeries();

  recordActivityLog({
    action: 'layout.footer_toggle_series',
    category: 'layout',
    summary: `${item.enabled ? 'Enabled' : 'Disabled'} series highlight "${item.title || id}" in Footer`,
    target_id: item.id,
    target_name: item.title,
    details: { id: item.id, enabled: item.enabled }
  });
}

function deleteFooterSeries(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.series || []).find(s => s.id === id);
  recordFooterState('Delete Series');
  footerDraftConfig.series = (footerDraftConfig.series || []).filter(s => s.id !== id);
  renderFooterSeries();
  showToast('warning', 'Series highlight removed.');

  recordActivityLog({
    action: 'layout.footer_delete_series',
    category: 'layout',
    summary: `Deleted series highlight "${item?.title || id}" from Footer`,
    target_id: id,
    target_name: item?.title || id,
    details: { id }
  });
}

// ── MODALS: SOCIAL ────────────────────────────────────────────────
function openFooterSocialModal(id) {
  const modal = document.getElementById('modal-footer-social');
  const title = document.getElementById('modal-ft-soc-title');
  const editId = document.getElementById('ft-soc-edit-id');
  const platformSelect = document.getElementById('ft-soc-platform-select');
  const labelInput = document.getElementById('ft-soc-label-input');
  const hrefInput = document.getElementById('ft-soc-href-input');
  if (!modal) return;

  if (id && footerDraftConfig) {
    const item = (footerDraftConfig.social || []).find(sc => sc.id === id);
    if (!item) return;
    title.textContent = 'Edit Social Channel';
    editId.value = item.id;
    platformSelect.value = item.platform || 'instagram';
    labelInput.value = item.label || '';
    hrefInput.value = item.href || '';
  } else {
    title.textContent = 'Add Social Channel';
    editId.value = '';
    platformSelect.value = 'instagram';
    labelInput.value = 'Instagram';
    hrefInput.value = 'https://instagram.com';
  }
  modal.hidden = false;
  setTimeout(() => labelInput.focus(), 60);
}

function onFooterSocialPlatformChange(platform) {
  const labelInput = document.getElementById('ft-soc-label-input');
  const hrefInput = document.getElementById('ft-soc-href-input');
  const map = {
    instagram: { label: 'Instagram', href: 'https://instagram.com' },
    linkedin:  { label: 'LinkedIn',  href: 'https://linkedin.com' },
    tiktok:    { label: 'TikTok',    href: 'https://tiktok.com' },
    facebook:  { label: 'Facebook',  href: 'https://facebook.com' },
    youtube:   { label: 'YouTube',   href: 'https://youtube.com' },
    email:     { label: 'Email',     href: 'mailto:contact@privatian.org' },
    twitter:   { label: 'X / Twitter', href: 'https://x.com' },
    custom:    { label: 'Website',   href: 'https://' }
  };
  if (map[platform]) {
    if (labelInput) labelInput.value = map[platform].label;
    if (hrefInput) hrefInput.value = map[platform].href;
  }
}

function closeFooterSocialModal() {
  const modal = document.getElementById('modal-footer-social');
  if (modal) modal.hidden = true;
}

function saveFooterSocialModal() {
  const editId = document.getElementById('ft-soc-edit-id').value;
  const platform = document.getElementById('ft-soc-platform-select').value;
  const label = document.getElementById('ft-soc-label-input').value.trim();
  const href = document.getElementById('ft-soc-href-input').value.trim();
  if (!label) { showToast('error', 'Please enter a display label.'); return; }
  if (!href) { showToast('error', 'Please enter a URL or target link.'); return; }

  recordFooterState(editId ? 'Edit Social Channel' : 'Add Social Channel');
  if (!Array.isArray(footerDraftConfig.social)) footerDraftConfig.social = [];

  if (editId) {
    const item = footerDraftConfig.social.find(sc => sc.id === editId);
    if (item) { item.platform = platform; item.label = label; item.href = href; }
  } else {
    footerDraftConfig.social.push({
      id: 'f-soc-' + Date.now(),
      platform, label, href, enabled: true
    });
  }
  closeFooterSocialModal();
  renderFooterSocial();
  showToast('success', 'Social channel updated.');

  recordActivityLog({
    action: editId ? 'layout.footer_edit_social' : 'layout.footer_add_social',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} social channel "${label}" (${platform}) in Footer`,
    target_id: editId || 'footer-soc-new',
    target_name: label,
    details: { platform, label, href }
  });
}

function toggleFooterSocial(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.social || []).find(sc => sc.id === id);
  if (!item) return;
  recordFooterState('Toggle Social Channel');
  item.enabled = (item.enabled === false ? true : false);
  renderFooterSocial();

  recordActivityLog({
    action: 'layout.footer_toggle_social',
    category: 'layout',
    summary: `${item.enabled ? 'Enabled' : 'Disabled'} social channel "${item.label || id}" in Footer`,
    target_id: item.id,
    target_name: item.label,
    details: { id: item.id, enabled: item.enabled }
  });
}

function deleteFooterSocial(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.social || []).find(sc => sc.id === id);
  recordFooterState('Delete Social Channel');
  footerDraftConfig.social = (footerDraftConfig.social || []).filter(sc => sc.id !== id);
  renderFooterSocial();
  showToast('warning', 'Social channel removed.');

  recordActivityLog({
    action: 'layout.footer_delete_social',
    category: 'layout',
    summary: `Deleted social channel "${item?.label || id}" from Footer`,
    target_id: id,
    target_name: item?.label || id,
    details: { id }
  });
}

// ── MODALS: BOTTOM LEGAL LINKS ────────────────────────────────────
function openFooterBottomLinkModal(id) {
  const modal = document.getElementById('modal-footer-bottom-link');
  const title = document.getElementById('modal-ft-bot-title');
  const editId = document.getElementById('ft-bot-edit-id');
  const labelInput = document.getElementById('ft-bot-label-input');
  const hrefInput = document.getElementById('ft-bot-href-input');
  const targetSelect = document.getElementById('ft-bot-target-select');
  if (!modal) return;

  if (id && footerDraftConfig) {
    const item = (footerDraftConfig.bottomLinks || []).find(b => b.id === id);
    if (!item) return;
    title.textContent = 'Edit Legal / Utility Link';
    editId.value = item.id;
    labelInput.value = item.label || '';
    hrefInput.value = item.href || '';
    targetSelect.value = item.target || '_self';
  } else {
    title.textContent = 'Add Legal / Utility Link';
    editId.value = '';
    labelInput.value = '';
    hrefInput.value = '#';
    targetSelect.value = '_self';
  }
  modal.hidden = false;
  setTimeout(() => labelInput.focus(), 60);
}

function closeFooterBottomLinkModal() {
  const modal = document.getElementById('modal-footer-bottom-link');
  if (modal) modal.hidden = true;
}

function saveFooterBottomLinkModal() {
  const editId = document.getElementById('ft-bot-edit-id').value;
  const label = document.getElementById('ft-bot-label-input').value.trim();
  const href = document.getElementById('ft-bot-href-input').value.trim();
  const target = document.getElementById('ft-bot-target-select').value;
  if (!label) { showToast('error', 'Please enter a link label.'); return; }
  if (!href) { showToast('error', 'Please enter a target URL.'); return; }

  recordFooterState(editId ? 'Edit Legal Link' : 'Add Legal Link');
  if (!Array.isArray(footerDraftConfig.bottomLinks)) footerDraftConfig.bottomLinks = [];

  if (editId) {
    const item = footerDraftConfig.bottomLinks.find(b => b.id === editId);
    if (item) { item.label = label; item.href = href; item.target = target; }
  } else {
    footerDraftConfig.bottomLinks.push({
      id: 'f-bot-' + Date.now(),
      label, href, target, enabled: true
    });
  }
  closeFooterBottomLinkModal();
  renderFooterBrand();
  showToast('success', 'Legal link updated.');

  recordActivityLog({
    action: editId ? 'layout.footer_edit_bottom_link' : 'layout.footer_add_bottom_link',
    category: 'layout',
    summary: `${editId ? 'Updated' : 'Added'} legal link "${label}" in Footer`,
    target_id: editId || 'footer-bot-new',
    target_name: label,
    details: { label, href, target }
  });
}

function toggleFooterBottomLink(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.bottomLinks || []).find(b => b.id === id);
  if (!item) return;
  recordFooterState('Toggle Legal Link');
  item.enabled = (item.enabled === false ? true : false);
  renderFooterBrand();

  recordActivityLog({
    action: 'layout.footer_toggle_bottom_link',
    category: 'layout',
    summary: `${item.enabled ? 'Enabled' : 'Disabled'} legal link "${item.label || id}" in Footer`,
    target_id: item.id,
    target_name: item.label,
    details: { id: item.id, enabled: item.enabled }
  });
}

function deleteFooterBottomLink(id) {
  if (!footerDraftConfig) return;
  const item = (footerDraftConfig.bottomLinks || []).find(b => b.id === id);
  recordFooterState('Delete Legal Link');
  footerDraftConfig.bottomLinks = (footerDraftConfig.bottomLinks || []).filter(b => b.id !== id);
  renderFooterBrand();
  showToast('warning', 'Legal link removed.');

  recordActivityLog({
    action: 'layout.footer_delete_bottom_link',
    category: 'layout',
    summary: `Deleted legal link "${item?.label || id}" from Footer`,
    target_id: id,
    target_name: item?.label || id,
    details: { id }
  });
}

// ── SAVE FOOTER TO DATABASE ───────────────────────────────────────
async function saveFooterSettings() {
  if (!footerDraftConfig) return;
  const saveBtn = document.getElementById('ft-save-btn');
  if (saveBtn) saveBtn.disabled = true;
  updateGlobalSyncStatus('syncing', 'Saving to database...');

  let savedOk = false;

  // 1. Try API POST
  try {
    footerDraftConfig.lang = _footerLang;
    const result = await _apiPost('/api/sections?action=footer' + (_footerLang === 'bn' ? '&lang=bn' : ''), footerDraftConfig);
    if (result && (result.ok || result.data)) savedOk = true;
  } catch(err) {}

  // 2. Direct Supabase Fallback (sections table under __footer_config__ or __footer_config_bn__)
  if (!savedOk) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _footerLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
        const { data: existing } = await sb.from('sections').select('id').eq('admin_id', targetAdminId).maybeSingle();
        if (existing) {
          await sb.from('sections').update({
            name: JSON.stringify(footerDraftConfig),
            slug: targetAdminId,
            display_order: 9996,
            is_active: false,
            locked: true,
            is_deleted: true
          }).eq('admin_id', targetAdminId);
        } else {
          await sb.from('sections').insert({
            admin_id: targetAdminId,
            name: JSON.stringify(footerDraftConfig),
            slug: targetAdminId,
            display_order: 9996,
            is_active: false,
            locked: true,
            is_deleted: true
          });
        }
        savedOk = true;
      }
    } catch(e) {}
  }

  appliedFooterConfig = JSON.parse(JSON.stringify(footerDraftConfig));
  footerUndoStack = [];
  footerRedoStack = [];
  updateFooterUndoRedoButtons();
  updateGlobalSyncStatus('synced', 'Synced with database');
  refreshActiveFooterTab();
  showToast('success', 'Footer settings successfully saved & synchronized!');

  recordActivityLog({
    action: 'layout.footer_save',
    category: 'layout',
    summary: `Published Footer layout (${(footerDraftConfig.explore || []).length} Links, ${(footerDraftConfig.series || []).length} Series, ${(footerDraftConfig.social || []).length} Social, ${(footerDraftConfig.bottomLinks || []).length} Legal)`,
    target_id: 'site_footer_config',
    target_name: 'Footer Settings',
    details: {
      exploreCount: (footerDraftConfig.explore || []).length,
      seriesCount: (footerDraftConfig.series || []).length,
      socialCount: (footerDraftConfig.social || []).length,
      bottomLinksCount: (footerDraftConfig.bottomLinks || []).length
    }
  });

  if (saveBtn) saveBtn.disabled = false;
}

// ── GLOBAL MODAL SCROLL LOCK & BACKDROP WATCHER ───────────────────
function syncModalScrollLock() {
  const visibleModal = Array.from(document.querySelectorAll('.modal-overlay')).find(el => {
    return !el.hidden && !el.hasAttribute('hidden') && el.style.display !== 'none';
  });
  if (visibleModal) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

function initGlobalModalListeners() {
  const observer = new MutationObserver(() => {
    syncModalScrollLock();
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    observer.observe(overlay, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });

    // Backdrop click to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.setAttribute('hidden', '');
        overlay.hidden = true;
        syncModalScrollLock();
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalModalListeners);
} else {
  initGlobalModalListeners();
}

// ═════════════════════════════════════════════════════════════════════
// ── ACTIVITY LOG & AUDIT TRAIL ENGINE ─────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

var _allActivityLogs = [];
var _activitySearchDebounceTimer = null;
var _selectedActivityLog = null;

function debounceActivitySearch() {
  if (_activitySearchDebounceTimer) clearTimeout(_activitySearchDebounceTimer);
  _activitySearchDebounceTimer = setTimeout(() => {
    loadActivityLogs();
  }, 260);
}

function formatActivityRelativeTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getActivityCategoryPill(cat) {
  const c = (cat || 'general').toLowerCase();
  const config = {
    auth:     { label: 'AUTH', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },
    admins:   { label: 'ACCESS', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    articles: { label: 'ARTICLE', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    sections: { label: 'SECTION', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
    layout:   { label: 'LAYOUT', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
    settings: { label: 'CONFIG', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
  };
  const item = config[c] || { label: c.toUpperCase(), bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' };
  return `<span style="display:inline-block;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.04em;border-radius:4px;background:${item.bg};color:${item.color};border:1px solid ${item.border};">${item.label}</span>`;
}

async function loadActivityLogs(showToastFeedback = false) {
  const tbody = document.getElementById('activity-table-tbody');
  const loadingEl = document.getElementById('activity-table-loading');
  const emptyEl = document.getElementById('activity-table-empty');
  const catFilter = document.getElementById('activity-filter-category')?.value || 'all';
  const actorFilter = document.getElementById('activity-filter-actor')?.value || '';
  const dateFilter = document.getElementById('activity-filter-date')?.value || 'all';
  const searchVal = (document.getElementById('activity-search-input')?.value || '').trim();

  if (tbody && !tbody.children.length) {
    if (loadingEl) loadingEl.style.display = 'block';
  }
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    const params = new URLSearchParams();
    params.set('action', 'list');
    params.set('limit', '300');
    if (catFilter && catFilter !== 'all') params.set('category', catFilter);
    if (actorFilter) params.set('actor', actorFilter);
    if (searchVal) params.set('search', searchVal);

    let listData = null;
    let statsData = null;
    try {
      [listData, statsData] = await Promise.all([
        _apiGet(`/api/activity-log?${params.toString()}`),
        _apiGet('/api/activity-log?action=stats').catch(() => null)
      ]);
    } catch(e) {}

    let items = (listData && Array.isArray(listData.items)) ? listData.items : (Array.isArray(listData) ? listData : []);

    // Fallback: direct Supabase read from __activity_logs_store__ if items is empty
    if (!items || items.length === 0) {
      try {
        const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
        if (sb) {
          const { data: secRow } = await sb.from('sections').select('name').eq('admin_id', '__activity_logs_store__').maybeSingle();
          if (secRow && secRow.name) {
            const parsed = JSON.parse(secRow.name);
            if (Array.isArray(parsed)) items = parsed;
          }
        }
      } catch(e) {}
    }

    if (loadingEl) loadingEl.style.display = 'none';

    // Filter by date client-side if specified
    if (dateFilter !== 'all') {
      const now = new Date();
      items = items.filter(log => {
        if (!log.timestamp) return true;
        const logDate = new Date(log.timestamp);
        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return logDate >= startOfToday;
        } else if (dateFilter === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return logDate >= sevenDaysAgo;
        } else if (dateFilter === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return logDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    // Filter out routine edits, draft auto-saves, and micro-customizations
    items = items.filter(l => {
      const act = (l.action || '').toLowerCase();
      return act !== 'article.edit' && 
             act !== 'article.save_draft' && 
             act !== 'section.edit' && 
             act !== 'section.customize' &&
             !act.endsWith('.save_draft');
    });

    _allActivityLogs = items;

    // Update Stats
    if (statsData) {
      const statTotal = document.getElementById('stat-total-logs');
      const statToday = document.getElementById('stat-today-logs');
      const statActors = document.getElementById('stat-active-actors');
      if (statTotal) statTotal.textContent = statsData.totalLogs || items.length;
      if (statToday) statToday.textContent = statsData.todayCount !== undefined ? statsData.todayCount : '—';
      if (statActors) statActors.textContent = statsData.uniqueActorsCount !== undefined ? statsData.uniqueActorsCount : '—';
    }

    // Populate Actor Dropdown dynamically
    const actorSelect = document.getElementById('activity-filter-actor');
    if (actorSelect && items.length > 0) {
      const currentVal = actorSelect.value;
      const uniqueActors = new Set();
      items.forEach(it => { if (it.actor_email) uniqueActors.add(it.actor_email); });
      let opts = '<option value="">All Operators</option>';
      uniqueActors.forEach(email => {
        opts += `<option value="${escapeHtml(email)}" ${email === currentVal ? 'selected' : ''}>${escapeHtml(email)}</option>`;
      });
      actorSelect.innerHTML = opts;
    }

    renderActivityLogs(items);

    if (showToastFeedback) {
      showToast('success', 'Activity log stream updated.');
    }
  } catch(err) {
    if (loadingEl) loadingEl.style.display = 'none';
    console.error('[loadActivityLogs error]:', err.message);
    showToast('error', 'Failed to load activity logs: ' + err.message);
  }
}

let _activityCurrentPage = 1;
let _activityPageSize = 25;
let _filteredActivityLogs = [];

function changeActivityPageSize(size) {
  _activityPageSize = parseInt(size, 10) || 25;
  _activityCurrentPage = 1;
  renderActivityPage();
}

function goToActivityPage(page) {
  const totalPages = Math.ceil(_filteredActivityLogs.length / _activityPageSize) || 1;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  _activityCurrentPage = page;
  renderActivityPage();
}

function renderActivityLogs(logs) {
  _filteredActivityLogs = Array.isArray(logs) ? logs : [];
  _activityCurrentPage = 1;
  renderActivityPage();
}

function renderActivityPage() {
  const tbody = document.getElementById('activity-table-tbody');
  const emptyEl = document.getElementById('activity-table-empty');
  const pageInfoEl = document.getElementById('activity-page-info');
  const paginationBtnsEl = document.getElementById('activity-pagination-buttons');
  const paginationWrap = document.getElementById('activity-pagination-wrap');
  if (!tbody) return;

  const total = _filteredActivityLogs.length;

  if (total === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (pageInfoEl) pageInfoEl.textContent = 'Showing 0 of 0 events';
    if (paginationBtnsEl) paginationBtnsEl.innerHTML = '';
    if (paginationWrap) paginationWrap.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (paginationWrap) paginationWrap.style.display = 'flex';

  const totalPages = Math.ceil(total / _activityPageSize) || 1;
  if (_activityCurrentPage > totalPages) _activityCurrentPage = totalPages;
  if (_activityCurrentPage < 1) _activityCurrentPage = 1;

  const startIdx = (_activityCurrentPage - 1) * _activityPageSize;
  const endIdx = Math.min(startIdx + _activityPageSize, total);
  const currentLogs = _filteredActivityLogs.slice(startIdx, endIdx);

  // Update page range info
  if (pageInfoEl) {
    pageInfoEl.textContent = `Showing ${startIdx + 1}–${endIdx} of ${total} events`;
  }

  // Render Table Rows
  tbody.innerHTML = currentLogs.map(log => {
    const actorEmail = log.actor_email || 'system';
    const actorName = log.actor_name || actorEmail;
    const actorRole = log.actor_role || 'Admin';
    const timeFormatted = formatActivityRelativeTime(log.timestamp);
    const fullDate = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '';
    const ip = (log.details && log.details.ip) ? log.details.ip : '—';

    const rolePill = `<span style="font-size:10px;padding:1px 6px;border-radius:10px;font-weight:600;background:${actorRole === 'Admin' ? '#dbeafe' : '#e0e7ff'};color:${actorRole === 'Admin' ? '#1e40af' : '#3730a3'};">${escapeHtml(actorRole)}</span>`;

    // Target link if article or section
    let targetLinkHtml = '';
    if (log.category === 'articles' && log.target_id) {
      targetLinkHtml = ` <a href="admin-article-editor.html?id=${encodeURIComponent(log.target_id)}" target="_blank" style="font-size:11px;color:var(--brand-navy,#0a528e);text-decoration:underline;margin-left:4px;">(Edit Article)</a>`;
    } else if (log.category === 'sections' && log.target_id) {
      targetLinkHtml = ` <a href="/section/${encodeURIComponent(log.target_id)}" target="_blank" style="font-size:11px;color:var(--brand-navy,#0a528e);text-decoration:underline;margin-left:4px;">(View Section)</a>`;
    }

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 16px;vertical-align:middle;font-size:12px;color:var(--text-secondary);" title="${escapeHtml(fullDate)}">
          <div style="font-weight:600;color:var(--text-primary);">${escapeHtml(timeFormatted)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escapeHtml(fullDate.split(',')[0] || '')}</div>
        </td>
        <td style="padding:12px 16px;vertical-align:middle;">
          <div style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <span>${escapeHtml(actorName)}</span>
            ${rolePill}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${escapeHtml(actorEmail)}</div>
        </td>
        <td style="padding:12px 16px;vertical-align:middle;">
          ${getActivityCategoryPill(log.category)}
        </td>
        <td style="padding:12px 16px;vertical-align:middle;">
          <div style="font-weight:500;color:var(--text-primary);line-height:1.4;">
            ${escapeHtml(log.summary || log.action)}
            ${targetLinkHtml}
          </div>
        </td>
        <td style="padding:12px 16px;vertical-align:middle;font-size:11.5px;color:var(--text-muted);font-family:monospace;">
          ${escapeHtml(ip)}
        </td>
        <td style="padding:12px 16px;vertical-align:middle;text-align:right;">
          <button type="button" class="action-btn" title="Inspect Event Details" onclick="openActivityDetails('${log.id}')" style="padding:5px 8px;font-size:12px;display:inline-flex;align-items:center;gap:4px;color:var(--brand-navy,#0a528e);border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Inspect</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Render Pagination Buttons
  if (paginationBtnsEl) {
    if (totalPages <= 1) {
      paginationBtnsEl.innerHTML = '';
      return;
    }

    let btnsHtml = '';
    const btnStyle = (active, disabled) => `
      padding: 4px 10px;
      font-size: 12px;
      font-weight: ${active ? '700' : '500'};
      border: 1px solid ${active ? 'var(--brand-navy,#0a528e)' : '#cbd5e1'};
      background: ${active ? 'var(--brand-navy,#0a528e)' : '#fff'};
      color: ${active ? '#fff' : (disabled ? '#94a3b8' : 'var(--text-primary)')};
      border-radius: 6px;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      opacity: ${disabled ? '0.5' : '1'};
      transition: all 0.15s;
    `;

    // First & Prev Buttons
    btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(1)" ${(_activityCurrentPage === 1) ? 'disabled' : ''} style="${btnStyle(false, _activityCurrentPage === 1)}" title="First Page">«</button>`;
    btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(${_activityCurrentPage - 1})" ${(_activityCurrentPage === 1) ? 'disabled' : ''} style="${btnStyle(false, _activityCurrentPage === 1)}" title="Previous Page">‹</button>`;

    // Page Number Windows
    const maxVisible = 5;
    let startPage = Math.max(1, _activityCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(1)" style="${btnStyle(false, false)}">1</button>`;
      if (startPage > 2) btnsHtml += `<span style="padding:0 4px;color:#94a3b8;">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      const isCurrent = p === _activityCurrentPage;
      btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(${p})" style="${btnStyle(isCurrent, false)}">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) btnsHtml += `<span style="padding:0 4px;color:#94a3b8;">…</span>`;
      btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(${totalPages})" style="${btnStyle(false, false)}">${totalPages}</button>`;
    }

    // Next & Last Buttons
    btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(${_activityCurrentPage + 1})" ${(_activityCurrentPage === totalPages) ? 'disabled' : ''} style="${btnStyle(false, _activityCurrentPage === totalPages)}" title="Next Page">›</button>`;
    btnsHtml += `<button type="button" class="btn-pg" onclick="goToActivityPage(${totalPages})" ${(_activityCurrentPage === totalPages) ? 'disabled' : ''} style="${btnStyle(false, _activityCurrentPage === totalPages)}" title="Last Page">»</button>`;

    paginationBtnsEl.innerHTML = btnsHtml;
  }
}

function openActivityDetails(logId) {
  const log = _allActivityLogs.find(l => String(l.id) === String(logId));
  if (!log) return;
  _selectedActivityLog = log;

  const modal = document.getElementById('modal-activity-details');
  if (!modal) return;

  const titleEl = document.getElementById('act-modal-title');
  const actorEl = document.getElementById('act-modal-actor');
  const emailEl = document.getElementById('act-modal-email');
  const roleEl = document.getElementById('act-modal-role');
  const timeEl = document.getElementById('act-modal-time');
  const ipEl = document.getElementById('act-modal-ip');
  const uaEl = document.getElementById('act-modal-ua');
  const catBadgeEl = document.getElementById('act-modal-cat-badge');
  const sumEl = document.getElementById('act-modal-summary');
  const targetEl = document.getElementById('act-modal-target');
  const jsonEl = document.getElementById('act-modal-json');

  if (titleEl) titleEl.textContent = `Event: ${log.action || 'Activity'}`;
  if (actorEl) actorEl.textContent = log.actor_name || log.actor_email || 'System';
  if (emailEl) emailEl.textContent = log.actor_email || 'system';
  if (roleEl) roleEl.innerHTML = `<span style="font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700;background:#dbeafe;color:#1e40af;">Role: ${escapeHtml(log.actor_role || 'Admin')}</span>`;
  if (timeEl) timeEl.textContent = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '—';
  if (ipEl) ipEl.textContent = `IP: ${(log.details && log.details.ip) || 'Unknown'}`;
  if (uaEl) uaEl.textContent = `UA: ${(log.details && log.details.userAgent) || 'Unknown'}`;
  if (catBadgeEl) catBadgeEl.innerHTML = getActivityCategoryPill(log.category);
  if (sumEl) sumEl.textContent = log.summary || log.action;
  if (targetEl) {
    if (log.target_id || log.target_name) {
      targetEl.textContent = `Target: ${log.target_name || ''} (ID: ${log.target_id || 'N/A'})`;
    } else {
      targetEl.textContent = '';
    }
  }
  if (jsonEl) {
    jsonEl.textContent = JSON.stringify(log, null, 2);
  }

  modal.hidden = false;
}

function closeActivityDetails() {
  const modal = document.getElementById('modal-activity-details');
  if (modal) modal.hidden = true;
  _selectedActivityLog = null;
}

function copyActivityJSON() {
  if (!_selectedActivityLog) return;
  const str = JSON.stringify(_selectedActivityLog, null, 2);
  navigator.clipboard.writeText(str).then(() => {
    showToast('success', 'Event JSON copied to clipboard.');
  }).catch(() => {
    showToast('info', 'Copied.');
  });
}

function exportActivityLogs(format) {
  if (!_allActivityLogs || !_allActivityLogs.length) {
    showToast('error', 'No activity logs available to export.');
    return;
  }

  const dateStamp = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(_allActivityLogs, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `the_privatian_family_activity_log_${dateStamp}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('success', 'Activity logs exported as JSON.');
  } else if (format === 'csv') {
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Category', 'Action', 'Summary', 'Target ID', 'Target Name', 'Client IP'];
    const rows = _allActivityLogs.map(l => [
      `"${String(l.id || '').replace(/"/g, '""')}"`,
      `"${String(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${String(l.actor_name || '').replace(/"/g, '""')}"`,
      `"${String(l.actor_email || '').replace(/"/g, '""')}"`,
      `"${String(l.actor_role || '').replace(/"/g, '""')}"`,
      `"${String(l.category || '').replace(/"/g, '""')}"`,
      `"${String(l.action || '').replace(/"/g, '""')}"`,
      `"${String(l.summary || '').replace(/"/g, '""')}"`,
      `"${String(l.target_id || '').replace(/"/g, '""')}"`,
      `"${String(l.target_name || '').replace(/"/g, '""')}"`,
      `"${String((l.details && l.details.ip) || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', csvContent);
    dlAnchor.setAttribute('download', `the_privatian_family_activity_log_${dateStamp}.csv`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('success', 'Activity logs exported as CSV.');
  }
}

// Window global exports for Activity Log
window.loadActivityLogs = loadActivityLogs;
window.renderActivityLogs = renderActivityLogs;
window.goToActivityPage = goToActivityPage;
window.changeActivityPageSize = changeActivityPageSize;
window.openActivityDetails = openActivityDetails;
window.closeActivityDetails = closeActivityDetails;
window.copyActivityJSON = copyActivityJSON;
window.exportActivityLogs = exportActivityLogs;
window.deleteSectionConfirm = deleteSectionConfirm;
window.permanentDeleteSectionConfirm = permanentDeleteSectionConfirm;

// =================================================================
// CLOUDFLARE R2 MEDIA GALLERY & ASSET MANAGEMENT ENGINE
// =================================================================

var _rawGalleryList = [];
var _galleryFolders = ['Articles', 'Hero Banners', 'Authors', 'Logos & Icons', 'Heritage & Archive'];
var _galleryActiveFolder = 'all'; // 'all', '__root__', or folder name e.g. 'Articles'
var _galleryTargetUploadFolder = '';
var _galleryFilter = 'all';
var _gallerySort = 'newest';
var _galleryProviderFilter = 'all';
var _gallerySearchQuery = '';
var _galleryCurrentInspectorItem = null;
var _galleryPickerCallback = null;
var _galleryPickerSelectedItem = null;
var _galleryPickerActiveFolder = 'all';

// ── 1. Load & Sync Gallery Assets ─────────────────────────────────
async function loadGalleryAssets() {
  const grid = document.getElementById('gallery-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <div class="ft-loading-spinner" style="margin: 0 auto 12px; width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #4f46e5; border-radius: 50%; animation: ftSpin 0.8s linear infinite;"></div>
        <p style="font-size: 13px; font-weight: 600;">Scanning Cloudflare R2 &amp; Database...</p>
      </div>
    `;
  }

  try {
    const data = await _apiGet('/api/media?action=list');
    if (data) {
      if (Array.isArray(data.items)) _rawGalleryList = data.items;
      if (data.folders && Array.isArray(data.folders)) _galleryFolders = data.folders;
      renderGalleryFolders();
      _syncFolderSelectDropdowns();
      _updateGalleryCounts(data.storage, data.syncStatus);
      renderGalleryGrid();
    }
  } catch(e) {
    if (grid) {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          <div class="gallery-empty-icon" style="color:#ef4444;background:#fee2e2;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h3 style="margin:0;font-size:15px;color:var(--text-primary);">Failed to load media library</h3>
          <p style="margin:0;font-size:12.5px;color:var(--text-muted);">${escapeHtml(e.message || 'Check connection')}</p>
          <button class="btn btn--secondary btn--sm" onclick="syncGalleryAssets()" style="margin-top:8px;">Sync with R2 &amp; DB</button>
        </div>
      `;
    }
  }
}

async function syncGalleryAssets() {
  const btn = document.getElementById('gallery-btn-sync-trigger');
  const btnText = document.getElementById('gallery-btn-sync-text');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Syncing R2 & DB...';

  try {
    showToast('info', 'Scanning Cloudflare R2 bucket & synchronizing with Supabase...');
    const data = await _apiPost('/api/media?action=sync', {});
    if (data) {
      if (Array.isArray(data.items)) _rawGalleryList = data.items;
      if (data.folders && Array.isArray(data.folders)) _galleryFolders = data.folders;
      renderGalleryFolders();
      _syncFolderSelectDropdowns();
      _updateGalleryCounts(data.storage, data.syncStatus);
      renderGalleryGrid();
      showToast('success', `Live Sync Complete: ${data.items ? data.items.length : 0} files synchronized directly from Cloudflare R2.`);
    }
  } catch(e) {
    showToast('error', 'Sync failed: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Sync with R2 & DB';
  }
}

// ── 2. Render Gallery Folders Strip (Max 5 items + See All Folders) ──
function renderGalleryFolders() {
  const container = document.getElementById('gallery-folders-list');
  const badge = document.getElementById('gallery-folders-badge');
  if (!container) return;

  const totalFiles = _rawGalleryList.length;
  const rootFiles = _rawGalleryList.filter(x => !x.folder).length;

  if (badge) {
    badge.textContent = `${_galleryFolders.length} ${_galleryFolders.length === 1 ? 'Folder' : 'Folders'}`;
  }

  // 1. All Media Chip
  let html = `
    <div class="gallery-folder-chip ${_galleryActiveFolder === 'all' ? 'active' : ''}" onclick="_setGalleryFolder('all')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <span>All Media</span>
      <span class="gallery-folder-chip-count">${totalFiles}</span>
    </div>
    <div class="gallery-folder-chip ${_galleryActiveFolder === '__root__' ? 'active' : ''}" onclick="_setGalleryFolder('__root__')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <span>Uncategorized</span>
      <span class="gallery-folder-chip-count">${rootFiles}</span>
    </div>
  `;

  // Determine top 3 custom folders to display (Total max 5 items in bar)
  // If active folder is a custom folder and not in first 3, prioritize showing it
  let displayFolders = [];
  const maxCustomChips = 3;
  if (_galleryFolders.length <= maxCustomChips) {
    displayFolders = [..._galleryFolders];
  } else {
    const isCustomActive = _galleryActiveFolder !== 'all' && _galleryActiveFolder !== '__root__' && _galleryFolders.includes(_galleryActiveFolder);
    if (isCustomActive && !_galleryFolders.slice(0, maxCustomChips).includes(_galleryActiveFolder)) {
      displayFolders = [_galleryFolders[0], _galleryFolders[1], _galleryActiveFolder];
    } else {
      displayFolders = _galleryFolders.slice(0, maxCustomChips);
    }
  }

  displayFolders.forEach(folder => {
    const count = _rawGalleryList.filter(x => x.folder === folder).length;
    const isActive = _galleryActiveFolder === folder;
    html += `
      <div class="gallery-folder-chip ${isActive ? 'active' : ''}" onclick="_setGalleryFolder('${escapeHtml(folder)}')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>${escapeHtml(folder)}</span>
        <span class="gallery-folder-chip-count">${count}</span>
        <span class="gallery-folder-chip-actions" onclick="event.stopPropagation();">
          <button type="button" class="gallery-folder-chip-btn" onclick="_openRenameFolderModal('${escapeHtml(folder)}')" title="Rename Folder">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="gallery-folder-chip-btn" onclick="_deleteFolderConfirm('${escapeHtml(folder)}')" title="Delete Folder">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </span>
      </div>
    `;
  });

  // If there are more folders than displayed, show "+X More Folders"
  if (_galleryFolders.length > maxCustomChips) {
    const remainingCount = _galleryFolders.length - displayFolders.length;
    html += `
      <button type="button" class="gallery-folder-chip gallery-folder-chip--more" onclick="openAllFoldersModal()" title="View and manage all ${_galleryFolders.length} folders">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        <span>+${remainingCount} More Folders</span>
      </button>
    `;
  }

  container.innerHTML = html;
}

// ── All Folders Modal Controller ─────────────────────────────────
function openAllFoldersModal() {
  const modal = document.getElementById('modal-all-folders');
  const searchInput = document.getElementById('all-folders-search-input');
  if (searchInput) searchInput.value = '';
  _renderAllFoldersModalList('');
  if (modal) modal.hidden = false;
}

function closeAllFoldersModal() {
  const modal = document.getElementById('modal-all-folders');
  if (modal) modal.hidden = true;
}

function _filterAllFoldersModal(val) {
  _renderAllFoldersModalList(val ? val.trim().toLowerCase() : '');
}

function _renderAllFoldersModalList(query = '') {
  const container = document.getElementById('all-folders-grid-list');
  const footerText = document.getElementById('all-folders-total-footer');
  if (!container) return;

  const totalFiles = _rawGalleryList.length;
  const rootFiles = _rawGalleryList.filter(x => !x.folder).length;

  let filtered = _galleryFolders.filter(f => !query || f.toLowerCase().includes(query));

  if (footerText) {
    footerText.textContent = `Total: ${_galleryFolders.length} Folders (${totalFiles} files)`;
  }

  let html = '';

  // Show All Media and Root cards when not searching or matching
  if (!query || 'all media'.includes(query)) {
    const isAllActive = _galleryActiveFolder === 'all';
    html += `
      <div class="all-folder-card ${isAllActive ? 'active' : ''}" onclick="_selectFolderFromModal('all')">
        <div class="all-folder-card-top">
          <div class="all-folder-card-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <span class="all-folder-card-count">${totalFiles} files</span>
        </div>
        <div class="all-folder-card-name">All Media</div>
        <div class="all-folder-card-actions">
          <button type="button" class="all-folder-card-select-btn">${isAllActive ? 'Current Active' : 'Select Folder'}</button>
        </div>
      </div>
    `;
  }

  if (!query || 'uncategorized'.includes(query) || 'root'.includes(query)) {
    const isRootActive = _galleryActiveFolder === '__root__';
    html += `
      <div class="all-folder-card ${isRootActive ? 'active' : ''}" onclick="_selectFolderFromModal('__root__')">
        <div class="all-folder-card-top">
          <div class="all-folder-card-icon" style="background:#f1f5f9;color:#64748b;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <span class="all-folder-card-count">${rootFiles} files</span>
        </div>
        <div class="all-folder-card-name">Uncategorized</div>
        <div class="all-folder-card-actions">
          <button type="button" class="all-folder-card-select-btn">${isRootActive ? 'Current Active' : 'Select Folder'}</button>
        </div>
      </div>
    `;
  }

  if (filtered.length === 0 && query) {
    html += `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--text-muted);">
        <p style="margin: 0 0 8px 0; font-size: 13px;">No folder matches "${escapeHtml(query)}"</p>
        <button type="button" class="btn btn--secondary btn--sm" onclick="_openNewFolderModal('${escapeHtml(query)}')">Create folder "${escapeHtml(query)}"</button>
      </div>
    `;
  } else {
    filtered.forEach(folder => {
      const count = _rawGalleryList.filter(x => x.folder === folder).length;
      const isActive = _galleryActiveFolder === folder;
      html += `
        <div class="all-folder-card ${isActive ? 'active' : ''}" onclick="_selectFolderFromModal('${escapeHtml(folder)}')">
          <div class="all-folder-card-top">
            <div class="all-folder-card-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span class="all-folder-card-count">${count} ${count === 1 ? 'file' : 'files'}</span>
          </div>
          <div class="all-folder-card-name" title="${escapeHtml(folder)}">${escapeHtml(folder)}</div>
          <div class="all-folder-card-actions" onclick="event.stopPropagation();">
            <button type="button" class="all-folder-card-select-btn" onclick="_selectFolderFromModal('${escapeHtml(folder)}')">
              ${isActive ? 'Active' : 'Select'}
            </button>
            <div class="all-folder-action-btns">
              <button type="button" class="gallery-icon-btn" onclick="_openRenameFolderModal('${escapeHtml(folder)}')" title="Rename Folder">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button type="button" class="gallery-icon-btn danger" onclick="_deleteFolderConfirm('${escapeHtml(folder)}')" title="Delete Folder">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

function _selectFolderFromModal(folderName) {
  closeAllFoldersModal();
  _setGalleryFolder(folderName);
}

function _setGalleryFolder(folder) {
  _galleryActiveFolder = folder;
  if (folder === 'all' || folder === '__root__') {
    _galleryTargetUploadFolder = '';
  } else {
    _galleryTargetUploadFolder = folder;
  }

  const select = document.getElementById('gallery-upload-target-select');
  if (select) select.value = _galleryTargetUploadFolder;

  const sub = document.getElementById('gallery-dropzone-sub');
  if (sub) {
    sub.textContent = _galleryTargetUploadFolder ? 
      `Direct high-speed upload to folder: ${_galleryTargetUploadFolder}` : 
      'Supports JPG, PNG, WebP, AVIF, SVG, GIF. Direct high-speed upload to Cloudflare R2.';
  }

  renderGalleryFolders();
  renderGalleryGrid();
}

function _handleTargetFolderChange(val) {
  _galleryTargetUploadFolder = val || '';
  const sub = document.getElementById('gallery-dropzone-sub');
  if (sub) {
    sub.textContent = _galleryTargetUploadFolder ? 
      `Direct high-speed upload to folder: ${_galleryTargetUploadFolder}` : 
      'Supports JPG, PNG, WebP, AVIF, SVG, GIF. Direct high-speed upload to Cloudflare R2.';
  }
}

function _syncFolderSelectDropdowns() {
  const uploadSelect = document.getElementById('gallery-upload-target-select');
  const inspSelect = document.getElementById('media-insp-folder-select');
  const pickerSelect = document.getElementById('picker-folder-filter');

  let opts = `<option value="">Root / All Media</option>`;
  _galleryFolders.forEach(f => {
    opts += `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`;
  });

  if (uploadSelect) {
    uploadSelect.innerHTML = opts;
    uploadSelect.value = _galleryTargetUploadFolder || '';
  }
  if (inspSelect) {
    inspSelect.innerHTML = `<option value="">Root / Uncategorized</option>` + _galleryFolders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  }
  if (pickerSelect) {
    pickerSelect.innerHTML = `<option value="all">All Folders</option><option value="__root__">Root / Uncategorized</option>` + _galleryFolders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
    pickerSelect.value = _galleryPickerActiveFolder;
  }
}

// ── Universal Media Modal Integration for Gallery Page ────────────
function openGalleryUniversalUpload(targetFolder) {
  const folder = targetFolder !== undefined ? targetFolder : (_galleryActiveFolder !== 'all' && _galleryActiveFolder !== '__root__' ? _galleryActiveFolder : '');
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Universal Media Uploader',
      defaultTab: 'upload',
      targetFolder: folder,
      onSelect: () => {
        if (typeof loadGalleryAssets === 'function') {
          loadGalleryAssets();
        }
      }
    });
  } else {
    const input = document.getElementById('gallery-file-input');
    if (input) input.click();
  }
}
window.openGalleryUniversalUpload = openGalleryUniversalUpload;

// ── Folder Modal Actions ──────────────────────────────────────────
function _openNewFolderModal(presetName = '') {
  const modal = document.getElementById('modal-gallery-folder');
  const title = document.getElementById('gallery-folder-modal-title');
  const modeInp = document.getElementById('gallery-folder-mode');
  const oldNameInp = document.getElementById('gallery-folder-old-name');
  const nameInp = document.getElementById('gallery-folder-name-input');
  const saveBtn = document.getElementById('gallery-folder-save-btn');

  if (title) title.textContent = 'Create New Folder';
  if (modeInp) modeInp.value = 'create';
  if (oldNameInp) oldNameInp.value = '';
  if (nameInp) { nameInp.value = presetName || ''; nameInp.focus(); }
  if (saveBtn) saveBtn.textContent = 'Create Folder';
  if (modal) modal.hidden = false;
}

function _openRenameFolderModal(folderName) {
  const modal = document.getElementById('modal-gallery-folder');
  const title = document.getElementById('gallery-folder-modal-title');
  const modeInp = document.getElementById('gallery-folder-mode');
  const oldNameInp = document.getElementById('gallery-folder-old-name');
  const nameInp = document.getElementById('gallery-folder-name-input');
  const saveBtn = document.getElementById('gallery-folder-save-btn');

  if (title) title.textContent = `Rename Folder: ${folderName}`;
  if (modeInp) modeInp.value = 'rename';
  if (oldNameInp) oldNameInp.value = folderName;
  if (nameInp) { nameInp.value = folderName; nameInp.focus(); }
  if (saveBtn) saveBtn.textContent = 'Save Name';
  if (modal) modal.hidden = false;
}

function _useFolderSuggestion(name) {
  const nameInp = document.getElementById('gallery-folder-name-input');
  if (nameInp) nameInp.value = name;
}

function closeFolderModal() {
  const modal = document.getElementById('modal-gallery-folder');
  if (modal) modal.hidden = true;
}

async function _saveFolderModal() {
  const mode = (document.getElementById('gallery-folder-mode').value || 'create');
  const oldName = (document.getElementById('gallery-folder-old-name').value || '').trim();
  const name = (document.getElementById('gallery-folder-name-input').value || '').trim();
  const saveBtn = document.getElementById('gallery-folder-save-btn');

  if (!name) {
    showToast('error', 'Please enter a valid folder name.');
    return;
  }

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    if (mode === 'create') {
      const res = await _apiPost('/api/media?action=create_folder', { name });
      if (res && res.ok && Array.isArray(res.folders)) {
        _galleryFolders = res.folders;
        _galleryActiveFolder = name;
        _galleryTargetUploadFolder = name;
        showToast('success', `Folder "${name}" created successfully.`);
      }
    } else if (mode === 'rename') {
      const res = await _apiPut('/api/media?action=rename_folder', { oldName, newName: name });
      if (res && res.ok && Array.isArray(res.folders)) {
        _galleryFolders = res.folders;
        if (_galleryActiveFolder === oldName) _galleryActiveFolder = name;
        if (_galleryTargetUploadFolder === oldName) _galleryTargetUploadFolder = name;
        _rawGalleryList.forEach(item => {
          if (item.folder === oldName) item.folder = name;
        });
        showToast('success', `Folder renamed to "${name}".`);
      }
    }

    closeFolderModal();
    renderGalleryFolders();
    _syncFolderSelectDropdowns();
    _renderAllFoldersModalList();
    renderGalleryGrid();
  } catch(err) {
    showToast('error', 'Failed to save folder: ' + err.message);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = mode === 'create' ? 'Create Folder' : 'Save Name'; }
  }
}

function _deleteFolderConfirm(folderName) {
  _confirmModal({
    title: `Delete Folder "${folderName}"`,
    body: `Are you sure you want to delete the folder <strong>${escapeHtml(folderName)}</strong>?<br><div style="margin-top:8px;font-size:12px;color:#1e293b;background:#f1f5f9;border:1px solid #cbd5e1;padding:8px 12px;border-radius:8px;">Images inside this folder will not be deleted; they will be moved to <strong>Root / Uncategorized</strong>.</div>`,
    confirmText: 'Delete Folder',
    variant: 'danger',
    onConfirm: async () => {
      try {
        const res = await _apiDelete(`/api/media?action=delete_folder&name=${encodeURIComponent(folderName)}`);
        if (res && res.ok && Array.isArray(res.folders)) {
          _galleryFolders = res.folders;
          if (_galleryActiveFolder === folderName) _galleryActiveFolder = 'all';
          if (_galleryTargetUploadFolder === folderName) _galleryTargetUploadFolder = '';
          _rawGalleryList.forEach(item => {
            if (item.folder === folderName) item.folder = '';
          });
          renderGalleryFolders();
          _syncFolderSelectDropdowns();
          _renderAllFoldersModalList();
          renderGalleryGrid();
          showToast('success', `Folder "${folderName}" removed.`);
        }
      } catch(e) {
        showToast('error', 'Failed to delete folder: ' + e.message);
      }
    }
  });
}

// ── 3. Update Badge, Analytics & Storage Quota Dashboard ────────
function _updateGalleryCounts(apiStorage = null, syncStatus = null) {
  const badge = document.getElementById('gallery-count-badge');
  const countAll = document.getElementById('gallery-filter-count-all');
  const countPhotos = document.getElementById('gallery-filter-count-photos');
  const countSvg = document.getElementById('gallery-filter-count-svg');
  const countTrash = document.getElementById('gallery-filter-count-trash');
  const footerText = document.getElementById('gallery-total-count-text');

  // KPI elements
  const statTotalCount = document.getElementById('gallery-stat-total-count');
  const statBreakdown = document.getElementById('gallery-stat-files-breakdown');
  const statStorageUsed = document.getElementById('gallery-stat-storage-used');
  const statUsedPct = document.getElementById('gallery-stat-used-pct');
  const statStorageFree = document.getElementById('gallery-stat-storage-free');
  const statFreePct = document.getElementById('gallery-stat-free-pct');
  const statAvgSize = document.getElementById('gallery-stat-avg-size');
  const statLargest = document.getElementById('gallery-stat-largest-file');

  // Quota bar elements
  const quotaUsedText = document.getElementById('gallery-quota-used-text');
  const quotaFreeText = document.getElementById('gallery-quota-free-text');
  const quotaFill = document.getElementById('gallery-quota-fill');
  const quotaPercentText = document.getElementById('gallery-quota-percent-text');

  // Dual Quota elements
  const r2QuotaStats = document.getElementById('gallery-r2-quota-stats');
  const r2QuotaFill = document.getElementById('gallery-r2-quota-fill');
  const b2QuotaStats = document.getElementById('gallery-b2-quota-stats');
  const b2QuotaFill = document.getElementById('gallery-b2-quota-fill');

  // Sync badges
  const r2SyncText = document.getElementById('gallery-sync-r2-text');
  const b2SyncText = document.getElementById('gallery-sync-b2-text');
  const dbSyncText = document.getElementById('gallery-sync-db-text');

  // Separate active and trash
  const activeItems = _rawGalleryList.filter(x => !x.is_deleted);
  const trashItems = _rawGalleryList.filter(x => x.is_deleted);

  const total = _rawGalleryList.length;
  const activeCount = activeItems.length;
  const trashCount = trashItems.length;

  const photos = activeItems.filter(x => !x.mime_type?.includes('svg') && !x.filename?.toLowerCase().endsWith('.svg')).length;
  const svgs = activeItems.filter(x => x.mime_type?.includes('svg') || x.filename?.toLowerCase().endsWith('.svg')).length;

  // Provider breakdown
  const r2Items = _rawGalleryList.filter(x => x.provider === 'r2' || (!x.provider && !x.url?.includes('backblazeb2')));
  const b2Items = _rawGalleryList.filter(x => x.provider === 'b2' || x.url?.includes('backblazeb2'));

  const r2UsedBytes = apiStorage?.r2?.usedBytes ?? r2Items.reduce((acc, cur) => acc + (cur.file_size || 0), 0);
  const b2UsedBytes = apiStorage?.b2?.usedBytes ?? b2Items.reduce((acc, cur) => acc + (cur.file_size || 0), 0);

  const SINGLE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
  const TOTAL_QUOTA_BYTES = 20 * 1024 * 1024 * 1024;  // 20 GB

  const totalBytes = apiStorage?.totalBytes ?? (r2UsedBytes + b2UsedBytes);
  const activeBytes = apiStorage?.activeBytes ?? activeItems.reduce((acc, cur) => acc + (cur.file_size || 0), 0);

  const freeBytes = Math.max(0, TOTAL_QUOTA_BYTES - totalBytes);
  const usedPct = (totalBytes / TOTAL_QUOTA_BYTES) * 100;
  const freePct = Math.max(0, 100 - usedPct);

  const r2UsedPct = (r2UsedBytes / SINGLE_QUOTA_BYTES) * 100;
  const b2UsedPct = (b2UsedBytes / SINGLE_QUOTA_BYTES) * 100;

  const avgBytes = activeCount > 0 ? Math.round(activeBytes / activeCount) : 0;
  const largestBytes = apiStorage?.largestFileSize ?? activeItems.reduce((max, cur) => Math.max(max, cur.file_size || 0), 0);

  // 1. Sync Status Badges
  if (r2SyncText) {
    r2SyncText.textContent = `Cloudflare R2 (${r2Items.length} files • ${_formatFileSize(r2UsedBytes)})`;
  }
  if (b2SyncText) {
    b2SyncText.textContent = `Backblaze B2 (${b2Items.length} files • ${_formatFileSize(b2UsedBytes)})`;
  }
  if (dbSyncText) {
    dbSyncText.textContent = `Database Synced (${_galleryFolders.length} Folders)`;
  }

  // 2. Filter Tabs
  if (countAll) countAll.textContent = activeCount;
  if (countPhotos) countPhotos.textContent = photos;
  if (countSvg) countSvg.textContent = svgs;
  if (countTrash) countTrash.textContent = trashCount;

  // 3. KPI Cards
  if (statTotalCount) statTotalCount.textContent = activeCount;
  if (statBreakdown) statBreakdown.textContent = `${photos} Photos • ${svgs} SVGs • ${r2Items.length} R2 / ${b2Items.length} B2`;
  if (statStorageUsed) statStorageUsed.textContent = _formatFileSize(totalBytes);
  if (statUsedPct) {
    const pctStr = usedPct < 0.01 && totalBytes > 0 ? '< 0.01%' : (usedPct.toFixed(2) + '%');
    statUsedPct.textContent = `${pctStr} of 20 GB Total Free Tier`;
  }
  if (statStorageFree) statStorageFree.textContent = _formatFileSize(freeBytes);
  if (statFreePct) statFreePct.textContent = `${freePct.toFixed(1)}% capacity available`;
  if (statAvgSize) statAvgSize.textContent = activeCount > 0 ? _formatFileSize(avgBytes) : '0 B';
  if (statLargest) statLargest.textContent = largestBytes > 0 ? (`Max: ${_formatFileSize(largestBytes)}`) : 'Max: 0 B';

  // 4. Quota Bars
  if (quotaUsedText) quotaUsedText.textContent = `${_formatFileSize(totalBytes)} / 20.00 GB`;
  if (quotaFreeText) quotaFreeText.textContent = `${_formatFileSize(freeBytes)} Available`;
  if (quotaFill) {
    const fillWidth = Math.min(100, Math.max(totalBytes > 0 ? 0.8 : 0.2, usedPct));
    quotaFill.style.width = fillWidth.toFixed(2) + '%';
  }
  if (quotaPercentText) {
    const pctDisplay = usedPct < 0.01 && totalBytes > 0 ? '< 0.01%' : (usedPct.toFixed(2) + '%');
    quotaPercentText.textContent = `${pctDisplay} total capacity used`;
  }

  // Provider 1: R2 Quota Progress
  if (r2QuotaStats) {
    r2QuotaStats.textContent = `${_formatFileSize(r2UsedBytes)} / 10.00 GB (${r2UsedPct < 0.01 && r2UsedBytes > 0 ? '< 0.01%' : r2UsedPct.toFixed(2) + '%'} used)`;
  }
  if (r2QuotaFill) {
    r2QuotaFill.style.width = Math.min(100, Math.max(r2UsedBytes > 0 ? 0.8 : 0.2, r2UsedPct)).toFixed(2) + '%';
  }

  // Provider 2: B2 Quota Progress
  if (b2QuotaStats) {
    b2QuotaStats.textContent = `${_formatFileSize(b2UsedBytes)} / 10.00 GB (${b2UsedPct < 0.01 && b2UsedBytes > 0 ? '< 0.01%' : b2UsedPct.toFixed(2) + '%'} used)`;
  }
  if (b2QuotaFill) {
    b2QuotaFill.style.width = Math.min(100, Math.max(b2UsedBytes > 0 ? 0.8 : 0.2, b2UsedPct)).toFixed(2) + '%';
  }

  // 5. Footer Bar Summary
  if (footerText) {
    footerText.textContent = `${activeCount} active items (${_formatFileSize(activeBytes)}) across R2 & B2 • ${trashCount} in trash • ${_formatFileSize(freeBytes)} free capacity remaining`;
  }
}

// ── 4. Render Gallery Grid (Fast GPU Accelerated 60FPS) ───────────
function renderGalleryGrid() {
  const grid = document.getElementById('gallery-grid');
  const trashBanner = document.getElementById('gallery-trash-banner');
  const uploadCard = document.getElementById('gallery-upload-zone-wrap');
  const foldersCard = document.querySelector('.gallery-folders-card');
  if (!grid) return;

  const isTrashMode = _galleryFilter === 'trash';

  if (trashBanner) {
    trashBanner.style.display = isTrashMode ? 'flex' : 'none';
  }
  if (uploadCard) {
    uploadCard.style.display = isTrashMode ? 'none' : '';
  }
  if (foldersCard) {
    foldersCard.style.display = isTrashMode ? 'none' : '';
  }

  let filtered = [];
  if (isTrashMode) {
    filtered = _rawGalleryList.filter(x => x.is_deleted);
  } else {
    filtered = _rawGalleryList.filter(x => !x.is_deleted);

    // Filter by storage provider
    if (_galleryProviderFilter === 'r2') {
      filtered = filtered.filter(x => x.provider === 'r2' || (!x.provider && !x.url?.includes('backblazeb2')));
    } else if (_galleryProviderFilter === 'b2') {
      filtered = filtered.filter(x => x.provider === 'b2' || x.url?.includes('backblazeb2'));
    }

    // Filter by media type
    if (_galleryFilter === 'photos') {
      filtered = filtered.filter(x => !x.mime_type?.includes('svg') && !x.filename?.toLowerCase().endsWith('.svg'));
    } else if (_galleryFilter === 'svg') {
      filtered = filtered.filter(x => x.mime_type?.includes('svg') || x.filename?.toLowerCase().endsWith('.svg'));
    }

    // Filter by Active Folder
    if (_galleryActiveFolder === '__root__') {
      filtered = filtered.filter(x => !x.folder);
    } else if (_galleryActiveFolder !== 'all') {
      filtered = filtered.filter(x => x.folder === _galleryActiveFolder);
    }
  }

  // Search query
  if (_gallerySearchQuery) {
    const q = _gallerySearchQuery.toLowerCase();
    filtered = filtered.filter(x => 
      (x.filename && x.filename.toLowerCase().includes(q)) ||
      (x.unique_id && x.unique_id.toLowerCase().includes(q)) ||
      (x.title && x.title.toLowerCase().includes(q)) ||
      (x.folder && x.folder.toLowerCase().includes(q)) ||
      (x.provider && x.provider.toLowerCase().includes(q)) ||
      (x.alt_text && x.alt_text.toLowerCase().includes(q)) ||
      (x.alt_text_bn && x.alt_text_bn.toLowerCase().includes(q)) ||
      (Array.isArray(x.tags) && x.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  // Sort
  if (_gallerySort === 'newest') {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else if (_gallerySort === 'oldest') {
    filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  } else if (_gallerySort === 'largest') {
    filtered.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
  } else if (_gallerySort === 'smallest') {
    filtered.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
  } else if (_gallerySort === 'name') {
    filtered.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
  }

  if (filtered.length === 0) {
    if (isTrashMode) {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          <div class="gallery-empty-icon" style="background:#fee2e2;color:#dc2626;">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </div>
          <h3 style="margin:0;font-size:15px;color:var(--text-primary);">${_gallerySearchQuery ? 'No matching trashed images' : 'Trash Bin is Empty'}</h3>
          <p style="margin:0;font-size:12.5px;color:var(--text-muted);max-width:360px;">${_gallerySearchQuery ? 'No trashed files match your search query.' : 'When you delete images, they are stored here safely. You can restore them anytime or permanently erase them.'}</p>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          <div class="gallery-empty-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <h3 style="margin:0;font-size:15px;color:var(--text-primary);">${_gallerySearchQuery ? 'No matching images found' : (_galleryActiveFolder !== 'all' ? `No images in "${_galleryActiveFolder}" folder` : 'No images uploaded yet')}</h3>
          <p style="margin:0;font-size:12.5px;color:var(--text-muted);max-width:360px;">${_gallerySearchQuery ? 'Try searching for a different keyword, filename, or storage provider.' : 'Drag & drop images into the upload area or click Upload Media to store in Cloudflare R2 or Backblaze B2.'}</p>
          ${!_gallerySearchQuery ? `<button class="btn btn--primary btn--sm" onclick="openGalleryUniversalUpload()" style="margin-top:4px;">Upload to this folder</button>` : ''}
        </div>
      `;
    }
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const ext = (item.filename && item.filename.split('.').pop()) || (item.mime_type ? item.mime_type.split('/').pop() : 'IMG');
    const sizeStr = _formatFileSize(item.file_size);
    const dateStr = _formatShortDate(item.created_at);
    const provider = item.provider || (item.url?.includes('backblazeb2') ? 'b2' : 'r2');
    const provBadge = provider === 'b2'
      ? `<span class="gallery-badge-provider b2" title="Hosted on Backblaze B2 (10 GB Free)">B2</span>`
      : `<span class="gallery-badge-provider r2" title="Hosted on Cloudflare R2 (10 GB Free)">R2</span>`;

    return `
      <div class="gallery-item-card ${item.is_deleted ? 'gallery-item-card--trashed' : ''}" data-id="${item.unique_id}">
        <div class="gallery-thumb-wrap" onclick="openMediaInspector('${item.unique_id}')" title="Click to inspect asset details">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt_text || item.title || item.filename)}" class="gallery-thumb-img" loading="lazy" decoding="async" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>'" />
          <span class="gallery-badge-format">${escapeHtml(ext.toUpperCase())}</span>
          <span class="gallery-badge-size">${sizeStr}</span>
          ${provBadge}
          ${item.is_deleted ? `<span class="gallery-card-trash-badge" title="Trashed"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>In Trash</span>` : (item.folder ? `<span class="gallery-card-folder-badge" title="Folder: ${escapeHtml(item.folder)}"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(item.folder)}</span>` : '')}
        </div>
        <div class="gallery-card-body">
          <div class="gallery-id-row">
            <span class="gallery-id-pill" onclick="_copyUniqueId('${item.unique_id}')" title="Click to copy Unique ID: ${item.unique_id}">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>${item.unique_id}</span>
            </span>
          </div>
          <div class="gallery-card-title" title="${escapeHtml(item.title || item.filename)}">${escapeHtml(item.title || item.filename)}</div>
          <div class="gallery-card-meta">
            <span>${dateStr}</span>
            <div class="gallery-card-actions">
              ${item.is_deleted ? `
                <button type="button" class="gallery-icon-btn success" onclick="_restoreAsset('${item.unique_id}')" title="Restore asset to gallery">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                <button type="button" class="gallery-icon-btn danger" onclick="_deletePermanentConfirm('${item.unique_id}', '${escapeHtml(item.filename || item.unique_id)}')" title="Permanently delete from cloud storage">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              ` : `
                <button type="button" class="gallery-icon-btn" onclick="_copyMediaDirectUrl('${escapeHtml(item.url)}')" title="Copy Public CDN URL">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button type="button" class="gallery-icon-btn" onclick="openMediaInspector('${item.unique_id}')" title="Inspect &amp; Edit Metadata">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
                <button type="button" class="gallery-icon-btn danger" onclick="_trashAssetConfirm('${item.unique_id}', '${escapeHtml(item.filename || item.unique_id)}')" title="Move Asset to Trash">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── 5. File Upload & Drag-and-Drop Pipeline ───────────────────────
function initGalleryUploadDropzone() {
  const dropzone = document.getElementById('gallery-dropzone');
  const fileInput = document.getElementById('gallery-file-input');
  if (!dropzone || !fileInput) return;

  if (!dropzone._hasInit) {
    dropzone._hasInit = true;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length) {
        handleGalleryFilesUpload(files);
      }
    }, false);

    fileInput.addEventListener('change', e => {
      if (fileInput.files && fileInput.files.length) {
        handleGalleryFilesUpload(fileInput.files);
        fileInput.value = '';
      }
    });
  }
}

async function handleGalleryFilesUpload(files) {
  if (!files || !files.length) return;
  const progressList = document.getElementById('gallery-upload-progress-list');
  if (progressList) {
    progressList.style.display = 'flex';
    progressList.innerHTML = '';
  }

  let successCount = 0;
  let errorCount = 0;
  const targetFolder = _galleryTargetUploadFolder || '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const itemId = `upl-${Date.now()}-${i}`;

    // Add progress item UI
    if (progressList) {
      const itemEl = document.createElement('div');
      itemEl.id = itemId;
      itemEl.className = 'gallery-progress-item';
      itemEl.innerHTML = `
        <span style="font-weight:600;min-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file.name)}</span>
        <div class="gallery-progress-bar-wrap">
          <div class="gallery-progress-bar-fill" id="${itemId}-bar" style="width: 30%;"></div>
        </div>
        <span id="${itemId}-status" style="color:var(--brand-navy,#0a528e);font-weight:700;font-size:11px;">Uploading...</span>
      `;
      progressList.appendChild(itemEl);
    }

    try {
      // Read file to base64
      const base64Data = await _readFileAsBase64(file);
      const bar = document.getElementById(`${itemId}-bar`);
      if (bar) bar.style.width = '70%';

      const res = await _apiPost('/api/media?action=upload', {
        fileData: base64Data,
        filename: file.name,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        folder: targetFolder
      });

      if (res && res.ok && res.media) {
        successCount++;
        const statusEl = document.getElementById(`${itemId}-status`);
        const bar = document.getElementById(`${itemId}-bar`);
        if (statusEl) { statusEl.textContent = `Uploaded (${res.media.unique_id})`; statusEl.style.color = '#059669'; }
        if (bar) { bar.style.width = '100%'; bar.style.background = '#10b981'; }
        _rawGalleryList.unshift(res.media);
      } else {
        throw new Error((res && res.error) || 'Upload failed');
      }
    } catch(err) {
      errorCount++;
      const statusEl = document.getElementById(`${itemId}-status`);
      const bar = document.getElementById(`${itemId}-bar`);
      if (statusEl) { statusEl.textContent = 'Failed: ' + (err.message || 'Error'); statusEl.style.color = '#dc2626'; }
      if (bar) { bar.style.width = '100%'; bar.style.background = '#ef4444'; }
    }
  }

  renderGalleryFolders();
  _updateGalleryCounts();
  renderGalleryGrid();

  if (successCount > 0) {
    showToast('success', `Uploaded ${successCount} ${successCount === 1 ? 'image' : 'images'} to Cloudflare R2${targetFolder ? ' in ' + targetFolder : ''}.`);
  }
  if (errorCount > 0) {
    showToast('error', `Failed to upload ${errorCount} ${errorCount === 1 ? 'image' : 'images'}.`);
  }

  setTimeout(() => {
    if (progressList) progressList.style.display = 'none';
  }, 4000);
}

function _readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// ── 6. Toolbar Handlers ──────────────────────────────────────────
function _handleGalleryProviderFilter(val) {
  _galleryProviderFilter = val || 'all';
  renderGalleryGrid();
}
window._handleGalleryProviderFilter = _handleGalleryProviderFilter;

function _setGalleryFilter(filter) {
  _galleryFilter = filter;
  document.querySelectorAll('.gallery-tab-pill').forEach(btn => {
    btn.classList.toggle('active', btn.id === `gallery-filter-${filter}`);
  });
  renderGalleryGrid();
}

var _gallerySearchDebounceTimer = null;
function _handleGallerySearch() {
  const input = document.getElementById('gallery-search-input');
  const clearBtn = document.getElementById('gallery-search-clear');
  _gallerySearchQuery = (input ? input.value : '').trim();
  if (clearBtn) clearBtn.style.display = _gallerySearchQuery ? 'block' : 'none';
  clearTimeout(_gallerySearchDebounceTimer);
  _gallerySearchDebounceTimer = setTimeout(() => {
    renderGalleryGrid();
  }, 120);
}

function _clearGallerySearch() {
  const input = document.getElementById('gallery-search-input');
  const clearBtn = document.getElementById('gallery-search-clear');
  if (input) input.value = '';
  _gallerySearchQuery = '';
  if (clearBtn) clearBtn.style.display = 'none';
  clearTimeout(_gallerySearchDebounceTimer);
  renderGalleryGrid();
}

function _handleGallerySort() {
  const select = document.getElementById('gallery-sort-select');
  if (select) _gallerySort = select.value;
  renderGalleryGrid();
}

// ── 7. Copy Helpers ──────────────────────────────────────────────
function _copyUniqueId(uniqueId) {
  if (!uniqueId) return;
  navigator.clipboard.writeText(uniqueId).then(() => {
    showToast('success', `Copied ID: ${uniqueId}`);
  }).catch(() => {
    showToast('info', `ID: ${uniqueId}`);
  });
}

function _copyMediaDirectUrl(url) {
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    showToast('success', 'Public CDN URL copied to clipboard.');
  }).catch(() => {
    showToast('info', 'URL: ' + url);
  });
}

// ── 8. Media Inspector Modal ─────────────────────────────────────
function openMediaInspector(uniqueId) {
  const item = _rawGalleryList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
  if (!item) return;
  _galleryCurrentInspectorItem = item;

  const modal = document.getElementById('modal-media-inspector');
  if (!modal) return;

  const imgEl = document.getElementById('media-insp-img');
  const filenameEl = document.getElementById('media-insp-filename');
  const fmtBadge = document.getElementById('media-insp-fmt-badge');
  const uniqueIdEl = document.getElementById('media-insp-unique-id');
  const sizeEl = document.getElementById('media-insp-size');
  const dateEl = document.getElementById('media-insp-date');
  const urlInp = document.getElementById('media-insp-direct-url-input');
  const titleInp = document.getElementById('media-insp-title-input');
  const folderSelect = document.getElementById('media-insp-folder-select');
  const altInp = document.getElementById('media-insp-alt-input');
  const altBnInp = document.getElementById('media-insp-alt-bn-input');
  const currIdInp = document.getElementById('media-insp-current-id');

  const subEl = document.getElementById('media-insp-meta-sub');
  const provEl = document.getElementById('media-insp-provider');
  const provider = item.provider || (item.url?.includes('backblazeb2') ? 'b2' : 'r2');

  if (imgEl) imgEl.src = item.url;
  if (filenameEl) filenameEl.textContent = item.filename || item.unique_id;
  const ext = (item.filename && item.filename.split('.').pop()) || 'IMG';
  if (fmtBadge) fmtBadge.textContent = ext.toUpperCase();
  if (uniqueIdEl) uniqueIdEl.textContent = item.unique_id;
  if (sizeEl) sizeEl.textContent = _formatFileSize(item.file_size);
  if (dateEl) dateEl.textContent = _formatLongDate(item.created_at);
  if (urlInp) urlInp.value = item.url;
  if (titleInp) titleInp.value = item.title || '';
  if (folderSelect) folderSelect.value = item.folder || '';
  if (altInp) altInp.value = item.alt_text || '';
  if (altBnInp) altBnInp.value = item.alt_text_bn || '';
  if (currIdInp) currIdInp.value = item.unique_id;

  if (subEl) {
    subEl.textContent = provider === 'b2' ? 'Backblaze B2 Cloud Asset' : 'Cloudflare R2 Cloud Asset';
  }
  if (provEl) {
    provEl.innerHTML = provider === 'b2'
      ? '<span style="color:#e11d48;font-weight:800;">🔴 Backblaze B2 (10 GB)</span>'
      : '<span style="color:#ea580c;font-weight:800;">🟠 Cloudflare R2 (10 GB)</span>';
  }

  // Inspector footer action buttons depending on trash state
  const footerEl = modal.querySelector('.modal-footer');
  if (footerEl) {
    if (item.is_deleted) {
      footerEl.innerHTML = `
        <button type="button" class="btn btn--ghost" style="color:#dc2626;" onclick="_deletePermanentConfirm('${item.unique_id}', '${escapeHtml(item.filename || item.unique_id)}')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          <span>Delete Permanently</span>
        </button>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--ghost" type="button" onclick="closeMediaInspector()">Close</button>
          <button class="btn btn--primary" type="button" onclick="_restoreAsset('${item.unique_id}')" style="background:#10b981;border-color:#10b981;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Restore Asset
          </button>
        </div>
      `;
    } else {
      footerEl.innerHTML = `
        <button type="button" class="btn btn--ghost" style="color:#dc2626;" onclick="_deleteInspectorMedia()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          <span>Move to Trash</span>
        </button>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--ghost" type="button" onclick="closeMediaInspector()">Close</button>
          <button class="btn btn--primary" type="button" id="media-insp-save-btn" onclick="_saveInspectorMetadata()">Save Metadata</button>
        </div>
      `;
    }
  }

  modal.hidden = false;
}

function closeMediaInspector() {
  const modal = document.getElementById('modal-media-inspector');
  if (modal) modal.hidden = true;
  _galleryCurrentInspectorItem = null;
}

function _copyInspectorUniqueId() {
  if (_galleryCurrentInspectorItem) _copyUniqueId(_galleryCurrentInspectorItem.unique_id);
}

function _copyInspectorDirectUrl() {
  if (_galleryCurrentInspectorItem) _copyMediaDirectUrl(_galleryCurrentInspectorItem.url);
}

function _copyInspectorMarkdown() {
  if (!_galleryCurrentInspectorItem) return;
  const alt = _galleryCurrentInspectorItem.alt_text || _galleryCurrentInspectorItem.title || 'Image';
  const md = `![${alt}](${_galleryCurrentInspectorItem.url})`;
  navigator.clipboard.writeText(md).then(() => {
    showToast('success', 'Markdown snippet copied to clipboard.');
  });
}

async function _saveInspectorMetadata() {
  if (!_galleryCurrentInspectorItem) return;
  const btn = document.getElementById('media-insp-save-btn');
  const title = (document.getElementById('media-insp-title-input').value || '').trim();
  const folder = (document.getElementById('media-insp-folder-select').value || '').trim();
  const altText = (document.getElementById('media-insp-alt-input').value || '').trim();
  const altTextBn = (document.getElementById('media-insp-alt-bn-input').value || '').trim();

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const res = await _apiPut(`/api/media?action=update&id=${encodeURIComponent(_galleryCurrentInspectorItem.unique_id)}`, {
      title,
      folder,
      alt_text: altText,
      alt_text_bn: altTextBn
    });

    if (res && res.ok && res.media) {
      _galleryCurrentInspectorItem.title = title;
      _galleryCurrentInspectorItem.folder = folder;
      _galleryCurrentInspectorItem.alt_text = altText;
      _galleryCurrentInspectorItem.alt_text_bn = altTextBn;
      const idx = _rawGalleryList.findIndex(x => x.unique_id === _galleryCurrentInspectorItem.unique_id);
      if (idx !== -1) _rawGalleryList[idx] = { ..._rawGalleryList[idx], ...res.media };
      renderGalleryFolders();
      renderGalleryGrid();
      showToast('success', 'Metadata saved successfully.');
    }
  } catch(e) {
    showToast('error', 'Failed to update metadata: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Metadata'; }
  }
}

function _deleteInspectorMedia() {
  if (!_galleryCurrentInspectorItem) return;
  const item = _galleryCurrentInspectorItem;
  closeMediaInspector();
  _trashAssetConfirm(item.unique_id, item.filename || item.unique_id);
}

// ── 9. Trash & Deletion Confirmations ─────────────────────────────
function _trashAssetConfirm(uniqueId, filename) {
  _confirmModal({
    title: 'Move Asset to Trash',
    body: `Are you sure you want to move <strong>${escapeHtml(filename)}</strong> (<code style="color:#4f46e5;">${uniqueId}</code>) to the <strong>Trash Bin</strong>?<br><div style="margin-top:8px;font-size:12px;color:#1e293b;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:8px;">The file remains safely in Cloudflare R2 and can be restored at any time from the Trash Bin tab.</div>`,
    confirmText: 'Move to Trash',
    variant: 'danger',
    onConfirm: async () => {
      try {
        const res = await _apiDelete(`/api/media?action=trash&id=${encodeURIComponent(uniqueId)}`);
        if (res && res.ok) {
          const item = _rawGalleryList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
          if (item) {
            item.is_deleted = true;
            item.deleted_at = new Date().toISOString();
          }
          renderGalleryFolders();
          _updateGalleryCounts();
          renderGalleryGrid();
          showToast('success', `Moved "${filename}" to Trash Bin.`);
        }
      } catch(e) {
        showToast('error', 'Failed to move to trash: ' + e.message);
      }
    }
  });
}

async function _restoreAsset(uniqueId) {
  try {
    const res = await _apiPost(`/api/media?action=restore&id=${encodeURIComponent(uniqueId)}`);
    if (res && res.ok) {
      const item = _rawGalleryList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
      if (item) {
        item.is_deleted = false;
        item.deleted_at = null;
      }
      if (_galleryCurrentInspectorItem && _galleryCurrentInspectorItem.unique_id === uniqueId) {
        closeMediaInspector();
      }
      renderGalleryFolders();
      _updateGalleryCounts();
      renderGalleryGrid();
      showToast('success', 'Asset restored to active gallery.');
    }
  } catch(e) {
    showToast('error', 'Failed to restore asset: ' + e.message);
  }
}

function _deletePermanentConfirm(uniqueId, filename) {
  _confirmModal({
    title: 'Permanently Erase from Cloudflare R2',
    body: `Permanently erase <strong>${escapeHtml(filename)}</strong> (<code style="color:#dc2626;">${uniqueId}</code>) from your Cloudflare R2 bucket?<br><div style="margin-top:8px;font-size:12px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:8px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><strong>Irreversible Action:</strong> This file will be permanently deleted from Cloudflare R2 and CDN. This action cannot be recovered.</div>`,
    confirmText: 'Permanently Delete',
    variant: 'danger',
    onConfirm: async () => {
      try {
        const res = await _apiDelete(`/api/media?action=delete_permanent&id=${encodeURIComponent(uniqueId)}`);
        if (res && res.ok) {
          _rawGalleryList = _rawGalleryList.filter(x => x.unique_id !== uniqueId && x.id !== uniqueId);
          if (_galleryCurrentInspectorItem && _galleryCurrentInspectorItem.unique_id === uniqueId) {
            closeMediaInspector();
          }
          renderGalleryFolders();
          _updateGalleryCounts();
          renderGalleryGrid();
          showToast('success', `Permanently erased "${filename}" from Cloudflare R2.`);
        }
      } catch(e) {
        showToast('error', 'Failed to delete asset: ' + e.message);
      }
    }
  });
}

function _emptyTrashConfirm() {
  const trashCount = _rawGalleryList.filter(x => x.is_deleted).length;
  if (trashCount === 0) {
    showToast('info', 'Trash Bin is already empty.');
    return;
  }
  _confirmModal({
    title: `Empty Trash Bin (${trashCount} ${trashCount === 1 ? 'item' : 'items'})`,
    body: `Are you sure you want to permanently erase all <strong>${trashCount}</strong> trashed items from your Cloudflare R2 bucket?<br><div style="margin-top:8px;font-size:12px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:8px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><strong>Irreversible Action:</strong> All trashed images will be permanently erased from Cloudflare R2. This action cannot be recovered.</div>`,
    confirmText: 'Empty Trash Now',
    variant: 'danger',
    onConfirm: async () => {
      try {
        const res = await _apiPost('/api/media?action=empty_trash');
        if (res && res.ok) {
          _rawGalleryList = _rawGalleryList.filter(x => !x.is_deleted);
          renderGalleryFolders();
          _updateGalleryCounts();
          renderGalleryGrid();
          showToast('success', `Emptied Trash (${res.deletedCount || trashCount} items permanently erased).`);
        }
      } catch(e) {
        showToast('error', 'Failed to empty trash: ' + e.message);
      }
    }
  });
}

// ── 10. Universal Gallery Picker Modal (for Articles / Sections) ───
function openGalleryPicker(callback) {
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal(callback);
    return;
  }
  _galleryPickerCallback = callback;
  _galleryPickerSelectedItem = null;
  _galleryPickerActiveFolder = 'all';

  const modal = document.getElementById('modal-gallery-picker');
  const confirmBtn = document.getElementById('picker-confirm-btn');
  const summaryEl = document.getElementById('picker-selected-summary');
  const folderFilter = document.getElementById('picker-folder-filter');

  if (confirmBtn) confirmBtn.disabled = true;
  if (summaryEl) summaryEl.textContent = 'No image selected';
  if (folderFilter) folderFilter.value = 'all';

  if (modal) modal.hidden = false;

  if (!_rawGalleryList || !_rawGalleryList.length) {
    loadGalleryAssets().then(() => _renderPickerGrid());
  } else {
    _syncFolderSelectDropdowns();
    _renderPickerGrid();
  }
}

function closeGalleryPicker() {
  if (typeof window.closeUniversalMediaModal === 'function') {
    window.closeUniversalMediaModal();
    return;
  }
  const modal = document.getElementById('modal-gallery-picker');
  if (modal) modal.hidden = true;
  _galleryPickerCallback = null;
  _galleryPickerSelectedItem = null;
}

function _handlePickerFolderFilter(folderVal) {
  _galleryPickerActiveFolder = folderVal || 'all';
  const searchInp = document.getElementById('picker-search-input');
  _renderPickerGrid(searchInp ? searchInp.value.trim() : '');
}

function _renderPickerGrid(searchQuery = '') {
  const grid = document.getElementById('picker-gallery-grid');
  if (!grid) return;

  let items = _rawGalleryList.filter(x => !x.is_deleted);

  // Filter by folder
  if (_galleryPickerActiveFolder === '__root__') {
    items = items.filter(x => !x.folder);
  } else if (_galleryPickerActiveFolder !== 'all') {
    items = items.filter(x => x.folder === _galleryPickerActiveFolder);
  }

  // Filter by search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter(x => 
      (x.filename && x.filename.toLowerCase().includes(q)) ||
      (x.title && x.title.toLowerCase().includes(q)) ||
      (x.unique_id && x.unique_id.toLowerCase().includes(q)) ||
      (x.folder && x.folder.toLowerCase().includes(q))
    );
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:32px 14px;color:var(--text-muted);">
        <p style="margin:0;font-size:13px;">No images found in this folder.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const isSel = _galleryPickerSelectedItem && (_galleryPickerSelectedItem.unique_id === item.unique_id);
    return `
      <div class="picker-item-card ${isSel ? 'selected' : ''}" onclick="_selectGalleryPickerItem('${item.unique_id}')" ondblclick="_confirmGalleryPickerSelection()" title="${escapeHtml(item.title || item.filename)}">
        <img src="${escapeHtml(item.url)}" alt="" class="picker-item-thumb" loading="lazy" decoding="async" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2364748b\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg>'" />
        <div class="picker-item-name">${escapeHtml(item.title || item.filename)}</div>
        ${item.folder ? `<span style="position:absolute;top:6px;left:6px;font-size:9.5px;font-weight:600;background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);color:#fff;padding:2px 6px;border-radius:4px;display:inline-flex;align-items:center;gap:3px;"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(item.folder)}</span>` : ''}
        <div class="picker-item-check">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
    `;
  }).join('');
}

var _pickerSearchDebounce = null;
function _handlePickerSearch() {
  clearTimeout(_pickerSearchDebounce);
  _pickerSearchDebounce = setTimeout(() => {
    const input = document.getElementById('picker-search-input');
    _renderPickerGrid(input ? input.value.trim() : '');
  }, 120);
}

function _selectGalleryPickerItem(uniqueId) {
  const item = _rawGalleryList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
  if (!item) return;
  _galleryPickerSelectedItem = item;

  const confirmBtn = document.getElementById('picker-confirm-btn');
  const summaryEl = document.getElementById('picker-selected-summary');
  if (confirmBtn) confirmBtn.disabled = false;
  if (summaryEl) {
    summaryEl.innerHTML = `Selected: <strong>${escapeHtml(item.title || item.filename)}</strong> (<code style="color:#4f46e5;">${item.unique_id}</code>)`;
  }

  // Highlight selected card
  document.querySelectorAll('.picker-item-card').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('title') === (item.title || item.filename));
  });
}

function _confirmGalleryPickerSelection() {
  if (!_galleryPickerSelectedItem || !_galleryPickerCallback) return;
  try {
    _galleryPickerCallback({
      url: _galleryPickerSelectedItem.url,
      uniqueId: _galleryPickerSelectedItem.unique_id,
      title: _galleryPickerSelectedItem.title || '',
      altText: _galleryPickerSelectedItem.alt_text || '',
      altTextBn: _galleryPickerSelectedItem.alt_text_bn || ''
    });
  } catch(e) {}
  closeGalleryPicker();
}

async function _handlePickerQuickUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const targetFolder = _galleryPickerActiveFolder !== 'all' && _galleryPickerActiveFolder !== '__root__' ? _galleryPickerActiveFolder : '';

  try {
    showToast('info', 'Uploading to Cloudflare R2...');
    const base64 = await _readFileAsBase64(file);
    const res = await _apiPost('/api/media?action=upload', {
      fileData: base64,
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      fileSize: file.size,
      folder: targetFolder
    });

    if (res && res.ok && res.media) {
      _rawGalleryList.unshift(res.media);
      renderGalleryFolders();
      _updateGalleryCounts();
      _renderPickerGrid();
      _selectGalleryPickerItem(res.media.unique_id);
      showToast('success', 'Image uploaded to R2 and selected.');
    }
  } catch(err) {
    showToast('error', 'Upload failed: ' + err.message);
  }
}

// ── 10. Formatting Helpers ─────────────────────────────────────────
function _formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const val = bytes / Math.pow(k, i);
  return (val >= 100 || i === 0 ? val.toFixed(0) : val.toFixed(2)) + ' ' + sizes[i];
}

function _formatShortDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch(e) { return '—'; }
}

function _formatLongDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch(e) { return '—'; }
}

// Window global exports for Gallery & Folders
window.loadGalleryAssets = loadGalleryAssets;
window.syncGalleryAssets = syncGalleryAssets;
window.initGalleryUploadDropzone = initGalleryUploadDropzone;
window._setGalleryFolder = _setGalleryFolder;
window._handleTargetFolderChange = _handleTargetFolderChange;
window._openNewFolderModal = _openNewFolderModal;
window._openRenameFolderModal = _openRenameFolderModal;
window._useFolderSuggestion = _useFolderSuggestion;
window.closeFolderModal = closeFolderModal;
window._saveFolderModal = _saveFolderModal;
window._deleteFolderConfirm = _deleteFolderConfirm;
window._setGalleryFilter = _setGalleryFilter;
window._handleGallerySearch = _handleGallerySearch;
window._clearGallerySearch = _clearGallerySearch;
window._handleGallerySort = _handleGallerySort;
window._copyUniqueId = _copyUniqueId;
window._copyMediaDirectUrl = _copyMediaDirectUrl;
window.openMediaInspector = openMediaInspector;
window.closeMediaInspector = closeMediaInspector;
window._copyInspectorUniqueId = _copyInspectorUniqueId;
window._copyInspectorDirectUrl = _copyInspectorDirectUrl;
window._copyInspectorMarkdown = _copyInspectorMarkdown;
window._saveInspectorMetadata = _saveInspectorMetadata;
window._deleteInspectorMedia = _deleteInspectorMedia;
window.deleteMediaConfirm = function(id) { if (typeof _deleteInspectorMedia === 'function') _deleteInspectorMedia(id); };
window.openGalleryPicker = openGalleryPicker;
window.closeGalleryPicker = closeGalleryPicker;
window._handlePickerFolderFilter = _handlePickerFolderFilter;
window._handlePickerSearch = _handlePickerSearch;
window._selectGalleryPickerItem = _selectGalleryPickerItem;
window._confirmGalleryPickerSelection = _confirmGalleryPickerSelection;
window._handlePickerQuickUpload = _handlePickerQuickUpload;

/* ═══════════════════════════════════════════════════════════════
   ADMIN SETTINGS & EMAIL STUDIO ENGINE
═══════════════════════════════════════════════════════════════ */

let _emailSettings = {
  smtp_sender_name: 'The Privatian Family',
  smtp_admin_email: 'theprivatianfamilybd@gmail.com',
  mailer_otp_exp: 3600,
  mailer_otp_length: 6,
  mailer_subjects_magic_link: 'Your 6-Digit Admin Verification Code (OTP) - The Privatian Family',
  mailer_templates_magic_link_content: '',
  mailer_subjects_invite: 'You have been invited to The Privatian Family',
  mailer_templates_invite_content: '',
  mailer_subjects_recovery: 'Reset Password - The Privatian Family',
  mailer_templates_recovery_content: ''
};

let _currentEmailMode = 'visual';

const DEFAULT_EMAIL_LOGO_URL = 'https://pub-1e6b79ea34c74adfa8dc145a3b5a4e5a.r2.dev/gallery/2026/08/img_jms7zxw4_the-privatian-family-logo-white-cropped.svg';

function resolveEmailLogoUrl(val) {
  if (!val) return DEFAULT_EMAIL_LOGO_URL;
  const str = String(val).trim();
  if (str === 'img_jms7zxw4' || str.includes('jms7zxw4')) {
    return DEFAULT_EMAIL_LOGO_URL;
  }
  if (str === 'img_zqfa3rwk' || str.includes('zqfa3rwk')) {
    return 'https://pub-1e6b79ea34c74adfa8dc145a3b5a4e5a.r2.dev/gallery/2026/08/img_zqfa3rwk_the-privatian-family-5125-x-2888-px-white.png';
  }
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
    return str;
  }
  if (Array.isArray(window._rawGalleryList) && window._rawGalleryList.length > 0) {
    const found = window._rawGalleryList.find(x => x.id === str || x.unique_id === str);
    if (found && found.url) return found.url;
  }
  return str;
}

function updateLogoThumbnail(logoUrl, name) {
  const thumb = document.getElementById('ev-logo-thumb-img');
  if (thumb && logoUrl) thumb.src = logoUrl;
  const nameEl = document.getElementById('ev-logo-name-display');
  if (nameEl) {
    if (name) {
      nameEl.textContent = name;
    } else if (logoUrl.includes('jms7zxw4')) {
      nameEl.textContent = 'The Privatian Family Logo (SVG)';
    } else if (logoUrl.includes('zqfa3rwk')) {
      nameEl.textContent = 'The Privatian Family White Logo (PNG)';
    } else {
      const parts = logoUrl.split('/');
      nameEl.textContent = parts[parts.length - 1] || 'Custom Brand Logo';
    }
  }
}

window.openEmailLogoPicker = function(options = {}) {
  if (typeof window.openUniversalMediaModal === 'function') {
    window.openUniversalMediaModal({
      title: 'Upload or Select Brand Logo',
      subtitle: 'Upload your SVG / PNG logo from device or select from Cloudflare R2 library',
      defaultTab: options.defaultTab || 'upload',
      allowIdInput: true,
      targetFolder: 'Logos & Icons',
      onSelect: item => {
        const logoUrl = (item && item.url) || '';
        const logoVal = (item && (item.unique_id || item.id || item.url)) || '';
        if (!logoVal && !logoUrl) return;
        const inp = document.getElementById('ev-logo-url');
        if (inp) inp.value = logoVal;
        updateLogoThumbnail(logoUrl || resolveEmailLogoUrl(logoVal), item.title || item.filename);
        syncVisualToHtml();
        showToast('success', 'Brand logo updated in template preview.');
      }
    });
  } else {
    showToast('error', 'Universal Media Modal is loading, please try again.');
  }
};

window.onEmailLogoHeightInput = function(val) {
  const num = parseInt(val, 10) || 50;
  const valEl = document.getElementById('ev-logo-height-val');
  if (valEl) valEl.textContent = num;
  syncVisualToHtml();
};

window.resetEmailLogoToDefault = function() {
  const inp = document.getElementById('ev-logo-url');
  if (inp) inp.value = 'img_jms7zxw4';
  const slider = document.getElementById('ev-logo-height');
  if (slider) slider.value = 50;
  const valEl = document.getElementById('ev-logo-height-val');
  if (valEl) valEl.textContent = 50;
  updateLogoThumbnail(DEFAULT_EMAIL_LOGO_URL, 'The Privatian Family Logo (SVG)');
  syncVisualToHtml();
  showToast('info', 'Reset brand logo to default SVG.');
};

const DEFAULT_MAGIC_LINK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(10,37,64,0.06);">
          
          <!-- Top Brand Header Banner (Deep Royal Navy Blue) -->
          <tr>
            <td align="center" style="background-color:#0a2540;padding:28px 24px 20px;border-bottom:3px solid #1e3a8a;user-select:none;-webkit-user-select:none;" oncontextmenu="return false;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;user-select:none;-webkit-user-select:none;" oncontextmenu="return false;">
                <tr>
                  <td align="center" style="user-select:none;-webkit-user-select:none;pointer-events:none;" oncontextmenu="return false;">
                    <div style="pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;display:inline-block;" oncontextmenu="return false;">
                      <img src="${DEFAULT_EMAIL_LOGO_URL}" alt="The Privatian Family" height="50" draggable="false" oncontextmenu="return false;" style="display:block;height:50px;max-height:50px;width:auto;margin:0 auto;border:0;outline:none;text-decoration:none;pointer-events:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;" />
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;letter-spacing:0.09em;text-transform:uppercase;color:#93c5fd;margin-top:8px;font-weight:600;line-height:1.2;pointer-events:none;user-select:none;-webkit-user-select:none;">
                      Administrative Portal &bull; Verification
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding:34px 32px 28px;background-color:#ffffff;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0a2540;line-height:1.3;margin-bottom:12px;">
                Your Login Verification Code
              </div>
              <div style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px;">
                Enter the single-use 6-digit verification code below in the administrator sign-in form to authenticate your session:
              </div>

              <!-- OTP Code Display Card -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:#f0f7ff;border:2px solid #bfdbfe;border-radius:10px;padding:22px 20px;">
                    <div style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,monospace,Consolas;font-size:38px;font-weight:800;letter-spacing:12px;color:#0a2540;line-height:1;margin:0 0 8px;padding-left:12px;">
                      {{ .Token }}
                    </div>
                    <div style="font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
                      Single-Use Security Passcode
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Information Note -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;padding:12px 16px;margin-bottom:8px;">
                <tr>
                  <td style="font-size:12.5px;color:#475569;line-height:1.5;">
                    <strong style="color:#0a2540;">Security Notice:</strong> This passcode will expire in <strong>1 hour</strong>. Never share this code with anyone. If you did not request this login attempt, no further action is required.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtle Footer & Sign-off -->
          <tr>
            <td align="center" style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 24px;">
              <div style="font-size:12px;color:#64748b;font-weight:600;line-height:1.4;">
                The Official Publication of The Privatian Society
              </div>
              <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">
                Dhaka, Bangladesh &bull; All Rights Reserved
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function initSettingsPage() {
  try {
    const res = await fetch('/api/email-settings?action=get', {
      headers: _authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      _emailSettings = { ..._emailSettings, ...data };
      if (!_emailSettings.mailer_templates_magic_link_content) {
        _emailSettings.mailer_templates_magic_link_content = DEFAULT_MAGIC_LINK_HTML;
      }
    }
  } catch(e) {}

  const subj = _emailSettings.mailer_subjects_magic_link || 'Your 6-Digit Admin Verification Code (OTP) — The Privatian Family';
  const sender = _emailSettings.smtp_sender_name || 'The Privatian Family';
  const exp = String(_emailSettings.mailer_otp_exp || 3600);
  const html = _emailSettings.mailer_templates_magic_link_content || DEFAULT_MAGIC_LINK_HTML;

  const subjInp = document.getElementById('email-subject-input');
  if (subjInp) subjInp.value = subj;

  const senderInp = document.getElementById('email-sender-name-input');
  if (senderInp) senderInp.value = sender;

  const expInp = document.getElementById('email-otp-exp-input');
  if (expInp) expInp.value = exp;

  const htmlArea = document.getElementById('email-html-textarea');
  if (htmlArea) htmlArea.value = html;

  parseHtmlToVisualFields(html);
  updateEmailPreview();
}

function parseHtmlToVisualFields(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Logo & Height
    const imgEl = doc.querySelector('td[style*="background-color:#0a2540"] img') || doc.querySelector('img[alt*="Privatian"]');
    if (imgEl) {
      const src = imgEl.getAttribute('src') || '';
      if (document.getElementById('ev-logo-url')) {
        document.getElementById('ev-logo-url').value = src.includes('jms7zxw4') ? 'img_jms7zxw4' : (src.includes('zqfa3rwk') ? 'img_zqfa3rwk' : src);
      }
      const hAttr = imgEl.getAttribute('height');
      const hStyle = imgEl.style && imgEl.style.height;
      const h = parseInt(hAttr || hStyle || 50, 10);
      if (h && document.getElementById('ev-logo-height')) {
        document.getElementById('ev-logo-height').value = h;
        if (document.getElementById('ev-logo-height-val')) document.getElementById('ev-logo-height-val').textContent = h;
      }
      updateLogoThumbnail(src);
    }

    const allDivs = Array.from(doc.querySelectorAll('div'));
    const subDiv = allDivs.find(d => d.textContent.includes('Administrative') || d.textContent.includes('Verification') || d.textContent.includes('Portal'));
    const headingDiv = allDivs.find(d => d.textContent.includes('Verification Code') || d.textContent.includes('Login'));
    const introDiv = allDivs.find(d => d.textContent.includes('Enter the') || d.textContent.includes('sign-in form'));
    const secTd = doc.querySelector('td[style*="border-left"]');
    
    // Footer lines
    const footerTds = Array.from(doc.querySelectorAll('td[style*="border-top"] div'));
    const footTitleDiv = footerTds[0] || allDivs.find(d => d.textContent.includes('The Official Publication') || d.textContent.includes('Privatian Society'));
    const footLocDiv = footerTds[1] || allDivs.find(d => d.textContent.includes('All Rights Reserved') || d.textContent.includes('Dhaka') || d.textContent.includes('Cambridge'));

    if (subDiv && document.getElementById('ev-brand-sub')) {
      document.getElementById('ev-brand-sub').value = subDiv.textContent.replace(/•/g, '•').trim();
    }
    if (headingDiv && document.getElementById('ev-main-heading')) {
      document.getElementById('ev-main-heading').value = headingDiv.textContent.trim();
    }
    if (introDiv && document.getElementById('ev-intro-text')) {
      document.getElementById('ev-intro-text').value = introDiv.textContent.trim();
    }
    if (secTd && document.getElementById('ev-security-notice')) {
      document.getElementById('ev-security-notice').value = secTd.textContent.replace('Security Notice:', '').trim();
    }
    if (footTitleDiv && document.getElementById('ev-footer-title')) {
      document.getElementById('ev-footer-title').value = footTitleDiv.textContent.trim();
    }
    if (footLocDiv && document.getElementById('ev-footer-location')) {
      document.getElementById('ev-footer-location').value = footLocDiv.textContent.trim();
    }
  } catch(e) {}
}

function switchEmailEditorMode(mode) {
  _currentEmailMode = mode;
  const visualBtn = document.getElementById('btn-mode-visual');
  const htmlBtn = document.getElementById('btn-mode-html');
  const visualPanel = document.getElementById('email-visual-builder-panel');
  const htmlPanel = document.getElementById('email-html-editor-panel');

  if (mode === 'visual') {
    if (visualBtn) { visualBtn.classList.add('active'); visualBtn.style.background = 'var(--brand-navy,#0a528e)'; visualBtn.style.color = '#fff'; }
    if (htmlBtn) { htmlBtn.classList.remove('active'); htmlBtn.style.background = '#f8fafc'; htmlBtn.style.color = 'var(--text-secondary)'; }
    if (visualPanel) visualPanel.style.display = 'flex';
    if (htmlPanel) htmlPanel.style.display = 'none';
    parseHtmlToVisualFields(document.getElementById('email-html-textarea')?.value || '');
  } else {
    if (htmlBtn) { htmlBtn.classList.add('active'); htmlBtn.style.background = 'var(--brand-navy,#0a528e)'; htmlBtn.style.color = '#fff'; }
    if (visualBtn) { visualBtn.classList.remove('active'); visualBtn.style.background = '#f8fafc'; visualBtn.style.color = 'var(--text-secondary)'; }
    if (htmlPanel) htmlPanel.style.display = 'flex';
    if (visualPanel) visualPanel.style.display = 'none';
    syncVisualToHtml();
  }
}

function syncVisualToHtml() {
  const rawLogo    = document.getElementById('ev-logo-url')?.value || 'img_jms7zxw4';
  const logoUrl    = resolveEmailLogoUrl(rawLogo);
  const logoHeight = parseInt(document.getElementById('ev-logo-height')?.value, 10) || 50;
  const brandSub   = document.getElementById('ev-brand-sub')?.value || 'Administrative Portal • Verification';
  const heading    = document.getElementById('ev-main-heading')?.value || 'Your Login Verification Code';
  const intro      = document.getElementById('ev-intro-text')?.value || 'Enter the single-use 6-digit verification code below in the administrator sign-in form to authenticate your session:';
  const secNotice  = document.getElementById('ev-security-notice')?.value || 'This passcode will expire in 1 hour. Never share this code with anyone. If you did not request this login attempt, no further action is required.';
  const footTitle  = document.getElementById('ev-footer-title')?.value || 'The Official Publication of The Privatian Society';
  const footLoc    = document.getElementById('ev-footer-location')?.value || 'Dhaka, Bangladesh • All Rights Reserved';

  const logoHtml = logoUrl
    ? `<div style="pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;display:inline-block;" oncontextmenu="return false;">
        <img src="${logoUrl}" alt="The Privatian Family" height="${logoHeight}" draggable="false" oncontextmenu="return false;" style="display:block;height:${logoHeight}px;max-height:${logoHeight}px;width:auto;margin:0 auto;border:0;outline:none;text-decoration:none;pointer-events:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;" />
      </div>`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;line-height:1.2;margin:0;pointer-events:none;user-select:none;">The Privatian Family</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(10,37,64,0.06);">
          
          <!-- Top Brand Header Banner (Deep Royal Navy Blue) -->
          <tr>
            <td align="center" style="background-color:#0a2540;padding:28px 24px 20px;border-bottom:3px solid #1e3a8a;user-select:none;-webkit-user-select:none;" oncontextmenu="return false;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;user-select:none;-webkit-user-select:none;" oncontextmenu="return false;">
                <tr>
                  <td align="center" style="user-select:none;-webkit-user-select:none;pointer-events:none;" oncontextmenu="return false;">
                    ${logoHtml}
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;letter-spacing:0.09em;text-transform:uppercase;color:#93c5fd;margin-top:8px;font-weight:600;line-height:1.2;pointer-events:none;user-select:none;-webkit-user-select:none;">
                      ${escapeHtml(brandSub)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding:34px 32px 28px;background-color:#ffffff;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0a2540;line-height:1.3;margin-bottom:12px;">
                ${escapeHtml(heading)}
              </div>
              <div style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px;">
                ${escapeHtml(intro)}
              </div>

              <!-- OTP Code Display Card -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:#f0f7ff;border:2px solid #bfdbfe;border-radius:10px;padding:22px 20px;">
                    <div style="font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,monospace,Consolas;font-size:38px;font-weight:800;letter-spacing:12px;color:#0a2540;line-height:1;margin:0 0 8px;padding-left:12px;">
                      {{ .Token }}
                    </div>
                    <div style="font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
                      Single-Use Security Passcode
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Information Note -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;padding:12px 16px;margin-bottom:8px;">
                <tr>
                  <td style="font-size:12.5px;color:#475569;line-height:1.5;">
                    <strong style="color:#0a2540;">Security Notice:</strong> ${escapeHtml(secNotice)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtle Footer & Sign-off -->
          <tr>
            <td align="center" style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 24px;">
              <div style="font-size:12px;color:#64748b;font-weight:600;line-height:1.4;">
                ${escapeHtml(footTitle)}
              </div>
              <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">
                ${escapeHtml(footLoc)}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const htmlArea = document.getElementById('email-html-textarea');
  if (htmlArea) htmlArea.value = html;

  updateEmailPreview();
}

function syncHtmlToVisualAndPreview() {
  updateEmailPreview();
}

function onEmailFieldChange() {
  const subj = document.getElementById('email-subject-input')?.value || '';
  const sender = document.getElementById('email-sender-name-input')?.value || 'The Privatian Family';

  const subjHeader = document.getElementById('preview-subject-header');
  if (subjHeader) subjHeader.textContent = subj;

  const fromHeader = document.getElementById('preview-from-header');
  if (fromHeader) fromHeader.textContent = `${sender} <theprivatianfamilybd@gmail.com>`;
}

function updateEmailPreview() {
  const html = document.getElementById('email-html-textarea')?.value || DEFAULT_MAGIC_LINK_HTML;
  const subj = document.getElementById('email-subject-input')?.value || 'Your 6-Digit Admin Verification Code (OTP) — The Privatian Family';
  const sender = document.getElementById('email-sender-name-input')?.value || 'The Privatian Family';

  const subjHeader = document.getElementById('preview-subject-header');
  if (subjHeader) subjHeader.textContent = subj;

  const fromHeader = document.getElementById('preview-from-header');
  if (fromHeader) fromHeader.textContent = `${sender} <theprivatianfamilybd@gmail.com>`;

  // Simulated dynamic variables
  let rendered = html
    .replace(/{{\s*\.Token\s*}}/g, '<span style="letter-spacing:12px;font-weight:800;color:#0a2540;">604789</span>')
    .replace(/{{\s*\.ConfirmationURL\s*}}/g, 'https://theprivatianfamily.vercel.app/admin-login.html?token=sample-token')
    .replace(/{{\s*\.Email\s*}}/g, 'admin@theprivatianfamily.com')
    .replace(/{{\s*\.SiteURL\s*}}/g, 'https://theprivatianfamily.vercel.app');

  const box = document.getElementById('email-preview-render-box');
  if (box) {
    box.innerHTML = rendered;
  }
}

async function saveEmailSettings() {
  const saveBtn = document.getElementById('btn-save-email-settings');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Saving…`;
  }

  const subj = document.getElementById('email-subject-input')?.value.trim();
  const sender = document.getElementById('email-sender-name-input')?.value.trim();
  const otpExp = parseInt(document.getElementById('email-otp-exp-input')?.value, 10) || 3600;
  const html = document.getElementById('email-html-textarea')?.value || '';

  const payload = {
    smtp_sender_name: sender,
    mailer_otp_exp: otpExp,
    mailer_subjects_magic_link: subj,
    mailer_templates_magic_link_content: html
  };

  _emailSettings.mailer_subjects_magic_link = subj;
  _emailSettings.mailer_templates_magic_link_content = html;
  _emailSettings.smtp_sender_name = sender;
  _emailSettings.mailer_otp_exp = otpExp;

  try {
    const res = await fetch('/api/email-settings?action=save', {
      method: 'POST',
      headers: {
        ..._authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('success', 'Login verification email template & settings saved successfully!');
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('error', err.error || 'Failed to save settings');
    }
  } catch(e) {
    showToast('error', e.message || 'Network error saving settings');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings`;
    }
  }
}

function resetEmailTemplateToDefault() {
  _confirmModal({
    title: 'Reset Template to Default',
    body: 'Are you sure you want to revert the verification email template to the system default layout and styling?',
    confirmText: 'Reset to Default',
    variant: 'danger',
    onConfirm: () => {
      document.getElementById('email-subject-input').value = 'Your 6-Digit Admin Verification Code (OTP) — The Privatian Family';
      document.getElementById('email-sender-name-input').value = 'The Privatian Family';
      document.getElementById('email-otp-exp-input').value = '3600';
      if (document.getElementById('ev-logo-url')) document.getElementById('ev-logo-url').value = 'img_jms7zxw4';
      if (document.getElementById('ev-logo-height')) document.getElementById('ev-logo-height').value = 50;
      if (document.getElementById('ev-logo-height-val')) document.getElementById('ev-logo-height-val').textContent = 50;
      updateLogoThumbnail(DEFAULT_EMAIL_LOGO_URL, 'The Privatian Family Logo (SVG)');
      if (document.getElementById('ev-brand-sub')) document.getElementById('ev-brand-sub').value = 'Administrative Portal • Verification';
      if (document.getElementById('ev-main-heading')) document.getElementById('ev-main-heading').value = 'Your Login Verification Code';
      if (document.getElementById('ev-intro-text')) document.getElementById('ev-intro-text').value = 'Enter the single-use 6-digit verification code below in the administrator sign-in form to authenticate your session:';
      if (document.getElementById('ev-security-notice')) document.getElementById('ev-security-notice').value = 'This passcode will expire in 1 hour. Never share this code with anyone. If you did not request this login attempt, no further action is required.';
      if (document.getElementById('ev-footer-title')) document.getElementById('ev-footer-title').value = 'The Official Publication of The Privatian Society';
      if (document.getElementById('ev-footer-location')) document.getElementById('ev-footer-location').value = 'Dhaka, Bangladesh • All Rights Reserved';
      
      document.getElementById('email-html-textarea').value = DEFAULT_MAGIC_LINK_HTML;
      updateEmailPreview();
      showToast('info', 'Template reset to default layout.');
    }
  });
}

window.initSettingsPage = initSettingsPage;
window.switchEmailEditorMode = switchEmailEditorMode;
window.syncVisualToHtml = syncVisualToHtml;
window.syncHtmlToVisualAndPreview = syncHtmlToVisualAndPreview;
window.onEmailFieldChange = onEmailFieldChange;
window.updateEmailPreview = updateEmailPreview;
window.saveEmailSettings = saveEmailSettings;
window.resetEmailTemplateToDefault = resetEmailTemplateToDefault;




