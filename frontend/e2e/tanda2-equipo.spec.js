/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 2, ZONA «EQUIPO» (11-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md), con la API simulada:
   · E1 (equipo-9): Conductores en el móvil. La cabecera salta de línea (buscador a todo el ancho; «Importar» y
     «Móviles personales» dentro de «Más»), el aviso de las claves no queda a una palabra por línea, nada se sale de
     la pantalla y en vez de la tabla hay una tarjeta por conductor con su centro, el teléfono a un toque y lo que le
     falta. En el ordenador, la tabla y los botones de siempre.
   · E2 (equipo-7): filtros de un toque encima de la lista: «sin centro», «sin correo», «sin ID de reparto» (solo si
     la empresa usa la DNR o las horas) y «sin acceso» (solo si se sabe quién tiene cuenta), con cuántos.
   · E3 (portal_inicio-7, la web): bajo «Hacer la auditoría», «Hoy: 1234 ABC» o «Enviada hoy»; «hoy no sales» y
     «suspendido» siguen mandando. */

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

const alto = (loc) => loc.evaluate((el) => el.offsetHeight)
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const CONDUCTORES = [
  { id: 'd1', name: 'ANTONIO GARCÍA LÓPEZ', center: 'NORTE', active: true, email: 'antonio@ejemplo.es', phone: '612345678', transporter_id: 'A1B2C3D4E5F6G7' },
  { id: 'd2', name: 'MIGUEL ÁNGEL TORRES BLANCO', center: 'SUR', active: true, email: '', phone: '+34 655 902 317', transporter_id: '' },
  { id: 'd3', name: 'NURIA DÍAZ VARELA', center: 'NORTE', active: true, email: 'nuria@ejemplo.es', phone: '', transporter_id: '' },
  { id: 'd4', name: 'ESTELA ALEN LAGE', center: '', active: true, email: 'estela@ejemplo.es', phone: '699210334', transporter_id: 'Z9Y8X7W6V5U4T3' },
]
// Con cuenta: d1 y d4. Sin acceso: d2 y d3.
const CUENTAS = [{ driver_id: 'd1', email: 'antonio@ejemplo.es' }, { driver_id: 'd4', email: 'estela@ejemplo.es' }]

async function conductores(page, { modulos, cuentasFallan = false } = {}) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, json(CONDUCTORES))
  await page.route(/\/api\/auth\/driver-accounts\/contrasena-inicial/, json({ definida: true, desde: '2026-10-29T10:00:00Z', por: 'DANIEL MARTÍN' }))
  await page.route(/\/api\/auth\/driver-accounts\/previa/, json({ actualizadas: 2, naves: { NORTE: 1, SUR: 1 }, respetadas: 1, sin_email: 1, cuentas_inactivas: 0, sin_centro_fuera: 0 }))
  await page.route(/\/api\/auth\/driver-accounts(\?|$)/, cuentasFallan ? json({ detail: 'x' }, 500) : json(CUENTAS))
  if (modulos !== undefined) await page.route(/\/api\/org\/billing/, json({ plan: 'pro', status: 'active', modulos }))
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ANTONIO GARCÍA LÓPEZ')).toBeVisible({ timeout: 15000 })
}

