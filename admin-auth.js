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
              (user.university ? '<span style="font-size:10px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px;" title="' + esc(user.university) + '">🏛️ ' + esc(user.university) + '</span>' : '') +
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