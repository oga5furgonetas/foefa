import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* Tanda 2, zona «inicio» (11-11-2026): el menú del móvil, el Inicio con «Todos», elegir el centro ahí mismo, el
   `?centro=` de la dirección, el Portal del conductor y Conversaciones. API simulada; cada caso pone encima las rutas
   que necesita. Nada depende del reloj: las fechas que se comparan las da la propia respuesta simulada. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const MOVIL = { width: 390, height: 844 }
const CENTROS = ['OGA5', 'DGA1']

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/** Entra con dos centros y con `centro` elegido arriba (por defecto «Todos»). Va después de entrarComoAdmin, que
 *  deja elegido el primero. */
async function entrar(page, { centro = 'Todos', superAdmin = false, escenario = 'lleno' } = {}) {
  await entrarComoAdmin(page, { centros: CENTROS, superAdmin })
  await page.addInitScript((c) => {
    if (!sessionStorage.getItem('t2i_centro')) { localStorage.setItem('panel_center', c); sessionStorage.setItem('t2i_centro', '1') }
  }, centro)
  await simularApi(page, escenario)
}

const centroGuardado = (page) => page.evaluate(() => localStorage.getItem('panel_center'))
const barraAbajo = (page) => page.locator('nav.fixed.bottom-0')

/* Lo de /stats/hoy con «Todos»: una salida de OGA5 sin revisar (con el centro escrito largo, como llega a veces) y una
   de DGA1 revisada; el checklist de mañana solo tiene algo pendiente en DGA1. */
const STATS_HOY = {
  dia: '2026-11-11',
  salidas: { total: 2, revisadas: 1, lista: [
    { vehicle_id: 'v1', matricula: '3333 CCC', conductor: 'ANA PÉREZ', ruta: 'CX1', center: 'AMZL OGA5 SANTIAGO', revisada: false, gravedad: null },
    { vehicle_id: 'v2', matricula: '4444 DDD', conductor: 'LUIS GIL', ruta: 'CX2', center: 'DGA1', revisada: true, gravedad: null },
  ] },
  revision: { hechas: 3, flota: 10 },
  checklist: [{ turno: 'manana', hechas: 4, total: 6 }],
  golpes: { n: 0, lista: [] },
  incidencias: { nuevas: 0, graves: 0 },
  por_centro: [
    { centro: 'OGA5', salidas: 1, revisadas: 0, golpes: 0, checklist: [{ turno: 'manana', hechas: 3, total: 3 }] },
    { centro: 'DGA1', salidas: 1, revisadas: 1, golpes: 0, checklist: [{ turno: 'manana', hechas: 1, total: 3 }] },
  ],
}
const CENTROS_HOY = {
  dia: '2026-11-11', semana: '2026-11-08', centros: [
    { centro: 'OGA5', plantilla: { por: 'María', a: '2026-11-11T06:40:00Z' }, horas: { semana: '2026-11-08', al_dia: true },
      dnr_ultimo: '2026-11-09', cuadrante_hasta: '2026-12-17', maximas_hasta: '2026-11-30' },
    { centro: 'DGA1', plantilla: null, horas: { semana: '2026-11-01', al_dia: false },
      dnr_ultimo: null, cuadrante_hasta: '2026-11-05', maximas_hasta: null },
  ],
}

/* En el móvil (menos de 640 px) los datos de cada centro van plegados en una línea con su resumen: se abren tocándola.
   En el ordenador ya están a la vista y no hay nada que abrir. */
async function abrirCentro(fila) {
  const vp = fila.page().viewportSize()
  if (!vp || vp.width >= 640) return
  const boton = fila.locator('button[aria-expanded]')
  await expect(boton).toBeVisible({ timeout: 30000 })
  if ((await boton.getAttribute('aria-expanded')) === 'false') await boton.click()
}

// `rutas(page)`: más rutas simuladas, puestas DESPUÉS de simularApi (Playwright mira primero la última que se puso).
async function inicioConTodos(page, { rutas, centrosHoy = CENTROS_HOY, ...extra } = {}) {
  await entrar(page, extra)
  if (rutas) await rutas(page)
  await page.route(/\/api\/stats\/hoy/, json(STATS_HOY))
  await page.route(/\/api\/stats\/centros-hoy/, json(centrosHoy))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Salidas de hoy')).toBeVisible({ timeout: 30000 })
}

