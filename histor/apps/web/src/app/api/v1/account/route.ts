import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { deleteUser, SESSION_COOKIE } from '@histor/core/auth/users';
import { cancelAllForUser } from '@histor/core/billing/index';
import { country } from '@histor/core/config/countries';
import { isActiveLanguage } from '@histor/core/config/languages';
import { users } from '@histor/core/db/schema';
import { audit } from '@histor/core/services/audit';
import { ApiError, assertCsrf, handler, json, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

const prefs = z.object({
  language: z.string().max(5).optional(),
  countryCode: z.string().length(2).nullable().optional(),
  name: z.string().max(100).nullable().optional(),
  personalization: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  alertsMaxPerDay: z.number().int().min(0).max(20).optional(),
  quietHoursStart: z.number().int().min(0).max(23).optional(),
  quietHoursEnd: z.number().int().min(0).max(23).optional(),
});

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const [row] = await db().select().from(users).where(eq(users.id, u.id)).limit(1);
  const { passwordHash: _p, totpSecret: _t, stripeCustomerId: _s, failedLogins: _f, lockedUntil: _l, ...safe } = row;
  return json({ account: safe });
});

export const PATCH = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const b = await parseBody(req, prefs);
  if (b.language && !isActiveLanguage(b.language)) throw new ApiError(400, 'invalid_lang');
  if (b.countryCode && !country(b.countryCode)) throw new ApiError(400, 'invalid_country');
  await db()
    .update(users)
    .set({ ...b, countryCode: b.countryCode === undefined ? undefined : b.countryCode?.toUpperCase() ?? null })
    .where(eq(users.id, u.id));
  await audit(db(), { actor: `user:${u.id}`, action: 'user.prefs', targetType: 'user', targetId: u.id, detail: { fields: Object.keys(b) } });
  return json({ ok: true });
});

/** Derecho de supresión: cancela suscripciones en el proveedor y borra la cuenta. */
export const DELETE = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  await parseBody(req, z.object({ confirm: z.literal(true) }));
  await cancelAllForUser(db(), u.id);
  await deleteUser(db(), u.id, `user:${u.id}`);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
