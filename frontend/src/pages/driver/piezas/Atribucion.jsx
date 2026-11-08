/* diseño compacto */
/* La atribución del mapa (06-11-2026, §4): letra «pie» (11, el único texto por debajo de 12) sobre la superficie al 85 %,
   radio 6, en una esquina. En la web Leaflet ya pone la suya; esto es para la guía. Los enlaces de dentro se pueden tocar. */

export default function Atribucion({ texto, className = '', children }) {
  return (
    <div className={`absolute bottom-1 right-1 z-10 max-w-full truncate rounded-md bg-dark-900/85 px-1 text-pie text-dark-50 ${className}`}>
      {texto ?? children}
    </div>
  )
}