/* ── I1 · el número rojo de lo pendiente, también en «Menú» ─────────────────────────────────────────────────── */
test.describe('I1 · lo pendiente en el botón Menú del móvil', () => {
  test('suma días sin contestar, candidatos y WhatsApp (no el chat interno) en la barra de abajo y en la cabecera', async ({ page }) => {
    const fallos = vigilar(page)
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.route(/\/api\/shift-requests\/pendientes/, json({ pendientes: 3 }))
    await page.route(/\/api\/empleo\/candidatos\/nuevos/, json({ nuevos: 2 }))
    await page.route(/\/api\/whatsapp\/conversaciones\/no-leidas/, json({ no_leidas: 1 }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const abajo = barraAbajo(page).getByRole('button', { name: 'Menú · 6' })
    await expect(abajo).toBeVisible({ timeout: 30000 })
    await expect(abajo).toContainText('6')
    await expect(page.locator('header').getByRole('button', { name: 'Menú · 6' })).toContainText('6')
    // Al abrir la hoja se ve de qué línea es cada número.
    await abajo.click()
    await expect(page.getByRole('dialog').getByRole('link', { name: /Días libres\s*3/ })).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('sin nada pendiente, el botón se llama «Menú» y no lleva número', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const abajo = barraAbajo(page).getByRole('button', { name: 'Menú', exact: true })
    await expect(abajo).toBeVisible({ timeout: 30000 })
    await expect(abajo).not.toContainText(/\d/)
  })
})

/* ── I2 · Gastos y Bandeja también en el menú del móvil ──────────────────────────────────────────────────────── */
test('I2 · el menú del móvil tiene las mismas entradas del dueño que el lateral (Gastos y Bandeja incluidas)', async ({ page }) => {
  const fallos = vigilar(page)
  await page.setViewportSize(MOVIL)
  await entrar(page, { centro: 'OGA5', superAdmin: true, escenario: 'vacio' })
  await page.goto('/panel/perfil', { waitUntil: 'domcontentloaded' })
  await barraAbajo(page).getByRole('button', { name: /^Menú/ }).click()
  const hoja = page.getByRole('dialog')
  for (const n of ['Negocio (super-admin)', 'Usuarios', 'Cómo va el negocio', 'Gastos', 'Bandeja']) {
    await expect(hoja.getByRole('link', { name: n, exact: true })).toBeVisible()
  }
  await hoja.getByRole('link', { name: 'Gastos', exact: true }).click()
  await expect(page).toHaveURL(/\/panel\/gastos/)
  expect(fallos).toEqual([])
})

/* ── I3 · la barra de abajo, solo con lo que esa persona puede abrir ─────────────────────────────────────────── */
test('I3 · sin permiso de Inicio, Revisión ni Vehículos, la barra de abajo no los enseña y se rellena con lo que sí puede abrir', async ({ page }) => {
  const fallos = vigilar(page)
  await page.setViewportSize(MOVIL)
  await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
  await page.route(/\/api\/auth\/me$/, json({ id: 'a1', name: 'Admin Test', role: 'admin', permissions: ['plantilla', 'diarios'], allowed_centers: null }))
  await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
  const barra = barraAbajo(page)
  // Cuando llegan los permisos de /auth/me, la barra se rehace.
  await expect(barra.getByRole('link', { name: 'Vehículos' })).toHaveCount(0, { timeout: 30000 })
  await expect(barra.getByRole('link', { name: 'Revisión rápida' })).toHaveCount(0)
  await expect(barra.getByRole('link', { name: 'Inicio' })).toHaveCount(0)
  await expect(barra.getByRole('link', { name: 'Asignación diaria' })).toBeVisible()
  await expect(barra.getByRole('link', { name: 'Plantilla del día' })).toBeVisible()
  await expect(barra.getByRole('link')).toHaveCount(4)
  expect(fallos).toEqual([])
})

test('I3 · con todos los permisos, la barra de abajo es la de siempre', async ({ page }) => {
  await page.setViewportSize(MOVIL)
  await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const barra = barraAbajo(page)
  await expect(barra.getByRole('link')).toHaveText(['Inicio', 'Revisión rápida', 'Asignación diaria', 'Vehículos'], { timeout: 30000 })
})

/* ── I4 · con «Todos», cada salida dice su centro y lleva a él ──────────────────────────────────────────────── */
test.describe('I4 · el Inicio con «Todos» lleva al centro de cada cosa', () => {
  test('la tarjeta de una salida dice su centro y, al tocarla, entra en Asignación con ese centro elegido', async ({ page }) => {
    const fallos = vigilar(page)
    await inicioConTodos(page)
    const tarjeta = page.getByRole('button', { name: /3333 CCC/ })
    await expect(tarjeta).toContainText('OGA5')
    await expect(page.getByRole('button', { name: /4444 DDD/ })).toContainText('DGA1')
    expect(fallos).toEqual([])
    await tarjeta.click()
    await expect(page).toHaveURL(/\/panel\/asignacion/)
    await expect.poll(() => centroGuardado(page)).toBe('OGA5')
  })

  test('la casilla Asignación entra en el único centro con salidas sin revisar', async ({ page }) => {
    await inicioConTodos(page)
    await page.getByRole('button', { name: /^Asignación diaria\./ }).click()
    await expect(page).toHaveURL(/\/panel\/asignacion/)
    await expect.poll(() => centroGuardado(page)).toBe('OGA5')
  })

  test('la barra del checklist entra en el único centro con ese turno pendiente', async ({ page }) => {
    await inicioConTodos(page)
    await page.getByRole('button', { name: /Checklist de mañana/ }).click()
    await expect(page).toHaveURL(/\/panel\/checklist-operativo/)
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
  })

  test('con un centro elegido, las tarjetas no dicen el centro y no lo cambian', async ({ page }) => {
    await entrar(page, { centro: 'DGA1' })
    await page.route(/\/api\/stats\/hoy/, json(STATS_HOY))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByRole('button', { name: /3333 CCC/ })
    await expect(tarjeta).toBeVisible({ timeout: 30000 })
    await expect(tarjeta).not.toContainText('OGA5')
    await tarjeta.click()
    await expect(page).toHaveURL(/\/panel\/asignacion/)
    expect(await centroGuardado(page)).toBe('DGA1')
  })
})

/* ── I5 · la cifra grande, sobre las salidas ─────────────────────────────────────────────────────────────────── */
test('I5 · con salidas en el cuadrante, la cifra grande es «salidas revisadas X de Y» y la flota va debajo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { centro: 'OGA5' })
  await page.route(/\/api\/stats\/hoy/, json({ ...STATS_HOY, por_centro: undefined }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('hoy-salidas-revisadas')).toHaveText('1 de 2 salidas del cuadrante con su revisión de hoy', { timeout: 30000 })
  // 1 de 2 = 50 %, no los 3 de 10 de toda la flota (30 %).
  const cifra = page.getByTestId('hoy-salidas-revisadas').locator('xpath=..').locator('span.font-display').first()
  await expect(cifra).toHaveText('50')
  await expect(page.getByText('3 de 10 vehículos con su revisión de hoy (sin contar el taller)')).toBeVisible()
  await expect(page.locator('header').filter({ hasText: 'salidas revisadas hoy' }).first()).toContainText('1 de 2 salidas revisadas hoy')
  expect(fallos).toEqual([])
})

test('I5 · sin salidas hoy, la cifra grande sigue siendo la de la flota', async ({ page }) => {
  await entrar(page, { centro: 'OGA5' })
  await page.route(/\/api\/stats\/hoy/, json({ ...STATS_HOY, salidas: { total: 0, revisadas: 0, lista: [] }, por_centro: undefined }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('3 de 10 vehículos con su revisión de hoy (sin contar el taller)')).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('hoy-salidas-revisadas')).toHaveCount(0)
})

/* ── I6 · Cómo va cada centro ────────────────────────────────────────────────────────────────────────────────── */
test.describe('I6 · Cómo va cada centro', () => {
  test('una fila por centro con si cada dato está y de cuándo es; cada dato lleva a su pantalla con ese centro', async ({ page }) => {
    const fallos = vigilar(page)
    await inicioConTodos(page)
    const bloque = page.getByTestId('como-va-cada-centro')
    await expect(bloque.getByRole('heading', { name: 'Cómo va cada centro' })).toBeVisible()
    const oga5 = bloque.locator('[data-centro="OGA5"]')
    const dga1 = bloque.locator('[data-centro="DGA1"]')
    await abrirCentro(oga5)
    await abrirCentro(dga1)
    for (const txt of ['Salidas revisadas 0/1', 'Plantilla del día: guardada hoy por María', 'Horas · WHC: plan de esta semana',
      'DNR diaria: último día, el 09/11', 'Cuadrante: hasta el 17/12', 'Máximas: hasta el 30/11']) {
      await expect(oga5.getByRole('button', { name: txt })).toBeVisible()
    }
    for (const txt of ['Salidas revisadas 1/1', 'Plantilla del día: sin guardar hoy', 'Horas · WHC: plan de la semana del 01/11',
      'DNR diaria: sin datos', 'Cuadrante: hasta el 05/11', 'Máximas: sin datos']) {
      await expect(dga1.getByRole('button', { name: txt })).toBeVisible()
    }
    expect(fallos).toEqual([])
    await dga1.getByRole('button', { name: /^Horas · WHC/ }).click()
    await expect(page).toHaveURL(/\/panel\/horas/)
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
  })

  test('el nombre del centro lleva al Inicio de ese centro', async ({ page }) => {
    await inicioConTodos(page)
    await page.getByRole('button', { name: 'Entrar en DGA1' }).click()
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
    await expect(page.getByTestId('como-va-cada-centro')).toHaveCount(0)
  })

  test('solo salen los datos de las pantallas que esa persona puede abrir', async ({ page }) => {
    await inicioConTodos(page, { rutas: (p) => p.route(/\/api\/auth\/me$/,
      json({ id: 'a1', name: 'Admin Test', role: 'admin', permissions: ['dashboard', 'plantilla'], allowed_centers: null })) })
    const oga5 = page.getByTestId('como-va-cada-centro').locator('[data-centro="OGA5"]')
    await abrirCentro(oga5)
    // Primero, que hayan llegado los datos de /stats/centros-hoy (la Plantilla sale de ahí): antes de llegar no hay
    // ningún dato de esos para nadie y los ceros de abajo se cumplirían sin haber mirado los permisos.
    await expect(oga5.getByRole('button', { name: /^Plantilla del día/ })).toBeVisible({ timeout: 15000 })
    await expect(oga5.getByRole('button', { name: /^Horas · WHC/ })).toHaveCount(0)
    await expect(oga5.getByRole('button', { name: /^DNR diaria/ })).toHaveCount(0)
    await expect(oga5.getByRole('button', { name: /^Cuadrante/ })).toHaveCount(0)
  })

  test('se vuelve a pedir cada minuto, como las salidas, y si una vez falla se queda lo último bueno', async ({ page }) => {
    // El reloj de la página lo lleva la prueba: el minuto se adelanta, no se espera.
    await page.clock.install()
    let vez = 0
    // La barrera de la 3.ª vuelta: /stats/hoy se retiene hasta que el 500 de centros-hoy ha llegado entero a la página;
    // luego contesta con OGA5 revisada. Ver ese cambio en pantalla asegura que el fallo ya se procesó antes de mirar.
    let retenerHoy = false
    let soltarHoy
    const hoyRetenida = new Promise((ok) => { soltarHoy = ok })
    await entrar(page)
    await page.route(/\/api\/stats\/hoy/, (r) => {
      if (!retenerHoy) return json(STATS_HOY)(r)
      retenerHoy = false
      soltarHoy(r)
      return undefined
    })
    await page.route(/\/api\/stats\/centros-hoy/, (r) => {
      vez += 1
      if (vez === 1) return json({ ...CENTROS_HOY, centros: [{ ...CENTROS_HOY.centros[0], plantilla: null }, CENTROS_HOY.centros[1]] })(r)
      if (vez === 2) return json(CENTROS_HOY)(r)
      return r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"caído"}' })
    })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const oga5 = page.getByTestId('como-va-cada-centro').locator('[data-centro="OGA5"]')
    await abrirCentro(oga5)
    await expect(oga5.getByRole('button', { name: 'Plantilla del día: sin guardar hoy' })).toBeVisible({ timeout: 30000 })
    // María guarda la plantilla en OGA5: al minuto siguiente se ve sin salir del Inicio.
    await page.clock.fastForward(61000)
    await expect(oga5.getByRole('button', { name: 'Plantilla del día: guardada hoy por María' })).toBeVisible()
    // Al otro minuto el servidor falla: no se borra lo que ya se sabía.
    retenerHoy = true
    // `requestfinished`: el 500 ya lo tiene la página entero (no solo sus cabeceras).
    const fallo = page.waitForEvent('requestfinished', (req) => /\/stats\/centros-hoy/.test(req.url()))
    await page.clock.fastForward(61000)
    await fallo
    const hoy = await hoyRetenida
    await json({ ...STATS_HOY, por_centro: [{ ...STATS_HOY.por_centro[0], revisadas: 1 }, STATS_HOY.por_centro[1]] })(hoy)
    // Las salidas nuevas llegan DESPUÉS del fallo: cuando se ven, el fallo ya pasó por la pantalla.
    await expect(oga5.getByRole('button', { name: 'Salidas revisadas 1/1' })).toBeVisible()
    await expect(oga5.getByRole('button', { name: 'Plantilla del día: guardada hoy por María' })).toBeVisible()
    expect(vez).toBeGreaterThanOrEqual(3)
  })

  test('la DNR que lleva más de 4 días sin subirse sale en ámbar; la de hace 2 días, no', async ({ page }) => {
    // «Hoy» es el `dia` de la propia respuesta, no el reloj del ordenador.
    await inicioConTodos(page, { centrosHoy: { ...CENTROS_HOY,
      centros: [CENTROS_HOY.centros[0], { ...CENTROS_HOY.centros[1], dnr_ultimo: '2026-11-02' }] } })
    const bloque = page.getByTestId('como-va-cada-centro')
    const oga5 = bloque.locator('[data-centro="OGA5"]')
    const dga1 = bloque.locator('[data-centro="DGA1"]')
    await abrirCentro(oga5)
    await abrirCentro(dga1)
    await expect(dga1.getByRole('button', { name: 'DNR diaria: último día, el 02/11' })).toHaveAttribute('data-tono', 'falta', { timeout: 15000 })
    await expect(oga5.getByRole('button', { name: 'DNR diaria: último día, el 09/11' })).toHaveAttribute('data-tono', 'neutro')
  })

  test('en el móvil, cada centro es una línea con su resumen y sus datos se abren al tocarla; «El día de hoy» queda cerca', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await inicioConTodos(page)
    const bloque = page.getByTestId('como-va-cada-centro')
    const dga1 = bloque.locator('[data-centro="DGA1"]')
    const abrir = dga1.getByRole('button', { name: '5 por mirar' })
    await expect(abrir).toHaveAttribute('aria-expanded', 'false', { timeout: 15000 })
    await expect(bloque.locator('[data-centro="OGA5"]').getByRole('button', { name: '1 por mirar' })).toBeVisible()
    await expect(dga1.getByRole('button', { name: 'Plantilla del día: sin guardar hoy' })).toBeHidden()
    // Plegado, el bloque entero cabe de sobra en media pantalla.
    expect((await bloque.boundingBox()).height).toBeLessThan(MOVIL.height / 2)
    await abrir.click()
    await expect(abrir).toHaveAttribute('aria-expanded', 'true')
    await dga1.getByRole('button', { name: 'Plantilla del día: sin guardar hoy' }).click()
    await expect(page).toHaveURL(/\/panel\/plantilla/)
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
  })

  test('con un centro elegido no sale (ni se pide)', async ({ page }) => {
    let pedido = false
    await entrar(page, { centro: 'OGA5' })
    await page.route(/\/api\/stats\/centros-hoy/, (r) => { pedido = true; return json(CENTROS_HOY)(r) })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Salidas de hoy')).toBeVisible({ timeout: 30000 })
    await expect(page.getByTestId('como-va-cada-centro')).toHaveCount(0)
    expect(pedido).toBe(false)
  })

  test('si el servidor aún no tiene la ruta nueva, el bloque sale solo con las salidas y nada se rompe', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page)
    await page.route(/\/api\/stats\/hoy/, json(STATS_HOY))
    await page.route(/\/api\/stats\/centros-hoy/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not Found"}' }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const oga5 = page.getByTestId('como-va-cada-centro').locator('[data-centro="OGA5"]')
    await abrirCentro(oga5)
    await expect(oga5.getByRole('button', { name: 'Salidas revisadas 0/1' })).toBeVisible({ timeout: 30000 })
    await expect(oga5.getByRole('button', { name: /^Plantilla/ })).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('en el móvil, si /stats/centros-hoy falla, el resumen plegado no dice «Todo al día»: dice solo las salidas', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page)
    await page.route(/\/api\/stats\/hoy/, json(STATS_HOY))
    await page.route(/\/api\/stats\/centros-hoy/, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"caído"}' }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const bloque = page.getByTestId('como-va-cada-centro')
    // DGA1 tiene sus salidas revisadas, pero de la plantilla, las horas, la DNR y el cuadrante no se sabe nada.
    await expect(bloque.locator('[data-centro="DGA1"] button[aria-expanded]')).toHaveText('Salidas 1/1', { timeout: 30000 })
    await expect(bloque.locator('[data-centro="OGA5"] button[aria-expanded]')).toHaveText('Salidas 0/1')
    await expect(bloque.getByText('Todo al día')).toHaveCount(0)
  })
})

