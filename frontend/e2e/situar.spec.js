/* global Buffer */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { conPiso, numeroDe, calleDe, palabrasCalle, mismaCalle, comparteNombre, deOtraCalle, noToca, alElegir, cambioEsAqui, deLaBuscada,
  juntarSugerencias, LISTAS_CALLE, PISO_PALABRA_FUENTE, PISO_COLA_FUENTE, portalDe, mismoSitio, pueblosEscritos, mismoPueblo, paraBuscar,
  EXPRESIONES_K } from '../src/lib/situar.js'
import { buscarDirecciones } from '../src/lib/direcciones.js'

/* SITUAR LA PARADA (02-11-2026). Dani, probando la app con una cuenta nueva: «el primer paquete que escaneo no encuentra
   la dirección y tiene que ir por Maps; eso es un pedazo de mierda, hazlo bien». Con la API simulada: «Ir» (o «Empezar a
   navegar», o la guía al pasar a la siguiente) en una parada sin punto abre «Situar la parada» y NUNCA Google Maps solo;
   «Es aquí» manda lat/lng (sin la dirección) con su origen y abre nuestra guía; desde la lista, se queda en la lista;
   Google Maps solo con su enlace pequeño. Y la ficha dice, antes de guardar, si la dirección está en el mapa (POST
   /reparto/ubicar, con espera al teclear), con lo que encuentra el servidor primero en las sugerencias.
   Desde el 03-11-2026, la regla de «Otra calle» (igual que la app nativa) y la precisión del punto elegido, que llega
   al servidor ("precision": "calle"); y, desde la tanda del 03-11-2026 de madrugada, UNA sola regla al elegir
   (situar.js alElegir) con la dirección de la PARADA en todos los caminos: la lista de la ficha, «Situar» desde la
   ficha y desde la ruta, también con la búsqueda corregida. Y desde la tanda del 03-11-2026 de madrugada (la revisión,
   igual que la app nativa): el portal es el número que vale y va entero («5B», «12-14»), la misma calle es
   también el mismo sitio (por el CP o el pueblo), lo juntado lleva el CP y el pueblo por orden de fuentes, y al
   reescribir o dictar la dirección de la ficha se va todo lo que vino con lo elegido. Y desde la mañana del 03-11-2026
   (F, G, H y J): el portal es el PRIMERO que vale y lo de detrás, si es todo piso, el piso; las cifras del nombre
   cuentan; «O Burgo (Culleredo)» son dos pueblos; y sin \b junto a una cifra. Y K (03-11-2026): el piso con todas las
   letras detrás de «º», los espacios raros, la marca del número tras la coma, el número del nombre y el piso que ya va
   en la elegida, por palabras enteras. Y la quinta tanda (03-11-2026 a media mañana): el zoom con los dedos y el giro
   no olvidan la sugerencia elegida (solo un arrastre), el nombre de la capital con el CP de otro municipio es la
   provincia, a Photon va lo buscado sin el piso, el número del nombre detrás de un artículo, la letra del portal no es
   piso y el U+FEFF y el U+000B son espacios. Y la sexta (03-11-2026 a mediodía): el pellizco que empieza como arrastre
   no la olvida, el número del nombre solo detrás de un artículo, un sitio que no es un pueblo no es no decir nada y
   todas las provincias. Y la séptima (03-11-2026 por la tarde): el segundo dedo tras un arrastre largo no la vuelve a
   dar por buena, la provincia detrás de «de» es del pueblo, «No.» y las letras sueltas no son artículos y los de control
   U+001C-U+001F y U+0085 son espacios.
   Solo direcciones públicas: el Concello da Coruña (Praza de María Pita 1) y el hospital (As Xubias de Arriba 84). */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const AQUI = { latitude: 43.3623, longitude: -8.4115 }               // la posición del móvil en las pruebas
const ZONA = { lat: 43.3705, lng: -8.3965 }                           // el centro del CP 15001, lo que da el servidor
const PORTAL = { lat: 43.37087, lng: -8.39618, direccion: 'Praza de María Pita, 1, 15001 A Coruña' }
const ATRIBUCION = 'Direcciones: CartoCiudad (IGN), CC BY 4.0 · OpenStreetMap'
// Una tesela vacía (PNG de 1×1): el mapa se pinta sin salir a la red.
const TESELA = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const concello = (extra = {}) => ({ id: 'p1', cliente: 'Concello', direccion: 'Praza de María Pita 1, 15001 A Coruña', cp: '15001', localidad: 'A Coruña',
  estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: null, lng: null, geo: 'zona', zona_lat: ZONA.lat, zona_lng: ZONA.lng, telefono: '', ...extra })
const hospital = (extra = {}) => ({ id: 'p2', cliente: 'Hospital', direccion: 'As Xubias de Arriba 84, 15006 A Coruña', estado: 'pendiente', bultos: 1,
  orden: 2, eta: '10:20', lat: 43.3446, lng: -8.3876, geo: 'ok', telefono: '', ...extra })
// Lo que contesta el servidor cuando solo encuentra la zona, y cuando encuentra el portal (y la calle sin él).
const soloZona = () => ({ encontrada: false, lat: ZONA.lat, lng: ZONA.lng, precision: 'zona', direccion: '15001 A Coruña', candidatos: [], atribucion: ATRIBUCION })
const conPortal = () => ({ encontrada: true, lat: PORTAL.lat, lng: PORTAL.lng, precision: 'portal', direccion: PORTAL.direccion, atribucion: ATRIBUCION,
  candidatos: [{ ...PORTAL, precision: 'portal' }, { lat: 43.3712, lng: -8.3955, precision: 'calle', direccion: 'Praza de María Pita, 15001 A Coruña' }] })

// El geo que guarda el servidor con el punto que llega (03-11-2026): "precision": "calle" es la calle sin el portal
// («aprox»); cualquier otra cosa, o nada, «manual».
const geoDe = (b) => (b.precision === 'calle' ? 'aprox' : 'manual')
// Una respuesta de Photon: la calle, su número (o nada), el CP, la población y el punto.
const dePhoton = (street, housenumber, postcode, city, lng, lat, extra = {}) => ({ geometry: { coordinates: [lng, lat] },
  properties: { street, ...(housenumber ? { housenumber } : {}), postcode, city, countrycode: 'ES', ...extra } })
/* «Rúa Brétema Mariñeira 23, 15011 A Coruña» (lo visto en el emulador el 02-11-2026): el servidor solo encuentra el CP, y
   Photon da primero «Rúa Brétema» de Oleiros (comparte «Brétema»: otra calle), luego otra del 15011 con el 23 (nada en
   común) y la escrita sin el portal. */
const OLEIROS = { lat: 43.3283, lng: -8.3494 }
const bretema = () => [
  dePhoton('Rúa Brétema', '', '15179', 'Oleiros', OLEIROS.lng, OLEIROS.lat),
  dePhoton('Rúa Almirante Mourelle', '23', '15011', 'A Coruña', -8.4101, 43.3611),
  dePhoton('Rúa Brétema Mariñeira', '', '15011', 'A Coruña', -8.4121, 43.3621),
]
const zona15011 = () => ({ encontrada: false, lat: 43.3605, lng: -8.4105, precision: 'zona', direccion: '15011 A Coruña', candidatos: [], atribucion: ATRIBUCION })

/** Recoge los errores de consola y los fallos de JS de una página (como en humo.spec.js). */
function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/* La app de quien reparte solo (/ruta) con sesión y la ruta de hoy. `ubicar(cuerpo)` es lo que contesta POST
   /reparto/ubicar; `photon`, las sugerencias del buscador de mapas. Devuelve lo que se pidió al servidor y lo que se
   intentó abrir fuera (Google Maps, Waze, ventanas nuevas). */
