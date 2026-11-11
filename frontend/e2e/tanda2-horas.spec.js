/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 2 (11-11-2026), zona «horas»: Horas y la DNR en el móvil (horas_dnr-7), el
   selector de semana de Horas (horas_dnr-3), de qué centro es cada fichero de la DNR
   (horas_dnr-4), «¿No es esta persona?» en vez de «no es él» y el botón por centro
   con «Todos» (portal_inicio-9). De docs/REVISION-FLOTA-PROPIA-10-11.md.
   Las semanas van fijas (las da la API simulada, no el reloj). */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const MOVIL = { width: 390, height: 844 }
const ORDENADOR = { width: 1440, height: 900 }
// 44 px de alto (con medio píxel de margen: con la densidad del móvil, 44 sale 43,97).
const DEDO = 43.5

/* Nada se sale de lado: la página no se desliza en horizontal. */
const sinDesborde = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

// ── Horas ──────────────────────────────────────────────────────────────────────
const conductor = (nombre, trabajado, extra) => ({
  nombre, trabajado, planificado: 0, bloques: [], dias_trabajados: 5, margen_semanal: 3270 - trabajado,
  supera_semanal: false, pasara_hoy: false, cerrado: trabajado, al_limite: false, trabajando_ahora: false,
  riesgo_diario: [], bloques_pasados: [], incumple_propio: false, cuadra: true, trabajado_origen: 'portal', ...extra,
})
const ANALISIS = (extra) => ({
  centro: 'NORTE', semana_del_plan: '2026-11-08', guardado: false, aviso_guardado: null, otra_nave: null,
  pegado_en: new Date().toISOString(), pegado_hoy: true,
  whc: { conductores_con_actividad: 3, excepciones: null, excepciones_conocidas: false, porcentaje: null,
    tier: null, coste_por_excepcion: 33.33 },
  whc_propio: { conductores: 3, incumplen: 1, por_semanal: 1, por_bloque: 0, porcentaje: 66.7,
    limite_semanal_min: 3270, limite_bloque_min: 660, quien: [] },
  ritmo: { dia_semana: 4, dia_leido_del_plan: true, bloques_ref: 4, horas_ref_min: 2160, pasados: 1, peligro: 0,
    justos: 0, en_ruta_ahora: 0, avisos: [] },
  conductores: [
    conductor('MIGUEL ÁNGEL TORRES BLANCO DE LA FUENTE', 3420, { supera_semanal: true, incumple_propio: true,
      riesgo_diario: [{ inicio: 'lun 9:00', fin: '20:10', minutos: 670 }] }),
    conductor('ANA PÉREZ', 3150, { al_limite: true }),
    conductor('SARA VIDAL', 1620, {}),
  ],
  resumen: { total: 3, superan: 1, pasaran_hoy: 0, bloque_pasado: 0, incumplen_propio: 1, al_limite: 1,
    con_riesgo_diario: 1, no_cuadran: 0 },
  aviso_diario: 'Los bloques largos son un aviso de riesgo, no un incumplimiento.',
  ...extra,
})
const ESTADO = { semana_en_curso: '2026-11-08', faltan: [], como_se_arregla: '',
  naves: [{ centro: 'NORTE', semana: '2026-11-08', al_dia: true, conductores: 3, semanas_atras: 0 }] }
const TEXTO = 'ANA PÉREZ\n55h 00m / 60h\n'.repeat(4)
const plan = (week, extra) => ({ hay: true, semana: week, week, texto: TEXTO, excepciones: null,
  pegado_en: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra })

