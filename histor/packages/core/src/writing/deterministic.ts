/**
 * Redactor determinista ("ficha verificada"). Funciona sin IA y sin coste:
 *   titular  ← la afirmación mejor respaldada, comprimida (atribuida si no está verificada)
 *   entrada  ← esa afirmación + quién la confirma
 *   Lo que se sabe / Datos clave / Citas / Discrepancias / No confirmado / Qué puede pasar
 *   Cómo lo verificamos ← recuadro con lo confirmado, lo atribuido y lo pendiente
 * Cada frase lleva los ids de las afirmaciones que la sostienen, y las
 * afirmaciones solo aparecen como hecho si están confirmadas.
 * Límite de copia: ninguna frase supera maxWords palabras de una fuente, y se
 * reparten las afirmaciones entre fuentes para no depender de una sola.
 */
import type { ArticleBlock, VerificationBox } from '../db/schema';
import { country } from '../config/countries';
import { localeFor } from '../config/languages';
import { fold, truncate } from '../text/normalize';
import { compressClaim, lowerFirst } from './compress';
import type { Draft } from './draft';
import type { FactClaim, FactSheet } from './factsheet';
import { listJoin, PHRASES } from './phrases';
import { PROMO } from '../text/nonnews';

export type WriteOptions = { maxWords?: number; timeZone?: string; countryCode?: string | null };

