/**
 * Redes sociales por API oficial (Bluesky, Mastodon, X). Regla: solo se
 * publica lo que ya pasó TODOS los controles y está VERIFICADO (nunca
 * "en desarrollo", nunca DEMO). Sin credenciales, se registra "skipped".
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, socialPosts } from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';
import { absoluteUrl } from '../seo';
import { getEditorialSettings } from '../services/settings';
import { truncate } from '../text/normalize';

type Network = 'bluesky' | 'mastodon' | 'x';
const LIMITS: Record<Network, number> = { bluesky: 300, mastodon: 500, x: 280 };

export function socialText(headline: string, url: string, network: Network): string {
  const room = LIMITS[network] - url.length - 2;
  return `${truncate(headline, room)}\n${url}`;
}

function configured(n: Network): boolean {
  const e = env();
  if (n === 'bluesky') return !!(e.BLUESKY_HANDLE && e.BLUESKY_APP_PASSWORD);
  if (n === 'mastodon') return !!(e.MASTODON_BASE_URL && e.MASTODON_TOKEN);
  return !!process.env.X_USER_ACCESS_TOKEN;
}

export async function queueSocialPosts(db: Db, storyId: number): Promise<number> {
  const s = await getEditorialSettings(db);
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  let n = 0;
  for (const a of arts) {
    const eligible = s.autoSocial && !a.isDeveloping && !a.isDemo && a.evidenceConfidence >= s.verifiedMin;
    const url = absoluteUrl(href.article(a.language, a.publishedAt!, a.slug));
    for (const network of ['bluesky', 'mastodon', 'x'] as Network[]) {
      const status = !eligible ? 'skipped' : configured(network) ? 'queued' : 'skipped';
      const rows = await db
        .insert(socialPosts)
        .values({ articleId: a.id, network, status, text: socialText(a.headline, url, network), url, error: !eligible ? 'no elegible (no verificada, en desarrollo, DEMO o desactivado)' : status === 'skipped' ? 'red no configurada' : null })
        .onConflictDoNothing()
        .returning({ id: socialPosts.id });
      n += rows.length;
    }
  }
  return n;
}

export async function publishQueuedPosts(db: Db, fetchImpl: typeof fetch = fetch): Promise<{ posted: number; failed: number }> {
  const queued = await db.select().from(socialPosts).where(eq(socialPosts.status, 'queued')).limit(20);
  let posted = 0;
  let failed = 0;
  for (const p of queued) {
    try {
      const id = await post(p.network as Network, p.text, p.url, fetchImpl);
      await db.update(socialPosts).set({ status: 'posted', externalId: id, postedAt: new Date(), error: null }).where(eq(socialPosts.id, p.id));
      posted++;
    } catch (e) {
      await db.update(socialPosts).set({ status: 'failed', error: String((e as Error).message).slice(0, 300) }).where(eq(socialPosts.id, p.id));
      failed++;
    }
  }
  return { posted, failed };
}

async function post(n: Network, text: string, url: string, f: typeof fetch): Promise<string> {
  const e = env();
  if (n === 'mastodon') {
    const r = await f(`${e.MASTODON_BASE_URL!.replace(/\/$/, '')}/api/v1/statuses`, { method: 'POST', headers: { authorization: `Bearer ${e.MASTODON_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: text, visibility: 'public' }) });
    if (!r.ok) throw new Error(`mastodon ${r.status}`);
    return String(((await r.json()) as { id: string }).id);
  }
  if (n === 'bluesky') {
    const s = await f('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: e.BLUESKY_HANDLE, password: e.BLUESKY_APP_PASSWORD }) });
    if (!s.ok) throw new Error(`bluesky login ${s.status}`);
    const { accessJwt, did } = (await s.json()) as { accessJwt: string; did: string };
    const start = Buffer.byteLength(text.slice(0, text.indexOf(url)));
    const record = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      facets: [{ index: { byteStart: start, byteEnd: start + Buffer.byteLength(url) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] }],
    };
    const r = await f('https://bsky.social/xrpc/com.atproto.repo.createRecord', { method: 'POST', headers: { authorization: `Bearer ${accessJwt}`, 'content-type': 'application/json' }, body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }) });
    if (!r.ok) throw new Error(`bluesky ${r.status}`);
    return String(((await r.json()) as { uri: string }).uri);
  }
  const r = await f('https://api.x.com/2/tweets', { method: 'POST', headers: { authorization: `Bearer ${process.env.X_USER_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new Error(`x ${r.status}`);
  return String(((await r.json()) as { data: { id: string } }).data.id);
}
