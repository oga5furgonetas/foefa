/* global process */
/* UNA FLOTA EMPIEZA SOLA EN DIEZ MINUTOS (14-11-2026, CONTRATO-ALTA §3 y §4).
   El camino del dueño, de la web a «ha llegado la primera revisión», con la API simulada. Las respuestas del servidor son
   los ficheros que escribe él mismo con sus rutas de verdad (backend/tests/test_alta_fixtures.py →
   e2e/fixtures/alta-*.json): lo que se espera en pantalla se saca de ellos, así que si el servidor cambia un nombre o un
   motivo, la prueba lo sigue; si cambia la FORMA, la prueba falla.
   Lo que se vigila: la pantalla final del alta sin textos falsos; las matrículas repetidas o raras se dicen antes de
   guardar; los conductores con y sin móvil; «Mandar por WhatsApp» abre wa.me con el mensaje y el enlace personal;
   «Copiar enlace» copia el MISMO enlace (no crea otro); «Renovar» confirma con lo que dice el servidor; la espera
   pregunta sola y enseña la revisión al llegar; el inicio retoma el arranque y se entera sin recargar; 390 px sin
   desbordes; los seis idiomas sin español suelto; la pestaña «Turnos» de Importaciones solo si se puede abrir. */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { DICT } from '../src/i18nDict.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', n), 'utf8'))
const ESTADO = fx('alta-estado.json')
const ACCESOS = fx('alta-accesos.json')
const CREADO = fx('alta-acceso-creado.json')
const FURGONETAS = fx('alta-furgonetas.json')
const CONDUCTORES = fx('alta-conductores.json')
const FOTOS_DIR = process.env.FOTOS_ALTA || ''

/* Fotos de verdad para que las capturas se parezcan a lo que se verá (las del servidor de pruebas no existen). */
const FOTOS_LOCALES = ['/demo/van-frontal.jpg', '/demo/van-lateral.jpg', '/demo/van-lateral-golpe-puerta.jpg', '/demo/van-lateral-golpe-paragolpes.jpg']
const REVISION = { ...ESTADO.revision, fotos: ESTADO.revision.fotos.map((f, i) => ({ ...f, url: FOTOS_LOCALES[i % FOTOS_LOCALES.length] })) }

/** El estado del arranque con los pasos anteriores a `paso` hechos (paso 5 = todo hecho, con la revisión). */
function estadoEn(paso) {
  const fin = paso > 4
  return {
    ...ESTADO,
    furgonetas: paso > 1 ? Math.max(1, ESTADO.furgonetas) : 0,
    conductores: paso > 2 ? Math.max(1, ESTADO.conductores) : 0,
    revisiones: fin ? 1 : 0,
    pasos: ESTADO.pasos.map((p, i) => ({ ...p, hecho: i < paso - 1 })),
    paso_actual: fin ? null : paso,
    revision: fin ? REVISION : null,
  }
}

