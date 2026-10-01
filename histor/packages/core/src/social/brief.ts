/**
 * «Las claves del día» en el canal de Telegram de cada idioma, a las 8:00 y a las 20:00 (hora del
 * canal): las noticias verificadas más importantes en un solo mensaje, pensado para reenviarse
 * por WhatsApp, que es por donde corren las noticias en España y Latinoamérica (01-10-2026).
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles } from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';
import { absoluteUrl } from '../seo';
import { getSetting, setSetting } from '../services/settings';
import { fold } from '../text/normalize';
import { telegramChannel } from './index';

export type BriefSlot = 'am' | 'pm';

const TEXT: Record<string, { am: string; pm: string; verified: string; forward: string; more: string }> = {
  es: { am: 'Las claves de la mañana', pm: 'Las claves del día', verified: 'Todo verificado con al menos dos fuentes independientes.', forward: 'Reenvíalo a quien le interese', more: 'Todas las noticias de hoy' },
  en: { am: 'Morning briefing', pm: 'The day in brief', verified: 'Every story checked against at least two independent sources.', forward: 'Forward it to someone who cares', more: 'All of today’s news' },
  de: { am: 'Das Wichtigste am Morgen', pm: 'Der Tag im Überblick', verified: 'Alles mit mindestens zwei unabhängigen Quellen geprüft.', forward: 'Leite es weiter', more: 'Alle Nachrichten von heute' },
  fr: { am: 'L’essentiel du matin', pm: 'L’essentiel de la journée', verified: 'Tout est vérifié avec au moins deux sources indépendantes.', forward: 'Transférez-le à qui ça intéresse', more: 'Toute l’actualité du jour' },
  it: { am: 'Le notizie del mattino', pm: 'Le notizie del giorno', verified: 'Tutto verificato con almeno due fonti indipendenti.', forward: 'Inoltralo a chi può interessare', more: 'Tutte le notizie di oggi' },
  pt: { am: 'O essencial da manhã', pm: 'O essencial do dia', verified: 'Tudo checado com pelo menos duas fontes independentes.', forward: 'Encaminhe para quem possa interessar', more: 'Todas as notícias de hoje' },
};

const TZ: Record<string, string> = { es: 'Europe/Madrid', en: 'Europe/London', de: 'Europe/Berlin', fr: 'Europe/Paris', it: 'Europe/Rome', pt: 'Europe/Lisbon' };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Hora local del canal y fecha (AAAA-MM-DD) para no mandar dos veces el mismo resumen. */
function localNow(lang: string, now: Date): { hour: number; day: string; label: string } {
  const tz = TZ[lang] ?? 'UTC';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const label = new Intl.DateTimeFormat(lang, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return { hour: Number(parts.hour) % 24, day: `${parts.year}-${parts.month}-${parts.day}`, label };
}

/** Las noticias del resumen: verificadas, con cuerpo, por importancia, sin dos que cuenten lo mismo. */
export async function briefItems(db: Db, lang: string, now = new Date(), limit = 8) {
  const rows = await db
    .select({ headline: articles.headline, slug: articles.slug, publishedAt: articles.publishedAt })
    .from(articles)
    .where(
      and(
        eq(articles.status, 'published'),
        eq(articles.isDemo, false),
        eq(articles.language, lang),
        eq(articles.isDeveloping, false),
        gte(articles.wordCount, 55),
        gte(articles.publishedAt, new Date(now.getTime() - 24 * 3600000)),
      ),
    )
    .orderBy(desc(sql`${articles.importance} * exp(-extract(epoch from (${now.toISOString()}::timestamptz - ${articles.publishedAt})) / 86400.0)`))
    .limit(40);
  const words = (h: string) => new Set(fold(h).split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
  const picked: typeof rows = [];
  const seen: Set<string>[] = [];
  for (const r of rows) {
    const w = words(r.headline);
    if (seen.some((s) => [...w].filter((x) => s.has(x)).length / Math.max(1, Math.min(w.size, s.size)) >= 0.5)) continue;
    seen.push(w);
    picked.push(r);
    if (picked.length >= limit) break;
  }
  return picked.map((r) => ({ headline: r.headline, url: absoluteUrl(href.article(lang, r.publishedAt!, r.slug)) }));
}

export function briefText(lang: string, slot: BriefSlot, dateLabel: string, items: { headline: string; url: string }[], channel: string): string {
  const T = TEXT[lang] ?? TEXT.en;
  const list = items.map((it, i) => `${i + 1}. <a href="${it.url}">${escapeHtml(it.headline)}</a>`).join('\n');
  const today = absoluteUrl(href.list(lang, 'today'));
  return [
    `🗞 <b>${T[slot]}</b> · ${escapeHtml(dateLabel)}`,
    list,
    `✅ ${T.verified}`,
    `📲 ${T.forward}: t.me/${channel.replace(/^@/, '')}`,
    `🌐 <a href="${today}">${T.more}</a>`,
  ].join('\n\n');
}

/** Manda un resumen a un canal y lo deja anotado (una vez por día y franja). Devuelve cuántas noticias llevaba. */
export async function sendBrief(db: Db, lang: string, slot: BriefSlot, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<number> {
  const token = env().TELEGRAM_BOT_TOKEN;
  const channel = telegramChannel(lang);
  if (!token || !channel) return 0;
  const { day, label } = localNow(lang, now);
  const items = await briefItems(db, lang, now);
  if (items.length < 3) return 0;
  const r = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: channel,
      text: briefText(lang, slot, label, items, channel),
      parse_mode: 'HTML',
      link_preview_options: { url: absoluteUrl(href.list(lang, 'today')), prefer_small_media: true },
    }),
  });
  const body = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!r.ok || !body.ok) throw new Error(`telegram ${r.status}: ${body.description ?? ''}`.slice(0, 200));
  await setSetting(db, `brief:${lang}:${day}:${slot}`, { at: now.toISOString(), items: items.length }, 'system');
  return items.length;
}

/** El que toque ahora (8:00 «mañana», 20:00 «día», hora del canal) y no se haya mandado ya. */
export async function sendDueBriefs(db: Db, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<string[]> {
  if (!env().TELEGRAM_BOT_TOKEN) return [];
  const sent: string[] = [];
  for (const lang of Object.keys(TEXT)) {
    if (!telegramChannel(lang)) continue;
    const { hour, day } = localNow(lang, now);
    const slot: BriefSlot | null = hour === 8 ? 'am' : hour === 20 ? 'pm' : null;
    if (!slot) continue;
    if (await getSetting(db, `brief:${lang}:${day}:${slot}`, null)) continue;
    if (await sendBrief(db, lang, slot, now, fetchImpl)) sent.push(lang);
  }
  return sent;
}
