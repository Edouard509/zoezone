import { getStore } from '@netlify/blobs';
import { json, requireAdmin } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'No file uploaded (expected multipart field "file").' }, { status: 400 });
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return json({ error: 'Only image uploads are allowed.' }, { status: 400 });
  }

  const store = getStore('product-images');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await store.set(key, file, { metadata: { contentType: file.type } });

  return json({ url: `/api/images/${key}` }, { status: 201 });
};

export const config = { path: '/api/admin/upload' };
