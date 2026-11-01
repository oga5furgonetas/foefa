// EL ESTILO PROPIO DEL MAPA DE LA GUÍA (01-11-2026, Dani: «¿puedes hacer el mapa más bonito?»): genera
// app-android/app/src/main/assets/mapa/guia-dia.json y guia-noche.json (MapLibre, teselas vectoriales de OpenFreeMap)
// a partir de UNA estructura de capas y dos paletas. Los JSON no se editan a mano: se cambia esto y se vuelve a generar.
// Uso: node scripts/mapa-guia-estilo.mjs [carpeta de salida]   (sin carpeta, la de la app)
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const salida = process.argv[2] || join(fileURLToPath(new URL('.', import.meta.url)), '..', 'app-android', 'app', 'src', 'main', 'assets', 'mapa')
mkdirSync(salida, { recursive: true })

// LAS PALETAS. Día: crema muy claro, calles blancas con borde gris, las grandes de un cálido suave. Noche: azul muy
// oscuro, calles gris claro, las grandes de un dorado apagado. Los colores de la marca (cian) NO van en el mapa base.
const PALETAS = {
  dia: {
    fondo: '#F2F0E9', residencial: '#EDEAE2', tinte: '#EAE5DD', verde: '#DEE9D3', bosque: '#D6E2CA', reserva: '#E4ECDE',
    agua: '#BFD6E4', edificio: '#E6E2D9', edificioBorde: '#DBD6CB', edificio3d: '#EBE8E0', edificio3dOpacidad: 0.32, aeropuerto: '#E3E0D8',
    menorBorde: '#D5D0C6', menor: '#FFFFFF', terciariaBorde: '#D2CDC2', terciaria: '#FFFFFF',
    primariaBorde: '#DCC89E', primaria: '#FBF1D3', autopistaBorde: '#D8B86E', autopista: '#F7DC95',
    camino: '#D6D1C7', tren: '#D1CCC2', limite: '#BDB8AE',
    texto: '#454545', textoHalo: '#FFFFFF', ref: '#5F4B10', refHalo: '#F7DC95',
    lugar: '#262626', lugarHalo: '#F2F0E9', barrio: '#8A8478', portal: '#8E887C',
  },
  noche: {
    fondo: '#0E1726', residencial: '#111B2C', tinte: '#121D30', verde: '#10212B', bosque: '#0F1E28', reserva: '#0F1C29',
    agua: '#15263B', edificio: '#162238', edificioBorde: '#1C2B45', edificio3d: '#1C2A45', edificio3dOpacidad: 0.45, aeropuerto: '#16213A',
    menorBorde: '#0A111E', menor: '#424E69', terciariaBorde: '#0A111E', terciaria: '#4E5C78',
    primariaBorde: '#0A111E', primaria: '#5A5445', autopistaBorde: '#0A111E', autopista: '#6F6448',   // apagadas: de noche la ruta es lo único brillante
    camino: '#2B3650', tren: '#2A3448', limite: '#334058',
    texto: '#C5CBD8', textoHalo: '#0E1726', ref: '#F0E0A8', refHalo: '#0E1726',
    lugar: '#E2E6EE', lugarHalo: '#0E1726', barrio: '#8C95A8', portal: '#7E879A',
  },
}

const FUENTE = 'openmaptiles'
const LINEA = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]
const POLI = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]
const clase = (...c) => ['match', ['get', 'class'], c, true, false]
const NOMBRE = ['coalesce', ['get', 'name'], ['get', 'name:latin']]
// Los túneles, medio transparentes; los ramales de autopista, más finos; las calles de servicio, más finas.
const TUNEL = ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1]
const RAMPA = ['case', ['==', ['get', 'ramp'], 1], 0.6, 1]
const SERVICIO = ['match', ['get', 'class'], ['service', 'track'], 0.6, 1]
/** Un ancho por zoom (paradas [zoom, ancho]); con `factor`, cada parada se multiplica por una expresión de datos. */
const ancho = (paradas, factor) =>
  ['interpolate', ['exponential', 1.5], ['zoom'], ...paradas.flatMap(([z, w]) => [z, factor ? ['*', w, factor] : w])]
