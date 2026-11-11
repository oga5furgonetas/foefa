/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ARREGLOS DE HORAS Y DE LA SUBIDA DE LA DNR (10-11-2026), de
   docs/REVISION-FLOTA-PROPIA-10-11.md: horas_dnr-1, -2, -3 y el «de paso» de la DNR. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

const conductor = (nombre, trabajado, extra) => ({
  nombre, trabajado, planificado: 0, bloques: [], dias_trabajados: 5, margen_semanal: 3270 - trabajado,
  supera_semanal: false, pasara_hoy: false, cerrado: trabajado, al_limite: false, trabajando_ahora: false,
  riesgo_diario: [], bloques_pasados: [], incumple_propio: false, cuadra: true, trabajado_origen: 'portal', ...extra,
})

const ANALISIS = (extra) => ({
  centro: 'NORTE', semana_del_plan: '2026-11-08', guardado: true, aviso_guardado: null, otra_nave: null,
  pegado_en: new Date().toISOString(), pegado_hoy: true,
  whc: { conductores_con_actividad: 2, excepciones: null, excepciones_conocidas: false, porcentaje: null,
    tier: null, coste_por_excepcion: 50 },
  whc_propio: { conductores: 2, incumplen: 0, por_semanal: 0, por_bloque: 0, porcentaje: 100,
    limite_semanal_min: 3270, limite_bloque_min: 660, quien: [] },
  ritmo: { dia_semana: 3, dia_leido_del_plan: true, bloques_ref: 3, horas_ref_min: 1620, pasados: 0, peligro: 1,
    justos: 0, en_ruta_ahora: 1, avisos: [
      { nombre: 'ANA PÉREZ', trabajado: 3300, estado: 'peligro', exceso: 300, proyeccion: 3300,
        proyeccion_pasa: true, bloques: 6, bloques_leidos: 6, bloques_hechos: 6, bloques_restantes: 0, trabajando_ahora: true },
    ] },
  conductores: [
    conductor('ANA PÉREZ', 3300, { pasara_hoy: true, cerrado: 2800, trabajando_ahora: true }),
    conductor('SARA VIDAL', 1620, {}),
  ],
  resumen: { total: 2, superan: 0, pasaran_hoy: 1, bloque_pasado: 0, incumplen_propio: 0, al_limite: 0,
    con_riesgo_diario: 0, no_cuadran: 0 },
  aviso_diario: 'Los bloques largos son un aviso de riesgo, no un incumplimiento.',
  ...extra,
})

/* Hace dos días de CALENDARIO, a las 9:00 (S10, 11-11-2026). Restando 48 h, el martes
   siguiente al cambio de hora de marzo, entre las 0:00 y la 1:00, caía en el sábado. */
const haceDosDias = () => {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  d.setHours(9, 0, 0, 0)
  return d
}

const ESTADO = { semana_en_curso: '2026-11-08', faltan: [], como_se_arregla: '',
  naves: [{ centro: 'NORTE', semana: '2026-11-08', al_dia: true, conductores: 2, semanas_atras: 0 }] }
const TEXTO = 'ANA PÉREZ\n55h 00m / 60h\n'.repeat(4)

