import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Matricula from '../../../components/Matricula'
import { fechaLarga, nombreLado, nombrePieza } from './logica'

/* «REPASO TERMINADO» (14-11-2026): sale cuando no queda ningún lado por decidir. Sin tarjeta (aire y una regla, como
   la mesa) y sin repetir las cuentas, que ya están en la columna de al lado. Un solo paso siguiente:
   - con golpes nuevos, «Ver los golpes de hoy» (abre el primero en la mesa) y la lista, cada golpe con su revisión y el
     enlace al expediente de su furgoneta;
   - sin golpes, una frase tranquila y, si el día anterior quedó sin repasar, el enlace para repasarlo. Si no, nada. */
export default function Terminado({ t, locale, esHoy, cuentas, golpes, anterior, onAbrir, onIrDia, onRevisar }) {
  const hay = golpes.length > 0
  return (
    <section className="border-t-[1.5px] border-dark-50 pt-6 md:pt-7" data-testid="terminado">
      <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-dark-50">{t('repaso.fin.tit')}</h2>
      <p className="mt-1.5 max-w-[60ch] text-[15px] text-dark-300">
        {cuentas.revisiones === 1
          ? t(esHoy ? 'repaso.fin.texto.hoy.una' : 'repaso.fin.texto.dia.una')
          : t(esHoy ? 'repaso.fin.texto.hoy' : 'repaso.fin.texto.dia').replace('{n}', String(cuentas.revisiones))}
      </p>

      {hay ? (
        <>
          <button type="button" onClick={() => onAbrir(golpes[0].rev.id, golpes[0].lado.photo_index)} data-testid="ver-golpes"
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-6 sm:w-auto text-[15px] font-bold text-brand-tinta">
            {t(esHoy ? 'repaso.fin.vergolpes.hoy' : 'repaso.fin.vergolpes.dia')} <ChevronRight size={16} aria-hidden="true" />
          </button>

          <h3 className="mt-9 text-[15px] font-bold text-dark-50">{esHoy ? t('repaso.fin.golpes.hoy') : t('repaso.fin.golpes.dia')}</h3>
          <ul className="mt-2 border-t border-dark-700" data-testid="golpes-del-dia">
            {golpes.map(({ rev, lado }) => {
              const pieza = nombrePieza(t, lado.golpe?.pieza_clave, lado.golpe?.pieza) || nombreLado(t, lado)
              return (
                <li key={`${rev.id}-${lado.photo_index}`} className="flex items-center gap-2 border-b border-dark-700">
                  <button type="button" onClick={() => onAbrir(rev.id, lado.photo_index)} data-testid="golpe-abrir"
                    className="flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-lg py-3 pr-2 text-left hover:bg-dark-800/60 sm:flex-row sm:items-center sm:gap-4">
                    <Matricula texto={rev.vehiculo?.matricula} className="shrink-0 text-[13px]" />
                    <span className="min-w-0 sm:flex-1">
                      <b className="block text-[14.5px] font-semibold leading-snug text-dark-50">{pieza}</b>
                      <span className="block text-[13px] text-dark-400">
                        {nombreLado(t, lado)}{lado.golpe?.gravedad ? ` · ${t(`repaso.grav.${lado.golpe.gravedad}`)}` : ''}
                      </span>
                    </span>
                  </button>
                  {rev.vehiculo?.id && (
                    <Link to={`/panel/vehiculos/${encodeURIComponent(rev.vehiculo.id)}/expediente`} data-testid="golpe-expediente"
                      aria-label={t('repaso.fin.expediente.de').replace('{matricula}', rev.vehiculo.matricula || '—')}
                      className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-dark-100 underline decoration-dark-600 underline-offset-4 hover:text-dark-50 hover:decoration-dark-50">
                      {t('repaso.fin.expediente')} <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="mt-6" data-testid="terminado-sin-golpes">
          <p className="text-[17px] font-semibold text-dark-50">{t(esHoy ? 'repaso.fin.nada.hoy' : 'repaso.fin.nada.dia')}</p>
          {anterior && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dark-700 pt-5" data-testid="dia-sin-repasar">
              <p className="text-[15px] text-dark-300">{t('repaso.fin.anterior.texto')}</p>
              <button type="button" onClick={() => onIrDia(anterior)}
                className="flex h-11 items-center gap-1.5 rounded-xl border border-ruta-borde px-4 text-sm font-semibold text-dark-50 hover:bg-dark-800">
                {t('repaso.fin.anterior').replace('{fecha}', fechaLarga(anterior, locale, false))} <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={onRevisar}
        className="mt-8 text-sm font-semibold text-dark-300 underline decoration-dark-600 underline-offset-4 hover:text-dark-50">
        {t('repaso.fin.ver')}
      </button>
    </section>
  )
}
