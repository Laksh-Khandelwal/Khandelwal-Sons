/**
 * Khandelwal & Sons - backend
 * Serves the static storefront and relays incoming orders to the shop
 * owner's WhatsApp via Meta's WhatsApp Business Cloud API.
 *
 * Three delivery providers are supported — set the env vars for ONE of them
 * (in Render → Environment). Precedence if several are set:
 * CallMeBot → Green API → Meta.
 *
 * Option A - CallMeBot (simplest): the shop phone sends the WhatsApp message
 * "I allow callmebot to send me messages" to CallMeBot's number
 * (see https://www.callmebot.com/blog/free-api-whatsapp-messages/) and
 * receives an API key.
 *   CALLMEBOT_APIKEY          The API key received on WhatsApp
 *
 * Option B - Green API (unofficial gateway, free developer tier): create an
 * instance at https://green-api.com, link the shop's WhatsApp by scanning the
 * QR code, then copy the instance credentials from the console.
 *   GREENAPI_ID_INSTANCE      The instance ID (e.g. 1101000001)
 *   GREENAPI_API_TOKEN        The instance API token
 *   GREENAPI_API_URL          Optional API host. Default: https://api.green-api.com
 *
 * Option C - Meta WhatsApp Business Cloud API (official):
 *   WHATSAPP_TOKEN            Meta permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID  Phone Number ID from the Meta app's WhatsApp setup page
 *   WHATSAPP_TEMPLATE         Optional approved template name. If set, orders are sent
 *                             as a template (required by Meta outside a 24-hour
 *                             customer-service window). If unset, sends plain text.
 *
 * Order storage (Supabase — required for the cross-device owner dashboard):
 *   SUPABASE_URL              Project URL, e.g. https://xyzcompany.supabase.co
 *   SUPABASE_SERVICE_KEY      service_role secret from Project Settings → API
 *   OWNER_PASSWORD            Password for the owner dashboard (default: admin — change it!)
 *
 * Common:
 *   OWNER_WHATSAPP            Recipient in international format, digits only. Default: 919321782424
 *   PORT                      Injected automatically by Render.
 */

const express = require('express');
const path = require('path');
const { buildSeedProducts } = require('./catalog-seed');
const ssr = require('./ssr');

const app = express();
const PORT = process.env.PORT || 3000;

const OWNER_WHATSAPP = (process.env.OWNER_WHATSAPP || '919321782424').replace(/\D/g, '');
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '';
const GREENAPI_ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE || '';
const GREENAPI_API_TOKEN = process.env.GREENAPI_API_TOKEN || '';
const GREENAPI_API_URL = (process.env.GREENAPI_API_URL || 'https://api.green-api.com').replace(/\/+$/, '');
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE || '';
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

const PROVIDER = CALLMEBOT_APIKEY ? 'callmebot'
  : (GREENAPI_ID_INSTANCE && GREENAPI_API_TOKEN) ? 'greenapi'
  : (WHATSAPP_TOKEN && PHONE_NUMBER_ID) ? 'meta'
  : 'none';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DB_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'admin';

