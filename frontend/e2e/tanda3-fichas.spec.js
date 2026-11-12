/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 3, ZONA «FICHAS» (11-11-2026), con la API simulada. Lo nuevo de la ficha del conductor y de su lista:
   · horas_dnr-10: el texto de ayuda del ID de reparto (con él, cada conductor ve sus DNR).
   · equipo-8: el historial de centro en la ficha y el aviso al cambiar la nave desde «Editar».
   · equipo-6: la lista «Bajas», reactivar (y sus 409), «Dar de baja» y la importación que dice quién estaba de baja.
   · historia-10: la caducidad del carnet en la ficha y la pestaña «Carnets» de Vencimientos.
   · equipo-5: la versión de la app de cada uno (columna, tarjeta, filtro «sin app» y ficha).
   · equipo-11: de Incorporaciones a ficha de conductor.
   Con un servidor viejo (sin las rutas o los campos nuevos) cada pantalla se queda como hoy: hay una prueba de cada. */

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js|status of 4\d\d/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/* Contesta los window.alert/confirm en orden con lo que se le diga y apunta lo que dicen. */
function dialogos(page, lista = []) {
  const vistos = []
  const cola = [...lista]
  page.on('dialog', async (d) => {
    vistos.push(d.message())
    if (d.type() === 'alert' || (cola.length ? cola.shift() : false)) await d.accept()
    else await d.dismiss()
  })
  return vistos
}

const iso = (n) => {
  const d = new Date(Date.UTC(2026, 0, 10 + n))
  return d.toISOString().slice(0, 10)
}
const HISTORIAL = Array.from({ length: 7 }, (_, i) => ({
  de: `C${i}`, a: `C${i + 1}`, desde: iso(i), aplicado_en: `${iso(i)}T08:00:00Z`,
  programado_por: i % 2 ? 'Fran' : 'María', ...(i % 2 ? {} : { como: 'ficha' }),
}))
const ANTONIO = { id: 'd1', name: 'ANTONIO GARCÍA', center: 'NORTE', active: true, email: 'antonio@ejemplo.es',
  transporter_id: 'AAAAA11111BB', historial_centros: HISTORIAL }

/* El panel de Conductores con la API simulada. `antes`: más rutas, puestas DESPUÉS de la simulada (si no, la de «todo»
   las tapa) y ANTES de entrar, sin recargar. La primera espera es larga: con cinco a la vez, el PC va cargado. */
async function panel(page, { lista = [ANTONIO], centros = ['NORTE', 'SUR'], antes } = {}) {
  await entrarComoAdmin(page, { centros })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, json(lista))
  if (antes) await antes()
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  if (lista.length) await expect(page.getByText(lista[0].name).first()).toBeVisible({ timeout: 45000 })
}

const abrirFicha = async (page, nombre) => {
  await page.getByText(nombre, { exact: true }).first().click()
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible()
}

test.describe('horas_dnr-10 · el ID de reparto en la ficha', () => {
  test('la ayuda dice que con él cada conductor ve sus informes en el portal', async ({ page }) => {
    await panel(page)
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await page.getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByText('El de los informes diarios. Con él, cada conductor ve en su portal los informes que le tocan: comprueba que es el suyo.')).toBeVisible()
    await expect(page.getByText('El de los informes diarios y las horas.')).toHaveCount(0)
  })
})

