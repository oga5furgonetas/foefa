/* «Mis DNR» en el portal del conductor (11-11-2026, tanda 2, zona «dnr»). Dani: «que cuando yo suba los daily report y
   aparezcan las DNRs ellos puedan ver la DNR que le cae a ellos».

   La casilla del inicio sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404), con el número rojo
   de las nuevas desde la última vez y «Esta semana: N» debajo del nombre. La pantalla, rehecha al verla Dani («que le
   ponga "esta semana llevas 1 DNR" y cuál es, o "llevas 5"»): arriba y en grande la frase de esta semana con su número
   (singular, plural o «ninguna»), debajo cuáles son, las semanas anteriores en una línea cada una que se abre al tocarla,
   y qué es cada estado al final; con la marca de «Nueva» o «Actualizada». Sin euros.
   Y «más bonito y mejor» (Dani, 11-11-2026): cada DNR en su tarjeta con su día, su CP, su paquete y su estado, y debajo
   qué pasó (solo lo que el servidor entiende: lo que llega a null no se dice), lo que puede hacer la próxima vez si se
   sabe que no llamó o que la foto falló, el recordatorio de la preferencia de entrega siempre bajo la frase grande y
   «¿Alguna no es tuya? Díselo a la oficina.». La casilla del inicio no vuelve a pedir la ruta cada vez que se vuelve.
   API simulada y datos fijos: nada depende del día de hoy (las semanas y su orden los decide el servidor). */
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PEREZ', exp: 4102444800 })}.firma`
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const semana = (desde, hasta, dnr) => ({
  semana: desde, hasta, dnr,
  cuentan: dnr.filter((x) => x.estado === 'cuenta').length,
  no_cuentan: dnr.filter((x) => x.estado === 'no_cuenta').length,
  sin_clasificar: dnr.filter((x) => x.estado === 'sin_clasificar').length,
})
// Cómo fue la entrega, como lo manda el servidor: todas las claves, y null lo que no se entiende con seguridad.
const NADA = { cp: null, como: null, lejos: null, llamada: null, segundos: null, fallo_contacto: null, foto: null, foto_motivo: null, sin_interpretar: {} }
const dnr = (dia, paquete, estado, mas = {}) => ({ dia, paquete, estado, ...NADA, cp: '15704', ...mas })
const DATOS = {
  tiene_id: true, en_revision: false, datos_hasta: '2026-11-10',
  semanas: [
    semana('2026-11-08', '2026-11-14', [
      // Lo que no se entiende (un escaneo raro, «Contact Compliance») llega aparte y NO se enseña.
      dnr('2026-11-10', 'TBA123456789012', 'sin_clasificar', { sin_interpretar: { scan: 'DELIVERED_TO_MOON', contacto: 'Y' } }),
      dnr('2026-11-09', 'TBA123456789011', 'cuenta', {
        como: 'puerta', lejos: true, llamada: 'no', fallo_contacto: true, foto: 'mal', foto_motivo: 'borrosa' }),
    ]),
    semana('2026-11-01', '2026-11-07', [
      dnr('2026-11-04', 'TBA123456789010', 'cuenta', { como: 'buzon', lejos: false, llamada: 'si', segundos: 12, fallo_contacto: true }),
      dnr('2026-11-03', 'TBA123456789009', 'no_cuenta', { cp: null }),
    ]),
    semana('2026-10-25', '2026-10-31', []),
    semana('2026-10-18', '2026-10-24', [dnr('2026-10-20', 'TBA123456789008', 'no_cuenta')]),
  ],
}

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(m.text())) fallos.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => fallos.push(String(e.message).slice(0, 200)))
  return fallos
}

async function entrar(page, { mias = DATOS, status = 200, vistas } = {}) {
  await page.addInitScript(({ tk, vistas }) => {
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
    localStorage.setItem('cookie_consent', '1')
    // Solo la primera vez que se carga la página: lo que apunte la pantalla después no se pisa al recargar.
    if (vistas && !sessionStorage.getItem('vistas_puestas')) {
      localStorage.setItem('fds_dnr_vistas_d1', JSON.stringify(vistas))
      sessionStorage.setItem('vistas_puestas', '1')
    }
  }, { tk: TOKEN, vistas })
  await simularApi(page, 'vacio')
  const pedidas = []
  await page.route(/\/api\/diarios\/mias/, (route) => {
    pedidas.push(new URL(route.request().url()).search)
    return json(mias, status)(route)
  })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible({ timeout: 15000 })
  return pedidas
}

