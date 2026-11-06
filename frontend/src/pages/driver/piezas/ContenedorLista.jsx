/* diseño compacto */
/* La lista como una sola superficie (06-11-2026, §4): radio 12, sin borde exterior, separadores de 1 y sin hueco entre
   filas (filas, no tarjetas). Dentro van FilaParada u otras <li>. */

export default function ContenedorLista({ children, nombre, className = '', testid, ...resto }) {
  return (
    <ul aria-label={nombre} data-testid={testid} className={`divide-y divide-dark-800 overflow-hidden rounded-xl bg-dark-900 ${className}`} {...resto}>
      {children}
    </ul>
  )
}
