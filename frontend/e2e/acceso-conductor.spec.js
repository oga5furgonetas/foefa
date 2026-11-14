/* global process */
/* EL ACCESO DEL CONDUCTOR (14-11-2026, CONTRATO-ALTA §1.6–1.9 y §2), con la API simulada.
   · Con su enlace personal (`/c#<token>`): el token sale de la dirección antes de pedir nada, no viaja en ninguna
     dirección ni en el Referer, la analítica mide `/c`; el canje sale al tocar «Entrar», sin la sesión del panel; el
     secreto del teléfono se crea una vez, se reutiliza y sobrevive a salir; otro teléfono, enlace caducado o renovado,
     demasiados intentos y sin red dicen lo suyo; quien entra así no tiene que elegir contraseña.
   · Con su correo (tercera tanda, A9): UN formulario, correo y contraseña (si la tiene) y «Entrar». Con contraseña
     entra con ella (Intro también), sin pedir ningún código; con la contraseña en blanco le llega un código; el gestor
     de contraseñas sigue rellenando; con código no se le obliga a elegir contraseña, con la contraseña inicial sí.
   · Tercera tanda: recargar antes de entrar no rompe el enlace (A4); 401 y 409 en el idioma de la pantalla (A8); la
     sesión del enlace que se corta pide el enlace otra vez, no el correo, y la web renueva sola la sesión (A3). */
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

// Lo que contesta el servidor de verdad (server.py, _ACCESO_NO_VALE / _ACCESO_OTRO_TELEFONO): siempre en español.
const SERVIDOR_401 = 'Este enlace ya no vale. Pide uno nuevo a tu empresa.'
const SERVIDOR_409 = 'Este enlace ya se abrió en otro teléfono. Pide uno nuevo a tu empresa.'
const DETALLE_401 = DICT['alta.c.e401'].es
const DETALLE_409 = DICT['alta.c.e409'].es
for (const [nombre, resp, texto, reintentar] of [
  ['otro teléfono', { status: 409, json: { detail: SERVIDOR_409 } }, DETALLE_409, false],
  ['enlace caducado', { status: 401, json: { detail: SERVIDOR_401 } }, DETALLE_401, false],
  ['enlace renovado (el viejo ya no existe)', { status: 401, json: { detail: SERVIDOR_401 } }, DETALLE_401, false],
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
      // La salida es pedir el enlace (lo dice el texto); el correo, solo como enlace secundario para quien lo tiene.
      await expect(page.getByRole('link', { name: 'Tengo correo y contraseña' })).toHaveAttribute('href', '/conductor')
    }
    expect(s.canjes).toHaveLength(1)
    // Con 401 o 409 el enlace ya no le sirve a este navegador: se olvida. Con lo demás se guarda para reintentar.
    const guardado = await page.evaluate(() => sessionStorage.getItem('fds_enlace_pendiente'))
    expect(guardado).toBe(resp.status === 401 || resp.status === 409 ? null : TOKEN)
    if (nombre === 'otro teléfono') await foto(page, `12-enlace-otro-telefono-${info.project.name}`)
  })
}

test('con el enlace · /c sin token: dice que falta el enlace y de dónde abrirlo, sin pedir nada', async ({ page }) => {
  const s = await preparar(page)
  await page.goto('/c', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('c-error')).toHaveText(DICT['alta.c.sinToken'].es)
  await expect(page.getByText(DETALLE_401)).toHaveCount(0)
  expect(s.canjes).toHaveLength(0)
})

/* A4 (revisión panel2, hallazgo 2): sin cobertura, el conductor toca Entrar, falla, y recarga (o el navegador descarga
   la pestaña). La dirección ya es `/c` a secas; antes salía «Este enlace ya no vale» con el enlace vivo. */
