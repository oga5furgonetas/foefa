import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Plus, MessageCircle, Tag, ShieldCheck, Flag, Send, Loader2, X, Check, ImagePlus, ChevronRight,
  Info, Eye, BadgeCheck, Store, Bell, BellOff,
} from 'lucide-react'
import {
  mercEstado, mercLista, mercAnuncio, mercSubirFoto, mercFotoBlob, mercCrear, mercCambiar, mercContactar,
  mercBuzon, mercConversacion, mercResponder, mercAvisosLeidos, mercDenunciar, mercAvisosMovil,
} from '../../services/api'
import { compressImage } from '../../lib/compressImage'
import { enablePush } from '../../lib/push'

/* AVISOS AL MÓVIL (17-10-2026). Dani: «si quiere que le salte en el móvil, que reciba notificaciones». Lo elige
   cada uno: aquí se pide el permiso del navegador y se apunta en el servidor. El aviso dice quién escribe y sobre
   qué anuncio, nunca el mensaje. */
const NO_SE_PUDO = {
  denied: 'El móvil tiene bloqueados los avisos de esta web. Actívalos en los ajustes del navegador y vuelve a probar.',
  unsupported: 'Este navegador no permite avisos. En iPhone, primero añade la app a la pantalla de inicio y ábrela desde ahí.',
  'server-disabled': 'Los avisos no están disponibles ahora mismo.',
  error: 'No se han podido activar. Inténtalo otra vez.',
}
export function AvisosMovil({ activo, onCambio, pregunta, detalle = 'Cuando alguien te escriba o se revise tu anuncio' }) {
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const cambiar = async (si) => {
    setOcupado(true); setErr('')
    try {
      if (si) {
        const r = await enablePush()
        if (r !== 'ok') { setErr(NO_SE_PUDO[r] || NO_SE_PUDO.error); return }
      }
      const { data } = await mercAvisosMovil(si)
      onCambio?.(!!data?.avisos_movil)
    } catch { setErr(NO_SE_PUDO.error) } finally { setOcupado(false) }
  }
  if (pregunta) {
    if (activo) return null
    return (
      <div className="mt-3 rounded-2xl border border-brand-400/40 bg-brand-500/[.08] p-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-dark-50"><Bell size={17} className="shrink-0 text-brand-300" /> {pregunta}</p>
        {err && <p role="alert" className="mt-1.5 text-[12.5px] text-red-300">{err}</p>}
        <button type="button" onClick={() => cambiar(true)} disabled={ocupado}
          className="mt-2 flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-[14px] font-bold text-brand-tinta disabled:opacity-50">
          {ocupado && <Loader2 size={14} className="animate-spin" />} Sí, avísame en el móvil
        </button>
      </div>
    )
  }
  return (
    <div className="mb-4 rounded-2xl border border-dark-700 bg-dark-900 p-3">
      <label className="flex cursor-pointer items-center gap-3">
        {activo ? <Bell size={19} className="shrink-0 text-brand-300" /> : <BellOff size={19} className="shrink-0 text-dark-400" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-dark-50">Avisarme en el móvil</span>
          <span className="block text-[12px] leading-snug text-dark-400">{detalle}</span>
        </span>
        {ocupado ? <Loader2 size={18} className="animate-spin text-dark-400" /> : (
          <input type="checkbox" role="switch" checked={!!activo} onChange={(e) => cambiar(e.target.checked)}
            aria-label="Avisarme en el móvil" className="h-5 w-5 shrink-0" />
        )}
      </label>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-red-300">{err}</p>}
    </div>
  )
}

/* ── EL MERCADILLO DE REPARTIDORES (17-10-2026) ─────────────────────────────────
   Dani: «¿quieres vender algo que no uses por si un compañero lo quiere?», que lo apruebe él, y que se
   contacten por mensajes que lleguen a un buzón. El mismo componente sirve en el portal del conductor, en
   la app del autónomo y en /mercadillo (la vista previa de Dani). Las reglas (aprobar antes de salir,
   quién ve qué, fotos sin ubicación, denuncias) las pone el servidor: aquí solo se pintan y se explican. */

// «1.300 €» y «25,50 €». A mano y no con toLocaleString: en español no pone el punto en números de 4 cifras.
export const euros = (c) => {
  const n = Number(c) || 0
  const e = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const r = n % 100
  return `${e}${r ? `,${String(r).padStart(2, '0')}` : ''} €`
}
const fecha = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
const hora = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hoy = new Date().toDateString() === d.toDateString()
  return hoy ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : `${fecha(iso)} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}
const detalle = (e) => e?.response?.data?.detail
const texto = (e, def) => (typeof detalle(e) === 'string' ? detalle(e) : def)

const ESTADO = {
  pendiente: ['En revisión', 'bg-amber-400/15 text-amber-200'],
  en_revision: ['En revisión por avisos', 'bg-amber-400/15 text-amber-200'],
  publicado: ['Publicado', 'bg-emerald-400/15 text-emerald-200'],
  rechazado: ['No publicado', 'bg-red-500/15 text-red-200'],
  retirado: ['Retirado', 'bg-red-500/15 text-red-200'],
  vendido: ['Vendido', 'bg-dark-800 text-dark-300'],
  quitado: ['Quitado', 'bg-dark-800 text-dark-300'],
  caducado: ['Caducado', 'bg-dark-800 text-dark-300'],
}

/* Las fotos se piden con la sesión (nunca son públicas) y se guardan en memoria mientras dura la visita. */
const cacheFotos = new Map()
export function Foto({ id, className = '', alt = '' }) {
  const [url, setUrl] = useState(() => cacheFotos.get(id) || '')
  useEffect(() => {
    if (!id || cacheFotos.get(id)) { setUrl(cacheFotos.get(id) || ''); return undefined }
    let vivo = true
    mercFotoBlob(id).then(({ data }) => {
      const u = URL.createObjectURL(data)
      cacheFotos.set(id, u)
      if (vivo) setUrl(u)
    }).catch(() => {})
    return () => { vivo = false }
  }, [id])
  return url
    ? <img src={url} alt={alt} className={`object-cover ${className}`} />
    : <div className={`animate-pulse bg-dark-800 ${className}`} aria-hidden="true" />
}

function Chip({ activo, children, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${activo ? 'border-brand-400 bg-brand-500/15 text-brand-100' : 'border-dark-700 text-dark-300'}`}>
      {children}
    </button>
  )
}

