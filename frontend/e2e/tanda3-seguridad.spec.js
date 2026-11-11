import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* TANDA 3, ZONA «SEGURIDAD» (11-11-2026), con la API simulada:
   · S1 (alta): el 409 de «ya tiene una ficha dada de baja» pregunta en DOS pasos. Antes el «Cancelar» del primero
     creaba la ficha «otra persona», y ahora eso le quita el correo a la ficha de baja: Cancelar en los dos no hace nada.
   · S1 («Fichas duplicadas»): «No es la misma persona» junto a la ficha de baja de un grupo con una activa; manda
     POST /drivers/separar { queda, ceden }. Con un servidor que no manda `activa`, no sale.
   · S3 (portal): quien entra con contraseña se guarda CON su `id` (antes sin él, y la inspección mandaba "undefined"). */

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js|status of 409/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/* Contesta los window.confirm en orden con lo que se le diga y apunta lo que preguntan. */
function respuestas(page, lista) {
  const preguntas = []
  const cola = [...lista]
  page.on('dialog', async (d) => {
    preguntas.push(d.message())
    if (cola.length && cola.shift()) await d.accept()
    else await d.dismiss()
  })
  return preguntas
}

const LISTA = [{ id: 'd1', name: 'ANTONIO GARCÍA', center: 'NORTE', active: true, email: 'antonio@ejemplo.es' }]
const REACTIVAR = { detail: { mensaje: 'JUAN REY ya tiene una ficha dada de baja con este correo. Reactivala para conservar su historial.',
  reactivar_id: 'd-juan', nombre: 'JUAN REY' } }

