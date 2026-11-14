/* global process */
/* EL ACCESO, CON OFICIO (14-11-2026, cuarta tanda, C1-C5): el arranque del dueño, la ventana «El acceso de…» y la
   entrada del conductor (/conductor y /c), mirados de día y de noche, a 390 y a 1280 px. Lo que se vigila:
   · la espera de la primera revisión tiene vida: cada conductor con su estado y «Mandar otra vez»; las cuatro fotos
     en vacío (las mismas casillas que en «Ha llegado»); «Comprobado hace N s» en mono;
   · la barra de pasos: el actual en tinta, los hechos más claros; sin «Paso 1 de 4»; las fechas con el sello de la
     casa («14 NOV 2026 · 09:31»); en «Ha llegado», el lado de cada foto en su esquina;
   · la ventana del acceso: título centrado con la X y el estado en mono, en su línea y con su color;
   · /conductor: un solo anillo de foco; «Portal del conductor» como frase; nada que compita con «Entrar»;
   · /c en pantallas anchas: el botón justo debajo del texto;
   · la noche, cuando se ha elegido, en el arranque, /c y /conductor.
   Con FOTOS_ALTA=<carpeta> saca las fotos de cada pantalla. */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', n), 'utf8'))
const ESTADO = fx('alta-estado.json')
const ACCESOS = fx('alta-accesos.json')
const CREADO = fx('alta-acceso-creado.json')
const FOTOS_DIR = process.env.FOTOS_ALTA || ''
const TOKEN = 'a3f1c9e7b5d3f1a9c7e5b3d1f9a7c5e3b1d9f7a5c3e1b9d7f5a3c1e9b7d5f3a1'

const FOTOS_LOCALES = ['/demo/van-frontal.jpg', '/demo/van-lateral.jpg', '/demo/van-lateral-golpe-puerta.jpg', '/demo/van-lateral-golpe-paragolpes.jpg']
const REVISION = { ...ESTADO.revision, fotos: ESTADO.revision.fotos.map((f, i) => ({ ...f, url: FOTOS_LOCALES[i % FOTOS_LOCALES.length] })) }

function estadoEn(paso) {
  const fin = paso > 4
  return {
    ...ESTADO,
    furgonetas: paso > 1 ? Math.max(1, ESTADO.furgonetas) : 0,
    conductores: paso > 2 ? Math.max(1, ESTADO.conductores) : 0,
    revisiones: fin ? 1 : 0,
    pasos: ESTADO.pasos.map((p, i) => ({ ...p, hecho: i < paso - 1 })),
    paso_actual: fin ? null : paso,
    revision: fin ? REVISION : null,
  }
}

async function servidor(page, inicial) {
  const s = { estado: inicial, accesos: structuredClone(ACCESOS), pedidas: [] }
  await page.route(/\/api\/alta\/estado/, (r) => r.fulfill({ json: s.estado }))
  await page.route(/\/api\/conductores\/accesos/, (r) => r.fulfill({ json: s.accesos }))
  await page.route(/\/api\/conductores\/[^/]+\/acceso$/, (r) => {
    const req = r.request()
    const id = decodeURIComponent(new URL(req.url()).pathname.split('/').slice(-2)[0])
    const fila = s.accesos.conductores.find((c) => c.driver_id === id)
    s.pedidas.push({ metodo: req.method(), id, cuerpo: req.method() === 'POST' ? (req.postDataJSON() || {}) : null })
    fila.acceso = { ...CREADO.acceso }
    const token = (id.replace(/[^0-9a-f]/g, '') + CREADO.token).slice(0, 64)
    return r.fulfill({ json: { ...CREADO, driver_id: id, nombre: fila.nombre, whatsapp: fila.whatsapp, token, ruta: `/c#${token}`, acceso: fila.acceso } })
  })
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: ACCESOS.conductores.map((c) => ({
    id: c.driver_id, name: c.nombre, center: 'NORTE', active: true, phone: c.movil, email: c.email })) }))
  await page.context().route(/^https:\/\/wa\.me\//, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>WhatsApp</title>' }))
  return s
}

