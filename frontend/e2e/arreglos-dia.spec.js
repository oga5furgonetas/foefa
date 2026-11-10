import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* Arreglos de la zona «día» (10-11-2026): Plantilla, Asignación, Checklist y la casilla del
   checklist en el Inicio. API simulada; cada caso pone encima las rutas que necesita. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const hojaDe = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/* ── D1 · Plantilla: el borrador compartido ya no se borra sin preguntar ── */
test.describe('Plantilla · borrador compartido', () => {
  const FILA = { ruta: 'CA_A1', conductor: 'ANA PÉREZ', movil: '', furgo: '', h_llegada: '', h_bajada: '', h_salida: '', observaciones: '' }
  const borrador = (fecha) => ({ id: 'b1', revision: 1, updated_by: 'María', state: { week: '46', date: fecha, rows: [FILA] } })

  async function abrir(page, fecha, alBorrar) {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const borrados = []
    await page.route(/\/api\/tools\/plantilla-compartida/, (route) => {
      const req = route.request()
      if (req.method() === 'DELETE') {
        const url = new URL(req.url())
        borrados.push(url.searchParams.get('preguntar') || '')
        return json(alBorrar(url))(route)
      }
      if (req.method() === 'PATCH') return json({ revision: 2, updated_by: 'Admin Test' })(route)
      return json(borrador(fecha))(route)
    })
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue(fecha, { timeout: 15000 })
    return borrados
  }

  test('si otra persona la está editando, pregunta con su nombre antes de borrarla para todos', async ({ page }) => {
    const fallos = vigilar(page)
    const borrados = await abrir(page, hojaDe(new Date()), (url) => (url.searchParams.get('preguntar')
      ? { ok: false, editando: { nombre: 'María', minutos: 3 } } : { ok: true }))
    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toBe('La está editando María (último cambio hace 3 min). ¿Borrarla para todos?')
    // Dijo que no: la hoja sigue y no se ha borrado nada.
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toBeVisible()
    expect(borrados).toEqual(['1'])

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(borrados).toEqual(['1', '1', ''])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('si nadie más la está editando, se borra sin preguntar', async ({ page }) => {
    const borrados = await abrir(page, hojaDe(new Date()), () => ({ ok: true }))
    let dialogo = false
    page.on('dialog', (d) => { dialogo = true; d.dismiss() })
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(dialogo).toBe(false)
    expect(borrados).toEqual(['1'])
  })

  test('al entrar solo en la hoja de otro día avisa, y se puede seguir con ella o empezar la de hoy', async ({ page }) => {
    const borrados = await abrir(page, '30/09/2026', () => ({ ok: true }))
    const aviso = page.getByText('Esta hoja es del 30/09')
    await expect(aviso).toBeVisible()
    await page.getByRole('button', { name: 'Seguir con ella' }).click()
    await expect(aviso).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue('30/09/2026')
    expect(borrados).toEqual([])
  })

  test('«Empezar la de hoy» cierra la hoja vieja', async ({ page }) => {
    const borrados = await abrir(page, '30/09/2026', () => ({ ok: true }))
    await page.getByRole('button', { name: 'Empezar la de hoy' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(borrados).toEqual(['1'])
  })

  test('la hoja de hoy o la de mañana no avisa', async ({ page }) => {
    const manana = new Date(); manana.setDate(manana.getDate() + 1)
    await abrir(page, hojaDe(manana), () => ({ ok: true }))
    await expect(page.getByRole('button', { name: 'Nueva plantilla' })).toBeVisible()
    await expect(page.getByText(/Esta hoja es del/)).toHaveCount(0)
  })
})

/* ── D2, D3 y D4 · Asignación ── */
test.describe('Asignación · cambios sin guardar, borrar fila y furgonetas en taller', () => {
  const hoy = iso(new Date())
  const ayer = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - 1); return iso(d) })()
  const VEHICULOS = [
    { id: 'v1', license_plate: '1234 ABC', status: 'active', center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v2', license_plate: '5678 DEF', status: 'taller', center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v3', license_plate: '9012 GHI', status: 'active', bloqueada: true, center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v4', license_plate: '3456 JKL', status: 'active', center: 'NORTE', itv_date: '2030-01-01' },
  ]
  const DRIVERS = [{ id: 'd1', name: 'Ana López', center: 'NORTE' }, { id: 'd2', name: 'Luis Gómez', center: 'NORTE' }]

  async function abrir(page, { centros = ['NORTE'] } = {}) {
    await entrarComoAdmin(page, { centros })
    await simularApi(page, 'vacio')
    const guardados = []
    await page.route(/\/api\/vehicles(\?|$)/, json(VEHICULOS))
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    await page.route(/\/api\/assignments\/daily/, (route) => {
      const req = route.request()
      if (req.method() === 'PUT') { guardados.push(req.postDataJSON()); return json({ ok: true })(route) }
      const fecha = new URL(req.url()).searchParams.get('date')
      return json({ date: fecha, slots: fecha === ayer
        ? [{ vehicle_id: 'v3', vehicle_plate: '9012 GHI', driver_id: 'd2', driver_name: 'Luis Gómez' }]
        : [{ vehicle_id: 'v1', vehicle_plate: '1234 ABC', driver_id: 'd1', driver_name: 'Ana López' }] })(route)
    })
    await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(1, { timeout: 15000 })
    return guardados
  }
  const matriculas = (page) => page.locator('select').filter({ has: page.locator('option', { hasText: '1234 ABC' }) })

  test('las de taller o con candado van al final, marcadas, y avisan arriba (también tras «Copiar ayer»)', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page)
    const opciones = await matriculas(page).first().locator('option').allTextContents()
    expect(opciones.slice(1)).toEqual(['1234 ABC', '3456 JKL', '5678 DEF (Taller)', '9012 GHI (Bloqueada)'])
    await expect(page.getByText('Asignadas pero en taller o bloqueadas:')).toHaveCount(0)

    await matriculas(page).first().selectOption('v2')
    await expect(page.getByRole('alert').filter({ hasText: 'Asignadas pero en taller o bloqueadas:' })).toContainText('5678 DEF (Taller)')

    await page.getByRole('button', { name: 'Copiar ayer' }).first().click()
    await expect(page.getByRole('alert').filter({ hasText: 'Asignadas pero en taller o bloqueadas:' })).toContainText('9012 GHI (Bloqueada)')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el botón de quitar fila se ve en el móvil y pide confirmar si la fila tiene datos', async ({ page, isMobile }) => {
    await abrir(page)
    const quitar = page.getByRole('button', { name: 'Quitar fila' })
    // En el móvil (sin ratón, pantalla estrecha) se ve siempre; con ratón, al pasar por encima.
    if (isMobile) await expect(quitar.first()).toHaveCSS('opacity', '1')
    else await expect(quitar.first()).toHaveCSS('opacity', '0')

    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await quitar.first().click()
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toBe('¿Quitar la fila de 1234 ABC · Ana López?')
    await expect(quitar).toHaveCount(1)

    // Una fila vacía se quita sin preguntar.
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(quitar).toHaveCount(2)
    let otro = false
    page.on('dialog', (d) => { otro = true; d.dismiss() })
    await quitar.last().click()
    await expect(quitar).toHaveCount(1)
    expect(otro).toBe(false)
  })

  test('marca «Cambios sin guardar» y pregunta antes de cambiar de día', async ({ page }) => {
    const guardados = await abrir(page)
    const marca = page.getByText('Cambios sin guardar')
    await expect(marca).toHaveCount(0)
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(marca).toBeVisible()

    const fecha = page.locator('input[type="date"]')
    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await fecha.fill(ayer)
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toContain('Hay cambios sin guardar')
    await expect(fecha).toHaveValue(hoy)
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(2)
    await expect(marca).toBeVisible()

    // Guardar quita la marca y ya no pregunta.
    await page.getByRole('button', { name: 'Guardar cuadrante' }).click()
    await expect(marca).toHaveCount(0)
    expect(guardados).toHaveLength(1)
    let otro = false
    page.on('dialog', (d) => { otro = true; d.accept() })
    await fecha.fill(ayer)
    await expect(matriculas(page).first()).toHaveValue('v3')   // la de ayer, ya cargada
    expect(otro).toBe(false)
  })

  test('pregunta antes de cambiar de nave y, si dice que no, se queda en la suya con lo que había', async ({ page }) => {
    await abrir(page, { centros: ['NORTE', 'SUR'] })
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()
    const titulo = page.getByRole('heading', { level: 1 })
    await expect(titulo).toContainText('NORTE')

    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect.poll(() => dialogos.length).toBe(1)
    await expect(titulo).toContainText('NORTE')
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(2)
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(titulo).toContainText('SUR')
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(1)
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0)
  })
})

