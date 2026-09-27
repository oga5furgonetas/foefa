/**
 * ESCENARIO DEMO. Todo lo de este fichero es FICTICIO y se marca como tal:
 * - las fuentes llevan is_demo = true y "Demo" en el nombre;
 * - las historias y artículos que generan heredan is_demo = true;
 * - la web solo los muestra con DEMO_MODE=1, con un aviso visible, sin
 *   indexar y sin mezclarlos jamás con noticias reales.
 * Sirve para ver el producto funcionando sin red y para las pruebas de
 * extremo a extremo del pipeline. Los hechos son deliberadamente anodinos
 * (ferias, bibliotecas, líneas de autobús) para que nadie los tome por
 * noticias reales.
 */
import type { SourceSeed } from '../config/sources';

export const DEMO_FEED_BASE = process.env.DEMO_FEED_BASE ?? 'http://127.0.0.1:4545';

type DemoItem = {
  id: string;
  title: string;
  text: string;
  minutesAgo?: number;
  daysAgo?: number;
  /** Solo aparece en la fase indicada (1 = primera lectura, 2 = actualización). */
  phase?: 1 | 2;
};

type DemoSource = SourceSeed & { items: DemoItem[]; format?: 'rss' | 'geojson' };

const src = (s: Omit<DemoSource, 'homepageUrl' | 'feedUrl' | 'connector'> & { format?: 'rss' | 'geojson' }): DemoSource => ({
  ...s,
  homepageUrl: `https://${s.slug}.demo.invalid`,
  feedUrl: `${DEMO_FEED_BASE}/feeds/${s.slug}.${s.format === 'geojson' ? 'json' : 'xml'}`,
  connector: s.format === 'geojson' ? 'geojson' : 'rss',
  fetchIntervalMinutes: 5,
});

