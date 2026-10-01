/**
 * Motor de calidad editorial (sección 47). Se ejecuta ANTES de publicar:
 * FACT → SOURCE → DUPLICATE → DATE → ENTITY → QUOTE → GEO → LANGUAGE → SEO → LEGAL → FINAL
 * Si falla un control crítico: NO PUBLICAR (la historia queda HELD y el
 * informe se guarda en quality_reports para el panel).
 */
import type { EditorialSettings } from '../config/settings';
import type { StoryFlag, StoryState } from '../domain';
import { detectLanguage } from '../text/langdetect';
import { fold, slugify, wordCount } from '../text/normalize';
import { minhash, minhashSimilarity } from '../text/similarity';
import { draftPlainText, type Draft } from './draft';
import type { FactSheet } from './factsheet';
import { validateDraft } from './validate';

/** Palabras de los párrafos de texto propio (sin las coletillas fijas: método, «seguiremos informando»). */
export function ownBodyWords(draft: Pick<Draft, 'body' | 'boilerplate'>): number {
  const fixed = new Set(draft.boilerplate.map((s) => s.trim()));
  return wordCount(
    draft.body
      .filter((b): b is Extract<typeof b, { type: 'p' }> => b.type === 'p' && !fixed.has(b.text.trim()))
      .map((b) => b.text)
      .join(' '),
  );
}

export type CheckResult = { name: string; passed: boolean; critical: boolean; messages: string[] };
export type QualityReport = { passed: boolean; checks: CheckResult[] };

export type QualityContext = {
  draft: Draft;
  factSheet: FactSheet;
  state: StoryState;
  flags: StoryFlag[];
  confidence: number;
  settings: EditorialSettings;
  storyBlocked: boolean;
  /** Artículos publicados recientes en el mismo idioma (otras historias). */
  recentPublished: { storyId: number; headline: string; minhash: number[] | null }[];
  storyId: number | null;
  /** Fuentes bloqueadas o satíricas que no pueden figurar como fuente. */
  forbiddenSourceIds: Set<number>;
  now: Date;
  /** Adaptación de un borrador ya validado en otro idioma: nombres y citas se validaron en el original. */
  isTranslation?: boolean;
  /** Mínimo de palabras de texto propio, si no es el de los ajustes (la DEMO, con textos de ejemplo cortos, usa 0). */
  minBodyWords?: number;
};

const CLICKBAIT = [
  /no (te )?(vas a )?creer/i, /no creer[aá]s/i, /you won'?t believe/i, /what happened next/i, /lo que pas[oó] despu[eé]s/i,
  /\bimpactante\b/i, /\bshocking\b/i, /\bincre[ií]ble\b/i, /\bunglaublich\b/i, /\bschockierend\b/i, /\bincroyable\b/i,
  /\bchoquant\b/i, /\bincredibile\b/i, /\bscioccante\b/i, /\binacredit[aá]vel\b/i, /\bchocante\b/i, /!{2,}/, /\?\?/, /^[^a-z]*[A-ZÁÉÍÓÚÑ]{6,}[^a-z]*$/,
];

const DEFAMATION_TERMS =
  /\b(asesin[oa]|violador|ladr[oó]n|estafador|corrupt[oa]|terrorista|pederasta|murderer|rapist|thief|fraudster|terrorist|m[öo]rder|vergewaltiger|dieb|betr[üu]ger|meurtrier|violeur|voleur|escroc|assassino|stupratore|ladro|truffatore|estuprador|golpista)\b/i;
const PRESUMPTION = /(presunt|supuest|alleged|accused|acusad|mutmaßlich|mutmasslich|beschuldigt|présum|presum|accusat|suspeit|investigad|condenad|convicted|verurteilt|condamn|condannat)/i;
// Separadores de un teléfono: espacio, punto o guion, nunca un salto de línea (juntaba dos cifras
// de «Datos clave» en un «teléfono»).
const PII = [/[\w.+-]+@[\w-]+\.[\w.]+/, /(?<!\d)(?:\+?\d{1,3}[ .\-  ]?)?(?:\(?\d{2,4}\)?[ .\-  ]?){2,4}\d{3,4}(?!\d)/g];
/** «54 000 000 000 €», «300 000 personnes», «1.250.000 euros»: una cantidad, no un teléfono. */
const THOUSANDS = /^\d{1,3}(?:[ .,  ]\d{3})+$/;

/** Primer correo o teléfono que parece un dato personal (las cantidades con unidad no cuentan). */
export function personalDataIn(text: string): { kind: 'correo' | 'teléfono'; match: string } | null {
  const mail = text.match(PII[0]);
  if (mail) return { kind: 'correo', match: mail[0] };
  for (const m of text.matchAll(PII[1])) {
    const raw = m[0].trim();
    if (raw.replace(/\D/g, '').length < 9) continue;
    const end = (m.index ?? 0) + m[0].length;
    if (THOUSANDS.test(raw) && /^[\s  ]*[\p{L}€$£%]/u.test(text.slice(end, end + 3))) continue;
    return { kind: 'teléfono', match: raw };
  }
  return null;
}

