import { db, serializeReview } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Please sign in to leave a review.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const productId = body?.productId;
  const rating = Number(body?.rating);
  const title = body?.title?.trim() || null;
  const reviewBody = body?.body?.trim();
  const mediaUrl = body?.mediaUrl || null;
  const mediaType = body?.mediaType || null;

  if (!productId || !reviewBody || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'Please provide a rating (1-5) and a review.' }, { status: 400 });
  }
  if (mediaType && !['image', 'video'].includes(mediaType)) {
    return json({ error: 'Invalid media type.' }, { status: 400 });
  }
  if (mediaUrl && !/^\/api\/images\/[A-Za-z0-9._-]+\?store=review-media$/.test(mediaUrl)) {
    return json({ error: 'Invalid media URL — please upload via the review form.' }, { status: 400 });
  }

  const database = db();

  const product = await database.sql`SELECT id FROM products WHERE id = ${productId} LIMIT 1`;
  if (!product.length) return json({ error: 'Product not found' }, { status: 404 });

  const purchase = await database.sql`
    SELECT o.id FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = ${customer.sub} AND oi.product_id = ${productId} AND o.status != 'cancelled'
    LIMIT 1
  `;
  if (!purchase.length) {
    return json({ error: "You can only review products you've purchased." }, { status: 403 });
  }

  const existingReview = await database.sql`
    SELECT id FROM reviews WHERE product_id = ${productId} AND customer_id = ${customer.sub} LIMIT 1
  `;
  if (existingReview.length) {
    return json({ error: "You've already reviewed this product." }, { status: 409 });
  }

  const customerRows = await database.sql`SELECT first_name, last_name FROM customers WHERE id = ${customer.sub} LIMIT 1`;
  const name = customerRows.length
    ? ((customerRows[0].first_name || '') + ' ' + (customerRows[0].last_name || '')).trim() || 'ZOEZONE Customer'
    : 'ZOEZONE Customer';

  const rows = await database.sql`
    INSERT INTO reviews (product_id, name, rating, title, body, customer_id, media_url, media_type)
    VALUES (${productId}, ${name.slice(0, 80)}, ${rating}, ${title ? title.slice(0, 120) : null}, ${reviewBody.slice(0, 2000)}, ${customer.sub}, ${mediaUrl}, ${mediaType})
    RETURNING *
  `;

  return json(serializeReview(rows[0]), { status: 201 });
};

export const config = { path: '/api/reviews' };
