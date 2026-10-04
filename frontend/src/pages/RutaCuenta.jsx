import { useEffect, useState } from 'react'
import {
  Loader2, LogOut, Gift, CreditCard, Check, Copy, MessageCircle, Mail, Sparkles, ShieldCheck, CalendarClock, Crown,
} from 'lucide-react'
import {
  stripeSuscripcion, stripePortal, stripeCambiarPlan, comprarRegalo, misRegalos, canjearRegalo, playVerificar,
} from '../panel/api'
import { servicioPlay, detallesPlay, pagarConPlay } from '../lib/playBilling'
import { evento, apuntarParaLaVuelta } from '../lib/metaPixel'
import { getAdmin, logout } from '../panel/auth'
import { MARCA, origen } from '../marca'
import { enAppPlay } from '../lib/enApp'
import { lista } from '../lib/lista'
import { tx, useIdioma, locale, IDIOMAS, idioma, cambiarIdioma, txError } from '../lib/idioma'

/* ── LA CUENTA DE QUIEN REPARTE SOLO (04-10-2026) ────────────────────────────
   Dani: «quiero mejorarla ya, o la suscripción de un año, o regalársela a
   alguien por email o WhatsApp, y que en la prueba metan la tarjeta, se les
   cobre 0 y al día 7 se les cobre si no cancelan». Todo con Stripe en la web.

   Dentro de la app de Play no hay botones de pago: Google obliga a cobrar con
   su sistema (Play Billing). Allí se ve el estado y se puede canjear un
   código de regalo. Los textos dicen exactamente lo que hace Stripe: nada de
   «te avisaremos» que no esté hecho. */

const euros = (n) => `${Number(n || 0).toFixed(2).replace('.', ',').replace(',00', '')} €`
const fecha = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
}
const bonito = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '')

