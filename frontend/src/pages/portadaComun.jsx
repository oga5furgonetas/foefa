import { useState } from 'react'
import { Sun, Moon, ArrowRight } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, IDIOMAS, cambiarIdioma } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'
import { hayPixel, abrirAvisoCookies } from '../lib/metaPixel'

/* LAS PIEZAS QUE COMPARTEN LAS PÁGINAS PÚBLICAS CON LA IDENTIDAD NUEVA (14-11-2026): la portada (/ y /empresas),
   /peritaje-tecnico y /planes. Tinta sobre papel; el cian de la marca solo en la acción principal (relleno, con tinta
   encima). Sin degradados, sin brillos, sin rótulos en mayúsculas espaciadas. Los colores salen de las variables
   --ld-* de index.css (día por defecto, noche con su paleta). Sus textos los comprueba scripts/check-textos-ruta.mjs. */

/* La acción principal: 52 px, radio 12, cian con tinta encima (11,5:1). Una por pantalla. */
export const BTN_PRIMARIO = 'inline-flex min-h-[3.25rem] items-center justify-center gap-2.5 whitespace-nowrap rounded-[12px] border-[1.5px] border-transparent bg-[color:var(--ld-firma)] px-[22px] text-[1rem] font-bold text-[color:var(--ld-tinta-firma)] transition-colors hover:bg-[color:var(--ld-firma-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)] disabled:opacity-60'
/* La secundaria: con borde, sin relleno. */
export const BTN_SECUNDARIO = 'inline-flex min-h-[3.25rem] items-center justify-center gap-2.5 whitespace-nowrap rounded-[12px] border-[1.5px] border-[color:var(--ld-border-strong)] bg-transparent px-[22px] text-[1rem] font-bold text-[color:var(--ld-text)] transition-colors hover:border-[color:var(--ld-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)] disabled:opacity-60'
/* La de la cabecera: la misma firma, más baja. */
export const BTN_CORTO = 'inline-flex min-h-[2.5rem] items-center justify-center whitespace-nowrap rounded-[10px] bg-[color:var(--ld-firma)] px-3.5 text-[0.875rem] font-bold text-[color:var(--ld-tinta-firma)] transition-colors hover:bg-[color:var(--ld-firma-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)]'
/* Un enlace dentro del texto: el cian en su versión de texto, subrayado al pasar. Zona de toque de 44 px. */
export const ENLACE = 'inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] underline-offset-4 hover:underline'
/* El ancho de las páginas públicas, con 16 px de margen en el móvil. */
export const ANCHO = 'mx-auto w-full max-w-[1200px] px-4 sm:px-8'

/* El logo, plano (el favicon lleva un degradado que aquí no va): la F en papel y el trazo en el cian de la marca. El
   cuadrado es tinta de día; de noche, un gris tinta con su borde (--ld-logo, index.css): en tinta pura sobre el papel de
   noche desaparecía. Fuera de .ld-root, el de siempre. */
