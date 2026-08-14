/* =================================================================
   THE PRIVATIAN FAMILY - ADMIN JS
   Sections CRUD - Supabase API - Toast - Modal
================================================================= */

// -- API helpers (sections endpoints) --
function _authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (window.PRIVATIAN_TOKEN || '')
  };
}
async function _apiGet(url) {
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + (window.PRIVATIAN_TOKEN || '') } });
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
async function _apiPatch(url) {
  const r = await fetch(url, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + (window.PRIVATIAN_TOKEN || '') } });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}
async function _apiDelete(url) {
  const r = await fetch(url, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + (window.PRIVATIAN_TOKEN || '') } });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return r.json();
}

// -- Locked "All" pseudo-section (UI-only, never stored in DB) --
const ALL_SECTION = {
  id: 'all', name: 'All', slug: '', locked: true,
  deleted: false, createdAt: '2024-01-01T00:00:00Z'
};

// -- Load all sections (active + trashed) from API --
async function loadSectionsFromAPI() {
  try {
    const data = await _apiGet('/api/sections?status=all');
    sections = [ALL_SECTION, ...data];
    render();
    updateSyncBadge(true);
  } catch(e) {
    console.warn('[Admin] loadSectionsFromAPI failed:', e.message);
    // Show empty state gracefully - do not crash
    sections = [ALL_SECTION];
    render();
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

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let sections = [];
let currentTab = 'active';
let editingId  = null;   // for modal edit mode
let pendingDeleteId = null;  // for confirm modal
let undoTimer  = null;

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
const modalCloseBtn  = document.getElementById('modal-close-btn');
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
    ...active.filter(s => s.locked),
    ...active.filter(s => !s.locked),
  ];

  sorted.forEach(s => {
    const tr = document.createElement('tr');
    if (s.locked) tr.classList.add('row--locked');

    tr.innerHTML = `
      <td>
        <div class="section-name-cell ${s.locked ? 'section-name-locked' : ''}">
          ${s.locked ? `<span class="lock-icon">${ICONS.lock}</span>` : ''}
          <span class="section-name-text">${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td class="col-slug">
        ${s.locked
          ? '<span class="section-slug-cell--empty">—</span>'
          : (s.slug
              ? `<span class="section-slug-cell" title="/section/${escapeHtml(s.slug)}">${escapeHtml(s.slug)}</span>`
              : '<span class="section-slug-cell--empty">not set</span>'
            )
        }
      </td>
      <td class="articles-count articles-count--dash col-articles">—</td>
      <td class="created-date">${formatDate(s.createdAt)}</td>
      <td>
        ${s.locked
          ? `<span class="badge badge--locked">${ICONS.lock} Locked</span>`
          : `<span class="badge badge--active">Active</span>`}
      </td>
      <td>
        <div class="action-group">
          ${!s.locked ? `
            <button class="action-btn action-btn--edit" data-id="${s.id}" title="Edit section" aria-label="Edit ${escapeHtml(s.name)}">${ICONS.pencil}</button>
            <button class="action-btn action-btn--delete" data-id="${s.id}" title="Move to trash" aria-label="Delete ${escapeHtml(s.name)}">${ICONS.trash}</button>
          ` : ''}
        </div>
      </td>
    `;
    sectionsTable.appendChild(tr);
  });

  // Bind row actions
  sectionsTable.querySelectorAll('.action-btn--edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  sectionsTable.querySelectorAll('.action-btn--delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSection(btn.dataset.id));
  });
}

