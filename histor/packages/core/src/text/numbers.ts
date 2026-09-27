import { fold } from './normalize';

/**
 * Extracción de cifras con su unidad. Es la base del control de cifras:
 * una cifra solo se publica si una fuente la respalda, y dos fuentes que dan
 * cifras distintas para la misma magnitud se marcan como contradicción.
 */

export type ExtractedNumber = {
  value: number;
  /** Clase de magnitud normalizada ("deaths", "percent", "currency:EUR", "magnitude"…) o null. */
  unit: string | null;
  raw: string;
  /** Es aproximada ("más de", "unos", "about", "rund"). */
  approximate: boolean;
};

/** Sustantivos que definen la magnitud, en los 6 idiomas (plegados, con prefijos*). */
const UNIT_LEXICON: [string, string[]][] = [
  ['deaths', ['muert*', 'fallecid*', 'victimas mortales', 'dead', 'deaths', 'killed', 'tote', 'toten', 'todesopfer', 'morts', 'morti', 'mortos', 'vittime', 'vitimas']],
  ['injured', ['herid*', 'injured', 'wounded', 'verletzt*', 'blesses', 'feriti', 'feridos', 'lesionad*']],
  ['missing', ['desaparecid*', 'missing', 'vermisst*', 'disparus', 'dispersi', 'desaparecidos']],
  ['evacuated', ['evacuad*', 'evacuated', 'evakuiert*', 'evacues', 'evacuati', 'evacuados', 'desalojad*', 'desalojados']],
  ['arrested', ['detenid*', 'arrested', 'arrests', 'festgenommen*', 'interpelles', 'arrestati', 'arrestad*', 'presos', 'detidos']],
  ['people', ['personas', 'people', 'persons', 'menschen', 'personen', 'personnes', 'persone', 'pessoas', 'habitantes', 'residents', 'einwohner', 'abitanti']],
  ['homes', ['viviendas', 'casas', 'homes', 'houses', 'hauser', 'wohnungen', 'logements', 'maisons', 'abitazioni', 'case', 'moradias']],
  ['jobs', ['empleos', 'puestos de trabajo', 'jobs', 'arbeitsplatze', 'stellen', 'emplois', 'postes', 'posti di lavoro', 'empregos', 'vagas']],
  ['votes', ['votos', 'votes', 'stimmen', 'voix', 'voti']],
  ['seats', ['escanos', 'seats', 'sitze', 'mandate', 'sieges', 'seggi', 'cadeiras', 'assentos']],
  ['magnitude', ['magnitud', 'magnitude', 'starke', 'grados en la escala', 'richter']],
  ['km', ['km', 'kilometros', 'kilometres', 'kilometers', 'kilometer', 'chilometri', 'quilometros']],
  ['celsius', ['grados', '°c', 'ºc', 'degrees', 'grad', 'degres', 'gradi', 'graus']],
  ['years_old', ['anos de edad', 'years old', 'jahre alt', 'ans', 'anni', 'anos']],
  ['vehicles', ['vehiculos', 'coches', 'vehicles', 'cars', 'fahrzeuge', 'autos', 'vehicules', 'veicoli', 'veiculos', 'carros']],
  ['flights', ['vuelos', 'flights', 'fluge', 'vols', 'voli', 'voos']],
  ['hectares', ['hectareas', 'hectares', 'hektar', 'ettari']],
];

const CURRENCY_SYMBOLS: [RegExp, string][] = [
  [/€|\beuros?\b|\beur\b/, 'EUR'],
  [/\$|\bdolares\b|\bdollars?\b|\busd\b|\bdollar\b/, 'USD'],
  [/£|\blibras?\b|\bpounds?\b|\bgbp\b|\bpfund\b|\bsterline\b/, 'GBP'],
  [/\breais\b|\breal\b|r\$|\bbrl\b/, 'BRL'],
  [/\bpesos?\b|\bmxn\b/, 'PESO'],
  [/\byenes\b|\byen\b|¥|\bjpy\b/, 'JPY'],
  [/\bfrancos? suizos?\b|\bchf\b|\bfranken\b/, 'CHF'],
];

const MULTIPLIERS: [RegExp, number][] = [
  [/^(billones|trillion|trillions|billionen|billions de milliards|trilioni|trilhoes|trilhao)\b/, 1e12],
  [/^(mil millones|miles de millones|billion|billions|bn|milliarden|mrd|milliards?|miliardi|miliardo|bilhoes|bilhao|mil milhoes)\b/, 1e9],
  [/^(millones|millon|million|millions|mio|mln|m\b|millionen|milioni|milione|milhoes|milhao)\b/, 1e6],
  [/^(mil|thousand|thousands|k\b|tausend|mille|mila|milhares)\b/, 1e3],
];

