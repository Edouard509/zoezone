import crypto from 'node:crypto';
import { db } from './utils/db.mjs';
import { json } from './utils/auth.mjs';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const token = body?.token;
  if (!email || !token) return json({ error: 'This verification link is invalid.' }, { status: 400 });

  const database = db();
  const rows = await database.sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;
  if (!rows.length) return json({ error: 'This verification link is invalid or has expired.' }, { status: 400 });

  const customer = rows[0];
  if (customer.email_verified) return json({ ok: true, alreadyVerified: true });

  const tokenHash = hashToken(token);
  const validToken = customer.email_verify_token_hash && customer.email_verify_token_hash === tokenHash;
  const notExpired = customer.email_verify_expires && new Date(customer.email_verify_expires) > new Date();
  if (!validToken || !notExpired) {
    return json({ error: 'This verification link is invalid or has expired. Please request a new one.' }, { status: 400 });
  }

  await database.sql`
    UPDATE customers SET email_verified = true, email_verify_token_hash = NULL, email_verify_expires = NULL
    WHERE id = ${customer.id}
  `;

  // The referral discount for both sides only unlocks once the referred
  // account's email is confirmed real — this is what it was waiting on.
  if (customer.referred_by) {
    await database.sql`UPDATE customers SET pending_discount_percent = 10 WHERE id = ${customer.id}`;
    await database.sql`UPDATE customers SET pending_discount_percent = 10 WHERE id = ${customer.referred_by}`;
  }

  return json({ ok: true });
};

export const config = { path: '/api/auth/customer/verify-email' };
