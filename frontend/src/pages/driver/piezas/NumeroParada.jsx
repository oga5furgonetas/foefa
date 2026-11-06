/* diseño compacto */
/* El número de una parada (06-11-2026, §4): una píldora de 32 (la fila), 40 (la siguiente, la hoja y la guía) u 80 (el
   paquete encontrado), con el ancho mínimo igual al alto, que crece con tres cifras. Cifra tabular 16/700, 18/700 o 40/800.
   Siguiente: relleno de marca; pendiente: tinte de marca; hecha: chip neutro; fallida: tinte de peligro. Sin número, «·». */

const ESTADOS = {
  siguiente: 'bg-brand-500 text-brand-tinta',
  pendiente: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  hecha: 'bg-dark-800 text-dark-400',
  fallida: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
}
const TAMANOS = {
  fila: 'h-8 min-w-8 px-2 text-nombre font-bold',
  siguiente: 'h-10 min-w-10 px-2 text-titulo',
  paquete: 'h-20 min-w-20 px-3 text-paquete',
}

export default function NumeroParada({ n, tam = 'fila', estado = 'pendiente', className = '', testid }) {
  return (
    <span data-testid={testid}
      className={`inline-flex shrink-0 items-center justify-center rounded-full tabular-nums ${TAMANOS[tam] || TAMANOS.fila} ${ESTADOS[estado] || ESTADOS.pendiente} ${className}`}>
      {n ?? '·'}
    </span>
  )
}
