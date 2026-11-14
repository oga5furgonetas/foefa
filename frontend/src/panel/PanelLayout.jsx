import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarClock, CalendarCheck, CalendarRange, Activity, CheckCircle2, ClipboardList,
  ClipboardCheck, Truck, Wrench, Hammer, BellRing, KeyRound, Building2, BrainCircuit, FileUp,
  Settings, Shield, LogOut, Zap, Inbox, ChevronDown, AlertTriangle, BookUser,
  Search, Sun, Moon, Contrast, MapPin, Mail, UserCircle2, Languages, ShieldAlert, Menu,
  CircleHelp, Briefcase, Store, UserCheck, ImagePlus, Loader2, Bell, BellOff, MessageCircle,
  MessagesSquare, Euro, FileSpreadsheet, PackageX, Clock, Route, HeartPulse, Sparkles, Columns2,
} from 'lucide-react'
import { aislarSesion, haySesionPrevia, volverASesionPrevia, getAdmin, isAuthed, isSuperAdmin, isCenterManager, logout, canSee, decodeToken, getVisibleCenters, SIEMPRE_VISIBLES, guardarAccesoFresco, esPlataforma, actualizarMiFoto } from './auth'
import { getMe, contarPeticionesPendientes, contarCandidatosNuevos, contarConversacionesSinLeer, subirFotoAdmin } from './api'
import { getRepasoPendientes } from '../services/api'
import { pushSupported, isPushEnabled, enablePush, disablePush } from '../lib/push'
import TrialBanner from './TrialBanner'
import CommandPalette from './CommandPalette'
import { BotonAyuda, PanelAyuda, PrimerosPasos } from './Ayuda'
import LiveNotifier from './LiveNotifier'
import AsistenteBurbuja from './AsistenteBurbuja'
import MenuMovil from './components/MenuMovil'
import EquipoEnLinea from './components/EquipoEnLinea'
import casarCentro from './casarCentro'
import { useT, LANGS } from '../i18n'
import { usePlan } from '../lib/usePlan'
import { sinPagos } from '../lib/plataforma'
import { voces } from '../lib/sector'
import { vigilarVersion, recargarCuandoNadieMira } from '../lib/versionApp'
import { MARCA } from '../marca'
import { tituloDe } from '../lib/titulo'
import { aplicarTema } from '../lib/tema'

const keyOf = (to) => (to === '/panel' ? 'dashboard' : to.split('/').pop())

// Qué feature del plan requiere cada ruta (undefined = siempre visible)
const ROUTE_FEATURE = {
  chat: 'chat',
  asignacion: 'assignments',
  plantilla: 'assignments',
  'ia-peritaje': 'forensics',
  // Importar NO va con `export` (06-10-2026): la bienvenida manda aquí a cargar la
  // flota y Esencial promete «importar de Excel»; sin esto, un cliente de Esencial
  // no podía ni dar de alta sus furgonetas desde su Excel.
}

// Menú ÚNICO agrupado por intención (sin pestañas: todo el mapa visible siempre).
// Vencimientos fusiona en una página ITV + Renting + Casas de alquiler; las rutas
// antiguas siguen vivas (deep-links, paleta ⌘K) — solo cambia la navegación.
// Los grupos van en gris y en tinta el de la pantalla abierta (14-11-2026): sin cuadraditos de colores, que eran
// color sin significado. El cian solo marca la pantalla activa (la raya de `.nav-item-active`).
/* ── AVISOS DEL MENU ───────────────────────────────────────────────────────
   Ruta -> cuantas cosas hay esperando respuesta en ella. Se pinta en rojo al
   lado del nombre. Vive aparte del menu para que anadir un aviso nuevo sea una
   linea y no haya que tocar el render. */
const AVISOS = {
  '/panel/turnos': ({ peticionesPend }) => peticionesPend,
  // Candidaturas que nadie ha mirado todavia. Dejan de contar en cuanto se les
  // cambia la fase, que es lo que se pidio: el numero es «gente por mirar».
  '/panel/empleo': ({ candidatosNuevos }) => candidatosNuevos,
  // Mensajes privados sin leer.
  '/panel/chat': ({ chatSinLeer }) => chatSinLeer,
  // WhatsApp: mensajes de conductores y talleres que nadie ha abierto.
  '/panel/conversaciones': ({ wsSinLeer }) => wsSinLeer,
  // Las revisiones de hoy que nadie ha repasado todavía (14-11-2026). Las de días anteriores no cuentan.
  '/panel/repaso': ({ repasoPend }) => repasoPend,
}
// Lo que dice el número al pasar por encima, si no son peticiones.
const AVISO_TITULO = { '/panel/repaso': 'repaso.menu.aviso' }

/* SEIS GRUPOS, POR LO QUE LA PERSONA VA A HACER, NO POR DEPARTAMENTO.
   «Flota» es mirar los vehículos; «Taller» es arreglarlos —la incidencia y la
   orden van juntas porque una lleva a la otra—; «Operación» es quién sale hoy
   y con qué; «Equipo» es la gente. Con los grupos por departamento había
   cajones de diez cosas sin relación entre sí, y el menú no cabía en pantalla.
   Solo hay UN grupo abierto (el de la pantalla donde estás) y «Hoy» siempre,
   porque ahí vive el chat y sus no leídos. */
const GRUPO_FIJO = 'nav.g.today'