test.describe('Horas · arreglos del 10-11-2026', () => {
  test('al abrir, el plan guardado se analiza sin guardar y dice cuándo se pegó', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const pegado = haceDosDias().toISOString()
    const cuerpos = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-11-08', week: '2026-11-08', texto: TEXTO,
      excepciones: null, pegado_en: pegado, updated_at: pegado }))
    await page.route(/\/api\/whc\/analizar/, (route) => {
      cuerpos.push(route.request().postDataJSON())
      // Como el servidor: con guardar=false no guarda y el plan no es de hoy.
      return json(ANALISIS({ guardado: false, pegado_en: pegado, pegado_hoy: false }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Cómo vamos · NORTE/)).toBeVisible({ timeout: 15000 })
    expect(cuerpos).toHaveLength(1)
    expect(cuerpos[0].guardar).toBe(false)
    await expect(page.getByText(/Pegado el \S+ a las 9:00 \(hace 2 días\)/)).toBeVisible()
    // Lo de «hoy» y «ahora» no se presenta como de hoy.
    await expect(page.getByText('Se pasa hoy si acaba', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Se pasaba si acababa \(/)).toBeVisible()
    await expect(page.getByText('A quién mirar hoy')).toHaveCount(0)
    await expect(page.locator('span[title="En ruta ahora"]')).toHaveCount(0)
    // Y no es un pegado que se haya quedado sin guardar.
    await expect(page.getByText(/Analizado pero/)).toHaveCount(0)
  })

  test('el plan de otra nave no se guarda en la elegida y se puede mandar a la suya', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const centros = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: false, semana: '2026-11-08' }))
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      centros.push(b.center)
      if (b.center === 'SUR') return json(ANALISIS({ centro: 'SUR' }))(route)
      return json(ANALISIS({ guardado: false, otra_nave: { centro: 'SUR', por: 'cabecera' },
        aviso_guardado: 'Este plan es de SUR y tienes elegida NORTE, así que no se ha guardado.' }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect(page.getByText('Este plan es de SUR y tienes elegido el centro NORTE.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('No se ha guardado este pegado.')).toHaveCount(0)
    await page.getByRole('button', { name: 'Guardarlo en SUR' }).click()
    await expect(page.getByText(/Guardado en SUR/)).toBeVisible()
    expect(centros).toEqual(['NORTE', 'SUR'])
  })

  test('al cambiar de nave se vacía la casilla de excepciones', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      const nave = new URL(route.request().url()).searchParams.get('center')
      return json(nave === 'NORTE'
        ? { hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: 2, updated_at: new Date().toISOString() }
        : { hay: false, semana: '2026-11-08' })(route)
    })
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS({ guardado: false })))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#horas-excepciones')).toHaveValue('2', { timeout: 15000 })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(page.locator('#horas-plan')).toBeVisible()
    await expect(page.locator('#horas-excepciones')).toHaveValue('')
  })

  /* R47 (11-11-2026): el caso de verdad. Sin plan al abrir, se pega el de la
     semana pasada, se guarda, y «Borrar» borra ESA semana, no la en curso. */
  test('un plan de otra semana lo dice, y «Borrar» borra esa semana', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const borrados = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      if (route.request().method() === 'DELETE') {
        borrados.push(new URL(route.request().url()).searchParams.get('week'))
        return json({ ok: true, borrados: 1, semana: '2026-11-01' })(route)
      }
      return json({ hay: false, semana: '2026-11-08' })(route)
    })
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS({ guardado: true, semana_del_plan: '2026-11-01' })))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect(page.getByText('Este plan es de la semana del 01/11, no de esta.')).toBeVisible({ timeout: 15000 })
    let pregunta = ''
    page.once('dialog', (d) => { pregunta = d.message(); d.accept() })
    await page.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.locator('#horas-plan')).toBeVisible()
    expect(pregunta).toContain('de la semana del 01/11')
    expect(borrados).toEqual(['2026-11-01'])
  })

  test('con el plan de esta semana no sale el aviso de otra semana', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: null,
      updated_at: new Date().toISOString() }))
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS({ guardado: false })))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Cómo vamos · NORTE/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/no de esta\./)).toHaveCount(0)
    await expect(page.getByText(/Pegado hoy a las/)).toBeVisible()
    await expect(page.getByText('Se pasa hoy si acaba', { exact: true })).toBeVisible()
  })
})

