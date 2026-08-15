/* =================================================================
   THE PRIVATIAN FAMILY - ADMIN JS
   Sections CRUD - Supabase API - Toast - Modal
================================================================= */

// ── Global State Variables (Hoisted to prevent TDZ ReferenceErrors) ──
var sections = [];
var currentTab = 'active';
var activeTab = 'active';
var _currentAdminPage = 'sections';
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

// ── Admin Content Language Toggle (EN / BN) ──────────────────────────────
var _adminContentLang = localStorage.getItem('privatian_admin_content_lang') || 'en';

window.setAdminContentLang = function(lang) {
  _adminContentLang = lang || 'en';
  try { localStorage.setItem('privatian_admin_content_lang', _adminContentLang); } catch(e) {}

  const btnEn = document.getElementById('admin-lang-en');
  const btnBn = document.getElementById('admin-lang-bn');
  if (btnEn) btnEn.classList.toggle('active', _adminContentLang === 'en');
  if (btnBn) btnBn.classList.toggle('active', _adminContentLang === 'bn');

  if (typeof showToast === 'function') {
    showToast('info', _adminContentLang === 'bn' ? 'Switched editor to Bengali (বাংলা) configuration' : 'Switched editor to English configuration');
  }

  // Refresh currently active page
  if (_currentAdminPage === 'sections') {
    if (typeof loadSectionsFromAPI === 'function') loadSectionsFromAPI();
  } else if (_currentAdminPage === 'header') {
    if (typeof loadHeaderSettings === 'function') {
      loadHeaderSettings().then(hs => {
        _hsInstance = hs;
        window._appliedHeaderConfig = JSON.parse(JSON.stringify(hs));
        renderHsTabCard(hs);
        renderHsLogoCard(hs);
        renderHsNavSections(hs);
        renderHsSubsections(hs);
      });
    }
  } else if (_currentAdminPage === 'menu') {
    if (typeof initMenuPage === 'function') initMenuPage();
  } else if (_currentAdminPage === 'homepage') {
    if (typeof initHomepagePage === 'function') initHomepagePage();
  } else if (_currentAdminPage === 'footer') {
    if (typeof initFooterPage === 'function') initFooterPage();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnEn = document.getElementById('admin-lang-en');
  const btnBn = document.getElementById('admin-lang-bn');
  if (btnEn) btnEn.classList.toggle('active', _adminContentLang === 'en');
  if (btnBn) btnBn.classList.toggle('active', _adminContentLang === 'bn');
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

  try {
    const savedAllName = localStorage.getItem('pf_all_section_name');
    const savedAllSlug = localStorage.getItem('pf_all_section_slug');
    if (savedAllName) ALL_SECTION.name = savedAllName;
    if (savedAllSlug !== null && savedAllSlug !== undefined) ALL_SECTION.slug = savedAllSlug;
  } catch(e){}

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
  sectionsTable.innerHTML = '';

  if (active.length === 0) {
    activeEmpty.hidden = false;
    return;
  }
  activeEmpty.hidden = true;

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
        const lbl = (_adminContentLang === 'bn' && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
        return `<option value="${s.id}">${escapeHtml(lbl)} (${s.slug ? '/section/' + s.slug : '/'})</option>`;
      }).join('');
  }

  sorted.forEach(s => {
    const isPermanent = s.id === 'all' || s.isPermanent;
    const tr = document.createElement('tr');
    const nameHtml = (_adminContentLang === 'bn' && s.name_bn)
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
  trashTable.innerHTML = '';

  if (trash.length === 0) {
    trashEmpty.hidden = false;
    return;
  }
  trashEmpty.hidden = true;

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
    try {
      localStorage.setItem('pf_all_section_name', trimmed);
      localStorage.setItem('pf_all_section_slug', slugVal);
    } catch(e){}
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

  if (titleEl) titleEl.textContent = (_adminContentLang === 'bn' && s.name_bn) ? `${s.name_bn} (${s.name})` : s.name;
  if (idEl) idEl.value = s.id;
  if (slugEl) slugEl.value = s.slug || 'all';
  if (nameInput) nameInput.value = s.name;
  if (nameBnInput) nameBnInput.value = s.name_bn || '';
  if (slugInput) {
    slugInput.value = s.slug || '';
    const isBn = _adminContentLang === 'bn';
    if (isBn) {
      slugInput.readOnly = true;
      slugInput.style.opacity = '0.55';
      slugInput.style.cursor = 'not-allowed';
      slugInput.style.backgroundColor = '#f8fafc';
      slugInput.title = '🔒 Section URL Slug is unified in backend and defined strictly in English';
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
        const secLabel = (_adminContentLang === 'bn' && sec.name_bn) ? `${sec.name_bn} (${sec.name})` : sec.name;
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
    const res = await _apiGet(`/api/sections?action=section-config&slug=${encodeURIComponent(s.slug || 'all')}${_adminContentLang === 'bn' ? '&lang=bn' : ''}`);
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
    await _apiPost(`/api/sections?action=section-config&slug=${encodeURIComponent(configSlug)}${_adminContentLang === 'bn' ? '&lang=bn' : ''}`, {
      slug: configSlug,
      lang: _adminContentLang,
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
      showToast('success', 'Database connection verified & synchronized ✓');
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
  sections:  { title: 'Sections',  breadcrumb: 'Sections' },
  homepage:  { title: 'Homepage Manager', breadcrumb: 'Homepage' },
  menu:      { title: 'Navigation Menu', breadcrumb: 'Navigation Menu' },
  header:    { title: 'Header Settings', breadcrumb: 'Header' },
  footer:    { title: 'Footer Settings', breadcrumb: 'Footer' },
  dashboard: { title: 'Dashboard', breadcrumb: 'Dashboard' },
  articles:  { title: 'Articles',  breadcrumb: 'Articles' },
  settings:  { title: 'Settings',  breadcrumb: 'Settings' },
  access:    { title: 'Manage Access', breadcrumb: 'Manage Access' },
  activity:  { title: 'Activity Log & Audit Trail', breadcrumb: 'Activity Log' },
};

function navigateTo(page) {
  _currentAdminPage = page || 'sections';
  document.querySelectorAll('.sidebar-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  const cfg = PAGE_CONFIG[page] || { title: page, breadcrumb: page };
  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('breadcrumb-current').textContent = cfg.breadcrumb;

  // Inject topbar action buttons
  topbarActions.innerHTML = '';
  if (page === 'access')   { loadAccessList(); }
  if (page === 'homepage') { initHomepagePage(); }
  if (page === 'menu')     { initMenuPage(); }
  if (page === 'header')   { initHeaderPage(); }
  if (page === 'footer')   { initFooterPage(); }
  if (page === 'articles') { initArticlesPage(); }
  if (page === 'activity') { loadActivityLogs(); }
  if (page === 'sections') {
    // New Section button
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.id = 'add-section-btn';
    btn.innerHTML = `${ICONS.plus} New Section`;
    btn.addEventListener('click', openAddModal);
    topbarActions.appendChild(btn);
  }

  // Show/Hide topbar content language switcher (only relevant for content editors: sections, homepage, menu, header, footer)
  const langSwitcher = document.getElementById('admin-lang-switcher');
  if (langSwitcher) {
    const showLangSwitcher = ['sections', 'homepage', 'menu', 'header', 'footer'].includes(page);
    langSwitcher.style.display = showLangSwitcher ? 'flex' : 'none';
  }

  // Update Global Sync status immediately
  updateGlobalSyncStatus();
}

document.querySelectorAll('.sidebar-nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(el.dataset.page);
    // Silent access check on every navigation action
    if (Date.now() - _lastAccessCheck > 60000) checkMyAccess();
  });
});

// â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// -- INIT: boot the sections page, load data from API --
navigateTo('sections');
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
  el.textContent = 'Synced ✓';
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
}

// ── Reusable confirmation modal ─────────────────────────────────
function _confirmModal({ title, body, message, confirmText, confirmLabel, confirmColor, variant, danger, onConfirm }) {
  var _body    = body || message || '';
  var _btnText = confirmText || confirmLabel || 'Confirm';
  var _variant = variant || (danger === false ? 'success' : 'danger');
  if (typeof danger === 'undefined' && confirmColor && confirmColor !== '#dc2626') _variant = 'warning';
  var themes = {
    danger:  { iconBg:'#fff1f2', iconColor:'#dc2626', btnBg:'#dc2626', icon:'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' },
    success: { iconBg:'#f0fdf4', iconColor:'#16a34a', btnBg:'#16a34a', icon:'<circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 15 10"/>' },
    warning: { iconBg:'#fffbeb', iconColor:'#d97706', btnBg:'#d97706', icon:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  };
  var t = themes[_variant] || themes.danger;
  var ex = document.getElementById('_confirm-modal-overlay');
  if (ex) ex.remove();
  if (!document.getElementById('_cm-style')) {
    var s = document.createElement('style'); s.id = '_cm-style';
    s.textContent = '@keyframes _cmFIn{from{opacity:0}to{opacity:1}}@keyframes _cmSlUp{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}._cm-card{animation:_cmSlUp .2s cubic-bezier(.34,1.3,.64,1) both}._cm-btn{transition:filter .15s,transform .1s;font-family:inherit;cursor:pointer;border:none;outline:none;}._cm-btn:hover{filter:brightness(.9)}._cm-btn:active{transform:scale(.97)}';
    document.head.appendChild(s);
  }
  var overlay = document.createElement('div');
  overlay.id = '_confirm-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,18,36,.52);backdrop-filter:blur(4px);animation:_cmFIn .15s ease;';
  overlay.innerHTML = '<div class="_cm-card" style="background:#fff;border-radius:18px;padding:38px 32px 30px;max-width:420px;width:93%;box-shadow:0 32px 80px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.04);text-align:center;position:relative;">'
    + '<button id="_cm-x" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;color:#bbb;padding:4px;border-radius:6px;font-size:20px;line-height:1;">&times;</button>'
    + '<div style="width:58px;height:58px;border-radius:50%;background:' + t.iconBg + ';display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="' + t.iconColor + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="26" height="26">' + t.icon + '</svg></div>'
    + '<h3 style="font-size:17px;font-weight:700;color:#0d1f35;margin:0 0 9px;letter-spacing:-.015em;">' + escapeHtml(title) + '</h3>'
    + '<p style="font-size:13.5px;color:#64748b;line-height:1.65;margin:0 0 28px;">' + _body + '</p>'
    + '<div style="display:flex;gap:10px;justify-content:center;">'
    + '<button id="_cm-cancel" class="_cm-btn" style="background:#f1f5f9;color:#374151;padding:10px 24px;border-radius:10px;font-size:13.5px;font-weight:600;border:1px solid #e2e8f0;">Cancel</button>'
    + '<button id="_cm-ok" class="_cm-btn" style="background:' + t.btnBg + ';color:#fff;padding:10px 26px;border-radius:10px;font-size:13.5px;font-weight:700;min-width:120px;">' + escapeHtml(_btnText) + '</button>'
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
  const body = 'At least <strong>2 Gmail Admin</strong> accounts must remain active at all times.' +
    (extra ? '<br><br>' + extra : '') +
    '<br><br>Add another <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">@gmail.com</code> Admin first.';
  _confirmModal({
    title: 'Cannot Complete Action',
    body,
    confirmText: 'Got it',
    confirmColor: '#1e3a5f',
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
    'linear-gradient(135deg, #4f46e5, #7c3aed)',
    'linear-gradient(135deg, #0284c7, #06b6d4)',
    'linear-gradient(135deg, #059669, #10b981)',
    'linear-gradient(135deg, #d97706, #f59e0b)',
    'linear-gradient(135deg, #e11d48, #f43f5e)',
    'linear-gradient(135deg, #7c2d12, #c2410c)',
    'linear-gradient(135deg, #1e3a5f, #3b82f6)'
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
        const text = `${a.email} ${a.role} ${a.added_by || ''} ${a.modified_by || ''} ${a.modified_action || ''}`.toLowerCase();
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
      ? `<span class="access-role-pill admin"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg> Admin</span>`
      : `<span class="access-role-pill moderator"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Moderator</span>`;

    let statusBadge = '';
    if (a.status === 'active') {
      statusBadge = `<span class="access-status-pill active"><span class="access-tab-dot active"></span> Active</span>`;
    } else if (a.status === 'suspended') {
      statusBadge = `<span class="access-status-pill suspended"><span class="access-tab-dot suspended"></span> Suspended</span>`;
    } else {
      statusBadge = `<span class="access-status-pill recycle"><span class="access-tab-dot recycle"></span> In Recycle</span>`;
    }

    let actionsHtml = '';
    if (isSelf) {
      actionsHtml = `<span class="access-user-you-tag" title="Protected: Your active session cannot be modified by yourself"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Active (You)</span>`;
    } else if (panel === 'recycle') {
      actionsHtml = `
        <button class="access-action-btn success" onclick="restoreAdmin('${a.id}','${escapeHtml(a.email)}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
          Restore
        </button>
        <button class="access-action-btn danger" onclick="purgeAdmin('${a.id}','${escapeHtml(a.email)}')">
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
        <button class="access-action-btn warning" onclick="toggleAdminStatus('${a.id}','${suspendNew}','${escapeHtml(a.email)}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          ${suspendLabel}
        </button>
      `;

      const removeBtn = `
        <button class="access-action-btn danger" onclick="removeAdmin('${a.id}','${escapeHtml(a.email)}')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Move to Recycle
        </button>
      `;

      actionsHtml = `${roleToggleBtn} ${suspendBtn} ${removeBtn}`;
    }

    return `
      <div class="access-user-card">
        <div class="access-avatar" style="background:${gradient};" title="${escapeHtml(a.email)}">
          ${initials}
        </div>
        <div class="access-user-details">
          <div class="access-user-main-row">
            <span class="access-user-email">${escapeHtml(a.email)}</span>
            ${isSelf ? '<span class="access-user-you-tag">You</span>' : ''}
            ${roleBadge}
            ${statusBadge}
          </div>
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
  _confirmModal({
    title:        'Change Role',
    body:         `Change <strong>${escapeHtml(email)}</strong> from ${newRole === 'Admin' ? 'Moderator' : 'Admin'} to <strong>${escapeHtml(newRole)}</strong>?`,
    confirmText:  'Yes, Change Role',
    confirmColor: '#1e3a5f',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ role: newRole })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup('Cannot downgrade: would leave fewer than 2 Gmail Admins.'); return; }
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
function toggleAdminStatus(id, newStatus, email) {
  const me = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
  if (email && email.toLowerCase() === me) { showToast('error', 'You cannot change your own status.'); return; }

  const label = newStatus === 'suspended' ? 'Suspend' : 'Unsuspend';
  _confirmModal({
    title:       label + ' Admin',
    body:        `${label} <strong>${escapeHtml(email)}</strong>?` +
                 (newStatus === 'suspended' ? ' They will lose admin access on their next check.' : ' They will regain access immediately.'),
    confirmText: label,
    confirmColor: newStatus === 'suspended' ? '#d97706' : '#059669',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup(); return; }
          throw new Error(data.error || 'Failed');
        }
        showToast('success', 'Status updated to ' + newStatus + '.');
        loadAccessList();
        recordActivityLog({
          action: newStatus === 'suspended' ? 'access.suspend' : 'access.unsuspend',
          category: 'access',
          summary: `${label}ed admin access for "${email}"`,
          target_id: id,
          target_name: email,
          details: { id, email, status: newStatus }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Remove (soft-delete → Recycle) ──────────────────────────────
function removeAdmin(id, email) {
  const me = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
  if (email && email.toLowerCase() === me) { showToast('error', 'You cannot remove your own account.'); return; }

  _confirmModal({
    title:       'Remove Admin',
    body:        `Move <strong>${escapeHtml(email)}</strong> to Recycle?<br>They will lose access on their next check.`,
    confirmText: 'Move to Recycle',
    confirmColor: '#dc2626',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=remove&id=' + id, { method: 'DELETE', headers: _authHeaders() });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup(); return; }
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
function restoreAdmin(id, email) {
  _confirmModal({
    title:       'Restore Account',
    body:        `Restore <strong>${escapeHtml(email)}</strong> to Active?`,
    confirmText: 'Yes, Restore',
    confirmColor: '#059669',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=update&id=' + id, {
          method: 'PATCH', headers: _authHeaders(),
          body: JSON.stringify({ status: 'active' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', email + ' restored to Active.');
        _setAccessTab('active');
        loadAccessList();
        recordActivityLog({
          action: 'access.restore',
          category: 'access',
          summary: `Restored admin "${email}" to Active status`,
          target_id: id,
          target_name: email,
          details: { id, email }
        });
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Permanent delete from Recycle ────────────────────────────────
function purgeAdmin(id, email) {
  _confirmModal({
    title:       'Permanently Delete',
    body:        `<strong style="color:#dc2626">This cannot be undone.</strong><br><br>Permanently delete <strong>${escapeHtml(email)}</strong> from the system?`,
    confirmText: 'Delete Forever',
    confirmColor: '#dc2626',
    onConfirm: async () => {
      try {
        const res  = await fetch('/api/admins?action=purge&id=' + id, { method: 'DELETE', headers: _authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', email + ' permanently deleted.');
        loadAccessList();
        recordActivityLog({
          action: 'access.purge',
          category: 'access',
          summary: `Permanently purged admin account "${email}" from the database`,
          target_id: id,
          target_name: email,
          details: { id, email }
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
// HEADER SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════

const HEADER_SETTINGS_KEY = 'privatian_header_settings';

const DEFAULT_HEADER_SUBSECTIONS = [
  { id: 'sub-1', label: 'FAMILY LEGACY', href: '/section/community-heritage', icon: null, enabled: true },
  { id: 'sub-2', label: 'EXPERIENCE', href: '/section/culture', icon: null, enabled: true },
  { id: 'sub-3', label: 'THE PRIVATIAN READS', href: '/section/findings', icon: null, enabled: true },
  { id: 'sub-4', label: 'EVENTS', href: '/events', icon: 'calendar', enabled: true }
];

const DEFAULT_HEADER_SETTINGS = {
  siteTitle: 'The Privatian Family',
  tabTagline: 'Insights, Stories & Heritage',
  browserTabTitle: 'The Privatian Family — Insights, Stories & Heritage',
  metaDescription: 'The Official Publication of The Privatian Society — Cambridge, Massachusetts.',
  faviconUrl: '',
  logoSvg: null,
  logoHeight: 80,
  enabledNavSections: null,
  subsections: DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}))
};

async function loadHeaderSettings() {
  try {
    const data = await _apiGet('/api/sections?action=header' + (_adminContentLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') {
      const merged = Object.assign({}, DEFAULT_HEADER_SETTINGS, data);
      if (!merged.subsections) merged.subsections = DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}));
      try { localStorage.setItem(HEADER_SETTINGS_KEY + '_' + _adminContentLang, JSON.stringify(merged)); } catch(e) {}
      return merged;
    }
  } catch(err) {
    console.warn('[Admin] loadHeaderSettings API failed (using cache):', err.message);
  }
  try {
    const raw = localStorage.getItem(HEADER_SETTINGS_KEY + '_' + _adminContentLang) || localStorage.getItem(HEADER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = Object.assign({}, DEFAULT_HEADER_SETTINGS, parsed);
      if (!merged.subsections) merged.subsections = DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}));
      return merged;
    }
  } catch(e) {}

  try {
    const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
    if (sb) {
      const targetAdminId = _adminContentLang === 'bn' ? '__header_config_bn__' : '__header_config__';
      const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
      if (sData && sData.name) {
        const parsed = JSON.parse(sData.name);
        if (parsed && typeof parsed === 'object') {
          const merged = Object.assign({}, DEFAULT_HEADER_SETTINGS, parsed);
          if (!merged.subsections) merged.subsections = DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}));
          return merged;
        }
      }
    }
  } catch(e) {}

  return Object.assign({}, DEFAULT_HEADER_SETTINGS);
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

  if (siteTitleInp) siteTitleInp.value = hs.siteTitle || 'The Privatian Family';
  if (tabTaglineInp) tabTaglineInp.value = hs.tabTagline !== undefined ? hs.tabTagline : 'Insights, Stories & Heritage';
  if (customTitleInp) customTitleInp.value = hs.browserTabTitle || '';
  if (metaDescInp) metaDescInp.value = hs.metaDescription || '';
  if (faviconInp) faviconInp.value = hs.faviconUrl || '';

  function refreshTabCardPreview() {
    const brand = (siteTitleInp ? siteTitleInp.value.trim() : '') || 'The Privatian Family';
    const tag = (tabTaglineInp ? tabTaglineInp.value.trim() : '') || '';
    const custom = customTitleInp ? customTitleInp.value.trim() : '';

    const finalTitle = custom || (brand + (tag ? ' — ' + tag : ''));
    if (tabPreview) tabPreview.textContent = finalTitle;
    if (hoverPreview) hoverPreview.textContent = finalTitle;
  }
  refreshTabCardPreview();

  if (siteTitleInp) {
    siteTitleInp.addEventListener('input', () => {
      hs.siteTitle = siteTitleInp.value.trim();
      if (!customTitleInp.value.trim() || customTitleInp.dataset.manual !== 'true') {
        const brand = hs.siteTitle || 'The Privatian Family';
        const tag = (tabTaglineInp ? tabTaglineInp.value.trim() : '') || '';
        hs.browserTabTitle = brand + (tag ? ' — ' + tag : '');
        if (customTitleInp) customTitleInp.placeholder = hs.browserTabTitle;
      }
      refreshTabCardPreview();
      updateGlobalSyncStatus();
    });
  }

  if (tabTaglineInp) {
    tabTaglineInp.addEventListener('input', () => {
      hs.tabTagline = tabTaglineInp.value.trim();
      if (!customTitleInp.value.trim() || customTitleInp.dataset.manual !== 'true') {
        const brand = (siteTitleInp ? siteTitleInp.value.trim() : '') || 'The Privatian Family';
        const tag = hs.tabTagline;
        hs.browserTabTitle = brand + (tag ? ' — ' + tag : '');
        if (customTitleInp) customTitleInp.placeholder = hs.browserTabTitle;
      }
      refreshTabCardPreview();
      updateGlobalSyncStatus();
    });
  }

  if (customTitleInp) {
    customTitleInp.addEventListener('input', () => {
      customTitleInp.dataset.manual = customTitleInp.value.trim() ? 'true' : 'false';
      hs.browserTabTitle = customTitleInp.value.trim();
      refreshTabCardPreview();
      updateGlobalSyncStatus();
    });
  }

  if (metaDescInp) {
    metaDescInp.addEventListener('input', () => {
      hs.metaDescription = metaDescInp.value.trim();
      updateGlobalSyncStatus();
    });
  }

  if (faviconInp) {
    faviconInp.addEventListener('input', () => {
      hs.faviconUrl = faviconInp.value.trim();
      updateGlobalSyncStatus();
    });
  }
}

async function saveHeaderSettings(hs) {
  hs.updatedAt = new Date().toISOString();
  hs.lang = _adminContentLang;
  try {
    localStorage.setItem(HEADER_SETTINGS_KEY + '_' + _adminContentLang, JSON.stringify(hs));
    // Also sync structural settings (enabledNavSections, subsections enabled, logo, etc.) into other language cache
    const otherLang = (_adminContentLang === 'bn') ? 'en' : 'bn';
    const otherRaw = localStorage.getItem(HEADER_SETTINGS_KEY + '_' + otherLang);
    if (otherRaw) {
      const otherHs = JSON.parse(otherRaw);
      otherHs.enabledNavSections = hs.enabledNavSections;
      otherHs.logoHeight = hs.logoHeight;
      otherHs.logoSvg = hs.logoSvg;
      otherHs.faviconUrl = hs.faviconUrl;
      if (Array.isArray(hs.subsections) && Array.isArray(otherHs.subsections)) {
        otherHs.subsections = hs.subsections.map((srcSub, idx) => {
          const match = otherHs.subsections.find(t => t.id === srcSub.id) || otherHs.subsections[idx] || {};
          return {
            ...match,
            id: srcSub.id,
            enabled: srcSub.enabled !== false,
            icon: srcSub.icon !== undefined ? srcSub.icon : match.icon,
            href: (_adminContentLang === 'en') ? srcSub.href : (match.href || srcSub.href)
          };
        });
      }
      localStorage.setItem(HEADER_SETTINGS_KEY + '_' + otherLang, JSON.stringify(otherHs));
    }
  } catch(e) {}
  try {
    await _apiPost('/api/sections?action=header' + (_adminContentLang === 'bn' ? '&lang=bn' : ''), hs);
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
    taglineEl.textContent = _hsInstance.tabTagline || (_adminContentLang === 'bn' ? 'জ্ঞান, ঐতিহ্য ও জীবনের কথা' : 'Insights, Stories & Heritage');
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

  const isBn = (_adminContentLang === 'bn');
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

  const calBadge = sub.icon === 'calendar' ? '<span class="hs-icon-badge">📅 calendar</span>' : '';

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
            <option value="calendar" ${sub.icon === 'calendar' ? 'selected' : ''}>Calendar (📅)</option>
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
      if (badgeEl) badgeEl.textContent = '📅 calendar';
      else row.querySelector('.hs-sub-info').insertAdjacentHTML('afterbegin', '<span class="hs-icon-badge">📅 calendar</span>');
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
  saveBtn.addEventListener('click', async () => {
    // Collect Browser Tab & SEO
    const siteTitleInp = document.getElementById('hs-site-title-input');
    const tabTaglineInp = document.getElementById('hs-tab-tagline-input');
    const customTitleInp = document.getElementById('hs-tab-title-custom-input');
    const metaDescInp = document.getElementById('hs-meta-desc-input');
    const faviconInp = document.getElementById('hs-favicon-input');

    if (siteTitleInp) hs.siteTitle = siteTitleInp.value.trim() || 'The Privatian Family';
    if (tabTaglineInp) hs.tabTagline = tabTaglineInp.value.trim() || '';
    if (customTitleInp) hs.browserTabTitle = customTitleInp.value.trim() || (hs.siteTitle + (hs.tabTagline ? ' — ' + hs.tabTagline : ''));
    if (metaDescInp) hs.metaDescription = metaDescInp.value.trim() || '';
    if (faviconInp) hs.faviconUrl = faviconInp.value.trim() || '';

    // Collect enabled nav sections
    hs.enabledNavSections = getEnabledNavSections();
    // Collect logo
    const svgInput = document.getElementById('hs-logo-svg-input');
    const slider   = document.getElementById('hs-logo-height');
    if (svgInput) hs.logoSvg = svgInput.value.trim() || null;
    if (slider) hs.logoHeight = parseInt(slider.value) || 80;

    const orig = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `Saving to database...`;
    updateGlobalSyncStatus('syncing', 'Saving to database...');

    try {
      await saveHeaderSettings(hs);
      window._appliedHeaderConfig = JSON.parse(JSON.stringify(hs));
      updateGlobalSyncStatus('synced', 'Synced with database');
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Changes Applied!`;
      saveBtn.style.background = 'var(--success, #1a7a4a)';
      showToast('success', 'Header & Browser Tab settings saved to database & applied!');
      recordActivityLog({
        action: 'layout.header_save',
        category: 'layout',
        summary: `Applied Header Settings (Site Title: "${hs.siteTitle}", Tagline: "${hs.tabTagline}", Logo: ${hs.logoHeight}px, ${hs.subsections.length} Tabs)`,
        target_id: 'site_header_config',
        target_name: 'Header Settings',
        details: { siteTitle: hs.siteTitle, tabTagline: hs.tabTagline, metaDescription: hs.metaDescription, logoHeight: hs.logoHeight, tabsCount: hs.subsections.length }
      });
    } catch(err) {
      updateGlobalSyncStatus('error', 'Sync error (offline/cache)');
      showToast('error', 'Failed to save header settings.');
    } finally {
      setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.style.background = ''; saveBtn.disabled = false; }, 2500);
    }
  });
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
          .select('id, slug, title, deck, section, author, status, created_at, updated_at, published_at, hero_img_url')
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
        const res = await fetch(`${PRIVATIAN_SUPABASE_URL}/rest/v1/articles?select=id,slug,title,deck,section,author,status,created_at,updated_at,published_at,hero_img_url&or=(is_deleted.is.null,is_deleted.eq.false)&order=updated_at.desc`, {
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

    const shortId = a.id ? (a.id.length > 12 ? a.id.slice(0, 8) + '…' : a.id) : '—';
    const idBadge = a.id ? `<span class="art-id-badge" onclick="copyTextToClipboard('${escapeHtml(a.id)}', 'Article Unique ID copied!')" title="Click to copy permanent Article Unique ID: ${escapeHtml(a.id)}"><span style="opacity:.6;font-size:9.5px;">ID:</span>${escapeHtml(shortId)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>` : '';

    return `<tr>
      <td>
        <div class="art-media-wrap">
          ${thumb}
          <div class="art-title-meta">
            <div class="art-row-title" title="${escapeHtml(a.title || 'Untitled')}">${escapeHtml(a.title || 'Untitled')}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
              ${idBadge}
              <span class="art-row-slug" title="/article/${escapeHtml(a.slug || a.id)}">/${escapeHtml(a.slug || a.id)}</span>
            </div>
          </div>
        </div>
      </td>
      <td>${sectionBadge}</td>
      <td><span class="art-author-txt">${escapeHtml(a.author || '—')}</span></td>
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
          <button type="button" onclick="deleteArticleConfirm('${a.id}', '${escapeHtml((a.title||'Untitled').replace(/'/g,"\\'"))}')" class="art-action-btn art-action-btn--trash" title="Move to Recycle Bin">
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

    _allArticles = _allArticles.filter(a => a.id !== id);
    filterArticles();
    _loadArticleTrash();
    _showAdminToast('Article moved to Trash', 'success');

    recordActivityLog({
      action: 'articles.trash',
      category: 'articles',
      summary: `Moved article "${art?.title || id}" to Recycle Bin`,
      target_id: id,
      target_name: art?.title || id,
      details: { id, title: art?.title, slug: art?.slug }
    });
  } catch(e) { _showAdminToast(e.message, 'error'); }
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
      targetRow.style.transition = 'opacity 0.2s, transform 0.2s';
      targetRow.style.opacity = '0';
      targetRow.style.transform = 'scale(0.96)';
      setTimeout(() => targetRow.remove(), 200);
      if (countEl) {
        const current = parseInt(countEl.textContent || '1', 10);
        countEl.textContent = Math.max(0, current - 1);
      }
    }
  }

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

    _showAdminToast('Article restored to active list', 'success');

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
    _showAdminToast(e.message, 'error');
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
      targetRow.style.transition = 'opacity 0.2s, transform 0.2s';
      targetRow.style.opacity = '0';
      targetRow.style.transform = 'scale(0.96)';
      setTimeout(() => targetRow.remove(), 200);
      if (countEl) {
        const current = parseInt(countEl.textContent || '1', 10);
        countEl.textContent = Math.max(0, current - 1);
      }
    }
  }

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

    _showAdminToast('Article permanently deleted', 'success');

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
    _showAdminToast(e.message, 'error');
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

// Handle direct navigation via hash (e.g. admin.html#articles, admin.html#menu)
if (window.location.hash === '#articles') {
  window.addEventListener('privatian:ready', () => navigateTo('articles'));
}
if (window.location.hash === '#menu') {
  window.addEventListener('privatian:ready', () => navigateTo('menu'));
}

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
    const data = await _apiGet('/api/sections?action=menu' + (_adminContentLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') {
      loaded = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)), data);
    }
  } catch(err) {}

  if (!loaded) {
    try {
      const cached = localStorage.getItem('privatian_menu_settings_' + _adminContentLang) || localStorage.getItem('privatian_menu_settings');
      if (cached) loaded = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)), JSON.parse(cached));
      else loaded = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    } catch(e) {
      loaded = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    }
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
      placeholder: _adminContentLang === 'bn' ? 'নিবন্ধ, গল্প, বিষয় খুঁজুন...' : 'Search articles, stories, topics...',
      exploreLabel: _adminContentLang === 'bn' ? 'দ্রুত খুঁজুন:' : 'Explore:',
      closeText: _adminContentLang === 'bn' ? 'বন্ধ করুন' : 'Close',
      hintText: _adminContentLang === 'bn' ? 'অনুসন্ধান করতে লিখুন অথবা ওপরের বিষয় বেছে নিন…' : 'Start typing to search or select a topic above…',
      noResultsText: _adminContentLang === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching stories found',
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
  const isBn = (_adminContentLang === 'bn');
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

  const isBn = (_adminContentLang === 'bn');
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

  const isBn = (_adminContentLang === 'bn');
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
  const isBn = _adminContentLang === 'bn';

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
      hrefInput.title = isBn ? '🔒 URL is unified in backend and defined strictly in English' : '';
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
      hrefInput.title = isBn ? '🔒 URL is unified in backend and defined strictly in English' : '';
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
  const isBn = _adminContentLang === 'bn';

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
  const isBn = _adminContentLang === 'bn';

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
      hrefInput.title = isBn ? '🔒 URL is unified in backend and defined strictly in English' : '';
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
      hrefInput.title = isBn ? '🔒 URL is unified in backend and defined strictly in English' : '';
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
  const isBn = _adminContentLang === 'bn';

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

  const isBn = (_adminContentLang === 'bn');
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
  const isBn = (_adminContentLang === 'bn');
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
    menuDraftConfig.lang = _adminContentLang;
    await _apiPost('/api/sections?action=menu' + (_adminContentLang === 'bn' ? '&lang=bn' : ''), menuDraftConfig);

    // 2. Publish to local applied cache
    try {
      localStorage.setItem('privatian_menu_settings_' + _adminContentLang, JSON.stringify(menuDraftConfig));
    } catch(e) {}

    // 3. Reset base and undo/redo stacks to the new applied state
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
    try {
      localStorage.setItem('privatian_menu_settings', JSON.stringify(menuDraftConfig));
    } catch(e) {}
    appliedMenuConfig = JSON.parse(JSON.stringify(menuDraftConfig));
    menuUndoStack = [];
    menuRedoStack = [];
    updateUndoRedoButtons();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', 'Changes applied to local cache');

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
    const data = await _apiGet('/api/sections?action=homepage' + (_adminContentLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object') loaded = data;
  } catch(err) {}

  if (!loaded) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _adminContentLang === 'bn' ? '__homepage_config_bn__' : '__homepage_config__';
        const { data: sData } = await sb.from('sections').select('name').eq('admin_id', targetAdminId).maybeSingle();
        if (sData && sData.name) {
          const parsed = JSON.parse(sData.name);
          if (parsed && typeof parsed === 'object') loaded = parsed;
        }
      }
    } catch(e) {}
  }

  if (!loaded) {
    try {
      const cached = localStorage.getItem('privatian_homepage_settings_' + _adminContentLang) || localStorage.getItem('privatian_homepage_settings');
      if (cached) loaded = JSON.parse(cached);
    } catch(e) {}
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
  const isBn = _adminContentLang === 'bn';
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
            <label class="form-label" style="font-size:11px;">Section Slug Link ${_adminContentLang === 'bn' ? '<span style="color:#d97706;font-size:10px;font-weight:600;">(🔒 Set in English)</span>' : ''}</label>
            <input type="text" class="form-input" value="${escapeHtml(col.sectionSlug || '')}" ${_adminContentLang === 'bn' ? 'readonly style="opacity:0.55;cursor:not-allowed;background:#f8fafc;" title="🔒 Section Slug is unified in backend and defined strictly in English"' : `oninput="onHpColumnSlugInput(${cIdx}, this.value)"`} placeholder="e.g. culture" />
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

  const isBn = _adminContentLang === 'bn';
  headlineInput.value = slotData.title || '';
  if (subtitleInput) subtitleInput.value = slotData.subtitle || slotData.description || '';
  if (linkInput) {
    linkInput.value = slotData.href || '';
    linkInput.readOnly = isBn;
    linkInput.style.opacity = isBn ? '0.55' : '1';
    linkInput.style.backgroundColor = isBn ? '#f8fafc' : '';
    linkInput.style.cursor = isBn ? 'not-allowed' : '';
    linkInput.title = isBn ? '🔒 URL is unified in backend and defined strictly in English' : '';
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
    showToast('success', `Found article: "${match.title}" ✓`);
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

  const isBn = _adminContentLang === 'bn';
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
  const isBn = _adminContentLang === 'bn';

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
      linkInput.title = isBn ? '🔒 Event URL is unified in backend and defined strictly in English' : '';
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
      linkInput.title = isBn ? '🔒 Event URL is unified in backend and defined strictly in English' : '';
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
  const isBn = _adminContentLang === 'bn';

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
  const isBn = _adminContentLang === 'bn';

  if (saveBtn) saveBtn.disabled = true;
  updateGlobalSyncStatus('syncing', 'Saving to database...');

  try {
    homepageDraftConfig.lang = _adminContentLang;
    const res = await _apiPost('/api/sections?action=homepage' + (isBn ? '&lang=bn' : ''), homepageDraftConfig);
    appliedHomepageConfig = JSON.parse(JSON.stringify(homepageDraftConfig));
    try {
      localStorage.setItem('privatian_homepage_settings_' + _adminContentLang, JSON.stringify(homepageDraftConfig));
    } catch(e) {}
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
        lang: _adminContentLang,
        heroTitle: homepageDraftConfig.hero?.main?.title,
        eventsCount: (homepageDraftConfig.eventsSection?.events || []).length,
        columnsCount: (homepageDraftConfig.allNews?.columns || []).length
      }
    });
  } catch(err) {
    console.warn('[Admin] saveHomepageSettings server error:', err.message);
    try {
      localStorage.setItem('privatian_homepage_settings_' + _adminContentLang, JSON.stringify(homepageDraftConfig));
    } catch(e) {}
    appliedHomepageConfig = JSON.parse(JSON.stringify(homepageDraftConfig));
    homepageUndoStack = [];
    homepageRedoStack = [];
    updateHomepageUndoRedoBtns();
    updateGlobalSyncStatus('synced', 'Synced with database');
    showToast('success', isBn ? 'বাংলা হোমপেজের পরিবর্তন লোকাল ক্যাশে সংরক্ষিত হয়েছে' : 'Homepage changes applied to local cache');

    recordActivityLog({
      action: 'layout.homepage_save',
      category: 'layout',
      summary: `Saved Homepage Builder configuration (${isBn ? 'Bengali' : 'English'}, local cache fallback)`,
      target_id: isBn ? 'site_homepage_config_bn' : 'site_homepage_config',
      target_name: 'Homepage Builder',
      details: { lang: _adminContentLang, offlineFallback: true }
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

  let loadedConfig = null;

  // Tier 1: Try API
  try {
    const data = await _apiGet('/api/sections?action=footer' + (_adminContentLang === 'bn' ? '&lang=bn' : ''));
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      loadedConfig = data;
    }
  } catch(e) {}

  // Tier 2: Try direct Supabase query on sections table (__footer_config__)
  if (!loadedConfig) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _adminContentLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
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
        const targetAdminId = _adminContentLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
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

  // Tier 4: LocalStorage
  if (!loadedConfig) {
    try {
      const cached = localStorage.getItem(FOOTER_SETTINGS_KEY + '_' + _adminContentLang) || localStorage.getItem(FOOTER_SETTINGS_KEY);
      if (cached) loadedConfig = JSON.parse(cached);
    } catch(err) {}
  }

  // Tier 5: Default Config
  if (!loadedConfig) {
    loadedConfig = JSON.parse(JSON.stringify(DEFAULT_FOOTER_CONFIG));
  }

  appliedFooterConfig = JSON.parse(JSON.stringify(loadedConfig));
  footerDraftConfig = JSON.parse(JSON.stringify(loadedConfig));

  footerUndoStack = [];
  footerRedoStack = [];
  updateFooterUndoRedoButtons();
  updateGlobalSyncStatus('synced', 'Synced with database');
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

  const exploreList = cfg.explore || [];
  const seriesList = cfg.series || [];
  const socialList = cfg.social || [];
  const bottomList = cfg.bottomLinks || [];

  box.innerHTML = `
    <div class="ft-preview-grid">
      <!-- Col 1: Sections -->
      <div class="ft-interactive-col">
        <div class="ft-col-header-bar">
          <span class="ft-col-title-badge">${FT_ICONS.sections}${escapeHtml(cfg.sectionsTitle || 'Sections')}</span>
          <button type="button" class="ft-col-quick-btn" onclick="switchFooterTab('sections')">
            ${FT_ICONS.settings}Edit (${displaySecs.length})
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${displaySecs.length === 0 ? '<span style="font-size:12px;color:#64748b;font-style:italic;">No sections enabled.</span>' : ''}
          ${displaySecs.map(s => {
            const secSlug = s.slug || s.id;
            return `
              <div class="ft-visual-item" onclick="switchFooterTab('sections')" title="Manage section visibility">
                <span style="font-size:12.5px;color:#e2e8f0;">${escapeHtml(s.name)}</span>
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

  const isBn = (_adminContentLang === 'bn');
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
    footerDraftConfig.lang = _adminContentLang;
    const result = await _apiPost('/api/sections?action=footer' + (_adminContentLang === 'bn' ? '&lang=bn' : ''), footerDraftConfig);
    if (result && (result.ok || result.data)) savedOk = true;
  } catch(err) {}

  // 2. Direct Supabase Fallback (sections table under __footer_config__ or __footer_config_bn__)
  if (!savedOk) {
    try {
      const sb = window._sb || (window.initSupabaseClient && window.initSupabaseClient());
      if (sb) {
        const targetAdminId = _adminContentLang === 'bn' ? '__footer_config_bn__' : '__footer_config__';
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

  // 3. Always persist to localStorage
  try {
    localStorage.setItem(FOOTER_SETTINGS_KEY + '_' + _adminContentLang, JSON.stringify(footerDraftConfig));
  } catch(e) {}

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

    const [listData, statsData] = await Promise.all([
      _apiGet(`/api/activity-log?${params.toString()}`),
      _apiGet('/api/activity-log?action=stats').catch(() => null)
    ]);

    if (loadingEl) loadingEl.style.display = 'none';

    let items = (listData && Array.isArray(listData.items)) ? listData.items : (Array.isArray(listData) ? listData : []);

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




