import { db } from './utils/db.mjs';
import { json, requireAdmin } from './utils/auth.mjs';

function serializePromo(row) {
  return {
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
  };
}

async function listPromos() {
  const database = db();
  const rows = await database.sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;
  return json(rows.map(serializePromo));
}

async function createPromo(req) {
  const body = await req.json().catch(() => null);
  const code = body?.code?.trim().toUpperCase();
  const discountType = body?.discountType;
  const discountValue = Number(body?.discountValue);

  if (!code || !['percent', 'fixed'].includes(discountType) || !discountValue || discountValue <= 0) {
    return json({ error: 'A code, discount type (percent/fixed), and a positive discount value are required.' }, { status: 400 });
  }
  if (discountType === 'percent' && discountValue > 100) {
    return json({ error: 'Percent discounts cannot exceed 100.' }, { status: 400 });
  }

  const database = db();
  const existing = await database.sql`SELECT code FROM promo_codes WHERE code = ${code} LIMIT 1`;
  if (existing.length) return json({ error: `A promo code "${code}" already exists.` }, { status: 409 });

  const rows = await database.sql`
    INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at, active)
    VALUES (${code}, ${discountType}, ${discountValue}, ${body.maxUses || null}, ${body.expiresAt || null}, ${body.active !== false})
    RETURNING *
  `;
  return json(serializePromo(rows[0]), { status: 201 });
}

async function updatePromo(code, req) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

  const database = db();
  const existing = await database.sql`SELECT * FROM promo_codes WHERE code = ${code} LIMIT 1`;
  if (!existing.length) return json({ error: 'Promo code not found' }, { status: 404 });
  const current = existing[0];

  const rows = await database.sql`
    UPDATE promo_codes SET
      discount_type = ${body.discountType ?? current.discount_type},
      discount_value = ${body.discountValue ?? current.discount_value},
      max_uses = ${body.maxUses !== undefined ? body.maxUses : current.max_uses},
      expires_at = ${body.expiresAt !== undefined ? body.expiresAt : current.expires_at},
      active = ${body.active !== undefined ? !!body.active : current.active}
    WHERE code = ${code}
    RETURNING *
  `;
  return json(serializePromo(rows[0]));
}

async function deletePromo(code) {
  const database = db();
  await database.sql`DELETE FROM promo_codes WHERE code = ${code}`;
  return json({ ok: true });
}

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { code } = context.params;

  if (!code) {
    if (req.method === 'GET') return listPromos();
    if (req.method === 'POST') return createPromo(req);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (req.method === 'PUT') return updatePromo(code.toUpperCase(), req);
  if (req.method === 'DELETE') return deletePromo(code.toUpperCase());
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/admin/promo', '/api/admin/promo/:code'] };
