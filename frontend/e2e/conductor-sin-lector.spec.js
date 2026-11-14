/* global process */
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA REVISIÓN DEL CONDUCTOR EN UNA CUENTA SIN LECTURA AUTOMÁTICA (14-11-2026, «Antes del perito», CONTRATO §D).
   Las empresas nuevas no tienen la IA: el servidor contesta al cuentakilómetros con `sin_lector: true` (y los km a
   mano entre manual_min y manual_max), y a cada foto con `checked: false`. La pantalla (pages/driver/InspectionFlow.jsx)
   tiene que pedir los km con naturalidad, sin presentarlo como un fallo, y no decir que nadie ha revisado una foto.
   Las respuestas simuladas son copia literal de las de server.py (read_odometer_photo y validate_inspection_photo). */

const FOTO = 'e2e/fixtures/ticket.png'
const VEHICULO = { id: 'v1', license_plate: '1234 ABC', brand: 'Toyota', model: 'Proace' }
const SIN_LECTOR = {
  aceptada: false, km: null, confianza: 0.0, current_mileage: 48210, manual_permitido: true,
  manual_min: 48210, manual_max: 48710, dias: 1, motivo: 'Escribe los kilómetros que marca el cuadro.',
  servicio_caido: true, sin_lector: true,
}

async function abrirRevision(page, { odometro, validar = { valid: true, checked: false }, ficha = {}, pedidas = null }) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA L.', center: 'NORTE' }))
    localStorage.setItem('flota_lang', 'es')
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/vehicles\/portal/, (r) => r.fulfill({ json: { vehicles: [VEHICULO], puede_auditar: true, motivo: null } }))
  await page.route(/\/api\/auth\/me\/assigned-vehicle/, (r) => r.fulfill({ json: ficha }))
  await page.route(/\/api\/inspections\/validate-photo/, (r) => { pedidas?.push('validar'); return r.fulfill({ json: validar }) })
  await page.route(/\/api\/vehicles\/v1\/odometer-photo/, (r) => { pedidas?.push('cuentakilometros'); return r.fulfill({ json: odometro }) })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Hacer la auditoría/ }).click()
  await page.getByRole('button', { name: /1234 ABC/ }).click()
  await expect(page.locator('input[type=file]')).toHaveCount(6)
}

// Lo que saca la pantalla: los avisos flotantes y todo el texto visible, juntos.
const textoVisible = (page) => page.locator('body').innerText()

