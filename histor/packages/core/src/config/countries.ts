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
  ['PE', 'es', 'PEN', 'America/Lima', 'south_america', false, ['Perú', 'Peru', 'Peru', 'Pérou', 'Perù', 'Peru'], []],
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
