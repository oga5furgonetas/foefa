/**
 * Suscripciones Histor Premium con Stripe.
 * - Precio por mercado (tabla price_plans, editable en el panel).
 * - Checkout alojado por Stripe: Histor NUNCA toca datos de tarjeta.
 * - Portal del cliente: cancelar, renovar, cambiar tarjeta, descargar facturas.
 * - Impuestos: Stripe Tax si STRIPE_AUTOMATIC_TAX=1.
 * - Pagos fallidos: reintentos inteligentes de Stripe + estado past_due con
 *   periodo de gracia de 7 días + aviso por correo al lector.
 * - Webhooks verificados por firma e idempotentes (tabla webhook_events).
 */
import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { EUROZONE } from '../config/countries';
import { fromStripeAmount, toStripeAmount } from '../config/pricing';
import type { Db } from '../db/client';
import { invoices, pricePlans, subscriptions, users, webhookEvents } from '../db/schema';
import { PREMIUM_STATUSES, type SubscriptionStatus } from '../domain';
import { emailLayout, escapeHtml, sendEmail } from '../email/send';
import { env } from '../env';
import { audit } from '../services/audit';

let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client === undefined) {
    const key = env().STRIPE_SECRET_KEY;
    client = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'Histor' } }) : null;
  }
  return client;
}

/** Solo para tests: inyecta un cliente (o null). */
export function setStripeClient(c: Stripe | null | undefined) {
  client = c;
}

export function paymentsEnabled(): boolean {
  return !!stripe();
}

export type Plan = typeof pricePlans.$inferSelect;

export async function resolvePlan(db: Db, countryCode: string | null): Promise<Plan | null> {
  const plans = await db.select().from(pricePlans).where(eq(pricePlans.active, true));
  const cc = countryCode?.toUpperCase();
  return (
    (cc ? plans.find((p) => p.countryCodes.includes(cc)) : undefined) ??
    (cc && EUROZONE.includes(cc) ? plans.find((p) => p.market === 'EUROZONE') : undefined) ??
    plans.find((p) => p.isDefault) ??
    null
  );
}

export function yearlySavingPercent(p: Pick<Plan, 'monthlyCents' | 'yearlyCents'>): number {
  return Math.max(0, Math.round((1 - p.yearlyCents / (p.monthlyCents * 12)) * 100));
}

export async function premiumStatus(db: Db, userId: string): Promise<{ premium: boolean; subscription: typeof subscriptions.$inferSelect | null }> {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt));
  const graceMs = 7 * 86400000;
  const active = rows.find(
    (s) =>
      (PREMIUM_STATUSES as readonly string[]).includes(s.status) &&
      (!s.currentPeriodEnd || s.currentPeriodEnd.getTime() + (s.status === 'past_due' ? graceMs : 0) > Date.now()),
  );
  return { premium: !!active, subscription: active ?? rows[0] ?? null };
}

export async function createCheckoutSession(
  db: Db,
  user: { id: string; email: string },
  opts: { interval: 'month' | 'year'; countryCode: string | null; lang: string; successUrl: string; cancelUrl: string },
): Promise<{ url: string } | { error: 'payments_disabled' | 'no_plan' | 'already_premium' }> {
  const s = stripe();
  if (!s) return { error: 'payments_disabled' };
  if ((await premiumStatus(db, user.id)).premium) return { error: 'already_premium' };
  const plan = await resolvePlan(db, opts.countryCode);
  if (!plan) return { error: 'no_plan' };
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  let customerId = u?.stripeCustomerId ?? null;
  if (!customerId) {
    const c = await s.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = c.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }
  const hadSubscription = (await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)).length > 0;
  const priceId = opts.interval === 'month' ? plan.stripePriceMonthly : plan.stripePriceYearly;
  const amount = opts.interval === 'month' ? plan.monthlyCents : plan.yearlyCents;
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: plan.currency.toLowerCase(),
              unit_amount: toStripeAmount(amount, plan.currency),
              recurring: { interval: opts.interval },
              product_data: { name: 'Histor Premium', metadata: { market: plan.market } },
              tax_behavior: 'inclusive',
            },
          },
    ],
    subscription_data: {
      metadata: { userId: user.id, planId: String(plan.id), market: plan.market },
      ...(plan.trialDays > 0 && !hadSubscription ? { trial_period_days: plan.trialDays } : {}),
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer_update: { address: 'auto' },
    automatic_tax: { enabled: env().STRIPE_AUTOMATIC_TAX },
    locale: (['es', 'en', 'de', 'fr', 'it', 'pt'].includes(opts.lang) ? opts.lang : 'auto') as Stripe.Checkout.SessionCreateParams.Locale,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  await audit(db, { actor: `user:${user.id}`, action: 'billing.checkout_started', targetType: 'user', targetId: user.id, detail: { market: plan.market, interval: opts.interval } });
  return { url: session.url! };
}

