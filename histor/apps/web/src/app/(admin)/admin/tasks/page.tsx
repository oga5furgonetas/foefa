import Link from 'next/link';
import { listReviewTasks } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton, ActionForm } from '@/components/admin/AdminClient';
import { When } from '@/components/admin/Bits';

export default async function Tasks({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const g = await adminGuard('reports.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const all = (await searchParams).all === '1';
  const tasks = await listReviewTasks(db(), all ? ['open', 'in_progress', 'done', 'dismissed'] : ['open', 'in_progress']);
  return (
    <>
      <h1>Tareas de revisión</h1>
      <p className="muted">
        Avisos de lectores, contradicciones tras publicar, caídas de confianza, fuentes que fallan, historias virales sin verificar y controles de calidad fallidos.{' '}
        <Link href={all ? '/admin/tasks' : '/admin/tasks?all=1'}>{all ? 'Solo abiertas' : 'Ver todas'}</Link>
      </p>
      {!tasks.length && <p>No hay tareas pendientes.</p>}
      {tasks.map((t) => (
        <section key={t.id} className="panel">
          <h2 style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="state">{t.kind}</span> <span className="tnum">P{t.priority}</span> {t.title}
          </h2>
          <p className="muted" style={{ margin: '0 0 6px' }}>
            <When d={t.createdAt} /> · {t.status}
            {t.storyId && (
              <>
                {' · '}
                <Link href={`/admin/stories/${t.storyId}`}>historia #{t.storyId}</Link>
              </>
            )}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: '0 0 8px' }}>{JSON.stringify(t.detail, null, 2)}</pre>
          {t.resolution && <p>Resolución: {t.resolution}</p>}
          {(t.status === 'open' || t.status === 'in_progress') && (
            <div style={{ display: 'grid', gap: 8 }}>
              {t.status === 'open' && <ActionButton action="task.resolve" body={{ id: t.id, status: 'in_progress' }} label="Me encargo" />}
              <ActionForm
                action="task.resolve"
                fixed={{ id: t.id }}
                inline
                fields={[
                  { name: 'status', label: 'Resultado', type: 'select', options: [{ value: 'done', label: 'Resuelta' }, { value: 'dismissed', label: 'Descartada' }], defaultValue: 'done' },
                  { name: 'resolution', label: 'Qué se hizo' },
                ]}
                submit="Cerrar"
              />
            </div>
          )}
        </section>
      ))}
    </>
  );
}
