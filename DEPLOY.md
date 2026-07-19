# Deploying Khandelwal & Sons

Architecture — three pieces, each with a one-time setup:

| Piece | Service | Role |
|---|---|---|
| Database | **Supabase** (free) | Stores all orders so the owner dashboard works from any computer |
| WhatsApp | **Meta WhatsApp Cloud API** (free tier) | Sends each order to the shop's WhatsApp (+91 93217 82424) |
| Hosting | **Render** (free) | Runs `server.js`, which serves the website and talks to the two services above |

Note: Supabase is only the database — it cannot host the website or the Node
server. That is why the Render step exists.

---

## Step 1 — Supabase (order database)

1. Create a free account at https://supabase.com → **New project** (any name;
   the database password it asks for won't be needed again here).
2. In the project, open the **SQL Editor** and run:

   ```sql
   create table public.orders (
     id text primary key,
     created_at timestamptz not null default now(),
     placed_at text,
     username text,
     customer jsonb not null,
     items jsonb not null,
     total numeric not null,
     status text not null default 'Pending'
   );
   alter table public.orders enable row level security;
   ```

   (RLS enabled with no policies = only the backend's service key can touch
   the table.)
3. Go to **Project Settings → API** and copy two values for later:
   - **Project URL** → will be env var `SUPABASE_URL`
   - **service_role secret** → will be env var `SUPABASE_SERVICE_KEY`
     (keep it secret — server-side only)
4. Choose a strong dashboard password → will be env var `OWNER_PASSWORD`.

Free tier notes: 500 MB storage (years of orders). Projects pause after ~1
week of zero traffic — normal orders keep it alive; if paused, resume with
one click in the Supabase dashboard.

## Step 2 — Meta WhatsApp Cloud API (~30 min, one-time)

1. Go to https://developers.facebook.com → **Create App** → type **Business**.
2. In the app dashboard, add the **WhatsApp** product.
3. The WhatsApp **API Setup** page gives you:
   - a **Phone Number ID** → will be env var `WHATSAPP_PHONE_NUMBER_ID`
   - a **temporary access token** (ok for a first test; expires in 24 h)
   - a free **test sender number**
4. Under "To", add **+91 93217 82424** as recipient and verify it with the
   code WhatsApp sends (test mode only delivers to verified numbers).
5. For production, create a **permanent token**: Meta Business Settings →
   **System Users** → new user with `whatsapp_business_messaging` permission →
   generate token → this is env var `WHATSAPP_TOKEN`.

### The 24-hour-window rule (read this)

Meta delivers free-form messages only within 24 h of the recipient last
messaging the business number. Orders arrive anytime, so for reliable
delivery create an approved **message template** in WhatsApp Manager —
e.g. name `new_order`, body: `{{1}}` — and later set env var
`WHATSAPP_TEMPLATE=new_order`. Template messages are always deliverable.
(Quick workaround while testing: send any message from the shop phone to the
test number first; that opens the 24 h window.)

## Step 3 — Deploy on Render (hosting)

1. Push this repo to GitHub (`git push origin main`).
2. On https://render.com → **New → Web Service** → connect the repo.
   Render reads `render.yaml` automatically (Node, `npm install`, `npm start`).
3. In the service's **Environment** tab set:

   | Env var | Value |
   |---|---|
   | `SUPABASE_URL` | from Step 1 |
   | `SUPABASE_SERVICE_KEY` | from Step 1 |
   | `OWNER_PASSWORD` | from Step 1 |
   | `WHATSAPP_TOKEN` | from Step 2 |
   | `WHATSAPP_PHONE_NUMBER_ID` | from Step 2 |
   | `WHATSAPP_TEMPLATE` | `new_order` (once the template is approved) |
   | `OWNER_WHATSAPP` | `919321782424` (already the default) |

4. Deploy. The site is live at `https://<service-name>.onrender.com`.

## Step 4 — Verify

- `https://<service>.onrender.com/api/health` → expect
  `"dbConfigured": true` and `"whatsappConfigured": true`.
- Place a test order → WhatsApp message arrives at +91 93217 82424 and the
  order appears in Supabase (Table Editor → orders).
- Open `https://<service>.onrender.com/owner.html` from ANY computer, log in
  with `OWNER_PASSWORD` → orders listed, status changes persist, page
  auto-refreshes every 15 s and chimes on new orders.
- Problems: Render → Logs shows Meta/Supabase errors as they happen.

## Notes & limits

- **Render free tier cold starts**: after ~15 min idle, the first request
  takes ~30-60 s.
- Customer-side "Order Again" and profile history come from the customer's
  own browser; status badges there don't reflect owner-side changes.
- Meta free tier: 1,000 conversations/month — plenty for a small shop.

## Alternative WhatsApp provider: CallMeBot

The server also supports CallMeBot (unofficial, free relay). If the Meta
setup is ever a blocker: send `I allow callmebot to send me messages` from
the shop phone to **+34 621 34 22 27** (current number listed at
callmebot.com; if no reply in 2 min they throttle — retry after 24 h), then
set env var `CALLMEBOT_APIKEY` to the key it returns. If both providers are
configured, CallMeBot wins. Trade-off: order details pass through a third
party with no uptime guarantee.
