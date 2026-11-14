import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

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
async function rellenar(page, { nombre = 'Your name', empresa = 'Your company', correo = 'Email', flota = '¿Cuántas furgonetas?' } = {}) {
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
    await expect(page.getByLabel('Tu empresa', { exact: true })).toBeFocused()
    await expect(page.getByLabel('Tu nombre')).not.toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Tu empresa', { exact: true }).fill('Mensajería Norte')
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
    await rellenar(page, { nombre: 'Tu nombre', empresa: 'Tu empresa', correo: 'Correo' })
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
    await page.getByLabel('Tu empresa', { exact: true }).fill('Mensajería Norte')
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
    // Ronda 3 (M3): la foto de la demo no tiene golpe; el pie lo dice sin trampa.
    await expect(page.getByText('Pantalla real del panel. La foto y el golpe marcado son de ejemplo.')).toBeVisible()
    await expect(page.getByText('Pantalla real del panel, con datos de ejemplo.')).toHaveCount(0)
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

  /* ── Ronda 3 (14-11-2026): lo que encontró la revisión final (V9, V11, V12, M8, M9, M10) ── */

  test('ronda 3: el aviso del formulario sale junto al campo que falla y se ve en el móvil (M8)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await preparar(page)
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Pedir la demostración' }).click()
    const aviso = page.getByRole('alert')
    await expect(aviso).toHaveText('Pon tu nombre.')
    await expect(page.getByLabel('Tu nombre')).toBeFocused()
    await expect(aviso).toBeInViewport({ ratio: 1 })
    await expect(page.getByLabel('Tu nombre')).toBeInViewport()
    // Justo debajo del campo, no al pie del formulario.
    const campo = await page.getByLabel('Tu nombre').boundingBox()
    const caja = await aviso.boundingBox()
    expect(caja.y).toBeGreaterThanOrEqual(campo.y + campo.height - 1)
    expect(caja.y - (campo.y + campo.height), 'el aviso va pegado al campo').toBeLessThan(30)
    // El siguiente que falla, igual (el correo).
    await page.getByLabel('Tu nombre').fill('Marta Gil')
    await page.getByLabel('Tu empresa', { exact: true }).fill('Mensajería Norte')
    await page.getByLabel('Correo').fill('marta@')
    await page.getByRole('button', { name: 'Pedir la demostración' }).click()
    await expect(aviso).toHaveText('Pon un correo válido.')
    await expect(aviso).toBeInViewport({ ratio: 1 })
    const correo = await page.getByLabel('Correo').boundingBox()
    const caja2 = await aviso.boundingBox()
    expect(caja2.y - (correo.y + correo.height)).toBeLessThan(30)
    await expect(page.getByRole('alert')).toHaveCount(1)
  })

  test('ronda 3: desde 100 furgonetas recuerda el plan Empresa, a medida, sin quitar el precio (M9)', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const furgonetas = page.getByLabel('¿Cuántas furgonetas tienes?')
    const linea = page.getByTestId('emp-plan-a-medida')
    await furgonetas.fill('99')
    await expect(page.getByTestId('emp-precio')).toBeVisible()
    await expect(linea).toHaveCount(0)
    await furgonetas.fill('100')
    await expect(linea).toContainText('Con 100 vehículos o más también tienes el plan Empresa, a medida.')
    await expect(linea.getByRole('link', { name: 'Cuéntanos tu flota' })).toHaveAttribute('href', '#demo')
    await expect(page.getByTestId('emp-precio')).toBeVisible()                 // el precio de Pro sigue ahí
    await furgonetas.fill('300')
    await expect(linea).toBeVisible()
    await expect(page.getByTestId('emp-precio')).toBeVisible()
  })

  test('ronda 3: «Plan Pro» solo en la asignación del día, no en las fichas ni en el portal (V12)', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const modulo = page.getByTestId('emp-modulo').filter({ has: page.getByRole('heading', { name: 'Asignación del día y equipo', exact: true }) })
    const soloPro = modulo.getByTestId('emp-modulo-pro')
    await expect(soloPro).toHaveText('Plan ProQuién lleva cada furgoneta hoy.')
    await expect(modulo.getByText('Las fichas de tu gente y el portal de cada conductor en su móvil.')).toBeVisible()
    // Una sola etiqueta en la casilla: la de la frase de la asignación.
    await expect(modulo.getByText('Plan Pro', { exact: true })).toHaveCount(1)
    await expect(modulo.getByText('Las fichas de tu gente y el portal de cada conductor en su móvil.')).not.toContainText('Plan Pro')
  })

  test('ronda 3: la maqueta dice «sin revisar hoy» y el paso 3, que cada conductor hace una por furgoneta y día (M10, V11)', async ({ page }) => {
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('sin revisar hoy', { exact: true })).toHaveCount(2)      // el visible y el de los lectores de pantalla
    await expect(page.getByText('salen sin revisar', { exact: false })).toHaveCount(0)
    await expect(page.getByText('A qué hora se hace la revisión lo decide cada empresa (cada conductor hace una por furgoneta y día).', { exact: false })).toBeVisible()
    await expect(page.getByText('Cuándo se hace la revisión lo decide cada empresa', { exact: false })).toHaveCount(0)
  })

  test('ronda 3: el inglés de la lista del revisor (V9): MOT, dashboard, Enterprise, «checked» y por vehículo', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
    await page.getByLabel('How much was your last damage bill?').fill('1500')
    const texto = await textoSinIdioma(page)
    for (const frase of ['The dent nobody owns up to', 'The missed MOT', 'When the van goes back, a damage list follows: if you can’t prove when each mark appeared, you pay.',
      'Try the demo dashboard', 'Dashboard view · sample data', 'of the fleet checked today', 'not checked today',
      'Pay yearly: 12 months for the price of 10.', 'Avoid just one bill like that and it covers', 'the Enterprise plan, priced to suit',
      'The MOT list for the whole fleet', '/vehicle', 'Your company',
      'What time the check happens is up to each company (each driver does one per van per day).']) {
      expect(texto, frase).toContain(frase)
    }
    for (const mal of ['MOT/inspection', 'nobody caused', 'panel demo', 'Panel view', 'inspected', '/van', 'Company plan', 'Hand it back']) {
      expect(texto, mal).not.toContain(mal)
    }
    await page.getByLabel('How many vans do you run?').fill('150')
    await expect(page.getByTestId('emp-plan-a-medida')).toContainText('With 100 or more vehicles there’s also the Enterprise plan, priced to suit.')
    await page.getByLabel('How many vans do you run?').fill('9000')
    await expect(page.getByTestId('emp-a-medida')).toContainText('For more than 5,000 vehicles, the Enterprise plan is custom-priced.')
    await expect(page.getByText('A real dashboard screen. The photo and the marked dent are examples.')).toBeVisible()
  })
})

