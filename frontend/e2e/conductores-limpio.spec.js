import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* CONDUCTORES SIN LO HEREDADO Y UN SOLO CIAN (14-11-2026, ARREGLOS-5 N1-N3). Lo que se vigila es lo que se mide:
   · N1 · las columnas vacías en TODA la lista no se pintan (y vuelven en cuanto una ficha tiene el dato); las dos
     contraseñas, plegadas en «Más opciones» a un toque; «sin correo» no le sale a quien entra con su enlace; la pestaña
     «Ranking» sin emoji; las cabeceras sin mayúsculas; «Mandar su acceso» subrayado y el estado en mono; un solo guion.
   · N2 · Conductores vacío: una acción («Importar la lista», cian), «Añadir uno a uno» como enlace, sin caja de puntos, y
     el «Añadir conductor» de la cabecera con borde.
   · N3 · el avatar de la cabecera, gris; el asistente, desde la tanda 6 un botón de la barra de arriba (sin relleno cian
     ni sombra) que no pisa nada de la lista.
   · T6 · (tanda 6) los menores de Conductores, el Ranking legible de día y Vehículos con la misma mano. */

const ESENCIAL = ['dashboard', 'mi-dia', 'vehiculos', 'repaso', 'inspecciones', 'incidencias', 'talleres', 'ordenes',
  'vencimientos', 'importaciones', 'conductores', 'chat', 'configuracion']

// Empresa nueva: móvil y enlace, sin correo, sin alojamiento, contrato ni nivel, nadie con contraseña.
const NOMBRES = ['Ana L.', 'Luis P.', 'Rosa M.', 'Javier G.', 'Marta R.', 'Iván C.', 'Lucía V.', 'Pedro S.', 'Sara T.', 'Óscar N.',
  'Nuria B.', 'Raúl D.', 'Elena F.', 'Hugo J.']
const ESTADOS = ['abierto', 'sin_abrir', 'sin_enlace', 'abierto', 'caducado', 'abierto', 'sin_enlace']
const NUEVA = NOMBRES.map((n, i) => ({ id: `d${i + 1}`, name: n, center: 'NORTE', active: true, phone: `61234560${String(i).padStart(2, '0')}`, email: '' }))
const ACC_NUEVA = {
  empresa: 'Transportes de ejemplo',
  conductores: NUEVA.map((d, i) => {
    const e = ESTADOS[i % ESTADOS.length]
    return { driver_id: d.id, nombre: d.name, center: 'NORTE', movil: `+34${d.phone}`, whatsapp: null, email: null,
      acceso: { estado: e, creado_dia: e === 'sin_enlace' ? null : '2026-11-12', abierto_dia: e === 'abierto' ? '2026-11-13' : null, caduca_dia: null } }
  }),
}

// La flota completa: correos, alojamiento, contrato, nivel y cuentas con contraseña.
const COMPLETA = [
  { id: 'c1', name: 'Ana L.', email: 'ana@ejemplo.es', alojamiento: 'Hostal', contrato: 'empresa', nivel: 'pleno', phone: '600111220' },
  { id: 'c2', name: 'Luis P.', email: 'luis@ejemplo.es', contrato: 'ett', nivel: 'L1', phone: '600111221' },
  { id: 'c3', name: 'Javier G.', email: '', phone: '' },
].map((d) => ({ ...d, center: 'NORTE', active: true }))
const ACC_COMPLETA = { empresa: 'Transportes de ejemplo', conductores: COMPLETA.map((d) => ({ driver_id: d.id, nombre: d.name, center: 'NORTE',
  movil: null, whatsapp: null, email: d.email || null, acceso: { estado: 'sin_enlace' } })) }

async function montar(page, { tema = 'light', fichas = [], accesos = { conductores: [] }, cuentas = [] } = {}) {
  await entrarComoAdmin(page)
  await page.addInitScript((t) => {
    localStorage.setItem('panel_theme', t)
    localStorage.setItem('panel_theme_elegido', '1')
  }, tema)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing(\?|$)/, (r) => r.fulfill({ json: { plan: 'esencial', status: 'active', modulos: ESENCIAL } }))
  await page.route(/\/api\/conductores\/accesos/, (r) => r.fulfill({ json: accesos }))
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: fichas }))
  await page.route(/\/api\/auth\/driver-accounts(\?|$)/, (r) => r.fulfill({ json: cuentas }))
  await page.route(/\/api\/auth\/driver-accounts\/contrasena-inicial/, (r) => r.fulfill({ json: { definida: false } }))
}

