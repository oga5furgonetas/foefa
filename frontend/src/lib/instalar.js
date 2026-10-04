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

/* Ya se está usando como app (instalada o la de Play). */
export function yaEsApp() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
      || /^android-app:\/\//.test(document.referrer) || sessionStorage.getItem('flota_app') === '1'
  } catch { return false }
}

export function esIphone() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
}
