import { useEffect, useState } from 'react'
import { Clock, Sparkles, AlertTriangle } from 'lucide-react'
import { getOrgBilling, getBillingConfig, stripeSuscripcion } from './api'
import { getAdmin, getOrgId } from './auth'
import { useT } from '../i18n'

// Convierte claves antiguas (capitalizadas) a las nuevas (lowercase)
const PLAN_KEY_MAP = {
  Starter: 'basico',
  Forensics: 'flota',
  Max: 'flota',
  Pro: 'pro',
  Enterprise: 'enterprise',
}
const PLAN_LABELS = { basico: 'Básico', pro: 'Pro', flota: 'Flota', enterprise: 'Enterprise', operacion: 'Esencial', completo: 'Pro', holding: 'Empresa', autonomo: 'Repartidor' }

export default function TrialBanner() {
  const { t } = useT()
  const [billing, setBilling] = useState(null)
  const [cfg, setCfg] = useState(null)

  useEffect(() => {
    getOrgBilling().then((r) => setBilling(r.data)).catch(() => setBilling(null))
    getBillingConfig().then((r) => setCfg(r.data)).catch(() => setCfg(null))
  }, [])

  // Al volver de Stripe (?pago=ok) la activación llega por el webhook unos
  // segundos después: se vuelve a preguntar hasta verla activa (máx. 1 min).
  const [pagoOk] = useState(() => new URLSearchParams(window.location.search).get('pago') === 'ok')
  useEffect(() => {
    if (!pagoOk || billing?.status === 'active') return undefined
    let n = 0
    const t = setInterval(() => {
      n += 1
      getOrgBilling().then((r) => { setBilling(r.data); if (r.data?.status === 'active' || n >= 12) clearInterval(t) }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [pagoOk, billing?.status])

  if (!billing) return null
  if (billing.account_type === 'owner' || billing.status === 'owner') return null
  if (billing.status === 'active') {
    return pagoOk ? (
      <div className="flex items-center gap-2 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200">
        <Sparkles size={14} /> Suscripción activa. ¡Gracias!
      </div>
    ) : null
  }
  if (pagoOk && billing.status !== 'active') {
    return (
      <div className="flex items-center gap-2 bg-sky-500/15 px-4 py-2 text-sm text-sky-200">
        <Clock size={14} /> Pago recibido, activando tu cuenta…
      </div>
    )
  }

  const days = billing.days_left
  const required = billing.required
  const adminSlug = getAdmin()?.slug || ''
  const orgId = getOrgId()

  // Normalizar clave de plan (soporta formato antiguo y nuevo)
  // El plan lo dice el SERVIDOR; lo guardado al registrarse es solo respaldo
  // (a un autónomo le salía «Pasar a Pro»).
  const rawPlan = billing.plan || localStorage.getItem('flota_plan') || 'pro'
  const planKey = PLAN_KEY_MAP[rawPlan] || rawPlan.toLowerCase()
  const planLabel = PLAN_LABELS[planKey] || planKey
  const isEnterprise = planKey === 'enterprise'

  // Modo de facturación elegido en el registro
  const billingMode = localStorage.getItem('flota_billing') || 'monthly'

  // URL de checkout: anual primero (si existe), luego mensual, luego fallback a flota/pro
  const checkoutUrl =
    (billingMode === 'annual' ? cfg?.checkout?.[`${planKey}_annual`] : null) ||
    cfg?.checkout?.[planKey] ||
    cfg?.checkout?.flota ||
    cfg?.checkout?.pro

  const goPay = async () => {
    if (isEnterprise) { window.location.href = '/contacto?asunto=Enterprise'; return }
    // Con Stripe la sesión de pago la crea el servidor (lleva la empresa y lo
    // que le queda de prueba) y aquí solo se va a la URL que devuelve.
    if (cfg?.provider === 'stripe') {
      try {
        const { data } = await stripeSuscripcion(billing?.plan || planKey, billingMode === 'annual')
        if (data?.url) { window.location.href = data.url; return }
      } catch (e) { alert(e?.response?.data?.detail || 'No se pudo abrir el pago. Inténtalo en un momento.'); return }
    }
    if (!checkoutUrl) return alert('Pasarela de pago no configurada todavía.')
    if (!orgId) return alert('No hemos podido identificar tu organización. Cierra sesión y vuelve a entrar.')
    const u = new URL(checkoutUrl)
    u.searchParams.set('checkout[custom][org_id]', orgId)
    if (adminSlug) u.searchParams.set('checkout[custom][slug]', adminSlug)
    window.location.href = u.toString()
  }

  const ctaText = isEnterprise ? `${t('trial.contact')} (${planLabel})` : `${t('trial.goto')} ${planLabel}`
  // Dentro de la app de Play Store, el botón de pagar solo si la app está en
  // el programa de ofertas externas de Google (`pago_en_app`): fuera de él,
  // llevar al pago desde la app va contra la política de Play.
  const enApp = (() => {
    try { return sessionStorage.getItem('flota_app') === '1' || /^android-app:\/\//.test(document.referrer) } catch { return false }
  })()
  const canShowCta = isEnterprise || (cfg?.ready && (!enApp || cfg?.pago_en_app))

  if (required) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-red-500/20 px-4 py-2 text-sm text-red-200">
        <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {t('trial.ended')}</span>
        {canShowCta && <button onClick={goPay} className="rounded-md bg-red-500/30 px-3 py-1 text-xs font-bold hover:bg-red-500/40">{ctaText} · {t('trial.activate')}</button>}
      </div>
    )
  }
  if (billing.status === 'trial') {
    const urgent = days != null && days <= 3
    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${urgent ? 'bg-amber-500/20 text-amber-200' : 'bg-sky-500/15 text-sky-200'}`}>
        <span className="flex items-center gap-1.5">
          {urgent ? <AlertTriangle size={14} /> : <Clock size={14} />}
          {days != null
            ? <>{t('trial.free')} <b>{planLabel}</b>: {t('trial.days.left')} <b>{days} {days === 1 ? t('trial.day') : t('trial.days')}</b>.</>
            : t('trial.on')}
        </span>
        {canShowCta && <button onClick={goPay} className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-bold ${urgent ? 'bg-amber-500/30 hover:bg-amber-500/40' : 'bg-sky-500/30 hover:bg-sky-500/40'}`}><Sparkles size={12} /> {ctaText}</button>}
      </div>
    )
  }
  if (billing.status === 'suspended') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-red-500/20 px-4 py-2 text-sm text-red-200">
        <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {t('trial.suspended')}</span>
        {canShowCta && <button onClick={goPay} className="rounded-md bg-red-500/30 px-3 py-1 text-xs font-bold hover:bg-red-500/40">{t('trial.reactivate')}</button>}
      </div>
    )
  }
  return null
}
