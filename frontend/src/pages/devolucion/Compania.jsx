/* UNA PÁGINA POR COMPAÑÍA (/devolucion-renting/<compañía>): la tabla de sus criterios (zona · no se cobra · se cobra ·
   página), la fuente con enlace, edición y fecha de lectura, los precios que publique, lo que dice del proceso, el botón
   para repasar el vehículo con esa guía y las demás compañías. Lo mismo, en HTML, lo sirve la función de Pages
   (functions/devolucion-renting/[compania].js) para los buscadores. */
import { useState } from 'react'
import { COMPANIAS, DOCUMENTOS, PRECIOS_APARTE, documentosDe, paginasDe, regla, subtituloCompania, tituloCompania, vehiculoPara, vozDe } from '../../lib/guiasRenting'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../portadaComun'
import { ENLACE_TEXTO, Fuente, H1, Mandanosla, ORDEN_ZONAS, Pag, PuertaFds, RUTA, Vigencia, avisoDe, zonaNombre } from './comun'
import { escribirEstado } from './estado'
import Vehiculo from './Vehiculo'

export const VEHICULO_DOC = { furgoneta: 'furgonetas', turismo: 'turismos' }


const SOLO = { turismo: 'Solo turismos', furgoneta: 'Solo furgonetas' }

/* Las cabeceras de la tabla, con el nombre de su documento: «Su guía acepta», «Sus condiciones cobran»… */
const columnas = (v) => [v.acepta, v.noAcepta]

/* Las reglas de un documento, ya agrupadas por zona y en el orden de siempre. */
const gruposDe = (id) => {
  const reglas = DOCUMENTOS[id].reglas.map((_, i) => regla(id, i))
  return ORDEN_ZONAS.map((z) => [z, reglas.filter((r) => r.zona === z)]).filter(([, l]) => l.length)
}
/* El ancla de cada zona (y de los precios y el proceso) de un documento: «#paragolpes» o, si la compañía tiene dos
   documentos, «#furgonetas-paragolpes». */
const anclaDe = (prefijo, z) => `${prefijo}${z.replace(/_/g, '-')}`

