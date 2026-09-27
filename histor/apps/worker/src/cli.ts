/**
 * CLI de operación:
 *   migrate                 aplica las migraciones
 *   seed                    datos de referencia (idiomas, países, secciones, fuentes, precios, mesas, newsletters)
 *   create-admin            crea/promueve el admin (ADMIN_EMAIL + ADMIN_PASSWORD)
 *   demo:seed [--phase=2]   carga el escenario DEMO pasando por el pipeline real
 *   demo:purge              borra todo el contenido DEMO
 *   sources:check [--update] [--only=slug] comprueba las fuentes reales (robots, estado, formato, nº de piezas)
 *   run-once                una vuelta del pipeline
 *   newsletter:send         envía las newsletters cuya hora ha llegado
 *   check:env               lista lo que falta para producción
 */
import { eq } from 'drizzle-orm';
import { ensureAdmin } from '@histor/core/auth/users';
import { SOURCE_SEEDS } from '@histor/core/config/sources';
import { closeDb, getDb } from '@histor/core/db/client';
import { runMigrations } from '@histor/core/db/migrate';
import { sources } from '@histor/core/db/schema';
import { seedReference } from '@histor/core/db/seed';
import { purgeDemo, seedDemo } from '@histor/core/demo/seed';
import { env, productionProblems } from '@histor/core/env';
import { runConnector } from '@histor/core/ingest/connectors';
import { PoliteFetcher } from '@histor/core/ingest/fetcher';
import { sendDueNewsletters } from '@histor/core/newsletter/index';
import { runPipelineOnce } from '@histor/core/pipeline/run';

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name: string) => flag(name)?.split('=')[1];

async function main(): Promise<number> {
  switch (cmd) {
    case 'migrate':
      await runMigrations();
      console.log('✓ migraciones aplicadas');
      return 0;
    case 'seed': {
      await runMigrations();
      console.log('✓ referencia', await seedReference(getDb()));
      return 0;
    }
    case 'create-admin': {
      const e = env();
      if (!e.ADMIN_EMAIL || !e.ADMIN_PASSWORD) {
        console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD.');
        return 1;
      }
      if (e.ADMIN_PASSWORD.length < 12) {
        console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
        return 1;
      }
      console.log(`✓ admin ${await ensureAdmin(getDb(), e.ADMIN_EMAIL, e.ADMIN_PASSWORD)}: ${e.ADMIN_EMAIL}`);
      return 0;
    }
    case 'demo:seed': {
      await runMigrations();
      await seedReference(getDb());
      const phase = flagValue('phase') === '2' ? 2 : 1;
      const stats = await seedDemo(getDb(), { phase });
      console.log(`✓ DEMO cargada (fase ${phase})`, stats);
      if (!env().DEMO_MODE) console.log('Aviso: la web solo muestra el contenido DEMO con DEMO_MODE=1.');
      return 0;
    }
    case 'demo:purge':
      console.log('✓ DEMO borrada', await purgeDemo(getDb()));
      return 0;
    case 'run-once':
      console.log(await runPipelineOnce(getDb(), { ingest: env().INGEST_ENABLED && !env().DEMO_MODE, onlyDemo: env().DEMO_MODE }));
      return 0;
    case 'newsletter:send':
      console.log(await sendDueNewsletters(getDb()));
      return 0;
    case 'check:env': {
      const p = productionProblems();
      if (!p.length) console.log('✓ configuración mínima de producción correcta');
      p.forEach((x) => console.log('✕', x));
      return p.length ? 1 : 0;
    }
    case 'sources:check':
      return sourcesCheck();
    default:
      console.log('Uso: cli <migrate|seed|create-admin|demo:seed|demo:purge|sources:check|run-once|newsletter:send|check:env>');
      return cmd ? 1 : 0;
  }
}

/** Comprueba cada fuente real: robots.txt, respuesta, formato y piezas. No guarda texto. */
async function sourcesCheck(): Promise<number> {
  const only = flagValue('only');
  const update = !!flag('update');
  const fetcher = new PoliteFetcher({ minHostIntervalMs: 1500 });
  const list = SOURCE_SEEDS.filter((s) => (!only || s.slug === only) && s.feedUrl);
  let bad = 0;
  console.log(`Comprobando ${list.length} fuentes (respetando robots.txt; 1 petición cada 1,5 s por dominio)…\n`);
  for (const s of list) {
    const r = await runConnector({ id: 0, connector: s.connector, feedUrl: s.feedUrl, homepageUrl: s.homepageUrl, etag: null, lastModified: null, config: s.config ?? {} }, fetcher).catch((e) => ({
      items: [],
      status: 0,
      error: (e as Error).message,
      tdmReserved: false,
      durationMs: 0,
    }));
    const ok = !r.error && r.items.length > 0;
    if (!ok) bad++;
    const newest = r.items.map((i) => i.publishedAt).filter(Boolean).sort().pop();
    console.log(
      `${ok ? '✓' : '✕'} ${s.slug.padEnd(28)} HTTP ${String(r.status).padEnd(4)} piezas ${String(r.items.length).padStart(3)}  ${r.tdmReserved ? 'TDM-reservada ' : ''}${newest ? `última ${new Date(newest).toISOString().slice(0, 16)}` : ''} ${r.error ? `— ${r.error}` : ''}`,
    );
    if (update) {
      await getDb()
        .update(sources)
        .set({ robotsAllowed: !(r.error ?? '').includes('robots'), tdmReserved: r.tdmReserved, verifiedAt: ok ? new Date() : undefined, status: ok ? undefined : 'paused', blockedReason: ok ? null : `sources:check: ${r.error ?? 'sin piezas'}`.slice(0, 300) })
        .where(eq(sources.slug, s.slug));
    }
  }
  console.log(`\n${list.length - bad}/${list.length} fuentes correctas.${update ? ' Estado actualizado en la base de datos (las que fallan quedan en pausa).' : ' Usa --update para guardar el resultado.'}`);
  return bad ? 2 : 0;
}

main()
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  })
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => {});
    process.exit(1);
  });
