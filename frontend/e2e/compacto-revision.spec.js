import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LO QUE SALIÓ AL MIRAR LAS CAPTURAS DEL DISEÑO COMPACTO (08-11-2026, parte F2). Son cosas que se ven y que ninguna prueba de
   comportamiento miraba; cada prueba mide en la pantalla lo que se vio en la captura:
   - la cifra del bono («0/20») pegada al borde derecho de su caja (4 de aire contra 12 a la izquierda);
   - la tarjeta «¿Qué tal te va la app?» más estrecha que el resto de la columna (un `mx-auto` en un flex en columna);
   - «Guardar este orden» (el pie de «A mano») detrás de la barra de pestañas hasta llegar al final de la lista;
   - «Por entregar · 15» del portal del conductor, de 10 px de ancho y en 4 líneas bajo la lupa, a 390-412 de ancho.
   - el importe cobrado de una fila de «Hechas hoy» («· 1…» a 360, con la etiqueta «Verificada por IA» al lado).
   (El doble ✓ de «Añadida a tu ruta» se mira en escanear-etiqueta.spec.js.) */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

async function preparar(page, context) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_aviso_manana', 'no')
    localStorage.setItem('fds_tour_ruta', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], status: 'active', suscrita: true, suscrito: true,
    ciclo: 'mensual', proximo_cobro: new Date(Date.now() + 30 * 86400000).toISOString() } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
}

const pendiente = (i) => ({ id: `p${i}`, cliente: `Cliente ${i}`, direccion: `Calle de prueba ${i}, A Coruña`, estado: 'pendiente', bultos: 1, orden: i, eta: `10:${10 + i}`, lat: 43.37 + i / 1000, lng: -8.4 })
const hecha = (i) => ({ id: `h${i}`, cliente: `Hecha ${i}`, direccion: `Calle hecha ${i}`, estado: 'entregado', bultos: 1, orden: i, cerrado_en: '2026-11-03T08:00:00Z' })
const ruta = (pedidos, extra = {}) => ({ activo: true, autonomo: true, empresa: '', fecha: '2026-11-03', ia_tickets: false, jornada: {}, aviso_aceptado: true,
  base: null, ruta: pedidos.length ? { fin: '11:00', minutos: 60, km: 9, trafico: true } : null, pedidos, ...extra })

test('Compacto · el bono: la cifra tiene el mismo aire a la derecha que el icono a la izquierda', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([], { bono: { cent: 1000, pagado: false, entregas: 0, dias: 0, objetivo: 20, dias_objetivo: 2, hasta: '2026-11-30' } }) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const bono = page.getByTestId('bono')
  await expect(bono).toBeVisible()
  const m = await bono.evaluate((el) => {
    const caja = el.getBoundingClientRect()
    const cifra = [...el.querySelectorAll('span')].find((s) => /^\d+\/\d+$/.test(s.textContent.trim())).getBoundingClientRect()
    const icono = el.querySelector('svg').getBoundingClientRect()
    return { izquierda: icono.left - caja.left, derecha: caja.right - cifra.right }
  })
  expect(m.izquierda).toBeGreaterThanOrEqual(11.5)
  expect(Math.abs(m.izquierda - m.derecha), `izquierda ${m.izquierda}, derecha ${m.derecha}`).toBeLessThanOrEqual(1)
})

test('Compacto · la tarjeta «¿Qué tal te va la app?» ocupa todo el ancho de la columna', async ({ page, context }) => {
  await preparar(page, context)
  await page.route(/\/api\/opinion\/estado/, (r) => r.fulfill({ json: { pedir: true } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([hecha(1), hecha(2), hecha(3)]) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const opinion = page.getByRole('region', { name: '¿Qué tal te va la app?' })
  await expect(opinion).toBeVisible()
  const ancho = (l) => l.evaluate((el) => ({ x: el.getBoundingClientRect().left, w: el.getBoundingClientRect().width }))
  const o = await ancho(opinion)
  const columna = await ancho(page.getByLabel('Progreso del día'))
  expect(Math.abs(o.w - columna.w), `opinión ${o.w}, columna ${columna.w}`).toBeLessThanOrEqual(1)
  expect(Math.abs(o.x - columna.x)).toBeLessThanOrEqual(1)
})

test('Compacto · «Guardar este orden» queda por encima de las pestañas, no detrás', async ({ page, context }) => {
  await preparar(page, context)
  const pedidos = Array.from({ length: 14 }, (_, i) => pendiente(i + 1))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'A mano' }).click()
  const guardar = page.getByRole('button', { name: 'Guardar este orden' })
  await expect(guardar).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  const caja = await guardar.boundingBox()
  const pestanas = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox()
  expect(caja.y + caja.height, `el pie acaba en ${caja.y + caja.height} y las pestañas empiezan en ${pestanas.y}`).toBeLessThanOrEqual(pestanas.y + 0.5)
  // Y se puede tocar: lo que hay en su centro es el propio botón.
  const quien = await guardar.evaluate((el) => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) })
  expect(quien).toBe(true)
})