export function runQualityChecks(ctx: QualityContext): QualityReport {
  const { draft, factSheet: fs, settings } = ctx;
  const checks: CheckResult[] = [];
  const text = draftPlainText(draft);
  const add = (name: string, critical: boolean, messages: string[]) => checks.push({ name, passed: messages.length === 0, critical, messages });

  // FACT CHECK
  const v = validateDraft(draft, fs);
  if (ctx.isTranslation) v.issues = v.issues.filter((i) => i.check !== 'entity' && i.check !== 'quote' && i.check !== 'citation');
  add('FACT_CHECK', true, v.issues.filter((i) => ['citation', 'number', 'date', 'status', 'prediction', 'headline'].includes(i.check)).map((i) => `${i.detail} — «${i.text.slice(0, 120)}»`));

  // SOURCE CHECK
  const src: string[] = [];
  if (!fs.sources.length) src.push('no hay ninguna fuente creíble');
  if (fs.verified && fs.independentCredible < settings.minIndependentVerified && !(fs.hasPrimary && settings.primaryOfficialSelfSufficient))
    src.push(`verificada con ${fs.independentCredible} fuente(s); se exigen ${settings.minIndependentVerified}`);
  for (const s of fs.sources) if (ctx.forbiddenSourceIds.has(s.sourceId)) src.push(`fuente bloqueada o satírica citada: ${s.name}`);
  for (const s of fs.sources) if (!/^https?:\/\//.test(s.url)) src.push(`URL de fuente no válida: ${s.url}`);
  add('SOURCE_CHECK', true, src);

  // DUPLICATE CHECK
  const dup: string[] = [];
  const sig = minhash(`${draft.headline} ${draft.summary}`);
  for (const r of ctx.recentPublished) {
    if (r.storyId === ctx.storyId) continue;
    const sim = minhashSimilarity(sig, r.minhash ?? minhash(r.headline));
    if (sim >= 0.6 || fold(r.headline) === fold(draft.headline)) dup.push(`muy parecida a una noticia ya publicada (historia ${r.storyId})`);
  }
  add('DUPLICATE_CHECK', true, dup);

  // DATE CHECK
  const date: string[] = [];
  if (ctx.flags.includes('old_resurfaced')) date.push('información antigua que vuelve a circular');
  if (fs.eventTime && fs.eventTime.getTime() > ctx.now.getTime() + 2 * 3600000) date.push('fecha del acontecimiento en el futuro');
  if (fs.eventTime && ctx.now.getTime() - fs.eventTime.getTime() > settings.staleDays * 86400000 * 3) date.push('el acontecimiento es demasiado antiguo para publicarse como noticia');
  add('DATE_CHECK', true, date);

  // ENTITY CHECK
  add('ENTITY_CHECK', true, v.issues.filter((i) => i.check === 'entity').map((i) => i.detail));

  // QUOTE CHECK
  const quoteIssues = v.issues.filter((i) => i.check === 'quote').map((i) => i.detail);
  if (ctx.flags.includes('fabricated_quote') && draft.body.some((b) => b.type === 'quote')) quoteIssues.push('la historia tiene citas dudosas: no se publica ninguna cita');
  add('QUOTE_CHECK', true, quoteIssues);

  // GEO CHECK (aviso: no bloquea salvo contradicción de lugar en lo verificado)
  const geo: string[] = [];
  if (ctx.flags.includes('geo_mismatch') && fs.verified) geo.push('las fuentes sitúan el hecho en lugares distintos');
  add('GEO_CHECK', fs.verified && ctx.flags.includes('geo_mismatch'), geo);

  // LANGUAGE CHECK
  const lang: string[] = [];
  const detected = detectLanguage(text, draft.language);
  if (detected.lang && detected.lang !== draft.language && detected.confidence > 0.5) lang.push(`el texto parece estar en "${detected.lang}", no en "${draft.language}"`);
  add('LANGUAGE_CHECK', true, lang);

  // SEO CHECK (no crítico: se corrige solo)
  const seo: string[] = [];
  if (draft.headline.length < 20) seo.push('titular demasiado corto');
  if (draft.headline.length > 120) seo.push('titular demasiado largo');
  if (draft.seoDescription.length < 50) seo.push('descripción SEO corta');
  if (!slugify(draft.headline)) seo.push('no se puede generar un slug');
  add('SEO_CHECK', false, seo);

  // PROFUNDIDAD (crítico): una noticia de una frase no es una noticia (Dani, 01-10-2026: «sin
  // noticia en sí, como que no tienen sentido»). La ficha de un terremoto es corta a propósito.
  const ownWords = ownBodyWords(draft);
  const minWords = ctx.minBodyWords ?? settings.minBodyWords;
  add('CONTENT_DEPTH', true, fs.earthquake || ownWords >= minWords ? [] : [`texto demasiado corto (${ownWords} palabras; mínimo ${minWords})`]);

  // Clickbait: crítico (engaña al lector)
  const bait = CLICKBAIT.filter((re) => re.test(draft.headline)).map((re) => `titular sensacionalista (${re.source})`);
  // El titular debe estar respaldado por el contenido: sus palabras clave aparecen en el cuerpo.
  const hWords = fold(draft.headline).split(/\W+/).filter((w) => w.length > 4);
  const bWords = new Set(fold(text.slice(draft.headline.length)).split(/\W+/));
  const coverage = hWords.length ? hWords.filter((w) => bWords.has(w)).length / hWords.length : 1;
  if (coverage < 0.5) bait.push('el titular no refleja el contenido del artículo');
  add('HEADLINE_INTEGRITY', true, bait);

  // LEGAL CHECK
  const legal: string[] = [];
  const quoteTexts = draft.body.filter((b) => b.type === 'quote').map((b) => (b as { text: string }).text);
  const nonQuote = stripQuotes(text, quoteTexts);
  for (const s of fs.sourceTexts) {
    // Los comunicados oficiales se publican para difundirse: margen mayor (siempre atribuidos).
    const official = fs.sources.some((x) => x.sourceId === s.sourceId && (x.sourceType === 'primary_official' || x.sourceType === 'official'));
    const maxRun = official ? settings.maxVerbatimWords * 2 : settings.maxVerbatimWords;
    const maxRatio = official ? Math.max(settings.maxSourceOverlap, 0.85) : settings.maxSourceOverlap;
    const run = longestCommonRun(nonQuote, s.text);
    if (run > maxRun) legal.push(`copia literal de ${run} palabras seguidas de una fuente (máximo ${maxRun})`);
    const ratio = overlapRatio(nonQuote, s.text);
    if (ratio > maxRatio) legal.push(`el ${Math.round(ratio * 100)} % del texto coincide con una sola fuente (máximo ${Math.round(maxRatio * 100)} %)`);
  }
  const pii = personalDataIn(nonQuote);
  if (pii && !fs.sourceTexts.some((s) => s.text.includes(pii.match) && s.sourceId && fs.sources.some((x) => x.sourceId === s.sourceId && x.isPrimary))) {
    legal.push(`posible dato personal (${pii.kind})`);
  }
  for (const sentence of nonQuote.split(/\n+|(?<=[.!?])\s+/)) {
    if (DEFAMATION_TERMS.test(sentence) && !PRESUMPTION.test(sentence) && !/según|according|laut|selon|secondo|segundo/i.test(sentence)) {
      legal.push(`acusación grave sin atribuir ni presunción: «${sentence.slice(0, 100)}»`);
    }
  }
  add('LEGAL_CHECK', true, [...new Set(legal)]);

  // FINAL EDITORIAL CHECK
  const fin: string[] = [];
  if (ctx.storyBlocked) fin.push('historia bloqueada por un editor');
  if (!['VERIFIED', 'PARTIALLY_VERIFIED', 'PUBLISHED', 'UPDATED'].includes(ctx.state)) fin.push(`estado ${ctx.state} no publicable`);
  if (fs.verified && ctx.confidence < settings.verifiedMin && !fs.earthquake) fin.push('confianza por debajo del umbral de verificado');
  if (!fs.verified && ctx.confidence < settings.developingMin) fin.push('confianza por debajo del umbral de "en desarrollo"');
  if (!fs.verified && !draft.isDeveloping) fin.push('una historia no verificada debe llevar la etiqueta "en desarrollo"');
  if (ctx.flags.some((f) => ['satire_source', 'social_only', 'old_resurfaced'].includes(f))) fin.push(`marcas que impiden publicar: ${ctx.flags.join(', ')}`);
  if (!settings.autoPublish) fin.push('publicación automática desactivada: requiere un editor');
  add('FINAL_EDITORIAL_CHECK', true, fin);

  return { passed: checks.every((c) => c.passed || !c.critical), checks };
}

function stripQuotes(text: string, quotes: string[]): string {
  let out = text;
  for (const q of quotes) out = out.split(q).join(' ');
  return out;
}

/** Palabras plegadas, sin signos (como las compara el control de copia literal). */
export function plainWords(s: string): string[] {
  return fold(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Longitud (en palabras) del tramo común más largo entre a y b. */
export function longestCommonRun(a: string, b: string): number {
  const A = plainWords(a);
  const B = plainWords(b);
  if (!A.length || !B.length) return 0;
  const pos = new Map<string, number[]>();
  B.forEach((w, i) => pos.set(w, [...(pos.get(w) ?? []), i]));
  let best = 0;
  for (let i = 0; i < A.length; i++) {
    for (const j of pos.get(A[i]) ?? []) {
      let k = 0;
      while (i + k < A.length && j + k < B.length && A[i + k] === B[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/** Proporción de trigramas del texto a que aparecen en b. */
export function overlapRatio(a: string, b: string, n = 6): number {
  const A = plainWords(a);
  const B = plainWords(b);
  if (A.length < n || B.length < n) return 0;
  const set = new Set<string>();
  for (let i = 0; i <= B.length - n; i++) set.add(B.slice(i, i + n).join(' '));
  let hit = 0;
  let total = 0;
  for (let i = 0; i <= A.length - n; i++) {
    total++;
    if (set.has(A.slice(i, i + n).join(' '))) hit++;
  }
  return total ? hit / total : 0;
}
