-- Checkout now collects an email address so guest orders can receive a confirmation email.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT;
