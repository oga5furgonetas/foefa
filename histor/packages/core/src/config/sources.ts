/**
 * Registro inicial de fuentes REALES, públicas y legales (RSS/Atom/APIs
 * oficiales). Ninguna URL se da por buena hasta que `npm run sources:check`
 * la descarga, la parsea y comprueba robots.txt: hasta entonces
 * `verifiedAt` queda vacío. Las redes sociales entran en pausa hasta que
 * haya credenciales de sus APIs oficiales.
 *
 * Uso de los contenidos: solo metadatos y hechos para contrastar; nada se
 * republica; se enlaza siempre al original. El texto interno se poda a los
 * 30 días y no se guarda si el editor reserva la minería de textos (TDM).
 */
import type { ConnectorKind, SourceType } from '../domain';

export type SourceSeed = {
  slug: string;
  name: string;
  homepageUrl: string;
  feedUrl: string | null;
  connector: ConnectorKind;
  sourceType: SourceType;
  countryCode: string | null;
  languages: string[];
  ownershipGroup?: string;
  categoryHint?: string;
  fetchIntervalMinutes?: number;
  status?: 'active' | 'paused';
  config?: Record<string, unknown>;
  licenseNotes?: string;
  termsNotes?: string;
  isSatire?: boolean;
  /** Fiabilidad previa (Beta): alpha aciertos, beta fallos "virtuales". */
  prior?: [number, number];
};

const HEADLINES_ONLY = 'Solo titulares, resúmenes y enlaces para contrastar; no se republica contenido.';

