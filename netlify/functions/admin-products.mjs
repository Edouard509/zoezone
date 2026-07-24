import { db, serializeProduct, swatchColorsFor } from './utils/db.mjs';
import { json, requireAdmin } from './utils/auth.mjs';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildArt(body) {
  if (body.art) return body.art; // advanced: raw HTML snippet (rarely used from the UI)
  if (body.imageUrl) {
    const alt = (body.name || 'Product photo').replace(/"/g, '&quot;');
    return `<img src="${body.imageUrl}" alt="${alt}" style="width:100%;height:100%;object-fit:contain;">`;
  }
  return '<div class="acc-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 15l4-4 4 4 4-6 4 8"/></svg></div>';
}

async function listAll() {
  const database = db();
  const rows = await database.sql`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`;
  return json(rows.map(serializeProduct));
}

async function createProduct(req) {
  const body = await req.json().catch(() => null);
  if (!body || !body.name || body.price === undefined) {
    return json({ error: 'Name and price are required.' }, { status: 400 });
  }

  const id = body.id ? slugify(body.id) : slugify(body.name);
  const colors = body.colors || [];
  const database = db();

  const existing = await database.sql`SELECT id FROM products WHERE id = ${id} LIMIT 1`;
  if (existing.length) return json({ error: `A product with id "${id}" already exists.` }, { status: 409 });

  await database.sql`
    INSERT INTO products
      (id, name, collection, categories, tags, price, was_price, colors, sizes, swatch_colors,
       badge, is_new, media_style, art, description, details, active, sort_order)
    VALUES
      (${id}, ${body.name}, ${body.collection || 'Signature'}, ${body.categories || []}, ${body.tags || []},
       ${body.price}, ${body.was || null}, ${colors}, ${body.sizes || []}, ${swatchColorsFor(colors)},
       ${body.badge || null}, ${!!body.isNew}, ${body.mediaStyle || null}, ${buildArt(body)},
       ${body.description || ''}, ${body.details || []}, ${body.active !== false}, ${body.sortOrder || 0})
  `;

  const rows = await database.sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
  return json(serializeProduct(rows[0]), { status: 201 });
}

async function getOne(id) {
  const database = db();
  const rows = await database.sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return json({ error: 'Product not found' }, { status: 404 });
  return json(serializeProduct(rows[0]));
}

async function updateProduct(id, req) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

  const database = db();
  const existing = await database.sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
  if (!existing.length) return json({ error: 'Product not found' }, { status: 404 });
  const current = existing[0];

  const colors = body.colors !== undefined ? body.colors : current.colors;
  const art = body.imageUrl || body.art ? buildArt(body) : current.art;

  await database.sql`
    UPDATE products SET
      name = ${body.name ?? current.name},
      collection = ${body.collection ?? current.collection},
      categories = ${body.categories ?? current.categories},
      tags = ${body.tags ?? current.tags},
      price = ${body.price ?? current.price},
      was_price = ${body.was !== undefined ? body.was : current.was_price},
      colors = ${colors},
      sizes = ${body.sizes ?? current.sizes},
      swatch_colors = ${swatchColorsFor(colors)},
      badge = ${body.badge !== undefined ? body.badge : current.badge},
      is_new = ${body.isNew !== undefined ? !!body.isNew : current.is_new},
      media_style = ${body.mediaStyle !== undefined ? body.mediaStyle : current.media_style},
      art = ${art},
      description = ${body.description ?? current.description},
      details = ${body.details ?? current.details},
      active = ${body.active !== undefined ? !!body.active : current.active},
      sort_order = ${body.sortOrder ?? current.sort_order},
      updated_at = now()
    WHERE id = ${id}
  `;

  const rows = await database.sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
  return json(serializeProduct(rows[0]));
}

async function deleteProduct(id) {
  const database = db();
  await database.sql`DELETE FROM products WHERE id = ${id}`;
  return json({ ok: true });
}

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = context.params;

  if (!id) {
    if (req.method === 'GET') return listAll();
    if (req.method === 'POST') return createProduct(req);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (req.method === 'GET') return getOne(id);
  if (req.method === 'PUT') return updateProduct(id, req);
  if (req.method === 'DELETE') return deleteProduct(id);
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/admin/products', '/api/admin/products/:id'] };
