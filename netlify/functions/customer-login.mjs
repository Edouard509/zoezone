import { db } from './utils/db.mjs';
import { json, verifyPassword, signToken, cookieHeader, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES, lockoutResponse } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const database = db();
  const rows = await database.sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;
  if (!rows.length) return json({ error: 'Invalid email or password.' }, { status: 401 });

  const customer = rows[0];
  if (customer.lockout_until && new Date(customer.lockout_until) > new Date()) {
    return lockoutResponse(customer.lockout_until);
  }
  if (!customer.password_hash) {
    return json({ error: 'This account uses Google Sign-In. Please continue with Google instead.' }, { status: 401 });
  }
  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) {
    const attempts = customer.failed_login_attempts + 1;
    if (attempts >= LOCKOUT_THRESHOLD) {
      const lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
      await database.sql`UPDATE customers SET failed_login_attempts = 0, lockout_until = ${lockoutUntil} WHERE id = ${customer.id}`;
      return lockoutResponse(lockoutUntil);
    }
    await database.sql`UPDATE customers SET failed_login_attempts = ${attempts} WHERE id = ${customer.id}`;
    return json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  if (customer.failed_login_attempts > 0 || customer.lockout_until) {
    await database.sql`UPDATE customers SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ${customer.id}`;
  }

  const token = signToken({ type: 'customer', sub: customer.id, email: customer.email });

  return json(
    { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name },
    { headers: { 'Set-Cookie': cookieHeader('zz_customer_session', token) } }
  );
};

export const config = { path: '/api/auth/customer/login' };