const cabeceras = (page) => page.locator('table thead th').evaluateAll((ths) => ths.map((th) => th.textContent.replace(/[▲▼]/g, '').trim()).filter(Boolean))
const cian = (c) => /rgb\(\s*(20|19|18|17|16|15|14|13|45|34|94),\s*2\d\d,\s*2\d\d/.test(c)

test('N1 · empresa nueva: sin columnas vacías, sin «sin correo», contraseñas plegadas, «Ranking» sin emoji', async ({ page, isMobile }) => {
  test.skip(isMobile, 'la tabla es del ordenador; la tarjeta del móvil se mira en «N3 · la burbuja en el móvil»')
  await montar(page, { fichas: NUEVA, accesos: ACC_NUEVA })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Ana L.', { exact: true })).toBeVisible({ timeout: 15000 })
  expect(await cabeceras(page)).toEqual(['Nombre', 'Centro', 'Teléfono', 'Acceso'])
  // Las cabeceras, en letra normal: ninguna en mayúsculas.
  const transformes = await page.locator('table thead th').evaluateAll((ths) => ths.map((th) => getComputedStyle(th).textTransform))
  expect(new Set(transformes)).toEqual(new Set(['none']))
  // Quien entra con su enlace no tiene «sin correo»; y en una empresa sin contraseñas, nadie.
  await expect(page.getByRole('button', { name: /^sin correo/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^sin acceso \(\d+\)$/ })).toBeVisible()
  // Las contraseñas, plegadas y a un toque.
  const mas = page.getByTestId('mas-opciones')
  await expect(page.getByText(/Contraseña inicial de los conductores nuevos/)).toBeHidden()
  await mas.click()
  await expect(page.getByText(/Contraseña inicial de los conductores nuevos/)).toBeVisible()
  // «Ranking» sin emoji.
  await expect(page.getByRole('button', { name: 'Ranking conductores', exact: true })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/🏆|🥇/u)
  // La acción subrayada; el estado en mono, sin borde de pastilla.
  const mandar = page.getByTestId('boton-acceso').and(page.locator('[data-estado="sin_enlace"]')).first()
  expect(await mandar.evaluate((b) => getComputedStyle(b).textDecorationLine)).toContain('underline')
  const abierto = page.getByTestId('boton-acceso').and(page.locator('[data-estado="abierto"]')).first()
  await expect(abierto).toHaveText('Abierto el 13 NOV')
  // El estado, en la letra de la casa; solo el día, en mono (tanda 6).
  const est = await abierto.evaluate((b) => ({ letra: getComputedStyle(b).fontFamily, borde: getComputedStyle(b).borderTopWidth }))
  expect(est.letra).not.toMatch(/Mono/)
  expect(est.borde).toBe('0px')
  const dia = abierto.locator('span.font-mono')
  await expect(dia).toHaveText('13 NOV')
  expect(await dia.evaluate((s) => getComputedStyle(s).fontFamily)).toMatch(/Plex Mono/)
  // Con cuatro columnas, la tabla no se estira a todo el ancho (dejaba unos 400 px vacíos en medio).
  const anchos = await page.getByTestId('tabla-conductores').evaluate((t) => ({ tabla: t.offsetWidth, caja: t.parentElement.offsetWidth }))
  expect(anchos.tabla).toBeLessThan(anchos.caja - 150)
})

test('N1 · la flota completa no pierde nada: siete columnas, «sin correo» y las contraseñas a un toque', async ({ page, isMobile }) => {
  test.skip(isMobile, 'la tabla es del ordenador')
  await montar(page, { fichas: COMPLETA, accesos: ACC_COMPLETA, cuentas: [{ driver_id: 'c1' }, { driver_id: 'c2' }] })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Ana L.', { exact: true })).toBeVisible({ timeout: 15000 })
  expect(await cabeceras(page)).toEqual(['Nombre', 'Centro', 'Alojamiento', 'Teléfono', 'Correo', 'Contrato', 'Nivel', 'Acceso'])
  await expect(page.getByRole('button', { name: 'sin correo (1)' })).toBeVisible()
  // Un solo guion para lo vacío, también en la columna del teléfono (en mono salía más corto).
  const guiones = await page.locator('table tbody td span').filter({ hasText: /^—$/ }).evaluateAll((ss) => [...new Set(ss.map((s) => getComputedStyle(s).fontFamily))])
  expect(guiones).toHaveLength(1)
  expect(await page.locator('table tbody').innerText()).not.toContain('–')
  await page.getByTestId('mas-opciones').click()
  await expect(page.getByText(/Contraseña inicial de los conductores nuevos/)).toBeVisible()
})

test('N2 · Conductores vacío: una sola acción cian y «Añadir uno a uno» como enlace', async ({ page }) => {
  await montar(page)
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  const vacio = page.getByTestId('conductores-vacio')
  await expect(vacio).toBeVisible({ timeout: 15000 })
  await expect(vacio.getByRole('button', { name: 'Importar la lista' })).toBeVisible()
  const uno = vacio.getByRole('button', { name: 'Añadir uno a uno' })
  expect(await uno.evaluate((b) => getComputedStyle(b).textDecorationLine)).toContain('underline')
  // Sin caja de puntos ni icono; el texto a la izquierda.
  const caja = await vacio.evaluate((el) => ({ borde: getComputedStyle(el).borderStyle, alinea: getComputedStyle(el).textAlign, svg: el.querySelectorAll('svg').length }))
  expect(caja.borde).not.toContain('dashed')
  expect(caja.alinea).not.toBe('center')
  expect(caja.svg).toBe(0)
  // Cuántos fondos cian hay en <main>: uno, el de «Importar la lista».
  const fondos = await page.locator('main').evaluate((m) => [...m.querySelectorAll('button, a')]
    .filter((b) => b.offsetParent).map((b) => getComputedStyle(b).backgroundColor))
  expect(fondos.filter(cian)).toHaveLength(1)
  await vacio.getByRole('button', { name: 'Importar la lista' }).click()
})

for (const tema of ['light', 'dark', 'hibrido']) {
  test(`N3 · ${tema}: el avatar, gris; el asistente, un botón de la barra de arriba que no pisa nada de la lista`, async ({ page, isMobile }) => {
    await montar(page, { tema, fichas: NUEVA, accesos: ACC_NUEVA })
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ana L.', { exact: true }).first()).toBeVisible({ timeout: 15000 })
    const boton = page.getByRole('button', { name: 'Asistente', exact: true })
    await expect(boton).toBeVisible()
    const b = await boton.evaluate((el) => ({ fondo: getComputedStyle(el).backgroundColor, sombra: getComputedStyle(el).boxShadow }))
    expect(cian(b.fondo), b.fondo).toBe(false)
    expect(b.sombra).toBe('none')
    // Ya no flota (tanda 6): ni burbuja, ni nada del asistente encima de la página.
    await expect(page.getByTestId('burbuja-asistente')).toHaveCount(0)
    if (!isMobile) {
      const avatar = page.locator('header button[aria-haspopup="menu"] span').first()
      expect(cian(await avatar.evaluate((el) => getComputedStyle(el).backgroundColor))).toBe(false)
    }
    // Nunca encima de la lista: ni de un avatar, ni de un botón de llamar, ni de una etiqueta de acceso, en ningún punto.
    for (let paso = 0; paso < 6; paso++) {
      const caja = await boton.boundingBox()
      const pisa = await page.evaluate((c) => [...document.querySelectorAll('main a[href^="tel:"], main [data-testid="boton-acceso"], main li, main tbody tr')].some((el) => {
        const r = el.getBoundingClientRect()
        return r.width && r.left < c.x + c.width && r.right > c.x && r.top < c.y + c.height && r.bottom > c.y
      }), caja)
      expect(pisa, `paso ${paso}`).toBe(false)
      await page.mouse.wheel(0, 140)
      await page.waitForTimeout(150)
    }
  })
}

/* ── TANDA 6 (14-11-2026, zona panel): Conductores y Vehículos, los menores que quedaban ─────────────────────────── */
test('T6 · Conductores en el móvil: «Más opciones» en la fila de «Ordenar por» y el teléfono siempre en su línea', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'las tarjetas son del móvil')
  await montar(page, { fichas: NUEVA, accesos: ACC_NUEVA })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Ana L.', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  const mas = page.getByTestId('mas-opciones')
  await expect(mas).toHaveCount(1)
  // En la misma fila que el selector de orden: el mismo padre y la misma altura.
  const fila = await mas.evaluate((b) => {
    const sel = document.getElementById('orden-conductores')
    const a = b.getBoundingClientRect(); const s = sel.getBoundingClientRect()
    return { mismoPadre: b.parentElement === sel.parentElement, centro: Math.abs((a.top + a.bottom) / 2 - (s.top + s.bottom) / 2) }
  })
  expect(fila.mismoPadre).toBe(true)
  expect(fila.centro).toBeLessThan(4)
  await mas.click()
  await expect(page.getByText(/Contraseña inicial de los conductores nuevos/)).toBeVisible()
  // El teléfono, a la misma altura dentro de cada tarjeta (antes saltaba de línea según lo largo del estado).
  const alturas = await page.getByTestId('tarjeta-telefono').evaluateAll((ss) => ss.map((s) => Math.round(s.getBoundingClientRect().top - s.closest('li').getBoundingClientRect().top)))
  expect(alturas.length).toBeGreaterThan(5)
  expect(new Set(alturas).size).toBe(1)
  // Nada se sale de lado.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('T6 · Conductores vacío: una sola forma de importar', async ({ page }) => {
  await montar(page, { fichas: [], accesos: { conductores: [] } })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('conductores-vacio')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Importar la lista' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar Excel' })).toHaveCount(0)
  const mas = page.getByRole('button', { name: 'Más', exact: true })
  if (await mas.isVisible()) {
    await mas.click()
    await expect(page.getByRole('menuitem', { name: 'Importar Excel' })).toHaveCount(0)
  }
})

