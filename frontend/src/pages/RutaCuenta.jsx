/* diseño compacto */
import { useEffect, useState } from 'react'
import {
  Loader2, LogOut, Gift, CreditCard, Check, Copy, MessageCircle, Mail, Sparkles, ShieldCheck, CalendarClock, Crown, KeyRound, Wallet, QrCode, Store, ChevronRight,
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  stripeSuscripcion, stripePortal, stripeCambiarPlan, comprarRegalo, misRegalos, canjearRegalo, playVerificar,
  getMe, setMyEmail, changeMyPassword, pedirEnlaceClave, borrarMiCuenta,
} from '../panel/api'
import { servicioPlay, detallesPlay, pagarConPlay } from '../lib/playBilling'
import { evento, apuntarParaLaVuelta } from '../lib/metaPixel'
import { getAdmin, logout, esSuplantacion } from '../panel/auth'
import { MARCA, origen } from '../marca'
import { enAppPlay } from '../lib/enApp'
import { esAppIOS } from '../lib/plataforma'
import { lista } from '../lib/lista'
import { tx, useIdioma, locale, IDIOMAS, idioma, cambiarIdioma, txError } from '../lib/idioma'
import { refCentActual, refPromoActiva, REF_PROMO_HASTA, REF_PROMO_CENT, fechaRefPromo } from '../lib/precios'
import { importeEn } from '../lib/region'
import { invitar, enlaceInvitar } from '../lib/compartir'
import { getReferidos, retirarCartera } from '../services/api'
import { IdeaRuta } from './OpinionRuta'
import { AvisoCuenta } from './AvisoManana'
import { Cabecera, Boton, Etiqueta } from './driver/piezas'

/* ── LA CUENTA DE QUIEN REPARTE SOLO (04-10-2026) ────────────────────────────
   Dani: «quiero mejorarla ya, o la suscripción de un año, o regalársela a
   alguien por email o WhatsApp, y que en la prueba metan la tarjeta, se les
   cobre 0 y al día 7 se les cobre si no cancelan». Todo con Stripe en la web.

   Dentro de la app de Play no hay botones de pago: Google obliga a cobrar con
   su sistema (Play Billing). Allí se ve el estado y se puede canjear un
   código de regalo. Los textos dicen exactamente lo que hace Stripe: nada de
   «te avisaremos» que no esté hecho. */

const euros = (n) => `${Number(n || 0).toFixed(2).replace('.', ',').replace(',00', '')} €`
/* El plan, en la moneda de la cuenta (30-10-2026): /org/billing manda `precios` con su `moneda` («$9.99» en EE. UU.).
   Los regalos y el saldo de «invita y gana» siguen en euros: son de España. */
let monedaPlan = 'EUR'
const enMoneda = (n) => importeEn(n, monedaPlan)
const fecha = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
}
const bonito = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '')
// «AHORRA» → «Ahorra»: sin mayúsculas sostenidas (§1.3, regla 9); la clave y sus traducciones no cambian.
const enFrase = (t) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : t)

