import { useState } from 'react'
import { X } from 'lucide-react'
import { useT } from '../../i18n'
import { useEscape } from '../../lib/useEscape'
import { crearAccesoConductor, quitarAccesoConductor } from '../api'
import {
  rutaRecordada, recordarRuta, olvidarRuta, enlaceCompleto, mensajeAcceso, urlWhatsApp, diaCorto,
} from '../../lib/accesoConductor'

/* «MANDAR SU ACCESO» (14-11-2026, CONTRATO-ALTA §1.3–1.5 y §3.4). Lo usan el arranque de una flota (papel) y la lista
   de Conductores (dentro del panel), con el mismo comportamiento:
   · «Mandar por WhatsApp» crea el enlace y abre WhatsApp con el mensaje ya escrito, a su móvil o, sin móvil, sin
     destinatario. Lo manda el dueño desde su WhatsApp: el servidor no envía nada.
   · «Copiar enlace» crea el mismo enlace y lo copia.
   · Abierto ya en su teléfono: solo «Renovar», que confirma con lo que dice el servidor (el anterior deja de valer).
   La ventana de WhatsApp se abre EN el toque y se le pone la dirección cuando llega el enlace: abrirla después de
   esperar al servidor la bloquean los navegadores. */

export const ESTADOS_ACCESO = {
  sin_enlace: 'alta.acc.sinEnlace',
  sin_abrir: 'alta.acc.sinAbrir',
  abierto: 'alta.acc.abierto',
  caducado: 'alta.acc.caducado',
}

export function textoEstado(t, acceso) {
  const e = acceso?.estado || 'sin_enlace'
  return t(ESTADOS_ACCESO[e] || ESTADOS_ACCESO.sin_enlace).replace('{dia}', diaCorto(acceso?.abierto_dia))
}

const ESTILO = {
  papel: {
    estado: 'text-[14px] text-[color:var(--ld-muted)]',
    abierto: 'text-[14px] font-semibold text-[color:var(--ld-ok)]',
    caducado: 'text-[14px] font-semibold text-[color:var(--ld-mid)]',
    principal: 'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] bg-[color:var(--ld-text)] px-3.5 text-[14px] font-bold text-[color:var(--ld-bg)] disabled:opacity-60',
    secundario: 'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] border-[color:var(--ld-border-strong)] px-3.5 text-[14px] font-bold text-[color:var(--ld-text)] hover:border-[color:var(--ld-text)] disabled:opacity-60',
    enlace: 'inline-flex min-h-[40px] items-center text-[14px] font-semibold text-[color:var(--ld-muted)] underline-offset-4 hover:underline',
    nota: 'text-[13px] text-[color:var(--ld-muted)]',
    error: 'text-[13.5px] font-semibold text-[color:var(--ld-warn)]',
    caja: 'w-full rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3 py-2 font-mono text-[12.5px] text-[color:var(--ld-text)]',
    confirmar: 'rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-3',
  },
  panel: {
    estado: 'text-[13px] text-dark-400',
    abierto: 'text-[13px] font-semibold text-emerald-300',
    caducado: 'text-[13px] font-semibold text-amber-300',
    principal: 'btn-primary inline-flex min-h-[40px] items-center justify-center px-3.5 text-[13.5px] disabled:opacity-60',
    secundario: 'btn-secondary inline-flex min-h-[40px] items-center justify-center px-3.5 text-[13.5px] disabled:opacity-60',
    enlace: 'inline-flex min-h-[40px] items-center text-[13px] font-semibold text-dark-400 hover:text-dark-200',
    nota: 'text-[12.5px] text-dark-400',
    error: 'text-[13px] font-semibold text-red-300',
    caja: 'input w-full font-mono text-[12px]',
    confirmar: 'rounded-xl border border-dark-700 bg-dark-900 p-3',
  },
}

