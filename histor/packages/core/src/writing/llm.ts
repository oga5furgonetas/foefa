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
import { extractNumbers } from '../text/numbers';
import { truncate } from '../text/normalize';
import { claimRef, writeDeterministic, type WriteOptions } from './deterministic';
import type { Draft } from './draft';
import type { FactSheet } from './factsheet';

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
- Claims with status "supported" may be stated as facts. Claims with status "partially_supported" or "unsupported" must always be attributed to their source ("according to X", "X reported") and never stated as established fact.
- Claims of kind "prediction" must stay predictions (future or conditional tense, attributed).
- Do not quote anyone verbatim unless the exact words appear in a claim's "quote" field; keep them unchanged and attribute them to that claim's speaker.
- Write in your own words: never copy more than 10 consecutive words from a claim's text (quotes excepted).
- If the story is "developing", say so plainly and attribute everything that is not confirmed.
- The headline must accurately represent the article. No clickbait, no exaggeration, no questions, no exclamation marks.
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

export function factSheetForPrompt(fs: FactSheet): Record<string, unknown> {
  const usable = [...fs.confirmed, ...fs.attributed, ...fs.unconfirmed, ...fs.predictions, ...fs.quotes];
  return {
    language: fs.language,
    status: fs.verified ? 'verified' : 'developing',
    independent_sources: fs.independentCredible,
    claims: usable.map((c) => ({
      id: claimRef(c),
      text: c.text,
      status: c.status,
      kind: c.kind,
      sources: c.attribution,
      quote: c.quote ?? undefined,
    })),
    key_figures: fs.figures.map((f) => ({ unit: f.unit, value: f.value, approximate: f.approximate, sources: f.sources, evolving: f.evolving })),
    discrepancies: fs.discrepancies,
    event_time: fs.eventTime?.toISOString() ?? null,
  };
}

export async function writeWithLlm(db: Db, fs: FactSheet, opts: WriteOptions & { provider?: LlmProvider | null; storyId?: number | null } = {}): Promise<Draft | null> {
  const base = writeDeterministic(fs, opts);
  if (!base) return null;
  const res = await callJson(
    db,
    {
      task: 'writing',
      system: WRITER_SYSTEM,
      prompt: `Target language: ${languageDef(fs.language).name} (${fs.language}).\nFACT SHEET (JSON):\n${JSON.stringify(factSheetForPrompt(fs), null, 1)}`,
      schema: WRITER_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 6000,
      effort: 'medium',
    },
    { storyId: opts.storyId ?? fs.storyId, provider: opts.provider },
  );
  if (!res?.data) return null;
  const out = res.data as WriterOut;
  if (!out.headline || !Array.isArray(out.paragraphs) || !out.paragraphs.length) return null;
  // Texto de la IA + secciones deterministas (datos clave, no confirmado, recuadro de verificación).
  const aiBlocks: ArticleBlock[] = out.paragraphs.map((p) => ({ type: 'p', text: p.text.trim(), claimIds: p.claim_ids ?? [] }));
  const structural = base.body.filter((b, i) => b.type === 'h2' || (i > 0 && b.type !== 'p'));
  return {
    ...base,
    headline: out.headline.trim(),
    subheadline: out.subheadline?.trim() || base.subheadline,
    summary: truncate(out.summary?.trim() || base.summary, 300),
    seoDescription: truncate(out.seo_description?.trim() || base.seoDescription, 160),
    seoTitle: truncate(out.headline.trim(), 70),
    body: [...aiBlocks, ...structural],
    writer: `llm:${res.provider}/${res.model}`,
  };
}

const TRANSLATOR_SYSTEM = `You are the international desk of Histor. Adapt a verified news article into another language.
Rules: keep every fact, number, date, name and attribution exactly; do not add or remove information; keep the same number of blocks in the same order;
adapt date/number formats and institution names to local conventions; translate quotations faithfully and keep them attributed to the same person;
keep attributions ("according to X") wherever the original has them. No clickbait.`;

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
  const res = await callJson(
    db,
    {
      task: 'translation',
      system: TRANSLATOR_SYSTEM,
      prompt: `From ${src.language} to ${targetLang} (${languageDef(targetLang).name}).\n${JSON.stringify({ headline: src.headline, subheadline: src.subheadline ?? '', summary: src.summary, blocks: flat.map((f) => f.text) })}`,
      schema: TRANSLATOR_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 8000,
      effort: 'low',
    },
    { storyId: opts.storyId, provider: opts.provider },
  );
  const out = res?.data as { headline: string; subheadline: string; summary: string; blocks: string[] } | undefined;
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
