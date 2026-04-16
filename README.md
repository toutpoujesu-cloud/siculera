# Siculera — System Architecture & Operations Guide

## Overview

Siculera is a luxury Sicilian pastry e-commerce platform split across two hosting providers:

| Layer | Provider | URL |
|---|---|---|
| **Frontend** (HTML/CSS/JS) | Cloudflare Pages | `https://www.siculera.com` |
| **Backend** (Node.js API) | Render | `https://api.siculera.com` |
| **Database** (PostgreSQL) | Render (managed) | internal to Render |
| **Media / CDN** | Cloudflare (auto) | served via Cloudflare edge |

---

## 1. What Lives Where

### Cloudflare Pages — `www.siculera.com`
All public-facing HTML, CSS, and JavaScript. These are **static files** — no server required.

```
ecommerce/frontend/
├── index.html          # Homepage / product catalog
├── index1.html         # Alternative landing page
├── checkout.html       # Checkout flow
├── account.html        # Customer account
└── assets/
    ├── css/            # All stylesheets
    ├── images/         # Product images, logos
    ├── js/             # General JS (cart, UI)
    └── siculera-chat.js  ← AI chat widget (loaded on every page)
```

**How it deploys:** Cloudflare Pages is connected to the GitHub repo (`toutpoujesu-cloud/siculera`). Every push to `main` triggers an automatic rebuild and deploy — no action needed.

---

### Render — `api.siculera.com`
The Node.js/Express backend. Handles all business logic, database operations, AI chat, payments, and order management.

```
ecommerce/
├── backend/
│   ├── server.js                  # Entry point — starts Express on port 10000
│   ├── controllers/
│   │   ├── authController.js      # Login, register, JWT
│   │   ├── productController.js   # Product CRUD
│   │   ├── orderController.js     # Order management
│   │   ├── paymentController.js   # Payment handling
│   │   ├── userController.js      # User profile/accounts
│   │   ├── chatController.js      # AI chat (main logic)
│   │   └── chatAdminController.js # Admin chat configuration
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── models/
│   │   ├── db.js                  # PostgreSQL connection pool
│   │   ├── User.js
│   │   ├── Product.js
│   │   └── Order.js
│   ├── routes/
│   │   ├── auth.js        → /api/auth/*
│   │   ├── products.js    → /api/products/*
│   │   ├── orders.js      → /api/orders/*
│   │   ├── payments.js    → /api/payments/*
│   │   ├── users.js       → /api/users/*
│   │   ├── chat.js        → /api/chat/*
│   │   └── chatAdmin.js   → /api/admin/chat/*
│   └── utils/
│       ├── chatTools.js       # AI tool definitions & dispatcher (11 tools)
│       ├── ragSearch.js       # Knowledge base document search
│       ├── sessionManager.js  # Chat session management
│       ├── encryption.js      # AES-256 field encryption
│       ├── mailer.js          # Email notifications
│       ├── docProcessor.js    # PDF/TXT document ingestion
│       └── llm/
│           ├── llmProvider.js         # Provider factory
│           └── providers/
│               ├── openai.js          # OpenAI + DeepSeek + Groq + Ollama
│               ├── anthropic.js       # Claude
│               ├── gemini.js          # Google Gemini
│               └── mistral.js         # Mistral AI
├── database/
│   ├── schema.sql         # Main DB schema (users, products, orders…)
│   ├── schema_chat.sql    # Chat DB schema (sessions, messages…)
│   ├── migrate_chat.js    # Run chat migration
│   └── start-db.js        # Embedded PG for local dev only
├── admin/
│   ├── login.html         # Admin login
│   └── dashboard.html     # Admin panel (orders, products, chat config)
└── uploads/
    ├── products/          # Product images
    └── chat-docs/         # Knowledge base documents (RAG)
```

**How it deploys:** Render is connected to the same GitHub repo. Every push to `main` auto-deploys the backend. Free tier may take 50+ seconds to wake from cold start.

---

## 2. How Frontend and Backend Connect

The frontend calls the backend via HTTPS through a single environment variable baked into the HTML/JS:

