import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '../../i18n'
import { useEscape } from '../../lib/useEscape'
import { crearAccesoConductor, quitarAccesoConductor } from '../api'
import {
  rutaRecordada, recordarRuta, olvidarRuta, enlaceCompleto, mensajeAcceso, urlWhatsApp, diaCorto, diaSello, codigoDe, textoConCodigo,
} from '../../lib/accesoConductor'

/* «MANDAR SU ACCESO» (14-11-2026, CONTRATO-ALTA §1.3–1.5 y §3.4). Lo usan el arranque de una flota (papel) y la lista
   de Conductores (dentro del panel), con el mismo comportamiento:
   · «Mandar por WhatsApp» crea el enlace y abre WhatsApp con el mensaje ya escrito, a su móvil o, sin móvil, sin
     destinatario. Lo manda el dueño desde su WhatsApp: el servidor no envía nada.
   · «Copiar enlace» crea el mismo enlace y lo copia.
   · Abierto ya en su teléfono: «Mandar uno nuevo», discreto, con la pista de cuándo hace falta («si dice que no le
     entra»: otro navegador, datos borrados, otro móvil). Confirma antes, porque el anterior deja de valer.
   · Los porqués del servidor, por su `codigo` y en el idioma del panel (tercera tanda, A8 y A11).
   La ventana de WhatsApp se abre EN el toque y se le pone la dirección cuando llega el enlace: abrirla después de
   esperar al servidor la bloquean los navegadores.
   Lo que hace (crear, mandar, copiar, renovar, anular) vive en `useAcceso`: la espera de la primera revisión lo usa
   para su «Mandar otra vez», sin repetir nada (cuarta tanda, C1). */

export const ESTADOS_ACCESO = {
  sin_enlace: 'alta.acc.sinEnlace',
  sin_abrir: 'alta.acc.sinAbrir',
  abierto: 'alta.acc.abierto',
  caducado: 'alta.acc.caducado',
}

/** «Abierto el 14 nov». Con `sello`, el día como el sello de las fotos («Abierto el 14 NOV»): así lo dicen el arranque
    y la ventana del acceso (cuarta tanda, C2 y C3); la lista de Conductores sigue con el de siempre. */
export function textoEstado(t, acceso, idioma = 'es', { sello = false } = {}) {
  const e = acceso?.estado || 'sin_enlace'
  const dia = sello ? diaSello(acceso?.abierto_dia, idioma) : diaCorto(acceso?.abierto_dia, idioma)
  return t(ESTADOS_ACCESO[e] || ESTADOS_ACCESO.sin_enlace).replace('{dia}', dia)
}

/* El estado va en mono, en su línea y con su color: gris sin mandar, tinta con el enlace creado, verde abierto y ámbar
   caducado (cuarta tanda, C3). */
const ESTILO = {
  papel: {
    estado: 'font-mono text-[13.5px] font-medium text-[color:var(--ld-muted)]',
    pendiente: 'font-mono text-[13.5px] font-medium text-[color:var(--ld-text)]',
    abierto: 'font-mono text-[13.5px] font-semibold text-[color:var(--ld-ok)]',
    caducado: 'font-mono text-[13.5px] font-semibold text-[color:var(--ld-mid)]',
    principal: 'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] bg-[color:var(--ld-text)] px-3.5 text-[14px] font-bold text-[color:var(--ld-bg)] disabled:opacity-60',
    secundario: 'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] border-[color:var(--ld-border-strong)] px-3.5 text-[14px] font-bold text-[color:var(--ld-text)] hover:border-[color:var(--ld-text)] disabled:opacity-60',
    enlace: 'inline-flex min-h-[40px] items-center text-[14px] font-semibold text-[color:var(--ld-muted)] underline-offset-4 hover:underline',
    discreto: 'inline-flex min-h-[40px] items-center text-[14px] font-semibold text-[color:var(--ld-text)] underline underline-offset-4 decoration-[color:var(--ld-border-strong)] hover:decoration-[color:var(--ld-text)] disabled:opacity-60',
    nota: 'text-[13px] text-[color:var(--ld-muted)]',
    error: 'text-[13.5px] font-semibold text-[color:var(--ld-warn)]',
    caja: 'w-full rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3 py-2 font-mono text-[12.5px] text-[color:var(--ld-text)]',
    confirmar: 'rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-3',
  },
  panel: {
    estado: 'font-mono text-[13px] font-medium text-dark-400',
    pendiente: 'font-mono text-[13px] font-medium text-dark-100',
    abierto: 'font-mono text-[13px] font-semibold text-emerald-300',
    caducado: 'font-mono text-[13px] font-semibold text-amber-300',
    principal: 'btn-primary inline-flex min-h-[40px] items-center justify-center px-3.5 text-[13.5px] disabled:opacity-60',
    secundario: 'btn-secondary inline-flex min-h-[40px] items-center justify-center px-3.5 text-[13.5px] disabled:opacity-60',
    enlace: 'inline-flex min-h-[40px] items-center text-[13px] font-semibold text-dark-400 hover:text-dark-200',
    discreto: 'inline-flex min-h-[40px] items-center text-[13px] font-semibold text-dark-100 underline underline-offset-4 decoration-dark-600 hover:decoration-dark-200 disabled:opacity-60',
    nota: 'text-[12.5px] text-dark-400',
    error: 'text-[13px] font-semibold text-red-300',
    caja: 'input w-full font-mono text-[12px]',
    confirmar: 'rounded-xl border border-dark-700 bg-dark-900 p-3',
  },
}