/** Un ancho por zoom y por clase: { clase: [[zoom, ancho]…] } con las mismas paradas en todas. */
const anchoPorClase = (porClase, factor) => {
  const zooms = Object.values(porClase)[0].map(([z]) => z)
  return ['interpolate', ['exponential', 1.5], ['zoom'], ...zooms.flatMap((z, i) => {
    const m = ['match', ['get', 'class']]
    const entradas = Object.entries(porClase)
    for (const [k, paradas] of entradas.slice(0, -1)) m.push(k.split('|'), paradas[i][1])
    m.push(entradas[entradas.length - 1][1][i][1])
    return [z, factor ? ['*', m, factor] : m]
  })]
}
const tam = (paradas) => ['interpolate', ['linear'], ['zoom'], ...paradas.flat()]

// Los anchos (dp) de cada clase de calle por zoom: relleno y borde.
const A = {
  autopista: { relleno: [[5, 0.8], [8, 1.6], [10, 2.2], [12, 3], [14, 4.5], [16, 8], [18, 16], [20, 32]], borde: [[5, 1.4], [8, 2.6], [10, 3.6], [12, 4.8], [14, 7], [16, 11.5], [18, 21], [20, 38]] },
  primaria: { relleno: [[8, 0.8], [10, 1], [12, 1.8], [14, 3.2], [16, 6.5], [18, 14], [20, 28]], borde: [[8, 1.4], [10, 1.8], [12, 3], [14, 5], [16, 9], [18, 17.5], [20, 33]] },
  terciaria: { relleno: [[11, 0.6], [12, 0.8], [14, 2], [16, 5], [18, 11.5], [20, 24]], borde: [[11, 1.2], [12, 1.6], [14, 3.4], [16, 7.2], [18, 15], [20, 29]] },
  menor: { relleno: [[13, 0.7], [14, 1.2], [16, 3.5], [18, 9], [20, 20]], borde: [[13, 1.5], [14, 2.4], [16, 5.5], [18, 12], [20, 24]] },
}
// Los puentes se pintan encima de todo con los anchos de su clase (una capa para los bordes y otra para el relleno).
const puenteZooms = [13, 14, 16, 18, 20]
const enZooms = (paradas) => puenteZooms.map((z) => {
  // el ancho de esa clase en ese zoom, interpolando a mano entre sus paradas
  let antes = paradas[0], despues = paradas[paradas.length - 1]
  for (let i = 0; i < paradas.length - 1; i++) if (paradas[i][0] <= z && z <= paradas[i + 1][0]) { antes = paradas[i]; despues = paradas[i + 1]; break }
  if (z <= antes[0]) return [z, antes[1]]
  if (z >= despues[0]) return [z, despues[1]]
  const t = (z - antes[0]) / (despues[0] - antes[0])
  return [z, +(antes[1] + (despues[1] - antes[1]) * t).toFixed(2)]
})

const fill = (id, capa, filtro, minzoom, paint, extra = {}) => ({ id, type: 'fill', source: FUENTE, 'source-layer': capa, ...(minzoom != null ? { minzoom } : {}), ...(filtro ? { filter: filtro } : {}), paint, ...extra })
const line = (id, capa, filtro, minzoom, paint, layout = { 'line-cap': 'round', 'line-join': 'round' }, extra = {}) =>
  ({ id, type: 'line', source: FUENTE, 'source-layer': capa, ...(minzoom != null ? { minzoom } : {}), ...(filtro ? { filter: filtro } : {}), layout, paint, ...extra })
const BORDE = { 'line-cap': 'butt', 'line-join': 'round' }

