import pg from 'pg';

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set.');
    pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

// Mimics the @netlify/database tagged-template API (db.sql`...` -> Promise<rows[]>)
// so every function file that calls `database.sql\`...\`` keeps working unchanged.
function sqlTag(strings, ...values) {
  let text = '';
  const params = [];
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) {
      params.push(values[i]);
      text += '$' + params.length;
    }
  });
  return getPool()
    .query(text, params)
    .then((res) => res.rows);
}

export function db() {
  return { sql: sqlTag };
}

export const COLOR_HEX = { black: '#1a1a1a', gray: '#8d8f92', cream: '#ece7de', denim: '#a9bccf', gold: '#c9a860' };
export function swatchColorsFor(colors) {
  return (colors || []).map((c) => COLOR_HEX[c] || '#cccccc');
}

// DB row (snake_case) -> the shape the front-end already expects (matches the old static js/products.js)
export function serializeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    collection: row.collection,
    categories: row.categories || [],
    tags: row.tags || [],
    price: Number(row.price),
    was: row.was_price !== null && row.was_price !== undefined ? Number(row.was_price) : null,
    colors: row.colors || [],
    sizes: row.sizes || [],
    swatchColors: row.swatch_colors || [],
    badge: row.badge || null,
    isNew: row.is_new,
    isSale: row.was_price !== null && row.was_price !== undefined,
    mediaStyle: row.media_style || null,
    art: row.art,
    description: row.description,
    details: row.details || [],
    active: row.active,
  };
}

export function serializeReview(row) {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function serializeOrder(row, items) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customer: {
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      whatsapp: row.whatsapp,
      address: row.address,
      notes: row.notes,
    },
    location: row.lat !== null && row.lng !== null ? { lat: Number(row.lat), lng: Number(row.lng) } : null,
    payment: { method: row.payment_method },
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    discountPercent: row.discount_percent || 0,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    items: (items || []).map((it) => ({
      id: it.product_id,
      name: it.name,
      price: Number(it.price),
      qty: it.qty,
      size: it.size,
      color: it.color,
    })),
  };
}
