import { eq } from 'drizzle-orm';
import { DEFAULT_EDITORIAL_SETTINGS, DEFAULT_SOURCE_TYPE_WEIGHTS, editorialSettingsSchema, sourceTypeWeightsSchema, type EditorialSettings } from '../config/settings';
import type { Db } from '../db/client';
import { settings } from '../db/schema';
import { audit } from './audit';

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0] ? (rows[0].value as T) : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown, actor: string): Promise<void> {
  const before = await getSetting<unknown>(db, key, null);
  await db
    .insert(settings)
    .values({ key, value, updatedBy: actor, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: actor, updatedAt: new Date() } });
  await audit(db, { actor, action: 'settings.update', targetType: 'settings', targetId: key, detail: { before, after: value } });
}

export async function getEditorialSettings(db: Db): Promise<EditorialSettings> {
  const raw = await getSetting<Partial<EditorialSettings>>(db, 'editorial', {});
  const parsed = editorialSettingsSchema.safeParse({ ...DEFAULT_EDITORIAL_SETTINGS, ...raw });
  return parsed.success ? parsed.data : DEFAULT_EDITORIAL_SETTINGS;
}

export async function getSourceTypeWeights(db: Db) {
  const raw = await getSetting<Record<string, { weight: number; credible: boolean }>>(db, 'source_type_weights', {});
  const parsed = sourceTypeWeightsSchema.safeParse({ ...DEFAULT_SOURCE_TYPE_WEIGHTS, ...raw });
  return parsed.success ? parsed.data : DEFAULT_SOURCE_TYPE_WEIGHTS;
}