/* /peritaje-tecnico, «Cómo funciona la IA de daños» (a donde lleva el pie de /empresas). Ronda 3 (V1): sin lo que
   /empresas niega ni lo que el servidor no hace. */
test.describe('/peritaje-tecnico', () => {
  const PROHIBIDAS = ['Sin discusión', 'quién golpeó', 'al salir y al volver', 'al salir y volver', '90 segundos', '800', '3.000',
    'Imposible falsificar', 'inmutable', '3 veces', 'Acceso anticipado', 'Tu peritaje siempre llega', 'no manipulable', 'imagen manipulada', 'Confidence scoring',
    // 14-11-2026 (r3, V1 y V2): el aviso de la foto antigua no salta nunca (el servidor guarda la foto sin EXIF) y el
    // conductor no firma desde el portal (su tarjeta lee `id` y la subida contesta `inspection_id`).
    'más de un día antes', 'Al acabar puede firmarla', 'la declaración que aceptó']

  for (const [nombre, ancho, alto] of [['ordenador', 1280, 900], ['móvil', 375, 812]]) {
    test(`dice solo lo que hace el servidor y se lee en ${nombre}`, async ({ page }) => {
      const fallos = vigilarErrores(page)
      await page.setViewportSize({ width: ancho, height: alto })
      await simularApi(page, 'vacio')
      await page.goto('/peritaje-tecnico', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cómo funciona la IA de daños')
      const texto = await page.locator('body').innerText()
      for (const p of PROHIBIDAS) expect(texto, `no puede decir «${p}»`).not.toContain(p)
      for (const p of ['No dice quién dio el golpe', 'cada conductor hace una revisión por furgoneta y día', 'No es una firma electrónica avanzada',
        'Va en el plan Pro', 'las direcciones de sus fotos', 'La IA se equivoca a veces',
        'Con el plan Pro, la oficina la firma después desde el panel.', 'Con el plan Pro: las fotos y los golpes marcados',
        'avisa si su primera foto es casi igual a la de otra revisión de esa furgoneta de los últimos 30 días o si la matrícula que lee la IA no es la suya.']) {
        expect(texto, `tiene que decir «${p}»`).toContain(p)
      }
      await expect(page.getByRole('link', { name: 'Probar gratis 14 días' })).toHaveAttribute('href', '/registro?sector=otra&plan=completo')
      await expect(page.getByRole('link', { name: /Hacer la cuenta/ })).toHaveAttribute('href', '/empresas#cuenta')
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho)
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })
  }

  test('el pie de /empresas lleva a ella', async ({ page }) => {
    await simularApi(page, 'vacio')
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Cómo funciona la IA de daños' }).click()
    await expect(page).toHaveURL(/\/peritaje-tecnico$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cómo funciona la IA de daños')
  })
})

/* La política de privacidad (V5): los formularios se conservan hasta que pidas su supresión; nada promete un borrado que
   no existe. Y la pestaña del detalle de una revisión (V2/M4) dice quién la llevaba, no quién dio el golpe. */
test.describe('privacidad y la pestaña «¿Quién la llevaba?»', () => {
  test('la política, en español y en inglés, no promete borrar los formularios «cuando dejen de ser necesarios»', async ({ page }) => {
    await simularApi(page, 'vacio')
    await page.goto('/privacidad', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Formularios de contacto y de demostración:', { exact: false }).first()).toBeVisible()
    let texto = await page.locator('body').innerText()
    expect(texto).not.toContain('dejen de ser necesarios')
    expect(texto).toContain('Se conservan hasta que pidas su supresión, escribiendo a')
    expect(texto).toContain('Formularios de contacto y de demostración: hasta que pidas su supresión.')
    expect(texto).toContain('en el de demostración también el idioma de la página')

    await page.evaluate(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Contact and demo forms:', { exact: false }).first()).toBeVisible()
    texto = await page.locator('body').innerText()
    expect(texto).not.toContain('no longer needed')
    expect(texto).toContain('They are kept until you ask us to erase them, by writing to')
    expect(texto).toContain('Contact and demo forms: until you ask us to erase them.')
  })

  test('la pestaña del detalle de una revisión se llama «¿Quién la llevaba?» en los 6 idiomas, sin «golpe» ni «hit»', async () => {
    const { DICT } = await import('../src/i18nDict.js')
    const p = DICT['insp.tab.who']
    expect(p.es).toBe('¿Quién la llevaba?')
    // r3 (14-11-2026): «quién la conducía» en los otros cinco (sonaban forzados); en italiano «lo» (furgone, veicolo).
    expect(p).toEqual({ es: '¿Quién la llevaba?', en: 'Who was driving?', fr: 'Qui la conduisait ?', de: 'Wer ist gefahren?',
      it: 'Chi lo guidava?', pt: 'Quem a conduzia?' })
    expect(Object.keys(p).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt'])
    for (const v of Object.values(p)) expect(v).not.toMatch(/golpe|hit|frapp|getroffen|colpit|bateu/i)
  })
})

/* EL AVISO DE TRAMPA DEL DETALLE DE UNA REVISIÓN (r3, V3, 14-11-2026). /peritaje-tecnico promete que el detalle «avisa»
   de la matrícula distinta o de la foto repetida, y con una sola señal (40 o 50 puntos, menos de 70) el bloque salía en
   verde, «Sin indicios de fraude», con el motivo debajo. Ahora cualquier motivo lo pone en ámbar; sin motivos sigue en
   verde, y la línea de debajo dice lo que se mira, no «EXIF correcto · pHash único · matrícula coincide». */
test.describe('el aviso de trampa del detalle de una revisión', () => {
  const PANEL = 'div.fixed.inset-0.z-40'
  const revision = (id, vehiculo, fraud_score, fraud_reasons) => ({
    id, vehicle_id: vehiculo, driver_id: 'd1', center: 'MADRID', photos: [], annotated_photos: [], notes: '',
    analysis_status: 'ok', created_at: new Date(Date.now() - 3600000).toISOString(), fraud_score, fraud_reasons,
    analysis: { severity: 'leve', total_damages_count: 0, total_estimated_cost: 0, damages: [], new_damages: [] },
  })
  const MATRICULA = { type: 'plate_mismatch', detail: "IA leyó '9999 ZZZ' pero el vehículo asignado es '1000 BCD'", weight: 40 }

  for (const [nombre, idioma, sinFraude, sospecha, limpio] of [
    ['español', 'es', 'Sin indicios de fraude', 'Indicios sospechosos', 'Sin avisos. Se mira si la primera foto repite'],
    ['inglés', 'en', 'No fraud signs', 'Suspicious signs', 'No warnings. It checks whether the first photo repeats'],
  ]) {
    test(`con un solo motivo (40/100) sale en ámbar; sin motivos, en verde y sin «EXIF correcto» (${nombre})`, async ({ page }) => {
      const conMotivo = revision('f1', 'v1', 40, [MATRICULA])
      const limpia = revision('f2', 'v2', 0, [])
      await entrarComoAdmin(page, { centros: ['MADRID'] })
      // El idioma del panel (flota_lang), DESPUÉS de entrarComoAdmin, que lo pone en español.
      if (idioma !== 'es') await page.addInitScript((l) => { try { localStorage.setItem('flota_lang', l) } catch { /* nada */ } }, idioma)
      await simularApi(page, 'vacio')
      await page.route(/\/api\/inspections(\?|$)/, (r) => r.fulfill({ json: [conMotivo, limpia] }))
      await page.route(/\/api\/inspections\/f\d$/, (r) => r.fulfill({ json: r.request().url().endsWith('f1') ? conMotivo : limpia }))
      await page.route(/\/api\/inspections\/f\d\/forensic$/, (r) => r.fulfill({ json: { signed: false } }))
      await page.route(/\/api\/vehicles(\?|$)/, (r) => r.fulfill({ json: [
        { id: 'v1', license_plate: '1000 BCD', center: 'MADRID', status: 'activo' },
        { id: 'v2', license_plate: '1001 BCD', center: 'MADRID', status: 'activo' },
      ] }))
      await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: [{ id: 'd1', name: 'Carlos Ruiz' }] }))
      await page.goto('/panel/inspecciones', { waitUntil: 'domcontentloaded' })

      // Con la matrícula distinta (40 puntos): ámbar, «Indicios sospechosos», y el motivo debajo.
      await page.getByRole('button', { name: /1000\s*BCD/ }).click({ timeout: 30_000 })
      const bloque = page.locator(`${PANEL} div.rounded-lg.border`, { hasText: '(40/100)' })
      await expect(bloque).toContainText(sospecha)
      await expect(bloque).not.toContainText(sinFraude)
      await expect(bloque).toHaveClass(/border-amber-500/)
      await expect(bloque).toContainText('9999 ZZZ')
      await expect(page.getByTestId('insp-fraude-limpio')).toHaveCount(0)
      await page.locator(`${PANEL} button.btn-ghost`).first().click()
      await expect(page.locator(PANEL)).toHaveCount(0)

      // Sin motivos (0 puntos): como antes, verde y «Sin indicios de fraude»; debajo, lo que se mira.
      await page.getByRole('button', { name: /1001\s*BCD/ }).click()
      const verde = page.locator(`${PANEL} div.rounded-lg.border`, { hasText: '(0/100)' })
      await expect(verde).toContainText(sinFraude)
      await expect(verde).toHaveClass(/border-emerald-500/)
      await expect(page.getByTestId('insp-fraude-limpio')).toContainText(limpio)
      await expect(page.locator(PANEL)).not.toContainText(/EXIF|pHash/)
    })
  }
})
