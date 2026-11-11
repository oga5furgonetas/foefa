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
     · cuadrante-12: al cambiar de nave, el Cuadrante vacía lo de la otra y no deja tocar nada.
   Y lo que encontró la revisión de estos arreglos (R2, R13, R14, R16, R20, R21, R22): las cargas y guardados de la
   nave anterior que vuelven tarde no pintan nada, contestar un grupo que falla a mitad refresca la bandeja, el 409
   del servidor de antes sigue dando su aviso, y «Personas» y «Ajustes» esperan a la nave nueva. */

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dia = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return iso(d) }
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
// Como lo pinta Turnos (toLocaleDateString del idioma del panel): en español el día 1 sale «1/12», no «01/12»; escrito
// a mano con ddmm, la prueba de Días cerrados fallaba los días en que la fecha caía del 1 al 9 (visto el 11-11-2026).
// Se calcula en el propio navegador (segunda revisión, 11-11-2026): Node y Chromium pueden traer datos de idioma
// distintos, y la pantalla usa los de Chromium.
const comoPantalla = (page, f) => page.evaluate((x) => new Date(`${x}T12:00:00`)
  .toLocaleDateString('es', { day: '2-digit', month: '2-digit' }), f)
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
      const id = route.request().url().match(/shift-requests\/(p\d)\//)[1]
      sueltas.push(id)
      pendientes = pendientes.filter((p) => !sueltas.includes(p.id))
      // El servidor de siempre: el día que quien lo pidió ya canceló contesta 409 (revisión del 10-11-2026, R16).
      if (id === 'p2') return json({ detail: 'El conductor ha cancelado esta petición' }, 409)(route)
      return json({ success: true, status: 'aprobado' })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Aprobar' }).click()
    await expect.poll(() => sueltas).toEqual(['p1', 'p2'])
    await expect(page.getByText('1 de esos días ya los había cancelado ANA PÉREZ: esos no se han tocado.')).toBeVisible()
    await expect(page.getByText('No hay solicitudes pendientes')).toBeVisible()
  })

  /* Revisión del 10-11-2026 (R14): si la llamada del grupo falla a mitad, parte ya está contestada en el servidor.
     La bandeja se vuelve a leer, así que reintentar ya no lleva esos días; y mientras se contesta, los botones no
     responden (un doble toque eran dos grupos y dos avisos). */
  test('si contestar un grupo falla a mitad, la bandeja se refresca y no se puede pulsar dos veces', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    let pendientes = [PET('p1', 5), PET('p2', 6)]
    let lecturas = 0
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const st = new URL(route.request().url()).searchParams.get('status')
      if (st === 'pendiente') lecturas += 1
      return json({ requests: st === 'pendiente' ? pendientes : [] })(route)
    })
    let soltar
    const suelta = new Promise((r) => { soltar = r })
    const grupos = []
    await page.route(/\/api\/shift-requests\/resolver-grupo/, async (route) => {
      grupos.push(route.request().postDataJSON())
      await suelta
      pendientes = [PET('p2', 6)]                    // el 1.º se aprobó y avisó; el 2.º no llegó
      return json({ detail: 'Error interno' }, 500)(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    const [d5, d6] = [await comoPantalla(page, dia(5)), await comoPantalla(page, dia(6))]
    await expect(page.getByText(`${d5} · ${d6}`)).toBeVisible()
    const aprobar = page.getByRole('button', { name: 'Aprobar' })
    await aprobar.click()
    await expect(aprobar).toBeDisabled()
    await aprobar.click({ force: true }).catch(() => {})
    const antes = lecturas
    soltar()
    await expect(page.getByText('Error interno')).toBeVisible()
    await expect.poll(() => lecturas).toBeGreaterThan(antes)
    await expect(page.getByText(d6, { exact: true })).toBeVisible()
    await expect(page.getByText(`${d5} · ${d6}`)).toHaveCount(0)
    await expect(aprobar).toBeEnabled()
    expect(grupos).toHaveLength(1)
  })

  /* Revisión del 10-11-2026 (R13): se aprueba en NORTE y se cambia a SUR mientras tanto. Al volver la respuesta,
     la recarga es de SUR: la bandeja de NORTE no se pinta bajo SUR. */
  test('si se cambia de nave mientras se contesta, la bandeja que queda es la de la nave nueva', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    const pedidas = []
    await page.route(/\/api\/shift-requests\?/, (route) => {
      const u = new URL(route.request().url())
      const st = u.searchParams.get('status')
      const c = u.searchParams.get('center')
      if (st === 'pendiente') pedidas.push(c)
      const norte = [PET('p1', 5), { ...PET('p9', 8, 'g9'), driver_id: 'd2', driver_name: 'LUIS RUIZ' }]
      const sur = [{ ...PET('s1', 5, 'gs'), driver_id: 'd5', driver_name: 'SARA VIDAL', center: 'SUR' }]
      return json({ requests: st !== 'pendiente' ? [] : c === 'SUR' ? sur : norte })(route)
    })
    let soltar
    const suelta = new Promise((r) => { soltar = r })
    await page.route(/\/api\/shift-requests\/resolver-grupo/, async (route) => {
      await suelta
      return json({ success: true, status: 'aprobado', resueltas: ['p1'], canceladas: [], saltadas: [] })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Aprobar' }).first().click()
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByText('SARA VIDAL', { exact: true })).toBeVisible()
    const respuesta = page.waitForResponse(/\/api\/shift-requests\/resolver-grupo/)
    const tras = pedidas.length
    soltar()
    await respuesta
    await page.waitForTimeout(500)
    expect(pedidas.slice(tras).filter((c) => c !== 'SUR')).toEqual([])
    await expect(page.getByText('SARA VIDAL', { exact: true })).toBeVisible()
    await expect(page.getByText('LUIS RUIZ', { exact: true })).toHaveCount(0)
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
    await expect(vigentes).toContainText(`${await comoPantalla(page, dia(20))} → `)
    await expect(vigentes).toContainText(await comoPantalla(page, dia(30)))
    await expect(vigentes).not.toContainText(dia(20))                 // nada de 2026-12-20
    await expect(vigentes).not.toContainText('Prime Day del año pasado')
    const pasados = page.getByTestId('dias-cerrados-pasados')
    await expect(pasados.getByText('Ver pasados (1)')).toBeVisible()
    await expect(pasados.getByText('Prime Day del año pasado')).toBeHidden()
    await pasados.getByText('Ver pasados (1)').click()
    await expect(pasados.getByText('Prime Day del año pasado')).toBeVisible()
    expect(pedidos).toContain('true')
  })

  /* Revisión final (11-11-2026, G4): el calendario pide los pasados y pinta con ellos los días cerrados de meses de
     atrás, como antes. Aquí el cierre del mes pasado llega SOLO en `pasados`. El mes se calcula cuando la pantalla lo
     pide, no al cargar el fichero. */
  test('el calendario sigue pintando un día cerrado del mes pasado', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const pedidos = []
    let cierre = null
    await page.route(/\/api\/shift-blocks(\?|$)/, (route) => {
      const pasados = new URL(route.request().url()).searchParams.get('pasados')
      pedidos.push(pasados)
      const h = new Date()
      const d = (n) => iso(new Date(h.getFullYear(), h.getMonth() - 1, n, 12))
      cierre = { id: 'b9', center: 'NORTE', desde: d(1), hasta: d(28), motivo: 'Cierre por obras', driver_id: null }
      return json(pasados === 'true' ? { total: 0, n_pasados: 1, bloqueos: [], pasados: [cierre] }
        : { total: 1, bloqueos: [cierre] })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Calendario', exact: true }).click({ timeout: 15000 })
    await expect.poll(() => cierre).not.toBeNull()
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await page.getByRole('button', { name: '15 cerrado', exact: true }).click()
    await expect(page.getByText('Día cerrado: Cierre por obras')).toBeVisible()
    expect(pedidos).toContain('true')
  })
})

