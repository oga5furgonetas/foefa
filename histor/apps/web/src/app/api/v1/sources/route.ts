import { LIMITS } from '@histor/core/security/ratelimit';
import { listPublicSources } from '@histor/core/services/content';
import { handler, ipKey, json, limit } from '@/lib/api';
import { db } from '@/lib/server';

/** Directorio público de fuentes con su tipo y su historial de fiabilidad. */
export const GET = handler(async (req) => {
  await limit(LIMITS.api(ipKey(req)));
  const rows = await listPublicSources(db());
  return json({
    sources: rows.map(({ s, r }) => ({
      slug: s.slug,
      name: s.name,
      type: s.sourceType,
      country: s.countryCode,
      languages: s.languages,
      homepage: s.homepageUrl,
      satire: s.isSatire,
      reliability: r ? Math.round((r.alpha / (r.alpha + r.beta)) * 1000) / 1000 : null,
      confirmed: r?.confirmedCount ?? 0,
      contradicted: r?.contradictedCount ?? 0,
    })),
  });
});
