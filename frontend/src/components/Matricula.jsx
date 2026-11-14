import { esMatriculaEspanola, matriculaLegible } from '../lib/sello'

/* LA MATRÍCULA, como se ve en la furgoneta (14-11-2026). Es lo primero que reconoce quien lleva una flota, así que va
   igual en la web, en el panel y en el expediente impreso: blanca, con la banda azul y, si tiene el formato español,
   la «E». El tamaño lo da la letra del sitio donde se pone (`text-sm`, `text-xl`…). Los colores son fijos a propósito
   (una matrícula no cambia con el modo día o noche): `.matricula` en index.css. */
export default function Matricula({ texto, className = '' }) {
  const t = matriculaLegible(texto)
  if (!t) return null
  return (
    <span className={`matricula ${className}`} data-testid="matricula">
      <i aria-hidden="true">{esMatriculaEspanola(t) ? 'E' : ''}</i>
      <b>{t}</b>
    </span>
  )
}
