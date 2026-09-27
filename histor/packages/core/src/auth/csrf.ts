/**
 * Protección CSRF en dos capas para toda petición que cambia datos:
 * 1) Origen: la cabecera Origin (o Referer) debe ser la de la web.
 * 2) Doble envío firmado: cookie `histor_csrf` = token firmado; el cliente
 *    lo reenvía en la cabecera `x-csrf-token`. Las cookies de sesión son
 *    además SameSite=Lax, HttpOnly y Secure.
 */
import { env } from '../env';
import { randomToken, safeEqual, sign, unsign } from '../security/crypto';

export const CSRF_COOKIE = 'histor_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function newCsrfToken(): string {
  return sign(randomToken(18));
}

export function checkOrigin(origin: string | null, referer: string | null, host: string | null): boolean {
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(env().PUBLIC_BASE_URL).origin);
  } catch {
    /* sin base configurada */
  }
  if (host) {
    allowed.add(`https://${host}`);
    if (env().NODE_ENV !== 'production') allowed.add(`http://${host}`);
  }
  const src = origin ?? (referer ? safeOrigin(referer) : null);
  return !!src && allowed.has(src);
}

function safeOrigin(u: string): string | null {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

export function checkCsrf(cookieValue: string | null | undefined, headerValue: string | null | undefined): boolean {
  if (!cookieValue || !headerValue) return false;
  if (!unsign(cookieValue)) return false;
  return safeEqual(cookieValue, headerValue);
}
