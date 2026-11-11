/* «Mis DNR» en el portal del conductor (11-11-2026, tanda 2, zona «dnr»). Dani: «que cuando yo suba los daily report y
   aparezcan las DNRs ellos puedan ver la DNR que le cae a ellos».

   La casilla del inicio sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404), con el número rojo
   de las NUEVAS desde la última vez (las actualizadas van aparte y no suman) y «Esta semana: N» debajo del nombre. La
   pantalla, rehecha al verla Dani («que le ponga "esta semana llevas 1 DNR" y cuál es, o "llevas 5"»): arriba y en grande
   la frase de esta semana con su número (singular, plural, «ninguna» SOLO si hay datos de esta semana, o qué falta),
   debajo cuáles son, las semanas anteriores en una línea cada una con su desglose que se abre al tocarla, y qué es cada
   estado al final; con la marca de «Nueva» o «Actualizada». Sin euros.
   Y «más bonito y mejor» (Dani, 11-11-2026): cada DNR en su tarjeta con qué día es cada cosa (el de la entrega si se sabe y
   el de la DNR), su CP, su paquete y su estado, y debajo qué pasó (solo lo que el servidor entiende: lo que llega a null
   no se dice), lo que puede hacer la próxima vez, el recordatorio de la preferencia de entrega siempre bajo la frase
   grande y «¿Alguna no es tuya? Díselo a la oficina.». La casilla del inicio no vuelve a pedir la ruta cada vez que se
   vuelve. La revisión final (R7, F1 a F34) está en cada prueba con su número.
   API simulada con la forma EXACTA del contrato de R7 (con `entrega`, sin `sin_interpretar`) y datos fijos: nada depende
   del día de hoy (las semanas, su orden y hasta cuándo hay datos los decide el servidor). */
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (sub, name) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'driver', name, exp: 4102444800 })}.firma`
const TOKEN = token('d1', 'ANA PEREZ')
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const semana = (desde, hasta, dnr) => ({
  semana: desde, hasta,
  cuentan: dnr.filter((x) => x.estado === 'cuenta').length,
  no_cuentan: dnr.filter((x) => x.estado === 'no_cuenta').length,
  sin_clasificar: dnr.filter((x) => x.estado === 'sin_clasificar').length,
  dnr,
})
// Cada DNR con TODAS las claves del contrato, y null lo que no se sabe con seguridad.
const NADA = { entrega: null, cp: null, como: null, lejos: null, llamada: null, segundos: null, fallo_contacto: null, foto: null, foto_motivo: null }
const dnr = (dia, paquete, estado, mas = {}) => ({ dia, paquete, estado, ...NADA, cp: '15704', ...mas })
const CLAVES_DNR = ['dia', 'entrega', 'paquete', 'estado', 'cp', 'como', 'lejos', 'llamada', 'segundos', 'fallo_contacto', 'foto', 'foto_motivo']
const DATOS = {
  tiene_id: true, en_revision: false, datos_hasta: '2026-11-10',
  semanas: [
    semana('2026-11-08', '2026-11-14', [
      // Sin nada que el servidor entienda: solo el día de la DNR, el CP, el paquete y el estado.
      dnr('2026-11-10', 'TBA123456789012', 'sin_clasificar'),
      // Con el día de la entrega (dos días antes que el de la DNR) y de todo.
      dnr('2026-11-09', 'TBA123456789011', 'cuenta', {
        entrega: '2026-11-07', como: 'puerta', lejos: true, llamada: 'no', fallo_contacto: true, foto: 'mal', foto_motivo: 'borrosa' }),
    ]),
    semana('2026-11-01', '2026-11-07', [
      dnr('2026-11-04', 'TBA123456789010', 'cuenta', { como: 'buzon', lejos: false, llamada: 'si', segundos: 12, fallo_contacto: true }),
      dnr('2026-11-03', 'TBA123456789009', 'no_cuenta', { cp: null }),
    ]),
    semana('2026-10-25', '2026-10-31', []),
    semana('2026-10-18', '2026-10-24', [dnr('2026-10-20', 'TBA123456789008', 'no_cuenta')]),
  ],
}

test('la API simulada tiene la forma exacta del contrato (R7)', () => {
  expect(Object.keys(DATOS).sort()).toEqual(['datos_hasta', 'en_revision', 'semanas', 'tiene_id'])
  for (const s of DATOS.semanas) {
    expect(Object.keys(s).sort()).toEqual(['cuentan', 'dnr', 'hasta', 'no_cuentan', 'semana', 'sin_clasificar'])
    for (const x of s.dnr) expect(Object.keys(x).sort()).toEqual([...CLAVES_DNR].sort())
  }
})

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(m.text())) fallos.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => fallos.push(String(e.message).slice(0, 200)))
  return fallos
}

async function entrar(page, { mias = DATOS, status = 200, antes } = {}) {
  await page.addInitScript(({ tk, antes }) => {
    // Solo la primera vez que se carga la página: lo que apunte la app después no se pisa al recargar.
    if (sessionStorage.getItem('ya_puesto')) return
    sessionStorage.setItem('ya_puesto', '1')
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
    localStorage.setItem('cookie_consent', '1')
    // Marcas relativas al reloj de la página (nunca una fecha fija que caduque).
    for (const [k, v] of Object.entries(antes || {})) localStorage.setItem(k, typeof v === 'number' ? String(Date.now() + v) : v)
  }, { tk: TOKEN, antes })
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
// Cambia lo que contesta el servidor a partir de ahora.
async function contesta(page, cuerpo, status = 200) {
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json(cuerpo, status))
}

const casilla = (page) => page.getByRole('button', { name: /^Mis DNR/ })
const numeroRojo = (page) => casilla(page).locator('.bg-ruta-peligro')

// ESTA semana con las DNR que se le den (las anteriores, las de DATOS), para el singular, el plural y el «ninguna».
const conEstaSemana = (dnr, mas = {}) => ({ ...DATOS, ...mas, semanas: [semana('2026-11-08', '2026-11-14', dnr), ...DATOS.semanas.slice(1)] })
const paquetes = (n, estado = 'cuenta', pre = 'TBA99900000000') => Array.from({ length: n }, (_, k) => dnr('2026-11-09', `${pre}${k}`, estado))

test('arriba y en grande, cuántas lleva esta semana; debajo, cuáles; las anteriores, una línea cada una con su desglose; y los estados, al final', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidas = await entrar(page)
  // La casilla dice lo mismo en corto, con el número rojo de las nuevas (la primera vez, todas: nunca las ha visto).
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  await expect(numeroRojo(page)).toHaveText('5')
  await expect(casilla(page)).toHaveAccessibleName(/5 nuevas/)
  await casilla(page).click()

  const pantalla = page.getByTestId('mis-dnr')
  await expect(pantalla.getByRole('heading', { name: 'Mis DNR' })).toBeVisible()
  // 1. La frase de esta semana con su número (todas las DNR de la semana, cuenten o no), el desglose y hasta cuándo.
  const frase = pantalla.getByTestId('dnr-frase')
  await expect(frase).toHaveText('Esta semana llevas 2 DNR')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveText('2')
  await expect(pantalla.getByTestId('dnr-desglose')).toHaveText('1 te cuenta · 1 sin clasificar')
  // F19: «Hay datos hasta el…», sin el punto final.
  await expect(pantalla.getByTestId('dnr-hasta')).toHaveText('Hay datos hasta el martes, 10/11')

  // 2. Justo debajo, cuáles son: paquete, día, estado y la marca de nueva.
  const esta = pantalla.getByTestId('dnr-esta-semana')
  const filas = esta.getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(0)).toContainText('TBA123456789012')
  await expect(filas.nth(0)).toContainText('Sin clasificar')
  await expect(filas.nth(0)).toContainText('Nueva')
  await expect(filas.nth(1)).toContainText('TBA123456789011')
  await expect(filas.nth(1)).toContainText('Te cuenta')
  await expect(pantalla.getByText('5 nuevas', { exact: true })).toBeVisible()

  // 3. Las anteriores, una línea por semana con su recuento y su desglose (F17), cerradas; la vacía lo dice en su línea
  // y no se abre.
  const semanas = pantalla.getByTestId('dnr-anteriores').getByTestId('dnr-semana')
  await expect(semanas).toHaveCount(3)
  await expect(semanas.nth(0)).toContainText('La semana pasada')
  await expect(semanas.nth(0).getByTestId('dnr-recuento')).toHaveText('2 DNR')
  await expect(semanas.nth(0).getByTestId('dnr-semana-desglose')).toHaveText('1 te cuenta · 1 no te cuenta')
  await expect(semanas.nth(0).getByTestId('dnr-semana-nuevas')).toHaveText('2 nuevas')
  await expect(semanas.nth(0).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  await expect(semanas.nth(1)).toContainText(/^Del 25\/10 al 31\/10/)
  await expect(semanas.nth(1).getByTestId('dnr-recuento')).toHaveText('Ninguna')
  await expect(semanas.nth(1).getByTestId('dnr-semana-desglose')).toHaveCount(0)
  await expect(semanas.nth(1).getByRole('button')).toHaveCount(0)
  await expect(semanas.nth(2).getByTestId('dnr-recuento')).toHaveText('1 DNR')
  await expect(semanas.nth(2).getByTestId('dnr-semana-desglose')).toHaveText('1 no te cuenta')
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
  await expect(numeroRojo(page)).toHaveCount(0)
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

test('sin ninguna esta semana y con datos de esta semana, lo dice en grande con la marca verde, y la casilla también', async ({ page }) => {
  const fallos = vigilar(page)
  // datos_hasta (10/11) ya es de esta semana (desde el 8/11): se sabe que no lleva ninguna.
  await entrar(page, { mias: conEstaSemana([]) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: ninguna')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana no llevas ninguna')
  await expect(page.getByTestId('dnr-marca-verde')).toBeVisible()
  await expect(page.getByTestId('dnr-numero')).toHaveCount(0)
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(0)
  await expect(page.getByTestId('dnr-hasta')).toHaveText('Hay datos hasta el martes, 10/11')
  // Las anteriores siguen ahí, cerradas.
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-semana')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /La semana pasada/ })).toHaveAttribute('aria-expanded', 'false')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F3/F6: un lunes sin datos de esta semana no dice «ninguna» ni pone la marca verde, y abre «La semana pasada»', async ({ page }) => {
  const fallos = vigilar(page)
  // Los datos acaban el sábado 7/11, antes del domingo 8/11 en que empieza esta semana: de esta semana no se sabe nada.
  await entrar(page, { mias: conEstaSemana([], { datos_hasta: '2026-11-07' }) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: aún sin datos')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('De esta semana aún no hay reportes')
  await expect(page.getByTestId('dnr-marca-verde')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('no llevas ninguna')
  await expect(page.getByTestId('dnr-hasta')).toHaveText('Hay datos hasta el sábado, 7/11')
  // «La semana pasada», la que acaba de llegar, ABIERTA sin tocarla, con sus tarjetas; y se cierra al tocarla.
  const pasada = page.getByRole('button', { name: /La semana pasada/ })
  await expect(pasada).toHaveAttribute('aria-expanded', 'true')
  const filas = page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(0)).toContainText('TBA123456789010')
  await pasada.click()
  await expect(pasada).toHaveAttribute('aria-expanded', 'false')
  await expect(filas).toHaveCount(0)
  // Las más viejas, cerradas.
  await expect(page.getByTestId('dnr-anteriores').getByRole('button', { name: /Del 18\/10/ })).toHaveAttribute('aria-expanded', 'false')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F3/F18: sin ningún reporte de su centro lo dice, sin «ninguna», sin marca verde y sin «hay datos hasta»', async ({ page }) => {
  const fallos = vigilar(page)
  const vacias = { ...DATOS, datos_hasta: null, semanas: DATOS.semanas.map((s) => semana(s.semana, s.hasta, [])) }
  await entrar(page, { mias: vacias })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: aún sin datos')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Aún no hay reportes de tu centro')
  await expect(page.getByTestId('dnr-marca-verde')).toHaveCount(0)
  await expect(page.getByTestId('dnr-hasta')).toHaveCount(0)
  // Ya no acusa a la oficina de no subir nada.
  await expect(page.getByTestId('mis-dnr')).not.toContainText('La oficina aún no ha subido')
  await expect(page.getByTestId('dnr-recordatorio')).toBeVisible()
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
  await expect(page.getByTestId('dnr-hasta')).toContainText('Data up to')
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento').first()).toHaveText('2 DNRs')
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento').last()).toHaveText('1 DNR')
  await contesta(page, conEstaSemana(paquetes(5)))
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: /^My DNRs/ }).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('This week you have 5 DNRs')
  await expect(page.getByTestId('dnr-desglose')).toHaveText('5 count')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F4/F16 y F13: las que solo cambiaron de estado van aparte como «actualizadas» y no suman al número rojo; lo apuntado no guarda el código', async ({ page }) => {
  const fallos = vigilar(page)
  // La primera vez: 011 y 009 sin clasificar. Las ve.
  const antes = structuredClone(DATOS)
  antes.semanas[0].dnr[1].estado = 'sin_clasificar'
  antes.semanas[1].dnr[1].estado = 'sin_clasificar'
  await entrar(page, { mias: antes })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(2)
  await page.getByRole('button', { name: 'Volver' }).click()
  // F13: lo apuntado en el móvil, por conductor, sin ningún código de paquete.
  const apuntado = await page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d1'))
  expect(apuntado).not.toMatch(/TBA/)
  expect(Object.keys(JSON.parse(apuntado))).toHaveLength(5)

  // Amazon clasifica las dos: ninguna DNR nueva. La casilla, sin número rojo y diciendo «2 actualizadas».
  await contesta(page, DATOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toHaveAccessibleName(/2 actualizadas/)
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva/)
  await expect(numeroRojo(page)).toHaveCount(0)
  await casilla(page).click()
  await expect(page.getByTestId('mis-dnr').getByText('2 actualizadas', { exact: true })).toBeVisible()
  await expect(page.getByTestId('mis-dnr')).not.toContainText(/\bnuevas?\b/)
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789011' }).getByTestId('dnr-nueva')).toHaveText('Actualizada')
  // En la línea de la semana pasada, aparte y sin «nuevas».
  const pasada = page.getByTestId('dnr-anteriores').getByTestId('dnr-semana').first()
  await expect(pasada.getByTestId('dnr-semana-actualizadas')).toHaveText('1 actualizada')
  await expect(pasada.getByTestId('dnr-semana-nuevas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Volver' }).click()

  // Y una que no estaba: esa sí es nueva y sí suma al número rojo.
  const mas = structuredClone(DATOS)
  mas.semanas[0].dnr.unshift(dnr('2026-11-11', 'TBA123456789013', 'sin_clasificar'))
  await contesta(page, mas)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toHaveAccessibleName(/1 nueva/)
  await expect(numeroRojo(page)).toHaveText('1')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789013' }).getByTestId('dnr-nueva')).toHaveText('Nueva')
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(1)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin el módulo de la DNR diaria no hay casilla, y no se vuelve a preguntar en 12 horas (F21)', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidas = await entrar(page, { mias: { detail: 'Not Found' }, status: 404 })
  await expect(page.getByRole('button', { name: /Mis turnos/ })).toBeVisible()
  await expect.poll(() => pedidas.length).toBe(1)
  await expect(casilla(page)).toHaveCount(0)
  // Al abrir el portal otra vez, no la pide.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(pedidas).toHaveLength(1)
  await expect(casilla(page)).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F21: pasadas 12 horas del 404 vuelve a preguntar, y un 200 borra el recuerdo', async ({ page }) => {
  const pedidas = await entrar(page, { antes: { fds_dnr_no_d1: -13 * 3600 * 1000 } })
  await expect(casilla(page)).toBeVisible()
  expect(pedidas).toHaveLength(1)
  expect(await page.evaluate(() => localStorage.getItem('fds_dnr_no_d1'))).toBeNull()
})

test('F21: con el 404 de hace una hora no pregunta, aunque ahora el servidor sí la diera', async ({ page }) => {
  const pedidas = await entrar(page, { antes: { fds_dnr_no_d1: -3600 * 1000 } })
  await expect(page.getByRole('button', { name: /Mis turnos/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(pedidas).toHaveLength(0)
  await expect(casilla(page)).toHaveCount(0)
})

test('F20: con un fallo de red o un 5xx la casilla sale sin número si ya la tuvo, para llegar al «Reintentar»; con 403, no', async ({ page }) => {
  // Primero un 200: este conductor la tiene.
  await entrar(page)
  await expect(casilla(page)).toBeVisible()
  // Un 500 al abrir el portal otra vez: la casilla sigue, sin número ni «Esta semana», y lleva al error con «Reintentar».
  await contesta(page, { detail: 'Error' }, 500)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveCount(0)
  await expect(numeroRojo(page)).toHaveCount(0)
  await casilla(page).click()
  await expect(page.getByText('No se han podido cargar tus DNR.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  // Sin cobertura (la petición ni llega): igual.
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, (r) => r.abort('internetdisconnected'))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveCount(0)
  // Con 403 (su ficha está de baja), no sale.
  await contesta(page, { detail: 'Tu ficha está de baja' }, 403)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(casilla(page)).toHaveCount(0)
})

test('F20: con un 5xx y sin saber si la tiene, no sale', async ({ page }) => {
  const pedidas = await entrar(page, { mias: { detail: 'Error' }, status: 503 })
  await expect.poll(() => pedidas.length).toBe(1)
  await page.waitForLoadState('networkidle')
  await expect(casilla(page)).toHaveCount(0)
})

test('F2: al salir y entrar otro conductor en el mismo móvil, la casilla no enseña ni un momento lo del anterior', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  // Ana abre la pantalla (lo apunta todo como visto) y vuelve.
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR')
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(numeroRojo(page)).toHaveCount(0)
  // Lo de Luis no llega hasta que la prueba lo suelte: mientras, la casilla no puede enseñar lo de Ana.
  const TOKEN_LUIS = token('d2', 'LUIS GOMEZ')
  let soltar
  const luisPendiente = new Promise((r) => { soltar = r })
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, async (route) => {
    if ((route.request().headers().authorization || '').includes(TOKEN_LUIS)) {
      await luisPendiente
      return json(conEstaSemana(paquetes(1, 'no_cuenta', 'TBA77700000000')))(route)
    }
    return json(DATOS)(route)
  })
  await page.route(/\/api\/auth\/driver-login/, json({ access_token: TOKEN_LUIS, name: 'LUIS GOMEZ', center: 'OGA5' }))
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await page.locator('input[type="email"]').fill('luis@ejemplo.test')
  await page.locator('input[type="email"]').press('Enter')
  await page.locator('input[autocomplete="current-password"]').fill('clave-de-prueba')
  await page.locator('input[autocomplete="current-password"]').press('Enter')
  await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible()
  await expect(casilla(page)).toHaveCount(0)
  await expect(page.getByText('Esta semana: 2')).toHaveCount(0)
  soltar()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 1')
  // Sus nuevas son las suyas (nunca las ha visto él), no las de Ana: lo apuntado va por conductor, también sin el id en
  // la ficha guardada (entró con contraseña): sale de la sesión.
  // (Ana ya las había visto todas; las 3 de semanas anteriores que comparten los datos simulados son nuevas para él.)
  await expect(casilla(page)).toHaveAccessibleName(/4 nuevas/)
  await expect(numeroRojo(page)).toHaveText('4')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toContainText('TBA777000000000')
  expect(await page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d2'))).not.toBeNull()
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
  await entrar(page)
  await contesta(page, { detail: 'Error' }, 500)
  await casilla(page).click()
  await expect(page.getByText('No se han podido cargar tus DNR.')).toBeVisible()
  await contesta(page, DATOS)
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

test('cada DNR en su tarjeta con qué día es cada cosa, su CP y qué pasó; lo que no se sabe no se dice; la próxima vez, si toca', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const esta = page.getByTestId('dnr-esta-semana')
  const [sinDatos, conTodo] = [esta.getByTestId('dnr-fila').nth(0), esta.getByTestId('dnr-fila').nth(1)]

  // F8/F9: con el día de la entrega, ese arriba con el CP, y el de la DNR, más discreto, debajo del paquete.
  await expect(conTodo.getByTestId('dnr-dia')).toHaveText('Entregado el sáb, 7/11 · CP 15704')
  await expect(conTodo.getByTestId('dnr-concesion')).toHaveText('DNR del lun, 9/11')
  await expect(conTodo.getByTestId('dnr-paquete')).toHaveText('TBA123456789011')
  const yDe = async (l) => (await l.boundingBox()).y
  expect(await yDe(conTodo.getByTestId('dnr-paquete'))).toBeLessThan(await yDe(conTodo.getByTestId('dnr-concesion')))
  // Sin él, solo el de la DNR, dicho como lo que es.
  await expect(sinDatos.getByTestId('dnr-dia')).toHaveText('DNR del mar, 10/11 · CP 15704')
  await expect(sinDatos.getByTestId('dnr-concesion')).toHaveCount(0)
  await expect(sinDatos).not.toContainText('Entregado')

  // La que trae de todo: su CP, dónde la marcó, la distancia, que no llamó y la foto, cada cosa con su frase.
  await expect(conTodo.getByTestId('dnr-cp')).toHaveText('CP 15704')
  await expect(conTodo.getByTestId('dnr-estado')).toHaveText('Te cuenta')
  await expect(conTodo.getByTestId('dnr-hecho-como')).toHaveText('Lo marcaste en la puerta')
  await expect(conTodo.getByTestId('dnr-hecho-lejos')).toHaveText('Lo marcaste a más de 25 m del sitio')
  await expect(conTodo.getByTestId('dnr-hecho-llamada')).toHaveText('No llamaste al cliente')
  await expect(conTodo.getByTestId('dnr-hecho-foto')).toHaveText('La foto no pasó la revisión: salió borrosa')
  // «No llamaste» ya dice el fallo de contacto: no se repite, ni su consejo.
  await expect(conTodo.getByTestId('dnr-hecho-contacto')).toHaveCount(0)
  // Se sabe que no llamó y que la foto falló: «lo que puedes hacer la próxima vez», con las dos cosas.
  const proxima = conTodo.getByTestId('dnr-proxima')
  await expect(proxima.getByTestId('dnr-proxima-titulo')).toHaveText('Lo que puedes hacer la próxima vez')
  await expect(proxima.getByTestId('dnr-consejo')).toHaveText([
    'Llama al cliente antes de dejar el paquete.', 'Saca la foto con el paquete y el sitio bien a la vista.'])
  // F29: el título manda sobre sus consejos (más peso y no más pequeño).
  const letra = (l) => l.evaluate((el) => ({ peso: Number(getComputedStyle(el).fontWeight), tam: parseFloat(getComputedStyle(el).fontSize) }))
  const [titulo, consejo] = [await letra(proxima.getByTestId('dnr-proxima-titulo')), await letra(proxima.getByTestId('dnr-consejo').first())]
  expect(titulo.peso).toBeGreaterThan(consejo.peso)
  expect(titulo.tam).toBeGreaterThanOrEqual(consejo.tam)

  // La que no trae nada que se entienda: solo día, CP, paquete y estado.
  await expect(sinDatos.getByTestId('dnr-cp')).toHaveText('CP 15704')
  await expect(sinDatos.getByTestId('dnr-que-paso')).toHaveCount(0)
  await expect(sinDatos.getByTestId('dnr-proxima')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText(/preferencia de entrega(?!, llama)/)

  // El recordatorio, siempre bajo la frase grande y antes de las tarjetas; y quién decide qué es de quién, al final.
  const recordatorio = page.getByTestId('dnr-recordatorio')
  await expect(recordatorio).toHaveText('Recuerda: si el cliente tiene preferencia de entrega, llama y saca bien la foto; así no te cuenta.')
  expect(await yDe(page.getByTestId('dnr-frase'))).toBeLessThan(await yDe(recordatorio))
  expect(await yDe(recordatorio)).toBeLessThan(await yDe(sinDatos))
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveText('¿Alguna no es tuya? Díselo a la oficina.')
  expect(await yDe(page.getByTestId('dnr-estados'))).toBeLessThan(await yDe(page.getByTestId('dnr-no-es-mia')))

  // La semana pasada: la que llamó (12 s) con su fallo de contacto: F30, el consejo prudente (no afirma que no llamara);
  // y la que no trae CP, sin CP.
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  const pasada = page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')
  await expect(pasada.nth(0).getByTestId('dnr-dia')).toHaveText('DNR del mié, 4/11 · CP 15704')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-como')).toHaveText('Lo marcaste en el buzón')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-lejos')).toHaveText('Lo marcaste a menos de 25 m del sitio')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-llamada')).toHaveText('Llamaste al cliente (12 s)')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-contacto')).toHaveText('Te apuntaron un fallo de contacto con el cliente')
  await expect(pasada.nth(0).getByTestId('dnr-consejo')).toHaveText(['Contacta con el cliente antes de dejar el paquete.'])
  await expect(pasada.nth(1)).toContainText('TBA123456789009')
  await expect(pasada.nth(1).getByTestId('dnr-cp')).toHaveCount(0)
  await expect(pasada.nth(1).getByTestId('dnr-dia')).toHaveText('DNR del mar, 3/11')
  // Sin euros, nunca; ni el ID.
  await expect(page.getByTestId('mis-dnr')).not.toContainText('€')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F31: «Te cuenta» pesa más a la vista que «No te cuenta» (que ya no va en verde relleno)', async ({ page }) => {
  await entrar(page)
  await casilla(page).click()
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  const fondo = (l) => l.evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g).map(Number)
    return Math.max(r, g, b) - Math.min(r, g, b)   // cuánto color tiene el relleno: 0 = gris
  })
  const filas = page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')
  const cuenta = filas.nth(0).getByTestId('dnr-estado')
  const noCuenta = filas.nth(1).getByTestId('dnr-estado')
  await expect(cuenta).toHaveText('Te cuenta')
  await expect(noCuenta).toHaveText('No te cuenta')
  // La buena, en gris; la que cuenta, con su color de peligro.
  expect(await fondo(noCuenta)).toBeLessThan(25)
  const color = (l) => l.evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).color.match(/\d+(\.\d+)?/g).map(Number)
    return Math.max(r, g, b) - Math.min(r, g, b)
  })
  expect(await color(cuenta)).toBeGreaterThan(await color(noCuenta))
})

test('F28: el foco del teclado se ve, por dentro, en los botones de las semanas anteriores', async ({ page }) => {
  await entrar(page)
  await casilla(page).click()
  const pasada = page.getByRole('button', { name: /La semana pasada/ })
  await expect(pasada).toBeVisible()
  let enfocado = false
  for (let k = 0; k < 30 && !enfocado; k++) {
    await page.keyboard.press('Tab')
    enfocado = await pasada.evaluate((el) => document.activeElement === el)
  }
  expect(enfocado).toBe(true)
  const sombra = await pasada.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(sombra).toMatch(/inset/)
})

test('F27 y F32: a 360 px en alemán y con «Letra más grande», el paquete entero en una línea y «Qué es cada estado» sin apretar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.addInitScript(() => {
    localStorage.setItem('fds_idioma', 'de')
    localStorage.setItem('fds_letra', 'grande')
    document.documentElement.setAttribute('data-letra', 'grande')
  })
  const largos = conEstaSemana([
    dnr('2026-11-10', 'TBA319482771045', 'sin_clasificar'),
    dnr('2026-11-09', 'TBA319400000009', 'no_cuenta', { entrega: '2026-11-07' }),
  ])
  await entrar(page, { mias: largos })
  await page.getByRole('button', { name: /^Meine DNRs/ }).click()
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(2)
  for (const f of await page.getByTestId('dnr-fila').all()) {
    const p = f.getByTestId('dnr-paquete')
    const { alto, linea, derecha, fila } = await p.evaluate((el) => ({
      alto: el.getBoundingClientRect().height,
      linea: parseFloat(getComputedStyle(el).lineHeight),
      derecha: el.getBoundingClientRect().right,
      fila: el.closest('[data-testid="dnr-fila"]').getBoundingClientRect().right,
    }))
    expect(alto).toBeLessThan(linea * 1.5)          // una sola línea
    expect(derecha).toBeLessThanOrEqual(fila)        // y dentro de su tarjeta
  }
  // «Entregado» y el CP se leen juntos y en alemán; nada se sale de lado.
  await expect(page.getByTestId('dnr-fila').nth(1).getByTestId('dnr-dia')).toContainText('Zugestellt am')
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
  // Cada explicación, debajo de su etiqueta y con todo el ancho: como mucho dos líneas (antes le quedaban ~130 px, en 3 o
  // 4 líneas).
  for (const dd of await page.getByTestId('dnr-estado-explica').all()) {
    const { lineas, bajo } = await dd.evaluate((el) => {
      const dt = el.previousElementSibling.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { lineas: r.height / parseFloat(getComputedStyle(el).lineHeight), bajo: r.top >= dt.bottom - 1 }
    })
    expect(lineas).toBeLessThan(2.5)
    expect(bajo).toBe(true)
  }
})

test('el recordatorio y «díselo a la oficina» también sin ninguna esta semana; sin ID, ninguno de los dos', async ({ page }) => {
  await entrar(page, { mias: conEstaSemana([]) })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana no llevas ninguna')
  await expect(page.getByTestId('dnr-recordatorio')).toBeVisible()
  await expect(page.getByTestId('dnr-no-es-mia')).toBeVisible()
  await page.getByRole('button', { name: 'Volver' }).click()

  await contesta(page, { tiene_id: false, en_revision: false, datos_hasta: null, semanas: [] })
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
