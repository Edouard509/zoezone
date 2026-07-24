import { db } from './utils/db.mjs';
import { json, hashPassword, signToken, cookieHeader } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!name || !email || !email.includes('@') || !password || password.length < 6) {
    return json({ error: 'Please provide a name, valid email, and a password of at least 6 characters.' }, { status: 400 });
  }

  const database = db();
  const existing = await database.sql`SELECT id FROM customers WHERE email = ${email} LIMIT 1`;
  if (existing.length) {
    return json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ');
  const passwordHash = await hashPassword(password);

  const rows = await database.sql`
    INSERT INTO customers (email, password_hash, first_name, last_name)
    VALUES (${email}, ${passwordHash}, ${firstName}, ${lastName || null})
    RETURNING id, email, first_name, last_name
  `;
  const customer = rows[0];

  const token = signToken({ type: 'customer', sub: customer.id, email: customer.email });

  return json(
    { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name },
    { status: 201, headers: { 'Set-Cookie': cookieHeader('zz_customer_session', token) } }
  );
};

export const config = { path: '/api/auth/customer/signup' };
