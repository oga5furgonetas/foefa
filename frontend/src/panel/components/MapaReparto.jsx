import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, LocateFixed } from 'lucide-react'
import { tx, useIdioma } from '../../lib/idioma'

/* EL MAPA DEL REPARTO. Puntos dibujados (SVG en línea), no los iconos de Leaflet: esos son imágenes que el
   empaquetador no encuentra y salían como cuadrados rotos. Cada conductor con su color; el almacén en negro; los
   conductores en directo con un anillo.

   LOS ICONOS Y LO QUE SE TOCA (30-10-2026, «mejora los emoticonos e interacciones con el mapa»): todo dibujado en
   vectores, los mismos que la app nativa (app-android …/ui/hoy/MapaRuta.kt), y nada de emojis: cada móvil pinta el
   suyo y en Windows la furgoneta salía como un juguete. Cada cosa con su forma, no solo con su color: la parada es
   una chincheta con el número (la siguiente, más grande y latiendo; hecha, un círculo con ✓ o ✕; borde morado si
   cae en una ZBE; un globo verde si el cliente contestó), la carretera cortada un disco rojo con la barra, las obras
   un rombo ámbar, la retención un coche, el tiempo una nube, la furgoneta una furgoneta y el almacén una nave.
   Tocar cualquier cosa abre una ventana con lo que es y, en la app del repartidor (`onAccion`), con qué hacer: ir,
   llamar, abrir la parada; volver a pie a la furgoneta o quitarla. Mantener pulsado el mapa deja la furgoneta ahí.
   Arriba a la derecha, las capas (C/D, DGT, ZBE) se apagan y encienden. */

const COLORES = ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#ec4899']
export const colorConductor = (i) => COLORES[((i % COLORES.length) + COLORES.length) % COLORES.length]

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c])

const SOMBRA = 'overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))'
const COLOR_INC = { corte: '#dc2626', accidente: '#dc2626', retencion: '#ea580c', obras: '#f59e0b', obstaculo: '#f59e0b', meteo: '#0369a1', aviso: '#475569', otro: '#475569' }
// El «!» de un triángulo (más abajo, donde hay sitio) y el de un rombo o disco (centrado).
const EXCL_TRI = (c) => `<rect x="12.6" y="10" width="2.8" height="7.6" rx="1.3" fill="${c}"/><circle cx="14" cy="21" r="1.7" fill="${c}"/>`
const EXCL = (c) => `<rect x="12.6" y="7.6" width="2.8" height="8.6" rx="1.3" fill="${c}"/><circle cx="14" cy="19.6" r="1.7" fill="${c}"/>`

/* La forma de cada incidencia de la DGT: se sabe qué es aunque no se lea el texto. */
function svgIncidencia(clase) {
  const c = COLOR_INC[clase] || COLOR_INC.otro
  const b = 'stroke="#fff" stroke-width="2" stroke-linejoin="round"'
  let dentro
  switch (clase) {
    case 'corte':
      dentro = `<circle cx="14" cy="14" r="12" fill="${c}" ${b}/><rect x="6.5" y="12.2" width="15" height="3.6" rx="1.3" fill="#fff"/>`; break
    case 'accidente':
      dentro = `<path d="M14 2.6 26.4 24.6H1.6z" fill="${c}" ${b}/>${EXCL_TRI('#fff')}`; break
    case 'obstaculo':
      dentro = `<path d="M14 2.6 26.4 24.6H1.6z" fill="${c}" ${b}/>${EXCL_TRI('#1f2937')}`; break
    case 'obras':
      dentro = `<path d="M14 1.8 26.2 14 14 26.2 1.8 14z" fill="${c}" ${b}/>${EXCL('#1f2937')}`; break
    case 'retencion':
      dentro = `<rect x="2" y="2" width="24" height="24" rx="6" fill="${c}" ${b}/><path d="M6.5 19.5v-5l2-5h11l2 5v5z" fill="#fff"/><path d="M9.6 14.3l1.2-3.3h6.4l1.2 3.3z" fill="${c}"/><circle cx="10" cy="19.8" r="2.1" fill="#fff" stroke="${c}" stroke-width="1.2"/><circle cx="18" cy="19.8" r="2.1" fill="#fff" stroke="${c}" stroke-width="1.2"/>`; break
    case 'meteo':
      dentro = `<circle cx="14" cy="14" r="12" fill="${c}" ${b}/><path d="M9.2 16.8h9.6a3.1 3.1 0 0 0 .3-6.2 4.6 4.6 0 0 0-8.8-1A3.6 3.6 0 0 0 9.2 16.8z" fill="#fff"/><path d="M10.6 19.4l-.9 2M14.2 19.4l-.9 2M17.8 19.4l-.9 2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`; break
    default:
      dentro = `<circle cx="14" cy="14" r="12" fill="${c}" ${b}/><circle cx="14" cy="8.6" r="1.7" fill="#fff"/><rect x="12.6" y="11.6" width="2.8" height="9" rx="1.3" fill="#fff"/>`
  }
  return `<svg viewBox="0 0 28 28" width="28" height="28" style="${SOMBRA}">${dentro}</svg>`
}