// Minimal Supabase REST (PostgREST) client — no extra dependencies needed
async function sb(pathAndQuery, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathAndQuery}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message || body?.hint || text || `http_${res.status}`;
    throw new Error(`Supabase ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return body;
}

// Owner authentication middleware (password sent as a header over HTTPS)
function requireOwner(req, res, next) {
  if ((req.get('x-owner-key') || '') !== OWNER_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

app.use(express.json({ limit: '12mb' })); // 12mb headroom for base64 product image uploads

// ---------- WhatsApp helpers ----------

function formatOrderMessage(order) {
  // Neat price: drop the ".00" on whole amounts (₹530 instead of ₹530.00).
  const money = n => {
    const v = Number(n) || 0;
    return '₹' + (Number.isInteger(v) ? v : v.toFixed(2));
  };
  const c = order.customer || {};
  const lines = [];

  lines.push(`🧾 *New Order* — ${order.id}`);
  if (order.timestamp) lines.push(`🕒 ${order.timestamp}`);
  lines.push('');

  lines.push('*Customer*');
  lines.push(`${c.name}${order.username && order.username !== 'Guest' ? ` (@${order.username})` : ''}`);
  lines.push(`📞 ${c.phone}`);
  lines.push(`📍 ${c.address}`);
  if (c.deliveryTime) lines.push(`🚚 ${c.deliveryTime}`);
  lines.push('');

  lines.push('*Items*');
  order.items.forEach(item => {
    const unit = item.unit && item.unit !== 'Standard' ? ` (${item.unit})` : '';
    lines.push(`• ${item.quantity}× ${item.name}${unit} — ${money(item.price * item.quantity)}`);
  });
  lines.push('');

  lines.push(`*Total: ${money(order.total)}*  ·  Cash on Delivery`);

  return lines.join('\n');
}

async function sendViaCallMeBot(text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=+${OWNER_WHATSAPP}&apikey=${encodeURIComponent(CALLMEBOT_APIKEY)}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const body = await res.text().catch(() => '');
  // CallMeBot returns HTTP 200 with an HTML body; errors appear as text in the body
  if (!res.ok || /error|invalid/i.test(body)) {
    console.error('[whatsapp:callmebot] Send failed:', res.status, body.slice(0, 300));
    return { sent: false, reason: `callmebot_${res.status}` };
  }
  return { sent: true };
}

async function sendViaGreenApi(text) {
  const url = `${GREENAPI_API_URL}/waInstance${GREENAPI_ID_INSTANCE}/sendMessage/${GREENAPI_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: `${OWNER_WHATSAPP}@c.us`, message: text })
  });
  const body = await res.json().catch(() => ({}));
  // A successful send returns an object with an idMessage field
  if (!res.ok || !body?.idMessage) {
    console.error('[whatsapp:greenapi] Send failed:', res.status, JSON.stringify(body).slice(0, 300));
    return { sent: false, reason: body?.message || `greenapi_${res.status}` };
  }
  return { sent: true };
}

async function sendWhatsApp(text) {
  if (PROVIDER === 'none') {
    console.warn('[whatsapp] Not configured (set CALLMEBOT_APIKEY, or GREENAPI_ID_INSTANCE + GREENAPI_API_TOKEN, or WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID). Message that would have been sent:\n' + text);
    return { sent: false, reason: 'not_configured' };
  }

  if (PROVIDER === 'callmebot') {
    return sendViaCallMeBot(text);
  }

  if (PROVIDER === 'greenapi') {
    return sendViaGreenApi(text);
  }

  const payload = TEMPLATE_NAME
    ? {
        messaging_product: 'whatsapp',
        to: OWNER_WHATSAPP,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text }] }]
        }
      }
    : {
        messaging_product: 'whatsapp',
        to: OWNER_WHATSAPP,
        type: 'text',
        text: { body: text }
      };

  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[whatsapp] Send failed:', res.status, JSON.stringify(body));
    return { sent: false, reason: body?.error?.message || `http_${res.status}` };
  }
  return { sent: true };
}

// ---------- API ----------

// Naive in-memory rate limiter: max 10 orders per IP per 10 minutes
const orderHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const hits = (orderHits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  hits.push(now);
  orderHits.set(ip, hits);
  if (orderHits.size > 5000) orderHits.clear(); // memory guard
  return hits.length > 10;
}

