import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

/* Tanda 2, zona «día» (11-11-2026): el móvil y la interfaz de Asignación, Furgonetas fijas, Plantilla,
   Aparcamiento y Checklist. API simulada; cada caso pone encima las rutas que necesita. Se lanza en los dos
   proyectos (escritorio y movil): lo que cambia con el ancho se mira con `isMobile`. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
// El reloj del navegador, parado (como en arreglos-dia): un 14 a mediodía, en el pasado.
const AHORA = new Date(2026, 9, 14, 12, 0, 0)
const HOY = iso(AHORA)

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

// Con varios centros y «Todos» elegido arriba (entrarComoAdmin deja elegido el primero).
async function entrarConTodos(page, centros = ['NORTE', 'SUR']) {
  await entrarComoAdmin(page, { centros })
  await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
}

/* ── D1 · Asignación en el móvil ── */
test.describe('Asignación · en el móvil, cada fila en dos líneas', () => {
  const VEHICULOS = Array.from({ length: 12 }, (_, i) => ({
    id: `v${i + 1}`, license_plate: `${1000 + i} ABC`, status: 'active', center: 'NORTE', itv_date: '2030-01-01' }))
  const NOMBRES = ['JOSÉ MANUEL PÉREZ CASTRO', 'MIGUEL ÁNGEL TORRES BLANCO', 'ANA LÓPEZ', 'LUIS GÓMEZ', 'SARA VIDAL',
    'PABLO MARTÍNEZ SOUTO', 'NURIA DÍAZ VARELA', 'IVÁN LORENZO PENA', 'LAURA SÁNCHEZ GIL', 'DAVID RODRÍGUEZ OTERO',
    'CRISTINA VÁZQUEZ REY', 'MARÍA FERNÁNDEZ RUIZ']
  const DRIVERS = NOMBRES.map((name, i) => ({ id: `d${i + 1}`, name, center: 'NORTE' }))
  const SLOTS = DRIVERS.map((d, i) => ({ vehicle_id: `v${i + 1}`, vehicle_plate: VEHICULOS[i].license_plate, driver_id: d.id, driver_name: d.name }))

  async function abrir(page) {
    await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/vehicles(\?|$)/, json(VEHICULOS))
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    await page.route(/\/api\/assignments\/daily/, json({ date: HOY, slots: SLOTS }))
    await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('asgn-fila')).toHaveCount(12, { timeout: 45000 })
  }

  test('el conductor se lee entero en el móvil y la fila de siempre en el ordenador', async ({ page, isMobile }) => {
    const fallos = vigilar(page)
    await abrir(page)
    const fila = page.getByTestId('asgn-fila').first()
    const matricula = fila.locator('select').first()
    const conductor = fila.locator('select').nth(1)
    await expect(conductor).toHaveValue('d1')
    const [cajaFila, cajaMat, cajaCond] = await Promise.all([fila.boundingBox(), matricula.boundingBox(), conductor.boundingBox()])
    const borrar = fila.getByRole('button', { name: 'Quitar fila' })
    const cabecera = page.getByText('Conductor asignado', { exact: true })
    if (isMobile) {
      // Debajo de la matrícula y casi a todo lo ancho (antes, un cuadradito de ~30 px).
      expect(cajaCond.y).toBeGreaterThanOrEqual(cajaMat.y + cajaMat.height)
      expect(cajaCond.width).toBeGreaterThan(cajaFila.width * 0.7)
      // El nombre más largo cabe en su desplegable.
      const cabe = await conductor.evaluate((el) => {
        const c = document.createElement('canvas').getContext('2d')
        c.font = getComputedStyle(el).font
        return c.measureText(el.options[el.selectedIndex].text).width < el.clientWidth - 24
      })
      expect(cabe).toBe(true)
      // Lo que se toca, de 44 px.
      for (const caja of [cajaMat, cajaCond, await borrar.boundingBox()]) expect(caja.height).toBeGreaterThanOrEqual(43.5)
      // Sin cabecera de columnas (no hay columnas) y sin deslizar de lado.
      await expect(cabecera).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    } else {
      // En el ordenador, todo en la misma línea, como antes, con su cabecera de columnas.
      expect(Math.abs(cajaCond.y + cajaCond.height / 2 - (cajaMat.y + cajaMat.height / 2))).toBeLessThan(6)
      expect(cajaCond.x).toBeGreaterThan(cajaMat.x + cajaMat.width)
      await expect(cabecera).toBeVisible()
    }
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el botón dice «Guardar asignación» y en el móvil queda abajo, a mano, encima de la barra', async ({ page, isMobile }) => {
    await abrir(page)
    await expect(page.getByText('Guardar cuadrante')).toHaveCount(0)
    const guardar = page.getByRole('button', { name: 'Guardar asignación' })
    await expect(guardar).toHaveCount(1)
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0)
    await expect(guardar).toBeVisible()
    const barra = page.getByTestId('asgn-guardar')
    if (isMobile) {
      await expect(barra).toBeVisible()
      // Sin bajar hasta el final de la lista: la barra está dentro de la pantalla y por encima de la navegación.
      const vista = page.viewportSize()
      const caja = await barra.boundingBox()
      const nav = await page.locator('nav.fixed').filter({ hasText: 'Menú' }).boundingBox()
      expect(caja.y).toBeGreaterThan(0)
      expect(caja.y + caja.height).toBeLessThanOrEqual(nav.y + 1)
      expect(caja.y + caja.height).toBeLessThanOrEqual(vista.height)
      expect((await guardar.boundingBox()).height).toBeGreaterThanOrEqual(43.5)
      // Y nada lo tapa en el centro (ni la burbuja del asistente ni la barra de abajo).
      expect(await guardar.evaluate((b) => {
        const r = b.getBoundingClientRect()
        const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return b === en || b.contains(en)
      })).toBe(true)
      // Con un cambio, la marca sale UNA vez y junto a Guardar.
      await page.getByRole('button', { name: 'Añadir fila' }).click()
      await expect(barra.getByText('Cambios sin guardar')).toBeVisible()
      await expect(page.getByText('Cambios sin guardar')).toHaveCount(1)
    } else {
      // En el ordenador, arriba como siempre, en la barra de botones.
      expect(await barra.evaluate((el) => getComputedStyle(el).position)).toBe('static')
      const [cajaG, cajaPegar] = await Promise.all([guardar.boundingBox(), page.getByRole('button', { name: 'Pegar roster' }).boundingBox()])
      expect(Math.abs(cajaG.y - cajaPegar.y)).toBeLessThan(6)
    }
  })
})

