/* ═══════════════════════════════════════════════════════════
   THE PRIVATIAN FAMILY — Admin Auth Frontend Guard & Session Engine
   1. Zero-FOUC Synchronous Pre-Render Shield (0ms leak-proof)
   2. Strict 2-Hour Inactivity Auto-Logout
   3. Continuous Sliding Session Extension on Active Work
   4. Heartbeat Token Renewal & Cross-Tab Activity Sync
   5. Background Live Account Status / Revocation Checks
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TOKEN_KEY       = 'privatian_token';
  const LAST_ACTIVE_KEY = 'privatian_last_active';
  const LOGIN_URL       = '/admin-login.html';

  // 2 Hours of Inactivity Max Limit
  const MAX_INACTIVITY_MS      = 2 * 60 * 60 * 1000;  // 2 hours = 7,200,000 ms
  const WARNING_BEFORE_MS      = 10 * 60 * 1000;      // 10 minutes = 600,000 ms
  const WARNING_TRIGGER_MS     = MAX_INACTIVITY_MS - WARNING_BEFORE_MS; // 1 hr 50 mins
  const HEARTBEAT_INTERVAL_MS  = 15 * 60 * 1000;      // 15 minutes heartbeat refresh
  const THROTTLE_ACTIVITY_MS   = 15 * 1000;           // Throttle activity writes to 15s

  let _lastActivityTime = Date.now();
  let _lastWriteTime    = 0;
  let _warningBannerEl  = null;

  // ── Step 0: Ensure Instant FOUC Guard Shield ────────────────
  // Immediately prevent browser from flashing unauthenticated admin UI
  const existingGuard = document.getElementById('privatian-fouc-guard');
  if (!existingGuard) {
    const style = document.createElement('style');
    style.id = 'privatian-fouc-guard';
    style.innerHTML = 'html, body { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
    if (document.head) {
      document.head.insertBefore(style, document.head.firstChild);
    } else {
      document.documentElement.appendChild(style);
    }
  }

  // ── Step 0b: Dynamic Favicon Support for Admin Panel ────────
  function applyFavicon(url) {
    if (!url || typeof url !== 'string' || !url.trim()) return;
    const clean = url.trim();
    let mimeType = 'image/x-icon';
    if (clean.endsWith('.svg') || clean.includes('.svg')) mimeType = 'image/svg+xml';
    else if (clean.endsWith('.png')) mimeType = 'image/png';
    else if (clean.endsWith('.webp')) mimeType = 'image/webp';
    else if (clean.endsWith('.gif')) mimeType = 'image/gif';

    let iconLink = document.querySelector("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.type = mimeType;
    iconLink.href = clean;

    let shortcutLink = document.querySelector("link[rel='shortcut icon']");
    if (!shortcutLink) {
      shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      document.head.appendChild(shortcutLink);
    }
    shortcutLink.type = mimeType;
    shortcutLink.href = clean;
  }
  window.applyFaviconSettings = applyFavicon;

  try {
    const cachedFavicon = localStorage.getItem('privatian_custom_favicon');
    if (cachedFavicon) applyFavicon(cachedFavicon);
  } catch(e) {}

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getLastActive() {
    const v = localStorage.getItem(LAST_ACTIVE_KEY);
    return v ? parseInt(v, 10) : 0;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch(e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    document.cookie = 'privatian_session=; Max-Age=0; path=/; SameSite=Strict; Secure';
  }

  function redirectToLogin(msg) {
    clearSession();
    if (msg) {
      sessionStorage.setItem('login_message', msg);
    }
    // Keep page invisible while redirecting
    window.location.replace(LOGIN_URL);
  }

  function revealPage() {
    // Remove the FOUC blocker style smoothly
    const guard = document.getElementById('privatian-fouc-guard');
    if (guard) guard.remove();
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    document.documentElement.style.pointerEvents = 'auto';
    if (document.body) {
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
      document.body.style.pointerEvents = 'auto';
    }
  }

  // ── Step 1: Synchronous Zero-Delay Session Validation ───────
  const token = getToken();
  if (!token) {
    redirectToLogin('Authentication required. Please sign in.');
    return;
  }

  const payload = parseJwt(token);
  const now = Date.now();

  if (!payload || !payload.email || (payload.exp && payload.exp * 1000 < now)) {
    redirectToLogin('Your session has expired. Please sign in again.');
    return;
  }

  // Inactivity check on initial load
  const lastActiveStored = getLastActive();
  if (lastActiveStored && (now - lastActiveStored > MAX_INACTIVITY_MS)) {
    redirectToLogin('Your session expired due to 2 hours of inactivity. Please sign in again.');
    return;
  }

  // Session is valid! Update activity timestamp immediately and unhide page
  _lastActivityTime = now;
  localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  revealPage();

  // Establish in-memory user & token
  const initialUser = {
    email:       payload.email,
    name:        payload.full_name || payload.name || payload.email.split('@')[0],
    full_name:   payload.full_name || payload.name || '',
    role:        payload.role || 'Admin',
    picture:     payload.profile_pic || payload.picture || '',
    profile_pic: payload.profile_pic || payload.picture || ''
  };

  window.PRIVATIAN_USER  = initialUser;
  window.PRIVATIAN_TOKEN = token;

  // Signal app ready immediately
  window.dispatchEvent(new CustomEvent('privatian:ready', { detail: initialUser }));

  // ── Step 2: Activity Tracking & Sliding Session Engine ──────
  function recordActivity(explicit) {
    const t = Date.now();
    _lastActivityTime = t;

    // Dismiss warning banner if visible upon user activity
    if (_warningBannerEl && _warningBannerEl.parentNode) {
      _warningBannerEl.remove();
      _warningBannerEl = null;
    }

    if (explicit || (t - _lastWriteTime > THROTTLE_ACTIVITY_MS)) {
      _lastWriteTime = t;
      localStorage.setItem(LAST_ACTIVE_KEY, String(t));
    }
  }

  window.recordPrivatianActivity = recordActivity;

  // Listen to all relevant user interactions
  const activityEvents = ['mousedown', 'mousemove', 'keydown', 'input', 'scroll', 'touchstart', 'focus', 'click', 'paste', 'wheel'];
  activityEvents.forEach(function (evt) {
    window.addEventListener(evt, function () { recordActivity(false); }, { passive: true });
  });

  // Cross-tab synchronization
  window.addEventListener('storage', function (e) {
    if (e.key === LAST_ACTIVE_KEY && e.newValue) {
      const parsed = parseInt(e.newValue, 10);
      if (parsed > _lastActivityTime) {
        _lastActivityTime = parsed;
        if (_warningBannerEl && _warningBannerEl.parentNode) {
          _warningBannerEl.remove();
          _warningBannerEl = null;
        }
      }
    } else if (e.key === TOKEN_KEY && !e.newValue) {
      // Logged out in another tab
      redirectToLogin('You were signed out from another tab.');
    }
  });

  // ── Step 3: Inactivity Monitor & Graceful 10-Minute Warning ──
  function showInactivityWarning(remainingSec) {
    if (_warningBannerEl) {
      const countdownSpan = document.getElementById('privatian-session-countdown');
      if (countdownSpan) {
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        countdownSpan.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }
      return;
    }

    _warningBannerEl = document.createElement('div');
    _warningBannerEl.id = 'privatian-inactivity-warning';
    _warningBannerEl.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 999999',
      'background: #0f172a',
      'color: #f8fafc',
      'border: 1px solid #38bdf8',
      'border-radius: 12px',
      'padding: 16px 20px',
      'box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 15px rgba(56,189,248,0.25)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13.5px',
      'display: flex',
      'align-items: center',
      'gap: 14px'
    ].join(';');

    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    _warningBannerEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:rgba(56,189,248,0.15);color:#38bdf8;flex-shrink:0;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
      '</div>' +
      '<div>' +
        '<div style="font-weight:700;font-size:14px;color:#ffffff;margin-bottom:2px;">Session Expiring Soon</div>' +
        '<div style="color:#94a3b8;font-size:12px;">Auto-logout in <strong id="privatian-session-countdown" style="color:#38bdf8;font-weight:700;">' + timeStr + '</strong> due to inactivity.</div>' +
      '</div>' +
      '<button id="privatian-keep-alive-btn" style="background:#0284c7;color:#fff;border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;margin-left:6px;transition:background .15s;">' +
        'Stay Logged In' +
      '</button>';

    document.body.appendChild(_warningBannerEl);

    const btn = document.getElementById('privatian-keep-alive-btn');
    if (btn) {
      btn.onclick = function () {
        recordActivity(true);
        triggerSessionRefresh();
      };
    }
  }

  // Check inactivity every 10 seconds
  setInterval(function () {
    const currentToken = getToken();
    if (!currentToken) {
      redirectToLogin('Authentication required.');
      return;
    }

    const idleMs = Date.now() - _lastActivityTime;

    if (idleMs >= MAX_INACTIVITY_MS) {
      // 2 Hours of pure inactivity reached -> Auto Logout
      redirectToLogin('Your session expired due to 2 hours of inactivity. Please sign in again.');
      return;
    }

    if (idleMs >= WARNING_TRIGGER_MS) {
      // Within the final 10 minutes of inactivity
      const remainingSec = Math.max(1, Math.round((MAX_INACTIVITY_MS - idleMs) / 1000));
      showInactivityWarning(remainingSec);
    } else {
      if (_warningBannerEl && _warningBannerEl.parentNode) {
        _warningBannerEl.remove();
        _warningBannerEl = null;
      }
    }
  }, 10000);

  // ── Step 4: Active Work Rolling Token Heartbeat Refresh ──────
  async function triggerSessionRefresh() {
    const tok = getToken();
    if (!tok) return;

    try {
      const res = await fetch('/api/auth?action=refresh', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + tok,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
          window.PRIVATIAN_TOKEN = data.token;
          if (data.user) {
            window.PRIVATIAN_USER = data.user;
            window.dispatchEvent(new CustomEvent('privatian:ready', { detail: data.user }));
            injectSidebarUser(data.user);
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        redirectToLogin('Session expired or access revoked. Please sign in again.');
      }
    } catch(e) {
      // Transient network hiccup
    }
  }

  // Periodic heartbeat: if user was active recently, renew token every 15 mins
  setInterval(function () {
    const idleMs = Date.now() - _lastActivityTime;
    if (idleMs < HEARTBEAT_INTERVAL_MS) {
      triggerSessionRefresh();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ── Step 5: Sidebar User Profile Injection & Logout ───────────
  function injectSidebarUser(user) {
    function inject() {
      const sidebarFooter = document.querySelector('.sidebar-footer');
      if (!sidebarFooter) return;

      let profile = document.getElementById('sidebar-user-profile');
      if (!profile) {
        profile = document.createElement('div');
        profile.id = 'sidebar-user-profile';
        profile.style.cssText = 'padding:14px 16px;border-top:1px solid rgba(255,255,255,.1);margin-bottom:0;box-sizing:border-box;';
        sidebarFooter.insertBefore(profile, sidebarFooter.firstChild);
      }

      const displayName = user.full_name || user.name || user.email.split('@')[0];
      const displayPic = user.profile_pic || user.picture || '';

      profile.innerHTML =
        '<div style="display:flex;align-items:flex-start;gap:11px;margin-bottom:12px;">' +
          (displayPic
            ? '<img src="' + esc(displayPic) + '" referrerpolicy="no-referrer" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.28);flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);margin-top:1px;" />'
            : '<div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);margin-top:1px;">' + esc(displayName.charAt(0).toUpperCase()) + '</div>'
          ) +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:13.5px;font-weight:700;color:#ffffff;line-height:1.28;margin-bottom:2px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" title="' + esc(displayName) + '">' + esc(displayName) + '</div>' +
            '<div style="font-size:11px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(user.email) + '">' + esc(user.email) + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">' +
              '<span style="background:rgba(255,255,255,.18);border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:.04em;text-transform:uppercase;">' + esc(user.role || 'Admin') + '</span>' +
              (user.university ? '<span style="font-size:10px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px;" title="' + esc(user.university) + '"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' + esc(user.university) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button id="sidebar-signout-btn" style="width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.8);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .2s;"' +
          ' onmouseover="this.style.background=\'rgba(255,255,255,.16)\';this.style.color=\'#fff\';" onmouseout="this.style.background=\'rgba(255,255,255,.08)\';this.style.color=\'rgba(255,255,255,.8)\';">' +
          'Sign Out' +
        '</button>';

      const signoutBtn = document.getElementById('sidebar-signout-btn');
      if (signoutBtn) {
        signoutBtn.onclick = async function () {
          signoutBtn.disabled = true;
          signoutBtn.textContent = 'Signing out…';
          const tok = getToken();
          if (tok) {
            try {
              await fetch('/api/auth?action=logout', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + tok,
                  'Content-Type': 'application/json'
                }
              });
            } catch(e) {}
          }
          clearSession();
          window.location.replace(LOGIN_URL);
        };
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  window.injectSidebarUser = injectSidebarUser;

  // ── Step 6: Background Server Validation ──────────────────────
  (async function verifyWithServer() {
    try {
      const [resAuth, resDb] = await Promise.all([
        fetch('/api/auth?action=me', { headers: { 'Authorization': 'Bearer ' + token } }),
        fetch('/api/admins?action=check', { headers: { 'Authorization': 'Bearer ' + token } })
      ]);

      if (!resAuth.ok) {
        redirectToLogin('Session expired. Please sign in again.');
        return;
      }

      const verifiedUser = await resAuth.json();
      const dbCheck = await resDb.json().catch(() => ({ ok: true }));

      if (dbCheck && !dbCheck.ok) {
        const reason = dbCheck.reason;
        const msg = reason === 'suspended' ? 'Your account has been suspended. Contact another admin.'
                  : reason === 'deleted'   ? 'Your account has been removed. Contact another admin.'
                  : 'Your session has expired. Please sign in again.';
        redirectToLogin(msg);
        return;
      }

      if (dbCheck && dbCheck.role && dbCheck.role !== verifiedUser.role) {
        redirectToLogin('Your role has been updated. Please sign in again to continue.');
        return;
      }

      // Update in-memory user with latest verified server data
      window.PRIVATIAN_USER = verifiedUser;
      window.dispatchEvent(new CustomEvent('privatian:ready', { detail: verifiedUser }));
      injectSidebarUser(verifiedUser);
    } catch(e) {
      // Network hiccup - local verified session continues
    }
  })();

})();