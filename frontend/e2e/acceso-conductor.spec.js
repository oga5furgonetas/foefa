/* global process */
/* EL ACCESO DEL CONDUCTOR (14-11-2026, CONTRATO-ALTA §1.6–1.9 y §2), con la API simulada.
   · Con su enlace personal (`/c#<token>`): el token sale de la dirección antes de pedir nada, no viaja en ninguna
     dirección ni en el Referer, la analítica mide `/c`; el canje sale al tocar «Entrar», sin la sesión del panel; el
     secreto del teléfono se crea una vez, se reutiliza y sobrevive a salir; otro teléfono, enlace caducado o renovado,
     demasiados intentos y sin red dicen lo suyo; quien entra así no tiene que elegir contraseña.
   · Con su correo: «Recibir un código» es el botón principal; la contraseña, el secundario; el teléfono recuerda si
     la última vez entró con contraseña; con código no se le obliga a elegir contraseña, con la contraseña inicial sí. */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simularApi } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const ENLACE = JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', 'alta-enlace.json'), 'utf8'))
const TOKEN = 'a3f1c9e7b5d3f1a9c7e5b3d1f9a7c5e3b1d9f7a5c3e1b9d7f5a3c1e9b7d5f3a1'
const FOTOS_DIR = process.env.FOTOS_ALTA || ''

/* Una sesión de conductor que el portal acepta (lee el `exp`): la del servidor de pruebas es un ejemplo sin forma. */
function jwt(payload) {
  const b64 = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma-de-prueba`
}
const SESION = { ...ENLACE, access_token: jwt({ sub: ENLACE.id, role: 'driver', name: ENLACE.name, via: 'enlace', exp: Math.floor(Date.now() / 1000) + 3600 }) }
const nombreCorto = String(ENLACE.name).split(' ')[0]

async function preparar(page, { respuestas = [], panel = false } = {}) {
  await page.addInitScript(({ panel }) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    if (panel) localStorage.setItem('flota_token', 'sesion-del-panel')
  }, { panel })
  await simularApi(page, 'vacio')
  const s = { canjes: [], peticiones: [], analitica: [] }
  page.on('request', (r) => s.peticiones.push({ url: r.url(), referer: r.headers().referer || '' }))
  await page.route(/\/api\/analitica\/evento/, (r) => { s.analitica.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }) })
  let i = 0
  await page.route(/\/api\/auth\/enlace$/, (r) => {
    s.canjes.push({ cuerpo: r.request().postDataJSON(), auth: r.request().headers().authorization || null })
    const resp = respuestas[Math.min(i++, respuestas.length - 1)] || { json: SESION }
    if (resp.abortar) return r.abort('internetdisconnected')
    return r.fulfill({ status: resp.status || 200, json: resp.json, headers: { 'Cache-Control': 'no-store' } })
  })
  return s
}

async function foto(page, nombre) {
  if (!FOTOS_DIR) return
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(FOTOS_DIR, `${nombre}.png`), fullPage: true })
}

test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid' })

test('con el enlace: un toque, y dentro de su portal sin contraseña; el token no sale a ninguna parte', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const s = await preparar(page)
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Entrar en tu portal' })).toBeVisible()
  // Fuera de la dirección antes de tocar nada; y no se ha canjeado solo.
  await expect.poll(() => page.url()).toMatch(/\/c$/)
  expect(s.canjes).toHaveLength(0)
  await foto(page, `10-enlace-entrar-${info.project.name}`)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(new RegExp(`/conductor#${ENLACE.slug}$`))
  // El canje: el token y el secreto del teléfono, sin la sesión de nadie.
  expect(s.canjes).toHaveLength(1)
  expect(s.canjes[0].cuerpo.token).toBe(TOKEN)
  expect(s.canjes[0].cuerpo.dispositivo).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
  expect(s.canjes[0].auth).toBeNull()
  // La sesión, donde va la del conductor; y no se le pide elegir contraseña.
  const guardado = await page.evaluate(() => ({ t: localStorage.getItem('flota_driver_token'), d: JSON.parse(localStorage.getItem('flota_driver')) }))
  expect(guardado.t).toBe(SESION.access_token)
  expect(guardado.d).toMatchObject({ id: ENLACE.id, name: ENLACE.name, configurar_cuenta: false })
  await expect(page.getByText(/Elige tu contraseña/i)).toHaveCount(0)
  // Ni en ninguna dirección pedida, ni en ningún Referer, ni en la analítica.
  for (const p of s.peticiones) {
    expect(p.url, 'una petición lleva el token en la dirección').not.toContain(TOKEN)
    expect(p.referer, 'un Referer lleva el token').not.toContain(TOKEN)
  }
  expect(JSON.stringify(s.analitica)).not.toContain(TOKEN)
  expect(s.analitica.some((e) => e.ruta === '/c')).toBe(true)
  await foto(page, `11-enlace-dentro-${info.project.name}`)
})

