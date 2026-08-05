const COOKIE_NAME = 'zz_site_unlock';

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return null;
}

// Mirrors the signing in netlify/functions/site-unlock.mjs — same Web Crypto
// HMAC, same secret, so a cookie minted by that function verifies here.
async function sign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (request, context) => {
  const secret = Netlify.env.get('JWT_SECRET');
  // Fail open rather than lock everyone (including the owner) out entirely
  // if the secret somehow isn't set in this environment.
  if (!secret) return;

  const cookieValue = getCookie(request, COOKIE_NAME);
  if (cookieValue) {
    const dot = cookieValue.indexOf('.');
    if (dot !== -1) {
      const expiresAtStr = cookieValue.slice(0, dot);
      const signature = cookieValue.slice(dot + 1);
      const expiresAt = Number(expiresAtStr);
      if (expiresAt && expiresAt > Math.floor(Date.now() / 1000)) {
        const expectedSig = await sign(expiresAtStr, secret);
        if (expectedSig === signature) {
          return; // valid, unexpired unlock cookie — let the real request through
        }
      }
    }
  }

  return context.rewrite('/coming-soon.html');
};

export const config = {
  path: '/*',
  excludedPath: ['/coming-soon.html', '/admin/*', '/api/*', '/assets/*', '/favicon.ico', '/robots.txt', '/sitemap.xml'],
};
