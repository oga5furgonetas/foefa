import { useEffect, useRef, useState } from 'react'
import SelloFoto from '../../../components/SelloFoto'

/* UNA FOTO DEL REPASO, ENTERA (14-11-2026). La furgoneta no se recorta nunca: la foto va «contenida» en su marco y
   todo lo que va encima (el rótulo «Antes»/«Hoy», el sello de fecha y la caja del golpe) se coloca sobre la imagen de
   verdad, no sobre el marco. Para eso se mide dónde ha quedado la imagen dentro del marco: sin medirlo, el sello caería
   en la franja vacía de los lados y la caja de un golpe no coincidiría con el golpe.

   Con `dibujar`, se arrastra sobre la foto para marcar el golpe: devuelve `[ymin, xmin, ymax, xmax]` de 0 a 1000, como
   `box_2d` en el resto de FDS. */
export default function Foto({
  url, rotulo, oscuro = false, fecha, quien, caja = null, dibujar = false, onCaja, onAbrir, alt = '',
  textoAbrir = '', textoFallo = '', textoDibuja = '', marcoCls = 'aspect-[4/3]', testId,
}) {
  const marco = useRef(null)
  const [nat, setNat] = useState(null)
  const [tam, setTam] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [trazo, setTrazo] = useState(null)

  useEffect(() => {
    const el = marco.current
    if (!el) return undefined
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
    medir()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Dónde queda la imagen dentro del marco (lo mismo que hace `object-fit: contain`).
  let rect = null
  if (nat && tam && nat.w && nat.h && tam.w && tam.h) {
    const k = Math.min(tam.w / nat.w, tam.h / nat.h)
    const w = nat.w * k
    const h = nat.h * k
    rect = { left: (tam.w - w) / 2, top: (tam.h - h) / 2, width: w, height: h }
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

  const capa = rect && (
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
      {dibujar && !vista && textoDibuja && (
        <span className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-max max-w-[90%] -translate-y-1/2 rounded bg-[#10181a]/85 px-3 py-2 text-center text-[13px] font-semibold text-white">
          {textoDibuja}
        </span>
      )}
      <SelloFoto fecha={fecha} quien={quien} />
    </div>
  )

  const imagen = fallo ? (
    <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-dark-400">{textoFallo}</span>
  ) : (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-contain"
      onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      onError={() => setFallo(true)}
    />
  )

  return (
    <div ref={marco} className={`relative w-full overflow-hidden rounded-xl bg-dark-800 ${marcoCls}`} data-testid={testId}>
      {onAbrir && !dibujar && !fallo ? (
        <button type="button" onClick={onAbrir} aria-label={textoAbrir}
          className="absolute inset-0 block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400">
          {imagen}
        </button>
      ) : imagen}
      {capa}
    </div>
  )
}
