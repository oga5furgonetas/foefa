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
import { CITIES } from '../config/cities';
import { country } from '../config/countries';
import { regionByCode } from '../config/regions';
import { localeFor } from '../config/languages';
import { fold, truncate } from '../text/normalize';
import { compressClaim, lowerFirst } from './compress';
import { plainWords } from './quality';
import type { Draft } from './draft';
import type { FactClaim, FactSheet } from './factsheet';
import { listJoin, PHRASES } from './phrases';
import { PROMO } from '../text/nonnews';

/** `skeleton`: solo para la IA. Si no hay titular ni entrada publicables, se monta igualmente el armazón
 * (recuadro, fuentes, cronología) con la primera afirmación; la IA pone el titular y el texto, que se
 * validan frase a frase. El armazón no se publica nunca tal cual. */
export type WriteOptions = { maxWords?: number; bodyMaxWords?: number; timeZone?: string; countryCode?: string | null; skeleton?: boolean };

export function writeDeterministic(fs: FactSheet, opts: WriteOptions = {}): Draft | null {
  const lang = fs.language;
  const P = PHRASES[lang];
  if (!P) return null;
  const maxWords = opts.maxWords ?? 22;
  // Frases del cuerpo: hasta 28 palabras (el tope de copia literal es 30). Con 22, casi todas las
  // frases de agencia (25-45 palabras) se descartaban y la noticia se quedaba en dos líneas
  // (01-10-2026: mediana de 42 palabras de texto, 18 de 26 noticias por debajo de 50).
  const bodyMaxWords = opts.bodyMaxWords ?? 28;
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
    // Sin la agencia en el titular (01-10-2026): la entrada la nombra y, con una sola fuente, la
    // noticia va «en desarrollo».
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
  // Cada frase decide por sí misma: lo confirmado va como hecho; lo demás, con «según X». Una
  // historia verificada entre idiomas (lo confirman dos medios en inglés) puede no tener nada
  // confirmado EN ESTE idioma: se escribe atribuido en vez de no publicarse (29-09-2026: 27 de
  // 38 historias verificadas se quedaban sin borrador en algún idioma).
  const plainClaim = (c: FactClaim) => !developing && c.status === 'supported';
  const pool = [...fs.confirmed, ...fs.attributed];
  let headlineClaim: FactClaim | null = null;
  if (!headline) {
    const conf = pool.filter(plainClaim);
    const attr = pool.filter((c) => !plainClaim(c));
    const candidates = [...conf.filter((c) => c.isHeadline), ...conf.filter((c) => !c.isHeadline), ...attr.filter((c) => c.isHeadline), ...attr.filter((c) => !c.isHeadline)];
    // Una frase del cuerpo solo es titular si cuenta lo mismo que el titular de alguna fuente:
    // «En agosto de 2026, la bancada Caribe radicó el proyecto» (¿qué proyecto?) salió de titular.
    const sourceTitles = fs.claims.filter((c) => c.isHeadline).map((c) => keyWords(c.text));
    const aboutTheStory = (c: FactClaim) => {
      const w = keyWords(c.text);
      return sourceTitles.some((t) => coverage(t, w) >= 0.4);
    };
    // El marcador más avanzado que dan las fuentes: un titular con uno anterior es de mitad de
    // partido («Doblete de Lamine Yamal para el 3-1» cuando el partido acabó 4-1, 30-09-2026).
    const scores = (s: string) => [...s.matchAll(/(?<![\d.,:/])(\d{1,2})\s?[-–]\s?(\d{1,2})(?![\d.,:/%])/g)].map((m) => Number(m[1]) + Number(m[2]));
    const lastScore = Math.max(0, ...fs.claims.flatMap((c) => scores(c.text)));
    const stale = (s: string) => scores(s).some((x) => x < lastScore);
    for (const c of candidates) {
      if (!c.isHeadline && !aboutTheStory(c)) continue;
      if (stale(c.text)) continue;
      // Los titulares de las fuentes suelen tener 17-20 palabras («Los profesores españoles trabajan
      // dos horas menos a la semana que en la media de la OCDE»): con 16, la noticia se retenía
      // entera (30-09-2026). El tope real es de 120 caracteres, más abajo.
      const short = compressClaim(c.text, c.isHeadline ? 22 : 16, { commaCut: false });
      // Un titular tiene que entenderse solo.
      if (!short || !standsAlone(short)) continue;
      if (!c.isHeadline && !bodyHeadlineOk(short)) continue;
      // Sin la fuente en el titular («…, según Infobae»): la atribución va en el texto y, si no está
      // confirmado, la noticia lleva la etiqueta «En desarrollo» junto al titular (01-10-2026).
      const h = short;
      if (h.length <= 150 && goodHeadline(h)) {
        headline = h;
        headlineClaim = c;
        break;
      }
    }
  }
  if (!headline && opts.skeleton && pool[0]) {
    headline = truncate(pool[0].text, 110);
    headlineClaim = pool[0];
  }
  if (!headline) return null;
  const hWords = keyWords(headline);
  // La entradilla sale sola en portada: solo frases que se entienden sin su artículo.
  const leadOptions = [...pool.filter((c) => !c.isHeadline), ...pool.filter((c) => c.isHeadline && c.key !== headlineClaim?.key)].filter((c) => standsAlone(c.text) && usableSentence(c.text));
  let lead: { c: FactClaim; text: string; score: number } | null = null;
  leadOptions.forEach((c, i) => {
    const compressed = compressClaim(c.text, bodyMaxWords);
    if (!compressed) return;
    const overlap = coverage(hWords, keyWords(compressed));
    if (overlap > 0.85) return; // sería el titular otra vez con otras palabras
    // Tiene que contar lo mismo que el titular: en la noticia de Swiftair condenada por el accidente
    // de Malí la entrada era «Los dos aviones de la Fuerza Aérea francesa volaron a unos 50 metros
    // del aparato de Air France», de otra historia (01-10-2026).
    if (overlap < 0.2) return;
    // A igualdad, la mejor respaldada (van por orden) y, antes que nada, lo confirmado. Mejor de
    // otra pieza que el titular: titular y entrada de la misma fuente eran ya el 71 % del texto y
    // el control legal retenía la noticia (30-09-2026).
    const score = overlap - i * 0.02 + (plainClaim(c) ? 0.2 : 0) - (headlineClaim && c.itemId === headlineClaim.itemId ? 0.25 : 0);
    if (!lead || score > lead.score) lead = { c, text: compressed, score };
  });
  if (!lead && headlineClaim && opts.skeleton) lead = { c: headlineClaim, text: truncate(headlineClaim.text, 200), score: 0 };
  if (!lead && headlineClaim) {
    // Sin otra frase que lo cuente: la del titular, en su versión más completa.
    const full = compressClaim(headlineClaim.text, maxWords);
    if (full && usableSentence(full)) lead = { c: headlineClaim, text: full, score: 1 };
  }
  if (lead) {
    const { c, text } = lead as { c: FactClaim; text: string };
    leadClaim = c;
    const leadSentence = plainClaim(c) ? `${text}.` : P.according(text, listJoin(lang, c.attribution.slice(0, 3)));
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
  const known: { text: string; raw: string; claimIds: number[]; plain: boolean }[] = [];
  // También en las verificadas: primero lo confirmado (como hecho) y después los detalles que
  // da cada fuente, siempre atribuidos («…, según The Guardian»). Sin ellos, una noticia
  // verificada se quedaba en una o dos frases aunque hubiera leído los artículos completos.
  // Los titulares de las demás fuentes repiten lo mismo con otras palabras: fuera del cuerpo.
  const bodyClaims = [...fs.confirmed, ...fs.attributed].filter((c) => !c.isHeadline);
  const knownPool = bodyClaims.length >= 2 ? bodyClaims : [...fs.confirmed, ...fs.attributed];
  // Hilo de la noticia: cada frase comparte al menos una palabra con lo ya escrito (titular, entrada
  // y frases anteriores). Si en la historia se coló otra noticia parecida, sus frases no enlazan.
  const thread = new Set([...hWords, ...(body[0] && body[0].type === 'p' ? keyWords(body[0].text) : [])]);
  // Palabras tomadas de cada TEXTO de fuente (el control legal mide el solapamiento con cada uno):
  // ninguno puede pasar del 45 % del texto. Una nota de agencia que reproducen tres periódicos
  // está en los tres textos: se cuenta en todos, no solo en la pieza de la que sale la frase (si
  // no, «el 67 % del texto coincide con una sola fuente», 01-10-2026).
  const shares = new SourceShares(fs.sourceTexts.map((s) => s.text));
  // El titular y la entrada también cuentan (el control legal mide todo el texto publicado).
  shares.add(headline);
  if (body[0] && body[0].type === 'p') shares.add(body[0].text);
  for (const c of knownPool) {
    if (known.length >= 10) break;
    if (used.has(c.key) || nearDuplicate(c, [...used].map((k) => fs.claims.find((x) => x.key === k)!).filter(Boolean))) continue;
    const src = c.attribution[0] ?? '';
    if ((perSource.get(src) ?? 0) >= 3) continue;
    const compressed = compressClaim(c.text, bodyMaxWords);
    // Frases que dependen de la anterior de su fuente («Mas os maiores escritórios…»), citas
    // con las comillas sin cerrar o frases que se quedan colgando: fuera.
    if (!compressed || !selfContained(compressed) || !usableSentence(compressed)) continue;
    if (!shares.fits(compressed)) continue;
    const kw = keyWords(compressed);
    if (![...kw].some((w) => thread.has(w))) continue;
    const plain = c.status === 'supported' && !developing;
    // Dos frases literales seguidas de la misma fuente forman un tramo copiado de más de 30
    // palabras si también van seguidas en el original: se espera a que haya otra entre medias.
    const prev = known[known.length - 1];
    if (plain && prev?.plain && shares.sameHolder(prev.raw, compressed)) continue;
    shares.add(compressed);
    for (const w of kw) thread.add(w);
    used.add(c.key);
    perSource.set(src, (perSource.get(src) ?? 0) + 1);
    const text = plain ? `${compressed}.` : P.according(compressed, listJoin(lang, c.attribution.slice(0, 2)));
    known.push({ text, raw: compressed, claimIds: [claimRef(c)], plain });
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
  // Con un solo dato, la lista queda pobre («Fallecidos: 116» suelto bajo un párrafo): desde dos.
  if (figures.length >= 2) {
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
  const quotedTexts = new Set<string>();
  for (const c of fs.quotes.slice(0, 4)) {
    // En bloque, solo las citas confirmadas: una cita que da una sola fuente ya va en el texto con su «según».
    if (!c.quote?.speaker || c.status !== 'supported') continue;
    // La misma cita de dos fuentes salía dos veces (29-09-2026).
    const qk = c.quote.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (quotedTexts.has(qk) || quotedTexts.size >= 2) continue;
    quotedTexts.add(qk);
    body.push({ type: 'quote', text: c.quote.text, speaker: c.quote.speaker, claimIds: [claimRef(c)], sourceUrl: c.supporters[0]?.url ?? '' });
  }

  // ── Discrepancias ── solo en el recuadro «Cómo verificamos» (plegado), no en el cuerpo:
  // «Las fuentes no coinciden en los números: Euronews: 17; TGCom24: 10» sin decir 17 qué es
  // ruido para quien lee la noticia (30-09-2026).

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
    contradictions: fs.discrepancies.map((d) => ({ text: P.discrepancy(P.fieldNames[d.field] ?? d.field, d.parts.map((p) => `${p.source}: ${formatValue(p.value, nf, lang)}`).join('; ')) })),
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
  /^(ambos|ambas|both|beide|beiden|les deux|entrambi|entrambe|os dois|as duas|su|sus|este|esta|estos|estas|ese|esa|esos|esas|dicho|dicha|dichos|dichas|aquel|aquella|él|ella|ellos|ellas|his|her|their|its|this|these|that|those|such|he|she|they|it|sein|seine|seinen|seiner|ihr|ihre|ihren|dieser|diese|dieses|jener|er|sie|son|sa|ses|leur|leurs|ce|cet|cette|ces|elle|ils|elles|lui|suo|sua|suoi|sue|loro|questo|questa|questi|queste|quel|quella|lei|seu|seus|suas|esse|essa|esses|essas|aquele|aquela|ele|ela|eles|elas)\b/i;

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
  // Empieza por letra o cifra: «, CC BY-NC, according to The Conversation» salió de titular.
  if (!/^[\p{L}\p{N}¿¡]/u.test(t)) return false;
  // Sin exclamaciones: «¡Está intratable! Doblete de Lamine Yamal…» es tono de la fuente, no de un
  // periódico serio (30-09-2026).
  if (/[!¡]/.test(t)) return false;
  // En primera persona es la frase de alguien, no un titular: «Era un piso de 50 metros
  // cuadrados, con tres perros y yo sin habitación» (29-09-2026).
  if (/(^|\s)(yo|me siento|nosotros|nosotras|ich|wir|je|nous|noi|nós)(\s|[,.!?]|$)/i.test(t)) return false;
  // «eu»/«io» (portugués, italiano) solo en minúscula o capitalizado: «EU» es la Unión Europea.
  if (/(^|\s)(eu|Eu|io|Io)(\s|[,.!?]|$)/.test(t)) return false;
  if (/^["“«'‘„]/.test(t)) return false;
  const count = (re: RegExp) => (t.match(re) ?? []).length;
  if (count(/«/g) !== count(/»/g) || count(/“/g) !== count(/”/g) || count(/"/g) % 2 !== 0) return false;
  if (/[:;,]$/.test(t)) return false;
  // Una fecha no es un titular: «Miércoles 30 septiembre de 2026, según EFE» (01-10-2026).
  const content = t
    .replace(/,?\s+(según|according to|laut|selon|secondo|segundo)\s.*$/i, '')
    .split(/\s+/)
    .filter((w) => !DATE_WORD.test(w.replace(/[.,:;]$/, '')));
  if (content.length < 3) return false;
  return true;
}

const DATE_WORD =
  /^(\d+|de|del|of|the|le|la|il|da|do|em|en|am|vom|lunes|martes|miércoles|jueves|viernes|sábado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|novembro|dezembro|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|januar|februar|märz|juni|juli|oktober|dezember)$/i;

/**
 * Una frase del cuerpo que hace de titular tiene que nombrar algo (un nombre propio o una cifra)
 * y no empezar por cuándo pasó: «Ambos equipos tuvieron que esperar hasta la última semana» o
 * «Este martes 29 de septiembre se sentaron juntos con Pablo Motos…» no dicen de qué va la
 * noticia (portada del 01-10-2026). Los titulares de las fuentes no pasan por aquí.
 */
export function bodyHeadlineOk(h: string): boolean {
  const t = h.trim();
  if (/^(este|esta|el pasado|la pasada|hoy|ayer|anoche|esta mañana|this|last|earlier|today|yesterday|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ce|cette|hier|aujourd'hui|questo|questa|ieri|oggi|stamattina|nesta|neste|ontem|hoje|am|gestern|heute|diesen|dieser)\b/i.test(t)) return false;
  const rest = t.split(/\s+/).slice(1);
  return rest.some((w) => /^\p{Lu}/u.test(w) || /\d/.test(w));
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currencyCode(unit: string): string {
  const c = unit.split(':')[1];
  return c === 'PESO' ? 'MXN' : c;
}

function formatValue(v: string, nf: Intl.NumberFormat, lang = 'es'): string {
  const n = Number(v);
  if (Number.isFinite(n) && v.trim() !== '') return nf.format(n);
  // Lugares: «city:es-madrid» es una clave interna; el lector ve «Madrid» (29-09-2026).
  const [kind, code] = v.split(':');
  if (kind === 'city' && code) {
    const c = CITIES.find((x) => x.key === code);
    return c ? (c.names[lang] ?? c.names.en ?? code) : code;
  }
  if (kind === 'region' && code) {
    const r = regionByCode(code);
    return r ? ((r.names as Record<string, string>)[lang] ?? (r.names as Record<string, string>).en ?? code) : code;
  }
  if (kind === 'country' && code) return country(code)?.names[lang] ?? code;
  return v;
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

function ngrams(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

/**
 * Reparto del texto escrito entre los textos de las fuentes, como lo mide el control legal: una
 * frase «es» de todos los textos que la contienen (la mitad de sus tetragramas o más).
 */
export class SourceShares {
  private readonly grams: Set<string>[];
  private readonly tally: number[];
  private total = 0;

  constructor(texts: string[]) {
    this.grams = texts.map((t) => ngrams(plainWords(t), 4));
    this.tally = texts.map(() => 0);
  }

  holders(s: string): number[] {
    const g = [...ngrams(plainWords(s), 4)];
    if (!g.length) return [];
    return this.grams.flatMap((set, i) => (g.filter((x) => set.has(x)).length / g.length >= 0.5 ? [i] : []));
  }

  /** ¿Cabe la frase sin que ningún texto de fuente pase de `cap` del total? (Las primeras 40 palabras, libres.) */
  fits(s: string, cap = 0.45): boolean {
    const w = plainWords(s).length;
    if (this.total + w <= 40) return true;
    return this.holders(s).every((i) => (this.tally[i] + w) / (this.total + w) <= cap);
  }

  add(s: string): void {
    const w = plainWords(s).length;
    for (const i of this.holders(s)) this.tally[i] += w;
    this.total += w;
  }

  sameHolder(a: string, b: string): boolean {
    const ha = new Set(this.holders(a));
    return this.holders(b).some((i) => ha.has(i));
  }
}
