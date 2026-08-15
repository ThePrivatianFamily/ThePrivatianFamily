/**
 * api/activity-log.js — Endpoint for Immutable Activity & Audit Logs
 * 
 * Supports:
 *   GET  /api/activity-log?action=list   — List filtered, paginated audit logs (requireAuth)
 *   GET  /api/activity-log?action=stats  — Get activity metrics summary (requireAuth)
 *   POST /api/activity-log?action=log    — Record an authenticated frontend activity (requireAuth)
 * 
 * IMMUTABILITY GUARANTEE: No DELETE or CLEAR endpoints exist.
 */

const { requireAuth } = require('./_lib/auth');
const { logActivity } = require('./_lib/activity');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── 1. LIST AUDIT LOGS ──────────────────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const category = req.query.category || 'all';
    const actor    = req.query.actor || '';
    const search   = (req.query.search || '').trim().toLowerCase();
    const limit    = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
    const offset   = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const client = sb();
    let logs = null;

    // Try fetching from `activity_logs` table
    try {
      let query = client
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (actor) {
        query = query.ilike('actor_email', `%${actor}%`);
      }
      if (search) {
        query = query.or(`summary.ilike.%${search}%,actor_email.ilike.%${search}%,actor_name.ilike.%${search}%,target_name.ilike.%${search}%,action.ilike.%${search}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        logs = {
          items: data,
          total: count !== null ? count : data.length,
          limit,
          offset
        };
      }
    } catch(e) {
      console.warn('[activity-log/list] Supabase table query failed:', e.message);
    }

    // Fallback: fetch from site_settings store or sections system table
    if (!logs) {
      try {
        let rawList = [];
        try {
          const { data: storeRow } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'activity_logs_store')
            .maybeSingle();

          if (storeRow && Array.isArray(storeRow.value) && storeRow.value.length > 0) {
            rawList = storeRow.value;
          }
        } catch(e) {}

        if (rawList.length === 0) {
          try {
            const { data: secRow } = await client
              .from('sections')
              .select('name')
              .eq('admin_id', '__activity_logs_store__')
              .maybeSingle();

            if (secRow && secRow.name) {
              const parsed = JSON.parse(secRow.name);
              if (Array.isArray(parsed)) rawList = parsed;
            }
          } catch(e) {}
        }

        // Apply filters in memory
        if (category && category !== 'all') {
          rawList = rawList.filter(l => l.category === category);
        }
        if (actor) {
          rawList = rawList.filter(l => (l.actor_email || '').toLowerCase().includes(actor.toLowerCase()));
        }
        if (search) {
          rawList = rawList.filter(l =>
            (l.summary || '').toLowerCase().includes(search) ||
            (l.actor_email || '').toLowerCase().includes(search) ||
            (l.actor_name || '').toLowerCase().includes(search) ||
            (l.target_name || '').toLowerCase().includes(search) ||
            (l.action || '').toLowerCase().includes(search)
          );
        }

        const total = rawList.length;
        const paged = rawList.slice(offset, offset + limit);

        logs = {
          items: paged,
          total,
          limit,
          offset
        };
      } catch(fbErr) {
        console.error('[activity-log/list] Fallback list failed:', fbErr.message);
        logs = { items: [], total: 0, limit, offset };
      }
    }

    return res.status(200).json(logs);
  }

  // ── 2. GET ACTIVITY METRICS STATS ───────────────────────────────
  if (action === 'stats' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const client = sb();
    let totalLogs = 0;
    let todayCount = 0;
    let uniqueActors = new Set();
    let lastActivityAt = null;

    try {
      const { data: recent, count, error } = await client
        .from('activity_logs')
        .select('actor_email, timestamp', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (!error && Array.isArray(recent)) {
        totalLogs = count !== null ? count : recent.length;
        if (recent.length > 0) lastActivityAt = recent[0].timestamp;

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        recent.forEach(r => {
          if (r.actor_email) uniqueActors.add(r.actor_email);
          if (r.timestamp && new Date(r.timestamp) >= todayStart) {
            todayCount++;
          }
        });
      }
    } catch(e) {}

    // Fallback if table returned 0
    if (totalLogs === 0) {
      try {
        let list = [];
        try {
          const { data: storeRow } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'activity_logs_store')
            .maybeSingle();

          if (storeRow && Array.isArray(storeRow.value) && storeRow.value.length > 0) {
            list = storeRow.value;
          }
        } catch(e) {}

        if (list.length === 0) {
          try {
            const { data: secRow } = await client
              .from('sections')
              .select('name')
              .eq('admin_id', '__activity_logs_store__')
              .maybeSingle();

            if (secRow && secRow.name) {
              const parsed = JSON.parse(secRow.name);
              if (Array.isArray(parsed)) list = parsed;
            }
          } catch(e) {}
        }

        totalLogs = list.length;
        if (list.length > 0) lastActivityAt = list[0].timestamp;

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        list.forEach(r => {
          if (r.actor_email) uniqueActors.add(r.actor_email);
          if (r.timestamp && new Date(r.timestamp) >= todayStart) {
            todayCount++;
          }
        });
      } catch(e) {}
    }

    return res.status(200).json({
      totalLogs,
      todayCount,
      uniqueActorsCount: uniqueActors.size,
      lastActivityAt
    });
  }

  // ── 3. RECORD CLIENT-SIDE LOG ───────────────────────────────────
  if (action === 'log' && req.method === 'POST') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { action: actName, category, summary, target_id, target_name, details } = req.body || {};
    if (!actName || !summary) {
      return res.status(400).json({ error: 'action and summary are required' });
    }

    const recorded = await logActivity({
      actor: session,
      action: actName,
      category: category || 'general',
      summary,
      target_id,
      target_name,
      details: details || {},
      req
    });

    return res.status(201).json({ success: true, log: recorded });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
