import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { COMPANY } from './config'
import { idioma, useIdioma } from '../lib/idioma'

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
  return (
    <div className="min-h-screen bg-dark-950 text-dark-50">
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