/* ── D4 · Con «Todos», un botón por centro ahí mismo ── */
test.describe('Elegir el centro ahí mismo', () => {
  test('Asignación: el título es «Asignación diaria» y un toque en SUR la abre', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarConTodos(page)
    await simularApi(page, 'vacio')
    await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toBeVisible({ timeout: 45000 })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asignación diaria')
    await expect(page.getByText(/Disponibles:/)).toHaveCount(0)
    await elegir.getByRole('button', { name: 'SUR' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SUR')
    await expect(elegir).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('Checklist: un toque en NORTE pide el de NORTE', async ({ page }) => {
    await entrarConTodos(page)
    await simularApi(page, 'vacio')
    const pedidos = []
    await page.route(/\/api\/checklist(\?|$)/, (route) => {
      pedidos.push(new URL(route.request().url()).searchParams.get('center'))
      return json({ manana: { id: 'm', center: 'NORTE', shift: 'manana', items: [{ id: 't1', text: 'Abrir nave', done: false }] } })(route)
    })
    await page.goto('/panel/checklist-operativo', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Elige el centro del que quieres ver el checklist.', { timeout: 45000 })
    await expect(page.getByText('Abrir nave')).toHaveCount(0)
    await elegir.getByRole('button', { name: 'NORTE' }).click()
    await expect(page.getByText('Abrir nave')).toBeVisible()
    await expect(elegir).toHaveCount(0)
    expect(pedidos).toContain('NORTE')
  })

  test('Aparcamiento: los centros como botones', async ({ page }) => {
    await entrarConTodos(page)
    await simularApi(page, 'vacio')
    await page.goto('/panel/aparcamiento', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Elige el centro del que quieres ver el plano.', { timeout: 45000 })
    await elegir.getByRole('button', { name: 'SUR' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SUR')
  })

  test('Plantilla: el historial y Furgonetas fijas piden el centro con botones', async ({ page }) => {
    await entrarConTodos(page)
    await simularApi(page, 'vacio')
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Historial de plantillas/ }).click({ timeout: 45000 })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toContainText('Elige el centro del que quieres ver el historial.')
    await expect(elegir.getByRole('button', { name: 'NORTE' })).toBeVisible()
    await page.getByRole('button', { name: 'Furgonetas fijas' }).click()
    await expect(elegir).toContainText('Las furgonetas fijas van por centro: elige uno.')
    await elegir.getByRole('button', { name: 'SUR' }).click()
    await expect(elegir).toHaveCount(0)
  })
})

/* ── D2 y D5 · Furgonetas fijas: «Furgonetas que no debe llevar» y los golpes bien contados ── */
test.describe('Furgonetas fijas · vetadas y golpes', () => {
  const AFINIDAD = {
    center: 'NORTE', cuidado_activo: false, cuidado_motivo: '',
    resumen: { conductores: 1, con_principal: 1, sin_auto: 0, operativas: 3, sugerencias: 0 },
    conductores: [
      { id: 'c1', nombre: 'Ana López', center: 'NORTE', dias_30: 12, ultima: '1234ABC',
        fija: { principal: 'v1', secundaria: null, titular: true, sin_auto: false, vetadas: [], responsabilidad: 8 },
        cuidado: { dias: 40, seguros: 0, posibles: 1 }, sugerencia: null },
    ],
    furgos: ['1234ABC', '5678DEF', '9012GHI'].map((matricula, i) => ({
      id: `v${i + 1}`, matricula, estado: 'active', bloqueada: false, operativa: true, trato: '', valor: 0.5, valor_por: '',
      danos_abiertos: 0, principal_de: i === 0 ? ['c1'] : [], secundaria_de: [], titular: i === 0 ? 'c1' : null })),
  }

  test('se aparta una furgoneta, se marca en su línea y se quita con un toque', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/afinidad\?/, json(AFINIDAD))
    const guardados = []
    await page.route(/\/api\/afinidad\/conductor\//, (route) => {
      guardados.push(route.request().postDataJSON())
      return json({ ok: true, fija: {} })(route)
    })
    await page.addInitScript(() => localStorage.setItem('plantilla.vista', JSON.stringify('fijas')))
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 45000 })
    // «0 golpes seguros · 1 posibles» → «1 golpe posible».
    await expect(page.getByText('1 golpe posible', { exact: true })).toBeVisible()
    await expect(page.getByText(/0 golpes/)).toHaveCount(0)

    await page.getByRole('button', { name: /Editar/ }).first().click()
    await expect(page.getByText('40 días conduciendo · 1 golpe posible')).toBeVisible()
    const vetar = page.getByLabel('Furgonetas que no debe llevar')
    // Su furgoneta no se ofrece para apartar.
    expect(await vetar.locator('option').allTextContents()).toEqual(['Elige una para apartarla…', '5678DEF', '9012GHI'])
    await vetar.selectOption('v3')
    await expect.poll(() => guardados.length).toBe(1)
    expect(guardados[0]).toEqual({ vetadas: ['v3'] })
    await expect(page.getByTestId('ff-marca-vetadas-c1')).toContainText('9012 GHI')
    // Ya no se ofrece como su furgoneta ni como la de reserva.
    expect((await page.locator('#ff-s-c1 option').allTextContents()).some((x) => x.includes('9012GHI'))).toBe(false)

    await page.getByRole('button', { name: 'Quitar 9012GHI de las que no debe llevar' }).click()
    await expect.poll(() => guardados.length).toBe(2)
    expect(guardados[1]).toEqual({ vetadas: [] })
    await expect(page.getByTestId('ff-marca-vetadas-c1')).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('los textos nuevos están en los seis idiomas', () => {
    for (const clave of ['ff.vetadas', 'ff.vetadasAnadir', 'ff.vetadasOtra', 'ff.vetadasQuitar', 'ff.vetadasAyuda', 'ff.noLleva',
      'ff.golpesSeg.one', 'ff.golpesSeg.many', 'ff.golpesPos.one', 'ff.golpesPos.many', 'ff.ed.dias.one', 'ff.ed.dias.many',
      'pk.vacioDia', 'pk.comoAyer', 'pk.comoAyerTip', 'pk.comoAyerOk.one', 'pk.comoAyerOk.many', 'pk.comoAyerParte',
      'pk.comoAyerNada', 'chk.pick.center', 'asgn.save']) {
      expect(Object.keys(DICT[clave]).sort(), clave).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt'])
    }
    expect(DICT['asgn.save'].es).toBe('Guardar asignación')
  })
})

/* ── D3 y D5 · Aparcamiento ── */
test.describe('Aparcamiento · «Como ayer», el texto y la leyenda', () => {
  const sitio = (code, x) => ({ code, x, y: 10, w: 20, h: 10, rot: 0 })
  const LAYOUT = { center: 'NORTE', name: 'NORTE', v: 3, zones: [
    { id: 'nave', name: 'Dentro de la nave', color: 'violet', ratio: 1, spots: [sitio('1', 5), sitio('2', 35), sitio('3', 65)] },
    { id: 'exterior', name: 'Exterior junto a la nave', color: 'sky', ratio: 1, spots: [sitio('4', 5)] },
    { id: 'tierra', name: 'Parking de tierra al fondo', color: 'emerald', ratio: 1, spots: [sitio('5', 5)] },
  ] }
  const VEHICULOS = ['v1', 'v2', 'v3', 'v4'].map((id, i) => ({ id, license_plate: `${1000 + i} ABC`, status: 'active', center: 'NORTE' }))

  async function abrir(page, asignadas) {
    await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/vehicles(\?|$)/, json(VEHICULOS))
    let estado = asignadas
    await page.route(/\/api\/parking\/state/, (route) => json({ layout: LAYOUT, day: HOY, assignments: estado })(route))
    const pedidos = { ultimas: [], asignar: [] }
    await page.route(/\/api\/parking\/last-known/, (route) => {
      pedidos.ultimas.push(Object.fromEntries(new URL(route.request().url()).searchParams))
      return json({ vehicles: [
        { vehicle_id: 'v1', spot: '2', day: '2026-10-13', center: 'NORTE' },   // ya está puesta hoy: no se mueve
        { vehicle_id: 'v2', spot: '1', day: '2026-10-13', center: 'NORTE' },   // su plaza la tiene hoy otra
        { vehicle_id: 'v3', spot: '3', day: '2026-10-13', center: 'NORTE' },   // esta sí
        { vehicle_id: 'v4', spot: '3', day: '2026-10-10', center: 'NORTE' },   // la misma plaza, de antes: gana v3
        { vehicle_id: 'v9', spot: '99', day: '2026-10-13', center: 'NORTE' },  // ni existe la plaza ni la furgoneta
      ] })(route)
    })
    await page.route(/\/api\/parking\/assign/, (route) => {
      const b = route.request().postDataJSON()
      pedidos.asignar.push(b)
      estado = [...estado, { vehicle_id: b.vehicle_id, spot: b.spot, status: 'asignada', center: 'NORTE', day: HOY }]
      return json({ ok: true })(route)
    })
    await page.goto('/panel/aparcamiento', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('NORTE', { timeout: 45000 })
    return pedidos
  }

  test('con el día vacío ya no promete que el conductor la marca desde el móvil', async ({ page }) => {
    await abrir(page, [])
    await expect(page.getByText(/Aún no hay ninguna furgoneta colocada este día/)).toBeVisible()
    await expect(page.getByText(/desde el móvil/)).toHaveCount(0)
  })

  test('«Como ayer» pone cada una en su última plaza sin mover ni pisar nada', async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await abrir(page, [{ vehicle_id: 'v1', spot: '1', status: 'asignada', center: 'NORTE', day: HOY }])
    const boton = page.getByRole('button', { name: 'Como ayer' })
    await expect(boton).toHaveCount(1)   // uno en cada tamaño: en la cabecera (móvil) o junto a «Sin plaza» (ordenador)
    await boton.click()
    await expect(page.getByText('1 furgoneta colocada en su última plaza')).toBeVisible()
    expect(pedidos.ultimas).toEqual([{ center: 'NORTE', incluir_asignadas: 'true', antes_de: HOY }])
    expect(pedidos.asignar).toEqual([{ center: 'NORTE', day: HOY, vehicle_id: 'v3', spot: '3' }])
    // Otra vez: ya no queda nada que repetir.
    await page.getByRole('button', { name: 'Como ayer' }).click()
    await expect(page.getByText(/No hay plazas de días anteriores que repetir/)).toBeVisible()
    expect(pedidos.asignar).toHaveLength(1)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la leyenda se ve (también en el móvil) y los nombres de zona caben', async ({ page, isMobile }) => {
    await abrir(page, [])
    const leyenda = page.getByTestId('pk-leyenda')
    await expect(leyenda).toBeVisible()
    for (const estado of ['Libre', 'Asignada', 'Confirmada', 'A revisar']) await expect(leyenda.getByText(estado)).toBeVisible()
    // Más contraste que el gris de antes (dark-500): el texto de la leyenda y el fondo de su barra se distinguen.
    const tamano = await leyenda.getByText('Libre').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(tamano).toBeGreaterThanOrEqual(11)
    if (isMobile) {
      for (const nombre of ['Dentro de la nave', 'Exterior junto a la nave', 'Parking de tierra al fondo']) {
        const cortado = await page.getByRole('button', { name: new RegExp(nombre) }).evaluate((b) => {
          const s = b.querySelector('span.truncate')
          return s ? s.scrollWidth > s.clientWidth : true
        })
        expect(cortado, nombre).toBe(false)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
})

/* ── D5 · Plantilla: el nombre y la ruta se leen enteros ── */
test('Plantilla · la ruta y el conductor se leen enteros, en el móvil y en el ordenador', async ({ page, isMobile }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const FILA = (ruta, conductor) => ({ ruta, conductor, movil: '641100000', furgo: '1234ABC', h_llegada: '08:40', h_bajada: '09:05',
    h_salida: '09:20', observaciones: '' })
  await page.route(/\/api\/tools\/plantilla-compartida/, json({ id: 'b1', revision: 1, updated_by: 'Admin Test',
    state: { week: '42', date: '14/10/2026', rows: [FILA('CX12', 'MIGUEL ÁNGEL TORRES BLANCO'), FILA('CX15', 'JOSÉ MANUEL PÉREZ CASTRO')] } }))
  await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
  const conductores = page.getByRole('textbox', { name: 'Conductor', exact: true })
  await expect(conductores).toHaveCount(2, { timeout: 45000 })
  const rutas = page.getByRole('textbox', { name: 'Ruta', exact: true })
  for (const campo of [conductores.nth(0), conductores.nth(1), rutas.nth(0)]) {
    const cortado = await campo.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(cortado, await campo.inputValue()).toBe(false)
  }
  if (isMobile) {
    // La tabla se desliza dentro de su caja; la página no.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // Al entrar, la ruta y el conductor están a la vista.
    const caja = await conductores.nth(0).boundingBox()
    expect(caja.x + caja.width).toBeLessThanOrEqual(page.viewportSize().width)
  }
})
