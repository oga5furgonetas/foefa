import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA MEDICIÓN DE ANUNCIOS EN EL ALTA (02-11-2026). El servidor avisa a Meta del alta por la API de conversiones solo
   si la persona aceptó la medición en el aviso de cookies: el alta le dice `anuncios` (true o false; null si no
   contestó o si esta web no pregunta) y, SOLO con la medición aceptada, le pasa las cookies del píxel (_fbp, _fbc),
   que a la API, en otro dominio, no le llegan. Y el píxel recibe el mismo id que usa el servidor (`meta_event_id`)
   para que Meta cuente el alta una vez y no dos. Vale para las dos compilaciones: la de siempre, sin píxeles (aquí no
   se pregunta nada: null y ninguna cookie), y una con VITE_META_PIXEL_ID (lo que contestó, las cookies y el eventID). */

const FBP = 'fb.1.1761980000000.1234567890'
const FBC = 'fb.1.1761980000000.IwAR0deprueba'
const ALTA = { access_token: 'cabecera.eyJzdWIiOiJ1MSJ9.firma', token_type: 'bearer', id: 'u1', name: 'Ana', role: 'admin',
  account_type: 'dsp', slug: 'ana-x1y2', meta_event_id: 'reg-u1' }

/* ¿Esta compilación lleva píxeles? La política de cookies solo nombra _fbp si los lleva (legal/Cookies.jsx). */
let conPixel = false
test.beforeAll(async ({ browser }, info) => {
  const p = await browser.newPage({ baseURL: info.project.use.baseURL })
  await p.goto('/cookies', { waitUntil: 'domcontentloaded' })
  await expect(p.getByRole('heading').first()).toBeVisible()
  conPixel = (await p.locator('body').innerText()).includes('_fbp')
  await p.close()
})

/* El navegador ya tiene las cookies del píxel y, si se da, lo contestado en el aviso. El píxel no se descarga: un fbq
   de mentira apunta cada llamada en el móvil (sobrevive al salto a /ruta del alta rápida). Devuelve los cuerpos que
   llegan a /auth/register. */
async function preparar(page, anuncios) {
  const aviso = anuncios === undefined ? '' : JSON.stringify({ v: 3, anuncios, at: '2026-11-02T08:00:00Z' })
  await page.addInitScript(({ aviso, fbp, fbc }) => {
    if (aviso) localStorage.setItem('cookie_consent', aviso)
    localStorage.setItem('fds_instalar_cerrado', '1')
    document.cookie = `_fbp=${fbp}; path=/`
    document.cookie = `_fbc=${fbc}; path=/`
    window.fbq = (...args) => {
      const l = JSON.parse(localStorage.getItem('prueba_fbq') || '[]')
      l.push(args)
      localStorage.setItem('prueba_fbq', JSON.stringify(l))
    }
  }, { aviso, fbp: FBP, fbc: FBC })
  await simularApi(page, 'vacio')
  await page.route(/connect\.facebook\.net|analytics\.tiktok\.com/, (r) => r.abort())
  const altas = []
  await page.route(/\/api\/auth\/register$/, async (r) => { altas.push(r.request().postDataJSON()); await r.fulfill({ json: ALTA }) })
  // Tras el alta rápida se salta a /ruta: basta una página vacía del mismo sitio.
  await page.route(/\/ruta$/, (r) => (r.request().resourceType() === 'document'
    ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>ruta</title>' }) : r.fallback()))
  return altas
}

const llamadasPixel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('prueba_fbq') || '[]'))

/* El alta rápida de /repartidores (la versión con el alta arriba). */
async function altaRapida(page) {
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  const form = page.getByRole('form', { name: 'Crear mi cuenta gratis' })
  await form.getByPlaceholder('Tu nombre').fill('Ana')
  await form.getByPlaceholder('Tu correo').fill('ana@example.com')
  await form.getByPlaceholder('Contraseña').fill('una-clave-de-prueba')
  await form.getByRole('checkbox').check()
  await form.getByRole('button', { name: 'Crear mi cuenta gratis' }).click()
  await page.waitForURL(/\/ruta$/)
}