/* ── D5 · Checklist: «Enviar cierre» manda la nave ── */
test('Checklist · «Enviar cierre» pide solo el de su nave', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const turno = (shift) => ({ id: shift, center: 'NORTE', shift, items: [{ id: 't1', text: 'Abrir nave', done: true }, { id: 't2', text: 'Llaves', done: false }] })
  await page.route(/\/api\/checklist(\?|$)/, json({ manana: turno('manana'), tarde: turno('tarde') }))
  const pedidos = []
  await page.route(/\/api\/checklist\/enviar-resumen/, (route) => {
    pedidos.push(route.request().postDataJSON())
    return json({ enviados: [{ center: 'NORTE', hechas: 1, total: 2, faltan: 1 }] })(route)
  })
  await page.goto('/panel/checklist-operativo', { waitUntil: 'domcontentloaded' })
  const mensajes = []
  page.on('dialog', (d) => { mensajes.push(d.message()); d.accept() })
  await page.getByRole('button', { name: 'Enviar cierre' }).click({ timeout: 15000 })
  await expect.poll(() => mensajes.length).toBe(1)
  expect(pedidos).toHaveLength(1)
  expect(pedidos[0]).toMatchObject({ shift: 'manana', center: 'NORTE' })
  expect(mensajes[0]).toContain('Resumen enviado: NORTE 1/2')
})

/* ── D6 · Inicio: la casilla del checklist enseña el turno que toca ── */
test.describe('Inicio · casilla del checklist', () => {
  async function abrirA(page, hora) {
    const d = new Date(); d.setHours(hora, 0, 0, 0)
    await page.clock.setFixedTime(d)
    await entrarComoAdmin(page)
    await simularApi(page, 'lleno')
    await page.route(/\/api\/stats\/hoy/, json({
      dia: iso(d), salidas: { total: 0, revisadas: 0, lista: [] }, revision: { hechas: 0, flota: 2 },
      checklist: [{ turno: 'manana', hechas: 5, total: 7 }, { turno: 'tarde', hechas: 1, total: 4 }],
      golpes: { n: 0, lista: [] }, incidencias: { nuevas: 0, graves: 0 },
    }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    return page.getByRole('button', { name: /Checklist turno/ })
  }

  test('por la tarde enseña el turno de tarde', async ({ page }) => {
    const casilla = await abrirA(page, 17)
    await expect(casilla).toContainText('1/4', { timeout: 15000 })
  })

  test('por la mañana, el de mañana', async ({ page }) => {
    const casilla = await abrirA(page, 9)
    await expect(casilla).toContainText('5/7', { timeout: 15000 })
  })
})
