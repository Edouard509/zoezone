import { db } from './utils/db.mjs';
import { json, verifyPassword, signToken, cookieHeader, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES, lockoutResponse } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  if (!email || !password) return json({ error: 'Email and password are required.' }, { status: 400 });

  const database = db();
  const rows = await database.sql`SELECT * FROM admin_users WHERE email = ${email} LIMIT 1`;
  if (!rows.length) return json({ error: 'Invalid email or password.' }, { status: 401 });

  const admin = rows[0];
  if (admin.lockout_until && new Date(admin.lockout_until) > new Date()) {
    return lockoutResponse(admin.lockout_until);
  }
  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    const attempts = admin.failed_login_attempts + 1;
    if (attempts >= LOCKOUT_THRESHOLD) {
      const lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
      await database.sql`UPDATE admin_users SET failed_login_attempts = 0, lockout_until = ${lockoutUntil} WHERE id = ${admin.id}`;
      return lockoutResponse(lockoutUntil);
    }
    await database.sql`UPDATE admin_users SET failed_login_attempts = ${attempts} WHERE id = ${admin.id}`;
    return json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  if (admin.failed_login_attempts > 0 || admin.lockout_until) {
    await database.sql`UPDATE admin_users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ${admin.id}`;
  }

  const token = signToken({ type: 'admin', sub: admin.id, email: admin.email }, '12h');

  return json(
    { id: admin.id, email: admin.email, name: admin.name },
    { headers: { 'Set-Cookie': cookieHeader('zz_admin_session', token, { maxAgeSeconds: 60 * 60 * 12 }) } }
  );
};

export const config = { path: '/api/auth/admin/login' };