function renderTrash(trash) {
  trashTable.innerHTML = '';

  if (trash.length === 0) {
    trashEmpty.hidden = false;
    return;
  }
  trashEmpty.hidden = true;

  trash.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="section-name-cell" style="color: var(--text-muted); text-decoration: line-through;">
          ${escapeHtml(s.name)}
        </div>
      </td>
      <td class="articles-count articles-count--dash col-articles">—</td>
      <td class="created-date">${formatDate(s.deletedAt)}</td>
      <td>
        <div class="action-group">
          <button class="action-btn action-btn--restore" data-id="${s.id}" title="Restore section" aria-label="Restore ${escapeHtml(s.name)}">${ICONS.restore}</button>
          <button class="action-btn action-btn--perm-delete" data-id="${s.id}" title="Delete permanently" aria-label="Permanently delete ${escapeHtml(s.name)}">${ICONS.xCircle}</button>
        </div>
      </td>
    `;
    trashTable.appendChild(tr);
  });

  trashTable.querySelectorAll('.action-btn--restore').forEach(btn => {
    btn.addEventListener('click', () => restoreSection(btn.dataset.id));
  });
  trashTable.querySelectorAll('.action-btn--perm-delete').forEach(btn => {
    btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
  });
}

// â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function addSection(name, slug) {
  const trimmed = name.trim();
  const slugVal = slug.trim();
  // Optimistic duplicate check (in-memory, fast)
  if (sections.some(s => !s.deleted && !s.locked && s.name.toLowerCase() === trimmed.toLowerCase()))
    return 'A section with that name already exists.';
  if (slugVal && sections.some(s => !s.deleted && !s.locked && s.slug === slugVal))
    return 'A section with that URL slug already exists.';
  try {
    const created = await _apiPost('/api/sections', {
      name: trimmed, slug: slugVal, admin_id: genId(trimmed)
    });
    sections.push(created);
    render();
    showToast('success', `Section "${trimmed}" created.`);
    return null;
  } catch(e) {
    return e.message || 'Failed to create section.';
  }
}

async function renameSection(id, name, slug) {
  const trimmed = name.trim();
  const slugVal = slug.trim();
  // Optimistic duplicate check
  if (sections.some(s => s.id !== id && !s.deleted && !s.locked && s.name.toLowerCase() === trimmed.toLowerCase()))
    return 'A section with that name already exists.';
  if (slugVal && sections.some(s => s.id !== id && !s.deleted && !s.locked && s.slug === slugVal))
    return 'A section with that URL slug already exists.';
  try {
    const updated = await _apiPut(`/api/sections?id=${encodeURIComponent(id)}`, { name: trimmed, slug: slugVal });
    const local = sections.find(s => s.id === id);
    if (local) { local.name = updated.name; local.slug = updated.slug; }
    render();
    showToast('success', `Renamed to "${trimmed}".`);
    return null;
  } catch(e) {
    return e.message || 'Failed to rename section.';
  }
}

async function deleteSection(id) {
  const s = sections.find(s => s.id === id);
  if (!s || s.locked) return;
  const name = s.name;
  // Optimistic UI update
  s.deleted = true;
  s.deletedAt = new Date().toISOString();
  render();
  showToast('warning', `"${name}" moved to Trash.`, 'Undo', async () => {
    // Undo: restore via API
    try {
      await _apiPatch(`/api/sections?id=${encodeURIComponent(id)}`);
      s.deleted = false; delete s.deletedAt;
      render();
      showToast('success', `"${name}" restored.`);
    } catch(e) {
      showToast('error', 'Undo failed: ' + e.message);
      await loadSectionsFromAPI();
    }
  });
  // Persist to DB
  try {
    await _apiDelete(`/api/sections?id=${encodeURIComponent(id)}`);
  } catch(e) {
    // Rollback optimistic update on failure
    s.deleted = false; delete s.deletedAt;
    render();
    showToast('error', 'Failed to delete: ' + e.message);
  }
}

async function restoreSection(id) {
  const s = sections.find(s => s.id === id);
  if (!s) return;
  try {
    await _apiPatch(`/api/sections?id=${encodeURIComponent(id)}`);
    s.deleted = false; delete s.deletedAt;
    render();
    showToast('success', `"${s.name}" restored to Active.`);
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
  try {
    await _apiDelete(`/api/sections?id=${encodeURIComponent(id)}&mode=permanent`);
    showToast('error', `"${name}" permanently deleted.`);
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
  const slugVal = slugInput ? slugInput.value.trim() : '';
  if (!nameVal) { showModalError('Section name cannot be empty.'); return; }
  if (slugVal && !validateSlug(slugVal)) {
    showModalError('URL slug: only lowercase letters, numbers, and hyphens allowed.');
    return;
  }
  modalSaveBtn.disabled = true;
  const err = editingId
    ? await renameSection(editingId, nameVal, slugVal)
    : await addSection(nameVal, slugVal);
  modalSaveBtn.disabled = false;
  if (err) { showModalError(err); return; }
  closeModal();
});

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') modalSaveBtn.click(); });
modalCancelBtn.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);
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

// â”€â”€ Page navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PAGE_CONFIG = {
  sections:  { title: 'Sections',  breadcrumb: 'Sections' },
  header:    { title: 'Header Settings', breadcrumb: 'Header' },
  dashboard: { title: 'Dashboard', breadcrumb: 'Dashboard' },
  articles:  { title: 'Articles',  breadcrumb: 'Articles' },
  settings:  { title: 'Settings',  breadcrumb: 'Settings' },
  access:    { title: 'Manage Access', breadcrumb: 'Manage Access' },
};

function navigateTo(page) {
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
  if (page === 'header')   { initHeaderPage(); }
  if (page === 'articles') { initArticlesPage(); }
  if (page === 'sections') {
    // New Section button
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.id = 'add-section-btn';
    btn.innerHTML = `${ICONS.plus} New Section`;
    btn.addEventListener('click', openAddModal);
    topbarActions.appendChild(btn);
  }
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
  if (!user || user.role !== 'Admin') return;
  const li = document.getElementById('nav-access-li');
  if (li) li.style.display = '';
  const addBtn = document.getElementById('access-add-btn');
  if (addBtn) addBtn.addEventListener('click', addAdminEmail);
}

// ── Reusable confirmation modal ─────────────────────────────────
function _confirmModal({ title, body, confirmText = 'Confirm', confirmColor = '#dc2626', onConfirm }) {
  const id = 'access-confirm-modal';
  const ex = document.getElementById(id);
  if (ex) ex.remove();

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const iconHtml = confirmColor === '#dc2626'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" width="24" height="24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const iconBg = confirmColor === '#dc2626' ? '#fee2e2' : '#fef3c7';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:32px 28px;max-width:440px;width:92%;box-shadow:0 24px 64px rgba(0,0,0,.22);text-align:center;">
      <div style="width:52px;height:52px;border-radius:50%;background:${iconBg};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${iconHtml}</div>
      <h3 style="font-size:17px;font-weight:700;color:#111827;margin:0 0 10px;">${escapeHtml(title)}</h3>
      <p  style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 24px;">${body}</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="confirm-modal-cancel" style="background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="confirm-modal-ok"     style="background:${confirmColor};color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer;">${escapeHtml(confirmText)}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#confirm-modal-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#confirm-modal-ok').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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

// ── Tab state ────────────────────────────────────────────────────
let _accessTab = 'active';

function _setAccessTab(tab) {
  _accessTab = tab;
  ['active', 'suspended', 'recycle'].forEach(t => {
    const btn = document.getElementById('access-tab-' + t);
    const pnl = document.getElementById('access-panel-' + t);
    if (btn) btn.classList.toggle('access-tab--active', t === tab);
    if (pnl) pnl.hidden = (t !== tab);
  });
}

// ── Load / render list ───────────────────────────────────────────
async function loadAccessList() {
  const list = document.getElementById('access-list');
  if (!list) return;

  // Inject shell once
  if (!document.getElementById('access-tab-active')) {
    list.innerHTML = `
      <div class="access-tabs" style="display:flex;border-bottom:1px solid #e5e7eb;margin-bottom:0;flex-shrink:0;">
        <button id="access-tab-active"    class="access-tab access-tab--active" onclick="_setAccessTab('active')">Active</button>
        <button id="access-tab-suspended" class="access-tab"                    onclick="_setAccessTab('suspended')">Suspended</button>
        <button id="access-tab-recycle"   class="access-tab"                    onclick="_setAccessTab('recycle')">Recycle</button>
      </div>
      <div id="access-panel-active"></div>
      <div id="access-panel-suspended" hidden></div>
      <div id="access-panel-recycle"   hidden></div>`;

    if (!document.getElementById('access-tab-style')) {
      const s = document.createElement('style');
      s.id = 'access-tab-style';
      s.textContent = `.access-tab{padding:10px 20px;font-size:13px;font-weight:600;color:#6b7280;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:color .15s,border-color .15s}.access-tab:hover{color:#111827}.access-tab--active{color:#1e3a5f;border-bottom-color:#1e3a5f}`;
      document.head.appendChild(s);
    }
  }

  ['active', 'suspended', 'recycle'].forEach(t => {
    const p = document.getElementById('access-panel-' + t);
    if (p) p.innerHTML = '<div style="text-align:center;padding:28px;color:#9ca3af;font-size:13px;">Loading...</div>';
  });

  try {
    const res = await fetch('/api/admins?action=list&include_deleted=true', {
      headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN }
    });
    if (!res.ok) throw new Error('Failed');
    const all = await res.json();

    const me       = ((window.PRIVATIAN_USER && window.PRIVATIAN_USER.email) || '').toLowerCase();
    const active    = all.filter(a => a.status === 'active');
    const suspended = all.filter(a => a.status === 'suspended');
    const deleted   = all.filter(a => a.status === 'deleted');

    // Update tab labels
    const ta = document.getElementById('access-tab-active');
    const ts = document.getElementById('access-tab-suspended');
    const tr = document.getElementById('access-tab-recycle');
    if (ta) ta.textContent = `Active (${active.length})`;
    if (ts) ts.textContent = `Suspended (${suspended.length})`;
    if (tr) tr.textContent = `Recycle (${deleted.length})`;

    function auditLine(a) {
      const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      const LABELS = {
        suspended:                 'Suspended by',
        unsuspended:               'Unsuspended by',
        deleted:                   'Removed by',
        restored:                  'Restored by',
        role_changed_to_Admin:     'Promoted to Admin by',
        role_changed_to_Moderator: 'Downgraded to Moderator by',
      };
      if (a.modified_by && a.modified_action) {
        const label = LABELS[a.modified_action] || (a.modified_action + ' by');
        return `${escapeHtml(label)} <strong>${escapeHtml(a.modified_by)}</strong> &middot; ${fmt(a.modified_at)}`;
      }
      return `Added by <strong>${escapeHtml(a.added_by || 'system')}</strong> &middot; ${fmt(a.added_at)}`;
    }

    function roleColor(role) {
      return role === 'Admin'
        ? 'background:#dbeafe;color:#1e40af'
        : 'background:#d1fae5;color:#065f46';
    }

    function row(a, panel) {
      const isSelf  = a.email.toLowerCase() === me;
      const roleBtn = isSelf ? '' :
        `<button title="Change role" onclick="changeAdminRole('${a.id}','${escapeHtml(a.email)}','${a.role === 'Admin' ? 'Moderator' : 'Admin'}')"
          style="background:none;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#6b7280;">
          → ${a.role === 'Admin' ? 'Moderator' : 'Admin'}
        </button>`;

      let actions = '';
      if (isSelf) {
        actions = '<span style="font-size:12px;color:#9ca3af;padding:2px 8px;">(you)</span>';
      } else if (panel === 'recycle') {
        actions = `
          <button onclick="restoreAdmin('${a.id}','${escapeHtml(a.email)}')"
            style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;padding:4px 11px;font-size:12px;cursor:pointer;color:#059669;font-weight:600;">Restore</button>
          <button onclick="purgeAdmin('${a.id}','${escapeHtml(a.email)}')"
            style="background:#fff0f0;border:1px solid #fca5a5;border-radius:6px;padding:4px 11px;font-size:12px;cursor:pointer;color:#dc2626;font-weight:600;">Delete Permanently</button>`;
      } else {
        const suspendLabel = a.status === 'active' ? 'Suspend' : 'Unsuspend';
        const suspendNew   = a.status === 'active' ? 'suspended' : 'active';
        actions = `
          ${roleBtn}
          <button onclick="toggleAdminStatus('${a.id}','${suspendNew}','${escapeHtml(a.email)}')"
            style="background:none;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#6b7280;">${suspendLabel}</button>
          <button onclick="removeAdmin('${a.id}','${escapeHtml(a.email)}')"
            style="background:none;border:1px solid #fca5a5;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#dc2626;">Remove</button>`;
      }

      return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:600;font-size:14px;color:#111827;">${escapeHtml(a.email)}</div>
          <div style="font-size:11.5px;color:#9ca3af;margin-top:2px;">${auditLine(a)}</div>
        </div>
        <span style="${roleColor(a.role)};border-radius:20px;padding:2px 12px;font-size:11px;font-weight:700;">${escapeHtml(a.role)}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">${actions}</div>
      </div>`;
    }

    const empty = msg => `<div style="text-align:center;padding:36px;color:#9ca3af;font-size:13px;">${msg}</div>`;
    const pA = document.getElementById('access-panel-active');
    const pS = document.getElementById('access-panel-suspended');
    const pR = document.getElementById('access-panel-recycle');
    if (pA) pA.innerHTML = active.length    ? active.map(a=>row(a,'active')).join('')       : empty('No active admins.');
    if (pS) pS.innerHTML = suspended.length ? suspended.map(a=>row(a,'suspended')).join('') : empty('No suspended accounts.');
    if (pR) pR.innerHTML = deleted.length   ? deleted.map(a=>row(a,'recycle')).join('')     : empty('Recycle bin is empty.');

    _setAccessTab(_accessTab);
  } catch(e) {
    const err = '<div style="text-align:center;padding:24px;color:#dc2626;font-size:13px;">Error loading. Please refresh.</div>';
    ['active','suspended','recycle'].forEach(t => {
      const p = document.getElementById('access-panel-' + t); if (p) p.innerHTML = err;
    });
  }
}

// ── Add admin ────────────────────────────────────────────────────
async function addAdminEmail() {
  const emailInput = document.getElementById('access-email-input');
  const roleSelect = document.getElementById('access-role-select');
  const email = (emailInput.value || '').trim().toLowerCase();
  const role  = roleSelect ? roleSelect.value : 'Admin';
  if (!email || !email.includes('@')) { showToast('error', 'Please enter a valid email.'); return; }
  if (!email.endsWith('@gmail.com'))  { showToast('error', 'Only @gmail.com addresses are allowed.'); return; }
  try {
    const res  = await fetch('/api/admins?action=add', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN },
      body: JSON.stringify({ email, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    emailInput.value = '';
    showToast('success', email + ' added as ' + role + '.');
    loadAccessList();
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
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN },
          body: JSON.stringify({ role: newRole })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup('Cannot downgrade: would leave fewer than 2 Gmail Admins.'); return; }
          throw new Error(data.error || 'Failed');
        }
        showToast('success', email + ' is now ' + newRole + '.');
        loadAccessList();
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
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup(); return; }
          throw new Error(data.error || 'Failed');
        }
        showToast('success', 'Status updated to ' + newStatus + '.');
        loadAccessList();
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
        const res  = await fetch('/api/admins?action=remove&id=' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN } });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'min_admins') { _minAdminPopup(); return; }
          throw new Error(data.message || data.error || 'Failed');
        }
        showToast('success', email + ' moved to Recycle.');
        loadAccessList();
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
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN },
          body: JSON.stringify({ status: 'active' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', email + ' restored to Active.');
        _setAccessTab('active');
        loadAccessList();
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
        const res  = await fetch('/api/admins?action=purge&id=' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showToast('success', email + ' permanently deleted.');
        loadAccessList();
      } catch(e) { showToast('error', e.message || 'Failed.'); }
    }
  });
}

// ── Silent access check ──────────────────────────────────────────
let _lastAccessCheck = 0;
let _accessRevoked   = false;

async function checkMyAccess() {
  if (_accessRevoked || !window.PRIVATIAN_TOKEN) return;
  _lastAccessCheck = Date.now();
  try {
    const res  = await fetch('/api/admins?action=check', { headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN } });
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
  { id: 'sub-1', label: 'FAMILY LEGACY', href: 'section.html?slug=community-heritage', icon: null, enabled: true },
  { id: 'sub-2', label: 'EXPERIENCE', href: 'section.html?slug=culture', icon: null, enabled: true },
  { id: 'sub-3', label: 'THE PRIVATIAN READS', href: 'section.html?slug=findings', icon: null, enabled: true },
  { id: 'sub-4', label: 'EVENTS', href: 'index.html#events-section', icon: 'calendar', enabled: true }
];

function loadHeaderSettings() {
  try {
    const raw = localStorage.getItem(HEADER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.subsections) parsed.subsections = DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}));
      return parsed;
    }
  } catch(e) {}
  return {
    logoSvg: null,
    logoHeight: 80,
    enabledNavSections: null,
    subsections: DEFAULT_HEADER_SUBSECTIONS.map(s => ({...s}))
  };
}

function saveHeaderSettings(hs) {
  hs.updatedAt = new Date().toISOString();
  localStorage.setItem(HEADER_SETTINGS_KEY, JSON.stringify(hs));
}

// ── Logo card ───────────────────────────────────────────────────
function renderHsLogoCard(hs) {
  const preview = document.getElementById('hs-logo-preview');
  const svgInput = document.getElementById('hs-logo-svg-input');
  const slider = document.getElementById('hs-logo-height');
  const heightVal = document.getElementById('hs-logo-height-val');

  // Set initial values
  if (svgInput) svgInput.value = hs.logoSvg || '';
  if (slider) { slider.value = hs.logoHeight || 80; if (heightVal) heightVal.textContent = slider.value; }

  // Preview render
  function refreshPreview(svgOverride, hOverride) {
    if (!preview) return;
    const svg = svgOverride !== undefined ? svgOverride : hs.logoSvg;
    const h   = hOverride  !== undefined ? hOverride  : (hs.logoHeight || 80);
    if (svg) {
      preview.innerHTML = svg;
      const svgEl = preview.querySelector('svg');
      if (svgEl) { svgEl.style.height = h + 'px'; svgEl.style.width = 'auto'; svgEl.style.display = 'block'; }
    } else {
      preview.innerHTML = '<div class="hs-preview-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#c8d8e8" stroke-width="1.2" width="32" height="32"><rect x="2" y="3" width="20" height="6" rx="1"/><line x1="2" y1="14" x2="22" y2="14"/><line x1="2" y1="19" x2="13" y2="19"/></svg><span>Default site logo</span><small>' + h + 'px height</small></div>';
    }
  }
  refreshPreview();

  if (slider) {
    slider.addEventListener('input', () => {
      if (heightVal) heightVal.textContent = slider.value;
      refreshPreview(undefined, parseInt(slider.value));
    });
  }

  const applyBtn = document.getElementById('hs-logo-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const svgVal = svgInput ? svgInput.value.trim() : '';
      const h = parseInt(slider ? slider.value : 80);
      // Validate SVG
      if (svgVal && !svgVal.startsWith('<svg')) {
        showToast('error', 'Please paste a valid SVG (must start with <svg...)'); return;
      }
      hs.logoSvg = svgVal || null;
      hs.logoHeight = h;
      saveHeaderSettings(hs);
      refreshPreview();
      showToast('success', 'Logo saved! Refresh the main site to see changes.');
    });
  }

  const resetBtn = document.getElementById('hs-logo-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (svgInput) svgInput.value = '';
      if (slider) { slider.value = 80; if (heightVal) heightVal.textContent = '80'; }
      hs.logoSvg = null;
      hs.logoHeight = 80;
      saveHeaderSettings(hs);
      refreshPreview('', 80);
      showToast('success', 'Logo reset to default.');
    });
  }
}

// ── Nav sections card ───────────────────────────────────────────
function renderHsNavSections(hs) {
  const container = document.getElementById('hs-nav-sections-list');
  if (!container) return;

  const allSecs = sections.filter(s => !s.deleted && !s.locked);
  const enabledIds = hs.enabledNavSections; // null = all enabled

  if (!allSecs.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:8px 0">No sections found. Add sections in the Sections page first.</p>';
    return;
  }

  container.innerHTML = '';
  allSecs.forEach(s => {
    const sectionId = s.slug || s.id;
    const isEnabled = enabledIds === null || enabledIds.indexOf(sectionId) !== -1;
    const row = document.createElement('div');
    row.className = 'hs-section-row';
    row.innerHTML = `
      <div class="hs-section-info">
        <span class="hs-section-name">${escapeHtml(s.name)}</span>
        <span class="hs-slug-chip">${escapeHtml(sectionId)}</span>
      </div>
      <label class="hs-toggle" title="${isEnabled ? 'Visible in header nav' : 'Hidden from header nav'}">
        <input type="checkbox" data-sec-id="${escapeHtml(sectionId)}" ${isEnabled ? 'checked' : ''}>
        <span class="hs-toggle-track"><span class="hs-toggle-thumb"></span></span>
      </label>
    `;
    container.appendChild(row);
  });
}

function getEnabledNavSections() {
  const cbs = document.querySelectorAll('#hs-nav-sections-list input[type="checkbox"]');
  if (!cbs.length) return null;
  const allChecked = Array.from(cbs).every(c => c.checked);
  if (allChecked) return null;
  return Array.from(cbs).filter(c => c.checked).map(c => c.getAttribute('data-sec-id'));
}

// ── Sub-header tabs card ────────────────────────────────────────
function renderHsSubsections(hs) {
  const container = document.getElementById('hs-subsections-list');
  if (!container) return;
  container.innerHTML = '';
  hs.subsections.forEach((sub, idx) => buildHsSubRow(container, sub, hs));
}

function buildHsSubRow(container, sub, hs) {
  const row = document.createElement('div');
  row.className = 'hs-sub-row' + (sub.enabled !== false ? '' : ' hs-sub-row--off');
  row.dataset.subId = sub.id;

  const calBadge = sub.icon === 'calendar' ? '<span class="hs-icon-badge">📅 calendar</span>' : '';

  row.innerHTML = `
    <div class="hs-sub-main">
      <div class="hs-sub-info">
        <span class="hs-sub-lbl">${escapeHtml(sub.label)}</span>
        ${calBadge}
        <span class="hs-sub-url">${escapeHtml(sub.href)}</span>
      </div>
      <div class="hs-sub-actions">
        <label class="hs-toggle hs-toggle--sm">
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
  });

  // Cancel edit
  row.querySelector('.hs-cancel-edit-btn').addEventListener('click', () => { editForm.hidden = true; });

  // Delete
  row.querySelector('.hs-del-sub-btn').addEventListener('click', () => {
    if (!confirm('Delete tab "' + sub.label + '"? This cannot be undone.')) return;
    const idx = hs.subsections.findIndex(s => s.id === sub.id);
    if (idx !== -1) hs.subsections.splice(idx, 1);
    row.remove();
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
      showToast('success', 'Tab added! Click "Apply Header Changes" to save.');
    });
  }
}

