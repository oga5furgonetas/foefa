/* global process */
import path from 'path'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

// Con FOTOS_PRODUCTO=<carpeta> guarda la foto de la pantalla (ronda 3, 14-11-2026).
async function fotoDe(page, nombre) {
  const dir = process.env.FOTOS_PRODUCTO
  if (dir) await page.screenshot({ path: path.join(dir, `${nombre}-${test.info().project.name}.png`) })
}

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

/* RONDA 3 (14-11-2026): la fecha de la foto limpia como la del golpe (M7) y el grupo con que se abre (R1). */
test('Origen de daños · «Limpia el 12/11/2026», con el mismo formato que «Con el golpe el 13/11/2026»', async ({ page, baseURL }) => {
  // Falla con el código de antes: salía «Limpia el 2026-11-12».
  await abrir(page, dano('l4', `${baseURL}/demo/van-frontal.jpg`, `${baseURL}/demo/van-lateral.jpg`))
  await expect(page.getByText('Limpia el 12/11/2026')).toBeVisible()
  await expect(page.getByText('Con el golpe el 13/11/2026')).toBeVisible()
  await expect(page.getByText('2026-11-12')).toHaveCount(0)
  await fotoDe(page, 'origen-fechas')
})

async function abrirGrupos(page, danos) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(e.message))
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const resumen = { alta: 0, media: 0, baja: 0 }
  for (const d of danos) if (d.certeza in resumen) resumen[d.certeza] += 1
  await page.route(/\/api\/damages\/atribucion/, (r) => r.fulfill({
    json: { danos, resumen, total: danos.length, truncado: false },
  }))
  await page.goto('/panel/origen-danos', { waitUntil: 'domcontentloaded' })
  return fallos
}
const conCerteza = (id, certeza, matricula) => ({ ...dano(id, null, null), certeza, matricula })
const grupo = (page, nombre) => page.getByRole('button', { name: new RegExp(`^${nombre}`) })
const fondo = (b) => b.evaluate((el) => el.className.includes('bg-dark-700 '))

test('Origen de daños · sin golpes de un solo conductor, abre en el primer grupo que tenga', async ({ page }) => {
  // Falla con el código de antes: abría en «Un solo conductor» con «No hay golpes en este grupo».
  const fallos = await abrirGrupos(page, [conCerteza('a', 'baja', '1111AAA'), conCerteza('b', 'media', '2222BBB')])
  await expect(page.getByRole('button', { name: /2222/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /1111/ })).toHaveCount(0)
  await expect(page.getByText('No hay golpes en este grupo.')).toHaveCount(0)
  expect(await fondo(grupo(page, 'Varios posibles'))).toBe(true)
  await fotoDe(page, 'origen-grupo')
  // Y lo que pulse el usuario manda: «Un solo conductor» sigue diciendo que está vacío.
  await grupo(page, 'Un solo conductor').click()
  await expect(page.getByText('No hay golpes en este grupo.')).toBeVisible()
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('Origen de daños · con golpes de un solo conductor, abre en ese grupo como siempre', async ({ page }) => {
  await abrirGrupos(page, [conCerteza('a', 'media', '1111AAA'), conCerteza('b', 'alta', '2222BBB')])
  await expect(page.getByRole('button', { name: /2222/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /1111/ })).toHaveCount(0)
  expect(await fondo(grupo(page, 'Un solo conductor'))).toBe(true)
})

test('Origen de daños · solo «Sin acotar», abre ahí', async ({ page }) => {
  await abrirGrupos(page, [conCerteza('a', 'baja', '1111AAA')])
  await expect(page.getByRole('button', { name: /1111/ })).toBeVisible()
  expect(await fondo(grupo(page, 'Sin acotar'))).toBe(true)
})

/* QUIÉN LO DICE (14-11-2026, tercera tanda, S7). Cada golpe lleva `confirmado`: lo confirmado por una persona y lo
   que solo marcó la IA no se leen igual. Un servidor viejo no lo manda: entonces la fila no dice nada de eso. */
test('Origen de daños · cada golpe dice si lo confirmó una persona o solo lo marcó la IA', async ({ page, baseURL }) => {
  const foto = `${baseURL}/demo/van-lateral.jpg`
  const golpe = `${baseURL}/demo/van-lateral-golpe-puerta.jpg`
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const danos = [
    { ...dano('c1', foto, golpe), matricula: '1111AAA', confirmado: true },
    { ...dano('c2', foto, golpe), matricula: '2222BBB', confirmado: false, certeza: 'media',
      motivo: 'solo lo marcó la IA: nadie lo ha confirmado' },
    { ...dano('c3', foto, golpe), matricula: '3333CCC' },
  ]
  await page.route(/\/api\/damages\/atribucion/, (r) => r.fulfill({
    json: { danos, resumen: { alta: 2, media: 1, baja: 0 }, total: 3, truncado: false },
  }))
  await page.goto('/panel/origen-danos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^Todos/ }).click()
  await expect(page.getByRole('button', { name: /1111/ })).toContainText('Confirmado por una persona')
  await expect(page.getByRole('button', { name: /2222/ })).toContainText('Solo lo marcó la IA')
  const sinCampo = page.getByRole('button', { name: /3333/ })
  await expect(sinCampo).toBeVisible()
  await expect(sinCampo).not.toContainText('Confirmado por una persona')
  await expect(sinCampo).not.toContainText('Solo lo marcó la IA')
  await fotoDe(page, 'origen-confirmado')
})
