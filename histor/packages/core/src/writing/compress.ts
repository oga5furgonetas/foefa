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

export function compressClaim(text: string, maxWords = 22, opts: { commaCut?: boolean } = {}): string | null {
  let s = text.replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '');
  // Paréntesis explicativos
  s = s.replace(/\s*\([^)]{0,80}\)/g, '');
  // Coletilla de atribución al final (la atribución la ponemos nosotros)
  const tail = s.match(ATTRIBUTION_TAIL);
  if (tail && words(s.slice(0, tail.index)).length >= 6) s = s.slice(0, tail.index).trim();
  if (words(s).length <= maxWords) return clean(s);
  // Cortar SOLO en fronteras seguras que dejen una idea completa. Nunca en una coma
  // cualquiera: «O número de palestinianos mortos na Faixa de Gaza, em consequência da
  // ofensiva militar de Israel» (27-09-2026) había perdido «ultrapassou os 74.000».
  const boundaries = [/;\s/, /\s—\s/, /\s–\s/, /,\s(que|which|who|where|donde|cuando|lo que|mientras|while|whereas|der|die|das|wobei|qui|où|dont|che|dove|mentre|onde|enquanto)\s/i];
  for (const [bi, b] of boundaries.entries()) {
    const m = s.match(b);
    if (!m || m.index == null) continue;
    const head = s.slice(0, m.index).trim();
    const rest = s.slice(m.index + m[0].length);
    // Una oración de relativo que se cierra y sigue («X, que dura tres años, ultrapassou…»)
    // es un inciso del sujeto: lo de delante no tiene el verbo principal.
    if (bi === boundaries.length - 1 && rest.includes(', ')) continue;
    const n = words(head).length;
    if (n >= 8 && n <= maxWords && complete(head)) return clean(head);
  }
  // Titulares: aquí se acaba (nada de quedarse con la oración principal suelta).
  if (opts.commaCut === false) return null;
  // Empieza por una subordinada («While in Washington…, Xi announced…»): lo que va delante
  // de la coma no tiene verbo principal; se queda la oración principal, si cabe.
  if (INTRO.test(s)) {
    const comma = s.indexOf(', ');
    const main = comma > 0 ? s.slice(comma + 2).trim() : '';
    const n = words(main).length;
    if (n >= 8 && n <= maxWords && complete(main) && !main.includes(', ')) return clean(main);
  }
  // Si no cabe entera sin cortar a mitad de idea, la afirmación no se usa.
  return null;
}

/** Sin final colgante, relativo abierto ni «that while…» sin su verbo. */
function complete(head: string): boolean {
  return !DANGLING.test(head) && !OPEN_RELATIVE.test(head) && !OPEN_SUBORDINATE.test(head);
}

/** Lo último es una oración de relativo abierta tras coma: falta el predicado principal. */
const OPEN_RELATIVE = /,\s(qui|que|which|who|whom|whose|der|die|das|welche|welcher|welches|che|cui|quien|quienes|cuyo|cuya|cuyos|cuyas|donde|onde|où|dont)\s[^,]*$/i;

/**
 * «…that while X, Y»: la oración que abre «that» no tiene verbo hasta después de la coma
 * («Iranian officials that while they were aware…, they had not received…»).
 */
const OPEN_SUBORDINATE = /\b(that|que|dass|che)\s+(while|although|though|because|when|if|since|mientras|aunque|porque|cuando|si|obwohl|weil|wenn|während|bien que|parce que|quand|lorsque|mentre|perché|quando|se|embora|enquanto)\b[^,]*$/i;

/** Final que deja la frase colgando (preposición, conjunción o adverbio que anuncia lo que sigue). */
const DANGLING =
  /(?:^|\s)(davor|darauf|dafür|dazu|daran|damit|darüber|davon|dagegen|dass|zu|um|und|aber|oder|that|to|of|for|with|from|and|but|or|than|que|de|a|para|con|y|pero|o|sin|à|pour|et|mais|avec|che|di|per|e|ma|con|mas|com|em|ao)$/i;

/** Subordinada o complemento inicial que no se sostiene sola hasta la primera coma. */
const INTRO =
  /^(while|when|after|before|although|though|as|because|if|since|despite|during|following|once|unless|until|mientras|cuando|tras|después de|antes de|aunque|si|durante|pese a|a pesar de|ya que|porque|während|als|nachdem|bevor|obwohl|wenn|weil|seit|trotz|pendant|lorsque|quand|après|avant|bien que|malgré|comme|puisque|mentre|quando|dopo|prima di|sebbene|benché|se|nonostante|poiché|enquanto|após|embora|apesar de)\b/i;

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
