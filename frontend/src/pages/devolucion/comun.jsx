/* Piezas pequeñas que comparten las pantallas de /devolucion-renting (14-11-2026): la regla tal cual (con las palabras
   del documento: «Su guía acepta», «Su guía no acepta», «Sus condiciones cobran»…), la fuente, la página, la edad del
   documento, el aviso fijo y la puerta a FDS. Solo en español (como toda la herramienta en esta versión). */
import { ArrowRight } from 'lucide-react'
import { MARCA } from '../../marca'
import { AUTOR, DOCUMENTOS, LEIDA_TEXTO, VIGENCIA, ZONAS, aceptaDe, baseTexto, cobraDe, companiaDelDocumento, enLinea, vozDe } from '../../lib/guiasRenting'

export const RUTA = '/devolucion-renting'
export { ORDEN_ZONAS } from '../../lib/guiasRenting'
export const zonaNombre = (z) => ZONAS[z] || z

/* El aviso fijo: en renting decide su perito con su guía; en un alquiler, quien revise el vehículo con sus condiciones. */
export function avisoDe(c) {
  if (c?.tipo !== 'alquiler') return 'Orientativo: decide el perito de tu compañía con la guía que esté en vigor.'
  return `Orientativo: decide quien revise el vehículo en ${c.nombre}, con ${c.voz === 'condiciones' ? 'las condiciones que estén' : 'la tabla que esté'} en vigor.`
}

/* El nombre de un paso: la zona y, si la zona tiene varios pasos, de qué va cada uno. */
const DE_QUE = { abolladuras: 'abolladuras', aranazos: 'arañazos', rozaduras: 'rozaduras' }
export const etiquetaPaso = (p) => (p.tema === 'accesorios' ? 'Accesorios' : DE_QUE[p.tema] ? `${zonaNombre(p.zona)} · ${DE_QUE[p.tema]}` : zonaNombre(p.zona))

export const H1 = 'ld-titular text-[36px] leading-[1.02] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[52px]'
export const H2 = 'ld-titular text-[26px] leading-[1.08] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[32px]'
export const ETIQUETA = 'text-[13px] font-semibold text-[color:var(--ld-muted)]'
export const ENLACE_TEXTO = 'font-semibold text-[color:var(--ld-accent)] underline underline-offset-[3px] hover:no-underline'
/* Un enlace que se repite en cada fila («Cambiar»): gris y sin subrayar; se subraya y pasa a tinta al pasar por encima
   o con el teclado. Así la lista no se llena de subrayados. */
export const ENLACE_CALLADO = 'font-semibold text-[color:var(--ld-muted)] underline-offset-[3px] hover:text-[color:var(--ld-text)] hover:underline focus-visible:text-[color:var(--ld-text)] focus-visible:underline'

/* «pág. 7», en mono y en el cian de texto. */
export function Pag({ n, className = '' }) {
  return <span className={`whitespace-nowrap font-mono text-[12px] text-[color:var(--ld-accent)] ${className}`}>pág. {n}</span>
}

/* De quién es el documento al citarlo: «LeasePlan (hoy Ayvens)», «Hertz». */
export const autorDe = (doc) => AUTOR[doc] || companiaDelDocumento(doc)?.nombre || ''

/* «Documento de LeasePlan (hoy Ayvens), sin fecha: puede no ser el que esté en vigor…», con el punto ámbar. */
export function Vigencia({ doc, className = '' }) {
  if (!VIGENCIA[doc]) return null
  return (
    <p className={`flex gap-2.5 text-[13.5px] leading-snug text-[color:var(--ld-text2)] ${className}`} data-testid="dev-vigencia">
      <span aria-hidden="true" className="mt-[6px] inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ambar)] [-webkit-print-color-adjust:exact] [print-color-adjust:exact]" />{VIGENCIA[doc]}
    </p>
  )
}

/* Una línea de la regla: la etiqueta encima («Su guía acepta») o, cuando el dato ya lo dice entero («La guía no pone
   ningún caso aceptable»), la frase sola. */
export function Linea({ etiqueta, texto, color, className = '', children }) {
  return (
    <p className={`leading-snug text-[color:var(--ld-text)] ${className}`}>
      {etiqueta && <span className={`block text-[12.5px] font-semibold ${color}`}>{etiqueta}</span>}{texto}{children}
    </p>
  )
}

/* Dónde dice el documento que cobra eso: «Lo pone bajo «Facturables» (8.3 Pintura), en su pág. 31.», o la frase con su
   página. La de Europcar está en su web: con su enlace. */
export function BaseCobro({ b, doc, que = null, className = '' }) {
  const v = vozDe(doc)
  const lo = que ? 'lo' : 'Lo'
  return (
    <p className={`text-[13.5px] leading-snug text-[color:var(--ld-muted)] ${className}`} data-testid="dev-base-cobro">
      {que && <b className="font-semibold text-[color:var(--ld-text2)]">{que}: </b>}
      {b.fuente
        ? <>{lo} dice <a href={b.url} target="_blank" rel="noopener noreferrer" className={ENLACE_TEXTO}>{b.fuente.charAt(0).toLowerCase() + b.fuente.slice(1)}</a>: «{b.cita}».</>
        : baseTexto(b, v, lo)}
    </p>
  )
}

