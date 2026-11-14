import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useT } from '../../i18n'
import { getAltaEstado } from '../api'
import { datosDeSesion } from '../../services/api'
import Matricula from '../../components/Matricula'
import { diaSello } from '../../lib/accesoConductor'
import { selloDeFecha } from '../../lib/sello'

/* «SIGUE CON EL ARRANQUE» EN EL INICIO (14-11-2026, CONTRATO-ALTA §0.15 y §3). Mientras falte algún paso (lo dice
   GET /alta/estado, con los datos de verdad, sin marcas guardadas) el inicio lleva al arranque, al paso en que se
   quedó. Se vuelve a preguntar cada 30 s mientras la pestaña se ve: así, si la primera revisión llega con el inicio
   abierto, se entera sin recargar. Un servidor sin la ruta (404) o una empresa que ya va sola: no sale nada.
   NO PREGUNTA PARA SIEMPRE (14-11-2026, tercera tanda, A12): en cuanto el arranque está completo (hay furgonetas,
   conductores y una primera revisión: `paso_actual` null) se deja de preguntar y se apunta en este navegador, para esa
   empresa y esa persona; desde entonces el inicio ni siquiera pregunta. Antes, todas las empresas, también las que llevan
   meses funcionando, lo preguntaban cada 30 s con cada inicio abierto. */

const PASOS = ['alta.p1.titulo', 'alta.p2.titulo', 'alta.p3.titulo', 'alta.p4.titulo']
const CADA_MS = 30000
const HECHO = 'fds_arranque_hecho'

/** Quién mira: la empresa y la persona de la sesión del panel ('' si no se sabe). */
function quienMira() {
  try {
    const p = datosDeSesion(localStorage.getItem('flota_token'))
    return p?.sub ? `${p.org_id || '-'}:${p.sub}` : ''
  } catch { return '' }
}
const apuntados = () => { try { return (localStorage.getItem(HECHO) || '').split(' ').filter(Boolean) } catch { return [] } }
export const arranqueYaHecho = (quien = quienMira()) => !!quien && apuntados().includes(quien)
function apuntarHecho(quien) {
  if (!quien || apuntados().includes(quien)) return
  // Los últimos 20 bastan: es un navegador, no una base de datos.
  try { localStorage.setItem(HECHO, [...apuntados(), quien].slice(-20).join(' ')) } catch { /* sin almacén: preguntará la próxima vez */ }
}

export default function EntradaArranque() {
  const { t, lang } = useT()
  const [estado, setEstado] = useState(null)
  const [llego, setLlego] = useState(null)   // la revisión que ha llegado con esta pantalla abierta
  const pendiente = useRef(false)

  useEffect(() => {
    const quien = quienMira()
    if (arranqueYaHecho(quien)) return undefined
    let vivo = true
    let id = null
    const parar = () => {
      if (id) clearInterval(id)
      id = null
      document.removeEventListener('visibilitychange', mirar)
    }
    function mirar() {
      if (!vivo || document.visibilityState !== 'visible') return
      getAltaEstado().then((r) => {
        const d = r?.data
        if (!vivo || !d || !Array.isArray(d.pasos)) return
        if (pendiente.current && d.paso_actual == null && d.revision) setLlego(d.revision)
        pendiente.current = d.paso_actual != null
        setEstado(d)
        // Completo: no se vuelve a preguntar, ni ahora ni la próxima vez que se abra el inicio.
        if (d.paso_actual == null) { apuntarHecho(quien); parar() }
      }).catch(() => {})
    }
    mirar()
    id = setInterval(mirar, CADA_MS)
    document.addEventListener('visibilitychange', mirar)
    return () => { vivo = false; parar() }
  }, [])

  if (llego) {
    return (
      <section role="status" data-testid="inicio-llego-revision"
        className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-dark-50">{t('alta.p4.llego')}</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dark-300">
            {llego.furgoneta?.matricula && <Matricula texto={llego.furgoneta.matricula} className="text-[13px]" />}
            <span>{t('alta.p4.recibidaEn')} · <span className="font-mono tabular-nums">{selloDeFecha(llego.recibida_at, { idioma: lang }) || [diaSello(llego.dia, lang, { anio: true }), llego.hora].filter(Boolean).join(' · ')}</span></span>
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
      className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4 sm:p-5">
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
