import { ChevronRight } from 'lucide-react'
import Matricula from '../../../components/Matricula'
import { nombreLado, nombrePieza } from './logica'

/* «REPASO TERMINADO» (14-11-2026): las cuentas del día y los golpes nuevos, cada uno con un enlace a su revisión para
   volver a mirarlo. Sale cuando no queda ningún lado por decidir. */
export default function Terminado({ t, esHoy, cuentas, golpes, onAbrir, onRevisar }) {
  return (
    <section className="rounded-xl border border-dark-700 bg-dark-900 p-5 md:p-7" data-testid="terminado">
      <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-dark-50">{t('repaso.fin.tit')}</h2>
      <p className="mt-1.5 text-[15px] text-dark-300">
        {cuentas.revisiones === 1
          ? t(esHoy ? 'repaso.fin.texto.hoy.una' : 'repaso.fin.texto.dia.una')
          : t(esHoy ? 'repaso.fin.texto.hoy' : 'repaso.fin.texto.dia').replace('{n}', String(cuentas.revisiones))}
      </p>

      <dl className="mt-5 grid grid-cols-3 border-t-[1.5px] border-dark-50">
        {[
          ['repaso.fin.revisadas', cuentas.repasadas, ''],
          ['repaso.res.sinnuevos', cuentas.sinGolpeNuevo, ''],
          ['repaso.res.golpe', cuentas.conGolpe, cuentas.conGolpe ? 'text-ruta-peligro-texto' : ''],
        ].map(([k, n, tono], i) => (
          <div key={k} className={`flex flex-col-reverse justify-end pt-3 ${i ? 'border-l border-dark-700 pl-3 md:pl-4' : ''}`}>
            <dt className="mt-1.5 text-[12.5px] leading-snug text-dark-400">{t(k)}</dt>
            <dd className={`font-mono text-[30px] font-semibold leading-none tabular-nums ${tono || 'text-dark-50'}`}>{n}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-7 text-[15px] font-bold text-dark-50">{esHoy ? t('repaso.fin.golpes.hoy') : t('repaso.fin.golpes.dia')}</h3>
      {!golpes.length ? (
        <p className="mt-2 text-sm text-dark-400">{t('repaso.fin.singolpes')}</p>
      ) : (
        <ul className="mt-2" data-testid="golpes-del-dia">
          {golpes.map(({ rev, lado }) => (
            <li key={`${rev.id}-${lado.photo_index}`} className="border-t border-dark-700 first:border-t-0">
              <button type="button" onClick={() => onAbrir(rev.id, lado.photo_index)}
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-dark-800/60">
                <Matricula texto={rev.vehiculo?.matricula} className="shrink-0 text-[13px]" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px] font-semibold text-dark-50">{nombrePieza(t, lado.golpe?.pieza_clave, lado.golpe?.pieza) || nombreLado(t, lado)}</b>
                  <span className="block text-[12.5px] text-dark-400">
                    {nombreLado(t, lado)}{lado.golpe?.gravedad ? ` · ${t(`repaso.grav.${lado.golpe.gravedad}`)}` : ''}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-dark-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onRevisar}
        className="mt-6 h-11 rounded-xl border border-ruta-borde px-4 text-sm font-semibold text-dark-50 hover:bg-dark-800">
        {t('repaso.fin.ver')}
      </button>
    </section>
  )
}