/** La clase del estado de un acceso, por variante («papel» o «panel»). */
export function claseDeEstado(estado, variante = 'papel') {
  const s = ESTILO[variante] || ESTILO.papel
  return estado === 'abierto' ? s.abierto : estado === 'caducado' ? s.caducado : estado === 'sin_abrir' ? s.pendiente : s.estado
}

/** Lo que se puede hacer con el enlace de un conductor. `c`: una fila de GET /conductores/accesos. */
export function useAcceso(c, empresa, onCambio) {
  const { t } = useT()
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState('')       // el mensaje del 409 «ya_abierto», mientras se decide
  const [copiado, setCopiado] = useState(false)
  const [aMano, setAMano] = useState('')               // el enlace, si el navegador no deja copiarlo solo
  const estado = c?.acceso?.estado || 'sin_enlace'
  const id = c?.driver_id

  /* El enlace que toca usar: el que se acaba de crear en esta pestaña si sigue sin abrir; si no, uno nuevo. */
  async function rutaParaMandar(renovar) {
    const recordada = !renovar && estado === 'sin_abrir' ? rutaRecordada(id) : null
    if (recordada) return recordada
    const r = await crearAccesoConductor(id, renovar)
    const ruta = r?.data?.ruta
    if (typeof ruta !== 'string' || !ruta.startsWith('/c')) throw new Error('respuesta')
    recordarRuta(id, ruta)
    if (r.data.acceso) onCambio?.(r.data.acceso)
    return ruta
  }

  function fallo(e) {
    const det = e?.response?.data
    const codigo = codigoDe(det)
    if (e?.response?.status === 409 && codigo === 'ya_abierto') {
      setConfirmar(t('alta.acc.yaAbierto'))
      return
    }
    if (!e?.response) setError(t('alta.err.red'))
    else setError(textoConCodigo(t, codigo, typeof det?.detail === 'string' && det.detail ? det.detail : t('alta.err.servidor'), { nombre: det?.dato || c?.nombre || '' }))
  }

  async function mandar(renovar = false) {
    setError(''); setConfirmar(''); setOcupado('wa')
    // La ventana, ya, dentro del toque; la dirección, cuando llegue el enlace.
    let ventana = null
    try { ventana = window.open('', '_blank') } catch { ventana = null }
    try {
      const ruta = await rutaParaMandar(renovar)
      const url = urlWhatsApp(c.whatsapp, mensajeAcceso(t, { nombre: c.nombre, empresa, enlace: enlaceCompleto(ruta) }))
      if (ventana && !ventana.closed) {
        try { ventana.opener = null } catch { /* da igual */ }
        ventana.location.href = url
      } else {
        window.location.assign(url)
      }
    } catch (e) {
      try { ventana?.close() } catch { /* ya cerrada */ }
      fallo(e)
    } finally { setOcupado('') }
  }

  async function copiar(renovar = false) {
    setError(''); setConfirmar(''); setAMano(''); setOcupado('copiar')
    try {
      const enlace = enlaceCompleto(await rutaParaMandar(renovar))
      try {
        await navigator.clipboard.writeText(enlace)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
      } catch {
        setAMano(enlace)   // sin permiso para copiar: se enseña para copiarlo a mano
      }
    } catch (e) { fallo(e) } finally { setOcupado('') }
  }

  async function renovar() {
    setError(''); setOcupado('renovar')
    try {
      await rutaParaMandar(false)   // si ya se abrió, el servidor contesta 409 «ya_abierto» y se pregunta
    } catch (e) { fallo(e) } finally { setOcupado('') }
  }

  async function confirmarRenovar() {
    setError(''); setOcupado('renovar')
    try {
      olvidarRuta(id)
      await rutaParaMandar(true)
      setConfirmar('')
    } catch (e) { fallo(e) } finally { setOcupado('') }
  }

  async function quitar() {
    setError(''); setConfirmar(''); setOcupado('quitar')
    try {
      const r = await quitarAccesoConductor(id)
      olvidarRuta(id)
      onCambio?.(r?.data?.acceso || { estado: 'sin_enlace', creado_dia: null, abierto_dia: null, caduca_dia: null })
    } catch (e) { fallo(e) } finally { setOcupado('') }
  }

  return {
    estado, id, ocupado, error, confirmar, setConfirmar, copiado, aMano,
    mandar, copiar, renovar, confirmarRenovar, quitar,
    sinAbrirOlvidado: estado === 'sin_abrir' && !rutaRecordada(id),
  }
}