export async function createPortalSession(db: Db, userId: string, returnUrl: string): Promise<string | null> {
  const s = stripe();
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.stripeCustomerId) return null;
  const portal = await s.billingPortal.sessions.create({ customer: u.stripeCustomerId, return_url: returnUrl });
  return portal.url;
}

/** Procesa un webhook de Stripe. Lanza si la firma no es válida. */
export async function handleStripeWebhook(db: Db, rawBody: string, signature: string | null): Promise<{ handled: boolean; type: string; duplicate?: boolean }> {
  const s = stripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) throw new Error('Stripe no configurado');
  if (!signature) throw new Error('falta la firma');
  const event = s.webhooks.constructEvent(rawBody, signature, secret);
  const inserted = await db.insert(webhookEvents).values({ id: event.id, provider: 'stripe', type: event.type }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (!inserted.length) {
    const [prev] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id)).limit(1);
    if (prev?.processedAt) return { handled: false, type: event.type, duplicate: true };
  }
  try {
    const handled = await applyStripeEvent(db, event);
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, event.id));
    return { handled, type: event.type };
  } catch (e) {
    await db.update(webhookEvents).set({ error: String((e as Error).message).slice(0, 500) }).where(eq(webhookEvents.id, event.id));
    throw e;
  }
}

async function userIdForCustomer(db: Db, customerId: string | null, metadataUserId?: string | null): Promise<string | null> {
  if (metadataUserId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, metadataUserId)).limit(1);
    if (u) return u.id;
  }
  if (!customerId) return null;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return u?.id ?? null;
}

async function applyStripeEvent(db: Db, event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const cs = event.data.object as Stripe.Checkout.Session;
      const userId = cs.client_reference_id;
      const customer = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id;
      if (userId && customer) await db.update(users).set({ stripeCustomerId: customer }).where(eq(users.id, userId));
      return true;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed': {
      const sub = event.data.object as Stripe.Subscription;
      const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const userId = await userIdForCustomer(db, customer, sub.metadata?.userId);
      if (!userId) return false;
      const item = sub.items.data[0];
      const price = item?.price;
      const currency = (price?.currency ?? sub.currency ?? 'usd').toUpperCase();
      const values = {
        userId,
        provider: 'stripe',
        providerSubscriptionId: sub.id,
        providerCustomerId: customer,
        planId: sub.metadata?.planId ? Number(sub.metadata.planId) : null,
        status: (event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status) as SubscriptionStatus,
        interval: price?.recurring?.interval === 'year' ? 'year' : 'month',
        currency,
        amountCents: fromStripeAmount(price?.unit_amount ?? 0, currency),
        currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        updatedAt: new Date(),
      };
      await db.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: values });
      await audit(db, { actor: 'system', action: `billing.${event.type}`, targetType: 'user', targetId: userId, detail: { status: values.status, subscription: sub.id } });
      return true;
    }
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
    case 'invoice.finalized': {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === 'string' ? inv.customer : (inv.customer?.id ?? null);
      const userId = await userIdForCustomer(db, customer);
      const subRef = inv.parent?.subscription_details?.subscription;
      const subId = typeof subRef === 'string' ? subRef : (subRef?.id ?? null);
      const [sub] = subId ? await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.providerSubscriptionId, subId)).limit(1) : [];
      const currency = inv.currency.toUpperCase();
      const failed = event.type === 'invoice.payment_failed';
      const tax = (inv.total_taxes ?? []).reduce((a, t) => a + (t.amount ?? 0), 0);
      const values = {
        subscriptionId: sub?.id ?? null,
        userId,
        providerInvoiceId: inv.id!,
        amountCents: fromStripeAmount(failed ? inv.amount_due : inv.amount_paid || inv.total, currency),
        taxCents: fromStripeAmount(tax, currency),
        currency,
        status: failed ? 'failed' : inv.status === 'paid' || event.type !== 'invoice.finalized' ? 'paid' : (inv.status ?? 'open'),
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        attemptCount: inv.attempt_count ?? 0,
      };
      await db.insert(invoices).values(values).onConflictDoUpdate({ target: invoices.providerInvoiceId, set: values });
      if (failed && userId) await notifyPaymentFailed(db, userId, inv.hosted_invoice_url ?? null);
      return true;
    }
    case 'customer.deleted': {
      const c = event.data.object as Stripe.Customer;
      await db.update(users).set({ stripeCustomerId: null }).where(eq(users.stripeCustomerId, c.id));
      return true;
    }
    default:
      return false;
  }
}

