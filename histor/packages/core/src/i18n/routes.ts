/**
 * URLs localizadas. Cada idioma tiene sus palabras de ruta; el resolvedor
 * convierte /{lang}/{...segmentos} en una página tipada, y `href()` hace lo
 * contrario. Las URLs de noticias son estables: /{lang}/{aaaa}/{mm}/{dd}/{slug}.
 */
import { CATEGORIES, categoryBySlug } from '../config/categories';
import { CITIES } from '../config/cities';
import { COUNTRIES, countryBySlug } from '../config/countries';
import { REGIONS } from '../config/regions';

export const ROUTE_WORDS = {
  search: { es: 'buscar', en: 'search', de: 'suche', fr: 'recherche', it: 'cerca', pt: 'busca' },
  topic: { es: 'tema', en: 'topic', de: 'thema', fr: 'sujet', it: 'argomento', pt: 'tema' },
  author: { es: 'autor', en: 'author', de: 'autor', fr: 'auteur', it: 'autore', pt: 'autor' },
  source: { es: 'fuente', en: 'source', de: 'quelle', fr: 'source', it: 'fonte', pt: 'fonte' },
  story: { es: 'historia', en: 'story', de: 'geschichte', fr: 'histoire', it: 'storia', pt: 'historia' },
  latest: { es: 'ultimas', en: 'latest', de: 'neueste', fr: 'dernieres', it: 'ultime', pt: 'ultimas' },
  breaking: { es: 'ultima-hora', en: 'breaking', de: 'eilmeldungen', fr: 'alertes', it: 'ultima-ora', pt: 'urgente' },
  trending: { es: 'tendencias', en: 'trending', de: 'trends', fr: 'tendances', it: 'tendenze', pt: 'tendencias' },
  forYou: { es: 'para-ti', en: 'for-you', de: 'fuer-dich', fr: 'pour-vous', it: 'per-te', pt: 'para-voce' },
  local: { es: 'local', en: 'local', de: 'lokal', fr: 'local', it: 'locale', pt: 'local' },
  howItWorks: { es: 'como-funciona', en: 'how-it-works', de: 'so-arbeiten-wir', fr: 'comment-ca-marche', it: 'come-funziona', pt: 'como-funciona' },
  editorialPolicy: { es: 'politica-editorial', en: 'editorial-policy', de: 'redaktionelle-grundsaetze', fr: 'charte-editoriale', it: 'linee-guida-editoriali', pt: 'politica-editorial' },
  corrections: { es: 'correcciones', en: 'corrections', de: 'korrekturen', fr: 'corrections', it: 'correzioni', pt: 'correcoes' },
  privacy: { es: 'privacidad', en: 'privacy', de: 'datenschutz', fr: 'confidentialite', it: 'privacy', pt: 'privacidade' },
  cookies: { es: 'cookies', en: 'cookies', de: 'cookies', fr: 'cookies', it: 'cookie', pt: 'cookies' },
  terms: { es: 'terminos', en: 'terms', de: 'nutzungsbedingungen', fr: 'conditions', it: 'termini', pt: 'termos' },
  subscriptionTerms: { es: 'condiciones-suscripcion', en: 'subscription-terms', de: 'abo-bedingungen', fr: 'conditions-abonnement', it: 'condizioni-abbonamento', pt: 'termos-assinatura' },
  contact: { es: 'contacto', en: 'contact', de: 'kontakt', fr: 'contact', it: 'contatti', pt: 'contato' },
  legalNotice: { es: 'aviso-legal', en: 'legal-notice', de: 'impressum', fr: 'mentions-legales', it: 'note-legali', pt: 'aviso-legal' },
  report: { es: 'informar-error', en: 'report-an-error', de: 'fehler-melden', fr: 'signaler-une-erreur', it: 'segnala-errore', pt: 'reportar-erro' },
  newsletters: { es: 'newsletters', en: 'newsletters', de: 'newsletter', fr: 'newsletters', it: 'newsletter', pt: 'newsletters' },
  subscribe: { es: 'suscribete', en: 'subscribe', de: 'abonnieren', fr: 'abonnement', it: 'abbonati', pt: 'assine' },
  account: { es: 'cuenta', en: 'account', de: 'konto', fr: 'compte', it: 'account', pt: 'conta' },
  login: { es: 'entrar', en: 'login', de: 'anmelden', fr: 'connexion', it: 'accedi', pt: 'entrar' },
  register: { es: 'registro', en: 'register', de: 'registrieren', fr: 'inscription', it: 'registrati', pt: 'cadastro' },
  resetPassword: { es: 'recuperar-contrasena', en: 'reset-password', de: 'passwort-zuruecksetzen', fr: 'mot-de-passe-oublie', it: 'recupera-password', pt: 'recuperar-senha' },
  saved: { es: 'guardadas', en: 'saved', de: 'gemerkt', fr: 'sauvegardes', it: 'salvati', pt: 'salvos' },
  sources: { es: 'fuentes', en: 'sources', de: 'quellen', fr: 'sources', it: 'fonti', pt: 'fontes' },
} as const satisfies Record<string, Record<string, string>>;

export type RouteWord = keyof typeof ROUTE_WORDS;

