import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ARREGLOS DEL EQUIPO (10-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md, zona «equipo»), con la API simulada:
   · Incorporaciones: quien tiene sus papeles «en revisión» se pinta (su columna no existía) y el alta a mano nace
     en el centro de arriba AL ENVIAR (con «Todos» lo pide), la lista marca «sin centro» y deja ponerle el de arriba,
     y el «ya está» dice dónde.
   · Conductores: la contraseña temporal común es del centro elegido, respeta a quien ya tiene la suya salvo que se
     marque la casilla y la confirmación dice a cuántos, de qué centros y cuántos sin centro se quedan fuera; sin esa
     previa (calculando o fallida) no se puede aplicar. La ficha dice la verdad de cómo se entra sin contraseña, la
     columna es «Acceso» y la contraseña de la ficha pide 8.
   (Corrección del 10-11-2026 tras la revisión: R6/R35, R7/R39/R41, R34, R36, R38, R40/R42, R43.) */

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
  const cambios = []
  // El PATCH de una persona (ponerle el centro, R36).
  await page.route(/\/api\/incorporaciones\/personas\/[^/?]+$/, (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    cambios.push({ id: route.request().url().split('/').pop(), ...route.request().postDataJSON() })
    return route.fulfill({ json: { ok: true, ...route.request().postDataJSON() } })
  })
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
  altas.cambios = cambios
  return altas
}