function jwt(payload) {
  const b64 = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma-de-prueba`
}

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js|status of 40[19]/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  page.on('dialog', (d) => { fallos.push(`dialogo: ${d.message()}`); d.dismiss().catch(() => {}) })
  return fallos
}

/* El servidor del arranque, con memoria: el estado lo cambia cada prueba; se apunta cada petición. */
async function servidorArranque(page, context, inicial) {
  const s = { estado: inicial, accesos: structuredClone(ACCESOS), pedidas: [], estadoPedidos: 0 }
  s.poner = (e) => { s.estado = e }
  await page.route(/\/api\/alta\/estado/, (r) => { s.estadoPedidos += 1; return r.fulfill({ json: s.estado }) })
  await page.route(/\/api\/alta\/furgonetas$/, (r) => {
    const b = r.request().postDataJSON()
    s.pedidas.push({ ruta: 'furgonetas', ...b })
    if (!b.guardar) return r.fulfill({ json: FURGONETAS })
    s.poner(estadoEn(2))
    return r.fulfill({ json: { ...FURGONETAS, guardado: true,
      creadas: FURGONETAS.lineas.filter((l) => l.estado === 'nueva').map((l, i) => ({ id: `v-nueva-${i}`, matricula: l.matricula })) } })
  })
  await page.route(/\/api\/alta\/conductores$/, (r) => {
    const b = r.request().postDataJSON()
    s.pedidas.push({ ruta: 'conductores', ...b })
    if (!b.guardar) return r.fulfill({ json: CONDUCTORES })
    s.poner(estadoEn(3))
    return r.fulfill({ json: { ...CONDUCTORES, guardado: true,
      creados: CONDUCTORES.lineas.filter((l) => l.estado === 'nuevo').map((l, i) => ({ id: `d-nuevo-${i}`, nombre: l.nombre })) } })
  })
  await page.route(/\/api\/conductores\/accesos/, (r) => r.fulfill({ json: s.accesos }))
  await page.route(/\/api\/conductores\/[^/]+\/acceso$/, (r) => {
    const req = r.request()
    const id = decodeURIComponent(new URL(req.url()).pathname.split('/').slice(-2)[0])
    const fila = s.accesos.conductores.find((c) => c.driver_id === id)
    const cuerpo = req.method() === 'POST' ? (req.postDataJSON() || {}) : null
    s.pedidas.push({ ruta: 'acceso', metodo: req.method(), id, cuerpo })
    if (req.method() === 'DELETE') {
      fila.acceso = { estado: 'sin_enlace', creado_dia: null, abierto_dia: null, caduca_dia: null }
      return r.fulfill({ json: { ok: true, acceso: fila.acceso } })
    }
    if (fila.acceso.estado === 'abierto' && !cuerpo.renovar) {
      return r.fulfill({ status: 409, json: { detail: { codigo: 'ya_abierto',
        mensaje: `${fila.nombre} ya entra con su enlace desde su teléfono. Si lo renuevas, el anterior deja de valer y tendrá que abrir el nuevo.` } } })
    }
    const token = (id.replace(/[^0-9a-f]/g, '') + CREADO.token).slice(0, 64)
    fila.acceso = { ...CREADO.acceso }
    return r.fulfill({ headers: { 'Cache-Control': 'no-store' }, json: {
      ...CREADO, driver_id: id, nombre: fila.nombre, whatsapp: fila.whatsapp, token, ruta: `/c#${token}`,
      renovado: !!cuerpo.renovar, acceso: fila.acceso } })
  })
  // WhatsApp no se abre de verdad: se apunta la dirección.
  await context.route(/^https:\/\/wa\.me\//, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>WhatsApp</title>' }))
  return s
}

/* El mensaje que tiene que llevar WhatsApp (CONTRATO-ALTA §3.5), en el idioma del panel. */
function mensajeEsperado(lang, { nombre, empresa, enlace }) {
  const corto = (() => { const p = String(nombre).trim().split(/\s+/)[0]; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() })()
  return DICT['alta.wa.mensaje'][lang].replace('{nombre}', corto).replace('{empresa}', empresa).replace('{enlace}', enlace)
}

async function foto(page, nombre) {
  if (!FOTOS_DIR) return
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(FOTOS_DIR, `${nombre}.png`), fullPage: true })
}

/* Ir a un paso desde la barra de pasos de arriba (cada botón se llama «N · nombre del paso»). */
const alPaso = (page, n) => page.getByRole('button', { name: new RegExp(`^${n} · `) }).click()

async function sinDesborde(page, donde) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(sobra, `${donde}: la página se sale de la pantalla ${sobra} px`).toBeLessThanOrEqual(0)
}

test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid' })

