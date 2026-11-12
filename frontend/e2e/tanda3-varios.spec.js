import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* Tanda 3, zona «varios» (11-11-2026), historia-5: «Mi día» avisa de los próximos días (hoy, mañana y pasado) que no
   llegan a la máxima de conductores, con un enlace a Turnos → Refuerzos (sin botón de pedir), y cuando falta la
   Asignación diaria dice «Falta la asignación de hoy» en vez de «No hay cuadrante de hoy».

   API simulada. El reloj del navegador está fijo (page.clock) y las fechas de la respuesta salen de él: nada depende
   del día en que se pase la prueba. */

const json = (body, status = 200) => (route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Jueves, 9:00 en la hora del equipo. En el PASADO a propósito: la sesión simulada caduca una hora después del reloj
// de verdad, y con el del navegador por delante el panel la daría por cerrada.
const AHORA = new Date(2026, 9, 15, 9, 0, 0)
const dentroDe = (n) => { const d = new Date(AHORA); d.setDate(d.getDate() + n); return iso(d) }
const HOY = iso(AHORA)

// Una asignación con todo hecho: sin las faltas, «Mi día» diría «todo en orden».
const SLOTS = [{ driver_id: 'd1', driver_name: 'Ana López', vehicle_id: 'v1', vehicle_plate: '1234 ABC' }]
const INSPS = [{ id: 'i1', driver_id: 'd1', vehicle_id: 'v1', created_at: `${HOY}T07:30:00`, analysis: { new_damages: [] } }]

const falta = (n, extra = {}) => ({
  date: dentroDe(n), dia: `día ${dentroDe(n).slice(8)}`, maximo: 20, en_ruta: 15, bajan: 2, falta: 3, pueden: 2,
  refuerzo: null, ...extra,
})

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/** Abre «Mi día» de OGA5 con la asignación hecha y lo que diga `faltas` (una función de ruta). Devuelve las
 *  direcciones con las que se pidió /refuerzos/faltas. */
async function abrir(page, { faltas, slots = SLOTS, permisos } = {}) {
  await page.clock.setFixedTime(AHORA)
  await entrarComoAdmin(page, { centros: ['OGA5'] })
  if (permisos) {
    await page.addInitScript((p) => {
      const a = JSON.parse(localStorage.getItem('flota_admin'))
      localStorage.setItem('flota_admin', JSON.stringify({ ...a, permissions: p }))
    }, permisos)
  }
  await simularApi(page, 'vacio')
  await page.route(/\/api\/assignments\/daily/, json({ date: HOY, slots }))
  await page.route(/\/api\/inspections(\?|$)/, json(INSPS))
  const pedidas = []
  await page.route(/\/api\/refuerzos\/faltas/, (route) => {
    pedidas.push(route.request().url())
    return (faltas || json({ faltas: [], con_maximas: true, dias: 3 }))(route)
  })
  await page.goto('/panel/mi-dia', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main h1').first()).toHaveText('Mi día', { timeout: 30000 })
  // Lo último que pinta la pantalla al cargar es la rejilla de abajo («Furgonetas sin conductor»).
  await expect(page.getByText('Furgonetas sin conductor')).toBeVisible({ timeout: 30000 })
  return pedidas
}

test.describe('historia-5 · «Mi día» avisa de los días que no llegan a la máxima', () => {
  test('sin faltas: «todo en orden» y ninguna tarjeta (el control)', async ({ page }) => {
    const fallos = vigilar(page)
    const pedidas = await abrir(page)
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    // Solo se piden los 3 días que se enseñan.
    expect(pedidas.length).toBeGreaterThan(0)
    expect(new URL(pedidas[0]).searchParams.get('dias')).toBe('3')
    expect(new URL(pedidas[0]).searchParams.get('center')).toBe('OGA5')
    expect(fallos).toEqual([])
  })

  test('con faltas mañana: la tarjeta lo dice, no hay «todo en orden» y lleva a Refuerzos', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { faltas: json({ faltas: [falta(1), falta(5)], con_maximas: true, dias: 3 }) })
    const tarjeta = page.getByTestId('midia-faltan')
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('Faltan conductores')
    // Solo hasta pasado mañana: el día de dentro de 5 no sale.
    await expect(tarjeta.getByTestId('midia-falta')).toHaveCount(1)
    const fila = tarjeta.getByTestId('midia-falta').first()
    await expect(fila).toContainText(`día ${dentroDe(1).slice(8)}`)
    await expect(fila).toContainText('máxima 20 · en ruta 15 (+2 de otros centros)')
    await expect(fila).toContainText('faltan 3')
    await expect(fila).toContainText('2 pueden apuntarse')
    await expect(tarjeta).toContainText('Pídelos en Turnos → Refuerzos')
    // Ni botón de pedir dentro: solo el enlace.
    await expect(tarjeta.getByRole('button')).toHaveCount(0)
    await expect(page.getByText(/^Todo en orden/)).toHaveCount(0)
    await expect(tarjeta).toHaveAttribute('href', '/panel/turnos?vista=refuerzos&centro=OGA5')

    await tarjeta.click()
    await expect(page).toHaveURL(/\/panel\/turnos\?vista=refuerzos$/, { timeout: 30000 })
    await expect(page.getByTestId('pestanas-dias').getByRole('button', { name: /^Refuerzos/ }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(fallos).toEqual([])
  })

  test('con un refuerzo ya pedido dice cuántos van aprobados y no manda pedirlo', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [
      falta(0, { bajan: 0, refuerzo: { id: 'r1', plazas: 3, estado: 'abierto', auto: false, aprobados: 1 } }),
      falta(2, { pueden: 0, refuerzo: { id: 'r2', plazas: 3, estado: 'abierto', auto: false, aprobados: 0 } }),
    ], con_maximas: true, dias: 3 }) })
    const filas = page.getByTestId('midia-falta')
    await expect(filas).toHaveCount(2)
    await expect(filas.nth(0)).toContainText('Pedido: 1/3 aprobados')
    await expect(filas.nth(0)).not.toContainText('otros centros')
    await expect(filas.nth(1)).toContainText('Pedido: 0/3 aprobados')
    await expect(page.getByTestId('midia-faltan')).not.toContainText('Pídelos')
  })

  test('nadie puede apuntarse: lo dice', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [falta(1, { pueden: 0 })], con_maximas: true, dias: 3 }) })
    await expect(page.getByTestId('midia-falta').first()).toContainText('nadie puede apuntarse')
  })

  test('sin máximas puestas no sale nada, aunque vinieran filas', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [falta(1)], con_maximas: false, dias: 3 }) })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
  })

  test('si el servidor contesta 400 (o no lo conoce), la pantalla carga igual que antes', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { faltas: json({ detail: 'Elige un centro: las máximas son por nave' }, 400) })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    await expect(page.getByText('Elige un centro: las máximas')).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('quien no ve Turnos no lo pide ni ve la tarjeta', async ({ page }) => {
    const pedidas = await abrir(page, {
      permisos: ['mi-dia', 'dashboard'],
      faltas: json({ faltas: [falta(1)], con_maximas: true, dias: 3 }),
    })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    expect(pedidas).toEqual([])
  })

  /* P18 (11-11-2026, revisión de la tanda 3): la tarjeta manda a pedir refuerzos, y en Turnos → Refuerzos la lista
     de días que no llegan solo la ve quien puede aprobar días. Quien ve Turnos sin «aprobar-dias» no la recibe. */
  test('quien ve Turnos pero no puede aprobar días no lo pide ni ve la tarjeta', async ({ page }) => {
    const pedidas = await abrir(page, {
      permisos: ['mi-dia', 'dashboard', 'turnos'],
      faltas: json({ faltas: [falta(1)], con_maximas: true, dias: 3 }),
    })
    await expect(page.getByText(/^Todo en orden/)).toBeVisible()
    await expect(page.getByTestId('midia-faltan')).toHaveCount(0)
    expect(pedidas).toEqual([])
  })

  test('con Turnos y «aprobar-dias» sí la ve (el control de la anterior)', async ({ page }) => {
    const pedidas = await abrir(page, {
      permisos: ['mi-dia', 'dashboard', 'turnos', 'aprobar-dias'],
      faltas: json({ faltas: [falta(1)], con_maximas: true, dias: 3 }),
    })
    await expect(page.getByTestId('midia-faltan')).toBeVisible()
    expect(pedidas.length).toBeGreaterThan(0)
  })

  /* P35: un refuerzo que abrieron los conductores al solicitar una vacante no lo «pidió» la oficina; se dice como en
     Turnos → Refuerzos. */
  test('un refuerzo abierto por los conductores no sale como «Pedido»', async ({ page }) => {
    await abrir(page, { faltas: json({ faltas: [
      falta(1, { refuerzo: { id: 'r1', plazas: 3, estado: 'abierto', auto: true, aprobados: 1 } }),
    ], con_maximas: true, dias: 3 }) })
    const fila = page.getByTestId('midia-falta').first()
    await expect(fila).toContainText('Solicitado por conductores: 1/3 aprobados')
    await expect(fila).not.toContainText('Pedido')
  })

  test('sin asignación de hoy dice «Falta la asignación de hoy», no «cuadrante»', async ({ page }) => {
    await abrir(page, { slots: [] })
    await expect(page.getByText('Falta la asignación de hoy').first()).toBeVisible()
    await expect(page.getByText(/Sin la asignación no se sabe quién sale/)).toBeVisible()
    await expect(page.getByText(/No hay cuadrante/)).toHaveCount(0)
    await expect(page.getByText(/^Todo en orden/)).toHaveCount(0)
  })
})

