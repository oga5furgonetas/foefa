import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getDrivers } from '../api'
import { lista } from '../../lib/lista'
import { DIAS_AVISO_CARNET, diasHastaCarnet, fechaCarnet, textoDiasCarnet } from '../../lib/carnet'

/* CARNETS QUE CADUCAN (11-11-2026, tanda 3, historia-10). Un conductor con el carnet caducado al volante es un riesgo
   del que responde la empresa, y nada lo avisaba: la ficha ni siquiera pedía la fecha. Aquí, de las fichas activas de
   la nave elegida, las caducadas y las que caducan en 30 días o menos, por fecha. Debajo, cuántas no tienen fecha. */

export default function CarnetsConductores() {
  const { center } = useOutletContext() || {}
  const [fichas, setFichas] = useState(null)

  useEffect(() => {
    setFichas(null)
    getDrivers(center).then((r) => setFichas(lista(r.data))).catch(() => setFichas([]))
  }, [center])

  if (!fichas) {
    return <div className="flex items-center gap-2 py-10 text-dark-400"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  }

  const conFecha = fichas.map((d) => ({ d, n: diasHastaCarnet(d.license_expiry) })).filter((x) => x.n !== null)
  const avisar = conFecha.filter((x) => x.n <= DIAS_AVISO_CARNET).sort((a, b) => a.n - b.n)
  const sinFecha = fichas.length - conFecha.length

  return (
    <div className="space-y-3">
      {!conFecha.length ? (
        <div className="rounded-xl border border-dashed border-dark-700 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-dark-200">Todavía no hay ninguna fecha de caducidad de carnet puesta.</p>
          <p className="mt-1 text-[12.5px] text-dark-400">
            Ponla en la ficha de cada conductor («Editar» → «Carnet caduca el») y aquí saldrán los que caducan pronto.
          </p>
        </div>
      ) : !avisar.length ? (
        <p className="rounded-xl border border-dark-800 px-4 py-3 text-[13px] text-dark-300">
          Ningún carnet caducado ni que caduque en los próximos {DIAS_AVISO_CARNET} días.
        </p>
      ) : (
        <div className="card overflow-hidden">
          <p className="border-b border-dark-800 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-dark-300">
            Caducados o a {DIAS_AVISO_CARNET} días <span className="cifra font-normal text-dark-500">{avisar.length}</span>
          </p>
          <ul className="divide-y divide-dark-800/60">
            {avisar.map(({ d, n }) => (
              <li key={d.id} data-testid="carnet-fila">
                <Link to={`/panel/conductores?open=${encodeURIComponent(d.id)}`}
                  className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-0.5 px-3.5 py-2 hover:bg-dark-800/40">
                  <span className="w-full min-w-0 font-medium text-dark-100 sm:w-auto sm:flex-1">{d.name}</span>
                  {d.center && <span className="text-[12px] text-dark-500">{d.center}</span>}
                  <span className="cifra text-[12px] text-dark-400">{fechaCarnet(d.license_expiry)}</span>
                  <span data-testid="carnet-dias"
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${n < 0 ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {textoDiasCarnet(n)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sinFecha > 0 && (
        <p className="text-[12px] text-dark-500">
          {sinFecha} {sinFecha === 1 ? 'ficha sin' : 'fichas sin'} fecha de caducidad del carnet ·{' '}
          <Link to="/panel/conductores" className="font-semibold text-brand-400 hover:text-brand-300">Ir a Conductores</Link>
        </p>
      )}
    </div>
  )
}
