import Matricula from '../../../components/Matricula'
import { fechaLarga } from './logica'

/* LA COLUMNA DE LA DERECHA DEL REPASO (debajo en el móvil), 14-11-2026.
   Arriba, lo que ya está apuntado en la furgoneta que se mira (golpes confirmados por una persona y sin reparar), para
   no marcar dos veces el mismo golpe. Abajo, las cuentas del día y las furgonetas activas que no tienen revisión. */

function Miniatura({ url, caja }) {
  if (!url) return <span className="block h-14 w-[76px] shrink-0 rounded-md bg-dark-800" aria-hidden="true" />
  return (
    <span className="relative block h-14 w-[76px] shrink-0 overflow-hidden rounded-md bg-dark-800">
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      {caja && caja.length === 4 && (
        <span className="absolute rounded border-2 border-[#d92d20]"
          style={{ top: `${caja[0] / 10}%`, left: `${caja[1] / 10}%`, height: `${(caja[2] - caja[0]) / 10}%`, width: `${(caja[3] - caja[1]) / 10}%` }} />
      )}
    </span>
  )
}

export function YaApuntado({ t, locale, lista, miniatura }) {
  return (
    <section aria-labelledby="repaso-apuntado">
      <h2 id="repaso-apuntado" className="text-[15px] font-bold text-dark-50">{t('repaso.lat.apuntado')}</h2>
      <p className="mt-0.5 text-[13px] text-dark-400">{t('repaso.lat.apuntado.sub')}</p>
      {!lista.length ? (
        <p className="mt-3 border-t border-dark-700 pt-3 text-sm text-dark-400">{t('repaso.lat.apuntado.vacio')}</p>
      ) : (
        <ul className="mt-2" data-testid="ya-apuntado">
          {lista.map((a, i) => {
            const m = miniatura(a)
            return (
              <li key={a.golpe_id || a.ledger_id || `${a.panel}-${i}`} className="flex gap-3 border-t border-dark-700 py-3 first:border-t-0">
                <Miniatura url={m?.url} caja={m?.caja} />
                <div className="min-w-0">
                  <b className="block text-[14.5px] font-semibold leading-snug text-dark-50">{a.pieza || a.panel}</b>
                  <span className="mt-0.5 block text-[12.5px] text-dark-400">
                    {a.desde ? t('repaso.lat.desde').replace('{fecha}', fechaLarga(a.desde, locale, false)) : ''}
                    {a.gravedad ? `${a.desde ? ' · ' : ''}${t(`repaso.grav.${a.gravedad}`)}` : ''}
                  </span>
                  <span className={`mt-0.5 block text-[12.5px] font-semibold ${a.en_taller ? 'text-ruta-aviso-texto' : 'text-dark-300'}`}>
                    {a.en_taller ? t('repaso.lat.entaller') : t('repaso.lat.abierto')}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const Fila = ({ etiqueta, valor, tono = '', testId }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm" data-testid={testId}>
    <span className="text-dark-300">{etiqueta}</span>
    <b className={`font-mono text-[15px] font-semibold tabular-nums ${tono || 'text-dark-50'}`}>{valor}</b>
  </div>
)

export function ResumenDia({ t, cuentas, esHoy, sinRevision }) {
  return (
    <section aria-labelledby="repaso-resumen" className="border-t border-dark-700 pt-4 first:border-t-0 first:pt-0" data-testid="resumen-dia">
      <h2 id="repaso-resumen" className="text-[15px] font-bold text-dark-50">{esHoy ? t('repaso.res.hoy') : t('repaso.res.dia')}</h2>
      <div className="mt-1.5">
        <Fila etiqueta={t('repaso.res.sinnuevos')} valor={cuentas.sinGolpeNuevo} testId="res-sinnuevos" />
        <Fila etiqueta={t('repaso.res.golpe')} valor={cuentas.conGolpe} tono={cuentas.conGolpe ? 'text-ruta-peligro-texto' : ''} testId="res-golpe" />
        <Fila etiqueta={t('repaso.res.pendientes')} valor={cuentas.porRepasar} testId="res-pendientes" />
        <Fila etiqueta={esHoy ? t('repaso.res.sinrevision') : t('repaso.res.sinrevision.dia')} valor={cuentas.sinRevision} testId="res-sinrevision" />
      </div>
      {sinRevision.length > 0 && (
        <ul className="mt-2 space-y-2" data-testid="sin-revision">
          {sinRevision.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-dark-300">
              {v.matricula ? <Matricula texto={v.matricula} className="text-[13px]" /> : <span>{t('repaso.sinmatricula')}</span>}
              {v.asignada_a?.nombre && <span>{t('repaso.res.asignada').replace('{nombre}', v.asignada_a.nombre)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
