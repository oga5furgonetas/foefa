/* La entrada de /devolucion-renting: turismo o furgoneta y la compañía. Una acción principal: «Empezar», que se queda
   a la vista al bajar por la lista (en un portátil de 1280 × 800 la lista entera no cabe). */
import { COMPANIAS, DOCUMENTOS, pasosDe } from '../../lib/guiasRenting'
import { BTN_PRIMARIO } from '../portadaComun'
import Vehiculo from './Vehiculo'
import { H1, Vigencia } from './comun'

function Opcion({ valor, elegida, onElegir, titulo, detalle, doc, testid }) {
  const si = elegida === valor
  return (
    <label className="block cursor-pointer border-b border-[color:var(--ld-border)] px-0.5 py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ld-text)]" data-testid={testid}>
      <span className="flex min-h-[44px] items-center justify-between gap-4">
        <span className="min-w-0">
          <b className="block text-[16px] font-semibold leading-snug text-[color:var(--ld-text)]">{titulo}</b>
          <span className="mt-0.5 block text-[13px] leading-snug text-[color:var(--ld-muted)]">{detalle}</span>
        </span>
        <input type="radio" name="dev-compania" value={valor} checked={si} onChange={() => onElegir(valor)} className="peer sr-only" />
        <span aria-hidden="true" className={`block h-[22px] w-[22px] shrink-0 rounded-full ${si ? 'border-[6.5px] border-[color:var(--ld-text)]' : 'border-[1.5px] border-[color:var(--ld-border-strong)]'}`} />
      </span>
      {si && doc && <Vigencia doc={doc} className="mb-1 mt-2" />}
    </label>
  )
}

export default function Entrada({ vehiculo, compania, onVehiculo, onCompania, onEmpezar }) {
  const lista = (tipo) => COMPANIAS.filter((c) => c.tipo === tipo && c.documentos[vehiculo])
  const sinEste = COMPANIAS.filter((c) => !c.documentos[vehiculo])
  const doc = compania && compania !== 'otra' ? COMPANIAS.find((c) => c.slug === compania)?.documentos[vehiculo] : null
  const n = doc ? pasosDe(doc, vehiculo).length : 0
  const listo = compania === 'otra' || n > 0
  const detalle = (c) => { const d = DOCUMENTOS[c.documentos[vehiculo]]; return `${d.corto} · ${d.edicion.charAt(0).toLowerCase()}${d.edicion.slice(1)}` }
  const tipoBtn = (si) => `flex h-11 items-center justify-center rounded-[10px] border-[1.5px] text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)] ${si ? 'border-[color:var(--ld-text)] bg-[color:var(--ld-text)] text-[color:var(--ld-bg)]' : 'border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] text-[color:var(--ld-text)] hover:border-[color:var(--ld-text)]'}`
  const opcion = (c) => <Opcion key={c.slug} valor={c.slug} elegida={compania} onElegir={onCompania} titulo={c.nombreLargo === c.nombre ? c.nombre : c.nombreLargo} detalle={detalle(c)} doc={c.documentos[vehiculo]} testid={`dev-cia-${c.slug}`} />

  return (
    <div className="grid gap-8 pb-10 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:pb-16">
      <div>
        <h1 className={H1}>¿Qué te van a cobrar al devolverlo?</h1>
        <p className="mt-5 max-w-[540px] text-[17px] leading-[1.5] text-[color:var(--ld-text2)] sm:text-[18px]" data-testid="dev-entradilla">
          Algunas compañías de renting publican qué consideran desgaste normal y qué no aceptan. Repásalo con la suya antes de que lo haga su perito.
        </p>
        <div className="mt-10 hidden items-end gap-10 lg:flex" aria-hidden="true">
          <Vehiculo tipo="turismo" ancho={92} className={vehiculo === 'turismo' ? '' : 'opacity-40'} />
          <Vehiculo tipo="furgoneta" ancho={104} className={vehiculo === 'furgoneta' ? '' : 'opacity-40'} />
        </div>
        <ul className="mt-10 hidden max-w-[460px] space-y-2 text-[15px] leading-snug text-[color:var(--ld-muted)] lg:block">
          <li>Una pregunta por zona, con la regla de su documento y su página.</li>
          <li>Al final, lo que su documento no da por bueno y lo que dice que se factura.</li>
          <li>El resultado va en el enlace: lo guardas o se lo mandas a quien quieras.</li>
        </ul>
      </div>

      <div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de vehículo">
          {[['turismo', 'Turismo'], ['furgoneta', 'Furgoneta']].map(([v, t]) => (
            <button key={v} type="button" aria-pressed={vehiculo === v} onClick={() => onVehiculo(v)} className={tipoBtn(vehiculo === v)} data-testid={`dev-tipo-${v}`}>{t}</button>
          ))}
        </div>

        <fieldset className="mt-6">
          <legend className="text-[13px] font-semibold text-[color:var(--ld-muted)]">Tu compañía de renting</legend>
          <div className="mt-2 border-t border-[color:var(--ld-border)]">
            {lista('renting').map(opcion)}
            <Opcion valor="otra" elegida={compania} onElegir={onCompania} titulo="Otra compañía" detalle="Te enseñamos lo que piden las que sí publican su guía" testid="dev-cia-otra" />
          </div>
          {sinEste.length > 0 && <p className="mt-2 text-[13px] text-[color:var(--ld-muted)]" data-testid="dev-sin-este">De {sinEste.map((c) => c.nombre).join(', ')} solo hemos encontrado el documento de {vehiculo === 'furgoneta' ? 'turismos' : 'furgonetas'}.</p>}
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-[13px] font-semibold text-[color:var(--ld-muted)]">Si es un alquiler</legend>
          <div className="mt-2 border-t border-[color:var(--ld-border)]">{lista('alquiler').map(opcion)}</div>
        </fieldset>

        {/* La acción, pegada abajo mientras se baja por la lista. */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-[color:var(--ld-border)] bg-[color:var(--ld-bg)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5 sm:mx-0 sm:px-0">
          <button type="button" onClick={onEmpezar} disabled={!listo} className={`${BTN_PRIMARIO} w-full`} data-testid="dev-empezar">
            {!compania ? 'Elige tu compañía' : compania === 'otra' ? 'Ver lo que piden las demás' : n > 0 ? `Empezar · ${n} preguntas` : 'Elige turismo o furgoneta'}
          </button>
          <p className="mt-2.5 text-center text-[13px] text-[color:var(--ld-muted)]">Sin registro. No guardamos nada de tu vehículo.</p>
        </div>
      </div>
    </div>
  )
}
