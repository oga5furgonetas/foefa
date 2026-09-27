import type { NextRequest } from 'next/server';
import { env } from '@histor/core/env';
import { prometheusMetrics } from '@histor/core/observability/index';
import { safeEqual } from '@histor/core/security/crypto';
import { db } from '@/lib/server';

/** Métricas Prometheus. Protegidas con METRICS_TOKEN (Bearer); sin token configurado, desactivadas. */
export async function GET(req: NextRequest) {
  const token = env().METRICS_TOKEN;
  const auth = req.headers.get('authorization') ?? '';
  if (!token || !safeEqual(auth, `Bearer ${token}`)) return new Response('forbidden', { status: 403 });
  return new Response(await prometheusMetrics(db()), { headers: { 'content-type': 'text/plain; version=0.0.4', 'cache-control': 'no-store' } });
}