test('con el enlace · recargar sin haber entrado no lo rompe: vuelve a salir «Entrar» y entra con el mismo token', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const s = await preparar(page, { respuestas: [{ abortar: true }, { json: SESION }] })
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByTestId('c-error')).toHaveText(DICT['alta.c.eRed'].es)
  await expect.poll(() => page.url()).toMatch(/\/c$/)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Entrar en tu portal' })).toBeVisible()
  await expect(page.getByTestId('c-error')).toHaveCount(0)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Hola, ${nombreCorto}`) })).toBeVisible({ timeout: 15_000 })
  expect(s.canjes.map((c) => c.cuerpo.token)).toEqual([TOKEN, TOKEN])
  // Canjeado: fuera de la memoria de la pestaña.
  expect(await page.evaluate(() => sessionStorage.getItem('fds_enlace_pendiente'))).toBeNull()
})

/* A8 (revisión enlace, hallazgo 7): con el teléfono en inglés o alemán, el porqué salía en español (el `detail` del
   servidor). Ahora, el texto de la pantalla, en su idioma. */
for (const lang of ['en', 'de']) {
  for (const [nombre, resp, clave] of [['401', { status: 401, json: { detail: SERVIDOR_401 } }, 'alta.c.e401'], ['409', { status: 409, json: { detail: SERVIDOR_409 } }, 'alta.c.e409']]) {
    test(`con el enlace en «${lang}»: el ${nombre} sale en ${lang}, no en español`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.addInitScript((l) => localStorage.setItem('flota_lang', l), lang)
      await preparar(page, { respuestas: [resp] })
      await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: DICT['alta.c.entrar'][lang], exact: true }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['alta.c.noEntra'][lang])
      await expect(page.getByTestId('c-error')).toHaveText(DICT[clave][lang])
      await expect(page.getByText(/Pide uno nuevo a tu empresa/)).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })
  }
}

/* A8 (revisión enlace, hallazgos 11 y 12): en `/c` no sale la hoja de cookies; y ningún informe de error lleva el «#»
   (ni en `/c` ni en ninguna otra página de la web). */
test('un error de JavaScript se informa sin el «#» de la dirección, en /c y en cualquier página', async ({ page }) => {
  const informes = []
  await preparar(page)
  await page.route(/\/api\/client-error/, (r) => { informes.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }) })
  /* Un error que salta ANTES de que la pantalla quite el token de la dirección: para verlo, aquí la dirección no se
     limpia (replaceState no hace nada) y el error salta con el token todavía detrás de «#». */
  await page.addInitScript(() => { if (location.pathname === '/c') history.replaceState = () => {} })
  await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Entrar en tu portal' })).toBeVisible()
  expect(page.url()).toContain(TOKEN)
  await page.evaluate(() => setTimeout(() => { throw new Error('fallo de prueba en /c') }, 0))
  await expect.poll(() => informes.length).toBeGreaterThan(0)
  await page.goto('/cookies#un-secreto-cualquiera', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => setTimeout(() => { throw new Error('fallo de prueba en otra página') }, 0))
  await expect.poll(() => informes.length).toBeGreaterThan(1)
  for (const i of informes) {
    expect(i.url).not.toContain('#')
    expect(JSON.stringify(i)).not.toContain(TOKEN)
    expect(JSON.stringify(i)).not.toContain('un-secreto-cualquiera')
  }
  expect(informes.map((i) => new URL(i.url).pathname)).toEqual(expect.arrayContaining(['/c', '/cookies']))
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

/* ── La entrada de siempre, con el correo (A9) ──────────────────────────────────────────────────────────────── */
async function prepararCorreo(page, { configurarConClave = false, claveMala = false, metodoViejo = null } = {}) {
  await page.addInitScript((m) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    // Un teléfono con la marca de la versión anterior: ya no cambia nada (y se quita al entrar).
    if (m) localStorage.setItem('fds_dr_metodo', m)
  }, metodoViejo)
  await simularApi(page, 'vacio')
  const s = { lookup: 0, verify: 0, login: [] }
  const tok = jwt({ sub: 'd7', role: 'driver', name: 'LUIS GOMEZ', exp: Math.floor(Date.now() / 1000) + 3600 })
  await page.route(/\/api\/auth\/driver-lookup/, (r) => { s.lookup += 1; return r.fulfill({ json: { ok: true } }) })
  await page.route(/\/api\/auth\/driver-code\/verify/, (r) => { s.verify += 1; return r.fulfill({ json: { access_token: tok, id: 'd7', name: 'LUIS GOMEZ', center: 'NORTE', configurar_cuenta: false } }) })
  await page.route(/\/api\/auth\/driver-login/, (r) => {
    s.login.push(r.request().postDataJSON())
    if (claveMala) return r.fulfill({ status: 401, json: { detail: 'Correo o contraseña incorrectos' } })
    return r.fulfill({ json: { access_token: tok, id: 'd7', name: 'LUIS GOMEZ', center: 'NORTE', configurar_cuenta: configurarConClave } })
  })
  return s
}

test('con el correo: un formulario; sin contraseña, «Entrar» manda el código y con él entra sin elegir contraseña', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const s = await prepararCorreo(page)
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  // Un solo botón principal, «Entrar», y la pista debajo de la contraseña.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Recibir un código|Entrar con contraseña/ })).toHaveCount(0)
  await expect(page.getByText(DICT['alta.dr.pista'].es)).toBeVisible()
  // El gestor de contraseñas del móvil los reconoce: usuario y contraseña actual, dentro de un formulario.
  await expect(page.locator('form input[autocomplete="username"][type="email"]')).toHaveCount(1)
  await expect(page.locator('form input[autocomplete="current-password"][type="password"]')).toHaveCount(1)
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await foto(page, `14-entrada-correo-${info.project.name}`)
  /* La costumbre de siempre (correo, Intro, contraseña) no manda correos por sorpresa (14-11-2026): Intro en el correo
     con la contraseña vacía solo lleva el cursor a la contraseña. Intro otra vez, con ella vacía, sí pide el código. */
  await page.locator('#dr-correo').press('Enter')
  await expect(page.locator('#dr-clave')).toBeFocused()
  await page.waitForTimeout(400)
  expect(s.lookup).toBe(0)
  expect(s.login).toHaveLength(0)
  await expect(page.locator('#driver-code')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(page.locator('#driver-code')).toBeVisible()
  expect(s.lookup).toBe(1)
  expect(s.login).toHaveLength(0)
  await expect(page.getByText('Cuenta consultada:')).toBeVisible()
  await foto(page, `15-entrada-codigo-${info.project.name}`)
  await page.locator('#driver-code').fill('123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Elige tu contraseña/i)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fds_dr_metodo'))).toBeNull()
})

/* Revisión «flota», hallazgo 3 (dado la vuelta): el que entra CADA DÍA con su contraseña, el primer día tras publicar.
   Escribe su correo y su contraseña y pulsa Intro, como siempre: entra, sin que le llegue un código que no ha pedido. */
test('con el correo: quien entra cada día con correo + contraseña + Intro no nota nada (ni un código por correo)', async ({ page }) => {
  const s = await prepararCorreo(page, { metodoViejo: 'codigo' })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.locator('#dr-correo').press('Tab')
  await page.keyboard.type('mi-clave-de-siempre')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15_000 })
  expect(s.lookup).toBe(0)
  expect(s.login).toEqual([expect.objectContaining({ email: 'luis@ejemplo.test', password: 'mi-clave-de-siempre' })])
  expect(await page.evaluate(() => localStorage.getItem('fds_dr_metodo'))).toBeNull()
})

test('con el correo: correo, Intro, contraseña e Intro (la costumbre de siempre) entra sin ningún código', async ({ page }) => {
  const s = await prepararCorreo(page)
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.locator('#dr-correo').press('Enter')
  await expect(page.locator('#dr-clave')).toBeFocused()
  await page.keyboard.type('mi-clave-de-siempre')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15_000 })
  expect(s.lookup).toBe(0)
  expect(s.login).toEqual([expect.objectContaining({ email: 'luis@ejemplo.test', password: 'mi-clave-de-siempre' })])
})

test('con el correo: con la contraseña ya puesta (el gestor de contraseñas), Intro en el correo entra', async ({ page }) => {
  const s = await prepararCorreo(page)
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.locator('#dr-clave').fill('la-del-gestor')
  await page.locator('#dr-correo').press('Enter')
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15_000 })
  expect(s.lookup).toBe(0)
  expect(s.login).toHaveLength(1)
})

test('con el correo: con la contraseña inicial de la empresa sigue eligiendo la suya, como siempre', async ({ page }) => {
  const s = await prepararCorreo(page, { configurarConClave: true })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.locator('#dr-clave').fill('clave-inicial')
  await page.locator('#dr-clave').press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/contraseña/i, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toHaveCount(0)
  expect(s.lookup).toBe(0)
  expect(s.login).toHaveLength(1)
})

test('con el correo: si la contraseña falla, el error de siempre y la pista de dejarla en blanco; en blanco, el código', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const s = await prepararCorreo(page, { claveMala: true })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.locator('#dr-clave').fill('la-de-la-empresa')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByTestId('dr-error')).toHaveText('Correo o contraseña incorrectos')
  await expect(page.getByText(DICT['alta.dr.pista'].es)).toBeVisible()
  await foto(page, `16-entrada-clave-mala-${info.project.name}`)
  expect(s.lookup).toBe(0)
  await page.locator('#dr-clave').fill('')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.locator('#driver-code')).toBeVisible()
  expect(s.lookup).toBe(1)
  // «Usar contraseña» vuelve al formulario con el correo puesto y el cursor en la contraseña.
  await page.getByRole('button', { name: DICT['dr.usePassword'].es }).click()
  await expect(page.locator('#dr-correo')).toHaveValue('luis@ejemplo.test')
  await expect(page.locator('#dr-clave')).toBeFocused()
})

/* ── La sesión del enlace que se corta (A3; revisión enlace, hallazgo 3, dado la vuelta) ───────────────────────── */
async function prepararSesion(page, payload, { cortar = false } = {}) {
  const tok = jwt({ sub: 'd-ana', role: 'driver', name: 'Ana López', ...payload })
  await page.addInitScript((t) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    if (sessionStorage.getItem('puesto')) return
    sessionStorage.setItem('puesto', '1')
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd-ana', name: 'Ana López', email: null, center: null, configurar_cuenta: false }))
  }, tok)
  await simularApi(page, 'vacio')
  const s = { renovar: [] }
  await page.route(/\/api\/auth\/renovar$/, (r) => {
    s.renovar.push(r.request().headers().authorization || '')
    return r.fulfill({ json: { access_token: jwt({ sub: 'd-ana', role: 'driver', name: 'Ana López', ...payload, exp: payload.exp + 30 * 86400 }), role: 'driver', name: 'Ana López', id: 'd-ana', configurar_cuenta: false } })
  })
  // Lo que contesta el servidor en cuanto el dueño renueva o anula el enlace (_ACCESO_SESION_CORTADA).
  if (cortar) {
    await page.route(/\/api\/(portal|drivers|inspections|driver|auth\/me|conductor|shifts|vehicles)/, (r) => r.fulfill({ status: 401,
      json: { detail: 'Tu acceso ha cambiado: abre el último enlace que te ha mandado tu empresa.' } }))
  }
  return { s, tok }
}
const enDias = (d) => Math.floor(Date.now() / 1000) + d * 86400

test('la sesión del enlace cortada: «Este acceso ya no vale», pide el enlace a su empresa; el correo, solo si lo tiene', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(20) }, { cortar: true })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: DICT['alta.dr.enlaceTitulo'].es })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('dr-enlace-caducado')).toHaveText(DICT['alta.dr.enlaceTexto'].es)
  const texto = await page.getByRole('main').innerText()
  expect(texto).not.toContain('Vuelve a entrar con tu correo')
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
  await foto(page, `17-enlace-cortado-${info.project.name}`)
  // Recargar no le devuelve a «entra con tu correo».
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: DICT['alta.dr.enlaceTitulo'].es })).toBeVisible()
  // Si tiene correo y contraseña, la salida secundaria le abre el formulario.
  await page.getByRole('button', { name: 'Tengo correo y contraseña' }).click()
  await expect(page.locator('#dr-correo')).toBeVisible()
  await expect(page.locator('#dr-clave')).toBeVisible()
})

test('control: la sesión del CÓDIGO que caduca sigue diciendo «vuelve a entrar con tu correo»', async ({ page }) => {
  await prepararSesion(page, { via: 'codigo', exp: enDias(20) }, { cortar: true })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#dr-correo')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(DICT['dr.caducada'].es)).toBeVisible()
  await expect(page.getByRole('heading', { name: DICT['alta.dr.enlaceTitulo'].es })).toHaveCount(0)
})

/* El camino de verdad (revisión enlace3, hallazgo 1): quien entra con su enlace queda en `/conductor#<slug de su
   empresa>`. El interceptor le mandaba a esa MISMA dirección con el mismo «#», el navegador no recargaba y se quedaba
   en un portal vacío («Hola, Ana» sin nada) en vez de ver «Este acceso ya no vale». */
const SLUG = 'transportes-perez'
const cortarSesion = (page) => page.route(/\/api\/(portal|drivers|inspections|driver|auth\/me|conductor|shifts|vehicles)/, (r) => r.fulfill({ status: 401,
  json: { detail: 'Tu acceso ha cambiado: abre el último enlace que te ha mandado tu empresa.' } }))

test('con el slug en la dirección, abriendo el portal por la mañana con la sesión ya cortada: «Este acceso ya no vale»', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(20) }, { cortar: true })
  await page.goto(`/conductor#${SLUG}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: DICT['alta.dr.enlaceTitulo'].es })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('dr-enlace-caducado')).toHaveText(DICT['alta.dr.enlaceTexto'].es)
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toHaveCount(0)
  // Sigue en la dirección de su empresa (el «#» no se pierde) y ya sin sesión.
  expect(page.url()).toMatch(new RegExp(`/conductor#${SLUG}$`))
  expect(await page.evaluate(() => localStorage.getItem('flota_driver_token'))).toBeNull()
  await foto(page, `18-enlace-cortado-con-slug-${info.project.name}`)
})

