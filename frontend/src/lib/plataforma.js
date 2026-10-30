/* LA APP DE IPHONE (30-10-2026): la misma web, envuelta con Capacitor (frontend/ios/). Dentro de ella hay cosas de la
   web que no tienen sentido: el botón de Google Play, «instalar la app», y la compra de la suscripción (Apple exige
   su propio pago dentro de la app, regla 3.1.1: hasta tenerlo, en el iPhone no se vende nada; el plan se lleva
   desde la web). Capacitor deja `window.Capacitor` solo cuando corre dentro de la app nativa. */

export const esAppNativa = () => {
  try { return !!window.Capacitor?.isNativePlatform?.() } catch { return false }
}

export const esAppIOS = () => {
  try { return esAppNativa() && window.Capacitor.getPlatform() === 'ios' } catch { return false }
}

/** Al arrancar dentro de la app: directo a la app del repartidor, no a la portada de la web. */
export function arrancarEnLaApp() {
  if (!esAppNativa()) return
  try {
    if (window.location.pathname === '/') window.history.replaceState(null, '', '/ruta')
  } catch { /* nada */ }
}

/* La barra de estado del iPhone, del color de la app: texto oscuro sobre los temas claros, claro sobre el oscuro.
   El plugin solo se carga dentro de la app (en la web no existe y no se importa). */
let cargaBarra = null
const plugin = () => { cargaBarra = cargaBarra || import('@capacitor/status-bar'); return cargaBarra }
export function barraNativa(color) {
  if (!esAppNativa()) return
  const clara = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(color || '').trim())
    if (!m) return false
    const n = parseInt(m[1], 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140
  })()
  plugin()
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: clara ? Style.Light : Style.Dark }))
    .catch(() => { /* sin plugin: la barra se queda como esté */ })
}