test('Compacto · portal del conductor: «Por entregar · N» cabe en su línea a 390 y a 412 de ancho', async ({ page }) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(Array.from({ length: 6 }, (_, i) => pendiente(i + 1)), { autonomo: false, empresa: 'Súper' }) }))
  for (const [ancho, alto] of [[390, 844], [393, 852], [412, 915], [360, 740]]) {
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
    const titulo = page.getByRole('heading', { name: /Por entregar/ })
    await expect(titulo).toBeVisible()
    const m = await titulo.evaluate((el) => ({ alto: el.getBoundingClientRect().height, sobra: el.scrollWidth - el.clientWidth }))
    expect(m.alto, `a ${ancho} de ancho el título mide ${m.alto} de alto (una línea ≈ 16)`).toBeLessThanOrEqual(24)
    expect(m.sobra, `a ${ancho} el texto se sale de su caja`).toBeLessThanOrEqual(1)
    // La lupa y «A mano» siguen a la vista y en su fila.
    await expect(page.getByRole('button', { name: 'Buscar en la ruta' }).or(page.getByRole('button', { name: 'A mano' })).first()).toBeVisible()
  }
})

test('Compacto · «Hechas hoy»: el importe cobrado no se corta a 360 de ancho, ni con la etiqueta de la IA al lado', async ({ page, context }) => {
  await preparar(page, context)
  await page.setViewportSize({ width: 360, height: 740 })
  const kiosko = { ...hecha(1), cliente: 'Kiosko Luz', cobrado_importe: 12, cobrado_metodo: 'tarjeta', entrega_ia: { nivel: 'verificada' } }
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([kiosko, pendiente(2), pendiente(3)]) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.locator('details').filter({ hasText: 'Hechas hoy' }).evaluate((d) => { d.open = true })
  const estado = page.getByText(/Entregado · 12,00\s€/)   // el importe lleva un espacio fino sin salto antes del €
  await expect(estado).toBeVisible()
  const sobra = await estado.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(sobra, 'el texto «hora · Entregado · 12,00 €» sale cortado con «…»').toBeLessThanOrEqual(1)
  await expect(page.getByText('Verificada por IA')).toBeVisible()
})

/* LOS RETOQUES ANTES DE PUBLICAR (08-11-2026, parte RW), después de que Dani viera las fotos «antes | después» y dijera que sí:
   - la nota del cliente se cortaba a mitad del número del portal («Portal: 45…») en la tarjeta de la siguiente, y en la guía ni
     llegaba a leerse (la línea de las notas se acababa en «Medi…»);
   - «Instala la app» e «Instalar la app» salían repetidos en el mismo aviso;
   - el nombre de las paradas de dos cifras se corría unos 4 px desde la fila 10. */

/* Un fragmento de texto (el portal) está a la vista ENTERO: su caja cae dentro de la del primer ancestro que recorta (el que tiene
   `overflow` distinto de visible: el `truncate` y el `line-clamp` lo ponen). Lo que no cabe queda fuera de esa caja, y lo que se ve
   a medias («Portal: 45…») tampoco cuenta. Devuelve las cajas para poder decir qué pasó. */
