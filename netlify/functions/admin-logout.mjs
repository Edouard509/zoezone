import { json, cookieHeader } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  return json({ ok: true }, { headers: { 'Set-Cookie': cookieHeader('zz_admin_session', '', { clear: true }) } });
};

export const config = { path: '/api/auth/admin/logout' };
