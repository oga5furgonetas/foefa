import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/server';

/** Salud para el balanceador: la app responde y la base de datos también. */
export async function GET() {
  const started = Date.now();
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: 'up', ms: Date.now() - started }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
