import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { experiments } from '@histor/core/db/schema';
import { experimentResults } from '@histor/core/experiments/index';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton, ActionForm } from '@/components/admin/AdminClient';
import { When } from '@/components/admin/Bits';

export default async function Experiments() {
  const g = await adminGuard('experiments.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const list = await db().select().from(experiments).orderBy(desc(experiments.createdAt)).limit(30);
  const results = await Promise.all(list.map((e) => experimentResults(db(), e.id)));
  return (
    <>
      <h1>Experimentos A/B</h1>
      <p className="muted">
        Sin clickbait: cada titular alternativo pasa los mismos controles que un titular normal (nada sensacionalista, sin preguntas, sin cifras que no estén en el texto). El ganador se decide por <strong>lectura real</strong> (llegar al 60 % del texto), no por clics. Solo participan lectores con consentimiento de medición.
      </p>
      <section className="panel">
        <h2>Nuevo experimento de titular</h2>
        <ActionForm
          action="experiment.create"
          fields={[
            { name: 'articleId', label: 'ID del artículo', type: 'number', required: true },
            { name: 'headlines', label: 'Titulares alternativos (uno por línea)', type: 'textarea', required: true },
          ]}
          submit="Crear"
        />
      </section>
      {list.map((e, i) => {
        const r = results[i];
        return (
          <section key={e.id} className="panel">
            <h2>
              {e.key} <span className="state">{e.status}</span> {e.winner && <span className="badge badge-verified">ganador: {e.winner}</span>}
            </h2>
            <p className="muted" style={{ margin: '0 0 6px' }}>
              {e.kind} · artículo #{e.articleId} · <When d={e.createdAt} /> · métrica: {e.metric}
            </p>
            {r && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>Impresiones</th>
                    <th>CTR</th>
                    <th>Lectura real</th>
                    <th>P(mejor)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.variants.map((v) => (
                    <tr key={v.key}>
                      <td>
                        <strong>{v.key}</strong> {v.headline}
                      </td>
                      <td>{v.impressions}</td>
                      <td>{(v.ctr * 100).toFixed(1)} %</td>
                      <td>{(v.readThrough * 100).toFixed(1)} %</td>
                      <td>{Math.round(v.probBest * 100)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {e.status === 'running' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {r?.variants.map((v) => (
                  <ActionButton key={v.key} action="experiment.stop" body={{ id: e.id, winner: v.key }} label={`Terminar: gana ${v.key}`} confirm={v.key === 'control' ? undefined : `El titular del artículo pasará a ser: «${v.headline}». Se registra como corrección pública de tipo actualización.`} />
                ))}
                <ActionButton action="experiment.stop" body={{ id: e.id }} label="Parar sin ganador" />
              </div>
            )}
          </section>
        );
      })}
      {!list.length && (
        <p className="muted">
          Aún no hay experimentos. <Link href="/admin/stories">Elige un artículo publicado</Link>.
        </p>
      )}
    </>
  );
}
