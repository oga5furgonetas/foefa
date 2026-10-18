import { useEffect, useState } from 'react'
import { Bell, Loader2, ExternalLink } from 'lucide-react'
import { tx, txError, useIdioma } from '../lib/idioma'
import { pushSupported, enablePush, isPushEnabled } from '../lib/push'
import { medirAccion } from '../lib/analitica'
import { yaEsApp } from '../lib/instalar'
import { repAvisoManana, repAvisoMananaVer } from '../services/api'
import { useInstalar, NoSeAbrio } from './InstalarApp'

/* AVISO DE LA MAÑANA (11-10-2026). Medido: casi todos se dan de alta (de noche, en fin de semana) y no
   vuelven el día que reparten. Se les ofrece UN aviso por la mañana, de lunes a sábado, solo si ese día aún
   no han metido paquetes (lo manda el servidor: _aviso_manana_vuelta). Se pregunta una vez: si dice que no,
   no se vuelve a preguntar.

   18-10-2026, con las 31 altas reales medidas: se dan de alta a las 13-22 h, 21 desde el navegador de
   Instagram o Facebook, y 18 no vuelven nunca. Dani: «es mejor notificación de la propia app que WhatsApp».
   Dos cambios: (1) la HORA la elige él —quien carga a las 6 no necesita el aviso a las 8—; (2) dentro de
   Instagram/Facebook el móvil no deja recibir avisos, así que en vez de no ofrecer nada se le lleva a
   Chrome (o Safari) ya con su cuenta, y allí se le pregunta. */
const CLAVE = 'fds_aviso_manana'
export const HORAS_CARGA = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '10:00']
const etiqueta = (h) => String(h || '08:00').replace(/^0/, '')

/* Lo que se le dice después de pedir el aviso. `hora` es la que quedó guardada (null si no se pudo). */
export function mensajeAviso(r, hora) {
  if (r === 'ok') {
    return hora ? tx('Listo: te aviso a las {hora} los días que aún no tengas paquetes.', { hora: etiqueta(hora) })
      : tx('Avisos activados. No he podido guardar la hora: elígela en «Cuenta».')
  }
  if (r === 'denied') return tx('El móvil no ha dado permiso para avisos. Puedes activarlo en los ajustes del navegador.')
  return tx('No se han podido activar los avisos en este móvil.')
}

/* Elegir la hora y activar el aviso, o llevarle a donde se puede activar. Devuelve null si en este móvil no
   hay nada que ofrecer (un navegador sin avisos que tampoco se puede cambiar). */
export function PedirAviso({ horaInicial, onHecho, textoBoton }) {
  useIdioma()
  const ins = useInstalar()
  const [hora, setHora] = useState(HORAS_CARGA.includes(horaInicial) ? horaInicial : '08:00')
  const [ocupado, setOcupado] = useState(false)

  if (ins.interno && (ins.android || ins.iphone)) {
    const nav = ins.iphone ? 'Safari' : 'Chrome'
    return (
      <div className="space-y-2">
        <p className="text-[13px] leading-snug text-dark-300">
          {tx('Desde aquí el móvil no deja recibir avisos. Ábrela en {nav}: entras ya con tu cuenta y te lo pregunto allí.', { nav })}
        </p>
        <button type="button" onClick={() => { medirAccion('aviso_manana_fuera'); ins.abrirFuera() }} disabled={ins.ocupado}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-60">
          {ins.ocupado ? <Loader2 size={17} className="animate-spin" /> : <ExternalLink size={17} />}
          {ins.iphone ? tx('Abrir en Safari') : tx('Abrir en Chrome')}
        </button>
        {ins.fallo && <NoSeAbrio iphone={ins.iphone} enlace={ins.enlace} />}
      </div>
    )
  }
  if (!pushSupported()) {
    if (ins.iphone && !yaEsApp()) {
      return <p className="text-[12.5px] leading-snug text-dark-300">{tx('En iPhone los avisos llegan con la app en la pantalla de inicio: pulsa Compartir y «Añadir a pantalla de inicio».')}</p>
    }
    return null
  }
  let denegado = false
  try { denegado = Notification.permission === 'denied' } catch { denegado = false }
  if (denegado) {
    return <p className="text-[12.5px] leading-snug text-dark-300">{tx('El móvil no ha dado permiso para avisos. Puedes activarlo en los ajustes del navegador.')}</p>
  }

  async function activar() {
    setOcupado(true)
    medirAccion('aviso_manana_si')
    const r = await enablePush()
    let guardada = null
    if (r === 'ok') {
      try { await repAvisoManana(hora); guardada = hora } catch { guardada = null }
    }
    setOcupado(false)
    try { localStorage.setItem(CLAVE, r === 'ok' ? 'si' : r === 'denied' ? 'denegado' : 'error') } catch { /* nada */ }
    window.dispatchEvent(new Event('fds-aviso-manana'))     // la otra tarjeta, si la hay, ya no hace falta
    onHecho?.(r, guardada)
  }

  return (
    <div>
      <p id="hora-carga" className="text-[13px] font-semibold text-dark-100">{tx('¿A qué hora cargas la furgoneta?')}</p>
      <div role="radiogroup" aria-labelledby="hora-carga" className="mt-2 grid grid-cols-4 gap-1.5">
        {HORAS_CARGA.map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hora === h} onClick={() => setHora(h)}
            className={`rounded-lg border py-2 text-[13.5px] font-semibold tabular-nums ${hora === h
              ? 'border-brand-400 bg-brand-500/20 text-brand-100' : 'border-dark-700 text-dark-200'}`}>
            {etiqueta(h)}
          </button>
        ))}
      </div>
      <button type="button" onClick={activar} disabled={ocupado}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-60">
        {ocupado ? <Loader2 size={17} className="animate-spin" /> : <Bell size={17} />}
        {textoBoton || tx('Avísame a las {hora}', { hora: etiqueta(hora) })}
      </button>
      <p className="mt-1.5 text-[12px] leading-snug text-dark-400">{tx('De lunes a sábado, solo los días que aún no hayas metido paquetes.')}</p>
    </div>
  )
}

