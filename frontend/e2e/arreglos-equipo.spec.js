import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ARREGLOS DEL EQUIPO (10-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md, zona «equipo»), con la API simulada:
   · Incorporaciones: quien tiene sus papeles «en revisión» se pinta (su columna no existía) y el alta a mano nace
     en la nave de arriba (con «Todos» la pide), la lista marca «sin nave» y el «ya está» dice dónde.
   · Conductores: la contraseña temporal común es de la nave elegida, respeta a quien ya tiene la suya salvo que se
     marque la casilla y la confirmación dice a cuántos y de qué naves; la ficha dice la verdad de cómo se entra sin
     contraseña, la columna es «Acceso» y la contraseña de la ficha pide 8. */

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

const PLANTILLA = { motivos: {
  carnet: { titulo: 'Foto del carnet de conducir', texto: 'x' },
  ss: { titulo: 'Falta el alta en la Seguridad Social', texto: 'x' },
} }
const PERSONAS = [
  { id: 'p1', nombre: 'ANA PENDIENTE', telefono: '600000001', centro: 'NORTE', columna: 'pendiente', fase: 'por_pedir' },
  { id: 'p2', nombre: 'LUIS CARNET', telefono: '600000002', centro: 'NORTE', columna: 'carnet', fase: 'esperando',
    estados: { carnet: 'pedido' } },
  { id: 'p3', nombre: 'RITA REVISION', telefono: '600000003', centro: 'NORTE', columna: 'revision', fase: 'revision',
    estados: { carnet: 'revision', ss: 'revision' } },
  { id: 'p4', nombre: 'EVA SIN NAVE', telefono: '600000004', centro: '', columna: 'completo', fase: 'listo' },
]

async function incorporaciones(page, { todos = false } = {}) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  if (todos) await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
  await simularApi(page, 'vacio')
  const altas = []
  await page.route(/\/api\/incorporaciones\/personas(\?|$)/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      altas.push(body)
      if (body.nombre === 'REPETIDA') {
        return route.fulfill({ status: 409, json: { detail: 'Esa persona ya está en la lista (OLGA): en SUR.' } })
      }
      return route.fulfill({ json: { ok: true, persona: { ...body, id: 'nueva' } } })
    }
    return route.fulfill({ json: { personas: PERSONAS, plantilla: PLANTILLA, estados: ['falta', 'pedido', 'revision', 'ok'],
      estado_nombre: { falta: 'Falta', pedido: 'Se lo he pedido', revision: 'En revision', ok: 'Correcto' } } })
  })
  await page.goto('/panel/incorporaciones', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ANA PENDIENTE')).toBeVisible({ timeout: 15000 })
  return altas
}

