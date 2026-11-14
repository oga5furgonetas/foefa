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

/* `onEnCurso(sí/no)`: le dice al Inicio si el arranque está a medias (14-11-2026, ARREGLOS-5 I5). Mientras lo está, el
   Inicio es SOLO esto: ni atajos a cero ni «Todavía no hay flota». Un servidor sin la ruta o un fallo cuentan como «no». */
export default function EntradaArranque({ onEnCurso } = {}) {
  const { t, lang } = useT()
  const [estado, setEstado] = useState(null)
  const [llego, setLlego] = useState(null)   // la revisión que ha llegado con esta pantalla abierta
  const pendiente = useRef(false)
  const aviso = useRef(onEnCurso)
  aviso.current = onEnCurso

  useEffect(() => {
    const quien = quienMira()
    const avisar = (enCurso) => { if (typeof aviso.current === 'function') aviso.current(enCurso) }
    if (arranqueYaHecho(quien)) { avisar(false); return undefined }
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
        if (!vivo) return
        if (!d || !Array.isArray(d.pasos)) { avisar(false); return }
        if (pendiente.current && d.paso_actual == null && d.revision) setLlego(d.revision)
        pendiente.current = d.paso_actual != null
        setEstado(d)
        avisar(d.paso_actual != null)
        // Completo: no se vuelve a preguntar, ni ahora ni la próxima vez que se abra el inicio.
        if (d.paso_actual == null) { apuntarHecho(quien); parar() }
      }).catch(() => { if (vivo) avisar(false) })
    }
    mirar()
    id = setInterval(mirar, CADA_MS)
    document.addEventListener('visibilitychange', mirar)
    return () => { vivo = false; parar() }
  }, [])

  if (llego) {
    return (
      // Una línea con regla, como el Repaso del Inicio: la matrícula como pieza, el sello en mono y su botón.
      <section role="status" data-testid="inicio-llego-revision"
        className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-y border-dark-700 py-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{t('alta.p4.llego')}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-dark-400">
            {llego.furgoneta?.matricula && <Matricula texto={llego.furgoneta.matricula} className="text-[13px]" />}
            <span>{t('alta.p4.recibidaEn')} · <span className="font-mono tabular-nums text-dark-200">{selloDeFecha(llego.recibida_at, { idioma: lang }) || [diaSello(llego.dia, lang, { anio: true }), llego.hora].filter(Boolean).join(' · ')}</span></span>
          </p>
        </div>
        <Link to="/panel/repaso" className="btn-primary inline-flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl px-6 text-[15px] font-bold sm:w-auto">
          {t('alta.p4.repasarla')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    )
  }
  if (!estado || estado.paso_actual == null) return null
  const n = Math.min(4, Math.max(1, Number(estado.paso_actual) || 1))
  const pasos = Array.isArray(estado.pasos) ? estado.pasos : []
  /* LA EMPRESA RECIÉN DADA DE ALTA (I5): el Inicio es solo esto. El título dice en qué paso va; debajo, los cuatro
     pasos en una lista con reglas (los hechos, en gris con «Hecho»; el de ahora, en tinta; los que faltan, apagados);
     UN botón; y una línea tranquila de lo que vendrá. Sin caja, sin icono. */
  return (
    <section data-testid="inicio-arranque" className="max-w-2xl border-t border-dark-700 pt-7">
      <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-dark-50 sm:text-[28px]">
        {t('alta.inicio.titulo').replace('{n}', n)}
      </h2>
      <p className="mt-2 text-[15.5px] text-dark-300">{t('alta.inicio.ahora').replace('{paso}', t(PASOS[n - 1]))}</p>
      <ol className="mt-6 border-t border-dark-800">
        {PASOS.map((clave, i) => {
          const hecho = !!pasos[i]?.hecho
          const ahora = i === n - 1
          return (
            <li key={clave} aria-current={ahora ? 'step' : undefined}
              className="flex min-h-[48px] items-center gap-4 border-b border-dark-800 py-2.5">
              <span className={`w-6 shrink-0 font-mono text-[13px] tabular-nums ${ahora ? 'text-dark-50' : 'text-dark-500'}`}>{String(i + 1).padStart(2, '0')}</span>
              <span className={`min-w-0 flex-1 text-[15px] ${ahora ? 'font-bold text-dark-50' : hecho ? 'text-dark-300' : 'text-dark-500'}`}>{t(clave)}</span>
              {hecho && <span className="shrink-0 text-[13px] font-semibold text-ruta-ok-texto">{t('alta.hecho')}</span>}
              {ahora && !hecho && <span className="shrink-0 text-[13px] font-semibold text-dark-50">{t('alta.inicio.ahoraCorto')}</span>}
            </li>
          )
        })}
      </ol>
      <Link to="/panel/arranque" className="btn-primary mt-7 inline-flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl px-7 text-[15px] font-bold sm:w-auto">
        {t('alta.inicio.seguir')} <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <p className="mt-10 text-[14px] text-dark-400">{t('alta.inicio.calma')}</p>
    </section>
  )
}
