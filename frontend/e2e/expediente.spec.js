/* global process */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* EL EXPEDIENTE DEL VEHÍCULO (14-11-2026, «Antes del perito»): /panel/vehiculos/:id/expediente y su ejemplo público.
   La respuesta del servidor es `fixtures/expediente.json`, con la forma EXACTA de GET /vehicles/{id}/antes-del-perito
   (CONTRATO.md §C; al integrar la escribe el test del servidor). Los casos que ese fichero no trae (cada motivo de no
   atribución, sin golpes, los fallos) se hacen cambiando una copia de él, nunca inventando otra forma.
   Con FOTOS_EXPEDIENTE=<carpeta> guarda fotos de cada pantalla, en pantalla y en modo impresión, y el PDF del ejemplo. */

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', 'expediente.json'), 'utf8'))
const DEMO = path.join(AQUI, '..', 'public', 'demo')
const FOTOS = process.env.FOTOS_EXPEDIENTE || ''
const RUTA = '/panel/vehiculos/veh-5678/expediente'
const copia = () => JSON.parse(JSON.stringify(FIXTURE))

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js|status of (403|404|500)/i.test(t)) return
    fallos.push(t)
  })
  return fallos
}

// Las fotos del fichero (https://fotos.ejemplo/…) se sirven con las de la demo, para que las fotos de prueba se vean.
function fotoDemo(url) {
  if (url.includes('lateral_izq')) return url.includes('2026-11-12') ? 'van-lateral-golpe-puerta.jpg' : 'van-lateral.jpg'
  if (url.includes('trasera')) return 'van-lateral-golpe-paragolpes.jpg'
  if (url.includes('frontal')) return 'van-frontal.jpg'
  return 'van-lateral.jpg'
}

async function abrir(page, { datos = FIXTURE, estado = 200, billing = { org_name: 'Transportes Ruiz, S. L.' }, ruta = RUTA } = {}) {
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  const pedidas = []
  page.on('request', (r) => { if (r.url().includes('/api/')) pedidas.push(new URL(r.url()).pathname) })
  await page.route('**/api/org/billing', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(billing) }))
  await page.route('**/api/vehicles/*/antes-del-perito', (route) => route.fulfill({
    status: estado, contentType: 'application/json', body: JSON.stringify(datos) }))
  await page.route('https://fotos.ejemplo/**', (route) => route.fulfill({
    status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(DEMO, fotoDemo(route.request().url()))) }))
  await page.goto(ruta, { waitUntil: 'domcontentloaded' })
  return pedidas
}

async function foto(page, nombre, { entera = true } = {}) {
  if (!FOTOS) return
  fs.mkdirSync(FOTOS, { recursive: true })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.screenshot({ path: path.join(FOTOS, `${nombre}-${test.info().project.name}.png`), fullPage: entera })
}

