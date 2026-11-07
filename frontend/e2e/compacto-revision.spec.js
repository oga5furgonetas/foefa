import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LO QUE SALIÓ AL MIRAR LAS CAPTURAS DEL DISEÑO COMPACTO (08-11-2026, parte F2). Son cosas que se ven y que ninguna prueba de
   comportamiento miraba; cada prueba mide en la pantalla lo que se vio en la captura:
   - la cifra del bono («0/20») pegada al borde derecho de su caja (4 de aire contra 12 a la izquierda);
   - la tarjeta «¿Qué tal te va la app?» más estrecha que el resto de la columna (un `mx-auto` en un flex en columna);
   - «Guardar este orden» (el pie de «A mano») detrás de la barra de pestañas hasta llegar al final de la lista;
   - «Por entregar · 15» del portal del conductor, de 10 px de ancho y en 4 líneas bajo la lupa, a 390-412 de ancho.
   (El doble ✓ de «Añadida a tu ruta» se mira en escanear-etiqueta.spec.js.) */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

async function preparar(page, context) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_aviso_manana', 'no')
    localStorage.setItem('fds_tour_ruta', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], status: 'active', suscrita: true, suscrito: true,
    ciclo: 'mensual', proximo_cobro: new Date(Date.now() + 30 * 86400000).toISOString() } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
}

const pendiente = (i) => ({ id: `p${i}`, cliente: `Cliente ${i}`, direccion: `Calle de prueba ${i}, A Coruña`, estado: 'pendiente', bultos: 1, orden: i, eta: `10:${10 + i}`, lat: 43.37 + i / 1000, lng: -8.4 })
const hecha = (i) => ({ id: `h${i}`, cliente: `Hecha ${i}`, direccion: `Calle hecha ${i}`, estado: 'entregado', bultos: 1, orden: i, cerrado_en: '2026-11-03T08:00:00Z' })
const ruta = (pedidos, extra = {}) => ({ activo: true, autonomo: true, empresa: '', fecha: '2026-11-03', ia_tickets: false, jornada: {}, aviso_aceptado: true,
  base: null, ruta: pedidos.length ? { fin: '11:00', minutos: 60, km: 9, trafico: true } : null, pedidos, ...extra })

test('Compacto · el bono: la cifra tiene el mismo aire a la derecha que el icono a la izquierda', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([], { bono: { cent: 1000, pagado: false, entregas: 0, dias: 0, objetivo: 20, dias_objetivo: 2, hasta: '2026-11-30' } }) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const bono = page.getByTestId('bono')
  await expect(bono).toBeVisible()
  const m = await bono.evaluate((el) => {
    const caja = el.getBoundingClientRect()
    const cifra = [...el.querySelectorAll('span')].find((s) => /^\d+\/\d+$/.test(s.textContent.trim())).getBoundingClientRect()
    const icono = el.querySelector('svg').getBoundingClientRect()
    return { izquierda: icono.left - caja.left, derecha: caja.right - cifra.right }
  })
  expect(m.izquierda).toBeGreaterThanOrEqual(11.5)
  expect(Math.abs(m.izquierda - m.derecha), `izquierda ${m.izquierda}, derecha ${m.derecha}`).toBeLessThanOrEqual(1)
})

test('Compacto · la tarjeta «¿Qué tal te va la app?» ocupa todo el ancho de la columna', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/opinion\/estado/, (r) => r.fulfill({ json: { pedir: true } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([hecha(1), hecha(2), hecha(3)]) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const opinion = page.getByRole('region', { name: '¿Qué tal te va la app?' })
  await expect(opinion).toBeVisible()
  const ancho = (l) => l.evaluate((el) => ({ x: el.getBoundingClientRect().left, w: el.getBoundingClientRect().width }))
  const o = await ancho(opinion)
  const columna = await ancho(page.getByLabel('Progreso del día'))
  expect(Math.abs(o.w - columna.w), `opinión ${o.w}, columna ${columna.w}`).toBeLessThanOrEqual(1)
  expect(Math.abs(o.x - columna.x)).toBeLessThanOrEqual(1)
})

test('Compacto · «Guardar este orden» queda por encima de las pestañas, no detrás', async ({ page, context }) => {
  await preparar(page, context)
  const pedidos = Array.from({ length: 14 }, (_, i) => pendiente(i + 1))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'A mano' }).click()
  const guardar = page.getByRole('button', { name: 'Guardar este orden' })
  await expect(guardar).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  const caja = await guardar.boundingBox()
  const pestanas = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox()
  expect(caja.y + caja.height, `el pie acaba en ${caja.y + caja.height} y las pestañas empiezan en ${pestanas.y}`).toBeLessThanOrEqual(pestanas.y + 0.5)
  // Y se puede tocar: lo que hay en su centro es el propio botón.
  const quien = await guardar.evaluate((el) => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) })
  expect(quien).toBe(true)
})

test('Compacto · portal del conductor: «Por entregar · N» cabe en su línea a 390 y a 412 de ancho', async ({ page }) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(Array.from({ length: 6 }, (_, i) => pendiente(i + 1)), { autonomo: false, empresa: 'Súper' }) }))
  for (const [ancho, alto] of [[390, 844], [393, 852], [412, 915], [360, 740]]) {
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
    const titulo = page.getByRole('heading', { name: /Por entregar/ })
    await expect(titulo).toBeVisible()
    const m = await titulo.evaluate((el) => ({ alto: el.getBoundingClientRect().height, sobra: el.scrollWidth - el.clientWidth }))
    expect(m.alto, `a ${ancho} de ancho el título mide ${m.alto} de alto (una línea ≈ 16)`).toBeLessThanOrEqual(24)
    expect(m.sobra, `a ${ancho} el texto se sale de su caja`).toBeLessThanOrEqual(1)
    // La lupa y «A mano» siguen a la vista y en su fila.
    await expect(page.getByRole('button', { name: 'Buscar en la ruta' }).or(page.getByRole('button', { name: 'A mano' })).first()).toBeVisible()
  }
})
