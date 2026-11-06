/* diseño compacto */
/* El «?» (06-11-2026, §4): un botón de icono de 48 que abre la explicación larga en una Hoja. Nada se borra: la frase que
   deja de verse se muda aquí con su misma clave, sin traducir de nuevo y sin perder lo que enseña a quien empieza. */
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'
import Hoja from './Hoja'

export default function Ayuda({ titulo, texto, nombre, tono = 'neutro', relleno = false, className = '', testid, children }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <>
      <Boton variante="icono" icono={HelpCircle} tono={tono} nombre={nombre || tx('Ayuda')} relleno={relleno} onClick={() => setAbierta(true)} className={className} testid={testid} />
      {abierta && (
        <Hoja titulo={titulo} onClose={() => setAbierta(false)}>
          <div className="whitespace-pre-line pt-2 text-texto text-dark-50">{texto ?? children}</div>
        </Hoja>
      )}
    </>
  )
}
