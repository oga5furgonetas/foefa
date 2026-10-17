import { useEffect, useState } from 'react'
import { Download, Share, X, Smartphone, Loader2, ExternalLink, CheckCircle2, Copy } from 'lucide-react'
import QRCode from 'qrcode'
import {
  alCambiarInstalable, sePuedeInstalar, instalar, yaEsApp, esIphone, esAndroid, navegadorInterno, enlaceChrome,
} from '../lib/instalar'
import { tx, useIdioma } from '../lib/idioma'
import { desdeChina } from '../lib/apiBase'
import { crearPaseMovil } from '../panel/api'
import { medirAccion } from '../lib/analitica'

/* En China no hay Google Play y casi ningún Android trae Chrome (sin él no
   se instala la web): allí se descarga la app de China (WebView propio). */
export const APK_CHINA = '/descargas/FDS-china.apk'
/* Fuera de China, mientras Play está en prueba cerrada: la misma app de Play con
   paquete propio (android/, variante «web»). Abre Chrome con la sesión que ya hay. */
export const APK_ANDROID = '/descargas/FDS.apk'

/* Lo que necesitan la tarjeta y el paso de después del alta: qué móvil es, si
   Chrome deja instalar en un toque y cómo salir del navegador de TikTok/Instagram
   sin volver a entrar (un pase de un solo uso, ver /auth/pase-movil). */
function useInstalar() {
  const [puede, setPuede] = useState(sePuedeInstalar())
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [enlace, setEnlace] = useState('')
  useEffect(() => alCambiarInstalable(setPuede), [])
  const iphone = esIphone()
  const android = !iphone && esAndroid()
  const interno = navegadorInterno()
  const apk = android && desdeChina() ? APK_CHINA : APK_ANDROID
  async function abrirFuera() {
    setOcupado(true)
    medirAccion('instalar_abrir_fuera')
    try {
      const { data } = await crearPaseMovil()
      const ruta = `/pase?p=${encodeURIComponent(data.pase)}`
      setEnlace(`${window.location.origin}${ruta}`)
      window.location.href = iphone ? `x-safari-${window.location.origin}${ruta}` : enlaceChrome(ruta)
    } catch { setFallo(true) }
    // Si el navegador de la app no deja salir, se queda aquí: se explica a mano.
    setTimeout(() => { setOcupado(false); setFallo(true) }, 2500)
  }
  return { puede, iphone, android, interno, apk, ocupado, fallo, abrirFuera, enlace }
}

const boton = 'flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-60'
const secundario = 'flex w-full items-center justify-center gap-2 rounded-xl border border-dark-700 py-2.5 text-[14px] font-semibold text-dark-100'

function PasosIphone() {
  return (
    <ol className="space-y-1.5 text-[13px] text-dark-200">
      <li className="flex items-center gap-2">1. {tx('Abre esta página en Safari.')}</li>
      <li className="flex items-center gap-2">2. {tx('Pulsa')} <Share size={15} className="text-sky-300" /> <b>{tx('Compartir')}</b> {tx('(abajo).')}</li>
      <li>3. {tx('Elige «Añadir a pantalla de inicio».')}</li>
      <li className="pt-1 text-[12px] text-dark-400">{tx('En iPhone no se descarga de la App Store: se instala así, desde Safari, y funciona como una app.')}</li>
      <li className="text-[12px] text-dark-400">{tx('Al abrirla desde el icono, entra una vez con tu correo y tu contraseña.')}</li>
    </ol>
  )
}

function DescargarApk({ apk, principal }) {
  return (
    <>
      <a href={apk} download onClick={() => medirAccion('instalar_apk')} className={principal ? boton : secundario}>
        <Download size={17} /> {tx('Descargar la app para Android')}
      </a>
      <p className="text-[12px] leading-snug text-dark-400">{tx('Al instalarla, el móvil puede pedirte permitir apps de esta fuente: es la app de FDS, firmada por nosotros.')}</p>
    </>
  )
}