export function Cuenta({ billing, recargar, toast, resaltarRegalo, merc }) {
  const lang = useIdioma()
  const admin = getAdmin()
  const enApp = enAppPlay()
  // En la app de iPhone no se vende nada (Apple exige su pago dentro de la app, regla 3.1.1): ni suscribirse, ni regalos,
  // ni el portal de la tarjeta; el plan se lleva desde la web. Ver docs/APP_STORE.md.
  const enIOS = esAppIOS()
  const b = billing || {}
  const precios = b.precios || { mensual: 9.99, anual: 99 }
  monedaPlan = precios.moneda || 'EUR'
  // Desde «entrar como» se VE el plan, pero pagar, cambiar o dar de baja es cosa del cliente
  // (el servidor lo rechaza): no se enseñan botones que solo pueden fallar.
  const suplantando = esSuplantacion()
  // Cerrar sesión pide confirmación: quien probó la app en Google Play (20-10-2026) salía sin querer.
  const [salir, setSalir] = useState(false)
  return (
    <div className="mx-auto max-w-md">
      {/* La cabecera de la pestaña (diseño compacto, 07-11-2026, §5.11): «Tu cuenta» en «titulo» y el nombre al lado. */}
      <Cabecera titulo={tx('Tu cuenta')} subtitulo={admin?.name || ''} fija className="-mx-4 mb-3" />
      {!billing ? <Loader2 className="mx-auto my-10 animate-spin text-dark-400" /> : suplantando ? <Estado b={b} precios={precios} /> : (
        <>
          <Estado b={b} precios={precios} />
          {!enApp && !enIOS && b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled'
            ? <BotonPortal toast={toast} texto={tx('Revisar mi tarjeta y pagar')} principal />
            // Durante la promoción no hay nada que pagar: no se ofrece suscribirse.
            : !enApp && !enIOS && !b.suscrito && !conPlay(b) && !b.promo?.activa && <Suscribirse b={b} precios={precios} toast={toast} />}
          {enApp && !b.suscrito && !conPlay(b) && !b.promo?.activa && b.play?.listo && <PagarConPlay b={b} toast={toast} recargar={recargar} />}
          {conPlay(b) && <GestionarPlay b={b} />}
          {!enApp && !enIOS && b.suscrito && <Gestionar b={b} precios={precios} toast={toast} recargar={recargar} />}
          <Canjear toast={toast} recargar={recargar} />
          {!enApp && !enIOS && b.regalos && <Regalar precios={b.regalos} toast={toast} resaltar={resaltarRegalo} />}
        </>
      )}
      {!suplantando && <Invitar toast={toast} />}
      {merc && (
        <button type="button" onClick={() => window.dispatchEvent(new Event('fds-abrir-mercadillo'))}
          className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-xl bg-dark-900 px-3 py-2 text-left">
          <Store size={24} className="shrink-0 text-ruta-marca" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-nombre text-dark-50">Mercadillo de repartidores</span>
            <span className="block text-sec text-dark-400">
              {merc.sin_leer > 0 ? `Tienes ${merc.sin_leer} mensaje${merc.sin_leer > 1 ? 's' : ''} sin leer` : 'Vende lo que no uses o encuentra algo para la furgoneta'}
            </span>
          </span>
          {merc.sin_leer > 0 && <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-ruta-peligro px-2 text-etiqueta text-white">{merc.sin_leer}</span>}
          <ChevronRight size={18} className="shrink-0 text-dark-400" aria-hidden="true" />
        </button>
      )}
      <Acceso toast={toast} soloVer={suplantando} />
      {!suplantando && <IdeaRuta />}
      {!suplantando && <AvisoCuenta toast={toast} />}
      <section className="mt-3 rounded-xl bg-dark-900 p-3">
        <label className="flex items-center justify-between gap-3 text-texto font-semibold text-dark-50">
          🌐 {tx('Idioma')}
          <select value={lang || idioma()} onChange={(e) => cambiarIdioma(e.target.value)} aria-label={tx('Idioma')}
            className="campo w-auto">
            {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </section>
      <div className="mt-3 rounded-xl bg-dark-900 p-3 text-sec text-dark-400">
        <p className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-ruta-marca" aria-hidden="true" />
          {tx('Tus datos y los de tus clientes son tuyos: la foto de la etiqueta se lee en tu móvil y los datos de los clientes se borran solos a los días que fijes en Ajustes. Los pagos los procesa Stripe: tu tarjeta no pasa por nosotros.')}</p>
        {/* Los tres enlaces, cada uno con su zona de toque de 48 (regla 7): una frase con enlaces dentro, al saltar de línea,
            deja zonas de 14 de alto. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-4">
          <a href="/privacidad" className="inline-flex min-h-12 items-center text-ruta-marca">{tx('Privacidad')}</a>
          <a href="/terminos" className="inline-flex min-h-12 items-center text-ruta-marca">{tx('Términos')}</a>
          <a href={`mailto:${MARCA.correo}`} className="inline-flex min-h-12 min-w-0 items-center break-all text-ruta-marca">{MARCA.correo}</a>
        </p>
      </div>
      {salir ? (
        <div role="group" aria-label={tx('Cerrar sesión')} className="mt-4 rounded-xl bg-dark-900 p-3">
          <p className="text-nombre text-dark-50">{tx('¿Cerrar sesión en este móvil?')}</p>
          <p className="mt-1 text-sec text-dark-400">{tx('Para volver a entrar te pedirá tu contraseña.')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton variante="principal" tono="peligro" texto={tx('Sí, cerrar sesión')} onClick={() => { logout(); window.location.href = '/empezar' }} />
            <Boton variante="normal" tono="neutro" contorno texto={tx('Cancelar')} onClick={() => setSalir(false)} autoFocus />
          </div>
        </div>
      ) : (
        <Boton variante="normal" tono="neutro" contorno icono={LogOut} texto={tx('Cerrar sesión')} onClick={() => setSalir(true)} className="mt-4 w-full" />
      )}
      {/* Borrar la cuenta desde la app (01-11-2026): Google Play y Apple lo exigen a toda app en la que se crea una
          cuenta. La app de Android lo tenía (auth/borrar-cuenta); la web, que es lo que lleva dentro la de iPhone, no:
          Apple lo graba en el vídeo de revisión. Desde «entrar como» no se enseña: el servidor lo rechazaría. */}
      {!suplantando && <BorrarMiCuenta toast={toast} />}
    </div>
  )
}

/* BORRAR MI CUENTA. Con la contraseña: la cuenta se desactiva al momento (ya no se puede entrar) y la oficina borra los
   datos en 30 días como mucho; es lo que hace el servidor, y es lo que se dice. Una cuenta de empresa no se borra desde
   aquí (el servidor contesta por qué). */
function BorrarMiCuenta({ toast }) {
  const [abierto, setAbierto] = useState(false)
  const [clave, setClave] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const borrar = async () => {
    if (!clave) return setErr(tx('Escribe tu contraseña actual.'))
    setBusy(true); setErr('')
    try {
      await borrarMiCuenta(clave)
      toast?.success?.(tx('Cuenta borrada. Tus datos se eliminan en 30 días como mucho.'))
      logout(); window.location.href = '/empezar'
    } catch (e) {
      setErr(txError(e, tx('No se ha podido borrar la cuenta. Inténtalo otra vez.')))
      setBusy(false)
    }
  }
  if (!abierto) {
    return (
      <Boton variante="texto" tono="peligro" texto={tx('Borrar mi cuenta')} onClick={() => setAbierto(true)} className="mt-3 w-full" />
    )
  }
  return (
    <div role="group" aria-label={tx('Borrar mi cuenta')} className="mt-3 rounded-xl border border-ruta-peligro/60 bg-dark-900 p-3">
      <p className="text-nombre text-dark-50">{tx('¿Borrar tu cuenta?')}</p>
      <p className="mt-1 text-sec text-dark-400">
        {tx('Dejarás de poder entrar al momento y tus datos (paradas, clientes, historial) se eliminan en 30 días como mucho. No se puede deshacer.')}
      </p>
      <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password"
        placeholder={tx('Tu contraseña actual')} aria-label={tx('Tu contraseña actual')}
        className="campo mt-3" />
      {err && <p className="mt-2 text-sec text-ruta-peligro-texto" role="alert">{err}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Boton variante="principal" tono="peligro" texto={tx('Sí, borrar mi cuenta')} cargando={busy} onClick={borrar} />
        <Boton variante="normal" tono="neutro" contorno texto={tx('Cancelar')} onClick={() => { setAbierto(false); setClave(''); setErr('') }} />
      </div>
    </div>
  )
}

/* TU ACCESO (06-10-2026). Dani: «le falta para vincular el email y para cambiar contraseña,
   o cuál es mi usuario». El repartidor entra con el correo del alta, pero la pantalla no lo
   decía. Aquí: con qué entra, cambiar el correo (si entra con él, el usuario cambia con él y
   se pide la contraseña), cambiar la contraseña y, si no recuerda la actual, un enlace al
   correo. Desde «entrar como» solo se ve. */
function Acceso({ toast, soloVer }) {
  useIdioma()
  const [me, setMe] = useState(null)
  const [abierto, setAbierto] = useState('')            // '' | 'correo' | 'clave'
  const [correo, setCorreo] = useState('')
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [ver, setVer] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { getMe().then(({ data }) => setMe(data || {})).catch(() => setMe({})) }, [])

  const usuario = me?.username || ''
  const email = me?.email || ''
  const entraConCorreo = !!usuario && usuario.toLowerCase() === email.toLowerCase()
  const cerrar = () => { setAbierto(''); setCorreo(''); setActual(''); setNueva(''); setVer(false); setErr('') }

  async function guardarCorreo(e) {
    e.preventDefault(); setErr('')
    const c = correo.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return setErr(tx('Introduce un email válido.'))
    if (entraConCorreo && !actual) return setErr(tx('Escribe tu contraseña actual.'))
    setOcupado(true)
    try {
      const { data } = await setMyEmail(c, entraConCorreo ? { tambien_usuario: true, password: actual } : {})
      setMe((m) => ({ ...m, email: data?.email || c, username: data?.username || m?.username }))
      toast?.success?.(entraConCorreo ? tx('Hecho. Desde ahora entras con {correo}.', { correo: c }) : tx('Correo guardado.'))
      cerrar()
    } catch (e2) { setErr(txError(e2, 'No se pudo guardar el correo.')) }
    setOcupado(false)
  }

  async function guardarClave(e) {
    e.preventDefault(); setErr('')
    if (!actual) return setErr(tx('Escribe tu contraseña actual.'))
    if (nueva.length < 8) return setErr(tx('La contraseña debe tener al menos 8 caracteres.'))
    setOcupado(true)
    try {
      await changeMyPassword(actual, nueva)
      toast?.success?.(tx('Contraseña cambiada.'))
      cerrar()
    } catch (e2) { setErr(txError(e2, 'No se pudo cambiar la contraseña.')) }
    setOcupado(false)
  }

  async function enlace() {
    setOcupado(true); setErr('')
    try {
      await pedirEnlaceClave(email)
      toast?.success?.(tx('Te hemos mandado un enlace a {correo} para crear una contraseña nueva. Si no llega, mira en spam.', { correo: email }))
      cerrar()
    } catch { setErr(tx('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.')) }
    setOcupado(false)
  }

  const campo = 'campo'
  const pie = (
    <>
      {err && <p role="alert" className="text-texto text-ruta-peligro-texto">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="normal" tono="neutro" contorno texto={tx('Cancelar')} onClick={cerrar} />
        <Boton variante="principal" tono="marca" type="submit" texto={tx('Guardar')} cargando={ocupado} />
      </div>
    </>
  )
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3" aria-labelledby="acceso-titulo">
      <h2 id="acceso-titulo" className="flex items-center gap-2 text-nombre text-dark-50"><KeyRound size={18} className="text-ruta-marca" aria-hidden="true" /> {tx('Tu acceso')}</h2>
      <dl className="mt-2 space-y-1 text-texto">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-dark-400">{tx('Entras con')}</dt>
          <dd className="min-w-0 select-all break-all text-right font-semibold text-dark-50">{me ? usuario || '—' : '…'}</dd>
        </div>
        {me && !entraConCorreo && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-dark-400">{tx('Correo')}</dt>
            <dd className="min-w-0 break-all text-right text-dark-50">{email || tx('Sin correo')}</dd>
          </div>
        )}
      </dl>

      {!soloVer && me && !abierto && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Boton variante="normal" tono="neutro" contorno texto={tx('Cambiar correo')} onClick={() => setAbierto('correo')} />
          <Boton variante="normal" tono="neutro" contorno texto={tx('Cambiar contraseña')} onClick={() => setAbierto('clave')} />
        </div>
      )}

      {abierto === 'correo' && (
        <form onSubmit={guardarCorreo} noValidate className="mt-3 space-y-2">
          <input id="acceso-correo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={correo}
            onChange={(e) => setCorreo(e.target.value)} placeholder={tx('Nuevo correo')} aria-label={tx('Nuevo correo')} className={campo} />
          {entraConCorreo && <>
            <input id="acceso-clave-correo" type="password" autoComplete="current-password" value={actual}
              onChange={(e) => setActual(e.target.value)} placeholder={tx('Contraseña actual')} aria-label={tx('Contraseña actual')} className={campo} />
            <p className="text-sec text-dark-400">{tx('Entrarás con el correo nuevo.')}</p>
          </>}
          {pie}
        </form>
      )}

      {abierto === 'clave' && (
        <form onSubmit={guardarClave} noValidate className="mt-3 space-y-2">
          <input id="acceso-clave-actual" type={ver ? 'text' : 'password'} autoComplete="current-password" value={actual}
            onChange={(e) => setActual(e.target.value)} placeholder={tx('Contraseña actual')} aria-label={tx('Contraseña actual')} className={campo} />
          <input id="acceso-clave-nueva" type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva}
            onChange={(e) => setNueva(e.target.value)} placeholder={tx('Nueva contraseña')} aria-label={tx('Nueva contraseña')} className={campo} />
          <Boton variante="texto" tono="marca" texto={ver ? tx('Ocultar contraseña') : tx('Mostrar contraseña')} onClick={() => setVer((v) => !v)} className="-ml-2" />
          {pie}
          {email && (
            <Boton variante="texto" tono="marca" texto={tx('No recuerdo la actual: mándame un enlace al correo')} onClick={enlace} disabled={ocupado} className="w-full" />
          )}
        </form>
      )}
    </section>
  )
}

