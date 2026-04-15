-- Siculera E-Commerce PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  phone         VARCHAR(30),
  role          VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer','admin','wholesale')),
  is_verified   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  full_name   VARCHAR(200) NOT NULL,
  line1       VARCHAR(255) NOT NULL,
  line2       VARCHAR(255),
  city        VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country     VARCHAR(100) NOT NULL DEFAULT 'Italy',
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         VARCHAR(120) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  flavour      VARCHAR(80),
  price_cents  INTEGER NOT NULL,
  weight_grams INTEGER,
  stock        INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  is_giftable  BOOLEAN DEFAULT TRUE,
  image_url    VARCHAR(500),
  meta_title   VARCHAR(255),
  meta_desc    VARCHAR(500),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) UNIQUE NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_collections (
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number         VARCHAR(40) UNIQUE NOT NULL,
  user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_email          VARCHAR(255),
  status               VARCHAR(40) DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
  subtotal_cents       INTEGER NOT NULL DEFAULT 0,
  shipping_cents       INTEGER NOT NULL DEFAULT 0,
  total_cents          INTEGER NOT NULL DEFAULT 0,
  currency             CHAR(3) DEFAULT 'EUR',
  shipping_method      VARCHAR(80),
  is_gift              BOOLEAN DEFAULT FALSE,
  gift_message         TEXT,
  notes                TEXT,
  stripe_payment_id    VARCHAR(255),
  stripe_client_secret VARCHAR(255),
  shipped_at           TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name     VARCHAR(255) NOT NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  full_name   VARCHAR(200) NOT NULL,
  line1       VARCHAR(255) NOT NULL,
  line2       VARCHAR(255),
  city        VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  phone       VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  stripe_payment_id VARCHAR(255) UNIQUE,
  stripe_charge_id  VARCHAR(255),
  amount_cents      INTEGER NOT NULL,
  currency          CHAR(3) DEFAULT 'EUR',
  status            VARCHAR(40) DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded')),
  payment_method    VARCHAR(80),
  receipt_url       VARCHAR(500),
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wholesale_enquiries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     VARCHAR(200) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  country       VARCHAR(100),
  business_type VARCHAR(100),
  quantity_info TEXT,
  message       TEXT,
  status        VARCHAR(40) DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments(order_id);

INSERT INTO products (slug, name, description, flavour, price_cents, weight_grams, stock) VALUES
  ('traditional-almond-paste',  'Traditional Sicilian Almond Paste',    'The timeless classic, simple and unmistakably Sicilian.', 'traditional', 1800, 200, 100),
  ('lemon-almond-paste',        'Lemon Almond Paste',                   'Fresh citrus brightness with a delicate almond base.', 'lemon', 1900, 200, 100),
  ('orange-almond-paste',       'Orange Almond Paste',                  'Warm, fragrant, and full of Mediterranean character.', 'orange', 1900, 200, 100),
  ('pistachio-almond-paste',    'Pistachio Almond Paste',               'Smooth, richer, and naturally more indulgent.', 'pistachio', 2200, 200, 80),
  ('apricot-jam-almond-paste',  'Almond Paste with Apricot Jam',        'Soft fruit sweetness with a refined almond finish.', 'apricot', 2100, 200, 80),
  ('caramelized-cherry-almond', 'Almond Paste with Caramelized Cherry', 'Elegant, distinctive, and made for memorable gifting.', 'cherry', 2300, 200, 60)
ON CONFLICT (slug) DO NOTHING;

-- Settings / configuration store
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(120) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default payment config (all disabled until configured)
INSERT INTO settings (key, value) VALUES (
  'payment_config',
  '{"stripe":{"enabled":false},"paypal":{"enabled":false},"square":{"enabled":false},"klarna":{"enabled":false},"bank_transfer":{"enabled":false},"cash_on_delivery":{"enabled":false}}'
) ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- NEW TABLES & ADDITIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin users (separate from customer users)
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(80) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(40) DEFAULT 'admin' CHECK (role IN ('superadmin','admin','viewer')),
  last_login    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for security/GDPR
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action     VARCHAR(120) NOT NULL,
  entity     VARCHAR(80),
  entity_id  VARCHAR(255),
  ip_address VARCHAR(45),
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracking events for orders
CREATE TABLE IF NOT EXISTS tracking_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
  carrier      VARCHAR(60),
  tracking_num VARCHAR(120),
  status       VARCHAR(120),
  location     VARCHAR(255),
  description  TEXT,
  event_time   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add tracking columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier         VARCHAR(60);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url    VARCHAR(500);

-- Add payment provider to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(40) DEFAULT 'stripe';

-- Seed default admin (password: Admin1234! — change on first login)
-- bcrypt hash of "Admin1234!"
INSERT INTO admin_users (username, email, password_hash, role)
VALUES ('admin', 'admin@siculera.it', '$2a$10$TJhod4jwtPHbIMAzXWNnZuI272G6A6VoKpv951Zm7GZfqeDkTmHV.', 'superadmin')
ON CONFLICT (username) DO NOTHING;

-- Shipping config
INSERT INTO settings (key, value) VALUES (
  'shipping_config',
  '{"dhl":{"enabled":false,"account_number":"","api_key":""},"ups":{"enabled":false,"account_number":"","api_key":"","api_secret":""},"brt":{"enabled":false,"account_number":"","api_key":""},"gls":{"enabled":false,"account_number":"","api_key":""},"sda":{"enabled":false,"account_number":"","api_key":""},"flat_rate":{"enabled":true,"price_cents":600},"free_threshold_cents":5000}'
) ON CONFLICT (key) DO NOTHING;

-- GDPR config
INSERT INTO settings (key, value) VALUES (
  'gdpr_config',
  '{"data_retention_days":730,"cookie_consent_required":true,"marketing_emails_opt_in":true,"auto_anonymize_deleted":true,"encryption_at_rest":true}'
) ON CONFLICT (key) DO NOTHING;
