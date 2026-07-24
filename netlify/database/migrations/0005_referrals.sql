-- ZOEZONE — referral program: every customer gets a shareable code;
-- redeeming someone else's code at signup credits both accounts 10% off their next order.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pending_discount_percent INT NOT NULL DEFAULT 0;

-- Backfill a referral code for any customers created before this migration.
DO $$
DECLARE
  c RECORD;
  new_code TEXT;
BEGIN
  FOR c IN SELECT id FROM customers WHERE referral_code IS NULL LOOP
    new_code := 'ZOE-' || upper(substr(md5(random()::text || c.id::text), 1, 6));
    UPDATE customers SET referral_code = new_code WHERE id = c.id;
  END LOOP;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;
