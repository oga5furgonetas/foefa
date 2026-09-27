/** Punto de entrada del núcleo de Histor (para la web y el worker). */
export * from './domain';
export * from './env';
export { getDb, getSql, closeDb, type Db } from './db/client';
export * as schema from './db/schema';
export type { ArticleBlock, ArticleSourceRef, VerificationBox, I18nText } from './db/schema';
