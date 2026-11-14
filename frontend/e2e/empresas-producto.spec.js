/* global process */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LO QUE /empresas PROMETE, EN EL PANEL (14-11-2026, CORRECCIONES-EMPRESAS-PRODUCTO).
   · P2: la ficha de la furgoneta solo enseñaba sus 50 últimas revisiones. Con la tanda llena sale «Ver revisiones más
     antiguas» (pide las anteriores a la última con el cursor `antes_de`) y la primera revisión, la de cómo llegó.
   · P3: el parte para imprimir ponía la primera foto de cada revisión con golpe; ahora, la del golpe (`photo_index`,
     desde 1) y, de la anterior, la de la misma vista. Y lleva la primera revisión como «Estado de entrada».
   · P1: «Origen de daños» con la cuenta vacía dice qué hace falta, en vez de «No hay golpes en este grupo».
   La API va simulada (api-simulada.js) y, encima, las revisiones de la furgoneta con su propia ruta.
   Con FOTOS_PRODUCTO=<carpeta> guarda las fotos de cada pantalla. */

const BASE = Date.UTC(2025, 0, 1, 8, 0, 0)
const COLORES = ['#1e3a8a', '#7c2d12', '#14532d', '#581c87']
const foto = (n, k) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${COLORES[(k - 1) % 4]}"/>` +
  `<text x="160" y="110" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">Rev ${n} · foto ${k}</text></svg>`)
const pad = (n) => String(n).padStart(3, '0')

function revision(n, extra = {}) {
  return {
    id: `i${pad(n)}`, vehicle_id: 'v1', driver_id: 'd1', driver_name: 'Ana López',
    created_at: new Date(BASE + n * 864e5).toISOString(),
    photos: [1, 2, 3, 4].map((k) => foto(n, k)),
    analysis: { severity: 'sin_danos', new_damages: [] }, ...extra,
  }
}
// De la más nueva a la más vieja, como las da el servidor.
const flota = (total, cambia = {}) => Array.from({ length: total }, (_, k) => total - 1 - k)
  .map((n) => revision(n, cambia[n] || {}))

/* La ruta del servidor, con su cursor: sin nada, las 50 últimas; con `antes_de`, las anteriores a esa; con
   `primera`, la más antigua. Apunta cada petición para poder mirarlas. */
/* Ronda 3 (14-11-2026): `solo_total` da `{total}`; con `viejo` se porta como un servidor de antes del 14-11, que no
   entiende ni `solo_total` ni el cursor (da las 50 últimas), y con `fallaCursor` las tandas con cursor dan un 500. */
async function simularRevisiones(page, todas, { viejo = false, fallaCursor = false } = {}) {
  const peticiones = []
  await page.route('**/api/inspections/vehicle/**', async (route) => {
    const u = new URL(route.request().url())
    peticiones.push(Object.fromEntries(u.searchParams))
    if (fallaCursor && u.searchParams.get('antes_de') !== null) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"x"}' })
      return
    }
    let out
    if (u.searchParams.get('solo_total') && !viejo) out = { total: todas.length }
    else if (u.searchParams.get('primera')) out = todas.slice(-1)
    else if (u.searchParams.get('antes_de') && !viejo) {
      const c = u.searchParams.get('antes_de')
      const id = u.searchParams.get('antes_de_id') || ''
      out = todas.filter((i) => i.created_at < c || (id && i.created_at === c && i.id < id)).slice(0, 50)
    } else out = todas.slice(0, 50)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) })
  })
  return peticiones
}

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js|status of 500/i.test(t)) return
    fallos.push(t)
  })
  return fallos
}