/* La chincheta de una parada con su número. `s` la escala (la siguiente va a 1,25); `zbe` borde morado; `dice` el
   globo verde de «el cliente ha contestado». */
function svgPin(etiqueta, color, { s = 1, zbe = false, dice = false } = {}) {
  const n = String(etiqueta ?? '')
  const largo = n.length > 2
  return `<svg viewBox="0 0 36 44" width="${Math.round(36 * s)}" height="${Math.round(44 * s)}" style="${SOMBRA}">` +
    `<path d="M18 42 6.74 22.5A13 13 0 1 1 29.26 22.5Z" fill="${color}" stroke="${zbe ? '#7c3aed' : '#fff'}" stroke-width="${zbe ? 2.8 : 2.2}" stroke-linejoin="round"/>` +
    `<text x="18" y="${largo ? 19.8 : 20.6}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${largo ? 10.5 : 13}" fill="#fff">${esc(n)}</text>` +
    (dice ? '<circle cx="30" cy="7" r="6" fill="#059669" stroke="#fff" stroke-width="1.6"/><circle cx="27.3" cy="7" r="1.05" fill="#fff"/><circle cx="30" cy="7" r="1.05" fill="#fff"/><circle cx="32.7" cy="7" r="1.05" fill="#fff"/>' : '') +
    '</svg>'
}

/* Una parada hecha: círculo verde con ✓ (entregada) o rojo con ✕ (no se pudo). */
function svgHecho(fallido) {
  const c = fallido ? '#dc2626' : '#16a34a'
  const glifo = fallido
    ? '<path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
    : '<path d="M7.2 12.4l3.2 3.2L17 9.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  return `<svg viewBox="0 0 24 24" width="22" height="22" style="${SOMBRA}"><circle cx="12" cy="12" r="10.4" fill="${c}" fill-opacity=".85" stroke="#fff" stroke-width="2"/>${glifo}</svg>`
}

const SVG_FURGO = `<svg viewBox="0 0 32 32" width="32" height="32" style="${SOMBRA}"><rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#0f172a" stroke="#fff" stroke-width="2"/><path d="M5 21v-8.5A1.5 1.5 0 0 1 6.5 11H18l4.6 4.6H26a1.5 1.5 0 0 1 1.5 1.5V21z" fill="#fff"/><path d="M15 13.2h2.6l2.8 2.8H15z" fill="#0f172a"/><circle cx="10" cy="21.3" r="2.5" fill="#0f172a" stroke="#fff" stroke-width="1.8"/><circle cx="22.5" cy="21.3" r="2.5" fill="#0f172a" stroke="#fff" stroke-width="1.8"/></svg>`
const SVG_BASE = `<svg viewBox="0 0 30 30" width="30" height="30" style="${SOMBRA}"><rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0f172a" stroke="#fff" stroke-width="2"/><path d="M6.5 14.5 15 7.5l8.5 7V23h-17z" fill="#fff"/><rect x="13" y="17" width="4" height="6" fill="#0f172a"/></svg>`

// La ventana se aparta del control del zoom (arriba a la izquierda) y de los botones de la derecha.
const POP = { className: 'fds-pop', maxWidth: 270, minWidth: 190, autoPanPaddingTopLeft: [58, 16], autoPanPaddingBottomRight: [16, 16] }
const km = (n) => String(n).replace('.', ',')
const fecha = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }) }
const chip = (texto, fondo, tinta) => `<span style="background:${fondo};color:${tinta}">${esc(texto)}</span>`
const acciones = (lista) => `<div class="fds-acc">${lista.filter(Boolean).join('')}</div>`
const boton = (accion, texto, clase = '') => `<button type="button" class="${clase}" data-accion="${accion}">${esc(texto)}</button>`
const enlace = (href, texto, clase = '', accion = '') => `<a href="${esc(href)}" class="${clase}"${accion ? ` data-accion="${accion}"` : ' target="_blank" rel="noreferrer"'}>${esc(texto)}</a>`

