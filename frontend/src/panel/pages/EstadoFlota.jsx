import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  HeartPulse, Search, X, Camera, Wrench, ChevronRight, ChevronLeft, ChevronDown, AlertTriangle,
  MessageSquareWarning, User, Gauge, CalendarClock, ImageOff, ShieldCheck, Sparkles,
} from 'lucide-react'
import { getEstadoFlota, getEstadoFlotaFicha } from '../api'
import { PageSkeleton, Skeleton } from '../components/Skeleton'

/* ESTADO DE LA FLOTA (17-10-2026). Dani: «cuál es la que peor está, con la última foto de las inspecciones,
   siempre que no esté ya en el taller; que se pueda ordenar, ver las fotos y mandarla al taller».

   Una sola pregunta por pantalla: ¿cuál mando primero? Arriba la salud de toda la flota y cuántas hay en cada
   nivel (y esos números filtran); debajo, las furgonetas de la peor a la mejor con su puesto, su nota y la
   foto marcada del peor golpe; al tocar una, su ficha: el dibujo de la furgoneta con las zonas tocadas, las
   fotos de la última inspección, cada daño con SU foto, lo que dice el conductor y «Mandar al taller», que
   abre el parte ya redactado en Órdenes. El baremo vive en el servidor (salud_flota.py) y aquí se explica. */

const NIVEL = {
  urgente: { txt: 'Taller urgente', chip: 'bg-red-500/15 text-red-300 ring-red-500/30', anillo: '#ef4444', borde: 'border-red-500/40' },
  taller: { txt: 'Necesita taller', chip: 'bg-orange-500/15 text-orange-300 ring-orange-500/30', anillo: '#f97316', borde: 'border-orange-500/30' },
  vigilar: { txt: 'Vigilar', chip: 'bg-amber-400/15 text-amber-300 ring-amber-400/30', anillo: '#fbbf24', borde: 'border-dark-700' },
  bien: { txt: 'Bien', chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', anillo: '#34d399', borde: 'border-dark-700' },
  sin_datos: { txt: 'Sin datos recientes', chip: 'bg-dark-800 text-dark-300 ring-dark-700', anillo: '#64748b', borde: 'border-dark-700' },
}
const ORDEN_NIVEL = { urgente: 0, taller: 1, vigilar: 2, sin_datos: 3, bien: 4 }
const GRAVEDAD = {
  critico: { txt: 'crítico', color: '#b91c1c', chip: 'bg-red-600/20 text-red-300' },
  grave: { txt: 'grave', color: '#ef4444', chip: 'bg-red-500/15 text-red-300' },
  moderado: { txt: 'moderado', color: '#f97316', chip: 'bg-orange-500/15 text-orange-300' },
  media: { txt: 'moderado', color: '#f97316', chip: 'bg-orange-500/15 text-orange-300' },
  // En el dibujo, amarillo: en gris un golpe leve parecía una zona sin nada.
  leve: { txt: 'leve', color: '#facc15', chip: 'bg-dark-800 text-dark-300' },
}
const ORDENES = [
  { k: 'peor', txt: 'De peor a mejor' },
  { k: 'mejor', txt: 'De mejor a peor' },
  { k: 'antigua', txt: 'Foto más antigua' },
  { k: 'matricula', txt: 'Matrícula' },
]

const plano = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

function ordenar(lista, por) {
  const xs = [...lista]
  const mat = (a, b) => String(a.matricula).localeCompare(String(b.matricula))
  if (por === 'matricula') return xs.sort(mat)
  if (por === 'mejor') return xs.sort((a, b) => b.salud - a.salud || mat(a, b))
  if (por === 'antigua') {
    const d = (f) => (f.ultima?.dias == null ? Infinity : f.ultima.dias)
    return xs.sort((a, b) => d(b) - d(a) || mat(a, b))
  }
  return xs.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] || a.salud - b.salud || mat(a, b))
}

