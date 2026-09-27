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

/** Motivo por el que la pieza no es noticia, o null si lo es. */
export function nonNewsReason(title: string, url: string): string | null {
  const t = title.trim();
  if (TITLE_START.test(t) || TITLE_LABEL.test(t) || TITLE_END.test(t)) return 'no es noticia (opinión, galería, resumen, pódcast o cuestionario)';
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    /* URL no válida: se juzga solo por el titular */
  }
  if (URL_PATH.test(path) || /-kommentar-a-/i.test(path)) return 'no es noticia (sección de opinión, galería o pódcast)';
  return null;
}
