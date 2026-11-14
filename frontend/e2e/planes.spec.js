/* global process */
import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'
import { A } from '../src/lib/textosRutaA.js'
import { B } from '../src/lib/textosRutaB.js'
import { C } from '../src/lib/textosRutaC.js'
import { PLANES_EMPRESA, PLAN_REPARTO, COMPLEMENTOS, REGLAS } from '../src/lib/precios.js'

/* /PLANES EN LOS SEIS IDIOMAS, ENTERA (14-11-2026, tercera tanda, U2). Lo que lleva cada plan, para quién es, los
   complementos y «Cómo se cuenta» son frases fijas de lib/precios.js (las mismas, letra a letra, que manda
   /billing/planes): se pintan con tx() y cada una tiene sus 5 traducciones. Antes salían en español en todos los idiomas
   y una línea lo avisaba. Y Pro ya no vende la «Revisión rápida» con la IA, que quien compra hoy no recibe. */

const DIC = { ...A, ...B, ...C }
const ORDEN = ['en', 'pt', 'fr', 'it', 'de']
const vars = (t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

/* Todas las frases fijas que /planes enseña de lib/precios.js. */
const FRASES = [...new Set([
  ...PLANES_EMPRESA.flatMap((p) => [p.nombre, p.para, ...(p.incluye || []), ...(p.no_incluye || [])]),
  PLAN_REPARTO.nombre, PLAN_REPARTO.para, ...PLAN_REPARTO.incluye, ...PLAN_REPARTO.no_incluye,
  ...COMPLEMENTOS.flatMap((c) => [c.nombre, c.precio, c.que]),
  ...REGLAS.flat(),
])]

test('cada frase fija de los planes tiene sus 5 traducciones, con las mismas variables', () => {
  const faltan = FRASES.filter((f) => !Array.isArray(DIC[f]) || DIC[f].length !== 5 || DIC[f].some((x) => !String(x).trim()))
  expect(faltan, faltan.join('\n')).toEqual([])
  const malas = FRASES.filter((f) => DIC[f].some((x) => vars(x) !== vars(f)))
  expect(malas, malas.join('\n')).toEqual([])
})

test('ningún plan nombra la IA (la «Revisión rápida» de Pro fuera: quien compra hoy no la recibe)', () => {
  const conIa = FRASES.filter((f) => /\bIA\b|inteligencia artificial|Revisión rápida/i.test(f))
  expect(conIa, conIa.join('\n')).toEqual([])
  const pro = PLANES_EMPRESA.find((p) => p.clave === 'completo')
  expect(pro.incluye.join(' ')).not.toMatch(/IA|Revisión rápida/)
})

/* El texto que se ve, sin el selector de idioma (que lleva los nombres de todos los idiomas). */
const textoVisible = (page) => page.evaluate(() => {
  const c = document.body.cloneNode(true)
  c.querySelectorAll('#ld-idioma, script, style').forEach((n) => n.remove())
  return c.innerText
})

for (const [i, lang] of ORDEN.entries()) {
  test(`/planes en ${lang}: lo de cada plan, los complementos y las preguntas, traducidos; ni una frase de los planes en español`, async ({ page }) => {
    await page.addInitScript((l) => { try { localStorage.setItem('fds_idioma', l) } catch { /* nada */ } }, lang)
    await simularApi(page, 'vacio')
    await page.goto('/planes', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('plan-incluye').first()).toContainText(DIC[PLANES_EMPRESA[0].incluye[0]][i])
    await expect(page.getByTestId('planes-en-espanol')).toHaveCount(0)
    await expect(page.locator('[lang="es"]')).toHaveCount(0)
    const texto = await textoVisible(page)
    // «Para quién es» Reparto no se pinta en /planes (lo dice su titular); sí en el alta del súper (registro.spec.js).
    for (const f of FRASES.filter((x) => x !== PLAN_REPARTO.para)) {
      const traducida = DIC[f][i]
      expect(texto, `${lang}: «${traducida}»`).toContain(traducida)
      // Las que se escriben igual en los dos idiomas («Pro», «WhatsApp») no dicen nada.
      if (traducida !== f) expect(texto, `${lang}: en español «${f}»`).not.toContain(f)
    }
  })
}

test('/planes con el servidor contestando: sus frases (las mismas de lib/precios.js) también salen traducidas', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'en') } catch { /* nada */ } })
  await simularApi(page, 'vacio')
  await page.route('**/api/billing/planes', (r) => r.fulfill({ json: {
    desde_empresa: 12, descuentos_volumen: [{ desde: 50, pct: 10 }, { desde: 150, pct: 15 }, { desde: 300, pct: 20 }],
    planes: [...PLANES_EMPRESA, PLAN_REPARTO].map(({ color: _c, ...p }) => p), complementos: COMPLEMENTOS } }))
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Everything in Essential, with unlimited depots and a manager per depot')).toBeVisible()
  await expect(page.getByTestId('planes-complementos')).toContainText('Partner vehicles')
  await expect(page.getByTestId('planes-reglas')).toContainText('Is there a minimum term?')
  expect(await textoVisible(page)).not.toMatch(/Todo lo de Esencial|Vehículos de colaboradores/)
})

