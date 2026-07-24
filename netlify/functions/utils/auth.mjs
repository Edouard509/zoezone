import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.CONTEXT === 'production') {
  console.warn('WARNING: JWT_SECRET is not set. Run `netlify env:set JWT_SECRET <random-value>` before going live.');
}
const SECRET = JWT_SECRET || 'dev-insecure-secret-change-me';

export function json(data, init = {}) {
  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, SECRET, { expiresIn });
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function cookieHeader(name, value, { maxAgeSeconds = 60 * 60 * 24 * 30, clear = false } = {}) {
  const parts = [`${name}=${clear ? '' : encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.CONTEXT !== 'dev') parts.push('Secure');
  parts.push(clear ? 'Max-Age=0' : `Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

export function getCustomerFromRequest(req) {
  const token = parseCookies(req)['zz_customer_session'];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'customer') return null;
  return payload;
}

export function getAdminFromRequest(req) {
  const token = parseCookies(req)['zz_admin_session'];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  return payload;
}

export function requireAdmin(req) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return { ok: false, response: json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, admin };
}