export const STATIC_PAGES: RouteWord[] = [
  'howItWorks',
  'editorialPolicy',
  'corrections',
  'privacy',
  'cookies',
  'terms',
  'subscriptionTerms',
  'contact',
  'legalNotice',
  'report',
  'newsletters',
  'subscribe',
  'account',
  'login',
  'register',
  'resetPassword',
  'saved',
  'sources',
];

export type RouteMatch =
  | { kind: 'home' }
  | { kind: 'article'; year: string; month: string; day: string; slug: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'country'; countryCode: string }
  | { kind: 'region'; countryCode: string; regionCode: string }
  | { kind: 'city'; countryCode: string; regionCode: string | null; cityKey: string }
  | { kind: 'topic'; slug: string }
  | { kind: 'author'; slug: string }
  | { kind: 'source'; slug: string }
  | { kind: 'story'; slug: string }
  | { kind: 'list'; list: 'latest' | 'breaking' | 'trending' | 'forYou' }
  | { kind: 'search' }
  | { kind: 'page'; page: RouteWord }
  | { kind: 'notFound' };

function word(lang: string, w: RouteWord): string {
  return (ROUTE_WORDS[w] as Record<string, string>)[lang] ?? (ROUTE_WORDS[w] as Record<string, string>).en;
}

export function resolveRoute(lang: string, segments: string[]): RouteMatch {
  const seg = segments.map((s) => decodeURIComponent(s).toLowerCase());
  if (!seg.length) return { kind: 'home' };
  const [a, b, c, d] = seg;
  if (seg.length === 4 && /^\d{4}$/.test(a) && /^\d{2}$/.test(b) && /^\d{2}$/.test(c)) return { kind: 'article', year: a, month: b, day: c, slug: d };
  if (seg.length === 2) {
    if (a === word(lang, 'topic')) return { kind: 'topic', slug: b };
    if (a === word(lang, 'author')) return { kind: 'author', slug: b };
    if (a === word(lang, 'source')) return { kind: 'source', slug: b };
    if (a === word(lang, 'story')) return { kind: 'story', slug: b };
  }
  if (seg.length === 1) {
    if (a === word(lang, 'search')) return { kind: 'search' };
    for (const l of ['latest', 'breaking', 'trending', 'forYou'] as const) if (a === word(lang, l)) return { kind: 'list', list: l };
    for (const p of STATIC_PAGES) if (a === word(lang, p)) return { kind: 'page', page: p };
    const cat = categoryBySlug(lang, a);
    if (cat) return { kind: 'category', categoryId: cat.id };
  }
  const country = countryBySlug(lang, a);
  if (country) {
    if (seg.length === 1) return { kind: 'country', countryCode: country.code };
    const region = REGIONS.find((r) => r.countryCode === country.code && r.slugs[lang] === b);
    if (region) {
      if (seg.length === 2) return { kind: 'region', countryCode: country.code, regionCode: region.code };
      const city = CITIES.find((x) => x.countryCode === country.code && x.regionCode === region.code && x.slugs[lang] === c);
      if (city && seg.length === 3) return { kind: 'city', countryCode: country.code, regionCode: region.code, cityKey: city.key };
    } else if (seg.length === 2) {
      const city = CITIES.find((x) => x.countryCode === country.code && x.slugs[lang] === b);
      if (city) return { kind: 'city', countryCode: country.code, regionCode: city.regionCode, cityKey: city.key };
    }
  }
  return { kind: 'notFound' };
}

/** Rutas relativas localizadas. */
export const href = {
  home: (lang: string) => `/${lang}`,
  article: (lang: string, publishedAt: Date | string, slug: string) => {
    const d = new Date(publishedAt);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `/${lang}/${y}/${m}/${day}/${slug}`;
  },
  category: (lang: string, id: string) => `/${lang}/${CATEGORIES.find((c) => c.id === id)?.slugs[lang] ?? id}`,
  country: (lang: string, code: string) => `/${lang}/${COUNTRIES.find((c) => c.code === code)?.slugs[lang] ?? code.toLowerCase()}`,
  region: (lang: string, code: string) => {
    const r = REGIONS.find((x) => x.code === code);
    return r ? `${href.country(lang, r.countryCode)}/${r.slugs[lang]}` : `/${lang}`;
  },
  city: (lang: string, key: string) => {
    const c = CITIES.find((x) => x.key === key);
    if (!c) return `/${lang}`;
    return c.regionCode ? `${href.region(lang, c.regionCode)}/${c.slugs[lang]}` : `${href.country(lang, c.countryCode)}/${c.slugs[lang]}`;
  },
  topic: (lang: string, slug: string) => `/${lang}/${word(lang, 'topic')}/${slug}`,
  author: (lang: string, slug: string) => `/${lang}/${word(lang, 'author')}/${slug}`,
  source: (lang: string, slug: string) => `/${lang}/${word(lang, 'source')}/${slug}`,
  story: (lang: string, slug: string) => `/${lang}/${word(lang, 'story')}/${slug}`,
  list: (lang: string, l: 'latest' | 'breaking' | 'trending' | 'forYou') => `/${lang}/${word(lang, l)}`,
  search: (lang: string, q?: string) => `/${lang}/${word(lang, 'search')}${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  page: (lang: string, p: RouteWord) => `/${lang}/${word(lang, p)}`,
};