const casilla = (page) => page.getByRole('button', { name: /^Mis DNR/ })

// ESTA semana con las DNR que se le den (las anteriores, las de DATOS), para el singular, el plural y el «ninguna».
const conEstaSemana = (dnr) => ({ ...DATOS, semanas: [semana('2026-11-08', '2026-11-14', dnr), ...DATOS.semanas.slice(1)] })
const paquetes = (n, estado = 'cuenta', pre = 'TBA99900000000') => Array.from({ length: n }, (_, k) => dnr('2026-11-09', `${pre}${k}`, estado))

test('arriba y en grande, cuántas lleva esta semana; debajo, cuáles; las anteriores, una línea cada una; y los estados, al final', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidas = await entrar(page)
  // La casilla dice lo mismo en corto, con el número rojo de las nuevas (la primera vez, todas: nunca las ha visto).
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  await expect(casilla(page)).toContainText('5')
  await expect(casilla(page)).toHaveAccessibleName(/5 nuevas/)
  await casilla(page).click()

  const pantalla = page.getByTestId('mis-dnr')
  await expect(pantalla.getByRole('heading', { name: 'Mis DNR' })).toBeVisible()
  // 1. La frase de esta semana con su número (todas las DNR de la semana, cuenten o no), el desglose y hasta cuándo.
  const frase = pantalla.getByTestId('dnr-frase')
  await expect(frase).toHaveText('Esta semana llevas 2 DNR')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveText('2')
  await expect(pantalla.getByTestId('dnr-desglose')).toHaveText('1 te cuenta · 1 sin clasificar')
  await expect(pantalla.getByTestId('dnr-hasta')).toContainText('Reportes subidos hasta el')

  // 2. Justo debajo, cuáles son: paquete, día, estado y la marca de nueva.
  const esta = pantalla.getByTestId('dnr-esta-semana')
  const filas = esta.getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(0)).toContainText('TBA123456789012')
  await expect(filas.nth(0)).toContainText('Sin clasificar')
  await expect(filas.nth(0)).toContainText('Nueva')
  await expect(filas.nth(1)).toContainText('TBA123456789011')
  await expect(filas.nth(1)).toContainText('Te cuenta')
  await expect(pantalla.getByText('5 nuevas')).toBeVisible()

  // 3. Las anteriores, una línea por semana con su recuento, cerradas; la vacía lo dice en su línea y no se abre.
  const semanas = pantalla.getByTestId('dnr-anteriores').getByTestId('dnr-semana')
  await expect(semanas).toHaveCount(3)
  await expect(semanas.nth(0)).toContainText('La semana pasada')
  await expect(semanas.nth(0).getByTestId('dnr-recuento')).toHaveText('2 DNR')
  await expect(semanas.nth(0)).toContainText('2 nuevas')
  await expect(semanas.nth(0).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  await expect(semanas.nth(1)).toContainText(/^Del 25\/10 al 31\/10/)
  await expect(semanas.nth(1).getByTestId('dnr-recuento')).toHaveText('Ninguna')
  await expect(semanas.nth(1).getByRole('button')).toHaveCount(0)
  await expect(semanas.nth(2).getByTestId('dnr-recuento')).toHaveText('1 DNR')
  await expect(pantalla.getByTestId('dnr-fila')).toHaveCount(2)

  // 4. Qué es cada estado, al final.
  const estados = pantalla.getByTestId('dnr-estados')
  await expect(estados).toContainText('Amazon te la apunta como fallo.')
  await expect(estados).toContainText('suele tardar unos días')
  // El orden en la pantalla: la frase, cuáles son, las anteriores y los estados.
  const y = async (l) => (await l.boundingBox()).y
  expect(await y(frase)).toBeLessThan(await y(filas.first()))
  expect(await y(filas.last())).toBeLessThan(await y(semanas.first()))
  expect(await y(semanas.last())).toBeLessThan(await y(estados))
  // Sin euros, nunca.
  await expect(pantalla).not.toContainText('€')

  // Al volver, ya no hay nuevas; y al abrirla otra vez, sin marcas.
  await pantalla.getByRole('button', { name: 'Volver' }).click()
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva/)
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR')
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(0)
  // Nunca se manda nada que elija a la persona: la ruta no lleva parámetros.
  expect(pedidas.every((q) => q === '')).toBe(true)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('con una sola, en singular y sin desglose', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana(paquetes(1, 'sin_clasificar')) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 1')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 1 DNR')
  await expect(page.getByTestId('dnr-numero')).toHaveText('1')
  await expect(page.getByTestId('dnr-desglose')).toHaveCount(0)
  const filas = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(1)
  await expect(filas).toContainText('TBA999000000000')
  await expect(filas).toContainText('Sin clasificar')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('con cinco, el número y el desglose en plural', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([...paquetes(3), ...paquetes(2, 'no_cuenta', 'TBA88800000000')]) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 5')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 5 DNR')
  await expect(page.getByTestId('dnr-numero')).toHaveText('5')
  await expect(page.getByTestId('dnr-desglose')).toHaveText('3 te cuentan · 2 no te cuentan')
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(5)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin ninguna esta semana lo dice en grande, y la casilla también', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([]) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: ninguna')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana no llevas ninguna')
  await expect(page.getByTestId('dnr-numero')).toHaveCount(0)
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(0)
  await expect(page.getByTestId('dnr-hasta')).toContainText('Reportes subidos hasta el')
  // Las anteriores siguen ahí.
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-semana')).toHaveCount(3)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('una semana anterior se abre al tocarla y enseña cuáles fueron; otro toque la cierra', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const anteriores = page.getByTestId('dnr-anteriores')
  const pasada = anteriores.getByRole('button', { name: /La semana pasada/ })
  await expect(anteriores.getByTestId('dnr-fila')).toHaveCount(0)
  await pasada.click()
  await expect(pasada).toHaveAttribute('aria-expanded', 'true')
  const filas = anteriores.getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(0)).toContainText('TBA123456789010')
  await expect(filas.nth(0)).toContainText('Te cuenta')
  await expect(filas.nth(1)).toContainText('TBA123456789009')
  await expect(filas.nth(1)).toContainText('No te cuenta')
  await expect(filas.nth(1)).toContainText('Nueva')
  await pasada.click()
  await expect(pasada).toHaveAttribute('aria-expanded', 'false')
  await expect(anteriores.getByTestId('dnr-fila')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('en inglés, el singular y el plural cambian («1 DNR» / «5 DNRs»)', async ({ page }) => {
  const fallos = vigilar(page)
  await page.addInitScript(() => localStorage.setItem('fds_idioma', 'en'))
  await entrar(page, { mias: conEstaSemana(paquetes(1)) })
  const casillaEn = page.getByRole('button', { name: /^My DNRs/ })
  await expect(casillaEn.getByTestId('dnr-casilla-semana')).toHaveText('This week: 1')
  await casillaEn.click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('This week you have 1 DNR')
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento').first()).toHaveText('2 DNRs')
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento').last()).toHaveText('1 DNR')
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json(conEstaSemana(paquetes(5))))
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: /^My DNRs/ }).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('This week you have 5 DNRs')
  await expect(page.getByTestId('dnr-desglose')).toHaveText('5 count')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('lo que no había visto sale como nueva y lo que Amazon ha clasificado desde entonces, como actualizada', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { vistas: {
    TBA123456789012: 'sin_clasificar', TBA123456789011: 'sin_clasificar', TBA123456789010: 'cuenta',
    TBA123456789009: 'no_cuenta', TBA123456789008: 'no_cuenta' } })
  await expect(casilla(page)).toHaveAccessibleName(/1 nueva/)
  await casilla(page).click()
  const marcas = page.getByTestId('dnr-nueva')
  await expect(marcas).toHaveCount(1)
  await expect(marcas.first()).toHaveText('Actualizada')
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789011' })).toContainText('Actualizada')

  // Y una que no estaba la vez anterior, «Nueva». La casilla no vuelve a pedir la ruta al volver (se acaba de mirar):
  // la pantalla, sí, cada vez que se abre.
  await page.unroute(/\/api\/diarios\/mias/)
  const mas = structuredClone(DATOS)
  mas.semanas[0].dnr.unshift(dnr('2026-11-11', 'TBA123456789013', 'sin_clasificar'))
  await page.route(/\/api\/diarios\/mias/, json(mas))
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva/)
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789013' })).toContainText('Nueva')
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin el módulo de la DNR diaria no hay casilla', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidas = await entrar(page, { mias: { detail: 'Not Found' }, status: 404 })
  await expect(page.getByRole('button', { name: /Mis turnos/ })).toBeVisible()
  await expect.poll(() => pedidas.length).toBeGreaterThan(0)
  await expect(casilla(page)).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin ID de reparto lo explica y no enseña semanas', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: { tiene_id: false, en_revision: false, datos_hasta: null, semanas: [] } })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-sin-id')).toContainText('La oficina aún no ha enlazado tu ID de reparto')
  await expect(page.getByTestId('dnr-semana')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('con el ID en revisión lo dice', async ({ page }) => {
  await entrar(page, { mias: { tiene_id: true, en_revision: true, datos_hasta: null, semanas: [] } })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-en-revision')).toContainText('La oficina está revisando tu ID de reparto')
})

test('si falla la carga, lo dice y deja reintentar', async ({ page }) => {
  await entrar(page, { vistas: {} })
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json({ detail: 'Error' }, 500))
  await casilla(page).click()
  await expect(page.getByText('No se han podido cargar tus DNR.')).toBeVisible()
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json(DATOS))
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR')
  await expect(page.getByTestId('dnr-semana')).toHaveCount(3)
})

