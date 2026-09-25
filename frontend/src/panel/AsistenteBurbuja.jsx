import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Send, Loader2, X, Check, Car, UserPlus, ClipboardList, ArrowRight, FileText, Paperclip, UserX, Wrench, AlertTriangle, Pencil, UserCog, Hammer } from 'lucide-react'
import { getIaTareas, marcarIaTareasVistas, getAiHistorial, enviarMensajeIA, ejecutarAccionIA, subirFichasTecnicasIA, confirmarFichasTecnicasIA } from './api'
import { getAdmin } from './auth'

/* FLOTADSP AI — burbuja de ayuda flotante, abajo a la derecha, como los
   widgets de soporte de cualquier web grande (Intercom, Drift...): se ve
   siempre, ocupa poco cerrada, y se abre un poco al tocarla. Pedido así
   explícitamente el 17-09-2026, en vez de una pantalla propia en el menú.

   Contesta "cómo se hace X" y "cómo va mi WHC/DNR/Empleo" con datos EN VIVO
   del centro elegido (nunca inventados), y puede PROPONER crear un vehículo
   o un conductor — nunca lo hace sola: hace falta un clic de confirmación,
   que pasa por las mismas comprobaciones que el formulario normal. */

const ETIQUETA_ACCION = {
  crear_vehiculo: { icon: Car, titulo: 'Crear vehículo' },
  crear_conductor: { icon: UserPlus, titulo: 'Crear conductor' },
  generar_plantilla: { icon: ClipboardList, titulo: 'Generar plantilla con Cortex' },
  programar_plantilla: { icon: ClipboardList, titulo: 'Programar la plantilla: se monta sola cuando salgan las rutas' },
  preasignar_furgonetas: { icon: Car, titulo: 'Guardar las furgonetas de ese día' },
  cancelar_tarea: { icon: X, titulo: 'Cancelar lo programado' },
  asignar_conductor: { icon: UserPlus, titulo: 'Asignar conductor a furgoneta' },
  desasignar_conductor: { icon: UserX, titulo: 'Quitar conductor de furgoneta' },
  cambiar_estado_vehiculo: { icon: Wrench, titulo: 'Cambiar estado de furgoneta' },
  crear_incidencia: { icon: AlertTriangle, titulo: 'Abrir parte de incidencia' },
  editar_vehiculo: { icon: Pencil, titulo: 'Editar furgoneta' },
  editar_conductor: { icon: UserCog, titulo: 'Editar conductor' },
  crear_orden_taller: { icon: Hammer, titulo: 'Enviar furgoneta al taller' },
}
const CAMPO_LABEL = {
  license_plate: 'Matrícula', brand: 'Marca', model: 'Modelo', color: 'Color', vin: 'VIN',
  name: 'Nombre', phone: 'Teléfono', email: 'Correo', dni: 'DNI',
  matricula: 'Matrícula', conductor_nombre: 'Conductor', estado: 'Nuevo estado',
  descripcion: 'Qué le pasa', severidad: 'Gravedad',
  year: 'Año', mileage: 'Kilómetros', notes: 'Notas', fuel_type: 'Combustible',
  itv_date: 'ITV', insurance_expiry: 'Seguro hasta', renting_end_date: 'Renting hasta',
  provider: 'Proveedor renting', license_number: 'Nº carné', address: 'Dirección',
  taller_nombre: 'Taller', problema: 'Motivo',
}
const SEVERIDAD_TXT = { leve: 'Leve', moderado: 'Moderado', grave: 'Grave' }
const ESTADO_VEHICULO_TXT = { active: 'Activa', taller: 'En taller', baja: 'De baja' }
const TONO_CLS = {
  ok: 'bg-emerald-500/10 text-emerald-300',
  aviso: 'bg-amber-500/10 text-amber-300',
  alerta: 'bg-red-500/10 text-red-300',
  neutro: 'bg-dark-800 text-dark-300',
}

/* «2026-09-22» -> «22/09/2026»: el día que se muestra es el que entendió la IA y
   el que va a comprobar el servidor, así que se enseña tal cual para que la
   persona vea si «mañana» ha caído donde toca antes de confirmar. */
const fechaEs = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d)

