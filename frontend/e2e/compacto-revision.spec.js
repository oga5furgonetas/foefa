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
