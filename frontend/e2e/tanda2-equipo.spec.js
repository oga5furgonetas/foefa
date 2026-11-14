/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 2, ZONA «EQUIPO» (11-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md), con la API simulada:
   · E1 (equipo-9): Conductores en el móvil. La cabecera salta de línea (buscador a todo el ancho; «Importar» y
     «Móviles personales» dentro de «Más»), el aviso de las claves no queda a una palabra por línea, nada se sale de
     la pantalla y en vez de la tabla hay una tarjeta por conductor con su centro, el teléfono a un toque y lo que le
     falta. En el ordenador, la tabla y los botones de siempre.
   · E2 (equipo-7): filtros de un toque encima de la lista: «sin centro», «sin correo», «sin ID de reparto» (solo si
     la empresa usa la DNR o las horas) y «sin acceso» (solo si se sabe quién tiene cuenta), con cuántos.
   · E3 (portal_inicio-7, la web): bajo «Hacer la auditoría», «Hoy: 1234 ABC» o «Enviada hoy»; «hoy no sales» y
     «suspendido» siguen mandando. */

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

const alto = (loc) => loc.evaluate((el) => el.offsetHeight)
// La previa de la contraseña temporal común (GET /auth/driver-accounts/generar/previa), bien calculada.
const PREVIA = { actualizadas: 2, naves: { NORTE: 1, SUR: 1 }, respetadas: 1, sin_email: 1, cuentas_inactivas: 0, sin_centro_fuera: 0 }
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const CONDUCTORES = [
  { id: 'd1', name: 'ANTONIO GARCÍA LÓPEZ', center: 'NORTE', active: true, email: 'antonio@ejemplo.es', phone: '612345678', transporter_id: 'A1B2C3D4E5F6G7' },
  { id: 'd2', name: 'MIGUEL ÁNGEL TORRES BLANCO', center: 'SUR', active: true, email: '', phone: '+34 655 902 317', transporter_id: '' },
  { id: 'd3', name: 'NURIA DÍAZ VARELA', center: 'NORTE', active: true, email: 'nuria@ejemplo.es', phone: '', transporter_id: '' },
  { id: 'd4', name: 'ESTELA ALEN LAGE', center: '', active: true, email: 'estela@ejemplo.es', phone: '699210334', transporter_id: 'Z9Y8X7W6V5U4T3' },
]
// Con cuenta: d1 y d4. Sin acceso: d2 y d3.
const CUENTAS = [{ driver_id: 'd1', email: 'antonio@ejemplo.es' }, { driver_id: 'd4', email: 'estela@ejemplo.es' }]
// Un nombre corriente que no cabe en una línea a 390 px (36 letras), con la ficha completa y su cuenta.
const LARGO = { id: 'd5', name: 'MARÍA DEL CARMEN FERNÁNDEZ RODRÍGUEZ', center: 'SUR', active: true, email: 'maria@ejemplo.es',
  phone: '611222333', transporter_id: 'M1N2O3P4Q5R6S7', contrato: 'empresa' }

// Las siete columnas por las que se ordena, en el orden de la cabecera de la tabla (tercera revisión, M1).
const SIETE = ['Nombre', 'Centro', 'Alojamiento', 'Teléfono', 'Correo', 'Contrato', 'Nivel']
// Fichas con contrato, nivel y alojamiento, para ordenar por lo que la tarjeta no enseña. Por nivel no hay empates.
const CON_DATOS = [
  { id: 'a1', name: 'BEATRIZ RUIZ MORA', center: 'NORTE', active: true, email: 'beatriz@ejemplo.es', phone: '611000001',
    contrato: 'ett', nivel: 'L2', alojamiento: 'Piso de empresa, Calle Mayor 12' },
  { id: 'a2', name: 'CARLOS PEÑA SOTO', center: 'SUR', active: true, email: '', phone: '611000002', contrato: 'empresa', nivel: 'pleno' },
  { id: 'a3', name: 'ANTONIO GARCÍA LÓPEZ', center: 'NORTE', active: true, email: 'antonio@ejemplo.es', phone: '611000003', nivel: 'L1' },
  { id: 'a4', name: 'DAVID ORTEGA VIDAL', center: 'SUR', active: true, email: 'david@ejemplo.es', phone: '', contrato: 'ett' },
  { id: 'a5', name: 'ELENA CASTRO RÍOS', center: 'NORTE', active: true, email: 'elena@ejemplo.es', phone: '611000005',
    contrato: 'empresa', nivel: 'L3', alojamiento: 'Hostal' },
]
// Un correo y un alojamiento de los que no caben en una línea a 360 px.
const CORREO_LARGO = { id: 'a6', name: 'FRANCISCO JAVIER MORENO', center: 'SUR', active: true, phone: '611000006',
  email: 'franciscojavier.moreno.delgado.recursoshumanos@transportes-y-logistica-del-norte.es',
  alojamiento: 'Apartamento compartido de la empresa, Avenida de la Constitución 145, escalera B, 3.º izquierda, Getafe' }

