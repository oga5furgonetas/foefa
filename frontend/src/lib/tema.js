/* EL TEMA Y LA LETRA (17-10-2026).
   El tema solo se cambiaba con el botón del panel de empresas: 'hibrido' (el de por defecto), 'dark' o 'light'
   en `panel_theme`, y `panel_theme_elegido` marca que lo eligió alguien a mano (lo demás es basura del código
   viejo). La app del repartidor lo elige en Ajustes y añade 'auto', que sigue al móvil: oscuro si el móvil está
   en modo oscuro. «Letra más grande» (`fds_letra`) sube un 15 % los textos de la app (index.css, data-letra). */
import { barraNativa } from './plataforma'

const CLAVE = 'panel_theme'
const ELEGIDO = 'panel_theme_elegido'
const LETRA = 'fds_letra'
const consulta = () => { try { return window.matchMedia('(prefers-color-scheme: dark)') } catch { return null } }

export function temaGuardado() {
  try { return localStorage.getItem(ELEGIDO) ? (localStorage.getItem(CLAVE) || 'hibrido') : 'hibrido' } catch { return 'hibrido' }
}

export function temaEfectivo(t = temaGuardado()) {
  if (t === 'auto') return consulta()?.matches ? 'dark' : 'hibrido'
  return ['hibrido', 'dark', 'light'].includes(t) ? t : 'hibrido'
}

/** ¿Ha elegido la noche quien mira? (cuarta tanda, C5). La del panel o la app del conductor (`panel_theme`, también
    «auto» con el móvil en oscuro) y, si no ha elegido ninguna ahí, la del pie de la web (`fds_tema_web`). Sin elegir
    nada, papel. La usan la puerta del conductor (/c y /conductor), el arranque y el cargador de ruta (main.jsx); la
    MISMA regla, escrita sin módulos, está en public/fondo-arranque.js (lo vigila acceso-diseno.spec.js). */
export function nocheElegida() {
  try {
    if (temaEfectivo() === 'dark') return true
    if (localStorage.getItem(ELEGIDO)) return false
    return localStorage.getItem('fds_tema_web') === 'dark'
  } catch { return false }
}

/** ¿Es la puerta del conductor? /c (el enlace personal) y /conductor sin sesión (su entrada con el correo). Con sesión,
    /conductor es su portal, que va con el tema de la app. La misma regla que public/fondo-arranque.js. */
export function esPuertaConductor(ruta = '') {
  if (/^\/c(\/|$)/.test(ruta)) return true
  if (!/^\/conductor(\/|$)/.test(ruta)) return false
  try { return !localStorage.getItem('flota_driver') } catch { return true }
}

let escuchando = false
export function aplicarTema(t = temaGuardado()) {
  try { document.documentElement.setAttribute('data-panel-theme', temaEfectivo(t)) } catch { /* sin documento */ }
  if (t === 'auto' && !escuchando) {
    // Si el móvil cambia de modo con la app abierta (de día a noche), la app cambia con él.
    const q = consulta()
    if (q?.addEventListener) {
      q.addEventListener('change', () => { if (temaGuardado() === 'auto') aplicarTema('auto') })
      escuchando = true
    }
  }
}

export function elegirTema(t) {
  try { localStorage.setItem(ELEGIDO, '1'); localStorage.setItem(CLAVE, t) } catch { /* modo privado */ }
  aplicarTema(t)
}

/* LA BARRA DE ARRIBA DEL MÓVIL, DEL COLOR DE LA APP (25-10-2026).
   En la app de Play (una TWA de Chrome) y en la instalada desde la web, Android pinta la barra de estado con el
   `theme-color` de la página. Con el #070a0e de la web salía NEGRA encima de la app del repartidor, que es
   clara: es lo que más delataba que era una web. Mientras se está en la app, la barra (y el fondo de detrás,
   que asoma al cargar) llevan el papel de la app; oscuro con el tema oscuro. */
const PAPEL = { hibrido: '#f7f6f3', light: '#f3f6fa', dark: '#060a14' }
export const colorDeLaApp = (t = temaGuardado()) => PAPEL[temaEfectivo(t)] || PAPEL.hibrido
export const RUTAS_APP = /^\/(ruta|mercadillo)(\/|$)/

export function pintarBarra(color) {
  try {
    let m = document.querySelector('meta[name="theme-color"]')
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m) }
    const antes = m.getAttribute('content')
    m.setAttribute('content', color)
    barraNativa(color)   // la barra de estado del iPhone, a juego (solo dentro de la app de iPhone)
    return antes
  } catch { return null }
}

const COLOR_WEB = '#070a0e'   // el de index.html, el de la web y el panel

export function pintarApp() {
  try {
    const c = colorDeLaApp()
    pintarBarra(c)
    document.documentElement.style.backgroundColor = c
    if (document.body) document.body.style.backgroundColor = c
  } catch { /* sin documento */ }
}

/* Barra y fondo de la app ya, y cada vez que cambia el tema (Ajustes o el modo del móvil); al salir, los de la web. */
export function vestirDeApp() {
  pintarApp()
  let obs = null
  try {
    obs = new MutationObserver(pintarApp)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-panel-theme'] })
  } catch { /* sin observador: se queda con el del arranque */ }
  return () => {
    obs?.disconnect()
    pintarBarra(COLOR_WEB)
    try {
      document.documentElement.style.backgroundColor = ''
      if (document.body) document.body.style.backgroundColor = ''
    } catch { /* sin documento */ }
  }
}

/* El conductor que entra con su correo pasa de la puerta (de papel desde el arranque, public/fondo-arranque.js) a su
   portal sin recargar: el papel y el color de la barra del arranque se quitan, y el portal arranca como siempre. */
export function quitarFondoDeArranque() {
  try {
    const html = document.documentElement.classList
    if (!html.contains('arranque-papel') && !html.contains('arranque-noche')) return
    html.remove('arranque-papel', 'arranque-noche')
    pintarBarra(COLOR_WEB)
  } catch { /* sin documento */ }
}

export const letraGrande = () => { try { return localStorage.getItem(LETRA) === 'grande' } catch { return false } }

export function aplicarLetra(grande = letraGrande()) {
  try {
    if (grande) document.documentElement.setAttribute('data-letra', 'grande')
    else document.documentElement.removeAttribute('data-letra')
  } catch { /* sin documento */ }
}

export function elegirLetra(grande) {
  try { if (grande) localStorage.setItem(LETRA, 'grande'); else localStorage.removeItem(LETRA) } catch { /* modo privado */ }
  aplicarLetra(grande)
}
