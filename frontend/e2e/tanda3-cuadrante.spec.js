/* global process */
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
  // E2E_AHORA=AAAA-MM-DD (opcional, 11-11-2026): mueve el «ahora» a ese día para probar las semanas difíciles (un fin
  // de mes entre el jueves y el viernes, un día 1 al 9) sin esperar a que lleguen. Sin la variable, hoy.
  const ahora = process.env.E2E_AHORA ? new Date(`${process.env.E2E_AHORA}T10:00:00`) : new Date()
  // entrarComoAdmin pone la caducidad del token con el reloj de Node: con el día movido, ese reloj también se mueve.
  if (process.env.E2E_AHORA) Date.now = () => ahora.getTime()
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
// Las fechas de Días libres, como las pinta la pantalla (11-11-2026, P7): la misma llamada que `fmtNum` de Turnos.jsx,
// en el navegador. Su «2-digit» no pone el cero delante («2/12», no «02/12»): compararlas con `fmt` falla del 1 al 9.
const fmtPet = (page, f) => page.evaluate((x) => new Date(`${x}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }), f)

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
  await expect(ana.nth(0)).toContainText(`${await fmtPet(page, dia(9))} · en ruta 3/3 → si se lo das -1`)
  await expect(ana.nth(0)).toContainText('ya concedidos: 1')
  await expect(ana.nth(0)).toContainText('otras pendientes: 1')
  await expect(ana.nth(0)).toHaveClass(/bg-red-500/)
  // El día sin máxima: gris, sin inventar nada.
  await expect(ana.nth(1)).toContainText(`${await fmtPet(page, dia(10))} · sin máxima`)
  await expect(ana.nth(1)).toHaveClass(/bg-dark-800/)
  // El extra de quien ese día no sale a ruta suma uno: 4 de 3, por encima pero sin llegar al colchón de 2 (ámbar).
  const pepe = filaDe(page, 'PEPE RÍOS').getByTestId('chip-cobertura')
  await expect(pepe).toContainText(`${await fmtPet(page, dia(9))} · en ruta 3/3 → si se lo das +1 · ya concedidos: 1`)
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
  await expect(chip).toContainText(`${await fmtPet(page, dia(9))} · en ruta 5/3 → ya libra: no cambia`, { timeout: 15000 })
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
  await expect(filaDe(page, 'ANA PÉREZ').getByText(`${await fmtPet(page, dia(9))} · ${await fmtPet(page, dia(10))}`)).toBeVisible()
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
  await expect(filaDe(page, 'LUIS GÓMEZ').getByTestId('chip-cobertura')).toContainText(`${await fmtPet(page, dia(10))} · sin máxima`, { timeout: 15000 })
  await expect(filaDe(page, 'ANA PÉREZ').getByTestId('chip-cobertura')).toContainText('si se lo das -1')
  expect([...pedidas].sort()).toEqual(['NORTE', 'SUR'])
  await filaDe(page, 'LUIS GÓMEZ').getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByText('LUIS GÓMEZ')).toHaveCount(0)
  // Recargada con la bandeja: ya solo la nave que queda.
  await expect.poll(() => pedidas.length).toBe(3)
  expect(pedidas[2]).toBe('NORTE')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-2: un día pedido fuera del rango que se pudo pedir no lleva chip (no es «sin máxima»: no se pidió)', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  // Ana pide un día de dentro de nueve días y Pepe uno de dentro de casi tres meses: más de los 62 días que da el servidor.
  await page.route(/\/api\/shift-requests(\?|$)/, json({ requests: [
    peticion('r1', 'g1', 'NORTE', 'd1', 'ANA PÉREZ', dia(9)), peticion('r5', 'g5', 'NORTE', 'd3', 'PEPE RÍOS', dia(80))] }))
  const pedidas = []
  await page.route(/\/api\/shift-requests\/cobertura/, (route) => {
    pedidas.push(new URL(route.request().url()).searchParams)
    return json(cobertura(dia, { hasta: dia(70), dias: { [dia(9)]: cobertura(dia).dias[dia(9)] } }))(route)
  })
  await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
  await expect(filaDe(page, 'ANA PÉREZ').getByTestId('chip-cobertura')).toContainText('si se lo das -1', { timeout: 15000 })
  // Se pidió del día 9 al 70 (el tope): el día 80 de Pepe queda fuera y no lleva chip, ni gris ni de ningún color.
  expect(pedidas.map((p) => [p.get('desde'), p.get('hasta')])).toEqual([[dia(9), dia(70)]])
  await expect(filaDe(page, 'PEPE RÍOS').getByText(await fmtPet(page, dia(80)), { exact: true })).toBeVisible()
  await expect(filaDe(page, 'PEPE RÍOS').getByTestId('chip-cobertura')).toHaveCount(0)
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
  // El punto no cambia el tamaño de la celda: igual que la de al lado, sin punto. Se mide al acabar la animación de
  // entrada del <main> (lleva un `transform`): medida a mitad, las dos cajas salían distintas una vez de cada dos (P6).
  await page.locator('main.animate-fade-in').first()
    .evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished.catch(() => {}))))
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
  // Los dos días seguidos, como los junta la pantalla: «12-13/11»; si el jueves y el viernes son de meses distintos,
  // «31/12-01/01» (P5: la semana en que el jueves es fin de mes).
  const tramo = dia(3).slice(5, 7) === dia(4).slice(5, 7) ? `${dia(3).slice(8, 10)}-${fmt(dia(4))}` : `${fmt(dia(3))}-${fmt(dia(4))}`
  await expect(aviso).toContainText(`Peticiones sin contestar en estas fechas: 3 días de 2 personas (ANTONIO GARCÍA LÓPEZ ${tramo}`)
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

// El botón lleva un interruptor en el servidor (11-11-2026): estas pruebas son las del interruptor ENCENDIDO.
const conAvisar = (dia, extra = {}) => cuadrante(dia, { avisar_activo: true, ...extra })

// `desde` (12-11-2026, X6): cuándo se hizo el primer cambio sin avisar, un instante ISO del servidor (a las 10:00 UTC,
// el mismo día en hora de España).
const previa = (dia) => ({
  hasta: dia(14),
  personas: [
    { driver_id: 'p1', nombre: 'ANTONIO GARCÍA LÓPEZ', dias: [
      { fecha: dia(3), antes: 'trabajas', ahora: 'libras', texto: 'x', marca: 'm3|libras', desde: `${dia(0)}T10:00:00Z` },
      { fecha: dia(4), antes: 'libras', ahora: 'trabajas', texto: 'x', marca: 'm4|trabajas', desde: `${dia(1)}T10:00:00Z` }] },
    { driver_id: 'p2', nombre: 'LAURA SÁNCHEZ GIL', dias: [{ fecha: dia(5), antes: 'sin turno', ahora: 'vacaciones', texto: 'x', marca: 'm5|vacaciones', desde: '' }] },
  ],
})
// La misma lista de un servidor sin marcas (antes de la segunda ronda): el panel no manda `vistas`.
const previaSinMarcas = (dia) => {
  const p = previa(dia)
  p.personas.forEach((x) => x.dias.forEach((d) => { delete d.marca }))
  return p
}

test('cuadrante-8: el botón enseña la lista antes de mandar; desmarcar a uno manda solo a los demás', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
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
  // Un día por línea, con lo que el conductor sabía (12-11-2026, X6): antes iban todos en una, separados por « · ».
  await expect(ventana).toContainText(`${fmt(dia(3))}: libras (antes: trabajas)`)
  await expect(ventana).toContainText(`${fmt(dia(5))}: vacaciones (antes: sin turno)`)
  await expect(ventana.getByRole('checkbox')).toHaveCount(2)
  await expect(ventana.getByRole('button', { name: 'Avisar a 2' })).toBeEnabled()
  // Dice cómo le llega de verdad (P23): la bandeja es de la app; en el portal web, solo con las notificaciones.
  await expect(ventana.getByTestId('avisar-como-llega')).toContainText('bandeja de avisos de la app de Android')
  await expect(ventana.getByTestId('avisar-como-llega')).toContainText('En el portal web no hay bandeja')
  await expect(ventana.getByTestId('avisar-desmarcados')).toContainText('volverá a salir aquí si su cuadrante cambia otra vez')
  await ventana.getByRole('checkbox', { name: 'Avisar a ANTONIO GARCÍA LÓPEZ' }).uncheck()
  expect(enviado).toBeNull()
  await ventana.getByRole('button', { name: 'Avisar a 1' }).click()
  // Los marcados y los desmarcados, por separado (P8): a quien apareciera después de abrir la ventana no se le toca.
  // Y las marcas de lo que se vio (segunda ronda, fleco 1): solo se descarta eso. Desde el 12-11-2026 (X2) van también
  // las de los marcados, con `vistas_completas`: a un marcado solo se le dice lo que se vio.
  await expect.poll(() => enviado).toEqual({ center: 'NORTE', driver_ids: ['p2'], descartar_ids: ['p1'],
    vistas: ['m3|libras', 'm4|trabajas', 'm5|vacaciones'], vistas_completas: true })
  await expect(ventana).toHaveCount(0)
  await expect(page.getByText('Avisado 1 conductor: LAURA SÁNCHEZ GIL.')).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: con todos desmarcados, el botón dice «No avisar a nadie», lo explica y los quita de la lista', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previa(dia)))
  let enviado = null
  await page.route(/\/api\/cuadrante\/avisos\/enviar/, (route) => {
    enviado = route.request().postDataJSON()
    return json({ avisados: 0, personas: [], descartados: 2 })(route)
  })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana.getByRole('button', { name: 'Avisar a 2' })).toBeVisible({ timeout: 15000 })
  await expect(ventana.getByTestId('avisar-nadie')).toHaveCount(0)
  for (const c of await ventana.getByRole('checkbox').all()) await c.uncheck()
  // Ya no hay un «Avisar a 0» apagado: el botón sirve para descartar a todos, y la ventana dice qué pasa.
  await expect(ventana.getByRole('button', { name: /^Avisar a/ })).toHaveCount(0)
  await expect(ventana.getByTestId('avisar-nadie')).toContainText('no se manda nada y salen todos de esta lista')
  const boton = ventana.getByRole('button', { name: 'No avisar a nadie' })
  await expect(boton).toBeEnabled()
  expect(enviado).toBeNull()
  await boton.click()
  await expect.poll(() => enviado).toEqual({
    center: 'NORTE', driver_ids: [], descartar_ids: ['p1', 'p2'], vistas: ['m3|libras', 'm4|trabajas', 'm5|vacaciones'],
    vistas_completas: true })
  await expect(ventana).toHaveCount(0)
  await expect(page.getByText('No se ha avisado a nadie: 2 conductores salen de la lista hasta que su cuadrante cambie otra vez.')).toBeVisible()
  await expect(page.getByText('no había cambios por avisar')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: si al mandar no se pudo avisar a nadie (otra persona acababa de avisar), lo dice así', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  // Un servidor sin marcas: el panel no manda `vistas` (lo de antes).
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previaSinMarcas(dia)))
  let enviado = null
  await page.route(/\/api\/cuadrante\/avisos\/enviar/, (route) => {
    enviado = route.request().postDataJSON()
    return json({ avisados: 0, personas: [], descartados: 1 })(route)
  })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await ventana.getByRole('checkbox', { name: 'Avisar a ANTONIO GARCÍA LÓPEZ' }).uncheck({ timeout: 15000 })
  await ventana.getByRole('button', { name: 'Avisar a 1' }).click()
  await expect.poll(() => enviado).toEqual({ center: 'NORTE', driver_ids: ['p2'], descartar_ids: ['p1'] })
  await expect(page.getByText('No se ha avisado a nadie: otra persona acababa de avisar de estos cambios, o han cambiado mientras tanto.', { exact: false })).toBeVisible()
  await expect(page.getByText('no había cambios por avisar')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8: sin cambios por avisar lo dice y no deja mandar; con un servidor de antes, tampoco se rompe', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  let respuesta = json({ personas: [], hasta: dia(14) })
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
  await page.route(/\/api\/cuadrante\?/, (route) => json(conAvisar(dia, aceptada ? {} : { propuesta }))(route))
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
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
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

// ── Terminar «Avisar a los conductores» (12-11-2026): el «antes» y desde cuándo (X6), y a quién no se avisó (X7) ──────

test('cuadrante-8 (X6): cada día dice lo de ahora, lo que el conductor sabía y desde cuándo está sin avisar', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previa(dia)))
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  const dias = ventana.getByTestId('avisar-dia')
  await expect(dias).toHaveCount(3, { timeout: 15000 })
  // dia(3) es jueves, dia(4) viernes y dia(5) sábado (los días salen del lunes de esta semana).
  await expect(dias.nth(0)).toContainText(`jue ${fmt(dia(3))}: libras (antes: trabajas)`)
  await expect(dias.nth(0)).toContainText(`cambiado el ${fmt(dia(0))}`)
  await expect(dias.nth(1)).toContainText(`vie ${fmt(dia(4))}: trabajas (antes: libras)`)
  await expect(dias.nth(1)).toContainText(`cambiado el ${fmt(dia(1))}`)
  // Sin `desde` (no se sabe), no se inventa una fecha.
  await expect(dias.nth(2)).toContainText(`sáb ${fmt(dia(5))}: vacaciones (antes: sin turno)`)
  await expect(dias.nth(2)).not.toContainText('cambiado el')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('cuadrante-8 (X7): al acabar dice con nombres a quién no se avisó y por qué', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previa(dia)))
  const [ana, laura] = previa(dia).personas
  const no = (p, motivo, parcial = false) => ({ driver_id: p.driver_id, nombre: p.nombre, motivo, parcial })
  let respuesta = { avisados: 1, personas: [laura], descartados: 0, no_avisados: [no(ana, 'cambiado')] }
  await page.route(/\/api\/cuadrante\/avisos\/enviar/, (route) => json(respuesta)(route))
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  const avisar = async () => {
    await page.getByRole('button', { name: 'Avisar a los conductores' }).first().click()
    await ventana.getByRole('button', { name: 'Avisar a 2' }).click({ timeout: 15000 })
    await expect(ventana).toHaveCount(0)
  }
  await avisar()
  await expect(page.getByText('Avisado 1 conductor: LAURA SÁNCHEZ GIL. A ANTONIO GARCÍA LÓPEZ no se le ha avisado: su día ' +
    'cambió mientras tenías la ventana abierta. Vuelve a abrirla.', { exact: true })).toBeVisible()
  // Los otros dos motivos, sin avisar a nadie.
  respuesta = { avisados: 0, personas: [], descartados: 0, no_avisados: [no(ana, 'ya_avisado'), no(laura, 'no_guardado')] }
  await avisar()
  await expect(page.getByText('A ANTONIO GARCÍA LÓPEZ no se le ha avisado: otra persona acababa de avisarle. A LAURA SÁNCHEZ ' +
    'GIL no se le ha avisado: no se ha podido guardar el aviso. Inténtalo otra vez.', { exact: true })).toBeVisible()
  await expect(page.getByText('No se ha avisado a nadie')).toHaveCount(0)
  // Varios con el mismo motivo van juntos; y a quien se le avisó de una parte se le dice «de algún día».
  respuesta = { avisados: 2, personas: [ana, laura], descartados: 0, no_avisados: [no(ana, 'cambiado', true), no(laura, 'cambiado', true)] }
  await avisar()
  await expect(page.getByText('Avisados 2 conductores: ANTONIO GARCÍA LÓPEZ, LAURA SÁNCHEZ GIL. A ANTONIO GARCÍA LÓPEZ y LAURA ' +
    'SÁNCHEZ GIL no se les ha avisado de algún día: sus días cambiaron mientras tenías la ventana abierta. Vuelve a abrirla.',
  { exact: true })).toBeVisible()
  // Revisión 5: a un marcado cuyo día pasó a otra nave con la ventana abierta se le nombra, con la nave.
  respuesta = { avisados: 1, personas: [laura], descartados: 0, no_avisados: [{ ...no(ana, 'otra_nave'), nave: 'DGA1' }] }
  await avisar()
  await expect(page.getByText('Avisado 1 conductor: LAURA SÁNCHEZ GIL. A ANTONIO GARCÍA LÓPEZ no se le ha avisado: su día ha ' +
    'pasado a otra nave (DGA1) y se avisa desde allí.', { exact: true })).toBeVisible()
  // Sin `no_avisados` (un servidor de antes), lo de siempre.
  respuesta = { avisados: 2, personas: [ana, laura], descartados: 0 }
  await avisar()
  await expect(page.getByText('Avisados 2 conductores: ANTONIO GARCÍA LÓPEZ, LAURA SÁNCHEZ GIL.', { exact: true })).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// Lo más largo que puede decir un día (la nave, «de acompañante», el «antes») con nombres largos: en el móvil cabe.
const previaLarga = (dia) => ({
  hasta: dia(14),
  personas: [
    { driver_id: 'p1', nombre: 'MARÍA DE LOS ÁNGELES FERNÁNDEZ DE CÓRDOBA', dias: [
      { fecha: dia(3), antes: 'de acompañante en DGA1', ahora: 'trabajas (extra) en DGA1', texto: 'x', marca: 'a', desde: `${dia(0)}T10:00:00Z` },
      { fecha: dia(4), antes: 'trabajas (extra) en DGA1', ahora: 'de acompañante en DGA2', texto: 'x', marca: 'b', desde: `${dia(0)}T10:00:00Z` },
      { fecha: dia(6), antes: 'sin turno', ahora: 'no disponible', texto: 'x', marca: 'c', desde: `${dia(1)}T10:00:00Z` }] },
    { driver_id: 'p2', nombre: 'LAURA SÁNCHEZ GIL', dias: [{ fecha: dia(5), antes: 'trabajas', ahora: 'vacaciones', texto: 'x', marca: 'd', desde: `${dia(1)}T10:00:00Z` }] },
  ],
})

test('cuadrante-8 (X6): en el móvil los días con nave y «antes» caben sin deslizar de lado', async ({ page }) => {
  const fallos = vigilar(page)
  const { dia } = await reloj(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/cuadrante\?/, json(conAvisar(dia)))
  await page.route(/\/api\/cuadrante\/avisos\/previa/, json(previaLarga(dia)))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Avisar a los conductores' }).click()
  const ventana = page.getByRole('dialog', { name: 'Avisar a los conductores' })
  await expect(ventana.getByTestId('avisar-dia')).toHaveCount(4, { timeout: 15000 })
  await expect(ventana.getByTestId('avisar-dia').first()).toContainText('trabajas (extra) en DGA1 (antes: de acompañante en DGA1)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  const anchos = await ventana.evaluate((el) => [el.scrollWidth, el.clientWidth])
  expect(anchos[0]).toBeLessThanOrEqual(anchos[1] + 1)
  const salidos = await ventana.getByTestId('avisar-dia').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
  expect(salidos).toBe(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// El interruptor APAGADO (11-11-2026): sin `avisar_activo` (un servidor de antes, o el de producción) o con false, ni
// el botón de arriba ni el del aviso verde de aceptar, y «Deshacer» queda donde estaba, sin envoltorio (como en main).
for (const [caso, extra] of [['sin el campo', {}], ['con false', { avisar_activo: false }]]) {
  test(`cuadrante-8: con el aviso apagado (${caso}) no hay botón ni ventana y la barra queda como antes`, async ({ page }) => {
    const fallos = vigilar(page)
    const { dia } = await reloj(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const propuesta = { id: 'pr1', center: 'NORTE', desde: dia(2), hasta: dia(13), n_cambios: 1, extras: 0, resumen_dias: [], avisos: [],
      faltan_conductores: 0, cambios: [{ driver_id: 'p1', nombre: 'A', fecha: dia(3), antes: '1', valor: 'N/T', extra: false, antes_extra: false }] }
    const ultimo = { id: 'c1', que: 'Celdas', en: `${dia(0)}T10:00:00Z`, por: 'Oficina', n: 1 }
    let aceptada = false
    await page.route(/\/api\/cuadrante\?/, (route) => json(cuadrante(dia, { ultimo_cambio: ultimo, ...(aceptada ? {} : { propuesta }), ...extra }))(route))
    await page.route(/\/api\/cuadrante\/propuestas\/pr1\/aceptar/, (route) => { aceptada = true; return json({ ok: true, aplicadas: 1, n_saltadas: 0 })(route) })
    let pedidas = 0
    await page.route(/\/api\/cuadrante\/avisos\//, (route) => { pedidas += 1; return json({ detail: 'No disponible' }, 404)(route) })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    const deshacer = page.getByRole('button', { name: 'Deshacer último cambio' })
    await expect(deshacer).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Avisar a los conductores' })).toHaveCount(0)
    // «Deshacer» va directo en la barra de las pestañas, empujado a la derecha, como en main.
    expect(await deshacer.evaluate((b) => [b.classList.contains('ml-auto'), b.parentElement.textContent.includes('Personas y notas')]))
      .toEqual([true, true])
    await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await expect(page.getByText('Propuesta aplicada: 1 celdas.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('avisar-tras-aceptar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Avisar a los conductores' })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Avisar a los conductores' })).toHaveCount(0)
    expect(pedidas).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
}
