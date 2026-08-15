/**
 * api/_lib/activity.js — Enterprise Activity Logger for The Privatian Family
 * 
 * Logs all authentication, administrative, editorial, and layout operations
 * to Supabase `activity_logs` table (with resilient database fallback).
 * 
 * IMMUTABILITY GUARANTEE: This logger is append-only.
 */

const { createClient } = require('@supabase/supabase-js');

function getSbClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function extractClientInfo(req) {
  if (!req) return { ip: 'unknown', userAgent: 'unknown' };
  const headers = req.headers || {};
  const ip = headers['x-forwarded-for']
    ? headers['x-forwarded-for'].split(',')[0].trim()
    : (req.socket ? req.socket.remoteAddress : 'unknown');
  const userAgent = headers['user-agent'] || 'unknown';
  return { ip, userAgent };
}

/**
 * logActivity
 * @param {Object} params
 * @param {Object} [params.actor] - { email, name, role }
 * @param {string} params.action - e.g. 'auth.login', 'article.publish', 'admin.update_role'
 * @param {string} params.category - 'auth' | 'admins' | 'articles' | 'sections' | 'layout' | 'settings'
 * @param {string} params.summary - Human-readable summary (e.g. 'Published article "The Great Awakening"')
 * @param {string} [params.target_id] - Target entity ID
 * @param {string} [params.target_name] - Target entity name / title
 * @param {Object} [params.details] - Extra metadata / diff
 * @param {Object} [params.req] - Express / Vercel request object
 */
async function logActivity({
  actor = null,
  action,
  category = 'general',
  summary,
  target_id = null,
  target_name = null,
  details = {},
  req = null
}) {
  try {
    const sb = getSbClient();
    if (!sb) {
      console.warn('[ActivityLogger] Supabase client unavailable, skipping log.');
      return null;
    }

    const { ip, userAgent } = extractClientInfo(req);
    const enrichedDetails = {
      ...details,
      ip: details.ip || ip,
      userAgent: details.userAgent || userAgent,
      logged_at: new Date().toISOString()
    };

    const actorEmail = actor ? (actor.email || 'system') : 'system';
    const actorName  = actor ? (actor.name || actor.email || 'System') : 'System';
    const actorRole  = actor ? (actor.role || 'Admin') : 'System';

    const logEntry = {
      timestamp: new Date().toISOString(),
      actor_email: actorEmail,
      actor_name: actorName,
      actor_role: actorRole,
      action: action || 'unknown',
      category: category || 'general',
      summary: summary || action,
      target_id: target_id ? String(target_id) : null,
      target_name: target_name ? String(target_name) : null,
      details: enrichedDetails
    };

    // 1. Try inserting directly into `activity_logs` table
    const { data, error } = await sb.from('activity_logs').insert(logEntry).select().maybeSingle();

    if (!error && data) {
      return data;
    }

    logEntry.id = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);

    // 2. If table doesn't exist yet or errors, write to fallback storage in `site_settings`
    let savedInFallback = false;
    try {
      const { data: currentSettings } = await sb
        .from('site_settings')
        .select('value')
        .eq('key', 'activity_logs_store')
        .maybeSingle();

      let logsList = [];
      if (currentSettings && currentSettings.value) {
        logsList = Array.isArray(currentSettings.value) ? currentSettings.value : [];
      }

      logsList.unshift(logEntry);
      if (logsList.length > 3000) logsList = logsList.slice(0, 3000);

      const { error: setErr } = await sb.from('site_settings').upsert({
        key: 'activity_logs_store',
        value: logsList,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      if (!setErr) savedInFallback = true;
    } catch(fbErr) {}

    // 3. Fallback Tier 3: Sections system table (__activity_logs_store__)
    if (!savedInFallback) {
      try {
        const { data: existingRow } = await sb.from('sections').select('id, name').eq('admin_id', '__activity_logs_store__').maybeSingle();
        let logsList = [];
        if (existingRow && existingRow.name) {
          try {
            const parsed = JSON.parse(existingRow.name);
            if (Array.isArray(parsed)) logsList = parsed;
          } catch(e) {}
        }
        logsList.unshift(logEntry);
        if (logsList.length > 3000) logsList = logsList.slice(0, 3000);

        if (existingRow) {
          await sb.from('sections').update({
            name: JSON.stringify(logsList),
            slug: '__activity_logs_store__',
            display_order: 9993,
            is_active: false,
            locked: true,
            is_deleted: true
          }).eq('admin_id', '__activity_logs_store__');
        } else {
          await sb.from('sections').insert({
            admin_id: '__activity_logs_store__',
            name: JSON.stringify(logsList),
            slug: '__activity_logs_store__',
            display_order: 9993,
            is_active: false,
            locked: true,
            is_deleted: true
          });
        }
      } catch(secErr) {
        console.error('[ActivityLogger] Sections table fallback failed:', secErr.message);
      }
    }

    return logEntry;
  } catch(err) {
    console.error('[ActivityLogger] Unexpected error:', err.message);
    return null;
  }
}

module.exports = { logActivity, extractClientInfo };
