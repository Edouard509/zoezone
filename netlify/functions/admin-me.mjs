import { db } from './utils/db.mjs';
import { json, requireAdmin } from './utils/auth.mjs';

export default async (req) => {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const database = db();
  const rows = await database.sql`SELECT id, email, name FROM admin_users WHERE id = ${auth.admin.sub} LIMIT 1`;
  if (!rows.length) return json({ error: 'Admin not found' }, { status: 404 });

  return json(rows[0]);
};

export const config = { path: '/api/auth/admin/me' };
