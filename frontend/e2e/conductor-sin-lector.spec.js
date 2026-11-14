/* global process */
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'
import { A } from '../src/lib/textosRutaA.js'

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
  await page.getByRole('button', { name: /Hacer la revisión/ }).click()
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
    /* Las cuatro fotos y la del cuadro: guardadas sin preguntar a nadie. Lo dice la casilla de cada foto, sin un aviso
       flotante por foto (14-11-2026: salían cuatro «Foto guardada» apilados): tantos «Foto guardada» como fotos. */
    for (let i = 0; i < 4; i++) {
      await page.locator('input[type=file]').nth(i).setInputFiles(FOTO)
      await expect(page.getByText(`${i + 1} / 6 fotos`)).toBeVisible()
      expect(await textoVisible(page)).not.toMatch(TEXTOS_IA)
    }
    await page.waitForTimeout(200)
    if (process.env.FOTOS_CONDUCTOR) await page.screenshot({ path: `${process.env.FOTOS_CONDUCTOR}/sin-ia-cuatro-fotos-${info.project.name}.png` })
    await expect(page.locator('[data-testid^="foto-guardada-"]')).toHaveCount(4)
    await expect(page.getByText('Foto guardada', { exact: true })).toHaveCount(4)
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
  await page.getByRole('button', { name: /Enviar revisión/ }).click()
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

/* ── TANDA 6 (14-11-2026): EL RECORRIDO ENTERO DEL CONDUCTOR, portal → revisión → final ────────────────────────────────
   1. En español no sale «Inspección» ni «auditoría» en ninguna pantalla (al acabar decía «Inspección enviada»).
   2. Con el teléfono en inglés o en alemán (el idioma del navegador, como lo tiene el conductor; nada guardado a mano) no
      queda ni una línea en español: cada línea de cada pantalla se compara con la misma pantalla en español.
   3. La fecha, como en el portal: «Sábado, 14 de noviembre» (solo la primera en mayúscula), y en su idioma.
   4. Sin el aviso «Próximamente: incentivos para conductores» (prometía algo que no existe). */
const LOCALES = { es: 'es-ES', en: 'en-GB', de: 'de-DE' }
const ORDEN_TX = ['en', 'pt', 'fr', 'it', 'de']
const txEn = (frase, l) => (l === 'es' ? frase : A[frase][ORDEN_TX.indexOf(l)])
const HOY = { ...VEHICULO, mileage: 48210 }

/* Hace la revisión entera en un teléfono con ese idioma y devuelve el texto de cada pantalla. `final`: 'saltar' (sigue sin
   firmar) o 'firmar'. */
async function recorrido(browser, info, l, final) {
  const ctx = await browser.newContext({ locale: LOCALES[l], viewport: { width: 390, height: 844 }, baseURL: info.project.use.baseURL })
  const page = await ctx.newPage()
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA L.', center: 'NORTE' }))
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/vehicles\/portal/, (r) => r.fulfill({ json: { vehicles: [HOY], puede_auditar: true, motivo: null } }))
  await page.route(/\/api\/auth\/me\/assigned-vehicle/, (r) => r.fulfill({ json: { assigned: true, vehicle: HOY, center: 'NORTE', already_inspected: false, sin_ia: true } }))
  await page.route(/\/api\/inspections\/upload/, (r) => r.fulfill({ json: { id: 'i9', analysis: null, analysis_status: 'sin_ia' } }))
  await page.route(/\/api\/inspections\/i9\/sign/, (r) => r.fulfill({ json: { hash: 'b'.repeat(64) } }))
  const pantallas = {}
  const leer = async (nombre) => { await page.waitForTimeout(250); pantallas[nombre] = await page.locator('body').innerText() }

  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  const hacer = page.getByRole('button', { name: new RegExp(txEn('Hacer la revisión', l)) })
  await expect(hacer).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(txEn('Pedir días libres', l), { exact: true })).toBeVisible()
  await leer('portal')
  await hacer.click()
  await expect(page.getByText(DICT['dr.insDiaria'][l], { exact: true })).toBeVisible()
  await leer('revisión · la furgoneta')
  await page.getByRole('button', { name: /1234 ABC/ }).first().click()
  await expect(page.locator('input[type=file]')).toHaveCount(6)
  for (let i = 0; i < 6; i++) await page.locator('input[type=file]').nth(i).setInputFiles(FOTO)
  await page.getByTestId('odo-a-mano').locator('input').fill('48300')
  await page.getByRole('button', { name: '¾' }).click()
  await leer('revisión · las fotos')
  await page.getByRole('button', { name: DICT['dr.aChecklist'][l] }).click()
  await page.getByRole('button', { name: DICT['dr.spare.yes'][l] }).click()
  await leer('revisión · el checklist')
  await page.getByRole('button', { name: DICT['dr.review'][l] }).click()
  await leer('revisión · el resumen')
  await page.getByRole('button', { name: DICT['dr.enviarRev'][l] }).click()
  await expect(page.getByRole('heading', { name: DICT['dr.completada'][l] })).toBeVisible()
  await leer('final · la firma')
  if (final === 'saltar') {
    await page.getByRole('button', { name: DICT['dr.sinFirma'][l] }).click()
    await expect(page.getByRole('heading', { name: DICT['dr.enviada'][l] })).toBeVisible()
    await leer('final · enviada sin firmar')
  } else {
    await page.getByRole('checkbox').check({ force: true })
    await page.getByRole('button', { name: DICT['dr.firmar'][l] }).click()
    await expect(page.getByRole('heading', { name: DICT['dr.firmada'][l] })).toBeVisible()
    await leer('final · firmada')
  }
  await ctx.close()
  return pantallas
}

