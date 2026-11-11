import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 2 (11-11-2026), zona del cuadrante: el móvil y la interfaz del Cuadrante y de Días libres.
   · C1 (cuadrante-9): un buscador en la rejilla y en «Personas y notas» (las filas de totales siguen contando a todos).
   · C2 (cuadrante-10): en el móvil, las pestañas de Días libres caben y la columna de nombres se estrecha.
   · C3 (cuadrante-3): con «Todos», Peticiones y Calendario funcionan, con el centro de cada uno; lo demás pide centro.
   · C4 (historia-8): los códigos de la hoja que la app no conoce se enseñan desde el cuadro de Google Sheets.
   · C5 (portal_inicio-9): un botón por centro en vez de «Elige un centro arriba».
   · C6 (fotos): el título dice «Días libres» y el mes, «Noviembre de 2026».
   Nada depende de la fecha de hoy: los días se calculan desde el lunes de esta semana. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lunes = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })()
const dia = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d) }

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

const persona = (id, nombre, extra = {}) => ({ id, nombre, tipo: 'normal', ficha_activa: true, apodos: [], nota: '', reglas: {},
  entendido: [], sin_entender: '', reglas_fijas: [], ...extra })

function cuadrante() {
  const personas = [
    persona('p1', 'ANTONIO GARCÍA LÓPEZ'),
    persona('p2', 'JOSÉ MANUEL PÉREZ CASTRO', { tipo: 'empresa' }),
    persona('p3', 'SARA OTERO MOSQUERA', { tipo: 'finde', apodos: ['sari'] }),
    persona('p4', 'JOSÉ MARÍA RIVAS COUTO', { inactivo_desde: dia(10) }),
    persona('p5', 'LAURA SÁNCHEZ GIL', { nota: 'solo mañanas' }),
  ]
  const celdas = {}
  for (const p of personas) for (let i = 0; i < 14; i++) celdas[`${p.id}|${dia(i)}`] = { cod: i % 7 < 5 ? '1' : 'N/T', extra: false, fijada: false }
  return {
    center: 'NORTE', desde: dia(0), hasta: dia(13), hoy: dia(1), personas, celdas,
    maximas: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [dia(i), 3])), objetivos: {},
    config: { colchon: 2, permitir_extra: true }, ajustes: [], aprobados: [], propuesta: null, ultimo_cambio: null,
    tipos: ['normal', 'empresa', 'finde', 'inactivo'],
  }
}

const PETICIONES = [
  { id: 'r1', grupo: 'g1', center: 'NORTE', driver_id: 'd1', driver_name: 'ANA PÉREZ', date: dia(9), type: 'libre',
    status: 'pendiente', motivo: 'asuntos', motivo_label: 'Asuntos propios', note: 'Boda de mi hermano', created_at: '2026-11-01T10:00:00Z' },
  { id: 'r2', grupo: 'g2', center: 'SUR', driver_id: 'd2', driver_name: 'LUIS GÓMEZ', date: dia(10), type: 'libre',
    status: 'pendiente', motivo: 'medico', motivo_label: 'Médico', note: 'Cita a las 10', created_at: '2026-11-02T10:00:00Z' },
]

async function enTodos(page) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  // Después del de entrarComoAdmin (que deja el primer centro): arriba, «Todos».
  await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
}

// ── C1 · buscador ────────────────────────────────────────────────────────────────────────────────────────────────

