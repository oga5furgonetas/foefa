/**
 * WRITING AGENT y TRANSLATION AGENT (IA opcional).
 * La IA solo recibe la ficha de hechos (nunca los artículos de las fuentes
 * completos) y debe devolver cada párrafo con los ids de las afirmaciones
 * que usa. Después, validateDraft + runQualityChecks deciden. Si algo no
 * cuadra, se descarta el texto de la IA y se usa el redactor determinista.
 */
import type { Db } from '../db/client';
import type { ArticleBlock } from '../db/schema';
import { callJson } from '../ai/router';
import type { LlmProvider } from '../ai/types';
import { languageDef } from '../config/languages';
import { env } from '../env';
import { extractNumbers } from '../text/numbers';
import { decodeEntities, fold, truncate } from '../text/normalize';
import { claimRef, writeDeterministic, type WriteOptions } from './deterministic';
import type { Draft } from './draft';
import type { FactSheet } from './factsheet';
import { mediaNames, stripMediaAttribution } from './media';
import { tidyParagraphs } from './tidy';
import { validateDraft } from './validate';
import { longestCommonRun } from './quality';
import { DEFAULT_EDITORIAL_SETTINGS } from '../config/settings';
import { sentences } from '../text/tokenize';

/**
 * Reparación del texto de la IA, frase a frase, con el mismo validador que decide si se publica
 * (29-09-2026, primeras pruebas con Groq: artículos de 12 párrafos rechazados enteros por dos
 * frases). Si una frase atribuye algo a un periódico («Según 20minutos, …»), se le quita la
 * atribución (03-10-2026); si tiene un nombre, cifra, fecha o cita sin respaldo, fuera el
 * párrafo. Nunca se publica una frase que el validador no acepte.
 */
export function repairAiParagraphs(blocks: Extract<ArticleBlock, { type: 'p' }>[], fs: FactSheet, base: Draft): Extract<ArticleBlock, { type: 'p' }>[] {
  const media = mediaNames(fs);
  const out: Extract<ArticleBlock, { type: 'p' }>[] = [];
  for (const b of blocks) {
    const text = sentences(b.text)
      .map((x) => stripMediaAttribution(x.trim(), media))
      .join(' ');
    const issues = validateDraft({ ...base, headline: base.headline, body: [{ ...b, text }] }, fs).issues.filter((i) => i.check !== 'headline');
    // Ni párrafos que copian de una fuente más palabras seguidas de las permitidas (control legal).
    if (!issues.length && !copiesSource(text, fs)) out.push({ ...b, text });
  }
  return out;
}

