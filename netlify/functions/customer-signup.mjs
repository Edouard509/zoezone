import { db } from './utils/db.mjs';
import { json, hashPassword, signToken, cookieHeader } from './utils/auth.mjs';
import { sendEmail, welcomeEmailHTML } from './utils/email.mjs';

function generateReferralCode() {
  return 'ZOE-' + Math.random().toString(36).toUpperCase().slice(2, 8);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const referralCodeInput = body?.referralCode?.trim().toUpperCase() || null;

  if (!name || !email || !email.includes('@') || !password || password.length < 6) {
    return json({ error: 'Please provide a name, valid email, and a password of at least 6 characters.' }, { status: 400 });
  }

  const database = db();
  const existing = await database.sql`SELECT id FROM customers WHERE email = ${email} LIMIT 1`;
  if (existing.length) {
    return json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  let referrer = null;
  if (referralCodeInput) {
    const referrerRows = await database.sql`SELECT id FROM customers WHERE referral_code = ${referralCodeInput} LIMIT 1`;
    if (referrerRows.length) referrer = referrerRows[0];
  }

  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ');
  const passwordHash = await hashPassword(password);
  const myReferralCode = generateReferralCode();

  const rows = await database.sql`
    INSERT INTO customers (email, password_hash, first_name, last_name, referral_code, referred_by, pending_discount_amount)
    VALUES (${email}, ${passwordHash}, ${firstName}, ${lastName || null}, ${myReferralCode}, ${referrer ? referrer.id : null}, ${referrer ? 10 : 0})
    RETURNING id, email, first_name, last_name, referral_code, pending_discount_amount
  `;
  const customer = rows[0];

  if (referrer) {
    await database.sql`UPDATE customers SET pending_discount_amount = 10 WHERE id = ${referrer.id}`;
  }

  await sendEmail({
    to: customer.email,
    subject: 'Welcome to ZOEZONE',
    html: welcomeEmailHTML({ firstName: customer.first_name }),
  });

  const token = signToken({ type: 'customer', sub: customer.id, email: customer.email });

  return json(
    {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      referralCode: customer.referral_code,
      pendingDiscountAmount: Number(customer.pending_discount_amount),
    },
    { status: 201, headers: { 'Set-Cookie': cookieHeader('zz_customer_session', token) } }
  );
};

export const config = { path: '/api/auth/customer/signup' };