/* Día: el panel en su tema de siempre (híbrido) o en claro; noche: el panel y la web en noche. */
async function ponerTema(page, tema) {
  await page.addInitScript((tm) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    localStorage.setItem('ayuda_vista_a1', '1')
    if (tm === 'hibrido') return
    localStorage.setItem('panel_theme', tm === 'noche' ? 'dark' : 'light')
    localStorage.setItem('panel_theme_elegido', '1')
    if (tm === 'noche') localStorage.setItem('fds_tema_web', 'dark')
  }, tema)
}

async function foto(page, nombre) {
  if (!FOTOS_DIR) return
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(FOTOS_DIR, `${nombre}.png`), fullPage: true })
}

const alPaso = (page, n) => page.getByRole('button', { name: new RegExp(`^${n} · `) }).click()

test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid' })

/* ── Las fotos de cada pantalla (solo con FOTOS_ALTA) ─────────────────────────────────────────────────────────── */
for (const ancho of [1280, 390]) {
  for (const tema of ['dia', 'noche']) {
    test(`fotos · arranque, ${ancho} px, ${tema}`, async ({ page }) => {
      test.skip(!FOTOS_DIR, 'solo para sacar fotos')
      test.setTimeout(90_000)
      await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
      await ponerTema(page, tema === 'noche' ? 'noche' : 'hibrido')
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      const s = await servidor(page, estadoEn(1))
      await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Tus furgonetas' })).toBeVisible()
      await foto(page, `arranque-1-${ancho}-${tema}`)
      s.estado = estadoEn(4)
      for (const [n, titulo] of [[2, 'Tus conductores'], [3, 'Dales acceso'], [4, 'La primera revisión']]) {
        await alPaso(page, n)
        await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
        if (n === 4) await page.waitForTimeout(1500)
        await foto(page, `arranque-${n}${n === 4 ? '-espera' : ''}-${ancho}-${tema}`)
      }
      s.estado = estadoEn(5)
      await expect(page.getByRole('heading', { name: 'Ha llegado la primera revisión' })).toBeVisible({ timeout: 12_000 })
      await foto(page, `arranque-5-llego-${ancho}-${tema}`)
    })

    test(`fotos · /conductor y /c, ${ancho} px, ${tema}`, async ({ page }) => {
      test.skip(!FOTOS_DIR, 'solo para sacar fotos')
      await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
      await ponerTema(page, tema === 'noche' ? 'noche' : 'hibrido')
      await simularApi(page, 'vacio')
      await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('entrada-conductor')).toBeVisible()
      await foto(page, `conductor-${ancho}-${tema}`)
      await page.locator('#dr-correo').fill('ana@ejemplo.es')
      await page.locator('#dr-clave').focus()
      await foto(page, `conductor-foco-${ancho}-${tema}`)
      await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('entrar-con-enlace')).toBeVisible()
      await foto(page, `c-${ancho}-${tema}`)
    })
  }
  for (const tema of ['hibrido', 'claro', 'noche']) {
    test(`fotos · la ventana del acceso, ${ancho} px, ${tema}`, async ({ page }) => {
      test.skip(!FOTOS_DIR, 'solo para sacar fotos')
      await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
      await ponerTema(page, tema)
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      await servidor(page, estadoEn(5))
      await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
      await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await foto(page, `ventana-sin-mandar-${ancho}-${tema}`)
      await page.keyboard.press('Escape')
      const abierto = ACCESOS.conductores.find((c) => c.acceso.estado === 'abierto')
      await page.getByTestId('boton-acceso').and(page.locator('[data-estado="abierto"]')).first().click()
      await expect(page.getByRole('dialog', { name: new RegExp(abierto.nombre) })).toBeVisible()
      await foto(page, `ventana-abierto-${ancho}-${tema}`)
    })
  }
}

