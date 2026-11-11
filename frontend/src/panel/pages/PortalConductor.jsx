import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import QRCode from 'qrcode'
import { useT } from '../../i18n'
import { Shield, Copy, Check, ExternalLink, Info, Link2, QrCode, Smartphone } from 'lucide-react'
import { getAdmin } from '../auth'
import { origen } from '../../marca'
import { GOOGLE_PLAY_URL } from '../../components/GooglePlayBadge'
import { esAppIOS } from '../../lib/plataforma'

const PORTAL_BASE = origen()

// Renderiza texto con <b>...</b> sin dangerouslySetInnerHTML
function BoldText({ str, className }) {
  const parts = str.split(/(<b>.*?<\/b>)/g)
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith('<b>') ? <b key={i}>{p.slice(3, -4)}</b> : p
      )}
    </span>
  )
}

function Link({ label, url, big }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className={big ? 'rounded-xl border border-brand-500/40 bg-brand-500/5 p-4' : ''}>
      {label && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dark-400">{label}</div>}
      <div className="flex gap-2">
        <input readOnly value={url} className="input flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <button onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="btn-secondary flex items-center gap-1.5 whitespace-nowrap text-sm">
          {copied ? <><Check size={14} /> {t('portal.copied')}</> : <><Copy size={14} /> {t('portal.copy')}</>}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost px-2" title="Abrir"><ExternalLink size={15} /></a>
      </div>
    </div>
  )
}

export default function PortalConductor() {
  const { centers: ctxCenters } = useOutletContext?.() || {}
  const { t } = useT()
  const admin = getAdmin()
  const slug = admin?.slug || ''
  const centers = useMemo(() => (Array.isArray(ctxCenters) && ctxCenters.length ? ctxCenters : (admin?.centers || [])), [ctxCenters, admin])

  const empresa = `${PORTAL_BASE}/conductor/#${slug}`
  // El QR, hecho en el navegador (03-11-2026): antes se pedía a api.qrserver.com con el enlace de la empresa (y la IP
  // de quien lo mira), un servicio de fuera que no estaba en los textos legales.
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(empresa, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')) }, [empresa])
  /* LA APP DE ANDROID (11-11-2026, portal_inicio-12): la usan ya los conductores de una nave y aquí solo había
     enlaces web, así que para llevar a los de las otras no había nada que enseñar. Su enlace y su QR, hechos en el
     navegador como el de arriba. Dentro de la app de iPhone NO sale: allí no se nombran otras tiendas. */
  const conApp = !esAppIOS()
  const [qrApp, setQrApp] = useState('')
  const [copiadoApp, setCopiadoApp] = useState(false)
  useEffect(() => {
    if (!conApp) return
    QRCode.toDataURL(GOOGLE_PLAY_URL, { margin: 1, width: 220 }).then(setQrApp).catch(() => setQrApp(''))
  }, [conApp])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <Shield size={22} className="text-brand-400" />
        <h1 className="rise font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">{t('portal.title')}</h1>
      </div>

      <p className="mb-5 text-sm text-dark-300"><BoldText str={t('portal.intro')} /></p>

      {/* Enlace principal de la empresa + QR */}
      <div className="card mb-4 p-5">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <Link big label={t('portal.company.link')} url={empresa} />
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-lg bg-white p-2">
              {qr ? <img src={qr} alt="QR del portal conductor" width="160" height="160" /> : <div className="h-[160px] w-[160px]" />}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-dark-500"><QrCode size={11} /> {t('portal.scan.mobile')}</div>
          </div>
        </div>
      </div>

      {conApp && (
        <div className="card mb-4 p-5" data-testid="portal-app-android">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark-200"><Smartphone size={16} /> {t('portal.app.title')}</div>
          <p className="mb-3 text-sm text-dark-400">{t('portal.app.desc')}</p>
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            {/* Botones y no la caja de texto de los enlaces del portal: esas cajas son SOLO enlaces al portal web
                (lo vigila ios-sin-pagos.spec.js), y el de la tienda no lo es. */}
            <div className="flex flex-wrap items-center gap-2">
              <a href={GOOGLE_PLAY_URL} target="_blank" rel="noreferrer"
                className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-4 text-sm">
                <ExternalLink size={14} /> {t('portal.app.open')}
              </a>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(GOOGLE_PLAY_URL).catch(() => {}); setCopiadoApp(true); setTimeout(() => setCopiadoApp(false), 1500) }}
                className="btn-secondary inline-flex min-h-[44px] items-center gap-1.5 px-4 text-sm">
                {copiadoApp ? <><Check size={14} /> {t('portal.copied')}</> : <><Copy size={14} /> {t('portal.copy')}</>}
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-lg bg-white p-2">
                {qrApp ? <img src={qrApp} alt={t('portal.app.qr')} width="160" height="160" /> : <div className="h-[160px] w-[160px]" />}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-dark-500"><QrCode size={11} /> {t('portal.scan.mobile')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Un enlace por estación */}
      {centers.length > 0 && (
        <div className="card mb-4 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark-200"><Link2 size={16} /> {t('portal.station.link')}</div>
          <p className="mb-3 text-sm text-dark-400">{t('portal.station.desc')}</p>
          <div className="space-y-3">
            {centers.map((c) => (
              <Link key={c} label={c} url={`${PORTAL_BASE}/conductor/?c=${encodeURIComponent(c)}#${slug}`} />
            ))}
          </div>
        </div>
      )}

      {/* Cómo funciona */}
      <div className="card p-5 text-sm text-dark-300">
        <div className="mb-2 flex items-center gap-2 font-semibold text-dark-200"><Info size={15} /> {t('portal.how')}</div>
        <ol className="ml-4 list-decimal space-y-1.5 text-dark-400">
          <li><BoldText str={t('portal.how.1')} /></li>
          <li><BoldText str={t('portal.how.2')} /></li>
          <li><BoldText str={t('portal.how.3')} /></li>
          <li><BoldText str={t('portal.how.4')} /></li>
        </ol>
        <p className="mt-3 text-xs text-dark-500">{t('portal.security')}</p>
      </div>
    </div>
  )
}