/* ── I7 · elegir el centro ahí mismo ─────────────────────────────────────────────────────────────────────────── */
test.describe('I7 · ElegirNave en Mi día, Chat, la burbuja y Móviles', () => {
  test('Mi día con «Todos»: enseña el primero y ofrece los demás con un toque', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page)
    await page.goto('/panel/mi-dia', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Estás viendo OGA5', { timeout: 30000 })
    // Solo los OTROS centros (OGA5 ya está a la vista), y arriba ya no manda «cámbialo arriba».
    await expect(elegir.getByRole('button')).toHaveText(['DGA1'])
    await expect(page.getByText(/cámbialo arriba/)).toHaveCount(0)
    await expect(page.locator('main header p').first()).toHaveText('OGA5')
    await elegir.getByRole('button', { name: 'DGA1' }).click()
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
    await expect(page.getByTestId('elegir-centro')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('Chat con «Todos»: un botón por centro abre su sala', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page)
    await page.goto('/panel/chat', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Elige un centro para abrir su sala.', { timeout: 30000 })
    await expect(page.getByText(/Disponibles:/)).toHaveCount(0)
    // La cabecera no repite la frase ni manda «arriba»: los botones están justo debajo.
    await expect(page.getByText(/arriba/)).toHaveCount(0)
    await elegir.getByRole('button', { name: 'DGA1' }).click()
    await expect(page.getByRole('heading', { name: /DGA1/ })).toBeVisible()
    expect(await centroGuardado(page)).toBe('DGA1')
    expect(fallos).toEqual([])
  })

  test('la burbuja del asistente con «Todos»: elige el centro dentro de la burbuja', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page, { escenario: 'vacio' })
    await page.goto('/panel/perfil', { waitUntil: 'domcontentloaded' })
    await page.getByTitle(/IA$/).last().click()
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Elige el centro para hablar con su asistente.')
    await elegir.getByRole('button', { name: 'OGA5' }).click()
    await expect(page.getByPlaceholder('Escribe tu pregunta…')).toBeVisible()
    expect(await centroGuardado(page)).toBe('OGA5')
    expect(fallos).toEqual([])
  })

  test('Móviles de empresa con «Todos»: un botón por centro', async ({ page }) => {
    await entrar(page, { escenario: 'vacio' })
    await page.route(/\/api\/moviles/, json({ moviles: [], conductores: [] }))
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Móviles', exact: true }).click()
    const elegir = page.getByTestId('elegir-centro').filter({ hasText: 'Los móviles van por centro' })
    await expect(elegir).toBeVisible({ timeout: 30000 })
    await elegir.getByRole('button', { name: 'DGA1' }).click()
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
  })
})