function NoSeAbrio({ iphone, enlace }) {
  const [copiado, setCopiado] = useState(false)
  const nav = iphone ? 'Safari' : 'Chrome'
  async function copiar() {
    medirAccion('instalar_copiar_enlace')
    try { await navigator.clipboard.writeText(enlace); setCopiado(true) } catch { setCopiado(false) }
  }
  return (
    <div data-testid="no-se-abrio" className="space-y-2 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-[13px] leading-snug text-amber-100">
      <p className="font-semibold">
        {iphone
          ? tx('¿No se ha abierto? Pulsa ··· (arriba) y «Abrir en el navegador».')
          : tx('¿No se ha abierto? Pulsa ⋮ (arriba) y «Abrir en Chrome» o «Abrir en el navegador».')}
      </p>
      {enlace && (<>
        <p>{tx('O copia este enlace, abre {nav} y pégalo arriba: entras ya con tu cuenta (vale 10 minutos).', { nav })}</p>
        <input readOnly value={enlace} aria-label={tx('Enlace para entrar')} onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-amber-400/40 bg-dark-950 px-2.5 py-2 text-[12px] text-dark-100" />
        <button type="button" onClick={copiar} className={boton}>
          <Copy size={16} /> {copiado ? tx('Copiado: ábrelo en {nav} y pégalo arriba', { nav }) : tx('Copiar el enlace')}
        </button>
      </>)}
    </div>
  )
}

/* Lo que se le ofrece a cada uno: en un toque si se puede; si está dentro de
   TikTok/Instagram, salir a Chrome (o Safari) ya con su cuenta; si no, el APK
   (Android) o los pasos de Safari (iPhone). */
function Opciones({ ins, onInstalada }) {
  const { puede, iphone, android, interno, apk, ocupado, fallo, abrirFuera, enlace } = ins
  if (interno && (android || iphone)) {
    return (
      <div className="space-y-2.5">
        <p className="text-[13px] leading-snug text-dark-200">
          {interno === 'app'
            ? tx('Estás en el navegador de otra app: desde aquí el móvil no deja instalar nada.')
            : tx('Estás en el navegador de {app}: desde aquí el móvil no deja instalar nada.', { app: interno })}
        </p>
        <button onClick={abrirFuera} disabled={ocupado} className={boton}>
          {ocupado ? <Loader2 size={17} className="animate-spin" /> : <ExternalLink size={17} />}
          {iphone ? tx('Abrir en Safari') : tx('Abrir en Chrome')}
        </button>
        <p className="text-[12px] leading-snug text-dark-400">{tx('Entras ya con tu cuenta, sin escribir nada.')}</p>
        {/* 17-10-2026: en el iPhone, el navegador de Facebook no deja saltar a Safari y el aviso, en letra
            pequeña, no se veía (Wanger pulsó «Abrir en Safari» 4 veces). Ahora se ve, y con el enlace de entrada
            para copiarlo y pegarlo en el navegador: entra ya con su cuenta (vale 10 minutos, una vez). */}
        {fallo && <NoSeAbrio iphone={iphone} enlace={enlace} />}
        {/* SIN APK AQUÍ (18-10-2026). Medido con las 31 altas reales de repartidor: 21 entraron desde el
            navegador de Instagram/Facebook, y 5 acabaron el día del alta pulsando «Descargar la app» desde dentro
            y no volvieron nunca (14 la descargaron y la app solo tuvo 7 sesiones en 10 días). Descargado desde
            ahí, el APK se queda en Descargas o, si se instala, abre Chrome SIN la cuenta. El camino que sí
            lleva la sesión es salir a Chrome con el pase; allí se instala en un toque o con el APK. */}
      </div>
    )
  }
  if (iphone) return <PasosIphone />
  if (android) {
    return (
      <div className="space-y-2.5">
        {puede && (
          <button onClick={async () => { medirAccion('instalar_pwa'); if (await instalar() === 'accepted') onInstalada() }} className={boton}>
            <Download size={17} /> {tx('Instalar la app')}
          </button>
        )}
        <DescargarApk apk={apk} principal={!puede} />
      </div>
    )
  }
  return null
}

/* La tarjeta «Instala FDS en tu móvil», en la app de ruta abierta desde el
   navegador. No sale si ya es app (instalada o la de Play) ni si la cerró. */