test.describe('Cuadrante · cambiar de nave', () => {
  /* Los datos salen de las fechas que pide la pantalla (segunda revisión, 11-11-2026), no de un «lunes» calculado en
     Node al cargar el fichero: si la tanda cruzaba la noche del domingo al lunes, la pantalla pedía la semana nueva y
     le llegaba la anterior. */
  const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return iso(d) }
  const desdeDe = (route) => new URL(route.request().url()).searchParams.get('desde')
  const DATOS = (center, nombre, desde) => {
    const dl = (n) => masDias(desde, n)
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
      if (c === 'SUR') { await surListo; return json(DATOS('SUR', 'SARA VIDAL', desdeDe(route)))(route) }
      return json(DATOS('NORTE', 'ANA PÉREZ', desdeDe(route)))(route)
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
    // Se intenta tocar una celda en ese rato (revisión del 10-11-2026, R21): no queda ninguna, y nada se guarda.
    const celdas = page.getByTitle(/^(ANA PÉREZ|SARA VIDAL) · /)
    await expect(celdas).toHaveCount(0)
    await celdas.first().click({ timeout: 1000 }).catch(() => {})
    soltarSur()
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    expect(celdasGuardadas).toEqual([])
  })

  /* Revisión del 10-11-2026 (R2): en NORTE, con un pincel, se toca una celda y, con el guardado aún por el aire,
     se cambia a SUR. El cargar que lanza ese guardado al volver es el de NORTE: no puede pedir NORTE ni pintar su
     tabla bajo SUR. */
  test('un guardado de la nave anterior que vuelve tarde no vuelve a pintar su cuadrante', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    let soltar
    const suelta = new Promise((r) => { soltar = r })
    await page.route(/\/api\/cuadrante\/celdas/, async (route) => {
      await suelta
      return json({ ok: true, guardadas: 1, bloqueadas: [{ motivo: 'de NORTE' }] })(route)
    })
    const pedidas = []
    await page.route(/\/api\/cuadrante\?/, (route) => {
      const c = new URL(route.request().url()).searchParams.get('center')
      pedidas.push(c)
      return json(c === 'SUR' ? DATOS('SUR', 'SARA VIDAL', desdeDe(route)) : DATOS('NORTE', 'ANA PÉREZ', desdeDe(route)))(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible({ timeout: 15000 })
    await page.getByTitle('Libra', { exact: true }).first().click()
    await page.getByTitle(/^ANA PÉREZ · /).first().click()
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    const tras = pedidas.length
    const respuesta = page.waitForResponse(/\/api\/cuadrante\/celdas/)
    soltar()
    await respuesta
    await page.waitForTimeout(500)
    expect(pedidas.slice(tras)).toEqual([])
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toHaveCount(0)
    await expect(page.getByText(/de NORTE/)).toHaveCount(0)        // el aviso de aquel guardado no sale en SUR
  })

  /* Revisión del 10-11-2026 (R22 y R20): en «Personas y notas» y en «Ajustes y estudio», mientras llega la nave
     nueva sale «Cargando…», no «0 personas»; y el colchón que se ve (y que se guardaría al salir del campo) es el
     de la nave nueva, no el de la anterior ni el 2 por defecto. */
  test('Personas y Ajustes esperan a la nave nueva y el colchón no se queda con el de la otra', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    let soltarSur
    let surListo = Promise.resolve()
    let colchonSur = 3
    const config = []
    await page.route(/\/api\/cuadrante\/config/, (route) => { config.push(route.request().postDataJSON()); return json({ ok: true })(route) })
    await page.route(/\/api\/cuadrante\?/, async (route) => {
      const c = new URL(route.request().url()).searchParams.get('center')
      if (c === 'SUR') {
        await surListo
        return json({ ...DATOS('SUR', 'SARA VIDAL', desdeDe(route)), config: { colchon: colchonSur, permitir_extra: true } })(route)
      }
      return json({ ...DATOS('NORTE', 'ANA PÉREZ', desdeDe(route)), config: { colchon: 1, permitir_extra: true } })(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Personas y notas' }).click()
    await expect(page.getByText('1 personas en el cuadrante')).toBeVisible()
    surListo = new Promise((r) => { soltarSur = r })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByText('Cargando el cuadrante…')).toBeVisible()
    await expect(page.getByText(/personas en el cuadrante/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Ajustes y estudio' }).click()
    await expect(page.getByText('Cargando el cuadrante…')).toBeVisible()
    await expect(page.getByLabel('Colchón', { exact: true })).toHaveCount(0)
    soltarSur()
    const colchon = page.getByLabel('Colchón', { exact: true })
    await expect(colchon).toHaveValue('3')
    await colchon.focus()
    await colchon.blur()
    await page.waitForTimeout(300)
    expect(config).toEqual([])
    // Con la pestaña abierta, los datos se recargan con otro colchón (alguien lo cambió): el campo lo sigue.
    colchonSur = 5
    await page.getByLabel(/Si con 5 días no se llega/).click()
    await expect(colchon).toHaveValue('5')
    await colchon.focus()
    await colchon.blur()
    await page.waitForTimeout(300)
    expect(config).toEqual([{ center: 'SUR', permitir_extra: false }])
  })

  /* Segunda revisión (11-11-2026, S5): en la MISMA nave, con un guardado por el aire se pasa a la semana siguiente.
     El cargar de aquel guardado es el de la semana de antes: no puede pedirla, que su respuesta ganaba a la de la
     semana nueva y se pintaba bajo sus fechas. */
  test('un guardado que vuelve tarde no pide ni pinta la semana anterior bajo la nueva', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    let soltar
    const suelta = new Promise((r) => { soltar = r })
    await page.route(/\/api\/cuadrante\/celdas/, async (route) => {
      await suelta
      return json({ ok: true, guardadas: 0, bloqueadas: [{ motivo: 'ya estaba así' }] })(route)
    })
    const pedidas = []
    await page.route(/\/api\/cuadrante\?/, (route) => {
      const desde = desdeDe(route)
      pedidas.push(desde)
      // La semana que se abre primero es la de ANA; las otras, la de EVA: así se ve cuál se está pintando.
      return json(DATOS('NORTE', desde === pedidas[0] ? 'ANA PÉREZ' : 'EVA RÍOS', desde))(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible({ timeout: 15000 })
    const semana1 = pedidas[0]
    await page.getByTitle('Libra', { exact: true }).first().click()
    await page.getByTitle(/^ANA PÉREZ · /).first().click()
    await page.getByRole('button', { name: 'Semana siguiente' }).click()
    await expect(page.getByRole('button', { name: /EVA RÍOS/ })).toBeVisible()
    const tras = pedidas.length
    soltar()
    // El aviso de la celda sí sale (es la misma nave); se pone justo antes del cargar de aquel guardado.
    await expect(page.getByText('Una celda no se ha cambiado: ya estaba así.')).toBeVisible()
    await expect(page.getByRole('button', { name: /EVA RÍOS/ })).toBeVisible()
    // Barrera, sin esperas fijas: lo que se pidiera tras el guardado va antes que la semana que se pide ahora.
    const otra = page.waitForRequest((r) => r.url().includes('/api/cuadrante?')
      && new URL(r.url()).searchParams.get('desde') === masDias(semana1, 14))
    await page.getByRole('button', { name: 'Semana siguiente' }).click()
    await otra
    expect(pedidas.slice(tras)).toEqual([masDias(semana1, 14)])
    await expect(page.getByRole('button', { name: /EVA RÍOS/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toHaveCount(0)
  })

  /* Segunda revisión (11-11-2026, S5, de paso): como guardarCeldas, si guardar una máxima o «Bajan de otros
     centros» falla cuando ya se está en otra nave, su error no sale en esa otra. */
  test('el error de una máxima o de los que bajan de la nave anterior no sale en la nueva', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    let soltar
    const suelta = new Promise((r) => { soltar = r })
    const retenidas = []
    for (const ruta of [/\/api\/cuadrante\/maximas/, /\/api\/cuadrante\/ajustes/]) {
      await page.route(ruta, async (route) => {
        retenidas.push(new URL(route.request().url()).pathname)
        await suelta
        return json({ detail: 'No se ha guardado lo de NORTE' }, 500)(route)
      })
    }
    const pedidas = []
    await page.route(/\/api\/cuadrante\?/, (route) => {
      const u = new URL(route.request().url())
      pedidas.push(`${u.searchParams.get('center')}|${desdeDe(route)}`)
      return json(u.searchParams.get('center') === 'SUR'
        ? DATOS('SUR', 'SARA VIDAL', desdeDe(route)) : DATOS('NORTE', 'ANA PÉREZ', desdeDe(route)))(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible({ timeout: 15000 })
    const maxima = page.getByLabel(/^Máxima del /).first()
    await maxima.fill('40')
    await maxima.press('Enter')
    const bajan = page.getByLabel(/^Bajan de otros centros el /).first()
    await bajan.fill('2')
    await bajan.press('Enter')
    await expect.poll(() => retenidas.length).toBe(2)
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    const fallos = Promise.all([page.waitForResponse(/\/api\/cuadrante\/maximas/), page.waitForResponse(/\/api\/cuadrante\/ajustes/)])
    soltar()
    await fallos
    // Barrera: la semana siguiente de SUR se pide y se pinta después de que esos fallos vuelvan.
    const desdeSur = pedidas.filter((p) => p.startsWith('SUR|')).at(-1).split('|')[1]
    const otra = page.waitForResponse((r) => r.url().includes('/api/cuadrante?')
      && new URL(r.url()).searchParams.get('desde') === masDias(desdeSur, 7))
    await page.getByRole('button', { name: 'Semana siguiente' }).click()
    await otra
    await expect(page.getByRole('button', { name: /SARA VIDAL/ })).toBeVisible()
    await expect(page.getByText('No se ha guardado lo de NORTE')).toHaveCount(0)
  })
})
