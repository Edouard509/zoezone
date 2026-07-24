-- ZOEZONE — promo codes, inventory tracking, review purchase-verification + media + replies, avatars.

-- Inventory
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 50;

-- Promo codes (separate from the automatic referral discount)
CREATE TABLE IF NOT EXISTS promo_codes (
  code            TEXT PRIMARY KEY,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  NUMERIC(10,2) NOT NULL,
  max_uses        INT,
  uses_count      INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Reviews: verified-purchase tracking, media, and admin replies
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_reply_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews (customer_id);

-- Profile pictures
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
