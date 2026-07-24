import { db, serializeOrder } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';
import { sendEmail, orderConfirmationHTML } from './utils/email.mjs';

function generateOrderId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `ZZ-${stamp}${rand}`;
}

async function createOrder(req) {
  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Please sign in to place an order.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

  const { firstName, lastName, email, whatsapp, address, notes, location, payment, items, subtotal, shipping, promoCode } = body;

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

  // ---------- stock check (best-effort; not a hard transaction lock) ----------
  for (const item of items) {
    if (!item.id) continue;
    const rows = await database.sql`SELECT name, stock_quantity FROM products WHERE id = ${item.id} LIMIT 1`;
    if (!rows.length) continue;
    if (rows[0].stock_quantity < item.qty) {
      return json({ error: `Sorry, "${rows[0].name}" only has ${rows[0].stock_quantity} left in stock.` }, { status: 409 });
    }
  }

  const orderId = generateOrderId();

  // ---------- discount: a promo code (if given) takes precedence over the referral discount ----------
  let referralDiscountAmount = 0;
  let promoDiscountAmount = 0;
  let appliedPromoCode = null;

  if (promoCode) {
    const promoRows = await database.sql`SELECT * FROM promo_codes WHERE code = ${promoCode.trim().toUpperCase()} LIMIT 1`;
    if (!promoRows.length) return json({ error: "That promo code doesn't exist." }, { status: 400 });
    const promo = promoRows[0];
    if (!promo.active) return json({ error: 'That promo code is no longer active.' }, { status: 400 });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return json({ error: 'That promo code has expired.' }, { status: 400 });
    }
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return json({ error: 'That promo code has reached its usage limit.' }, { status: 400 });
    }
    promoDiscountAmount = promo.discount_type === 'percent'
      ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
      : Math.min(Number(promo.discount_value), subtotal);
    appliedPromoCode = promo.code;
  } else {
    const rows = await database.sql`SELECT pending_discount_amount FROM customers WHERE id = ${customer.sub} LIMIT 1`;
    if (rows.length) referralDiscountAmount = Math.min(Number(rows[0].pending_discount_amount) || 0, subtotal);
  }

  const discountedSubtotal = Math.round((subtotal - referralDiscountAmount - promoDiscountAmount) * 100) / 100;
  const finalTotal = Math.round((discountedSubtotal + shipping) * 100) / 100;

  await database.sql`
    INSERT INTO orders
      (id, customer_id, first_name, last_name, email, whatsapp, address, notes, lat, lng, payment_method,
       subtotal, shipping, referral_discount_amount, promo_code, promo_discount_amount, total, status)
    VALUES
      (${orderId}, ${customer.sub}, ${firstName}, ${lastName}, ${email}, ${whatsapp}, ${address}, ${notes || null},
       ${location.lat}, ${location.lng}, ${payment.method},
       ${subtotal}, ${shipping}, ${referralDiscountAmount}, ${appliedPromoCode}, ${promoDiscountAmount}, ${finalTotal}, 'pending')
  `;

  for (const item of items) {
    await database.sql`
      INSERT INTO order_items (order_id, product_id, name, price, qty, size, color)
      VALUES (${orderId}, ${item.id || null}, ${item.name}, ${item.price}, ${item.qty}, ${item.size || null}, ${item.color || null})
    `;
    if (item.id) {
      await database.sql`UPDATE products SET stock_quantity = GREATEST(stock_quantity - ${item.qty}, 0) WHERE id = ${item.id}`;
    }
  }

  if (appliedPromoCode) {
    await database.sql`UPDATE promo_codes SET uses_count = uses_count + 1 WHERE code = ${appliedPromoCode}`;
  } else if (referralDiscountAmount > 0) {
    await database.sql`UPDATE customers SET pending_discount_amount = 0 WHERE id = ${customer.sub}`;
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

  return json({ id: orderId, referralDiscountAmount, promoDiscountAmount, subtotal: discountedSubtotal, total: finalTotal }, { status: 201 });
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
