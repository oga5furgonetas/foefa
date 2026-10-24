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
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'ABC123', invitados: 2, premiados: 1, saldo: 1000, ganado: 1000, por_invitado: 1000,
    promo_hasta: '2026-12-31', promo_cent: 1000, retirada_min: 6000, entregas_cartera: 20, dias_distintos: 2, dias_extra: 7, retiradas: [] } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos: [] } }))
  // Sin «compartir» del sistema (escritorio): se abre WhatsApp.
  await page.addInitScript(() => { try { Object.defineProperty(navigator, 'share', { value: undefined }) } catch { /* nada */ } window.__abierto = []; window.open = (u) => { window.__abierto.push(String(u)); return null } })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Cuenta' }).click({ force: true })
  await expect(page.getByText('10 € por cada compañero que la use')).toBeVisible()
  await expect(page.getByText(/Cuando se registre y haga 20 entregas en 2 días distintos/)).toBeVisible()
  await expect(page.getByText('Invitados: 2 · ya la usan: 1 · ganado: 10 €')).toBeVisible()
  await page.getByRole('button', { name: 'Invitar a un compañero' }).click()
  await expect.poll(async () => (await page.evaluate(() => window.__abierto)).length).toBe(1)
  const abierto = (await page.evaluate(() => window.__abierto))[0]
  expect(abierto).toMatch(/^https:\/\/wa\.me\/\?text=/)
  const texto = decodeURIComponent(abierto.split('text=')[1])
  expect(texto).toContain('/invita?ref=ABC123&utm_source=referido&utm_medium=compartir&utm_campaign=rep_invitar')
  expect(texto).toContain('gratis y sin límite hasta el 31 de diciembre')
  expect(texto).toContain('Y tú ganas 10 € con tu primera ruta real (20 entregas en 2 días).')
  expect(texto).toContain('gano 10 €')
})

test('Activación · quien llega con el enlace de un compañero ve «14 días» y su código viaja con el alta', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
  })
  await page.route(/\/api\/referidos\/ABC123/, (r) => r.fulfill({ json: { valido: true, dias_extra: 7 } }))
  await page.route(/\/api\/referidos\/MALO99/, (r) => r.fulfill({ json: { valido: false, dias_extra: 7 } }))
  let cuerpo = null
  await page.route(/\/api\/auth\/register/, async (r) => { cuerpo = r.request().postDataJSON(); await r.fulfill({ status: 400, json: { detail: 'prueba' } }) })
  await page.goto('/repartidores?v=a&ref=ABC123&utm_source=referido', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Te ha invitado un compañero · gratis y sin límite hasta el 31 de diciembre').first()).toBeVisible()
  // El alta se hace en la propia portada: el código del amigo viaja con ella.
  await page.getByPlaceholder('Tu nombre').fill('Rosa')
  await page.getByPlaceholder('Tu correo').fill('rosa@example.es')
  await page.getByPlaceholder('Contraseña').fill('12345678')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Crear mi cuenta gratis/ }).click()
  await expect.poll(() => cuerpo).not.toBeNull()
  expect(cuerpo.ref).toBe('ABC123')
  expect(cuerpo.sector).toBe('autonomo')
})

test('Activación · un código que no vale NO promete días de más', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() })))
  await page.route(/\/api\/referidos\/MALO99/, (r) => r.fulfill({ json: { valido: false, dias_extra: 7 } }))
  await page.goto('/repartidores?v=a&ref=MALO99', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Gratis y sin límite hasta el 31 de diciembre · sin tarjeta').first()).toBeVisible()
  await expect(page.getByText(/Te ha invitado un compañero/)).toHaveCount(0)
})

test('Activación · quien ya la usa ve «¿Qué tal te va?» al terminar la ruta, una vez, y su opinión se envía', async ({ page, context }) => {
  await preparar(page, context)
  let enviado = null
  await page.route(/\/api\/opinion\/estado/, (r) => r.fulfill({ json: { pedir: true } }))
  await page.route(/\/api\/opinion$/, async (r) => { enviado = r.request().postDataJSON(); await r.fulfill({ json: { ok: true } }) })
  // 25-10-2026: se pregunta al TERMINAR la ruta (debajo del resumen), no al abrir «Hoy» para cargar.
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null,
    pedidos: [{ id: 'h1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'entregado', bultos: 1, orden: 1 }] } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('¿Qué tal te va la app?')).toBeVisible()
  await page.getByRole('button', { name: '4', exact: true }).click()
  await page.getByPlaceholder('Escribe aquí qué te falta o qué mejorarías').fill('Me falta importar un Excel')
  await page.getByRole('button', { name: 'Enviar mi opinión' }).click()
  await expect(page.getByText('¡Gracias! Lo leo yo personalmente.')).toBeVisible()
  expect(enviado).toEqual({ valor: 4, texto: 'Me falta importar un Excel' })
})

test('Activación · el idioma se cambia también desde Ajustes', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos: [] } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Ajustes' }).click({ force: true })
  await page.getByLabel('Idioma').selectOption('pt')
  await expect(page.locator('nav button', { hasText: /Conta/ })).toBeVisible()
})

