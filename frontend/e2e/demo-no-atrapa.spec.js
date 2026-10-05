import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* LA DEMO NO ATRAPA (05-10-2026). Dani Brao pulsó «Probarla ahora», ya tenía cuenta,
   y no conseguía salir: la app instalada arranca en /app, que mandaba al portal del
   conductor si había CUALQUIER sesión de conductor, también la de la demo. Así que
   aunque entrara con su cuenta, cada vez que abría la app volvía a la demo. */

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (p) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...p })}.firma`
const DEMO = jwt({ sub: 'demo-a-1', role: 'driver', demo: true, db_name: 'dsp_demo_reparto', org_id: 'demo-reparto' })
const REAL = jwt({ sub: 'u1', role: 'admin', name: 'Dani', org_id: 'o1', db_name: 'dsp_o1', centers: ['PRINCIPAL'] })

test.use({ locale: 'es-ES' })

async function conSesiones(page, { demo = false, real = false, conductorReal = false } = {}) {
  await page.addInitScript(({ demo, real, conductorReal, DEMO, REAL }) => {
    if (sessionStorage.getItem('ya')) return            // solo en la primera carga
    sessionStorage.setItem('ya', '1')
    localStorage.setItem('cookie_consent', '1')
    localStorage.setItem('flota_lang', 'es')
    if (demo) {
      localStorage.setItem('flota_driver_token', DEMO)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'demo-a-1', name: 'Repartidor (prueba)' }))
    }
    if (conductorReal) localStorage.setItem('flota_driver_token', REAL.replace('admin', 'driver'))
    if (real) {
      localStorage.setItem('flota_token', REAL)
      localStorage.setItem('flota_admin', JSON.stringify({ id: 'u1', name: 'Dani', role: 'admin', centers: ['PRINCIPAL'] }))
    }
  }, { demo, real, conductorReal, DEMO, REAL })
}

test('con la demo abierta y una cuenta real, la app abre la cuenta (no la demo)', async ({ page }) => {
  await simularApi(page, 'vacio')
  await conSesiones(page, { demo: true, real: true })
  await page.goto('/app')
  await page.waitForURL((u) => !u.pathname.startsWith('/app'))
  expect(new URL(page.url()).pathname.startsWith('/conductor')).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('flota_driver_token'))).toBeNull()
})

test('solo con la demo, la app no se queda en ella: va a Empezar', async ({ page }) => {
  await simularApi(page, 'vacio')
  await conSesiones(page, { demo: true })
  await page.goto('/app')
  await page.waitForURL(/\/empezar/)
  expect(await page.evaluate(() => localStorage.getItem('flota_driver'))).toBeNull()
})

test('un conductor de verdad sigue entrando a su portal desde la app', async ({ page }) => {
  await simularApi(page, 'vacio')
  await conSesiones(page, { conductorReal: true })
  await page.goto('/app')
  await page.waitForURL(/\/conductor/)
})

test('en la ruta de prueba, «Ya tengo cuenta» saca de la demo y lleva a entrar', async ({ page }) => {
  await simularApi(page, 'vacio')
  await conSesiones(page, { demo: true })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, prueba: true, fecha: '2026-10-05', jornada: {}, aviso_aceptado: true, pais: 'es', pedidos: [] } }))
  await page.goto('/conductor?vista=ruta')
  await page.getByRole('button', { name: 'Ya tengo cuenta' }).click()
  await page.waitForURL(/\/panel\/login/)
  expect(await page.evaluate(() => localStorage.getItem('flota_driver_token'))).toBeNull()
})