test('/planes en español: sigue diciendo lo mismo que el servidor, sin la línea de la IA', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'es') } catch { /* nada */ } })
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Todo lo de Esencial, con sedes ilimitadas y un jefe por sede')).toBeVisible()
  await expect(page.getByText('Informe firmado de la revisión en PDF, con sus fotos, su fecha y su código de comprobación, sin límite')).toBeVisible()
  const texto = await textoVisible(page)
  expect(texto).not.toMatch(/\bIA\b|Revisión rápida|están en español/)
})

/* ── Las fotos (solo con FOTOS_PUBLICO=<carpeta>) ── */
const CARPETA = process.env.FOTOS_PUBLICO
test.describe('fotos de /planes', () => {
  test.skip(!CARPETA, 'solo con FOTOS_PUBLICO')
  for (const lang of ['es', 'en', 'de']) {
    for (const ancho of [1280, 390]) {
      test(`/planes en ${lang} a ${ancho}`, async ({ page }) => {
        await page.addInitScript((l) => {
          localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' }))
          localStorage.setItem('fds_idioma', l)
        }, lang)
        await page.setViewportSize({ width: ancho, height: ancho > 500 ? 900 : 844 })
        await simularApi(page, 'vacio')
        await page.goto('/planes', { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1000)
        fs.mkdirSync(CARPETA, { recursive: true })
        await page.screenshot({ path: path.join(CARPETA, `planes-${lang}-${ancho}.png`), fullPage: true })
      })
    }
  }
})

/* ── TANDA 4 DE DISEÑO (14-11-2026, hallazgo 14): /planes como una hoja de tarifas, no la plantilla de tarjetas. ── */
test('tanda 4 · la hoja: columnas con reglas y las filas alineadas, el recomendado con su regla de tinta, cifras en mono, sin cajas ni insignias', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  const hoja = page.getByTestId('planes-hoja')
  const cols = hoja.locator('[data-plan]')
  await expect(cols).toHaveCount(3)
  // Sin tarjetas: ni fondo propio ni esquinas redondeadas; separadas por una regla de 1 px.
  for (const c of await cols.all()) {
    const [fondo, radio] = await c.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopLeftRadius])
    expect(fondo).toBe('rgba(0, 0, 0, 0)')
    expect(radio).toBe('0px')
  }
  expect(await cols.nth(1).evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe('1px')
  // Las filas, alineadas: el nombre, el botón y lo que lleva empiezan a la misma altura en las tres columnas.
  for (const sel of ['h2', 'a[href]', '[data-testid="plan-incluye"], ul']) {
    const ys = await Promise.all((await cols.all()).map((c) => c.locator(sel).first().boundingBox().then((b) => Math.round(b.y))))
    expect(Math.max(...ys) - Math.min(...ys), sel).toBeLessThanOrEqual(1)
  }
  // El recomendado (Pro): una regla de tinta de 2 px encima y la palabra, sin insignia (sin caja de color).
  await expect(page.getByTestId('plan-regla-recomendado')).toHaveCount(1)
  const regla = page.getByTestId('plan-regla-recomendado')
  expect(await regla.evaluate((e) => [e.closest('[data-plan]').dataset.plan, getComputedStyle(e).height])).toEqual(['completo', '2px'])
  const recomendado = cols.nth(1).getByText('Recomendado', { exact: true })
  expect(await recomendado.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // Las cifras, en Plex Mono tabular.
  const cifra = cols.first().locator('p').filter({ hasText: '/mes' }).locator('span').first()
  expect(await cifra.evaluate((e) => [getComputedStyle(e).fontFamily, getComputedStyle(e).fontVariantNumeric])).toEqual([expect.stringContaining('IBM Plex Mono'), 'tabular-nums'])
  // Nada de ✓ ni ✕: lo que no lleva va aparte, en gris.
  expect(await hoja.innerText()).not.toMatch(/[✓✔✕✗]/)
  await expect(cols.first()).toContainText('No incluye')
})