test('con el slug en la dirección, dentro del portal: el dueño renueva el enlace y a la siguiente petición sale el aviso', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(29) })
  await page.goto(`/conductor#${SLUG}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  // Ahora la empresa le manda uno nuevo: la sesión de este teléfono deja de valer.
  await cortarSesion(page)
  await page.getByRole('button', { name: /Hacer la revisión/ }).click()
  await expect(page.getByRole('heading', { name: DICT['alta.dr.enlaceTitulo'].es })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/No hay vehículos disponibles/)).toHaveCount(0)
  expect(page.url()).toMatch(new RegExp(`/conductor#${SLUG}$`))
})

test('con el slug y la sesión del CÓDIGO cortada: «vuelve a entrar con tu correo» (también se quedaba en el portal), sin bucle de recargas', async ({ page }) => {
  let cargas = 0
  page.on('load', () => { cargas += 1 })
  await prepararSesion(page, { via: 'codigo', exp: enDias(20) }, { cortar: true })
  await page.goto(`/conductor#${SLUG}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#dr-correo')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(DICT['dr.caducada'].es)).toBeVisible()
  await page.waitForTimeout(1500)
  expect(cargas, 'una carga y una recarga, nada más').toBeLessThanOrEqual(2)
})

/* La sesión nacida del enlace no tiene contraseña ni correo de recuperación que poner (el servidor contesta 403
   `enlace_sin_contrasena`): el portal no los ofrece, y dice una línea tranquila en su lugar. Las de código, como siempre. */
const LINEA_ENLACE = 'Entras con tu enlace. Si quieres contraseña, pídesela a tu empresa.'
test('el portal con la sesión del enlace: sin «Cambiar mi contraseña» ni «Correo de recuperación», con su línea', async ({ page }, info) => {
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(29) })
  await page.route(/\/api\/portal\/mi-ficha/, (r) => r.fulfill({ json: { falta_telefono: false, tiene_clave: false, configurar_cuenta: false } }))
  await page.goto(`/conductor#${SLUG}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('portal-con-enlace')).toHaveText(LINEA_ENLACE)
  for (const fuera of [/Cambiar mi contraseña/, /Crear mi contraseña/, /Correo de recuperación/, /correo personal/i, /Sal de la cuenta/]) {
    await expect(page.getByText(fuera)).toHaveCount(0)
  }
  await foto(page, `19-portal-enlace-${info.project.name}`)
})

test('control: el portal con la sesión del código sigue con «Crear mi contraseña» y «Correo de recuperación»', async ({ page }) => {
  await prepararSesion(page, { via: 'codigo', exp: enDias(29) })
  await page.route(/\/api\/portal\/mi-ficha/, (r) => r.fulfill({ json: { falta_telefono: false, tiene_clave: false, configurar_cuenta: false } }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Crear mi contraseña/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Correo de recuperación/ })).toBeVisible()
  await expect(page.getByTestId('portal-con-enlace')).toHaveCount(0)
})

