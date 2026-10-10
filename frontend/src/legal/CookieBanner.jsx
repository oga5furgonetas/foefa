import { useEffect, useRef, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { hayPixel, consentimiento, guardarConsentimiento, cargarPixel } from '../lib/metaPixel'
import { tx, useIdioma } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'

// Sin píxel: banner informativo (solo almacenamiento estrictamente necesario,
// guía AEPD: informar + permitir cerrar). Con píxeles (Meta, TikTok): consentimiento
// de verdad, con «Aceptar» y «Solo necesarias» igual de fáciles, y nada de
// medición hasta que se acepta.
export default function CookieBanner() {
  // En el idioma del móvil (o el elegido): lo ve quien llega de un anuncio en cualquier país.
  useIdioma()
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
    // Cuántos aceptan: el píxel solo ve a esos, y es lo que le llega a TikTok para aprender.
    medirAccion(anuncios ? 'cookies_si' : 'cookies_no')
    setShow(false)
  }
  /* QUE NO TAPE NADA. Es fijo abajo: en un móvil cubría el botón «Crear
     cuenta» del alta (medido el 04-10-2026 con la pantalla en chino, que ocupa
     más líneas), y quien llega del anuncio no sabe que tiene que cerrarlo
     antes. Mientras está a la vista, la página reserva abajo su altura, así
     que todo se puede desplazar por encima de él. */
  const caja = useRef(null)
  useEffect(() => {
    if (!show || !caja.current) return undefined
    const body = document.body
    const ajustar = () => { if (caja.current) body.style.paddingBottom = `${caja.current.offsetHeight + 24}px` }
    ajustar()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
    if (ro) ro.observe(caja.current)
    return () => { if (ro) ro.disconnect(); body.style.paddingBottom = '' }
  }, [show])
  if (!show) return null
  /* QUE SE RESPONDA (10-10-2026). Como barrita que no estorbaba, casi nadie la
     contestaba: 3 de ~3.200 visitas en 4 días. Sin respuesta no hay píxel, y
     Meta y TikTok no saben qué anuncio trae altas ni a quién parecerse. Ahora
     es una ventana que pide elegir, con las dos opciones IGUALES (mismo
     tamaño, color y sitio: rechazar es tan fácil como aceptar, guía de la AEPD)
     y la web entera sigue funcionando elijas lo que elijas. */
  if (conPixel) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Cookies">
        <div ref={caja} className="w-full max-w-md rounded-2xl border border-dark-700 bg-dark-900 p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <Cookie size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1 text-[14px] leading-snug text-dark-300">
              <b className="text-dark-100">{tx('Cookies.')}</b> {tx('Usamos almacenamiento necesario para que la web funcione. Si aceptas, también los píxeles de Meta y TikTok para saber qué anuncios nos traen visitas y altas.')}
              {' '}<Link to="/cookies" className="text-sky-400 hover:underline">{tx('Más información')}</Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => decidir(false)} className="rounded-xl border border-dark-500 bg-dark-800 px-3 py-3 text-[15px] font-bold text-dark-50">{tx('Solo necesarias')}</button>
            <button onClick={() => decidir(true)} className="rounded-xl border border-dark-500 bg-dark-800 px-3 py-3 text-[15px] font-bold text-dark-50">{tx('Aceptar')}</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div ref={caja} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-dark-700 bg-dark-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex flex-wrap items-start gap-3">
        <Cookie size={20} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1 basis-[17rem] text-sm text-dark-300">
          <b className="text-dark-100">{tx('Cookies necesarias.')}</b> {tx('Usamos solo almacenamiento imprescindible para iniciar sesión y recordar tus preferencias. No usamos cookies de seguimiento ni marketing.')}
          {' '}<Link to="/cookies" className="text-sky-400 hover:underline">{tx('Más información')}</Link>
        </div>
        <button onClick={accept} className="btn-primary shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">{tx('Entendido')}</button>
        <button onClick={accept} className="btn-ghost p-1.5 text-dark-400" aria-label={tx('Cerrar')}><X size={16} /></button>
      </div>
    </div>
  )
}
