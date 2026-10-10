import { useEffect, useState } from 'react'
import { Zap, Loader2, ScanLine, Route, Navigation, MessageCircle, Camera, Check, ArrowRight } from 'lucide-react'
import { API_BASE, DRIVER_TOKEN_KEY } from '../services/api'
import { MARCA } from '../marca'
import { tx, useIdioma, IDIOMAS, cambiarIdioma, idioma, txError, locale } from '../lib/idioma'
import { medirAccion, varianteAB } from '../lib/analitica'
import { evento, eventoUnaVez } from '../lib/metaPixel'
import { useInvitacion } from '../lib/referido'
import AltaRapida from './AltaRapida'
import { PARADAS_GRATIS, promoGratis, fechaPromo, eurosRef } from '../lib/precios'
/* «Invita y gana» se paga por Bizum: solo se anuncia a quien está en España (por la hora del móvil). */
const enEspana = () => { try { return /^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) } catch { return true } }

/* ── LA PÁGINA DEL ANUNCIO DE REPARTIDORES (04-10-2026) ──────────────────────
   Medido: de 410 personas que llegaron del anuncio al formulario de alta, 0
   se dieron de alta; casi todas se fueron sin pasar de la primera pantalla.
   El anuncio promete «tu ruta ordenada sola» y aterrizaban en «nombre,
   correo, contraseña» de una app que no habían visto. Aquí primero se VE la
   app (capturas reales) y se PRUEBA sin registrarse, con paradas de ejemplo;
   el alta viene después, cuando ya sabe lo que es. */

const VENTAJAS = [
  [Camera, 'Foto a la etiqueta: la dirección y el teléfono entran solos'],
  [Route, 'La ruta se ordena sola por tiempo, con el tráfico típico'],
  [Navigation, 'Te guía con voz hasta cada puerta, dentro de la app'],
  [MessageCircle, 'Avisa al cliente con tu hora de llegada'],
  [ScanLine, 'Escanea los paquetes al cargar y sabes dónde va cada uno'],
]

const PREGUNTAS = [
  ['¿Sirve con los paquetes de mi agencia?', 'Sí. Escaneas el código de la etiqueta o le haces una foto y la app intenta leer la dirección (si no la lee, la escribes tú), o pegas tu lista de direcciones. No necesita conectarse con tu agencia.'],
  ['¿Qué hacéis con mis datos y mi ubicación?', 'La foto de la etiqueta se lee en tu móvil. Tu ubicación solo se usa para guiarte y no se guarda. Los datos de tus clientes se borran solos a los días que tú fijes.'],
  ['¿Cuánto cuesta?', promoGratis()
    ? 'Gratis y sin límite hasta el 31 de diciembre, sin tarjeta. Después sigues gratis con hasta 15 paradas al día, o sin tope por 9,99 € al mes o 99 € al año. Cancelas cuando quieras desde la propia app.'
    : 'Gratis para siempre hasta 15 paradas al día, sin tarjeta. Sin tope: 9,99 € al mes o 99 € al año, y los 7 primeros días van sin tope. Cancelas cuando quieras desde la propia app.'],
  ['¿Tengo que instalar algo?', 'Funciona en el navegador de cualquier móvil, Android o iPhone: la añades a tu pantalla de inicio y se abre como una app. La app de Google Play y la de App Store llegarán próximamente.'],
]

/* QUÉ VERSIÓN VE CADA VISITA (06-10-2026). Ni «verla primero» (04-10) ni «el alta arriba»
   (05-10) trajeron altas: de 1.107 visitas de TikTok, el 88 % se fue sin hacer nada más.
   En vez de otro cambio a ojo, las dos a la vez:
     a — la de ahora: el formulario de alta arriba.
     b — primero el vídeo de la app y dos botones; el formulario se abre al pulsar.
   Sale de la clave de sesión (analitica.js), así que el informe la recalcula sin
   guardar nada más. `?v=a` / `?v=b` la fuerza para revisarla. */
function versionDe() {
  try {
    const v = new URLSearchParams(window.location.search).get('v')
    if (v === 'a' || v === 'b') return v
  } catch { /* sin URL: la de la sesión */ }
  return varianteAB()
}

