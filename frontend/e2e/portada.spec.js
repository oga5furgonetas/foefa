/* global process */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA PORTADA PARA EMPRESAS CON FURGONETAS (/ y /empresas, 14-11-2026, «Antes del perito»).
   «/» deja de ser la portada de la app de reparto (sigue en /repartidores) y pasa a ser la de empresas, con la identidad
   nueva (tinta sobre papel). Lo que no puede fallar: el titular; ni una promesa de la IA; el producto en el héroe (la
   matrícula, las dos fotos del mismo lado con su sello y el golpe marcado, y que es un ejemplo inventado); a dónde
   llevan los botones; que /empresas enseña lo mismo; que /repartidores sigue ahí; y que en un móvil de 390 px nada se
   sale por el lado. Con FOTOS_PORTADA=<carpeta> guarda además las fotos de la portada y de cada página pública. */

const ALTA = '/registro?sector=otra&plan=completo'

function vigilarErrores(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(t)
  })
  page.on('pageerror', (e) => fallos.push(String(e)))
  return fallos
}

/* Lo que no se puede decir de la IA (ni de nada) en la portada: la IA no se promete; quien decide es una persona. */
const PROHIBIDO = [/detecta/i, /la IA (señala|marca|ve|analiza|mira)/i, /\bIA\b/, /inteligencia artificial/i, /certificad/i, /inmutable/i,
  /sellad/i, /auténtic/i, /verificad/i, /sin discusión/i, /culpable/i, /quién dio el golpe(?! \?)/i, /Revisión rápida/i, /Origen de daños/i,
  /detección de daños/i, /\bgratis\b/i]

for (const ruta of ['/', '/empresas']) {
  test.describe(`la portada en ${ruta}`, () => {
    test('es la de empresas, con su titular, su título y sin errores', async ({ page }) => {
      const fallos = vigilarErrores(page)
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('portada-empresas')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('El golpe, el día que aparece. No el día que te lo cobran.')
      await expect(page).toHaveTitle('FDS para empresas con furgonetas · El golpe, el día que aparece')
      await expect(page.getByText('Para empresas con furgonetas', { exact: true }).first()).toBeVisible()
      // La portada vieja de la app de reparto ya no está aquí.
      await expect(page.getByText('La app de reparto gratis', { exact: false })).toHaveCount(0)
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })

    test('no promete la IA ni nada de lo prohibido, ni con las preguntas abiertas', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
      const texto = await page.locator('body').innerText()
      for (const p of PROHIBIDO) expect(texto, `no puede decir ${p}`).not.toMatch(p)
      // La pregunta que lo aclara sí está, y su respuesta: decide una persona; quién la llevaba, solo si es seguro.
      expect(texto).toContain('¿Quién decide si hay un golpe?')
      expect(texto).toContain('Una persona de tu oficina.')
      expect(texto).toContain('el golpe queda sin conductor atribuible y se dice por qué')
    })

    test('el héroe lleva el producto: la matrícula, las dos fotos del mismo lado con su sello, el golpe y el aviso de ejemplo', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      const producto = page.getByTestId('emp-producto')
      await expect(producto).toBeVisible()
      await expect(producto.getByTestId('matricula')).toHaveText('E5678 KLM')
      await expect(producto.getByText('Lateral derecho', { exact: true })).toBeVisible()
      // Dos sellos a la vista (uno por foto), con la fecha y quién la hizo.
      const sellos = producto.locator('[data-testid="sello-foto"]:visible')
      await expect(sellos).toHaveCount(2)
      // En el móvil (menos de 640 px), sin el año ni el nombre: no caben en media pantalla.
      const movil = page.viewportSize().width < 640
      await expect(sellos.nth(0)).toHaveText(movil ? '11 NOV · 18:12' : '11 NOV 2026 · 18:12 · Ana L.')
      await expect(sellos.nth(1)).toHaveText(movil ? '12 NOV · 18:07' : '12 NOV 2026 · 18:07 · Luis P.')
      await expect(producto.getByText('Antes', { exact: true })).toBeVisible()
      await expect(producto.getByText('Hoy', { exact: true })).toBeVisible()
      await expect(producto.getByTestId('emp-cerco')).toHaveCount(1)
      await expect(producto.getByText('Golpe nuevo en la puerta corredera')).toBeVisible()
      await expect(producto).toContainText('Solo la llevó Luis P. entre las dos fotos. Lo marcó la oficina al repasar el día.')
      await expect(producto.getByTestId('emp-ejemplo-inventado')).toHaveText('Ejemplo con datos inventados')
      // El 12-11-2026 es jueves: el día de la semana sale del calendario, no escrito a mano.
      await expect(producto).toContainText('Repaso del jueves, 12 de noviembre')
      // Las fotos cargan.
      for (const img of await producto.locator('img').all()) {
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
      }
    })

    test('los botones llevan a su sitio', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      for (const id of ['emp-probar-menu', 'emp-probar', 'emp-probar-cierre']) {
        await expect(page.getByTestId(id)).toHaveText('Probar con mis furgonetas')
        await expect(page.getByTestId(id)).toHaveAttribute('href', `${ALTA}&flota=20`)
      }
      await expect(page.getByTestId('emp-expediente')).toHaveText('Ver un expediente de ejemplo')
      await expect(page.getByTestId('emp-expediente')).toHaveAttribute('href', '/expediente-ejemplo')
      await expect(page.getByTestId('emp-ensenar-cierre')).toHaveAttribute('href', '#demo')
      await expect(page.getByTestId('emp-repartidores')).toHaveAttribute('href', '/repartidores')
      await expect(page.getByTestId('emp-repartidores')).toContainText('¿Repartes tú?')
      await expect(page.getByRole('link', { name: 'Entrar' }).first()).toHaveAttribute('href', '/panel/login')
      await expect(page.getByRole('link', { name: 'Qué le enseñas al perito' })).toHaveAttribute('href', '/peritaje-tecnico')
      await expect(page.getByTestId('emp-linea-precio')).toHaveText('Desde 5 € por furgoneta y mes. 14 días de prueba, sin tarjeta.')
      // Las cifras de la casa, tal cual (CIFRAS_CASA), y las revisiones como «unas 200».
      const nave = page.getByTestId('emp-nave')
      // (en el HTML va primero el nombre, dt, y luego la cifra, dd: se pintan al revés)
      await expect(nave).toContainText('naves3')
      await expect(nave).toContainText('furgonetas63')
      await expect(nave).toContainText('revisiones con foto cada semanaunas 200')
      await expect(page.getByTestId('emp-paso')).toHaveCount(3)
    })
  })
}

