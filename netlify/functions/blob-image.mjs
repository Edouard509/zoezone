import { getStore } from '@netlify/blobs';

const ALLOWED_STORES = ['product-images', 'avatars', 'review-media'];

export default async (req, context) => {
  const { key } = context.params;
  const url = new URL(req.url);
  const storeName = url.searchParams.get('store') || 'product-images';
  if (!ALLOWED_STORES.includes(storeName)) return new Response('Not found', { status: 404 });

  const store = getStore(storeName);

  const blob = await store.get(key, { type: 'blob' });
  if (blob === null) return new Response('Not found', { status: 404 });

  const { metadata } = await store.getWithMetadata(key);

  return new Response(blob, {
    headers: {
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config = { path: '/api/images/:key' };
