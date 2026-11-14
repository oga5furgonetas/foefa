import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { GRAVEDADES, PIEZAS_DEL_LADO } from './logica'

/* LO QUE SE APUNTA DE UN GOLPE (14-11-2026): la caja ya va dibujada sobre la foto de hoy; aquí, la pieza (con las de
   ese lado a un toque), la gravedad y una nota si hace falta. Guardar es la acción principal mientras esto está
   abierto; Esc o «Cancelar» lo cierran sin guardar nada. */
export default function FormGolpe({ t, titulo, vista, valor, onCambio, onGuardar, onCancelar, ocupado }) {
  const campo = useRef(null)
  // En el ordenador se escribe la pieza sin buscar el campo; en el móvil no, que el teclado taparía la foto.
  useEffect(() => {
    try { if (window.matchMedia('(pointer: fine)').matches) campo.current?.focus({ preventScroll: true }) } catch { /* sin matchMedia */ }
  }, [])
  const sugeridas = PIEZAS_DEL_LADO[vista] || PIEZAS_DEL_LADO.otra
  const falta = !valor.caja ? t('repaso.golpe.falta.caja')
    : !valor.pieza.trim() ? t('repaso.golpe.falta.pieza')
      : !valor.gravedad ? t('repaso.golpe.falta.gravedad') : ''

  return (
    <form
      className="rounded-xl border border-dark-700 bg-dark-900 p-4 md:p-5"
      data-testid="form-golpe"
      onSubmit={(e) => { e.preventDefault(); if (!falta && !ocupado) onGuardar() }}
    >
      <h3 className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{titulo}</h3>
      <p className="mt-1 text-sm text-dark-400">
        {valor.caja ? t('repaso.golpe.redibuja') : t('repaso.golpe.dibuja')}
      </p>

      <label className="mt-4 block text-sm font-semibold text-dark-50" htmlFor="repaso-pieza">{t('repaso.golpe.pieza')}</label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sugeridas.map((k) => {
          const elegida = valor.piezaClave === k
          return (
            <button key={k} type="button" aria-pressed={elegida}
              onClick={() => onCambio({ pieza: t(`repaso.p.${k}`), piezaClave: k })}
              className={`h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${elegida
                ? 'border-dark-50 bg-dark-50 text-dark-950'
                : 'border-dark-700 text-dark-200 hover:border-ruta-borde'}`}>
              {t(`repaso.p.${k}`)}
            </button>
          )
        })}
      </div>
      <input
        id="repaso-pieza" ref={campo} type="text" maxLength={80} autoComplete="off"
        value={valor.pieza}
        placeholder={t('repaso.golpe.pieza.ph')}
        onChange={(e) => onCambio({ pieza: e.target.value, piezaClave: null })}
        className="mt-2 h-11 w-full rounded-lg border border-ruta-borde bg-dark-900 px-3 text-[15px] text-dark-50 placeholder:text-dark-400 focus:border-ruta-enfasis focus:outline-none"
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-dark-50">{t('repaso.golpe.gravedad')}</legend>
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:inline-grid sm:w-auto">
          {GRAVEDADES.map((g) => (
            <button key={g} type="button" aria-pressed={valor.gravedad === g} onClick={() => onCambio({ gravedad: g })}
              className={`h-10 rounded-lg border px-4 text-sm font-semibold transition-colors ${valor.gravedad === g
                ? 'border-dark-50 bg-dark-50 text-dark-950'
                : 'border-ruta-borde text-dark-100 hover:bg-dark-800'}`}>
              {t(`repaso.grav.${g}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-semibold text-dark-50" htmlFor="repaso-nota">{t('repaso.golpe.nota')}</label>
      <input
        id="repaso-nota" type="text" maxLength={300} autoComplete="off"
        value={valor.nota}
        placeholder={t('repaso.golpe.nota.ph')}
        onChange={(e) => onCambio({ nota: e.target.value })}
        className="mt-2 h-11 w-full rounded-lg border border-ruta-borde bg-dark-900 px-3 text-[15px] text-dark-50 placeholder:text-dark-400 focus:border-ruta-enfasis focus:outline-none"
      />

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {falta && <span className="text-sm text-dark-400 sm:mr-auto" data-testid="golpe-falta">{falta}</span>}
        <button type="button" onClick={onCancelar}
          className="h-[52px] rounded-xl border border-ruta-borde px-5 text-[15px] font-semibold text-dark-50 hover:bg-dark-800">
          {t('repaso.golpe.cancelar')}
        </button>
        <button type="submit" disabled={!!falta || ocupado}
          className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-brand-400 px-6 text-[15px] font-bold text-brand-tinta disabled:cursor-not-allowed disabled:opacity-45">
          {ocupado && <Loader2 size={16} className="animate-spin" />}
          {t('repaso.golpe.guardar')}
        </button>
      </div>
    </form>
  )
}

