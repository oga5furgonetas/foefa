import { exportUserData } from '@histor/core/auth/users';
import { handler, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

/** Derecho de acceso y portabilidad: descarga JSON con todos los datos del usuario. */
export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const data = await exportUserData(db(), u.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="histor-datos-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
});