/* El panel de Conductores con el alta simulada: sin `?nueva` contesta el 409 de reactivar; con él, la ficha nueva. */
async function alta(page) {
  const llamadas = []
  await entrarComoAdmin(page, { centros: ['NORTE'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, (route) => {
    const req = route.request()
    if (req.method() === 'GET') return json(LISTA)(route)
    const url = new URL(req.url())
    llamadas.push(`${req.method()} ${url.pathname}${url.search}`)
    if (url.searchParams.get('nueva') === 'true') return json({ id: 'd-nuevo', name: 'PEDRO VAL', email: 'repartos3@empresa.es', active: true })(route)
    return json(REACTIVAR, 409)(route)
  })
  await page.route(/\/api\/drivers\/d-juan$/, (route) => {
    llamadas.push(`${route.request().method()} /api/drivers/d-juan`)
    return json({ id: 'd-juan', name: 'JUAN REY', active: true })(route)
  })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Añadir conductor' }).first().click()
  await page.getByPlaceholder('Nombre Apellido').fill('Pedro Val')
  await page.getByPlaceholder('conductor@email.com').fill('repartos3@empresa.es')
  return llamadas
}

const guardar = (page) => page.locator('button[type="submit"][form="driver-form"]').click()

test.describe('S1 · el alta de «otra persona», en dos pasos', () => {
  test('Cancelar en los dos no crea nada ni reactiva nada, y cierra la ficha sin error', async ({ page }) => {
    const fallos = vigilar(page)
    const llamadas = await alta(page)
    const preguntas = respuestas(page, [false, false])
    await guardar(page)
    await expect(page.getByPlaceholder('Nombre Apellido')).toHaveCount(0)
    expect(preguntas).toHaveLength(2)
    expect(preguntas[0]).toContain('Aceptar: reactivar su ficha')
    expect(preguntas[0]).not.toContain('crear una ficha nueva')
    expect(preguntas[1]).toContain('¿Es OTRA persona con el mismo correo?')
    expect(preguntas[1]).toContain('dejará de entrar con este correo')
    expect(llamadas).toEqual(['POST /api/drivers'])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('Cancelar y luego Aceptar crea la ficha nueva con ?nueva=true', async ({ page }) => {
    const llamadas = await alta(page)
    const preguntas = respuestas(page, [false, true])
    await guardar(page)
    await expect(page.getByPlaceholder('Nombre Apellido')).toHaveCount(0)
    expect(preguntas).toHaveLength(2)
    expect(llamadas).toEqual(['POST /api/drivers', 'POST /api/drivers?nueva=true'])
  })

  test('Aceptar en el primero reactiva su ficha, como siempre, sin segunda pregunta', async ({ page }) => {
    const llamadas = await alta(page)
    const preguntas = respuestas(page, [true])
    await guardar(page)
    await expect(page.getByPlaceholder('Nombre Apellido')).toHaveCount(0)
    expect(preguntas).toHaveLength(1)
    expect(llamadas).toEqual(['POST /api/drivers', 'PATCH /api/drivers/d-juan'])
  })
})

const GRUPOS = (conActiva = true) => {
  const f = (id, nombre, activa, total) => ({ id, nombre, center: 'NORTE', creada: '2026-05-01', telefono: null,
    inspecciones: total, turnos: 0, peticiones: 0, asignaciones: 0, total, ...(conActiva ? { activa } : {}) })
  return { total: 1, fichas_de_mas: 1, grupos: [
    { email: 'repartos3@empresa.es', sugerida: 'd-juan', fichas: [f('d-juan', 'JUAN REY', false, 4), f('d-pedro', 'PEDRO VAL', true, 1)] },
  ] }
}

async function duplicadas(page, { conActiva = true } = {}) {
  const enviados = []
  let separadas = false
  await entrarComoAdmin(page, { centros: ['NORTE'] })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/drivers(\?|$)/, json(LISTA))
  await page.route(/\/api\/drivers\/duplicados/, (route) =>
    json(separadas ? { total: 0, fichas_de_mas: 0, grupos: [] } : GRUPOS(conActiva))(route))
  await page.route(/\/api\/drivers\/separar/, (route) => {
    enviados.push(route.request().postDataJSON())
    separadas = true
    return json({ ok: true, cedidas: ['d-juan'] })(route)
  })
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^(Fichas duplicadas|Duplicadas)$/ }).first().click()
  await expect(page.getByText('repartos3@empresa.es')).toBeVisible()
  return enviados
}

test.describe('S1 · «No es la misma persona» en Fichas duplicadas', () => {
  test('sale solo junto a la de baja; Aceptar manda { queda: la activa, ceden: [la de baja] }', async ({ page }) => {
    const fallos = vigilar(page)
    const enviados = await duplicadas(page)
    const boton = page.getByRole('button', { name: 'No es la misma persona' })
    await expect(boton).toHaveCount(1)
    // En la fila de JUAN (de baja), no en la de PEDRO.
    await expect(page.locator('label', { hasText: 'JUAN REY' }).getByRole('button', { name: 'No es la misma persona' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'PEDRO VAL' }).getByRole('button')).toHaveCount(0)
    const preguntas = respuestas(page, [true])
    await boton.click()
    await expect(page.getByText('JUAN REY ya no entra con repartos3@empresa.es.')).toBeVisible()
    expect(preguntas[0]).toContain('¿JUAN REY es OTRA persona que PEDRO VAL?')
    expect(enviados).toEqual([{ queda: 'd-pedro', ceden: ['d-juan'] }])
    // Pulsarlo no elige esa ficha para conservar (está dentro de la fila con el botón de radio): se recarga sin el grupo.
    await expect(page.getByText('Ninguna. Todas las fichas son de personas distintas.')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('Cancelar no manda nada ni cambia la ficha que se conserva', async ({ page }) => {
    const enviados = await duplicadas(page)
    const preguntas = respuestas(page, [false])
    await page.getByRole('button', { name: 'No es la misma persona' }).click()
    await expect.poll(() => preguntas.length).toBe(1)
    expect(enviados).toEqual([])
    await expect(page.locator('label', { hasText: 'JUAN REY' }).getByText('se conserva')).toBeVisible()
    await expect(page.getByRole('button', { name: /Fusionar 2 fichas en una/ })).toBeVisible()
  })

  test('con un servidor que no manda `activa` (el de antes), no sale el botón', async ({ page }) => {
    await duplicadas(page, { conActiva: false })
    await expect(page.getByRole('button', { name: /Fusionar 2 fichas en una/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No es la misma persona' })).toHaveCount(0)
  })
})

test.describe('S3 · el portal guarda el id de quien entra con contraseña', () => {
  test('flota_driver lleva el id que manda el servidor', async ({ page }) => {
    const fallos = vigilar(page)
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    })
    await simularApi(page, 'vacio')
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd7', role: 'driver', name: 'LUIS GOMEZ', exp })}.firma`
    await page.route(/\/api\/auth\/driver-login/, json({ access_token: token, role: 'driver', id: 'd7', name: 'LUIS GOMEZ', center: 'OGA5' }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill('luis@ejemplo.test')
    await page.locator('input[type="email"]').press('Enter')
    await page.locator('input[autocomplete="current-password"]').fill('clave-de-prueba')
    await page.locator('input[autocomplete="current-password"]').press('Enter')
    await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15000 })
    const guardado = JSON.parse(await page.evaluate(() => localStorage.getItem('flota_driver')))
    expect(guardado.id).toBe('d7')
    expect(guardado.email).toBe('luis@ejemplo.test')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
