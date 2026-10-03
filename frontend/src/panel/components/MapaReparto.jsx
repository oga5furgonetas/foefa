import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

export default function MapaReparto({ paradas = [], base = null, vivos = [], alto = 380 }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const capa = useRef(null)
  const encuadre = useRef([])

  useEffect(() => {
    if (!caja.current || mapa.current) return undefined
    mapa.current = L.map(caja.current, { zoomControl: true, attributionControl: true })
      .setView([40.4, -3.7], 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(mapa.current)
    capa.current = L.layerGroup().addTo(mapa.current)
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
      const icono = L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:12px;background:${hecho ? '#94a3b8' : color};color:#fff;font:700 11px/24px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${esc(p.etiqueta ?? '')}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      })
      L.marker([p.lat, p.lng], { icon: icono })
        .bindTooltip(`${esc(p.titulo || '')}${p.sub ? `<br>${esc(p.sub)}` : ''}`)
        .addTo(capa.current)
      puntos.push([p.lat, p.lng])
      if (!hecho) (porConductor[color] ||= []).push([p.orden ?? 9999, [p.lat, p.lng]])
    })
    Object.entries(porConductor).forEach(([color, lista]) => {
      const linea = lista.sort((a, b) => a[0] - b[0]).map((x) => x[1])
      if (base?.lat != null) linea.unshift([base.lat, base.lng])
      if (linea.length > 1) L.polyline(linea, { color, weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(capa.current)
    })
    vivos.forEach((v) => {
      if (v.lat == null) return
      L.circleMarker([v.lat, v.lng], { radius: 11, color: v.color || '#0ea5e9', weight: 4, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(`${esc(v.nombre)} · ahora`, { permanent: true, direction: 'top', offset: [0, -10] })
        .addTo(capa.current)
      puntos.push([v.lat, v.lng])
    })
    encuadre.current = puntos
    encuadrar(m, puntos)
  }, [paradas, base, vivos])

  // `isolate`: Leaflet pone sus capas con z-index 400-1000 y, sin un contexto
  // propio, el mapa se pintaba ENCIMA de las ventanas emergentes de la página.
  return <div ref={caja} style={{ height: alto }} className="isolate w-full overflow-hidden rounded-xl border border-dark-700" />
}
