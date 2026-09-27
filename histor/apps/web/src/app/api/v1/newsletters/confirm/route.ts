import { NextResponse } from 'next/server';
import { confirmNewsletter } from '@histor/core/newsletter/index';
import { href } from '@histor/core/i18n/routes';
import { handler } from '@/lib/api';
import { db } from '@/lib/server';

export const GET = handler(async (req) => {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const ok = token.length > 20 && (await confirmNewsletter(db(), token));
  const lang = req.cookies.get('histor_lang')?.value ?? 'en';
  const url = new URL(href.page(['es', 'en', 'de', 'fr', 'it', 'pt'].includes(lang) ? lang : 'en', 'newsletters'), req.nextUrl.origin);
  url.searchParams.set(ok ? 'confirmed' : 'error', '1');
  return NextResponse.redirect(url, 303);
});