app.post('/api/orders', async (req, res) => {
  if (rateLimited(req.ip)) {
    return res.status(429).json({ ok: false, error: 'Too many orders — please wait a few minutes.' });
  }
  const order = req.body;

  // Minimal validation
  if (!order || !order.id || !order.customer?.name || !order.customer?.phone ||
      !Array.isArray(order.items) || order.items.length === 0 || typeof order.total !== 'number') {
    return res.status(400).json({ ok: false, error: 'Invalid order payload' });
  }

  console.log(`[order] ${order.id} from ${order.customer.name} — ${order.items.length} item(s), ₹${order.total}`);

  // 1. Persist to the database (source of truth for the owner dashboard)
  let dbSaved = false;
  if (DB_ENABLED) {
    try {
      await sb('/orders', {
        method: 'POST',
        body: JSON.stringify({
          id: order.id,
          username: order.username || 'Guest',
          customer: order.customer,
          items: order.items,
          total: order.total,
          status: 'Pending',
          placed_at: order.timestamp || new Date().toLocaleString('en-IN')
        })
      });
      dbSaved = true;
    } catch (err) {
      console.error('[order] DB insert failed:', err.message);
    }
  }

  // 2. Notify the owner on WhatsApp
  let whatsapp = { sent: false, reason: 'relay_error' };
  try {
    whatsapp = await sendWhatsApp(formatOrderMessage(order));
  } catch (err) {
    console.error('[order] WhatsApp relay error:', err);
  }

  return res.json({ ok: true, dbSaved, whatsapp });
});

// Public: current status of a set of orders (only id → status, no personal data).
// Used by the customer's order-history page to show live statuses.
app.get('/api/orders/status', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true, statuses: {} });
  const ids = String(req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return res.json({ ok: true, statuses: {} });
  try {
    const inList = ids.map(id => `"${id.replace(/"/g, '')}"`).join(',');
    const rows = await sb(`/orders?select=id,status&id=in.(${encodeURIComponent(inList)})`);
    const statuses = {};
    rows.forEach(r => { statuses[r.id] = r.status; });
    res.json({ ok: true, statuses });
  } catch (err) {
    res.json({ ok: true, statuses: {} }); // degrade gracefully
  }
});

// ---------- Products API ----------

const ALLOWED_TAGS = ['bestseller', 'frequently_ordered'];

// Normalize a product payload coming from the admin form into the shape we store.
function normalizeProductInput(body) {
  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  const image_url = String(body.image_url || body.image || '').trim();
  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  const variants = rawVariants
    .map((v, i) => ({
      id: String(v.id || `v-${Date.now().toString(36)}-${i}`),
      size: (String(v.size || '').trim() || 'Standard'),
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0
    }))
    .filter(v => v.price >= 0);
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map(String).filter(t => ALLOWED_TAGS.includes(t)))]
    : [];
  return { name, category, image_url, variants, tags };
}

// Seed the products table from the original catalog the first time it is empty.
async function seedProductsIfEmpty() {
  if (!DB_ENABLED) return;
  try {
    const existing = await sb('/products?select=id&limit=1');
    if (Array.isArray(existing) && existing.length > 0) {
      console.log('[products] Table already populated — skipping seed.');
      return;
    }
    const seed = buildSeedProducts();
    await sb('/products', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(seed)
    });
    console.log(`[products] Seeded ${seed.length} products into Supabase.`);
  } catch (err) {
    console.error('[products] Seed failed:', err.message);
  }
}

