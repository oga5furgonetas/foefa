import { CITIES } from '../config/cities';
import { COUNTRIES } from '../config/countries';
import { REGIONS } from '../config/regions';
import { fold } from './normalize';
import { STOPWORDS } from './tokenize';

/**
 * Entidades sin IA: topónimos por diccionario (países, regiones, ciudades en
 * los seis idiomas y sus alias) + secuencias de palabras en mayúscula para
 * personas y organizaciones. Es deliberadamente conservador: prefiere no
 * detectar una entidad a inventarla.
 */

export type EntityType = 'person' | 'organization' | 'place' | 'other';
export type ExtractedEntity = { name: string; type: EntityType; count: number };

export type PlaceMatch = {
  kind: 'country' | 'region' | 'city';
  countryCode: string;
  regionCode: string | null;
  cityKey: string | null;
  name: string;
};

type GazEntry = PlaceMatch & { key: string };
let GAZ: Map<string, GazEntry[]> | null = null;

function gazetteer(): Map<string, GazEntry[]> {
  if (GAZ) return GAZ;
  GAZ = new Map();
  const add = (label: string, e: Omit<GazEntry, 'key' | 'name'>) => {
    const k = gazNorm(label);
    if (k.length < 3) return;
    const list = GAZ!.get(k) ?? [];
    if (!list.some((x) => x.kind === e.kind && x.countryCode === e.countryCode && x.regionCode === e.regionCode && x.cityKey === e.cityKey))
      list.push({ ...e, key: k, name: label });
    GAZ!.set(k, list);
  };
  for (const c of COUNTRIES) {
    for (const n of [...Object.values(c.names), ...c.aliases]) add(n, { kind: 'country', countryCode: c.code, regionCode: null, cityKey: null });
  }
  for (const r of REGIONS) {
    for (const n of [...Object.values(r.names), ...r.aliases]) add(n, { kind: 'region', countryCode: r.countryCode, regionCode: r.code, cityKey: null });
  }
  for (const c of CITIES) {
    for (const n of [...Object.values(c.names), ...c.aliases]) add(n, { kind: 'city', countryCode: c.countryCode, regionCode: c.regionCode, cityKey: c.key });
  }
  return GAZ;
}

/** Topónimos presentes en el texto (ordenados por aparición). */
function gazNorm(s: string): string {
  return fold(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findPlaces(text: string): PlaceMatch[] {
  const gaz = gazetteer();
  const f = ` ${gazNorm(text)} `;
  const found: { at: number; m: GazEntry }[] = [];
  // Los topónimos solo cuentan si en el original empiezan por mayúscula
  // ("Granada" la ciudad, no "granada" la fruta).
  for (const [key, entries] of gaz) {
    let idx = f.indexOf(` ${key} `);
    while (idx >= 0) {
      const originalSlice = text.slice(Math.max(0, idx - 2), idx + key.length + 2);
      if (/\p{Lu}/u.test(originalSlice) || key.length > 6) {
        // Ambigüedad (Santiago, Córdoba, Valencia): prefiere la ciudad más poblada;
        // el resolvedor geográfico usa el contexto de país para desempatar.
        for (const m of entries) found.push({ at: idx, m });
      }
      idx = f.indexOf(` ${key} `, idx + key.length);
    }
  }
  // Quitar coincidencias contenidas en otras más largas ("Santiago" dentro de "Santiago de Compostela").
  found.sort((a, b) => a.at - b.at || b.m.key.length - a.m.key.length);
  const out: PlaceMatch[] = [];
  let coveredUntil = -1;
  let coveredStart = -1;
  for (const { at, m } of found) {
    if (at >= coveredStart && at + m.key.length <= coveredUntil && !(at === coveredStart && m.key.length === coveredUntil - coveredStart)) continue;
    if (at + m.key.length > coveredUntil) {
      coveredStart = at;
      coveredUntil = at + m.key.length;
    }
    out.push({ kind: m.kind, countryCode: m.countryCode, regionCode: m.regionCode, cityKey: m.cityKey, name: m.name });
  }
  return out;
}

// Solo preposiciones/artículos de nombres propios: las conjunciones (y, and, und…) separan entidades.
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'von', 'van', 'der', 'den', 'di', 'da', 'dos', 'das', 'du', 'le', 'of', 'for', 'para']);
const ORG_HINTS =
  /\b(organizacion|organization|organisation|organizzazione|organizacao|ministerio|ministry|ministerium|ministere|ministero|ministerio|gobierno|government|regierung|gouvernement|governo|banco|bank|banque|banca|universidad|university|universitat|universite|universita|universidade|partido|party|partei|parti|partito|consejo|council|rat|conseil|consiglio|conselho|agencia|agency|agentur|agence|agenzia|comision|commission|kommission|commissione|comissao|instituto|institute|institut|istituto|tribunal|court|gericht|corte|policia|police|polizei|polizia|club|fc|cf|s\.a\.|inc\.?|ltd|gmbh|ag|spa|s\.p\.a\.|corp\.?|group|grupo|gruppe|groupe|gruppo|asociacion|association|verband|associazione|associacao|fundacion|foundation|stiftung|fondation|fondazione|fundacao|nasa|onu|otan|nato|oms|who|ue|eu|fmi|imf|bce|ecb|fed)\b/i;
