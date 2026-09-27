import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isActiveLanguage } from '@histor/core/config/languages';
import { pushSubscriptions } from '@histor/core/db/schema';
import { env } from '@histor/core/env';
import { ApiError, assertCsrf, handler, json, parseBody, sessionUser } from '@/lib/api';
import { db } from '@/lib/server';

const schema = z.object({
  subscription: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  lang: z.string().max(5),
  categories: z.array(z.string().max(40)).max(20).optional(),
});

export const GET = handler(async () => json({ publicKey: env().VAPID_PUBLIC_KEY ?? null }));

export const POST = handler(async (req) => {
  assertCsrf(req);
  if (!env().VAPID_PUBLIC_KEY) throw new ApiError(503, 'push_disabled');
  const b = await parseBody(req, schema);
  if (!/^https:\/\//.test(b.subscription.endpoint)) throw new ApiError(400, 'invalid_endpoint');
  const u = await sessionUser(req);
  const values = {
    userId: u?.id ?? null,
    endpoint: b.subscription.endpoint,
    p256dh: b.subscription.keys.p256dh,
    auth: b.subscription.keys.auth,
    language: isActiveLanguage(b.lang) ? b.lang : 'en',
    countryCode: req.cookies.get('histor_edition')?.value ?? u?.countryCode ?? null,
    categories: b.categories ?? [],
  };
  await db().insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  return json({ ok: true }, { status: 201 });
});

export const DELETE = handler(async (req) => {
  assertCsrf(req);
  const b = await parseBody(req, z.object({ endpoint: z.string().url().max(1000) }));
  await db().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, b.endpoint));
  return json({ ok: true });
});