test('se abre directa con ?vista=dnr (para un aviso que lleve allí)', async ({ page }) => {
  await page.addInitScript((tk) => {
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
    localStorage.setItem('cookie_consent', '1')
  }, TOKEN)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/diarios\/mias/, json(DATOS))
  await page.goto('/conductor?vista=dnr', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR', { timeout: 15000 })
  await expect(page.getByTestId('dnr-semana')).toHaveCount(3)
})

test('en el móvil la frase se ve sin bajar, nada se sale de lado y lo que se toca mide al menos 44', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, { mias: conEstaSemana(paquetes(5)) })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-semana')).toHaveCount(3)
  // La frase grande, entera en la primera pantalla.
  const frase = await page.getByTestId('dnr-frase').boundingBox()
  expect(frase.y + frase.height).toBeLessThanOrEqual(844)
  // Y con una semana anterior abierta, sus filas tampoco se salen.
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')).toHaveCount(2)
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
  for (const b of await page.getByTestId('mis-dnr').getByRole('button').all()) {
    const caja = await b.boundingBox()
    expect(caja.height).toBeGreaterThanOrEqual(44)
  }
  // Ningún código de paquete ni estado queda cortado fuera de su fila.
  for (const f of await page.getByTestId('dnr-fila').all()) {
    const caja = await f.boundingBox()
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width).toBeLessThanOrEqual(390)
  }
})

