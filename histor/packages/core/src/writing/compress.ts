/**
 * Compresión segura de una afirmación: quita la coletilla de atribución y
 * las subordinadas explicativas SOLO en fronteras de cláusula. Si no se
 * puede dejar por debajo del límite sin cortar a mitad de idea, devuelve
 * null y la afirmación no se usa (nunca se trunca con "…": podría cambiar
 * el sentido, p. ej. perder una negación).
 */
import { words } from '../text/tokenize';

const ATTRIBUTION_TAIL =
  /[,;]?\s*(según|de acuerdo con|informó|ha informado|informa|confirmó|ha confirmado|explicó|señaló|indicó|dijo|according to|said|reported|reports|confirmed|laut|berichtete|teilte .* mit|selon|a indiqué|a annoncé|secondo|ha riferito|segundo|informou|disse)\b[^.;]*$/i;

export function compressClaim(text: string, maxWords = 22): string | null {
  let s = text.replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '');
  // Paréntesis explicativos
  s = s.replace(/\s*\([^)]{0,80}\)/g, '');
  // Coletilla de atribución al final (la atribución la ponemos nosotros)
  const tail = s.match(ATTRIBUTION_TAIL);
  if (tail && words(s.slice(0, tail.index)).length >= 6) s = s.slice(0, tail.index).trim();
  if (words(s).length <= maxWords) return clean(s);
  // Cortar en la primera frontera de cláusula que deje una idea completa.
  const boundaries = [/;\s/, /\s—\s/, /\s–\s/, /,\s(que|which|who|where|donde|cuando|lo que|mientras|while|whereas|der|die|das|wobei|qui|où|dont|che|dove|mentre|onde|enquanto)\s/i];
  for (const b of boundaries) {
    const m = s.match(b);
    if (m && m.index != null) {
      const head = s.slice(0, m.index).trim();
      const n = words(head).length;
      if (n >= 8 && n <= maxWords) return clean(head);
    }
  }
  // Última coma antes del límite, si deja una oración con sentido (≥ 8 palabras).
  const ws = s.split(' ');
  for (let i = Math.min(ws.length, maxWords) - 1; i >= 8; i--) {
    if (/,$/.test(ws[i - 1]) || /,$/.test(ws[i])) {
      const head = ws.slice(0, i).join(' ').replace(/,$/, '');
      if (words(head).length >= 8) return clean(head);
    }
  }
  return null;
}

function clean(s: string): string {
  const out = s.replace(/[,;:\s]+$/, '').trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Primera letra en minúscula solo si es un artículo/determinante (nunca un nombre propio). */
export function lowerFirst(s: string): string {
  const first = s.split(' ')[0] ?? '';
  if (/^(El|La|Los|Las|Un|Una|Unos|Unas|The|A|An|Der|Die|Das|Ein|Eine|Le|Les|Une|Des|Il|Lo|Gli|I|O|Os|As|Um|Uma|Al|Del|Este|Esta|This|These)$/.test(first)) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  return s;
}