/* La tarjeta del plan: en qué punto estás y qué va a pasar, con fechas. */
function Estado({ b, precios }) {
  const intervalo = b.stripe_intervalo === 'anual' ? `${enMoneda(precios.anual)}${tx('/año')}` : `${enMoneda(precios.mensual)}${tx('/mes')}`
  let chip = [tx('Prueba gratis'), 'marca']
  let linea = ''
  if (b.status === 'trial') {
    linea = b.falta_tarjeta
      ? tx('Añade tu tarjeta para empezar los 7 días gratis. Hoy no se cobra nada.')
      : b.required ? tx('Tu prueba gratis ha terminado.')
        : b.days_left === 1 ? tx('Queda 1 día: hasta el {fecha}.', { fecha: fecha(b.trial_ends) }) : tx('Quedan {n} días: hasta el {fecha}.', { n: b.days_left, fecha: fecha(b.trial_ends) })
    if (b.required) chip = [tx('Prueba terminada'), 'peligro']
  } else if (b.status === 'vencido') {
    chip = [tx('Regalo terminado'), 'peligro']; linea = tx('Tu regalo acabó el {fecha}.', { fecha: fecha(b.pagado_hasta) })
  } else if (b.status === 'active' && b.pago_proveedor === 'regalo') {
    chip = [tx('Regalo'), 'marca']; linea = tx('Pagado hasta el {fecha}. Sin cobros hasta entonces.', { fecha: fecha(b.pagado_hasta) })
  } else if (conPlay(b)) {
    const p = b.play || {}
    chip = p.en_prueba ? [tx('Prueba con Google Play'), 'ok'] : [tx('Suscrito con Google Play'), 'ok']
    linea = p.renueva
      ? `${p.en_prueba ? tx('Primer cobro el {fecha}, con Google Play.', { fecha: fecha(p.hasta) }) : tx('Próximo cobro el {fecha}, con Google Play.', { fecha: fecha(p.hasta) })}${p.en_prueba ? ` ${tx('Si cancelas antes, no se cobra nada.')}` : ''}`
      : tx('Cancelada: la puedes usar hasta el {fecha} y no se volverá a cobrar.', { fecha: fecha(p.hasta) })
  } else if (b.status === 'vencido_play') {
    chip = [tx('Terminada'), 'peligro']; linea = tx('Tu suscripción de Google Play ha terminado.')
  } else if (b.suscrito && b.cancela_al_final) {
    chip = [tx('Cancelada'), 'aviso']; linea = tx('La puedes usar hasta el {fecha} y no se volverá a cobrar.', { fecha: fecha(b.stripe_proximo_cobro) })
  } else if (b.suscrito && b.stripe_status === 'trialing') {
    chip = [tx('Prueba con tarjeta'), 'ok']
    linea = b.stripe_proximo_cobro ? tx('Primer cobro el {fecha}: {precio}. Si cancelas antes, no se cobra nada.', { fecha: fecha(b.stripe_proximo_cobro), precio: intervalo }) : tx('Primer cobro al acabar la prueba.')
  } else if (b.suscrito) {
    chip = [tx('Suscrito'), 'ok']
    linea = `${b.stripe_intervalo === 'anual' ? tx('Plan anual') : tx('Plan mensual')}: ${intervalo}.${b.stripe_proximo_cobro ? ` ${tx('Próximo cobro el {fecha}.', { fecha: fecha(b.stripe_proximo_cobro) })}` : ''}`
  } else if (b.status === 'suspended') {
    chip = [tx('Pausada'), 'peligro']; linea = tx('Hay un pago pendiente. Revisa tu tarjeta.')
  } else if (b.status === 'active') {
    chip = [tx('Activa'), 'ok']
  }
  // PLAN GRATIS (10-10-2026): sin pagar se sigue repartiendo con tope; en la prueba se avisa de qué viene después.
  const g = b.gratis
  if (g?.activo) {
    chip = [tx('Plan gratis'), 'marca']
    linea = `${linea ? `${linea} ` : ''}${tx('Sigues gratis con hasta {n} paradas nuevas al día. Suscríbete para no tener tope.', { n: g.tope })}`
  } else if (g && b.status === 'trial' && !b.falta_tarjeta) {
    linea = `${linea ? `${linea} ` : ''}${tx('Después sigues gratis con hasta {n} paradas al día.', { n: g.tope })}`
  }
  // LA PROMOCIÓN (10-10-2026): gratis y sin límite hasta una fecha; ni prueba ni cobros que contar.
  if (b.promo?.activa && !b.suscrito && !conPlay(b) && b.pago_proveedor !== 'regalo') {
    chip = [tx('Gratis sin límite'), 'ok']
    linea = tx('Hasta el {fecha} no tienes tope de paradas ni pagas nada. Después, gratis hasta {n} paradas al día, o sin tope por {precio}.', {
      fecha: fecha(`${b.promo.hasta}T12:00:00`), n: g?.tope || 15, precio: `${enMoneda(precios.mensual)}${tx('/mes')}` })
  }
  return (
    <section className="rounded-xl border-2 border-ruta-marca bg-dark-900 p-3">
      {/* El estado baja a otra línea antes de cortar el nombre del plan (a 280 px salía «Plan Repa…»). */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="flex items-center gap-2 text-nombre text-dark-50"><Crown size={20} className="shrink-0 text-ruta-marca" aria-hidden="true" /> {tx('Plan Repartidor')}</span>
        <Etiqueta texto={chip[0]} tono={chip[1]} />
      </div>
      {linea && <p className="mt-2 text-texto text-dark-50">{linea}</p>}
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sec text-dark-400">
        {['Ruta ordenada por tiempo', 'Navegación en la app', 'Escáner y foto de etiqueta', 'Cobros y prueba de entrega'].map((t) => (
          <li key={t} className="flex items-center gap-1"><Check size={14} className="shrink-0 text-ruta-ok-texto" aria-hidden="true" /> {tx(t)}</li>
        ))}
      </ul>
    </section>
  )
}

/* Elegir mensual o anual y meter la tarjeta en Stripe. Lo que se dice del
   primer cobro sale del servidor (`cobro_al_suscribir`): fin de la prueba o
   del regalo si quedan más de 48 h; si no, hoy. */
export function Suscribirse({ b, precios, toast, titulo }) {
  const [anual, setAnual] = useState(false)
  const [yendo, setYendo] = useState(false)
  const precio = anual ? tx('{precio} al año', { precio: enMoneda(precios.anual) }) : tx('{precio} al mes', { precio: enMoneda(precios.mensual) })
  async function ir() {
    setYendo(true)
    try {
      const { data } = await stripeSuscripcion('autonomo', anual)
      if (data?.url) {
        // Se mide al volver con ?pago=ok (Stripe es otra web).
        apuntarParaLaVuelta(b.cobro_al_suscribir ? 'StartTrial' : 'Subscribe',
          { value: anual ? precios.anual : precios.mensual, currency: 'EUR', predicted_ltv: anual ? precios.anual : precios.mensual * 12 })
        window.location.href = data.url; return
      }
      toast?.error?.(tx('No se pudo abrir el pago'))
    } catch (e) { toast?.error?.(txError(e, 'No se pudo abrir el pago')) }
    setYendo(false)
  }
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3">
      <h2 className="text-nombre text-dark-50">{titulo || tx('Suscribirte')}</h2>
      {/* Lo elegido va en el tinte de marca: sus letras, en la tinta del tinte (§3.6); el gris secundario no llega al 4,5:1 de noche. */}
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Plan')}>
        {[[false, tx('Mensual'), `${enMoneda(precios.mensual)}`, tx('/mes'), ''], [true, tx('Anual'), `${enMoneda(precios.anual)}`, tx('/año'), `${enMoneda(precios.anual / 12)}${tx('/mes')} · ${tx('2 meses gratis')}`]].map(([v, t, p, per, extra]) => (
          <button key={t} role="radio" aria-checked={anual === v} onClick={() => setAnual(v)}
            className={`relative rounded-xl border-2 p-3 text-left ${anual === v ? 'border-ruta-marca bg-ruta-marca-tinte' : 'border-ruta-borde bg-dark-950'}`}>
            {v && <Etiqueta texto={enFrase(tx('AHORRA'))} tono="aviso" className="absolute -top-3 right-2" />}
            <span className={`block text-etiqueta ${anual === v ? 'text-ruta-marca-tinte-texto' : 'text-dark-400'}`}>{t}</span>
            <span className={`block text-cifra tabular-nums ${anual === v ? 'text-ruta-marca-tinte-texto' : 'text-dark-50'}`}>{p}<span className={`text-sec font-semibold ${anual === v ? 'text-ruta-marca-tinte-texto' : 'text-dark-400'}`}>{per}</span></span>
            {extra && <span className="block text-sec text-ruta-ok-texto">{extra}</span>}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-dark-950 px-3 py-2 text-sec text-dark-400">
        {b.cobro_al_suscribir ? (
          <p className="flex gap-2"><CalendarClock size={18} className="shrink-0 text-ruta-ok-texto" aria-hidden="true" />
            <span><b className="text-dark-50">{tx('Hoy pagas 0 €.')}</b> {anual ? tx('El {fecha} se cobran {precio}, y después cada año. Si cancelas antes de esa fecha, no se cobra nada.', { fecha: fecha(b.cobro_al_suscribir), precio }) : tx('El {fecha} se cobran {precio}, y después cada mes. Si cancelas antes de esa fecha, no se cobra nada.', { fecha: fecha(b.cobro_al_suscribir), precio })}</span></p>
        ) : (
          <p className="flex gap-2"><CreditCard size={18} className="shrink-0 text-ruta-marca" aria-hidden="true" />
            <span>{anual ? tx('Se cobran hoy {precio}, y después cada año. Cancela cuando quieras: sigues hasta el final de lo pagado.', { precio }) : tx('Se cobran hoy {precio}, y después cada mes. Cancela cuando quieras: sigues hasta el final de lo pagado.', { precio })}</span></p>
        )}
      </div>
      <Boton variante="principal" tono="marca" icono={CreditCard} texto={b.cobro_al_suscribir ? tx('Añadir tarjeta: hoy 0 €') : tx('Suscribirme')} cargando={yendo} onClick={ir} className="mt-3 w-full" />
      <p className="mt-2 text-center text-sec text-dark-400">{tx('Pago seguro con Stripe. Puedes usar códigos promocionales en el pago.')}</p>
    </section>
  )
}

function Gestionar({ b, precios, toast, recargar }) {
  const [ocupado, setOcupado] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const aAnual = b.stripe_intervalo !== 'anual'
  const enPrueba = b.stripe_status === 'trialing'
  async function portal() {
    setOcupado('portal')
    try { const { data } = await stripePortal(); if (data?.url) { window.location.href = data.url; return } } catch (e) {
      toast?.error?.(txError(e, 'No se pudo abrir la gestión del pago'))
    }
    setOcupado('')
  }
  async function cambiar() {
    setOcupado('cambio')
    try { await stripeCambiarPlan(aAnual); toast?.success?.(aAnual ? tx('Ya estás en el plan anual') : tx('Ya estás en el plan mensual')); setConfirmar(false); recargar() } catch (e) {
      toast?.error?.(txError(e, 'No se pudo cambiar el plan'))
    }
    setOcupado('')
  }
  const explica = enPrueba
    ? tx('No se cobra nada ahora. Al acabar la prueba se cobran {precio}.', { precio: aAnual ? tx('{precio} al año', { precio: enMoneda(precios.anual) }) : tx('{precio} al mes', { precio: enMoneda(precios.mensual) }) })
    : aAnual
      ? tx('Se cobran ahora {precio} menos la parte que no has usado de este mes, y luego cada año.', { precio: enMoneda(precios.anual) })
      : tx('No se cobra nada ahora: lo que no has usado del año se descuenta de los próximos meses ({precio} al mes).', { precio: enMoneda(precios.mensual) })
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3">
      <h2 className="text-nombre text-dark-50">{tx('Tu suscripción')}</h2>
      {!b.cancela_al_final && (confirmar ? (
        <div className="mt-3 rounded-xl bg-dark-950 p-3">
          <p className="text-texto text-dark-50">{aAnual ? tx('Pasar al plan anual') : tx('Pasar al plan mensual')}. {explica}</p>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <Boton variante="normal" tono="neutro" contorno texto={tx('No')} onClick={() => setConfirmar(false)} />
            <Boton variante="principal" tono="marca" texto={tx('Sí, cambiar')} cargando={ocupado === 'cambio'} onClick={cambiar} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmar(true)}
          className="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-dark-950 px-3 py-2 text-left">
          <span className="min-w-0">
            <span className="block text-nombre text-dark-50">{aAnual ? tx('Pasar al plan anual') : tx('Pasar al plan mensual')}</span>
            <span className="block text-sec text-dark-400">{aAnual ? `${enMoneda(precios.anual)}${tx('/año')} · ${tx('2 meses gratis')}` : `${enMoneda(precios.mensual)}${tx('/mes')}`}</span>
          </span>
          {aAnual && <Sparkles size={20} className="shrink-0 text-ruta-aviso-texto" aria-hidden="true" />}
        </button>
      ))}
      <Boton variante="normal" tono="neutro" contorno icono={CreditCard} texto={tx('Tarjeta, facturas y cancelar')} cargando={ocupado === 'portal'} onClick={portal} className="mt-2 w-full" />
    </section>
  )
}

const conPlay = (b) => b.pago_proveedor === 'play' && b.status === 'active'

/* Suscribirse DENTRO de la app de Play: con Google Play, a los precios que da
   Google (con los impuestos del país del comprador). La prueba gratis solo se
   anuncia si Google dice que el producto la tiene. */
export function PagarConPlay({ b, toast, recargar, titulo }) {
  const [prods, setProds] = useState(null)        // null cargando · {} sin Play · {id: {...}}
  const [elegido, setElegido] = useState('')
  const [yendo, setYendo] = useState(false)
  const ids = Object.keys(b.play?.productos || {})
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const srv = b.play?.listo ? await servicioPlay() : null
      if (!srv) { if (vivo) setProds({}); return }
      try {
        const d = await detallesPlay(srv, ids)
        if (!vivo) return
        setProds(d)
        setElegido(Object.keys(d).find((k) => b.play.productos[k] === 'mensual') || Object.keys(d)[0] || '')
      } catch { if (vivo) setProds({}) }
    })()
    return () => { vivo = false }
  }, [b.play?.listo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pagar() {
    setYendo(true)
    let resp = null
    try {
      resp = await pagarConPlay(elegido, b.play.cuenta)
      const token = resp?.details?.purchaseToken
      if (!token) throw new Error('sin compra')
      const { data } = await playVerificar(token)
      await resp.complete('success')
      evento(data?.en_prueba ? 'StartTrial' : 'Subscribe', { currency: 'EUR', value: 0, content_name: elegido })
      toast?.success?.(data?.en_prueba ? tx('Prueba activada. Hoy no se te cobra nada.') : tx('Suscripción activada'))
      recargar()
    } catch (e) {
      try { await resp?.complete('fail') } catch { /* ya cerrada */ }
      // Cancelar en la ventana de Google no es un error que contar.
      if (e?.name !== 'AbortError') toast?.error?.(txError(e, 'No se completó el pago'))
    }
    setYendo(false)
  }

  if (prods === null) return <section className="mt-3 flex justify-center rounded-xl bg-dark-900 p-6"><Loader2 className="animate-spin text-dark-400" /></section>
  const lista = Object.values(prods)
  if (!lista.length) {
    return (
      <p className="mt-3 rounded-xl bg-dark-900 p-3 text-center text-texto text-dark-400">
        {b.play?.listo ? tx('Actualiza la app desde Google Play para poder suscribirte.') : tx('Tu cuenta aún no está activada.')}
      </p>
    )
  }
  const sel = prods[elegido]
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3">
      <h2 className="text-nombre text-dark-50">{titulo || tx('Suscribirte')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Plan')}>
        {lista.map((p) => {
          const anual = b.play.productos[p.id] === 'anual'
          return (
            <button key={p.id} role="radio" aria-checked={elegido === p.id} onClick={() => setElegido(p.id)}
              className={`relative rounded-xl border-2 p-3 text-left ${elegido === p.id ? 'border-ruta-marca bg-ruta-marca-tinte' : 'border-ruta-borde bg-dark-950'}`}>
              {anual && <Etiqueta texto={enFrase(tx('AHORRA'))} tono="aviso" className="absolute -top-3 right-2" />}
              <span className={`block text-etiqueta ${elegido === p.id ? 'text-ruta-marca-tinte-texto' : 'text-dark-400'}`}>{anual ? tx('Anual') : tx('Mensual')}</span>
              <span className={`block text-cifra tabular-nums ${elegido === p.id ? 'text-ruta-marca-tinte-texto' : 'text-dark-50'}`}>{p.precio}<span className={`text-sec font-semibold ${elegido === p.id ? 'text-ruta-marca-tinte-texto' : 'text-dark-400'}`}>{anual ? tx('/año') : tx('/mes')}</span></span>
              {p.diasPrueba > 0 && <span className="block text-sec text-ruta-ok-texto">{tx('{n} días gratis', { n: p.diasPrueba })}</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-3 rounded-xl bg-dark-950 px-3 py-2 text-sec text-dark-400">
        {sel?.diasPrueba > 0
          ? <><b className="text-dark-50">{tx('Hoy pagas 0 €.')}</b> {tx('Al acabar los {n} días gratis, Google Play cobra {precio}. Cancela antes desde Google Play y no se cobra nada.', { n: sel.diasPrueba, precio: b.play.productos[elegido] === 'anual' ? tx('{precio} al año', { precio: sel.precio }) : tx('{precio} al mes', { precio: sel.precio }) })}</>
          : <>{tx('Google Play cobra {precio}. Cancela cuando quieras desde Google Play.', { precio: b.play.productos[elegido] === 'anual' ? tx('{precio} al año', { precio: sel?.precio }) : tx('{precio} al mes', { precio: sel?.precio }) })}</>}
      </p>
      <Boton variante="principal" tono="marca" icono={CreditCard} texto={sel?.diasPrueba > 0 ? tx('Empezar {n} días gratis', { n: sel.diasPrueba }) : tx('Suscribirme')} cargando={yendo} disabled={!sel} onClick={pagar} className="mt-3 w-full" />
      <p className="mt-2 text-center text-sec text-dark-400">{tx('El pago lo hace Google Play con tu cuenta de Google.')}</p>
    </section>
  )
}

function GestionarPlay({ b }) {
  const p = b.play || {}
  const url = `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(p.producto || '')}&package=${encodeURIComponent(p.paquete || '')}`
  return (
    <Boton variante="normal" tono="neutro" contorno icono={CreditCard} texto={tx('Gestionar o cancelar en Google Play')} href={url} target="_blank" rel="noreferrer" className="mt-3 w-full" />
  )
}

function BotonPortal({ toast, texto, principal }) {
  const [yendo, setYendo] = useState(false)
  async function ir() {
    setYendo(true)
    try { const { data } = await stripePortal(); if (data?.url) { window.location.href = data.url; return } } catch (e) {
      toast?.error?.(txError(e, 'No se pudo abrir la gestión del pago'))
    }
    setYendo(false)
  }
  return (
    <Boton variante={principal ? 'principal' : 'normal'} tono={principal ? 'marca' : 'neutro'} contorno={!principal} icono={CreditCard} texto={texto} cargando={yendo} onClick={ir} className="mt-3 w-full" />
  )
}

function Canjear({ toast, recargar }) {
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function canjear() {
    setOcupado(true)
    try { const { data } = await canjearRegalo(codigo); toast?.success?.(data?.mensaje || tx('Regalo aplicado')); setCodigo(''); recargar() } catch (e) {
      toast?.error?.(txError(e, 'No se pudo canjear'))
    }
    setOcupado(false)
  }
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3">
      <h2 className="flex items-center gap-2 text-nombre text-dark-50"><Gift size={18} className="text-ruta-marca" aria-hidden="true" /> {tx('¿Te han regalado la app?')}</h2>
      <div className="mt-2 flex gap-2">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" aria-label={tx('Código de regalo')}
          autoCapitalize="characters" spellCheck={false}
          className="campo font-mono tracking-widest" />
        <Boton variante="normal" tono="marca" texto={tx('Canjear')} disabled={codigo.replace(/[^A-Z0-9]/g, '').length < 6} cargando={ocupado} onClick={canjear} className="shrink-0" />
      </div>
    </section>
  )
}

/* Regalar: pago único con Stripe, y un código + enlace para mandar desde tu
   móvil (WhatsApp, correo o copiar). Nosotros no escribimos a nadie. */
function Regalar({ precios, toast, resaltar }) {
  const [meses, setMeses] = useState(1)
  const [yendo, setYendo] = useState(false)
  const [regalos, setRegalos] = useState(null)
  useEffect(() => {
    let vivo = true
    let intentos = 0
    const leer = () => misRegalos().then(({ data }) => {
      if (!vivo) return
      const rs = lista(data?.regalos)
      setRegalos(rs)
      // Volviendo de pagar: el aviso de Stripe tarda unos segundos en llegar.
      const esperado = resaltar && rs.find((r) => r.id === resaltar)
      if (resaltar && (!esperado || esperado.estado === 'pendiente_pago') && intentos < 15) { intentos += 1; setTimeout(leer, 2500) }
    }).catch(() => vivo && setRegalos([]))
    leer()
    return () => { vivo = false }
  }, [resaltar])
  async function comprar() {
    setYendo(true)
    try {
      const { data } = await comprarRegalo(meses)
      if (data?.url) { apuntarParaLaVuelta('Purchase', { value: precios[String(meses)], currency: 'EUR', content_name: 'regalo' }); window.location.href = data.url; return }
    } catch (e) {
      toast?.error?.(txError(e, 'No se pudo abrir el pago'))
    }
    setYendo(false)
  }
  const visibles = lista(regalos).filter((r) => r.estado !== 'pendiente_pago' || r.id === resaltar)
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3">
      <h2 className="flex items-center gap-2 text-nombre text-dark-50"><Gift size={18} className="text-ruta-marca" aria-hidden="true" /> {tx('Regala {marca}', { marca: MARCA.nombre })}</h2>
      <p className="mt-1 text-sec text-dark-400">{tx('Pagas una vez, sin suscripción. Te damos un código y un enlace para mandarlo por WhatsApp o correo. Hay 12 meses para usarlo.')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Qué regalar')}>
        {[[1, tx('1 mes'), precios['1']], [12, tx('1 año'), precios['12']]].map(([m, t, p]) => (
          <button key={m} role="radio" aria-checked={meses === m} onClick={() => setMeses(m)}
            className={`rounded-xl border-2 p-3 text-left ${meses === m ? 'border-ruta-marca bg-ruta-marca-tinte' : 'border-ruta-borde bg-dark-950'}`}>
            <span className={`block text-etiqueta ${meses === m ? 'text-ruta-marca-tinte-texto' : 'text-dark-400'}`}>{t}</span>
            <span className={`block text-cifra tabular-nums ${meses === m ? 'text-ruta-marca-tinte-texto' : 'text-dark-50'}`}>{euros(p)}</span>
          </button>
        ))}
      </div>
      <Boton variante="principal" tono="marca" icono={Gift} texto={tx('Comprar regalo')} cargando={yendo} onClick={comprar} className="mt-3 w-full" />
      {visibles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-etiqueta text-dark-400">{tx('Tus regalos')}</p>
          {visibles.map((r) => <TarjetaRegalo key={r.id} r={r} nuevo={r.id === resaltar} toast={toast} />)}
        </div>
      )}
    </section>
  )
}

function TarjetaRegalo({ r, nuevo, toast }) {
  const que = r.meses === 12 ? tx('1 año') : r.meses > 1 ? tx('{n} meses', { n: r.meses }) : tx('1 mes')
  if (r.estado === 'pendiente_pago') {
    return <div className="flex items-center gap-2 rounded-xl bg-dark-950 p-3 text-texto text-dark-400"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {tx('Confirmando el pago del regalo…')}</div>
  }
  const enlace = `${origen()}/regalo/${r.codigo}`
  const msg = tx('Te regalo {que} de {marca}, la app para organizar tu ruta de reparto. Actívalo aquí: {enlace} (código {codigo})', { que, marca: MARCA.nombre, enlace, codigo: bonito(r.codigo) })
  const estado = { pagado: [tx('Sin usar'), 'text-ruta-ok-texto'], canjeado: [tx('Usado'), 'text-dark-400'], caducado: [tx('Caducado'), 'text-ruta-peligro-texto'] }[r.estado] || [r.estado, 'text-dark-400']
  return (
    <div className={`rounded-xl border p-3 ${nuevo ? 'border-ruta-marca bg-ruta-marca-tinte' : 'border-ruta-borde bg-dark-950'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-nombre tracking-widest text-dark-50">{bonito(r.codigo)}</span>
        <span className={`text-etiqueta ${nuevo && estado[1] === 'text-dark-400' ? 'text-ruta-marca-tinte-texto' : estado[1]}`}>{que} · {estado[0]}</span>
      </div>
      {r.estado === 'pagado' && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-boton">
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-ruta-ok px-2 text-white"><MessageCircle size={16} aria-hidden="true" /> WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(tx('Te regalo {que} de {marca}', { que, marca: MARCA.nombre }))}&body=${encodeURIComponent(msg)}`}
            className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-ruta-borde px-2 text-dark-50"><Mail size={16} aria-hidden="true" /> {tx('Correo')}</a>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(msg); toast?.success?.(tx('Copiado')) } catch { toast?.error?.(tx('No se pudo copiar')) } }}
            className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-ruta-borde px-2 text-dark-50"><Copy size={16} aria-hidden="true" /> {tx('Copiar')}</button>
        </div>
      )}
    </div>
  )
}

/* EL MURO: cuando no se puede seguir sin pagar (prueba terminada, falta la
   tarjeta de la prueba, regalo acabado, pago pendiente). El historial y la
   cuenta siguen abiertos: lo suyo lo puede ver siempre. */
export function Muro({ billing, toast, recargar, irACuenta }) {
  useIdioma()
  const enApp = enAppPlay()
  // En la app de iPhone no se vende nada (Apple exige su pago dentro de la app, regla 3.1.1): ni suscribirse, ni regalos,
  // ni el portal de la tarjeta; el plan se lleva desde la web. Ver docs/APP_STORE.md.
  const enIOS = esAppIOS()
  const b = billing || {}
  const precios = b.precios || { mensual: 9.99, anual: 99 }
  monedaPlan = precios.moneda || 'EUR'
  const empezar = b.falta_tarjeta
  return (
    <div className="mx-auto max-w-md">
      <section className="rounded-xl border-2 border-ruta-marca bg-dark-900 p-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-ruta-marca-tinte text-ruta-marca-tinte-texto">
          {empezar ? <Sparkles size={24} aria-hidden="true" /> : <CalendarClock size={24} aria-hidden="true" />}
        </div>
        <h1 className="mt-3 text-titulo text-dark-50">
          {empezar ? tx('Empieza tus 7 días gratis') : b.status === 'suspended' ? tx('Hay un pago pendiente') : b.status === 'vencido' ? tx('Tu regalo ha terminado')
            : b.status === 'vencido_play' ? tx('Tu suscripción ha terminado') : tx('Tu prueba ha terminado')}
        </h1>
        <p className="mt-1 text-texto text-dark-400">
          {empezar
            ? tx('Añade tu tarjeta para activar la prueba. Hoy no se cobra nada y puedes cancelar cuando quieras antes del primer cobro.')
            : tx('Tus rutas y tu historial siguen aquí. Para seguir repartiendo con la app, activa tu suscripción.')}
        </p>
        {empezar && (
          <ul className="mx-auto mt-3 max-w-[300px] space-y-1 text-left text-texto text-dark-50">
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ruta-ok-texto" aria-hidden="true" /> {tx('Hoy: 0 €')}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ruta-ok-texto" aria-hidden="true" /> {tx('El {fecha}: {mes} o {ano}', { fecha: fecha(b.cobro_al_suscribir || b.trial_ends), mes: `${enMoneda(precios.mensual)}${tx('/mes')}`, ano: `${enMoneda(precios.anual)}${tx('/año')}` })}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ruta-ok-texto" aria-hidden="true" /> {tx('Cancela antes y no pagas nada')}</li>
          </ul>
        )}
      </section>
      {enApp ? (
        b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled'
          ? <p className="mt-3 rounded-xl bg-dark-900 p-3 text-center text-texto text-dark-400">{tx('Revisa el pago de tu suscripción.')}</p>
          : <PagarConPlay b={b} toast={toast} recargar={recargar} titulo={empezar ? tx('Elige cómo quieres pagar después') : tx('Elige tu plan')} />
      ) : enIOS ? null : b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled' ? (
        // Pago fallido con la suscripción viva: se arregla la tarjeta, no se
        // contrata otra (saldrían dos cobros).
        <BotonPortal toast={toast} texto={tx('Revisar mi tarjeta y pagar')} principal />
      ) : (
        <>
          <Suscribirse b={b} precios={precios} toast={toast} titulo={empezar ? tx('Elige cómo quieres pagar después') : tx('Elige tu plan')} />
        </>
      )}
      <Canjear toast={toast} recargar={recargar} />
      <Boton variante="texto" tono="marca" texto={tx('Ver mi cuenta')} onClick={irACuenta} className="mt-3 w-full" />
    </div>
  )
}

