import { db } from './utils/db.mjs';
import { json, signToken, cookieHeader } from './utils/auth.mjs';
import { sendEmail, welcomeEmailHTML } from './utils/email.mjs';

function generateReferralCode() {
  return 'ZOE-' + Math.random().toString(36).toUpperCase().slice(2, 8);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID is not set.');
    return json({ error: 'Google Sign-In is not configured yet.' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const credential = body?.credential;
  const referralCodeInput = body?.referralCode?.trim().toUpperCase() || null;
  if (!credential) return json({ error: 'Missing Google credential.' }, { status: 400 });

  // Verify the ID token with Google directly — Google validates the signature/expiry for us.
  const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!verifyRes.ok) return json({ error: 'Invalid or expired Google credential.' }, { status: 401 });
  const payload = await verifyRes.json();

  if (payload.aud !== clientId) return json({ error: 'Google credential was issued for a different app.' }, { status: 401 });
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    return json({ error: 'Your Google email is not verified.' }, { status: 401 });
  }

  const email = payload.email.trim().toLowerCase();
  const googleId = payload.sub;
  const database = db();

  // Already linked — just log in.
  let rows = await database.sql`SELECT * FROM customers WHERE google_id = ${googleId} LIMIT 1`;
  let customer = rows[0];

  if (!customer) {
    // Existing password account with the same email — link Google to it.
    rows = await database.sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;
    if (rows.length) {
      await database.sql`UPDATE customers SET google_id = ${googleId} WHERE id = ${rows[0].id}`;
      customer = { ...rows[0], google_id: googleId };
    }
  }

  let isNewAccount = false;
  if (!customer) {
    isNewAccount = true;
    let referrer = null;
    if (referralCodeInput) {
      const referrerRows = await database.sql`SELECT id FROM customers WHERE referral_code = ${referralCodeInput} LIMIT 1`;
      if (referrerRows.length) referrer = referrerRows[0];
    }

    const firstName = payload.given_name || (payload.name || '').split(' ')[0] || 'there';
    const lastName = payload.family_name || (payload.name || '').split(' ').slice(1).join(' ') || null;
    const myReferralCode = generateReferralCode();

    const inserted = await database.sql`
      INSERT INTO customers (email, password_hash, first_name, last_name, google_id, referral_code, referred_by, pending_discount_percent)
      VALUES (${email}, NULL, ${firstName}, ${lastName}, ${googleId}, ${myReferralCode}, ${referrer ? referrer.id : null}, ${referrer ? 10 : 0})
      RETURNING *
    `;
    customer = inserted[0];

    if (referrer) {
      await database.sql`UPDATE customers SET pending_discount_percent = 10 WHERE id = ${referrer.id}`;
    }

    await sendEmail({
      to: customer.email,
      subject: 'Welcome to ZOEZONE',
      html: welcomeEmailHTML({ firstName: customer.first_name }),
    });
  }

  const token = signToken({ type: 'customer', sub: customer.id, email: customer.email });

  return json(
    {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      referralCode: customer.referral_code,
      pendingDiscountPercent: Number(customer.pending_discount_percent || 0),
      isNewAccount,
    },
    { status: isNewAccount ? 201 : 200, headers: { 'Set-Cookie': cookieHeader('zz_customer_session', token) } }
  );
};

export const config = { path: '/api/auth/customer/google' };