test('tanda 4 · la oferta fundador es una línea de texto: sin caja ámbar ni insignia', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.route('**/api/founder/slots', (r) => r.fulfill({ json: { total: 10, left: 7 } }))
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  const oferta = page.getByTestId('planes-fundador')
  await expect(oferta).toContainText('Oferta fundador · quedan 7 de 10 plazas.')
  const ambar = await oferta.evaluate((e) => [e, ...e.querySelectorAll('*')].filter((n) => {
    const c = getComputedStyle(n)
    return /255, 194, 51/.test(c.backgroundColor) || /255, 194, 51/.test(c.borderTopColor) || /255, 194, 51/.test(c.borderLeftColor)
  }).length)
  expect(ambar).toBe(0)
  expect(await oferta.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // Reservar sigue abriendo el formulario.
  await page.getByRole('button', { name: /Reservar mi plaza fundador/ }).click()
  await expect(oferta.getByRole('button', { name: 'Confirmar la reserva' })).toBeVisible()
})

test('tanda 4 · complementos y «Cómo se cuenta» son listas con reglas, no rejillas de tarjetas; la cabecera es la de la portada', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  for (const id of ['planes-complementos', 'planes-reglas']) {
    // /planes llega en un trozo aparte: hasta que está pintada, count() da 0 (no espera). Primero, que se vea.
    await expect(page.getByTestId(id)).toBeVisible()
    const filas = page.getByTestId(id).locator(':scope > *')
    await expect.poll(() => filas.count()).toBeGreaterThan(3)
    for (const f of await filas.all()) {
      expect(await f.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopWidth, getComputedStyle(e).borderTopLeftRadius])).toEqual(['rgba(0, 0, 0, 0)', '1px', '0px'])
    }
  }
  await expect(page.getByTestId('emp-cabecera')).toBeVisible()
  await expect(page.getByTestId('emp-probar-menu')).toHaveAttribute('href', '/registro?sector=otra&plan=operacion&flota=40')
})

/* TANDA 5 (14-11-2026, U3 y U6): las cifras de los complementos en Plex Mono tabular, como las de arriba; y las frases
   de los planes, de tú y con «revisión». */
test('tanda 5 · las cifras de «Complementos», en Plex Mono tabular; el resto de la frase, en la letra de la casa', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  const precios = page.getByTestId('complemento-precio')
  await expect(precios).toHaveCount(COMPLEMENTOS.length)
  for (const p of await precios.all()) {
    const r = await p.evaluate((e) => {
      // Todos los trozos de texto, también los de dentro de la «cola» que no se parte (tanda 6, «Meta + 20 %»).
      const textos = []
      for (let w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n = w.nextNode(); n; n = w.nextNode()) textos.push(n)
      const sueltas = textos.filter((n) => /\d/.test(n.textContent) && !n.parentElement.classList.contains('font-mono')).map((n) => n.textContent)
      const cifras = [...e.querySelectorAll('span:not([data-cola])')].map((s) => [s.textContent, getComputedStyle(s).fontFamily, getComputedStyle(s).fontVariantNumeric])
      return { sueltas, cifras, letra: getComputedStyle(e).fontFamily }
    })
    expect(r.sueltas, 'ninguna cifra fuera de su pieza mono').toEqual([])
    expect(r.cifras.length).toBeGreaterThan(0)
    for (const [t, f, v] of r.cifras) {
      expect(t).toMatch(/^\d+([.,]\d+)*$/)
      expect(f).toContain('IBM Plex Mono')
      expect(v).toBe('tabular-nums')
    }
    expect(r.letra).not.toContain('IBM Plex Mono')
  }
  await expect(precios.first()).toHaveText('6 € por conductor que la use en el mes')
})

