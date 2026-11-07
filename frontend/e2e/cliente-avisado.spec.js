import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* EL CLIENTE AVISADO, LA PROPINA Y LA VALORACIÓN (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §6), con la API simulada:
   en el enlace del cliente, ya entregado, «¿Cómo ha ido?» de un toque y el Bizum del repartidor para la propina; y en
   la ruta, con la ruta ordenada, «Avisar a todos por WhatsApp», uno a uno, que recuerda a quién se avisó. */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

test.describe('el cliente avisado, la propina y la valoración', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
    geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('el cliente valora de un toque y ve el Bizum del repartidor solo con el paquete en la mano', async ({ page }) => {
    let estado = { empresa: 'Ana reparte', estado: 'pendiente', fecha: HOY, eta: '10:20', franja: null, paradas_antes: 1, tipo: 'entrega',
      dejado: null, respuesta: null, puede_contestar: true, intento: null, verificada: false, valoracion: null, puede_valorar: false, bizum: '' }
    const valoraciones = []
    await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: estado }))
    await page.route(/\/api\/seguimiento\/tok1234567890abcdef\/valoracion$/, async (r) => {
      const b = r.request().postDataJSON()
      valoraciones.push(b)
      estado = { ...estado, valoracion: { estrellas: b.estrellas, cuando: new Date().toISOString() } }
      await r.fulfill({ json: { ok: true, valoracion: estado.valoracion } })
    })
    await page.goto('/s/tok1234567890abcdef', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('En reparto')).toBeVisible()
    await expect(page.getByTestId('valoracion')).toHaveCount(0)
    // Entregado: las estrellas y el Bizum.
    estado = { ...estado, estado: 'entregado', puede_contestar: false, dejado: 'En el buzón', puede_valorar: true, bizum: '612345678' }
    await page.reload({ waitUntil: 'domcontentloaded' })
    const caja = page.getByTestId('valoracion')
    await expect(caja).toContainText('¿Cómo ha ido la entrega?')
    await expect(caja).toContainText('¿Le invitas a un café? Bizum al 612 345 678')
    await caja.getByRole('radio', { name: '5 estrellas' }).click()
    await expect(caja).toContainText('Gracias por valorar la entrega')
    await expect(caja.getByRole('radio', { name: '5 estrellas' })).toHaveAttribute('aria-checked', 'true')
    expect(valoraciones).toEqual([{ estrellas: 5 }])
    await caja.getByRole('button', { name: 'Copiar el número' }).click()
    await expect(caja.getByRole('button', { name: 'Copiado' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('612345678')
    // Se puede cambiar. La petición se espera (03-11-2026): sin esperar, 1 de cada 80 con carga aún no había llegado.
    await caja.getByRole('radio', { name: '4 estrellas' }).click()
    await expect.poll(() => valoraciones.at(-1)).toEqual({ estrellas: 4 })
  })

  test('con la ruta ordenada, «Avisar a todos por WhatsApp» va uno a uno y recuerda a quién', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
      localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
      localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
    })
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const fin = new Date(Date.now() + 30 * 86400000).toISOString()
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
      plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
      precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
    const pedidos = [
      { id: 'p1', codigo: 'COD1', cliente: 'Bea Castro', direccion: 'Rúa Real 22', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.36, lng: -8.41, cobrar: 0, notas: '', telefono: '612 345 678', seguimiento: 'tokAAAAAAAAAAAAAAAAA' },
      { id: 'p2', codigo: 'COD2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:20', lat: 43.361, lng: -8.411, cobrar: 0, notas: '', telefono: '' },
      { id: 'p3', codigo: 'COD3', cliente: 'Luis Varela', direccion: 'Avda. Montero Ríos 12', estado: 'pendiente', bultos: 1, orden: 3, eta: '10:40', lat: 43.362, lng: -8.412, cobrar: 0, notas: '', telefono: '698112233' },
    ]
    await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
      activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, pais: 'es', prefijo: '34',
      ruta: { fin: '11:00', minutos: 45, km: 6, trafico: true }, pedidos } }))
    // Los WhatsApp no salen de verdad: se contestan en blanco.
    const abiertos = []
    await context.route(/^https:\/\/wa\.me\//, (r) => { abiertos.push(r.request().url()); r.fulfill({ body: 'ok', contentType: 'text/plain' }) })
    await page.goto('/ruta', { waitUntil: 'networkidle' })
    const boton = page.getByRole('button', { name: /Avisar a todos por WhatsApp/ })
    await expect(boton).toContainText('0 de 2 avisados')
    await boton.click()
    const hoja = page.getByRole('dialog', { name: 'Avisar a todos por WhatsApp' })
    await expect(hoja.getByRole('link', { name: 'WhatsApp' })).toHaveCount(2)
    await expect(hoja).toContainText('1. Bea Castro')
    await expect(hoja).not.toContainText('Bar Pepe')
    const enlace = hoja.getByRole('link', { name: 'WhatsApp' }).first()
    const href = await enlace.getAttribute('href')
    expect(href).toMatch(/^https:\/\/wa\.me\/34612345678\?text=/)
    expect(decodeURIComponent(href)).toContain('llegada aproximada a las 10:05')
    expect(decodeURIComponent(href)).toContain('/s/tokAAAAAAAAAAAAAAAAA')
    const [popup] = await Promise.all([context.waitForEvent('page'), enlace.click()])
    await popup.close()
    await expect(hoja.getByText('Avisado')).toHaveCount(1)
    await expect(hoja.getByRole('link', { name: 'WhatsApp' })).toHaveCount(1)
    await hoja.getByRole('button', { name: 'Cerrar' }).click()
    await expect(boton).toContainText('1 de 2 avisados')
    // Se recuerda al volver a abrir la app.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: /Avisar a todos por WhatsApp/ })).toContainText('1 de 2 avisados')
  })
})