/** ¿Copia el párrafo (sin sus citas literales) más palabras seguidas de una fuente de las permitidas? */
function copiesSource(text: string, fs: FactSheet): boolean {
  const own = text.replace(/[«“"][^»”"]*[»”"]/g, ' ');
  return fs.sourceTexts.some((s) => longestCommonRun(own, s.text) > DEFAULT_EDITORIAL_SETTINGS.maxVerbatimWords);
}

/**
 * ¿Puede esta historia pasar por la IA? No, si alguna de sus piezas viene de un
 * editor que se reserva ese uso (TDM o `Content-Signal: ai-input=no`): entonces
 * se redacta y se adapta solo con el redactor determinista.
 */
export function aiMayUse(items: { reserved?: boolean }[]): boolean {
  return !items.some((i) => i.reserved);
}

const WRITER_SYSTEM = `You are the writing desk of Histor, a news outlet whose first rule is: never publish unverified information as fact.
You receive a FACT SHEET: numbered claims, each with a verification status and the sources that support it.
Write an original news article in the requested language, in the neutral, precise house style of a quality newspaper.

Hard rules:
- Use ONLY information contained in the claims. Add no names, numbers, dates, places, causes, motives or context that are not in the claims.
- Every paragraph must list in "claim_ids" all the claim ids it relies on.
- Claims with status "supported" or "partially_supported" were published by reliable outlets: report them plainly, as a newspaper does. Claims with status "unsupported" are not confirmed: leave them out, or say clearly that they are not yet confirmed ("presuntamente", "todavía sin confirmar"); never present them as established fact.
- NEVER name a newspaper, news agency, TV or radio station, website or any other media outlet anywhere (headline, subheadline, summary, text). Never write "according to [outlet]", "[outlet] reported", "in statements to [outlet]" or "the newspaper said". The sources are listed next to the article and the "verified"/"developing" label goes next to the headline: write as Histor's own reporting.
- Attribute statements to the people or institutions who made them when the claim says so (the police said, the minister announced, the club confirmed; field "said_by"), never to the media that published them.
- Claims of kind "prediction" must stay predictions (future or conditional tense).
- Do not quote anyone verbatim unless the exact words appear in a claim's "quote" field; keep them unchanged and attribute them to that claim's speaker.
- Write in your own words: never copy more than 10 consecutive words from a claim's text (quotes excepted).
- Never use vague attributions either ("according to reports", "sources say", "media reports").
- Never tell the same fact twice with different words.
- Open with the most important confirmed fact (who, what, where, when), then context and details, then reactions and what comes next, like a quality newspaper. Paragraphs of two to four sentences that flow, not one sentence per paragraph.
- "summary" is ONE sentence of at most 35 words; "subheadline" at most 20 words; "headline" at most 14 words.
- The headline must accurately represent the article. No clickbait, no exaggeration, no questions, no exclamation marks. Never put a source or outlet name in the headline (no "according to X"); unconfirmed stories are labelled "developing" next to the headline.
- The reader must understand what happened and why: right after the main fact, give the background and causes that the claims provide (what led to it, who is involved, previous events). Never leave a decision, ruling or reaction without saying what it is about.
- Use the target language's journalistic conventions for dates, numbers, institutions and names.`;

const WRITER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'subheadline', 'summary', 'paragraphs', 'seo_description'],
  properties: {
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    summary: { type: 'string' },
    seo_description: { type: 'string' },
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'claim_ids'],
        properties: { text: { type: 'string' }, claim_ids: { type: 'array', items: { type: 'integer' } } },
      },
    },
  },
} as const;

type WriterOut = { headline: string; subheadline: string; summary: string; seo_description: string; paragraphs: { text: string; claim_ids: number[] }[] };

/** Afirmaciones que se mandan a la IA: las mejor respaldadas primero. Con el cupo gratuito por día, una ficha de 45 afirmaciones gastaba el doble sin dar mejor texto. */
const PROMPT_MAX_CLAIMS = 30;
const PROMPT_MAX_CLAIM_CHARS = 350;
const shorten = (t: string) => (t.length > PROMPT_MAX_CLAIM_CHARS ? `${t.slice(0, PROMPT_MAX_CLAIM_CHARS).replace(/\s+\S*$/, '')}…` : t);

/**
 * Salida máxima que se pide: con AI_REQUEST_TOKEN_CAP (Groq gratuito: entrada + salida contra
 * 8.000 por minuto), lo que deja la entrada estimada (≈ 3,2 caracteres por token, más el esquema).
 * Pedir 8.000 de salida hacía que algunas peticiones no cupieran nunca («Request too large»).
 */
export function outputBudget(system: string, prompt: string, want: number): number {
  const cap = env().AI_REQUEST_TOKEN_CAP;
  if (!cap) return want;
  const input = Math.ceil((system.length + prompt.length) / 3.2) + 500;
  return Math.max(1200, Math.min(want, cap - input));
}

/** La IA a veces copia entidades HTML del texto de las fuentes («&#x27;superinteligencia&#x27;», 01-10-2026). */
function decodeDeep(v: unknown): unknown {
  if (typeof v === 'string') return decodeEntities(v);
  if (Array.isArray(v)) return v.map(decodeDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeDeep(x)]));
  return v;
}