// One-time migration: expand originally-seeded single-size sweets to the full
// 250gm–5kg size ladder. Only touches sweets that still have the original seed
// variant (id starting "variant-"), so owner edits are never overwritten.
async function migrateSweetSizesIfNeeded() {
  if (!DB_ENABLED) return;
  try {
    const sweets = await sb('/products?select=id,variants&category=eq.sweets');
    if (!Array.isArray(sweets) || !sweets.length) return;
    const seedById = Object.fromEntries(buildSeedProducts().map(p => [p.id, p]));
    let migrated = 0;
    for (const row of sweets) {
      const variants = Array.isArray(row.variants) ? row.variants : [];
      const isOriginalSingle = variants.length === 1 && String(variants[0].id || '').startsWith('variant-');
      if (!isOriginalSingle) continue;
      const seedProduct = seedById[row.id];
      if (!seedProduct || seedProduct.variants.length <= 1) continue;
      await sb(`/products?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ variants: seedProduct.variants, updated_at: new Date().toISOString() })
      });
      migrated++;
    }
    if (migrated) console.log(`[products] Expanded ${migrated} sweet(s) to the 250gm–5kg size ladder.`);
  } catch (err) {
    console.error('[products] Sweet size migration failed:', err.message);
  }
}

// Public: full catalog for the storefront, shaped like the old client-side PRODUCTS.
app.get('/api/products', async (_req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true, products: [] });
  try {
    const rows = await sb('/products?select=*&order=sort_order.asc,name.asc');
    const products = rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      image: r.image_url,
      variants: Array.isArray(r.variants) ? r.variants : [],
      tags: Array.isArray(r.tags) ? r.tags : []
    }));
    res.json({ ok: true, products });
  } catch (err) {
    console.error('[products] list failed:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ---------- Owner API (requires x-owner-key header) ----------

app.post('/api/owner/login', (req, res) => {
  if ((req.body?.password || '') === OWNER_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Incorrect password' });
});

app.get('/api/owner/orders', requireOwner, async (_req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured (set SUPABASE_URL and SUPABASE_SERVICE_KEY)' });
  try {
    const rows = await sb('/orders?select=*&order=created_at.desc&limit=500');
    res.json({ ok: true, orders: rows });
  } catch (err) {
    console.error('[owner] list failed:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.patch('/api/owner/orders/:id', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  const status = req.body?.status;
  const allowed = ['Pending', 'Preparing', 'Out for Delivery', 'Completed'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });
  try {
    const rows = await sb(`/orders?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    res.json({ ok: true, updated: rows.length });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.delete('/api/owner/orders/:id', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  try {
    await sb(`/orders?id=eq.${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.delete('/api/owner/orders', requireOwner, async (_req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  try {
    await sb('/orders?id=neq.__none__', { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ----- Owner: product management -----

app.get('/api/owner/products', requireOwner, async (_req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  try {
    const rows = await sb('/products?select=*&order=sort_order.asc,name.asc');
    res.json({ ok: true, products: rows });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/owner/products', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  const n = normalizeProductInput(req.body);
  if (!n.name || !n.category || n.variants.length === 0) {
    return res.status(400).json({ ok: false, error: 'Name, category and at least one size/price are required.' });
  }
  const id = (String(req.body.id || '').trim()) || ('p-' + Date.now().toString(36));
  try {
    const rows = await sb('/products', {
      method: 'POST',
      body: JSON.stringify({ id, ...n, sort_order: Number(req.body.sort_order) || 999 })
    });
    res.json({ ok: true, product: rows[0] });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.patch('/api/owner/products/:id', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  const n = normalizeProductInput(req.body);
  if (!n.name || !n.category || n.variants.length === 0) {
    return res.status(400).json({ ok: false, error: 'Name, category and at least one size/price are required.' });
  }
  try {
    const rows = await sb(`/products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...n, sort_order: Number(req.body.sort_order) || 0, updated_at: new Date().toISOString() })
    });
    res.json({ ok: true, updated: rows.length, product: rows[0] });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.delete('/api/owner/products/:id', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Database not configured' });
  try {
    await sb(`/products?id=eq.${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Upload a product image (base64) to Supabase Storage; returns a public URL.
app.post('/api/owner/upload-image', requireOwner, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ ok: false, error: 'Storage not configured' });
  try {
    const { dataBase64, contentType, filename } = req.body || {};
    if (!dataBase64) return res.status(400).json({ ok: false, error: 'No image data provided' });
    const type = /^image\/(png|jpe?g|webp|gif)$/i.test(contentType || '') ? contentType : 'image/jpeg';
    const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const safe = String(filename || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'product';
    const key = `${Date.now().toString(36)}-${safe}.${ext}`;
    const buffer = Buffer.from(dataBase64, 'base64');
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': type,
        'x-upsert': 'true'
      },
      body: buffer
    });
    if (!up.ok) {
      const t = await up.text().catch(() => '');
      console.error('[upload] failed:', up.status, t.slice(0, 200));
      return res.status(502).json({ ok: false, error: `Upload failed (${up.status}) — is the product-images bucket created?` });
    }
    res.json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/product-images/${key}` });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    whatsappProvider: PROVIDER,
    whatsappConfigured: PROVIDER !== 'none',
    dbConfigured: DB_ENABLED
  });
});