function capas(c) {
  const roads = [
    // Caminos y aceras: finos y a puntitos, solo de cerca (sirven para ver un pasaje entre bloques).
    line('caminos', 'transportation', ['all', LINEA, clase('path'), ['!=', ['get', 'subclass'], 'platform']], 16,
      { 'line-color': c.camino, 'line-width': ancho([[16, 1], [18, 1.8], [20, 3]]), 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 }, BORDE),
    // Primero todos los bordes y luego todos los rellenos: así los cruces quedan unidos.
    line('menores_borde', 'transportation', ['all', LINEA, clase('minor', 'service', 'track')], 14,
      { 'line-color': c.menorBorde, 'line-width': ancho(A.menor.borde, SERVICIO), 'line-opacity': TUNEL }, BORDE),
    line('terciarias_borde', 'transportation', ['all', LINEA, clase('tertiary')], 12,
      { 'line-color': c.terciariaBorde, 'line-width': ancho(A.terciaria.borde), 'line-opacity': TUNEL }, BORDE),
    line('primarias_borde', 'transportation', ['all', LINEA, clase('primary', 'secondary')], 9,
      { 'line-color': c.primariaBorde, 'line-width': ancho(A.primaria.borde, RAMPA), 'line-opacity': TUNEL }, BORDE),
    line('autopistas_borde', 'transportation', ['all', LINEA, clase('motorway', 'trunk')], 6,
      { 'line-color': c.autopistaBorde, 'line-width': ancho(A.autopista.borde, RAMPA), 'line-opacity': TUNEL }, BORDE),
    line('menores', 'transportation', ['all', LINEA, clase('minor', 'service', 'track')], 13,
      { 'line-color': c.menor, 'line-width': ancho(A.menor.relleno, SERVICIO), 'line-opacity': TUNEL }),
    line('terciarias', 'transportation', ['all', LINEA, clase('tertiary')], 11,
      { 'line-color': c.terciaria, 'line-width': ancho(A.terciaria.relleno), 'line-opacity': TUNEL }),
    line('primarias', 'transportation', ['all', LINEA, clase('primary', 'secondary')], 8,
      { 'line-color': c.primaria, 'line-width': ancho(A.primaria.relleno, RAMPA), 'line-opacity': TUNEL }),
    line('autopistas', 'transportation', ['all', LINEA, clase('motorway', 'trunk')], 5,
      { 'line-color': c.autopista, 'line-width': ancho(A.autopista.relleno, RAMPA), 'line-opacity': TUNEL }),
    // Las vías del tren, finas y discretas (orientan: «pasadas las vías»); sin líneas de metro ni autobús.
    line('tren', 'transportation', ['all', LINEA, ['==', ['get', 'class'], 'rail'], ['!', ['has', 'service']]], 13,
      { 'line-color': c.tren, 'line-width': ancho([[13, 0.8], [16, 1.5], [20, 4]]), 'line-opacity': TUNEL }, { 'line-join': 'round' }),
    // Los puentes, encima: su borde y su relleno con los anchos y colores de su clase.
    line('puentes_borde', 'transportation', ['all', LINEA, ['==', ['get', 'brunnel'], 'bridge'], clase('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service')], 13,
      { 'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], c.autopistaBorde, ['primary', 'secondary'], c.primariaBorde, ['tertiary'], c.terciariaBorde, c.menorBorde],
        'line-width': anchoPorClase({ 'motorway|trunk': enZooms(A.autopista.borde), 'primary|secondary': enZooms(A.primaria.borde), tertiary: enZooms(A.terciaria.borde), resto: enZooms(A.menor.borde) }, RAMPA) }, BORDE),
    line('puentes', 'transportation', ['all', LINEA, ['==', ['get', 'brunnel'], 'bridge'], clase('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service')], 13,
      { 'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], c.autopista, ['primary', 'secondary'], c.primaria, ['tertiary'], c.terciaria, c.menor],
        'line-width': anchoPorClase({ 'motorway|trunk': enZooms(A.autopista.relleno), 'primary|secondary': enZooms(A.primaria.relleno), tertiary: enZooms(A.terciaria.relleno), resto: enZooms(A.menor.relleno) }, RAMPA) }),
  ]

  const texto = (id, capa, filtro, minzoom, layout, paint, extra = {}) =>
    ({ id, type: 'symbol', source: FUENTE, 'source-layer': capa, minzoom, ...(filtro ? { filter: filtro } : {}), layout, paint, ...extra })
  const etiquetas = [
    // Los nombres de las calles: solo de cerca, en una letra limpia, tumbados sobre la calle.
    texto('nombres_calles_menores', 'transportation_name', ['all', LINEA, clase('minor', 'service', 'track')], 15.5,
      { 'symbol-placement': 'line', 'symbol-spacing': 300, 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], 'text-size': tam([[15.5, 11.5], [18, 14]]), 'text-rotation-alignment': 'map', 'text-padding': 4, 'text-letter-spacing': 0.02 },
      { 'text-color': c.texto, 'text-halo-color': c.textoHalo, 'text-halo-width': 1.2, 'text-halo-blur': 0.3 }),
    texto('nombres_calles', 'transportation_name', ['all', LINEA, clase('primary', 'secondary', 'tertiary', 'trunk')], 13,
      { 'symbol-placement': 'line', 'symbol-spacing': 320, 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], 'text-size': tam([[13, 11.5], [16, 13], [18, 15]]), 'text-rotation-alignment': 'map', 'text-padding': 4, 'text-letter-spacing': 0.02 },
      { 'text-color': c.texto, 'text-halo-color': c.textoHalo, 'text-halo-width': 1.3, 'text-halo-blur': 0.3 }),
    // La matrícula de la autopista («AP-9», «A-6»), siempre derecha, como una placa sobre la calle.
    texto('refs_autopista', 'transportation_name', ['all', LINEA, clase('motorway', 'trunk'), ['has', 'ref']], 8,
      { 'symbol-placement': 'line', 'symbol-spacing': 350, 'text-field': ['get', 'ref'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-rotation-alignment': 'viewport', 'text-pitch-alignment': 'viewport', 'text-padding': 6, 'text-letter-spacing': 0.05 },
      { 'text-color': c.ref, 'text-halo-color': c.refHalo, 'text-halo-width': 2 }),
    // Los números de portal, de muy cerca: lo que busca un repartidor.
    // Desde z17,5: la guía va entre z17 y z18 y a 18,5 no se veían nunca (revisión 01-11-2026).
    texto('portales', 'housenumber', null, 17.5,
      { 'text-field': ['get', 'housenumber'], 'text-font': ['Noto Sans Regular'], 'text-size': tam([[17.5, 10], [20, 12]]), 'text-padding': 12 },
      { 'text-color': c.portal, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1 }),
    // Barrios, pueblos y ciudades: pequeños y sin iconos.
    texto('barrios', 'place', clase('suburb', 'neighbourhood', 'quarter'), 12,
      { 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], 'text-size': tam([[12, 10], [15, 12]]), 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8, 'text-padding': 8 },
      { 'text-color': c.barrio, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1.2, 'text-halo-blur': 0.5 }, { maxzoom: 19 }),   // no en 18: es un zoom fijo de la guía
    texto('pueblos', 'place', clase('village', 'hamlet'), 10,
      { 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], 'text-size': tam([[10, 10.5], [14, 13]]), 'text-max-width': 8, 'text-padding': 6 },
      { 'text-color': c.lugar, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.5 }, { maxzoom: 16 }),
    texto('villas', 'place', clase('town'), 7,
      { 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], 'text-size': tam([[7, 11], [12, 14], [14, 15]]), 'text-max-width': 8, 'text-padding': 6 },
      { 'text-color': c.lugar, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.5 }, { maxzoom: 16 }),
    texto('ciudades', 'place', clase('city'), 4,
      { 'text-field': NOMBRE, 'text-font': ['Noto Sans Bold'], 'text-size': tam([[4, 11], [8, 14], [12, 18]]), 'text-max-width': 8, 'text-padding': 6 },
      { 'text-color': c.lugar, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1.5, 'text-halo-blur': 0.5 }, { maxzoom: 15 }),
    texto('paises', 'place', clase('country'), 1,
      { 'text-field': NOMBRE, 'text-font': ['Noto Sans Bold'], 'text-size': tam([[1, 10], [4, 14], [7, 17]]), 'text-max-width': 6, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
      { 'text-color': c.barrio, 'text-halo-color': c.lugarHalo, 'text-halo-width': 1.2 }, { maxzoom: 8 }),
  ]

  return [
    { id: 'fondo', type: 'background', paint: { 'background-color': c.fondo } },
    // El suelo: zonas residenciales apenas más oscuras, parques y bosques en un verde apagado, agua discreta.
    fill('residencial', 'landuse', ['all', POLI, clase('residential')], 8, { 'fill-color': c.residencial, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1] }, { maxzoom: 22 }),   // no en 17: es un zoom fijo de la guía
    fill('tintes', 'landuse', ['all', POLI, clase('hospital', 'school', 'university', 'college', 'kindergarten', 'cemetery', 'stadium', 'pitch', 'playground')], 11, { 'fill-color': c.tinte }),
    fill('reservas', 'park', POLI, 6, { 'fill-color': c.reserva, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 0.8] }),
    fill('bosques', 'landcover', ['all', POLI, clase('wood')], 9, { 'fill-color': c.bosque, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 13, 1], 'fill-antialias': false }),
    fill('verde', 'landcover', ['all', POLI, clase('grass')], 10, { 'fill-color': c.verde, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1], 'fill-antialias': false }),
    fill('agua', 'water', ['all', POLI, ['!=', ['get', 'brunnel'], 'tunnel']], null, { 'fill-color': c.agua }),
    line('rios', 'waterway', ['all', LINEA, ['!=', ['get', 'brunnel'], 'tunnel']], 11, { 'line-color': c.agua, 'line-width': ancho([[11, 0.8], [14, 1.5], [18, 4]]) }),
    line('aeropuertos', 'aeroway', ['all', LINEA, clase('runway', 'taxiway')], 11, { 'line-color': c.aeropuerto, 'line-width': ancho([[11, 2], [14, ['match', ['get', 'class'], ['runway'], 10, 3]], [18, ['match', ['get', 'class'], ['runway'], 50, 14]]]) }),
    // Los edificios: planos de lejos y, de cerca, en volumen con la inclinación de la cámara.
    fill('edificios', 'building', null, 14, { 'fill-color': c.edificio, 'fill-outline-color': c.edificioBorde, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] }),
    ...roads,
    // Solo la frontera entre países, fina y a rayas; nada de límites de provincia ni de municipio.
    line('fronteras', 'boundary', ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]], 2,
      { 'line-color': c.limite, 'line-width': ancho([[2, 0.6], [8, 1.2]]), 'line-dasharray': [3, 2], 'line-opacity': 0.7 }, BORDE),
    // En volumen ENCIMA de las calles (como los estilos de referencia): debajo, con la cámara inclinada las calles se
    // pintaban sobre tejados y fachadas (revisión 01-11-2026). La ruta sigue encima: va justo debajo de las etiquetas.
    { id: 'edificios_3d', type: 'fill-extrusion', source: FUENTE, 'source-layer': 'building', minzoom: 16, filter: ['!', ['has', 'hide_3d']],
      // Bajos (tope 18 m) y translúcidos: a 45 m y 0,5 tapaban la ruta y las calles de detrás (emulador, 01-11-2026).
      paint: { 'fill-extrusion-color': c.edificio3d, 'fill-extrusion-opacity': c.edificio3dOpacidad,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 16, 0, 16.6, ['min', 18, ['coalesce', ['get', 'render_height'], 6]]],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 16, 0, 16.6, ['min', 15, ['coalesce', ['get', 'render_min_height'], 0]]] } },
    ...etiquetas,
  ]
}

for (const [tema, c] of Object.entries(PALETAS)) {
  const estilo = {
    version: 8,
    name: `FDS guía (${tema})`,
    metadata: { 'fds:tema': tema, 'fds:generado': 'scripts/mapa-guia-estilo.mjs (01-11-2026)' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    // La luz de los edificios en volumen: suave, para que las fachadas no se vuelvan grises.
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.25, position: [1.15, 210, 30] },
    sources: { [FUENTE]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap contributors' } },
    layers: capas(c),
  }
  writeFileSync(join(salida, `guia-${tema}.json`), JSON.stringify(estilo, null, 1) + '\n')
  console.log(`guia-${tema}.json: ${estilo.layers.length} capas, fondo ${c.fondo}`)
}
