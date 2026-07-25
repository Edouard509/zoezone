import crypto from 'node:crypto';
import { db } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';
import { sendEmail, verifyEmailHTML } from './utils/email.mjs';
import { checkRateLimit } from './utils/rate-limit.mjs';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const session = getCustomerFromRequest(req);
  if (!session) return json({ error: 'Please sign in.' }, { status: 401 });

  const database = db();
  const rows = await database.sql`SELECT * FROM customers WHERE id = ${session.sub} LIMIT 1`;
  if (!rows.length) return json({ error: 'Account not found.' }, { status: 404 });

  const customer = rows[0];
  if (customer.email_verified) return json({ ok: true, alreadyVerified: true });

  const allowed = await checkRateLimit(`resend-verification:${customer.id}`, { maxAttempts: 3, windowMinutes: 15 });
  if (!allowed) {
    return json({ error: 'Please wait a bit before requesting another verification email.' }, { status: 429 });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await database.sql`
    UPDATE customers SET email_verify_token_hash = ${tokenHash}, email_verify_expires = ${expires.toISOString()}
    WHERE id = ${customer.id}
  `;

  const verifyUrl = `https://zoezone.co/verify-email.html?token=${rawToken}&email=${encodeURIComponent(customer.email)}`;
  await sendEmail({
    to: customer.email,
    subject: 'Verify your ZOEZONE email',
    html: verifyEmailHTML({ firstName: customer.first_name, verifyUrl }),
  });

  return json({ ok: true });
};

export const config = { path: '/api/auth/customer/resend-verification' };
