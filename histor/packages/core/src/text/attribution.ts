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
 * Devuelve el origen citado (canónico si es una agencia conocida, o el
 * nombre tal cual si es otra fuente citada explícitamente), o null.
 */
export function detectAttribution(text: string): string | null {
  const head = text.slice(0, 600);
  // Firma de agencia: "MADRID (EFE) —", "(Reuters) -", "BERLIN (dpa) -"
  const dateline = head.match(/^[\p{Lu}\p{L}\s,.'’-]{0,60}\(([\p{L}][\p{L}\s.-]{1,30})\)\s*[-—–:]/u);
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
