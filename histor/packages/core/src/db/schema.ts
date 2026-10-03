/**
 * Esquema de Histor (PostgreSQL). Una sola base; todo en el esquema public.
 *
 * Criterios:
 * - Lo público (URL) va por slug; lo interno por id numérico o uuid.
 * - Todo lo que el sistema decide sobre una historia deja rastro
 *   (verifications, article_versions, audit_log): nada se pisa en silencio.
 * - Los datos DEMO llevan is_demo=true en fuentes, ítems, historias y
 *   artículos, y ninguna consulta pública los devuelve salvo DEMO_MODE.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export type I18nText = Partial<Record<string, string>>;

/* ───────────────────────── Geografía e idiomas ───────────────────────── */

export const languages = pgTable('languages', {
  code: text('code').primaryKey(), // 'es', 'en', 'de'…
  name: text('name').notNull(),
  nativeName: text('native_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  rtl: boolean('rtl').notNull().default(false),
  ftsConfig: text('fts_config').notNull().default('simple'),
  sort: smallint('sort').notNull().default(100),
});

export const countries = pgTable('countries', {
  code: text('code').primaryKey(), // ISO 3166-1 alfa-2
  names: jsonb('names').$type<I18nText>().notNull(),
  slugs: jsonb('slugs').$type<I18nText>().notNull(),
  defaultLanguage: text('default_language').notNull(),
  currency: text('currency').notNull(),
  timezone: text('timezone').notNull(),
  continent: text('continent').notNull(),
  /** Tiene edición propia (portada nacional). */
  edition: boolean('edition').notNull().default(false),
  sort: smallint('sort').notNull().default(100),
});

export const regions = pgTable(
  'regions',
  {
    id: serial('id').primaryKey(),
    countryCode: text('country_code').notNull().references(() => countries.code),
    code: text('code').notNull(), // ISO 3166-2, p. ej. ES-GA
    names: jsonb('names').$type<I18nText>().notNull(),
    slugs: jsonb('slugs').$type<I18nText>().notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [uniqueIndex('regions_code_uq').on(t.code), index('regions_country_idx').on(t.countryCode)],
);

export const cities = pgTable(
  'cities',
  {
    id: serial('id').primaryKey(),
    countryCode: text('country_code').notNull().references(() => countries.code),
    regionId: integer('region_id').references(() => regions.id),
    names: jsonb('names').$type<I18nText>().notNull(),
    slugs: jsonb('slugs').$type<I18nText>().notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    population: integer('population'),
    timezone: text('timezone'),
  },
  (t) => [index('cities_country_idx').on(t.countryCode), index('cities_region_idx').on(t.regionId)],
);

/* ───────────────────────── Taxonomía ───────────────────────── */

export const categories = pgTable('categories', {
  id: text('id').primaryKey(), // 'politics', 'economy'…
  names: jsonb('names').$type<I18nText>().notNull(),
  slugs: jsonb('slugs').$type<I18nText>().notNull(),
  sort: smallint('sort').notNull().default(100),
  enabled: boolean('enabled').notNull().default(true),
  /** Opinión solo se muestra con contenido editorial identificado. */
  isOpinion: boolean('is_opinion').notNull().default(false),
  /** Palabras clave por idioma para el clasificador determinista. */
  keywords: jsonb('keywords').$type<Record<string, string[]>>().notNull().default({}),
});

export const entities = pgTable(
  'entities',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    type: text('type').notNull(), // person|organization|place|company|team|product|event|other
    name: text('name').notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    wikidataId: text('wikidata_id'),
    countryCode: text('country_code'),
    description: jsonb('description').$type<I18nText>().notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('entities_slug_uq').on(t.slug), index('entities_name_idx').on(t.name)],
);

export const topics = pgTable(
  'topics',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    names: jsonb('names').$type<I18nText>().notNull(),
    description: jsonb('description').$type<I18nText>().notNull().default({}),
    categoryId: text('category_id').references(() => categories.id),
    entityId: integer('entity_id').references(() => entities.id),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('topics_slug_uq').on(t.slug)],
);

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    names: jsonb('names').$type<I18nText>().notNull(),
  },
  (t) => [uniqueIndex('tags_slug_uq').on(t.slug)],
);

/**
 * Autores. Histor NO inventa periodistas: los autores automáticos son
 * mesas de redacción (kind='desk') y se presentan como tales. Un autor
 * humano (kind='human') solo existe si es una persona real y verificable.
 */
