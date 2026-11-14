/* «¿QUÉ TE VAN A COBRAR AL DEVOLVERLO?» (/devolucion-renting y /devolucion-renting/<compañía>, 14-11-2026).

   Lleva a una persona alrededor de su coche o su furgoneta con la guía de devolución de SU compañía y le dice, antes de
   que llegue el perito, qué factura esa guía. Gratis para quien la usa, sin registro, pensada para el móvil (se usa de
   pie junto al vehículo). Los datos: src/lib/guiasRenting.js (cada regla con su página; scripts/check-guias-renting.mjs).

   SOLO EN ESPAÑOL en esta versión (el público es España): sus textos no van por tx() y no están en
   scripts/check-textos-ruta.mjs, que solo mira las pantallas que traduce. El pie común (portadaComun.jsx) sí sigue el
   idioma, como en las demás páginas públicas.

   SIN SERVIDOR. Nada de la herramienta llama a /api ni guarda nada: el estado del recorrido va en el # de la URL
   (devolucion/estado.js), que el navegador no manda al pedir la página, y el resultado se rehace desde el enlace. Lo
   único que sale es el contador anónimo de visitas de toda la web (main.jsx, Medidor → lib/analitica.js), que manda la
   ruta sin el #.

   Reglas de verdad: nunca «te lo cobrarán» como hecho («su guía dice que se factura»), nunca «no te lo pueden cobrar»,
   ni cifras de ahorro; las compañías se nombran solo para decir de quién es la guía, sin logotipos, con su enlace. */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useIdioma } from '../lib/idioma'
import { MARCA } from '../marca'
import { COMPANIAS, pasosDe, tituloCompania } from '../lib/guiasRenting'
import { ANCHO, CabeceraSimple, Pie, useTemaWeb } from './portadaComun'
import Entrada from './devolucion/Entrada'
import Paso from './devolucion/Paso'
import Resultado from './devolucion/Resultado'
import Otra from './devolucion/Otra'
import Compania from './devolucion/Compania'
import { documentoDe, escribirEstado, leerEstado } from './devolucion/estado'
import { BTN_PRIMARIO } from './portadaComun'
import { H2, RUTA } from './devolucion/comun'

const TITULO = '¿Qué te van a cobrar al devolverlo?'

/* El # como estado. Cada paso es una entrada del historial (con su número en history.state): el «atrás» del móvil vuelve
   al paso anterior, y el «Atrás» de la pantalla hace lo mismo mientras haya un paso nuestro detrás. */
function useHash() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''))
  useEffect(() => {
    const leer = () => setHash(window.location.hash)
    window.addEventListener('hashchange', leer)
    window.addEventListener('popstate', leer)
    return () => { window.removeEventListener('hashchange', leer); window.removeEventListener('popstate', leer) }
  }, [])
  const ir = useCallback((nuevo, { reemplazar = false } = {}) => {
    const url = `${window.location.pathname}${window.location.search}${nuevo ? `#${nuevo}` : ''}`
    const n = Number(window.history.state?.devolucion) || 0
    if (reemplazar) window.history.replaceState({ devolucion: n }, '', url)
    else window.history.pushState({ devolucion: n + 1 }, '', url)
    setHash(nuevo ? `#${nuevo}` : '')
  }, [])
  /* Volver: al paso de detrás si es nuestro; si no (se entró por un enlace), a `anterior` sin dejar rastro. */
  const volver = useCallback((anterior) => {
    if (Number(window.history.state?.devolucion) > 0) window.history.back()
    else ir(anterior, { reemplazar: true })
  }, [ir])
  return [hash, ir, volver]
}

