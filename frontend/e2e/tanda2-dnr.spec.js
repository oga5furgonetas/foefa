/* «Mis DNR» en el portal del conductor (11-11-2026, tanda 2, zona «dnr»). Dani: «que cuando yo suba los daily report y
   aparezcan las DNRs ellos puedan ver la DNR que le cae a ellos».

   La casilla del inicio sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404 «Sin DNR diaria»),
   con el número rojo de las NUEVAS desde la última vez (las actualizadas van aparte y no suman) y «Esta semana: N» debajo
   del nombre. La pantalla, V5 («es como demasiado texto… la gente pasa de leer»): el resumen de esta semana con el número
   muy grande y sus contadores de color; el recordatorio con la condición arriba («Solo si el cliente tiene preferencia de
   entrega») y los pasos debajo; una tarjeta por DNR con etiquetas cortas de qué pasó (la frase larga, para el lector de
   pantalla); las semanas anteriores en filas con mini contadores; «Qué es cada color», plegado. Sin euros, nunca.
   Cada arreglo de las revisiones (F1 a F34 de R7, G1 a G19 de R8) está en su prueba con su número.
   API simulada con la forma EXACTA del contrato (R7 con los cambios de R8) y datos fijos: nada depende del día de hoy (las
   semanas, su orden y hasta cuándo hay datos los decide el servidor; las marcas del móvil, relativas al reloj de la
   página).
   R9 (Dani, 11-11-2026): la llamada de menos de 30 s es «corta» (fallo) y cada DNR con fallo de contacto lleva el aviso de
   los 30 segundos. Y EN PAUSA (src/pages/driver/dnrPausas.js) el estado («te cuenta / no cuenta») y el recordatorio de la
   preferencia: las pruebas que los miran se saltan mientras dure la pausa y vuelven solas al quitarla; las de «R9 (lo que
   se publica)» miran que no salgan.
   R11 (Dani, 11-11-2026): la preferencia VUELVE (el recordatorio y su ejemplo «¿Cómo sé si tiene preferencia?», corregido:
   la preferencia es la PRIMERA opción de «¿Dónde vas a dejar el paquete?»; las notas no lo son) y el estado SIGUE en
   pausa: las de «R11 (lo que se publica)» miran que encender una no encienda nada de la otra. */
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'
import { PAUSAS } from '../src/pages/driver/dnrPausas.js'

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (sub, name) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'driver', name, exp: 4102444800 })}.firma`
const TOKEN = token('d1', 'ANA PEREZ')
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
// El 404 propio de la ruta (R8, G10) y el genérico de un servidor que aún no la tiene.
const SIN_DNR = { detail: 'Sin DNR diaria' }
const NOT_FOUND = { detail: 'Not Found' }

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
// R9: `llamada` es «si» (30 s o más), «corta» (de 1 a 29 s), «no» o null; `fallo_contacto`, true con «no» o «corta» y si
// no null (nunca false).
function expectLlamada(x) {
  expect([null, 'si', 'corta', 'no']).toContain(x.llamada)
  if (x.llamada === 'corta') expect(x.segundos >= 1 && x.segundos < 30).toBe(true)
  if (x.llamada === 'si' && x.segundos != null) expect(x.segundos).toBeGreaterThanOrEqual(30)
  if (x.llamada === 'no' || x.llamada === 'corta') expect(x.fallo_contacto).toBe(true)
  if (x.fallo_contacto === true) expect(['no', 'corta']).toContain(x.llamada)
  expect(x.fallo_contacto).not.toBe(false)
}
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
      // R9: llamó 12 s, menos de los 30 que hacen falta: «corta», y con ello fallo de contacto.
      dnr('2026-11-04', 'TBA123456789010', 'cuenta', { como: 'buzon', lejos: false, llamada: 'corta', segundos: 12, fallo_contacto: true }),
      dnr('2026-11-03', 'TBA123456789009', 'no_cuenta', { cp: null }),
    ]),
    semana('2026-10-25', '2026-10-31', []),
    semana('2026-10-18', '2026-10-24', [dnr('2026-10-20', 'TBA123456789008', 'no_cuenta')]),
  ],
}

test('la API simulada tiene la forma exacta del contrato (R7 y R8)', () => {
  expect(Object.keys(DATOS).sort()).toEqual(['datos_hasta', 'en_revision', 'semanas', 'tiene_id'])
  for (const s of DATOS.semanas) {
    expect(Object.keys(s).sort()).toEqual(['cuentan', 'dnr', 'hasta', 'no_cuentan', 'semana', 'sin_clasificar'])
    for (const x of s.dnr) {
      expect(Object.keys(x).sort()).toEqual([...CLAVES_DNR].sort())
      // R8: el paquete con forma de código (letras y cifras, de 8 a 30) y el CP de como mucho 8.
      expect(x.paquete).toMatch(/^[A-Za-z0-9]{8,30}$/)
      if (x.cp) expect(x.cp.replace(/[ -]/, '').length).toBeLessThanOrEqual(8)
      if (x.segundos != null) expect(x.segundos >= 1 && x.segundos <= 1800).toBe(true)
      expectLlamada(x)
    }
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

async function entrar(page, { mias = DATOS, status = 200, antes, vistas, url = '/conductor', ancla = true } = {}) {
  await page.addInitScript(({ tk, antes, vistas }) => {
    // Solo la primera vez que se carga la página: lo que apunte la app después no se pisa al recargar.
    if (sessionStorage.getItem('ya_puesto')) return
    sessionStorage.setItem('ya_puesto', '1')
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
    localStorage.setItem('cookie_consent', '1')
    // Marcas relativas al reloj de la página (nunca una fecha fija que caduque).
    for (const [k, v] of Object.entries(antes || {})) localStorage.setItem(k, typeof v === 'number' ? String(Date.now() + v) : v)
    // Lo apuntado de «vistas», con su «cuándo» relativo al reloj de la página.
    if (vistas) {
      const m = {}
      for (const [h, [e, hace]] of Object.entries(vistas.huellas)) m[h] = { e, t: Date.now() - hace }
      localStorage.setItem('fds_dnr_sal', vistas.sal)
      localStorage.setItem('fds_dnr_vistas_d1', JSON.stringify(m))
    }
  }, { tk: TOKEN, antes, vistas })
  await simularApi(page, 'vacio')
  const pedidas = []
  await page.route(/\/api\/diarios\/mias/, (route) => {
    pedidas.push(new URL(route.request().url()).search)
    return json(mias, status)(route)
  })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (ancla) await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible({ timeout: 15000 })
  return pedidas
}
// Cambia lo que contesta el servidor a partir de ahora.
async function contesta(page, cuerpo, status = 200) {
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, json(cuerpo, status))
}

const casilla = (page) => page.getByRole('button', { name: /^Mis DNR/ })
const numeroRojo = (page) => casilla(page).locator('.bg-ruta-peligro')
// Lo que se VE de una etiqueta de un hecho (la frase larga va aparte, para el lector de pantalla).
const corto = (l) => l.locator('[data-corto]')
const abrirColores = (page) => page.getByRole('button', { name: 'Qué es cada color' }).click()

// ESTA semana con las DNR que se le den (las anteriores, las de DATOS), para el singular, el plural y el «ninguna».
const conEstaSemana = (dnr, mas = {}) => ({ ...DATOS, ...mas, semanas: [semana('2026-11-08', '2026-11-14', dnr), ...DATOS.semanas.slice(1)] })
const paquetes = (n, estado = 'cuenta', pre = 'TBA99900000000') => Array.from({ length: n }, (_, k) => dnr('2026-11-09', `${pre}${k}`, estado))
// EN PAUSA (dnrPausas.js): lo que mira el estado o el recordatorio se salta mientras dure, y vuelve solo al quitarla.
const PAUSA_ESTADO = 'el estado («te cuenta / no cuenta») está en pausa (dnrPausas.js)'
const PAUSA_PREFERENCIA = 'el recordatorio de la preferencia está en pausa (dnrPausas.js)'

test('V5: arriba el resumen con el número grande y sus contadores; debajo, cuáles; las anteriores en filas con mini contadores; los colores, plegados', async ({ page }) => {
  test.skip(PAUSAS.estado, PAUSA_ESTADO)
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
  // 1. El resumen: «Esta semana llevas» arriba, el número muy grande y en rojo (una le cuenta), los contadores que no son
  //    cero y hasta cuándo hay datos (F19: sin punto final).
  const frase = pantalla.getByTestId('dnr-frase')
  await expect(frase).toHaveText('Esta semana llevas 2 DNR')
  await expect(pantalla.getByTestId('dnr-frase-arriba')).toHaveText('Esta semana llevas')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveText('2')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveClass(/text-ruta-peligro-texto/)
  await expect(pantalla.getByTestId('dnr-rango')).toHaveText('Del 8/11 al 14/11')
  await expect(pantalla.getByTestId('dnr-contador-cuentan')).toHaveText('1 te cuenta')
  await expect(pantalla.getByTestId('dnr-contador-sin_clasificar')).toHaveText('1 pendiente')
  await expect(pantalla.getByTestId('dnr-contador-no_cuentan')).toHaveCount(0)
  await expect(pantalla.getByTestId('dnr-hasta')).toHaveText('Datos hasta el mar 10/11')
  const tam = (l) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(await tam(pantalla.getByTestId('dnr-numero'))).toBeGreaterThan(2 * await tam(pantalla.getByTestId('dnr-frase-arriba')))

  // 2. Justo debajo, cuáles son: paquete, día, estado con su nombre corto y la marca de nueva.
  const esta = pantalla.getByTestId('dnr-esta-semana')
  const filas = esta.getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(filas.nth(0).getByTestId('dnr-paquete')).toHaveText('TBA123456789012')
  await expect(filas.nth(0).getByTestId('dnr-estado')).toHaveText('Pendiente')
  await expect(filas.nth(0).getByTestId('dnr-nueva')).toHaveText('Nueva')
  await expect(filas.nth(1).getByTestId('dnr-paquete')).toHaveText('TBA123456789011')
  await expect(filas.nth(1).getByTestId('dnr-estado')).toHaveText('Te cuenta')
  await expect(pantalla.getByText('5 nuevas', { exact: true })).toBeVisible()

  // 3. Las anteriores, una fila por semana con sus mini contadores de color (el desglose en palabras, para el lector de
  //    pantalla), cerradas; la vacía con datos de esa semana dice «Ninguna» con su marca verde y no se abre.
  const semanas = pantalla.getByTestId('dnr-anteriores').getByTestId('dnr-semana')
  await expect(semanas).toHaveCount(3)
  await expect(semanas.nth(0)).toContainText('La semana pasada')
  await expect(semanas.nth(0).getByTestId('dnr-mini-cuentan')).toHaveText('1')
  await expect(semanas.nth(0).getByTestId('dnr-mini-no_cuentan')).toHaveText('1')
  await expect(semanas.nth(0).getByTestId('dnr-mini-sin_clasificar')).toHaveCount(0)
  await expect(semanas.nth(0).getByTestId('dnr-semana-desglose')).toHaveText('1 te cuenta · 1 no cuenta')
  await expect(semanas.nth(0).getByRole('button')).toHaveAccessibleName(/1 te cuenta · 1 no cuenta/)
  await expect(semanas.nth(0).getByTestId('dnr-semana-nuevas')).toHaveText('2 nuevas')
  await expect(semanas.nth(0).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  await expect(semanas.nth(1)).toContainText(/^Del 25\/10 al 31\/10/)
  await expect(semanas.nth(1).getByTestId('dnr-recuento')).toHaveText('Ninguna')
  await expect(semanas.nth(1).getByTestId('dnr-recuento')).toHaveAttribute('data-vacia', 'ninguna')
  await expect(semanas.nth(1).getByRole('button')).toHaveCount(0)
  await expect(semanas.nth(2).getByTestId('dnr-mini-no_cuentan')).toHaveText('1')
  await expect(semanas.nth(2).getByTestId('dnr-semana-desglose')).toHaveText('1 no cuenta')
  await expect(pantalla.getByTestId('dnr-fila')).toHaveCount(2)

  // 4. Qué es cada color, al final y PLEGADO: un toque lo abre. «Pendiente» no dice que Amazon no la haya revisado.
  const estados = pantalla.getByTestId('dnr-estados')
  const boton = estados.getByRole('button', { name: 'Qué es cada color' })
  await expect(boton).toHaveAttribute('aria-expanded', 'false')
  await expect(estados.getByTestId('dnr-estado-explica')).toHaveCount(0)
  await boton.click()
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  await expect(estados.getByTestId('dnr-estado-explica')).toHaveText([
    'Amazon te la apunta como fallo.', 'Amazon la revisó y no te la apunta.', 'Aún no se sabe si te cuenta.'])
  await expect(estados).not.toContainText('aún no la ha revisado')
  // El orden en la pantalla: la frase, cuáles son, las anteriores y los colores.
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

test('con una sola, en singular y con su contador; sin ninguna que le cuente, el número no va en rojo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana(paquetes(1, 'sin_clasificar')) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 1')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 1 DNR')
  await expect(page.getByTestId('dnr-numero')).toHaveText('1')
  await expect(page.getByTestId('dnr-numero')).not.toHaveClass(/peligro/)
  const filas = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(1)
  await expect(filas.getByTestId('dnr-paquete')).toHaveText('TBA999000000000')
  if (!PAUSAS.estado) {
    await expect(page.getByTestId('dnr-desglose').locator('span[data-testid]')).toHaveText(['1 pendiente'])
    await expect(filas.getByTestId('dnr-estado')).toHaveText('Pendiente')
  } else {
    await expect(page.getByTestId('dnr-desglose')).toHaveCount(0)
    await expect(filas.getByTestId('dnr-estado')).toHaveCount(0)
  }
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('con cinco, el número y los contadores en plural', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([...paquetes(3), ...paquetes(2, 'no_cuenta', 'TBA88800000000'), ...paquetes(2, 'sin_clasificar', 'TBA77700000000')]) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 7')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 7 DNR')
  if (!PAUSAS.estado) await expect(page.getByTestId('dnr-desglose').locator('span[data-testid]')).toHaveText(['3 te cuentan', '2 no cuentan', '2 pendientes'])
  else await expect(page.getByTestId('dnr-desglose')).toHaveCount(0)
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(7)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin ninguna esta semana y con datos de esta semana: «Esta semana, ninguna» con la marca verde, y la casilla también', async ({ page }) => {
  const fallos = vigilar(page)
  // datos_hasta (10/11) ya es de esta semana (desde el 8/11): se sabe que no lleva ninguna.
  await entrar(page, { mias: conEstaSemana([]) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: ninguna')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana, ninguna')
  await expect(page.getByTestId('dnr-marca-verde')).toBeVisible()
  await expect(page.getByTestId('dnr-numero')).toHaveCount(0)
  await expect(page.getByTestId('dnr-desglose')).toHaveCount(0)
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(0)
  await expect(page.getByTestId('dnr-hasta')).toHaveText('Datos hasta el mar 10/11')
  // Las anteriores siguen ahí, cerradas.
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-semana')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /La semana pasada/ })).toHaveAttribute('aria-expanded', 'false')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F3/F6: un lunes sin datos de esta semana no dice «ninguna» ni pone la marca verde, y abre «La semana pasada»', async ({ page }) => {
  const fallos = vigilar(page)
  // Los datos acaban el sábado 7/11, antes del domingo 8/11 en que empieza esta semana: de esta semana no se sabe nada.
  await entrar(page, { mias: conEstaSemana([], { datos_hasta: '2026-11-07' }) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: sin datos')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('De esta semana aún no hay reportes')
  await expect(page.getByTestId('dnr-marca-verde')).toHaveCount(0)
  await expect(page.getByTestId('dnr-sin-marca')).toBeVisible()
  await expect(page.getByTestId('mis-dnr')).not.toContainText('ninguna')
  await expect(page.getByTestId('dnr-hasta')).toHaveText('Datos hasta el sáb 7/11')
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

test('F3/F18 y G5/G7: sin ningún reporte de su centro lo dice, sin «ninguna» ni marca verde en ninguna semana', async ({ page }) => {
  const fallos = vigilar(page)
  const vacias = { ...DATOS, datos_hasta: null, semanas: DATOS.semanas.map((s) => semana(s.semana, s.hasta, [])) }
  await entrar(page, { mias: vacias })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: sin datos')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Aún no hay reportes de tu centro')
  await expect(page.getByTestId('dnr-marca-verde')).toHaveCount(0)
  await expect(page.getByTestId('dnr-hasta')).toHaveCount(0)
  // G5/G7: las semanas anteriores, sin datos, no aseguran «Ninguna» en verde: «Sin datos», neutras.
  const recuentos = page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento')
  await expect(recuentos).toHaveText(['Sin datos', 'Sin datos', 'Sin datos'])
  for (const r of await recuentos.all()) await expect(r).not.toHaveClass(/ruta-ok/)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('Ninguna')
  // Ya no acusa a la oficina de no subir nada; el recordatorio sigue (salvo en pausa); «¿Alguna no es tuya?», no (G16: no
  // hay ninguna).
  await expect(page.getByTestId('mis-dnr')).not.toContainText('La oficina aún no ha subido')
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(PAUSAS.preferencia ? 0 : 1)
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('G5/G7: con datos que acaban antes de una semana anterior, esa semana dice «Sin datos» y la que sí los tiene, «Ninguna» en verde', async ({ page }) => {
  // Los datos acaban el miércoles 28/10: de la semana del 1/11 no se sabe nada; la del 25/10 sí tiene datos.
  const viejos = {
    ...DATOS, datos_hasta: '2026-10-28',
    semanas: [semana('2026-11-08', '2026-11-14', []), semana('2026-11-01', '2026-11-07', []), semana('2026-10-25', '2026-10-31', []),
      semana('2026-10-18', '2026-10-24', [dnr('2026-10-20', 'TBA123456789008', 'no_cuenta')])],
  }
  await entrar(page, { mias: viejos })
  await casilla(page).click()
  const filas = page.getByTestId('dnr-anteriores').getByTestId('dnr-semana')
  await expect(filas.nth(0).getByTestId('dnr-recuento')).toHaveText('Sin datos')
  await expect(filas.nth(0).getByTestId('dnr-recuento')).toHaveAttribute('data-vacia', 'sin_datos')
  await expect(filas.nth(1).getByTestId('dnr-recuento')).toHaveText('Ninguna')
  await expect(filas.nth(1).getByTestId('dnr-recuento')).toHaveClass(/text-ruta-ok-texto/)
})

test('G3: con un ID en revisión no se afirma nada de esta semana: ni «ninguna» ni la marca verde, y la casilla dice «en revisión»', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([], { en_revision: true }) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: en revisión')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-en-revision')).toContainText('puede que aquí falte alguna')
  await expect(page.getByTestId('dnr-frase')).toHaveText('Tu ID de reparto está en revisión')
  await expect(page.getByTestId('dnr-marca-verde')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('ninguna')
  // Las semanas anteriores vacías tampoco se celebran en verde.
  const vacia = page.getByTestId('dnr-anteriores').getByTestId('dnr-recuento').filter({ hasText: 'Ninguna' })
  await expect(vacia).toHaveAttribute('data-vacia', 'neutra')
  await expect(vacia).not.toHaveClass(/ruta-ok/)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('G3: con un ID en revisión y DNR esta semana, se enseñan, pero el número no se presenta como el total', async ({ page }) => {
  await entrar(page, { mias: conEstaSemana(paquetes(2), { en_revision: true }) })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: en revisión')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana, sin las que están en revisión 2 DNR')
  await expect(page.getByTestId('mis-dnr')).not.toContainText('llevas')
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(2)
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
  await expect(filas.nth(0).getByTestId('dnr-paquete')).toHaveText('TBA123456789010')
  await expect(filas.nth(1).getByTestId('dnr-paquete')).toHaveText('TBA123456789009')
  if (!PAUSAS.estado) {
    await expect(filas.nth(0).getByTestId('dnr-estado')).toHaveText('Te cuenta')
    await expect(filas.nth(1).getByTestId('dnr-estado')).toHaveText('No cuenta')
  }
  await expect(filas.nth(1).getByTestId('dnr-nueva')).toHaveText('Nueva')
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
  if (!PAUSAS.estado) await expect(page.getByTestId('dnr-fila').first().getByTestId('dnr-estado')).toHaveText('Counts')
  await contesta(page, conEstaSemana(paquetes(5)))
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: /^My DNRs/ }).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('This week you have 5 DNRs')
  if (!PAUSAS.estado) await expect(page.getByTestId('dnr-contador-cuentan')).toHaveText('5 count')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

// F13 no depende del estado: va aparte para que se mire también con el estado en pausa (última comprobación, K4).
test('F13: lo apuntado en el móvil no guarda ningún código de paquete', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: DATOS })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila').first()).toBeVisible()
  await page.getByRole('button', { name: 'Volver' }).click()
  const apuntado = await page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d1'))
  expect(apuntado).toBeTruthy()
  expect(apuntado).not.toMatch(/TBA|12345/)
  expect(Object.keys(JSON.parse(apuntado)).length).toBeGreaterThan(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('F4/F16 y F13: las que solo cambiaron de estado van aparte como «actualizadas» y no suman al número rojo; lo apuntado no guarda el código', async ({ page }) => {
  test.skip(PAUSAS.estado, PAUSA_ESTADO)
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
  expect(apuntado).not.toMatch(/TBA|12345/)
  expect(Object.keys(JSON.parse(apuntado))).toHaveLength(5)

  // Amazon clasifica las dos: ninguna DNR nueva. La casilla, sin número rojo y diciendo «2 actualizadas».
  await contesta(page, DATOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toHaveAccessibleName(/2 actualizadas/)
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva/)
  await expect(numeroRojo(page)).toHaveCount(0)
  await casilla(page).click()
  await expect(page.getByTestId('mis-dnr').getByText('2 actualizadas', { exact: true })).toBeVisible()
  await expect(page.getByTestId('mis-dnr')).not.toContainText(/\bnuevas?\b/i)
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789011' }).getByTestId('dnr-nueva')).toHaveText('Actualizada')
  // En la fila de la semana pasada, aparte y sin «nuevas».
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

test('G17: «Nueva» va en el tono de marca y «Actualizada» en gris, también en la tarjeta', async ({ page }) => {
  test.skip(PAUSAS.estado, PAUSA_ESTADO)
  const antes = structuredClone(DATOS)
  antes.semanas[0].dnr[1].estado = 'sin_clasificar'
  await entrar(page, { mias: antes })
  await casilla(page).click()
  await page.getByRole('button', { name: 'Volver' }).click()
  const despues = structuredClone(DATOS)
  despues.semanas[0].dnr.unshift(dnr('2026-11-11', 'TBA123456789013', 'sin_clasificar'))
  await contesta(page, despues)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await casilla(page).click()
  const color = (l) => l.evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g).map(Number)
    return Math.max(r, g, b) - Math.min(r, g, b)   // cuánto color tiene el relleno: 0 = gris
  })
  const nueva = page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789013' }).getByTestId('dnr-nueva')
  const actualizada = page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789011' }).getByTestId('dnr-nueva')
  await expect(nueva).toHaveText('Nueva')
  await expect(actualizada).toHaveText('Actualizada')
  expect(await color(actualizada)).toBeLessThan(25)
  expect(await color(nueva)).toBeGreaterThan(await color(actualizada))
})

test('G12: una DNR ya vista que deja de venir un rato y vuelve no sale otra vez como «Nueva»; lo de más de 5 semanas se poda', async ({ page }) => {
  const fallos = vigilar(page)
  // En el móvil, una huella vista hace 40 días (se poda) y otra hace un día (se queda), con una sal fija.
  await entrar(page, { vistas: { sal: 'salprueba', huellas: { vieja1: ['cuenta', 40 * 864e5], reciente1: ['cuenta', 864e5] } } })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(2)
  await page.getByRole('button', { name: 'Volver' }).click()
  const tras1 = JSON.parse(await page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d1')))
  expect(tras1.vieja1).toBeUndefined()
  expect(tras1.reciente1).toBeDefined()
  expect(Object.keys(tras1)).toHaveLength(6)
  // La 011 deja de venir (su ID entra en revisión) y la abre así.
  const sin011 = structuredClone(DATOS)
  sin011.en_revision = true
  sin011.semanas[0].dnr.splice(1, 1)
  await contesta(page, sin011)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila')).toHaveCount(1)
  await page.getByRole('button', { name: 'Volver' }).click()
  // Vuelve: ya la había visto, así que ni «Nueva» ni número rojo.
  await contesta(page, DATOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toBeVisible()
  await expect(numeroRojo(page)).toHaveCount(0)
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva/)
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789011' })).toBeVisible()
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(0)
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('G9: la huella lleva una sal de este móvil: el mismo paquete deja otra huella en otro móvil', async ({ browser, baseURL }) => {
  const huellasDe = async () => {
    const ctx = await browser.newContext({ baseURL })
    const page = await ctx.newPage()
    await entrar(page)
    await casilla(page).click()
    await expect(page.getByTestId('dnr-fila').first()).toBeVisible()
    const r = await page.evaluate(() => ({ sal: localStorage.getItem('fds_dnr_sal'), vistas: localStorage.getItem('fds_dnr_vistas_d1') }))
    await ctx.close()
    return r
  }
  const [a, b] = [await huellasDe(), await huellasDe()]
  expect(a.sal).toBeTruthy()
  expect(a.sal).not.toBe(b.sal)
  const ka = Object.keys(JSON.parse(a.vistas)).sort()
  const kb = Object.keys(JSON.parse(b.vistas)).sort()
  expect(ka).toHaveLength(5)
  expect(ka.filter((k) => kb.includes(k))).toHaveLength(0)
})

test('sin el módulo de la DNR diaria («Sin DNR diaria») no hay casilla, y no se vuelve a preguntar en 12 horas (F21)', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidas = await entrar(page, { mias: SIN_DNR, status: 404 })
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

test('G10: el 404 genérico (un servidor que aún no tiene la ruta) esconde la casilla pero NO se recuerda 12 horas', async ({ page }) => {
  const pedidas = await entrar(page, { mias: NOT_FOUND, status: 404 })
  await expect.poll(() => pedidas.length).toBe(1)
  await expect(casilla(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fds_dnr_no_d1'))).toBeNull()
  // El servidor ya la tiene: al abrir el portal otra vez, la pide y sale la casilla.
  await contesta(page, DATOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toBeVisible()
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

test('G8: abierta con ?vista=dnr en una empresa sin la DNR diaria, vuelve al inicio (sin «Reintentar») y lo apunta', async ({ page }) => {
  const pedidas = await entrar(page, { mias: SIN_DNR, status: 404, url: '/conductor?vista=dnr', ancla: false })
  await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
  await expect(page.getByText('No se han podido cargar tus DNR.')).toHaveCount(0)
  await expect(casilla(page)).toHaveCount(0)
  // Apuntado como la casilla: el inicio no la vuelve a pedir.
  expect(Number(await page.evaluate(() => localStorage.getItem('fds_dnr_no_d1')))).toBeGreaterThan(0)
  await page.waitForLoadState('networkidle')
  expect(pedidas).toHaveLength(1)
})

test('G8: abierta con ?vista=dnr y la ficha de baja (403), vuelve al inicio sin «Reintentar»', async ({ page }) => {
  await entrar(page, { mias: { detail: 'Tu ficha está de baja' }, status: 403, url: '/conductor?vista=dnr', ancla: false })
  await expect(page.getByRole('heading', { name: /Hola, ANA/ })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
  await expect(casilla(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fds_dnr_no_d1'))).toBeNull()
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
  await expect(page.getByTestId('dnr-casilla-semana')).toHaveCount(0)
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

test('con el ID en revisión y nada que enseñar (G1) lo dice, y sin «¿Alguna no es tuya?» (G16); la casilla, «en revisión»', async ({ page }) => {
  await entrar(page, { mias: { tiene_id: true, en_revision: true, datos_hasta: '2026-11-10', semanas: [] } })
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: en revisión')
  await casilla(page).click()
  await expect(page.getByTestId('dnr-en-revision')).toContainText('La oficina está revisando tu ID de reparto')
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveCount(0)
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(0)
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
  await entrar(page, { url: '/conductor?vista=dnr', ancla: false })
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR', { timeout: 15000 })
  await expect(page.getByTestId('dnr-semana')).toHaveCount(3)
})

test('en el móvil el resumen y el recordatorio se ven sin bajar, nada se sale de lado y lo que se toca mide al menos 44', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, { mias: conEstaSemana(paquetes(5)) })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-semana')).toHaveCount(3)
  for (const t of ['dnr-resumen', ...(PAUSAS.preferencia ? [] : ['dnr-recordatorio'])]) {
    const caja = await page.getByTestId(t).boundingBox()
    expect(caja.y + caja.height).toBeLessThanOrEqual(844)
  }
  // Y con una semana anterior abierta y los colores abiertos, nada se sale.
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  if (!PAUSAS.estado) await abrirColores(page)
  await expect(page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')).toHaveCount(2)
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
  for (const b of await page.getByTestId('mis-dnr').getByRole('button').all()) {
    const caja = await b.boundingBox()
    expect(caja.height).toBeGreaterThanOrEqual(44)
  }
  // Ninguna tarjeta queda fuera de la pantalla.
  for (const f of await page.getByTestId('dnr-fila').all()) {
    const caja = await f.boundingBox()
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width).toBeLessThanOrEqual(390)
  }
})

test('V5: cada DNR con su estado y su día arriba, el paquete, el CP y qué pasó en etiquetas cortas (la frase larga, para el lector de pantalla)', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const esta = page.getByTestId('dnr-esta-semana')
  const [sinDatos, conTodo] = [esta.getByTestId('dnr-fila').nth(0), esta.getByTestId('dnr-fila').nth(1)]

  // F8/F9: con el día de la entrega, ese arriba (con su furgoneta y su frase para el lector) y, abajo, el CP y el de la DNR.
  await expect(conTodo.getByTestId('dnr-dia')).toHaveText('sáb 7/11')
  await expect(conTodo.getByTestId('dnr-dia-frase')).toHaveText('Entregado el sáb 7/11')
  await expect(conTodo.getByTestId('dnr-cp')).toHaveText('CP 15704')
  await expect(conTodo.getByTestId('dnr-concesion')).toHaveText('DNR lun 9/11')
  await expect(conTodo.getByTestId('dnr-paquete')).toHaveText('TBA123456789011')
  const yDe = async (l) => (await l.boundingBox()).y
  expect(await yDe(conTodo.getByTestId('dnr-paquete'))).toBeLessThan(await yDe(conTodo.getByTestId('dnr-concesion')))
  // Sin él, arriba el de la DNR, dicho como lo que es; abajo, solo el CP.
  await expect(sinDatos.getByTestId('dnr-dia')).toHaveText('DNR mar 10/11')
  await expect(sinDatos.getByTestId('dnr-dia-frase')).toHaveCount(0)
  await expect(sinDatos.getByTestId('dnr-concesion')).toHaveCount(0)
  await expect(sinDatos.getByTestId('dnr-cp')).toHaveText('CP 15704')

  // La que trae de todo: cada cosa en su etiqueta corta, con su tono y su frase larga.
  if (!PAUSAS.estado) await expect(conTodo.getByTestId('dnr-estado')).toHaveText('Te cuenta')
  const hecho = (k) => conTodo.getByTestId(`dnr-hecho-${k}`)
  const esperado = [
    ['como', 'Puerta', 'dato', 'Lo marcaste en la puerta'],
    ['lejos', 'A más de 25 m', 'fallo', 'Lo marcaste a más de 25 m del sitio'],
    ['llamada', 'Sin llamada', 'fallo', 'No llamaste al cliente'],
    ['foto', 'Foto borrosa', 'fallo', 'La foto no pasó la revisión: salió borrosa'],
  ]
  for (const [k, visible, tono, frase] of esperado) {
    await expect(corto(hecho(k))).toHaveText(visible)
    await expect(hecho(k)).toHaveAttribute('data-tono', tono)
    await expect(hecho(k)).toHaveAttribute('title', frase)
    await expect(hecho(k).locator('.sr-only')).toHaveText(frase)
  }
  // «Sin llamada» ya dice el fallo de contacto: no se repite. Y ya no hay bloque de consejos: lo dicen las etiquetas.
  await expect(hecho('contacto')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('Lo que puedes hacer la próxima vez')
  // La que le cuenta se distingue de un vistazo: su banda roja; las otras, sin ella (con el estado en pausa, ninguna).
  const banda = (l) => l.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth))
  if (!PAUSAS.estado) {
    await expect(conTodo).toHaveAttribute('data-cuenta', 'si')
    expect(await banda(conTodo)).toBeGreaterThanOrEqual(4)
  } else {
    expect(await banda(conTodo)).toBe(0)
  }
  expect(await banda(sinDatos)).toBe(0)

  // La que no trae nada que se entienda: solo día, CP, paquete y estado.
  await expect(sinDatos.getByTestId('dnr-que-paso')).toHaveCount(0)

  // La semana pasada: la que llamó solo 12 s (R9: «Llamada corta», que ya dice el fallo de contacto), y la que no trae CP,
  // sin CP.
  await page.getByRole('button', { name: /La semana pasada/ }).click()
  const pasada = page.getByTestId('dnr-anteriores').getByTestId('dnr-fila')
  await expect(pasada.nth(0).getByTestId('dnr-dia')).toHaveText('DNR mié 4/11')
  await expect(corto(pasada.nth(0).getByTestId('dnr-hecho-como'))).toHaveText('Buzón')
  await expect(corto(pasada.nth(0).getByTestId('dnr-hecho-lejos'))).toHaveText('En el sitio')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-lejos')).toHaveAttribute('data-tono', 'bien')
  await expect(corto(pasada.nth(0).getByTestId('dnr-hecho-llamada'))).toHaveText('Llamada corta · 12 s')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-llamada')).toHaveAttribute('data-tono', 'fallo')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-llamada')).toHaveAttribute('title', 'Tu llamada al cliente duró 12 segundos; tiene que durar 30 como mínimo')
  await expect(pasada.nth(0).getByTestId('dnr-hecho-contacto')).toHaveCount(0)
  await expect(pasada.nth(1).getByTestId('dnr-paquete')).toHaveText('TBA123456789009')
  await expect(pasada.nth(1).getByTestId('dnr-cp')).toHaveCount(0)
  await expect(pasada.nth(1).getByTestId('dnr-dia')).toHaveText('DNR mar 3/11')
  // Sin euros, nunca.
  await expect(page.getByTestId('mis-dnr')).not.toContainText('€')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('V5: el recordatorio pone la CONDICIÓN arriba y con peso, y debajo llama + foto clara → no te cuenta; el lector lee la frase entera', async ({ page }) => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  await entrar(page)
  await casilla(page).click()
  const r = page.getByTestId('dnr-recordatorio')
  const condicion = r.getByTestId('dnr-recordatorio-condicion')
  const pasos = r.getByTestId('dnr-recordatorio-pasos')
  await expect(condicion).toHaveText('Solo si el cliente tiene preferencia de entrega')
  await expect(pasos).toHaveText(/Llama\s*\+\s*Foto clara\s*No te cuenta/)
  const frase = 'Recuerda: para que no te cuente, el cliente tiene que tener preferencia de entrega, y tú llamar y sacar bien la foto.'
  await expect(r.getByTestId('dnr-recordatorio-frase')).toHaveText(frase)
  // H4 (revisión 4): lo que se ve, oculto al lector, y la frase entera leída una sola vez.
  for (const l of [condicion, pasos]) expect(await l.evaluate((el) => !!el.closest('[aria-hidden="true"]'))).toBe(true)
  const arbol = await r.ariaSnapshot()
  expect(arbol.split(frase).length - 1).toBe(1)
  expect(arbol).not.toMatch(/Solo si el cliente|Foto clara|No te cuenta/)
  // La condición, arriba y con la letra más grande del bloque.
  const tam = (l) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(await tam(condicion)).toBeGreaterThan(await tam(pasos))
  const yDe = async (l) => (await l.boundingBox()).y
  expect(await yDe(condicion)).toBeLessThan(await yDe(pasos))
  // Con borde, para que destaque; bajo el resumen y antes de las tarjetas.
  expect(await r.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThan(0)
  expect(await yDe(page.getByTestId('dnr-resumen'))).toBeLessThan(await yDe(r))
  expect(await yDe(r)).toBeLessThan(await yDe(page.getByTestId('dnr-fila').first()))
  // La frase vieja ya no está. El botón del ejemplo («¿Cómo sé si tiene preferencia?», R11) va dentro del recordatorio,
  // DEBAJO de la fila de pasos (sus pruebas, abajo: «Ejemplo: …»).
  await expect(page.getByTestId('mis-dnr')).not.toContainText('así no te cuenta')
  const ejemplo = r.getByRole('button', { name: '¿Cómo sé si tiene preferencia?' })
  await expect(ejemplo).toBeVisible()
  expect(await yDe(ejemplo)).toBeGreaterThan(await yDe(pasos))
  // Y «díselo a la oficina», al final (con el estado encendido, después de «Qué es cada color»).
  await expect(page.getByTestId('dnr-no-es-mia')).toHaveText('¿Alguna no es tuya? Díselo a la oficina.')
  expect(await yDe(r)).toBeLessThan(await yDe(page.getByTestId('dnr-no-es-mia')))
  if (!PAUSAS.estado) expect(await yDe(page.getByTestId('dnr-estados'))).toBeLessThan(await yDe(page.getByTestId('dnr-no-es-mia')))
})

test('G13/G18: si la entrega es el mismo día que la DNR, la fecha sale una sola vez', async ({ page }) => {
  await entrar(page, { mias: conEstaSemana([dnr('2026-11-09', 'TBA123456789011', 'cuenta', { entrega: '2026-11-09' })]) })
  await casilla(page).click()
  const f = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(f.getByTestId('dnr-dia')).toHaveText('DNR lun 9/11')
  await expect(f.getByTestId('dnr-concesion')).toHaveCount(0)
  await expect(f.getByTestId('dnr-dia-frase')).toHaveCount(0)
  await expect(f).not.toContainText(/9\/11.*9\/11/)
})

test('F31: «Te cuenta» pesa más a la vista que «No cuenta» (que no va en verde relleno)', async ({ page }) => {
  test.skip(PAUSAS.estado, PAUSA_ESTADO)
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
  await expect(noCuenta).toHaveText('No cuenta')
  // La buena, en gris; la que cuenta, con su color de peligro.
  expect(await fondo(noCuenta)).toBeLessThan(25)
  const color = (l) => l.evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).color.match(/\d+(\.\d+)?/g).map(Number)
    return Math.max(r, g, b) - Math.min(r, g, b)
  })
  expect(await color(cuenta)).toBeGreaterThan(await color(noCuenta))
})

test('F28: el foco del teclado se ve, por dentro, en los botones de las semanas anteriores y en «Qué es cada color»', async ({ page }) => {
  await entrar(page)
  await casilla(page).click()
  const botones = [page.getByRole('button', { name: /La semana pasada/ })]
  if (!PAUSAS.estado) botones.push(page.getByRole('button', { name: 'Qué es cada color' }))
  for (const boton of botones) {
    await expect(boton).toBeVisible()
    let enfocado = false
    for (let k = 0; k < 40 && !enfocado; k++) {
      await page.keyboard.press('Tab')
      enfocado = await boton.evaluate((el) => document.activeElement === el)
    }
    expect(enfocado).toBe(true)
    expect(await boton.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/inset/)
  }
})

for (const [idioma, nombre, entregado] of [['de', /^Meine DNRs/, 'Zugestellt am'], ['fr', /^Mes DNR/, 'Livré le']]) {
  test(`F27, F32, V5 y R9: a 360 px en ${idioma} y con «Letra más grande», el paquete entero en una línea, las etiquetas y el aviso de la llamada saltan sin cortarse y los colores sin apretar`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.addInitScript((l) => {
      localStorage.setItem('fds_idioma', l)
      localStorage.setItem('fds_letra', 'grande')
      document.documentElement.setAttribute('data-letra', 'grande')
    }, idioma)
    const largos = conEstaSemana([
      dnr('2026-11-10', 'TBA319482771045', 'sin_clasificar', { como: 'puerta_trasera', lejos: false, llamada: 'corta', segundos: 8, fallo_contacto: true, foto: 'bien' }),
      dnr('2026-11-09', 'TBA319400000009', 'cuenta', { entrega: '2026-11-07', como: 'conserjeria', lejos: true, llamada: 'no', fallo_contacto: true, foto: 'mal', foto_motivo: 'en_furgoneta' }),
    ])
    await entrar(page, { mias: largos })
    await page.getByRole('button', { name: nombre }).click()
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
      // Cada etiqueta de qué pasó, dentro de su tarjeta y entera (salta de línea, no se corta con «…»).
      for (const h of await f.locator('[data-testid^="dnr-hecho-"]').all()) {
        const r = await h.evaluate((el) => {
          const c = el.querySelector('[data-corto]')
          return { derecha: el.getBoundingClientRect().right, fila: el.closest('[data-testid="dnr-fila"]').getBoundingClientRect().right, cortada: c.scrollWidth > c.clientWidth + 1 }
        })
        expect(r.derecha).toBeLessThanOrEqual(r.fila)
        expect(r.cortada).toBe(false)
      }
      // R9: el aviso de los 30 segundos (las dos tienen fallo de contacto), dentro de su tarjeta y sin cortarse.
      const a = await f.getByTestId('dnr-aviso-llamada').evaluate((el) => ({
        derecha: el.getBoundingClientRect().right, fila: el.closest('[data-testid="dnr-fila"]').getBoundingClientRect().right,
        cortada: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      }))
      expect(a.derecha).toBeLessThanOrEqual(a.fila)
      expect(a.cortada).toBe(false)
    }
    await expect(page.getByTestId('dnr-fila').nth(1).getByTestId('dnr-dia-frase')).toContainText(entregado)
    // Los pasos del recordatorio, dentro de su bloque.
    if (!PAUSAS.preferencia) {
      const r = await page.getByTestId('dnr-recordatorio').evaluate((el) => ({
        dentro: [...el.querySelectorAll('[data-testid="dnr-recordatorio-pasos"] > *')].every((x) => x.getBoundingClientRect().right <= el.getBoundingClientRect().right),
      }))
      expect(r.dentro).toBe(true)
    }
    // Cada explicación de los colores, debajo de su etiqueta y con todo el ancho: como mucho dos líneas.
    if (!PAUSAS.estado) {
      await page.getByTestId('dnr-estados').getByRole('button').click()
      for (const dd of await page.getByTestId('dnr-estado-explica').all()) {
        const { lineas, bajo } = await dd.evaluate((el) => {
          const dt = el.previousElementSibling.getBoundingClientRect()
          const rr = el.getBoundingClientRect()
          return { lineas: rr.height / parseFloat(getComputedStyle(el).lineHeight), bajo: rr.top >= dt.bottom - 1 }
        })
        expect(lineas).toBeLessThan(2.5)
        expect(bajo).toBe(true)
      }
    }
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
  })
}

for (const [idioma, nombre, texto] of [['de', /^Meine DNRs/, 'Diese Woche: keine Daten'], ['fr', /^Mes DNR/, 'Cette semaine : pas de données']]) {
  test(`G6: en ${idioma}, a 360 px y con «Letra más grande», la línea de la casilla va fuera del recorte del título y no se corta`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.addInitScript((l) => {
      localStorage.setItem('fds_idioma', l)
      localStorage.setItem('fds_letra', 'grande')
      document.documentElement.setAttribute('data-letra', 'grande')
    }, idioma)
    await entrar(page, { mias: conEstaSemana([], { datos_hasta: '2026-11-07' }) })
    const linea = page.getByRole('button', { name: nombre }).getByTestId('dnr-casilla-semana')
    await expect(linea).toHaveText(texto)
    const r = await linea.evaluate((el) => {
      const caja = el.parentElement
      return { enTitulo: !!el.closest('.text-boton'), cortada: caja.scrollHeight > caja.clientHeight + 1 }
    })
    expect(r.enTitulo).toBe(false)
    expect(r.cortada).toBe(false)
  })
}

test('G14: el número va pegado a sus dos puntos, y en francés los dos puntos a su palabra', async ({ page }) => {
  await entrar(page)
  expect(await casilla(page).getByTestId('dnr-casilla-semana').evaluate((el) => el.textContent)).toBe('Esta semana: 2')
  await page.evaluate(() => localStorage.setItem('fds_idioma', 'fr'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  const linea = page.getByRole('button', { name: /^Mes DNR/ }).getByTestId('dnr-casilla-semana')
  await expect(linea).toHaveText('Cette semaine : 2')
  expect(await linea.evaluate((el) => el.textContent)).toBe('Cette semaine : 2')
})

test('«díselo a la oficina» también sin ninguna esta semana si hay alguna en las anteriores; sin ID, ni el recordatorio ni eso', async ({ page }) => {
  await entrar(page, { mias: conEstaSemana([]) })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana, ninguna')
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(PAUSAS.preferencia ? 0 : 1)
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

/* R9 (Dani, 11-11-2026): «en los fallos de contacto: ponles que dando tono no podemos colgar nosotros la llamada y mínimo
   deben ser 30 segundos, aunque llames y te abra en la puerta la llamada debe seguir corriendo 30 segundos mínimo». */
const AVISO_30 = 'La llamada, mínimo 30 segundos. No cuelgues tú mientras da tono, aunque te abran la puerta.'

test('R9: «Llamada corta · 12 s» en tono fallo y con su frase para el lector; «Llamaste · 45 s» en bien; y el aviso de los 30 segundos, una vez y debajo de las etiquetas, solo en las DNR con fallo de contacto', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([
    dnr('2026-11-10', 'TBA500000000001', 'cuenta', { llamada: 'corta', segundos: 12, fallo_contacto: true }),
    dnr('2026-11-10', 'TBA500000000002', 'cuenta', { como: 'puerta', llamada: 'no', fallo_contacto: true, foto: 'mal', foto_motivo: 'oscura' }),
    dnr('2026-11-09', 'TBA500000000003', 'no_cuenta', { como: 'buzon', llamada: 'si', segundos: 45, foto: 'bien' }),
    dnr('2026-11-09', 'TBA500000000004', 'sin_clasificar', { como: 'en_mano', lejos: true }),
    // El fallo de contacto sin nada de la llamada: R9 no lo manda así, pero la web lo enseña como hasta ahora.
    dnr('2026-11-08', 'TBA500000000005', 'sin_clasificar', { fallo_contacto: true }),
  ]) })
  await casilla(page).click()
  const filas = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(5)
  const [corta, sin, larga, nada, contacto] = [0, 1, 2, 3, 4].map((k) => filas.nth(k))
  const llamada = (f) => f.getByTestId('dnr-hecho-llamada')
  const aviso = (f) => f.getByTestId('dnr-aviso-llamada')

  // La corta: su etiqueta en fallo, la frase larga para el lector y como title; y no repite «Fallo de contacto».
  await expect(corto(llamada(corta))).toHaveText('Llamada corta · 12 s')
  await expect(llamada(corta)).toHaveAttribute('data-tono', 'fallo')
  await expect(llamada(corta)).toHaveAttribute('title', 'Tu llamada al cliente duró 12 segundos; tiene que durar 30 como mínimo')
  await expect(llamada(corta).locator('.sr-only')).toHaveText('Tu llamada al cliente duró 12 segundos; tiene que durar 30 como mínimo')
  await expect(corta.getByTestId('dnr-hecho-contacto')).toHaveCount(0)
  // La de 45 s, bien; la que no llamó, «Sin llamada»; la del fallo sin llamada, «Fallo de contacto».
  await expect(corto(llamada(larga))).toHaveText('Llamaste · 45 s')
  await expect(llamada(larga)).toHaveAttribute('data-tono', 'bien')
  await expect(corto(llamada(sin))).toHaveText('Sin llamada')
  await expect(corto(contacto.getByTestId('dnr-hecho-contacto'))).toHaveText('Fallo de contacto')

  // El aviso: una vez en cada una con fallo de contacto (corta, sin llamada, fallo de contacto) y en ninguna otra.
  for (const f of [corta, sin, contacto]) {
    await expect(aviso(f)).toHaveCount(1)
    await expect(aviso(f)).toHaveText(AVISO_30)
    await expect(aviso(f)).toHaveClass(/bg-ruta-aviso/)
    await expect(aviso(f).locator('svg')).toHaveCount(1)
    // Debajo de sus etiquetas.
    const q = await f.getByTestId('dnr-que-paso').boundingBox()
    const a = await aviso(f).boundingBox()
    expect(a.y).toBeGreaterThanOrEqual(q.y + q.height - 1)
  }
  for (const f of [larga, nada]) await expect(aviso(f)).toHaveCount(0)
  await expect(page.getByTestId('dnr-aviso-llamada')).toHaveCount(3)
  // Lo que se sigue sin decir: el bloque de consejos de antes.
  await expect(page.getByTestId('mis-dnr')).not.toContainText('Lo que puedes hacer la próxima vez')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('R9: en inglés, la llamada corta y el aviso de los 30 segundos, traducidos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fds_idioma', 'en'))
  await entrar(page, { mias: conEstaSemana([dnr('2026-11-10', 'TBA500000000001', 'cuenta', { llamada: 'corta', segundos: 9, fallo_contacto: true })]) })
  await page.getByRole('button', { name: /^My DNRs/ }).click()
  const f = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(corto(f.getByTestId('dnr-hecho-llamada'))).toHaveText('Short call · 9 s')
  await expect(f.getByTestId('dnr-aviso-llamada')).toHaveText('Calls: 30 seconds minimum. Don’t hang up while it’s ringing, even if they open the door.')
})

test('R9 (lo que se publica): con el estado en pausa no se dice en ningún sitio si le cuenta: ni etiqueta ni banda, ni contadores, ni «Qué es cada color», ni «Actualizada»; el número en el color normal y las semanas anteriores con su total', async ({ page }) => {
  test.skip(!PAUSAS.estado, 'solo mientras el estado está en pausa (dnrPausas.js)')
  const fallos = vigilar(page)
  await entrar(page)
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  await expect(numeroRojo(page)).toHaveText('5')
  await expect(casilla(page)).toHaveAccessibleName(/5 nuevas/)
  await casilla(page).click()
  const pantalla = page.getByTestId('mis-dnr')

  // 1. El resumen: «Esta semana llevas», el número grande en el color normal (aunque una le cuente), el rango y hasta
  //    cuándo hay datos. Sin contadores.
  await expect(pantalla.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveText('2')
  await expect(pantalla.getByTestId('dnr-numero')).toHaveClass(/text-dark-50/)
  await expect(pantalla.getByTestId('dnr-numero')).not.toHaveClass(/peligro/)
  await expect(pantalla.getByTestId('dnr-rango')).toHaveText('Del 8/11 al 14/11')
  await expect(pantalla.getByTestId('dnr-hasta')).toHaveText('Datos hasta el mar 10/11')
  await expect(pantalla.getByTestId('dnr-desglose')).toHaveCount(0)
  await expect(pantalla.locator('[data-testid^="dnr-contador-"]')).toHaveCount(0)

  // 2. Las tarjetas: el día arriba a la izquierda (y «Nueva» a su derecha), el paquete, el CP y qué pasó. Sin estado ni
  //    banda. El aviso de los 30 segundos, solo en la que no llamó.
  const filas = pantalla.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(2)
  await expect(pantalla.getByTestId('dnr-estado')).toHaveCount(0)
  await expect(filas.nth(0).getByTestId('dnr-nueva')).toHaveText('Nueva')
  for (const f of await filas.all()) {
    expect(await f.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth))).toBe(0)
    expect(await f.getAttribute('data-cuenta')).toBeNull()
  }
  const conTodo = filas.nth(1)
  const caja = async (t) => conTodo.getByTestId(t).boundingBox()
  const [fila, dia, paquete, cp, quePaso] = [await conTodo.boundingBox(), await caja('dnr-dia'), await caja('dnr-paquete'), await caja('dnr-cp'), await caja('dnr-que-paso')]
  expect(dia.x - fila.x).toBeLessThan(40)
  expect(dia.y).toBeLessThan(paquete.y)
  expect(paquete.y).toBeLessThan(cp.y)
  expect(cp.y).toBeLessThan(quePaso.y)
  const nueva = await filas.nth(0).getByTestId('dnr-nueva').boundingBox()
  const dia0 = await filas.nth(0).getByTestId('dnr-dia').boundingBox()
  expect(nueva.x).toBeGreaterThan(dia0.x + dia0.width)
  await expect(conTodo.getByTestId('dnr-aviso-llamada')).toHaveText(AVISO_30)
  await expect(filas.nth(0).getByTestId('dnr-aviso-llamada')).toHaveCount(0)

  // 3. Las semanas anteriores: su total a la derecha («2 DNR» / «1 DNR»), «Ninguna» como siempre; sin mini contadores.
  const semanas = pantalla.getByTestId('dnr-anteriores').getByTestId('dnr-semana')
  await expect(semanas.getByTestId('dnr-recuento')).toHaveText(['2 DNR', 'Ninguna', '1 DNR'])
  await expect(semanas.nth(0).getByRole('button')).toHaveAccessibleName(/La semana pasada.*2 DNR/)
  await expect(pantalla.locator('[data-testid^="dnr-mini-"]')).toHaveCount(0)
  await expect(pantalla.getByTestId('dnr-semana-desglose')).toHaveCount(0)
  await semanas.nth(0).getByRole('button').click()
  await expect(pantalla.getByTestId('dnr-anteriores').getByTestId('dnr-fila')).toHaveCount(2)
  await expect(pantalla.getByTestId('dnr-estado')).toHaveCount(0)

  // 4. Ni «Qué es cada color»; sí «¿Alguna no es tuya?».
  await expect(pantalla.getByTestId('dnr-estados')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Qué es cada color' })).toHaveCount(0)
  await expect(pantalla.getByTestId('dnr-no-es-mia')).toHaveText('¿Alguna no es tuya? Díselo a la oficina.')

  // Tampoco para el lector de pantalla ni en un title: en todo lo que pinta la pantalla (salvo el recordatorio, que tiene
  // su propia pausa), nada de «cuenta», «pendiente», «actualizada» ni de los colores.
  const html = await pantalla.evaluate((el) => {
    const c = el.cloneNode(true)
    c.querySelectorAll('[data-testid="dnr-recordatorio"]').forEach((x) => x.remove())
    return c.outerHTML
  })
  expect(html).not.toMatch(/cuenta|cuentan|pendiente|actualizad|cada color/i)
  await expect(pantalla).not.toContainText('€')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('R9 (lo que se publica): con el estado en pausa, una DNR que solo cambia de estado no es novedad (ni se marca ni suma); una que no estaba, sí', async ({ page }) => {
  test.skip(!PAUSAS.estado, 'solo mientras el estado está en pausa (dnrPausas.js)')
  const fallos = vigilar(page)
  // La primera vez: 011 y 009 sin clasificar. Las ve.
  const antes = structuredClone(DATOS)
  antes.semanas[0].dnr[1].estado = 'sin_clasificar'
  antes.semanas[1].dnr[1].estado = 'sin_clasificar'
  await entrar(page, { mias: antes })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(2)
  await page.getByRole('button', { name: 'Volver' }).click()

  // Amazon clasifica las dos: nada nuevo. Ni número rojo, ni «actualizadas», ni marca en la tarjeta ni en la semana.
  await contesta(page, DATOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(casilla(page)).toBeVisible()
  await expect(casilla(page).getByTestId('dnr-casilla-semana')).toHaveText('Esta semana: 2')
  await expect(numeroRojo(page)).toHaveCount(0)
  await expect(casilla(page)).not.toHaveAccessibleName(/nueva|actualiz/i)
  await casilla(page).click()
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')).toHaveCount(2)
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(0)
  await expect(page.getByTestId('dnr-semana-actualizadas')).toHaveCount(0)
  await expect(page.getByTestId('dnr-semana-nuevas')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText(/nueva|actualiz/i)
  await page.getByRole('button', { name: 'Volver' }).click()

  // Y una que no estaba: esa sí es nueva y suma al número rojo.
  const mas = structuredClone(DATOS)
  mas.semanas[0].dnr.unshift(dnr('2026-11-10', 'TBA123456789013', 'sin_clasificar'))
  await contesta(page, mas)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(numeroRojo(page)).toHaveText('1')
  await expect(casilla(page)).toHaveAccessibleName(/1 nueva/)
  await casilla(page).click()
  await expect(page.getByTestId('dnr-nueva')).toHaveCount(1)
  await expect(page.getByTestId('dnr-fila').filter({ hasText: 'TBA123456789013' }).getByTestId('dnr-nueva')).toHaveText('Nueva')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('R9 (lo que se publica): con la preferencia en pausa no sale el recordatorio ni el botón del ejemplo, y no queda hueco: bajo el resumen, las tarjetas', async ({ page }) => {
  test.skip(!PAUSAS.preferencia, 'solo mientras la preferencia está en pausa (dnrPausas.js)')
  await entrar(page)
  await casilla(page).click()
  await expect(page.getByTestId('dnr-fila').first()).toBeVisible()
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /preferencia/ })).toHaveCount(0)
  const html = await page.getByTestId('mis-dnr').evaluate((el) => el.outerHTML)
  expect(html).not.toMatch(/preferencia|Foto clara|No te cuenta|Recuerda/i)
  // Sin hueco: la primera tarjeta, justo debajo del resumen (el hueco de la columna).
  const r = await page.getByTestId('dnr-resumen').boundingBox()
  const f = await page.getByTestId('dnr-fila').first().boundingBox()
  expect(f.y).toBeGreaterThanOrEqual(r.y + r.height)
  expect(f.y - (r.y + r.height)).toBeLessThanOrEqual(16)
  // Tampoco sin DNR esta semana.
  await page.getByRole('button', { name: 'Volver' }).click()
  await contesta(page, conEstaSemana([]))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana, ninguna')
  await expect(page.getByTestId('dnr-recordatorio')).toHaveCount(0)
})

/* REVISIÓN 4 (11-11-2026, R10), H4: lo que se VE de cada etiqueta va oculto al lector de pantalla (aria-hidden) y su frase
   larga se lee UNA vez; y los casos que no tenían prueba: «Foto bien», «Foto mal» sin motivo o con uno que la web no
   conoce, «Llamaste» sin segundos y un `como` desconocido (no pinta etiqueta). Lo que lee el lector sale del árbol
   accesible (ariaSnapshot), donde no entra lo que lleva aria-hidden. */
const vecesEnArbol = async (l, texto) => (await l.ariaSnapshot()).split(texto).length - 1

test('H4: cada etiqueta de qué pasó: lo visible, oculto al lector, y la frase larga leída una vez; foto bien, foto mal sin motivo o con uno desconocido, «Llamaste» sin segundos y un «como» desconocido', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page, { mias: conEstaSemana([
    dnr('2026-11-10', 'TBA600000000001', 'sin_clasificar', { como: 'xyz', llamada: 'si', foto: 'bien' }),
    dnr('2026-11-10', 'TBA600000000002', 'sin_clasificar', { foto: 'mal', foto_motivo: null }),
    dnr('2026-11-09', 'TBA600000000003', 'sin_clasificar', { foto: 'mal', foto_motivo: 'xyz' }),
    dnr('2026-11-09', 'TBA600000000004', 'sin_clasificar', { como: 'xyz' }),
    dnr('2026-11-08', 'TBA600000000005', 'cuenta', { como: 'familiar', lejos: true, llamada: 'corta', segundos: 12, fallo_contacto: true, foto: 'mal', foto_motivo: 'borrosa' }),
  ]) })
  await casilla(page).click()
  const filas = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
  await expect(filas).toHaveCount(5)
  const [bien, sinMotivo, motivoRaro, comoRaro, deTodo] = [0, 1, 2, 3, 4].map((k) => filas.nth(k))
  const esperado = [
    [bien, 'llamada', 'Llamaste', 'bien', 'Llamaste al cliente'],
    [bien, 'foto', 'Foto bien', 'bien', 'La foto pasó la revisión'],
    [sinMotivo, 'foto', 'Foto mal', 'fallo', 'La foto no pasó la revisión'],
    [motivoRaro, 'foto', 'Foto mal', 'fallo', 'La foto no pasó la revisión'],
    [deTodo, 'como', 'Familiar', 'dato', 'Lo marcaste como entregado a alguien de la casa'],
    [deTodo, 'lejos', 'A más de 25 m', 'fallo', 'Lo marcaste a más de 25 m del sitio'],
    [deTodo, 'llamada', 'Llamada corta · 12 s', 'fallo', 'Tu llamada al cliente duró 12 segundos; tiene que durar 30 como mínimo'],
    [deTodo, 'foto', 'Foto borrosa', 'fallo', 'La foto no pasó la revisión: salió borrosa'],
  ]
  for (const [f, k, visible, tono, frase] of esperado) {
    const h = f.getByTestId(`dnr-hecho-${k}`)
    await expect(corto(h)).toHaveText(visible)
    await expect(h).toHaveAttribute('data-tono', tono)
    await expect(h).toHaveAttribute('title', frase)
    await expect(h.locator('.sr-only')).toHaveText(frase)
    // Lo visible, oculto al lector; la frase, leída una sola vez (ni repetida por el title ni junto a lo visible).
    await expect(corto(h)).toHaveAttribute('aria-hidden', 'true')
    expect(await vecesEnArbol(h, frase)).toBe(1)
  }
  // En el árbol accesible de cada «Qué pasó» solo están las frases largas: ninguna etiqueta corta que no vaya dentro de su
  // frase.
  const arbol = await deTodo.getByTestId('dnr-que-paso').ariaSnapshot()
  for (const visible of ['Familiar', 'A más de 25 m', 'Llamada corta · 12 s', 'Foto borrosa']) expect(arbol).not.toContain(visible)
  expect(await bien.getByTestId('dnr-que-paso').ariaSnapshot()).not.toContain('Foto bien')
  // La llamada de «si» no lleva el aviso de los 30 segundos.
  await expect(bien.getByTestId('dnr-aviso-llamada')).toHaveCount(0)
  // Un `como` que la web no conoce no pinta etiqueta: en la primera, solo la llamada y la foto; la que solo trae eso, sin
  // «Qué pasó».
  await expect(bien.locator('[data-testid^="dnr-hecho-"]')).toHaveCount(2)
  await expect(bien.getByTestId('dnr-hecho-como')).toHaveCount(0)
  await expect(comoRaro.getByTestId('dnr-que-paso')).toHaveCount(0)
  await expect(page.getByTestId('mis-dnr')).not.toContainText('xyz')
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

/* H5: las etiquetas que en alemán, inglés o italiano no se leían bien. */
const H5 = [
  ['de', /^Meine DNRs/, conEstaSemana([
    dnr('2026-11-10', 'TBA700000000001', 'sin_clasificar', { como: 'familiar', foto: 'mal', foto_motivo: 'sin_paquete' }),
    dnr('2026-11-09', 'TBA700000000002', 'sin_clasificar', { foto: 'mal', foto_motivo: 'persona' }),
  ], { en_revision: true }), [
    ['dnr-hecho-como', 0, 'Haushaltsmitglied'], ['dnr-hecho-foto', 0, 'Paket nicht auf dem Foto'], ['dnr-hecho-foto', 1, 'Person auf dem Foto'],
  ]],
  ['en', /^My DNRs/, conEstaSemana([dnr('2026-11-10', 'TBA700000000003', 'sin_clasificar', { lejos: false })]), [['dnr-hecho-lejos', 0, 'On site']]],
  ['it', /^Le mie DNR/, conEstaSemana([dnr('2026-11-10', 'TBA700000000004', 'sin_clasificar', { foto: 'mal', foto_motivo: 'sin_paquete' })]),
    [['dnr-hecho-foto', 0, 'Pacco non visibile']]],
]
for (const [idioma, nombre, mias, esperado] of H5) {
  test(`H5: en ${idioma}, las etiquetas corregidas por la revisión`, async ({ page }) => {
    await page.addInitScript((l) => localStorage.setItem('fds_idioma', l), idioma)
    await entrar(page, { mias })
    await page.getByRole('button', { name: nombre }).click()
    const filas = page.getByTestId('dnr-esta-semana').getByTestId('dnr-fila')
    for (const [testid, k, texto] of esperado) await expect(corto(filas.nth(k).getByTestId(testid))).toHaveText(texto)
    // En alemán, con un ID en revisión, la frase de arriba ya no se queda a medias.
    if (idioma === 'de') await expect(page.getByTestId('dnr-frase-arriba')).toHaveText('Diese Woche, ohne die in Prüfung befindlichen')
  })
}

/* H6: si sale de la pantalla antes de que cargue, sus DNR NO se apuntan como vistas. La respuesta, retenida; Volver; se
   suelta; la casilla sigue con su número rojo (también al volver a pintarse) y, al entrar otra vez, siguen como «Nueva». */
test('H6: si sale antes de que cargue, no se apuntan como vistas: la casilla sigue con su número rojo y al volver a entrar siguen como «Nueva»', async ({ page }) => {
  const fallos = vigilar(page)
  await entrar(page)
  await expect(numeroRojo(page)).toHaveText('5')
  let soltar
  const retenida = new Promise((r) => { soltar = r })
  let servidas = 0
  await page.unroute(/\/api\/diarios\/mias/)
  await page.route(/\/api\/diarios\/mias/, async (route) => {
    await retenida
    await json(DATOS)(route)
    servidas++
  })
  await casilla(page).click()
  await expect(page.getByText('Cargando…')).toBeVisible()
  const respuesta = page.waitForResponse(/\/api\/diarios\/mias/)
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(casilla(page)).toBeVisible()
  soltar()
  await respuesta
  await expect.poll(() => servidas).toBe(1)
  // Que la página procese la respuesta antes de mirar lo apuntado.
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d1'))).toBeNull()
  // La casilla se vuelve a pintar (otra pantalla y vuelta) con lo apuntado: sigue con sus 5 nuevas.
  await page.getByRole('button', { name: /Mis turnos/ }).click()
  await page.getByRole('button', { name: 'Volver' }).first().click()
  await expect(casilla(page)).toBeVisible()
  await expect(numeroRojo(page)).toHaveText('5')
  // Y al entrar de verdad, siguen como «Nueva»; esta vez sí se apuntan.
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana llevas 2 DNR')
  await expect(page.getByTestId('dnr-esta-semana').getByTestId('dnr-nueva')).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fds_dnr_vistas_d1'))).not.toBeNull()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

/* R11 (Dani, 11-11-2026): VUELVE la preferencia, y el estado SIGUE en pausa. Lo que se publica: el recordatorio con su
   botón del ejemplo, bajo el resumen; y en ningún sitio (ni en las tarjetas, ni en el recordatorio, ni en el ejemplo) si
   una DNR le cuenta. El recordatorio dice «No te cuenta» porque es la regla, no el estado de una DNR. */
test('R11 (lo que se publica): con la preferencia encendida y el estado en pausa, sale el recordatorio con su botón y ninguna DNR lleva estado, contadores ni leyenda', async ({ page }) => {
  test.skip(PAUSAS.preferencia || !PAUSAS.estado, 'solo con la preferencia encendida y el estado en pausa (dnrPausas.js)')
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const pantalla = page.getByTestId('mis-dnr')
  const r = pantalla.getByTestId('dnr-recordatorio')
  await expect(r).toBeVisible()
  await expect(r.getByTestId('dnr-recordatorio-condicion')).toHaveText('Solo si el cliente tiene preferencia de entrega')
  await expect(r.getByTestId('dnr-recordatorio-pasos')).toHaveText(/Llama\s*\+\s*Foto clara\s*No te cuenta/)
  await expect(r.getByRole('button', { name: '¿Cómo sé si tiene preferencia?' })).toBeVisible()
  // Bajo el resumen y antes de las tarjetas.
  const yDe = async (l) => (await l.boundingBox()).y
  expect(await yDe(pantalla.getByTestId('dnr-resumen'))).toBeLessThan(await yDe(r))
  expect(await yDe(r)).toBeLessThan(await yDe(pantalla.getByTestId('dnr-fila').first()))
  // Encender la preferencia no enciende nada del estado: ni etiqueta ni banda, ni contadores, ni «Qué es cada color», y el
  // número en el color normal.
  const sinEstado = async () => {
    await expect(pantalla.getByTestId('dnr-estado')).toHaveCount(0)
    await expect(pantalla.locator('[data-testid^="dnr-contador-"], [data-testid^="dnr-mini-"]')).toHaveCount(0)
    await expect(pantalla.getByTestId('dnr-estados')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Qué es cada color' })).toHaveCount(0)
    await expect(pantalla.locator('[data-cuenta]')).toHaveCount(0)
    await expect(pantalla.locator('[data-testid="dnr-numero"][class*="peligro"]')).toHaveCount(0)
  }
  await expect(pantalla.getByTestId('dnr-numero')).toHaveClass(/text-dark-50/)
  await sinEstado()
  // El recordatorio dice la regla, no el estado de ninguna DNR.
  for (const t of ['Te cuenta', 'No cuenta', 'Pendiente', 'Actualizada']) await expect(r).not.toContainText(t)
  // Con el ejemplo abierto, tampoco.
  await r.getByRole('button', { name: '¿Cómo sé si tiene preferencia?' }).click()
  const hoja = page.getByRole('dialog', { name: 'Cómo saber si tiene preferencia' })
  await expect(hoja).toBeVisible()
  for (const t of ['Te cuenta', 'No cuenta', 'Pendiente', 'Actualizada', 'Qué es cada color']) await expect(hoja).not.toContainText(t)
  await sinEstado()
  await hoja.getByRole('button', { name: 'Cerrar' }).click()
  await expect(hoja).toHaveCount(0)
  await sinEstado()
  // Y sin DNR esta semana, el recordatorio sigue.
  await page.getByRole('button', { name: 'Volver' }).click()
  await contesta(page, conEstaSemana([]))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await casilla(page).click()
  await expect(page.getByTestId('dnr-frase')).toHaveText('Esta semana, ninguna')
  await expect(page.getByTestId('dnr-recordatorio')).toBeVisible()
  await sinEstado()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

/* EL EJEMPLO «¿CÓMO SÉ SI TIENE PREFERENCIA?» (R11, corregido). Dani: «la preferencia de entrega es buzón de correos, es lo
   primero que aparece en la app»; «no lo de notas de entrega ni notas de cliente». Un botón discreto en el recordatorio abre
   una hoja con la FORMA de la pantalla de entrega, DIBUJADA con las piezas de FDS y datos inventados: arriba «¿Dónde vas a
   dejar el paquete?» con la PRIMERA opción en verde y «Sí es preferencia»; más abajo «Notas», apagadas, cada una con «No lo
   es». Sin ninguna imagen. */
const botonEjemplo = (page) => page.getByTestId('dnr-recordatorio').getByRole('button', { name: '¿Cómo sé si tiene preferencia?' })
const hojaEjemplo = (page, nombre = 'Cómo saber si tiene preferencia') => page.getByRole('dialog', { name: nombre })
// Lo que lee el lector de pantalla: el texto sin lo que va con aria-hidden.
const leido = (l) => l.evaluate((el) => {
  const c = el.cloneNode(true)
  c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove())
  return c.textContent.replace(/\s+/g, ' ').trim()
})

test('Ejemplo: el botón mide 44 y abre la hoja: arriba la PRIMERA opción en verde con «Sí es preferencia»; las tres notas, apagadas y con «No lo es»; ninguna imagen', async ({ page }) => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  const fallos = vigilar(page)
  await entrar(page)
  await casilla(page).click()
  const boton = botonEjemplo(page)
  await expect(boton).toBeVisible()
  expect((await boton.boundingBox()).height).toBeGreaterThanOrEqual(44)
  // Discreto: con la letra de texto, no más grande que la de los pasos.
  const tam = (l) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(await tam(boton)).toBeLessThanOrEqual(await tam(page.getByTestId('dnr-recordatorio-pasos')))
  await boton.click()

  // La hoja se anuncia con su título; debajo, en pequeño y con las palabras de Dani, dónde mirarlo.
  const hoja = hojaEjemplo(page)
  await expect(hoja).toBeVisible()
  await expect(hoja.getByRole('heading', { name: 'Cómo saber si tiene preferencia' })).toBeVisible()
  await expect(hoja).toContainText('La preferencia de entrega es lo primero que aparece al entregar, en tu app de reparto')

  // 1. Arriba, «¿Dónde vas a dejar el paquete?» y sus opciones: SOLO la primera, destacada y con «Sí es preferencia».
  const entrega = hoja.getByTestId('ejemplo-pref-entrega')
  await expect(entrega).toHaveAccessibleName('¿Dónde vas a dejar el paquete?')
  const opciones = entrega.getByTestId('ejemplo-pref-opcion')
  await expect(opciones).toHaveCount(3)
  await expect(opciones.getByTestId('ejemplo-pref-texto')).toHaveText(['Buzón de correos', 'Caseta', 'Más opciones'])
  await expect(opciones.nth(0)).toHaveAttribute('data-destacada', 'si')
  await expect(opciones.nth(1)).toHaveAttribute('data-destacada', 'no')
  await expect(opciones.nth(2)).toHaveAttribute('data-destacada', 'no')
  await expect(entrega.getByTestId('ejemplo-pref-etiqueta')).toHaveCount(1)
  await expect(opciones.nth(0).getByTestId('ejemplo-pref-etiqueta')).toHaveText('Sí es preferencia')
  await expect(opciones.nth(0).getByTestId('ejemplo-pref-etiqueta')).toHaveClass(/bg-ruta-ok/)
  await expect(hoja.getByText('Sí es preferencia', { exact: true })).toHaveCount(1)
  // El lector la lee con su etiqueta delante.
  expect(await leido(opciones.nth(0))).toBe('Sí es preferencia: Buzón de correos')
  expect(await leido(opciones.nth(1))).toBe('Caseta')
  const estilo = (l) => l.evaluate((el) => {
    const t = el.querySelector('[data-testid="ejemplo-pref-texto"]')
    return { borde: parseFloat(getComputedStyle(el).borderTopWidth), letra: parseFloat(getComputedStyle(t).fontSize), color: getComputedStyle(t).color, y: el.getBoundingClientRect().top }
  })
  const [a, b, c] = [await estilo(opciones.nth(0)), await estilo(opciones.nth(1)), await estilo(opciones.nth(2))]
  expect(a.borde).toBeGreaterThan(0)
  expect(b.borde).toBe(0)
  expect(c.borde).toBe(0)
  expect(a.letra).toBeGreaterThan(b.letra)
  expect(a.y).toBeLessThan(b.y)
  expect(b.y).toBeLessThan(c.y)
  // «Más opciones», apagado.
  expect(c.color).not.toBe(b.color)

  // 2. Más abajo, «Notas», apagadas: la cabecera inventada y tres líneas, cada una con «No lo es» delante.
  const notas = hoja.getByTestId('ejemplo-pref-notas')
  await expect(notas).toHaveAccessibleName('Notas')
  await expect(notas).toContainText('Calle de ejemplo, 1 · Nombre del cliente')
  const lineas = notas.getByTestId('ejemplo-pref-nota')
  await expect(lineas).toHaveCount(3)
  const esperado = [
    ['No lo es · nota de entrega', 'No lo es, nota de entrega', 'Entregar a: Cobertizo/Caseta'],
    ['No lo es · nota del cliente', 'No lo es, nota del cliente', 'Déjenlo al lado de la puerta y cierren. Gracias'],
    ['No lo es · clave de acceso', 'No lo es, clave de acceso', 'Código del portal: 1234'],
  ]
  for (const [k, [visible, frase, texto]] of esperado.entries()) {
    const l = lineas.nth(k)
    await expect(corto(l.getByTestId('ejemplo-pref-etiqueta'))).toHaveText(visible)
    await expect(l.getByTestId('ejemplo-pref-texto')).toHaveText(texto)
    expect(await leido(l)).toBe(`${frase}: ${texto}`)
    // Ninguna nota va destacada ni en verde.
    expect(await l.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))).toBe(0)
    await expect(l.locator('[class*="ruta-ok"]')).toHaveCount(0)
  }
  const colorNota = await lineas.nth(0).getByTestId('ejemplo-pref-texto').evaluate((el) => getComputedStyle(el).color)
  expect(colorNota).not.toBe(a.color)
  await expect(notas).not.toContainText('Sí es preferencia')
  // Arriba lo de entregar; debajo, las notas; abajo del todo, la regla.
  const yDe = async (l) => (await l.boundingBox()).y
  expect(await yDe(entrega)).toBeLessThan(await yDe(notas))
  // 3. Abajo, en el tinte de marca: «Con preferencia de entrega» y la misma fila de pasos del recordatorio.
  const regla = hoja.getByTestId('ejemplo-pref-regla')
  expect(await yDe(notas)).toBeLessThan(await yDe(regla))
  await expect(regla).toHaveClass(/bg-ruta-marca-tinte/)
  await expect(regla.getByTestId('ejemplo-pref-con')).toHaveText('Con preferencia de entrega')
  await expect(regla.getByTestId('ejemplo-pref-pasos')).toHaveText(/Llama\s*\+\s*Foto clara\s*No te cuenta/)

  // Nada del ejemplo viejo (que decía que la preferencia era «Entregar a:» de las notas), ni visible ni para el lector.
  const html = await hoja.evaluate((el) => el.outerHTML)
  expect(html).not.toMatch(/Mira las notas|notas de la parada|Si pone|Sí es preferencia: Entregar/)
  // Un dibujo: ninguna imagen ni captura, ni de fondo; y no nombra ninguna otra plataforma.
  await expect(hoja.locator('img, picture, image, video, canvas, iframe, object, [role="img"]')).toHaveCount(0)
  expect(await hoja.evaluate((el) => [el, ...el.querySelectorAll('*')].filter((x) => getComputedStyle(x).backgroundImage !== 'none').length)).toBe(0)
  await expect(hoja).not.toContainText(/amazon|flex/i)
  expect(fallos).toEqual([])
})

test('Ejemplo: en ningún idioma queda una frase del ejemplo viejo (la preferencia NO es «Entregar a:» de las notas)', async () => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  const { A } = await import('../src/lib/textosRutaA.js')
  for (const viejo of ['Mira las notas de la parada, en tu app de reparto', 'Si pone "Entregar a:"']) expect(Object.keys(A)).not.toContain(viejo)
  // Ninguna traducción dice que haya que mirar las notas ni que «Entregar a» sea la preferencia.
  const todo = Object.entries(A).filter(([k]) => /preferencia|Entregar a|No lo es|Notas/.test(k)).flatMap(([k, l]) => [k, ...l]).join('\n')
  expect(todo).not.toMatch(/notas de la parada|stop’s notes|notas da paragem|notes de l’arrêt|note della fermata|Notizen zum Stopp|Si pone|If it says|Se disser|S’il y a "|Se c’è scritto|Wenn dort/)
})

test('Ejemplo: se cierra con «Cerrar» y con Escape, el foco entra en la hoja y vuelve al botón al cerrarla', async ({ page }) => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  await entrar(page)
  await casilla(page).click()
  const boton = botonEjemplo(page)
  const hoja = hojaEjemplo(page)
  const dentroDeLaHoja = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
  // Con «Cerrar».
  await boton.click()
  await expect(hoja).toBeVisible()
  await expect.poll(dentroDeLaHoja).toBe(true)
  await hoja.getByRole('button', { name: 'Cerrar' }).click()
  await expect(hoja).toHaveCount(0)
  await expect(boton).toBeFocused()
  // Con el teclado: Intro la abre, el tabulador no se sale de la hoja y Escape la cierra.
  await page.keyboard.press('Enter')
  await expect(hoja).toBeVisible()
  await expect(hoja.getByRole('button', { name: 'Cerrar' })).toBeFocused()
  for (let k = 0; k < 3; k++) {
    await page.keyboard.press('Tab')
    expect(await dentroDeLaHoja()).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(hoja).toHaveCount(0)
  await expect(boton).toBeFocused()
  // Y sigue en «Mis DNR» (cerrar la hoja no se lleva la pantalla).
  await expect(page.getByTestId('dnr-recordatorio')).toBeVisible()
})

test('Ejemplo: a 360 px en alemán y con «Letra más grande», nada se corta ni hay scroll de lado; lo que se lee en la app se queda en español, con lo que significa', async ({ page }) => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  await page.setViewportSize({ width: 360, height: 780 })
  await page.addInitScript(() => {
    localStorage.setItem('fds_idioma', 'de')
    localStorage.setItem('fds_letra', 'grande')
    document.documentElement.setAttribute('data-letra', 'grande')
  })
  await entrar(page)
  await page.getByRole('button', { name: /^Meine DNRs/ }).click()
  const boton = page.getByTestId('dnr-recordatorio').getByRole('button', { name: 'Woran erkenne ich eine Zustellpräferenz?' })
  expect((await boton.boundingBox()).height).toBeGreaterThanOrEqual(44)
  await boton.click()
  const hoja = hojaEjemplo(page, 'So erkennst du eine Zustellpräferenz')
  await expect(hoja).toBeVisible()
  const entrega = hoja.getByTestId('ejemplo-pref-entrega')
  await expect(entrega).toHaveAccessibleName('"¿Dónde vas a dejar el paquete?" (Wo lässt du das Paket?)')
  await expect(entrega.getByTestId('ejemplo-pref-texto')).toHaveText(['"Buzón de correos" (Briefkasten)', '"Caseta" (Gartenhaus)', '"Más opciones" (Weitere Optionen)'])
  await expect(entrega.getByTestId('ejemplo-pref-etiqueta')).toHaveText('Das ist eine Präferenz')
  const notas = hoja.getByTestId('ejemplo-pref-notas')
  await expect(notas).toHaveAccessibleName('"Notas" (Notizen)')
  const lineas = notas.getByTestId('ejemplo-pref-nota')
  await expect(lineas.nth(0).getByTestId('ejemplo-pref-texto')).toHaveText('"Entregar a:" (Zustellen an) Schuppen/Gartenhaus')
  await expect(corto(lineas.nth(0).getByTestId('ejemplo-pref-etiqueta'))).toHaveText('Keine Präferenz · Zustellnotiz')
  await expect(lineas.nth(1).getByTestId('ejemplo-pref-texto')).toHaveText('Bitte neben die Tür legen und zumachen. Danke')
  await expect(hoja.getByTestId('ejemplo-pref-con')).toHaveText('Mit Zustellpräferenz')
  const r = await hoja.evaluate((el) => {
    const panel = el.firstElementChild
    const borde = panel.getBoundingClientRect()
    const visibles = [...panel.querySelectorAll('*')].filter((x) => !x.closest('.sr-only')
      && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    return {
      // Nada cortado: ni el título ni el subtítulo de la Hoja (que de serie van en una línea con «…»), ni las etiquetas.
      cortados: visibles.filter((x) => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map((x) => x.textContent.slice(0, 40)),
      fuera: visibles.filter((x) => { const b = x.getBoundingClientRect(); return b.left < borde.left - 1 || b.right > borde.right + 1 }).map((x) => x.textContent.slice(0, 40)),
      scrollLado: [...panel.querySelectorAll('*')].some((x) => x.scrollWidth > x.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(x).overflowX)),
      titulo: getComputedStyle(panel.querySelector('h2')).whiteSpace,
    }
  })
  expect(r.cortados).toEqual([])
  expect(r.fuera).toEqual([])
  expect(r.scrollLado).toBe(false)
  expect(r.titulo).not.toBe('nowrap')
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana)
})

test('Ejemplo: en portugués, lo que es la misma palabra va entre comillas y sin paréntesis («Notas», «Entregar a:»); lo demás, con lo que significa', async ({ page }) => {
  test.skip(PAUSAS.preferencia, PAUSA_PREFERENCIA)
  await page.addInitScript(() => localStorage.setItem('fds_idioma', 'pt'))
  await entrar(page)
  await page.getByRole('button', { name: /^As minhas DNR/ }).click()
  await page.getByTestId('dnr-recordatorio').getByRole('button', { name: 'Como sei se tem preferência?' }).click()
  const hoja = hojaEjemplo(page, 'Como saber se tem preferência')
  await expect(hoja.getByTestId('ejemplo-pref-notas')).toHaveAccessibleName('"Notas"')
  await expect(hoja.getByTestId('ejemplo-pref-nota').first().getByTestId('ejemplo-pref-texto')).toHaveText('"Entregar a:" Barracão/Arrecadação')
  await expect(hoja.getByTestId('ejemplo-pref-opcion').getByTestId('ejemplo-pref-texto')).toHaveText(['"Buzón de correos" (Caixa de correio)', '"Caseta" (Arrecadação)', '"Más opciones" (Mais opções)'])
})
