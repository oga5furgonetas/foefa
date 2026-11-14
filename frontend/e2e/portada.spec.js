/* global process */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA PORTADA PARA EMPRESAS CON FURGONETAS (/ y /empresas, 14-11-2026, «Antes del perito»).
   «/» deja de ser la portada de la app de reparto (sigue en /repartidores) y pasa a ser la de empresas, con la identidad
   nueva (tinta sobre papel). Lo que no puede fallar: el titular; ni una promesa de la IA; el producto en el héroe (la
   matrícula, las dos fotos del mismo lado con su sello y el golpe marcado, y que es un ejemplo inventado); a dónde
   llevan los botones; que /empresas enseña lo mismo; que /repartidores sigue ahí; y que en un móvil de 390 px nada se
   sale por el lado. Con FOTOS_PORTADA=<carpeta> guarda además las fotos de la portada y de cada página pública. */

// Sin tocar la calculadora, el alta del plan Esencial (el del «Desde 5 €») con sus 20 furgonetas.
const ALTA = '/registro?sector=otra&plan=operacion'

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

/* Lo que no se puede decir de la IA (ni de nada) en la portada: la IA no se promete; quien decide es una persona. */
const PROHIBIDO = [/detecta/i, /la IA (señala|marca|ve|analiza|mira)/i, /\bIA\b/, /inteligencia artificial/i, /certificad/i, /inmutable/i,
  /sellad/i, /auténtic/i, /verificad/i, /sin discusión/i, /culpable/i, /quién dio el golpe(?! \?)/i, /Revisión rápida/i, /Origen de daños/i,
  /detección de daños/i, /\bgratis\b/i]