test.describe('equipo-8 · el historial de centro', () => {
  test('la ficha enseña las cinco últimas, lo más nuevo primero, y «Ver más»', async ({ page }) => {
    const fallos = vigilar(page)
    await panel(page)
    await abrirFicha(page, 'ANTONIO GARCÍA')
    const caja = page.getByTestId('historial-centros')
    await expect(caja.getByText('Historial de centro')).toBeVisible()
    const filas = caja.locator('li')
    await expect(filas).toHaveCount(5)
    await expect(filas.first()).toContainText('C6 → C7')
    await expect(filas.first()).toContainText('cambiado en la ficha por María')
    await expect(filas.nth(1)).toContainText('C5 → C6')
    await expect(filas.nth(1)).toContainText('programado por Fran')
    await caja.getByRole('button', { name: 'Ver más (2)' }).click()
    await expect(filas).toHaveCount(7)
    await expect(filas.last()).toContainText('C0 → C1')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin historial (o con un servidor viejo) no sale nada', async ({ page }) => {
    await panel(page, { lista: [{ ...ANTONIO, historial_centros: undefined }] })
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await expect(page.getByText('Cambio de centro')).toBeVisible()
    await expect(page.getByTestId('historial-centros')).toHaveCount(0)
  })

  test('al cambiar la nave en «Editar» avisa de que se apunta, y de un cambio programado a otra', async ({ page }) => {
    const fallos = vigilar(page)
    const enviados = []
    await panel(page, { lista: [{ ...ANTONIO, traslado: { centro: 'ESTE', desde: '2026-12-01' } }], centros: ['NORTE', 'SUR', 'ESTE'] })
    await page.route(/\/api\/drivers\/d1$/, (route) => {
      enviados.push(route.request().postDataJSON())
      return json({ success: true, centro_cambiado: { de: 'NORTE', a: 'SUR' }, traslado_pendiente: { centro: 'ESTE', desde: '2026-12-01' } })(route)
    })
    const vistos = dialogos(page)
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await page.getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByTestId('aviso-cambio-centro')).toHaveCount(0)
    const centro = page.locator('#driver-form select').first()
    await centro.selectOption('SUR')
    await expect(page.getByTestId('aviso-cambio-centro')).toContainText('Se apunta en su historial de centros')
    await centro.selectOption('NORTE')
    await expect(page.getByTestId('aviso-cambio-centro')).toHaveCount(0)
    await centro.selectOption('SUR')
    await page.locator('button[type="submit"][form="driver-form"]').click()
    await expect.poll(() => vistos.length).toBe(1)
    expect(vistos[0]).toContain('tenía programado pasar a ESTE el 01/12/2026')
    expect(enviados[0].center).toBe('SUR')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('una ficha nueva o sin centro no dice nada de historial al elegir nave', async ({ page }) => {
    await panel(page, { lista: [{ ...ANTONIO, center: '' }] })
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await page.getByRole('button', { name: 'Editar' }).click()
    await page.locator('#driver-form select').first().selectOption('SUR')
    await expect(page.getByTestId('aviso-cambio-centro')).toHaveCount(0)
  })
})

/* ── equipo-6 · las bajas: verlas, reactivarlas, «Dar de baja» y la importación ── */
const BAJAS = [
  { id: 'd-juan', name: 'JUAN REY', center: 'NORTE', email: 'juan@ejemplo.es', phone: '600222333',
    transporter_id: null, baja_en: '2026-11-05T12:00:00+00:00', baja_por: 'Dani', desactivada_por: null },
  { id: 'd-lola', name: 'LOLA HOJA', center: 'NORTE', email: null, phone: null, transporter_id: null,
    baja_en: '2026-11-08T12:00:00+00:00', baja_por: null, desactivada_por: 'hoja' },
]

async function conBajas(page, { bajas = BAJAS, reactivar } = {}) {
  const llamadas = []
  await panel(page, { antes: async () => {
    await page.route(/\/api\/drivers\/bajas/, json(bajas))
    await page.route(/\/api\/drivers\/[^/]+\/reactivar/, (route) => {
      const body = route.request().postDataJSON()
      llamadas.push({ url: new URL(route.request().url()).pathname, body })
      return reactivar ? reactivar(route, body) : json({ ok: true, driver: { id: 'd-juan', active: true } })(route)
    })
  } })
  return llamadas
}

test.describe('equipo-6 · la lista «Bajas» y reactivar', () => {
  test('el chip «Bajas (2)» enseña las bajas con su fecha y la ficha solo se puede reactivar', async ({ page }) => {
    const fallos = vigilar(page)
    const llamadas = await conBajas(page)
    await expect(page.getByText('ANTONIO GARCÍA').first()).toBeVisible()
    const chip = page.getByRole('button', { name: 'Bajas (2)' })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('aviso-bajas')).toBeVisible()
    await expect(page.getByText('ANTONIO GARCÍA')).toHaveCount(0)
    await expect(page.getByTestId('baja-desde').filter({ hasText: 'de baja desde 05/11/2026' })).toBeVisible()
    await expect(page.getByTestId('baja-desde').filter({ hasText: 'la sacó la hoja de Google' })).toBeVisible()
    // De una baja no se dice lo que le falta (LOLA no tiene correo): ni en la tarjeta ni en los filtros.
    await expect(page.getByText('sin correo', { exact: true })).toHaveCount(0)
    await abrirFicha(page, 'JUAN REY')
    await expect(page.getByTestId('ficha-de-baja')).toContainText('de baja desde 05/11/2026 (por Dani)')
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dar de baja' })).toHaveCount(0)
    await expect(page.getByText('Correo personal de acceso')).toHaveCount(0)
    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'JUAN REY vuelve a estar activo' })).toBeVisible()
    expect(llamadas).toEqual([{ url: '/api/drivers/d-juan/reactivar', body: {} }])
    // Y volver a las activas.
    await page.getByRole('button', { name: /^Bajas \(\d\)$/ }).click()
    await expect(page.getByText('ANTONIO GARCÍA').first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con el ID de reparto en otra ficha pregunta y reactiva sin él', async ({ page }) => {
    const llamadas = await conBajas(page, {
      reactivar: (route, body) => (body.quitar_id
        ? json({ ok: true, driver: { id: 'd-juan', active: true } })(route)
        : json({ detail: { mensaje: 'ANTONIO GARCÍA ya tiene ficha (ID de reparto AAAAA11111BB), centro NORTE.', abrir_id: 'd1',
          conflicto: 'id_reparto', transporter_id: 'AAAAA11111BB' } }, 409)(route)),
    })
    const vistos = dialogos(page, [true])
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    await abrirFicha(page, 'JUAN REY')
    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'JUAN REY vuelve a estar activo' })).toBeVisible()
    expect(vistos[0]).toContain('SIN ese ID de reparto')
    expect(llamadas.map((l) => l.body)).toEqual([{}, { quitar_id: true }])
  })

  test('con el correo en otra ficha activa no reactiva y ofrece abrirla', async ({ page }) => {
    const llamadas = await conBajas(page, {
      reactivar: json({ detail: { mensaje: 'ANTONIO GARCÍA ya tiene ficha (correo juan@ejemplo.es), centro NORTE.', abrir_id: 'd1',
        conflicto: 'correo' } }, 409),
    })
    const vistos = dialogos(page, [true])
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    await abrirFicha(page, 'JUAN REY')
    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByRole('heading', { name: 'ANTONIO GARCÍA' })).toBeVisible()
    expect(vistos[0]).toContain('No se reactiva')
    expect(llamadas).toHaveLength(1)
  })

  test('con un servidor viejo (sin /drivers/bajas) la lista sigue como hoy, sin chip', async ({ page }) => {
    const fallos = vigilar(page)
    await panel(page, { antes: () => page.route(/\/api\/drivers\/bajas/, json({ detail: 'Method Not Allowed' }, 405)) })
    await expect(page.getByRole('button', { name: /^Bajas/ })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el botón dice «Dar de baja» y la pregunta dice lo que pasa', async ({ page }) => {
    const borrados = []
    await panel(page)
    await page.route(/\/api\/drivers\/d1$/, (route) => {
      borrados.push(route.request().method())
      return json({ success: true })(route)
    })
    const vistos = dialogos(page, [false, true])
    await abrirFicha(page, 'ANTONIO GARCÍA')
    const boton = page.getByRole('button', { name: 'Dar de baja' })
    await boton.click()
    await expect.poll(() => vistos.length).toBe(1)
    expect(vistos[0]).toContain('¿Dar de baja a ANTONIO GARCÍA?')
    expect(vistos[0]).toContain('se puede reactivar desde «Bajas»')
    expect(borrados).toEqual([])
    await boton.click()
    await expect.poll(() => borrados).toEqual(['DELETE'])
  })
})

