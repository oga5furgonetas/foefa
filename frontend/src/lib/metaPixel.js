/* ── MEDICIÓN DE ANUNCIOS (píxel de Meta), SOLO CON CONSENTIMIENTO ───────────
   04-10-2026, Dani: medir las conversiones de los anuncios de Facebook. El
   píxel es una cookie de marketing: en la UE hace falta consentimiento previo
   (AEPD), así que NO se carga nada hasta que la persona acepta en el aviso de
   cookies, y rechazar es tan fácil como aceptar. Sin `VITE_META_PIXEL_ID` en
   el despliegue no existe nada de esto (ni se pregunta).

   Eventos: PageView (al cargar), CompleteRegistration (alta hecha), StartTrial
   (tarjeta puesta, prueba en marcha), Subscribe (suscripción pagada) y
   Purchase (regalo). Los que pasan fuera de la web (vuelta de Stripe) se dejan
   apuntados antes de salir y se mandan al volver. */

import { yaEsApp } from './instalar'
import { API_BASE } from './apiBase'

export const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim()
const CLAVE = 'cookie_consent'
const PENDIENTE = 'meta_pendiente'

/* Píxel de TikTok (05-10-2026): mismo consentimiento, mismos eventos. Sin
   `VITE_TIKTOK_PIXEL_ID` no existe. TikTok optimiza los anuncios por «registro»
   en vez de por clic, que es lo que trae repartidores y no curiosos. */
export const TT_ID = String(import.meta.env.VITE_TIKTOK_PIXEL_ID || '').trim()
const hayMeta = () => /^\d{8,20}$/.test(PIXEL_ID)
const hayTT = () => /^[A-Z0-9]{10,30}$/i.test(TT_ID)
/* DENTRO DE LA APP INSTALADA, NINGUNO (25-10-2026). La app de Play (y la instalada desde la web) no lleva píxeles
   de anuncios: lo que se mide para Meta y TikTok es la web, que es adonde llevan los anuncios. Así la app no
   enseña el aviso de cookies (sin píxel solo queda el almacenamiento necesario, que no necesita permiso: LSSI
   art. 22.2) y lo que se declara en «Seguridad de los datos» de Google Play es verdad: no comparte nada. */
export function hayPixel() { return !yaEsApp() && (hayMeta() || hayTT()) }

export function consentimiento() {
  try {
    const v = localStorage.getItem(CLAVE)
    if (!v) return null
    const j = JSON.parse(v)
    // v3 (06-10-2026): el aviso ya nombra Meta Y TikTok. Quien aceptó la v2 solo
    // consintió Meta, así que con píxeles se le vuelve a preguntar.
    return j && j.v >= 3 ? j : (hayPixel() ? null : j)
  } catch { return null }
}

/* CAMBIAR DE OPINIÓN (02-11-2026, revisión del servidor). El aviso se vuelve a abrir con «Cambiar mis cookies» (en la
   política de cookies y en el pie de la portada) y lo que se elija vale ya en esta página: al retirar el permiso, los
   píxeles que ya estuvieran puestos dejan de medir (Meta y TikTok tienen su orden para eso) y se borran sus cookies de
   este navegador; al volver a darlo, siguen. Hasta hoy la única forma era borrar el almacenamiento del navegador, que
   además cerraba la sesión. */
export function guardarConsentimiento(anuncios) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ v: 3, anuncios: !!anuncios, at: new Date().toISOString() })) } catch { /* nada */ }
  if (!anuncios) retirarPixel()
  else if (cargado) { if (!rutaSinPixel()) permisoPixel(true) }
  else cargarPixel()
}

function permisoPixel(si) {
  try { if (window.fbq) window.fbq('consent', si ? 'grant' : 'revoke') } catch { /* medir nunca rompe nada */ }
  try { if (window.ttq) (si ? window.ttq.grantConsent : window.ttq.revokeConsent)?.call(window.ttq) } catch { /* idem */ }
}

