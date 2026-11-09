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

/* LA APP DE IPHONE NO VENDE, NO MENCIONA NI DESBLOQUEA NADA CON PAGOS (09-11-2026). Apple rechazó la 2.4.1 por 2.1(b) («la app
   incluye referencias a suscripción pero los productos de compra dentro de la app no se han enviado») y por 3.1.1 («usa códigos
   promocionales para desbloquear la suscripción»). En el iPhone la app es gratuita para quien reparte y nada la limita ni la
   vende: ni suscripción, ni plan, ni prueba con días, ni precios, ni «gratis hasta…», ni tope de paradas, ni códigos de regalo,
   cupones, bonos o «Invita y gana», ni enlaces a pagar o a «Ver mi plan». Esta es LA pregunta de todas esas pantallas: la web y
   la app de Android siguen igual. La prueba que lo vigila es e2e/ios-sin-pagos.spec.js; las reglas, en docs/APP_STORE.md. */
export const sinPagos = () => esAppIOS()

/* Lo que cuenta el servidor de planes, pruebas, topes, regalos o invitaciones («Has llegado al tope de paradas gratis de hoy.
   Pasa a ilimitado en «Cuenta»…»). Dentro de la app de iPhone no se enseña: se cambia por un texto neutro (txError, de
   lib/idioma.js, y el interceptor de services/api.js para los sitios que pintan `detail` tal cual). */
const HABLA_DE_PAGOS = /suscr|subscri|\bplanes?\b|gratis|ilimitad|tope de paradas|stripe|\bregalos?\b|cup[oó]n|promo|\bbono\b|invita y gana|programa de invitaciones|pago con tarjeta|abrir el pago|«Cuenta»/i
export const hablaDePagos = (texto) => typeof texto === 'string' && HABLA_DE_PAGOS.test(texto)
export const TEXTO_NEUTRO = 'No se ha podido completar. Inténtalo de nuevo más tarde.'
/** `data` de una respuesta de error del servidor: en el iPhone, el `detail` que hable de pagos (o cualquier 402) pasa a neutro. */
export function detalleSinPagos(data, status) {
  if (!sinPagos() || !data || typeof data !== 'object' || typeof data.detail !== 'string') return data
  return status === 402 || hablaDePagos(data.detail) ? { ...data, detail: TEXTO_NEUTRO } : data
}

/* LA ÚLTIMA ZONA (03-11-2026, Dani: «cuando sales de la app y vuelves a entrar te enviaba a la de reparto… Porto entraba
   en la suya de oficina, salía e iba a la de reparto»). Al volver a abrirla, el iPhone carga la portada («/») y de ahí
   se iba siempre a /ruta; ahora vuelve a la zona donde estaba: el panel, el portal del conductor (con su empresa) o la
   ruta. Lo demás (el login de la web, las páginas legales…) no cambia la zona. */
const ZONA = 'fds_app_zona'
function zonaDe(pathname) {
  const m = /^\/(panel|ruta)(?:\/|$)|^\/conductor(?:\/([^/]+))?\/?$/.exec(pathname || '')
  if (!m) return null
  return m[1] ? '/' + m[1] : '/conductor' + (m[2] ? '/' + m[2] : '')
}

/** Dentro de la app, apunta la zona de cada pantalla por la que pasa (lo llama el Medidor de main.jsx). */
export function recordarZona(pathname) {
  if (!esAppNativa()) return
  const zona = zonaDe(pathname)
  if (!zona) return
  try { localStorage.setItem(ZONA, zona) } catch { /* sin almacenamiento: arrancará en /ruta */ }
}

/** Al arrancar dentro de la app: a la zona donde estaba (recordarZona) o, la primera vez, a la app del repartidor;
 *  nunca a la portada de la web. */
export function arrancarEnLaApp() {
  if (!esAppNativa()) return
  try {
    if (window.location.pathname === '/') window.history.replaceState(null, '', zonaDe(localStorage.getItem(ZONA)) || '/ruta')
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
