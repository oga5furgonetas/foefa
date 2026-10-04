import { useState } from 'react'
import { Zap, Loader2, ScanLine, Route, Navigation, MessageCircle, Camera, Check, ArrowRight } from 'lucide-react'
import { API_BASE, DRIVER_TOKEN_KEY } from '../services/api'
import { MARCA } from '../marca'
import { tx, useIdioma, IDIOMAS, cambiarIdioma, idioma, txError } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'

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

export default function Repartidores() {
  const lang = useIdioma()
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const capturas = idioma() === 'zh' ? 'zh' : 'es'
  const video = ['es', 'en', 'pt', 'fr', 'it', 'de', 'zh'].includes(idioma()) ? idioma() : 'es'

  async function probar() {
    medirAccion('rep_probar')
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

  const botonProbar = (
    <button onClick={probar} disabled={ocupado}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-4 text-[17px] font-extrabold text-[#04121a] shadow-[0_12px_30px_-10px_rgba(20,231,216,.6)] active:scale-[.99] disabled:opacity-60">
      {ocupado ? <Loader2 size={19} className="animate-spin" /> : <Route size={19} />} {tx('Probarla ahora, sin registrarme')}
    </button>
  )

  return (
    <div className="min-h-screen bg-dark-950 px-5 pb-10 pt-6 text-dark-100">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600"><Zap size={18} className="text-white" /></div>
          <b className="text-[17px] text-dark-50">FDS</b>
          <select value={lang} onChange={(e) => cambiarIdioma(e.target.value)} aria-label="Idioma / Language"
            className="ml-auto rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-[13px] text-dark-100">
            {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-brand-300">{tx('Para quien reparte solo')}</p>
        <h1 className="mt-2 font-display text-[34px] font-extrabold leading-[1.05] text-dark-50">{tx('Tu ruta de reparto, ordenada sola.')}</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-dark-300">{tx('Haz una foto a la etiqueta o escanea el paquete: la app ordena las paradas por tiempo y te lleva con voz hasta cada puerta.')}</p>

        <div className="mt-6">{botonProbar}</div>
        <p className="mt-2 text-center text-[12.5px] text-dark-400">{tx('Con 8 paradas de ejemplo. Sin datos ni tarjeta: pruébala en 1 minuto.')}</p>
        {err && <p role="alert" className="mt-2 text-center text-[13px] text-red-300">{err}</p>}

        {/* El vídeo de la app (el mismo de TikTok, mudo y en bucle): se ve lo
            que hace antes de pulsar nada. Las capturas, de reserva si no carga. */}
        <div className="-mx-5 mt-7 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          <video src={`/videos/tiktok-${video}.mp4`} poster={`/capturas-ruta/${capturas}/1-ruta.png`} autoPlay muted loop playsInline preload="metadata"
            width="390" height="693" aria-label={tx('Vídeo de la app')}
            className="w-[62%] max-w-[240px] shrink-0 snap-center rounded-[22px] border border-dark-700 bg-dark-900 object-cover shadow-2xl shadow-black/40" />
          {['2-mapa', '3-navegando'].map((n) => (
            <img key={n} src={`/capturas-ruta/${capturas}/${n}.png`} alt="" loading="lazy" width="390" height="844"
              className="w-[62%] max-w-[240px] shrink-0 snap-center rounded-[22px] border border-dark-700 shadow-2xl shadow-black/40" />
          ))}
        </div>

        <ul className="mt-6 space-y-3">
          {VENTAJAS.map(([I, t]) => (
            <li key={t} className="flex items-start gap-3 text-[15px] text-dark-100">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/15"><I size={17} className="text-brand-300" /></span>
              <span className="pt-1">{tx(t)}</span>
            </li>
          ))}
        </ul>

        <section className="mt-8 rounded-3xl border border-dark-700 bg-dark-900 p-5">
          <h2 className="text-[18px] font-bold text-dark-50">{tx('¿Te convence? Créate la cuenta')}</h2>
          <ul className="mt-3 space-y-1.5 text-[14px] text-dark-300">
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('7 días gratis; luego 9,99 €/mes o 99 €/año')}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Cancelas cuando quieras desde la app')}</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Para empezar la prueba se pide tarjeta: hoy no se cobra nada')}</li>
          </ul>
          <a href="/registro?sector=autonomo&plan=autonomo" onClick={() => medirAccion('rep_alta')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-400/50 py-3.5 text-[15.5px] font-bold text-brand-200">
            {tx('Crear mi cuenta')} <ArrowRight size={17} />
          </a>
          <p className="mt-3 text-center text-[13px] text-dark-400">{tx('¿Ya tienes cuenta?')} <a href="/panel/login" className="font-semibold text-brand-300">{tx('Entrar')}</a></p>
        </section>

        <div className="mt-6">{botonProbar}</div>

        <p className="mt-8 text-center text-[12px] text-dark-500">
          {MARCA.nombre} · <a href="/privacidad" className="hover:underline">{tx('Privacidad')}</a> · <a href="/terminos" className="hover:underline">{tx('Términos')}</a>
        </p>
      </div>
    </div>
  )
}