export const authors = pgTable(
  'authors',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    kind: text('kind').notNull().default('desk'), // desk | human
    names: jsonb('names').$type<I18nText>().notNull(),
    bio: jsonb('bio').$type<I18nText>().notNull().default({}),
    categoryId: text('category_id').references(() => categories.id),
    verifiedIdentity: boolean('verified_identity').notNull().default(false),
    sameAs: text('same_as').array().notNull().default(sql`'{}'::text[]`),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('authors_slug_uq').on(t.slug)],
);

/* ───────────────────────── Fuentes ───────────────────────── */

export const sources = pgTable(
  'sources',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    homepageUrl: text('homepage_url').notNull(),
    feedUrl: text('feed_url'),
    connector: text('connector').notNull(), // ConnectorKind
    sourceType: text('source_type').notNull(), // SourceType
    countryCode: text('country_code'),
    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    /** Grupo propietario: dos medios del mismo grupo no son independientes. */
    ownershipGroup: text('ownership_group'),
    isSatire: boolean('is_satire').notNull().default(false),
    isDemo: boolean('is_demo').notNull().default(false),
    status: text('status').notNull().default('active'), // active|paused|blocked|failing
    blockedReason: text('blocked_reason'),
    fetchIntervalMinutes: integer('fetch_interval_minutes').notNull().default(15),
    lastFetchedAt: ts('last_fetched_at'),
    lastSuccessAt: ts('last_success_at'),
    nextFetchAt: ts('next_fetch_at'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    etag: text('etag'),
    lastModified: text('last_modified'),
    robotsAllowed: boolean('robots_allowed'),
    tdmReserved: boolean('tdm_reserved').notNull().default(false),
    termsNotes: text('terms_notes'),
    licenseNotes: text('license_notes'),
    /** Parámetros del conector (endpoint, subreddit, consulta…). Sin secretos. */
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    categoryHint: text('category_hint'),
    verifiedAt: ts('verified_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sources_slug_uq').on(t.slug), index('sources_status_next_idx').on(t.status, t.nextFetchAt)],
);

/** Fiabilidad aprendida: posterior Beta(alpha, beta) de "acierta". */
export const sourceReliability = pgTable('source_reliability', {
  sourceId: integer('source_id')
    .primaryKey()
    .references(() => sources.id, { onDelete: 'cascade' }),
  alpha: real('alpha').notNull(),
  beta: real('beta').notNull(),
  confirmedCount: integer('confirmed_count').notNull().default(0),
  contradictedCount: integer('contradicted_count').notNull().default(0),
  correctedCount: integer('corrected_count').notNull().default(0),
  copyCount: integer('copy_count').notNull().default(0),
  originalCount: integer('original_count').notNull().default(0),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const fetchLog = pgTable(
  'fetch_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    ts: ts('ts').notNull().defaultNow(),
    url: text('url').notNull(),
    statusCode: integer('status_code'),
    durationMs: integer('duration_ms'),
    bytes: integer('bytes'),
    itemsSeen: integer('items_seen').notNull().default(0),
    itemsNew: integer('items_new').notNull().default(0),
    error: text('error'),
  },
  (t) => [index('fetch_log_source_ts_idx').on(t.sourceId, t.ts)],
);

/* ───────────────────────── Ingesta ───────────────────────── */

export const rawItems = pgTable(
  'raw_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    guid: text('guid'),
    url: text('url').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    /** Texto para análisis interno. Nunca se publica. Se poda a los 30 días. */
    contentText: text('content_text'),
    contentHash: text('content_hash').notNull(),
    minhash: integer('minhash').array(),
    language: text('language'),
    author: text('author'),
    publishedAt: ts('published_at'),
    fetchedAt: ts('fetched_at').notNull().defaultNow(),
    eventDate: ts('event_date'),
    countryCode: text('country_code'),
    regionId: integer('region_id'),
    cityId: integer('city_id'),
    categoryId: text('category_id'),
    entities: jsonb('entities').$type<{ name: string; type: string }[]>().notNull().default([]),
    imageUrl: text('image_url'),
    /** Origen citado ("según EFE", "(Reuters)"): define la independencia real. */
    attributedTo: text('attributed_to'),
    copyOfItemId: bigint('copy_of_item_id', { mode: 'number' }),
    isDemo: boolean('is_demo').notNull().default(false),
    status: text('status').notNull().default('new'), // new|normalized|clustered|discarded
    discardReason: text('discard_reason'),
    tdmReserved: boolean('tdm_reserved').notNull().default(false),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex('raw_items_source_url_uq').on(t.sourceId, t.canonicalUrl),
    index('raw_items_status_idx').on(t.status),
    index('raw_items_fetched_idx').on(t.fetchedAt),
    index('raw_items_hash_idx').on(t.contentHash),
  ],
);