// Las cookies que ponen los píxeles (las de la tabla de legal/Cookies.jsx).
const COOKIES_PIXEL = /^(_fbp|_fbc|_ttp|_tt_enable_cookie|ttcsid(_\w+)?)$/
function retirarPixel() {
  if (typeof window === 'undefined') return
  permisoPixel(false)
  try {
    const nombres = document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => COOKIES_PIXEL.test(n))
    // Se borran con el dominio con el que se pusieran: el de esta web o el de más arriba (.flotadsp.com).
    const partes = window.location.hostname.split('.')
    const dominios = ['', ...partes.slice(0, -1).map((_, i) => partes.slice(i).join('.'))]
    for (const n of nombres) {
      for (const d of dominios) document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`
    }
  } catch { /* sin cookies que borrar */ }
}

/** Vuelve a abrir el aviso de cookies («Cambiar mis cookies»): lo escucha legal/CookieBanner.jsx. */
export const AVISO_COOKIES = 'fds-cookies'
export function abrirAvisoCookies() {
  try { window.dispatchEvent(new Event(AVISO_COOKIES)) } catch { /* nada */ }
}

/* RETIRAR EL PERMISO LLEGA A LA CUENTA (02-11-2026, revisión del servidor). Con este mismo permiso el servidor manda a
   Meta el alta, la primera entrada en la app y la primera ruta (API de conversiones, backend/meta_capi.py), pero solo
   lo apuntaba al darse de alta: cambiar de opinión aquí no le llegaba y los eventos seguían saliendo. Ahora lo que se
   elige en el aviso con la sesión de la cuenta abierta (la del panel o la de quien reparte solo; no la del portal del
   conductor ni la de la plataforma «entrando como» un cliente: esa decisión no es del cliente) va a POST
   /cuenta/anuncios. Una retirada sin sesión, o que no llega (sin red, un servidor de antes), queda apuntada en el aviso
   y se manda en cuanto haya sesión (reintentarRetirada, una vez por carga). Un «Aceptar» sin sesión no se lleva a
   ninguna cuenta. Sin fetch de axios a propósito: esto va en el arranque de todas las páginas. */
function sesionDeCuenta() {
  try {
    if (window.location.pathname.startsWith('/conductor') || localStorage.getItem('flota_token_super')) return ''
    const t = localStorage.getItem('flota_token') || ''
    const b64 = (t.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')
    const datos = b64 ? JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) : null
    return datos && !datos.imp ? t : ''
  } catch { return '' }
}

function retiradaPendiente() {
  try { const j = JSON.parse(localStorage.getItem(CLAVE) || 'null'); return !!(j && j.anuncios === false && j.retirada_pendiente) } catch { return false }
}

function marcarRetirada(pendiente) {
  try {
    const j = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (!j || typeof j !== 'object' || j.anuncios !== false || !!j.retirada_pendiente === pendiente) return
    if (pendiente) j.retirada_pendiente = true
    else delete j.retirada_pendiente
    localStorage.setItem(CLAVE, JSON.stringify(j))
  } catch { /* nada */ }
}

async function enviarACuenta(anuncios) {
  const token = sesionDeCuenta()
  if (!token) { if (!anuncios) marcarRetirada(true); return false }
  try {
    const r = await fetch(`${API_BASE}/cuenta/anuncios`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ anuncios: !!anuncios }),
    })
    // Hecho, o una sesión que no lo admite (400/403/422): no se insiste. Lo demás (401, 404, 5xx) se reintenta.
    if (!anuncios) marcarRetirada(!(r.ok || [400, 403, 422].includes(r.status)))
    return r.ok
  } catch {
    if (!anuncios) marcarRetirada(true)
    return false
  }
}

// En fila: si se cambia de opinión dos veces seguidas, llega lo último.
let filaCuenta = Promise.resolve(false)
/** Lo elegido en el aviso, a la cuenta con la sesión abierta (ver arriba). */
export function avisarCuenta(anuncios) {
  filaCuenta = filaCuenta.then(() => enviarACuenta(anuncios), () => enviarACuenta(anuncios))
  return filaCuenta
}

let reintentada = false
/** La retirada que quedó apuntada, en cuanto hay sesión: una vez por carga de la página. */
export function reintentarRetirada() {
  if (reintentada || !retiradaPendiente() || !sesionDeCuenta()) return
  reintentada = true
  avisarCuenta(false)
}

const aceptado = () => hayPixel() && !!consentimiento()?.anuncios

/* EL MISMO CONSENTIMIENTO PARA LO QUE MANDA EL SERVIDOR (02-11-2026). El alta también avisa a Meta desde el servidor
   (API de conversiones, backend/meta_capi.py) y solo debe hacerlo si aquí se aceptó la medición: true o false, lo
   que contestó en el aviso; null si no ha contestado o si aquí no se pregunta (web sin píxeles, o dentro de la app
   instalada, que no lleva píxeles y declara en Google Play que no comparte nada). */
export function anunciosAceptados() {
  if (!hayPixel()) return null
  const c = consentimiento()
  return c ? !!c.anuncios : null
}

/* Las cookies del píxel de Meta para el alta (02-11-2026): `_fbp` (este navegador) y `_fbc` (el clic en el anuncio).
   La API va en otro dominio y no le llegan, y sin ellas Meta casi no puede atribuir el alta al anuncio. SOLO con la
   medición aceptada; si no, nada. Un valor raro (no empieza por «fb.» o es enorme) se descarta: el alta no puede
   fallar por una cookie. */
export function cookiesMeta() {
  if (!aceptado()) return {}
  const lee = (nombre) => {
    try {
      const par = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${nombre}=`))
      const v = par ? decodeURIComponent(par.slice(nombre.length + 1)).trim() : ''
      return v.startsWith('fb.') && v.length <= 500 ? v : ''
    } catch { return '' }
  }
  const fbp = lee('_fbp')
  const fbc = lee('_fbc')
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) }
}

