import { db } from './utils/db.mjs';
import { json, requireAdmin } from './utils/auth.mjs';

function serializeAdminReview(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    name: row.name,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    mediaUrl: row.media_url || null,
    mediaType: row.media_type || null,
    adminReply: row.admin_reply || null,
    adminReplyAt: row.admin_reply_at || null,
  };
}

async function listReviews() {
  const database = db();
  const rows = await database.sql`
    SELECT r.*, p.name AS product_name
    FROM reviews r
    LEFT JOIN products p ON p.id = r.product_id
    ORDER BY r.created_at DESC
  `;
  return json(rows.map(serializeAdminReview));
}

async function replyToReview(id, req) {
  const body = await req.json().catch(() => null);
  const reply = body?.reply?.trim();
  if (!reply) return json({ error: 'A reply message is required.' }, { status: 400 });

  const database = db();
  const existing = await database.sql`SELECT id FROM reviews WHERE id = ${id} LIMIT 1`;
  if (!existing.length) return json({ error: 'Review not found' }, { status: 404 });

  const rows = await database.sql`
    UPDATE reviews SET admin_reply = ${reply.slice(0, 2000)}, admin_reply_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return json(serializeAdminReview(rows[0]));
}

async function deleteReview(id) {
  const database = db();
  await database.sql`DELETE FROM reviews WHERE id = ${id}`;
  return json({ ok: true });
}

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = context.params;

  if (!id) {
    if (req.method === 'GET') return listReviews();
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (req.method === 'PUT') return replyToReview(Number(id), req);
  if (req.method === 'DELETE') return deleteReview(Number(id));
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: ['/api/admin/reviews', '/api/admin/reviews/:id'] };