/* REVISIÓN DEL 11-11-2026 (R8/R12, R9/R10, R11, R44, R45, R46). */
test.describe('Horas · revisión del 11-11-2026', () => {
  test('un plan de otro centro guardado aquí antes: lo dice y ofrece quitarlo, no guardarlo encima', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const hace2 = haceDosDias()
    const borrados = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      if (route.request().method() === 'DELETE') {
        const u = new URL(route.request().url()).searchParams
        borrados.push([u.get('center'), u.get('week')])
        return json({ ok: true, borrados: 1, semana: '2026-11-08' })(route)
      }
      return json({ hay: true, semana: '2026-11-08', week: '2026-11-08', texto: TEXTO, excepciones: null,
        pegado_en: hace2.toISOString(), updated_at: hace2.toISOString() })(route)
    })
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS({ guardado: false, es_el_guardado: true,
      otra_nave: { centro: 'SUR', por: 'cabecera' }, pegado_en: hace2.toISOString(), pegado_hoy: false,
      aviso_guardado: 'El plan guardado en el centro NORTE parece de SUR. Bórralo y pega en NORTE el suyo.' })))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('El plan guardado en NORTE parece de SUR.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/No se ha guardado/)).toHaveCount(0)
    await expect(page.getByText(/Pegado hoy/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardarlo en SUR' })).toHaveCount(0)
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Quitarlo de NORTE' }).click()
    await expect(page.locator('#horas-plan')).toBeVisible()
    expect(borrados).toEqual([['NORTE', '2026-11-08']])
  })

  test('«Guardarlo en SUR» no se lleva las excepciones, pregunta antes de pisar y no deja «Borrar» a la vista', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const cuerpos = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: 2,
      updated_at: new Date().toISOString() }))
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      cuerpos.push(b)
      if (b.guardar === false) return json(ANALISIS({ guardado: false }))(route)
      if (b.center === 'SUR' && b.sustituir === false) {
        return json(ANALISIS({ centro: 'SUR', guardado: false,
          ya_hay_plan: { pegado_en: new Date().toISOString(), n_conductores: 40 },
          aviso_guardado: 'El centro SUR ya tiene otro plan de esa semana (40 conductores), así que no se ha sustituido.' }))(route)
      }
      if (b.center === 'SUR') return json(ANALISIS({ centro: 'SUR' }))(route)
      return json(ANALISIS({ guardado: false, otra_nave: { centro: 'SUR', por: 'cabecera' },
        aviso_guardado: 'Este plan es de SUR y tienes elegido el centro NORTE, así que no se ha guardado.' }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#horas-excepciones')).toHaveValue('2', { timeout: 15000 })
    await page.getByRole('button', { name: 'Pegar uno nuevo' }).click()
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect(page.getByText('Este plan es de SUR y tienes elegido el centro NORTE.')).toBeVisible({ timeout: 15000 })
    // R11: lo que se ve no es el plan guardado de NORTE: ni «Borrar» ni «guardado …».
    await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0)
    await expect(page.getByText(/^guardado /)).toHaveCount(0)
    // Por la cabecera no hay «de todas formas».
    await expect(page.getByRole('button', { name: /de todas formas/ })).toHaveCount(0)
    let pregunta = ''
    page.once('dialog', (d) => { pregunta = d.message(); d.accept() })
    await page.getByRole('button', { name: 'Guardarlo en SUR' }).click()
    await expect(page.getByText(/Guardado en SUR/)).toBeVisible({ timeout: 15000 })
    expect(pregunta).toContain('SUR ya tiene otro plan de esa semana')
    expect(pregunta).toContain('40 conductores')
    const aSur = cuerpos.filter((b) => b.center === 'SUR')
    expect(aSur.map((b) => b.sustituir)).toEqual([false, true])
    // R9/R10: las 2 excepciones son de NORTE, no viajan a SUR.
    expect(aSur.every((b) => !('excepciones' in b))).toBe(true)
    await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0)
  })

  test('si lo dicen solo las fichas, se puede guardar en el centro elegido de todas formas', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const cuerpos = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: false, semana: '2026-11-08' }))
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      cuerpos.push(b)
      if (b.ignorar_fichas) return json(ANALISIS())(route)
      return json(ANALISIS({ guardado: false, otra_nave: { centro: 'SUR', por: 'fichas', casan_alli: 6, casan_aqui: 1 } }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect(page.getByText(/Lo dicen las fichas: 6 de sus conductores son de SUR/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Guardarlo en NORTE de todas formas' }).click()
    await expect(page.getByRole('button', { name: 'Borrar' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/tienes elegido el centro/)).toHaveCount(0)
    expect(cuerpos[1]).toMatchObject({ center: 'NORTE', ignorar_fichas: true })
  })

  test('la respuesta que llega después de cambiar de centro se descarta', async ({ page }) => {
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, (route) => {
      const nave = new URL(route.request().url()).searchParams.get('center')
      return json(nave === 'NORTE'
        ? { hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: null, updated_at: new Date().toISOString() }
        : { hay: false, semana: '2026-11-08' })(route)
    })
    /* S12 (11-11-2026): la respuesta de NORTE se retiene hasta DESPUÉS de cambiar a
       SUR, sin esperas fijas. Con 2 s de espera, en una máquina cargada llegaba
       antes del clic y la prueba pasaba sin probar nada. */
    let soltar
    const suelta = new Promise((ok) => { soltar = ok })
    await page.route(/\/api\/whc\/analizar/, async (route) => {
      await suelta
      return json(ANALISIS({ guardado: false }))(route)
    })
    const terminada = page.waitForEvent('requestfinished',
      { predicate: (r) => /\/api\/whc\/analizar/.test(r.url()), timeout: 15000 })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await page.waitForRequest(/\/api\/whc\/analizar/, { timeout: 15000 })
    // Ya en SUR: la pantalla ha pedido el plan de SUR (lo hace al cambiar de centro).
    const planSur = page.waitForRequest((r) => /\/api\/whc\/plan/.test(r.url())
      && new URL(r.url()).searchParams.get('center') === 'SUR', { timeout: 15000 })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await planSur
    soltar()
    await terminada
    // Una vuelta del navegador (un fotograma y una tarea) para que la respuesta se procese.
    await page.evaluate(() => new Promise((ok) => { requestAnimationFrame(() => setTimeout(ok, 0)) }))
    await expect(page.getByText(/Cómo vamos/)).toHaveCount(0)
    await expect(page.locator('#horas-plan')).toBeVisible()
  })

  test('la línea «Pegado el…» no se parte en dos columnas', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const hace2 = haceDosDias()
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: null,
      pegado_en: hace2.toISOString(), updated_at: hace2.toISOString() }))
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS({ guardado: false, pegado_en: hace2.toISOString(), pegado_hoy: false })))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    const nota = page.getByText('· lo de «en ruta» es de ese momento, no de ahora')
    await expect(nota).toBeVisible({ timeout: 15000 })
    const caja = await nota.evaluate((s) => {
      const p = s.parentElement.getBoundingClientRect()
      const r = s.getBoundingClientRect()
      const lh = parseFloat(getComputedStyle(s).lineHeight) || 20
      return { izq: r.left - p.left, alto: r.height, lh }
    })
    // O cabe en el mismo renglón (escritorio) o baja entera al siguiente (móvil).
    expect(caja.izq < 2 || caja.alto < caja.lh * 1.5).toBe(true)
  })
})