export const DEMO_SOURCES: DemoSource[] = [
  // ─────────── España ───────────
  src({
    slug: 'demo-agencia',
    name: 'Agencia Demo',
    sourceType: 'wire_agency',
    countryCode: 'ES',
    languages: ['es'],
    ownershipGroup: 'demo-agencia',
    prior: [14, 3],
    items: [
      { id: 'feria', title: 'La Feria Demo de Tecnología abre en Madrid con 120 expositores', text: 'La Feria Demo de Tecnología abrió este martes sus puertas en Madrid con 120 expositores de 14 países. La organización de la Feria Demo prevé recibir a 30.000 visitantes hasta el domingo.', minutesAgo: 150 },
      { id: 'maraton', title: 'El Maratón Demo de Valencia reúne a 12.000 corredores', text: 'El Maratón Demo de Valencia reunió este domingo a 12.000 corredores, según la organización de la prueba, que recorrió el centro de Valencia.', minutesAgo: 95 },
      { id: 'embalses-1', title: 'Los embalses de la Cuenca Demo están al 41 % de su capacidad', text: 'Los embalses de la Cuenca Demo del Tajo están al 41 % de su capacidad, según el último parte de la Confederación Demo, publicado este lunes en Madrid.', minutesAgo: 420, phase: 1 },
      { id: 'embalses-2', title: 'Los embalses de la Cuenca Demo suben al 43 % tras las lluvias', text: 'Los embalses de la Cuenca Demo del Tajo están al 43 % de su capacidad tras las lluvias, según el último parte de la Confederación Demo, publicado este martes en Madrid.', minutesAgo: 20, phase: 2 },
    ],
  }),
  src({
    slug: 'demo-diario',
    name: 'Diario Demo',
    sourceType: 'reputable_media',
    countryCode: 'ES',
    languages: ['es'],
    ownershipGroup: 'grupo-demo-uno',
    prior: [11, 3],
    items: [
      { id: 'feria', title: 'Madrid acoge la Feria Demo de Tecnología con 120 expositores', text: 'Un total de 120 expositores participan en la Feria Demo de Tecnología, que se celebra en Madrid hasta el domingo. Los organizadores de la Feria Demo esperan 30.000 visitantes.', minutesAgo: 120 },
      { id: 'bus', title: 'El Consorcio Demo de Transporte creará una nueva línea de autobús en Vigo', text: 'El Consorcio Demo de Transporte creará una nueva línea de autobús en Vigo que unirá el centro con el hospital, según ha podido saber este diario. La línea tendrá 18 paradas.', minutesAgo: 60 },
      { id: 'maraton', title: 'Récord de participación en el Maratón Demo de Valencia: 25.000 corredores', text: 'El Maratón Demo de Valencia reunió este domingo a 25.000 corredores, según la organización de la prueba, que recorrió el centro de Valencia.', minutesAgo: 94 },
      { id: 'embalses-1', title: 'Los embalses de la Cuenca Demo, al 41 %', text: 'La Confederación Demo del Tajo informó de que los embalses de la Cuenca Demo del Tajo están al 41 % de su capacidad, según su último parte semanal publicado en Madrid.', minutesAgo: 400, phase: 1 },
      { id: 'embalses-2', title: 'La reserva de la Cuenca Demo sube al 43 %', text: 'La Confederación Demo del Tajo informó de que los embalses de la Cuenca Demo del Tajo están ya al 43 % de su capacidad tras las lluvias, según su último parte publicado en Madrid.', minutesAgo: 15, phase: 2 },
    ],
  }),
  src({
    slug: 'demo-radio',
    name: 'Radio Demo',
    sourceType: 'reputable_media',
    countryCode: 'ES',
    languages: ['es'],
    ownershipGroup: 'grupo-demo-dos',
    prior: [11, 3],
    items: [{ id: 'feria', title: 'Arranca en Madrid la Feria Demo de Tecnología', text: 'La Feria Demo de Tecnología ha arrancado en Madrid con 120 expositores de 14 países, según ha confirmado la organización de la Feria Demo.', minutesAgo: 100 }],
  }),
  src({
    slug: 'demo-ministerio',
    name: 'Ministerio Demo de Cultura',
    sourceType: 'primary_official',
    countryCode: 'ES',
    languages: ['es'],
    ownershipGroup: 'gobierno-demo',
    prior: [25, 1],
    items: [{ id: 'bibliotecas', title: 'El Ministerio Demo de Cultura amplía el horario de 52 bibliotecas públicas', text: 'El Ministerio Demo de Cultura ha aprobado ampliar el horario de 52 bibliotecas públicas, que abrirán también los domingos a partir del 1 de noviembre de 2026.', minutesAgo: 80 }],
  }),
  src({
    slug: 'demo-satira',
    name: 'El Satírico Demo',
    sourceType: 'reputable_media',
    countryCode: 'ES',
    languages: ['es'],
    isSatire: true,
    items: [{ id: 'lunes', title: 'Madrid prohibirá los lunes a partir de 2027', text: 'El Ayuntamiento Demo de Madrid aprobó ayer eliminar los lunes del calendario laboral a partir de 2027 para mejorar el ánimo de los vecinos.', minutesAgo: 70 }],
  } as DemoSource),
  src({
    slug: 'demo-red-social',
    name: 'Red Social Demo',
    sourceType: 'social_media',
    countryCode: 'ES',
    languages: ['es'],
    prior: [1, 9],
    items: Array.from({ length: 12 }, (_, i) => ({
      id: `rumor-${i}`,
      title: `URGENTE cierran todo el Metro Demo de Madrid esta noche ${i + 1}`,
      text: `Me dicen que cierran todo el Metro Demo de Madrid esta noche, compartid antes de que lo borren (${i + 1})`,
      minutesAgo: 5 + i * 2,
    })),
  }),
  src({
    slug: 'demo-blog',
    name: 'Blog Demo',
    sourceType: 'blog',
    countryCode: 'ES',
    languages: ['es'],
    prior: [3, 5],
    items: [
      { id: 'bus-copia', title: 'Nueva línea de autobús en Vigo', text: 'El Consorcio Demo de Transporte creará una nueva línea de autobús en Vigo que unirá el centro con el hospital, según ha podido saber este diario. La línea tendrá 18 paradas.', minutesAgo: 40 },
    ],
  }),
  // ─────────── Estados Unidos ───────────
  src({
    slug: 'demo-wire-us',
    name: 'Demo Wire US',
    sourceType: 'wire_agency',
    countryCode: 'US',
    languages: ['en'],
    ownershipGroup: 'demo-wire-us',
    prior: [14, 3],
    items: [
      { id: 'bikes', title: 'Chicago Demo council approves 40 miles of new bike lanes', text: 'The Chicago Demo City Council approved on Tuesday a plan to build 40 miles of protected bike lanes in Chicago over the next three years, council officials said.', minutesAgo: 130 },
      { id: 'fair-en', title: 'Demo Technology Fair opens in Madrid with 120 exhibitors', text: 'The Demo Technology Fair opened in Madrid on Tuesday with 120 exhibitors from 14 countries, organisers of the Demo Technology Fair said.', minutesAgo: 110 },
    ],
  }),
  src({
    slug: 'demo-times',
    name: 'The Demo Times',
    sourceType: 'reputable_media',
    countryCode: 'US',
    languages: ['en'],
    ownershipGroup: 'demo-times-co',
    prior: [11, 3],
    items: [{ id: 'bikes', title: 'Chicago Demo council backs 40-mile bike lane plan', text: 'Chicago will add 40 miles of protected bike lanes after the Chicago Demo City Council voted 38 to 12 for the plan on Tuesday.', minutesAgo: 90 }],
  }),
  src({
    slug: 'demo-herald',
    name: 'Demo City Herald',
    sourceType: 'reputable_media',
    countryCode: 'US',
    languages: ['en'],
    ownershipGroup: 'demo-herald-media',
    prior: [10, 3],
    items: [{ id: 'bikes', title: 'Bike lanes: Chicago Demo council vote passes 38-12', text: 'The Chicago Demo City Council passed the protected bike lane plan 38 to 12, adding 40 miles of lanes in Chicago by 2029, the council said.', minutesAgo: 75 }],
  }),
  src({
    slug: 'demo-sismos',
    name: 'Demo Seismic Service',
    sourceType: 'primary_official',
    countryCode: 'US',
    languages: ['en'],
    ownershipGroup: 'demo-seismic',
    prior: [30, 1],
    format: 'geojson',
    config: { minMagnitude: 4.5 },
    items: [{ id: 'quake', title: 'M 5.6 - 35 km NNE of Demo Point', text: '5.6|35 km NNE of Demo Point|10.2', minutesAgo: 25 }],
  }),
  // ─────────── Alemania ───────────
  src({
    slug: 'demo-agentur',
    name: 'Demo-Agentur',
    sourceType: 'wire_agency',
    countryCode: 'DE',
    languages: ['de'],
    ownershipGroup: 'demo-agentur',
    prior: [14, 3],
    items: [{ id: 'strom', title: 'Demo-Stadtwerke Berlin senken den Strompreis um 8 Prozent', text: 'Die Demo-Stadtwerke Berlin senken zum 1. Januar 2027 den Strompreis für Haushaltskunden um 8 Prozent, teilte das Unternehmen am Dienstag in Berlin mit.', minutesAgo: 140 }],
  }),
  src({
    slug: 'demo-zeitung',
    name: 'Demo Zeitung',
    sourceType: 'reputable_media',
    countryCode: 'DE',
    languages: ['de'],
    ownershipGroup: 'demo-zeitungsgruppe',
    prior: [11, 3],
    items: [{ id: 'strom', title: 'Berlin: Demo-Stadtwerke senken Strompreis um 8 Prozent', text: 'Die Demo-Stadtwerke Berlin senken den Strompreis für Haushaltskunden um 8 Prozent. Die Senkung gilt ab dem 1. Januar 2027, wie die Demo-Stadtwerke in Berlin bestätigten.', minutesAgo: 100 }],
  }),
  // ─────────── Francia ───────────
  src({
    slug: 'demo-agence',
    name: 'Agence Démo',
    sourceType: 'wire_agency',
    countryCode: 'FR',
    languages: ['fr'],
    ownershipGroup: 'agence-demo',
    prior: [14, 3],
    items: [{ id: 'biblio', title: 'La Bibliothèque Démo de Paris ouvrira le dimanche dès novembre', text: 'La Bibliothèque Démo de Paris ouvrira le dimanche à partir du 2 novembre 2026, a annoncé mardi la direction de la Bibliothèque Démo, qui prévoit 3 000 visiteurs supplémentaires par semaine.', minutesAgo: 130 }],
  }),
  src({
    slug: 'demo-quotidien',
    name: 'Le Quotidien Démo',
    sourceType: 'reputable_media',
    countryCode: 'FR',
    languages: ['fr'],
    ownershipGroup: 'groupe-quotidien-demo',
    prior: [11, 3],
    items: [{ id: 'biblio', title: 'Paris : la Bibliothèque Démo ouvrira le dimanche', text: 'À Paris, la Bibliothèque Démo sera ouverte le dimanche à partir du 2 novembre 2026. La direction de la Bibliothèque Démo attend 3 000 visiteurs supplémentaires par semaine.', minutesAgo: 90 }],
  }),
  // ─────────── Reino Unido ───────────
  src({
    slug: 'demo-department',
    name: 'Demo Department for Libraries (UK)',
    sourceType: 'primary_official',
    countryCode: 'GB',
    languages: ['en'],
    ownershipGroup: 'demo-uk-government',
    prior: [25, 1],
    items: [{ id: 'grant', title: 'Demo Department announces grant for 25 London libraries', text: 'The Demo Department for Libraries has announced a grant of 4 million pounds to refurbish 25 public libraries in London, the department said on Tuesday.', minutesAgo: 115 }],
  }),
  src({
    slug: 'demo-chronicle',
    name: 'The Demo Chronicle',
    sourceType: 'reputable_media',
    countryCode: 'GB',
    languages: ['en'],
    ownershipGroup: 'demo-chronicle-group',
    prior: [11, 3],
    items: [
      { id: 'grant', title: 'London libraries to get grant from Demo Department', text: 'Twenty-five London libraries will be refurbished with a grant of 4 million pounds from the Demo Department for Libraries, the department said.', minutesAgo: 80 },
      { id: 'snow-old', title: 'Heavy snow closes Demo Airport in Manchester', text: 'Heavy snow closed Demo Airport in Manchester on 2 February 2024, cancelling 200 flights, the airport said.', daysAgo: 970 },
    ],
  }),
  src({
    slug: 'demo-social-uk',
    name: 'Demo Social Network',
    sourceType: 'social_media',
    countryCode: 'GB',
    languages: ['en'],
    prior: [1, 9],
    items: Array.from({ length: 6 }, (_, i) => ({
      id: `snow-${i}`,
      title: `Heavy snow closes Demo Airport in Manchester right now ${i + 1}`,
      text: `Heavy snow closes Demo Airport in Manchester, 200 flights cancelled, look at this (${i + 1})`,
      minutesAgo: 10 + i,
    })),
  }),
  // ─────────── Italia ───────────
  src({
    slug: 'demo-agenzia',
    name: 'Agenzia Demo',
    sourceType: 'wire_agency',
    countryCode: 'IT',
    languages: ['it'],
    ownershipGroup: 'agenzia-demo',
    prior: [14, 3],
    items: [{ id: 'museo', title: 'Il Museo Demo di Roma sarà gratuito la prima domenica del mese', text: 'Il Museo Demo di Roma sarà gratuito la prima domenica di ogni mese a partire da novembre, ha annunciato martedì la direzione del Museo Demo, che prevede 5.000 visitatori in più.', minutesAgo: 125 }],
  }),
  src({
    slug: 'demo-giornale',
    name: 'Giornale Demo',
    sourceType: 'reputable_media',
    countryCode: 'IT',
    languages: ['it'],
    ownershipGroup: 'gruppo-giornale-demo',
    prior: [11, 3],
    items: [{ id: 'museo', title: 'Roma, Museo Demo gratis la prima domenica del mese', text: 'A Roma il Museo Demo aprirà gratuitamente la prima domenica di ogni mese da novembre. La direzione del Museo Demo stima 5.000 visitatori in più.', minutesAgo: 85 }],
  }),
  // ─────────── Brasil ───────────
  src({
    slug: 'demo-agencia-br',
    name: 'Agência Demo Brasil',
    sourceType: 'wire_agency',
    countryCode: 'BR',
    languages: ['pt'],
    ownershipGroup: 'agencia-demo-br',
    prior: [14, 3],
    items: [{ id: 'parque', title: 'Prefeitura Demo de São Paulo anuncia novo parque com 300 árvores', text: 'A Prefeitura Demo de São Paulo anunciou nesta terça-feira a criação de um novo parque com 300 árvores na zona leste de São Paulo, segundo a Secretaria Demo do Verde.', minutesAgo: 135 }],
  }),
  src({
    slug: 'demo-jornal',
    name: 'Jornal Demo',
    sourceType: 'reputable_media',
    countryCode: 'BR',
    languages: ['pt'],
    ownershipGroup: 'grupo-jornal-demo',
    prior: [11, 3],
    items: [{ id: 'parque', title: 'São Paulo terá novo parque com 300 árvores, diz Prefeitura Demo', text: 'O novo parque da zona leste de São Paulo terá 300 árvores, informou a Prefeitura Demo de São Paulo. A Secretaria Demo do Verde coordena o projeto.', minutesAgo: 95 }],
  }),
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Genera el feed de una fuente DEMO para un instante y fase dados. */
export function renderDemoFeed(slug: string, now: Date, phase: 1 | 2 = 1): { body: string; contentType: string } | null {
  const s = DEMO_SOURCES.find((x) => x.slug === slug);
  if (!s) return null;
  const items = s.items.filter((i) => !i.phase || i.phase === phase || (phase === 2 && i.phase === 1));
  const when = (i: DemoItem) => new Date(now.getTime() - ((i.daysAgo ?? 0) * 1440 + (i.minutesAgo ?? 30)) * 60000);
  if (s.format === 'geojson') {
    const features = items.map((i) => {
      const [mag, place, depth] = i.text.split('|');
      const t = when(i).getTime();
      return {
        type: 'Feature',
        id: `demo${i.id}`,
        properties: { mag: Number(mag), place, time: t, updated: t, url: `${s.homepageUrl}/event/${i.id}`, title: i.title, tsunami: 0, type: 'earthquake', alert: null, sig: 500 },
        geometry: { type: 'Point', coordinates: [-120.5, 36.1, Number(depth)] },
      };
    });
    return { body: JSON.stringify({ type: 'FeatureCollection', features }), contentType: 'application/geo+json' };
  }
  const lang = s.languages[0] ?? 'en';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${xmlEscape(s.name)} (DEMO)</title>
<link>${s.homepageUrl}</link>
<description>Fuente ficticia para demostración. No publica noticias reales.</description>
<language>${lang}</language>
${items
  .map(
    (i) => `<item>
<title>${xmlEscape(i.title)}</title>
<link>${s.homepageUrl}/n/${i.id}</link>
<guid>${s.slug}-${i.id}</guid>
<pubDate>${when(i).toUTCString()}</pubDate>
<description>${xmlEscape(i.text)}</description>
</item>`,
  )
  .join('\n')}
</channel>
</rss>`;
  return { body: xml, contentType: 'application/rss+xml; charset=utf-8' };
}

/**
 * fetch() que sirve los feeds DEMO en memoria (sin red). Lo usan
 * `demo:seed`, las pruebas de integración y el servidor de fixtures.
 */
export function demoFetch(getNow: () => Date = () => new Date(), getPhase: () => 1 | 2 = () => 1): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
    const m = url.pathname.match(/^\/feeds\/([a-z0-9-]+)\.(xml|json)$/);
    const feed = m ? renderDemoFeed(m[1], getNow(), getPhase()) : null;
    if (!feed) return new Response('not found', { status: 404 });
    return new Response(feed.body, { status: 200, headers: { 'content-type': feed.contentType } });
  }) as typeof fetch;
}
