import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA MEMORIA DE LA CALLE (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §3), con la API simulada: desde la parada,
   «Guardar para la próxima» apunta el código del portal (si el cliente lo dio en su enlace, ya viene puesto), dónde
   dejarlo y cómo se entra; la tarjeta lo enseña, el briefing lo dice y se puede borrar. Nada de red de verdad. */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

test.describe('la memoria de la calle', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
    geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('se guarda desde la parada, la tarjeta lo enseña, el briefing lo dice y se borra', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
      localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
      localStorage.setItem('ruta_vista', 'lista')
      // La voz del navegador se apunta en vez de hablarse.
      window.__dicho = []
      Object.defineProperty(window, 'speechSynthesis', { value: { cancel() {}, getVoices() { return [] }, speak(u) { window.__dicho.push(u.text) } } })
      window.SpeechSynthesisUtterance = function (t) { this.text = t }
    })
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const fin = new Date(Date.now() + 30 * 86400000).toISOString()
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
      plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
      precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
    let p1 = { id: 'p1', codigo: 'COD1', cliente: 'Bea Castro', direccion: 'Rúa Real 22, A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
      lat: 43.36, lng: -8.41, cobrar: 0, notas: '', telefono: '',
      cliente_dice: { estare: 'no', dejar: 'vecino', franja: null, portal: '4321', nota: '', cuando: '2026-11-01T08:00:00Z' } }
    const guardado = []
    await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
      activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null,
      ruta: { fin: '10:30', minutos: 25, km: 3, trafico: true }, pedidos: [p1] } }))
    await page.route(/\/api\/reparto\/mis-pedidos\/p1\/memoria$/, (r) => {
      const b = r.request().postDataJSON()
      guardado.push(b)
      const memoria = b.portal || b.dejar || b.acceso ? { ...b, por: 'Ana', actualizado: new Date().toISOString() } : null
      p1 = { ...p1, memoria: memoria || undefined }
      r.fulfill({ json: { ok: true, memoria } })
    })
    await page.goto('/ruta', { waitUntil: 'networkidle' })

    // Sin memoria: el botón; la hoja trae el portal que dio el cliente.
    await page.getByRole('button', { name: 'Guardar para la próxima' }).click()
    const hoja = page.getByRole('dialog', { name: 'Memoria de la puerta' })   // la hoja compacta (07-11-2026): «Guardar» / «Borrar» y los chips cortos
    await expect(hoja).toContainText('Rúa Real 22, A Coruña')
    await expect(hoja.getByLabel('Código del portal')).toHaveValue('4321')
    await hoja.getByLabel('Código del portal').fill('1234B')
    await hoja.getByRole('button', { name: 'Portería', exact: true }).click()
    await hoja.getByLabel('Cómo se entra').fill('Entrada por el garaje')
    await hoja.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(hoja).toHaveCount(0)
    expect(guardado).toEqual([{ portal: '1234B', dejar: 'porteria', acceso: 'Entrada por el garaje' }])
    await expect(page.getByText('Guardado para la próxima vez en esta puerta.')).toBeVisible()
    // La tarjeta lo enseña y el briefing lo dice.
    const memoria = page.getByTestId('memoria')
    await expect(memoria).toContainText('Memoria de la puerta: portal 1234B, dejar en portería o recepción, Entrada por el garaje')
    await page.getByRole('button', { name: 'Escuchar la siguiente parada' }).click()
    const dicho = await page.evaluate(() => window.__dicho)
    expect(dicho.at(-1)).toContain('Siguiente parada: Bea Castro, Rúa Real 22, A Coruña')
    expect(dicho.at(-1)).toContain('portal 1234B, dejar en portería o recepción, Entrada por el garaje')
    // Se abre para corregir, con lo guardado; «Borrar lo guardado» manda todo vacío y vuelve el botón.
    await memoria.click()
    await expect(hoja.getByLabel('Cómo se entra')).toHaveValue('Entrada por el garaje')
    await hoja.getByRole('button', { name: 'Borrar', exact: true }).click()
    await expect(hoja).toHaveCount(0)
    expect(guardado.at(-1)).toEqual({})
    await expect(page.getByRole('button', { name: 'Guardar para la próxima' })).toBeVisible()
    await expect(page.getByTestId('memoria')).toHaveCount(0)
  })
})
