import { webcrypto } from 'node:crypto';
import { json } from './utils/auth.mjs';
import { checkRateLimit, clientIp } from './utils/rate-limit.mjs';

const COOKIE_NAME = 'zz_site_unlock';
const UNLOCK_DAYS = 90;

// Signs a lightweight, stateless "the whole site is unlocked" cookie using
// Web Crypto (available identically in Node and in the Deno-based edge
// function that checks it on every request) — no DB lookup needed to gate
// every single page load.
async function sign(message, secret) {
  const enc = new TextEncoder();
  const key = await webcrypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await webcrypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const secret = process.env.JWT_SECRET;
  const expectedUser = process.env.SITE_ACCESS_USERNAME;
  const expectedPass = process.env.SITE_ACCESS_PASSWORD;
  if (!secret || !expectedUser || !expectedPass) {
    console.error('Site-gate credentials are not fully configured.');
    return json({ error: 'Site access is not configured yet.' }, { status: 500 });
  }

  const allowed = await checkRateLimit(`site-unlock:${clientIp(req)}`, { maxAttempts: 8, windowMinutes: 15 });
  if (!allowed) {
    return json({ error: 'Too many attempts — please wait a bit and try again.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const username = body?.username?.trim();
  const password = body?.password;
  if (!username || !password) return json({ error: 'Username and password are required.' }, { status: 400 });

  if (username !== expectedUser || password !== expectedPass) {
    return json({ error: 'Incorrect username or password.' }, { status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_DAYS * 24 * 60 * 60;
  const signature = await sign(String(expiresAt), secret);
  const cookieValue = `${expiresAt}.${signature}`;

  const parts = [`${COOKIE_NAME}=${cookieValue}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${UNLOCK_DAYS * 24 * 60 * 60}`];
  if (process.env.CONTEXT !== 'dev') parts.push('Secure');

  return json({ ok: true }, { headers: { 'Set-Cookie': parts.join('; ') } });
};

export const config = { path: '/api/site-unlock' };
