import { slugify } from '../text/normalize';

export type CountryDef = {
  code: string;
  names: Record<string, string>;
  slugs: Record<string, string>;
  defaultLanguage: string;
  currency: string;
  timezone: string;
  continent: 'europe' | 'north_america' | 'south_america' | 'central_america' | 'asia' | 'africa' | 'oceania';
  /** Tiene portada nacional propia. */
  edition: boolean;
  /** Otros nombres con los que aparece en textos (gentilicios no, solo topónimos). */
  aliases: string[];
  /** Nombre del siguiente nivel administrativo, por idioma. */
  regionLabel?: Record<string, string>;
};

type Row = [
  code: string,
  lang: string,
  currency: string,
  tz: string,
  continent: CountryDef['continent'],
  edition: boolean,
  names: [es: string, en: string, de: string, fr: string, it: string, pt: string],
  aliases?: string[],
];

const ROWS: Row[] = [
  ['ES', 'es', 'EUR', 'Europe/Madrid', 'europe', true, ['España', 'Spain', 'Spanien', 'Espagne', 'Spagna', 'Espanha'], ['Espanya', 'Espainia']],
  ['US', 'en', 'USD', 'America/New_York', 'north_america', true, ['Estados Unidos', 'United States', 'Vereinigte Staaten', 'États-Unis', 'Stati Uniti', 'Estados Unidos'], ['EE.UU.', 'EEUU', 'USA', 'U.S.', 'EUA', 'USA', 'Amérique']],
  ['GB', 'en', 'GBP', 'Europe/London', 'europe', true, ['Reino Unido', 'United Kingdom', 'Vereinigtes Königreich', 'Royaume-Uni', 'Regno Unito', 'Reino Unido'], ['UK', 'Britain', 'Great Britain', 'Gran Bretaña', 'Großbritannien', 'Grande-Bretagne', 'Gran Bretagna']],
  ['DE', 'de', 'EUR', 'Europe/Berlin', 'europe', true, ['Alemania', 'Germany', 'Deutschland', 'Allemagne', 'Germania', 'Alemanha'], []],
  ['FR', 'fr', 'EUR', 'Europe/Paris', 'europe', true, ['Francia', 'France', 'Frankreich', 'France', 'Francia', 'França'], []],
  ['IT', 'it', 'EUR', 'Europe/Rome', 'europe', true, ['Italia', 'Italy', 'Italien', 'Italie', 'Italia', 'Itália'], []],
  ['PT', 'pt', 'EUR', 'Europe/Lisbon', 'europe', true, ['Portugal', 'Portugal', 'Portugal', 'Portugal', 'Portogallo', 'Portugal'], []],
  ['MX', 'es', 'MXN', 'America/Mexico_City', 'north_america', true, ['México', 'Mexico', 'Mexiko', 'Mexique', 'Messico', 'México'], []],
  ['AR', 'es', 'ARS', 'America/Argentina/Buenos_Aires', 'south_america', true, ['Argentina', 'Argentina', 'Argentinien', 'Argentine', 'Argentina', 'Argentina'], []],
  ['CO', 'es', 'COP', 'America/Bogota', 'south_america', true, ['Colombia', 'Colombia', 'Kolumbien', 'Colombie', 'Colombia', 'Colômbia'], []],
  ['CL', 'es', 'CLP', 'America/Santiago', 'south_america', true, ['Chile', 'Chile', 'Chile', 'Chili', 'Cile', 'Chile'], []],
  ['PE', 'es', 'PEN', 'America/Lima', 'south_america', true, ['Perú', 'Peru', 'Peru', 'Pérou', 'Perù', 'Peru'], []],
  ['BR', 'pt', 'BRL', 'America/Sao_Paulo', 'south_america', true, ['Brasil', 'Brazil', 'Brasilien', 'Brésil', 'Brasile', 'Brasil'], []],
  ['AT', 'de', 'EUR', 'Europe/Vienna', 'europe', false, ['Austria', 'Austria', 'Österreich', 'Autriche', 'Austria', 'Áustria'], []],
  ['CH', 'de', 'CHF', 'Europe/Zurich', 'europe', false, ['Suiza', 'Switzerland', 'Schweiz', 'Suisse', 'Svizzera', 'Suíça'], []],
  ['BE', 'fr', 'EUR', 'Europe/Brussels', 'europe', false, ['Bélgica', 'Belgium', 'Belgien', 'Belgique', 'Belgio', 'Bélgica'], []],
  ['NL', 'nl', 'EUR', 'Europe/Amsterdam', 'europe', false, ['Países Bajos', 'Netherlands', 'Niederlande', 'Pays-Bas', 'Paesi Bassi', 'Países Baixos'], ['Holanda', 'Holland']],
  ['IE', 'en', 'EUR', 'Europe/Dublin', 'europe', false, ['Irlanda', 'Ireland', 'Irland', 'Irlande', 'Irlanda', 'Irlanda'], []],
  ['PL', 'pl', 'PLN', 'Europe/Warsaw', 'europe', false, ['Polonia', 'Poland', 'Polen', 'Pologne', 'Polonia', 'Polônia'], []],
  ['UA', 'uk', 'UAH', 'Europe/Kyiv', 'europe', false, ['Ucrania', 'Ukraine', 'Ukraine', 'Ukraine', 'Ucraina', 'Ucrânia'], []],
  ['RU', 'ru', 'RUB', 'Europe/Moscow', 'europe', false, ['Rusia', 'Russia', 'Russland', 'Russie', 'Russia', 'Rússia'], []],
  ['GR', 'el', 'EUR', 'Europe/Athens', 'europe', false, ['Grecia', 'Greece', 'Griechenland', 'Grèce', 'Grecia', 'Grécia'], []],
  ['SE', 'sv', 'SEK', 'Europe/Stockholm', 'europe', false, ['Suecia', 'Sweden', 'Schweden', 'Suède', 'Svezia', 'Suécia'], []],
  ['NO', 'no', 'NOK', 'Europe/Oslo', 'europe', false, ['Noruega', 'Norway', 'Norwegen', 'Norvège', 'Norvegia', 'Noruega'], []],
  ['DK', 'da', 'DKK', 'Europe/Copenhagen', 'europe', false, ['Dinamarca', 'Denmark', 'Dänemark', 'Danemark', 'Danimarca', 'Dinamarca'], []],
  ['TR', 'tr', 'TRY', 'Europe/Istanbul', 'asia', false, ['Turquía', 'Turkey', 'Türkei', 'Turquie', 'Turchia', 'Turquia'], ['Türkiye']],
  ['CA', 'en', 'CAD', 'America/Toronto', 'north_america', false, ['Canadá', 'Canada', 'Kanada', 'Canada', 'Canada', 'Canadá'], []],
  ['VE', 'es', 'VES', 'America/Caracas', 'south_america', false, ['Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela'], []],
  ['EC', 'es', 'USD', 'America/Guayaquil', 'south_america', false, ['Ecuador', 'Ecuador', 'Ecuador', 'Équateur', 'Ecuador', 'Equador'], []],
  ['UY', 'es', 'UYU', 'America/Montevideo', 'south_america', false, ['Uruguay', 'Uruguay', 'Uruguay', 'Uruguay', 'Uruguay', 'Uruguai'], []],
  ['CN', 'zh', 'CNY', 'Asia/Shanghai', 'asia', false, ['China', 'China', 'China', 'Chine', 'Cina', 'China'], []],
  ['JP', 'ja', 'JPY', 'Asia/Tokyo', 'asia', false, ['Japón', 'Japan', 'Japan', 'Japon', 'Giappone', 'Japão'], []],
  ['KR', 'ko', 'KRW', 'Asia/Seoul', 'asia', false, ['Corea del Sur', 'South Korea', 'Südkorea', 'Corée du Sud', 'Corea del Sud', 'Coreia do Sul'], []],
  ['IN', 'hi', 'INR', 'Asia/Kolkata', 'asia', false, ['India', 'India', 'Indien', 'Inde', 'India', 'Índia'], []],
  ['IL', 'he', 'ILS', 'Asia/Jerusalem', 'asia', false, ['Israel', 'Israel', 'Israel', 'Israël', 'Israele', 'Israel'], []],
  ['AU', 'en', 'AUD', 'Australia/Sydney', 'oceania', false, ['Australia', 'Australia', 'Australien', 'Australie', 'Australia', 'Austrália'], []],
  ['MA', 'ar', 'MAD', 'Africa/Casablanca', 'africa', false, ['Marruecos', 'Morocco', 'Marokko', 'Maroc', 'Marocco', 'Marrocos'], []],
  ['ZA', 'en', 'ZAR', 'Africa/Johannesburg', 'africa', false, ['Sudáfrica', 'South Africa', 'Südafrika', 'Afrique du Sud', 'Sudafrica', 'África do Sul'], []],
  // Sin edición propia, pero frecuentes en la actualidad: sin ellos, «Arabia Saudita» o «Faixa de
  // Gaza» se tomaban por personas y unían historias distintas (27-09-2026).
  ['SA', 'ar', 'SAR', 'Asia/Riyadh', 'asia', false, ['Arabia Saudí', 'Saudi Arabia', 'Saudi-Arabien', 'Arabie saoudite', 'Arabia Saudita', 'Arábia Saudita'], ['Arabia Saudita', 'Riad', 'Riyadh', 'Riade']],
  ['IR', 'fa', 'IRR', 'Asia/Tehran', 'asia', false, ['Irán', 'Iran', 'Iran', 'Iran', 'Iran', 'Irão'], ['Irã', 'Teherán', 'Tehran', 'Teheran', 'Téhéran', 'Teerã', 'Teerão']],
  ['IQ', 'ar', 'IQD', 'Asia/Baghdad', 'asia', false, ['Irak', 'Iraq', 'Irak', 'Irak', 'Iraq', 'Iraque'], ['Bagdad', 'Baghdad']],
  ['SY', 'ar', 'SYP', 'Asia/Damascus', 'asia', false, ['Siria', 'Syria', 'Syrien', 'Syrie', 'Siria', 'Síria'], ['Damasco', 'Damascus', 'Damaskus', 'Damas']],
  ['LB', 'ar', 'LBP', 'Asia/Beirut', 'asia', false, ['Líbano', 'Lebanon', 'Libanon', 'Liban', 'Libano', 'Líbano'], ['Beirut', 'Beyrouth']],
  ['PS', 'ar', 'ILS', 'Asia/Gaza', 'asia', false, ['Palestina', 'Palestine', 'Palästina', 'Palestine', 'Palestina', 'Palestina'], ['Gaza', 'Franja de Gaza', 'Gaza Strip', 'Gazastreifen', 'bande de Gaza', 'Striscia di Gaza', 'Faixa de Gaza', 'Cisjordania', 'West Bank', 'Westjordanland', 'Cisjordanie', 'Cisgiordania', 'Cisjordânia']],
  ['JO', 'ar', 'JOD', 'Asia/Amman', 'asia', false, ['Jordania', 'Jordan', 'Jordanien', 'Jordanie', 'Giordania', 'Jordânia'], []],
  ['EG', 'ar', 'EGP', 'Africa/Cairo', 'africa', false, ['Egipto', 'Egypt', 'Ägypten', 'Égypte', 'Egitto', 'Egito'], ['El Cairo', 'Cairo', 'Kairo', 'Le Caire', 'Il Cairo']],
  ['YE', 'ar', 'YER', 'Asia/Aden', 'asia', false, ['Yemen', 'Yemen', 'Jemen', 'Yémen', 'Yemen', 'Iémen'], ['Iêmen']],
  ['QA', 'ar', 'QAR', 'Asia/Qatar', 'asia', false, ['Catar', 'Qatar', 'Katar', 'Qatar', 'Qatar', 'Catar'], ['Doha']],
  ['AE', 'ar', 'AED', 'Asia/Dubai', 'asia', false, ['Emiratos Árabes Unidos', 'United Arab Emirates', 'Vereinigte Arabische Emirate', 'Émirats arabes unis', 'Emirati Arabi Uniti', 'Emirados Árabes Unidos'], ['Dubái', 'Dubai', 'Abu Dabi', 'Abu Dhabi']],
  ['AF', 'ps', 'AFN', 'Asia/Kabul', 'asia', false, ['Afganistán', 'Afghanistan', 'Afghanistan', 'Afghanistan', 'Afghanistan', 'Afeganistão'], ['Kabul', 'Cabul']],
  ['PK', 'ur', 'PKR', 'Asia/Karachi', 'asia', false, ['Pakistán', 'Pakistan', 'Pakistan', 'Pakistan', 'Pakistan', 'Paquistão'], []],
  ['NP', 'ne', 'NPR', 'Asia/Kathmandu', 'asia', false, ['Nepal', 'Nepal', 'Nepal', 'Népal', 'Nepal', 'Nepal'], ['Katmandú', 'Kathmandu']],
  ['BD', 'bn', 'BDT', 'Asia/Dhaka', 'asia', false, ['Bangladés', 'Bangladesh', 'Bangladesch', 'Bangladesh', 'Bangladesh', 'Bangladesh'], ['Bangladesh']],
  ['ID', 'id', 'IDR', 'Asia/Jakarta', 'asia', false, ['Indonesia', 'Indonesia', 'Indonesien', 'Indonésie', 'Indonesia', 'Indonésia'], ['Yakarta', 'Jakarta']],
  ['PH', 'en', 'PHP', 'Asia/Manila', 'asia', false, ['Filipinas', 'Philippines', 'Philippinen', 'Philippines', 'Filippine', 'Filipinas'], ['Manila']],
  ['VN', 'vi', 'VND', 'Asia/Ho_Chi_Minh', 'asia', false, ['Vietnam', 'Vietnam', 'Vietnam', 'Viêt Nam', 'Vietnam', 'Vietnã'], ['Vietname', 'Hanói', 'Hanoi']],
  ['TH', 'th', 'THB', 'Asia/Bangkok', 'asia', false, ['Tailandia', 'Thailand', 'Thailand', 'Thaïlande', 'Thailandia', 'Tailândia'], ['Bangkok', 'Banguecoque']],
  ['TW', 'zh', 'TWD', 'Asia/Taipei', 'asia', false, ['Taiwán', 'Taiwan', 'Taiwan', 'Taïwan', 'Taiwan', 'Taiwan'], ['Taipéi', 'Taipei']],
  ['KP', 'ko', 'KPW', 'Asia/Pyongyang', 'asia', false, ['Corea del Norte', 'North Korea', 'Nordkorea', 'Corée du Nord', 'Corea del Nord', 'Coreia do Norte'], ['Pyongyang']],
  ['NG', 'en', 'NGN', 'Africa/Lagos', 'africa', false, ['Nigeria', 'Nigeria', 'Nigeria', 'Nigeria', 'Nigeria', 'Nigéria'], []],
  ['KE', 'en', 'KES', 'Africa/Nairobi', 'africa', false, ['Kenia', 'Kenya', 'Kenia', 'Kenya', 'Kenya', 'Quênia'], ['Quénia', 'Nairobi']],
  ['ET', 'am', 'ETB', 'Africa/Addis_Ababa', 'africa', false, ['Etiopía', 'Ethiopia', 'Äthiopien', 'Éthiopie', 'Etiopia', 'Etiópia'], []],
  ['SD', 'ar', 'SDG', 'Africa/Khartoum', 'africa', false, ['Sudán', 'Sudan', 'Sudan', 'Soudan', 'Sudan', 'Sudão'], ['Jartum', 'Khartoum', 'Khartum']],
  ['CD', 'fr', 'CDF', 'Africa/Kinshasa', 'africa', false, ['República Democrática del Congo', 'Democratic Republic of the Congo', 'Demokratische Republik Kongo', 'République démocratique du Congo', 'Repubblica Democratica del Congo', 'República Democrática do Congo'], ['RD Congo', 'RDC', 'DR Congo', 'Kinshasa']],
  ['DZ', 'ar', 'DZD', 'Africa/Algiers', 'africa', false, ['Argelia', 'Algeria', 'Algerien', 'Algérie', 'Algeria', 'Argélia'], ['Argel', 'Algiers', 'Alger']],
  ['TN', 'ar', 'TND', 'Africa/Tunis', 'africa', false, ['Túnez', 'Tunisia', 'Tunesien', 'Tunisie', 'Tunisia', 'Tunísia'], []],
  ['LY', 'ar', 'LYD', 'Africa/Tripoli', 'africa', false, ['Libia', 'Libya', 'Libyen', 'Libye', 'Libia', 'Líbia'], ['Trípoli', 'Tripoli']],
  ['SN', 'fr', 'XOF', 'Africa/Dakar', 'africa', false, ['Senegal', 'Senegal', 'Senegal', 'Sénégal', 'Senegal', 'Senegal'], ['Dakar']],
  ['ML', 'fr', 'XOF', 'Africa/Bamako', 'africa', false, ['Malí', 'Mali', 'Mali', 'Mali', 'Mali', 'Mali'], ['Bamako']],
  ['SO', 'so', 'SOS', 'Africa/Mogadishu', 'africa', false, ['Somalia', 'Somalia', 'Somalia', 'Somalie', 'Somalia', 'Somália'], ['Mogadiscio', 'Mogadishu']],
  ['HU', 'hu', 'HUF', 'Europe/Budapest', 'europe', false, ['Hungría', 'Hungary', 'Ungarn', 'Hongrie', 'Ungheria', 'Hungria'], ['Budapest']],
  ['CZ', 'cs', 'CZK', 'Europe/Prague', 'europe', false, ['Chequia', 'Czech Republic', 'Tschechien', 'Tchéquie', 'Repubblica Ceca', 'Chéquia'], ['República Checa', 'Czechia', 'Praga', 'Prague', 'Prag']],
  ['RO', 'ro', 'RON', 'Europe/Bucharest', 'europe', false, ['Rumania', 'Romania', 'Rumänien', 'Roumanie', 'Romania', 'Romênia'], ['Roménia', 'Bucarest', 'Bucharest']],
  ['RS', 'sr', 'RSD', 'Europe/Belgrade', 'europe', false, ['Serbia', 'Serbia', 'Serbien', 'Serbie', 'Serbia', 'Sérvia'], ['Belgrado', 'Belgrade']],
  ['BY', 'be', 'BYN', 'Europe/Minsk', 'europe', false, ['Bielorrusia', 'Belarus', 'Belarus', 'Biélorussie', 'Bielorussia', 'Bielorrússia'], ['Minsk']],
  ['FI', 'fi', 'EUR', 'Europe/Helsinki', 'europe', false, ['Finlandia', 'Finland', 'Finnland', 'Finlande', 'Finlandia', 'Finlândia'], ['Helsinki']],
  ['MD', 'ro', 'MDL', 'Europe/Chisinau', 'europe', false, ['Moldavia', 'Moldova', 'Moldau', 'Moldavie', 'Moldavia', 'Moldávia'], []],
  ['AM', 'hy', 'AMD', 'Asia/Yerevan', 'asia', false, ['Armenia', 'Armenia', 'Armenien', 'Arménie', 'Armenia', 'Armênia'], ['Arménia']],
  ['AZ', 'az', 'AZN', 'Asia/Baku', 'asia', false, ['Azerbaiyán', 'Azerbaijan', 'Aserbaidschan', 'Azerbaïdjan', 'Azerbaigian', 'Azerbaijão'], []],
  ['CU', 'es', 'CUP', 'America/Havana', 'central_america', false, ['Cuba', 'Cuba', 'Kuba', 'Cuba', 'Cuba', 'Cuba'], ['La Habana', 'Havana', 'Havanna']],
  ['HT', 'fr', 'HTG', 'America/Port-au-Prince', 'central_america', false, ['Haití', 'Haiti', 'Haiti', 'Haïti', 'Haiti', 'Haiti'], []],
  ['BO', 'es', 'BOB', 'America/La_Paz', 'south_america', false, ['Bolivia', 'Bolivia', 'Bolivien', 'Bolivie', 'Bolivia', 'Bolívia'], []],
  ['PY', 'es', 'PYG', 'America/Asuncion', 'south_america', false, ['Paraguay', 'Paraguay', 'Paraguay', 'Paraguay', 'Paraguay', 'Paraguai'], []],
  ['GT', 'es', 'GTQ', 'America/Guatemala', 'central_america', false, ['Guatemala', 'Guatemala', 'Guatemala', 'Guatemala', 'Guatemala', 'Guatemala'], []],
  ['HN', 'es', 'HNL', 'America/Tegucigalpa', 'central_america', false, ['Honduras', 'Honduras', 'Honduras', 'Honduras', 'Honduras', 'Honduras'], []],
  ['SV', 'es', 'USD', 'America/El_Salvador', 'central_america', false, ['El Salvador', 'El Salvador', 'El Salvador', 'El Salvador', 'El Salvador', 'El Salvador'], []],
  ['NI', 'es', 'NIO', 'America/Managua', 'central_america', false, ['Nicaragua', 'Nicaragua', 'Nicaragua', 'Nicaragua', 'Nicaragua', 'Nicarágua'], []],
  ['DO', 'es', 'DOP', 'America/Santo_Domingo', 'central_america', false, ['República Dominicana', 'Dominican Republic', 'Dominikanische Republik', 'République dominicaine', 'Repubblica Dominicana', 'República Dominicana'], []],
  ['PA', 'es', 'PAB', 'America/Panama', 'central_america', false, ['Panamá', 'Panama', 'Panama', 'Panama', 'Panama', 'Panamá'], []],
  ['NZ', 'en', 'NZD', 'Pacific/Auckland', 'oceania', false, ['Nueva Zelanda', 'New Zealand', 'Neuseeland', 'Nouvelle-Zélande', 'Nuova Zelanda', 'Nova Zelândia'], []],
];

const LANG_ORDER = ['es', 'en', 'de', 'fr', 'it', 'pt'] as const;

export const COUNTRIES: CountryDef[] = ROWS.map(([code, lang, currency, tz, continent, edition, names, aliases]) => {
  const n: Record<string, string> = {};
  const s: Record<string, string> = {};
  LANG_ORDER.forEach((l, i) => {
    n[l] = names[i];
    s[l] = slugify(names[i]);
  });
  return { code, names: n, slugs: s, defaultLanguage: lang, currency, timezone: tz, continent, edition, aliases: aliases ?? [] };
});

export const EDITION_COUNTRIES = COUNTRIES.filter((c) => c.edition).map((c) => c.code);

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
export function country(code: string | null | undefined): CountryDef | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

export function countryBySlug(lang: string, slug: string): CountryDef | undefined {
  return COUNTRIES.find((c) => c.slugs[lang] === slug);
}

/** Zona euro: sirve para agrupar precios y para "Europa" en portadas. */
export const EUROZONE = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
export const EU = [...EUROZONE, 'BG', 'CZ', 'DK', 'HU', 'PL', 'RO', 'SE'];
export const LATAM = ['MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'CU', 'BR'];
