import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ────────────────────────────────────────────────────────────────────────────
   QUE TODO SE LEA, EN LOS TRES TEMAS, PREGUNTÁNDOSELO A UN NAVEGADOR.

   Por qué existe, si ya está `check-contraste.mjs`. Aquel lee el código: casa
   las clases que van JUNTAS en el mismo `className` (`bg-dark-900
   text-dark-400`), las resuelve a color y aplica la fórmula de la WCAG. Es
   rápido, no necesita navegador y caza muchísimo — pero tiene un hueco por
   construcción: **el texto que no declara su fondo**. Un `text-dark-600`
   suelto hereda el fondo de un ancestro que puede estar cinco niveles más
   arriba, y eso desde el código no se sabe.

   Ese hueco costó caro. El 21-09-2026, con el checker en verde, axe-core
   encontró en producción **54 fallos de contraste en el tema Noche y 92 en el
   tema Día** — y ni uno en Mixto, que es el que se usa por defecto, así que
   nadie los había visto. Casi todos el mismo token: `text-dark-600`, que en
   modo noche es `#48515f` y da **2,39:1** sobre la tarjeta, cuando el mínimo
   legible es 4,5:1.

   Este test cierra ese hueco: renderiza de verdad, con los tres temas, y deja
   que el navegador calcule el color real de cada texto y el de lo que tiene
   detrás. Los dos checkers se complementan; ninguno sobra.

   LO QUE ESTE TEST *NO* CUBRE, para que nadie se confíe: corre con la API
   simulada, así que ve las pantallas con los datos de prueba, no con los de
   una flota real. Un texto que solo aparece con ciertos datos puede
   escapársele. Por eso la medida de verdad se hizo contra producción.
   ──────────────────────────────────────────────────────────────────────────── */

const require_ = createRequire(import.meta.url)
const AXE = fs.readFileSync(
  path.join(path.dirname(require_.resolve('axe-core/package.json')), 'axe.min.js'), 'utf8')

// Las pantallas donde más texto secundario hay. No están todas a propósito:
// esto corre en cada CI y tiene que tardar poco.
/* `ordenes` y `turnos` entraron el 21-09-2026 y no por casualidad: eran
   de las que NO respetaban el tema. Ordenes pintaba su
   contenedor raíz con un `bg-[#F2F4F7]` escrito a pelo, así que en modo Noche
   salían enteras en blanco con el texto claro encima; la tercera tenía la
   cebra de filas en negro fijo, que de día es una fila negra sobre papel. Un
   color literal no cambia con el tema, y por eso hay que mirarlas aquí. */
const PANTALLAS = ['', 'vehiculos', 'vencimientos', 'incidencias',
  'conductores', 'ordenes', 'asignacion', 'turnos']
const TEMAS = ['hibrido', 'dark', 'light']

