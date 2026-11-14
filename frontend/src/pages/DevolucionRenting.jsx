/* «¿QUÉ TE VAN A COBRAR AL DEVOLVERLO?» (/devolucion-renting y /devolucion-renting/<compañía>, 14-11-2026).

   Lleva a una persona alrededor de su coche o su furgoneta con el documento de devolución de SU compañía y le dice,
   antes de que llegue el perito, qué no da por bueno ese documento y qué dice que se factura. Para quien la usa no
   cuesta nada ni pide registro; pensada para el móvil (se usa de pie junto al vehículo). Los datos:
   src/lib/guiasRenting.js (cada regla con su página; scripts/check-guias-renting.mjs).

   SOLO EN ESPAÑOL en esta versión (el público es España): sus textos no van por tx() y no están en
   scripts/check-textos-ruta.mjs, que solo mira las pantallas que traduce. El pie común (portadaComun.jsx) sí sigue el
   idioma, como en las demás páginas públicas.

   SIN SERVIDOR. Nada de la herramienta llama a /api ni guarda nada: el estado del recorrido va en el # de la URL
   (devolucion/estado.js), que el navegador no manda al pedir la página, y el resultado se rehace desde el enlace. Lo
   único que sale es el contador anónimo de visitas de toda la web (main.jsx, Medidor → lib/analitica.js), que manda la
   ruta sin el #. Los píxeles de anuncios (lib/metaPixel.js) no se cargan en estas rutas y, si ya estaban cargados de
   otra página, se callan mientras se está aquí (pausarPixeles): ninguno ve el #.

   VOLVER ATRÁS NO BORRA NADA. Cada paso es una entrada del historial; las respuestas viven además en memoria mientras
   la página está abierta, y al volver (con «Atrás» o con el del navegador) se rellenan las de después. Al contestar, se
   pasa a la siguiente pregunta sin contestar, o al resultado si ya no queda ninguna: así se cambia una respuesta (desde
   el resultado, cualquiera) sin rehacer las demás.

   Reglas de verdad: nunca «te lo cobrarán» como hecho («su guía dice que se factura»), nunca «no te lo pueden cobrar»,
   ni cifras de ahorro; las compañías se nombran solo para decir de quién es el documento, sin logotipos, con su enlace. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useIdioma } from '../lib/idioma'
import { pausarPixeles } from '../lib/metaPixel'
import { MARCA } from '../marca'
import { COMPANIAS, pasosDe, tituloCompania, vehiculoPara } from '../lib/guiasRenting'
import { ANCHO, BTN_PRIMARIO, CabeceraSimple, Pie, useTemaWeb } from './portadaComun'
import Entrada from './devolucion/Entrada'
import Paso from './devolucion/Paso'
import Resultado from './devolucion/Resultado'
import Otra from './devolucion/Otra'
import Compania from './devolucion/Compania'
import { documentoDe, escribirEstado, leerEstado } from './devolucion/estado'
import { H2, RUTA } from './devolucion/comun'

const TITULO = '¿Qué te van a cobrar al devolverlo?'

/* La clave de una pantalla, para saber qué hay en la entrada de detrás del historial. */
const claveDe = (e) => (e.fin ? 'fin' : e.paso != null ? `p${e.paso}` : 'entrada')

/* El # como estado. Cada pantalla es una entrada del historial y guarda en history.state la clave de la anterior
   (`prev`): «Atrás» hace history.back() si detrás está justo el paso anterior, y si no, va a él. `fusionar` rehace el #
   que llega por el historial con lo que se ha contestado después (si no, volver atrás lo perdería). */
function useHash(fusionar) {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''))
  const fusion = useRef(fusionar)
  fusion.current = fusionar
  useEffect(() => {
    const leer = () => {
      const nuevo = fusion.current(window.location.hash)
      if (nuevo != null && `#${nuevo}` !== window.location.hash) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${nuevo}`)
      }
      setHash(window.location.hash)
    }
    window.addEventListener('hashchange', leer)
    window.addEventListener('popstate', leer)
    return () => { window.removeEventListener('hashchange', leer); window.removeEventListener('popstate', leer) }
  }, [])
  const ir = useCallback((nuevo, { reemplazar = false } = {}) => {
    const url = `${window.location.pathname}${window.location.search}${nuevo ? `#${nuevo}` : ''}`
    const antes = window.history.state || {}
    const n = Number(antes.devolucion) || 0
    if (reemplazar) window.history.replaceState({ ...antes, devolucion: n }, '', url)
    else window.history.pushState({ devolucion: n + 1, prev: claveDe(leerEstado(window.location.hash)) }, '', url)
    setHash(nuevo ? `#${nuevo}` : '')
  }, [])
  /* Volver a `destino`: con el historial si la entrada de detrás es justo esa; si no, yendo a ella. */
  const volver = useCallback((destino) => {
    const st = window.history.state || {}
    if (Number(st.devolucion) > 0 && st.prev === claveDe(leerEstado(`#${destino}`))) window.history.back()
    else ir(destino, { reemplazar: !(Number(st.devolucion) > 0) })
  }, [ir])
  return [hash, ir, volver]
}

