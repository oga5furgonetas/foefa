import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@histor/core/domain';
import { href } from '@histor/core/i18n/routes';
import { storyDetail } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton, ActionForm } from '@/components/admin/AdminClient';
import { Bar, When } from '@/components/admin/Bits';

const REL: Record<string, string> = { supports: '✓ respalda', contradicts: '✕ contradice', mentions: '· menciona' };

export default async function StoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return <GuardBlock g={g} />;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const d = await storyDetail(db(), id);
  if (!d) notFound();
  const { story: s } = d;
  const role = g.user.role;
  const lastV = d.verifications[0];
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  return (
    <>
      <p>
        <Link href="/admin/stories">← Historias</Link>
      </p>
      <h1 style={{ marginBottom: 6 }}>{s.headlineHint}</h1>
      <p className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`state state-${s.state}`}>{s.state}</span>
        {s.isDemo && <span className="badge badge-demo">DEMO</span>}
        {s.flags.map((f) => (
          <span key={f} className="badge badge-review">
            {f}
          </span>
        ))}
        {s.blockedReason && <span className="muted">Bloqueo: {s.blockedReason}</span>}
      </p>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Confianza en la evidencia</div>
          <Bar v={s.evidenceConfidence} />
        </div>
        <div className="kpi">
          <div className="l">Impulso (no suma confianza)</div>
          <Bar v={s.momentum} mom />
        </div>
        <div className="kpi">
          <div className="v">{s.independentSourceCount}</div>
          <div className="l">Fuentes independientes</div>
        </div>
        <div className="kpi">
          <div className="v">{s.itemCount}</div>
          <div className="l">Piezas</div>
        </div>
        <div className="kpi">
          <div className="l">Próxima comprobación</div>
          <When d={s.nextCheckAt} />
        </div>
      </div>

      <section className="panel">
        <h2>Acciones editoriales</h2>
        <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {can(role, 'stories.edit') && <ActionButton action="story.recheck" body={{ id }} label="Volver a verificar ahora" />}
          {can(role, 'stories.block') && s.state === 'BLOCKED' && <ActionButton action="story.unblock" body={{ id }} label="Desbloquear" />}
        </div>
        {can(role, 'stories.block') && s.state !== 'BLOCKED' && (
          <details style={{ marginTop: 10 }}>
            <summary>Bloquear (si está publicada, se retira con nota pública)</summary>
            <ActionForm action="story.block" fixed={{ id }} fields={[{ name: 'reason', label: 'Motivo (interno y, si se retira, público)', type: 'textarea', required: true }]} submit="Bloquear" danger />
          </details>
        )}
        {can(role, 'articles.retract') && ['PUBLISHED', 'UPDATED'].includes(s.state) && (
          <details style={{ marginTop: 10 }}>
            <summary>Retirar la noticia (queda visible, marcada como retirada)</summary>
            <ActionForm action="story.retract" fixed={{ id }} fields={[{ name: 'note', label: 'Nota pública de retirada (mín. 20 caracteres)', type: 'textarea', required: true }]} submit="Retirar" danger />
          </details>
        )}
      </section>

      {lastV && (
        <section className="panel">
          <h2>Última decisión: {lastV.decision}</h2>
          <p style={{ margin: '4px 0' }}>
            {lastV.stateBefore} → {lastV.stateAfter} · <When d={lastV.runAt} />
          </p>
          <ul>
            {lastV.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <details>
            <summary>Desglose de la confianza y umbrales</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify({ breakdown: lastV.breakdown, thresholds: lastV.thresholds }, null, 2)}</pre>
          </details>
        </section>
      )}

      <section className="panel">
        <h2>Artículos</h2>
        {!d.articles.length && <p className="muted">Sin artículo (no ha superado los umbrales o los controles).</p>}
        {d.articles.map((a) => (
          <div key={a.id} style={{ borderTop: '1px solid var(--rule)', padding: '10px 0' }}>
            <strong>[{a.language}]</strong> {a.headline} <span className="muted">· v{a.version} · {a.status} · {a.writer}</span>{' '}
            {a.publishedAt && (
              <Link href={href.article(a.language, a.publishedAt, a.slug)} target="_blank">
                ver ↗
              </Link>
            )}
            {can(role, 'articles.correct') && a.status === 'published' && (
              <details style={{ marginTop: 6 }}>
                <summary>Corregir / aclarar / actualizar</summary>
                <ActionForm
                  action="article.correct"
                  fixed={{ id: a.id }}
                  fields={[
                    { name: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'correction', label: 'Corrección' }, { value: 'clarification', label: 'Aclaración' }, { value: 'update', label: 'Actualización' }], defaultValue: 'correction' },
                    { name: 'headline', label: 'Titular (vacío = sin cambios)', defaultValue: a.headline },
                    { name: 'paragraphs', label: 'Párrafos a cambiar (JSON: [{"index":0,"text":"…"}])', type: 'json', defaultValue: '[]' },
                    { name: 'note', label: 'Nota pública (obligatoria)', type: 'textarea', required: true },
                  ]}
                  submit="Publicar cambio"
                />
                <ol start={0} style={{ fontSize: 13 }}>
                  {a.body.map((b, i) => (
                    <li key={i}>
                      <code>{b.type}</code> {'text' in b ? b.text : b.type === 'list' ? b.items.map((x) => x.text).join(' / ') : ''}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Cadena de evidencia: afirmaciones</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Afirmación</th>
                <th>Tipo / modalidad</th>
                <th>Estado</th>
                <th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {d.claims.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.text}
                    {c.attributedTo && <div className="muted">atribuida a: {c.attributedTo}</div>}
                  </td>
                  <td>
                    {c.kind}
                    <br />
                    <span className="muted">{c.modality}</span>
                  </td>
                  <td>
                    {c.status}
                    <br />
                    <span className="muted">ind.: {c.independentSupport}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.evidence.map((e) => (
                      <div key={e.id}>
                        {REL[e.relation] ?? e.relation} · {itemById.get(e.itemId)?.source ?? `#${e.sourceId}`} ({Math.round(e.matchScore * 100)} %){e.isPrimary && ' · primaria'}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.contradictions.length > 0 && (
        <section className="panel">
          <h2>Contradicciones</h2>
          <ul>
            {d.contradictions.map((c) => (
              <li key={c.id}>
                <strong>{c.field}</strong> ({c.severity}){c.resolved && ' · resuelta'}: <code style={{ fontSize: 12 }}>{JSON.stringify(c.detail)}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Piezas de las fuentes</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Fuente</th>
                <th>Título</th>
                <th>Independencia</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <When d={i.publishedAt} />
                  </td>
                  <td>
                    {i.source}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {i.sourceType}
                    </div>
                  </td>
                  <td>
                    <a href={i.url} target="_blank" rel="noopener nofollow">
                      {i.title}
                    </a>
                    {i.attributedTo && <div className="muted">origen declarado: {i.attributedTo}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {i.independenceKey}
                    {i.isCopy && ' · copia'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Controles de calidad</h2>
        {d.qualityReports.map((q) => (
          <details key={q.id}>
            <summary>
              [{q.language}] {q.passed ? '✓ superados' : '✕ fallidos'} · {q.writer} · <When d={q.createdAt} />
            </summary>
            <ul style={{ fontSize: 13 }}>
              {q.checks.map((c) => (
                <li key={c.name}>
                  {c.passed ? '✓' : '✕'} {c.name}
                  {c.critical && ' (crítico)'} {c.messages.join(' · ')}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section className="panel">
        <h2>Historial de verificaciones</h2>
        <table className="table">
          <tbody>
            {d.verifications.map((v) => (
              <tr key={v.id}>
                <td>
                  <When d={v.runAt} />
                </td>
                <td>
                  {v.stateBefore} → {v.stateAfter}
                </td>
                <td>{v.decision}</td>
                <td>
                  <Bar v={v.evidenceConfidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
