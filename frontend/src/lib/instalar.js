/* INSTALAR LA APP DESDE LA WEB (04-10-2026)
   Mientras Google Play valida la app, quien se da de alta en la web la puede
   instalar como app (PWA): icono en el móvil, pantalla completa, sin tienda.
   Chrome avisa con `beforeinstallprompt` (hay que guardarlo nada más cargar
   la página); Safari en iPhone no lo tiene: allí se explica a mano
   («Compartir → Añadir a pantalla de inicio»). */

let aviso = null
const oyentes = new Set()

export function escucharInstalacion() {
  if (typeof window === 'undefined') return
  // El de las notificaciones (sin caché ni fetch): algunos Chrome lo piden
  // para ofrecer instalar. Registrarlo no pide permiso ni suscribe a nada.
  try {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
    }
  } catch { /* nada */ }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e
    oyentes.forEach((f) => f(true))
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    try { localStorage.setItem('fds_instalada', '1') } catch { /* nada */ }
    oyentes.forEach((f) => f(false))
  })
}

export function alCambiarInstalable(f) { oyentes.add(f); return () => oyentes.delete(f) }
export const sePuedeInstalar = () => !!aviso

export async function instalar() {
  const e = aviso
  if (!e) return 'sin-aviso'
  aviso = null   // el aviso de Chrome solo se puede usar una vez
  e.prompt()
  const { outcome } = await e.userChoice
  return outcome   // 'accepted' | 'dismissed'
}

/* Ya se está usando como app (instalada, la de Play o la del APK).
   25-10-2026: la señal más fiable de la app de Play es que Android la abre con `android-app://<paquete>`
   (web.dev); `display-mode` falla en Samsung Internet y Firefox. Pero solo con NUESTROS paquetes: un enlace
   abierto desde WhatsApp o Telegram también llega como `android-app://` y eso es un navegador, no la app. El
   referente solo existe en la primera página: se recuerda para el resto de la sesión (recargas incluidas). */
const NUESTRA_APP = /^android-app:\/\/com\.flotadsp\.flota(\.web)?\/?$/
const MODO_APP = 'fds_modo_app'
export function yaEsApp() {
  try {
    if (sessionStorage.getItem(MODO_APP) === '1') return true
    const si = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true
      || /FDSApp\//.test(navigator.userAgent)
      || NUESTRA_APP.test(document.referrer) || sessionStorage.getItem('flota_app') === '1'
    if (si) sessionStorage.setItem(MODO_APP, '1')
    return si
  } catch { return false }
}

/* COMO UNA APP Y NO COMO UNA WEB (25-10-2026), solo dentro de la app instalada:
   · no se amplía la pantalla entera con dos dedos (como ninguna app; la letra se agranda en Ajustes → «Letra
     más grande»);
   · mantener pulsado un enlace, una foto o un botón no saca el menú del navegador («Abrir en una pestaña nueva»,
     «Descargar imagen»). En los campos se sigue pudiendo pegar, y el texto de las paradas, seleccionar. */
export function prepararModoApp() {
  if (typeof window === 'undefined' || !yaEsApp()) return
  try {
    document.documentElement.classList.add('modo-app')
    const vp = document.querySelector('meta[name="viewport"]')
    if (vp && !/maximum-scale/.test(vp.getAttribute('content') || '')) {
      vp.setAttribute('content', `${vp.getAttribute('content')}, maximum-scale=1, user-scalable=no`)
    }
    document.addEventListener('contextmenu', (e) => {
      const t = e.target
      if (!t?.closest || t.closest('input, textarea, [contenteditable="true"]')) return
      if (t.closest('a, img, button, [role="button"], video, canvas, svg')) e.preventDefault()
    })
  } catch { /* nada: sigue funcionando como web */ }
}

export function esIphone() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
}

export const esAndroid = () => /Android/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '')

/* El navegador de DENTRO de otra app (10-10-2026). Quien llega por un anuncio de
   TikTok o Instagram se da de alta ahí, y ahí no se instala nada: ni el aviso de
   Chrome ni «Añadir a inicio». Devuelve el nombre para decírselo, o ''. */
export function navegadorInterno() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  if (/FDSApp\//.test(ua)) return ''
  if (/musical_ly|Bytedance|TikTok|trill_/i.test(ua)) return 'TikTok'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook'
  if (/Snapchat|LinkedInApp|Twitter|Line\/|; wv\)/i.test(ua)) return 'app'
  return ''
}

/* Abre la dirección en Chrome desde el navegador de otra app (Android). Si no hay
   Chrome, Android la abre donde pueda. */
export function enlaceChrome(ruta) {
  const { host, origin } = window.location
  return `intent://${host}${ruta}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(origin + ruta)};end`
}

/* Recién dada de alta: la app le pide instalarla antes de nada. */
const RECIEN = 'fds_recien_alta'
export function marcarRecienAlta() { try { localStorage.setItem(RECIEN, '1') } catch { /* nada */ } }
export function recienAlta() { try { return localStorage.getItem(RECIEN) === '1' } catch { return false } }
export function olvidarRecienAlta() { try { localStorage.removeItem(RECIEN) } catch { /* nada */ } }