const hoja = (page) => page.getByTestId('expediente')
const sinDesbordes = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test.describe('El expediente en el panel', () => {
  test('pinta cada bloque en su orden, con la matrícula, la empresa y las cuatro cifras', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page)
    await expect(hoja(page)).toBeVisible()
    await expect(hoja(page).getByRole('heading', { level: 1 })).toHaveText('Expediente del vehículo')
    await expect(page.getByTestId('empresa')).toHaveText('Transportes Ruiz, S. L.')
    await expect(hoja(page).getByTestId('matricula')).toHaveText(/5678 KLM/)
    await expect(hoja(page)).toContainText('Ford Transit Custom · renting hasta el 31 de marzo de 2027 · 48.210 km el 12 de noviembre de 2026')
    await expect(page.getByTestId('periodo')).toHaveText('Desde la primera revisión, el 10 de noviembre de 2026, hasta la última, el 12 de noviembre de 2026.')
    await expect(page.getByTestId('generado')).toHaveText(/^Generado el 14 NOV 2026 · \d\d:00$/)
    const cifras = page.getByTestId('cifras')
    for (const [n, txt] of [['3', 'revisiones'], ['2', 'conductores distintos'], ['2', 'golpes confirmados'], ['0', 'ya reparados']]) {
      await expect(cifras.locator('div', { hasText: txt })).toContainText(n)
    }
    // El orden del documento.
    const orden = await hoja(page).locator('section').evaluateAll((s) => s.map((x) => x.dataset.testid))
    expect(orden).toEqual(['bloque-calendario', 'bloque-golpes', 'bloque-ya-estaba', 'bloque-entro', 'bloque-esta', 'bloque-prueba'])
    // Un cuadradito por día, con el estado del servidor, y su leyenda.
    const dias = page.getByTestId('calendario').locator('[data-fecha]')
    expect(await dias.evaluateAll((d) => d.map((x) => `${x.dataset.fecha}:${x.dataset.estado}`)))
      .toEqual(['2026-11-10:revisada', '2026-11-11:revisada', '2026-11-12:golpe'])
    await expect(page.getByTestId('bloque-calendario')).toContainText('Con revisión')
    await expect(page.getByTestId('bloque-calendario')).toContainText('Sin fotos')
    await expect(page.getByTestId('bloque-calendario')).toContainText('Aparece un golpe')
    // Cómo entró y cómo está: una foto por lado, con su nombre y su sello.
    for (const [b, f] of [['bloque-entro', '10 NOV 2026 · 08:01'], ['bloque-esta', '12 NOV 2026 · 07:58']]) {
      const bloque = page.getByTestId(b)
      await expect(bloque.locator('figcaption')).toHaveText(['Frontal', 'Trasera', 'Lateral izquierdo', 'Lateral derecho'])
      await expect(bloque.getByTestId('sello-foto').first()).toHaveText(f)
    }
    // Qué prueba y qué no, con ese sentido exacto.
    const prueba = page.getByTestId('bloque-prueba')
    await expect(prueba).toContainText('Que FDS recibió estas fotos el día y a la hora que se indican (la hora del servidor, no la del móvil), y qué persona de la empresa marcó cada golpe.')
    await expect(prueba).toContainText('Cuándo se hizo cada foto antes de subirla, ni quién causó un golpe, ni el estado de lo que no sale en las fotos. No es un peritaje.')
    await expect(prueba).toContainText('Lo que valga lo decide quien lo lea.')
    // Con golpes no hay aviso del Repaso, y la barra está.
    await expect(page.getByTestId('aviso-repaso')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Volver a la furgoneta' })).toHaveAttribute('href', '/panel/vehiculos?open=veh-5678')
    await expect(page).toHaveTitle('Expediente 5678 KLM')
    expect(await sinDesbordes(page)).toBe(true)
    await foto(page, 'panel')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el golpe atribuible: sus dos fotos con su sello, la caja y quién la llevó entre las dos', async ({ page }) => {
    await abrir(page)
    const g = page.getByTestId('golpe')
    await expect(g).toHaveCount(1)
    await expect(g.getByRole('heading')).toHaveText('Puerta lateral corredera izquierda · aparece el 12 de noviembre de 2026')
    await expect(g).toContainText('Bollo con pintura saltada')
    await expect(g.getByTestId('sello-foto')).toHaveText(['11 NOV 2026 · 08:03 · Ana L.', '12 NOV 2026 · 07:58 · Ana L.'])
    await expect(g.locator('img')).toHaveCount(2)
    await expect(g.getByTestId('caja-golpe')).toHaveCount(1)
    // La caja en su sitio: [410, 220, 640, 470] en tanto por mil de la foto.
    const caja = await g.getByTestId('caja-golpe').evaluate((c) => c.getAttribute('style'))
    expect(caja).toContain('top: 41%'); expect(caja).toContain('left: 22%')
    expect(caja).toContain('height: 23%'); expect(caja).toContain('width: 25%')
    await expect(g.getByTestId('atribucion')).toHaveText('Entre las dos fotos la llevóAna L. (1 día)')
    await expect(g).toContainText('Moderado')
    await expect(g).toContainText('Marta R., el 12 de noviembre de 2026')
    await expect(g.getByTestId('estado')).toContainText('Pendiente de reparar')
    await expect(g.getByTestId('coste')).toHaveCount(0)
    // Nunca «quién dio el golpe».
    await expect(hoja(page)).not.toContainText(/culpable|responsable|dio el golpe/i)
  })

  const MOTIVOS = [
    ['varios_conductores', { dias: 1, conductores: [{ id: 'a', nombre: 'Ana L.' }, { id: 'l', nombre: 'Luis P.' }] },
      'Entre las dos fotos la llevó más de una persona (Ana L., Luis P.).'],
    ['varios_dias', { dias: 4, conductores: [{ id: 'a', nombre: 'Ana L.' }] }, 'Entre las dos fotos pasaron 4 días.'],
    ['anterior_sin_repasar', { dias: 1 }, 'Nadie marcó la foto anterior de este lado como «igual».'],
    ['sin_foto_anterior', { dias: null, conductores: [] }, 'No hay una foto anterior de este lado con la que compararla.'],
    ['sin_conductor', { dias: 1, conductores: [] }, 'Las revisiones entre las dos fotos no tienen conductor apuntado.'],
  ]
  for (const [motivo, extra, texto] of MOTIVOS) {
    test(`sin conductor atribuible por «${motivo}»: lo dice y da el motivo en llano`, async ({ page }) => {
      const fallos = vigilar(page)
      const d = copia()
      const g = d.golpes[1]
      g.atribucion = { atribuible: false, motivo, conductor: null, conductores: [], ...extra }
      if (motivo === 'sin_foto_anterior') { g.anterior = null; g.vista = null }
      await abrir(page, { datos: d })
      const el = page.getByTestId('golpe')
      await expect(el.getByTestId('atribucion')).toContainText('Sin conductor atribuible')
      await expect(el.getByTestId('motivo')).toHaveText(texto)
      await expect(el).not.toContainText('la llevó Ana')
      await expect(el).not.toContainText('Entre las dos fotos la llevó' + 'Ana')
      // Sin atribuir, el sello de la foto del golpe no lleva nombre.
      await expect(el.getByTestId('sello-foto').last()).toHaveText('12 NOV 2026 · 07:58')
      if (motivo === 'sin_foto_anterior') {
        await expect(el).toContainText('No hay foto anterior de este lado')
        await expect(el.locator('img')).toHaveCount(1)
        await foto(page, 'motivo-sin-foto-anterior', { entera: false })
      }
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })
  }

  test('el golpe que ya estaba sale en «Ya estaba al empezar», sin atribuir a nadie', async ({ page }) => {
    await abrir(page)
    const ya = page.getByTestId('golpe-ya')
    await expect(ya).toHaveCount(1)
    await expect(ya.getByRole('heading')).toHaveText('Paragolpes trasero · en la primera foto de este lado, el 10 de noviembre de 2026')
    await expect(ya.getByTestId('atribucion')).toContainText('Sin conductor atribuible')
    await expect(ya.getByTestId('motivo')).toHaveText('Ya estaba en la primera foto de este lado.')
    await expect(ya.getByTestId('caja-golpe')).toHaveCount(1)
    // No sale dos veces: arriba solo el que aparece en el periodo, y una línea que lo explica.
    await expect(page.getByTestId('bloque-golpes')).toContainText('Los que ya estaban en la primera foto de su lado van aparte')
    await expect(page.getByTestId('bloque-golpes').getByTestId('golpe-ya')).toHaveCount(0)
  })

  test('el estado de cada golpe: en el taller con su orden, reparado con su fecha y su coste', async ({ page }) => {
    const d = copia()
    d.golpes[1].reparacion = { estado: 'reparado', orden_numero: 412, reparado_at: '2026-11-13T10:00:00+00:00', coste: 380 }
    d.golpes[0].reparacion = { estado: 'en_taller', orden_numero: 371, reparado_at: null, coste: null }
    await abrir(page, { datos: d })
    await expect(page.getByTestId('golpe').getByTestId('estado')).toHaveText('EstadoReparado el 13 de noviembre de 2026')
    await expect(page.getByTestId('golpe').getByTestId('coste')).toHaveText(/Coste de la reparación380,00\s€/)
    await expect(page.getByTestId('golpe-ya').getByTestId('estado')).toHaveText('EstadoEn el taller (orden 371)')
  })

  test('sin golpes confirmados: lo dice en una línea, sigue enseñando cómo entró y cómo está, y avisa del Repaso fuera de la hoja', async ({ page }) => {
    const fallos = vigilar(page)
    const d = copia()
    d.golpes = []
    d.como_entro.golpes_ya_estaban = []
    d.calendario = d.calendario.map((x) => ({ ...x, estado: 'revisada' }))
    Object.assign(d.cuentas, { golpes: 0, atribuibles: 0, ya_estaban: 0, abiertos: 0 })
    await abrir(page, { datos: d })
    await expect(page.getByTestId('sin-golpes')).toHaveText('No hay golpes confirmados por una persona en este periodo.')
    await expect(page.getByTestId('golpe')).toHaveCount(0)
    await expect(page.getByTestId('bloque-ya-estaba')).toContainText('Nadie ha marcado ningún golpe en la primera foto de cada lado.')
    await expect(page.getByTestId('bloque-entro').locator('img')).toHaveCount(4)
    await expect(page.getByTestId('bloque-esta').locator('img')).toHaveCount(4)
    const aviso = page.getByTestId('aviso-repaso')
    await expect(aviso).toContainText('El expediente solo recoge los golpes que alguien ha confirmado en el Repaso.')
    await expect(aviso.getByRole('link', { name: 'Ir al Repaso' })).toHaveAttribute('href', '/panel/repaso')
    // El aviso está fuera de la hoja (no se imprime).
    await expect(hoja(page).getByTestId('aviso-repaso')).toHaveCount(0)
    await foto(page, 'sin-golpes', { entera: false })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('una furgoneta sin ninguna revisión: lo dice, sin calendario ni cifras rotas', async ({ page }) => {
    const fallos = vigilar(page)
    const d = copia()
    Object.assign(d, { periodo: { desde: null, hasta: null, dias: 0 }, como_entro: null, como_esta: null, golpes: [], calendario: [] })
    d.cuentas = Object.fromEntries(Object.keys(d.cuentas).map((k) => [k, 0]))
    await abrir(page, { datos: d })
    await expect(page.getByTestId('periodo')).toHaveText('Esta furgoneta todavía no tiene ninguna revisión.')
    await expect(page.getByTestId('bloque-calendario')).toHaveCount(0)
    await expect(hoja(page)).not.toContainText(/undefined|NaN|null|Invalid/)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('nada de la IA: solo pide el expediente, y el fichero del servidor solo trae golpes confirmados por una persona', async ({ page }) => {
    // El fichero de ejemplo del servidor: cada golpe viene del Repaso o de Revisión rápida y lleva quién lo confirmó.
    for (const g of FIXTURE.golpes) {
      expect(['repaso', 'revision_rapida']).toContain(g.origen)
      expect(g.confirmado_por).toBeTruthy()
    }
    const pedidas = await abrir(page)
    await expect(hoja(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    // La pantalla no pide revisiones, ni daños, ni la cola de la IA: solo el expediente de esa furgoneta.
    expect(pedidas.filter((p) => /inspections|damage|review|ledger|analy|fraud|ia-|ai/i.test(p))).toEqual([])
    expect(pedidas).toContain('/api/vehicles/veh-5678/antes-del-perito')
    await expect(hoja(page)).not.toContainText(/\bIA\b|inteligencia artificial|detecta|estimad/i)
  })

  test('un error del servidor se dice con su texto, y se puede reintentar', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { estado: 404, datos: { detail: 'Esa furgoneta no existe' } })
    await expect(page.getByRole('alert')).toContainText('Esa furgoneta no existe')
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toHaveCount(0)
    await page.unroute('**/api/vehicles/*/antes-del-perito')
    await page.route('**/api/vehicles/*/antes-del-perito', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }))
    await page.getByRole('button', { name: 'Volver a intentarlo' }).click()
    await expect(hoja(page)).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('una respuesta sin la forma del contrato no se pinta a medias', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { datos: [{ id: 'v1' }] })
    await expect(page.getByRole('alert')).toContainText('No se ha podido cargar el expediente.')
    await expect(hoja(page)).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('abre con la empresa que tiene su lista de módulos (con «vehiculos»), y no sin ese módulo', async ({ page }) => {
    // Va fuera de PanelLayout: su guardián miraría «expediente» (el último tramo), que no es un módulo.
    await abrir(page, { billing: { org_name: 'Transportes Ruiz, S. L.', modulos: ['vehiculos', 'inspecciones'] } })
    await expect(hoja(page)).toBeVisible()
  })

  test('sin el módulo de furgonetas, no lo enseña', async ({ page }) => {
    await abrir(page, { billing: { modulos: ['conductores'] } })
    await expect(page.getByTestId('sin-acceso')).toHaveText('No tienes acceso a las furgonetas.')
    await expect(hoja(page)).toHaveCount(0)
  })

  test('sin sesión, al login del panel', async ({ page }) => {
    await page.goto(RUTA, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/panel\/login/)
  })

  test('se entra desde la ficha de la furgoneta y se vuelve a ella', async ({ page }) => {
    const fallos = vigilar(page)
    const d = copia()
    d.vehiculo.id = 'v1'
    await abrir(page, { datos: d, ruta: '/panel/vehiculos' })
    await page.getByText('1234 ABC').first().click()
    await page.getByRole('button', { name: 'Historial' }).click()
    await page.getByRole('link', { name: 'Expediente para imprimir' }).click()
    await expect(page).toHaveURL(/\/panel\/vehiculos\/v1\/expediente$/)
    await expect(hoja(page)).toBeVisible()
    await page.getByRole('link', { name: 'Volver a la furgoneta' }).click()
    await expect(page).toHaveURL(/\/panel\/vehiculos/)
    await expect(page.getByRole('button', { name: 'Historial' })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('al imprimir: solo la hoja, sin la barra ni el menú del panel, y la hoja en blanco', async ({ page }) => {
    await abrir(page)
    await expect(hoja(page)).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeHidden()
    await expect(page.getByRole('link', { name: 'Volver a la furgoneta' })).toBeHidden()
    await expect(page.locator('nav, aside')).toHaveCount(0)
    await expect(hoja(page)).toBeVisible()
    const fondo = await page.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor)
    expect(fondo).toBe('rgb(255, 255, 255)')
    // El pie y el número de página de cada hoja.
    const estilo = await hoja(page).locator('style').textContent()
    expect(estilo).toContain('size: A4; margin: 14mm;')
    expect(estilo).toContain('"Las fechas son las de llegada de cada foto al servidor de FDS."')
    expect(estilo).toContain('"5678 KLM · " counter(page) " / " counter(pages)')
    await foto(page, 'panel-impresion')
  })

  test('en 390 px la hoja se ajusta al ancho, sin desbordes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await abrir(page)
    await expect(hoja(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await sinDesbordes(page)).toBe(true)
    const caja = await hoja(page).boundingBox()
    expect(caja.x).toBeGreaterThanOrEqual(15)
    expect(caja.x + caja.width).toBeLessThanOrEqual(390 - 15)
    await foto(page, 'panel-390')
  })

  for (const tema of ['light', 'hibrido', 'dark']) {
    test(`con el tema «${tema}» la hoja sigue blanca con la tinta encima`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('panel_theme', t)
        localStorage.setItem('panel_theme_elegido', '1')
      }, tema)
      await abrir(page)
      await expect(hoja(page)).toBeVisible()
      const [fondo, letra] = await hoja(page).evaluate((h) => [getComputedStyle(h).backgroundColor, getComputedStyle(h).color])
      expect(fondo).toBe('rgb(255, 255, 255)')
      expect(letra).toBe('rgb(16, 24, 26)')
      await foto(page, `tema-${tema}`, { entera: false })
    })
  }
})

test.describe('El ejemplo público', () => {
  test('el mismo documento con datos inventados, la franja de ejemplo y la entrada al alta', async ({ page }) => {
    const fallos = vigilar(page)
    await page.goto('/expediente-ejemplo', { waitUntil: 'domcontentloaded' })
    const franja = page.getByTestId('franja-ejemplo')
    await expect(franja).toContainText('Ejemplo con datos inventados')
    await expect(franja.getByRole('link', { name: 'Probar con mis furgonetas' })).toHaveAttribute('href', '/registro?sector=otra&plan=completo')
    await expect(page.getByTestId('empresa')).toHaveText('Transportes del Noroeste, S. L. (ejemplo)')
    await expect(hoja(page).getByTestId('matricula')).toHaveText(/5678 KLM/)
    await expect(page.getByTestId('golpe')).toHaveCount(2)
    await expect(page.getByTestId('golpe-ya')).toHaveCount(1)
    await expect(page.getByTestId('golpe').first().getByTestId('atribucion')).toHaveText('Entre las dos fotos la llevóLuis P. (1 día)')
    await expect(page.getByTestId('golpe').nth(1).getByTestId('motivo')).toHaveText('Entre las dos fotos pasaron 4 días.')
    await expect(page.getByTestId('golpe-ya').getByTestId('estado')).toHaveText('EstadoReparado el 4 de junio de 2026')
    // Las fotos de la demo cargan (ninguna rota).
    await page.waitForLoadState('networkidle')
    const rotas = await hoja(page).locator('img').evaluateAll((im) => im.filter((i) => !i.complete || i.naturalWidth === 0).length)
    expect(rotas).toBe(0)
    // Medio año de días: fines de semana sin fotos y los dos días con golpe.
    const golpes = await page.getByTestId('calendario').locator('[data-estado="golpe"]').evaluateAll((d) => d.map((x) => x.dataset.fecha))
    expect(golpes).toEqual(['2026-10-27', '2026-11-10'])
    expect(await sinDesbordes(page)).toBe(true)
    await foto(page, 'ejemplo')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('al imprimir, sin la franja; y el PDF sale en A4', async ({ page, browserName }) => {
    await page.goto('/expediente-ejemplo', { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('franja-ejemplo')).toBeHidden()
    await expect(hoja(page)).toBeVisible()
    await foto(page, 'ejemplo-impresion')
    // El PDF de verdad, como lo guardaría el navegador (solo Chromium sabe hacerlo).
    if (browserName === 'chromium') {
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
      if (FOTOS) fs.writeFileSync(path.join(FOTOS, `ejemplo-${test.info().project.name}.pdf`), pdf)
    }
  })

  test('en 390 px, sin desbordes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/expediente-ejemplo', { waitUntil: 'networkidle' })
    await expect(hoja(page)).toBeVisible()
    expect(await sinDesbordes(page)).toBe(true)
    await foto(page, 'ejemplo-390')
  })
})
