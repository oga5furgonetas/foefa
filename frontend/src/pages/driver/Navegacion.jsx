import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, RotateCw, Undo2, MapPin, X, Phone, Volume2, VolumeX,
  LocateFixed, Loader2, Check, Package, Navigation, Flag,
} from 'lucide-react'
import { repNavegar } from '../../services/api'
import {
  prepararLinea, proyectar, situarPasos, proximoPaso, textoDistancia, distanciaHablada, metrosEntre, rumbo as rumboEntre,
} from '../../lib/guia'

/* ── LA GUÍA DENTRO DE LA APP (04-10-2026) ───────────────────────────────────
   Dani: «yo quiero el navegador ya dentro, que coja la ruta y te vaya
   llevando a los sitios». Mapa que te sigue, la próxima maniobra en grande y
   en voz alta, recalcula si te sales de la ruta, y al llegar: Entregado / No
   entregado y a la siguiente sin tocar nada más.

   Las indicaciones salen del servidor de rutas de OpenStreetMap; la voz, del
   propio móvil. Sin tráfico en directo ni carriles: para eso, el botón de
   Google Maps sigue ahí. La ubicación se usa para guiar y NO se guarda. */

const ICONOS = {
  derecha: CornerUpRight, izquierda: CornerUpLeft, 'ligera-derecha': ArrowUpRight, 'ligera-izquierda': ArrowUpLeft,
  recto: ArrowUp, rotonda: RotateCw, vuelta: Undo2, llegada: Flag,
}
const LLEGADA_M = 40        // a menos de esto de la puerta, has llegado
const FUERA_M = 45          // más lejos de la línea que esto, te has salido
const RECALCULAR_CADA = 15000

const leeVoz = () => { try { return localStorage.getItem('guia_voz') !== '0' } catch { return true } }

function decir(texto) {
  try {
    const s = window.speechSynthesis
    if (!s || !texto) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-ES'
    const v = s.getVoices().find((x) => (x.lang || '').toLowerCase().startsWith('es'))
    if (v) u.voice = v
    s.speak(u)
  } catch { /* sin voz en este móvil: se sigue viendo */ }
}

