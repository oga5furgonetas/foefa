import type { ArticleBlock, VerificationBox } from '../db/schema';

/** Borrador de artículo en un idioma, antes de los controles de calidad. */
export type Draft = {
  language: string;
  headline: string;
  subheadline: string | null;
  summary: string;
  body: ArticleBlock[];
  verification: VerificationBox;
  seoTitle: string;
  seoDescription: string;
  /** template | llm:<proveedor>/<modelo> | llm-translation:<…> */
  writer: string;
  isDeveloping: boolean;
  timeline: { at: string; text: string }[];
  /** Frases de servicio (método, "seguiremos informando") exentas de cita. */
  boilerplate: string[];
};

export function draftPlainText(d: Pick<Draft, 'headline' | 'subheadline' | 'body'>): string {
  const parts: string[] = [d.headline];
  if (d.subheadline) parts.push(d.subheadline);
  for (const b of d.body) {
    if (b.type === 'p' || b.type === 'h2') parts.push(b.text);
    else if (b.type === 'quote') parts.push(`«${b.text}» — ${b.speaker}`);
    else if (b.type === 'list') parts.push(...b.items.map((i) => i.text));
  }
  return parts.join('\n');
}

export function bodyText(body: ArticleBlock[]): string {
  return draftPlainText({ headline: '', subheadline: null, body }).trim();
}
