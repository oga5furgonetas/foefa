import { z } from 'zod';
import { REPORT_KINDS } from '@histor/core/domain';
import { LIMITS } from '@histor/core/security/ratelimit';
import { submitReport } from '@histor/core/services/admin';
import { assertCsrf, clientIp, handler, ipKey, json, limit, parseBody } from '@/lib/api';
import { db } from '@/lib/server';

const schema = z.object({
  kind: z.enum(REPORT_KINDS),
  articleId: z.number().int().positive().nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  description: z.string().min(10).max(5000),
  name: z.string().max(100).nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  website: z.string().max(200).optional(), // campo trampa
});

/** Cada aviso de un lector se convierte en una tarea de revisión. */
export const POST = handler(async (req) => {
  assertCsrf(req);
  await limit(LIMITS.report(ipKey(req)));
  const b = await parseBody(req, schema);
  if (b.website) return json({ ok: true }); // bot: se descarta en silencio
  const r = await submitReport(db(), { kind: b.kind, articleId: b.articleId ?? null, url: b.url ?? null, description: b.description, name: b.name ?? null, email: b.email ?? null, ip: clientIp(req) });
  return json({ ok: true, id: r }, { status: 201 });
});