const horaMas = (min) => {
  const d = new Date(Date.now() + min * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Navegacion({ parada, numero, quedan, onSalir, onEntregar, onNoEntregar, enlaceFuera }) {
  const [pos, setPos] = useState(null)          // {p:[lat,lng], rumbo}
  const [errPos, setErrPos] = useState('')
  const [guia, setGuia] = useState(null)        // {id, prep, pasos, metros, minutos, fuente}
  const [errGuia, setErrGuia] = useState('')
  const [pidiendo, setPidiendo] = useState(false)
  const [voz, setVoz] = useState(leeVoz)
  const [seguir, setSeguir] = useState(true)
  const [llegado, setLlegado] = useState(null)  // id de la parada a la que se ha llegado
  const dichos = useRef(new Set())
  const ultimaPeticion = useRef(0)
  const fueraSeguidas = useRef(0)
  const vozRef = useRef(voz)
  vozRef.current = voz
  const habla = useCallback((t) => { if (vozRef.current) decir(t) }, [])
  useEffect(() => { try { localStorage.setItem('guia_voz', voz ? '1' : '0') } catch { /* nada */ } if (!voz) try { window.speechSynthesis?.cancel() } catch { /* nada */ } }, [voz])

  // La posición, mientras esta pantalla está abierta. Y la pantalla encendida.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setErrPos('Este móvil no da la ubicación.'); return undefined }
    let anterior = null
    let rumboUltimo = null
    const id = navigator.geolocation.watchPosition((g) => {
      const p = [g.coords.latitude, g.coords.longitude]
      if (Number.isFinite(g.coords.heading) && (g.coords.speed || 0) > 1) rumboUltimo = g.coords.heading
      else if (anterior && metrosEntre(anterior, p) > 4) rumboUltimo = rumboEntre(anterior, p)
      if (!anterior || metrosEntre(anterior, p) > 4) anterior = p
      setErrPos('')
      setPos({ p, rumbo: rumboUltimo })
    }, (e) => setErrPos(e.code === 1 ? 'Dale permiso de ubicación a la app para que te guíe.' : 'No llega la ubicación del móvil.'),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [])
  useEffect(() => {
    let cerrojo = null
    const pedir = async () => { try { cerrojo = await navigator.wakeLock?.request('screen') } catch { /* no hay: da igual */ } }
    const alVolver = () => { if (document.visibilityState === 'visible') pedir() }
    pedir()
    document.addEventListener('visibilitychange', alVolver)
    return () => { document.removeEventListener('visibilitychange', alVolver); try { cerrojo?.release() } catch { /* nada */ } }
  }, [])

  const pedirGuia = useCallback(async (p, desde, recalculo) => {
    ultimaPeticion.current = Date.now()
    setPidiendo(true)
    try {
      const { data } = await repNavegar(p.id, { lat: desde[0], lng: desde[1] })
      const prep = prepararLinea(data.linea || [])
      setGuia({ id: p.id, prep, pasos: situarPasos(prep, data.pasos), metros: data.metros, minutos: data.minutos, fuente: data.fuente })
      setErrGuia('')
      fueraSeguidas.current = 0
      if (!recalculo) habla(`Vamos a ${p.cliente || 'la siguiente parada'}. ${distanciaHablada(data.metros || 0)}.`)
      else habla('Ruta recalculada.')
    } catch (e) {
      setErrGuia(e?.response?.data?.detail || 'No se pudo calcular la ruta')
    } finally { setPidiendo(false) }
  }, [habla])

  // Parada nueva (o la primera posición): ruta hasta ella.
  useEffect(() => {
    if (!parada || !pos || pidiendo) return
    if (guia?.id === parada.id) return
    if (errGuia && Date.now() - ultimaPeticion.current < RECALCULAR_CADA) return
    dichos.current = new Set()
    pedirGuia(parada, pos.p, false)
  }, [parada, pos, guia, pidiendo, errGuia, pedirGuia])

  // Cada posición: ¿has llegado?, ¿te has salido?, ¿toca anunciar algo?
  useEffect(() => {
    if (!pos || !parada || !guia || guia.id !== parada.id) return
    const destino = [parada.lat, parada.lng]
    const { hecho, fuera } = proyectar(guia.prep, pos.p)
    if (llegado !== parada.id && (metrosEntre(pos.p, destino) < LLEGADA_M || (guia.prep.total - hecho < 25 && fuera < FUERA_M))) {
      setLlegado(parada.id)
      habla(`Has llegado a ${parada.cliente || 'la parada'}.${parada.hueco ? ` Va ${parada.hueco.replace('·', '')}.` : ''}`)
      if (navigator.vibrate) navigator.vibrate([80, 60, 80])
      return
    }
    if (guia.fuente === 'carreteras' && fuera > FUERA_M) {
      fueraSeguidas.current += 1
      if (fueraSeguidas.current >= 3 && Date.now() - ultimaPeticion.current > RECALCULAR_CADA && !pidiendo) pedirGuia(parada, pos.p, true)
      return
    }
    fueraSeguidas.current = 0
    const i = proximoPaso(guia.pasos, hecho)
    const paso = guia.pasos[i]
    if (!paso || paso.icono === 'llegada') return
    const falta = paso.hecho - hecho
    const clave = `${guia.id}:${i}`
    if (falta <= 400 && falta > 130 && !dichos.current.has(`${clave}:lejos`)) {
      dichos.current.add(`${clave}:lejos`)
      habla(`En ${distanciaHablada(Math.round(falta / 50) * 50)}, ${paso.texto.charAt(0).toLowerCase()}${paso.texto.slice(1)}.`)
    } else if (falta <= 50 && !dichos.current.has(`${clave}:cerca`)) {
      dichos.current.add(`${clave}:cerca`)
      habla(`${paso.texto}.`)
    }
  }, [pos, parada, guia, llegado, pidiendo, habla, pedirGuia])

  // Lo que se pinta.
  const lista = guia && parada && guia.id === parada.id
  const proy = lista && pos ? proyectar(guia.prep, pos.p) : null
  const iPaso = lista ? proximoPaso(guia.pasos, proy?.hecho || 0) : -1
  const paso = lista ? guia.pasos[iPaso] : null
  const luego = lista ? guia.pasos[iPaso + 1] : null
  const falta = paso && proy ? Math.max(0, paso.hecho - proy.hecho) : paso?.metros
  const restante = lista ? Math.max(0, guia.prep.total - (proy?.hecho || 0)) : null
  const minRest = lista && guia.minutos && guia.prep.total ? (guia.minutos * restante) / guia.prep.total : null
  const Icono = ICONOS[paso?.icono] || ArrowUp
  const haLlegado = parada && llegado === parada.id
  const flecha = guia?.fuente === 'linea_recta' && pos && parada ? rumboEntre(pos.p, [parada.lat, parada.lng]) : null

  return (
    <div className="fixed inset-0 z-[45] bg-dark-950" role="dialog" aria-modal="true" aria-label="Navegación">
      <MapaGuia linea={lista ? guia.prep.linea : null} yo={pos?.p} rumbo={pos?.rumbo}
        destino={parada ? [parada.lat, parada.lng] : null} numero={numero} seguir={seguir} onMover={() => setSeguir(false)} />

      {/* ARRIBA: la próxima maniobra, en grande. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        {!parada ? null : errPos ? (
          <Banda tono="ambar"><MapPin size={30} /><span className="text-[16px] font-bold leading-snug">{errPos}</span></Banda>
        ) : !lista ? (
          <Banda><Loader2 size={30} className="animate-spin" /><span className="text-[17px] font-bold">{errGuia || 'Calculando la ruta…'}</span></Banda>
        ) : haLlegado ? (
          <Banda><Flag size={34} /><span className="text-[20px] font-bold">Has llegado</span></Banda>
        ) : guia.fuente === 'linea_recta' ? (
          <Banda tono="ambar">
            <Navigation size={34} style={{ transform: `rotate(${flecha ?? 0}deg)` }} />
            <span><b className="block text-[24px] leading-none">{textoDistancia(restante)}</b><span className="text-[14px]">Sin indicaciones ahora: sigue la flecha hasta la parada</span></span>
          </Banda>
        ) : (
          <div>
            <Banda>
              <Icono size={44} strokeWidth={2.6} className="shrink-0" />
              <span className="min-w-0">
                <b className="block text-[30px] leading-none tracking-tight" data-testid="guia-distancia">{textoDistancia(falta)}</b>
                <span className="mt-1 block text-[16px] font-semibold leading-snug" data-testid="guia-texto">{paso?.icono === 'llegada' ? 'Llegas a tu parada' : paso?.texto}</span>
              </span>
            </Banda>
            {luego && luego.icono !== 'llegada' && (
              <div className="ml-3 inline-flex items-center gap-1.5 rounded-b-xl bg-emerald-900/95 px-3 py-1.5 text-[13px] text-emerald-50">
                Luego {(() => { const I = ICONOS[luego.icono] || ArrowUp; return <I size={15} /> })()} {luego.texto}
              </div>
            )}
          </div>
        )}
        {pidiendo && lista && <p className="mt-2 inline-block rounded-full bg-dark-900/90 px-3 py-1 text-[12px] text-dark-200">Recalculando…</p>}
      </div>

      {/* BOTONES DEL MAPA */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <button onClick={() => setVoz((v) => !v)} aria-label={voz ? 'Silenciar la voz' : 'Activar la voz'}
          className="rounded-full border border-dark-700 bg-dark-900/95 p-3 text-dark-100 shadow-lg">{voz ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
        {!seguir && (
          <button onClick={() => setSeguir(true)} aria-label="Centrar en mí"
            className="rounded-full border border-dark-700 bg-dark-900/95 p-3 text-sky-300 shadow-lg"><LocateFixed size={20} /></button>
        )}
      </div>

      {/* ABAJO: la parada, o al llegar, entregar. */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-dark-700 bg-dark-950/[.97] p-4 pb-6 shadow-2xl">
        {!parada ? (
          <div className="text-center">
            <p className="text-[20px] font-bold text-dark-50">No quedan paradas</p>
            <p className="mt-1 text-[13px] text-dark-400">Ruta terminada. Buen trabajo.</p>
            <button onClick={onSalir} className="mt-4 w-full rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-brand-tinta">Volver a la ruta</button>
          </div>
        ) : haLlegado ? (
          <>
            <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-300">Parada {numero}{quedan > 1 ? ` · quedan ${quedan}` : ''}</p>
            <p className="text-[20px] font-bold leading-tight text-dark-50">{parada.cliente || 'Cliente'}</p>
            <p className="text-[14px] text-dark-300">{parada.direccion}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              {parada.hueco && <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 font-bold text-sky-200"><Package size={13} /> Búscalo: {parada.hueco}</span>}
              {parada.cobrar > 0 && <span className="rounded-lg bg-emerald-500/15 px-2 py-1 font-bold text-emerald-300">Cobrar {Number(parada.cobrar).toFixed(2).replace('.', ',')} €</span>}
              {parada.bultos > 1 && <span className="rounded-lg bg-dark-800 px-2 py-1 text-dark-200">{parada.bultos} bultos</span>}
            </div>
            {(parada.notas || parada.contenido) && <p className="mt-1.5 text-[13px] text-dark-400">{[parada.contenido, parada.notas].filter(Boolean).join(' · ')}</p>}
            <div className="mt-3 grid grid-cols-[auto_1fr_2fr] gap-2">
              {parada.telefono
                ? <a href={`tel:${parada.telefono}`} aria-label="Llamar" className="flex items-center justify-center rounded-xl border border-dark-600 px-4 text-dark-100"><Phone size={18} /></a>
                : <span />}
              <button onClick={() => onNoEntregar(parada)} className="rounded-xl border border-red-500/40 py-3.5 text-[14px] font-semibold text-red-300">No entregado</button>
              <button onClick={() => onEntregar(parada)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3.5 text-[16px] font-bold text-white">
                <Check size={18} /> {parada.tipo === 'recogida' ? 'Recogido' : 'Entregado'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[15px] font-bold text-brand-tinta">{numero}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold text-dark-50">{parada.cliente || 'Cliente'}</p>
                <p className="truncate text-[13px] text-dark-300">{parada.direccion}</p>
                {lista && (
                  <p className="mt-0.5 text-[13px] text-dark-200">
                    {minRest != null && <>Llegas <b className="text-emerald-300">≈ {horaMas(minRest)}</b> · </>}{textoDistancia(restante)}
                    {minRest != null && <> · {Math.max(1, Math.round(minRest))} min</>}
                  </p>
                )}
              </div>
              <button onClick={onSalir} aria-label="Salir de la navegación" className="rounded-full border border-dark-700 p-2.5 text-dark-300"><X size={18} /></button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
              {parada.telefono
                ? <a href={`tel:${parada.telefono}`} className="flex items-center justify-center gap-1 rounded-xl border border-dark-700 py-2.5 text-dark-100"><Phone size={15} /> Llamar</a>
                : <span className="flex items-center justify-center rounded-xl border border-dark-800 py-2.5 text-dark-600">Sin teléfono</span>}
              <a href={enlaceFuera(parada)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl border border-dark-700 py-2.5 text-dark-100"><Navigation size={15} /> Google Maps</a>
              <button onClick={() => { setLlegado(parada.id); if (navigator.vibrate) navigator.vibrate(60) }}
                className="rounded-xl border border-emerald-600/50 py-2.5 font-semibold text-emerald-300">Ya he llegado</button>
            </div>
            <p className="mt-2 text-center text-[10.5px] text-dark-500">Tu ubicación se usa para guiarte y no se guarda.</p>
          </>
        )}
      </div>
    </div>
  )
}

function Banda({ children, tono }) {
  return (
    <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-2xl ${tono === 'ambar' ? 'bg-amber-700' : 'bg-emerald-700'}`}>
      {children}
    </div>
  )
}

/* El mapa de la guía: te sigue (si no lo mueves con el dedo), la ruta en
   azul gruesa como un navegador, tu flecha girada hacia donde vas y la
   parada con su número. Norte arriba: Leaflet no gira el mapa. */
function MapaGuia({ linea, yo, rumbo, destino, numero, seguir, onMover }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const capas = useRef({})
  const avisa = useRef(onMover)
  avisa.current = onMover

  useEffect(() => {
    const m = L.map(caja.current, { zoomControl: false, attributionControl: true }).setView(destino || [40.4, -3.7], destino ? 16 : 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    m.on('dragstart', () => avisa.current())
    mapa.current = m
    const vigia = new ResizeObserver(() => m.invalidateSize())
    vigia.observe(caja.current)
    return () => { vigia.disconnect(); m.remove(); mapa.current = null; capas.current = {} }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capas.current.borde?.remove(); capas.current.linea?.remove()
    if (linea?.length > 1) {
      capas.current.borde = L.polyline(linea, { color: '#ffffff', weight: 11, opacity: 0.95, interactive: false }).addTo(m)
      capas.current.linea = L.polyline(linea, { color: '#1d4ed8', weight: 7, opacity: 1, interactive: false }).addTo(m)
      if (!yo) m.fitBounds(linea, { padding: [80, 80], maxZoom: 17 })
    }
  }, [linea]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capas.current.destino?.remove()
    if (destino?.[0] != null) {
      const icono = L.divIcon({
        className: '',
        html: `<div style="width:38px;height:38px;border-radius:19px 19px 19px 4px;transform:rotate(-45deg);background:#0FC2BC;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font:800 15px system-ui;color:#04201f">${Number(numero) || ''}</span></div>`,
        iconSize: [38, 38], iconAnchor: [6, 38],
      })
      capas.current.destino = L.marker(destino, { icon: icono, zIndexOffset: 500 }).addTo(m)
    }
  }, [destino?.[0], destino?.[1], numero]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current
    if (!m || !yo) return
    const conRumbo = Number.isFinite(rumbo)
    const html = conRumbo
      ? `<div style="width:34px;height:34px;transform:rotate(${rumbo}deg)"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="#2563eb" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>`
      : '<div style="width:20px;height:20px;border-radius:10px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>'
    const t = conRumbo ? 34 : 20
    const icono = L.divIcon({ className: '', html, iconSize: [t, t], iconAnchor: [t / 2, t / 2] })
    if (capas.current.yo) { capas.current.yo.setLatLng(yo); capas.current.yo.setIcon(icono) } else {
      capas.current.yo = L.marker(yo, { icon: icono, zIndexOffset: 1000, interactive: false }).addTo(m)
    }
    if (seguir) m.setView(yo, Math.max(m.getZoom(), 17), { animate: true })
  }, [yo?.[0], yo?.[1], rumbo, seguir]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={caja} className="absolute inset-0 isolate" />
}
