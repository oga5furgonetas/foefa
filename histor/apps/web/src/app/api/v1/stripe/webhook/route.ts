import type { NextRequest } from 'next/server';
import { handleStripeWebhook } from '@histor/core/billing/index';
import { logger, reportError } from '@histor/core/observability/index';
import { json } from '@/lib/api';
import { db } from '@/lib/server';

/**
 * Webhook de Stripe. Firma verificada con STRIPE_WEBHOOK_SECRET sobre el
 * cuerpo crudo; idempotente (cada evento se procesa una sola vez).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  try {
    const r = await handleStripeWebhook(db(), raw, req.headers.get('stripe-signature'));
    return json({ received: true, ...r });
  } catch (e) {
    const msg = (e as Error).message;
    if (/no configurado/.test(msg)) return json({ error: 'payments_disabled' }, { status: 503 });
    if (/firma|signature/i.test(msg)) {
      logger.warn({ err: msg }, 'webhook de Stripe rechazado');
      return json({ error: 'invalid_signature' }, { status: 400 });
    }
    await reportError(e, { path: '/api/v1/stripe/webhook' });
    // 500 → Stripe reintenta más tarde (el evento no se marcó como procesado).
    return json({ error: 'internal' }, { status: 500 });
  }
}
