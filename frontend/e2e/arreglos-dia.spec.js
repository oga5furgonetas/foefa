import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

/* Arreglos de la zona «día» (10-11-2026): Plantilla, Asignación, Checklist y la casilla del
   checklist en el Inicio. API simulada; cada caso pone encima las rutas que necesita. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const hojaDe = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`

/* EL RELOJ, PARADO (11-11-2026). La Plantilla y la Asignación miran «hoy» en el navegador; si las pruebas lo
   calculaban con el reloj real (y encima al cargar el fichero), una tanda que cruzaba la medianoche fallaba, y
   las flechas del campo de fecha daban un día que no existe los días 1 y 2 de ciertos meses. Ahora el reloj del
   navegador se para en AHORA (page.clock.setFixedTime) y las fechas de cada prueba salen de ese mismo instante:
   un 14 a mediodía (el mismo día en UTC y en hora de Madrid), y en el pasado, para que la sesión simulada de
   entrarComoAdmin (hora REAL + 1 h) nunca esté caducada para el navegador. Con el reloj parado, la primera carga
   de cada worker va más lenta si el PC está cargado (medido: de 8 a 53 s): por eso abrir() espera hasta 45 s (un
   tope, no una espera fija). */
const AHORA = new Date(2026, 9, 14, 12, 0, 0)
const elDia = (n) => { const d = new Date(AHORA); d.setDate(d.getDate() + n); return d }

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/* ── D1 · Plantilla: el borrador compartido ya no se borra sin preguntar ── */
test.describe('Plantilla · borrador compartido', () => {
  const FILA = { ruta: 'CA_A1', conductor: 'ANA PÉREZ', movil: '', furgo: '', h_llegada: '', h_bajada: '', h_salida: '', observaciones: '' }
  const borrador = (fecha) => ({ id: 'b1', revision: 1, updated_by: 'María', state: { week: '46', date: fecha, rows: [FILA] } })

  // `alLeer` (opcional): lo que contesta el servidor al sondeo de la hoja abierta (GET …/b1).
  async function abrir(page, fecha, alBorrar, alLeer) {
    await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const borrados = []
    await page.route(/\/api\/tools\/plantilla-compartida/, (route) => {
      const req = route.request()
      if (req.method() === 'DELETE') {
        const url = new URL(req.url())
        borrados.push(url.searchParams.get('preguntar') || '')
        return json(alBorrar(url))(route)
      }
      if (req.method() === 'PATCH') return json({ revision: 2, updated_by: 'Admin Test' })(route)
      if (alLeer && new URL(req.url()).pathname.endsWith('/b1')) return json(alLeer())(route)
      return json(borrador(fecha))(route)
    })
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue(fecha, { timeout: 45000 })
    return borrados
  }

  test('si otra persona la está editando, pregunta con su nombre antes de borrarla para todos', async ({ page }) => {
    const fallos = vigilar(page)
    const borrados = await abrir(page, hojaDe(elDia(0)), (url) => (url.searchParams.get('preguntar')
      ? { ok: false, editando: { nombre: 'María', minutos: 3 } } : { ok: true }))
    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toBe('La está editando María (último cambio hace 3 min). ¿Borrarla para todos?')
    // Dijo que no: la hoja sigue y no se ha borrado nada.
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toBeVisible()
    expect(borrados).toEqual(['1'])

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(borrados).toEqual(['1', '1', ''])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('si nadie más la está editando, se borra sin preguntar', async ({ page }) => {
    const borrados = await abrir(page, hojaDe(elDia(0)), () => ({ ok: true }))
    let dialogo = false
    page.on('dialog', (d) => { dialogo = true; d.dismiss() })
    await page.getByRole('button', { name: 'Nueva plantilla' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(dialogo).toBe(false)
    expect(borrados).toEqual(['1'])
  })

  test('al entrar solo en la hoja de otro día avisa, y se puede seguir con ella o empezar la de hoy', async ({ page }) => {
    const borrados = await abrir(page, '30/09/2026', () => ({ ok: true }))
    const aviso = page.getByText('Esta hoja es del 30/09')
    await expect(aviso).toBeVisible()
    await page.getByRole('button', { name: 'Seguir con ella' }).click()
    await expect(aviso).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue('30/09/2026')
    expect(borrados).toEqual([])
  })

  test('«Empezar la de hoy» cierra la hoja vieja', async ({ page }) => {
    const borrados = await abrir(page, '30/09/2026', () => ({ ok: true }))
    await page.getByRole('button', { name: 'Empezar la de hoy' }).click()
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveCount(0)
    expect(borrados).toEqual(['1'])
  })

  // Una hoja de hoy, de mañana, de pasado mañana o de dentro de unos días está hecha adrede: no avisa.
  for (const [nombre, dias] of [['hoy', 0], ['mañana', 1], ['pasado mañana', 2], ['dentro de 5 días', 5]]) {
    test(`la hoja de ${nombre} no avisa`, async ({ page }) => {
      await abrir(page, hojaDe(elDia(dias)), () => ({ ok: true }))
      await expect(page.getByRole('button', { name: 'Nueva plantilla' })).toBeVisible()
      // El aviso sale justo después de cargar la hoja: se le da un momento para que se vea si saliera.
      await page.waitForTimeout(500)
      await expect(page.getByText(/Esta hoja es del/)).toHaveCount(0)
    })
  }

  test('la hoja de ayer sí avisa', async ({ page }) => {
    const ayer = elDia(-1)
    await abrir(page, hojaDe(ayer), () => ({ ok: true }))
    await expect(page.getByText(`Esta hoja es del ${hojaDe(ayer).slice(0, 5)}`)).toBeVisible()
  })

  test('si otra persona corrige la fecha a la de hoy, el aviso se va solo', async ({ page }) => {
    let corregida = false
    await abrir(page, '30/09/2026', () => ({ ok: true }),
      () => (corregida ? { ...borrador(hojaDe(elDia(0))), revision: 2, updated_by: 'María' } : borrador('30/09/2026')))
    const aviso = page.getByText('Esta hoja es del 30/09')
    await expect(aviso).toBeVisible()
    corregida = true   // María la pone a hoy desde su equipo; llega con el sondeo de 2,5 s
    await expect(page.getByRole('textbox', { name: 'Fecha' })).toHaveValue(hojaDe(elDia(0)), { timeout: 10000 })
    await expect(aviso).toHaveCount(0)
  })
})

/* Las traducciones nuevas (10-11-2026): la hoja, con el género de cada idioma y sin frases cortadas, y en
   Asignación «centro», que es la palabra de esa pantalla (no «nave»). */
test('textos nuevos de la Plantilla y la Asignación: género, frases enteras y «centro»', () => {
  expect(DICT['pg.borrarOtro'].it).toBe('Lo sta modificando {nombre} (ultima modifica {min} min fa). Eliminarlo per tutti?')
  expect(DICT['pg.seguirConElla'].fr).toBe('Continuer avec celle-ci')
  expect(DICT['pg.empezarHoy'].de).toBe('Plan für heute beginnen')
  expect(DICT['pg.empezarHoy'].en).toBe("Start today's sheet")
  for (const clave of ['asgn.unsaved', 'asgn.unsaved.confirm', 'asgn.unsaved.lose', 'asgn.del.row', 'asgn.del.confirm', 'asgn.noop.warn']) {
    expect(Object.keys(DICT[clave]).sort(), clave).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt'])
    expect(DICT[clave].es, clave).not.toMatch(/\bnave\b/i)
  }
  expect(DICT['asgn.unsaved.confirm'].es).toContain('de día o de centro')
  expect(DICT['asgn.unsaved.confirm'].fr).toContain('de jour ou de centre')
  expect(DICT['asgn.unsaved.confirm'].it).toContain('giorno o centro')
})

/* ── D2, D3 y D4 · Asignación ── */
test.describe('Asignación · cambios sin guardar, borrar fila y furgonetas en taller', () => {
  // Del reloj parado (AHORA), no del real: la pantalla abre en este mismo día.
  const hoy = iso(elDia(0))
  const ayer = iso(elDia(-1))
  const VEHICULOS = [
    { id: 'v1', license_plate: '1234 ABC', status: 'active', center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v2', license_plate: '5678 DEF', status: 'taller', center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v3', license_plate: '9012 GHI', status: 'active', bloqueada: true, center: 'NORTE', itv_date: '2030-01-01' },
    { id: 'v4', license_plate: '3456 JKL', status: 'active', center: 'NORTE', itv_date: '2030-01-01' },
  ]
  const DRIVERS = [{ id: 'd1', name: 'Ana López', center: 'NORTE' }, { id: 'd2', name: 'Luis Gómez', center: 'NORTE' }]

  // `hoyVacio`: el día de hoy viene del servidor sin filas (ayer sigue trayendo la de v3).
  async function abrir(page, { centros = ['NORTE'], hoyVacio = false } = {}) {
    await page.clock.setFixedTime(AHORA)
    await entrarComoAdmin(page, { centros })
    await simularApi(page, 'vacio')
    const guardados = []
    await page.route(/\/api\/vehicles(\?|$)/, json(VEHICULOS))
    await page.route(/\/api\/drivers(\?|$)/, json(DRIVERS))
    await page.route(/\/api\/assignments\/daily/, (route) => {
      const req = route.request()
      if (req.method() === 'PUT') { guardados.push(req.postDataJSON()); return json({ ok: true })(route) }
      const fecha = new URL(req.url()).searchParams.get('date')
      return json({ date: fecha, slots: fecha === ayer
        ? [{ vehicle_id: 'v3', vehicle_plate: '9012 GHI', driver_id: 'd2', driver_name: 'Luis Gómez' }]
        : hoyVacio ? []
          : [{ vehicle_id: 'v1', vehicle_plate: '1234 ABC', driver_id: 'd1', driver_name: 'Ana López' }] })(route)
    })
    await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="date"]')).toHaveValue(hoy, { timeout: 45000 })
    if (hoyVacio) await expect(page.getByText('Sin cuadrante para esta fecha')).toBeVisible({ timeout: 45000 })
    else await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(1, { timeout: 45000 })
    return guardados
  }
  const matriculas = (page) => page.locator('select').filter({ has: page.locator('option', { hasText: '1234 ABC' }) })

  test('las de taller o con candado van al final, marcadas, y avisan arriba (también tras «Copiar ayer»)', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page)
    const opciones = await matriculas(page).first().locator('option').allTextContents()
    expect(opciones.slice(1)).toEqual(['1234 ABC', '3456 JKL', '5678 DEF (Taller)', '9012 GHI (Bloqueada)'])
    await expect(page.getByText('Asignadas pero en taller o bloqueadas:')).toHaveCount(0)

    await matriculas(page).first().selectOption('v2')
    await expect(page.getByRole('alert').filter({ hasText: 'Asignadas pero en taller o bloqueadas:' })).toContainText('5678 DEF (Taller)')

    // Con el cambio de arriba sin guardar, «Copiar ayer» pregunta antes de pisarlo: se le dice que sí.
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Copiar ayer' }).first().click()
    await expect(page.getByRole('alert').filter({ hasText: 'Asignadas pero en taller o bloqueadas:' })).toContainText('9012 GHI (Bloqueada)')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el botón de quitar fila se ve en el móvil y pide confirmar si la fila tiene datos', async ({ page, isMobile }) => {
    await abrir(page)
    const quitar = page.getByRole('button', { name: 'Quitar fila' })
    // En el móvil (sin ratón, pantalla estrecha) se ve siempre; con ratón, al pasar por encima.
    if (isMobile) await expect(quitar.first()).toHaveCSS('opacity', '1')
    else await expect(quitar.first()).toHaveCSS('opacity', '0')

    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await quitar.first().click()
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toBe('¿Quitar la fila de 1234 ABC · Ana López?')
    await expect(quitar).toHaveCount(1)

    // Una fila vacía se quita sin preguntar.
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(quitar).toHaveCount(2)
    let otro = false
    page.on('dialog', (d) => { otro = true; d.dismiss() })
    await quitar.last().click()
    await expect(quitar).toHaveCount(1)
    expect(otro).toBe(false)
  })

  test('marca «Cambios sin guardar» y pregunta antes de cambiar de día', async ({ page }) => {
    const guardados = await abrir(page)
    const marca = page.getByText('Cambios sin guardar')
    await expect(marca).toHaveCount(0)
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(marca).toBeVisible()

    const fecha = page.locator('input[type="date"]')
    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await fecha.fill(ayer)
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toContain('Hay cambios sin guardar')
    await expect(fecha).toHaveValue(hoy)
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(2)
    await expect(marca).toBeVisible()

    // Guardar quita la marca y ya no pregunta.
    await page.getByRole('button', { name: 'Guardar asignación' }).click()
    await expect(marca).toHaveCount(0)
    expect(guardados).toHaveLength(1)
    let otro = false
    page.on('dialog', (d) => { otro = true; d.accept() })
    await fecha.fill(ayer)
    await expect(matriculas(page).first()).toHaveValue('v3')   // la de ayer, ya cargada
    expect(otro).toBe(false)
  })

  test('pregunta antes de cambiar de nave y, si dice que no, se queda en la suya con lo que había', async ({ page }) => {
    await abrir(page, { centros: ['NORTE', 'SUR'] })
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()
    const titulo = page.getByRole('heading', { level: 1 })
    await expect(titulo).toContainText('NORTE')

    const dialogos = []
    page.once('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect.poll(() => dialogos.length).toBe(1)
    await expect(titulo).toContainText('NORTE')
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(2)
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect(titulo).toContainText('SUR')
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(1)
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0)
  })

  test('la elegida en el taller se lee entera: matrícula en el desplegable y «Taller» debajo', async ({ page }) => {
    await abrir(page)
    const primera = matriculas(page).first()
    await primera.selectOption('v2')
    // El desplegable cerrado enseña el texto de la opción elegida: solo la matrícula, que cabe.
    expect(await primera.evaluate((el) => el.options[el.selectedIndex].text)).toBe('5678 DEF')
    await expect(primera.locator('..').getByText('Taller', { exact: true })).toBeVisible()
    // En la lista de otra fila sigue marcada.
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    const otra = await matriculas(page).last().locator('option').allTextContents()
    expect(otra).toContain('5678 DEF (Taller)')
  })

  test('una fila del roster pegado con nombre o matrícula sin reconocer pide confirmar antes de quitarla', async ({ page }) => {
    await abrir(page)
    await page.getByRole('button', { name: 'Pegar roster' }).click()
    await page.getByPlaceholder(/Pega aquí el texto del roster/).fill('JUAN PEREZ\nPEPE RUIZ   7777 ZZZ')
    await page.getByRole('button', { name: /^Aplicar/ }).click()
    const quitar = page.getByRole('button', { name: 'Quitar fila' })
    await expect(quitar).toHaveCount(2)

    const dialogos = []
    page.on('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    for (const i of [0, 1]) await quitar.nth(i).click()
    await expect.poll(() => dialogos.length).toBe(2)
    expect(dialogos.sort()).toEqual(['¿Quitar la fila de 7777 ZZZ · PEPE RUIZ?', '¿Quitar la fila de JUAN PEREZ?'])
    await expect(quitar).toHaveCount(2)
  })

  test('«Recargar» y «Copiar ayer» preguntan antes de pisar los cambios sin guardar', async ({ page }) => {
    await abrir(page)
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    const marca = page.getByText('Cambios sin guardar')
    await expect(marca).toBeVisible()
    const quitar = page.getByRole('button', { name: 'Quitar fila' })

    const dialogos = []
    let respuesta = 'no'
    page.on('dialog', (d) => { dialogos.push(d.message()); return respuesta === 'si' ? d.accept() : d.dismiss() })
    await page.getByTitle('Recargar').click()
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toBe('Se perderán los cambios sin guardar. ¿Seguir?')
    await page.getByRole('button', { name: 'Copiar ayer' }).first().click()
    await expect.poll(() => dialogos.length).toBe(2)
    expect(dialogos[1]).toBe('Se perderán los cambios sin guardar. ¿Seguir?')
    // Dijo que no las dos veces: siguen sus dos filas (la de hoy y la añadida) y la marca.
    await expect(quitar).toHaveCount(2)
    await expect(matriculas(page).first()).toHaveValue('v1')
    await expect(marca).toBeVisible()

    respuesta = 'si'
    await page.getByTitle('Recargar').click()
    await expect(quitar).toHaveCount(1)
    await expect(marca).toHaveCount(0)
  })

  test('en un día que venía vacío, quitar la fila añadida no deja «Cambios sin guardar» ni pregunta al cambiar de día', async ({ page }) => {
    await abrir(page, { hoyVacio: true })
    const marca = page.getByText('Cambios sin guardar')
    const quitar = page.getByRole('button', { name: 'Quitar fila' })
    await page.getByRole('button', { name: 'Añadir fila' }).first().click()
    await expect(marca).toBeVisible()
    await quitar.click()   // la fila está vacía: se quita sin preguntar
    await expect(quitar).toHaveCount(0)
    await expect(marca).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardar asignación' })).toBeDisabled()

    let otro = false
    page.on('dialog', (d) => { otro = true; d.accept() })
    await page.locator('input[type="date"]').fill(ayer)
    await expect(matriculas(page).first()).toHaveValue('v3')   // la de ayer, cargada sin preguntar
    expect(otro).toBe(false)
  })

  test('vaciar un día que tenía filas guardadas es un cambio: queda la marca, pregunta y Guardar lo deja vacío', async ({ page }) => {
    const guardados = await abrir(page, { centros: ['NORTE', 'SUR'] })
    const marca = page.getByText('Cambios sin guardar')
    const quitar = page.getByRole('button', { name: 'Quitar fila' })
    const fecha = page.locator('input[type="date"]')
    const titulo = page.getByRole('heading', { level: 1 })
    page.once('dialog', (d) => d.accept())   // la fila tiene datos: se confirma quitarla
    await quitar.click()
    await expect(quitar).toHaveCount(0)
    await expect(marca).toBeVisible()
    const guardar = page.getByRole('button', { name: 'Guardar asignación' })
    await expect(guardar).toBeEnabled()

    // Cambiar de centro y de día pregunta; con «No» se queda todo como estaba.
    const dialogos = []
    page.on('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })
    await page.getByRole('button', { name: 'SUR', exact: true }).click()
    await expect.poll(() => dialogos.length).toBe(1)
    await expect(titulo).toContainText('NORTE')
    await fecha.fill(ayer)
    await expect.poll(() => dialogos.length).toBe(2)
    expect(dialogos.every((m) => m.includes('Hay cambios sin guardar')), dialogos.join(' | ')).toBe(true)
    await expect(fecha).toHaveValue(hoy)
    await expect(marca).toBeVisible()
    expect(guardados).toEqual([])

    // Guardar manda el día vacío y la marca se va; ya no pregunta.
    await guardar.click()
    await expect(marca).toHaveCount(0)
    expect(guardados).toEqual([{ center: 'NORTE', date: hoy, slots: [] }])
    await fecha.fill(ayer)
    await expect(matriculas(page).first()).toHaveValue('v3')
    expect(dialogos).toHaveLength(2)
  })

  test('escribir la fecha a mano con cambios pendientes no pregunta en cada tecla, sino al terminar', async ({ page }) => {
    await abrir(page)
    await page.getByRole('button', { name: 'Añadir fila' }).click()
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()
    const fecha = page.locator('input[type="date"]')
    const dialogos = []
    page.on('dialog', (d) => { dialogos.push(d.message()); d.dismiss() })

    await fecha.focus()
    // Baja un día (o un mes) en la parte que tiene el foco: desde el 14 de octubre del reloj parado, las dos
    // flechas siempre dan una fecha que existe (con el reloj real, un día 1 o 2 bajaba al 31 o al 30, que en
    // ciertos meses no existe, y el campo se quedaba en blanco).
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(fecha).not.toHaveValue(hoy)
    await expect(fecha).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)   // una fecha que existe, no el campo en blanco
    await page.waitForTimeout(300)
    expect(dialogos).toHaveLength(0)

    await page.keyboard.press('Enter')   // ahora sí: se aplica, y se pregunta una vez
    await expect.poll(() => dialogos.length).toBe(1)
    expect(dialogos[0]).toContain('Hay cambios sin guardar')
    await expect(fecha).toHaveValue(hoy)
    await expect(page.getByRole('button', { name: 'Quitar fila' })).toHaveCount(2)
    await page.waitForTimeout(300)
    expect(dialogos).toHaveLength(1)
  })
})

/* ── D5 · Checklist: «Enviar cierre» manda la nave ── */
test('Checklist · «Enviar cierre» pide solo el de su nave', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const turno = (shift) => ({ id: shift, center: 'NORTE', shift, items: [{ id: 't1', text: 'Abrir nave', done: true }, { id: 't2', text: 'Llaves', done: false }] })
  await page.route(/\/api\/checklist(\?|$)/, json({ manana: turno('manana'), tarde: turno('tarde') }))
  const pedidos = []
  await page.route(/\/api\/checklist\/enviar-resumen/, (route) => {
    pedidos.push(route.request().postDataJSON())
    return json({ enviados: [{ center: 'NORTE', hechas: 1, total: 2, faltan: 1 }] })(route)
  })
  await page.goto('/panel/checklist-operativo', { waitUntil: 'domcontentloaded' })
  const mensajes = []
  page.on('dialog', (d) => { mensajes.push(d.message()); d.accept() })
  await page.getByRole('button', { name: 'Enviar cierre' }).click({ timeout: 15000 })
  await expect.poll(() => mensajes.length).toBe(1)
  expect(pedidos).toHaveLength(1)
  expect(pedidos[0]).toMatchObject({ shift: 'manana', center: 'NORTE' })
  expect(mensajes[0]).toContain('Resumen enviado: NORTE 1/2')
})

/* ── D6 · Inicio: la casilla del checklist enseña el turno que toca ── */
test.describe('Inicio · casilla del checklist', () => {
  async function abrirA(page, hora) {
    // AYER a esa hora, no hoy: la sesión simulada caduca una hora después de AHORA (api-simulada.js), y a
    // las 9:00 o las 17:00 de hoy, según cuándo se lancen las pruebas, ya estaría caducada y se iría al login.
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(hora, 0, 0, 0)
    await page.clock.setFixedTime(d)
    await entrarComoAdmin(page)
    await simularApi(page, 'lleno')
    await page.route(/\/api\/stats\/hoy/, json({
      dia: iso(d), salidas: { total: 0, revisadas: 0, lista: [] }, revision: { hechas: 0, flota: 2 },
      checklist: [{ turno: 'manana', hechas: 5, total: 7 }, { turno: 'tarde', hechas: 1, total: 4 }],
      golpes: { n: 0, lista: [] }, incidencias: { nuevas: 0, graves: 0 },
    }))
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    return page.getByRole('button', { name: /Checklist turno/ })
  }

  test('por la tarde enseña el turno de tarde', async ({ page }) => {
    const casilla = await abrirA(page, 17)
    await expect(casilla).toContainText('1/4', { timeout: 45000 })
  })

  test('por la mañana, el de mañana', async ({ page }) => {
    const casilla = await abrirA(page, 9)
    await expect(casilla).toContainText('5/7', { timeout: 45000 })
  })
})
