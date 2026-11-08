/* diseño compacto */
/* El número de una parada (06-11-2026, §4): una píldora de 32 (la fila), 40 (la siguiente, la hoja y la guía) u 80 (el
   paquete encontrado), con el ancho mínimo igual al alto, que crece con tres cifras. Cifra tabular 16/700, 18/700 o 40/800.
   Siguiente: relleno de marca; pendiente: tinte de marca; hecha: chip neutro; fallida: tinte de peligro. Sin número, «·».
   Relleno 4 (no 8) en la fila y la siguiente (RW, 08-11-2026, como la nativa): con 8, dos cifras en 16/700 ya ensanchaban la
   píldora (≈ 20 + 16 = 36 > 32) y el nombre de las filas 10 en adelante quedaba unos 4 px más a la derecha que el de las
   filas 2 a 9; con 4 caben dos cifras en 32 y crece con tres, como pide §4. */

const ESTADOS = {
  siguiente: 'bg-brand-500 text-brand-tinta',
  pendiente: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  hecha: 'bg-dark-800 text-dark-400',
  fallida: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
}
const TAMANOS = {
  fila: 'h-8 min-w-8 px-1 text-nombre font-bold',
  siguiente: 'h-10 min-w-10 px-1 text-titulo',
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