test('T6 · la flota completa: contrato, nivel y «definida» sin colores sin significado; «Borrar búsqueda», enlace', async ({ page, isMobile }) => {
  test.skip(isMobile, 'la tabla es del ordenador')
  await montar(page, { fichas: COMPLETA, accesos: ACC_COMPLETA, cuentas: [{ driver_id: 'c1' }] })
  await page.route(/\/api\/auth\/driver-accounts\/contrasena-inicial/, (r) => r.fulfill({ json: { definida: true, desde: '2026-10-30T09:00:00Z', por: 'Ana L.' } }))
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Ana L.', { exact: true })).toBeVisible({ timeout: 15000 })
  const fondo = (loc) => loc.evaluate((s) => getComputedStyle(s).backgroundColor)
  for (const txt of ['ETT', 'L1', 'Pleno', 'Empresa']) {
    const s = page.locator('table tbody td span', { hasText: new RegExp(`^${txt}$`) }).first()
    expect(await fondo(s), txt).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  }
  await page.getByTestId('mas-opciones').click()
  const definida = page.getByTestId('inicial-definida')
  await expect(definida).toBeVisible()
  // Sin el lima de antes (rgb(190, 242, 100) o su versión de día).
  expect(await definida.evaluate((s) => getComputedStyle(s).color)).not.toMatch(/rgb\((190, 242, 100|77, 124, 15|101, 163, 13)\)/)
  await page.getByPlaceholder('Buscar conductor…').fill('zzz')
  const borrar = page.getByRole('button', { name: 'Borrar búsqueda' })
  await expect(borrar).toBeVisible()
  expect(await borrar.evaluate((b) => getComputedStyle(b).textDecorationLine)).toContain('underline')
  // Alineado con el texto de encima (el `btn-ghost` lo sangraba 12 px).
  const izq = await page.getByText(/^Nadie coincide con/).evaluate((p) => p.getBoundingClientRect().left)
  expect(Math.abs((await borrar.boundingBox()).x - izq)).toBeLessThan(2)
})