const NAV_DEF = [
  { g: 'nav.g.today', gIcon: Sun, items: [
    { to: '/panel', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/panel/mi-dia', labelKey: 'nav.miDia', icon: Sun },
    { to: '/panel/chat', labelKey: 'nav.chat', icon: MessageCircle },
    { to: '/panel/centro-ia', labelKey: 'nav.centroIA', icon: Sparkles },
  ]},
  { g: 'nav.g.fleet', gIcon: Truck, items: [
    { to: '/panel/vehiculos', labelKey: 'nav.vehicles', icon: Truck },
    { to: '/panel/repaso', labelKey: 'nav.repaso', icon: Columns2 },
    { to: '/panel/estado-flota', labelKey: 'nav.estadoFlota', icon: HeartPulse },
    { to: '/panel/inspecciones', labelKey: 'nav.inspections', icon: ClipboardList },
    { to: '/panel/revision', labelKey: 'nav.revision', icon: CheckCircle2 },
    { to: '/panel/origen-danos', labelKey: 'nav.origen', icon: ShieldAlert },
    { to: '/panel/vencimientos', labelKey: 'nav.grp.expiry', icon: CalendarClock },
    { to: '/panel/aparcamiento', labelKey: 'nav.parking', icon: MapPin },
  ]},
  { g: 'nav.g.taller', gIcon: Wrench, items: [
    { to: '/panel/incidencias', labelKey: 'nav.incidents', icon: AlertTriangle },
    { to: '/panel/ordenes', labelKey: 'nav.ordenes', icon: Hammer },
    { to: '/panel/talleres', labelKey: 'nav.workshops', icon: Wrench },
  ]},
  { g: 'nav.g.reparto', gIcon: Zap, items: [
    { to: '/panel/reparto', labelKey: 'nav.reparto', icon: Route },
    { to: '/panel/asignacion', labelKey: 'nav.assign', icon: ClipboardCheck },
    { to: '/panel/plantilla', labelKey: 'nav.template', icon: FileSpreadsheet },
    { to: '/panel/diarios', labelKey: 'nav.dnr', icon: PackageX },
    { to: '/panel/horas', labelKey: 'nav.horas', icon: Clock },
    { to: '/panel/cuadrante', labelKey: 'nav.cuadrante', icon: CalendarRange },
    { to: '/panel/turnos', labelKey: 'nav.shifts', icon: CalendarCheck },
    { to: '/panel/checklist-operativo', labelKey: 'nav.checklist', icon: CheckCircle2 },
  ]},
  { g: 'nav.g.personas', gIcon: Users, items: [
    { to: '/panel/conductores', labelKey: 'nav.drivers', icon: Users },
    { to: '/panel/incorporaciones', labelKey: 'nav.incorporaciones', icon: UserCheck },
    { to: '/panel/empleo', labelKey: 'nav.empleo', icon: Briefcase },
    { to: '/panel/contactos', labelKey: 'nav.contacts', icon: BookUser },
    { to: '/panel/conversaciones', labelKey: 'nav.conversaciones', icon: MessagesSquare },
  ]},
  { g: 'nav.g.system', gIcon: Settings, items: [
    { to: '/panel/actividad', labelKey: 'nav.activity', icon: Activity },
    { to: '/panel/importaciones', labelKey: 'nav.imports', icon: FileUp },
    { to: '/panel/ia-peritaje', labelKey: 'nav.ai', icon: BrainCircuit },
    { to: '/panel/tienda', labelKey: 'nav.tienda', icon: Store },
    { to: '/panel/configuracion', labelKey: 'nav.settings', icon: Settings },
  ]},
]
// Rutas que ya no están en el menú pero siguen accesibles vía paleta/URL
const PALETTE_EXTRA = [
  { to: '/panel/avisos-itv', labelKey: 'nav.itvalerts', icon: BellRing, key: 'avisos-itv' },
  { to: '/panel/renting', labelKey: 'nav.renting', icon: KeyRound, key: 'renting' },
  { to: '/panel/casas-alquiler', labelKey: 'nav.rental', icon: Building2, key: 'casas-alquiler' },
]
const EXPIRY_KEYS = ['avisos-itv', 'renting', 'casas-alquiler']
// Pantallas que van con otro modulo al activarlo en una empresa. «Estado de la flota» es otra forma de
// mirar los mismos vehículos: quien tiene Vehículos la tiene, sin casilla propia que nadie sabría marcar.
const MODULO_DE = { 'avisos-itv': 'vencimientos', renting: 'vencimientos', 'casas-alquiler': 'vencimientos', 'estado-flota': 'vehiculos' }
// Las del propio usuario: ninguna empresa se queda sin ellas.
const SIN_MODULO = new Set(['perfil', 'login', 'portal-conductor'])

/* ── MENU DE USUARIO ───────────────────────────────────────────────────────
   Arriba a la derecha, que es donde lo busca todo el mundo. Antes vivia al
   FONDO del sidebar, debajo de treinta entradas de menu: para cerrar sesion o
   cambiar de idioma habia que bajar toda la barra.

   Se cierra al pulsar fuera y con Escape. Sin lo segundo, en un portatil con
   el trackpad ocupado hay que buscar un hueco vacio de la pantalla para
   cerrarlo, y en esta app casi no hay huecos vacios. */
function MenuUsuario({ admin, showAdmin, lang, setLang, langs, onLogout, t }) {
  const [abierto, setAbierto] = useState(false)
  const [notif, setNotif] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)
  const [errPush, setErrPush] = useState('')
  const canPush = pushSupported()

  // El estado REAL de la suscripcion, no lo que creamos recordar: el navegador
  // puede haberla revocado por su cuenta.
  useEffect(() => { isPushEnabled().then(setNotif).catch(() => {}) }, [])

  async function toggleNotif() {
    if (notifBusy) return
    setNotifBusy(true); setErrPush('')
    try {
      if (notif) {
        await disablePush()
        setNotif(false)
      } else {
        const r = await enablePush()
        if (r === 'ok') setNotif(true)
        else setErrPush(r === 'denied' ? t('push.denied')
          : r === 'unsupported' ? t('push.unsupported') : t('push.error'))
      }
    } finally { setNotifBusy(false) }
  }
  const [foto, setFoto] = useState(admin?.photo_url || null)
  // El blob puede recibir la foto DESPUES de montar el menu (llega con el
  // primer /auth/me): sin esto el useState de arriba solo la leia al montar.
  useEffect(() => { setFoto(admin?.photo_url || null) }, [admin?.photo_url])
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const fileRef = useRef(null)
  const caja = useRef(null)

  // Pedida por Dani el 18-09-2026, "le da un toque": cada uno se pone su
  // foto y sale en la cabecera. Se guarda en el blob de sesion al momento
  // (actualizarMiFoto) para que no haga falta recargar ni esperar al
  // siguiente /auth/me para verla.
  async function cambiarFoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !admin?.id) return
    setSubiendoFoto(true)
    try {
      const { data } = await subirFotoAdmin(admin.id, file)
      setFoto(data.photo_url)
      actualizarMiFoto(data.photo_url)
    } catch { /* la cabecera se queda con la foto de antes, sin romper nada */ }
    finally { setSubiendoFoto(false) }
  }

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false) }
    // `pointerdown` y no `mousedown`: en un movil, tocar fuera de un menu no
    // siempre dispara los eventos de raton, y el desplegable se quedaba
    // abierto sin forma de cerrarlo mas que recargando.
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  // Iniciales del nombre. Con una sola palabra se cogen sus dos primeras
  // letras: 'D' solo en un circulo no identifica a nadie.
  const nombre = admin?.name || 'Admin'
  const trozos = nombre.trim().split(/\s+/).filter(Boolean)
  const iniciales = (trozos.length > 1
    ? trozos[0][0] + trozos[1][0]
    : nombre.slice(0, 2)).toUpperCase()

  return (
    <div className="relative" ref={caja}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`flex items-center gap-2 rounded-lg border px-1.5 py-1 transition-colors ${
          abierto ? 'border-dark-600 bg-dark-800' : 'border-transparent hover:bg-dark-800/70'}`}
      >
        {/* Gris, no cian (14-11-2026, ARREGLOS-5 N3): el cian es la acción principal de cada pantalla, y el avatar fijo
            de la cabecera era un segundo cian en todas. */}
        <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-md bg-dark-700 text-[11px] font-bold text-dark-50">
          {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : iniciales}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[130px] truncate text-[12.5px] font-semibold text-dark-100">{nombre}</span>
          <span className="block text-[10.5px] text-dark-500">
            {showAdmin ? 'Super-admin' : t('nav.admin')}
          </span>
        </span>
        <ChevronDown size={13} className={`flex-none text-dark-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div role="menu"
             className="absolute right-0 z-50 mt-1.5 w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-dark-700 bg-dark-900 shadow-xl shadow-black/40">
          <div className="border-b border-dark-800 px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-dark-100">{nombre}</p>
            <p className="truncate text-[11px] text-dark-500">
              {showAdmin ? 'Super-admin' : t('nav.admin')}
            </p>
          </div>

          <NavLink to="/panel/perfil" onClick={() => setAbierto(false)} role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-dark-200 hover:bg-dark-800">
            <UserCircle2 size={15} className="text-dark-400" /> {t('nav.profile')}
          </NavLink>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={cambiarFoto} />
          <button onClick={() => fileRef.current?.click()} disabled={subiendoFoto} role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-dark-200 hover:bg-dark-800 disabled:opacity-50">
            {subiendoFoto ? <Loader2 size={15} className="animate-spin text-dark-400" /> : <ImagePlus size={15} className="text-dark-400" />}
            Cambiar foto de perfil
          </button>
          <NavLink to="/panel/portal-conductor" onClick={() => setAbierto(false)} role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-dark-200 hover:bg-dark-800">
            <Shield size={15} className="text-dark-400" /> {t('nav.portal')}
          </NavLink>
          {/* EL CORREO DE LA EMPRESA VIVE AQUI, no en el menu de la izquierda:
              es del dueño, no de la operativa, y se busca donde esta el nombre
              de uno. Solo lo ve el super-admin, que es el unico que puede
              escribir en nombre de la empresa. */}
          {showAdmin && (
            <NavLink to="/panel/correo" onClick={() => setAbierto(false)} role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-dark-200 hover:bg-dark-800">
              <Mail size={15} className="text-dark-400" /> Correo de la empresa
            </NavLink>
          )}

          {/* LOS AVISOS AL MOVIL VIVEN AQUI, no dentro del chat. Estaban en una
              esquina de UNA pantalla, asi que quien no entrara en el chat no
              llegaba a saber que existian — y valen para todo: deposito bajo,
              ITV, una orden de taller, un privado. Se activan por DISPOSITIVO,
              y por eso el texto dice «en este dispositivo»: activarlo en el
              ordenador no lo activa en el movil. */}
          {canPush && (
            <button onClick={toggleNotif} disabled={notifBusy} role="menuitem"
              className="flex w-full items-center gap-2.5 border-t border-dark-800 px-3 py-2 text-left text-[13px] text-dark-200 hover:bg-dark-800 disabled:opacity-50">
              {notifBusy ? <Loader2 size={15} className="animate-spin text-dark-400" />
                : notif ? <Bell size={15} className="text-emerald-400" />
                : <BellOff size={15} className="text-dark-400" />}
              <span className="min-w-0 flex-1">
                <span className="block">{notif ? 'Avisos activados' : 'Activar avisos'}</span>
                <span className="block text-[11px] text-dark-500">en este dispositivo</span>
              </span>
            </button>
          )}
          {errPush && <p className="px-3 pb-1 text-[11px] text-amber-300">{errPush}</p>}

          {/* El idioma vive aqui y no suelto en la barra: se cambia una vez y
              ocupaba sitio fijo en una cabecera que ya iba llena. */}
          <div className="flex items-center gap-2.5 border-t border-dark-800 px-3 py-2">
            <Languages size={15} className="flex-none text-dark-400" />
            <select value={lang} onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1 text-[12.5px] font-medium text-dark-200 focus:outline-none">
              {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <button onClick={() => { setAbierto(false); onLogout() }} role="menuitem"
            className="flex w-full items-center gap-2.5 border-t border-dark-800 px-3 py-2 text-left text-[13px] text-dark-200 hover:bg-dark-800">
            <LogOut size={15} className="text-dark-400" /> {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  )
}


export default function PanelLayout() {
  // ANTES de pintar nada (los avisos leen lo guardado al montarse).
  aislarSesion()
  const nav = useNavigate()
  const loc = useLocation()
  const admin = getAdmin()
  const { lang, setLang, t } = useT()
  // El título de la pestaña: la pantalla donde estás · la marca (29-10-2026). Antes, todas decían lo mismo.
  useEffect(() => {
    const actual = [...NAV_DEF.flatMap((g) => g.items), ...PALETTE_EXTRA]
      .filter((it) => loc.pathname === it.to || (it.to !== '/panel' && loc.pathname.startsWith(it.to + '/')))
      .sort((a, b) => b.to.length - a.to.length)[0]
    document.title = tituloDe(t(actual ? actual.labelKey : 'nav.dashboard'))
  }, [loc.pathname, t])
  const { limits, modulos, billing } = usePlan()
  const vz = voces(billing?.sector)
  // Quien reparte solo no tiene panel de empresa: tiene su app (/ruta).
  // Con lo que lleve la URL (?pago=ok al volver de Stripe): si se perdiera, no
  // vería «Pago recibido, activando…».
  useEffect(() => { if (billing?.sector === 'autonomo') nav('/ruta' + window.location.search, { replace: true }) }, [billing?.sector, nav])
  // ¿Tiene la empresa activada esta pantalla? (Negocio → Clientes → Módulos)
  const moduloOk = (k) => !Array.isArray(modulos) || SIN_MODULO.has(k) || modulos.includes(MODULO_DE[k] || k)
  /* `?centro=OGA5` en la dirección (11-11-2026, cuadrante-3): el aviso de una petición de OGA5 abría el panel con
     la última nave guardada en el navegador (DGA1) y la bandeja salía vacía. Si la dirección trae un centro que esta
     persona puede ver, se elige ese ya al pintar (sin enseñar un momento el de antes); el parámetro se quita abajo. */
  const [center, setCenter] = useState(() => {
    try {
      const pedido = casarCentro(new URLSearchParams(window.location.search).get('centro'), getVisibleCenters())
      if (pedido) return pedido
    } catch { /* sin dirección legible, lo de siempre */ }
    return localStorage.getItem('panel_center') || 'Todos'
  })
  const [cmdOpen, setCmdOpen] = useState(false)
  /* Si se publica una compilación distinta a la que tiene esta pestaña, se
     avisa. Se mira cada cinco minutos y al volver a la pestaña, que es cuando
     de verdad importa: alguien vuelve del café y sigue con lo de hace horas. */
  const [hayVersionNueva, setHayVersionNueva] = useState(false)
  useEffect(() => {
    // Con llaves y una variable: desde fuera no se puede saber si lo que
    // devuelve una llamada es una función de limpieza, y React lo llamaría
    // igual al salir de la pantalla. Así se lee de un vistazo.
    let dejarDeRecargar = () => {}
    const dejarDeVigilar = vigilarVersion(() => {
      setHayVersionNueva(true)
      // Y si la pestaña se queda en segundo plano, se actualiza sola: el aviso
      // solo sirve si alguien lo mira (ver `recargarCuandoNadieMira`).
      dejarDeRecargar = recargarCuandoNadieMira()
    })
    return () => { dejarDeVigilar(); dejarDeRecargar() }
  }, [])
  const [ayudaOpen, setAyudaOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  /* La tecla `?` abre la ficha de la pantalla actual. Se ignora si el foco
     esta en un campo de texto: en un buscador, `?` es un caracter, no un
     atajo, y robarselo hace que la app parezca rota. */
  useEffect(() => {
    const h = (e) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement
      const tag = (el?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return
      e.preventDefault()
      setAyudaOpen(true)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  /* Tres temas, y la rampa vive en variables CSS:
       hibrido — raíl y cabecera en negro, contenido en claro (por defecto)
       dark    — todo oscuro
       light   — todo claro, raíl incluido
     El híbrido es el que se pidió al ver el cuadre del debrief, y es el que
     mejor separa "dónde estoy" (el raíl) de "qué estoy mirando" (el papel). */
  const [theme, setTheme] = useState(() => {
    /* MIGRACION DE UNA SOLA VEZ, Y HACE FALTA.
       El codigo anterior guardaba 'dark' en localStorage AL MONTAR, sin que
       nadie eligiera nada. Asi que todo el mundo tiene un tema guardado
       aunque nunca haya tocado el boton, y un simple `|| 'hibrido'` como
       defecto no lo habria visto NADIE: el valor guardado gana siempre.
       Se distingue lo elegido a mano —que se respeta— de lo que se escribio
       solo, con una marca aparte que solo pone el boton. */
    try {
      const elegido = localStorage.getItem('panel_theme_elegido')
      const guardado = localStorage.getItem('panel_theme')
      if (elegido) return guardado || 'hibrido'
      return 'hibrido'
    } catch { return 'hibrido' }
  })
  useEffect(() => {
    aplicarTema(theme)                    // 'auto' (elegido en la app del repartidor) sigue al móvil
    try { localStorage.setItem('panel_theme', theme) } catch { /* incognito */ }
  }, [theme])

  /* Un solo grupo abierto: el de la pantalla donde estás. «Hoy» va siempre
     abierto (`GRUPO_FIJO`). Abrir otro cierra el anterior; y al ir a una
     pantalla de un grupo cerrado —por el menú, la paleta o un enlace— ese
     grupo se abre solo, para que el menú siempre enseñe dónde estás. */
  const grupoActivo = NAV_DEF.find((g) => g.items.some((it) =>
    it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to)))?.g || null
  const [grupoAbierto, setGrupoAbierto] = useState(grupoActivo)
  useEffect(() => { if (grupoActivo) setGrupoAbierto(grupoActivo) }, [grupoActivo])
  function toggleGroup(key) {
    if (key === GRUPO_FIJO) return
    setGrupoAbierto((prev) => (prev === key ? null : key))
  }

  // Paleta de comandos global: Ctrl/Cmd+K
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // (El menú se calcula más abajo, tras conocer permisos y plan)

  // Centros DINÁMICOS de este DSP (multi-tenant: nunca hardcodeado).
  // El cálculo vive en auth.js porque tiene que salir del JWT: el blob de
  // localStorage se puede haber quedado a medias y aquí eso se traducía en un
  // panel con un solo botón "Todos" y sin datos.
  const centers = getVisibleCenters()

  // Si el usuario tiene exactamente 1 centro asignado, forzamos ese centro automáticamente
  const singleCenter = centers.length === 1 ? centers[0] : null

  useEffect(() => {
    if (singleCenter && center !== singleCenter) setCenter(singleCenter)
  }, [singleCenter]) // eslint-disable-line

  // Un centro guardado que ya no se puede ver (otro usuario en el mismo
  // ordenador, o permisos recortados) dejaba al panel pidiendo un centro
  // prohibido: 403 en todo y pantallas vacías, sin forma de arreglarlo desde la
  // interfaz porque ese centro ni siquiera aparecía como botón.
  useEffect(() => {
    if (center !== 'Todos' && centers.length && !centers.includes(center)) setCenter('Todos')
  }, [center, centers.join('|')]) // eslint-disable-line

  useEffect(() => { localStorage.setItem('panel_center', center) }, [center])

  /* El `?centro=` también cuando llega con el panel ya abierto (un enlace dentro de la app). Se elige si se puede
     ver y el parámetro se quita SIEMPRE de la dirección: si se quedara, recargar o volver atrás pisaría el centro
     que la persona haya elegido después. Los demás parámetros (`?con=` del chat…) se conservan. */
  useEffect(() => {
    const sp = new URLSearchParams(loc.search)
    if (!sp.has('centro')) return
    const pedido = casarCentro(sp.get('centro'), centers)
    if (pedido) setCenter(pedido)
    sp.delete('centro')
    const resto = sp.toString()
    nav(`${loc.pathname}${resto ? `?${resto}` : ''}${loc.hash}`, { replace: true })
  }, [loc.search]) // eslint-disable-line

  /* ── PETICIONES DE DIAS SIN CONTESTAR, EN EL MENU ────────────────────────
     Dani: "si tengo 1 persona por contestar pon 1, si tengo 2 personas pero 3
     solicitudes pon 3, en rojo, para que nunca se me pase".

     Se cuentan PETICIONES y no personas: hay que contestar tres veces. El aviso
     tiene que verse desde CUALQUIER pantalla —por eso vive aqui y no en la
     pagina de Días libres, donde solo lo veria quien ya ha entrado a mirar, que
     es justo el que no lo necesita.

     Se vuelve a preguntar cada 2 minutos y al volver a la pestana, con el mismo
     patron que los permisos. Si la peticion falla NO se pone a cero: se deja el
     ultimo numero bueno, porque un cero falso es la unica respuesta que hace
     que alguien deje de mirar. */
  const [peticionesPend, setPeticionesPend] = useState(0)
  const [candidatosNuevos, setCandidatosNuevos] = useState(0)
  const [chatSinLeer, setChatSinLeer] = useState(0)
  const [wsSinLeer, setWsSinLeer] = useState(0)
  const [repasoPend, setRepasoPend] = useState(0)
  useEffect(() => {
    if (!isAuthed()) return
    let vivo = true
    const mirar = () => {
      if (!vivo || !isAuthed() || document.hidden) return
      contarPeticionesPendientes(center)
        .then((r) => { if (vivo) setPeticionesPend(r.data?.pendientes || 0) })
        .catch(() => {})
      // Mismo latido y misma regla: si falla NO se pone a cero, se deja el
      // ultimo numero bueno. Un cero falso hace que se deje de mirar.
      contarCandidatosNuevos(center)
        .then((r) => { if (vivo) setCandidatosNuevos(r.data?.nuevos || 0) })
        .catch(() => {})
      // Solo quien ve la pantalla: sin el permiso el servidor da 403 y seria
      // ruido cada dos minutos. Y con el mismo criterio que los demas: si
      // falla, se deja el ultimo numero bueno.
      if (canSee('conversaciones')) {
        contarConversacionesSinLeer()
          .then((r) => { if (vivo) setWsSinLeer(r.data?.no_leidas || 0) })
          .catch(() => {})
      }
    }
    mirar()
    const id = setInterval(mirar, 120000)
    document.addEventListener('visibilitychange', mirar)
    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', mirar)
    }
  }, [center])

  /* EL NÚMERO DE «REPASO» (14-11-2026), con su propio latido: solo para quien puede abrir esa pantalla, y no antes de
     saberlo. Mientras `/org/billing` no ha llegado, `modulos` es undefined y `moduloOk` dice que sí a todo (para que
     el menú no parpadee); por eso aquí se espera a tener la respuesta. Si la empresa no tiene el módulo, o esta
     persona no lo tiene entre sus permisos (que se refrescan solos, ver abajo), no se pide nada y el número se va.
     Cuando cambia cualquiera de las dos cosas, el latido se para o vuelve a empezar; al salir del panel, se para.
     Los permisos también se esperan: los del inicio de sesión pueden ser viejos, y los de verdad llegan con la primera
     respuesta de /auth/me (`permisosSabidos`, lo pone el efecto de «Permisos frescos», haya ido bien o mal). */
  const [permisosSabidos, setPermisosSabidos] = useState(false)
  const puedeRepaso = !!billing && permisosSabidos && moduloOk('repaso') && canSee('repaso')
  useEffect(() => {
    if (!puedeRepaso || !isAuthed()) { setRepasoPend(0); return undefined }
    let vivo = true
    const mirar = () => {
      if (!vivo || !isAuthed() || document.hidden) return
      // Solo el número (/repaso/pendientes = sin_repasar + a_medias de hoy), no el día entero. La propia pantalla
      // lo pone al día al decidir cada lado. Si falla, se deja el último número bueno. Con `avisar: false` (una
      // empresa con la IA que nunca ha usado el Repaso, CONTRATO R7) no se pinta: el número no persigue a quien
      // trabaja con Revisión rápida. Un servidor que no lo mande, como siempre.
      getRepasoPendientes(center)
        .then((r) => {
          const n = r.data?.pendientes
          if (vivo && typeof n === 'number') setRepasoPend(r.data?.avisar === false ? 0 : n)
        })
        .catch(() => {})
    }
    mirar()
    const id = setInterval(mirar, 120000)
    document.addEventListener('visibilitychange', mirar)
    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', mirar)
    }
  }, [center, puedeRepaso])

  /* Permisos frescos al abrir el panel.

     El JWT dura 72 h y lleva dentro los permisos del momento del login, asi que
     quitarle un modulo a alguien no se le notaba hasta que cerraba sesion: la
     pantalla de Usuarios decia "guardado" y el menu del otro seguia igual.
     Aqui se le pregunta al servidor y se re-pinta solo si algo ha cambiado.
     Un 401 aqui ya lo trata el interceptor de axios (cierra sesion). */
  const [, setAccesoTick] = useState(0)
  useEffect(() => {
    if (!isAuthed()) return
    let vivo = true
    const mirar = () => {
      if (!vivo || !isAuthed() || document.hidden) return
      getMe()
        .then((r) => {
          if (!vivo) return
          let cambio = guardarAccesoFresco(r.data)
          // LA FOTO NO VIAJA EN EL LOGIN, solo en /auth/me: sin copiarla aqui,
          // quien iniciaba sesion de nuevo NO veia su foto guardada (ni en la
          // cabecera, ni en la burbuja de la IA, ni en sus mensajes del chat)
          // hasta volver a subirla. Es cosmetica: no pasa por el circuito de
          // permisos de arriba, solo se copia al blob si la respuesta la trae.
          if (r.data && 'photo_url' in r.data
              && (getAdmin()?.photo_url || null) !== (r.data.photo_url || null)) {
            actualizarMiFoto(r.data.photo_url || null)
            cambio = true
          }
          if (cambio) setAccesoTick((n) => n + 1)
        })
        .catch(() => {})
        .finally(() => { if (vivo) setPermisosSabidos(true) })
    }
    mirar()
    /* NO SOLO AL ABRIR. Antes esto corria una vez al montar el panel, asi que
       quien tuviera la pestaña abierta seguia con los permisos viejos hasta
       recargar: se le daba acceso a un modulo, no le aparecia, y parecia que
       el guardado no habia funcionado.

       Dos disparadores baratos y suficientes:
        · al volver a la pestaña, que es cuando la gente mira despues de que
          le digan "ya te lo he puesto";
        · y cada 2 minutos de fondo, para el que la deja abierta todo el dia.
       Solo se re-pinta si algo CAMBIA de verdad (`guardarAccesoFresco`
       devuelve false si la respuesta es identica), asi que no parpadea. */
    const alVolver = () => { if (!document.hidden) mirar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    const reloj = setInterval(mirar, 120000)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
      clearInterval(reloj)
    }
  }, [])

  if (!isAuthed()) return <Navigate to="/panel/login" replace />

  const sa = isSuperAdmin()
  const cm = isCenterManager()

  // ¿Es visible este item con los permisos + plan actuales?
  const itemVisible = (it) => {
    const k = keyOf(it.to)
    // El Centro de IA (19-10-2026) es de la empresa dueña: la clave de IA la paga ella, no las empresas cliente.
    if (k === 'centro-ia') return esPlataforma()
    if (!moduloOk(k)) return false
    if (k === 'vencimientos') return EXPIRY_KEYS.some((ek) => canSee(ek))
    // La tienda de ropa es del negocio de FlotaDSP, no de la flota del cliente (y en la app de iPhone no existe, 09-11-2026).
    if (k === 'tienda' && (!esPlataforma() || sinPagos())) return false
    // Las órdenes de taller van con Talleres: quien puede ver los talleres
    // puede ver lo que está en ellos. Sin esto, `canSee('ordenes')` es false
    // para todo el que tenga permisos definidos —el permiso no existe en
    // ninguna lista— y la entrada desaparecía del menú sin ningún error.
    if (k === 'ordenes') return canSee('talleres')
    // El estado de la flota va con Vehículos (17-10-2026): son las mismas furgonetas.
    if (k === 'estado-flota') return canSee('vehiculos')
    // El cuadrante iba con Turnos (29-09-2026) y desde el 30-09 tiene casilla
    // propia (Dani: «¿no puedo marcarle cuadrante?»): el servidor se la marcó
    // una vez a quien tenía Días libres (`migrar_permiso_cuadrante`).
    if (!SIEMPRE_VISIBLES.has(k) && !canSee(k)) return false
    const feat = ROUTE_FEATURE[k]
    if (feat && limits && limits[feat] === false) return false
    return true
  }
  // Menú agrupado (traducido) + lista plana para guard/paleta/móvil
  const groups = NAV_DEF
    .map((g) => ({ ...g, key: g.g, g: t(g.g), items: g.items.filter(itemVisible).map((it) => ({
      // Un súper tiene repartidores, no «conductores».
      ...it, label: it.labelKey === 'nav.drivers' && vz ? vz.conductores : t(it.labelKey),
      // El aviso se cuelga aqui, del sitio donde ya se traduce el menu, para
      // que cualquier entrada futura solo tenga que anadir su clave a AVISOS.
      aviso: AVISOS[it.to] ? AVISOS[it.to]({ peticionesPend, candidatosNuevos, chatSinLeer, wsSinLeer, repasoPend }) : 0,
      avisoTitulo: AVISO_TITULO[it.to] ? t(AVISO_TITULO[it.to]) : '',
    })) }))
    .filter((g) => g.items.length > 0)
  const flatItems = groups.flatMap((g) => g.items)
  /* LO PENDIENTE, EN EL BOTÓN «MENÚ» (11-11-2026, portal_inicio-3). En el móvil no hay menú lateral: los números
     rojos de días sin contestar, candidatos nuevos y WhatsApp solo se veían abriendo la hoja, y Dani lo sigue casi
     todo desde el móvil. Se suman y van en el botón de abajo y en el de la cabecera. El chat interno no: ya pinta
     sus no leídos en la cabecera (EquipoEnLinea), y contarlo dos veces haría pensar que hay más. Solo cuenta lo
     que esta persona ve en su menú (cada aviso cuelga de una entrada ya filtrada por permiso). */
  const avisosMenu = flatItems.reduce((n, it) => n + (it.to === '/panel/chat' ? 0 : (it.aviso || 0)), 0)

  // Guard de ruta: impide acceder por URL a un módulo no permitido.
  const curKey = keyOf(loc.pathname.replace(/\/+$/, '') || '/panel')
  const routeAllowed = (k) => {
    // Pantallas propias del usuario, sin permiso que valga.
    if (k === 'perfil' || k === 'login' || k === 'portal-conductor') return true
    if (k === 'centro-ia') return esPlataforma()
    if (!moduloOk(k)) return false
    // Y las de la operación diaria, de la MISMA lista que usa el menú: si el
    // menú la enseña, la ruta abre; si el menú la esconde, la ruta no abre.
    if (SIEMPRE_VISIBLES.has(k)) return true
    if (k === 'vencimientos') return EXPIRY_KEYS.some((ek) => canSee(ek))
    if (k === 'ordenes') return canSee('talleres')
    if (k === 'estado-flota') return canSee('vehiculos')
    if (k === 'admin' || k === 'bandeja' || k === 'analitica' || k === 'gastos') return sa
    if (k === 'tienda' && (!esPlataforma() || sinPagos())) return false
    if (k === 'usuarios') return sa || cm
    return canSee(k)
  }
  if (!routeAllowed(curKey)) {
    return <Navigate to={flatItems[0] ? flatItems[0].to : '/panel/perfil'} replace />
  }

  // Las pantallas del dueño del producto (negocio, planes y cobros, analítica, gastos) no existen en la app de iPhone (09-11-2026).
  const showAdmin = sa && !sinPagos()
  /* Las entradas del dueño y la de Usuarios, en UNA lista para el lateral y para la hoja del móvil (11-11-2026,
     portal_inicio-11): el móvil pintaba su propia copia, solo con Negocio y Usuarios, y Gastos y Bandeja no
     llegaban (desde el móvil solo con Buscar). Así no vuelven a separarse. */
  const extrasMenu = [
    showAdmin && { to: '/panel/admin', label: t('nav.business'), icon: Shield },
    (showAdmin || cm) && { to: '/panel/usuarios', label: t('nav.users'), icon: Users },
    showAdmin && { to: '/panel/analitica', label: 'Cómo va el negocio', icon: Activity },
    showAdmin && { to: '/panel/gastos', label: 'Gastos', icon: Euro },
    showAdmin && { to: '/panel/bandeja', label: t('nav.inbox'), icon: Inbox },
  ].filter(Boolean)

  /* LA BARRA DE ABAJO DEL MÓVIL, con la MISMA regla que el menú (11-11-2026, portal_inicio-8). Solo miraba el
     módulo de la empresa, no el permiso de cada persona: a quien no tenía «Revisión» o «Vehículos» (ni el Inicio)
     le salía el botón y, al tocarlo, el guardián lo devolvía a otra pantalla sin decir nada. Si quedan menos de
     cuatro, se rellena con las primeras pantallas que sí puede abrir, en el orden del menú. */
  /* «Repaso» en el segundo sitio (14-11-2026, M4) solo para quien NO tiene «Revisión rápida» (las empresas nuevas): la
     flota que ya trabaja con la Revisión rápida conserva su barra exactamente como estaba. */
  const conRevision = itemVisible({ to: '/panel/revision' })
  const barraAbajo = [
    { to: '/panel', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    conRevision
      ? { to: '/panel/revision', label: t('nav.revision'), icon: CheckCircle2 }
      : { to: '/panel/repaso', label: t('nav.repaso'), icon: Columns2 },
    { to: '/panel/asignacion', label: t('nav.assign'), icon: ClipboardCheck },
    { to: '/panel/vehiculos', label: t('nav.vehicles'), icon: Truck },
  ].filter((it) => itemVisible(it))
  for (const it of flatItems) {
    if (barraAbajo.length >= 4) break
    if (!barraAbajo.some((b) => b.to === it.to)) barraAbajo.push({ to: it.to, label: it.label, icon: it.icon, end: it.end })
  }
  const sinBurbuja = /^\/panel\/(repaso|arranque)(\/|$)/.test(loc.pathname) || /^\/panel\/vehiculos\/[^/]+\/expediente/.test(loc.pathname)
  const globoMenu = avisosMenu > 0 ? (
    <span aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
      {avisosMenu > 99 ? '99+' : avisosMenu}
    </span>
  ) : null
  const nombreMenu = avisosMenu > 0 ? `${t('nav.menu')} · ${avisosMenu}` : t('nav.menu')

  function doLogout() {
    logout()
    nav('/panel/login', { replace: true })
  }

  // Paleta ⌘K: menú + rutas fusionadas (ITV/Renting/Alquiler directas) + admin
  const paletteBase = [
    ...flatItems,
    ...PALETTE_EXTRA.filter((p) => canSee(p.key) && moduloOk(p.key)).map((p) => ({ ...p, label: t(p.labelKey) })),
  ]
  const palettePages = showAdmin
    ? [...paletteBase, { to: '/panel/admin', label: t('nav.business'), icon: Shield },
       { to: '/panel/analitica', label: 'Cómo va el negocio', icon: Activity },
       { to: '/panel/gastos', label: 'Gastos', icon: Euro },
       { to: '/panel/bandeja', label: t('nav.inbox'), icon: Inbox }]
    : paletteBase

  const impersonating = !!localStorage.getItem('flota_token_super')
  function backToSuper() {
    const superTok = localStorage.getItem('flota_token_super')
    if (superTok) {
      localStorage.setItem('flota_token', superTok)
      localStorage.removeItem('flota_token_super')
      localStorage.removeItem('flota_admin')
    }
    window.location.href = '/panel/admin'
  }

  return (
    <div className="atmosphere flex min-h-screen text-dark-50">
      {/* Sidebar — raíl flotante de vidrio */}
      <aside className="hidden w-[248px] shrink-0 flex-col p-3 pr-0 md:flex">
      <div className="rail flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          {/* El monograma FD de la marca, en vez del rayo genérico. */}
          <img
            src="/favicon.svg" alt="" width="28" height="28"
            className="h-7 w-7 shrink-0 rounded-lg object-cover"
          />
          <b className="font-display text-[15px] font-semibold tracking-tight">{MARCA.nombre}</b>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
          {groups.map((g) => {
            const fijo = g.key === GRUPO_FIJO
            const isClosed = !fijo && grupoAbierto !== g.key
            // El grupo de la pantalla abierta, en tinta (icono y nombre), también plegado: así se sabe dónde estás
            // sin un punto de color. Los demás, en gris.
            const deAqui = g.items.some((it) =>
              it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to))
            return (
              <div key={g.key} className="pt-1.5 first:pt-0">
                <button onClick={() => toggleGroup(g.key)} className="nav-ghead group" aria-expanded={!isClosed}>
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center">
                    <g.gIcon size={15} className={deAqui ? 'text-dark-100' : 'text-dark-500 transition-colors group-hover:text-dark-300'} />
                  </span>
                  <span className={`text-[13px] font-semibold tracking-tight transition-colors ${deAqui ? 'text-dark-50'
                    : isClosed ? 'text-dark-400 group-hover:text-dark-200' : 'text-dark-200'}`}>
                    {g.g}
                  </span>
                  {!fijo && (
                    <ChevronDown
                      size={14}
                      className={`ml-auto shrink-0 text-dark-500 transition-transform duration-300 group-hover:text-dark-300 ${isClosed ? '-rotate-90' : ''}`}
                      style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1.15, 0.32, 1)' }}
                    />
                  )}
                </button>
                {/* Plegado con física vía max-height (grid-template-rows no
                    anima en todos los Chromium): nada aparece de golpe */}
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-300"
                  style={{
                    maxHeight: isClosed ? 0 : g.items.length * 40 + 12,
                    opacity: isClosed ? 0 : 1,
                    transitionTimingFunction: 'cubic-bezier(0.22, 1.15, 0.32, 1)',
                  }}
                >
                  {/* Línea guía: los ítems cuelgan del grupo, como un árbol */}
                  <div className="ml-[14px] space-y-0.5 border-l border-white/[0.06] pb-1 pl-2.5">
                    {g.items.map((it) => (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        end={it.end}
                        className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
                      >
                        <it.icon size={16} />
                        {it.label}
                        {/* En rojo y no en ambar a proposito: esto es trabajo
                            parado esperando una respuesta, no un aviso de que
                            algo va justo. `ml-auto` lo manda al borde derecho
                            para que la columna de numeros se lea de un vistazo
                            sin tener que buscarlos entre los nombres.
                            Y red-600, no red-500: el checker de contraste midio
                            el blanco sobre red-500 en 3,76:1, por debajo del 4,5
                            de la WCAG, y a 11 px eso se lee mal de verdad. */}
                        {it.aviso > 0 && (
                          <span className="ml-auto min-w-[20px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white"
                            title={it.avisoTitulo ? it.avisoTitulo.replace('{n}', it.aviso)
                              : `${it.aviso} ${it.aviso === 1 ? 'petición sin contestar' : 'peticiones sin contestar'}`}>
                            {it.aviso > 99 ? '99+' : it.aviso}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
          {extrasMenu.map((it, i) => (
            <NavLink key={it.to} to={it.to}
              className={({ isActive }) => `nav-item ${i === 0 ? 'mt-1' : ''} ${isActive ? 'nav-item-active' : ''}`}>
              <it.icon size={16} /> {it.label}
            </NavLink>
          ))}
        </nav>

        {/* «Portal Conductor», una línea más del menú, al pie (14-11-2026). Antes iba en una caja cian y encima una
            tarjeta dorada «Acceso Fundador» que no hacía nada: dos manchas de color sin nada que decir. */}
        <div className="border-t border-dark-800 px-3 py-2">
          <NavLink to="/panel/portal-conductor"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
            <Shield size={16} /> {t('nav.portal')}
          </NavLink>
        </div>
      </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {impersonating && (
          <div className="flex items-center justify-between gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
            <span>{t('nav.impersonate')} <b>{admin?.name}</b> ({t('nav.client')}).</span>
            <button onClick={backToSuper} className="rounded-md bg-amber-500/30 px-3 py-1 text-xs font-semibold hover:bg-amber-500/40">{t('nav.back.super')}</button>
          </div>
        )}
        {decodeToken()?.demo && (
          <div className="flex items-center justify-between gap-2 bg-purple-500/15 px-4 py-2 text-sm text-purple-200">
            <span>▶ {decodeToken()?.db_name === 'dsp_demo_reparto' ? t('demo.banner.reparto') : t('demo.banner')}</span>
            {haySesionPrevia()
              ? <button onClick={() => { volverASesionPrevia(); window.location.href = '/panel' }}
                  className="rounded-md bg-purple-500/30 px-3 py-1 text-xs font-semibold hover:bg-purple-500/40">Volver a mi cuenta</button>
              : <a href="/registro" className="rounded-md bg-purple-500/30 px-3 py-1 text-xs font-semibold hover:bg-purple-500/40">{t('demo.banner.cta')}</a>}
          </div>
        )}
        {/* HAY UNA VERSIÓN NUEVA DE LA APP.
            El 16-09-2026 Dani dijo «Eddy no me aparece para enviarle la
            formación». Eddy estaba bien en los datos: su pestaña llevaba horas
            abierta con la compilación anterior. La app no fallaba — enseñaba lo
            de antes, que es peor, porque lleva a desconfiar de los datos cuando
            el problema es la pestaña. */}
        {hayVersionNueva && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 py-2.5">
            <span className="text-[13px] text-brand-200">
              Hay una versión nueva de la aplicación. Lo que ves puede estar desactualizado.
            </span>
            <button onClick={() => window.location.reload()}
              className="ml-auto rounded-lg bg-brand-400 px-3 py-1.5 text-[12.5px] font-semibold text-brand-tinta hover:brightness-110">
              Recargar
            </button>
          </div>
        )}
        <TrialBanner />
        {/* MEDIDA A 375 px EL 02-09-2026: esta cabecera medía 479 y no tenía
            scroll, asi que los 104 px que sobraban se quedaban FUERA de la
            pantalla — y ahi vivia el avatar, con «Perfil» y «Cerrar sesion»
            dentro. En un movil no habia forma de llegar a ellos.
            Reparto nuevo: el boton de menu y el avatar no se mueven nunca
            (`flex-none`), el selector de centro se queda con lo que sobra y
            hace scroll el solo (`min-w-0`), y buscar/ayuda/tema se van al menu,
            que es donde se busca lo que se usa poco. */}
        {/* `relative z-30` NO es decoracion: sin el, el desplegable del avatar se
            pintaba DEBAJO del contenido de la pagina y no se podia pulsar.
            El motivo es de CSS puro y no se ve leyendo el JSX: `backdrop-blur`
            convierte la cabecera en un contexto de apilado propio, asi que el
            `z-50` de dentro solo compite con sus hermanos DE DENTRO; fuera, la
            cabecera valia `auto` y `main`, que va despues en el DOM, ganaba.
            Medido en un movil el 02-09-2026 con `elementFromPoint` sobre el
            boton «Salir»: devolvia el titular de la pagina, no el boton. Se
            veian las dos cosas superpuestas y no habia forma de cerrar sesion. */}
        <header className="relative z-30 flex items-center gap-2 border-b border-white/[0.05] bg-transparent px-3 py-2.5 backdrop-blur-md md:gap-3 md:px-4">
          {/* La puerta del menu tambien arriba: en iOS la barra de abajo se
              queda debajo del navegador y no siempre se ve. */}
          {/* Se ve de 36 px (la cabecera no crece), pero se toca en 44: el `before` invisible sale 5 px por cada lado
              del borde de dentro (34 px + 10) (11-11-2026; con el número rojo invita más a tocarlo). */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={nombreMenu}
            className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-dark-700 bg-dark-800/70 text-dark-300 before:absolute before:-inset-[5px] active:bg-dark-800 md:hidden">
            <Menu size={18} />
            {globoMenu}
          </button>

          <div className="hidden text-sm text-dark-400 md:block">
            {flatItems.find((it) => (it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to)))?.label || ''}
          </div>

          {/* Paleta de comandos (Ctrl+K) */}
          <button
            onClick={() => setCmdOpen(true)}
            className="ml-auto hidden items-center gap-2 rounded-lg border border-dark-700 bg-dark-800/70 px-3 py-1.5 text-xs text-dark-400 transition-colors hover:border-dark-600 hover:text-dark-200 md:flex"
            title="Ctrl+K"
          >
            <Search size={13} />
            <span className="hidden sm:inline">{t('cmdk.hint')}…</span>
            <kbd className="kbd hidden sm:inline-flex">Ctrl K</kbd>
          </button>

          <span className="hidden md:inline-flex"><BotonAyuda abrir={() => setAyudaOpen(true)} /></span>

          {/* Tema: híbrido → noche → día → híbrido.
              Tres estados en un botón necesitan que el título diga a dónde
              vas, no dónde estás: si no, hay que pulsar para averiguarlo. */}
          <button
            onClick={() => {
              // A partir de aqui la eleccion es SUYA y se respeta siempre.
              try { localStorage.setItem('panel_theme_elegido', '1') } catch { /* incognito */ }
              setTheme((th) => (th === 'hibrido' ? 'dark' : th === 'dark' ? 'light' : 'hibrido'))
            }}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-dark-700 bg-dark-800/70 px-2 py-1.5 text-dark-400 transition-colors hover:border-dark-600 hover:text-dark-200"
            title={theme === 'hibrido' ? 'Cambiar a modo noche'
              : theme === 'dark' ? 'Cambiar a modo día' : 'Volver al modo mixto'}
          >
            {theme === 'dark' ? <Moon size={14} />
              : theme === 'light' ? <Sun size={14} /> : <Contrast size={14} />}
            <span className="hidden text-[11px] font-medium lg:inline">
              {theme === 'hibrido' ? 'Mixto' : theme === 'dark' ? 'Noche' : 'Día'}
            </span>
          </button>

          {/* Filtro de CENTRO — si solo tiene 1 centro asignado se muestra fijo */}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg bg-dark-800/60 p-1 md:flex-none">
            {/* La sede elegida, en tinta sobre un relleno neutro y con la letra de la casa (14-11-2026, M5): el cian
                queda para la pantalla activa del menú. */}
            {singleCenter ? (
              <span className="rounded-md bg-dark-700 px-3 py-1 text-[12.5px] font-semibold tracking-normal text-dark-50">
                {singleCenter}
              </span>
            ) : (
              ['Todos', ...centers].map((c) => (
                <button
                  key={c}
                  onClick={() => setCenter(c)}
                  className={`rounded-md px-3 py-1 text-[12.5px] font-semibold tracking-normal transition-colors ${
                    center === c ? 'bg-dark-700 text-dark-50' : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {c === 'Todos' ? t('nav.all') : c}
                </button>
              ))
            )}
          </div>

          {flatItems.some((it) => it.to === '/panel/chat') && <EquipoEnLinea onSinLeer={setChatSinLeer} />}

          <span className="flex-none">
          <MenuUsuario admin={admin} showAdmin={showAdmin} lang={lang} setLang={setLang}
            langs={LANGS} onLogout={doLogout} t={t} />
          </span>
        </header>

        {/* En el móvil la navegación va en la barra de abajo y en el botón
            «Menú». Aquí había una fila horizontal con las 40 pantallas en
            pastillas: para llegar a una había que barrer a ciegas, y era lo
            que más se usaba en el móvil (02-09-2026). */}

        {/* El hueco de abajo deja sitio a la burbuja de la IA (11-11-2026, vista en las fotos tapando «Editar» y la
            última columna de las tablas): en el móvil, la barra de abajo (52 px) más la burbuja encima (48 px y su
            margen); en el ordenador, la burbuja (48 px a 16 px del borde). Se puede bajar hasta que nada quede debajo. */}
        {/* El Chat y el Centro de IA no: su altura va calculada contra la ventana y con el hueco nuevo dejaban de caber
            (salía una barra y la página entera subía comiéndose la cabecera). Ellos, con el de siempre. */}
        <main key={loc.pathname} className={`animate-fade-in solo-opacidad flex-1 overflow-y-auto p-4 md:p-5 ${
          curKey === 'chat' || curKey === 'centro-ia' ? 'pb-24 md:pb-5' : 'pb-36 md:pb-20'}`}>
          {/* `ve`: la regla del menú, para que el Inicio solo enseñe casillas de pantallas que este usuario puede abrir. */}
          <Outlet context={{ center, centers, admin, setCenter, ve: (to) => itemVisible({ to }), setAvisoRepaso: setRepasoPend }} />
        </main>
      </div>

      {/* Barra de navegación inferior — solo móvil (sensación de app nativa) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-dark-800 bg-dark-900/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Cuatro destinos + el menú. El sitio que ocupaba «Chat interno» se
            lo lleva el menú: el chat tenía 8 mensajes desde el 16 de julio
            (medido), y desde aquí no se llegaba a ninguna otra pantalla sin
            barrer la tira de pastillas. */}
        {barraAbajo.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) =>
              `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-brand-400' : 'text-dark-400'
              }`}>
            <it.icon size={19} />
            <span className="max-w-full truncate px-1">{it.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setMenuOpen(true)} aria-label={nombreMenu}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
            menuOpen ? 'text-brand-400' : 'text-dark-400'}`}>
          <span className="relative"><Menu size={19} />{globoMenu}</span>
          <span className="max-w-full truncate px-1">{t('nav.menu')}</span>
        </button>
      </nav>

      <MenuMovil abierto={menuOpen} cerrar={() => setMenuOpen(false)}
        groups={groups} extras={extrasMenu} t={t}
        acciones={[
          { clave: 'buscar', icono: Search, texto: t('cmdk.hint'), hacer: () => setCmdOpen(true) },
          { clave: 'ayuda', icono: CircleHelp, texto: t('nav.help'), hacer: () => setAyudaOpen(true) },
          {
            clave: 'tema',
            icono: theme === 'dark' ? Moon : theme === 'light' ? Sun : Contrast,
            texto: theme === 'hibrido' ? 'Mixto' : theme === 'dark' ? 'Noche' : theme === 'auto' ? 'Automático' : 'Día',
            hacer: () => {
              try { localStorage.setItem('panel_theme_elegido', '1') } catch { /* incognito */ }
              setTheme((th) => (th === 'hibrido' ? 'dark' : th === 'dark' ? 'light' : 'hibrido'))
            },
          },
        ]} />

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} pages={palettePages} />
      <PanelAyuda
        abierto={ayudaOpen} cerrar={() => setAyudaOpen(false)}
        titulo={t(NAV_DEF.flatMap((g) => g.items)
          .find((it) => keyOf(it.to) === keyOf(loc.pathname))?.labelKey || 'nav.dashboard')} />
      {/* Los primeros pasos se filtran con el MISMO `itemVisible` que el menu:
          asi nadie ve un paso que luego no puede abrir, que es la forma mas
          rapida de que la bienvenida parezca rota. */}
      <PrimerosPasos
        puedeVer={(k) => itemVisible({ to: k === 'dashboard' ? '/panel' : `/panel/${k}` })}
        idUsuario={admin?.id || admin?.sub} />
      <LiveNotifier center={center} centers={centers} ve={(k) => moduloOk(k) && (SIEMPRE_VISIBLES.has(k) || canSee(k))}
        sobreEscribir={curKey === 'chat'} />
      {/* En el Centro de IA la burbuja sobra (y en el móvil tapaba el botón de enviar). */}
      {/* Con la hoja del menú abierta, la burbuja se esconde (sin desmontarla: no se pierde la conversación): iba por
          encima y tapaba el número rojo de Días libres (foto del 10-11-2026). `setCenter`: para elegir el centro
          ahí mismo con «Todos». En el Chat, en el móvil, tapaba el botón de enviar (foto del 11-11-2026): allí va más
          arriba, por encima de la caja de escribir (sigue a mano, como siempre). */}
      {/* Una cuenta sin la IA (`ia: false` en /org/billing, CONTRATO R10) no tiene asistente: ni se monta. Se espera a
          saberlo, para no enseñarla un instante y quitarla. */}
      {/* Ni en el Repaso, el arranque o el expediente (14-11-2026, M3): ahí manda la foto y su botón, y la burbuja
          tapaba las dos cosas. Con una ventana abierta se esconde sola (`.burbuja-asistente` en index.css). */}
      {curKey !== 'centro-ia' && !!billing && billing.ia !== false && <AsistenteBurbuja center={center} centers={centers} setCenter={setCenter}
        escondida={menuOpen || sinBurbuja} sobreEscribir={curKey === 'chat'} />}
    </div>
  )
}