function popupParada(p, hecho, conAcciones) {
  const chips = []
  if (p.zbe) chips.push(chip('ZBE', '#ede9fe', '#6d28d9'))
  if (p.puerta) chips.push(chip(tx('Puerta conocida'), '#d1fae5', '#065f46'))
  if (p.tipo === 'recogida') chips.push(chip(tx('RECOGIDA'), '#ede9fe', '#6d28d9'))
  if (p.cobrar) chips.push(chip(`${tx('COBRAR')} ${p.cobrar}`, '#d1fae5', '#065f46'))
  if (p.prioridad) chips.push(chip(tx('URGENTE'), '#fef3c7', '#92400e'))
  const estado = hecho ? `<div class="fds-sub">${esc(p.estado === 'fallido' ? tx('No entregado') : tx('Entregado'))}${p.motivo ? ` · ${esc(p.motivo)}` : ''}</div>` : ''
  return `<b>${esc(p.etiqueta ?? '')}${p.etiqueta != null ? ' · ' : ''}${esc(p.titulo || '')}</b>` +
    (p.sub ? `<div class="fds-sub">${esc(p.sub)}</div>` : '') + estado +
    (chips.length ? `<div class="fds-chips">${chips.join('')}</div>` : '') +
    (p.dice ? `<div class="fds-dice"><b>${esc(tx('El cliente dice'))}:</b> ${esc(p.dice)}</div>` : '') +
    (conAcciones ? acciones([
      !hecho && boton('navegar', tx('Ir'), 'fds-ir'),
      !hecho && p.telefono && enlace(`tel:${p.telefono}`, tx('Llamar'), '', 'llamar'),
      boton('abrir', tx('Abrir')),
    ]) : '')
}

function popupIncidencia(i) {
  const sitio = [i.carretera, i.pk && `${tx('pk')} ${i.pk}`, i.municipio].filter(Boolean).join(' · ')
  const dist = i.distancia_km != null && (i.parada ? tx('a {km} km de la parada {n}', { km: km(i.distancia_km), n: i.parada }) : tx('a {km} km de tu ruta', { km: km(i.distancia_km) }))
  const desde = i.desde && fecha(i.desde)
  const que = String(i.que || '')
  return `<b>${esc(que.charAt(0).toUpperCase() + que.slice(1))}</b>` +
    [sitio, dist, desde && `${tx('Desde el')} ${desde}`, 'DGT'].filter(Boolean).map((t) => `<div class="fds-sub">${esc(t)}</div>`).join('') +
    acciones([enlace(`https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}`, tx('Ver en Google Maps'), 'fds-ir')])
}

function popupZbe(z) {
  return `<b>ZBE ${esc(z.nombre || '')}</b>` +
    [z.descripcion, z.etiquetas?.length && `${tx('Etiquetas que cita la DGT')}: ${z.etiquetas.join(', ')}`, z.version && `${tx('ZBE según la DGT, a')} ${z.version}`]
      .filter(Boolean).map((t) => `<div class="fds-sub">${esc(t)}</div>`).join('') +
    (z.url ? acciones([enlace(z.url, tx('Más información'), 'fds-ir')]) : '')
}

function popupFurgo(f, yo, conAcciones) {
  const m = yo?.lat != null ? Math.round(metros(yo, f)) : null
  const lejos = m == null ? '' : m < 1000 ? tx('a {m} m', { m }) : tx('a {km} km', { km: km((m / 1000).toFixed(m < 10000 ? 1 : 0)) })
  return `<b>${esc(tx('Tu furgoneta'))}</b>` + (lejos ? `<div class="fds-sub">${esc(lejos)}</div>` : '') +
    acciones([
      enlace(`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}&travelmode=walking`, tx('Volver a pie'), 'fds-ir'),
      conAcciones && boton('quitar_furgo', tx('Quitar'), 'fds-rojo'),
    ])
}

