/* diseño compacto */
/* Un dato de la hoja de la parada (06-11-2026, §4): 36 de alto mínimo (48 si se toca), icono de 18 gris y el valor en
   «texto», dos líneas como mucho. Sin «Teléfono:» ni «Código:» a la vista: el prefijo (`nombre`) va solo para el lector
   de pantalla. Los cortos, de dos en dos (lo decide quien los pinta, con una rejilla). */
import icono from './icono'

export default function FilaDato({ icono: Icono, texto, nombre, onClick, className = '', testid, children }) {
  const dentro = (
    <>
      {icono(Icono, 18, 'mt-0.5 shrink-0 text-dark-400')}
      <span className="min-w-0 flex-1 text-texto text-dark-50">
        {nombre && <span className="sr-only">{nombre}: </span>}
        <span className="line-clamp-2">{texto ?? children}</span>
      </span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testid} className={`flex min-h-12 w-full items-start gap-2 py-1 text-left ${className}`}>{dentro}</button>
    )
  }
  return <div data-testid={testid} className={`flex min-h-9 items-start gap-2 py-1 ${className}`}>{dentro}</div>
}