test.describe('contraste real en los tres temas', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe solo en chromium')

  test('ningún texto por debajo del mínimo legible', async ({ page }) => {
    test.setTimeout(240_000)
    // `addInitScript` y no `addScriptTag`: el sitio sirve una CSP estricta
    // (`script-src 'self'`) y un script externo se queda fuera. Este entra
    // antes de que cargue el documento, por el protocolo del navegador.
    await page.addInitScript({ content: AXE })
    /* SIN ANIMACIONES DE ENTRADA, O SE MIDE EL COLOR EQUIVOCADO.
       El panel entra con un `fadeIn` de opacidad. Si axe mira mientras se
       está fundiendo, ve el color COMPUESTO contra el fondo, no el de verdad:
       medido aquí mismo, un `text-dark-500` que es `#7d8695` (5,83:1, pasa de
       sobra) se leía como `#2b313c` y daba 1,51:1. Ese falso positivo es tan
       inútil como el falso negativo de esperar un rato fijo y medir antes de
       que se aplique el tema. Con la duración a cero, la animación termina
       instantáneamente y queda su estado FINAL, que es el que ve una persona
       sentada delante. */
    await page.addInitScript({ content: `
      const e = document.createElement('style')
      e.textContent = '*,*::before,*::after{animation-duration:0s!important;'
        + 'animation-delay:0s!important;transition-duration:0s!important;'
        + 'transition-delay:0s!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(e))
    ` })
    await simularApi(page, 'lleno')
    await entrarComoAdmin(page)

    const fallos = []
    for (const tema of TEMAS) {
      for (const ruta of PANTALLAS) {
        /* SE ELIGE EL TEMA Y SE RECARGA, en vez de cambiarlo sobre la marcha
           y esperar un rato. Con una espera fija esto falló una vez —y solo
           una— al correr junto a los otros 147 tests y a la suite de Python:
           la máquina iba cargada, el panel aún no había aplicado el tema y
           axe midió colores a medio camino. Un checker que parpadea es peor
           que no tenerlo, porque el día que acierte nadie lo va a creer.
           Así el panel arranca ya con su tema y no hay carrera que valga. */
        await page.goto(`/panel/${ruta}`, { waitUntil: 'domcontentloaded' })
        await page.evaluate((t) => {
          try {
            localStorage.setItem('panel_theme', t)
            localStorage.setItem('panel_theme_elegido', '1')
          } catch { /* incógnito */ }
        }, tema)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForFunction(
          (t) => document.documentElement.getAttribute('data-panel-theme') === t,
          tema, { timeout: 20_000 })
        // Y que haya algo pintado: medir una pantalla en blanco da cero
        // fallos y una falsa tranquilidad.
        await page.waitForFunction(
          () => ((document.querySelector('main')?.innerText) || '').trim().length > 40,
          null, { timeout: 20_000 })

        const malos = await page.evaluate(async () => {
          if (!window.axe) return [{ msg: 'axe no se cargó', html: '' }]
          const r = await window.axe.run(document, {
            runOnly: { type: 'rule', values: ['color-contrast'] },
          })
          return r.violations.flatMap((v) => v.nodes.map((n) => ({
            msg: (n.any?.[0]?.message || '').slice(0, 110),
            html: (n.html || '').replace(/\s+/g, ' ').slice(0, 150),
          })))
        })
        for (const m of malos) fallos.push(`[${tema}] /${ruta || 'inicio'} · ${m.msg} · ${m.html}`)
      }
    }

    // El mensaje lleva los casos dentro: un «esperaba 0, había 17» obliga a
    // repetir a mano toda la medición para saber cuáles son.
    expect(fallos.join('\n') || 'sin fallos', `${fallos.length} textos por debajo de 4,5:1`)
      .toBe('sin fallos')
  })

  /* QUE EL MEDIDOR SEPA FALLAR.
     Este test existe porque el de arriba dio «0 fallos» dos veces por motivos
     distintos y ninguno bueno: la primera esperaba un rato fijo y medía antes
     de que se aplicara el tema; la segunda medía a media animación y daba
     fallos que no eran. Un verde puede significar «está bien» o «no estoy
     mirando», y desde fuera se ven igual. Así que se le pone delante un texto
     que es ilegible con toda seguridad: si no lo caza, el verde del otro test
     no vale nada y hay que mirar el instrumento, no la app. */
  test('el medidor caza un texto ilegible puesto a propósito', async ({ page }) => {
    await page.addInitScript({ content: AXE })
    await simularApi(page, 'lleno')
    await entrarComoAdmin(page)
    await page.goto('/panel/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => !!document.querySelector('main'), null, { timeout: 20_000 })
    await page.evaluate(() => {
      const d = document.createElement('p')
      d.textContent = 'gris sobre gris, ilegible a propósito'
      d.style.cssText = 'color:#8a8a8a;background:#909090;font-size:13px;padding:8px'
      document.querySelector('main').appendChild(d)
    })
    const n = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      })
      return r.violations.reduce((t, v) => t + v.nodes.length, 0)
    })
    expect(n, 'axe no vio un texto claramente ilegible: el medidor no mide')
      .toBeGreaterThan(0)
  })

  /* LA APP DE RUTA (10-10-2026). El repartidor nuevo la abre sin paquetes y el
     botón que le deja probarla —«Verlo en acción con 3 paradas de ejemplo»— salía
     en fucsia casi blanco sobre papel en el tema por defecto (híbrido), igual que
     «Gana 5 € por cada compañero». Cuatro altas de un anuncio llegaron ahí ese día y
     ninguna lo pulsó. Se mira vacía y con paradas de ejemplo, en los tres temas. */
  test('la app de ruta se lee vacía y con paradas de ejemplo', async ({ page }) => {
    test.setTimeout(180_000)
    await page.addInitScript({ content: AXE })
    await page.addInitScript({ content: `
      const e = document.createElement('style')
      e.textContent = '*,*::before,*::after{animation-duration:0s!important;'
        + 'animation-delay:0s!important;transition-duration:0s!important;'
        + 'transition-delay:0s!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(e))
    ` })
    await entrarComoAdmin(page)
    // El aviso de cookies tapa la barra de pestañas: se da por contestado en cada carga.
    await page.addInitScript(() => {
      try { localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-10T00:00:00Z' })) } catch { /* nada */ }
    })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
      status: 'trial', days_left: 7, plan: 'autonomo', sector: 'autonomo',
      modulos: ['dashboard', 'reparto', 'configuracion'], promo: { activa: true, hasta: '2026-12-31' } } }))
    let pedidos = []
    await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
      activo: true, autonomo: true, fecha: '2026-10-10', pedidos, base: null, ia_tickets: false, jornada: {}, aviso_aceptado: true } }))
    const EJEMPLOS = [1, 2, 3].map((n) => ({
      id: `e${n}`, cliente: `Cliente de ejemplo ${n}`, direccion: `Calle de ejemplo ${n}`, estado: 'pendiente',
      orden: n, ejemplo: true, bultos: 1, lat: 43.36 + n / 1000, lng: -8.41, geo: 'ok' }))

    const fallos = []
    for (const conEjemplos of [false, true]) {
      pedidos = conEjemplos ? EJEMPLOS : []
      for (const tema of TEMAS) {
        await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
        await page.evaluate((t) => {
          try {
            localStorage.setItem('panel_theme', t)
            localStorage.setItem('panel_theme_elegido', '1')
          } catch { /* incógnito */ }
        }, tema)
        await page.reload({ waitUntil: 'domcontentloaded' })
        // Fuera del panel el tema noche no pone atributo: es el CSS de base.
        await page.waitForFunction(
          (t) => (document.documentElement.getAttribute('data-panel-theme') || 'dark') === t, tema, { timeout: 20_000 })
        // La app recuerda la última pestaña: se vuelve a «Hoy».
        await page.getByRole('button', { name: 'Hoy', exact: true }).click()
        await expect(page.getByText(conEjemplos ? 'Estas paradas son de ejemplo.' : 'Verlo en acción con 3 paradas de ejemplo')).toBeVisible()
        const medir = () => page.evaluate(async () => {
          const r = await window.axe.run(document.querySelector('main') || document, {
            runOnly: { type: 'rule', values: ['color-contrast'] },
          })
          return r.violations.flatMap((v) => v.nodes.map((n) => ({
            msg: (n.any?.[0]?.message || '').slice(0, 110),
            html: (n.html || '').replace(/\s+/g, ' ').slice(0, 150),
          })))
        })
        for (const m of await medir()) fallos.push(`[${tema}] /ruta ${conEjemplos ? 'con ejemplos' : 'vacía'} · ${m.msg} · ${m.html}`)
        // Las otras pestañas, una vez por tema (con la ruta vacía basta).
        if (!conEjemplos) {
          for (const pestana of ['Historial', 'Ajustes', 'Cuenta']) {
            await page.getByRole('button', { name: pestana, exact: true }).click()
            await page.waitForFunction(() => ((document.querySelector('main')?.innerText) || '').trim().length > 40, null, { timeout: 20_000 })
            await page.waitForTimeout(400)
            for (const m of await medir()) fallos.push(`[${tema}] /ruta ${pestana} · ${m.msg} · ${m.html}`)
          }
        }
      }
    }
    expect(fallos.join('\n') || 'sin fallos', `${fallos.length} textos por debajo de 4,5:1`).toBe('sin fallos')
  })
})
