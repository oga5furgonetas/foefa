import { env } from '@histor/core/env';

/** Clave de IndexNow: los buscadores la leen para comprobar que los avisos son nuestros. */
export const dynamic = 'force-dynamic';

export function GET() {
  const key = env().INDEXNOW_KEY;
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
