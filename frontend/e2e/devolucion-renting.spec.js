/* global process */
import { test, expect } from '@playwright/test'
import { COMPANIAS, huellaRecorrido, pasosDe } from '../src/lib/guiasRenting.js'

/* «¿QUÉ TE VAN A COBRAR AL DEVOLVERLO?» (/devolucion-renting, 14-11-2026). Lo que no puede fallar en una herramienta que
   se usa de pie junto al vehículo y que se manda por WhatsApp: el recorrido entero con una guía (cada respuesta), el
   resultado con sus tres etiquetas («dice que se factura» solo donde el documento lo dice, «no lo acepta», «no lo
   dice») y la página de cada cosa, «Otra compañía» sin rangos ni «No cobra: Nada», volver atrás y cambiar cualquier
   respuesta sin perder las demás, el enlace que reconstruye el resultado (y los que no cuadran), la página de cada
   compañía con su tabla (también entre 640 y 900 px), la vista de impresión con la fecha y las direcciones escritas,
   390 px sin desbordes y con las respuestas a la vista, el teclado, y que de la herramienta no sale ninguna petición
   a /api (la única es el contador anónimo de visitas de toda la web, que manda la ruta sin el #). Fotos para mirarlas:
   FOTOS_DEVOLUCION=<carpeta>. */

const RUTA = '/devolucion-renting'

/* El # de un resultado (o de un paso) con la huella de los datos de hoy. */
function enlace(slug, vehiculo, r, p = 'fin', extra = '') {
  const doc = COMPANIAS.find((c) => c.slug === slug).documentos[vehiculo]
  return `${RUTA}#v=${vehiculo === 'turismo' ? 't' : 'f'}&c=${slug}&h=${huellaRecorrido(doc, vehiculo)}${r ? `&r=${r}` : ''}${extra}&p=${p}`
}
const nPasos = (slug, vehiculo) => pasosDe(COMPANIAS.find((c) => c.slug === slug).documentos[vehiculo], vehiculo).length
/* El texto de los bloques del resultado con etiqueta (no el del proceso, que es el del documento tal cual). */
// «Lo que has contestado que no» va plegado en pantalla: se abre antes de leerlo.
const bloques = async (page) => {
  const plegar = page.getByTestId('dev-no-lista-plegar')
  if (await plegar.count() && (await plegar.getAttribute('aria-expanded')) === 'false') await plegar.click()
  return page.locator('[data-testid="dev-factura"], [data-testid="dev-fuera"], [data-testid="dev-no-lista"], [data-testid="dev-aparte"]').allInnerTexts()
}
/* Las respuestas de un recorrido, paso a paso, según cada paso («s», «n» o «x»). */
const respuestas = (slug, vehiculo, f) => pasosDe(COMPANIAS.find((c) => c.slug === slug).documentos[vehiculo], vehiculo).map(f).join('')

