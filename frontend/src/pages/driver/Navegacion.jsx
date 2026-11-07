import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, RotateCw, Undo2, MapPin, X, Phone, Volume2, VolumeX,
  LocateFixed, Loader2, Package, Navigation, Flag, Mic, MicOff, Banknote, StickyNote, MessageSquareText, History,
} from 'lucide-react'
import { repNavegar } from '../../services/api'
import { textoClienteDice } from './ClienteDice'
import {
  prepararLinea, proyectar, situarPasos, proximoPaso, textoDistancia, distanciaHablada, metrosEntre, rumbo as rumboEntre, textoPaso,
} from '../../lib/guia'
import { importe } from '../../lib/region'
import { tx, useIdioma, locale, txError, idioma } from '../../lib/idioma'
import { useAtras } from '../../lib/atras'
import { decir } from '../../lib/voz'
import Atribucion from './piezas/Atribucion'
import Boton from './piezas/Boton'
import BotonMapa from './piezas/BotonMapa'
import FilaCierre from './piezas/FilaCierre'
import LetraMax from './piezas/LetraMax'
import NumeroParada from './piezas/NumeroParada'
import Pastilla from './piezas/Pastilla'
import icono from './piezas/icono'

/* ── LA GUÍA DENTRO DE LA APP (04-10-2026) ───────────────────────────────────
   Dani: «yo quiero el navegador ya dentro, que coja la ruta y te vaya
   llevando a los sitios». Mapa que te sigue, la próxima maniobra en grande y
   en voz alta, recalcula si te sales de la ruta, y al llegar: Entregado / No
   entregado y a la siguiente sin tocar nada más.

   Las indicaciones salen del servidor de rutas de OpenStreetMap; la voz, del
   propio móvil. Sin tráfico en directo ni carriles: para eso, el botón de
   Google Maps sigue ahí. La ubicación se usa para guiar y NO se guarda.

   LO QUE SE VE, CON EL DISEÑO COMPACTO (07-11-2026, §5.8): la banda de arriba con el icono de 40, la distancia en
   «guia» y la instrucción en dos líneas como mucho; los botones (voz, el mapa de fuera, manos libres y «Seguirme»)
   son BotonMapa en una columna a la derecha, 12 por encima del panel (se mide con ResizeObserver: antes iban a media
   pantalla y la hoja de llegada los tapaba en los móviles de 800 o menos); y el panel de abajo con el número de 40, el
   nombre, «Llamar» y la ✕ de icono, «Llegas ≈ …», las notas en una línea y «Ya he llegado» a lo ancho (al llegar, la
   FilaCierre). Lo que hace cada botón y lo que se manda al servidor, igual que antes. Los dibujos del mapa (la ruta, la
   flecha, la chincheta) no cambian: por eso MapaGuia lleva colores hex y este fichero no lleva la marca de
   `check-tokens-ruta.mjs`. */

const ICONOS = {
  derecha: CornerUpRight, izquierda: CornerUpLeft, 'ligera-derecha': ArrowUpRight, 'ligera-izquierda': ArrowUpLeft,
  recto: ArrowUp, rotonda: RotateCw, vuelta: Undo2, llegada: Flag,
}
const LLEGADA_M = 40        // a menos de esto de la puerta, has llegado
const FUERA_M = 45          // más lejos de la línea que esto, te has salido
const RECALCULAR_CADA = 15000

const leeVoz = () => { try { return localStorage.getItem('guia_voz') !== '0' } catch { return true } }

/* MANOS LIBRES (11-10-2026). Con el micrófono activado, la guía escucha órdenes cortas mientras conduces:
   «entregado», «no entregado», «he llegado», «deshacer», «llamar», «repite», «silencio». Para que la voz de
   la propia app no se tome por una orden: no se escucha mientras habla, solo valen frases de hasta 4
   palabras y entre orden y orden pasan 2,5 s. Lo reconoce el propio móvil (en Android, el servicio de Google). */