const popupAparcar = () => `<b>${esc(tx('¿Dejar aquí la furgoneta?'))}</b><div class="fds-sub">${esc(tx('Para volver a ella a pie sin dar vueltas.'))}</div>` +
  acciones([boton('aparcar', tx('Aparcada aquí'), 'fds-ir')])

function metros(a, b) {
  const R = 6371000; const r = Math.PI / 180
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r); const y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * R
}
const centroide = (pol) => [pol.reduce((s, p) => s + p[0], 0) / pol.length, pol.reduce((s, p) => s + p[1], 0) / pol.length]

const CSS = `
.fds-pop .leaflet-popup-content-wrapper{border-radius:14px;padding:0;box-shadow:0 8px 28px rgba(0,0,0,.28)}
.fds-pop .leaflet-popup-content{margin:11px 13px 12px;font:13px/1.35 system-ui,sans-serif;color:#0f172a}
.fds-pop .leaflet-popup-content b{font-size:14px}
.fds-pop .fds-sub{color:#475569;margin-top:2px}
.fds-pop .fds-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;font-size:10.5px;font-weight:700}
.fds-pop .fds-chips span{border-radius:5px;padding:1px 6px}
.fds-pop .fds-dice{margin-top:6px;border-radius:9px;background:#ecfdf5;color:#065f46;padding:5px 8px;font-size:12px;line-height:1.3}
.fds-pop .fds-dice b{font-size:12px}
.fds-pop .fds-acc{display:flex;gap:6px;margin-top:10px}
.fds-pop .fds-acc button,.fds-pop .fds-acc a{flex:1;border:0;border-radius:10px;padding:9px 6px;font:700 12.5px system-ui,sans-serif;text-align:center;background:#e2e8f0;color:#0f172a;cursor:pointer;text-decoration:none;white-space:nowrap}
.fds-pop .fds-acc .fds-ir{background:#0284c7;color:#fff}
.fds-pop .fds-acc .fds-rojo{background:#fee2e2;color:#991b1b}
.fds-pop .leaflet-popup-close-button{top:5px;right:7px;font-size:20px;color:#64748b}
.fds-pop .leaflet-popup-tip-container{margin-top:-1px}
@keyframes fds-latido{0%{transform:scale(.55);opacity:.75}100%{transform:scale(2.1);opacity:0}}
.fds-halo{position:absolute;left:50%;width:30px;height:30px;margin-left:-15px;border-radius:50%;animation:fds-latido 1.7s ease-out infinite;pointer-events:none}
`

function encuadrar(m, puntos) {
  if (puntos.length === 1) m.setView(puntos[0], 14)
  else if (puntos.length > 1) m.fitBounds(puntos, { padding: [30, 30], maxZoom: 16 })
}

/* `trazado`: el camino por las calles ({linea:[[lat,lng]…], fuente}); con él no se pintan las rayas discontinuas de
   punto a punto. `yo`: dónde está el móvil ahora (solo se pinta aquí, no se envía). Una parada con `grande` es la
   siguiente: más grande y latiendo. `zonas`: las de carga y descarga (13-10-2026), un cuadradito morado «C/D» que
   no cuenta para encuadrar. `incidencias`: cortes, obras y retenciones de la DGT (30-10-2026); `zbe`: las zonas de
   bajas emisiones que publica la DGT, un polígono morado con la descripción del ayuntamiento; `furgo`: dónde se dejó
   la furgoneta. Ninguna de las tres cuenta para encuadrar. `onAccion(accion, dato)`: lo que se toca en las ventanas
   (navegar | llamar | abrir con la parada; aparcar con {lat,lng}; quitar_furgo); sin ella, las ventanas solo informan. */