test('cada DNR en su tarjeta con su CP y qué pasó; lo que no se entiende no se dice; la próxima vez, si toca', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const esta = page.getByTestId('dnr-esta-semana')
  const [sinDatos, conTodo] = [esta.getByTestId('dnr-fila').nth(0), esta.getByTestId('dnr-fila').nth(1)]

  // La que trae de todo: su CP, dónde la marcó, la distancia, que no llamó y la foto, cada cosa con su frase.
  await expect(conTodo).toContainText('TBA123456789011')
  await expect(conTodo.getByTestId('dnr-cp')).toHaveText('CP 15704')
  await expect(conTodo.getByTestId('dnr-estado')).toHaveText('Te cuenta')
  await expect(conTodo.getByTestId('dnr-hecho-como')).toHaveText('Lo marcaste en la puerta')
  await expect(conTodo.getByTestId('dnr-hecho-lejos')).toHaveText('Lo marcaste a más de 25 m del sitio')
  await expect(conTodo.getByTestId('dnr-hecho-llamada')).toHaveText('No llamaste al cliente')
  await expect(conTodo.getByTestId('dnr-hecho-foto')).toHaveText('La foto no pasó la revisión: salió borrosa')
  // «No llamaste» ya dice el fallo de contacto: no se repite.
  await expect(conTodo.getByTestId('dnr-hecho-contacto')).toHaveCount(0)
  // Se sabe que no llamó y que la foto falló: «lo que puedes hacer la próxima vez», con las dos cosas.
  const proxima = conTodo.getByTestId('dnr-proxima')
  await expect(proxima).toContainText('Lo que puedes hacer la próxima vez')
  await expect(proxima).toContainText('Llama al cliente antes de dejar el paquete.')
  await expect(proxima).toContainText('Saca la foto con el paquete y el sitio bien a la vista.')

  // La que no trae nada que se entienda: solo día, CP, paquete y estado. Ni el escaneo raro ni «Contact Compliance».
  await expect(sinDatos.getByTestId('dnr-cp')).toHaveText('CP 15704')
  await expect(sinDatos.getByTestId('dnr-que-paso')).toHaveCount(0)
  await expect(sinDatos.getByTestId('dnr-proxima')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('MOON')
  await expect(page.getByTestId('mis-dnr')).not.toContainText(/preferencia de entrega(?!, llama)/)

  // El recordatorio, siempre bajo la frase grande y antes de las tarjetas; y quién decide qué es de quién, al final.
  const recordatorio = page.getByTestId('dnr-recordatorio')
  await expect(recordatorio).toHaveText('Recuerda: si el cliente tiene preferencia de entrega, llama y saca bien la foto; así no te cuenta.')
  const y = async (l) => (await l.boundingBox()).y
  expect(await y(page.getByTestId('dnr-frase'))).toBeLessThan(await y(recordatorio))
  expect(await y(recordatorio)).toBeLessThan(await y(sinDatos))
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveText('¿Alguna no es tuya? Díselo a la oficina.')
  expect(await y(page.getByTestId('dnr-estados'))).toBeLessThan(await y(page.getByTestId('dnr-no-es-mia')))

  // La semana pasada: la que llamó (12 s) con su fallo de contacto, sin «próxima vez» (no se sabe que no llamara ni que
  // la foto fallara); y la que no trae CP, sin CP.
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  const pasada = page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-como')).toHaveText('Lo marcaste en el buzón')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-lejos')).toHaveText('Lo marcaste a menos de 25 m del sitio')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-llamada')).toHaveText('Llamaste al cliente (12 s)')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-contacto')).toHaveText('Te apuntaron un fallo de contacto con el cliente')
  await expect(pasada.nth(0).getByTestId('dnr-proxima')).toHaveCount(0)
  await expect(pasada.nth(1)).toContainText('TBA123456789009')
  await expect(pasada.nth(1).getByTestId('dnr-cp')).toHaveCount(0)
  // Sin euros, nunca; ni el ID.
  await expect(page.getByTestId('mis-dnr')).not.toContainText('€')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('el recordatorio y «díselo a la oficina» también sin ninguna esta semana; sin ID, ninguno de los dos', async ({ page }) => {
  await entrar(page, { mias: conEstaSemana([]) })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana no llevas ninguna')
  await expect(page.getByTestId('dnr-recordatorio')).toBeVisible()
  await expect(page.getByTestId('dnr-no-es-mia')).toBeVisible()
  await page.getByRole('button', { name: 'Volver' }).click()

  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json({ tiene_id: false, en_revision: false, datos_hasta: null, semanas: [] }))
  await casilla(page).click()
  await expect(page.getByTestId('dnr-sin-id')).toBeVisible()
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(0)
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveCount(0)
})

test('la casilla del inicio no vuelve a pedir la ruta cada vez que se vuelve (la pantalla, sí)', async ({ page }) => {
  const pedidas = await entrar(page)
  await expect(casilla(page)).toBeVisible()
  await expect.poll(() => pedidas.length).toBe(1)
  for (let vez = 0; vez < 2; vez++) {
    await casilla(page).click()
    await expect(page.getByTestId('dnr-frase')).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(casilla(page)).toBeVisible()
    // Y otra vuelta por otra pantalla del portal.
    await page.getByRole('button', { name: /Mis turnos/ }).click()
    await page.getByRole('button', { name: 'Volver' }).first().click()
    await expect(casilla(page)).toBeVisible()
  }
  // Una al entrar y una por cada vez que se abrió la pantalla: ninguna al volver al inicio.
  await expect.poll(() => pedidas.length).toBe(3)
  await casilla(page).click()
  await expect.poll(() => pedidas.length).toBe(4)
  expect(pedidas.length).toBe(4)
})