/** Huellas perceptuales de imágenes vistas: detecta fotos viejas recicladas. */
export const imageFingerprints = pgTable(
  'image_fingerprints',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    phash: text('phash').notNull(), // dHash de 64 bits en hex
    url: text('url').notNull(),
    sourceId: integer('source_id'),
    itemId: bigint('item_id', { mode: 'number' }),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    exifDate: ts('exif_date'),
  },
  (t) => [index('image_fp_phash_idx').on(t.phash), uniqueIndex('image_fp_url_uq').on(t.url)],
);

/* ───────────────────────── Historias y verificación ───────────────────────── */

export const stories = pgTable(
  'stories',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    slug: text('slug').notNull(),
    state: text('state').notNull().default('DISCOVERED'), // StoryState
    headlineHint: text('headline_hint').notNull(),
    categoryId: text('category_id').references(() => categories.id),
    countryCode: text('country_code'),
    regionId: integer('region_id'),
    cityId: integer('city_id'),
    isBreaking: boolean('is_breaking').notNull().default(false),
    isDeveloping: boolean('is_developing').notNull().default(false),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastItemAt: ts('last_item_at').notNull().defaultNow(),
    eventTime: ts('event_time'),
    /** EVIDENCE CONFIDENCE (0-1). Nunca se mezcla con momentum. */
    evidenceConfidence: real('evidence_confidence').notNull().default(0),
    /** NEWS MOMENTUM (0-1). Nunca sube la confianza. */
    momentum: real('momentum').notNull().default(0),
    /** Importancia editorial (solo ordena dentro de lo ya publicable). */
    importance: real('importance').notNull().default(0),
    confidenceBreakdown: jsonb('confidence_breakdown').$type<Record<string, unknown>>().notNull().default({}),
    momentumBreakdown: jsonb('momentum_breakdown').$type<Record<string, unknown>>().notNull().default({}),
    flags: text('flags').array().notNull().default(sql`'{}'::text[]`),
    independentSourceCount: integer('independent_source_count').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),
    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    entityNames: text('entity_names').array().notNull().default(sql`'{}'::text[]`),
    /** Vector de términos (tf) para agrupar noticias nuevas. */
    centroid: jsonb('centroid').$type<Record<string, number>>().notNull().default({}),
    isDemo: boolean('is_demo').notNull().default(false),
    blockedReason: text('blocked_reason'),
    lockedByEditor: boolean('locked_by_editor').notNull().default(false),
    publishedAt: ts('published_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    retractedAt: ts('retracted_at'),
    nextCheckAt: ts('next_check_at'),
    parentStoryId: bigint('parent_story_id', { mode: 'number' }),
  },
  (t) => [
    uniqueIndex('stories_slug_uq').on(t.slug),
    index('stories_state_idx').on(t.state),
    index('stories_last_item_idx').on(t.lastItemAt),
    index('stories_next_check_idx').on(t.nextCheckAt),
  ],
);

export const storyItems = pgTable(
  'story_items',
  {
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => rawItems.id, { onDelete: 'cascade' }),
    similarity: real('similarity').notNull().default(1),
    /** Grupo de independencia: ítems del mismo grupo cuentan como UNA fuente. */
    independenceKey: text('independence_key').notNull(),
    isCopy: boolean('is_copy').notNull().default(false),
    joinedAt: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.itemId] }), index('story_items_item_idx').on(t.itemId)],
);

export const storyEntities = pgTable(
  'story_entities',
  {
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    entityId: integer('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    salience: real('salience').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.entityId] })],
);

/** Datos estructurados de un acontecimiento (p. ej. un terremoto del USGS). */
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' }).references(() => stories.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    occurredAt: ts('occurred_at'),
    place: text('place'),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    sourceItemId: bigint('source_item_id', { mode: 'number' }),
  },
  (t) => [index('events_story_idx').on(t.storyId)],
);

