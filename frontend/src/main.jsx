import React, { Suspense, lazy, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { escucharInstalacion, prepararModoApp } from './lib/instalar'
import { BrowserRouter, Route, Routes, useLocation, Navigate } from 'react-router-dom'
/* Tipografía self-hosted (la CSP bloquea Google Fonts). Vite las sirve desde
   el propio dominio.

   ARCHIVO para el texto y IBM PLEX MONO para las cifras. Antes eran Inter y
   Space Grotesk, que es exactamente el par que viene por defecto en medio
   sector y por eso la app se parecía a cualquier otra. Archivo es una
   grotesque con carácter propio que aguanta los tamaños pequeños de una
   tabla densa.

   Plex Mono no es decorativo: sus cifras son TABULARES, así que en una
   columna de 129 matrículas o de importes todo alinea en vertical. Con una
   fuente de ancho variable, '1234 ABC' y '1111 BBB' ocupan distinto y la
   columna baila; hay que leerla dígito a dígito. */
import '@fontsource-variable/archivo'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import { medirVista } from './lib/analitica'
import { aplicarTema, aplicarLetra, pintarApp, RUTAS_APP, colorDeLaApp } from './lib/tema'
import { salirDeLaDemoDeReparto, inicioGuardado } from './panel/auth'

/* Señal de vida para /arranque.js. Ese vigilante espera 10 s y, si esta marca
   no aparece, da por hecho que el bundle llegó envenenado (pantalla en blanco)
   y repara la caché antes de recargar. Tiene que ponerse lo ANTES posible:
   cualquier cosa que falle más abajo ya no es un problema de carga del asset,
   y para eso está el ErrorBoundary. */
window.__flotaArrancada = true

/* EL TRADUCTOR DEL NAVEGADOR NO PUEDE TUMBAR LA APP (11-10-2026). Al traducir la página, Chrome cambia los
   textos por <font> suyos; cuando React quiere quitar o mover el texto original, ya no está donde lo
   dejó y salta «Failed to execute 'removeChild'… not a child of this node»: pantalla de error. Visto el
   03-10 en /panel/login, tres intentos seguidos desde el mismo Android, y el 24-08 en la portada. Con
   la app en seis idiomas y gente de Brasil o de fuera, traducir es normal. La salida es la que da el
   propio React (issue 11538): si el nodo ya no es hijo, no se hace nada en vez de lanzar. */
if (typeof Node === 'function' && Node.prototype) {
  const quitar = Node.prototype.removeChild
  Node.prototype.removeChild = function removeChild(hijo) {
    if (hijo && hijo.parentNode !== this) return hijo
    return quitar.call(this, hijo)
  }
  const meterAntes = Node.prototype.insertBefore
  Node.prototype.insertBefore = function insertBefore(nuevo, referencia) {
    if (referencia && referencia.parentNode !== this) return nuevo
    return meterAntes.call(this, nuevo, referencia)
  }
}

/* Tema del panel ANTES del primer render: sin destello oscuro→claro.
   Solo miraba 'light', y al pasar el defecto a 'hibrido' eso significaba que
   quien no hubiera elegido nunca tema —o sea, todo el mundo la primera vez—
   veía el panel en negro y luego saltaba a claro de golpe. */
// Misma migracion que PanelLayout (lib/tema.js): sin la marca de eleccion a mano, el valor guardado es basura
// que escribio el codigo viejo, no una preferencia. 'auto' (desde la app del repartidor) sigue al movil.
// Y la letra grande de la app del repartidor.
aplicarTema()
aplicarLetra()
// La app del repartidor, del color de la app desde el primer momento (barra de arriba incluida): sin negro mientras carga.
if (RUTAS_APP.test(window.location.pathname)) pintarApp()
import './index.css'
import { ToastProvider } from './lib/toast'
import { LangProvider } from './i18n'
import { API_BASE } from './lib/apiBase'
import { isStaleChunkError } from './lib/chunkError'
import CookieBanner from './legal/CookieBanner'
import { MARCA } from './marca'
import { DE_PLAY } from './lib/enApp'

/* ── Auto-recuperación tras deploy: si una pestaña abierta pide un chunk viejo
   (invalidado por un despliegue), Vite emite vite:preloadError. Recargamos UNA
   vez para coger la versión nueva — sin pantalla rota y sin alertas de ruido. ── */
/* TRES INTENTOS ESCALONADOS, NO UNO. Visto en vivo el 02-09-2026: navegando
   durante un despliegue, el edge sirvió HTML bajo un .js, la app se curó UNA
   vez, el chunk seguía sin propagarse y el segundo fallo cayó dentro de la
   ventana anti-bucle: pantalla de error y botón manual para el usuario. La
   ventana de un despliegue dura más de un minuto, así que se intenta hasta
   tres veces en diez minutos, esperando un poco más cada vez para dar tiempo
   al edge. Reparar ANTES de recargar, siempre: una recarga a secas vuelve a
   servir el fichero podrido desde la caché larga de los assets (2026-08-04). */
function intentarCuracion() {
  const k = 'chunk_curacion'
  let est = { t: 0, n: 0 }
  try { est = JSON.parse(sessionStorage.getItem(k) || '{}') || {} } catch { /* sin estado */ }
  const ahora = Date.now()
  if (!est.t || ahora - est.t > 10 * 60_000) est = { t: ahora, n: 0 }
  if ((est.n || 0) >= 3) return false
  est.n = (est.n || 0) + 1
  try { sessionStorage.setItem(k, JSON.stringify(est)) } catch { /* sin estado */ }
  const espera = (est.n - 1) * 2500
  setTimeout(() => repairAssetCache().finally(() => window.location.reload()), espera)
  return true
}

window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  if (!intentarCuracion()) {
    reportError('chunk sin curar tras tres intentos: ' + String(e?.payload?.message || ''), '')
  }
})

