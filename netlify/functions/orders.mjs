import { db, serializeOrder } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';
import { sendEmail, orderConfirmationHTML } from './utils/email.mjs';

function generateOrderId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `ZZ-${stamp}${rand}`;
}

async function createOrder(req) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

  const { firstName, lastName, email, whatsapp, address, notes, location, payment, items, subtotal, shipping, total } = body;

  const errors = [];
  if (!firstName) errors.push('first name');
  if (!lastName) errors.push('last name');
  if (!email || !email.includes('@')) errors.push('a valid email address');
  if (!whatsapp) errors.push('WhatsApp number');
  if (!address) errors.push('address');
  if (!payment || !payment.method) errors.push('payment method');
  if (!Array.isArray(items) || !items.length) errors.push('items');
  if (errors.length) {
    return json({ error: 'Missing: ' + errors.join(', ') }, { status: 400 });
  }

  const database = db();
  const customer = getCustomerFromRequest(req);
  const orderId = generateOrderId();

  await database.sql`
    INSERT INTO orders
      (id, customer_id, first_name, last_name, email, whatsapp, address, notes, lat, lng, payment_method, subtotal, shipping, total, status)
    VALUES
      (${orderId}, ${customer ? customer.sub : null}, ${firstName}, ${lastName}, ${email}, ${whatsapp}, ${address}, ${notes || null},
       ${location ? location.lat : null}, ${location ? location.lng : null}, ${payment.method},
       ${subtotal}, ${shipping}, ${total}, 'pending')
  `;

  for (const item of items) {
    await database.sql`
      INSERT INTO order_items (order_id, product_id, name, price, qty, size, color)
      VALUES (${orderId}, ${item.id || null}, ${item.name}, ${item.price}, ${item.qty}, ${item.size || null}, ${item.color || null})
    `;
  }

  const orderForEmail = {
    id: orderId,
    customer: { firstName, lastName, email, whatsapp, address, notes },
    items,
    subtotal,
    shipping,
    total,
  };
  await sendEmail({
    to: email,
    subject: `Order Confirmed — ${orderId}`,
    html: orderConfirmationHTML({ order: orderForEmail }),
    fromEmail: 'orders@zoezone.co',
  });

  return json({ id: orderId }, { status: 201 });
}

async function getOrder(id) {
  const database = db();
  const rows = await database.sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return json({ error: 'Order not found' }, { status: 404 });
  const items = await database.sql`SELECT * FROM order_items WHERE order_id = ${id}`;
  return json(serializeOrder(rows[0], items));
}

export default async (req, context) => {
  if (req.method === 'POST') return createOrder(req);
  if (req.method === 'GET') {
    const { id } = context.params;
    if (!id) return json({ error: 'Missing order id' }, { status: 400 });
    return getOrder(id);
  }
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/orders', '/api/orders/:id'] };