export const claims = pgTable(
  'claims',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => rawItems.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    text: text('text').notNull(),
    kind: text('kind').notNull(), // ClaimKind
    modality: text('modality').notNull(), // Modality
    attributedTo: text('attributed_to'),
    entities: text('entities').array().notNull().default(sql`'{}'::text[]`),
    numbers: jsonb('numbers').$type<{ value: number; unit: string | null; raw: string }[]>().notNull().default([]),
    dates: jsonb('dates').$type<{ iso: string; raw: string }[]>().notNull().default([]),
    places: text('places').array().notNull().default(sql`'{}'::text[]`),
    quote: jsonb('quote').$type<{ text: string; speaker: string | null } | null>(),
    status: text('status').notNull().default('unsupported'), // ClaimStatus
    supportScore: real('support_score').notNull().default(0),
    independentSupport: integer('independent_support').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('claims_story_idx').on(t.storyId)],
);

export const evidence = pgTable(
  'evidence',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    claimId: bigint('claim_id', { mode: 'number' })
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => rawItems.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id').notNull(),
    relation: text('relation').notNull(), // supports|contradicts|mentions
    matchScore: real('match_score').notNull(),
    excerpt: text('excerpt'),
    matched: jsonb('matched').$type<Record<string, unknown>>().notNull().default({}),
    independenceKey: text('independence_key').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('evidence_claim_idx').on(t.claimId)],
);

export const contradictions = pgTable(
  'contradictions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    field: text('field').notNull(), // number|date|place|person|quote|denial
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull(),
    severity: text('severity').notNull().default('major'), // minor|major|critical
    resolved: boolean('resolved').notNull().default(false),
    resolution: text('resolution'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('contradictions_story_idx').on(t.storyId)],
);

/** Cada pasada del motor de verificación deja su acta (auditable). */
export const verifications = pgTable(
  'verifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    runAt: ts('run_at').notNull().defaultNow(),
    stateBefore: text('state_before').notNull(),
    stateAfter: text('state_after').notNull(),
    evidenceConfidence: real('evidence_confidence').notNull(),
    momentum: real('momentum').notNull(),
    decision: text('decision').notNull(), // publish|publish_developing|hold|reject|update|retract|none
    reasons: text('reasons').array().notNull().default(sql`'{}'::text[]`),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>().notNull().default({}),
    thresholds: jsonb('thresholds').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('verifications_story_idx').on(t.storyId, t.runAt)],
);

/* ───────────────────────── Artículos ───────────────────────── */

export type ArticleBlock =
  | { type: 'p'; text: string; claimIds: number[] }
  | { type: 'h2'; text: string }
  | { type: 'quote'; text: string; speaker: string; claimIds: number[]; sourceUrl: string }
  | { type: 'list'; items: { text: string; claimIds: number[] }[] };

export type ArticleSourceRef = {
  sourceId: number;
  name: string;
  url: string;
  sourceType: string;
  publishedAt: string | null;
  isPrimary: boolean;
};