/* ── Monitorización: errores JS → backend → Telegram (máx 5/sesión, dedupe) ── */
// Ruido que NO merece alerta: chunks viejos tras deploy, cortes de red del móvil,
// errores opacos de extensiones/scripts externos, ResizeObserver…
const _NOISE = [
  'dynamically imported module', 'Importing a module script failed', 'ChunkLoadError',
  'Failed to fetch', 'NetworkError', 'Load failed', 'network error',
  'Script error', 'ResizeObserver loop',
  // El navegador de dentro de Facebook en Android (su puente con Java), no nuestro código.
  'Java object is gone',
  // Navegadores viejos sin 'wasm-unsafe-eval' en CSP: el 3D degrada solo, no es accionable.
  'WebAssembly.instantiate', 'WebAssembly.compile',
]
const _reported = new Set()
function reportError(message, stack) {
  try {
    const msg = String(message || '').slice(0, 500)
    if (!msg || _reported.size >= 5 || _reported.has(msg)) return
    if (_NOISE.some((n) => msg.includes(n))) return
    _reported.add(msg)
    fetch(`${API_BASE}/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, stack: String(stack || '').slice(0, 800), url: window.location.href }),
    }).catch(() => {})
  } catch { /* reportar nunca debe romper la app */ }
}
window.addEventListener('error', (e) => reportError(e.message, e.error?.stack))
window.addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || String(e.reason), e.reason?.stack))

/* Un error de render no debe dejar la pantalla en blanco */
// ¿Es el fallo típico de "chunk viejo tras un deploy"? Vive en lib/chunkError.js
// con los mensajes reales de cada navegador (Safari lo dice distinto que Chrome
// y por eso los iPhone no se curaban solos): así se puede probar fuera de React.

/* Reparación del caché HTTP: re-descarga cada asset del build saltándose el
   caché del navegador y lo re-almacena. Cura el caso "asset envenenado" (una
   carrera de deploy dejó cacheado un JS corrupto bajo su URL con hash): una
   recarga normal NO lo arregla porque los assets tienen caché larga. */
async function repairAssetCache() {
  try {
    const html = await (await fetch('/index.html', { cache: 'reload' })).text()
    // OJO: la hoja de estilos principal SOLO aparece en el <link> del
    // index.html, nunca dentro del JS. Mirando solo el JS, esta función no
    // reparaba el CSS principal — justo el asset que se envenenó el
    // 2026-08-06 y dejó flotadsp.com en HTML crudo, sin un solo estilo.
    const enHtml = [...html.matchAll(/assets\/[A-Za-z0-9/_.-]+\.(?:js|css)/g)].map((m) => m[0])
    const indexJs = (html.match(/assets\/[^"]*index-[A-Za-z0-9_-]+\.js/) || [])[0]
    let enJs = []
    if (indexJs) {
      const js = await (await fetch('/' + indexJs, { cache: 'reload' })).text()
      enJs = [...js.matchAll(/assets\/[A-Za-z0-9/_.-]+\.(?:js|css)/g)].map((m) => m[0])
    }
    const paths = [...new Set([...enHtml, ...enJs])]
    await Promise.allSettled(paths.map((p) => fetch('/' + p, { cache: 'reload' })))
  } catch { /* sin red: la recarga normal hará lo que pueda */ }
}

/* Tercera defensa: el CSS envenenado es SILENCIOSO.
   No lanza vite:preloadError y no rompe React — la app monta perfecta y se ve
   en HTML crudo, como un documento de 1995. Ni el ErrorBoundary ni el
   manejador de preload se enteran, así que hace falta mirarlo a propósito. */
function cssCargado() {
  let reglas = 0
  for (const hoja of document.styleSheets) {
    // Una hoja de otro origen no se puede leer: se da por buena y no se toca.
    try { reglas += hoja.cssRules?.length || 0 } catch { return true }
    if (reglas > 20) return true
  }
  return false
}

if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Margen para que el navegador registre las hojas tras el load.
    setTimeout(() => {
      // El umbral es deliberadamente absurdo: el build real trae miles de
      // reglas (el CSS pesa 111 KB). Menos de 20 no es "poco CSS", es que no
      // hay CSS. Así no se recarga a nadie por error.
      if (cssCargado()) return
      // Una sola reparación por minuto: sin este freno, un fallo permanente
      // (red caída) metería la pestaña en un bucle infinito de recargas.
      const ultimo = Number(sessionStorage.getItem('css_reparado') || 0)
      if (Date.now() - ultimo < 60_000) return
      sessionStorage.setItem('css_reparado', String(Date.now()))
      repairAssetCache().finally(() => window.location.reload())
    }, 400)
  })
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { broken: false, detail: '' } }
  static getDerivedStateFromError(error) {
    // Guardamos el mensaje REAL: un error escondido es un bug que nadie arregla.
    return { broken: true, detail: String(error?.message || error || '').slice(0, 300) }
  }
  componentDidCatch(error, info) {
    // Auto-curación: si el fallo es un chunk desactualizado, recarga UNA vez
    // (trae el index nuevo con los nombres de chunk correctos) sin molestar.
    // Repetible cada 60 s (no una vez por sesión): tras cada deploy la pestaña
    // puede envenenarse otra vez y debe poder curarse otra vez.
    // Misma politica escalonada que vite:preloadError (tres intentos en diez
    // minutos); solo cuando ya no queda intento se enseña la pantalla de error.
    if (isStaleChunkError(error?.message) && intentarCuracion()) return
    reportError(error?.message, (error?.stack || '') + (info?.componentStack || ''))
  }
  render() {
    if (!this.state.broken) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#0b0d10', color: '#eef1f6', fontFamily: 'Archivo Variable,Archivo,system-ui,sans-serif', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Algo ha ido mal</h1>
        <p style={{ margin: 0, color: '#8b94a3', fontSize: 14 }}>El error se ha reportado automáticamente. Pulsa el botón: repara y recarga.</p>
        {this.state.detail && (
          <code style={{ maxWidth: 520, padding: '9px 12px', borderRadius: 8, background: '#131315', border: '1px solid #333338', color: '#b0b0b8', fontSize: 11.5, fontFamily: 'ui-monospace,monospace', wordBreak: 'break-word', lineHeight: 1.5 }}>
            {this.state.detail}
          </code>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={() => repairAssetCache().finally(() => window.location.reload())} style={{ padding: '11px 22px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#fb923c,#ea6800)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Reparar y recargar
          </button>
          <button
            onClick={() => {
              const txt = `${MARCA.nombre} error\n${window.location.href}\n${new Date().toISOString()}\n\n${this.state.detail}`
              navigator.clipboard?.writeText(txt).catch(() => {})
            }}
            style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid #333338', background: 'transparent', color: '#b0b0b8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Copiar detalle
          </button>
        </div>
      </div>
    )
  }
}

// Tras 15 s sanos, se rearma la auto-curación (los tres intentos) para el próximo deploy.
setTimeout(() => { try { sessionStorage.removeItem('chunk_curacion') } catch { /* privado */ } }, 15000)

/* Code-splitting: la landing carga al instante; el resto de rutas se descargan
   solo cuando se visitan (panel, portal conductor, legal…). */
// La portada de empresas también va aparte (17-10-2026): quien llega a /repartidores o abre la app no la usa.
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Registro = lazy(() => import('./pages/Registro'))
const PruebaReparto = lazy(() => import('./pages/PruebaReparto'))
const CalculadoraRepartidor = lazy(() => import('./pages/CalculadoraRepartidor'))
const Empezar = lazy(() => import('./pages/Empezar'))
const Repartidores = lazy(() => import('./pages/Repartidores'))
const Iphone = lazy(() => import('./pages/Iphone'))
const Invita = lazy(() => import('./pages/Invita'))
const OpinionCorreo = lazy(() => import('./pages/OpinionCorreo'))
const MercadilloPagina = lazy(() => import('./pages/MercadilloPagina'))

/* EL ANUNCIO DE REPARTIDORES (04-10-2026) apunta a /registro?sector=autonomo
   …&utm_source=…: 410 visitas y 0 altas, porque aterrizaban en un formulario
   de una app que no habían visto. Si llega del anuncio (lleva utm), va a la
   página que la enseña y deja probarla; el alta, después. Sin tocar el
   anuncio. El botón «Crear mi cuenta» de esa página va sin utm: no hay bucle. */
try {
  const q = new URLSearchParams(window.location.search)
  if (window.location.pathname === '/registro' && q.get('sector') === 'autonomo' && q.get('utm_source')) {
    window.location.replace(`/repartidores${window.location.search}`)
  }
} catch { /* sin URL: nada */ }
const RutaApp = lazy(() => import('./pages/RutaApp'))
const PaseMovil = lazy(() => import('./pages/PaseMovil'))
const SeguimientoPedido = lazy(() => import('./pages/SeguimientoPedido'))
const RegaloPagina = lazy(() => import('./pages/RegaloPagina'))
const Planes = lazy(() => import('./pages/Planes'))
const DriverPortal = lazy(() => import('./pages/driver/DriverPortal'))
const VerificarCorreoConductor = lazy(() => import('./pages/driver/VerificarCorreoConductor'))
const PanelLogin = lazy(() => import('./panel/PanelLogin'))
const PanelLayout = lazy(() => import('./panel/PanelLayout'))
const PanelDashboard = lazy(() => import('./panel/pages/Dashboard'))
const PanelMiDia = lazy(() => import('./panel/pages/MiDia'))
const PanelVehiculos = lazy(() => import('./panel/pages/Vehiculos'))
const PanelVencimientos = lazy(() => import('./panel/pages/Vencimientos'))
const PanelRevision = lazy(() => import('./panel/pages/RevisionRapida'))
const PanelNegocio = lazy(() => import('./panel/pages/Negocio'))
const PanelGastos = lazy(() => import('./panel/pages/Gastos'))
const PanelValor = lazy(() => import('./panel/pages/Valor'))
const PanelAnalitica = lazy(() => import('./panel/pages/Analitica'))
const PanelPerfil = lazy(() => import('./panel/pages/Perfil'))
const PanelInspecciones = lazy(() => import('./panel/pages/Inspecciones'))
const PanelConductores = lazy(() => import('./panel/pages/Conductores'))
const PanelAvisosITV = lazy(() => import('./panel/pages/AvisosITV'))
const PanelRenting = lazy(() => import('./panel/pages/Renting'))
const PanelTalleres = lazy(() => import('./panel/pages/Talleres'))
const PanelAparcamiento = lazy(() => import('./panel/pages/Aparcamiento'))
const PanelCasasAlquiler = lazy(() => import('./panel/pages/CasasAlquiler'))
const PanelIncorporaciones = lazy(() => import('./panel/pages/Incorporaciones'))
const PanelOrdenes = lazy(() => import('./panel/pages/OrdenesTrabajo'))
const PanelEstadoFlota = lazy(() => import('./panel/pages/EstadoFlota'))
const PanelCentroIA = lazy(() => import('./panel/pages/CentroIA'))
const PortalTaller = lazy(() => import('./pages/PortalTaller'))
const PortalTallerLista = lazy(() => import('./pages/PortalTallerLista'))
const PanelConfiguracion = lazy(() => import('./panel/pages/Configuracion'))
const PanelTienda = lazy(() => import('./panel/pages/Tienda'))
const PanelTurnos = lazy(() => import('./panel/pages/Turnos'))
const PanelCuadrante = lazy(() => import('./panel/pages/Cuadrante'))
const PanelUsuarios = lazy(() => import('./panel/pages/Usuarios'))
const PanelIAPeritaje = lazy(() => import('./panel/pages/IAPeritaje'))
const PanelOrigenDanos = lazy(() => import('./panel/pages/OrigenDanos'))
const PanelImportaciones = lazy(() => import('./panel/pages/Importaciones'))
const PanelActividad = lazy(() => import('./panel/pages/Actividad'))
const PanelPortalConductor = lazy(() => import('./panel/pages/PortalConductor'))
const PanelAsignacion = lazy(() => import('./panel/pages/Asignacion'))
const PanelChecklistOp = lazy(() => import('./panel/pages/ChecklistOperativo'))
const PanelPlantilla = lazy(() => import('./panel/pages/PlantillaGenerador'))
const PanelDiarios = lazy(() => import('./panel/pages/Diarios'))
const PanelHoras = lazy(() => import('./panel/pages/Horas'))
const PanelReparto = lazy(() => import('./panel/pages/Reparto'))
const PanelChat = lazy(() => import('./panel/pages/Chat'))
const PanelBandeja = lazy(() => import('./panel/pages/Bandeja'))
const PanelIncidencias = lazy(() => import('./panel/pages/Incidencias'))
const PanelContactos = lazy(() => import('./panel/pages/Contactos'))
const PanelConversaciones = lazy(() => import('./panel/pages/Conversaciones'))
const PanelEmpleo = lazy(() => import('./panel/pages/Empleo'))
const EmpleoPublica = lazy(() => import('./pages/Empleo'))
const Ofertas = lazy(() => import('./pages/Ofertas'))
const EmpleoPrioridad = lazy(() => import('./pages/EmpleoPrioridad'))
const TiendaPublica = lazy(() => import('./pages/TiendaPublica'))
const PanelCorreo = lazy(() => import('./panel/pages/Correo'))
const Privacidad = lazy(() => import('./legal/Privacidad'))
const Terminos = lazy(() => import('./legal/Terminos'))
const Encargo = lazy(() => import('./legal/Encargo'))
const CookiesPage = lazy(() => import('./legal/Cookies'))
const AvisoLegal = lazy(() => import('./legal/AvisoLegal'))
const Contacto = lazy(() => import('./legal/Contacto'))
const Seguridad = lazy(() => import('./legal/Seguridad'))
const PeritajeTecnico = lazy(() => import('./pages/PeritajeTecnico'))
const Verify = lazy(() => import('./pages/Verify'))
const NotFound = lazy(() => import('./pages/NotFound'))

/* Toda la app vive en /panel. /app es un alias legado que redirige al panel nuevo. */
/* /app: por donde arranca la APP instalada (Play Store, PWA). Lleva a cada
   uno a lo suyo: el repartidor a su ruta, la oficina al panel, y quien no ha
   entrado nunca a la pantalla de entrar, que ofrece darse de alta. */
function AppRedirect() {
  // Marca de «estoy dentro de la app DE GOOGLE PLAY»: la lee el aviso de pago
  // (allí no se puede cobrar con tarjeta). Solo si la abre Play (Android lo
  // dice como android-app://): la app instalada desde la web también arranca
  // en /app y en ella sí se paga con tarjeta.
  try { if (DE_PLAY.test(document.referrer)) sessionStorage.setItem('flota_app', '1') } catch { /* sin almacenamiento */ }
  // Sin sesión, lo primero es decir qué eres («Repartir yo mismo», de una
  // empresa, la oficina): la app es sobre todo de quien reparte.
  let destino = '/empezar'
  // La demo de «Probarla ahora» no es la casa de nadie: si la app arrancara en
  // ella, quien ya tiene cuenta no saldría nunca de la demo (Dani Brao, 05-10).
  salirDeLaDemoDeReparto()
  try {
    if (localStorage.getItem('flota_driver_token')) destino = '/conductor?vista=ruta'
    // Quien reparte por su cuenta, directo a su ruta (sin pasar por el panel).
    else if (localStorage.getItem('flota_token')) destino = inicioGuardado() || '/panel'
  } catch { /* sin almacenamiento */ }
  /* SIN RECARGAR LA PÁGINA (25-10-2026). Era `window.location.replace(destino)`: cada vez que se abría la app,
     la página se cargaba DOS veces (/app y luego la ruta), con su HTML y todo el JavaScript otra vez. En un
     móvil normal con 4G eran segundos de más, lo que menos parece una app. Ahora es un cambio de pantalla
     dentro de la misma página; si va a la ruta del repartidor, ya con su color. */
  if (RUTAS_APP.test(destino)) pintarApp()
  return <Navigate to={destino} replace />
}

/* Mientras se descarga el trozo de una pantalla. En la app del repartidor, con su papel (o el oscuro) y el cian
   de la marca: el negro con un círculo naranja de antes era lo primero que se veía al abrir la app. */
function RouteLoader() {
  const app = RUTAS_APP.test(window.location.pathname)
  const fondo = app ? colorDeLaApp() : '#0a0b0f'
  const claro = app && fondo !== '#060a14'
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fondo }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${claro ? 'rgba(17,17,20,.1)' : 'rgba(255,255,255,.1)'}`, borderTopColor: '#0FC2BC', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

/* Cuenta cada pantalla por la que pasa una visita. Va DENTRO del router para
   enterarse de los cambios de ruta de la propia app, que no recargan la pagina
   y son la mayoria: medir solo en el arranque diria que todo el mundo ve una
   sola pantalla. */
function Medidor() {
  const { pathname } = useLocation()
  useEffect(() => { medirVista(pathname) }, [pathname])
  return null
}

escucharInstalacion()
// Dentro de la app instalada: sin ampliar con dos dedos ni el menú del navegador al mantener pulsado (lib/instalar.js).
prepararModoApp()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <LangProvider>
      <ToastProvider>
        <BrowserRouter>
          <Medidor />
          <CookieBanner />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/cn" element={<Landing idioma="zh" />} />
              <Route path="/zh" element={<Landing idioma="zh" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/prueba-reparto" element={<PruebaReparto />} />
              <Route path="/calculadora-repartidor" element={<CalculadoraRepartidor />} />
              <Route path="/empezar" element={<Empezar />} />
              <Route path="/repartidores" element={<Repartidores />} />
              <Route path="/iphone" element={<Iphone />} />
              <Route path="/invita" element={<Invita />} />
              <Route path="/opinion" element={<OpinionCorreo />} />
              <Route path="/mercadillo" element={<MercadilloPagina />} />
              <Route path="/ruta" element={<RutaApp />} />
              <Route path="/pase" element={<PaseMovil />} />
              <Route path="/s/:token" element={<SeguimientoPedido />} />
              <Route path="/regalo/:codigo" element={<RegaloPagina />} />
              <Route path="/planes" element={<Planes />} />
              <Route path="/privacidad" element={<Privacidad />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/encargo" element={<Encargo />} />
              <Route path="/cookies" element={<CookiesPage />} />
              <Route path="/aviso-legal" element={<AvisoLegal />} />
              <Route path="/contacto" element={<Contacto />} />
              <Route path="/security" element={<Seguridad />} />
              <Route path="/seguridad" element={<Seguridad />} />
              <Route path="/peritaje-tecnico" element={<PeritajeTecnico />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/verify/:hash" element={<Verify />} />
              <Route path="/app" element={<AppRedirect />} />
              {/* /instalar no es una página: la instalación es la tarjeta de la app. Se lleva a la app (entrar o registrarse y verla). */}
              <Route path="/instalar" element={<Navigate to="/ruta" replace />} />
              <Route path="/taller/t/:token" element={<PortalTallerLista />} />
              <Route path="/empleo" element={<Ofertas />} />
              <Route path="/empleo/:slug/:oferta" element={<EmpleoPublica />} />
              <Route path="/empleo/prioridad" element={<EmpleoPrioridad />} />
              <Route path="/t/:token" element={<TiendaPublica />} />
              <Route path="/taller/:token" element={<PortalTaller />} />
              <Route path="/verificar-correo-conductor" element={<VerificarCorreoConductor />} />
              <Route path="/conductor" element={<DriverPortal />} />
              <Route path="/conductor/:slug" element={<DriverPortal />} />

              {/* Panel de administración nuevo (modelo v2). En construcción por módulos.
                  NO afecta a las rutas actuales ni al login en vivo. */}
              <Route path="/panel/login" element={<PanelLogin />} />
              <Route path="/panel" element={<PanelLayout />}>
                {/* Operacional */}
                <Route index element={<PanelDashboard />} />
                <Route path="mi-dia" element={<PanelMiDia />} />
            <Route path="incorporaciones" element={<PanelIncorporaciones />} />
                <Route path="ordenes" element={<PanelOrdenes />} />
                <Route path="estado-flota" element={<PanelEstadoFlota />} />
                <Route path="centro-ia" element={<PanelCentroIA />} />
                <Route path="conductores" element={<PanelConductores />} />
                <Route path="turnos" element={<PanelTurnos />} />
                <Route path="cuadrante" element={<PanelCuadrante />} />
                <Route path="asignacion" element={<PanelAsignacion />} />
                <Route path="checklist-operativo" element={<PanelChecklistOp />} />
                <Route path="plantilla" element={<PanelPlantilla />} />
                <Route path="diarios" element={<PanelDiarios />} />
                <Route path="horas" element={<PanelHoras />} />
                <Route path="reparto" element={<PanelReparto />} />
                <Route path="chat" element={<PanelChat />} />
                <Route path="actividad" element={<PanelActividad />} />
                {/* Furgonetas */}
                <Route path="revision" element={<PanelRevision />} />
                <Route path="inspecciones" element={<PanelInspecciones />} />
                <Route path="vehiculos" element={<PanelVehiculos />} />
                <Route path="vencimientos" element={<PanelVencimientos />} />
                <Route path="talleres" element={<PanelTalleres />} />
                <Route path="aparcamiento" element={<PanelAparcamiento />} />
                <Route path="avisos-itv" element={<PanelAvisosITV />} />
                <Route path="renting" element={<PanelRenting />} />
                <Route path="casas-alquiler" element={<PanelCasasAlquiler />} />
                <Route path="ia-peritaje" element={<PanelIAPeritaje />} />
                <Route path="origen-danos" element={<PanelOrigenDanos />} />
                <Route path="importaciones" element={<PanelImportaciones />} />
                <Route path="configuracion" element={<PanelConfiguracion />} />
                <Route path="tienda" element={<PanelTienda />} />
                <Route path="admin" element={<PanelNegocio />} />
                <Route path="analitica" element={<PanelAnalitica />} />
                <Route path="gastos" element={<PanelGastos />} />
                <Route path="valor" element={<PanelValor />} />
                <Route path="usuarios" element={<PanelUsuarios />} />
                <Route path="perfil" element={<PanelPerfil />} />
                <Route path="portal-conductor" element={<PanelPortalConductor />} />
                <Route path="bandeja" element={<PanelBandeja />} />
                <Route path="incidencias" element={<PanelIncidencias />} />
                <Route path="contactos" element={<PanelContactos />} />
                <Route path="conversaciones" element={<PanelConversaciones />} />
                <Route path="empleo" element={<PanelEmpleo />} />
                <Route path="correo" element={<PanelCorreo />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </LangProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
