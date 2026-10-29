import { useEffect, useRef, useState } from 'react'
import { Cookie } from 'lucide-react'
import { Link } from 'react-router-dom'
import { hayPixel, consentimiento, guardarConsentimiento, cargarPixel } from '../lib/metaPixel'
import { tx, useIdioma } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'
import { yaEsApp } from '../lib/instalar'

/* EL AVISO DE COOKIES, SOLO CUANDO HACE FALTA (29-10-2026).
   · Sin píxeles (compilación sin VITE_META_PIXEL_ID / VITE_TIKTOK_PIXEL_ID): la web guarda solo lo imprescindible
     (sesión y preferencias), que la LSSI (art. 22.2) exime de pedir permiso. No se enseña NADA: hasta hoy salía un
     cartel «informativo» que tapaba un tercio de la primera pantalla del móvil, que es la que ve quien llega de un
     anuncio. La política de cookies sigue publicada en /cookies y enlazada en el pie.
   · Con píxeles (Meta, TikTok): consentimiento de verdad, con «Solo necesarias» y «Aceptar» iguales (guía de la
     AEPD) y nada de medición hasta que se acepta. Es una hoja pegada abajo, de dos líneas, no una ventana en medio:
     ocupa lo mínimo y aun así hay que contestar (como barrita que no estorbaba, casi nadie la contestaba: 3 de
     ~3.200 visitas en 4 días, 10-10-2026). */
export default function CookieBanner() {
  // En el idioma del móvil (o el elegido): lo ve quien llega de un anuncio en cualquier país.
  useIdioma()
  const [show, setShow] = useState(false)
  const conPixel = hayPixel()
  useEffect(() => {
    if (!conPixel) return
    /* EN EL PORTAL DEL TALLER, NO: no guarda nada y quien lo abre es un mecánico con un enlace de WhatsApp. */
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/taller/')) return
    // Ni en la app instalada (Play, APK o «añadir a inicio»): allí no hay píxeles (lib/metaPixel.js).
    if (yaEsApp()) return
    if (!consentimiento()) setShow(true)
    else cargarPixel()
  }, [conPixel])
  function decidir(anuncios) {
    guardarConsentimiento(anuncios)
    // Cuántos aceptan: el píxel solo ve a esos, y es lo que le llega a Meta y TikTok para aprender.
    medirAccion(anuncios ? 'cookies_si' : 'cookies_no')
    setShow(false)
  }
  /* QUE NO TAPE NADA: mientras está a la vista, la página reserva abajo su altura. */
  const caja = useRef(null)
  useEffect(() => {
    if (!show || !caja.current) return undefined
    const body = document.body
    const ajustar = () => { if (caja.current) body.style.paddingBottom = `${caja.current.offsetHeight + 16}px` }
    ajustar()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
    if (ro) ro.observe(caja.current)
    return () => { if (ro) ro.disconnect(); body.style.paddingBottom = '' }
  }, [show])
  if (!show || !conPixel) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center bg-black/30 p-2 sm:p-3" role="dialog" aria-modal="true" aria-label="Cookies">
      <div ref={caja} className="w-full max-w-2xl rounded-2xl border border-dark-700 bg-dark-900 px-4 py-3 shadow-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Cookie size={18} className="shrink-0 text-amber-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-[16rem] text-[13px] leading-snug text-dark-300">
            {tx('Cookies: solo las necesarias y, si aceptas, los píxeles de Meta y TikTok para saber qué anuncios nos traen visitas y altas.')}
            {' '}<Link to="/cookies" className="text-sky-400 hover:underline">{tx('Más información')}</Link>
          </p>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:shrink-0">
            <button onClick={() => decidir(false)} className="rounded-xl border border-dark-500 bg-dark-800 px-3 py-2.5 text-[14px] font-bold text-dark-50">{tx('Solo necesarias')}</button>
            <button onClick={() => decidir(true)} className="rounded-xl border border-dark-500 bg-dark-800 px-3 py-2.5 text-[14px] font-bold text-dark-50">{tx('Aceptar')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