function DetalleAccion({ a }) {
  const c = a.campos || {}
  if (a.tipo === 'generar_plantilla') {
    return <div>{c.dia ? `Plantilla del ${fechaEs(c.dia)}` : 'Plantilla de hoy'}: ruta y conductor de cada uno, tal como los tiene Cortex capturados.</div>
  }
  if (a.tipo === 'programar_plantilla' || a.tipo === 'preasignar_furgonetas') {
    const pares = Array.isArray(c.pares) ? c.pares : []
    return (
      <>
        <div>Día: <span className="text-dark-200">{fechaEs(c.dia) || 'sin indicar'}</span></div>
        {pares.length > 0 && (
          <div>Furgonetas ({pares.length}): <span className="text-dark-200">
            {pares.slice(0, 12).map((p) => `${p.conductor_nombre} → ${p.matricula}`).join(' · ')}
            {pares.length > 12 ? ` y ${pares.length - 12} más` : ''}</span></div>
        )}
        {a.tipo === 'programar_plantilla' && (
          <div>La monta el servidor en cuanto Cortex publique las rutas y te avisa aquí y por notificación.</div>
        )}
      </>
    )
  }
  if (a.tipo === 'cancelar_tarea') return <div>{c.dia ? `La programada para el ${fechaEs(c.dia)}.` : 'Todo lo programado de este centro.'}</div>
  return Object.entries(c).filter(([, v]) => v).map(([k, v]) => (
    <div key={k}>{CAMPO_LABEL[k] || k}: <span className="text-dark-200">{k === 'estado' ? (ESTADO_VEHICULO_TXT[v] || v) : k === 'severidad' ? (SEVERIDAD_TXT[v] || v) : v}</span></div>
  ))
}

function textoPreasig(p) {
  if (!p) return ''
  const g = (p.guardadas || []).length
  const f = (p.fallidas || []).map((x) => `${x.matricula}: ${x.motivo}`).join(' · ')
  return `${g} furgoneta${g === 1 ? '' : 's'} guardada${g === 1 ? '' : 's'}` +
    (f ? `. No he podido con: ${f}` : '') + ((p.avisos || []).length ? `. ${p.avisos.join(' ')}` : '')
}

function textoCambios(cambios) {
  return Object.entries(cambios || {}).map(([k, v]) => `${CAMPO_LABEL[k] || k}: ${v}`).join(', ')
}

function mensajeResultado(r) {
  if (!r) return 'Hecho.'
  switch (r.tipo) {
    case 'asignar_conductor': return `${r.driver_name} lleva ahora la ${r.vehicle_plate}.`
    case 'desasignar_conductor': return `La ${r.vehicle_plate} se ha quedado sin conductor asignado.`
    case 'cambiar_estado_vehiculo': return `La ${r.vehicle_plate} ahora está: ${ESTADO_VEHICULO_TXT[r.estado] || r.estado}.`
    case 'crear_incidencia': return `Parte abierto en la ${r.vehicle_plate} (${SEVERIDAD_TXT[r.severidad] || r.severidad}).`
    case 'editar_vehiculo': return `${r.vehicle_plate} actualizada — ${textoCambios(r.cambios)}.`
    case 'editar_conductor': return `${r.driver_name} actualizado — ${textoCambios(r.cambios)}.`
    case 'crear_orden_taller': return `Orden ${r.numero || ''} abierta: ${r.vehicle_plate} va a ${r.taller_nombre}.`
    case 'programar_plantilla': return (r.ya_existia
      ? `Ya estaba programada la plantilla del ${fechaEs(r.dia)}.`
      : `Programada la plantilla del ${fechaEs(r.dia)}: la monto sola en cuanto Cortex publique las rutas.`)
      + (r.preasignacion ? ` ${textoPreasig(r.preasignacion)}.` : '')
    case 'preasignar_furgonetas': return `Para el ${fechaEs(r.dia)}: ${textoPreasig(r)}. Se aplican al montar la plantilla de ese día.`
    case 'cancelar_tarea': return `Cancelada${r.canceladas === 1 ? '' : 's'} ${r.canceladas} tarea${r.canceladas === 1 ? '' : 's'} programada${r.canceladas === 1 ? '' : 's'}.`
    default: return `Creado${r.license_plate ? `: ${r.license_plate}` : r.name ? `: ${r.name}` : ''}`
  }
}