/* Las peticiones a /api: se contestan (para no ensuciar la consola) y se apuntan. */
async function preparar(page) {
  const api = []
  const fallos = []
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(m.text())) fallos.push(m.text()) })
  page.on('pageerror', (e) => fallos.push(String(e)))
  await page.route('**/api/**', async (route) => {
    api.push({ url: route.request().url(), cuerpo: route.request().postData() || '' })
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  return { api, fallos }
}

/* De la herramienta no sale nada: solo el contador de visitas de la web, sin el # ni las respuestas. */
function soloContador(api) {
  for (const p of api) {
    expect(p.url, 'una petición a /api que no es el contador de visitas').toMatch(/\/api\/analitica\/evento$/)
    expect(p.cuerpo).not.toMatch(/#|r=|lateral|port%C3%B3n/i)
  }
}

async function sinDesbordes(page) {
  const { ancho, total } = await page.evaluate(() => ({ ancho: document.documentElement.clientWidth, total: document.documentElement.scrollWidth }))
  expect(total, 'la página se desplaza de lado').toBeLessThanOrEqual(ancho)
}

/* Contesta los pasos que quedan con una letra por paso (n, s, x). */
async function contestar(page, letras) {
  for (const l of letras) {
    if (l === 'n') await page.getByTestId('dev-no').click()
    else if (l === 'x') await page.getByTestId('dev-nose').click()
    else { await page.getByTestId('dev-si').click(); await page.getByTestId('dev-seguir').click() }
  }
}

test.describe('/devolucion-renting', () => {
  test('la entrada: la frase verdadera, tipo de vehículo, compañías, la edad del documento y nada guardado', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿Qué te van a cobrar al devolverlo?')
    await expect(page.getByTestId('dev-entradilla')).toHaveText('Algunas compañías de renting publican qué consideran desgaste normal y qué no aceptan. Repásalo con la suya antes de que lo haga su perito.')
    await expect(page.getByText('Sin registro. No guardamos nada de tu vehículo.')).toBeVisible()
    await expect(page.getByTestId('dev-empezar')).toBeDisabled()
    // Furgoneta por defecto: BMW (solo turismos) no está en la lista y se dice sin afirmar más de lo que sabemos.
    await expect(page.getByTestId('dev-cia-bmw-financial-services')).toHaveCount(0)
    await expect(page.getByTestId('dev-sin-este')).toHaveText('De BMW Financial Services solo hemos encontrado el documento de turismos.')
    await page.getByTestId('dev-tipo-turismo').click()
    await expect(page.getByTestId('dev-cia-bmw-financial-services')).toBeVisible()
    // Los alquileres, aparte.
    await expect(page.getByRole('group', { name: 'Si es un alquiler' }).getByText('Hertz')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Si es un alquiler' }).getByText('Europcar')).toBeVisible()
    await page.getByTestId('dev-tipo-furgoneta').click()
    // Ayvens: el documento es de LeasePlan y no trae fecha, y se dice al elegirla.
    await page.getByTestId('dev-cia-ayvens').click()
    await expect(page.getByTestId('dev-cia-ayvens').getByTestId('dev-vigencia')).toHaveText('Documento de LeasePlan (hoy Ayvens), sin fecha: puede no ser el que esté en vigor. Pide a tu compañía el vigente.')
    await expect(page.getByTestId('dev-empezar')).toHaveText(`Empezar · ${nPasos('ayvens', 'furgoneta')} preguntas`)
    const cookies = await page.context().cookies()
    expect(cookies).toEqual([])
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /devol|guia|renting/i.test(k)))).toEqual([])
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('en un portátil de 1280 × 800, «Empezar» se ve sin bajar', async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'medida de escritorio')
    await preparar(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(RUTA)
    await page.getByTestId('dev-cia-arval').click()
    const caja = await page.getByTestId('dev-empezar').boundingBox()
    expect(caja.y + caja.height).toBeLessThanOrEqual(800)
  })

  test('el recorrido entero con Ayvens (furgoneta): las tres etiquetas, la página de cada cosa y el enlace compartido', async ({ page, browser }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await page.getByTestId('dev-cia-ayvens').click()
    await page.getByTestId('dev-empezar').click()
    const total = nPasos('ayvens', 'furgoneta')

    // Paso 1: la pregunta, la regla con las palabras de su guía y su página (de LeasePlan, hoy Ayvens), sin ayuda.
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`1 de ${total}`)
    await expect(page.getByTestId('dev-pregunta')).toContainText('paragolpes')
    const regla = page.getByTestId('dev-regla')
    await expect(regla).toContainText('Su guía acepta')
    await expect(regla).toContainText('Hasta 10 cm, siempre que se quiten con un pulido mecánico.')
    await expect(regla).toContainText('Su guía dice que se factura')
    await expect(regla).toContainText('LeasePlan (hoy Ayvens), pág. 8')
    await expect(regla).not.toContainText(/No se cobra|Se cobra\b/)
    await expect(page.getByTestId('dev-vigencia')).toContainText('Documento de LeasePlan (hoy Ayvens), sin fecha')
    await expect(page.getByTestId('dev-medir')).toHaveCount(0)
    await page.getByTestId('dev-no').click()

    // Paso 2: las lunas también preguntan por la zona A, de cualquier tamaño (y se dice que la guía no la define).
    await expect(page.getByTestId('dev-pregunta')).toContainText('del tamaño que sea, en la zona A del parabrisas')
    await expect(page.getByTestId('dev-regla-junto')).toContainText('Impactos en la zona A del parabrisas')
    await expect(page.getByTestId('dev-nota-paso')).toHaveText('La guía no dice qué es la zona A del parabrisas.')
    await page.getByTestId('dev-nose').click()

    // Paso 3: arañazos en la chapa → «Sí, alguna» con nota (y el aviso de que la nota viaja en el enlace).
    await page.getByTestId('dev-si').click()
    await expect(page.getByTestId('dev-donde-aviso')).toHaveText('Lo que escribas aquí viaja en el enlace si lo compartes: no pongas matrículas ni nombres.')
    await page.getByTestId('dev-donde').fill('portón')
    await page.getByTestId('dev-seguir').click()

    // Paso 4: abolladuras, con la moneda de 10 céntimos («casi 2 cm», y lo que queda cerca, con una regla).
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`4 de ${total}`)
    await expect(page.getByTestId('dev-medir')).toContainText('Una moneda de 10 céntimos mide 19,75 mm: casi 2 cm.')
    await expect(page.getByTestId('dev-medir')).toContainText('si es casi igual, mídelo con una regla')
    await page.getByTestId('dev-si').click()
    await page.getByTestId('dev-donde').fill('lateral derecho')
    await page.getByTestId('dev-seguir').click()

    // Paso 5 (pintura) y 6 (retrovisores, con la tarjeta: algo más de 5 cm, y hacia qué lado se equivoca quien se fíe).
    await page.getByTestId('dev-no').click()
    await expect(page.getByTestId('dev-pregunta')).toContainText('en los retrovisores o los accesorios de fuera')
    await expect(page.getByTestId('dev-medir')).toContainText('El lado corto de una tarjeta bancaria mide 54 mm: algo más de 5 cm.')
    await expect(page.getByTestId('dev-medir')).toContainText('si se queda un poco corto, también puede pasar')
    // El dibujo de la furgoneta enseña el retrovisor marcado: nada lo tapa.
    const tapado = await page.locator('[data-testid="dev-paso"] svg path[fill="var(--dv-marca)"]').evaluateAll((ps) => ps.map((el) => {
      const b = el.getBoundingClientRect()
      const encima = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
      return encima === el || encima?.getAttribute('fill') === 'var(--dv-marca)'
    }))
    expect(tapado.length).toBeGreaterThan(0)
    expect(tapado.every(Boolean), 'el retrovisor marcado queda tapado').toBe(true)
    await expect(page.locator('[data-testid="dev-paso"] svg[role="img"]')).toHaveAttribute('aria-label', 'Furgoneta vista desde arriba, con la zona marcada: Retrovisores')
    await page.getByTestId('dev-no').click()

    // «También mira» en la zona de carga, y las demás. Las llaves: «Sí».
    for (let i = 7; i <= total; i++) {
      await expect(page.getByTestId('dev-cuenta')).toHaveText(`${i} de ${total}`)
      if (i === 9) {
        await page.getByTestId('dev-tambien').locator('summary').click()
        await expect(page.getByTestId('dev-tambien')).toContainText('Suelo de carga')
        await expect(page.getByTestId('dev-tambien')).not.toContainText(/No se cobra:|Se cobra:/)
      }
      if (i === 11) {
        await expect(page.getByTestId('dev-pregunta')).toContainText('llaves')
        await page.getByTestId('dev-si').click()
        await page.getByTestId('dev-seguir').click()
      } else await page.getByTestId('dev-no').click()
    }

    // El resultado: 3 fuera de lo que su guía da por bueno. Dos que su guía dice que se facturan (lo dice en su pág. 3,
    // de los daños) y las llaves, que no acepta y no dice cómo cobra.
    const res = page.getByTestId('dev-resultado')
    await expect(res).toBeVisible()
    await expect(page.getByTestId('dev-cifra')).toHaveText('3')
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas fuera de lo que su guía da por bueno')
    await expect(page.getByTestId('dev-factura').locator('h3')).toContainText('Lo que su guía dice que se factura')
    const items = page.getByTestId('dev-item-factura')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('Arañazo en la chapa · portón')
    await expect(items.nth(0)).toContainText('pág. 7')
    await expect(items.nth(1)).toContainText('lateral derecho')
    await expect(page.getByTestId('dev-base-cobro')).toContainText('pág. 3')
    await expect(page.getByTestId('dev-base-cobro')).toContainText('cobrando por reparación')
    await expect(page.getByTestId('dev-fuera').locator('h3')).toContainText('Lo que su guía no acepta')
    await expect(page.getByTestId('dev-item-fuera')).toContainText('Falta un juego de llaves')
    // La regla ya dice que no da precio: no se repite «No dice cómo lo cobra».
    await expect(page.getByTestId('dev-item-fuera')).toContainText('La guía no da precio')
    await expect(page.getByTestId('dev-item-fuera').getByTestId('dev-sin-cobro')).toHaveCount(0)
    await expect(page.getByTestId('dev-nose-lista')).toContainText('Revisarlo con luz natural, sin sombras, y en seco.')
    // Un «No» no certifica la zona: se dice lo que se contestó y lo que tampoco acepta sin preguntarlo.
    await expect(res).not.toContainText('Dentro de lo que su guía acepta')
    await expect(page.getByTestId('dev-no-lista').locator('h3')).toContainText('Lo que has contestado que no')
    const noParagolpes = page.getByTestId('dev-item-no').first()
    await expect(noParagolpes).toContainText('Contestaste que no a: ¿Algún arañazo o rozadura en los paragolpes')
    await expect(noParagolpes.getByTestId('dev-sin-preguntar').first()).toContainText('Sin preguntar, en esta zona su guía no acepta, sea del tamaño que sea:')
    await expect(noParagolpes.getByTestId('dev-sin-preguntar').first()).toContainText('parachoques o rejilla rotos, agrietados o deformados')
    // Lo que acepta hasta un límite no sale como «no acepta».
    await expect(noParagolpes.getByTestId('dev-sin-preguntar').nth(1)).toContainText('Y pone límites a:')
    await expect(page.getByTestId('dev-aparte')).toContainText('Bacas, barras de techo y enganche de remolque')
    await expect(res.getByTestId('dev-vigencia').first()).toContainText('Documento de LeasePlan (hoy Ayvens), sin fecha')
    await expect(page.getByTestId('dev-aviso')).toHaveText('Orientativo: decide el perito de tu compañía con la guía que esté en vigor.')
    await expect(page.getByTestId('dev-fuente')).toContainText('Leído el 14 de noviembre de 2026')
    await expect(page.getByTestId('dev-fuente').getByRole('link').first()).toHaveAttribute('href', /normativa_devolucion_vehiculos_comerciales\.pdf$/)
    await expect(res).not.toContainText(/te lo cobrarán|no te lo pueden cobrar|te ahorras|Nada, salvo|: Nada/i)

    // «Mandárselo a alguien»: sin navigator.share, copia el enlace.
    await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await page.getByTestId('dev-mandar').click()
    await expect(page.getByTestId('dev-copiado')).toContainText(/Enlace copiado|Copia este enlace/)

    // El enlace reconstruye el resultado en otro navegador, sin nada guardado.
    const url = page.url()
    expect(url).toMatch(/#v=f&c=ayvens&h=\w+&r=nxssnnnnnnsn&n=2\.port%C3%B3n~3\.lateral%20derecho&p=fin$/)
    const otro = await browser.newContext()
    const p2 = await otro.newPage()
    const { api: api2 } = await preparar(p2)
    await p2.goto(url)
    await expect(p2.getByTestId('dev-cifra')).toHaveText('3')
    await expect(p2.getByTestId('dev-item-factura').nth(1)).toContainText('lateral derecho')
    soloContador(api2)
    await otro.close()

    // Un enlace hecho con otra versión de la guía: se dice y se ofrece empezar de nuevo.
    await page.goto(url.replace(/h=\w+/, 'h=zzzzzz'))
    await expect(page.getByTestId('dev-error')).toContainText('otra versión de la guía')
    await page.getByTestId('dev-de-nuevo').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿Qué te van a cobrar al devolverlo?')

    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('volver atrás no borra las respuestas de después, y desde el resultado se cambia cualquiera', async ({ page }) => {
    const { fallos } = await preparar(page)
    await page.goto(`${RUTA}#v=f&c=hertz`)
    await page.getByTestId('dev-empezar').click()
    const total = nPasos('hertz', 'furgoneta')
    await contestar(page, 'nxnxnxn')
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`8 de ${total}`)
    // «Atrás» cuatro veces, hasta el paso 4: las respuestas de los pasos 5 a 7 siguen ahí.
    for (let k = 0; k < 4; k++) await page.getByTestId('dev-atras').click()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`4 de ${total}`)
    expect(page.url()).toMatch(/r=nxnxnxn/)
    // Se cambia el 4 a «Sí»: se va a la siguiente sin contestar (la 8), y las de en medio no se pierden.
    await page.getByTestId('dev-si').click()
    await page.getByTestId('dev-seguir').click()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`8 de ${total}`)
    expect(page.url()).toMatch(/r=nxnsnxn&/)
    // Con el «atrás» del navegador, igual.
    await page.goBack()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`4 de ${total}`)
    expect(page.url()).toMatch(/r=nxnsnxn&/)
    await page.goForward()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`8 de ${total}`)
    await contestar(page, 'nnn')
    await expect(page.getByTestId('dev-cifra')).toHaveText('1')

    // Desde el resultado: cambiar el paso 2 («No lo sé») a «No», y se vuelve al resultado con todo lo demás.
    const nose = page.getByTestId('dev-nose-lista').getByTestId('dev-cambiar').first()
    await nose.click()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`2 de ${total}`)
    await expect(page.getByTestId('dev-nose')).toHaveAttribute('aria-pressed', 'true')
    // «Atrás» desde ahí va al paso anterior, no al resultado.
    await page.getByTestId('dev-atras').click()
    await expect(page.getByTestId('dev-cuenta')).toHaveText(`1 de ${total}`)
    await page.getByTestId('dev-no').click()
    await expect(page.getByTestId('dev-resultado')).toBeVisible()
    await page.getByTestId('dev-nose-lista').getByTestId('dev-cambiar').first().click()
    await page.getByTestId('dev-no').click()
    await expect(page.getByTestId('dev-resultado')).toBeVisible()
    expect(page.url()).toMatch(/r=nnnsnxnnnn&/)
    expect(fallos).toEqual([])
  })

  test('con el teclado, el Tab llega primero a «Atrás»', async ({ page }) => {
    await preparar(page)
    await page.goto(enlace('ayvens', 'furgoneta', 'n', 1))
    await expect(page.getByTestId('dev-cuenta')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('dev-atras')).toBeFocused()
  })

  test('las tres etiquetas hablan como su documento: Athlon, BMW, Volkswagen y Europcar', async ({ page }) => {
    await preparar(page)
    // Athlon: su manual nunca dice que cobre el testigo, la tapicería ni la limpieza: «Su guía no lo acepta».
    await page.goto(enlace('athlon', 'furgoneta', 'nnsnss'))
    await expect(page.getByTestId('dev-factura')).toHaveCount(0)
    await expect(page.getByTestId('dev-item-fuera')).toHaveCount(3)
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas que su guía no acepta')
    await expect(page.getByTestId('dev-vigencia').first()).toHaveText('Documento sin fecha: puede no ser el que esté en vigor. Pide a tu compañía el vigente.')

    // BMW: el testigo, con su condición entera y su página; un bollo, «no lo acepta», con lo que dice su pág. 16.
    const n = nPasos('bmw-financial-services', 'turismo')
    await page.goto(enlace('bmw-financial-services', 'turismo', `nnsn${'n'.repeat(n - 5)}s`))
    await expect(page.getByTestId('dev-item-factura')).toContainText('Testigo de avería encendido')
    await expect(page.getByTestId('dev-item-factura')).toContainText('Si además hay encendido un testigo de avería según el manual de usuario, el vehículo no se puede devolver y se factura el Valor Final del contrato. pág. 15')
    await expect(page.getByTestId('dev-item-factura')).toContainText('Su pág. 15 anota, además, cualquier otro aviso del cuadro: de fallo, de avería o de falta de mantenimiento.')
    await expect(page.getByTestId('dev-item-fuera')).toContainText('Su pág. 16 lo resume de otra forma')

    // Volkswagen: la póliza de los 3 últimos meses va en el resultado.
    await page.goto(enlace('volkswagen-financial-services', 'turismo', `s${'n'.repeat(nPasos('volkswagen-financial-services', 'turismo') - 1)}`))
    await expect(page.getByTestId('dev-item-fuera')).toContainText('no serán necesarias en los últimos 3 meses del contrato')

    // Europcar: alquiler, «su tabla», sin perito ni guía; un «No» lleva lo que su tabla no dice por debajo de 2 cm.
    await page.goto(enlace('europcar', 'furgoneta', 'n'.repeat(nPasos('europcar', 'furgoneta'))))
    await expect(page.getByTestId('dev-cifra')).toHaveText('0')
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas que su tabla dice que se facturan')
    await expect(page.getByTestId('dev-item-no').first()).toContainText('Su tabla pone precio desde 2 cm y no dice qué pasa por debajo.')
    await expect(page.getByTestId('dev-aviso')).toHaveText('Orientativo: decide quien revise el vehículo en Europcar, con la tabla que esté en vigor.')
    await expect(page.getByTestId('dev-resultado')).not.toContainText(/perito|precio fijo/i)
  })

  test('Alphabet: cada «se factura» con su página exacta, y lo de fuera con la condición de su pág. 6', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    const condicion = 'En caso contrario, los daños exteriores serán facturados al cliente'
    // Todo «Sí»: cada frase dice a qué alcanza; la pág. 9 (el habitáculo) solo para el interior.
    await page.goto(enlace('alphabet', 'furgoneta', 's'.repeat(nPasos('alphabet', 'furgoneta'))))
    // Todo cae en el bloque de la cifra: el desglose no la repite.
    await expect(page.getByTestId('dev-desglose')).toHaveCount(0)
    const bases = page.getByTestId('dev-base-cobro')
    await expect(bases.filter({ hasText: 'pág. 9' })).toHaveCount(1)
    await expect(bases.filter({ hasText: 'pág. 9' })).toContainText(/^Interior: lo dice en su pág\. 9/)
    await expect(bases.filter({ hasText: 'pág. 32' })).toHaveText('Paragolpes, carrocería y retrovisores: lo pone bajo «Facturables» (8.4 Carrocería), en su pág. 32.')
    await expect(bases.filter({ hasText: '8.1 Parabrisas' })).toContainText('Lunas: lo pone bajo «Facturables»')
    await expect(bases.filter({ hasText: '8.2 Llantas' })).toContainText('en su pág. 30')
    await expect(page.getByTestId('dev-condicion-cobro')).toHaveCount(1)
    await expect(page.getByTestId('dev-condicion-cobro')).toContainText(`Lo de fuera depende de tu contrato. Su pág. 6: «Sólo en el caso de que el contrato de renting no incluya el seguro obligatorio ni el servicio de reparaciones`)
    await expect(page.getByTestId('dev-condicion-cobro')).toContainText(condicion)
    // Cada cosa con su página, sin dos páginas en la misma línea: la limpieza es de la 20 y la llanta de la 30.
    const limpieza = page.getByTestId('dev-item-factura').filter({ hasText: 'Suciedad que pide limpieza especializada' })
    await expect(limpieza).toContainText('Si son varias piezas, cuenta como limpieza alta pág. 20')
    await expect(page.getByTestId('dev-resultado')).not.toContainText(/\(página \d+\)/)
    await expect(page.getByTestId('dev-item-factura').filter({ hasText: 'Arañazo de más de 4 cm en una llanta' })).toContainText('pág. 30')
    // Lo que pide aparte, con la palabra que cabe: lo que factura, «Su guía dice»; nunca «no acepta: desrotulación».
    await expect(page.getByTestId('dev-aparte')).toContainText('Su guía dice: si se devuelve rotulado sin haber contratado la desrotulación en la cuota, Alphabet factura su coste')
    await expect(page.getByTestId('dev-aparte')).not.toContainText('Su guía no acepta: desrotulación')

    // Solo el interior: la pág. 9 y ninguna condición de lo de fuera.
    await page.goto(enlace('alphabet', 'turismo', respuestas('alphabet', 'turismo', (p) => (p.tema === 'interior' ? 's' : 'n'))))
    await expect(page.getByTestId('dev-base-cobro')).toHaveText('Lo dice en su pág. 9: «Se considerarán daños facturables y, por tanto, serán facturados al cliente, aquellos que no presentaba el vehículo en el momento de la entrega».')
    await expect(page.getByTestId('dev-condicion-cobro')).toHaveCount(0)

    // Solo una luna: la pág. 28, nunca la 9, y la condición a la vista.
    await page.goto(enlace('alphabet', 'turismo', respuestas('alphabet', 'turismo', (p) => (p.tema === 'lunas' ? 's' : 'n'))))
    await expect(page.getByTestId('dev-base-cobro')).toHaveText('Lo pone bajo «Facturables» (8.1 Parabrisas, ópticas, etc), en su pág. 28.')
    await expect(page.getByTestId('dev-condicion-cobro')).toContainText(condicion)

    // La zona de carga: la pág. 13 en el turismo y la 16 en la furgoneta.
    await page.goto(enlace('alphabet', 'turismo', respuestas('alphabet', 'turismo', (p) => (p.tema === 'carga' ? 's' : 'n'))))
    await expect(page.getByTestId('dev-base-cobro')).toContainText('Lo dice en su pág. 13:')
    await page.goto(enlace('alphabet', 'furgoneta', respuestas('alphabet', 'furgoneta', (p) => (p.tema === 'carga' ? 's' : 'n'))))
    await expect(page.getByTestId('dev-base-cobro')).toContainText('Lo dice en su pág. 16:')

    // En el paso de fuera, dónde lo dice y la condición, corta; en el del interior, sin condición.
    await page.goto(enlace('alphabet', 'furgoneta', '', 0))
    await expect(page.getByTestId('dev-paso').getByTestId('dev-base-cobro')).toHaveText('Lo pone bajo «Facturables» (8.4 Carrocería), en su pág. 32.')
    await expect(page.getByTestId('dev-paso').getByTestId('dev-condicion-cobro')).toContainText('Lo de fuera depende de tu contrato: su pág. 6')
    const interior = respuestas('alphabet', 'furgoneta', (p) => (p.tema === 'interior' ? '|' : 'n')).indexOf('|')
    await page.goto(enlace('alphabet', 'furgoneta', 'n'.repeat(interior), interior))
    await expect(page.getByTestId('dev-pregunta')).toContainText('por dentro')
    await expect(page.getByTestId('dev-paso').getByTestId('dev-base-cobro')).toContainText('pág. 9')
    await expect(page.getByTestId('dev-paso').getByTestId('dev-condicion-cobro')).toHaveCount(0)
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('las frases del resultado no se contradicen con su etiqueta: BMW, Volkswagen, Athlon y Ayvens', async ({ page }) => {
    await preparar(page)
    const todo = (slug, vehiculo, letra) => enlace(slug, vehiculo, letra.repeat(nPasos(slug, vehiculo)))
    const NUNCA = /no lo dice expresamente|Su guía solo dice lo que acepta\.|no acepta: (si |todos los costes|no da importe|hay que )|tampoco acepta/i

    // BMW: «Sin limpiar» ya dice qué se puede reclamar (sin un «No dice cómo lo cobra» debajo); falta una llave: lo que
    // pide, y una sola vez que no dice cómo lo cobra.
    await page.goto(todo('bmw-financial-services', 'turismo', 's'))
    const limpieza = page.getByTestId('dev-item-fuera').filter({ hasText: 'Sin limpiar' })
    await expect(limpieza).toContainText('se podría reclamar el coste de la limpieza')
    await expect(limpieza.getByTestId('dev-sin-cobro')).toHaveCount(0)
    const llaves = page.getByTestId('dev-item-fuera').filter({ hasText: 'Falta una llave' })
    await expect(llaves).toContainText('Su guía pide: entregar la ficha técnica y el permiso de circulación originales')
    await expect(llaves.getByTestId('dev-sin-cobro')).toHaveText('No dice cómo lo cobra.')
    await expect(llaves).not.toContainText('no dice qué se cobra')
    expect((await bloques(page)).join(' ')).not.toMatch(NUNCA)

    // BMW, todo «No»: lo que acepta en parte no sale como «no acepta» («daños que se quitan puliendo»).
    await page.goto(todo('bmw-financial-services', 'turismo', 'n'))
    const pintura = page.getByTestId('dev-item-no').filter({ hasText: 'Pintura · arañazos' })
    await expect(pintura.getByTestId('dev-sin-preguntar').filter({ hasText: 'no acepta, sea del tamaño' })).not.toContainText('puliendo')
    await expect(pintura.getByTestId('dev-sin-preguntar').filter({ hasText: 'puliendo' })).toContainText(/^Y pone límites a: /)
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas fuera de lo que su guía da por bueno')

    // Volkswagen: bajo «no acepta», lo que sí acepta (de eso se ha pasado), no «la guía no lo dice expresamente».
    await page.goto(todo('volkswagen-financial-services', 'furgoneta', 's'))
    await expect(page.getByTestId('dev-item-fuera').filter({ hasText: 'en una llanta' })).toContainText('Su guía acepta: pequeños roces de hasta 0,5 cm de largo, como mucho 3 roces por llanta. pág. 6')
    await expect(page.getByTestId('dev-item-fuera').filter({ hasText: 'menos de 2 mm de dibujo' })).toContainText('Su guía acepta: profundidad igual o superior a 2 mm')
    expect((await bloques(page)).join(' ')).not.toMatch(NUNCA)
    // Con todo «No», un manual que no dice cobrar nada no lleva «0 cosas que su guía dice que se facturan».
    await page.goto(todo('volkswagen-financial-services', 'furgoneta', 'n'))
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas que su guía no acepta')
    await page.goto(todo('volkswagen-financial-services', 'turismo', 'x'))
    await expect(page.getByTestId('dev-titular')).toHaveText('cosas que su guía no acepta')

    // Athlon: «Su guía no da importe; …», con su sujeto; una sola página por línea.
    await page.goto(todo('athlon', 'furgoneta', 's'))
    await expect(page.getByTestId('dev-item-fuera').filter({ hasText: 'Falta algo' })).toContainText('Su guía no da importe; deben devolverse')
    await expect(page.getByTestId('dev-item-fuera').filter({ hasText: 'limpieza estándar' })).toContainText('Manchas o suciedad no derivada de un uso normal pág. 11')
    await expect(page.getByTestId('dev-resultado')).not.toContainText(/\(p\. \d+\)/)
    expect((await bloques(page)).join(' ')).not.toMatch(NUNCA)

    // Ayvens (turismo): lo que hay que pagar por quitar los adhesivos, «Su guía dice», no «Su guía no acepta».
    await page.goto(todo('ayvens', 'turismo', 's'))
    await expect(page.getByTestId('dev-aparte')).toContainText('Su guía dice: hay que pagar todos los costes de quitarlos')
    expect((await bloques(page)).join(' ')).not.toMatch(NUNCA)
  })

  test('«Otra compañía»: lo que piden las demás, tema a tema, sin rangos que mezclen ni «No cobra: Nada»', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await page.getByTestId('dev-cia-otra').click()
    await page.getByTestId('dev-empezar').click()
    const otra = page.getByTestId('dev-otra')
    await expect(otra).toContainText('Muchas compañías no publican la suya.')
    const abolladuras = page.getByTestId('dev-otra-tema').filter({ has: page.getByRole('heading', { name: 'Abolladuras' }) })
    await expect(abolladuras).toContainText('Ayvens')
    await expect(abolladuras).toContainText('Alphabet')
    await expect(otra).not.toContainText(/va de .* a .*, según/)
    await expect(otra).not.toContainText(/No cobra|Acepta: Nada|acepta: No lo dice/)
    // Ni los alquileres ni Arval (no publica su guía de daños).
    await expect(otra).not.toContainText('Hertz')
    await expect(page.getByTestId('dev-otra-fila').filter({ hasText: 'Arval' })).toHaveCount(0)
    await page.getByTestId('dev-atras').click()
    await expect(page.getByTestId('dev-empezar')).toHaveText('Ver lo que piden las demás')
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('la página de una compañía: su tabla, la fuente, la edad y el botón para repasar (también BMW)', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(`${RUTA}/ayvens`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qué cobra Ayvens al devolver un vehículo de renting')
    await expect(page.getByTestId('dev-cia-doc')).toHaveCount(2)
    const tabla = page.getByTestId('dev-tabla').first()
    await expect(tabla.getByRole('row', { name: /Abolladuras en la carrocería/ })).toContainText('pág. 7')
    await expect(page.getByTestId('dev-fuente').first()).toContainText('Sin fecha en el documento · código LPES.LCV.ES-17v1')
    await expect(page.getByTestId('dev-vigencia').first()).toContainText('Documento de LeasePlan (hoy Ayvens)')
    await expect(page.getByTestId('dev-repasar')).toHaveAttribute('href', `${RUTA}#v=f&c=ayvens`)
    // El índice: las zonas de cada documento, y cada una lleva a su sitio de la tabla.
    const indice = page.getByTestId('dev-indice')
    await expect(indice).toContainText('Furgonetas')
    await expect(indice).toContainText('Turismos')
    for (const a of await indice.locator('a').evaluateAll((as) => as.map((x) => x.getAttribute('href')))) {
      expect(await page.locator(a).count(), `el índice lleva a ${a}, que no está`).toBe(1)
    }
    // En pantalla ancha, arriba a la derecha, el dibujo del vehículo: marca la zona por la que se pasa en el índice.
    if (page.viewportSize().width >= 1024) {
      const dibujo = page.getByTestId('dev-cia-dibujo').locator('svg')
      await expect(dibujo).toHaveAttribute('data-zona', '')
      await indice.getByTestId('dev-indice-zona').filter({ hasText: 'Retrovisores' }).first().hover()
      await expect(dibujo).toHaveAttribute('data-zona', 'retrovisores')
    }
    // Lo que no acepta, en tinta con la regla roja a la izquierda (no un muro rojo).
    const celda = await page.getByTestId('dev-no-acepta').first().evaluate((el) => {
      const raiz = getComputedStyle(document.querySelector('.ld-root'))
      const color = (v) => { const p = document.createElement('span'); p.style.color = raiz.getPropertyValue(v); document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c }
      const e = getComputedStyle(el)
      return { texto: e.color, tinta: color('--ld-text'), regla: e.borderLeftColor, rojo: color('--ld-warn'), ancho: e.borderLeftWidth }
    })
    expect(celda.texto).toBe(celda.tinta)
    expect(celda.regla).toBe(celda.rojo)
    expect(celda.ancho).toBe('2px')
    await page.getByTestId('dev-repasar').click()
    await expect(page.getByTestId('dev-cia-ayvens').locator('input')).toBeChecked()

    // BMW solo tiene turismos: su botón abre turismo, con sus preguntas.
    await page.goto(`${RUTA}/bmw-financial-services`)
    await page.getByTestId('dev-repasar').click()
    await expect(page.getByTestId('dev-tipo-turismo')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('dev-empezar')).toHaveText(`Empezar · ${nPasos('bmw-financial-services', 'turismo')} preguntas`)
    // Un enlace viejo, sin vehículo o con furgoneta, también.
    await page.goto(`${RUTA}#c=bmw-financial-services`)
    await expect(page.getByTestId('dev-cia-bmw-financial-services').locator('input')).toBeChecked()
    await page.goto('about:blank')
    await page.goto(`${RUTA}#v=f&c=bmw-financial-services`)
    await expect(page.getByTestId('dev-empezar')).toBeEnabled()
    await expect(page.getByTestId('dev-tipo-turismo')).toHaveAttribute('aria-pressed', 'true')

    await page.goto(`${RUTA}/arval`)
    await expect(page.getByTestId('dev-cia-aviso')).toContainText('Arval no publica su guía de daños')
    await expect(page.getByTestId('dev-precios')).toContainText('390,00 € sin IVA / 471,90 € con IVA')

    // Hertz: el mínimo de 200 € es un bloqueo por el combustible, no un precio de daños.
    await page.goto(`${RUTA}/hertz`)
    await expect(page.getByTestId('dev-precios')).not.toContainText('mínimo 200 €')
    await expect(page.getByTestId('dev-precio-aparte')).toContainText('no un cargo por daños')
    await expect(page.getByTestId('dev-compania')).not.toContainText(/\b(la|su) guía\b|perito/i)

    // Europcar: costes medios estimados, nunca «precio fijo».
    await page.goto(`${RUTA}/europcar`)
    await expect(page.getByTestId('dev-compania')).toContainText('costes medios de reparación estimados por la firma AUDATEX')
    await expect(page.getByTestId('dev-compania')).not.toContainText(/precio fijo|perito|\b(la|su) guía\b/i)

    await page.goto(`${RUTA}/nadie`)
    await expect(page.getByTestId('dev-cia-no-esta')).toBeVisible()
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('los enlaces que no cuadran lo dicen, arriba del todo', async ({ page }) => {
    await preparar(page)
    const casos = [
      [`${RUTA}#v=f&c=ayvens&r=nnnnnnnnnnnn&p=fin`, 'le falta la marca de la versión'],
      [enlace('ayvens', 'furgoneta', '', 99), 'una pregunta que no existe'],
      [`${RUTA}#v=x&c=ayvens`, 'El tipo de vehículo de este enlace no se entiende'],
      [`${RUTA}#v=f&c=nadie&p=0`, 'una compañía que no tenemos'],
    ]
    for (const [u, texto] of casos) {
      await page.goto('about:blank')
      await page.goto(u)
      await expect(page.getByTestId('dev-error')).toContainText(texto)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }
  })

  test('la vista de impresión del resultado: sin botones, con la fecha y las direcciones escritas', async ({ page }) => {
    await preparar(page)
    await page.goto(enlace('hertz', 'turismo', 'nnsnnnnnnn'))
    await expect(page.getByTestId('dev-cifra')).toHaveText('1')
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('dev-imprimir')).toBeHidden()
    await expect(page.getByTestId('dev-mandar')).toBeHidden()
    await expect(page.getByTestId('dev-cambiar').first()).toBeHidden()
    await expect(page.locator('nav').first()).toBeHidden()
    await expect(page.getByTestId('dev-aviso')).toBeVisible()
    await expect(page.getByTestId('dev-impresion-cabecera')).toContainText(/Hecho el \d{1,2} de [a-z]+ de \d{4}/)
    await expect(page.getByTestId('dev-fuente-url').first()).toBeVisible()
    await expect(page.getByTestId('dev-fuente-url').first()).toContainText('https://images.hertz.com/pdfs/RT_FULL_ES_ES.pdf')
    await expect(page.getByTestId('dev-impresion-pie')).toContainText('Este resultado, en línea: http')
    // Lo plegado en pantalla va desplegado en papel, sin el «+».
    await expect(page.getByTestId('dev-item-no').first()).toBeVisible()
    await expect(page.getByTestId('dev-no-lista-resumen')).toBeHidden()
    await expect(page.getByTestId('dev-imprimir-arriba')).toBeHidden()
    // Y la hoja impresa de verdad sale (page.pdf, con la vista de impresión).
    expect((await page.pdf({ format: 'A4' })).length).toBeGreaterThan(10_000)
  })

  test('el resultado se lee arriba: la cifra, el desglose que lleva a cada bloque, los botones, y lo largo plegado', async ({ page }, info) => {
    const { fallos } = await preparar(page)
    const url = enlace('ayvens', 'furgoneta', 'nxssnnnnnnsn', 'fin', '&n=2.port%C3%B3n~3.lateral%20derecho')
    await page.goto(url)
    // «Guardar o imprimir» y «Mandárselo a alguien», también justo debajo de la cifra: a la vista sin bajar.
    const alto = page.viewportSize().height
    for (const id of ['dev-imprimir-arriba', 'dev-mandar-arriba']) {
      const b = await page.getByTestId(id).boundingBox()
      expect(b.y + b.height, `«${id}» queda por debajo de la pantalla`).toBeLessThanOrEqual(alto)
      expect(b.y).toBeLessThan((await page.getByTestId('dev-factura').boundingBox()).y)
    }
    // El desglose: una fila por bloque, con su cuenta.
    await expect(page.getByTestId('dev-desglose-fila')).toHaveText(['2que su guía dice que se facturan', '1que no acepta', '1sin saber todavía', '8que has contestado que no'])
    // Lo que has contestado que no, plegado, con las zonas dichas; se abre con su botón o desde el desglose.
    const plegar = page.getByTestId('dev-no-lista-plegar')
    await expect(plegar).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('dev-item-no').first()).toBeHidden()
    await expect(page.getByTestId('dev-no-lista-resumen')).toHaveText('8 preguntas: Paragolpes, pintura, retrovisores, llantas, neumáticos, zona de carga, interior y limpieza. Ábrelo para ver cada una.')
    await page.getByTestId('dev-desglose-fila').filter({ hasText: 'que has contestado que no' }).click()
    await expect(plegar).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('dev-item-no')).toHaveCount(8)
    await expect(page.getByTestId('dev-item-no').first()).toBeInViewport()
    // El desglose no toca el # (es el estado del recorrido).
    expect(page.url()).toMatch(/&p=fin$/)
    await plegar.click()
    await expect(page.getByTestId('dev-item-no').first()).toBeHidden()
    // «Cambiar», gris y sin subrayar hasta pasar por encima.
    const cambiar = page.getByTestId('dev-factura').getByTestId('dev-cambiar').first()
    const linea = () => cambiar.evaluate((el) => getComputedStyle(el).textDecorationLine)
    expect(await linea()).toBe('none')
    if (info.project.name === 'escritorio') {
      await cambiar.hover()
      expect(await linea()).toBe('underline')
    }
    // «Mandárselo» de arriba avisa arriba.
    await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
    await page.getByTestId('dev-mandar-arriba').click()
    await expect(page.getByTestId('dev-copiado-arriba')).toContainText(/Enlace copiado|Copia este enlace/)
    await expect(page.getByTestId('dev-copiado')).toHaveText('')
    await sinDesbordes(page)
    expect(fallos).toEqual([])
  })

  test('a 390 px: sin desbordes, y las respuestas a la vista sin bajar en cada paso', async ({ page }) => {
    await preparar(page)
    await page.setViewportSize({ width: 390, height: 664 })
    for (const u of [RUTA, enlace('ayvens', 'furgoneta', 'nnn', 3), enlace('alphabet', 'furgoneta', 's'.repeat(nPasos('alphabet', 'furgoneta'))), `${RUTA}#v=f&c=otra&p=fin`, `${RUTA}/europcar`, `${RUTA}/ayvens`, `${RUTA}/bmw-financial-services`]) {
      await page.goto('about:blank')
      await page.goto(u)
      await page.waitForLoadState('networkidle')
      await sinDesbordes(page)
    }
    for (const [slug, v] of [['bmw-financial-services', 'turismo'], ['ayvens', 'turismo'], ['europcar', 'furgoneta']]) {
      const n = nPasos(slug, v)
      for (let i = 0; i < n; i++) {
        await page.goto('about:blank')
        await page.goto(enlace(slug, v, '', i))
        for (const id of ['dev-no', 'dev-si', 'dev-nose']) {
          const b = await page.getByTestId(id).boundingBox()
          expect(b.y + b.height, `${slug} paso ${i + 1}: «${id}» queda por debajo de la pantalla`).toBeLessThanOrEqual(664)
        }
      }
    }
  })

  test('entre 640 y 900 px las tablas de precios no se cortan', async ({ page }) => {
    await preparar(page)
    for (const ancho of [640, 700, 820, 900]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto(`${RUTA}/europcar`)
      await page.locator('details summary').filter({ hasText: 'importes de su tabla' }).first().click()
      const { tabla, raiz } = await page.evaluate(() => ({ tabla: document.querySelector('[data-testid="dev-precios"]').getBoundingClientRect().right, raiz: document.documentElement.clientWidth }))
      expect(tabla, `a ${ancho} px la tabla de precios se sale`).toBeLessThanOrEqual(raiz)
      await sinDesbordes(page)
    }
  })

  test('la portada y el pie llevan a la herramienta', async ({ page }) => {
    await preparar(page)
    await page.goto('/')
    await expect(page.getByTestId('emp-devolucion')).toHaveAttribute('href', RUTA)
    await expect(page.getByTestId('emp-devolucion')).toContainText('¿Qué te van a cobrar al devolverlo?')
    await expect(page.getByRole('link', { name: '¿Qué te van a cobrar al devolverlo?', exact: true })).toHaveAttribute('href', RUTA)
  })
})

