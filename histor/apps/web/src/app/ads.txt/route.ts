import { env } from '@histor/core/env';

/** ads.txt de Google AdSense (lo exige para servir anuncios): solo si hay ADSENSE_CLIENT. */
export const dynamic = 'force-dynamic';

export function GET() {
  const client = env().ADSENSE_CLIENT;
  if (!client) return new Response('Not found', { status: 404 });
  const pub = client.replace(/^ca-/, '');
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