test('C1: el buscador del Cuadrante filtra por nombre o apodo y los totales siguen contando a todos', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante()))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  const filas = page.locator('tbody tr')
  const rutasLunes = page.locator('tbody tr').filter({ hasText: 'Rutas (cuenta de 1)' }).locator('td').nth(1)
  await expect(rutasLunes).toHaveText('5')

  const busca = page.getByLabel('Buscar persona')
  // Por apodo, sin mayúsculas.
  await busca.fill('SARI')
  await expect(page.getByRole('button', { name: /SARA OTERO MOSQUERA/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /ANTONIO GARCÍA LÓPEZ/ })).toHaveCount(0)
  await expect(page.getByTestId('busca-cuenta')).toContainText('1 de 5')
  // Las filas de totales siguen ahí y cuentan a los cinco.
  await expect(rutasLunes).toHaveText('5')
  // Sin acentos y por palabras: «jose cas» es JOSÉ MANUEL PÉREZ CASTRO, no JOSÉ MARÍA RIVAS COUTO.
  await busca.fill('jose cas')
  await expect(page.getByRole('button', { name: /JOSÉ MANUEL PÉREZ CASTRO/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /JOSÉ MARÍA RIVAS COUTO/ })).toHaveCount(0)
  // Nadie: se dice, y la tabla de totales sigue.
  await busca.fill('zzz')
  await expect(page.getByText('Nadie en este cuadrante se llama «zzz».')).toBeVisible()
  await expect(filas.filter({ hasText: 'Diferencia (objetivo +2)' })).toHaveCount(1)

  // En «Personas y notas», el mismo buscador (lo escrito se queda).
  await busca.fill('laura')
  await page.getByRole('button', { name: 'Personas y notas' }).click()
  await expect(page.getByRole('heading', { name: '5 personas en el cuadrante' })).toBeVisible()
  const tabla = page.locator('section').filter({ hasText: 'personas en el cuadrante' })
  await expect(tabla.getByRole('cell', { name: 'LAURA SÁNCHEZ GIL' })).toBeVisible()
  await expect(tabla.getByRole('cell', { name: 'ANTONIO GARCÍA LÓPEZ' })).toHaveCount(0)
  await tabla.getByRole('button', { name: 'Ver a todos' }).click()
  await expect(tabla.getByRole('cell', { name: 'ANTONIO GARCÍA LÓPEZ' })).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── C2 · el móvil ────────────────────────────────────────────────────────────────────────────────────────────────

test('C2: en el móvil la columna de nombres se estrecha, caben bastantes días y el nombre completo sale al tocarlo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  // El nombre corto («ANTONIO G.»); dos «JOSÉ M.» se distinguen con el segundo nombre entero.
  await expect(page.getByText('ANTONIO G.', { exact: true })).toBeVisible()
  await expect(page.getByText('JOSÉ MANUEL', { exact: true })).toBeVisible()
  await expect(page.getByText('JOSÉ MARÍA', { exact: true })).toBeVisible()
  // «SE VA» se sigue viendo (en su segunda línea, sin ensanchar la columna).
  await expect(page.getByText(/^SE VA /)).toBeVisible()
  // Días que se ven enteros sin deslizar: antes, dos y medio.
  const cabeceras = page.locator('thead th')
  const n = await cabeceras.count()
  let enPantalla = 0
  for (let i = 1; i < n - 2; i++) {
    const b = await cabeceras.nth(i).boundingBox()
    if (b && b.x + b.width <= 390) enPantalla += 1
  }
  expect(enPantalla).toBeGreaterThanOrEqual(6)
  // La página no se desliza de lado: la fila de fechas cabe y la flecha «Semana siguiente» se ve entera (revisión T1/T8).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const siguiente = await page.getByRole('button', { name: 'Semana siguiente' }).boundingBox()
  expect(siguiente.x).toBeGreaterThanOrEqual(0)
  expect(siguiente.x + siguiente.width).toBeLessThanOrEqual(390)
  // Al tocar el nombre se abre su ficha, con el nombre entero.
  await page.getByText('ANTONIO G.', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ANTONIO GARCÍA LÓPEZ' })).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('C2: en el ordenador la columna de nombres sigue como siempre', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante()))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('ANTONIO GARCÍA LÓPEZ', { exact: true })).toBeVisible()
  await expect(page.getByText('ANTONIO G.', { exact: true })).toBeHidden()
  const b = await page.locator('thead th').first().boundingBox()
  expect(b.width).toBeGreaterThanOrEqual(208)        // los 13rem de siempre
  // Un nombre largo se corta con «…» en una sola línea, como siempre (no salta a dos).
  const largo = await page.getByRole('button', { name: /JOSÉ MANUEL PÉREZ CASTRO/ }).boundingBox()
  expect(largo.height).toBeLessThan(26)
})