export default function MapaReparto({ paradas = [], base = null, vivos = [], alto = 380, trazado = null, yo = null, zonas = [],
  incidencias = [], zbe = [], furgo = null, onAccion = null }) {
  useIdioma()
  const caja = useRef(null)
  const mapa = useRef(null)
  const capa = useRef(null)
  const encuadre = useRef([])
  const capaYo = useRef(null)
  const capaZonas = useRef(null)
  const capaZbe = useRef(null)
  const capaInc = useRef(null)
  const capaFurgo = useRef(null)
  const yoRef = useRef(yo)
  const paradasRef = useRef(paradas)
  const onAccionRef = useRef(onAccion)
  const [seguir, setSeguir] = useState(false)
  const seguirRef = useRef(false)
  const [capas, setCapas] = useState({ cd: true, dgt: true, zbe: true })
  yoRef.current = yo
  paradasRef.current = paradas
  onAccionRef.current = onAccion
  seguirRef.current = seguir
  // Las paradas llegan como un array nuevo en cada pintado: se repintan solo cuando cambia algo de verdad, que si no
  // la ventana abierta se cerraba cada vez que el punto azul se movía.
  const firma = JSON.stringify(paradas)

  useEffect(() => {
    if (!caja.current || mapa.current) return undefined
    const m = L.map(caja.current, { zoomControl: true, attributionControl: true }).setView([40.4, -3.7], 6)
    mapa.current = m
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    capaZbe.current = L.layerGroup().addTo(m)
    capaInc.current = L.layerGroup().addTo(m)
    capa.current = L.layerGroup().addTo(m)
    capaZonas.current = L.layerGroup().addTo(m)
    capaFurgo.current = L.layerGroup().addTo(m)
    capaYo.current = L.layerGroup().addTo(m)
    // Los botones de las ventanas: cada ventana lleva en `fds.dato` de qué va; un enlace (tel:, Google Maps) sigue
    // su camino además de avisar.
    m.on('popupopen', (e) => {
      const el = e.popup?.getElement?.()
      if (!el) return
      el.querySelectorAll('[data-accion]').forEach((b) => {
        b.onclick = (ev) => {
          const esEnlace = !!b.getAttribute('href')
          if (!esEnlace) ev.preventDefault()
          onAccionRef.current?.(b.dataset.accion, e.popup.fds?.dato ?? null)
          if (!esEnlace) m.closePopup()
        }
      })
    })
    // Mantener pulsado deja la furgoneta ahí. Leaflet solo avisa del «contextmenu» (botón derecho, o el dedo quieto
    // en Android), que iOS no manda: se mide también el dedo quieto medio segundo largo, y se descarta el doble.
    let temporizador = null; let origen = null; let ultimo = 0
    const soltar = () => { clearTimeout(temporizador); temporizador = null }
    const aparcarEn = (latlng) => {
      if (!onAccionRef.current || Date.now() - ultimo < 1200) return
      ultimo = Date.now(); m.closePopup()
      const pop = L.popup(POP).setLatLng(latlng).setContent(popupAparcar())
      pop.fds = { dato: { lat: latlng.lat, lng: latlng.lng } }
      pop.openOn(m)
    }
    const el = caja.current
    el.addEventListener('pointerdown', (ev) => {
      if ((ev.pointerType === 'mouse' && ev.button !== 0) || ev.target.closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control,.leaflet-interactive')) return
      origen = { x: ev.clientX, y: ev.clientY }; soltar()
      temporizador = setTimeout(() => { temporizador = null; aparcarEn(m.mouseEventToLatLng(ev)) }, 650)
    })
    el.addEventListener('pointermove', (ev) => { if (temporizador && origen && Math.hypot(ev.clientX - origen.x, ev.clientY - origen.y) > 12) soltar() })
    el.addEventListener('pointerup', soltar)
    el.addEventListener('pointercancel', soltar)
    m.on('contextmenu', (e) => aparcarEn(e.latlng))
    // Si la caja cambia de tamaño tras crear el mapa (la página aún se estaba montando), Leaflet solo pinta la franja
    // que medía al principio: visto el 03-10-2026 en producción, un tercio del mapa en gris.
    const vigia = new ResizeObserver(() => {
      if (!mapa.current) return
      mapa.current.invalidateSize()
      encuadrar(mapa.current, encuadre.current)
    })
    vigia.observe(caja.current)
    return () => { vigia.disconnect(); soltar(); mapa.current?.remove(); mapa.current = null }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capa.current.clearLayers()
    const puntos = []
    const interactivo = !!onAccionRef.current
    if (base?.lat != null) {
      L.marker([base.lat, base.lng], { icon: L.divIcon({ className: '', html: SVG_BASE, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }), zIndexOffset: 100 })
        .bindPopup(`<b>${esc(tx('Almacén'))}</b>${base.direccion ? `<div class="fds-sub">${esc(base.direccion)}</div>` : ''}`, POP).addTo(capa.current)
      puntos.push([base.lat, base.lng])
    }
    const porConductor = {}
    paradasRef.current.forEach((p) => {
      if (p.lat == null || p.lng == null) return
      const color = p.color || '#64748b'
      const hecho = p.estado === 'entregado' || p.estado === 'fallido'
      let icono
      if (hecho) {
        icono = L.divIcon({ className: '', html: svgHecho(p.estado === 'fallido'), iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10] })
      } else {
        const s = p.grande ? 1.25 : 1
        const w = Math.round(36 * s); const h = Math.round(44 * s)
        const halo = p.grande ? `<span class="fds-halo" style="top:${Math.round(16 * s) - 15}px;background:${color}"></span>` : ''
        icono = L.divIcon({ className: '', html: `<div style="position:relative;width:${w}px;height:${h}px">${halo}<div style="position:relative">${svgPin(p.etiqueta, color, { s, zbe: !!p.zbe, dice: !!p.dice })}</div></div>`,
          iconSize: [w, h], iconAnchor: [w / 2, Math.round(42 * s)], popupAnchor: [0, -Math.round(40 * s)] })
      }
      const marcador = L.marker([p.lat, p.lng], { icon: icono, zIndexOffset: p.grande ? 1000 : hecho ? -500 : 0, title: p.titulo || '' })
        .bindPopup(popupParada(p, hecho, interactivo), POP).addTo(capa.current)
      marcador.getPopup().fds = { dato: p }
      puntos.push([p.lat, p.lng])
      if (!hecho) (porConductor[color] ||= []).push([p.orden ?? 9999, [p.lat, p.lng]])
    })
    const conCalles = trazado?.fuente === 'carreteras' && trazado.linea?.length > 1
    if (conCalles) {
      // Como un navegador: un borde azul oscuro fino y la línea azul encima, por debajo de las paradas. Antes iba
      // con borde blanco, que sobre las calles blancas del mapa no se veía y dejaba una salchicha plana (30-10-2026).
      L.polyline(trazado.linea, { color: '#1e3a8a', weight: 9, opacity: 0.55, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capa.current)
      L.polyline(trazado.linea, { color: '#3b82f6', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capa.current)
    } else {
      Object.entries(porConductor).forEach(([color, lista]) => {
        const linea = lista.sort((a, b) => a[0] - b[0]).map((x) => x[1])
        if (yoRef.current?.lat != null) linea.unshift([yoRef.current.lat, yoRef.current.lng])
        else if (base?.lat != null) linea.unshift([base.lat, base.lng])
        if (linea.length > 1) L.polyline(linea, { color, weight: 3, opacity: 0.6, dashArray: '6 6', interactive: false }).addTo(capa.current)
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
  }, [firma, base, vivos, trazado])

  useEffect(() => {
    if (!mapa.current || !capaZonas.current) return
    capaZonas.current.clearLayers()
    zonas.forEach((z) => {
      const icono = L.divIcon({
        className: '',
        html: '<div style="width:26px;height:18px;border-radius:5px;background:#7c3aed;color:#fff;font:800 9px/18px system-ui,sans-serif;text-align:center;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">C/D</div>',
        iconSize: [26, 18], iconAnchor: [13, 9], popupAnchor: [0, -8],
      })
      const detalle = [z.calle, z.horario, z.maximo && `${tx('máx.')} ${z.maximo}`].filter(Boolean).map(esc).join(' · ')
      L.marker([z.lat, z.lng], { icon: icono, zIndexOffset: -800 })
        .bindPopup(`<b>${esc(tx('Carga y descarga'))}</b>${detalle ? `<div class="fds-sub">${detalle}</div>` : ''}<div class="fds-sub">OpenStreetMap</div>`, POP)
        .addTo(capaZonas.current)
    })
  }, [zonas])

  // Lo que dice la DGT: las ZBE como polígonos con su etiqueta en el centro (debajo de todo) y las incidencias con la
  // forma de lo que pasa; y la furgoneta.
  useEffect(() => {
    if (!mapa.current || !capaZbe.current) return
    capaZbe.current.clearLayers()
    zbe.forEach((z) => {
      const texto = popupZbe(z)
      ;(z.poligonos || []).forEach((pol) => {
        if (!pol?.length) return
        L.polygon(pol, { color: '#7c3aed', weight: 2, dashArray: '6 4', fillColor: '#7c3aed', fillOpacity: 0.08 }).bindPopup(texto, POP).addTo(capaZbe.current)
        const icono = L.divIcon({ className: '', html: '<div style="width:34px;height:18px;border-radius:9px;background:#7c3aed;color:#fff;font:800 10px/18px system-ui,sans-serif;text-align:center;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">ZBE</div>', iconSize: [34, 18], iconAnchor: [17, 9], popupAnchor: [0, -8] })
        L.marker(centroide(pol), { icon: icono, zIndexOffset: -900 }).bindPopup(texto, POP).addTo(capaZbe.current)
      })
    })
  }, [zbe])

  useEffect(() => {
    if (!mapa.current || !capaInc.current) return
    capaInc.current.clearLayers()
    incidencias.forEach((i) => {
      if (i.lat == null) return
      const color = COLOR_INC[i.clase] || COLOR_INC.otro
      const icono = L.divIcon({ className: '', html: svgIncidencia(i.clase), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -13] })
      L.marker([i.lat, i.lng], { icon: icono, zIndexOffset: 600, title: i.que || '' }).bindPopup(popupIncidencia(i), POP).addTo(capaInc.current)
      if (i.lat2 != null) L.polyline([[i.lat, i.lng], [i.lat2, i.lng2]], { color, weight: 4, opacity: 0.7, dashArray: '2 6', interactive: false }).addTo(capaInc.current)
    })
  }, [incidencias])

  useEffect(() => {
    if (!mapa.current || !capaFurgo.current) return
    capaFurgo.current.clearLayers()
    if (furgo?.lat == null) return
    const icono = L.divIcon({ className: '', html: SVG_FURGO, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -15] })
    const marcador = L.marker([furgo.lat, furgo.lng], { icon: icono, zIndexOffset: 700, title: tx('Tu furgoneta') })
      .bindPopup(() => popupFurgo(furgo, yoRef.current, !!onAccionRef.current), POP).addTo(capaFurgo.current)
    marcador.getPopup().fds = { dato: furgo }
  }, [furgo])

  // Las capas que se apagan desde los botones de arriba a la derecha.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const poner = (c, si) => { if (!c) return; if (si && !m.hasLayer(c)) c.addTo(m); if (!si && m.hasLayer(c)) m.removeLayer(c) }
    poner(capaZonas.current, capas.cd); poner(capaInc.current, capas.dgt); poner(capaZbe.current, capas.zbe)
  }, [capas])

  // El punto azul se mueve solo (sin recolocar el mapa mientras lo exploras); con «Seguirme» el mapa va detrás de él.
  useEffect(() => {
    const m = mapa.current
    if (!m || !capaYo.current) return
    capaYo.current.clearLayers()
    if (yo?.lat == null) return
    L.circleMarker([yo.lat, yo.lng], { radius: 14, stroke: false, fillColor: '#3b82f6', fillOpacity: 0.2, interactive: false }).addTo(capaYo.current)
    L.circleMarker([yo.lat, yo.lng], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
      .bindTooltip(esc(tx('Estás aquí'))).addTo(capaYo.current)
    if (seguir) m.setView([yo.lat, yo.lng], Math.max(m.getZoom(), 16), { animate: true })
  }, [yo, seguir])

  const capaBoton = (k, texto, color) => (
    <button type="button" onClick={() => setCapas((c) => ({ ...c, [k]: !c[k] }))} aria-pressed={capas[k]}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold shadow-md active:scale-95 ${capas[k] ? `border-white bg-white ${color}` : 'border-white/70 bg-white/70 text-slate-400 line-through'}`}>
      {texto}
    </button>
  )

  // `isolate`: Leaflet pone sus capas con z-index 400-1000 y, sin un contexto propio, el mapa se pintaba ENCIMA de
  // las ventanas emergentes de la página.
  return (
    <div className="relative isolate">
      <style>{CSS}</style>
      <div ref={caja} style={{ height: alto }} className="w-full overflow-hidden rounded-xl border border-dark-700" />
      {(zonas.length > 0 || incidencias.length > 0 || zbe.length > 0) && (
        <div className="absolute right-2.5 top-2.5 z-[1100] flex flex-wrap justify-end gap-1" role="group" aria-label={tx('Capas del mapa')}>
          {zonas.length > 0 && capaBoton('cd', `C/D ${zonas.length}`, 'text-violet-700')}
          {incidencias.length > 0 && capaBoton('dgt', `DGT ${incidencias.length}`, 'text-amber-700')}
          {zbe.length > 0 && capaBoton('zbe', `ZBE ${zbe.length}`, 'text-violet-700')}
        </div>
      )}
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
