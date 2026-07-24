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

  const { firstName, lastName, email, whatsapp, address, notes, location, payment, items, subtotal, shipping } = body;

  const errors = [];
  if (!firstName) errors.push('first name');
  if (!lastName) errors.push('last name');
  if (!email || !email.includes('@')) errors.push('a valid email address');
  if (!whatsapp) errors.push('WhatsApp number');
  if (!address) errors.push('address');
  if (!location || location.lat == null || location.lng == null) errors.push('a pinned location on the map');
  if (!payment || !payment.method) errors.push('payment method');
  if (!Array.isArray(items) || !items.length) errors.push('items');
  if (errors.length) {
    return json({ error: 'Missing: ' + errors.join(', ') }, { status: 400 });
  }

  const database = db();
  const customer = getCustomerFromRequest(req);
  const orderId = generateOrderId();

  // Referral discount is decided server-side from the customer's account state — never trust a client-submitted discount.
  let discountPercent = 0;
  if (customer) {
    const rows = await database.sql`SELECT pending_discount_percent FROM customers WHERE id = ${customer.sub} LIMIT 1`;
    if (rows.length) discountPercent = rows[0].pending_discount_percent || 0;
  }
  const discountedSubtotal = Math.round(subtotal * (1 - discountPercent / 100) * 100) / 100;
  const finalTotal = Math.round((discountedSubtotal + shipping) * 100) / 100;

  await database.sql`
    INSERT INTO orders
      (id, customer_id, first_name, last_name, email, whatsapp, address, notes, lat, lng, payment_method, subtotal, shipping, discount_percent, total, status)
    VALUES
      (${orderId}, ${customer ? customer.sub : null}, ${firstName}, ${lastName}, ${email}, ${whatsapp}, ${address}, ${notes || null},
       ${location.lat}, ${location.lng}, ${payment.method},
       ${subtotal}, ${shipping}, ${discountPercent}, ${finalTotal}, 'pending')
  `;

  for (const item of items) {
    await database.sql`
      INSERT INTO order_items (order_id, product_id, name, price, qty, size, color)
      VALUES (${orderId}, ${item.id || null}, ${item.name}, ${item.price}, ${item.qty}, ${item.size || null}, ${item.color || null})
    `;
  }

  if (customer && discountPercent > 0) {
    await database.sql`UPDATE customers SET pending_discount_percent = 0 WHERE id = ${customer.sub}`;
  }

  const orderForEmail = {
    id: orderId,
    customer: { firstName, lastName, email, whatsapp, address, notes },
    items,
    subtotal: discountedSubtotal,
    shipping,
    total: finalTotal,
  };
  await sendEmail({
    to: email,
    subject: `Order Confirmed — ${orderId}`,
    html: orderConfirmationHTML({ order: orderForEmail }),
    fromEmail: 'orders@zoezone.co',
  });

  return json({ id: orderId, discountPercent, subtotal: discountedSubtotal, total: finalTotal }, { status: 201 });
}

async function getOrder(id, req) {
  const database = db();
  const rows = await database.sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return json({ error: 'Order not found' }, { status: 404 });

  const url = new URL(req.url);
  const emailParam = url.searchParams.get('email');
  // Public guest lookups (no session) must also provide the order's email as a lightweight ownership check.
  const customer = getCustomerFromRequest(req);
  const isOwner = customer && rows[0].customer_id === customer.sub;
  if (!isOwner) {
    if (!emailParam || emailParam.trim().toLowerCase() !== (rows[0].email || '').toLowerCase()) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
  }

  const items = await database.sql`SELECT * FROM order_items WHERE order_id = ${id}`;
  return json(serializeOrder(rows[0], items));
}

export default async (req, context) => {
  if (req.method === 'POST') return createOrder(req);
  if (req.method === 'GET') {
    const { id } = context.params;
    if (!id) return json({ error: 'Missing order id' }, { status: 400 });
    return getOrder(id, req);
  }
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/orders', '/api/orders/:id'] };
