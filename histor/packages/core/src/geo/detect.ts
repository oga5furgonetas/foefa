/**
 * Geolocalización y preferencia de idioma, sin depender solo de la IP:
 *   idioma  = preferencia guardada > cuenta > Accept-Language > idioma del país
 *   edición = preferencia guardada > cuenta > país de la CDN (cabecera) > país del idioma
 * La IP nunca se guarda: solo se leen las cabeceras de país/región/ciudad
 * que añade la CDN (Cloudflare, Vercel, Fastly…) cuando existen.
 */
import { countryFromIp } from './ipcountry';
import { CITIES } from '../config/cities';
import { COUNTRIES, country } from '../config/countries';
import { ACTIVE_LANGUAGES, DEFAULT_LANGUAGE, isActiveLanguage, type LanguageCode } from '../config/languages';
import { REGIONS } from '../config/regions';

export type GeoContext = {
  lang: LanguageCode;
  countryCode: string | null;
  regionCode: string | null;
  cityKey: string | null;
  timezone: string;
  source: { lang: 'cookie' | 'account' | 'header' | 'country' | 'default'; country: 'cookie' | 'account' | 'cdn' | 'language' | 'none' };
};

type HeaderGetter = (name: string) => string | null | undefined;

/** Idiomas del navegador por orden de preferencia (q). */
export function parseAcceptLanguage(header: string | null | undefined): { lang: string; region: string | null; q: number }[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      const [l, r] = tag.trim().split('-');
      return { lang: (l ?? '').toLowerCase(), region: r ? r.toUpperCase() : null, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.lang && x.lang !== '*')
    .sort((a, b) => b.q - a.q);
}

export function countryFromHeaders(h: HeaderGetter): string | null {
  const raw = h('cf-ipcountry') ?? h('x-vercel-ip-country') ?? h('x-country-code') ?? h('cloudfront-viewer-country') ?? h('fastly-geo-country') ?? null;
  if (raw && raw !== 'XX' && raw !== 'T1') {
    const cc = raw.toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) return cc;
  }
  // Sin CDN que lo diga (Fly): por la IP del lector, consultada en memoria y nunca guardada.
  return countryFromIp(h('fly-client-ip') ?? h('x-forwarded-for'));
}

export function regionFromHeaders(h: HeaderGetter, countryCode: string | null): string | null {
  const r = h('x-vercel-ip-country-region') ?? h('cf-region-code') ?? h('cloudfront-viewer-country-region') ?? null;
  if (!r || !countryCode) return null;
  const code = `${countryCode}-${r.toUpperCase()}`;
  return REGIONS.some((x) => x.code === code) ? code : null;
}

export function cityFromHeaders(h: HeaderGetter, countryCode: string | null): string | null {
  const raw = h('x-vercel-ip-city') ?? h('cf-ipcity') ?? h('cloudfront-viewer-city') ?? null;
  if (!raw || !countryCode) return null;
  const name = decodeURIComponent(raw).toLowerCase();
  const c = CITIES.find((x) => x.countryCode === countryCode && x.aliases.some((a) => a.toLowerCase() === name));
  return c?.key ?? null;
}

export function detectGeo(
  h: HeaderGetter,
  prefs: { lang?: string | null; country?: string | null; region?: string | null; city?: string | null; accountLang?: string | null; accountCountry?: string | null } = {},
): GeoContext {
  const cdnCountry = countryFromHeaders(h);
  // Idioma
  let lang: LanguageCode = DEFAULT_LANGUAGE;
  let langSource: GeoContext['source']['lang'] = 'default';
  const accepted = parseAcceptLanguage(h('accept-language'));
  if (isActiveLanguage(prefs.lang)) {
    lang = prefs.lang;
    langSource = 'cookie';
  } else if (isActiveLanguage(prefs.accountLang)) {
    lang = prefs.accountLang;
    langSource = 'account';
  } else {
    const first = accepted.find((a) => isActiveLanguage(a.lang));
    if (first) {
      lang = first.lang as LanguageCode;
      langSource = 'header';
    } else if (cdnCountry && isActiveLanguage(country(cdnCountry)?.defaultLanguage)) {
      lang = country(cdnCountry)!.defaultLanguage as LanguageCode;
      langSource = 'country';
    }
  }
  // Edición (país)
  let countryCode: string | null = null;
  let countrySource: GeoContext['source']['country'] = 'none';
  if (prefs.country && country(prefs.country)) {
    countryCode = prefs.country.toUpperCase();
    countrySource = 'cookie';
  } else if (prefs.accountCountry && country(prefs.accountCountry)) {
    countryCode = prefs.accountCountry.toUpperCase();
    countrySource = 'account';
  } else if (cdnCountry && country(cdnCountry)) {
    countryCode = cdnCountry;
    countrySource = 'cdn';
  } else {
    // Sin geolocalización: la región del Accept-Language (es-MX → México) o el país "natural" del idioma.
    const withRegion = accepted.find((a) => a.lang === lang && a.region && country(a.region));
    countryCode = withRegion?.region ?? COUNTRIES.find((c) => c.edition && c.defaultLanguage === lang)?.code ?? null;
    countrySource = countryCode ? 'language' : 'none';
  }
  const regionCode = prefs.region && REGIONS.some((r) => r.code === prefs.region) ? prefs.region : countrySource === 'cdn' ? regionFromHeaders(h, countryCode) : null;
  const cityKey = prefs.city && CITIES.some((c) => c.key === prefs.city) ? prefs.city : countrySource === 'cdn' ? cityFromHeaders(h, countryCode) : null;
  const tz = h('x-vercel-ip-timezone') ?? h('cf-timezone') ?? (countryCode ? country(countryCode)?.timezone : null) ?? 'UTC';
  return { lang, countryCode, regionCode, cityKey, timezone: tz, source: { lang: langSource, country: countrySource } };
}

export { ACTIVE_LANGUAGES };
