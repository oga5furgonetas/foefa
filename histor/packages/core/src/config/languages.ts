/**
 * Idiomas. Añadir uno nuevo = añadir aquí su entrada + su diccionario en
 * i18n/dictionaries/<code>.ts + sus slugs en config/categories.ts y
 * config/routes.ts. El resto (hreflang, sitemaps, búsqueda) sale solo.
 */
export type LanguageCode = 'es' | 'en' | 'de' | 'fr' | 'it' | 'pt';

export type LanguageDef = {
  code: string;
  name: string;
  nativeName: string;
  /** Configuración de búsqueda de PostgreSQL. */
  ftsConfig: string;
  rtl: boolean;
  enabled: boolean;
  /** Locale BCP-47 por defecto para fechas y números. */
  locale: string;
  /** Locales hreflang que se anuncian para este idioma. */
  hreflang: string;
};

export const LANGUAGES: LanguageDef[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español', ftsConfig: 'spanish', rtl: false, enabled: true, locale: 'es-ES', hreflang: 'es' },
  { code: 'en', name: 'English', nativeName: 'English', ftsConfig: 'english', rtl: false, enabled: true, locale: 'en-US', hreflang: 'en' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', ftsConfig: 'german', rtl: false, enabled: true, locale: 'de-DE', hreflang: 'de' },
  { code: 'fr', name: 'French', nativeName: 'Français', ftsConfig: 'french', rtl: false, enabled: true, locale: 'fr-FR', hreflang: 'fr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', ftsConfig: 'italian', rtl: false, enabled: true, locale: 'it-IT', hreflang: 'it' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', ftsConfig: 'portuguese', rtl: false, enabled: true, locale: 'pt-BR', hreflang: 'pt' },
  // Preparados (sin diccionario todavía → desactivados):
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', ftsConfig: 'dutch', rtl: false, enabled: false, locale: 'nl-NL', hreflang: 'nl' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', ftsConfig: 'simple', rtl: false, enabled: false, locale: 'ja-JP', hreflang: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', ftsConfig: 'simple', rtl: false, enabled: false, locale: 'ko-KR', hreflang: 'ko' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', ftsConfig: 'arabic', rtl: true, enabled: false, locale: 'ar', hreflang: 'ar' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', ftsConfig: 'simple', rtl: false, enabled: false, locale: 'hi-IN', hreflang: 'hi' },
];

export const ACTIVE_LANGUAGES = LANGUAGES.filter((l) => l.enabled).map((l) => l.code) as LanguageCode[];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isActiveLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && (ACTIVE_LANGUAGES as string[]).includes(code);
}

export function languageDef(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1];
}

export function localeFor(lang: string, country?: string | null): string {
  const base = languageDef(lang).locale;
  if (!country) return base;
  // es + MX → es-MX; en + GB → en-GB; pt + PT → pt-PT: fechas y números locales.
  return `${lang}-${country.toUpperCase()}`;
}
