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
  await expect(page.getByText('Todo lo de Esencial, con delegaciones ilimitadas y un jefe por delegación')).toBeVisible()
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
