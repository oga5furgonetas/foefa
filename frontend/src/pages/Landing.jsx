import { useEffect, useState } from 'react'
import {
  Camera, ScanLine, FileText, Mic, Route, Navigation, MapPinned, ParkingSquare, Hand, PenLine, History,
  MessageCircle, WifiOff, Search, Wallet, BarChart3, FileSpreadsheet, BellRing, ScanSearch, Bot,
  ClipboardCheck, Wrench, CalendarClock, CalendarDays, Users, ShoppingBasket, ArrowRight, Check, Loader2, Sun, Moon,
  Smartphone, Languages, Gift, ShieldCheck,
} from 'lucide-react'
import { MARCA } from '../marca'
import { tx, useIdioma, IDIOMAS, cambiarIdioma, idioma, locale } from '../lib/idioma'
import { API_BASE } from '../lib/apiBase'
import { saveSession } from '../panel/auth'
import { medirAccion } from '../lib/analitica'
import { evento } from '../lib/metaPixel'
import { abrirDemoReparto } from '../lib/demoReparto'
import { paisDelMovil } from '../lib/region'
import { PARADAS_GRATIS, promoGratis, fechaPromo, eurosRef, refCentActual, refPromoActiva, fechaRefPromo, BONO_CENT } from '../lib/precios'
import Landing3DShowcase from './Landing3DShowcase'
import GooglePlayBadge from '../components/GooglePlayBadge'
import { esAndroid } from '../lib/instalar'

/* ── LA PORTADA (21-10-2026) ──────────────────────────────────────────────
   Dani: «cuando entra una persona nueva a la web, véndelo sobre todo como la
   app de reparto gratis, con todas las funciones que tiene; después lo de la
   IA y para negocios con su dashboard». El orden es ese: quien llega casi
   siempre reparte; la empresa viene después.

   REGLA DE SIEMPRE: nada que la app no haga hoy. Cada función de aquí tiene
   detrás una pantalla que existe (ver docs/ESTADO.md), el precio sale de
   lib/precios.js (si cambia la promoción, cambia aquí solo), no hay cifras de
   clientes ni testimonios, y la vista del panel dice que son datos de ejemplo.

   Los textos van por tx() —el mismo diccionario de la app del repartidor, en
   siete idiomas— y el idioma que se elija aquí es el que tendrá la app. */

/* «Invita y gana»: España por Bizum, Latinoamérica por PayPal. */
const conInvita = () => true

/* Con quién reparte la gente de cada país (como en /repartidores). Marcas de sus dueños, sin relación. */
const PARA_QUIEN = {
  es: ['Paquetería', 'MRW', 'Nacex', 'Tipsa', 'Glovo', 'Súper a domicilio'],
  mx: ['Paquetería', 'Mercado Libre', 'Estafeta', 'DHL', 'J&T', 'Súper a domicilio'],
  co: ['Paquetería', 'Mercado Libre', 'Servientrega', 'Coordinadora', 'Interrapidísimo', 'Súper a domicilio'],
  ar: ['Paquetería', 'Mercado Libre', 'Andreani', 'OCA', 'Correo Argentino', 'Súper a domicilio'],
  cl: ['Paquetería', 'Mercado Libre', 'Chilexpress', 'Starken', 'Blue Express', 'Súper a domicilio'],
  pe: ['Paquetería', 'Mercado Libre', 'Olva Courier', 'Shalom', 'Súper a domicilio'],
  br: ['Paquetería', 'Mercado Livre', 'Shopee', 'Correios', 'Loggi', 'Súper a domicilio'],
  pt: ['Paquetería', 'CTT', 'DPD', 'GLS', 'Súper a domicilio'],
  us: ['Paquetería', 'FedEx', 'UPS', 'USPS', 'Súper a domicilio'],
  latam: ['Paquetería', 'Mercado Libre', 'DHL', 'Súper a domicilio'],
}
const paraQuienAqui = () => { const p = paisDelMovil(); return PARA_QUIEN[p] || (p ? PARA_QUIEN.latam : PARA_QUIEN.es) }

