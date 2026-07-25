-- ZOEZONE — PayPal transaction fee, tracked distinctly from the product/shipping totals.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
