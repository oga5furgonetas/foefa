/* global process */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LO QUE /empresas PROMETE, EN EL PANEL (14-11-2026, CORRECCIONES-EMPRESAS-PRODUCTO).
   · P2: la ficha de la furgoneta solo enseñaba sus 50 últimas revisiones. Con la tanda llena sale «Ver revisiones más
     antiguas» (pide las anteriores a la última con el cursor `antes_de`) y la primera revisión, la de cómo llegó.
   · P3: el parte para imprimir de la ficha se cambió el 14-11-2026 por el expediente de la furgoneta (expediente.spec.js);
     aquí solo se prueba que la ficha lleva a él.
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

/* EL PARTE DE DISPUTA YA NO EXISTE (14-11-2026): lo sustituye el expediente de la furgoneta, una pantalla propia que
   solo recoge golpes confirmados por una persona (sus pruebas, en expediente.spec.js). Aquí, que la ficha lleva a él. */
test.describe('La ficha de la furgoneta: el expediente para imprimir', () => {
  test('el Historial lleva al expediente de esa furgoneta, y el parte viejo ya no está', async ({ page }) => {
    const fallos = vigilar(page)
    await abrirFicha(page, flota(3))
    await page.getByRole('button', { name: 'Historial' }).click()
    await expect(page.getByRole('link', { name: 'Expediente para imprimir' }))
      .toHaveAttribute('href', '/panel/vehiculos/v1/expediente')
    await expect(page.getByRole('button', { name: 'Parte de disputa' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
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