/* Las fotos para mirarlas (no comprueban nada): FOTOS_DEVOLUCION=<carpeta>; con FOTOS_NOCHE=1, de noche; con
   FOTOS_SOLO=resultado,compania-ayvens…, solo esas. Además, la hoja impresa del resultado en PDF (resultado.pdf). */
test('fotos', async ({ page }, info) => {
  const dir = process.env.FOTOS_DEVOLUCION
  test.skip(!dir || info.project.name !== 'escritorio', 'solo con FOTOS_DEVOLUCION, una vez')
  test.setTimeout(400_000)
  await preparar(page)
  const noche = process.env.FOTOS_NOCHE === '1'
  const solo = (process.env.FOTOS_SOLO || '').split(',').filter(Boolean)
  if (noche) await page.addInitScript(() => { try { localStorage.setItem('fds_tema_web', 'dark') } catch { /* nada */ } })
  const todas = [
    ['entrada', RUTA + '#v=f&c=ayvens'],
    ['paso-medida', enlace('ayvens', 'furgoneta', 'nxs', 3, '&n=2.port%C3%B3n')],
    ['paso-retrovisor', enlace('ayvens', 'furgoneta', 'nxsnn', 5)],
    ['paso-bmw', enlace('bmw-financial-services', 'turismo', 'nn', 2)],
    ['resultado', enlace('ayvens', 'furgoneta', 'nxssnnnnnnsn', 'fin', '&n=2.port%C3%B3n~3.lateral%20derecho')],
    ['resultado-bmw', enlace('bmw-financial-services', 'turismo', 'nnsnxnnnnns')],
    ['resultado-athlon', enlace('athlon', 'furgoneta', 'snsnnn')],
    ['paso-accesorios', enlace('arval', 'furgoneta', 'nnn', 3)],
    ['otra', `${RUTA}#v=f&c=otra&p=fin`],
    ['compania-ayvens', `${RUTA}/ayvens`],
    ['compania-arval', `${RUTA}/arval`],
    ['compania-europcar', `${RUTA}/europcar`],
    ['resultado-alphabet', enlace('alphabet', 'furgoneta', 's'.repeat(nPasos('alphabet', 'furgoneta')))],
    ['compania-bmw', `${RUTA}/bmw-financial-services`],
  ]
  const tomas = solo.length ? todas.filter(([n]) => solo.includes(n) || n === 'resultado') : todas
  for (const ancho of [390, 1280]) {
    await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 800 })
    for (const [n, u] of tomas) {
      await page.goto('about:blank')
      await page.goto(u)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `${dir}/${n}-${ancho}.png`, fullPage: true })
      if (n.startsWith('paso')) await page.screenshot({ path: `${dir}/${n}-${ancho}-pantalla.png` })
      if (n === 'compania-ayvens' && ancho === 1280) {
        await page.getByTestId('dev-indice-zona').filter({ hasText: 'Zona de carga' }).first().hover()
        await page.screenshot({ path: `${dir}/${n}-${ancho}-indice.png` })
      }
    }
    await page.goto('about:blank')
    await page.goto(tomas.find(([n]) => n === 'resultado')[1])
    await page.waitForLoadState('networkidle')
    await page.emulateMedia({ media: 'print' })
    await page.screenshot({ path: `${dir}/resultado-impresion-${ancho}.png`, fullPage: true })
    // Como sale al «Guardar como PDF» del navegador (sin gráficos de fondo, lo que viene marcado).
    if (ancho === 1280 && !noche) await page.pdf({ path: `${dir}/resultado.pdf`, format: 'A4' })
    await page.emulateMedia({ media: 'screen' })
  }
})