export function Cuenta({ billing, recargar, toast, resaltarRegalo }) {
  const lang = useIdioma()
  const admin = getAdmin()
  const enApp = enAppPlay()
  const b = billing || {}
  const precios = b.precios || { mensual: 9.99, anual: 99 }
  return (
    <div className="mx-auto max-w-md pb-6">
      <h1 className="font-display text-[24px] font-bold text-dark-50">{tx('Tu cuenta')}</h1>
      <p className="mb-4 text-[13px] text-dark-400">{admin?.name || ''}</p>
      {!billing ? <Loader2 className="mx-auto my-10 animate-spin text-dark-500" /> : (
        <>
          <Estado b={b} precios={precios} />
          {!enApp && b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled'
            ? <BotonPortal toast={toast} texto={tx('Revisar mi tarjeta y pagar')} principal />
            : !enApp && !b.suscrito && !conPlay(b) && <Suscribirse b={b} precios={precios} toast={toast} />}
          {enApp && !b.suscrito && !conPlay(b) && b.play?.listo && <PagarConPlay b={b} toast={toast} recargar={recargar} />}
          {conPlay(b) && <GestionarPlay b={b} />}
          {!enApp && b.suscrito && <Gestionar b={b} precios={precios} toast={toast} recargar={recargar} />}
          <Canjear toast={toast} recargar={recargar} />
          {!enApp && b.regalos && <Regalar precios={b.regalos} toast={toast} resaltar={resaltarRegalo} />}
        </>
      )}
      <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
        <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-dark-100">
          🌐 {tx('Idioma')}
          <select value={lang || idioma()} onChange={(e) => cambiarIdioma(e.target.value)} aria-label={tx('Idioma')}
            className="rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[14px] text-dark-50">
            {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </section>
      <div className="mt-4 rounded-2xl border border-dark-800 bg-dark-900/60 p-4 text-[12.5px] leading-relaxed text-dark-400">
        <p className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-300" />
          {tx('Tus datos y los de tus clientes son tuyos: la foto de la etiqueta se lee en tu móvil y los datos de los clientes se borran solos a los días que fijes en Ajustes. Los pagos los procesa Stripe: tu tarjeta no pasa por nosotros.')}</p>
        <p className="mt-2"><a href="/privacidad" className="text-brand-300">{tx('Privacidad')}</a> · <a href="/terminos" className="text-brand-300">{tx('Términos')}</a> · <a href={`mailto:${MARCA.correo}`} className="text-brand-300">{MARCA.correo}</a></p>
      </div>
      <button onClick={() => { logout(); window.location.href = '/empezar' }}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-700 py-3 text-[14px] font-semibold text-dark-300">
        <LogOut size={15} /> {tx('Cerrar sesión')}
      </button>
    </div>
  )
}

/* La tarjeta del plan: en qué punto estás y qué va a pasar, con fechas. */
function Estado({ b, precios }) {
  const intervalo = b.stripe_intervalo === 'anual' ? `${euros(precios.anual)}${tx('/año')}` : `${euros(precios.mensual)}${tx('/mes')}`
  let chip = [tx('Prueba gratis'), 'bg-sky-500/15 text-sky-200']
  let linea = ''
  if (b.status === 'trial') {
    linea = b.falta_tarjeta
      ? tx('Añade tu tarjeta para empezar los 7 días gratis. Hoy no se cobra nada.')
      : b.required ? tx('Tu prueba gratis ha terminado.')
        : b.days_left === 1 ? tx('Queda 1 día: hasta el {fecha}.', { fecha: fecha(b.trial_ends) }) : tx('Quedan {n} días: hasta el {fecha}.', { n: b.days_left, fecha: fecha(b.trial_ends) })
    if (b.required) chip = [tx('Prueba terminada'), 'bg-red-500/15 text-red-300']
  } else if (b.status === 'vencido') {
    chip = [tx('Regalo terminado'), 'bg-red-500/15 text-red-300']; linea = tx('Tu regalo acabó el {fecha}.', { fecha: fecha(b.pagado_hasta) })
  } else if (b.status === 'active' && b.pago_proveedor === 'regalo') {
    chip = [tx('Regalo'), 'bg-violet-500/15 text-violet-200']; linea = tx('Pagado hasta el {fecha}. Sin cobros hasta entonces.', { fecha: fecha(b.pagado_hasta) })
  } else if (conPlay(b)) {
    const p = b.play || {}
    chip = p.en_prueba ? [tx('Prueba con Google Play'), 'bg-emerald-500/15 text-emerald-300'] : [tx('Suscrito con Google Play'), 'bg-emerald-500/15 text-emerald-300']
    linea = p.renueva
      ? `${p.en_prueba ? tx('Primer cobro el {fecha}, con Google Play.', { fecha: fecha(p.hasta) }) : tx('Próximo cobro el {fecha}, con Google Play.', { fecha: fecha(p.hasta) })}${p.en_prueba ? ` ${tx('Si cancelas antes, no se cobra nada.')}` : ''}`
      : tx('Cancelada: la puedes usar hasta el {fecha} y no se volverá a cobrar.', { fecha: fecha(p.hasta) })
  } else if (b.status === 'vencido_play') {
    chip = [tx('Terminada'), 'bg-red-500/15 text-red-300']; linea = tx('Tu suscripción de Google Play ha terminado.')
  } else if (b.suscrito && b.cancela_al_final) {
    chip = [tx('Cancelada'), 'bg-amber-500/15 text-amber-200']; linea = tx('La puedes usar hasta el {fecha} y no se volverá a cobrar.', { fecha: fecha(b.stripe_proximo_cobro) })
  } else if (b.suscrito && b.stripe_status === 'trialing') {
    chip = [tx('Prueba con tarjeta'), 'bg-emerald-500/15 text-emerald-300']
    linea = b.stripe_proximo_cobro ? tx('Primer cobro el {fecha}: {precio}. Si cancelas antes, no se cobra nada.', { fecha: fecha(b.stripe_proximo_cobro), precio: intervalo }) : tx('Primer cobro al acabar la prueba.')
  } else if (b.suscrito) {
    chip = [tx('Suscrito'), 'bg-emerald-500/15 text-emerald-300']
    linea = `${b.stripe_intervalo === 'anual' ? tx('Plan anual') : tx('Plan mensual')}: ${intervalo}.${b.stripe_proximo_cobro ? ` ${tx('Próximo cobro el {fecha}.', { fecha: fecha(b.stripe_proximo_cobro) })}` : ''}`
  } else if (b.status === 'suspended') {
    chip = [tx('Pausada'), 'bg-red-500/15 text-red-300']; linea = tx('Hay un pago pendiente. Revisa tu tarjeta.')
  } else if (b.status === 'active') {
    chip = [tx('Activa'), 'bg-emerald-500/15 text-emerald-300']
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-500/[.16] via-dark-900 to-dark-900 p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[17px] font-bold text-dark-50"><Crown size={18} className="text-brand-300" /> {tx('Plan Repartidor')}</span>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${chip[1]}`}>{chip[0]}</span>
      </div>
      {linea && <p className="mt-2 text-[13.5px] leading-snug text-dark-200">{linea}</p>}
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-dark-400">
        {['Ruta ordenada por tiempo', 'Navegación en la app', 'Escáner y foto de etiqueta', 'Cobros y prueba de entrega'].map((t) => (
          <li key={t} className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> {tx(t)}</li>
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
  const precio = anual ? tx('{precio} al año', { precio: euros(precios.anual) }) : tx('{precio} al mes', { precio: euros(precios.mensual) })
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
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
      <h2 className="text-[15px] font-bold text-dark-50">{titulo || tx('Suscribirte')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Plan')}>
        {[[false, tx('Mensual'), `${euros(precios.mensual)}`, tx('/mes'), ''], [true, tx('Anual'), `${euros(precios.anual)}`, tx('/año'), `${euros(precios.anual / 12)}${tx('/mes')} · ${tx('2 meses gratis')}`]].map(([v, t, p, per, extra]) => (
          <button key={t} role="radio" aria-checked={anual === v} onClick={() => setAnual(v)}
            className={`relative rounded-2xl border-2 p-3 text-left transition ${anual === v ? 'border-brand-400 bg-brand-500/10' : 'border-dark-700 bg-dark-950'}`}>
            {v && <span className="absolute -top-2.5 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">{tx('AHORRA')}</span>}
            <span className="block text-[12.5px] font-semibold text-dark-300">{t}</span>
            <span className="block text-[22px] font-extrabold leading-tight text-dark-50">{p}<span className="text-[12px] font-semibold text-dark-400">{per}</span></span>
            {extra && <span className="block text-[11px] text-emerald-300">{extra}</span>}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-dark-950 px-3 py-2.5 text-[12.5px] leading-snug text-dark-300">
        {b.cobro_al_suscribir ? (
          <p className="flex gap-2"><CalendarClock size={15} className="mt-0.5 shrink-0 text-emerald-300" />
            <span><b className="text-dark-50">{tx('Hoy pagas 0 €.')}</b> {anual ? tx('El {fecha} se cobran {precio}, y después cada año. Si cancelas antes de esa fecha, no se cobra nada.', { fecha: fecha(b.cobro_al_suscribir), precio }) : tx('El {fecha} se cobran {precio}, y después cada mes. Si cancelas antes de esa fecha, no se cobra nada.', { fecha: fecha(b.cobro_al_suscribir), precio })}</span></p>
        ) : (
          <p className="flex gap-2"><CreditCard size={15} className="mt-0.5 shrink-0 text-brand-300" />
            <span>{anual ? tx('Se cobran hoy {precio}, y después cada año. Cancela cuando quieras: sigues hasta el final de lo pagado.', { precio }) : tx('Se cobran hoy {precio}, y después cada mes. Cancela cuando quieras: sigues hasta el final de lo pagado.', { precio })}</span></p>
        )}
      </div>
      <button onClick={ir} disabled={yendo}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta shadow-lg shadow-brand-500/20 disabled:opacity-60">
        {yendo ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
        {b.cobro_al_suscribir ? tx('Añadir tarjeta: hoy 0 €') : tx('Suscribirme')}
      </button>
      <p className="mt-2 text-center text-[11px] text-dark-500">{tx('Pago seguro con Stripe. Puedes usar códigos promocionales en el pago.')}</p>
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
    ? tx('No se cobra nada ahora. Al acabar la prueba se cobran {precio}.', { precio: aAnual ? tx('{precio} al año', { precio: euros(precios.anual) }) : tx('{precio} al mes', { precio: euros(precios.mensual) }) })
    : aAnual
      ? tx('Se cobran ahora {precio} menos la parte que no has usado de este mes, y luego cada año.', { precio: euros(precios.anual) })
      : tx('No se cobra nada ahora: lo que no has usado del año se descuenta de los próximos meses ({precio} al mes).', { precio: euros(precios.mensual) })
  return (
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
      <h2 className="text-[15px] font-bold text-dark-50">{tx('Tu suscripción')}</h2>
      {!b.cancela_al_final && (confirmar ? (
        <div className="mt-3 rounded-2xl border border-brand-400/40 bg-brand-500/[.06] p-3">
          <p className="text-[13px] text-dark-200">{aAnual ? tx('Pasar al plan anual') : tx('Pasar al plan mensual')}. {explica}</p>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <button onClick={() => setConfirmar(false)} className="rounded-xl border border-dark-600 py-2.5 text-[13.5px] text-dark-200">{tx('No')}</button>
            <button onClick={cambiar} disabled={ocupado === 'cambio'} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-[14px] font-bold text-brand-tinta">
              {ocupado === 'cambio' && <Loader2 size={15} className="animate-spin" />} {tx('Sí, cambiar')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmar(true)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dark-700 bg-dark-950 px-4 py-3 text-left">
          <span>
            <span className="block text-[14px] font-semibold text-dark-50">{aAnual ? tx('Pasar al plan anual') : tx('Pasar al plan mensual')}</span>
            <span className="block text-[12px] text-dark-400">{aAnual ? `${euros(precios.anual)}${tx('/año')} · ${tx('2 meses gratis')}` : `${euros(precios.mensual)}${tx('/mes')}`}</span>
          </span>
          {aAnual && <Sparkles size={18} className="text-amber-300" />}
        </button>
      ))}
      <button onClick={portal} disabled={ocupado === 'portal'}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dark-600 py-3 text-[13.5px] font-semibold text-dark-100">
        {ocupado === 'portal' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} {tx('Tarjeta, facturas y cancelar')}
      </button>
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

  if (prods === null) return <section className="mt-4 flex justify-center rounded-3xl border border-dark-700 bg-dark-900 p-6"><Loader2 className="animate-spin text-dark-500" /></section>
  const lista = Object.values(prods)
  if (!lista.length) {
    return (
      <p className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 p-4 text-center text-[13px] text-dark-300">
        {b.play?.listo ? tx('Actualiza la app desde Google Play para poder suscribirte.') : tx('Tu cuenta aún no está activada.')}
      </p>
    )
  }
  const sel = prods[elegido]
  return (
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
      <h2 className="text-[15px] font-bold text-dark-50">{titulo || tx('Suscribirte')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Plan')}>
        {lista.map((p) => {
          const anual = b.play.productos[p.id] === 'anual'
          return (
            <button key={p.id} role="radio" aria-checked={elegido === p.id} onClick={() => setElegido(p.id)}
              className={`relative rounded-2xl border-2 p-3 text-left transition ${elegido === p.id ? 'border-brand-400 bg-brand-500/10' : 'border-dark-700 bg-dark-950'}`}>
              {anual && <span className="absolute -top-2.5 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">{tx('AHORRA')}</span>}
              <span className="block text-[12.5px] font-semibold text-dark-300">{anual ? tx('Anual') : tx('Mensual')}</span>
              <span className="block text-[21px] font-extrabold leading-tight text-dark-50">{p.precio}<span className="text-[12px] font-semibold text-dark-400">{anual ? tx('/año') : tx('/mes')}</span></span>
              {p.diasPrueba > 0 && <span className="block text-[11px] text-emerald-300">{tx('{n} días gratis', { n: p.diasPrueba })}</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-3 rounded-xl bg-dark-950 px-3 py-2.5 text-[12.5px] leading-snug text-dark-300">
        {sel?.diasPrueba > 0
          ? <><b className="text-dark-50">{tx('Hoy pagas 0 €.')}</b> {tx('Al acabar los {n} días gratis, Google Play cobra {precio}. Cancela antes desde Google Play y no se cobra nada.', { n: sel.diasPrueba, precio: b.play.productos[elegido] === 'anual' ? tx('{precio} al año', { precio: sel.precio }) : tx('{precio} al mes', { precio: sel.precio }) })}</>
          : <>{tx('Google Play cobra {precio}. Cancela cuando quieras desde Google Play.', { precio: b.play.productos[elegido] === 'anual' ? tx('{precio} al año', { precio: sel?.precio }) : tx('{precio} al mes', { precio: sel?.precio }) })}</>}
      </p>
      <button onClick={pagar} disabled={yendo || !sel}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta shadow-lg shadow-brand-500/20 disabled:opacity-60">
        {yendo ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
        {sel?.diasPrueba > 0 ? tx('Empezar {n} días gratis', { n: sel.diasPrueba }) : tx('Suscribirme')}
      </button>
      <p className="mt-2 text-center text-[11px] text-dark-500">{tx('El pago lo hace Google Play con tu cuenta de Google.')}</p>
    </section>
  )
}

function GestionarPlay({ b }) {
  const p = b.play || {}
  const url = `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(p.producto || '')}&package=${encodeURIComponent(p.paquete || '')}`
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dark-600 py-3 text-[13.5px] font-semibold text-dark-100">
      <CreditCard size={15} /> {tx('Gestionar o cancelar en Google Play')}
    </a>
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
    <button onClick={ir} disabled={yendo}
      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold ${principal ? 'bg-brand-500 text-brand-tinta' : 'border border-dark-600 text-dark-100'}`}>
      {yendo ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} {texto}
    </button>
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
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-dark-50"><Gift size={16} className="text-violet-300" /> {tx('¿Te han regalado la app?')}</h2>
      <div className="mt-2.5 flex gap-2">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" aria-label={tx('Código de regalo')}
          autoCapitalize="characters" spellCheck={false}
          className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 font-mono text-[15px] tracking-widest text-dark-50 placeholder:text-dark-600 focus:border-brand-500 focus:outline-none" />
        <button onClick={canjear} disabled={codigo.replace(/[^A-Z0-9]/g, '').length < 6 || ocupado}
          className="shrink-0 rounded-xl bg-violet-500 px-4 text-[14px] font-bold text-white disabled:opacity-40">
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : tx('Canjear')}
        </button>
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
    <section className="mt-4 overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[.14] via-dark-900 to-dark-900 p-4">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-dark-50"><Gift size={18} className="text-violet-300" /> {tx('Regala {marca}', { marca: MARCA.nombre })}</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-dark-400">{tx('Pagas una vez, sin suscripción. Te damos un código y un enlace para mandarlo por WhatsApp o correo. Hay 12 meses para usarlo.')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx('Qué regalar')}>
        {[[1, tx('1 mes'), precios['1']], [12, tx('1 año'), precios['12']]].map(([m, t, p]) => (
          <button key={m} role="radio" aria-checked={meses === m} onClick={() => setMeses(m)}
            className={`rounded-2xl border-2 p-3 text-left ${meses === m ? 'border-violet-400 bg-violet-500/10' : 'border-dark-700 bg-dark-950'}`}>
            <span className="block text-[13px] font-semibold text-dark-300">{t}</span>
            <span className="block text-[20px] font-extrabold text-dark-50">{euros(p)}</span>
          </button>
        ))}
      </div>
      <button onClick={comprar} disabled={yendo}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 text-[15px] font-bold text-white disabled:opacity-60">
        {yendo ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />} {tx('Comprar regalo')}
      </button>
      {visibles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-dark-400">{tx('Tus regalos')}</p>
          {visibles.map((r) => <TarjetaRegalo key={r.id} r={r} nuevo={r.id === resaltar} toast={toast} />)}
        </div>
      )}
    </section>
  )
}

function TarjetaRegalo({ r, nuevo, toast }) {
  const que = r.meses === 12 ? tx('1 año') : r.meses > 1 ? tx('{n} meses', { n: r.meses }) : tx('1 mes')
  if (r.estado === 'pendiente_pago') {
    return <div className="flex items-center gap-2 rounded-2xl border border-dark-700 bg-dark-950 p-3 text-[13px] text-dark-300"><Loader2 size={15} className="animate-spin" /> {tx('Confirmando el pago del regalo…')}</div>
  }
  const enlace = `${origen()}/regalo/${r.codigo}`
  const msg = tx('Te regalo {que} de {marca}, la app para organizar tu ruta de reparto. Actívalo aquí: {enlace} (código {codigo})', { que, marca: MARCA.nombre, enlace, codigo: bonito(r.codigo) })
  const estado = { pagado: [tx('Sin usar'), 'text-emerald-300'], canjeado: [tx('Usado'), 'text-dark-400'], caducado: [tx('Caducado'), 'text-red-300'] }[r.estado] || [r.estado, 'text-dark-400']
  return (
    <div className={`rounded-2xl border p-3 ${nuevo ? 'border-violet-400 bg-violet-500/10' : 'border-dark-700 bg-dark-950'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[16px] font-bold tracking-widest text-dark-50">{bonito(r.codigo)}</span>
        <span className={`text-[12px] font-semibold ${estado[1]}`}>{que} · {estado[0]}</span>
      </div>
      {r.estado === 'pagado' && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[12px]">
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 font-semibold text-white"><MessageCircle size={14} /> WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(tx('Te regalo {que} de {marca}', { que, marca: MARCA.nombre }))}&body=${encodeURIComponent(msg)}`}
            className="flex items-center justify-center gap-1 rounded-xl border border-dark-600 py-2 font-semibold text-dark-100"><Mail size={14} /> {tx('Correo')}</a>
          <button onClick={async () => { try { await navigator.clipboard.writeText(msg); toast?.success?.(tx('Copiado')) } catch { toast?.error?.(tx('No se pudo copiar')) } }}
            className="flex items-center justify-center gap-1 rounded-xl border border-dark-600 py-2 font-semibold text-dark-100"><Copy size={14} /> {tx('Copiar')}</button>
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
  const b = billing || {}
  const precios = b.precios || { mensual: 9.99, anual: 99 }
  const empezar = b.falta_tarjeta
  return (
    <div className="mx-auto max-w-md">
      <section className="overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-500/[.2] via-dark-900 to-dark-900 p-5 text-center shadow-lg shadow-black/20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-200">
          {empezar ? <Sparkles size={28} /> : <CalendarClock size={28} />}
        </div>
        <h1 className="mt-3 text-[22px] font-extrabold leading-tight text-dark-50">
          {empezar ? tx('Empieza tus 7 días gratis') : b.status === 'suspended' ? tx('Hay un pago pendiente') : b.status === 'vencido' ? tx('Tu regalo ha terminado')
            : b.status === 'vencido_play' ? tx('Tu suscripción ha terminado') : tx('Tu prueba ha terminado')}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-snug text-dark-300">
          {empezar
            ? tx('Añade tu tarjeta para activar la prueba. Hoy no se cobra nada y puedes cancelar cuando quieras antes del primer cobro.')
            : tx('Tus rutas y tu historial siguen aquí. Para seguir repartiendo con la app, activa tu suscripción.')}
        </p>
        {empezar && (
          <ul className="mx-auto mt-3 max-w-[300px] space-y-1.5 text-left text-[13px] text-dark-200">
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Hoy: 0 €')}</li>
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('El {fecha}: {mes} o {ano}', { fecha: fecha(b.cobro_al_suscribir || b.trial_ends), mes: `${euros(precios.mensual)}${tx('/mes')}`, ano: `${euros(precios.anual)}${tx('/año')}` })}</li>
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Cancela antes y no pagas nada')}</li>
          </ul>
        )}
      </section>
      {enApp ? (
        b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled'
          ? <p className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 p-4 text-center text-[13px] text-dark-300">{tx('Revisa el pago de tu suscripción.')}</p>
          : <PagarConPlay b={b} toast={toast} recargar={recargar} titulo={empezar ? tx('Elige cómo quieres pagar después') : tx('Elige tu plan')} />
      ) : b.status === 'suspended' && b.pago_proveedor === 'stripe' && b.stripe_status !== 'canceled' ? (
        // Pago fallido con la suscripción viva: se arregla la tarjeta, no se
        // contrata otra (saldrían dos cobros).
        <BotonPortal toast={toast} texto={tx('Revisar mi tarjeta y pagar')} principal />
      ) : (
        <Suscribirse b={b} precios={precios} toast={toast} titulo={empezar ? tx('Elige cómo quieres pagar después') : tx('Elige tu plan')} />
      )}
      <Canjear toast={toast} recargar={recargar} />
      <button onClick={irACuenta} className="mt-4 w-full text-center text-[13px] font-semibold text-dark-400">{tx('Ver mi cuenta')}</button>
    </div>
  )
}