const PASOS_PORTADA = [
  [Camera, 'Carga los paquetes', 'Escanea la etiqueta, hazle una foto o a tu hoja de reparto. Las direcciones entran solas.'],
  [Route, 'La ruta se ordena sola', 'Por tiempo y con el tráfico típico, para que acabes antes.'],
  [Navigation, 'Entrega y apunta', 'Te lleva con voz hasta cada puerta y apunta dónde lo dejaste.'],
]

/* TODO lo que hace la app del repartidor, agrupado por momento del día. Cada línea, una pantalla que existe. */
const FUNCIONES_RUTA = [
  ['Al cargar', [
    [Camera, 'Escanea o haz una foto a la etiqueta, sea de la empresa que sea: la dirección y el teléfono entran solos'],
    [ScanLine, 'Escanea seguidos todos los paquetes al cargar la furgoneta'],
    [FileText, '¿Te dan una hoja con la lista? Una foto y entran todas las paradas'],
    [Mic, 'Busca las direcciones o díctalas con la voz'],
  ]],
  ['En la ruta', [
    [Route, 'La ruta se ordena sola por tiempo, con el tráfico típico'],
    [Navigation, 'Te guía con voz hasta cada puerta, dentro de la app, o con Google Maps o Waze'],
    [MapPinned, 'El mapa te sigue y recalcula si te desvías; ves la fachada de cada parada'],
    [ParkingSquare, 'Las zonas de carga y descarga cerca de tus paradas, en el mapa'],
  ]],
  ['En la puerta', [
    [Hand, 'Manos libres en Android: di «entregado» y sigue conduciendo'],
    [PenLine, 'Dónde lo dejas (vecino, buzón, portería…), quién lo recoge y su firma con el dedo'],
    [History, 'Recuerda la última vez en esa puerta: dónde lo dejaste y tu nota'],
    [MessageCircle, 'Avisa al cliente con tu hora de llegada'],
    [WifiOff, 'Sin cobertura no pasa nada: se guarda y se envía al volver la red'],
    [Search, 'Escanea un paquete y te dice en qué parada va'],
  ]],
  ['Tus cuentas', [
    [Wallet, 'Cuánto llevas ganado hoy y la gasolina, en tu moneda'],
    [BarChart3, 'El historial de cada día y tu semana frente a la anterior'],
    [FileSpreadsheet, 'El mes entero en un Excel para la gestoría'],
    [BellRing, 'Un aviso por la mañana a la hora que tú elijas'],
  ]],
]

const PREGUNTAS_PORTADA = [
  ['¿Es gratis de verdad?', 'pregunta_gratis'],
  ['¿Sirve con los paquetes de mi agencia?', 'Sí. Escaneas la etiqueta: si su código ya trae la dirección, entra sola; si no, la app la lee de la foto (y si no puede, la escribes tú). También puedes hacer una foto a tu hoja de reparto o pegar la lista. No necesita conectarse con tu agencia.'],
  ['¿Tengo que instalar algo?', 'Funciona en el navegador de cualquier móvil, Android o iPhone: la añades a tu pantalla de inicio y se abre como una app. En iPhone no se descarga de la App Store: se añade desde Safari, con Compartir y «Añadir a pantalla de inicio».'],
  ['¿Qué hacéis con mis datos y mi ubicación?', 'La foto de la etiqueta se lee en tu móvil. Tu ubicación solo se usa para guiarte y no se guarda. Los datos de tus clientes se borran solos a los días que tú fijes.'],
  ['Tengo una empresa con varios repartidores', 'Crea la cuenta de empresa: tienes el panel de la oficina, y tu gente entra desde su móvil con su enlace. Los 14 primeros días son gratis y sin tarjeta.'],
]

/* La IA, contada como la ve una empresa: en las revisiones y en el asistente del panel. */
const IA_PORTADA = [
  [ScanSearch, 'Ve cada golpe en las fotos', 'Dice en qué pieza está, cómo de grave es y si ya estaba en la revisión anterior o es nuevo. Tú lo validas o lo descartas con un clic.'],
  [Bot, 'Un asistente que conoce tu flota', 'Pregúntale qué ITV caducan este mes o quién lleva cada furgoneta: contesta con tus datos reales y, si hay que cambiar algo, te lo deja preparado para que tú lo confirmes.'],
  [ShieldCheck, 'Siempre decides tú', 'El asistente propone y tú confirmas: no cambia nada por su cuenta.'],
]

