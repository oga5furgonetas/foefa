/**
 * Newsletters por edición, ciudad y sección ("Las 5 noticias de España esta
 * mañana", "US Morning Brief", "Berlin Daily", "Tech Brief"…).
 * Doble confirmación (opt-in), baja en un clic (List-Unsubscribe) y solo
 * noticias publicadas y verificadas; lo DEMO nunca se envía por correo.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { premiumStatus } from '../billing';
import type { Db } from '../db/client';
import { articles, newsletterIssues, newsletters, newsletterSubscriptions } from '../db/schema';
import { emailLayout, escapeHtml, sendEmail } from '../email/send';
import { env } from '../env';
import { href } from '../i18n/routes';
import { randomToken, sha256 } from '../security/crypto';
import { absoluteUrl } from '../seo';

const TXT: Record<string, { confirmSubject: string; confirmBody: string; confirm: string; unsubscribe: string; readMore: string; why: string }> = {
  es: { confirmSubject: 'Confirma tu suscripción a «{name}»', confirmBody: 'Pulsa el botón para confirmar que quieres recibir «{name}».', confirm: 'Confirmar', unsubscribe: 'Darme de baja', readMore: 'Leer', why: 'Recibes este correo porque te suscribiste en Histor.' },
  en: { confirmSubject: 'Confirm your subscription to “{name}”', confirmBody: 'Click the button to confirm you want to receive “{name}”.', confirm: 'Confirm', unsubscribe: 'Unsubscribe', readMore: 'Read', why: 'You receive this email because you subscribed on Histor.' },
  de: { confirmSubject: 'Bestätige dein Abo von „{name}“', confirmBody: 'Klicke auf den Button, um „{name}“ zu abonnieren.', confirm: 'Bestätigen', unsubscribe: 'Abmelden', readMore: 'Lesen', why: 'Du erhältst diese E-Mail, weil du dich bei Histor angemeldet hast.' },
  fr: { confirmSubject: 'Confirmez votre abonnement à « {name} »', confirmBody: 'Cliquez sur le bouton pour confirmer votre abonnement à « {name} ».', confirm: 'Confirmer', unsubscribe: 'Se désabonner', readMore: 'Lire', why: 'Vous recevez cet e-mail car vous vous êtes abonné sur Histor.' },
  it: { confirmSubject: "Conferma l'iscrizione a «{name}»", confirmBody: 'Clicca il pulsante per confermare che vuoi ricevere «{name}».', confirm: 'Conferma', unsubscribe: 'Disiscriviti', readMore: 'Leggi', why: 'Ricevi questa email perché ti sei iscritto su Histor.' },
  pt: { confirmSubject: 'Confirme sua inscrição em “{name}”', confirmBody: 'Clique no botão para confirmar que quer receber “{name}”.', confirm: 'Confirmar', unsubscribe: 'Cancelar inscrição', readMore: 'Ler', why: 'Você recebe este e-mail porque se inscreveu no Histor.' },
};

const fill = (s: string, name: string) => s.replace('{name}', name);

export async function subscribeNewsletter(db: Db, slug: string, email: string, opts: { lang: string; userId?: string | null }): Promise<'pending' | 'already' | 'not_found' | 'premium_required'> {
  const [nl] = await db.select().from(newsletters).where(and(eq(newsletters.slug, slug), eq(newsletters.enabled, true))).limit(1);
  if (!nl) return 'not_found';
  if (nl.isPremium && !(opts.userId && (await premiumStatus(db, opts.userId)).premium)) return 'premium_required';
  const e = email.trim().toLowerCase();
  const [existing] = await db.select().from(newsletterSubscriptions).where(and(eq(newsletterSubscriptions.newsletterId, nl.id), sql`lower(${newsletterSubscriptions.email}) = ${e}`)).limit(1);
  if (existing?.status === 'confirmed') return 'already';
  const token = randomToken(24);
  const values = { newsletterId: nl.id, email: e, userId: opts.userId ?? null, status: 'pending', confirmTokenHash: sha256(token), unsubscribeToken: existing?.unsubscribeToken ?? randomToken(24) };
  if (existing) await db.update(newsletterSubscriptions).set(values).where(eq(newsletterSubscriptions.id, existing.id));
  else await db.insert(newsletterSubscriptions).values(values);
  const name = nl.names[opts.lang] ?? nl.names[nl.language] ?? Object.values(nl.names)[0] ?? slug;
  const T = TXT[opts.lang] ?? TXT.en;
  const url = `${env().PUBLIC_BASE_URL}/api/v1/newsletters/confirm?token=${token}`;
  await sendEmail(db, {
    to: e,
    subject: fill(T.confirmSubject, name),
    kind: 'newsletter_confirm',
    html: emailLayout({ lang: opts.lang, title: name, bodyHtml: `<p>${escapeHtml(fill(T.confirmBody, name))}</p><p><a href="${url}" style="display:inline-block;background:#16181d;color:#fff;padding:10px 18px;text-decoration:none;font-family:Arial,sans-serif">${T.confirm}</a></p>`, footer: T.why }),
    text: `${fill(T.confirmBody, name)}\n${url}`,
  });
  return 'pending';
}

export async function confirmNewsletter(db: Db, token: string): Promise<boolean> {
  const rows = await db
    .update(newsletterSubscriptions)
    .set({ status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null })
    .where(and(eq(newsletterSubscriptions.confirmTokenHash, sha256(token)), eq(newsletterSubscriptions.status, 'pending')))
    .returning({ id: newsletterSubscriptions.id });
  return rows.length > 0;
}

export async function unsubscribeNewsletter(db: Db, token: string): Promise<boolean> {
  const rows = await db.update(newsletterSubscriptions).set({ status: 'unsubscribed' }).where(eq(newsletterSubscriptions.unsubscribeToken, token)).returning({ id: newsletterSubscriptions.id });
  return rows.length > 0;
}

function localDate(tz: string, d = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export async function buildIssue(db: Db, nl: typeof newsletters.$inferSelect, now = new Date()) {
  const { date } = localDate(nl.timezone, now);
  const since = new Date(now.getTime() - 24 * 3600000);
  const conds = [eq(articles.status, 'published'), eq(articles.isDemo, false), eq(articles.language, nl.language), gte(articles.publishedAt, since)];
  if (nl.countryCode && nl.kind === 'edition') conds.push(eq(articles.countryCode, nl.countryCode));
  if (nl.cityId) conds.push(eq(articles.cityId, nl.cityId));
  if (nl.categoryId) conds.push(eq(articles.categoryId, nl.categoryId));
  const items = await db
    .select({ id: articles.id, headline: articles.headline, summary: articles.summary, slug: articles.slug, publishedAt: articles.publishedAt, isDeveloping: articles.isDeveloping, sources: sql<number>`jsonb_array_length(${articles.sourcesList})` })
    .from(articles)
    .where(and(...conds))
    .orderBy(desc(articles.importance))
    .limit(nl.maxItems);
  const name = nl.names[nl.language] ?? Object.values(nl.names)[0] ?? nl.slug;
  const dateLabel = new Intl.DateTimeFormat(nl.language, { day: 'numeric', month: 'long', timeZone: nl.timezone }).format(now);
  const subject = `${name} — ${dateLabel}`;
  const T = TXT[nl.language] ?? TXT.en;
  const list = items
    .map((a, i) => {
      const url = absoluteUrl(href.article(nl.language, a.publishedAt!, a.slug));
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #e6e1d6"><div style="font-family:Arial,sans-serif;font-size:12px;color:#8a6a1f">${i + 1}</div><a href="${url}" style="color:#16181d;text-decoration:none;font-size:19px;font-weight:700;line-height:1.25">${escapeHtml(a.headline)}</a><p style="margin:6px 0 0;color:#3a3e48">${escapeHtml(a.summary)}</p></td></tr>`;
    })
    .join('');
  const html = emailLayout({ lang: nl.language, title: subject, bodyHtml: `<h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(name)}</h1><p style="color:#5b6070;margin:0 0 12px">${escapeHtml(dateLabel)}</p><table role="presentation" width="100%">${list}</table>`, footer: `${T.why} <a href="{{unsubscribe}}">${T.unsubscribe}</a>` });
  const text = `${name} — ${dateLabel}\n\n${items.map((a, i) => `${i + 1}. ${a.headline}\n${a.summary}\n${absoluteUrl(href.article(nl.language, a.publishedAt!, a.slug))}`).join('\n\n')}\n\n${T.unsubscribe}: {{unsubscribe}}`;
  return { date, subject, html, text, articleIds: items.map((a) => a.id) };
}

/** Envía las newsletters cuya hora local ha llegado (una vez al día). */
export async function sendDueNewsletters(db: Db, now = new Date()): Promise<{ sent: number; issues: number }> {
  const list = await db.select().from(newsletters).where(eq(newsletters.enabled, true));
  let sent = 0;
  let issues = 0;
  for (const nl of list) {
    const { date, hour } = localDate(nl.timezone, now);
    if (hour !== nl.sendHourLocal) continue;
    const [done] = await db.select({ id: newsletterIssues.id }).from(newsletterIssues).where(and(eq(newsletterIssues.newsletterId, nl.id), eq(newsletterIssues.issueDate, date))).limit(1);
    if (done) continue;
    const issue = await buildIssue(db, nl, now);
    if (issue.articleIds.length < 2) continue; // sin material suficiente no se manda nada
    const [row] = await db.insert(newsletterIssues).values({ newsletterId: nl.id, issueDate: date, subject: issue.subject, articleIds: issue.articleIds, html: issue.html, textBody: issue.text }).onConflictDoNothing().returning({ id: newsletterIssues.id });
    if (!row) continue;
    issues++;
    const subs = await db.select().from(newsletterSubscriptions).where(and(eq(newsletterSubscriptions.newsletterId, nl.id), eq(newsletterSubscriptions.status, 'confirmed')));
    for (const s of subs) {
      if (nl.isPremium && !(s.userId && (await premiumStatus(db, s.userId)).premium)) continue;
      const unsub = `${env().PUBLIC_BASE_URL}/api/v1/newsletters/unsubscribe?token=${s.unsubscribeToken}`;
      const r = await sendEmail(db, { to: s.email, subject: issue.subject, html: issue.html.replace('{{unsubscribe}}', unsub), text: issue.text.replace('{{unsubscribe}}', unsub), kind: `newsletter:${nl.slug}` });
      if (r !== 'failed') sent++;
    }
    await db.update(newsletterIssues).set({ sentAt: new Date(), recipients: subs.length }).where(eq(newsletterIssues.id, row.id));
  }
  return { sent, issues };
}