test.describe('E1 · Conductores en el móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('la cabecera cabe, «Más» guarda Importar y Móviles, y hay una tarjeta por conductor', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    // Nada se sale de la pantalla: sin desplazamiento de lado en toda la página.
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
    // Buscador a todo el ancho (o casi): más que los 224 px de antes.
    const buscador = page.getByPlaceholder('Buscar conductor…')
    expect(await buscador.evaluate((el) => el.offsetWidth)).toBeGreaterThan(300)
    // Importar y Móviles no están a la vista: van en «Más».
    await expect(page.getByRole('button', { name: 'Importar Excel' })).toHaveCount(0)
    const mas = page.getByRole('button', { name: 'Más' })
    await expect(mas).toBeVisible()
    // Medidas sin la animación de entrada de la cabecera (escala un 0,5 % mientras entra): las de la maqueta.
    expect(await alto(mas)).toBeGreaterThanOrEqual(44)
    await mas.click()
    await expect(page.getByRole('menuitem', { name: 'Importar Excel' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Móviles personales' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Importar Excel' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    // Una tarjeta por conductor, no la tabla.
    await expect(page.locator('table')).toHaveCount(0)
    const tarjetas = page.getByRole('list', { name: 'Conductores' }).getByRole('listitem')
    await expect(tarjetas).toHaveCount(4)
    // El nombre largo se lee entero en su tarjeta (no se corta con «…» a 390 px).
    const largo = page.getByText('MIGUEL ÁNGEL TORRES BLANCO')
    expect(await largo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    // Teléfono a un toque, con el número tal cual para marcar.
    const llamar = page.getByRole('link', { name: 'Llamar 612 345 678' })
    await expect(llamar).toHaveAttribute('href', 'tel:612345678')
    expect(await alto(llamar)).toBeGreaterThanOrEqual(44)
    expect(await llamar.evaluate((el) => el.offsetWidth)).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('link', { name: /^Llamar .*655 902 317/ })).toHaveAttribute('href', 'tel:+34655902317')
    // Sin teléfono: lo dice y no hay enlace.
    const nuria = tarjetas.filter({ hasText: 'NURIA DÍAZ VARELA' })
    await expect(nuria.getByText('sin teléfono')).toBeVisible()
    await expect(nuria.getByRole('link')).toHaveCount(0)
    // Lo que le falta, en la tarjeta: a Miguel Ángel, correo, ID de reparto y acceso.
    const miguel = tarjetas.filter({ hasText: 'MIGUEL ÁNGEL TORRES BLANCO' })
    for (const f of ['sin correo', 'sin ID de reparto', 'sin acceso']) await expect(miguel.getByText(f, { exact: true })).toBeVisible()
    await expect(tarjetas.filter({ hasText: 'ANTONIO GARCÍA LÓPEZ' }).getByText(/^sin /)).toHaveCount(0)
    // Tocar la tarjeta abre la ficha.
    await miguel.getByRole('button').first().click()
    await expect(page.getByRole('button', { name: /Editar/ }).first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el aviso de las claves no queda a una palabra por línea', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    const texto = page.getByText(/Contraseña temporal común: se aplica a/)
    await expect(texto).toBeVisible()
    // Antes medía unos 60 px de ancho (una palabra por línea); ahora casi toda la tarjeta.
    expect(await texto.evaluate((el) => el.offsetWidth)).toBeGreaterThan(220)
    const inicial = page.getByText(/Contraseña inicial de los conductores nuevos/)
    expect(await inicial.evaluate((el) => el.offsetWidth)).toBeGreaterThan(220)
    const boton = page.getByRole('button', { name: 'Establecer contraseña temporal común' })
    expect(await alto(boton)).toBeGreaterThanOrEqual(44)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('E1 · Conductores en el ordenador, como antes', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

  test('la tabla y los botones de siempre, sin «Más»', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    await expect(page.locator('table')).toHaveCount(1)
    await expect(page.getByRole('columnheader', { name: /Teléfono/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importar Excel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Móviles personales' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Más' })).toBeHidden()
    // El buscador, del ancho de antes (224 px).
    expect(await page.getByPlaceholder('Buscar conductor…').evaluate((el) => el.offsetWidth)).toBe(224)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('E2 · filtros de un toque', () => {
  test('cuentan y filtran: sin centro, sin correo, sin ID de reparto y sin acceso', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    const grupo = page.getByRole('group', { name: 'Fichas incompletas' })
    await expect(grupo.getByRole('button', { name: 'sin centro (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin correo (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (2)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin acceso (2)' })).toBeVisible()

    const nombres = ['ANTONIO GARCÍA LÓPEZ', 'MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA', 'ESTELA ALEN LAGE']
    const seVen = async (quien) => {
      for (const n of nombres) {
        if (quien.includes(n)) await expect(page.getByText(n, { exact: true })).toBeVisible()
        else await expect(page.getByText(n, { exact: true })).toHaveCount(0)
      }
    }
    await grupo.getByRole('button', { name: 'sin ID de reparto (2)' }).click()
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (2)' })).toHaveAttribute('aria-pressed', 'true')
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA'])
    await expect(page.getByText('2 conductores · pulsa')).toBeVisible()
    await grupo.getByRole('button', { name: 'sin centro (1)' }).click()
    await seVen(['ESTELA ALEN LAGE'])
    await grupo.getByRole('button', { name: 'sin correo (1)' }).click()
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO'])
    await grupo.getByRole('button', { name: 'sin acceso (2)' }).click()
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA'])
    // Tocarlo otra vez lo quita.
    await grupo.getByRole('button', { name: 'sin acceso (2)' }).click()
    await seVen(nombres)
    // Y con el buscador, cuentan sobre lo que queda.
    await page.getByPlaceholder('Buscar conductor…').fill('nuria')
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /sin correo/ })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin DNR ni horas no sale «sin ID de reparto»; sin la lista de cuentas no sale «sin acceso»', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { modulos: ['vehiculos', 'conductores', 'revision'], cuentasFallan: true })
    const grupo = page.getByRole('group', { name: 'Fichas incompletas' })
    await expect(grupo.getByRole('button', { name: 'sin correo (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /sin ID de reparto/ })).toHaveCount(0)
    await expect(grupo.getByRole('button', { name: /sin acceso/ })).toHaveCount(0)
    expect(fallos.filter((f) => !/500/.test(f)), fallos.join(' | ')).toHaveLength(0)
  })
})

/* E3 · el portal web del conductor. */
async function portal(page, { asignada, vehiculosPortal } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'LAURA SÁNCHEZ GIL', exp })}.firma`
  await page.addInitScript((tk) => {
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'LAURA SÁNCHEZ GIL', center: 'NORTE' }))
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
  }, token)
  await simularApi(page, 'vacio')
  const pedidas = []
  await page.route(/\/api\/auth\/me\/assigned-vehicle/, (route) => { pedidas.push(1); return json(asignada)(route) })
  await page.route(/\/api\/vehicles\/portal/, json(vehiculosPortal || { vehicles: [], puede_auditar: true, motivo: null }))
  await page.route(/\/api\/portal\/mi-ficha/, json({ falta_telefono: false, tiene_clave: true, configurar_cuenta: false }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Hacer la auditoría', { exact: true })).toBeVisible({ timeout: 15000 })
  return pedidas
}
const FURGO = { id: 'v4', license_plate: '3056 MBF' }
const opcion = (page) => page.getByRole('button', { name: /Hacer la auditoría/ })

test.describe('E3 · la furgoneta de hoy en el portal del conductor', () => {
  test('con furgoneta asignada dice «Hoy: matrícula» y se puede abrir', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: false },
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Hoy: 3056 MBF')
    await expect(opcion(page)).toBeEnabled()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('ya enviada: «Enviada hoy» con la matrícula', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: true },
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Enviada hoy · 3056 MBF')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin furgoneta asignada (o sin respuesta), el texto de siempre', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: false, vehicle: null } })
    await expect(opcion(page)).toContainText('Antes de salir a ruta')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('«hoy no sales» y «suspendido» siguen mandando', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: false },
      vehiculosPortal: { vehicles: [], puede_auditar: false, motivo: 'no_en_ruta' } })
    await expect(opcion(page)).toContainText('Hoy no sales a ruta')
    await expect(opcion(page)).not.toContainText('3056 MBF')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('tras enviar la auditoría y volver al inicio, se vuelve a preguntar', async ({ page }) => {
    const fallos = vigilar(page)
    const pedidas = await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: false },
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Hoy: 3056 MBF')
    const antes = pedidas.length
    await opcion(page).click()
    await page.getByRole('button', { name: /Volver|Atrás/ }).first().click()
    await expect(opcion(page)).toBeVisible()
    await expect.poll(() => pedidas.length).toBeGreaterThan(antes)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