test('tanda 5 · los planes hablan de tú y dicen «revisión», nunca «inspección»', async ({ page }) => {
  expect(FRASES.filter((f) => /(?<!\p{L})(vuestr\p{L}*|vosotros|os|sois|tenéis|repartís|elijáis)(?!\p{L})|inspecci[oó]n/iu.test(f))).toEqual([])
  await simularApi(page, 'vacio')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('planes-complementos')).toBeVisible()
  const texto = await textoVisible(page)
  expect(texto).not.toMatch(/(?<!\p{L})(vuestr\p{L}*|vosotros|os|sois|tenéis|repartís|elijáis)(?!\p{L})|inspecci[oó]n/iu)
  await expect(page.getByTestId('planes-complementos')).toContainText('Furgonetas de subcontratas: revisión, documentos y vencimientos.')
})

for (const ancho of [360, 390]) {
  test(`tanda 4 · /planes a ${ancho} px en alemán: nada se sale por el lado`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 })
    await page.addInitScript(() => { try { localStorage.setItem('fds_idioma', 'de') } catch { /* nada */ } })
    await simularApi(page, 'vacio')
    await page.goto('/planes', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('planes-hoja')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho)
    const fuera = await page.evaluate((w) => [...document.querySelectorAll('[data-testid="planes"] *')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 0.5 }).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`), ancho)
    expect(fuera, fuera.join(' | ')).toEqual([])
  })
}

/* TANDA 6: «+ 20 %» no cae solo en una línea. La frase es letra a letra la del servidor; lo que se mide es dónde parte:
   la cifra, su «+» y su «%» van en la misma línea que la palabra de antes («Meta»), en los dos anchos y en dos idiomas. */
for (const ancho of [1280, 390]) {
  test(`tanda 6 · a ${ancho} px «+ 20 %» va con la palabra de antes, no solo en una línea`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await simularApi(page, 'vacio')
    for (const l of ['es', 'pt']) {
      await page.addInitScript((x) => { try { localStorage.setItem('fds_idioma', x) } catch { /* nada */ } }, l)
      await page.goto('/planes', { waitUntil: 'domcontentloaded' })
      await page.evaluate(() => document.fonts.ready)
      const wa = page.getByTestId('complemento-precio').filter({ hasText: 'Meta' })
      await expect(wa).toHaveCount(1)
      const frase = COMPLEMENTOS.find((c) => c.clave === 'whatsapp').precio
      await expect(wa).toHaveText(l === 'es' ? frase : DIC[frase][ORDEN.indexOf(l)])
      const r = await wa.evaluate((e) => {
        const cola = e.querySelector('[data-cola]')
        const rg = document.createRange()
        rg.selectNodeContents(cola)
        // Las líneas de verdad: la cifra en mono tiene otra caja que la letra de la casa, así que se agrupan por media línea.
        const alto = parseFloat(getComputedStyle(e).lineHeight)
        const tops = [...rg.getClientRects()].filter((x) => x.width > 0).map((x) => x.top).sort((a, b) => a - b)
        return { cola: cola.textContent, lineas: tops.filter((t, i) => i === 0 || t - tops[i - 1] > alto / 2).length }
      })
      expect(r.cola).toMatch(/^Meta\s+\+\s*20\s*%$/)
      expect(r.lineas, `${l}: «${r.cola}» partido`).toBe(1)
    }
  })
}
