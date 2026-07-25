-- ZOEZONE — generic fixed-window rate limiter, backed by one table so any
-- endpoint can throttle by whatever key makes sense for it (email, IP, account id).
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  attempts      INT NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now()
);
