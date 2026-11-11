/* diseño compacto */
/* «¿CÓMO SÉ SI TIENE PREFERENCIA?» (11-11-2026, «Mis DNR»). Dani, con una captura de la pantalla de entrega de su app de
   reparto: «marca bien que debe ser entrega preferencial en ese ejemplo… y no lo de notas de entrega ni notas de cliente»,
   y enseguida, corrigiendo cuál es: «la preferencia de entrega es buzón de correos, es lo primero que aparece en la app».

   O sea: la PREFERENCIA es la PRIMERA opción de «¿Dónde vas a dejar el paquete?», arriba del todo al entregar. Lo de
   «Notas», más abajo (la nota de entrega «Entregar a: …», la nota libre del cliente, la clave del portal), NO lo es. La
   hoja copia la FORMA de esa pantalla, de arriba abajo, y lo dice sin tener que leer: la primera opción, en verde y con
   «Sí es preferencia»; las notas, apagadas y cada una con «No lo es».

   Es un DIBUJO hecho con las piezas y los colores de FDS: no imita la otra app, no lleva ninguna captura ni imagen y todo
   lo que sale es inventado (la calle, el nombre, las notas y la clave). Nunca entra la captura real ni un dato de un
   cliente de verdad. Lo que el conductor lee TAL CUAL en su app, en español («¿Dónde vas a dejar el paquete?», «Buzón de
   correos», «Caseta», «Más opciones», «Notas», «Entregar a:»), se queda en español en los demás idiomas, entre comillas y
   con lo que significa al lado (`literal`): no se sabe cómo lo escribe esa app en cada idioma y no se inventa.

   La Hoja no cierra con Escape ni mueve el foco: lo hace esta pantalla (foco a «Cerrar» al abrir, Escape cierra y el
   tabulador no sale de la hoja); quien la abre devuelve el foco a su botón al cerrarla. */
import { useEffect, useId, useRef } from 'react'
import {
  ArrowRight, Camera, Check, ChevronDown, CircleCheck, CircleX, KeyRound, MapPin, MessageSquare, Phone, StickyNote, Truck,
} from 'lucide-react'
import { idioma, tx } from '../../lib/idioma'
import { Etiqueta, EtiquetaHecho, Hoja } from './piezas'
import icono from './piezas/icono'

/* La fila de pasos: llama + foto clara → no te cuenta. Es la misma en el recordatorio y en la hoja; lo que se ve es para la
   vista (quien la pinta pone al lado la frase entera para el lector de pantalla). La flecha va con lo que trae: si la fila
   salta (alemán, francés), no se queda sola al final. */
export function PasosNoCuenta({ className = '', testid }) {
  return (
    <p data-testid={testid} aria-hidden="true" className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-boton ${className}`}>
      <span className="flex items-center gap-1 whitespace-nowrap">{icono(Phone, 16, 'shrink-0')} {tx('Llama')}</span>
      <span>+</span>
      <span className="flex items-center gap-1 whitespace-nowrap">{icono(Camera, 16, 'shrink-0')} {tx('Foto clara')}</span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        {icono(ArrowRight, 16, 'mr-1 shrink-0')}{icono(Check, 16, 'shrink-0')} {tx('No te cuenta')}
      </span>
    </p>
  )
}

/* Lo que se lee TAL CUAL en la app de reparto: en español, como es; en los demás idiomas, entre comillas y con lo que
   significa entre paréntesis («"Buzón de correos" (Briefkasten)»). Si significa lo mismo con la misma palabra (en portugués,
   «Notas» o «Entregar a:»), sin paréntesis. */
function literal(es, significa) {
  if (idioma() === 'es') return es
  return significa && significa !== es ? `"${es}" (${significa})` : `"${es}"`
}

// El redondel de cada opción, como en la app: el de la preferencia, marcado y en verde; los demás, vacíos.
function Redondel({ marcado = false }) {
  return (
    <span aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${marcado ? 'border-ruta-ok-texto' : 'border-dark-400'}`}>
      {marcado && <span className="h-2 w-2 rounded-full bg-ruta-ok-texto" />}
    </span>
  )
}

/* Una nota de las de abajo, apagada y con su «No lo es · …» delante. Lo corto se ve; el lector lee la frase con su coma y
   la nota seguida: «No lo es, nota de entrega: Entregar a: Cobertizo/Caseta». */
function Nota({ corto, frase, icono: Icono, children }) {
  return (
    <li data-testid="ejemplo-pref-nota" className="flex flex-col items-start gap-1">
      <EtiquetaHecho testid="ejemplo-pref-etiqueta" tono="dato" icono={Icono} texto={corto} frase={frase} />
      <span className="sr-only">: </span>
      <span data-testid="ejemplo-pref-texto" className="block max-w-full break-words text-texto text-dark-400">{children}</span>
    </li>
  )
}