// `antes`: rutas propias de una prueba que tienen que estar antes de abrir la pantalla (la previa se pide al montarla);
// van después de las de aquí, así que mandan sobre ellas (la de una previa que falla a propósito, por ejemplo).
// `idioma`: el del panel (entrarComoAdmin lo deja en español). `lista`: los conductores, si no son los de siempre.
// `opciones`: abre «Más opciones» (las dos contraseñas van plegadas desde el 14-11-2026, ARREGLOS-5 N1).
async function conductores(page, { modulos, cuentasFallan = false, mas = [], antes, idioma, lista = CONDUCTORES, opciones = false } = {}) {
  await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
  await page.addInitScript((l) => {
    localStorage.setItem('panel_center', 'Todos')
    if (l) localStorage.setItem('flota_lang', l)
  }, idioma || '')
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, json([...lista, ...mas]))
  await page.route(/\/api\/auth\/driver-accounts\/contrasena-inicial/, json({ definida: true, desde: '2026-10-29T10:00:00Z', por: 'DANIEL MARTÍN' }))
  // La previa de verdad (tercera revisión, M2): antes se simulaba en /driver-accounts/previa, que no es la ruta que pide
  // el panel, y todas las pruebas trabajaban sin querer con la previa fallida.
  await page.route(/\/api\/auth\/driver-accounts\/generar\/previa/, json(PREVIA))
  await page.route(/\/api\/auth\/driver-accounts(\?|$)/, cuentasFallan ? json({ detail: 'x' }, 500)
    : json([...CUENTAS, ...mas.map((d) => ({ driver_id: d.id, email: d.email }))]))
  if (modulos !== undefined) await page.route(/\/api\/org\/billing/, json({ plan: 'pro', status: 'active', modulos }))
  if (antes) await antes()
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(lista[0].name, { exact: true })).toBeVisible({ timeout: 15000 })
  // El <main> del panel entra con una animación de 0,3 s con `transform`: mientras dura, lo `fixed` de dentro se coloca
  // respecto al <main> y no a la pantalla. Antes de medir nada, que acabe (como `abrir()` en tanda2-dia.spec.js).
  await page.locator('main.animate-fade-in').first()
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))))
  if (opciones) await page.getByTestId('mas-opciones').click()
}

