import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA PÁGINA DE VENTA PARA EMPRESAS (/empresas, 14-11-2026).
   Lo que no puede fallar en una página a la que se manda a un dueño de flota por correo o por teléfono: que cargue,
   que en un móvil se vea el titular y el botón sin deslizar y sin desplazarse de lado, que los dos botones de arriba
   lleven a su sitio, que el formulario de la demostración se envíe UNA vez con lo que la Bandeja necesita (y diga
   «recibido» o el error), que se midan los pasos (`emp_*`), que la cuenta dé el MISMO precio que /planes y que en
   inglés no quede ni una palabra en español. La API va simulada (api-simulada.js); el formulario y la analítica, con
   su propia ruta. */

const RECIBIDO = '¡Recibido! Te respondemos en menos de 24 horas hábiles.'

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
    // Ni la página ni ningún trozo se sale por la derecha (después de que todo haya pintado).
    await page.waitForTimeout(500)
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(ancho).toBeLessThanOrEqual(375)
    // Y desplazándose hasta abajo tampoco (lo de abajo se pinta al llegar).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
  })

  test('«Probar gratis 14 días» lleva al alta de empresa y se mide qué botón fue', async ({ page }) => {
    const { acciones } = await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    const boton = page.getByTestId('emp-probar')
    await expect(boton).toHaveText(/Probar gratis 14 días/)
    await expect(boton).toHaveAttribute('href', '/registro')
    await boton.click()
    await expect(page).toHaveURL(/\/registro$/)
    await expect.poll(acciones).toContain('emp_probar_arriba')
  })

  test('«Que me la enseñen en 15 minutos» baja al formulario', async ({ page }) => {
    const { acciones } = await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('emp-ensenar').click()
    await expect(page).toHaveURL(/\/empresas#demo$/)
    await expect(page.getByLabel('Tu nombre')).toBeInViewport()
    await expect.poll(acciones).toContain('emp_demo_boton')
  })

  test('el formulario valida, envía UNA vez con el cuerpo correcto y enseña el recibido', async ({ page }) => {
    const { leads, acciones } = await preparar(page)
    await page.goto('/empresas#demo', { waitUntil: 'domcontentloaded' })
    const enviar = page.getByRole('button', { name: 'Pedir la demostración' })

    // Vacío: no se manda nada y dice qué falta.
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Pon tu nombre.')
    await page.getByLabel('Tu nombre').fill('Marta Gil')
    await page.getByLabel('Empresa', { exact: true }).fill('Mensajería Norte')
    await page.getByLabel('Correo').fill('marta@ejemplo')
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Pon un correo válido.')
    await page.getByLabel('Correo').fill('marta@ejemplo.com')
    await enviar.click()
    await expect(page.getByRole('alert')).toHaveText('Elige cuántas furgonetas tienes.')
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

  test('se miden la demo del panel, los precios y los 10 s en la página', async ({ page }) => {
    await page.clock.install()
    const { acciones } = await preparar(page)
    await page.route('**/api/auth/demo-login', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.clock.fastForward(10_500)
    await expect.poll(acciones).toContain('emp_10s')
    await page.getByRole('button', { name: 'Ver la demo del panel' }).click()
    await expect(page.getByText('La demo no responde ahora mismo.', { exact: false })).toBeVisible()
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
      await page.getByRole('radio', { name: new RegExp(`^Plan ${plan}`) }).click()
      for (const n of [5, 10, 25, 60]) {
        await furgonetas.fill(String(n))
        await expect(precio).toHaveAttribute('data-precio', String(esperado[n][plan]))
      }
    }
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

  test('en inglés: el titular en inglés y ni una palabra en español', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
    await preparar(page)
    await page.goto('/empresas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stop paying for damage you didn’t cause')
    await expect(page).toHaveTitle(/for van fleets/)
    // Todo a la vista: las respuestas, la cuenta con su segunda línea y los avisos del formulario.
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
    await page.getByLabel('How much was the last damage charge you got hit with?').fill('1500')
    await page.getByRole('button', { name: 'Book the demo' }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter your name.')
    const texto = await page.evaluate(() => {
      const copia = document.body.cloneNode(true)
      copia.querySelectorAll('select, script, style').forEach((n) => n.remove())
      return copia.innerText
    })
    // Palabras que solo dice el español, y cualquier palabra en minúscula con acento o eñe (los nombres propios —el
    // titular del aviso legal, los conductores de ejemplo del panel— empiezan por mayúscula y no cuentan).
    const palabras = texto.match(/\b(el|la|los|las|del|de|y|en|es|un|una|al|se|lo|su|sus|para|con|que|por|sin|tus?|cada|furgonetas?|empresas?|precios?|cuenta|gratis|golpes?|mes|meses|dias|revision)\b/gi) || []
    const acentos = texto.match(/(?<![\p{L}])\p{Ll}*[áéíóúñ]\p{Ll}*|[¿¡]/gu) || []
    const espanol = [...new Set([...palabras, ...acentos])]
    expect(espanol, `queda español: ${espanol.join(', ')}`).toEqual([])
    expect(texto).toContain('Get a 15-minute demo')
    expect(texto).toContain('costs you')
  })
})