/* ── Lo que se arregla, medido ────────────────────────────────────────────────────────────────────────────────── */
/* Un anillo de foco lleva `0 0 0 Npx` en su sombra; sin anillo, todo a 0. */
const conAnillo = (sombra) => /0px 0px 0px [1-9]/.test(String(sombra))

test('C4 · /conductor: un solo anillo de foco, «Portal del conductor» como frase y sin flechas', async ({ page }) => {
  await ponerTema(page, 'hibrido')
  await simularApi(page, 'vacio')
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['dr.portal'].es)
  expect(DICT['dr.portal'].es).toBe('Portal del conductor')
  await expect(page.getByTestId('entrada-conductor')).not.toContainText('→')
  for (const sel of ['#dr-correo', '#dr-clave']) {
    await page.locator(sel).focus()
    await page.keyboard.press('End')   // foco de teclado: el `:focus-visible` que ponía el segundo anillo
    const sombra = await page.locator(sel).evaluate((el) => getComputedStyle(el).boxShadow)
    expect(conAnillo(sombra), `${sel}: ${sombra}`).toBe(false)
    const borde = await page.locator(sel).evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(borde).toBe('rgb(16, 24, 26)')
  }
  // La única acción con el color de la marca es «Entrar».
  const firmas = await page.getByTestId('entrada-conductor').locator('a, button').evaluateAll((xs) => xs
    .filter((x) => getComputedStyle(x).backgroundColor === 'rgb(20, 231, 216)').map((x) => x.textContent.trim()))
  expect(firmas).toEqual([DICT['alta.dr.entrar'].es])
})

test('C4 · el código: «Entrar» sin las seis cifras no es un cian lavado', async ({ page }) => {
  await ponerTema(page, 'hibrido')
  await simularApi(page, 'vacio')
  await page.route(/\/api\/auth\/driver-code\/request|\/api\/auth\/driver-lookup/, (r) => r.fulfill({ json: { ok: true } }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('ana@ejemplo.es')
  await page.getByRole('button', { name: DICT['alta.dr.entrar'].es }).click()
  const boton = page.locator('#driver-code ~ button[type="submit"]')
  await expect(boton).toBeDisabled()
  const [fondo, opacidad] = await boton.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).opacity])
  expect(fondo).not.toBe('rgb(20, 231, 216)')
  expect(opacidad).toBe('1')
  await page.locator('#driver-code').fill('123456')
  await expect(boton).toBeEnabled()
  await expect.poll(() => boton.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgb\((20, 231, 216|15, 211, 197)\)$/)   // la firma, o su tono al pasar por encima
})

test('C4 · /c: en el ordenador, «Entrar» justo debajo del texto; en el móvil, abajo', async ({ page }) => {
  await ponerTema(page, 'hibrido')
  await simularApi(page, 'vacio')
  for (const [ancho, alto] of [[1280, 900], [390, 844]]) {
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
    const texto = await page.getByText(DICT['alta.c.sub'].es).boundingBox()
    const boton = await page.getByRole('button', { name: DICT['alta.c.entrar'].es }).boundingBox()
    const hueco = boton.y - (texto.y + texto.height)
    if (ancho > 768) expect(hueco, 'del texto al botón').toBeLessThanOrEqual(48)
    else expect(boton.y + boton.height, 'el botón, abajo').toBeGreaterThan(alto - 120)
  }
})

test('C5 · la noche, cuando se ha elegido: /c, /conductor y el arranque', async ({ page }) => {
  await ponerTema(page, 'noche')
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await servidor(page, estadoEn(4))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('entrada-conductor')).toHaveAttribute('data-theme', 'dark')
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('entrar-con-enlace')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('arranque')).toHaveAttribute('data-theme', 'dark')
})