/* SEGUNDA REVISIÓN DEL 11-11-2026 (S9): la casilla vaciada al recalcular quita la cifra. */
test.describe('Horas · segunda revisión del 11-11-2026', () => {
  test('«Recalcular» con la casilla vaciada manda null; un pegado nuevo con la casilla vacía no manda nada', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const cuerpos = []
    await page.route(/\/api\/whc\/estado/, json(ESTADO))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-11-08', texto: TEXTO, excepciones: 2,
      updated_at: new Date().toISOString() }))
    await page.route(/\/api\/whc\/analizar/, (route) => {
      const b = route.request().postDataJSON()
      cuerpos.push(b)
      return json(ANALISIS({ guardado: b.guardar !== false }))(route)
    })
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#horas-excepciones')).toHaveValue('2', { timeout: 15000 })
    const recalcular = page.getByRole('button', { name: 'Recalcular' })
    await expect(recalcular).toBeEnabled({ timeout: 15000 })
    // La casilla vaciada a propósito: null, que en el servidor quita la cifra.
    await page.locator('#horas-excepciones').fill('')
    await recalcular.click()
    await expect.poll(() => cuerpos.length).toBe(2)
    expect(cuerpos[1]).toHaveProperty('excepciones', null)
    expect(cuerpos[1].guardar).toBeUndefined()
    // Con una cifra, la cifra (como siempre).
    await expect(recalcular).toBeEnabled({ timeout: 15000 })
    await page.locator('#horas-excepciones').fill('1')
    await recalcular.click()
    await expect.poll(() => cuerpos.length).toBe(3)
    expect(cuerpos[2].excepciones).toBe(1)
    // Un pegado nuevo con la casilla vacía no manda la clave: se conserva la del plan.
    await expect(recalcular).toBeEnabled({ timeout: 15000 })
    await page.locator('#horas-excepciones').fill('')
    await page.getByRole('button', { name: 'Pegar uno nuevo' }).click()
    await page.locator('#horas-plan').fill(TEXTO)
    await page.getByRole('button', { name: 'Ver cómo vamos' }).click()
    await expect.poll(() => cuerpos.length).toBe(4)
    expect('excepciones' in cuerpos[3]).toBe(false)
  })
})

test.describe('DNR diaria · la previa de la subida', () => {
  test('avisa de lo que viene sin clasificar con su texto de verdad', async ({ page }) => {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const AVISO = 'Los 3 DNR del 2026-11-06 vienen sin clasificar (ninguno con DSC = Y). Amazon suele tardar 2-4 días en clasificarlos.'
    await page.route(/\/api\/diarios\/subir/, json({
      guardado: false, ficheros: 1, con_error: 0, primer_dia: '2026-11-06', ultimo_dia: '2026-11-06',
      totales: { reportes: 1, dnr: 3, otras: 0, resumen: 1 },
      resultados: [{ fichero: 'hoy.html', centro: 'NORTE', fecha_reporte: '2026-11-08', fecha_dnr: '2026-11-06',
        dnr: 3, rts: 0, pod: 0, cc: 0, conductores: 1, descuadres: 0, sin_clasificar: 3,
        // R48 (11-11-2026): en su campo aparte, que la web vieja no lee.
        avisos: [], aviso_sin_clasificar: AVISO, guardado: false }],
    }))
    await page.goto('/panel/diarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Subir Daily Report' })).toBeVisible({ timeout: 15000 })
    await page.locator('input[type=file][accept=".html,.htm"]').setInputFiles({ name: 'hoy.html', mimeType: 'text/html',
      buffer: Buffer.from('<html><h1>ES TDSL NORTE Daily Report 2026-11-08</h1></html>') })
    await expect(page.getByText(AVISO)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('(3 sin clasif.)')).toBeVisible()
    await expect(page.getByText(/anteriores al 13-05-2026/)).toHaveCount(0)
  })
})
