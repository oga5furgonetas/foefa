import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useT } from '../../i18n'
import { getAltaEstado } from '../api'
import Matricula from '../../components/Matricula'
import { diaCorto } from '../../lib/accesoConductor'

/* «SIGUE CON EL ARRANQUE» EN EL INICIO (14-11-2026, CONTRATO-ALTA §0.15 y §3). Mientras falte algún paso (lo dice
   GET /alta/estado, con los datos de verdad, sin marcas guardadas) el inicio lleva al arranque, al paso en que se
   quedó. Se vuelve a preguntar cada 30 s mientras la pestaña se ve: así, si la primera revisión llega con el inicio
   abierto, se entera sin recargar. Un servidor sin la ruta (404) o una empresa que ya va sola: no sale nada. */

const PASOS = ['alta.p1.titulo', 'alta.p2.titulo', 'alta.p3.titulo', 'alta.p4.titulo']
const CADA_MS = 30000

export default function EntradaArranque() {
  const { t } = useT()
  const [estado, setEstado] = useState(null)
  const [llego, setLlego] = useState(null)   // la revisión que ha llegado con esta pantalla abierta
  const pendiente = useRef(false)

  useEffect(() => {
    let vivo = true
    const mirar = () => {
      if (document.visibilityState !== 'visible') return
      getAltaEstado().then((r) => {
        const d = r?.data
        if (!vivo || !d || !Array.isArray(d.pasos)) return
        if (pendiente.current && d.paso_actual == null && d.revision) setLlego(d.revision)
        pendiente.current = d.paso_actual != null
        setEstado(d)
      }).catch(() => {})
    }
    mirar()
    const id = setInterval(mirar, CADA_MS)
    document.addEventListener('visibilitychange', mirar)
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', mirar) }
  }, [])

  if (llego) {
    return (
      <section role="status" data-testid="inicio-llego-revision"
        className="rise mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-dark-50">{t('alta.p4.llego')}</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dark-300">
            {llego.furgoneta?.matricula && <Matricula texto={llego.furgoneta.matricula} className="text-[13px]" />}
            <span>{t('alta.p4.recibida').replace('{dia}', diaCorto(llego.dia)).replace('{hora}', llego.hora || '')}</span>
          </p>
        </div>
        <Link to="/panel/repaso" className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-4 text-[14px]">
          {t('alta.p4.repasarla')} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    )
  }
  if (!estado || estado.paso_actual == null) return null
  const n = Math.min(4, Math.max(1, Number(estado.paso_actual) || 1))
  return (
    <section data-testid="inicio-arranque"
      className="rise mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-dark-50">{t('alta.inicio.titulo').replace('{n}', n)}</h2>
        <p className="mt-1 text-[13px] text-dark-400">{t('alta.inicio.ahora').replace('{paso}', t(PASOS[n - 1]))}</p>
      </div>
      <Link to="/panel/arranque" className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-4 text-[14px]">
        {t('alta.inicio.seguir')} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  )
}