```
www.siculera.com  →  fetch('https://api.siculera.com/api/...')
```

**CORS** is configured on the backend to only accept requests from:
- `https://www.siculera.com`
- `https://siculera.com`

**DNS** is managed in Cloudflare:

| Record | Type | Points To |
|---|---|---|
| `www` | CNAME (Proxied) | Cloudflare Pages |
| `api` | CNAME (DNS Only ⚠️) | `siculera-api.onrender.com` |

> **Important:** The `api` subdomain MUST be set to **DNS Only** (grey cloud) in Cloudflare, NOT proxied (orange cloud). Render handles its own SSL for `api.siculera.com`. Proxying it causes Cloudflare Error 1000.

---

## 3. How the AI Chat System Works

### Architecture

```
Customer types message
        ↓
siculera-chat.js (widget on www.siculera.com)
        ↓  POST /api/chat/message
backend/controllers/chatController.js
        ↓
loadChatConfig()  →  reads settings from DB
        ↓  (DB disabled → uses DEEPSEEK_API_KEY from env)
getLLMProvider('deepseek', apiKey)
        ↓
DeepSeek API (api.deepseek.com) via OpenAI-compatible SDK
        ↓
Agentic loop: up to 5 tool call iterations
        ↓
Tool dispatcher (chatTools.js) executes actions
        ↓
Final reply returned to widget
```

### Chat Flow Step by Step

1. **Widget loads** — `siculera-chat.js` is embedded on every page. On first open it calls `POST /api/chat/session` to get a session token.
2. **Customer sends message** — `POST /api/chat/message` with `{ session_token, message, cart_context }`.
3. **Config loaded** — Backend reads `ai_chat_config` from the PostgreSQL `settings` table. If chat is disabled in DB or has no key, it falls back to `DEEPSEEK_API_KEY` env var.
4. **LLM called** — DeepSeek `deepseek-chat` model receives: system prompt + conversation history + available tools.
5. **Tool loop** — If the AI decides to call a tool (e.g. `get_products`), the backend executes it, appends the result to the context, and calls the LLM again — up to 5 iterations.
6. **Reply returned** — Final text reply sent to the frontend along with any `actions` (e.g. add-to-cart).

### Available AI Tools (11 total)

