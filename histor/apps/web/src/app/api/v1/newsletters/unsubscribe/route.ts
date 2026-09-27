import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeNewsletter } from '@histor/core/newsletter/index';
import { href } from '@histor/core/i18n/routes';
import { db } from '@/lib/server';

async function run(req: NextRequest, token: string) {
  const ok = token.length > 20 && (await unsubscribeNewsletter(db(), token));
  return ok;
}

/** Baja con un clic desde el correo (enlace GET) y RFC 8058 (POST List-Unsubscribe-Post). */
export async function GET(req: NextRequest) {
  const ok = await run(req, req.nextUrl.searchParams.get('token') ?? '');
  const lang = req.cookies.get('histor_lang')?.value ?? 'en';
  const url = new URL(href.page(['es', 'en', 'de', 'fr', 'it', 'pt'].includes(lang) ? lang : 'en', 'newsletters'), req.nextUrl.origin);
  url.searchParams.set(ok ? 'unsubscribed' : 'error', '1');
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const ok = await run(req, req.nextUrl.searchParams.get('token') ?? '');
  return new Response(null, { status: ok ? 200 : 400 });
}
