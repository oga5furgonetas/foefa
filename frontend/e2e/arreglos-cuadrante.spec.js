import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ARREGLOS DEL CUADRANTE (10-11-2026, revisión de la flota propia). Lo que se prueba es la pantalla; lo que hace
   el servidor (un solo aviso, los que bajan de otros centros, los días cerrados vigentes) lo prueba
   backend/tests/test_arreglos_cuadrante.py.
     · cuadrante-4: la bandeja de peticiones no dice «No hay solicitudes pendientes» porque falle otra cosa, y si
       fallan ellas lo dice con un reintentar; con la rejilla escondida no se pide lo que solo usa ella.
     · cuadrante-7: aprobar un grupo es UNA llamada (un solo aviso al conductor).
     · cuadrante-6: la fila de Refuerzos dice cuántos bajan de otros centros.
     · cuadrante-11: Días cerrados, los vigentes con la fecha legible y los pasados plegados.
     · cuadrante-12: al cambiar de nave, el Cuadrante vacía lo de la otra y no deja tocar nada. */

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dia = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return iso(d) }
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
const PET = (id, n, grupo = 'g1') => ({ id, grupo, date: dia(n), status: 'pendiente', type: 'libre', motivo: 'asuntos',
  motivo_label: 'Asuntos propios', note: 'boda de mi prima', driver_id: 'd1', driver_name: 'ANA PÉREZ', center: 'NORTE',
  created_at: new Date().toISOString() })
const DRIVERS = [{ id: 'd1', name: 'ANA PÉREZ', center: 'NORTE', active: true }, { id: 'd2', name: 'LUIS RUIZ', center: 'NORTE', active: true }]

/* Lo que se le pide al servidor, para ver qué NO se pide. */
function apuntarPeticiones(page) {
  const urls = []
  page.on('request', (r) => { if (r.url().includes('/api/')) urls.push(r.url()) })
  return urls
}

test.describe('Días libres · peticiones', () => {
  test('si fallan la cobertura o las máximas, la bandeja enseña las peticiones igual (y ni se piden)', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const urls = apuntarPeticiones(page)
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    await page.route(/\/api\/shifts\/coverage/, json({ detail: 'caído' }, 500))
    await page.route(/\/api\/route-demand/, json({ detail: 'caído' }, 500))
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const st = new URL(route.request().url()).searchParams.get('status')
      return json({ requests: st === 'pendiente' ? [PET('p1', 5), PET('p2', 6)] : [] })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('No hay solicitudes pendientes')).toHaveCount(0)
    await expect(page.getByText('No se pudo cargar la cobertura.')).toHaveCount(0)
    // Con la rejilla escondida no se pide lo que solo usa ella: ni turnos del mes, ni cobertura, ni máximas, ni
    // códigos, ni las aprobadas de siempre (solo de hoy en adelante, para Días cerrados).
    const api = urls.map((u) => new URL(u))
    expect(api.filter((u) => /\/shifts\/coverage|\/route-demand|\/shifts\/codigos/.test(u.pathname))).toEqual([])
    expect(api.filter((u) => u.pathname.endsWith('/api/shifts'))).toEqual([])
    const aprobadas = api.filter((u) => u.pathname.endsWith('/shift-requests') && u.searchParams.get('status') === 'aprobado')
    expect(aprobadas.length).toBeGreaterThan(0)
    for (const u of aprobadas) expect(u.searchParams.get('desde')).toBeTruthy()
  })

  test('si fallan las peticiones lo dice, se reintenta, y las otras pestañas siguen', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    let caidas = true
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const st = new URL(route.request().url()).searchParams.get('status')
      if (st === 'pendiente' && caidas) return json({ detail: 'tiempo agotado' }, 500)(route)
      return json({ requests: st === 'pendiente' ? [PET('p1', 5)] : [] })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    const error = page.getByTestId('peticiones-error')
    await expect(error).toContainText('No se han podido leer las peticiones.', { timeout: 15000 })
    await expect(page.getByText('No hay solicitudes pendientes')).toHaveCount(0)
    // Días cerrados no se queda en blanco por eso: tiene sus conductores.
    await page.getByRole('button', { name: 'Días cerrados', exact: true }).click()
    await expect(page.getByLabel('A quién').locator('option', { hasText: 'LUIS RUIZ' })).toHaveCount(1)
    await page.getByRole('button', { name: /^Peticiones/ }).click()
    caidas = false
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('aprobar una petición de varios días es UNA llamada, y lo que no se pudo se dice con su porqué', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const urls = apuntarPeticiones(page)
    let pendientes = [PET('p1', 5), PET('p2', 6), PET('p3', 7)]
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const st = new URL(route.request().url()).searchParams.get('status')
      return json({ requests: st === 'pendiente' ? pendientes : [] })(route)
    })
    const grupos = []
    await page.route(/\/api\/shift-requests\/resolver-grupo/, (route) => {
      grupos.push(route.request().postDataJSON())
      pendientes = []
      return json({ success: true, status: 'aprobado', resueltas: ['p1', 'p2'], canceladas: [],
        saltadas: [{ id: 'p3', date: dia(7), detail: 'Ese día está suspendido: levanta la suspensión antes de aprobarlo' }] })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Aprobar' }).click()
    await expect.poll(() => grupos).toEqual([{ ids: ['p1', 'p2', 'p3'], action: 'aprobar', motivo: '' }])
    await expect(page.getByText(`${ddmm(dia(7))}: Ese día está suspendido: levanta la suspensión antes de aprobarlo`)).toBeVisible()
    await expect(page.getByText('No hay solicitudes pendientes')).toBeVisible()
    expect(urls.filter((u) => /\/resolve$/.test(new URL(u).pathname))).toEqual([])
  })

  test('con un servidor que aún no resuelve grupos, se contesta día a día como antes', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    let pendientes = [PET('p1', 5), PET('p2', 6)]
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const st = new URL(route.request().url()).searchParams.get('status')
      return json({ requests: st === 'pendiente' ? pendientes : [] })(route)
    })
    await page.route(/\/api\/shift-requests\/resolver-grupo/, json({ detail: 'Not Found' }, 404))
    const sueltas = []
    await page.route(/\/api\/shift-requests\/p\d\/resolve/, (route) => {
      sueltas.push(route.request().url().match(/shift-requests\/(p\d)\//)[1])
      pendientes = pendientes.filter((p) => !sueltas.includes(p.id))
      return json({ success: true, status: 'aprobado' })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Aprobar' }).click()
    await expect.poll(() => sueltas).toEqual(['p1', 'p2'])
    await expect(page.getByText('No hay solicitudes pendientes')).toBeVisible()
  })
})