function Cabecera({ titulo, sub, onBack, derecha }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 border-b border-dark-800 bg-dark-950/95 px-4 py-3 backdrop-blur">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Volver" className="-ml-1 rounded-lg p-1.5 text-dark-300"><ArrowLeft size={20} /></button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[18px] font-bold leading-tight text-dark-50">{titulo}</p>
        {sub && <p className="truncate text-[12px] text-dark-400">{sub}</p>}
      </div>
      {derecha}
    </div>
  )
}

const NORMAS = [
  'Solo particulares: vende cosas tuyas que ya no usas. Nada de tiendas ni reventa.',
  'Lo que cuentas y las fotos tienen que ser del artículo y verdad.',
  'Prohibido: armas, medicamentos, alcohol, tabaco y vapeo, falsificaciones, cosas robadas, animales, documentos, cuentas o rutas, y cualquier cosa ilegal.',
  'Prohibido también el material de la empresa, de la plataforma para la que repartes o de los clientes: escáneres, móviles de trabajo, chalecos, paquetes…',
  'Cada anuncio lo revisamos antes de publicarlo. Dura 30 días y puedes tener 3 a la vez.',
  'Habla por los mensajes de aquí: son privados entre los dos. Solo los miramos si alguien los denuncia.',
  'FDS no vende, no cobra y no interviene en el pago ni en la entrega. Quedad en persona, mirad el artículo antes de pagar y no pagues nunca por adelantado.',
  'Si algo no cumple, pulsa «Denunciar». Lo revisamos y te decimos qué hemos hecho.',
]

