/* «Si lo devolvieras hoy»: lo que SU documento no da por bueno, con tres etiquetas que hablan como él («Su guía dice
   que se factura» solo si lo dice para ese caso, «Su guía no lo acepta», «Su guía no lo dice»), cada cosa con su regla
   y su página; lo que has contestado que no (sin decir que lo acepta: debajo, lo que no se ha preguntado de esa zona y
   tampoco acepta); lo que no sabes todavía; lo que dice del proceso; la edad del documento, el aviso fijo y la fuente.
   Las cuentas, en guiasRenting.resumen (las vigila scripts/check-guias-renting.mjs). Cada respuesta se puede cambiar.
   Se guarda o se imprime (hoja de impresión, con la fecha y las direcciones escritas) y se manda: el resultado viaja
   en el propio enlace. */
import { useState } from 'react'
import { DOCUMENTOS, aceptaDe, aparteDe, cobraDe, cobroDe, companiaDe, noAceptaDe, paginaCobroDe, paginasDe, resumen, sinTolerancia, titularDe, vozDe } from '../../lib/guiasRenting'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../portadaComun'
import { MARCA } from '../../marca'
import { BaseCobro, CondicionCobro, ENLACE_TEXTO, Fuente, Mandanosla, Pag, PuertaFds, Vigencia, avisoDe, etiquetaPaso, textoAcepta, textoNoAcepta, zonaNombre } from './comun'

const CONSEJO_REVISAR = /luz natural|seco|al revisarlo|revisar el coche limpio/i
const hoy = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function Item({ titulo, nota, children, onCambiar, etiqueta, testid }) {
  return (
    <li className="border-t border-[color:var(--ld-border)] py-3.5 [break-inside:avoid]" data-testid={testid}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15.5px] font-bold leading-snug text-[color:var(--ld-text)]">{titulo}{nota && <span className="font-semibold text-[color:var(--ld-muted)]"> · {nota}</span>}</p>
        {onCambiar && (
          <button type="button" onClick={onCambiar} aria-label={`Cambiar la respuesta: ${etiqueta}`} className={`${ENLACE_TEXTO} -my-2 inline-flex min-h-[44px] shrink-0 items-center text-[13.5px] print:hidden`} data-testid="dev-cambiar">Cambiar</button>
        )}
      </div>
      <div className="mt-1 space-y-1.5 text-[14px] leading-snug text-[color:var(--ld-text2)]">{children}</div>
    </li>
  )
}

/* La nota del paso (la póliza de VWFS, la zona A, el testigo de BMW…): va también en el resultado. */
const NotaPaso = ({ p }) => (p.nota ? <p className="flex gap-2.5" data-testid="dev-nota-resultado"><span aria-hidden="true" className="mt-[6px] inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ambar)]" />{p.nota}</p> : null)

function Bloque({ titulo, cuenta, children, pie, testid }) {
  return (
    <section className="mt-9 [break-inside:avoid-page]" data-testid={testid}>
      <h3 className="flex items-baseline justify-between gap-3 text-[18px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">{titulo}{cuenta != null && <span className="font-mono text-[14px] font-medium text-[color:var(--ld-muted)]">{cuenta}</span>}</h3>
      <ul className="mt-2.5 border-b border-[color:var(--ld-border)]">{children}</ul>
      {pie}
    </section>
  )
}

