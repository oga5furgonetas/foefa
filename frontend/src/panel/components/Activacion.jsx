import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ArrowRight, X } from 'lucide-react'
import { getOnboarding } from '../api'
import { useT } from '../../i18n'

/* ── Guía de activación, POR SEDE ──────────────────────────────────────────
   Vive DENTRO del panel, se puede ignorar y desaparece sola cuando todo está
   hecho. El estado sale de datos REALES del servidor (cuántas furgonetas,
   conductores y revisiones hay), nunca de una marca guardada.

   Desde el 14-11-2026 los tres pasos de la empresa (furgonetas, conductores,
   primera revisión) los lleva el arranque (/panel/arranque, con su entrada
   en el inicio: EntradaArranque). Aquí queda solo lo de cada sede, que es lo
   que usan las empresas con varias naves, y sale cuando esos tres ya están. */

/* ── Cada sede, por separado ───────────────────────────────────────────────
   La guia daba la empresa por lista con una furgoneta, un conductor y una
   auditoria EN TOTAL, aunque una de sus sedes no tuviera nada. Cada sede
   enseña lo que tiene medido con sus datos (el backend lo cuenta) y, si le
   falta algo, la accion concreta con su enlace. Lo recomendado se ve, pero no
   deja la guia abierta.

   OJO: cada paso que devuelve el backend TIENE que estar aqui. Los que no
   estan se filtran, y un paso obligatorio filtrado deja la sede «sin
   terminar» sin decir que le falta (paso con la inspeccion, 25-09-2026). */
const PASO_NAVE = {
  vehiculos:   { tit: 'ob.n.vehiculos',   falta: 'ob.n.falta.vehiculos',   to: '/panel/importaciones?t=furgonetas' },
  conductores: { tit: 'ob.n.conductores', falta: 'ob.n.falta.conductores', to: '/panel/importaciones?t=conductores' },
  inspeccion:  { tit: 'ob.n.inspeccion',  falta: 'ob.n.falta.inspeccion',  to: '/panel/conductores' },
  talleres:    { tit: 'ob.n.talleres',    falta: 'ob.n.falta.talleres',    to: '/panel/talleres' },
  turnos:      { tit: 'ob.n.turnos',      falta: 'ob.n.falta.turnos',      to: '/panel/turnos' },
}

function Nave({ nave, t, basicosArriba }) {
  // Con los pasos de la empresa aun pendientes, furgonetas y conductores ya
  // se piden arriba: repetirlos en la nave es decir lo mismo dos veces.
  const pasos = (nave.pasos || []).filter((p) => PASO_NAVE[p.id]
    && !(basicosArriba && (p.id === 'vehiculos' || p.id === 'conductores')))
  const pendiente = pasos.find((p) => !p.hecho && !p.opcional) || (nave.completa ? null : pasos.find((p) => !p.hecho))
  return (
    <li className="border-b border-dark-800 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[14px] font-semibold text-dark-50">{nave.centro}</span>
        {nave.completa && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ruta-ok-texto"><Check size={13} />{t('ob.nave.lista')}</span>
        )}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1">
          {pasos.map((p) => (
            <span key={p.id} title={p.opcional ? t('ob.n.recomendado') : undefined}
              className={`inline-flex items-center gap-1 text-[12.5px] ${
                p.hecho ? 'text-dark-300'
                  : p.opcional ? 'text-dark-500'
                    : 'font-semibold text-ruta-aviso-texto'}`}>
              {p.hecho ? <Check size={12} className="text-ruta-ok-texto" /> : <X size={12} />}
              {t(PASO_NAVE[p.id].tit)}
              {p.hecho && p.n > 0 && <span className="font-mono tabular-nums text-dark-500">{p.n}</span>}
            </span>
          ))}
        </div>
      </div>
      {pendiente && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-dark-300">
          {t(PASO_NAVE[pendiente.id].falta)}{' '}
          <Link to={PASO_NAVE[pendiente.id].to} className="inline-flex items-center gap-1 font-semibold text-dark-50 underline underline-offset-4">
            {t('ob.n.ir')} <ArrowRight size={11} />
          </Link>
        </p>
      )}
    </li>
  )
}

export default function Activacion() {
  const { t } = useT()
  const [data, setData] = useState(null)
  // Se puede esconder, pero NO se marca nada como hecho: si mañana faltan
  // datos de verdad, la guía vuelve al reabrir sesión en otro equipo.
  const [oculto, setOculto] = useState(() => sessionStorage.getItem('ob_oculto') === '1')

  useEffect(() => {
    let vivo = true
    getOnboarding().then((r) => { if (vivo) setData(r.data) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  // Silencio absoluto si aún no sabemos, si ya está todo hecho o si lo ocultó.
  if (!data || data.completo || oculto) return null

  const naves = Array.isArray(data.naves) ? data.naves : []
  const navesListas = naves.filter((n) => n.completa).length
  // Mientras falte alguno de los pasos de la empresa, lo lleva el arranque: aquí, solo las naves.
  if (data.hechos !== data.total || naves.length === 0) return null
  const pct = Math.round((navesListas / naves.length) * 100)
  // Primero las que tienen algo pendiente: es lo que hay que mirar.
  const navesOrden = [...naves].sort((a, b) => Number(a.completa) - Number(b.completa)
    || String(a.centro).localeCompare(String(b.centro), 'es', { sensitivity: 'base' }))

  return (
    <section className="mb-8 border-t border-dark-700 pt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{t('ob.naves.tit')}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-dark-400">{t('ob.naves.sub')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-[15px] font-semibold tabular-nums text-dark-50">
              {`${navesListas}/${naves.length}`}
            </p>
            <p className="text-[11.5px] text-dark-500">{t('ob.naves.progreso')}</p>
          </div>
          <button onClick={() => { sessionStorage.setItem('ob_oculto', '1'); setOculto(true) }}
            title={t('ob.ocultar')} aria-label={t('ob.ocultar')}
            className="rounded-lg p-1.5 text-dark-500 transition hover:bg-white/[0.05] hover:text-dark-300">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="mb-1 h-1 overflow-hidden rounded-full bg-dark-800">
        <div className="h-full bg-dark-50"
          style={{ width: `${pct}%` }} />
      </div>

      <ul className="border-t border-dark-800">
        {navesOrden.map((n) => <Nave key={n.centro} nave={n} t={t} basicosArriba={false} />)}
      </ul>
    </section>
  )
}
