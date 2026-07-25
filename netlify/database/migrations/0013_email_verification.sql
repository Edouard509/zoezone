-- ZOEZONE — verify a customer actually owns the email they signed up with,
-- before we send them order/referral emails or credit a referral to their address.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verify_token_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ;

-- Grandfather every account that already exists — this only gates signups going
-- forward, it shouldn't suddenly nag real existing customers to reverify.
UPDATE customers SET email_verified = true WHERE email_verified = false;