/* ── I8 · ?centro= en la dirección ───────────────────────────────────────────────────────────────────────────── */
test.describe('I8 · ?centro= en la dirección', () => {
  test('se elige ese centro (aunque venga en minúsculas) y el parámetro se quita', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page, { centro: 'OGA5' })
    await page.goto('/panel/mi-dia?centro=dga1', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/panel\/mi-dia$/, { timeout: 30000 })
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
    await expect(page.locator('main header p').first()).toContainText('DGA1')
    expect(fallos).toEqual([])
  })

  test('un centro que no puede ver no se elige, pero el parámetro se quita igual', async ({ page }) => {
    await entrar(page, { centro: 'OGA5' })
    await page.goto('/panel/mi-dia?centro=DGA2', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/panel\/mi-dia$/, { timeout: 30000 })
    expect(await centroGuardado(page)).toBe('OGA5')
  })

  test('los demás parámetros de la dirección se conservan', async ({ page }) => {
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel/chat?con=zz&centro=DGA1', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/panel\/chat\?con=zz$/, { timeout: 30000 })
    await expect.poll(() => centroGuardado(page)).toBe('DGA1')
  })
})

/* ── I9 · la app de Android en el Portal del conductor ───────────────────────────────────────────────────────── */
test.describe('I9 · Portal del conductor', () => {
  test('en la web: tarjeta con el enlace y el QR de la app, y el texto del enlace por centro dice la verdad', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel/portal-conductor', { waitUntil: 'domcontentloaded' })
    const app = page.getByTestId('portal-app-android')
    await expect(app).toBeVisible({ timeout: 30000 })
    await expect(app.getByRole('link', { name: 'Abrir en Google Play' })).toHaveAttribute('href', /play\.google\.com\/store\/apps\/details\?id=/)
    await expect(app.getByRole('img', { name: 'Código QR de la app para Android' })).toBeVisible()
    await expect(page.getByText('Enseña el centro en la pantalla de entrada. El conductor entra con su correo y el centro sale de su ficha.')).toBeVisible()
    await expect(page.getByText(/a prueba de errores/)).toHaveCount(0)
    // Las cajas de texto siguen siendo solo enlaces al portal web.
    const valores = await page.locator('input[readonly]').evaluateAll((els) => els.map((e) => e.value))
    for (const v of valores) expect(v).toContain('/conductor/')
    expect(fallos).toEqual([])
  })

  test('dentro de la app de iPhone no sale la tarjeta de la app de Android', async ({ page }) => {
    await page.addInitScript(() => {
      window.webkit = window.webkit || {}
      window.webkit.messageHandlers = { ...(window.webkit.messageHandlers || {}), bridge: { postMessage() {} } }
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', nativePromise: () => new Promise(() => {}), nativeCallback() {} }
      try { sessionStorage.setItem('chunk_curacion', JSON.stringify({ t: Date.now(), n: 3 })) } catch { /* nada */ }
    })
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel/portal-conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[readonly]').first()).toBeVisible({ timeout: 30000 })
    await expect(page.getByTestId('portal-app-android')).toHaveCount(0)
    await expect(page.getByText(/Google Play|Android/)).toHaveCount(0)
  })
})

