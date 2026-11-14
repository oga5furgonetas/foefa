import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { diaCorto, sumarDias } from './logica'

/* EL DÍA DEL REPASO (14-11-2026): dos flechas y, entre ellas, el día en Plex Mono («jue 12 nov», en el idioma del
   panel). Al pulsarlo se abre el selector de fecha del sistema (`showPicker()` sobre un campo de fecha que no se ve
   pero está, con su nombre). Si el navegador no tiene `showPicker`, o no deja abrirlo, el campo aparece en el sitio del
   botón con el foco puesto, para escribir la fecha; al soltarlo vuelve el botón. Nunca se elige un día por llegar. */
const flecha = 'flex h-9 w-9 items-center justify-center rounded-lg border border-dark-700 text-dark-200 hover:bg-dark-800 disabled:border-dark-800 disabled:text-dark-400 disabled:hover:bg-transparent'

export default function ElegirDia({ t, locale, fecha, tope, esHoy, onIr }) {
  const campo = useRef(null)
  const [escribir, setEscribir] = useState(false)
  const corto = diaCorto(fecha, locale)
  const nombre = `${t('repaso.dia.elegir')}, ${corto}`

  const abrir = () => {
    const el = campo.current
    if (!el) return
    try {
      if (typeof el.showPicker !== 'function') throw new Error('sin showPicker')
      el.showPicker()
    } catch {
      setEscribir(true)
      setTimeout(() => campo.current?.focus(), 0)
    }
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="elegir-dia">
      <button type="button" aria-label={t('repaso.dia.anterior')} title={t('repaso.dia.anterior')}
        onClick={() => onIr(sumarDias(fecha, -1))} className={flecha}>
        <ChevronLeft size={17} aria-hidden="true" />
      </button>
      <span className="relative inline-flex">
        <button type="button" onClick={abrir} aria-label={nombre} title={t('repaso.dia.elegir')} data-testid="dia-boton"
          aria-hidden={escribir || undefined} tabIndex={escribir ? -1 : 0}
          className={`h-9 min-w-[7.5rem] rounded-lg border border-dark-700 px-3 font-mono text-[13.5px] font-medium tabular-nums text-dark-50 hover:bg-dark-800 ${escribir ? 'hidden' : ''}`}>
          {corto}
        </button>
        {/* El campo de verdad: debajo del botón y sin verse, hasta que hace falta escribir en él. */}
        <input ref={campo} type="date" value={fecha || ''} max={tope} data-testid="dia-campo"
          aria-label={t('repaso.dia.elegir')} tabIndex={escribir ? 0 : -1} aria-hidden={escribir ? undefined : true}
          onChange={(e) => { const v = e.target.value; if (v && v <= tope) onIr(v) }}
          onBlur={() => setEscribir(false)}
          className={`h-9 rounded-lg border border-ruta-enfasis bg-dark-900 px-2 font-mono text-[13px] text-dark-50 focus:outline-none ${escribir ? 'w-[10.5rem]' : 'pointer-events-none absolute inset-0 w-full opacity-0'}`} />
      </span>
      <button type="button" aria-label={t('repaso.dia.siguiente')} title={t('repaso.dia.siguiente')}
        disabled={esHoy || fecha >= tope} onClick={() => onIr(sumarDias(fecha, 1))} className={flecha}>
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
