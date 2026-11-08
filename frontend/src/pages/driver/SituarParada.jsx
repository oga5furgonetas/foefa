/* diseño compacto */
import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Check, Loader2, LocateFixed, Map as IconoMapa, Search, WifiOff, X } from 'lucide-react'
import { repMisDirecciones, repUbicar } from '../../services/api'
import { buscarDirecciones } from '../../lib/direcciones'
import { lista } from '../../lib/lista'
import { tx, useIdioma } from '../../lib/idioma'
import { useAtras } from '../../lib/atras'
import { alElegir, centroInicial, deLaBuscada, deUbicar, juntarSugerencias, metros, punto } from '../../lib/situar'
import Boton from './piezas/Boton'
import BotonMapa from './piezas/BotonMapa'
import Campo from './piezas/Campo'
import FilaSugerencia from './piezas/FilaSugerencia'
import Pastilla from './piezas/Pastilla'

/* ── SITUAR LA PARADA (02-11-2026) ───────────────────────────────────────────
   Dani, probando la app con una cuenta nueva: «el primer paquete que escaneo no encuentra la dirección y tiene que ir
   por Maps; eso es un pedazo de mierda, hazlo bien». Lo que el servidor no sabe poner en el mapa ya no se manda a
   Google Maps: se pone aquí, en NUESTRO mapa (Leaflet, con las teselas de la guía y del mapa de la ruta).
   Arriba, la dirección, que se puede corregir, con las sugerencias: lo que encuentra el servidor primero (POST
   /reparto/ubicar, que no guarda nada), luego las suyas («Ya estuviste aquí») y las de Photon. En el centro, una
   chincheta fija («Mueve el mapa hasta la puerta»): se mueve el mapa, no la chincheta, y el zoom no la desplaza.
   Abajo, «Es aquí», que devuelve el punto a quien abrió esto: la ruta lo guarda y guía hasta él; la ficha lo pone en
   el formulario. Google Maps, solo si se pulsa su enlace pequeño. Es la misma pantalla que la de la app nativa
   (ui/hoy/SituarPantalla.kt). */
/* EL DISEÑO COMPACTO (07-11-2026, §5.10, W6): solo lo visual; los textos y la lógica son los de antes (seis tandas y 57 pruebas).
   Arriba, una fila de 56 con la ✕ y el buscador (ya no hay cabecera de dos líneas: «Situar la parada» es el nombre de la
   pantalla y el cliente baja al panel); sobre el mapa, una píldora cada vez (la de «sin red» o «no la encuentro» sustituye a
   «Mueve el mapa hasta la puerta») y las sugerencias en filas de 48, cinco como mucho; «Mi ubicación» de 48 abajo a la derecha,
   encima del panel; y el panel con «Aquí: …», el cliente, 🗺 («Abrir en Google Maps», el enlace de antes) y «✓ Es aquí» de 52.
   La zona segura de arriba y de abajo, para el iPhone. */

const ESPANA = { punto: [40.4168, -3.7038], zoom: 5 }
const MUNDO = { punto: [30, 0], zoom: 2 }
// Con menos zoom, la chincheta no apunta a una puerta (a 16 un píxel son unos 2 m): sin sugerencia, no se deja guardar.
const ZOOM_PUERTA = 16
const sinUbicacion = () => tx('No llega la ubicación del móvil: dale permiso a la app.')

