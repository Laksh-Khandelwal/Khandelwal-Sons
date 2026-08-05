#!/usr/bin/env node
/**
 * One-time migration: move ALL catalog images to Supabase Storage.
 *
 * What it does (idempotent — safe to re-run):
 *   1. Ensures the public `product-images` bucket exists.
 *   2. Uploads every local product image in ./images  ->  bucket key  catalog/<filename>.
 *   3. Downloads the 7 Unsplash category placeholders and uploads them
 *      ->  bucket key  catalog/category-<category>.jpg.
 *   4. Rewrites existing DB product rows so any image_url that still points at a
 *      local "images/..." path or an Unsplash category URL now points at Supabase.
 *
 * Run locally (needs your real credentials — this sandbox can't reach Supabase):
 *
 *     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/migrate-images-to-supabase.js
 *
 * or just `node scripts/migrate-images-to-supabase.js` if those live in a local .env file.
 *
 * Node >= 18 (uses global fetch). No new dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'images');
const BUCKET = 'product-images';
const PREFIX = 'catalog'; // everything lands under product-images/catalog/...

// Files in images/ that are NOT catalog products (branding / storefront chrome).
const EXCLUDE = [/^logo\./i, /^shop-/i, /-icon\./i, /^favicon\./i];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

// The category placeholders currently hot-linked from Unsplash. Keyed by category;
// used both to fetch the source image and to rewrite matching DB rows.
const CATEGORY_UNSPLASH = {
  dairy: 'https://images.unsplash.com/photo-1683314573422-649a3c6ad784?auto=format&fit=crop&w=700&q=80',
  beverages: 'https://images.unsplash.com/photo-1635436338433-89747d0ca0ef?auto=format&fit=crop&w=700&q=80',
  frozen: 'https://images.unsplash.com/photo-1632640109744-4dea429408ab?auto=format&fit=crop&w=700&q=80',
  snacks: 'https://images.unsplash.com/photo-1579895989448-9cc51e9a7060?auto=format&fit=crop&w=700&q=80',
  sweets: 'https://images.unsplash.com/photo-1646578515903-67873a5398f9?auto=format&fit=crop&w=700&q=80',
  bakery: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=700&q=80',
  ingredients: 'https://images.unsplash.com/photo-1682490301133-db17d61a5324?auto=format&fit=crop&w=700&q=80'
};

const CONTENT_TYPE = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.gif': 'image/gif'
};

// ---------------------------------------------------------------------------
// Env loading (parse a local .env if present, else rely on process.env)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}
loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_KEY.');
  console.error('Set them in your environment or a local .env file and re-run.');
  process.exit(1);
}

const publicUrl = key => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
const authHeaders = extra => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra });

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
  });
  if (res.ok) { console.log(`Created public bucket "${BUCKET}".`); return; }
  const body = await res.text();
  if (res.status === 409 || /already exists/i.test(body)) {
    console.log(`Bucket "${BUCKET}" already exists.`);
  } else {
    throw new Error(`Could not ensure bucket (${res.status}): ${body.slice(0, 200)}`);
  }
}

async function uploadBuffer(key, buffer, contentType) {
  // x-upsert:true makes re-runs overwrite instead of failing on the second pass.
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer
  });
  if (!res.ok) throw new Error(`upload ${key} failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
}

async function sbRest(pathAndQuery, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathAndQuery}`, {
    ...opts,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(opts.headers || {}) })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${pathAndQuery} failed (${res.status}): ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
async function uploadLocalImages() {
  if (!fs.existsSync(IMAGES_DIR)) { console.log('No images/ folder — skipping local upload.'); return; }
  const files = fs.readdirSync(IMAGES_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return false;                 // only images
    if (EXCLUDE.some(re => re.test(f))) return false;      // skip logo/shop/etc.
    return fs.statSync(path.join(IMAGES_DIR, f)).isFile(); // skip optimized/ subdir
  });
  console.log(`\nUploading ${files.length} local product image(s) -> ${BUCKET}/${PREFIX}/ ...`);
  let ok = 0;
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    try {
      await uploadBuffer(`${PREFIX}/${f}`, fs.readFileSync(path.join(IMAGES_DIR, f)), CONTENT_TYPE[ext] || 'application/octet-stream');
      ok++;
      process.stdout.write(`\r  ${ok}/${files.length}  ${f.slice(0, 40).padEnd(40)}`);
    } catch (e) {
      console.error(`\n  ! ${f}: ${e.message}`);
    }
  }
  console.log(`\n  done: ${ok}/${files.length} uploaded.`);
}

async function uploadCategoryPlaceholders() {
  console.log(`\nFetching + uploading ${Object.keys(CATEGORY_UNSPLASH).length} category placeholder(s) ...`);
  for (const [cat, url] of Object.entries(CATEGORY_UNSPLASH)) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`download ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await uploadBuffer(`${PREFIX}/category-${cat}.jpg`, buf, 'image/jpeg');
      console.log(`  ✓ category-${cat}.jpg`);
    } catch (e) {
      console.error(`  ! category-${cat}: ${e.message}`);
    }
  }
}

async function rewriteDbRows() {
  let rows;
  try {
    rows = await sbRest('/products?select=id,image_url');
  } catch (e) {
    console.log(`\nSkipping DB rewrite (could not read products): ${e.message}`);
    return;
  }
  if (!Array.isArray(rows) || !rows.length) { console.log('\nNo product rows to rewrite.'); return; }

  const unsplashToCat = Object.fromEntries(Object.entries(CATEGORY_UNSPLASH).map(([c, u]) => [u, c]));
  let changed = 0;
  console.log(`\nRewriting image_url on ${rows.length} product row(s) ...`);
  for (const row of rows) {
    const cur = String(row.image_url || '');
    let next = null;
    if (cur.startsWith('images/')) {
      next = publicUrl(`${PREFIX}/${cur.slice('images/'.length)}`);
    } else if (unsplashToCat[cur]) {
      next = publicUrl(`${PREFIX}/category-${unsplashToCat[cur]}.jpg`);
    }
    if (next && next !== cur) {
      try {
        await sbRest(`/products?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ image_url: next, updated_at: new Date().toISOString() })
        });
        changed++;
      } catch (e) {
        console.error(`  ! ${row.id}: ${e.message}`);
      }
    }
  }
  console.log(`  updated ${changed} row(s).`);
}

// ---------------------------------------------------------------------------
(async () => {
  console.log(`Target: ${SUPABASE_URL}  bucket "${BUCKET}"`);
  await ensureBucket();
  await uploadLocalImages();
  await uploadCategoryPlaceholders();
  await rewriteDbRows();
  console.log('\nMigration complete. All catalog images now served from Supabase.');
  console.log('Note: logo.png and the shop-*.png hero photos were left local (site chrome).');
})().catch(e => { console.error('\nMigration failed:', e.message); process.exit(1); });