const N5 = ['Ana L.', 'Luis P.', 'Rosa M.', 'Javier G.', 'Marta R.']
const SCORES = N5.map((name, i) => ({ driver_id: `d${i + 1}`, name, center: 'NORTE', total: 92 - i * 7, compliance: 28 - i * 2, punctuality: 14 - i,
  evidence: 13 - i, honesty: 15 - i, conservation: 22 - i * 2, inspections_count: 20 - i * 2, clean_streak: 11 - i * 3, trend: 'mejorando', prize_eligible: true }))

for (const tema of ['light', 'dark']) {
  test(`T6 · Ranking ${tema}: el nombre del podio se ve; sin sombras, bordes dorados ni mayúsculas; los pilares en tinta y por t()`, async ({ page, isMobile }) => {
    await montar(page, { tema, fichas: NUEVA, accesos: ACC_NUEVA })
    await page.route(/\/api\/scoring\/drivers/, (r) => r.fulfill({ json: { scores: SCORES, prize_min_days: 8 } }))
    await page.route(/\/api\/scoring\/leaderboard/, (r) => r.fulfill({ json: { leaderboard: {}, center_stats: { NORTE: { avg_score: 78 } } } }))
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Ranking/ }).first().click()
    const podio = page.getByTestId('podio')
    await expect(podio).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const p = podio.nth(i)
      const m = await p.evaluate((el) => {
        const nombre = el.querySelector('[title]')
        const s = getComputedStyle(el)
        return { sombra: s.boxShadow, borde: s.borderTopColor, fondo: s.backgroundColor, letra: getComputedStyle(nombre).color, txt: el.innerText }
      })
      expect(m.sombra).toBe('none')
      expect(m.letra).not.toBe(m.fondo)
      expect(m.letra).not.toBe('rgb(255, 255, 255)')
      expect(m.borde).not.toMatch(/rgba\(251, 191, 36/)
      // Ni las etiquetas de 8 px de los pilares («Cump.», «Punt.»…).
      expect(m.txt).not.toMatch(/Cump\.|Punt\.|Evid\./)
    }
    // Ningún rótulo en mayúsculas en el ranking.
    const mayus = await page.locator('main').evaluate((m) => [...m.querySelectorAll('*')].filter((e) => e.offsetParent && getComputedStyle(e).textTransform === 'uppercase').length)
    expect(mayus).toBe(0)
    await expect(page.getByText('Clasificación completa', { exact: true })).toBeVisible()
    // Los pilares, en la fila desplegable: con su nombre entero y las cinco barras del mismo color.
    await page.locator('tbody tr', { hasText: 'Ana L.' }).first().click()
    const pilares = page.getByTestId('pilares')
    await expect(pilares).toContainText('Cumplimiento')
    await expect(pilares).toContainText('Conservación')
    const colores = await pilares.evaluate((el) => [...el.querySelectorAll('.h-full')].map((b) => getComputedStyle(b).backgroundColor))
    expect(colores).toHaveLength(5)
    expect(new Set(colores).size).toBe(1)
    if (isMobile) expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('T6 · Vehículos: sin la sede en mono, «Añadir vehículo» cian liso, la pestaña elegida en tinta, «Nunca revisada», y en el móvil no se sale de lado', async ({ page, isMobile }) => {
  await montar(page, { fichas: NUEVA, accesos: ACC_NUEVA })
  await page.route(/\/api\/vehicles(\?|$)/, (r) => r.fulfill({ json: [{ id: 'v1', license_plate: '5678KLM', brand: 'Renault', model: 'Master', center: 'NORTE', status: 'active', mileage: 45000, itv_date: '2027-03-15' }] }))
  await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/^5678\s*KLM/).first()).toBeVisible({ timeout: 15000 })
  // Nada en mono espaciado en la cabecera de la página.
  const espaciados = await page.locator('main header').evaluate((h) => [...h.querySelectorAll('*')].filter((e) => {
    const s = getComputedStyle(e); return /Mono/.test(s.fontFamily) && parseFloat(s.letterSpacing) > 1
  }).length)
  expect(espaciados).toBe(0)
  const anadir = page.getByTestId('anadir-vehiculo')
  const a = await anadir.evaluate((b) => { const s = getComputedStyle(b); return { img: s.backgroundImage, sombra: s.boxShadow, fondo: s.backgroundColor } })
  expect(a.img).toBe('none')
  expect(a.sombra).toBe('none')
  expect(cian(a.fondo), a.fondo).toBe(true)
  // La pestaña elegida, en tinta y sin caja: sin fondo de color.
  const elegida = page.getByTestId('pestanas-vehiculos').locator('button[aria-pressed="true"]')
  await expect(elegida).toHaveCount(1)
  const e = await elegida.evaluate((b) => { const s = getComputedStyle(b); return { fondo: s.backgroundColor, letra: s.color } })
  expect(e.fondo).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  expect(cian(e.letra)).toBe(false)
  await expect(page.getByText('Nunca inspeccionada')).toHaveCount(0)
  await expect(page.getByText('Nunca revisada').first()).toBeVisible()
  if (isMobile) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // La tabla cabe en su caja; modelo y km, en la línea de debajo de la matrícula.
    const t = await page.getByTestId('tabla-vehiculos').evaluate((tb) => ({ tabla: tb.scrollWidth, caja: tb.parentElement.clientWidth }))
    expect(t.tabla).toBeLessThanOrEqual(t.caja)
    await expect(page.getByTestId('vehiculo-linea-movil').first()).toContainText('Renault Master')
    await expect(page.getByTestId('vehiculo-linea-movil').first()).toContainText('45.000')
  }
})
