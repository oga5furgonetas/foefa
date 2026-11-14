import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Matricula from '../../../components/Matricula'
import Foto from './Foto'

/* LAS DOS FOTOS A PANTALLA COMPLETA (14-11-2026), con la matrícula y el lado arriba para no perder de vista qué se
   está mirando. Se cierra con Esc o Z (los escucha la pantalla), con la X o tocando fuera de las fotos. Mientras está
   abierta es lo único que hay: el foco del teclado no sale de ella y no se decide ningún lado desde aquí (no se vería
   qué se ha marcado). Al cerrarla, el foco vuelve a donde estaba. */
export default function Ampliar({ t, idioma, matricula, nombre, lado, hoy, antes, onCerrar }) {
  const caja = useRef(null)
  const cerrar = useRef(null)
  useEffect(() => {
    const antesDeAbrir = document.activeElement
    cerrar.current?.focus()
    return () => { try { if (antesDeAbrir && document.contains(antesDeAbrir)) antesDeAbrir.focus({ preventScroll: true }) } catch { /* nada */ } }
  }, [])

  // El tabulador da la vuelta dentro del diálogo.
  const retener = (e) => {
    if (e.key !== 'Tab') return
    const enfocables = [...(caja.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])]
      .filter((el) => !el.disabled)
    if (!enfocables.length) { e.preventDefault(); return }
    const i = enfocables.indexOf(document.activeElement)
    const j = e.shiftKey ? (i <= 0 ? enfocables.length - 1 : i - 1) : (i === -1 || i === enfocables.length - 1 ? 0 : i + 1)
    e.preventDefault()
    enfocables[j].focus()
  }

  return (
    <div ref={caja} role="dialog" aria-modal="true" aria-label={t('repaso.ampliar')} onKeyDown={retener}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0b1012]" data-testid="ampliada"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <Matricula texto={matricula} className="text-base" />
        <span className="min-w-0 truncate text-[15px] font-semibold">{nombre}</span>
        <button ref={cerrar} type="button" onClick={onCerrar}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-[#5b666c] px-3 text-sm font-semibold text-white hover:bg-white/10">
          <X size={16} /> {t('repaso.cerrar')} <kbd className="hidden font-mono text-xs text-[#b9c2c6] md:inline">Esc</kbd>
        </button>
      </div>
      <div className={`grid min-h-0 flex-1 gap-1.5 px-2 pb-2 ${antes ? 'grid-rows-2 md:grid-cols-2 md:grid-rows-1' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
        {antes && (
          <Foto key={`a-${antes.url}`} url={antes.url} rotulo={t('repaso.antes')} fecha={antes.fecha} quien={antes.quien} idioma={idioma}
            ajuste="marco" marcoCls="h-full !bg-transparent" textoFallo={t('repaso.foto.fallo')} alt={t('repaso.alt.antes')} />
        )}
        <Foto key={`h-${lado.foto_url}`} url={lado.foto_url} rotulo={t('repaso.hoy')} oscuro fecha={hoy.fecha} quien={hoy.quien} idioma={idioma}
          caja={lado.golpe?.box_2d || null} ajuste="marco" marcoCls="h-full !bg-transparent" textoFallo={t('repaso.foto.fallo')} alt={t('repaso.alt.hoy')} />
      </div>
    </div>
  )
}
