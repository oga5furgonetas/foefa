/**
 * Imagen con licencia libre desde Wikimedia Commons para las noticias sin foto.
 *
 * Qué foto: la del PROTAGONISTA del titular (la persona, el equipo, el huracán, la
 * empresa…) y, si no la hay, la del LUGAR de la noticia. Es una foto de archivo, no
 * del acontecimiento, y así se rotula, con autor y licencia (Dani, 01-10-2026: «las
 * que encuentres oportunas que den referencia a lo que se hable»).
 *
 * Cómo se evita la foto equivocada:
 * - Solo páginas de Wikipedia que no son de desambiguación, con imagen principal en
 *   Commons con licencia libre (CC0, dominio público, CC BY o CC BY-SA; nunca NC, ND
 *   ni «uso legítimo»), en JPEG/WebP, grande y que no sea bandera, mapa, logo o escudo.
 * - Un protagonista tiene que salir en el titular, ser un nombre propio de verdad
 *   (dos palabras, o una que Wikipedia redirige a un nombre completo: «Milei» →
 *   «Javier Milei») y su página tiene que hablar de lo mismo que la noticia
 *   (comparten palabras con significado): «Yamal» no trae la península rusa a una
 *   noticia de fútbol, ni «Apple» la fruta a una de móviles.
 * - En sucesos, acusaciones y muertes, nunca la cara de nadie: solo el lugar.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, media, stories } from '../db/schema';
import { userAgent } from '../ingest/fetcher';
import { extractEntities, findPlaces } from '../text/entities';
import { fold } from '../text/normalize';
import { STOPWORDS } from '../text/tokenize';
import { bodyText } from '../writing/draft';

export type FoundImage = {
  title: string;
  /** Título de la página en cada idioma (para el pie de foto). */
  titles: Record<string, string>;
  kind: 'place' | 'subject';
  url: string;
  width: number;
  height: number;
  license: string;
  licenseUrl: string | null;
  author: string | null;
  attribution: string;
  sourceUrl: string;
};

/** Nombre que buscar en Wikipedia. `place`: topónimo del diccionario (no hace falta comprobar el tema). */
export type ImageCandidate = { name: string; lang: string; place: boolean; trusted?: boolean };

type Fetch = typeof fetch;
const FREE_LICENSE = /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d)/i;
const NOT_FREE = /\b(nc|nd)\b|non-?commercial|no ?derivs|fair use/i;
const PHOTO = /^image\/(jpeg|webp)$/;
/** Banderas, mapas, logos, escudos, firmas: no son una foto de lo que se habla. */
const NOT_A_PHOTO = /flag|bandera|drapeau|flagge|bandiera|bandeira|\bmaps?\b|mapa|karte|carte|locator|location|logo|escudo|coat[_ ]of[_ ]arms|wappen|blason|stemma|bras[aã]o|signature|firma|unterschrift|seal|sello|emblem/i;
const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'];
/**
 * Sucesos, acusaciones, muertes: no se pone la cara de nadie, solo el lugar. Poner la
 * foto de una persona junto a «detenido» o «muere» la asocia a algo que quizá no le toca.
 */
const SENSITIVE =
  /detenid|arrestad|acusad|imputad|investigad|condenad|presunt|asesin|homicid|violaci|violad|abus|agresi|apu[ñn]al|tirote|balead|disparo|muert|muri|fallec|cad[aá]ver|v[ií]ctima|herid|secuestr|estaf|fraude|corrupci|esc[aá]ndalo|denunci|arrest|charged|accused|convicted|sentenced|murder|killed|dead|death|\bdies\b|\bdied\b|rape|abuse|assault|stabb|shoot|victim|kidnap|fraud|scandal|lawsuit|festgenommen|verhaftet|angeklagt|verurteilt|\bmord|get[öo]tet|\btot\b|\btote|stirbt|gestorben|vergewaltig|missbrauch|opfer|betrug|arr[eê]t[ée]|interpell|accus[ée]|inculp|condamn|meurtre|\btu[ée]\b|\bmort|d[ée]c[eè]s|d[ée]c[ée]d|\bviol\b|agression|victime|plainte|arrestat|accusat|indagat|condannat|omicid|uccis|morto|morte|stupr|aggress|vittim|truff|preso|detido|morreu|estupro|agress[aã]o|v[ií]tima/i;

