import { db, serializeOrder } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';

export default async (req) => {
  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Not signed in' }, { status: 401 });

  const database = db();

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    const { firstName, lastName, whatsapp, address } = body;
    await database.sql`
      UPDATE customers SET
        first_name = COALESCE(${firstName}, first_name),
        last_name = COALESCE(${lastName}, last_name),
        whatsapp = COALESCE(${whatsapp}, whatsapp),
        address = COALESCE(${address}, address)
      WHERE id = ${customer.sub}
    `;
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const rows = await database.sql`SELECT * FROM customers WHERE id = ${customer.sub} LIMIT 1`;
  if (!rows.length) return json({ error: 'Account not found' }, { status: 404 });
  const c = rows[0];

  const orderRows = await database.sql`SELECT * FROM orders WHERE customer_id = ${customer.sub} ORDER BY created_at DESC`;
  const orders = [];
  for (const o of orderRows) {
    const items = await database.sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;
    orders.push(serializeOrder(o, items));
  }

  return json({
    id: c.id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    whatsapp: c.whatsapp,
    address: c.address,
    referralCode: c.referral_code,
    pendingDiscountAmount: Number(c.pending_discount_amount),
    memberSince: c.created_at,
    avatarUrl: c.avatar_url,
    orders,
  });
};

export const config = { path: '/api/auth/customer/me' };
