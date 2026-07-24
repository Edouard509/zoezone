-- ZOEZONE — support "Sign in with Google" alongside email/password.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE customers ALTER COLUMN password_hash DROP NOT NULL;
