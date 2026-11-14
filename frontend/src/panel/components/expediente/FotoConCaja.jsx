import { useState } from 'react'
import SelloFoto from '../../../components/SelloFoto'

/* UNA FOTO DEL EXPEDIENTE (14-11-2026): la imagen con su proporción de verdad (sin recortar: la caja del golpe va en
   tanto por mil de la foto entera, `box_2d` = [ymin, xmin, ymax, xmax] de 0 a 1000), su sello de fecha abajo y, si
   hace falta, una etiqueta arriba («Antes», «Con el golpe»). Si la foto no carga, un hueco del mismo tamaño que lo
   dice, para que el documento no se descoloque ni enseñe un icono roto. */

function cajaValida(b) {
  if (!Array.isArray(b) || b.length !== 4) return null
  const [y0, x0, y1, x1] = b.map(Number)
  if (![y0, x0, y1, x1].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null
  if (!(y0 < y1 && x0 < x1)) return null
  return { top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }
}

export default function FotoConCaja({ src, alt, sello, quien, caja, etiqueta, rota, idioma }) {
  const [fallo, setFallo] = useState(false)
  const pos = cajaValida(caja)
  const sinFoto = !src || fallo
  return (
    <div className={`exp-foto${sinFoto ? ' exp-foto-sin' : ''}`}>
      {sinFoto
        ? <span className="exp-foto-hueco">{rota}</span>
        : <img src={src} alt={alt} loading="eager" onError={() => setFallo(true)} />}
      {!sinFoto && pos && <span className="exp-caja" style={pos} data-testid="caja-golpe" aria-hidden="true" />}
      {etiqueta && <span className="exp-etiqueta">{etiqueta}</span>}
      {sello && <SelloFoto fecha={sello} quien={quien || ''} idioma={idioma} />}
    </div>
  )
}