async function preparar(page, pedidos, { ubicar = soloZona, photon = [], escaner = false } = {}) {
  await page.addInitScript((conEscaner) => {
    localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
    if (!conEscaner) return
    // La cámara y el lector de códigos del navegador, simulados (como en escanear-etiqueta.spec.js).
    window.__ahora = []
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['code_128', 'qr_code', 'data_matrix', 'pdf417'] }
      async detect() { return (window.__ahora || []).map((rawValue) => ({ rawValue })) }
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 240)
      return c.captureStream(5)
    }
  }, escaner)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], precios: { mensual: 9.99, anual: 99 },
    regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: new Date(Date.now() + 30 * 86400000).toISOString() } }))
  const s = { ubicar: [], editados: [], creados: [], guiadas: [], fuera: [], ventanas: [] }
  const ruta = { activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null,
    pais: 'es', prefijo: '34', ruta: pedidos.length ? { fin: '11:00', minutos: 45, km: 6, trafico: true } : null, pedidos }
  s.ruta = ruta
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TESELA }))
  await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { features: photon } }))
  await page.route(/\/api\/reparto\/ubicar$/, (r) => { const b = r.request().postDataJSON(); s.ubicar.push(b); return r.fulfill({ json: ubicar(b) }) })
  await page.route(/\/api\/reparto\/mis-pedidos\/[^/]+\/editar$/, (r) => {
    const id = r.request().url().split('/mis-pedidos/')[1].split('/')[0]
    const b = r.request().postDataJSON()
    s.editados.push({ id, cuerpo: b })
    // El contrato: lat y lng sin la dirección ponen el punto (geo «manual», o «aprox» con "precision": "calle") y quitan
    // la zona; con la dirección (una «Otra calle»), también la cambian.
    ruta.pedidos = ruta.pedidos.map((p) => (p.id === id && b.lat != null ? { ...p, lat: b.lat, lng: b.lng, geo: geoDe(b), zona_lat: null, zona_lng: null,
      ...(b.direccion ? { direccion: b.direccion, cp: b.cp || '', localidad: b.localidad || '' } : {}) } : p))
    return r.fulfill({ json: { ok: true, ...ruta.pedidos.find((p) => p.id === id) } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos$/, (r) => {
    const b = r.request().postDataJSON(); s.creados.push(b)
    const p = { id: `n${s.creados.length}`, estado: 'pendiente', bultos: 1, ...b, lat: b.lat ?? null, lng: b.lng ?? null, geo: b.lat != null ? geoDe(b) : 'no' }
    ruta.pedidos = [...ruta.pedidos, p]
    return r.fulfill({ json: p })
  })
  await page.route(/\/api\/reparto\/pedidos\/[^/]+\/estado$/, (r) => {
    const id = r.request().url().split('/pedidos/')[1].split('/')[0]
    const { estado } = r.request().postDataJSON()
    ruta.pedidos = ruta.pedidos.map((p) => (p.id === id ? { ...p, estado, cerrado_en: estado === 'pendiente' ? null : new Date().toISOString() } : p))
    return r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/navegar$/, (r) => {
    const { id, desde } = r.request().postDataJSON()
    s.guiadas.push(id)
    const p = ruta.pedidos.find((x) => x.id === id)
    return r.fulfill({ json: { fuente: 'carreteras', metros: 900, minutos: 4, linea: [[desde.lat, desde.lng], [p.lat, p.lng]],
      pasos: [{ texto: 'Sigue recto', icono: 'recto', punto: [desde.lat, desde.lng], metros: 900 }, { texto: 'Has llegado', icono: 'llegada', punto: [p.lat, p.lng], metros: 0 }] } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta }))
  // Lo de fuera: Google Maps y Waze no se abren nunca solos; si se abren, se apunta (y no se sale a la red).
  await page.context().route(/google\.com\/maps|waze\.com\/ul/, (r) => { s.fuera.push(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<p>fuera</p>' }) })
  page.context().on('page', (p) => s.ventanas.push(p))
  return s
}

/** El ⋮ de la tarjeta (07-11-2026, diseño compacto): cuántos «Ver la puerta» hay (0 o 1); se cierra sin tocar nada. */
async function verLaPuerta(page, fila) {
  await fila.getByRole('button', { name: 'Más opciones' }).click()
  const n = await page.getByRole('menuitem', { name: 'Ver la puerta' }).count()
  await page.keyboard.press('Escape')
  return n
}

test.describe('situar la parada', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, geolocation: AQUI, permissions: ['geolocation'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('«Ir» en una parada sin punto abre «Situar la parada», no Google Maps; «Es aquí» guarda lat/lng y abre la guía', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello(), hospital()])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const sig = page.locator('#parada-p1')
    await expect(sig.getByTestId('situar-parada')).toHaveText('Sin situar · Situar')
    await sig.getByRole('button', { name: 'Ir', exact: true }).click()

    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await expect(situar).toBeVisible()
    await expect(situar.getByText('Concello', { exact: true })).toBeVisible()
    await expect(situar.getByRole('textbox', { name: 'Dirección' })).toHaveValue('Praza de María Pita 1, 15001 A Coruña')
    // Pregunta al servidor por su dirección, con su CP y su población; solo encuentra la zona.
    await expect.poll(() => s.ubicar.length).toBe(1)
    expect(s.ubicar[0]).toEqual({ direccion: 'Praza de María Pita 1, 15001 A Coruña', cp: '15001', localidad: 'A Coruña' })
    await expect(situar.getByText('No encuentro esa dirección: mueve el mapa hasta la puerta.')).toBeVisible()
    // Empieza en esa zona, sin acercar: así no se puede guardar el centro del código postal como si fuera la puerta.
    const esAqui = situar.getByRole('button', { name: 'Es aquí' })
    await expect(situar.getByText('Acerca el mapa hasta ver la puerta')).toBeVisible()
    await expect(esAqui).toBeDisabled()
    const mapa = situar.getByTestId('situar-mapa')
    await mapa.dblclick()
    await expect(esAqui).toBeEnabled()
    // Se mueve el mapa (no la chincheta) hasta la puerta.
    const b = await mapa.boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 - 90, b.y + b.height / 2 - 50, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    await esAqui.click()

    await expect.poll(() => s.editados.length).toBe(1)
    const { id, cuerpo } = s.editados[0]
    expect(id).toBe('p1')
    // Solo el punto y de dónde sale: la dirección no se toca.
    expect(Object.keys(cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
    expect(cuerpo.geo_origen).toBe('mapa')
    expect(Math.abs(cuerpo.lat - ZONA.lat)).toBeLessThan(0.01)
    expect(Math.abs(cuerpo.lng - ZONA.lng)).toBeLessThan(0.01)
    expect(Math.abs(cuerpo.lat - ZONA.lat) + Math.abs(cuerpo.lng - ZONA.lng)).toBeGreaterThan(0.0002)   // es donde se movió
    // Y nuestra guía, a esa parada.
    const nav = page.getByRole('dialog', { name: 'Navegación' })
    await expect(nav).toBeVisible()
    await expect(nav.getByText('Concello')).toBeVisible()
    await expect.poll(() => s.guiadas).toEqual(['p1'])
    await expect(situar).toHaveCount(0)
    expect(s.fuera).toEqual([])
    expect(s.ventanas).toHaveLength(0)
    expect(fallos).toEqual([])
  })

  test('«Sin situar · Situar» en la lista: lo que encuentra el servidor va primero; elegirlo guarda su punto y se queda en la lista', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [hospital({ orden: 1 }), concello({ orden: 2 })], {
      ubicar: conPortal,
      photon: [
        // El mismo portal desde OpenStreetMap (a menos de 25 m): no se repite.
        { geometry: { coordinates: [-8.39625, 43.37091] }, properties: { street: 'Praza de María Pita', housenumber: '1', postcode: '15001', city: 'A Coruña', countrycode: 'ES' } },
        // Otra calle con el mismo número (02-11-2026): no es la escrita, así que no se sugiere (lib/situar.js, mismaCalle).
        { geometry: { coordinates: [-8.4009, 43.3693] }, properties: { street: 'Rúa Real', housenumber: '1', postcode: '15003', city: 'A Coruña', countrycode: 'ES' } },
      ],
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    // Plegada: «Sin situar» y, en el hueco de «Ir», «Situar».
    const fila = page.locator('#parada-p1')
    await expect(fila.getByText('Sin situar', { exact: true })).toBeVisible()
    await fila.getByRole('button', { name: 'Situar: Concello' }).click()

    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const lista = situar.getByRole('list', { name: 'Direcciones sugeridas' })
    await expect(situar.getByText('¿Es alguna de estas?')).toBeVisible()
    const opciones = lista.getByRole('button')
    await expect(opciones).toHaveCount(2)
    await expect(opciones.nth(0)).toHaveText(PORTAL.direccion)
    await expect(opciones.nth(1)).toContainText('Sin el portal')
    await expect(lista.getByText('Rúa Real 1, 15003 A Coruña')).toHaveCount(0)
    await expect(situar.getByText(ATRIBUCION)).toBeVisible()
    // Sin enlace a Google Maps a la vista más que el pequeño de abajo.
    await expect(situar.getByRole('link', { name: 'Abrir en Google Maps' })).toBeVisible()
    await opciones.nth(0).click()
    await expect(situar.getByTestId('situar-aqui')).toHaveText(`Aquí: ${PORTAL.direccion}`)
    await situar.getByRole('button', { name: 'Es aquí' }).click()

    await expect.poll(() => s.editados.length).toBe(1)
    // El mismo portal, escrito como lo da el servidor: va su dirección (03-11-2026, como la app: Situar.esAqui), con el
    // CP y el pueblo que trae el mismo portal de OpenStreetMap, que se juntó con él.
    expect(s.editados[0]).toEqual({ id: 'p1', cuerpo: { lat: PORTAL.lat, lng: PORTAL.lng, geo_origen: 'sugerencia', direccion: PORTAL.direccion,
      cp: '15001', localidad: 'A Coruña' } })
    await expect(situar).toHaveCount(0)
    await expect(page.getByText('✓ Parada situada en el mapa')).toBeVisible()
    // Desde la lista no se abre la guía: se seguía preparando la ruta.
    await expect(page.getByRole('dialog', { name: 'Navegación' })).toHaveCount(0)
    expect(s.guiadas).toEqual([])
    await expect(fila.getByText('Sin situar', { exact: true })).toHaveCount(0)
    await expect(fila.getByRole('button', { name: 'Ir a Concello' })).toBeVisible()
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('nunca se va a Google Maps sin pulsar su enlace; el enlace pequeño sí lo abre, con la dirección', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello(), hospital()])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-p1').getByRole('button', { name: 'Ir', exact: true }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await expect(situar.getByText('No encuentro esa dirección: mueve el mapa hasta la puerta.')).toBeVisible()
    await page.waitForTimeout(1200)
    expect(s.fuera).toEqual([])
    expect(s.ventanas).toHaveLength(0)
    const enlace = situar.getByRole('link', { name: 'Abrir en Google Maps' })
    await expect(enlace).toHaveAttribute('href', `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Praza de María Pita 1, 15001 A Coruña')}`)
    const [ventana] = await Promise.all([page.waitForEvent('popup'), enlace.click()])
    await ventana.waitForLoadState()
    expect(ventana.url()).toContain('google.com/maps/dir/')
    await expect(situar).toHaveCount(0)
    expect(s.editados).toEqual([])
    expect(fallos).toEqual([])
  })

  test('la guía no se salta una parada sin situar: entregada la anterior, pide situarla y luego sigue guiando', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [hospital({ orden: 1 }), concello({ orden: 2, geo: 'no', zona_lat: null, zona_lng: null }),
      { id: 'p3', cliente: 'Colegio', direccion: 'Rúa Real 1, 15003 A Coruña', estado: 'pendiente', bultos: 1, orden: 3, lat: 43.3693, lng: -8.4009, geo: 'ok' }],
    { ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('region', { name: 'Siguiente parada' }).getByRole('button', { name: 'Ir', exact: true }).click()
    const nav = page.getByRole('dialog', { name: 'Navegación' })
    await expect(nav.getByText('Hospital')).toBeVisible()
    await nav.getByRole('button', { name: 'Ya he llegado' }).click()
    await nav.getByRole('button', { name: 'Entregado', exact: true }).click()
    await page.getByRole('button', { name: 'Entregar sin foto' }).click()

    // La siguiente en orden es la del Concello, sin punto: «Situar la parada», no la del colegio.
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await expect(situar).toBeVisible()
    await expect(situar.getByRole('textbox', { name: 'Dirección' })).toHaveValue('Praza de María Pita 1, 15001 A Coruña')
    await expect(nav).toHaveCount(0)
    expect(s.guiadas).toEqual(['p2'])
    await situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button').first().click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.map((e) => e.id)).toEqual(['p1'])
    // Y sigue guiando, a ella.
    await expect(nav.getByText('Concello')).toBeVisible()
    await expect.poll(() => s.guiadas).toEqual(['p2', 'p1'])
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('si ninguna está en el mapa, la tarjeta ofrece situarla y, al ponerla con «Ir», guía', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello({ geo: 'no', zona_lat: null, zona_lng: null })], { ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    // Sin punto (07-11-2026, diseño compacto): el chip «Sin situar · Situar» de la tarjeta y, para guiar, «Ir» (el bloque ámbar
    // «No encontramos la dirección…» ya no existe: el chip abre «Situar» y se queda en la lista; «Ir» sitúa y guía).
    await expect(page.getByTestId('situar-parada')).toHaveText('Sin situar · Situar')
    await page.getByRole('region', { name: 'Siguiente parada' }).getByRole('button', { name: 'Ir', exact: true }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('button', { name: PORTAL.direccion }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0].cuerpo).toEqual({ lat: PORTAL.lat, lng: PORTAL.lng, geo_origen: 'sugerencia', direccion: PORTAL.direccion, cp: '', localidad: '' })
    await expect(page.getByRole('dialog', { name: 'Navegación' }).getByText('Concello')).toBeVisible()
    await expect(page.getByTestId('situar-parada')).toHaveCount(0)
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('la ficha dice si la dirección está en el mapa, espera a que se deje de teclear, y manda el punto elegido o puesto', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], {
      ubicar: ({ direccion }) => (/inventada/i.test(direccion) ? { encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }
        : /pita 1/i.test(direccion) ? conPortal()
          : { encontrada: true, lat: 43.3693, lng: -8.4009, precision: 'calle', direccion: 'Rúa Real, 15003 A Coruña', atribucion: ATRIBUCION,
            candidatos: [{ lat: 43.3693, lng: -8.4009, precision: 'calle', direccion: 'Rúa Real, 15003 A Coruña' }] }),
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    const estado = hoja.getByTestId('estado-direccion')

    // No la encuentra: lo dice y ofrece situarla.
    await dir.fill('Rúa Inventada 99, A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'no')
    await expect(estado).toHaveText(/No la encuentro: elige una sugerencia o sitúala en el mapa/)
    await expect(estado.getByRole('button', { name: 'Situar en el mapa' })).toBeVisible()

    // Tecla a tecla: una sola pregunta al servidor, cuando se deja de escribir.
    const antes = s.ubicar.length
    await dir.fill('')
    await dir.pressSequentially('Rúa Real, A Coruña', { delay: 40 })
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    await expect(estado).toHaveText(/Calle encontrada, sin el portal/)
    expect(s.ubicar.length - antes).toBe(1)
    expect(s.ubicar[s.ubicar.length - 1]).toEqual({ direccion: 'Rúa Real, A Coruña' })

    // La calle sola: se sitúa en nuestro mapa (desde la ficha, sin enlace a Google Maps) y se guarda con la ficha.
    await estado.getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await expect(situar).toBeVisible()
    await expect(situar.getByRole('link', { name: /Abrir en/ })).toHaveCount(0)
    // En la puerta: «Mi ubicación» lleva el mapa (a zoom de puerta) a donde está el móvil, y eso es lo que se guarda.
    await situar.getByRole('button', { name: 'Mi ubicación' }).click()
    await expect(situar.getByRole('button', { name: 'Es aquí' })).toBeEnabled()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect(situar).toHaveCount(0)
    await expect(estado).toHaveAttribute('data-estado', 'mano')
    await expect(estado).toHaveText(/Situada a mano en el mapa/)
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'Rúa Real, A Coruña', geo_origen: 'mapa' })
    expect(s.creados[0]).not.toHaveProperty('precision')                // puesto a mano: «manual», sin precisión
    expect(s.creados[0].lat).toBeCloseTo(AQUI.latitude, 4)
    expect(s.creados[0].lng).toBeCloseTo(AQUI.longitude, 4)

    // El portal: «En el mapa», lo del servidor el primero, y al elegirlo el piso escrito no se pierde. Con una parada
    // ya en la ruta, añadir va en el «+».
    await page.getByRole('button', { name: 'Añadir paradas' }).click()
    await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja2 = page.getByRole('dialog', { name: 'Nueva parada' })
    await hoja2.getByPlaceholder('Dirección completa').fill('Praza de María Pita 1, 2º B, A Coruña')
    await expect(hoja2.getByTestId('estado-direccion')).toHaveAttribute('data-estado', 'portal')
    await expect(hoja2.getByTestId('estado-direccion')).toHaveText(/En el mapa/)
    const sugeridas = hoja2.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(sugeridas.first()).toHaveText(PORTAL.direccion)
    await sugeridas.first().click()
    await expect(hoja2.getByPlaceholder('Dirección completa')).toHaveValue(`${PORTAL.direccion}, 2º B`)
    await expect(hoja2.getByTestId('estado-direccion')).toHaveText(/Sitio encontrado en el mapa/)
    await hoja2.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(2)
    expect(s.creados[1]).toMatchObject({ direccion: `${PORTAL.direccion}, 2º B`, lat: PORTAL.lat, lng: PORTAL.lng, geo_origen: 'sugerencia' })
    expect(s.creados[1]).not.toHaveProperty('precision')                // el portal: tampoco

    // Una parada ya en el mapa (la primera, situada a mano): al editarla, su estado, sin preguntar otra vez.
    const preguntas = s.ubicar.length
    await page.locator('#parada-n1').getByRole('button', { name: 'Más opciones' }).click()      // «Editar», en el ⋮ de la tarjeta (07-11-2026)
    await page.getByRole('menuitem', { name: /Editar parada/ }).click()
    const editar = page.getByRole('dialog', { name: 'Editar parada' })
    await expect(editar.getByTestId('estado-direccion')).toHaveAttribute('data-estado', 'portal')
    await expect(editar.getByTestId('estado-direccion')).toHaveText(/En el mapa/)
    await page.waitForTimeout(700)
    expect(s.ubicar.length).toBe(preguntas)
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('editar una parada sin situar: la ficha dice SU estado (guardar el mismo texto no la sitúa) y su candidato la sitúa', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello(), hospital()], { ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-p1').getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Editar parada: Concello' }).click()
    const hoja = page.getByRole('dialog', { name: 'Editar parada' })
    const estado = hoja.getByTestId('estado-direccion')
    // El servidor ahora la encuentra, pero la parada sigue sin punto: no se dice «En el mapa».
    await expect.poll(() => s.ubicar.length).toBe(1)
    await expect(estado).toHaveAttribute('data-estado', 'no')
    const sugeridas = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(sugeridas.first()).toHaveText(PORTAL.direccion)
    await sugeridas.first().click()
    await expect(estado).toHaveAttribute('data-estado', 'elegida')
    await hoja.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0].id).toBe('p1')
    expect(s.editados[0].cuerpo).toMatchObject({ direccion: PORTAL.direccion, lat: PORTAL.lat, lng: PORTAL.lng, geo_origen: 'sugerencia', cliente: 'Concello' })
    await expect(page.getByText('✓ Cambios guardados')).toBeVisible()
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('el primer paquete escaneado que no está en el mapa lo dice al momento, con «Situar»', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], { escaner: true, ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Escanear', exact: true }).click()
    await page.evaluate(() => { window.__ahora = ['ZX81234599', 'ES|15001|A CORUÑA|CONCELLO|PRAZA DE MARIA PITA 1|600000000'] })
    const hecho = page.getByRole('status').filter({ hasText: 'Añadida a tu ruta' })
    await expect(hecho).toContainText('PRAZA DE MARIA PITA 1, 15001, A CORUÑA')
    await expect(hecho).toContainText('No la encuentro en el mapa')
    expect(s.creados).toHaveLength(1)
    await hecho.getByRole('button', { name: 'Situar' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await expect(situar.getByRole('textbox', { name: 'Dirección' })).toHaveValue('PRAZA DE MARIA PITA 1, 15001, A CORUÑA')
    await situar.getByRole('button', { name: PORTAL.direccion }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    // El mismo portal, escrito como lo da el servidor: va su dirección (03-11-2026, como la app: Situar.esAqui); el
    // servidor no da el CP ni el pueblo aparte (los saca él de la dirección).
    expect(s.editados[0]).toEqual({ id: 'n1', cuerpo: { lat: PORTAL.lat, lng: PORTAL.lng, geo_origen: 'sugerencia', direccion: PORTAL.direccion, cp: '', localidad: '' } })
    await expect(page.getByText('✓ Parada situada en el mapa')).toBeVisible()
    expect(s.fuera).toEqual([])
    expect(s.ventanas).toHaveLength(0)
    expect(fallos).toEqual([])
  })

  /* LO QUE VIO LA PRUEBA EN EL EMULADOR (02-11-2026), en la web: con una calle que no existe, el buscador de mapas daba
     otras calles del mismo CP con el mismo número; y elegir una «Sin el portal» dejaba la ficha en verde y cambiaba
     «Rúa Real 999» por «Calle Real», sin el número. */
  test('una calle que no existe no sugiere otras con el mismo número; una «Sin el portal» no pisa el número escrito', async ({ page }) => {
    const fallos = vigilar(page)
    const CALLE = { lat: 43.3693, lng: -8.4009, precision: 'calle', direccion: 'Calle Real, 15003 A Coruña' }
    const s = await preparar(page, [], {
      ubicar: ({ direccion }) => (/valtrenxo/i.test(direccion)
        ? { encontrada: false, lat: 43.3605, lng: -8.4105, precision: 'zona', direccion: '15011 A Coruña', candidatos: [], atribucion: ATRIBUCION }
        : { encontrada: true, ...CALLE, atribucion: ATRIBUCION, candidatos: [CALLE] }),
    })
    // Lo que contesta Photon a las dos: lo más parecido que tiene (las tres primeras, calles reales del 15011 con el 41).
    const casa = (street, housenumber, postcode, lng, lat) => ({ geometry: { coordinates: [lng, lat] },
      properties: { street, ...(housenumber ? { housenumber } : {}), postcode, city: 'A Coruña', countrycode: 'ES' } })
    await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { features: [
      casa('Rúa Almirante Mourelle', '41', '15011', -8.4101, 43.3611), casa('Rúa Virrey Osorio', '41', '15011', -8.4109, 43.3599),
      casa('Rúa San Pedro de Visma', '41', '15011', -8.4122, 43.3589), casa('Rúa Real', '', '15003', -8.4015, 43.3697)] } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    const estado = hoja.getByTestId('estado-direccion')
    const sugeridas = hoja.getByRole('list', { name: 'Direcciones sugeridas' })

    await dir.fill('Rúa Valtrenxo 41, 15011 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'no')
    await page.waitForTimeout(300)
    await expect(sugeridas).toHaveCount(0)

    // La calle existe y el número no: la del servidor y la de Photon, las dos «Sin el portal»; ninguna otra calle.
    await dir.fill('Rúa Real 999, 15003 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    const opciones = sugeridas.getByRole('button')
    await expect(opciones).toHaveCount(2)
    await expect(opciones.nth(0)).toContainText('Calle Real, 15003 A Coruña')
    await expect(opciones.nth(0)).toContainText('Sin el portal')
    await expect(opciones.nth(1)).toContainText('Rúa Real, 15003 A Coruña')
    await expect(opciones.nth(1)).toContainText('Sin el portal')
    await opciones.nth(0).click()
    await expect(dir).toHaveValue('Rúa Real 999, 15003 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    await expect(estado).toHaveText(/Calle encontrada, sin el portal/)

    // Lo mismo con «Es aquí» en «Situar la parada», eligiendo la de Photon.
    await estado.getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const lista = situar.getByRole('list', { name: 'Direcciones sugeridas' })
    await expect(lista.getByRole('button')).toHaveCount(2)
    await expect(lista.getByText(/Almirante|Virrey|Visma/)).toHaveCount(0)
    await lista.getByRole('button', { name: /Rúa Real, 15003 A Coruña/ }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect(situar).toHaveCount(0)
    await expect(dir).toHaveValue('Rúa Real 999, 15003 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    // La calle sin el portal llega como tal (03-11-2026): "precision": "calle", y el servidor la guarda «aprox».
    expect(s.creados[0]).toMatchObject({ direccion: 'Rúa Real 999, 15003 A Coruña', lat: 43.3697, lng: -8.4015, geo_origen: 'sugerencia', precision: 'calle' })
    // La marca de la ficha se queda en la ficha: el servidor no la conoce.
    expect(s.creados[0]).not.toHaveProperty('elegida_precision')
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  /* LA REGLA DE «OTRA CALLE» (03-11-2026, igual en la app nativa). La revisión vio que a la web le bastaba UNA palabra
     en común: «Rúa Brétema, 15179 Oleiros» salía como normal para «Rúa Brétema Mariñeira 23, 15011 A Coruña» y, al
     tocarla, se quedaba lo escrito con el punto de Oleiros, a 8 km. Y que la precisión del punto elegido no llegaba al
     servidor: una «Sin el portal» quedaba «manual» y enseñaba «Ver la puerta» en el centro de la calle. */
  test('con el número escrito, una de otra calle sale al final y con «Otra calle»; elegirla pone SU dirección, con el piso escrito', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], { ubicar: zona15011, photon: bretema() })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    const estado = hoja.getByTestId('estado-direccion')
    await dir.fill('Rúa Brétema Mariñeira 23, 2º B, 15011 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'no')
    const opciones = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    // La de la calle escrita (sin el portal) primero; la de Oleiros, al final y en rojo; la del 15011 con el 23, fuera.
    await expect(opciones).toHaveCount(2)
    await expect(opciones.nth(0)).toContainText('Rúa Brétema Mariñeira, 15011 A Coruña')
    await expect(opciones.nth(0)).toContainText('Sin el portal')
    await expect(opciones.nth(1)).toContainText('Rúa Brétema, 15179 Oleiros')
    await expect(opciones.nth(1).getByText('Otra calle', { exact: true })).toHaveClass(/text-ruta-peligro-texto/)
    await expect(opciones.nth(1)).not.toContainText('Sin el portal')
    await expect(hoja.getByText(/Almirante Mourelle/)).toHaveCount(0)
    await opciones.nth(1).click()
    // Es otra calle: la dirección pasa a ser la suya, con el piso de lo escrito; nunca lo escrito con el punto de Oleiros.
    await expect(dir).toHaveValue('Rúa Brétema, 15179 Oleiros, 2º B')
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'Rúa Brétema, 15179 Oleiros, 2º B', cp: '15179', localidad: 'Oleiros',
      lat: OLEIROS.lat, lng: OLEIROS.lng, geo_origen: 'sugerencia', precision: 'calle' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('«Situar la parada» con una «Otra calle»: se dice y, con «Es aquí», la parada pasa a SU dirección (y es la calle, no la puerta)', async ({ page }) => {
    const fallos = vigilar(page)
    const taller = { id: 'b1', cliente: 'Taller', direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', cp: '15011', localidad: 'A Coruña',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: null, lng: null, geo: 'zona', zona_lat: 43.3605, zona_lng: -8.4105, telefono: '' }
    const s = await preparar(page, [taller], { ubicar: zona15011, photon: bretema() })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const fila = page.locator('#parada-b1')
    await fila.getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(2)
    await expect(opciones.nth(0)).toContainText('Sin el portal')
    await expect(opciones.nth(1)).toContainText('Rúa Brétema, 15179 Oleiros')
    await expect(opciones.nth(1).getByText('Otra calle', { exact: true })).toHaveClass(/text-ruta-peligro-texto/)
    // Hay una de la calle escrita: no se dice que no la encuentra.
    await expect(situar.getByText('No encuentro esa dirección: mueve el mapa hasta la puerta.')).toHaveCount(0)
    await opciones.nth(1).click()
    await expect(situar.getByTestId('situar-aqui')).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    await expect(situar.getByText(/^Otra calle · Rúa Brétema Mariñeira 23, 15011 A Coruña$/)).toBeVisible()
    await situar.getByRole('button', { name: 'Es aquí' }).click()

    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0]).toEqual({ id: 'b1', cuerpo: { lat: OLEIROS.lat, lng: OLEIROS.lng, geo_origen: 'sugerencia', precision: 'calle',
      direccion: 'Rúa Brétema, 15179 Oleiros', cp: '15179', localidad: 'Oleiros' } })
    await expect(situar).toHaveCount(0)
    await expect(fila.getByText('Rúa Brétema, 15179 Oleiros', { exact: true })).toBeVisible()
    await expect(fila.getByText('Sin el portal', { exact: true })).toBeVisible()
    expect(await verLaPuerta(page, fila)).toBe(0)
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('una «Sin el portal» de la calle escrita se guarda como la calle, con su número escrito; movida la chincheta, ya es «manual»', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello(), hospital()], { ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const fila = page.locator('#parada-p1')
    await fila.getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const lista = situar.getByRole('list', { name: 'Direcciones sugeridas' })
    await lista.getByRole('button', { name: /Sin el portal/ }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    // El punto, su origen y que es la calle: la dirección escrita (con su número) no se toca.
    expect(s.editados[0]).toEqual({ id: 'p1', cuerpo: { lat: 43.3712, lng: -8.3955, geo_origen: 'sugerencia', precision: 'calle' } })
    await expect(page.getByText('✓ Parada situada en el mapa')).toBeVisible()
    await expect(fila.getByText('Praza de María Pita 1, 15001 A Coruña', { exact: true })).toBeVisible()
    await expect(fila.getByText('Sin el portal', { exact: true })).toBeVisible()
    expect(await verLaPuerta(page, fila)).toBe(0)

    // Afinarla: la misma sugerencia, pero moviendo el mapa hasta la puerta, ya no es ella: «manual», sin precisión.
    await fila.getByRole('button', { name: 'Situar en el mapa' }).click()
    await lista.getByRole('button', { name: /Sin el portal/ }).click()
    await page.waitForTimeout(600)
    const b = await situar.getByTestId('situar-mapa').boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(2)
    expect(Object.keys(s.editados[1].cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
    expect(s.editados[1].cuerpo.geo_origen).toBe('mapa')
    expect(await verLaPuerta(page, fila)).toBe(1)
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('sin número escrito no se juzga la calle: un sitio buscado por su nombre sale, y es su portal', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], {
      ubicar: () => ({ encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }),
      photon: [dePhoton('As Xubias de Arriba', '84', '15006', 'A Coruña', -8.3876, 43.3446, { name: 'Hospital Universitario' })],
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    await dir.fill('Hospital Universitario A Coruña')
    const opciones = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toHaveText('As Xubias de Arriba 84, 15006 A Coruña')     // ni «Otra calle» ni «Sin el portal»
    await opciones.first().click()
    await expect(dir).toHaveValue('As Xubias de Arriba 84, 15006 A Coruña')
    await expect(hoja.getByTestId('estado-direccion')).toHaveAttribute('data-estado', 'elegida')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'As Xubias de Arriba 84, 15006 A Coruña', lat: 43.3446, lng: -8.3876, geo_origen: 'sugerencia' })
    expect(s.creados[0]).not.toHaveProperty('precision')
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  /* UNA SOLA REGLA EN TODOS LOS CAMINOS (03-11-2026, lo que vieron el emulador y la revisión): la marca «Otra calle» y
     lo que queda al elegir salen de la dirección de la PARADA (situar.js alElegir), nunca de lo que se escriba en el
     buscador de «Situar». Con la búsqueda corregida a «Rúa Brétema, Oleiros», «Rúa Brétema, 15179 Oleiros» salía como
     una «Sin el portal» normal y la parada se quedaba «Rúa Brétema Mariñeira 23, 15011 A Coruña» con el punto de
     Oleiros, a 8 km (y la guía llevaba allí). */
  test('«Situar» desde la ficha con la búsqueda corregida: la de otra calle se marca por la dirección de la ficha y elegirla pone la suya', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], { ubicar: zona15011 })
    // Photon: para lo escrito en la ficha, nada; para la búsqueda corregida, la calle de Oleiros (sin el portal).
    await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { features: /oleiros/i.test(new URL(r.request().url()).searchParams.get('q') || '')
      ? [dePhoton('Rúa Brétema', '', '15179', 'Oleiros', OLEIROS.lng, OLEIROS.lat)] : [] } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    const estado = hoja.getByTestId('estado-direccion')
    await dir.fill('Rúa Brétema Mariñeira 23, 15011 A Coruña')
    await expect(estado).toHaveAttribute('data-estado', 'no')
    await estado.getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('textbox', { name: 'Dirección' }).fill('Rúa Brétema, Oleiros')
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toContainText('Rúa Brétema, 15179 Oleiros')
    await expect(opciones.first().getByText('Otra calle', { exact: true })).toHaveClass(/text-ruta-peligro-texto/)
    await opciones.first().click()
    await expect(situar.getByText(/^Otra calle · Rúa Brétema Mariñeira 23, 15011 A Coruña$/)).toBeVisible()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect(situar).toHaveCount(0)
    // La dirección pasa a ser la suya (nunca la escrita con el punto de Oleiros), y es la calle, no la puerta.
    await expect(dir).toHaveValue('Rúa Brétema, 15179 Oleiros')
    await expect(estado).toHaveAttribute('data-estado', 'calle')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'Rúa Brétema, 15179 Oleiros', cp: '15179', localidad: 'Oleiros',
      lat: OLEIROS.lat, lng: OLEIROS.lng, geo_origen: 'sugerencia', precision: 'calle' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('«Ir» en la ruta con la búsqueda corregida: un candidato del servidor de otra calle cambia la dirección guardada y la guía va a ella', async ({ page }) => {
    const fallos = vigilar(page)
    const taller = { id: 'b1', cliente: 'Taller', direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', cp: '15011', localidad: 'A Coruña',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: null, lng: null, geo: 'zona', zona_lat: 43.3605, zona_lng: -8.4105, telefono: '' }
    const CAND = { lat: OLEIROS.lat, lng: OLEIROS.lng, precision: 'calle', direccion: 'Rúa Brétema, 15179 Oleiros' }
    const s = await preparar(page, [taller], {
      ubicar: ({ direccion }) => (/oleiros/i.test(direccion) ? { encontrada: true, ...CAND, atribucion: ATRIBUCION, candidatos: [CAND] } : zona15011()) })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-b1').getByRole('button', { name: 'Ir', exact: true }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('textbox', { name: 'Dirección' }).fill('Rúa Brétema, Oleiros')
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first().getByText('Otra calle', { exact: true })).toHaveClass(/text-ruta-peligro-texto/)
    // Lo corregido se pregunta tal cual, sin el CP ni el pueblo de la parada.
    expect(s.ubicar[s.ubicar.length - 1]).toEqual({ direccion: 'Rúa Brétema, Oleiros' })
    await opciones.first().click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    // Su dirección (el servidor no da el CP ni el pueblo aparte: los saca él de la dirección), y es la calle.
    expect(s.editados[0]).toEqual({ id: 'b1', cuerpo: { lat: OLEIROS.lat, lng: OLEIROS.lng, geo_origen: 'sugerencia', precision: 'calle',
      direccion: 'Rúa Brétema, 15179 Oleiros', cp: '', localidad: '' } })
    await expect(page.getByRole('dialog', { name: 'Navegación' })).toBeVisible()
    await expect.poll(() => s.guiadas).toEqual(['b1'])
    expect(s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema, 15179 Oleiros', geo: 'aprox', lat: OLEIROS.lat, lng: OLEIROS.lng })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('la misma calle con otro número («Calle Real 85» para «Rúa Real 999») es la calle: no cambia el 999, ni desde la ruta ni en la ficha', async ({ page }) => {
    const fallos = vigilar(page)
    const bar = { id: 'r9', cliente: 'Bar', direccion: 'Rúa Real 999, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', estado: 'pendiente', bultos: 1,
      orden: 1, eta: '10:05', lat: null, lng: null, geo: 'no', telefono: '' }
    const s = await preparar(page, [bar], {
      ubicar: () => ({ encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }),
      photon: [dePhoton('Calle Real', '85', '15003', 'A Coruña', -8.4012, 43.3699)] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    // Desde la ruta: «Situar», la del 85 (ni «Otra calle» ni «Sin el portal») y «Es aquí».
    const fila = page.locator('#parada-r9')
    await fila.getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toHaveText('Calle Real 85, 15003 A Coruña')
    await opciones.first().click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    // El punto, de dónde sale y que es la calle (el 85 no es la puerta del 999): la dirección no se toca.
    expect(s.editados[0]).toEqual({ id: 'r9', cuerpo: { lat: 43.3699, lng: -8.4012, geo_origen: 'sugerencia', precision: 'calle' } })
    await expect(fila.getByText('Rúa Real 999, 15003 A Coruña', { exact: true })).toBeVisible()
    await expect(fila.getByText('Sin el portal', { exact: true })).toBeVisible()
    expect(await verLaPuerta(page, fila)).toBe(0)

    // En la ficha, lo mismo: elegirla no cambia el 999 (ni el piso) y queda «Calle encontrada, sin el portal».
    await page.getByRole('button', { name: 'Añadir paradas' }).click()
    await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    const dir = hoja.getByPlaceholder('Dirección completa')
    await dir.fill('Rúa Real 999, 2º B, 15003 A Coruña')
    const sugeridas = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(sugeridas).toHaveCount(1)
    await sugeridas.first().click()
    await expect(dir).toHaveValue('Rúa Real 999, 2º B, 15003 A Coruña')
    await expect(hoja.getByTestId('estado-direccion')).toHaveAttribute('data-estado', 'calle')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'Rúa Real 999, 2º B, 15003 A Coruña', lat: 43.3699, lng: -8.4012, geo_origen: 'sugerencia', precision: 'calle' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('una de las suyas («Ya estuviste aquí») va tal cual y con la precisión que dice el servidor: con «calle», «aprox»', async ({ page }) => {
    const fallos = vigilar(page)
    const bar = { id: 'q1', cliente: 'Bar Pepe', direccion: 'Rúa Real, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', estado: 'pendiente', bultos: 1,
      orden: 1, eta: '10:05', lat: null, lng: null, geo: 'no', telefono: '' }
    const s = await preparar(page, [bar], {
      ubicar: () => ({ encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }) })
    // GET /reparto/mis-direcciones dice ya si lo guardado era la puerta o la calle (03-11-2026).
    const SUYA = { direccion: 'Rúa Real, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', lat: 43.3697, lng: -8.4015, cliente: 'Bar Pepe',
      telefono: '600111222', veces: 3, ultima: '2026-10-30', precision: 'calle' }
    await page.route(/\/api\/reparto\/mis-direcciones/, (r) => r.fulfill({ json: { direcciones: [SUYA] } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    // Desde la ruta: «Es aquí» con la suya manda "precision": "calle" (antes no iba nada: «manual», y «Ver la puerta»).
    const fila = page.locator('#parada-q1')
    await fila.getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button', { name: /Ya estuviste aquí/ }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0]).toEqual({ id: 'q1', cuerpo: { lat: SUYA.lat, lng: SUYA.lng, geo_origen: 'sugerencia', precision: 'calle' } })
    await expect(fila.getByText('Sin el portal', { exact: true })).toBeVisible()
    expect(await verLaPuerta(page, fila)).toBe(0)

    // En la ficha: tal cual (su dirección, el cliente y el teléfono) y «Calle encontrada, sin el portal».
    await page.getByRole('button', { name: 'Añadir paradas' }).click()
    await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    await hoja.getByPlaceholder('Dirección completa').fill('real coruña')
    await hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button', { name: /Ya estuviste aquí/ }).click()
    await expect(hoja.getByPlaceholder('Dirección completa')).toHaveValue(SUYA.direccion)
    await expect(hoja.getByPlaceholder('Cliente', { exact: true })).toHaveValue('Bar Pepe')
    await expect(hoja.getByTestId('estado-direccion')).toHaveAttribute('data-estado', 'calle')
    await hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: SUYA.direccion, cliente: 'Bar Pepe', telefono: '600111222', lat: SUYA.lat, lng: SUYA.lng,
      geo_origen: 'sugerencia', precision: 'calle' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('con el número escrito no sale una calle que solo comparte el título: «Almirante Cervera 41» para «Almirante Mourelle 41»', async ({ page }) => {
    const fallos = vigilar(page)
    await preparar(page, [], { ubicar: zona15011, photon: [
      dePhoton('Rúa Almirante Cervera', '41', '15011', 'A Coruña', -8.4111, 43.3601), dePhoton('Rúa Almirante Mourelle', '', '15011', 'A Coruña', -8.4101, 43.3611)] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    await hoja.getByPlaceholder('Dirección completa').fill('Rúa Almirante Mourelle 41, 15011 A Coruña')
    const opciones = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toContainText('Rúa Almirante Mourelle, 15011 A Coruña')
    await expect(opciones.first()).toContainText('Sin el portal')
    await expect(hoja.getByText(/Cervera/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('una parada sin número (un sitio por su nombre) toma la dirección de lo elegido también desde la ruta', async ({ page }) => {
    const fallos = vigilar(page)
    const hosp = { id: 'h1', cliente: 'Hospital', direccion: 'Hospital Universitario A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
      lat: null, lng: null, geo: 'no', telefono: '' }
    const s = await preparar(page, [hosp], {
      ubicar: () => ({ encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }),
      photon: [dePhoton('As Xubias de Arriba', '84', '15006', 'A Coruña', -8.3876, 43.3446, { name: 'Hospital Universitario' })] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const fila = page.locator('#parada-h1')
    await fila.getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toHaveText('As Xubias de Arriba 84, 15006 A Coruña')        // sin número escrito: sin marcas
    await opciones.first().click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    // Es su portal (sin "precision") y la dirección pasa a ser la suya, con su CP y su población.
    expect(s.editados[0]).toEqual({ id: 'h1', cuerpo: { lat: 43.3446, lng: -8.3876, geo_origen: 'sugerencia',
      direccion: 'As Xubias de Arriba 84, 15006 A Coruña', cp: '15006', localidad: 'A Coruña' } })
    await expect(fila.getByText('As Xubias de Arriba 84, 15006 A Coruña', { exact: true })).toBeVisible()
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  /* AL REESCRIBIR LA DIRECCIÓN DE LA FICHA (03-11-2026 de madrugada, la revisión; la regla D, igual en la app nativa):
     se tocaba «Rúa Real 5, 15179 Oleiros», se corregía a «Rúa Real 5, 15003 A Coruña» y solo se quitaba el punto: el
     alta llevaba el CP y la población de Oleiros, y el servidor (que usa el CP que le llega antes que el del texto)
     buscaba la dirección nueva en Oleiros. Ahora, tecleando o dictando, se va todo lo que vino con el punto o la
     sugerencia, venga de la lista, de «Situar la parada» o del mapa. */
  test('al reescribir o dictar la dirección de la ficha, el alta va sin el punto, ni el CP ni la población de lo elegido', async ({ page }) => {
    const fallos = vigilar(page)
    // El dictado del navegador, simulado: window.__decir(frase) es lo que se oye.
    await page.addInitScript(() => {
      window.webkitSpeechRecognition = class {
        constructor() { window.__rec = this }
        start() {}
        stop() { this.onend?.() }
        abort() {}
      }
      window.SpeechRecognition = window.webkitSpeechRecognition
      window.__decir = (frase) => {
        window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: frase }], { isFinal: true })] })
        window.__rec.onend?.()
      }
    })
    const REAL5 = { lat: 43.3291, lng: -8.3502 }
    const s = await preparar(page, [], {
      ubicar: () => ({ encontrada: false, lat: null, lng: null, precision: null, direccion: null, candidatos: [], atribucion: ATRIBUCION }),
      photon: [dePhoton('Rúa Real', '5', '15179', 'Oleiros', REAL5.lng, REAL5.lat)] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const nueva = async (primera) => {
      if (primera) await page.getByRole('button', { name: 'A mano', exact: true }).click()
      else {
        await page.getByRole('button', { name: 'Añadir paradas' }).click()
        await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
      }
      const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
      return { hoja, dir: hoja.getByPlaceholder('Dirección completa'), estado: hoja.getByTestId('estado-direccion'),
        sugeridas: hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button') }
    }
    const NUEVA = 'Rúa Real 5, 15003 A Coruña'
    // Sin el punto, ni su origen, ni su precisión, ni el CP y la población de Oleiros: el servidor busca lo escrito.
    const sinLoElegido = (b) => {
      expect(b).toMatchObject({ direccion: NUEVA, lat: null, lng: null })
      expect([b.cp || '', b.localidad || '']).toEqual(['', ''])
      for (const k of ['geo_origen', 'precision', 'elegida_precision', 'lugar_elegido']) expect(b, k).not.toHaveProperty(k)
    }

    // 1. Elegida de la lista, y corregida tecleando.
    let f = await nueva(true)
    await f.dir.fill('Rúa Real 5, 15179 Oleiros')
    await expect(f.sugeridas).toHaveCount(1)
    await f.sugeridas.first().click()
    await expect(f.estado).toHaveAttribute('data-estado', 'elegida')
    await f.dir.fill(NUEVA)
    await expect(f.estado).not.toHaveAttribute('data-estado', 'elegida')
    // La de Oleiros vuelve a salir, ya como «Otra calle» de la escrita (otro CP y otro pueblo: la regla B).
    await expect(f.sugeridas.first()).toContainText('Rúa Real 5, 15179 Oleiros')
    await expect(f.sugeridas.first().getByText('Otra calle', { exact: true })).toBeVisible()
    await f.hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    sinLoElegido(s.creados[0])

    // 2. Elegida en «Situar la parada» con «Es aquí», y corregida dictando.
    f = await nueva(false)
    await f.dir.fill('Rúa Real 5, 15179 Oleiros')
    await expect(f.estado).toHaveAttribute('data-estado', 'no')
    await f.estado.getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button', { name: /Rúa Real 5, 15179 Oleiros/ }).click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect(situar).toHaveCount(0)
    await expect(f.estado).toHaveAttribute('data-estado', 'elegida')
    await f.hoja.getByRole('button', { name: 'Dictar la dirección' }).click()
    await page.evaluate((frase) => window.__decir(frase), NUEVA)
    await expect(f.dir).toHaveValue(NUEVA)
    await f.hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(2)
    sinLoElegido(s.creados[1])

    // 3. Elegida de la lista, puesta luego a mano en el mapa («Cambiar», «Mi ubicación», «Es aquí»), y corregida.
    f = await nueva(false)
    await f.dir.fill('Rúa Real 5, 15179 Oleiros')
    await f.sugeridas.first().click()
    await f.estado.getByRole('button', { name: 'Cambiar' }).click()
    await situar.getByRole('button', { name: 'Mi ubicación' }).click()
    await expect(situar.getByRole('button', { name: 'Es aquí' })).toBeEnabled()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect(situar).toHaveCount(0)
    await expect(f.estado).toHaveAttribute('data-estado', 'mano')
    await f.dir.fill(NUEVA)
    await f.hoja.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(3)
    sinLoElegido(s.creados[2])
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('a Photon va lo buscado sin el piso, desde «Situar» y desde la ficha; al servidor, tal cual (C)', async ({ page }) => {
    const fallos = vigilar(page)
    // Lo visto en el emulador: con el piso, Photon toma el «2 B» por el portal y da el 2B, a 380 m del 50.
    const M50 = { lat: 43.33012, lng: -8.46481 }
    const meicende = { id: 'm1', cliente: 'Meicende', direccion: 'Trav. de Meicende nº50 2 B, 15140, Arteixo', cp: '15140', localidad: 'Arteixo',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: null, lng: null, geo: 'zona', zona_lat: 43.3301, zona_lng: -8.4652, telefono: '' }
    const s = await preparar(page, [meicende, hospital()], { ubicar: () => ({ encontrada: false, lat: 43.3301, lng: -8.4652, precision: 'zona',
      direccion: '15140 Arteixo', candidatos: [], atribucion: ATRIBUCION }) })
    const pedidas = []
    await page.route(/photon\.komoot\.io/, (r) => {
      const q = new URL(r.request().url()).searchParams.get('q') || ''
      pedidas.push(q)
      return r.fulfill({ json: { features: /2 B|1 dcha/.test(q)
        ? [dePhoton('Travesía de Meicende', '2B', '15140', 'Arteixo', -8.4612, 43.3318), dePhoton('Rúa Real', '1', '15003', 'A Coruña', -8.4015, 43.3702)]
        : [dePhoton('Travesía de Meicende', '50', '15140', 'Arteixo', M50.lng, M50.lat), dePhoton('Rúa Real', '5', '15003', 'A Coruña', -8.4011, 43.3704)] } })
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-m1').getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opciones = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(opciones).toHaveCount(1)
    await expect(opciones.first()).toContainText('Travesía de Meicende 50, 15140 Arteixo')
    expect(pedidas).toEqual(['Trav. de Meicende nº50, 15140, Arteixo'])
    // Al servidor, lo escrito tal cual, con el CP y la población de la parada.
    expect(s.ubicar[0]).toEqual({ direccion: 'Trav. de Meicende nº50 2 B, 15140, Arteixo', cp: '15140', localidad: 'Arteixo' })
    // El mismo portal (3a): su dirección con el piso escrito y el punto del 50, no el del 2B.
    await opciones.first().click()
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0].cuerpo).toMatchObject({ lat: M50.lat, lng: M50.lng, geo_origen: 'sugerencia', direccion: 'Travesía de Meicende 50, 15140 Arteixo, 2 B',
      cp: '15140', localidad: 'Arteixo' })
    expect(s.editados[0].cuerpo).not.toHaveProperty('precision')

    // Desde la ficha, lo mismo: a Photon sin el «1 dcha»; al servidor, tal cual.
    await page.getByRole('button', { name: 'Añadir paradas' }).click()
    await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Nueva parada' })
    await hoja.getByPlaceholder('Dirección completa').fill('Rúa Real 5 1 dcha, 15003 A Coruña')
    const sugeridas = hoja.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button')
    await expect(sugeridas).toHaveCount(1)
    await expect(sugeridas.first()).toContainText('Rúa Real 5, 15003 A Coruña')
    expect(pedidas[pedidas.length - 1]).toBe('Rúa Real 5, 15003 A Coruña')
    expect(pedidas.some((q) => /dcha/.test(q))).toBe(false)
    await expect.poll(() => s.ubicar.map((b) => b.direccion)).toContain('Rúa Real 5 1 dcha, 15003 A Coruña')
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  /* LA FICHA COMPACTA (07-11-2026, diseño compacto, §5.9). A 360 se ve sin desplazar lo principal (la dirección, el cliente, el
     teléfono y el botón de abajo, que va fijo); lo demás está tras «Más datos», cerrado al crear. Y lo que se guarda es lo de siempre
     aunque los controles sean otros: «Bultos − 1 +» da un número, «Urgente» es un interruptor y «Entrega | Recogida» un segmentado. */
  test('la ficha compacta: lo principal y el botón a la vista a 360, «Más datos» cerrado, y lo de dentro se guarda como siempre', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [], { ubicar: conPortal })
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'A mano', exact: true }).click()
    const ficha = page.getByRole('dialog', { name: 'Nueva parada' })
    for (const loPrincipal of [ficha.getByPlaceholder('Dirección completa'), ficha.getByPlaceholder('Cliente', { exact: true }),
      ficha.getByPlaceholder('Teléfono', { exact: true }), ficha.getByRole('button', { name: 'Añadir a mi ruta' })]) {
      await expect(loPrincipal).toBeInViewport({ ratio: 1 })
    }
    await expect(ficha.getByRole('button', { name: 'Añadir a mi ruta' })).toBeDisabled()          // sin dirección, no se añade
    const mas = ficha.getByRole('button', { name: 'Más datos' })
    await expect(mas).toHaveAttribute('aria-expanded', 'false')
    await expect(ficha.getByPlaceholder('Qué lleva')).toHaveCount(0)
    await expect(ficha.getByRole('switch', { name: 'Urgente' })).toHaveCount(0)

    await ficha.getByPlaceholder('Dirección completa').fill('Praza de María Pita 1, A Coruña')
    await ficha.getByPlaceholder('Cliente', { exact: true }).fill('Concello')
    await ficha.getByPlaceholder('Teléfono', { exact: true }).fill('600111222')
    await mas.click()
    await expect(mas).toHaveAttribute('aria-expanded', 'true')
    await ficha.getByPlaceholder('Qué lleva').fill('Medicinas')
    // Los atajos del horario: «9–14», «16–20» y «Hasta 14:00» (lo que guardan es lo de siempre: «16-20»).
    const atajos = ficha.getByTestId('atajos-horario')
    await expect(atajos.getByRole('button')).toHaveText(['9–14', '16–20', 'Hasta 14:00'])
    await atajos.getByRole('button', { name: '16–20' }).click()
    await expect(ficha.getByPlaceholder('Horario del cliente (ej. de 10 a 12)')).toHaveValue('16-20')
    await expect(atajos.getByRole('button', { name: '16–20' })).toHaveAttribute('aria-pressed', 'true')
    await ficha.getByRole('button', { name: 'Detrás · izq' }).click()
    const bultos = ficha.getByRole('group', { name: 'Bultos' })
    await expect(ficha.getByRole('button', { name: 'Uno menos' })).toBeDisabled()                 // con 1 no baja más
    await ficha.getByRole('button', { name: 'Uno más' }).click()
    await ficha.getByRole('button', { name: 'Uno más' }).click()
    await expect(bultos).toContainText('3')
    await ficha.getByRole('switch', { name: 'Urgente' }).check()
    await ficha.getByRole('button', { name: 'Recogida' }).click()
    await ficha.getByPlaceholder('A cobrar (€)').fill('12,50')
    await ficha.getByRole('button', { name: 'Añadir a mi ruta' }).click()
    await expect.poll(() => s.creados.length).toBe(1)
    expect(s.creados[0]).toMatchObject({ direccion: 'Praza de María Pita 1, A Coruña', cliente: 'Concello', telefono: '600111222', contenido: 'Medicinas',
      horario: '16-20', hueco: 'Detrás · izq', bultos: 3, prioridad: true, tipo: 'recogida', cobrar: '12,50' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })

  test('editar una parada con datos: «Más datos» sale abierto con lo guardado y vuelve tal cual', async ({ page }) => {
    const fallos = vigilar(page)
    const s = await preparar(page, [concello({ geo: 'ok', lat: PORTAL.lat, lng: PORTAL.lng, telefono: '600111222', contenido: 'Medicinas', bultos: 2, prioridad: true,
      cobrar: 5, tipo: 'recogida', ventana_desde: '10:00', ventana_hasta: '12:00', hueco: 'Detrás · izq' }), hospital()], { ubicar: conPortal })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-p1').getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Editar parada: Concello' }).click()
    const ficha = page.getByRole('dialog', { name: 'Editar parada' })
    await expect(ficha.getByRole('button', { name: 'Más datos' })).toHaveAttribute('aria-expanded', 'true')
    await expect(ficha.getByText('Foto etiqueta')).toHaveCount(0)                                 // al editar no hay foto de la etiqueta
    await expect(ficha.getByPlaceholder('Qué lleva')).toHaveValue('Medicinas')
    await expect(ficha.getByPlaceholder('Horario del cliente (ej. de 10 a 12)')).toHaveValue('de 10:00 a 12:00')
    await expect(ficha.getByRole('button', { name: 'Detrás · izq' })).toHaveAttribute('aria-pressed', 'true')
    await expect(ficha.getByRole('group', { name: 'Bultos' })).toContainText('2')
    await expect(ficha.getByRole('switch', { name: 'Urgente' })).toBeChecked()
    await expect(ficha.getByRole('button', { name: 'Recogida' })).toHaveAttribute('aria-pressed', 'true')
    await expect(ficha.getByPlaceholder('A cobrar (€)')).toHaveValue('5')
    await ficha.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0].id).toBe('p1')
    expect(s.editados[0].cuerpo).toMatchObject({ cliente: 'Concello', telefono: '600111222', contenido: 'Medicinas', bultos: 2, prioridad: true, tipo: 'recogida',
      cobrar: '5', hueco: 'Detrás · izq', horario: 'de 10:00 a 12:00' })
    expect(s.fuera).toEqual([])
    expect(fallos).toEqual([])
  })
})

/* EL ZOOM CON LOS DEDOS NO OLVIDA LA SUGERENCIA (03-11-2026, el revisor; como la app nativa: Situar.alPararse). Tras
   elegir «Rúa Brétema, 15179 Oleiros · Otra calle» para «Rúa Brétema Mariñeira 23, 15011 A Coruña», alejar el mapa con
   los dedos hasta el 13 o el 12 la olvidaba (Leaflet no amplía sobre el centro exacto: medio píxel, más de 3 m a ese
   zoom), y al acercar «Es aquí» mandaba el punto de Oleiros sin la dirección: la parada quedaba con lo escrito y el punto
   de Oleiros como «manual», a 8 km. Lo mismo al girar el móvil. Con pellizcos de verdad (Input.dispatchTouchEvent de
   Chromium, como el revisor) en un tamaño impar: la sugerencia sigue; solo un arrastre de verdad la olvida. */
test.describe('situar la parada con los dedos', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 391, height: 845 }, hasTouch: true, geolocation: AQUI, permissions: ['geolocation'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  /** La ruta con el taller sin situar y «Situar la parada» abierta con la de Oleiros elegida. `zooms`, el de cada tesela
   *  que pide el mapa. */
  async function conOleirosElegida(page) {
    const fallos = vigilar(page)
    const taller = { id: 'b1', cliente: 'Taller', direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', cp: '15011', localidad: 'A Coruña',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: null, lng: null, geo: 'zona', zona_lat: 43.3605, zona_lng: -8.4105, telefono: '' }
    const s = await preparar(page, [taller], { ubicar: zona15011, photon: bretema() })
    const zooms = []
    await page.route(/tile\.openstreetmap\.org/, (r) => {
      zooms.push(Number(new URL(r.request().url()).pathname.split('/')[1]))
      return r.fulfill({ status: 200, contentType: 'image/png', body: TESELA })
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-b1').getByTestId('situar-parada').click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    await situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button').filter({ hasText: 'Rúa Brétema, 15179 Oleiros' }).click()
    const aqui = situar.getByTestId('situar-aqui')
    await expect(aqui).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    await page.waitForTimeout(800)                                   // el mapa llega a ella (y a su zoom, el 17)
    const caja = await situar.getByTestId('situar-mapa').boundingBox()
    return { fallos, s, zooms, situar, aqui, caja, cdp: await page.context().newCDPSession(page) }
  }

  /** Un pellizco de dos dedos en el centro del mapa, de `desde` a `hasta` píxeles de él cada dedo (la mitad: un zoom menos). */
  async function pellizco(page, { cdp, caja }, desde, hasta) {
    const cx = caja.x + caja.width / 2
    const cy = caja.y + caja.height / 2
    const dedos = (d) => [{ x: cx - d, y: cy, id: 0, radiusX: 4, radiusY: 4, force: 1 }, { x: cx + d, y: cy, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedos(desde) })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedos(desde + ((hasta - desde) * i) / 8) })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(600)
  }

  // Lo que manda «Es aquí» con la de Oleiros: su dirección, de la sugerencia y la calle (nunca lo escrito con su punto).
  const deOleiros = { id: 'b1', cuerpo: { lat: OLEIROS.lat, lng: OLEIROS.lng, geo_origen: 'sugerencia', precision: 'calle',
    direccion: 'Rúa Brétema, 15179 Oleiros', cp: '15179', localidad: 'Oleiros' } }

  test('alejar y acercar con los dedos hasta el zoom 12 no olvida la sugerencia: «Es aquí» manda la dirección de Oleiros', async ({ page }) => {
    const v = await conOleirosElegida(page)
    // Un tamaño impar: el centro cae entre dos píxeles, que es cuando más se desvía.
    expect(Math.round(v.caja.width) % 2).toBe(1)
    for (let i = 0; i < 5; i++) {
      await pellizco(page, v, 120, 60)
      await expect(v.aqui, `al alejar ${i + 1}`).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    }
    expect(Math.min(...v.zooms)).toBeLessThanOrEqual(13)
    await expect(v.situar.getByText(/^Otra calle · Rúa Brétema Mariñeira 23, 15011 A Coruña$/)).toBeVisible()
    for (let i = 0; i < 5; i++) {
      await pellizco(page, v, 60, 120)
      await expect(v.aqui, `al acercar ${i + 1}`).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    }
    await v.situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => v.s.editados.length).toBe(1)
    expect(v.s.editados[0]).toEqual(deOleiros)
    expect(v.s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema, 15179 Oleiros', geo: 'aprox' })
    expect(v.s.fuera).toEqual([])
    expect(v.fallos).toEqual([])
  })

  test('girar el móvil (el mapa cambia de tamaño) no olvida la sugerencia', async ({ page }) => {
    const v = await conOleirosElegida(page)
    // Lejos (con el teclado, que amplía sobre el centro exacto), y luego el giro, a un tamaño impar, y vuelta.
    await v.situar.getByTestId('situar-mapa').focus()
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Minus'); await page.waitForTimeout(450) }
    expect(Math.min(...v.zooms)).toBeLessThanOrEqual(13)
    await page.setViewportSize({ width: 845, height: 391 })
    await page.waitForTimeout(700)
    await expect(v.aqui).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    await page.setViewportSize({ width: 391, height: 845 })
    await page.waitForTimeout(700)
    await expect(v.aqui).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Equal'); await page.waitForTimeout(450) }
    await expect(v.aqui).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
    await v.situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => v.s.editados.length).toBe(1)
    expect(v.s.editados[0]).toEqual(deOleiros)
    expect(v.fallos).toEqual([])
  })

  test('un arrastre de verdad con el dedo sí la olvida: «Es aquí» es el punto puesto a mano («mapa»)', async ({ page }) => {
    const v = await conOleirosElegida(page)
    const cx = v.caja.x + v.caja.width / 2
    const cy = v.caja.y + v.caja.height / 2
    const dedo = (dx, dy) => [{ x: cx + dx, y: cy + dy, id: 0, radiusX: 4, radiusY: 4, force: 1 }]
    await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedo(0, 0) })
    for (let i = 1; i <= 8; i++) {
      await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedo(8 * i, 4 * i) })
      await page.waitForTimeout(20)
    }
    await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(600)
    await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
    await v.situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => v.s.editados.length).toBe(1)
    const { cuerpo } = v.s.editados[0]
    expect(Object.keys(cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
    expect(cuerpo.geo_origen).toBe('mapa')
    // Movido unos 70 px a zoom 17: ya no es el punto de Oleiros (la dirección escrita no cambia).
    expect(Math.abs(cuerpo.lat - OLEIROS.lat) + Math.abs(cuerpo.lng - OLEIROS.lng)).toBeGreaterThan(0.0001)
    expect(v.s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', geo: 'manual' })
    expect(v.fallos).toEqual([])
  })

  test('girar el móvil a mitad del viaje hacia la sugerencia tampoco la olvida: el tamaño se ajusta al pararse', async ({ page }) => {
    // La parada ya situada (la calle), y una «Otra calle» con portal a unos 40 m: a zoom 18 el mapa va hacia ella con
    // una animación de 250 ms, y el giro llega en medio (con invalidateSize ahí, llegaba a 70 px de ella y se olvidaba).
    const fallos = vigilar(page)
    const taller = { id: 'b1', cliente: 'Taller', direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', cp: '15011', localidad: 'A Coruña',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.3605, lng: -8.4105, geo: 'aprox', telefono: '' }
    const CERCA = { lat: 43.3607, lng: -8.4109 }
    const s = await preparar(page, [taller], { ubicar: zona15011, photon: [dePhoton('Rúa Brétema', '23', '15011', 'A Coruña', CERCA.lng, CERCA.lat)] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-b1').getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opcion = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button').filter({ hasText: 'Rúa Brétema 23, 15011 A Coruña' })
    await expect(opcion.getByText('Otra calle', { exact: true })).toBeVisible()
    await page.waitForTimeout(600)
    await opcion.click()
    await page.setViewportSize({ width: 391, height: 701 })
    const enMarcha = await page.evaluate(() => !!document.querySelector('.leaflet-pan-anim, .leaflet-zoom-anim'))
    test.info().annotations.push({ type: 'giro', description: enMarcha ? 'a mitad de la animación' : 'la animación ya había acabado' })
    await page.waitForTimeout(900)
    await expect(situar.getByTestId('situar-aqui')).toHaveText('Aquí: Rúa Brétema 23, 15011 A Coruña')
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0]).toEqual({ id: 'b1', cuerpo: { lat: CERCA.lat, lng: CERCA.lng, geo_origen: 'sugerencia', direccion: 'Rúa Brétema 23, 15011 A Coruña',
      cp: '15011', localidad: 'A Coruña' } })
    expect(fallos).toEqual([])
  })

  test('las flechas del teclado mueven el mapa 80 px: también la olvidan, como un arrastre', async ({ page }) => {
    const v = await conOleirosElegida(page)
    await v.situar.getByTestId('situar-mapa').focus()
    await page.keyboard.press('ArrowRight')
    await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
    await page.waitForTimeout(400)
    await v.situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => v.s.editados.length).toBe(1)
    expect(Object.keys(v.s.editados[0].cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
    expect(v.s.editados[0].cuerpo.geo_origen).toBe('mapa')
    expect(v.fallos).toEqual([])
  })

  /* EL PELLIZCO QUE EMPIEZA COMO ARRASTRE (A2, 03-11-2026, el revisor): el primer dedo toca, se mueve `px` y entonces
     llega el segundo, como en un móvil de verdad. Con 16 px o más, Leaflet ya ha lanzado dragstart, y la sugerencia se
     olvidaba: «Es aquí» mandaba «mapa», lo escrito con el punto de Oleiros. Devuelve si Leaflet arrastraba ya. */
  async function escalonado(page, { cdp, caja }, px, desde, hasta) {
    const cx = caja.x + caja.width / 2
    const cy = caja.y + caja.height / 2
    const pt = (x, id) => ({ x, y: cy, id, radiusX: 4, radiusY: 4, force: 1 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(cx - desde, 0)] })
    for (let i = 1; i <= 3; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(cx - desde - (px * i) / 3, 0)] })
      await page.waitForTimeout(16)
    }
    const arrastraba = await page.evaluate(() => document.body.classList.contains('leaflet-dragging'))
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(cx - desde - px, 0), pt(cx + desde, 1)] })
    for (let i = 1; i <= 8; i++) {
      const d = desde + ((hasta - desde) * i) / 8
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(cx - d - px, 0), pt(cx + d, 1)] })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(600)
    return arrastraba
  }

  for (const px of [16, 24]) {
    test(`un pellizco con el primer dedo movido ${px} px antes del segundo no la olvida: «Es aquí» manda la de Oleiros (A2)`, async ({ page }) => {
      const v = await conOleirosElegida(page)
      const arrastres = []
      for (let i = 0; i < 4; i++) {
        arrastres.push(await escalonado(page, v, px, 120, 60))
        await expect(v.aqui, `al alejar ${i + 1}`).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
      }
      expect(Math.min(...v.zooms)).toBeLessThanOrEqual(13)
      for (let i = 0; i < 4; i++) {
        arrastres.push(await escalonado(page, v, px, 60, 120))
        await expect(v.aqui, `al acercar ${i + 1}`).toHaveText('Aquí: Rúa Brétema, 15179 Oleiros')
      }
      // Todos empezaron como un arrastre de Leaflet (dragstart), y eran pellizcos.
      expect(arrastres).toEqual(Array(8).fill(true))
      await expect(v.situar.getByText(/^Otra calle · Rúa Brétema Mariñeira 23, 15011 A Coruña$/)).toBeVisible()
      await v.situar.getByRole('button', { name: 'Es aquí' }).click()
      await expect.poll(() => v.s.editados.length).toBe(1)
      expect(v.s.editados[0]).toEqual(deOleiros)
      expect(v.s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema, 15179 Oleiros', geo: 'aprox' })
      expect(v.s.fuera).toEqual([])
      expect(v.fallos).toEqual([])
    })

    test(`un arrastre de ${px} px con un dedo sí la olvida, y mientras se arrastra ya no se dice: «Es aquí» manda «mapa» (A2)`, async ({ page }) => {
      const v = await conOleirosElegida(page)
      const cx = v.caja.x + v.caja.width / 2
      const cy = v.caja.y + v.caja.height / 2
      const dedo = (x) => [{ x, y: cy, id: 0, radiusX: 4, radiusY: 4, force: 1 }]
      await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedo(cx) })
      for (let i = 1; i <= 4; i++) {
        await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedo(cx - (px * i) / 4) })
        await page.waitForTimeout(16)
      }
      // Con el dedo aún en el mapa: abajo ya no dice la de Oleiros, ni «Otra calle».
      await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
      await expect(v.situar.getByText(/^Otra calle · /)).toHaveCount(0)
      await v.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(600)
      await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
      await v.situar.getByRole('button', { name: 'Es aquí' }).click()
      await expect.poll(() => v.s.editados.length).toBe(1)
      const { cuerpo } = v.s.editados[0]
      expect(Object.keys(cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
      expect(cuerpo.geo_origen).toBe('mapa')
      expect(Math.abs(cuerpo.lat - OLEIROS.lat) + Math.abs(cuerpo.lng - OLEIROS.lng)).toBeGreaterThan(0.0001)
      expect(v.s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', geo: 'manual' })
      expect(v.fallos).toEqual([])
    })
  }

  /* EL SEGUNDO DEDO TRAS UN ARRASTRE LARGO (A3, 03-11-2026, la séptima tanda): el primer dedo arrastra el mapa 80 px y,
     sin soltarlo, llega el segundo para un pellizco (alejar o acercar). El segundo dedo la volvía a dar por buena, el
     mapa volvía a ella y «Es aquí» mandaba la de Oleiros, no el punto movido a mano. Ahora es un arrastre: «mapa». */
  // Lo que manda «Es aquí» tras arrastrar el mapa hacia la izquierda: el punto movido, al este de Oleiros (80 px a zoom
  // 17 son unos 0,0009°), a su misma latitud, y la dirección escrita no cambia.
  async function mandaElArrastrado(v) {
    await v.situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => v.s.editados.length).toBe(1)
    const { cuerpo } = v.s.editados[0]
    expect(Object.keys(cuerpo).sort()).toEqual(['geo_origen', 'lat', 'lng'])
    expect(cuerpo.geo_origen).toBe('mapa')
    expect(cuerpo.lng - OLEIROS.lng).toBeGreaterThan(0.0004)
    expect(Math.abs(cuerpo.lat - OLEIROS.lat)).toBeLessThan(0.0002)
    expect(v.s.ruta.pedidos[0]).toMatchObject({ direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', geo: 'manual' })
    expect(v.s.fuera).toEqual([])
    expect(v.fallos).toEqual([])
  }

  for (const [desde, hasta, que] of [[120, 60, 'alejar'], [60, 120, 'acercar']]) {
    test(`un arrastre de 80 px con un dedo y luego el segundo para ${que} la olvida: «Es aquí» manda «mapa», el punto arrastrado (A3)`, async ({ page }) => {
      const v = await conOleirosElegida(page)
      expect(await escalonado(page, v, 80, desde, hasta)).toBe(true)
      await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
      await expect(v.situar.getByText(/^Otra calle · /)).toHaveCount(0)
      await mandaElArrastrado(v)
    })
  }

  test('con el ratón: arrastrar 80 px y, sin soltar, la rueda también la olvida: «Es aquí» manda «mapa» (A3)', async ({ page }) => {
    const v = await conOleirosElegida(page)
    const cx = v.caja.x + v.caja.width / 2
    const cy = v.caja.y + v.caja.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) { await page.mouse.move(cx - 10 * i, cy); await page.waitForTimeout(16) }
    await page.mouse.wheel(0, -50)                                     // acerca uno, con el botón aún pulsado
    await page.waitForTimeout(600)
    await page.mouse.up()
    await page.waitForTimeout(400)
    expect(Math.max(...v.zooms)).toBe(18)
    await expect(v.aqui).toHaveText('Rúa Brétema Mariñeira 23, 15011 A Coruña')
    await mandaElArrastrado(v)
  })

  test('elegirla y pellizcar enseguida, con el mapa aún yendo hacia ella, no la olvida: no es un arrastre (A3)', async ({ page }) => {
    // Como «girar el móvil a mitad del viaje»: a zoom 18, el mapa va a la de 40 m (unos 90 px) en 250 ms, y el pellizco
    // llega en medio. El centro aún está lejos, pero lo mueve la app (destino), no la persona.
    const fallos = vigilar(page)
    const taller = { id: 'b1', cliente: 'Taller', direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', cp: '15011', localidad: 'A Coruña',
      estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.3605, lng: -8.4105, geo: 'aprox', telefono: '' }
    const CERCA = { lat: 43.3607, lng: -8.4109 }
    const s = await preparar(page, [taller], { ubicar: zona15011, photon: [dePhoton('Rúa Brétema', '23', '15011', 'A Coruña', CERCA.lng, CERCA.lat)] })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.locator('#parada-b1').getByRole('button', { name: 'Situar en el mapa' }).click()
    const situar = page.getByRole('dialog', { name: 'Situar la parada' })
    const opcion = situar.getByRole('list', { name: 'Direcciones sugeridas' }).getByRole('button').filter({ hasText: 'Rúa Brétema 23, 15011 A Coruña' })
    await expect(opcion.getByText('Otra calle', { exact: true })).toBeVisible()
    await page.waitForTimeout(600)
    const caja = await situar.getByTestId('situar-mapa').boundingBox()
    const cdp = await page.context().newCDPSession(page)
    const cx = caja.x + caja.width / 2
    const cy = caja.y + caja.height / 2
    const dedos = (d) => [{ x: cx - d, y: cy, id: 0, radiusX: 4, radiusY: 4, force: 1 }, { x: cx + d, y: cy, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
    await opcion.click()
    const enMarcha = await page.evaluate(() => !!document.querySelector('.leaflet-pan-anim'))
    test.info().annotations.push({ type: 'pellizco', description: enMarcha ? 'a mitad del viaje' : 'el viaje ya había acabado' })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedos(120) })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedos(120 - (60 * i) / 8) })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(600)
    await expect(situar.getByTestId('situar-aqui')).toHaveText('Aquí: Rúa Brétema 23, 15011 A Coruña')
    await situar.getByRole('button', { name: 'Es aquí' }).click()
    await expect.poll(() => s.editados.length).toBe(1)
    expect(s.editados[0]).toEqual({ id: 'b1', cuerpo: { lat: CERCA.lat, lng: CERCA.lng, geo_origen: 'sugerencia', direccion: 'Rúa Brétema 23, 15011 A Coruña',
      cp: '15011', localidad: 'A Coruña' } })
    expect(fallos).toEqual([])
  })
})

/* LO QUE SE DECIDE SIN PANTALLA (lib/situar.js), con los casos de las revisiones del 02-11-2026. */
test.describe('situar.js', () => {
  test('el piso: «Torre», «Puerta» o «Portal» del nombre de la calle no lo son; el pegado al número («1ºB») sí', () => {
    // A4: la regla de la app nativa (en el primer trozo, solo detrás del número).
    expect(conPiso('Calle de la Torre 5 bajo, Madrid', 'Calle de la Torre 5, 28001 Madrid')).toBe('Calle de la Torre 5, 28001 Madrid, bajo')
    expect(conPiso('C/ TORRE Nº 5, 28001 MADRID', 'Calle Torre 5, 28001 Madrid')).toBe('Calle Torre 5, 28001 Madrid')
    expect(conPiso('PUERTA DEL SOL Nº 1, MADRID', 'Puerta del Sol 1, 28013 Madrid')).toBe('Puerta del Sol 1, 28013 Madrid')
    expect(conPiso('Calle Portal de Belén 3 1ºA', 'Calle Portal de Belén 3, 28001 Madrid')).toBe('Calle Portal de Belén 3, 28001 Madrid, 1ºA')
    expect(numeroDe('Calle de la Torre 5 bajo, Madrid')).toBe('5')
    expect(numeroDe('C/ TORRE Nº 5, 28001 MADRID')).toBe('5')
    expect(numeroDe('PUERTA DEL SOL Nº 1, MADRID')).toBe('1')
    // En los demás trozos el piso va solo, pero no detrás de un CP: «29740 Torre del Mar» es un pueblo.
    expect(conPiso('Calle Sol 3, 29740 Torre del Mar', 'Calle Sol 3, 29740 Torre del Mar')).toBe('Calle Sol 3, 29740 Torre del Mar')
    expect(conPiso('Calle Sol 3, Portal 2, Esc. A', 'Calle del Sol 3, 28013 Madrid')).toBe('Calle del Sol 3, 28013 Madrid, Portal 2, Esc. A')
    // A5: el piso pegado a su letra.
    expect(conPiso('Rúa Real 2, 1ºB, 15003 A Coruña', 'Calle Real 2, 15003 A Coruña')).toBe('Calle Real 2, 15003 A Coruña, 1ºB')
    expect(conPiso('Rúa Real 2 3ºA, 15003 A Coruña', 'Calle Real 2, 15003 A Coruña')).toBe('Calle Real 2, 15003 A Coruña, 3ºA')
    expect(conPiso('Calle Mayor 5, 2ºIzq, Madrid', 'Calle Mayor, 5, 28013 Madrid')).toBe('Calle Mayor, 5, 28013 Madrid, 2ºIzq')
    expect(numeroDe('Rúa Real 2, 1ºB')).toBe('2')
    // Lo de siempre sigue igual.
    expect(conPiso('Rúa Real 1, 2º B, 15003 A Coruña', 'Calle Real, 1, 15003 A Coruña')).toBe('Calle Real, 1, 15003 A Coruña, 2º B')
    expect(conPiso('Calle Mayor 5 2 B, Madrid', 'Calle Mayor, 5, 28013 Madrid')).toBe('Calle Mayor, 5, 28013 Madrid, 2 B')
    expect(conPiso('An der Alster 12, 20099 Hamburg', 'An der Alster 12, 20099 Hamburg')).toBe('An der Alster 12, 20099 Hamburg')
  })

  test('la misma calle es la de la app nativa: los casos de SituarTest, y los de las revisiones', () => {
    // Los de ui/hoy/SituarTest.kt (la_misma_calle_sin_tipo_articulos_ni_acentos_y_con_un_caracter_del_ocr).
    expect(mismaCalle('Paseo Manuel Núñez Nº 37, 32616, Vilardevós', 'P.º Manuel Núñez')).toBe(true)
    expect(mismaCalle('Trav. de Meicende Nº 50, 15140, Arteixo', 'Travesía Meicende')).toBe(true)
    expect(mismaCalle('Pza. da Insuela 57, 15124, Camariñas', 'Praza da Insuela')).toBe(true)
    expect(mismaCalle('Calle Real 1, 15003 A Coruña', 'Rúa Real')).toBe(true)                            // calle = rúa = carrer
    expect(mismaCalle('Carrer Major 3', 'Calle Major')).toBe(true)
    expect(mismaCalle('C/Mallorca 401, Barcelona', 'Carrer de Mallorca')).toBe(true)
    expect(mismaCalle('12 rue de Rivoli, Paris', 'Rue de Rivoli')).toBe(true)
    expect(mismaCalle('Rúa de Montccelo 1 Bajo, 36207, Vigo', 'Rúa Montecelo')).toBe(true)              // una falta del OCR
    expect(mismaCalle('R/ Desiderio Vare1a 1, 15102, Carballo', 'Rúa Desiderio Varela')).toBe(true)
    expect(mismaCalle('Pza. de Lug0 30, 15003, A Coruña', 'Praza de Lugo')).toBe(true)
    expect(mismaCalle('Calle Emilia Pardo Bazán 3', 'Rúa Pardo Bazán')).toBe(true)
    expect(mismaCalle('Calle Fleming 2', 'Calle Doctor Fleming')).toBe(true)                           // lo que sobra es un título
    expect(mismaCalle('Rúa Brétema Mariñeira 23, 15011 A Coruña', 'Rúa Brétema')).toBe(false)           // le falta «Mariñeira»
    expect(mismaCalle('Rúa Real 1, 15003 A Coruña', 'Rúa Nova')).toBe(false)
    expect(mismaCalle('Rúa Real 1', 'Rúa Real Alta')).toBe(false)
    expect(mismaCalle('Rúa da Cruz 12, 32660, Allariz', 'Rúa Madre Soledad de la Cruz')).toBe(false)
    expect(mismaCalle('Calle Pinar 2', 'Calle Pilar')).toBe(false)
    expect(mismaCalle('', 'Rúa Real')).toBe(false)
    // Con las direcciones enteras de los buscadores, como las compara la web.
    expect(mismaCalle('Rúa Brétema Mariñeira 23, 15011 A Coruña', 'Rúa Brétema, 15179 Oleiros')).toBe(false)
    expect(mismaCalle('Calle Emilia Pardo Bazán 5', 'Rúa Pardo Bazán 5')).toBe(true)
    const v = 'Rúa Valtrenxo 41, 15011 A Coruña'
    for (const otra of ['Rúa Almirante Mourelle 41, 15011 A Coruña', 'Rúa Virrey Osorio 41, 15011 A Coruña', 'Rúa San Pedro de Visma 41, 15011 A Coruña']) {
      expect(mismaCalle(v, otra), otra).toBe(false)
    }
    expect(mismaCalle(v, 'Rúa Valtrenxo, 15011 A Coruña')).toBe(true)
    expect(mismaCalle('Rúa Real 999, 15003 A Coruña', 'Calle Real, 15003 A Coruña')).toBe(true)
    expect(mismaCalle('Rúa de Montccelo 1 Bajo, 36207 Vigo', 'Rúa Montecelo 1, 36207 Vigo')).toBe(true)
    expect(mismaCalle('Rúa San Andrés 41, 15003 A Coruña', 'Rúa San Pedro 41, 15003 A Coruña')).toBe(false)
    expect(mismaCalle('Praza de María Pita 1, 15001 A Coruña', 'Rúa Real 1, 15003 A Coruña')).toBe(false)
  })

  test('las listas de la regla (tipos de vía, artículos, títulos, lo que no distingue, provincias y el piso) son las de la app nativa', () => {
    const kt = readFileSync(fileURLToPath(new URL('../../app-android/app/src/main/java/com/flotadsp/fds/ui/hoy/Situar.kt', import.meta.url)), 'utf8')
    // Una lista de Situar.kt: `setOf("a", …)` o la suma de otras con un setOf (NO_DISTINGUEN = TITULOS + setOf(…)).
    const deKt = (nombre) => {
      const m = new RegExp(`private val ${nombre} = ([\\s\\S]*?)\\)\\r?\\n`).exec(kt)
      expect(m, nombre).not.toBeNull()
      const out = new Set()
      for (const parte of m[1].split(/\s*\+\s*/)) {
        if (/^[A-Z_]+$/.test(parte.trim())) deKt(parte.trim()).forEach((x) => out.add(x))
        else for (const x of parte.matchAll(/"([^"]*)"/g)) out.add(x[1])
      }
      return out
    }
    for (const [nombre, lista] of Object.entries(LISTAS_CALLE)) {
      expect([...lista].sort(), nombre).toEqual([...deKt(nombre)].sort())
    }
    expect(Object.keys(LISTAS_CALLE)).toEqual(expect.arrayContaining(['TITULOS', 'NO_DISTINGUEN']))
    // La palabra de piso: la misma expresión (las cadenas de Kotlin, juntas y sin el escape de la barra). Y, desde el
    // 03-11-2026 (F), la del piso que va detrás del portal; y (K) el piso, la marca del número tras la coma y los
    // espacios raros, con sus banderas («(?iu)» en Kotlin). Desde la séptima tanda (03-11-2026), también DE_DELANTE (P2)
    // y los espacios de ancho cero (ANCHO_CERO, F4).
    const deK = Object.entries(EXPRESIONES_K).map(([nombre, re]) => [nombre, (re.flags.includes('i') ? '(?iu)' : '') + re.source])
    for (const [nombre, fuente] of [['PISO_PALABRA', PISO_PALABRA_FUENTE], ['PISO_COLA', PISO_COLA_FUENTE], ...deK]) {
      const piso = new RegExp(`private val ${nombre} = Regex\\(([\\s\\S]*?)\\)\\r?\\n`).exec(kt)
      expect(piso, nombre).not.toBeNull()
      expect([...piso[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('').replace(/\\\\/g, '\\'), nombre).toBe(fuente)
    }
  })

  test('el número es el suelto, no una cifra mal leída (como la app nativa)', () => {
    expect(numeroDe('R/ Desiderio Vare1a 1, 15102, Carballo')).toBe('1')
    expect(numeroDe('Lugar O Barreir0 6, 36471, Salceda de Caselas')).toBe('6')
    expect(numeroDe('Lugar O Barreir0, 36471, Salceda de Caselas')).toBe('')         // sin número: no se juzga la calle
    expect(numeroDe('R/ Celso Emilio Ferreiro nº4, 15624, Ares')).toBe('4')
    expect(numeroDe('Avinguda de la Mare de Deu de Montserrat no109, 08024, Barcelona')).toBe('109')
    expect(numeroDe('Puerta del Sol 1, 28013 Madrid')).toBe('1')
    expect(numeroDe('Rúa Real, 12-14, 15003 A Coruña')).toBe('12')
    expect(numeroDe('Rúa Real 2B, 1º B')).toBe('2')
    expect(numeroDe('12 rue de Rivoli, Paris')).toBe('12')
    expect(numeroDe('Praza de María Pita, 15001 A Coruña')).toBe('')
    expect(numeroDe('Hospital Abente y Lago')).toBe('')
    expect(calleDe('Trav. de Meicende Nº 50, 15140, Arteixo')).toBe('Trav. de Meicende')
    expect(calleDe('Avenida de Galicia s/n, 15620, Mugardos')).toBe('Avenida de Galicia')
    expect(calleDe('12 rue de Rivoli, Paris')).toBe('rue de Rivoli')
    expect(calleDe('1234 Main Street')).toBe('Main Street')                         // un número delante, no un CP
    expect(palabrasCalle('P.º Manuel Núñez')).toEqual(['manuel', 'nunez'])
    expect(palabrasCalle('Trav. de Meicende')).toEqual(['meicende'])
    expect(palabrasCalle('Errosario Santua kalea')).toEqual(['errosario', 'santua'])
  })

  test('comparte el nombre es la de la app nativa: los títulos no distinguen, los artículos de fuera tampoco, y sin palabras, no', () => {
    expect(comparteNombre('Rúa Brétema Mariñeira 23, 15011 A Coruña', 'Rúa Brétema, 15179 Oleiros')).toBe(true)
    expect(comparteNombre('Rúa Valtrenxo 41, 15011 A Coruña', 'Rúa Almirante Mourelle 41, 15011 A Coruña')).toBe(false)
    // Solo un título en común (03-11-2026, la revisión): no comparten el nombre.
    expect(comparteNombre('Rúa Almirante Mourelle 41, 15011 A Coruña', 'Rúa Almirante Cervera 41, 15011 A Coruña')).toBe(false)
    expect(comparteNombre('Rúa Marqués de Amboage 7, 15006 A Coruña', 'Rúa Marqués de Figueroa 7, 15006 A Coruña')).toBe(false)
    expect(comparteNombre('Avenida Alcalde Alfonso Molina 3, 15008 A Coruña', 'Rúa Alcalde Lens 3, 15010 A Coruña')).toBe(false)
    expect(comparteNombre('Rúa San Andrés 41, 15003 A Coruña', 'Rúa San Pedro 41, 15003 A Coruña')).toBe(false)
    for (const t of ['Pintor', 'Capitán', 'Rey', 'Reina', 'Duque', 'Conde', 'Infanta', 'Doutor']) {
      expect(comparteNombre(`Rúa ${t} Uno 5`, `Rúa ${t} Dos 5`), t).toBe(false)
    }
    // Los artículos de fuera («van», «zum») tampoco.
    expect(comparteNombre('Rua van Gogh 5', 'Rua van Dyck 5')).toBe(false)
    expect(comparteNombre('Zum Hafen 5', 'Zum Bahnhof 5')).toBe(false)
    // «1234 Main Street» no es un CP: la calle es «Main».
    expect(comparteNombre('1234 Main Street', 'Main Street 12')).toBe(true)
    // Lo que se está tecleando, por su principio; y sin calle con qué comparar, no (en la web antes era que sí).
    expect(comparteNombre('Calle Mayo', 'Calle Mayor 5, 28013 Madrid')).toBe(true)
    expect(comparteNombre('', 'Rúa Almirante Mourelle 41, 15011 A Coruña')).toBe(false)
    // Un sitio por su nombre no comparte nada con su calle.
    expect(comparteNombre('Hospital Universitario A Coruña', 'As Xubias de Arriba 84, 15006 A Coruña')).toBe(false)
  })

  test('«Otra calle» y las que no tocan: solo con el número escrito; la misma calle, no; con una palabra en común se marca; sin ninguna, fuera', () => {
    const D = 'Rúa Brétema Mariñeira 23, 15011 A Coruña'
    expect(deOtraCalle(D, 'Rúa Brétema, 15179 Oleiros')).toBe(true)
    expect(noToca(D, 'Rúa Brétema, 15179 Oleiros')).toBe(false)                          // sale, marcada
    expect(deOtraCalle('Rúa Valtrenxo 41, 15011 A Coruña', 'Rúa Almirante Mourelle 41, 15011 A Coruña')).toBe(true)
    expect(noToca('Rúa Valtrenxo 41, 15011 A Coruña', 'Rúa Almirante Mourelle 41, 15011 A Coruña')).toBe(true)
    expect(noToca('Rúa Valtrenxo 41, 15011 A Coruña', 'Rúa Virrey Osorio 41, 15011 A Coruña')).toBe(true)
    expect(noToca('Rúa Almirante Mourelle 41, 15011 A Coruña', 'Rúa Almirante Cervera 41, 15011 A Coruña')).toBe(true)
    expect(deOtraCalle('Calle Emilia Pardo Bazán 5', 'Rúa Pardo Bazán 5')).toBe(false)
    expect(deOtraCalle('Rúa Real 999, 15003 A Coruña', 'Calle Real 85, 15003 A Coruña')).toBe(false)
    expect(deOtraCalle('Rúa Real 999, 15003 A Coruña', 'Calle Real, 15003 A Coruña')).toBe(false)
    // La búsqueda corregida de «Situar» (sin número) no quita nada: la marca va con la dirección de la parada.
    expect(noToca('Rúa Brétema, Oleiros', 'Rúa Brétema, 15179 Oleiros')).toBe(false)
    expect(deOtraCalle('Rúa Brétema, Oleiros', 'Rúa Almirante Mourelle 41, 15011 A Coruña')).toBe(false)
    // Sin número (un sitio por su nombre, o aún se teclea), nada se quita ni se marca.
    for (const q of ['Hospital Abente y Lago', 'Mercadona Oleiros', 'Rúa Brét']) {
      expect(deOtraCalle(q, 'Rúa Almirante Mourelle 41, 15011 A Coruña'), q).toBe(false)
      expect(noToca(q, 'Rúa Almirante Mourelle 41, 15011 A Coruña'), q).toBe(false)
    }
  })

  test('la regla al elegir (alElegir) es una para todos los caminos: los casos de la revisión del 03-11-2026', () => {
    const D = 'Rúa Brétema Mariñeira 23, 15011 A Coruña'
    const oleiros = { direccion: 'Rúa Brétema, 15179 Oleiros', cp: '15179', localidad: 'Oleiros', precision: 'calle', fuente: 'photon' }
    // 4. Otra calle, de Photon (con su CP y su pueblo) o del servidor (sin ellos): la suya; nunca D con el punto de Oleiros.
    expect(alElegir(D, oleiros)).toEqual({ direccion: 'Rúa Brétema, 15179 Oleiros', precision: 'calle', cp: '15179', localidad: 'Oleiros', caso: 'otra' })
    expect(alElegir(D, { direccion: oleiros.direccion, precision: 'calle', fuente: 'servidor' }))
      .toEqual({ direccion: oleiros.direccion, precision: 'calle', cp: '', localidad: '', caso: 'otra' })
    // Venga marcada o no: lo que manda es la dirección de la parada.
    expect(alElegir(D, { ...oleiros, otraCalle: false }).caso).toBe('otra')
    expect(alElegir('Rúa Brétema Mariñeira 23, 2º B, 15011 A Coruña', oleiros).direccion).toBe('Rúa Brétema, 15179 Oleiros, 2º B')
    // Su precisión: «portal» si trae número; un «portal» sin número es la calle.
    expect(alElegir('Rúa Almirante Mourelle 41, 15011 A Coruña', { direccion: 'Rúa Almirante Cervera 41, 15011 A Coruña', precision: 'portal' }))
      .toMatchObject({ direccion: 'Rúa Almirante Cervera 41, 15011 A Coruña', precision: 'portal', caso: 'otra' })
    expect(alElegir(D, { direccion: 'Rúa Brétema, 15179 Oleiros', precision: 'portal', fuente: 'servidor' }).precision).toBe('calle')
    // 3b. La misma calle con otro número, o sin el portal: D, «calle».
    const real = 'Rúa Real 999, 15003 A Coruña'
    for (const s of [{ direccion: 'Calle Real 85, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', precision: 'portal', fuente: 'photon' },
      { direccion: 'Calle Real, 15003 A Coruña', precision: 'calle', fuente: 'servidor' }]) {
      expect(alElegir(real, s), s.direccion).toMatchObject({ direccion: real, precision: 'calle', caso: 'calle' })
    }
    // … con el CP y el pueblo de la sugerencia detrás si lo escrito no los traía (y el piso no es un pueblo).
    const conCp = { direccion: 'Calle Real, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', precision: 'calle', fuente: 'photon' }
    expect(alElegir('Rúa Real 999', conCp)).toEqual({ direccion: 'Rúa Real 999, 15003 A Coruña', precision: 'calle', cp: '15003', localidad: 'A Coruña', caso: 'calle' })
    expect(alElegir('Rúa Real 999, 2º B', conCp).direccion).toBe('Rúa Real 999, 2º B, 15003 A Coruña')
    expect(alElegir('Rúa Real 999, Baixo B, 15003 A Coruña', conCp).direccion).toBe('Rúa Real 999, Baixo B, 15003 A Coruña')
    // 3a. El mismo portal: la suya con el piso escrito, «portal».
    const real5 = { direccion: 'Calle Real, 5, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', precision: 'portal', fuente: 'servidor' }
    expect(alElegir('Rúa Real 5, 2º B, 15003 A Coruña', real5))
      .toEqual({ direccion: 'Calle Real, 5, 15003 A Coruña, 2º B', precision: 'portal', cp: '15003', localidad: 'A Coruña', caso: 'portal' })
    // 2. Sin número escrito (un sitio por su nombre): la de lo elegido, sea cual sea, con su precisión.
    for (const s of [real5, conCp, oleiros, { direccion: 'Calle Real 85, 15003 A Coruña', precision: 'portal' }]) {
      expect(alElegir('Hospital Abente y Lago', s), s.direccion).toMatchObject({ direccion: s.direccion, precision: s.precision, caso: 'sin-numero' })
    }
    // 1. Una suya, tal cual, con la precisión que dice el servidor (sin ella, «portal», como hasta ahora).
    const suya = { direccion: 'Rúa Real 9, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', conocida: true, fuente: 'suya', precision: 'calle', cliente: 'Concello' }
    expect(alElegir(real, suya)).toEqual({ direccion: 'Rúa Real 9, 15003 A Coruña', precision: 'calle', cp: '15003', localidad: 'A Coruña', caso: 'suya' })
    expect(alElegir(D, suya).direccion).toBe('Rúa Real 9, 15003 A Coruña')
    expect(alElegir(real, { ...suya, precision: undefined }).precision).toBe('portal')
    // Sin nada escrito: la elegida.
    expect(alElegir('', oleiros)).toMatchObject({ direccion: oleiros.direccion, precision: 'calle' })
  })

  test('«Es aquí» desde la ruta manda la precisión y la dirección cuando cambia (cambioEsAqui, el esAqui de la app nativa)', () => {
    const real999 = 'Rúa Real 999, 15003 A Coruña'
    const real85 = { direccion: 'Calle Real, 85, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', lat: 43.3702, lng: -8.399, precision: 'portal', fuente: 'photon' }
    // 3b: «Calle Real 85» para «Rúa Real 999» es la calle ("precision": "calle"; antes iba como la puerta) y la dirección no cambia.
    expect(cambioEsAqui(real999, 'sugerencia', real85)).toEqual({ precision: 'calle' })
    // 3b sin el CP ni el pueblo escritos: se añaden y se mandan.
    expect(cambioEsAqui('Rúa Real 999', 'sugerencia', real85)).toEqual({ precision: 'calle', direccion: 'Rúa Real 999, 15003 A Coruña', cp: '15003', localidad: 'A Coruña' })
    // 3a: el mismo portal, la puerta (sin precisión) y la dirección de S con el piso de D.
    const real5 = { direccion: 'Calle Real, 5, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', lat: 43.3701, lng: -8.3995, precision: 'portal', fuente: 'servidor' }
    expect(cambioEsAqui('Rúa Real 5, 2º B, 15003 A Coruña', 'sugerencia', real5)).toEqual({ precision: '', direccion: 'Calle Real, 5, 15003 A Coruña, 2º B', cp: '15003', localidad: 'A Coruña' })
    // 2: D sin número, la de S.
    expect(cambioEsAqui('Hospital Abente y Lago', 'sugerencia', real5)).toEqual({ precision: '', direccion: 'Calle Real, 5, 15003 A Coruña', cp: '15003', localidad: 'A Coruña' })
    // 1: una suya con «calle», tal cual y con "precision": "calle".
    const suya = { direccion: 'Rúa Real 9, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', lat: 43.371, lng: -8.401, veces: 2, conocida: true, fuente: 'suya', precision: 'calle' }
    expect(cambioEsAqui(real999, 'sugerencia', suya)).toEqual({ precision: 'calle', direccion: 'Rúa Real 9, 15003 A Coruña', cp: '15003', localidad: 'A Coruña' })
    expect(cambioEsAqui('Rúa Real 9, 15003 A Coruña', 'sugerencia', suya)).toEqual({ precision: 'calle' })
    // Movido el mapa a mano o con «Mi ubicación»: la puerta y la dirección de siempre.
    expect(cambioEsAqui(real999, 'mapa', null)).toEqual({ precision: '' })
    expect(cambioEsAqui(real999, 'mapa', real85)).toEqual({ precision: '' })
  })

  test('desde «Situar» se quita con lo buscado y se marca con la parada; «No encuentro» va con lo buscado (como la app nativa)', () => {
    // «Situar» desde la ruta o la ficha con la búsqueda corregida a «Rúa Brétema, Oleiros»: lo buscado no trae número y no
    // se quita nada; con D se marcan las de otra calle de cualquier fuente menos las suyas, y al elegirla la dirección
    // pasa a ser la suya.
    const d = 'Rúa Brétema Mariñeira 23, 15011 A Coruña'
    const buscado = 'Rúa Brétema, Oleiros'
    const servidor = { direccion: 'Rúa Brétema, 15179 Oleiros', cp: '', localidad: '', lat: 43.3283, lng: -8.3494, precision: 'calle', fuente: 'servidor' }
    const photon = { direccion: 'Rúa Brétema 2, 15179 Oleiros', cp: '15179', localidad: 'Oleiros', lat: 43.329, lng: -8.35, precision: 'portal', fuente: 'photon' }
    const suya = { direccion: 'Rúa Nova 1, 15179 Oleiros', cp: '15179', localidad: 'Oleiros', lat: 43.33, lng: -8.351, veces: 1, conocida: true, fuente: 'suya' }
    expect(noToca(buscado, photon.direccion)).toBe(false)
    const r = juntarSugerencias([servidor], [suya], [photon], 7, d)
    expect(r.map((x) => [x.direccion, x.otraCalle])).toEqual([[suya.direccion, false], [servidor.direccion, true], [photon.direccion, true]])
    // «Es aquí» desde la ruta: la dirección nueva va con el punto, y «calle» si es la calle.
    expect(cambioEsAqui(d, 'sugerencia', r[1])).toEqual({ precision: 'calle', direccion: 'Rúa Brétema, 15179 Oleiros', cp: '', localidad: '' })
    expect(cambioEsAqui(d, 'sugerencia', r[2])).toEqual({ precision: '', direccion: 'Rúa Brétema 2, 15179 Oleiros', cp: '15179', localidad: 'Oleiros' })
    // Desde la ficha, igual con lo escrito en ella.
    expect(alElegir(d, r[1]).direccion).toBe('Rúa Brétema, 15179 Oleiros')
    // Con número en lo buscado, las de Photon que ni comparten el nombre se quitan (lib/direcciones.js); las del
    // servidor, nunca, pero se marcan.
    const mourelle = 'Rúa Almirante Mourelle 23, 15011 A Coruña'
    expect(noToca(d, mourelle)).toBe(true)
    const conNumero = juntarSugerencias([servidor], [], [photon], 7, d)
    expect(conNumero.every((x) => x.otraCalle)).toBe(true)
    // «No encuentro esa dirección» va con lo buscado: «Rúa Brétema, Oleiros» sí se encuentra; la de D, no.
    expect(r.some((x) => deLaBuscada(buscado, x))).toBe(true)
    expect(conNumero.some((x) => deLaBuscada(d, x))).toBe(false)
  })

  test('el buscador de mapas (Photon): pide 10, quita las que no tocan con lo buscado, y la posición va a 2 decimales', async () => {
    let respuesta = []
    let pedida = null
    const devolver = ((antes) => () => { globalThis.fetch = antes })(globalThis.fetch)   // el fetch de verdad, al acabar
    globalThis.fetch = async (url) => { pedida = new URL(String(url)); return { ok: true, json: async () => ({ features: respuesta }) } }
    try {
      respuesta = bretema()
      const r = await buscarDirecciones('Rúa Brétema Mariñeira 23, 15011 A Coruña', { pais: 'es', cerca: { lat: 43.362349, lng: -8.411487 } })
      // La del 15011 con el 23 no comparte nada: fuera. La marca «Otra calle» ya no va aquí (juntarSugerencias, con la parada).
      expect(r.map((x) => [x.direccion, x.precision, x.otraCalle])).toEqual([
        ['Rúa Brétema, 15179 Oleiros', 'calle', undefined], ['Rúa Brétema Mariñeira, 15011 A Coruña', 'calle', undefined]])
      expect(pedida.searchParams.get('limit')).toBe('10')
      expect([pedida.searchParams.get('lat'), pedida.searchParams.get('lon')]).toEqual(['43.36', '-8.41'])
      await buscarDirecciones('Rúa Brétema Mariñeira 23', { cerca: { lat: 43.3, lng: -8.4 } })
      expect([pedida.searchParams.get('lat'), pedida.searchParams.get('lon')]).toEqual(['43.30', '-8.40'])        // como «%.2f»
      // Se quitan las que no tocan y no se corta aquí: el corte a 5 va después, con las marcas (juntarSugerencias).
      respuesta = [dePhoton('Rúa Almirante Mourelle', '999', '15003', 'A Coruña', -8.41, 43.36), dePhoton('Rúa Virrey Osorio', '999', '15003', 'A Coruña', -8.41, 43.36),
        dePhoton('Rúa San Pedro de Visma', '999', '15003', 'A Coruña', -8.41, 43.36),
        ...[1, 2, 3, 4, 5, 6].map((n) => dePhoton('Rúa Real', String(n), '15003', 'A Coruña', -8.4 + n / 1000, 43.37))]
      const r2 = await buscarDirecciones('Rúa Real 999, 15003 A Coruña', { pais: 'es' })
      expect(r2.map((x) => x.direccion)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Rúa Real ${n}, 15003 A Coruña`))
      expect(pedida.searchParams.get('lat')).toBeNull()
      respuesta = [dePhoton('Rúa Almirante Mourelle', '41', '15011', 'A Coruña', -8.4101, 43.3611),
        dePhoton('Rúa Virrey Osorio', '41', '15011', 'A Coruña', -8.4109, 43.3599)]
      expect(await buscarDirecciones('Rúa Valtrenxo 41, 15011 A Coruña', { pais: 'es' })).toEqual([])
      respuesta = [dePhoton('As Xubias de Arriba', '84', '15006', 'A Coruña', -8.3876, 43.3446, { name: 'Hospital Universitario' })]
      expect(await buscarDirecciones('Hospital Universitario A Coruña', { pais: 'es' })).toEqual([{ direccion: 'As Xubias de Arriba 84, 15006 A Coruña',
        cp: '15006', localidad: 'A Coruña', lat: 43.3446, lng: -8.3876, precision: 'portal', fuente: 'photon' }])
    } finally {
      devolver()
    }
  })

  test('al juntar las sugerencias, «Otra calle» va con la dirección de la PARADA (de cualquier fuente menos las suyas) y al final', () => {
    const D = 'Rúa Brétema Mariñeira 23, 15011 A Coruña'
    const srv = { direccion: 'Rúa Brétema, 15179 Oleiros', lat: OLEIROS.lat, lng: OLEIROS.lng, precision: 'calle', fuente: 'servidor' }
    const suya = { direccion: 'Rúa Nova 1, 15011 A Coruña', lat: 43.361, lng: -8.409, conocida: true, fuente: 'suya', veces: 2 }
    // La marca que trajera de antes no vale: la pone esto, con D.
    const calle = { direccion: 'Rúa Brétema Mariñeira, 15011 A Coruña', lat: 43.3621, lng: -8.4121, precision: 'calle', fuente: 'photon', otraCalle: true }
    const r = juntarSugerencias([srv], [suya], [calle], 6, D)
    expect(r.map((x) => [x.direccion, x.otraCalle])).toEqual([[suya.direccion, false], [calle.direccion, false], [srv.direccion, true]])
    // Sin número en la dirección de la parada no se marca nada (aunque en «Situar» se busque otra cosa).
    expect(juntarSugerencias([srv], [], [calle], 6, 'Hospital Abente y Lago').every((x) => !x.otraCalle)).toBe(true)
    // Una en el sitio de otra de antes no se repite: se queda la de antes.
    const esa = { direccion: 'Rúa Brétema Mariñeira 23, 15011 A Coruña', lat: 43.36215, lng: -8.41215, precision: 'portal', fuente: 'photon' }
    const aqui = { ...calle, direccion: 'Rúa Brétema Mariñeira, 15011', lat: 43.36211, lng: -8.41211 }   // a 1 m de la de la calle
    expect(juntarSugerencias([calle], [], [aqui, esa, srv], 6, D).map((x) => x.direccion)).toEqual([calle.direccion, esa.direccion, srv.direccion])
    // Las de Photon, ya marcadas, con las de la calle de la parada delante, y solo entonces se dejan 5 (Situar.TOPE_MAPA).
    const otras = [1, 2, 3, 4].map((n) => ({ direccion: `Rúa Brétema ${n}, 15179 Oleiros`, lat: 43.33 + n / 1000, lng: -8.35, precision: 'portal', fuente: 'photon' }))
    const buenas = [1, 2, 3].map((n) => ({ direccion: `Rúa Brétema Mariñeira ${n}, 15011 A Coruña`, lat: 43.36 + n / 1000, lng: -8.41, precision: 'portal', fuente: 'photon' }))
    expect(juntarSugerencias([], [], [...otras, ...buenas], 7, D).map((x) => x.direccion))
      .toEqual([...buenas.map((x) => x.direccion), otras[0].direccion, otras[1].direccion])
  })

  /* LA TANDA DEL 03-11-2026 DE MADRUGADA (la revisión): los casos de LA REGLA, los mismos que en la app nativa. */
  test('el portal es el número que vale del primer trozo, y va entero con su letra, «bis» o su rango (A; siguen igual con F)', () => {
    // [dirección, calle, número (las cifras), portal entero]
    const casos = [
      ['Calle 2 de Mayo 14, 28004 Madrid', 'Calle 2 de Mayo', '14', '14'],
      ['Calle 2 de Mayo, 28004 Madrid', 'Calle 2 de Mayo', '', ''],
      ['Avenida 18 de Julio 5', 'Avenida 18 de Julio', '5', '5'],
      ['Estrada AC-173 12, 15179 Oleiros', 'Estrada AC-173', '12', '12'],
      ['Estrada AC-174, 15179 Oleiros', 'Estrada AC-174', '', ''],
      ['Calle Real 5B', 'Calle Real', '5', '5B'],
      ['Calle Real 5 B', 'Calle Real', '5', '5B'],
      ['Calle Real 5-B', 'Calle Real', '5', '5B'],
      ['Rúa Real 5 bis', 'Rúa Real', '5', '5BIS'],
      ['Calle Real 12-14', 'Calle Real', '12', '12-14'],
      ['Trav. de Meicende Nº 50, 15140, Arteixo', 'Trav. de Meicende', '50', '50'],
      ['R/ Desiderio Vare1a 1', 'R/ Desiderio Vare1a', '1', '1'],
      ['Lugar O Barreir0 6', 'Lugar O Barreir0', '6', '6'],
      ['12 rue de Rivoli, Paris', 'rue de Rivoli', '12', '12'],
      ['Calle Real, 5, 2º', 'Calle Real', '5', '5'],
      ['Rúa Real 5, 2º B, 15003 A Coruña', 'Rúa Real', '5', '5'],
      // Más del mismo tipo, y los de siempre.
      ['Calle 8 de Marzo 12, 28001 Madrid', 'Calle 8 de Marzo', '12', '12'],
      ['Rúa 25 de Abril 3, 15008 A Coruña', 'Rúa 25 de Abril', '3', '3'],
      ['Carretera N-550 9, 15890 Santiago de Compostela', 'Carretera N-550', '9', '9'],
      ['Autovía A-6, 28023 Madrid', 'Autovía A-6', '', ''],
      ['Rúa Real, 12-14, 15003 A Coruña', 'Rúa Real', '12', '12-14'],
      ['R/ Celso Emilio Ferreiro nº4, 15624, Ares', 'R/ Celso Emilio Ferreiro', '4', '4'],
      ['Calle Mayor 5 2 B, Madrid', 'Calle Mayor', '5', '5'],
      ['Avenida de Galicia s/n, 15620, Mugardos', 'Avenida de Galicia', '', ''],
      ['Praza de María Pita, 15001 A Coruña', 'Praza de María Pita', '', ''],
      // Los que añadió la app nativa (SituarTest): el CP pegado detrás no es el portal, y el formato de fuera.
      ['Rúa Real 5 15003 A Coruña', 'Rúa Real', '5', '5'],
      ['Calle N-6 3', 'Calle N-6', '3', '3'],
      ['Rúa Real 5bis', 'Rúa Real', '5', '5BIS'],
      ['Calle Real, 5 B', 'Calle Real', '5', '5B'],
      ['Paseo Manuel Núñez Nº 37, 32616, Vilardevós', 'Paseo Manuel Núñez', '37', '37'],
      ['1200 Avenue of the Americas, New York', 'Avenue of the Americas', '1200', '1200'],
    ]
    for (const [d, calle, numero, portal] of casos) expect([calleDe(d), numeroDe(d), portalDe(d)], d).toEqual([calle, numero, portal])
    // Con eso, la regla: «Calle 2 de Mayo 3» es la misma calle que «Calle 2 de Mayo 14» con otro portal (3b: se queda
    // lo escrito), no el portal 2 de la calle «Calle»; y «Estrada AC-174» es otra calle que «Estrada AC-173».
    expect(mismaCalle('Calle 2 de Mayo 14, 28004 Madrid', 'Calle 2 de Mayo, 28004 Madrid')).toBe(true)
    expect(alElegir('Calle 2 de Mayo 14, 28004 Madrid', { direccion: 'Calle 2 de Mayo 3, 28004 Madrid', cp: '28004', localidad: 'Madrid', precision: 'portal', fuente: 'photon' }))
      .toMatchObject({ direccion: 'Calle 2 de Mayo 14, 28004 Madrid', precision: 'calle', caso: 'calle' })
    expect(alElegir('Estrada AC-173 12, 15179 Oleiros', { direccion: 'Estrada AC-174 12, 15179 Oleiros', precision: 'portal', fuente: 'photon' }).caso).toBe('otra')
  })

  test('la misma calle es también el mismo sitio: por el CP o, si no, por el pueblo (B)', () => {
    // Los pueblos y el mismo pueblo, como en SituarTest.
    expect(pueblosEscritos('Rúa Real 5, 15179 Oleiros, A Coruña')).toEqual(['oleiros'])
    expect(pueblosEscritos('Rúa Brétema Mariñeira 23, 15011 A Coruña')).toEqual(['a coruna'])
    expect(pueblosEscritos('Rúa do Río, 19, Baixo, 15160, Sada Coruña')).toEqual(['sada'])
    expect(pueblosEscritos('Ronda das Fontiñas 171 Baixo B 27002 Lugo, 27002, Lugo')).toEqual(['lugo'])
    expect(pueblosEscritos('Martinete 27, O Martinete, A Coruña', 'A Coruña')).toEqual(['a coruna', 'o martinete'])
    expect(mismoPueblo('A Coruña', ['coruna'])).toBe(true)
    expect(mismoPueblo('Santiago de Compostela', ['santiago compostela'])).toBe(true)
    expect(mismoPueblo('As Pontes de García Rodríguez', ['as pontes'])).toBe(true)
    expect(mismoPueblo('Oleiros', ['a coruna'])).toBe(false)
    expect(mismoPueblo('Burgos', ['san mames de burgos'])).toBe(false)
    // Cada caso de mismoSitio. La parada con CP y la sugerencia con CP: el mismo CP; si no, el mismo pueblo; si no, no.
    expect(mismoSitio('Rúa Real 5, 15003 A Coruña', 'Rúa Real, 15003 A Coruña')).toBe(true)
    expect(mismoSitio('Avenida de Finisterre 120, 15004 A Coruña', 'Avenida de Finisterre, 15005 A Coruña')).toBe(true)
    expect(mismoSitio('Rúa Brétema 23, 15011 A Coruña', 'Rúa Brétema, 15179 Oleiros, A Coruña')).toBe(false)
    expect(mismoSitio('Rúa Brétema 23, 15011 A Coruña', { direccion: 'Rúa Brétema', cp: '15179', localidad: 'Oleiros' })).toBe(false)
    // Con CP y la sugerencia sin él: el mismo pueblo; sin pueblo, no.
    expect(mismoSitio('Rúa Real 5, 15003 A Coruña', 'Rúa Real, A Coruña')).toBe(true)
    expect(mismoSitio('Rúa Real 5, 15003 A Coruña', 'Rúa Real')).toBe(false)
    // Sin CP y con pueblo (el escrito, o la población de la parada): el mismo pueblo; si no, o sin pueblo, no.
    expect(mismoSitio('Rúa Real 5, Oleiros', 'Rúa Real, 15179 Oleiros')).toBe(true)
    expect(mismoSitio('Rúa Real 5, Oleiros', 'Rúa Real, 15003 A Coruña')).toBe(false)
    expect(mismoSitio('Rúa Real 5', 'Rúa Real', '', 'Oleiros')).toBe(false)
    // Sin CP ni pueblo no hay con qué comparar: sí, como hasta ahora.
    expect(mismoSitio('Rúa Real 5', 'Rúa Real, 15179 Oleiros')).toBe(true)
    // El CP y la población de la parada cuentan aunque no vayan escritos.
    expect(mismoSitio('Rúa Real 5', { direccion: 'Rúa Real', cp: '15179', localidad: 'Oleiros' }, '15003', 'A Coruña')).toBe(false)
    expect(mismoSitio('Rúa Real 5', { direccion: 'Rúa Real', cp: '15003' }, '15003')).toBe(true)

    // Los casos de la revisión, de cualquier fuente: «Otra calle» y la regla 4 (la de S con el piso de D, su CP y su pueblo).
    const D = 'Rúa Brétema 23, 2º B, 15011 A Coruña'
    const deOleiros = 'Rúa Brétema, 15179 Oleiros, A Coruña, 2º B'
    for (const fuente of ['servidor', 'movil', 'photon']) {
      const s = { direccion: 'Rúa Brétema, 15179 Oleiros, A Coruña', cp: '15179', localidad: 'Oleiros', lat: OLEIROS.lat, lng: OLEIROS.lng, precision: 'calle', fuente }
      expect(deOtraCalle(D, s), fuente).toBe(true)
      expect(alElegir(D, s), fuente).toEqual({ direccion: deOleiros, precision: 'calle', cp: '15179', localidad: 'Oleiros', caso: 'otra' })
      expect(juntarSugerencias(fuente === 'photon' ? [] : [s], [], fuente === 'photon' ? [s] : [], 6, D)[0].otraCalle, fuente).toBe(true)
      expect(cambioEsAqui(D, 'sugerencia', s), fuente).toEqual({ precision: 'calle', direccion: deOleiros, cp: '15179', localidad: 'Oleiros' })
    }
    // Del servidor, sin el CP ni el pueblo aparte: los de su texto dicen que es otro sitio.
    expect(alElegir(D, { direccion: 'Rúa Brétema, 15179 Oleiros', precision: 'calle', fuente: 'servidor' }))
      .toEqual({ direccion: 'Rúa Brétema, 15179 Oleiros, 2º B', precision: 'calle', cp: '', localidad: '', caso: 'otra' })
    const realOleiros = { direccion: 'Calle Real, 15179 Oleiros', cp: '15179', localidad: 'Oleiros', lat: OLEIROS.lat, lng: OLEIROS.lng, precision: 'calle', fuente: 'photon' }
    expect(alElegir('Rúa Real 999, 15003 A Coruña', realOleiros))
      .toEqual({ direccion: 'Calle Real, 15179 Oleiros', precision: 'calle', cp: '15179', localidad: 'Oleiros', caso: 'otra' })
    // La misma calle en el mismo sitio, como hasta ahora (3b: se queda lo escrito, «calle»), también con otro CP del pueblo.
    expect(alElegir('Rúa Real 5, 15003 A Coruña', { direccion: 'Rúa Real, 15003 A Coruña', cp: '15003', localidad: 'A Coruña', precision: 'calle', fuente: 'photon' }))
      .toEqual({ direccion: 'Rúa Real 5, 15003 A Coruña', precision: 'calle', cp: '15003', localidad: 'A Coruña', caso: 'calle' })
    expect(alElegir('Avenida de Finisterre 120, 15004 A Coruña', { direccion: 'Avenida de Finisterre, 15005 A Coruña', precision: 'calle', fuente: 'servidor' }))
      .toMatchObject({ direccion: 'Avenida de Finisterre 120, 15004 A Coruña', precision: 'calle', caso: 'calle' })
    // Sin CP ni pueblo en la parada: la misma calle, y el CP y el pueblo de la sugerencia detrás.
    expect(alElegir('Rúa Real 5', { ...realOleiros, direccion: 'Rúa Real, 15179 Oleiros' }))
      .toEqual({ direccion: 'Rúa Real 5, 15179 Oleiros', precision: 'calle', cp: '15179', localidad: 'Oleiros', caso: 'calle' })
    // … salvo que la parada los tenga aparte: con 15003 A Coruña, la de Oleiros es otra (en la lista y desde la ruta).
    expect(alElegir('Rúa Real 5', realOleiros, '15003', 'A Coruña').caso).toBe('otra')
    expect(juntarSugerencias([], [], [realOleiros], 6, 'Rúa Real 5', '15003', 'A Coruña')[0].otraCalle).toBe(true)
    expect(cambioEsAqui('Rúa Real 5', 'sugerencia', realOleiros, '15003', 'A Coruña'))
      .toEqual({ precision: 'calle', direccion: 'Calle Real, 15179 Oleiros', cp: '15179', localidad: 'Oleiros' })
  })

  test('el mismo portal es el portal ENTERO: «Calle Real 5» no es el de «Calle Real 5B» (C)', () => {
    const portal = (direccion) => ({ direccion, cp: '15003', localidad: 'A Coruña', precision: 'portal', fuente: 'photon' })
    // [lo escrito, la sugerencia, el caso]: 3b («calle») se queda lo escrito con su portal; 3a («portal»), la sugerencia.
    const pares = [
      ['Calle Real 5B, 15003 A Coruña', 'Calle Real 5, 15003 A Coruña', 'calle'],
      ['Calle Real 5, 15003 A Coruña', 'Calle Real 5B, 15003 A Coruña', 'calle'],
      ['Calle Real 5B, 15003 A Coruña', 'Calle Real 5B, 15003 A Coruña', 'portal'],
      ['Calle Real 5-B, 15003 A Coruña', 'Calle Real 5 B, 15003 A Coruña', 'portal'],
      ['Rúa Real 5 bis, 15003 A Coruña', 'Calle Real 5, 15003 A Coruña', 'calle'],
      ['Calle Real 12-14, 15003 A Coruña', 'Calle Real 12, 15003 A Coruña', 'calle'],
      ['Calle Real 12-14, 15003 A Coruña', 'Calle Real, 12-14, 15003 A Coruña', 'portal'],
    ]
    for (const [d, s, caso] of pares) {
      expect(alElegir(d, portal(s)), `${d} · ${s}`).toEqual({ direccion: caso === 'calle' ? d : s, precision: caso === 'calle' ? 'calle' : 'portal',
        cp: '15003', localidad: 'A Coruña', caso })
    }
    // Desde la ruta, lo mismo: la calle ("precision": "calle") y la dirección no cambia.
    expect(cambioEsAqui('Calle Real 5B, 15003 A Coruña', 'sugerencia', portal('Calle Real 5, 15003 A Coruña'))).toEqual({ precision: 'calle' })
  })

  test('al juntar el mismo portal de varias fuentes, el CP y la población, de la primera que los trae: servidor, móvil, Photon (E)', () => {
    const D = 'Praza de María Pita 1, 15001 A Coruña'
    const srv = { direccion: PORTAL.direccion, lat: PORTAL.lat, lng: PORTAL.lng, precision: 'portal', fuente: 'servidor' }
    const photon = { direccion: 'Praza de María Pita 1, 15001 A Coruña', cp: '15001', localidad: 'Coruña', lat: PORTAL.lat + 0.00002, lng: PORTAL.lng,
      precision: 'portal', fuente: 'photon' }
    const movil = { ...photon, direccion: 'Praza de María Pita, 1, 15001, A Coruña', localidad: 'A Coruña', fuente: 'movil' }
    // El servidor no los da aparte: se queda la suya, con los de Photon.
    const r = juntarSugerencias([srv], [], [photon], 6, D)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ direccion: srv.direccion, fuente: 'servidor', cp: '15001', localidad: 'Coruña' })
    // Con los suyos, los del servidor; y los del móvil antes que los de Photon, aunque Photon llegue antes.
    expect(juntarSugerencias([{ ...srv, cp: '15001', localidad: 'A Coruña' }], [], [photon], 6, D)[0]).toMatchObject({ cp: '15001', localidad: 'A Coruña' })
    expect(juntarSugerencias([], [], [photon, movil], 6, D)).toMatchObject([{ fuente: 'photon', cp: '15001', localidad: 'A Coruña' }])
    // Cada dato por su lado: el CP del servidor y, sin su población, la de Photon.
    expect(juntarSugerencias([{ ...srv, cp: '15001' }], [], [photon], 6, D)[0]).toMatchObject({ cp: '15001', localidad: 'Coruña' })
    // Una sola, tal cual.
    expect(juntarSugerencias([], [], [photon], 6, D)[0]).toMatchObject({ cp: '15001', localidad: 'Coruña' })
    // El orden es el de las fuentes, no el de la lista: la del móvil de otra calle va al final, se junta con la de Photon
    // (el mismo portal a 2 m) y la que queda, la de Photon con su dirección y sin marca, lleva la población del móvil.
    const nova = { ...movil, direccion: 'Rúa Nova, 1, 15001 A Coruña' }
    expect(juntarSugerencias([], [], [photon, nova], 6, D)).toMatchObject([{ fuente: 'photon', direccion: photon.direccion, otraCalle: false,
      cp: '15001', localidad: 'A Coruña' }])
  })

  /* LA TANDA DEL 03-11-2026 POR LA MAÑANA (la revisión de la anterior): F, G, H y J de LA REGLA, los mismos casos que en
     la app nativa (SituarTest). */
  test('el portal es el PRIMERO que vale y lo de detrás, si es todo piso, es el piso: «Calle Mayor 15 2 dcha» es el 15 (F)', () => {
    // [dirección, calle, número (las cifras), portal entero]
    const casos = [
      ['Calle Mayor 15 2 dcha, 28013 Madrid', 'Calle Mayor', '15', '15'],
      ['Rúa Real 5 1 dcha, 15003 A Coruña', 'Rúa Real', '5', '5'],
      ['Calle Mayor 15 2', 'Calle Mayor', '15', '15'],
      ['Calle Mayor 15 1o IZQ.', 'Calle Mayor', '15', '15'],
      ['Calle Real 3 3o B', 'Calle Real', '3', '3'],
      ['Carrer de Sants 5 2n 1a', 'Carrer de Sants', '5', '5'],
      ['Carrer Gran 7 3r 2a', 'Carrer Gran', '7', '7'],
      ['Carrer Nou 9 Pral. 2a', 'Carrer Nou', '9', '9'],
      ['Carrer Nou 9 Entl. 2a', 'Carrer Nou', '9', '9'],
      ['Carrer Nou 9 Àtic 1a', 'Carrer Nou', '9', '9'],
      ['Nagusia kalea 4 4. eskuma', 'Nagusia kalea', '4', '4'],
      ['Nagusia kalea 4 3. ezk.', 'Nagusia kalea', '4', '4'],
      ['Rúa do Sol 8 Baixo 2', 'Rúa do Sol', '8', '8'],
      ['Lugar Pastel 12 Casa 2', 'Lugar Pastel', '12', '12'],
      ['Polígono Sabón 12 Nave 3', 'Polígono Sabón', '12', '12'],
      // El que solo lleva delante el tipo de vía es del nombre; con nada más, no hay portal.
      ['Calle 2 3', 'Calle 2', '3', '3'],
      ['Calle 2', 'Calle 2', '', ''],
      ['Calle 2, 15003 A Coruña', 'Calle 2', '', ''],
      ['Avenida 18 de Julio 5 2 B', 'Avenida 18 de Julio', '5', '5'],
      // La «A» con más nombre detrás es del pueblo, no la puerta.
      ['Calle Real 1 A Coruña', 'Calle Real', '1', '1'],
      // Detrás de un tipo que también es el nombre de una calle, sí es el portal (el laboratorio: la Rúa da Estrada 24).
      ['ESTRADA 24, 36004, A PARDA', 'ESTRADA', '24', '24'],
      ['Rambla 98, 08002 Barcelona', 'Rambla', '98', '98'],
    ]
    for (const [d, calle, numero, portal] of casos) expect([calleDe(d), numeroDe(d), portalDe(d)], d).toEqual([calle, numero, portal])
    // El piso se quita para buscar y se pone entero al elegir.
    expect(paraBuscar('Calle Mayor 15 2 dcha, 28013 Madrid')).toBe('Calle Mayor 15, 28013 Madrid')
    expect(paraBuscar('Carrer de Sants 5 2n 1a, 08014 Barcelona')).toBe('Carrer de Sants 5, 08014 Barcelona')
    expect(paraBuscar('Rúa do Sol 8 Baixo 2, 15003 A Coruña')).toBe('Rúa do Sol 8, 15003 A Coruña')
    expect(paraBuscar('Calle Real 1 A Coruña')).toBe('Calle Real 1 A Coruña')                      // el pueblo sigue en lo buscado
    expect(pueblosEscritos('Calle Real 1 A Coruña')).toEqual(['a coruna'])
    expect(conPiso('Calle Mayor 15 2 dcha, 28013 Madrid', 'Calle Mayor 15, 28013 Madrid')).toBe('Calle Mayor 15, 28013 Madrid, 2 dcha')
    expect(conPiso('Carrer de Sants 5 2n 1a', 'Carrer de Sants 5, 08014 Barcelona')).toBe('Carrer de Sants 5, 08014 Barcelona, 2n 1a')
    expect(conPiso('Calle Mayor 15 1o IZQ.', 'Calle Mayor 15, 28013 Madrid')).toBe('Calle Mayor 15, 28013 Madrid, 1o IZQ')
    expect(conPiso('Calle Real 1 A Coruña', 'Calle Real 1, 15003 A Coruña')).toBe('Calle Real 1, 15003 A Coruña')
    // Al elegir: el mismo portal (3a) con el piso entero; la calle sin el portal (3b), lo escrito; otro portal (3b),
    // lo escrito: «Rúa Real 1» no es el portal de «Rúa Real 5 1 dcha».
    const madrid = (direccion, precision) => ({ direccion, precision, fuente: 'servidor', lat: 40.4153, lng: -3.7089 })
    const D = 'Calle Mayor 15 2 dcha, 28013 Madrid'
    expect(alElegir(D, madrid('Calle Mayor 15, 28013 Madrid', 'portal')))
      .toEqual({ direccion: 'Calle Mayor 15, 28013 Madrid, 2 dcha', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    expect(alElegir(D, madrid('Calle Mayor, 28013 Madrid', 'calle'))).toEqual({ direccion: D, precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    const R = 'Rúa Real 5 1 dcha, 15003 A Coruña'
    expect(alElegir(R, { direccion: 'Rúa Real 1, 15003 A Coruña', precision: 'portal', fuente: 'servidor' }))
      .toEqual({ direccion: R, precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    expect(cambioEsAqui(R, 'sugerencia', { direccion: 'Rúa Real 1, 15003 A Coruña', precision: 'portal', fuente: 'photon' })).toEqual({ precision: 'calle' })
    // La marca «Otra calle» ya no sale para la buena de su calle (con el último número, sí).
    expect(juntarSugerencias([madrid('Calle Mayor 15, 28013 Madrid', 'portal')], [], [], 6, D)[0].otraCalle).toBe(false)
    expect(juntarSugerencias([], [], [{ ...madrid('Carrer de Sants 5, 08014 Barcelona', 'portal'), fuente: 'photon' }], 6, 'Carrer de Sants 5 2n 1a, 08014, Barcelona')[0].otraCalle)
      .toBe(false)
  })

  test('las cifras del nombre cuentan: «Calle 1 de Mayo» no es «Calle 2 de Mayo» (G)', () => {
    expect(palabrasCalle('Calle 1 de Mayo')).toEqual(['1', 'mayo'])
    expect(palabrasCalle('Avenida 18 de Julio')).toEqual(['18', 'julio'])
    expect(mismaCalle('Calle 1 de Mayo', 'Calle 2 de Mayo')).toBe(false)
    expect(mismaCalle('Calle 1 de Mayo', 'Calle Mayo')).toBe(false)
    expect(mismaCalle('Avenida 18 de Julio', 'Av. 18 de Julio')).toBe(true)
    expect(mismaCalle('Calle 2 de Mayo', 'Calle Dos de Mayo')).toBe(false)              // mejor «Otra calle» que el punto de otra
    // Con lo que da el móvil (en la app, aceptar): ni «Calle 2 de Mayo 4» para la 1, ni «Plaza 2 de Mayo 3» para la 1.
    expect(mismaCalle('Calle 1 de Mayo 4, 28004 Madrid', 'Calle 2 de Mayo 4, 28004')).toBe(false)
    expect(mismaCalle('Plaza 1 de Mayo 3', 'Plaza 2 de Mayo 3')).toBe(false)
    // Al elegir: «Otra calle» y la regla 4 (la suya), nunca lo escrito con el punto de la 2.
    const D = 'Calle 1 de Mayo 4, 28004 Madrid'
    const s = { direccion: 'Calle 2 de Mayo, 28004 Madrid', precision: 'calle', fuente: 'servidor', lat: 40.4262, lng: -3.7038 }
    expect(deOtraCalle(D, s)).toBe(true)
    expect(alElegir(D, s)).toEqual({ direccion: 'Calle 2 de Mayo, 28004 Madrid', precision: 'calle', cp: '', localidad: '', caso: 'otra' })
    expect(juntarSugerencias([s], [], [], 6, D)[0].otraCalle).toBe(true)
    // La misma, con sus cifras, sigue siendo la misma (3b).
    expect(alElegir('Avenida 18 de Julio 5, 28004 Madrid', { ...s, direccion: 'Av. 18 de Julio, 28004 Madrid' }).caso).toBe('calle')
  })

  test('«O Burgo (Culleredo)» son dos pueblos: el núcleo y su municipio, sin artículo ni provincia (H)', () => {
    expect(pueblosEscritos('Rúa Conservatorio, 15670 O Burgo (Culleredo)')).toEqual(['o burgo', 'culleredo'])
    expect(pueblosEscritos('Rúa Real 5', 'O Burgo (Culleredo)')).toEqual(['o burgo', 'culleredo'])
    expect(pueblosEscritos('Rúa Real 5, 15895 Ames (A Coruña)')).toEqual(['ames'])                 // la provincia no cuenta
    expect(pueblosEscritos('Rúa Real 5, 15003 CORUÑA (A)')).toEqual(['coruna'])                    // el artículo tampoco
    expect(mismoPueblo('O Burgo (Culleredo)', ['culleredo'])).toBe(true)
    expect(mismoPueblo('Ames (A Coruña)', ['a coruna'])).toBe(false)
    expect(mismoPueblo('CORUÑA (A)', ['a coruna'])).toBe(true)
    const burgo = { direccion: 'Rúa Conservatorio, 15670 O Burgo (Culleredo)', precision: 'calle', fuente: 'servidor', lat: 43.3226, lng: -8.3796 }
    // El mismo sitio: 3b, lo escrito con su 5, «calle»; también con la población de la parada y sin pueblo escrito.
    expect(alElegir('Rúa Conservatorio 5, Culleredo', burgo))
      .toEqual({ direccion: 'Rúa Conservatorio 5, Culleredo', precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    expect(alElegir('Rúa Conservatorio 5', burgo, '', 'Culleredo'))
      .toEqual({ direccion: 'Rúa Conservatorio 5', precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    expect(juntarSugerencias([burgo], [], [], 6, 'Rúa Conservatorio 5, Culleredo')[0].otraCalle).toBe(false)
    expect(alElegir('Lugar Pastel 12, Cambre', { ...burgo, direccion: 'Lugar Pastel, 15668 O Pastel (Cambre)' }))
      .toMatchObject({ direccion: 'Lugar Pastel 12, Cambre', precision: 'calle', caso: 'calle' })
    // La provincia entre paréntesis no hace pasar la ciudad por cualquier pueblo: «Otra calle».
    const coruna = { ...burgo, direccion: 'Rúa Brétema, 15011 A Coruña (A Coruña)' }
    expect(alElegir('Rúa Brétema 23, Oleiros', coruna)).toMatchObject({ direccion: coruna.direccion, caso: 'otra' })
    expect(juntarSugerencias([coruna], [], [], 6, 'Rúa Brétema 23, Oleiros')[0].otraCalle).toBe(true)
    // La provincia que es también la ciudad sigue como estaba: «Rúa Brétema 23, Oleiros, A Coruña» no es la del 15011.
    expect(alElegir('Rúa Brétema 23, Oleiros, A Coruña', { ...burgo, direccion: 'Rúa Brétema, 15011 A Coruña' }).caso).toBe('otra')
  })

  test('sin \\b junto a una cifra: «Avenida Primero de Mayo, n.º4 2 B» da lo mismo que en la app nativa (J)', () => {
    const d = 'Avenida Primero de Mayo, n.º4 2 B'
    expect(paraBuscar(d)).toBe('Avenida Primero de Mayo, n.º4')
    expect(conPiso(d, 'Avenida Primero de Mayo 4, 15001 A Coruña')).toBe('Avenida Primero de Mayo 4, 15001 A Coruña, 2 B')
    // Lo de siempre: el número suelto delante del piso y de la puerta, al principio del trozo o detrás del nombre.
    expect(paraBuscar('Rúa Real, 5 2 B')).toBe('Rúa Real, 5')
    expect(paraBuscar('Calle Mayor 5 2 B, Madrid')).toBe('Calle Mayor 5, Madrid')
    expect(paraBuscar('Calle Mayor 5 B, Madrid')).toBe('Calle Mayor 5, Madrid')
    expect(portalDe('Calle Mayor 5 B, Madrid')).toBe('5B')
    // «º» y «ª» delante no cuentan como letra (como en numeroEn); otra letra sí: el número no va pegado a ella.
    expect(paraBuscar('Rúa Real, nº5 2 B')).toBe('Rúa Real, nº5')
    expect(paraBuscar('Rúa Real, Peñ5 2 B')).toBe('Rúa Real, Peñ5 2')
  })

  /* K (03-11-2026, la segunda parte de la tanda de la mañana): los últimos detalles de la lectura, los mismos casos que
     en la app nativa (SituarTest, k1… k5). */
  test('el piso con todas sus letras detrás de «º» y «OG»; los espacios raros, como uno normal (K1, K2)', () => {
    // K1: «3ºDerecha» es el piso (la web lo leía como un pueblo, marcaba «Otra calle» y lo perdía al elegir).
    const d = 'Calle Real 5 3ºDerecha, 28013 Madrid'
    expect([paraBuscar(d), numeroDe(d), calleDe(d)]).toEqual(['Calle Real 5, 28013 Madrid', '5', 'Calle Real'])
    expect(pueblosEscritos(d)).toEqual(['madrid'])
    expect(conPiso(d, 'Calle Real 5, 28012 Madrid')).toBe('Calle Real 5, 28012 Madrid, 3ºDerecha')
    const srv = { direccion: 'Calle Real 5, 28012 Madrid', precision: 'portal', fuente: 'servidor', lat: 40.4155, lng: -3.7074 }
    expect(mismoSitio(d, srv.direccion)).toBe(true)
    expect(juntarSugerencias([srv], [], [], 6, d)[0].otraCalle).toBe(false)
    expect(alElegir(d, srv)).toEqual({ direccion: 'Calle Real 5, 28012 Madrid, 3ºDerecha', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    const photon = { direccion: 'Calle Real 5, Madrid', precision: 'portal', fuente: 'photon', lat: 40.4153, lng: -3.7089 }
    expect(alElegir(d, photon)).toEqual({ direccion: 'Calle Real 5, Madrid, 3ºDerecha', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    expect(juntarSugerencias([], [], [photon], 6, d)[0].otraCalle).toBe(false)
    expect(paraBuscar('Calle Real 5 2ºIzquierda')).toBe('Calle Real 5')
    expect(conPiso('Rúa Real 1 1ªPuerta', 'Rúa Real 1, 15003 A Coruña')).toBe('Rúa Real 1, 15003 A Coruña, 1ªPuerta')
    // «OG» (Obergeschoss) suelto, como «5. OG».
    expect([paraBuscar('Hauptstrasse 5 OG'), numeroDe('Hauptstrasse 5 OG')]).toEqual(['Hauptstrasse 5', '5'])
    expect(paraBuscar('Hauptstrasse 5 OG, 10115 Berlin')).toBe('Hauptstrasse 5, 10115 Berlin')
    expect(conPiso('Hauptstrasse 5 OG, 10115 Berlin', 'Hauptstraße 5, 10115 Berlin')).toBe('Hauptstraße 5, 10115 Berlin, OG')
    // K2: el duro, el de las cifras, el fino, los demás separadores y el tabulador son un espacio normal al leer.
    const lee = (x) => [paraBuscar(x), numeroDe(x), calleDe(x), portalDe(x), conPiso(x, 'Calle Mayor 5, 28013 Madrid')]
    expect(lee('Calle Mayor 5 2 B')).toEqual(['Calle Mayor 5', '5', 'Calle Mayor', '5', 'Calle Mayor 5, 28013 Madrid, 2 B'])
    for (const c of [0xa0, 0x2007, 0x202f, 0x2009, 0x3000, 0x1680, 0x2028, 0x9]) {
      const r = String.fromCodePoint(c)
      expect(lee(`Calle Mayor 5${r}2 B`), c.toString(16)).toEqual(lee('Calle Mayor 5 2 B'))
      expect(lee(`Calle${r}Mayor${r}5${r}2${r}B`), c.toString(16)).toEqual(lee('Calle Mayor 5 2 B'))
    }
    // Detrás de la coma, en el piso, en el pueblo y en el nombre, igual.
    const duro = String.fromCodePoint(0xa0)
    expect(paraBuscar(`Calle Mayor,${duro}5${duro}2${duro}B,${duro}Madrid`)).toBe('Calle Mayor, 5, Madrid')
    expect(conPiso(`Rúa Real 1,${duro}2º${duro}B`, 'Calle Real, 1, 15003 A Coruña, 2º B')).toBe('Calle Real, 1, 15003 A Coruña, 2º B')
    expect(pueblosEscritos(`Rúa Real 5,${duro}15179${duro}Oleiros`)).toEqual(['oleiros'])
    expect(pueblosEscritos(`Rúa Real 5,${duro}15179${String.fromCodePoint(0x202f)}Oleiros`)).toEqual(['oleiros'])
    expect(palabrasCalle(`P.${duro}º Manuel${String.fromCodePoint(9)}Núñez`)).toEqual(['manuel', 'nunez'])
    expect(paraBuscar(`Avenida Primero de Mayo,${duro}n.º4${duro}2${duro}B`)).toBe('Avenida Primero de Mayo, n.º4')
  })

  test('la marca del número tras la coma, el número del nombre y el piso por palabras enteras (K3, K4, K5)', () => {
    const lee = (x) => [calleDe(x), numeroDe(x), portalDe(x)]
    // K3: detrás de la primera coma, con «nº», «n.º», «no», «núm.» o «número» delante, como en el primer trozo.
    const d = 'Avenida Primero de Mayo, n.º4 2 B'
    expect(lee(d)).toEqual(['Avenida Primero de Mayo', '4', '4'])
    expect(conPiso(d, 'Avenida Primero de Mayo 4, 15001 A Coruña')).toBe('Avenida Primero de Mayo 4, 15001 A Coruña, 2 B')
    for (const [dir, n] of [['Rúa Real, nº5', '5'], ['Rúa Real, Nº 5, 15003 A Coruña', '5'], ['Rúa Real, no 5', '5'], ['Rúa Real, No5', '5'],
      ['Rúa Real, núm. 3', '3'], ['Rúa Real, Núm 3', '3'], ['Rúa Real, número 12, 15003 A Coruña', '12'], ['Rúa Real, NÚMERO 12', '12'],
      ['Rúa Real, n.º 7 bajo', '7'], ['Rúa Real, N.º 4', '4'], ['Rúa Real, Núm.4', '4']]) {
      expect(lee(dir), dir).toEqual(['Rúa Real', n, n])
    }
    // Lo de siempre: el número suelto detrás de la coma; sin número detrás de la marca, nada; un CP no es un portal.
    // Pegado a una letra que no es la marca, no (como en el primer trozo); ni una palabra que empieza como ella.
    expect(numeroDe('Calle Real, 5, 2º')).toBe('5')
    expect(numeroDe('Rúa Real, nave 5')).toBe('')
    expect(numeroDe('Rúa Real, nº 15003 A Coruña')).toBe('')
    expect(numeroDe('Avenida Primero de Mayo, número4')).toBe('')
    expect(numeroDe('Rúa Real, Noia 4')).toBe('')
    // Con el portal leído, la regla de siempre: el mismo portal (3a) con el piso; otra calle, «Otra calle» y la suya.
    const buena = { direccion: 'Avenida Primero de Mayo 4, 15001 A Coruña', precision: 'portal', fuente: 'servidor', lat: 43.37, lng: -8.40 }
    expect(alElegir(d, buena)).toEqual({ direccion: 'Avenida Primero de Mayo 4, 15001 A Coruña, 2 B', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    const otra = { ...buena, direccion: 'Avenida Segundo de Mayo 4, 15001 A Coruña' }
    expect(alElegir(d, otra)).toMatchObject({ direccion: 'Avenida Segundo de Mayo 4, 15001 A Coruña, 2 B', caso: 'otra' })
    expect(juntarSugerencias([otra], [], [], 6, d)[0].otraCalle).toBe(true)
    // K4: el número que solo lleva delante el tipo de vía es del nombre, no el portal de un piso (sinPiso cortaba «3 B»
    // como el piso del 2 de «Calle 2» y se quedaba sin portal).
    for (const [dir, calle, numero, portal] of [
      ['Calle 2 3 B', 'Calle 2', '3', '3B'],
      ['Calle Real 3 B', 'Calle Real', '3', '3B'],
      ['Calle 2 3 1º B', 'Calle 2', '3', '3'],
      ['Calle 2 3', 'Calle 2', '3', '3'],
      ['Calle 2', 'Calle 2', '', ''],
      ['C/ 2 3 B, 15003 A Coruña', 'C/ 2', '3', '3B'],
      ['Calle 2 3B, 15003 A Coruña', 'Calle 2', '3', '3B'],
      // Con el nombre delante, sigue siendo el portal con su piso; detrás de un tipo que también es un nombre
      // (TIPOS_NOMBRE), también.
      ['Calle Mayor 5 2 B', 'Calle Mayor', '5', '5'],
      ['Estrada 2 3 B', 'Estrada', '2', '2'],
    ]) expect(lee(dir), dir).toEqual([calle, numero, portal])
    expect(paraBuscar('Calle 2 3 B')).toBe('Calle 2 3')
    expect(paraBuscar('Calle 2, 5 2 B')).toBe('Calle 2, 5')
    expect(conPiso('Calle 2 3 1º B, 15003 A Coruña', 'Calle 2, 3, 15003 A Coruña')).toBe('Calle 2, 3, 15003 A Coruña, 1º B')
    // Al elegir el 3B de la Calle 2: el mismo portal (3a); el 3 a secas no lo es (3b, D tal cual).
    const D = 'Calle 2 3 B, 15003 A Coruña'
    const s3b = { direccion: D, precision: 'portal', fuente: 'servidor', lat: 43.37, lng: -8.40 }
    expect(alElegir(D, s3b)).toEqual({ direccion: D, precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    const s3 = { ...s3b, direccion: 'Calle 2 3, 15003 A Coruña' }
    expect(alElegir(D, s3)).toEqual({ direccion: D, precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    expect(juntarSugerencias([s3], [], [], 6, D)[0].otraCalle).toBe(false)
    // K5: lo que ya va en la elegida, por palabras enteras: el 2 de «28013», no; el «2º B» que ya va, sí.
    expect(conPiso('Calle Mayor 15 2', 'Calle Mayor 15, 28013 Madrid')).toBe('Calle Mayor 15, 28013 Madrid, 2')
    expect(conPiso('Rúa Real 1, 2º B', 'Calle Real, 1, 15003 A Coruña, 2º B')).toBe('Calle Real, 1, 15003 A Coruña, 2º B')
    expect(conPiso('Rúa Real 1, 2º B', 'Calle Real, 1, 15003 A Coruña, 12º B')).toBe('Calle Real, 1, 15003 A Coruña, 12º B, 2º B')
    expect(conPiso('Rúa Real 1 bajo', 'Rúa Real 1, Bajo, 15003 A Coruña')).toBe('Rúa Real 1, Bajo, 15003 A Coruña')
    expect(conPiso('Rúa Real 1 1 dcha', 'Rúa Real 11, 15003 A Coruña')).toBe('Rúa Real 11, 15003 A Coruña, 1 dcha')
    expect(conPiso('Rúa Real 1 3, 15003 A Coruña', 'Rúa Real 1, 15003 A Coruña')).toBe('Rúa Real 1, 15003 A Coruña, 3')
    // Desde G2 (03-11-2026), la «A» suelta detrás del 5 es la letra del portal (5A), no el piso: no se añade.
    expect(conPiso('Calle Real 5 A, Madrid', 'Calle Real 5, 28001 Madrid')).toBe('Calle Real 5, 28001 Madrid')
    expect(conPiso('Calle Sol 3, Esc. A', 'Calle del Sol 3, 28013 Madrid, Esc A')).toBe('Calle del Sol 3, 28013 Madrid, Esc A')
    // Al elegir el mismo portal (3a), con el piso entero.
    const mayor = { direccion: 'Calle Mayor 15, 28013 Madrid', precision: 'portal', fuente: 'servidor', lat: 40.4155, lng: -3.7074 }
    expect(alElegir('Calle Mayor 15 2', mayor)).toEqual({ direccion: 'Calle Mayor 15, 28013 Madrid, 2', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
  })

  /* LA QUINTA TANDA (03-11-2026 a media mañana, el revisor y el emulador): los mismos casos que en la app nativa. */
  test('el nombre de la capital con el CP de otro municipio es la provincia, no el pueblo; «España» nunca lo es (B)', () => {
    const sug = (direccion, extra = {}) => ({ direccion, lat: 43.37, lng: -8.4, precision: 'calle', fuente: 'servidor', ...extra })
    // Oleiros (15179) escrito con «A Coruña», o con la población guardada «A Coruña»: la de la ciudad (15004), a 8 km,
    // es «Otra calle» y al elegirla queda SU dirección (4), nunca lo escrito con su punto.
    const ciudad = sug('Rúa Rosalía de Castro, 15004 A Coruña', { cp: '15004', localidad: 'A Coruña', fuente: 'photon' })
    for (const [d, cp, loc] of [['Rúa Rosalía de Castro 5, 15179 A Coruña', '', ''], ['Rúa Rosalía de Castro 5, 15179 Oleiros', '', 'A Coruña'],
      ['Rúa Rosalía de Castro 5, 15179 Oleiros', '15179', 'A Coruña'], ['Rúa Rosalía de Castro 5', '15179', 'A Coruña']]) {
      expect(mismoSitio(d, ciudad, cp, loc), d).toBe(false)
      expect(alElegir(d, ciudad, cp, loc), d).toEqual({ direccion: 'Rúa Rosalía de Castro, 15004 A Coruña', precision: 'calle', cp: '15004',
        localidad: 'A Coruña', caso: 'otra' })
      expect(juntarSugerencias([], [], [ciudad], 6, d, cp, loc)[0].otraCalle, d).toBe(true)
      expect(cambioEsAqui(d, 'sugerencia', ciudad, cp, loc), d).toEqual({ precision: 'calle', direccion: 'Rúa Rosalía de Castro, 15004 A Coruña',
        cp: '15004', localidad: 'A Coruña' })
      // El portal de la ciudad (lo que el móvil daría en segundo plano): tampoco es el de la parada.
      expect(alElegir(d, { ...ciudad, direccion: 'Rúa Rosalía de Castro 5, 15004 A Coruña', precision: 'portal' }, cp, loc).caso, d).toBe('otra')
    }
    expect(pueblosEscritos('Rúa Rosalía de Castro 5, 15179 A Coruña')).toEqual([])
    expect(pueblosEscritos('Rúa Rosalía de Castro 5, 15179 Oleiros', 'A Coruña')).toEqual(['oleiros'])
    expect(pueblosEscritos('Rúa Rosalía de Castro 5', 'A Coruña', '15179')).toEqual([])
    expect(pueblosEscritos('Rúa Rosalía de Castro 5', 'A Coruña', '15004')).toEqual(['a coruna'])
    expect(mismoPueblo('A Coruña', ['a coruna'], '15179')).toBe(false)
    expect(mismoPueblo('A Coruña', ['a coruna'], '15004')).toBe(true)
    // Con «España» detrás, igual: «espana» no es el nombre de ningún pueblo, ni «Galicia» ni «Bizkaia».
    expect(pueblosEscritos('Calle Real 5, 27002 Lugo, España')).toEqual(['lugo'])
    expect(pueblosEscritos('Rúa Real 5, Galicia')).toEqual([])
    expect(mismoPueblo('España', ['espana'])).toBe(false)
    for (const [d, s] of [['Calle Real 5, 27002 Lugo, España', 'Rúa Real, 15003 A Coruña, España'], ['Rúa Brétema 23, 15179, A Coruña', 'Rúa Brétema, 15011 A Coruña'],
      ['Calle Mayor 5, 28220 Madrid', 'Calle Mayor, 28013 Madrid']]) {
      expect(alElegir(d, sug(s)), d).toEqual({ direccion: s, precision: 'calle', cp: '', localidad: '', caso: 'otra' })
      expect(juntarSugerencias([sug(s)], [], [], 6, d)[0].otraCalle, d).toBe(true)
    }
    // Con el CP de la capital, o sin CP, es la capital, como hasta ahora: el mismo sitio (3b, lo escrito y «calle»).
    for (const [d, s] of [['Avenida de Finisterre 120, 15004 A Coruña', 'Avenida de Finisterre, 15005 A Coruña'], ['Rúa Real 5, A Coruña', 'Rúa Real, 15003 A Coruña'],
      ['Calle Mayor 5, 28013 Madrid', 'Calle Mayor, 28005 Madrid'], ['Rúa Real 5, 15003 A Coruña', 'Rúa Real, A Coruña']]) {
      expect(alElegir(d, sug(s)), d).toEqual({ direccion: d, precision: 'calle', cp: '', localidad: '', caso: 'calle' })
      expect(juntarSugerencias([sug(s)], [], [], 6, d)[0].otraCalle, d).toBe(false)
    }
    // El mismo CP sigue siendo el mismo sitio, y un CP de fuera de España no cambia nada.
    expect(mismoSitio('Rúa Rosalía de Castro 5, 15179 A Coruña', 'Rúa Rosalía de Castro, 15179 Oleiros')).toBe(true)
    expect(pueblosEscritos('Calle Mayor 5, 75001 Madrid')).toEqual(['madrid'])
  })

  test('a Photon va lo buscado sin el piso; lo que se quita sigue mirando lo buscado (C)', async () => {
    let respuesta = []
    let pedida = null
    const devolver = ((antes) => () => { globalThis.fetch = antes })(globalThis.fetch)
    globalThis.fetch = async (url) => { pedida = new URL(String(url)); return { ok: true, json: async () => ({ features: respuesta }) } }
    try {
      respuesta = [dePhoton('Travesía de Meicende', '50', '15140', 'Arteixo', -8.46481, 43.33012)]
      const r = await buscarDirecciones('Trav. de Meicende nº50 2 B, 15140, Arteixo', { pais: 'es' })
      expect(pedida.searchParams.get('q')).toBe('Trav. de Meicende nº50, 15140, Arteixo')
      expect(r.map((x) => x.direccion)).toEqual(['Travesía de Meicende 50, 15140 Arteixo'])
      await buscarDirecciones('Rúa Real 5 1 dcha, 15003 A Coruña')
      expect(pedida.searchParams.get('q')).toBe('Rúa Real 5, 15003 A Coruña')
      await buscarDirecciones('Rúa Brétema Mariñeira 23, 2º B, 15011 A Coruña')
      expect(pedida.searchParams.get('q')).toBe('Rúa Brétema Mariñeira 23, 15011 A Coruña')
      // Sin piso, tal cual.
      await buscarDirecciones('Hospital Universitario A Coruña')
      expect(pedida.searchParams.get('q')).toBe('Hospital Universitario A Coruña')
      // Las que no tocan se quitan con lo buscado, como hasta ahora.
      respuesta = [dePhoton('Rúa Almirante Mourelle', '41', '15011', 'A Coruña', -8.4101, 43.3611), dePhoton('Rúa Valtrenxo', '', '15011', 'A Coruña', -8.41, 43.36)]
      expect((await buscarDirecciones('Rúa Valtrenxo 41 2º B, 15011 A Coruña', { pais: 'es' })).map((x) => x.direccion)).toEqual(['Rúa Valtrenxo, 15011 A Coruña'])
      expect(pedida.searchParams.get('q')).toBe('Rúa Valtrenxo 41, 15011 A Coruña')
    } finally {
      devolver()
    }
  })

  test('el número del nombre seguido de una palabra no es el portal: «Calle de las 3 Cruces 12» es el 12 (F2)', () => {
    const lee = (x) => [calleDe(x), numeroDe(x), portalDe(x)]
    for (const [d, calle, n] of [['Calle de las 3 Cruces 12', 'Calle de las 3 Cruces', '12'], ['Rúa de 4 Caminos 38', 'Rúa de 4 Caminos', '38'],
      ['Calle de las 13 Rosas 7', 'Calle de las 13 Rosas', '7'], ['Plaza de los 2 Caminos 4', 'Plaza de los 2 Caminos', '4'],
      ['Calle de las 3 Cruces 12, 28013 Madrid', 'Calle de las 3 Cruces', '12']]) {
      expect(lee(d), d).toEqual([calle, n, n])
    }
    // Siguen igual: el piso sin «º», el de detrás de «y», la nave, el pueblo, el CP y los de las tandas de antes.
    for (const [d, n] of [['Calle Mayor 15 2 dcha', '15'], ['Carrer de Sants 5 2n 1a', '5'], ['Calle 2 3', '3'], ['Calle Real 5 y 7', '5'],
      ['Polígono de Sabón Parcela 10 Nave 4', '10'], ['Calle Real 1 A Coruña', '1'], ['Calle Velázquez 5 Madrid 28001', '5'], ['Calle 2 de Mayo 14', '14'],
      ['Estrada AC-173 12', '12'], ['12 rue de Rivoli', '12'], ['Avenida 18 de Julio 5 2 B', '5'], ['Lugar Pastel 12 Casa 2', '12']]) {
      expect(numeroDe(d), d).toBe(n)
    }
    // La palabra, entera: con un espacio de ancho cero dentro («Apt\u200Bo», la puerta de regresión) no es una palabra;
    // con un punto o una barra detrás, sí (como en la app nativa).
    expect(numeroDe('ESTRADA N-550 núm. 14A Apt\u200Bo 4 - 36416 Mos')).toBe('14')
    expect(numeroDe('Calle de las 3 Cruces. 12')).toBe('12')
    expect(numeroDe('Calle de las 3 Cruces/12')).toBe('12')
    // Con el piso detrás del portal, el piso se quita para buscar y se pone al elegir.
    const D = 'Calle de las 3 Cruces 12 2 dcha, 28013 Madrid'
    expect(paraBuscar(D)).toBe('Calle de las 3 Cruces 12, 28013 Madrid')
    const s = { direccion: 'Calle de las 3 Cruces 12, 28013 Madrid', precision: 'portal', fuente: 'servidor', lat: 40.4189, lng: -3.7024 }
    expect(alElegir(D, s)).toEqual({ direccion: 'Calle de las 3 Cruces 12, 28013 Madrid, 2 dcha', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    // El 3 ya no es el portal: «Calle de las 3 Cruces 3» es otro edificio de la misma calle (3b, lo escrito).
    expect(alElegir(D, { ...s, direccion: 'Calle de las 3 Cruces 3, 28013 Madrid' }).caso).toBe('calle')
  })

  test('la letra suelta del portal no es el piso al elegir; el U+FEFF y el U+000B, como un espacio (G2, H2)', () => {
    expect(conPiso('Calle Real 3 B, 15003 A Coruña', 'Calle Real 3B, 15003 A Coruña')).toBe('Calle Real 3B, 15003 A Coruña')
    expect(conPiso('Rúa Brétema Mariñeira 23 B, 15011 A Coruña', 'Rúa Brétema, 15179 Oleiros')).toBe('Rúa Brétema, 15179 Oleiros')
    expect(alElegir('Rúa Brétema Mariñeira 23 B, 15011 A Coruña', { direccion: 'Rúa Brétema, 15179 Oleiros', precision: 'calle', fuente: 'servidor' }))
      .toEqual({ direccion: 'Rúa Brétema, 15179 Oleiros', precision: 'calle', cp: '', localidad: '', caso: 'otra' })
    expect(alElegir('Calle Real 3 B, 15003 A Coruña', { direccion: 'Calle Real 3B, 15003 A Coruña', precision: 'portal', fuente: 'servidor' }))
      .toEqual({ direccion: 'Calle Real 3B, 15003 A Coruña', precision: 'portal', cp: '', localidad: '', caso: 'portal' })
    // Siguen igual: el piso con su letra, el de detrás de la coma y el piso sin letra.
    expect(conPiso('Calle Mayor 5 2 B', 'Calle Mayor 5, 28013 Madrid')).toBe('Calle Mayor 5, 28013 Madrid, 2 B')
    expect(conPiso('Rúa Real 1, 2º B', 'Calle Real, 1, 15003 A Coruña')).toBe('Calle Real, 1, 15003 A Coruña, 2º B')
    expect(conPiso('Calle Mayor 15 2', 'Calle Mayor 15, 28013 Madrid')).toBe('Calle Mayor 15, 28013 Madrid, 2')
    // H2: en el navegador ya eran \s, en Android no; ahora, un espacio normal en las dos. Y desde C (03-11-2026, la
    // séptima tanda), también U+001C-U+001F y U+0085.
    expect(EXPRESIONES_K.ESPACIOS_RAROS.source).toBe('[\\p{Z}\\t\\u000B\\u001C-\\u001F\\u0085\\uFEFF]')
    const d = 'Carrer de Hórreo,\uFEFF 120 bis, 15320 As Pontes'
    expect([numeroDe(d), portalDe(d), calleDe(d), paraBuscar(d)]).toEqual(['120', '120BIS', 'Carrer de Hórreo', 'Carrer de Hórreo, 120 bis, 15320 As Pontes'])
    const lee = (x) => [paraBuscar(x), numeroDe(x), calleDe(x), portalDe(x), conPiso(x, 'Calle Mayor 5, 28013 Madrid')]
    for (const c of [0xfeff, 0xb]) {
      const r = String.fromCodePoint(c)
      expect(lee(`Calle Mayor 5${r}2 B`), c.toString(16)).toEqual(lee('Calle Mayor 5 2 B'))
      expect(lee(`Calle Mayor,${r}5${r}2${r}B,${r}Madrid`), c.toString(16)).toEqual(lee('Calle Mayor, 5 2 B, Madrid'))
    }
    expect(pueblosEscritos('Rúa Real 5,\uFEFF15179\uFEFFOleiros')).toEqual(['oleiros'])
  })

  /* LA SEXTA TANDA (03-11-2026 a mediodía, el revisor y el verificador): los mismos casos que en la app nativa. */
  test('el número del nombre, solo detrás de un artículo: «Calle Mayor 5 Escala 2» es el 5 (F3)', () => {
    for (const [d, n] of [['Calle de las 3 Cruces 12', '12'], ['Rúa de 4 Caminos 38', '38'], ['Calle de las 13 Rosas 7', '7'],
      ['Plaza de los 2 Caminos 4', '4'], ['Calle Mayor 5 Escala 2', '5'], ['Carrer de Balmes 100 Entresol 2a', '100'],
      ['Calle Velázquez 50 Despacho 3', '50'], ['Calle Real 5 Bloq. 2 3ºB', '5'], ['Calle de Alcalá 100 Exterior 3 Izda', '100'],
      ['Av. Brasil 2000 Bloco 2 Apto 301', '2000'], ['Rua Augusta 5 Lote 3', '5'], ['Calle Real no 5 Bajo', '5'],
      // Los de las tandas de antes, igual.
      ['Calle Mayor 15 2 dcha', '15'], ['Calle 2 3', '3'], ['Calle Real 5 y 7', '5'], ['Calle 2 de Mayo 14', '14'], ['Carrer de Sants 5 2n 1a', '5'],
      ['Polígono de Sabón Parcela 10 Nave 4', '10'], ['Calle de las 3 Cruces 12, 28013 Madrid', '12'], ['12 rue de Rivoli', '12']]) {
      expect(numeroDe(d), d).toBe(n)
    }
    // El número del nombre al final del trozo: sin portal, y el nombre entero es la calle.
    for (const [d, calle] of [['Calle de las 3 Cruces, 28013 Madrid', 'Calle de las 3 Cruces'], ['Avenida del 4 Caminos, 15003 A Coruña', 'Avenida del 4 Caminos']]) {
      expect([numeroDe(d), portalDe(d), calleDe(d)], d).toEqual(['', '', calle])
    }
    // Esa sugerencia sin portal es la misma calle en el mismo sitio (3b): D se queda con su 12, sin «Otra calle».
    const D = 'Calle de las 3 Cruces 12, 28013 Madrid'
    const s = { direccion: 'Calle de las 3 Cruces, 28013 Madrid', precision: 'calle', fuente: 'servidor', lat: 40.4189, lng: -3.7024 }
    expect(alElegir(D, s)).toEqual({ direccion: D, precision: 'calle', cp: '', localidad: '', caso: 'calle' })
    expect(juntarSugerencias([s], [], [], 6, D)[0].otraCalle).toBe(false)
  })

  test('un sitio escrito que no es un pueblo no es no decir nada: «Calle Uría 5, Asturias» y la de Gijón, «Otra calle» (B2)', () => {
    const sug = (direccion, extra = {}) => ({ direccion, lat: 43.53, lng: -5.66, precision: 'calle', fuente: 'servidor', ...extra })
    for (const [d, s, cp, loc, queda] of [['Calle Uría 5, Asturias', 'Calle Uría, 33201 Gijón'], ['Rúa Real 5, Galicia', 'Rúa Real, 15142 Arteixo'],
      ['Calle Real 5, España', 'Calle Real, 28013 Madrid'], ['Kale Nagusia 5, Gipuzkoa', 'Kale Nagusia, 20800 Zarautz'],
      ['Calle Mayor 5', 'Calle Mayor, 48990 Getxo', '', 'Bizkaia'], ['Calle Mayor 5, Comunidad de Madrid', 'Calle Mayor, 28013 Madrid'],
      ['Calle Mayor 5, Región de Murcia', 'Calle Mayor, 30800 Lorca'],
      // «Torre del Mar» se lee como el piso: queda detrás de la sugerencia, como el piso.
      ['ESTRADA GALERA Nº12B, Torre del Mar, Bizkaia', 'Estrada Galera 12, 15142 Arteixo', '', '', 'Estrada Galera 12, 15142 Arteixo, Torre del Mar']]) {
      expect(mismoSitio(d, sug(s), cp, loc), d).toBe(false)
      expect(alElegir(d, sug(s), cp, loc), d).toEqual({ direccion: queda || s, precision: 'calle', cp: '', localidad: '', caso: 'otra' })
      expect(juntarSugerencias([sug(s)], [], [], 6, d, cp, loc)[0].otraCalle, d).toBe(true)
    }
    // Sin ningún sitio escrito, como hasta ahora: el mismo sitio (3b, lo escrito con el CP y el pueblo de la sugerencia).
    const oleiros = sug('Rúa Real, 15179 Oleiros', { cp: '15179', localidad: 'Oleiros' })
    expect(mismoSitio('Rúa Real 5', oleiros)).toBe(true)
    expect(mismoSitio('Rúa Real 5, 2º B', oleiros)).toBe(true)
    expect(alElegir('Rúa Real 5', oleiros)).toEqual({ direccion: 'Rúa Real 5, 15179 Oleiros', precision: 'calle', cp: '15179', localidad: 'Oleiros', caso: 'calle' })
    // La capital con el CP de otro municipio, escrita sin el campo: tampoco es el mismo sitio que una sin CP de otro pueblo.
    expect(mismoSitio('Calle Real 5, 15179 A Coruña', sug('Calle Real 5', { localidad: 'Culleredo' }))).toBe(false)
    expect(mismoSitio('Calle Real 5, 15179 A Coruña', sug('Calle Real 5'))).toBe(false)
  })

  test('todas las provincias: «Calle Mayor 5, 30800 Lorca, Murcia» no es «Calle Mayor, 30001 Murcia» (P)', () => {
    const sug = (direccion) => ({ direccion, lat: 37.98, lng: -1.13, precision: 'calle', fuente: 'servidor' })
    for (const [d, s] of [['Calle Mayor 5, 30800 Lorca, Murcia', 'Calle Mayor, 30001 Murcia'],
      ['Calle Reina Victoria 5, 03201 Elche, Alicante', 'Calle Reina Victoria, 03001 Alicante'],
      ['Calle Larga 5, 11403 Jerez de la Frontera, Cádiz', 'Calle Larga, 11001 Cádiz'], ['Calle Mayor 5, 18600 Motril, Granada', 'Calle Mayor, 18001 Granada'],
      ['Calle Mayor 5, 45600 Talavera de la Reina, Toledo', 'Calle Mayor, 45001 Toledo'], ['Calle Mayor 5, 35200 Telde, Las Palmas', 'Calle Mayor, 35001 Las Palmas']]) {
      expect(mismoSitio(d, sug(s)), d).toBe(false)
      expect(alElegir(d, sug(s)), d).toEqual({ direccion: s, precision: 'calle', cp: '', localidad: '', caso: 'otra' })
      expect(juntarSugerencias([sug(s)], [], [], 6, d)[0].otraCalle, d).toBe(true)
    }
    // La capital con su CP, o sin CP, sigue siendo la capital: el mismo sitio (3b).
    for (const [d, s] of [['Calle Mayor 5, 30001 Murcia', 'Calle Mayor, 30002 Murcia'], ['Calle Mayor 5, Murcia', 'Calle Mayor, 30001 Murcia'],
      ['Calle Mayor 5, 30001 Murcia, Región de Murcia', 'Calle Mayor, 30002 Murcia'], ['Calle Mayor 5, 13001 Ciudad Real', 'Calle Mayor, 13002 Ciudad Real']]) {
      expect(mismoSitio(d, sug(s)), d).toBe(true)
      expect(alElegir(d, sug(s)).caso, d).toBe('calle')
    }
    // Las de varias palabras, como las de una: detrás del pueblo se quitan enteras, y solas son la provincia.
    for (const [d, pueblos] of [['Calle Mayor 5, Telde Las Palmas', ['telde']], ['Calle Mayor 5, 24400 Ponferrada, Castilla y León', ['ponferrada']],
      ['Calle Mayor 5, Ponferrada Castilla y León', ['ponferrada']], ['Calle Mayor 5, 30001 Murcia, Región de Murcia', ['murcia']],
      ['Calle Mayor 5, Comunidad de Madrid', []], ['Calle Mayor 5, Castilla y León', []], ['Calle Mayor 5, 26001 Logroño, La Rioja', ['logrono']],
      ['Calle Mayor 5, La Rioja', []], ['Calle Mayor 5, Islas Baleares', []], ['Calle Mayor 5, 13300 Valdepeñas, Ciudad Real', ['valdepenas']],
      ['Calle Mayor 5, 13300 Ciudad Real', []], ['Calle Mayor 5, 38001 Santa Cruz de Tenerife', ['santa cruz de tenerife']],
      ['Calle Mayor 5, 38400 Puerto de la Cruz, Santa Cruz de Tenerife', ['puerto de la cruz']], ['Carrer Major 5, 25001 Lleida', ['lleida']],
      ['Carrer Major 5, 25600 Balaguer, Lleida', ['balaguer']], ['Carrer Major 5, 03203 Elx, Alacant', ['elx']]]) {
      expect(pueblosEscritos(d), d).toEqual(pueblos)
    }
    expect(mismoPueblo('Ciudad Real', ['ciudad real'], '13001')).toBe(true)
    expect(mismoPueblo('Ciudad Real', ['ciudad real'], '13300')).toBe(false)
    expect(mismoPueblo('Región de Murcia', ['region'])).toBe(false)
  })

  /* LA SÉPTIMA TANDA (03-11-2026 por la tarde, el revisor y el verificador): los mismos casos que en la app nativa. */
  test('la provincia detrás de «de» es del pueblo: «Alhama de Murcia» no es «Alhama de Granada» (P2)', () => {
    const sug = (direccion) => ({ direccion, lat: 37.0, lng: -3.99, precision: 'calle', fuente: 'servidor' })
    for (const [d, s, cp = '', loc = ''] of [['Calle Real 5, 30840 Alhama de Murcia', 'Calle Real, 18120 Alhama de Granada'],
      ['Calle Real 5', 'Calle Real, 18120 Alhama de Granada', '30840', 'Alhama de Murcia'],
      ['Calle Real 5, Alhama de Murcia', 'Calle Real 5, 18120 Alhama de Granada'], ['Calle Real 5, Alhama de Almería', 'Calle Real, 30840 Alhama de Murcia'],
      ['Calle Real 5, 14300 Villaviciosa de Córdoba', 'Calle Real, 33300 Villaviciosa'], ['Calle Real 5, 14800 Priego de Córdoba', 'Calle Real 5, Priego'],
      ['Calle Real 5, Burguillos de Toledo', 'Calle Real, 41220 Burguillos'], ['Calle Real 5, 05600 El Barco de Ávila', 'Calle Real, 32300 O Barco'],
      // Lo de P (la sexta), igual.
      ['Calle Mayor 5, 30800 Lorca, Murcia', 'Calle Mayor, 30001 Murcia']]) {
      expect(mismoSitio(d, sug(s), cp, loc), d).toBe(false)
      expect(juntarSugerencias([sug(s)], [], [], 6, d, cp, loc)[0].otraCalle, d).toBe(true)
      expect(alElegir(d, sug(s), cp, loc).caso, d).toBe('otra')
    }
    for (const [d, pueblos] of [['Calle Real 5, 30840 Alhama de Murcia', ['alhama de murcia']], ['Calle Real 5, 18120 Alhama de Granada', ['alhama de granada']],
      ['Calle Real 5, Alhama de Almería', ['alhama de almeria']], ['Calle Real 5, Villaviciosa de Córdoba', ['villaviciosa de cordoba']],
      ["Carrer Major 5, 03550 Sant Joan d'Alacant", ['sant joan d alacant']], ['Calle Real 5, 14440 Villanueva de Córdoba, Córdoba', ['villanueva de cordoba']],
      // Siguen igual: la provincia detrás del pueblo se quita, y la que es entera una provincia se queda.
      ['Calle Mayor 5, 30800 Lorca, Murcia', ['lorca']], ['Calle Mayor 5, Telde Las Palmas', ['telde']], ['Calle Mayor 5, Región de Murcia', []],
      ['Calle Mayor 5, Castilla y León', []], ['Calle Mayor 5, Ponferrada Castilla y León', ['ponferrada']]]) {
      expect(pueblosEscritos(d), d).toEqual(pueblos)
    }
    // El mismo pueblo, escrito con su CP o sin él, sigue siendo el mismo sitio; el de otra provincia, no.
    expect(mismoSitio('Calle Real 5, 30840 Alhama de Murcia', sug('Calle Real, Alhama de Murcia'))).toBe(true)
    expect(mismoPueblo('Alhama de Granada', ['alhama de murcia'])).toBe(false)
    expect(mismoPueblo('Villaviciosa', ['villaviciosa de cordoba'])).toBe(false)
  })

  test('«No.» y las letras sueltas no son artículos: «Calle Hidalgo No. 25 Col. Centro» es el 25 (F4)', () => {
    for (const [d, n] of [['Calle Hidalgo No. 25 Col. Centro', '25'], ['Av. Juárez No. 100 Colonia Centro, 06000 Ciudad de México', '100'],
      ['Calle 10 No. 5-20 Barrio Centro', '5'], ['Calle Mayor No 5 Madrid', '5'], ['Avenida Juan Carlos I 12 Urb. Los Pinos', '12'],
      ['Avenida Juan Carlos I 12 Esquina Calle Real, 28013 Madrid', '12'], ['Calle A 5 Polígono Industrial, 15008 A Coruña', '5'],
      ['Calle A 12 Polígono Industrial Sabón, 15142 Arteixo', '12'], ['Calle E 7 Polígono de Pocomaco, 15190 A Coruña', '7'],
      ['Calle Virgen de la O 5 Sevilla', '5'], ['Calle Real No. 5 Escala 2', '5'], ['Avenida Juan Carlos I 12 Bloq. 2 3ºB', '12'],
      ['Carrer de Jaume I 5 Entresol 2a', '5'], ['Calle de la Paz No 153 Col. Roma, 2n 1a, 36202 Vigo', '153'],
      // Los de F3, igual.
      ['Calle de las 3 Cruces 12', '12'], ['Rúa de 4 Caminos 38', '38'], ['Calle de las 13 Rosas 7', '7'], ['Plaza de los 2 Caminos 4', '4'],
      ['Calle Mayor 5 Escala 2', '5'],
      // Con un espacio de ancho cero dentro («d\u200Be»), el artículo sigue siendo «de».
      ["Calle d\u200Be 4 Caminos, Nº 3-14, 08901 L'Hospitalet de Llobregat", '3'], ['Calle d\u200Be las 3 Cruces 12', '12']]) {
      expect(numeroDe(d), d).toBe(n)
    }
    expect([numeroDe('Calle de las 3 Cruces, 28013 Madrid'), portalDe('Calle de las 3 Cruces, 28013 Madrid')]).toEqual(['', ''])
    // La marca no es del nombre, y el portal va con su letra.
    expect([calleDe('Calle Hidalgo No. 25 Col. Centro'), portalDe('Calle Hidalgo No. 25B Col. Centro')]).toEqual(['Calle Hidalgo', '25B'])
    expect(calleDe('Avenida Juan Carlos I 12 Urb. Los Pinos')).toBe('Avenida Juan Carlos I')
  })

  test('los de control U+001C-U+001F y U+0085, como un espacio, igual que en la app nativa (C)', () => {
    const lee = (x) => [paraBuscar(x), numeroDe(x), calleDe(x), portalDe(x), conPiso(x, 'Calle Mayor 5, 28013 Madrid'), pueblosEscritos(x)]
    for (const c of [0x1c, 0x1d, 0x1e, 0x1f, 0x85]) {
      const r = String.fromCodePoint(c)
      expect(lee(`Calle Mayor 5${r}2 B`), c.toString(16)).toEqual(lee('Calle Mayor 5 2 B'))
      expect(lee(`Calle Mayor,${r}5${r}2${r}B,${r}Madrid`), c.toString(16)).toEqual(lee('Calle Mayor, 5 2 B, Madrid'))
      expect(lee(`${r}Calle Mayor 5, 2º B${r}, 28013 Madrid${r}`), c.toString(16)).toEqual(lee('Calle Mayor 5, 2º B, 28013 Madrid'))
      // Al elegir, el piso sin el de control detrás (lo que el verificador vio distinto en la app nativa).
      expect(conPiso(`Plaça de Galicia 12 2º B${r}, 28220 Majadahonda`, 'Plaça de Galicia 12, 28220 Majadahonda'), c.toString(16))
        .toBe('Plaça de Galicia 12, 28220 Majadahonda, 2º B')
    }
  })
})
