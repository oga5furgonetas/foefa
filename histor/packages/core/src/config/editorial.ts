/**
 * Mesas de redacción (autores automáticos, presentados como tales: Histor
 * no inventa periodistas) y newsletters de partida.
 */
export type DeskSeed = { slug: string; categoryId: string | null; names: Record<string, string>; bio: Record<string, string> };

const deskBio = (area: Record<string, string>): Record<string, string> => ({
  es: `Mesa ${area.es} de Histor. Textos elaborados con un sistema automatizado a partir de fuentes contrastadas y revisados por controles editoriales. No es una persona.`,
  en: `Histor's ${area.en} desk. Stories produced by an automated system from cross-checked sources and passed through editorial controls. Not a person.`,
  de: `${area.de} von Histor. Texte, die ein automatisiertes System aus geprüften Quellen erstellt und die redaktionelle Kontrollen durchlaufen. Keine Person.`,
  fr: `Pôle ${area.fr} de Histor. Articles produits par un système automatisé à partir de sources recoupées et soumis à des contrôles éditoriaux. Ce n'est pas une personne.`,
  it: `Desk ${area.it} di Histor. Testi prodotti da un sistema automatizzato a partire da fonti verificate e sottoposti a controlli editoriali. Non è una persona.`,
  pt: `Editoria de ${area.pt} do Histor. Textos produzidos por um sistema automatizado a partir de fontes checadas e submetidos a controles editoriais. Não é uma pessoa.`,
});

export const DESKS: DeskSeed[] = [
  {
    slug: 'redaccion',
    categoryId: null,
    names: { es: 'Redacción Histor', en: 'Histor Newsroom', de: 'Histor-Redaktion', fr: 'Rédaction Histor', it: 'Redazione Histor', pt: 'Redação Histor' },
    bio: deskBio({ es: 'central', en: 'central', de: 'Zentralredaktion', fr: 'central', it: 'centrale', pt: 'central' }),
  },
  {
    slug: 'internacional',
    categoryId: 'world',
    names: { es: 'Histor Internacional', en: 'Histor World', de: 'Histor Ausland', fr: 'Histor International', it: 'Histor Esteri', pt: 'Histor Internacional' },
    bio: deskBio({ es: 'de Internacional', en: 'World', de: 'Auslandsressort', fr: 'International', it: 'Esteri', pt: 'Internacional' }),
  },
  {
    slug: 'economia',
    categoryId: 'economy',
    names: { es: 'Histor Economía', en: 'Histor Economy', de: 'Histor Wirtschaft', fr: 'Histor Économie', it: 'Histor Economia', pt: 'Histor Economia' },
    bio: deskBio({ es: 'de Economía', en: 'Economy', de: 'Wirtschaftsressort', fr: 'Économie', it: 'Economia', pt: 'Economia' }),
  },
  {
    slug: 'tecnologia',
    categoryId: 'technology',
    names: { es: 'Histor Tecnología', en: 'Histor Technology', de: 'Histor Technik', fr: 'Histor Tech', it: 'Histor Tecnologia', pt: 'Histor Tecnologia' },
    bio: deskBio({ es: 'de Tecnología', en: 'Technology', de: 'Technikressort', fr: 'Technologie', it: 'Tecnologia', pt: 'Tecnologia' }),
  },
  {
    slug: 'ciencia',
    categoryId: 'science',
    names: { es: 'Histor Ciencia', en: 'Histor Science', de: 'Histor Wissen', fr: 'Histor Sciences', it: 'Histor Scienza', pt: 'Histor Ciência' },
    bio: deskBio({ es: 'de Ciencia', en: 'Science', de: 'Wissenschaftsressort', fr: 'Sciences', it: 'Scienza', pt: 'Ciência' }),
  },
  {
    slug: 'deportes',
    categoryId: 'sports',
    names: { es: 'Histor Deportes', en: 'Histor Sport', de: 'Histor Sport', fr: 'Histor Sport', it: 'Histor Sport', pt: 'Histor Esportes' },
    bio: deskBio({ es: 'de Deportes', en: 'Sport', de: 'Sportressort', fr: 'Sport', it: 'Sport', pt: 'Esportes' }),
  },
];

export const DESK_BY_CATEGORY: Record<string, string> = {
  world: 'internacional',
  politics: 'redaccion',
  economy: 'economia',
  business: 'economia',
  technology: 'tecnologia',
  science: 'ciencia',
  health: 'ciencia',
  sports: 'deportes',
};

export type NewsletterSeed = {
  slug: string;
  kind: 'edition' | 'city' | 'category';
  language: string;
  countryCode?: string;
  cityKey?: string;
  categoryId?: string;
  names: Record<string, string>;
  timezone: string;
  sendHourLocal: number;
  isPremium?: boolean;
};

export const NEWSLETTER_SEEDS: NewsletterSeed[] = [
  { slug: 'espana-manana', kind: 'edition', language: 'es', countryCode: 'ES', names: { es: 'Las 5 noticias de España esta mañana' }, timezone: 'Europe/Madrid', sendHourLocal: 7 },
  { slug: 'us-morning-brief', kind: 'edition', language: 'en', countryCode: 'US', names: { en: 'US Morning Brief' }, timezone: 'America/New_York', sendHourLocal: 7 },
  { slug: 'uk-morning-brief', kind: 'edition', language: 'en', countryCode: 'GB', names: { en: 'UK Morning Brief' }, timezone: 'Europe/London', sendHourLocal: 7 },
  { slug: 'deutschland-morgen', kind: 'edition', language: 'de', countryCode: 'DE', names: { de: 'Deutschland am Morgen' }, timezone: 'Europe/Berlin', sendHourLocal: 7 },
  { slug: 'france-matin', kind: 'edition', language: 'fr', countryCode: 'FR', names: { fr: 'Le brief France du matin' }, timezone: 'Europe/Paris', sendHourLocal: 7 },
  { slug: 'italia-mattina', kind: 'edition', language: 'it', countryCode: 'IT', names: { it: 'Il brief Italia del mattino' }, timezone: 'Europe/Rome', sendHourLocal: 7 },
  { slug: 'brasil-manha', kind: 'edition', language: 'pt', countryCode: 'BR', names: { pt: 'Brasil de manhã' }, timezone: 'America/Sao_Paulo', sendHourLocal: 7 },
  { slug: 'berlin-daily', kind: 'city', language: 'de', countryCode: 'DE', cityKey: 'de-berlin', names: { de: 'Berlin Daily', en: 'Berlin Daily' }, timezone: 'Europe/Berlin', sendHourLocal: 7, isPremium: true },
  { slug: 'madrid-hoy', kind: 'city', language: 'es', countryCode: 'ES', cityKey: 'es-madrid', names: { es: 'Madrid hoy' }, timezone: 'Europe/Madrid', sendHourLocal: 7, isPremium: true },
  { slug: 'tech-brief', kind: 'category', language: 'en', categoryId: 'technology', names: { en: 'Tech Brief' }, timezone: 'UTC', sendHourLocal: 12 },
  { slug: 'markets-brief', kind: 'category', language: 'en', categoryId: 'economy', names: { en: 'Markets Brief' }, timezone: 'America/New_York', sendHourLocal: 17, isPremium: true },
  { slug: 'tech-es', kind: 'category', language: 'es', categoryId: 'technology', names: { es: 'Tecnología en 5 minutos' }, timezone: 'Europe/Madrid', sendHourLocal: 12 },
];
