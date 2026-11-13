import { useState } from 'react'
import { ClipboardCheck, Wrench, CalendarClock, CalendarDays, Users, ShoppingBasket, Sun, Moon } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, IDIOMAS, cambiarIdioma } from '../lib/idioma'
import { hayPixel, abrirAvisoCookies } from '../lib/metaPixel'
import { API_BASE } from '../lib/apiBase'
import { saveSession } from '../panel/auth'
import { medirAccion } from '../lib/analitica'

/* LAS PIEZAS QUE COMPARTEN LA PORTADA (/) Y LA PÁGINA DE EMPRESAS (/empresas) (14-11-2026).
   Estaban dentro de Landing.jsx; se sacan aquí tal cual para que /empresas no copie nada (y no arrastre la portada
   entera, con su 3D, al importarlas). Pintan exactamente lo mismo que antes. Sus textos los comprueba
   scripts/check-textos-ruta.mjs, que lee este fichero. */

/* El botón principal: cian de la marca con tinta oscura, igual de día y de noche. */
export const BTN_PRIMARIO = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-5 py-3 text-[15px] font-semibold text-[#04121a] shadow-[0_10px_30px_-10px_rgba(20,231,216,.55)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60'
export const BTN_SECUNDARIO = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-5 py-3 text-[15px] font-semibold text-[color:var(--ld-text)] transition hover:border-[color:var(--ld-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60'

/* LO DE LA EMPRESA: el panel de la oficina. Cada módulo, una pantalla del panel. */
export const MODULOS_EMPRESA = [
  [ClipboardCheck, 'Revisiones con foto e IA', 'El conductor revisa la furgoneta desde el móvil y la IA señala cada golpe nuevo.'],
  [Wrench, 'Taller y estado de la flota', 'Incidencias, órdenes de reparación y qué furgoneta está peor, de la peor a la mejor.'],
  /* 14-11-2026: decía «ITV, seguro, renting y mantenimientos en un calendario». El calendario (GET /fleet/calendar)
     pinta la ITV, el fin del renting, los mantenimientos y las citas; la fecha del seguro no sale en ninguna pantalla
     de vencimientos (solo la consulta el asistente). Se quita «seguro» hasta que salga. */
  [CalendarClock, 'Vencimientos', 'ITV, fin del renting y mantenimientos en un calendario, y la lista de ITV ordenada por lo que caduca antes.'],
  [CalendarDays, 'Cuadrante y días libres', 'El cuadrante se rehace solo con sus reglas, se sincroniza con tu Google Sheets y la gente pide días o se apunta a refuerzos desde el móvil.'],
  [Users, 'Asignación del día y equipo', 'Quién lleva cada furgoneta hoy, las fichas de tu gente y el portal de cada conductor en su móvil.'],
  [ShoppingBasket, 'Reparto a domicilio', 'Para súper y distribución: pedidos, rutas de tus repartidores y un enlace para que el cliente siga su pedido.'],
]

export function Seccion({ id, eyebrow, titulo, sub, children, className = '' }) {
  return (
    <section id={id} className={`mx-auto max-w-[1120px] px-5 py-14 sm:py-20 ${className}`}>
      {(eyebrow || titulo) && (
        <header className="mb-10 max-w-2xl">
          {eyebrow && <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ld-accent)]">{eyebrow}</p>}
          {titulo && (
            <h2 className="mt-3 font-display text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-[color:var(--ld-text)] [text-wrap:balance]">{titulo}</h2>
          )}
          {sub && <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{sub}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

/* La vista del panel de la oficina, con datos de ejemplo (y lo dice en su pie). */
/* `z`: el número de zona; la palabra «Zona» va por tx() (14-11-2026: en inglés salía «Zona 3»). */
const SALIDAS = [
  { m: '5678 KLM', c: 'Luis P.', z: 3, ok: false },
  { m: '1234 BCD', c: 'Ana L.', z: 1, ok: true, sev: true },
  { m: '9012 FGH', c: 'Marta G.', z: 2, ok: true },
  { m: '3456 JKL', c: 'Iván R.', z: 4, ok: true },
]
export function VistaPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] shadow-[0_40px_90px_-40px_rgba(0,0,0,.6)]">
      <div className="flex items-center gap-1.5 border-b border-[color:var(--ld-border)] px-4 py-2.5">
        {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-[color:var(--ld-border-strong)]" />)}
        <span className="ml-3 truncate font-mono text-[11px] text-[color:var(--ld-dim)]">{MARCA.nombre.toLowerCase()} · panel</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--ld-dim)]">{tx('El día de hoy')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <span className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-[color:var(--ld-text)] tabular-nums">86<span className="text-lg font-medium text-[color:var(--ld-dim)]">%</span></span>
            <p className="mt-1 text-[12.5px] text-[color:var(--ld-muted)]">{tx('de la flota revisada hoy')}</p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {[['2', tx('salen sin revisar'), true], ['3', tx('golpes nuevos'), true], ['1', tx('ITV esta semana'), false]].map(([n, k, alerta]) => (
              <div key={k}>
                <dt className="sr-only">{k}</dt>
                <dd className={`font-display text-[22px] font-semibold leading-none tabular-nums ${alerta ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-text)]'}`}>{n}</dd>
                <dd className="mt-1 text-[11.5px] text-[color:var(--ld-dim)]">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--ld-fill)]"><div className="h-full w-[86%] rounded-full bg-emerald-400/85" /></div>
        <ul className="mt-5 grid grid-cols-2 gap-2">
          {SALIDAS.map((s) => (
            <li key={s.m} className={`rounded-xl border p-2.5 ${s.ok ? 'border-[color:var(--ld-border)]' : 'border-[color:var(--ld-warn)]'} bg-[color:var(--ld-surface2)]`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11.5px] font-bold text-[color:var(--ld-text)]">{s.m}</span>
                <span className="font-mono text-[10px] text-[color:var(--ld-dim)]">{tx('Zona {n}', { n: s.z })}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[color:var(--ld-muted)]">{s.c}</div>
              <div className={`mt-1.5 text-[10.5px] font-semibold ${!s.ok ? 'text-[color:var(--ld-warn)]' : s.sev ? 'text-[color:var(--ld-mid)]' : 'text-[color:var(--ld-ok)]'}`}>
                {tx(!s.ok ? 'sin revisar' : s.sev ? 'golpe moderado' : 'revisada')}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-[color:var(--ld-border)] px-5 py-2 text-[11px] text-[color:var(--ld-dim)]">{tx('Vista del panel · datos de ejemplo')}</p>
    </div>
  )
}

/* La demo del panel entra con un usuario de solo lectura. Si el servidor no contesta, se dice.
   `accion`: el nombre con que se mide cada página (la portada, `portada_demo_panel`; empresas, `emp_demo_panel`).
   Devuelve [estado, abrir]: estado '' | 'cargando' | 'error'. */
export function useDemoPanel(accion) {
  const [demo, setDemo] = useState('')
  async function abrir() {
    if (demo === 'cargando') return
    medirAccion(accion)
    setDemo('cargando')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-login`, { method: 'POST' })
      const j = await r.json()
      if (j?.access_token) { saveSession(j); window.location.href = '/panel'; return }
    } catch { /* se dice abajo */ }
    setDemo('error')
  }
  return [demo, abrir]
}

/* El pie: la marca, el idioma, claro u oscuro, el producto y lo legal. `tema`/`setTema`: los de la página. */
export function Pie({ lang, tema, setTema }) {
  return (
    <footer className="border-t border-[color:var(--ld-border)]">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <a href="/" className="flex items-center gap-2.5 text-[color:var(--ld-text)]">
            <img src="/favicon.svg" alt="" width="26" height="26" className="rounded-md" />
            <span className="font-display text-[16px] font-bold">FDS</span>
          </a>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[color:var(--ld-dim)]">{tx('La app de reparto gratis y el panel para tu flota.')}</p>
          <div className="mt-5 flex items-center gap-2">
            <label htmlFor="ld-idioma" className="sr-only">Idioma / Language</label>
            <select id="ld-idioma" value={lang} onChange={(e) => cambiarIdioma(e.target.value)}
              className="rounded-lg border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2.5 py-1.5 text-[13px] text-[color:var(--ld-text)]">
              {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" onClick={() => setTema((v) => (v === 'dark' ? 'light' : 'dark'))}
              aria-label={tx('Cambiar entre claro y oscuro')} title={tx('Cambiar entre claro y oscuro')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">
              {tema === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
        <nav aria-label={tx('Producto')}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('Producto')}</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            {[['/repartidores', tx('App de reparto')], ['/planes', tx('Precios para empresas')], ['/guia-ruta-de-reparto', tx('Guía: cómo ordenar la ruta')],
              ['/peritaje-tecnico', tx('Cómo funciona la IA de daños')], ['/empleo', tx('Ofertas de empleo')], ['/contacto', tx('Contacto')], ['/panel/login', tx('Entrar')]].map(([h, k]) => (
              <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{k}</a></li>
            ))}
          </ul>
        </nav>
        <nav aria-label={tx('Legal')}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('Legal')}</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            {[['/privacidad', tx('Privacidad')], ['/terminos', tx('Términos')], ['/cookies', tx('Cookies')], ['/aviso-legal', tx('Aviso legal')], ['/security', tx('Seguridad')]].map(([h, k]) => (
              <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{k}</a></li>
            ))}
            {/* Cambiar de opinión sobre los píxeles, a un toque (02-11-2026): vuelve a abrir el aviso de cookies. */}
            {hayPixel() && (
              <li><button type="button" onClick={abrirAvisoCookies} className="text-left text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx('Cambiar mis cookies')}</button></li>
            )}
          </ul>
        </nav>
      </div>
      <p className="border-t border-[color:var(--ld-border)] px-5 py-5 text-center text-[12.5px] text-[color:var(--ld-dim)]">© {new Date().getFullYear()} {MARCA.nombre}</p>
    </footer>
  )
}