/* `parada`: {direccion, cliente, cp, localidad, lat, lng, zona_lat, zona_lng}. `otras`: las paradas situadas de la ruta
   (dónde empezar si no hay nada mejor). `enlaceFuera`: el enlace pequeño a Google Maps o Waze ('' = sin él, desde la
   ficha). `onElegir({lat, lng, origen: 'mapa' | 'sugerencia', sugerencia, precision})`: `precision` es «calle» si el
   punto es el de una sugerencia sin el portal y la chincheta sigue donde la puso (03-11-2026: el servidor lo guarda
   «aprox», no como la puerta); movida, ya no es ella, y '' (queda «manual»).
   LA DIRECCIÓN DE LA PARADA MANDA (03-11-2026, el emulador y la revisión): la marca «Otra calle» y la precisión se
   deciden con `parada.direccion` (la de la ficha, o la guardada desde la ruta), nunca con lo que se escriba en el
   buscador de aquí: corregida la búsqueda a «Rúa Brétema, Oleiros», «Rúa Brétema, 15179 Oleiros» sale como «Otra
   calle» de «Rúa Brétema Mariñeira 23, 15011 A Coruña». Lo que queda al elegirla lo dice situar.js alElegir, el mismo
   sitio para la ficha y para la ruta. Desde la tanda del 03-11-2026 de madrugada, también con `parada.cp` y
   `parada.localidad`: la misma calle en otro pueblo («Rúa Brétema, 15179 Oleiros» para «Rúa Brétema 23, 15011 A
   Coruña») es «Otra calle» (situar.js mismoSitio). */
