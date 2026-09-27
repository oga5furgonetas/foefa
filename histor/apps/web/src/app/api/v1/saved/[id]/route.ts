import { and, eq } from 'drizzle-orm';
import { articles, savedArticles } from '@histor/core/db/schema';
import { ApiError, assertCsrf, handler, json, requireUser, sessionUser } from '@/lib/api';
import { db } from '@/lib/server';

type Ctx = { params: Promise<{ id: string }> };

async function articleId(ctx: Ctx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'invalid_id');
  return id;
}

export const GET = handler<Ctx>(async (req, ctx) => {
  const u = await sessionUser(req);
  if (!u) return json({ saved: false });
  const id = await articleId(ctx);
  const rows = await db().select().from(savedArticles).where(and(eq(savedArticles.userId, u.id), eq(savedArticles.articleId, id))).limit(1);
  return json({ saved: rows.length > 0 });
});

export const POST = handler<Ctx>(async (req, ctx) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const id = await articleId(ctx);
  const [a] = await db().select({ id: articles.id }).from(articles).where(eq(articles.id, id)).limit(1);
  if (!a) throw new ApiError(404, 'not_found');
  await db().insert(savedArticles).values({ userId: u.id, articleId: id }).onConflictDoNothing();
  return json({ saved: true });
});

export const DELETE = handler<Ctx>(async (req, ctx) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const id = await articleId(ctx);
  await db().delete(savedArticles).where(and(eq(savedArticles.userId, u.id), eq(savedArticles.articleId, id)));
  return json({ saved: false });
});
