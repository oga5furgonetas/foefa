// Descarga la base de países por IP de DB-IP (Lite, CC BY 4.0: https://db-ip.com) para
// la edición geolocalizada. Se usa en memoria y la IP nunca se guarda. Si falla la descarga,
// la web sigue funcionando y deduce el país por el idioma del navegador.
//   node scripts/fetch-geoip.mjs [destino]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

const out = process.argv[2] ?? 'geo/dbip-country-lite.mmdb';
const now = new Date();
const months = [0, 1, 2].map((d) => {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
});
for (const m of months) {
  try {
    const res = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${m}.mmdb.gz`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) continue;
    const db = gunzipSync(Buffer.from(await res.arrayBuffer()));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, db);
    console.log(`✓ geolocalización: DB-IP Country Lite ${m} (${(db.length / 1e6).toFixed(1)} MB) → ${out}`);
    process.exit(0);
  } catch (e) {
    console.warn(`(DB-IP ${m}: ${e.message})`);
  }
}
console.warn('Aviso: sin base de geolocalización; el país se deducirá del idioma del navegador.');
