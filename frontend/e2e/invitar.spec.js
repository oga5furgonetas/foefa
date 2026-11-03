import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA INVITACIÓN TRAS LA PRIMERA ENTREGA Y EL PRIMER DÍA (02-11-2026; Dani: «viralización… lo más barato posible»),
   con la API simulada. Con una entrega real de hoy sale la tarjeta bajo la siguiente parada (o en el resumen, terminado
   el día) con el WhatsApp que lleva su código y «Copiar el enlace»; «Ahora no» la quita hasta mañana (y solo hasta
   mañana, aunque la app siga abierta); sin entregas, con solo ejemplos entregados o en la ruta de prueba no sale. El
   código es el que la app ya pide al abrir (/referidos): la tarjeta no añade llamadas, salvo que esa falle (entonces se
   pide una vez más, con la entrega real). Y la pantalla vacía del primer día ofrece verlo con paradas de ejemplo, que
   pide al servidor. */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
// El día de antes (la app abierta de un día para otro), contado sobre la fecha y no restando 24 h: sin líos de horario.
const AYER = (() => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })()
const REFERIDO = { codigo: 'ANA123', invitados: 0, premiados: 0, saldo: 0, ganado: 0, por_invitado: 1000, retirada_min: 6000,
  promo_hasta: '2026-12-31', promo_cent: 1000, entregas_cartera: 20, dias_distintos: 2, metodos: ['bizum', 'iban'], cartera: true,
  pendiente: false, retiradas: [] }
const dos = (n) => String(n).padStart(2, '0')
const parada = (n, estado, extra = {}) => ({
  id: `p${n}`, codigo: `COD${n}`, cliente: `Cliente ${n}`, direccion: `Rúa Real ${n}`, estado, bultos: 1, orden: n, eta: `10:${dos(n)}`,
  lat: 43.36 + n / 1000, lng: -8.41, cobrar: 0, notas: '', telefono: '',
  ...(estado === 'entregado' ? { cerrado_en: `${HOY}T09:${dos(n)}:00Z` } : {}), ...extra })

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

/* La app de quien reparte solo (/ruta), con sesión, y la ruta de hoy con las paradas que se le pasan. Devuelve cuántas
   veces se pidió cada cosa al servidor y la ruta, que se puede cambiar antes de recargar. `fallaReferidos`: cuántas de
   las primeras llamadas a /referidos dan error (sin cobertura en la nave, un fallo del servidor). */
