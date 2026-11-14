import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { GRAVEDADES, PIEZAS_DEL_LADO, PIEZA_OTRA, faltaEnGolpe } from './logica'

/* LO QUE SE APUNTA DE UN GOLPE (14-11-2026): la caja ya va dibujada sobre la foto de hoy; aquí, la pieza (las de ese
   lado a un toque, u «Otra pieza» y se escribe), la gravedad y una nota si hace falta. Guardar es la acción principal
   mientras esto está abierto. «Cancelar» lo tira; Esc lo cierra y lo guarda como borrador: al volver a abrirlo en el
   mismo lado está todo como se dejó. Sin la foto de hoy no hay dónde dibujar la caja, y se dice. */
export default function FormGolpe({ t, titulo, vista, valor, onCambio, onGuardar, onCancelar, ocupado, sinFoto = false }) {
  const primera = useRef(null)
  const campo = useRef(null)
  const otra = valor.piezaClave === PIEZA_OTRA
  // En el ordenador el foco va a las piezas, para elegir sin buscar; en el móvil no, que el teclado taparía la foto.
  useEffect(() => {
    try { if (window.matchMedia('(pointer: fine)').matches) primera.current?.focus({ preventScroll: true }) } catch { /* sin matchMedia */ }
  }, [])
  const sugeridas = PIEZAS_DEL_LADO[vista] || PIEZAS_DEL_LADO.otra
  const falta = faltaEnGolpe(valor, { sinFoto })

  const chip = (elegida) => `h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${elegida
    ? 'border-dark-50 bg-dark-50 text-dark-950'
    : 'border-dark-700 text-dark-200 hover:border-ruta-borde'}`

  return (
    <form
      className="rounded-xl border border-dark-700 bg-dark-900 p-4 md:p-5"
      data-testid="form-golpe"
      onSubmit={(e) => { e.preventDefault(); if (!falta && !ocupado) onGuardar() }}
    >
      <h3 className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{titulo}</h3>
      <p className="mt-1 text-sm text-dark-400">
        {sinFoto ? t('repaso.golpe.sinfoto') : valor.caja ? t('repaso.golpe.redibuja') : t('repaso.golpe.dibuja')}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-dark-50">{t('repaso.golpe.pieza')}</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sugeridas.map((k, i) => (
            <button key={k} ref={i === 0 ? primera : undefined} type="button" aria-pressed={valor.piezaClave === k}
              onClick={() => onCambio({ piezaClave: k, pieza: '' })} className={chip(valor.piezaClave === k)}>
              {t(`repaso.p.${k}`)}
            </button>
          ))}
          <button type="button" aria-pressed={otra} className={chip(otra)}
            onClick={() => { onCambio({ piezaClave: PIEZA_OTRA }); setTimeout(() => campo.current?.focus({ preventScroll: true }), 0) }}>
            {t('repaso.golpe.otra')}
          </button>
        </div>
        {otra && (
          <>
            <label className="sr-only" htmlFor="repaso-pieza">{t('repaso.golpe.otra.cual')}</label>
            <input
              id="repaso-pieza" ref={campo} type="text" maxLength={80} autoComplete="off"
              value={valor.pieza}
              placeholder={t('repaso.golpe.otra.cual')}
              onChange={(e) => onCambio({ pieza: e.target.value })}
              className="mt-2 h-11 w-full rounded-lg border border-ruta-borde bg-dark-900 px-3 text-[15px] text-dark-50 placeholder:text-dark-400 focus:border-ruta-enfasis focus:outline-none"
            />
          </>
        )}
      </fieldset>

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
        {falta && <span className="text-sm text-dark-400 sm:mr-auto" data-testid="golpe-falta">{t(falta)}</span>}
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
