/**
 * ═══════════════════════════════════════════════════════════════════════
 * UNIVERSAL MEDIA MANAGER & UPLOADER MODAL (OPTIMIZED HIGH-SPEED EDITION)
 * The Privatian Family — Standardized Across All Admin Views & Article Editor
 * ═══════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Global state for universal modal
  let _modalCallback = null;
  let _selectedItem = null;
  let _activeTab = 'gallery'; // 'gallery' | 'upload'
  let _activeFolder = 'all';
  let _cachedList = [];
  let _cachedFolders = [];
  let _searchDebounceTimer = null;
  let _lastSearchQuery = '';

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
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Cloudflare R2 Media</span>
            </div>
            <h2 class="umm-header-title" id="umm-header-title">Select or Upload Image</h2>
            <p class="umm-header-sub" id="umm-header-sub">High-performance asset library with instant search</p>
          </div>
          <button type="button" class="umm-close-btn" onclick="window.closeUniversalMediaModal()" title="Close (Esc)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Segmented 2-Tab Navigation -->
        <div class="umm-tabs">
          <button type="button" class="umm-tab-btn active" id="umm-tab-btn-gallery" onclick="window._ummSwitchTab('gallery')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Browse Library</span>
          </button>
          <button type="button" class="umm-tab-btn" id="umm-tab-btn-upload" onclick="window._ummSwitchTab('upload')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Upload New Asset</span>
          </button>
        </div>

        <!-- Body Container -->
        <div class="umm-body">
          <!-- ── TAB 1: BROWSE GALLERY PANE ── -->
          <div class="umm-tab-pane active" id="umm-pane-gallery">
            <div class="umm-gallery-top-bar">
              <div class="umm-search-wrap">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="umm-search-input" class="umm-search-input" placeholder="Search by name, Unique ID (img_...), or paste image URL..." oninput="window._ummOnSearch(this.value)" />
                <button type="button" id="umm-search-clear" class="umm-search-clear" onclick="window._ummClearSearch()" style="display:none;" title="Clear search">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <select id="umm-folder-select" class="umm-folder-select" onchange="window._ummOnFolderFilter(this.value)">
                <option value="all">All Folders</option>
              </select>
            </div>

            <div id="umm-grid" class="umm-grid">
              <!-- Dynamically populated lightweight GPU cards -->
            </div>
          </div>

          <!-- ── TAB 2: UPLOAD FROM DEVICE / DRAG & DROP ── -->
          <div class="umm-tab-pane" id="umm-pane-upload">
            <div class="umm-uploader-card">
              <div class="umm-dest-row">
                <div class="umm-dest-left">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:#0a528e;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>Destination Folder:</span>
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
                <h3 class="umm-dropzone-title">Drag &amp; drop images here, or <span class="umm-dropzone-link">browse files</span></h3>
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

    // Close on backdrop click & ESC key
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) window.closeUniversalMediaModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        window.closeUniversalMediaModal();
      } else if (e.key === 'Enter' && overlay.classList.contains('show') && _selectedItem && _activeTab === 'gallery') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'TEXTAREA') {
          window._ummConfirmSelection();
        }
      }
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

    const folderSet = new Set(_cachedFolders);
    _cachedList.forEach(x => { if (x.folder) folderSet.add(x.folder); });
    const sorted = Array.from(folderSet).sort();

    folderFilter.innerHTML = `<option value="all">All Folders</option><option value="__root__">Root / Uncategorized</option>` +
      sorted.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    folderFilter.value = _activeFolder;

    uploadDest.innerHTML = `<option value="">Root / All Media</option>` +
      sorted.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  }

  /**
   * Render the 60FPS responsive gallery grid with performance optimizations
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

    const q = (searchQuery || '').trim().toLowerCase();
    const isUrl = q.startsWith('http://') || q.startsWith('https://') || q.startsWith('data:image/');

    // Search query filter
    if (q) {
      items = items.filter(x =>
        (x.filename && x.filename.toLowerCase().includes(q)) ||
        (x.title && x.title.toLowerCase().includes(q)) ||
        (x.unique_id && x.unique_id.toLowerCase().includes(q)) ||
        (x.url && x.url.toLowerCase().includes(q)) ||
        (x.folder && x.folder.toLowerCase().includes(q))
      );
    }

    let extraHtml = '';
    // If user pasted a direct URL that is not already in items, show a quick-insert card!
    if (isUrl && !items.some(x => x.url === searchQuery.trim())) {
      const customUrl = searchQuery.trim();
      const isCustomSel = _selectedItem && _selectedItem.url === customUrl;
      extraHtml = `
        <div class="umm-grid-item umm-custom-url-item ${isCustomSel ? 'selected' : ''}" 
             onclick="window._ummSelectCustomUrl('${esc(customUrl)}')" 
             ondblclick="window._ummConfirmSelection()" 
             title="Use External URL: ${esc(customUrl)}">
          <div class="umm-thumb-wrap">
            <img src="${esc(customUrl)}" alt="External image" class="umm-thumb-img" loading="lazy" decoding="async" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2364748b\\' stroke-width=\\'2\\'><path d=\\'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\'/><path d=\\'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\'/></svg>'" />
            <span class="umm-item-folder-badge" style="background:#0a528e;">External Link</span>
            <div class="umm-item-check">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="umm-item-name" style="color:#0a528e;font-weight:700;">Use Direct URL</div>
        </div>
      `;
    }

    if (!items.length && !extraHtml) {
      grid.innerHTML = `
        <div class="umm-empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;color:#94a3b8;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p style="margin:0;font-weight:600;color:#64748b;">No matching images</p>
          <p style="margin:4px 0 0;font-size:11.5px;color:#94a3b8;">${q ? 'Try searching another filename or ID, or upload a new file from the Upload tab.' : 'No images uploaded in this folder yet.'}</p>
        </div>
      `;
      return;
    }

    const itemsHtml = items.map(item => {
      const isSel = _selectedItem && (_selectedItem.unique_id === item.unique_id || _selectedItem.url === item.url);
      const name = item.title || item.filename || 'Image';
      const uid = item.unique_id || 'img';
      return `
        <div class="umm-grid-item ${isSel ? 'selected' : ''}" 
             onclick="window._ummSelectItem('${esc(item.unique_id)}')" 
             ondblclick="window._ummConfirmSelection()" 
             title="${esc(name)} (${esc(uid)})">
          <div class="umm-thumb-wrap">
            <img src="${esc(item.url)}" alt="${esc(name)}" class="umm-thumb-img" loading="lazy" decoding="async" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2364748b\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg>'" />
            ${item.folder ? `<span class="umm-item-folder-badge"><svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${esc(item.folder)}</span>` : ''}
            <div class="umm-item-check">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="umm-item-name">${esc(name)}</div>
        </div>
      `;
    }).join('');

    grid.innerHTML = extraHtml + itemsHtml;
  }

  /**
   * Upload single or multiple files to Cloudflare R2 with non-blocking async execution
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
    let uploadedCount = 0;

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
            <span id="${progId}-pct" style="color:#0a528e;font-weight:700;">Preparing...</span>
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
        if (pctEl) { pctEl.textContent = 'Upload Complete'; pctEl.style.color = '#16a34a'; }

        // Prepend to cached list
        _cachedList.unshift(data.media);
        if (window._rawGalleryList && Array.isArray(window._rawGalleryList)) {
          window._rawGalleryList.unshift(data.media);
        }

        // Set as selected item
        _selectedItem = data.media;
        updateSelectedSummary();
        uploadedCount++;

      } catch(err) {
        console.error('[UniversalMediaModal] Upload error:', err);
        const pctEl = document.getElementById(`${progId}-pct`);
        const barEl = document.getElementById(`${progId}-bar`);
        if (pctEl) { pctEl.textContent = 'Error: ' + err.message; pctEl.style.color = '#dc2626'; }
        if (barEl) { barEl.style.background = '#dc2626'; }
      }
    }

    if (uploadedCount > 0) {
      setTimeout(() => {
        window._ummSwitchTab('gallery');
        renderGalleryGrid();
      }, 500);
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
      const id = _selectedItem.unique_id || 'Direct URL';
      summaryEl.innerHTML = `Selected: <strong>${esc(title)}</strong> (<code style="color:#0a528e;font-weight:700;">${esc(id)}</code>)`;
      confirmBtn.disabled = false;
    } else {
      summaryEl.textContent = 'No image selected';
      confirmBtn.disabled = true;
    }
  }

  // ── Global Window Handlers ─────────────────────────────────────────

  window._ummSwitchTab = function(tabName) {
    _activeTab = tabName;
    const btnGallery = document.getElementById('umm-tab-btn-gallery');
    const btnUpload = document.getElementById('umm-tab-btn-upload');
    const paneGallery = document.getElementById('umm-pane-gallery');
    const paneUpload = document.getElementById('umm-pane-upload');

    if (btnGallery) btnGallery.classList.toggle('active', tabName === 'gallery');
    if (btnUpload) btnUpload.classList.toggle('active', tabName === 'upload');
    if (paneGallery) paneGallery.classList.toggle('active', tabName === 'gallery');
    if (paneUpload) paneUpload.classList.toggle('active', tabName === 'upload');

    if (tabName === 'gallery') {
      const searchInp = document.getElementById('umm-search-input');
      renderGalleryGrid(searchInp ? searchInp.value : '');
    }
  };

  window._ummOnSearch = function(val) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      _lastSearchQuery = val || '';
      const clearBtn = document.getElementById('umm-search-clear');
      if (clearBtn) clearBtn.style.display = _lastSearchQuery ? 'block' : 'none';
      renderGalleryGrid(_lastSearchQuery);
    }, 120);
  };

  window._ummClearSearch = function() {
    const input = document.getElementById('umm-search-input');
    const clearBtn = document.getElementById('umm-search-clear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    _lastSearchQuery = '';
    renderGalleryGrid('');
  };

  window._ummOnFolderFilter = function(folderVal) {
    _activeFolder = folderVal || 'all';
    renderGalleryGrid(_lastSearchQuery);
  };

  window._ummSelectItem = function(uniqueId) {
    const item = _cachedList.find(x => x.unique_id === uniqueId || x.id === uniqueId);
    if (!item) return;
    _selectedItem = item;
    updateSelectedSummary();
    renderGalleryGrid(_lastSearchQuery);
  };

  window._ummSelectCustomUrl = function(customUrl) {
    _selectedItem = {
      unique_id: 'custom_url',
      url: customUrl,
      title: 'Direct Image URL',
      filename: customUrl.split('/').pop().split('?')[0] || 'image.jpg',
      folder: ''
    };
    updateSelectedSummary();
    renderGalleryGrid(_lastSearchQuery);
  };

  window._ummHandleFileInput = function(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
    e.target.value = '';
  };

  window._ummConfirmSelection = function() {
    if (!_selectedItem || !_modalCallback) return;
    try {
      const payload = {
        url: _selectedItem.url,
        uniqueId: _selectedItem.unique_id || '',
        unique_id: _selectedItem.unique_id || '',
        id: _selectedItem.id || _selectedItem.unique_id || '',
        r2_key: _selectedItem.r2_key || '',
        title: _selectedItem.title || _selectedItem.filename || '',
        altText: _selectedItem.alt_text || '',
        altTextBn: _selectedItem.alt_text_bn || '',
        filename: _selectedItem.filename || '',
        mimeType: _selectedItem.mime_type || '',
        folder: _selectedItem.folder || '',
        ..._selectedItem
      };
      _modalCallback(payload);
    } catch(err) {
      console.error('[UniversalMediaModal] Callback error:', err);
    }
    window.closeUniversalMediaModal();
  };

  /**
   * Main Public Entry Point: openUniversalMediaModal(callbackOrOptions)
   */
  window.openUniversalMediaModal = async function(opts = {}) {
    ensureModalDOM();

    let callback = null;
    let title = 'Select Image';
    let subtitle = 'Cloudflare R2 Media Library';
    let defaultTab = 'gallery';
    let targetFolder = '';

    if (typeof opts === 'function') {
      callback = opts;
    } else if (opts && typeof opts === 'object') {
      callback = opts.onSelect || opts.callback || null;
      if (opts.title) title = opts.title;
      if (opts.subtitle) subtitle = opts.subtitle;
      if (opts.defaultTab) defaultTab = opts.defaultTab;
      if (opts.targetFolder) targetFolder = opts.targetFolder;
    }

    _modalCallback = callback;
    _selectedItem = null;
    _activeFolder = targetFolder || 'all';
    _lastSearchQuery = '';

    const titleEl = document.getElementById('umm-header-title');
    const subEl = document.getElementById('umm-header-sub');
    const searchInp = document.getElementById('umm-search-input');
    const clearBtn = document.getElementById('umm-search-clear');
    const overlay = document.getElementById('universal-media-modal-overlay');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (searchInp) searchInp.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    updateSelectedSummary();
    window._ummSwitchTab(defaultTab);

    if (overlay) overlay.classList.add('show');

    // Fetch and render list
    await fetchMediaList();
    if (targetFolder) {
      const folderFilter = document.getElementById('umm-folder-select');
      const uploadDest = document.getElementById('umm-upload-dest-select');
      if (folderFilter) folderFilter.value = targetFolder;
      if (uploadDest) uploadDest.value = targetFolder;
    }
    renderGalleryGrid('');
  };

  window.closeUniversalMediaModal = function() {
    const overlay = document.getElementById('universal-media-modal-overlay');
    if (overlay) overlay.classList.remove('show');
    _modalCallback = null;
    _selectedItem = null;
  };

  // Standard alias for legacy code
  window.openGalleryPicker = window.openUniversalMediaModal;

})();
