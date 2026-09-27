import { opsOverview } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton } from '@/components/admin/AdminClient';
import { When } from '@/components/admin/Bits';

export default async function Ops() {
  const g = await adminGuard('audit.view');
  if (!g.ok) return <GuardBlock g={g} />;
  const o = await opsOverview(db());
  return (
    <>
      <h1>Operación</h1>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton action="pipeline.run" body={{}} label="Lanzar una vuelta del pipeline" />
        <ActionButton action="newsletters.send" body={{}} label="Enviar newsletters pendientes" />
      </p>
      <section className="panel">
        <h2>Pipeline (últimas etapas)</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Etapa</th>
                <th>Resultado</th>
                <th>Recuento</th>
              </tr>
            </thead>
            <tbody>
              {o.recentRuns.map((r) => (
                <tr key={r.id}>
                  <td>
                    <When d={r.startedAt} />
                  </td>
                  <td>{r.stage}</td>
                  <td>{r.ok === null ? 'en curso' : r.ok ? '✓' : <span title={r.error ?? ''}>✕ {r.error?.split('\n')[0].slice(0, 120)}</span>}</td>
                  <td style={{ fontSize: 12 }}>{JSON.stringify(r.counts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Uso de IA (30 días)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Modelo</th>
              <th>Llamadas</th>
              <th>Errores</th>
              <th>Coste</th>
            </tr>
          </thead>
          <tbody>
            {o.ai.map((a, i) => (
              <tr key={i}>
                <td>{a.task}</td>
                <td>{a.model}</td>
                <td>{Number(a.calls)}</td>
                <td>{Number(a.errors)}</td>
                <td>${Number(a.usd ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Errores de lectura de fuentes</h2>
        <table className="table">
          <tbody>
            {o.fetchErrors.map((f, i) => (
              <tr key={i}>
                <td>
                  <When d={f.ts} />
                </td>
                <td>{f.source}</td>
                <td>{f.status ?? '—'}</td>
                <td style={{ fontSize: 12 }}>{f.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Trabajos fallidos</h2>
        <table className="table">
          <tbody>
            {o.failedJobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <When d={j.finishedAt} />
                </td>
                <td>{j.name}</td>
                <td style={{ fontSize: 12 }}>{j.lastError?.split('\n')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Correo saliente</h2>
        <table className="table">
          <tbody>
            {o.mail.map((m) => (
              <tr key={m.id}>
                <td>
                  <When d={m.createdAt} />
                </td>
                <td>{m.kind}</td>
                <td>{m.status}</td>
                <td style={{ fontSize: 12 }}>{m.subject}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12 }}>
          Sin RESEND_API_KEY los correos quedan registrados aquí con estado «logged» y no se envían.
        </p>
      </section>
      <section className="panel">
        <h2>Auditoría</h2>
        <table className="table">
          <tbody>
            {o.audit.map((a) => (
              <tr key={a.id}>
                <td>
                  <When d={a.ts} />
                </td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td>
                  {a.targetType} {a.targetId}
                </td>
                <td style={{ fontSize: 12 }}>{JSON.stringify(a.detail).slice(0, 160)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
