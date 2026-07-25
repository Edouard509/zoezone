import { db, withTransaction, serializeOrder } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';
import { sendEmail, orderConfirmationHTML } from './utils/email.mjs';

function generateOrderId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `ZZ-${stamp}${rand}`;
}

class OrderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function createOrder(req) {
  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Please sign in to place an order.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

  const { firstName, lastName, email, whatsapp, address, notes, location, payment, items, promoCode } = body;

  const errors = [];
  if (!firstName) errors.push('first name');
  if (!lastName) errors.push('last name');
  if (!email || !email.includes('@')) errors.push('a valid email address');
  if (!whatsapp) errors.push('WhatsApp number');
  if (!address) errors.push('address');
  if (!location || location.lat == null || location.lng == null) errors.push('a pinned location on the map');
  if (!payment || !payment.method) errors.push('payment method');
  if (!Array.isArray(items) || !items.length) errors.push('items');
  if (Array.isArray(items) && items.some((it) => !Number.isInteger(it.qty) || it.qty < 1)) {
    errors.push('a valid quantity for every item');
  }
  if (errors.length) {
    return json({ error: 'Missing: ' + errors.join(', ') }, { status: 400 });
  }

  // PayPal charges a transaction fee — flat $5, decided server-side (never trust a client-submitted fee).
  const paymentFeeAmount = payment.method === 'paypal' ? 5 : 0;
  const orderId = generateOrderId();

  // Everything money-related is recomputed here from the real products table —
  // subtotal, shipping, item names/prices — rather than trusted from the client.
  // A client can submit whatever it wants in the request body (a $0.01 subtotal,
  // a fake item name), but only what's looked up here ever gets stored or charged.
  // This runs in one transaction alongside the stock decrement and promo/referral
  // consumption so a guarded UPDATE (only succeeds if enough stock remains) means
  // two simultaneous orders for the last unit can't both go through, and if any
  // item is short, the whole order rolls back together instead of partially
  // committing.
  let referralDiscountAmount = 0;
  let promoDiscountAmount = 0;
  let appliedPromoCode = null;
  let computedSubtotal = 0;
  let computedShipping = 0;
  let discountedSubtotal = 0;
  let finalTotal = 0;

  try {
    await withTransaction(async (tx) => {
      const resolvedItems = [];
      let rawSubtotal = 0;

      for (const item of items) {
        if (!item.id) throw new OrderError('Every item must reference a valid product.', 400);
        const decremented = await tx.sql`
          UPDATE products SET stock_quantity = stock_quantity - ${item.qty}
          WHERE id = ${item.id} AND stock_quantity >= ${item.qty}
          RETURNING name, price
        `;
        if (!decremented.length) {
          const current = await tx.sql`SELECT name, stock_quantity FROM products WHERE id = ${item.id} LIMIT 1`;
          if (!current.length) throw new OrderError('One of the items in your cart is no longer available.', 400);
          throw new OrderError(`Sorry, "${current[0].name}" only has ${current[0].stock_quantity} left in stock.`, 409);
        }
        const price = Number(decremented[0].price);
        rawSubtotal += price * item.qty;
        resolvedItems.push({
          productId: item.id,
          name: decremented[0].name,
          price,
          qty: item.qty,
          size: item.size ? String(item.size).slice(0, 40) : null,
          color: item.color ? String(item.color).slice(0, 40) : null,
        });
      }

      computedSubtotal = Math.round(rawSubtotal * 100) / 100;
      computedShipping = computedSubtotal >= 75 ? 0 : 6.95;

      if (promoCode) {
        const promoRows = await tx.sql`SELECT * FROM promo_codes WHERE code = ${promoCode.trim().toUpperCase()} LIMIT 1`;
        if (!promoRows.length) throw new OrderError("That promo code doesn't exist.", 400);
        const promo = promoRows[0];
        if (!promo.active) throw new OrderError('That promo code is no longer active.', 400);
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
          throw new OrderError('That promo code has expired.', 400);
        }
        promoDiscountAmount = promo.discount_type === 'percent'
          ? Math.round(computedSubtotal * (Number(promo.discount_value) / 100) * 100) / 100
          : Math.min(Number(promo.discount_value), computedSubtotal);
        appliedPromoCode = promo.code;

        const consumed = await tx.sql`
          UPDATE promo_codes SET uses_count = uses_count + 1
          WHERE code = ${promo.code} AND (max_uses IS NULL OR uses_count < max_uses)
          RETURNING code
        `;
        if (!consumed.length) throw new OrderError('That promo code has reached its usage limit.', 400);
      } else {
        const rows = await tx.sql`SELECT pending_discount_percent FROM customers WHERE id = ${customer.sub} LIMIT 1`;
        if (rows.length && rows[0].pending_discount_percent > 0) {
          referralDiscountAmount = Math.round(computedSubtotal * (Number(rows[0].pending_discount_percent) / 100) * 100) / 100;
        }
      }

      discountedSubtotal = Math.round((computedSubtotal - referralDiscountAmount - promoDiscountAmount) * 100) / 100;
      finalTotal = Math.round((discountedSubtotal + computedShipping + paymentFeeAmount) * 100) / 100;

      await tx.sql`
        INSERT INTO orders
          (id, customer_id, first_name, last_name, email, whatsapp, address, notes, lat, lng, payment_method,
           subtotal, shipping, referral_discount_amount, promo_code, promo_discount_amount, payment_fee_amount, total, status)
        VALUES
          (${orderId}, ${customer.sub}, ${firstName}, ${lastName}, ${email}, ${whatsapp}, ${address}, ${notes || null},
           ${location.lat}, ${location.lng}, ${payment.method},
           ${computedSubtotal}, ${computedShipping}, ${referralDiscountAmount}, ${appliedPromoCode}, ${promoDiscountAmount}, ${paymentFeeAmount}, ${finalTotal}, 'pending')
      `;

      for (const ri of resolvedItems) {
        await tx.sql`
          INSERT INTO order_items (order_id, product_id, name, price, qty, size, color)
          VALUES (${orderId}, ${ri.productId}, ${ri.name}, ${ri.price}, ${ri.qty}, ${ri.size}, ${ri.color})
        `;
      }

      if (referralDiscountAmount > 0) {
        await tx.sql`UPDATE customers SET pending_discount_percent = 0 WHERE id = ${customer.sub}`;
      }
    });
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, { status: err.status });
    throw err;
  }

  const orderForEmail = {
    id: orderId,
    customer: { firstName, lastName, email, whatsapp, address, notes },
    items,
    subtotal: discountedSubtotal,
    shipping: computedShipping,
    paymentFeeAmount,
    total: finalTotal,
  };
  await sendEmail({
    to: email,
    subject: `Order Confirmed — ${orderId}`,
    html: orderConfirmationHTML({ order: orderForEmail }),
    fromEmail: 'orders@zoezone.co',
  });

  return json(
    { id: orderId, referralDiscountAmount, promoDiscountAmount, paymentFeeAmount, subtotal: discountedSubtotal, total: finalTotal },
    { status: 201 }
  );
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
