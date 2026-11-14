/* global process, Buffer */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* /REGISTRO, EL ALTA DE UNA EMPRESA (14-11-2026, tercera tanda, U3 y U4). Lo que no puede volver a pasar:
   - que ignore la noche que se eligió en la portada (forzaba el papel de día);
   - que un plan que no existe (`plan=xx`) caiga en Pro y mande «xx» al servidor: cae en Esencial, el del «Desde 5 €»;
   - que el selector de sector prometa «inspecciones con foto e IA» o el de plan diga «2 meses gratis»;
   - que el selector de sector y el de plan vayan con el aspecto viejo (fondo oscuro con halo, degradados, rótulos de
     color en mayúsculas, emojis);
   - que el recorrido «/» → /planes → /registro → «Cuenta creada» hable de «email», «URL», «centro» o «60€/mes»;
   - que la portada esté en alemán y el alta en otro idioma.
   Lo que envía el alta no cambia (los mismos campos) y quien reparte solo sigue con su alta de siempre. */

const COOKIES = JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' })
const jwt = (o) => {
  const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(o)}.firma`
}

/* La API simulada y el alta: guarda lo que se manda y contesta como el servidor. */
async function preparar(page, { tema, idioma, panel } = {}) {
  await page.addInitScript(({ c, t, l, p }) => {
    try {
      localStorage.setItem('cookie_consent', c)
      if (t) localStorage.setItem('fds_tema_web', t)
      if (l) localStorage.setItem('fds_idioma', l)
      if (p) localStorage.setItem('flota_lang', p)
    } catch { /* nada */ }
  }, { c: COOKIES, t: tema, l: idioma, p: panel })
  await simularApi(page, 'vacio')
  const altas = []
  await page.route(/\/api\/auth\/register$/, (r) => {
    altas.push(r.request().postDataJSON())
    return r.fulfill({ json: { access_token: jwt({ sub: 'a1', role: 'admin', name: 'Transportes Pérez', exp: Math.floor(Date.now() / 1000) + 3600, org_id: 'org1' }),
      token_type: 'bearer', id: 'a1', name: 'Transportes Pérez', role: 'admin', account_type: 'dsp', slug: 'transportes-perez', correo_bienvenida: true } })
  })
  return altas
}

async function rellenar(page) {
  await page.getByPlaceholder('Transportes Pérez SL').fill('Transportes Pérez')
  await page.locator('input[type=email]').fill('oficina@transportes-perez.es')
  await page.locator('input[autocomplete="username"]').fill('oficina')
  await page.locator('input[autocomplete="new-password"]').first().fill('una-clave-larga')
  await page.locator('input[autocomplete="new-password"]').nth(1).fill('una-clave-larga')
  await page.getByRole('checkbox').check()
}

const fondo = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor)
const PAPEL = 'rgb(245, 246, 243)'
const NOCHE = 'rgb(11, 16, 18)'

test('un plan que no existe cae en Esencial (no en Pro) y se manda Esencial', async ({ page }) => {
  const altas = await preparar(page)
  await page.goto('/registro?sector=otra&plan=xx&flota=-3', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Plan elegido: Esencial')).toBeVisible()
  // Una furgoneta, con el mínimo de 10 de Esencial: 50 € al mes.
  await expect(page.getByText(/^50 € al mes · 14 días de prueba, sin tarjeta$/)).toBeVisible()
  await expect(page.getByText(/Pro|180|360/)).toHaveCount(0)
  await rellenar(page)
  await page.getByRole('button', { name: 'Crear cuenta con plan Esencial' }).click()
  await expect(page.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible()
  expect(altas[0]).toMatchObject({ plan: 'operacion', sector: 'otra' })
  // Sin `flota`, las 40 de siempre: 200 € al mes.
  await page.goto('/registro?sector=otra&plan=xx', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/^200 € al mes · 14 días de prueba, sin tarjeta$/)).toBeVisible()
})

test('lo que envía el alta no cambia: los mismos campos, el plan y el sector de la URL', async ({ page }) => {
  const altas = await preparar(page)
  await page.goto('/registro?sector=otra&plan=completo&flota=12', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Plan elegido: Pro')).toBeVisible()
  // Pro, 12 furgonetas con el mínimo de 20: 180 € al mes; con el importe como en todo el recorrido.
  await expect(page.getByText(/^180 € al mes · 14 días de prueba, sin tarjeta$/)).toBeVisible()
  await rellenar(page)
  await page.locator('#alta-sede').fill('Norte, Sur')
  await page.getByRole('button', { name: 'Crear cuenta con plan Pro' }).click()
  await expect(page.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible()
  expect(altas).toHaveLength(1)
  expect(altas[0]).toMatchObject({ org_name: 'Transportes Pérez', username: 'oficina', plan: 'completo', sector: 'otra', slug: 'transportes-perez',
    email: 'oficina@transportes-perez.es', center: 'Norte, Sur', password: 'una-clave-larga', desde_app: false })
})

test('respeta la noche elegida en la portada: los dos selectores, el formulario y «Cuenta creada»', async ({ page }) => {
  await preparar(page, { tema: 'dark' })
  await page.goto('/registro', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('alta-sectores')).toHaveAttribute('data-theme', 'dark')
  expect(await fondo(page.getByTestId('alta-sectores'))).toBe(NOCHE)
  await page.getByRole('button', { name: /^Flota de furgonetas/ }).click()
  await expect(page.getByTestId('alta-planes')).toHaveAttribute('data-theme', 'dark')
  expect(await fondo(page.getByTestId('alta-planes'))).toBe(NOCHE)
  await page.getByRole('button', { name: /Empezar con Esencial/ }).click()
  await expect(page.getByTestId('alta-empresa')).toHaveAttribute('data-theme', 'dark')
  expect(await fondo(page.getByTestId('alta-empresa'))).toBe(NOCHE)
  await rellenar(page)
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect(page.getByTestId('alta-cuenta-creada')).toHaveAttribute('data-theme', 'dark')
  expect(await fondo(page.getByTestId('alta-cuenta-creada'))).toBe(NOCHE)
})

test('de día por defecto (papel), sin noche guardada', async ({ page }) => {
  await preparar(page)
  await page.goto('/registro?sector=otra&plan=operacion', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('alta-empresa')).toHaveAttribute('data-theme', 'light')
  expect(await fondo(page.getByTestId('alta-empresa'))).toBe(PAPEL)
})

test('el selector de sector: sin la IA, sin tarjetas con icono ni degradados, y lleva al alta de flota', async ({ page }) => {
  await preparar(page)
  await page.goto('/registro', { waitUntil: 'domcontentloaded' })
  const sectores = page.getByTestId('alta-sectores')
  await expect(sectores.getByRole('heading', { level: 1 })).toHaveText('¿Qué vas a hacer con FDS?')
  await expect(sectores).not.toContainText(/\bIA\b|inspecci/)
  await expect(sectores).toContainText('revisiones con foto')
  // La flota de furgonetas, la primera; las demás siguen ahí.
  const botones = sectores.locator('button[data-sector]')
  await expect(botones).toHaveCount(6)
  await expect(botones.first()).toHaveAttribute('data-sector', 'otra')
  for (const n of ['DSP de Amazon', 'Repartir yo mismo', 'Mensajería y paquetería', 'Supermercado o tienda con reparto a domicilio', 'Distribución a negocios']) {
    await expect(sectores.getByRole('button', { name: new RegExp(n) })).toBeVisible()
  }
  expect(await page.evaluate(() => [...document.querySelectorAll('[data-testid="alta-sectores"] *')]
    .filter((e) => /gradient/.test(getComputedStyle(e).backgroundImage) || /gradient/.test(e.getAttribute('style') || '')).length)).toBe(0)
  await botones.first().click()
  await expect(page).toHaveURL(/\/registro\?sector=otra$/)
  await expect(page.getByTestId('alta-planes')).toBeVisible()
})

test('el selector de plan: «pagas 10 meses», nada de «2 meses gratis», precios «al mes» y Pro recomendado con la firma', async ({ page }) => {
  await preparar(page)
  await page.goto('/registro?sector=otra&flota=12', { waitUntil: 'domcontentloaded' })
  const planes = page.getByTestId('alta-planes')
  await expect(planes).toContainText('14 días de prueba, sin tarjeta.')
  await expect(planes).not.toContainText(/gratis|✨|🔄|\bIA\b|Revisión rápida/i)
  await page.getByRole('button', { name: /^Anual/ }).click()
  await expect(planes.getByRole('button', { name: /^Anual/ })).toContainText('pagas 10 meses')
  // Esencial con 12 furgonetas: 60 € al mes; pagando el año, 50 € al mes y 600 € al año.
  const esencial = planes.locator('[data-plan="operacion"]')
  await expect(esencial).toContainText('5 € por vehículo · con 12 vehículos')
  await expect(esencial).toContainText('600 €/año · ahorras 120 €')
  await page.getByRole('button', { name: 'Mensual' }).click()
  await expect(esencial).toContainText('60 €')
  await expect(esencial).not.toContainText(/\d€/)            // «60€» pegado, nunca
  // Lo que lleva cada plan, las mismas frases que /planes.
  await expect(planes.locator('[data-plan="completo"]')).toContainText('Todo lo de Esencial, con sedes ilimitadas y un jefe por sede')
  // El recomendado lleva la acción principal (el cian de la firma); el otro, la secundaria con borde.
  const bg = (sel) => planes.locator(sel).getByRole('button').evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(await bg('[data-plan="completo"]')).toBe('rgb(20, 231, 216)')
  expect(await bg('[data-plan="operacion"]')).toBe('rgba(0, 0, 0, 0)')
  await planes.locator('[data-plan="operacion"]').getByRole('button').click()
  await expect(page).toHaveURL(/plan=operacion/)
  await expect(page.getByText('Plan elegido: Esencial')).toBeVisible()
})

test('un solo vocabulario en el formulario: sede, correo, dirección del portal; y el importe «al mes»', async ({ page }) => {
  await preparar(page)
  await page.goto('/registro?sector=otra&plan=operacion&flota=12', { waitUntil: 'domcontentloaded' })
  const alta = page.getByTestId('alta-empresa')
  await expect(alta).toContainText('Tu sede')
  await expect(alta).toContainText('Correo de contacto')
  await expect(alta).toContainText('Dirección del portal de tus conductores')
  await expect(alta).toContainText('60 € al mes')
  await expect(alta).toContainText('(60 € al mes)')
  await expect(alta).not.toContainText(/\bE-?mail\b|\bURL\b|centro|estación|delegación|\d€|gratuit|gratis/i)
  await page.goto('/registro?sector=otra&plan=completo', { waitUntil: 'domcontentloaded' })
  await expect(alta).toContainText('Tus sedes')
  await expect(alta).toContainText('Sepáralas con comas. Podrás añadir más después.')
  // Los avisos del formulario, con las mismas palabras.
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Pon el nombre de tu empresa.')
  await page.getByPlaceholder('Transportes Pérez SL').fill('Transportes Pérez')
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Pon un correo válido.')
})

test('el idioma que se eligió en la portada sigue en el alta, y su selector va en el orden del pie y cambia los dos', async ({ page }) => {
  await preparar(page, { idioma: 'de', panel: 'en' })
  await page.goto('/registro?sector=otra&plan=operacion&flota=12', { waitUntil: 'domcontentloaded' })
  const alta = page.getByTestId('alta-empresa')
  await expect(alta.getByRole('heading', { level: 1 })).toHaveText('Erstelle das Konto deiner Firma')
  await expect(alta).toContainText('Basis')
  await expect(alta).toContainText('60 € im Monat')
  await expect(alta).toContainText('Kontakt-E-Mail')
  const opciones = await alta.locator('select').first().locator('option').evaluateAll((os) => os.map((o) => o.value))
  expect(opciones).toEqual(['es', 'en', 'pt', 'fr', 'it', 'de'])
  await alta.locator('select').first().selectOption('en')
  await expect(alta.getByRole('heading', { level: 1 })).toHaveText('Create your company account')
  await expect(alta).toContainText('Contact email')
  expect(await page.evaluate(() => [localStorage.getItem('fds_idioma'), localStorage.getItem('flota_lang')])).toEqual(['en', 'en'])
})

test('quien reparte solo sigue con su alta de siempre (oscura, su oferta, su idioma)', async ({ page }) => {
  await preparar(page, { tema: 'dark' })
  await page.goto('/registro?sector=autonomo&plan=autonomo', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('alta-empresa')).toHaveCount(0)
  await expect(page.getByPlaceholder('Pepe')).toBeVisible()
  await expect(page.getByText(/Gratis y sin límite hasta el|Gratis hasta 15 paradas al día/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Crear cuenta con plan Repartidor/ })).toBeVisible()
})

/* ── Las fotos (solo con FOTOS_PUBLICO=<carpeta>) ── */
const CARPETA = process.env.FOTOS_PUBLICO
test.describe('fotos de /registro', () => {
  test.skip(!CARPETA, 'solo con FOTOS_PUBLICO')
  const PANTALLAS = [['sectores', '/registro'], ['planes', '/registro?sector=otra&flota=12'], ['formulario', '/registro?sector=otra&plan=operacion&flota=12']]
  for (const [nombre, ruta] of PANTALLAS) {
    for (const tema of ['dia', 'noche']) {
      for (const ancho of [1280, 390]) {
        test(`${nombre} a ${ancho} (${tema})`, async ({ page }) => {
          await preparar(page, { tema: tema === 'noche' ? 'dark' : undefined })
          await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
          await page.goto(ruta, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(800)
          fs.mkdirSync(CARPETA, { recursive: true })
          await page.screenshot({ path: path.join(CARPETA, `registro-${nombre}-${ancho}-${tema}.png`), fullPage: true })
        })
      }
    }
  }
  for (const [ancho, tema] of [[390, 'noche'], [1280, 'dia'], [390, 'dia']]) {
    test(`cuenta creada a ${ancho} (${tema})`, async ({ page }) => {
      await preparar(page, { tema: tema === 'noche' ? 'dark' : undefined })
      await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
      await page.goto('/registro?sector=otra&plan=operacion&flota=12', { waitUntil: 'domcontentloaded' })
      await rellenar(page)
      await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
      await expect(page.getByTestId('alta-cuenta-creada')).toBeVisible()
      fs.mkdirSync(CARPETA, { recursive: true })
      await page.screenshot({ path: path.join(CARPETA, `registro-creada-${ancho}-${tema}.png`), fullPage: true })
    })
  }

})

/* ── TANDA 4 DE DISEÑO (14-11-2026, hallazgo 15): la composición del alta de una empresa. Lo que envía no cambia (lo
   mira «lo que envía el alta no cambia», arriba) ni el alta de quien reparte solo. ── */
test('tanda 4 · el alta de una empresa: dos grupos con su regla, el idioma al pie y, desde 1024 px, los pasos que vienen', async ({ page }) => {
  await preparar(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/registro?sector=otra&plan=operacion&flota=12', { waitUntil: 'domcontentloaded' })
  const alta = page.getByTestId('alta-empresa')
  await expect(alta.getByRole('heading', { level: 2, name: 'Tu empresa' })).toBeVisible()
  await expect(alta.getByRole('heading', { level: 2, name: 'Tu acceso' })).toBeVisible()
  expect(await alta.getByRole('heading', { name: 'Tu empresa', exact: true }).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('1px')
  // «Tu empresa» antes del nombre; «Tu acceso» antes del usuario.
  const y = (l) => l.boundingBox().then((b) => b.y)
  expect(await y(alta.getByRole('heading', { name: 'Tu empresa', exact: true }))).toBeLessThan(await y(page.getByPlaceholder('Transportes Pérez SL')))
  expect(await y(alta.getByRole('heading', { name: 'Tu acceso', exact: true }))).toBeLessThan(await y(page.locator('input[autocomplete="username"]')))
  expect(await y(alta.getByRole('heading', { name: 'Tu acceso', exact: true }))).toBeGreaterThan(await y(page.locator('input[type=email]')))
  // El idioma, al pie: por debajo del botón de crear la cuenta (antes, en una caja encima del título).
  const idioma = alta.locator('select')
  await expect(idioma).toHaveCount(1)
  expect(await y(idioma)).toBeGreaterThan(await y(page.getByRole('button', { name: /Crear cuenta con plan/ })))
  // Los cuatro pasos, a la derecha, con las palabras del arranque.
  const pasos = page.getByTestId('alta-pasos-despues')
  await expect(pasos).toBeVisible()
  await expect(pasos.locator('li')).toHaveText(['1Tus furgonetas', '2Tus conductores', '3Dales acceso', '4La primera revisión'])
  expect((await pasos.boundingBox()).x).toBeGreaterThan((await page.getByPlaceholder('Transportes Pérez SL').boundingBox()).x + 400)
  // En el móvil, no: lo dice «Cuenta creada».
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pasos).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('tanda 4 · las empresas que reparten (van a su reparto) no ven los pasos del arranque', async ({ page }) => {
  await preparar(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/registro?sector=supermercado&plan=reparto', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('alta-empresa')).toBeVisible()
  await expect(page.getByTestId('alta-pasos-despues')).toHaveCount(0)
})

test('tanda 4 · «Cuenta creada»: el correo entero en su línea (sin partirse por el guion) e «Ir al panel» como enlace de texto', async ({ page }) => {
  await preparar(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/registro?sector=otra&plan=operacion&flota=12', { waitUntil: 'domcontentloaded' })
  await rellenar(page)
  await page.locator('input[type=email]').fill('oficina@transportes-perez.es')
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  const correo = page.getByTestId('alta-correo')
  await expect(correo).toHaveText('oficina@transportes-perez.es')
  const [alto, linea, display] = await correo.evaluate((e) => [e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).lineHeight), getComputedStyle(e).display])
  expect(display).toBe('block')
  expect(Math.round(alto / linea)).toBe(1)
  const panel = page.getByTestId('alta-ir-panel')
  expect(await panel.evaluate((e) => e.tagName)).toBe('A')
  await expect(panel).toHaveAttribute('href', '/panel')
  expect(await panel.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopWidth])).toEqual(['rgba(0, 0, 0, 0)', '0px'])
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible()
})

test('tanda 4 · el alta de empresa arranca en papel (sin fogonazo oscuro); la de quien reparte solo, en oscuro', async ({ page }) => {
  await preparar(page)
  for (const [ruta, clase] of [['/registro?sector=otra&plan=operacion', 'arranque-papel'], ['/registro', 'arranque-papel'], ['/registro?sector=autonomo&plan=autonomo', null]]) {
    // public/fondo-arranque.js marca <html> en el <head>, antes de que se pinte nada (y antes que React).
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    const clases = await page.evaluate(() => document.documentElement.className)
    if (clase) expect(clases, ruta).toContain(clase)
    else expect(clases, ruta).not.toMatch(/arranque-(papel|noche)/)
  }
})

/* TANDA 5 (14-11-2026, U7): o las dos contraseñas llevan pista o ninguna. Las dos la llevan; el alta manda lo mismo. */
test('tanda 5 · las dos contraseñas llevan su pista', async ({ page }) => {
  await preparar(page)
  await page.goto('/registro?sector=otra&plan=operacion&flota=20', { waitUntil: 'domcontentloaded' })
  const claves = page.locator('input[autocomplete="new-password"]')
  await expect(claves).toHaveCount(2)
  await expect(claves.nth(0)).toHaveAttribute('placeholder', 'Al menos 8 caracteres')
  await expect(claves.nth(1)).toHaveAttribute('placeholder', 'Repite la contraseña')
})
