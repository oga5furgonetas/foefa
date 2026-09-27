/**
 * Experimentos A/B (titulares, imágenes, posiciones, newsletters, CTA,
 * precios, onboarding). Reglas anti-clickbait:
 * - Toda variante de titular pasa los mismos controles que un titular normal
 *   (nada sensacionalista; cifras y nombres respaldados; fiel al contenido).
 * - El ganador se elige por LECTURA REAL (clic que llega al 60 % del texto),
 *   no por clics: un titular engañoso atrae clics pero no lecturas.
 * - Los precios solo pueden probarse entre valores aprobados en el panel.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { analyticsEvents, articles, articleVersions, experiments } from '../db/schema';
import { fnv1a } from '../text/normalize';
import { extractNumbers } from '../text/numbers';
import { audit } from '../services/audit';

export type Variant = { key: string; weight: number; payload: Record<string, unknown> };

/** Asignación estable: el mismo lector ve siempre la misma variante. */
export function assignVariant(experimentKey: string, unitId: string, variants: Variant[]): Variant {
  const total = variants.reduce((s, v) => s + v.weight, 0);
  const x = (fnv1a(`${experimentKey}:${unitId}`) / 0xffffffff) * total;
  let acc = 0;
  for (const v of variants) {
    acc += v.weight;
    if (x < acc) return v;
  }
  return variants[variants.length - 1];
}

const BAIT = /(no (te )?(vas a )?creer|no creer[aá]s|you won'?t believe|shocking|impactante|incre[ií]ble|unglaublich|incroyable|incredibile|inacredit[aá]vel|!{2,}|\?\?)/i;

/** Valida una variante de titular frente al artículo publicado. */
export function validateHeadlineVariant(variant: string, article: { headline: string; bodyText: string }): string[] {
  const problems: string[] = [];
  if (variant.length < 20 || variant.length > 120) problems.push('longitud fuera de 20-120 caracteres');
  if (BAIT.test(variant)) problems.push('sensacionalista');
  if (/\?$/.test(variant.trim())) problems.push('titular en forma de pregunta');
  const bodyNums = extractNumbers(`${article.headline} ${article.bodyText}`).map((n) => n.value);
  for (const n of extractNumbers(variant)) if (!bodyNums.includes(n.value)) problems.push(`cifra no presente en el artículo: ${n.raw}`);
  const words = variant.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const body = new Set(`${article.headline} ${article.bodyText}`.toLowerCase().split(/\W+/));
  const coverage = words.length ? words.filter((w) => body.has(w)).length / words.length : 1;
  if (coverage < 0.6) problems.push('no refleja el contenido del artículo');
  return problems;
}

export async function createHeadlineExperiment(db: Db, articleId: number, headlines: string[], actor: string): Promise<{ ok: true; id: number } | { ok: false; problems: Record<string, string[]> }> {
  const [a] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return { ok: false, problems: { article: ['no existe'] } };
  const problems: Record<string, string[]> = {};
  for (const h of headlines) {
    const p = validateHeadlineVariant(h, a);
    if (p.length) problems[h] = p;
  }
  if (Object.keys(problems).length) return { ok: false, problems };
  const variants: Variant[] = [{ key: 'control', weight: 1, payload: { headline: a.headline } }, ...headlines.map((h, i) => ({ key: `v${i + 1}`, weight: 1, payload: { headline: h } }))];
  const [row] = await db.insert(experiments).values({ key: `headline-${articleId}-${Date.now().toString(36)}`, kind: 'headline', status: 'running', articleId, variants, metric: 'read_through_rate' }).returning({ id: experiments.id });
  await audit(db, { actor, action: 'experiment.create', targetType: 'experiment', targetId: row.id, detail: { articleId, variants: headlines } });
  return { ok: true, id: row.id };
}

/** Resultados: CTR y lectura real por variante + probabilidad de ser la mejor (Beta-Binomial, Monte Carlo determinista). */
export async function experimentResults(db: Db, experimentId: number) {
  const [exp] = await db.select().from(experiments).where(eq(experiments.id, experimentId)).limit(1);
  if (!exp) return null;
  const rows = await db
    .select({ variant: sql<string>`${analyticsEvents.props} ->> 'variant'`, type: analyticsEvents.type, c: sql<number>`count(*)`, reads: sql<number>`count(*) FILTER (WHERE ${analyticsEvents.value} >= 0.6)` })
    .from(analyticsEvents)
    .where(and(sql`${analyticsEvents.props} ->> 'exp' = ${exp.key}`))
    .groupBy(sql`1`, analyticsEvents.type);
  const stats = exp.variants.map((v) => {
    const imp = Number(rows.find((r) => r.variant === v.key && r.type === 'impression')?.c ?? 0);
    const clicks = Number(rows.find((r) => r.variant === v.key && r.type === 'click')?.c ?? 0);
    const reads = Number(rows.find((r) => r.variant === v.key && r.type === 'read_progress')?.reads ?? 0);
    return { key: v.key, headline: String(v.payload.headline ?? ''), impressions: imp, clicks, reads, ctr: imp ? clicks / imp : 0, readThrough: imp ? reads / imp : 0 };
  });
  const probBest = probabilityBest(stats.map((s) => ({ successes: s.reads, trials: s.impressions })));
  return { experiment: exp, variants: stats.map((s, i) => ({ ...s, probBest: probBest[i] })) };
}

export function probabilityBest(arms: { successes: number; trials: number }[], draws = 4000): number[] {
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 0xffffffff);
  const gamma = (k: number): number => {
    // Marsaglia–Tsang (k ≥ 1); para k < 1, truco de potencia.
    if (k < 1) return gamma(k + 1) * rand() ** (1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x: number;
      let v: number;
      do {
        const u1 = rand() || 1e-12;
        const u2 = rand();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v ** 3;
      const u = rand();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const beta = (a: number, b: number) => {
    const x = gamma(a);
    return x / (x + gamma(b));
  };
  const wins = arms.map(() => 0);
  for (let i = 0; i < draws; i++) {
    let best = -1;
    let bi = 0;
    arms.forEach((a, j) => {
      const s = beta(1 + a.successes, 1 + Math.max(0, a.trials - a.successes));
      if (s > best) {
        best = s;
        bi = j;
      }
    });
    wins[bi]++;
  }
  return wins.map((w) => Math.round((w / draws) * 1000) / 1000);
}

export type HeadlineAssignment = { exp: string; variant: string; headline: string };

/**
 * Experimentos de titular en marcha para unos artículos, asignados a un
 * lector (identificador anónimo con consentimiento de medición). Sin
 * identificador no hay experimento: se muestra el titular original.
 */
export async function headlineAssignments(db: Db, articleIds: number[], unitId: string | null): Promise<Map<number, HeadlineAssignment>> {
  const out = new Map<number, HeadlineAssignment>();
  if (!unitId || !articleIds.length) return out;
  const rows = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.kind, 'headline'), eq(experiments.status, 'running'), sql`${experiments.articleId} IN (${sql.join(articleIds.map((i) => sql`${i}`), sql`, `)})`));
  for (const e of rows) {
    if (!e.articleId) continue;
    const v = assignVariant(e.key, unitId, e.variants);
    out.set(e.articleId, { exp: e.key, variant: v.key, headline: String(v.payload.headline ?? '') });
  }
  return out;
}

