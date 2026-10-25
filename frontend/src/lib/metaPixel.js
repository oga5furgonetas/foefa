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

export function guardarConsentimiento(anuncios) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ v: 3, anuncios: !!anuncios, at: new Date().toISOString() })) } catch { /* nada */ }
  if (anuncios) cargarPixel()
}

const aceptado = () => hayPixel() && !!consentimiento()?.anuncios

let cargado = false
export function cargarPixel() {
  if (cargado || !aceptado() || typeof window === 'undefined') return
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

export function evento(nombre, datos) {
  if (!aceptado()) return
  cargarPixel()
  try { if (hayMeta()) window.fbq('track', nombre, datos || {}) } catch { /* medir nunca rompe nada */ }
  try { if (hayTT() && TT_EVENTOS[nombre]) window.ttq.track(TT_EVENTOS[nombre], datos || {}) } catch { /* idem */ }
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