export function writeDeterministic(fs: FactSheet, opts: WriteOptions = {}): Draft | null {
  const lang = fs.language;
  const P = PHRASES[lang];
  if (!P) return null;
  const maxWords = opts.maxWords ?? 22;
  const locale = localeFor(lang, opts.countryCode ?? null);
  const tz = opts.timeZone ?? (opts.countryCode ? country(opts.countryCode)?.timezone : undefined) ?? 'UTC';
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long', timeZone: tz });
  const boilerplate: string[] = [];
  const bp = (s: string) => {
    boilerplate.push(s);
    return s;
  };

  const developing = !fs.verified;
  const body: ArticleBlock[] = [];
  let headline: string | null = null;
  let summary = '';
  let leadClaim: FactClaim | null = null;

  // ── Plantilla de datos estructurados (terremoto de fuente primaria) ──
  if (fs.earthquake) {
    const q = fs.earthquake;
    const place = q.placeName ? P.near(q.placeName) : '';
    const mag = nf.format(q.magnitude);
    headline = P.earthquake.headline(mag, place).trim();
    // Sin verificar (una sola fuente), también el titular va atribuido: «…, según USGS».
    if (developing) headline = stripPeriod(P.according(headline, q.agency));
    const lead = P.earthquake.lead(capitalize(q.agency), timeFmt.format(q.time), mag, place, q.depthKm == null ? '—' : nf.format(q.depthKm));
    body.push({ type: 'p', text: lead, claimIds: [] });
    boilerplate.push(lead);
    if (q.tsunami) body.push({ type: 'p', text: bp(P.earthquake.tsunami), claimIds: [] });
    summary = lead;
  }

  // ── Titular y entrada ──
  // Titular: el titular de fuente mejor respaldado, comprimido (si no hay, una frase del cuerpo).
  // Entrada: la frase que mejor cuenta lo mismo que el titular SIN repetirlo. El 29-09-2026 la
  // entrada era «Depuis 2017, … alors que sur la période.» (la primera frase confirmada, sin
  // relación con el titular) y el titular se repetía tal cual como primer párrafo.
  const pool = developing ? [...fs.confirmed, ...fs.attributed] : fs.confirmed;
  let headlineClaim: FactClaim | null = null;
  if (!headline) {
    const candidates = [...pool.filter((c) => c.isHeadline), ...pool.filter((c) => !c.isHeadline)];
    // Una frase del cuerpo solo es titular si cuenta lo mismo que el titular de alguna fuente:
    // «En agosto de 2026, la bancada Caribe radicó el proyecto» (¿qué proyecto?) salió de titular.
    const sourceTitles = fs.claims.filter((c) => c.isHeadline).map((c) => keyWords(c.text));
    const aboutTheStory = (c: FactClaim) => {
      const w = keyWords(c.text);
      return sourceTitles.some((t) => coverage(t, w) >= 0.4);
    };
    for (const c of candidates) {
      if (!c.isHeadline && !aboutTheStory(c)) continue;
      const short = compressClaim(c.text, 16, { commaCut: false });
      // Un titular tiene que entenderse solo.
      if (!short || !standsAlone(short)) continue;
      const h = developing ? stripPeriod(P.according(short, listJoin(lang, c.attribution.slice(0, 2)))) : short;
      if (h.length <= 120 && goodHeadline(h)) {
        headline = h;
        headlineClaim = c;
        break;
      }
    }
  }
  if (!headline) return null;
  const hWords = keyWords(headline);
  // La entradilla sale sola en portada: solo frases que se entienden sin su artículo.
  const leadOptions = [...pool.filter((c) => !c.isHeadline), ...pool.filter((c) => c.isHeadline && c.key !== headlineClaim?.key)].filter((c) => standsAlone(c.text) && usableSentence(c.text));
  let lead: { c: FactClaim; text: string; score: number } | null = null;
  leadOptions.forEach((c, i) => {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) return;
    const overlap = coverage(hWords, keyWords(compressed));
    if (overlap > 0.85) return; // sería el titular otra vez con otras palabras
    const score = overlap - i * 0.02; // a igualdad, la mejor respaldada (van por orden)
    if (!lead || score > lead.score) lead = { c, text: compressed, score };
  });
  if (!lead && headlineClaim) {
    // Sin otra frase que lo cuente: la del titular, en su versión más completa.
    const full = compressClaim(headlineClaim.text, maxWords);
    if (full && usableSentence(full)) lead = { c: headlineClaim, text: full, score: 1 };
  }
  if (lead) {
    const { c, text } = lead as { c: FactClaim; text: string };
    leadClaim = c;
    const leadSentence = developing ? P.according(text, listJoin(lang, c.attribution.slice(0, 3))) : `${text}.`;
    body.push({ type: 'p', text: leadSentence, claimIds: [claimRef(c)] });
    if (!summary) summary = leadSentence;
  }
  if (!leadClaim && !fs.earthquake) return null;

  // Quién lo confirma (en la entradilla si está verificada; aquí si es de una sola fuente)
  const confirmers = fs.sources.map((s) => s.name);
  if (developing && confirmers.length === 1) body.push({ type: 'p', text: bp(P.singleSource(confirmers[0])), claimIds: [] });

  // ── Lo que se sabe (reparto entre fuentes) ──
  const used = new Set<string>(leadClaim ? [leadClaim.key] : []);
  const perSource = new Map<string, number>();
  const known: { text: string; claimIds: number[]; plain: boolean }[] = [];
  // También en las verificadas: primero lo confirmado (como hecho) y después los detalles que
  // da cada fuente, siempre atribuidos («…, según The Guardian»). Sin ellos, una noticia
  // verificada se quedaba en una o dos frases aunque hubiera leído los artículos completos.
  // Los titulares de las demás fuentes repiten lo mismo con otras palabras: fuera del cuerpo.
  const bodyClaims = [...fs.confirmed, ...fs.attributed].filter((c) => !c.isHeadline);
  const knownPool = bodyClaims.length >= 2 ? bodyClaims : [...fs.confirmed, ...fs.attributed];
  for (const c of knownPool) {
    if (known.length >= 10) break;
    if (used.has(c.key) || nearDuplicate(c, [...used].map((k) => fs.claims.find((x) => x.key === k)!).filter(Boolean))) continue;
    const src = c.attribution[0] ?? '';
    if ((perSource.get(src) ?? 0) >= 3) continue;
    const compressed = compressClaim(c.text, maxWords);
    // Frases que dependen de la anterior de su fuente («Mas os maiores escritórios…»), citas
    // con las comillas sin cerrar o frases que se quedan colgando: fuera.
    if (!compressed || !selfContained(compressed) || !usableSentence(compressed)) continue;
    used.add(c.key);
    perSource.set(src, (perSource.get(src) ?? 0) + 1);
    const plain = c.status === 'supported' && !developing;
    const text = plain ? `${compressed}.` : P.according(compressed, listJoin(lang, c.attribution.slice(0, 2)));
    known.push({ text, claimIds: [claimRef(c)], plain });
  }
  // Texto corrido, no una lista: hasta dos hechos por párrafo, como en un periódico, sin mezclar
  // en el mismo párrafo lo confirmado con lo atribuido (cada frase debe poder comprobarse sola).
  for (let i = 0; i < known.length; ) {
    const pair = known[i + 1] && known[i + 1].plain === known[i].plain ? known.slice(i, i + 2) : [known[i]];
    body.push({ type: 'p', text: pair.map((k) => k.text).join(' '), claimIds: pair.flatMap((k) => k.claimIds) });
    i += pair.length;
  }
  // El titular tiene que estar respaldado por el texto (control HEADLINE_INTEGRITY). Solo si lo
  // escrito no lo cubre, el hecho del titular entra en el cuerpo, justo después de la entrada.
  const bodyWords = keyWords(body.map((b) => ('text' in b ? b.text : '')).join(' '));
  if (headlineClaim && !used.has(headlineClaim.key) && coverage(hWords, bodyWords) < 0.5) {
    const full = compressClaim(headlineClaim.text, maxWords);
    if (full) {
      const plain = headlineClaim.status === 'supported' && !developing;
      const text = plain ? `${full}.` : P.according(full, listJoin(lang, headlineClaim.attribution.slice(0, 2)));
      body.splice(fs.earthquake ? body.length : Math.min(1, body.length), 0, { type: 'p', text, claimIds: [claimRef(headlineClaim)] });
      used.add(headlineClaim.key);
    }
  }

  // ── Datos clave (estructurados, redacción propia) ──
  const figures = fs.figures.filter((f) => SELF_EXPLAINING_UNITS.has(f.unit) && P.units[f.unit]);
  if (figures.length) {
    body.push({ type: 'h2', text: P.headings.figures });
    body.push({
      type: 'list',
      items: figures.slice(0, 6).map((f) => {
        const isCur = f.unit.startsWith('currency:');
        const label = P.units[isCur ? 'currency' : f.unit];
        const value = isCur ? new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode(f.unit), maximumFractionDigits: 0 }).format(f.value) : nf.format(f.value);
        const ids = fs.claims
          .filter((c) => c.kind !== 'prediction' && c.modality !== 'hedged' && c.numbers.some((n) => n.unit === f.unit && n.value === f.value) && ['supported', 'partially_supported'].includes(c.status))
          .map(claimRef);
        return { text: `${label}: ${value} ${P.figureSource(listJoin(lang, f.sources.slice(0, 3)))}`, claimIds: ids };
      }),
    });
  }

  // ── Citas verificadas ──
  for (const c of fs.quotes.slice(0, 2)) {
    if (!c.quote?.speaker) continue;
    body.push({ type: 'quote', text: c.quote.text, speaker: c.quote.speaker, claimIds: [claimRef(c)], sourceUrl: c.supporters[0]?.url ?? '' });
  }

  // ── Discrepancias ──
  if (fs.discrepancies.length) {
    body.push({ type: 'h2', text: P.headings.discrepancies });
    body.push({
      type: 'list',
      items: fs.discrepancies.slice(0, 4).map((d) => {
        const parts = d.parts.map((p) => `${p.source}: ${formatValue(p.value, nf)}`).join('; ');
        return { text: bp(P.discrepancy(P.fieldNames[d.field] ?? d.field, parts)), claimIds: [] };
      }),
    });
  }

  // ── No confirmado ──
  const unconf = fs.unconfirmed.filter((c) => !used.has(c.key)).slice(0, 4);
  const unconfItems: { text: string; claimIds: number[] }[] = [];
  for (const c of unconf) {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    unconfItems.push({ text: `${P.according(compressed, listJoin(lang, c.attribution.slice(0, 2)))} ${P.unconfirmedSuffix}`, claimIds: [claimRef(c)] });
  }
  if (unconfItems.length) {
    body.push({ type: 'h2', text: P.headings.unconfirmed });
    body.push({ type: 'list', items: unconfItems });
  }

  // ── Predicciones (siempre atribuidas y en futuro/condicional) ──
  const preds: { text: string; claimIds: number[] }[] = [];
  for (const c of fs.predictions.slice(0, 3)) {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    preds.push({ text: P.according(compressed, listJoin(lang, c.attribution.slice(0, 2))), claimIds: [claimRef(c)] });
  }
  if (preds.length) {
    body.push({ type: 'h2', text: P.headings.next });
    body.push({ type: 'list', items: preds });
  }

  if (developing) body.push({ type: 'p', text: bp(P.willUpdate), claimIds: [] });

  const uniq = <T extends { text: string }>(xs: T[]): T[] => {
    const seen = new Set<string>();
    return xs.filter((x) => {
      const k = x.text.toLowerCase().replace(/[\s.,;:]+/g, ' ').trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const verification: VerificationBox = {
    confirmed: uniq(fs.confirmed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    attributed: uniq(fs.attributed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    unconfirmed: uniq(fs.unconfirmed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    superseded: uniq(fs.superseded.slice(0, 3).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    contradictions: fs.discrepancies.map((d) => ({ text: P.discrepancy(P.fieldNames[d.field] ?? d.field, d.parts.map((p) => `${p.source}: ${formatValue(p.value, nf)}`).join('; ')) })),
    method: P.method(fs.independentCredible, fs.hasPrimary),
  };
  // Terremoto verificado con fuentes en otro idioma: el recuadro no puede quedar sin nada
  // confirmado; se muestra el dato estructurado y quién lo confirma.
  if (fs.earthquake && !developing && !verification.confirmed.length) {
    const q = fs.earthquake;
    verification.confirmed = [{ text: P.earthquake.headline(nf.format(q.magnitude), q.placeName ? P.near(q.placeName) : '').trim(), by: fs.sources.map((s) => s.name) }];
  }

  // El número y los nombres cuadran siempre: si hay más de cuatro, se dice «entre ellas».
  const subheadline = developing
    ? P.developingNote
    : confirmers.length > 4
      ? P.confirmedByMany(confirmers.length, listJoin(lang, confirmers.slice(0, 3)))
      : confirmers.length
        ? P.confirmedBy(confirmers.length, listJoin(lang, confirmers))
        : null;
  if (subheadline) boilerplate.push(subheadline);
  const timeline = fs.timeline.map((e) => ({ at: e.at.toISOString(), text: `${P.timelineItem(e.source)}` }));

  // La entradilla no repite el titular: si coinciden, se usa la siguiente frase con respaldo.
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (norm(summary) === norm(headline)) {
    // Solo párrafos: una línea de «Datos clave» («Fallecidos: 10 (según DW)») no es una entradilla.
    const next = body.find((b): b is Extract<ArticleBlock, { type: 'p' }> => b.type === 'p' && b.claimIds.length > 0 && norm(b.text) !== norm(headline) && standsAlone(b.text));
    if (next) summary = next.text;
  }

  return {
    language: lang,
    headline,
    subheadline,
    summary: truncate(summary, 300),
    body,
    verification,
    seoTitle: truncate(headline, 70),
    seoDescription: truncate(summary, 160),
    writer: 'template',
    isDeveloping: developing,
    timeline,
    boilerplate,
  };
}

/** Referencia estable a la afirmación (id de BD si ya existe; si no, índice negativo temporal). */
export function claimRef(c: FactClaim): number {
  if (c.dbId) return c.dbId;
  const [item, idx] = c.key.split(':').map(Number);
  return -(item * 1000 + idx + 1);
}

/** ¿Se entiende sin la frase anterior? No si empieza por un anafórico o un conector. */
function selfContained(text: string): boolean {
  const t = text.trim();
  return !/^(den|dem|dies|esto|eso|ello|cela|ceci|ciò|isso|isto|but|pero|mas|aber|mais|ma|however|sin embargo|doch|allerdings|cependant|tuttavia|porém|contudo|además|también|also|auch|aussi|anche|também|and|y|und|et|e|so|así|asimismo)\b/i.test(t) && !ANAPHORIC_NP.test(t) && !CONNECTOR_START.test(t);
}

/**
 * Para el titular y la entradilla, más estricto: tampoco un posesivo, un demostrativo o un
 * pronombre al empezar («Su partido, el SNS, ganó…», «Esta empresa fue fundada…», «Ella
 * dijo…»): fuera de su artículo no se sabe de quién hablan (portada del 29-09-2026). Sí
 * valen las expresiones de tiempo («Este lunes, el Gobierno…», «Ce mardi…»).
 */
export function standsAlone(text: string): boolean {
  const t = text.trim();
  return selfContained(t) && !(STRICT_ANAPHORA.test(t) && !TIME_AFTER_DEMONSTRATIVE.test(t));
}

/** Transiciones que remiten a lo anterior del texto de la fuente. */
const CONNECTOR_START =
  /^(es que|de hecho|precisamente|siguiendo esta línea|en este sentido|en esta línea|por su parte|por otro lado|por otra parte|no obstante|ahora bien|a su vez|en declaraciones al medio citado|en declaraciones a este medio|in fact|meanwhile|in addition|moreover|furthermore|by contrast|on the other hand|indeed|still,|inoltre|tuttavia|infatti|intanto|in questo senso|en effet|par ailleurs|toutefois|néanmoins|de plus|dans ce sens|außerdem|zudem|jedoch|indes|dennoch|darüber hinaus|além disso|no entanto|por sua vez|de fato|nesse sentido)\b/i;

const STRICT_ANAPHORA =
  /^(su|sus|este|esta|estos|estas|ese|esa|esos|esas|dicho|dicha|dichos|dichas|aquel|aquella|él|ella|ellos|ellas|his|her|their|its|this|these|that|those|such|he|she|they|it|sein|seine|seinen|seiner|ihr|ihre|ihren|dieser|diese|dieses|jener|er|sie|son|sa|ses|leur|leurs|ce|cet|cette|ces|elle|ils|elles|lui|suo|sua|suoi|sue|loro|questo|questa|questi|queste|quel|quella|lei|seu|seus|suas|esse|essa|esses|essas|aquele|aquela|ele|ela|eles|elas)\b/i;

const TIME_AFTER_DEMONSTRATIVE =
  /^\S+\s(lunes|martes|miércoles|jueves|viernes|sábado|domingo|fin de semana|año|mes|semana|mañana|tarde|noche|verano|invierno|otoño|primavera|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend|year|month|morning|afternoon|evening|summer|winter|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week-end|matin|soir|année|mois|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|anno|mese|fine settimana|segunda|terça|quarta|quinta|sexta|ano|mês|fim de semana|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|woche|jahr|monat|wochenende|morgen|abend)\b/i;

/**
 * Un titular tiene que ser una frase informativa y cerrada: al menos 5 palabras («Alba
 * Carrillo» no lo es), comillas emparejadas («"Los españoles no necesitan un Gobierno…» sin
 * cerrar) y no una cita suelta sin quién la dice.
 */
export function goodHeadline(h: string): boolean {
  const t = h.trim();
  if (t.split(/\s+/).length < 5) return false;
  if (/^["“«'‘„]/.test(t)) return false;
  const count = (re: RegExp) => (t.match(re) ?? []).length;
  if (count(/«/g) !== count(/»/g) || count(/“/g) !== count(/”/g) || count(/"/g) % 2 !== 0) return false;
  if (/[:;,]$/.test(t)) return false;
  return true;
}

/** «La medida busca asegurar la zona…»: ¿qué medida? Remite a lo que la fuente dijo antes. */
const ANAPHORIC_NP =
  /^((la|esta|dicha) (medida|decisión|iniciativa|operación|propuesta|reforma|norma)|(el|este|dicho) (acuerdo|anuncio|plan|proyecto|cambio|decreto)|(the|this) (move|decision|measure|plan|deal|step|announcement|proposal)|(die|diese) (maßnahme|entscheidung|regelung)|(der|dieser) (schritt|beschluss|plan|vorschlag)|(la|cette) (mesure|décision|réforme)|(ce|le) (projet|plan|texte)|(la|questa) (misura|decisione|riforma)|(il|questo) (provvedimento|piano|decreto)|(a|esta|essa) (medida|decisão|reforma)|(o|este|esse) (acordo|plano|projeto|decreto))\b/i;

/** Palabras con peso (más de 4 letras, sin acentos), igual que el control HEADLINE_INTEGRITY. */
function keyWords(s: string): Set<string> {
  return new Set(fold(s).split(/\W+/).filter((w) => w.length > 4));
}

/** Parte de las palabras de `of` que aparecen en `inText`. */
function coverage(of: Set<string>, inText: Set<string>): number {
  if (!of.size) return 1;
  let n = 0;
  for (const w of of) if (inText.has(w)) n++;
  return n / of.size;
}

/**
 * ¿Se puede publicar esta frase tal cual? No con comillas sin cerrar («« On a perdu…, dénonce
 * X» sin su »), ni si es publicidad de la fuente que se coló al leer la página.
 */
export function usableSentence(s: string): boolean {
  const count = (re: RegExp) => (s.match(re) ?? []).length;
  if (count(/«/g) !== count(/»/g) || count(/“/g) !== count(/”/g) || count(/"/g) % 2 !== 0) return false;
  return !PROMO.test(s);
}

/** Cifras que se entienden solas en «Datos clave». «Porcentaje: 5» o «Importe: 54.000 millones» sin decir de qué, no. */
const SELF_EXPLAINING_UNITS = new Set(['deaths', 'injured', 'missing', 'evacuated', 'arrested', 'magnitude', 'votes', 'seats', 'homes', 'jobs', 'flights', 'vehicles', 'hectares']);

function stripPeriod(s: string): string {
  return s.replace(/\.$/, '');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currencyCode(unit: string): string {
  const c = unit.split(':')[1];
  return c === 'PESO' ? 'MXN' : c;
}

function formatValue(v: string, nf: Intl.NumberFormat): string {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' ? nf.format(n) : v;
}

function nearDuplicate(c: FactClaim, others: FactClaim[]): boolean {
  const a = new Set(c.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  return others.some((o) => {
    const b = new Set(o.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    return inter / Math.max(1, Math.min(a.size, b.size)) > 0.7;
  });
}

export { lowerFirst };
