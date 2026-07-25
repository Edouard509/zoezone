import { db } from './db.mjs';

// Fixed-window rate limiter backed by Postgres. Returns true if this attempt
// is allowed (and records it), false if `key` has already hit `maxAttempts`
// within the last `windowMinutes`. The upsert is a single atomic statement,
// so concurrent requests for the same key can't race past the limit.
export async function checkRateLimit(key, { maxAttempts, windowMinutes }) {
  const database = db();
  const rows = await database.sql`
    INSERT INTO rate_limits (key, attempts, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN rate_limits.window_start < now() - make_interval(mins => ${windowMinutes})
        THEN 1
        ELSE rate_limits.attempts + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - make_interval(mins => ${windowMinutes})
        THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING attempts
  `;
  return rows[0].attempts <= maxAttempts;
}

export function clientIp(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}
