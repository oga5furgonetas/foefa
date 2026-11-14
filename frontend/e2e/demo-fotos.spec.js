/* global process */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA DEMO DEL PANEL, CON FOTOS (14-11-2026). La página de venta promete «cada conductor revisa su furgoneta con fotos; si
   aparece un golpe, sabes qué día fue y quién la llevaba», y la demo sembraba las inspecciones sin fotos. Aquí se abre la
   Revisión rápida con UNA inspección con la forma exacta que siembra ahora `_seed_demo_data` (backend/server.py: la
   «demo-i0-0», con su golpe en la puerta lateral derecha) y se mide que la foto carga y que la marca del golpe cae
   dentro de la foto. La URL es absoluta con el origen de la web, como la monta el servidor con PUBLIC_BASE_URL_FRONT. */
const CARPETA = process.env.CAPTURAS_DEMO_FOTOS || ''

// Los golpes como los siembra `sitio_golpe` en `_seed_demo_data`: (foto 1-based, zona, caja 0-1000).
const SITIO = {
  'puerta lateral derecha': [1, 'lateral_derecho', [590, 500, 700, 600]],
  'aleta delantera izquierda': [2, 'lateral_izquierdo', [485, 505, 578, 562]],
}

const inspeccionDemo = (origen, { id = 'demo-i0-0', pieza = 'puerta lateral derecha', vehiculo = 'demo-v0' } = {}) => {
  const [photo_index, location_hint, box_2d] = SITIO[pieza]
  const golpe = {
    part: pieza, severity: 'leve', description: 'Rozadura visible en el panel', estimated_cost: 90,
    confirmed: true, confidence: 0.9, photo_index, location_hint, box_2d,
  }
  return {
    id, vehicle_id: vehiculo, driver_id: 'demo-d0', center: 'MADRID',
    photos: [`${origen}/demo/van-lateral.jpg`, `${origen}/demo/van-frontal.jpg`], annotated_photos: [], notes: '',
    analysis_status: 'ok', created_at: new Date(Date.now() - 25 * 60000).toISOString(), reviewed: true,
    analysis: {
      severity: 'leve', urgency: 'puede_esperar', risk: 'bajo', circulation_safe: true, critical_damages_count: 0,
      total_damages_count: 1, total_estimated_cost: 90, confidence: 90, executive_summary: 'Inspección de demostración.',
      damages: [golpe], new_damages: [golpe], affected_parts: [pieza], image_quality_warnings: [],
      critical_damages: [],
    },
  }
}

// Lo que devuelve `/inspections/review-queue` para esa inspección (mismos campos que arma el servidor).
const enCola = (i) => ({
  id: i.id, created_at: i.created_at, vehicle_id: i.vehicle_id, license_plate: '1000 BCD', vehicle_label: 'Toyota Proace',
  driver_name: 'Carlos Ruiz', center: 'MADRID', photos: i.photos, analysis_status: 'ok', severity: i.analysis.severity,
  total_damages_count: 1, executive_summary: i.analysis.executive_summary,
  new_damages: i.analysis.new_damages.map(({ part, severity, description, location_hint, photo_index, box_2d }) =>
    ({ part, severity, description, location_hint, photo_index, box_2d })),
  new_damages_count: 1, has_reference: false, annotated_photos: [], detected_plate: '', plate_mismatch: false,
  image_quality_warnings: [], dirt_level: null,
})

