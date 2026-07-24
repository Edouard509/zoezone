import { getStore } from '@netlify/blobs';
import { db } from './utils/db.mjs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Please sign in to update your profile picture.' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'No file uploaded (expected multipart field "file").' }, { status: 400 });
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return json({ error: 'Only image uploads are allowed.' }, { status: 400 });
  }

  const store = getStore('avatars');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${customer.sub}-${Date.now()}.${ext}`;

  await store.set(key, file, { metadata: { contentType: file.type } });

  const url = `/api/images/${key}?store=avatars`;
  const database = db();
  await database.sql`UPDATE customers SET avatar_url = ${url} WHERE id = ${customer.sub}`;

  return json({ url }, { status: 201 });
};

export const config = { path: '/api/auth/customer/avatar' };
