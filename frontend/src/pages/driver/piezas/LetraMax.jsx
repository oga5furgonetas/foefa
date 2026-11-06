/* diseño compacto */
/* El tope de letra (06-11-2026, §3.8): en la web la letra del sistema llega como zoom y no se puede topar; esto solo acota
   «Letra más grande» (--letra) en los sitios de §3.8: la etiqueta de las pestañas, la banda de la guía, las píldoras y los
   botones del mapa, las celdas de la furgoneta y la fila de contadores del escáner. `base` es el tamaño del token (12 por
   defecto, el de «etiqueta») y `max`, el tope (14). */

export default function LetraMax({ base = 12, max = 14, as: Etiqueta = 'span', className = '', children, ...resto }) {
  return (
    <Etiqueta className={className} style={{ fontSize: `min(calc(${base}px * var(--letra, 1)), ${max}px)` }} {...resto}>
      {children}
    </Etiqueta>
  )
}
