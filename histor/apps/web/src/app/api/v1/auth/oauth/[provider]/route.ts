import { NextResponse } from 'next/server';
import { authorizeUrl, oidcEnabled, type OidcProvider } from '@histor/core/auth/oidc';
import { isActiveLanguage } from '@histor/core/config/languages';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, handler, ipKey, limit } from '@/lib/api';
import { db } from '@/lib/server';

type Ctx = { params: Promise<{ provider: string }> };

/** Inicio del flujo OIDC (Google / Apple) con state, nonce y PKCE. */
export const GET = handler<Ctx>(async (req, ctx) => {
  const { provider } = await ctx.params;
  if (provider !== 'google' && provider !== 'apple') throw new ApiError(404, 'not_found');
  if (!oidcEnabled(provider)) throw new ApiError(404, 'provider_disabled');
  await limit(LIMITS.login(ipKey(req)));
  const l = req.nextUrl.searchParams.get('lang') ?? 'en';
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const url = await authorizeUrl(db(), provider as OidcProvider, { lang: isActiveLanguage(l) ? l : 'en', returnTo: next.startsWith('/') && !next.startsWith('//') ? next : '/' });
  return NextResponse.redirect(url, 302);
});
