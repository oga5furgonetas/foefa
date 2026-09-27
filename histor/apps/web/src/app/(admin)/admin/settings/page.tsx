import { getEditorialSettings, getSourceTypeWeights } from '@histor/core/services/settings';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionForm } from '@/components/admin/AdminClient';

const LABELS: Record<string, string> = {
  verifiedMin: 'Confianza mínima para publicar como verificada',
  developingMin: 'Confianza mínima para publicar «en desarrollo» (con atribución)',
  minIndependentVerified: 'Fuentes independientes mínimas para «verificada»',
  clusterThreshold: 'Similitud mínima para agrupar en la misma historia',
  copyThreshold: 'Similitud a partir de la cual una pieza es copia',
  maxVerbatimWords: 'Máximo de palabras literales seguidas de una fuente',
  maxSourceOverlap: 'Solapamiento máximo con una fuente',
  breakingMomentum: 'Impulso para marcar «última hora» (solo si ya es publicable)',
  alertMinConfidence: 'Confianza mínima para alertas push',
  alertMinImportance: 'Importancia mínima para alertas push',
  minIndependentDeveloping: 'Fuentes independientes mínimas para «en desarrollo»',
  primaryOfficialSelfSufficient: 'La fuente oficial primaria que produce el dato basta por sí sola',
  retractBelow: 'Retirar si la confianza cae por debajo de',
  staleDays: 'Días sin novedades para cerrar una historia',
  investigationTtlHours: 'Horas máximas investigando antes de descartar',
  autoPublish: 'Publicación automática (si no, todo queda retenido para revisión)',
  autoSocial: 'Publicar en redes automáticamente (solo verificadas)',
  autoAlerts: 'Enviar alertas automáticamente',
};

export default async function Settings() {
  const g = await adminGuard('settings.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const s = await getEditorialSettings(db());
  const w = await getSourceTypeWeights(db());
  const numeric = Object.entries(s).filter(([, v]) => typeof v === 'number') as [string, number][];
  const flags = Object.entries(s).filter(([, v]) => typeof v === 'boolean') as [string, boolean][];
  return (
    <>
      <h1>Umbrales y pesos</h1>
      <p className="muted">Cada cambio queda en el registro de auditoría. Subir un umbral hace el periódico más prudente; bajarlo, más rápido. La verdad va antes que la velocidad.</p>
      <section className="panel">
        <h2>Umbrales editoriales</h2>
        <ActionForm
          action="settings.editorial"
          fields={[
            { name: 'publishLanguages', label: 'Idiomas de publicación (separados por comas)', defaultValue: s.publishLanguages.join(',') },
            ...numeric.map(([k, v]) => ({ name: k, label: LABELS[k] ?? k, type: 'number' as const, defaultValue: v, step: Number.isInteger(v) ? 1 : 0.01 })),
            ...flags.map(([k, v]) => ({ name: k, label: LABELS[k] ?? k, type: 'checkbox' as const, defaultValue: v })),
          ]}
          submit="Guardar umbrales"
        />
      </section>
      <section className="panel">
        <h2>Peso de cada tipo de fuente</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          <code>weight</code> (0-1) es cuánto aporta a la confianza; <code>credible</code> indica si cuenta como fuente independiente creíble. Redes sociales, contenido de usuarios, anónimos, agregadores y no verificables no pueden ser creíbles.
        </p>
        <ActionForm action="settings.weights" fields={[{ name: 'weights', label: 'Pesos (JSON)', type: 'json', defaultValue: JSON.stringify(w, null, 2) }]} submit="Guardar pesos" />
      </section>
    </>
  );
}