test('el secreto del teléfono: uno, el mismo la segunda vez, y salir del portal no lo borra', async ({ page }) => {
  const s = await preparar(page)
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  const secreto = await page.evaluate(() => localStorage.getItem('fds_dispositivo'))
  expect(secreto).toBe(s.canjes[0].cuerpo.dispositivo)
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fds_dispositivo'))).toBe(secreto)
  // Segunda vez en el mismo teléfono: el mismo secreto.
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  expect(s.canjes.map((c) => c.cuerpo.dispositivo)).toEqual([secreto, secreto])
})

const DETALLE_401 = DICT['alta.c.e401'].es
const DETALLE_409 = DICT['alta.c.e409'].es
for (const [nombre, resp, texto, reintentar] of [
  ['otro teléfono', { status: 409, json: { detail: DETALLE_409 } }, DETALLE_409, false],
  ['enlace caducado', { status: 401, json: { detail: DETALLE_401 } }, DETALLE_401, false],
  ['enlace renovado (el viejo ya no existe)', { status: 401, json: { detail: DETALLE_401 } }, DETALLE_401, false],
  ['demasiados intentos', { status: 429, json: { detail: 'Demasiados intentos fallidos. Espera 5 minutos.' } }, DICT['alta.c.e429'].es, false],
  ['sin red', { abortar: true }, DICT['alta.c.eRed'].es, true],
  ['un fallo del servidor', { status: 500, json: { detail: 'Internal Server Error' } }, DICT['alta.c.eOtro'].es, true],
]) {
  test(`con el enlace · ${nombre}: lo dice claro`, async ({ page }, info) => {
    const s = await preparar(page, { respuestas: [resp] })
    await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByTestId('c-error')).toHaveText(texto)
    await expect(page.getByText(/Internal Server Error/)).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('flota_driver_token'))).toBeNull()
    if (reintentar) {
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled()
    } else {
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Entrar con tu correo' })).toHaveAttribute('href', '/conductor')
    }
    expect(s.canjes).toHaveLength(1)
    if (nombre === 'otro teléfono') await foto(page, `12-enlace-otro-telefono-${info.project.name}`)
  })
}

test('con el enlace · /c sin token: el mensaje de enlace que ya no vale, sin pedir nada', async ({ page }) => {
  const s = await preparar(page)
  await page.goto('/c', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('c-error')).toHaveText(DETALLE_401)
  expect(s.canjes).toHaveLength(0)
})