for (const ruta of ['/', '/empresas']) {
  test.describe(`la portada en ${ruta}`, () => {
    test('es la de empresas, con su titular, su título y sin errores', async ({ page }) => {
      const fallos = vigilarErrores(page)
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('portada-empresas')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('El golpe, el día que aparece. No el día que te lo cobran.')
      await expect(page).toHaveTitle('FDS para empresas con furgonetas · El golpe, el día que aparece')
      await expect(page.getByText('Para empresas con furgonetas', { exact: true }).first()).toBeVisible()
      // La portada vieja de la app de reparto ya no está aquí.
      await expect(page.getByText('La app de reparto gratis', { exact: false })).toHaveCount(0)
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })

    test('no promete la IA ni nada de lo prohibido, ni con las preguntas abiertas', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
      const texto = await page.locator('body').innerText()
      for (const p of PROHIBIDO) expect(texto, `no puede decir ${p}`).not.toMatch(p)
      // La pregunta que lo aclara sí está, y su respuesta: decide una persona; quién la llevaba, solo si es seguro.
      expect(texto).toContain('¿Quién decide si hay un golpe?')
      expect(texto).toContain('Una persona de tu oficina.')
      expect(texto).toContain('el golpe queda sin conductor atribuible y se dice por qué')
    })

    test('el héroe lleva el producto: la matrícula, las dos fotos del mismo lado con su sello, el golpe y el aviso de ejemplo', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      const producto = page.getByTestId('emp-producto')
      await expect(producto).toBeVisible()
      await expect(producto.getByTestId('matricula')).toHaveText('E5678 KLM')
      await expect(producto.getByText('Lateral derecho', { exact: true })).toBeVisible()
      // Dos sellos a la vista (uno por foto), con la fecha y quién la hizo: las dos, Luis P. (lib/expedienteEjemplo.js).
      const sellos = producto.locator('[data-testid="sello-foto"]:visible')
      await expect(sellos).toHaveCount(2)
      // En el móvil (menos de 640 px), sin el año ni el nombre: no caben en media pantalla.
      const movil = page.viewportSize().width < 640
      await expect(sellos.nth(0)).toHaveText(movil ? '11 NOV · 18:12' : '11 NOV 2026 · 18:12 · Luis P.')
      await expect(sellos.nth(1)).toHaveText(movil ? '12 NOV · 18:07' : '12 NOV 2026 · 18:07 · Luis P.')
      await expect(producto.getByText('Antes', { exact: true })).toBeVisible()
      await expect(producto.getByText('Hoy', { exact: true })).toBeVisible()
      await expect(producto.getByTestId('emp-cerco')).toHaveCount(1)
      await expect(producto.getByText('Golpe nuevo en la puerta corredera')).toBeVisible()
      await expect(producto).toContainText('Solo la llevó Luis P. entre las dos fotos. Lo marcó la oficina al repasar el día.')
      await expect(producto.getByTestId('emp-ejemplo-inventado')).toHaveText('Ejemplo con datos inventados')
      // El 12-11-2026 es jueves: el día de la semana sale del calendario, no escrito a mano.
      await expect(producto).toContainText('Repaso del jueves, 12 de noviembre')
      // Las fotos cargan.
      for (const img of await producto.locator('img').all()) {
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
      }
    })

    test('los botones llevan a su sitio', async ({ page }) => {
      await simularApi(page, 'vacio')
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      for (const id of ['emp-probar-menu', 'emp-probar', 'emp-probar-cierre']) {
        await expect(page.getByTestId(id)).toHaveText(page.viewportSize().width < 640 && id === 'emp-probar-menu' ? 'Probar' : 'Probar con mis furgonetas', { useInnerText: true })
        await expect(page.getByTestId(id)).toHaveAttribute('href', `${ALTA}&flota=20`)
      }
      await expect(page.getByTestId('emp-expediente')).toHaveText('Ver un expediente de ejemplo')
      await expect(page.getByTestId('emp-expediente')).toHaveAttribute('href', '/expediente-ejemplo')
      await expect(page.getByTestId('emp-ensenar-cierre')).toHaveAttribute('href', '#demo')
      await expect(page.getByTestId('emp-repartidores')).toHaveAttribute('href', '/repartidores')
      await expect(page.getByTestId('emp-repartidores')).toContainText('¿Repartes tú?')
      await expect(page.getByRole('link', { name: 'Entrar' }).first()).toHaveAttribute('href', '/panel/login')
      await expect(page.getByRole('link', { name: 'Qué le enseñas al perito' })).toHaveAttribute('href', '/peritaje-tecnico')
      await expect(page.getByTestId('emp-linea-precio')).toHaveText('Desde 5 € por furgoneta y mes. 14 días de prueba, sin tarjeta.')
      // Las cifras de la casa, tal cual (CIFRAS_CASA), y las revisiones como «unas 200».
      const nave = page.getByTestId('emp-nave')
      // (en el HTML va primero el nombre, dt, y luego la cifra, dd: se pintan al revés)
      await expect(nave).toContainText('naves3')
      await expect(nave).toContainText('furgonetas63')
      await expect(nave).toContainText('revisiones con foto cada semanaunas 200')
      await expect(page.getByTestId('emp-paso')).toHaveCount(3)
    })
  })
}