test.describe('Horas · semana a semana (H2)', () => {
  test('‹ abre el plan de la semana pasada, se completa con sus excepciones y «Borrar» borra esa', async ({ page }) => {
    await page.setViewportSize(ORDENADOR)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const pedidas = []
    const borradas = []
    const cuerpos = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      const week = new URL(route.request().url()).searchParams.get('week')
      if (route.request().method() === 'DELETE') {
        borradas.push(week)
        return json({ ok: true, borrados: 1, semana: week })(route)
      }
      pedidas.push(week)
      return json(week === '2026-11-01' ? plan('2026-11-01', { excepciones: 1 }) : plan('2026-11-08'))(route)
    })
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      cuerpos.push(b)
      const semana = b.week || '2026-11-08'
      return json(ANALISIS({ semana_del_plan: semana, guardado: b.guardar !== false }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('horas-semana')).toContainText('Semana del 08/11', { timeout: 15000 })
    await expect(page.getByTestId('horas-semana')).toContainText('la de ahora')
    await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled()
    await expect(page.getByText(/Cómo vamos · NORTE · semana del 08\/11/)).toBeVisible()
    expect(pedidas).toEqual([null])

    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await expect(page.getByTestId('horas-semana')).toContainText('Semana del 01/11')
    await expect(page.getByText(/Cómo vamos · NORTE · semana del 01\/11/)).toBeVisible({ timeout: 15000 })
    expect(pedidas).toEqual([null, '2026-11-01'])
    // Se abre sin guardar y diciendo de qué semana es (para un plan sin fechas).
    const abrir = cuerpos.at(-1)
    expect(abrir.guardar).toBe(false)
    expect(abrir.week).toBe('2026-11-01')
    await expect(page.locator('#horas-excepciones')).toHaveValue('1')
    // Lo mira de la semana que se ve: no sale «no de esta».
    await expect(page.getByText(/no de esta\./)).toHaveCount(0)

    // Completarlo con sus excepciones: «Recalcular» manda la cifra y esa semana.
    await page.locator('#horas-excepciones').fill('3')
    await page.getByRole('button', { name: 'Recalcular' }).click()
    await expect.poll(() => cuerpos.filter((b) => b.recalcular).length).toBe(1)
    const recalc = cuerpos.find((b) => b.recalcular)
    expect(recalc.excepciones).toBe(3)
    expect(recalc.week).toBe('2026-11-01')

    // «Borrar» borra la de la semana que se ve.
    let pregunta = ''
    page.once('dialog', (d) => { pregunta = d.message(); d.accept() })
    await page.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.locator('#horas-plan')).toBeVisible()
    expect(pregunta).toContain('de la semana del 01/11')
    expect(borradas).toEqual(['2026-11-01'])

    // Y se vuelve a la de ahora.
    await page.getByRole('button', { name: 'Volver a esta semana' }).click()
    await expect(page.getByTestId('horas-semana')).toContainText('Semana del 08/11')
    await expect(page.getByRole('button', { name: 'Volver a esta semana' })).toHaveCount(0)
    await expect.poll(() => pedidas.at(-1)).toBe(null)
  })

  test('una semana sin plan lo dice y deja pegarlo', async ({ page }) => {
    await page.setViewportSize(ORDENADOR)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      const week = new URL(route.request().url()).searchParams.get('week')
      return json(week ? { hay: false, semana: week } : plan('2026-11-08'))(route)
    })
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS()))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Cómo vamos · NORTE/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await expect(page.getByText('No hay ningún plan guardado de NORTE de la semana del 25/10.')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('#horas-plan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0)
  })

  test('pegado el plan de otra semana, un botón lleva a esa semana', async ({ page }) => {
    await page.setViewportSize(ORDENADOR)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const pedidas = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      const week = new URL(route.request().url()).searchParams.get('week')
      pedidas.push(week)
      return json(week === '2026-11-01' ? plan('2026-11-01') : { hay: false, semana: '2026-11-08' })(route)
    })
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      return json(ANALISIS({ semana_del_plan: '2026-11-01', guardado: b.guardar !== false }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect(page.getByText('Este plan es de la semana del 01/11, no de esta.')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Ver la semana del 01/11' }).click()
    await expect(page.getByTestId('horas-semana')).toContainText('Semana del 01/11')
    await expect.poll(() => pedidas.at(-1)).toBe('2026-11-01')
    await expect(page.getByText(/no de esta\./)).toHaveCount(0)
  })
})

