/* global process */
import { test, expect } from '@playwright/test'

/* «¿QUÉ TE VAN A COBRAR AL DEVOLVERLO?» (/devolucion-renting, 14-11-2026). Lo que no puede fallar en una herramienta que
   se usa de pie junto al vehículo y que se manda por WhatsApp: el recorrido entero con una guía (cada respuesta), el
   resultado con la página de cada cosa, «Otra compañía», volver atrás, el enlace que reconstruye el resultado (y el
   que no cuadra con los datos), la página de una compañía con su tabla, la vista de impresión, 390 px sin desbordes y
   que de la herramienta no sale ninguna petición a /api (la única es el contador anónimo de visitas de toda la web,
   que manda la ruta sin el #). Fotos para mirarlas: FOTOS_DEVOLUCION=<carpeta>. */

const RUTA = '/devolucion-renting'

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

test.describe('/devolucion-renting', () => {
  test('la entrada: tipo de vehículo, compañías y nada guardado', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿Qué te van a cobrar al devolverlo?')
    await expect(page.getByText('Sin registro. No guardamos nada de tu vehículo.')).toBeVisible()
    await expect(page.getByTestId('dev-empezar')).toBeDisabled()
    // Furgoneta por defecto: BMW (solo turismos) no está en la lista y se dice.
    await expect(page.getByTestId('dev-cia-bmw-financial-services')).toHaveCount(0)
    await expect(page.getByText('BMW Financial Services solo publica guía de turismos.')).toBeVisible()
    await page.getByTestId('dev-tipo-turismo').click()
    await expect(page.getByTestId('dev-cia-bmw-financial-services')).toBeVisible()
    // Los alquileres, aparte.
    await expect(page.getByRole('group', { name: 'Si es un alquiler' }).getByText('Hertz')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Si es un alquiler' }).getByText('Europcar')).toBeVisible()
    await page.getByTestId('dev-tipo-furgoneta').click()
    await page.getByTestId('dev-cia-ayvens').click()
    await expect(page.getByTestId('dev-empezar')).toHaveText('Empezar · 12 preguntas')
    const cookies = await page.context().cookies()
    expect(cookies).toEqual([])
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /devol|guia|renting/i.test(k)))).toEqual([])
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('el recorrido entero con Ayvens (furgoneta), volver atrás, el resultado y el enlace compartido', async ({ page, browser }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await page.getByTestId('dev-cia-ayvens').click()
    await page.getByTestId('dev-empezar').click()

    // Paso 1: la pregunta, la regla con su página y sin ayuda para medir (10 cm no queda cerca de nada).
    await expect(page.getByTestId('dev-cuenta')).toHaveText('1 de 12')
    await expect(page.getByTestId('dev-pregunta')).toContainText('paragolpes')
    await expect(page.getByTestId('dev-regla')).toContainText('Hasta 10 cm, siempre que se quiten con un pulido mecánico.')
    await expect(page.getByTestId('dev-regla')).toContainText('pág. 8')
    await expect(page.getByTestId('dev-medir')).toHaveCount(0)
    await page.getByTestId('dev-no').click()

    // Paso 2: «No lo sé todavía».
    await expect(page.getByTestId('dev-cuenta')).toHaveText('2 de 12')
    await page.getByTestId('dev-nose').click()

    // Paso 3 y atrás: vuelve al 2 con su respuesta marcada; el «atrás» del navegador, igual.
    await expect(page.getByTestId('dev-cuenta')).toHaveText('3 de 12')
    await page.getByTestId('dev-atras').click()
    await expect(page.getByTestId('dev-cuenta')).toHaveText('2 de 12')
    await expect(page.getByTestId('dev-nose')).toHaveAttribute('aria-pressed', 'true')
    await page.goBack()
    await expect(page.getByTestId('dev-cuenta')).toHaveText('1 de 12')
    await expect(page.getByTestId('dev-no')).toHaveAttribute('aria-pressed', 'true')
    await page.goForward()
    await expect(page.getByTestId('dev-cuenta')).toHaveText('2 de 12')
    await page.getByTestId('dev-nose').click()

    // Paso 3: arañazos en la chapa → «Sí, alguna» con nota.
    await page.getByTestId('dev-si').click()
    await page.getByTestId('dev-donde').fill('portón')
    await page.getByTestId('dev-seguir').click()

    // Paso 4: abolladuras, con la moneda de 10 céntimos («casi 2 cm»).
    await expect(page.getByTestId('dev-cuenta')).toHaveText('4 de 12')
    await expect(page.getByTestId('dev-medir')).toContainText('Una moneda de 10 céntimos mide 19,75 mm: casi 2 cm.')
    await page.getByTestId('dev-si').click()
    await page.getByTestId('dev-donde').fill('lateral derecho')
    await page.getByTestId('dev-seguir').click()

    // «También mira» en la zona de carga (paso 9), y las demás.
    for (let i = 5; i <= 12; i++) {
      await expect(page.getByTestId('dev-cuenta')).toHaveText(`${i} de 12`)
      if (i === 9) {
        await page.getByTestId('dev-tambien').locator('summary').click()
        await expect(page.getByTestId('dev-tambien')).toContainText('Suelo de carga')
      }
      if (i === 11) {
        await page.getByTestId('dev-si').click()
        await page.getByTestId('dev-seguir').click()
      } else await page.getByTestId('dev-no').click()
    }

    // El resultado: 3 cosas que su guía dice que se facturan, cada una con su página.
    const res = page.getByTestId('dev-resultado')
    await expect(res).toBeVisible()
    await expect(page.getByTestId('dev-cifra')).toHaveText('3')
    const items = page.getByTestId('dev-item-factura')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText('Arañazo en la chapa · portón')
    await expect(items.nth(0)).toContainText('pág. 7')
    await expect(items.nth(1)).toContainText('lateral derecho')
    await expect(items.nth(2)).toContainText('Falta un juego de llaves')
    await expect(items.nth(2)).toContainText('pág. 3')
    await expect(page.getByTestId('dev-nose-lista')).toContainText('Revisarlo con luz natural, sin sombras, y en seco.')
    await expect(page.getByTestId('dev-dentro')).toContainText('8')
    await expect(page.getByTestId('dev-aparte')).toContainText('Bacas, barras de techo y enganche de remolque')
    await expect(page.getByTestId('dev-aviso')).toHaveText('Orientativo: decide el perito de tu compañía con la guía que esté en vigor.')
    await expect(page.getByTestId('dev-fuente')).toContainText('Leída el 14 de noviembre de 2026')
    await expect(page.getByTestId('dev-fuente').getByRole('link').first()).toHaveAttribute('href', /normativa_devolucion_vehiculos_comerciales\.pdf$/)
    await expect(res).not.toContainText(/te lo cobrarán|no te lo pueden cobrar|te ahorras/i)

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

  test('«Otra compañía»: lo que piden las demás, tema a tema y con su nombre', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(RUTA)
    await page.getByTestId('dev-cia-otra').click()
    await page.getByTestId('dev-empezar').click()
    const otra = page.getByTestId('dev-otra')
    await expect(otra).toContainText('Muchas compañías no publican la suya.')
    const abolladuras = page.getByTestId('dev-otra-tema').filter({ has: page.getByRole('heading', { name: 'Abolladuras' }) })
    await expect(abolladuras).toContainText('Ayvens')
    await expect(abolladuras).toContainText('Alphabet')
    await expect(abolladuras.getByTestId('dev-rango')).toHaveText('Lo que aceptan sin cobrar va de 10 mm a 2 cm, según la guía.')
    await expect(otra).not.toContainText('Hertz')
    await page.getByTestId('dev-atras').click()
    await expect(page.getByTestId('dev-empezar')).toHaveText('Ver lo que piden las demás')
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('la página de una compañía: su tabla, la fuente y el botón para repasar', async ({ page }) => {
    const { api, fallos } = await preparar(page)
    await page.goto(`${RUTA}/ayvens`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qué cobra Ayvens al devolver un vehículo de renting')
    await expect(page.getByTestId('dev-cia-doc')).toHaveCount(2)
    const tabla = page.getByTestId('dev-tabla').first()
    await expect(tabla.getByRole('row', { name: /Abolladuras en la carrocería/ })).toContainText('pág. 7')
    await expect(page.getByTestId('dev-fuente').first()).toContainText('Sin fecha en el documento · código LPES.LCV.ES-17v1')
    await expect(page.getByTestId('dev-repasar')).toHaveAttribute('href', `${RUTA}#c=ayvens`)
    await page.getByTestId('dev-repasar').click()
    await expect(page.getByTestId('dev-cia-ayvens').locator('input')).toBeChecked()

    await page.goto(`${RUTA}/arval`)
    await expect(page.getByTestId('dev-cia-aviso')).toContainText('Arval no publica su guía de daños')
    await expect(page.getByTestId('dev-precios')).toContainText('390,00 € sin IVA / 471,90 € con IVA')

    await page.goto(`${RUTA}/nadie`)
    await expect(page.getByTestId('dev-cia-no-esta')).toBeVisible()
    soloContador(api)
    expect(fallos).toEqual([])
  })

  test('la vista de impresión del resultado: sin botones ni cabecera', async ({ page }) => {
    await preparar(page)
    await page.goto(`${RUTA}#v=t&c=hertz&r=nnsnnnnnnn&p=fin`)
    await expect(page.getByTestId('dev-cifra')).toHaveText('1')
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('dev-imprimir')).toBeHidden()
    await expect(page.getByTestId('dev-mandar')).toBeHidden()
    await expect(page.locator('nav').first()).toBeHidden()
    await expect(page.getByTestId('dev-aviso')).toBeVisible()
    await expect(page.getByTestId('dev-fuente')).toBeVisible()
  })

  test('a 390 px no se desplaza de lado (entrada, paso, resultado, otra, compañía)', async ({ page }) => {
    await preparar(page)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const u of [RUTA, `${RUTA}#v=f&c=ayvens&p=3`, `${RUTA}#v=f&c=alphabet&r=sssssssssss&p=fin`, `${RUTA}#v=f&c=otra&p=fin`, `${RUTA}/europcar`, `${RUTA}/ayvens`, `${RUTA}/bmw-financial-services`]) {
      await page.goto(u)
      await page.waitForLoadState('networkidle')
      await sinDesbordes(page)
    }
  })

  test('la portada y el pie llevan a la herramienta', async ({ page }) => {
    await preparar(page)
    await page.goto('/')
    await expect(page.getByTestId('emp-devolucion')).toHaveAttribute('href', RUTA)
    await expect(page.getByTestId('emp-devolucion')).toContainText('¿Qué te van a cobrar al devolverla?')
    await expect(page.getByRole('link', { name: '¿Qué te cobra tu renting al devolver?' })).toHaveAttribute('href', RUTA)
  })
})

/* Las fotos para mirarlas (no comprueban nada): FOTOS_DEVOLUCION=<carpeta>. */
test('fotos', async ({ page }, info) => {
  const dir = process.env.FOTOS_DEVOLUCION
  test.skip(!dir || info.project.name !== 'escritorio', 'solo con FOTOS_DEVOLUCION, una vez')
  await preparar(page)
  const tomas = [
    ['entrada', RUTA + '#v=f&c=ayvens'],
    ['paso-medida', RUTA + '#v=f&c=ayvens&r=nxs&n=2.port%C3%B3n&p=3'],
    ['paso-sin-medida', RUTA + '#v=f&c=ayvens&r=nxsssnnn&p=8'],
    ['resultado', RUTA + '#v=f&c=ayvens&r=nxssnnnnnnsn&n=2.port%C3%B3n~3.lateral%20derecho&p=fin'],
    ['otra', RUTA + '#v=f&c=otra&p=fin'],
    ['compania-renting', RUTA + '/ayvens'],
    ['compania-arval', RUTA + '/arval'],
    ['compania-alquiler', RUTA + '/europcar'],
    ['paso-turismo', RUTA + '#v=t&c=bmw-financial-services&r=nn&p=2'],
  ]
  for (const ancho of [390, 1280]) {
    await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 })
    for (const [n, u] of tomas) {
      await page.goto('about:blank')
      await page.goto(u)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `${dir}/${n}-${ancho}.png`, fullPage: true })
    }
    await page.goto(tomas[3][1])
    await page.waitForLoadState('networkidle')
    await page.emulateMedia({ media: 'print' })
    await page.screenshot({ path: `${dir}/resultado-impresion-${ancho}.png`, fullPage: true })
    await page.emulateMedia({ media: 'screen' })
  }
})
