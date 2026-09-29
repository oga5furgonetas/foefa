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
  { slug: 'dw-de', name: 'DW', homepageUrl: 'https://www.dw.com/de', feedUrl: 'https://rss.dw.com/rdf/rss-de-all', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'dw-es', name: 'DW', homepageUrl: 'https://www.dw.com/es', feedUrl: 'https://rss.dw.com/rdf/rss-sp-all', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['es'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'dw-br', name: 'DW Brasil', homepageUrl: 'https://www.dw.com/pt-br', feedUrl: 'https://rss.dw.com/rdf/rss-br-top', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['pt'], ownershipGroup: 'deutsche-welle', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'tagesschau', name: 'tagesschau', homepageUrl: 'https://www.tagesschau.de', feedUrl: 'https://www.tagesschau.de/xml/rss2/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'ard', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'zdf-heute', name: 'ZDFheute', homepageUrl: 'https://www.zdf.de/nachrichten', feedUrl: 'https://www.zdf.de/rss/zdf/nachrichten', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'zdf', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'spiegel', name: 'DER SPIEGEL', homepageUrl: 'https://www.spiegel.de', feedUrl: 'https://www.spiegel.de/schlagzeilen/index.rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'spiegel-gruppe', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'france24-fr', name: 'France 24', homepageUrl: 'https://www.france24.com/fr/', feedUrl: 'https://www.france24.com/fr/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'france24-en', name: 'France 24', homepageUrl: 'https://www.france24.com/en/', feedUrl: 'https://www.france24.com/en/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['en'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'france24-es', name: 'France 24', homepageUrl: 'https://www.france24.com/es/', feedUrl: 'https://www.france24.com/es/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['es'], ownershipGroup: 'france-medias-monde', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
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

  // ── Ampliación del 27-09-2026 (más fuentes independientes por idioma: con la regla de 2
  // fuentes, cada medio nuevo multiplica las historias que se pueden confirmar) ──
  // Español
  { slug: '20minutos', name: '20minutos', homepageUrl: 'https://www.20minutos.es', feedUrl: 'https://www.20minutos.es/rss/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'henneo', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'eldiario', name: 'elDiario.es', homepageUrl: 'https://www.eldiario.es', feedUrl: 'https://www.eldiario.es/rss/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'eldiario', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'la-vanguardia', name: 'La Vanguardia', homepageUrl: 'https://www.lavanguardia.com', feedUrl: 'https://www.lavanguardia.com/rss/home.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'grupo-godo', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'abc-es', name: 'ABC', homepageUrl: 'https://www.abc.es', feedUrl: 'https://www.abc.es/rss/2.0/portada/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'vocento', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'el-confidencial', name: 'El Confidencial', homepageUrl: 'https://www.elconfidencial.com', feedUrl: 'https://rss.elconfidencial.com/espana/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'ES', languages: ['es'], ownershipGroup: 'titania', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'euronews-es', name: 'Euronews', homepageUrl: 'https://es.euronews.com', feedUrl: 'https://es.euronews.com/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['es'], ownershipGroup: 'euronews', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'infobae', name: 'Infobae', homepageUrl: 'https://www.infobae.com', feedUrl: 'https://www.infobae.com/arc/outboundfeeds/rss/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'AR', languages: ['es'], ownershipGroup: 'infobae', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'clarin', name: 'Clarín', homepageUrl: 'https://www.clarin.com', feedUrl: 'https://www.clarin.com/rss/lo-ultimo/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'AR', languages: ['es'], ownershipGroup: 'grupo-clarin', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'la-nacion-ar', name: 'La Nación', homepageUrl: 'https://www.lanacion.com.ar', feedUrl: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'AR', languages: ['es'], ownershipGroup: 'la-nacion', termsNotes: HEADLINES_ONLY, prior: [9, 3] },

  // ── Ampliación del 29-09-2026: ediciones por país. Para dar a cada lector «lo de su país»
  // verificado hacen falta al menos 2 medios independientes DE ese país; México, Colombia y
  // Chile tenían edición pero ninguna fuente, y de EE. UU. solo NPR cubría lo nacional. ──
  // México (El Universal: su robots.txt no deja leer el feed; no se fuerza)
  { slug: 'el-financiero', name: 'El Financiero', homepageUrl: 'https://www.elfinanciero.com.mx', feedUrl: 'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'MX', languages: ['es'], ownershipGroup: 'grupo-lauman', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'la-jornada', name: 'La Jornada', homepageUrl: 'https://www.jornada.com.mx', feedUrl: 'https://www.jornada.com.mx/rss/edicion.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'MX', languages: ['es'], ownershipGroup: 'demos-la-jornada', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'el-economista-mx', name: 'El Economista', homepageUrl: 'https://www.eleconomista.com.mx', feedUrl: 'https://www.eleconomista.com.mx/rss/ultimas-noticias', connector: 'rss', sourceType: 'reputable_media', countryCode: 'MX', languages: ['es'], ownershipGroup: 'el-economista-mx', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'expansion-mx', name: 'Expansión', homepageUrl: 'https://expansion.mx', feedUrl: 'https://expansion.mx/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'MX', languages: ['es'], ownershipGroup: 'grupo-expansion', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  // Colombia
  { slug: 'el-tiempo-co', name: 'El Tiempo', homepageUrl: 'https://www.eltiempo.com', feedUrl: 'https://www.eltiempo.com/rss/colombia.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CO', languages: ['es'], ownershipGroup: 'casa-editorial-el-tiempo', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'semana-co', name: 'Semana', homepageUrl: 'https://www.semana.com', feedUrl: 'https://www.semana.com/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CO', languages: ['es'], ownershipGroup: 'publicaciones-semana', termsNotes: HEADLINES_ONLY, prior: [8, 3] },
  { slug: 'caracol-radio', name: 'Caracol Radio', homepageUrl: 'https://caracol.com.co', feedUrl: 'https://caracol.com.co/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CO', languages: ['es'], ownershipGroup: 'prisa', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'el-colombiano', name: 'El Colombiano', homepageUrl: 'https://www.elcolombiano.com', feedUrl: 'https://www.elcolombiano.com/rss/colombia.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CO', languages: ['es'], ownershipGroup: 'el-colombiano', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'infobae-colombia', name: 'Infobae', homepageUrl: 'https://www.infobae.com/colombia/', feedUrl: 'https://www.infobae.com/arc/outboundfeeds/rss/category/colombia/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CO', languages: ['es'], ownershipGroup: 'infobae', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  // Chile
  { slug: 'la-tercera', name: 'La Tercera', homepageUrl: 'https://www.latercera.com', feedUrl: 'https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'grupo-copesa', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'cooperativa', name: 'Cooperativa', homepageUrl: 'https://www.cooperativa.cl', feedUrl: 'https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3___1.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'cooperativa', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'adn-radio-cl', name: 'ADN Radio', homepageUrl: 'https://www.adnradio.cl', feedUrl: 'https://www.adnradio.cl/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'prisa', termsNotes: HEADLINES_ONLY, prior: [8, 3] },
  { slug: 'radio-uchile', name: 'Radio Universidad de Chile', homepageUrl: 'https://radio.uchile.cl', feedUrl: 'https://radio.uchile.cl/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'universidad-de-chile', termsNotes: HEADLINES_ONLY, prior: [8, 3] },
  { slug: 'diario-financiero', name: 'Diario Financiero', homepageUrl: 'https://www.df.cl', feedUrl: 'https://www.df.cl/noticias/site/list/port/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'grupo-df', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'ciper', name: 'CIPER Chile', homepageUrl: 'https://www.ciperchile.cl', feedUrl: 'https://www.ciperchile.cl/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CL', languages: ['es'], ownershipGroup: 'ciper', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  // Perú
  { slug: 'el-comercio-pe', name: 'El Comercio', homepageUrl: 'https://elcomercio.pe', feedUrl: 'https://elcomercio.pe/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PE', languages: ['es'], ownershipGroup: 'grupo-el-comercio-pe', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'rpp', name: 'RPP Noticias', homepageUrl: 'https://rpp.pe', feedUrl: 'https://rpp.pe/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PE', languages: ['es'], ownershipGroup: 'grupo-rpp', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'infobae-peru', name: 'Infobae', homepageUrl: 'https://www.infobae.com/peru/', feedUrl: 'https://www.infobae.com/arc/outboundfeeds/rss/category/peru/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PE', languages: ['es'], ownershipGroup: 'infobae', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  // Estados Unidos (lo nacional: CBS y ABC ya estaban, ahora con sus feeds generales; Axios: robots.txt no lo permite)
  { slug: 'nbc-news', name: 'NBC News', homepageUrl: 'https://www.nbcnews.com', feedUrl: 'https://feeds.nbcnews.com/nbcnews/public/news', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'comcast-sky', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'pbs-newshour', name: 'PBS News', homepageUrl: 'https://www.pbs.org/newshour/', feedUrl: 'https://www.pbs.org/newshour/feeds/rss/headlines', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'pbs', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'nyt-us', name: 'The New York Times', homepageUrl: 'https://www.nytimes.com', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'new-york-times', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'washington-post', name: 'The Washington Post', homepageUrl: 'https://www.washingtonpost.com', feedUrl: 'https://feeds.washingtonpost.com/rss/national', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'washington-post', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'fox-news', name: 'Fox News', homepageUrl: 'https://www.foxnews.com', feedUrl: 'https://moxie.foxnews.com/google-publisher/us.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'fox-corporation', termsNotes: HEADLINES_ONLY, prior: [8, 3] },
  { slug: 'the-hill', name: 'The Hill', homepageUrl: 'https://thehill.com', feedUrl: 'https://thehill.com/news/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'nexstar', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'politico', name: 'Politico', homepageUrl: 'https://www.politico.com', feedUrl: 'https://rss.politico.com/politics-news.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'axel-springer', categoryHint: 'politics', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'la-times', name: 'Los Angeles Times', homepageUrl: 'https://www.latimes.com', feedUrl: 'https://www.latimes.com/california/rss2.0.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'la-times', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  // Canadá (The Globe and Mail: robots.txt no lo permite; una sola fuente no basta para edición propia)
  { slug: 'global-news-ca', name: 'Global News', homepageUrl: 'https://globalnews.ca', feedUrl: 'https://globalnews.ca/canada/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CA', languages: ['en'], ownershipGroup: 'corus', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  // English
  { slug: 'al-jazeera', name: 'Al Jazeera', homepageUrl: 'https://www.aljazeera.com', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'QA', languages: ['en'], ownershipGroup: 'al-jazeera', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'sky-news', name: 'Sky News', homepageUrl: 'https://news.sky.com', feedUrl: 'https://feeds.skynews.com/feeds/rss/world.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['en'], ownershipGroup: 'comcast-sky', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'cbs-news', name: 'CBS News', homepageUrl: 'https://www.cbsnews.com', feedUrl: 'https://www.cbsnews.com/latest/rss/main', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'paramount', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'abc-news-us', name: 'ABC News', homepageUrl: 'https://abcnews.go.com', feedUrl: 'https://abcnews.go.com/abcnews/topstories', connector: 'rss', sourceType: 'reputable_media', countryCode: 'US', languages: ['en'], ownershipGroup: 'disney', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'the-independent', name: 'The Independent', homepageUrl: 'https://www.independent.co.uk', feedUrl: 'https://www.independent.co.uk/news/world/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'GB', languages: ['en'], ownershipGroup: 'independent', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'abc-au', name: 'ABC News (Australia)', homepageUrl: 'https://www.abc.net.au/news', feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'AU', languages: ['en'], ownershipGroup: 'abc-australia', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'rte', name: 'RTÉ News', homepageUrl: 'https://www.rte.ie/news/', feedUrl: 'https://www.rte.ie/feeds/rss/?index=/news/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IE', languages: ['en'], ownershipGroup: 'rte', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  // Deutsch
  { slug: 'sueddeutsche', name: 'Süddeutsche Zeitung', homepageUrl: 'https://www.sueddeutsche.de', feedUrl: 'https://rss.sueddeutsche.de/rss/Topthemen', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'swmh', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'zeit', name: 'ZEIT ONLINE', homepageUrl: 'https://www.zeit.de', feedUrl: 'https://newsfeed.zeit.de/index', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'zeit', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'faz', name: 'FAZ', homepageUrl: 'https://www.faz.net', feedUrl: 'https://www.faz.net/rss/aktuell/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'faz', termsNotes: HEADLINES_ONLY, prior: [11, 3] },
  { slug: 'n-tv', name: 'n-tv', homepageUrl: 'https://www.n-tv.de', feedUrl: 'https://www.n-tv.de/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'rtl', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'deutschlandfunk', name: 'Deutschlandfunk', homepageUrl: 'https://www.deutschlandfunk.de', feedUrl: 'https://www.deutschlandfunk.de/nachrichten-100.rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'DE', languages: ['de'], ownershipGroup: 'deutschlandradio', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'orf', name: 'ORF', homepageUrl: 'https://orf.at', feedUrl: 'https://rss.orf.at/news.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'AT', languages: ['de'], ownershipGroup: 'orf', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'srf', name: 'SRF News', homepageUrl: 'https://www.srf.ch/news', feedUrl: 'https://www.srf.ch/news/bnf/rss/1646', connector: 'rss', sourceType: 'reputable_media', countryCode: 'CH', languages: ['de'], ownershipGroup: 'srg-ssr', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  // Français
  { slug: 'le-figaro', name: 'Le Figaro', homepageUrl: 'https://www.lefigaro.fr', feedUrl: 'https://www.lefigaro.fr/rss/figaro_actualites.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'groupe-figaro', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'liberation', name: 'Libération', homepageUrl: 'https://www.liberation.fr', feedUrl: 'https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'liberation', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: '20minutes-fr', name: '20 Minutes', homepageUrl: 'https://www.20minutes.fr', feedUrl: 'https://www.20minutes.fr/feeds/rss-une.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: '20-minutes-fr', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'euronews-fr', name: 'Euronews', homepageUrl: 'https://fr.euronews.com', feedUrl: 'https://fr.euronews.com/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['fr'], ownershipGroup: 'euronews', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  // Italiano
  { slug: 'repubblica', name: 'la Repubblica', homepageUrl: 'https://www.repubblica.it', feedUrl: 'https://www.repubblica.it/rss/homepage/rss2.0.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'gedi', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'rainews', name: 'RaiNews', homepageUrl: 'https://www.rainews.it', feedUrl: 'https://www.rainews.it/rss/tutti', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'rai', termsNotes: HEADLINES_ONLY, prior: [12, 3] },
  { slug: 'tgcom24', name: 'TGCom24', homepageUrl: 'https://www.tgcom24.mediaset.it', feedUrl: 'https://www.tgcom24.mediaset.it/rss/homepage.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'mediaset', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'sky-tg24', name: 'Sky TG24', homepageUrl: 'https://tg24.sky.it', feedUrl: 'https://tg24.sky.it/rss/tg24.xml', connector: 'rss', sourceType: 'reputable_media', countryCode: 'IT', languages: ['it'], ownershipGroup: 'comcast-sky', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'agi', name: 'AGI', homepageUrl: 'https://www.agi.it', feedUrl: 'https://www.agi.it/cronaca/rss', connector: 'rss', sourceType: 'wire_agency', countryCode: 'IT', languages: ['it'], ownershipGroup: 'agi', termsNotes: HEADLINES_ONLY, prior: [13, 3] },
  { slug: 'euronews-it', name: 'Euronews', homepageUrl: 'https://it.euronews.com', feedUrl: 'https://it.euronews.com/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['it'], ownershipGroup: 'euronews', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  // Português
  { slug: 'publico-pt', name: 'Público (Portugal)', homepageUrl: 'https://www.publico.pt', feedUrl: 'https://feeds.feedburner.com/PublicoRSS', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PT', languages: ['pt'], ownershipGroup: 'sonae', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'observador', name: 'Observador', homepageUrl: 'https://observador.pt', feedUrl: 'https://observador.pt/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'PT', languages: ['pt'], ownershipGroup: 'observador', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'g1', name: 'g1', homepageUrl: 'https://g1.globo.com', feedUrl: 'https://g1.globo.com/rss/g1/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'BR', languages: ['pt'], ownershipGroup: 'globo', termsNotes: HEADLINES_ONLY, prior: [10, 3] },
  { slug: 'cnn-brasil', name: 'CNN Brasil', homepageUrl: 'https://www.cnnbrasil.com.br', feedUrl: 'https://www.cnnbrasil.com.br/feed/', connector: 'rss', sourceType: 'reputable_media', countryCode: 'BR', languages: ['pt'], ownershipGroup: 'cnn-brasil', termsNotes: HEADLINES_ONLY, prior: [9, 3] },
  { slug: 'euronews-pt', name: 'Euronews', homepageUrl: 'https://pt.euronews.com', feedUrl: 'https://pt.euronews.com/rss', connector: 'rss', sourceType: 'reputable_media', countryCode: 'FR', languages: ['pt'], ownershipGroup: 'euronews', termsNotes: HEADLINES_ONLY, prior: [10, 3] },

  // ── Redes sociales (pistas; requieren API oficial autorizada) ──
  { slug: 'reddit-worldnews', name: 'Reddit r/worldnews', homepageUrl: 'https://www.reddit.com/r/worldnews', feedUrl: null, connector: 'reddit', sourceType: 'social_media', countryCode: null, languages: ['en'], status: 'paused', config: { subreddit: 'worldnews' }, termsNotes: 'API oficial de Reddit (OAuth). Solo como pista.', prior: [2, 8] },
  { slug: 'x-breaking', name: 'X (búsqueda reciente)', homepageUrl: 'https://x.com', feedUrl: null, connector: 'x', sourceType: 'social_media', countryCode: null, languages: [], status: 'paused', config: { query: '(breaking OR "última hora") -is:retweet' }, termsNotes: 'API v2 de X con acceso autorizado. Solo como pista.', prior: [1, 9] },
];
