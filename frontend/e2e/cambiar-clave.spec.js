import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* CAMBIAR LA CONTRASEÑA SIN SABER LA ACTUAL (02-11-2026; María, oficina de OGA5: «No les deja cambiar la contraseña en la
   app… creo que inician desde Google»), en el portal del conductor de la web con la API simulada. Quien entró con la
   contraseña que le rellena Google, o con el código del correo, no sabe la actual: nada más entrar (el servidor dice
   `clave_sin_actual`) no se le pide; si no, puede pedir un código a su correo (`codigo_a`) que vale por la actual; y si
   no tiene correo, la pantalla le dice qué hacer. */

const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/** El portal del conductor con sesión, y la ficha que devuelve el servidor. Devuelve lo que se mandó al servidor. */
async function portal(page, ficha) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
  await page.addInitScript((tk) => {
    localStorage.setItem('flota_driver_token', tk)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'NORTE' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const enviado = { cambio: [], codigo: 0 }
  await page.route(/\/api\/portal\/mi-ficha/, json({ falta_telefono: false, nombre: 'ANA PÉREZ', tiene_clave: true,
    configurar_cuenta: false, ...ficha }))
  await page.route(/\/api\/auth\/codigo-clave/, (route) => {
    enviado.codigo += 1
    return json({ ok: true, enviado_a: 'a•••@gmail.com', minutos: 10 })(route)
  })
  await page.route(/\/api\/auth\/change-my-password/, (route) => {
    enviado.cambio.push(route.request().postDataJSON())
    return json({ success: true })(route)
  })
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.getByText('Cambiar mi contraseña').first().click()
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña' })).toBeVisible({ timeout: 15000 })
  return enviado
}

test('sin saber la actual: pide un código a su correo y lo cambia con él', async ({ page }) => {
  const fallos = vigilar(page)
  const enviado = await portal(page, { clave_sin_actual: false, codigo_a: 'a•••@gmail.com' })
  await page.getByTestId('clave-pedir-codigo').click()
  await expect(page.getByText('Te hemos mandado un código a a•••@gmail.com. Mira también el spam.')).toBeVisible()
  expect(enviado.codigo).toBe(1)
  const claves = page.locator('input[type="password"]')
  await expect(claves).toHaveCount(2)                                      // ya no pide la actual
  await claves.nth(0).fill('la-nueva-1')
  await claves.nth(1).fill('la-nueva-1')
  const guardar = page.getByRole('button', { name: 'Guardar' })
  await expect(guardar).toBeDisabled()                                     // falta el código
  await page.getByTestId('clave-codigo').fill('12a3456')                   // solo cifras, como mucho 6
  await expect(page.getByTestId('clave-codigo')).toHaveValue('123456')
  await guardar.click()
  await expect(page.getByText('Contraseña cambiada')).toBeVisible()
  expect(enviado.cambio).toEqual([{ current_password: '', new_password: 'la-nueva-1', codigo: '123456' }])
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('nada más entrar no se le pide la actual', async ({ page }) => {
  const fallos = vigilar(page)
  const enviado = await portal(page, { clave_sin_actual: true, codigo_a: 'a•••@gmail.com' })
  await expect(page.getByTestId('clave-sin-actual')).toBeVisible()
  await expect(page.getByTestId('clave-pedir-codigo')).toHaveCount(0)
  const claves = page.locator('input[type="password"]')
  await expect(claves).toHaveCount(2)
  await claves.nth(0).fill('otra-nueva-1')
  await claves.nth(1).fill('otra-nueva-1')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Contraseña cambiada')).toBeVisible()
  expect(enviado.cambio).toEqual([{ current_password: '', new_password: 'otra-nueva-1' }])
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})

test('sin correo donde mandar el código: pide la actual y dice qué hacer si no la sabe', async ({ page }) => {
  const fallos = vigilar(page)
  const enviado = await portal(page, { clave_sin_actual: false, codigo_a: null })
  await expect(page.getByTestId('clave-pedir-codigo')).toHaveCount(0)
  await expect(page.getByText(/Sal de la cuenta y vuelve a entrar: nada más entrar podrás cambiarla sin la/)).toBeVisible()
  const claves = page.locator('input[type="password"]')
  await expect(claves).toHaveCount(3)
  await claves.nth(0).fill('la-de-ahora-1')
  await claves.nth(1).fill('la-nueva-2')
  await claves.nth(2).fill('la-nueva-2')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Contraseña cambiada')).toBeVisible()
  expect(enviado.cambio).toEqual([{ current_password: 'la-de-ahora-1', new_password: 'la-nueva-2' }])
  expect(fallos, fallos.join(' | ')).toHaveLength(0)
})
