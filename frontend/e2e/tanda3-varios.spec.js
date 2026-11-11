import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* Tanda 3, zona «varios» (11-11-2026), historia-5: «Mi día» avisa de los próximos días (hoy, mañana y pasado) que no
   llegan a la máxima de conductores, con un enlace a Turnos → Refuerzos (sin botón de pedir), y cuando falta la
   Asignación diaria dice «Falta la asignación de hoy» en vez de «No hay cuadrante de hoy».

   API simulada. El reloj del navegador está fijo (page.clock) y las fechas de la respuesta salen de él: nada depende
   del día en que se pase la prueba. */

const json = (body, status = 200) => (route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Jueves, 9:00 en la hora del equipo. En el PASADO a propósito: la sesión simulada caduca una hora después del reloj
// de verdad, y con el del navegador por delante el panel la daría por cerrada.
const AHORA = new Date(2026, 9, 15, 9, 0, 0)
const dentroDe = (n) => { const d = new Date(AHORA); d.setDate(d.getDate() + n); return iso(d) }
const HOY = iso(AHORA)

// Una asignación con todo hecho: sin las faltas, «Mi día» diría «todo en orden».
const SLOTS = [{ driver_id: 'd1', driver_name: 'Ana López', vehicle_id: 'v1', vehicle_plate: '1234 ABC' }]
const INSPS = [{ id: 'i1', driver_id: 'd1', vehicle_id: 'v1', created_at: `${HOY}T07:30:00`, analysis: { new_damages: [] } }]

const falta = (n, extra = {}) => ({
  date: dentroDe(n), dia: `día ${dentroDe(n).slice(8)}`, maximo: 20, en_ruta: 15, bajan: 2, falta: 3, pueden: 2,
  refuerzo: null, ...extra,
})

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/** Abre «Mi día» de OGA5 con la asignación hecha y lo que diga `faltas` (una función de ruta). Devuelve las
 *  direcciones con las que se pidió /refuerzos/faltas. */
async function abrir(page, { faltas, slots = SLOTS, permisos } = {}) {
  await page.clock.setFixedTime(AHORA)
  await entrarComoAdmin(page, { centros: ['OGA5'] })
  if (permisos) {
    await page.addInitScript((p) => {
      const a = JSON.parse(localStorage.getItem('flota_admin'))
      localStorage.setItem('flota_admin', JSON.stringify({ ...a, permissions: p }))
    }, permisos)
  }
  await simularApi(page, 'vacio')
  await page.route(/\/api\/assignments\/daily/, json({ date: HOY, slots }))
  await page.route(/\/api\/inspections(\?|$)/, json(INSPS))
  const pedidas = []
  await page.route(/\/api\/refuerzos\/faltas/, (route) => {
    pedidas.push(route.request().url())
    return (faltas || json({ faltas: [], con_maximas: true, dias: 3 }))(route)
  })
  await page.goto('/panel/mi-dia', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main h1').first()).toHaveText('Mi día', { timeout: 30000 })
  // Lo último que pinta la pantalla al cargar es la rejilla de abajo («Furgonetas sin conductor»).
  await expect(page.getByText('Furgonetas sin conductor')).toBeVisible({ timeout: 30000 })
  return pedidas
}

test.describe('historia-5 · «Mi día» avisa de los días que no llegan a la máxima', () => {
  test('sin faltas: «todo en orden» y ninguna tarjeta (el control)', async ({ page }) => {
    const fallos = vigilar(page)
    const pedidas = await abrir(page)
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    // Solo se piden los 3 días que se enseñan.
    expect(pedidas.length).toBeGreaterThan(0)
    expect(new URL(pedidas[0]).searchParams.get('dias')).toBe('3')
    expect(new URL(pedidas[0]).searchParams.get('center')).toBe('OGA5')
    expect(fallos).toEqual([])
  })

  test('con faltas mañana: la tarjeta lo dice, no hay «todo en orden» y lleva a Refuerzos', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { faltas: json({ faltas: [falta(1), falta(5)], con_maximas: true, dias: 3 }) })
    const tarjeta = page.getByTestId('midia-faltan')
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('Faltan conductores')
    // Solo hasta pasado mañana: el día de dentro de 5 no sale.
    await expect(tarjeta.getByTestId('midia-falta')).toHaveCount(1)
    const fila = tarjeta.getByTestId('midia-falta').first()
    await expect(fila).toContainText(`día ${dentroDe(1).slice(8)}`)
    await expect(fila).toContainText('máxima 20 · en ruta 15 (+2 de otros centros)')
    await expect(fila).toContainText('faltan 3')
    await expect(fila).toContainText('2 pueden apuntarse')
    await expect(tarjeta).toContainText('Pídelos en Turnos → Refuerzos')
    // Ni botón de pedir dentro: solo el enlace.
    await expect(tarjeta.getByRole('button')).toHaveCount(0)
    await expect(page.getByText(/^Todo en orden/)).toHaveCount(0)
    await expect(tarjeta).toHaveAttribute('href', '/panel/turnos?vista=refuerzos&centro=OGA5')

    await tarjeta.click()
    await expect(page).toHaveURL(/\/panel\/turnos\?vista=refuerzos$/, { timeout: 30000 })
    await expect(page.getByTestId('pestanas-dias').getByRole('button', { name: /^Refuerzos/ }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(fallos).toEqual([])
  })

  test('con un refuerzo ya pedido dice cuántos van aprobados y no manda pedirlo', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [
      falta(0, { bajan: 0, refuerzo: { id: 'r1', plazas: 3, estado: 'abierto', auto: false, aprobados: 1 } }),
      falta(2, { pueden: 0, refuerzo: { id: 'r2', plazas: 3, estado: 'abierto', auto: false, aprobados: 0 } }),
    ], con_maximas: true, dias: 3 }) })
    const filas = page.getByTestId('midia-falta')
    await expect(filas).toHaveCount(2)
    await expect(filas.nth(0)).toContainText('Pedido: 1/3 aprobados')
    await expect(filas.nth(0)).not.toContainText('otros centros')
    await expect(filas.nth(1)).toContainText('Pedido: 0/3 aprobados')
    await expect(page.getByTestId('midia-faltan')).not.toContainText('Pídelos')
  })

  test('nadie puede apuntarse: lo dice', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [falta(1, { pueden: 0 })], con_maximas: true, dias: 3 }) })
    await expect(page.getByTestId('midia-falta').first()).toContainText('nadie puede apuntarse')
  })

  test('sin máximas puestas no sale nada, aunque vinieran filas', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [falta(1)], con_maximas: false, dias: 3 }) })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
  })

  test('si el servidor contesta 400 (o no lo conoce), la pantalla carga igual que antes', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { faltas: json({ detail: 'Elige un centro: las máximas son por nave' }, 400) })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    await expect(page.getByText('Elige un centro: las máximas')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('quien no ve Turnos no lo pide ni ve la tarjeta', async ({ page }) => {
    const pedidas = await abrir(page, {
      permisos: ['mi-dia', 'dashboard'],
      faltas: json({ faltas: [falta(1)], con_maximas: true, dias: 3 }),
    })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    expect(pedidas).toEqual([])
  })

  test('sin asignación de hoy dice «Falta la asignación de hoy», no «cuadrante»', async ({ page }) => {
    await abrir(page, { slots: [] })
    await expect(page.getByText('Falta la asignación de hoy').first()).toBeVisible()
    await expect(page.getByText(/Sin la asignación no se sabe quién sale/)).toBeVisible()
    await expect(page.getByText(/No hay cuadrante/)).toHaveCount(0)
    await expect(page.getByText(/^Todo en orden/)).toHaveCount(0)
  })
})
