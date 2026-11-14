/* diseño compacto */
import { useEffect, useState } from 'react'
import { ClipboardCheck, CalendarDays, CalendarClock, CalendarPlus, LogOut, Lock, Mail, Ban, ShoppingBag, RefreshCw, Route, Gift, ArrowLeft, Store, ChevronRight, Check } from 'lucide-react'
import { getPortalVehicles, getMyShifts, getMiFicha, guardarMiTelefono, tiendaEscaparate, repMiRuta, mercEstado, getTrabajarMas, getAssignedVehicle, DRIVER_TOKEN_KEY, sesionDelEnlace } from '../../services/api'
import { tx } from '../../lib/idioma'
import { lista } from '../../lib/lista'
import { medirSeccion } from '../../lib/analitica'
import { vigilarVersion } from '../../lib/versionApp'
import { quitarFondoDeArranque } from '../../lib/tema'
import DriverLogin from './DriverLogin'
import InspectionFlow from './InspectionFlow'
import InspectionDone from './InspectionDone'
import MisTurnos from './MisTurnos'
import MiClave from './MiClave'
import MiCorreoPersonal from './MiCorreoPersonal'
import { LineaEnlace } from './conEnlace'
import PedirDias from './PedirDias'
import TrabajarMas from './TrabajarMas'
import Tienda from './Tienda'
import MiRuta from './MiRuta'
import MisDnr from './MisDnr'
import { useCasillaDnr, IconoDnr, olvidarDnr } from './dnrVistas'
import { Boton, Aviso, Etiqueta } from './piezas'
import DriverReferralWallet from './DriverReferralWallet'
import Mercadillo from '../mercadillo/Mercadillo'
import { refCentActual } from '../../lib/precios'
import { sinPagos } from '../../lib/plataforma'

// «lunes 20/10»: las fechas de la suspensión, cortas y en hora local.
const fechaCorta = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return isNaN(d) ? f : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' }).replace(',', '')
}

const DRIVER_KEY = 'flota_driver'

/* ────────────────────────────────────────────────────────────────────────────
   PORTAL DEL CONDUCTOR
   ---------------------------------------------------------------------------
   Antes esto no existía: al entrar caías directamente en la auditoría, y para
   ver el cuadrante había un botón escondido dentro. Pedir días no se podía
   hacer desde ningún sitio, así que se pedía hablando — y de ahí venían los
   "a mí me dijeron que sí" que nadie podía comprobar.

   La auditoría sigue siendo lo primero y lo más gordo, porque es lo que se
   hace todos los días antes de salir. Lo demás está debajo, a un toque.
   ──────────────────────────────────────────────────────────────────────────── */

/* Las opciones grandes del inicio («Mi ruta», «Hacer la auditoría»), como filas de 64 (diseño compacto, 07-11-2026,
   §5.11): icono de 24, el título en «nombre» y una línea en «sec»; la principal, con relleno de marca; sin degradado
   ni sombra. Lo que avisa (respuestas sin leer, la insignia, «Pronto») va a la derecha, no encima del texto. Apagada
   (bloqueada o «Pronto»), en gris y sin bajar la opacidad: el texto se sigue leyendo al sol. */
