import { destroySession, SESSION_COOKIE } from '@histor/core/auth/users';
import { assertCsrf, handler, json } from '@/lib/api';
import { db } from '@/lib/server';

export const POST = handler(async (req) => {
  assertCsrf(req);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(db(), token);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
