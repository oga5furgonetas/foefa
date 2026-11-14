/* Un paso del recorrido: la pregunta en llano, el vehículo con la zona marcada, la regla tal cual con su página (y las
   que se preguntan con ella), la edad del documento si no trae fecha, la ayuda para medir cuando encaja, «También mira»
   y las tres respuestas. En el móvil las respuestas van fijas abajo: se contestan sin bajar a buscarlas (se usa de pie
   junto al vehículo, con una mano). Se puede volver atrás sin perder lo contestado después. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { aceptaDe, ayudaParaMedir, cobraDe, minuscula, vozDe } from '../../lib/guiasRenting'
import Vehiculo, { ZONAS_DIBUJO } from './Vehiculo'
import { H2, Pag, TextoRegla, Vigencia, etiquetaPaso, zonaNombre } from './comun'
import { NOTA_MAX } from './estado'

function Medida({ objeto }) {
  if (objeto.dibujo === 'moneda') {
    return <span aria-hidden="true" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full border-2 border-[color:var(--ld-text)] bg-[color:var(--ld-surface)] font-mono text-[11px] font-semibold text-[color:var(--ld-text)]">{objeto.rotulo}</span>
  }
  return <span aria-hidden="true" className="relative block h-[36px] w-[56px] shrink-0 rounded-[5px] border-2 border-[color:var(--ld-text)] bg-[color:var(--ld-surface)]"><span className="absolute left-[7px] top-[9px] h-[8px] w-[11px] rounded-[2px] border border-[color:var(--ld-text)]" /></span>
}

/* Una línea de «También mira»: la etiqueta en su color y el texto, o la frase entera si el dato ya lo dice todo. */
function LineaCorta({ etiqueta, texto, color, children }) {
  return (
    <p className="mt-1 text-[14px] leading-snug text-[color:var(--ld-text2)]">
      {etiqueta && <span className={`font-semibold ${color}`}>{etiqueta}: </span>}{etiqueta ? minuscula(texto) : texto} {children}
    </p>
  )
}

/* El alto de la barra de respuestas del móvil, para que el final de la página no quede debajo (DevolucionRenting.jsx
   deja ese hueco después del pie). */
function useAltoBarra(ref) {
  useLayoutEffect(() => {
    const el = ref.current
    const raiz = document.documentElement
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const poner = () => raiz.style.setProperty('--dev-barra', `${el.getBoundingClientRect().height}px`)
    poner()
    const ro = new ResizeObserver(poner)
    ro.observe(el)
    return () => { ro.disconnect(); raiz.style.removeProperty('--dev-barra') }
  }, [ref])
}