test('el portal con la sesión del enlace: si el teléfono ya estaba, el 403 no se le enseña; deja de pedirlo', async ({ page }) => {
  await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(29) })
  await page.route(/\/api\/portal\/mi-ficha/, (r) => r.fulfill({ json: { falta_telefono: true, tiene_clave: false, configurar_cuenta: false } }))
  await page.route(/\/api\/portal\/mi-telefono/, (r) => r.fulfill({ status: 403, json: {
    detail: 'Con el enlace no se puede cambiar el teléfono. Pide a tu empresa que te lo cambie.', codigo: 'enlace_sin_cambiar_telefono' } }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('¿Cuál es tu teléfono?')).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Teléfono').fill('612345678')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('¿Cuál es tu teléfono?')).toHaveCount(0)
  await expect(page.getByText(/no se puede cambiar el teléfono/)).toHaveCount(0)
})

test('la web renueva sola la sesión del conductor a partir del quinto día, una vez al día como mucho', async ({ page }) => {
  const { s, tok } = await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(20) })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => s.renovar.length).toBe(1)
  expect(s.renovar[0]).toBe(`Bearer ${tok}`)
  // La sesión nueva queda guardada, y es la que se usa desde entonces.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('flota_driver_token'))).not.toBe(tok)
  // El mismo día no se vuelve a pedir, aunque se recargue.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(800)
  expect(s.renovar).toHaveLength(1)
})