test('/repartidores sigue siendo la página de la app de reparto', async ({ page }) => {
  const fallos = vigilarErrores(page)
  await simularApi(page, 'vacio')
  await page.goto('/repartidores', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('portada-empresas')).toHaveCount(0)
  await expect(page.locator('body')).toContainText(/ruta/i)
  await expect(page.getByRole('link', { name: /Crear mi cuenta/ }).first()).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('en un móvil de 390 px: nada se sale por el lado, y el titular y el botón se ven sin deslizar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const h1 = page.getByRole('heading', { level: 1 })
  const boton = page.getByTestId('emp-probar')
  await expect(h1).toBeVisible()
  for (const el of [h1, boton]) {
    const caja = await el.boundingBox()
    expect(caja.y + caja.height, 'tiene que verse sin deslizar').toBeLessThanOrEqual(844)
    expect(caja.x + caja.width).toBeLessThanOrEqual(390)
  }
  for (const y of [0, 1500, 3000, 99999]) {
    await page.evaluate((v) => window.scrollTo(0, v), y)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  }
  // Ningún elemento visible se pasa del borde derecho (un desborde dentro de un overflow-x-clip no se ve en scrollWidth).
  const fuera = await page.evaluate(() => [...document.querySelectorAll('[data-testid="portada-empresas"] *')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 390.5 && !e.closest('[aria-hidden="true"] img, .aspect-\\[1200\\/675\\]') })
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`))
  expect(fuera, fuera.join(' | ')).toEqual([])
})

test('en inglés: el titular y el héroe en inglés', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spot the dent the day it appears. Not the day you’re billed for it.')
  await expect(page).toHaveTitle('FDS for van fleets · Spot the dent the day it appears')
  await expect(page.getByTestId('emp-producto')).toContainText(/Review for Thursday,? (12 November|November 12)/)
  await expect(page.getByTestId('emp-probar')).toHaveText('Try it with my vans')
})

test('día por defecto; la noche se elige y se recuerda', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const raiz = page.getByTestId('portada-empresas')
  await expect(raiz).toHaveAttribute('data-theme', 'light')
  expect(await raiz.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(245, 246, 243)')
  await page.getByRole('button', { name: 'Cambiar entre claro y oscuro' }).click()
  await expect(raiz).toHaveAttribute('data-theme', 'dark')
  expect(await raiz.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(11, 16, 18)')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('portada-empresas')).toHaveAttribute('data-theme', 'dark')
})

/* ── ARREGLOS-1 (14-11-2026): lo que encontraron los revisores de las páginas públicas. Cada prueba falla con el código
   de antes y pasa con el de ahora. ── */

const IDIOMAS_WEB = ['es', 'en', 'pt', 'fr', 'it', 'de']
const conIdioma = (page, l) => page.addInitScript((x) => { try { localStorage.setItem('fds_idioma', x) } catch { /* nada */ } }, l)

test('[bloquea] el botón de la cabecera cabe entero en el móvil, en los seis idiomas (320, 360 y 390 px)', async ({ page }) => {
  await simularApi(page, 'vacio')
  for (const l of IDIOMAS_WEB) {
    for (const ancho of [320, 360, 390]) {
      await page.setViewportSize({ width: ancho, height: 800 })
      await conIdioma(page, l)
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      const boton = page.getByTestId('emp-probar-menu')
      await expect(boton).toBeVisible()
      await page.evaluate(() => document.fonts.ready)          // se mide con la letra de verdad, no con la de respaldo
      const caja = await boton.boundingBox()
      expect(caja.x + caja.width, `${l} a ${ancho}: el botón se sale`).toBeLessThanOrEqual(ancho - 8)
      // Y el texto no está cortado dentro del botón.
      expect(await boton.evaluate((b) => b.scrollWidth <= b.clientWidth + 1), `${l} a ${ancho}: texto cortado`).toBe(true)
      // La marca y «Entrar» siguen a la vista, sin pisarse con él.
      const entrar = await page.getByRole('link', { name: /^(Entrar|Log in|Se connecter|Accedi|Anmelden)$/ }).first().boundingBox()
      expect(entrar.x + entrar.width, `${l} a ${ancho}: «Entrar» pisa el botón`).toBeLessThanOrEqual(caja.x)
    }
  }
})

test('en el móvil, arriba del todo, una línea a la vista lleva a la app de ruta (/repartidores)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enlace = page.getByTestId('emp-repartidores-arriba')
  await expect(enlace).toBeVisible()
  await expect(enlace).toHaveAttribute('href', '/repartidores')
  await expect(enlace).toHaveText(/¿Repartes tú\?\s*La app de ruta/)
  expect((await enlace.boundingBox()).y).toBeLessThan(10)
  // En el ordenador ya va en la cabecera: la línea de arriba no se repite.
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(enlace).toBeHidden()
})

test('el paso 3, la pregunta del conductor y la cuenta del cargo dicen solo lo que es verdad', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const paso3 = page.getByTestId('emp-paso').nth(2)
  await expect(paso3).toContainText('Cada golpe queda con su día')
  await expect(paso3).toContainText('Y con quién la llevaba, solo cuando se sabe con seguridad. Cada furgoneta tiene su expediente: cómo entró, qué le ha pasado y cuándo, listo para imprimir.')
  await expect(page.getByTestId('emp-paso').nth(0)).toContainText('cada conductor, una revisión por furgoneta y día')
  // La pregunta no planta la idea de «quién dio el golpe» y la respuesta no habla de culpa.
  await expect(page.getByText('¿Dice quién llevaba la furgoneta?')).toBeVisible()
  await page.getByText('¿Dice quién llevaba la furgoneta?').click()
  const respuesta = page.locator('details[open] p')
  await expect(respuesta).toContainText('Solo cuando se sabe con seguridad: si entre las dos fotos la llevó una sola persona, en un día o menos, y la foto anterior de ese lado se repasó y estaba igual.')
  await expect(respuesta).not.toContainText(/culpa/i)
  await expect(page.locator('body')).not.toContainText(/qué conductor dio el golpe/i)
  // La cuenta del cargo: solo la equivalencia, sin dar por hecho que se evita (Esencial, 20 furgonetas = 100 €).
  await page.getByLabel('¿De cuánto fue el último cargo por daños que te pasaron?').fill('550')
  await expect(page.getByTestId('emp-meses')).toHaveText('Un cargo así equivale a 5 meses de FDS para tu flota.')
  await expect(page.locator('body')).not.toContainText(/Con evitar/)
})

test('los dos botones de plan de la calculadora, del mismo ancho y en la misma fila (1280 y 390)', async ({ page }) => {
  await simularApi(page, 'vacio')
  for (const ancho of [1280, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const [a, b] = await Promise.all([page.getByRole('button', { name: /^Plan Esencial/ }).boundingBox(), page.getByRole('button', { name: /^Plan Pro/ }).boundingBox()])
    expect(Math.abs(a.width - b.width), `a ${ancho}`).toBeLessThan(1)
    expect(Math.abs(a.y - b.y), `a ${ancho}`).toBeLessThan(1)
    expect(Math.abs(a.height - b.height), `a ${ancho}`).toBeLessThan(1)
  }
})

test('las cuatro miniaturas del paso 1: la del lado derecho es la foto; las demás, dibujadas; y ningún rótulo cortado', async ({ page }) => {
  await simularApi(page, 'vacio')
  for (const ancho of [1280, 360]) {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const recorte = page.getByTestId('emp-recorte-fotos')
    await expect(recorte.locator('p')).toHaveText(['Frontal', 'Izquierdo', 'Derecho', 'Trasera'])
    await expect(recorte.locator('img')).toHaveCount(1)
    await expect(recorte.locator('img')).toHaveAttribute('src', '/demo/van-lateral.jpg')
    await expect(recorte.locator('svg[data-vista]')).toHaveCount(3)
    // Ni la foto de otra furgoneta (la frontal de la demo) ni el lateral girado o acercado.
    await expect(page.locator('img[src="/demo/van-frontal.jpg"]')).toHaveCount(0)
    for (const p of await recorte.locator('p').all()) {
      expect(await p.evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis'), `a ${ancho}`).toBe(true)
    }
  }
})

test('de noche, el cuadrado del logo se ve y el cerco del golpe va en el rojo de noche', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('fds_tema_web', 'dark') } catch { /* nada */ } })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const cuadrado = page.getByTestId('emp-cabecera').locator('svg rect').first()
  const [relleno, borde] = await cuadrado.evaluate((r) => [getComputedStyle(r).fill, getComputedStyle(r).stroke])
  expect(relleno).not.toBe('rgb(16, 24, 26)')                  // la tinta de día sobre el papel de noche no se veía
  expect(borde).not.toBe('rgba(0, 0, 0, 0)')
  expect(await page.getByTestId('emp-cerco').evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(255, 138, 128)')
})

test('la raya del pie no es más ancha que las demás reglas de la página', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const pie = await page.locator('footer p').filter({ hasText: '©' }).boundingBox()
  const regla = await page.locator('#como > div').boundingBox()
  expect(Math.abs(pie.width - regla.width)).toBeLessThan(1)
  expect(Math.abs(pie.x - regla.x)).toBeLessThan(1)
})

test('las letras crecen con el tamaño de letra del navegador (rem, no px)', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const parrafo = page.locator('header p').nth(1)
  const antes = await parrafo.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  const despues = await parrafo.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  expect(despues).toBeCloseTo(antes * 2, 0)
  expect(await page.getByRole('heading', { level: 1 }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(80)
})

test('el formulario: sin exclamaciones y sin recortar a escondidas (cada campo, con su tope)', async ({ page }) => {
  await simularApi(page, 'vacio')
  let cuerpo = null
  await page.route('**/api/auth/lead', (r) => { cuerpo = r.request().postDataJSON(); return r.fulfill({ json: { ok: true, mensaje: '¡Recibido! Te respondemos en menos de 24 horas hábiles.' } }) })
  await page.goto('/#demo', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Tu nombre').fill('Marta Gil')
  await page.getByLabel('Tu empresa', { exact: true }).fill('E'.repeat(300))
  await page.getByLabel('Correo').fill('marta@ejemplo.com')
  await page.getByLabel('¿Cuántas furgonetas?').selectOption('100+')
  await page.getByLabel('Teléfono (opcional)').fill('6'.repeat(60))
  const mensaje = page.getByLabel('Mensaje (opcional)')
  await mensaje.fill('m'.repeat(3000))
  // El campo no deja pasar del tope y avisa de lo que queda al acercarse.
  expect((await mensaje.inputValue()).length).toBe(800)
  await expect(page.getByTestId('emp-quedan')).toHaveText('Quedan 0 caracteres.')
  await mensaje.fill('m'.repeat(799))
  await expect(page.getByTestId('emp-quedan')).toHaveText('Queda 1 carácter.')
  await mensaje.fill('m'.repeat(600))
  await expect(page.getByTestId('emp-quedan')).toHaveCount(0)
  await mensaje.fill('m'.repeat(800))
  expect((await page.getByLabel('Tu empresa', { exact: true }).inputValue()).length).toBe(120)
  await page.getByRole('button', { name: 'Pedir la demostración' }).click()
  await expect(page.getByTestId('emp-recibido')).toHaveText('Recibido. Te respondemos en menos de 24 horas hábiles.')
  // Lo que se ve es exactamente lo que llega: el mensaje entero, sin cortar.
  expect(cuerpo.plan.endsWith(`mensaje: ${'m'.repeat(800)}`)).toBe(true)
  expect(cuerpo.plan.length).toBeLessThanOrEqual(1000)
  expect(cuerpo.company).toBe('E'.repeat(120))
  await expect(page.locator('body')).not.toContainText('¡')
})

/* El título de la pestaña: index.html es neutro («FDS») y cada página pública pone el suyo; nadie hereda el de la
   portada. (En producción, la portada lo trae ya escrito de functions/index.js.) */
test('títulos de pestaña: ninguna pantalla hereda el de la portada', async ({ page }) => {
  await simularApi(page, 'vacio')
  const PORTADA = /para empresas con furgonetas/
  for (const ruta of ['/conductor', '/ruta', '/login', '/panel/login', '/empleo', '/repartidores', '/iphone']) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await expect(page, ruta).not.toHaveTitle(PORTADA)
    await expect(page, ruta).toHaveTitle(/FDS/)
  }
  for (const [ruta, titulo] of [['/privacidad', 'Política de Privacidad · FDS'], ['/contacto', 'Contacto · FDS'], ['/terminos', /· FDS$/],
    ['/cookies', /· FDS$/], ['/aviso-legal', /· FDS$/], ['/security', /· FDS$/], ['/planes', 'Planes y precios · FDS'],
    ['/peritaje-tecnico', 'Qué le enseñas al perito · FDS']]) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    await expect(page, ruta).toHaveTitle(titulo)
  }
  // Y al volver de la portada a otra pantalla sin título propio, el neutro, no el de la portada.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle(PORTADA)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveTitle(PORTADA)
})

/* El fondo de arranque: antes de que pinte React, el papel en las páginas públicas claras (sin fogonazo oscuro), y el
   oscuro de siempre en el panel y la app de reparto. Se mira con el JavaScript de la app bloqueado. */
test('el fondo antes de que arranque React: papel en las públicas, oscuro en el panel y la ruta', async ({ page }) => {
  await page.route(/\/assets\/.*\.js$|\/src\/main\.jsx/, (r) => r.abort())
  for (const [ruta, fondo] of [['/', 'rgb(245, 246, 243)'], ['/empresas', 'rgb(245, 246, 243)'], ['/planes', 'rgb(245, 246, 243)'],
    ['/contacto', 'rgb(245, 246, 243)'], ['/privacidad', 'rgb(245, 246, 243)'], ['/devolucion-renting/ald', 'rgb(245, 246, 243)'],
    ['/panel/login', 'rgb(6, 10, 20)'], ['/ruta', 'rgb(6, 10, 20)'], ['/conductor', 'rgb(6, 10, 20)']]) {
    await page.goto(ruta, { waitUntil: 'load' })
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), ruta).toBe(fondo)
    const barra = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(barra, ruta).toBe(fondo === 'rgb(6, 10, 20)' ? '#070a0e' : '#f5f6f3')
  }
  // Quien eligió la noche en el pie arranca en el papel de noche, no en el claro.
  await page.addInitScript(() => { try { localStorage.setItem('fds_tema_web', 'dark') } catch { /* nada */ } })
  await page.goto('/', { waitUntil: 'load' })
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(11, 16, 18)')
})

/* Contacto y las legales: la paleta de las páginas públicas (papel, sin la tarjeta clara con halo del tema del panel). */
for (const ruta of ['/contacto', '/privacidad', '/cookies']) {
  test(`${ruta}: papel y tinta, sin halo ni tarjeta clara encima, de día y de noche`, async ({ page }) => {
    await simularApi(page, 'vacio')
    for (const [tema, fondo, tinta] of [['light', 'rgb(245, 246, 243)', 'rgb(16, 24, 26)'], ['dark', 'rgb(11, 16, 18)', 'rgb(233, 237, 239)']]) {
      await page.addInitScript((t) => { try { localStorage.setItem('fds_tema_web', t) } catch { /* nada */ } }, tema)
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      const raiz = page.getByTestId('legal')
      await expect(raiz).toHaveAttribute('data-theme', tema)
      expect(await raiz.evaluate((e) => getComputedStyle(e).backgroundColor), tema).toBe(fondo)
      const zona = page.getByRole('main')
      const [fondoZona, imagen] = await zona.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).backgroundImage])
      expect(fondoZona, `${tema}: la zona del texto lleva fondo propio`).toBe('rgba(0, 0, 0, 0)')
      expect(imagen, `${tema}: halo`).toBe('none')
      expect(await page.getByRole('heading', { level: 1 }).evaluate((e) => getComputedStyle(e).color), tema).toBe(tinta)
      // El texto se lee sobre su fondo (lo que antes era la rampa del panel de noche).
      expect(await zona.locator('p').first().evaluate((e) => getComputedStyle(e).color), tema).not.toBe(fondo)
    }
  })
}

test('/planes en otro idioma: la página ENTERA traducida (también lo de cada plan) y el selector de idioma de la portada', async ({ page }) => {
  await conIdioma(page, 'de')
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bezahlt wird pro Fahrzeug. Nutzer und Fahrer ohne Begrenzung.')
  await expect(page).toHaveTitle('Tarife und Preise · FDS')
  // Ya no hay una línea que avise de que algo sale en español: no sale nada en español (planes.spec.js lo mira frase a frase).
  await expect(page.getByTestId('planes-en-espanol')).toHaveCount(0)
  await expect(page.locator('[lang="es"]')).toHaveCount(0)
  const texto = await page.evaluate(() => {
    const c = document.body.cloneNode(true)
    c.querySelectorAll('#ld-idioma, script, style').forEach((n) => n.remove())
    return c.innerText
  })
  for (const es of ['Se paga por vehículo', 'Mensual', 'Recomendado', 'por vehículo y mes', 'Empezar la prueba', 'Complementos', 'Cómo se cuenta', '¿Repartes tú solo?', 'Precios sin IVA', 'Oferta fundador', 'gratis',
    'Una sede', 'Todo lo de Esencial', '¿Qué vehículo cuenta?', 'Vehículos de colaboradores', '¿Tengo permanencia?']) {
    expect(texto, es).not.toContain(es)
  }
  await expect(page.getByText('Alles aus Basis, mit unbegrenzt vielen Standorten und einer Leitung pro Standort')).toBeVisible()
  // El mismo selector de idioma que la portada (el del pie), que cambia la página al momento.
  await page.locator('#ld-idioma').selectOption('es')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Se paga por vehículo. Usuarios y conductores, sin límite.')
  await expect(page.getByText('Todo lo de Esencial, con sedes ilimitadas y un jefe por sede')).toBeVisible()
  // Ya no se contradice: nada de «2 meses gratis» al lado de «pagas 10 meses».
  const cabeza = await page.locator('h1 + p').innerText()
  expect(cabeza).toContain('anual pagando 10 meses')
  expect(cabeza).not.toMatch(/gratis/i)
})

/* U1 (14-11-2026, tercera tanda): la portada cuenta el arranque como es hoy (/panel/arranque): cuatro pasos, y cada
   conductor entra con SU enlace, sin correo ni contraseña. Nada de «el enlace de tu empresa y su correo» ni de «subir el
   Excel», que era el alta de antes. */
test('la portada cuenta el arranque como es hoy: cuatro pasos y el enlace de cada conductor, sin correo ni contraseña', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const pasos = page.getByTestId('emp-arranque-paso')
  await expect(pasos).toHaveCount(4)
  await expect(pasos.nth(0)).toContainText('Pegas las matrículas')
  await expect(pasos.nth(1)).toContainText('Pegas la lista de conductores')
  await expect(pasos.nth(2)).toContainText('Le mandas a cada uno su enlace por WhatsApp')
  await expect(pasos.nth(2)).toContainText('sin correo, sin contraseña y sin instalar nada')
  await expect(pasos.nth(3)).toContainText('Ves llegar la primera revisión')
  await expect(page.getByTestId('emp-arranque')).toContainText('Son cuatro pasos y puedes dejarlos a medias.')
  await expect(page.locator('#como')).toContainText('Cada conductor entra desde el móvil con su propio enlace, sin correo ni contraseña.')
  // Las preguntas, abiertas: lo mismo.
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  await expect(page.locator('body')).toContainText('Son cuatro pasos y puedes dejarlos a medias: pegas las matrículas')
  await expect(page.locator('body')).toContainText('con su propio enlace, que le mandas por WhatsApp')
  for (const viejo of [/enlace de tu empresa/i, /su correo\./, /subir el Excel/i, /tres pasos/i, /Excel de furgonetas/i]) {
    await expect(page.locator('body')).not.toContainText(viejo)
  }
  // Y en otro idioma, igual de traducido (sin una frase del arranque en español).
  await page.locator('#ld-idioma').selectOption('de')
  await expect(pasos.nth(2)).toContainText('Du schickst jedem seinen Link per WhatsApp')
  await expect(page.getByTestId('emp-arranque')).not.toContainText('Pegas')
})

/* U5: lo que enseña Google bajo el título de «/» (functions/index.js) cabe entero (155 caracteres como mucho), dice lo
   que hace el producto con su precio de verdad y no promete nada. */
test('la descripción para buscadores de «/» cabe en 155 caracteres y no promete', async () => {
  const { DESCRIPCION } = await import('../functions/index.js')
  const { PLANES_EMPRESA, DIAS_PRUEBA_EMPRESA } = await import('../src/lib/precios.js')
  expect(DESCRIPCION.length, DESCRIPCION).toBeLessThanOrEqual(155)
  const desde = Math.min(...PLANES_EMPRESA.map((p) => Number(p.por_vehiculo)).filter((x) => x > 0))
  expect(DESCRIPCION).toContain(`Desde ${desde} € por furgoneta al mes`)
  expect(DESCRIPCION).toContain(`${DIAS_PRUEBA_EMPRESA} días de prueba`)
  for (const mal of PROHIBIDO.concat([/ahorr/i, /antes de que/i, /evita/i])) expect(DESCRIPCION).not.toMatch(mal)
})

test('las páginas del repartidor llevan su logo a /repartidores, no a la portada de empresas', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/iphone', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'FDS' }).first()).toHaveAttribute('href', '/repartidores')
  await page.goto('/prueba-reparto', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'FDS', exact: true }).first()).toHaveAttribute('href', '/repartidores')
})

/* ── Las fotos (solo con FOTOS_PORTADA=<carpeta>) ── */
const CARPETA = process.env.FOTOS_PORTADA
const PUBLICAS = [['portada', '/'], ['repartidores', '/repartidores'], ['planes', '/planes'], ['peritaje', '/peritaje-tecnico'],
  ['registro', '/registro'], ['contacto', '/contacto'], ['privacidad', '/privacidad'], ['terminos', '/terminos'], ['cookies', '/cookies'],
  ['aviso-legal', '/aviso-legal'], ['seguridad', '/security'], ['iphone', '/iphone'], ['empleo', '/empleo'], ['login', '/panel/login']]
test.describe('fotos de las páginas públicas', () => {
  test.skip(!CARPETA, 'solo con FOTOS_PORTADA')
  for (const [nombre, ruta] of PUBLICAS) {
    for (const ancho of [1280, 390]) {
      for (const tema of nombre === 'portada' || nombre === 'peritaje' || nombre === 'planes' ? ['dia', 'noche'] : ['dia']) {
        test(`${nombre} a ${ancho} (${tema})`, async ({ page }) => {
          await page.addInitScript((t) => {
            localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' }))
            if (t === 'noche') localStorage.setItem('fds_tema_web', 'dark')
          }, tema)
          await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
          await simularApi(page, 'vacio')
          await page.goto(ruta, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1200)
          await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } window.scrollTo(0, 0) })
          await page.waitForTimeout(400)
          fs.mkdirSync(CARPETA, { recursive: true })
          await page.screenshot({ path: path.join(CARPETA, `${nombre}-${ancho}-${tema}.png`), fullPage: true })
        })
      }
    }
  }
})

/* La sección del arranque (U1), día y noche, a 1280 y 390 (solo con FOTOS_PUBLICO=<carpeta>). */
test.describe('fotos del arranque de la portada', () => {
  test.skip(!process.env.FOTOS_PUBLICO, 'solo con FOTOS_PUBLICO')
  for (const ancho of [1280, 390]) {
    for (const tema of ['dia', 'noche']) {
      test(`el arranque a ${ancho} (${tema})`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' }))
          if (t === 'noche') localStorage.setItem('fds_tema_web', 'dark')
        }, tema)
        await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
        await simularApi(page, 'vacio')
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        const seccion = page.getByTestId('emp-arranque')
        await seccion.scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
        fs.mkdirSync(process.env.FOTOS_PUBLICO, { recursive: true })
        await seccion.screenshot({ path: path.join(process.env.FOTOS_PUBLICO, `portada-arranque-${ancho}-${tema}.png`) })
      })
    }
  }
})
