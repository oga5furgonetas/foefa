/* «Si lo devolvieras hoy»: lo que SU guía dice que se factura (cada cosa con su regla y su página), lo que queda dentro
   de lo que acepta, lo que no sabes todavía, lo que la guía dice del proceso, el aviso fijo y la fuente. Nunca «te lo
   cobrarán»: «su guía dice que se factura». Se guarda o se imprime (hoja de impresión) y se manda: el resultado viaja
   en el propio enlace. */
import { useState } from 'react'
import { DOCUMENTOS, aparteDe, companiaDe } from '../../lib/guiasRenting'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../portadaComun'
import { MARCA } from '../../marca'
import { AVISO, ENLACE_TEXTO, Fuente, Mandanosla, Pag, PuertaFds, etiquetaPaso, zonaNombre } from './comun'

const CONSEJO_REVISAR = /luz natural|seco|al revisarlo|revisar el coche limpio/i

function Item({ titulo, texto, pagina, nota, testid }) {
  return (
    <li className="border-t border-[color:var(--ld-border)] py-3.5 [break-inside:avoid]" data-testid={testid}>
      <p className="text-[15.5px] font-bold leading-snug text-[color:var(--ld-text)]">{titulo}{nota && <span className="font-semibold text-[color:var(--ld-muted)]"> · {nota}</span>}</p>
      <p className="mt-1 text-[14px] leading-snug text-[color:var(--ld-text2)]">{texto} {pagina && <Pag n={pagina} />}</p>
    </li>
  )
}

function Bloque({ titulo, cuenta, children, testid }) {
  return (
    <section className="mt-9 [break-inside:avoid-page]" data-testid={testid}>
      <h3 className="flex items-baseline justify-between gap-3 text-[18px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">{titulo}{cuenta != null && <span className="font-mono text-[14px] font-medium text-[color:var(--ld-muted)]">{cuenta}</span>}</h3>
      <ul className="mt-2.5 border-b border-[color:var(--ld-border)]">{children}</ul>
    </section>
  )
}