export type VerificationBox = {
  confirmed: { text: string; by: string[] }[];
  attributed: { text: string; by: string[] }[];
  unconfirmed: { text: string; by: string[] }[];
  /** Cifras ya superadas por datos más recientes (se muestran como historia, no como hecho actual). */
  superseded?: { text: string; by: string[] }[];
  contradictions: { text: string }[];
  method: string;
};

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull().default('image'),
  url: text('url').notNull(),
  width: integer('width'),
  height: integer('height'),
  /** CC-BY-4.0, CC-BY-SA-4.0, CC0, public-domain, agency-licensed, own, official-permitted, graphic */
  license: text('license').notNull(),
  licenseUrl: text('license_url'),
  attribution: text('attribution').notNull(),
  author: text('author'),
  sourceUrl: text('source_url'),
  provider: text('provider').notNull(), // wikimedia|upload|official|agency|graphic
  isAiGenerated: boolean('is_ai_generated').notNull().default(false),
  /** Imagen de archivo o ilustrativa: no muestra el acontecimiento. Se rotula. */
  isIllustrative: boolean('is_illustrative').notNull().default(false),
  caption: jsonb('caption').$type<I18nText>().notNull().default({}),
  alt: jsonb('alt').$type<I18nText>().notNull().default({}),
  phash: text('phash'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/**
 * Vídeos de canales de noticias (YouTube, por su RSS público) emparejados con una historia. Se
 * insertan con el reproductor oficial de YouTube, con el nombre del canal (03-10-2026).
 */
export const videos = pgTable(
  'videos',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull().default('youtube'),
    externalId: text('external_id').notNull(),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name').notNull(),
    language: text('language').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    publishedAt: ts('published_at').notNull(),
    storyId: bigint('story_id', { mode: 'number' }).references(() => stories.id, { onDelete: 'set null' }),
    matchScore: real('match_score'),
    matchedAt: ts('matched_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('videos_provider_external_idx').on(t.provider, t.externalId), index('videos_story_idx').on(t.storyId), index('videos_published_idx').on(t.publishedAt)],
);

export const articles = pgTable(
  'articles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    slug: text('slug').notNull(),
    headline: text('headline').notNull(),
    subheadline: text('subheadline'),
    summary: text('summary').notNull(),
    body: jsonb('body').$type<ArticleBlock[]>().notNull(),
    bodyText: text('body_text').notNull(),
    verification: jsonb('verification').$type<VerificationBox>().notNull(),
    sourcesList: jsonb('sources_list').$type<ArticleSourceRef[]>().notNull(),
    timeline: jsonb('timeline').$type<{ at: string; text: string }[]>().notNull().default([]),
    status: text('status').notNull().default('draft'), // draft|published|retracted|held
    isDeveloping: boolean('is_developing').notNull().default(false),
    isBreaking: boolean('is_breaking').notNull().default(false),
    isPremium: boolean('is_premium').notNull().default(false),
    isDemo: boolean('is_demo').notNull().default(false),
    authorId: integer('author_id').references(() => authors.id),
    categoryId: text('category_id').references(() => categories.id),
    countryCode: text('country_code'),
    regionId: integer('region_id'),
    cityId: integer('city_id'),
    imageId: integer('image_id').references(() => media.id),
    seoTitle: text('seo_title').notNull(),
    seoDescription: text('seo_description').notNull(),
    writer: text('writer').notNull(), // template | llm:<proveedor>/<modelo>
    version: integer('version').notNull().default(1),
    wordCount: integer('word_count').notNull().default(0),
    readingMinutes: smallint('reading_minutes').notNull().default(1),
    evidenceConfidence: real('evidence_confidence').notNull().default(0),
    importance: real('importance').notNull().default(0),
    publishedAt: ts('published_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    retractedAt: ts('retracted_at'),
    retractionNote: text('retraction_note'),
    searchVector: tsvector('search_vector'),
  },
  (t) => [
    uniqueIndex('articles_lang_slug_uq').on(t.language, t.slug),
    uniqueIndex('articles_story_lang_uq').on(t.storyId, t.language),
    index('articles_status_pub_idx').on(t.status, t.publishedAt),
    index('articles_cat_idx').on(t.categoryId, t.publishedAt),
    index('articles_country_idx').on(t.countryCode, t.publishedAt),
    index('articles_search_idx').using('gin', t.searchVector),
  ],
);

export const articleVersions = pgTable(
  'article_versions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    kind: text('kind').notNull(), // publish|update|correction|retraction|edit
    headline: text('headline').notNull(),
    body: jsonb('body').$type<ArticleBlock[]>().notNull(),
    verification: jsonb('verification').$type<VerificationBox>().notNull(),
    changeSummary: text('change_summary').notNull(),
    changedBy: text('changed_by').notNull(), // system | user:<uuid>
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('article_versions_uq').on(t.articleId, t.version)],
);

export const corrections = pgTable(
  'corrections',
  {
    id: serial('id').primaryKey(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // correction|clarification|update|retraction
    note: text('note').notNull(),
    version: integer('version').notNull(),
    createdBy: text('created_by').notNull(),
    reportId: integer('report_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('corrections_article_idx').on(t.articleId)],
);

export const articleTags = pgTable(
  'article_tags',
  {
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] })],
);

export const articleEntities = pgTable(
  'article_entities',
  {
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    entityId: integer('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.entityId] }), index('article_entities_entity_idx').on(t.entityId)],
);

export const articleTopics = pgTable(
  'article_topics',
  {
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.topicId] }), index('article_topics_topic_idx').on(t.topicId)],
);

