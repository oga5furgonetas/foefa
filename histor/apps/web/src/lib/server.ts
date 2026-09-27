/**
 * Utilidades de servidor para la web: base de datos, sesión, geolocalización
 * y preferencias. Solo para Server Components y Route Handlers.
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getSessionUser, SESSION_COOKIE, type SessionUser } from '@histor/core/auth/users';
import { getDb } from '@histor/core/db/client';
import { detectGeo, type GeoContext } from '@histor/core/geo/detect';
import { premiumStatus } from '@histor/core/billing/index';

export const db = () => getDb();

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const c = await cookies();
  return getSessionUser(db(), c.get(SESSION_COOKIE)?.value);
});

export const currentPremium = cache(async (): Promise<boolean> => {
  const u = await currentUser();
  return u ? (await premiumStatus(db(), u.id)).premium : false;
});

export const currentGeo = cache(async (langFromPath?: string): Promise<GeoContext> => {
  const h = await headers();
  const c = await cookies();
  return detectGeo((n) => h.get(n), {
    lang: langFromPath ?? c.get('histor_lang')?.value,
    country: c.get('histor_edition')?.value ?? null,
    region: c.get('histor_region')?.value ?? null,
    city: c.get('histor_city')?.value ?? null,
  });
});

export type Consent = { analytics: boolean; personalization: boolean; preferences: boolean; marketing: boolean };

export async function currentConsent(): Promise<Consent> {
  const c = await cookies();
  return parseConsent(c.get('histor_consent')?.value);
}

export function parseConsent(v: string | undefined | null): Consent {
  const set = new Set((v ?? '').split(',').filter(Boolean));
  return { analytics: set.has('analytics'), personalization: set.has('personalization'), preferences: set.has('preferences'), marketing: set.has('marketing') };
}
