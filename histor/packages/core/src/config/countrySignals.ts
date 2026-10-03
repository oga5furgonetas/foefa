/**
 * Señales de país que no son topónimos: gentilicios («la selección peruana»), clubes («Boca
 * Juniors»), líderes («Petro», «Milei») e instituciones («FARC», «ONPE»), y las ciudades de
 * América que el nomenclátor no tiene. El 03-10-2026 la portada de España llevaba un partido de
 * Boca y un ataque en Neiva (Colombia); «Selección peruana… contra Canadá» salía de Canadá y el
 * plan de reactivación de Cali, de Italia («el Valle» por el Valle de Aosta).
 *
 * Nombres propios: se buscan tal cual (con mayúscula, con o sin tilde). Gentilicios: sin
 * distinguir mayúsculas, solo en la forma de adjetivo o sustantivo de persona.
 */
import { fold } from '../text/normalize';

type Signal = { re: RegExp; country: string };

const proper = (country: string, names: string[]): Signal[] =>
  names.map((n) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${n})(?![\\p{L}\\p{N}])`, 'u'), country }));

/** Sobre el texto plegado (sin tildes, minúsculas). */
const demonym = (country: string, stems: string[]): Signal[] =>
  stems.map((s) => ({ re: new RegExp(`(?<![a-z])(?:${s})(?:o|a|os|as|es|e)?(?![a-z])`), country }));

const PROPER: Signal[] = [
  // Colombia
  ...proper('CO', ['Bogot[áa]', 'Medell[íi]n', 'Cali', 'Barranquilla', 'Cartagena de Indias', 'Neiva', 'Bucaramanga', 'C[úu]cuta', 'Valle del Cauca', 'Antioquia', 'Petro', 'Gustavo Petro', 'FARC', 'ELN', 'Ej[ée]rcito de Colombia', 'Millonarios', 'Atl[ée]tico Nacional', 'Am[ée]rica de Cali', 'Deportivo Cali', 'Junior de Barranquilla', 'Registradur[íi]a Nacional']),
  // Perú
  ...proper('PE', ['Lima', 'Callao', 'Arequipa', 'Cusco', 'Cuzco', 'Piura', 'Iquitos', 'Loreto', 'Machu Picchu', 'ONPE', 'JNE', 'Universitario de Deportes', 'Universitario', 'Alianza Lima', 'Sporting Cristal', 'Blanquirroja', 'Inca Rail', 'PeruRail']),
  // México
  ...proper('MX', ['CDMX', 'Ciudad de M[ée]xico', 'Edomex', 'Monterrey', 'Culiac[áa]n', 'Tijuana', 'Puebla', 'Canc[úu]n', 'Sinaloa', 'Jalisco', 'Michoac[áa]n', 'Baja California', 'Chihuahua', 'Oaxaca', 'Veracruz', 'Acapulco', 'Sheinbaum', 'Claudia Sheinbaum', 'SSN', 'Chivas', 'Cruz Azul', 'Tigres', 'Rayados', 'Club Am[ée]rica', 'Familia Michoacana', 'C[áa]rtel de Sinaloa']),
  // Argentina
  ...proper('AR', ['Buenos Aires', 'La Plata', 'Mar del Plata', 'Tucum[áa]n', 'Milei', 'Javier Milei', 'Casa Rosada', 'Boca Juniors', 'Boca', 'River Plate', 'Independiente', 'Racing Club', 'San Lorenzo', 'V[ée]lez', 'Estudiantes de La Plata', 'Gimnasia', 'Rosario Central', "Newell'?s", 'Talleres', 'Lan[úu]s', 'Albiceleste', 'Scaloni']),
  // Chile
  ...proper('CL', ['Valpara[íi]so', 'Antofagasta', 'Vi[ñn]a del Mar', 'Quintero', 'Temuco', 'Boric', 'Kast', 'La Moneda', 'Colo[- ]Colo', 'Universidad de Chile', 'Carabineros']),
  // Venezuela, Ecuador, Bolivia, Paraguay, Uruguay
  ...proper('VE', ['Caracas', 'Maracaibo', 'Maduro', 'Nicol[áa]s Maduro', 'Tren de Aragua', 'Miraflores']),
  ...proper('EC', ['Quito', 'Guayaquil', 'Noboa']),
  ...proper('BO', ['Cochabamba']),
  ...proper('PY', ['Asunci[óo]n']),
  ...proper('UY', ['Montevideo', 'Pe[ñn]arol']),
  // Brasil
  ...proper('BR', ['S[ãa]o Paulo', 'R[íi]o de Janeiro', 'Bras[íi]lia', 'Lula', 'Bolsonaro', 'Itamaraty', 'Planalto', 'STF', 'Flamengo', 'Palmeiras', 'Corinthians', 'Fluminense', 'Botafogo', 'Gr[êe]mio', 'Vasco da Gama']),
  // Centroamérica y Caribe
  ...proper('SV', ['Bukele']),
  ...proper('GT', ['Guatemala City']),
  ...proper('HN', ['Tegucigalpa']),
  ...proper('NI', ['Managua']),
  ...proper('CU', ['La Habana']),
  ...proper('DO', ['Santo Domingo']),
  // España
  ...proper('ES', ['Pedro S[áa]nchez', 'Feij[óo]o', 'Ayuso', 'Moncloa', 'Congreso de los Diputados', 'Guardia Civil', 'Mossos', 'Ertzaintza', 'Aemet', 'Generalitat', 'Xunta', 'Junta de Andaluc[íi]a', 'Real Madrid', 'FC Barcelona', 'Bar[çc]a', 'Atl[ée]tico de Madrid', 'Sevilla FC', 'Real Betis', 'Athletic Club', 'Real Sociedad', 'Villarreal', 'Valencia CF', 'LaLiga', 'Copa del Rey', 'Junts', 'PSOE', 'PP']),
  // Otros
  ...proper('US', ['Casa Blanca', 'White House', 'Pent[áa]gono', 'Pentagon', 'Trump', 'Donald Trump', 'Congreso de EE\\. ?UU\\.']),
  ...proper('FR', ['Macron', '[ÉE]lys[ée]e']),
  ...proper('IT', ['Meloni', 'Palazzo Chigi']),
  ...proper('DE', ['Merz', 'Bundestag']),
  ...proper('GB', ['Starmer', 'Downing Street']),
  ...proper('RU', ['Putin', 'Kremlin', 'Kreml[íi]n']),
  ...proper('UA', ['Zelenski', 'Zelensky', 'Zelenskyy']),
  ...proper('IL', ['Netanyahu']),
];

const DEMONYMS: Signal[] = [
  ...demonym('AR', ['argentin']),
  ...demonym('CL', ['chilen']),
  ...demonym('CO', ['colombian']),
  ...demonym('PE', ['peruan']),
  ...demonym('MX', ['mexican']),
  ...demonym('VE', ['venezolan']),
  ...demonym('EC', ['ecuatorian']),
  ...demonym('BO', ['bolivian']),
  ...demonym('PY', ['paraguay']),
  ...demonym('UY', ['uruguay']),
  ...demonym('BR', ['brasilen', 'brasileir']),
  ...demonym('CU', ['cuban']),
  ...demonym('CR', ['costarricens']),
  ...demonym('PA', ['panamen']),
  ...demonym('GT', ['guatemaltec']),
  ...demonym('HN', ['hondurens', 'hondurena']),
  ...demonym('SV', ['salvadoren']),
  ...demonym('NI', ['nicaraguens']),
  ...demonym('ES', ['espanol', 'espanola']),
  ...demonym('US', ['estadounidens']),
  ...demonym('UA', ['ucranian']),
  ...demonym('IL', ['israel', 'israeli']),
];

/** Posición de la primera señal de cada país en el texto (para saber quién sale antes en un titular). */
export function signalPositions(text: string): Map<string, number> {
  const out = new Map<string, number>();
  if (!text) return out;
  const keep = (cc: string, at: number) => {
    if (at >= 0 && (!out.has(cc) || at < out.get(cc)!)) out.set(cc, at);
  };
  for (const s of PROPER) keep(s.country, text.search(s.re));
  // El texto plegado conserva la longitud del original (NFC sin tildes): las posiciones valen.
  const f = fold(text).toLowerCase();
  for (const s of DEMONYMS) keep(s.country, f.search(s.re));
  return out;
}

/**
 * Países que señala un texto por otras vías que el nomenclátor. «paraguay» como gentilicio
 * («paraguayo») no casa con el país «Paraguay» escrito: ese ya lo encuentra el nomenclátor.
 */
export function countrySignals(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const s of PROPER) if (s.re.test(text)) out.add(s.country);
  const f = fold(text).toLowerCase();
  for (const s of DEMONYMS) if (s.re.test(f)) out.add(s.country);
  return out;
}
