import { db, serializeProduct, serializeReview } from './utils/db.mjs';
import { json } from './utils/auth.mjs';

export default async (req, context) => {
  const { id } = context.params;
  const database = db();

  const rows = await database.sql`SELECT * FROM products WHERE id = ${id} AND active = true LIMIT 1`;
  if (!rows.length) return json({ error: 'Product not found' }, { status: 404 });

  const product = serializeProduct(rows[0]);

  const reviewRows = await database.sql`
    SELECT * FROM reviews WHERE product_id = ${id} ORDER BY created_at DESC
  `;
  const reviews = reviewRows.map(serializeReview);
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 2) / 2
    : 0;

  return json({ ...product, reviews, reviewCount, rating });
};

export const config = { path: '/api/products/:id' };
