import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* UNA CUENTA SIN LA IA EN EL PANEL (14-11-2026, CONTRATO R10 y R11). Con `ia: false` en /org/billing, el servidor
   contesta 403 a las rutas que llaman a la IA; el panel no ofrece sus disparadores:
   - la burbuja del asistente (repaso-menu.spec.js lo prueba con el menú);
   - «Preguntar a la IA» en el buscador (POST /assistant/ask);
   - montar la hoja del día leyendo lo subido o pegado (POST /tools/plantilla-extraer); quedan «Usar la asignación» y
     «En blanco».
   Sin el campo (un servidor viejo) o con `ia: true`, todo como siempre. El chat del cuadrante NO se esconde: las
   órdenes que entienden las reglas siguen funcionando sin IA (R11). */

async function abrir(page, ruta, billing) {
  const pedidas = []
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  await page.route(/\/api\/org\/billing(\?|$)/, (r) => r.fulfill({ json: { plan: 'pro', status: 'active', modulos: null, ...billing } }))
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/')) pedidas.push(new URL(r.url()).pathname) })
  await page.goto(ruta, { waitUntil: 'domcontentloaded' })
  return pedidas
}

for (const [billing, conIA] of [[{ ia: false }, false], [{ ia: true }, true], [{}, true]]) {
  const nombre = JSON.stringify(billing)
  test(`Buscador · con ${nombre}, «Preguntar a la IA» ${conIA ? 'está' : 'no está'}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'el buscador se abre desde la barra de arriba del escritorio')
    const pedidas = await abrir(page, '/panel', billing)
    await page.getByTitle('Ctrl+K').click()
    const caja = page.getByPlaceholder('Buscar módulo, matrícula o conductor…')
    await caja.fill('¿cuántas furgonetas tienen la ITV vencida?')
    const preguntar = page.getByRole('button', { name: /Preguntar a la IA/ })
    if (conIA) await expect(preguntar).toBeVisible()
    else {
      await expect(page.getByText('Preguntar a la IA')).toHaveCount(0)
      // Intro sin ninguna fila no pregunta nada.
      await caja.press('Enter')
      await page.waitForTimeout(300)
      expect(pedidas.filter((p) => p.includes('/assistant/ask'))).toEqual([])
    }
  })

  test(`Hoja del día · con ${nombre}, leer lo subido o pegado ${conIA ? 'está' : 'no está'}`, async ({ page }) => {
    await abrir(page, '/panel/plantilla', billing)
    await expect(page.getByRole('button', { name: 'Usar la asignación' })).toBeVisible({ timeout: 30000 })
    // Las dos cajas de pegar (quién lleva qué furgoneta y las rutas) y el botón que las lee.
    await expect(page.getByPlaceholder(/Rodriguez Arias|ANDREA RODRIGUEZ/)).toHaveCount(conIA ? 2 : 0)
    await expect(page.getByRole('button', { name: 'Montar la hoja' })).toHaveCount(conIA ? 1 : 0)
  })
}
