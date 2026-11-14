import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA GRAVEDAD Y LOS DAÑOS DE UNA REVISIÓN, CON EL REPASO (14-11-2026, lib/analisis.js). La IA dijo «sin daños» y una
   persona marcó en el Repaso un golpe GRAVE: el servidor deja `severity: sin_danos` y `total_damages_count: 0` (lo de la
   IA) y manda aparte `severidad_con_repaso: grave` y `total_con_repaso: 1` (CONTRATO M9, S14). Ninguna pantalla puede
   leer «Sin daños · 0 daños» de esa revisión: ni Inspecciones (lista y ficha), ni la línea de tiempo de la furgoneta,
   ni Actividad, ni Asignación. */

const HOY = new Date().toISOString().slice(0, 10)
const GOLPE_A_MANO = {
  part: 'Puerta lateral derecha', severity: 'grave', origen: 'human', golpe_id: 'g1', photo_index: 4,
  description: 'Bollo con la pintura saltada', box_2d: [400, 300, 600, 500],
}
const CON_REPASO = (id, hora) => ({
  id, vehicle_id: 'v1', driver_id: 'd1', driver_name: 'Ana López', created_at: `${HOY}T${hora}:00Z`,
  photos: [], analysis_status: 'ok', deleted: false,
  analysis: {
    severity: 'sin_danos', total_damages_count: 0, total_estimated_cost: 0, summary: 'Sin daños',
    damages: [GOLPE_A_MANO], new_damages: [],
    severidad_con_repaso: 'grave', total_con_repaso: 1,
  },
})
const INSP = CON_REPASO('i1', '08:30')

const json = (cuerpo) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) })

async function abrir(page, ruta) {
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  await page.route(/\/api\/inspections\/vehicle\/[^/?]+/, json([INSP, CON_REPASO('i0', '07:10')]))
  await page.route(/\/api\/inspections(\?|$)/, json([INSP]))
  await page.route(/\/api\/inspections\/i1(\?|$)/, json(INSP))
  await page.goto(ruta, { waitUntil: 'domcontentloaded' })
}

test('Inspecciones · la lista y la ficha dicen «Grave · 1 daño», no «Sin daños · 0 daños»', async ({ page }) => {
  await abrir(page, '/panel/inspecciones')
  const tarjeta = page.locator('button.card-hover').first()
  await expect(tarjeta).toContainText('Grave')
  await expect(tarjeta).toContainText('1 daño')
  await expect(tarjeta).not.toContainText('Sin daños')
  await expect(tarjeta).not.toContainText('0 daños')
  await tarjeta.click()
  const ficha = page.locator('div.fixed.inset-0').last()
  await expect(ficha).toContainText('1 daño')
  await expect(ficha).not.toContainText('0 daños')
  await expect(ficha.locator('span', { hasText: /^Grave$/ }).first()).toBeVisible()
})

test('Inspecciones · el filtro por gravedad la pone en «grave»', async ({ page }) => {
  await abrir(page, '/panel/inspecciones')
  await expect(page.locator('button.card-hover')).toHaveCount(1)
  await page.getByRole('button', { name: 'Sin daños', exact: true }).click()
  await expect(page.locator('button.card-hover')).toHaveCount(0)
  await page.getByRole('button', { name: 'Grave', exact: true }).click()
  await expect(page.locator('button.card-hover')).toHaveCount(1)
})

test('Actividad · la revisión sale como «Grave»', async ({ page }) => {
  await abrir(page, '/panel/actividad')
  const fila = page.locator('.card > div').filter({ hasText: '1234 ABC' }).first()
  await expect(fila).toContainText('Grave')
  await expect(fila).not.toContainText('Sin daños')
})

test('Furgonetas · el historial, la línea de tiempo y la lista de revisiones dicen «Grave»', async ({ page }) => {
  await abrir(page, '/panel/vehiculos')
  await page.getByText('1234 ABC').first().click()
  // El historial: «Inspección · Grave · …» en cada revisión.
  await page.getByRole('button', { name: 'Historial' }).click()
  await expect(page.getByText(/^Inspección · Grave · Ana López$/)).toHaveCount(2)
  await expect(page.getByText(/^Inspección · Sin daños/)).toHaveCount(0)
  // La pestaña de revisiones: la línea de tiempo (cada marca con la gravedad en su título) y cada fila con su etiqueta.
  await page.getByRole('button', { name: /^Inspecciones/ }).last().click()
  await expect(page.locator('[title*=" · Grave"]')).toHaveCount(2)
  await expect(page.locator('[title*=" · Sin daños"]')).toHaveCount(0)
  await expect(page.locator('button[aria-expanded]').filter({ hasText: 'Grave' })).toHaveCount(2)
  await expect(page.locator('button[aria-expanded]').filter({ hasText: 'Sin daños' })).toHaveCount(0)
})

test('Asignación · la etiqueta de la furgoneta revisada dice «Grave»', async ({ page }) => {
  await entrarComoAdmin(page, { centros: ['NORTE'] })
  await simularApi(page, 'lleno')
  await page.route(/\/api\/inspections(\?|$)/, json([INSP]))
  await page.route(/\/api\/assignments\/daily/, (route) => {
    if (route.request().method() === 'PUT') return json({ ok: true })(route)
    const fecha = new URL(route.request().url()).searchParams.get('date')
    return json({ date: fecha, slots: [{ vehicle_id: 'v1', vehicle_plate: '1234 ABC', driver_id: 'd1', driver_name: 'Ana López' }] })(route)
  })
  await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(1, { timeout: 45000 })
  await expect(page.locator('span.rounded-full', { hasText: 'Grave' }).first()).toBeVisible()
  await expect(page.locator('span.rounded-full', { hasText: 'Sin daños' })).toHaveCount(0)
})