function Herramienta() {
  const [hash, ir, volver] = useHash()
  const e = leerEstado(hash)
  const vehiculo = e.vehiculo || 'furgoneta'
  const doc = e.compania && e.compania !== 'otra' ? documentoDe(e.compania, vehiculo) : null
  const pasos = doc ? pasosDe(doc, vehiculo) : []

  const pantalla = `${e.compania}-${e.paso}-${e.fin}`
  useEffect(() => { window.scrollTo(0, 0) }, [pantalla])

  const con = (cambios, opciones) => ir(escribirEstado({ ...e, vehiculo, ...cambios }), opciones)

  if (e.error) {
    return (
      <div className="max-w-[640px] pb-16 pt-10" data-testid="dev-error" role="alert">
        <h1 className={H2}>Este enlace no se puede abrir tal cual</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[color:var(--ld-text2)]">{e.error} Puedes empezar de nuevo: son unas preguntas y el resultado sale al momento.</p>
        <button type="button" onClick={() => ir('')} className={`${BTN_PRIMARIO} mt-7`} data-testid="dev-de-nuevo">Empezar de nuevo</button>
      </div>
    )
  }

  if (e.compania === 'otra' && e.fin) return <Otra vehiculo={vehiculo} onAtras={() => volver(escribirEstado({ vehiculo, compania: 'otra' }))} />

  if (doc && e.fin) {
    return (
      <Resultado vehiculo={vehiculo} compania={e.compania} doc={doc} pasos={pasos} respuestas={e.respuestas} notas={e.notas}
        onRevisar={() => con({ fin: false, paso: pasos.length - 1 })}
        onEmpezar={() => ir(`c=${e.compania}`)} />
    )
  }

  if (doc && e.paso != null) {
    const i = e.paso
    const responder = (r, nota) => {
      const respuestas = pasos.map((_, k) => (k === i ? r : e.respuestas[k] || null))
      const notas = { ...e.notas }
      if (r === 'si' && nota && nota.trim()) notas[i] = nota.trim(); else delete notas[i]
      // La entrada de este paso se queda con su respuesta (así el «atrás» la enseña marcada) y se pasa al siguiente.
      con({ respuestas, notas, paso: i }, { reemplazar: true })
      if (i === pasos.length - 1) con({ respuestas, notas, paso: null, fin: true })
      else con({ respuestas, notas, paso: i + 1 })
    }
    return (
      <Paso vehiculo={vehiculo} doc={doc} pasos={pasos} i={i} respuesta={e.respuestas[i]} nota={e.notas[i]}
        onResponder={responder}
        onAtras={() => volver(escribirEstado(i === 0 ? { vehiculo, compania: e.compania } : { ...e, vehiculo, paso: i - 1 }))} />
    )
  }

  return (
    <Entrada vehiculo={vehiculo} compania={e.compania}
      onVehiculo={(v) => {
        const c = COMPANIAS.find((x) => x.slug === e.compania)
        ir(escribirEstado({ vehiculo: v, compania: c && !c.documentos[v] ? null : e.compania }), { reemplazar: true })
      }}
      onCompania={(c) => ir(escribirEstado({ vehiculo, compania: c }), { reemplazar: true })}
      onEmpezar={() => (e.compania === 'otra' ? con({ fin: true }) : con({ paso: 0, respuestas: [], notas: {} }))} />
  )
}

export default function DevolucionRenting() {
  const { compania } = useParams()
  const lang = useIdioma()
  const [tema, setTema] = useTemaWeb()
  const c = compania ? COMPANIAS.find((x) => x.slug === compania) : null
  const titulo = compania ? `${c ? tituloCompania(c) : 'Guía no encontrada'} · ${MARCA.nombre}` : `${TITULO} · ${MARCA.nombre}`
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = 'es' } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo])
  const enlace = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-[15px] font-medium text-[color:var(--ld-text)] underline-offset-4 hover:underline'

  return (
    <div className="ld-root min-h-screen overflow-x-clip font-sans text-[17px] leading-normal antialiased print:bg-white" data-theme={tema} lang="es" data-testid="devolucion-renting">
      <div className="print:hidden">
        <CabeceraSimple>
          {compania && <a href={RUTA} className={`${enlace} hidden sm:inline-flex`}>Repasar mi vehículo</a>}
          <a href="/" className={enlace}>Para empresas</a>
        </CabeceraSimple>
      </div>
      {/* Un div y no <main>: el tema «híbrido» del panel le pone a todo <main> un fondo de tarjeta con degradado. */}
      <div className={ANCHO} id="contenido">
        {compania ? <Compania slug={compania} /> : <Herramienta />}
      </div>
      <div className="print:hidden"><Pie lang={lang} tema={tema} setTema={setTema} /></div>
    </div>
  )
}