export function factSheetForPrompt(fs: FactSheet): Record<string, unknown> {
  // Sin nombres de medio (03-10-2026): la IA no puede nombrar lo que no ve. Sí quién lo dice
  // dentro de la noticia («said_by»: la Policía, el ministro), si no es un medio.
  const media = mediaNames(fs);
  // Las citas y predicciones se guardan su sitio aunque haya muchas afirmaciones.
  const extras = [...fs.predictions.slice(0, 3), ...fs.quotes.slice(0, 4)];
  const usable = [...[...fs.confirmed, ...fs.attributed, ...fs.unconfirmed].slice(0, PROMPT_MAX_CLAIMS - extras.length), ...extras];
  return {
    language: fs.language,
    status: fs.verified ? 'verified' : 'developing',
    independent_sources: fs.independentCredible,
    claims: usable.map((c) => ({
      id: claimRef(c),
      text: shorten(stripMediaAttribution(c.text, media)),
      status: c.status,
      kind: c.kind,
      sources: c.supporters.length || 1,
      said_by: c.attributedTo && !media.includes(c.attributedTo) ? c.attributedTo : undefined,
      quote: c.quote ?? undefined,
    })),
    key_figures: fs.figures.map((f) => ({ unit: f.unit, value: f.value, approximate: f.approximate, evolving: f.evolving })),
    discrepancies: fs.discrepancies.map((d) => ({ field: d.field, values: d.parts.map((x) => x.value) })),
    event_time: fs.eventTime?.toISOString() ?? null,
  };
}

export async function writeWithLlm(db: Db, fs: FactSheet, opts: WriteOptions & { provider?: LlmProvider | null; storyId?: number | null } = {}): Promise<Draft | null> {
  // Sin borrador determinista (frases demasiado largas…), la IA escribe sobre el armazón.
  const base = writeDeterministic(fs, opts) ?? writeDeterministic(fs, { ...opts, skeleton: true });
  if (!base) return null;
  const writerPrompt = `Target language: ${languageDef(fs.language).name} (${fs.language}).\nFACT SHEET (JSON):\n${JSON.stringify(factSheetForPrompt(fs))}`;
  const res = await callJson(
    db,
    {
      task: 'writing',
      system: WRITER_SYSTEM,
      prompt: writerPrompt,
      schema: WRITER_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: outputBudget(WRITER_SYSTEM, writerPrompt, 5000),
      effort: 'medium',
    },
    { storyId: opts.storyId ?? fs.storyId, provider: opts.provider },
  );
  if (!res?.data) return null;
  const out = decodeDeep(res.data) as WriterOut;
  if (!out.headline || !Array.isArray(out.paragraphs) || !out.paragraphs.length) return null;
  // Texto de la IA + secciones deterministas (datos clave, no confirmado, recuadro de verificación).
  const repaired = repairAiParagraphs(
    out.paragraphs.map((p) => ({ type: 'p' as const, text: p.text.trim(), claimIds: p.claim_ids ?? [] })),
    fs,
    base,
  );
  // Si la reparación deja poco, no merece la pena: mejor el redactor determinista.
  if (repaired.length < 2) return null;
  // Sin el mismo hecho dos veces ni una frase por párrafo (03-10-2026).
  const aiBlocks = tidyParagraphs(repaired) as typeof repaired;
  // Secciones fijas (datos clave, no confirmado, qué puede pasar), sin lo que ya cuenta la IA:
  // «Qué puede pasar ahora» repetía la primera frase del artículo (30-09-2026).
  const told = words(aiBlocks.map((b) => b.text).join(' '));
  const fresh = (t: string) => {
    const w = [...words(t)];
    return !w.length || w.filter((x) => told.has(x)).length / w.length < 0.6;
  };
  const kept = base.body
    .filter((b, i) => b.type === 'h2' || (i > 0 && b.type !== 'p'))
    .map((b) => (b.type === 'list' ? { ...b, items: b.items.filter((it) => fresh(it.text)) } : b))
    .filter((b) => b.type !== 'list' || b.items.length > 0);
  // Un apartado que se ha quedado sin contenido, fuera también.
  const structural = kept.filter((b, i) => b.type !== 'h2' || (kept[i + 1] && kept[i + 1].type !== 'h2'));
  // Entradilla y descripción, también sin periódicos; el subtítulo es el nuestro («Verificada con
  // 3 fuentes independientes»), no el de la IA, que solía nombrarlas.
  const media = mediaNames(fs);
  const noMedia = (t: string | undefined) => (t ? stripMediaAttribution(t.trim(), media) : '');
  return {
    ...base,
    headline: out.headline.trim(),
    subheadline: base.subheadline,
    summary: truncate(noMedia(out.summary) || base.summary, 300),
    seoDescription: truncate(noMedia(out.seo_description) || base.seoDescription, 160),
    seoTitle: truncate(out.headline.trim(), 70),
    body: [...aiBlocks, ...structural],
    writer: `llm:${res.provider}/${res.model}`,
  };
}

