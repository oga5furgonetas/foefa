/* EL CENTRO ESCRITO COMO LAS PASTILLAS DE ARRIBA (11-11-2026, revisión de la flota propia, portal_inicio-1 y cuadrante-3).

   Lo que llega de fuera (el centro de una salida del cuadrante, el `?centro=` de la dirección de un aviso) no siempre
   se escribe igual que las pastillas del selector: «oga5», «AMZL OGA5 SANTIAGO». Si se elige tal cual, PanelLayout lo
   ve como un centro que no se puede ver y vuelve a «Todos», y el toque no sirve de nada. Aquí se casa contra los
   centros de esa persona: primero igual (sin mayúsculas), después contenido. Sin casar, null: no se elige nada. */
export default function casarCentro(valor, centers) {
  const v = String(valor || '').trim().toUpperCase()
  const cs = (centers || []).filter((c) => c && c !== 'Todos')
  if (!v) return null
  return cs.find((c) => c.toUpperCase() === v) || cs.find((c) => v.includes(c.toUpperCase())) || null
}
