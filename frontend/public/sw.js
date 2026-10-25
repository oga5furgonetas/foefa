/* Service Worker de Flota / FDS.
   1) Web Push: enseña la notificación aunque la web esté cerrada y, al pulsarla, abre la pantalla.
   2) (25-10-2026) LA APP ABRE AL MOMENTO Y SIN COBERTURA, como una app y no como una web:
      · Los trozos de la app (/assets/v2/, con su huella en el nombre) y el lector de etiquetas (/ocr/) se
        guardan en el móvil la primera vez y después salen de ahí, sin preguntar a la red. Antes cada vez que se
        abría la app se volvía a preguntar por cada uno (la web va con `max-age=0` a propósito, ver abajo).
      · Las pantallas de la app (/app, /ruta, /conductor…) se piden a la red; si no hay red (un garaje, un pueblo)
        o tarda más de 4 s, sale la última que se guardó, en vez del dinosaurio de «Sin conexión» de Chrome.
   EL VENENO DEL BORDE (memoria «edge-asset-poisoning»): tras un despliegue, Cloudflare llegó a servir el HTML de
   la web bajo una URL .js con un 200, y el navegador lo guardaba 4 h: pantalla en blanco. Por eso aquí solo se
   guarda un .js si llega como JavaScript, un .css si llega como CSS, y nunca nada que llegue como HTML. Lo que se
   pide con `cache: 'reload'` (la reparación de main.jsx y arranque.js) va siempre a la red y rehace la copia.
   No se toca nada de otros dominios (la API va en el suyo), ni lo que no sea GET. */

const TROZOS = 'fds-trozos-v1'
const CASCARA = 'fds-cascara-v1'
const MAX_TROZOS = 160
const ES_TROZO = /^\/(assets\/v2|ocr)\//
const ES_PANTALLA_APP = /^\/(app|ruta|conductor|login|empezar|panel|mercadillo|pase)(\/|$)/
// El logo y los iconos no llevan huella en el nombre: se sirven de la copia y se renuevan por detrás.
const ES_ICONO = /^\/(favicon\.svg|favicon\.png|icon-192\.png|icon-512\.png|apple-touch-icon\.png)$/

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'FlotaDSP'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/panel' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/panel'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('install', (event) => {
  // La cáscara (index.html) ya guardada desde el primer momento: la app abre aunque la primera vez se quede sin red.
  event.waitUntil(
    fetch('/index.html', { cache: 'no-cache' })
      .then((r) => (esHtml(r) ? caches.open(CASCARA).then((c) => c.put('/__cascara', r)) : null))
      .then(() => caches.open(TROZOS).then((c) => c.add('/favicon.svg')))
      .catch(() => null)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== TROZOS && k !== CASCARA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function esHtml(r) {
  return !!r && r.ok && (r.headers.get('content-type') || '').toLowerCase().includes('text/html')
}

/* ¿Se puede guardar? Solo lo que ha llegado bien y con el tipo que toca a su extensión. */
function guardable(url, r) {
  if (!r || r.status !== 200 || r.type !== 'basic') return false
  const ct = (r.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('text/html')) return false
  const p = url.pathname
  if (/\.m?js$/.test(p)) return ct.includes('javascript')
  if (/\.css$/.test(p)) return ct.includes('text/css')
  if (/\.wasm$/.test(p)) return ct.includes('wasm') || ct.includes('octet-stream')
  return true
}

async function recortar(c) {
  const ks = await c.keys()
  for (let i = 0; i < ks.length - MAX_TROZOS; i += 1) await c.delete(ks[i])
}

async function trozo(req, url) {
  const c = await caches.open(TROZOS)
  const aLaRed = req.cache === 'reload' || req.cache === 'no-store' || req.cache === 'no-cache'
  if (!aLaRed) {
    const guardado = await c.match(req)
    if (guardado) return guardado
  }
  try {
    const r = await fetch(req)
    if (guardable(url, r)) {
      const copia = r.clone()
      c.put(req, copia).then(() => recortar(c)).catch(() => {})
    }
    return r
  } catch (e) {
    // Sin red: al recargar, Chrome pide los trozos «a la red» (no-cache); si no la hay, vale la copia guardada.
    const guardado = await c.match(req)
    if (guardado) return guardado
    throw e
  }
}

async function icono(event, url) {
  const c = await caches.open(TROZOS)
  const guardado = await c.match(event.request)
  const red = fetch(event.request).then((r) => {
    if (guardable(url, r)) c.put(event.request, r.clone()).catch(() => {})
    return r
  })
  if (guardado) { event.waitUntil(red.catch(() => null)); return guardado }
  return red
}

const SIN_RED = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f6f3"><title>FDS</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f6f3;font-family:system-ui,sans-serif;color:#111114">
<div style="padding:24px;text-align:center;max-width:320px"><img src="/favicon.svg" width="56" height="56" alt="" style="border-radius:14px">
<p style="font-size:18px;font-weight:700;margin:18px 0 6px">Sin conexión</p>
<p style="font-size:14px;line-height:1.45;color:#606068;margin:0 0 20px">En cuanto vuelva la cobertura, FDS se abre con tu ruta.</p>
<a href="" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0FC2BC;color:#04161a;font-weight:700;text-decoration:none">Reintentar</a></div></body></html>`

async function pantalla(event) {
  const c = await caches.open(CASCARA)
  const guardada = await c.match('/__cascara')
  const red = fetch(event.request).then((r) => {
    if (esHtml(r)) c.put('/__cascara', r.clone()).catch(() => {})
    return r
  })
  if (!guardada) {
    try { return await red } catch (e) { return new Response(SIN_RED, { headers: { 'content-type': 'text/html; charset=utf-8' } }) }
  }
  // Con copia: la red si contesta en 4 s (siempre la última versión); si no, o si falla, la copia.
  const espera = new Promise((ok) => setTimeout(() => ok(null), 4000))
  try {
    const r = await Promise.race([red, espera])
    if (r) return r
  } catch (e) { /* sin red */ }
  event.waitUntil(red.catch(() => null))
  return guardada
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch (e) { return }
  if (url.origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    if (ES_PANTALLA_APP.test(url.pathname)) event.respondWith(pantalla(event))
    return
  }
  if (ES_TROZO.test(url.pathname)) event.respondWith(trozo(req, url))
  else if (ES_ICONO.test(url.pathname)) event.respondWith(icono(event, url))
})