export default function Resultado({ vehiculo, compania, doc, pasos, respuestas, notas, onRevisar, onEmpezar }) {
  const d = DOCUMENTOS[doc]
  const c = companiaDe(compania)
  const [copiado, setCopiado] = useState('')
  const de = (tipo) => pasos.map((p, i) => ({ p, i })).filter(({ p, i }) => respuestas[i] === 'si' && p.si === tipo)
  const factura = de('factura')
  const fuera = de('fuera')
  const sinCriterio = de('sin_criterio')
  const dentro = pasos.map((p, i) => ({ p, i })).filter(({ i }) => respuestas[i] === 'no')
  const noSe = pasos.map((p, i) => ({ p, i })).filter(({ i }) => respuestas[i] === 'nose')
  const consejos = (d.proceso.recomendaciones_antes_de_devolver || []).filter((t) => CONSEJO_REVISAR.test(t))
  const aparte = aparteDe(doc, vehiculo)
  const pr = d.proceso

  async function mandar() {
    const url = window.location.href
    const titulo = `Lo que la guía de ${c.nombre} dice que se factura`
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return }
    } catch (e) { if (e && e.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(url); setCopiado('Enlace copiado. Pégalo donde quieras.') } catch { setCopiado(`Copia este enlace: ${url}`) }
  }

  return (
    <div className="mx-auto max-w-[760px] pb-10 pt-6 sm:pt-10" data-testid="dev-resultado">
      <p className="mb-6 hidden border-b border-[color:var(--ld-border)] pb-3 text-[15px] font-extrabold text-[color:var(--ld-text)] print:block">{MARCA.nombre} · ¿Qué te van a cobrar al devolverlo?</p>
      <div className="flex items-center justify-between gap-3 text-[14px] text-[color:var(--ld-muted)]">
        <span>Si lo devolvieras hoy</span>
        <span className="font-mono text-[13px]">{c.nombre} · {vehiculo}</span>
      </div>

      <div className="mt-5 flex items-end gap-4">
        <b className={`ld-titular text-[72px] leading-[0.82] tabular-nums ${factura.length ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-ok)]'}`} data-testid="dev-cifra">{factura.length}</b>
        <h2 className="pb-1 text-[18px] font-semibold leading-tight text-[color:var(--ld-text)] sm:text-[20px]">
          {factura.length === 1 ? 'cosa que su guía dice que se factura' : 'cosas que su guía dice que se facturan'}
        </h2>
      </div>
      <p className="mt-3 text-[14.5px] text-[color:var(--ld-muted)]">
        De {pasos.length} preguntas: {dentro.length} dentro de lo que acepta{fuera.length + sinCriterio.length ? `, ${fuera.length + sinCriterio.length} que su guía no deja claras` : ''}{noSe.length ? `, ${noSe.length} sin saber todavía` : ''}.
      </p>

      {factura.length > 0 && (
        <Bloque titulo="Lo que su guía dice que se factura" testid="dev-factura">
          {factura.map(({ p, i }) => <Item key={i} titulo={p.hallazgo} nota={notas[i]} texto={p.r.se_cobra} pagina={p.r.pagina} testid="dev-item-factura" />)}
        </Bloque>
      )}
      {fuera.length > 0 && (
        <Bloque titulo="Fuera de lo que su guía da por bueno" testid="dev-fuera">
          {fuera.map(({ p, i }) => <Item key={i} titulo={p.hallazgo} nota={notas[i]} texto={`Acepta: ${p.r.no_se_cobra}${p.r.se_cobra ? ` Y dice: ${p.r.se_cobra}` : ' No dice cómo lo cobra.'}`} pagina={p.r.pagina} />)}
        </Bloque>
      )}
      {sinCriterio.length > 0 && (
        <Bloque titulo="Lo que su guía no dice si se cobra" testid="dev-sin-criterio">
          {sinCriterio.map(({ p, i }) => <Item key={i} titulo={p.hallazgo} nota={notas[i]} texto={[p.r.se_cobra, p.nota].filter(Boolean).join(' ')} pagina={p.r.pagina} />)}
        </Bloque>
      )}
      {noSe.length > 0 && (
        <Bloque titulo="Lo que no sabes todavía" cuenta={noSe.length} testid="dev-nose-lista">
          {noSe.map(({ p, i }) => <Item key={i} titulo={p.pregunta} texto={`${zonaNombre(p.zona)}. Su guía no lo cobra si: ${p.r.no_se_cobra}`} pagina={p.r.pagina} />)}
          {consejos.length > 0 && (
            <li className="border-t border-[color:var(--ld-border)] py-3.5 text-[14px] leading-snug text-[color:var(--ld-text2)]">
              <b className="font-semibold text-[color:var(--ld-text)]">Lo que recomienda su guía para mirarlo:</b> {consejos.join(' ')}
            </li>
          )}
        </Bloque>
      )}
      {dentro.length > 0 && (
        <Bloque titulo="Dentro de lo que su guía acepta" cuenta={dentro.length} testid="dev-dentro">
          {dentro.map(({ p, i }) => <Item key={i} titulo={etiquetaPaso(p)} texto={`Contestaste que no a: ${p.pregunta}`} pagina={p.r.pagina} />)}
        </Bloque>
      )}
      {aparte.length > 0 && (
        <Bloque titulo="Más cosas que pide su guía" testid="dev-aparte">
          {aparte.map((r) => <Item key={r.indice} titulo={r.dano} texto={r.se_cobra ? `${r.no_se_cobra} Se cobra: ${r.se_cobra}` : r.no_se_cobra} pagina={r.pagina} />)}
        </Bloque>
      )}

      <section className="mt-9 [break-inside:avoid-page]" data-testid="dev-proceso">
        <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">Lo que dice su guía de la devolución</h3>
        <dl className="mt-2.5 border-b border-[color:var(--ld-border)] text-[14px] leading-snug">
          {[['Quién lo revisa', pr.quien_inspecciona], ['Qué te dan', pr.informe_al_cliente], ['¿Se puede reparar antes?', pr.se_puede_reparar_antes], ['Plazo para discutirlo', pr.plazo_para_discutir]]
            .filter(([, t]) => t).map(([k, t]) => (
              <div key={k} className="grid gap-1 border-t border-[color:var(--ld-border)] py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
                <dt className="font-semibold text-[color:var(--ld-text)]">{k}</dt><dd className="text-[color:var(--ld-text2)]">{t}</dd>
              </div>
            ))}
        </dl>
      </section>

      <p className="mt-8 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] font-semibold leading-snug text-[color:var(--ld-text)]" data-testid="dev-aviso">{AVISO}</p>
      <Fuente doc={doc} className="mt-4" />

      <div className="mt-8 grid gap-2.5 sm:grid-cols-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={`${BTN_PRIMARIO} w-full`} data-testid="dev-imprimir">Guardar o imprimir</button>
        <button type="button" onClick={mandar} className={`${BTN_SECUNDARIO} w-full`} data-testid="dev-mandar">Mandárselo a alguien</button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-[20px] break-all text-[13.5px] text-[color:var(--ld-ok)] print:hidden" data-testid="dev-copiado">{copiado}</p>
      <p className="mt-1 text-[13.5px] text-[color:var(--ld-muted)] print:hidden">El resultado va en el propio enlace: no se guarda en ningún servidor.</p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[14.5px] print:hidden">
        <button type="button" onClick={onRevisar} className={`${ENLACE_TEXTO} min-h-[44px]`} data-testid="dev-revisar">Cambiar una respuesta</button>
        <button type="button" onClick={onEmpezar} className={`${ENLACE_TEXTO} min-h-[44px]`}>Empezar con otro vehículo</button>
        <a href={`/devolucion-renting/${compania}`} className={`${ENLACE_TEXTO} inline-flex min-h-[44px] items-center`}>Ver todos los criterios de {c.nombre}</a>
      </div>
      <div className="mt-6 print:hidden"><Mandanosla doc={doc} /></div>
      <div className="mt-8"><PuertaFds /></div>
      <p className="mt-6 hidden text-[12px] text-[color:var(--ld-muted)] print:block">Hecho con la herramienta pública de devolución de {MARCA.nombre}: {typeof window !== 'undefined' ? window.location.host : ''}/devolucion-renting. Nada de esto se guarda en ningún servidor.</p>
    </div>
  )
}
