import { can, SOURCE_TYPES } from '@histor/core/domain';
import { demoMode } from '@histor/core/services/content';
import { listSources } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton, ActionForm } from '@/components/admin/AdminClient';
import { When } from '@/components/admin/Bits';

export default async function Sources({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return <GuardBlock g={g} />;
  const sp = await searchParams;
  const rows = await listSources(db(), { q: sp.q || undefined, status: sp.status || undefined, demo: demoMode() });
  const role = g.user.role;
  return (
    <>
      <h1>Fuentes</h1>
      <p className="muted">
        Solo fuentes legales: se respetan robots.txt, condiciones de uso y la reserva de minería de textos. Las redes sociales son pistas, nunca prueba. Para añadir fuentes nuevas, ver <code>packages/core/src/config/sources.ts</code> y <code>npm run sources:check</code>.
      </p>
      <form className="form" style={{ display: 'flex', gap: 10, maxWidth: 'none', alignItems: 'end', flexWrap: 'wrap' }}>
        <label>
          Buscar
          <input name="q" defaultValue={sp.q} />
        </label>
        <label>
          Estado
          <select name="status" defaultValue={sp.status ?? ''}>
            <option value="">Todos</option>
            {['active', 'paused', 'failing', 'blocked'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-small btn-solid">Filtrar</button>
      </form>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fiabilidad</th>
              <th>Última lectura</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, r }) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {s.connector} · {s.feedUrl ?? s.homepageUrl}
                    {s.ownershipGroup && ` · grupo: ${s.ownershipGroup}`}
                    {s.isSatire && ' · SÁTIRA'}
                    {s.tdmReserved && ' · TDM reservada'}
                  </div>
                </td>
                <td>{s.sourceType}</td>
                <td>
                  <span className={`state ${s.status === 'active' ? 'state-PUBLISHED' : s.status === 'blocked' || s.status === 'failing' ? 'state-REJECTED' : ''}`}>{s.status}</span>
                  {s.consecutiveFailures > 0 && <div className="muted">fallos: {s.consecutiveFailures}</div>}
                  {s.blockedReason && <div className="muted">{s.blockedReason}</div>}
                </td>
                <td className="tnum">
                  {r ? `${Math.round((r.alpha / (r.alpha + r.beta)) * 100)} %` : '—'}
                  {r && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      ✓{r.confirmedCount} ✕{r.contradictedCount} ⧉{r.copyCount}
                    </div>
                  )}
                </td>
                <td>
                  <When d={s.lastSuccessAt} />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.status !== 'active' && can(role, 'sources.manage') && <ActionButton action="source.status" body={{ id: s.id, status: 'active' }} label="Activar" />}
                    {s.status === 'active' && can(role, 'sources.manage') && <ActionButton action="source.status" body={{ id: s.id, status: 'paused' }} label="Pausar" />}
                    {s.status !== 'blocked' && can(role, 'sources.block') && <ActionButton action="source.status" body={{ id: s.id, status: 'blocked', reason: 'bloqueada desde el panel' }} label="Bloquear" confirm={`¿Bloquear ${s.name}?`} danger />}
                  </div>
                  {can(role, 'sources.manage') && (
                    <details>
                      <summary style={{ fontSize: 12 }}>Editar</summary>
                      <ActionForm
                        action="source.update"
                        fixed={{ id: s.id }}
                        fields={[
                          { name: 'sourceType', label: 'Tipo', type: 'select', options: SOURCE_TYPES.map((t) => ({ value: t, label: t })), defaultValue: s.sourceType },
                          { name: 'ownershipGroup', label: 'Grupo propietario', defaultValue: s.ownershipGroup ?? '' },
                          { name: 'fetchIntervalMinutes', label: 'Intervalo (min)', type: 'number', min: 5, max: 1440, defaultValue: s.fetchIntervalMinutes },
                          { name: 'isSatire', label: 'Es sátira', type: 'checkbox', defaultValue: s.isSatire },
                        ]}
                        submit="Guardar"
                      />
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
