/* ═══════════════════════════════════════════════════════════
   THE PRIVATIAN FAMILY — Admin Auth Frontend Guard
   Instant zero-delay local JWT verification + background live DB checks.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TOKEN_KEY = 'privatian_token';
  const LOGIN_URL = '/admin-login.html';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
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
    document.cookie = 'privatian_session=; Max-Age=0; path=/';
  }

  function redirectToLogin(msg) {
    clearSession();
    if (msg) sessionStorage.setItem('login_message', msg);
    window.location.replace(LOGIN_URL);
  }

  function injectSidebarUser(user) {
    function inject() {
      const sidebarFooter = document.querySelector('.sidebar-footer');
      if (!sidebarFooter) return;

      let profile = document.getElementById('sidebar-user-profile');
      if (!profile) {
        profile = document.createElement('div');
        profile.id = 'sidebar-user-profile';
        profile.style.cssText = 'padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);margin-bottom:0;';
        sidebarFooter.insertBefore(profile, sidebarFooter.firstChild);
      }

      profile.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
          (user.picture
            ? '<img src="' + esc(user.picture) + '" referrerpolicy="no-referrer" style="width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.2);flex-shrink:0;" />'
            : '<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">' + esc((user.name||user.email).charAt(0).toUpperCase()) + '</div>'
          ) +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(user.name || user.email) + '</div>' +
            '<div style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(user.email) + '</div>' +
          '</div>' +
          '<span style="background:rgba(255,255,255,.15);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;color:rgba(255,255,255,.8);flex-shrink:0;letter-spacing:.04em;">' + esc(user.role || 'Admin') + '</span>' +
        '</div>' +
        '<button id="sidebar-signout-btn" style="width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .2s;"' +
          ' onmouseover="this.style.background=\'rgba(255,255,255,.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,.08)\'">' +
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

  // ── Instant Local Validation (0ms delay) ───────────────────
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return;
  }

  const payload = parseJwt(token);
  if (!payload || !payload.email || (payload.exp && payload.exp < Date.now() / 1000)) {
    redirectToLogin('Session expired. Please sign in again.');
    return;
  }

  // Establish active session immediately
  const initialUser = {
    email:   payload.email,
    name:    payload.name || payload.email.split('@')[0],
    role:    payload.role || 'Admin',
    picture: payload.picture || ''
  };

  window.PRIVATIAN_USER  = initialUser;
  window.PRIVATIAN_TOKEN = token;

  // Signal app ready immediately
  window.dispatchEvent(new CustomEvent('privatian:ready', { detail: initialUser }));
  injectSidebarUser(initialUser);

  // ── Background Server Validation (Catches revocations/role changes) ──
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

      // Update in-memory user with latest server data
      window.PRIVATIAN_USER = verifiedUser;
      window.dispatchEvent(new CustomEvent('privatian:ready', { detail: verifiedUser }));
      injectSidebarUser(verifiedUser);
    } catch(e) {
      // Network hiccup - allow local session to continue
    }
  })();

  // ── 15-Minute Inactivity Timeout Guard ───────────────────────
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
  let _lastActivityTime = Date.now();

  function recordActivity() {
    _lastActivityTime = Date.now();
  }

  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'input'].forEach(function (evt) {
    window.addEventListener(evt, recordActivity, { passive: true });
  });

  setInterval(function () {
    if (Date.now() - _lastActivityTime > INACTIVITY_TIMEOUT_MS) {
      redirectToLogin('Your session expired due to 15 minutes of inactivity. Please sign in again.');
    }
  }, 20000);

})();