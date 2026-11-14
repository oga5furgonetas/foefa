import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA PÁGINA DE VENTA PARA EMPRESAS (/empresas, 14-11-2026).
   Lo que no puede fallar en una página a la que se manda a un dueño de flota por correo o por teléfono: que cargue,
   que en un móvil se vea el titular y el botón sin deslizar y sin desplazarse de lado, que los botones lleven a su
   sitio (el alta de FLOTA, no el selector de sectores), que el formulario de la demostración se envíe UNA vez con lo
   que la Bandeja necesita (y diga «recibido», con el foco en él, o el error, con el foco en el campo), que se midan
   los pasos (`emp_*`), que la cuenta dé el MISMO precio que /planes (y no invente uno por encima del tope) y que en
   inglés no quede ni una palabra en español. La API va simulada (api-simulada.js); el formulario y la analítica, con
   su propia ruta. Ronda 2 (14-11-2026): el alta, el foco, la calculadora por encima del tope, las etiquetas de la
   rejilla, la captura real, la cabecera fija y el inglés con mayúsculas y con el formulario enviado. */

const RECIBIDO = '¡Recibido! Te respondemos en menos de 24 horas hábiles.'
// El alta a la que llevan los tres «Probar gratis»: la de flota (sector «Otra flota», plan Pro).
const ALTA = '/registro?sector=otra&plan=completo'

/* La API simulada y, encima, lo que estas pruebas miran: los eventos de analítica y el formulario. */
async function preparar(page, { lead } = {}) {
  const eventos = []
  const leads = []
  await simularApi(page, 'vacio')
  await page.route('**/api/analitica/evento', async (route) => {
    try { eventos.push(JSON.parse(route.request().postData() || '{}')) } catch { /* nada */ }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  await page.route('**/api/auth/lead', async (route) => {
    leads.push(JSON.parse(route.request().postData() || '{}'))
    if (lead) return lead(route)
    await new Promise((r) => setTimeout(r, 400))   // que dé tiempo a un segundo toque mientras «envía»
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mensaje: RECIBIDO }) })
  })
  const acciones = () => eventos.filter((e) => e.tipo === 'accion').map((e) => e.nombre)
  return { eventos, leads, acciones }
}

function vigilarErrores(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(t)
  })
  page.on('pageerror', (e) => fallos.push(String(e)))
  return fallos
}

/* Rellena el formulario de la demostración con lo mínimo que vale. */
async function rellenar(page, { nombre = 'Your name', empresa = 'Company', correo = 'Email', flota = '¿Cuántas furgonetas?' } = {}) {
  await page.getByLabel(nombre).fill('Marta Gil')
  await page.getByLabel(empresa, { exact: true }).fill('Mensajería Norte')
  await page.getByLabel(correo).fill('marta@ejemplo.com')
  await page.getByLabel(flota).selectOption('10-29')
}

