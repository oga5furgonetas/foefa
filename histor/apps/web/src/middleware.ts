/**
 * Middleware (Edge):
 * 1) "/" → /{idioma} según preferencia, Accept-Language y país del CDN.
 * 2) Recuerda la edición detectada (cookie) si el lector no eligió otra.
 * 3) Cabeceras de seguridad. CSP estricta con nonce en /admin y /api;
 *    CSP restrictiva sin nonce en las páginas públicas (cacheables en CDN).
 * 4) Emite el token CSRF (doble envío) si falta.
 * 5) /admin exige sesión (el rol y el 2FA se comprueban en el servidor).
 * Nota: el Edge no puede importar el núcleo (Postgres); la lógica aquí es mínima.
 */
import { NextResponse, type NextRequest } from 'next/server';

const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'];
const COUNTRY_LANG: Record<string, string> = { ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', UY: 'es', US: 'en', GB: 'en', IE: 'en', CA: 'en', AU: 'en', DE: 'de', AT: 'de', CH: 'de', FR: 'fr', BE: 'fr', IT: 'it', PT: 'pt', BR: 'pt' };

/** «Noticias de hoy» en cada idioma (las mismas palabras que i18n/routes.ts; el Edge no importa el núcleo). */
const TODAY: Record<string, string> = { es: 'noticias-de-hoy', en: 'news-today', de: 'nachrichten-heute', fr: 'actualites-du-jour', it: 'notizie-di-oggi', pt: 'noticias-de-hoje' };

function pickLang(req: NextRequest): string {
  const cookie = req.cookies.get('histor_lang')?.value;
  if (cookie && LANGS.includes(cookie)) return cookie;
  const accepted = (req.headers.get('accept-language') ?? '')
    .split(',')
    .map((p) => {
      const [tag, q] = p.trim().split(';q=');
      return { l: tag.split('-')[0].toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const hit = accepted.find((a) => LANGS.includes(a.l));
  if (hit) return hit.l;
  const cc = cdnCountry(req);
  return (cc && COUNTRY_LANG[cc]) || 'en';
}

function cdnCountry(req: NextRequest): string | null {
  const c = req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country') ?? req.headers.get('x-country-code');
  return c && /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
}

/** Host del dominio canónico si es propio (no *.fly.dev ni localhost); si no, null. */
function canonicalHost(): string | null {
  try {
    const h = new URL(process.env.PUBLIC_BASE_URL ?? '').host.toLowerCase();
    return h && !h.endsWith('.fly.dev') && !h.startsWith('localhost') && !h.startsWith('127.') ? h : null;
  } catch {
    return null;
  }
}

function randomToken(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strictCsp(nonce: string, dev: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ');
}

/**
 * Dominios de Google AdSense (anuncios automáticos y su mensaje de consentimiento, obligatorio en
 * la UE). Solo se abren si hay ADSENSE_CLIENT: sin anuncios, la CSP sigue igual de estricta.
 */
const ADS = {
  script: 'https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google',
  frame: 'https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google',
  connect: 'https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net https://fundingchoicesmessages.google.com https://*.adtrafficquality.google',
};

function publicCsp(dev: boolean): string {
  const ads = !!process.env.ADSENSE_CLIENT;
  return [
    `default-src 'self'`,
    // Páginas públicas cacheables: sin nonce por petición. No hay HTML de terceros
    // ni contenido de usuarios; React escapa todo el texto y el JSON-LD se serializa escapado.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${ads ? ` ${ADS.script}` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${ads ? ` ${ADS.connect}` : ''}`,
    // Vídeos de la noticia con el reproductor oficial de YouTube sin cookies (03-10-2026).
    `frame-src https://www.youtube-nocookie.com${ads ? ` ${ADS.frame}` : ''}`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://checkout.stripe.com https://accounts.google.com https://appleid.apple.com`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const dev = process.env.NODE_ENV !== 'production';

  // Dominio propio: quien entre por la dirección técnica (*.fly.dev) o por www. va con un 301 al
  // dominio canónico (PUBLIC_BASE_URL), para que enlaces viejos sigan funcionando y Google
  // concentre todo en uno. La API y las comprobaciones de salud no se redirigen.
  const canonical = canonicalHost();
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const alias = host.endsWith('.fly.dev') || host === `www.${canonical}`;
  if (canonical && alias && host !== canonical && !pathname.startsWith('/api/')) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${canonical}`);
    return NextResponse.redirect(url, 301);
  }

  if (pathname === '/') {
    const lang = pickLang(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${lang}`;
    const res = NextResponse.redirect(url, 302);
    res.headers.set('vary', 'accept-language, cookie');
    return res;
  }

  // Un solo enlace para los anuncios en todo el mundo (03-10-2026): histor.es/hoy (o /today) lleva a
  // «Noticias de hoy» en el idioma del lector, con los parámetros de la campaña intactos.
  if (pathname === '/hoy' || pathname === '/today') {
    const lang = pickLang(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${lang}/${TODAY[lang] ?? TODAY.en}`;
    const res = NextResponse.redirect(url, 302);
    res.headers.set('vary', 'accept-language, cookie');
    return res;
  }

  const isAdmin = pathname.startsWith('/admin');
  const isApi = pathname.startsWith('/api');
  const nonce = randomToken(16);
  const reqHeaders = new Headers(req.headers);
  if (isAdmin) {
    // Next.js lee el nonce de la CSP de la PETICIÓN y lo aplica a sus scripts.
    reqHeaders.set('x-nonce', nonce);
    reqHeaders.set('content-security-policy', strictCsp(nonce, dev));
  }
  reqHeaders.set('x-pathname', pathname);

  if (isAdmin && !req.cookies.get('histor_session')) {
    const url = req.nextUrl.clone();
    url.pathname = `/${pickLang(req)}/${{ es: 'entrar', en: 'login', de: 'anmelden', fr: 'connexion', it: 'accedi', pt: 'entrar' }[pickLang(req)]}`;
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('content-security-policy', isAdmin || isApi ? strictCsp(nonce, dev) : publicCsp(dev));
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  res.headers.set('x-frame-options', 'DENY');
  res.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com"), interest-cohort=()');
  res.headers.set('cross-origin-opener-policy', 'same-origin');
  if (!dev) res.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  if (isAdmin) res.headers.set('x-robots-tag', 'noindex, nofollow');

  // Token CSRF de doble envío (firmado en el servidor la primera vez que se pide /api/v1/csrf).
  // Edición detectada: se recuerda para que la portada sea coherente entre visitas.
  const cc = cdnCountry(req);
  if (cc && !req.cookies.get('histor_edition') && !isApi) {
    res.cookies.set('histor_geo', cc, { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax', secure: !dev, httpOnly: false });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|icon-|fonts/|sw.js|manifest.webmanifest|robots.txt|sitemap|news-sitemap).*)'],
};