async function notifyPaymentFailed(db: Db, userId: string, invoiceUrl: string | null) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  const lang = u.language ?? 'en';
  const T: Record<string, [string, string]> = {
    es: ['No hemos podido cobrar tu suscripción', 'El último pago de Histor Premium no se ha podido completar. Seguirás teniendo acceso durante 7 días mientras lo reintentamos. Puedes actualizar tu forma de pago aquí:'],
    en: ['We could not charge your subscription', 'The latest Histor Premium payment failed. You keep access for 7 days while we retry. You can update your payment method here:'],
    de: ['Wir konnten dein Abo nicht abbuchen', 'Die letzte Zahlung für Histor Premium ist fehlgeschlagen. Du behältst 7 Tage lang Zugriff, während wir es erneut versuchen. Zahlungsmethode aktualisieren:'],
    fr: ["Nous n'avons pas pu prélever votre abonnement", 'Le dernier paiement Histor Premium a échoué. Vous gardez l’accès pendant 7 jours pendant nos nouvelles tentatives. Mettez à jour votre moyen de paiement ici :'],
    it: ["Non siamo riusciti ad addebitare l'abbonamento", "L'ultimo pagamento di Histor Premium non è andato a buon fine. Mantieni l'accesso per 7 giorni mentre riproviamo. Aggiorna il metodo di pagamento qui:"],
    pt: ['Não conseguimos cobrar sua assinatura', 'O último pagamento do Histor Premium falhou. Você mantém o acesso por 7 dias enquanto tentamos de novo. Atualize sua forma de pagamento aqui:'],
  };
  const [subject, body] = T[lang] ?? T.en;
  const link = invoiceUrl ?? `${env().PUBLIC_BASE_URL}/${lang}`;
  await sendEmail(db, {
    to: u.email,
    subject,
    kind: 'payment_failed',
    html: emailLayout({ lang, title: subject, bodyHtml: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`, footer: 'Histor' }),
    text: `${body}\n${link}`,
  });
}

/** Cortesía / prensa / pruebas: Premium manual concedido por un administrador (auditado). */
export async function grantManualPremium(db: Db, userId: string, days: number, actor: string): Promise<void> {
  await db.insert(subscriptions).values({
    userId,
    provider: 'manual',
    providerSubscriptionId: `manual_${userId}_${Date.now()}`,
    status: 'active',
    interval: 'month',
    currency: 'EUR',
    amountCents: 0,
    currentPeriodEnd: new Date(Date.now() + days * 86400000),
  });
  await audit(db, { actor, action: 'billing.manual_grant', targetType: 'user', targetId: userId, detail: { days } });
}

/** Antes de borrar una cuenta: cancela en Stripe lo que siga activo. */
export async function cancelAllForUser(db: Db, userId: string): Promise<number> {
  const s = stripe();
  const active = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.provider, 'stripe'), inArray(subscriptions.status, ['trialing', 'active', 'past_due', 'unpaid', 'paused'])));
  if (s) for (const sub of active) if (sub.providerSubscriptionId) await s.subscriptions.cancel(sub.providerSubscriptionId);
  return active.length;
}

export async function revenueSummary(db: Db, since: Date) {
  const rows = await db
    .select({ currency: invoices.currency, total: sql<number>`sum(${invoices.amountCents})`, n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.status, 'paid'), gt(invoices.createdAt, since)))
    .groupBy(invoices.currency);
  const active = await db
    .select({ status: subscriptions.status, n: sql<number>`count(*)` })
    .from(subscriptions)
    .where(or(inArray(subscriptions.status, ['trialing', 'active', 'past_due'])))
    .groupBy(subscriptions.status);
  return { revenue: rows.map((r) => ({ currency: r.currency, totalCents: Number(r.total), invoices: Number(r.n) })), subscriptions: active.map((a) => ({ status: a.status, count: Number(a.n) })) };
}
