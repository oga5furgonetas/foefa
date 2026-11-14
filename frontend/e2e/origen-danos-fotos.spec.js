import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ORIGEN DE DAÑOS: LA PRUEBA NO PUEDE SER LA MISMA FOTO DOS VECES (14-11-2026). La pantalla enseña «limpia el …» y
   «con el golpe el …» lado a lado antes del nombre de quien llevaba la furgoneta. Si las dos URL son la misma imagen
   (pasaba en la demo, que lleva las mismas fotos en todas las inspecciones), ponerlas como antes y después no prueba
   nada: parece que el golpe ya estaba en la foto «limpia». Con dos URL iguales se trata igual que si faltara una:
   sale solo la del golpe, sin «entre las dos fotos» y sin el nombre en la cabecera; con dos distintas, la pareja de
   siempre. La API va simulada con la forma de `GET /damages/atribucion`. */

const dano = (id, limpia, golpe) => ({
  ledger_id: id, vehicle_id: 'v1', matricula: '1234BCD', center: 'NORTE', part: 'puerta lateral derecha',
  pieza: 'puerta', panel: 'puerta', severity: 'grave', status: 'open', aparecio: '2026-11-13', ventana_dias: 1,
  certeza: 'alta', motivo: null, conductores: [{ id: 'd1', nombre: 'Ana Pérez' }],
  foto_limpia: limpia, foto_limpia_fecha: '2026-11-12', foto_golpe: golpe,
})

async function abrir(page, d) {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/damages\/atribucion/, (r) => r.fulfill({
    json: { danos: [d], resumen: { alta: 1, media: 0, baja: 0 }, total: 1, truncado: false },
  }))
  await page.goto('/panel/origen-danos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /1234/ }).click()
}

test('Origen de daños · dos URL iguales no salen como antes y después', async ({ page, baseURL }) => {
  const foto = `${baseURL}/demo/van-lateral.jpg`
  await abrir(page, dano('l1', foto, foto))
  const golpe = page.getByText('Con el golpe el')
  await expect(golpe).toBeVisible()
  await expect(page.getByText('Limpia el')).toHaveCount(0)
  await expect(page.locator(`img[src="${foto}"]`)).toHaveCount(1)
  // Sin pareja no se dice «entre las dos fotos» ni se pone el nombre en la cabecera.
  await expect(page.getByText(/^La llevaba Ana Pérez\.$/)).toBeVisible()
  await expect(page.getByText('entre las dos fotos')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Ana Pérez/ })).toHaveCount(0)
  await expect(page.getByText('No hay foto anterior')).toBeVisible()
})

test('Origen de daños · sin la limpia, lo mismo que con dos URL iguales', async ({ page, baseURL }) => {
  const foto = `${baseURL}/demo/van-lateral.jpg`
  await abrir(page, dano('l3', null, foto))
  await expect(page.getByText('Con el golpe el')).toBeVisible()
  await expect(page.getByText('Limpia el')).toHaveCount(0)
  await expect(page.locator(`img[src="${foto}"]`)).toHaveCount(1)
  await expect(page.getByText('entre las dos fotos')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Ana Pérez/ })).toHaveCount(0)
  await expect(page.getByText('No hay foto anterior')).toBeVisible()
})

test('Origen de daños · dos URL distintas siguen saliendo como pareja', async ({ page, baseURL }) => {
  const limpia = `${baseURL}/demo/van-frontal.jpg`
  const golpe = `${baseURL}/demo/van-lateral.jpg`
  await abrir(page, dano('l2', limpia, golpe))
  await expect(page.getByText('Limpia el')).toBeVisible()
  await expect(page.getByText('Con el golpe el')).toBeVisible()
  await expect(page.locator(`img[src="${limpia}"]`)).toHaveCount(1)
  await expect(page.locator(`img[src="${golpe}"]`)).toHaveCount(1)
  await expect(page.getByText('entre las dos fotos')).toBeVisible()
  await expect(page.getByText('No hay foto anterior')).toHaveCount(0)
  // El nombre en la cabecera, como hoy (solo a partir de la anchura de tableta).
  const ancho = page.viewportSize()?.width || 0
  await expect(page.getByRole('button', { name: /Ana Pérez/ })).toHaveCount(ancho >= 768 ? 1 : 0)
})