test('Demo con fotos · la Revisión rápida enseña la foto y el golpe marcado encima', async ({ page, baseURL }, info) => {
  const insp = inspeccionDemo(baseURL)
  await entrarComoAdmin(page, { centros: ['MADRID'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/inspections\/review-queue/, (r) => r.fulfill({ json: [enCola(insp)] }))
  await page.route(/\/api\/inspections\/demo-i0-0$/, (r) => r.fulfill({ json: insp }))
  await page.goto('/panel/revision', { waitUntil: 'domcontentloaded' })

  const foto = page.locator(`img[src="${insp.photos[0]}"]`).first()
  // Margen para la PRIMERA carga (la pantalla va en un trozo aparte): con el PC cargado no llegaba en 8 s.
  await expect(foto).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => foto.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0)

  const marca = page.locator('div.border-orange-400', { hasText: 'puerta lateral derecha' })
  await expect(marca).toBeVisible()
  const f = await foto.boundingBox()
  const m = await marca.boundingBox()
  expect(m.x).toBeGreaterThanOrEqual(f.x - 1)
  expect(m.y).toBeGreaterThanOrEqual(f.y - 1)
  expect(m.x + m.width).toBeLessThanOrEqual(f.x + f.width + 1)
  expect(m.y + m.height).toBeLessThanOrEqual(f.y + f.height + 1)
  // Y en su sitio: la caja es [590, 500, 700, 600] en 0-1000 de la foto.
  expect(Math.abs((m.x - f.x) / f.width - 0.5)).toBeLessThan(0.02)
  expect(Math.abs((m.y - f.y) / f.height - 0.59)).toBeLessThan(0.02)

  // La segunda foto (la frontal) también carga, en la tira de miniaturas.
  const mini = page.locator(`img[src="${insp.photos[1]}"]`).first()
  await expect.poll(() => mini.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0)

  await foto.scrollIntoViewIfNeeded()
  if (CARPETA) await page.screenshot({ path: `${CARPETA}/r2-revision-${info.project.name}.png`, fullPage: false })
})

/* LO QUE VE QUIEN ABRE LA DEMO (14-11-2026). La Revisión rápida de la demo real sale VACÍA: todas sus inspecciones van
   `reviewed: True`. Donde el visitante ve la foto y la caja es en el detalle de una inspección, en /panel/inspecciones.
   Se abren dos, con la forma exacta que siembra el servidor: la puerta (foto 1, la lateral) y la aleta (foto 2, la
   frontal), y en cada una se mide que la foto carga y que la caja cae dentro y en su sitio. */
const PANEL = 'div.fixed.inset-0.z-40'   // el detalle de la inspección (Detail, Inspecciones.jsx)

async function cajaEnSuSitio(page, url, caja) {
  const panel = page.locator(PANEL)
  const foto = panel.locator(`img[class="w-full"][src="${url}"]`)
  await expect(foto).toBeVisible()
  await expect.poll(() => foto.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
  const marca = panel.locator('div.border-orange-400.absolute')
  await expect(marca).toHaveCount(1)
  const f = await foto.boundingBox()
  const m = await marca.boundingBox()
  expect(m.x).toBeGreaterThanOrEqual(f.x - 1)
  expect(m.y).toBeGreaterThanOrEqual(f.y - 1)
  expect(m.x + m.width).toBeLessThanOrEqual(f.x + f.width + 1)
  expect(m.y + m.height).toBeLessThanOrEqual(f.y + f.height + 1)
  const [y0, x0, y1, x1] = caja
  expect(Math.abs((m.x - f.x) / f.width - x0 / 1000)).toBeLessThan(0.02)
  expect(Math.abs((m.y - f.y) / f.height - y0 / 1000)).toBeLessThan(0.02)
  expect(Math.abs(m.width / f.width - (x1 - x0) / 1000)).toBeLessThan(0.02)
  expect(Math.abs(m.height / f.height - (y1 - y0) / 1000)).toBeLessThan(0.02)
}

test('Demo con fotos · el detalle de una inspección enseña la foto y la caja del golpe en su sitio', async ({ page, baseURL }, info) => {
  const puerta = inspeccionDemo(baseURL)
  const aleta = inspeccionDemo(baseURL, { id: 'demo-i3-3', pieza: 'aleta delantera izquierda', vehiculo: 'demo-v1' })
  await entrarComoAdmin(page, { centros: ['MADRID'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/inspections(\?|$)/, (r) => r.fulfill({ json: [puerta, aleta] }))
  await page.route(/\/api\/inspections\/demo-i\d-\d$/, (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop()
    return r.fulfill({ json: id === aleta.id ? aleta : puerta })
  })
  await page.route(/\/api\/vehicles(\?|$)/, (r) => r.fulfill({ json: [
    { id: 'demo-v0', license_plate: '1000 BCD', center: 'MADRID', status: 'activo' },
    { id: 'demo-v1', license_plate: '1001 BCD', center: 'MADRID', status: 'activo' },
  ] }))
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: [{ id: 'demo-d0', name: 'Carlos Ruiz' }] }))
  await page.goto('/panel/inspecciones', { waitUntil: 'domcontentloaded' })

  // La puerta: foto 1 (la lateral).
  await page.getByRole('button', { name: /1000\s*BCD/ }).click()
  await cajaEnSuSitio(page, puerta.photos[0], SITIO['puerta lateral derecha'][2])
  if (CARPETA) await page.screenshot({ path: `${CARPETA}/r2-inspeccion-puerta-${info.project.name}.png`, fullPage: false })
  // En la otra foto de esa inspección no hay caja: el golpe no está ahí.
  await page.locator(`${PANEL} button.shrink-0`).nth(1).click()
  await expect(page.locator(`${PANEL} img[class="w-full"]`)).toHaveAttribute('src', puerta.photos[1])
  await expect(page.locator(`${PANEL} div.border-orange-400.absolute`)).toHaveCount(0)
  await page.locator(`${PANEL} button.btn-ghost`).first().click()
  await expect(page.locator(PANEL)).toHaveCount(0)

  // La aleta: foto 2 (la frontal). Abre en la 1, sin caja; en la 2, la caja.
  await page.getByRole('button', { name: /1001\s*BCD/ }).click()
  await expect(page.locator(`${PANEL} div.border-orange-400.absolute`)).toHaveCount(0)
  await page.locator(`${PANEL} button.shrink-0`).nth(1).click()
  await cajaEnSuSitio(page, aleta.photos[1], SITIO['aleta delantera izquierda'][2])
  if (CARPETA) await page.screenshot({ path: `${CARPETA}/r2-inspeccion-aleta-${info.project.name}.png`, fullPage: false })
})