test.describe('E1 · Conductores en el móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('la cabecera cabe, «Más» guarda Importar y Móviles, y hay una tarjeta por conductor', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { mas: [LARGO] })
    // Nada se sale de la pantalla: sin desplazamiento de lado en toda la página.
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
    // Buscador a todo el ancho (o casi): más que los 224 px de antes.
    const buscador = page.getByPlaceholder('Buscar conductor…')
    expect(await buscador.evaluate((el) => el.offsetWidth)).toBeGreaterThan(300)
    // Importar y Móviles no están a la vista: van en «Más».
    await expect(page.getByRole('button', { name: 'Importar Excel' })).toHaveCount(0)
    const mas = page.getByRole('button', { name: 'Más', exact: true })
    await expect(mas).toBeVisible()
    // Medidas sin la animación de entrada de la cabecera (escala un 0,5 % mientras entra): las de la maqueta.
    expect(await alto(mas)).toBeGreaterThanOrEqual(44)
    await mas.click()
    await expect(page.getByRole('menuitem', { name: 'Importar Excel' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Móviles personales' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Importar Excel' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    // Una tarjeta por conductor, no la tabla.
    await expect(page.locator('table')).toHaveCount(0)
    const tarjetas = page.getByRole('list', { name: 'Conductores' }).getByRole('listitem')
    await expect(tarjetas).toHaveCount(5)
    // Los nombres largos se leen enteros en su tarjeta, no cortados con «…» a 390 px: el de 26 letras en una línea y el
    // de 36 («MARÍA DEL CARMEN FERNÁNDEZ RODRÍGUEZ»), en dos (revisión de la tanda 2, T23/T26).
    const entero = (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1
    expect(await page.getByText('MIGUEL ÁNGEL TORRES BLANCO').evaluate(entero)).toBe(true)
    const largo = page.getByText(LARGO.name, { exact: true })
    expect(await largo.evaluate(entero)).toBe(true)
    const lineas = await largo.evaluate((el) => Math.round(el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight)))
    expect(lineas).toBe(2)
    // Teléfono a un toque, con el número tal cual para marcar.
    const llamar = page.getByRole('link', { name: 'Llamar 612 345 678' })
    await expect(llamar).toHaveAttribute('href', 'tel:612345678')
    expect(await alto(llamar)).toBeGreaterThanOrEqual(44)
    expect(await llamar.evaluate((el) => el.offsetWidth)).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('link', { name: /^Llamar .*655 902 317/ })).toHaveAttribute('href', 'tel:+34655902317')
    // Sin teléfono: lo dice y no hay enlace.
    const nuria = tarjetas.filter({ hasText: 'NURIA DÍAZ VARELA' })
    await expect(nuria.getByText('sin teléfono')).toBeVisible()
    await expect(nuria.getByRole('link')).toHaveCount(0)
    // Lo que le falta, en la tarjeta: a Miguel Ángel, correo, ID de reparto y acceso.
    const miguel = tarjetas.filter({ hasText: 'MIGUEL ÁNGEL TORRES BLANCO' })
    for (const f of ['sin correo', 'sin ID de reparto', 'sin acceso']) await expect(miguel.getByText(f, { exact: true })).toBeVisible()
    await expect(tarjetas.filter({ hasText: 'ANTONIO GARCÍA LÓPEZ' }).getByText(/^sin /)).toHaveCount(0)
    // Tocar la tarjeta abre la ficha.
    await miguel.getByRole('button').first().click()
    await expect(page.getByRole('button', { name: /Editar/ }).first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el aviso de las claves no queda a una palabra por línea', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { opciones: true })
    const texto = page.getByText(/Contraseña temporal común: se aplica a/)
    await expect(texto).toBeVisible()
    // Con la previa de verdad (tercera revisión, M2) el aviso lleva también «· 1 sin correo», y aun así no se aplasta.
    await expect(texto).toContainText('1 sin correo')
    // Antes medía unos 60 px de ancho (una palabra por línea); ahora casi toda la tarjeta.
    expect(await texto.evaluate((el) => el.offsetWidth)).toBeGreaterThan(220)
    const inicial = page.getByText(/Contraseña inicial de los conductores nuevos/)
    expect(await inicial.evaluate((el) => el.offsetWidth)).toBeGreaterThan(220)
    const boton = page.getByRole('button', { name: 'Establecer contraseña temporal común' })
    expect(await alto(boton)).toBeGreaterThanOrEqual(44)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  // Revisión de la tanda 2, T24: también los pasos de menos uso de los avisos de claves miden 44 en el móvil.
  test('cambiar la contraseña inicial y poner la temporal: todo lo que se toca mide 44', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { opciones: true })
    await page.getByRole('button', { name: 'Cambiarla' }).click()
    expect(await alto(page.getByRole('button', { name: 'Guardar' }))).toBeGreaterThanOrEqual(44)
    expect(await alto(page.getByRole('button', { name: 'Cancelar' }))).toBeGreaterThanOrEqual(44)
    // Y los campos donde se escribe la clave (segunda revisión, U5).
    expect(await alto(page.getByLabel('Contraseña inicial de los conductores nuevos'))).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    // Con la previa de verdad (tercera revisión, M2), el botón dice a cuántos y se puede pulsar: se mide el de uso real.
    await expect(page.getByRole('button', { name: 'Aplicar contraseña temporal a 2' })).toBeEnabled()
    expect(await alto(page.getByRole('button', { name: /^Aplicar contraseña temporal/ }))).toBeGreaterThanOrEqual(44)
    expect(await alto(page.getByRole('button', { name: 'Dejarlo como está' }))).toBeGreaterThanOrEqual(44)
    const casilla = page.locator('label').filter({ hasText: 'Cambiársela también a quien ya se ha puesto la suya' })
    expect(await alto(casilla)).toBeGreaterThanOrEqual(44)
    expect(await alto(page.getByPlaceholder('Escribe la contraseña temporal'))).toBeGreaterThanOrEqual(44)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  // Segunda revisión de la tanda 2, U5: si la previa falla, «Reintentar» es lo único que deja seguir; también de 44.
  test('si no se puede calcular a quién afecta, «Reintentar» mide 44 y vuelve a pedirlo', async ({ page }) => {
    let veces = 0
    await conductores(page, { antes: () => page.route(/\/api\/auth\/driver-accounts\/generar\/previa/, (route) => {
      veces += 1
      return veces === 1 ? json({ detail: 'x' }, 500)(route) : json(PREVIA)(route)
    }), opciones: true })
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const reintentar = page.getByRole('button', { name: 'Reintentar' })
    await expect(reintentar).toBeVisible()
    await expect(page.getByRole('button', { name: /^Aplicar contraseña temporal/ })).toBeDisabled()
    expect(await alto(reintentar)).toBeGreaterThanOrEqual(44)
    await reintentar.click()
    await expect(page.getByRole('button', { name: 'Aplicar contraseña temporal a 2' })).toBeEnabled()
  })

  // Segunda revisión de la tanda 2, U7: los avisos se pintan una sola vez; girar el móvil no los vacía.
  test('al girar el móvil, la clave a medio escribir y el resultado de aplicarla siguen ahí', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { opciones: true, antes: async () => {
      await page.route(/\/api\/auth\/driver-accounts\/generar(\?|$)/, json({ actualizadas: 2, sin_email: 1, cuentas_inactivas: 0,
        aviso: 'A 1 que ya tenía la suya se le ha respetado.' }))
    } })
    await page.getByRole('button', { name: 'Establecer contraseña temporal común' }).click()
    const clave = page.getByPlaceholder('Escribe la contraseña temporal')
    await clave.fill('Temporal2026')
    // En horizontal pasa de 640 px (lo de `sm`) y vuelve: la confirmación y lo escrito, intactos.
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(clave).toHaveValue('Temporal2026')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(clave).toHaveValue('Temporal2026')
    await page.getByRole('button', { name: 'Aplicar contraseña temporal a 2' }).click()
    const hecho = page.getByText('2 conductores ya tienen acceso temporal')
    await expect(hecho).toBeVisible()
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(hecho).toBeVisible()
    await expect(page.getByText('1 se han quedado fuera por no tener correo', { exact: false })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(hecho).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  // Revisión de la tanda 2, T25: con las tarjetas no hay cabecera que tocar; se ordena con el selector, como en la tabla.
  test('se puede ordenar por centro y darle la vuelta', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { mas: [LARGO] })
    const tarjetas = page.getByRole('list', { name: 'Conductores' }).getByRole('listitem')
    const primero = () => tarjetas.first().getByRole('button').first()
    // Por nombre, de la A a la Z (lo de siempre).
    await expect(primero()).toContainText('ANTONIO GARCÍA LÓPEZ')
    const selector = page.getByLabel('Ordenar por')
    expect(await alto(selector)).toBeGreaterThanOrEqual(44)
    // Por las columnas de la tabla, como antes de las tarjetas (tercera revisión, M1); las que no tiene ninguna ficha
    // (aquí, alojamiento y nivel) no se pintan ni se ofrecen (14-11-2026, ARREGLOS-5 N1).
    expect(await selector.locator('option').allTextContents()).toEqual(SIETE.filter((c) => !['Alojamiento', 'Nivel'].includes(c)))
    await selector.selectOption('center')
    // Por centro: primero la que no tiene (vacío), luego NORTE (Antonio, Nuria) y SUR (Miguel Ángel, María del Carmen).
    await expect(primero()).toContainText('ESTELA ALEN LAGE')
    await expect(tarjetas.nth(1)).toContainText('NORTE')
    await expect(tarjetas.nth(4)).toContainText('SUR')
    const vuelta = page.getByRole('button', { name: 'De la A a la Z' })
    expect(await alto(vuelta)).toBeGreaterThanOrEqual(44)
    await vuelta.click()
    await expect(page.getByRole('button', { name: 'De la Z a la A' })).toBeVisible()
    await expect(tarjetas.first()).toContainText('SUR')
    await expect(tarjetas.last()).toContainText('ESTELA ALEN LAGE')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  // Segunda revisión de la tanda 2, U6: con el panel en otro idioma, la barra de orden y la pestaña corta, traducidas.
  test('en inglés, el selector de orden y la pestaña corta van en inglés', async ({ page }) => {
    await conductores(page, { idioma: 'en' })
    const selector = page.getByLabel('Sort by')
    await expect(selector).toBeVisible()
    // Sin alojamiento, contrato ni nivel en ninguna ficha, esas columnas no se pintan ni se ofrecen (14-11-2026, N1).
    expect(await selector.locator('option').allTextContents())
      .toEqual(['Name', 'Site', 'Phone', 'Email'])
    await expect(page.getByRole('button', { name: 'A to Z' })).toHaveAttribute('title', 'Reverse the order')
    await expect(page.getByRole('button', { name: 'Duplicates', exact: true })).toBeVisible()
  })

  // Revisión de la tanda 2, T27: al abrir Conductores en el móvil se ve algún conductor sin bajar, y las pestañas caben
  // en una línea. Desde el 14-11-2026 (ARREGLOS-5 N1) los avisos de contraseñas van plegados en «Más opciones», a un
  // toque: montados (no se pierde lo escrito), pero sin ocupar sitio hasta que se abren.
  test('al abrir se ve la lista sin bajar; los avisos de claves, plegados en «Más opciones»', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    const lista = page.getByRole('list', { name: 'Conductores' })
    const aviso = page.getByText(/Contraseña inicial de los conductores nuevos/)
    await expect(aviso).toBeAttached()
    await expect(aviso).toBeHidden()
    const mas = page.getByTestId('mas-opciones')
    await expect(mas).toHaveAttribute('aria-expanded', 'false')
    expect(await alto(mas)).toBeGreaterThanOrEqual(44)
    // La primera tarjeta, entera dentro de la pantalla y por encima de la barra fija de abajo del panel.
    const caja = await lista.getByRole('listitem').first().evaluate((el) => {
      const barra = document.querySelector('nav.fixed.bottom-0')
      return { abajo: el.getBoundingClientRect().bottom, limite: barra ? barra.getBoundingClientRect().top : window.innerHeight }
    })
    expect(caja.abajo).toBeLessThanOrEqual(caja.limite)
    // Las tres pestañas en una sola línea y enteras dentro de la pantalla (en el móvil, «Ranking» y «Duplicadas»).
    const pestanas = [page.getByRole('button', { name: 'Conductores', exact: true }),
      page.getByRole('button', { name: 'Ranking', exact: true }), page.getByRole('button', { name: 'Duplicadas', exact: true })]
    for (const p of pestanas) {
      expect(await alto(p)).toBeLessThanOrEqual(46)
      expect(await p.evaluate((el) => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 0.5
        && el.parentElement.scrollWidth <= el.parentElement.clientWidth)).toBe(true)
    }
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
    // A un toque: se abren encima de la lista, y se recuerda abierto en este navegador.
    await mas.click()
    await expect(aviso).toBeVisible()
    await expect(mas).toHaveAttribute('aria-expanded', 'true')
    expect(await lista.evaluate((ul, av) => av.getBoundingClientRect().bottom <= ul.getBoundingClientRect().top,
      await aviso.elementHandle())).toBe(true)
    await page.reload()
    await expect(page.getByText(/Contraseña inicial de los conductores nuevos/)).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* Tercera revisión de la tanda 2, M1: en el móvil se ordena por las siete columnas, como cuando se deslizaba la tabla.
     Por lo que la tarjeta no enseña (contrato, nivel, correo, alojamiento), la tarjeta lo enseña; el orden, el de la
     tabla del ordenador con los mismos datos. */
  const leerTarjetas = (page) => page.getByRole('list', { name: 'Conductores' }).getByRole('listitem').evaluateAll((lis) => lis.map((li) => ({
    nombre: li.querySelector('button span span').textContent.trim(),
    dato: li.querySelector('[data-testid="dato-orden"]')?.textContent.replace(/^·\s*/, '').trim() ?? null,
  })))
  // Las filas de la tabla: nombre y el texto de la celda de la columna (Contrato es la 7.ª celda, Nivel la 8.ª).
  const leerTabla = (page, celda) => page.locator('table tbody tr').evaluateAll((trs, i) => trs.map((tr) => ({
    nombre: tr.cells[1].textContent.trim(), dato: tr.cells[i].textContent.trim(),
  })), celda)

  for (const [valor, opcion, celda, esperado] of [
    ['contrato', 'Contrato', 6, [['ANTONIO GARCÍA LÓPEZ', '—'], ['CARLOS PEÑA SOTO', 'Empresa'], ['ELENA CASTRO RÍOS', 'Empresa'],
      ['BEATRIZ RUIZ MORA', 'ETT'], ['DAVID ORTEGA VIDAL', 'ETT']]],
    ['nivel', 'Nivel', 7, [['DAVID ORTEGA VIDAL', '—'], ['ANTONIO GARCÍA LÓPEZ', 'L1'], ['BEATRIZ RUIZ MORA', 'L2'],
      ['ELENA CASTRO RÍOS', 'L3'], ['CARLOS PEÑA SOTO', 'Pleno']]],
  ]) {
    test(`por ${valor}: cada tarjeta lo enseña y el orden es el de la tabla del ordenador`, async ({ page }) => {
      const fallos = vigilar(page)
      await conductores(page, { lista: CON_DATOS })
      const selector = page.getByLabel('Ordenar por')
      expect(await selector.locator('option').allTextContents()).toEqual(SIETE)
      // Por nombre (lo de siempre), la tarjeta no enseña ni contrato ni nivel.
      await expect(page.getByTestId('dato-orden')).toHaveCount(0)
      await selector.selectOption({ label: opcion })
      await expect(page.getByTestId('dato-orden')).toHaveCount(5)
      const movil = await leerTarjetas(page)
      expect(movil.map((f) => [f.nombre, f.dato])).toEqual(esperado)
      // La etiqueta, la misma que en la tabla y con su color, no un texto suelto.
      if (valor === 'contrato') await expect(page.getByTestId('dato-orden').filter({ hasText: 'ETT' }).first()).toHaveClass(/bg-purple-500/)
      // Al revés, justo al revés (sin empates por nivel; por contrato, los grupos al revés).
      await page.getByRole('button', { name: 'De la A a la Z' }).click()
      await expect(page.getByRole('button', { name: 'De la Z a la A' })).toBeVisible()
      const alReves = await leerTarjetas(page)
      expect(alReves.map((f) => f.dato)).toEqual([...esperado].reverse().map((e) => e[1]))
      // Al volver a «Nombre», la tarjeta queda como siempre.
      await selector.selectOption({ label: 'Nombre' })
      await expect(page.getByTestId('dato-orden')).toHaveCount(0)
      await expect(page.getByRole('list', { name: 'Conductores' }).getByRole('listitem').first()).toContainText('ANTONIO GARCÍA LÓPEZ')
      // La tabla del ordenador con los mismos datos, ordenada tocando su cabecera: el mismo orden y los mismos textos.
      await page.setViewportSize({ width: 1440, height: 900 })
      await expect(page.locator('table')).toHaveCount(1)
      await page.getByRole('columnheader', { name: opcion }).getByRole('button').click()
      await expect(page.getByRole('columnheader', { name: opcion })).toContainText('▲')
      expect(await leerTabla(page, celda)).toEqual(movil)
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })
  }

  test('por correo y por alojamiento, a 360 px un dato largo no saca la tarjeta de la pantalla', async ({ page }) => {
    const fallos = vigilar(page)
    await page.setViewportSize({ width: 360, height: 780 })
    await conductores(page, { lista: CON_DATOS, mas: [CORREO_LARGO] })
    const selector = page.getByLabel('Ordenar por')
    const tarjetas = page.getByRole('list', { name: 'Conductores' }).getByRole('listitem')
    const largo = tarjetas.filter({ hasText: CORREO_LARGO.name })
    // Nada más ancho que la pantalla, y nada de dentro de una tarjeta pasa de su borde derecho.
    const cabe = () => page.evaluate(() => {
      const fuera = [...document.querySelectorAll('ul[aria-label="Conductores"] li')].filter((li) => li.scrollWidth > li.clientWidth
        || [...li.querySelectorAll('*')].some((el) => el.getBoundingClientRect().right > li.getBoundingClientRect().right + 0.5))
      return { doc: document.documentElement.scrollWidth, ventana: window.innerWidth, fuera: fuera.length }
    })
    await selector.selectOption({ label: 'Correo' })
    // El correo entero (en el texto y en el `title`), partido en líneas dentro de la tarjeta.
    const correo = largo.getByTestId('dato-orden')
    await expect(correo).toHaveText(`· ${CORREO_LARGO.email}`)
    await expect(correo).toHaveAttribute('title', `Correo: ${CORREO_LARGO.email}`)
    let medida = await cabe()
    expect(medida.doc).toBeLessThanOrEqual(medida.ventana)
    expect(medida.fuera).toBe(0)
    // Quien no tiene correo, «—».
    await expect(tarjetas.filter({ hasText: 'CARLOS PEÑA SOTO' }).getByTestId('dato-orden')).toHaveText('—')
    // El botón de llamar sigue de 44 al lado del correo largo.
    const llamar = largo.getByRole('link', { name: /^Llamar/ })
    await expect(llamar).toBeVisible()
    expect(await alto(llamar)).toBeGreaterThanOrEqual(44)
    expect(await llamar.evaluate((el) => el.offsetWidth)).toBeGreaterThanOrEqual(44)

    await selector.selectOption({ label: 'Alojamiento' })
    const aloj = largo.getByTestId('dato-orden')
    await expect(aloj).toHaveAttribute('title', `Alojamiento: ${CORREO_LARGO.alojamiento}`)
    // Dos líneas como mucho: la tarjeta sigue siendo cómoda.
    const lineas = await aloj.evaluate((el) => Math.round(el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight)))
    expect(lineas).toBeLessThanOrEqual(2)
    medida = await cabe()
    expect(medida.doc).toBeLessThanOrEqual(medida.ventana)
    expect(medida.fuera).toBe(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('E1 · Conductores en el ordenador, como antes', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

  test('la tabla y los botones de siempre, sin «Más»', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { opciones: true })
    await expect(page.locator('table')).toHaveCount(1)
    await expect(page.getByRole('columnheader', { name: /Teléfono/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importar Excel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Móviles personales' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeHidden()
    // El buscador, del ancho de antes (224 px).
    expect(await page.getByPlaceholder('Buscar conductor…').evaluate((el) => el.offsetWidth)).toBe(224)
    // Los avisos de claves (abiertos en «Más opciones»), encima de la tabla; el selector de orden del móvil no está.
    const aviso = page.getByText(/Contraseña inicial de los conductores nuevos/)
    await expect(aviso).toBeVisible()
    expect(await page.locator('table').evaluate((tb, av) => !!(tb.compareDocumentPosition(av) & Node.DOCUMENT_POSITION_PRECEDING),
      await aviso.elementHandle())).toBe(true)
    // Y encima también en la pantalla (el `order-last` del móvil no llega al ordenador).
    expect(await page.locator('table').evaluate((tb, av) => av.getBoundingClientRect().bottom <= tb.getBoundingClientRect().top,
      await aviso.elementHandle())).toBe(true)
    await expect(page.getByLabel('Ordenar por')).toHaveCount(0)
    // Las pestañas, con su nombre entero.
    await expect(page.getByRole('button', { name: 'Ranking conductores', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fichas duplicadas', exact: true })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('E2 · filtros de un toque', () => {
  test('cuentan y filtran: sin centro, sin correo, sin ID de reparto y sin acceso', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page)
    const grupo = page.getByRole('group', { name: 'Fichas incompletas' })
    await expect(grupo.getByRole('button', { name: 'sin centro (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin correo (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (2)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: 'sin acceso (2)' })).toBeVisible()

    const nombres = ['ANTONIO GARCÍA LÓPEZ', 'MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA', 'ESTELA ALEN LAGE']
    const seVen = async (quien) => {
      for (const n of nombres) {
        if (quien.includes(n)) await expect(page.getByText(n, { exact: true })).toBeVisible()
        else await expect(page.getByText(n, { exact: true })).toHaveCount(0)
      }
    }
    await grupo.getByRole('button', { name: 'sin ID de reparto (2)' }).click()
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (2)' })).toHaveAttribute('aria-pressed', 'true')
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA'])
    await expect(page.getByText('2 conductores · pulsa')).toBeVisible()
    await grupo.getByRole('button', { name: 'sin centro (1)' }).click()
    await seVen(['ESTELA ALEN LAGE'])
    await grupo.getByRole('button', { name: 'sin correo (1)' }).click()
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO'])
    await grupo.getByRole('button', { name: 'sin acceso (2)' }).click()
    await seVen(['MIGUEL ÁNGEL TORRES BLANCO', 'NURIA DÍAZ VARELA'])
    // Tocarlo otra vez lo quita.
    await grupo.getByRole('button', { name: 'sin acceso (2)' }).click()
    await seVen(nombres)
    // Y con el buscador, cuentan sobre lo que queda.
    await page.getByPlaceholder('Buscar conductor…').fill('nuria')
    await expect(grupo.getByRole('button', { name: 'sin ID de reparto (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /sin correo/ })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin DNR ni horas no sale «sin ID de reparto»; sin la lista de cuentas no sale «sin acceso»', async ({ page }) => {
    const fallos = vigilar(page)
    await conductores(page, { modulos: ['vehiculos', 'conductores', 'revision'], cuentasFallan: true })
    const grupo = page.getByRole('group', { name: 'Fichas incompletas' })
    await expect(grupo.getByRole('button', { name: 'sin correo (1)' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /sin ID de reparto/ })).toHaveCount(0)
    await expect(grupo.getByRole('button', { name: /sin acceso/ })).toHaveCount(0)
    expect(fallos.filter((f) => !/500/.test(f)), fallos.join(' | ')).toHaveLength(0)
  })
})

/* E3 · el portal web del conductor. */
async function portal(page, { asignada, vehiculosPortal } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'LAURA SÁNCHEZ GIL', exp })}.firma`
  await page.addInitScript((tk) => {
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'LAURA SÁNCHEZ GIL', center: 'NORTE' }))
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
  }, token)
  await simularApi(page, 'vacio')
  const pedidas = []
  // `asignada` puede ser una función: así la respuesta cambia a mitad de prueba (la auditoría ya mandada).
  await page.route(/\/api\/auth\/me\/assigned-vehicle/, (route) => {
    pedidas.push(1)
    return json(typeof asignada === 'function' ? asignada() : asignada)(route)
  })
  await page.route(/\/api\/vehicles\/portal/, json(vehiculosPortal || { vehicles: [], puede_auditar: true, motivo: null }))
  await page.route(/\/api\/portal\/mi-ficha/, json({ falta_telefono: false, tiene_clave: true, configurar_cuenta: false }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Hacer la auditoría', { exact: true })).toBeVisible({ timeout: 15000 })
  return pedidas
}
const FURGO = { id: 'v4', license_plate: '3056 MBF' }
const opcion = (page) => page.getByRole('button', { name: /Hacer la auditoría/ })

test.describe('E3 · la furgoneta de hoy en el portal del conductor', () => {
  test('con furgoneta asignada dice «Hoy: matrícula» y se puede abrir', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: false },
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Hoy: 3056 MBF')
    await expect(opcion(page)).toBeEnabled()
    // Todavía por hacer: la opción principal, en el color de marca.
    await expect(opcion(page)).toHaveClass(/\bbg-brand-500\b/)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('ya enviada: «Enviada hoy» con la matrícula, en el tono de las demás y aún se puede abrir', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: true },
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Enviada hoy · 3056 MBF')
    // Revisión de la tanda 2, T30: ya no grita «hazla» en turquesa; sigue abriéndose por si hay que repetirla.
    await expect(opcion(page)).not.toHaveClass(/\bbg-brand-500\b/)
    await expect(opcion(page)).toHaveClass(/\bbg-dark-900\b/)
    await expect(opcion(page)).toBeEnabled()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin furgoneta asignada (o sin respuesta), el texto de siempre', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: false, vehicle: null } })
    await expect(opcion(page)).toContainText('Antes de salir a ruta')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('«hoy no sales» y «suspendido» siguen mandando', async ({ page }) => {
    const fallos = vigilar(page)
    await portal(page, { asignada: { assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: false },
      vehiculosPortal: { vehicles: [], puede_auditar: false, motivo: 'no_en_ruta' } })
    await expect(opcion(page)).toContainText('Hoy no sales a ruta')
    await expect(opcion(page)).not.toContainText('3056 MBF')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* Revisión de la tanda 2, T3: contar llamadas no valía, porque la propia auditoría (InspectionFlow) también pide
     assigned-vehicle al abrirse. Ahora el servidor simulado pasa a «ya enviada» mientras se está en la auditoría, y al
     volver el inicio tiene que decirlo: solo pasa si el inicio vuelve a preguntar al volver. */
  test('tras enviar la auditoría y volver al inicio, sale «Enviada hoy»', async ({ page }) => {
    const fallos = vigilar(page)
    const estado = { enviada: false }
    await portal(page, { asignada: () => ({ assigned: true, vehicle: FURGO, center: 'NORTE', already_inspected: estado.enviada }),
      vehiculosPortal: { vehicles: [FURGO], puede_auditar: true, motivo: null } })
    await expect(opcion(page)).toContainText('Hoy: 3056 MBF')
    await opcion(page).click()
    const volver = page.getByRole('button', { name: /Volver|Atrás/ }).first()
    await expect(volver).toBeVisible()
    estado.enviada = true
    await volver.click()
    await expect(opcion(page)).toContainText('Enviada hoy · 3056 MBF')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