test('Instalar · /instalar no da 404: lleva a la app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() })))
  await page.goto('/instalar', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/(ruta|empezar)/)
  await expect(page.getByText('Página no encontrada')).toHaveCount(0)
})

/* INSTALAR LA APP (05-10-2026): tras registrarse, la tarjeta «Instala FDS en tu móvil» funciona en Android
   (aviso de Chrome) y explica los pasos en iPhone, avisando de que la de App Store llegará próximamente. */
const SIN_PAQUETES = { activo: true, autonomo: true, empresa: '', fecha: '2026-10-05', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos: [] }

test.describe('Instalar · Android', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' })
  test('con el aviso de Chrome, «Instalar la app» lanza la instalación', async ({ page, context }) => {
    await preparar(page, context)
    await page.addInitScript(() => localStorage.removeItem('fds_instalar_cerrado'))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: SIN_PAQUETES }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Instala FDS en tu móvil')).toBeVisible()
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt')
      e.prompt = () => { window.__lanzado = true }
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })
    await page.getByRole('button', { name: 'Instalar la app' }).click()
    await expect.poll(() => page.evaluate(() => window.__lanzado)).toBe(true)
    await expect(page.getByText('Instala FDS en tu móvil')).toHaveCount(0)
  })
})

test.describe('Instalar · iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' })
  test('explica los pasos de Safari, avisa de entrar una vez y de que no se descarga de la App Store', async ({ page, context }) => {
    await preparar(page, context)
    await page.addInitScript(() => localStorage.removeItem('fds_instalar_cerrado'))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: SIN_PAQUETES }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Cómo instalarla' }).click()
    await expect(page.getByText('Abre esta página en Safari.')).toBeVisible()
    await expect(page.getByText('Elige «Añadir a pantalla de inicio».')).toBeVisible()
    await expect(page.getByText('En iPhone no se descarga de la App Store: se instala así, desde Safari, y funciona como una app.')).toBeVisible()
    await expect(page.getByText('entra una vez con tu correo y tu contraseña')).toBeVisible()
  })
})

test('Instalar · la portada dice que sirve en Android e iPhone y que en iPhone se añade desde Safari', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() })))
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  await page.getByText('¿Tengo que instalar algo?').click()
  await expect(page.getByText(/Android o iPhone/)).toBeVisible()
  await expect(page.getByText(/En iPhone no se descarga de la App Store: se añade desde Safari/)).toBeVisible()
})

test('Portada · el alta se hace dentro de la propia portada y lleva a la app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 2, anuncios: false, at: new Date().toISOString() })))
  let cuerpo = null
  await page.route(/\/api\/auth\/register/, async (r) => {
    cuerpo = r.request().postDataJSON()
    await r.fulfill({ json: { access_token: 'tok', token_type: 'bearer', user: { role: 'admin', username: cuerpo.username }, org: { id: 'o1' } } })
  })
  await page.route(/\/api\/(org|reparto|auth\/me)/, (r) => r.fulfill({ status: 401, json: { detail: 'x' } }))
  await page.goto('/repartidores?v=a&ref=ABC123&utm_source=tiktok', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Tu nombre').fill('Rosa')
  await page.getByPlaceholder('Tu correo').fill('Rosa@Example.es')
  await page.getByPlaceholder('Contraseña').fill('12345678')
  // Sin aceptar los términos no se envía.
  await page.getByRole('button', { name: /Crear mi cuenta gratis/ }).click()
  await expect(page.getByText('Debes aceptar los Términos')).toBeVisible()
  expect(cuerpo).toBeNull()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Crear mi cuenta gratis/ }).click()
  await expect.poll(() => cuerpo).not.toBeNull()
  expect(cuerpo).toMatchObject({ org_name: 'Rosa', username: 'rosa@example.es', email: 'rosa@example.es', sector: 'autonomo', plan: 'autonomo' })
})

test('Portada · si el correo ya existe lo dice y no se pierde lo escrito', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', JSON.stringify({ v: 2, anuncios: false, at: new Date().toISOString() })))
  await page.route(/\/api\/auth\/register/, (r) => r.fulfill({ status: 400, json: { detail: 'Ese correo ya tiene cuenta' } }))
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Tu nombre').fill('Rosa')
  await page.getByPlaceholder('Tu correo').fill('rosa@example.es')
  await page.getByPlaceholder('Contraseña').fill('12345678')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Crear mi cuenta gratis/ }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByPlaceholder('Tu nombre')).toHaveValue('Rosa')
})