/* «hoy», «ayer», «hace 5 días»: la antigüedad de la foto es lo que dice cuánto fiarse de la nota. */
function haceDias(d) {
  if (d == null) return 'sin inspecciones'
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  return `hace ${d} días`
}

const fechaCorta = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y.slice(2)}` : String(iso)
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/* La nota en un anillo. El color es el del nivel, no el del número: un 61 «urgente» porque la IA dice que
   no es seguro circular tiene que verse rojo aunque el número parezca aceptable. */
function Anillo({ salud, nivel, size = 52 }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, salud)) / 100
  return (
    <span className="relative inline-flex flex-none items-center justify-center" style={{ width: size, height: size }}
      aria-label={`Salud ${salud} de 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-dark-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={NIVEL[nivel]?.anillo || '#64748b'} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
      </svg>
      <span className="absolute text-[15px] font-bold tabular-nums text-dark-50" style={{ fontSize: size > 60 ? 22 : 15 }}>{salud}</span>
    </span>
  )
}

function ChipNivel({ nivel }) {
  const n = NIVEL[nivel] || NIVEL.sin_datos
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${n.chip}`}>{n.txt}</span>
}

/* La furgoneta vista desde arriba, con cada zona del color de su peor daño. Dice de un vistazo lo que Dani
   pedía con palabras: «tiene destrozados los dos laterales y la defensa». */
function Furgoneta({ zonas }) {
  const de = Object.fromEntries((zonas || []).map((z) => [z.zona, z.peor]))
  const color = (k) => GRAVEDAD[de[k]]?.color || 'transparent'
  const zona = (k, props) => (
    <rect {...props} rx="6" {...(de[k] ? { fill: color(k), fillOpacity: 0.85 } : { className: 'fill-dark-800' })}
      stroke="currentColor" strokeOpacity="0.15">
      <title>{`${{ frontal: 'Frontal', trasera: 'Trasera', lat_izq: 'Lateral izquierdo', lat_der: 'Lateral derecho' }[k]}: ${de[k] ? GRAVEDAD[de[k]].txt : 'sin daños'}`}</title>
    </rect>
  )
  return (
    <svg viewBox="0 0 120 200" className="h-[176px] w-auto flex-none text-dark-300" role="img"
      aria-label={zonas?.length ? `Zonas con daños: ${zonas.map((z) => `${z.nombre} ${GRAVEDAD[z.peor]?.txt || z.peor}`).join(', ')}` : 'Sin daños'}>
      {/* ruedas */}
      {[[8, 36], [100, 36], [8, 144], [100, 144]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="12" height="26" rx="4"
          fill={de.ruedas ? color('ruedas') : 'currentColor'} fillOpacity={de.ruedas ? 0.85 : 0.35} />
      ))}
      {zona('frontal', { x: 22, y: 6, width: 76, height: 30 })}
      {zona('lat_izq', { x: 22, y: 40, width: 16, height: 124 })}
      {zona('lat_der', { x: 82, y: 40, width: 16, height: 124 })}
      {zona('trasera', { x: 22, y: 168, width: 76, height: 26 })}
      {/* techo / carga, neutro */}
      <rect x="42" y="40" width="36" height="124" rx="6" fill="currentColor" fillOpacity="0.08" />
      <text x="60" y="25" textAnchor="middle" className="fill-current" fontSize="9" opacity="0.8">DELANTE</text>
      <text x="60" y="184" textAnchor="middle" className="fill-current" fontSize="9" opacity="0.8">DETRÁS</text>
    </svg>
  )
}

function Foto({ src, alt, className = '', onClick }) {
  const [mal, setMal] = useState(false)
  if (!src || mal) {
    return (
      <span className={`flex items-center justify-center bg-dark-800/60 text-dark-500 ${className}`}>
        <ImageOff size={20} aria-hidden="true" />
      </span>
    )
  }
  // El tamaño va en el envoltorio y la foto lo llena: un <button> en bloque NO ocupa el ancho de su caja (se
  // ajusta a lo que lleva dentro), y con la foto al 100 % de eso la galería salía con alto cero.
  const img = <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setMal(true)} className="h-full w-full object-cover" />
  return onClick
    ? <button type="button" onClick={onClick} className={`block overflow-hidden ${className}`} aria-label={`Ampliar: ${alt}`}>{img}</button>
    : <span className={`block overflow-hidden ${className}`}>{img}</span>
}

/* Las fotos a pantalla completa, con flechas y Escape. */
function Visor({ fotos, inicio, onClose }) {
  const [i, setI] = useState(inicio)
  const n = fotos.length
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n)
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [n, onClose])
  const f = fotos[i]
  if (!f) return null
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-[14px] font-semibold">{f.titulo}</span>
        {f.sub && <span className="text-[12.5px] text-white/60">{f.sub}</span>}
        <span className="ml-auto text-[12.5px] tabular-nums text-white/60">{i + 1} / {n}</span>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Cerrar"><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.stopPropagation()}>
        <img src={f.src} alt={f.titulo} className="max-h-full max-w-full rounded-lg object-contain" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => setI((x) => (x + 1) % n)} aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
    </div>
  )
}

function Tarjeta({ f, puesto, onAbrir }) {
  const n = NIVEL[f.nivel] || NIVEL.sin_datos
  const viejo = f.ultima?.dias != null && f.ultima.dias > 7
  return (
    <button type="button" onClick={onAbrir}
      className={`card group flex flex-col overflow-hidden border text-left transition hover:border-brand-500/50 active:scale-[.99] ${n.borde}`}>
      <span className="relative block aspect-[16/9] w-full overflow-hidden bg-dark-800/60">
        <Foto src={f.portada} alt={`Última foto de ${f.matricula}`} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
        {puesto && (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-black/60 px-2 py-0.5 font-mono text-[12px] font-bold text-white backdrop-blur">#{puesto}</span>
        )}
        <span className="absolute right-2.5 top-2.5"><ChipNivel nivel={f.nivel} /></span>
      </span>
      <span className="flex items-start gap-3 p-3.5">
        <Anillo salud={f.salud} nivel={f.nivel} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] font-bold text-dark-50">{f.matricula}</span>
            <span className="truncate text-[12px] text-dark-500">{[f.modelo, f.center].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-dark-200">{f.resumen}</span>
          {(!!f.urgencias?.length || f.itv_vencida) && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {(f.urgencias || []).slice(0, 2).map((u) => (
                <span key={u} className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-red-300">
                  <AlertTriangle size={11} aria-hidden="true" />{u}
                </span>
              ))}
              {f.itv_vencida && (
                <span className="inline-flex items-center gap-1 rounded-md bg-dark-800 px-1.5 py-0.5 text-[11.5px] text-dark-300">
                  <CalendarClock size={11} aria-hidden="true" />ITV vencida en la ficha
                </span>
              )}
            </span>
          )}
          <span className={`mt-1.5 flex items-center gap-1 text-[11.5px] ${viejo ? 'text-amber-300' : 'text-dark-500'}`}>
            <Camera size={11} aria-hidden="true" />
            Última foto {haceDias(f.ultima?.dias)}{f.ultima?.conductor ? ` · ${f.ultima.conductor}` : ''}
          </span>
        </span>
      </span>
    </button>
  )
}

function Ficha({ id, resumen, puedeTaller, onClose }) {
  const nav = useNavigate()
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  const [marcas, setMarcas] = useState(true)
  const [visor, setVisor] = useState(null)

  useEffect(() => {
    let vivo = true
    setF(null); setErr('')
    getEstadoFlotaFicha(id)
      .then(({ data }) => { if (vivo) setF(data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.detail || 'No se pudo abrir la ficha.') })
    return () => { vivo = false }
  }, [id])

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape' && !visor) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, visor])

  const galeria = useMemo(() => (f?.fotos || []).map((x) => ({
    src: (marcas && x.anotada) || x.url, titulo: x.nombre, sub: x.anotada && marcas ? 'con la marca de la IA' : '',
  })), [f, marcas])

  const mandar = () => {
    try { sessionStorage.setItem('estado_flota_parte', JSON.stringify({ vehicle_id: f.vehicle_id, parte: f.parte || '' })) } catch { /* sin almacenamiento: el parte sale del libro */ }
    nav(`/panel/ordenes?parte=${encodeURIComponent(f.vehicle_id)}`)
  }

  const cab = f || resumen || {}
  const algoQueNoSeVe = f && (f.mecanica?.length || f.checklist_mal?.length || f.ultima?.nota || f.notas_anteriores?.length
    || f.averias_detalle?.length || f.itv_vencida)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Estado de ${cab.matricula || 'la furgoneta'}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[640px] flex-col overflow-hidden border-l border-dark-800 bg-dark-950 shadow-2xl sm:rounded-l-2xl">
        {/* Cabecera fija: quién es, cómo está y la acción. */}
        <header className="flex items-center gap-3 border-b border-dark-800 px-4 py-3">
          {cab.salud != null && <Anillo salud={cab.salud} nivel={cab.nivel} size={56} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-[18px] font-bold text-dark-50">{cab.matricula}</h2>
              {cab.nivel && <ChipNivel nivel={cab.nivel} />}
            </div>
            <p className="truncate text-[12.5px] text-dark-400">{[cab.modelo, cab.center].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-dark-400 hover:bg-dark-800 hover:text-dark-100" aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {err && <p className="m-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
          {!f && !err && (
            <div className="space-y-3 p-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
          )}
          {f && (
            <div className="space-y-5 p-4">
              {/* Ya en el taller: no se manda otra vez. */}
              {f.en_taller ? (
                <p className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-[13.5px] text-sky-200">
                  <Wrench size={16} aria-hidden="true" />
                  Ya está en el taller{f.en_taller.orden ? ` · ${f.en_taller.orden}` : ''}{f.en_taller.taller ? ` · ${f.en_taller.taller}` : ''} · {f.en_taller.estado}
                </p>
              ) : puedeTaller && (f.nivel === 'urgente' || f.nivel === 'taller' || f.danos > 0 || f.mecanica?.length) ? (
                <button type="button" onClick={mandar}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-4 py-3 text-[14.5px] font-semibold text-white shadow hover:brightness-110">
                  <Wrench size={17} aria-hidden="true" /> Mandar al taller
                  <span className="text-[12px] font-normal text-white/80">· el parte va ya redactado</span>
                </button>
              ) : null}

              {/* Las zonas y por qué la nota. */}
              {/* En el móvil, el dibujo encima y el porqué debajo: al lado no le quedaban ni 100 px al texto. */}
              <section className="flex flex-col gap-4 rounded-2xl border border-dark-800 bg-dark-900/60 p-4 sm:flex-row">
                <div className="flex flex-none flex-col items-center gap-2">
                  <Furgoneta zonas={f.zonas} />
                  <p className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[10.5px] text-dark-500" aria-hidden="true">
                    {['leve', 'moderado', 'grave', 'critico'].map((k) => (
                      <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: GRAVEDAD[k].color }} />{GRAVEDAD[k].txt}</span>
                    ))}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-dark-400">Por qué esta nota</h3>
                  {f.motivos?.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {f.motivos.slice(0, 8).map((m, k) => (
                        <li key={k} className="flex items-baseline gap-2 text-[13px]">
                          <span className="w-10 flex-none text-right font-mono text-[12px] tabular-nums text-red-300">−{m.puntos}</span>
                          <span className="text-dark-200">{m.texto}</span>
                        </li>
                      ))}
                      {f.motivos.length > 8 && <li className="pl-12 text-[12px] text-dark-500">y {f.motivos.length - 8} cosas más de poco peso</li>}
                    </ul>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-emerald-300"><ShieldCheck size={15} aria-hidden="true" /> Nada pendiente.</p>
                  )}
                  {f.ultima?.fecha && (
                    <p className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${f.ultima.dias > 7 ? 'text-amber-300' : 'text-dark-500'}`}>
                      <span className="inline-flex items-center gap-1"><Camera size={12} aria-hidden="true" />Inspección {haceDias(f.ultima.dias)} ({fechaCorta(f.ultima.fecha)})</span>
                      {f.ultima.conductor && <span className="inline-flex items-center gap-1"><User size={12} aria-hidden="true" />{f.ultima.conductor}</span>}
                      {f.ultima.km && <span className="inline-flex items-center gap-1"><Gauge size={12} aria-hidden="true" />{Number(f.ultima.km).toLocaleString('es-ES')} km</span>}
                    </p>
                  )}
                </div>
              </section>

              {/* Las fotos de la última inspección. */}
              {!!f.fotos?.length && (
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-dark-100">Fotos de la última inspección</h3>
                    {f.fotos.some((x) => x.anotada) && (
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12.5px] text-dark-400">
                        <input type="checkbox" checked={marcas} onChange={(e) => setMarcas(e.target.checked)} className="accent-brand-500" />
                        Marcas de la IA
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {f.fotos.map((x, k) => (
                      <figure key={x.url} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-dark-800">
                        <Foto src={(marcas && x.anotada) || x.url} alt={x.nombre} className="h-full w-full"
                          onClick={() => setVisor({ fotos: galeria, i: k })} />
                        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-[11.5px] font-medium text-white">
                          {x.nombre}{marcas && x.anotada ? ' · marcada' : ''}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {/* Cada daño con SU foto. */}
              {!!f.danos_detalle?.length && (
                <section>
                  <h3 className="mb-2 text-[14px] font-semibold text-dark-100">Daños ({f.danos_detalle.length})</h3>
                  <ul className="divide-y divide-dark-800 overflow-hidden rounded-xl border border-dark-800">
                    {f.danos_detalle.map((d, k) => {
                      const g = GRAVEDAD[d.severity] || GRAVEDAD.leve
                      return (
                        <li key={k} className="flex items-center gap-3 bg-dark-900/40 p-2.5">
                          <Foto src={d.foto} alt={d.pieza} className="h-16 w-20 flex-none rounded-lg"
                            onClick={d.foto ? () => setVisor({ fotos: [{ src: d.foto, titulo: d.pieza, sub: d.foto_fecha ? `foto del ${fechaCorta(d.foto_fecha)}` : '' }], i: 0 }) : undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-dark-100">
                              {d.pieza || 'Chapa'}
                              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${g.chip}`}>{g.txt}</span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-dark-400">
                              {d.zona} · {d.humano ? 'confirmado por una persona' : 'lo vio la IA'}
                            </p>
                            <p className="text-[11.5px] text-dark-500">
                              {d.en_ultima ? 'Se ve en la última inspección' : `Visto el ${fechaCorta(d.desde)}; no sale en la última foto`}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {/* Lo que las fotos no ven. */}
              {algoQueNoSeVe && (
                <section className="rounded-2xl border border-dark-800 bg-dark-900/60 p-4">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-dark-100">
                    <MessageSquareWarning size={16} className="text-amber-300" aria-hidden="true" /> Lo que las fotos no ven
                  </h3>
                  <div className="mt-2.5 space-y-2.5 text-[13px]">
                    {!!f.mecanica?.length && (
                      <p className="flex flex-wrap gap-1.5">
                        {f.mecanica.map((m) => (
                          <span key={m.categoria} className={`rounded-md px-2 py-0.5 text-[12px] font-medium ${m.urgente ? 'bg-red-500/15 text-red-300' : 'bg-amber-400/15 text-amber-300'}`}>
                            {m.nombre} · {m.origen === 'nota' ? 'lo escribe el conductor' : 'marcado en el checklist'}
                          </span>
                        ))}
                      </p>
                    )}
                    {f.ultima?.nota && (
                      <blockquote className="border-l-2 border-amber-400/60 pl-3 text-dark-200">
                        «{f.ultima.nota}»
                        <span className="mt-0.5 block text-[11.5px] text-dark-500">{f.ultima.conductor || 'El conductor'}, {haceDias(f.ultima.dias)}</span>
                      </blockquote>
                    )}
                    {!!f.checklist_mal?.length && (
                      <p className="text-dark-300">
                        Checklist: {f.checklist_mal.map((c) => `${c.item} ${c.valor}`).join(' · ')}
                      </p>
                    )}
                    {!!f.averias_detalle?.length && f.averias_detalle.map((a) => (
                      <p key={a.id || a.titulo} className="flex items-start gap-1.5 text-dark-200">
                        <AlertTriangle size={14} className="mt-0.5 flex-none text-orange-300" aria-hidden="true" />
                        <span>Avería abierta: {a.titulo} <span className="text-dark-500">({GRAVEDAD[String(a.severity).toLowerCase()]?.txt || a.severity}, {haceDias(a.dias)})</span></span>
                      </p>
                    ))}
                    {f.itv_vencida && (
                      <p className="flex items-start gap-1.5 text-dark-300">
                        <CalendarClock size={14} className="mt-0.5 flex-none" aria-hidden="true" />
                        <span>La ficha dice que la ITV venció el {fechaCorta(f.itv_fecha)}. Si ya la ha pasado, actualiza la fecha en Vencimientos. No resta de la nota.</span>
                      </p>
                    )}
                    {!!f.notas_anteriores?.length && (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-[12.5px] text-dark-400 hover:text-dark-200">
                          <ChevronDown size={13} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                          {plural(f.notas_anteriores.length, 'aviso anterior', 'avisos anteriores')} de los conductores (14 días)
                        </summary>
                        <ul className="mt-1.5 space-y-1.5">
                          {f.notas_anteriores.map((n, k) => (
                            <li key={k} className="text-[12.5px] text-dark-300">
                              «{n.texto}» <span className="text-dark-500">— {n.conductor || 'conductor'}, {fechaCorta(n.fecha)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </section>
              )}

              {!!f.parte && !f.en_taller && (
                <details className="group rounded-xl border border-dark-800 px-3.5 py-2.5">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-dark-300">
                    <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /> El parte que le llegará al taller
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-dark-200">{f.parte}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      </aside>
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} onClose={() => setVisor(null)} />}
    </div>
  )
}

export default function EstadoFlota() {
  const { center, ve } = useOutletContext() || {}
  const nav = useNavigate()
  const puede = (to) => (typeof ve === 'function' ? ve(to) : true)
  const [params, setParams] = useSearchParams()
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [nivel, setNivel] = useState('')
  const [orden, setOrden] = useState('peor')
  const [busca, setBusca] = useState('')
  const abierta = params.get('v') || ''

  useEffect(() => {
    let vivo = true
    setDatos(null); setErr('')
    getEstadoFlota(center)
      .then(({ data }) => { if (vivo) setDatos(data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.detail || 'No se pudo cargar el estado de la flota.') })
    return () => { vivo = false }
  }, [center])

  const abrir = useCallback((id) => {
    const p = new URLSearchParams(params)
    if (id) p.set('v', id)
    else p.delete('v')
    setParams(p, { replace: true })
  }, [params, setParams])
  const cerrar = useCallback(() => abrir(''), [abrir])

  const todas = useMemo(() => datos?.furgonetas || [], [datos])
  // El puesto es siempre el de «de peor a mejor», ordenes como ordenes la lista: «la peor, la siguiente…».
  const puestos = useMemo(() => Object.fromEntries(ordenar(todas, 'peor').map((f, k) => [f.vehicle_id, k + 1])), [todas])
  const lista = useMemo(() => {
    const q = plano(busca)
    return ordenar(todas.filter((f) => (!nivel || f.nivel === nivel) && (!q || plano(f.matricula).includes(q))), orden)
  }, [todas, nivel, busca, orden])

  if (err) return <p className="p-4 text-red-400">{err}</p>
  if (!datos) return <PageSkeleton kpis={5} rows={6} />

  const nv = datos.niveles || {}
  const enTaller = datos.en_taller || []
  const resumen = todas.find((f) => f.vehicle_id === abierta)

  return (
    <div className="mx-auto max-w-6xl">
      <header className="rise pb-5 pt-2">
        <h1 className="flex items-center gap-2.5 font-display text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.02em] text-dark-50">
          <HeartPulse size={26} className="text-brand-400" aria-hidden="true" /> Estado de la flota
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-dark-400">
          Las que no están en el taller, de la que peor está a la que mejor, con la última inspección de cada una.
          Toca una para ver sus fotos y mandarla al taller.
        </p>
      </header>

      {/* La salud de toda la flota y cuántas hay en cada nivel. Los números filtran. */}
      <section className="rise mb-4 grid gap-3 lg:grid-cols-[minmax(0,240px)_1fr]" style={{ animationDelay: '30ms' }}>
        <div className="card flex items-center gap-4 p-4">
          <Anillo salud={datos.salud_media ?? 0} nivel={datos.salud_media == null ? 'sin_datos'
            : datos.salud_media >= 85 ? 'bien' : datos.salud_media >= 70 ? 'vigilar' : 'taller'} size={76} />
          <div>
            <p className="text-[13px] font-semibold text-dark-100">Salud media</p>
            <p className="text-[12px] leading-snug text-dark-500">
              {datos.salud_media == null ? 'Sin inspecciones recientes' : `de ${plural(datos.evaluadas - (nv.sin_datos || 0), 'furgoneta', 'furgonetas')} con inspección reciente`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
          {['urgente', 'taller', 'vigilar', 'bien', 'sin_datos'].map((k) => (
            <button key={k} type="button" onClick={() => setNivel((x) => (x === k ? '' : k))} aria-pressed={nivel === k}
              className={`card flex flex-col items-start justify-between border p-2.5 text-left transition hover:border-brand-500/50 sm:p-3 ${
                nivel === k ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-dark-800'}`}>
              <span className="text-[22px] font-bold leading-none tabular-nums sm:text-[26px]" style={{ color: nv[k] ? NIVEL[k].anillo : undefined }}>{nv[k] || 0}</span>
              <span className="mt-1.5 text-[11.5px] font-medium leading-tight text-dark-300 sm:text-[12.5px]">{NIVEL[k].txt}</span>
            </button>
          ))}
          <a href="#en-taller" className="card flex flex-col items-start justify-between border border-dark-800 p-2.5 transition hover:border-brand-500/50 sm:p-3">
            <span className="text-[22px] font-bold leading-none tabular-nums text-sky-300 sm:text-[26px]">{enTaller.length}</span>
            <span className="mt-1.5 text-[11.5px] font-medium leading-tight text-dark-300 sm:text-[12.5px]">Ya en el taller</span>
          </a>
        </div>
      </section>

      <details className="group mb-4 rounded-xl border border-dark-800 px-4 py-2.5 text-[13px]">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-dark-300 hover:text-dark-100">
          <Sparkles size={14} className="text-brand-400" aria-hidden="true" /> Cómo se calcula la nota
          <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 grid gap-x-8 gap-y-1.5 text-[12.5px] leading-relaxed text-dark-300 md:grid-cols-2">
          <p>Se empieza en 100 y se resta por cada cosa pendiente. <b className="text-dark-100">Chapa</b>, según la última inspección
            contrastada con el historial de daños: crítico 35, grave 18, moderado 7, leve 2. Lo que solo ha visto la IA resta un 70 %;
            lo que confirmó una persona, entero. Lo que una persona descartó no cuenta.</p>
          <p><b className="text-dark-100">Lo que las fotos no ven</b>, dicho por el conductor en esa inspección: frenos o dirección 30
            (urgente), motor 18, neumáticos o puertas 12, luces, visibilidad o batería 7. Averías abiertas de los últimos 30 días.
            Lo del conductor vale 14 días.</p>
          <p><b className="text-red-300">Taller urgente</b>: {datos.baremo?.urgente ?? 45} puntos o más, o algo que no puede esperar
            (frenos, avería crítica, daño crítico confirmado, la IA dice que no es seguro circular).
            <b className="text-orange-300"> Necesita taller</b>: {datos.baremo?.taller ?? 22} o más, o un daño grave confirmado.
            <b className="text-amber-300"> Vigilar</b>: {datos.baremo?.vigilar ?? 7} o más.</p>
          <p>Sin inspección en 30 días no se dice «Bien»: sale como <b className="text-dark-100">sin datos recientes</b>.
            La ITV no resta (se ve aparte y se arregla en Vencimientos).</p>
        </div>
      </details>

      {/* Buscar y ordenar. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" aria-hidden="true" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar matrícula" aria-label="Buscar matrícula"
            className="w-full rounded-xl border border-dark-800 bg-dark-900 py-2 pl-9 pr-3 text-[13.5px] text-dark-100 placeholder:text-dark-500 focus:border-brand-500 focus:outline-none" />
        </label>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar"
          className="rounded-xl border border-dark-800 bg-dark-900 px-3 py-2 text-[13.5px] text-dark-100 focus:border-brand-500 focus:outline-none">
          {ORDENES.map((o) => <option key={o.k} value={o.k}>{o.txt}</option>)}
        </select>
        {nivel && (
          <button type="button" onClick={() => setNivel('')}
            className="inline-flex items-center gap-1 rounded-xl bg-brand-500/15 px-3 py-2 text-[12.5px] font-medium text-brand-300 hover:bg-brand-500/25">
            {NIVEL[nivel].txt} <X size={13} aria-hidden="true" />
          </button>
        )}
        <span className="ml-auto text-[12.5px] tabular-nums text-dark-500">{plural(lista.length, 'furgoneta', 'furgonetas')}</span>
      </div>

      {todas.length === 0 ? (
        <p className="card p-6 text-center text-[14px] text-dark-400">
          {enTaller.length ? 'Todas las furgonetas están en el taller.' : 'Todavía no hay furgonetas dadas de alta.'}
        </p>
      ) : lista.length === 0 ? (
        <p className="card p-6 text-center text-[14px] text-dark-400">Ninguna furgoneta coincide con el filtro.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => (
            <Tarjeta key={f.vehicle_id} f={f} puesto={puestos[f.vehicle_id]} onAbrir={() => abrir(f.vehicle_id)} />
          ))}
        </div>
      )}

      {/* Las que ya están en el taller: aparte, para que se vea por qué no salen en la lista. */}
      {!!enTaller.length && (
        <section id="en-taller" className="mt-6 scroll-mt-20">
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-dark-100">
            <Wrench size={16} className="text-sky-300" aria-hidden="true" /> Ya en el taller ({enTaller.length})
          </h2>
          <ul className="divide-y divide-dark-800 overflow-hidden rounded-xl border border-dark-800">
            {enTaller.map((x) => (
              <li key={x.vehicle_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-dark-900/40 px-4 py-2.5 text-[13px]">
                <span className="font-mono font-semibold text-dark-100">{x.matricula}</span>
                <span className="text-dark-400">{x.center}</span>
                <span className="text-dark-300">{x.orden ? `${x.orden} · ${x.estado}` : x.estado}{x.taller ? ` · ${x.taller}` : ''}</span>
                {x.entrega && <span className="text-dark-500">vuelve el {fechaCorta(x.entrega)}</span>}
                {puede('/panel/ordenes') && (
                  <button type="button" onClick={() => nav('/panel/ordenes')}
                    className="ml-auto text-[12.5px] text-brand-300 hover:text-brand-200">Órdenes →</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {abierta && <Ficha id={abierta} resumen={resumen} puedeTaller={puede('/panel/ordenes')} onClose={cerrar} />}
    </div>
  )
}