function Documentos({ lista }) {
  return (
    <div className="mt-2 space-y-1">
      {lista.map((d, i) => (
        <a key={i} href={d.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-900/70 px-2.5 py-1.5 text-[11.5px] text-dark-200 hover:border-brand-500/40 hover:text-brand-200">
          <FileText size={13} className="shrink-0 text-brand-400" />
          <span className="cifra font-semibold">{d.matricula}</span>
          <span className="truncate text-dark-400">{d.nombre}</span>
        </a>
      ))}
    </div>
  )
}

const FICHA_ESTADO_CLS = {
  match: 'text-emerald-300', sin_match: 'text-dark-500', ambiguo: 'text-amber-300',
  no_es_ficha: 'text-red-300',
}
const FICHA_ESTADO_TXT = {
  sin_match: 'sin identificar', ambiguo: 'varias furgonetas casan',
  no_es_ficha: 'esto no parece una ficha técnica',
}

function FichasLote({ lote, resultado, confirmando, onConfirmar }) {
  return (
    <div className="mt-2 rounded-lg border border-dark-700 bg-dark-900/70 p-2">
      <div className="mb-1.5 text-[11px] font-semibold text-dark-200">
        {lote.n_match} de {lote.n} furgonetas identificadas
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
        {lote.resultados.map((r) => (
          <div key={r.idx} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-dark-400">{r.filename}</span>
            <span className={`shrink-0 cifra font-semibold ${FICHA_ESTADO_CLS[r.estado] || 'text-dark-500'}`}>
              {r.estado === 'match' ? r.vehicle_plate
                : (r.matricula_detectada || FICHA_ESTADO_TXT[r.estado] || r.estado)}
            </span>
          </div>
        ))}
      </div>
      {!resultado && lote.n_match > 0 && (
        <button onClick={onConfirmar} disabled={confirmando}
          className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50">
          {confirmando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Confirmar {lote.n_match} asignación{lote.n_match === 1 ? '' : 'es'}
        </button>
      )}
      {!resultado && lote.n_match === 0 && (
        <div className="mt-1.5 text-[11px] text-dark-500">Ninguna se pudo emparejar sola: súbelas a mano desde la ficha de cada furgoneta.</div>
      )}
      {resultado && (
        <div className="mt-2 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-300">
          ✅ Asignadas {resultado.asignados.length}{resultado.fallidos.length ? `, ${resultado.fallidos.length} fallaron` : ''}.
        </div>
      )}
    </div>
  )
}

function Tarjeta({ t }) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-dark-700">
      <div className="border-b border-dark-700 bg-dark-800/60 px-2.5 py-1.5 text-[11px] font-semibold text-dark-300">{t.titulo}</div>
      <div className="divide-y divide-dark-800">
        {t.filas.map((f, i) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 text-[12px]">
            <span className="text-dark-400">{f.etiqueta}</span>
            <span className={`cifra rounded px-1.5 py-0.5 font-bold ${TONO_CLS[f.tono] || TONO_CLS.neutro}`}>{f.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AsistenteBurbuja({ center, centers }) {
  const navigate = useNavigate()
  // Quien habla se ve de un vistazo: el logo cuando contesta la IA y la foto
  // de perfil cuando escribe la persona. Sin foto, sus iniciales.
  const yo = getAdmin()
  const miFoto = yo?.photo_url || ''
  const misIniciales = String(yo?.name || yo?.username || '?').trim()
    .split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '?' 
  const [abierto, setAbierto] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [cargado, setCargado] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')
  const [ejecutando, setEjecutando] = useState(null)
  const [subiendoFichas, setSubiendoFichas] = useState(false)
  const [confirmandoLote, setConfirmandoLote] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const sinCentro = !center || center === 'Todos'

  /* LO QUE LA IA HA DEJADO PROGRAMADO Y LO QUE YA HA HECHO. La tarea la ejecuta
     el servidor, no esta conversacion, asi que el resultado tiene que llegar
     aunque nadie tenga el chat abierto: se pregunta cada minuto y, si hay algo
     que nadie ha visto, el boton lleva un punto. Es el mismo aviso para
     cualquiera de la nave (`visto_por` es por persona). */
  const [tareas, setTareas] = useState({ tareas: [], sin_ver: 0 })
  useEffect(() => {
    if (sinCentro) { setTareas({ tareas: [], sin_ver: 0 }); return undefined }
    let vivo = true
    const mirar = () => {
      if (!vivo || document.hidden) return
      getIaTareas(center).then((r) => { if (vivo) setTareas(r.data || { tareas: [], sin_ver: 0 }) }).catch(() => {})
    }
    mirar()
    const id = setInterval(mirar, 60000)
    document.addEventListener('visibilitychange', mirar)
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', mirar) }
  }, [center, sinCentro])
  useEffect(() => {
    if (!abierto || sinCentro || !tareas.sin_ver) return undefined
    // Al abrirlo se dan por vistas, pero tras un momento: si se cierra al
    // instante no se ha llegado a leer nada.
    const t = setTimeout(() => {
      marcarIaTareasVistas(center).then(() => setTareas((x) => ({
        ...x, sin_ver: 0, tareas: x.tareas.map((y) => ({ ...y, sin_ver: false })) }))).catch(() => {})
    }, 2500)
    return () => clearTimeout(t)
  }, [abierto, sinCentro, center, tareas.sin_ver])

  useEffect(() => {
    if (!abierto || sinCentro || cargado) return
    getAiHistorial(center)
      .then((r) => setMsgs((r.data?.mensajes || []).map((m) => ({
        rol: m.rol, texto: m.texto, accion_propuesta: m.accion_propuesta, tarjeta: m.tarjeta,
        documentos: m.documentos,
      }))))
      .catch(() => setMsgs([]))
      .finally(() => setCargado(true))
  }, [abierto, center, sinCentro, cargado])

  // Cambiar de centro reinicia la conversación mostrada: no tiene sentido
  // seguir leyendo el WHC de OGA5 con DGA1 ya seleccionado.
  useEffect(() => { setMsgs([]); setCargado(false) }, [center])

  useEffect(() => { if (abierto) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, enviando, abierto])

  async function enviar(e) {
    e?.preventDefault()
    const mensaje = texto.trim()
    if (!mensaje || enviando) return
    setTexto(''); setErr(''); setEnviando(true)
    setMsgs((m) => [...m, { rol: 'usuario', texto: mensaje }])
    try {
      const { data } = await enviarMensajeIA(mensaje, center)
      setMsgs((m) => [...m, { rol: 'asistente', texto: data.respuesta, accion_propuesta: data.accion_propuesta, tarjeta: data.tarjeta, documentos: data.documentos }])
    } catch (e) {
      setErr(e?.response?.data?.detail || 'El asistente no ha podido responder.')
    } finally { setEnviando(false) }
  }

  async function confirmar(idx, accion) {
    setEjecutando(idx)
    try {
      const { data } = await ejecutarAccionIA(accion.tipo, accion.campos, center)
      const resultado = (accion.tipo === 'crear_vehiculo' || accion.tipo === 'crear_conductor')
        ? { ...data.creado, tipo: accion.tipo } : data
      setMsgs((m) => m.map((x, i) => i === idx ? { ...x, accion_propuesta: null, resultado } : x))
    } catch (e) {
      setMsgs((m) => m.map((x, i) => i === idx
        ? { ...x, error_accion: e?.response?.data?.detail || 'No se pudo completar.' } : x))
    } finally { setEjecutando(null) }
  }

  function cancelar(idx) {
    setMsgs((m) => m.map((x, i) => i === idx ? { ...x, accion_propuesta: null, cancelada: true } : x))
  }

  async function procesarArchivos(files) {
    if (!files.length || subiendoFichas) return
    setErr(''); setSubiendoFichas(true)
    setMsgs((m) => [...m, { rol: 'usuario', texto: `He subido ${files.length} fichero${files.length === 1 ? '' : 's'}: ${files.map((f) => f.name).join(', ')}` }])
    try {
      const { data } = await subirFichasTecnicasIA(files, center)
      setMsgs((m) => [...m, { rol: 'asistente', texto: 'Esto es lo que he leído en cada ficha técnica:', fichas_lote: data }])
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se han podido leer los ficheros.')
    } finally { setSubiendoFichas(false) }
  }

  function subirFichas(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''  // permite volver a elegir los mismos ficheros despues
    procesarArchivos(files)
  }

  // Pegar una captura con Ctrl+V hace lo mismo que subirla con el clip: se
  // trata como ficha técnica a emparejar. Pedido explicitamente el
  // 18-09-2026 para no tener que guardar la imagen y luego ir a buscarla.
  function pegarImagenes(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const files = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it, i) => {
        const f = it.getAsFile()
        if (!f) return null
        // El portapapeles suele dar "image.png" para todo: un nombre por
        // orden ayuda a distinguirlas en la lista de resultados si son varias.
        return f.name && f.name !== 'image.png' ? f : new File([f], `pegado-${i + 1}.png`, { type: f.type })
      }).filter(Boolean)
    if (!files.length) return
    e.preventDefault()
    procesarArchivos(files)
  }

  async function confirmarLote(idx, lote_id) {
    setConfirmandoLote(idx)
    try {
      const { data } = await confirmarFichasTecnicasIA(lote_id)
      setMsgs((m) => m.map((x, i) => i === idx ? { ...x, ficha_resultado: data } : x))
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudieron asignar los documentos.')
    } finally { setConfirmandoLote(null) }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[95] flex flex-col items-end">
      {abierto && (
        <div onPaste={pegarImagenes}
          className="mb-3 flex h-[32rem] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-dark-700 bg-dark-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-dark-800 bg-dark-900/80 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand-400" />
              <div className="text-[13px] font-bold text-dark-100">FlotaDSP AI</div>
              {!sinCentro && <span className="cifra text-[11px] text-dark-500">· {center}</span>}
            </div>
            <button onClick={() => setAbierto(false)} className="text-dark-500 hover:text-dark-200"><X size={16} /></button>
          </div>

          {!sinCentro && tareas.tareas.length > 0 && (
            <div className="space-y-1 border-b border-dark-800 bg-dark-900/60 px-3 py-2">
              {tareas.tareas.slice(0, 4).map((x) => (
                <div key={x.id} className={`flex items-start gap-1.5 text-[11px] leading-snug ${
                  x.estado === 'pendiente' ? 'text-amber-300' : x.estado === 'hecha' ? 'text-emerald-300' : 'text-dark-400'}`}>
                  <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                  <span>
                    {x.estado === 'pendiente'
                      ? `Programada la plantilla del ${fechaEs(x.dia)}: espero a que Cortex publique las rutas.`
                      : x.aviso || `Plantilla del ${fechaEs(x.dia)}: ${x.estado}.`}
                    {x.sin_ver && <b className="ml-1 text-brand-300">nuevo</b>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {sinCentro ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Sparkles size={22} className="text-brand-400" />
              <p className="text-[12.5px] text-dark-300">Elige un centro arriba para hablar con el asistente de esa nave.</p>
              <p className="text-[11px] text-dark-500">Disponibles: {centers?.join(' · ') || '—'}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-2.5">
                {msgs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                    <p className="text-[12.5px] text-dark-400">Pregúntame cómo se hace algo, cómo va el WHC de alguien, las DNR abiertas, las inspecciones de una furgoneta, "dame las furgonetas de Bansacar" o "qué furgoneta lleva Juan". Pídeme que cree, edite o asigne un vehículo o conductor, que abra un parte o mande una furgoneta a un taller, que monte la plantilla de hoy con Cortex, o sube fichas técnicas con el clip o pegando la captura (Ctrl+V) directamente aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msgs.map((m, i) => {
                      const mia = m.rol === 'usuario'
                      const acc = m.accion_propuesta ? ETIQUETA_ACCION[m.accion_propuesta.tipo] : null
                      return (
                        <div key={i} className={`flex items-end gap-1.5 ${mia ? 'justify-end' : 'justify-start'}`}>
                          {!mia && (
                            <img src="/logo-fd-sinlema.png" alt="FlotaDSP AI"
                              className="h-6 w-6 shrink-0 rounded-full bg-dark-800 object-contain p-0.5" />
                          )}
                          <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[12.5px] ${mia ? 'bg-brand-500/20 text-brand-200' : 'bg-dark-800 text-dark-100'}`}>
                            <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                            {m.tarjeta && <Tarjeta t={m.tarjeta} />}
                            {m.documentos?.length > 0 && <Documentos lista={m.documentos} />}
                            {m.fichas_lote && (
                              <FichasLote lote={m.fichas_lote} resultado={m.ficha_resultado}
                                confirmando={confirmandoLote === i}
                                onConfirmar={() => confirmarLote(i, m.fichas_lote.lote_id)} />
                            )}
                            {acc && (
                              <div className="mt-2 rounded-lg border border-dark-700 bg-dark-900/70 p-2">
                                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-dark-200">
                                  <acc.icon size={12} className="text-brand-400" /> {acc.titulo}
                                </div>
                                <div className="mb-1.5 space-y-0.5 text-[11px] text-dark-400">
                                  <DetalleAccion a={m.accion_propuesta} />
                                </div>
                                <div className="flex gap-1.5">
                                  <button onClick={() => confirmar(i, m.accion_propuesta)} disabled={ejecutando === i}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50">
                                    {ejecutando === i ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar
                                  </button>
                                  <button onClick={() => cancelar(i)} disabled={ejecutando === i}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-dark-400 ring-1 ring-dark-700 hover:text-dark-200 disabled:opacity-50">
                                    <X size={11} /> Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                            {m.resultado && m.resultado.draft_id ? (
                              <div className="mt-1.5 space-y-1.5 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-300">
                                <div>
                                  ✅ {m.resultado.ya_existia
                                    ? `Añadidas ${m.resultado.anadidas} ruta${m.resultado.anadidas === 1 ? '' : 's'} nueva${m.resultado.anadidas === 1 ? '' : 's'} a la plantilla que ya estaba abierta.`
                                    : `Plantilla creada con ${m.resultado.filas_cortex} ruta${m.resultado.filas_cortex === 1 ? '' : 's'} de Cortex.`}
                                </div>
                                <button onClick={() => navigate('/panel/plantilla')}
                                  className="flex items-center gap-1 font-semibold text-emerald-200 hover:text-emerald-100">
                                  Abrir la plantilla <ArrowRight size={11} />
                                </button>
                              </div>
                            ) : m.resultado && (
                              <div className="mt-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                                ✅ {mensajeResultado(m.resultado)}
                              </div>
                            )}
                            {m.error_accion && <div className="mt-1.5 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-300">{m.error_accion}</div>}
                            {m.cancelada && <div className="mt-1 text-[10.5px] text-dark-500">Descartado.</div>}
                          </div>
                          {mia && (miFoto
                            ? <img src={miFoto} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                            : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/25 text-[9px] font-semibold text-brand-200">{misIniciales}</span>
                          )}
                        </div>
                      )
                    })}
                    {enviando && (
                      <div className="flex justify-start">
                        <div className="rounded-xl bg-dark-800 px-3 py-2 text-[12px] text-dark-400">
                          <Loader2 size={12} className="inline animate-spin" /> Pensando…
                        </div>
                      </div>
                    )}
                    {subiendoFichas && (
                      <div className="flex justify-start">
                        <div className="rounded-xl bg-dark-800 px-3 py-2 text-[12px] text-dark-400">
                          <Loader2 size={12} className="inline animate-spin" /> Leyendo las fichas técnicas…
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
              {err && <div className="mx-2.5 mb-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">{err}</div>}
              <form onSubmit={enviar} className="flex gap-1.5 border-t border-dark-800 p-2.5">
                <input ref={fileInputRef} type="file" multiple hidden
                  accept=".pdf,.jpg,.jpeg,.png" onChange={subirFichas} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={subiendoFichas}
                  title="Subir fichas técnicas u otros documentos"
                  className="flex items-center justify-center rounded-lg px-2 text-dark-400 ring-1 ring-dark-700 hover:text-dark-200 disabled:opacity-50">
                  <Paperclip size={14} />
                </button>
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu pregunta…"
                  className="input flex-1 text-[12.5px]" maxLength={2000} />
                <button disabled={!texto.trim() || enviando} className="btn-primary flex items-center justify-center px-2.5 disabled:opacity-50">
                  {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button onClick={() => setAbierto((a) => !a)}
        title="FlotaDSP AI"
        className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-2xl transition ${
          abierto ? 'bg-dark-800 text-dark-200' : 'bg-brand-500 text-dark-950 hover:bg-brand-400'}`}>
        {abierto ? <X size={20} /> : <Sparkles size={20} />}
        {!abierto && tareas.sin_ver > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-dark-950 bg-emerald-400"
            title="La IA ha terminado algo que dejaste programado" />
        )}
      </button>
    </div>
  )
}
