import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ACTIVACIÓN (05-10-2026): quien se registra sin paquetes a mano puede ver la app
   trabajando con 3 paradas de ejemplo (y quitarlas de golpe), y puede invitar a un
   compañero con el enlace medible. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

async function preparar(page, context) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 40.4168, longitude: -3.7038 })
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
}

test('Activación · sin paquetes, 3 paradas de ejemplo con un toque, y se quitan juntas', async ({ page, context }) => {
  await preparar(page, context)
  let pedidos = []
  const llamadas = { ejemplo: [], quitar: 0 }
  await page.route(/\/api\/reparto\/mis-pedidos\/ejemplo/, async (r) => {
    llamadas.ejemplo.push(r.request().postDataJSON())
    pedidos = [1, 2, 3].map((n) => ({ id: `e${n}`, cliente: `Cliente de ejemplo ${n}`, direccion: `Calle de ejemplo ${n}`, estado: 'pendiente', bultos: 1, orden: n, eta: `10:0${n}`, lat: 40.42 + n / 1000, lng: -3.70, ejemplo: true }))
    await r.fulfill({ json: { ok: true, n: 3 } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos\/quitar-ejemplos/, async (r) => {
    llamadas.quitar += 1; pedidos = []; await r.fulfill({ json: { ok: true, quitadas: 3 } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: pedidos.length ? { fin: '10:30', minutos: 30, km: 2, trafico: true } : null, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Verlo en acción con 3 paradas de ejemplo' }).click()
  await expect(page.getByText('Cliente de ejemplo 1')).toBeVisible()
  await expect(page.getByText('Estas paradas son de ejemplo.')).toBeVisible()
  await expect(page.getByText('EJEMPLO').first()).toBeVisible()
  // Se manda la posición del móvil para ponerlas a su alrededor.
  expect(llamadas.ejemplo).toHaveLength(1)
  expect(llamadas.ejemplo[0].lat).toBeCloseTo(40.4168, 3)
  await page.getByRole('button', { name: 'Quitar los ejemplos' }).click()
  await expect(page.getByText('Ejemplos quitados. Ya puedes cargar tus paquetes.')).toBeVisible()
  expect(llamadas.quitar).toBe(1)
  await expect(page.getByText('Cliente de ejemplo 1')).toHaveCount(0)
})

test('Activación · invitar a un compañero: tu enlace con código, tu progreso y WhatsApp', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'ABC123', invitados: 2, premiados: 1, meses_ganados: 1, tope: 6, entregas: 5, dias_extra: 7 } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos: [] } }))
  // Sin «compartir» del sistema (escritorio): se abre WhatsApp.
  await page.addInitScript(() => { try { Object.defineProperty(navigator, 'share', { value: undefined }) } catch { /* nada */ } window.__abierto = []; window.open = (u) => { window.__abierto.push(String(u)); return null } })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Cuenta' }).click({ force: true })
  await expect(page.getByText('Invita a un compañero y gana 1 mes gratis')).toBeVisible()
  await expect(page.getByText(/Tu amigo empieza con 14 días gratis\. Cuando haga 5 entregas/)).toBeVisible()
  await expect(page.getByText('Has invitado a 2 · ya la usan 1 · meses ganados: 1')).toBeVisible()
  await page.getByRole('button', { name: 'Invitar a un compañero' }).click()
  await expect.poll(async () => (await page.evaluate(() => window.__abierto)).length).toBe(1)
  const abierto = (await page.evaluate(() => window.__abierto))[0]
  expect(abierto).toMatch(/^https:\/\/wa\.me\/\?text=/)
  const texto = decodeURIComponent(abierto.split('text=')[1])
  expect(texto).toContain('/repartidores?ref=ABC123&utm_source=referido&utm_medium=compartir&utm_campaign=rep_invitar')
  expect(texto).toContain('14 días gratis')
})

test('Activación · quien llega con el enlace de un compañero ve «14 días» y su código viaja con el alta', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
  })
  await page.route(/\/api\/referidos\/ABC123/, (r) => r.fulfill({ json: { valido: true, dias_extra: 7 } }))
  await page.route(/\/api\/referidos\/MALO99/, (r) => r.fulfill({ json: { valido: false, dias_extra: 7 } }))
  let cuerpo = null
  await page.route(/\/api\/auth\/register/, async (r) => { cuerpo = r.request().postDataJSON(); await r.fulfill({ status: 400, json: { detail: 'prueba' } }) })
  await page.goto('/repartidores?ref=ABC123&utm_source=referido', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Te ha invitado un compañero: 14 días gratis').first()).toBeVisible()
  await expect(page.getByText('14 días gratis · sin tarjeta · cancelas cuando quieras')).toBeVisible()
  await page.getByRole('link', { name: /Crear mi cuenta gratis/ }).first().click()
  await expect(page).toHaveURL(/\/registro/)
  await expect(page.getByText('Te ha invitado un compañero: 14 días gratis')).toBeVisible()
  await page.getByPlaceholder('Pepe').fill('Rosa')
  await page.getByPlaceholder('tu@correo.com').fill('rosa@example.es')
  await page.locator('input[type=password]').first().fill('12345678')
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect.poll(() => cuerpo).not.toBeNull()
  expect(cuerpo.ref).toBe('ABC123')
  expect(cuerpo.sector).toBe('autonomo')
})

test('Activación · un código que no vale NO promete días de más', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() })))
  await page.route(/\/api\/referidos\/MALO99/, (r) => r.fulfill({ json: { valido: false, dias_extra: 7 } }))
  await page.goto('/repartidores?ref=MALO99', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('7 días gratis · sin tarjeta · cancelas cuando quieras')).toBeVisible()
  await expect(page.getByText(/Te ha invitado un compañero/)).toHaveCount(0)
})

test('Activación · quien ya la usa ve «¿Qué tal te va?» una vez, y su opinión se envía', async ({ page, context }) => {
  await preparar(page, context)
  let enviado = null
  await page.route(/\/api\/opinion\/estado/, (r) => r.fulfill({ json: { pedir: true } }))
  await page.route(/\/api\/opinion$/, async (r) => { enviado = r.request().postDataJSON(); await r.fulfill({ json: { ok: true } }) })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos: [] } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('¿Qué tal te va la app?')).toBeVisible()
  await page.getByRole('button', { name: '4', exact: true }).click()
  await page.getByPlaceholder('Escribe aquí qué te falta o qué mejorarías').fill('Me falta importar un Excel')
  await page.getByRole('button', { name: 'Enviar mi opinión' }).click()
  await expect(page.getByText('¡Gracias! Lo leo yo personalmente.')).toBeVisible()
  expect(enviado).toEqual({ valor: 4, texto: 'Me falta importar un Excel' })
})
