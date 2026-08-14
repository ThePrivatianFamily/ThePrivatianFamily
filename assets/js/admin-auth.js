/* ═══════════════════════════════════════════════════════════
   THE PRIVATIAN FAMILY — Admin Auth Frontend Guard
   Redirects to login if session is invalid.
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

  async function checkSession() {
    const token = getToken();
    if (!token) return null;
    try {
      const r = await fetch('/api/auth?action=me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!r.ok) return null;
      return await r.json();
    } catch(e) { return null; }
  }

  // Live DB check — catches suspended/deleted users even if JWT is still valid
  async function checkDbAccess(token) {
    try {
      const r = await fetch('/api/admins?action=check', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const d = await r.json().catch(() => ({}));
      return d; // { ok: true } or { ok: false, reason: '...' }
    } catch(e) { return { ok: true }; } // network error: allow through, periodic check will catch it
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
      // Find the sidebar footer and inject user profile before "View Main Site"
      const sidebarFooter = document.querySelector('.sidebar-footer');
      if (!sidebarFooter || document.getElementById('sidebar-user-profile')) return;

      const profile = document.createElement('div');
      profile.id = 'sidebar-user-profile';
      profile.style.cssText = 'padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);margin-bottom:0;';
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
          '<span style="background:rgba(255,255,255,.15);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;color:rgba(255,255,255,.8);flex-shrink:0;letter-spacing:.04em;">' + esc(user.role) + '</span>' +
        '</div>' +
        '<button id="sidebar-signout-btn" style="width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .2s;"' +
          ' onmouseover="this.style.background=\'rgba(255,255,255,.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,.08)\'">' +
          'Sign Out' +
        '</button>';

      // Insert before the sidebar footer content
      sidebarFooter.insertBefore(profile, sidebarFooter.firstChild);

      document.getElementById('sidebar-signout-btn').addEventListener('click', async function () {
        localStorage.removeItem(TOKEN_KEY);
        await fetch('/api/auth?action=logout', { method: 'POST' }).catch(function(){});
        window.location.replace(LOGIN_URL);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  // ── Main guard ────────────────────────────────────────────
  document.documentElement.style.opacity = '0';
  document.documentElement.style.transition = 'opacity .2s';

  checkSession().then(async function (user) {
    if (!user) {
      redirectToLogin('Session expired. Please sign in again.');
      return;
    }

    // Live DB check: ensure account is still active (catches suspended/deleted mid-session)
    const token   = getToken();
    const dbCheck = await checkDbAccess(token);
    if (!dbCheck.ok) {
      const reason = dbCheck.reason;
      const msg = reason === 'suspended' ? 'Your account has been suspended. Contact another admin.'
                : reason === 'deleted'   ? 'Your account has been removed. Contact another admin.'
                : 'Your session has expired. Please sign in again.';
      redirectToLogin(msg);
      return;
    }

    // Role mismatch: JWT says Admin but DB says Moderator (or vice-versa) — force re-login
    // so the new JWT correctly reflects the current role.
    if (dbCheck.role && dbCheck.role !== user.role) {
      redirectToLogin('Your role has been updated. Please sign in again to continue.');
      return;
    }

    window.PRIVATIAN_USER  = user;
    window.PRIVATIAN_TOKEN = token;

    window.dispatchEvent(new CustomEvent('privatian:ready', { detail: user }));

    document.documentElement.style.opacity = '1';

    injectSidebarUser(user);
  });

})();