/* ── I10 · Conversaciones sin WhatsApp conectado ─────────────────────────────────────────────────────────────── */
test.describe('I10 · Conversaciones', () => {
  test('sin WhatsApp conectado, lo dice arriba y en la lista vacía', async ({ page }) => {
    const fallos = vigilar(page)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.route(/\/api\/whatsapp\/estado/, json({ configurado: false, faltan: ['WHATSAPP_ACCESS_TOKEN'] }))
    await page.route(/\/api\/whatsapp\/conversaciones(\?|$)/, json({ conversaciones: [] }))
    await page.goto('/panel/conversaciones', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status').filter({ hasText: 'WhatsApp no está conectado.' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('No hay conversaciones: WhatsApp no está conectado.')).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('con WhatsApp conectado, como siempre', async ({ page }) => {
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.route(/\/api\/whatsapp\/estado/, json({ configurado: true, faltan: [] }))
    await page.route(/\/api\/whatsapp\/conversaciones(\?|$)/, json({ conversaciones: [] }))
    await page.goto('/panel/conversaciones', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Aún no hay conversaciones/)).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('WhatsApp no está conectado.')).toHaveCount(0)
  })
})

/* ── I11 · «1 abierta» y la burbuja que no tapa ──────────────────────────────────────────────────────────────── */
test.describe('I11 · detalles de las fotos', () => {
  test('«1 abierta», en singular', async ({ page }) => {
    await entrar(page, { centro: 'OGA5' })
    await page.route(/\/api\/estado-flota/, json({ furgonetas: [], en_taller: [{ vehicle_id: 'v1', matricula: '1111 AAA', orden: { id: 'o1' } }],
      niveles: { urgente: 0, taller: 1 }, salud_media: 80 }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    // `exact`: sin él, «Órdenes de taller. 1 abiertas» (el plural de antes) también casaba como trozo.
    await expect(page.getByRole('button', { name: 'Órdenes de taller. 1 abierta', exact: true })).toBeVisible({ timeout: 30000 })
  })

  test('al final de la página, nada queda debajo de la burbuja de la IA', async ({ page }) => {
    await entrar(page, { centro: 'OGA5' })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Salidas de hoy')).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const burbuja = await page.getByTitle(/IA$/).last().boundingBox()
    const fondo = await page.locator('main > *').last().evaluate((el) => el.getBoundingClientRect().bottom)
    expect(fondo).toBeLessThanOrEqual(burbuja.y)
  })

  test('en el Chat del móvil la burbuja sigue a mano, pero por encima de la caja de escribir: no tapa ni el texto ni Enviar', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /OGA5/ })).toBeVisible({ timeout: 30000 })
    const burbuja = page.getByTitle(/IA$/).last()
    await expect(burbuja).toBeVisible()
    const b = await burbuja.boundingBox()
    const enviar = await page.getByRole('button', { name: 'Enviar' }).boundingBox()
    const caja = await page.getByPlaceholder(/@flota/).boundingBox()
    expect(b.y + b.height).toBeLessThanOrEqual(Math.min(enviar.y, caja.y))
    // Y al final de los mensajes queda sitio para que el último suba por encima de ella.
    const lista = page.getByTestId('chat-mensajes')
    const hueco = await lista.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))
    expect(hueco).toBeGreaterThanOrEqual(b.height)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(burbuja).toBeVisible()
  })

  test('en el Chat del móvil, con un aviso pendiente, la furgoneta de avisos sube con la burbuja y tampoco tapa Enviar', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /OGA5/ })).toBeVisible({ timeout: 30000 })
    // Un aviso pendiente de otra pantalla (los de la propia pantalla se cierran solos al entrar). Se deja DESPUÉS de la
    // primera entrada: al entrar, `aislarSesion` borra los avisos guardados por otra sesión.
    await page.evaluate(() => localStorage.setItem('ln_pending', JSON.stringify([
      { key: 'cand-1', icon: 'candidato', title: 'Candidato nuevo · OGA5', body: '', to: '/panel/candidatos', ts: Date.now() }])))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /OGA5/ })).toBeVisible({ timeout: 30000 })
    const furgoneta = page.getByTitle('1 aviso', { exact: true })
    await expect(furgoneta).toBeVisible()
    const f = await furgoneta.boundingBox()
    const b = await page.getByTitle(/IA$/).last().boundingBox()
    const enviar = await page.getByRole('button', { name: 'Enviar' }).boundingBox()
    const caja = await page.getByPlaceholder(/@flota/).boundingBox()
    expect(f.y + f.height).toBeLessThanOrEqual(Math.min(enviar.y, caja.y))
    // Pegada a la burbuja, a su misma altura.
    expect(Math.abs((f.y + f.height) - (b.y + b.height))).toBeLessThanOrEqual(1)
  })

  test('el botón de menú de la cabecera del móvil se ve igual (36 px) pero responde en 44 px', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const boton = page.locator('header').getByRole('button', { name: /^Menú/ })
    await expect(boton).toBeVisible({ timeout: 30000 })
    const caja = await boton.boundingBox()
    expect(Math.round(caja.height)).toBe(36)
    // Las cuatro esquinas de un cuadrado de 44 px centrado en el botón caen en él.
    const dentro = await page.evaluate(({ x, y, width, height }) => {
      const cx = x + width / 2
      const cy = y + height / 2
      return [[-21, -21], [21, -21], [-21, 21], [21, 21]].map(([dx, dy]) =>
        !!document.elementFromPoint(cx + dx, cy + dy)?.closest('header button[aria-label^="Menú"]'))
    }, caja)
    expect(dentro).toEqual([true, true, true, true])
    await page.mouse.click(caja.x - 3, caja.y + caja.height / 2)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('en el ordenador, el Chat y el Centro de IA caben en la ventana como antes (el hueco de abajo no les toca)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await entrar(page, { centro: 'OGA5', superAdmin: true, escenario: 'vacio' })
    // Lo que sobra por abajo, sea quien sea el que hace scroll: la página entera o el <main>.
    const sobra = () => page.locator('main').evaluate((m) => Math.max(m.scrollHeight - m.clientHeight,
      document.documentElement.scrollHeight - window.innerHeight))
    // `poll`: mientras entra la pantalla (la animación de entrada) puede sobrar un par de píxeles un momento.
    await page.goto('/panel/centro-ia', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('centro-ia')).toBeVisible({ timeout: 30000 })
    await expect.poll(sobra).toBeLessThanOrEqual(0)
    await page.goto('/panel/chat', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /OGA5/ })).toBeVisible({ timeout: 30000 })
    await expect.poll(sobra).toBeLessThanOrEqual(0)
  })

  test('con la hoja del menú abierta, la burbuja no tapa nada', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrar(page, { centro: 'OGA5', escenario: 'vacio' })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const burbuja = page.getByTitle(/IA$/).last()
    await expect(burbuja).toBeVisible({ timeout: 30000 })
    await barraAbajo(page).getByRole('button', { name: /^Menú/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(burbuja).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(burbuja).toBeVisible()
  })
})