function Opcion({ icono: Icono, titulo, sub, onClick, principal, bloqueado, pronto, aviso, insignia }) {
  const off = bloqueado || pronto
  const fondo = off ? 'cursor-not-allowed bg-dark-900 text-dark-400' : principal ? 'bg-brand-500 text-brand-tinta active:opacity-80' : 'bg-dark-900 text-dark-50 active:opacity-80'
  return (
    <button type="button" onClick={off ? undefined : onClick} disabled={off}
      className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${fondo}`}>
      <Icono size={24} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-nombre">{titulo}</span>
        {sub && <span className={`block text-sec ${principal && !off ? 'text-brand-tinta/80' : 'text-dark-400'}`}>{sub}</span>}
      </span>
      {/* Una etiqueta corta para lo que hay que mirar hoy. No es un adorno permanente: se quita en cuanto deja de ser
          noticia, o se convierte en el aviso de siempre que nadie lee. `!(aviso > 0)` y no `aviso <= 0`: `aviso` llega
          sin definir en casi todas las entradas, y `undefined <= 0` es false. */}
      {insignia && !off && !(aviso > 0) && <Etiqueta texto={insignia} tono="aviso" />}
      {/* «Pronto» en vez de esconderlo: si la opción no está, la gente pregunta si existe; si está y dice cuándo, no
          pregunta nadie. */}
      {pronto && <span className="shrink-0 text-pie text-dark-400">Pronto</span>}
      {/* Respuestas sin leer. El aviso al móvil puede no llegar nunca (avisos desactivados, iOS, el móvil apagado), así
          que la señal que de verdad se ve es esta, dentro de la app. */}
      {aviso > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ruta-peligro px-1 text-etiqueta text-white">{aviso}</span>
      )}
    </button>
  )
}

/* LO DEMÁS, EN CASILLAS DE TRES (17-10-2026). Dani: «más que recuadros hacia abajo, en la primera fila 3
   cuadros y en la segunda otros 3, para que se vea más moderno». La auditoría (y «Mi ruta») siguen a lo
   ancho y arriba: es lo de todos los días. El resto es secundario y cabe en una pantalla sin bajar.
   Desde el diseño compacto (07-11-2026, §5.11): 96 de alto mínimo, icono de 20 sin caja, el título en «boton» (dos
   líneas; tres si una palabra larga, «recuperación», se parte antes que salirse: a 360 px no cabe entera en dos, y
   cortarla con «…» dejaba «recupera-…») y sin el detalle a la vista: sigue ahí como texto solo para el lector de
   pantalla («Título . Detalle»: lo que lee el lector y lo que buscan por texto las pruebas de cambiar-clave y del
   mercadillo). «Pronto», en «pie» bajo el título; las respuestas sin leer, en su número arriba a la derecha (el
   detalle ya las dice, así que el número no se lee dos veces). Sin degradado ni sombra; el tono (verde, ámbar) queda en
   el icono. */
// `linea` (opcional, 11-11-2026, «Mis DNR»): una segunda línea en «sec» gris FUERA del recorte del título, con el suyo
// (tres líneas, para la «Letra más grande»): dentro, en alemán y en francés se cortaba justo la palabra que importa.
function Casilla({ icono: Icono, titulo, linea, detalle, onClick, pronto, aviso, tono }) {
  const color = pronto ? 'text-dark-400' : { verde: 'text-ruta-ok-texto', ambar: 'text-ruta-aviso-texto' }[tono] || 'text-dark-400'
  return (
    <button type="button" onClick={pronto ? undefined : onClick} disabled={pronto}
      className={`relative flex min-h-24 flex-col justify-between rounded-xl bg-dark-900 p-3 text-left ${pronto ? 'cursor-not-allowed' : 'active:opacity-80'}`}>
      {aviso > 0 && (
        <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ruta-peligro px-1 text-etiqueta text-white">
          {aviso}
        </span>
      )}
      <Icono size={20} className={`shrink-0 ${color}`} aria-hidden="true" />
      <span className="mt-2 block">
        <span className={`line-clamp-3 break-words text-boton hyphens-auto ${pronto ? 'text-dark-400' : 'text-dark-50'}`}>{titulo}</span>
        {linea && <span className="line-clamp-3 break-words text-sec text-dark-400">{linea}</span>}
        {pronto && <span className="block text-pie text-dark-400">Pronto</span>}
        {detalle && <span className="sr-only">. {detalle}</span>}
      </span>
    </button>
  )
}

/* «Comparte y gana», en su pantalla: en el inicio era una tarjeta enorme encima de la auditoría (Dani,
   17-10-2026: «para que no sea muy cargante»). Ahora es una casilla más y aquí está todo: enlace, saldo y cobro. */
function PantallaCartera({ onBack }) {
  return (
    <div className="min-h-[100dvh] bg-dark-950 px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md">
        <Boton variante="texto" tono="marca" icono={ArrowLeft} texto="Volver" onClick={onBack} className="-ml-2 mb-4" />
        <DriverReferralWallet />
      </div>
    </div>
  )
}

export default function DriverPortal() {
  const [driver, setDriver] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DRIVER_KEY)) || null
    } catch {
      return null
    }
  })
  const [portal, setPortal] = useState(null)   // {vehicles, puede_auditar, motivo}
  const [result, setResult] = useState(null)
  const [sinVer, setSinVer] = useState(0)      // respuestas que aún no ha leído
  // ¿Tiene turnos cargados? (17-10-2026: OGA5 tiene el cuadrante hasta diciembre; DGA1, todavía no.)
  const [tieneTurnos, setTieneTurnos] = useState(false)
  // El mercadillo: la casilla sale solo si está abierto (lo decide el servidor), con los mensajes sin leer.
  const [merc, setMerc] = useState(null)
  // Trabajar más (24-10-2026): vacantes en días que libra (días bajo la máxima o refuerzos de la oficina) y sus
  // días extra ya confirmados. Con vacantes sale una tarjeta grande arriba; sin ellas, una casilla.
  const [extra, setExtra] = useState(null)
  // Suspensión en curso o por venir (solo las fechas: el motivo es de la oficina).
  const [susp, setSusp] = useState(null)
  // null = apagada o todavía sin contestar. Con datos: {desde, n} para poder
  // poner el precio en la entrada del menú, que es lo que hace que se entre.
  const [tienda, setTienda] = useState(null)
  /* LA FURGONETA DE HOY BAJO «HACER LA AUDITORÍA» (11-11-2026, tanda 2, E3 / portal_inicio-7). Decía siempre «Antes de
     salir a ruta»: ni qué furgoneta le toca ni si ya la había mandado. El servidor ya lo sabe (/auth/me/assigned-vehicle,
     con la asignación del día y `already_inspected`). null = sin asignación (o sin respuesta): el texto de siempre.
     Lo de «hoy no sales» y «suspendido» ya estaba y manda sobre esto. */
  const [hoyFurgo, setHoyFurgo] = useState(null)   // { matricula, enviada }

  /* LA TIENDA NO SE VE HASTA QUE SE ENCIENDE, y la decision es del servidor.
     Se pregunta al escaparate: si contesta `visible: false` no se pinta ni la
     entrada del menu. Asi el dia que la oficina la abre, aparece sola en el
     movil de todos sin desplegar nada; y mientras tanto no hay ninguna puerta
     que alguien pueda encontrar por su cuenta. Un `if` en el cliente seria
     una cortina: la ruta seguiria ahi. */
  useEffect(() => {
    // SIN SESIÓN NO SE PREGUNTA. Esta pantalla también se monta cuando no hay
    // token —es la que enseña el formulario de entrada—, y una llamada con
    // sesión obligatoria desde ahí solo puede devolver 401. Fue la que destapó
    // el bucle de recargas del 07-09-2026.
    if (!localStorage.getItem(DRIVER_TOKEN_KEY)) return undefined
    // En la app de iPhone (09-11-2026) no se vende nada, tampoco la ropa del equipo: no se pregunta por el escaparate.
    if (sinPagos()) return undefined
    let vivo = true
    tiendaEscaparate()
      .then((r) => {
        if (!vivo) return
        const ps = (r.data?.prendas || []).map((p) => p.precio).filter((x) => x > 0)
        setTienda(r.data?.visible ? { desde: ps.length ? Math.min(...ps) : null, n: ps.length } : null)
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [driver])

  // ?vista=ruta abre directamente «Mi ruta» (la demo y el enlace del autónomo).
  // ?vista=mercadillo: el enlace del correo de «tienes un mensaje» (17-10-2026).
  const [vista, setVista] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    return v === 'ruta' || v === 'mercadillo' || v === 'extra' || v === 'dnr' ? v : 'inicio'
  })
  useEffect(() => {
    if (driver?.configurar_cuenta) setVista('clave')
  }, [driver])
  // «Mi ruta» solo sale en empresas que reparten así; lo decide el servidor.
  const [reparto, setReparto] = useState(null)
  useEffect(() => {
    if (!driver || vista !== 'inicio') return
    repMiRuta().then((r) => setReparto(r.data?.activo
      ? lista(r.data.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).length : null))
      .catch(() => setReparto(null))
  }, [driver, vista])
  const [faltaTel, setFaltaTel] = useState(false)
  const [tieneClave, setTieneClave] = useState(true)
  const [tel, setTel] = useState('')
  const [telOk, setTelOk] = useState(false)
  const [guardandoTel, setGuardandoTel] = useState(false)
  const [errTel, setErrTel] = useState('')
  const [hayVersionNueva, setHayVersionNueva] = useState(false)

  /* AVISO DE VERSION NUEVA, PERO SIN RECARGAR SOLA. En el panel la pestaña se
     actualiza sola cuando se queda en segundo plano; aqui NO, y es a proposito:
     el conductor sube seis fotos y se cambia a WhatsApp mientras suben. Una
     recarga ahi le corta la subida y pierde la inspeccion, que es peor que
     enseñarle una version de ayer. */
  useEffect(() => {
    const dejar = vigilarVersion(() => setHayVersionNueva(true))
    return dejar
  }, [])

  /* CUENTA SUS PANTALLAS EL, que son ocho dentro de una sola URL. Midiendolo
     por cambio de ruta solo se veia la de entrada, antes de que nadie entrara:
     todas las visitas salian «sin cuenta» y «se van aqui», y no habia forma de
     saber hasta donde llegan. */
  // Dentro ya del portal, fuera el papel de la puerta (public/fondo-arranque.js): el portal va con el tema de la app.
  useEffect(() => { if (driver) quitarFondoDeArranque() }, [driver])
  const seccion = !driver ? 'entrada' : (result ? 'hecho' : vista)
  useEffect(() => { medirSeccion('/conductor/p/' + seccion) }, [seccion])

  /* Si falla, no se pregunta: es mejor no pedir el telefono que ensenar un
     formulario roto a alguien que solo queria hacer su inspeccion. */
  useEffect(() => {
    if (!driver) return
    getMiFicha().then((r) => {
      setFaltaTel(!!r.data?.falta_telefono)
      // Distingue quien aún no tiene contraseña propia de quien ya la fijó.
      setTieneClave(r.data?.tiene_clave !== false)
      // La oficina puede reiniciar las claves mientras el conductor conserva
      // una sesión abierta. También en ese caso se exige el cambio antes de
      // dejarle seguir usando el portal.
      if (r.data?.configurar_cuenta && !driver.configurar_cuenta) {
        const actualizado = { ...driver, configurar_cuenta: true }
        localStorage.setItem(DRIVER_KEY, JSON.stringify(actualizado))
        setDriver(actualizado)
        setVista('clave')
      }
      // Y AL REVÉS (03-11-2026, José Arturo, OGA5: «no pueden pedir para trabajar mañana… les da problemas con la
      // contraseña»): la marca que guardó este móvil el día que entró con la temporal se quita en cuanto la ficha dice
      // que ya no hace falta. Si no, se quedaba en «Elige tu contraseña personal» sin la actual y el servidor se la
      // rechazaba una y otra vez.
      if (r.data?.configurar_cuenta === false && driver.configurar_cuenta) {
        const actualizado = { ...driver, configurar_cuenta: false }
        localStorage.setItem(DRIVER_KEY, JSON.stringify(actualizado))
        setDriver(actualizado)
        setVista((v) => (v === 'clave' ? 'inicio' : v))
      }
    }).catch(() => {})
  }, [driver])

  const guardarTel = async () => {
    setGuardandoTel(true); setErrTel('')
    try {
      await guardarMiTelefono(tel)
      setTelOk(true); setFaltaTel(false)
    } catch (e) {
      // Con la sesión del enlace no se cambia el teléfono que ya hay (14-11-2026): si ya lo tiene, no hay nada que pedirle.
      if (e?.response?.data?.codigo === 'enlace_sin_cambiar_telefono') { setFaltaTel(false); return }
      setErrTel(e?.response?.data?.detail || 'No se pudo guardar.')
    } finally { setGuardandoTel(false) }
  }

  useEffect(() => {
    if (!driver) return
    getPortalVehicles()
      .then((r) => {
        const d = r.data
        // La respuesta pasó de lista a objeto (hacía falta poder decir "hoy no
        // te toca" aparte de "no hay furgonetas"). Se aceptan las dos formas
        // por si queda algún cliente viejo abierto.
        setPortal(Array.isArray(d)
          ? { vehicles: d, puede_auditar: true, motivo: null }
          : { vehicles: lista(d?.vehicles), puede_auditar: d?.puede_auditar !== false, motivo: d?.motivo || null })
      })
      .catch(() => setPortal({ vehicles: [], puede_auditar: true, motivo: null }))
  }, [driver])

  // Cuántas respuestas tiene sin leer. Se recarga al volver al inicio para que
  // el aviso desaparezca en cuanto las lee, sin tener que refrescar la página.
  useEffect(() => {
    if (!driver || vista !== 'inicio') return
    getMyShifts()
      .then((r) => { setSinVer(lista(r.data?.sin_ver).length); setTieneTurnos(lista(r.data?.shifts).length > 0); setSusp(r.data?.suspension || null) })
      .catch(() => setSinVer(0))
    mercEstado().then((r) => setMerc(r.data?.visible ? r.data : null)).catch(() => setMerc(null))
    getTrabajarMas().then((r) => setExtra(r.data || null)).catch(() => setExtra(null))
    // Su furgoneta de hoy y si ya mandó la auditoría: se pide al volver al inicio, así que al terminar una sale ya
    // «Enviada hoy». Si falla o no tiene furgoneta asignada, se queda el texto de siempre.
    getAssignedVehicle()
      .then((r) => setHoyFurgo(r.data?.assigned && r.data?.vehicle
        ? { matricula: r.data.vehicle.license_plate || '', enviada: !!r.data.already_inspected } : null))
      .catch(() => setHoyFurgo(null))
  }, [driver, vista])
  // «Mis DNR» (11-11-2026): null si su empresa no tiene la DNR diaria; si no, con cuántas hay nuevas.
  const casillaDnr = useCasillaDnr(driver, vista)

  const login = (d) => {
    localStorage.setItem(DRIVER_KEY, JSON.stringify(d))
    setDriver(d)
    setVista(d.configurar_cuenta ? 'clave' : 'inicio')
  }
  const logout = () => {
    olvidarDnr()   // «Mis DNR»: lo que tenía en memoria no se le enseña a quien entre después (11-11-2026)
    // Salir de la demo devuelve la sesión real del conductor, si la había.
    try {
      const raw = esDemo && localStorage.getItem('flota_driver_previo')
      if (raw) {
        const { token, driver: d } = JSON.parse(raw)
        localStorage.removeItem('flota_driver_previo')
        if (token && d) {
          localStorage.setItem(DRIVER_TOKEN_KEY, token)
          localStorage.setItem(DRIVER_KEY, d)
          setDriver(JSON.parse(d)); setResult(null); setVista('inicio')
          return
        }
      }
    } catch { /* se sale del todo */ }
    localStorage.removeItem(DRIVER_KEY)
    localStorage.removeItem(DRIVER_TOKEN_KEY)
    setDriver(null)
    setResult(null)
    setVista('inicio')
  }

  if (!driver) return <DriverLogin onLogin={login} />
  if (vista === 'dias') return <PedirDias onBack={() => setVista('inicio')} />
  if (vista === 'extra') return <TrabajarMas onBack={() => setVista('inicio')} />
  if (vista === 'turnos') return <MisTurnos onBack={() => setVista('inicio')} />
  if (vista === 'dnr') return <MisDnr driverId={driver.id} onBack={() => setVista('inicio')} />
  if (vista === 'clave') return <MiClave obligatoria={!!driver.configurar_cuenta} onSalir={logout}
    onBack={() => {
      if (driver.configurar_cuenta) {
        const actualizado = { ...driver, configurar_cuenta: false }
        localStorage.setItem(DRIVER_KEY, JSON.stringify(actualizado))
        setDriver(actualizado)
        setVista('inicio')   // 02-11-2026: directo dentro; el correo de recuperación queda como casilla del inicio
      } else setVista('inicio')
    }} />
  if (vista === 'correo') return <MiCorreoPersonal onBack={() => setVista('inicio')} />
  if (vista === 'tienda') return <Tienda onBack={() => setVista('inicio')} />
  if (vista === 'cartera') return <PantallaCartera onBack={() => setVista('inicio')} />
  if (vista === 'mercadillo') return <Mercadillo onBack={() => setVista('inicio')} />
  // «Mi ruta» dentro de main.app-ruta (07-11-2026, diseño compacto): le llegan el tema, la zona de toque de 48 y «Letra más
  // grande», y va con la cabecera fija y el mapa a pantalla completa (pantallaCompleta).
  if (vista === 'ruta') return <main className="app-ruta min-h-[100dvh] bg-dark-950"><MiRuta onBack={() => setVista('inicio')} pantallaCompleta /></main>
  if (result) {
    return <InspectionDone result={result} onNew={() => { setResult(null); setVista('inicio') }} onLogout={logout} />
  }
  if (vista === 'auditoria') {
    return (
      <InspectionFlow driver={driver} vehicles={portal?.vehicles || []}
        onComplete={setResult} onLogout={logout} onShifts={() => setVista('turnos')}
        onBack={() => setVista('inicio')} />
    )
  }

  const noLeToca = portal && portal.puede_auditar === false
  /* EN LA DEMO DE REPARTO solo se puede escribir en el reparto (lo impone el
     servidor). Enseñar el teléfono, los días libres o la contraseña ahí era
     invitar a pulsar algo que contesta «modo demo: solo lectura». */
  const esDemo = (() => {
    try {
      const t = localStorage.getItem(DRIVER_TOKEN_KEY) || ''
      return !!JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).demo
    } catch { return false }
  })()
  const conEnlace = sesionDelEnlace()
  const extrasProximos = lista(extra?.extras).filter((x) => !x.pasado).length
  const extraPendiente = lista(extra?.vacantes).some((v) => v.mi_estado === 'pendiente')
  // «Sábado, 17 de octubre»: solo la primera en mayúscula (con `capitalize` salía «17 De Octubre»).
  const hoy = (() => { const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1) })()

  return (
    <div className="min-h-[100dvh] bg-dark-950 px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md">
        {/* La cabecera del inicio con los tokens (diseño compacto, 07-11-2026, §5.11): el saludo en «titulo», la fecha
            en «sec» y «Salir» como botón de icono de 48. */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-titulo text-dark-50">
              Hola, {String(driver?.name || '').split(' ')[0] || 'buenas'}
            </h1>
            <p className="text-sec text-dark-400">{hoy}</p>
          </div>
          <Boton variante="icono" icono={LogOut} tono="neutro" nombre="Salir" onClick={logout} />
        </header>

        {hayVersionNueva && (
          <button type="button" onClick={() => window.location.reload()}
            className="mb-3 flex min-h-12 w-full items-center gap-2 rounded-xl bg-ruta-marca-tinte px-3 py-2 text-left text-texto text-ruta-marca-tinte-texto">
            <RefreshCw size={18} className="shrink-0" aria-hidden="true" />
            <span>Hay una versión nueva. Toca aquí para actualizar.</span>
          </button>
        )}

        {/* ── EL TELÉFONO, PEDIDO A QUIEN LO SABE ──────────────────────────
            150 de los 212 conductores no tienen número en su ficha, así que no
            hay forma de llamar a alguien que se ha quedado tirado a mitad de
            ruta. Pedirlo desde la oficina lleva meses sin funcionar; aquí lo
            pide quien entra todos los días, una sola vez y en diez segundos.
            No bloquea nada: se puede seguir sin darlo. */}
        {faltaTel && !telOk && !esDemo && (
          <div className="mb-3 rounded-xl bg-dark-900 p-3">
            <p className="text-nombre text-dark-50">¿Cuál es tu teléfono?</p>
            <p className="mt-1 text-sec text-dark-400">
              Es para poder llamarte si te quedas tirado en ruta. Solo lo ve la oficina.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)}
                placeholder="600 000 000" aria-label="Teléfono"
                className="campo min-w-0 flex-1" />
              <Boton variante="normal" tono="marca" texto="Guardar" disabled={tel.trim().length < 9} cargando={guardandoTel} onClick={guardarTel} className="shrink-0" />
            </div>
            {errTel && <p className="mt-1 text-sec text-ruta-peligro-texto">{errTel}</p>}
          </div>
        )}
        {telOk && <Aviso tono="ok" icono={Check} texto="Guardado, gracias." className="mb-3" />}

        <div className="flex flex-col gap-2">
          {reparto !== null && (
            <Opcion
              icono={Route}
              titulo="Mi ruta"
              sub={reparto > 0 ? `${reparto} entrega${reparto > 1 ? 's' : ''} pendiente${reparto > 1 ? 's' : ''}` : 'Escanea los bultos al cargar'}
              principal
              onClick={() => setVista('ruta')}
            />
          )}
          <Opcion
            icono={ClipboardCheck}
            titulo="Hacer la auditoría"
            sub={portal?.motivo === 'suspendido' ? 'Hoy no trabajas' : noLeToca ? 'Hoy no sales a ruta'
              : hoyFurgo?.enviada ? (hoyFurgo.matricula ? tx('Enviada hoy · {matricula}', { matricula: hoyFurgo.matricula }) : tx('Enviada hoy'))
                : hoyFurgo?.matricula ? tx('Hoy: {matricula}', { matricula: hoyFurgo.matricula }) : 'Antes de salir a ruta'}
            /* Ya enviada hoy, en el tono de las demás y no en el de marca (11-11-2026, revisión de la tanda 2): turquesa y a
               todo lo ancho parecía que aún faltaba. Se puede seguir abriendo, por si hay que repetirla. */
            principal={!esDemo && !hoyFurgo?.enviada}
            bloqueado={noLeToca || esDemo}
            onClick={() => setVista('auditoria')}
          />
          {esDemo && (
            <p className="px-1 text-sec text-dark-400">
              En la prueba solo funciona el reparto. La auditoría (fotos del vehículo antes de salir) va en la cuenta real.
            </p>
          )}

          {/* Decirle POR QUÉ no puede. Un botón gris sin explicación acaba en
              una llamada a la oficina, que es lo que se quiere evitar. */}
          {susp && (
            <Aviso tono="peligro" icono={Ban} texto={<>
              {susp.desde === susp.hasta ? `El ${fechaCorta(susp.desde)} no trabajas` : `Del ${fechaCorta(susp.desde)} al ${fechaCorta(susp.hasta)} no trabajas`}:
              estás suspendido. Lo verás en «Mis turnos». Si tienes dudas, habla con la oficina.
            </>} />
          )}
          {noLeToca && portal?.motivo !== 'suspendido' && (
            <Aviso tono="aviso" icono={Ban} texto={'En el cuadrante de hoy no tienes furgoneta asignada, así que no puedes hacer la auditoría. Si crees que es un error, habla con tu coordinador antes de salir.'} />
          )}

          {/* TRABAJAR MÁS, A LA VISTA (24-10-2026). Dani: «que le aparezca "hay 3 vacantes en varios días para
              trabajar más, ¿la quieres? solicítala"». Solo sale con vacantes que puede pedir: días que libra y que
              la ley le deja trabajar (lo decide el servidor). */}
          {!esDemo && extra?.plazas > 0 && (
            <button type="button" onClick={() => setVista('extra')} data-testid="trabajar-mas"
              className="w-full rounded-xl bg-ruta-ok/10 p-3 text-left active:opacity-80">
              <span className="flex items-center gap-2">
                <CalendarPlus size={24} className="shrink-0 text-ruta-ok-texto" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-nombre text-dark-50">¿Quieres trabajar más?</span>
                <Etiqueta tono="ok" texto={extra.plazas === 1 ? '1 vacante' : `${extra.plazas} vacantes`} />
              </span>
              <span className="mt-2 block text-texto text-dark-50">
                {extra.dias === 1
                  ? `Nos falta gente el ${lista(extra.vacantes).find((v) => !v.mi_estado)?.dia || 'día que libras'}, y ese día libras.`
                  : `Nos falta gente en ${extra.dias} días que libras.`} Solicítalo y la oficina te confirma.
              </span>
              <span className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-lg bg-ruta-ok px-3 text-boton text-white">
                Ver y solicitar <ChevronRight size={16} aria-hidden="true" />
              </span>
            </button>
          )}

          {/* Las de Dani (17-10-2026), de tres en tres mientras quepan (07-11-2026): cada casilla mide 100 como mínimo, ×
              «Letra más grande», así que con esa letra, o en 277 px (el zoom del 130 % de un móvil de 360), pasan a dos en
              dos en vez de cortar los títulos a media palabra. */}
          {!esDemo && <div className="mt-1 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(calc(100px*var(--letra,1)),1fr))]">
          <Casilla
            icono={CalendarDays}
            titulo="Pedir días libres"
            detalle={sinVer > 0 ? `${sinVer} respuesta${sinVer > 1 ? 's' : ''} sin leer` : 'Marca los días'}
            aviso={sinVer}
            onClick={() => setVista('dias')}
          />
          {/* Abierta a quien ya tiene turnos cargados; a quien no, «Pronto» (una opción que no está
              genera más preguntas que una que dice que llegará). */}
          <Casilla
            icono={CalendarClock}
            titulo="Mis turnos"
            detalle="Qué días trabajas"
            pronto={!tieneTurnos}
            onClick={() => setVista('turnos')}
          />
          {/* Sin vacantes, «Trabajar más» sigue a un toque: ahí están lo que ha solicitado y sus días extra. */}
          {extra && !(extra.plazas > 0) && (tieneTurnos || lista(extra.extras).length > 0) && (
            <Casilla
              icono={CalendarPlus}
              titulo="Trabajar más"
              detalle={extraPendiente ? 'Solicitado: esperando'
                : extrasProximos ? `${extrasProximos} día${extrasProximos > 1 ? 's' : ''} extra` : 'Sin vacantes ahora'}
              onClick={() => setVista('extra')}
            />
          )}
          {casillaDnr && (
            <Casilla icono={IconoDnr} titulo={casillaDnr.titulo} linea={casillaDnr.linea} detalle={casillaDnr.detalle} aviso={casillaDnr.nuevas}
              onClick={() => setVista('dnr')} />
          )}
          {/* Sin «Comparte y gana» en la app de iPhone (09-11-2026): allí no hay invitaciones, bonos ni cartera. */}
          {!sinPagos() && <Casilla
            icono={Gift}
            titulo="Comparte y gana"
            detalle={`${(refCentActual() / 100).toFixed(2).replace('.', ',').replace(',00', '')} € por compañero`}
            tono="verde"
            onClick={() => setVista('cartera')}
          />}
          {merc && (
            <Casilla
              icono={Store}
              titulo="Mercadillo"
              detalle={merc.sin_leer > 0 ? `${merc.sin_leer} mensaje${merc.sin_leer > 1 ? 's' : ''}` : 'Vende lo que no uses'}
              aviso={merc.sin_leer}
              onClick={() => setVista('mercadillo')}
            />
          )}
          {/* LA ROPA, CON EL PRECIO EN LA PROPIA ENTRADA. Estaba aquí desde el
              08-09 y no entró casi nadie: decía «La del equipo, con tu nombre»
              y nada más, así que abrirla era averiguar si costaba 20 € o 200.
              Con el precio delante la decisión se toma antes de entrar, y el
              «desde» sale del escaparate —o sea, del precio de verdad—, no de
              un número escrito aquí que se quedaría viejo (gotcha 54). */}
          {tienda && (
            <Casilla
              icono={ShoppingBag}
              titulo="Ropa del equipo"
              detalle={tienda.desde ? `Desde ${tienda.desde.toFixed(2).replace('.', ',')} €` : 'Con tu nombre'}
              tono="ambar"
              onClick={() => setVista('tienda')}
            />
          )}
          {/* Con la sesión de su enlace (14-11-2026) el servidor no deja poner contraseña ni correo de recuperación
              (403 `enlace_sin_contrasena`): en vez de dos casillas que acaban en un error, una línea tranquila debajo. */}
          {!conEnlace && <>
          <Casilla
            icono={Lock}
            titulo={tieneClave ? 'Cambiar mi contraseña' : 'Crear mi contraseña'}
            detalle={tieneClave ? null : 'Entras con el correo'}
            onClick={() => setVista('clave')}
          />
          <Casilla
            icono={Mail}
            titulo="Correo de recuperación"
            detalle="Añade un correo personal para recibir códigos"
            onClick={() => setVista('correo')}
          />
          </>}
          </div>}
          {!esDemo && conEnlace && <LineaEnlace className="mt-1 px-1" />}
        </div>
      </div>
    </div>
  )
}