// Public front-end config. Exposes ONLY the project URL + bucket (never the key)
// so the client can build Supabase Storage image URLs (e.g. category tiles).
app.get('/api/config', (_req, res) => {
  res.json({ ok: true, supabaseUrl: SUPABASE_URL, imageBucket: 'product-images' });
});

// ---------- SEO: server-rendered category & product pages + sitemap ----------

// Catalog for SSR, shaped like the storefront's PRODUCTS. Cached briefly so
// crawlers hitting many URLs don't hammer the database.
let ssrCache = { at: 0, products: null, slugMap: null };
const SSR_TTL = 5 * 60 * 1000;

async function getSsrCatalog() {
  if (ssrCache.products && Date.now() - ssrCache.at < SSR_TTL) return ssrCache;
  let products;
  if (DB_ENABLED) {
    const rows = await sb('/products?select=*&order=sort_order.asc,name.asc');
    products = rows.map(r => ({
      id: r.id, name: r.name, category: r.category,
      image: r.image_url, variants: Array.isArray(r.variants) ? r.variants : [],
      tags: Array.isArray(r.tags) ? r.tags : []
    }));
  } else {
    products = buildSeedProducts().map(r => ({
      id: r.id, name: r.name, category: r.category,
      image: r.image_url, variants: r.variants || [], tags: []
    }));
  }
  ssrCache = { at: Date.now(), products, slugMap: ssr.buildSlugMap(products) };
  return ssrCache;
}

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const { products, slugMap } = await getSsrCatalog();
    res.type('application/xml').send(ssr.renderSitemap(products, slugMap));
  } catch (err) {
    console.error('[seo] sitemap failed:', err.message);
    res.status(500).type('application/xml').send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

app.get('/category/:slug', async (req, res, next) => {
  try {
    const { products, slugMap } = await getSsrCatalog();
    const html = ssr.renderCategoryPage(req.params.slug, products, slugMap);
    if (!html) return next(); // unknown category → fall through to 404/static
    res.type('html').send(html);
  } catch (err) {
    console.error('[seo] category page failed:', err.message);
    next();
  }
});

app.get('/product/:slug', async (req, res, next) => {
  try {
    const { products, slugMap } = await getSsrCatalog();
    const html = ssr.renderProductPage(req.params.slug, products, slugMap);
    if (!html) return next();
    res.type('html').send(html);
  } catch (err) {
    console.error('[seo] product page failed:', err.message);
    next();
  }
});

// ---------- Static site ----------

app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`Khandelwal & Sons server running on port ${PORT}`);
  console.log(`WhatsApp notifications: ${PROVIDER === 'none' ? 'NOT configured (set CALLMEBOT_APIKEY, or GREENAPI_ID_INSTANCE + GREENAPI_API_TOKEN, or WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)' : `via ${PROVIDER} → ${OWNER_WHATSAPP}`}`);
  console.log(`Order database: ${DB_ENABLED ? 'Supabase configured' : 'NOT configured (set SUPABASE_URL and SUPABASE_SERVICE_KEY)'}`);
  if (OWNER_PASSWORD === 'admin') console.warn('WARNING: OWNER_PASSWORD is still the default "admin" — set a strong one in the environment.');
  // One-time: populate the products table from the built-in catalog if it's empty,
  // then expand any originally-seeded sweets to the full size ladder.
  seedProductsIfEmpty().then(migrateSweetSizesIfNeeded);
});