/** Aplica las variantes a tarjetas (devuelve copias; no toca el original). */
export function applyHeadlines<T extends { id: number; headline: string }>(cards: T[], assigned: Map<number, HeadlineAssignment>): (T & { exp?: { key: string; variant: string } })[] {
  return cards.map((c) => {
    const a = assigned.get(c.id);
    return a && a.headline ? { ...c, headline: a.headline, exp: { key: a.exp, variant: a.variant } } : c;
  });
}

const HEADLINE_NOTE: Record<string, string> = {
  es: 'Titular ajustado para reflejar mejor el contenido (el texto no cambia).',
  en: 'Headline adjusted to better reflect the story (the text is unchanged).',
  de: 'Überschrift angepasst, um den Inhalt besser wiederzugeben (der Text bleibt unverändert).',
  fr: 'Titre ajusté pour mieux refléter le contenu (le texte est inchangé).',
  it: 'Titolo modificato per riflettere meglio il contenuto (il testo non cambia).',
  pt: 'Título ajustado para refletir melhor o conteúdo (o texto não muda).',
};

/**
 * Termina un experimento. Si gana una variante distinta del control, el
 * titular del artículo cambia con versión nueva y nota pública (nunca en silencio).
 */
export async function stopExperiment(db: Db, actor: { id: string; role: string }, experimentId: number, winner?: string | null): Promise<void> {
  const [exp] = await db.select().from(experiments).where(eq(experiments.id, experimentId)).limit(1);
  if (!exp) throw new Error('experimento no encontrado');
  const v = winner ? exp.variants.find((x) => x.key === winner) : undefined;
  if (winner && !v) throw new Error('variante no válida');
  await db.update(experiments).set({ status: winner ? 'completed' : 'stopped', winner: winner ?? null, endedAt: new Date() }).where(eq(experiments.id, experimentId));
  if (v && v.key !== 'control' && exp.articleId) {
    const [a] = await db.select().from(articles).where(eq(articles.id, exp.articleId)).limit(1);
    const headline = String(v.payload.headline ?? '');
    if (a && headline && headline !== a.headline) {
      const problems = validateHeadlineVariant(headline, a);
      if (problems.length) throw new Error(`el titular ganador ya no pasa los controles: ${problems.join('; ')}`);
      const version = a.version + 1;
      const note = HEADLINE_NOTE[a.language] ?? HEADLINE_NOTE.en;
      await db.update(articles).set({ headline, version, updatedAt: new Date() }).where(eq(articles.id, a.id));
      await db.insert(articleVersions).values({ articleId: a.id, version, kind: 'edit', headline, body: a.body, verification: a.verification, changeSummary: note, changedBy: `user:${actor.id}` });
    }
  }
  await audit(db, { actor: `user:${actor.id}`, action: 'experiment.stop', targetType: 'experiment', targetId: experimentId, detail: { winner } });
}
