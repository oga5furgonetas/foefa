import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { userFollows } from '@histor/core/db/schema';
import { assertCsrf, handler, json, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

const schema = z.object({ kind: z.enum(['topic', 'entity', 'category', 'country', 'region', 'city', 'author', 'source']), ref: z.string().min(1).max(120) });

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  return json({ follows: await db().select({ kind: userFollows.kind, ref: userFollows.ref }).from(userFollows).where(eq(userFollows.userId, u.id)) });
});

export const POST = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const b = await parseBody(req, schema);
  await db().insert(userFollows).values({ userId: u.id, kind: b.kind, ref: b.ref }).onConflictDoNothing();
  return json({ following: true });
});

export const DELETE = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const b = await parseBody(req, schema);
  await db().delete(userFollows).where(and(eq(userFollows.userId, u.id), eq(userFollows.kind, b.kind), eq(userFollows.ref, b.ref)));
  return json({ following: false });
});
