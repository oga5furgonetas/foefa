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

export const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim()
const CLAVE = 'cookie_consent'
const PENDIENTE = 'meta_pendiente'

export function hayPixel() { return /^\d{8,20}$/.test(PIXEL_ID) }

export function consentimiento() {
  try {
    const v = localStorage.getItem(CLAVE)
    if (!v) return null
    const j = JSON.parse(v)
    return j && j.v >= 2 ? j : (hayPixel() ? null : j)   // con píxel nuevo, el aviso viejo no vale: se vuelve a preguntar
  } catch { return null }
}

export function guardarConsentimiento(anuncios) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ v: 2, anuncios: !!anuncios, at: new Date().toISOString() })) } catch { /* nada */ }
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
  f.fbq('init', PIXEL_ID)
  f.fbq('track', 'PageView')
}

export function evento(nombre, datos) {
  if (!aceptado()) return
  cargarPixel()
  try { window.fbq('track', nombre, datos || {}) } catch { /* medir nunca rompe nada */ }
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
    window.fbq('track', p.nombre, p.datos || {})
  } catch { /* nada */ }
}

export function olvidarPendiente() {
  try { sessionStorage.removeItem(PENDIENTE) } catch { /* nada */ }
}
