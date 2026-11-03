/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA ENTREGA VERIFICADA (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §4), con la API simulada: al entregar con foto, el
   servidor contesta con lo que dijo la IA; si pide mirar la foto, la app lo pregunta ahí mismo (repetirla o dejarla),
   nunca bloquea; lo hecho enseña el veredicto y deja repetir la foto; y el cliente ve «entrega verificada» en su
   enlace solo con el veredicto bueno. Sin red de verdad: ni servidor ni IA. */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

test.describe('la entrega verificada', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
    geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('la IA pide mirar la foto, se repite y queda verificada', async ({ page }) => {
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
    let p1 = { id: 'p1', codigo: 'COD1', cliente: 'Bea', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1, lat: 43.36, lng: -8.41,
      cobrar: 0, notas: '', telefono: '' }
    const estados = []
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
      activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: {}, pedidos: [p1] } }))
    await page.route(/\/api\/reparto\/pedidos\/p1\/estado$/, (r) => {
      const b = r.request().postDataJSON()
      estados.push(b)
      const n = estados.filter((x) => x.foto).length
      p1 = { ...p1, estado: b.estado, cerrado_en: b.estado === 'entregado' ? new Date().toISOString() : null,
        entrega_ia: b.foto ? (n === 1 ? { nivel: 'revisar', aviso: 'otro_numero', numero: '7', portal: '5' } : { nivel: 'verificada', aviso: null, numero: '5', portal: '5' }) : p1.entrega_ia }
      r.fulfill({ json: p1 })
    })
    await page.goto('/ruta', { waitUntil: 'networkidle' })
    // Una foto de verdad (un JPEG pequeño pintado en un canvas): la app la comprime antes de mandarla.
    const jpeg = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16
      const g = c.getContext('2d'); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 16, 16)
      return c.toDataURL('image/jpeg', 0.8).split(',')[1]
    })
    const foto = { name: 'puerta.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') }

    // Entregar con foto: la IA lee el 7 y la parada es el 5 → la app pregunta, sin bloquear.
    await page.getByRole('button', { name: 'Entregado', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Prueba de entrega' }).locator('input[type=file]').setInputFiles(foto)
    const revisar = page.getByRole('heading', { name: 'Mira la foto de entrega' })
    await expect(revisar).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Mira la foto de entrega' })).toContainText('En la foto se lee el número 7 y la parada es el 5: comprueba que es la puerta buena.')
    expect(estados).toHaveLength(1)
    expect(estados[0].estado).toBe('entregado')
    expect(estados[0].foto).toMatch(/^data:image\/jpeg;base64,/)
    // «Está bien así» la deja; en lo hecho queda el aviso y «Repetir la foto».
    await page.getByRole('button', { name: 'Está bien así' }).click()
    await expect(revisar).toHaveCount(0)
    await page.getByText('1 hechos hoy').click()
    const hecha = page.locator('details').filter({ hasText: 'Bea' })
    await expect(hecha).toContainText('En la foto se lee el número 7 y la parada es el 5')
    await hecha.getByRole('button', { name: /Repetir la foto/ }).click()
    await expect(revisar).toBeVisible()
    // Repetirla: la nueva foto va al servidor con la parada ya entregada, y vuelve «verificada».
    await page.getByRole('dialog', { name: 'Mira la foto de entrega' }).locator('input[type=file]').setInputFiles(foto)
    await expect(revisar).toHaveCount(0)
    expect(estados).toHaveLength(2)
    expect(estados[1].estado).toBe('entregado')
    expect(estados[1].foto).toMatch(/^data:image\/jpeg;base64,/)
    await expect(hecha).toContainText('Entrega verificada por IA')
    await expect(hecha).not.toContainText('Repetir la foto')
  })

  test('el cliente ve «entrega verificada» en su enlace solo con el veredicto bueno', async ({ page }) => {
    let estado = { empresa: 'Ana reparte', estado: 'entregado', fecha: HOY, eta: null, franja: null, paradas_antes: 0,
      tipo: 'entrega', dejado: 'En el buzón', respuesta: null, puede_contestar: false, intento: null, verificada: true }
    await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: estado }))
    await page.goto('/s/tok1234567890abcdef', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Entregado' })).toBeVisible()
    await expect(page.getByText('En el buzón')).toBeVisible()
    await expect(page.getByTestId('verificada')).toContainText('Entrega verificada: la foto enseña el paquete en tu dirección.')
    estado = { ...estado, verificada: false }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('En el buzón')).toBeVisible()
    await expect(page.getByTestId('verificada')).toHaveCount(0)
  })
})
