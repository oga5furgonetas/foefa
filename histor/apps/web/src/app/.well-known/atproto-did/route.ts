import { env } from '@histor/core/env';

/**
 * Verificación del nombre de Bluesky con el dominio (@histor.es en vez de @histor.bsky.social):
 * Bluesky lee aquí el DID de la cuenta. Solo si hay BLUESKY_DID.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const did = env().BLUESKY_DID;
  if (!did) return new Response('Not found', { status: 404 });
  return new Response(did, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