test.describe('Horas en el móvil (H1)', () => {
  test('en el móvil, una tarjeta por conductor con lo que le queda y su estado a la vista', async ({ page }) => {
    await page.setViewportSize(MOVIL)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json(plan('2026-11-08')))
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS()))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    const tarjetas = page.getByTestId('horas-tarjetas')
    await expect(tarjetas).toBeVisible({ timeout: 15000 })
    await expect(page.locator('table')).toHaveCount(0)
    await expect(tarjetas.locator('li')).toHaveCount(3)
    // El estado («Pasado») y lo que le queda, dentro de la pantalla sin deslizar.
    const pasado = tarjetas.getByText('Pasado', { exact: true })
    await expect(pasado).toBeVisible()
    const caja = await pasado.boundingBox()
    expect(caja.x + caja.width).toBeLessThanOrEqual(MOVIL.width)
    const queda = tarjetas.locator('li').first().getByText('−2h 30m')
    await expect(queda).toBeVisible()
    const cq = await queda.boundingBox()
    expect(cq.x + cq.width).toBeLessThanOrEqual(MOVIL.width)
    expect(await sinDesborde(page)).toBe(true)
    // Las flechas de semana se aciertan con el dedo.
    const flecha = await page.getByRole('button', { name: 'Semana anterior' }).boundingBox()
    expect(flecha.height).toBeGreaterThanOrEqual(DEDO)
    // La jornada larga se ve al tocar la tarjeta.
    await expect(page.getByText('Jornadas de 10 h o más: riesgo, no incumplimiento')).toHaveCount(0)
    await tarjetas.locator('li').first().getByRole('button').click()
    await expect(page.getByText('Jornadas de 10 h o más: riesgo, no incumplimiento')).toBeVisible()
  })

  test('en el ordenador sigue la tabla', async ({ page }) => {
    await page.setViewportSize(ORDENADOR)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json(plan('2026-11-08')))
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS()))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('horas-tarjetas')).toHaveCount(0)
    await expect(page.getByText('Pasado', { exact: true })).toBeVisible()
  })
})

// ── DNR diaria ────────────────────────────────────────────────────────────────
const fila = (tid, nombre, extra) => ({
  transporter_id: tid, driver_name: nombre, driver_id: nombre ? `d-${tid}` : null, dnr_total: 3, defectos: 2, limpias: 1,
  sin_clasificar: 0, euros: 61.4, euros_defectos: 48.9, rts: 1, pod_fails: 0, cc_fails: 0, de_baja: false,
  sin_ficha: false, ficha_sin_vincular: false, solo_historial: false, verif: 'coincide',
  detalle: [
    { tracking_id: `TBA${tid}1`, fecha_concesion: '2026-11-09', fecha_entrega: '2026-11-09', dsc: 'Y',
      scan: 'DELIVERED_TO_DOORSTEP', valor: '€38.90', valor_eur: 38.9, cp: '15701' },
  ],
  ...extra,
})
const DIARIOS = {
  conductores: [
    fila('A07K7Q2M07R4T9', 'PABLO MARTÍNEZ SOUTO DE LA IGLESIA'),
    fila('A03K7Q2M03R4T9', 'MARÍA FERNÁNDEZ RUIZ', { defectos: 1, euros_defectos: 21.4 }),
    fila('A3F97QW8E2LZ77', '', { defectos: 0, euros_defectos: 0, ficha_sin_vincular: true, verif: undefined }),
  ],
  totales: { dnr_total: 9, defectos: 5, limpias: 3, sin_clasificar: 1, euros: 184.2, euros_defectos: 119.2 },
  por_semana: [], dias_con_datos: ['2026-11-09'], sin_nombre: ['A3F97QW8E2LZ77'], vinculables: 1,
  disponible: { primer_dia: '2026-08-01', ultimo_dia: '2026-11-09' },
}
const DRIVERS = [{ id: 'd1', name: 'PABLO MARTÍNEZ SOUTO DE LA IGLESIA', center: 'NORTE', active: true },
  { id: 'd2', name: 'MARÍA FERNÁNDEZ RUIZ', center: 'NORTE', active: true }]