test.describe('/empresas', () => {
  test('carga sin errores y se mide la vista', async ({ page }) => {
    const fallos = vigilarErrores(page)
    const { eventos } = await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deja de pagar golpes que no son tuyos')
    await expect(page).toHaveTitle(/para empresas con furgonetas/)
    await expect.poll(() => eventos.some((e) => e.tipo === 'vista' && e.ruta === '/empresas')).toBe(true)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('en un móvil de 375 px: sin desplazamiento lateral y el titular y el botón se ven sin deslizar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const h1 = page.getByRole('heading', { level: 1 })
    const boton = page.getByTestId('emp-probar')
    await expect(h1).toBeVisible()
    await expect(boton).toBeVisible()
    for (const el of [h1, boton]) {
      const caja = await el.boundingBox()
      expect(caja.y).toBeGreaterThanOrEqual(0)
      expect(caja.y + caja.height, 'tiene que verse sin deslizar').toBeLessThanOrEqual(812)
      expect(caja.x + caja.width).toBeLessThanOrEqual(375)
    }
    // Ni la página ni ningún trozo se sale por la derecha (después de que todo haya pintado). Con overflow-x-clip (no
    // hidden) en el contenedor: los halos se recortan igual.
    await page.waitForTimeout(500)
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(ancho).toBeLessThanOrEqual(375)
    // Y desplazándose hasta abajo tampoco (lo de abajo se pinta al llegar).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
    // Intentar desplazarse de lado no mueve nada.
    await page.evaluate(() => window.scrollTo(200, window.scrollY))
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
  })

  test('la cabecera se queda arriba al deslizar (sticky de verdad)', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const cabecera = page.getByTestId('emp-cabecera')
    await expect(cabecera).toBeVisible()
    for (const y of [1500, 4000]) {
      await page.evaluate((v) => window.scrollTo(0, v), y)
      await page.waitForTimeout(150)
      expect(await page.evaluate(() => window.scrollY), 'la página tiene que haberse desplazado').toBeGreaterThan(1000)
      const caja = await cabecera.boundingBox()
      expect(Math.round(caja.y), `a ${y} px la cabecera sigue arriba`).toBe(0)
      await expect(page.getByTestId('emp-probar-menu')).toBeInViewport()
    }
  })

  test('los tres «Probar gratis» llevan al alta de FLOTA, con las furgonetas de la calculadora', async ({ page }) => {
    const { acciones } = await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const botones = [page.getByTestId('emp-probar-menu'), page.getByTestId('emp-probar'), page.getByTestId('emp-probar-cierre')]
    // La calculadora empieza en 20 furgonetas: el alta se las lleva.
    for (const b of botones) await expect(b).toHaveAttribute('href', `${ALTA}&flota=20`)
    const furgonetas = page.getByLabel('¿Cuántas furgonetas tienes?')
    await furgonetas.fill('35')
    for (const b of botones) await expect(b).toHaveAttribute('href', `${ALTA}&flota=35`)
    // Sin un número válido (vacío o por encima del tope), sin `flota`.
    for (const v of ['', '0', '9000']) {
      await furgonetas.fill(v)
      for (const b of botones) await expect(b).toHaveAttribute('href', ALTA)
    }
    await furgonetas.fill('35')
    const boton = page.getByTestId('emp-probar')
    await expect(boton).toHaveText(/Probar gratis 14 días/)
    await boton.click()
    await expect(page).toHaveURL(/\/registro\?sector=otra&plan=completo&flota=35$/)
    await expect.poll(acciones).toContain('emp_probar_arriba')
    // Sale el formulario de la cuenta de empresa con el plan Pro ya elegido: ni el selector de sector ni el de plan.
    await expect(page.getByText('Plan elegido')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear cuenta con plan Pro' })).toBeVisible()
    await expect(page.getByText('315€/mes')).toBeVisible()          // 35 furgonetas × 9 € (Pro, sin descuento)
    await expect(page.getByText('14 días gratis · sin tarjeta · cancela cuando quieras')).toBeVisible()
    await expect(page.getByText(/¿Qué vas a hacer con/)).toHaveCount(0)
    await expect(page.getByText('Mensajería y paquetería')).toHaveCount(0)
  })

  test('«Que me la enseñen en 15 minutos» baja al formulario', async ({ page }) => {
    const { acciones } = await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('emp-ensenar').click()
    await expect(page).toHaveURL(/\/empresas#demo$/)
    await expect(page.getByLabel('Tu nombre')).toBeInViewport()
    await expect.poll(acciones).toContain('emp_demo_boton')
  })

  test('el formulario valida (foco y aria-invalid en el primer campo que falla) y envía UNA vez con el cuerpo correcto', async ({ page }) => {
    const { leads, acciones } = await preparar(page)
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    const enviar = page.getByRole('button', { name: 'Pedir la demostración' })

    // Vacío: no se manda nada, dice qué falta y lleva el foco al campo.
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Pon tu nombre.')
    await expect(page.getByLabel('Tu nombre')).toBeFocused()
    await expect(page.getByLabel('Tu nombre')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Tu nombre')).toHaveAttribute('aria-describedby', 'emp-falta')
    await page.getByLabel('Tu nombre').fill('Marta Gil')
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Pon el nombre de tu empresa.')
    await expect(page.getByLabel('Empresa', { exact: true })).toBeFocused()
    await expect(page.getByLabel('Tu nombre')).not.toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Empresa', { exact: true }).fill('Mensajería Norte')
    await page.getByLabel('Correo').fill('marta@ejemplo')
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Pon un correo válido.')
    await expect(page.getByLabel('Correo')).toBeFocused()
    await expect(page.getByLabel('Correo')).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Correo').fill('marta@ejemplo.com')
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Elige cuántas furgonetas tienes.')
    await expect(page.getByLabel('¿Cuántas furgonetas?')).toBeFocused()
    expect(leads).toHaveLength(0)

    await page.getByLabel('¿Cuántas furgonetas?').selectOption('10-29')
    await page.getByLabel('Teléfono (opcional)').fill('600 111 222')
    await page.getByLabel('Mensaje (opcional)').fill('Tenemos 14 de renting')
    // Dos toques seguidos: un solo envío.
    await enviar.dblclick()
    await expect(page.getByTestId('emp-recibido')).toHaveText(RECIBIDO)
    expect(leads).toHaveLength(1)
    const c = leads[0]
    expect(c.name).toBe('Marta Gil')
    expect(c.company).toBe('Mensajería Norte')
    expect(c.email).toBe('marta@ejemplo.com')
    expect(c.plan.startsWith('DEMO EMPRESAS')).toBe(true)
    expect(c.plan).toContain('furgonetas: 10-29')
    expect(c.plan).toContain('tel: 600 111 222')
    expect(c.plan).toContain('mensaje: Tenemos 14 de renting')
    await expect.poll(acciones).toEqual(expect.arrayContaining(['emp_form_abrir', 'emp_form_enviar', 'emp_form_ok']))
    expect(acciones().filter((a) => a === 'emp_form_enviar')).toHaveLength(1)
  })

  test('tras enviar: el recibido se ve y tiene el foco, y el cierre ya no vuelve a pedir la demo', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('emp-ensenar-cierre')).toHaveCount(1)
    await rellenar(page, { nombre: 'Tu nombre', empresa: 'Empresa', correo: 'Correo' })
    await page.getByRole('button', { name: 'Pedir la demostración' }).click()
    const recibido = page.getByTestId('emp-recibido')
    await expect(recibido).toHaveText(RECIBIDO)
    await expect(recibido).toBeFocused()
    await expect(recibido).toBeInViewport({ ratio: 1 })
    await expect(page.getByTestId('emp-ensenar-cierre')).toHaveCount(0)
    await expect(page.getByTestId('emp-probar-cierre')).toHaveCount(1)
  })

  test('si el servidor dice que no, se enseña SU mensaje; sin red, uno claro; y se puede reintentar', async ({ page }) => {
    let vez = 0
    const { leads, acciones } = await preparar(page, {
      lead: (route) => (++vez === 1
        ? route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ detail: 'Has enviado muchos mensajes en poco tiempo. Espera un minuto.' }) })
        : route.abort('internetdisconnected')),
    })
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Tu nombre').fill('Marta Gil')
    await page.getByLabel('Empresa', { exact: true }).fill('Mensajería Norte')
    await page.getByLabel('Correo').fill('marta@ejemplo.com')
    await page.getByLabel('¿Cuántas furgonetas?').selectOption('100+')
    const enviar = page.getByRole('button', { name: 'Pedir la demostración' })
    await enviar.click()
    await expect(page.getByTestId('emp-error')).toHaveText('Has enviado muchos mensajes en poco tiempo. Espera un minuto.')
    await expect(enviar).toBeEnabled()
    await enviar.click()
    await expect(page.getByTestId('emp-error')).toHaveText('No se ha podido enviar: parece que no hay conexión. Inténtalo otra vez.')
    expect(leads).toHaveLength(2)
    expect(leads[0].plan).toContain('furgonetas: 100+')
    await expect.poll(() => acciones().filter((a) => a === 'emp_form_error').length).toBe(2)
    await expect(page.getByTestId('emp-recibido')).toHaveCount(0)
  })

  test('se miden la demo del panel, los precios y los 10 s en la página; la demo caída no promete tiempos', async ({ page }) => {
    await page.clock.install()
    const { acciones } = await preparar(page)
    await page.route('**/api/auth/demo-login', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.clock.fastForward(10_500)
    await expect.poll(acciones).toContain('emp_10s')
    await page.getByRole('button', { name: 'Ver la demo del panel' }).click()
    const aviso = page.getByText('La demo no responde ahora mismo. Puedes crear la cuenta o pedir que te la enseñemos.', { exact: false })
    await expect(aviso).toBeVisible()
    await expect(page.getByText('son dos minutos', { exact: false })).toHaveCount(0)
    await expect(page.locator('p[role="status"] a[href="#demo"]')).toHaveText('Pedir la demostración')
    await expect.poll(acciones).toContain('emp_demo_panel')
    await page.getByRole('link', { name: 'Ver precios' }).click()
    await expect(page).toHaveURL(/\/planes$/)
    await expect.poll(acciones).toContain('emp_precios_arriba')
  })

  /* El precio de /planes para N vehículos en un plan, leído de su tarjeta («180€» → 180). */
  async function precioEnPlanes(page, n, nombre) {
    await page.getByLabel('Número de vehículos').fill(String(n))
    const texto = await page.evaluate((nom) => {
      const titulo = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === nom)
      const tarjeta = titulo.parentElement.parentElement
      return [...tarjeta.querySelectorAll('span')].find((s) => /€$/.test(s.textContent.trim())).textContent
    }, nombre)
    return Number(texto.replace(/[^\d,]/g, '').replace(',', '.'))
  }

  test('«Haz la cuenta» da el mismo precio que /planes para 5, 10, 25 y 60 furgonetas', async ({ page }) => {
    const { acciones } = await preparar(page)
    const esperado = {}
    await page.goto('/planes', { waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('Número de vehículos')).toBeVisible()
    for (const n of [5, 10, 25, 60]) {
      esperado[n] = { Esencial: await precioEnPlanes(page, n, 'Esencial'), Pro: await precioEnPlanes(page, n, 'Pro') }
    }
    // Comprobación de cordura: los mínimos (10 y 20) y el descuento desde 50 están en juego.
    expect(esperado[5]).toEqual({ Esencial: 50, Pro: 180 })
    expect(esperado[60]).toEqual({ Esencial: 270, Pro: 486 })

    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const furgonetas = page.getByLabel('¿Cuántas furgonetas tienes?')
    const precio = page.getByTestId('emp-precio')
    for (const plan of ['Esencial', 'Pro']) {
      // Un conmutador de dos: botones con aria-pressed, no role=radio.
      const boton = page.getByRole('button', { name: new RegExp(`^Plan ${plan}`) })
      await boton.click()
      await expect(boton).toHaveAttribute('aria-pressed', 'true')
      for (const n of [5, 10, 25, 60]) {
        await furgonetas.fill(String(n))
        await expect(precio).toHaveAttribute('data-precio', String(esperado[n][plan]))
      }
    }
    await expect(page.getByRole('radio')).toHaveCount(0)
    // Con el cargo: los meses que paga (Pro, 25 furgonetas = 225 €; 1.500 € = 6 meses).
    await furgonetas.fill('25')
    await page.getByLabel('¿De cuánto fue el último cargo por daños que te pasaron?').fill('1500')
    await expect(page.getByTestId('emp-meses')).toHaveText('Con evitar un cargo así, tienes pagados 6 meses.')
    await expect(page.getByTestId('emp-resultado')).toContainText('al mes con el plan Pro.')
    // Sin el segundo dato, solo el precio.
    await page.getByLabel('¿De cuánto fue el último cargo por daños que te pasaron?').fill('')
    await expect(page.getByTestId('emp-meses')).toHaveCount(0)
    await expect.poll(() => acciones().filter((a) => a === 'emp_calculadora').length).toBe(1)
  })

  test('la calculadora por encima del tope dice «a medida», redondea lo escrito y pone separador de miles', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const furgonetas = page.getByLabel('¿Cuántas furgonetas tienes?')
    const cargo = page.getByLabel('¿De cuánto fue el último cargo por daños que te pasaron?')
    // Por encima de 5.000: ningún precio, «a medida» y el enlace a la demostración.
    await furgonetas.fill('100000')
    await expect(page.getByTestId('emp-a-medida')).toContainText('Para más de 5.000 vehículos, el plan Empresa es a medida.')
    await expect(page.getByTestId('emp-a-medida').getByRole('link', { name: 'Cuéntanos tu flota' })).toHaveAttribute('href', '#demo')
    await expect(page.getByTestId('emp-precio')).toHaveCount(0)
    // El número que se ve es el entero con el que se calcula (al salir del campo).
    await furgonetas.fill('25.7')
    await furgonetas.blur()
    await expect(furgonetas).toHaveValue('25')
    await expect(page.getByTestId('emp-precio')).toHaveAttribute('data-precio', '225')
    // Separador de miles (Pro, 600 furgonetas: 600 × 9 € − 20 % = 4.320 €).
    await furgonetas.fill('600')
    await expect(page.getByTestId('emp-precio')).toHaveText('4.320 €')
    // Meses con separador y, por encima de 120, «más de 10 años».
    await furgonetas.fill('20')                                     // Pro, 20 furgonetas = 180 €
    await cargo.fill('20000')
    await expect(page.getByTestId('emp-meses')).toHaveText('Con evitar un cargo así, tienes pagados 111 meses.')
    await cargo.fill('99999999')
    await expect(page.getByTestId('emp-meses')).toHaveText('Con evitar un cargo así, tienes pagados más de 10 años.')
  })

  test('la rejilla se titula «Las pantallas del panel» y marca lo que es de Pro, a petición o complemento', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Las pantallas del panel', { exact: true })).toBeVisible()
    await expect(page.getByText('Todo lo que lleva', { exact: true })).toHaveCount(0)
    const modulo = (t) => page.getByTestId('emp-modulo').filter({ has: page.getByRole('heading', { name: t, exact: true }) })
    await expect(modulo('Cuadrante y días libres')).toContainText('Plan Pro')
    await expect(modulo('Cuadrante y días libres')).toContainText('Se activa a petición')
    await expect(modulo('Asignación del día y equipo')).toContainText('Plan Pro')
    await expect(modulo('Reparto a domicilio')).toContainText('Complemento')
    for (const t of ['Revisiones con foto e IA', 'Taller y estado de la flota', 'Vencimientos']) {
      await expect(modulo(t)).not.toContainText('Plan Pro')
      await expect(modulo(t)).not.toContainText('Complemento')
    }
    await expect(modulo('Revisiones con foto e IA')).toContainText('la IA marca los golpes que parecen nuevos')
  })

  test('la captura real del panel carga, con su texto alternativo y su pie', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const img = page.getByTestId('emp-captura')
    await expect(img).toHaveAttribute('loading', 'lazy')
    await expect(img).toHaveAttribute('alt', /golpe marcado en la puerta lateral/)
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
    await expect(page.getByText('Pantalla real del panel, con datos de ejemplo.')).toBeVisible()
  })

  /* Palabras que solo dice el español: en minúscula, cualquiera con acento o eñe; con mayúscula, las que pasarían sin
     traducir en esta página (nombres de planes, de pantallas, del formulario…). Los nombres propios (el titular del
     aviso legal, los conductores de ejemplo) no cuentan. */
  function espanolEn(texto) {
    const palabras = texto.match(/\b(el|la|los|las|del|de|y|en|es|un|una|al|se|lo|su|sus|para|con|que|por|sin|tus?|cada|furgonetas?|empresas?|precios?|cuenta|gratis|golpes?|mes|meses|dias|revision)\b/gi) || []
    const mayusculas = texto.match(/\b(Esencial|Empresa|Inspecciones|Elige|Zona|Precios|Entrar|Probar|Correo|Mensaje|Vencimientos|Cuadrante|Taller|Complemento|Pantalla|Revisión|Revisiones|Origen|Informe|Plan Pro|Demostración)\b/g) || []
    const acentos = texto.match(/(?<![\p{L}])\p{Ll}*[áéíóúñ]\p{Ll}*|[¿¡]/gu) || []
    return [...new Set([...palabras, ...mayusculas, ...acentos])]
  }
  // El texto de la página sin el selector de idioma del pie (que nombra «Español»); los demás desplegables, sí.
  const textoSinIdioma = (page) => page.evaluate(() => {
    const copia = document.body.cloneNode(true)
    copia.querySelectorAll('#ld-idioma, script, style').forEach((n) => n.remove())
    // innerText de un nodo suelto no lleva las opciones de un <select>: se añaden a mano.
    const opciones = [...document.querySelectorAll('select:not(#ld-idioma) option')].map((o) => o.textContent).join('\n')
    return `${copia.innerText}\n${opciones}`
  })

  test('en inglés: el titular en inglés y ni una palabra en español', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stop paying for damage you didn’t cause')
    await expect(page).toHaveTitle(/for van fleets/)
    // Todo a la vista: las respuestas, la cuenta con su segunda línea y los avisos del formulario.
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
    await page.getByLabel('How much was your last damage bill?').fill('1500')
    await page.getByRole('button', { name: 'Book the demo' }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter your name.')
    const texto = await textoSinIdioma(page)
    const espanol = espanolEn(texto)
    expect(espanol, `queda español: ${espanol.join(', ')}`).toEqual([])
    expect(texto).toContain('Get a 15-minute demo')
    expect(texto).toContain('costs you')
    expect(texto).toContain('Choose')
    expect(texto).toContain('100 or more')
    expect(texto).toContain('Due dates')
    await expect(page.getByTestId('emp-captura')).toHaveAttribute('src', '/empresas/inspeccion-golpe-en.jpg')
    // Por encima del tope, también en inglés.
    await page.getByLabel('How many vans do you run?').fill('9000')
    await expect(page.getByTestId('emp-a-medida')).toHaveText(/^For more than 5,000 vehicles, the .+ plan is custom-priced\. Tell us about your fleet$/)
  })

  test('en inglés: el formulario enviado dice el recibido en inglés, sin español', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
    const { leads } = await preparar(page)
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    await rellenar(page, { flota: 'How many vans?' })
    await page.getByRole('button', { name: 'Book the demo' }).click()
    const recibido = page.getByTestId('emp-recibido')
    await expect(recibido).toHaveText('Got it! We’ll reply within one working day.')
    await expect(recibido).toBeFocused()
    expect(leads).toHaveLength(1)
    expect(leads[0].plan).toContain('idioma: en')
    const espanol = espanolEn(await textoSinIdioma(page))
    expect(espanol, `queda español: ${espanol.join(', ')}`).toEqual([])
  })
})
