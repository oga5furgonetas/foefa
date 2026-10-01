/**
 * Redes sociales por API oficial (Telegram, Bluesky, Mastodon, X). Regla: solo se
 * publica lo que ya pasó TODOS los controles y está VERIFICADO (nunca
 * "en desarrollo", nunca DEMO). Sin credenciales, se registra "skipped".
 * Y con medida: solo lo importante, como mucho SOCIAL_MAX_PER_HOUR por red y nada
 * con más de 6 horas en cola (un canal que publica 100 noticias al día se abandona).
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, socialPosts } from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';
import { absoluteUrl } from '../seo';
import { getEditorialSettings } from '../services/settings';
import { truncate } from '../text/normalize';

type Network = 'telegram' | 'bluesky' | 'mastodon' | 'x';
const NETWORKS: Network[] = ['telegram', 'bluesky', 'mastodon', 'x'];
const LIMITS: Record<Network, number> = { telegram: 1000, bluesky: 300, mastodon: 500, x: 280 };

export function socialText(headline: string, url: string, network: Network, summary = ''): string {
  // Telegram: titular en negrita + entradilla + enlace (la vista previa pone la foto).
  if (network === 'telegram') return [`<b>${escapeHtml(headline)}</b>`, summary ? escapeHtml(truncate(summary, 600)) : null, url].filter(Boolean).join('\n\n');
  const room = LIMITS[network] - url.length - 2;
  return `${truncate(headline, room)}\n${url}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Canal de Telegram de un idioma: TELEGRAM_CHANNELS=«es=@histor_es,en=@histor_en». */
export function telegramChannel(lang: string): string | null {
  for (const pair of (env().TELEGRAM_CHANNELS ?? '').split(',')) {
    const [l, ch] = pair.split('=').map((x) => x.trim());
    if (l === lang && ch) return ch;
  }
  return null;
}

function configured(n: Network, lang: string): boolean {
  const e = env();
  if (n === 'telegram') return !!(e.TELEGRAM_BOT_TOKEN && telegramChannel(lang));
  if (n === 'bluesky') return !!(e.BLUESKY_HANDLE && e.BLUESKY_APP_PASSWORD);
  if (n === 'mastodon') return !!(e.MASTODON_BASE_URL && e.MASTODON_TOKEN);
  return !!process.env.X_USER_ACCESS_TOKEN;
}

export async function queueSocialPosts(db: Db, storyId: number): Promise<number> {
  const s = await getEditorialSettings(db);
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  let n = 0;
  for (const a of arts) {
    const eligible = s.autoSocial && !a.isDeveloping && !a.isDemo && a.evidenceConfidence >= s.verifiedMin && a.importance >= env().SOCIAL_MIN_IMPORTANCE;
    const url = absoluteUrl(href.article(a.language, a.publishedAt!, a.slug));
    for (const network of NETWORKS) {
      const status = !eligible ? 'skipped' : configured(network, a.language) ? 'queued' : 'skipped';
      const rows = await db
        .insert(socialPosts)
        .values({ articleId: a.id, network, status, text: socialText(a.headline, url, network, a.summary), url, error: !eligible ? 'no elegible (no verificada, en desarrollo, DEMO o desactivado)' : status === 'skipped' ? 'red no configurada' : null })
        .onConflictDoNothing()
        .returning({ id: socialPosts.id });
      n += rows.length;
    }
  }
  return n;
}

/**
 * Vuelve a poner en cola las publicaciones de las últimas `hours` horas que se saltaron y que hoy sí
 * cumplen las condiciones (tras activar autoSocial o configurar una red). Devuelve cuántas.
 */
export async function requeueSocialPosts(db: Db, hours: number): Promise<number> {
  const s = await getEditorialSettings(db);
  const rows = await db
    .select({ id: socialPosts.id, network: socialPosts.network, a: articles })
    .from(socialPosts)
    .innerJoin(articles, eq(articles.id, socialPosts.articleId))
    .where(and(eq(socialPosts.status, 'skipped'), gte(socialPosts.createdAt, new Date(Date.now() - hours * 3600_000)), eq(articles.status, 'published')));
  let n = 0;
  for (const { id, network, a } of rows) {
    const eligible = s.autoSocial && !a.isDeveloping && !a.isDemo && a.evidenceConfidence >= s.verifiedMin && a.importance >= env().SOCIAL_MIN_IMPORTANCE;
    if (!eligible || !configured(network as Network, a.language)) continue;
    await db.update(socialPosts).set({ status: 'queued', error: null }).where(eq(socialPosts.id, id));
    n++;
  }
  return n;
}

export async function publishQueuedPosts(db: Db, fetchImpl: typeof fetch = fetch): Promise<{ posted: number; failed: number }> {
  // Lo que lleva más de 6 horas esperando ya no es noticia: fuera.
  await db
    .update(socialPosts)
    .set({ status: 'skipped', error: 'caducada (más de 6 h en cola)' })
    .where(and(eq(socialPosts.status, 'queued'), lt(socialPosts.createdAt, new Date(Date.now() - 6 * 3600_000))));
  const queued = await db.select().from(socialPosts).where(eq(socialPosts.status, 'queued')).orderBy(socialPosts.createdAt).limit(20);
  let posted = 0;
  let failed = 0;
  const max = env().SOCIAL_MAX_PER_HOUR;
  const done = new Map<string, number>();
  for (const p of queued) {
    // Ritmo: como mucho SOCIAL_MAX_PER_HOUR por red; el resto espera a la siguiente vuelta.
    if (!done.has(p.network)) {
      const [c] = await db
        .select({ n: sql<number>`count(*)` })
        .from(socialPosts)
        .where(and(eq(socialPosts.network, p.network), eq(socialPosts.status, 'posted'), gte(socialPosts.postedAt, new Date(Date.now() - 3600_000))));
      done.set(p.network, Number(c?.n ?? 0));
    }
    if ((done.get(p.network) ?? 0) >= max) continue;
    try {
      const id = await post(p.network as Network, p.text, p.url, fetchImpl);
      await db.update(socialPosts).set({ status: 'posted', externalId: id, postedAt: new Date(), error: null }).where(eq(socialPosts.id, p.id));
      done.set(p.network, (done.get(p.network) ?? 0) + 1);
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
  if (n === 'telegram') {
    const lang = new URL(url).pathname.split('/')[1] ?? '';
    const chat = telegramChannel(lang);
    if (!chat) throw new Error(`telegram: sin canal para ${lang}`);
    const r = await f(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { url, prefer_large_media: true } }),
    });
    const body = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id: number } };
    if (!r.ok || !body.ok) throw new Error(`telegram ${r.status}: ${body.description ?? ''}`.slice(0, 200));
    return String(body.result?.message_id ?? '');
  }
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
