import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Copy, Check, AlertTriangle, ExternalLink, Play, Pause, Link2Off, RefreshCw, ArrowRight,
} from 'lucide-react'
import {
  getSyncHoja, conectarSyncHoja, modoSyncHoja, aceptarSyncHoja, desconectarSyncHoja,
} from '../api'
import { lista } from '../../lib/lista'
import { fechaHoraLocal } from '../../lib/fecha'

/* EL CUADRANTE Y SU GOOGLE SHEETS, SINCRONIZADOS (18-10-2026)
   ═══════════════════════════════════════════════════════════════════════════
   Dani: «lo actualizamos en un Drive, en un Google Sheets… que se vaya
   actualizando según los cambios que hacemos. O que se actualice según lo que
   hacemos en la aplicación».

   Un script dentro de su hoja (Extensiones → Apps Script) la manda cada 10
   minutos y al editarla; el servidor decide celda a celda hacia dónde va cada
   cambio (ver «GOOGLE SHEETS» en server.py). Aquí: conectarla, ver qué
   cambiaría (empieza SIEMPRE en prueba, sin tocar nada) y activarla. */

const dia = (f) => {
  if (!f) return ''
  const d = new Date(`${f}T12:00:00`)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

const POR_QUE = {
  primera: 'la hoja (primera vez)', hoja: 'cambiado en la hoja', nuevo: 'nuevo en la hoja',
  conflicto: 'cambiado en los dos: manda la hoja',
}

export default function SincronizarSheets({ center }) {
  const [estado, setEstado] = useState(null)
  const [nueva, setNueva] = useState(null)          // {llave, script} recién hecha: se enseña una vez
  const [ocupado, setOcupado] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [err, setErr] = useState('')
  const [confirmarCorte, setConfirmarCorte] = useState(false)

  const cargar = useCallback(() => {
    getSyncHoja(center).then(({ data }) => setEstado(data))
      .catch((e) => setErr(e?.response?.data?.detail || 'No se ha podido ver si la hoja está conectada.'))
  }, [center])
  useEffect(() => { cargar() }, [cargar])
  // Mientras está abierta, se refresca sola: así, al pegar el script, se ve llegar la hoja.
  useEffect(() => {
    const t = setInterval(cargar, 20000)
    return () => clearInterval(t)
  }, [cargar])

  async function hacer(que, fn) {
    setOcupado(que); setErr('')
    try { await fn() } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido hacer.') }
    setOcupado('')
    cargar()
  }
  const conectar = () => hacer('conectar', async () => {
    const { data } = await conectarSyncHoja(center)
    setNueva(data)
    setConfirmarCorte(false)
  })
  const copiar = () => {
    navigator.clipboard?.writeText(nueva?.script || '')
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  if (!estado) {
    return err ? <p className="text-[13px] text-red-300">{err}</p>
      : <div className="flex items-center gap-2 text-[13px] text-dark-400"><Loader2 size={15} className="animate-spin" /> Mirando…</div>
  }

  const u = estado.ultima
  const activa = estado.modo === 'activo'
  const cambios = lista(u?.cambios)

  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-dark-300" data-testid="sync-sheets">
      <p>
        Tu hoja de Google Sheets y este cuadrante de <b className="text-dark-100">{center}</b>, al día solos: cada
        10 minutos y cada vez que editas la hoja. Lo que cambias en la hoja llega aquí, y lo que cambia aquí (un día
        concedido, un refuerzo, una suspensión, una celda tocada a mano) se escribe en la hoja con una nota.
      </p>

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-300">{err}</p>}

      {nueva ? (
        <div className="space-y-3 rounded-xl border border-brand-500/40 bg-brand-500/5 p-3">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Abre tu hoja del cuadrante en Google Sheets y ve a <b className="text-dark-100">Extensiones → Apps Script</b>.</li>
            <li>Borra lo que haya en el editor y pega este código.</li>
            <li>Guarda (el disquete), elige arriba la función <b className="text-dark-100">instalar</b> y pulsa <b className="text-dark-100">Ejecutar</b>.</li>
            <li>
              Google pedirá permiso: «Revisar permisos», tu cuenta, «Configuración avanzada» → «Ir a… (no seguro)» y
              «Permitir». Sale así porque es un script tuyo, no una app publicada; solo puede tocar esta hoja.
            </li>
            <li>Vuelve aquí. En un minuto verás qué cambiaría. <b className="text-dark-100">Empieza en prueba: no toca nada</b> hasta que lo actives.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copiar} className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm">
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar el código'}
            </button>
            <span className="text-[12px] text-amber-300">{nueva.aviso}</span>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg bg-dark-950 p-2 font-mono text-[11px] text-dark-300">{nueva.script}</pre>
        </div>
      ) : !estado.conectado && (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-5 text-dark-400">
            <li>Si cambia solo la hoja, gana la hoja; si cambia solo aquí, gana esto. Si cambian los dos a la vez, la hoja.</li>
            <li>Lo que la app protege no lo pisa la hoja: días concedidos, suspensiones y celdas con candado. Vuelven a la hoja con una nota.</li>
            <li>Una celda que vacías en la hoja no borra nada aquí. Solo se tocan los días de hace una semana a dos meses vista.</li>
            <li>Si fueran a cambiar más de 80 celdas de golpe (una hoja mal ordenada, el mes equivocado), se para hasta que lo aceptes.</li>
          </ul>
          <button onClick={conectar} disabled={!!ocupado} className="btn-primary flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50">
            {ocupado === 'conectar' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Conectar mi hoja de Google
          </button>
        </div>
      )}

      {estado.conectado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${activa ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {activa ? 'Activa' : 'En prueba: no toca nada'}
            </span>
            {estado.hoja_nombre && (
              estado.hoja_url ? (
                <a href={estado.hoja_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-300 hover:underline">
                  {estado.hoja_nombre} <ExternalLink size={12} />
                </a>
              ) : <span className="text-dark-200">{estado.hoja_nombre}</span>
            )}
            <span className="text-[12px] text-dark-500">
              {estado.ultimo_contacto ? `Última vez: ${fechaHoraLocal(estado.ultimo_contacto)}` : 'Todavía no ha llegado la hoja: pega el script y ejecuta «instalar».'}
            </span>
          </div>

          {u && (
            <div className="space-y-2 rounded-xl border border-dark-700 p-3">
              {u.error ? (
                <p className="flex items-start gap-2 text-red-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {u.error}</p>
              ) : (
                <>
                  <p className="text-dark-100">{u.mensaje}</p>
                  {u.retenido && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-200">
                      <AlertTriangle size={15} /> Son demasiados cambios de golpe. Mira la lista y, si está bien, acéptalos: se aplican en la próxima sincronización.
                      <button onClick={() => hacer('aceptar', () => aceptarSyncHoja(center))} disabled={!!ocupado || estado.forzar_una_vez}
                        className="ml-auto rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-100 disabled:opacity-50">
                        {estado.forzar_una_vez ? 'Aceptados: en la próxima' : 'Aceptar estos cambios'}
                      </button>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dark-400">
                {lista(u.pestanas).map((p) => (
                  <span key={p.nombre} className={p.usada ? 'text-dark-200' : ''}>
                    Pestaña «{p.nombre}» ({p.desde?.slice(8, 10)}/{p.desde?.slice(5, 7)} → {p.hasta?.slice(8, 10)}/{p.hasta?.slice(5, 7)}):{' '}
                    {p.usada ? `${p.emparejadas} de ${p.personas} personas` : `no se usa, ${p.motivo}`}
                  </span>
                ))}
                {lista(u.saltadas).map((p) => <span key={p.nombre}>«{p.nombre}» no es un cuadrante</span>)}
              </div>
              {lista(u.sin_ficha).length > 0 && (
                <p className="text-[12px] text-amber-300">
                  Sin ficha que case, se quedan fuera: {u.sin_ficha.join(', ')}. Para que entren, importa una vez la hoja
                  en Excel («Importar hoja») y elige su ficha: se recuerda.
                </p>
              )}
              {lista(u.ambiguos).length > 0 && <p className="text-[12px] text-amber-300">Dudosos, fuera: {u.ambiguos.join(', ')}.</p>}
              {Object.keys(u.codigos_desconocidos || {}).length > 0 && (
                <p className="text-[12px] text-amber-300">
                  Códigos que no conozco, no se tocan: {Object.entries(u.codigos_desconocidos).map(([c, n]) => `${c} (${n})`).join(', ')}.
                </p>
              )}
              {cambios.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border border-dark-800">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-dark-900 text-left text-[11px] uppercase tracking-wide text-dark-500">
                      <tr><th className="px-2 py-1">Quién</th><th className="px-2 py-1">Día</th><th className="px-2 py-1">Cambio</th><th className="px-2 py-1">Hacia</th><th className="px-2 py-1">Por qué</th></tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {cambios.map((c, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1 text-dark-100">{c.nombre}</td>
                          <td className="whitespace-nowrap px-2 py-1 capitalize">{dia(c.fecha)}</td>
                          <td className="whitespace-nowrap px-2 py-1">
                            <span className="text-dark-500">{c.antes}</span> <ArrowRight size={11} className="inline" /> <b className="text-dark-100">{c.ahora}</b>
                          </td>
                          <td className={`px-2 py-1 font-semibold ${c.hacia === 'app' ? 'text-sky-300' : 'text-emerald-300'}`}>{c.hacia === 'app' ? 'Flota' : 'Hoja'}</td>
                          <td className="px-2 py-1 text-dark-400">{POR_QUE[c.por_que] || c.por_que}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {estado.ultima_escritura && (
                <p className="text-[12px] text-dark-500">
                  La hoja escribió {estado.ultima_escritura.escritas} {estado.ultima_escritura.escritas === 1 ? 'celda' : 'celdas'} ({fechaHoraLocal(estado.ultima_escritura.en)})
                  {lista(estado.ultima_escritura.saltadas).length > 0 && `; no pudo: ${estado.ultima_escritura.saltadas.join(', ')}`}.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {activa ? (
              <button onClick={() => hacer('modo', () => modoSyncHoja(center, 'prueba'))} disabled={!!ocupado}
                className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 hover:bg-dark-800 disabled:opacity-50">
                <Pause size={13} /> Pasar a prueba
              </button>
            ) : (
              <button onClick={() => hacer('modo', () => modoSyncHoja(center, 'activo'))} disabled={!!ocupado || !u || !!u.error}
                title={!u ? 'Espera a que llegue la hoja y mira qué cambiaría' : ''}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50">
                {ocupado === 'modo' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Activar: aplicar lo de arriba y seguir solo
              </button>
            )}
            {!nueva && (
              <button onClick={conectar} disabled={!!ocupado}
                className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-50">
                <RefreshCw size={13} /> Volver a sacar el script
              </button>
            )}
            {confirmarCorte ? (
              <span className="ml-auto flex items-center gap-2 text-[12px]">
                ¿Desconectar? El cuadrante se queda como está.
                <button onClick={() => hacer('cortar', async () => { await desconectarSyncHoja(center); setNueva(null); setConfirmarCorte(false) })}
                  className="rounded-lg bg-red-500/20 px-2.5 py-1 font-bold text-red-200">Sí, desconectar</button>
                <button onClick={() => setConfirmarCorte(false)} className="text-dark-400 hover:text-dark-200">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmarCorte(true)} disabled={!!ocupado}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                <Link2Off size={13} /> Desconectar
              </button>
            )}
          </div>
          {!nueva && <p className="text-[12px] text-dark-500">«Volver a sacar el script» hace una llave nueva: la de antes deja de valer y hay que pegar el código otra vez.</p>}
          {lista(estado.historial).length > 0 && (
            <details className="text-[12px] text-dark-500">
              <summary className="cursor-pointer text-dark-400">Últimas sincronizaciones con cambios</summary>
              <ul className="mt-1 space-y-0.5">
                {estado.historial.map((h, i) => (
                  <li key={i}>
                    {fechaHoraLocal(h.en)} · {h.error ? h.error : h.retenido ? 'retenida' : `${(h.a_app || 0) + (h.maximas_app || 0)} a Flota, ${(h.a_hoja || 0) + (h.maximas_hoja || 0)} a la hoja${h.modo === 'prueba' ? ' (prueba)' : ''}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