function Tabla({ id, prefijo }) {
  const d = DOCUMENTOS[id]
  const [acepta, noAcepta] = columnas(vozDe(id))
  const grupos = gruposDe(id)
  const celda = 'block py-0 sm:table-cell sm:py-3 sm:pr-4 sm:align-top'
  return (
    <table className="mt-6 w-full border-collapse text-[14.5px] leading-snug" data-testid="dev-tabla">
      <thead className="hidden sm:table-header-group">
        <tr className="border-b-[1.5px] border-[color:var(--ld-text)] text-left text-[12.5px] font-semibold text-[color:var(--ld-muted)]">
          <th scope="col" className="w-[30%] pb-2 pr-4 font-semibold">Daño</th><th scope="col" className="pb-2 pr-4 font-semibold">{acepta}</th>
          <th scope="col" className="pb-2 pl-[14px] pr-4 font-semibold">{noAcepta}</th><th scope="col" className="w-[52px] pb-2 text-right font-semibold">Pág.</th>
        </tr>
      </thead>
      {grupos.map(([z, lista]) => (
        <tbody key={z}>
          <tr><th id={anclaDe(prefijo, z)} scope="rowgroup" colSpan={4} className="scroll-mt-6 pb-1 pt-7 text-left text-[17px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">{zonaNombre(z)}</th></tr>
          {lista.map((r) => (
            <tr key={r.indice} className="block border-t border-[color:var(--ld-border)] py-3 sm:table-row sm:py-0">
              <th scope="row" className={`${celda} pb-1 text-left font-semibold text-[color:var(--ld-text)]`}>
                {r.dano}{r.aplica_a !== 'ambos' && d.aplica_a === 'ambos' && <span className="mt-1 block text-[12.5px] font-normal text-[color:var(--ld-muted)]">{SOLO[r.aplica_a]}</span>}
              </th>
              <td className={`${celda} text-[color:var(--ld-text2)]`}><span className="block text-[12.5px] font-semibold text-[color:var(--ld-ok)] sm:hidden">{acepta}</span>{r.no_se_cobra}</td>
              {/* Lo que no acepta, en tinta con una regla roja a la izquierda: se distingue sin hacer un muro rojo. */}
              <td className={`${celda} mt-2 sm:mt-0`}>
                <div className="border-l-2 border-[color:var(--ld-warn)] pl-3 text-[color:var(--ld-text)]" data-testid="dev-no-acepta">
                  <span className="block text-[12.5px] font-semibold text-[color:var(--ld-warn)] sm:hidden">{noAcepta}</span>{r.se_cobra ?? vozDe(id).soloAcepta}
                  {r.condicion && <span className="mt-1 block text-[13px] text-[color:var(--ld-muted)]">{r.condicion}</span>}
                </div>
              </td>
              <td className={`${celda} mt-1 sm:mt-0 sm:pr-0 sm:text-right`}><Pag n={paginasDe(r)} /></td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

function Precios({ id }) {
  const aparte = PRECIOS_APARTE[DOCUMENTOS[id].compania]
  const lista = DOCUMENTOS[id].precios.filter((_, i) => !aparte?.indices.includes(i))
  const tabla = vozDe(id).voz === 'tabla'
  if (!lista.length) return <p className="mt-3 text-[15px] text-[color:var(--ld-text2)]">Este documento no publica precios.</p>
  const filas = (
    <table className="mt-3 w-full border-collapse text-[14px] leading-snug" data-testid="dev-precios">
      <thead><tr className="border-b-[1.5px] border-[color:var(--ld-text)] text-left text-[12.5px] text-[color:var(--ld-muted)]"><th scope="col" className="pb-2 pr-4 font-semibold">Concepto</th><th scope="col" className="pb-2 pr-4 font-semibold">Importe</th><th scope="col" className="pb-2 text-right font-semibold">Pág.</th></tr></thead>
      <tbody>{lista.map((p, i) => (
        <tr key={i} className="border-t border-[color:var(--ld-border)]">
          <td className="py-2.5 pr-4 align-top text-[color:var(--ld-text2)]">{p.concepto}</td>
          <td className="min-w-[7.5rem] py-2.5 pr-4 align-top font-mono text-[13px] text-[color:var(--ld-text)] [overflow-wrap:anywhere]">{p.importe}</td>
          <td className="py-2.5 text-right align-top"><Pag n={p.pagina} /></td>
        </tr>))}
      </tbody>
    </table>
  )
  const nota = aparte && <p className="mt-3 text-[14px] leading-snug text-[color:var(--ld-text2)]" data-testid="dev-precio-aparte">{aparte.texto}</p>
  if (lista.length <= 25) return <>{filas}{nota}</>
  return (
    <details className="group mt-3 border-y border-[color:var(--ld-border)]">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold text-[color:var(--ld-text)] [&::-webkit-details-marker]:hidden">
        {tabla ? `Ver los ${lista.length} importes de su tabla (costes medios estimados)` : `Ver los ${lista.length} precios de su documento`} <span aria-hidden="true" className="text-[22px] font-normal leading-none text-[color:var(--ld-muted)] transition-transform group-open:rotate-45">+</span>
      </summary>
      {filas}
    </details>
  )
}

function Proceso({ id }) {
  const pr = DOCUMENTOS[id].proceso
  const filas = [['Quién lo revisa', pr.quien_inspecciona], ['Qué te dan', pr.informe_al_cliente], ['Plazo para discutirlo', pr.plazo_para_discutir], ['¿Se puede reparar antes?', pr.se_puede_reparar_antes]].filter(([, t]) => t)
  return (
    <>
      <dl className="mt-3 border-b border-[color:var(--ld-border)] text-[14.5px] leading-snug">
        {filas.map(([k, t]) => (
          <div key={k} className="grid gap-1 border-t border-[color:var(--ld-border)] py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
            <dt className="font-semibold text-[color:var(--ld-text)]">{k}</dt><dd className="text-[color:var(--ld-text2)]">{t}</dd>
          </div>))}
      </dl>
      {pr.recomendaciones_antes_de_devolver?.length > 0 && (
        <>
          <h4 className="mt-6 text-[16px] font-bold text-[color:var(--ld-text)]">Lo que recomienda antes de devolver</h4>
          <ul className="mt-2 space-y-1.5 text-[14.5px] leading-snug text-[color:var(--ld-text2)]">
            {pr.recomendaciones_antes_de_devolver.map((t) => <li key={t} className="flex gap-2.5"><span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ld-muted)]" />{t}</li>)}
          </ul>
        </>
      )}
    </>
  )
}

export default function Compania({ slug }) {
  const c = COMPANIAS.find((x) => x.slug === slug)
  // El dibujo de arriba: el vehículo del primer documento, sin marcar; al pasar por una zona del índice, se marca.
  const [marca, setMarca] = useState(null)
  if (!c) {
    return (
      <div className="pb-16 pt-10" data-testid="dev-cia-no-esta">
        <h1 className={H1}>No tenemos el documento de esa compañía</h1>
        <p className="mt-5 max-w-[620px] text-[17px] text-[color:var(--ld-text2)]">Estas son las que hemos leído:</p>
        <ul className="mt-3 space-y-1">{COMPANIAS.map((x) => <li key={x.slug}><a href={`${RUTA}/${x.slug}`} className={`${ENLACE_TEXTO} inline-flex min-h-[40px] items-center`}>{x.nombre}</a></li>)}</ul>
      </div>
    )
  }
  const docs = documentosDe(c)
  const dobles = docs.length > 1
  const otras = COMPANIAS.filter((x) => x.slug !== c.slug)
  const repasar = `${RUTA}#${escribirEstado({ vehiculo: vehiculoPara(c, 'furgoneta'), compania: c.slug })}`
  // Cada documento con su nombre («Furgonetas y vehículos industriales»), el prefijo de sus anclas y sus zonas.
  const partes = docs.map(({ id, vehiculos }) => ({
    id, vehiculos, tipo: vehiculos.includes('furgoneta') ? 'furgoneta' : 'turismo',
    nombre: vehiculos.map((v) => VEHICULO_DOC[v]).join(' y ').replace(/^./, (x) => x.toUpperCase()),
    prefijo: dobles ? `${vehiculos[0]}-` : '', zonas: gruposDe(id).map(([z]) => z),
  }))
  const dibujo = marca || { tipo: partes[0].tipo, zona: null }

  return (
    <article className="pb-6 pt-8 sm:pt-12" data-testid="dev-compania">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div>
          <h1 className={`${H1} max-w-[860px]`}>{tituloCompania(c)}</h1>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.5] text-[color:var(--ld-text2)] sm:text-[18px]">{subtituloCompania(c)}</p>
          {c.aviso && <p className="mt-4 max-w-[680px] border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] leading-snug text-[color:var(--ld-text)]" data-testid="dev-cia-aviso">{c.aviso}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={repasar} className={`${BTN_PRIMARIO} w-full sm:w-auto`} data-testid="dev-repasar">Repasar mi vehículo con {c.voz === 'condiciones' ? 'estas condiciones' : c.voz === 'tabla' ? 'esta tabla' : c.voz === 'ficha' ? 'esta ficha' : 'esta guía'}</a>
            <a href="#otras" className={`${BTN_SECUNDARIO} w-full sm:w-auto`}>Ver otra compañía</a>
          </div>
        </div>
        <div className="hidden pr-6 pt-2 lg:block" data-testid="dev-cia-dibujo">
          <Vehiculo tipo={dibujo.tipo} zona={dibujo.zona} ancho={116} />
        </div>
      </div>

      {/* El índice: las zonas de cada documento, con su ancla. Al pasar por una, el dibujo la marca. */}
      <nav aria-label="Zonas del documento" className="mt-10 border-b border-[color:var(--ld-border)]" data-testid="dev-indice" onMouseLeave={() => setMarca(null)}>
        {partes.map(({ id, nombre, tipo, prefijo, zonas }) => (
          <div key={id} className="flex flex-col gap-x-6 border-t border-[color:var(--ld-border)] py-2.5 sm:flex-row sm:items-baseline">
            {dobles && <p className="w-full shrink-0 pt-1 text-[14.5px] font-bold text-[color:var(--ld-text)] sm:w-[148px] sm:pt-0">{nombre}</p>}
            <ul className="flex flex-wrap gap-x-5">
              {zonas.map((z) => (
                <li key={z}>
                  <a href={`#${anclaDe(prefijo, z)}`} onMouseEnter={() => setMarca({ tipo, zona: z })} onFocus={() => setMarca({ tipo, zona: z })} onBlur={() => setMarca(null)}
                    className="inline-flex min-h-[40px] items-center text-[14.5px] text-[color:var(--ld-text2)] underline-offset-[3px] hover:text-[color:var(--ld-text)] hover:underline" data-testid="dev-indice-zona">{zonaNombre(z)}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {partes.map(({ id, nombre, prefijo }) => (
        <section key={id} className="mt-12" data-testid="dev-cia-doc">
          {dobles && <h2 className="ld-titular text-[28px] leading-tight text-[color:var(--ld-text)] sm:text-[34px]">{nombre}</h2>}
          <Fuente doc={id} className={dobles ? 'mt-3' : ''} />
          <Vigencia doc={id} className="mt-3" />
          <Tabla id={id} prefijo={prefijo} />
          <h3 id={`${prefijo}precios`} className="mt-12 scroll-mt-6 text-[20px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">{c.voz === 'tabla' ? 'Costes medios que publica su tabla' : 'Precios que publica'}</h3>
          <Precios id={id} />
          <h3 id={`${prefijo}devolucion`} className="mt-12 scroll-mt-6 text-[20px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">Cómo es la devolución, según este documento</h3>
          <Proceso id={id} />
        </section>
      ))}

      <p className="mt-10 border-l-[3px] border-[color:var(--ld-ambar)] pl-3 text-[15px] font-semibold leading-snug text-[color:var(--ld-text)]" data-testid="dev-cia-orientativo">{avisoDe(c)}</p>
      <div className="mt-4"><Mandanosla doc={docs[0].id} /></div>

      <section id="otras" className="mt-12 scroll-mt-24 border-t border-[color:var(--ld-border)] pt-8">
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[color:var(--ld-text)]">Otras compañías</h2>
        <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {otras.map((x) => (
            <li key={x.slug} className="border-b border-[color:var(--ld-border)]">
              <a href={`${RUTA}/${x.slug}`} className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-[15.5px] font-semibold text-[color:var(--ld-text)] hover:underline">
                {x.nombre}<span className="text-[13px] font-normal text-[color:var(--ld-muted)]">{x.tipo === 'alquiler' ? 'alquiler' : 'renting'}</span>
              </a>
            </li>))}
        </ul>
      </section>
      <div className="mt-10"><PuertaFds /></div>
    </article>
  )
}

