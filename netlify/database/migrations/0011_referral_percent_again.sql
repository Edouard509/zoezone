-- ZOEZONE — switch the referral reward back from a flat $10 to 10% off
-- (10% pushes a bigger first-order basket than a flat amount does).
-- pending_discount_percent already exists from migration 0005 and was never dropped.
UPDATE customers SET pending_discount_percent = 10, pending_discount_amount = 0
  WHERE pending_discount_amount = 10 AND pending_discount_percent = 0;