/* V12 (11-11-2026, tercera ronda): «Enviárselo a todos» y el envío a una persona en Configuración. Al usuario limitado
   a una nave el servidor solo le devuelve sus naves y, aparte, cuántas se mandaron y no tiene asignadas
   (`enviados_otras_naves`). La alerta lo dice en vez de «no se ha mandado nada». Sin ese campo (dueño, super-admin,
   o un servidor viejo), la alerta es la de siempre. */
test.describe('V12 · probar el resumen diario desde Configuración', () => {
  const ROSA = { id: 'a2', nombre: 'Rosa', email: 'rosa@empresa.es', centers: ['DGA1'], avisos: ['resumen_diario'], activo: true }
  const OGA5 = {
    center: 'OGA5', fecha: '03/11/2026', inspecciones: '3 de 4', checklist: '2/2', golpes: 'ninguno',
    incidencias: {}, danos: [], turnos: [], destinatarios: ['Judyt'], correos: ['judyt@empresa.es'], whatsapp: [],
  }

  async function probar(page, respuesta, boton) {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { centros: ['OGA5'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/avisos\/destinatarios(\?|$)/, json({ rows: [ROSA] }))
    let pedido = null
    await page.route(/\/api\/avisos\/enviar-resumen-diario/, (route) => {
      pedido = route.request().postDataJSON()
      return json(respuesta)(route)
    })
    const alertas = []
    page.on('dialog', (d) => { alertas.push(d.message()); d.accept() })
    await page.goto('/panel/configuracion', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Resumen diario por centro')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Rosa', { exact: true })).toBeVisible({ timeout: 30000 })
    await (boton === 'rosa'
      ? page.getByTitle('Enviarle el resumen ahora sólo a Rosa')
      : page.getByRole('button', { name: 'Enviárselo a todos' })).click()
    await expect.poll(() => alertas.length, { timeout: 15000 }).toBe(1)
    expect(fallos).toEqual([])
    return { alerta: alertas[0], pedido }
  }

  test('a todos, solo de naves que no tiene: «Enviado», no «no se ha mandado nada»', async ({ page }) => {
    const { alerta, pedido } = await probar(page, { enviados: [], enviados_otras_naves: 2 })
    expect(pedido).toEqual({})
    expect(alerta).toBe('Enviado. 2 centros que no tienes asignados no se muestran aquí.')
  })

  test('a una persona de otra nave: «Enviado a Rosa», no «no tiene ningún centro asignado»', async ({ page }) => {
    const { alerta, pedido } = await probar(page, { enviados: [], enviados_otras_naves: 1 }, 'rosa')
    expect(pedido).toEqual({ id: 'a2' })
    expect(alerta).toBe('Enviado a Rosa. 1 centro que no tienes asignado no se muestra aquí.')
  })

  test('con sus naves y otras: enseña las suyas y dice cuántas más se mandaron', async ({ page }) => {
    const { alerta } = await probar(page, { enviados: [OGA5], enviados_otras_naves: 1 })
    expect(alerta).toContain('OGA5 — 03/11/2026')
    expect(alerta).not.toContain('DGA1')
    expect(alerta.endsWith('\n\nEnviado también: 1 centro que no tienes asignado no se muestra aquí.')).toBe(true)
  })

  test('sin el campo nuevo (dueño, super-admin o servidor viejo): la alerta de siempre', async ({ page }) => {
    const vacia = await probar(page, { enviados: [] })
    expect(vacia.alerta).toBe('Nadie tiene centros asignados, así que no se ha mandado nada.')
  })

  test('sin el campo nuevo, a una persona: la alerta de siempre', async ({ page }) => {
    const { alerta } = await probar(page, { enviados: [] }, 'rosa')
    expect(alerta).toBe('Rosa no tiene ningún centro asignado, así que no hay nada que mandarle.')
  })

  test('sin el campo nuevo y con naves: la lista de siempre, sin la línea nueva', async ({ page }) => {
    const { alerta } = await probar(page, { enviados: [OGA5] })
    expect(alerta.startsWith('OGA5 — 03/11/2026\nRevisados: 3 de 4')).toBe(true)
    expect(alerta.endsWith('✉️ Correo enviado a: judyt@empresa.es')).toBe(true)
    expect(alerta).not.toContain('no tienes asignad')
  })
})