/** Palabras demasiado corrientes para decir que dos textos hablan de lo mismo. */
const GENERIC = new Set(
  'ademas antes anterior actual actualmente segun tambien durante mientras primera primero segunda segundo tercer ultimo ultima ultimos nuevo nueva nuevos nuevas grande grandes general mundo mundial nacional internacional parte partes forma lugar tiempo veces personas persona millones millon numero mayor menor principal principales importante historia public publico publica siglo years where which their there these those other about after before since first second later during world national international million number known called including became being around under major state states government country people today group groups company called through within while could would should might partie autres apres avant depuis encore aussi entre selon monde national grand grande premier premiere nouveau nouvelle personnes millions nombre plusieurs pendant contre toujours werden wurde wurden worden durch einer eines einem seine seiner nicht noch schon sowie zwischen nach welt jahre jahren ersten zweiten neuen grossen menschen millionen anche dopo prima ancora sempre durante mondo nazionale grande nuova nuovo milioni numero persone ainda depois antes durante mundo nacional grande nova novo milhoes numero pessoas'
    .split(' '),
);

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
}

/** Palabras con significado (≥ 5 letras, sin palabras vacías ni corrientes), plegadas. */
function meaningful(s: string): Set<string> {
  const stop = new Set(Object.values(STOPWORDS).flatMap((x) => [...x]));
  return new Set(
    fold(s)
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= 5 && !stop.has(w) && !GENERIC.has(w)),
  );
}

/** Cuántas palabras con significado comparte la página de Wikipedia con la noticia (sin contar el propio nombre). */
export function topicOverlap(extract: string, storyText: string, name: string): number {
  const own = meaningful(name);
  const story = meaningful(storyText);
  let n = 0;
  for (const w of meaningful(extract)) if (!own.has(w) && story.has(w)) n++;
  return n;
}