test.describe('Días libres · Refuerzos y Días cerrados', () => {
  test('la fila de un día bajo la máxima dice cuántos bajan de otros centros', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/refuerzos\/faltas/, json({ dias: 14, con_maximas: true, faltas: [
      { date: dia(1), dia: 'sábado 15/11', maximo: 50, en_ruta: 44, bajan: 3, falta: 3, pueden: 2, refuerzo: null },
      { date: dia(2), dia: 'domingo 16/11', maximo: 50, en_ruta: 48, bajan: 0, falta: 2, pueden: 2, refuerzo: null }] }))
    await page.route(/\/api\/refuerzos(\?|$)/, json({ refuerzos: [], puede_aprobar: true }))
    await page.goto('/panel/turnos?vista=refuerzos', { waitUntil: 'domcontentloaded' })
    const faltas = page.getByTestId('faltas')
    await expect(faltas.getByText('faltan 3')).toBeVisible({ timeout: 15000 })
    await expect(faltas).toContainText('en ruta 44 +3 de otros centros')
    // Donde no baja nadie, no se dice nada.
    await expect(faltas.getByText(/de otros centros/)).toHaveCount(1)
  })

  test('Días cerrados: los vigentes con la fecha legible y los pasados plegados', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const pedidos = []
    await page.route(/\/api\/shift-blocks(\?|$)/, (route) => {
      pedidos.push(new URL(route.request().url()).searchParams.get('pasados'))
      return json({ total: 1, n_pasados: 1,
        bloqueos: [{ id: 'b2', center: 'NORTE', desde: dia(20), hasta: dia(30), motivo: 'Pico de Navidad', driver_id: null }],
        pasados: [{ id: 'b1', center: 'NORTE', desde: dia(-40), hasta: dia(-35), motivo: 'Prime Day del año pasado', driver_id: null }],
      })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Días cerrados', exact: true }).click({ timeout: 15000 })
    const vigentes = page.getByTestId('dias-cerrados')
    await expect(vigentes).toContainText('Pico de Navidad')
    await expect(vigentes).toContainText(`${ddmm(dia(20))} → `)
    await expect(vigentes).toContainText(ddmm(dia(30)))
    await expect(vigentes).not.toContainText(dia(20))                 // nada de 2026-12-20
    await expect(vigentes).not.toContainText('Prime Day del año pasado')
    const pasados = page.getByTestId('dias-cerrados-pasados')
    await expect(pasados.getByText('Ver pasados (1)')).toBeVisible()
    await expect(pasados.getByText('Prime Day del año pasado')).toBeHidden()
    await pasados.getByText('Ver pasados (1)').click()
    await expect(pasados.getByText('Prime Day del año pasado')).toBeVisible()
    expect(pedidos).toContain('true')
  })
})

test.describe('Cuadrante · cambiar de nave', () => {
  const lunes = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })()
  const dl = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d) }
  const DATOS = (center, nombre) => {
    const celdas = {}
    for (let i = 0; i < 14; i++) celdas[`p1|${dl(i)}`] = { cod: i % 7 < 5 ? '1' : 'N/T', extra: false, fijada: false }
    return {
      center, desde: dl(0), hasta: dl(13), hoy: dl(1), celdas, objetivos: {}, ajustes: [], aprobados: [],
      personas: [{ id: 'p1', nombre, tipo: 'normal', ficha_activa: true, apodos: [], nota: '', reglas: {}, entendido: [],
        sin_entender: '', reglas_fijas: [] }],
      maximas: {}, config: { colchon: 2, permitir_extra: true }, propuesta: null, ultimo_cambio: null,
      tipos: ['normal', 'empresa', 'finde', 'inactivo'],
    }
  }

  test('al cambiar de nave se vacía lo de la otra, sale «Cargando…» y no se puede tocar nada', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    let soltarSur
    const surListo = new Promise((r) => { soltarSur = r })
    const celdasGuardadas = []
    await page.route(/\/api\/cuadrante\/celdas/, (route) => { celdasGuardadas.push(route.request().postDataJSON()); return json({ ok: true })(route) })
    await page.route(/\/api\/cuadrante\?/, async (route) => {
      const c = new URL(route.request().url()).searchParams.get('center')
      if (c === 'SUR') { await surListo; return json(DATOS('SUR', 'SARA VIDAL'))(route) }
      return json(DATOS('NORTE', 'ANA PÉREZ'))(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible({ timeout: 15000 })
    // Un pincel elegido en NORTE no se queda puesto para SUR.
    await page.getByTitle('Libra', { exact: true }).first().click()
    await expect(page.getByTitle('Libra', { exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByText('Cargando el cuadrante…')).toBeVisible()
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ninguno (menú)' })).toHaveAttribute('aria-pressed', 'true')
    soltarSur()
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    expect(celdasGuardadas).toEqual([])
  })
})
