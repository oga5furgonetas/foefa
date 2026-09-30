/**
 * Piezas de un feed que no son noticia: opinión, galerías y viñetas, resúmenes
 * del día, pódcast y cuestionarios. No se usan como hecho ni originan historias.
 * Vistos con fuentes reales el 27-09-2026: «AfD-Wahlsiege: … - Kommentar»,
 * «Cartoons der Woche…» (DER SPIEGEL), «The week in pictures…», «Germany news: …» (DW).
 */

const TITLE_START =
  /^(the week in pictures|in pictures|pictures of the (day|week)|photos? of the (day|week)|week in photos|en imágenes|las fotos|fotogaler[ií]a|bilder der woche|bildergalerie|in bildern|cartoons? der woche|karikaturen? der woche|en images|en photos|la semaine en images|in foto|fotogaller[iy]a?|em fotos|em imagens|galeria de fotos|germany news|europe news|news roundup|morning briefing|evening briefing|lo que tienes que saber|das war der tag)\b/i;

/** Etiqueta de sección al principio, con separador: «Opinión: …» sí, «Opinion poll shows…» no. */
const TITLE_LABEL = /^(opinion|opinión|opinião|opinione|kommentar|meinung|editorial|leitartikel|tribune|tribuna|chronique|column|columna|podcast|quiz)\s*[:|–—-]/i;

const TITLE_END = /\s[-–—|]\s*(kommentar|opinion|opinión|opinião|editorial|podcast|quiz|fotostrecke|bildergalerie|cartoon)\s*$/i;

const URL_PATH =
  /\/(opinion|opiniones|opinião|opiniao|opinioni|meinung|kommentare?|tribunes?|editoriale?s?|column(?:s|as)?|chroniques?|in-pictures|gallery|galleries|galerias?|fotogalerias?|fotos|fotostrecke|bildergalerie|podcasts?|quiz(?:zes)?|newsletters?)(\/|-|$)/i;

/**
 * Alertas automáticas de nivel VERDE de GDACS («Green forest fire notification in Australia»):
 * impacto humanitario bajo, decenas al día. No son noticia y formaban «historias» de 60 piezas
 * que se reverificaban en cada ciclo (29-09-2026). Las naranjas y rojas sí entran.
 */
const GDACS_GREEN = /^green (forest fire|wildfire|flood|drought|earthquake|tropical cyclone|volcan\w*)\b/i;

/** Publicidad y contenido patrocinado («¿Fitogénicos para perros? Conéctese al webinar de SEMANA»). */
const SPONSORED = /\b(webinar|webinario|conéctese al|inscríbase|regístrese|patrocinado|publirreportaje|sponsored|advertorial|partner content|paid post|anzeige|publireportage|contenuto sponsorizzato|conteúdo patrocinado|publi-information)\b/i;

/** Servicios, no noticias: sorteos, horóscopo, pasatiempos («Comprobar Bonoloto: resultados…»). */
const SERVICE = /(^(comprobar|horóscopo|horoscopo|crucigrama|sudoku|autodefinido)\b|\b(bonoloto|euromillones|la primitiva|el gordo de la primitiva|quiniela|lotería nacional|loteria nacional|cupón de la once|lotto|eurojackpot|powerball|mega millions)\b)/i;

/**
 * Guías de partidos y directos: «Argentina vs. Bolivia: día, horario, TV y cómo ver online»,
 * «España vs Croacia EN VIVO: ¿a qué hora juegan y dónde ver…?», «siga el minuto a minuto»,
 * «Posible alineación de Perú vs. México» (30-09-2026). Son servicio, no noticias.
 */
const MATCH_GUIDE =
  /(\b(dónde ver|donde ver|cómo ver|como ver|dónde y cuándo|a qué hora (juega|juegan|es|empieza|será)|horario y (dónde|cómo)|minuto a minuto|en vivo y en directo|ver (el partido )?(gratis |en )?online|alineaci(ón|ones) (probables?|confirmadas?)|posible alineación|how to watch|where to watch|live stream|wo läuft|im tv und stream|où regarder|dove vedere|onde assistir|como assistir)\b|\bvs\.? [^:]{2,40}(en vivo|en directo|live)\b)/i;

/** Motivo por el que la pieza no es noticia, o null si lo es. */
export function nonNewsReason(title: string, url: string): string | null {
  const t = title.trim();
  if (TITLE_START.test(t) || TITLE_LABEL.test(t) || TITLE_END.test(t)) return 'no es noticia (opinión, galería, resumen, pódcast o cuestionario)';
  if (GDACS_GREEN.test(t)) return 'no es noticia (alerta automática de nivel verde, impacto bajo)';
  if (SPONSORED.test(t)) return 'no es noticia (publicidad o contenido patrocinado)';
  if (SERVICE.test(t)) return 'no es noticia (servicio: sorteos, horóscopo o pasatiempos)';
  if (MATCH_GUIDE.test(t)) return 'no es noticia (guía de partido o directo minuto a minuto)';
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    /* URL no válida: se juzga solo por el titular */
  }
  if (URL_PATH.test(path) || /-kommentar-a-/i.test(path)) return 'no es noticia (sección de opinión, galería o pódcast)';
  return null;
}

/** Coletillas de las webs de los medios (apps, boletines, redes, «lee también»). */
export const PROMO =
  /(téléchargeant l'application|téléchargez l'application|abonnez-vous|inscrivez-vous|suivez-nous|suivez toute l'actualité|descarga(?:r)? (?:la|nuestra) app|suscríbete|síguenos|únete a nuestro canal|recibe (?:las|nuestras) noticias|te puede interesar|lee también|leer más|más información en|download (?:the|our) app|subscribe to|sign up for|follow us|read more|click here|newsletter|jetzt abonnieren|laden sie die app|folgen sie uns|lesen sie auch|scarica l'app|iscriviti|seguici|leggi anche|baixe o app|assine a newsletter|siga-nos|leia também|canal de whatsapp|whatsapp channel|à lire aussi|a lire aussi|lire aussi|ver también|lea también|vea también|leia mais|saiba mais|see also|related:|más noticias|mehr zum thema|auch interessant|potrebbe interessarti|da non perdere)/i;

/**
 * Notas de prensa de distribuidoras de pago (PRNewswire, Business Wire, GlobeNewswire…): son
 * publicidad de empresas con formato de noticia. Contaminaban la historia del huracán Polo con un
 * festival en Baja California (30-09-2026). Se miran en el texto, no solo en el titular.
 */
const PRESS_RELEASE = /\/?\b(PRNewswire|PR Newswire|Business Wire|BusinessWire|GlobeNewswire|Globe Newswire|Accesswire|EIN Presswire|Cision)\b\/?/i;

export function pressReleaseReason(text: string | null | undefined): string | null {
  return text && PRESS_RELEASE.test(text.slice(0, 600)) ? 'no es noticia (nota de prensa de pago)' : null;
}

/** Pies de foto y créditos («…, CC BY-NC», «Getty Images», «Foto: EFE»): no afirman nada. */
export const CREDIT_LINE = /(\bCC[ -]BY\b|\bGetty Images\b|\bShutterstock\b|\bAFP Photo\b|\bimago images\b|^\s*(foto|fotos|photo|photos|image|imagen|imagem|bild|crédito|credit|crédits?|©)\s*[:|/©])/i;
