/* diseño compacto */
/* Una fila de chips en una sola línea que se desliza (06-11-2026, §4): hueco 8, sin barra y sin saltar de línea (en
   alemán tampoco). Mide 48 para que el toque de 48 de cada chip (32 visible) no se recorte con el desplazamiento. */

export default function FilaChips({ children, nombre, className = '', testid }) {
  return (
    <div role={nombre ? 'group' : undefined} aria-label={nombre} data-testid={testid}
      className={`flex min-h-12 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </div>
  )
}