test('con la sesión recién estrenada no se renueva; y si renovar falla, no le echa', async ({ page }) => {
  const { s } = await prepararSesion(page, { lk: 'x', via: 'enlace', exp: enDias(29) })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(800)
  expect(s.renovar).toHaveLength(0)
  // Con pocos días y una renovación que falla (401): sigue dentro, sin avisos.
  const p2 = await page.context().newPage()
  const tok = jwt({ sub: 'd-ana', role: 'driver', name: 'Ana López', via: 'codigo', exp: enDias(3) })
  await p2.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.removeItem('fds_dr_renovado_el')
  }, tok)
  await simularApi(p2, 'vacio')
  let pedidas = 0
  await p2.route(/\/api\/auth\/renovar$/, (r) => { pedidas += 1; return r.fulfill({ status: 401, json: { detail: 'Tu sesión ha caducado: entra otra vez' } }) })
  await p2.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(p2.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => pedidas).toBe(1)
  await p2.waitForTimeout(800)
  await expect(p2.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
  expect(await p2.evaluate(() => localStorage.getItem('flota_driver_token'))).toBe(tok)
  await p2.close()
})

/* A13: un teléfono en un idioma que no tenemos (rumano, árabe) ve la entrada en español, no en inglés. */
for (const locale of ['ro-RO', 'ar-SA']) {
  test(`la entrada del conductor con el teléfono en ${locale}: en español`, async ({ browser }, info) => {
    const ctx = await browser.newContext({ locale, viewport: { width: 360, height: 740 }, baseURL: info.project.use.baseURL })
    const page = await ctx.newPage()
    await simularApi(page, 'vacio')
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['dr.portal'].es)
    await expect(page.getByText(DICT['alta.dr.pista'].es)).toBeVisible()
    await ctx.close()
  })
}

