import { db, serializeOrder } from './utils/db.mjs';
import { json, requireAdmin } from './utils/auth.mjs';
import { sendEmail, orderStatusUpdateHTML } from './utils/email.mjs';

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

async function listOrders(req) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const database = db();

  const rows = status
    ? await database.sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC`
    : await database.sql`SELECT * FROM orders ORDER BY created_at DESC`;

  const orders = [];
  for (const o of rows) {
    const items = await database.sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;
    orders.push(serializeOrder(o, items));
  }
  return json(orders);
}

async function getOrder(id) {
  const database = db();
  const rows = await database.sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return json({ error: 'Order not found' }, { status: 404 });
  const items = await database.sql`SELECT * FROM order_items WHERE order_id = ${id}`;
  return json(serializeOrder(rows[0], items));
}

async function updateOrderStatus(id, req) {
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  const database = db();
  const existing = await database.sql`SELECT id, email, first_name, status FROM orders WHERE id = ${id} LIMIT 1`;
  if (!existing.length) return json({ error: 'Order not found' }, { status: 404 });

  const order = existing[0];
  await database.sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;

  if (order.status !== status && order.email) {
    await sendEmail({
      to: order.email,
      subject: `Order ${id} — ${STATUS_LABEL[status]}`,
      html: orderStatusUpdateHTML({ orderId: id, firstName: order.first_name, status }),
      fromEmail: 'orders@zoezone.co',
    });
  }

  return getOrder(id);
}

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = context.params;

  if (!id) {
    if (req.method === 'GET') return listOrders(req);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (req.method === 'GET') return getOrder(id);
  if (req.method === 'PUT') return updateOrderStatus(id, req);
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/admin/orders', '/api/admin/orders/:id'] };
