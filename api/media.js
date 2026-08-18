/**
 * /api/media — Dual-Cloud Storage (Cloudflare R2 + Backblaze B2) Management & Metadata API
 *
 * Total Capacity: 20 GB Free (10 GB Cloudflare R2 + 10 GB Backblaze B2)
 *
 * Endpoints:
 * GET  ?action=list                  Auth — List all uploaded media assets across R2 & B2
 * POST ?action=upload                Auth — Upload image files to chosen provider (r2 / b2 / auto)
 * PUT  ?action=update&id=<id>        Auth — Update media metadata (title, alt text, tags)
 * DELETE ?action=delete&id=<id>      Auth — Delete file from its cloud bucket and remove metadata
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('./_lib/auth');
const { handleCors } = require('./_lib/cors');
const { logActivity } = require('./_lib/activity');

// ── 1. CLOUDFLARE R2 CONFIGURATION ───────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '44fa7e7d93ed3ba71fdc0ce85e2dd0ed';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'theprivatianfamily';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://pub-1e6b79ea34c74adfa8dc145a3b5a4e5a.r2.dev').replace(/\/$/, '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '51b83c34bbe3d11ceabd3effda70ad02';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '9f4544f5357f1ebd2c2a4860c8fb1100b59ef2e851ba424d3b4ff9db501a08ec';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── 2. BACKBLAZE B2 CONFIGURATION ────────────────────────────────────────
const B2_KEY_ID = process.env.B2_KEY_ID || '003bacfa081e2ae0000000001';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || 'K003lV8zhvkGSz6s6rt4MjoNPt2aAMQ';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'ThePrivatianFamily';
const B2_REGION = process.env.B2_REGION || 'eu-central-003';
const B2_ENDPOINT = process.env.B2_ENDPOINT || `https://s3.${B2_REGION}.backblazeb2.com`;
const B2_PUBLIC_URL = (process.env.B2_PUBLIC_URL || `https://f003.backblazeb2.com/file/${B2_BUCKET_NAME}`).replace(/\/$/, '');

const b2Client = new S3Client({
  region: B2_REGION,
  endpoint: B2_ENDPOINT,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
});

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.PRIVATIAN_SUPABASE_URL || 'https://aenhajqjsgskimfzvlfr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PRIVATIAN_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmhhanFqc2dza2ltZnp2bGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc1MDUsImV4cCI6MjEwMjE4MzUwNX0.q0wmF77hpsb8M7CQOYMq8GrDuQJ32vn1NcWFXTc5UAY';

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ── HELPER: Unique ID Generator ──────────────────────────────────────────
function generateUniqueMediaId() {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let result = 'img_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sanitizeFilename(originalName) {
  if (!originalName) return 'image';
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const clean = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return clean || 'image';
}

function getExtFromMimeOrName(mimeType, filename) {
  if (mimeType) {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('avif')) return 'avif';
    if (mimeType.includes('svg')) return 'svg';
    if (mimeType.includes('gif')) return 'gif';
  }
  const match = filename && filename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
  return (match && match[1]) ? match[1].toLowerCase() : 'jpg';
}

// ── METADATA STORAGE HELPERS ─────────────────────────────────────────────
const FALLBACK_STORE_KEY = 'privatian_media_library_items';
const FALLBACK_FOLDERS_KEY = 'privatian_media_folders';
const DEFAULT_FOLDERS = ['Articles', 'Hero Banners', 'Authors', 'Logos & Icons', 'Heritage & Archive'];

let _mediaListCache = null;
let _mediaListCacheTime = 0;
const MEDIA_CACHE_TTL_MS = 30000; // 30s cache for fast 10ms responses

function invalidateMediaCache() {
  _mediaListCache = null;
  _mediaListCacheTime = 0;
}

async function getStoredFolderList(sb) {
  if (sb) {
    try {
      const { data } = await sb.from('site_settings').select('value').eq('key', FALLBACK_FOLDERS_KEY).maybeSingle();
      if (data && data.value && Array.isArray(data.value) && data.value.length > 0) {
        return data.value;
      }
    } catch(e) {}
  }
  return [...DEFAULT_FOLDERS];
}

async function saveStoredFolderList(sb, folders) {
  if (!sb || !Array.isArray(folders)) return false;
  try {
    await sb.from('site_settings').upsert({
      key: FALLBACK_FOLDERS_KEY,
      value: folders,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    return true;
  } catch(e) {
    return false;
  }
}

async function getStoredMediaList(sb, forceFresh = false) {
  if (!forceFresh && _mediaListCache && (Date.now() - _mediaListCacheTime < MEDIA_CACHE_TTL_MS)) {
    return _mediaListCache;
  }

  // Concurrently scan Cloudflare R2, Backblaze B2, and Supabase Storage buckets
  const [r2Result, b2Result, sbResult] = await Promise.allSettled([
    r2Client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, MaxKeys: 1000 })),
    b2Client.send(new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, MaxKeys: 1000 })),
    (async () => {
      if (!sb) return [];
      const { data: topFiles } = await sb.storage.from('article-images').list();
      let files = [];
      if (Array.isArray(topFiles)) {
        for (const item of topFiles) {
          if (item.metadata && item.metadata.size) {
            files.push({ ...item, Key: item.name });
          } else if (!item.id && item.name) {
            const { data: subFiles } = await sb.storage.from('article-images').list(item.name);
            if (Array.isArray(subFiles)) {
              for (const sub of subFiles) {
                if (sub.metadata && sub.metadata.size) {
                  files.push({ ...sub, Key: item.name + '/' + sub.name });
                }
              }
            }
          }
        }
      }
      return files;
    })()
  ]);

  let r2Objects = [];
  if (r2Result.status === 'fulfilled' && r2Result.value && Array.isArray(r2Result.value.Contents)) {
    r2Objects = r2Result.value.Contents.filter(o => !o.Key.endsWith('/'));
  } else if (r2Result.status === 'rejected') {
    console.warn('[Media] Cloudflare R2 list error:', r2Result.reason && r2Result.reason.message);
  }

  let b2Objects = [];
  if (b2Result.status === 'fulfilled' && b2Result.value && Array.isArray(b2Result.value.Contents)) {
    b2Objects = b2Result.value.Contents.filter(o => !o.Key.endsWith('/'));
  } else if (b2Result.status === 'rejected') {
    console.warn('[Media] Backblaze B2 list error:', b2Result.reason && b2Result.reason.message);
  }

  let sbObjects = [];
  if (sbResult.status === 'fulfilled' && Array.isArray(sbResult.value)) {
    sbObjects = sbResult.value;
  }

  // Fetch metadata dictionary from Supabase
  let dbMetadataMap = new Map();
  if (sb) {
    try {
      const { data: secData } = await sb.from('sections').select('name').eq('admin_id', '__media_library_store__').maybeSingle();
      if (secData && secData.name) {
        const parsed = JSON.parse(secData.name);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.unique_id) dbMetadataMap.set(item.unique_id, item);
            if (item.id) dbMetadataMap.set(item.id, item);
            if (item.storage_key) dbMetadataMap.set(item.storage_key, item);
            if (item.r2_key) dbMetadataMap.set(item.r2_key, item);
          });
        }
      }
    } catch(e) {}

    try {
      const { data, error } = await sb.from('media_library').select('*');
      if (!error && Array.isArray(data)) {
        data.forEach(item => {
          if (item.unique_id) dbMetadataMap.set(item.unique_id, item);
          if (item.storage_key) dbMetadataMap.set(item.storage_key, item);
          if (item.r2_key) dbMetadataMap.set(item.r2_key, item);
        });
      }
    } catch(e) {}

    try {
      const { data } = await sb.from('site_settings').select('value').eq('key', FALLBACK_STORE_KEY).maybeSingle();
      if (data && data.value && Array.isArray(data.value)) {
        data.value.forEach(item => {
          if (item.unique_id && !dbMetadataMap.has(item.unique_id)) dbMetadataMap.set(item.unique_id, item);
          if (item.storage_key && !dbMetadataMap.has(item.storage_key)) dbMetadataMap.set(item.storage_key, item);
          if (item.r2_key && !dbMetadataMap.has(item.r2_key)) dbMetadataMap.set(item.r2_key, item);
        });
      }
    } catch(e) {}
  }

  const mapObjectToItem = (obj, provider) => {
    const parts = obj.Key.split('/');
    const fname = parts[parts.length - 1];
    const uidMatch = fname.match(/^(img_[a-z0-9]{8})_/);
    const uniqueId = uidMatch ? uidMatch[1] : ('img_' + fname.slice(0, 8).replace(/[^a-z0-9]/g, 'x'));
    const cleanName = fname.replace(/^img_[a-z0-9]{8}_/, '');

    const dbMeta = dbMetadataMap.get(uniqueId) || dbMetadataMap.get(obj.Key) || {};
    let publicUrl = '';
    if (provider === 'b2') {
      publicUrl = `${B2_PUBLIC_URL}/${obj.Key}`;
    } else if (provider === 'supabase') {
      publicUrl = sb ? sb.storage.from('article-images').getPublicUrl(obj.Key).data.publicUrl : '';
    } else {
      publicUrl = `${R2_PUBLIC_URL}/${obj.Key}`;
    }

    const providerNames = {
      r2: 'Cloudflare R2',
      b2: 'Backblaze B2',
      supabase: 'Supabase Storage'
    };

    return {
      id: uniqueId,
      unique_id: uniqueId,
      provider: provider, // 'r2' | 'b2' | 'supabase'
      provider_name: providerNames[provider] || 'Cloud Storage',
      storage_key: obj.Key,
      r2_key: obj.Key, // backward compatibility
      url: dbMeta.url || publicUrl,
      filename: dbMeta.filename || cleanName,
      title: dbMeta.title || cleanName.replace(/\.[^/.]+$/, ''),
      folder: dbMeta.folder || (provider === 'supabase' && parts.length > 1 ? parts[0] : ''),
      alt_text: dbMeta.alt_text || '',
      alt_text_bn: dbMeta.alt_text_bn || '',
      mime_type: (obj.metadata && obj.metadata.mimetype) || dbMeta.mime_type || (fname.endsWith('.svg') ? 'image/svg+xml' : (fname.endsWith('.png') ? 'image/png' : (fname.endsWith('.webp') ? 'image/webp' : 'image/jpeg'))),
      file_size: (obj.metadata && obj.metadata.size) || obj.Size || dbMeta.file_size || 0,
      tags: dbMeta.tags || [],
      uploaded_by: dbMeta.uploaded_by || 'Admin',
      is_deleted: dbMeta.is_deleted === true,
      deleted_at: dbMeta.deleted_at || null,
      created_at: obj.created_at || (obj.LastModified ? new Date(obj.LastModified).toISOString() : (dbMeta.created_at || new Date().toISOString())),
      updated_at: obj.updated_at || dbMeta.updated_at || (obj.LastModified ? new Date(obj.LastModified).toISOString() : new Date().toISOString())
    };
  };

  const allItems = [
    ...r2Objects.map(o => mapObjectToItem(o, 'r2')),
    ...b2Objects.map(o => mapObjectToItem(o, 'b2')),
    ...sbObjects.map(o => mapObjectToItem(o, 'supabase'))
  ];

  if (allItems.length > 0) {
    allItems.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    if (sb) {
      saveAllMediaItems(sb, allItems).catch(() => {});
    }

    _mediaListCache = allItems;
    _mediaListCacheTime = Date.now();
    return allItems;
  }

  // Fallback to database store if both scans returned 0 or were offline
  if (dbMetadataMap.size > 0) {
    const list = Array.from(dbMetadataMap.values());
    list.forEach(item => {
      if (!item.provider) {
        item.provider = item.url?.includes('backblazeb2') ? 'b2' : 'r2';
        item.provider_name = item.provider === 'b2' ? 'Backblaze B2' : 'Cloudflare R2';
      }
    });
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    _mediaListCache = list;
    _mediaListCacheTime = Date.now();
    return list;
  }

  return [];
}

function computeStorageStats(items) {
  const activeItems = items.filter(x => !x.is_deleted);
  const trashItems = items.filter(x => x.is_deleted);

  const SINGLE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB per R2/B2 provider
  const SB_QUOTA_BYTES     = 1024 * 1024 * 1024;       // 1 GB Supabase Storage
  const TOTAL_QUOTA_BYTES  = 21 * 1024 * 1024 * 1024; // 21 GB combined

  // 1. Cloudflare R2 stats
  const r2Items = items.filter(x => x.provider === 'r2' || (!x.provider && !x.url?.includes('backblazeb2') && !x.url?.includes('supabase.co')));
  const r2Active = r2Items.filter(x => !x.is_deleted);
  const r2UsedBytes = r2Items.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const r2FreeBytes = Math.max(0, SINGLE_QUOTA_BYTES - r2UsedBytes);
  const r2UsedPct = (r2UsedBytes / SINGLE_QUOTA_BYTES) * 100;

  // 2. Backblaze B2 stats
  const b2Items = items.filter(x => x.provider === 'b2' || x.url?.includes('backblazeb2'));
  const b2Active = b2Items.filter(x => !x.is_deleted);
  const b2UsedBytes = b2Items.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const b2FreeBytes = Math.max(0, SINGLE_QUOTA_BYTES - b2UsedBytes);
  const b2UsedPct = (b2UsedBytes / SINGLE_QUOTA_BYTES) * 100;

  // 3. Supabase Storage stats
  const sbItems = items.filter(x => x.provider === 'supabase' || x.url?.includes('supabase.co/storage'));
  const sbActive = sbItems.filter(x => !x.is_deleted);
  const sbUsedBytes = sbItems.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const sbFreeBytes = Math.max(0, SB_QUOTA_BYTES - sbUsedBytes);
  const sbUsedPct = (sbUsedBytes / SB_QUOTA_BYTES) * 100;

  // 4. Combined Total stats
  const totalFiles = items.length;
  const activeFiles = activeItems.length;
  const trashFiles = trashItems.length;

  const totalBytes = items.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const activeBytes = activeItems.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const trashBytes = trashItems.reduce((acc, x) => acc + (x.file_size || 0), 0);

  const freeBytes = Math.max(0, TOTAL_QUOTA_BYTES - totalBytes);
  const usedPct = (totalBytes / TOTAL_QUOTA_BYTES) * 100;
  const freePct = Math.max(0, 100 - usedPct);

  const photos = activeItems.filter(x => !x.mime_type?.includes('svg') && !x.filename?.toLowerCase().endsWith('.svg'));
  const svgs = activeItems.filter(x => x.mime_type?.includes('svg') || x.filename?.toLowerCase().endsWith('.svg'));

  return {
    totalFiles,
    activeFiles,
    trashFiles,
    totalBytes,
    activeBytes,
    trashBytes,
    capacityBytes: TOTAL_QUOTA_BYTES, // 21 GB
    freeBytes,
    usedPct,
    freePct,
    photosCount: photos.length,
    photosBytes: photos.reduce((acc, x) => acc + (x.file_size || 0), 0),
    svgsCount: svgs.length,
    svgsBytes: svgs.reduce((acc, x) => acc + (x.file_size || 0), 0),
    avgFileSize: activeFiles > 0 ? Math.round(activeBytes / activeFiles) : 0,
    largestFileSize: activeItems.reduce((max, x) => Math.max(max, x.file_size || 0), 0),
    // Provider breakdown metrics
    r2: {
      provider: 'r2',
      name: 'Cloudflare R2',
      capacityBytes: SINGLE_QUOTA_BYTES,
      usedBytes: r2UsedBytes,
      freeBytes: r2FreeBytes,
      usedPct: r2UsedPct,
      fileCount: r2Items.length,
      activeCount: r2Active.length
    },
    b2: {
      provider: 'b2',
      name: 'Backblaze B2',
      capacityBytes: SINGLE_QUOTA_BYTES,
      usedBytes: b2UsedBytes,
      freeBytes: b2FreeBytes,
      usedPct: b2UsedPct,
      fileCount: b2Items.length,
      activeCount: b2Active.length
    },
    supabase: {
      provider: 'supabase',
      name: 'Supabase Storage',
      capacityBytes: SB_QUOTA_BYTES,
      usedBytes: sbUsedBytes,
      freeBytes: sbFreeBytes,
      usedPct: sbUsedPct,
      fileCount: sbItems.length,
      activeCount: sbActive.length
    }
  };
}

async function saveMediaItemMetadata(sb, item) {
  if (!sb) return false;

  try {
    const { error } = await sb.from('media_library').insert(item);
    if (!error) return true;
  } catch(e) {}

  try {
    const current = await getStoredMediaList(sb);
    const existingIdx = current.findIndex(x => x.unique_id === item.unique_id || x.id === item.id);
    if (existingIdx !== -1) {
      current[existingIdx] = { ...current[existingIdx], ...item, updated_at: new Date().toISOString() };
    } else {
      current.unshift(item);
    }

    return await saveAllMediaItems(sb, current);
  } catch(e) {
    console.error('[Media] saveMediaItemMetadata error:', e.message);
    return false;
  }
}

async function saveAllMediaItems(sb, items) {
  if (!sb || !Array.isArray(items)) return false;
  try {
    await sb.from('site_settings').upsert({
      key: FALLBACK_STORE_KEY,
      value: items,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    await sb.from('sections').update({
      name: JSON.stringify(items)
    }).eq('admin_id', '__media_library_store__');
    return true;
  } catch(e) {
    return false;
  }
}

async function removeMediaItemMetadata(sb, uniqueId) {
  if (!sb) return false;

  try {
    await sb.from('media_library').delete().eq('unique_id', uniqueId);
  } catch(e) {}

  try {
    const current = await getStoredMediaList(sb);
    const updated = current.filter(x => x.unique_id !== uniqueId && x.id !== uniqueId);
    await sb.from('sections').update({
      name: JSON.stringify(updated)
    }).eq('admin_id', '__media_library_store__');
    return true;
  } catch(e) {
    return false;
  }
}

// ── MAIN SERVERLESS HANDLER ──────────────────────────────────────────────
async function handler(req, res) {
  if (handleCors(req, res, 'GET, POST, PUT, DELETE, OPTIONS')) return;

  const action = (req.query && req.query.action) || 'list';
  const sb = getSupabase();

  // ── 1. LIST / SYNC MEDIA (GET or POST) ──────────────────────────────────
  if ((req.method === 'GET' && action === 'list') || action === 'sync') {
    const session = await requireAuth(req, res);
    if (!session) return;

    try {
      const items = await getStoredMediaList(sb, action === 'sync');
      const folders = await getStoredFolderList(sb);
      const storage = computeStorageStats(items);

      return res.status(200).json({
        ok: true,
        count: items.length,
        items,
        folders,
        storage,
        syncStatus: {
          r2: {
            status: 'synced',
            bucket: R2_BUCKET_NAME,
            region: 'auto',
            endpoint: 'Cloudflare R2 Storage (10 GB Free)',
            totalObjects: storage.r2.fileCount,
            totalBytes: storage.r2.usedBytes,
            syncedAt: new Date().toISOString()
          },
          b2: {
            status: 'synced',
            bucket: B2_BUCKET_NAME,
            region: B2_REGION,
            endpoint: 'Backblaze B2 Cloud Storage (10 GB Free)',
            totalObjects: storage.b2.fileCount,
            totalBytes: storage.b2.usedBytes,
            syncedAt: new Date().toISOString()
          },
          supabase: {
            status: 'synced',
            bucket: 'article-images',
            region: 'ap-northeast-1',
            endpoint: 'Supabase Storage Bucket (1 GB Free)',
            totalObjects: storage.supabase.fileCount,
            totalBytes: storage.supabase.usedBytes,
            syncedAt: new Date().toISOString()
          },
          db: {
            status: 'synced',
            provider: 'Supabase PostgreSQL',
            metadataRows: items.length,
            foldersCount: folders.length,
            syncedAt: new Date().toISOString()
          }
        },
        publicUrlPrefix: R2_PUBLIC_URL,
        b2PublicUrlPrefix: B2_PUBLIC_URL
      });
    } catch(err) {
      console.error('[Media] List/Sync error:', err);
      return res.status(500).json({ error: 'Failed to retrieve media library items.' });
    }
  }

  // ── 1b. GET SINGLE ASSET BY ID / UNIQUE_ID (GET) ──────────────────────
  if (req.method === 'GET' && action === 'get') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = (req.query.id || req.query.unique_id || '').trim();
    if (!id) return res.status(400).json({ error: 'id or unique_id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id || x.filename === id);
      if (!item) return res.status(404).json({ error: 'Media asset not found.' });
      return res.status(200).json({ ok: true, media: item });
    } catch(err) {
      console.error('[Media] Get single asset error:', err);
      return res.status(500).json({ error: 'Failed to retrieve asset.' });
    }
  }

  // ── 1c. READ TEXT / RAW CONTENT (E.G. FOR SVG IMPORT) ───────────────────
  if (req.method === 'GET' && (action === 'read_text' || action === 'raw_svg')) {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = (req.query.id || req.query.unique_id || '').trim();
    const storageKey = (req.query.key || '').trim();

    try {
      let targetKey = storageKey;
      let targetProvider = 'r2';

      if (!targetKey && id) {
        const items = await getStoredMediaList(sb);
        const item = items.find(x => x.unique_id === id || x.id === id || x.filename === id);
        if (item) {
          targetKey = item.storage_key || item.r2_key;
          targetProvider = item.provider || (item.url?.includes('backblazeb2') ? 'b2' : 'r2');
        }
      }

      if (!targetKey) {
        return res.status(400).json({ error: 'Valid id, unique_id, or key required.' });
      }

      const client = targetProvider === 'b2' ? b2Client : r2Client;
      const bucket = targetProvider === 'b2' ? B2_BUCKET_NAME : R2_BUCKET_NAME;

      const getRes = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: targetKey
      }));

      const streamToBuffer = async (stream) => {
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
      };

      const buf = await streamToBuffer(getRes.Body);
      const text = buf.toString('utf-8');

      return res.status(200).json({
        ok: true,
        content: text,
        contentType: getRes.ContentType || 'text/plain',
        provider: targetProvider
      });
    } catch(err) {
      console.error('[Media] read_text error:', err);
      return res.status(500).json({ error: 'Failed to read media content.' });
    }
  }

  // ── 2. UPLOAD MEDIA TO CLOUD STORAGE (POST) ────────────────────────────
  if (req.method === 'POST' && action === 'upload') {
    const session = await requireAuth(req, res);
    if (!session) return;

    try {
      const body = req.body || {};
      const {
        fileData,        // Base64 data string
        filename,        // Original filename
        mimeType,        // image/jpeg, image/png, etc.
        folder,          // Target folder name
        title,           // Human title
        altText,         // Accessibility alt text
        altTextBn,       // Bengali alt text
        tags,            // Array or comma string
        provider         // 'r2' | 'b2' | 'auto'
      } = body;

      if (!fileData) {
        return res.status(400).json({ error: 'fileData (base64 image payload) is required.' });
      }

      // Extract raw buffer from Base64
      let base64Clean = fileData;
      let detectedMime = mimeType || 'image/jpeg';

      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          detectedMime = matches[1];
          base64Clean = matches[2];
        }
      }

      const fileBuffer = Buffer.from(base64Clean, 'base64');
      const fileSize = fileBuffer.length;

      if (fileSize > 25 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds 25MB limit.' });
      }

      // Determine Target Provider ('r2', 'b2', or 'supabase')
      let targetProvider = (provider || 'r2').toLowerCase();
      if (targetProvider !== 'b2' && targetProvider !== 'r2' && targetProvider !== 'supabase') {
        targetProvider = 'r2'; // default
      }

      const uniqueId = generateUniqueMediaId();
      const ext = getExtFromMimeOrName(detectedMime, filename);
      const safeName = sanitizeFilename(filename);
      const datePath = new Date().toISOString().slice(0, 7).replace('-', '/'); // '2026/08'
      const targetFolder = (folder || '').trim();
      const storageKey = `gallery/${datePath}/${uniqueId}_${safeName}.${ext}`;

      let publicUrl = '';
      if (targetProvider === 'supabase') {
        if (!sb) throw new Error('Supabase Storage is unavailable.');
        const { error: sbErr } = await sb.storage
          .from('article-images')
          .upload(storageKey, fileBuffer, {
            contentType: detectedMime,
            upsert: true
          });
        if (sbErr) throw new Error(sbErr.message);
        publicUrl = sb.storage.from('article-images').getPublicUrl(storageKey).data.publicUrl;
      } else {
        const client = targetProvider === 'b2' ? b2Client : r2Client;
        const bucket = targetProvider === 'b2' ? B2_BUCKET_NAME : R2_BUCKET_NAME;
        publicUrl = targetProvider === 'b2'
          ? `${B2_PUBLIC_URL}/${storageKey}`
          : `${R2_PUBLIC_URL}/${storageKey}`;

        const uploadParams = {
          Bucket: bucket,
          Key: storageKey,
          Body: fileBuffer,
          ContentType: detectedMime,
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata: {
            'unique-id': uniqueId,
            'original-name': filename || 'image',
            'folder': targetFolder,
            'uploaded-by': session.email || 'admin'
          }
        };

        await client.send(new PutObjectCommand(uploadParams));
      }

      const providerNames = {
        r2: 'Cloudflare R2',
        b2: 'Backblaze B2',
        supabase: 'Supabase Storage'
      };

      const mediaItem = {
        id: uniqueId,
        unique_id: uniqueId,
        provider: targetProvider,
        provider_name: providerNames[targetProvider] || 'Cloud Storage',
        url: publicUrl,
        storage_key: storageKey,
        r2_key: storageKey, // backward compatibility
        folder: targetFolder,
        filename: filename || `${uniqueId}.${ext}`,
        title: title || (filename ? filename.replace(/\.[^/.]+$/, '') : uniqueId),
        alt_text: altText || '',
        alt_text_bn: altTextBn || '',
        mime_type: detectedMime,
        file_size: fileSize,
        width: body.width || null,
        height: body.height || null,
        tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []),
        uploaded_by: session.email || session.name || 'Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (sb) {
        await saveMediaItemMetadata(sb, mediaItem);
      }
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.upload',
          category: 'media',
          summary: `${session.name || session.email} uploaded image "${mediaItem.filename}" (ID: ${uniqueId}) to ${mediaItem.provider_name}`,
          target_id: uniqueId,
          target_name: mediaItem.filename,
          details: { unique_id: uniqueId, url: publicUrl, folder: targetFolder, size: fileSize, provider: targetProvider },
          req
        });
      } catch(e) {}

      return res.status(201).json({
        ok: true,
        message: `Image successfully uploaded to ${mediaItem.provider_name}.`,
        media: mediaItem
      });
    } catch(err) {
      console.error('[Media] Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload image: ' + (err.message || 'Unknown error') });
    }
  }

  // ── 3. FOLDER ACTIONS ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'create_folder') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const name = (req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });

    try {
      const folders = await getStoredFolderList(sb);
      if (!folders.includes(name)) {
        folders.push(name);
        await saveStoredFolderList(sb, folders);
        invalidateMediaCache();
      }

      try {
        await logActivity({
          actor: session,
          action: 'media.create_folder',
          category: 'media',
          summary: `${session.name || session.email} created media folder "${name}"`,
          target_id: name,
          target_name: name,
          details: { folder: name },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, folders });
    } catch(err) {
      console.error('[Media] create_folder error:', err);
      return res.status(500).json({ error: 'Failed to create folder.' });
    }
  }

  if (req.method === 'PUT' && action === 'rename_folder') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const oldName = (req.body && req.body.oldName || '').trim();
    const newName = (req.body && req.body.newName || '').trim();
    if (!oldName || !newName) return res.status(400).json({ error: 'Both oldName and newName are required.' });

    try {
      const folders = await getStoredFolderList(sb);
      const idx = folders.indexOf(oldName);
      if (idx !== -1) {
        folders[idx] = newName;
        await saveStoredFolderList(sb, folders);
      }

      const items = await getStoredMediaList(sb);
      let updatedCount = 0;
      items.forEach(item => {
        if (item.folder === oldName) {
          item.folder = newName;
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        await saveAllMediaItems(sb, items);
      }
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.rename_folder',
          category: 'media',
          summary: `${session.name || session.email} renamed folder "${oldName}" to "${newName}" (${updatedCount} assets updated)`,
          target_id: newName,
          target_name: newName,
          details: { oldName, newName, updatedCount },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, folders });
    } catch(err) {
      console.error('[Media] rename_folder error:', err);
      return res.status(500).json({ error: 'Failed to rename folder.' });
    }
  }

  if (req.method === 'DELETE' && action === 'delete_folder') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const name = (req.query.name || req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });

    try {
      let folders = await getStoredFolderList(sb);
      folders = folders.filter(f => f !== name);
      await saveStoredFolderList(sb, folders);

      const items = await getStoredMediaList(sb);
      let updatedCount = 0;
      items.forEach(item => {
        if (item.folder === name) {
          item.folder = '';
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        await saveAllMediaItems(sb, items);
      }
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.delete_folder',
          category: 'media',
          summary: `${session.name || session.email} deleted folder "${name}"`,
          target_id: name,
          target_name: name,
          details: { folder: name, movedAssets: updatedCount },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, folders });
    } catch(err) {
      console.error('[Media] delete_folder error:', err);
      return res.status(500).json({ error: 'Failed to delete folder.' });
    }
  }

  if (req.method === 'PUT' && action === 'move') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const targetFolder = (req.body && req.body.folder !== undefined ? req.body.folder : '').trim();
    const rawIds = req.body && (req.body.ids || [req.body.id]);
    const ids = Array.isArray(rawIds) ? rawIds.filter(Boolean) : [];

    if (!ids.length) return res.status(400).json({ error: 'At least one asset id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      let movedCount = 0;

      items.forEach(item => {
        if (ids.includes(item.unique_id) || ids.includes(item.id)) {
          item.folder = targetFolder;
          item.updated_at = new Date().toISOString();
          movedCount++;
        }
      });

      await saveAllMediaItems(sb, items);
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.move',
          category: 'media',
          summary: `${session.name || session.email} moved ${movedCount} asset(s) to "${targetFolder || 'Root'}"`,
          target_id: ids.join(','),
          target_name: targetFolder || 'Root',
          details: { ids, targetFolder, movedCount },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, movedCount, targetFolder });
    } catch(err) {
      console.error('[Media] move error:', err);
      return res.status(500).json({ error: 'Failed to move assets.' });
    }
  }

  // ── 4. UPDATE METADATA (PUT) ───────────────────────────────────────────
  if (req.method === 'PUT' && action === 'update') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id or unique_id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);
      if (!item) return res.status(404).json({ error: 'Media item not found.' });

      const body = req.body || {};
      if (body.title !== undefined) item.title = body.title;
      if (body.folder !== undefined) item.folder = (body.folder || '').trim();
      if (body.alt_text !== undefined) item.alt_text = body.alt_text;
      if (body.alt_text_bn !== undefined) item.alt_text_bn = body.alt_text_bn;
      if (body.tags !== undefined) {
        item.tags = Array.isArray(body.tags) ? body.tags : String(body.tags).split(',').map(t => t.trim()).filter(Boolean);
      }
      item.updated_at = new Date().toISOString();

      await saveMediaItemMetadata(sb, item);
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.update',
          category: 'media',
          summary: `${session.name || session.email} updated metadata for image "${item.filename}" (${item.unique_id})`,
          target_id: item.unique_id,
          target_name: item.filename,
          details: { title: item.title, folder: item.folder, alt_text: item.alt_text },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, media: item });
    } catch(err) {
      console.error('[Media] Update error:', err);
      return res.status(500).json({ error: 'Failed to update media item.' });
    }
  }

/**
 * Find all articles in the database that reference a given media item (by ID, Unique ID, Storage Key, or URL).
 * An article references an image if:
 * 1. hero_img_url matches or contains the image url / unique_id / storage_key
 * 2. content_html or content_html_bn contains the image url / unique_id / storage_key
 * 3. author_photo_url matches or contains the image url / unique_id / storage_key
 * 4. content (draft JSON) contains the image url / unique_id / storage_key
 *
 * NOTE: As per user rule, even if an article is in trash (is_deleted: true), the image CANNOT be trashed or deleted
 * until that article is PERMANENTLY deleted from the articles table or the image is unlinked.
 */
