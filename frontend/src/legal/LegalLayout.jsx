import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { COMPANY } from './config'
import { idioma, useIdioma } from '../lib/idioma'
import { esAppNativa, zonaGuardada } from '../lib/plataforma'

/* Las páginas legales en inglés (30-10-2026, fuera de España): la navegación y «última actualización» cambian con el
   idioma de la app; cada página decide si enseña su versión en inglés (legal/en/*). El español es la versión que vale. */
const NAV = {
  es: [['/privacidad', 'Privacidad'], ['/terminos', 'Términos'], ['/encargo', 'Encargo'], ['/cookies', 'Cookies'], ['/aviso-legal', 'Aviso legal'], ['/contacto', 'Contacto']],
  en: [['/privacidad', 'Privacy'], ['/terminos', 'Terms'], ['/encargo', 'Data processing'], ['/cookies', 'Cookies'], ['/aviso-legal', 'Legal notice'], ['/contacto', 'Contact']],
}

/** Las páginas legales se leen en inglés cuando la app no está en español (la traducción es de cortesía). */
export const legalEnIngles = () => idioma() !== 'es'

// Layout común a todas las páginas legales (privacidad, terminos, cookies, aviso, contacto).
export default function LegalLayout({ title, lastUpdate, children }) {
  useIdioma()
  const en = legalEnIngles()
  /* DENTRO DE LA APP, «VOLVER» (10-11-2026). En la web estas páginas se abren en otra pestaña y se cierran; dentro de la app de
     iPhone se abren en la misma ventana (desde «Cuenta», desde el alta, desde las normas del mercadillo) y la única salida era
     el logotipo, que no vuelve a donde se estaba. Allí llevan arriba una barra con «Volver» («Back» en inglés), pegada: sigue a
     la vista aunque la página llegue desplazada a su apartado. Vuelve atrás en el historial y, si no hay a dónde volver (la
     página legal es lo primero que se abrió), va a la zona guardada (lib/plataforma.js) o, sin ella, a la app del repartidor.
     En la web no sale: `esAppNativa()`. */
  const enLaApp = esAppNativa()
  const navegar = useNavigate()
  const barra = useRef(null)
  const volver = () => {
    if (window.history.length > 1) window.history.back()
    else navegar(zonaGuardada() || '/ruta', { replace: true })
  }
  /* QUIEN LLEGA CON UN APARTADO EN LA DIRECCIÓN LLEGA A ESE APARTADO (10-11-2026). Las normas del mercadillo enlazan a
     /terminos#mercadillo, y la página se abría arriba: una página de React no se desplaza sola al `#…`, porque cuando el
     navegador lo busca el texto aún no está pintado. Se lleva al montarse y, una vez más, cuando la letra ha cargado (que es la
     que decide dónde cae cada línea). El hueco de arriba cuenta con la barra de estado del iPhone, que va encima de la web, y
     con la barra de «Volver» de dentro de la app, que se queda pegada arriba: el título queda debajo de ella, no tapado.
     Sin apartado en la dirección no se toca nada: la página se abre arriba, como siempre. */
  useEffect(() => {
    let id = ''
    try { id = decodeURIComponent((window.location.hash || '').slice(1)) } catch { id = '' }
    const el = id && document.getElementById(id)
    if (!el) return undefined
    let vivo = true
    const ir = () => { if (vivo) el.scrollIntoView() }
    el.style.scrollMarginTop = `calc(env(safe-area-inset-top, 0px) + ${barra.current?.offsetHeight || 0}px + 1rem)`
    ir()
    document.fonts?.ready?.then(ir).catch(() => {})
    return () => { vivo = false }
  }, [])
  return (
    <div className="min-h-screen bg-dark-950 text-dark-50">
      {/* El `before` tapa, cuando la barra está pegada, la franja de la barra de estado del iPhone (index.css: en la app, lo
          pegado arriba baja lo que mide esa franja): el texto que se desplaza no asoma por detrás del reloj. */}
      {enLaApp && (
        <div ref={barra} className="sticky top-0 z-30 border-b border-dark-800 bg-dark-950 before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-dark-950">
          <div className="mx-auto flex max-w-4xl px-3 py-1">
            <button type="button" onClick={volver} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold text-dark-50">
              <ArrowLeft size={19} aria-hidden="true" /> {en ? 'Back' : 'Volver'}
            </button>
          </div>
        </div>
      )}
      <nav className="border-b border-dark-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600"><Zap size={15} className="text-white" /></div>
            <b className="text-sm">{COMPANY.brand}</b>
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-xs text-dark-400">
            {NAV[en ? 'en' : 'es'].map(([href, texto]) => <Link key={href} to={href} className="hover:text-dark-200">{texto}</Link>)}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="mb-1 text-2xl font-bold">{title}</h1>
        <p className={`${en ? 'mb-2' : 'mb-8'} text-xs text-dark-500`}>{en ? 'Last updated' : 'Última actualización'}: {lastUpdate || COMPANY.effectiveDate}</p>
        {en && <p className="mb-8 text-xs text-dark-500">This is a courtesy translation. The Spanish version is the one that applies in case of any difference.</p>}
        <article className="prose prose-invert max-w-none space-y-4 text-sm leading-relaxed text-dark-300 [&_h2]:mt-7 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-dark-100 [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-dark-200 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_a]:text-sky-400 [&_a]:hover:underline [&_strong]:text-dark-100">
          {children}
        </article>
      </main>
      <footer className="border-t border-dark-800 py-6 text-center text-xs text-dark-500">
        © {new Date().getFullYear()} {COMPANY.legalName} · {COMPANY.brand}
      </footer>
    </div>
  )
}