test('C5 · la noche elegida solo en el pie de la web también vale; sin elegir nada, papel', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('prueba_web')) { localStorage.setItem('fds_tema_web', 'dark'); sessionStorage.setItem('prueba_web', '1') }
  })
  await simularApi(page, 'vacio')
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('entrar-con-enlace')).toHaveAttribute('data-theme', 'dark')
  // Si en el panel se eligió el día a mano, manda lo del panel.
  await page.evaluate(() => { localStorage.setItem('panel_theme', 'light'); localStorage.setItem('panel_theme_elegido', '1') })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('entrada-conductor')).toHaveAttribute('data-theme', 'light')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('entrada-conductor')).toHaveAttribute('data-theme', 'light')
})

test('C2 · la barra de pasos: el actual en tinta, los hechos más claros; el «Revisar» que aún no vale no es cian', async ({ page }) => {
  await ponerTema(page, 'hibrido')
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const s = await servidor(page, estadoEn(3))
  await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Dales acceso' })).toBeVisible()
  const barras = page.getByTestId('alta-barra')
  await expect(barras.nth(0)).toHaveAttribute('data-cual', 'hecho')
  await expect(barras.nth(2)).toHaveAttribute('data-cual', 'actual')
  await expect(barras.nth(3)).toHaveAttribute('data-cual', 'falta')
  const estilo = (i) => barras.nth(i).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).opacity])
  expect(await estilo(2)).toEqual(['rgb(16, 24, 26)', '1'])
  expect(await estilo(0)).toEqual(['rgb(16, 24, 26)', '0.4'])
  await expect(page.getByText(/Paso \d de 4/)).toHaveCount(0)
  // Una empresa sin furgonetas todavía: «Revisar» no se puede pulsar hasta pegar algo, y no parece roto.
  s.estado = estadoEn(1)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const revisar = page.getByRole('button', { name: DICT['alta.revisar'].es, exact: true })
  await expect(revisar).toBeDisabled()
  const [fondo, opacidad] = await revisar.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).opacity])
  expect(fondo).not.toBe('rgb(20, 231, 216)')
  expect(opacidad).toBe('1')
})

test('C3 · la ventana del acceso: el título a la altura de la X y el estado en mono, en su línea y con su color', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  await ponerTema(page, 'hibrido')
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await servidor(page, estadoEn(5))
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().click()
  const dialogo = page.getByRole('dialog')
  const titulo = await dialogo.getByRole('heading', { level: 2 }).boundingBox()
  const x = await dialogo.getByRole('button', { name: DICT['alta.cerrar'].es }).boundingBox()
  expect(Math.abs((titulo.y + titulo.height / 2) - (x.y + x.height / 2)), 'título y X, a la misma altura').toBeLessThanOrEqual(3)
  const estado = dialogo.getByTestId('acceso-estado')
  await expect(estado).toHaveText(DICT['alta.acc.sinEnlace'].es)
  await expect(estado).toHaveClass(/font-mono/)
  const caja = await estado.boundingBox()
  const boton = await dialogo.getByRole('button', { name: DICT['alta.acc.whatsapp'].es }).boundingBox()
  expect(caja.y + caja.height, 'el estado, en su línea').toBeLessThanOrEqual(boton.y)
  // Abierto: en verde (su color), distinto del gris de «Sin mandar».
  const gris = await estado.evaluate((el) => getComputedStyle(el).color)
  await page.keyboard.press('Escape')
  await expect(dialogo).toHaveCount(0)
  await page.getByTestId('boton-acceso').and(page.locator('[data-estado="abierto"]')).first().click()
  const verde = await page.getByRole('dialog').getByTestId('acceso-estado').evaluate((el) => getComputedStyle(el).color)
  await expect(page.getByRole('dialog').getByTestId('acceso-estado')).toHaveText(/^Abierto el \d{2} [A-Z]{3,4}$/)
  expect(verde).not.toBe(gris)
})
