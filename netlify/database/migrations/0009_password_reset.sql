-- ZOEZONE — password reset flow.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