async function findArticlesUsingMediaItem(sb, item) {
  if (!sb || !item) return [];
  try {
    const { data: articles, error } = await sb
      .from('articles')
      .select('id, title, title_bn, slug, hero_img_url, content_html, content_html_bn, content, author_photo_url, is_deleted, status');
    if (error || !Array.isArray(articles)) return [];

    const uid = (item.unique_id || item.id || '').trim();
    const url = (item.url || '').trim();
    const key = (item.storage_key || item.r2_key || '').trim();
    const filename = (item.filename || '').trim();

    // Identifiers to search for
    const needles = [uid, url, key, filename].filter(x => x && x.length >= 4);
    if (!needles.length) return [];

    const matchingArticles = articles.filter(art => {
      // 1. Check hero_img_url
      if (art.hero_img_url && needles.some(n => art.hero_img_url.includes(n))) return true;
      // 2. Check author_photo_url
      if (art.author_photo_url && needles.some(n => art.author_photo_url.includes(n))) return true;
      // 3. Check content_html
      if (art.content_html && needles.some(n => art.content_html.includes(n))) return true;
      // 4. Check content_html_bn
      if (art.content_html_bn && needles.some(n => art.content_html_bn.includes(n))) return true;
      // 5. Check content (working draft JSON)
      if (art.content && typeof art.content === 'string' && needles.some(n => art.content.includes(n))) return true;
      return false;
    });

    return matchingArticles.map(a => ({
      id: a.id,
      title: a.title || a.title_bn || 'Untitled Article',
      title_bn: a.title_bn || '',
      slug: a.slug || a.id,
      status: a.status,
      is_deleted: !!a.is_deleted
    }));
  } catch (err) {
    console.error('[Media] findArticlesUsingMediaItem error:', err);
    return [];
  }
}

  // ── 5. TRASH & DELETION ACTIONS ────────────────────────────────────────
  if ((req.method === 'DELETE' || req.method === 'POST') && action === 'trash') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);
      if (!item) return res.status(404).json({ error: 'Media asset not found.' });

      // GUARD: Prevent moving to trash if image is currently used in any article
      const usedInArticles = await findArticlesUsingMediaItem(sb, item);
      if (usedInArticles.length > 0) {
        const artNames = usedInArticles.map(a => `"${a.title}"${a.is_deleted ? ' (In Article Trash)' : ''}`).join(', ');
        return res.status(409).json({
          error: `Cannot move to Trash: This image is currently in use by ${usedInArticles.length} article(s): ${artNames}. Delete or unlink the article(s) permanently first.`,
          error_bn: `এই ছবিটি ${usedInArticles.length}টি আর্টিকেলে (${artNames}) ব্যবহৃত হচ্ছে। আর্টিকেলটি স্থায়ীভাবে মুছে না ফেলা পর্যন্ত ছবিটি ট্র্যাশে পাঠানো যাবে না।`,
          is_in_use: true,
          used_in_articles: usedInArticles
        });
      }

      item.is_deleted = true;
      item.deleted_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();

      await saveAllMediaItems(sb, items);
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.trash',
          category: 'media',
          summary: `${session.name || session.email} moved image "${item.filename}" to Trash Bin`,
          target_id: id,
          target_name: item.filename,
          details: { id, storage_key: item.storage_key || item.r2_key, provider: item.provider },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, message: 'Image moved to Trash Bin.', media: item });
    } catch(err) {
      console.error('[Media] Trash error:', err);
      return res.status(500).json({ error: 'Failed to move media asset to Trash.' });
    }
  }

  if (req.method === 'POST' && action === 'restore') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);
      if (!item) return res.status(404).json({ error: 'Media asset not found.' });

      item.is_deleted = false;
      item.deleted_at = null;
      item.updated_at = new Date().toISOString();

      await saveAllMediaItems(sb, items);
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.restore',
          category: 'media',
          summary: `${session.name || session.email} restored image "${item.filename}" from Trash Bin`,
          target_id: id,
          target_name: item.filename,
          details: { id, storage_key: item.storage_key || item.r2_key, provider: item.provider },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, message: 'Image restored to active gallery.', media: item });
    } catch(err) {
      console.error('[Media] Restore error:', err);
      return res.status(500).json({ error: 'Failed to restore media asset.' });
    }
  }

  if (req.method === 'DELETE' && (action === 'delete' || action === 'delete_permanent')) {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);

      // GUARD: Prevent permanent deletion if image is currently used in any article
      if (item) {
        const usedInArticles = await findArticlesUsingMediaItem(sb, item);
        if (usedInArticles.length > 0) {
          const artNames = usedInArticles.map(a => `"${a.title}"${a.is_deleted ? ' (In Article Trash)' : ''}`).join(', ');
          return res.status(409).json({
            error: `Cannot delete permanently: This image is currently in use by ${usedInArticles.length} article(s): ${artNames}. Delete or unlink the article(s) permanently first.`,
            error_bn: `এই ছবিটি ${usedInArticles.length}টি আর্টিকেলে (${artNames}) ব্যবহৃত হচ্ছে। আর্টিকেলটি স্থায়ীভাবে মুছে না ফেলা পর্যন্ত ছবিটি স্থায়ীভাবে মোছা যাবে না।`,
            is_in_use: true,
            used_in_articles: usedInArticles
          });
        }
      }

      const key = item && (item.storage_key || item.r2_key);
      const provider = (item && item.provider) || (item && item.url?.includes('backblazeb2') ? 'b2' : (item && item.url?.includes('supabase.co') ? 'supabase' : 'r2'));

      if (key) {
        if (provider === 'b2') {
          try {
            await b2Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key }));
          } catch(e) {}
        } else if (provider === 'supabase') {
          try {
            if (sb) await sb.storage.from('article-images').remove([key]);
          } catch(e) {}
        } else {
          try {
            await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
          } catch(e) {}
        }
      }

      await removeMediaItemMetadata(sb, id);
      invalidateMediaCache();

      const providerDisplayNames = {
        r2: 'Cloudflare R2',
        b2: 'Backblaze B2',
        supabase: 'Supabase Storage'
      };

      try {
        await logActivity({
          actor: session,
          action: 'media.delete_permanent',
          category: 'media',
          summary: `${session.name || session.email} permanently erased image "${(item && item.filename) || id}" from ${providerDisplayNames[provider] || 'Cloud Storage'}`,
          target_id: id,
          target_name: (item && item.filename) || id,
          details: { id, storage_key: key, provider },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, message: 'Image permanently deleted from cloud storage.' });
    } catch(err) {
      console.error('[Media] Permanent delete error:', err);
      return res.status(500).json({ error: 'Failed to delete media asset.' });
    }
  }

  if ((req.method === 'POST' || req.method === 'DELETE') && action === 'empty_trash') {
    const session = await requireAuth(req, res);
    if (!session) return;

    try {
      const items = await getStoredMediaList(sb);
      const trashedItems = items.filter(x => x.is_deleted);
      let deletedCount = 0;
      let skippedCount = 0;
      const skippedDetails = [];

      for (const item of trashedItems) {
        // Protect if in use
        const usedInArticles = await findArticlesUsingMediaItem(sb, item);
        if (usedInArticles.length > 0) {
          skippedCount++;
          skippedDetails.push({ filename: item.filename, articles: usedInArticles });
          continue;
        }

        const key = item.storage_key || item.r2_key;
        const provider = item.provider || (item.url?.includes('backblazeb2') ? 'b2' : (item.url?.includes('supabase.co') ? 'supabase' : 'r2'));

        if (key) {
          if (provider === 'b2') {
            try { await b2Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key })); } catch(e) {}
          } else if (provider === 'supabase') {
            try { if (sb) await sb.storage.from('article-images').remove([key]); } catch(e) {}
          } else {
            try { await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })); } catch(e) {}
          }
        }
        await removeMediaItemMetadata(sb, item.unique_id || item.id);
        deletedCount++;
      }
      invalidateMediaCache();

      try {
        await logActivity({
          actor: session,
          action: 'media.empty_trash',
          category: 'media',
          summary: `${session.name || session.email} emptied Trash Bin (${deletedCount} assets erased${skippedCount > 0 ? `, ${skippedCount} protected assets skipped` : ''})`,
          details: { deletedCount, skippedCount, skippedDetails },
          req
        });
      } catch(e) {}

      let msg = `Trash emptied (${deletedCount} assets permanently erased).`;
      if (skippedCount > 0) {
        msg += ` Note: ${skippedCount} image(s) were protected and kept because they are in use by existing articles.`;
      }

      return res.status(200).json({ ok: true, deletedCount, skippedCount, message: msg });
    } catch(err) {
      console.error('[Media] Empty trash error:', err);
      return res.status(500).json({ error: 'Failed to empty Trash Bin.' });
    }
  }

  // ── 6. CHECK MEDIA ASSET ARTICLE USAGE (GET) ───────────────────────────
  if (req.method === 'GET' && action === 'usage') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);
      if (!item) return res.status(404).json({ error: 'Media asset not found.' });

      const usedInArticles = await findArticlesUsingMediaItem(sb, item);
      return res.status(200).json({
        ok: true,
        media_id: id,
        filename: item.filename,
        is_in_use: usedInArticles.length > 0,
        used_in_articles: usedInArticles
      });
    } catch(err) {
      console.error('[Media] Usage check error:', err);
      return res.status(500).json({ error: 'Failed to check media asset usage.' });
    }
  }

  return res.status(400).json({ error: 'Invalid action parameter or HTTP method.' });
}

module.exports = handler;
module.exports.getStoredMediaList = getStoredMediaList;
module.exports.computeStorageStats = computeStorageStats;