/** El estado de su enlace y lo que se puede hacer con él. `c`: una fila de GET /conductores/accesos. */
export default function AccesoConductor({ c, empresa, onCambio, variante = 'papel', conQuitar = false }) {
  const { t } = useT()
  const s = ESTILO[variante] || ESTILO.papel
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
    if (e?.response?.status === 409 && det?.detalle?.codigo === 'ya_abierto') {
      setConfirmar(det.detail || t('alta.acc.yaAbierto'))
      return
    }
    if (!e?.response) setError(t('alta.err.red'))
    else setError(typeof det?.detail === 'string' && det.detail ? det.detail : t('alta.err.servidor'))
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

  const claseEstado = estado === 'abierto' ? s.abierto : estado === 'caducado' ? s.caducado : s.estado
  const sinAbrirOlvidado = estado === 'sin_abrir' && !rutaRecordada(id)

  return (
    <div className="min-w-0" data-testid="acceso-conductor">
      <p className={claseEstado} data-testid="acceso-estado">{textoEstado(t, c?.acceso)}</p>
      {confirmar ? (
        <div className={`mt-2 ${s.confirmar}`} role="alertdialog" aria-label={t('alta.acc.renovar')}>
          <p className={s.nota}>{confirmar}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={s.principal} disabled={!!ocupado} onClick={confirmarRenovar}>{t('alta.acc.renovarSi')}</button>
            <button type="button" className={s.secundario} disabled={!!ocupado} onClick={() => setConfirmar('')}>{t('alta.cancelar')}</button>
          </div>
        </div>
      ) : estado === 'abierto' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={s.secundario} disabled={!!ocupado} onClick={renovar}>{t('alta.acc.renovar')}</button>
          {conQuitar && <button type="button" className={s.enlace} disabled={!!ocupado} onClick={quitar}>{t('alta.acc.quitar')}</button>}
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={s.principal} disabled={!!ocupado} onClick={() => mandar(false)}>
              {ocupado === 'wa' ? t('alta.acc.creando') : t('alta.acc.whatsapp')}
            </button>
            <button type="button" className={s.secundario} disabled={!!ocupado} onClick={() => copiar(false)}>
              {copiado ? t('alta.acc.copiado') : t('alta.acc.copiar')}
            </button>
            {conQuitar && estado === 'sin_abrir' && (
              <button type="button" className={s.enlace} disabled={!!ocupado} onClick={quitar}>{t('alta.acc.quitar')}</button>
            )}
          </div>
          {!c?.whatsapp && <p className={`mt-1.5 ${s.nota}`}>{t('alta.acc.sinMovil')}</p>}
          {sinAbrirOlvidado && <p className={`mt-1.5 ${s.nota}`}>{t('alta.acc.otraVez')}</p>}
        </>
      )}
      {aMano && (
        <div className="mt-2">
          <label className={s.nota} htmlFor={`enlace-${id}`}>{t('alta.acc.copialoTu')}</label>
          <input id={`enlace-${id}`} readOnly value={aMano} onFocus={(e) => e.target.select()} className={`mt-1 ${s.caja}`} />
        </div>
      )}
      {error && <p role="alert" className={`mt-2 ${s.error}`}>{error}</p>}
    </div>
  )
}

/** La ficha corta del acceso, en una ventana sobre la lista de Conductores. */
export function DialogoAcceso({ c, empresa, onCambio, onCerrar }) {
  const { t } = useT()
  useEscape(onCerrar)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={t('alta.acc.titulo').replace('{nombre}', c.nombre)}
        className="card w-full max-w-md rounded-b-none p-5 sm:rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-dark-50">{t('alta.acc.titulo').replace('{nombre}', c.nombre)}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-dark-400">{t('alta.acc.explica')}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label={t('alta.cerrar')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-dark-100">
            <X size={16} />
          </button>
        </div>
        <AccesoConductor c={c} empresa={empresa} onCambio={onCambio} variante="panel" conQuitar />
      </div>
    </div>
  )
}
