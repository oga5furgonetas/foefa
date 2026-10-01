/**
 * CLI de operación:
 *   migrate                 aplica las migraciones
 *   seed                    datos de referencia (idiomas, países, secciones, fuentes, precios, mesas, newsletters)
 *   create-admin            crea/promueve el admin (ADMIN_EMAIL + ADMIN_PASSWORD)
 *   demo:seed [--phase=2]   carga el escenario DEMO pasando por el pipeline real
 *   demo:purge              borra todo el contenido DEMO
 *   sources:check [--update] [--only=slug1,slug2] comprueba las fuentes reales (robots, estado, formato, nº de piezas)
 *   run-once                una vuelta del pipeline
 *   newsletter:send         envía las newsletters cuya hora ha llegado
 *   check:env               lista lo que falta para producción
 *   images:backfill [--hours=72]  pone imagen ilustrativa (Wikimedia Commons) a lo publicado que no tenga
 *   admin:reset-password    NEW_PASSWORD=… [--email=…] restablece la contraseña (sin correo configurado)
 *   stories:recheck [--hours=72]  vuelve a verificar y redactar lo publicado en esas horas (tras mejorar el redactor)
 */
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import { ensureAdmin, operatorResetPassword } from '@histor/core/auth/users';
import { SOURCE_SEEDS } from '@histor/core/config/sources';
import { closeDb, getDb } from '@histor/core/db/client';
import { articles, rawItems, stories, storyItems } from '@histor/core/db/schema';
import { nonNewsReason } from '@histor/core/text/nonnews';
import { runMigrations } from '@histor/core/db/migrate';
import { attachStoryImage } from '@histor/core/media/wikimedia';
import { seedReference } from '@histor/core/db/seed';
import { purgeDemo, seedDemo } from '@histor/core/demo/seed';
import { env, productionProblems } from '@histor/core/env';
import { runConnector } from '@histor/core/ingest/connectors';
import { PoliteFetcher } from '@histor/core/ingest/fetcher';
import { sendDueNewsletters } from '@histor/core/newsletter/index';
import { runPipelineOnce } from '@histor/core/pipeline/run';
import { evaluateSourceCheck, recordSourceCheck } from '@histor/core/services/sources';

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
    case 'admin:reset-password': {
      // La contraseña llega por NEW_PASSWORD (no por argumentos: se verían en la lista de procesos).
      const email = flagValue('email') ?? env().ADMIN_EMAIL;
      const pw = process.env.NEW_PASSWORD ?? '';
      if (!email || !pw) {
        console.error('Uso: NEW_PASSWORD=… cli admin:reset-password [--email=…]');
        return 1;
      }
      const r = await operatorResetPassword(getDb(), email, pw);
      console.log(r === 'ok' ? '✓ contraseña restablecida y sesiones cerradas' : r === 'weak' ? '✕ contraseña demasiado débil' : '✕ no existe esa cuenta');
      return r === 'ok' ? 0 : 1;
    }
    case 'check:env': {
      const p = productionProblems();
      if (!p.length) console.log('✓ configuración mínima de producción correcta');
      p.forEach((x) => console.log('✕', x));
      return p.length ? 1 : 0;
    }
    case 'sources:check':
      return sourcesCheck();
    case 'stories:recheck': {
      // Tras mejorar el redactor, lo ya publicado se reescribe en los próximos ciclos del worker
      // (si no, «S&aacute;nchez» y las entradillas sueltas seguían en portada hasta su revisión).
      const hours = Number(flagValue('hours') ?? 72);
      const ids = await getDb()
        .selectDistinct({ id: articles.storyId })
        .from(articles)
        .where(and(eq(articles.status, 'published'), eq(articles.isDemo, false), gte(articles.publishedAt, new Date(Date.now() - hours * 3600_000))));
      if (ids.length) await getDb().update(stories).set({ nextCheckAt: new Date() }).where(inArray(stories.id, ids.map((x) => x.id)));
      // Lo que con los filtros de hoy no es noticia (sorteos, publicidad, alertas verdes…) sale de
      // la portada sin «rectificación»: no era un error de hecho, simplemente no es noticia.
      let hidden = 0;
      for (const { id } of ids) {
        const its = await getDb().select({ title: rawItems.title, url: rawItems.url }).from(storyItems).innerJoin(rawItems, eq(rawItems.id, storyItems.itemId)).where(eq(storyItems.storyId, id));
        const heads = await getDb().select({ headline: articles.headline }).from(articles).where(and(eq(articles.storyId, id), eq(articles.status, 'published')));
        // Todas sus piezas, o el propio titular publicado («Comprobar Bonoloto: resultados…»).
        const notNews = (its.length > 0 && its.every((i) => nonNewsReason(i.title, i.url))) || heads.some((h) => nonNewsReason(h.headline, 'https://histor.invalid/'));
        if (!notNews) continue;
        await getDb().update(articles).set({ status: 'held' }).where(and(eq(articles.storyId, id), eq(articles.status, 'published')));
        await getDb().update(stories).set({ state: 'REJECTED', nextCheckAt: null }).where(eq(stories.id, id));
        hidden++;
      }
      console.log(`✓ ${ids.length} historias en cola para reverificar y reescribir; ${hidden} retiradas por no ser noticia`);
      return 0;
    }
    case 'images:backfill': {
      // --hours=72: solo lo publicado en las últimas horas (lo que sale en portada).
      const hours = Number(args.find((a) => a.startsWith('--hours='))?.split('=')[1] ?? 0);
      const since = hours > 0 ? gte(articles.publishedAt, new Date(Date.now() - hours * 3600000)) : undefined;
      const ids = await getDb().selectDistinct({ id: articles.storyId }).from(articles).where(and(eq(articles.status, 'published'), isNull(articles.imageId), eq(articles.isDemo, false), since));
      const tally: Record<string, number> = {};
      for (const { id } of ids) {
        const r = await attachStoryImage(getDb(), id).catch(() => 'error');
        tally[r] = (tally[r] ?? 0) + 1;
      }
      console.log(`✓ imágenes: ${ids.length} historias revisadas`, tally);
      return 0;
    }
    default:
      console.log('Uso: cli <migrate|seed|create-admin|demo:seed|demo:purge|sources:check|images:backfill|stories:recheck|run-once|newsletter:send|check:env>');
      return cmd ? 1 : 0;
  }
}

/** Comprueba cada fuente real: robots.txt, respuesta, formato y piezas. No guarda texto. */
async function sourcesCheck(): Promise<number> {
  const only = flagValue('only');
  const update = !!flag('update');
  const fetcher = new PoliteFetcher({ minHostIntervalMs: 1500 });
  const wanted = only ? new Set(only.split(',').map((x) => x.trim())) : null;
  const list = SOURCE_SEEDS.filter((s) => (!wanted || wanted.has(s.slug)) && s.feedUrl);
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
    const { ok, error, newest } = evaluateSourceCheck(s.connector, r);
    if (!ok) bad++;
    console.log(
      `${ok ? '✓' : '✕'} ${s.slug.padEnd(28)} HTTP ${String(r.status).padEnd(4)} piezas ${String(r.items.length).padStart(3)}  ${r.tdmReserved ? 'reservada ' : ''}${newest ? `última ${newest.toISOString().slice(0, 16)}` : ''} ${error ? `— ${error}` : ''}`,
    );
    if (update) await recordSourceCheck(getDb(), s.slug, { ok, error, tdmReserved: r.tdmReserved });
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