/* Hasta ahora solo se sabía si alguien pulsaba; no si se quedaba a mirar. Dos señales,
   una vez por visita: sigue en la página a los 10 s, y ha bajado hasta la mitad. */
function useMedirInteres() {
  useEffect(() => {
    const t = setTimeout(() => medirAccion('rep_10s'), 10000)
    let mitad = false
    const alBajar = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      if (!mitad && h > 0 && window.scrollY / h >= 0.5) {
        mitad = true
        medirAccion('rep_mitad')
        // Para que el anuncio busque gente así y no a quien pulsa y se va (10-10-2026).
        eventoUnaVez('ViewContent', { content_name: 'repartidores_interes' })
        window.removeEventListener('scroll', alBajar)
      }
    }
    window.addEventListener('scroll', alBajar, { passive: true })
    return () => { clearTimeout(t); window.removeEventListener('scroll', alBajar) }
  }, [])
}

export default function Repartidores() {
  const lang = useIdioma()
  const invitacion = useInvitacion()
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const [version] = useState(versionDe)
  const [verAlta, setVerAlta] = useState(false)
  useMedirInteres()
  const capturas = idioma() === 'zh' ? 'zh' : 'es'
  const video = ['es', 'en', 'pt', 'fr', 'it', 'de', 'zh'].includes(idioma()) ? idioma() : 'es'

  async function probar() {
    medirAccion('rep_probar')
    evento('Lead', { content_name: 'probar_demo' })   // intención: la señal con la que Meta optimiza los anuncios
    setOcupado(true); setErr('')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-reparto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol: 'autonomo' }),
      })
      const j = await r.json()
      if (!r.ok || !j.access_token) throw new Error(txError(j, 'No se pudo abrir la prueba'))
      localStorage.setItem(DRIVER_TOKEN_KEY, j.access_token)
      localStorage.setItem('flota_driver', JSON.stringify(j.driver))
      window.location.href = '/conductor?vista=ruta'
    } catch (e) { setErr(e.message || tx('Sin conexión')); setOcupado(false) }
  }

  /* EL ALTA VA DENTRO DE LA PORTADA (05-10-2026): ver AltaRapida. Probarla sin registrarse queda como
     segunda opción, para quien quiere verla antes de dar el correo. */
  const botonProbar = (
    <button onClick={probar} disabled={ocupado}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-400/50 py-3.5 text-[15.5px] font-bold text-brand-200 active:scale-[.99] disabled:opacity-60">
      {ocupado ? <Loader2 size={18} className="animate-spin" /> : <Route size={18} />} {tx('Probarla ahora, sin registrarme')}
    </button>
  )

  /* Las piezas de la portada; cada versión las ordena a su manera. */
  /* PARA QUIÉN ES (05-10-2026): quien reparte para una agencia, una plataforma o un súper
     tiene que verse reflejado nada más entrar. Las marcas son de sus dueños; no hay relación. */
  const paraQuien = (
    <div className="mt-3">
      <p className="text-[13px] font-semibold text-dark-200">{tx('Sirve igual si repartes para una agencia, una plataforma o un súper:')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {['Paquetería', 'Amazon', 'MRW', 'Nacex', 'Tipsa', 'Glovo', 'Súper a domicilio'].map((m) => (
          <span key={m} className="rounded-full border border-dark-700 bg-dark-900 px-2.5 py-1 text-[12px] font-semibold text-dark-100">{tx(m)}</span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-dark-500">{tx('Marcas de sus dueños, sin relación con ellas. Tú metes los paquetes y la app ordena la ruta.')}</p>
    </div>
  )
  const textoGratis = (
    <p className="mt-2 text-center text-[12.5px] text-dark-300">{invitacion && !promoGratis() ? tx('{n} días gratis · sin tarjeta · cancelas cuando quieras', { n: invitacion.dias }) : promoGratis() ? tx('Gratis y sin límite hasta el {fecha} · sin tarjeta', { fecha: fechaPromo(locale()) }) : tx('Gratis hasta {n} paradas al día · sin tarjeta', { n: PARADAS_GRATIS })}</p>
  )
  const alta = (enfocar) => (<>
    <AltaRapida dias={invitacion ? invitacion.dias : 7} enfocar={enfocar} />
    {textoGratis}
  </>)
  const probarBloque = (<>
    <div className="mt-3">{botonProbar}</div>
    <p className="mt-1.5 text-center text-[12px] text-dark-500">{tx('Con 8 paradas de ejemplo. Sin datos ni tarjeta: pruébala en 1 minuto.')}</p>
    {err && <p role="alert" className="mt-2 text-center text-[13px] text-red-300">{err}</p>}
  </>)
  /* El vídeo de la app (el mismo de TikTok, mudo y en bucle): se ve lo que hace antes de
     pulsar nada. El póster es la primera captura, de reserva si el vídeo no carga. */
  const videoApp = (ancho) => (
    <video src={`/videos/web-${video}.mp4?v=1`} poster={`/capturas-ruta/${capturas}/1-ruta.webp`} autoPlay muted loop playsInline preload="metadata"
      width="390" height="693" aria-label={tx('Vídeo de la app')}
      className={`${ancho} shrink-0 snap-center rounded-[22px] border border-dark-700 bg-dark-900 object-cover shadow-2xl shadow-black/40`} />
  )
  const capturasApp = (conVideo) => (
    <div className="-mx-5 mt-7 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
      {conVideo && videoApp('w-[62%] max-w-[240px]')}
      {['2-mapa', '3-navegando'].map((n) => (
        <img key={n} src={`/capturas-ruta/${capturas}/${n}.webp`} alt="" loading="lazy" width="390" height="844"
          className="w-[62%] max-w-[240px] shrink-0 snap-center rounded-[22px] border border-dark-700 shadow-2xl shadow-black/40" />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-950 px-5 pb-10 pt-6 text-dark-100">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600"><Zap size={18} className="text-white" /></div>
          <b className="text-[17px] text-dark-50">FDS</b>
          <select value={lang} onChange={(e) => cambiarIdioma(e.target.value)} aria-label="Idioma / Language"
            className="ml-auto rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-[13px] text-dark-100">
            {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {invitacion && (
          <p className="mb-3 rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-[13px] font-semibold text-violet-200">
            🎁 {promoGratis() ? tx('Te ha invitado un compañero · gratis y sin límite hasta el {fecha}', { fecha: fechaPromo(locale()) }) : tx('Te ha invitado un compañero: {n} días gratis', { n: invitacion.dias })}
          </p>
        )}
        <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-brand-300">{tx('Para quien reparte solo')}</p>
        <h1 className="mt-1.5 font-display text-[32px] font-extrabold leading-[1.05] text-dark-50">{tx('Tu ruta de reparto, ordenada sola.')}</h1>
        <p className="mt-2 text-[15px] leading-snug text-dark-300">{tx('Haz una foto a la etiqueta o escanea el paquete: la app ordena las paradas por tiempo y te lleva con voz hasta cada puerta.')}</p>
        {/* 10-10-2026: lo que promete el anuncio, arriba del todo (antes solo salía junto al formulario). */}
        {promoGratis() && (
          <div className="mt-3.5 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-2.5">
            <p className="text-[14.5px] font-bold leading-snug text-amber-200">🎁 {tx('Gratis y sin límite hasta el {fecha} · sin tarjeta', { fecha: fechaPromo(locale()) })}</p>
            {enEspana() && <p className="mt-0.5 text-[13.5px] leading-snug text-dark-200">💶 {tx('Gana {euros} por cada compañero que la use.', { euros: eurosRef(undefined, locale()) })}</p>}
          </div>
        )}

        {version === 'b' ? (<>
          {/* B: lo primero que se ve es la app funcionando, como en el vídeo del anuncio. */}
          <div className="mt-4 flex items-center gap-3">
            {videoApp('w-[44%] max-w-[170px]')}
            <ul className="flex-1 space-y-2.5">
              {VENTAJAS.slice(0, 3).map(([I, t]) => (
                <li key={t} className="flex items-start gap-2 text-[13.5px] leading-snug text-dark-100">
                  <I size={16} className="mt-0.5 shrink-0 text-brand-300" /> <span>{tx(t)}</span>
                </li>
              ))}
            </ul>
          </div>
          {verAlta ? alta(true) : (
            <button onClick={() => { medirAccion('rep_abrir_alta'); setVerAlta(true) }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-4 text-[17px] font-extrabold text-[#04121a] shadow-[0_12px_30px_-10px_rgba(20,231,216,.6)] active:scale-[.99]">
              {tx('Crear mi cuenta gratis')} <ArrowRight size={19} />
            </button>
          )}
          {!verAlta && textoGratis}
          {probarBloque}
          {paraQuien}
          {capturasApp(false)}
        </>) : (<>
          {paraQuien}
          {alta(false)}
          {probarBloque}
          {capturasApp(true)}
        </>)}

        <ul className="mt-6 space-y-3">
          {VENTAJAS.map(([I, t]) => (
            <li key={t} className="flex items-start gap-3 text-[15px] text-dark-100">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/15"><I size={17} className="text-brand-300" /></span>
              <span className="pt-1">{tx(t)}</span>
            </li>
          ))}
        </ul>

        {/* LAS DUDAS QUE FRENAN ANTES DE DAR EL CORREO (05-10-2026): respondidas aquí. */}
        <section className="mt-8" aria-label={tx('Preguntas frecuentes')}>
          <h2 className="mb-2 text-[16px] font-bold text-dark-50">{tx('Preguntas frecuentes')}</h2>
          <div className="divide-y divide-dark-800 overflow-hidden rounded-2xl border border-dark-700 bg-dark-900">
            {PREGUNTAS.map(([q, r]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-semibold text-dark-100">
                  {tx(q)} <span className="text-brand-300 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[13.5px] leading-relaxed text-dark-300">{tx(r)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-dark-700 bg-dark-900 p-5">
          <h2 className="text-[18px] font-bold text-dark-50">{tx('¿Te convence? Créate la cuenta')}</h2>
          <ul className="mt-3 space-y-1.5 text-[14px] text-dark-300">
            {promoGratis() ? (<>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Gratis y sin límite hasta el {fecha}', { fecha: fechaPromo(locale()) })}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Después, gratis hasta {n} paradas al día, o sin tope por 9,99 €/mes', { n: PARADAS_GRATIS })}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tarjeta: te registras y empiezas ya')}</li>
            </>) : (<>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Gratis para siempre hasta {n} paradas al día', { n: PARADAS_GRATIS })}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tope: 9,99 €/mes o 99 €/año, con 7 días de prueba')}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Cancelas cuando quieras desde la app')}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tarjeta: la prueba empieza ya y hoy no pagas nada')}</li>
            </>)}
          </ul>
          <a href="/registro?sector=autonomo&plan=autonomo" onClick={() => { medirAccion('rep_alta'); evento('Lead', { content_name: 'crear_cuenta' }) }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-400/50 py-3.5 text-[15.5px] font-bold text-brand-200">
            {tx('Crear mi cuenta')} <ArrowRight size={17} />
          </a>
          <p className="mt-3 text-center text-[13px] text-dark-400">{tx('¿Ya tienes cuenta?')} <a href="/panel/login" className="font-semibold text-brand-300">{tx('Entrar')}</a></p>
        </section>

        <div className="mt-6">{botonProbar}</div>

        <p className="mt-8 text-center text-[12px] text-dark-500">
          {/* LSSI art. 10: quién está detrás, a un clic desde la página que se comparte (10-10-2026:
              un grupo de Telegram borró el enlace porque desde aquí no se llegaba al aviso legal). */}
          {MARCA.nombre} · <a href="/aviso-legal" className="hover:underline">{tx('Aviso legal')}</a> · <a href="/privacidad" className="hover:underline">{tx('Privacidad')}</a> · <a href="/terminos" className="hover:underline">{tx('Términos')}</a> · <a href="/cookies" className="hover:underline">{tx('Cookies')}</a>
        </p>
      </div>
    </div>
  )
}
