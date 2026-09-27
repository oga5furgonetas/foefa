/**
 * Datos de referencia (idempotente: se puede ejecutar en cada despliegue).
 * NO crea noticias: eso lo hace la ingesta real, o `demo:seed` en modo DEMO.
 */
import { sql } from 'drizzle-orm';
import { CATEGORIES } from '../config/categories';
import { CITIES } from '../config/cities';
import { COUNTRIES } from '../config/countries';
import { DESKS, NEWSLETTER_SEEDS } from '../config/editorial';
import { LANGUAGES } from '../config/languages';
import { PLAN_SEEDS } from '../config/pricing';
import { REGIONS } from '../config/regions';
import { SOURCE_SEEDS, type SourceSeed } from '../config/sources';
import type { Db } from './client';
import * as s from './schema';

export async function seedReference(db: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const [i, l] of LANGUAGES.entries()) {
    await db
      .insert(s.languages)
      .values({ code: l.code, name: l.name, nativeName: l.nativeName, enabled: l.enabled, rtl: l.rtl, ftsConfig: l.ftsConfig, sort: i })
      .onConflictDoUpdate({ target: s.languages.code, set: { name: l.name, nativeName: l.nativeName, ftsConfig: l.ftsConfig, rtl: l.rtl } });
  }
  counts.languages = LANGUAGES.length;

  for (const [i, c] of COUNTRIES.entries()) {
    await db
      .insert(s.countries)
      .values({ code: c.code, names: c.names, slugs: c.slugs, defaultLanguage: c.defaultLanguage, currency: c.currency, timezone: c.timezone, continent: c.continent, edition: c.edition, sort: i })
      .onConflictDoUpdate({ target: s.countries.code, set: { names: c.names, slugs: c.slugs, defaultLanguage: c.defaultLanguage, currency: c.currency, timezone: c.timezone, continent: c.continent } });
  }
  counts.countries = COUNTRIES.length;

  const regionIds = new Map<string, number>();
  for (const r of REGIONS) {
    const rows = await db
      .insert(s.regions)
      .values({ countryCode: r.countryCode, code: r.code, names: r.names, slugs: r.slugs, aliases: r.aliases })
      .onConflictDoUpdate({ target: s.regions.code, set: { names: r.names, slugs: r.slugs, aliases: r.aliases } })
      .returning({ id: s.regions.id });
    regionIds.set(r.code, rows[0].id);
  }
  counts.regions = REGIONS.length;

  // Ciudades: clave estable = (país, slug local en inglés).
  const existing = await db.select({ id: s.cities.id, countryCode: s.cities.countryCode, slugs: s.cities.slugs }).from(s.cities);
  const byKey = new Map(existing.map((c) => [`${c.countryCode}|${(c.slugs as Record<string, string>).en}`, c.id]));
  for (const c of CITIES) {
    const key = `${c.countryCode}|${c.slugs.en}`;
    const values = {
      countryCode: c.countryCode,
      regionId: c.regionCode ? (regionIds.get(c.regionCode) ?? null) : null,
      names: c.names,
      slugs: c.slugs,
      aliases: c.aliases,
      lat: c.lat,
      lon: c.lon,
      population: c.population,
    };
    const id = byKey.get(key);
    if (id) await db.update(s.cities).set(values).where(sql`${s.cities.id} = ${id}`);
    else await db.insert(s.cities).values(values);
  }
  counts.cities = CITIES.length;

  for (const c of CATEGORIES) {
    await db
      .insert(s.categories)
      .values({ id: c.id, names: c.names, slugs: c.slugs, sort: c.sort, isOpinion: !!c.isOpinion, keywords: c.keywords })
      .onConflictDoUpdate({ target: s.categories.id, set: { names: c.names, slugs: c.slugs, sort: c.sort, keywords: c.keywords } });
  }
  counts.categories = CATEGORIES.length;

  for (const d of DESKS) {
    await db
      .insert(s.authors)
      .values({ slug: d.slug, kind: 'desk', names: d.names, bio: d.bio, categoryId: d.categoryId })
      .onConflictDoUpdate({ target: s.authors.slug, set: { names: d.names, bio: d.bio, categoryId: d.categoryId } });
  }
  counts.authors = DESKS.length;

  for (const src of SOURCE_SEEDS) await upsertSource(db, src, false);
  counts.sources = SOURCE_SEEDS.length;

  for (const p of PLAN_SEEDS) {
    await db
      .insert(s.pricePlans)
      .values({ market: p.market, countryCodes: p.countryCodes, currency: p.currency, monthlyCents: p.monthlyCents, yearlyCents: p.yearlyCents, trialDays: p.trialDays, isDefault: !!p.isDefault, updatedBy: 'seed' })
      .onConflictDoNothing({ target: s.pricePlans.market }); // los precios editados en el panel no se pisan
  }
  counts.pricePlans = PLAN_SEEDS.length;

  const cityIdByKey = new Map<string, number>();
  const allCities = await db.select({ id: s.cities.id, countryCode: s.cities.countryCode, slugs: s.cities.slugs }).from(s.cities);
  for (const c of CITIES) {
    const row = allCities.find((x) => x.countryCode === c.countryCode && (x.slugs as Record<string, string>).en === c.slugs.en);
    if (row) cityIdByKey.set(c.key, row.id);
  }
  for (const n of NEWSLETTER_SEEDS) {
    await db
      .insert(s.newsletters)
      .values({
        slug: n.slug,
        kind: n.kind,
        language: n.language,
        countryCode: n.countryCode ?? null,
        cityId: n.cityKey ? (cityIdByKey.get(n.cityKey) ?? null) : null,
        categoryId: n.categoryId ?? null,
        names: n.names,
        timezone: n.timezone,
        sendHourLocal: n.sendHourLocal,
        isPremium: !!n.isPremium,
      })
      .onConflictDoUpdate({ target: s.newsletters.slug, set: { names: n.names, timezone: n.timezone, sendHourLocal: n.sendHourLocal } });
  }
  counts.newsletters = NEWSLETTER_SEEDS.length;
  return counts;
}

export async function upsertSource(db: Db, src: SourceSeed, isDemo: boolean): Promise<number> {
  const rows = await db
    .insert(s.sources)
    .values({
      slug: src.slug,
      name: src.name,
      homepageUrl: src.homepageUrl,
      feedUrl: src.feedUrl,
      connector: src.connector,
      sourceType: src.sourceType,
      countryCode: src.countryCode,
      languages: src.languages,
      ownershipGroup: src.ownershipGroup ?? null,
      isSatire: !!src.isSatire,
      isDemo,
      status: src.status ?? 'active',
      fetchIntervalMinutes: src.fetchIntervalMinutes ?? 15,
      config: src.config ?? {},
      categoryHint: src.categoryHint ?? null,
      licenseNotes: src.licenseNotes ?? null,
      termsNotes: src.termsNotes ?? null,
    })
    .onConflictDoUpdate({
      target: s.sources.slug,
      // No se tocan estado ni bloqueo: los decide el panel.
      set: {
        name: src.name,
        homepageUrl: src.homepageUrl,
        feedUrl: src.feedUrl,
        connector: src.connector,
        sourceType: src.sourceType,
        languages: src.languages,
        ownershipGroup: src.ownershipGroup ?? null,
        config: src.config ?? {},
        categoryHint: src.categoryHint ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: s.sources.id });
  const id = rows[0].id;
  const [alpha, beta] = src.prior ?? [6, 3];
  await db.insert(s.sourceReliability).values({ sourceId: id, alpha, beta }).onConflictDoNothing();
  return id;
}
