/* Piezas pequeñas que comparten las pantallas de /devolucion-renting (14-11-2026): la fuente de una guía, la página,
   el aviso fijo y la puerta a FDS. Solo en español (como toda la herramienta en esta versión). */
import { ArrowRight } from 'lucide-react'
import { MARCA } from '../../marca'
import { DOCUMENTOS, LEIDA_TEXTO, ZONAS, COMPANIAS } from '../../lib/guiasRenting'

export const RUTA = '/devolucion-renting'
export const AVISO = 'Orientativo: decide el perito de tu compañía con la guía que esté en vigor.'
export { ORDEN_ZONAS } from '../../lib/guiasRenting'
export const zonaNombre = (z) => ZONAS[z] || z
/* El nombre de un paso: la zona y, si la zona tiene dos pasos, de qué va cada uno. */
export const etiquetaPaso = (p) => (p.tema === 'abolladuras' ? `${zonaNombre(p.zona)} · abolladuras` : p.tema === 'aranazos' ? `${zonaNombre(p.zona)} · arañazos` : zonaNombre(p.zona))

export const H1 = 'ld-titular text-[36px] leading-[1.02] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[52px]'
export const H2 = 'ld-titular text-[26px] leading-[1.08] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[32px]'
export const ETIQUETA = 'text-[13px] font-semibold text-[color:var(--ld-muted)]'
export const ENLACE_TEXTO = 'font-semibold text-[color:var(--ld-accent)] underline underline-offset-[3px] hover:no-underline'

/* «pág. 7», en mono y en el cian de texto. */
export function Pag({ n, className = '' }) {
  return <span className={`whitespace-nowrap font-mono text-[12px] text-[color:var(--ld-accent)] ${className}`}>pág. {n}</span>
}

/* Una regla tal cual: lo que no se cobra, lo que se cobra, la condición y la cita con su página. */
export function TextoRegla({ r, doc, compacta = false, sinCita = false }) {
  const t = compacta ? 'text-[14.5px]' : 'text-[15.5px]'
  return (
    <div className="space-y-2.5">
      <p className={`${t} leading-snug text-[color:var(--ld-text)]`}><span className="block text-[12.5px] font-semibold text-[color:var(--ld-ok)]">No se cobra</span>{r.no_se_cobra}</p>
      <p className={`${t} leading-snug text-[color:var(--ld-text)]`}><span className="block text-[12.5px] font-semibold text-[color:var(--ld-warn)]">Se cobra</span>{r.se_cobra ?? 'La guía solo dice lo que acepta.'}</p>
      {r.condicion && <p className="text-[13.5px] leading-snug text-[color:var(--ld-muted)]">{r.condicion}</p>}
      {!sinCita && (
        <p className="text-[13px] leading-snug text-[color:var(--ld-muted)]">
          «{r.cita}» <span className="whitespace-nowrap">· {DOCUMENTOS[doc] ? `${companiaNombre(doc)}, ` : ''}<Pag n={r.pagina} /></span>
        </p>
      )}
    </div>
  )
}

export const companiaNombre = (doc) => COMPANIAS.find((c) => c.slug === DOCUMENTOS[doc]?.compania)?.nombre || ''

/* La fuente de una guía: el documento con su enlace, la edición tal como figura y la fecha en que la leímos. */
export function Fuente({ doc, className = '' }) {
  const d = DOCUMENTOS[doc]
  if (!d) return null
  return (
    <div className={`text-[13.5px] leading-relaxed text-[color:var(--ld-muted)] ${className}`} data-testid="dev-fuente">
      <p>Fuente: <a href={d.url} target="_blank" rel="noopener noreferrer" className={ENLACE_TEXTO}>{d.nombre}</a>{d.web && <> · <a href={d.web.url} target="_blank" rel="noopener noreferrer" className={ENLACE_TEXTO}>{d.web.texto}</a></>}.</p>
      <p>Edición: {d.edicion}. Leída el {LEIDA_TEXTO}. {d.paginasNota}</p>
    </div>
  )
}

/* «Si tu guía es más reciente, mándanosla», al correo de contacto. */
export function Mandanosla({ doc }) {
  const d = DOCUMENTOS[doc]
  const asunto = encodeURIComponent(`Guía de devolución${d ? ` de ${companiaNombre(doc)}` : ''}`)
  return (
    <p className="text-[13.5px] text-[color:var(--ld-muted)]">
      <a href={`mailto:${MARCA.correo}?subject=${asunto}`} className={ENLACE_TEXTO} data-testid="dev-mandanosla">Si tu guía es más reciente, mándanosla</a>
    </p>
  )
}

/* La puerta a FDS para quien lleva varios vehículos. */
export function PuertaFds() {
  return (
    <a href="/" data-testid="dev-puerta-fds" className="group flex min-h-[64px] items-center gap-3 border-t border-[color:var(--ld-border)] py-5 text-[15px] leading-snug text-[color:var(--ld-muted)] print:hidden">
      <span><b className="font-semibold text-[color:var(--ld-text)]">¿Llevas varias furgonetas?</b>{' '}
        Con {MARCA.nombre} cada conductor fotografía la suya cada día y tú ves la foto de hoy junto a la anterior: el golpe se ve el día que aparece, no el día de la devolución.</span>
      <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-[color:var(--ld-text)] transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