const APPROX_RE = /(mas de|menos de|cerca de|unos|unas|alrededor de|aproximadamente|casi|hasta|over|more than|less than|about|around|nearly|almost|up to|approximately|roughly|mehr als|weniger als|rund|etwa|fast|bis zu|ungefahr|plus de|moins de|environ|pres de|presque|jusqu a|oltre|meno di|circa|quasi|fino a|mais de|menos de|cerca de|quase|ate)\s*$/;

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, one: 1, ein: 1, eine: 1, une: 1, um: 1, uma: 1,
  dos: 2, two: 2, zwei: 2, deux: 2, due: 2, dois: 2, duas: 2,
  tres: 3, three: 3, drei: 3, trois: 3, tre: 3, 'três': 3,
  cuatro: 4, four: 4, vier: 4, quatre: 4, quattro: 4, quatro: 4,
  cinco: 5, five: 5, funf: 5, cinq: 5, cinque: 5,
  seis: 6, six: 6, sechs: 6, sei: 6,
  siete: 7, seven: 7, sieben: 7, sept: 7, sette: 7, sete: 7,
  ocho: 8, eight: 8, acht: 8, huit: 8, otto: 8, oito: 8,
  nueve: 9, nine: 9, neun: 9, neuf: 9, nove: 9,
  diez: 10, ten: 10, zehn: 10, dix: 10, dieci: 10, dez: 10,
  doce: 12, twelve: 12, zwolf: 12, douze: 12, dodici: 12,
  veinte: 20, twenty: 20, zwanzig: 20, vingt: 20, venti: 20, vinte: 20,
  cien: 100, cientos: 100, hundred: 100, hundert: 100, cent: 100, cento: 100, cem: 100,
};

/**
 * Parsea un número con separadores de cualquiera de los idiomas:
 * "1.200" (es/de/it/pt) = 1200; "1,200" (en) = 1200; "3,5" = 3.5; "3.5" = 3.5.
 */
