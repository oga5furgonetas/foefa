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

  /* Revisión P13 (11-11-2026): el segundo paso manda las DOS señales; `nueva=true` a secas es lo que manda el panel
     viejo en caché, y con eso el servidor no cede nada. */
  test('Cancelar y luego Aceptar crea la ficha nueva con ?nueva=true&otra_persona=true', async ({ page }) => {
    const llamadas = await alta(page)
    const preguntas = respuestas(page, [false, true])
    await guardar(page)
    await expect(page.getByPlaceholder('Nombre Apellido')).toHaveCount(0)
    expect(preguntas).toHaveLength(2)
    expect(llamadas).toEqual(['POST /api/drivers', 'POST /api/drivers?nueva=true&otra_persona=true'])
  })

  test('si la ficha de baja es de una nave que no ve, el 403 se enseña en la ficha y no se cierra', async ({ page }) => {
    const llamadas = await alta(page)
    const msg = 'La ficha dada de baja con este correo es de OGA5, que no tienes asignada: pide a quien lleve esa nave que dé el alta.'
    await page.route(/\/api\/drivers\?nueva=true&otra_persona=true$/, (route) => {
      llamadas.push('POST 403')
      return json({ detail: msg }, 403)(route)
    })
    respuestas(page, [false, true])
    await guardar(page)
    await expect(page.getByText(msg)).toBeVisible()
    await expect(page.getByPlaceholder('Nombre Apellido')).toHaveCount(1)
    expect(llamadas).toEqual(['POST /api/drivers', 'POST 403'])
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

  /* Revisión P30 (11-11-2026): si el servidor no ha separado nada contesta 409, y se enseña eso, no «ya no entra». */
  test('si el servidor contesta 409 (nada separado) sale su error y no «ya no entra»', async ({ page }) => {
    const msg = 'No se ha separado ninguna ficha: vuelve a cargar «Fichas duplicadas» y míralo otra vez.'
    await duplicadas(page)
    await page.route(/\/api\/drivers\/separar/, json({ detail: msg }, 409))
    respuestas(page, [true])
    await page.getByRole('button', { name: 'No es la misma persona' }).click()
    await expect(page.getByText(msg)).toBeVisible()
    await expect(page.getByText(/ya no entra con/)).toHaveCount(0)
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
    // Con contraseña: desde el 14-11-2026 lo principal es «Recibir un código» y la contraseña va en el segundo botón.
    await page.getByRole('button', { name: 'Entrar con contraseña' }).click()
    await page.locator('input[autocomplete="current-password"]').fill('clave-de-prueba')
    await page.locator('input[autocomplete="current-password"]').press('Enter')
    await expect(page.getByRole('heading', { name: /Hola, LUIS/ })).toBeVisible({ timeout: 15000 })
    const guardado = JSON.parse(await page.evaluate(() => localStorage.getItem('flota_driver')))
    expect(guardado.id).toBe('d7')
    expect(guardado.email).toBe('luis@ejemplo.test')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* Revisión V11 (11-11-2026): el selector de centro de arriba (getVisibleCenters de panel/auth.js) cruza las naves de la
   empresa con las del usuario con la MISMA regla que el servidor. Con trozos en las dos direcciones, a quien solo tiene
   NORTE2 le ofrecía NORTE, que el servidor ya le niega con un 403. Con códigos (OGA5, DGA1) o sin naves, nada cambia. */
async function selector(page, { org, mios }) {
  await entrarComoAdmin(page, { centros: org })
  await page.addInitScript((mios) => {
    const a = JSON.parse(localStorage.getItem('flota_admin'))
    localStorage.setItem('flota_admin', JSON.stringify({ ...a, allowed_centers: mios }))
    localStorage.setItem('panel_center', 'Todos')
  }, mios)
  await simularApi(page, 'vacio')
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const arriba = page.locator('header').first()
  await expect(arriba).toBeVisible({ timeout: 30000 })
  return arriba
}

const boton = (arriba, nombre) => arriba.getByRole('button', { name: nombre, exact: true })

test.describe('V11 · el selector de centro no ofrece lo que el servidor rechaza', () => {
  test('con solo NORTE2, sale NORTE2 fijo y no NORTE', async ({ page }) => {
    const fallos = vigilar(page)
    const arriba = await selector(page, { org: ['NORTE', 'NORTE2', 'SUR'], mios: ['NORTE2'] })
    await expect(arriba.getByText('NORTE2', { exact: true })).toBeVisible()
    await expect(boton(arriba, 'NORTE')).toHaveCount(0)
    await expect(arriba.getByText('NORTE', { exact: true })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('con NORTE2 y MADRID SUR, esos dos (ni NORTE ni MADRID)', async ({ page }) => {
    const arriba = await selector(page, { org: ['NORTE', 'NORTE2', 'MADRID', 'MADRID SUR'], mios: ['NORTE2', 'MADRID SUR'] })
    await expect(boton(arriba, 'NORTE2')).toBeVisible()
    await expect(boton(arriba, 'MADRID SUR')).toBeVisible()
    await expect(boton(arriba, 'NORTE')).toHaveCount(0)
    await expect(boton(arriba, 'MADRID')).toHaveCount(0)
  })

  // Controles: con códigos de nave o sin naves asignadas, el selector es el de siempre.
  const ORG = ['OGA5', 'DGA1', 'DGA2']

  test('con códigos: solo DGA1, sale DGA1 fijo', async ({ page }) => {
    const arriba = await selector(page, { org: ORG, mios: ['DGA1'] })
    await expect(arriba.getByText('DGA1', { exact: true })).toBeVisible()
    await expect(boton(arriba, 'OGA5')).toHaveCount(0)
  })

  test('con códigos: OGA5 y DGA2, esos dos botones', async ({ page }) => {
    const arriba = await selector(page, { org: ORG, mios: ['OGA5', 'DGA2'] })
    await expect(boton(arriba, 'OGA5')).toBeVisible()
    await expect(boton(arriba, 'DGA2')).toBeVisible()
    await expect(boton(arriba, 'DGA1')).toHaveCount(0)
  })

  test('con el nombre largo de la nave guardado en Usuarios, sale su código', async ({ page }) => {
    const arriba = await selector(page, { org: ORG, mios: ['AMZL OGA5 SANTIAGO XPT'] })
    await expect(arriba.getByText('OGA5', { exact: true })).toBeVisible()
    await expect(boton(arriba, 'DGA1')).toHaveCount(0)
  })

  test('sin naves asignadas, todas las de la empresa', async ({ page }) => {
    const arriba = await selector(page, { org: ORG, mios: [] })
    for (const c of ORG) await expect(boton(arriba, c)).toBeVisible()
  })
})
