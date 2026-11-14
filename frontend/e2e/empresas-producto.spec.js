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
async function simularRevisiones(page, todas) {
  const peticiones = []
  await page.route('**/api/inspections/vehicle/**', async (route) => {
    const u = new URL(route.request().url())
    peticiones.push(Object.fromEntries(u.searchParams))
    let out
    if (u.searchParams.get('primera')) out = todas.slice(-1)
    else if (u.searchParams.get('antes_de')) {
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

async function abrirFicha(page, todas) {
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  const peticiones = await simularRevisiones(page, todas)
  await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
  await page.getByText('1234 ABC').first().click()
  return peticiones
}

const pestanaInspecciones = (page) => page.getByRole('button', { name: /^Inspecciones\s*\d*$/ })

test.describe('La ficha de la furgoneta: el historial entero', () => {
  test('con 50 revisiones sale «Ver revisiones más antiguas» y añade las siguientes sin perder ninguna', async ({ page }) => {
    const fallos = vigilar(page)
    const todas = flota(80)
    const peticiones = await abrirFicha(page, todas)
    await pestanaInspecciones(page).click()
    await expect(pestanaInspecciones(page)).toHaveText(/50/)
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
    expect(peticiones.filter((p) => p.primera || p.antes_de)).toEqual([])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* El parte se abre en otra ventana con document.write: se recoge lo que escribe. */
async function abrirParte(page, todas) {
  await page.addInitScript(() => {
    window.__parte = ''
    window.open = () => ({ document: { write: (h) => { window.__parte += h }, close: () => {} } })
  })
  await abrirFicha(page, todas)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Historial' }).click()
  await page.getByRole('button', { name: 'Parte de disputa' }).click()
  await expect.poll(() => page.evaluate(() => window.__parte.length)).toBeGreaterThan(100)
  return page.evaluate(() => window.__parte)
}
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