test('C2 (revisión T7): en el móvil dos nombres cortos nunca salen iguales, y las partículas no dan la inicial', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const c = cuadrante()
  c.personas = [
    persona('p1', 'JOSÉ GARCÍA PÉREZ'), persona('p2', 'JOSÉ GARCÍA LÓPEZ'),
    persona('p3', 'MARÍA DE LOS ÁNGELES RUIZ'), persona('p4', 'MARÍA DE LA O SANZ'),
    persona('p5', 'JOSÉ MANUEL PÉREZ CASTRO'), persona('p6', 'JOSÉ MARÍA RIVAS COUTO'), persona('p7', 'LAURA SÁNCHEZ GIL'),
  ]
  c.celdas = {}
  await page.route(/\/api\/cuadrante\?/, json(c))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  // Lo que se VE en la columna de nombres (el corto), fila a fila.
  const vistos = await page.locator('tbody td:first-child button span.sm\\:hidden').allInnerTexts()
  expect(vistos).toHaveLength(7)
  expect(new Set(vistos).size, vistos.join(' | ')).toBe(7)
  expect(vistos).toEqual(expect.arrayContaining(['JOSÉ G. P.', 'JOSÉ G. L.', 'MARÍA Á.', 'MARÍA O.', 'JOSÉ MANUEL',
    'JOSÉ MARÍA', 'LAURA S.']))
  // Y caben sin cortarse con «…» (si se cortara la inicial del final, volverían a verse iguales).
  const cortados = await page.locator('tbody td:first-child button span.sm\\:hidden').evaluateAll((els) =>
    els.filter((e) => e.parentElement.scrollWidth > e.parentElement.clientWidth + 1).map((e) => e.textContent))
  expect(cortados).toEqual([])
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('C2: en el móvil las pestañas de Días libres caben y se tocan con el dedo; en el ordenador, en una fila', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: PETICIONES.slice(0, 1) }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Boda de mi hermano')).toBeVisible({ timeout: 15000 })
  const barra = page.getByTestId('pestanas-dias')
  const b = await barra.boundingBox()
  expect(b.x + b.width).toBeLessThanOrEqual(390)
  for (const nombre of ['Peticiones · 1', 'Refuerzos', 'Suspensiones', 'Calendario', 'Días cerrados']) {
    const p = await barra.getByRole('button', { name: nombre, exact: true }).boundingBox()
    // 44 px; con medio píxel de margen: la animación de entrada de la página deja a veces 43,999.
    expect(p.height, nombre).toBeGreaterThanOrEqual(43.5)
    expect(p.x + p.width, nombre).toBeLessThanOrEqual(390)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.setViewportSize({ width: 1440, height: 900 })
  const ys = new Set()
  for (const k of await barra.getByRole('button').all()) ys.add(Math.round((await k.boundingBox()).y))
  expect(ys.size).toBe(1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── C3 · con «Todos» ─────────────────────────────────────────────────────────────────────────────────────────────

test('C3: con «Todos», Peticiones enseña las de todos los centros con su centro, y se pueden contestar', async ({ page }) => {
  const fallos = vigilar(page)
  await enTodos(page)
  await simularApi(page, 'vacio')
  const pedidas = []
  await page.route(/\/api\/shift-requests(\?|$)/, (route) => {
    pedidas.push(new URL(route.request().url()).searchParams)
    return json({ requests: PETICIONES })(route)
  })
  let resuelto = null
  await page.route(/\/api\/shift-requests\/resolver-grupo/, (route) => {
    resuelto = route.request().postDataJSON()
    return json({ resueltas: ['r2'], canceladas: [], saltadas: [] })(route)
  })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Boda de mi hermano')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Cita a las 10')).toBeVisible()
  expect(pedidas.some((p) => p.get('status') === 'pendiente' && !p.has('center'))).toBe(true)
  const centros = page.getByTestId('centro-peticion')
  await expect(centros).toHaveText(['NORTE', 'SUR'])
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Días libres')
  // Contestar funciona igual que con un centro elegido.
  await page.locator('.divide-y > div').filter({ hasText: 'LUIS GÓMEZ' }).getByRole('button', { name: 'Aprobar' }).click()
  await expect.poll(() => resuelto).toMatchObject({ ids: ['r2'], action: 'aprobar' })
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('C3: con «Todos», el Calendario funciona con el centro de cada uno, y Refuerzos pide el centro con un botón', async ({ page }) => {
  const fallos = vigilar(page)
  await enTodos(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: PETICIONES }))
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Boda de mi hermano')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  await expect(page.getByText('Quién ha pedido días')).toBeVisible()
  const ana = page.getByRole('button', { name: /ANA PÉREZ/ })
  await expect(ana).toContainText('NORTE')
  await expect(page.getByRole('button', { name: /LUIS GÓMEZ/ })).toContainText('SUR')

  for (const pestana of ['Refuerzos', 'Suspensiones', 'Días cerrados']) {
    await page.getByRole('button', { name: pestana, exact: true }).click()
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('van por centro')
    await expect(elegir.getByRole('button', { name: 'NORTE' })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Refuerzos', exact: true }).click()
  await page.getByTestId('elegir-centro').getByRole('button', { name: 'SUR' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Días libres · SUR')
  await expect(page.getByRole('heading', { name: 'Pedir refuerzos' })).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// Hoy (el calendario abre en el mes de hoy): las casillas de días que existen son botones, en orden, del 1 al último.
const hoyIso = () => iso(new Date())
const casillaDeHoy = (page) => page.locator('div.grid.grid-cols-7 > button').nth(new Date().getDate() - 1)
// Cuánto se pasa del borde derecho de la casilla lo que lleva dentro (0 = nada se sale).
const sobraDe = (casilla) => casilla.evaluate((el) => {
  const borde = el.getBoundingClientRect().right
  return Math.max(0, ...[...el.querySelectorAll('span, i')].map((s) => s.getBoundingClientRect().right - borde))
})

test('C3 (revisión T11): con «Todos», un día cerrado de un centro no pinta la casilla de rojo para todos y se dicen todos los que cierran', async ({ page }) => {
  const fallos = vigilar(page)
  await enTodos(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: [] }))
  await page.route(/\/api\/shift-blocks(\?|$)/, json({ bloqueos: [
    { id: 'b1', center: 'SUR', desde: hoyIso(), hasta: hoyIso(), motivo: 'Inventario' },
    { id: 'b2', center: 'NORTE', desde: hoyIso(), hasta: hoyIso(), motivo: 'Fiesta local' },
  ], pasados: [] }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Días libres', { timeout: 15000 })
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  const casilla = casillaDeHoy(page)
  // En el ordenador, la casilla dice qué centros cierran.
  await expect(casilla.getByText('SUR · NORTE', { exact: true })).toBeVisible()
  // La casilla no lleva el rojo entero de «cerrado» (eso diría que cierran todos los centros).
  await expect(casilla).not.toHaveClass(/border-red-500/)
  await casilla.click()
  await expect(page.getByText('Día cerrado en SUR: Inventario')).toBeVisible()
  await expect(page.getByText('Día cerrado en NORTE: Fiesta local')).toBeVisible()
  // En el móvil, solo el punto rojo (el código no cabe): nada se sale de la casilla, y el código queda para el lector.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(casilla.getByTestId('cierre-centros')).toHaveText('SUR · NORTE')
  expect(await casilla.getByText('SUR · NORTE', { exact: true }).evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(1)
  expect(await sobraDe(casilla)).toBeLessThanOrEqual(0.5)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('C3 (revisión T12/T14): en el móvil «sin contestar» no se sale de la casilla del Calendario; en el ordenador, como siempre', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: [
    { id: 'r9', grupo: 'g9', center: 'NORTE', driver_id: 'd9', driver_name: 'ANA PÉREZ', date: hoyIso(), type: 'libre',
      status: 'pendiente', motivo: 'asuntos', motivo_label: 'Asuntos propios', note: 'Boda de mi hermano', created_at: '2026-11-01T10:00:00Z' },
  ] }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Boda de mi hermano')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  await expect(page.getByText('Quién ha pedido días')).toBeVisible()
  const casilla = casillaDeHoy(page)
  // En el móvil, el número y el punto ámbar; la frase entera no se pinta (queda para el lector de pantalla).
  await expect(casilla.getByText('1 sin contestar', { exact: true })).toBeHidden()
  await expect(casilla.locator('span.inline-flex').filter({ hasText: /^1/ })).toBeVisible()
  // Nada de lo que hay dentro pasa del borde derecho de la casilla.
  expect(await sobraDe(casilla)).toBeLessThanOrEqual(0.5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(casilla.getByText('1 sin contestar', { exact: true })).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── C3 · el service worker reaprovecha la pestaña abierta (revisión T9/T10/T13) ─────────────────────────────────────

function cargarSw(pestanas) {
  const codigo = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8')
  const oyentes = {}
  const abiertas = []
  const self = {
    location: { origin: 'https://panel.ejemplo.test' },
    addEventListener: (tipo, f) => { oyentes[tipo] = f },
    registration: { showNotification: async () => {} },
    clients: { matchAll: async () => pestanas, openWindow: async (u) => { abiertas.push(u); return null }, claim: async () => {} },
    skipWaiting: () => {},
  }
  vm.runInNewContext(codigo, { self, URL, caches: {}, fetch: () => Promise.reject(new Error('sin red')), Response: class {}, setTimeout, console })
  const tocar = async (url) => {
    let espera = null
    oyentes.notificationclick({ notification: { close: () => {}, data: { url } }, waitUntil: (p) => { espera = p } })
    await espera
  }
  return { tocar, abiertas }
}
const pestana = (url) => {
  const p = { url, enfocada: 0, idaA: null }
  p.focus = async () => { p.enfocada += 1; return p }
  p.navigate = async (u) => { p.idaA = u; p.url = u; return p }
  return p
}

test('C3 (revisión T9/T10/T13): tocar un aviso con ?centro= usa la pestaña de Días libres abierta, sin abrir otra', async () => {
  // Abierta en Días libres (el panel ya quitó `centro` de la dirección): se trae al frente y va a la del aviso.
  const dias = pestana('https://panel.ejemplo.test/panel/turnos')
  let sw = cargarSw([pestana('https://panel.ejemplo.test/panel/cuadrante'), dias])
  await sw.tocar('/panel/turnos?centro=OGA5')
  expect(sw.abiertas).toEqual([])
  expect(dias.enfocada).toBe(1)
  expect(dias.idaA).toBe('https://panel.ejemplo.test/panel/turnos?centro=OGA5')
  // Lo mismo con la pestaña en Refuerzos y el aviso de un refuerzo.
  const refuerzos = pestana('https://panel.ejemplo.test/panel/turnos?vista=refuerzos')
  sw = cargarSw([refuerzos])
  await sw.tocar('/panel/turnos?vista=refuerzos&centro=DGA1')
  expect(sw.abiertas).toEqual([])
  expect(refuerzos.idaA).toBe('https://panel.ejemplo.test/panel/turnos?vista=refuerzos&centro=DGA1')
  // Como siempre: si ya hay una pestaña con esa dirección, solo se enfoca (no se recarga).
  const panel = pestana('https://panel.ejemplo.test/panel')
  sw = cargarSw([panel])
  await sw.tocar('/panel')
  expect([panel.enfocada, panel.idaA, sw.abiertas]).toEqual([1, null, []])
  // Y si no hay ninguna en esa pantalla, se abre una, como siempre.
  const otra = pestana('https://panel.ejemplo.test/panel/asignacion')
  sw = cargarSw([otra])
  await sw.tocar('/panel/turnos?centro=OGA5')
  expect(sw.abiertas).toEqual(['/panel/turnos?centro=OGA5'])
  expect([otra.enfocada, otra.idaA]).toEqual([0, null])
})

// ── C5 · un botón por centro en el Cuadrante ─────────────────────────────────────────────────────────────────────

test('C5: con «Todos», el Cuadrante pide el centro con un botón por centro, y al pulsarlo lo carga', async ({ page }) => {
  const fallos = vigilar(page)
  await enTodos(page)
  await simularApi(page, 'vacio')
  const pedidos = []
  await page.route(/\/api\/cuadrante\?/, (route) => {
    pedidos.push(new URL(route.request().url()).searchParams.get('center'))
    return json(cuadrante())(route)
  })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  const elegir = page.getByTestId('elegir-centro')
  await expect(elegir).toContainText('El cuadrante va por centro', { timeout: 15000 })
  await elegir.getByRole('button', { name: 'NORTE' }).click()
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible()
  expect(pedidos).toContain('NORTE')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── C4 · los códigos raros de la hoja ────────────────────────────────────────────────────────────────────────────

test('C4: los códigos que la app no conoce se enseñan desde el cuadro de Google Sheets, sin «Ignorar»', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  let guardado = null
  await page.route(/\/api\/cuadrante\?/, json(cuadrante()))
  await page.route(/\/api\/cuadrante\/sync\?/, json({
    conectado: true, modo: 'activo', hoja_nombre: 'Cuadrante NORTE', ultimo_contacto: '2026-11-10T08:00:00Z',
    ultima: { en: '2026-11-10T08:00:00Z', modo: 'activo', mensaje: 'Sin cambios.', pestanas: [], saltadas: [], ambiguos: [],
      codigos_desconocidos: { 'B/V': 2, 'XX': 1 }, cambios: [] },
  }))
  await page.route(/\/api\/shifts\/codigos$/, (route) => {
    if (route.request().method() === 'PUT') {
      guardado = route.request().postDataJSON()
      return json({ codigos: guardado.codigos })(route)
    }
    return json({ codigos: { '1': 'trabaja', 'N/T': 'libre' }, mapa: {}, info: {} })(route)
  })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Google Sheets/ }).click()
  const caja = page.getByTestId('codigos-desconocidos')
  await expect(caja).toContainText('B/V')
  await expect(caja.getByRole('button', { name: 'Ignorar' })).toHaveCount(0)
  await expect(caja.getByRole('button', { name: 'Trabaja' })).toHaveCount(2)
  const bv = caja.locator('div').filter({ has: page.locator('code', { hasText: 'B/V' }) }).last()
  await bv.getByRole('button', { name: 'Libre' }).click()
  // La tabla entera, con lo que había más el nuevo (como al importar el Excel).
  await expect.poll(() => guardado).toEqual({ codigos: { '1': 'trabaja', 'N/T': 'libre', 'B/V': 'libre' } })
  await expect(caja).toContainText('Libre: entra en la próxima sincronización.')
  // El otro sigue esperando.
  await expect(caja.getByRole('button', { name: 'Trabaja' })).toHaveCount(1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── C6 · los textos de las fotos ─────────────────────────────────────────────────────────────────────────────────

test('C6: la pantalla se llama «Días libres» y el mes dice «de» en minúscula', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: [] }))
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Días libres · NORTE', { timeout: 15000 })
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  // Lo que se VE (innerText, con el estilo aplicado): «Noviembre de 2026», nunca «Noviembre De 2026».
  const mes = page.locator('h3').filter({ hasText: /\d{4}$/ }).first()
  await expect(mes).toHaveText(/^\p{Lu}\p{Ll}+ de \d{4}$/u, { useInnerText: true })
  // Y en el selector de Días cerrados.
  await page.getByRole('button', { name: 'Días cerrados', exact: true }).click()
  const mes2 = page.locator('span').filter({ hasText: /^\p{L}+ de \d{4}$/u }).first()
  await expect(mes2).toHaveText(/^\p{Lu}\p{Ll}+ de \d{4}$/u, { useInnerText: true })
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})