export default function SituarParada({ parada, base = null, otras = [], pais = '', historial = true, enlaceFuera = '', nombreFuera = 'Google Maps',
  guardando = false, error = '', onCerrar, onElegir }) {
  useIdioma()
  useAtras(true, onCerrar)   // el «atrás» del móvil cierra esto, no la app
  const [inicio] = useState(() => centroInicial(parada, base, otras))
  const [vista] = useState(() => inicio || (pais && pais !== 'es' ? MUNDO : ESPANA))
  const [texto, setTexto] = useState(parada?.direccion || '')
  const [tocado, setTocado] = useState(false)          // la dirección se ha corregido aquí
  const [sugs, setSugs] = useState([])
  const [verLista, setVerLista] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)        // ya hay respuesta para lo que está escrito
  const [sinRed, setSinRed] = useState(false)
  const [atribucion, setAtribucion] = useState('')
  const [elegida, setElegida] = useState(null)         // la sugerencia que está bajo la chincheta
  const [zoom, setZoom] = useState(vista.zoom)
  const [yo, setYo] = useState(null)
  const [buscandoYo, setBuscandoYo] = useState(false)
  const [avisoYo, setAvisoYo] = useState('')
  const caja = useRef(null)
  const mapa = useRef(null)
  const capaYo = useRef(null)
  const elegidaRef = useRef(null)
  const yoRef = useRef(null)
  yoRef.current = yo
  // El mapa ya está en un sitio con sentido (la búsqueda ya no lo mueve sola) y la persona ya lo ha tocado (tampoco su
  // posición, cuando llegue). `destino`: adónde va el mapa mientras se mueve solo, que es lo que se guarda si se pulsa
  // «Es aquí» antes de que acabe de moverse.
  const situado = useRef(!!inicio)
  const tocadoMapa = useRef(false)
  const destino = useRef(null)
  const mover = useCallback((p, z) => { destino.current = p; mapa.current?.setView(p, z) }, [])

  useEffect(() => {
    const m = L.map(caja.current, {
      zoomControl: false, attributionControl: true, minZoom: 2, maxZoom: 19,
      // La chincheta es el centro: la rueda, los dedos y el doble toque acercan sin moverlo.
      scrollWheelZoom: 'center', touchZoom: 'center', doubleClickZoom: 'center',
      // El cambio de tamaño, solo con el vigía de abajo, que espera a que el mapa se pare (03-11-2026).
      trackResize: false,
    }).setView(vista.punto, vista.zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    m.attributionControl.setPosition('bottomleft')
    /* EL ZOOM NO LA OLVIDA (03-11-2026, el revisor; como la app nativa: Situar.alPararse). Con los dedos, Leaflet no
       acerca ni aleja sobre el centro exacto (lo saca del pixelOrigin redondeado: hasta medio píxel, más de 3 m a zoom
       14 o menos), y al girar el móvil (invalidateSize) igual: tras elegir «Rúa Brétema, 15179 Oleiros · Otra calle» y
       alejar hasta el 13, se olvidaba y «Es aquí» mandaba el punto de Oleiros como la puerta. Al pararse el mapa, la
       olvida el centro a más de 3 m de ella Y a más de 8 px en la pantalla (un arrastre, las flechas del teclado); si
       no, y el centro se ha desviado, se vuelve a centrar en ella sin animar, una vez por parada del mapa (ese setView
       da otro moveend).
       EL PELLIZCO QUE EMPIEZA COMO ARRASTRE (A2, 03-11-2026, el revisor): con el primer dedo movido 16 px o más antes
       del segundo, Leaflet lanza dragstart y ahí se olvidaba («Es aquí» mandaba «mapa»: lo escrito con el punto de
       Oleiros). Ahora se decide al pararse: si en el gesto hubo zoom (zoomstart) o dos dedos, es un zoom y se vuelve a
       centrar en ella. Mientras se arrastra lejos, abajo no se dice (se quita `elegida`, la de «Es aquí»; elegidaRef
       espera). Con un dedo aún en el mapa, un moveend (el del cambio de tamaño que trae el texto de abajo) no decide.
       EL SEGUNDO DEDO TRAS UN ARRASTRE LARGO (A3, 03-11-2026, la séptima tanda): mover el mapa con un dedo y, sin
       soltarlo, poner el segundo para acercar la volvía a dar por buena, y «Es aquí» mandaba la sugerencia y no el punto
       movido a mano. Si al llegar el segundo dedo (o al empezar otro zoom) el centro ya está a más de 48 px de ella, más
       que el primer dedo de un pellizco (los 16-24 px de A2), y el mapa no va solo hacia ella, es un arrastre: se olvida. */
    const gesto = { zoom: false, dos: false, dedos: 0 }
    const otraVez = () => { gesto.zoom = false; gesto.dos = false }
    const lejosDe = (e) => {
      const c = m.getCenter()
      return metros([c.lat, c.lng], [e.lat, e.lng]) > 3 && m.latLngToContainerPoint([e.lat, e.lng]).distanceTo(m.getSize().divideBy(2)) > 8
    }
    const mira = () => {
      const e = elegidaRef.current
      if (e) setElegida(gesto.zoom || gesto.dos || !lejosDe(e) ? e : null)
    }
    // A3: ¿ya está el centro a más de 48 px de ella, sin que el mapa vaya solo hacia ella (`destino`, al elegirla)?
    // Entonces es un arrastre: la olvida y dice que sí.
    const trasArrastre = () => {
      const e = elegidaRef.current
      if (!e || destino.current || m.latLngToContainerPoint([e.lat, e.lng]).distanceTo(m.getSize().divideBy(2)) <= 48) return false
      elegidaRef.current = null; setElegida(null)
      return true
    }
    // Los dedos, antes que Leaflet (en la captura): con el segundo, el arrastre del primero ya es un zoom. El primer
    // dedo, el ratón o una tecla empiezan otro gesto, salvo a mitad de un zoom animado (su moveend aún es del pellizco).
    const dedos = (ev) => {
      gesto.dedos = ev.touches ? ev.touches.length : 0
      if ((ev.type === 'touchstart' ? gesto.dedos === 1 : /^(mouse|key)down$/.test(ev.type)) && !m._animatingZoom) otraVez()
      if (gesto.dedos > 1 && (gesto.dos || !trasArrastre())) { gesto.dos = true; mira() }
    }
    const entradas = ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'keydown']
    for (const t of entradas) caja.current.addEventListener(t, dedos, { capture: true, passive: true })
    m.on('dragstart', () => {
      situado.current = true; tocadoMapa.current = true; destino.current = null
      setVerLista(false)
    })
    // A3: otro zoom tras un arrastre (la rueda con el ratón aún pulsado, el doble toque), como el segundo dedo; el del
    // pellizco ya lo decidió el segundo dedo (gesto.dos).
    m.on('zoomstart', () => {
      if (!gesto.dos && trasArrastre()) return
      gesto.zoom = true; mira()
    })
    m.on('drag', mira)
    let recentrando = false
    m.on('moveend', () => {
      destino.current = null
      const zoom = gesto.zoom || gesto.dos
      const enCurso = gesto.dedos > 0 || !!m.dragging?.moving()
      if (!enCurso) otraVez()
      const e = elegidaRef.current
      if (!e || recentrando || (enCurso && !zoom)) return
      if (!zoom && lejosDe(e)) { elegidaRef.current = null; setElegida(null); return }
      setElegida(e)
      const c = m.getCenter()
      if (metros([c.lat, c.lng], [e.lat, e.lng]) > 0.01) {
        recentrando = true
        try { m.setView([e.lat, e.lng], m.getZoom(), { animate: false }) } finally { recentrando = false }
      }
    })
    m.on('zoomend', () => setZoom(m.getZoom()))
    mapa.current = m
    /* A MEDIAS DE UN VIAJE, NO (03-11-2026): invalidateSize en mitad de la animación hacia la sugerencia elegida (girar
       el móvil justo al tocarla) lo descoloca, porque la animación de Leaflet pisa el desplazamiento: llegaba a 70 px de
       ella y se olvidaba. Entonces se hace al pararse. */
    const vigia = new ResizeObserver(() => {
      if (m._animatingZoom || m._panAnim?._inProgress) m.once('moveend', () => m.invalidateSize())
      else m.invalidateSize()
    })
    vigia.observe(caja.current)
    const cajaMapa = caja.current
    return () => {
      vigia.disconnect()
      for (const t of entradas) cajaMapa.removeEventListener(t, dedos, { capture: true })
      // Un zoom animado a medias (dura 250 ms: elegir una sugerencia y pulsar «Es aquí» enseguida) fallaba con el mapa
      // ya quitado («_leaflet_pos» de Leaflet 1.9): se termina antes de quitarlo.
      try { if (m._animatingZoom) m._onZoomTransitionEnd() } catch { /* nada */ }
      m.remove(); mapa.current = null; capaYo.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Dónde está el móvil: el punto azul y, si no se sabe nada de la parada, el sitio donde empezar (como en la app
     nativa: gana a la primera sugerencia mientras la persona no haya tocado el mapa). «Mi ubicación», siempre. */
  const irAMiPosicion = useCallback((modo) => {
    if (!('geolocation' in navigator)) { if (modo === 'boton') setAvisoYo(sinUbicacion()); return }
    if (modo === 'boton') { setBuscandoYo(true); setAvisoYo('') }
    navigator.geolocation.getCurrentPosition((g) => {
      const p = [g.coords.latitude, g.coords.longitude]
      setBuscandoYo(false)
      setYo(p)
      if (modo === 'boton' || (modo === 'inicio' && !tocadoMapa.current)) {
        situado.current = true
        if (modo === 'boton') tocadoMapa.current = true
        elegidaRef.current = null; setElegida(null)
        mover(p, 18)
      }
    }, () => { setBuscandoYo(false); if (modo === 'boton') setAvisoYo(sinUbicacion()) },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }, [mover])
  useEffect(() => {
    // Sin nada con qué empezar, la posición (puede pedir permiso). Si no, solo el punto azul, y solo si ya hay permiso.
    if (!inicio) { irAMiPosicion('inicio'); return }
    try {
      navigator.permissions?.query({ name: 'geolocation' }).then((r) => { if (r.state === 'granted') irAMiPosicion('') }).catch(() => {})
    } catch { /* sin la API de permisos: sin punto azul */ }
  }, [inicio, irAMiPosicion])
  useEffect(() => {
    const m = mapa.current
    if (!m || !yo) return
    if (capaYo.current) { capaYo.current.setLatLng(yo); return }
    const icono = L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9],
      html: '<div style="width:18px;height:18px;border-radius:9px;background:rgb(37,99,235);border:3px solid white;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>' })
    capaYo.current = L.marker(yo, { icon: icono, interactive: false, keyboard: false }).addTo(m)
  }, [yo])

  // Las sugerencias: al abrir, con la dirección de la parada (y su CP y población); después, con lo que se escriba.
  useEffect(() => {
    const q = texto.trim()
    setBuscado(false)
    if (q.length < 4) { setSugs([]); setBuscando(false); setSinRed(false); return undefined }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      setBuscando(true)
      const extra = tocado ? {} : { cp: parada?.cp || '', localidad: parada?.localidad || '' }
      const cerca = punto(parada?.zona_lat, parada?.zona_lng) || punto(base?.lat, base?.lng) || yoRef.current
      const [srv, suyas, deMapa] = await Promise.all([
        repUbicar(q, { ...extra, signal: ctl.signal }).then((r) => ({ red: true, r: deUbicar(r.data) }))
          .catch((e) => ({ red: !!e?.response, r: null })),
        historial ? repMisDirecciones(q).then((r) => lista(r.data?.direcciones).map((x) => ({ ...x, conocida: true, fuente: 'suya' }))).catch(() => []) : [],
        buscarDirecciones(q, { cerca: cerca ? { lat: cerca[0], lng: cerca[1] } : null, pais, senal: ctl.signal })
          .then((x) => ({ red: true, x })).catch(() => ({ red: false, x: [] })),
      ])
      if (ctl.signal.aborted) return
      // Lo buscado (`q`) solo quita las que no tocan (lib/direcciones.js); «Otra calle», con la de la parada. A Photon
      // va sin el piso (C, 03-11-2026: buscarDirecciones); al servidor (repUbicar), tal cual.
      const juntas = juntarSugerencias(srv.r?.candidatos || [], suyas, deMapa.x, 7, parada?.direccion || '', parada?.cp || '', parada?.localidad || '')
      setSugs(juntas)
      setAtribucion(srv.r?.candidatos?.length ? srv.r.atribucion : '')
      setSinRed(!srv.red && !deMapa.red)
      setBuscando(false)
      setBuscado(true)
      if (tocado) setVerLista(true)
      // Sin nada con qué empezar (ni la posición): a la zona que encontró el servidor o a la primera sugerencia, sin
      // darla por buena (una de otra calle, no).
      if (!situado.current && !yoRef.current) {
        const primera = juntas.find((x) => !x.otraCalle)
        const ir = srv.r?.zona ? [srv.r.zona, 15] : primera ? [[primera.lat, primera.lng], 16] : null
        if (ir) { situado.current = true; mover(ir[0], ir[1]) }
      }
    }, tocado ? 500 : 0)
    return () => { clearTimeout(t); ctl.abort() }
  }, [texto, tocado]) // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(s) {
    situado.current = true
    tocadoMapa.current = true
    elegidaRef.current = s
    setElegida(s)
    setVerLista(false)
    try { document.activeElement?.blur?.() } catch { /* nada */ }
    mover([s.lat, s.lng], s.precision === 'calle' ? 17 : 18)
  }

  const puede = !!elegida || zoom >= ZOOM_PUERTA
  function esAqui() {
    const m = mapa.current
    if (!m || guardando || !puede) return
    // `elegida` solo sigue ahí mientras la chincheta está donde la puso (al moverla se quita). La precisión es la de la
    // regla (alElegir, con la dirección de la parada): «Calle Real 85» para «Rúa Real 999» es la calle, no la puerta,
    // y una suya, la que dice el servidor (03-11-2026).
    if (elegida) {
      const el = alElegir(parada?.direccion || '', elegida, parada?.cp || '', parada?.localidad || '')
      onElegir({ lat: elegida.lat, lng: elegida.lng, origen: 'sugerencia', sugerencia: elegida, precision: el.precision === 'calle' ? 'calle' : '' })
      return
    }
    const c = destino.current ? L.latLng(destino.current[0], destino.current[1]) : m.getCenter().wrap()
    onElegir({ lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6, origen: 'mapa', sugerencia: null, precision: '' })
  }

  // Ninguna de la calle BUSCADA (o ninguna) es que no la encuentra, como en la app nativa (Situar.deLaBuscada): «Otra
  // calle» ya se marca con la dirección de la parada, y lo buscado aquí se puede haber cambiado (03-11-2026).
  const noEncuentro = buscado && !buscando && !sinRed && !sugs.some((s) => deLaBuscada(texto.trim(), s)) && texto.trim().length >= 4
  const conLista = verLista && sugs.length > 0
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-dark-950" role="dialog" aria-modal="true" aria-label={tx('Situar la parada')}>
      {/* ARRIBA (diseño compacto, 07-11-2026, §5.10): una fila de 56 con la ✕ de 48 y el buscador de 48, con ⟳ mientras busca. La
          dirección se puede corregir para buscar. «Situar la parada» es el nombre de la pantalla (la cabecera de dos líneas se
          fue: el cliente baja al panel) y la zona segura de arriba, para el iPhone, va en el relleno. */}
      <div className="shrink-0 border-b border-dark-800 bg-dark-900 pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-14 items-center gap-1 pl-1 pr-4">
          <Boton variante="icono" tono="neutro" icono={X} nombre={tx('Cerrar')} onClick={onCerrar} />
          <div className="relative min-w-0 flex-1">
            <Campo valor={texto} icono={Search} ejemplo={tx('Calle, número y población')} nombre={tx('Dirección')} autoComplete="off" enterKeyHint="search"
              onChange={(v) => { setTexto(v); setTocado(true); setVerLista(true) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              style={{ paddingRight: buscando ? 44 : undefined, textOverflow: 'ellipsis' }} />
            {buscando && <Loader2 size={20} aria-label={tx('Buscando la dirección…')} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-dark-400" />}
          </div>
        </div>
      </div>

      {/* EL MAPA, con la chincheta fija en el centro. */}
      <div className="relative min-h-0 flex-1">
        <div ref={caja} data-testid="situar-mapa" className="absolute inset-0 isolate" />
        <Chincheta />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-3">
          {conLista && (
            <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl bg-dark-900 shadow-md">
              <div className="flex min-h-12 items-center gap-1 pl-3 pr-1">
                <p className="min-w-0 flex-1 text-etiqueta text-dark-400">{tx('¿Es alguna de estas?')}</p>
                <Boton variante="icono" tono="neutro" icono={X} nombre={tx('Cerrar')} onClick={() => setVerLista(false)} />
              </div>
              {/* Cinco como mucho, en filas de 48 con «texto» (FilaSugerencia, la misma de la ficha). */}
              <ul className="max-h-[38dvh] divide-y divide-dark-800 overflow-y-auto border-t border-dark-800" aria-label={tx('Direcciones sugeridas')}>
                {sugs.slice(0, 5).map((s) => (
                  <FilaSugerencia key={`${s.direccion}|${s.lat}|${s.lng}`} s={s} onElegir={elegir} conCliente={false} />
                ))}
              </ul>
              {atribucion && <p className="border-t border-dark-800 px-3 py-2 text-pie text-dark-400">{atribucion}</p>}
            </div>
          )}
          {/* Una píldora cada vez: «sin red» y «no la encuentro» sustituyen a «Mueve el mapa hasta la puerta». */}
          <div className="flex w-full max-w-md flex-col items-center gap-2">
            {sinRed ? (
              <Pastilla role="status" tono="aviso" icono={WifiOff} lineas={3} texto={tx('Sin conexión: no puedo buscar la dirección. Si estás en la puerta, pulsa «Mi ubicación» y «Es aquí».')} />
            ) : noEncuentro ? (
              <Pastilla role="status" lineas={2} texto={tx('No encuentro esa dirección: mueve el mapa hasta la puerta.')} />
            ) : !conLista && <Pastilla role="status" texto={tx('Mueve el mapa hasta la puerta')} />}
            {avisoYo && <Pastilla role="status" tono="aviso" lineas={2} texto={avisoYo} />}
          </div>
        </div>
        {/* «Mi ubicación» (48), abajo a la derecha y encima del panel; mientras busca el móvil, un círculo que gira. */}
        <BotonMapa className="absolute bottom-3 right-3 z-10" nombre={tx('Mi ubicación')} onClick={() => irAMiPosicion('boton')}
          icono={buscandoYo ? <Loader2 size={24} aria-hidden="true" className="animate-spin" /> : LocateFixed} />
      </div>

      {/* ABAJO, el panel: lo que se va a guardar («Aquí: …», en dos líneas como mucho), el cliente con la dirección de la parada
          (en «sec»), 🗺 y «✓ Es aquí» (52). La zona segura de abajo, para el iPhone, va en el relleno. */}
      <div className="shrink-0 rounded-t-2xl border-t border-dark-800 bg-dark-900 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <p data-testid="situar-aqui" className="line-clamp-2 text-nombre text-dark-50">
          {elegida ? tx('Aquí: {d}', { d: elegida.direccion }) : (parada?.direccion || tx('Mueve el mapa hasta la puerta'))}
        </p>
        {(parada?.cliente || (elegida && parada?.direccion)) && (
          <p className="mt-1 truncate text-sec text-dark-400">
            {parada?.cliente && <span>{parada.cliente}</span>}
            {parada?.cliente && elegida && parada?.direccion && <span> · </span>}
            {elegida && parada?.direccion && (
              <span>{elegida.otraCalle && <span className="font-semibold text-ruta-peligro-texto">{tx('Otra calle')} · </span>}{parada.direccion}</span>
            )}
          </p>
        )}
        {!puede && <p className="mt-1 text-sec font-semibold text-ruta-aviso-texto">{tx('Acerca el mapa hasta ver la puerta')}</p>}
        {error && <p role="alert" className="mt-1 text-texto font-semibold text-ruta-peligro-texto">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          {enlaceFuera && (
            // «Abrir en Google Maps» (o Waze), de icono: el mismo nombre y el mismo enlace que el texto suelto de antes. Se cierra
            // después de seguir el enlace: quitarlo de la página en el mismo toque podría dejarlo sin abrir.
            <Boton variante="icono" tono="neutro" relleno icono={IconoMapa} nombre={tx('Abrir en {app}', { app: nombreFuera })}
              href={enlaceFuera} target="_blank" rel="noreferrer" onClick={() => setTimeout(onCerrar, 0)} />
          )}
          <Boton variante="principal" icono={Check} texto={tx('Es aquí')} cargando={guardando} disabled={!puede || guardando} onClick={esAqui} className="min-w-0 flex-1" />
        </div>
      </div>
    </div>
  )
}

/* La chincheta fija: su punta es el centro exacto del mapa (y la sombra, el punto que se guarda). Los colores son clases
   (el relleno de marca y el trazo blanco), no hex a mano; el dibujo, el de siempre. */
function Chincheta() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden="true" data-testid="chincheta">
      <span className="absolute -left-1 -top-1 block h-2 w-2 rounded-full bg-black/50" />
      <svg width="44" height="56" viewBox="0 0 44 56" className="absolute drop-shadow-md" style={{ left: -22, top: -55 }}>
        <path d="M22 54C22 54 4 34 4 21a18 18 0 0 1 36 0c0 13-18 33-18 33z" className="fill-brand-500 stroke-white" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="22" cy="21" r="6.5" className="fill-white" />
      </svg>
    </div>
  )
}