/** Resultado de los controles de calidad previos a publicar (sección 47). */
export const qualityReports = pgTable(
  'quality_reports',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    storyId: bigint('story_id', { mode: 'number' })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    passed: boolean('passed').notNull(),
    checks: jsonb('checks').$type<{ name: string; passed: boolean; critical: boolean; messages: string[] }[]>().notNull(),
    writer: text('writer').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('quality_reports_story_idx').on(t.storyId)],
);

/* ───────────────────────── Usuarios y cuentas ───────────────────────── */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailVerifiedAt: ts('email_verified_at'),
    passwordHash: text('password_hash'),
    name: text('name'),
    role: text('role').notNull().default('reader'),
    language: text('language'),
    countryCode: text('country_code'),
    regionId: integer('region_id'),
    cityId: integer('city_id'),
    timezone: text('timezone'),
    totpSecret: text('totp_secret'), // cifrado con DATA_ENCRYPTION_KEY
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    personalization: boolean('personalization').notNull().default(true),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    alertsMaxPerDay: smallint('alerts_max_per_day').notNull().default(3),
    quietHoursStart: smallint('quiet_hours_start').notNull().default(22),
    quietHoursEnd: smallint('quiet_hours_end').notNull().default(7),
    stripeCustomerId: text('stripe_customer_id'),
    failedLogins: smallint('failed_logins').notNull().default(0),
    lockedUntil: ts('locked_until'),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastLoginAt: ts('last_login_at'),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('users_email_uq').on(sql`lower(${t.email})`)],
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(), // sha256 del token; el token solo vive en la cookie
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    mfaPassed: boolean('mfa_passed').notNull().default(false),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const authTokens = pgTable('auth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // verify_email|reset_password|oauth_state
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const userFollows = pgTable(
  'user_follows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // topic|entity|category|country|region|city|author|source
    ref: text('ref').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.ref] })],
);

export const savedArticles = pgTable(
  'saved_articles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] })],
);

export const readingHistory = pgTable(
  'reading_history',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    firstReadAt: ts('first_read_at').notNull().defaultNow(),
    lastReadAt: ts('last_read_at').notNull().defaultNow(),
    maxScroll: real('max_scroll').notNull().default(0),
    dwellSeconds: integer('dwell_seconds').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] }), index('reading_history_user_idx').on(t.userId, t.lastReadAt)],
);

