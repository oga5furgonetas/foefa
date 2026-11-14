import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* CONDUCTORES SIN LO HEREDADO Y UN SOLO CIAN (14-11-2026, ARREGLOS-5 N1-N3). Lo que se vigila es lo que se mide:
   · N1 · las columnas vacías en TODA la lista no se pintan (y vuelven en cuanto una ficha tiene el dato); las dos
     contraseñas, plegadas en «Más opciones» a un toque; «sin correo» no le sale a quien entra con su enlace; la pestaña
     «Ranking» sin emoji; las cabeceras sin mayúsculas; «Mandar su acceso» subrayado y el estado en mono; un solo guion.
   · N2 · Conductores vacío: una acción («Importar la lista», cian), «Añadir uno a uno» como enlace, sin caja de puntos, y
     el «Añadir conductor» de la cabecera con borde.
   · N3 · el avatar de la cabecera, gris; la burbuja del asistente, en tinta y sin sombra; en las listas, a la izquierda
     (nunca encima de la columna de acciones: llamar, «Mandar su acceso»). */

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
  const est = await abierto.evaluate((b) => ({ letra: getComputedStyle(b).fontFamily, borde: getComputedStyle(b).borderTopWidth }))
  expect(est.letra).toMatch(/Plex Mono/)
  expect(est.borde).toBe('0px')
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
  test(`N3 · ${tema}: el avatar, gris; la burbuja, en tinta y sin sombra, a la izquierda en las listas`, async ({ page, isMobile }) => {
    await montar(page, { tema, fichas: NUEVA, accesos: ACC_NUEVA })
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ana L.', { exact: true }).first()).toBeVisible({ timeout: 15000 })
    const boton = page.getByTitle(/IA$/).last()
    await expect(boton).toBeVisible()
    const b = await boton.evaluate((el) => ({ fondo: getComputedStyle(el).backgroundColor, sombra: getComputedStyle(el).boxShadow }))
    expect(cian(b.fondo), b.fondo).toBe(false)
    expect(b.sombra).toBe('none')
    await expect(page.getByTestId('burbuja-asistente')).toHaveAttribute('data-lado', 'izquierda')
    if (!isMobile) {
      const avatar = page.locator('header button[aria-haspopup="menu"] span').first()
      expect(cian(await avatar.evaluate((el) => getComputedStyle(el).backgroundColor))).toBe(false)
    }
    // Nunca encima de la columna de acciones: ni de un botón de llamar ni de una etiqueta de acceso, en ningún punto de la lista.
    for (let paso = 0; paso < 6; paso++) {
      const caja = await boton.boundingBox()
      const pisa = await page.evaluate((c) => [...document.querySelectorAll('a[href^="tel:"], [data-testid="boton-acceso"]')].some((el) => {
        const r = el.getBoundingClientRect()
        return r.width && r.left < c.x + c.width && r.right > c.x && r.top < c.y + c.height && r.bottom > c.y
      }), caja)
      expect(pisa, `paso ${paso}`).toBe(false)
      await page.mouse.wheel(0, 140)
      await page.waitForTimeout(150)
    }
    // Fuera de las listas, donde siempre: abajo a la derecha.
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('burbuja-asistente')).toHaveAttribute('data-lado', 'derecha')
  })
}
