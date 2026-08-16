/**
 * ═══════════════════════════════════════════════════════════════════════
 * UNIVERSAL MEDIA MANAGER & UPLOADER MODAL CONTROLLER
 * The Privatian Family — Standardized Across All Admin Views & Article Editor
 * ═══════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Global state for universal modal
  let _modalCallback = null;
  let _selectedItem = null;
  let _activeTab = 'gallery'; // 'gallery' | 'upload' | 'id'
  let _activeFolder = 'all';
  let _cachedList = [];
  let _cachedFolders = [];
  let _idLookupTimeout = null;
  let _modalConfig = {
    allowIdInput: true,
    title: 'Select Image',
    subtitle: 'Cloudflare R2 Media Library'
  };

  /**
   * Helper to escape HTML strings safely
   */
  function esc(str) {
    return (str || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAuthToken() {
    return window.PRIVATIAN_TOKEN || localStorage.getItem('privatian_token') || '';
  }

  /**
   * Ensures the modal DOM elements are injected into <body>
   */
  function ensureModalDOM() {
    if (document.getElementById('universal-media-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'universal-media-modal-overlay';
    overlay.className = 'umm-overlay';
    overlay.innerHTML = `
      <div class="umm-card" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="umm-header">
          <div class="umm-header-left">
            <div class="umm-header-badge" id="umm-header-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Media Manager</span>
            </div>
            <h2 class="umm-header-title" id="umm-header-title">Choose or Upload Image</h2>
            <p class="umm-header-sub" id="umm-header-sub">Direct high-speed Cloudflare R2 integration</p>
          </div>
          <button type="button" class="umm-close-btn" onclick="window.closeUniversalMediaModal()" title="Close (Esc)">✕</button>
        </div>

        <!-- Segmented Tab Navigation -->
        <div class="umm-tabs">
          <button type="button" class="umm-tab-btn active" id="umm-tab-btn-gallery" onclick="window._ummSwitchTab('gallery')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Browse Gallery</span>
          </button>
          <button type="button" class="umm-tab-btn" id="umm-tab-btn-upload" onclick="window._ummSwitchTab('upload')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Upload from PC / Drag &amp; Drop</span>
          </button>
          <button type="button" class="umm-tab-btn" id="umm-tab-btn-id" onclick="window._ummSwitchTab('id')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Use Unique Asset ID / URL</span>
          </button>
        </div>

        <!-- Body Container -->
        <div class="umm-body">
          <!-- ── TAB 1: BROWSE GALLERY PANE ── -->
          <div class="umm-tab-pane active" id="umm-pane-gallery">
            <div class="umm-gallery-top-bar">
              <div class="umm-search-wrap">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="umm-search-input" class="umm-search-input" placeholder="Search by name, ID or folder..." oninput="window._ummOnSearch(this.value)" />
                <button type="button" id="umm-search-clear" class="umm-search-clear" onclick="window._ummClearSearch()" style="display:none;">&times;</button>
              </div>
              <select id="umm-folder-select" class="umm-folder-select" onchange="window._ummOnFolderFilter(this.value)">
                <option value="all">All Folders</option>
              </select>
            </div>
            <div id="umm-grid" class="umm-grid">
              <!-- Dynamically populated 60fps GPU cards -->
            </div>
          </div>

          <!-- ── TAB 2: UPLOAD FROM DEVICE / DRAG & DROP ── -->
          <div class="umm-tab-pane" id="umm-pane-upload">
            <div class="umm-uploader-card">
              <div class="umm-dest-row">
                <div class="umm-dest-left">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:#0a528e;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>Upload Destination Folder:</span>
                </div>
                <select id="umm-upload-dest-select" class="umm-folder-select" style="min-width:180px;">
                  <option value="">Root / All Media</option>
                </select>
              </div>

              <!-- Animated Drag & Drop Zone -->
              <div class="umm-dropzone" id="umm-dropzone" onclick="document.getElementById('umm-file-input').click()">
                <input type="file" id="umm-file-input" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/gif" style="display:none;" onchange="window._ummHandleFileInput(event)" />
                <div class="umm-dropzone-icon">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h3 class="umm-dropzone-title">Drag &amp; drop images here, or <span class="umm-dropzone-link">browse from PC</span></h3>
                <p class="umm-dropzone-sub">Direct high-speed upload to Cloudflare R2 with automatic unique ID generation</p>
                <div class="umm-dropzone-tags">
                  <span class="umm-dropzone-tag">JPG</span>
                  <span class="umm-dropzone-tag">PNG</span>
                  <span class="umm-dropzone-tag">WEBP</span>
                  <span class="umm-dropzone-tag">SVG</span>
                  <span class="umm-dropzone-tag">GIF</span>
                  <span class="umm-dropzone-tag">AVIF</span>
                  <span class="umm-dropzone-tag" style="background:#e0f2fe;color:#0369a1;">Max 25 MB</span>
                </div>
              </div>

              <!-- Real-time Upload Progress List -->
              <div id="umm-upload-progress-list" style="display:none;flex-direction:column;gap:8px;"></div>
            </div>
          </div>

          <!-- ── TAB 3: USE UNIQUE ASSET ID / URL ── -->
          <div class="umm-tab-pane" id="umm-pane-id">
            <div class="umm-id-resolver-card">
              <label style="font-size:12.5px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:#0a528e;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Enter Gallery Unique Asset ID or Direct Image URL
              </label>

              <div class="umm-id-input-wrap">
                <svg class="umm-id-input-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="umm-id-input" class="umm-id-input" placeholder="e.g. img_8a7f9b2c or https://pub-...r2.dev/..." oninput="window._ummOnIdInput(this.value)" autocomplete="off" />
                <button type="button" class="umm-id-verify-btn" onclick="window._ummLookupId(document.getElementById('umm-id-input').value)">Lookup Asset</button>
              </div>

              <!-- Live Verified Result Card -->
              <div id="umm-id-resolved-card" class="umm-resolved-card" style="display:none;">
                <img id="umm-id-resolved-thumb" src="" alt="Thumbnail" class="umm-resolved-thumb" />
                <div class="umm-resolved-meta">
                  <div class="umm-resolved-title" id="umm-id-resolved-title">—</div>
                  <div style="display:flex;align-items:center;gap:8px;margin:2px 0;">
                    <span class="umm-resolved-id-tag" id="umm-id-resolved-unique-id">—</span>
                    <span class="umm-resolved-status-badge ok" id="umm-id-resolved-status">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                      Verified Asset in Cloudflare R2
                    </span>
                  </div>
                  <div class="umm-resolved-sub" id="umm-id-resolved-sub"></div>
                </div>
              </div>

              <div id="umm-id-error-msg" style="display:none;font-size:12px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:6px;">
                Asset not found in Cloudflare R2 gallery. Please check the Unique ID or URL.
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="umm-footer">
          <div class="umm-selected-summary" id="umm-selected-summary">No image selected</div>
          <div class="umm-footer-btns">
            <button type="button" class="umm-btn umm-btn-cancel" onclick="window.closeUniversalMediaModal()">Cancel</button>
            <button type="button" class="umm-btn umm-btn-confirm" id="umm-btn-confirm" disabled onclick="window._ummConfirmSelection()">
              <span>Insert Selected Image</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) window.closeUniversalMediaModal();
    });

    document.body.appendChild(overlay);
    setupDropzoneEvents();
  }

  /**
   * Set up drag and drop listeners
   */
  function setupDropzoneEvents() {
    const dz = document.getElementById('umm-dropzone');
    if (!dz || dz._bound) return;
    dz._bound = true;

    ['dragenter', 'dragover'].forEach(name => {
      dz.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dz.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('dragover');
      });
    });

    dz.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
    });
  }

  /**
   * Fetch media assets from /api/media
   */
  async function fetchMediaList() {
    try {
      const tok = getAuthToken();
      const res = await fetch('/api/media?action=list', {
        headers: tok ? { 'Authorization': 'Bearer ' + tok } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.items) {
          _cachedList = Array.isArray(data.items) ? data.items : [];
          _cachedFolders = Array.isArray(data.folders) ? data.folders : [];
          populateFolderDropdowns();
          return _cachedList;
        }
      }
    } catch(err) {
      console.warn('[UniversalMediaModal] Failed to fetch list from API:', err);
    }

    // Fallback: check if parent window or global has _rawGalleryList
    if (window._rawGalleryList && Array.isArray(window._rawGalleryList)) {
      _cachedList = window._rawGalleryList;
    }
    return _cachedList;
  }

  /**
   * Populates folder dropdowns
   */
  function populateFolderDropdowns() {
    const folderFilter = document.getElementById('umm-folder-select');
    const uploadDest = document.getElementById('umm-upload-dest-select');
    if (!folderFilter || !uploadDest) return;

    // Collect all distinct folder names
    const folderSet = new Set(_cachedFolders);
    _cachedList.forEach(x => { if (x.folder) folderSet.add(x.folder); });
    const sorted = Array.from(folderSet).sort();

    // Filter dropdown
    folderFilter.innerHTML = `<option value="all">All Folders</option><option value="__root__">Root / Uncategorized</option>` +
      sorted.map(f => `<option value="${esc(f)}">📁 ${esc(f)}</option>`).join('');
    folderFilter.value = _activeFolder;

    // Upload dest dropdown
    uploadDest.innerHTML = `<option value="">Root / All Media</option>` +
      sorted.map(f => `<option value="${esc(f)}">📁 ${esc(f)}</option>`).join('');
  }

  /**
   * Render the 60FPS responsive gallery grid
   */
  function renderGalleryGrid(searchQuery = '') {
    const grid = document.getElementById('umm-grid');
    if (!grid) return;

    let items = _cachedList.filter(x => !x.is_deleted);

    // Folder filter
    if (_activeFolder === '__root__') {
      items = items.filter(x => !x.folder);
    } else if (_activeFolder !== 'all') {
      items = items.filter(x => x.folder === _activeFolder);
    }

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(x =>
        (x.filename && x.filename.toLowerCase().includes(q)) ||
        (x.title && x.title.toLowerCase().includes(q)) ||
        (x.unique_id && x.unique_id.toLowerCase().includes(q)) ||
        (x.folder && x.folder.toLowerCase().includes(q))
      );
    }

    if (!items.length) {
      grid.innerHTML = `
        <div class="umm-empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;color:#cbd5e1;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p style="margin:0;font-weight:600;color:#64748b;">No images found</p>
          <p style="margin:4px 0 0;font-size:11.5px;color:#94a3b8;">Try searching a different keyword or upload a new image from the Upload tab.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isSel = _selectedItem && (_selectedItem.unique_id === item.unique_id || _selectedItem.url === item.url);
      const name = item.title || item.filename || 'Image';
      return `
        <div class="umm-grid-item ${isSel ? 'selected' : ''}" 
             onclick="window._ummSelectItem('${esc(item.unique_id)}')" 
             ondblclick="window._ummConfirmSelection()" 
             title="${esc(name)} (${esc(item.unique_id)})">
          <div class="umm-thumb-wrap">
            <img src="${esc(item.url)}" alt="" class="umm-thumb-img" loading="lazy" decoding="async" />
            ${item.folder ? `<span class="umm-item-folder-badge"><svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${esc(item.folder)}</span>` : ''}
            <div class="umm-item-check">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="umm-item-name">${esc(name)}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Upload single or multiple files to Cloudflare R2
   */
  async function uploadFiles(files) {
    if (!files || !files.length) return;
    const destSelect = document.getElementById('umm-upload-dest-select');
    const targetFolder = destSelect ? destSelect.value : '';
    const progressList = document.getElementById('umm-upload-progress-list');

    if (progressList) {
      progressList.style.display = 'flex';
      progressList.innerHTML = '';
    }

    const tok = getAuthToken();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progId = 'umm-prog-' + i;

      if (progressList) {
        const itemEl = document.createElement('div');
        itemEl.id = progId;
        itemEl.className = 'umm-progress-box';
        itemEl.innerHTML = `
          <div class="umm-progress-info">
            <span>Uploading: <strong>${esc(file.name)}</strong> (${(file.size / (1024*1024)).toFixed(2)} MB)</span>
            <span id="${progId}-pct" style="color:#0a528e;">Preparing...</span>
          </div>
          <div class="umm-progress-bar-bg">
            <div id="${progId}-bar" class="umm-progress-bar-fill" style="width: 25%;"></div>
          </div>
        `;
        progressList.appendChild(itemEl);
      }

      try {
        const base64 = await readFileAsBase64(file);
        const barEl = document.getElementById(`${progId}-bar`);
        const pctEl = document.getElementById(`${progId}-pct`);
        if (barEl) barEl.style.width = '65%';
        if (pctEl) pctEl.textContent = 'Uploading to Cloudflare R2...';

        const res = await fetch('/api/media?action=upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tok ? { 'Authorization': 'Bearer ' + tok } : {})
          },
          body: JSON.stringify({
            fileData: base64,
            filename: file.name,
            mimeType: file.type || 'image/jpeg',
            fileSize: file.size,
            folder: targetFolder
          })
        });

        const data = await res.json();
        if (!res.ok || !data.ok || !data.media) {
          throw new Error(data.error || 'Upload failed');
        }

        if (barEl) { barEl.style.width = '100%'; barEl.style.background = '#16a34a'; }
        if (pctEl) { pctEl.textContent = 'Upload Complete ✓'; pctEl.style.color = '#16a34a'; }

        // Prepend to cached list & select
        _cachedList.unshift(data.media);
        if (window._rawGalleryList && Array.isArray(window._rawGalleryList)) {
          window._rawGalleryList.unshift(data.media);
        }

        // Set as selected item
        _selectedItem = data.media;
        updateSelectedSummary();

        // If only 1 file was uploaded, switch to gallery or show success
        if (files.length === 1) {
          setTimeout(() => {
            window._ummSwitchTab('gallery');
            renderGalleryGrid();
          }, 600);
        }
      } catch(err) {
        console.error('[UniversalMediaModal] Upload error:', err);
        const pctEl = document.getElementById(`${progId}-pct`);
        const barEl = document.getElementById(`${progId}-bar`);
        if (pctEl) { pctEl.textContent = 'Error: ' + err.message; pctEl.style.color = '#dc2626'; }
        if (barEl) { barEl.style.background = '#dc2626'; }
      }
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Update the footer summary and confirm button state
   */
  function updateSelectedSummary() {
    const summaryEl = document.getElementById('umm-selected-summary');
    const confirmBtn = document.getElementById('umm-btn-confirm');
    if (!summaryEl || !confirmBtn) return;

    if (_selectedItem) {
      const title = _selectedItem.title || _selectedItem.filename || 'Image';
      const id = _selectedItem.unique_id || 'ID';
      summaryEl.innerHTML = `Selected: <strong>${esc(title)}</strong> (<code style="color:#0a528e;font-weight:700;">${esc(id)}</code>)`;
      confirmBtn.disabled = false;
    } else {
      summaryEl.textContent = 'No image selected';
      confirmBtn.disabled = true;
    }
  }

  /**
   * Lookup Unique ID / URL
   */
  async function lookupUniqueId(inputVal) {
    const val = (inputVal || '').trim();
    const resCard = document.getElementById('umm-id-resolved-card');
    const errMsg = document.getElementById('umm-id-error-msg');
    const thumb = document.getElementById('umm-id-resolved-thumb');
    const titleEl = document.getElementById('umm-id-resolved-title');
    const idTag = document.getElementById('umm-id-resolved-unique-id');
    const subEl = document.getElementById('umm-id-resolved-sub');

    if (!val) {
      if (resCard) resCard.style.display = 'none';
      if (errMsg) errMsg.style.display = 'none';
      _selectedItem = null;
      updateSelectedSummary();
      return;
    }

    // 1. Try local list search
    let item = _cachedList.find(x => x.unique_id === val || x.id === val || x.url === val);

    // 2. If not found and looks like an ID, query backend API
    if (!item && val.startsWith('img_')) {
      try {
        const tok = getAuthToken();
        const res = await fetch(`/api/media?action=get&id=${encodeURIComponent(val)}`, {
          headers: tok ? { 'Authorization': 'Bearer ' + tok } : {}
        });
        if (res.ok) {
          const d = await res.json();
          if (d && d.ok && d.media) item = d.media;
        }
      } catch(e) {}
    }

    // 3. If looks like a direct URL
    if (!item && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/'))) {
      item = {
        unique_id: 'custom_url',
        url: val,
        filename: val.split('/').pop().split('?')[0] || 'Image URL',
        title: 'Direct Link',
        folder: ''
      };
    }

    if (item) {
      _selectedItem = item;
      if (resCard) {
        resCard.style.display = 'flex';
        resCard.className = 'umm-resolved-card valid';
      }
      if (errMsg) errMsg.style.display = 'none';
      if (thumb) thumb.src = item.url;
      if (titleEl) titleEl.textContent = item.title || item.filename;
      if (idTag) idTag.textContent = item.unique_id || 'Direct URL';
      if (subEl) {
        subEl.innerHTML = `
          <span>📁 ${esc(item.folder || 'Root')}</span>
          ${item.file_size ? `<span>• ${(item.file_size/1024).toFixed(0)} KB</span>` : ''}
          ${item.width && item.height ? `<span>• ${item.width}×${item.height}px</span>` : ''}
        `;
      }
      updateSelectedSummary();
    } else {
      if (resCard) resCard.style.display = 'none';
      if (errMsg) errMsg.style.display = 'block';
      _selectedItem = null;
      updateSelectedSummary();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC GLOBAL WINDOW API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Opens the standardized Universal Media Manager Modal
   * @param {Object} opts
   * @param {string} [opts.title] - Modal title
   * @param {string} [opts.subtitle] - Context subtitle
   * @param {string} [opts.defaultTab] - 'gallery' | 'upload' | 'id'
   * @param {boolean} [opts.allowIdInput] - Set false to hide the Unique ID tab (e.g. Gallery upload)
   * @param {string} [opts.targetFolder] - Pre-selected folder
   * @param {Function} [opts.onSelect] - Callback receiving ({ url, uniqueId, title, altText, altTextBn })
   */
  window.openUniversalMediaModal = function(opts = {}) {
    ensureModalDOM();

    // Accept either callback function directly or configuration object
    if (typeof opts === 'function') {
      _modalCallback = opts;
      _modalConfig = {
        allowIdInput: true,
        title: 'Choose Image from Gallery',
        subtitle: 'Select or upload an asset',
        defaultTab: 'gallery'
      };
    } else {
      _modalCallback = opts.onSelect || null;
      _modalConfig = {
        allowIdInput: opts.allowIdInput !== false,
        title: opts.title || 'Choose or Upload Image',
        subtitle: opts.subtitle || 'Direct high-speed Cloudflare R2 integration',
        defaultTab: opts.defaultTab || 'gallery'
      };
    }

    _selectedItem = null;
    _activeFolder = opts.targetFolder || 'all';

    // Update Titles
    const titleEl = document.getElementById('umm-header-title');
    const subEl = document.getElementById('umm-header-sub');
    if (titleEl) titleEl.textContent = _modalConfig.title;
    if (subEl) subEl.textContent = _modalConfig.subtitle;

    // Toggle Tab 3 (Unique ID tab) visibility
    const tabBtnId = document.getElementById('umm-tab-btn-id');
    if (tabBtnId) {
      tabBtnId.style.display = _modalConfig.allowIdInput ? 'inline-flex' : 'none';
    }

    // Reset progress & ID input
    const progList = document.getElementById('umm-upload-progress-list');
    if (progList) { progList.style.display = 'none'; progList.innerHTML = ''; }
    const idInp = document.getElementById('umm-id-input');
    if (idInp) idInp.value = '';
    const resCard = document.getElementById('umm-id-resolved-card');
    if (resCard) resCard.style.display = 'none';
    const idErr = document.getElementById('umm-id-error-msg');
    if (idErr) idErr.style.display = 'none';

    // Switch to initial tab
    const initialTab = (_modalConfig.defaultTab === 'id' && !_modalConfig.allowIdInput) ? 'gallery' : _modalConfig.defaultTab;
    window._ummSwitchTab(initialTab);

    // Show overlay
    const overlay = document.getElementById('universal-media-modal-overlay');
    if (overlay) overlay.classList.add('show');

    updateSelectedSummary();

    // Fetch and populate list
    fetchMediaList().then(() => {
      renderGalleryGrid();
    });
  };

  /**
   * Close the modal
   */
  window.closeUniversalMediaModal = function() {
    const overlay = document.getElementById('universal-media-modal-overlay');
    if (overlay) overlay.classList.remove('show');
    _modalCallback = null;
    _selectedItem = null;
  };

  /**
   * Switch active tab
   */
  window._ummSwitchTab = function(tabName) {
    _activeTab = tabName;
    ['gallery', 'upload', 'id'].forEach(t => {
      const btn = document.getElementById(`umm-tab-btn-${t}`);
      const pane = document.getElementById(`umm-pane-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.classList.toggle('active', t === tabName);
    });

    if (tabName === 'gallery') {
      renderGalleryGrid();
    }
  };

  /**
   * Search filter
   */
  window._ummOnSearch = function(query) {
    const clearBtn = document.getElementById('umm-search-clear');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
    renderGalleryGrid(query.trim());
  };

  window._ummClearSearch = function() {
    const inp = document.getElementById('umm-search-input');
    if (inp) inp.value = '';
    window._ummOnSearch('');
  };

  /**
   * Folder filter
   */
  window._ummOnFolderFilter = function(folderVal) {
    _activeFolder = folderVal || 'all';
    const inp = document.getElementById('umm-search-input');
    renderGalleryGrid(inp ? inp.value.trim() : '');
  };

  /**
   * Select an item in grid
   */
  window._ummSelectItem = function(uniqueId) {
    const item = _cachedList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
    if (!item) return;
    _selectedItem = item;
    updateSelectedSummary();
    renderGalleryGrid(document.getElementById('umm-search-input')?.value.trim() || '');
  };

  /**
   * File input event handler
   */
  window._ummHandleFileInput = function(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  };

  /**
   * Unique ID live input with debounce
   */
  window._ummOnIdInput = function(val) {
    clearTimeout(_idLookupTimeout);
    _idLookupTimeout = setTimeout(() => lookupUniqueId(val), 300);
  };

  window._ummLookupId = function(val) {
    lookupUniqueId(val);
  };

  /**
   * Confirm selection and call callback
   */
  window._ummConfirmSelection = function() {
    if (!_selectedItem) return;
    if (_modalCallback && typeof _modalCallback === 'function') {
      try {
        _modalCallback({
          url: _selectedItem.url,
          uniqueId: _selectedItem.unique_id || '',
          title: _selectedItem.title || _selectedItem.filename || '',
          altText: _selectedItem.alt_text || '',
          altTextBn: _selectedItem.alt_text_bn || '',
          folder: _selectedItem.folder || '',
          fileSize: _selectedItem.file_size || 0
        });
      } catch(err) {
        console.error('[UniversalMediaModal] Callback execution error:', err);
      }
    }
    window.closeUniversalMediaModal();
  };

  // Keyboard shortcut: Esc to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('universal-media-modal-overlay');
      if (overlay && overlay.classList.contains('show')) {
        window.closeUniversalMediaModal();
      }
    }
  });

  // Export legacy alias for 100% backward compatibility
  window.openGalleryPicker = window.openUniversalMediaModal;
  window.closeGalleryPicker = window.closeUniversalMediaModal;

})();