const aLaVista = (loc, fragmento) => loc.evaluate((el, f) => {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let nodo = w.nextNode()
  while (nodo && !nodo.data.includes(f)) nodo = w.nextNode()
  if (!nodo) return { ok: false, motivo: `no hay un texto con «${f}»` }
  const i = nodo.data.indexOf(f)
  const r = document.createRange()
  r.setStart(nodo, i)
  r.setEnd(nodo, i + f.length)
  const cajas = [...r.getClientRects()]
  let recorte = el
  while (recorte && getComputedStyle(recorte).overflowX === 'visible' && getComputedStyle(recorte).overflowY === 'visible') recorte = recorte.parentElement
  const marco = (recorte || document.documentElement).getBoundingClientRect()
  const entero = cajas.length > 0 && cajas.every((q) => q.left >= marco.left - 0.5 && q.right <= marco.right + 0.5 && q.top >= marco.top - 0.5 && q.bottom <= marco.bottom + 0.5)
  const redondo = (q) => [q.left, q.top, q.right, q.bottom].map((n) => Math.round(n))
  return { ok: entero, motivo: `«${f}» en ${JSON.stringify(cajas.map(redondo))}, dentro de ${JSON.stringify(redondo(marco))}` }
}, fragmento)

// Farmacia Sol, como en la captura 10-hoy: cobrar, horario, lo que lleva, su hueco y dos notas (la del cliente, larga, y «Timbre 2º B»).
const farmacia = (extra = {}) => ({
  id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente', bultos: 2, orden: 1, eta: '09:41', lat: 43.3704, lng: -8.4003,
  geo: 'puerta', telefono: '613403123', cobrar: 24.5, ventana_desde: '09:30', ventana_hasta: '11:00', hueco: 'Detrás · izq', contenido: 'Medicamentos', notas: 'Timbre 2º B',
  cliente_dice: { estare: 'no', dejar: 'porteria', portal: '4521', nota: 'Si no estoy, al portero' }, ...extra })

