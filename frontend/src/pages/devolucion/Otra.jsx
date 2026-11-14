/* «Otra compañía»: en vez de inventar, lo que piden las compañías de renting que publican su guía, tema a tema, cada
   una con su nombre, su medida, lo que acepta dicho como ella lo dice y su página. Sin rangos que junten medidas que
   no son la misma cosa (guiasRenting.filasOtra). Orientación, no la regla de nadie. */
import { ArrowLeft } from 'lucide-react'
import { COMPANIAS, aceptaDe, filasOtra, medidaTexto, vozDe } from '../../lib/guiasRenting'
import { BTN_SECUNDARIO } from '../portadaComun'
import Vehiculo from './Vehiculo'
import { ENLACE_TEXTO, H1, Pag, PuertaFds, autorDe } from './comun'

export default function Otra({ vehiculo, onAtras }) {
  const temas = filasOtra(vehiculo)
  const nombres = [...new Set(temas.flatMap((t) => t.filas.map((f) => f.c.slug)))].map((s) => COMPANIAS.find((c) => c.slug === s))
  return (
    <div className="pb-6 pt-6 sm:pt-10" data-testid="dev-otra">
      <button type="button" onClick={onAtras} className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[14px] font-semibold text-[color:var(--ld-text)] hover:underline" data-testid="dev-atras">
        <ArrowLeft size={16} aria-hidden="true" />Atrás
      </button>
      <h1 className={`${H1} mt-3 max-w-[820px]`}>Lo que piden las compañías que sí publican su guía</h1>
      <p className="mt-5 max-w-[640px] text-[17px] leading-[1.5] text-[color:var(--ld-text2)]">
        Muchas compañías no publican la suya. Pídesela a la tuya antes de devolver {vehiculo === 'turismo' ? 'el coche' : 'la furgoneta'}: es la única que vale. Mientras tanto, esto es lo que piden {nombres.map((c) => c.nombre).join(', ').replace(/, ([^,]+)$/, ' y $1')}, tema a tema, cada una con su medida y su página. Cada guía mide a su manera: un arañazo, unos roces sumados, el diámetro de un impacto.
      </p>
      <p className="mt-4 font-mono text-[14px] text-[color:var(--ld-muted)]">{vehiculo === 'turismo' ? 'Turismo' : 'Furgoneta'} · {temas.length} temas</p>

      <div className="mt-8">
        {temas.map((t) => (
          <section key={t.tema} className="grid gap-4 border-t border-[color:var(--ld-border)] py-7 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[56px_220px_minmax(0,1fr)]" data-testid="dev-otra-tema">
            <Vehiculo tipo={vehiculo} zona={t.zona} ancho={48} className="hidden sm:block" />
            <h2 className="text-[21px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--ld-text)]">{t.nombre}</h2>
            <ul className="sm:col-start-2 lg:col-start-auto">
              {t.filas.map(({ c, doc, p }) => {
                const a = aceptaDe(p.r, vozDe(c))
                return (
                  <li key={`${c.slug}-${p.regla}`} className="border-b border-[color:var(--ld-border)] py-3 first:pt-0 last:border-b-0" data-testid="dev-otra-fila">
                    <p className="text-[15px] leading-snug text-[color:var(--ld-text)]">
                      <a href={`/devolucion-renting/${c.slug}`} className="font-bold text-[color:var(--ld-text)] underline-offset-[3px] hover:underline">{c.nombre}</a>
                      <span className="text-[color:var(--ld-muted)]"> · {p.r.dano.charAt(0).toLowerCase() + p.r.dano.slice(1)}</span>
                      {p.r.medida && p.r.medida.sentido === 'hasta' && <span className="ml-2 whitespace-nowrap font-mono text-[12.5px] text-[color:var(--ld-muted)]">hasta {medidaTexto(p.r.medida)}</span>}
                    </p>
                    <p className="mt-1 text-[14px] leading-snug text-[color:var(--ld-text2)]">
                      {a.etiqueta && <span className="block text-[12.5px] font-semibold text-[color:var(--ld-ok)]">{a.etiqueta}</span>}
                      {a.texto} <span className="whitespace-nowrap text-[color:var(--ld-muted)]">· {autorDe(doc)}, <Pag n={p.r.pagina} /></span>
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-2 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] font-semibold leading-snug text-[color:var(--ld-text)]">Orientativo: cada compañía tiene su guía. Decide el perito de la tuya con la guía que esté en vigor.</p>
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