/* RUTAS SIN PÍXEL (14-11-2026). En /devolucion-renting el # de la dirección lleva las respuestas y las notas de quien
   repasa su vehículo, y la página dice «No guardamos nada de tu vehículo». El píxel de Meta manda la dirección entera
   (con el #) en cada PageView, también en cada cambio del historial, y esa herramienta cambia el historial en cada
   paso. Así que ahí no se carga ninguno; y si ya estaban cargados (se llegó sin recargar desde otra página), se callan
   mientras se está en ella (pausarPixeles, que llama DevolucionRenting.jsx). */
const SIN_PIXEL = /^\/devolucion-renting(\/|$)/
function rutaSinPixel() {
  try { return SIN_PIXEL.test(window.location.pathname) } catch { return false }
}

/** Calla los píxeles ya cargados mientras se está en una ruta sin píxel; devuelve con qué se vuelven a abrir. */
export function pausarPixeles() {
  if (typeof window === 'undefined' || !cargado || !aceptado()) return () => {}
  const f = window.fbq
  const antes = f ? f.disablePushState : undefined
  try { if (f) f.disablePushState = true } catch { /* nada */ }
  permisoPixel(false)
  return () => {
    try { if (f) f.disablePushState = antes } catch { /* nada */ }
    if (aceptado()) permisoPixel(true)
  }
}

let cargado = false
export function cargarPixel() {
  if (cargado || !aceptado() || typeof window === 'undefined' || rutaSinPixel()) return
  cargado = true
  /* El fragmento oficial de Meta, sin <script> en línea (la CSP no lo deja). */
  const f = window
  if (!f.fbq) {
    const n = function fbq(...args) { n.callMethod ? n.callMethod(...args) : n.queue.push(args) }
    f.fbq = n; f._fbq = n
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }
  if (hayMeta()) {
    f.fbq('init', PIXEL_ID)
    f.fbq('track', 'PageView')
  }
  cargarTikTok()
}

/* Fragmento oficial de TikTok (Events Manager, 06-10-2026), sin <script> en línea.
   La versión anterior era un resumen y no ponía `TiktokAnalyticsObject`, `_i[id]`
   ni `_t`, que el script de TikTok usa para reconocer el píxel: esto es el oficial
   paso a paso. */
