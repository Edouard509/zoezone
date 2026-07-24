-- ZOEZONE — switch the referral reward from 10% off to a flat $10 off.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pending_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
UPDATE customers SET pending_discount_amount = 10 WHERE pending_discount_percent = 10 AND pending_discount_amount = 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