/* `rutas`: las de cada prueba, DESPUÉS de la API simulada (Playwright prueba primero
   la última que se registra). */
async function abrirDnr(page, { centros = ['NORTE', 'SUR'], tam = ORDENADOR, rutas = null } = {}) {
  await page.setViewportSize(tam)
  await entrarComoAdmin(page, { centros })
  await simularApi(page, 'vacio')
  if (rutas) await rutas()
  const pedidas = []
  await page.route(/\/api\/diarios\/conductores/, (route) => {
    const u = new URL(route.request().url()).searchParams
    pedidas.push({ center: u.get('center'), desde: u.get('desde'), hasta: u.get('hasta') })
    return json(DIARIOS)(route)
  })
  await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
  await page.goto('/panel/diarios', { waitUntil: 'domcontentloaded' })
  return pedidas
}

const masDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

test.describe('DNR diaria · tanda 2', () => {
  test('con «Todos», un botón por centro ahí mismo (H5)', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await page.addInitScript(() => localStorage.setItem('panel_center', 'Todos'))
    await simularApi(page, 'vacio')
    await page.route(/\/api\/diarios\/conductores/, json(DIARIOS))
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    await page.goto('/panel/diarios', { waitUntil: 'domcontentloaded' })
    const elegir = page.getByTestId('elegir-centro')
    await expect(elegir).toBeVisible({ timeout: 15000 })
    await expect(elegir.getByText('Elige un centro para ver sus DNR.')).toBeVisible()
    await elegir.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.getByRole('heading', { name: /DNR diaria · SUR/ })).toBeVisible()
  })

  test('‹ › pasan de semana (H1)', async ({ page }) => {
    const pedidas = await abrirDnr(page)
    await expect(page.getByText('MARÍA FERNÁNDEZ RUIZ').first()).toBeVisible({ timeout: 15000 })
    const primera = pedidas.at(-1)
    await page.getByRole('button', { name: 'Semana siguiente' }).click()
    await expect.poll(() => pedidas.at(-1).desde).toBe(masDias(primera.desde, 7))
    expect(pedidas.at(-1).hasta).toBe(masDias(primera.desde, 13))
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await expect.poll(() => pedidas.at(-1).desde).toBe(masDias(primera.desde, -7))
  })

  test('la previa de la subida dice de qué centro es cada fichero y, al guardar, ofrece ir allí (H3)', async ({ page }) => {
    const subidas = []
    const rutas = () => page.route(/\/api\/diarios\/subir/, (route) => {
      // subirDiarios solo manda el campo `confirmar` al guardar.
      const guardar = /name="confirmar"/.test(route.request().postData() || '')
      subidas.push(guardar)
      return json({
        guardado: guardar, ficheros: 2, con_error: 0, primer_dia: '2026-11-06', ultimo_dia: '2026-11-07',
        totales: { reportes: 2, dnr: 5, otras: 3, resumen: 4 },
        resultados: [
          { fichero: 'sur-1.html', centro: 'SUR', fecha_reporte: '2026-11-08', fecha_dnr: '2026-11-06', dnr: 3, rts: 1,
            pod: 1, cc: 1, conductores: 2, descuadres: 0, sin_clasificar: 0, avisos: [], aviso_sin_clasificar: null, guardado: guardar },
          { fichero: 'sur-2.html', centro: 'SUR', fecha_reporte: '2026-11-09', fecha_dnr: '2026-11-07', dnr: 2, rts: 0,
            pod: 0, cc: 0, conductores: 2, descuadres: 0, sin_clasificar: 0, avisos: [], aviso_sin_clasificar: null, guardado: guardar },
        ],
      })(route)
    })
    await abrirDnr(page, { rutas })
    await expect(page.getByRole('button', { name: 'Subir Daily Report' })).toBeVisible({ timeout: 15000 })
    await page.locator('input[type=file][accept=".html,.htm"]').setInputFiles([
      { name: 'sur-1.html', mimeType: 'text/html', buffer: Buffer.from('<h1>ES TDSL SUR Daily Report</h1>') },
      { name: 'sur-2.html', mimeType: 'text/html', buffer: Buffer.from('<h1>ES TDSL SUR Daily Report</h1>') },
    ])
    await expect(page.getByText('Estos ficheros son de SUR, no de NORTE: se guardarán en SUR.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('columnheader', { name: 'Centro' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'SUR', exact: true })).toHaveCount(2)
    await page.getByRole('button', { name: 'Guardar 2 reportes' }).click()
    await expect(page.getByText('2 reportes guardados en SUR: 5 DNR y 3 filas de RTS, POD y contacto.')).toBeVisible({ timeout: 15000 })
    expect(subidas).toEqual([false, true])
    await page.getByRole('button', { name: 'Ir a SUR' }).click()
    await expect(page.getByRole('heading', { name: /DNR diaria · SUR/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ir a SUR' })).toHaveCount(0)
  })

  test('los ficheros del centro elegido no llevan aviso ni «Ir a»', async ({ page }) => {
    const rutas = () => page.route(/\/api\/diarios\/subir/, json({
      guardado: true, ficheros: 1, con_error: 0, primer_dia: '2026-11-06', ultimo_dia: '2026-11-06',
      totales: { reportes: 1, dnr: 3, otras: 0, resumen: 2 },
      resultados: [{ fichero: 'norte.html', centro: 'NORTE', fecha_reporte: '2026-11-08', fecha_dnr: '2026-11-06', dnr: 3,
        rts: 0, pod: 0, cc: 0, conductores: 2, descuadres: 0, sin_clasificar: 0, avisos: [], aviso_sin_clasificar: null, guardado: true }],
    }))
    await abrirDnr(page, { rutas })
    await expect(page.getByRole('button', { name: 'Subir Daily Report' })).toBeVisible({ timeout: 15000 })
    await page.locator('input[type=file][accept=".html,.htm"]').setInputFiles({ name: 'norte.html', mimeType: 'text/html',
      buffer: Buffer.from('<h1>ES TDSL NORTE Daily Report</h1>') })
    await expect(page.getByRole('cell', { name: 'NORTE', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/no de NORTE/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Guardar 1 reportes' }).click()
    await expect(page.getByText(/1 reportes guardados en NORTE/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /^Ir a / })).toHaveCount(0)
  })

  test('la previa del pegado dice su centro y, al guardar, ofrece ir allí (H3)', async ({ page }) => {
    const rutas = () => page.route(/\/api\/diarios\/pegar/, (route) => {
      const b = route.request().postDataJSON()
      return json({ center: 'SUR', fecha_reporte: '2026-11-08', fecha_dnr: '2026-11-06', semana: '2026-11-01',
        conductores: 4, filas_dnr: 6, descuadres: [], dnr_resumen: 6, dnr_detalle: 6, avisos: [],
        ...(b.confirmar ? { guardado: true, dnr_guardados: 6, clasificados_ahora: 0 } : {}) })(route)
    })
    await abrirDnr(page, { rutas })
    await page.getByRole('button', { name: 'Pegar', exact: true }).click()
    await page.getByPlaceholder('Pega aquí el reporte entero').fill('ES TDSL SUR Daily Report\nA1\t1\t2\t0\t0')
    await page.getByRole('button', { name: 'Ver qué va a entrar' }).click()
    await expect(page.getByText('Este reporte es de SUR, no de NORTE: se guardará en SUR.')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Guardar 6 filas' }).click()
    await expect(page.getByText('Guardado en SUR: 6 filas DNR del 2026-11-06')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Ir a SUR' }).click()
    await expect(page.getByRole('heading', { name: /DNR diaria · SUR/ })).toBeVisible()
  })

  test('«no es él» pasa a ser un icono discreto y sin género, con la misma función (H4)', async ({ page }) => {
    const asignaciones = []
    const rutas = () => page.route(/\/api\/diarios\/id-conductor/, (route) => {
      asignaciones.push(route.request().postDataJSON())
      return json({ ok: true, driver_name: 'MARÍA FERNÁNDEZ RUIZ', quitado_a: [] })(route)
    })
    await abrirDnr(page, { rutas })
    await expect(page.getByText('MARÍA FERNÁNDEZ RUIZ').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/no es él/i)).toHaveCount(0)
    const iconos = page.getByRole('button', { name: '¿No es esta persona? Cambiarla' })
    // Solo en las filas que tienen nombre (2 de 3).
    await expect(iconos).toHaveCount(2)
    await iconos.first().click()
    const quien = page.locator('select').filter({ has: page.locator('option', { hasText: '¿quién es en realidad?' }) })
    await expect(quien).toBeVisible()
    await quien.selectOption('d2')
    await expect.poll(() => asignaciones.length).toBe(1)
    expect(asignaciones[0]).toMatchObject({ transporter_id: 'A07K7Q2M07R4T9', driver_id: 'd2' })
  })

  test('en el móvil, una tarjeta por conductor con € que puntúan, defectos y DNR (H1)', async ({ page }) => {
    await abrirDnr(page, { tam: MOVIL })
    const tarjetas = page.getByTestId('dnr-tarjetas')
    await expect(tarjetas).toBeVisible({ timeout: 15000 })
    await expect(page.locator('table')).toHaveCount(0)
    const primera = tarjetas.locator('li').first()
    await expect(primera.getByText('PABLO MARTÍNEZ SOUTO DE LA IGLESIA')).toBeVisible()
    await expect(primera.getByText('2 defectos')).toBeVisible()
    await expect(primera.getByText('· 3 DNR')).toBeVisible()
    const euros = primera.getByText(/49\s*€/)
    await expect(euros).toBeVisible()
    const ce = await euros.boundingBox()
    expect(ce.x + ce.width).toBeLessThanOrEqual(MOVIL.width)
    expect(await sinDesborde(page)).toBe(true)
    // El de sin nombre, con su «¿quién es?» a la vista y a tamaño de dedo.
    const quien = tarjetas.getByLabel('¿Quién es A3F97QW8E2LZ77?')
    await expect(quien).toBeVisible()
    expect((await quien.boundingBox()).height).toBeGreaterThanOrEqual(DEDO)
    // «¿No es esta persona?» no está en cada tarjeta: solo al abrirla.
    await expect(page.getByRole('button', { name: /No es esta persona/ })).toHaveCount(0)
    await primera.getByRole('button').first().click()
    await expect(primera.getByText('RTS')).toBeVisible()
    await expect(primera.getByText('TBAA07K7Q2M07R4T91 · doorstep')).toBeVisible()
    const cambiar = primera.getByRole('button', { name: '¿No es esta persona? Cambiarla' })
    await expect(cambiar).toBeVisible()
    expect((await cambiar.boundingBox()).height).toBeGreaterThanOrEqual(DEDO)
    // Las flechas de semana, a tamaño de dedo y sin sacar nada de la pantalla.
    const flecha = await page.getByRole('button', { name: 'Semana siguiente' }).boundingBox()
    expect(flecha.height).toBeGreaterThanOrEqual(DEDO)
    expect(flecha.x + flecha.width).toBeLessThanOrEqual(MOVIL.width)
  })
})
