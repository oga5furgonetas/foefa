/* «Otra compañía»: en vez de inventar, lo que piden las compañías de renting que sí publican su guía, tema a tema, cada
   una con su nombre y su página, y el margen que dan (como lo escribe cada guía). Orientación, no la regla de nadie. */
import { ArrowLeft } from 'lucide-react'
import { COMPANIAS, TEMAS, medidaTexto, pasosDe } from '../../lib/guiasRenting'
import { BTN_SECUNDARIO } from '../portadaComun'
import Vehiculo from './Vehiculo'
import { AVISO, ENLACE_TEXTO, H1, Pag, PuertaFds } from './comun'

const enMm = (m) => (m.unidad === 'cm' ? m.limite * 10 : m.limite)

export function filasOtra(vehiculo) {
  const renting = COMPANIAS.filter((c) => c.tipo === 'renting' && c.documentos[vehiculo])
  return TEMAS.map(([tema, nombre]) => {
    const filas = []
    for (const c of renting) {
      const doc = c.documentos[vehiculo]
      for (const p of pasosDe(doc, vehiculo).filter((x) => x.tema === tema)) filas.push({ c, doc, p })
    }
    const medidas = filas.map((f) => f.p.r.medida).filter((m) => m && m.sentido === 'hasta' && ['cm', 'mm'].includes(m.unidad))
    let rango = null
    if (medidas.length >= 2) {
      const orden = [...medidas].sort((a, b) => enMm(a) - enMm(b))
      const min = orden[0]; const max = orden[orden.length - 1]
      if (enMm(min) !== enMm(max)) rango = `Lo que aceptan sin cobrar va de ${medidaTexto(min)} a ${medidaTexto(max)}, según la guía.`
    }
    return { tema, nombre, zona: filas[0]?.p.zona, filas, rango }
  }).filter((t) => t.filas.length)
}

export default function Otra({ vehiculo, onAtras }) {
  const temas = filasOtra(vehiculo)
  return (
    <div className="pb-6 pt-6 sm:pt-10" data-testid="dev-otra">
      <button type="button" onClick={onAtras} className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[14px] font-semibold text-[color:var(--ld-text)] hover:underline" data-testid="dev-atras">
        <ArrowLeft size={16} aria-hidden="true" />Atrás
      </button>
      <h1 className={`${H1} mt-3 max-w-[820px]`}>Lo que piden las compañías que sí publican su guía</h1>
      <p className="mt-5 max-w-[640px] text-[17px] leading-[1.5] text-[color:var(--ld-text2)]">
        Muchas compañías no publican la suya. Pídesela a la tuya antes de devolver {vehiculo === 'turismo' ? 'el coche' : 'la furgoneta'}: es la única que vale. Mientras tanto, esto es lo que piden las que sí la publican, tema a tema, para que sepas por dónde suelen ir.
      </p>
      <p className="mt-4 text-[14px] font-mono text-[color:var(--ld-muted)]">{vehiculo === 'turismo' ? 'Turismo' : 'Furgoneta'} · {temas.length} temas</p>

      <div className="mt-8">
        {temas.map((t) => (
          <section key={t.tema} className="grid gap-4 border-t border-[color:var(--ld-border)] py-7 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[56px_220px_minmax(0,1fr)]" data-testid="dev-otra-tema">
            <Vehiculo tipo={vehiculo} zona={t.zona} ancho={48} className="hidden sm:block" />
            <div>
              <h2 className="text-[21px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--ld-text)]">{t.nombre}</h2>
              {t.rango && <p className="mt-1.5 text-[14.5px] leading-snug text-[color:var(--ld-text2)]" data-testid="dev-rango">{t.rango}</p>}
            </div>
            <ul className="sm:col-start-2 lg:col-start-auto">
              {t.filas.map(({ c, p }) => (
                <li key={`${c.slug}-${p.regla}`} className="border-b border-[color:var(--ld-border)] py-3 first:pt-0 last:border-b-0">
                  <p className="text-[15px] leading-snug text-[color:var(--ld-text)]">
                    <a href={`/devolucion-renting/${c.slug}`} className="font-bold text-[color:var(--ld-text)] underline-offset-[3px] hover:underline">{c.nombre}</a>
                    {p.r.medida && <span className="ml-2 font-mono text-[12.5px] text-[color:var(--ld-muted)]">{medidaTexto(p.r.medida)}</span>}
                  </p>
                  <p className="mt-0.5 text-[14px] leading-snug text-[color:var(--ld-text2)]"><span className="font-semibold text-[color:var(--ld-ok)]">No cobra:</span> {p.r.no_se_cobra} <Pag n={p.r.pagina} /></p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-2 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] font-semibold leading-snug text-[color:var(--ld-text)]">Orientativo: cada compañía tiene su guía. {AVISO.replace('Orientativo: d', 'D')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={onAtras} className={BTN_SECUNDARIO}>Elegir una compañía</button>
      </div>
      <p className="mt-5 text-[14px] text-[color:var(--ld-muted)]">Cada compañía, con todos sus criterios y su fuente: {COMPANIAS.filter((c) => c.tipo === 'renting').map((c, i, a) => (
        <span key={c.slug}><a href={`/devolucion-renting/${c.slug}`} className={ENLACE_TEXTO}>{c.nombre}</a>{i < a.length - 1 ? ', ' : '.'}</span>))}
      </p>
      <div className="mt-8"><PuertaFds /></div>
    </div>
  )
}
