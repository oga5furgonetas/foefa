import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, LocateFixed } from 'lucide-react'
import { tx } from '../../lib/idioma'

/* EL MAPA DEL REPARTO. Puntos dibujados (círculos y etiquetas), no los
   iconos de Leaflet: esos son imágenes que el empaquetador no encuentra y
   salían como cuadrados rotos. Cada conductor con su color; el almacén en
   negro; los conductores en directo con un anillo. */

const COLORES = ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#ec4899']
export const colorConductor = (i) => COLORES[((i % COLORES.length) + COLORES.length) % COLORES.length]

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c])

function encuadrar(m, puntos) {
  if (puntos.length === 1) m.setView(puntos[0], 14)
  else if (puntos.length > 1) m.fitBounds(puntos, { padding: [30, 30], maxZoom: 16 })
}

/* `trazado`: el camino por las calles ({linea:[[lat,lng]…], fuente}); con él
   no se pintan las rayas discontinuas de punto a punto. `yo`: dónde está el
   móvil ahora (solo se pinta aquí, no se envía). Una parada con `grande` es
   la siguiente: más grande y con anillo. `zonas`: las de carga y descarga
   (13-10-2026), un cuadradito morado «C/D» que no cuenta para encuadrar. */
export default function MapaReparto({ paradas = [], base = null, vivos = [], alto = 380, trazado = null, yo = null, zonas = [] }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const capa = useRef(null)
  const encuadre = useRef([])
  const capaYo = useRef(null)
  const capaZonas = useRef(null)
  const yoRef = useRef(yo)
  const [seguir, setSeguir] = useState(false)
  const seguirRef = useRef(false)
  yoRef.current = yo
  seguirRef.current = seguir

  useEffect(() => {
    if (!caja.current || mapa.current) return undefined
    mapa.current = L.map(caja.current, { zoomControl: true, attributionControl: true })
      .setView([40.4, -3.7], 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(mapa.current)
    capa.current = L.layerGroup().addTo(mapa.current)
    capaZonas.current = L.layerGroup().addTo(mapa.current)
    capaYo.current = L.layerGroup().addTo(mapa.current)
    // Si la caja cambia de tamaño tras crear el mapa (la página aún se estaba
    // montando), Leaflet solo pinta la franja que medía al principio: visto el
    // 03-10-2026 en producción, un tercio del mapa en gris.
    const vigia = new ResizeObserver(() => {
      if (!mapa.current) return
      mapa.current.invalidateSize()
      encuadrar(mapa.current, encuadre.current)
    })
    vigia.observe(caja.current)
    return () => { vigia.disconnect(); mapa.current?.remove(); mapa.current = null }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capa.current.clearLayers()
    const puntos = []
    if (base?.lat != null) {
      L.circleMarker([base.lat, base.lng], { radius: 9, color: '#0f172a', fillColor: '#0f172a', fillOpacity: 1 })
        .bindTooltip('Almacén').addTo(capa.current)
      puntos.push([base.lat, base.lng])
    }
    const porConductor = {}
    paradas.forEach((p) => {
      if (p.lat == null || p.lng == null) return
      const color = p.color || '#64748b'
      const hecho = p.estado === 'entregado' || p.estado === 'fallido'
      const t = p.grande ? 34 : 24
      const icono = L.divIcon({
        className: '',
        html: `<div style="width:${t}px;height:${t}px;border-radius:${t / 2}px;background:${hecho ? '#94a3b8' : color};color:#fff;font:700 ${p.grande ? 14 : 11}px/${t}px system-ui;text-align:center;border:${p.grande ? 3 : 2}px solid #fff;box-shadow:${p.grande ? `0 0 0 4px ${color}55,` : ''}0 1px 3px rgba(0,0,0,.4)">${hecho ? '✓' : esc(p.etiqueta ?? '')}</div>`,
        iconSize: [t, t], iconAnchor: [t / 2, t / 2],
      })
      L.marker([p.lat, p.lng], { icon: icono, zIndexOffset: p.grande ? 1000 : hecho ? -500 : 0 })
        .bindTooltip(`${esc(p.titulo || '')}${p.sub ? `<br>${esc(p.sub)}` : ''}`)
        .addTo(capa.current)
      puntos.push([p.lat, p.lng])
      if (!hecho) (porConductor[color] ||= []).push([p.orden ?? 9999, [p.lat, p.lng]])
    })
    const conCalles = trazado?.fuente === 'carreteras' && trazado.linea?.length > 1
    if (conCalles) {
      // Como un navegador: borde blanco y línea gruesa encima, por debajo de las paradas.
      L.polyline(trazado.linea, { color: '#ffffff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capa.current)
      L.polyline(trazado.linea, { color: '#0284c7', weight: 5.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capa.current)
    } else {
      Object.entries(porConductor).forEach(([color, lista]) => {
        const linea = lista.sort((a, b) => a[0] - b[0]).map((x) => x[1])
        if (yoRef.current?.lat != null) linea.unshift([yoRef.current.lat, yoRef.current.lng])
        else if (base?.lat != null) linea.unshift([base.lat, base.lng])
        if (linea.length > 1) L.polyline(linea, { color, weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(capa.current)
      })
    }
    if (yoRef.current?.lat != null) puntos.push([yoRef.current.lat, yoRef.current.lng])
    vivos.forEach((v) => {
      if (v.lat == null) return
      L.circleMarker([v.lat, v.lng], { radius: 11, color: v.color || '#0ea5e9', weight: 4, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(`${esc(v.nombre)} · ahora`, { permanent: true, direction: 'top', offset: [0, -10] })
        .addTo(capa.current)
      puntos.push([v.lat, v.lng])
    })
    encuadre.current = puntos
    if (!seguirRef.current) encuadrar(m, puntos)
  }, [paradas, base, vivos, trazado])

  useEffect(() => {
    if (!mapa.current || !capaZonas.current) return
    capaZonas.current.clearLayers()
    zonas.forEach((z) => {
      const icono = L.divIcon({
        className: '',
        html: '<div style="width:26px;height:18px;border-radius:4px;background:#7c3aed;color:#fff;font:800 9px/18px system-ui;text-align:center;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">C/D</div>',
        iconSize: [26, 18], iconAnchor: [13, 9],
      })
      const detalle = [z.calle, z.horario, z.maximo && `${tx('máx.')} ${z.maximo}`].filter(Boolean).map(esc).join(' · ')
      L.marker([z.lat, z.lng], { icon: icono, zIndexOffset: -800 })
        .bindTooltip(`${esc(tx('Carga y descarga'))}${detalle ? `<br>${detalle}` : ''}`)
        .addTo(capaZonas.current)
    })
  }, [zonas])

  // El punto azul se mueve solo (sin recolocar el mapa mientras lo exploras);
  // con «Seguirme» el mapa va detrás de él.
  useEffect(() => {
    const m = mapa.current
    if (!m || !capaYo.current) return
    capaYo.current.clearLayers()
    if (yo?.lat == null) return
    L.circleMarker([yo.lat, yo.lng], { radius: 14, stroke: false, fillColor: '#3b82f6', fillOpacity: 0.2, interactive: false }).addTo(capaYo.current)
    L.circleMarker([yo.lat, yo.lng], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
      .bindTooltip('Estás aquí').addTo(capaYo.current)
    if (seguir) m.setView([yo.lat, yo.lng], Math.max(m.getZoom(), 16), { animate: true })
  }, [yo, seguir])

  // `isolate`: Leaflet pone sus capas con z-index 400-1000 y, sin un contexto
  // propio, el mapa se pintaba ENCIMA de las ventanas emergentes de la página.
  return (
    <div className="relative isolate">
      <div ref={caja} style={{ height: alto }} className="w-full overflow-hidden rounded-xl border border-dark-700" />
      {/* Tras mover o ampliar el mapa, un toque lo devuelve a la ruta entera. */}
      <div className="absolute bottom-7 right-2.5 z-[1100] flex flex-col gap-2">
        {yo?.lat != null && (
          <button type="button" onClick={() => setSeguir((v) => !v)} aria-pressed={seguir} aria-label={tx('Seguirme')}
            className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg active:scale-95 ${seguir ? 'border-sky-600 bg-sky-600 text-white' : 'border-dark-700 bg-white text-slate-700'}`}>
            <LocateFixed size={19} />
          </button>
        )}
        <button type="button" onClick={() => { setSeguir(false); encuadrar(mapa.current, encuadre.current) }} aria-label={tx('Centrar la ruta')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-dark-700 bg-white text-slate-700 shadow-lg active:scale-95">
          <Crosshair size={19} />
        </button>
      </div>
    </div>
  )
}
