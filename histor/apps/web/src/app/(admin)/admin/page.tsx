import Link from 'next/link';
import { dashboardMetrics } from '@histor/core/analytics/index';
import { productionProblems, env } from '@histor/core/env';
import { paymentsEnabled } from '@histor/core/billing/index';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { Bar, Kpi } from '@/components/admin/Bits';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return <GuardBlock g={g} />;
  const hours = [24, 168, 720].includes(Number((await searchParams).h)) ? Number((await searchParams).h) : 24;
  const m = await dashboardMetrics(db(), { hours });
  const e = env();
  const integrations: [string, boolean][] = [
    ['IA (redacción con LLM)', !!(e.AI_PROVIDER_WRITING && (e.ANTHROPIC_API_KEY || e.OPENAI_API_KEY || e.GEMINI_API_KEY))],
    ['Pagos (Stripe)', paymentsEnabled()],
    ['Webhook de Stripe', !!e.STRIPE_WEBHOOK_SECRET],
    ['Correo (Resend)', !!e.RESEND_API_KEY],
    ['Avisos push (VAPID)', !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY)],
    ['Google', !!e.GOOGLE_CLIENT_ID],
    ['Apple', !!e.APPLE_CLIENT_ID],
    ['Sentry', !!e.SENTRY_DSN],
    ['Ingesta real activa', e.INGEST_ENABLED],
  ];
  const problems = e.NODE_ENV === 'production' ? productionProblems() : [];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1>Resumen</h1>
        <nav className="row" style={{ display: 'flex', gap: 8 }}>
          {[24, 168, 720].map((h) => (
            <Link key={h} className={`btn btn-small${h === hours ? ' btn-solid' : ''}`} href={`/admin?h=${h}`}>
              {h === 24 ? '24 h' : h === 168 ? '7 días' : '30 días'}
            </Link>
          ))}
        </nav>
      </div>
      {problems.length > 0 && (
        <div className="notice notice-review">
          <strong>Configuración de producción incompleta:</strong>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <h2 className="kicker">Pipeline</h2>
      <div className="kpis">
        <Kpi v={m.pipeline.itemsDiscovered} l="Piezas descubiertas" />
        <Kpi v={m.pipeline.itemsPerHour} l="Piezas / hora" />
        <Kpi v={m.pipeline.storiesDiscovered} l="Historias nuevas" />
        <Kpi v={m.pipeline.published} l="Publicadas" />
        <Kpi v={`${m.pipeline.rejectedPct} %`} l="Rechazadas" />
        <Kpi v={`${m.pipeline.heldPct} %`} l="Retenidas" />
        <Kpi v={`${m.pipeline.correctedPct} %`} l="Corregidas / retiradas" />
        <Kpi v={m.pipeline.avgDiscoveryToPublishMin ?? '—'} l="Min. descubrir → publicar" />
        <Kpi v={m.pipeline.duplicatesDetected} l="Copias detectadas" />
        <Kpi v={m.openReviewTasks} l="Tareas de revisión abiertas" href="/admin/tasks" />
      </div>
      <h2 className="kicker">Audiencia y negocio</h2>
      <div className="kpis">
        <Kpi v={m.audience.pageViews} l="Páginas vistas" />
        <Kpi v={m.audience.uniqueVisitors} l="Visitantes (con consentimiento)" />
        <Kpi v={m.audience.returningVisitors7d} l="Recurrentes 7 días" />
        <Kpi v={m.audience.ctr === null ? '—' : `${m.audience.ctr} %`} l="CTR" />
        <Kpi v={`${m.audience.avgDwellSeconds} s`} l="Tiempo de lectura medio" />
        <Kpi v={`${m.audience.avgScroll} %`} l="Profundidad media" />
        <Kpi v={m.audience.newsletterSignups} l="Altas newsletter" />
        <Kpi v={m.business.activeSubscriptions} l="Suscripciones activas" />
        <Kpi v={m.business.conversionRatePct === null ? '—' : `${m.business.conversionRatePct} %`} l="Conversión" />
        <Kpi v={`$${m.costs.aiUsd.toFixed(2)}`} l="Coste IA" />
        <Kpi v={`$${m.costs.aiUsdPerArticle}`} l="IA por noticia" />
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="panel">
          <h2>Impulso frente a confianza (viral ≠ verdadero)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Historia</th>
                <th>Impulso</th>
                <th>Confianza</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {m.viral.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/stories/${s.id}`}>{s.headline.slice(0, 80)}</Link>
                  </td>
                  <td>
                    <Bar v={s.momentum} mom />
                  </td>
                  <td>
                    <Bar v={s.confidence} />
                  </td>
                  <td>
                    <span className={`state state-${s.state}`}>{s.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Fuentes más fiables</h2>
          <table className="table">
            <tbody>
              {m.sources.best.map((s) => (
                <tr key={s.slug}>
                  <td>{s.name}</td>
                  <td>{s.reliability} %</td>
                  <td>✓ {s.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ marginTop: 14 }}>Fuentes con problemas</h2>
          <table className="table">
            <tbody>
              {m.sources.problematic.map((s) => (
                <tr key={s.slug}>
                  <td>
                    <Link href={`/admin/sources?q=${encodeURIComponent(s.slug)}`}>{s.name}</Link>
                  </td>
                  <td>{s.status}</td>
                  <td>fallos: {s.failures}</td>
                  <td>contradicha: {s.contradicted ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Audiencia por país e idioma</h2>
          <table className="table">
            <tbody>
              {m.audience.byCountry.map((r) => (
                <tr key={r.country ?? 'x'}>
                  <td>{r.country ?? '—'}</td>
                  <td>{r.views}</td>
                </tr>
              ))}
              {m.audience.byLanguage.map((r) => (
                <tr key={`l-${r.lang}`}>
                  <td>idioma: {r.lang ?? '—'}</td>
                  <td>{r.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ marginTop: 14 }}>Entidades más cubiertas</h2>
          <p style={{ margin: 0 }}>{m.topEntities.map((e) => `${e.name} (${e.c})`).join(' · ') || '—'}</p>
        </section>
        <section className="panel">
          <h2>Integraciones</h2>
          <table className="table">
            <tbody>
              {integrations.map(([k, on]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{on ? <span className="badge badge-verified">activa</span> : <span className="badge">sin configurar</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12 }}>
            Lo que no está configurado se desactiva de forma explícita: nunca se simula.
          </p>
        </section>
      </div>
    </>
  );
}