test.describe('equipo-6 · importar dice quién estaba de baja', () => {
  test('la vista previa y el resultado separan «estaban de baja»', async ({ page }) => {
    const grupo = { clave: '', sugerido: '', conocido: false, filas: 3, nuevas: 1, ya_estan: 2, ejemplo: 'JUAN REY' }
    await panel(page, { centros: ['NORTE'] })
    await page.route(/\/api\/drivers\/importar\/previsualizar/, json({
      columnas_reconocidas: { 0: 'name' }, cabecera: ['Nombre'], fila_cabecera: 1, total_leidas: 3, nuevas: 1,
      ya_estaban: 2, de_baja: 1, nombres_de_baja: ['JUAN REY'], saltadas: [], n_saltadas: 0, sin_correo: 3,
      centros: [grupo], centros_empresa: ['NORTE'], centro_por_defecto: 'NORTE',
      muestra: [
        { name: 'JUAN REY', fila: 2, centro_texto: '', ya_existe: true, de_baja: true },
        { name: 'ANTONIO GARCÍA', fila: 3, centro_texto: '', ya_existe: true, de_baja: false },
        { name: 'EVA NUEVA', fila: 4, centro_texto: '', ya_existe: false, de_baja: false },
      ],
    }))
    await page.route(/\/api\/drivers\/importar$/, json({ importados: 1, ya_estaban: 2, con_acceso: 0, no_leidas: 0,
      fuera_seleccion: 0, nombres: ['EVA NUEVA'], de_baja: 1, nombres_de_baja: ['JUAN REY'] }))
    const importar = page.getByRole('button', { name: 'Importar Excel' })
    if (await importar.first().isVisible()) await importar.first().click()
    else {
      await page.getByRole('button', { name: 'Más' }).click()
      await page.getByRole('menuitem', { name: 'Importar Excel' }).click()
    }
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'plantilla.csv', mimeType: 'text/csv', buffer: Buffer.from('Nombre\nJUAN REY\n') })
    await expect(page.getByTestId('importar-de-baja')).toContainText('1 estaba de baja: JUAN REY.')
    await expect(page.getByTestId('importar-de-baja')).toContainText('reactívalo desde «Bajas»')
    await expect(page.getByText('estaba de baja', { exact: true })).toBeVisible()
    await expect(page.getByText('ya estaba', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Dar de alta 1' }).click()
    await expect(page.getByText('1 conductor dado de alta')).toBeVisible()
    await expect(page.getByTestId('importar-de-baja')).toContainText('1 estaba de baja: JUAN REY.')
  })
})

/* ── historia-10 · la caducidad del carnet ── */
// El reloj del NAVEGADOR, fijo (no el de Node): un mediodía de aquí, lejos de la medianoche.
const AHORA = new Date(2026, 5, 15, 12, 0, 0)
const CARNETS = [
  { id: 'c1', name: 'ANA CADUCADA', center: 'NORTE', active: true, license_expiry: '2026-06-05' },
  { id: 'c2', name: 'BEA PRONTO', center: 'NORTE', active: true, license_expiry: '2026-06-25' },
  { id: 'c3', name: 'CARLOS LEJOS', center: 'NORTE', active: true, license_expiry: '2027-01-01' },
  { id: 'c4', name: 'DANI SIN FECHA', center: 'NORTE', active: true, license_expiry: null },
  { id: 'c5', name: 'EVA HOY', center: 'NORTE', active: true, license_expiry: '2026-06-15' },
]