async function fotoDe(page, nombre) {
  const dir = process.env.FOTOS_PRODUCTO
  if (!dir) return
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${nombre}-${test.info().project.name}.png`), fullPage: false })
}

async function abrirFicha(page, todas, opciones) {
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  const peticiones = await simularRevisiones(page, todas, opciones)
  await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
  await page.getByText('1234 ABC').first().click()
  return peticiones
}

const pestanaInspecciones = (page) => page.getByRole('button', { name: /^Inspecciones\s*\d*\+?$/ })

test.describe('La ficha de la furgoneta: el historial entero', () => {
  test('con 50 revisiones sale «Ver revisiones más antiguas» y añade las siguientes sin perder ninguna', async ({ page }) => {
    const fallos = vigilar(page)
    const todas = flota(80)
    const peticiones = await abrirFicha(page, todas)
    await pestanaInspecciones(page).click()
    // M2 (ronda 3): el total de verdad desde el principio, no las 50 cargadas.
    await expect(pestanaInspecciones(page)).toHaveText(/80/)
    const mas = page.getByRole('button', { name: 'Ver revisiones más antiguas' })
    await expect(mas).toBeVisible()
    // La primera revisión no está entre las 50: hay un acceso a ella, con sus fotos.
    const primera = page.getByRole('button', { name: /La primera revisión \(cómo llegó\)/ })
    await expect(primera).toBeVisible()
    await primera.click()
    await expect(page.locator(`img[src="${foto(0, 3)}"]`)).toBeVisible()
    await mas.scrollIntoViewIfNeeded()
    await fotoDe(page, 'ficha-ver-mas')

    await mas.click()
    await expect(pestanaInspecciones(page)).toHaveText(/80/)
    // Pidió las anteriores a la ÚLTIMA que tenía (la 30), con su id para desempatar.
    const pedida = peticiones.find((p) => p.antes_de)
    expect(pedida).toEqual({ antes_de: todas[49].created_at, antes_de_id: 'i030' })
    // La tanda vino con menos de 50: no hay más, y la primera ya está en la lista.
    await expect(mas).toHaveCount(0)
    await expect(primera).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con menos de 50 no sale el botón ni se pide la primera aparte', async ({ page }) => {
    const fallos = vigilar(page)
    const peticiones = await abrirFicha(page, flota(3))
    await pestanaInspecciones(page).click()
    await expect(pestanaInspecciones(page)).toHaveText(/3/)
    await expect(page.getByRole('button', { name: 'Ver revisiones más antiguas' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /La primera revisión/ })).toHaveCount(0)
    expect(peticiones.filter((p) => p.primera || p.antes_de || p.solo_total)).toEqual([])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* RONDA 3 (14-11-2026), lo que encontró la revisión final en la ficha. */
test.describe('La ficha de la furgoneta: el total y las fotos de cada revisión', () => {
  test('M2 · con 80 revisiones la tarjeta, la pestaña y la tira dicen 80, no 50', async ({ page }) => {
    // Falla con el código de antes: decían 50 hasta pulsar «Ver revisiones más antiguas».
    const fallos = vigilar(page)
    const peticiones = await abrirFicha(page, flota(80))
    await expect(page.getByText(/^80$/).first()).toBeVisible()
    await pestanaInspecciones(page).click()
    await expect(pestanaInspecciones(page)).toHaveText(/^Inspecciones\s*80$/)
    await expect(page.getByText('hoy · 80 inspecciones')).toBeVisible()
    expect(peticiones.filter((p) => p.solo_total)).toHaveLength(1)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('M2 · con un servidor que no sabe el total, «50+» y no «50»', async ({ page }) => {
    await abrirFicha(page, flota(80), { viejo: true })
    await pestanaInspecciones(page).click()
    await expect(pestanaInspecciones(page)).toHaveText(/^Inspecciones\s*50\+$/)
    await expect(page.getByText('hoy · 50+ inspecciones')).toBeVisible()
  })

  test('V3 · cada revisión se despliega con sus fotos, que se cargan solo al abrirla', async ({ page }) => {
    // Falla con el código de antes: la fila no era un botón ni tenía fotos.
    const fallos = vigilar(page)
    await abrirFicha(page, flota(5))
    await pestanaInspecciones(page).click()
    // La revisión 2 (la tercera más nueva). Su foto 3 no está en la tira de arriba (que lleva la primera de cada una).
    const fila = page.getByRole('button', { name: /Ana López/ }).nth(2)
    await expect(fila).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(`img[src="${foto(2, 3)}"]`)).toHaveCount(0)
    await fila.click()
    await expect(fila).toHaveAttribute('aria-expanded', 'true')
    for (const k of [1, 2, 3, 4]) {
      const enlace = page.locator(`a[href="${foto(2, k)}"]`)
      await expect(enlace).toHaveAttribute('target', '_blank')
      await expect(enlace.locator('img')).toBeVisible()
    }
    // Solo esa: las demás siguen cerradas y sin pedir sus fotos.
    await expect(page.locator(`img[src="${foto(1, 3)}"]`)).toHaveCount(0)
    await fila.scrollIntoViewIfNeeded()
    await fotoDe(page, 'ficha-fila-abierta')
    await fila.click()
    await expect(fila).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(`img[src="${foto(2, 3)}"]`)).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('V3 · una revisión sin fotos (o con fotos raras) dice «Sin fotos» y no rompe', async ({ page }) => {
    const fallos = vigilar(page)
    await abrirFicha(page, flota(2, { 1: { photos: null }, 0: { photos: 'no-es-lista' } }))
    await pestanaInspecciones(page).click()
    for (const n of [0, 1]) await page.getByRole('button', { name: /Ana López/ }).nth(n).click()
    await expect(page.getByText('Sin fotos')).toHaveCount(2)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('M6 · la gravedad con su nombre: «Sin daños», no «sin_danos»', async ({ page }) => {
    // Falla con el código de antes: la etiqueta era el valor en crudo.
    await abrirFicha(page, flota(2, { 1: { analysis: { severity: 'leve', new_damages: [] } } }))
    await pestanaInspecciones(page).click()
    await expect(page.getByRole('button', { name: /Sin daños/ })).toHaveCount(1)
    await expect(page.getByRole('button', { name: /Leve/ })).toHaveCount(1)
    await expect(page.getByText('sin_danos')).toHaveCount(0)
  })
})

/* El parte se abre en otra ventana con document.write: se recoge lo que escribe. */
/* Ronda 3: con revisiones por cargar, la ventana se abre en el clic con «Preparando el parte…» y el parte se escribe
   después con document.open() (que la vacía, como en el navegador). Se apunta lo que se llegó a escribir antes. */
async function abrirParte(page, todas, opciones) {
  return (await abrirParteCon(page, todas, opciones)).html
}
async function abrirParteCon(page, todas, opciones) {
  await page.addInitScript(() => {
    window.__parte = ''
    window.__escritos = []
    window.open = () => ({
      closed: false, close: () => {},
      document: {
        open: () => { window.__parte = '' },
        write: (h) => { window.__parte += h; window.__escritos.push(h) },
        close: () => {},
      },
    })
  })
  const peticiones = await abrirFicha(page, todas, opciones)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Historial' }).click()
  await page.getByRole('button', { name: 'Parte de disputa' }).click()
  await expect.poll(() => page.evaluate(() => window.__parte.includes('Cronología registrada')), { timeout: 20000 }).toBe(true)
  const html = await page.evaluate(() => window.__parte)
  return { html, peticiones, escritos: await page.evaluate(() => window.__escritos) }
}
// La hoja del parte tal cual se imprimiría (con FOTOS_PRODUCTO).
async function fotoParte(browser, page, html, nombre, entera = true) {
  if (!process.env.FOTOS_PRODUCTO) return
  const hoja = await browser.newPage({ viewport: page.viewportSize() })
  await hoja.setContent(html.replace(/<script>[\s\S]*?<\/script>/, ''))
  await hoja.screenshot({ path: path.join(process.env.FOTOS_PRODUCTO, `${nombre}-${test.info().project.name}.png`), fullPage: entera })
  await hoja.close()
}
const filasInspeccion = (html) => [...html.matchAll(/<tr><td class="dt">[^<]*<\/td><td>Inspección[^<]*<\/td><\/tr>/g)].map((m) => m[0])
const avisoDe = (html) => (html.match(/<div class="aviso">([^<]*)<\/div>/) || [])[1] || null
const evidencia = (html) => html.slice(html.indexOf('Evidencia fotográfica'))
const imgs = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'))

test.describe('El parte para imprimir', () => {
  test('con el golpe en la foto 3 lleva la tercera foto de esa revisión y la tercera de la anterior', async ({ page }) => {
    const html = await abrirParte(page, flota(2, { 1: { analysis: { severity: 'leve', new_damages: [{ part: 'Puerta', photo_index: 3 }] } } }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 3), foto(1, 3)])
  })

  test('sin photo_index, las primeras, como siempre', async ({ page }) => {
    const html = await abrirParte(page, flota(2, { 1: { analysis: { severity: 'leve', new_damages: [{ part: 'Puerta' }] } } }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 1), foto(1, 1)])
  })

  test('con un photo_index raro (fuera de rango o en texto), las primeras, como siempre', async ({ page }) => {
    const raro = await abrirParte(page, flota(2, { 1: { analysis: { new_damages: [{ photo_index: 9 }, { photo_index: '2' }] } } }))
    expect(imgs(evidencia(raro))).toEqual([foto(0, 1), foto(1, 1)])
  })

  test('con varios golpes en fotos distintas, una pareja por foto y sin repetir', async ({ page }) => {
    const html = await abrirParte(page, flota(2, { 1: { analysis: { new_damages: [{ photo_index: 4 }, { photo_index: 2 }, { photo_index: 4 }] } } }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 2), foto(1, 2), foto(0, 4), foto(1, 4)])
  })

  test('la foto de antes es la de la MISMA vista aunque la anterior las subiera en otro orden', async ({ page }) => {
    const html = await abrirParte(page, flota(2, {
      1: { photo_vistas: ['frontal', 'trasera', 'lateral_izq', 'lateral_der'], analysis: { new_damages: [{ photo_index: 2 }] } },
      0: { photo_vistas: ['trasera', 'frontal', 'lateral_izq', 'lateral_der'] },
    }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 1), foto(1, 2)])
  })

  test('lleva la primera revisión de la furgoneta como «Estado de entrada», con su fecha y sus fotos', async ({ page, browser }) => {
    const todas = flota(60, { 59: { analysis: { severity: 'moderado', new_damages: [{ part: 'Paragolpes trasero', photo_index: 2 }] } } })
    const html = await abrirParte(page, todas)
    const entrada = html.slice(html.indexOf('Estado de entrada'), html.indexOf('Evidencia fotográfica'))
    expect(entrada).toContain('Primera revisión registrada')
    expect(imgs(entrada)).toEqual([1, 2, 3, 4].map((k) => foto(0, k)))
    expect(imgs(evidencia(html))).toEqual([foto(58, 2), foto(59, 2)])
    // La foto del parte tal cual se imprimiría.
    if (process.env.FOTOS_PRODUCTO) {
      const hoja = await browser.newPage({ viewport: page.viewportSize() })
      await hoja.setContent(html.replace(/<script>[\s\S]*?<\/script>/, ''))
      await hoja.screenshot({ path: path.join(process.env.FOTOS_PRODUCTO, `parte-${test.info().project.name}.png`), fullPage: true })
      await hoja.close()
    }
  })

  test('si la primera ya sale como «antes» de un golpe, no se repite', async ({ page }) => {
    const html = await abrirParte(page, flota(2, { 1: { analysis: { new_damages: [{ photo_index: 1 }] } } }))
    expect(html).not.toContain('Estado de entrada')
  })
})

/* RONDA 3 (14-11-2026): el parte entero, la gravedad con su nombre y la misma pareja que «Origen de daños». */
test.describe('El parte para imprimir: entero y con la pareja del servidor', () => {
  test('M1 · con 80 revisiones y sin pulsar «Ver más», el parte las lleva TODAS y sin aviso', async ({ page }) => {
    // Falla con el código de antes: salían 50 filas y nada decía que faltaban 30.
    const fallos = vigilar(page)
    const { html, peticiones, escritos } = await abrirParteCon(page, flota(80))
    expect(filasInspeccion(html)).toHaveLength(80)
    expect(avisoDe(html)).toBeNull()
    expect(escritos[0]).toContain('Preparando el parte…')
    expect(peticiones.filter((p) => p.antes_de)).toHaveLength(1)
    // Con todo cargado, la ficha también: la pestaña dice 80 y ya no hay «Ver más».
    await pestanaInspecciones(page).click()
    await expect(pestanaInspecciones(page)).toHaveText(/^Inspecciones\s*80$/)
    await expect(page.getByRole('button', { name: 'Ver revisiones más antiguas' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('M1 · si falla una tanda, el parte lo DICE arriba', async ({ page, browser }) => {
    const { html } = await abrirParteCon(page, flota(80), { fallaCursor: true })
    expect(filasInspeccion(html)).toHaveLength(50)
    expect(avisoDe(html)).toBe('Este parte incluye las 50 revisiones más recientes de las 80 que tiene la furgoneta'
      + ' y la primera (Estado de entrada). Las demás están en el panel.')
    expect(html.indexOf('class="aviso"')).toBeLessThan(html.indexOf('Cronología registrada'))
    // La de entrada va igual: se pidió aparte.
    expect(imgs(html.slice(html.indexOf('Estado de entrada')))).toEqual([1, 2, 3, 4].map((k) => foto(0, k)))
    await fotoParte(browser, page, html, 'parte-aviso', false)
  })

  test('M1 · con un servidor viejo (sin cursor ni total), también lo dice, sin inventar el total', async ({ page }) => {
    const { html } = await abrirParteCon(page, flota(80), { viejo: true })
    expect(filasInspeccion(html)).toHaveLength(50)
    expect(avisoDe(html)).toBe('Este parte incluye las 50 revisiones más recientes y la primera (Estado de entrada).'
      + ' Las demás están en el panel.')
  })

  test('M1 · con más de 1.000 revisiones se para en el tope y lo dice', async ({ page }) => {
    test.setTimeout(90000)
    const { html, peticiones } = await abrirParteCon(page, flota(1080))
    expect(filasInspeccion(html)).toHaveLength(1000)
    expect(peticiones.filter((p) => p.antes_de)).toHaveLength(19)
    expect(avisoDe(html)).toBe('Este parte incluye las 1000 revisiones más recientes de las 1080 que tiene la furgoneta'
      + ' y la primera (Estado de entrada). Las demás están en el panel.')
  })

  test('R2 · con 50 revisiones justas lleva «Estado de entrada»', async ({ page }) => {
    // Falla con el código de antes: la primera estaba en la lista, la tanda vino llena y no salía.
    const { html } = await abrirParteCon(page, flota(50))
    expect(filasInspeccion(html)).toHaveLength(50)
    expect(avisoDe(html)).toBeNull()
    const entrada = html.slice(html.indexOf('Estado de entrada'))
    expect(html).toContain('Estado de entrada')
    expect(imgs(entrada)).toEqual([1, 2, 3, 4].map((k) => foto(0, k)))
  })

  test('M6 · en el parte, «Inspección · Sin daños», no «sin_danos»', async ({ page }) => {
    // Falla con el código de antes.
    const html = await abrirParte(page, flota(2, { 1: { analysis: { severity: 'leve', new_damages: [] } } }))
    expect(filasInspeccion(html).map((f) => f.replace(/<[^>]+>/g, '|'))).toEqual([
      expect.stringContaining('Inspección · Leve · Ana López'),
      expect.stringContaining('Inspección · Sin daños · Ana López'),
    ])
    expect(html).not.toContain('sin_danos')
  })

  test('V8 · si la anterior no tiene esa vista, la foto de antes dice «Revisión anterior, otra vista»', async ({ page, browser }) => {
    // Falla con el código de antes: ponía la primera foto como «Estado anterior».
    const html = await abrirParte(page, flota(2, {
      1: { photo_vistas: ['frontal', 'trasera', 'lateral_izq', 'lateral_der'], analysis: { severity: 'leve', new_damages: [{ photo_index: 2 }] } },
      0: { photos: [1, 2, 3].map((k) => foto(0, k)), photo_vistas: ['frontal', 'lateral_izq', 'lateral_der'] },
    }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 1), foto(1, 2)])
    expect(evidencia(html)).toContain('Revisión anterior, otra vista')
    expect(evidencia(html)).not.toContain('Estado anterior')
    await fotoParte(browser, page, html, 'parte-otra-vista')
  })

  test('V8 · con la misma vista, «Estado anterior» como siempre', async ({ page }) => {
    const html = await abrirParte(page, flota(2, {
      1: { photo_vistas: ['frontal', 'trasera', 'lateral_izq', 'lateral_der'], analysis: { new_damages: [{ photo_index: 2 }] } },
      0: { photo_vistas: ['trasera', 'frontal', 'lateral_izq', 'lateral_der'] },
    }))
    expect(evidencia(html)).toContain('Estado anterior')
    expect(evidencia(html)).not.toContain('otra vista')
  })

  test('R3 · la anterior sabe sus vistas pero no la de esa posición: la misma foto que daría el servidor', async ({ page }) => {
    // Falla con el código de antes: daba la del mismo número (foto 2), y `_atr_fotos_prueba` la primera.
    const html = await abrirParte(page, flota(2, {
      1: { photo_vistas: ['frontal', 'trasera', 'lateral_izq', 'lateral_der'], analysis: { new_damages: [{ photo_index: 2 }] } },
      0: { photo_vistas: ['frontal', null, 'lateral_izq', 'lateral_der'] },
    }))
    expect(imgs(evidencia(html))).toEqual([foto(0, 1), foto(1, 2)])
    expect(evidencia(html)).toContain('Revisión anterior, otra vista')
  })

  test('R3 · como el servidor, de la anterior se prefiere la anotada de esa posición', async ({ page }) => {
    const anotada = foto(900, 3)
    const html = await abrirParte(page, flota(2, {
      1: { analysis: { new_damages: [{ photo_index: 3 }] } },
      0: { annotated_photos: [null, null, anotada, null] },
    }))
    expect(imgs(evidencia(html))).toEqual([anotada, foto(1, 3)])
  })
})

test.describe('Origen de daños con la cuenta vacía', () => {
  for (const [nombre, respuesta, texto] of [
    ['dice qué hace falta para que salga algo', { status: 200, body: { danos: [], resumen: {}, total: 0 } }, /Todavía no hay golpes atribuidos/],
    ['un fallo del servidor no se lee como «no hay golpes»', { status: 500, body: { detail: 'x' } }, /No se ha podido cargar/],
  ]) {
    test(nombre, async ({ page }) => {
      const fallos = vigilar(page)
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      await page.route('**/api/damages/atribucion**', (route) => route.fulfill({
        status: respuesta.status, contentType: 'application/json', body: JSON.stringify(respuesta.body) }))
      await page.goto('/panel/origen-danos', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(texto)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('No hay golpes en este grupo.')).toHaveCount(0)
      if (respuesta.status === 200) await fotoDe(page, 'origen-vacio')
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })
  }
})
