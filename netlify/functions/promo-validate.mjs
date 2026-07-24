import { db } from './utils/db.mjs';
import { json } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const code = body?.code?.trim().toUpperCase();
  if (!code) return json({ valid: false, error: 'Please enter a promo code.' }, { status: 400 });

  const database = db();
  const rows = await database.sql`SELECT * FROM promo_codes WHERE code = ${code} LIMIT 1`;
  if (!rows.length) return json({ valid: false, error: 'That promo code doesn\'t exist.' }, { status: 404 });

  const promo = rows[0];
  if (!promo.active) return json({ valid: false, error: 'That promo code is no longer active.' }, { status: 400 });
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return json({ valid: false, error: 'That promo code has expired.' }, { status: 400 });
  }
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return json({ valid: false, error: 'That promo code has reached its usage limit.' }, { status: 400 });
  }

  return json({
    valid: true,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
  });
};

export const config = { path: '/api/promo/validate' };
