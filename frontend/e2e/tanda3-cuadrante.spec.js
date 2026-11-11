import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 3 (11-11-2026), zona del cuadrante:
   · cuadrante-2: en Días libres → Peticiones, un chip por día pedido con cómo queda la nave si se concede.
   · cuadrante-1 (parte A): el Cuadrante enseña las peticiones sin contestar (punto, menú, Asistente y propuesta).
   · cuadrante-8: el botón «Avisar a los conductores», con su vista previa y una casilla por persona.
   Nada depende de la fecha de hoy: los días se calculan desde el lunes de esta semana y cada prueba fija su «ahora»
   en el navegador (`reloj`), así que Node y la pantalla hablan siempre de la misma semana y del mismo día. */

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
async function reloj(page) {
  const ahora = new Date()
  await page.clock.setFixedTime(ahora)
  const lunes = new Date(ahora)
  lunes.setHours(12, 0, 0, 0)
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  const dia = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d) }
  const haceDias = (n) => { const d = new Date(ahora); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d) }
  return { dia, hoy: iso(ahora), haceDias }
}

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

const fmt = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

// ── cuadrante-2 · los chips de cobertura en Peticiones ───────────────────────────────────────────────────────────

const peticion = (id, grupo, center, did, nombre, date, type = 'libre') => ({
  id, grupo, center, driver_id: did, driver_name: nombre, date, type, status: 'pendiente', motivo: 'asuntos',
  motivo_label: type === 'libre' ? 'Asuntos propios' : undefined, note: `Nota de ${nombre}`, created_at: '2026-11-01T10:00:00Z' })

function bandeja(dia, haceDias) {
  return [
    peticion('r1', 'g1', 'NORTE', 'd1', 'ANA PÉREZ', dia(9)),
    peticion('r2', 'g1', 'NORTE', 'd1', 'ANA PÉREZ', dia(10)),
    peticion('r3', 'g2', 'NORTE', 'd3', 'PEPE RÍOS', dia(9), 'extra'),
    peticion('r4', 'g3', 'NORTE', 'd4', 'SARA GIL', haceDias(2)),
  ]
}

function cobertura(dia, extra = {}) {
  return {
    center: 'NORTE', desde: dia(9), hasta: dia(10),
    dias: {
      [dia(9)]: { maximo: 3, en_ruta: 3, bajan: 0, colchon: 2, concedidos: 1, pendientes_libre: 2, pendientes_extra: 1 },
      [dia(10)]: { maximo: null, en_ruta: null, bajan: 0, colchon: 2, concedidos: 0, pendientes_libre: 1, pendientes_extra: 0 },
    },
    trabaja: [`d1|${dia(9)}`],
    ...extra,
  }
}

const filaDe = (page, nombre) => page.locator('.divide-y > div').filter({ hasText: nombre })