export const SOURCE_SEEDS: SourceSeed[] = [
  // ── Fuentes primarias oficiales y organismos ──
  // `corroborateOnly`: boletines, alertas automáticas y notas de prensa institucionales (BOE,
  // GDACS, GOV.UK, BCE, Fed, NASA: cientos de piezas al día, muchas menores) que sirven de
  // prueba pero no originan noticia por sí solas (ver VSource.corroborateOnly).
  {
    slug: 'usgs-earthquakes',
    name: 'USGS Earthquake Hazards Program',
    homepageUrl: 'https://earthquake.usgs.gov',
    feedUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    connector: 'geojson',
    sourceType: 'primary_official',
    countryCode: 'US',
    languages: ['en'],
    ownershipGroup: 'us-federal-government',
    categoryHint: 'science',
    fetchIntervalMinutes: 5,
    config: { minMagnitude: 5.0 },
    licenseNotes: 'Datos de dominio público del Gobierno de EE. UU.',
    prior: [30, 1],
  },
  { slug: 'gdacs', name: 'GDACS (Global Disaster Alert and Coordination System)', homepageUrl: 'https://www.gdacs.org', feedUrl: 'https://www.gdacs.org/xml/rss.xml', connector: 'rss', sourceType: 'official', countryCode: null, languages: ['en'], ownershipGroup: 'un-ec-gdacs', categoryHint: 'world', fetchIntervalMinutes: 15, config: { corroborateOnly: true }, prior: [20, 2] },
  // WHO: su feed dejó de actualizarse en febrero de 2026; sources:check lo pausa por abandonado hasta que vuelva.
  { slug: 'who-news', name: 'World Health Organization', homepageUrl: 'https://www.who.int', feedUrl: 'https://www.who.int/rss-feeds/news-english.xml', connector: 'rss', sourceType: 'primary_official', countryCode: null, languages: ['en'], ownershipGroup: 'un-system', categoryHint: 'health', fetchIntervalMinutes: 30, prior: [20, 2] },
  // ONU: su robots.txt solo deja leer los feeds a Feedfetcher-Google («Disallow: */news/» para el resto): quedan en pausa.
  { slug: 'un-news-en', name: 'UN News', homepageUrl: 'https://news.un.org/en/', feedUrl: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', connector: 'rss', sourceType: 'official', countryCode: null, languages: ['en'], ownershipGroup: 'un-system', categoryHint: 'world', prior: [15, 2] },
  { slug: 'un-news-es', name: 'Noticias ONU', homepageUrl: 'https://news.un.org/es/', feedUrl: 'https://news.un.org/feed/subscribe/es/news/all/rss.xml', connector: 'rss', sourceType: 'official', countryCode: null, languages: ['es'], ownershipGroup: 'un-system', categoryHint: 'world', prior: [15, 2] },
  { slug: 'un-news-fr', name: 'ONU Info', homepageUrl: 'https://news.un.org/fr/', feedUrl: 'https://news.un.org/feed/subscribe/fr/news/all/rss.xml', connector: 'rss', sourceType: 'official', countryCode: null, languages: ['fr'], ownershipGroup: 'un-system', categoryHint: 'world', prior: [15, 2] },
  { slug: 'ecb-press', name: 'European Central Bank', homepageUrl: 'https://www.ecb.europa.eu', feedUrl: 'https://www.ecb.europa.eu/rss/press.html', connector: 'rss', sourceType: 'primary_official', countryCode: null, languages: ['en'], ownershipGroup: 'ecb', categoryHint: 'economy', fetchIntervalMinutes: 30, config: { corroborateOnly: true }, prior: [25, 1] },
  { slug: 'federal-reserve', name: 'Federal Reserve Board', homepageUrl: 'https://www.federalreserve.gov', feedUrl: 'https://www.federalreserve.gov/feeds/press_all.xml', connector: 'rss', sourceType: 'primary_official', countryCode: 'US', languages: ['en'], ownershipGroup: 'us-federal-reserve', categoryHint: 'economy', fetchIntervalMinutes: 30, config: { corroborateOnly: true }, prior: [25, 1] },
  { slug: 'nasa-news', name: 'NASA', homepageUrl: 'https://www.nasa.gov', feedUrl: 'https://www.nasa.gov/news-release/feed/', connector: 'rss', sourceType: 'primary_official', countryCode: 'US', languages: ['en'], ownershipGroup: 'us-federal-government', categoryHint: 'science', fetchIntervalMinutes: 60, config: { corroborateOnly: true }, prior: [20, 1] },
  { slug: 'gov-uk', name: 'GOV.UK', homepageUrl: 'https://www.gov.uk', feedUrl: 'https://www.gov.uk/search/news-and-communications.atom', connector: 'atom', sourceType: 'primary_official', countryCode: 'GB', languages: ['en'], ownershipGroup: 'uk-government', categoryHint: 'politics', fetchIntervalMinutes: 30, licenseNotes: 'Open Government Licence v3.0', config: { corroborateOnly: true }, prior: [20, 2] },
  { slug: 'boe', name: 'Boletín Oficial del Estado', homepageUrl: 'https://www.boe.es', feedUrl: 'https://www.boe.es/rss/boe.php', connector: 'rss', sourceType: 'primary_official', countryCode: 'ES', languages: ['es'], ownershipGroup: 'es-gobierno', categoryHint: 'politics', fetchIntervalMinutes: 60, config: { corroborateOnly: true }, prior: [25, 1] },
  { slug: 'agencia-brasil', name: 'Agência Brasil', homepageUrl: 'https://agenciabrasil.ebc.com.br', feedUrl: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', connector: 'rss', sourceType: 'wire_agency', countryCode: 'BR', languages: ['pt'], ownershipGroup: 'ebc', licenseNotes: 'Contenido bajo CC BY 4.0 (con atribución).', prior: [12, 3] },

  // ── Agencias ──
  { slug: 'europa-press', name: 'Europa Press', homepageUrl: 'https://www.europapress.es', feedUrl: 'https://www.europapress.es/rss/rss.aspx', connector: 'rss', sourceType: 'wire_agency', countryCode: 'ES', languages: ['es'], ownershipGroup: 'europa-press', fetchIntervalMinutes: 10, termsNotes: HEADLINES_ONLY, prior: [14, 3] },
  { slug: 'ansa', name: 'ANSA', homepageUrl: 'https://www.ansa.it', feedUrl: 'https://www.ansa.it/sito/ansait_rss.xml', connector: 'rss', sourceType: 'wire_agency', countryCode: 'IT', languages: ['it'], ownershipGroup: 'ansa', fetchIntervalMinutes: 10, termsNotes: HEADLINES_ONLY, prior: [14, 3] },

  // ── Medios de servicio público y de referencia ──
  { slug: 'bbc-world', name: 'BBC News', homepageUrl: 'https://www.bbc.com/news', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['en'], ownershipGroup: 'bbc', categoryHint: 'world', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'bbc-uk', name: 'BBC News UK', homepageUrl: 'https://www.bbc.com/news/uk', feedUrl: 'https://feeds.bbci.co.uk/news/uk/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['en'], ownershipGroup: 'bbc', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'bbc-mundo', name: 'BBC News Mundo', homepageUrl: 'https://www.bbc.com/mundo', feedUrl: 'https://feeds.bbci.co.uk/mundo/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['es'], ownershipGroup: 'bbc', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'bbc-brasil', name: 'BBC News Brasil', homepageUrl: 'https://www.bbc.com/portuguese', feedUrl: 'https://feeds.bbci.co.uk/portuguese/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['pt'], ownershipGroup: 'bbc', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'guardian-world', name: 'The Guardian', homepageUrl: 'https://www.theguardian.com', feedUrl: 'https://www.theguardian.com/world/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['en'], ownershipGroup: 'guardian-media-group', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'npr', name: 'NPR', homepageUrl: 'https://www.npr.org', feedUrl: 'https://feeds.npr.org/1001/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'npr', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'dw-en', name: 'DW', homepageUrl: 'https://www.dw.com/en', feedUrl: 'https://rss.dw.com/rdf/rss-en-all', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['en'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'dw-de', name: 'DW (Deutsch)', homepageUrl: 'https://www.dw.com/de', feedUrl: 'https://rss.dw.com/rdf/rss-de-all', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'dw-es', name: 'DW (Español)', homepageUrl: 'https://www.dw.com/es', feedUrl: 'https://rss.dw.com/rdf/rss-sp-all', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['es'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'dw-br', name: 'DW Brasil', homepageUrl: 'https://www.dw.com/pt-br', feedUrl: 'https://rss.dw.com/rdf/rss-br-top', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['pt'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'tagesschau', name: 'tagesschau', homepageUrl: 'https://www.tagesschau.de', feedUrl: 'https://www.tagesschau.de/xml/rss2/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'ard', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'zdf-heute', name: 'ZDFheute', homepageUrl: 'https://www.zdf.de/nachrichten', feedUrl: 'https://www.zdf.de/rss/zdf/nachrichten', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'zdf', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'spiegel', name: 'DER SPIEGEL', homepageUrl: 'https://www.spiegel.de', feedUrl: 'https://www.spiegel.de/schlagzeilen/index.rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'spiegel-gruppe', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'france24-fr', name: 'France 24', homepageUrl: 'https://www.france24.com/fr/', feedUrl: 'https://www.france24.com/fr/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'france24-en', name: 'France 24 (English)', homepageUrl: 'https://www.france24.com/en/', feedUrl: 'https://www.france24.com/en/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['en'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'france24-es', name: 'France 24 (Español)', homepageUrl: 'https://www.france24.com/es/', feedUrl: 'https://www.france24.com/es/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['es'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'rfi-fr', name: 'RFI', homepageUrl: 'https://www.rfi.fr/fr/', feedUrl: 'https://www.rfi.fr/fr/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'franceinfo', name: 'franceinfo', homepageUrl: 'https://www.francetvinfo.fr', feedUrl: 'https://www.francetvinfo.fr/titres.rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'france-televisions', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'le-monde', name: 'Le Monde', homepageUrl: 'https://www.lemonde.fr', feedUrl: 'https://www.lemonde.fr/rss/une.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'groupe-le-monde', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  // El País: feeds.elpais.com responde 403 a robots.txt y eso se trata como «no permitido»: queda en pausa.
  { slug: 'el-pais', name: 'El País', homepageUrl: 'https://elpais.com', feedUrl: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'prisa', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'el-mundo', name: 'El Mundo', homepageUrl: 'https://www.elmundo.es', feedUrl: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'unidad-editorial', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  // Corriere: el antiguo xml2.corriereobjects.it/rss/homepage.xml se quedó en 2024; el vivo y permitido por su robots.txt es /feed-hp/homepage-restyle-2025.xml.
  // Su robots.txt declara «Content-Signal: ai-input=no»: se guarda solo el titular y nunca pasa por la IA.
  { slug: 'corriere', name: 'Corriere della Sera', homepageUrl: 'https://www.corriere.it', feedUrl: 'https://www.corriere.it/feed-hp/homepage-restyle-2025.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'rcs', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  // Il Post: responde 403 a HistorBot (no se fuerza con otro User-Agent): queda en pausa.
  { slug: 'il-post', name: 'Il Post', homepageUrl: 'https://www.ilpost.it', feedUrl: 'https://www.ilpost.it/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'il-post', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'rtp', name: 'RTP Notícias', homepageUrl: 'https://www.rtp.pt/noticias', feedUrl: 'https://www.rtp.pt/noticias/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PT', languages: ['pt'], ownershipGroup: 'rtp', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'folha', name: 'Folha de S.Paulo', homepageUrl: 'https://www.folha.uol.com.br', feedUrl: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'BR', languages: ['pt'], ownershipGroup: 'grupo-folha', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'euronews', name: 'Euronews', homepageUrl: 'https://www.euronews.com', feedUrl: 'https://www.euronews.com/rss?level=theme&name=news', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['en'], ownershipGroup: 'euronews', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'the-conversation', name: 'The Conversation', homepageUrl: 'https://theconversation.com', feedUrl: 'https://theconversation.com/articles.atom', connector: 'atom', sourceType: 'academic', countryCode: null, languages: ['en'], ownershipGroup: 'the-conversation', licenseNotes: 'CC BY-ND 4.0', prior: [10, 3] },

  // ── Redes sociales (pistas; requieren API oficial autorizada) ──
  { slug: 'reddit-worldnews', name: 'Reddit r/worldnews', homepageUrl: 'https://www.reddit.com/r/worldnews', feedUrl: null, connector: 'reddit', sourceType: 'social_media', countryCode: null, languages: ['en'], status: 'paused', config: { subreddit: 'worldnews' }, termsNotes: 'API oficial de Reddit (OAuth). Solo como pista.', prior: [2, 8] },
  { slug: 'x-breaking', name: 'X (búsqueda reciente)', homepageUrl: 'https://x.com', feedUrl: null, connector: 'x', sourceType: 'social_media', countryCode: null, languages: [], status: 'paused', config: { query: '(breaking OR "última hora") -is:retweet' }, termsNotes: 'API v2 de X con acceso autorizado. Solo como pista.', prior: [1, 9] },
];