/* LO DE LA EMPRESA: el panel de la oficina. Cada módulo, una pantalla del panel. */
const MODULOS_EMPRESA = [
  [ClipboardCheck, 'Revisiones con foto e IA', 'El conductor revisa la furgoneta desde el móvil y la IA señala cada golpe nuevo.'],
  [Wrench, 'Taller y estado de la flota', 'Incidencias, órdenes de reparación y qué furgoneta está peor, de la peor a la mejor.'],
  [CalendarClock, 'Vencimientos', 'ITV, seguro, renting y mantenimientos en un calendario, ordenados por lo que caduca antes.'],
  [CalendarDays, 'Cuadrante y días libres', 'El cuadrante se rehace solo con sus reglas, se sincroniza con tu Google Sheets y la gente pide días o se apunta a refuerzos desde el móvil.'],
  [Users, 'Asignación del día y equipo', 'Quién lleva cada furgoneta hoy, las fichas de tu gente y el portal de cada conductor en su móvil.'],
  [ShoppingBasket, 'Reparto a domicilio', 'Para súper y distribución: pedidos, rutas de tus repartidores y un enlace para que el cliente siga su pedido.'],
]

/* El botón principal: cian de la marca con tinta oscura, igual de día y de noche. */
const BTN_PRIMARIO = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-5 py-3 text-[15px] font-semibold text-[#04121a] shadow-[0_10px_30px_-10px_rgba(20,231,216,.55)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60'
const BTN_SECUNDARIO = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-5 py-3 text-[15px] font-semibold text-[color:var(--ld-text)] transition hover:border-[color:var(--ld-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60'
const ALTA_REPARTIDOR = '/registro?sector=autonomo&plan=autonomo'

function Seccion({ id, eyebrow, titulo, sub, children, className = '' }) {
  return (
    <section id={id} className={`mx-auto max-w-[1120px] px-5 py-14 sm:py-20 ${className}`}>
      {(eyebrow || titulo) && (
        <header className="mb-10 max-w-2xl">
          {eyebrow && <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ld-accent)]">{eyebrow}</p>}
          {titulo && (
            <h2 className="mt-3 font-display text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-[color:var(--ld-text)] [text-wrap:balance]">{titulo}</h2>
          )}
          {sub && <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{sub}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

/* El móvil del héroe: el vídeo de la app de verdad (el de los anuncios, mudo y en bucle) y dos capturas reales. */
function Moviles() {
  const capturas = 'es'
  const video = ['es', 'en', 'pt', 'fr', 'it', 'de'].includes(idioma()) ? idioma() : 'es'
  return (
    <div className="relative mx-auto flex w-full max-w-[460px] items-end justify-center gap-3 sm:gap-4">
      <img src={`/capturas-ruta/${capturas}/2-mapa.webp`} alt="" width="390" height="844" loading="lazy"
        className="w-[30%] translate-y-6 rounded-[22px] border border-[color:var(--ld-border-strong)] shadow-2xl shadow-black/30" />
      <video src={`/videos/web-${video}.mp4?v=1`} poster={`/capturas-ruta/${capturas}/1-ruta.webp`} autoPlay muted loop playsInline preload="metadata"
        width="390" height="693" aria-label={tx('Vídeo de la app')}
        className="w-[40%] rounded-[26px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] object-cover shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)]" />
      <img src={`/capturas-ruta/${capturas}/3-navegando.webp`} alt="" width="390" height="844" loading="lazy"
        className="w-[30%] translate-y-6 rounded-[22px] border border-[color:var(--ld-border-strong)] shadow-2xl shadow-black/30" />
    </div>
  )
}

/* La vista del panel de la oficina, con datos de ejemplo (y lo dice en su pie). */
const SALIDAS = [
  { m: '5678 KLM', c: 'Luis P.', r: 'Zona 3', ok: false },
  { m: '1234 BCD', c: 'Ana L.', r: 'Zona 1', ok: true, sev: true },
  { m: '9012 FGH', c: 'Marta G.', r: 'Zona 2', ok: true },
  { m: '3456 JKL', c: 'Iván R.', r: 'Zona 4', ok: true },
]
function VistaPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] shadow-[0_40px_90px_-40px_rgba(0,0,0,.6)]">
      <div className="flex items-center gap-1.5 border-b border-[color:var(--ld-border)] px-4 py-2.5">
        {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-[color:var(--ld-border-strong)]" />)}
        <span className="ml-3 truncate font-mono text-[11px] text-[color:var(--ld-dim)]">{MARCA.nombre.toLowerCase()} · panel</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--ld-dim)]">{tx('El día de hoy')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <span className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-[color:var(--ld-text)] tabular-nums">86<span className="text-lg font-medium text-[color:var(--ld-dim)]">%</span></span>
            <p className="mt-1 text-[12.5px] text-[color:var(--ld-muted)]">{tx('de la flota revisada hoy')}</p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {[['2', tx('salen sin revisar'), true], ['3', tx('golpes nuevos'), true], ['1', tx('ITV esta semana'), false]].map(([n, k, alerta]) => (
              <div key={k}>
                <dt className="sr-only">{k}</dt>
                <dd className={`font-display text-[22px] font-semibold leading-none tabular-nums ${alerta ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-text)]'}`}>{n}</dd>
                <dd className="mt-1 text-[11.5px] text-[color:var(--ld-dim)]">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--ld-fill)]"><div className="h-full w-[86%] rounded-full bg-emerald-400/85" /></div>
        <ul className="mt-5 grid grid-cols-2 gap-2">
          {SALIDAS.map((s) => (
            <li key={s.m} className={`rounded-xl border p-2.5 ${s.ok ? 'border-[color:var(--ld-border)]' : 'border-[color:var(--ld-warn)]'} bg-[color:var(--ld-surface2)]`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11.5px] font-bold text-[color:var(--ld-text)]">{s.m}</span>
                <span className="font-mono text-[10px] text-[color:var(--ld-dim)]">{s.r}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[color:var(--ld-muted)]">{s.c}</div>
              <div className={`mt-1.5 text-[10.5px] font-semibold ${!s.ok ? 'text-[color:var(--ld-warn)]' : s.sev ? 'text-[color:var(--ld-mid)]' : 'text-[color:var(--ld-ok)]'}`}>
                {tx(!s.ok ? 'sin revisar' : s.sev ? 'golpe moderado' : 'revisada')}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-[color:var(--ld-border)] px-5 py-2 text-[11px] text-[color:var(--ld-dim)]">{tx('Vista del panel · datos de ejemplo')}</p>
    </div>
  )
}

/* El precio para quien reparte: sale de lib/precios.js, así que la promoción caduca sola en la portada. */
function PrecioRepartidor() {
  const promo = promoGratis()
  const lineas = promo
    ? [tx('Gratis y sin límite hasta el {fecha}', { fecha: fechaPromo(locale()) }),
      tx('Después, gratis hasta {n} paradas al día, o sin tope por 9,99 €/mes', { n: PARADAS_GRATIS }),
      tx('Sin tarjeta: te registras y empiezas ya')]
    : [tx('Gratis para siempre hasta {n} paradas al día', { n: PARADAS_GRATIS }),
      tx('Sin tope: 9,99 €/mes o 99 €/año, con 7 días de prueba'),
      tx('Cancelas cuando quieras desde la app'),
      tx('Sin tarjeta: la prueba empieza ya y hoy no pagas nada')]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-brand-400/30 bg-[color:var(--ld-surface)] p-7">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ld-accent)]">{tx('Para quien reparte')}</p>
        <p className="mt-3 font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] text-[color:var(--ld-text)]">{tx('Gratis')}</p>
        <ul className="mt-5 space-y-2 text-[15px] text-[color:var(--ld-muted)]">
          {lineas.map((l) => <li key={l} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-[color:var(--ld-ok)]" /> {l}</li>)}
        </ul>
        {conInvita() && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-[color:var(--ld-fill)] px-3.5 py-2.5 text-[14px] text-[color:var(--ld-text)]">
            <Gift size={17} className="mt-0.5 shrink-0 text-[color:var(--ld-accent)]" />
            <span>
              {promo && refPromoActiva()
                ? tx('Gana {bono} con tu primera ruta real y {euros} por cada compañero que la use.', { bono: eurosRef(BONO_CENT, locale()), euros: eurosRef(refCentActual(), locale()) })
                : tx('Gana {euros} por cada compañero que la use.', { euros: eurosRef(refCentActual(), locale()) })}
              {promo && refPromoActiva() && (
                <span className="mt-0.5 block text-[12.5px] text-[color:var(--ld-dim)]">
                  {tx('Promo hasta el {fecha}', { fecha: fechaRefPromo(locale()) })} · {tx('La primera ruta cuenta con 20 entregas en 2 días distintos.')}
                </span>
              )}
            </span>
          </p>
        )}
      </div>
      <a href={ALTA_REPARTIDOR} onClick={() => { medirAccion('portada_alta_precio'); evento('Lead', { content_name: 'crear_cuenta' }) }} className={`${BTN_PRIMARIO} mt-7 self-start`}>
        {tx('Crear mi cuenta gratis')} <ArrowRight size={16} />
      </a>
    </div>
  )
}

export default function Landing() {
  const lang = useIdioma()
  // El título va con el texto ya traducido: las traducciones llegan después del primer pintado.
  const titulo = tx('FDS · La app de reparto gratis: ruta ordenada, escáner y navegación')
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = lang } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo, lang])
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('ld_theme') || 'dark' } catch { return 'dark' } })
  useEffect(() => { try { localStorage.setItem('ld_theme', tema) } catch { /* modo privado */ } }, [tema])
  const [probando, setProbando] = useState(false)
  const [errProbar, setErrProbar] = useState('')
  const [demo, setDemo] = useState('')          // '' | 'cargando' | 'error'
  const promo = promoGratis()

  async function probar() {
    medirAccion('portada_probar')
    evento('Lead', { content_name: 'probar_demo' })
    setProbando(true); setErrProbar('')
    try {
      await abrirDemoReparto()
    } catch (e) { setErrProbar(e.message || tx('Sin conexión')); setProbando(false) }
  }

  /* La demo del panel entra con un usuario de solo lectura. Si el servidor no contesta, se dice. */
  async function abrirDemoPanel() {
    if (demo === 'cargando') return
    medirAccion('portada_demo_panel')
    setDemo('cargando')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-login`, { method: 'POST' })
      const j = await r.json()
      if (j?.access_token) { saveSession(j); window.location.href = '/panel'; return }
    } catch { /* se dice abajo */ }
    setDemo('error')
  }

  const alta = (sitio) => () => { medirAccion(`portada_alta_${sitio}`); evento('Lead', { content_name: 'crear_cuenta' }) }

  return (
    <div className="ld-root min-h-screen overflow-x-hidden font-sans antialiased" data-theme={tema}>
      {/* ── Cabecera ── */}
      <nav className="sticky top-0 z-50 border-b border-[color:var(--ld-border)] bg-[color:var(--ld-nav)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-3 px-5">
          <a href="/" className="flex items-center gap-2.5 text-[color:var(--ld-text)]">
            <img src="/favicon.svg" alt="" width="30" height="30" className="rounded-lg" />
            <span className="font-display text-[18px] font-bold tracking-[-0.02em]">FDS</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-5">
            <a href="#funciones" className="hidden text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] md:inline">{tx('Funciones')}</a>
            <a href="#empresas" className="hidden text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] md:inline">{tx('Para empresas')}</a>
            <a href="#precio" className="hidden text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] sm:inline">{tx('Precio')}</a>
            {/* El tablón de ofertas (Dani, 21-10-2026: «en la pantalla principal, al lado de Funciones»). Se ve también en el móvil. */}
            <a href="/empleo" onClick={() => medirAccion('portada_empleo')} className="whitespace-nowrap px-1 text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx('Empleo')}</a>
            <a href="/panel/login" className="whitespace-nowrap px-2 text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx('Entrar')}</a>
            <a href={ALTA_REPARTIDOR} onClick={alta('menu')} className="whitespace-nowrap rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-3.5 py-2 text-[13.5px] font-semibold text-[#04121a] hover:brightness-110">{tx('Empezar gratis')}</a>
          </div>
        </div>
      </nav>

      {/* ── Héroe: la app de reparto gratis ── */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-[-10%] h-[520px] w-[720px] rounded-full bg-brand-400/[0.10] blur-[120px]" />
          <div className="absolute -bottom-40 left-[-10%] h-[420px] w-[620px] rounded-full bg-brand-600/[0.10] blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-12 px-5 pb-20 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-400/10 px-3 py-1 text-[13px] font-semibold text-[color:var(--ld-text)]">
              <Gift size={14} className="text-[color:var(--ld-accent)]" />
              {promo ? tx('Gratis y sin límite hasta el {fecha} · sin tarjeta', { fecha: fechaPromo(locale()) }) : tx('Gratis hasta {n} paradas al día · sin tarjeta', { n: PARADAS_GRATIS })}
            </p>
            <h1 className="mt-5 font-display text-[clamp(38px,5.6vw,64px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-[color:var(--ld-text)] [text-wrap:balance]">
              {tx('La app de reparto gratis')}
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, var(--ld-grad-a), var(--ld-grad-b))' }}>
                {tx('que ordena tu ruta sola.')}
              </span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17.5px] leading-relaxed text-[color:var(--ld-muted)]">
              {tx('Escanea los paquetes o haz una foto a la etiqueta, sea de la empresa que sea. La app ordena las paradas, te lleva con voz hasta cada puerta y apunta lo que ganas.')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={ALTA_REPARTIDOR} onClick={alta('heroe')} className={BTN_PRIMARIO}>{tx('Crear mi cuenta gratis')} <ArrowRight size={16} /></a>
              <button type="button" onClick={probar} disabled={probando} className={BTN_SECUNDARIO}>
                {probando ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />} {tx('Probarla ahora, sin registrarme')}
              </button>
            </div>
            {esAndroid() && (
              <div className="mt-4">
                <GooglePlayBadge onClick={() => medirAccion('portada_google_play')} />
              </div>
            )}
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[color:var(--ld-dim)]">
              <span className="inline-flex items-center gap-1.5"><Smartphone size={14} /> {tx('Android e iPhone, desde el navegador')}</span>
              <span className="inline-flex items-center gap-1.5"><Languages size={14} /> {tx('En 6 idiomas')}</span>
            </p>
            {errProbar && <p role="alert" className="mt-3 text-[13px] text-[color:var(--ld-warn)]">{errProbar}</p>}
          </div>
          <Moviles />
        </div>
      </header>

      {/* ── Para quién: que quien reparte se vea reflejado ── */}
      <section className="border-y border-[color:var(--ld-border)] bg-[color:var(--ld-surface2)]">
        <div className="mx-auto max-w-[1120px] px-5 py-6">
          <p className="text-[14px] font-semibold text-[color:var(--ld-text)]">{tx('Sirve igual si repartes para una agencia, una plataforma o un súper:')}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {paraQuienAqui().map((m) => (
              <li key={m} className="rounded-full border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-3 py-1 text-[13px] font-semibold text-[color:var(--ld-text)]">{tx(m)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[color:var(--ld-dim)]">{tx('Marcas de sus dueños, sin relación con ellas. Tú metes los paquetes y la app ordena la ruta.')}</p>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <Seccion eyebrow={tx('Cómo funciona')} titulo={tx('De la furgoneta cargada a la última puerta')}>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {PASOS_PORTADA.map(([Icono, t, d], i) => (
            <li key={t}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/[0.12] ring-1 ring-brand-400/25"><Icono size={18} className="text-[color:var(--ld-accent)]" /></span>
                <span className="font-mono text-[12px] font-semibold text-[color:var(--ld-dim)]">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] text-[color:var(--ld-text)]">{tx(t)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* ── Todas las funciones ── */}
      <Seccion id="funciones" eyebrow={tx('Funciones')} titulo={tx('Todo lo que hace por ti, gratis')}
        sub={tx('No es una versión recortada: las funciones son las mismas para todos. Lo único que cambia es cuántas paradas al día.')}
        className="border-t border-[color:var(--ld-border)]">
        <div className="grid gap-6 md:grid-cols-2">
          {FUNCIONES_RUTA.map(([grupo, lista]) => (
            <div key={grupo} className="rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-6">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ld-accent)]">{tx(grupo)}</h3>
              <ul className="mt-4 space-y-3.5">
                {lista.map(([Icono, t]) => (
                  <li key={t} className="flex items-start gap-3 text-[15px] leading-snug text-[color:var(--ld-text)]">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-400/[0.12]"><Icono size={16} className="text-[color:var(--ld-accent)]" /></span>
                    <span className="pt-1">{tx(t)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[14px] text-[color:var(--ld-muted)]">
          {tx('Y además: modo claro u oscuro, letra más grande y la app en español, inglés, portugués, francés, italiano o alemán.')}
        </p>
      </Seccion>

      {/* ── Precio ── */}
      <section id="precio" className="mx-auto max-w-[1120px] px-5 pb-6">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <PrecioRepartidor />
          <div className="flex flex-col justify-center rounded-2xl border border-[color:var(--ld-border)] p-7">
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] text-[color:var(--ld-text)]">{tx('Pruébala en un minuto')}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{tx('Con 8 paradas de ejemplo. Sin datos ni tarjeta: pruébala en 1 minuto.')}</p>
            <button type="button" onClick={probar} disabled={probando} className={`${BTN_SECUNDARIO} mt-5 self-start`}>
              {probando ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />} {tx('Probarla ahora, sin registrarme')}
            </button>
            <p className="mt-4 text-[13.5px] text-[color:var(--ld-dim)]">{tx('¿Ya tienes cuenta?')} <a href="/panel/login" className="font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Entrar')}</a></p>
          </div>
        </div>
      </section>

      {/* ── La IA ── */}
      <Seccion eyebrow={tx('Con IA')} titulo={tx('La IA que mira por tu flota')}
        sub={tx('Para empresas: la IA revisa las fotos de cada furgoneta y un asistente te contesta con los datos de tu flota.')}
        className="border-t border-[color:var(--ld-border)]">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-6">
            {IA_PORTADA.map(([Icono, t, d]) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/[0.12] ring-1 ring-brand-400/25"><Icono size={18} className="text-[color:var(--ld-accent)]" /></span>
                <div>
                  <h3 className="text-[17px] font-semibold text-[color:var(--ld-text)]">{tx(t)}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Landing3DShowcase inline t={{ hint: tx('Arrastra para girarla · toca un golpe'), loading: tx('Cargando el modelo 3D…'),
            sinTresD: tx('Tu navegador no muestra 3D: así se ve en foto.'), fotoAlt: tx('Furgoneta de ejemplo con sus daños marcados') }} />
        </div>
      </Seccion>

      {/* ── Para empresas: el panel de la oficina ── */}
      <Seccion id="empresas" eyebrow={tx('Para empresas')} titulo={tx('¿Tienes una empresa de reparto o una flota?')}
        sub={tx('Tu gente reparte con la app y tú lo ves todo en el panel de la oficina: furgonetas, revisiones, taller, cuadrante y equipo.')}
        className="border-t border-[color:var(--ld-border)]">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <ul className="grid gap-px overflow-hidden rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-border)] sm:grid-cols-2">
              {MODULOS_EMPRESA.map(([Icono, t, d]) => (
                <li key={t} className="bg-[color:var(--ld-bg)] p-5">
                  <Icono size={19} className="text-[color:var(--ld-accent)]" />
                  <h3 className="mt-3 text-[15.5px] font-semibold text-[color:var(--ld-text)]">{tx(t)}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="/registro" onClick={() => medirAccion('portada_alta_empresa')} className={BTN_PRIMARIO}>{tx('Crear cuenta de empresa')} <ArrowRight size={16} /></a>
              <button type="button" onClick={abrirDemoPanel} disabled={demo === 'cargando'} className={BTN_SECUNDARIO}>
                {demo === 'cargando' ? <Loader2 size={16} className="animate-spin" /> : null} {tx('Ver la demo del panel')}
              </button>
            </div>
            <p className="mt-3 text-[13px] text-[color:var(--ld-dim)]">{tx('Desde 5 € por vehículo y mes · 14 días gratis, sin tarjeta')} · <a href="/planes" className="font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Ver precios')}</a></p>
            {demo === 'error' && <p role="status" className="mt-2 text-[13px] text-[color:var(--ld-warn)]">{tx('La demo no responde ahora mismo. Prueba a crear una cuenta: son dos minutos.')}</p>}
          </div>
          <VistaPanel />
        </div>
      </Seccion>

      {/* ── Preguntas ── */}
      <Seccion eyebrow={tx('Preguntas frecuentes')} titulo={tx('Lo que todo el mundo pregunta')} className="border-t border-[color:var(--ld-border)]">
        <div className="divide-y divide-[color:var(--ld-border)] overflow-hidden rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)]">
          {PREGUNTAS_PORTADA.map(([q, r]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold text-[color:var(--ld-text)]">
                {tx(q)} <span className="text-[color:var(--ld-accent)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">
                {q === '¿Tengo que instalar algo?' && <a href="/iphone" className="mb-1.5 block font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('¿iPhone? Así se instala y se usa')} →</a>}
                {r === 'pregunta_gratis'
                  ? (promo
                    ? tx('Gratis y sin límite hasta el 31 de diciembre, sin tarjeta. Después sigues gratis con hasta 15 paradas al día, o sin tope por 9,99 € al mes o 99 € al año. Cancelas cuando quieras desde la propia app.')
                    : tx('Gratis para siempre hasta 15 paradas al día, sin tarjeta. Sin tope: 9,99 € al mes o 99 € al año, y los 7 primeros días van sin tope. Cancelas cuando quieras desde la propia app.'))
                  : tx(r)}
              </p>
            </details>
          ))}
        </div>
      </Seccion>

      {/* ── Cierre ── */}
      <section className="mx-auto max-w-[1120px] px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-brand-400/25 bg-[color:var(--ld-surface)] px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-brand-400/[0.14] blur-[90px]" />
          <h2 className="relative font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[color:var(--ld-text)] [text-wrap:balance]">{tx('Tu próxima ruta, ordenada sola')}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">
            {promo ? tx('Gratis y sin límite hasta el {fecha} · sin tarjeta', { fecha: fechaPromo(locale()) }) : tx('Gratis hasta {n} paradas al día · sin tarjeta', { n: PARADAS_GRATIS })}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <a href={ALTA_REPARTIDOR} onClick={alta('cierre')} className={BTN_PRIMARIO}>{tx('Crear mi cuenta gratis')} <ArrowRight size={16} /></a>
            <a href="#empresas" className={BTN_SECUNDARIO}>{tx('Soy una empresa')}</a>
          </div>
        </div>
      </section>

      {/* ── Pie ── */}
      <footer className="border-t border-[color:var(--ld-border)]">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <a href="/" className="flex items-center gap-2.5 text-[color:var(--ld-text)]">
              <img src="/favicon.svg" alt="" width="26" height="26" className="rounded-md" />
              <span className="font-display text-[16px] font-bold">FDS</span>
            </a>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[color:var(--ld-dim)]">{tx('La app de reparto gratis y el panel para tu flota.')}</p>
            <div className="mt-5 flex items-center gap-2">
              <label htmlFor="ld-idioma" className="sr-only">Idioma / Language</label>
              <select id="ld-idioma" value={lang} onChange={(e) => cambiarIdioma(e.target.value)}
                className="rounded-lg border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2.5 py-1.5 text-[13px] text-[color:var(--ld-text)]">
                {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" onClick={() => setTema((v) => (v === 'dark' ? 'light' : 'dark'))}
                aria-label={tx('Cambiar entre claro y oscuro')} title={tx('Cambiar entre claro y oscuro')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">
                {tema === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
          <nav aria-label={tx('Producto')}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('Producto')}</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              {[['/repartidores', tx('App de reparto')], ['/planes', tx('Precios para empresas')], ['/guia-ruta-de-reparto', tx('Guía: cómo ordenar la ruta')],
                ['/peritaje-tecnico', tx('Cómo funciona la IA de daños')], ['/empleo', tx('Ofertas de empleo')], ['/contacto', tx('Contacto')], ['/panel/login', tx('Entrar')]].map(([h, k]) => (
                <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{k}</a></li>
              ))}
            </ul>
          </nav>
          <nav aria-label={tx('Legal')}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('Legal')}</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              {[['/privacidad', tx('Privacidad')], ['/terminos', tx('Términos')], ['/cookies', tx('Cookies')], ['/aviso-legal', tx('Aviso legal')], ['/security', tx('Seguridad')]].map(([h, k]) => (
                <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{k}</a></li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="border-t border-[color:var(--ld-border)] px-5 py-5 text-center text-[12.5px] text-[color:var(--ld-dim)]">© {new Date().getFullYear()} {MARCA.nombre}</p>
      </footer>
    </div>
  )
}