const Reconocedor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const leeManos = () => { try { return localStorage.getItem('guia_manos') === '1' } catch { return false } }
// La explicación larga de manos libres sale la primera vez; después se recuerda en el navegador (07-11-2026, §5.8).
const leeAyudaManos = () => { try { return localStorage.getItem('guia_manos_ayuda') !== '1' } catch { return true } }
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const ORDENES = {
  es: [['deshacer', /\bdeshac(er|e)\b|\bdeshaz\b|\bme he equivocado\b/], ['no_entregado', /\bno (lo |la )?(he )?entregad[oa]\b|\bno esta\b|\bno hay nadie\b|\bausente\b/],
    ['entregado', /\bentregad[oa]\b|\bentregue\b|\bhecho\b|\blisto\b/], ['llegado', /\b(he|ya) llegad[oa]\b|\bllegue\b|\bya estoy\b/],
    ['llamar', /\bllam(a|ar|alo|ala)\b/], ['repite', /\brepit(e|elo)\b|\brepetir\b|\botra vez\b/], ['silencio', /\bsilencio\b|\bcallate\b/],
    ['voz', /\bhabla\b|\bactiva la voz\b/]],
  pt: [['deshacer', /\bdesfaz(er)?\b/], ['no_entregado', /\bnao (foi )?entreg(ue|ado|ada)\b|\bnao esta\b|\bninguem\b|\bausente\b/],
    ['entregado', /\bentreg(ue|ado|ada)\b|\bfeito\b|\bpronto\b/], ['llegado', /\bcheguei\b|\bja estou\b/], ['llamar', /\bliga(r)?\b/],
    ['repite', /\brepet(e|ir)\b/], ['silencio', /\bsilencio\b/], ['voz', /\bfala\b/]],
  en: [['deshacer', /\bundo\b/], ['no_entregado', /\bnot delivered\b|\bnobody\b|\bno one\b/], ['entregado', /\bdelivered\b|\bdone\b/],
    ['llegado', /\barrived\b|\bi'?m here\b/], ['llamar', /\bcall\b/], ['repite', /\brepeat\b/], ['silencio', /\bmute\b|\bquiet\b/],
    ['voz', /\bunmute\b|\bvoice on\b/]],
}
export function ordenDeVoz(texto, lengua = 'es') {
  const t = sinAcentos(texto)
  if (!t || t.split(/\s+/).length > 4) return null
  return ((ORDENES[lengua] || ORDENES.es).find(([, re]) => re.test(t)) || [null])[0]
}

const horaMas = (min) => {
  const d = new Date(Date.now() + min * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* La última vez en esa puerta, en una línea: la misma frase que pinta AntesPuerta (su caja no cabe en el panel). */
const SITIO_ANTES = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }
function textoAntes(a) {
  if (!a) return ''
  const d = new Date(`${a.fecha}T12:00:00`)
  const fecha = Number.isNaN(d.getTime()) ? a.fecha : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
  const nota = a.nota ? `«${a.nota}»` : ''
  if (a.estado === 'fallido') return `${tx('La última vez ({fecha}) no se pudo: {motivo}', { fecha, motivo: a.motivo ? tx(a.motivo) : '—' })}${nota ? ` · ${nota}` : ''}`
  return tx('La última vez ({fecha}): {como}', { fecha, como: [a.donde && SITIO_ANTES[a.donde] ? tx(SITIO_ANTES[a.donde]) : '', nota].filter(Boolean).join(' · ') })
}

/* `onLlegar` (30-10-2026): se avisa a la ruta cuando se llega a la parada (solo o con «Ya he llegado»), para el
   registro del intento (a qué hora se llegó) y para pedir la posición de la puerta.
   `onAlto` (07-11-2026, §5.8): opcional; recibe lo que mide el panel de abajo (y 0 al salir), para que «Deshacer» y los
   errores se pongan 8 por encima de él (`abajo` del AvisoFlotante). Sin él, la guía hace lo de siempre. */
export default function Navegacion({ parada, numero, quedan, onSalir, onEntregar, onNoEntregar, onEntregarVoz, onDeshacer, enlaceFuera, nombreFuera = 'Google Maps', onLlegar = null, onAlto = null }) {
  useIdioma()
  useAtras(true, onSalir)   // el «atrás» del móvil sale de la navegación, no de la app
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
  const [manos, setManos] = useState(() => leeManos() && !!Reconocedor && !!ORDENES[idioma()])
  const [oido, setOido] = useState('')
  const [avisoManos, setAvisoManos] = useState('')
  const [ayudaManos] = useState(leeAyudaManos)  // la explicación larga, solo la primera vez
  const ultimaOrden = useRef(0)
  const alOir = useRef(() => {})
  // Lo que mide el panel de abajo, para poner los botones del mapa 12 por encima (y la atribución, 4).
  const panel = useRef(null)
  const [panelAlto, setPanelAlto] = useState(0)
  useLayoutEffect(() => {   // antes de pintar: los botones salen ya encima del panel y no saltan
    const el = panel.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const medir = () => setPanelAlto(el.offsetHeight)
    const vigia = new ResizeObserver(medir)
    vigia.observe(el)
    medir()
    return () => vigia.disconnect()
  }, [])
  const alAlto = useRef(onAlto)
  alAlto.current = onAlto
  useEffect(() => { alAlto.current?.(panelAlto) }, [panelAlto])
  useEffect(() => () => alAlto.current?.(0), [])
  // Escucha mientras está activado; Chrome corta tras un silencio, así que se vuelve a arrancar.
  useEffect(() => {
    try { localStorage.setItem('guia_manos', manos ? '1' : '0') } catch { /* nada */ }
    if (!manos || !Reconocedor) return undefined
    let vivo = true
    let r = null
    const arrancar = () => {
      if (!vivo) return
      try {
        r = new Reconocedor()
        r.lang = locale()
        r.continuous = true
        r.interimResults = false
        r.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) alOir.current(e.results[i][0].transcript)
        }
        r.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            vivo = false; setManos(false); setAvisoManos(tx('Dale permiso al micrófono para usar manos libres.'))
          }
        }
        r.onend = () => { if (vivo) setTimeout(arrancar, 400) }
        r.start()
      } catch { /* ya estaba escuchando */ }
    }
    arrancar()
    return () => { vivo = false; try { r?.abort() } catch { /* nada */ } }
  }, [manos])
  // Vista la explicación larga una vez con el micro encendido, la próxima vez solo sale la píldora «Escuchando».
  useEffect(() => { if (manos && ayudaManos) try { localStorage.setItem('guia_manos_ayuda', '1') } catch { /* nada */ } }, [manos, ayudaManos])
  useEffect(() => { try { localStorage.setItem('guia_voz', voz ? '1' : '0') } catch { /* nada */ } if (!voz) try { window.speechSynthesis?.cancel() } catch { /* nada */ } }, [voz])

  // La posición, mientras esta pantalla está abierta. Y la pantalla encendida.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setErrPos(tx('Este móvil no da la ubicación.')); return undefined }
    let anterior = null
    let rumboUltimo = null
    const id = navigator.geolocation.watchPosition((g) => {
      const p = [g.coords.latitude, g.coords.longitude]
      if (Number.isFinite(g.coords.heading) && (g.coords.speed || 0) > 1) rumboUltimo = g.coords.heading
      else if (anterior && metrosEntre(anterior, p) > 4) rumboUltimo = rumboEntre(anterior, p)
      if (!anterior || metrosEntre(anterior, p) > 4) anterior = p
      setErrPos('')
      setPos({ p, rumbo: rumboUltimo })
    }, (e) => setErrPos(e.code === 1 ? tx('Dale permiso de ubicación a la app para que te guíe.') : tx('No llega la ubicación del móvil.')),
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
      if (!recalculo) habla(`${tx('Vamos a {destino}.', { destino: p.cliente || tx('la siguiente parada') })} ${distanciaHablada(data.metros || 0, tx)}.`)
      else habla(tx('Ruta recalculada.'))
    } catch (e) {
      setErrGuia(txError(e, 'No se pudo calcular la ruta'))
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
      onLlegar?.(parada)
      habla(`${tx('Has llegado a {destino}.', { destino: parada.cliente || tx('la parada') })}${parada.hueco ? ` ${tx('Va {sitio}.', { sitio: tx(parada.hueco).replace('·', '') })}` : ''}`)
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
      const frase = textoPaso(paso, tx)
      habla(tx('En {distancia}, {accion}.', { distancia: distanciaHablada(Math.round(falta / 50) * 50, tx), accion: frase.charAt(0).toLowerCase() + frase.slice(1) }))
    } else if (falta <= 50 && !dichos.current.has(`${clave}:cerca`)) {
      dichos.current.add(`${clave}:cerca`)
      habla(`${textoPaso(paso, tx)}.`)
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

  // Lo que hace cada orden de voz (con lo que hay en pantalla ahora mismo).
  alOir.current = (texto) => {
    try { if (window.speechSynthesis?.speaking) return } catch { /* nada */ }
    if (Date.now() - ultimaOrden.current < 2500) return
    const orden = ordenDeVoz(texto, idioma())
    if (!orden) return
    ultimaOrden.current = Date.now()
    setOido(texto)
    if (orden === 'silencio') { setVoz(false); return }
    if (orden === 'voz') { setVoz(true); return }
    if (orden === 'repite') { if (paso) decir(`${textoPaso(paso, tx)}.`); return }
    if (orden === 'deshacer') { if (onDeshacer) { onDeshacer(); habla(tx('Deshecho.')) } return }
    if (!parada) return
    if (orden === 'llegado') { setLlegado(parada.id); onLlegar?.(parada); habla(tx('Has llegado')); return }
    if (orden === 'entregado') { (onEntregarVoz || onEntregar)(parada); habla(tx('Hecho. Si no era, di «deshacer».')); return }
    if (orden === 'no_entregado') { onNoEntregar(parada); return }
    if (orden === 'llamar') {
      if (parada.telefono) window.location.href = `tel:${parada.telefono}`
      else habla(tx('Esta parada no tiene teléfono.'))
    }
  }
  const flecha = guia?.fuente === 'linea_recta' && pos && parada ? rumboEntre(pos.p, [parada.lat, parada.lng]) : null

  // Las notas de la parada en una línea («Cobrar 24,50 € · 📦 Detrás · izq · 💬 No estará…»): el dato con su icono, y lo
  // que iba delante («Búscalo:», «El cliente dice:») solo para el lector de pantalla. Lo que se cobra va primero, que la
  // línea se corta por el final.
  const dice = parada ? textoClienteDice(parada.cliente_dice) : ''
  const antes = parada ? textoAntes(parada.antes) : ''
  const notas = !parada ? [] : [
    parada.cobrar > 0 && { icono: Banknote, texto: `${tx('Cobrar')} ${importe(parada.cobrar)}` },
    parada.hueco && { icono: Package, prefijo: tx('Búscalo: {sitio}', { sitio: '' }), texto: tx(parada.hueco) },
    parada.bultos > 1 && { texto: tx('{n} bultos', { n: parada.bultos }) },
    (parada.notas || parada.contenido) && { icono: StickyNote, texto: [parada.contenido, parada.notas].filter(Boolean).join(' · ') },
    dice && { icono: MessageSquareText, prefijo: `${tx('El cliente dice')}: `, texto: dice },
    antes && { icono: History, texto: antes },
  ].filter(Boolean)
  const instruccion = 'line-clamp-2 text-nombre'

  return (
    <div className="fixed inset-0 z-[45] bg-dark-950" role="dialog" aria-modal="true" aria-label={tx('Navegación')}>
      <MapaGuia linea={lista ? guia.prep.linea : null} yo={pos?.p} rumbo={pos?.rumbo}
        destino={parada ? [parada.lat, parada.lng] : null} numero={numero} seguir={seguir} onMover={() => setSeguir(false)} />
      {/* La atribución del mapa, justo encima del panel (Leaflet la ponía debajo de él). */}
      <div className="pointer-events-none absolute inset-x-0 h-0" style={{ bottom: panelAlto }}>
        <Atribucion texto="© OpenStreetMap" className="!left-1 !right-auto" />
      </div>

      {/* ARRIBA: la próxima maniobra, en grande (icono 40, la distancia en «guia», la instrucción en dos líneas). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        {!parada ? null : errPos ? (
          <Banda tono="ambar"><MapPin size={40} className="shrink-0" /><LetraMax base={16} max={18} className={instruccion}>{errPos}</LetraMax></Banda>
        ) : !lista ? (
          <Banda><Loader2 size={40} className="shrink-0 animate-spin" /><LetraMax base={16} max={18} className={instruccion}>{errGuia || tx('Calculando la ruta…')}</LetraMax></Banda>
        ) : haLlegado ? (
          <Banda><Flag size={40} className="shrink-0" /><span className="text-titulo">{tx('Has llegado')}</span></Banda>
        ) : guia.fuente === 'linea_recta' ? (
          <Banda tono="ambar">
            <Navigation size={40} className="shrink-0" style={{ transform: `rotate(${flecha ?? 0}deg)` }} />
            <span className="min-w-0 flex-1">
              <b className="block text-guia tabular-nums">{textoDistancia(restante)}</b>
              <LetraMax base={16} max={18} className={instruccion}>{tx('Sigue la flecha')}</LetraMax>
            </span>
          </Banda>
        ) : (
          <Banda>
            <Icono size={40} strokeWidth={2.6} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="block text-guia tabular-nums" data-testid="guia-distancia">{textoDistancia(falta)}</b>
              <LetraMax base={16} max={18} className={instruccion} data-testid="guia-texto">{paso?.icono === 'llegada' ? tx('Llegas a tu parada') : textoPaso(paso, tx)}</LetraMax>
              {luego && luego.icono !== 'llegada' && (
                <LetraMax base={12} max={14} className="mt-0.5 block truncate text-sec">
                  {tx('Luego')} {(() => { const I = ICONOS[luego.icono] || ArrowUp; return <I size={14} className="inline-block align-text-bottom" aria-hidden="true" /> })()} {textoPaso(luego, tx)}
                </LetraMax>
              )}
            </span>
          </Banda>
        )}
        {pidiendo && lista && <Pastilla className="pointer-events-auto mt-2" role="status" texto={tx('Recalculando…')} />}
        {avisoManos ? (
          <div className="pointer-events-auto mt-2 max-w-sm rounded-xl bg-dark-900 p-3 text-texto text-dark-50 shadow-md" role="status">{avisoManos}</div>
        ) : manos && ayudaManos ? (
          <div className="pointer-events-auto mt-2 max-w-sm rounded-xl bg-dark-900 p-3 text-texto text-dark-50 shadow-md" role="status">
            <b className="text-ruta-ok-texto"><Mic size={16} className="mr-1 inline-block align-text-bottom" aria-hidden="true" />{tx('Manos libres')}</b> · {tx('Di «entregado», «no entregado», «he llegado», «llamar» o «repite»')}
            {oido && <span className="mt-0.5 block text-dark-400">{tx('Entendido: «{texto}»', { texto: oido })}</span>}
            <span className="mt-0.5 block text-sec text-dark-400">{tx('Para entenderte, el móvil usa su reconocimiento de voz (en Android, el de Google).')}</span>
          </div>
        ) : manos ? (
          <Pastilla className="pointer-events-auto mt-2" tono="ok" icono={Mic} role="status"
            texto={oido ? `${tx('Escuchando')} · ${tx('Entendido: «{texto}»', { texto: oido })}` : tx('Escuchando')} />
        ) : null}
      </div>

      {/* LOS BOTONES SOBRE EL MAPA: en columna a la derecha, 12 por encima del panel. */}
      <div data-testid="guia-botones" className="absolute right-3 z-10 flex flex-col gap-2" style={{ bottom: panelAlto + 12 }}>
        <BotonMapa icono={voz ? Volume2 : VolumeX} nombre={voz ? tx('Silenciar la voz') : tx('Activar la voz')} onClick={() => setVoz((v) => !v)} />
        {parada && !haLlegado && <BotonMapa icono={Navigation} nombre={nombreFuera} href={enlaceFuera(parada)} target="_blank" rel="noreferrer" />}
        {Reconocedor && ORDENES[idioma()] && (
          <BotonMapa icono={manos ? Mic : MicOff} activo={manos} nombre={manos ? tx('Quitar manos libres') : tx('Manos libres')}
            onClick={() => { setAvisoManos(''); setOido(''); setManos((m) => !m) }} />
        )}
        {!seguir && <BotonMapa icono={LocateFixed} nombre={tx('Seguirme')} onClick={() => setSeguir(true)} />}
      </div>

      {/* ABAJO: el panel de la parada (radio 16 arriba, relleno 12), o al llegar, entregar. */}
      <div ref={panel} data-testid="guia-panel" className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-dark-900 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-md">
        {!parada ? (
          <div className="text-center">
            <p className="text-titulo text-dark-50">{tx('No quedan paradas')}</p>
            <p className="mt-1 text-sec text-dark-400">{tx('Ruta terminada. Buen trabajo.')}</p>
            <Boton variante="principal" className="mt-4 w-full" texto={tx('Volver a la ruta')} onClick={onSalir} />
          </div>
        ) : (
          <>
            {haLlegado && (
              <p className="mb-1 text-etiqueta text-ruta-ok-texto">{tx('Parada {n}', { n: numero })}{quedan > 1 ? ` · ${tx('quedan {n}', { n: quedan })}` : ''}</p>
            )}
            <div className="flex items-center gap-2">
              <NumeroParada n={numero} tam="siguiente" estado="siguiente" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-nombre text-dark-50">{parada.cliente || parada.direccion || tx('Cliente')}</p>
                {parada.cliente && parada.direccion && <p className="truncate text-sec text-dark-400">{parada.direccion}</p>}
              </div>
              {parada.telefono && <Boton variante="icono" tono="neutro" icono={Phone} nombre={tx('Llamar')} href={`tel:${parada.telefono}`} />}
              <Boton variante="icono" tono="neutro" icono={X} nombre={tx('Salir de la navegación')} onClick={onSalir} />
            </div>
            {!haLlegado && lista && (
              <p className="mt-1 text-texto tabular-nums text-dark-200">
                {minRest != null && <>{tx('Llegas')} <b className="text-ruta-ok-texto">≈ {horaMas(minRest)}</b> · </>}{textoDistancia(restante)}
                {minRest != null && <> · {Math.max(1, Math.round(minRest))} min</>}
              </p>
            )}
            {notas.length > 0 && (
              <p data-testid="guia-notas" className="mt-1 truncate text-texto text-dark-200" title={notas.map((n) => `${n.prefijo || ''}${n.texto}`).join(' · ')}>
                {notas.map((n, i) => (
                  <span key={n.texto}>
                    {i > 0 && ' · '}
                    {icono(n.icono, 14, 'mr-1 inline-block align-text-bottom')}
                    {n.prefijo && <span className="sr-only">{n.prefijo}</span>}
                    {n.texto}
                  </span>
                ))}
              </p>
            )}
            {haLlegado ? (
              <FilaCierre className="mt-2" recogida={parada.tipo === 'recogida'} onFallar={() => onNoEntregar(parada)} onEntregar={() => onEntregar(parada)} />
            ) : (
              <>
                <Boton variante="normal" contorno tono="ok" icono={Flag} className="mt-2 w-full" texto={tx('Ya he llegado')}
                  onClick={() => { setLlegado(parada.id); onLlegar?.(parada); if (navigator.vibrate) navigator.vibrate(60) }} />
                {/* Se queda aquí (en «pie») mientras la ficha de datos de Play y REVISION_LEGAL.md no digan lo de la guía (§8, riesgo 16). */}
                <p className="mt-2 text-center text-pie text-dark-400">{tx('Tu ubicación se usa para guiarte y no se guarda.')}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* La banda de la maniobra: radio 16, relleno 12, en «guia» (#047857 = ruta-ok) o «guiaAviso» (#B45309 = amber-700) si
   falta algo; flota sobre el mapa, así que lleva sombra. */
function Banda({ children, tono }) {
  return (
    <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl p-3 text-white shadow-md ${tono === 'ambar' ? 'bg-amber-700' : 'bg-ruta-ok'}`}>
      {children}
    </div>
  )
}

/* El mapa de la guía: te sigue (si no lo mueves con el dedo), la ruta en
   azul gruesa como un navegador, tu flecha girada hacia donde vas y la
   parada con su número. Norte arriba: Leaflet no gira el mapa. La atribución
   la pinta Navegacion con la pieza Atribucion, encima del panel. */
function MapaGuia({ linea, yo, rumbo, destino, numero, seguir, onMover }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const capas = useRef({})
  const avisa = useRef(onMover)
  avisa.current = onMover
  const yoAhora = useRef(yo)
  yoAhora.current = yo

  useEffect(() => {
    const m = L.map(caja.current, { zoomControl: false, attributionControl: false }).setView(destino || [40.4, -3.7], destino ? 16 : 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    m.on('dragstart', () => avisa.current())
    mapa.current = m
    const vigia = new ResizeObserver(() => m.invalidateSize())
    vigia.observe(caja.current)
    return () => {
      vigia.disconnect()
      // Un zoom animado a medias (250 ms) fallaba con el mapa ya quitado («_leaflet_pos» de Leaflet 1.9): desde el
      // 02-11-2026 la guía se cierra sola si la siguiente parada no está situada, a veces justo al acercar. Se termina antes.
      try { if (m._animatingZoom) m._onZoomTransitionEnd() } catch { /* nada */ }
      m.remove(); mapa.current = null; capas.current = {}
    }
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
      // Sin ubicación todavía (sin permiso o sin GPS) nada mueve el mapa: al pasar a la
      // siguiente parada se quedaba en la anterior y la nueva caía fuera de la pantalla.
      if (!yoAhora.current) m.setView(destino, Math.max(m.getZoom(), 16), { animate: true })
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