const PERSON_TITLES =
  /\b(sr|sra|don|dona|doña|mr|mrs|ms|dr|dra|prof|presidente|presidenta|president|ministro|ministra|minister|ministerin|kanzler|kanzlerin|alcalde|alcaldesa|mayor|burgermeister|burgermeisterin|maire|sindaco|prefeito|prefeita|rey|king|konig|roi|re|rei|papa|pope|senador|senator|senatore|diputado|diputada|abgeordnete|depute|deputato|deputado|juez|jueza|judge|richter|juge|giudice|juiz|entrenador|coach|trainer|entraineur|allenatore|tecnico|portavoz|spokesperson|spokesman|spokeswoman|sprecher|sprecherin|porte-parole|portavoce|porta-voz|ceo|consejero delegado|director|directora)\.?\s*$/i;

const COMPASS = /^(N|S|E|W|NE|NW|SE|SW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)$/;

const SENTENCE_START_STOP = new Set(
  Object.values(STOPWORDS)
    .flatMap((s) => [...s])
    .concat(['este', 'esta', 'these', 'this', 'there', 'here', 'aqui', 'hier', 'ici', 'qui', 'aqui', 'hoy', 'today', 'heute', 'ayer', 'yesterday', 'gestern', 'segun', 'according', 'laut', 'selon', 'secondo', 'segundo']),
);

/** Entidades nombradas (personas, organizaciones, lugares) por heurística. */
export function extractEntities(text: string, lang?: string | null): ExtractedEntity[] {
  const counts = new Map<string, ExtractedEntity>();
  const places = new Set(findPlaces(text).map((p) => fold(p.name)));
  // El salto de línea (titular / resumen) también corta: si no, «…en Ukraine\nLe chef…» da «Ukraine Le».
  const tokens = text.match(/[\p{L}][\p{L}\p{N}'’.\-&]*|[.!?;:,«»“”"()\n]/gu) ?? [];
  let i = 0;
  let prevPunct = true;
  while (i < tokens.length) {
    const tok = tokens[i];
    const isCap = /^\p{Lu}/u.test(tok) && tok.length > 1;
    const isAcronym = /^\p{Lu}{2,6}$/u.test(tok);
    if (!isCap) {
      prevPunct = /^[.!?;:«“"(\n]$/.test(tok);
      i++;
      continue;
    }
    const seq: string[] = [tok];
    let j = i + 1;
    while (j < tokens.length) {
      const t = tokens[j];
      if (/^\p{Lu}/u.test(t) && t.length > 1) {
        seq.push(t);
        j++;
      } else if (CONNECTORS.has(t.toLowerCase()) && j + 1 < tokens.length && /^\p{Lu}/u.test(tokens[j + 1])) {
        seq.push(t);
        j++;
      } else if (
        CONNECTORS.has(t.toLowerCase()) &&
        j + 2 < tokens.length &&
        CONNECTORS.has(tokens[j + 1].toLowerCase()) &&
        /^\p{Lu}/u.test(tokens[j + 2])
      ) {
        // "Organización Mundial de la Salud", "Ursula von der Leyen"
        seq.push(t, tokens[j + 1]);
        j += 2;
      } else break;
    }
    // Primera palabra de frase en mayúscula por gramática: descartar si es palabra común.
    if (prevPunct && seq.length === 1 && !isAcronym && SENTENCE_START_STOP.has(fold(tok))) {
      i = j;
      prevPunct = false;
      continue;
    }
    if (prevPunct && seq.length > 1 && SENTENCE_START_STOP.has(fold(seq[0]))) seq.shift();
    // Rumbo de brújula de los partes sísmicos («35 km NNE of Demo Point»): no es parte del nombre.
    while (seq.length && COMPASS.test(seq[0])) {
      seq.shift();
      if (seq.length && CONNECTORS.has(seq[0].toLowerCase())) seq.shift();
    }
    if (!seq.length) {
      prevPunct = false;
      i = j;
      continue;
    }
    const name = seq.join(' ').replace(/[.’']+$/, '');
    if (name.length > 1) {
      const before = tokens.slice(Math.max(0, i - 3), i).join(' ');
      let type: EntityType = 'other';
      if (places.has(fold(name))) type = 'place';
      else if (ORG_HINTS.test(fold(name)) || isAcronym) type = 'organization';
      else if (PERSON_TITLES.test(fold(before))) type = 'person';
      // En alemán los sustantivos van en mayúscula: sin tratamiento delante no se supone persona.
      else if (lang !== 'de' && seq.length >= 2 && seq.length <= 4 && seq.every((w) => /^\p{Lu}\p{Ll}+/u.test(w) || CONNECTORS.has(w.toLowerCase())))
        type = 'person';
      const key = fold(name);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { name, type, count: 1 });
    }
    prevPunct = false;
    i = j;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/** Forma canónica de un nombre para comparar entre idiomas y fuentes. */
export function entityKey(name: string): string {
  return fold(name)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(el|la|los|las|the|der|die|das|le|les|il|lo|gli|o|os|as)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