/* La tarjeta de la pestaña «Hoy», para quien no lo eligió en la bienvenida. */
export default function AvisoManana({ toast }) {
  useIdioma()
  const [ver, setVer] = useState(false)
  useEffect(() => {
    try {
      if (pushSupported() && Notification.permission === 'default' && !localStorage.getItem(CLAVE)) setVer(true)
    } catch { /* sin almacenamiento o sin avisos: no se ofrece */ }
    const ya = () => setVer(false)
    window.addEventListener('fds-aviso-manana', ya)
    return () => window.removeEventListener('fds-aviso-manana', ya)
  }, [])
  if (!ver) return null
  const cerrar = (v) => { try { localStorage.setItem(CLAVE, v) } catch { /* nada */ } setVer(false) }

  return (
    <div className="mx-auto mb-3 max-w-md rounded-2xl border border-sky-400/30 bg-sky-500/[.08] px-3.5 py-3" role="region" aria-label={tx('Aviso por la mañana')}>
      <p className="mb-2.5 flex items-start gap-2 text-[13.5px] font-semibold leading-snug text-sky-100">
        <Bell size={17} className="mt-0.5 shrink-0" /> {tx('¿Te aviso por la mañana para cargar tu ruta?')}
      </p>
      <PedirAviso onHecho={(r, hora) => {
        const m = mensajeAviso(r, hora)
        if (r === 'ok' && hora) toast?.success(m)
        else toast?.error(m)
        setVer(false)
      }} />
      <button onClick={() => { medirAccion('aviso_manana_no'); cerrar('no') }}
        className="mt-2 w-full py-1.5 text-center text-[13px] font-semibold text-dark-400">{tx('No, gracias')}</button>
    </div>
  )
}

/* En «Cuenta»: a qué hora llega el aviso, y cambiarla; o activarlo si en este móvil no lo está. */
export function AvisoCuenta({ toast }) {
  useIdioma()
  const ins = useInstalar()
  const [hora, setHora] = useState(null)
  const [activo, setActivo] = useState(null)
  useEffect(() => {
    let vivo = true
    repAvisoMananaVer().then(({ data }) => { if (vivo) setHora(data?.hora || null) }).catch(() => { if (vivo) setHora(null) })
    isPushEnabled().then((x) => { if (vivo) setActivo(!!x) }).catch(() => { if (vivo) setActivo(false) })
    return () => { vivo = false }
  }, [])
  if (!hora || activo === null) return null
  // Sin nada que ofrecer en este móvil (un navegador sin avisos que tampoco se puede cambiar), ni la sección.
  if (!activo && !(ins.interno && (ins.android || ins.iphone)) && !pushSupported() && !(ins.iphone && !yaEsApp())) return null

  async function cambiar(h) {
    const antes = hora
    setHora(h)
    try {
      await repAvisoManana(h)
      toast?.success(tx('Te aviso a las {hora}.', { hora: etiqueta(h) }))
    } catch (e) {
      setHora(antes)
      toast?.error(txError(e, 'No se pudo guardar'))
    }
  }

  return (
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4" aria-label={tx('Aviso por la mañana')}>
      {activo ? (<>
        <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-dark-100">
          🔔 {tx('Aviso por la mañana')}
          <select value={hora} onChange={(e) => cambiar(e.target.value)} aria-label={tx('¿A qué hora cargas la furgoneta?')}
            className="rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[14px] tabular-nums text-dark-50">
            {HORAS_CARGA.concat(HORAS_CARGA.includes(hora) ? [] : [hora]).map((h) => <option key={h} value={h}>{etiqueta(h)}</option>)}
          </select>
        </label>
        <p className="mt-1.5 text-[12px] leading-snug text-dark-400">{tx('De lunes a sábado, solo los días que aún no hayas metido paquetes.')}</p>
      </>) : (<>
        <p className="mb-2.5 text-[14px] font-semibold text-dark-100">🔔 {tx('Aviso por la mañana')}</p>
        <PedirAviso horaInicial={hora} onHecho={(r, h) => {
          const m = mensajeAviso(r, h)
          if (r === 'ok') { setActivo(true); if (h) setHora(h) }
          if (r === 'ok' && h) toast?.success(m)
          else toast?.error(m)
        }} />
      </>)}
    </section>
  )
}
