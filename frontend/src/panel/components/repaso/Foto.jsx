import { useEffect, useRef, useState } from 'react'
import SelloFoto from '../../../components/SelloFoto'

/* UNA FOTO DEL REPASO, ENTERA (14-11-2026). La furgoneta no se recorta nunca.

   En la mesa (`ajuste="foto"`, el de siempre) el marco toma la forma de la propia foto: ocupa todo el ancho que tiene
   y la altura que le toca, así que no quedan franjas grises dentro de un marco fijo. Solo si la foto es tan alta que no
   cabría en la pantalla (una vertical del móvil) se limita la altura y el marco se estrecha con ella, centrado. Hasta
   que la foto llega se reserva un 4:3, que es lo que hace casi cualquier móvil.

   En la vista ampliada (`ajuste="marco"`) es al revés: el marco lo pone quien la usa y la foto va «contenida» dentro.
   En los dos casos, lo que va encima (el rótulo «Antes»/«Hoy», el sello de fecha y la caja del golpe) se coloca sobre
   la imagen de verdad: se mide dónde ha quedado dentro del marco.

   Con `dibujar`, se arrastra sobre la foto para marcar el golpe: devuelve `[ymin, xmin, ymax, xmax]` de 0 a 1000, como
   `box_2d` en el resto de FDS. Si la foto no carga, avisa con `onFallo` (sin foto no hay dónde dibujar). */
const PROPORCION_PREVIA = 4 / 3

export default function Foto({
  url, rotulo, oscuro = false, fecha, quien, idioma = 'es', caja = null, dibujar = false, onCaja, onAbrir, onFallo,
  alt = '', textoAbrir = '', textoFallo = '', ajuste = 'foto', altoMax = 0.68, marcoCls = '', testId,
}) {
  const fuera = useRef(null)
  const marco = useRef(null)
  const [nat, setNat] = useState(null)
  const [tam, setTam] = useState(null)
  const [hueco, setHueco] = useState(null)          // { w: ancho disponible, alto: altura máxima } (ajuste «foto»)
  const [fallo, setFallo] = useState(false)
  const [trazo, setTrazo] = useState(null)

  // El tamaño del marco (para saber dónde cae la imagen) y, en la mesa, el ancho que hay para la foto.
  useEffect(() => {
    const el = marco.current
    const fu = fuera.current
    if (!el) return undefined
    const medir = () => {
      setTam({ w: el.clientWidth, h: el.clientHeight })
      if (fu) setHueco({ w: fu.clientWidth, alto: Math.max(220, Math.round(window.innerHeight * altoMax)) })
    }
    medir()
    window.addEventListener('resize', medir)
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', medir)
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    if (fu) ro.observe(fu)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [altoMax])

  // Dónde queda la imagen dentro del marco (lo mismo que hace `object-fit: contain`).
  let rect = null
  if (nat && tam && nat.w && nat.h && tam.w && tam.h) {
    const k = Math.min(tam.w / nat.w, tam.h / nat.h)
    const w = nat.w * k
    const h = nat.h * k
    rect = { left: (tam.w - w) / 2, top: (tam.h - h) / 2, width: w, height: h }
  }

  // En la mesa, el marco con la forma de la foto.
  let estiloMarco
  if (ajuste === 'foto') {
    const p = !fallo && nat?.w && nat?.h ? nat.w / nat.h : PROPORCION_PREVIA
    if (hueco?.w) {
      let w = hueco.w
      let h = w / p
      if (h > hueco.alto) { h = hueco.alto; w = h * p }
      estiloMarco = { width: Math.round(w), height: Math.round(h) }
    } else {
      estiloMarco = { width: '100%', aspectRatio: String(p) }
    }
  }

  const punto = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    }
  }
  const empezar = (e) => {
    if (!dibujar) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura: sigue funcionando dentro */ }
    const p = punto(e)
    setTrazo({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const mover = (e) => {
    if (!dibujar || !trazo) return
    const p = punto(e)
    setTrazo((t) => (t ? { ...t, x1: p.x, y1: p.y } : t))
  }
  const acabar = () => {
    if (!dibujar || !trazo) return
    const { x0, y0, x1, y1 } = trazo
    setTrazo(null)
    // Un toque sin arrastrar no es una caja.
    if (Math.abs(x1 - x0) < 0.015 || Math.abs(y1 - y0) < 0.015) return
    const r = (v) => Math.round(v * 1000)
    onCaja?.([r(Math.min(y0, y1)), r(Math.min(x0, x1)), r(Math.max(y0, y1)), r(Math.max(x0, x1))])
  }

  const vista = trazo
    ? { top: Math.min(trazo.y0, trazo.y1) * 100, left: Math.min(trazo.x0, trazo.x1) * 100,
        height: Math.abs(trazo.y1 - trazo.y0) * 100, width: Math.abs(trazo.x1 - trazo.x0) * 100 }
    : caja && caja.length === 4
      ? { top: caja[0] / 10, left: caja[1] / 10, height: (caja[2] - caja[0]) / 10, width: (caja[3] - caja[1]) / 10 }
      : null

  const capa = rect && !fallo && (
    <div
      className={`absolute ${dibujar ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
      style={rect}
      data-testid={testId ? `${testId}-capa` : undefined}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={acabar}
      onPointerCancel={() => setTrazo(null)}
    >
      {rotulo && (
        <span className={`pointer-events-none absolute left-2.5 top-2.5 rounded px-2 py-1 text-[13px] font-bold leading-none ${
          oscuro ? 'bg-[#10181a] text-white' : 'bg-white text-[#10181a]'}`}>
          {rotulo}
        </span>
      )}
      {vista && (
        <span
          className="pointer-events-none absolute rounded-lg border-[2.5px] border-[#d92d20] outline outline-[1.5px] outline-white/85"
          style={{ top: `${vista.top}%`, left: `${vista.left}%`, height: `${vista.height}%`, width: `${vista.width}%` }}
          data-testid={testId ? `${testId}-caja` : undefined}
        />
      )}
      {/* El sello no se corta nunca: en una foto estrecha baja a dos líneas. */}
      <SelloFoto fecha={fecha} quien={quien} idioma={idioma} className="!whitespace-normal" />
    </div>
  )

  const imagen = fallo ? (
    <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-dark-400" data-testid={testId ? `${testId}-fallo` : undefined}>{textoFallo}</span>
  ) : (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-contain"
      onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      onError={() => { setFallo(true); onFallo?.(url) }}
    />
  )

  const elMarco = (
    <div ref={marco} style={estiloMarco}
      className={`relative overflow-hidden rounded-xl bg-dark-800 ${ajuste === 'foto' ? 'mx-auto max-w-full' : 'w-full'} ${
        dibujar && !fallo ? 'outline-dashed outline-2 outline-offset-2 outline-dark-400' : ''} ${marcoCls}`}
      data-testid={testId}>
      {onAbrir && !dibujar && !fallo ? (
        <button type="button" onClick={onAbrir} aria-label={textoAbrir} data-atajos=""
          className="absolute inset-0 block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400">
          {imagen}
        </button>
      ) : imagen}
      {capa}
    </div>
  )

  return ajuste === 'foto' ? <div ref={fuera} className="w-full min-w-0">{elMarco}</div> : elMarco
}
