import { db, serializeProduct } from './utils/db.mjs';
import { json } from './utils/auth.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  const sale = url.searchParams.get('sale');
  const isNew = url.searchParams.get('new');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '0', 10) || null;

  const database = db();
  const rows = await database.sql`
    SELECT * FROM products WHERE active = true ORDER BY sort_order ASC, created_at DESC
  `;

  let products = rows.map(serializeProduct);

  if (category) products = products.filter((p) => p.categories.includes(category));
  if (tag) products = products.filter((p) => p.tags.includes(tag));
  if (sale === 'true') products = products.filter((p) => p.isSale);
  if (isNew === 'true') products = products.filter((p) => p.isNew);
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.collection.toLowerCase().includes(q)
    );
  }
  if (limit) products = products.slice(0, limit);

  return json(products);
};

export const config = { path: '/api/products' };
