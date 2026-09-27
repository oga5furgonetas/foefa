import { categories, languages } from '@histor/core/db/schema';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionButton, ActionForm } from '@/components/admin/AdminClient';

export default async function Taxonomy() {
  const g = await adminGuard('categories.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const cats = await db().select().from(categories).orderBy(categories.sort);
  const langs = await db().select().from(languages).orderBy(languages.sort);
  return (
    <>
      <h1>Secciones e idiomas</h1>
      <section className="panel">
        <h2>Idiomas</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Para añadir un idioma nuevo: textos en <code>i18n/dictionaries.ts</code>, palabras de ruta en <code>i18n/routes.ts</code>, frases de redacción en <code>writing/phrases.ts</code> y activarlo en <code>config/languages.ts</code>. Aquí se activa o pausa la publicación.
        </p>
        <table className="table">
          <tbody>
            {langs.map((l) => (
              <tr key={l.code}>
                <td>
                  <strong>{l.code}</strong> {l.nativeName}
                </td>
                <td>{l.enabled ? <span className="badge badge-verified">activo</span> : <span className="badge">inactivo</span>}</td>
                <td>
                  <ActionButton action="language.enabled" body={{ code: l.code, enabled: !l.enabled }} label={l.enabled ? 'Desactivar' : 'Activar'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Secciones</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sección</th>
                <th>Estado</th>
                <th>Orden y palabras clave</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.id}</strong>
                    <div className="muted">{(c.names as Record<string, string>).es}</div>
                  </td>
                  <td>
                    <ActionButton action="category.update" body={{ id: c.id, enabled: !c.enabled }} label={c.enabled ? 'Activa · desactivar' : 'Inactiva · activar'} />
                  </td>
                  <td>
                    <details>
                      <summary style={{ fontSize: 12 }}>Editar</summary>
                      <ActionForm
                        action="category.update"
                        fixed={{ id: c.id }}
                        fields={[
                          { name: 'sort', label: 'Orden', type: 'number', defaultValue: c.sort },
                          { name: 'keywords', label: 'Palabras clave por idioma (JSON)', type: 'json', defaultValue: JSON.stringify(c.keywords, null, 1) },
                        ]}
                        submit="Guardar"
                      />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