/* La condición que el documento pone a ese cobro (Alphabet, lo de fuera), con el punto ámbar: a la vista. */
export function CondicionCobro({ texto, className = '' }) {
  return (
    <p className={`flex gap-2.5 text-[14px] leading-snug text-[color:var(--ld-text2)] ${className}`} data-testid="dev-condicion-cobro">
      <span aria-hidden="true" className="mt-[6px] inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ambar)] [-webkit-print-color-adjust:exact] [print-color-adjust:exact]" />{texto}
    </p>
  )
}

/* Una regla tal cual: lo que acepta, lo que no (o lo que dice que se factura, si es lo que pregunta el paso), la
   condición y la cita con su página. `si`: la respuesta «Sí» del paso, para la etiqueta de lo que no acepta. */
export function TextoRegla({ r, doc, si = null, compacta = false, sinCita = false }) {
  const v = vozDe(doc)
  const t = compacta ? 'text-[14.5px]' : 'text-[15.5px]'
  return (
    <div className="space-y-2.5">
      <Linea {...aceptaDe(r, v)} color="text-[color:var(--ld-ok)]" className={t} />
      <Linea {...cobraDe(r, v, si)} color="text-[color:var(--ld-warn)]" className={t}>
        {r.paginaCobro != null && r.paginaCobro !== r.pagina && <> <Pag n={r.paginaCobro} /></>}
      </Linea>
      {r.condicion && <p className="text-[13.5px] leading-snug text-[color:var(--ld-muted)]">{r.condicion}</p>}
      {!sinCita && (
        <p className="text-[13px] leading-snug text-[color:var(--ld-muted)]">
          «{r.cita}» <span className="whitespace-nowrap">· {autorDe(doc)}, <Pag n={r.pagina} /></span>
        </p>
      )}
    </div>
  )
}

/* Lo que no acepta, en una línea («Su guía no acepta: …», o la frase entera). */
export const textoNoAcepta = (r, doc, si = null) => enLinea(cobraDe(r, vozDe(doc), si))
/* Lo que acepta, en una línea («Su guía acepta: …», o la frase entera). */
export const textoAcepta = (r, doc) => enLinea(aceptaDe(r, vozDe(doc)))

/* La fuente de un documento: con su enlace, la edición tal como figura y la fecha en que lo leímos. En papel, la
   dirección escrita (un enlace no se puede pulsar). */
export function Fuente({ doc, className = '' }) {
  const d = DOCUMENTOS[doc]
  if (!d) return null
  const enlace = (url, texto) => (
    <><a href={url} target="_blank" rel="noopener noreferrer" className={ENLACE_TEXTO}>{texto}</a><span className="hidden break-all print:inline" data-testid="dev-fuente-url"> ({url})</span></>
  )
  return (
    <div className={`text-[13.5px] leading-relaxed text-[color:var(--ld-muted)] ${className}`} data-testid="dev-fuente">
      <p>Fuente: {enlace(d.url, d.nombre)}{d.web && <> · {enlace(d.web.url, d.web.texto)}</>}.</p>
      <p>Edición: {d.edicion}. Leído el {LEIDA_TEXTO}. {d.paginasNota}</p>
    </div>
  )
}

/* «Si tu guía es más reciente, mándanosla», al correo de contacto (con el nombre que tenga su documento). */
const MANDANOSLA = { condiciones: 'Si sus condiciones son más recientes, mándanoslas', tabla: 'Si su tabla es más reciente, mándanosla', ficha: 'Si su ficha es más reciente, mándanosla' }
export function Mandanosla({ doc }) {
  const c = companiaDelDocumento(doc)
  const asunto = encodeURIComponent(`Documento de devolución${c ? ` de ${c.nombre}` : ''}`)
  return (
    <p className="text-[13.5px] text-[color:var(--ld-muted)]">
      <a href={`mailto:${MARCA.correo}?subject=${asunto}`} className={ENLACE_TEXTO} data-testid="dev-mandanosla">{MANDANOSLA[c?.voz] || 'Si tu guía es más reciente, mándanosla'}</a>
    </p>
  )
}

/* La puerta a FDS para quien lleva varios vehículos: lo que hace hoy (el repaso del día, con la foto de hoy junto a la
   anterior del mismo lado). */
export function PuertaFds() {
  return (
    <a href="/" data-testid="dev-puerta-fds" className="group flex min-h-[64px] items-center gap-3 border-t border-[color:var(--ld-border)] py-5 text-[15px] leading-snug text-[color:var(--ld-muted)] print:hidden">
      <span><b className="font-semibold text-[color:var(--ld-text)]">¿Llevas varias furgonetas?</b>{' '}
        Con {MARCA.nombre} cada conductor fotografía la suya cada día y tú repasas la foto de hoy junto a la anterior del mismo lado: puedes ver el golpe el día que aparece, no el día de la devolución.</span>
      <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-[color:var(--ld-text)] transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}