test('con el enlace escrito como ruta (/c/<token>): sale de la dirección y la analítica no lo ve', async ({ page }) => {
  const s = await preparar(page)
  await page.goto(`/c/${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.url()).toMatch(/\/c$/)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  expect(s.canjes[0].cuerpo.token).toBe(TOKEN)
  expect(JSON.stringify(s.analitica)).not.toContain(TOKEN)
})

test('con el enlace y una sesión del panel en el navegador: avisa antes; «Abrirlo igualmente» entra sin mandar la del panel', async ({ page }, info) => {
  const s = await preparar(page, { panel: true })
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(DICT['alta.c.avisoPanel'].es)).toBeVisible()
  await expect(page.getByRole('link', { name: 'No abrirlo' })).toHaveAttribute('href', '/panel')
  await foto(page, `13-enlace-aviso-panel-${info.project.name}`)
  await page.getByRole('button', { name: 'Abrirlo igualmente' }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  expect(s.canjes[0].auth).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('flota_token'))).toBe('sesion-del-panel')
})

/* ── La entrada de siempre, con el correo ───────────────────────────────────────────────────────────────────── */
async function prepararCorreo(page, { metodo = null, configurarConClave = false } = {}) {
  await page.addInitScript((m) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    if (m) localStorage.setItem('fds_dr_metodo', m)
  }, metodo)
  await simularApi(page, 'vacio')
  const s = { lookup: 0, verify: 0, login: 0 }
  const tok = jwt({ sub: 'd7', role: 'driver', name: 'LUIS GOMEZ', exp: Math.floor(Date.now() / 1000) + 3600 })
  await page.route(/\/api\/auth\/driver-lookup/, (r) => { s.lookup += 1; return r.fulfill({ json: { ok: true } }) })
  await page.route(/\/api\/auth\/driver-code\/verify/, (r) => { s.verify += 1; return r.fulfill({ json: { access_token: tok, id: 'd7', name: 'LUIS GOMEZ', center: 'NORTE', configurar_cuenta: false } }) })
  await page.route(/\/api\/auth\/driver-login/, (r) => { s.login += 1; return r.fulfill({ json: { access_token: tok, id: 'd7', name: 'LUIS GOMEZ', center: 'NORTE', configurar_cuenta: configurarConClave } }) })
  return s
}

test('con el correo: «Recibir un código» es lo principal y Enter lo pide; con el código, dentro sin elegir contraseña', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const s = await prepararCorreo(page)
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill('luis@ejemplo.test')
  const botones = page.getByRole('button').filter({ hasText: /Recibir un código|Entrar con contraseña/ })
  await expect(botones).toHaveText(['Recibir un código', 'Entrar con contraseña'])
  await foto(page, `14-entrada-correo-${info.project.name}`)
  await page.locator('input[type="email"]').press('Enter')
  await expect(page.locator('#driver-code')).toBeVisible()
  expect(s.lookup).toBe(1)
  await expect(page.getByText('Cuenta consultada:')).toBeVisible()
  await page.locator('#driver-code').fill('123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Elige tu contraseña/i)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fds_dr_metodo'))).toBe('codigo')
  expect(s.login).toBe(0)
})

test('con el correo: quien entró con contraseña en este teléfono la tiene delante; con la inicial, sigue eligiendo la suya', async ({ page }) => {
  const s = await prepararCorreo(page, { metodo: 'clave', configurarConClave: true })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill('luis@ejemplo.test')
  const botones = page.getByRole('button').filter({ hasText: /Recibir un código|Entrar con contraseña/ })
  await expect(botones).toHaveText(['Entrar con contraseña', 'Recibir un código'])
  await page.locator('input[type="email"]').press('Enter')
  await page.locator('input[autocomplete="current-password"]').fill('clave-inicial')
  await page.locator('input[autocomplete="current-password"]').press('Enter')
  // La contraseña inicial de la empresa: sigue obligado a elegir la suya (como hoy).
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/contraseña/i, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toHaveCount(0)
  expect(s.lookup).toBe(0)
  expect(s.login).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('fds_dr_metodo'))).toBe('clave')
})

for (const lang of ['en', 'fr', 'de', 'it', 'pt']) {
  test(`la entrada del conductor y la del enlace en «${lang}» no dejan textos en español`, async ({ page }) => {
    await page.addInitScript((l) => localStorage.setItem('flota_lang', l), lang)
    await preparar(page)
    const fijos = ['Cuenta consultada:', 'Cambiar correo', 'Recibir un código', 'Entrar con contraseña', 'Entrar en tu portal', 'No necesitas contraseña']
    await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['alta.c.titulo'][lang])
    let texto = await page.getByRole('main').innerText()
    expect(fijos.filter((f) => texto.includes(f))).toEqual([])
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill('luis@ejemplo.test')
    texto = await page.getByRole('main').innerText()
    expect(fijos.filter((f) => texto.includes(f))).toEqual([])
    await expect(page.getByRole('button', { name: DICT['alta.dr.codigo'][lang] })).toBeVisible()
  })
}