test('/repartidores sigue siendo la página de la app de reparto', async ({ page }) => {
  const fallos = vigilarErrores(page)
  await simularApi(page, 'vacio')
  await page.goto('/repartidores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('portada-empresas')).toHaveCount(0)
  await expect(page.locator('body')).toContainText(/ruta/i)
  await expect(page.getByRole('link', { name: /Crear mi cuenta/ }).first()).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('en un móvil de 390 px: nada se sale por el lado, y el titular y el botón se ven sin deslizar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const h1 = page.getByRole('heading', { level: 1 })
  const boton = page.getByTestId('emp-probar')
  await expect(h1).toBeVisible()
  for (const el of [h1, boton]) {
    const caja = await el.boundingBox()
    expect(caja.y + caja.height, 'tiene que verse sin deslizar').toBeLessThanOrEqual(844)
    expect(caja.x + caja.width).toBeLessThanOrEqual(390)
  }
  for (const y of [0, 1500, 3000, 99999]) {
    await page.evaluate((v) => window.scrollTo(0, v), y)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  }
  // Ningún elemento visible se pasa del borde derecho (un desborde dentro de un overflow-x-clip no se ve en scrollWidth).
  const fuera = await page.evaluate(() => [...document.querySelectorAll('[data-testid="portada-empresas"] *')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 390.5 && !e.closest('[aria-hidden="true"] img, .aspect-\\[1200\\/675\\]') })
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`))
  expect(fuera, fuera.join(' | ')).toEqual([])
})

test('en inglés: el titular y el héroe en inglés', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spot the dent the day it appears. Not the day you’re billed for it.')
  await expect(page).toHaveTitle('FDS for van fleets · Spot the dent the day it appears')
  await expect(page.getByTestId('emp-producto')).toContainText(/Review for Thursday,? (12 November|November 12)/)
  await expect(page.getByTestId('emp-probar')).toHaveText('Try it with my vans')
})

test('día por defecto; la noche se elige y se recuerda', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const raiz = page.getByTestId('portada-empresas')
  await expect(raiz).toHaveAttribute('data-theme', 'light')
  expect(await raiz.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(245, 246, 243)')
  await page.getByRole('button', { name: 'Cambiar entre claro y oscuro' }).click()
  await expect(raiz).toHaveAttribute('data-theme', 'dark')
  expect(await raiz.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(11, 16, 18)')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('portada-empresas')).toHaveAttribute('data-theme', 'dark')
})

/* ── Las fotos (solo con FOTOS_PORTADA=<carpeta>) ── */
const CARPETA = process.env.FOTOS_PORTADA
const PUBLICAS = [['portada', '/'], ['repartidores', '/repartidores'], ['planes', '/planes'], ['peritaje', '/peritaje-tecnico'],
  ['registro', '/registro'], ['contacto', '/contacto'], ['privacidad', '/privacidad'], ['terminos', '/terminos'], ['cookies', '/cookies'],
  ['aviso-legal', '/aviso-legal'], ['seguridad', '/security'], ['iphone', '/iphone'], ['empleo', '/empleo'], ['login', '/panel/login']]
test.describe('fotos de las páginas públicas', () => {
  test.skip(!CARPETA, 'solo con FOTOS_PORTADA')
  for (const [nombre, ruta] of PUBLICAS) {
    for (const ancho of [1280, 390]) {
      for (const tema of nombre === 'portada' || nombre === 'peritaje' || nombre === 'planes' ? ['dia', 'noche'] : ['dia']) {
        test(`${nombre} a ${ancho} (${tema})`, async ({ page }) => {
          await page.addInitScript((t) => {
            localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' }))
            if (t === 'noche') localStorage.setItem('fds_tema_web', 'dark')
          }, tema)
          await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
          await simularApi(page, 'vacio')
          await page.goto(ruta, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1200)
          await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } window.scrollTo(0, 0) })
          await page.waitForTimeout(400)
          fs.mkdirSync(CARPETA, { recursive: true })
          await page.screenshot({ path: path.join(CARPETA, `${nombre}-${ancho}-${tema}.png`), fullPage: true })
        })
      }
    }
  }
})