function Normas({ onBack }) {
  return (
    <div>
      <Cabecera titulo="Normas del mercadillo" onBack={onBack} />
      <ul className="space-y-2.5">
        {NORMAS.map((n) => (
          <li key={n} className="flex gap-2.5 rounded-2xl border border-dark-700 bg-dark-900 p-3 text-[14px] leading-snug text-dark-100">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-300" /> {n}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px] leading-relaxed text-dark-400">
        Las condiciones completas están en los <a href="/terminos#mercadillo" target="_blank" rel="noreferrer" className="text-brand-300 underline">Términos</a> y
        cómo tratamos tus datos, en la <a href="/privacidad" target="_blank" rel="noreferrer" className="text-brand-300 underline">Privacidad</a>.
      </p>
    </div>
  )
}

/* ── Denunciar (anuncio o conversación) ── */
function Denunciar({ motivos, objetivo, onCerrar }) {
  const [motivo, setMotivo] = useState('')
  const [explica, setExplica] = useState('')
  const [estado, setEstado] = useState('')
  const [err, setErr] = useState('')
  const enviar = async () => {
    setEstado('enviando'); setErr('')
    try {
      await mercDenunciar({ ...objetivo, motivo, texto: explica })
      setEstado('hecho')
    } catch (e) { setErr(texto(e, 'No se ha podido enviar. Inténtalo otra vez.')); setEstado('') }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Denunciar" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-dark-700 bg-dark-950 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-bold text-dark-50">Denunciar</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1 text-dark-400"><X size={18} /></button>
        </div>
        {estado === 'hecho' ? (
          <p role="status" className="mt-3 text-[14.5px] leading-snug text-dark-100">Recibido. Lo revisamos y te diremos qué hemos decidido en tu buzón.</p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-dark-400">¿Qué pasa? Lo revisa una persona.</p>
            <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Motivo">
              {Object.entries(motivos || {}).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={motivo === k} onClick={() => setMotivo(k)}
                  className={`flex w-full rounded-xl border px-3 py-2.5 text-left text-[14px] font-semibold ${motivo === k ? 'border-brand-400 bg-brand-500/15 text-brand-100' : 'border-dark-700 text-dark-100'}`}>
                  {v}
                </button>
              ))}
            </div>
            <textarea value={explica} onChange={(e) => setExplica(e.target.value)} rows={3} maxLength={1000}
              aria-label="Explícalo" placeholder="Explícalo con tus palabras (opcional)"
              className="mt-3 w-full rounded-xl border border-dark-700 bg-dark-900 px-3 py-2 text-[15px] text-dark-50" />
            {err && <p role="alert" className="mt-1 text-[13px] text-red-300">{err}</p>}
            <button type="button" onClick={enviar} disabled={!motivo || estado === 'enviando'}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-[15px] font-bold text-white disabled:opacity-50">
              {estado === 'enviando' && <Loader2 size={16} className="animate-spin" />} Enviar denuncia
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Una tarjeta del escaparate ── */
function Tarjeta({ a, onAbrir }) {
  return (
    <button type="button" onClick={() => onAbrir(a.id)} className="overflow-hidden rounded-2xl border border-dark-700 bg-dark-900 text-left active:scale-[.98]">
      <Foto id={a.fotos?.[0]} className="aspect-square w-full" alt={a.titulo} />
      <div className="p-2.5">
        <p className="text-[16px] font-extrabold leading-tight text-dark-50">{euros(a.precio_cent)}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-dark-200">{a.titulo}</p>
        {a.zona && <p className="mt-1 truncate text-[11.5px] text-dark-400">{a.zona}</p>}
      </div>
    </button>
  )
}

function Vendedor({ v }) {
  const extra = v?.tipo === 'fds' ? 'del equipo de la app' : v?.tipo === 'autonomo' && v?.entregas ? `${v.entregas} entregas con la app` : v?.tipo === 'conductor' ? 'Repartidor' : v?.tipo === 'oficina' ? 'Equipo de oficina' : 'Repartidor autónomo'
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-dark-300">
      <BadgeCheck size={16} className="text-emerald-300" /> <b className="text-dark-100">{v?.nombre}</b> · {extra}
    </p>
  )
}

/* ── La ficha de un anuncio ── */
function Ficha({ id, motivos, estados, onBack, onChat, onEditar }) {
  const [a, setA] = useState(null)
  const [err, setErr] = useState('')
  const [i, setI] = useState(0)
  const [escribir, setEscribir] = useState(false)
  const [msg, setMsg] = useState('Hola, ¿sigue disponible?')
  const [enviando, setEnviando] = useState(false)
  const [denunciar, setDenunciar] = useState(false)
  const carrusel = useRef(null)
  useEffect(() => {
    mercAnuncio(id).then(({ data }) => setA(data)).catch((e) => setErr(texto(e, 'No se ha podido abrir el anuncio.')))
  }, [id])
  const enviar = async () => {
    setEnviando(true); setErr('')
    try {
      const { data } = await mercContactar(id, msg)
      onChat(data.conversacion_id)
    } catch (e) { setErr(texto(e, 'No se ha podido enviar. Inténtalo otra vez.')) } finally { setEnviando(false) }
  }
  if (!a) return <div><Cabecera titulo="Anuncio" onBack={onBack} />{err ? <p role="alert" className="text-[14px] text-red-300">{err}</p> : <Loader2 className="mx-auto mt-10 animate-spin text-dark-500" />}</div>
  const fotos = a.fotos || []
  return (
    <div className="pb-28">
      <Cabecera titulo={a.titulo} onBack={onBack}
        derecha={!a.mio && <button type="button" onClick={() => setDenunciar(true)} aria-label="Denunciar anuncio" className="rounded-lg p-1.5 text-dark-400"><Flag size={18} /></button>} />
      <div className="relative -mx-4">
        <div ref={carrusel} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {fotos.map((f) => <Foto key={f} id={f} className="aspect-[4/3] w-full shrink-0 snap-center" alt={a.titulo} />)}
        </div>
        {fotos.length > 1 && (
          <span className="absolute bottom-2.5 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-semibold text-white">{i + 1} / {fotos.length}</span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[26px] font-extrabold leading-none text-dark-50">{euros(a.precio_cent)}</p>
        <p className="mt-1.5 text-[18px] font-bold leading-snug text-dark-50">{a.titulo}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          <span className="rounded-full bg-dark-800 px-2.5 py-1 font-semibold text-dark-200">{estados?.[a.estado_articulo] || a.estado_articulo}</span>
          {a.zona && <span className="rounded-full bg-dark-800 px-2.5 py-1 font-semibold text-dark-200">{a.zona}</span>}
          {a.publicado_en && <span className="rounded-full bg-dark-800 px-2.5 py-1 text-dark-400">Desde el {fecha(a.publicado_en)}</span>}
        </div>
        {a.descripcion && <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-dark-200">{a.descripcion}</p>}
        <div className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 p-3"><Vendedor v={a.vendedor} /></div>
        <p className="mt-3 flex gap-2 rounded-2xl bg-amber-400/10 p-3 text-[12.5px] leading-snug text-amber-100">
          <Info size={16} className="mt-0.5 shrink-0" /> Quedad en persona y mira el artículo antes de pagar. No pagues nunca por adelantado: FDS no interviene en el pago.
        </p>
        {err && <p role="alert" className="mt-2 text-[13px] text-red-300">{err}</p>}
      </div>
      {denunciar && <Denunciar motivos={motivos} objetivo={{ anuncio_id: a.id }} onCerrar={() => setDenunciar(false)} />}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-dark-800 bg-dark-950/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {a.mio ? (
            <button type="button" onClick={() => onEditar(a)} className="w-full rounded-2xl border border-dark-700 py-3.5 text-[15px] font-bold text-dark-100">Es tu anuncio · Corregir</button>
          ) : a.estado !== 'publicado' ? (
            <p className="text-center text-[14px] font-semibold text-dark-300">Este anuncio ya no está a la venta</p>
          ) : a.conversacion_id ? (
            <button type="button" onClick={() => onChat(a.conversacion_id)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[15.5px] font-bold text-brand-tinta"><MessageCircle size={18} /> Ver la conversación</button>
          ) : escribir ? (
            <div className="flex items-end gap-2">
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={1000} autoFocus aria-label="Tu mensaje"
                className="min-w-0 flex-1 rounded-2xl border border-dark-700 bg-dark-900 px-3 py-2 text-[15px] text-dark-50" />
              <button type="button" onClick={enviar} disabled={enviando || !msg.trim()} aria-label="Enviar"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-brand-tinta disabled:opacity-50">
                {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEscribir(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[15.5px] font-bold text-brand-tinta"><MessageCircle size={18} /> Me interesa</button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Vender (o corregir) ── */
function Vender({ cats, estados, previo, onBack, onHecho, onNormas }) {
  const [fotos, setFotos] = useState(() => (previo?.fotos || []).map((id) => ({ id })))
  const [subiendo, setSubiendo] = useState(0)
  const [f, setF] = useState(() => ({
    titulo: previo?.titulo || '', precio: previo ? String((previo.precio_cent || 0) / 100).replace('.', ',') : '',
    categoria: previo?.categoria || '', estado_articulo: previo?.estado_articulo || '', zona: previo?.zona || '',
    descripcion: previo?.descripcion || '',
  }))
  const [acepto, setAcepto] = useState(false)
  const [err, setErr] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const elegir = async (e) => {
    // Contando las que aún se están subiendo: si no, eligiendo dos veces seguidas se pasaba de 6.
    const lista = [...(e.target.files || [])].slice(0, Math.max(0, 6 - fotos.length - subiendo))
    e.target.value = ''
    setErr('')
    for (const file of lista) {
      setSubiendo((n) => n + 1)
      try {
        const blob = await compressImage(file, 1600, 0.85)
        const { data } = await mercSubirFoto(blob)
        setFotos((xs) => [...xs, { id: data.id, local: URL.createObjectURL(blob) }])
      } catch (er) {
        setErr(texto(er, 'Esa foto no se ha podido subir. Prueba con otra (JPG o PNG).'))
      } finally { setSubiendo((n) => n - 1) }
    }
  }
  const enviar = async () => {
    setEnviando(true); setErr('')
    const d = { ...f, fotos: fotos.map((x) => x.id), acepto: true }
    try {
      if (previo) await mercCambiar(previo.id, d)
      else await mercCrear(d)
      onHecho()
    } catch (e) { setErr(texto(e, 'No se ha podido enviar. Inténtalo otra vez.')) } finally { setEnviando(false) }
  }
  const etiqueta = 'mt-4 block text-[13.5px] font-semibold text-dark-300'
  const input = 'mt-1.5 w-full rounded-xl border border-dark-700 bg-dark-900 px-3 py-2.5 text-[16px] text-dark-50'
  return (
    <div className="pb-6">
      <Cabecera titulo={previo ? 'Corregir anuncio' : 'Vender algo'} sub="Lo revisamos antes de publicarlo" onBack={onBack} />
      <p className="text-[13.5px] font-semibold text-dark-300">Fotos <span className="font-normal text-dark-400">(de 1 a 6)</span></p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {fotos.map((x, n) => (
          <div key={x.id} className="relative">
            {x.local ? <img src={x.local} alt={`Foto ${n + 1}`} className="aspect-square w-full rounded-xl object-cover" /> : <Foto id={x.id} className="aspect-square w-full rounded-xl" alt={`Foto ${n + 1}`} />}
            <button type="button" onClick={() => setFotos((xs) => xs.filter((y) => y.id !== x.id))} aria-label={`Quitar la foto ${n + 1}`}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
            {n === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">Portada</span>}
          </div>
        ))}
        {Array.from({ length: subiendo }).map((_, n) => <div key={`s${n}`} className="flex aspect-square items-center justify-center rounded-xl bg-dark-800"><Loader2 size={18} className="animate-spin text-dark-400" /></div>)}
        {fotos.length + subiendo < 6 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-dark-600 text-[12.5px] text-dark-300">
            <ImagePlus size={22} /> Añadir
            <input type="file" accept="image/*" multiple onChange={elegir} className="sr-only" aria-label="Añadir fotos" />
          </label>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] text-dark-400">Al subirlas les quitamos la ubicación y los datos que guarda el móvil.</p>

      <label className={etiqueta}>Qué vendes
        <input value={f.titulo} onChange={campo('titulo')} maxLength={80} placeholder="Ej.: soporte de móvil para la furgoneta" className={input} />
      </label>
      <label className={etiqueta}>Precio
        <div className="relative">
          <input value={f.precio} onChange={campo('precio')} inputMode="decimal" placeholder="0" className={`${input} pr-9`} />
          <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-[16px] text-dark-400">€</span>
        </div>
      </label>
      <p className={etiqueta}>Categoría</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(cats || {}).map(([k, v]) => <Chip key={k} activo={f.categoria === k} onClick={() => setF((x) => ({ ...x, categoria: k }))}>{v}</Chip>)}
      </div>
      <p className={etiqueta}>Estado</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(estados || {}).map(([k, v]) => <Chip key={k} activo={f.estado_articulo === k} onClick={() => setF((x) => ({ ...x, estado_articulo: k }))}>{v}</Chip>)}
      </div>
      <label className={etiqueta}>Zona <span className="font-normal text-dark-400">(ciudad o nave, sin tu dirección)</span>
        <input value={f.zona} onChange={campo('zona')} maxLength={60} placeholder="Ej.: A Coruña" className={input} />
      </label>
      <label className={etiqueta}>Cuéntalo <span className="font-normal text-dark-400">(opcional)</span>
        <textarea value={f.descripcion} onChange={campo('descripcion')} rows={4} maxLength={1000}
          placeholder="Cuánto tiempo tiene, si tiene algún defecto, qué incluye…" className={input} />
      </label>
      <label className="mt-4 flex gap-2.5 text-[13px] leading-snug text-dark-200">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>Es mío, lo que cuento es verdad y cumple las <button type="button" onClick={onNormas} className="text-brand-300 underline">normas</button> (nada de la empresa ni prohibido).</span>
      </label>
      {err && <p role="alert" className="mt-2 text-[13px] text-red-300">{err}</p>}
      <button type="button" onClick={enviar} disabled={enviando || !acepto || !fotos.length || subiendo > 0}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta disabled:opacity-50">
        {enviando && <Loader2 size={17} className="animate-spin" />} {previo ? 'Enviar a revisión' : 'Publicar'}
      </button>
      <p className="mt-2 text-center text-[12px] text-dark-400">Lo revisamos antes de que salga, normalmente el mismo día. Dura 30 días.</p>
    </div>
  )
}

/* ── Mis anuncios ── */
function MisAnuncios({ mios, onBack, onEditar, onAbrir, recargar, onVender }) {
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')
  const accion = async (a, que) => {
    if (que === 'quitar' && !window.confirm(`¿Quitar «${a.titulo}» del mercadillo?`)) return
    setOcupado(a.id); setErr('')
    try { await mercCambiar(a.id, { accion: que }); await recargar() } catch (e) { setErr(texto(e, 'No se ha podido cambiar.')) } finally { setOcupado('') }
  }
  return (
    <div>
      <Cabecera titulo="Mis anuncios" onBack={onBack} />
      {err && <p role="alert" className="mb-2 text-[13px] text-red-300">{err}</p>}
      {!mios.length ? (
        <div className="mt-8 text-center">
          <p className="text-[15px] font-semibold text-dark-100">Todavía no has puesto nada a la venta</p>
          <button type="button" onClick={onVender} className="mt-3 rounded-2xl bg-brand-500 px-5 py-3 text-[15px] font-bold text-brand-tinta">Vender algo</button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {mios.map((a) => {
            const [etq, cls] = ESTADO[a.estado] || ESTADO.pendiente
            return (
              <li key={a.id} className="rounded-2xl border border-dark-700 bg-dark-900 p-3">
                <button type="button" onClick={() => onAbrir(a.id)} className="flex w-full gap-3 text-left">
                  <Foto id={a.fotos?.[0]} className="h-16 w-16 shrink-0 rounded-xl" alt="" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-dark-50">{a.titulo}</span>
                    <span className="block text-[14px] font-extrabold text-dark-100">{euros(a.precio_cent)}</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${cls}`}>{etq}</span>
                    {a.estado === 'publicado' && <span className="ml-1.5 text-[11.5px] text-dark-400">hasta el {fecha(a.caduca)} · {a.interesados || 0} interesados</span>}
                  </span>
                </button>
                {a.motivo && ['rechazado', 'retirado'].includes(a.estado) && <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] leading-snug text-red-100">Motivo: {a.motivo}</p>}
                {a.estado === 'pendiente' && <p className="mt-2 text-[12.5px] text-dark-400">Lo estamos revisando. Te avisamos en tu buzón cuando salga.</p>}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {a.estado === 'publicado' && <button type="button" disabled={ocupado === a.id} onClick={() => accion(a, 'vendido')} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white"><Check size={14} /> Vendido</button>}
                  {['pendiente', 'publicado', 'rechazado', 'caducado'].includes(a.estado) && (
                    <button type="button" onClick={() => onEditar(a)} className="rounded-xl border border-dark-700 px-3 py-2 text-[13px] font-semibold text-dark-100">
                      {a.estado === 'caducado' ? 'Volver a publicar' : a.estado === 'rechazado' ? 'Corregir y enviar' : 'Corregir'}
                    </button>
                  )}
                  {['pendiente', 'publicado'].includes(a.estado) && <button type="button" disabled={ocupado === a.id} onClick={() => accion(a, 'quitar')} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-dark-400">Quitar</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── El buzón ── */
function Buzon({ onBack, onChat, avisos, onAvisos }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    mercBuzon().then(({ data }) => {
      setD(data)
      if ((data.avisos || []).some((x) => !x.leido)) mercAvisosLeidos().catch(() => {})
    }).catch((e) => setErr(texto(e, 'No se ha podido abrir el buzón.')))
  }, [])
  return (
    <div>
      <Cabecera titulo="Mensajes" sub="Privados entre quien compra y quien vende" onBack={onBack} />
      <AvisosMovil activo={avisos} onCambio={onAvisos} />
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
      {!d ? !err && <Loader2 className="mx-auto mt-10 animate-spin text-dark-500" /> : (
        <>
          {(d.avisos || []).length > 0 && (
            <section aria-label="Avisos de FDS" className="mb-4">
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-dark-400">Avisos de FDS</p>
              <ul className="space-y-1.5">
                {d.avisos.slice(0, 8).map((x) => (
                  <li key={x.id} className={`rounded-xl border px-3 py-2.5 text-[13px] leading-snug ${x.leido ? 'border-dark-800 text-dark-300' : 'border-brand-400/40 bg-brand-500/[.07] text-dark-100'}`}>
                    {x.texto}<span className="mt-1 block text-[11px] text-dark-500">{hora(x.ts)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!d.conversaciones.length ? (
            <p className="mt-6 text-center text-[14px] text-dark-400">Aquí te llegarán los mensajes cuando alguien se interese por lo tuyo o tú escribas a alguien.</p>
          ) : (
            <ul className="divide-y divide-dark-800 overflow-hidden rounded-2xl border border-dark-700 bg-dark-900">
              {d.conversaciones.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onChat(c.id)} className="flex w-full items-center gap-3 p-3 text-left">
                    <Foto id={c.foto} className="h-12 w-12 shrink-0 rounded-xl" alt="" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-[14.5px] ${c.sin_leer ? 'font-extrabold text-dark-50' : 'font-semibold text-dark-100'}`}>{c.con}</span>
                        <span className="shrink-0 text-[11px] text-dark-500">{hora(c.ultimo)}</span>
                      </span>
                      <span className="block truncate text-[12px] text-dark-400">{c.soy === 'vendedor' ? 'Tu anuncio' : 'Le compras'}: {c.titulo}</span>
                      <span className={`block truncate text-[13px] ${c.sin_leer ? 'font-semibold text-dark-100' : 'text-dark-400'}`}>{c.ultimo_texto}</span>
                    </span>
                    {c.sin_leer && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-400" aria-label="Sin leer" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/* ── Una conversación ── */
function Chat({ id, motivos, onBack, onAnuncio, avisos, onAvisos }) {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [denunciar, setDenunciar] = useState(false)
  const fin = useRef(null)
  const cargar = useCallback(() => mercConversacion(id).then(({ data }) => setD(data)).catch((e) => setErr(texto(e, 'No se ha podido abrir la conversación.'))), [id])
  useEffect(() => {
    cargar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar() }, 8000)
    return () => clearInterval(t)
  }, [cargar])
  const n = d?.mensajes?.length || 0
  useEffect(() => { fin.current?.scrollIntoView?.({ block: 'end' }) }, [n])
  const enviar = async () => {
    setEnviando(true); setErr('')
    try {
      const { data } = await mercResponder(id, msg)
      setD((x) => ({ ...x, mensajes: [...(x?.mensajes || []), data] }))
      setMsg('')
    } catch (e) { setErr(texto(e, 'No se ha podido enviar.')) } finally { setEnviando(false) }
  }
  if (!d) return <div><Cabecera titulo="Mensajes" onBack={onBack} />{err ? <p role="alert" className="text-[13px] text-red-300">{err}</p> : <Loader2 className="mx-auto mt-10 animate-spin text-dark-500" />}</div>
  const a = d.anuncio || {}
  return (
    <div className="pb-28">
      <Cabecera titulo={d.con} sub={d.soy === 'vendedor' ? 'Le interesa tu anuncio' : 'Vende este anuncio'} onBack={onBack}
        derecha={<button type="button" onClick={() => setDenunciar(true)} aria-label="Denunciar conversación" className="rounded-lg p-1.5 text-dark-400"><Flag size={18} /></button>} />
      <button type="button" onClick={() => a.id && onAnuncio(a.id)} className="flex w-full items-center gap-3 rounded-2xl border border-dark-700 bg-dark-900 p-2.5 text-left">
        <Foto id={a.fotos?.[0]} className="h-12 w-12 shrink-0 rounded-xl" alt="" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-dark-50">{a.titulo}</span>
          <span className="block text-[13px] text-dark-300">{a.precio_cent ? euros(a.precio_cent) : ''}{a.estado && a.estado !== 'publicado' ? ` · ${(ESTADO[a.estado] || ['Ya no está'])[0]}` : ''}</span>
        </span>
        <ChevronRight size={16} className="text-dark-500" />
      </button>
      <p className="mt-2 text-center text-[11.5px] text-dark-500">Quedad en persona y no pagues por adelantado. FDS no interviene en el pago.</p>
      <ul className="mt-3 space-y-2">
        {d.mensajes.map((m) => (
          <li key={m.id} className={`flex ${m.mio ? 'justify-end' : 'justify-start'}`}>
            <span className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3 py-2 text-[14.5px] leading-snug ${m.mio ? 'rounded-br-md bg-brand-500 text-brand-tinta' : 'rounded-bl-md border border-dark-700 bg-dark-900 text-dark-50'}`}>
              {m.texto}<span className={`mt-0.5 block text-right text-[10.5px] ${m.mio ? 'text-brand-tinta/70' : 'text-dark-500'}`}>{hora(m.ts)}</span>
            </span>
          </li>
        ))}
      </ul>
      {d.mensajes.some((m) => m.mio) && <AvisosMovil activo={avisos} onCambio={onAvisos} pregunta="¿Te avisamos en el móvil cuando te contesten?" />}
      <div ref={fin} />
      {denunciar && <Denunciar motivos={motivos} objetivo={{ conversacion_id: id }} onCerrar={() => setDenunciar(false)} />}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-dark-800 bg-dark-950/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {err && <p role="alert" className="mb-1 text-[12.5px] text-red-300">{err}</p>}
          {d.bloqueada ? (
            <p className="text-center text-[13.5px] text-dark-400">Esta conversación está cerrada.</p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={1} maxLength={1000} aria-label="Escribe un mensaje" placeholder="Escribe un mensaje"
                className="max-h-28 min-w-0 flex-1 rounded-2xl border border-dark-700 bg-dark-900 px-3 py-2.5 text-[15px] text-dark-50" />
              <button type="button" onClick={enviar} disabled={enviando || !msg.trim()} aria-label="Enviar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-brand-tinta disabled:opacity-50">
                {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── El mercadillo ── */
export default function Mercadillo({ onBack, inicio = 'lista' }) {
  const [pila, setPila] = useState(() => [{ v: inicio }])
  const actual = pila[pila.length - 1]
  const ir = (paso) => { setPila((p) => [...p, paso]); window.scrollTo?.(0, 0) }
  const atras = () => { if (pila.length > 1) setPila((p) => p.slice(0, -1)); else onBack?.() }
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState(null)
  const [cat, setCat] = useState('')
  const [err, setErr] = useState('')
  const recargar = useCallback(async () => {
    try {
      const [{ data: l }, { data: e }] = await Promise.all([mercLista(), mercEstado()])
      setDatos(l); setEstado(e); setErr('')
    } catch (e) { setErr(texto(e, 'No se ha podido abrir el mercadillo.')) }
  }, [])
  // Al entrar y al volver a la portada se refresca (un anuncio nuevo, un mensaje leído…).
  useEffect(() => { if (actual.v === 'lista' && pila.length === 1) recargar() }, [actual.v, pila.length, recargar])

  const comun = { motivos: datos?.motivos_denuncia }
  const estadosTxt = datos?.estados_articulo
  if (actual.v === 'normas') return <Marco><Normas onBack={atras} /></Marco>
  if (actual.v === 'anuncio') return <Marco><Ficha id={actual.id} {...comun} estados={estadosTxt} onBack={atras} onChat={(c) => ir({ v: 'chat', id: c })} onEditar={(a) => ir({ v: 'vender', previo: a })} /></Marco>
  const avisos = { avisos: !!estado?.avisos_movil, onAvisos: (v) => setEstado((e) => ({ ...(e || {}), avisos_movil: v })) }
  if (actual.v === 'chat') return <Marco><Chat id={actual.id} {...comun} {...avisos} onBack={atras} onAnuncio={(a) => ir({ v: 'anuncio', id: a })} /></Marco>
  if (actual.v === 'buzon') return <Marco><Buzon {...avisos} onBack={atras} onChat={(c) => ir({ v: 'chat', id: c })} /></Marco>
  if (actual.v === 'vender') {
    return (
      <Marco>
        <Vender cats={datos?.categorias} estados={datos?.estados_articulo} previo={actual.previo} onBack={atras}
          onNormas={() => ir({ v: 'normas' })}
          onHecho={async () => { await recargar(); setPila((p) => [...p.slice(0, -1).filter((x) => x.v !== 'mios'), { v: 'mios', recien: true }]) }} />
      </Marco>
    )
  }
  if (actual.v === 'mios') {
    return (
      <Marco>
        {actual.recien && <p role="status" className="mb-3 rounded-2xl bg-emerald-500/15 px-3 py-2.5 text-[14px] font-semibold text-emerald-100">Enviado. Lo revisamos y te avisamos en tu buzón cuando salga.</p>}
        {actual.recien && <div className="mb-3"><AvisosMovil {...{ activo: !!estado?.avisos_movil, onCambio: (v) => setEstado((e) => ({ ...(e || {}), avisos_movil: v })) }} pregunta="¿Te avisamos en el móvil cuando salga o alguien se interese?" /></div>}
        <MisAnuncios mios={datos?.mios || []} onBack={atras} recargar={recargar} onAbrir={(id) => ir({ v: 'anuncio', id })}
          onEditar={(a) => ir({ v: 'vender', previo: a })} onVender={() => ir({ v: 'vender' })} />
      </Marco>
    )
  }

  const lista = (datos?.anuncios || []).filter((a) => !cat || a.categoria === cat)
  const sinLeer = estado?.sin_leer || 0
  return (
    <Marco>
      <Cabecera titulo="Mercadillo" sub="Compra y vende entre repartidores. Sin comisiones." onBack={onBack}
        derecha={(
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => ir({ v: 'mios' })} aria-label="Mis anuncios" className="rounded-xl p-2 text-dark-200"><Tag size={20} /></button>
            <button type="button" onClick={() => ir({ v: 'buzon' })} aria-label={sinLeer ? `Mensajes, ${sinLeer} sin leer` : 'Mensajes'} className="relative rounded-xl p-2 text-dark-200">
              <MessageCircle size={20} />
              {sinLeer > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10.5px] font-bold text-white">{sinLeer}</span>}
            </button>
          </div>
        )} />
      {estado && estado.abierto === false && (
        <p className="mb-3 flex gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-[13px] leading-snug text-amber-100">
          <Eye size={16} className="mt-0.5 shrink-0" /> Vista previa: los repartidores todavía no lo ven. Se enciende en Negocio → Mercadillo.
        </p>
      )}
      {err && <p role="alert" className="mb-2 text-[13px] text-red-300">{err}</p>}
      <button type="button" onClick={() => ir({ v: 'vender' })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta shadow-lg shadow-brand-500/20">
        <Plus size={19} strokeWidth={2.6} /> Vender algo que no uses
      </button>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        <Chip activo={!cat} onClick={() => setCat('')}>Todo</Chip>
        {Object.entries(datos?.categorias || {}).map(([k, v]) => <Chip key={k} activo={cat === k} onClick={() => setCat(k)}>{v}</Chip>)}
      </div>
      {!datos ? !err && <Loader2 className="mx-auto mt-10 animate-spin text-dark-500" /> : !lista.length ? (
        <div className="mt-8 rounded-3xl border border-dashed border-dark-700 px-5 py-8 text-center">
          <Store size={30} className="mx-auto text-dark-500" />
          <p className="mt-2 text-[15px] font-bold text-dark-100">{cat ? 'Nada en esta categoría todavía' : 'Todavía no hay nada a la venta'}</p>
          <p className="mt-1 text-[13px] leading-snug text-dark-400">¿Tienes algo que no usas? Puede que a un compañero le venga bien.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {lista.map((a) => <Tarjeta key={a.id} a={a} onAbrir={(id) => ir({ v: 'anuncio', id })} />)}
        </div>
      )}
      <button type="button" onClick={() => ir({ v: 'normas' })} className="mx-auto mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-dark-400">
        <ShieldCheck size={15} /> Normas y seguridad
      </button>
    </Marco>
  )
}

function Marco({ children }) {
  return <div className="mx-auto min-h-screen max-w-md bg-dark-950 px-4 pb-8">{children}</div>
}
