import Link from 'next/link';
import { STORY_FLAGS, STORY_STATES } from '@histor/core/domain';
import { demoMode } from '@histor/core/services/content';
import { listStories } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { Bar, When } from '@/components/admin/Bits';

type SP = Promise<{ state?: string; q?: string; flag?: string; page?: string }>;

export default async function Stories({ searchParams }: { searchParams: SP }) {
  const g = await adminGuard();
  if (!g.ok) return <GuardBlock g={g} />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await listStories(db(), { state: sp.state || undefined, q: sp.q || undefined, flag: sp.flag || undefined, demo: demoMode(), limit: 50, offset: (page - 1) * 50 });
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.state ? { state: sp.state } : {}), ...(sp.q ? { q: sp.q } : {}), ...(sp.flag ? { flag: sp.flag } : {}), page: String(p) })}`;
  return (
    <>
      <h1>Historias</h1>
      <form className="form" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: 'none', alignItems: 'end', marginBottom: 14 }}>
        <label>
          Buscar
          <input name="q" defaultValue={sp.q} />
        </label>
        <label>
          Estado
          <select name="state" defaultValue={sp.state ?? ''}>
            <option value="">Todos</option>
            {STORY_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Señal
          <select name="flag" defaultValue={sp.flag ?? ''}>
            <option value="">Todas</option>
            {STORY_FLAGS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-small btn-solid">Filtrar</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Historia</th>
              <th>Estado</th>
              <th style={{ minWidth: 110 }}>Confianza</th>
              <th style={{ minWidth: 110 }}>Impulso</th>
              <th>Fuentes ind.</th>
              <th>Piezas</th>
              <th>Señales</th>
              <th>Última pieza</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/stories/${s.id}`}>{s.headline.slice(0, 110)}</Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {s.categoryId ?? '—'} · {s.countryCode ?? '—'}
                    {s.isDemo && ' · DEMO'}
                  </div>
                </td>
                <td>
                  <span className={`state state-${s.state}`}>{s.state}</span>
                </td>
                <td>
                  <Bar v={s.confidence} />
                </td>
                <td>
                  <Bar v={s.momentum} mom />
                </td>
                <td>{s.independent}</td>
                <td>{s.items}</td>
                <td style={{ fontSize: 12 }}>{s.flags.join(', ')}</td>
                <td>
                  <When d={s.lastItemAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="row" style={{ display: 'flex', gap: 8 }}>
        {page > 1 && (
          <Link className="btn btn-small" href={qs(page - 1)}>
            ← Anterior
          </Link>
        )}
        {rows.length === 50 && (
          <Link className="btn btn-small" href={qs(page + 1)}>
            Siguiente →
          </Link>
        )}
      </p>
    </>
  );
}