// El selector de centro de arriba (PanelLayout), que sigue a mano con la tarjeta de «Añadir una persona» abierta.
const arriba = (page, c) => page.locator('header').getByRole('button', { name: c, exact: true }).click()

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

  test('quien no tiene centro sale marcado «sin centro» y se le puede poner el de arriba', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page)
    const fila = page.locator('.card').filter({ hasText: 'EVA SIN NAVE' })
    await expect(fila.getByText('sin centro', { exact: true })).toBeVisible()
    await expect(page.locator('.card').filter({ hasText: 'ANA PENDIENTE' }).getByText('sin centro', { exact: true })).toHaveCount(0)
    // R38: en esta pantalla se dice «centro», no «nave».
    await expect(page.getByText('sin nave', { exact: true })).toHaveCount(0)
    // R36: abierta, ofrece ponerla en el centro de arriba, y lo manda en el PATCH.
    await fila.getByText('EVA SIN NAVE').click()
    await fila.getByRole('button', { name: 'Ponerla en NORTE' }).click()
    await expect.poll(() => altas.cambios.length).toBe(1)
    expect(altas.cambios[0]).toEqual({ id: 'p4', centro: 'NORTE' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con «Todos» arriba no hay centro que ponerle: solo se dice', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page, { todos: true })
    const fila = page.locator('.card').filter({ hasText: 'EVA SIN NAVE' })
    await fila.getByText('EVA SIN NAVE').click()
    await expect(fila.getByText('Sin centro: sale en la lista de todos los centros.')).toBeVisible()
    await expect(fila.getByRole('button', { name: /Ponerla en/ })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el alta a mano nace en el centro elegido arriba', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page)
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    await expect(page.getByText('Se añade en NORTE.')).toBeVisible()
    await expect(page.getByLabel('Centro *')).toHaveCount(0)
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('NUEVO')
    await alta.locator('input').nth(1).fill('611 22 33 44')
    await alta.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect.poll(() => altas.length).toBe(1)
    expect(altas[0]).toMatchObject({ nombre: 'NUEVO', telefono: '611 22 33 44', centro: 'NORTE' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con «Todos» arriba pide el centro, y el «ya está» dice dónde', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page, { todos: true })
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('REPETIDA')
    await alta.locator('input').nth(1).fill('600000005')
    const boton = alta.getByRole('button', { name: 'Añadir', exact: true })
    await expect(boton).toBeDisabled()
    await page.getByLabel('Centro *').selectOption('SUR')
    await expect(boton).toBeEnabled()
    await boton.click()
    await expect(alta.getByText('Esa persona ya está en la lista (OLGA): en SUR.')).toBeVisible()
    expect(altas[0]).toMatchObject({ nombre: 'REPETIDA', centro: 'SUR' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el alta a mano manda el centro de arriba AL ENVIAR, aunque se cambie con la tarjeta abierta', async ({ page }) => {
    // R6/R35: se abría con NORTE, se cambiaba arriba a SUR, decía «Se añade en SUR.» y mandaba NORTE.
    const fallos = vigilar(page)
    const altas = await incorporaciones(page)
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    await expect(page.getByText('Se añade en NORTE.')).toBeVisible()
    await arriba(page, 'SUR')
    await expect(page.getByText('Se añade en SUR.')).toBeVisible()
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('NUEVO')
    await alta.locator('input').nth(1).fill('611 22 33 44')
    await alta.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect.poll(() => altas.length).toBe(1)
    expect(altas[0]).toMatchObject({ nombre: 'NUEVO', centro: 'SUR' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con «Todos», elegido uno en la tarjeta y otro arriba, manda el de arriba que enseña', async ({ page }) => {
    const fallos = vigilar(page)
    const altas = await incorporaciones(page, { todos: true })
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    await page.getByLabel('Centro *').selectOption('SUR')
    await arriba(page, 'NORTE')
    await expect(page.getByText('Se añade en NORTE.')).toBeVisible()
    await expect(page.getByLabel('Centro *')).toHaveCount(0)
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('NUEVO')
    await alta.locator('input').nth(1).fill('611 22 33 44')
    await alta.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect.poll(() => altas.length).toBe(1)
    expect(altas[0]).toMatchObject({ nombre: 'NUEVO', centro: 'NORTE' })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* SEGUNDA REVISIÓN S8: tras «Ponerla en X» o un alta se recarga con el centro del clic; si arriba se cambia mientras
   va la petición, esa lista vieja no puede pisar la del centro que se mira. La petición se retiene hasta haber
   cambiado arriba y, al soltarla, se espera a que la recarga vieja haya llegado entera al navegador. */
async function incorporacionesRetenidas(page) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await simularApi(page, 'vacio')
  let soltar
  const retenida = new Promise((r) => { soltar = r })
  const pedidas = []
  await page.route(/\/api\/incorporaciones\/personas\/[^/?]+$/, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    await retenida
    return route.fulfill({ json: { ok: true, ...route.request().postDataJSON() } })
  })
  await page.route(/\/api\/incorporaciones\/personas(\?|$)/, async (route) => {
    if (route.request().method() === 'POST') {
      await retenida
      return route.fulfill({ json: { ok: true, persona: { ...route.request().postDataJSON(), id: 'nueva' } } })
    }
    const centro = new URL(route.request().url()).searchParams.get('center') || 'Todos'
    pedidas.push(centro)
    const personas = centro === 'SUR'
      ? [{ id: 's1', nombre: 'SOFIA SUR', telefono: '600000009', centro: 'SUR', columna: 'pendiente', fase: 'por_pedir' }]
      : PERSONAS
    return route.fulfill({ json: { personas, plantilla: PLANTILLA, estados: ['falta', 'pedido', 'revision', 'ok'],
      estado_nombre: { falta: 'Falta', pedido: 'Se lo he pedido', revision: 'En revision', ok: 'Correcto' } } })
  })
  await page.goto('/panel/incorporaciones', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ANA PENDIENTE')).toBeVisible({ timeout: 15000 })
  return {
    pedidas,
    // Cambia arriba a SUR con la petición retenida, la suelta y espera a que la recarga vieja (NORTE) llegue entera.
    async cambiarYSoltar() {
      await arriba(page, 'SUR')
      await expect(page.getByText('SOFIA SUR')).toBeVisible()
      const vieja = page.waitForResponse((r) => r.request().method() === 'GET'
        && /\/api\/incorporaciones\/personas\?/.test(r.url()) && r.url().includes('center=NORTE'))
      soltar()
      await (await vieja).finished()
      await expect.poll(() => pedidas.filter((c) => c === 'NORTE').length).toBe(2)
      // Dos fotogramas: lo que la respuesta vieja fuera a pintar, ya estaría pintado.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    },
  }
}

test.describe('Incorporaciones: la recarga de otro centro no pisa la lista', () => {
  test('tras «Ponerla en NORTE», si arriba ya está SUR, sigue la lista de SUR', async ({ page }) => {
    const fallos = vigilar(page)
    const r = await incorporacionesRetenidas(page)
    const fila = page.locator('.card').filter({ hasText: 'EVA SIN NAVE' })
    await fila.getByText('EVA SIN NAVE').click()
    await fila.getByRole('button', { name: 'Ponerla en NORTE' }).click()
    await r.cambiarYSoltar()
    await expect(page.getByText('SOFIA SUR')).toBeVisible()
    await expect(page.getByText('ANA PENDIENTE')).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('tras un alta a mano, si arriba ya está SUR, sigue la lista de SUR', async ({ page }) => {
    const fallos = vigilar(page)
    const r = await incorporacionesRetenidas(page)
    await page.locator('main').getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: 'Añadir a mano' }).click()
    const alta = page.locator('.card').filter({ hasText: 'Añadir una persona' })
    await alta.locator('input').nth(0).fill('NUEVO')
    await alta.locator('input').nth(1).fill('611 22 33 44')
    await alta.getByRole('button', { name: 'Añadir', exact: true }).click()
    await r.cambiarYSoltar()
    await expect(page.getByText('SOFIA SUR')).toBeVisible()
    await expect(page.getByText('ANA PENDIENTE')).toHaveCount(0)
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

/* `previa(route, params, n)`, si se da, contesta la previa en vez de la de siempre (para hacerla fallar o esperar). */
async function conductores(page, { previa, todos = false } = {}) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  if (todos) await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, (route) => route.fulfill({ json: CONDUCTORES }))
  const previas = []
  await page.route(/\/api\/auth\/driver-accounts\/generar\/previa/, (route) => {
    const u = new URL(route.request().url())
    previas.push(Object.fromEntries(u.searchParams))
    if (previa) return previa(route, Object.fromEntries(u.searchParams), previas.length)
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
  test('la contraseña temporal común es del centro y respeta a quien tiene la suya', async ({ page }) => {
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

  test('sin la previa de lo que hay en pantalla no se puede aplicar: ni mientras calcula ni si falla', async ({ page }) => {
    // R7/R39/R41: con la previa fallida (un servidor viejo da 404) se dejaba aplicar, y el servidor viejo se la
    // cambiaba a todos; y al marcar la casilla el botón seguía con la cifra de antes, activo.
    const fallos = vigilar(page)
    let soltar
    const retenida = new Promise((r) => { soltar = r })
    const { previas, aplicadas } = await conductores(page, {
      previa: async (route, params, n) => {
        if (n === 1) return route.fulfill({ status: 404, json: { detail: 'Not Found' } })
        if (params.incluir_propias === 'true') await retenida
        return route.fulfill({ json: params.incluir_propias === 'true'
          ? { actualizadas: 3, naves: { NORTE: 3 }, respetadas: 0, sin_email: 1, cuentas_inactivas: 0, sin_centro_fuera: 0 }
          : { actualizadas: 2, naves: { NORTE: 2 }, respetadas: 1, sin_email: 1, cuentas_inactivas: 0, sin_centro_fuera: 0 } })
      },
    })
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const previa = page.getByTestId('previa-temporal')
    const aplicar = page.getByRole('button', { name: /^Aplicar contraseña temporal/ })
    await page.getByLabel('Contraseña temporal común', { exact: true }).fill('temporal-1')
    // Falló: se dice, y no se deja aplicar.
    await expect(previa).toContainText('No se ha podido calcular a quién afecta.')
    await expect(aplicar).toBeDisabled()
    // Reintentar la vuelve a pedir; ya llega bien.
    await previa.getByRole('button', { name: 'Reintentar' }).click()
    await expect(previa).toContainText('Se cambiará a 2 conductores: NORTE (2).')
    await expect(page.getByRole('button', { name: 'Aplicar contraseña temporal a 2' })).toBeEnabled()
    // Al marcar la casilla, hasta que llega la previa nueva: «Calculando…», sin cifra vieja y sin poder aplicar.
    await page.getByLabel('Cambiársela también a quien ya se ha puesto la suya').check()
    await expect(previa).toContainText('Calculando a quién afecta…')
    await expect(previa).not.toContainText('Se cambiará a 2')
    await expect(aplicar).toBeDisabled()
    await expect(aplicar).toHaveText('Aplicar contraseña temporal')
    soltar()
    await expect(page.getByRole('button', { name: 'Aplicar contraseña temporal a 3' })).toBeEnabled()
    expect(aplicadas).toHaveLength(0)
    expect(previas.map((p) => p.incluir_propias)).toEqual(['false', 'false', 'true'])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con un centro elegido dice cuántos «sin centro» se quedan fuera, y habla de centros', async ({ page }) => {
    // R40/R42: la lista de NORTE enseña a Elsa (sin centro), pero la temporal de NORTE no la toca. R38: «centro».
    const fallos = vigilar(page)
    await conductores(page, {
      previa: (route) => route.fulfill({ json: { actualizadas: 2, naves: { NORTE: 2 }, respetadas: 1, sin_email: 1,
        cuentas_inactivas: 0, sin_centro_fuera: 1 } }),
    })
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const previa = page.getByTestId('previa-temporal')
    await expect(previa).toContainText('1 sin centro no se incluyen: ponles su centro en la ficha o aplícala con «Todos».')
    await expect(page.getByText(/\bnaves?\b/)).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('a quien ya está en «Todos», o a quien «Todos» no se los incluiría, no le dice «aplícala con «Todos»»', async ({ page }) => {
    // Segunda revisión S7: un usuario limitado a sus centros, ya en «Todos», leía «…o aplícala con «Todos»».
    const fallos = vigilar(page)
    await conductores(page, {
      todos: true,
      previa: (route) => route.fulfill({ json: { actualizadas: 2, naves: { NORTE: 2 }, respetadas: 0, sin_email: 0,
        cuentas_inactivas: 0, sin_centro_fuera: 2, con_todos_entran: false } }),
    })
    await expect(page.getByText('Contraseña temporal común: se aplica a todos los centros')).toBeVisible()
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const previa = page.getByTestId('previa-temporal')
    await expect(previa).toContainText('2 sin centro no se incluyen: ponles su centro en la ficha.')
    await expect(previa).not.toContainText('aplícala con')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con un centro elegido, si «Todos» tampoco los incluiría, tampoco se lo propone', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, {
      previa: (route) => route.fulfill({ json: { actualizadas: 2, naves: { NORTE: 2 }, respetadas: 0, sin_email: 0,
        cuentas_inactivas: 0, sin_centro_fuera: 1, con_todos_entran: false } }),
    })
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const previa = page.getByTestId('previa-temporal')
    await expect(previa).toContainText('1 sin centro no se incluyen: ponles su centro en la ficha.')
    await expect(previa).not.toContainText('aplícala con')
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
