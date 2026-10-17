import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Route, History, Settings2, UserCircle2, Loader2, CheckCircle2, XCircle, Package, Euro, ChevronRight, ChevronDown, ArrowLeft,
  MapPin, Phone, Camera, Clock, RotateCcw, FileSpreadsheet, X,
} from 'lucide-react'
import MiRuta from './driver/MiRuta'
import { Ajustes } from '../panel/pages/Reparto'
import {
  getRepartoPedidos, getRepartoEstadisticas, getOrgBilling, canjearRegalo, misRegalos, playVerificar, editarRepartoPedido, fotoEntrega,
  getRepartoAjustes, getRepartoEntregasMes,
} from '../panel/api'
import { enAppPlay } from '../lib/enApp'
import { medirAccion } from '../lib/analitica'
import { servicioPlay, comprasPlay } from '../lib/playBilling'
import { enviarPendiente, olvidarPendiente } from '../lib/metaPixel'
import { isAuthed, esSuplantacion, volverASuper, getAdmin, apuntarInicio } from '../panel/auth'
import { Cuenta, Muro } from './RutaCuenta'
import OpinionRuta from './OpinionRuta'
import AvisoManana from './AvisoManana'
import InstalarApp, { PasoInstalar } from './InstalarApp'
import { recienAlta, olvidarRecienAlta, yaEsApp } from '../lib/instalar'
import { useToast } from '../lib/toast'
import { lista } from '../lib/lista'
import { hoyLocal, fechaEs } from '../lib/fecha'
import { importe } from '../lib/region'
import { tx, useIdioma, txError, locale } from '../lib/idioma'
import { invitar } from '../lib/compartir'
import { getReferidos, mercEstado } from '../services/api'
import Mercadillo from './mercadillo/Mercadillo'
import { eurosRef, refCentActual, refPromoActiva, REF_PROMO_HASTA, fechaRefPromo } from '../lib/precios'

/* ── LA APP DE QUIEN REPARTE SOLO (04-10-2026) ───────────────────────────────
   No es el panel de una empresa pequeña: es otro producto, como Circuit o
   Flex. Dani: «no es lógico que a una empresa le cobremos 300 y a un autónomo
   10 por tener lo mismo». Aquí solo hay reparto: su ruta de hoy, lo que lleva
   hecho, cómo se calcula la ruta y su cuenta. Sin vehículos, taller,
   inspecciones, equipo ni asistente de IA. Si entra al panel, se le trae aquí. */

const PESTANAS = [
  ['hoy', 'Hoy', Route], ['historial', 'Historial', History], ['ajustes', 'Ajustes', Settings2], ['cuenta', 'Cuenta', UserCircle2],
]
const euros = (n) => importe(n)

