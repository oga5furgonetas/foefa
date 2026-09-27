import { NextResponse } from 'next/server';
import { verifyEmail } from '@histor/core/auth/users';
import { isActiveLanguage } from '@histor/core/config/languages';
import { href } from '@histor/core/i18n/routes';
import { handler } from '@/lib/api';
import { db } from '@/lib/server';

export const GET = handler(async (req) => {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const l = req.nextUrl.searchParams.get('lang') ?? 'en';
  const lang = isActiveLanguage(l) ? l : 'en';
  const ok = token.length > 20 && (await verifyEmail(db(), token));
  const url = new URL(href.page(lang, 'login'), req.nextUrl.origin);
  url.searchParams.set(ok ? 'verified' : 'error', ok ? '1' : 'token');
  return NextResponse.redirect(url, 303);
});