for (const lang of ['en', 'fr', 'de', 'it', 'pt']) {
  test(`la entrada del conductor y la del enlace en «${lang}» no dejan textos en español`, async ({ page }) => {
    await page.addInitScript((l) => localStorage.setItem('flota_lang', l), lang)
    await preparar(page)
    const fijos = ['Cuenta consultada:', 'Cambiar correo', '¿No tienes contraseña?', 'Tengo correo y contraseña', 'Entrar en tu portal', 'No necesitas contraseña']
    await page.goto(`/c#${TOKEN}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['alta.c.titulo'][lang])
    let texto = await page.getByRole('main').innerText()
    expect(fijos.filter((f) => texto.includes(f))).toEqual([])
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill('luis@ejemplo.test')
    texto = await page.getByRole('main').innerText()
    expect(fijos.filter((f) => texto.includes(f))).toEqual([])
    await expect(page.getByText(DICT['alta.dr.pista'][lang])).toBeVisible()
    await expect(page.getByRole('button', { name: DICT['alta.dr.entrar'][lang], exact: true })).toBeVisible()
  })
}

/* TANDA 5 (14-11-2026, U7): el conductor lee lo mismo que el dueño: «Correo» (no «Email») y, dentro, «Hacer la revisión»
   (no «auditoría»), también la cabecera de la revisión. */
test('tanda 5 · «Correo» en la entrada y «Hacer la revisión» en el portal, sin «Email» ni «auditoría»', async ({ page }) => {
  await prepararCorreo(page)
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Correo', { exact: true })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/E-?mail/i)
  // Y su ejemplo, también «correo» (tanda 6): decía «tu.email@empresa.com».
  await expect(page.getByLabel('Correo', { exact: true })).toHaveAttribute('placeholder', 'tu.correo@empresa.com')
  await page.locator('#dr-correo').fill('luis@ejemplo.test')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.locator('#driver-code').fill('123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const portal = page.getByRole('button', { name: /Hacer la revisión/ })
  await expect(portal).toBeVisible({ timeout: 15_000 })
  expect(await page.locator('body').innerText()).not.toMatch(/auditor/i)
  await portal.click()
  await expect(page.getByText('Revisión diaria', { exact: true })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/auditor|inspecci/i)
})
