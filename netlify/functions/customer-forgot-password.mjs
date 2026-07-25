import crypto from 'node:crypto';
import { db } from './utils/db.mjs';
import { json } from './utils/auth.mjs';
import { sendEmail, passwordResetHTML, googleOnlyAccountHTML } from './utils/email.mjs';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const database = db();
  const rows = await database.sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;

  // Always respond the same way regardless of whether the account exists — avoids leaking registered emails.
  if (!rows.length) {
    return json({ ok: true });
  }
  const customer = rows[0];

  if (!customer.password_hash) {
    await sendEmail({
      to: customer.email,
      subject: 'About your ZOEZONE password reset request',
      html: googleOnlyAccountHTML({ firstName: customer.first_name }),
    });
    return json({ ok: true });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await database.sql`
    UPDATE customers SET password_reset_token_hash = ${tokenHash}, password_reset_expires = ${expires.toISOString()}
    WHERE id = ${customer.id}
  `;

  const resetUrl = `https://zoezone.co/reset-password.html?token=${rawToken}&email=${encodeURIComponent(customer.email)}`;
  await sendEmail({
    to: customer.email,
    subject: 'Reset your ZOEZONE password',
    html: passwordResetHTML({ firstName: customer.first_name, resetUrl }),
  });

  return json({ ok: true });
};

export const config = { path: '/api/auth/customer/forgot-password' };