test.describe('el alta y la medición de anuncios', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 1280, height: 1600 } })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('sin contestar al aviso: el alta dice anuncios null y no manda las cookies de Meta', async ({ page }) => {
    const altas = await preparar(page)
    await altaRapida(page)
    expect(altas).toHaveLength(1)
    expect(altas[0]).toHaveProperty('anuncios', null)
    expect(altas[0]).not.toHaveProperty('fbp')
    expect(altas[0]).not.toHaveProperty('fbc')
    expect((await llamadasPixel(page)).filter((a) => a[1] === 'CompleteRegistration')).toEqual([])
  })

  test('con «Solo necesarias»: ni cookies ni píxel, y el servidor lo sabe', async ({ page }) => {
    const altas = await preparar(page, false)
    await altaRapida(page)
    expect(altas[0]).toHaveProperty('anuncios', conPixel ? false : null)
    expect(altas[0]).not.toHaveProperty('fbp')
    expect(altas[0]).not.toHaveProperty('fbc')
    expect(await llamadasPixel(page)).toEqual([])
  })

  test('con la medición aceptada: lo dice, pasa las cookies y el píxel lleva el id del servidor', async ({ page }) => {
    const altas = await preparar(page, true)
    await altaRapida(page)
    const llamadas = await llamadasPixel(page)
    if (!conPixel) {
      // Sin píxeles en la compilación no se pregunta nada: lo guardado de otra vez no vale para Meta.
      expect(altas[0]).toHaveProperty('anuncios', null)
      expect(altas[0]).not.toHaveProperty('fbp')
      expect(llamadas).toEqual([])
      return
    }
    expect(altas[0]).toMatchObject({ anuncios: true, fbp: FBP, fbc: FBC })
    if (llamadas.some((a) => a[0] === 'init')) {
      expect(llamadas).toContainEqual(['track', 'CompleteRegistration', { content_name: 'autonomo', status: true }, { eventID: 'reg-u1' }])
      // Lo que no tiene id en el servidor sigue con sus tres argumentos de siempre.
      expect(llamadas).toContainEqual(['track', 'Lead', { content_name: 'alta_en_portada' }])
    }
  })

  test('el alta de /registro (quien reparte solo) manda lo mismo', async ({ page }) => {
    const altas = await preparar(page, true)
    await page.goto('/registro?sector=autonomo&plan=autonomo', { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Pepe').fill('Ana')
    await page.getByPlaceholder('tu@correo.com').fill('ana@example.com')
    await page.locator('input[autocomplete="new-password"]').fill('una-clave-de-prueba')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
    await expect(page.getByText('¡Cuenta creada!')).toBeVisible()
    expect(altas).toHaveLength(1)
    if (!conPixel) {
      expect(altas[0]).toHaveProperty('anuncios', null)
      expect(altas[0]).not.toHaveProperty('fbp')
      return
    }
    expect(altas[0]).toMatchObject({ anuncios: true, fbp: FBP, fbc: FBC })
    const llamadas = await llamadasPixel(page)
    if (llamadas.some((a) => a[0] === 'init')) {
      expect(llamadas).toContainEqual(['track', 'CompleteRegistration', { content_name: 'autonomo', status: true }, { eventID: 'reg-u1' }])
    }
  })
})

/* CAMBIAR DE OPINIÓN LLEGA AL SERVIDOR (02-11-2026, revisión del servidor). Con el permiso de los píxeles el servidor
   también avisa a Meta, y ese permiso solo se le decía en el alta. Ahora «Cambiar mis cookies» vuelve a abrir el aviso,
   y lo que se elige con la sesión de la cuenta abierta va a POST /cuenta/anuncios; sin sesión, la retirada queda
   apuntada y se manda al entrar. Nunca con la plataforma «entrando como» un cliente. Sin píxeles no hay nada que
   cambiar: ni aviso ni botón. */