| Tool | What it does |
|---|---|
| `get_products` | Browse product catalog with filters |
| `get_product_details` | Full details on a single product |
| `check_order_status` | Order tracking (requires order# + email) |
| `add_to_cart` | Adds item to customer cart |
| `initiate_order` | Places an order via bank transfer or cash on delivery |
| `get_shipping_options` | Returns shipping rates and methods |
| `search_knowledge_base` | RAG search across uploaded documents |
| `request_gdpr_data_export` | GDPR Article 15 data access request |
| `request_gdpr_erasure` | GDPR Article 17 erasure request |
| `escalate_to_human` | Escalates to human support agent |
| `show_cart` | Displays current cart in the widget |

### AI Provider Configuration

The current active provider is **DeepSeek** (configured via Render env var). The system supports switching providers from the admin dashboard without code changes:

| Provider | Env Var | Notes |
|---|---|---|
| **DeepSeek** ✅ Active | `DEEPSEEK_API_KEY` | Cost-effective, OpenAI-compatible |
| OpenAI | `OPENAI_API_KEY` | GPT-4o, GPT-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet |
| Google Gemini | `GOOGLE_AI_API_KEY` | Gemini Pro |
| Mistral | `MISTRAL_API_KEY` | Mixtral models |
| Groq | `GROQ_API_KEY` | Fast inference |
| Ollama | — | Local models (dev only) |

---

## 4. Environment Variables (Render — siculera-api)

All secrets are set in **Render → siculera-api → Environment**:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Render managed DB) |
| `DEEPSEEK_API_KEY` | Active LLM provider key |
| `OPENAI_API_KEY` | Optional fallback / provider option |
| `JWT_SECRET` | Signs authentication tokens |
| `DATA_ENCRYPTION_KEY` | AES-256 key for encrypting saved API keys in DB |
| `ALLOWED_ORIGINS` | `https://www.siculera.com,https://siculera.com` |
| `FRONTEND_URL` | `https://www.siculera.com` |
| `NODE_ENV` | `production` |
| `USE_SYSTEM_POSTGRES` | `true` (use Render's managed DB, not embedded) |

> **Never** commit these values to GitHub. They live only in Render's dashboard.

---

## 5. GitHub Repository

**Repo:** `https://github.com/toutpoujesu-cloud/siculera`
**Branch:** `main`

Both Cloudflare Pages and Render auto-deploy from `main`. The full project lives inside the `ecommerce/` subfolder of the repo.

```
siculera/              ← git root
├── ecommerce/         ← the actual application
│   ├── frontend/      → deployed to Cloudflare Pages
│   ├── backend/       → deployed to Render
│   ├── database/      → SQL migrations
│   └── admin/         → admin panel HTML
├── index.html         ← root landing page
└── README.md          ← this file
```

---

## 6. Admin Panel

URL: `https://www.siculera.com/admin/login.html`

The admin panel lets you:
- Manage products (add, edit, stock, pricing)
- View and update orders
- Configure the AI chat (switch provider, personality, capabilities)
- Upload knowledge base documents for RAG search
- View live chat sessions and escalations
- Manage user accounts

---

## 7. Local Development

```bash
# 1. Clone the repo
git clone https://github.com/toutpoujesu-cloud/siculera.git
cd siculera/ecommerce

# 2. Install dependencies
npm install

# 3. Create .env file
# Copy values from Render Environment tab into a local .env file
# Required: DATABASE_URL, DEEPSEEK_API_KEY, JWT_SECRET, DATA_ENCRYPTION_KEY

# 4. Run DB migrations
npm run db:migrate
npm run db:migrate:chat

# 5. Start the backend
npm run dev        # uses nodemon for hot reload
# API available at http://localhost:4000

# 6. Open frontend
# Open ecommerce/frontend/index.html in browser
# Or use Live Server extension in VS Code
```

---

## 8. Deployment Checklist (after any code change)

1. `git add . && git commit -m "description" && git push`
2. **Render** auto-deploys backend — watch Events tab for green Live badge (~2 min)
3. **Cloudflare Pages** auto-deploys frontend (~30 sec)
4. Test chat: `powershell -ExecutionPolicy Bypass -File test-chat.ps1`
5. Test API health: `curl https://api.siculera.com/health`
6. Test chat diag: `curl https://api.siculera.com/api/chat/diag`

---

## 9. Troubleshooting

### Chat returns `degraded: true`
1. Check `https://api.siculera.com/api/chat/diag` — confirms resolved provider and key prefix
2. Check Render Logs tab for `[chat] sendMessage error:` line
3. Verify `DEEPSEEK_API_KEY` is set correctly in Render Environment

### Chat is slow (50+ seconds on first message)
Two mitigations are already implemented (see Section 11):
- **Warm-up ping** — fires on every page load before the user opens the chat
- **Cloudflare Worker cron** — pings the API every 10 minutes to keep it alive

If it still feels slow after the Worker is deployed, upgrading Render to Starter tier ($7/mo) eliminates cold starts entirely.

### API returns CORS error in browser
- Confirm `ALLOWED_ORIGINS` in Render includes `https://www.siculera.com`
- Confirm `api` DNS record in Cloudflare is **grey cloud (DNS Only)**, not proxied

### Cloudflare Error 1000 on api.siculera.com
- Set `api` CNAME to **DNS Only** in Cloudflare DNS settings
- Confirm custom domain `api.siculera.com` is added in Render → siculera-api → Settings → Custom Domains

### Frontend changes not showing
- Cloudflare caches aggressively — hard-refresh with `Ctrl+Shift+R`, or purge cache in Cloudflare dashboard

---

## 10. Suggested Next Steps

| Priority | Action | Why |
|---|---|---|
| ✅ **Done** | Cold start warm-up ping + Cloudflare Worker cron | Keeps Render warm — see Section 11 |
| 🟡 **Optional** | Upgrade Render to **Starter tier** ($7/mo) | Permanent fix if Worker pings aren't enough |
| 🔴 **High** | **Add products** to the database via admin panel | AI chat currently shows fallback catalog, not real inventory |
| 🔴 **High** | Configure **email notifications** (SMTP env vars) so orders trigger confirmation emails | Operations |
| 🟡 **Medium** | **Upload product images** via admin dashboard | Visual store experience |
| 🟡 **Medium** | **Upload knowledge base documents** (allergen PDFs, shipping policy) | Improves AI chat accuracy |
| 🟡 **Medium** | **Enable Stripe payments** — backend is ready, just needs `STRIPE_SECRET_KEY` added to Render | Revenue |
| 🟡 **Medium** | **Set up custom email** `info@siculera.com` via Cloudflare Email Routing (free) | Branding |
| 🟢 **Low** | Enable **GDPR tools** in admin chat config (`can_handle_gdpr: true`) | EU compliance |
| 🟢 **Low** | Add **Cloudflare Web Analytics** (free, privacy-friendly) to frontend pages | Insight |
| 🟢 **Low** | Create an **admin account** for yourself via the admin login page | Access control |

---

## 11. Cold Start Fix — Keep-Alive System

Render free tier spins down the backend after 15 minutes of inactivity, causing a 50+ second delay on the first request. Two layers of protection are implemented:

### Layer 1 — Warm-up Ping (live)
Added to `ecommerce/frontend/assets/siculera-chat.js`. Fires a silent `HEAD /health` request the instant any page loads — before the user even opens the chat. This means by the time they click the chat bubble, the server is already warm.

```js
// Fires automatically on every production page load
fetch('https://api.siculera.com/health', { method: 'HEAD', cache: 'no-store' })
```

### Layer 2 — Cloudflare Worker Cron (one-time setup required)
Files are in `cloudflare-worker/keep-alive/`. The worker pings the API every 10 minutes, keeping it warm 24/7. **Free** on Cloudflare's worker free tier (100,000 requests/day included).

**Deploy steps (one-time, ~3 minutes):**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**
2. Name it `siculera-keep-alive`
3. Click **Edit code**, delete all default code, paste contents of `cloudflare-worker/keep-alive/worker.js`
4. Click **Deploy**
5. Go to **Settings** → **Triggers** → **Add Cron Trigger** → enter `*/10 * * * *` → Save

**Verify it's working:**
Visit `https://siculera-keep-alive.<your-cf-subdomain>.workers.dev` — it should return `{"ok":true,"status":200,...}`

### Worker file reference
```
cloudflare-worker/
└── keep-alive/
    ├── worker.js       # The worker code (pings /health)
    └── wrangler.toml   # Config with cron schedule */10 * * * *
```
- `ecommerce/backend/server.js` is the ecommerce app and admin dashboard on `http://localhost:4000`

## Local URLs

- Storefront: `http://localhost:4000`
- Admin login: `http://localhost:4000/admin`
- Admin dashboard: `http://localhost:4000/admin/dashboard`

> If port `4000` is already in use, the app will fall back to `4001`.
> In that case, open `http://localhost:4001` and `http://localhost:4001/admin` instead.
>
> On Windows, embedded PostgreSQL may fail to start if the Visual C++ Redistributable is missing. If that happens, install the Microsoft Visual C++ 2015-2022 runtime, or set `USE_SYSTEM_POSTGRES=true` in `ecommerce/.env` if you already have local PostgreSQL installed.

## Start the ecommerce app in VS Code

Use the VS Code task:

- `Start Siculera Ecommerce`

Or use the launch configuration:

- `Launch Siculera Ecommerce`

If the embedded PostgreSQL startup fails on Windows, install the Microsoft Visual C++ Redistributable 2015-2022 or configure a local PostgreSQL server and enable it by setting `USE_SYSTEM_POSTGRES=true` in `ecommerce/.env`.

If you prefer the terminal, from the `ecommerce` folder run:

```bash
npm install
npm start
```

Then open `http://localhost:4000/admin` in your browser.

## Production Deployment

For the recommended production setup (Cloudflare Pages frontend + Render API backend + `api.siculera.com`):

- See `DEPLOY_BACKEND_RENDER_CLOUDFLARE.md`
