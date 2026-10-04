import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* El repartidor puede corregir una parada (calle, cliente, teléfono, bultos…)
   y quitarla de su ruta (04-10-2026). Quitar pide un segundo toque. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

test('Ruta · editar una parada y quitarla con doble toque', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  let pedidos = [
    { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.36, lng: -8.41 },
    { id: 'p2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:16', lat: 43.37, lng: -8.40 },
  ]
  const editados = []
  const quitados = []
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mis-pedidos\/p1\/editar/, async (r) => {
    const b = r.request().postDataJSON(); editados.push(b)
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, cliente: b.cliente, direccion: b.direccion, bultos: Number(b.bultos), telefono: b.telefono } : p))
    await r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos\/p1\/quitar/, async (r) => {
    quitados.push('p1'); pedidos = pedidos.filter((p) => p.id !== 'p1'); await r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true }, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const sig = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(sig.getByText('Farmacia Sol')).toBeVisible()

  // Editar: se abre la hoja con los datos de la parada y sin la foto del ticket.
  await sig.getByRole('button', { name: /Editar parada: Farmacia Sol/ }).click()
  await expect(page.getByRole('heading', { name: 'Editar parada' })).toBeVisible()
  await expect(page.getByText('Foto del ticket')).toHaveCount(0)
  await page.getByPlaceholder('Dirección completa').fill('Avda. Montero Ríos 12, A Coruña')
  await page.getByPlaceholder('Cliente', { exact: true }).fill('Farmacia Sol 2')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('✓ Cambios guardados')).toBeVisible()
  expect(editados).toHaveLength(1)
  expect(editados[0]).toMatchObject({ direccion: 'Avda. Montero Ríos 12, A Coruña', cliente: 'Farmacia Sol 2', telefono: '600000001' })
  await expect(page.getByText('Farmacia Sol 2')).toBeVisible()

  // Quitar: el primer toque pide confirmar, el segundo la quita.
  await page.getByRole('button', { name: /Editar parada: Farmacia Sol 2/ }).click()
  await page.getByRole('button', { name: 'Quitar esta parada' }).click()
  expect(quitados).toEqual([])
  await page.getByRole('button', { name: '¿Seguro? Toca otra vez para quitarla' }).click()
  await expect(page.getByText('Parada quitada de tu ruta')).toBeVisible()
  expect(quitados).toEqual(['p1'])
  await expect(page.getByText('Farmacia Sol 2')).toHaveCount(0)
})