export default function InstalarApp() {
  useIdioma()
  const ins = useInstalar()
  const [oculta, setOculta] = useState(() => {
    try { return localStorage.getItem('fds_instalar_cerrado') === '1' || localStorage.getItem('fds_instalada') === '1' } catch { return false }
  })
  const [abierta, setAbierta] = useState(false)
  if (oculta || yaEsApp() || !(ins.iphone || ins.android)) return null
  function cerrar() {
    try { localStorage.setItem('fds_instalar_cerrado', '1') } catch { /* nada */ }
    setOculta(true)
  }
  return (
    <section className="mx-auto mb-4 max-w-md rounded-2xl border border-brand-400/40 bg-gradient-to-r from-brand-500/[.14] to-dark-900 p-3.5" aria-label={tx('Instalar la app')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-brand-tinta"><Smartphone size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-dark-50">{tx('Instala FDS en tu móvil')}</p>
          <p className="text-[12.5px] leading-snug text-dark-300">{tx('Con su icono, a pantalla completa y sin buscar la web cada día.')}</p>
        </div>
        <button onClick={cerrar} aria-label={tx('No mostrar más')} className="rounded p-1 text-dark-500"><X size={16} /></button>
      </div>
      <div className="mt-3">
        {/* En iPhone (Safari) los pasos ocupan: se enseñan al pedirlos. En Android, directo. */}
        {abierta || ins.android || ins.interno
          ? <Opciones ins={ins} onInstalada={() => setOculta(true)} />
          : <button onClick={() => setAbierta(true)} className={boton}><Download size={17} /> {tx('Cómo instalarla')}</button>}
      </div>
    </section>
  )
}

/* EL ÚLTIMO PASO DEL ALTA (10-10-2026). Dani: «cuando creas la cuenta, ¿te pone
   para instalar la app? Si no, ¿cómo la vas a utilizar?». Recién creada la
   cuenta, antes de la ruta, a pantalla completa: instalarla. En el ordenador, un
   QR que abre la cuenta en el móvil sin escribir nada. Se puede saltar. */
export function PasoInstalar({ onListo }) {
  const ins = useInstalar()
  const [qr, setQr] = useState('')
  const [hecho, setHecho] = useState(false)
  const movil = ins.iphone || ins.android
  useEffect(() => {
    if (movil) return
    crearPaseMovil()
      .then(({ data }) => QRCode.toDataURL(`${window.location.origin}/pase?p=${encodeURIComponent(data.pase)}`, { margin: 1, width: 220 }))
      .then(setQr).catch(() => setQr('no'))
  }, [movil])
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-dark-950/[.97] px-4 py-8 backdrop-blur" role="dialog" aria-modal="true" aria-label={tx('Último paso: instala la app')}>
      <div className="mx-auto max-w-md">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-brand-tinta"><Smartphone size={28} /></span>
        <p className="mt-5 text-[12px] font-bold uppercase tracking-[.14em] text-brand-300">{tx('Cuenta creada')}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight text-dark-50">{tx('Último paso: instala la app')}</h1>
        <p className="mt-2 text-[14px] leading-snug text-dark-300">{tx('Con su icono en el móvil, a pantalla completa y sin buscar la web: cada mañana la abres en un toque.')}</p>
        <div className="mt-6">
          {hecho ? (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-3 text-[14px] font-semibold text-emerald-200">
              <CheckCircle2 size={18} /> {tx('Instalada. Ábrela desde el icono de FDS.')}
            </p>
          ) : movil ? (
            <Opciones ins={ins} onInstalada={() => setHecho(true)} />
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-dark-800 bg-dark-900 p-4">
              {qr && qr !== 'no'
                ? <img src={qr} alt={tx('Código QR para abrir tu cuenta en el móvil')} width={140} height={140} className="shrink-0 rounded-lg bg-white" />
                : <span className="flex h-[140px] w-[140px] shrink-0 items-center justify-center rounded-lg bg-dark-800">{qr ? '—' : <Loader2 size={20} className="animate-spin text-dark-400" />}</span>}
              <p className="text-[13.5px] leading-snug text-dark-200">
                {qr === 'no'
                  ? tx('Abre {web} en el móvil y entra con tu correo y tu contraseña.', { web: window.location.host })
                  : tx('Apunta con la cámara del móvil: entras en tu cuenta sin escribir nada y desde ahí la instalas. Vale 10 minutos.')}
              </p>
            </div>
          )}
        </div>
        <button onClick={onListo} className="mt-6 w-full py-2 text-center text-[13.5px] font-semibold text-dark-400 underline underline-offset-4">
          {hecho ? tx('Seguir') : tx('Ahora no, seguir en la web')}
        </button>
      </div>
    </div>
  )
}