/* ── El alta entera ─────────────────────────────────────────────────────────────────────────────────────────── */
test('el alta de una flota, de la web a «ha llegado la primera revisión»', async ({ page, context }, info) => {
  test.setTimeout(120_000)
  if (info.project.name === 'movil') await page.setViewportSize({ width: 390, height: 844 })
  const fallos = vigilar(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-17T00:00:00Z' }))
    localStorage.setItem('ayuda_vista_a1', '1')
  })
  await simularApi(page, 'vacio')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const altas = []
  await page.route(/\/api\/auth\/register$/, (r) => {
    altas.push(r.request().postDataJSON())
    return r.fulfill({ json: { access_token: jwt({ sub: 'a1', role: 'admin', name: 'Transportes Pérez', exp, org_id: 'org1' }),
      token_type: 'bearer', id: 'a1', name: 'Transportes Pérez', role: 'admin', account_type: 'dsp', slug: 'transportes-perez', correo_bienvenida: true } })
  })
  const s = await servidorArranque(page, context, estadoEn(1))

  // 1 · El formulario de la portada (con los parámetros que trae /empresas) y su pantalla final.
  await page.goto('/registro?sector=otra&plan=completo&flota=12', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Crea la cuenta de tu empresa' })).toBeVisible()
  await expect(page.getByTestId('reg-url-prefijo')).toHaveText(/\/conductor#$/)
  await page.getByPlaceholder('Transportes Pérez SL').fill('Transportes Pérez')
  await page.getByPlaceholder('admin@tuempresa.com').fill('oficina@transportes-perez.es')
  await page.locator('input[autocomplete="username"]').fill('oficina')
  await page.locator('input[autocomplete="new-password"]').first().fill('una-clave-larga')
  await page.locator('input[autocomplete="new-password"]').nth(1).fill('una-clave-larga')
  await page.getByRole('checkbox').check()
  await foto(page, `01-registro-${info.project.name}`)
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible()
  await expect(page.getByTestId('alta-correo-enviado')).toContainText('oficina@transportes-perez.es')
  await expect(page.getByText(/verific/i)).toHaveCount(0)
  await expect(page.getByText('Son cuatro pasos y puedes dejarlos a medias.')).toBeVisible()
  await expect(page.getByText('📧')).toHaveCount(0)
  // Lo que envía el alta no cambia: los mismos campos que antes.
  expect(altas).toHaveLength(1)
  expect(altas[0]).toMatchObject({ org_name: 'Transportes Pérez', username: 'oficina', plan: 'completo', sector: 'otra', slug: 'transportes-perez', email: 'oficina@transportes-perez.es' })
  await foto(page, `02-cuenta-creada-${info.project.name}`)
  await page.getByRole('button', { name: 'Empezar' }).click()

  // 2 · Paso 1: las matrículas, con una repetida y una que no lo parece; se dice antes de guardar.
  await expect(page).toHaveURL(/\/panel\/arranque$/)
  await expect(page.getByRole('heading', { name: 'Tus furgonetas' })).toBeVisible()
  await expect(page.getByText('Paso 1 de 4')).toBeVisible()
  const pegadas = FURGONETAS.lineas.map((l) => l.texto).join('\n')
  await page.getByTestId('alta-furgonetas-texto').fill(pegadas)
  await page.getByRole('button', { name: 'Revisar', exact: true }).click()
  const lineas = page.getByTestId('alta-lineas').locator('li')
  await expect(lineas).toHaveCount(FURGONETAS.lineas.length)
  for (const l of FURGONETAS.lineas) {
    const fila = lineas.nth(l.n - 1)
    await expect(fila).toHaveAttribute('data-estado', l.estado)
    if (l.motivo) await expect(fila).toContainText(l.motivo)
  }
  await expect(page.getByText('Repetida en la lista.')).toBeVisible()
  await expect(page.getByText('No parece una matrícula.')).toBeVisible()
  expect(s.pedidas.at(-1)).toEqual({ ruta: 'furgonetas', texto: pegadas, center: null, guardar: false })
  await foto(page, `03-furgonetas-revisadas-${info.project.name}`)
  const nuevas = FURGONETAS.nuevas
  await page.getByRole('button', { name: nuevas === 1 ? 'Guardar 1 furgoneta' : `Guardar ${nuevas} furgonetas` }).click()
  await expect(page.getByText(nuevas === 1 ? '1 furgoneta guardada.' : `${nuevas} furgonetas guardadas.`)).toBeVisible()
  expect(s.pedidas.at(-1)).toMatchObject({ ruta: 'furgonetas', texto: pegadas, guardar: true })
  await page.getByRole('button', { name: 'Seguir', exact: true }).click()

  // 3 · Paso 2: dos conductores uno a uno, uno con móvil y otro sin él; se manda como la lista pegada.
  await expect(page.getByRole('heading', { name: 'Tus conductores' })).toBeVisible()
  const filas = page.getByTestId('alta-fila')
  await filas.nth(0).getByLabel('Nombre').fill('Marta S.')
  await filas.nth(0).getByLabel('Móvil').fill('677 123 456')
  await filas.nth(1).getByLabel('Nombre').fill('Pablo R.')
  await page.getByRole('button', { name: 'Revisar', exact: true }).click()
  await expect.poll(() => s.pedidas.at(-1)).toEqual({ ruta: 'conductores', texto: 'Marta S.\t677 123 456\nPablo R.', center: null, guardar: false })
  for (const l of CONDUCTORES.lineas) {
    if (l.motivo) await expect(page.getByText(l.motivo)).toBeVisible()
    if (l.aviso) await expect(page.getByText(l.aviso)).toBeVisible()
  }
  await foto(page, `04-conductores-revisados-${info.project.name}`)
  const nuevos = CONDUCTORES.nuevos
  await page.getByRole('button', { name: nuevos === 1 ? 'Guardar 1 conductor' : `Guardar ${nuevos} conductores` }).click()
  await expect(page.getByText(nuevos === 1 ? '1 conductor guardado.' : `${nuevos} conductores guardados.`)).toBeVisible()
  await page.getByRole('button', { name: 'Seguir', exact: true }).click()

  // 4 · Paso 3: dales acceso. Uno con móvil, sin enlace: WhatsApp a su número, con el mensaje y SU enlace.
  await expect(page.getByRole('heading', { name: 'Dales acceso' })).toBeVisible()
  const fila = (c) => page.getByTestId('alta-conductor').filter({ hasText: c.nombre })
  const conMovil = ACCESOS.conductores.find((c) => c.whatsapp && c.acceso.estado === 'sin_enlace')
  const sinMovil = ACCESOS.conductores.find((c) => !c.whatsapp)
  const abierto = ACCESOS.conductores.find((c) => c.acceso.estado === 'abierto')
  await expect(fila(conMovil).getByTestId('acceso-estado')).toHaveText('Sin mandar')
  await expect(fila(abierto).getByTestId('acceso-estado')).toHaveText(`Abierto el ${abierto.acceso.abierto_dia.slice(8, 10)}-${abierto.acceso.abierto_dia.slice(5, 7)}`)
  await expect(fila(abierto).getByRole('button', { name: 'Mandar por WhatsApp' })).toHaveCount(0)
  await expect(fila(sinMovil).getByText('Sin móvil: WhatsApp te preguntará a quién mandarlo.')).toBeVisible()
  await foto(page, `05-dales-acceso-${info.project.name}`)

  const origen = new URL(page.url()).origin
  const [wa] = await Promise.all([page.waitForEvent('popup'), fila(conMovil).getByRole('button', { name: 'Mandar por WhatsApp' }).click()])
  await wa.waitForURL(/wa\.me/)
  const creadoConMovil = s.pedidas.filter((p) => p.ruta === 'acceso' && p.id === conMovil.driver_id)
  expect(creadoConMovil).toHaveLength(1)
  expect(creadoConMovil[0].cuerpo).toEqual({})
  const tokenConMovil = (conMovil.driver_id.replace(/[^0-9a-f]/g, '') + CREADO.token).slice(0, 64)
  const enlace = `${origen}/c#${tokenConMovil}`
  const esperado = `https://wa.me/${conMovil.whatsapp}?text=${encodeURIComponent(mensajeEsperado('es', { nombre: conMovil.nombre, empresa: CREADO.empresa, enlace }))}`
  expect(wa.url()).toBe(esperado)
  expect(decodeURIComponent(new URL(wa.url()).searchParams.get('text'))).toContain(enlace)
  await wa.close()
  await expect(fila(conMovil).getByTestId('acceso-estado')).toHaveText('Enlace creado, sin abrir')

  // «Copiar enlace» justo después copia EL MISMO enlace: crear otro dejaría sin valor el que ya se ha mandado.
  await fila(conMovil).getByRole('button', { name: 'Copiar enlace' }).click()
  await expect(fila(conMovil).getByRole('button', { name: 'Copiado' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(enlace)
  expect(s.pedidas.filter((p) => p.ruta === 'acceso' && p.id === conMovil.driver_id)).toHaveLength(1)

  // Sin móvil: WhatsApp sin destinatario.
  const [wa2] = await Promise.all([page.waitForEvent('popup'), fila(sinMovil).getByRole('button', { name: 'Mandar por WhatsApp' }).click()])
  await wa2.waitForURL(/wa\.me/)
  expect(wa2.url().startsWith('https://wa.me/?text=')).toBe(true)
  await wa2.close()

  // Ya abierto: «Renovar» pregunta con lo que dice el servidor y, al confirmar, pide `renovar: true`.
  await fila(abierto).getByRole('button', { name: 'Renovar', exact: true }).click()
  await expect(fila(abierto).getByRole('alertdialog')).toContainText('Si lo renuevas, el anterior deja de valer')
  await fila(abierto).getByRole('button', { name: 'Renovar el enlace' }).click()
  await expect(fila(abierto).getByTestId('acceso-estado')).toHaveText('Enlace creado, sin abrir')
  expect(s.pedidas.filter((p) => p.ruta === 'acceso' && p.id === abierto.driver_id).map((p) => p.cuerpo)).toEqual([{}, { renovar: true }])
  await foto(page, `06-acceso-mandado-${info.project.name}`)

  // 5 · Paso 4: la espera pregunta sola (cada 5 s) y, al llegar, enseña la revisión y lleva al Repaso.
  s.poner(estadoEn(4))
  await page.getByRole('button', { name: 'Esperar la primera revisión' }).click()
  await expect(page.getByRole('heading', { name: 'La primera revisión' })).toBeVisible()
  await expect(page.getByText('Esta pantalla se pone sola en cuanto llegue. No hace falta recargar.')).toBeVisible()
  await expect(page.getByText(/rueda de repuesto/)).toBeVisible()
  await foto(page, `07-esperando-${info.project.name}`)
  const antes = s.estadoPedidos
  s.poner(estadoEn(5))
  await expect(page.getByRole('heading', { name: 'Ha llegado la primera revisión' })).toBeVisible({ timeout: 12_000 })
  expect(s.estadoPedidos).toBeGreaterThan(antes)
  const rev = page.getByTestId('alta-revision')
  await expect(rev.getByTestId('matricula')).toHaveText(new RegExp(REVISION.furgoneta.matricula.replace(' ', '\\s*')))
  await expect(rev.getByTestId('alta-recibida')).toHaveText(`Recibida en el servidor el ${REVISION.dia.slice(8, 10)}-${REVISION.dia.slice(5, 7)} a las ${REVISION.hora}`)
  await expect(rev.getByText(`Hecha por ${REVISION.conductor.nombre}`)).toBeVisible()
  await expect(rev.locator('img')).toHaveCount(REVISION.fotos.length)
  await expect(rev.getByTestId('sello-foto')).toHaveCount(REVISION.fotos.length)
  await expect(page.getByText(/hecha a las/i)).toHaveCount(0)
  await foto(page, `08-ha-llegado-${info.project.name}`)
  // Y deja de preguntar: ya ha llegado.
  const despues = s.estadoPedidos
  await page.waitForTimeout(6_000)
  expect(s.estadoPedidos).toBe(despues)
  await page.getByRole('button', { name: 'Repasarla' }).click()
  await expect(page).toHaveURL(/\/panel\/repaso/)
  expect(fallos).toEqual([])
})

/* ── Sin correo de bienvenida, no se dice que se ha mandado ─────────────────────────────────────────────────── */
test('la pantalla final no dice que ha mandado un correo si el servidor no lo ha mandado', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.route(/\/api\/auth\/register$/, (r) => r.fulfill({ json: {
    access_token: jwt({ sub: 'a1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }), id: 'a1', name: 'X', role: 'admin', correo_bienvenida: false } }))
  await page.goto('/registro?sector=otra&plan=completo', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Transportes Pérez SL').fill('Transportes Pérez')
  await page.getByPlaceholder('admin@tuempresa.com').fill('oficina@transportes-perez.es')
  await page.locator('input[autocomplete="username"]').fill('oficina')
  await page.locator('input[autocomplete="new-password"]').first().fill('una-clave-larga')
  await page.locator('input[autocomplete="new-password"]').nth(1).fill('una-clave-larga')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Crear cuenta con plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible()
  await expect(page.getByTestId('alta-correo-enviado')).toHaveCount(0)
  await expect(page.getByText(/correo de bienvenida|email de bienvenida/i)).toHaveCount(0)
})

/* ── Conductores: «Mandar su acceso» por fila ───────────────────────────────────────────────────────────────── */
test('Conductores: cada fila dice el estado de su enlace y «Mandar su acceso» abre WhatsApp', async ({ page, context }, info) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const s = await servidorArranque(page, context, estadoEn(5))
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: ACCESOS.conductores.map((c) => ({
    id: c.driver_id, name: c.nombre, center: 'NORTE', active: true, phone: c.movil, email: c.email })) }))
  await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
  const botones = page.getByTestId('boton-acceso')
  await expect(botones).toHaveCount(ACCESOS.conductores.length)
  const sinEnlace = ACCESOS.conductores.find((c) => c.acceso.estado === 'sin_enlace')
  await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().click()
  const dialogo = page.getByRole('dialog', { name: `El acceso de ${sinEnlace.nombre}` })
  await expect(dialogo).toBeVisible()
  await expect(dialogo.getByTestId('acceso-estado')).toHaveText('Sin mandar')
  await foto(page, `09-conductores-acceso-${info.project.name}`)
  const [wa] = await Promise.all([page.waitForEvent('popup'), dialogo.getByRole('button', { name: 'Mandar por WhatsApp' }).click()])
  await wa.waitForURL(/wa\.me/)
  expect(wa.url().startsWith(`https://wa.me/${sinEnlace.whatsapp}?text=`)).toBe(true)
  await wa.close()
  await expect(dialogo.getByTestId('acceso-estado')).toHaveText('Enlace creado, sin abrir')
  // Anular el enlace: vuelve a «Sin mandar», y la fila también.
  await dialogo.getByRole('button', { name: 'Anular el enlace' }).click()
  await expect(dialogo.getByTestId('acceso-estado')).toHaveText('Sin mandar')
  expect(s.pedidas.filter((p) => p.ruta === 'acceso').map((p) => p.metodo)).toEqual(['POST', 'DELETE'])
  await page.keyboard.press('Escape')
  await expect(dialogo).toHaveCount(0)
  // El texto de la lista vacía ya no promete que «cada uno recibe su acceso».
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: [] }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(DICT['alta.drv.vacio'].es)).toBeVisible()
  await expect(page.getByText(/recibe su acceso/)).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* ── El inicio retoma el arranque y se entera sin recargar ──────────────────────────────────────────────────── */
test('el inicio enseña «Sigue con el arranque» y avisa al llegar la revisión, sin recargar', async ({ page, context }) => {
  await page.clock.install()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const s = await servidorArranque(page, context, estadoEn(4))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const entrada = page.getByTestId('inicio-arranque')
  await expect(entrada).toContainText('Sigue con el arranque · paso 4 de 4')
  await expect(entrada).toContainText('Ahora toca: La primera revisión.')
  // La guía de tres pasos de antes ya no sale (la sustituye el arranque).
  await expect(page.getByText('Ver cómo se hace')).toHaveCount(0)
  s.poner(estadoEn(5))
  await page.clock.fastForward(31_000)
  const llego = page.getByTestId('inicio-llego-revision')
  await expect(llego).toContainText('Ha llegado la primera revisión')
  await expect(llego.getByRole('link', { name: /Repasarla/ })).toHaveAttribute('href', '/panel/repaso')
  await expect(entrada).toHaveCount(0)
  // El menú llama «Inicio» al inicio.
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0)
})

test('el inicio lleva al arranque en el paso en que se quedó', async ({ page, context }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await servidorArranque(page, context, estadoEn(2))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('inicio-arranque').getByRole('link', { name: /Seguir/ }).click()
  await expect(page).toHaveURL(/\/panel\/arranque$/)
  await expect(page.getByRole('heading', { name: 'Tus conductores' })).toBeVisible()
  // El paso hecho se ve hecho, y se puede volver a él.
  await expect(page.getByRole('button', { name: '1 · Tus furgonetas · Hecho' })).toBeVisible()
  await alPaso(page, 1)
  await expect(page.getByRole('heading', { name: 'Tus furgonetas' })).toBeVisible()
  await expect(page.getByTestId('alta-ya-tienes')).toBeVisible()
})

test('el arranque sin sesión lleva a entrar al panel', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/panel\/login/)
})

/* ── 390 px: nada se sale ───────────────────────────────────────────────────────────────────────────────────── */
test('a 390 px ningún paso del arranque se sale de la pantalla', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const s = await servidorArranque(page, context, estadoEn(1))
  await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Tus furgonetas' })).toBeVisible()
  await page.getByTestId('alta-furgonetas-texto').fill(FURGONETAS.lineas.map((l) => l.texto).join('\n'))
  await page.getByRole('button', { name: 'Revisar', exact: true }).click()
  await expect(page.getByTestId('alta-lineas')).toBeVisible()
  await sinDesborde(page, 'paso 1')
  s.poner(estadoEn(3))
  for (const [n, titulo] of [[2, 'Tus conductores'], [3, 'Dales acceso'], [4, 'La primera revisión']]) {
    await alPaso(page, n)
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
    await sinDesborde(page, `paso ${n}`)
  }
  s.poner(estadoEn(5))
  await expect(page.getByRole('heading', { name: 'Ha llegado la primera revisión' })).toBeVisible({ timeout: 12_000 })
  await sinDesborde(page, 'la revisión')
})

/* ── Los seis idiomas: ni un texto del arranque en español fuera del español ───────────────────────────────── */
const SOLO_ES = Object.entries(DICT).filter(([k]) => k.startsWith('alta.'))
for (const lang of ['en', 'fr', 'de', 'it', 'pt']) {
  test(`el arranque en «${lang}» no deja textos en español`, async ({ page, context }) => {
    await entrarComoAdmin(page)
    await page.addInitScript((l) => localStorage.setItem('flota_lang', l), lang)
    await simularApi(page, 'vacio')
    const s = await servidorArranque(page, context, estadoEn(1))
    // Los textos en español que en este idioma se dicen distinto (y son frases: más de una palabra o de 8 letras).
    const espanol = SOLO_ES.map(([, v]) => v.es).filter((es, i) => es !== SOLO_ES[i][1][lang] && !es.includes('{') && (es.includes(' ') || es.length > 8))
    const revisa = async (donde) => {
      const texto = await page.getByRole('main').innerText()
      const sueltos = espanol.filter((es) => texto.includes(es))
      expect(sueltos, `${donde} (${lang})`).toEqual([])
    }
    await page.goto('/panel/arranque', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['alta.p1.titulo'][lang])
    await revisa('paso 1')
    s.poner(estadoEn(4))
    for (const n of [2, 3, 4]) {
      await alPaso(page, n)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT[`alta.p${n}.titulo`][lang])
      await revisa(`paso ${n}`)
    }
    s.poner(estadoEn(5))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(DICT['alta.p4.llego'][lang], { timeout: 12_000 })
    await revisa('la revisión')
  })
}

/* ── Importaciones: la pestaña «Turnos» solo si su pantalla abre ───────────────────────────────────────────── */
test('Importaciones: sin el módulo de turnos no sale la pestaña «Turnos»; con él, sí', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  let modulos = ['dashboard', 'vehiculos', 'conductores', 'importaciones', 'inspecciones', 'repaso', 'configuracion']
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'completo', sector: 'otra', status: 'trial', days_left: 10, modulos } }))
  await page.goto('/panel/importaciones', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tab', { name: /Furgonetas/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Turnos/ })).toHaveCount(0)
  await expect(page.getByText(DICT['alta.imp.sub'].es)).toBeVisible()
  modulos = [...modulos, 'turnos']
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tab', { name: /Turnos/ })).toBeVisible()
  await page.getByRole('tab', { name: /Turnos/ }).click()
  await expect(page.getByRole('link', { name: /Subir en Turnos/ })).toBeVisible()
})
