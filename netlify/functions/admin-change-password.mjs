import { db } from './utils/db.mjs';
import { json, requireAdmin, verifyPassword, hashPassword } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return json({ error: 'Current password and a new password (min. 8 characters) are required.' }, { status: 400 });
  }

  const database = db();
  const rows = await database.sql`SELECT * FROM admin_users WHERE id = ${auth.admin.sub} LIMIT 1`;
  if (!rows.length) return json({ error: 'Admin not found' }, { status: 404 });

  const valid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!valid) return json({ error: 'Current password is incorrect.' }, { status: 401 });

  const newHash = await hashPassword(newPassword);
  await database.sql`UPDATE admin_users SET password_hash = ${newHash} WHERE id = ${auth.admin.sub}`;

  return json({ ok: true });
};

export const config = { path: '/api/auth/admin/change-password' };
