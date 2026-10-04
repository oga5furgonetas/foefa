import { useEffect, useState } from 'react'
import { Download, Share, X, Smartphone } from 'lucide-react'
import { alCambiarInstalable, sePuedeInstalar, instalar, yaEsApp, esIphone } from '../lib/instalar'

/* La tarjeta «Instala FDS en tu móvil», en la app de ruta abierta desde el
   navegador. No sale si ya es app (instalada o la de Play) ni si la cerró. */
export default function InstalarApp() {
  const [puede, setPuede] = useState(sePuedeInstalar())
  const [oculta, setOculta] = useState(() => {
    try { return localStorage.getItem('fds_instalar_cerrado') === '1' || localStorage.getItem('fds_instalada') === '1' } catch { return false }
  })
  const [paso, setPaso] = useState('')
  useEffect(() => alCambiarInstalable(setPuede), [])
  if (oculta || yaEsApp()) return null
  const iphone = esIphone()
  function cerrar() {
    try { localStorage.setItem('fds_instalar_cerrado', '1') } catch { /* nada */ }
    setOculta(true)
  }
  async function pulsar() {
    if (puede) {
      const r = await instalar()
      if (r === 'accepted') setOculta(true)
      return
    }
    setPaso(iphone ? 'iphone' : 'android')
  }
  return (
    <section className="mx-auto mb-4 max-w-md rounded-2xl border border-brand-400/40 bg-gradient-to-r from-brand-500/[.14] to-dark-900 p-3.5" aria-label="Instalar la app">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-brand-tinta"><Smartphone size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-dark-50">Instala FDS en tu móvil</p>
          <p className="text-[12.5px] leading-snug text-dark-300">Con su icono, a pantalla completa y sin buscar la web cada día.</p>
        </div>
        <button onClick={cerrar} aria-label="No mostrar más" className="rounded p-1 text-dark-500"><X size={16} /></button>
      </div>
      {paso === 'iphone' ? (
        <ol className="mt-3 space-y-1.5 text-[13px] text-dark-200">
          <li className="flex items-center gap-2">1. Abre esta página en <b>Safari</b>.</li>
          <li className="flex items-center gap-2">2. Pulsa <Share size={15} className="text-sky-300" /> <b>Compartir</b> (abajo).</li>
          <li>3. Elige <b>«Añadir a pantalla de inicio»</b>.</li>
        </ol>
      ) : paso === 'android' ? (
        <ol className="mt-3 space-y-1.5 text-[13px] text-dark-200">
          <li>1. Abre esta página en <b>Chrome</b>.</li>
          <li>2. Pulsa el menú <b>⋮</b> (arriba a la derecha).</li>
          <li>3. Elige <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</li>
        </ol>
      ) : (
        <button onClick={pulsar}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-[14.5px] font-bold text-brand-tinta">
          <Download size={17} /> {puede ? 'Instalar la app' : 'Cómo instalarla'}
        </button>
      )}
    </section>
  )
}