export default function EjemploPreferencia({ onClose }) {
  const dentro = useRef(null)
  const cerrar = useRef(onClose)
  cerrar.current = onClose
  const idEntrega = useId()
  const idNotas = useId()
  useEffect(() => {
    const hoja = dentro.current?.closest('[role="dialog"]')
    hoja?.querySelector('button')?.focus()   // «Cerrar»: el lector anuncia la hoja con su título
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar.current?.(); return }
      if (e.key !== 'Tab' || !hoja) return
      const enfocables = [...hoja.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
      if (!enfocables.length) return
      const i = enfocables.indexOf(document.activeElement)
      const sig = e.shiftKey ? (i <= 0 ? enfocables.length - 1 : i - 1) : (i === enfocables.length - 1 ? 0 : i + 1)
      e.preventDefault()
      enfocables[sig].focus()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])

  return (
    // El título y el subtítulo de la Hoja van en una línea con «…»: aquí saltan, para que en alemán y con «Letra más
    // grande» no se corte nada.
    <Hoja titulo={tx('Cómo saber si tiene preferencia')}
      subtitulo={tx('La preferencia de entrega es lo primero que aparece al entregar, en tu app de reparto')}
      onClose={onClose} testid="ejemplo-pref"
      className="[&>div:first-child_h2]:whitespace-normal [&>div:first-child_p]:whitespace-normal">
      <div ref={dentro} className="flex flex-col gap-3 pt-2">
        {/* 1. Lo de ARRIBA al entregar: dónde se deja, y la PRIMERA opción es la preferencia. */}
        <section data-testid="ejemplo-pref-entrega" aria-labelledby={idEntrega} className="rounded-xl border border-dark-800 bg-dark-950 p-3">
          <p id={idEntrega} className="flex items-start gap-2 text-boton text-dark-50">
            {icono(Truck, 16, 'mt-0.5 shrink-0')}
            <span className="min-w-0 break-words">{literal('¿Dónde vas a dejar el paquete?', tx('¿Dónde vas a dejar el paquete?'))}</span>
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            <li data-testid="ejemplo-pref-opcion" data-destacada="si" className="rounded-lg border-2 border-ruta-ok-texto bg-dark-900 p-2">
              <Etiqueta testid="ejemplo-pref-etiqueta" tono="ok" icono={CircleCheck} texto={tx('Sí es preferencia')} />
              <span className="sr-only">: </span>
              <span data-testid="ejemplo-pref-texto" className="mt-2 flex items-center gap-2 text-nombre text-dark-50">
                <Redondel marcado />
                <span className="min-w-0 break-words">{literal('Buzón de correos', tx('Buzón de correos'))}</span>
              </span>
            </li>
            <li data-testid="ejemplo-pref-opcion" data-destacada="no" className="px-2">
              <span data-testid="ejemplo-pref-texto" className="flex items-center gap-2 text-texto text-dark-50">
                <Redondel />
                <span className="min-w-0 break-words">{literal('Caseta', tx('Caseta'))}</span>
              </span>
            </li>
            <li data-testid="ejemplo-pref-opcion" data-destacada="no" data-apagada="si" className="px-2">
              <span data-testid="ejemplo-pref-texto" className="flex items-center gap-2 text-texto text-dark-400">
                {icono(ChevronDown, 20, 'shrink-0')}
                <span className="min-w-0 break-words">{literal('Más opciones', tx('Más opciones'))}</span>
              </span>
            </li>
          </ul>
        </section>

        {/* 2. Más ABAJO, las notas: apagadas, y ninguna es la preferencia. */}
        <section data-testid="ejemplo-pref-notas" aria-labelledby={idNotas} className="rounded-xl border border-dark-800 bg-dark-950 p-3">
          <p id={idNotas} className="flex items-center gap-1 text-etiqueta text-dark-400">
            {icono(StickyNote, 14, 'shrink-0')} {literal('Notas', tx('Notas'))}
          </p>
          <p className="mt-1 flex items-start gap-1 text-sec text-dark-400">
            {icono(MapPin, 14, 'mt-0.5 shrink-0')}<span className="min-w-0 break-words">{tx('Calle de ejemplo, 1 · Nombre del cliente')}</span>
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            <Nota corto={tx('No lo es · nota de entrega')} frase={tx('No lo es, nota de entrega')} icono={CircleX}>
              {literal('Entregar a:', tx('Entregar a:'))} {tx('Cobertizo/Caseta')}
            </Nota>
            <Nota corto={tx('No lo es · nota del cliente')} frase={tx('No lo es, nota del cliente')} icono={MessageSquare}>
              {tx('Déjenlo al lado de la puerta y cierren. Gracias')}
            </Nota>
            <Nota corto={tx('No lo es · clave de acceso')} frase={tx('No lo es, clave de acceso')} icono={KeyRound}>
              {tx('Código del portal: 1234')}
            </Nota>
          </ul>
        </section>

        {/* 3. La regla, en el tinte de marca: con preferencia, llama + foto clara → no te cuenta. */}
        <div data-testid="ejemplo-pref-regla" className="rounded-xl border border-ruta-marca bg-ruta-marca-tinte p-3 text-ruta-marca-tinte-texto">
          <p data-testid="ejemplo-pref-con" aria-hidden="true" className="text-nombre">{tx('Con preferencia de entrega')}</p>
          <p className="sr-only">
            {tx('Recuerda: para que no te cuente, el cliente tiene que tener preferencia de entrega, y tú llamar y sacar bien la foto.')}
          </p>
          <PasosNoCuenta testid="ejemplo-pref-pasos" className="mt-3 border-t border-ruta-marca/40 pt-3" />
        </div>
      </div>
    </Hoja>
  )
}
