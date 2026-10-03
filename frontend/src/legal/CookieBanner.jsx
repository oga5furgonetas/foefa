import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { hayPixel, consentimiento, guardarConsentimiento, cargarPixel } from '../lib/metaPixel'

// Sin píxel: banner informativo (solo almacenamiento estrictamente necesario,
// guía AEPD: informar + permitir cerrar). Con píxel de Meta: consentimiento
// de verdad, con «Aceptar» y «Solo necesarias» igual de fáciles, y nada de
// medición hasta que se acepta.
export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const conPixel = hayPixel()
  useEffect(() => {
    /* EN EL PORTAL DEL TALLER, NO.
       Esa pantalla no guarda absolutamente nada —no hay sesion, no hay
       preferencias, el token va en la URL— asi que no hay nada que informar.
       Y sobre todo: quien la abre es un mecanico al que le acaba de llegar un
       enlace por WhatsApp; encontrarse un aviso legal tapando media pantalla
       antes de poder tocar nada es exactamente la excusa para cerrar y llamar
       por telefono, que es lo que esa pantalla venia a evitar. Comprobado en
       staging: el banner tapaba los botones y bloqueaba el scroll. */
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/taller/')) return
    if (!consentimiento()) setShow(true)
    else cargarPixel()
  }, [])
  function accept() {
    try { localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() })) } catch {}
    setShow(false)
  }
  function decidir(anuncios) {
    guardarConsentimiento(anuncios)
    setShow(false)
  }
  if (!show) return null
  if (conPixel) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-dark-700 bg-dark-900/95 p-4 shadow-2xl backdrop-blur" role="dialog" aria-label="Cookies">
        <div className="flex items-start gap-3">
          <Cookie size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1 text-sm text-dark-300">
            <b className="text-dark-100">Cookies.</b> Usamos almacenamiento necesario para que la web funcione. Si aceptas, también el píxel de Meta para saber qué anuncios nos traen visitas y altas.
            {' '}<Link to="/cookies" className="text-sky-400 hover:underline">Más información</Link>.
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => decidir(false)} className="rounded-lg border border-dark-600 px-3 py-2 text-sm font-semibold text-dark-100">Solo necesarias</button>
          <button onClick={() => decidir(true)} className="rounded-lg border border-dark-600 px-3 py-2 text-sm font-semibold text-dark-100">Aceptar</button>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-dark-700 bg-dark-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <Cookie size={20} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="flex-1 text-sm text-dark-300">
          <b className="text-dark-100">Cookies necesarias.</b> Usamos solo almacenamiento imprescindible para iniciar sesión y recordar tus preferencias. No usamos cookies de seguimiento ni marketing.
          {' '}<Link to="/cookies" className="text-sky-400 hover:underline">Más información</Link>.
        </div>
        <button onClick={accept} className="btn-primary px-3 py-1.5 text-sm">Entendido</button>
        <button onClick={accept} className="btn-ghost p-1.5 text-dark-400" aria-label="Cerrar"><X size={16} /></button>
      </div>
    </div>
  )
}
