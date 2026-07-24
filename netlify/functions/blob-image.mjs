import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const { key } = context.params;
  const store = getStore('product-images');

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