test.describe('Incorporaciones', () => {
  test('quien tiene los papeles en revisión sale en su columna', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page)
    // Las cuatro personas se pintan; antes RITA contaba en el total y no salía.
    for (const n of ['ANA PENDIENTE', 'LUIS CARNET', 'RITA REVISION', 'EVA SIN NAVE']) {
      await expect(page.getByText(n)).toBeVisible()
    }
    const columna = page.locator('section').filter({ has: page.getByText('En revisión', { exact: true }) })
    await expect(columna.getByText('Papeles entregados, a falta de comprobarlos')).toBeVisible()
    await expect(columna.getByText('RITA REVISION')).toBeVisible()
    // Va entre los motivos y «Completos».
    const titulos = await page.locator('section b').allInnerTexts()
    expect(titulos.indexOf('En revisión')).toBeGreaterThan(titulos.indexOf('Foto del carnet de conducir'))
    expect(titulos.indexOf('En revisión')).toBeLessThan(titulos.indexOf('Completos'))
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('quien no tiene nave sale marcado «sin nave»', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page)
    const fila = page.locator('.card').filter({ hasText: 'EVA SIN NAVE' })
    await expect(fila.getByText('sin nave', { exact: true })).toBeVisible()
    await expect(page.locator('.card').filter({ hasText: 'ANA PENDIENTE' }).getByText('sin nave', { exact: true })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el alta a mano nace en la nave elegida arriba', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page)
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    await expect(page.getByText('Se añade en NORTE.')).toBeVisible()
    await expect(page.getByLabel('Nave *')).toHaveCount(0)
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('NUEVO')
    await alta.locator('input').nth(1).fill('611 22 33 44')
    await alta.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect.poll(() => altas.length).toBe(1)
    expect(altas[0]).toMatchObject({ nombre: 'NUEVO', telefono: '611 22 33 44', centro: 'NORTE' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con «Todos» arriba pide la nave, y el «ya está» dice dónde', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page, { todos: true })
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('REPETIDA')
    await alta.locator('input').nth(1).fill('600000005')
    const boton = alta.getByRole('button', { name: 'Añadir', exact: true })
    await expect(boton).toBeDisabled()
    await page.getByLabel('Nave *').selectOption('SUR')
    await expect(boton).toBeEnabled()
    await boton.click()
    await expect(alta.getByText('Esa persona ya está en la lista (OLGA): en SUR.')).toBeVisible()
    expect(altas[0]).toMatchObject({ nombre: 'REPETIDA', centro: 'SUR' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

const CONDUCTORES = [
  { id: 'd1', name: 'Ana Pérez', email: 'ana@ejemplo.es', center: 'NORTE', active: true },
  { id: 'd2', name: 'Berta Ruiz', email: 'berta@ejemplo.es', center: 'NORTE', active: true },
  { id: 'd3', name: 'Carla Sanz', email: 'carla@ejemplo.es', center: 'NORTE', active: true },
  { id: 'd4', name: 'Dora Sin Correo', email: '', center: 'NORTE', active: true },
  { id: 'd5', name: 'Elsa Sin Nave', email: '', center: '', active: true },
]

async function conductores(page) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, (route) => route.fulfill({ json: CONDUCTORES }))
  const previas = []
  await page.route(/\/api\/auth\/driver-accounts\/generar\/previa/, (route) => {
    const u = new URL(route.request().url())
    previas.push(Object.fromEntries(u.searchParams))
    const todas = u.searchParams.get('incluir_propias') === 'true'
    return route.fulfill({ json: todas
      ? { actualizadas: 3, naves: { NORTE: 3 }, respetadas: 0, sin_email: 1, cuentas_inactivas: 0 }
      : { actualizadas: 2, naves: { NORTE: 2 }, respetadas: 1, sin_email: 1, cuentas_inactivas: 0 } })
  })
  const aplicadas = []
  await page.route(/\/api\/auth\/driver-accounts\/generar$/, (route) => {
    aplicadas.push(route.request().postDataJSON())
    return route.fulfill({ json: { actualizadas: 3, naves: { NORTE: 3 }, respetadas: 0, sin_email: 1,
      cuentas_inactivas: 0, aviso: 'La contraseña anterior de las cuentas cambiadas queda invalidada.' } })
  })
  const claves = []
  await page.route(/\/api\/auth\/set-driver-password/, (route) => {
    claves.push(route.request().postDataJSON())
    return route.fulfill({ json: { success: true } })
  })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Ana Pérez')).toBeVisible({ timeout: 15000 })
  return { previas, aplicadas, claves }
}

test.describe('Conductores', () => {
  test('la contraseña temporal común es de la nave y respeta a quien tiene la suya', async ({ page }) => {
    const fallos = vigilar(page)
    const { previas, aplicadas } = await conductores(page)
    // El «sin correo» es el que cuenta el servidor sobre los afectados (1), no el de la lista (2).
    await expect(page.getByText('Contraseña temporal común: se aplica a NORTE')).toBeVisible()
    await expect(page.getByText('1 sin correo', { exact: true })).toBeVisible()
    await expect(page.locator('span[title*="Es una sola contraseña para todos los conductores de NORTE"]')).toHaveCount(1)
    await expect(page.locator('span[title*="individualmente"]')).toHaveCount(0)
    expect(previas[0]).toEqual({ center: 'NORTE', incluir_propias: 'false' })

    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const previa = page.getByTestId('previa-temporal')
    await expect(previa).toContainText('Se cambiará a 2 conductores: NORTE (2).')
    await expect(previa).toContainText('A 1 que ya se ha puesto la suya se le respeta.')
    await expect(previa).toContainText('1 sin correo se quedan fuera.')

    await page.getByLabel('Cambiársela también a quien ya se ha puesto la suya').check()
    await expect(previa).toContainText('Se cambiará a 3 conductores: NORTE (3).')
    await expect(previa).toContainText('Incluye a quien ya se había puesto la suya')
    await page.getByLabel('Contraseña temporal común', { exact: true }).fill('temporal-1')
    await page.getByRole('button', { name: 'Aplicar contraseña temporal a 3' }).click()
    await expect.poll(() => aplicadas.length).toBe(1)
    expect(aplicadas[0]).toEqual({ password: 'temporal-1', center: 'NORTE', incluir_propias: true })
    await expect(page.getByText('3 conductores ya tienen acceso temporal')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la ficha dice cómo se entra sin contraseña y la suya pide 8', async ({ page }) => {
    const fallos = vigilar(page)
    const { claves } = await conductores(page)
    await expect(page.locator('thead').getByText('Acceso', { exact: true })).toBeVisible()
    await expect(page.locator('thead').getByText('PIN', { exact: true })).toHaveCount(0)
    await page.getByText('Ana Pérez').click()
    await page.getByRole('button', { name: /Acceso con contraseña/ }).click()
    await expect(page.getByText(/entra con un código que le llega a su correo o con la contraseña inicial de la empresa/)).toBeVisible()
    await expect(page.getByText(/solo con su email/)).toHaveCount(0)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('corta12')
    await page.getByPlaceholder('Repite la contraseña').fill('corta12')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible()
    expect(claves).toHaveLength(0)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('larga123')
    await page.getByPlaceholder('Repite la contraseña').fill('larga123')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect.poll(() => claves.length).toBe(1)
    expect(claves[0]).toEqual({ driver_id: 'd1', password: 'larga123' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