test('Compacto · la tarjeta de la siguiente enseña lo que dice el cliente en dos líneas, con el portal entero', async ({ page, context }) => {
  await preparar(page, context)
  const pedidos = [farmacia(), pendiente(2), pendiente(3)]
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  for (const ancho of [360, 390]) {
    await page.setViewportSize({ width: ancho, height: 780 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByRole('region', { name: 'Siguiente parada' })
    const dice = tarjeta.getByTestId('cliente-dice')
    await expect(dice).toBeVisible()
    // «Portal: 4521» entero y a la vista (con `truncate` salía «Portal: 45…» o ni se veía).
    const portal = await aLaVista(tarjeta.getByText(/Portal: 4521/), 'Portal: 4521')
    expect(portal.ok, `a ${ancho} de ancho: ${portal.motivo}`).toBe(true)
    // Y todo lo que dijo el cliente cabe en las dos líneas (78 caracteres): nada se corta con «…».
    const texto = dice.locator('span.line-clamp-2')
    const m = await texto.evaluate((el) => ({ alto: el.getBoundingClientRect().height, linea: parseFloat(getComputedStyle(el).lineHeight), sobra: el.scrollHeight - el.clientHeight }))
    expect(m.alto, `a ${ancho}: lo que dice el cliente ocupa dos líneas (${m.alto} de alto, una línea ≈ ${m.linea})`).toBeGreaterThan(m.linea * 1.5)
    expect(m.sobra, `a ${ancho}: lo que dice el cliente se corta`).toBeLessThanOrEqual(1)
    // Con las dos líneas ocupadas, la nota de la parada («Timbre 2º B») se queda en la hoja, y la tarjeta sigue en sus 284.
    await expect(tarjeta.getByText('Timbre 2º B')).toHaveCount(0)
    const caja = await tarjeta.boundingBox()
    expect(caja.height, `a ${ancho}: la tarjeta mide 216-284 (§5.1 d)`).toBeLessThanOrEqual(284)
    expect(caja.height).toBeGreaterThanOrEqual(216)
    test.info().annotations.push({ type: `tarjeta a ${ancho}`, description: `${caja.height} px con lo del cliente en dos líneas` })
    const entregado = await tarjeta.getByRole('button', { name: 'Entregado', exact: true }).boundingBox()
    const pestanas = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox()
    expect(entregado.y + entregado.height, '«Entregado» por encima de las pestañas, sin desplazar').toBeLessThanOrEqual(pestanas.y)
    // La hoja de la parada lo enseña todo: lo del cliente y «Timbre 2º B».
    await tarjeta.getByRole('button', { name: /Ver la parada 1: Farmacia Sol/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Farmacia Sol' })
    await expect(hoja.getByText('Timbre 2º B')).toBeVisible()
    await expect(hoja.getByText(/Portal: 4521/)).toBeVisible()
    await hoja.getByRole('button', { name: 'Cerrar' }).click()
    await expect(hoja).toHaveCount(0)
  }
})

test('Compacto · lo que dice el cliente, si cabe en una línea, deja la segunda para el siguiente dato', async ({ page, context }) => {
  await preparar(page, context)
  await page.setViewportSize({ width: 360, height: 780 })
  const pedidos = [farmacia({ cliente_dice: { estare: 'si' } }), pendiente(2), pendiente(3)]
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const tarjeta = page.getByRole('region', { name: 'Siguiente parada' })
  await expect(tarjeta.getByTestId('cliente-dice')).toContainText('Estará en casa')
  await expect(tarjeta.getByText('Timbre 2º B')).toBeVisible()   // la segunda línea, como antes
  const caja = await tarjeta.boundingBox()
  expect(caja.height).toBeLessThanOrEqual(284)
  test.info().annotations.push({ type: 'tarjeta a 360', description: `${caja.height} px con lo del cliente en una línea y «Timbre 2º B» debajo` })
})

test('Compacto · la guía enseña lo que dice el cliente aparte y primero, hasta el portal, antes de llegar y al llegar', async ({ page, context }) => {
  await preparar(page, context)
  await page.setViewportSize({ width: 360, height: 780 })
  await context.setGeolocation({ latitude: 43.3665, longitude: -8.4065 })
  const pedidos = [farmacia(), pendiente(2), pendiente(3)]
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: {
    fuente: 'carreteras', metros: 999, minutos: 4.1, linea: [[43.3665, -8.4065], [43.3675, -8.4074], [43.3679, -8.4066], [43.3713, -8.4006], [43.3704, -8.4003]],
    pasos: [
      { texto: 'Sal por Túnel Praza de Lugo', icono: 'recto', punto: [43.3665, -8.4065], metros: 140 },
      { texto: 'Gira a la derecha por Praza de Pontevedra', icono: 'derecha', punto: [43.3675, -8.4074], metros: 86 },
      { texto: 'Has llegado', icono: 'llegada', punto: [43.3704, -8.4003], metros: 0 },
    ] } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('region', { name: 'Siguiente parada' }).getByRole('button', { name: 'Ir', exact: true }).click()
  const nav = page.getByRole('dialog', { name: 'Navegación' })
  await expect(nav.getByTestId('guia-distancia')).toBeVisible()
  const panel = nav.getByTestId('guia-panel')

  const mirar = async (cuando) => {
    // Lo que dice el cliente, a la vista y entero (78 caracteres: caben en sus dos líneas).
    const portal = await aLaVista(nav.getByText(/Portal: 4521/), 'Portal: 4521')
    expect(portal.ok, `${cuando}: ${portal.motivo}`).toBe(true)
    const dice = nav.getByTestId('guia-dice')
    await expect(dice, cuando).toBeVisible()
    const m = await dice.locator('span.line-clamp-2').evaluate((el) => ({ alto: el.getBoundingClientRect().height, linea: parseFloat(getComputedStyle(el).lineHeight), sobra: el.scrollHeight - el.clientHeight }))
    expect(m.alto, `${cuando}: lo que dice el cliente ocupa dos líneas`).toBeGreaterThan(m.linea * 1.5)
    expect(m.sobra, `${cuando}: lo que dice el cliente se corta`).toBeLessThanOrEqual(1)
    // Va ANTES que el resto de las notas, y lo demás sigue en su línea: lo que se cobra primero, la nota de la parada («Timbre 2º B»)
    // antes que dónde va en la furgoneta y que lo que lleva, para que el timbre no se pierda al cortarse la línea por el final.
    const [cajaDice, cajaNotas] = await Promise.all([dice.boundingBox(), nav.getByTestId('guia-notas').boundingBox()])
    expect(cajaDice.y + cajaDice.height, `${cuando}: lo que dice el cliente, encima de las demás notas`).toBeLessThanOrEqual(cajaNotas.y + 0.5)
    await expect(nav.getByTestId('guia-notas')).toContainText('Cobrar 24,50 €')
    await expect(nav.getByTestId('guia-notas')).toContainText('Detrás · izq')
    const timbre = await aLaVista(nav.getByTestId('guia-notas').getByText('Timbre 2º B'), 'Timbre 2º B')
    expect(timbre.ok, `${cuando}: ${timbre.motivo}`).toBe(true)
    // El panel: de 165 a 225 y, con las dos líneas del cliente, una de más (leer el portal vale más que esos 225; §5.8 / §7.4).
    const caja = await panel.boundingBox()
    expect(caja.height, `${cuando}: el panel mide ${caja.height}`).toBeGreaterThanOrEqual(165)
    expect(caja.height, `${cuando}: el panel mide ${caja.height} (225 + la segunda línea del cliente)`).toBeLessThanOrEqual(245)
    // Los botones del mapa siguen 12 por encima del panel.
    await expect.poll(async () => {
      const [p, c] = await Promise.all([panel.boundingBox(), nav.getByTestId('guia-botones').boundingBox()])
      return Math.abs(c.y + c.height + 12 - p.y)
    }, { message: `${cuando}: los botones, 12 por encima del panel` }).toBeLessThanOrEqual(1)
    return caja.height
  }
  const antesDeLlegar = await mirar('antes de llegar')
  await nav.getByRole('button', { name: 'Ya he llegado' }).click()
  await expect(nav.getByText('Has llegado').first()).toBeVisible()
  const alLlegar = await mirar('al llegar')
  test.info().annotations.push({ type: 'panel de la guía', description: `${antesDeLlegar} px antes de llegar y ${alLlegar} al llegar (360×780, con lo que dice el cliente en dos líneas)` })
})

test.describe('Compacto · el aviso de instalar (Android)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' })
  test('el aviso «Instala la app» no repite la frase en su botón: dice «Instalar»', async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await preparar(page, context)
    await page.addInitScript(() => localStorage.removeItem('fds_instalar_cerrado'))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta([]) }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const aviso = page.getByRole('status').filter({ hasText: 'Instala la app' })
    await expect(aviso).toBeVisible()
    // Lo que se ve: la frase y «Instalar», y nada más (antes, «Instala la app» + «Instalar la app»).
    expect((await aviso.innerText()).replace(/\s+/g, ' ').trim()).toBe('Instala la app Instalar')
    await expect(aviso.getByText('Instalar la app')).toHaveCount(0)
    // Para el lector de pantalla el botón sigue llamándose «Instalar la app» (el texto visible va dentro del nombre, WCAG 2.5.3).
    const boton = aviso.getByRole('button', { name: 'Instalar la app', exact: true })
    await expect(boton).toBeVisible()
    await expect(boton).toHaveText('Instalar')
  })
})