export default function RutaApp() {
  useIdioma()
  const toast = useToast()
  const [tab, setTab] = useState(() => {
    // ?tab=cuenta: el enlace del correo «te quedan 2 días» abre directamente la cuenta.
    const pedida = new URLSearchParams(window.location.search).get('tab')
    if (PESTANAS.some(([k]) => k === pedida)) return pedida
    try { return sessionStorage.getItem('ruta_tab') || 'hoy' } catch { return 'hoy' }
  })
  useEffect(() => { try { sessionStorage.setItem('ruta_tab', tab) } catch { /* nada */ } }, [tab])

  // El estado del pago manda qué se ve: sin pagar (o sin la tarjeta de la
  // prueba), «Hoy» y «Ajustes» enseñan el muro; historial y cuenta, siempre.
  const [billing, setBilling] = useState(null)
  // Lo que gana ESTA cuenta por invitado (las de antes del 12-10 siguen a 5 €): lo dice el servidor.
  const [porInvitado, setPorInvitado] = useState(refCentActual())
  // Hasta cuándo dura la promoción de 10 €: lo dice el servidor; antes de que conteste, la fecha fija.
  const [promoHasta, setPromoHasta] = useState(refPromoActiva() ? REF_PROMO_HASTA : '')
  // Con el bono de bienvenida por ganar, su tarjeta (en la ruta) ya dice lo de invitar: no se repite arriba.
  const [bonoPendiente, setBonoPendiente] = useState(false)
  // REGALO DE SALDO (17-10-2026, Dani: «para que vea que es real»): un aviso en «Hoy», una vez por regalo.
  const [saldoRegalo, setSaldoRegalo] = useState(null)
  const vistoRegalo = (clave) => { try { return !!localStorage.getItem(`fds_regalo_${clave}`) } catch { return false } }
  const verRegalo = () => {
    try { localStorage.setItem(`fds_regalo_${saldoRegalo?.clave}`, '1') } catch { /* incógnito */ }
    setSaldoRegalo(null)
  }
  useEffect(() => {
    if (esSuplantacion()) return
    getReferidos().then(({ data }) => {
      if (data?.por_invitado) setPorInvitado(data.por_invitado)
      if (data && 'por_invitado' in data) setPromoHasta(data.promo_hasta || '')
      setBonoPendiente(!!(data?.bono && !data.bono.pagado))
      if (data?.regalo > 0 && data.regalo_clave && !vistoRegalo(data.regalo_clave)) setSaldoRegalo({ cent: data.regalo, clave: data.regalo_clave })
    }).catch(() => {})
  }, [])
  // EL MERCADILLO (17-10-2026): se abre a pantalla completa desde Cuenta (o con ?mercadillo=1). La entrada solo
  // sale si está abierto, con los mensajes sin leer.
  const [mercAbierto, setMercAbierto] = useState(() => new URLSearchParams(window.location.search).get('mercadillo') === '1')
  const [merc, setMerc] = useState(null)
  const verMerc = useCallback(() => {
    if (esSuplantacion()) return
    mercEstado().then(({ data }) => setMerc(data?.visible ? data : null)).catch(() => setMerc(null))
  }, [])
  useEffect(() => { verMerc() }, [verMerc])
  useEffect(() => {
    const abrir = () => setMercAbierto(true)
    window.addEventListener('fds-abrir-mercadillo', abrir)
    return () => window.removeEventListener('fds-abrir-mercadillo', abrir)
  }, [])
  // La tarjeta del bono ganado lleva a la cartera.
  useEffect(() => {
    const ir = () => setTab('cuenta')
    window.addEventListener('fds-ir-cuenta', ir)
    return () => window.removeEventListener('fds-ir-cuenta', ir)
  }, [])
  const [regaloNuevo, setRegaloNuevo] = useState(null)
  const recargar = useCallback(() => getOrgBilling().then(({ data }) => setBilling(data)).catch(() => setBilling({})), [])
  useEffect(() => {
    if (!isAuthed()) return
    const q = new URLSearchParams(window.location.search)
    const limpiar = () => window.history.replaceState(null, '', '/ruta')
    // Un regalo pendiente (del enlace /regalo/… o de ?canjear=): se canjea
    // ANTES de mirar el pago, para no enseñar el muro a quien ya lo tiene.
    let pendiente = q.get('canjear') || ''
    try { pendiente = pendiente || sessionStorage.getItem('regalo_pendiente') || '' } catch { /* nada */ }
    const canje = pendiente
      ? canjearRegalo(pendiente).then(({ data }) => toast.success(data?.mensaje || tx('Regalo aplicado')))
        .catch((e) => toast.error(txError(e, 'No se pudo canjear el regalo')))
        .finally(() => { try { sessionStorage.removeItem('regalo_pendiente') } catch { /* nada */ } })
      : Promise.resolve()
    canje.then(recargar)
    // El año pagado de una vez (China): es un regalo para sí mismo; en cuanto
    // Stripe confirma el pago (el webhook tarda unos segundos), se canjea.
    const propio = q.get('regalo_propio')
    let tPropio = null
    if (propio) {
      limpiar()
      toast.success(tx('Confirmando el pago…'))
      let n = 0
      const mirar = () => misRegalos().then(({ data }) => {
        const r = (data?.regalos || []).find((x) => x.id === propio)
        if (r?.codigo && r.estado === 'pagado') {
          return canjearRegalo(r.codigo).then(({ data: d }) => { toast.success(d?.mensaje || tx('Regalo aplicado')); recargar() })
        }
        if (r?.estado === 'canjeado') { recargar(); return null }
        n += 1
        if (n < 20) tPropio = setTimeout(mirar, 3000)
        else toast.error(tx('El pago tarda en confirmarse. Si ya has pagado, vuelve a entrar en un rato.'))
        return null
      }).catch((e) => toast.error(txError(e, 'No se pudo canjear el regalo')))
      mirar()
    }
    if (q.get('regalo') === 'cancelado') { toast.error(tx('Pago del regalo cancelado')); olvidarPendiente(); limpiar() } else if (q.get('regalo')) {
      enviarPendiente((p) => p.nombre === 'Purchase')
      setRegaloNuevo(q.get('regalo')); setTab('cuenta'); limpiar()
    }
    if (q.get('pago') === 'ok') {
      enviarPendiente((p) => p.nombre === 'StartTrial' || p.nombre === 'Subscribe')
      // El webhook de Stripe tarda unos segundos: se mira varias veces.
      let n = 0
      const t = setInterval(() => { n += 1; recargar(); if (n >= 8) clearInterval(t) }, 3000)
      toast.success(tx('Tarjeta añadida. Activando tu cuenta…'))
      limpiar()
      return () => clearInterval(t)
    }
    if (q.get('pago') === 'cancelado') { olvidarPendiente(); limpiar() }
    if (pendiente || q.get('canjear')) limpiar()
    return () => clearTimeout(tPropio)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // La próxima vez que abra la app, directo aquí (y si la cuenta ya no es de repartidor, al panel).
  useEffect(() => {
    if (!billing?.sector || esSuplantacion()) return
    apuntarInicio(billing.sector === 'autonomo' ? '/ruta' : null)
  }, [billing?.sector])
  const bloqueado = !!billing?.bloqueo
  // Recién creada la cuenta: antes de la ruta, instalar la app (se puede saltar).
  const [instalarPrimero, setInstalarPrimero] = useState(() => recienAlta() && !yaEsApp() && !esSuplantacion())
  useEffect(() => { if (yaEsApp()) olvidarRecienAlta() }, [])

  // TIRAR PARA ACTUALIZAR (17-10-2026), como en cualquier app: en «Hoy», desde arriba del todo, tirar hacia
  // abajo recarga la ruta. No en el mapa (allí arrastrar es moverlo), ni con una ventana abierta, ni en un campo.
  const [tiron, setTiron] = useState(0)
  const [recargando, setRecargando] = useState(false)
  useEffect(() => {
    if (tab !== 'hoy') return undefined
    let y0 = null
    let dy = 0
    let reloj = null
    const inicio = (e) => {
      y0 = null
      if (window.scrollY > 0 || e.touches.length !== 1) return
      if (e.target?.closest?.('.leaflet-container, [role="dialog"], input, textarea, select, [data-sin-tiron]')) return
      y0 = e.touches[0].clientY
      dy = 0
    }
    const mover = (e) => {
      if (y0 == null) return
      dy = e.touches[0].clientY - y0
      setTiron(dy > 0 && window.scrollY <= 0 ? Math.min(dy * 0.5, 90) : 0)
    }
    const fin = () => {
      if (y0 == null) return
      const recarga = dy * 0.5 >= 64 && window.scrollY <= 0
      y0 = null
      setTiron(0)
      if (!recarga) return
      setRecargando(true)
      if (navigator.vibrate) navigator.vibrate(15)
      window.dispatchEvent(new Event('fds-recargar-ruta'))
      recargar()
      reloj = setTimeout(() => setRecargando(false), 900)
    }
    window.addEventListener('touchstart', inicio, { passive: true })
    window.addEventListener('touchmove', mover, { passive: true })
    window.addEventListener('touchend', fin)
    window.addEventListener('touchcancel', fin)
    return () => {
      clearTimeout(reloj)
      window.removeEventListener('touchstart', inicio)
      window.removeEventListener('touchmove', mover)
      window.removeEventListener('touchend', fin)
      window.removeEventListener('touchcancel', fin)
    }
  }, [tab, recargar])

  // Dentro de la app: si la cuenta de Google ya tiene la suscripción (reinstaló,
  // cambió de móvil) y aquí no consta, se comprueba y se liga. Una vez.
  const [restaurado, setRestaurado] = useState(false)
  useEffect(() => {
    if (restaurado || !billing?.play?.listo || billing.pago_proveedor === 'play' || !enAppPlay()) return
    setRestaurado(true)
    ;(async () => {
      const srv = await servicioPlay()
      if (!srv) return
      const nuestras = (await comprasPlay(srv)).filter((c) => billing.play.productos?.[c.itemId] && c.purchaseToken)
      for (const c of nuestras) {
        try { await playVerificar(c.purchaseToken); recargar(); return } catch { /* de otra cuenta o caducada: se ignora */ }
      }
    })()
  }, [billing, restaurado, recargar])

  if (!isAuthed()) { window.location.replace('/empezar'); return null }
  if (mercAbierto) {
    return (
      <main className="app-ruta min-h-screen bg-dark-950">
        <Mercadillo onBack={() => { setMercAbierto(false); verMerc() }} />
      </main>
    )
  }

  return (
    <main className="app-ruta flex min-h-screen flex-col bg-dark-950 text-dark-100">
      {instalarPrimero && <PasoInstalar onListo={() => { olvidarRecienAlta(); setInstalarPrimero(false) }} />}
      {(tiron > 0 || recargando) && (
        <div aria-hidden="true" data-testid="tiron" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
          style={{ transform: `translateY(${recargando ? 22 : tiron - 18}px)`, transition: tiron ? 'none' : 'transform .2s ease-out' }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dark-700 bg-dark-900 shadow-lg">
            {recargando
              ? <Loader2 size={18} className="animate-spin text-brand-500" />
              : <RotateCcw size={18} className="text-brand-500" style={{ transform: `rotate(${tiron * 4}deg)`, opacity: Math.min(1, tiron / 64) }} />}
          </span>
        </div>
      )}
      {/* «Entrar como» desde la plataforma: la misma franja que en el panel, que aquí faltaba. */}
      {esSuplantacion() && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-[13px] text-amber-200">
          <span className="min-w-0">{tx('Estás viendo la cuenta de {nombre} como plataforma: su tarjeta, su plan y su contraseña solo los cambia el propio repartidor.', { nombre: getAdmin()?.name || '' })}</span>
          <button onClick={volverASuper} className="shrink-0 rounded-md bg-amber-500/30 px-3 py-1 text-[12px] font-semibold">{tx('Volver a mi cuenta')}</button>
        </div>
      )}
      {billing?.status === 'trial' && !billing.promo?.activa && !billing.bloqueo && !billing.falta_tarjeta && billing.days_left != null && billing.days_left <= 3 && tab !== 'cuenta' && (
        <button onClick={() => setTab('cuenta')}
          className="flex w-full items-center justify-center gap-1.5 bg-amber-500/15 px-4 py-2 text-[13px] font-semibold text-amber-200">
          {billing.days_left === 1 ? tx('Queda 1 día de prueba · Ver mi plan') : tx('Quedan {n} días de prueba · Ver mi plan', { n: billing.days_left })}
        </button>
      )}
      {/* Al cambiar de pestaña, el contenido entra con un fundido corto, como en una app. */}
      <div key={tab} className="ruta-entra flex-1 px-4 pb-24 pt-4">
        {/* PLAN GRATIS (10-10-2026): sin pagar ya no hay muro; se reparte con un tope de paradas al día. */}
        {tab === 'hoy' && !bloqueado && billing?.gratis?.activo && (
          <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5">
            <p className="min-w-0 text-[13px] leading-snug text-sky-100">
              {tx('Plan gratis: hasta {n} paradas nuevas al día.', { n: billing.gratis.tope })}
            </p>
            <button onClick={() => setTab('cuenta')} className="shrink-0 rounded-xl bg-brand-500 px-3 py-1.5 text-[12.5px] font-bold text-brand-tinta">
              {tx('Quitar el tope')}
            </button>
          </div>
        )}
        {tab === 'hoy' && saldoRegalo && (
          <div data-testid="aviso-regalo" className="mx-auto mb-3 flex max-w-md items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/[.12] px-3.5 py-3">
            <span aria-hidden="true" className="text-[24px] leading-none">🎁</span>
            <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-emerald-100">
              {tx('Te hemos regalado {euros}: ya están en tu cartera.', { euros: eurosRef(saldoRegalo.cent, locale()) })}
            </p>
            <button onClick={() => { verRegalo(); setTab('cuenta') }} className="shrink-0 rounded-xl bg-emerald-700 px-3 py-1.5 text-[13px] font-bold text-white">{tx('Verlo')}</button>
            <button onClick={verRegalo} aria-label={tx('Cerrar')} className="shrink-0 p-1 text-emerald-200/80"><X size={17} /></button>
          </div>
        )}
        {tab === 'hoy' && !bloqueado && <OpinionRuta />}
        {tab === 'hoy' && <InstalarApp />}
        {tab === 'hoy' && !esSuplantacion() && !bonoPendiente && (billing?.pais || 'es') !== 'cn' && (
          <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/[.08] px-3.5 py-2.5">
            <button onClick={() => setTab('cuenta')} className="min-w-0 text-left text-[13px] leading-snug text-emerald-100">
              💶 {tx('Gana {euros} por cada compañero que la use.', { euros: eurosRef(porInvitado, locale()) })}{promoHasta && <span className="ml-1 rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-[11px] font-bold text-emerald-100">{tx('Promo hasta el {fecha}', { fecha: fechaRefPromo(locale(), promoHasta) })}</span>} <span className="font-semibold underline">{tx('Mi cartera')}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-emerald-200/80">{tx('Se valida cuando complete 20 entregas reales en 2 días, no por registrarse.')}</span>
            </button>
            <button onClick={invitar} className="shrink-0 rounded-xl bg-emerald-700 px-3 py-1.5 text-[12.5px] font-bold text-white">{tx('Invitar')}</button>
          </div>
        )}
        {tab === 'hoy' && !esSuplantacion() && <AvisoManana toast={toast} />}
        {(tab === 'hoy' || tab === 'ajustes') && bloqueado
          ? <Muro billing={billing} toast={toast} recargar={recargar} irACuenta={() => setTab('cuenta')} />
          : <>
            {tab === 'hoy' && <MiRuta embebido onBack={() => {}} />}
            {tab === 'ajustes' && <div className="mx-auto max-w-md"><Ajustes conductores={[]} toast={toast} autonomo /></div>}
          </>}
        {tab === 'historial' && <Historial />}
        {tab === 'cuenta' && <Cuenta billing={billing} recargar={recargar} toast={toast} resaltarRegalo={regaloNuevo} merc={merc} />}
      </div>
      <nav className="ruta-pestanas fixed inset-x-0 bottom-0 z-40 border-t border-dark-800 bg-dark-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label={tx('Secciones')}>
        <div className="mx-auto grid max-w-md grid-cols-4">
          {PESTANAS.map(([k, t, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-1 pb-2 pt-2 text-[11px] font-semibold transition-colors ${tab === k ? 'text-brand-200' : 'text-dark-500'}`}
              aria-current={tab === k ? 'page' : undefined}>
              {/* La pestaña activa, en una píldora: se ve de un vistazo dónde estás. */}
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${tab === k ? 'bg-brand-500/20' : ''}`}>
                <I size={20} strokeWidth={tab === k ? 2.4 : 2} />
              </span>
              {tx(t)}
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}

/* EL HISTORIAL, DE VERDAD (10-10-2026). Dani: «poder ver el historial de los
   otros días, pero verlo realmente». Antes era un desplegable con una línea por
   parada. Ahora cada día se abre en su pantalla: cuánto se hizo y en qué horas,
   cada parada con su hora de entrega, dónde se dejó y su prueba (foto, firma),
   y lo que no se entregó se puede pasar a hoy. También cualquier otro día. */
function Historial() {
  const toast = useToast()
  const [est, setEst] = useState(null)
  const [dia, setDia] = useState(null)
  const [otro, setOtro] = useState('')
  // La tarifa («Mi dinero hoy») para lo ganado en la semana, y los días que se guardan los datos de los clientes.
  const [ajustes, setAjustes] = useState(null)
  useEffect(() => { getRepartoAjustes().then(({ data }) => setAjustes(data || {})).catch(() => setAjustes({})) }, [])
  const cargarEst = useCallback(() => {
    setEst(null)
    getRepartoEstadisticas(30).then(({ data }) => setEst(data)).catch(() => setEst({ por_dia: [], error: true }))
  }, [])
  useEffect(() => { cargarEst() }, [cargarEst])
  if (dia) return <DiaHistorial fecha={dia} onVolver={() => setDia(null)} toast={toast} />
  if (!est) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div>
  const dias = lista(est.por_dia).filter((d) => d.total > 0).reverse()
  const hoy = hoyLocal()
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-[22px] font-bold text-dark-50">{tx('Historial')}</h1>
      {est.error ? (
        <div className="mb-4 mt-2 rounded-xl border border-dashed border-dark-700 px-4 py-6 text-center">
          <p className="text-[13px] text-dark-400">{tx('No se pudo cargar el historial.')}</p>
          <button type="button" onClick={cargarEst} className="mt-3 rounded-xl border border-dark-600 px-4 py-2 text-[13.5px] font-semibold text-dark-100">{tx('Reintentar')}</button>
        </div>
      ) : (<>
        <p className="mb-4 text-[12.5px] text-dark-400">
          {tx('Últimos 30 días: {total} paradas, {ok} entregadas', { total: est.total || 0, ok: est.entregados || 0 })}
          {est.tasa_entrega != null ? ` ${tx('({p} % a la primera)', { p: est.tasa_entrega })}` : ''}.
        </p>
        {dias.length === 0 && <p className="rounded-xl border border-dashed border-dark-700 px-4 py-8 text-center text-[13px] text-dark-400">{tx('Aún no hay repartos. Hoy empieza en «Hoy».')}</p>}
        {dias.length > 0 && <ResumenSemana porDia={lista(est.por_dia)} ajustes={ajustes} />}
      </>)}
      <div className="flex flex-col gap-2">
        {dias.map((d) => (
          <button key={d.fecha} onClick={() => setDia(d.fecha)}
            className="flex items-center gap-3 rounded-2xl border border-dark-700 bg-dark-900 p-3.5 text-left active:bg-dark-800">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-dark-50">{d.fecha === hoy ? tx('Hoy') : fechaLarga(d.fecha)}</span>
              <span className="mt-0.5 block text-[12.5px] text-dark-400">
                {tx('{ok}/{total} entregados', { ok: d.entregados, total: d.total })}
                {d.fallidos ? <span className="text-red-300"> · {tx('{n} no', { n: d.fallidos })}</span> : null}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-dark-500" />
          </button>
        ))}
      </div>
      <label className="mt-5 block text-[12.5px] text-dark-400">
        {tx('Ver otro día')}
        <span className="mt-1 flex gap-2">
          <input type="date" max={hoy} value={otro} onChange={(e) => setOtro(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-dark-700 bg-dark-900 px-3 py-2.5 text-[15px] text-dark-50" />
          <button type="button" disabled={!otro} onClick={() => setDia(otro)}
            className="shrink-0 rounded-xl border border-dark-600 px-4 text-[14px] font-semibold text-dark-100 disabled:opacity-40">{tx('Ver')}</button>
        </span>
      </label>
      <ParaGestoria diasConservar={ajustes?.dias_conservar} toast={toast} />
    </div>
  )
}

/* LA SEMANA DE UN VISTAZO (17-10-2026): las entregas de cada uno de los últimos 7 días en barras, frente a la semana
   anterior, y lo ganado si tiene puesta su tarifa. Sale de /reparto/estadisticas (sin datos de clientes). */
function ResumenSemana({ porDia, ajustes }) {
  const ultimos = porDia.slice(-7)
  const antes = porDia.slice(-14, -7)
  const suma = (l) => l.reduce((a, d) => a + (d.entregados || 0), 0)
  const semana = suma(ultimos)
  const anterior = suma(antes)
  const tope = Math.max(1, ...ultimos.map((d) => d.entregados || 0))
  const pagoParada = Number(ajustes?.pago_parada) || 0
  const pagoDia = Number(ajustes?.pago_dia) || 0
  const conTarifa = pagoParada > 0 || pagoDia > 0
  const ganado = (semana * pagoParada + ultimos.filter((d) => d.entregados > 0).length * pagoDia) / 100
  const dia = (f) => { try { return new Date(`${f}T12:00:00`).toLocaleDateString(locale(), { weekday: 'narrow' }) } catch { return '' } }
  return (
    <section data-testid="resumen-semana" aria-label={tx('Esta semana')} className="mb-4 rounded-2xl border border-dark-700 bg-dark-900 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-dark-400">{tx('Esta semana')}</p>
        <p className="text-[12.5px] text-dark-400">{tx('la anterior: {n}', { n: anterior })}</p>
      </div>
      <p className="mt-1 text-[24px] font-extrabold leading-none text-dark-50 tabular-nums">{tx('{n} entregas', { n: semana })}</p>
      {conTarifa && <p className="mt-1 text-[13px] font-semibold text-emerald-300">{tx('Ganado ≈ {euros}', { euros: importe(ganado) })}</p>}
      <div className="mt-3 grid grid-cols-7 items-end gap-1.5" style={{ height: 96 }} role="img"
        aria-label={ultimos.map((d) => `${dia(d.fecha)} ${d.entregados || 0}`).join(', ')}>
        {ultimos.map((d) => (
          <div key={d.fecha} className="flex h-full flex-col items-center justify-end gap-1">
            <span className="text-[10.5px] font-semibold tabular-nums text-dark-400">{d.entregados || ''}</span>
            <span className="w-full rounded-t-md bg-brand-500" style={{ height: `${Math.round(((d.entregados || 0) / tope) * 64)}px`, minHeight: d.entregados ? 4 : 2, opacity: d.entregados ? 1 : 0.25 }} />
            <span className="text-[11px] font-semibold uppercase text-dark-400">{dia(d.fecha)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* EL MES PARA LA GESTORÍA (17-10-2026): todas las entregas del mes en un Excel (CSV) con los totales y lo ganado
   (GET /reparto/entregas-mes). En el móvil se comparte directamente (WhatsApp, correo…); si no, se descarga. */
function ParaGestoria({ diasConservar, toast }) {
  const meses = useMemo(() => {
    const ahora = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])
  const [mes, setMes] = useState(meses[0])
  const [ocupado, setOcupado] = useState(false)
  const nombreMes = (m) => {
    try { const s = new Date(`${m}-15T12:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) } catch { return m }
  }
  async function descargar() {
    setOcupado(true)
    medirAccion('gestoria_descargar')
    try {
      const { data } = await getRepartoEntregasMes(mes)
      const nombre = `entregas-${mes}.csv`
      const archivo = new File([data], nombre, { type: 'text/csv' })
      if (navigator.canShare?.({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: nombre }); return } catch (e) { if (e?.name === 'AbortError') return }
      }
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = nombre
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch { toast?.error?.(tx('No se pudo preparar el archivo')) } finally { setOcupado(false) }
  }
  return (
    <section aria-label={tx('Para tu gestoría')} className="mt-5 rounded-2xl border border-dark-700 bg-dark-900 p-4">
      <p className="flex items-center gap-2 text-[15px] font-bold text-dark-50"><FileSpreadsheet size={17} className="text-brand-300" /> {tx('Para tu gestoría')}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-dark-400">{tx('Todas las entregas del mes en un Excel: fecha, hora, cliente, dirección y lo cobrado, con los totales y lo ganado.')}</p>
      <div className="mt-3 flex gap-2">
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label={tx('Mes')}
          className="min-w-0 flex-1 rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[15px] text-dark-50">
          {meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
        <button type="button" onClick={descargar} disabled={ocupado}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-[14px] font-bold text-brand-tinta disabled:opacity-60">
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} {tx('Descargar')}
        </button>
      </div>
      {diasConservar ? (
        <p className="mt-2 text-[11.5px] leading-snug text-dark-500">
          {tx('Los datos de los clientes se borran a los {n} días (lo cambias en Ajustes): de lo más antiguo salen la fecha, la hora, el estado y lo cobrado.', { n: diasConservar })}
        </p>
      ) : null}
    </section>
  )
}

const horaDe = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}
const fechaLarga = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return Number.isNaN(d.getTime()) ? fechaEs(f) : d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
}
const DONDE_TXT = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }

function DiaHistorial({ fecha, onVolver, toast }) {
  const [datos, setDatos] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [prueba, setPrueba] = useState(null)
  const [moviendo, setMoviendo] = useState('')
  const cargar = useCallback(() => getRepartoPedidos(fecha).then(({ data }) => setDatos(data)).catch(() => setDatos({ pedidos: [] })), [fecha])
  useEffect(() => { cargar() }, [cargar])
  const hoy = hoyLocal()
  const ps = lista(datos?.pedidos).slice().sort((a, b) => (a.cerrado_en || 'z').localeCompare(b.cerrado_en || 'z') || (a.orden ?? 1e9) - (b.orden ?? 1e9))
  const ruta = lista(datos?.conductores)[0]?.ruta
  const ok = ps.filter((p) => p.estado === 'entregado')
  const no = ps.filter((p) => p.estado === 'fallido')
  const sinHacer = ps.filter((p) => !['entregado', 'fallido'].includes(p.estado))
  const cobrado = ps.reduce((a, p) => a + (Number(p.cobrado_importe) || 0), 0)
  const horas = ps.map((p) => p.cerrado_en).filter(Boolean).sort()
  const borrados = ps.some((p) => p.anonimizado)

  async function aHoy(p) {
    setMoviendo(p.id)
    try {
      await editarRepartoPedido(p.id, { fecha: hoy })
      toast.success(tx('Pasado a tu ruta de hoy'))
      cargar()
    } catch (e) { toast.error(txError(e, 'No se pudo guardar')) } finally { setMoviendo('') }
  }
  async function verPrueba(p) {
    try { const { data } = await fotoEntrega(p.id); setPrueba({ ...data, cliente: p.cliente || p.direccion }) } catch (e) { toast.error(txError(e, 'No se pudo abrir la foto')) }
  }

  return (
    <div className="mx-auto max-w-md">
      <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-300"><ArrowLeft size={16} /> {tx('Historial')}</button>
      <h1 className="font-display text-[22px] font-bold capitalize text-dark-50">{fecha === hoy ? tx('Hoy') : fechaLarga(fecha)}</h1>
      {!datos ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div> : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-dark-800 bg-dark-900 py-2.5"><p className="text-[20px] font-bold text-emerald-300">{ok.length}</p><p className="text-[11px] text-dark-400">{tx('Entregados')}</p></div>
            <div className="rounded-2xl border border-dark-800 bg-dark-900 py-2.5"><p className={`text-[20px] font-bold ${no.length ? 'text-red-300' : 'text-dark-300'}`}>{no.length}</p><p className="text-[11px] text-dark-400">{tx('No entregados')}</p></div>
            <div className="rounded-2xl border border-dark-800 bg-dark-900 py-2.5"><p className="text-[20px] font-bold text-dark-50">{ps.length}</p><p className="text-[11px] text-dark-400">{tx('Paradas')}</p></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-dark-300">
            {horas.length > 0 && <span className="flex items-center gap-1"><Clock size={13} /> {tx('De {a} a {b}', { a: horaDe(horas[0]), b: horaDe(horas[horas.length - 1]) })}</span>}
            {ruta?.km ? <span>{ruta.km} km</span> : null}
            {cobrado > 0 && <span className="flex items-center gap-1 text-emerald-300"><Euro size={13} /> {tx('{importe} cobrados', { importe: euros(cobrado) })}</span>}
          </div>
          {borrados && <p className="mt-3 rounded-xl bg-dark-900 px-3 py-2 text-[12px] text-dark-400">{tx('Los datos de los clientes de este día ya se borraron (privacidad): quedan los números.')}</p>}
          {ps.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-dark-700 px-4 py-8 text-center text-[13px] text-dark-400">{tx('Ese día no hay paradas.')}</p>}
          <ul className="mt-4 flex flex-col gap-1.5">
            {[...no, ...sinHacer, ...ok].map((p) => {
              const abierto = abierta === p.id
              const pendiente = p.estado !== 'entregado' && fecha < hoy
              return (
                <li key={p.id} className={`rounded-xl border ${p.estado === 'fallido' ? 'border-red-500/30 bg-red-500/[.05]' : 'border-dark-800 bg-dark-900'}`}>
                  <button onClick={() => setAbierta(abierto ? null : p.id)} aria-expanded={abierto} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
                    {p.estado === 'entregado' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                      : p.estado === 'fallido' ? <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                        : <Package size={15} className="mt-0.5 shrink-0 text-dark-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-dark-100">{p.cliente || p.direccion || tx('Pedido')}</span>
                      <span className="block truncate text-[12px] text-dark-400">
                        {p.estado === 'entregado' ? `${tx('Entregado')} ${horaDe(p.cerrado_en)}` : p.estado === 'fallido' ? `${tx('No entregado')}${p.motivo ? ` · ${tx(p.motivo)}` : ''}` : tx('Sin hacer')}
                        {p.entrega_donde ? ` · ${tx(DONDE_TXT[p.entrega_donde] || '')}` : ''}
                      </span>
                    </span>
                    <ChevronDown size={16} className={`mt-0.5 shrink-0 text-dark-500 ${abierto ? 'rotate-180' : ''}`} />
                  </button>
                  {abierto && (
                    <div className="space-y-1.5 border-t border-dark-800 px-3 py-2.5 text-[12.5px] text-dark-300">
                      {p.direccion && p.cliente && <p className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0" /> {p.direccion}</p>}
                      {p.telefono && <p className="flex items-center gap-1.5"><Phone size={13} /> <a href={`tel:${p.telefono}`} className="text-brand-300">{p.telefono}</a></p>}
                      {p.contenido && <p className="flex items-start gap-1.5"><Package size={13} className="mt-0.5 shrink-0" /> {p.contenido}</p>}
                      {p.entrega_recibe && <p>{tx('Lo recoge: {nombre}', { nombre: p.entrega_recibe })}</p>}
                      {p.entrega_nota && <p>«{p.entrega_nota}»</p>}
                      {p.cobrado_importe ? <p className="text-emerald-300">{euros(p.cobrado_importe)} · {p.cobrado_metodo || ''}</p> : null}
                      {p.reintento > 0 && <p>{tx('{n}º intento', { n: p.reintento + 1 })}</p>}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {p.tiene_foto && (
                          <button onClick={() => verPrueba(p)} className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2.5 py-1.5 font-semibold text-dark-100">
                            <Camera size={13} /> {tx('Ver prueba de entrega')}
                          </button>
                        )}
                        {pendiente && !p.anonimizado && (
                          <button onClick={() => aHoy(p)} disabled={moviendo === p.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 font-bold text-brand-tinta disabled:opacity-50">
                            {moviendo === p.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} {tx('Pasar a hoy')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {prueba && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" role="dialog" aria-modal="true" aria-label={tx('Prueba de entrega')}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-dark-700 bg-dark-950 p-4 pb-8">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-[16px] font-bold text-dark-50">{tx('Prueba de entrega')}</h2>
              <button onClick={() => setPrueba(null)} className="rounded p-1 text-dark-400" aria-label={tx('Cerrar')}><XCircle size={18} /></button>
            </div>
            <p className="mb-2 text-[13px] text-dark-300">{prueba.cliente}{prueba.cuando ? ` · ${horaDe(prueba.cuando)}` : ''}</p>
            {prueba.foto && <img src={prueba.foto} alt={tx('Foto de la entrega')} className="w-full rounded-xl" />}
            {(prueba.donde || prueba.recibe) && <p className="mt-2 text-[13px] text-dark-200">{[prueba.donde && tx(prueba.donde), prueba.recibe && tx('Lo recoge: {nombre}', { nombre: prueba.recibe })].filter(Boolean).join(' · ')}</p>}
            {prueba.firma && <img src={prueba.firma} alt={tx('Firma')} className="mt-2 w-full max-w-xs rounded-lg bg-white" />}
            {prueba.nota && <p className="mt-2 text-[13px] text-dark-200">«{prueba.nota}»</p>}
          </div>
        </div>
      )}
    </div>
  )
}
