/**
 * Pagos: precio por país y webhooks de Stripe (firma, idempotencia,
 * altas, cancelaciones, facturas y pagos fallidos). Sin red: los eventos
 * se firman localmente con el secreto de prueba, como hace Stripe.
 */
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleStripeWebhook, premiumStatus, resolvePlan, setStripeClient, yearlySavingPercent } from '../../src/billing';
import type { Db } from '../../src/db/client';
import { invoices, outbox, subscriptions, users } from '../../src/db/schema';
import { resetEnvCache } from '../../src/env';
import { done, freshDb } from './db';

let db: Db;
let userId: string;
const SECRET = 'whsec_test_histor';
let stripe: Stripe;

beforeAll(async () => {
  db = await freshDb();
  process.env.STRIPE_SECRET_KEY = 'sk_test_histor_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  resetEnvCache();
  stripe = new Stripe('sk_test_histor_dummy');
  setStripeClient(stripe);
  const [u] = await db.insert(users).values({ email: 'lectora@example.org', language: 'es', stripeCustomerId: 'cus_test_1' }).returning({ id: users.id });
  userId = u.id;
}, 60_000);

afterAll(async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  resetEnvCache();
  setStripeClient(undefined);
  await done();
});

function signed(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  return { payload, sig: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) };
}

const now = Math.floor(Date.now() / 1000);
const subEvent = (id: string, type: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  object: 'event',
  type,
  data: {
    object: {
      id: 'sub_test_1',
      object: 'subscription',
      customer: 'cus_test_1',
      status,
      currency: 'eur',
      metadata: { userId, planId: '' },
      cancel_at_period_end: false,
      canceled_at: null,
      trial_end: null,
      items: { data: [{ id: 'si_1', current_period_end: now + 30 * 86400, price: { currency: 'eur', unit_amount: 599, recurring: { interval: 'month' } } }] },
      ...extra,
    },
  },
});

describe('precio regional', () => {
  it('elige el plan del país, la zona euro o el mundial', async () => {
    expect((await resolvePlan(db, 'ES'))?.market).toBe('ES');
    expect((await resolvePlan(db, 'DE'))?.market).toBe('EUROZONE');
    expect((await resolvePlan(db, 'US'))?.currency).toBe('USD');
    expect((await resolvePlan(db, 'JP'))?.currency).toBe('JPY');
    expect((await resolvePlan(db, 'KE'))?.market).toBe('WORLD');
    expect(yearlySavingPercent({ monthlyCents: 599, yearlyCents: 5400 })).toBe(25);
  });
});

describe('webhooks de Stripe', () => {
  it('rechaza firmas falsas', async () => {
    const { payload } = signed(subEvent('evt_bad', 'customer.subscription.created', 'active'));
    await expect(handleStripeWebhook(db, payload, 't=1,v1=deadbeef')).rejects.toThrow();
  });

  it('alta de suscripción → Premium activo', async () => {
    const { payload, sig } = signed(subEvent('evt_1', 'customer.subscription.created', 'active'));
    const r = await handleStripeWebhook(db, payload, sig);
    expect(r.handled).toBe(true);
    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.providerSubscriptionId, 'sub_test_1'));
    expect(s.status).toBe('active');
    expect(s.amountCents).toBe(599);
    expect((await premiumStatus(db, userId)).premium).toBe(true);
  });

  it('es idempotente: el mismo evento dos veces no se aplica dos veces', async () => {
    const { payload, sig } = signed(subEvent('evt_1', 'customer.subscription.created', 'active'));
    const r = await handleStripeWebhook(db, payload, sig);
    expect(r.duplicate).toBe(true);
  });

  it('pago fallido → factura fallida, aviso al lector y periodo de gracia', async () => {
    const inv = {
      id: 'evt_2',
      object: 'event',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_1', object: 'invoice', customer: 'cus_test_1', currency: 'eur', amount_due: 599, amount_paid: 0, total: 599, status: 'open', attempt_count: 1, hosted_invoice_url: 'https://invoice.stripe.com/i/test', total_taxes: [{ amount: 104 }], parent: { subscription_details: { subscription: 'sub_test_1' } } } },
    };
    const { payload, sig } = signed(inv);
    await handleStripeWebhook(db, payload, sig);
    const [i] = await db.select().from(invoices).where(eq(invoices.providerInvoiceId, 'in_1'));
    expect(i.status).toBe('failed');
    expect(i.taxCents).toBe(104);
    const mail = await db.select().from(outbox).where(eq(outbox.kind, 'payment_failed'));
    expect(mail).toHaveLength(1);
    const pd = signed(subEvent('evt_3', 'customer.subscription.updated', 'past_due'));
    await handleStripeWebhook(db, pd.payload, pd.sig);
    expect((await premiumStatus(db, userId)).premium).toBe(true); // gracia de 7 días
  });

  it('cancelación → sin Premium', async () => {
    const { payload, sig } = signed(subEvent('evt_4', 'customer.subscription.deleted', 'canceled', { canceled_at: now }));
    await handleStripeWebhook(db, payload, sig);
    expect((await premiumStatus(db, userId)).premium).toBe(false);
  });
});
