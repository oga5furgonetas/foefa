import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* EL IPHONE VUELVE A DONDE ESTABA (03-11-2026, Dani: «cuando sales de la app y vuelves a entrar te enviaba a la de
   reparto… Porto entraba en la suya de oficina, salía e iba a la de reparto»). Al volver a abrirla, la app de iPhone
   carga la portada («/»): antes iba siempre a /ruta, y ahora a la zona donde estaba (lib/plataforma.js). */
async function comoIphone(page) {
  await page.addInitScript(() => {
    // Lo que deja Capacitor dentro de la app; congelado para que el plugin de la barra no lo cambie al cargarse.
    window.Capacitor = Object.freeze({ isNativePlatform: () => true, getPlatform: () => 'ios' })
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
  })
  await simularApi(page, 'vacio')
}
const zona = (page) => page.evaluate(() => localStorage.getItem('fds_app_zona'))

test('la primera vez, a la app del repartidor', async ({ page }) => {
  await comoIphone(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
})

test('quien estaba en el panel vuelve al panel, y quien estaba en el portal del conductor, al de su empresa', async ({ page }) => {
  await comoIphone(page)
  await page.goto('/panel/login', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => zona(page)).toBe('/panel')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/conductor/oga5', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => zona(page)).toBe('/conductor/oga5')
  await page.goto('/privacidad', { waitUntil: 'domcontentloaded' })             // lo demás no cambia la zona
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/conductor\/oga5/)
})

/* 10-11-2026: lo que dentro de la app no existe (los planes, la invitación, la portada a la que lleva el logotipo de una página
   legal…) mandaba SIEMPRE a /ruta, y de paso cambiaba la zona guardada: a un conductor de empresa la app le arrancaba desde
   entonces en la entrada de oficina. Ahora lleva a la zona donde se estaba; sin ninguna guardada, a /ruta como antes (lo prueba
   la primera de aquí y e2e/ios-sin-pagos.spec.js). Con la página legal de por medio: e2e/mercadillo-acceso.spec.js. */
test('lo que dentro de la app no existe lleva a la zona donde se estaba, y no la cambia', async ({ page }) => {
  await comoIphone(page)
  await page.goto('/conductor/oga5', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => zona(page)).toBe('/conductor/oga5')
  for (const ruta of ['/planes', '/invita', '/repartidores']) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    await expect(page, `${ruta} lleva al portal del conductor de su empresa`).toHaveURL(/\/conductor\/oga5$/)
    expect(await zona(page), `${ruta} no cambia la zona`).toBe('/conductor/oga5')
  }
  await page.goto('/panel/login', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => zona(page)).toBe('/panel')
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/panel/)
  expect(await zona(page)).toBe('/panel')
})

test('en el navegador la portada sigue siendo la portada', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fds_app_zona', '/panel'))
  await simularApi(page, 'vacio')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/$/)
})
