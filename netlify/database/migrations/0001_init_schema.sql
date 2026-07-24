-- ZOEZONE — initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  collection     TEXT NOT NULL DEFAULT 'Signature',
  categories     TEXT[] NOT NULL DEFAULT '{}',   -- tops, bottoms, outerwear, accessories
  tags           TEXT[] NOT NULL DEFAULT '{}',   -- new-era, bestseller (curated landing-page tags)
  price          NUMERIC(10,2) NOT NULL,
  was_price      NUMERIC(10,2),
  colors         TEXT[] NOT NULL DEFAULT '{}',
  sizes          TEXT[] NOT NULL DEFAULT '{}',
  swatch_colors  TEXT[] NOT NULL DEFAULT '{}',
  badge          TEXT,
  is_new         BOOLEAN NOT NULL DEFAULT false,
  media_style    TEXT,
  art            TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  details        TEXT[] NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_categories ON products USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id);

CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  first_name     TEXT,
  last_name      TEXT,
  whatsapp       TEXT,
  address        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  name           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  whatsapp        TEXT NOT NULL,
  address         TEXT NOT NULL,
  notes           TEXT,
  lat             NUMERIC,
  lng             NUMERIC,
  payment_method  TEXT NOT NULL,
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping        NUMERIC(10,2) NOT NULL,
  total           NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  qty         INT NOT NULL,
  size        TEXT,
  color       TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
