import crypto from 'node:crypto';
import { db } from './utils/db.mjs';
import { json, hashPassword, signToken, cookieHeader } from './utils/auth.mjs';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const token = body?.token;
  const newPassword = body?.newPassword;

  if (!email || !token || !newPassword || newPassword.length < 6) {
    return json({ error: 'Please provide a valid reset link and a password of at least 6 characters.' }, { status: 400 });
  }

  const database = db();
  const rows = await database.sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;
  if (!rows.length) return json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });

  const customer = rows[0];
  const tokenHash = hashToken(token);
  const validToken = customer.password_reset_token_hash && customer.password_reset_token_hash === tokenHash;
  const notExpired = customer.password_reset_expires && new Date(customer.password_reset_expires) > new Date();

  if (!validToken || !notExpired) {
    return json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await database.sql`
    UPDATE customers SET
      password_hash = ${passwordHash},
      password_reset_token_hash = NULL,
      password_reset_expires = NULL
    WHERE id = ${customer.id}
  `;

  const sessionToken = signToken({ type: 'customer', sub: customer.id, email: customer.email });

  return json(
    { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name },
    { headers: { 'Set-Cookie': cookieHeader('zz_customer_session', sessionToken) } }
  );
};

export const config = { path: '/api/auth/customer/reset-password' };
