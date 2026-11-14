import { useRef, useState } from 'react'

/* Comparador antes/después con divisor arrastrable.

   Por defecto (Revisión rápida): la base es la foto de REFERENCIA (antes) y por encima, recortada desde la izquierda,
   la ACTUAL. Arrastra el divisor para revelar el cambio.

   Con `antesIzquierda` (el repaso del día, 14-11-2026) es al revés, para que el deslizador ponga cada foto en el mismo
   sitio que «una junto a otra»: la anterior a la izquierda y la de hoy a la derecha. Entonces la base es la de hoy, y
   `caja` ([ymin, xmin, ymax, xmax] de 0 a 1000) se pinta sobre ella, solo en la parte donde se ve. Con
   `rotulos={false}` no pinta sus chapas: las pone quien lo usa, con su estilo. */
export default function CompareSlider({
  beforeUrl, afterUrl, etiquetaAhora = 'AHORA', etiquetaAntes = 'ANTES (referencia)',
  altAntes = 'Referencia (antes)', altAhora = 'Actual (ahora)', antesIzquierda = false, caja = null, rotulos = true,
}) {
  const [pos, setPos] = useState(50)
  const boxRef = useRef(null)

  function move(clientX) {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)))
  }

  const base = antesIzquierda ? { src: afterUrl, alt: altAhora } : { src: beforeUrl, alt: altAntes }
  const encima = antesIzquierda ? { src: beforeUrl, alt: altAntes } : { src: afterUrl, alt: altAhora }
  const hayCaja = antesIzquierda && Array.isArray(caja) && caja.length === 4

  return (
    <div
      ref={boxRef}
      className="relative select-none overflow-hidden"
      onMouseDown={(e) => move(e.clientX)}
      onMouseMove={(e) => e.buttons === 1 && move(e.clientX)}
      onTouchStart={(e) => move(e.touches[0].clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img src={base.src} alt={base.alt} className="block w-full" draggable={false} />
      {hayCaja && (
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <span className="absolute rounded-lg border-[2.5px] border-[#d92d20] outline outline-[1.5px] outline-white/85"
            data-testid="deslizador-caja"
            style={{ top: `${caja[0] / 10}%`, left: `${caja[1] / 10}%`, height: `${(caja[2] - caja[0]) / 10}%`, width: `${(caja[3] - caja[1]) / 10}%` }} />
        </div>
      )}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={encima.src} alt={encima.alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      </div>

      {/* Divisor */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="h-full w-0.5 bg-white/90" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 text-[11px] font-black text-black shadow-lg">
          ⇄
        </div>
      </div>

      {/* COLOR LITERAL, NO `text-orange-300`, Y ES A PROPOSITO.
          Estas dos chapas van sobre la FOTO, en un fondo negro al 75 %, asi
          que tienen que seguir claras en los tres temas. El modo claro
          compensa los pasteles 300 a tonos oscuros —para que se lean sobre
          papel— y eso aqui las dejaba en 2:1, ilegibles. Un valor literal no
          lo toca ninguna compensacion. Medido por `check-contraste.mjs`. */}
      {rotulos && (
        <>
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold text-[#fdba74]">
            {etiquetaAhora}
          </span>
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold text-[#6ee7b7]">
            {etiquetaAntes}
          </span>
        </>
      )}
    </div>
  )
}
