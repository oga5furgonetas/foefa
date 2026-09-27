/**
 * Alertas de última hora con prioridad (sección 33). Solo se envía cuando:
 *   relevancia alta (importancia ≥ umbral) Y confianza suficiente (≥ umbral,
 *   y nunca "en desarrollo") Y el interés del lector es compatible
 *   (su país, sus secciones o algo excepcional para todos).
 * Y siempre respetando: máximo diario por persona, horas de silencio en su
 * zona horaria y una sola alerta por noticia. Sin VAPID: modo "dry_run"
 * (se registra qué se habría enviado, no se envía nada).
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import webpush from 'web-push';
import { country } from '../config/countries';
import type { Db } from '../db/client';
import { articles, notifications, pushSubscriptions, users } from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';
import { getEditorialSettings } from '../services/settings';

let vapidReady: boolean | null = null;
function vapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const e = env();
  vapidReady = !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY);
  if (vapidReady) webpush.setVapidDetails(e.VAPID_SUBJECT ?? `mailto:${e.CONTACT_EMAIL ?? 'alerts@localhost'}`, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
  return vapidReady;
}

export function inQuietHours(tz: string, start: number, end: number, now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(now));
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export type AlertDecision = { send: boolean; priority: number; reason: string };

export function alertPriority(a: { importance: number; evidenceConfidence: number; isDeveloping: boolean; countryCode: string | null; categoryId: string | null }, sub: { countryCode: string | null; categories: string[] }, s: { alertMinConfidence: number; alertMinImportance: number }): AlertDecision {
  if (a.isDeveloping) return { send: false, priority: 0, reason: 'en desarrollo: no se alerta' };
  if (a.evidenceConfidence < s.alertMinConfidence) return { send: false, priority: 0, reason: 'confianza insuficiente' };
  if (a.importance < s.alertMinImportance) return { send: false, priority: 0, reason: 'importancia insuficiente' };
  const sameCountry = !!a.countryCode && a.countryCode === sub.countryCode;
  const followsSection = !!a.categoryId && sub.categories.includes(a.categoryId);
  const exceptional = a.importance >= 0.9;
  if (!sameCountry && !followsSection && !exceptional) return { send: false, priority: 0, reason: 'fuera de los intereses del lector' };
  const priority = a.importance * a.evidenceConfidence * (sameCountry ? 1 : 0.8) * (followsSection ? 1.1 : 1);
  return { send: true, priority: Math.round(priority * 1000) / 1000, reason: sameCountry ? 'país' : followsSection ? 'sección' : 'excepcional' };
}

export async function dispatchStoryAlerts(db: Db, storyId: number, now = new Date()): Promise<{ considered: number; sent: number; dryRun: number; skipped: number }> {
  const settings = await getEditorialSettings(db);
  const stats = { considered: 0, sent: 0, dryRun: 0, skipped: 0 };
  if (!settings.autoAlerts) return stats;
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published'), eq(articles.isDemo, false)));
  for (const a of arts) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.language, a.language));
    for (const sub of subs) {
      stats.considered++;
      const dec = alertPriority(a, { countryCode: sub.countryCode, categories: sub.categories }, settings);
      const already = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.pushSubscriptionId, sub.id), eq(notifications.articleId, a.id))).limit(1);
      if (already.length) continue;
      let status: 'sent' | 'skipped' | 'failed' | 'dry_run' = 'skipped';
      let reason = dec.reason;
      if (dec.send) {
        const u = sub.userId ? (await db.select().from(users).where(eq(users.id, sub.userId)).limit(1))[0] : null;
        const maxPerDay = u?.alertsMaxPerDay ?? 3;
        const tz = (sub.countryCode && country(sub.countryCode)?.timezone) || 'UTC';
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)` })
          .from(notifications)
          .where(and(eq(notifications.pushSubscriptionId, sub.id), eq(notifications.status, 'sent'), gte(notifications.createdAt, new Date(now.getTime() - 86400000))));
        if (Number(n) >= maxPerDay) reason = 'tope diario alcanzado';
        else if (inQuietHours(tz, u?.quietHoursStart ?? 22, u?.quietHoursEnd ?? 7, now)) reason = 'horas de silencio';
        else if (!vapid()) {
          status = 'dry_run';
          reason = 'VAPID no configurado: no se envía';
        } else {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: 'Histor', body: a.headline, url: href.article(a.language, a.publishedAt!, a.slug), tag: `story-${storyId}` }),
              { TTL: 3600, urgency: dec.priority > 0.8 ? 'high' : 'normal' },
            );
            status = 'sent';
          } catch (err) {
            status = 'failed';
            reason = String((err as Error).message).slice(0, 200);
            // 404/410: la suscripción ya no existe en el navegador.
            if (/410|404/.test(reason)) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      }
      if (status === 'sent') stats.sent++;
      else if (status === 'dry_run') stats.dryRun++;
      else stats.skipped++;
      if (dec.send || status !== 'skipped') {
        await db.insert(notifications).values({ userId: sub.userId, pushSubscriptionId: sub.id, articleId: a.id, channel: 'push', priority: dec.priority, status, reason });
      }
    }
  }
  return stats;
}