test('cuadrante-2: cada día pedido lleva su chip con el color de la fila Diferencia; sin máxima, gris; lo pasado, sin chip', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia, haceDias } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: bandeja(dia, haceDias) }))
  const pedidas = []
  await page.route(/\/api\/shift-requests\/cobertura/, (route) => {
    pedidas.push(new URL(route.request().url()).searchParams)
    return json(cobertura(dia))(route)
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Nota de ANA PÉREZ')).toBeVisible({ timeout: 15000 })

  // Ana trabaja ese día: darle el libre deja la nave en 2 de 3 (rojo), con lo ya concedido y lo que piden otros.
  const ana = filaDe(page, 'ANA PÉREZ').getByTestId('chip-cobertura')
  await expect(ana).toHaveCount(2)
  await expect(ana.nth(0)).toContainText(`${fmt(dia(9))} · en ruta 3/3 → si se lo das -1`)
  await expect(ana.nth(0)).toContainText('ya concedidos: 1')
  await expect(ana.nth(0)).toContainText('otras pendientes: 1')
  await expect(ana.nth(0)).toHaveClass(/bg-red-500/)
  // El día sin máxima: gris, sin inventar nada.
  await expect(ana.nth(1)).toContainText(`${fmt(dia(10))} · sin máxima`)
  await expect(ana.nth(1)).toHaveClass(/bg-dark-800/)
  // El extra de quien ese día no sale a ruta suma uno: 4 de 3, por encima pero sin llegar al colchón de 2 (ámbar).
  const pepe = filaDe(page, 'PEPE RÍOS').getByTestId('chip-cobertura')
  await expect(pepe).toContainText(`${fmt(dia(9))} · en ruta 3/3 → si se lo das +1 · ya concedidos: 1`)
  await expect(pepe).toHaveClass(/bg-amber-500/)
  // La petición de un día que ya pasó: sin chip.
  await expect(filaDe(page, 'SARA GIL').getByText('Sin contestar y el día ya pasó')).toBeVisible()
  await expect(filaDe(page, 'SARA GIL').getByTestId('chip-cobertura')).toHaveCount(0)
  // Una sola llamada para la nave, de la primera fecha que no ha pasado a la última.
  expect(pedidas.map((p) => [p.get('center'), p.get('desde'), p.get('hasta')])).toEqual([['NORTE', dia(9), dia(10)]])
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-2: un libre de quien ya libra no cambia nada y lo dice; con colchón de sobra, verde', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: [peticion('r1', 'g1', 'NORTE', 'd4', 'SARA GIL', dia(9))] }))
  await page.route(/\/api\/shift-requests\/cobertura/, json(cobertura(dia, {
    dias: { [dia(9)]: { maximo: 3, en_ruta: 4, bajan: 1, colchon: 2, concedidos: 0, pendientes_libre: 1, pendientes_extra: 0 } },
    trabaja: [] })))
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  const chip = filaDe(page, 'SARA GIL').getByTestId('chip-cobertura')
  await expect(chip).toContainText(`${fmt(dia(9))} · en ruta 5/3 → ya libra: no cambia`, { timeout: 15000 })
  await expect(chip).toHaveClass(/bg-emerald-500/)
  // En el title, de dónde sale la cuenta (los que bajan, la máxima, el colchón).
  await expect(chip).toHaveAttribute('title', /En ruta 4 \+ 1 que bajan de otros centros, máxima 3, colchón 2/)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-2: con un servidor sin la ruta nueva (404) la bandeja sale como siempre, sin chips y sin error', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia, haceDias } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: bandeja(dia, haceDias) }))
  let pedida = 0
  await page.route(/\/api\/shift-requests\/cobertura/, (route) => { pedida += 1; return json({ detail: 'Not Found' }, 404)(route) })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Nota de ANA PÉREZ')).toBeVisible({ timeout: 15000 })
  await expect.poll(() => pedida).toBe(1)
  await expect(page.getByTestId('chip-cobertura')).toHaveCount(0)
  await expect(page.getByTestId('peticiones-error')).toHaveCount(0)
  await expect(filaDe(page, 'ANA PÉREZ').getByText(`${fmt(dia(9))} · ${fmt(dia(10))}`)).toBeVisible()
  await expect(filaDe(page, 'ANA PÉREZ').getByRole('button', { name: 'Aprobar' })).toBeEnabled()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-2: con «Todos», una cobertura por nave; y tras aprobar se vuelve a pedir', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
  await simularApi(page, 'vacio')
  let reqs = [peticion('r1', 'g1', 'NORTE', 'd1', 'ANA PÉREZ', dia(9)), peticion('r2', 'g2', 'SUR', 'd2', 'LUIS GÓMEZ', dia(10))]
  await page.route(/\/api\/shift-requests(\?|$)/, (route) => json({ requests: reqs })(route))
  const pedidas = []
  await page.route(/\/api\/shift-requests\/cobertura/, (route) => {
    const p = new URL(route.request().url()).searchParams
    pedidas.push(p.get('center'))
    return json(cobertura(dia, { center: p.get('center') }))(route)
  })
  await page.route(/\/api\/shift-requests\/resolver-grupo/, (route) => {
    reqs = reqs.filter((r) => r.id !== 'r2')
    return json({ resueltas: ['r2'], canceladas: [], saltadas: [] })(route)
  })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(filaDe(page, 'LUIS GÓMEZ').getByTestId('chip-cobertura')).toContainText(`${fmt(dia(10))} · sin máxima`, { timeout: 15000 })
  await expect(filaDe(page, 'ANA PÉREZ').getByTestId('chip-cobertura')).toContainText('si se lo das -1')
  expect([...pedidas].sort()).toEqual(['NORTE', 'SUR'])
  await filaDe(page, 'LUIS GÓMEZ').getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByText('LUIS GÓMEZ')).toHaveCount(0)
  // Recargada con la bandeja: ya solo la nave que queda.
  await expect.poll(() => pedidas.length).toBe(3)
  expect(pedidas[2]).toBe('NORTE')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-2: en el móvil los chips no ensanchan la fila ni la página', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia, haceDias } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: bandeja(dia, haceDias) }))
  await page.route(/\/api\/shift-requests\/cobertura/, json(cobertura(dia)))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(filaDe(page, 'ANA PÉREZ').getByTestId('chip-cobertura')).toHaveCount(2, { timeout: 15000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  // Ningún chip se sale de su caja (se parte en dos líneas si no cabe).
  const salidos = await page.getByTestId('chip-cobertura').evaluateAll((els) =>
    els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
  expect(salidos).toBe(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── cuadrante-1 (parte A) · las peticiones sin contestar, en el Cuadrante ────────────────────────────────────────

const persona = (id, nombre, extra = {}) => ({ id, nombre, tipo: 'normal', ficha_activa: true, apodos: [], nota: '', reglas: {},
  entendido: [], sin_entender: '', reglas_fijas: [], ...extra })

function cuadrante(dia, extra = {}) {
  const personas = [persona('p1', 'ANTONIO GARCÍA LÓPEZ'), persona('p2', 'LAURA SÁNCHEZ GIL'), persona('p3', 'SARA OTERO MOSQUERA')]
  const celdas = {}
  for (const p of personas) for (let i = 0; i < 14; i++) celdas[`${p.id}|${dia(i)}`] = { cod: i % 7 < 5 ? '1' : 'N/T', extra: false, fijada: false }
  return {
    center: 'NORTE', desde: dia(0), hasta: dia(13), hoy: dia(1), personas, celdas,
    maximas: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [dia(i), 2])), objetivos: {},
    config: { colchon: 2, permitir_extra: true }, ajustes: [], aprobados: [], propuesta: null, ultimo_cambio: null,
    tipos: ['normal', 'empresa', 'finde', 'inactivo'], ...extra,
  }
}
const pendientesDe = (dia) => ({
  [`p1|${dia(3)}`]: { id: 'q1', tipo: 'libre', grupo: 'g1' },
  [`p1|${dia(4)}`]: { id: 'q2', tipo: 'libre', grupo: 'g1' },
  [`p2|${dia(5)}`]: { id: 'q3', tipo: 'extra', grupo: 'g2' },
  [`p3|${dia(0)}`]: { id: 'q4', tipo: 'libre', grupo: 'g3' },
})
const celdaDe = (page, nombre, f) => page.locator(`tbody button[title^="${nombre} · "][title*=" ${fmt(f)} · "]`)

test('cuadrante-1: la celda pedida lleva el punto y su title; el menú lo dice y lleva a Días libres de esa nave', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia, { pendientes: pendientesDe(dia) })))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('punto-pendiente')).toHaveCount(4)
  const pedida = celdaDe(page, 'ANTONIO GARCÍA LÓPEZ', dia(3))
  await expect(pedida.getByTestId('punto-pendiente')).toHaveCount(1)
  await expect(pedida).toHaveAttribute('title', /· pidió librar \(sin contestar\)$/)
  await expect(celdaDe(page, 'LAURA SÁNCHEZ GIL', dia(5))).toHaveAttribute('title', /· pidió día extra \(sin contestar\)$/)
  const vecina = celdaDe(page, 'ANTONIO GARCÍA LÓPEZ', dia(2))
  await expect(vecina.getByTestId('punto-pendiente')).toHaveCount(0)
  // El punto no cambia el tamaño de la celda: igual que la de al lado, sin punto.
  const [a, b] = [await pedida.boundingBox(), await vecina.boundingBox()]
  expect([a.width, a.height]).toEqual([b.width, b.height])

  await pedida.click()
  const menu = page.getByTestId('menu-pendiente')
  await expect(menu).toHaveText(/^Pidió librar este día y aún no se le ha contestado\./)
  const enlace = menu.getByRole('link', { name: 'Ver en Días libres' })
  await expect(enlace).toHaveAttribute('href', '/panel/turnos?centro=NORTE')
  await enlace.click()
  await expect(page).toHaveURL(/\/panel\/turnos$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Días libres')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-1: el Asistente dice las peticiones sin contestar de esas fechas, y la propuesta avisa si pone a trabajar una', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const propuesta = {
    id: 'pr1', center: 'NORTE', desde: dia(2), hasta: dia(13), n_cambios: 2, extras: 0, resumen_dias: [], avisos: [],
    faltan_conductores: 0, estado: 'pendiente',
    cambios: [
      { driver_id: 'p1', nombre: 'ANTONIO GARCÍA LÓPEZ', fecha: dia(5), antes: '1', valor: 'N/T', extra: false, antes_extra: false },
      { driver_id: 'p1', nombre: 'ANTONIO GARCÍA LÓPEZ', fecha: dia(3), antes: 'N/T', valor: '1', extra: false, antes_extra: false },
      { driver_id: 'p2', nombre: 'LAURA SÁNCHEZ GIL', fecha: dia(5), antes: 'N/T', valor: '1', extra: true, antes_extra: false },
    ],
  }
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia, { pendientes: pendientesDe(dia), propuesta })))
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  // La propuesta: solo cuenta el día que Antonio pidió LIBRAR y el motor le pone a trabajar (el extra de Laura no).
  await expect(page.getByTestId('propuesta-pendientes')).toContainText(
    `La propuesta pone a trabajar un día que alguien ha pedido librar (sin contestar): ANTONIO GARCÍA LÓPEZ ${fmt(dia(3))}.`, { timeout: 15000 })
  await expect(page.getByTestId('propuesta-pendientes').getByRole('link', { name: 'Ver en Días libres' }))
    .toHaveAttribute('href', '/panel/turnos?centro=NORTE')

  await page.getByRole('button', { name: 'Rehacer cuadrante' }).click()
  // Del día siguiente a «hoy» en adelante: la de Sara (el lunes, antes) no entra.
  const aviso = page.getByTestId('asistente-pendientes')
  await expect(aviso).toContainText(`Peticiones sin contestar en estas fechas: 3 días de 2 personas (ANTONIO GARCÍA LÓPEZ ${dia(3).slice(8, 10)}-${fmt(dia(4))}`)
  await expect(aviso).toContainText(`LAURA SÁNCHEZ GIL ${fmt(dia(5))}`)
  await expect(aviso).not.toContainText('SARA')
  await expect(aviso.getByRole('link', { name: 'Ver en Días libres' })).toHaveAttribute('href', '/panel/turnos?centro=NORTE')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-1: sin `pendientes` (un servidor de antes) el Cuadrante, el Asistente y la propuesta salen como hoy', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const propuesta = { id: 'pr1', center: 'NORTE', desde: dia(2), hasta: dia(13), n_cambios: 1, extras: 0, resumen_dias: [], avisos: [],
    faltan_conductores: 0, cambios: [{ driver_id: 'p1', nombre: 'A', fecha: dia(3), antes: 'N/T', valor: '1', extra: false, antes_extra: false }] }
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia, { propuesta })))
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Propuesta del motor')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('punto-pendiente')).toHaveCount(0)
  await expect(page.getByTestId('propuesta-pendientes')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver lo actual' }).click()
  await celdaDe(page, 'ANTONIO GARCÍA LÓPEZ', dia(3)).click()
  await expect(page.getByRole('button', { name: 'Vaciar', exact: true })).toBeVisible()
  await expect(page.getByTestId('menu-pendiente')).toHaveCount(0)
  const vp = page.viewportSize()
  await page.mouse.click(Math.round(vp.width / 2), vp.height - 10)
  await expect(page.getByRole('button', { name: 'Vaciar', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Rehacer cuadrante' }).click()
  await expect(page.getByText('Nadie de baja sin fecha de vuelta')).toBeVisible()
  await expect(page.getByTestId('asistente-pendientes')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// ── cuadrante-8 · «Avisar a los conductores» ─────────────────────────────────────────────────────────────────────

const previa = (dia) => ({
  hasta: dia(14), cambios: ['c1'],
  personas: [
    { driver_id: 'p1', nombre: 'ANTONIO GARCÍA LÓPEZ', dias: [
      { fecha: dia(3), antes: 'trabajas', ahora: 'libras', texto: 'x' },
      { fecha: dia(4), antes: 'libras', ahora: 'trabajas', texto: 'x' }] },
    { driver_id: 'p2', nombre: 'LAURA SÁNCHEZ GIL', dias: [{ fecha: dia(5), antes: 'sin turno', ahora: 'vacaciones', texto: 'x' }] },
  ],
})

test('cuadrante-8: el botón enseña la lista antes de mandar; desmarcar a uno manda solo a los demás', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia)))
  let pedidaPrevia = 0
  await page.route(/\/api\/cuadrante\/avisos\/previa/, (route) => { pedidaPrevia += 1; return json(previa(dia))(route) })
  let enviado = null
  await page.route(/\/api\/cuadrante\/avisos\/enviar/, (route) => {
    enviado = route.request().postDataJSON()
    return json({ avisados: 1, personas: [previa(dia).personas[1]] })(route)
  })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
  // Nada se pide ni se manda hasta pulsar.
  expect(pedidaPrevia).toBe(0)
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana).toContainText(`Tienen cambios sin avisar de hoy al ${fmt(dia(14))}`)
  await expect(ventana).toContainText(`${fmt(dia(3))}: libras · `)
  await expect(ventana).toContainText(`${fmt(dia(5))}: vacaciones`)
  await expect(ventana.getByRole('checkbox')).toHaveCount(2)
  await expect(ventana.getByRole('button', { name: 'Avisar a 2' })).toBeEnabled()
  await ventana.getByRole('checkbox', { name: 'Avisar a ANTONIO GARCÍA LÓPEZ' }).uncheck()
  expect(enviado).toBeNull()
  await ventana.getByRole('button', { name: 'Avisar a 1' }).click()
  await expect.poll(() => enviado).toEqual({ center: 'NORTE', driver_ids: ['p2'] })
  await expect(ventana).toHaveCount(0)
  await expect(page.getByText('Avisado 1 conductor: LAURA SÁNCHEZ GIL.')).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: sin cambios por avisar lo dice y no deja mandar; con un servidor de antes, tampoco se rompe', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia)))
  let respuesta = json({ personas: [], cambios: [], hasta: dia(14) })
  await page.route(/\/api\/cuadrante\/avisos\/previa/, (route) => respuesta(route))
  let enviado = 0
  await page.route(/\/api\/cuadrante\/avisos\/enviar/, (route) => { enviado += 1; return json({ avisados: 0, personas: [] })(route) })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana).toContainText('Nadie tiene cambios sin avisar de hoy a 14 días.')
  await expect(ventana.getByRole('button', { name: /^Avisar a/ })).toHaveCount(0)
  await ventana.getByTestId('avisar-previa').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(ventana).toHaveCount(0)
  // Un servidor que aún no tiene la ruta (404): se dice, sin romper la pantalla.
  respuesta = json({ detail: 'Not Found' }, 404)
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  await expect(ventana).toContainText('El servidor todavía no tiene esta función')
  await page.keyboard.press('Escape')
  await expect(ventana).toHaveCount(0)
  await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible()
  expect(enviado).toBe(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: al aceptar una propuesta, el aviso verde lleva el mismo botón (y se va con ese aviso)', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const propuesta = { id: 'pr1', center: 'NORTE', desde: dia(2), hasta: dia(13), n_cambios: 1, extras: 0, resumen_dias: [], avisos: [],
    faltan_conductores: 0, cambios: [{ driver_id: 'p1', nombre: 'A', fecha: dia(3), antes: '1', valor: 'N/T', extra: false, antes_extra: false }] }
  let aceptada = false
  await page.route(/\/api\/cuadrante\?/, (route) => json(cuadrante(dia, aceptada ? {} : { propuesta }))(route))
  await page.route(/\/api\/cuadrante\/propuestas\/pr1\/aceptar/, (route) => { aceptada = true; return json({ ok: true, aplicadas: 1, n_saltadas: 0 })(route) })
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previa(dia)))
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
  await expect(page.getByText('Propuesta aplicada: 1 celdas.')).toBeVisible({ timeout: 15000 })
  await page.getByTestId('avisar-tras-aceptar').click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana.getByRole('button', { name: 'Avisar a 2' })).toBeVisible()
  await ventana.getByRole('button', { name: 'Cancelar' }).click()
  await expect(ventana).toHaveCount(0)
  // Al cerrar ese aviso verde, el botón se va con él (el de arriba sigue).
  await page.getByRole('button', { name: 'Cerrar aviso' }).click()
  await expect(page.getByTestId('avisar-tras-aceptar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Avisar a los conductores' })).toHaveCount(1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: en el móvil la lista cabe sin deslizar de lado', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(cuadrante(dia)))
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previa(dia)))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana.getByRole('button', { name: 'Avisar a 2' })).toBeVisible({ timeout: 15000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  const anchos = await ventana.evaluate((el) => [el.scrollWidth, el.clientWidth])
  expect(anchos[0]).toBeLessThanOrEqual(anchos[1] + 1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})