/** Perfil de intereses (para usuario registrado o visitante con consentimiento). */
export const interestProfiles = pgTable('interest_profiles', {
  key: text('key').primaryKey(), // u:<uuid> | a:<hash anónimo>
  affinities: jsonb('affinities').$type<Record<string, number>>().notNull().default({}),
  events: integer('events').notNull().default(0),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** Listas servidas por el recomendador (para evaluarlo: ¿se leyó lo recomendado?). */
export const recommendations = pgTable(
  'recommendations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    profileKey: text('profile_key').notNull(),
    context: text('context').notNull(), // home|article|newsletter
    articleIds: bigint('article_ids', { mode: 'number' }).array().notNull(),
    scores: jsonb('scores').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('recommendations_profile_idx').on(t.profileKey, t.createdAt)],
);

/* ───────────────────────── Suscripciones y pagos ───────────────────────── */

export const pricePlans = pgTable(
  'price_plans',
  {
    id: serial('id').primaryKey(),
    market: text('market').notNull(), // ES, EUROZONE, US, GB, MX, BR…
    countryCodes: text('country_codes').array().notNull(),
    currency: text('currency').notNull(),
    monthlyCents: integer('monthly_cents').notNull(),
    yearlyCents: integer('yearly_cents').notNull(),
    trialDays: smallint('trial_days').notNull().default(0),
    stripePriceMonthly: text('stripe_price_monthly'),
    stripePriceYearly: text('stripe_price_yearly'),
    active: boolean('active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  (t) => [uniqueIndex('price_plans_market_uq').on(t.market)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // stripe|manual
    providerSubscriptionId: text('provider_subscription_id'),
    providerCustomerId: text('provider_customer_id'),
    planId: integer('plan_id').references(() => pricePlans.id),
    status: text('status').notNull(), // SubscriptionStatus
    interval: text('interval').notNull(), // month|year
    currency: text('currency').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currentPeriodEnd: ts('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    trialEnd: ts('trial_end'),
    canceledAt: ts('canceled_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subscriptions_provider_uq').on(t.providerSubscriptionId), index('subscriptions_user_idx').on(t.userId)],
);

export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    providerInvoiceId: text('provider_invoice_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    taxCents: integer('tax_cents').notNull().default(0),
    currency: text('currency').notNull(),
    status: text('status').notNull(), // paid|open|uncollectible|void|failed
    hostedInvoiceUrl: text('hosted_invoice_url'),
    attemptCount: smallint('attempt_count').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invoices_provider_uq').on(t.providerInvoiceId)],
);

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(), // id del evento del proveedor → idempotencia
  provider: text('provider').notNull(),
  type: text('type').notNull(),
  receivedAt: ts('received_at').notNull().defaultNow(),
  processedAt: ts('processed_at'),
  error: text('error'),
});

/* ───────────────────────── Newsletters y alertas ───────────────────────── */

export const newsletters = pgTable(
  'newsletters',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    kind: text('kind').notNull(), // edition|city|category|personal
    language: text('language').notNull(),
    countryCode: text('country_code'),
    cityId: integer('city_id'),
    categoryId: text('category_id'),
    names: jsonb('names').$type<I18nText>().notNull(),
    descriptions: jsonb('descriptions').$type<I18nText>().notNull().default({}),
    sendHourLocal: smallint('send_hour_local').notNull().default(7),
    timezone: text('timezone').notNull(),
    maxItems: smallint('max_items').notNull().default(5),
    isPremium: boolean('is_premium').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [uniqueIndex('newsletters_slug_uq').on(t.slug)],
);

export const newsletterSubscriptions = pgTable(
  'newsletter_subscriptions',
  {
    id: serial('id').primaryKey(),
    newsletterId: integer('newsletter_id')
      .notNull()
      .references(() => newsletters.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending|confirmed|unsubscribed
    confirmTokenHash: text('confirm_token_hash'),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    confirmedAt: ts('confirmed_at'),
  },
  (t) => [uniqueIndex('newsletter_subs_uq').on(t.newsletterId, sql`lower(${t.email})`)],
);

export const newsletterIssues = pgTable(
  'newsletter_issues',
  {
    id: serial('id').primaryKey(),
    newsletterId: integer('newsletter_id')
      .notNull()
      .references(() => newsletters.id, { onDelete: 'cascade' }),
    issueDate: text('issue_date').notNull(), // YYYY-MM-DD local
    subject: text('subject').notNull(),
    articleIds: bigint('article_ids', { mode: 'number' }).array().notNull(),
    html: text('html').notNull(),
    textBody: text('text_body').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    recipients: integer('recipients').notNull().default(0),
  },
  (t) => [uniqueIndex('newsletter_issue_uq').on(t.newsletterId, t.issueDate)],
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  language: text('language').notNull(),
  countryCode: text('country_code'),
  categories: text('categories').array().notNull().default(sql`'{}'::text[]`),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id'),
    pushSubscriptionId: integer('push_subscription_id'),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    channel: text('channel').notNull(), // push|email
    priority: real('priority').notNull(),
    status: text('status').notNull(), // sent|skipped|failed|dry_run
    reason: text('reason').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt), index('notifications_push_idx').on(t.pushSubscriptionId, t.createdAt)],
);

/* ───────────────────────── Analítica y experimentos ───────────────────────── */

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: ts('ts').notNull().defaultNow(),
    type: text('type').notNull(),
    anonId: text('anon_id'), // hash con sal rotatoria; nunca la IP
    userId: uuid('user_id'),
    articleId: bigint('article_id', { mode: 'number' }),
    storyId: bigint('story_id', { mode: 'number' }),
    path: text('path'),
    language: text('language'),
    countryCode: text('country_code'),
    device: text('device'),
    referrerHost: text('referrer_host'),
    value: real('value'),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('analytics_ts_idx').on(t.ts),
    index('analytics_type_ts_idx').on(t.type, t.ts),
    index('analytics_article_idx').on(t.articleId, t.type),
  ],
);

export const experiments = pgTable(
  'experiments',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    kind: text('kind').notNull(), // headline|image|position|newsletter|cta|pricing|onboarding
    status: text('status').notNull().default('draft'), // draft|running|stopped|completed
    articleId: bigint('article_id', { mode: 'number' }),
    variants: jsonb('variants').$type<{ key: string; weight: number; payload: Record<string, unknown> }[]>().notNull(),
    metric: text('metric').notNull().default('read_through_rate'),
    winner: text('winner'),
    createdAt: ts('created_at').notNull().defaultNow(),
    endedAt: ts('ended_at'),
  },
  (t) => [uniqueIndex('experiments_key_uq').on(t.key)],
);