export default function Paso({ vehiculo, doc, pasos, i, respuesta, nota, onResponder, onAtras }) {
  const p = pasos[i]
  const v = vozDe(doc)
  const caja = useRef(null)
  const barra = useRef(null)
  const [abierta, setAbierta] = useState(respuesta === 'si')
  const [texto, setTexto] = useState(nota || '')
  useEffect(() => { setAbierta(respuesta === 'si'); setTexto(nota || '') }, [i, respuesta, nota])
  // Al entrar en un paso, el foco va al paso entero (se lee su pregunta) y el Tab llega primero a «Atrás».
  useEffect(() => { caja.current?.focus({ preventScroll: true }) }, [i])
  useAltoBarra(barra)
  const ayuda = ayudaParaMedir(p)
  const etiqueta = etiquetaPaso(p)
  const marca = (p.piezas || ZONAS_DIBUJO[p.zona] || []).length > 0
  const tipo = vehiculo === 'turismo' ? 'Turismo' : 'Furgoneta'
  const alt = `${tipo} vist${vehiculo === 'turismo' ? 'o' : 'a'} desde arriba${marca ? `, con la zona marcada: ${etiqueta}` : ''}`

  const resp = 'inline-flex h-[52px] items-center justify-center rounded-[12px] border-[1.5px] px-3 text-[15.5px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)]'
  return (
    <div ref={caja} tabIndex={-1} aria-labelledby="dev-pregunta" className="pb-8 pt-6 outline-none focus-visible:ring-0 sm:pt-10 lg:pb-14" data-testid="dev-paso" data-paso={i}>
      <div className="flex items-center justify-between gap-3 text-[14px] text-[color:var(--ld-muted)]">
        <button type="button" onClick={onAtras} className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 font-semibold text-[color:var(--ld-text)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--ld-text)]" data-testid="dev-atras">
          <ArrowLeft size={16} aria-hidden="true" />Atrás
        </button>
        <span className="truncate">{etiqueta}</span>
        <span className="shrink-0 font-mono text-[13px]" data-testid="dev-cuenta">{i + 1} de {pasos.length}</span>
      </div>
      <div className="mt-2 flex gap-[5px]" aria-hidden="true">
        {pasos.map((_, k) => <i key={k} className={`h-[5px] flex-1 rounded-[3px] ${k <= i ? 'bg-[color:var(--ld-text)]' : 'bg-[color:var(--ld-hueco)]'}`} />)}
      </div>

      <div className="mt-6 grid gap-8 lg:mt-7 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
        <div>
          <h2 id="dev-pregunta" className={H2} data-testid="dev-pregunta">{p.pregunta}</h2>

          <div className="mt-5 grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-[14px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-6 sm:p-5">
            <div className="flex justify-center self-start pt-1">
              <Vehiculo tipo={vehiculo} zona={p.zona} piezas={p.piezas} ancho={120} className="h-auto w-[68px] sm:w-[120px]" titulo={alt} />
            </div>
            <div className="min-w-0 border-l-[3px] border-[color:var(--ld-text)] pl-3" data-testid="dev-regla">
              <TextoRegla r={p.r} doc={doc} si={p.si} />
              {p.con.map((r) => (
                <div key={r.indice} className="mt-4 border-t border-[color:var(--ld-border)] pt-4" data-testid="dev-regla-junto">
                  <p className="mb-2 text-[14.5px] font-bold leading-snug text-[color:var(--ld-text)]">{r.dano}</p>
                  <TextoRegla r={r} doc={doc} si={p.si} compacta />
                </div>
              ))}
            </div>
          </div>
          <Vigencia doc={doc} className="mt-3" />

          {ayuda && (
            <div className="mt-5 flex items-center gap-4" data-testid="dev-medir">
              <Medida objeto={ayuda.objeto} />
              <p className="text-[14.5px] leading-snug text-[color:var(--ld-text2)]"><b className="block font-bold text-[color:var(--ld-text)]">Para medir sin regla</b>{ayuda.texto}</p>
            </div>
          )}
          {p.nota && (
            <p className="mt-5 flex gap-3 text-[14.5px] leading-snug text-[color:var(--ld-text2)]" data-testid="dev-nota-paso">
              <span aria-hidden="true" className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ambar)]" />{p.nota}
            </p>
          )}

          {p.mas.length > 0 && (
            <details className="group mt-7 border-t border-[color:var(--ld-border)]" data-testid="dev-tambien">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold text-[color:var(--ld-text)] [&::-webkit-details-marker]:hidden">
                <span>También mira <span className="font-normal text-[color:var(--ld-muted)]">· {p.mas.length} {p.mas.length === 1 ? 'cosa más' : 'cosas más'} de {v.su}</span></span>
                <span aria-hidden="true" className="text-[22px] font-normal leading-none text-[color:var(--ld-muted)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <ul className="pb-2">
                {p.mas.map((r) => (
                  <li key={r.indice} className="border-t border-[color:var(--ld-border)] py-3.5">
                    <p className="text-[14.5px] font-bold leading-snug text-[color:var(--ld-text)]">{r.dano} {r.zona !== p.zona && <span className="font-normal text-[color:var(--ld-muted)]">· {zonaNombre(r.zona)}</span>}</p>
                    <LineaCorta {...aceptaDe(r, v)} color="text-[color:var(--ld-ok)]" />
                    <LineaCorta {...cobraDe(r, v)} color="text-[color:var(--ld-warn)]"><Pag n={r.pagina} /></LineaCorta>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Las respuestas: fijas abajo en el móvil, a la derecha en el ordenador. */}
        <div ref={barra} className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--ld-border-strong)] bg-[color:var(--ld-bg)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-8 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:pt-1" data-testid="dev-respuestas">
          <div className="mx-auto max-w-[560px] lg:max-w-none">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={respuesta === 'no'} onClick={() => onResponder('no')} data-testid="dev-no"
                className={`${resp} border-[color:var(--ld-text)] ${respuesta === 'no' || (!respuesta && !abierta) ? 'bg-[color:var(--ld-text)] text-[color:var(--ld-bg)]' : 'bg-transparent text-[color:var(--ld-text)]'}`}>No, ninguna</button>
              <button type="button" aria-pressed={respuesta === 'si'} aria-expanded={abierta} onClick={() => setAbierta(true)} data-testid="dev-si"
                className={`${resp} border-[color:var(--ld-warn)] ${respuesta === 'si' || abierta ? 'bg-[color:var(--ld-warn)] text-[color:var(--ld-bg)]' : 'bg-[color:var(--ld-surface)] text-[color:var(--ld-warn)]'}`}>Sí, alguna</button>
            </div>
            {abierta && (
              <form className="mt-2.5 rounded-[12px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-3" onSubmit={(e) => { e.preventDefault(); onResponder('si', texto) }}>
                <label htmlFor="dev-donde" className="text-[13.5px] font-semibold text-[color:var(--ld-text)]">¿Dónde? <span className="font-normal text-[color:var(--ld-muted)]">Si quieres, para acordarte</span></label>
                <input id="dev-donde" autoFocus value={texto} maxLength={NOTA_MAX} onChange={(e) => setTexto(e.target.value)} placeholder="Por ejemplo: puerta lateral derecha" aria-describedby="dev-donde-aviso"
                  className="mt-1.5 h-11 w-full rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-bg)] px-3 text-[16px] text-[color:var(--ld-text)] placeholder:text-[color:var(--ld-muted)] focus:border-[color:var(--ld-text)] focus:outline-none" data-testid="dev-donde" />
                <p id="dev-donde-aviso" className="mt-1.5 text-[12.5px] leading-snug text-[color:var(--ld-muted)]" data-testid="dev-donde-aviso">Lo que escribas aquí viaja en el enlace si lo compartes: no pongas matrículas ni nombres.</p>
                <button type="submit" className={`${resp} mt-2.5 w-full border-[color:var(--ld-warn)] bg-[color:var(--ld-warn)] text-[color:var(--ld-bg)]`} data-testid="dev-seguir">Apuntarlo y seguir</button>
              </form>
            )}
            <button type="button" aria-pressed={respuesta === 'nose'} onClick={() => onResponder('nose')} data-testid="dev-nose"
              className={`${resp} mt-2 h-11 w-full text-[14.5px] ${respuesta === 'nose' ? 'border-[color:var(--ld-text)] bg-[color:var(--ld-fill)]' : 'border-[color:var(--ld-border-strong)]'} text-[color:var(--ld-text)]`}>No lo sé todavía</button>
          </div>
        </div>
      </div>
    </div>
  )
}
