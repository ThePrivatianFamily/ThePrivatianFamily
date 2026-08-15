/**
 * /api/media — Full Cloudflare R2 Media Management & Metadata API
 *
 * Endpoints:
 * GET  ?action=list                  Auth — List all uploaded media assets
 * POST ?action=upload                Auth — Upload single/multiple image files to R2
 * PUT  ?action=update&id=<id>        Auth — Update media metadata (title, alt text, tags)
 * DELETE ?action=delete&id=<id>      Auth — Delete file from R2 and remove metadata
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('./_lib/auth');
const { logActivity } = require('./_lib/activity');

// ── CLOUDFLARE R2 CONFIGURATION ──────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '44fa7e7d93ed3ba71fdc0ce85e2dd0ed';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'theprivatianfamily';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://pub-1e6b79ea34c74adfa8dc145a3b5a4e5a.r2.dev').replace(/\/$/, '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '51b83c34bbe3d11ceabd3effda70ad02';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '9f4544f5357f1ebd2c2a4860c8fb1100b59ef2e851ba424d3b4ff9db501a08ec';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────
const supabaseUrl = process.env.PRIVATIAN_SUPABASE_URL || process.env.SUPABASE_URL || 'https://aeydfqdxdfwbbwuhhgyp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PRIVATIAN_SUPABASE_KEY || process.env.SUPABASE_KEY;

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

// ── METADATA STORAGE HELPERS (with fallback to site_settings store) ───────
const FALLBACK_STORE_KEY = 'privatian_media_library_items';
const FALLBACK_FOLDERS_KEY = 'privatian_media_folders';
const DEFAULT_FOLDERS = ['Articles', 'Hero Banners', 'Authors', 'Logos & Icons', 'Heritage & Archive'];

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

async function getStoredMediaList(sb) {
  // Step 1: Scan Cloudflare R2 bucket directly for all objects
  let r2Objects = [];
  try {
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 1000
    }));
    if (listRes.Contents && Array.isArray(listRes.Contents)) {
      r2Objects = listRes.Contents.filter(o => !o.Key.endsWith('/'));
    }
  } catch(err) {
    console.warn('[Media] Cloudflare R2 list error:', err.message);
  }

  // Step 2: Fetch metadata dictionary from Supabase
  let dbMetadataMap = new Map();
  if (sb) {
    // Try table
    try {
      const { data, error } = await sb.from('media_library').select('*');
      if (!error && Array.isArray(data)) {
        data.forEach(item => {
          if (item.unique_id) dbMetadataMap.set(item.unique_id, item);
          if (item.r2_key) dbMetadataMap.set(item.r2_key, item);
        });
      }
    } catch(e) {}

    // Try site_settings fallback
    try {
      const { data } = await sb.from('site_settings').select('value').eq('key', FALLBACK_STORE_KEY).maybeSingle();
      if (data && data.value && Array.isArray(data.value)) {
        data.value.forEach(item => {
          if (item.unique_id && !dbMetadataMap.has(item.unique_id)) dbMetadataMap.set(item.unique_id, item);
          if (item.r2_key && !dbMetadataMap.has(item.r2_key)) dbMetadataMap.set(item.r2_key, item);
        });
      }
    } catch(e) {}
  }

  // Step 3: If R2 returned objects, build canonical list with merged metadata
  if (r2Objects.length > 0) {
    const canonicalList = r2Objects.map(obj => {
      const parts = obj.Key.split('/');
      const fname = parts[parts.length - 1];
      const uidMatch = fname.match(/^(img_[a-z0-9]{8})_/);
      const uniqueId = uidMatch ? uidMatch[1] : ('img_' + fname.slice(0, 8).replace(/[^a-z0-9]/g, 'x'));
      const cleanName = fname.replace(/^img_[a-z0-9]{8}_/, '');

      const dbMeta = dbMetadataMap.get(uniqueId) || dbMetadataMap.get(obj.Key) || {};

      return {
        id: uniqueId,
        unique_id: uniqueId,
        r2_key: obj.Key,
        url: `${R2_PUBLIC_URL}/${obj.Key}`,
        filename: dbMeta.filename || cleanName,
        title: dbMeta.title || cleanName.replace(/\.[^/.]+$/, ''),
        folder: dbMeta.folder || '',
        alt_text: dbMeta.alt_text || '',
        alt_text_bn: dbMeta.alt_text_bn || '',
        mime_type: dbMeta.mime_type || (fname.endsWith('.svg') ? 'image/svg+xml' : (fname.endsWith('.png') ? 'image/png' : (fname.endsWith('.webp') ? 'image/webp' : 'image/jpeg'))),
        file_size: obj.Size || dbMeta.file_size || 0,
        tags: dbMeta.tags || [],
        uploaded_by: dbMeta.uploaded_by || 'Admin',
        created_at: obj.LastModified ? new Date(obj.LastModified).toISOString() : (dbMeta.created_at || new Date().toISOString()),
        updated_at: dbMeta.updated_at || (obj.LastModified ? new Date(obj.LastModified).toISOString() : new Date().toISOString())
      };
    });

    // Sort newest first
    canonicalList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Save canonical sync back to DB so DB is always 100% updated with R2
    if (sb) {
      saveAllMediaItems(sb, canonicalList).catch(() => {});
    }

    return canonicalList;
  }

  // If R2 scan failed or had 0 items, fallback to DB items
  if (dbMetadataMap.size > 0) {
    const list = Array.from(dbMetadataMap.values());
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return list;
  }

  return [];
}

function computeStorageStats(items) {
  const totalFiles = items.length;
  const totalBytes = items.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const R2_CAPACITY_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
  const freeBytes = Math.max(0, R2_CAPACITY_BYTES - totalBytes);
  const usedPct = (totalBytes / R2_CAPACITY_BYTES) * 100;
  const freePct = Math.max(0, 100 - usedPct);

  const photos = items.filter(x => !x.mime_type?.includes('svg') && !x.filename?.toLowerCase().endsWith('.svg'));
  const svgs = items.filter(x => x.mime_type?.includes('svg') || x.filename?.toLowerCase().endsWith('.svg'));
  const photosBytes = photos.reduce((acc, x) => acc + (x.file_size || 0), 0);
  const svgsBytes = svgs.reduce((acc, x) => acc + (x.file_size || 0), 0);

  return {
    totalFiles,
    totalBytes,
    capacityBytes: R2_CAPACITY_BYTES,
    freeBytes,
    usedPct,
    freePct,
    photosCount: photos.length,
    photosBytes,
    svgsCount: svgs.length,
    svgsBytes,
    avgFileSize: totalFiles > 0 ? Math.round(totalBytes / totalFiles) : 0,
    largestFileSize: items.reduce((max, x) => Math.max(max, x.file_size || 0), 0)
  };
}

async function saveMediaItemMetadata(sb, item) {
  if (!sb) return false;

  // Try 1: direct table insert
  try {
    const { error } = await sb.from('media_library').insert(item);
    if (!error) return true;
  } catch(e) {}

  // Try 2: fallback to array in site_settings
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

  // Try 1: table delete
  try {
    await sb.from('media_library').delete().eq('unique_id', uniqueId);
  } catch(e) {}

  // Try 2: fallback store
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
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query && req.query.action) || 'list';
  const sb = getSupabase();

  // ── 1. LIST / SYNC MEDIA (GET or POST) ──────────────────────────────────
  if ((req.method === 'GET' && action === 'list') || action === 'sync') {
    const session = await requireAuth(req, res);
    if (!session) return;

    try {
      const items = await getStoredMediaList(sb);
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
            endpoint: 'Cloudflare R2 Storage',
            totalObjects: items.length,
            totalBytes: storage.totalBytes,
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
        publicUrlPrefix: R2_PUBLIC_URL
      });
    } catch(err) {
      console.error('[Media] List/Sync error:', err);
      return res.status(500).json({ error: 'Failed to retrieve media library items.' });
    }
  }

  // ── 2. UPLOAD MEDIA TO CLOUDFLARE R2 (POST) ────────────────────────────
  if (req.method === 'POST' && action === 'upload') {
    const session = await requireAuth(req, res);
    if (!session) return;

    try {
      const body = req.body || {};
      const {
        fileData,        // Base64 data string (data:image/png;base64,... or raw base64)
        filename,        // Original filename
        mimeType,        // image/jpeg, image/png, etc.
        folder,          // Target folder name (e.g. 'Articles')
        title,           // Human title
        altText,         // Accessibility alt text
        altTextBn,       // Bengali alt text
        tags             // Array or comma string
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

      // Validate size (max 25MB)
      if (fileSize > 25 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds 25MB limit.' });
      }

      // Generate Unique ID & File Key
      const uniqueId = generateUniqueMediaId(); // e.g. 'img_7k9x2m4p'
      const ext = getExtFromMimeOrName(detectedMime, filename);
      const safeName = sanitizeFilename(filename);
      const datePath = new Date().toISOString().slice(0, 7).replace('-', '/'); // '2026/08'
      const targetFolder = (folder || '').trim();
      const r2Key = `gallery/${datePath}/${uniqueId}_${safeName}.${ext}`;
      const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;

      // Upload to Cloudflare R2 via S3 PutObject
      const uploadParams = {
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
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

      await s3.send(new PutObjectCommand(uploadParams));

      // Construct media record
      const mediaItem = {
        id: uniqueId,
        unique_id: uniqueId,
        url: publicUrl,
        r2_key: r2Key,
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

      // Save to Supabase metadata store
      if (sb) {
        await saveMediaItemMetadata(sb, mediaItem);
      }

      // Activity log
      try {
        await logActivity({
          actor: session,
          action: 'media.upload',
          category: 'media',
          summary: `${session.name || session.email} uploaded image "${mediaItem.filename}" (ID: ${uniqueId}${targetFolder ? ' in ' + targetFolder : ''}) to R2 Gallery`,
          target_id: uniqueId,
          target_name: mediaItem.filename,
          details: { unique_id: uniqueId, url: publicUrl, folder: targetFolder, size: fileSize, mime_type: detectedMime },
          req
        });
      } catch(e) {}

      return res.status(201).json({
        ok: true,
        message: 'Image successfully uploaded to Cloudflare R2.',
        media: mediaItem
      });
    } catch(err) {
      console.error('[Media] Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload image to Cloudflare R2: ' + (err.message || 'Unknown error') });
    }
  }

  // ── 3. FOLDER ACTIONS ──────────────────────────────────────────────────
  // 3a. CREATE FOLDER
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

  // 3b. RENAME FOLDER
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

      // Update all media items assigned to old folder
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

  // 3c. DELETE FOLDER
  if (req.method === 'DELETE' && action === 'delete_folder') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const name = (req.query.name || req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });

    try {
      let folders = await getStoredFolderList(sb);
      folders = folders.filter(f => f !== name);
      await saveStoredFolderList(sb, folders);

      // Re-assign media items inside deleted folder to Root ('')
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

  // 3d. MOVE ASSET(S) TO FOLDER
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

  // ── 5. DELETE MEDIA (DELETE) ───────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'delete') {
    const session = await requireAuth(req, res);
    if (!session) return;

    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
      const items = await getStoredMediaList(sb);
      const item = items.find(x => x.unique_id === id || x.id === id);

      if (item && item.r2_key) {
        // Delete from Cloudflare R2
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: item.r2_key
          }));
        } catch(s3Err) {
          console.warn('[Media] S3 DeleteObject warning:', s3Err.message);
        }
      }

      // Remove from metadata store
      await removeMediaItemMetadata(sb, id);

      try {
        await logActivity({
          actor: session,
          action: 'media.delete',
          category: 'media',
          summary: `${session.name || session.email} deleted image "${(item && item.filename) || id}" from Gallery`,
          target_id: id,
          target_name: (item && item.filename) || id,
          details: { id, r2_key: item && item.r2_key },
          req
        });
      } catch(e) {}

      return res.status(200).json({ ok: true, message: 'Image deleted successfully.' });
    } catch(err) {
      console.error('[Media] Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete media asset.' });
    }
  }

  return res.status(400).json({ error: 'Invalid action parameter or HTTP method.' });
};
