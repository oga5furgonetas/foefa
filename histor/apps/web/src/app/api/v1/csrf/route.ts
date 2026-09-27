import { CSRF_COOKIE, newCsrfToken } from '@histor/core/auth/csrf';
import { handler, json } from '@/lib/api';

/** Emite el token CSRF de doble envío (cookie legible por el cliente + cabecera). */
export const GET = handler(async (req) => {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? newCsrfToken();
  const res = json({ token });
  if (!existing) res.cookies.set(CSRF_COOKIE, token, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: false, maxAge: 60 * 60 * 24 * 7 });
  return res;
});
