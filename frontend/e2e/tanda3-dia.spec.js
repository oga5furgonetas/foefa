import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

/* Tanda 3, zona «día» (11-11-2026): la ITV y el cuadrante en la Plantilla, y «otro guardó» en la Asignación.
   API simulada; cada caso pone encima las rutas que necesita. Se lanza en los dos proyectos (escritorio y movil).

   El reloj del navegador, parado (como en arreglos-dia y tanda2-dia): un 14 a mediodía, en el pasado, y las fechas de
   cada prueba salen de ese mismo instante. */

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const hojaDe = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`
const AHORA = new Date(2026, 9, 14, 12, 0, 0)
const elDia = (n) => { const d = new Date(AHORA); d.setDate(d.getDate() + n); return d }

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

const FILA = (ruta, conductor, furgo = '') => ({ ruta, conductor, movil: '', furgo, h_llegada: '', h_bajada: '', h_salida: '',
  observaciones: '' })

/* Abre la Plantilla con un borrador compartido de esas filas. `rutas`: {patrón: manejador} encima de la API simulada. */
async function abrirPlantilla(page, filas, rutas = {}, fecha = hojaDe(elDia(0))) {
  await page.clock.setFixedTime(AHORA)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/tools\/plantilla-compartida/, (route) => (route.request().method() === 'GET'
    ? json({ id: 'b1', revision: 1, updated_by: 'Admin Test', state: { week: '42', date: fecha, rows: filas } })(route)
    : json({ revision: 2, updated_by: 'Admin Test' })(route)))
  for (const [patron, manejador] of Object.entries(rutas)) await page.route(new RegExp(patron), manejador)
  await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('textbox', { name: 'Conductor', exact: true })).toHaveCount(filas.length, { timeout: 45000 })
}

/* ── dia-5 · la ITV en la Plantilla ── */
test.describe('Plantilla · la ITV caducada', () => {
  const VEHICULOS = [
    { id: 'v1', license_plate: '1234 ABC', status: 'active', center: 'NORTE', itv_date: iso(elDia(-30)) },
    { id: 'v2', license_plate: '5678 DEF', status: 'active', center: 'NORTE', itv_date: iso(elDia(400)) },
    { id: 'v3', license_plate: '9012 GHI', status: 'active', center: 'NORTE', itv_date: '' },
  ]

  test('la furgoneta con la ITV caducada lleva la marca, y la nota dice por qué no se puso', async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = []
    await abrirPlantilla(page, [FILA('CX1', 'ANA PÉREZ', '1234ABC'), FILA('CX2', 'LUIS GÓMEZ', '5678DEF'), FILA('CX3', 'SARA VIDAL')], {
      '/api/vehicles(\\?|$)': json(VEHICULOS),
      '/api/tools/plantilla-furgos': (route) => {
        pedidos.push(route.request().postDataJSON())
        return json({ propuestas: [], opciones: {}, conflictos: [], mover: [], sin_nombre: [], sin_furgo: [2], con_fija: 1,
          itv_caducada: [{ furgo: '1234 ABC', itv_date: iso(elDia(-30)), conductor: 'SARA VIDAL' }] })(route)
      },
    })
    const celdas = page.getByRole('textbox', { name: 'Vehículo', exact: true })
    // La marca va junto a la 1234ABC (caducada) y no junto a la 5678DEF (en regla).
    const marca = page.getByTestId('pg-itv')
    await expect(marca).toHaveCount(1)
    const fila0 = celdas.nth(0).locator('xpath=..')
    await expect(fila0.getByTestId('pg-itv')).toHaveText(DICT['pg.ff.itvMarca'].es)
    await expect(fila0.getByTestId('pg-itv')).toHaveAttribute('title', `ITV caducada desde el ${hojaDe(elDia(-30))}`)
    // La nota de «Poner furgonetas».
    const nota = page.getByTestId('pg-itv-nota')
    await expect(nota).toHaveText(`No se ha puesto la 1234 ABC a SARA VIDAL: ITV caducada desde el ${hojaDe(elDia(-30))}. `
      + 'Si ya la pasó, cambia la fecha en su ficha.', { timeout: 15000 })
    // Y se mandó el día de la hoja.
    expect(pedidos.at(-1).date).toBe(hojaDe(elDia(0)))
    // En el desplegable de la fila 3 también se marca, y se puede elegir igual (es un aviso, no un bloqueo).
    await page.getByRole('button', { name: DICT['pg.tVerFurgos'].es }).nth(2).click()
    const opcion = page.getByRole('button', { name: /1234ABC/ })
    await expect(opcion.getByTestId('pg-itv')).toBeVisible()
    await expect(page.getByRole('button', { name: /5678DEF/ }).getByTestId('pg-itv')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('se mide contra el día de la hoja: en una hoja de antes de que caduque no sale', async ({ page }) => {
    const caduca = iso(elDia(3))
    await abrirPlantilla(page, [FILA('CX1', 'ANA PÉREZ', '1234ABC')], {
      '/api/vehicles(\\?|$)': json([{ ...VEHICULOS[0], itv_date: caduca }]),
    })
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue(hojaDe(elDia(0)))
    await expect(page.getByTestId('pg-itv')).toHaveCount(0)
    // La hoja pasa a la semana que viene: ya está caducada ese día.
    await page.getByRole('textbox', { name: 'Fecha' }).fill(hojaDe(elDia(7)))
    await expect(page.getByTestId('pg-itv')).toHaveCount(1)
  })

  test('con un servidor de antes (sin itv_caducada) la caja de «Poner furgonetas» no cambia', async ({ page }) => {
    const fallos = vigilar(page)
    await abrirPlantilla(page, [FILA('CX1', 'ANA PÉREZ')], {
      '/api/vehicles(\\?|$)': json(VEHICULOS),
      '/api/tools/plantilla-furgos': json({ propuestas: [], opciones: {}, conflictos: [], mover: [], sin_nombre: [], sin_furgo: [0], con_fija: 1 }),
    })
    await page.waitForResponse(/plantilla-furgos/)
    await expect(page.getByTestId('pg-itv-nota')).toHaveCount(0)
    expect(fallos).toEqual([])
  })
})

/* ── dia-4 · el cuadrante en la Plantilla ── */
test.describe('Plantilla · el cuadrante y las suspensiones', () => {
  const FILAS = [FILA('CX1', 'ANA PÉREZ'), FILA('CX2', 'LUIS GÓMEZ')]
  const AVISOS = [
    { fila: 0, campo: 'conductor', tipo: 'no_tiene_turno', texto: 'En el cuadrante ese día: Vacaciones', sugerencia: null },
    { fila: 1, campo: 'conductor', tipo: 'suspendido', texto: 'Suspendido del 13/10 al 16/10', sugerencia: null },
  ]
  const validar = (extra) => (route) => json({ avisos: AVISOS, con_asignacion: false, dia: iso(elDia(0)),
    resumen: { filas: 2, con_aviso: 2 }, ...extra })(route)

  test('los avisos nuevos salen en la caja de siempre y la lista de quien tiene turno y no está en la hoja', async ({ page }) => {
    const fallos = vigilar(page)
    await abrirPlantilla(page, FILAS, {
      '/api/tools/plantilla-validar': validar({ con_cuadrante: true,
        faltan: [{ driver_id: 'd3', nombre: 'SARA VIDAL' }, { driver_id: 'd4', nombre: 'PABLO SOUTO' }] }),
    })
    await expect(page.getByText('En el cuadrante ese día: Vacaciones')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Suspendido del 13/10 al 16/10')).toBeVisible()
    // Sin botón de «Poner» (sugerencia null).
    await expect(page.getByRole('button', { name: /^Poner «/ })).toHaveCount(0)
    await expect(page.getByTestId('pg-faltan')).toHaveText(`${DICT['pg.avisos.faltan'].es} SARA VIDAL · PABLO SOUTO`)
    // Y la celda del conductor de esas filas, marcada como cualquier otro aviso.
    await expect(page.getByRole('textbox', { name: 'Conductor', exact: true }).first()).toHaveClass(/ring-amber-500/)
    expect(fallos).toEqual([])
  })

  test('sin cuadrante de la nave ese día, o con un servidor de antes, no se dice nada de quien falta', async ({ page }) => {
    let extra = { con_cuadrante: false, faltan: [{ driver_id: 'd3', nombre: 'SARA VIDAL' }] }
    const llamadas = []
    await abrirPlantilla(page, FILAS, {
      '/api/tools/plantilla-validar': (route) => { llamadas.push(1); return validar(extra)(route) },
    })
    await expect(page.getByText('En el cuadrante ese día: Vacaciones')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('pg-faltan')).toHaveCount(0)
    // El servidor de antes: ni `faltan` ni `con_cuadrante`.
    extra = {}
    const antes = llamadas.length
    await page.getByRole('textbox', { name: 'Conductor', exact: true }).nth(1).fill('LUIS GÓMEZ RUIZ')
    await expect.poll(() => llamadas.length, { timeout: 15000 }).toBeGreaterThan(antes)
    await expect(page.getByText('En el cuadrante ese día: Vacaciones')).toBeVisible()
    await expect(page.getByTestId('pg-faltan')).toHaveCount(0)
  })
})

/* ── dia-6 · Asignación: otra persona guardó mientras editabas ── */
test.describe('Asignación · otra persona guardó mientras editabas', () => {
  const VEHICULOS = [1, 2, 3].map((i) => ({ id: `v${i}`, license_plate: `${1000 + i} ABC`, status: 'active', center: 'NORTE',
    itv_date: iso(elDia(400)) }))
  const DRIVERS = ['ANA LÓPEZ', 'LUIS GÓMEZ', 'SARA VIDAL'].map((name, i) => ({ id: `d${i + 1}`, name, center: 'NORTE' }))
  const slot = (i) => ({ vehicle_id: `v${i}`, vehicle_plate: `${1000 + i} ABC`, driver_id: `d${i}`, driver_name: DRIVERS[i - 1].name })
  const V1 = '2026-10-14T06:00:00+00:00'
  const V2 = '2026-10-14T07:30:00+00:00'

  /* `servidor`: el estado que contesta el GET ({updated_at, updated_by, slots}); `alGuardar(cuerpo)`: lo que contesta el
     PUT ({status, body}). Devuelve los cuerpos de los PUT. */
  async function abrir(page, servidor, alGuardar, { relojQueCorre = false } = {}) {
    if (relojQueCorre) await page.clock.install({ time: AHORA })
    else await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/vehicles(\?|$)/, json(VEHICULOS))
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    const puts = []
    await page.route(/\/api\/assignments\/daily/, (route) => {
      if (route.request().method() === 'PUT') {
        const cuerpo = route.request().postDataJSON()
        puts.push(cuerpo)
        const r = alGuardar(cuerpo)
        return json(r.body, r.status)(route)
      }
      return json([{ id: 'a1', date: iso(elDia(0)), center: 'NORTE', ...servidor() }])(route)
    })
    await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('asgn-fila')).toHaveCount(servidor().slots.length, { timeout: 45000 })
    return puts
  }

  test('al guardar con un 409, nada de pantalla se pierde y «Guardar lo mío encima» manda forzar', async ({ page }) => {
    const fallos = vigilar(page)
    const puts = await abrir(page, () => ({ updated_at: V1, updated_by: 'Admin Test', slots: [slot(1), slot(2)] }),
      (c) => (c.forzar ? { status: 200, body: { success: true, action: 'updated', id: 'a1', updated_at: '2026-10-14T08:00:00+00:00' } }
        : { status: 409, body: { detail: { codigo: 'otro_guardo', por: 'María', updated_at: V2 } } }))
    await page.getByRole('button', { name: DICT['asgn.add.row'].es }).click()
    await expect(page.getByTestId('asgn-fila')).toHaveCount(3)
    await page.getByRole('button', { name: DICT['asgn.save'].es }).click()
    const aviso = page.getByTestId('asgn-conflicto')
    await expect(aviso).toContainText('María guardó a las')
    await expect(aviso).toContainText('Tus cambios siguen aquí')
    expect(puts[0].version).toBe(V1)
    expect(puts[0].forzar).toBeUndefined()
    // Lo de pantalla sigue: las tres filas y «Cambios sin guardar».
    await expect(page.getByTestId('asgn-fila')).toHaveCount(3)
    await expect(page.getByText(DICT['asgn.unsaved'].es, { exact: true })).toBeVisible()
    await expect(page.getByText(DICT['asgn.save.error'].es)).toHaveCount(0)
    await aviso.getByRole('button', { name: DICT['asgn.conflicto.encima'].es }).click()
    await expect(aviso).toHaveCount(0)
    expect(puts[1]).toMatchObject({ version: V1, forzar: true })
    await expect(page.getByText(DICT['asgn.unsaved'].es, { exact: true })).toHaveCount(0)
    // El siguiente guardado va con la versión que devolvió el servidor, y ya sin forzar.
    await page.getByRole('button', { name: DICT['asgn.add.row'].es }).click()
    await page.getByRole('button', { name: DICT['asgn.save'].es }).click()
    await expect.poll(() => puts.length).toBe(3)
    expect(puts[2].version).toBe('2026-10-14T08:00:00+00:00')
    expect(puts[2].forzar).toBeUndefined()
    expect(fallos).toEqual([])
  })

  test('«Ver lo suyo» pregunta y carga lo guardado', async ({ page }) => {
    let estado = { updated_at: V1, updated_by: 'Admin Test', slots: [slot(1)] }
    await abrir(page, () => estado, () => ({ status: 409, body: { detail: { codigo: 'otro_guardo', por: 'María', updated_at: V2 } } }))
    await page.getByRole('button', { name: DICT['asgn.add.row'].es }).click()
    await page.getByRole('button', { name: DICT['asgn.save'].es }).click()
    await expect(page.getByTestId('asgn-conflicto')).toBeVisible()
    estado = { updated_at: V2, updated_by: 'María', slots: [slot(1), slot(2), slot(3)] }
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: DICT['asgn.conflicto.ver'].es }).click()
    await expect(page.getByTestId('asgn-fila')).toHaveCount(3)
    await expect(page.getByTestId('asgn-conflicto')).toHaveCount(0)
    await expect(page.getByText(DICT['asgn.unsaved'].es, { exact: true })).toHaveCount(0)
  })

  test('el sondeo: sin cambios se ve lo de la otra persona; con cambios, solo se avisa', async ({ page }) => {
    let estado = { updated_at: V1, updated_by: 'Admin Test', slots: [slot(1)] }
    await abrir(page, () => estado, () => ({ status: 200, body: {} }), { relojQueCorre: true })
    // Otra persona guarda: a los 30 s se ve lo suyo, sin preguntar (aquí no había nada sin guardar).
    estado = { updated_at: V2, updated_by: 'María', slots: [slot(1), slot(2)] }
    await page.clock.fastForward(31000)
    await expect(page.getByTestId('asgn-fila')).toHaveCount(2)
    await expect(page.getByTestId('asgn-conflicto')).toHaveCount(0)
    // Ahora con algo sin guardar aquí: el siguiente cambio de la otra persona solo se avisa.
    await page.getByRole('button', { name: DICT['asgn.add.row'].es }).click()
    await expect(page.getByTestId('asgn-fila')).toHaveCount(3)
    estado = { updated_at: '2026-10-14T09:00:00+00:00', updated_by: 'María', slots: [slot(3)] }
    await page.clock.fastForward(31000)
    await expect(page.getByTestId('asgn-conflicto')).toContainText('María guardó a las')
    await expect(page.getByTestId('asgn-fila')).toHaveCount(3)
  })

  test('con un servidor de antes (sin updated_at al guardar) no se manda versión y todo va como siempre', async ({ page }) => {
    const puts = await abrir(page, () => ({ updated_at: V1, slots: [slot(1)] }),
      () => ({ status: 200, body: { success: true, action: 'updated', id: 'a1' } }))
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: DICT['asgn.add.row'].es }).click()
      await page.getByRole('button', { name: DICT['asgn.save'].es }).click()
      await expect.poll(() => puts.length).toBe(i + 1)
      await expect(page.getByText(DICT['asgn.unsaved'].es, { exact: true })).toHaveCount(0)
    }
    expect(puts[0].version).toBe(V1)
    expect('version' in puts[1]).toBe(false)
    await expect(page.getByTestId('asgn-conflicto')).toHaveCount(0)
  })
})
