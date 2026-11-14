import { Link } from 'react-router-dom'
import { COMPANY } from './config'
import { idioma, useIdioma } from '../lib/idioma'
import { useTitulo } from '../lib/titulo'
import { LogoMarca, useTemaWeb } from '../pages/portadaComun'

/* Las páginas legales en inglés (30-10-2026, fuera de España): la navegación y «última actualización» cambian con el
   idioma de la app; cada página decide si enseña su versión en inglés (legal/en/*). El español es la versión que vale. */
const NAV = {
  es: [['/privacidad', 'Privacidad'], ['/terminos', 'Términos'], ['/encargo', 'Encargo'], ['/cookies', 'Cookies'], ['/aviso-legal', 'Aviso legal'], ['/contacto', 'Contacto']],
  en: [['/privacidad', 'Privacy'], ['/terminos', 'Terms'], ['/encargo', 'Data processing'], ['/cookies', 'Cookies'], ['/aviso-legal', 'Legal notice'], ['/contacto', 'Contact']],
}

/** Las páginas legales se leen en inglés cuando la app no está en español (la traducción es de cortesía). */
export const legalEnIngles = () => idioma() !== 'es'

/* Layout común a todas las páginas legales (privacidad, terminos, cookies, aviso, contacto).
   IDENTIDAD (14-11-2026): la de las páginas públicas (tinta sobre papel, día por defecto y la noche si se eligió en el
   pie de la portada), con las variables --ld-* y la marca de portadaComun.jsx. El texto de cada página usa la rampa
   `dark-*`, que `.ld-legal` (index.css) redefine con esa misma paleta: así no se cambia ni una palabra de lo legal.
   Cada página, con su título de pestaña («Privacidad · FDS»): sin él heredaba el de la portada. */
export default function LegalLayout({ title, lastUpdate, children }) {
  useIdioma()
  useTitulo(title)
  const [tema] = useTemaWeb()
  const en = legalEnIngles()
  return (
    <div className="ld-root ld-legal min-h-screen font-sans antialiased" data-theme={tema} data-testid="legal">
      <nav className="border-b border-[color:var(--ld-border)]">
        <div className="mx-auto flex min-h-[4.25rem] max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-5">
          <Link to="/" className="inline-flex min-h-[2.75rem] items-center gap-2.5 text-[color:var(--ld-text)]">
            <LogoMarca size={28} />
            <b className="text-[1.125rem] font-extrabold tracking-[-0.01em]">{COMPANY.brand}</b>
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 text-[0.875rem] text-[color:var(--ld-muted)]">
            {NAV[en ? 'en' : 'es'].map(([href, texto]) => (
              <Link key={href} to={href} className="inline-flex min-h-[2.75rem] items-center underline-offset-4 hover:text-[color:var(--ld-text)] hover:underline">{texto}</Link>
            ))}
          </div>
        </div>
      </nav>
      {/* Un div con role="main", no <main>: el tema híbrido del panel (index.css) pinta todo <main> con su papel, su
          brillo y su rampa propia, y aquí sacaba una tarjeta clara con halo encima de la página. */}
      <div role="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-14">
        <h1 className="ld-titular mb-2 text-[2rem] leading-[1.08] text-[color:var(--ld-text)] sm:text-[2.5rem]">{title}</h1>
        <p className={`${en ? 'mb-2' : 'mb-8'} text-[0.8125rem] text-[color:var(--ld-muted)]`}>{en ? 'Last updated' : 'Última actualización'}: {lastUpdate || COMPANY.effectiveDate}</p>
        {en && <p className="mb-8 text-[0.8125rem] text-[color:var(--ld-muted)]">This is a courtesy translation. The Spanish version is the one that applies in case of any difference.</p>}
        <article className="max-w-none space-y-4 text-[0.9375rem] leading-relaxed text-[color:var(--ld-text2)] [&_h2]:mt-8 [&_h2]:text-[1.125rem] [&_h2]:font-bold [&_h2]:text-[color:var(--ld-text)] [&_h3]:mt-5 [&_h3]:text-[1rem] [&_h3]:font-semibold [&_h3]:text-[color:var(--ld-text)] [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_a]:font-semibold [&_a]:underline-offset-4 [&_a]:hover:underline [&_strong]:text-[color:var(--ld-text)]">
          {children}
        </article>
      </div>
      <footer className="mx-auto max-w-4xl px-4 sm:px-5">
        <p className="border-t border-[color:var(--ld-border)] py-6 text-center text-[0.8125rem] text-[color:var(--ld-muted)]">
          © {new Date().getFullYear()} {COMPANY.legalName} · {COMPANY.brand}
        </p>
      </footer>
    </div>
  )
}