const TRANSLATOR_SYSTEM = `You are the international desk of Histor. Adapt a verified news article into another language.
Rules: keep every fact, number, date, name and attribution exactly; do not add or remove information; keep the same number of blocks in the same order;
adapt date/number formats and institution names to local conventions; translate quotations faithfully and keep them attributed to the same person;
keep attributions to people and institutions ("the police said") wherever the original has them; never add the name of a newspaper, agency or any other media outlet. No clickbait.`;

const TRANSLATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'subheadline', 'summary', 'blocks'],
  properties: {
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    summary: { type: 'string' },
    blocks: { type: 'array', items: { type: 'string' } },
  },
} as const;

/**
 * Adapta un borrador ya validado a otro idioma. Se valida que se conserven
 * las cifras de cada bloque y el número de bloques; si no, se descarta.
 */
export async function translateDraft(db: Db, src: Draft, targetLang: string, opts: { provider?: LlmProvider | null; storyId?: number | null } = {}): Promise<Draft | null> {
  const flat = flatten(src.body);
  const translatorPrompt = `From ${src.language} to ${targetLang} (${languageDef(targetLang).name}).\n${JSON.stringify({ headline: src.headline, subheadline: src.subheadline ?? '', summary: src.summary, blocks: flat.map((f) => f.text) })}`;
  const res = await callJson(
    db,
    {
      task: 'translation',
      system: TRANSLATOR_SYSTEM,
      prompt: translatorPrompt,
      schema: TRANSLATOR_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: outputBudget(TRANSLATOR_SYSTEM, translatorPrompt, 5000),
      effort: 'low',
    },
    { storyId: opts.storyId, provider: opts.provider },
  );
  const out = (res?.data ? decodeDeep(res.data) : undefined) as { headline: string; subheadline: string; summary: string; blocks: string[] } | undefined;
  if (!out || !Array.isArray(out.blocks) || out.blocks.length !== flat.length) return null;
  // Cifras conservadas bloque a bloque.
  for (let i = 0; i < flat.length; i++) {
    const a = extractNumbers(flat[i].text, src.language).map((n) => n.value).sort();
    const b = extractNumbers(out.blocks[i], targetLang).map((n) => n.value).sort();
    if (a.filter((x) => x >= 10).join('|') !== b.filter((x) => x >= 10).join('|')) return null;
  }
  const body = unflatten(src.body, out.blocks);
  return {
    ...src,
    language: targetLang,
    headline: out.headline.trim(),
    subheadline: out.subheadline?.trim() || null,
    summary: truncate(out.summary.trim(), 300),
    seoTitle: truncate(out.headline.trim(), 70),
    seoDescription: truncate(out.summary.trim(), 160),
    body,
    writer: `llm-translation:${res!.provider}/${res!.model}`,
    boilerplate: [],
  };
}

function flatten(body: ArticleBlock[]): { text: string }[] {
  const out: { text: string }[] = [];
  for (const b of body) {
    if (b.type === 'list') for (const it of b.items) out.push({ text: it.text });
    else out.push({ text: b.text });
  }
  return out;
}

function unflatten(body: ArticleBlock[], texts: string[]): ArticleBlock[] {
  let i = 0;
  return body.map((b) => {
    if (b.type === 'list') return { ...b, items: b.items.map((it) => ({ ...it, text: texts[i++] })) };
    return { ...b, text: texts[i++] } as ArticleBlock;
  });
}

/** Palabras con peso de un texto (más de 4 letras, sin acentos). */
function words(s: string): Set<string> {
  return new Set(fold(s).split(/\W+/).filter((w) => w.length > 4));
}