/* ───────────────────────── Distribución ───────────────────────── */

export const socialPosts = pgTable(
  'social_posts',
  {
    id: serial('id').primaryKey(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    network: text('network').notNull(), // bluesky|mastodon|x|facebook|linkedin
    status: text('status').notNull(), // queued|posted|skipped|failed|dry_run
    text: text('text').notNull(),
    url: text('url').notNull(),
    externalId: text('external_id'),
    error: text('error'),
    createdAt: ts('created_at').notNull().defaultNow(),
    postedAt: ts('posted_at'),
  },
  (t) => [uniqueIndex('social_posts_uq').on(t.articleId, t.network)],
);

/* ───────────────────────── Denuncias y revisión ───────────────────────── */

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(), // ReportKind
    articleId: bigint('article_id', { mode: 'number' }),
    url: text('url'),
    description: text('description').notNull(),
    reporterName: text('reporter_name'),
    reporterEmail: text('reporter_email'),
    status: text('status').notNull().default('open'), // open|in_review|resolved|rejected
    ipHash: text('ip_hash'),
    createdAt: ts('created_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
    resolution: text('resolution'),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

export const reviewTasks = pgTable(
  'review_tasks',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(), // report|contradiction_after_publish|confidence_drop|source_failing|viral_unverified|qc_failure|correction_request
    priority: smallint('priority').notNull().default(50),
    status: text('status').notNull().default('open'), // open|in_progress|done|dismissed
    title: text('title').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    storyId: bigint('story_id', { mode: 'number' }),
    articleId: bigint('article_id', { mode: 'number' }),
    reportId: integer('report_id'),
    sourceId: integer('source_id'),
    dedupeKey: text('dedupe_key'),
    assignedTo: uuid('assigned_to'),
    createdAt: ts('created_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
    resolution: text('resolution'),
  },
  (t) => [
    index('review_tasks_status_idx').on(t.status, t.priority),
    uniqueIndex('review_tasks_dedupe_uq').on(t.dedupeKey).where(sql`status in ('open','in_progress')`),
  ],
);

/* ───────────────────────── Operación ───────────────────────── */

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: ts('ts').notNull().defaultNow(),
    actor: text('actor').notNull(), // system | user:<uuid>
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text('ip_hash'),
  },
  (t) => [index('audit_ts_idx').on(t.ts), index('audit_target_idx').on(t.targetType, t.targetId)],
);

/** Cola de trabajos sobre Postgres (FOR UPDATE SKIP LOCKED). */
export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    queue: text('queue').notNull().default('default'),
    name: text('name').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    runAt: ts('run_at').notNull().defaultNow(),
    attempts: smallint('attempts').notNull().default(0),
    maxAttempts: smallint('max_attempts').notNull().default(5),
    status: text('status').notNull().default('queued'), // queued|running|done|failed
    lockedAt: ts('locked_at'),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    uniqueKey: text('unique_key'),
    createdAt: ts('created_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    index('jobs_ready_idx').on(t.queue, t.status, t.runAt),
    uniqueIndex('jobs_unique_active_uq').on(t.uniqueKey).where(sql`status in ('queued','running')`),
  ],
);

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    stage: text('stage').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
    ok: boolean('ok'),
    counts: jsonb('counts').$type<Record<string, number>>().notNull().default({}),
    error: text('error'),
  },
  (t) => [index('pipeline_runs_stage_idx').on(t.stage, t.startedAt)],
);

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: ts('ts').notNull().defaultNow(),
    task: text('task').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: real('cost_usd').notNull().default(0),
    storyId: bigint('story_id', { mode: 'number' }),
    ok: boolean('ok').notNull().default(true),
    error: text('error'),
  },
  (t) => [index('ai_usage_ts_idx').on(t.ts)],
);

export const outbox = pgTable(
  'mail_outbox',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    to: text('to_address').notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    textBody: text('text_body').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('queued'), // queued|sent|failed|logged
    provider: text('provider'),
    error: text('error'),
    createdAt: ts('created_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
  },
  (t) => [index('mail_outbox_status_idx').on(t.status, t.createdAt)],
);