test('sin lector: pide los km del cuadro sin hablar de errores, del lector ni de la IA, y los acepta dentro del tope', async ({ page }) => {
  await abrirRevision(page, { odometro: SIN_LECTOR })
  // La foto del cuentakilómetros es la quinta (las cuatro de los lados van antes).
  await page.locator('input[type=file]').nth(4).setInputFiles(FOTO)
  const aviso = page.getByTestId('odo-aviso')
  await expect(aviso).toContainText('Escribe los kilómetros que marca el cuadro.')
  await expect(aviso).toContainText('Esta furgoneta tenía 48.210 km')
  await expect(aviso).not.toContainText('O escribe los km a mano')
  await expect(page.getByText('Escribe los km abajo')).toBeVisible()
  // Ni toast de fallo, ni «lector», ni «error», ni «IA» en lo que sale tras la foto del cuadro.
  await page.waitForTimeout(400)
  const texto = await textoVisible(page)
  expect(texto).not.toMatch(/Lector no disponible|no se han podido leer|km sin leer/)
  expect(await aviso.innerText()).not.toMatch(/\berror\b|lector|\bIA\b/i)
  // Los km a mano, dentro del tope del servidor.
  const campo = aviso.locator('input')
  await campo.fill('48300')
  await expect(aviso).toContainText('48.300 km — listo para enviar')
  await expect(page.getByText('48.300 km', { exact: true })).toBeVisible()
  // Fuera del tope, lo dice.
  await campo.fill('40000')
  await expect(aviso).toContainText('No puede ser menor que los 48.210 km')
  await campo.fill('48300')
  if (process.env.FOTOS_CONDUCTOR) {
    await aviso.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${process.env.FOTOS_CONDUCTOR}/sin-lector-${test.info().project.name}.png` })
  }
})

test('control: con el lector de las cuentas que lo tienen, una lectura fallida sigue avisando como antes', async ({ page }) => {
  await abrirRevision(page, { odometro: { ...SIN_LECTOR, sin_lector: undefined, motivo: 'El lector no está disponible ahora.' } })
  await page.locator('input[type=file]').nth(4).setInputFiles(FOTO)
  await expect(page.getByText('Lector no disponible — pon los km a mano')).toBeVisible()
  await expect(page.getByTestId('odo-aviso')).toContainText('O escribe los km a mano')
})

test('una foto que nadie ha revisado (checked: false) no se da por revisada', async ({ page }) => {
  await abrirRevision(page, { odometro: SIN_LECTOR })
  await page.locator('input[type=file]').nth(0).setInputFiles(FOTO)
  await expect(page.getByText('📷 Foto capturada')).toBeVisible()
  await expect(page.getByText('Foto revisada')).toHaveCount(0)
})

test('control: una foto revisada de verdad (checked: true) sí lo dice', async ({ page }) => {
  await abrirRevision(page, { odometro: SIN_LECTOR, validar: { valid: true, checked: true, detected_plate: '1234ABC' } })
  await page.locator('input[type=file]').nth(0).setInputFiles(FOTO)
  await expect(page.getByText('✅ Foto revisada')).toBeVisible()
})

/* ── UNA EMPRESA SIN LECTOR AUTOMÁTICO (tercera tanda, A10 / CONTRATO R9) ─────────────────────────────────────────
   La ficha del portal (GET /auth/me/assigned-vehicle) lo dice con `sin_ia: true`, con furgoneta asignada o sin ella.
   Entonces la revisión no nombra la IA en ningún momento (ni antes, ni mientras sube cada foto), no pregunta a nadie
   por las fotos ni por los km, pide los km a mano desde el principio y dice «Foto guardada». La revisión del panel2
   (hallazgo 1, dado la vuelta) veía «LA IA LEE LOS KM AUTOMÁTICAMENTE», «Verificando IA…» y «La IA está leyendo…». */
const SIN_IA = { assigned: false, vehicle: null, sin_ia: true }
const TEXTOS_IA = /\bIA\b|Verificando|leyendo|automátic|lector|Foto revisada|Foto capturada/i

for (const [nombre, ficha] of [['sin furgoneta asignada', SIN_IA],
  ['con su furgoneta de hoy', { assigned: true, vehicle: { ...VEHICULO, mileage: 48210 }, center: 'NORTE', already_inspected: false, sin_ia: true }]]) {
  test(`sin IA (${nombre}): ni una palabra de la IA, ninguna lectura, los km a mano desde el principio`, async ({ page }, info) => {
    if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
    const pedidas = []
    // Con la foto tardando, para ver qué dice MIENTRAS (antes salía «Verificando IA…»).
    await abrirRevision(page, { odometro: SIN_LECTOR, ficha, pedidas })
    // Antes de hacer nada: ni «la IA lee los km», y el campo de los km ya está.
    expect(await textoVisible(page)).not.toMatch(TEXTOS_IA)
    const aMano = page.getByTestId('odo-a-mano')
    await expect(aMano).toContainText('Escribe los kilómetros que marca el cuadro.')
    if (ficha.vehicle) await expect(aMano).toContainText('La última vez marcaba 48.210 km.')
    if (process.env.FOTOS_CONDUCTOR) await page.screenshot({ path: `${process.env.FOTOS_CONDUCTOR}/sin-ia-antes-${info.project.name}.png`, fullPage: true })
    // Las cuatro fotos y la del cuadro: guardadas sin preguntar a nadie.
    for (let i = 0; i < 4; i++) {
      await page.locator('input[type=file]').nth(i).setInputFiles(FOTO)
      await expect(page.getByText('Foto guardada').first()).toBeVisible()
      expect(await textoVisible(page)).not.toMatch(TEXTOS_IA)
    }
    await page.locator('input[type=file]').nth(4).setInputFiles(FOTO)
    await expect(page.getByText('Escribe los km abajo')).toBeVisible()
    expect(await textoVisible(page)).not.toMatch(TEXTOS_IA)
    expect(pedidas).toEqual([])
    // Los km, y el depósito: ya se puede seguir.
    await aMano.locator('input').fill('48300')
    await expect(page.getByText('48.300 km', { exact: true })).toBeVisible()
    await page.locator('input[type=file]').nth(5).setInputFiles(FOTO)
    await page.getByRole('button', { name: '½' }).click()
    await expect(page.getByRole('button', { name: /Continuar al checklist/ })).toBeVisible()
    if (process.env.FOTOS_CONDUCTOR) await page.screenshot({ path: `${process.env.FOTOS_CONDUCTOR}/sin-ia-lista-${info.project.name}.png`, fullPage: true })
    expect(await textoVisible(page)).not.toMatch(TEXTOS_IA)
    expect(pedidas).toEqual([])
  })
}

test('sin IA: lo que se envía lleva los km a mano y la foto del cuadro', async ({ page }) => {
  await abrirRevision(page, { odometro: SIN_LECTOR, ficha: SIN_IA })
  const subidas = []
  await page.route(/\/api\/inspections\/upload/, (r) => {
    subidas.push(r.request().postData() || '')
    return r.fulfill({ json: { id: 'i9', analysis: null, analysis_status: 'sin_ia' } })
  })
  for (let i = 0; i < 6; i++) await page.locator('input[type=file]').nth(i).setInputFiles(FOTO)
  await page.getByTestId('odo-a-mano').locator('input').fill('48300')
  await page.getByRole('button', { name: '¾' }).click()
  await page.getByRole('button', { name: /Continuar al checklist/ }).click()
  await page.getByRole('button', { name: /Sí, la lleva/ }).click()
  await page.getByRole('button', { name: /Revisar y enviar/ }).click()
  await page.getByRole('button', { name: /Enviar inspección/ }).click()
  await expect.poll(() => subidas.length).toBe(1)
  expect(subidas[0]).toContain('"odometer_km":48300')
  expect(subidas[0]).toContain('"odometer_manual":true')
  expect(subidas[0]).toContain('filename="odometro.jpg"')
})

test('control: con `sin_ia: false` la revisión es la de siempre (pregunta por cada foto y lee el cuadro)', async ({ page }) => {
  const pedidas = []
  await abrirRevision(page, { odometro: SIN_LECTOR, ficha: { assigned: false, vehicle: null, sin_ia: false }, pedidas })
  await expect(page.getByText(/la IA lee los km automáticamente/i)).toBeVisible()
  await expect(page.getByTestId('odo-a-mano')).toHaveCount(0)
  await page.locator('input[type=file]').nth(0).setInputFiles(FOTO)
  await expect(page.getByText('📷 Foto capturada')).toBeVisible()
  await page.locator('input[type=file]').nth(4).setInputFiles(FOTO)
  await expect(page.getByTestId('odo-aviso')).toContainText('Escribe los kilómetros que marca el cuadro.')
  expect(pedidas).toEqual(['validar', 'cuentakilometros'])
})
