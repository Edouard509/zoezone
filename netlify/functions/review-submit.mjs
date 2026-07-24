import { db, serializeReview } from './utils/db.mjs';
import { json } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const productId = body?.productId;
  const name = body?.name?.trim();
  const rating = Number(body?.rating);
  const title = body?.title?.trim() || null;
  const reviewBody = body?.body?.trim();

  if (!productId || !name || !reviewBody || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'Please provide your name, a rating (1-5), and a review.' }, { status: 400 });
  }

  const database = db();
  const product = await database.sql`SELECT id FROM products WHERE id = ${productId} LIMIT 1`;
  if (!product.length) return json({ error: 'Product not found' }, { status: 404 });

  const rows = await database.sql`
    INSERT INTO reviews (product_id, name, rating, title, body)
    VALUES (${productId}, ${name.slice(0, 80)}, ${rating}, ${title ? title.slice(0, 120) : null}, ${reviewBody.slice(0, 2000)})
    RETURNING *
  `;

  return json(serializeReview(rows[0]), { status: 201 });
};

export const config = { path: '/api/reviews' };
