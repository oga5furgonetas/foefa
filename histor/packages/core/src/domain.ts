/**
 * Vocabulario del dominio de Histor. Todo lo que el resto del sistema
 * considera "estado" o "tipo" sale de aquí, para que la base de datos,
 * la API, el panel y los tests hablen exactamente el mismo idioma.
 */

/** Estados editoriales de una historia (sección 2 del encargo). */
export const STORY_STATES = [
  'DISCOVERED',
  'UNVERIFIED',
  'INVESTIGATING',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
  'PUBLISHED',
  'UPDATED',
  'RETRACTED',
  // Estados terminales o de bloqueo que no se publican nunca solos:
  'HELD', // retenida por los guardarraíles (se reevalúa)
  'REJECTED', // descartada (sátira, rumor sin base, antigua reciclada…)
  'BLOCKED', // bloqueada por un editor
] as const;
export type StoryState = (typeof STORY_STATES)[number];

/** Transiciones permitidas. Cualquier otra es un error de programación. */
export const STORY_TRANSITIONS: Record<StoryState, readonly StoryState[]> = {
  DISCOVERED: ['UNVERIFIED', 'REJECTED', 'BLOCKED'],
  UNVERIFIED: ['INVESTIGATING', 'HELD', 'REJECTED', 'BLOCKED'],
  INVESTIGATING: ['PARTIALLY_VERIFIED', 'VERIFIED', 'HELD', 'REJECTED', 'BLOCKED', 'UNVERIFIED'],
  PARTIALLY_VERIFIED: ['VERIFIED', 'PUBLISHED', 'HELD', 'INVESTIGATING', 'REJECTED', 'BLOCKED'],
  VERIFIED: ['PUBLISHED', 'HELD', 'PARTIALLY_VERIFIED', 'INVESTIGATING', 'BLOCKED'],
  PUBLISHED: ['UPDATED', 'RETRACTED', 'BLOCKED'],
  UPDATED: ['UPDATED', 'RETRACTED', 'BLOCKED'],
  RETRACTED: [],
  HELD: ['INVESTIGATING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'REJECTED', 'BLOCKED'],
  REJECTED: ['INVESTIGATING', 'BLOCKED'],
  BLOCKED: ['INVESTIGATING'],
};

export function canTransition(from: StoryState, to: StoryState): boolean {
  return STORY_TRANSITIONS[from].includes(to);
}

export const PUBLIC_STORY_STATES: readonly StoryState[] = ['PUBLISHED', 'UPDATED'];

/**
 * Tipos de fuente (sección 2). El orden no es un ranking: el peso de cada
 * tipo vive en verification/sourceTypes.ts y es configurable.
 */
export const SOURCE_TYPES = [
  'primary_official', // el propio organismo que produce el dato (BOE, USGS, un ministerio sobre su decisión)
  'official', // institución pública que informa de algo
  'wire_agency', // agencia de noticias (EFE, dpa, ANSA, Agência Brasil…)
  'reputable_media', // medio periodístico con redacción identificable y política de correcciones
  'identified_journalist', // periodista con nombre y trayectoria verificable
  'academic', // universidad, revista científica, preprint (con matiz)
  'company', // comunicado de una empresa sobre sí misma
  'witness', // testigo identificado
  'social_media', // publicación en redes (X, Reddit, Telegram, TikTok…): PISTA, no evidencia
  'ugc', // contenido generado por usuarios
  'blog',
  'aggregator', // agregador: nunca cuenta como fuente independiente
  'anonymous',
  'unverifiable',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CONNECTOR_KINDS = [
  'rss',
  'atom',
  'jsonfeed',
  'geojson',
  'sitemap',
  'html',
  'api',
  'reddit',
  'x',
  'youtube',
  'bluesky',
  'mastodon',
] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export const CLAIM_KINDS = ['fact', 'quote', 'number', 'prediction', 'allegation', 'opinion', 'question'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** Cómo se afirma algo. "asserted" es lo único que puede acabar como hecho. */
export const MODALITIES = ['asserted', 'attributed', 'hedged', 'predicted', 'denied', 'questioned'] as const;
export type Modality = (typeof MODALITIES)[number];

export const CLAIM_STATUSES = ['supported', 'partially_supported', 'unsupported', 'contradicted'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const STORY_FLAGS = [
  'single_source',
  'social_only',
  'satire_source',
  'old_resurfaced',
  'old_image',
  'copied_network',
  'contradictions',
  'fabricated_quote',
  'date_mismatch',
  'prediction_as_fact',
  'viral_unverified',
  'no_primary',
  'geo_mismatch',
] as const;
export type StoryFlag = (typeof STORY_FLAGS)[number];

export const ROLES = ['reader', 'editor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  'admin.view': ['editor', 'admin'],
  'stories.edit': ['editor', 'admin'],
  'stories.block': ['editor', 'admin'],
  'articles.edit': ['editor', 'admin'],
  'articles.correct': ['editor', 'admin'],
  'articles.retract': ['admin'],
  'sources.manage': ['admin'],
  'sources.block': ['editor', 'admin'],
  'settings.manage': ['admin'],
  'pricing.manage': ['admin'],
  'categories.manage': ['admin'],
  'languages.manage': ['admin'],
  'users.manage': ['admin'],
  'reports.manage': ['editor', 'admin'],
  'experiments.manage': ['admin'],
  'newsletters.manage': ['editor', 'admin'],
  'audit.view': ['admin'],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const REPORT_KINDS = ['factual_error', 'incorrect_content', 'copyright', 'privacy', 'wrong_source', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Estados con los que un lector tiene acceso premium. past_due = periodo de gracia. */
export const PREMIUM_STATUSES: readonly SubscriptionStatus[] = ['trialing', 'active', 'past_due'];

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'impression',
  'click',
  'read_progress',
  'dwell',
  'save',
  'share',
  'follow',
  'search',
  'newsletter_signup',
  'subscribe_start',
  'subscribe_success',
  'experiment_exposure',
  'alert_open',
  'return_visit',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const CONSENT_CATEGORIES = ['necessary', 'preferences', 'analytics', 'personalization', 'marketing'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];