async function rutaDeHoy(page, pedidos, { referido = REFERIDO, fallaReferidos = 0, ...extra } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], precios: { mensual: 9.99, anual: 99 },
    regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: new Date(Date.now() + 30 * 86400000).toISOString() } }))
  const veces = { referidos: 0, ejemplo: 0 }
  const ruta = { activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null,
    pais: 'es', prefijo: '34', ruta: pedidos.length ? { fin: '11:00', minutos: 45, km: 6, trafico: true } : null, pedidos, ...extra }
  await page.route(/\/api\/referidos$/, (r) => {
    veces.referidos += 1
    if (veces.referidos <= fallaReferidos) return r.fulfill({ status: 500, json: { detail: 'Error interno' } })
    return referido ? r.fulfill({ json: referido }) : r.fulfill({ status: 403, json: { detail: 'Los enlaces de invitación son de cada cuenta' } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos\/ejemplo$/, async (r) => {
    veces.ejemplo += 1
    veces.ejemploCuerpo = r.request().postDataJSON()
    ruta.pedidos = [1, 2, 3].map((n) => parada(n, 'pendiente', { cliente: `Cliente de ejemplo ${n}`, direccion: `Calle de ejemplo ${n}`, ejemplo: true }))
    ruta.ruta = { fin: '11:00', minutos: 20, km: 2, trafico: false }
    await r.fulfill({ json: { ok: true, n: 3 } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta }))
  return { veces, ruta }
}

test.describe('la invitación tras la primera entrega', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
    geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('con una entrega hecha sale bajo la siguiente parada, el WhatsApp lleva su código y «Ahora no» la quita hasta mañana', async ({ page }) => {
    const fallos = vigilar(page)
    const { veces } = await rutaDeHoy(page, [parada(1, 'entregado'), parada(2, 'pendiente'), parada(3, 'pendiente')])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByTestId('invitar-entrega')
    await expect(tarjeta).toContainText('Gana 10 € por cada compañero que reparta con FDS')
    await expect(tarjeta).toContainText('Lo cobras cuando haga 20 entregas en 2 días distintos.')
    // Justo debajo de la siguiente parada (la 2), no al final de la lista.
    await expect(page.locator('#parada-p2 + [data-testid="invitar-entrega"]')).toBeVisible()
    // El código es el que la app pidió al abrir: una sola llamada a /referidos.
    expect(veces.referidos).toBe(1)
    const href = await tarjeta.getByRole('link', { name: 'Invitar por WhatsApp' }).getAttribute('href')
    expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/)
    const texto = decodeURIComponent(href.split('text=')[1])
    expect(texto).toContain('Reparto con FDS: me ordena la ruta y me guía hasta cada puerta.')
    expect(texto).toContain('/invita?ref=ANA123&utm_source=referido')
    // Mientras duren la promoción (gratis hasta el 31-12) y el bono del invitado (lib/precios.js).
    if (new Date() <= new Date('2026-12-31T23:59:59')) {
      expect(texto).toContain('Es gratis y sin límite hasta el 31 de diciembre.')
      expect(texto).toContain('Tu primera ruta real te da 25 €.')
    }
    await tarjeta.getByRole('button', { name: 'Copiar el enlace' }).click()
    await expect(page.getByText('Enlace copiado: pégalo en un WhatsApp o en el grupo de tus compañeros.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/invita?ref=ANA123&')
    await tarjeta.getByRole('button', { name: 'Ahora no' }).click()
    await expect(tarjeta).toHaveCount(0)
    // Recordado hasta mañana: tras recargar no vuelve.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#parada-p2')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    expect(await page.evaluate((d) => localStorage.getItem(`invitar_no_${d}`), HOY)).toBe('1')
    expect(fallos).toEqual([])
  })

  test('sin una entrega real no sale: paradas pendientes, solo ejemplos entregados o la ruta de prueba', async ({ page }) => {
    const fallos = vigilar(page)
    const { ruta } = await rutaDeHoy(page, [parada(1, 'pendiente'), parada(2, 'pendiente')])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#parada-p1')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    // Un ejemplo entregado no es una entrega real.
    ruta.pedidos = [parada(1, 'entregado', { ejemplo: true }), parada(2, 'pendiente', { ejemplo: true })]
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#parada-p2')).toBeVisible()
    await expect(page.getByText('Estas paradas son de ejemplo.')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    // La ruta de prueba sin cuenta: tampoco (no tiene código que dar).
    ruta.pedidos = [parada(1, 'entregado'), parada(2, 'pendiente')]
    ruta.prueba = true
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ruta de prueba con paradas de ejemplo. Se borra mañana.')).toBeVisible()
    await expect(page.locator('#parada-p2')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('sin código de referido (la cuenta no está en el programa) no promete nada', async ({ page }) => {
    const fallos = vigilar(page)
    await rutaDeHoy(page, [parada(1, 'entregado'), parada(2, 'pendiente')], { referido: null })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#parada-p2')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('terminado el día, la tarjeta va en el resumen en lugar del botón de siempre', async ({ page }) => {
    const fallos = vigilar(page)
    await rutaDeHoy(page, [parada(1, 'entregado'), parada(2, 'entregado'), parada(3, 'fallido', { motivo: 'No había nadie' })])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const resumen = page.getByLabel('Resumen del día')
    await expect(resumen.getByText('Ruta terminada')).toBeVisible()
    const tarjeta = resumen.getByTestId('invitar-entrega')
    await expect(tarjeta).toContainText('Gana 10 € por cada compañero que reparta con FDS')
    await expect(tarjeta.getByRole('link', { name: 'Invitar por WhatsApp' })).toHaveAttribute('href', /ANA123/)
    await expect(resumen.getByRole('button', { name: 'Invitar a un compañero' })).toHaveCount(0)
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(1)
    expect(fallos).toEqual([])
  })

  test('si /referidos falla al abrir, se vuelve a pedir con la entrega real y la tarjeta sale', async ({ page }) => {
    const fallos = vigilar(page)
    // La primera llamada (la de la app al abrir) da 500; la segunda, la de MiRuta al ver una entrega real, contesta.
    const { veces } = await rutaDeHoy(page, [parada(1, 'entregado'), parada(2, 'pendiente')], { fallaReferidos: 1 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#parada-p2 + [data-testid="invitar-entrega"]')).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toContainText('Gana 10 € por cada compañero que reparta con FDS')
    expect(veces.referidos).toBe(2)
    expect(fallos).toEqual([])
  })

  test('«Ahora no» vale solo para ese día de ruta: con la app abierta, al día siguiente vuelve', async ({ page }) => {
    const fallos = vigilar(page)
    const { veces, ruta } = await rutaDeHoy(page, [parada(1, 'entregado', { cerrado_en: `${AYER}T09:01:00Z` }), parada(2, 'pendiente')],
      { fecha: AYER })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByTestId('invitar-entrega')
    await expect(tarjeta).toBeVisible()
    await tarjeta.getByRole('button', { name: 'Ahora no' }).click()
    await expect(tarjeta).toHaveCount(0)
    // Pasa la medianoche sin cerrar la app: la ruta ya es la de hoy, con su primera entrega.
    ruta.fecha = HOY
    ruta.pedidos = [parada(3, 'entregado'), parada(4, 'pendiente')]
    await page.evaluate(() => window.dispatchEvent(new Event('fds-recargar-ruta')))
    await expect(page.locator('#parada-p4 + [data-testid="invitar-entrega"]')).toBeVisible()
    // Lo de ayer sigue apuntado solo para ayer, y la tarjeta no ha pedido nada más al servidor.
    expect(await page.evaluate((d) => localStorage.getItem(`invitar_no_${d}`), AYER)).toBe('1')
    expect(await page.evaluate((d) => localStorage.getItem(`invitar_no_${d}`), HOY)).toBeNull()
    expect(veces.referidos).toBe(1)
    expect(fallos).toEqual([])
  })
})

test.describe('el primer día', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
    geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('la pantalla vacía ofrece verlo con paradas de ejemplo y las pide al servidor con su posición', async ({ page }) => {
    const fallos = vigilar(page)
    const { veces } = await rutaDeHoy(page, [])
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Carga tus paradas de hoy')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Etiquetas en los paquetes' })).toBeVisible()
    await expect(page.getByTestId('invitar-entrega')).toHaveCount(0)
    await page.getByRole('button', { name: 'Verlo en acción con 3 paradas de ejemplo' }).click()
    await expect.poll(() => veces.ejemplo).toBe(1)
    expect(veces.ejemploCuerpo.lat).toBeCloseTo(43.3623, 3)
    await expect(page.getByText(/Son paradas de ejemplo, a tu alrededor/)).toBeVisible()
    await expect(page.getByText('Cliente de ejemplo 1')).toBeVisible()
    await expect(page.getByText('Estas paradas son de ejemplo.')).toBeVisible()
    expect(fallos).toEqual([])
  })
})