test('Compacto · el nombre de las paradas de dos cifras queda alineado con el de las de una', async ({ page, context }) => {
  await preparar(page, context)
  await page.setViewportSize({ width: 360, height: 780 })
  const pedidos = Array.from({ length: 12 }, (_, i) => pendiente(i + 1))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: ruta(pedidos) }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const medir = async (n) => {
    const fila = page.locator(`#parada-p${n}`)
    await fila.scrollIntoViewIfNeeded()
    return fila.evaluate((el, nombre) => {
      const texto = [...el.querySelectorAll('span.truncate')].find((s) => s.textContent.trim() === nombre)
      const pildora = el.querySelector('span.rounded-full')
      return { nombre: texto.getBoundingClientRect().left, ancho: pildora.getBoundingClientRect().width }
    }, `Cliente ${n}`)
  }
  const una = await medir(9)
  const dos = await medir(10)
  const mas = await medir(12)
  expect(una.ancho, 'la píldora del 9 mide 32').toBeCloseTo(32, 0)
  expect(dos.ancho, `la píldora del 10 mide ${dos.ancho} (32 si caben las dos cifras)`).toBeCloseTo(32, 0)
  expect(Math.abs(dos.nombre - una.nombre), `el nombre de la fila 10 está en ${dos.nombre} y el de la 9 en ${una.nombre}`).toBeLessThanOrEqual(0.5)
  expect(Math.abs(mas.nombre - una.nombre)).toBeLessThanOrEqual(0.5)
})