for (const final of ['saltar', 'firmar']) {
  test(`tanda 6 · en español, el recorrido entero (${final === 'saltar' ? 'sin firmar' : 'firmando'}): ni «Inspección» ni «auditoría», y la fecha como en el portal`, async ({ browser }, info) => {
    test.setTimeout(90_000)
    const p = await recorrido(browser, info, 'es', final)
    expect(Object.keys(p).length).toBe(7)
    for (const [nombre, texto] of Object.entries(p)) {
      expect(texto, nombre).not.toMatch(/nspecci|uditor/i)
      expect(texto, nombre).not.toMatch(/incentivos|premiaremos|🏆/i)
    }
    expect(p['final · la firma']).toContain('Revisión completada')
    if (final === 'saltar') {
      expect(p['final · enviada sin firmar']).toContain('Revisión enviada')
      expect(p['final · enviada sin firmar']).toContain('Tu empresa recibirá la revisión y podrá firmarla desde el panel.')
      expect(p['final · enviada sin firmar']).toContain('Nueva revisión')
    } else {
      expect(p['final · firmada']).toContain('Revisión firmada')
      expect(p['final · firmada']).not.toContain('¡')
    }
    // La fecha de la cabecera de la revisión: «Sábado, 14 de noviembre · NORTE», no «14 De Noviembre».
    const fecha = p['revisión · la furgoneta'].split('\n').find((x) => x.includes('· NORTE'))
    expect(fecha).toMatch(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-z]+ · NORTE$/)
    const portal = p.portal.split('\n').find((x) => /^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-z]+$/.test(x))
    expect(fecha.replace(' · NORTE', '')).toBe(portal)
  })
}

/* Lo que puede salir igual en los dos idiomas sin ser español: nombres, matrículas, cifras, el código de la firma, «OK» y palabras que se
   escriben igual («Interior» en inglés, «Fotos» y «Foto» en alemán, «Checklist» en inglés). */
const IGUALES = /^(ANA L\.|ANA|NORTE|1234 ABC|Toyota Proace|OK|Interior|Checklist|Fotos?|Fotos? ✓|[\d.,/ ]+|[\d.,]+ km|¼|½|¾|«.*»|[0-9a-f]+…|\p{Extended_Pictographic}\uFE0F? Interior)$/u
for (const l of ['en', 'de']) {
  test(`tanda 6 · con el teléfono en «${l}», el portal, la revisión y su final sin una línea en español`, async ({ browser }, info) => {
    test.setTimeout(150_000)
    for (const final of ['saltar', 'firmar']) {
      const [es, otro] = [await recorrido(browser, info, 'es', final), await recorrido(browser, info, l, final)]
      for (const nombre of Object.keys(es)) {
        const lineas = (t) => t.split('\n').map((x) => x.replace(/^\.\s*/, '').trim()).filter(Boolean)
        const enEspanol = new Set(lineas(es[nombre]).filter((x) => !IGUALES.test(x)))
        const mezcladas = lineas(otro[nombre]).filter((x) => enEspanol.has(x))
        expect(mezcladas, `${l} · ${nombre}`).toEqual([])
        expect(otro[nombre], `${l} · ${nombre}`).not.toMatch(/ de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/)
      }
      // La fecha, en su idioma (en inglés «Saturday, 14 November»).
      const fecha = otro['revisión · la furgoneta'].split('\n').find((x) => x.includes('· NORTE'))
      expect(fecha).toBe(`${new Date().toLocaleDateString(LOCALES[l], { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())} · NORTE`)
    }
  })
}

test('tanda 6 · con el teléfono en inglés, los avisos del lector también van en inglés (cuentas con lector)', async ({ browser }, info) => {
  const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 }, baseURL: info.project.use.baseURL })
  const page = await ctx.newPage()
  await abrirRevisionSinIdioma(page)
  await page.locator('input[type=file]').nth(4).setInputFiles(FOTO)
  await expect(page.getByText(DICT['dr.odo.lectorNo'].en)).toBeVisible()
  await expect(page.getByTestId('odo-aviso')).toContainText(DICT['dr.odo.oAMano'].en)
  await expect(page.getByTestId('odo-aviso')).toContainText('This van had 48,210 km.')
  await page.getByTestId('odo-aviso').locator('input').fill('48300')
  await expect(page.getByTestId('odo-aviso')).toContainText('48,300 km — ready to send')
  expect(await page.locator('body').innerText()).not.toMatch(/Lector|Esta furgoneta|escribe los km/)
  await ctx.close()
})

// Como abrirRevision, pero sin fijar el idioma: manda el del navegador.
async function abrirRevisionSinIdioma(page) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA L.', center: 'NORTE' }))
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/vehicles\/portal/, (r) => r.fulfill({ json: { vehicles: [VEHICULO], puede_auditar: true, motivo: null } }))
  await page.route(/\/api\/auth\/me\/assigned-vehicle/, (r) => r.fulfill({ json: {} }))
  await page.route(/\/api\/inspections\/validate-photo/, (r) => r.fulfill({ json: { valid: true, checked: false } }))
  await page.route(/\/api\/vehicles\/v1\/odometer-photo/, (r) => r.fulfill({ json: { ...SIN_LECTOR, sin_lector: undefined, motivo: undefined } }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: new RegExp(txEn('Hacer la revisión', 'en')) }).click()
  await page.getByRole('button', { name: /1234 ABC/ }).click()
  await expect(page.locator('input[type=file]')).toHaveCount(6)
}