/* LA CARTERA «INVITA Y GANA» (10-10-2026). Dani: «por cada persona nueva que se lo pasan y
   se registra, algo de dinero que puedan retirar; nosotros lo aprobamos y les pagamos». Las
   reglas las pone el servidor (importes en céntimos); aquí se cuentan claras, se ve el saldo,
   se invita en un toque y se pide el pago por Bizum o transferencia. */
const cent = (c) => euros((Number(c) || 0) / 100)
const ESTADO_RETIRADA = { pendiente: ['En revisión', 'text-ruta-aviso-texto'], pagada: ['Pagada', 'text-ruta-ok-texto'], rechazada: ['No pagada', 'text-ruta-peligro-texto'] }

function Invitar({ toast }) {
  useIdioma()
  const [r, setR] = useState(null)
  const [pidiendo, setPidiendo] = useState(false)
  // 11-10-2026: en la nave, a primera hora, el compañero está al lado: un QR es más rápido que un WhatsApp.
  const [qr, setQr] = useState('')
  async function verQr() {
    if (qr) { setQr(''); return }
    try { setQr(await QRCode.toDataURL(enlaceInvitar(r?.codigo), { margin: 1, width: 260 })) } catch { setQr('') }
  }
  const [form, setForm] = useState({ titular: '', metodo: '', destino: '' })
  // El método de cobro, el primero que valga en su país (fuera de España, PayPal).
  useEffect(() => {
    const metodos = r ? (r.metodos?.length ? r.metodos : ['bizum', 'iban']) : null
    if (metodos && !metodos.includes(form.metodo)) setForm((f) => ({ ...f, metodo: metodos[0], destino: '' }))
  }, [r, form.metodo])
  const [enviando, setEnviando] = useState(false)
  const cargar = () => getReferidos().then(({ data }) => setR(data)).catch(() => {})
  useEffect(() => { cargar() }, [])
  async function pedir(e) {
    e.preventDefault()
    setEnviando(true)
    try {
      await retirarCartera(form)
      toast?.success?.(tx('Pedido. Lo revisamos y te lo pagamos en unos días.'))
      setPidiendo(false)
      cargar()
    } catch (err) { toast?.error?.(txError(err, 'No se pudo pedir el pago')) } finally { setEnviando(false) }
  }
  const saldo = r?.saldo || 0
  // El botón de cobrar sale con cualquier saldo; el mínimo (60 €) se dice solo al pulsarlo (14-10-2026, Dani).
  const puede = r && saldo > 0 && !r.pendiente
  const minimo = r?.retirada_min || 6000
  const promoHasta = r ? (r.promo_hasta || '') : (refPromoActiva() ? REF_PROMO_HASTA : '')
  function cobrar() {
    if (saldo < minimo) {
      toast?.error?.(tx('Se puede cobrar a partir de {min}. Te faltan {falta}.', { min: cent(minimo), falta: cent(minimo - saldo) }))
      return
    }
    setPidiendo(true)
  }
  const campo = 'campo'
  return (
    <section className="mt-3 rounded-xl bg-dark-900 p-3" aria-label={tx('Tu cartera')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-etiqueta text-ruta-ok-texto">{tx('Invita y gana')}</p>
          <p className="text-nombre text-dark-50">{tx('{euros} por cada compañero que la use', { euros: cent(r?.por_invitado ?? refCentActual()) })}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sec text-dark-400">{tx('Tu saldo')}</p>
          <p className="text-cifra text-ruta-ok-texto tabular-nums">{cent(saldo)}</p>
        </div>
      </div>
      <p className="mt-2 text-sec text-dark-400">
        {tx(r?.metodos?.includes('bizum') === false ? 'Pásale tu enlace. Cuando se registre y haga {n} entregas en {d} días distintos (en su primer mes), ganas {euros}. Lo cobras por PayPal.' : 'Pásale tu enlace. Cuando se registre y haga {n} entregas en {d} días distintos (en su primer mes), ganas {euros}. Lo cobras por Bizum o transferencia.', {
          n: r?.entregas_cartera ?? 20, d: r?.dias_distintos ?? 2, euros: cent(r?.por_invitado ?? refCentActual()) })}
      </p>
      {r?.bono && (
        <p data-testid="cartera-bono" className={`mt-2 rounded-xl px-3 py-2 text-sec font-semibold ${r.bono.pagado ? 'bg-ruta-ok/10 text-dark-50' : 'bg-ruta-aviso text-ruta-aviso-texto'}`}>
          {r.bono.pagado
            ? tx('Bono de bienvenida: {euros} ganados con tu primera ruta.', { euros: cent(r.bono.cent) })
            : tx('Bono de bienvenida: {euros} cuando hagas tus primeras {n} entregas (en {d} días). Hasta el {fecha}.', {
              euros: cent(r.bono.cent), n: r.bono.objetivo || 20, d: r.bono.dias_objetivo || 2, fecha: fechaRefPromo(locale(), r.bono.hasta) })}
        </p>
      )}
      {r?.regalo > 0 && (
        <p data-testid="cartera-regalo" className="mt-2 rounded-xl bg-ruta-ok/10 px-3 py-2 text-sec font-semibold text-dark-50">
          🎁 {tx('Regalo: {euros} ya en tu saldo, para que veas que es de verdad.', { euros: cent(r.regalo) })}
        </p>
      )}
      {promoHasta && (
        <p className="mt-2 rounded-xl bg-ruta-ok/10 px-3 py-2 text-sec font-semibold text-dark-50">
          {tx('Promoción hasta el {fecha}: {euros} por cada compañero que se registre con tu enlace.', { fecha: fechaRefPromo(locale(), promoHasta), euros: cent(r?.promo_cent ?? REF_PROMO_CENT) })}
        </p>
      )}
      {r && (r.invitados > 0 || r.ganado > 0) && (
        <p className="mt-2 text-sec font-semibold text-ruta-ok-texto">
          {tx('Invitados: {a} · ya la usan: {b} · ganado: {c}', { a: r.invitados, b: r.premiados, c: cent(r.ganado) })}
        </p>
      )}
      <Boton variante="principal" tono="ok" icono={MessageCircle} texto={tx('Invitar a un compañero')} onClick={invitar} className="mt-3 w-full" />
      {r?.codigo && (
        <Boton variante="normal" tono="ok" contorno icono={QrCode} texto={qr ? tx('Ocultar el QR') : tx('Enseñar mi QR a un compañero')} onClick={verQr} aria-expanded={!!qr} className="mt-2 w-full" />
      )}
      {qr && (
        <div className="mt-3 rounded-xl bg-white p-3 text-center">
          <img src={qr} alt={tx('Código QR de tu invitación')} width="220" height="220" className="mx-auto" />
          <p className="mt-1 text-sec font-semibold text-slate-800">{tx('Que lo escanee con la cámara del móvil: entra con tu invitación.')}</p>
        </div>
      )}
      {r?.pendiente && <p className="mt-2 text-center text-sec text-ruta-aviso-texto">{tx('Tienes un pago en revisión. Te avisamos por correo cuando lo enviemos.')}</p>}
      {puede && !pidiendo && (
        <Boton variante="normal" tono="ok" contorno icono={Wallet} texto={tx('Cobrar {euros}', { euros: cent(saldo) })} onClick={cobrar} className="mt-2 w-full" />
      )}
      {pidiendo && (
        <form onSubmit={pedir} className="mt-3 space-y-2 rounded-xl bg-dark-950 p-3">
          <p className="text-boton text-dark-50">{tx('¿Dónde te lo enviamos?')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(r?.metodos || ['bizum', 'iban']).map((k) => [k, { bizum: 'Bizum', iban: tx('Transferencia'), paypal: 'PayPal' }[k]]).map(([k, t]) => (
              <button key={k} type="button" aria-pressed={form.metodo === k} onClick={() => setForm({ ...form, metodo: k, destino: '' })}
                className={`min-h-12 rounded-xl px-2 text-boton ${form.metodo === k ? 'bg-ruta-ok text-white' : 'border border-ruta-borde text-dark-50'}`}>{tx(t)}</button>
            ))}
          </div>
          <input className={campo} value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })}
            placeholder={tx('Nombre y apellidos del titular')} autoComplete="name" aria-label={tx('Nombre y apellidos del titular')} />
          <input className={campo} value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}
            placeholder={form.metodo === 'bizum' ? tx('Móvil con Bizum') : form.metodo === 'paypal' ? tx('Correo de tu PayPal') : tx('IBAN (ES…)')} aria-label={form.metodo === 'bizum' ? tx('Móvil con Bizum') : form.metodo === 'paypal' ? tx('Correo de tu PayPal') : tx('IBAN (ES…)')}
            inputMode={form.metodo === 'bizum' ? 'tel' : form.metodo === 'paypal' ? 'email' : 'text'} autoComplete={form.metodo === 'bizum' ? 'tel' : form.metodo === 'paypal' ? 'email' : 'off'} />
          <Boton variante="normal" tono="ok" type="submit" icono={Check} texto={tx('Pedir el pago de {euros}', { euros: cent(saldo) })} cargando={enviando} className="w-full" />
          <p className="text-sec text-dark-400">{tx('Lo revisamos y te lo pagamos en unos días. Solo usamos estos datos para pagarte.')}</p>
          <Boton variante="texto" tono="neutro" texto={tx('Cancelar')} onClick={() => setPidiendo(false)} className="w-full" />
        </form>
      )}
      {lista(r?.retiradas).length > 0 && (
        <ul className="mt-3 space-y-1 text-sec">
          {lista(r.retiradas).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-dark-950 px-3 py-2">
              <span className="text-dark-400">{fecha(x.creada)} · {cent(x.importe)} · {{ bizum: 'Bizum', iban: tx('Transferencia'), paypal: 'PayPal' }[x.metodo] || x.metodo} {x.destino}</span>
              <span className={`shrink-0 font-semibold ${ESTADO_RETIRADA[x.estado]?.[1] || ''}`} title={x.motivo || ''}>{tx(ESTADO_RETIRADA[x.estado]?.[0] || x.estado)}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Con su propia zona de 48: un enlace dentro de una frase cuela la suya (la del index.css) por encima del botón de arriba. */}
      <p className="mt-1"><a href="/terminos#invita" className="inline-flex min-h-12 items-center text-sec text-dark-400 underline">{tx('Condiciones del programa')}</a></p>
    </section>
  )
}