/** El estado de su enlace y lo que se puede hacer con él. `c`: una fila de GET /conductores/accesos. */
export default function AccesoConductor({ c, empresa, onCambio, variante = 'papel', conQuitar = false }) {
  const { t, lang } = useT()
  const s = ESTILO[variante] || ESTILO.papel
  const a = useAcceso(c, empresa, onCambio)
  const { estado, id, ocupado } = a

  return (
    <div className="min-w-0" data-testid="acceso-conductor">
      <p className={claseDeEstado(estado, variante)} data-testid="acceso-estado" data-estado={estado}>{textoEstado(t, c?.acceso, lang, { sello: true })}</p>
      {a.confirmar ? (
        <div className={`mt-2 ${s.confirmar}`} role="alertdialog" aria-label={t('alta.acc.renovar')}>
          <p className={s.nota}>{a.confirmar}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={s.principal} disabled={!!ocupado} onClick={a.confirmarRenovar}>{t('alta.acc.renovarSi')}</button>
            <button type="button" className={s.secundario} disabled={!!ocupado} onClick={() => a.setConfirmar('')}>{t('alta.cancelar')}</button>
          </div>
        </div>
      ) : estado === 'abierto' ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" className={s.discreto} disabled={!!ocupado} onClick={a.renovar}>{t('alta.acc.renovar')}</button>
            {conQuitar && <button type="button" className={s.enlace} disabled={!!ocupado} onClick={a.quitar}>{t('alta.acc.quitar')}</button>}
          </div>
          <p className={`mt-1 ${s.nota}`} data-testid="acceso-pista">{t('alta.acc.noEntra')}</p>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={s.principal} disabled={!!ocupado} onClick={() => a.mandar(false)}>
              {ocupado === 'wa' ? t('alta.acc.creando') : t('alta.acc.whatsapp')}
            </button>
            <button type="button" className={s.secundario} disabled={!!ocupado} onClick={() => a.copiar(false)}>
              {a.copiado ? t('alta.acc.copiado') : t('alta.acc.copiar')}
            </button>
            {conQuitar && estado === 'sin_abrir' && (
              <button type="button" className={s.enlace} disabled={!!ocupado} onClick={a.quitar}>{t('alta.acc.quitar')}</button>
            )}
          </div>
          {!c?.whatsapp && <p className={`mt-1.5 ${s.nota}`}>{t('alta.acc.sinMovil')}</p>}
          {a.sinAbrirOlvidado && <p className={`mt-1.5 ${s.nota}`}>{t('alta.acc.otraVez')}</p>}
        </>
      )}
      {a.aMano && (
        <div className="mt-2">
          <label className={s.nota} htmlFor={`enlace-${id}`}>{t('alta.acc.copialoTu')}</label>
          <input id={`enlace-${id}`} readOnly value={a.aMano} onFocus={(e) => e.target.select()} className={`mt-1 ${s.caja}`} />
        </div>
      )}
      {a.error && <p role="alert" className={`mt-2 ${s.error}`}>{a.error}</p>}
    </div>
  )
}

/** La ficha corta del acceso, en una ventana sobre la lista de Conductores. */
export function DialogoAcceso({ c, empresa, onCambio, onCerrar }) {
  const { t } = useT()
  useEscape(onCerrar)
  const titulo = t('alta.acc.titulo').replace('{nombre}', c.nombre)
  /* Opaca y por ENCIMA de todo (tercera tanda, A11): con `.card` (medio transparente) se leía la lista a través, y dentro
     del contenido del panel la barra de abajo del móvil (z-40) y el botón del asistente (z-95) le tapaban la última
     línea y «Anular el enlace». Va a `body` con un portal, así ningún contexto de apilado de la página la deja debajo,
     y su borde de abajo respeta la zona segura del teléfono. */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={t('alta.acc.titulo').replace('{nombre}', c.nombre)}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-dark-700 bg-dark-900 p-5 shadow-2xl shadow-black/50 sm:rounded-2xl"
        style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Dentro (cuarta tanda, C3): el título a la altura de la X, centrado con ella; debajo, la explicación a todo el
            ancho; y el estado en mono, en su propia línea, tras una regla fina. */}
        <div className="-mr-2 -mt-1.5 flex min-h-[40px] items-center justify-between gap-3" data-testid="acceso-cabecera">
          <h2 className="min-w-0 text-[17px] font-semibold leading-snug text-dark-50">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label={t('alta.cerrar')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-dark-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dark-400">{t('alta.acc.explica')}</p>
        <div className="mt-4 border-t border-dark-800 pt-4">
          <AccesoConductor c={c} empresa={empresa} onCambio={onCambio} variante="panel" conQuitar />
        </div>
      </div>
    </div>,
    document.body,
  )
}
