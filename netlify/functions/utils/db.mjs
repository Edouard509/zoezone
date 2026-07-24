import { getDatabase } from '@netlify/database';

export function db() {
  return getDatabase();
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
      whatsapp: row.whatsapp,
      address: row.address,
      notes: row.notes,
    },
    location: row.lat !== null && row.lng !== null ? { lat: Number(row.lat), lng: Number(row.lng) } : null,
    payment: { method: row.payment_method },
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
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
