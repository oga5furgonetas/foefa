import { useEffect, useState } from 'react'
import { Loader2, MapPin, Clock, Euro, ChevronRight, AlertTriangle, Briefcase } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { tx, useIdioma } from '../lib/idioma'

/* EL TABLÓN DE EMPLEO DENTRO DE LA APP (21-10-2026). Dani: «lo de flotadsp.com/empleo déjalo visible en
   la app, pon una pestaña que ponga empleo para que les salga el tablón». Son las mismas ofertas que
   /empleo (GET /empleo/publicas, sin sesión: la lista blanca de campos que ya ve cualquiera desde
   Google), con el aspecto de la app. Tocar una abre su página de siempre, donde se apunta.
   La tarjeta va sin el resumen: título, ciudad, jornada y sueldo bastan para decidir, y la descripción
   entera (que es texto libre de la oficina) se lee dentro de la oferta.
   Solo sale en cuentas de España: los trabajos son en Galicia (RutaApp decide si hay pestaña). */

export default function EmpleoRuta() {
  useIdioma()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`${API_BASE}/empleo/publicas`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (vivo) setD(j) })
      .catch(() => { if (vivo) setErr(true) })
    return () => { vivo = false }
  }, [])

  const ofertas = d?.ofertas || []
  return (
    <div className="mx-auto max-w-md">
      <header className="mb-4">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-brand-300">
          <Briefcase size={15} /> {tx('Empleo')}
        </p>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-tight text-dark-50">{tx('Ofertas de trabajo de reparto')}</h1>
        <p className="mt-1.5 text-[13.5px] leading-snug text-dark-400">
          {tx('Reparto de paquetería en Galicia: la furgoneta la pone la empresa, el turno es fijo y se entra en equipo.')}
        </p>
      </header>

      {!d && !err && (
        <p className="flex items-center gap-2 py-10 text-[14px] text-dark-400"><Loader2 size={16} className="animate-spin" /> {tx('Cargando ofertas…')}</p>
      )}
      {err && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-[14px] text-amber-200">
          <AlertTriangle size={16} className="shrink-0" /> {tx('No se han podido cargar las ofertas. Prueba otra vez en un minuto.')}
        </p>
      )}

      {d && (
        <ul className="space-y-2.5">
          {ofertas.map((o) => (
            <li key={o.slug}>
              <a href={o.url} onClick={() => medirAccion('ruta_empleo_oferta')}
                className="block rounded-2xl border border-dark-700 bg-dark-900 p-4 transition-colors active:bg-dark-800">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] font-bold leading-snug text-dark-50">{o.titulo}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold text-dark-200">
                      {o.ciudad && <span className="inline-flex items-center gap-1 rounded-lg bg-dark-800 px-2 py-1"><MapPin size={12} className="text-brand-300" /> {o.ciudad}</span>}
                      {o.jornada && <span className="inline-flex items-center gap-1 rounded-lg bg-dark-800 px-2 py-1"><Clock size={12} className="text-brand-300" /> {o.jornada}</span>}
                      {o.salario && <span className="inline-flex items-center gap-1 rounded-lg bg-dark-800 px-2 py-1"><Euro size={12} className="text-brand-300" /> {o.salario}</span>}
                    </div>
                    <p className="mt-2.5 text-[13.5px] font-bold text-brand-300">{tx('Ver la oferta y apuntarme')}</p>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-dark-500" />
                </div>
              </a>
            </li>
          ))}
          {!ofertas.length && (
            <li className="rounded-2xl border border-dark-700 bg-dark-900 p-6 text-center">
              <p className="text-[14.5px] font-semibold text-dark-100">{tx('Ahora mismo no hay ninguna oferta abierta.')}</p>
              <p className="mt-1 text-[13px] text-dark-400">{tx('Vuelve a mirar en unos días: se abren a menudo.')}</p>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
