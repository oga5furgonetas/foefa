import { fold } from './normalize';

/**
 * Detecta de quién procede realmente una información. Si diez medios
 * publican "según EFE…", eso es UNA fuente (EFE), no diez. Este módulo es
 * la primera defensa contra la falsa corroboración.
 */

/** Agencias y orígenes frecuentes → nombre canónico. */
export const KNOWN_ORIGINS: Record<string, string[]> = {
  Reuters: ['reuters'],
  'Associated Press': ['associated press', 'ap'],
  AFP: ['afp', 'agence france-presse', 'france-presse', 'agence france presse'],
  EFE: ['efe', 'agencia efe'],
  'Europa Press': ['europa press'],
  dpa: ['dpa', 'deutsche presse-agentur'],
  ANSA: ['ansa'],
  'Agência Brasil': ['agencia brasil'],
  Lusa: ['lusa', 'agencia lusa'],
  Bloomberg: ['bloomberg'],
  'Xinhua': ['xinhua'],
  'Interfax': ['interfax'],
  'TASS': ['tass'],
  'Anadolu': ['anadolu', 'anadolu agency'],
  'Kyodo': ['kyodo'],
  'PA Media': ['pa media', 'press association'],
  'Colpisa': ['colpisa'],
  'Servimedia': ['servimedia'],
  'Notimex': ['notimex'],
  'Télam': ['telam'],
  'SDA': ['sda', 'keystone-sda'],
  'APA': ['apa', 'austria presse agentur'],
  'epd': ['epd'],
  'KNA': ['kna'],
  'AGI': ['agi'],
  'Adnkronos': ['adnkronos'],
};

const INTRO =
  '(?:segun|de acuerdo con|informa|ha informado|informo|recoge|citado por|according to|as reported by|reported by|reports|citing|via|laut|nach angaben|berichtet|berichtete|zufolge|selon|rapporte|a rapporte|d apres|secondo|riferisce|riporta|segundo|de acordo com|informou|citada pela|citado pela)';

function originFromToken(tok: string): string | null {
  const t = fold(tok).replace(/[^\p{L}\s.-]/gu, '').trim();
  for (const [canon, aliases] of Object.entries(KNOWN_ORIGINS)) {
    if (aliases.includes(t)) return canon;
  }
  return null;
}

/**
 * Quita la firma de agencia del principio de una frase: «MADRID, 29 Sep. (EUROPA PRESS) -»,
 * «WASHINGTON (AP) —», «Ciudad de México, 29 sep (EFE).-» o, ya sin la agencia, «MADRID, 29 ».
 * Sin esto la noticia empezaba «MADRID, 29 OpenAI ha decidido…». Es prudente: solo con una
 * agencia conocida entre paréntesis o con la ciudad en mayúsculas seguida del día.
 */
export function stripDateline(text: string): string {
  const withOrigin = text.match(/^([\p{L}\d\s,.'’-]{0,60})\(([\p{L}][\p{L}\s.-]{1,30})\)\s*\.?\s*[-—–:]\s*/u);
  if (withOrigin && (originFromToken(withOrigin[2]) || /^\p{Lu}[\p{Lu}\s.'’-]{2,}/u.test(withOrigin[1]))) {
    const rest = text.slice(withOrigin[0].length);
    if (rest.length > 20) return rest;
  }
  const bare = text.match(/^\p{Lu}[\p{Lu}\s.'’-]{2,40},\s*\d{1,2}(?:\.|\s+\p{L}{3,10}\.?)?\s+(?=\p{Lu})/u);
  if (bare && text.length - bare[0].length > 20) return text.slice(bare[0].length);
  // Solo la agencia, sin ciudad: «AGI - Todavía no se conoce…», «EFE.- El Gobierno…».
  const agencyOnly = text.match(/^([\p{L}][\p{L}\s]{1,20}?)\s*\.?\s*[-—–]\s+(?=\p{Lu})/u);
  if (agencyOnly && originFromToken(agencyOnly[1]) && text.length - agencyOnly[0].length > 20) return text.slice(agencyOnly[0].length);
  return text;
}

/**
 * Solo las señales fuertes de que TODA la pieza es de una agencia: la firma del principio
 * («MADRID, 29 (EUROPA PRESS) -») o el crédito final («(EFE)»). Para el artículo completo:
 * un «según EFE» en el tercer párrafo atribuye un dato, no la pieza entera.
 */
export function wireOrigin(text: string): string | null {
  const dateline = text.slice(0, 200).match(/^[\p{Lu}\p{L}\d\s,.'’-]{0,60}\(([\p{L}][\p{L}\s.-]{1,30})\)\s*[-—–:.]/u);
  const o = dateline ? originFromToken(dateline[1]) : null;
  if (o) return o;
  const credit = text.slice(-120).match(/[(—–-]\s*([\p{L}][\p{L}\s.-]{1,25})\s*\)?\s*$/u);
  return credit ? originFromToken(credit[1]) : null;
}

/**
 * Devuelve el origen citado (canónico si es una agencia conocida, o el
 * nombre tal cual si es otra fuente citada explícitamente), o null.
 */
export function detectAttribution(text: string): string | null {
  const head = text.slice(0, 600);
  // Firma de agencia: "MADRID (EFE) —", "(Reuters) -", "BERLIN (dpa) -" y con fecha:
  // "MADRID, 29 Sep. (EUROPA PRESS) -", "BERLIN, 29. September (dpa) -".
  const dateline = head.match(/^[\p{Lu}\p{L}\d\s,.'’-]{0,60}\(([\p{L}][\p{L}\s.-]{1,30})\)\s*[-—–:.]/u);
  if (dateline) {
    const o = originFromToken(dateline[1]);
    if (o) return o;
  }
  const f = fold(head).replace(/['’]/g, ' ');
  const re = new RegExp(`(?:${INTRO}\\s+){1,2}(?:la |el |l |the |der |die |il |a |o )?(?:agencia |agency |nachrichtenagentur |agence |agenzia |agencia de noticias )?([\\p{L}][\\p{L}.-]*(?:\\s+[\\p{L}][\\p{L}.-]*){0,2})`, 'u');
  const m = f.match(re);
  if (m) {
    const words = m[1].split(/\s+/);
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      const o = originFromToken(words.slice(0, n).join(' '));
      if (o) return o;
    }
  }
  // Crédito al final: "(EFE)", "— Reuters"
  const tail = text.slice(-120);
  const credit = tail.match(/[(—–-]\s*([\p{L}][\p{L}\s.-]{1,25})\s*\)?\s*$/u);
  if (credit) {
    const o = originFromToken(credit[1]);
    if (o) return o;
  }
  return null;
}