// ── Save button ─────────────────────────────────────────────────
function bindHsSaveBtn(hs) {
  const saveBtn = document.getElementById('hs-save-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', () => {
    // Collect enabled nav sections
    hs.enabledNavSections = getEnabledNavSections();
    // Collect logo
    const svgInput = document.getElementById('hs-logo-svg-input');
    const slider   = document.getElementById('hs-logo-height');
    if (svgInput) hs.logoSvg = svgInput.value.trim() || null;
    if (slider) hs.logoHeight = parseInt(slider.value) || 80;

    saveHeaderSettings(hs);

    const orig = saveBtn.innerHTML;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Changes Applied!`;
    saveBtn.style.background = 'var(--success, #1a7a4a)';
    saveBtn.disabled = true;
    setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.style.background = ''; saveBtn.disabled = false; }, 2500);
    showToast('success', 'Header settings saved! Refresh the main site to see changes.');
  });
}

let _hsInstance = null;

function initHeaderPage() {
  _hsInstance = loadHeaderSettings();
  renderHsLogoCard(_hsInstance);
  renderHsNavSections(_hsInstance);
  renderHsSubsections(_hsInstance);
  bindHsAddForm(_hsInstance);
  bindHsSaveBtn(_hsInstance);
}

// ══════════════════════════════════════════════════════════════════
// ARTICLES PAGE
// ══════════════════════════════════════════════════════════════════

let _allArticles = [];

async function initArticlesPage() {
  // Show loading
  document.getElementById('articles-loading').style.display = 'block';
  document.getElementById('articles-table').style.display  = 'none';
  document.getElementById('articles-empty').style.display  = 'none';

  try {
    const res  = await fetch('/api/articles?action=list', {
      headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN }
    });
    _allArticles = await res.json();
  } catch(e) {
    _allArticles = [];
  }

  document.getElementById('articles-loading').style.display = 'none';
  renderArticlesTable(_allArticles);
}

function renderArticlesTable(articles) {
  const tbody = document.getElementById('articles-tbody');
  const table = document.getElementById('articles-table');
  const empty = document.getElementById('articles-empty');

  if (!articles || articles.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';

  tbody.innerHTML = articles.map(a => {
    const updated = a.updated_at
      ? new Date(a.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const isPublished = a.status === 'published';
    const statusBadge = isPublished
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;">● Published</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">● Draft</span>`;

    const thumb = a.hero_img_url
      ? `<img src="${escapeHtml(a.hero_img_url)}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:3px;flex-shrink:0;" loading="lazy"/>`
      : `<div style="width:48px;height:36px;border-radius:3px;background:#e5e7eb;flex-shrink:0;"></div>`;

    return `<tr style="border-bottom:1px solid #f3f4f6;transition:background .1s;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
      <td style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${thumb}
          <div style="min-width:0;">
            <div style="font-size:13.5px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${escapeHtml(a.title || 'Untitled')}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(a.slug || '')}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 16px;font-size:12.5px;color:#6b7280;">${escapeHtml(a.section || '—')}</td>
      <td style="padding:12px 16px;font-size:12.5px;color:#6b7280;">${escapeHtml(a.author || '—')}</td>
      <td style="padding:12px 16px;">${statusBadge}</td>
      <td style="padding:12px 16px;font-size:12px;color:#9ca3af;">${updated}</td>
      <td style="padding:12px 16px;text-align:right;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
          <a href="admin-article-editor.html?id=${escapeHtml(a.id)}"
             style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;background:#e8f1f9;color:#0a528e;text-decoration:none;transition:background .12s;"
             onmouseover="this.style.background='#0a528e';this.style.color='#fff'"
             onmouseout="this.style.background='#e8f1f9';this.style.color='#0a528e'">
            Edit
          </a>
          <button onclick="toggleArticleStatus('${a.id}', this)"
            style="display:inline-flex;align-items:center;padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;transition:all .12s;"
            title="${isPublished ? 'Move to Draft' : 'Publish'}">
            ${isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button onclick="deleteArticleConfirm('${a.id}', '${escapeHtml((a.title||'Untitled').replace(/'/g,"\\'"))}')"
            style="display:inline-flex;align-items:center;padding:5px 9px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid #fee2e2;background:#fff;color:#dc2626;cursor:pointer;transition:all .12s;"
            title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterArticles() {
  const q      = (document.getElementById('articles-search').value || '').toLowerCase();
  const status = document.getElementById('articles-filter-status').value;
  const filtered = _allArticles.filter(a => {
    const matchQ = !q ||
      (a.title  || '').toLowerCase().includes(q) ||
      (a.author || '').toLowerCase().includes(q) ||
      (a.slug   || '').toLowerCase().includes(q) ||
      (a.section|| '').toLowerCase().includes(q);
    const matchStatus = !status || a.status === status;
    return matchQ && matchStatus;
  });
  renderArticlesTable(filtered);
}

async function toggleArticleStatus(id, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res  = await fetch('/api/articles?action=publish&id=' + id, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    // Update local data
    const article = _allArticles.find(a => a.id === id);
    if (article) article.status = data.status;
    renderArticlesTable(_allArticles);
    _showAdminToast(data.status === 'published' ? 'Article published' : 'Moved to draft', 'success');
  } catch(e) {
    _showAdminToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = btn.textContent === '...' ? 'Publish' : btn.textContent;
  }
}

function deleteArticleConfirm(id, title) {
  _confirmModal({
    title: 'Delete Article',
    message: `Are you sure you want to permanently delete "<strong>${escapeHtml(title)}</strong>"? This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: () => _doDeleteArticle(id)
  });
}

async function _doDeleteArticle(id) {
  try {
    const res  = await fetch('/api/articles?action=delete&id=' + id, {
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + window.PRIVATIAN_TOKEN }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    _allArticles = _allArticles.filter(a => a.id !== id);
    renderArticlesTable(_allArticles);
    _showAdminToast('Article deleted', 'success');
  } catch(e) { _showAdminToast(e.message, 'error'); }
}

// Handle direct navigation via hash (e.g. admin.html#articles)
if (window.location.hash === '#articles') {
  window.addEventListener('privatian:ready', () => navigateTo('articles'));
}
