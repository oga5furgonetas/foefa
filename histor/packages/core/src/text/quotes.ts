import { fold } from './normalize';

/**
 * Citas textuales. Histor nunca inventa una cita: toda cita que aparezca en
 * un artículo debe existir, palabra por palabra (salvo espacios y comillas),
 * en al menos una fuente, y atribuida a la misma persona.
 */

export type ExtractedQuote = { text: string; speaker: string | null; raw: string };

const PAIRS: [string, string][] = [
  ['«', '»'],
  ['“', '”'],
  ['„', '“'],
  ['„', '”'],
  ['‹', '›'],
  ['"', '"'],
];

const SPEECH_VERBS =
  '(?:dijo|ha dicho|afirmó|ha afirmado|aseguró|ha asegurado|declaró|explicó|señaló|indicó|añadió|advirtió|manifestó|said|says|told|added|stated|warned|explained|sagte|erklärte|betonte|sagt|so|a déclaré|a dit|a affirmé|a expliqué|a ajouté|déclare|a detto|ha dichiarato|ha affermato|ha spiegato|ha aggiunto|disse|afirmou|declarou|explicou|acrescentou|destacou)';

const NAME = "((?:[\\p{Lu}][\\p{L}'’.-]+)(?:\\s+(?:de|del|la|von|van|der|di|da|dos|das|le|du|y)?\\s*[\\p{Lu}][\\p{L}'’.-]+){0,3})";

export function extractQuotes(text: string): ExtractedQuote[] {
  const out: ExtractedQuote[] = [];
  for (const [open, close] of PAIRS) {
    let from = 0;
    while (true) {
      const i = text.indexOf(open, from);
      if (i < 0) break;
      const j = text.indexOf(close, i + 1);
      if (j < 0) break;
      const inner = text.slice(i + 1, j).trim();
      from = j + 1;
      // Menos de 4 palabras suele ser un término entrecomillado, no una cita.
      if (inner.split(/\s+/).length < 4 || inner.length > 600) continue;
      if (out.some((q) => q.text === inner)) continue;
      const after = text.slice(j + 1, j + 140);
      const before = text.slice(Math.max(0, i - 160), i);
      out.push({ text: inner, speaker: findSpeaker(before, after), raw: text.slice(i, j + 1) });
    }
  }
  return out;
}

function findSpeaker(before: string, after: string): string | null {
  // «…», dijo Ana Pérez   |  "…," said John Smith  |  "…", sagte Olaf Scholz
  const a = after.match(new RegExp(`^[\\s,.:;—-]*${SPEECH_VERBS}\\s+(?:el|la|the|der|die|le|il|o|a)?\\s*(?:\\p{Ll}+\\s+){0,3}?${NAME}`, 'u'));
  if (a) return a[1].trim();
  // Ana Pérez dijo: «…»  |  John Smith said: "…"
  const b = before.match(new RegExp(`${NAME}\\s+${SPEECH_VERBS}\\s*(?:que)?[:,]?\\s*$`, 'u'));
  if (b) return b[1].trim();
  // Según Ana Pérez, «…»
  const c = before.match(new RegExp(`(?:según|according to|laut|selon|secondo|segundo)\\s+${NAME}[,:]?\\s*$`, 'u'));
  if (c) return c[1].trim();
  return null;
}

/** Forma canónica para comparar citas: plegado, sin puntuación ni espacios extra. */
export function quoteKey(q: string): string {
  return fold(q)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿La cita `candidate` aparece literalmente dentro de algún texto de las fuentes? */
export function quoteAppearsIn(candidate: string, sourceTexts: string[]): boolean {
  const k = quoteKey(candidate);
  if (!k) return false;
  return sourceTexts.some((t) => quoteKey(t).includes(k));
}

/** ¿Dos nombres de hablante son la misma persona? ("Pedro Sánchez" ~ "Sánchez") */
export function sameSpeaker(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const ta = fold(a).split(/\s+/).filter((w) => w.length > 2);
  const tb = fold(b).split(/\s+/).filter((w) => w.length > 2);
  if (!ta.length || !tb.length) return false;
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  if (lastA !== lastB) return false;
  // Si ambos tienen nombre de pila y no coinciden, son personas distintas.
  if (ta.length > 1 && tb.length > 1 && ta[0] !== tb[0]) return false;
  return true;
}