test.describe('cambiar de opinión sobre la medición', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 1280, height: 1600 } })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  // Lo que llega a POST /cuenta/anuncios (el cuerpo y la sesión con que llega).
  async function cuenta(page) {
    const l = []
    await page.route(/\/api\/cuenta\/anuncios$/, async (r) => {
      l.push({ cuerpo: r.request().postDataJSON(), auth: r.request().headers().authorization || '' })
      await r.fulfill({ json: { ok: true } })
    })
    return l
  }
  const guardado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cookie_consent') || 'null'))

  test('«Cambiar mis cookies» vuelve a abrir el aviso; con la sesión abierta, lo elegido llega a la cuenta', async ({ page }) => {
    await preparar(page, true)
    await page.addInitScript((t) => localStorage.setItem('flota_token', t), ALTA.access_token)
    const llegan = await cuenta(page)
    await page.goto('/cookies', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /Cookies/ }).first()).toBeVisible()
    const cambiar = page.getByRole('button', { name: 'Cambiar mis cookies' })
    if (!conPixel) {
      await expect(cambiar).toHaveCount(0)
      await expect(page.getByRole('dialog', { name: 'Cookies' })).toHaveCount(0)
      expect(llegan).toEqual([])
      return
    }
    const aviso = page.getByRole('dialog', { name: 'Cookies' })
    await expect(aviso).toHaveCount(0)                                   // ya contestado
    await cambiar.click()
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('nuestro servidor también avisa a Meta de tu alta')
    await aviso.getByRole('button', { name: 'Solo necesarias' }).click()
    await expect(aviso).toHaveCount(0)
    await expect.poll(() => llegan.map((x) => x.cuerpo)).toEqual([{ anuncios: false }])
    expect(llegan[0].auth).toBe(`Bearer ${ALTA.access_token}`)
    // Los píxeles dejan de medir y sus cookies se van de este navegador; la retirada no queda pendiente.
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/_fbp|_fbc/)
    expect(await llamadasPixel(page)).toContainEqual(['consent', 'revoke'])
    const tras = await guardado(page)
    expect(tras).toMatchObject({ v: 3, anuncios: false })
    expect(tras).not.toHaveProperty('retirada_pendiente')
    // Y otra vez «Aceptar»: también llega, y el píxel vuelve a medir.
    await cambiar.click()
    await aviso.getByRole('button', { name: 'Aceptar' }).click()
    await expect.poll(() => llegan.map((x) => x.cuerpo)).toEqual([{ anuncios: false }, { anuncios: true }])
    expect(await llamadasPixel(page)).toContainEqual(['consent', 'grant'])
  })

  test('sin sesión, la retirada queda apuntada y llega a la cuenta en cuanto se entra', async ({ page }) => {
    test.skip(!conPixel, 'sin píxeles en la compilación no hay aviso')
    await preparar(page)                                                 // sin contestar: sale el aviso
    const llegan = await cuenta(page)
    await page.goto('/cookies', { waitUntil: 'domcontentloaded' })
    const aviso = page.getByRole('dialog', { name: 'Cookies' })
    await aviso.getByRole('button', { name: 'Solo necesarias' }).click()
    await page.waitForTimeout(400)
    expect(llegan).toEqual([])
    expect(await guardado(page)).toMatchObject({ anuncios: false, retirada_pendiente: true })
    // Entra (la sesión de la cuenta) y cambia de pantalla sin recargar.
    await page.evaluate((t) => localStorage.setItem('flota_token', t), ALTA.access_token)
    await page.getByRole('link', { name: 'Privacidad', exact: true }).first().click()
    await expect(page).toHaveURL(/\/privacidad$/)
    await expect.poll(() => llegan.map((x) => x.cuerpo)).toEqual([{ anuncios: false }])
    await expect.poll(async () => (await guardado(page)).retirada_pendiente ?? null).toBe(null)
    // Una vez: otra pantalla no la vuelve a mandar.
    await page.getByRole('link', { name: 'Cookies', exact: true }).first().click()
    await page.waitForTimeout(400)
    expect(llegan).toHaveLength(1)
  })

  test('con la plataforma «entrando como» un cliente, lo elegido no se lleva a la cuenta del cliente', async ({ page }) => {
    test.skip(!conPixel, 'sin píxeles en la compilación no hay aviso')
    await preparar(page, true)
    await page.addInitScript((t) => { localStorage.setItem('flota_token', t); localStorage.setItem('flota_token_super', 'cabecera.eyJzdWIiOiJzMSJ9.firma') },
      ALTA.access_token)
    const llegan = await cuenta(page)
    await page.goto('/cookies', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Cambiar mis cookies' }).click()
    await page.getByRole('dialog', { name: 'Cookies' }).getByRole('button', { name: 'Aceptar' }).click()
    await page.getByRole('button', { name: 'Cambiar mis cookies' }).click()
    await page.getByRole('dialog', { name: 'Cookies' }).getByRole('button', { name: 'Solo necesarias' }).click()
    await page.waitForTimeout(400)
    expect(llegan).toEqual([])
  })
})