export default function Resultado({ vehiculo, compania, doc, pasos, respuestas, notas, onCambiar, onEmpezar }) {
  const d = DOCUMENTOS[doc]
  const c = companiaDe(compania)
  const v = vozDe(c)
  const n = v.plural ? 'n' : ''
  const [copiado, setCopiado] = useState('')
  const cuentas = resumen(pasos, respuestas)
  const { factura, fuera, sinCriterio, no, noSe, cifra } = cuentas
  const consejos = (d.proceso.recomendaciones_antes_de_devolver || []).filter((t) => CONSEJO_REVISAR.test(t))
  const aparte = aparteDe(doc, vehiculo)
  const pr = d.proceso
  // Dónde dice el documento que cobra lo de cada cosa que «se factura» (si no lo dice la propia regla), una vez cada
  // frase, y las condiciones que pone a ese cobro (Alphabet, lo de fuera: su pág. 6), una vez cada una.
  // Si hay más de una frase, cada una dice a qué cosas alcanza («Paragolpes y retrovisores: lo pone bajo…»).
  const porBase = new Map()
  for (const { p } of factura) {
    for (const b of cobroDe(doc, p.tema, vehiculo)) {
      const k = `${b.pagina || b.fuente}|${b.cita}`
      if (!porBase.has(k)) porBase.set(k, { b, que: [] })
      const que = porBase.get(k).que
      const nombre = p.tema === 'accesorios' ? 'Accesorios' : zonaNombre(p.zona)
      if (!que.includes(nombre)) que.push(nombre)
    }
  }
  const bases = [...porBase.values()]
  const condiciones = [...new Set(bases.map(({ b }) => b.condicion).filter(Boolean))]
  const juntar = (l) => l.map((t, k) => (k ? t.charAt(0).toLowerCase() + t.slice(1) : t)).join(', ').replace(/, ([^,]*)$/, ' y $1')
  const titular = titularDe(pasos, cuentas, v)
  const partes = [[factura, `que ${v.su} dice${n} que se factura${factura.length === 1 ? '' : 'n'}`], [fuera, `que no acepta${n}`], [sinCriterio, 'que no dice si se cobra'],
    [noSe, 'sin saber todavía'], [no, 'que has contestado que no']].filter(([l]) => l.length).map(([l, t]) => `${l.length} ${t}`)
  const cambiar = (i) => () => onCambiar(i)
  // Lo que no se ha preguntado de una zona contestada con «No», en tres grupos que no se mezclan: lo que no acepta sea
  // del tamaño que sea, lo que acepta solo hasta un límite (nunca «tampoco acepta» de algo que acepta en parte) y lo
  // demás de lo que habla sin decir qué acepta. Una tabla de precios no «acepta» nada: a todo le pone precio.
  const sinPreguntar = (p) => {
    const otras = p.mas.filter((r) => cobraDe(r, v).etiqueta)
    if (v.voz === 'tabla') return otras.length ? [{ que: otras, dice: `Sin preguntar, en esta zona ${v.su} también pone precio a` }] : []
    const ninguna = otras.filter(sinTolerancia)
    const limites = otras.filter((r) => !ninguna.includes(r) && aceptaDe(r, v).etiqueta === v.acepta)
    const resto = otras.filter((r) => !ninguna.includes(r) && !limites.includes(r))
    const grupos = [
      [ninguna, v.voz === 'condiciones' ? `${v.su} cobran, sea del tamaño que sea` : `${v.su} no acepta${n}, sea del tamaño que sea`, null],
      [limites, `${v.su} pone${n} límites a`, `pone${n} límites a`],
      [resto, `${v.su} también habla${n} de`, `habla${n} también de`],
    ].filter(([l]) => l.length)
    return grupos.map(([que, primero, despues], k) => ({ que, dice: k === 0 ? `Sin preguntar, en esta zona ${primero}` : `Y ${despues}` }))
  }

  async function mandar() {
    const url = window.location.href
    const titulo = `Lo que ${v.su} de ${c.nombre} no da por bueno`
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return }
    } catch (e) { if (e && e.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(url); setCopiado('Enlace copiado. Pégalo donde quieras.') } catch { setCopiado(`Copia este enlace: ${url}`) }
  }

  return (
    <div className="mx-auto max-w-[760px] pb-10 pt-6 sm:pt-10" data-testid="dev-resultado">
      <p className="mb-6 hidden border-b border-[color:var(--ld-border)] pb-3 text-[15px] font-extrabold text-[color:var(--ld-text)] print:flex print:justify-between" data-testid="dev-impresion-cabecera">
        <span>{MARCA.nombre} · ¿Qué te van a cobrar al devolverlo?</span><span className="font-mono text-[13px] font-medium">Hecho el {hoy()}</span>
      </p>
      <div className="flex items-center justify-between gap-3 text-[14px] text-[color:var(--ld-muted)]">
        <span>Si lo devolvieras hoy</span>
        <span className="font-mono text-[13px]">{c.nombre} · {vehiculo}</span>
      </div>

      <div className="mt-5 flex items-end gap-4">
        <b className={`ld-titular text-[72px] leading-[0.82] tabular-nums ${cifra ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-text)]'}`} data-testid="dev-cifra">{cifra}</b>
        <h2 className="pb-1 text-[18px] font-semibold leading-tight text-[color:var(--ld-text)] sm:text-[20px]" data-testid="dev-titular">{titular}</h2>
      </div>
      <p className="mt-3 text-[14.5px] text-[color:var(--ld-muted)]" data-testid="dev-desglose">De {pasos.length} preguntas: {partes.join(', ')}.</p>
      <Vigencia doc={doc} className="mt-4" />
      {c.tipo === 'alquiler' && c.aviso && <p className="mt-4 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[14px] leading-snug text-[color:var(--ld-text2)]" data-testid="dev-alquiler">{c.aviso}</p>}

      {factura.length > 0 && (
        <Bloque titulo={`Lo que ${v.su} dice${n} que se factura`} cuenta={factura.length} testid="dev-factura"
          pie={<>
            {bases.map(({ b, que }) => <BaseCobro key={`${b.pagina || b.fuente}|${b.cita}`} b={b} doc={doc} que={bases.length > 1 ? juntar(que) : null} className="mt-2.5" />)}
            {condiciones.map((t) => <CondicionCobro key={t} texto={t} className="mt-3" />)}
          </>}>
          {factura.map(({ p, i }) => (
            <Item key={i} titulo={p.hallazgo} nota={notas[i]} etiqueta={p.hallazgo} onCambiar={cambiar(i)} testid="dev-item-factura">
              <p>{p.r.se_cobra} <Pag n={paginaCobroDe(p.r)} /></p>
              {p.con.map((r) => <p key={r.indice}>{textoNoAcepta(r, doc, 'factura')} <Pag n={paginaCobroDe(r)} /></p>)}
              <NotaPaso p={p} />
            </Item>
          ))}
        </Bloque>
      )}
      {fuera.length > 0 && (
        <Bloque titulo={`Lo que ${v.su} no acepta${n}`} cuenta={fuera.length} testid="dev-fuera">
          {fuera.map(({ p, i }) => {
            const lineas = [p.r, ...p.con].map((r) => ({ r, ...noAceptaDe(r, v) }))
            return (
              <Item key={i} titulo={p.hallazgo} nota={notas[i]} etiqueta={p.hallazgo} onCambiar={cambiar(i)} testid="dev-item-fuera">
                {lineas.map(({ r, texto, pagina }) => <p key={r.indice}>{texto} <Pag n={pagina} /></p>)}
                {lineas.some((l) => l.sinCobro) && <p className="text-[color:var(--ld-muted)]" data-testid="dev-sin-cobro">No dice{n} cómo lo cobra{n}.</p>}
                <NotaPaso p={p} />
              </Item>
            )
          })}
        </Bloque>
      )}
      {sinCriterio.length > 0 && (
        <Bloque titulo={`Lo que ${v.su} no dice${n} si se cobra`} cuenta={sinCriterio.length} testid="dev-sin-criterio">
          {sinCriterio.map(({ p, i }) => (
            <Item key={i} titulo={p.hallazgo} nota={notas[i]} etiqueta={p.hallazgo} onCambiar={cambiar(i)} testid="dev-item-sin-criterio">
              <p>{p.r.se_cobra ?? v.soloAcepta} <Pag n={paginaCobroDe(p.r)} /></p>
              <NotaPaso p={p} />
            </Item>
          ))}
        </Bloque>
      )}
      {noSe.length > 0 && (
        <Bloque titulo="Lo que no sabes todavía" cuenta={noSe.length} testid="dev-nose-lista">
          {noSe.map(({ p, i }) => (
            <Item key={i} titulo={p.pregunta} etiqueta={etiquetaPaso(p)} onCambiar={cambiar(i)}>
              <p>{etiquetaPaso(p)}. {textoAcepta(p.r, doc)} <Pag n={p.r.pagina} /></p>
              <NotaPaso p={p} />
            </Item>
          ))}
          {consejos.length > 0 && (
            <li className="border-t border-[color:var(--ld-border)] py-3.5 text-[14px] leading-snug text-[color:var(--ld-text2)]">
              <b className="font-semibold text-[color:var(--ld-text)]">Lo que recomienda {v.su} para mirarlo:</b> {consejos.join(' ')}
            </li>
          )}
        </Bloque>
      )}
      {no.length > 0 && (
        <Bloque titulo="Lo que has contestado que no" cuenta={no.length} testid="dev-no-lista">
          {no.map(({ p, i }) => {
            const lista = (rs) => rs.map((r, k) => <span key={r.indice}>{r.dano.charAt(0).toLowerCase() + r.dano.slice(1)} (<Pag n={paginasDe(r)} className="text-[11.5px]" />){k < rs.length - 1 ? '; ' : '.'}</span>)
            return (
              <Item key={i} titulo={etiquetaPaso(p)} etiqueta={etiquetaPaso(p)} onCambiar={cambiar(i)} testid="dev-item-no">
                <p>Contestaste que no a: {p.pregunta} <Pag n={p.r.pagina} /></p>
                {sinPreguntar(p).map(({ que, dice }) => (
                  <p key={dice} className="text-[13.5px] text-[color:var(--ld-muted)]" data-testid="dev-sin-preguntar">
                    <b className="font-semibold text-[color:var(--ld-text2)]">{dice}:</b> {lista(que)}
                  </p>
                ))}
                <NotaPaso p={p} />
              </Item>
            )
          })}
        </Bloque>
      )}
      {aparte.length > 0 && (
        <Bloque titulo={`Más cosas que pide${n} ${v.su}`} testid="dev-aparte">
          {aparte.map((r) => (
            <Item key={r.indice} titulo={r.dano}>
              <p>{textoAcepta(r, doc)}</p>
              <p>{textoNoAcepta(r, doc)} <Pag n={paginaCobroDe(r)} /></p>
            </Item>
          ))}
        </Bloque>
      )}

      <section className="mt-9 [break-inside:avoid-page]" data-testid="dev-proceso">
        <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">Lo que dice{n} {v.su} de la devolución</h3>
        <dl className="mt-2.5 border-b border-[color:var(--ld-border)] text-[14px] leading-snug">
          {[['Quién lo revisa', pr.quien_inspecciona], ['Qué te dan', pr.informe_al_cliente], ['¿Se puede reparar antes?', pr.se_puede_reparar_antes], ['Plazo para discutirlo', pr.plazo_para_discutir]]
            .filter(([, t]) => t).map(([k, t]) => (
              <div key={k} className="grid gap-1 border-t border-[color:var(--ld-border)] py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
                <dt className="font-semibold text-[color:var(--ld-text)]">{k}</dt><dd className="text-[color:var(--ld-text2)]">{t}</dd>
              </div>
            ))}
        </dl>
      </section>

      <p className="mt-8 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] font-semibold leading-snug text-[color:var(--ld-text)]" data-testid="dev-aviso">{avisoDe(c)}</p>
      <Fuente doc={doc} className="mt-4" />

      <div className="mt-8 grid gap-2.5 sm:grid-cols-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={`${BTN_PRIMARIO} w-full`} data-testid="dev-imprimir">Guardar o imprimir</button>
        <button type="button" onClick={mandar} className={`${BTN_SECUNDARIO} w-full`} data-testid="dev-mandar">Mandárselo a alguien</button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-[20px] break-all text-[13.5px] text-[color:var(--ld-ok)] print:hidden" data-testid="dev-copiado">{copiado}</p>
      <p className="mt-1 text-[13.5px] text-[color:var(--ld-muted)] print:hidden">El resultado va en el propio enlace: no se guarda en nuestros servidores. Si lo mandas, queda donde lo mandes.</p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[14.5px] print:hidden">
        <button type="button" onClick={onEmpezar} className={`${ENLACE_TEXTO} min-h-[44px]`} data-testid="dev-otro">Empezar con otro vehículo</button>
        <a href={`/devolucion-renting/${compania}`} className={`${ENLACE_TEXTO} inline-flex min-h-[44px] items-center`}>Ver todos los criterios de {c.nombre}</a>
      </div>
      <div className="mt-6 print:hidden"><Mandanosla doc={doc} /></div>
      <div className="mt-8"><PuertaFds /></div>
      <div className="mt-6 hidden text-[12px] leading-snug text-[color:var(--ld-muted)] print:block" data-testid="dev-impresion-pie">
        <p>Hecho el {hoy()} con la herramienta pública de devolución de {MARCA.nombre}. Nada de esto se guarda en nuestros servidores.</p>
        <p className="mt-1 break-all">Este resultado, en línea: {typeof window !== 'undefined' ? window.location.href : ''}</p>
      </div>
    </div>
  )
}