// ViewContent (10-10-2026): «le interesa» (bajó a la mitad de /repartidores o empezó el alta).
// Con 0 altas TikTok no tenía nada que aprender y la campaña iba a «Click»; esto da ~100 a la semana.
const TT_EVENTOS = { Lead: 'ClickButton', CompleteRegistration: 'CompleteRegistration', StartTrial: 'StartTrial', Subscribe: 'Subscribe', Purchase: 'CompletePayment', ViewContent: 'ViewContent' }
const TT_METODOS = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias',
  'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
function cargarTikTok() {
  if (!hayTT() || window.ttq) return
  window.TiktokAnalyticsObject = 'ttq'
  const ttq = (window.ttq = window.ttq || [])
  ttq.methods = TT_METODOS
  ttq.setAndDefer = (obj, m) => { obj[m] = (...args) => { obj.push([m, ...args]) } }
  for (const m of TT_METODOS) ttq.setAndDefer(ttq, m)
  ttq.instance = (id) => {
    const e = ttq._i[id] || []
    for (const m of TT_METODOS) ttq.setAndDefer(e, m)
    return e
  }
  ttq.load = (id, opciones) => {
    const r = 'https://analytics.tiktok.com/i18n/pixel/events.js'
    ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = r
    ttq._t = ttq._t || {}; ttq._t[id] = +new Date()
    ttq._o = ttq._o || {}; ttq._o[id] = opciones || {}
    const s = document.createElement('script')
    s.type = 'text/javascript'; s.async = true
    s.src = `${r}?sdkid=${encodeURIComponent(id)}&lib=ttq`
    document.head.appendChild(s)
  }
  ttq.load(TT_ID)
  ttq.page()
}

/* `eventId` (02-11-2026): el id con el que el servidor manda ese mismo evento a Meta por la API de conversiones
   (`meta_event_id` del alta). Con el mismo nombre y el mismo id, Meta lo cuenta UNA vez y no dos; TikTok lo admite
   igual (`event_id`). Sin id, la llamada de siempre, con tres argumentos. */
export function evento(nombre, datos, eventId) {
  if (!aceptado() || rutaSinPixel()) return
  cargarPixel()
  const idMeta = eventId ? [{ eventID: eventId }] : []
  const idTT = eventId ? [{ event_id: eventId }] : []
  try { if (hayMeta()) window.fbq('track', nombre, datos || {}, ...idMeta) } catch { /* medir nunca rompe nada */ }
  try { if (hayTT() && TT_EVENTOS[nombre]) window.ttq.track(TT_EVENTOS[nombre], datos || {}, ...idTT) } catch { /* idem */ }
}

/* El mismo evento una sola vez por página cargada: «le interesa» puede llegar por dos
   caminos (bajar a la mitad o empezar el alta) y contarlo dos veces engañaría a la puja. */
const yaEnviados = new Set()
export function eventoUnaVez(nombre, datos) {
  if (yaEnviados.has(nombre) || !aceptado()) return
  yaEnviados.add(nombre)
  evento(nombre, datos)
}

/* Antes de ir a Stripe: lo que se medirá al volver con ?pago=ok / ?regalo=. */
export function apuntarParaLaVuelta(nombre, datos) {
  try { sessionStorage.setItem(PENDIENTE, JSON.stringify({ nombre, datos })) } catch { /* nada */ }
}

export function enviarPendiente(soloSi) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDIENTE) || 'null')
    if (!p || (soloSi && !soloSi(p))) return
    if (!aceptado()) return
    sessionStorage.removeItem(PENDIENTE)
    if (hayMeta()) window.fbq('track', p.nombre, p.datos || {})
    if (hayTT() && TT_EVENTOS[p.nombre]) window.ttq.push(['track', TT_EVENTOS[p.nombre], p.datos || {}])
  } catch { /* nada */ }
}

export function olvidarPendiente() {
  try { sessionStorage.removeItem(PENDIENTE) } catch { /* nada */ }
}