export function parseLocaleNumber(raw: string, lang?: string): number | null {
  const s = raw.replace(/[\s  ']/g, '');
  if (!/^\d/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let norm = s;
  if (dots && commas) {
    // El último separador es el decimal.
    norm = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (commas === 1 && !dots) {
    // "1,200": miles en inglés (o idioma desconocido); "3,5": decimal en el resto.
    const after = s.split(',')[1];
    norm = after.length === 3 && (lang === 'en' || !lang) ? s.replace(',', '') : s.replace(',', '.');
  } else if (commas > 1) {
    norm = s.replace(/,/g, '');
  } else if (dots === 1 && !commas) {
    const after = s.split('.')[1];
    // "1.200" en es/de/it/pt/fr = mil doscientos; en inglés = 1.2
    if (after.length === 3 && lang !== 'en') norm = s.replace('.', '');
  } else if (dots > 1) {
    norm = s.replace(/\./g, '');
  }
  const v = Number(norm);
  return Number.isFinite(v) ? v : null;
}

function unitFromContext(after: string, before: string, originalAfter = ''): string | null {
  const a = after.slice(0, 48);
  if (/^\s*(%|por ciento|per cent|percent|prozent|pour cent|per cento|por cento)/.test(a)) return 'percent';
  if (/^\s*(puntos? porcentuales|percentage points?|prozentpunkte|points? de pourcentage|punti percentuali|pontos percentuais)/.test(a))
    return 'percentage_points';
  // Moneda solo si va pegada a la cifra: "€2,5", "2,5 millones de euros", "$1.2bn".
  const firstWord = a.replace(/^[\s]+/, '').split(/[\s,.;:()]+/).slice(0, 2).join(' ');
  for (const [re, code] of CURRENCY_SYMBOLS) {
    if (re.test(before.slice(-3)) || re.test(firstWord)) return `currency:${code}`;
  }
  // "magnitud 6,2" (la unidad va delante)
  if (/(magnitud|magnitude|starke|magnitudo)\s*(de\s*|di\s*|von\s*)?$/.test(before.slice(-24))) return 'magnitude';
  // Palabras que siguen a la cifra, hasta la siguiente cifra.
  const words: string[] = [];
  for (const w of a.replace(/^[\s,.:;]+/, '').split(/[\s,.;:()]+/).slice(0, 4)) {
    if (/\d/.test(w)) break;
    words.push(w);
  }
  for (const [unit, stems] of UNIT_LEXICON) {
    for (const stem of stems) {
      const multi = stem.includes(' ');
      if (multi) {
        if (a.replace(/^\s+/, '').startsWith(stem.replace('*', ''))) return unit;
        continue;
      }
      for (const w of words.slice(0, 3)) {
        if (stem.endsWith('*') ? w.startsWith(stem.slice(0, -1)) : w === stem) return unit;
      }
    }
  }
  // Magnitud desconocida: el sustantivo que sigue hace de "pseudounidad"
  // ("12.000 corredores" → n:corred), para poder comparar entre fuentes.
  const noun = words.find((w) => w.length >= 4 && /^\p{L}+$/u.test(w) && !PSEUDO_STOP.has(w));
  if (noun && words.indexOf(noun) <= 1) {
    // Un nombre propio ("25 London libraries") no es una magnitud.
    const orig = originalAfter.split(/[\s,.;:()]+/).filter(Boolean);
    const o = orig.find((w) => fold(w) === noun);
    if (o && /^\p{Lu}/u.test(o)) return null;
    return `n:${noun.slice(0, 6)}`;
  }
  return null;
}

const PSEUDO_STOP = new Set(
  'segun laut selon secondo segundo according durante mientras while wahrend pendant mentre enquanto para pero como sobre entre desde hasta tras segun durante contra este esta that with from this than over into about after before under their there than more less mais para pela pelo como sobre entre sont avec dans pour plus moins sous nach nicht sind eine einer unter uber oder aber noch sono della delle degli come nelle sulla tutti anni years jahre annees anni anos horas hours stunden heures minuti minutos minutes dias days tage jours giorni vezes times veces fois volte'.split(' '),
);

export function extractNumbers(text: string, lang?: string): ExtractedNumber[] {
  const f = fold(text);
  const out: ExtractedNumber[] = [];
  const re = /(?<![\p{L}\d])(\d{1,3}(?:[.,\s ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?![\p{L}\d])/gu;
  for (const m of f.matchAll(re)) {
    const idx = m.index ?? 0;
    const rawNum = m[1];
    // Saltar años y horas: "2026", "14:30", fechas dd/mm.
    const around = f.slice(Math.max(0, idx - 1), idx + rawNum.length + 1);
    if (/^\d{4}$/.test(rawNum) && +rawNum >= 1900 && +rawNum <= 2100) continue;
    if (/[:/]/.test(around)) continue;
    let value = parseLocaleNumber(rawNum, lang);
    if (value == null) continue;
    const after = f.slice(idx + rawNum.length);
    const before = f.slice(Math.max(0, idx - 40), idx);
    let consumed = '';
    for (const [mre, mult] of MULTIPLIERS) {
      const mm = after.replace(/^\s+/, '').match(mre);
      if (mm) {
        value *= mult;
        consumed = mm[0];
        break;
      }
    }
    const rest = consumed ? after.replace(/^\s+/, '').slice(consumed.length) : after;
    const unit = unitFromContext(rest.replace(/^\s*(de|of|von|d'|di|de)\s+/, ' '), before, text.slice(idx + rawNum.length, idx + rawNum.length + 60));
    out.push({
      value: Math.round(value * 1e6) / 1e6,
      unit,
      raw: text.slice(idx, Math.min(text.length, idx + rawNum.length + (consumed ? consumed.length + 1 : 0))).trim(),
      approximate: APPROX_RE.test(before),
    });
  }
  // Números en palabra junto a una unidad conocida: "dos muertos", "three people".
  for (const m of f.matchAll(/(?<![\p{L}-])(\p{L}+)\s+(\p{L}+)/gu)) {
    const n = WORD_NUMBERS[m[1]];
    if (!n) continue;
    // "twenty-five", "vingt-cinq": compuestos que no sabemos leer → se ignoran.
    if (f[(m.index ?? 0) + m[1].length] === '-') continue;
    const unit = unitFromContext(` ${m[2]}`, '');
    if (unit && !unit.startsWith('n:') && unit !== 'years_old' && unit !== 'celsius' && unit !== 'km') {
      out.push({ value: n, unit, raw: m[0], approximate: false });
    }
  }
  return out;
}

/** ¿Dos cifras de la misma magnitud son compatibles? (tolerancia por aproximación y redondeo) */
export function numbersAgree(a: ExtractedNumber, b: ExtractedNumber): boolean {
  if (a.unit !== b.unit) return false;
  if (a.value === b.value) return true;
  const hi = Math.max(Math.abs(a.value), Math.abs(b.value));
  if (hi === 0) return true;
  const rel = Math.abs(a.value - b.value) / hi;
  if (a.unit === 'magnitude') return Math.abs(a.value - b.value) <= 0.2; // agencias sísmicas difieren 0,1-0,2
  if (a.approximate || b.approximate) return rel <= 0.15;
  if (a.unit === 'percent' || a.unit === 'celsius') return Math.abs(a.value - b.value) <= 0.1;
  // Redondeos de grandes cifras ("2,5 millones" vs "2.480.000")
  if (hi >= 1e5) return rel <= 0.03;
  return false;
}
