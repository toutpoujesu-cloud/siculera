# Siculera E-Commerce — Setup Guide

Get the full stack (backend API + admin dashboard + storefront) running locally in under 10 minutes.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| PostgreSQL | ≥ 14 | https://www.postgresql.org/download |
| npm | ≥ 9 (comes with Node) | — |

---

## 1 — Create the Database

Open a terminal and run:

```bash
# Log in to PostgreSQL as a superuser
psql -U postgres

# Inside psql:
CREATE DATABASE siculera;
CREATE USER siculera_user WITH ENCRYPTED PASSWORD 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON DATABASE siculera TO siculera_user;
\q
```

Then run the schema (creates all tables + seeds default data):

```bash
psql -U siculera_user -d siculera -f database/schema.sql
```

This seeds:
- 6 almond paste products
- 1 default admin account (`admin` / `Admin1234!`) — **change on first login**
- Default payment, shipping and GDPR configuration

---

## 2 — Configure Environment Variables

Copy the template and fill in your values:

```bash
# From the ecommerce/ folder:
cp .env .env.local   # optional — .env already has sensible defaults
```

Open `.env` and update these required fields:

```env
# ── Database ───────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://siculera_user:choose_a_strong_password@localhost:5432/siculera

# ── Security ───────────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_HEX

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DATA_ENCRYPTION_KEY=REPLACE_WITH_32_BYTE_HEX

# ── Payments (add keys from your provider dashboards) ──────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from Stripe CLI or dashboard

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# ── Frontend & CORS ────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:4000,http://localhost:8080
FRONTEND_URL=http://localhost:4000
```

> **Security tip:** Never commit `.env` to Git. The `.gitignore` already excludes it.

---

## 3 — Install Dependencies

```bash
cd ecommerce
npm install
```

---

## 4 — Start the Server

```bash
# Development (auto-restart on file changes):
npm run dev

# Production:
npm start
```

You should see:

```
═══════════════════════════════════════════
  Siculera API
  Environment : development
  Port        : 4000
  Database    : connected
═══════════════════════════════════════════
```

---

## 5 — Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:4000 | Storefront (customer-facing) |
| http://localhost:4000/admin | Admin login page |
| http://localhost:4000/health | API health check |

---

## 6 — First Admin Login

1. Go to http://localhost:4000/admin
2. Username: `admin`
3. Password: `Admin1234!`
4. **Immediately change your password** via Settings → Change Password

---

## 7 — Configure Payments in the Dashboard

1. Log in to the admin dashboard
2. Click **Payments** in the sidebar
3. Toggle on Stripe (or PayPal / Square / Klarna / Bank Transfer / Cash on Delivery)
4. Enter your API keys — they are encrypted with AES-256-CBC before being stored
5. Click **Test Connection** to verify the keys work
6. Save

Once Stripe is enabled, customers can pay on the storefront.

---

## 8 — Add Products

1. In the admin dashboard, click **Products**
2. Click **Add Product**
3. Fill in: name, description, flavour, price, stock, weight
4. Save — the product immediately appears on the storefront

---

## 9 — Stripe Webhooks (for production)

Install the Stripe CLI and forward webhooks locally:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

Copy the `whsec_...` secret shown and paste it into `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Project Structure

```
ecommerce/
├── backend/
│   ├── controllers/      # Business logic (auth, admin, products, orders…)
│   ├── middleware/        # JWT auth middleware
│   ├── models/            # PostgreSQL query helpers
│   ├── routes/            # Express routers
│   └── server.js          # Entry point
├── frontend/
│   └── index1.html        # Customer-facing storefront (fetches products from API)
├── admin/
│   ├── login.html         # Admin login
│   └── dashboard.html     # Full admin panel
├── database/
│   └── schema.sql         # PostgreSQL schema + seed data
├── .env                   # Environment variables (do not commit)
├── package.json
└── SETUP.md               # This file
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on startup | PostgreSQL is not running — start it first |
| `password authentication failed` | Check `DATABASE_URL` in `.env` |
| Admin login says "Invalid credentials" | Run `schema.sql` again — the admin seed may be missing |
| Products not showing on storefront | Open browser console; if you see a CORS error, add the dev server origin to `ALLOWED_ORIGINS` in `.env` |
| Stripe webhook 400 error | Check `STRIPE_WEBHOOK_SECRET` matches the value from `stripe listen` |

---

## Generating Secrets

```bash
# JWT secret (64 bytes → 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption key (32 bytes → 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