function Herramienta() {
  /* Lo contestado en esta visita, aunque el # de una entrada vieja del historial no lo lleve. */
  const memoria = useRef(null)
  const fusionar = useCallback((h) => {
    const e = leerEstado(h)
    const m = memoria.current
    if (e.error || !m || e.compania !== m.compania || e.vehiculo !== m.vehiculo || (e.paso == null && !e.fin)) return null
    const respuestas = m.respuestas.map((x, k) => x || e.respuestas[k] || null)
    const notas = { ...e.notas, ...m.notas }
    return escribirEstado({ ...e, respuestas, notas })
  }, [])
  const [hash, ir, volver] = useHash(fusionar)
  const e = leerEstado(hash)
  const vehiculo = e.vehiculo || vehiculoPara(COMPANIAS.find((x) => x.slug === e.compania), 'furgoneta')
  const doc = e.compania && e.compania !== 'otra' ? documentoDe(e.compania, vehiculo) : null
  const pasos = doc ? pasosDe(doc, vehiculo) : []

  const pantalla = `${e.compania}-${e.paso}-${e.fin}-${e.error ? 'error' : ''}`
  useEffect(() => { window.scrollTo(0, 0) }, [pantalla])

  const con = (cambios, opciones) => {
    const nuevo = { ...e, vehiculo, ...cambios }
    if (nuevo.respuestas?.length) memoria.current = { compania: nuevo.compania, vehiculo, respuestas: nuevo.respuestas, notas: nuevo.notas || {} }
    ir(escribirEstado(nuevo), opciones)
  }
  const empezar = (destino) => { memoria.current = null; ir(destino) }

  if (e.error) {
    return (
      <div className="max-w-[640px] pb-16 pt-10" data-testid="dev-error" role="alert">
        <h1 className={H2}>Este enlace no se puede abrir tal cual</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[color:var(--ld-text2)]">{e.error} Puedes empezar de nuevo: son unas preguntas y el resultado sale al momento.</p>
        <button type="button" onClick={() => empezar('')} className={`${BTN_PRIMARIO} mt-7`} data-testid="dev-de-nuevo">Empezar de nuevo</button>
      </div>
    )
  }

  if (e.compania === 'otra' && e.fin) return <Otra vehiculo={vehiculo} onAtras={() => volver(escribirEstado({ vehiculo, compania: 'otra' }))} />

  if (doc && e.fin) {
    return (
      <Resultado vehiculo={vehiculo} compania={e.compania} doc={doc} pasos={pasos} respuestas={e.respuestas} notas={e.notas}
        onCambiar={(k) => con({ fin: false, paso: k })}
        onEmpezar={() => empezar(escribirEstado({ compania: e.compania }))} />
    )
  }

  if (doc && e.paso != null) {
    const i = e.paso
    const responder = (r, nota) => {
      const respuestas = pasos.map((_, k) => (k === i ? r : e.respuestas[k] || null))
      const notas = { ...e.notas }
      if (r === 'si' && nota && nota.trim()) notas[i] = nota.trim(); else delete notas[i]
      // La entrada de este paso se queda con su respuesta (así el «atrás» la enseña marcada) y se pasa a la siguiente
      // pregunta sin contestar; si no queda ninguna, al resultado.
      con({ respuestas, notas, paso: i }, { reemplazar: true })
      const despues = respuestas.findIndex((x, k) => k > i && !x)
      const antes = respuestas.findIndex((x) => !x)
      const siguiente = despues >= 0 ? despues : antes
      if (siguiente < 0) con({ respuestas, notas, paso: null, fin: true })
      else con({ respuestas, notas, paso: siguiente })
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
      onEmpezar={() => {
        if (e.compania === 'otra') con({ fin: true })
        else { memoria.current = null; ir(escribirEstado({ vehiculo, compania: e.compania, paso: 0, respuestas: [], notas: {} })) }
      }} />
  )
}

export default function DevolucionRenting() {
  const { compania } = useParams()
  const lang = useIdioma()
  const [tema, setTema] = useTemaWeb()
  const c = compania ? COMPANIAS.find((x) => x.slug === compania) : null
  const titulo = compania ? `${c ? tituloCompania(c) : 'Documento no encontrado'} · ${MARCA.nombre}` : `${TITULO} · ${MARCA.nombre}`
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = 'es' } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo])
  // Los píxeles de anuncios no ven nada de aquí (el # lleva las respuestas y las notas).
  useEffect(() => pausarPixeles(), [])
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
      {/* El hueco de la barra de respuestas del móvil (Paso.jsx): así el final del pie no queda debajo de ella. */}
      <div aria-hidden="true" className="h-[var(--dev-barra,0px)] lg:hidden print:hidden" />
    </div>
  )
}
