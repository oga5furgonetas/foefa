import { useEffect } from 'react'
import { Compass, Share, SquarePlus, LogIn, Check, X, ArrowRight, ScanLine, Camera, Volume2, Bell, Mic, Hand, ExternalLink } from 'lucide-react'
import { MARCA, dominio } from '../marca'
import { tx, useIdioma } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'
import { esIphone, yaEsApp, navegadorInterno } from '../lib/instalar'

/* ── FDS EN IPHONE (23-10-2026) ────────────────────────────────────────────
   Dani: «explícales a los de iPhone cómo tienen que hacer para utilizarla».
   La app no está en la App Store: en iPhone se usa desde Safari y se añade a
   la pantalla de inicio, y eso nadie lo sabe si no se le dice con pasos y
   dibujos. Esta página es para enlazarla desde la portada, el alta, la app y
   los anuncios. Todo lo que dice aquí está comprobado en Safari (23-10): el
   escáner lee con la cámara (lector propio en WebAssembly), la guía habla,
   los avisos solo llegan con la app en la pantalla de inicio, y dictar
   direcciones o las manos libres no existen en iPhone. Nada de capturas de
   Apple inventadas: iconos y texto. */

const PASOS = [
  [Compass, 'Abre esta web en Safari', 'Si has llegado desde Instagram, Facebook o TikTok, pulsa los tres puntos (···) y «Abrir en el navegador». En Safari es donde se puede añadir.'],
  [Share, 'Pulsa Compartir', 'Es el cuadrado con la flecha hacia arriba, abajo en el centro de Safari.'],
  [SquarePlus, 'Elige «Añadir a pantalla de inicio»', 'Baja en la lista hasta verlo y pulsa «Añadir» arriba a la derecha. Ya tienes el icono de FDS en tu móvil.'],
  [LogIn, 'Ábrela desde el icono y entra', 'Con tu correo y tu contraseña, una sola vez. Se abre a pantalla completa, como cualquier app.'],
]

const QUE_FUNCIONA = [
  [ScanLine, true, 'Escanear paquetes con la cámara'],
  [Camera, true, 'Foto a la etiqueta: la dirección entra sola'],
  [Volume2, true, 'La ruta ordenada y la guía con voz hasta cada puerta'],
  [Bell, true, 'Aviso por la mañana (solo con la app en la pantalla de inicio)'],
  [Mic, false, 'Dictar direcciones con la voz: en iPhone se escriben'],
  [Hand, false, 'Manos libres («entregado» sin tocar): solo en Android'],
]

export default function Iphone() {
  useIdioma()
  const iphone = esIphone()
  const instalada = iphone && yaEsApp()
  const interno = iphone && navegadorInterno()
  useEffect(() => {
    const antes = document.title
    document.title = tx('FDS en iPhone: cómo instalarla y usarla')
    medirAccion('iphone_guia')
    return () => { document.title = antes }
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 px-5 py-8 text-dark-100">
      <div className="mx-auto w-full max-w-md">
        <a href="/" className="flex items-center gap-2.5 text-dark-50">
          <img src="/favicon.svg" alt="" width="34" height="34" className="rounded-xl" />
          <b className="text-[17px]">{MARCA.app}</b>
        </a>
        <p className="mt-7 text-[12.5px] font-bold uppercase tracking-[0.14em] text-brand-300">{tx('Para iPhone')}</p>
        <h1 className="mt-2 font-display text-[30px] font-extrabold leading-[1.08] text-dark-50">{tx('Así se instala y se usa FDS en tu iPhone')}</h1>
        <p className="mt-3 text-[15px] leading-snug text-dark-300">
          {tx('No está en la App Store: se usa desde Safari y se añade a la pantalla de inicio. Queda con su icono y a pantalla completa, como una app, y es gratis.')}
        </p>

        {instalada && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-3 text-[14px] font-semibold text-emerald-100">
            <Check size={18} /> {tx('Ya la tienes en la pantalla de inicio. Abre tu ruta:')} <a href="/ruta" className="underline">{tx('Mi ruta')}</a>
          </p>
        )}
        {interno && !instalada && (
          <p className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3.5 py-3 text-[13.5px] leading-snug text-amber-100">
            {interno === 'app'
              ? tx('Estás en el navegador de otra app: desde aquí el móvil no deja instalar nada.')
              : tx('Estás en el navegador de {app}: desde aquí el móvil no deja instalar nada.', { app: interno })}
            {' '}{tx('Pulsa ··· (arriba) y «Abrir en el navegador», y sigue estos pasos.')}
          </p>
        )}

        <ol className="mt-7 space-y-3">
          {PASOS.map(([Icono, titulo, texto], i) => (
            <li key={titulo} className="flex gap-3.5 rounded-2xl border border-dark-700 bg-dark-900 p-4">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                <Icono size={24} />
                <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[12px] font-extrabold text-brand-tinta">{i + 1}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold leading-snug text-dark-50">{tx(titulo)}{i === 0 ? ` (${dominio()})` : ''}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-dark-300">{tx(texto)}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-[12.5px] leading-snug text-dark-400">
          {tx('Cuando Safari pida permiso para la cámara o la ubicación, di que sí: la cámara lee las etiquetas y la ubicación te guía (no se guarda).')}
        </p>

        <h2 className="mt-8 text-[18px] font-bold text-dark-50">{tx('Qué funciona en iPhone')}</h2>
        <ul className="mt-3 space-y-2">
          {QUE_FUNCIONA.map(([Icono, si, texto]) => (
            <li key={texto} className="flex items-center gap-3 rounded-xl border border-dark-800 bg-dark-900/60 px-3.5 py-2.5 text-[14px] text-dark-100">
              <Icono size={18} className="shrink-0 text-dark-400" />
              <span className="min-w-0 flex-1">{tx(texto)}</span>
              {si ? <Check size={18} className="shrink-0 text-emerald-400" aria-label={tx('Sí')} /> : <X size={18} className="shrink-0 text-dark-500" aria-label={tx('No')} />}
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-2.5">
          <a href="/registro?sector=autonomo&plan=autonomo" onClick={() => medirAccion('iphone_alta')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-4 text-[17px] font-extrabold text-[#04121a] shadow-[0_12px_30px_-10px_rgba(20,231,216,.6)] active:scale-[.99]">
            {tx('Crear mi cuenta gratis')} <ArrowRight size={18} />
          </a>
          <a href="/panel/login" className="flex w-full items-center justify-center rounded-2xl border border-dark-600 py-3.5 text-[15.5px] font-bold text-dark-100 active:scale-[.99]">
            {tx('Ya tengo cuenta')} · {tx('Entrar')}
          </a>
          {!iphone && (
            <p className="text-center text-[12.5px] text-dark-400">
              {tx('¿Tienes Android?')} <a href="/empezar" className="inline-flex items-center gap-1 font-semibold text-brand-300">{tx('La app se instala en un toque')} <ExternalLink size={12} /></a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
