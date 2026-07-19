/**
 * Khandelwal & Sons - backend
 * Serves the static storefront and relays incoming orders to the shop
 * owner's WhatsApp via Meta's WhatsApp Business Cloud API.
 *
 * Two delivery providers are supported — set the env vars for ONE of them
 * (in Render → Environment). If both are set, CallMeBot wins.
 *
 * Option A - CallMeBot (simplest): the shop phone sends the WhatsApp message
 * "I allow callmebot to send me messages" to CallMeBot's number
 * (see https://www.callmebot.com/blog/free-api-whatsapp-messages/) and
 * receives an API key.
 *   CALLMEBOT_APIKEY          The API key received on WhatsApp
 *
 * Option B - Meta WhatsApp Business Cloud API (official):
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

const app = express();
const PORT = process.env.PORT || 3000;

const OWNER_WHATSAPP = (process.env.OWNER_WHATSAPP || '919321782424').replace(/\D/g, '');
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE || '';
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

const PROVIDER = CALLMEBOT_APIKEY ? 'callmebot' : (WHATSAPP_TOKEN && PHONE_NUMBER_ID) ? 'meta' : 'none';

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

app.use(express.json({ limit: '100kb' }));

// ---------- WhatsApp helpers ----------

function formatOrderMessage(order) {
  const lines = [];
  lines.push(`🧾 New Order: ${order.id}`);
  lines.push(`Customer: ${order.customer.name}${order.username && order.username !== 'Guest' ? ` (${order.username})` : ''}`);
  lines.push(`Phone: ${order.customer.phone}`);
  lines.push(`Address: ${order.customer.address}`);
  lines.push(`Delivery: ${order.customer.deliveryTime}`);
  lines.push('');
  lines.push('Items:');
  order.items.forEach(item => {
    lines.push(`• ${item.name}${item.unit && item.unit !== 'Standard' ? ` (${item.unit})` : ''} ×${item.quantity} — ₹${(item.price * item.quantity).toFixed(2)}`);
  });
  lines.push('');
  lines.push(`Total: ₹${order.total.toFixed(2)}`);
  lines.push('Payment: Cash on Delivery');
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

async function sendWhatsApp(text) {
  if (PROVIDER === 'none') {
    console.warn('[whatsapp] Not configured (set CALLMEBOT_APIKEY, or WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID). Message that would have been sent:\n' + text);
    return { sent: false, reason: 'not_configured' };
  }

  if (PROVIDER === 'callmebot') {
    return sendViaCallMeBot(text);
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    whatsappProvider: PROVIDER,
    whatsappConfigured: PROVIDER !== 'none',
    dbConfigured: DB_ENABLED
  });
});

// ---------- Static site ----------

app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`Khandelwal & Sons server running on port ${PORT}`);
  console.log(`WhatsApp notifications: ${PROVIDER === 'none' ? 'NOT configured (set CALLMEBOT_APIKEY, or WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)' : `via ${PROVIDER} → ${OWNER_WHATSAPP}`}`);
  console.log(`Order database: ${DB_ENABLED ? 'Supabase configured' : 'NOT configured (set SUPABASE_URL and SUPABASE_SERVICE_KEY)'}`);
  if (OWNER_PASSWORD === 'admin') console.warn('WARNING: OWNER_PASSWORD is still the default "admin" — set a strong one in the environment.');
});
