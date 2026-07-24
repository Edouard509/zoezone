import { getStore } from '@netlify/blobs';
import { json, getCustomerFromRequest } from './utils/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  const customer = getCustomerFromRequest(req);
  if (!customer) return json({ error: 'Please sign in to upload media.' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'No file uploaded (expected multipart field "file").' }, { status: 400 });
  }
  if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
    return json({ error: 'Only image or video uploads are allowed.' }, { status: 400 });
  }

  const store = getStore('review-media');
  const ext = (file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await store.set(key, file, { metadata: { contentType: file.type } });

  return json(
    { url: `/api/images/${key}?store=review-media`, mediaType: file.type.startsWith('video/') ? 'video' : 'image' },
    { status: 201 }
  );
};

export const config = { path: '/api/reviews/upload' };