async function getJson(fetchImpl: Fetch, url: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': userAgent(), accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

type FindOpts = {
  fetchImpl?: Fetch;
  minWidth?: number;
  /** Texto de la noticia (todos sus idiomas): la página del protagonista tiene que hablar de lo mismo. */
  storyText?: string;
  /** Solo lugares (sucesos, o quien llama así lo pide). */
  placesOnly?: boolean;
  /** Mínimo de palabras en común entre la página y la noticia para un protagonista. */
  minOverlap?: number;
};

/** Primera imagen válida de la lista de candidatos (en su orden), o null. */
export async function findStoryImage(candidates: ImageCandidate[], opts: FindOpts = {}): Promise<FoundImage | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const minWidth = opts.minWidth ?? 640;
  const minOverlap = opts.minOverlap ?? 2;
  const tried = new Set<string>();
  for (const cand of candidates) {
    for (const wiki of [...new Set([cand.lang, 'en'])]) {
      const key = `${wiki}:${fold(cand.name)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const q = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        redirects: '1',
        prop: 'pageimages|coordinates|pageprops|extracts|langlinks',
        piprop: 'name',
        ppprop: 'disambiguation',
        exintro: '1',
        explaintext: '1',
        exchars: '800',
        lllimit: 'max',
        titles: cand.name,
      });
      const wp = await getJson(fetchImpl, `https://${wiki}.wikipedia.org/w/api.php?${q}`);
      const page = wp?.query?.pages?.[0];
      if (!page || page.missing || !page.pageimage || page.pageprops?.disambiguation !== undefined) continue;
      const isPlace = !!page.coordinates?.length;
      // Los edificios elegidos a mano (parlamentos) valen aunque su página no traiga coordenadas.
      if (opts.placesOnly && !isPlace && !cand.trusted) continue;
      const title = String(page.title);
      if (!cand.trusted && !(cand.place && isPlace)) {
        // Protagonista: nombre propio de verdad y página que habla de lo mismo que la noticia.
        // Una sola palabra vale si Wikipedia la lleva a un nombre completo que la contiene
        // («Milei» → «Javier Milei»), no a otra cosa («Hombre» → «Ser humano»).
        // También un nombre artístico o deportivo de una palabra («Raphinha», «Shakira») si su
        // página es una biografía (fecha de nacimiento entre paréntesis al empezar).
        const one = fold(cand.name).split(/\s+/);
        const target = fold(title).split(/[\s,()]+/).filter(Boolean);
        const biography = /^[^(]{0,80}\([^)]*\b(1[89]\d\d|20[0-2]\d)\b/.test(String(page.extract ?? ''));
        if (one.length < 2 && !biography && (target.length < 2 || !target.includes(one[0]))) continue;
        if (opts.storyText === undefined || topicOverlap(String(page.extract ?? ''), opts.storyText, `${cand.name} ${title}`) < minOverlap) continue;
      }
      if (NOT_A_PHOTO.test(String(page.pageimage))) continue;
      const c = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280', titles: `File:${page.pageimage}` });
      const cm = await getJson(fetchImpl, `https://commons.wikimedia.org/w/api.php?${c}`);
      const file = cm?.query?.pages?.[0];
      const info = file?.imageinfo?.[0];
      // Si no está en Commons (imagen local «de uso legítimo»), no vale.
      if (!file || file.missing || !info) continue;
      const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>;
      const license = stripHtml(meta.LicenseShortName?.value ?? '');
      if (!FREE_LICENSE.test(license) || NOT_FREE.test(license) || meta.NonFree?.value === 'true') continue;
      if (!PHOTO.test(info.mime ?? '') || (info.width ?? 0) < minWidth) continue;
      const author = stripHtml(meta.Artist?.value ?? '') || null;
      const titles: Record<string, string> = { [wiki]: title };
      for (const l of (page.langlinks ?? []) as { lang: string; title: string }[]) if (LANGS.includes(l.lang)) titles[l.lang] = l.title;
      return {
        title,
        titles,
        kind: isPlace ? 'place' : 'subject',
        url: info.thumburl ?? info.url,
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        author,
        attribution: `${author ? `${author} / ` : ''}Wikimedia Commons`,
        sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`,
      };
    }
  }
  return null;
}

/** Solo lugares (la ciudad, región o país), en las Wikipedias indicadas. */
export async function findPlaceImage(names: string[], opts: { fetchImpl?: Fetch; wikis?: string[]; minWidth?: number } = {}): Promise<FoundImage | null> {
  const wikis = opts.wikis ?? ['en'];
  return findStoryImage(
    names.flatMap((name) => wikis.map((lang) => ({ name, lang, place: true }))),
    { fetchImpl: opts.fetchImpl, minWidth: opts.minWidth, placesOnly: true },
  );
}

/**
 * La página de un país lleva de imagen su bandera o su mapa: para un país se usa su capital
 * (título de la Wikipedia en inglés).
 */
const CAPITALS: Record<string, string> = {
  ES: 'Madrid', US: 'Washington, D.C.', MX: 'Mexico City', AR: 'Buenos Aires', CO: 'Bogotá', CL: 'Santiago', PE: 'Lima', VE: 'Caracas', EC: 'Quito',
  UY: 'Montevideo', PY: 'Asunción', BO: 'La Paz', BR: 'Brasília', CU: 'Havana', DO: 'Santo Domingo', GT: 'Guatemala City', HN: 'Tegucigalpa',
  SV: 'San Salvador', NI: 'Managua', CR: 'San José, Costa Rica', PA: 'Panama City', GB: 'London', IE: 'Dublin', CA: 'Ottawa', AU: 'Canberra',
  DE: 'Berlin', AT: 'Vienna', CH: 'Bern', FR: 'Paris', BE: 'Brussels', NL: 'Amsterdam', IT: 'Rome', PT: 'Lisbon', RU: 'Moscow', UA: 'Kyiv',
  PL: 'Warsaw', CN: 'Beijing', JP: 'Tokyo', KR: 'Seoul', IN: 'New Delhi', IL: 'Jerusalem', IR: 'Tehran', TR: 'Ankara', SA: 'Riyadh', EG: 'Cairo',
  MA: 'Rabat', GR: 'Athens', SE: 'Stockholm', NO: 'Oslo', DK: 'Copenhagen', FI: 'Helsinki', HU: 'Budapest', CZ: 'Prague', RO: 'Bucharest',
  VA: 'Vatican City', SY: 'Damascus', LB: 'Beirut', IQ: 'Baghdad', AF: 'Kabul', PK: 'Islamabad', ZA: 'Pretoria', NG: 'Abuja', KE: 'Nairobi',
};

/** Secciones en las que la capital ilustra la noticia de un país (gobierno, economía): no en deportes ni cultura. */
const CAPITAL_SECTIONS = new Set(['politics', 'economy', 'business', 'society', 'world']);

/**
 * Último recurso para una noticia de política sin persona ni lugar en el titular («PSOE y Sumar
 * alcanzan un acuerdo…», 01-10-2026): el parlamento del país (título de la Wikipedia en inglés).
 */
const PARLIAMENTS: Record<string, string> = {
  ES: 'Palacio de las Cortes', US: 'United States Capitol', MX: 'Legislative Palace of San Lázaro', AR: 'Palace of the Argentine National Congress',
  PE: 'Legislative Palace (Peru)', BR: 'National Congress Palace', GB: 'Palace of Westminster', FR: 'Palais Bourbon', IT: 'Palazzo Montecitorio',
};

/**
 * Candidatos de una noticia, en orden: primero los protagonistas del titular por su posición (el
 * sujeto suele ir delante), probando ese nombre en todos los idiomas antes de pasar al siguiente
 * («Trump» antes que «Ormuz»); luego los lugares del titular y, por último, los del resumen que
 * sean del país de la noticia (una de Boeing no lleva foto de Bagdad). Un país, por su capital,
 * solo en política, economía o sociedad (una lesión de Raphinha no lleva foto de Brasilia).
 * `context` (el texto completo) sirve para completar un apellido suelto con el nombre entero que
 * sale en el texto («Galán» → «Carlos Fernando Galán»); `exclude`, para no buscar las fuentes
 * citadas («según Infobae»).
 */
export function imageCandidates(
  arts: { language: string; headline: string; summary: string | null }[],
  opts: { context?: string; exclude?: string[]; categoryId?: string | null; countryCode?: string | null } = {},
): ImageCandidate[] {
  const seen = new Set<string>((opts.exclude ?? []).map((s) => fold(s)));
  const full = opts.context ? extractEntities(opts.context).filter((e) => e.type !== 'place' && e.name.split(/\s+/).length >= 2) : [];
  const capitals = !opts.categoryId || CAPITAL_SECTIONS.has(opts.categoryId);
  type Ranked = ImageCandidate & { rank: number };
  const subjects: Ranked[] = [];
  const places: Ranked[] = [];
  const push = (list: Ranked[], c: Ranked) => {
    const k = `${c.lang}:${fold(c.name)}`;
    if (seen.has(fold(c.name)) || seen.has(k)) return;
    seen.add(k);
    list.push(c);
  };
  const placeCandidate = (name: string, lang: string, rank: number): Ranked | null => {
    const match = findPlaces(name)[0];
    if (match?.kind === 'country') {
      const capital = CAPITALS[match.countryCode];
      return capitals && capital ? { name: capital, lang: 'en', place: true, rank } : null;
    }
    return { name, lang, place: true, rank };
  };
  arts.forEach((a, ai) => {
    const len = Math.max(1, a.headline.length);
    for (const e of extractEntities(a.headline, a.language)) {
      if (!/^\p{Lu}/u.test(e.name)) continue;
      // Posición relativa en el titular; a igualdad, el idioma que va antes.
      const rank = a.headline.indexOf(e.name) / len + ai * 0.001;
      if (e.type === 'place') {
        const p = placeCandidate(e.name, a.language, rank);
        if (p) push(places, p);
        continue;
      }
      // Apellido suelto: el nombre completo si el texto lo da (y solo hay uno que encaje).
      const longer = e.name.split(/\s+/).length === 1 ? full.filter((f) => fold(f.name).split(/\s+/).includes(fold(e.name))) : [];
      push(subjects, { name: longer.length === 1 ? longer[0].name : e.name, lang: a.language, place: false, rank });
    }
  });
  const fromSummary: Ranked[] = [];
  arts.forEach((a, ai) => {
    for (const e of extractEntities(a.summary ?? '', a.language)) {
      if (e.type !== 'place') continue;
      const cc = findPlaces(e.name)[0]?.countryCode;
      if (opts.countryCode && cc && cc !== opts.countryCode) continue;
      const p = placeCandidate(e.name, a.language, 1 + ai * 0.001);
      if (p) push(fromSummary, p);
    }
  });
  // Último recurso, por el país de la noticia: su parlamento (política) o su capital (economía, sociedad).
  const fallback: Ranked[] = [];
  const cc = opts.countryCode ?? '';
  if (opts.categoryId === 'politics' && PARLIAMENTS[cc]) push(fallback, { name: PARLIAMENTS[cc], lang: 'en', place: true, trusted: true, rank: 2 });
  if (capitals && opts.categoryId && CAPITALS[cc]) push(fallback, { name: CAPITALS[cc], lang: 'en', place: true, rank: 3 });
  const byRank = (x: Ranked, y: Ranked) => x.rank - y.rank;
  return [...subjects.sort(byRank), ...places.sort(byRank), ...fromSummary, ...fallback].map(({ name, lang, place, trusted }) => ({ name, lang, place, ...(trusted ? { trusted } : {}) }));
}

/**
 * Pone foto (de archivo, con licencia libre) a una historia publicada que no tenga ninguna.
 * Nunca a lo DEMO.
 */
export async function attachStoryImage(db: Db, storyId: number, opts: { fetchImpl?: Fetch } = {}): Promise<'attached' | 'exists' | 'none' | 'skipped'> {
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story || story.isDemo) return 'skipped';
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  if (!arts.length) return 'skipped';
  if (arts.some((a) => a.imageId)) return 'exists';
  // Primero los artículos escritos desde las fuentes (no las traducciones); entre ellos, el inglés
  // (la Wikipedia más completa).
  const rank = (a: (typeof arts)[number]) => (a.writer.startsWith('llm-translation') ? 2 : 0) + (a.language === 'en' ? 0 : 1);
  const ordered = [...arts].sort((a, b) => rank(a) - rank(b));
  const storyText = arts.map((a) => `${a.headline}\n${a.summary ?? ''}\n${bodyText(a.body)}`).join('\n');
  const sensitive = arts.some((a) => SENSITIVE.test(`${a.headline} ${a.summary ?? ''}`));
  const sources = [...new Set(arts.flatMap((a) => a.sourcesList.map((s) => s.name)))];
  const cands = imageCandidates(ordered, { context: storyText, exclude: sources, categoryId: arts[0].categoryId, countryCode: arts[0].countryCode });
  const found = await findStoryImage(cands.slice(0, 10), { fetchImpl: opts.fetchImpl, storyText, placesOnly: sensitive });
  if (!found) return 'none';
  const caption = Object.fromEntries(arts.map((a) => [a.language, found.titles[a.language] ?? found.title]));
  const [m] = await db
    .insert(media)
    .values({
      kind: 'image',
      url: found.url,
      width: found.width,
      height: found.height,
      license: found.license,
      licenseUrl: found.licenseUrl,
      attribution: found.attribution,
      author: found.author,
      sourceUrl: found.sourceUrl,
      provider: 'wikimedia',
      isIllustrative: true,
      caption,
      alt: caption,
    })
    .returning({ id: media.id });
  await db.update(articles).set({ imageId: m.id }).where(and(eq(articles.storyId, storyId), isNull(articles.imageId)));
  return 'attached';
}
