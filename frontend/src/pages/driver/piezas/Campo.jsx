/* diseño compacto */
/* El campo de texto y el buscador (06-11-2026, §4): 48 de alto, radio 12, borde de control y dos de marca al escribir
   (la clase .campo de index.css), icono de 20 a la izquierda, letra «campo» (16: por debajo el iPhone amplía), el ejemplo
   dentro y la ayuda o el error debajo en «sec». Sin etiqueta flotante: el nombre accesible es el de siempre (`nombre`, o el
   ejemplo). `onChange` recibe el texto. Con `multilinea`, un textarea. `inputRef` (opcional, W6, 07-11-2026): la referencia del
   <input>, para enfocarlo desde fuera (el dictado de la ficha, sin micrófono, lleva al campo). */
import icono from './icono'

export default function Campo({
  valor, onChange, icono: Icono, ejemplo, nombre, ayuda, error, multilinea = false, filas = 3, className = '', testid, inputRef, ...resto
}) {
  const comunes = {
    ref: inputRef,
    value: valor ?? '',
    onChange: (e) => onChange?.(e.target.value),
    placeholder: ejemplo,
    'aria-label': nombre || ejemplo,
    'aria-invalid': error ? true : undefined,
    'data-testid': testid,
    className: `campo ${Icono ? 'pl-11' : ''} ${error ? 'border-ruta-peligro' : ''} ${multilinea ? 'resize-none py-3' : ''}`,
    ...resto,
  }
  return (
    <div className={className}>
      <div className="relative">
        {Icono && (
          <span className={`pointer-events-none absolute left-3 text-dark-400 ${multilinea ? 'top-3' : 'top-1/2 -translate-y-1/2'}`}>
            {icono(Icono, 20)}
          </span>
        )}
        {multilinea ? <textarea rows={filas} {...comunes} /> : <input {...comunes} />}
      </div>
      {(error || ayuda) && <p className={`mt-1 text-sec ${error ? 'text-ruta-peligro-texto' : 'text-dark-400'}`}>{error || ayuda}</p>}
    </div>
  )
}