export function LogoMarca({ size = 30 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.5" fill="var(--ld-logo, #10181A)" stroke="var(--ld-logo-borde, transparent)" strokeWidth="1.5" />
      <rect x="15" y="13" width="9" height="38" rx="2.5" fill="#F5F6F3" />
      <rect x="15" y="13" width="31" height="9" rx="2.5" fill="#F5F6F3" />
      <rect x="15" y="28.5" width="21" height="8" rx="2.5" fill="#14E7D8" />
      <circle cx="44.5" cy="32.5" r="5" fill="#14E7D8" />
    </svg>
  )
}

/* Día o noche. El día (papel) por defecto; se guarda SOLO si la persona lo cambia (con otra clave que la de antes,
   «ld_theme», que se guardaba sola en «dark» en la primera visita y dejaría en noche a casi todos). */
const CLAVE_TEMA = 'fds_tema_web'
export function useTemaWeb() {
  const [tema, setTemaEstado] = useState(() => {
    try { return localStorage.getItem(CLAVE_TEMA) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const setTema = (f) => setTemaEstado((v) => {
    const nuevo = typeof f === 'function' ? f(v) : f
    try { localStorage.setItem(CLAVE_TEMA, nuevo) } catch { /* modo privado */ }
    return nuevo
  })
  return [tema, setTema]
}

/* La cabecera de las páginas que no son la portada: la marca y lo que cada una pase a la derecha. */
export function CabeceraSimple({ children }) {
  return (
    <nav className="border-b border-[color:var(--ld-border)]">
      <div className={`${ANCHO} flex h-[68px] items-center justify-between gap-3`}>
        <a href="/" className="inline-flex items-center gap-2.5 text-[color:var(--ld-text)]">
          <LogoMarca />
          <span className="text-[1.1875rem] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-5">{children}</div>
      </div>
    </nav>
  )
}

/* LA CABECERA DE LA PORTADA (tanda 4, 14-11-2026): la misma en «/» y en /planes, para que pasar de una a otra no cambie
   el marco. Arriba, solo en el móvil, la línea a la app de ruta (en el ordenador va en el menú). `alta`: adónde lleva
   «Probar con mis furgonetas». `enPortada`: los enlaces del menú son anclas de la misma página y se miden con los
   nombres del embudo «empresas» (backend/analitica.py); fuera de ella llevan a «/#…» y no se miden como portada.
   `actual`: la ruta de la página, para marcar en el menú la que se está viendo. */
export function CabeceraPortada({ alta, enPortada = false, actual = '/' }) {
  const medir = (nombre) => () => { if (enPortada) medirAccion(nombre) }
  const ancla = (h) => (enPortada ? h : `/${h}`)
  const enlaceMenu = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-[0.9375rem] font-medium text-[color:var(--ld-text)] hover:underline underline-offset-4'
  const precio = actual === '/planes' ? { href: '/planes', 'aria-current': 'page' } : { href: ancla('#precio') }
  return (
    <>
      {/* Quien reparte y llega escribiendo la dirección de un anuncio: su página, arriba del todo y a la vista en el móvil. */}
      <a href="/repartidores" onClick={medir('emp_repartidores_menu')} data-testid="emp-repartidores-arriba"
        className="flex min-h-[44px] items-center justify-center gap-1.5 border-b border-[color:var(--ld-border)] px-4 text-[0.875rem] text-[color:var(--ld-muted)] lg:hidden">
        <span>{tx('¿Repartes tú?')} <b className="font-semibold text-[color:var(--ld-text)] underline underline-offset-4">{tx('La app de ruta')}</b></span>
        <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-[color:var(--ld-text)]" />
      </a>
      <nav className="sticky top-0 z-50 border-b border-[color:var(--ld-border)] bg-[color:var(--ld-nav)]" data-testid="emp-cabecera">
        <div className={`${ANCHO} flex h-[68px] items-center justify-between gap-2`}>
          <a href="/" className="inline-flex shrink-0 items-center gap-2.5 text-[color:var(--ld-text)]">
            <LogoMarca />
            <span className="text-[1.1875rem] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </a>
          <div className="flex items-center gap-2 sm:gap-6">
            <a href={ancla('#como')} className={`${enlaceMenu} hidden lg:inline-flex`}>{tx('Cómo funciona')}</a>
            <a {...precio} onClick={medir('emp_precios_menu')} className={`${enlaceMenu} hidden lg:inline-flex aria-[current=page]:underline`}>{tx('Precio')}</a>
            <a href="/repartidores" onClick={medir('emp_repartidores_menu')} className={`${enlaceMenu} hidden !text-[color:var(--ld-muted)] lg:inline-flex`}>{tx('¿Repartes tú? La app de ruta')}</a>
            <a href="/panel/login" className={enlaceMenu}>{tx('Entrar')}</a>
            {/* En el móvil, la etiqueta corta: la larga no cabe junto a la marca en portugués, francés o alemán. */}
            <a href={alta} onClick={medir('emp_probar_menu')} data-testid="emp-probar-menu" className={BTN_CORTO}>
              <span className="sm:hidden">{tx('Probar')}</span><span className="hidden sm:inline">{tx('Probar con mis furgonetas')}</span>
            </a>
          </div>
        </div>
      </nav>
    </>
  )
}

/* El pie: la marca, el idioma, día o noche, el producto y lo legal. `tema`/`setTema`: los de la página. */
export function Pie({ lang, tema, setTema }) {
  const enlace = 'inline-flex min-h-[32px] items-center text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'
  return (
    <footer className="border-t border-[color:var(--ld-border)]">
      <div className={`${ANCHO} grid gap-8 py-10 sm:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <a href="/" className="inline-flex items-center gap-2.5 text-[color:var(--ld-text)]">
            <LogoMarca size={26} />
            <span className="text-[1.0625rem] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </a>
          <p className="mt-3 max-w-xs text-[0.875rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Revisiones con foto para empresas con furgonetas, y la app de ruta para quien reparte.')}</p>
          <div className="mt-5 flex items-center gap-2">
            <label htmlFor="ld-idioma" className="sr-only">Idioma / Language</label>
            <select id="ld-idioma" value={lang} onChange={(e) => cambiarIdioma(e.target.value)}
              className="h-10 rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2.5 text-[0.875rem] text-[color:var(--ld-text)]">
              {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" onClick={() => setTema((v) => (v === 'dark' ? 'light' : 'dark'))}
              aria-label={tx('Cambiar entre claro y oscuro')} title={tx('Cambiar entre claro y oscuro')}
              className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">
              {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
        <nav aria-label={tx('Producto')}>
          <p className="text-[0.875rem] font-bold text-[color:var(--ld-text)]">{tx('Producto')}</p>
          <ul className="mt-2 text-[0.875rem]">
            {[['/planes', tx('Precios para empresas')], ['/expediente-ejemplo', tx('Un expediente de ejemplo')], ['/peritaje-tecnico', tx('Qué le enseñas al perito')], ['/devolucion-renting', tx('¿Qué te van a cobrar al devolverlo?')],
              ['/repartidores', tx('App de reparto')], ['/empleo', tx('Ofertas de empleo')], ['/contacto', tx('Contacto')], ['/panel/login', tx('Entrar')]].map(([h, k]) => (
              <li key={h}><a href={h} className={enlace}>{k}</a></li>
            ))}
          </ul>
        </nav>
        <nav aria-label={tx('Legal')}>
          <p className="text-[0.875rem] font-bold text-[color:var(--ld-text)]">{tx('Legal')}</p>
          <ul className="mt-2 text-[0.875rem]">
            {[['/privacidad', tx('Privacidad')], ['/terminos', tx('Términos')], ['/cookies', tx('Cookies')], ['/aviso-legal', tx('Aviso legal')], ['/security', tx('Seguridad')]].map(([h, k]) => (
              <li key={h}><a href={h} className={enlace}>{k}</a></li>
            ))}
            {/* Cambiar de opinión sobre los píxeles, a un toque (02-11-2026): vuelve a abrir el aviso de cookies. */}
            {hayPixel() && (
              <li><button type="button" onClick={abrirAvisoCookies} className={`${enlace} text-left`}>{tx('Cambiar mis cookies')}</button></li>
            )}
          </ul>
        </nav>
      </div>
      {/* La raya, en un div por dentro del ancho: puesta en el de fuera iba de lado a lado del relleno y era más ancha que
          todas las demás reglas de la página. */}
      <div className={ANCHO}>
        <p className="border-t border-[color:var(--ld-border)] py-5 text-[0.8125rem] text-[color:var(--ld-muted)]">© {new Date().getFullYear()} {MARCA.nombre}</p>
      </div>
    </footer>
  )
}