test.describe('historia-10 · la caducidad del carnet', () => {
  test('la ficha la enseña en rojo si caducó y en ámbar si caduca pronto; lejos, sin aviso', async ({ page }) => {
    await page.clock.setFixedTime(AHORA)
    await panel(page, { lista: CARNETS })
    await abrirFicha(page, 'ANA CADUCADA')
    const caja = page.getByTestId('carnet-caduca')
    await expect(caja).toContainText('05/06/2026')
    await expect(caja).toContainText('caducó hace 10 días')
    await expect(caja.locator('.text-red-300')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await abrirFicha(page, 'BEA PRONTO')
    await expect(page.getByTestId('carnet-caduca')).toContainText('caduca en 10 días')
    await expect(page.getByTestId('carnet-caduca').locator('.text-amber-300')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await abrirFicha(page, 'CARLOS LEJOS')
    await expect(page.getByTestId('carnet-caduca')).toContainText('01/01/2027')
    await expect(page.getByTestId('carnet-caduca')).not.toContainText(/caduca (en|hoy)|caducó/)
    await page.keyboard.press('Escape')
    await abrirFicha(page, 'DANI SIN FECHA')
    await expect(page.getByTestId('carnet-caduca')).toHaveCount(0)
  })

  test('se pone en «Editar» y se manda en el guardado', async ({ page }) => {
    const enviados = []
    await panel(page, { lista: CARNETS })
    await page.route(/\/api\/drivers\/c4$/, (route) => {
      enviados.push(route.request().postDataJSON())
      return json({ success: true })(route)
    })
    await abrirFicha(page, 'DANI SIN FECHA')
    await page.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Carnet caduca el').fill('2027-03-01')
    await page.locator('button[type="submit"][form="driver-form"]').click()
    await expect.poll(() => enviados.length).toBe(1)
    expect(enviados[0].license_expiry).toBe('2027-03-01')
  })

  test('Vencimientos → Carnets: las caducadas y las de 30 días, por fecha, y cuántas no tienen fecha', async ({ page }) => {
    const fallos = vigilar(page)
    await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page, { centros: ['NORTE'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, json(CARNETS))
    await page.goto('/panel/vencimientos', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Carnets' }).click()
    const filas = page.getByTestId('carnet-fila')
    await expect(filas).toHaveCount(3)
    await expect(filas.nth(0)).toContainText('ANA CADUCADA')
    await expect(filas.nth(0)).toContainText('caducó hace 10 días')
    await expect(filas.nth(1)).toContainText('EVA HOY')
    await expect(filas.nth(1)).toContainText('caduca hoy')
    await expect(filas.nth(2)).toContainText('BEA PRONTO')
    await expect(filas.nth(2)).toContainText('caduca en 10 días')
    await expect(page.getByText('1 ficha sin fecha de caducidad del carnet')).toBeVisible()
    await expect(filas.nth(0).getByRole('link')).toHaveAttribute('href', '/panel/conductores?open=c1')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('Carnets sin ninguna fecha puesta lo dice', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, json([CARNETS[3]]))
    await page.goto('/panel/vencimientos', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Carnets' }).click()
    await expect(page.getByText('Todavía no hay ninguna fecha de caducidad de carnet puesta.')).toBeVisible()
  })
})

/* ── equipo-5 · quién tiene la app de Android ── */
const TRES = [
  { id: 'a1', name: 'ANA VIEJA', center: 'NORTE', active: true, email: 'ana@ejemplo.es' },
  { id: 'a2', name: 'BEA AL DÍA', center: 'NORTE', active: true, email: 'bea@ejemplo.es' },
  { id: 'a3', name: 'CARLOS SIN APP', center: 'NORTE', active: true, email: 'carlos@ejemplo.es' },
]
const APP = {
  conductores: {
    a1: { app: '2.4.3', plataforma: 'android', visto: new Date(2026, 5, 6, 10, 0).toISOString() },
    a2: { app: '2.4.10', plataforma: 'android', visto: new Date(2026, 5, 15, 9, 30).toISOString() },
  },
  ultima: '2.4.10',
}

async function conApp(page, app = APP) {
  // Con el reloj fijo, el panel tarda más en pintar la primera vez: la primera espera, más larga.
  await page.clock.setFixedTime(AHORA)
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, json(TRES))
  await page.route(/\/api\/drivers\/app/, typeof app === 'function' ? app : json(app))
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ANA VIEJA').first()).toBeVisible({ timeout: 45000 })
}

const estrecho = (page) => (page.viewportSize()?.width || 1000) < 640

test.describe('equipo-5 · la app de cada conductor', () => {
  test('versión y día en la lista (ámbar si hay una más nueva) y el filtro «sin app»', async ({ page }) => {
    const fallos = vigilar(page)
    await conApp(page)
    if (estrecho(page)) {
      await expect(page.getByTestId('tarjeta-app-vieja')).toHaveCount(1)
      await expect(page.getByTestId('tarjeta-app-vieja')).toHaveText('app 2.4.3')
      await expect(page.locator('li', { hasText: 'CARLOS SIN APP' }).getByText('sin app', { exact: true })).toBeVisible()
      await expect(page.locator('li', { hasText: 'BEA AL DÍA' }).getByText('sin app', { exact: true })).toHaveCount(0)
    } else {
      await expect(page.getByRole('columnheader', { name: 'App' })).toBeVisible()
      const celdas = page.getByTestId('celda-app')
      await expect(page.locator('tr', { hasText: 'ANA VIEJA' }).getByTestId('celda-app')).toHaveText('2.4.3 · hace 9 días')
      await expect(page.locator('tr', { hasText: 'ANA VIEJA' }).getByTestId('celda-app')).toHaveClass(/text-amber-300/)
      await expect(page.locator('tr', { hasText: 'BEA AL DÍA' }).getByTestId('celda-app')).toHaveText('2.4.10 · hoy')
      await expect(page.locator('tr', { hasText: 'BEA AL DÍA' }).getByTestId('celda-app')).not.toHaveClass(/text-amber-300/)
      await expect(celdas).toHaveCount(2)
    }
    const chip = page.getByRole('button', { name: 'sin app (1)' })
    await chip.click()
    await expect(page.getByTestId('ayuda-sin-app')).toContainText('quien solo usa la web o el iPhone')
    await expect(page.getByText('ANA VIEJA')).toHaveCount(0)
    await expect(page.getByText('CARLOS SIN APP').first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la ficha dice la versión y el día en que la abrió, o que no la tiene', async ({ page }) => {
    await conApp(page)
    await abrirFicha(page, 'BEA AL DÍA')
    await expect(page.getByTestId('linea-app')).toContainText('2.4.10 · abierta el 15/06/2026')
    await expect(page.getByTestId('linea-app')).not.toContainText('9:30')
    await page.keyboard.press('Escape')
    await abrirFicha(page, 'ANA VIEJA')
    await expect(page.getByTestId('linea-app')).toContainText('hay una más nueva (2.4.10)')
    await page.keyboard.press('Escape')
    await abrirFicha(page, 'CARLOS SIN APP')
    await expect(page.getByTestId('linea-app')).toContainText('No tiene la app abierta en ningún Android')
  })

  test('con un servidor viejo (sin /drivers/app) ni columna, ni filtro, ni línea en la ficha', async ({ page }) => {
    const fallos = vigilar(page)
    await conApp(page, json({ detail: 'Not Found' }, 404))
    await expect(page.getByRole('columnheader', { name: 'App' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /sin app/ })).toHaveCount(0)
    await expect(page.getByText('sin app', { exact: true })).toHaveCount(0)
    await abrirFicha(page, 'ANA VIEJA')
    await expect(page.getByTestId('linea-app')).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('una respuesta con otra forma (la lista de conductores) tampoco la enseña', async ({ page }) => {
    await conApp(page, json(TRES))
    await expect(page.getByRole('button', { name: /sin app/ })).toHaveCount(0)
  })
})

/* ── equipo-11 · de Incorporaciones a ficha de conductor ── */
const PLANTILLA_ONB = { motivos: { carnet: { titulo: 'Foto del carnet de conducir', texto: 'x' } } }
const PERSONAS_ONB = [
  { id: 'p1', nombre: 'ANA CON FICHA', telefono: '600000001', centro: 'NORTE', columna: 'pendiente', fase: 'por_pedir',
    dni: '12345678Z', ficha: { id: 'd9', nombre: 'ANA CON FICHA', centro: 'NORTE', por: 'dni' } },
  { id: 'p2', nombre: 'LUIS NUEVO', telefono: '600000002', centro: 'NORTE', columna: 'pendiente', fase: 'por_pedir',
    dni: '11111111H', email: 'cuenta.ett@ett.test', ficha: null },
  { id: 'p3', nombre: 'TOMÁS TELÉFONO', telefono: '600000003', centro: 'NORTE', columna: 'pendiente', fase: 'por_pedir',
    ficha: { id: 'd8', nombre: 'TOMÁS EMPRESA', centro: 'NORTE', por: 'telefono' } },
  { id: 'p4', nombre: 'EVA SIN NAVE', telefono: '600000004', centro: '', columna: 'pendiente', fase: 'por_pedir', ficha: null },
]

async function incorporaciones(page, { personas = PERSONAS_ONB, ficha, reactivar, todos = false } = {}) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  if (todos) await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
  await simularApi(page, 'vacio')
  const llamadas = []
  await page.route(/\/api\/incorporaciones\/personas(\?|$)/, (route) => route.fulfill({ json: {
    personas: personas.map((p) => ({ ...p })), plantilla: PLANTILLA_ONB, estados: ['falta', 'pedido', 'revision', 'ok'],
    estado_nombre: { falta: 'Falta', pedido: 'Se lo he pedido', revision: 'En revision', ok: 'Correcto' } } }))
  await page.route(/\/api\/incorporaciones\/personas\/[^/]+\/ficha-conductor/, (route) => {
    const body = route.request().postDataJSON()
    llamadas.push({ url: new URL(route.request().url()).pathname, body })
    return ficha ? ficha(route, body, llamadas.length)
      : json({ ya_tenia: false, ficha: { id: 'd-nueva', name: 'LUIS NUEVO', center: body.centro || '' } })(route)
  })
  await page.route(/\/api\/drivers\/[^/]+\/reactivar/, (route) => {
    const body = route.request().postDataJSON()
    llamadas.push({ url: new URL(route.request().url()).pathname, body })
    return reactivar ? reactivar(route, body) : json({ ok: true, driver: { id: 'd-juan', active: true } })(route)
  })
  await page.goto('/panel/incorporaciones', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('LUIS NUEVO')).toBeVisible({ timeout: 45000 })
  return llamadas
}

const abrirPersona = (page, nombre) => page.getByRole('button', { name: new RegExp(nombre) }).first().click()

test.describe('equipo-11 · de Incorporaciones a ficha de conductor', () => {
  test('quien ya tiene ficha lo dice, en la fila y dentro, con «Abrir»', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page)
    const fila = page.locator('.card', { hasText: 'ANA CON FICHA' })
    await expect(fila.getByTestId('con-ficha')).toHaveText('con ficha')
    await expect(page.getByTestId('con-ficha')).toHaveCount(1)          // por teléfono no se marca
    await abrirPersona(page, 'ANA CON FICHA')
    await expect(fila.getByTestId('ya-tiene-ficha')).toContainText('Ya tiene ficha de conductor (NORTE)')
    await expect(fila.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/panel/conductores?open=d9')
    await expect(fila.getByRole('button', { name: 'Dar de alta como conductor' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('«Dar de alta como conductor» enseña lo que se guarda y el correo va sin marcar', async ({ page }) => {
    const fallos = vigilar(page)
    const llamadas = await incorporaciones(page)
    const fila = page.locator('.card', { hasText: 'LUIS NUEVO' })
    await abrirPersona(page, 'LUIS NUEVO')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    const caja = fila.getByTestId('alta-conductor')
    await expect(caja).toContainText('Nombre: LUIS NUEVO')
    await expect(caja).toContainText('Teléfono: 600000002')
    await expect(caja).toContainText('DNI: 11111111H')
    await expect(caja).toContainText('Centro: NORTE')
    await expect(caja.getByRole('checkbox')).not.toBeChecked()
    await caja.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect(fila.getByTestId('ficha-creada')).toContainText('Ficha de conductor lista (NORTE)')
    expect(llamadas).toEqual([{ url: '/api/incorporaciones/personas/p2/ficha-conductor', body: { usar_correo: false, centro: 'NORTE' } }])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con la casilla, manda usar_correo; y el 409 de reactivar reactiva y enlaza', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      ficha: (route, body, n) => (n === 1
        ? json({ detail: { mensaje: 'LUIS NUEVO ya tiene una ficha dada de baja con este correo. Reactivala para conservar su historial.',
          reactivar_id: 'd-juan', nombre: 'LUIS NUEVO' } }, 409)(route)
        : json({ ya_tenia: true, ficha: { id: 'd-juan', name: 'LUIS NUEVO', center: 'NORTE' }, por: 'correo' })(route)),
    })
    const vistos = dialogos(page, [true])
    const fila = page.locator('.card', { hasText: 'LUIS NUEVO' })
    await abrirPersona(page, 'LUIS NUEVO')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('checkbox').check()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect(fila.getByTestId('ficha-creada')).toBeVisible()
    expect(vistos[0]).toContain('Aceptar: reactivar su ficha')
    expect(llamadas.map((l) => l.url)).toEqual(['/api/incorporaciones/personas/p2/ficha-conductor',
      '/api/drivers/d-juan/reactivar', '/api/incorporaciones/personas/p2/ficha-conductor'])
    expect(llamadas[0].body.usar_correo).toBe(true)
  })

  test('Cancelar en las dos preguntas no crea ni reactiva nada', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      ficha: json({ detail: { mensaje: 'Ya tiene una ficha dada de baja con este correo.', reactivar_id: 'd-juan' } }, 409),
    })
    const vistos = dialogos(page, [false, false])
    const fila = page.locator('.card', { hasText: 'LUIS NUEVO' })
    await abrirPersona(page, 'LUIS NUEVO')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect.poll(() => vistos.length).toBe(2)
    // Sin la casilla del correo no se le quita nada a la de baja: la pregunta no lo dice (segunda revisión, F2).
    expect(vistos[1]).toContain('¿Es OTRA persona?')
    expect(vistos[1]).not.toContain('dejará de entrar')
    expect(llamadas).toHaveLength(1)
    await expect(fila.getByTestId('ficha-creada')).toHaveCount(0)
  })

  test('el 409 de «ya tiene ficha» lleva a abrirla en Conductores', async ({ page }) => {
    await incorporaciones(page, {
      ficha: json({ detail: { mensaje: 'LUIS NUEVO ya tiene ficha (ID de reparto A1), centro SUR.', abrir_id: 'd7' } }, 409),
    })
    dialogos(page, [true])
    const fila = page.locator('.card', { hasText: 'LUIS NUEVO' })
    await abrirPersona(page, 'LUIS NUEVO')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect(page).toHaveURL(/\/panel\/conductores/)
  })

  test('por teléfono solo avisa y deja dar de alta; sin centro y con dos, hay que elegirlo', async ({ page }) => {
    const llamadas = await incorporaciones(page, { todos: true })
    const tel = page.locator('.card', { hasText: 'TOMÁS TELÉFONO' })
    await abrirPersona(page, 'TOMÁS TELÉFONO')
    await expect(tel.getByTestId('quiza-ficha')).toContainText('Puede ser la ficha de TOMÁS EMPRESA (NORTE): tiene el mismo teléfono.')
    await expect(tel.getByRole('button', { name: 'Dar de alta como conductor' })).toBeVisible()
    await abrirPersona(page, 'EVA SIN NAVE')
    const eva = page.locator('.card', { hasText: 'EVA SIN NAVE' })
    await eva.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    const crear = eva.getByRole('button', { name: 'Crear la ficha' })
    await expect(crear).toBeDisabled()
    await eva.getByLabel('Centro de la ficha').selectOption('SUR')
    await crear.click()
    await expect(eva.getByTestId('ficha-creada')).toContainText('(SUR)')
    expect(llamadas[0].body).toEqual({ usar_correo: false, centro: 'SUR' })
  })

  test('con un servidor viejo (sin `ficha`) la persona se ve como hoy, sin botón', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page, { personas: PERSONAS_ONB.map(({ ficha: _f, ...p }) => p) })
    await abrirPersona(page, 'LUIS NUEVO')
    await expect(page.getByText('Ya está dentro')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dar de alta como conductor' })).toHaveCount(0)
    await expect(page.getByTestId('con-ficha')).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* ── SEGUNDA REVISIÓN (11-11-2026): F2, F5/F6, F9, F10 y F12 ── */
const CON_BAJA = { id: 'p5', nombre: 'ROSA VUELVE', telefono: '600000005', centro: 'NORTE', columna: 'pendiente',
  fase: 'por_pedir', dni: '22222222J', ficha: { id: 'd-rosa', nombre: 'ROSA VUELVE', centro: 'SUR', por: 'dni', baja: true } }
const OTRA_NAVE = { id: 'p6', nombre: 'PEPE OTRA NAVE', telefono: '600000006', centro: 'NORTE', columna: 'pendiente',
  fase: 'por_pedir', ficha: { por: 'dni', centro: 'SUR' } }
const REACTIVAR_409 = (route, body, n) => (n === 1
  ? json({ detail: { mensaje: 'ROSA VUELVE ya tiene una ficha dada de baja (mismo DNI). Reactívala para conservar su historial.',
    reactivar_id: 'd-rosa', nombre: 'ROSA VUELVE' } }, 409)(route)
  : json({ ya_tenia: true, ficha: { id: 'd-rosa', name: 'ROSA VUELVE', center: 'NORTE' }, por: 'dni' })(route))

test.describe('F2 y F10 · Incorporaciones dice las fichas de baja y no enseña las de otra nave', () => {
  test('una ficha de baja se dice como tal (no «con ficha») y deja darle de alta', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page, { personas: [...PERSONAS_ONB, CON_BAJA] })
    const fila = page.locator('.card', { hasText: 'ROSA VUELVE' })
    await expect(fila.getByTestId('ficha-de-baja')).toHaveText('ficha de baja')
    await expect(fila.getByTestId('con-ficha')).toHaveCount(0)
    await abrirPersona(page, 'ROSA VUELVE')
    await expect(fila.getByTestId('tiene-ficha-de-baja')).toContainText('Tiene una ficha de conductor dada de baja (SUR)')
    await expect(fila.getByTestId('ya-tiene-ficha')).toHaveCount(0)
    await expect(fila.getByRole('button', { name: 'Dar de alta como conductor' })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con la casilla del correo, el segundo paso sigue diciendo que la de baja deja de entrar con él', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      ficha: json({ detail: { mensaje: 'Ya tiene una ficha dada de baja con este correo.', reactivar_id: 'd-juan' } }, 409),
    })
    const vistos = dialogos(page, [false, false])
    const fila = page.locator('.card', { hasText: 'LUIS NUEVO' })
    await abrirPersona(page, 'LUIS NUEVO')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('checkbox').check()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect.poll(() => vistos.length).toBe(2)
    expect(vistos[1]).toContain('¿Es OTRA persona con el mismo correo?')
    expect(vistos[1]).toContain('dejará de entrar con este correo')
    expect(llamadas).toHaveLength(1)
  })

  test('de otra nave que no ve: dice que tiene ficha, pero sin «Abrir»', async ({ page }) => {
    const fallos = vigilar(page)
    await incorporaciones(page, { personas: [...PERSONAS_ONB, OTRA_NAVE] })
    const fila = page.locator('.card', { hasText: 'PEPE OTRA NAVE' })
    await expect(fila.getByTestId('con-ficha')).toHaveText('con ficha')
    await abrirPersona(page, 'PEPE OTRA NAVE')
    await expect(fila.getByTestId('ya-tiene-ficha')).toContainText('Ya tiene ficha de conductor (SUR)')
    await expect(fila.getByRole('link', { name: 'Abrir' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('F9 · reactivar desde Incorporaciones, como en Conductores', () => {
  test('con el ID de reparto en otra ficha pregunta y la reactiva sin él, en la nave de la persona, y la enlaza', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      personas: [...PERSONAS_ONB, CON_BAJA], ficha: REACTIVAR_409,
      reactivar: (route, body) => (body.quitar_id
        ? json({ ok: true, driver: { id: 'd-rosa', active: true } })(route)
        : json({ detail: { mensaje: 'ANA CON FICHA ya tiene ficha (ID de reparto AAAAA11111BB), centro NORTE.', abrir_id: 'd9',
          conflicto: 'id_reparto', transporter_id: 'AAAAA11111BB' } }, 409)(route)),
    })
    const vistos = dialogos(page, [true, true])
    const fila = page.locator('.card', { hasText: 'ROSA VUELVE' })
    await abrirPersona(page, 'ROSA VUELVE')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect(fila.getByTestId('ficha-creada')).toContainText('Ficha de conductor lista (NORTE)')
    expect(vistos[0]).toContain('Aceptar: reactivar su ficha')
    expect(vistos[1]).toContain('SIN ese ID de reparto')
    expect(llamadas).toEqual([
      { url: '/api/incorporaciones/personas/p5/ficha-conductor', body: { usar_correo: false, centro: 'NORTE' } },
      { url: '/api/drivers/d-rosa/reactivar', body: { center: 'NORTE' } },
      { url: '/api/drivers/d-rosa/reactivar', body: { center: 'NORTE', quitar_id: true } },
      { url: '/api/incorporaciones/personas/p5/ficha-conductor', body: { usar_correo: false, centro: 'NORTE' } }])
  })

  test('con el ID de reparto en otra ficha y «Cancelar», no reactiva ni crea nada', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      personas: [...PERSONAS_ONB, CON_BAJA], ficha: REACTIVAR_409,
      reactivar: json({ detail: { mensaje: 'ANA CON FICHA ya tiene ficha (ID de reparto AAAAA11111BB).', abrir_id: 'd9',
        conflicto: 'id_reparto', transporter_id: 'AAAAA11111BB' } }, 409),
    })
    const vistos = dialogos(page, [true, false])
    const fila = page.locator('.card', { hasText: 'ROSA VUELVE' })
    await abrirPersona(page, 'ROSA VUELVE')
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect.poll(() => vistos.length).toBe(2)
    await expect(fila.getByRole('button', { name: 'Crear la ficha' })).toBeEnabled()
    expect(llamadas.map((l) => l.url)).toEqual(['/api/incorporaciones/personas/p5/ficha-conductor', '/api/drivers/d-rosa/reactivar'])
    await expect(fila.getByTestId('ficha-creada')).toHaveCount(0)
  })

  test('con el correo en otra ficha activa no reactiva y ofrece abrirla en Conductores', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      personas: [...PERSONAS_ONB, CON_BAJA], ficha: REACTIVAR_409,
      reactivar: json({ detail: { mensaje: 'ANA CON FICHA ya tiene ficha (correo rosa@ejemplo.es), centro NORTE.', abrir_id: 'd9',
        conflicto: 'correo' } }, 409),
    })
    const vistos = dialogos(page, [true, true])
    await abrirPersona(page, 'ROSA VUELVE')
    const fila = page.locator('.card', { hasText: 'ROSA VUELVE' })
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect(page).toHaveURL(/\/panel\/conductores\?open=d9/)
    expect(vistos[1]).toContain('No se reactiva')
    expect(llamadas).toHaveLength(2)
  })

  test('con el correo en una ficha de otra nave (sin abrir_id) lo dice y no hace nada más', async ({ page }) => {
    const llamadas = await incorporaciones(page, {
      personas: [...PERSONAS_ONB, CON_BAJA], ficha: REACTIVAR_409,
      reactivar: json({ detail: { mensaje: 'Ese correo (rosa@ejemplo.es) ya lo tiene una ficha activa de SUR, que no tienes asignada.',
        centro: 'SUR', conflicto: 'correo' } }, 409),
    })
    const vistos = dialogos(page, [true])
    await abrirPersona(page, 'ROSA VUELVE')
    const fila = page.locator('.card', { hasText: 'ROSA VUELVE' })
    await fila.getByRole('button', { name: 'Dar de alta como conductor' }).click()
    await fila.getByRole('button', { name: 'Crear la ficha' }).click()
    await expect.poll(() => vistos.length).toBe(2)
    expect(vistos[1]).toContain('que no tienes asignada')
    expect(vistos[1]).toContain('No se reactiva')
    await expect(page).toHaveURL(/\/panel\/incorporaciones/)
    expect(llamadas).toHaveLength(2)
    await expect(fila.getByTestId('ficha-creada')).toHaveCount(0)
  })
})

test.describe('F5/F6 · quién dio la baja lo dice el servidor', () => {
  test('una que sacó la hoja y luego dio de baja la oficina dice «de baja desde…»', async ({ page }) => {
    const fallos = vigilar(page)
    await conBajas(page, { bajas: [
      { ...BAJAS[0], desactivada_por: 'hoja', origen: 'oficina' },
      { ...BAJAS[1], origen: 'hoja' }] })
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    const juan = page.getByTestId('baja-desde').filter({ hasText: 'de baja desde 05/11/2026' })
    await expect(juan).toHaveCount(1)
    await expect(page.getByTestId('baja-desde').filter({ hasText: 'la sacó la hoja de Google' })).toHaveCount(1)
    await abrirFicha(page, 'JUAN REY')
    await expect(page.getByTestId('ficha-de-baja')).toContainText('de baja desde 05/11/2026 (por Dani)')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('F12 · el chip «Bajas» sin ningún activo o sin coincidencias', () => {
  test('sin ningún conductor activo sale el chip y lleva a las bajas', async ({ page }) => {
    const fallos = vigilar(page)
    await panel(page, { lista: [], antes: () => page.route(/\/api\/drivers\/bajas/, json(BAJAS)) })
    await expect(page.getByText('No hay conductores', { exact: false }).first()).toBeVisible({ timeout: 45000 })
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    await expect(page.getByTestId('aviso-bajas')).toBeVisible()
    await expect(page.getByText('JUAN REY').first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('si la búsqueda no casa con ningún activo, el chip sigue ahí', async ({ page }) => {
    await conBajas(page)
    await page.getByPlaceholder('Buscar conductor…').fill('juan rey')
    await expect(page.getByText('Nadie coincide con «juan rey»')).toBeVisible()
    await page.getByRole('button', { name: 'Bajas (1)' }).click()
    await expect(page.getByText('JUAN REY').first()).toBeVisible()
  })
})

/* ── Tercera revisión (11-11-2026): W2 y W3 en el panel ── */
test.describe('W2 · reactivar con el ID de reparto en una ficha de otra nave (sin abrir_id)', () => {
  test('pregunta igual y la reactiva sin el ID', async ({ page }) => {
    const fallos = vigilar(page)
    const llamadas = await conBajas(page, {
      reactivar: (route, body) => (body.quitar_id
        ? json({ ok: true, driver: { id: 'd-juan', active: true } })(route)
        : json({ detail: { mensaje: 'Ese ID de reparto (AAAAA11111BB) ya lo tiene una ficha de SUR, que no tienes asignada.',
          centro: 'SUR', conflicto: 'id_reparto', transporter_id: 'AAAAA11111BB' } }, 409)(route)),
    })
    const vistos = dialogos(page, [true])
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    await abrirFicha(page, 'JUAN REY')
    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'JUAN REY vuelve a estar activo' })).toBeVisible()
    expect(vistos).toHaveLength(1)
    expect(vistos[0]).toContain('ya lo tiene una ficha de SUR')
    expect(vistos[0]).toContain('SIN ese ID de reparto')
    expect(llamadas.map((l) => l.body)).toEqual([{}, { quitar_id: true }])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con el correo en una ficha de otra nave (sin abrir_id) lo dice y no reactiva (como antes)', async ({ page }) => {
    const llamadas = await conBajas(page, {
      reactivar: json({ detail: { mensaje: 'Ese correo (juan@ejemplo.es) ya lo tiene una ficha activa de SUR, que no tienes asignada.',
        centro: 'SUR', conflicto: 'correo' } }, 409),
    })
    const vistos = dialogos(page)
    await page.getByRole('button', { name: 'Bajas (2)' }).click()
    await abrirFicha(page, 'JUAN REY')
    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByText('ya lo tiene una ficha activa de SUR, que no tienes asignada.')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'vuelve a estar activo' })).toHaveCount(0)
    expect(vistos).toHaveLength(0)
    expect(llamadas).toHaveLength(1)
  })
})

test.describe('W3 · «Cambio de centro» con fecha de hoy que no se pudo aplicar', () => {
  const NO_APLICADO = 'Queda programado, pero no se ha podido aplicar ahora. Se vuelve a intentar solo cada cuarto de hora; si mañana sigue sin cambiar, avisa.'

  test('lo dice en rojo y no enseña «Cambiado»', async ({ page }) => {
    const fallos = vigilar(page)
    let pedido = null
    await panel(page, { antes: () => page.route(/\/api\/drivers\/d1\/traslado/, (route) => {
      pedido = route.request().postDataJSON()
      return json({ aplicado: false, traslado: { ...pedido, por: 'Admin Test' }, error: NO_APLICADO })(route)
    }) })
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await page.getByRole('button', { name: 'Programar…' }).click()
    await page.getByRole('button', { name: 'Programar', exact: true }).click()
    await expect(page.getByText(NO_APLICADO)).toBeVisible()
    await expect(page.getByText(/^Pasa a SUR el /)).toBeVisible()
    await expect(page.getByText(/^Cambiado: ya está en/)).toHaveCount(0)
    expect(pedido.centro).toBe('SUR')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin `error` (servidor de antes o fecha futura) sale como hoy, sin aviso', async ({ page }) => {
    await panel(page, { antes: () => page.route(/\/api\/drivers\/d1\/traslado/, (route) => {
      const pedido = route.request().postDataJSON()
      return json({ aplicado: false, traslado: { ...pedido, por: 'Admin Test' } })(route)
    }) })
    await abrirFicha(page, 'ANTONIO GARCÍA')
    await page.getByRole('button', { name: 'Programar…' }).click()
    await page.getByRole('button', { name: 'Programar', exact: true }).click()
    await expect(page.getByText(/^Pasa a SUR el /)).toBeVisible()
    await expect(page.getByText('no se ha podido aplicar', { exact: false })).toHaveCount(0)
  })
})
