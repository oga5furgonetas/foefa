import { NextResponse, type NextRequest } from 'next/server';
import { handleCallback, oidcEnabled, type OidcProvider } from '@histor/core/auth/oidc';
import { SESSION_COOKIE, SESSION_DAYS } from '@histor/core/auth/users';
import { href } from '@histor/core/i18n/routes';
import { logger } from '@histor/core/observability/index';
import { ipKey } from '@/lib/api';
import { db } from '@/lib/server';

type Ctx = { params: Promise<{ provider: string }> };

async function finish(req: NextRequest, provider: string, code: string | null, state: string | null, userJson: string | null) {
  if ((provider !== 'google' && provider !== 'apple') || !oidcEnabled(provider) || !code || !state) {
    return NextResponse.redirect(new URL(`${href.page('en', 'login')}?error=oauth`, req.nextUrl.origin), 303);
  }
  try {
    const r = await handleCallback(db(), provider as OidcProvider, { code, state, userJson, userAgent: req.headers.get('user-agent'), ipHash: ipKey(req) });
    const res = NextResponse.redirect(new URL(r.returnTo, req.nextUrl.origin), 303);
    res.cookies.set(SESSION_COOKIE, r.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_DAYS * 86400 });
    return res;
  } catch (e) {
    logger.warn({ provider, err: (e as Error).message }, 'oauth callback rechazado');
    return NextResponse.redirect(new URL(`${href.page('en', 'login')}?error=oauth`, req.nextUrl.origin), 303);
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { provider } = await ctx.params;
  const p = req.nextUrl.searchParams;
  return finish(req, provider, p.get('code'), p.get('state'), null);
}

/** Apple devuelve la respuesta por POST (response_mode=form_post). El state protege frente a CSRF. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { provider } = await ctx.params;
  const f = await req.formData();
  return finish(req, provider, String(f.get('code') ?? '') || null, String(f.get('state') ?? '') || null, f.get('user') ? String(f.get('user')) : null);
}
