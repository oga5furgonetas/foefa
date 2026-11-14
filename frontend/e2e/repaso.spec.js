/* global process */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* EL REPASO DEL DÍA (14-11-2026, panel/pages/Repaso.jsx). La API va simulada con la forma del CONTRATO «Antes del
   perito» (§A y §B): el día sale de `fixtures/repaso-dia.json` (el que escribe el servidor con sus rutas de verdad) y
   cada prueba arma encima el caso que necesita, con los MISMOS campos de ese fichero. Así, si el servidor cambia la
   forma del día, estas pruebas lo notan.
   Las fotos se cambian por las de /demo para que el navegador cargue imágenes de verdad (sin red).
   Con FOTOS_REPASO=<carpeta> guarda las fotos de la pantalla en los tres temas. */

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', 'repaso-dia.json'), 'utf8'))
const VISTAS = ['frontal', 'trasera', 'lateral_izq', 'lateral_der']
const copia = (x) => JSON.parse(JSON.stringify(x))

const FOTO = {
  antes: { frontal: 'van-frontal.jpg', trasera: 'van-lateral-golpe-paragolpes-porton.jpg', lateral_izq: 'van-lateral.jpg', lateral_der: 'van-lateral.jpg' },
  hoy: { frontal: 'van-frontal.jpg', trasera: 'van-lateral-golpe-paragolpes-porton.jpg', lateral_izq: 'van-lateral-golpe-puerta.jpg', lateral_der: 'van-lateral-golpe-puerta-aleta.jpg' },
}

/* Una revisión con los cuatro lados de carrocería, hecha con la primera del fichero de ejemplo como plantilla. */
function revision(base, { id, matricula, conductor, hora, vistas = VISTAS, sinAnterior = [] }) {
  const plantilla = FIXTURE.revisiones[0]
  const ladoP = plantilla.lados.find((l) => l.anterior) || plantilla.lados[0]
  const antP = ladoP.anterior || FIXTURE.revisiones[0].lados.find((l) => l.anterior)?.anterior
  return {
    ...copia(plantilla),
    id,
    hora,
    estado: 'sin_repasar',
    vehiculo: { ...plantilla.vehiculo, id: `veh-${id}`, matricula },
    conductor: { ...(plantilla.conductor || { id: 'drv' }), nombre: conductor },
    ya_apuntado: [],
    lados: vistas.map((v, i) => ({
      ...copia(ladoP),
      photo_index: i + 1,
      vista: v,
      foto_url: `${base}/demo/${FOTO.hoy[v]}`,
      anterior: sinAnterior.includes(v) ? null : { ...copia(antP), photo_index: i + 1, foto_url: `${base}/demo/${FOTO.antes[v]}` },
      veredicto: null, veredicto_por: null, veredicto_at: null, golpe: null,
    })),
  }
}

function dia(base, { revisiones, esHoy = false, sinRevision } = {}) {
  const d = copia(FIXTURE)
  d.es_hoy = esHoy
  d.revisiones = revisiones ?? [
    revision(base, { id: 'rev-a', matricula: '5678 KLM', conductor: 'Ana L.', hora: '07:58' }),
    revision(base, { id: 'rev-b', matricula: '3456 BCD', conductor: 'Luis P.', hora: '08:21', vistas: ['frontal', 'trasera'] }),
  ]
  if (sinRevision) d.sin_revision = sinRevision
  return recontar(d)
}

// Las cuentas del día como las da el servidor (§A): las usa el número del menú.
function recontar(d) {
  const est = (r) => {
    if (!r.lados.length) return 'sin_lados'
    const n = r.lados.filter((l) => l.veredicto).length
    return !n ? 'sin_repasar' : n === r.lados.length ? 'repasada' : 'a_medias'
  }
  for (const r of d.revisiones) r.estado = est(r)
  const c = (e) => d.revisiones.filter((r) => r.estado === e).length
  d.cuentas = {
    ...d.cuentas, revisiones: d.revisiones.length, repasadas: c('repasada'), a_medias: c('a_medias'),
    sin_repasar: c('sin_repasar'), sin_lados: c('sin_lados'), sin_revision: d.sin_revision.length,
  }
  return d
}

/* El servidor de mentira: guarda lo que se le manda y contesta con la forma del contrato. */
async function abrir(page, elDia, { tema = null } = {}) {
  const srv = { dia: elDia, posts: [], deletes: [], pedidas: [] }
  await entrarComoAdmin(page)
  if (tema) {
    await page.addInitScript((t) => {
      localStorage.setItem('panel_theme', t)
      localStorage.setItem('panel_theme_elegido', '1')
    }, tema)
  }
  await simularApi(page, 'vacio')
  // Las fotos del fichero de ejemplo apuntan a un dominio que no existe: sin red, se cortan al momento.
  await page.route(/^https?:\/\/fotos\.ejemplo\//, (r) => r.abort())
  await page.route(/\/api\/repaso\/dia(\?|$)/, (r) => {
    srv.pedidas.push(new URL(r.request().url()).searchParams.toString())
    return r.fulfill({ json: srv.dia })
  })
  await page.route(/\/api\/inspections\/[^/]+\/repaso(\/\d+)?(\?|$)/, async (r) => {
    const req = r.request()
    const m = new URL(req.url()).pathname.match(/inspections\/([^/]+)\/repaso(?:\/(\d+))?$/)
    const rev = srv.dia.revisiones.find((x) => x.id === m[1])
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      srv.posts.push({ id: m[1], body })
      const lado = rev.lados.find((l) => l.photo_index === body.photo_index)
      Object.assign(lado, {
        veredicto: body.veredicto, veredicto_por: 'Admin Test', veredicto_at: '2026-11-12T16:05:00.000000+00:00',
        golpe: body.veredicto !== 'golpe' ? null : {
          golpe_id: `g-${srv.posts.length}`, pieza: body.part, panel: 'puerta', gravedad: body.severity,
          descripcion: body.description ?? null, box_2d: body.box_2d, ya_estaba: !lado.anterior && !!lado.vista,
          libro: { accion: 'nuevo', ledger_id: null },
        },
      })
      recontar(srv.dia)
      return r.fulfill({ json: {
        ok: true, inspection_id: rev.id, lado,
        libro: lado.golpe ? { accion: 'nuevo', ledger_id: null, pieza: lado.golpe.pieza, panel: 'puerta', desde: srv.dia.fecha, golpe_id: lado.golpe.golpe_id } : null,
        estado: rev.estado,
        cuentas_revision: { lados: rev.lados.length, con_veredicto: rev.lados.filter((l) => l.veredicto).length, golpes: rev.lados.filter((l) => l.golpe).length },
      } })
    }
    if (req.method() === 'DELETE') {
      const k = Number(m[2])
      srv.deletes.push({ id: m[1], k })
      const lado = rev.lados.find((l) => l.photo_index === k)
      const eraGolpe = !!lado.golpe
      Object.assign(lado, { veredicto: null, veredicto_por: null, veredicto_at: null, golpe: null })
      recontar(srv.dia)
      return r.fulfill({ json: {
        ok: true, inspection_id: rev.id, photo_index: k, libro: eraGolpe ? { accion: 'borrado' } : null, estado: rev.estado,
        cuentas_revision: { lados: rev.lados.length, con_veredicto: rev.lados.filter((l) => l.veredicto).length, golpes: 0 },
      } })
    }
    return r.fallback()
  })
  await page.goto('/panel/repaso', { waitUntil: 'domcontentloaded' })
  return srv
}

const fotos = process.env.FOTOS_REPASO
async function foto(page, nombre) {
  if (!fotos) return
  fs.mkdirSync(fotos, { recursive: true })
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(fotos, `${nombre}-${test.info().project.name}.png`), fullPage: true })
}

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(String(e.message).slice(0, 200)))
  return fallos
}

const tab = (page, n) => page.getByTestId(`lado-${n}`)
const botonIgual = (page) => page.getByTestId('btn-igual')

test('Repaso · el fichero de ejemplo del servidor se pinta tal cual', async ({ page }) => {
  const fallos = vigilar(page)
  const srv = await abrir(page, copia(FIXTURE))
  const r0 = FIXTURE.revisiones[0]
  await expect(page.getByTestId('mesa').getByTestId('matricula').first()).toContainText(r0.vehiculo.matricula)
  // Se empieza por el primer lado sin decidir.
  const pendiente = r0.lados.find((l) => !l.veredicto)
  if (pendiente) await expect(tab(page, pendiente.photo_index)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab')).toHaveCount(r0.lados.length)
  for (const v of FIXTURE.sin_revision) {
    if (v.matricula) await expect(page.getByTestId('sin-revision')).toContainText(v.matricula)
  }
  // El centro elegido en el panel va en la petición.
  expect(srv.pedidas.some((q) => q.includes('center=NORTE'))).toBe(true)
  expect(fallos).toEqual([])
})

/* El fichero del servidor TAL CUAL, sin armar nada encima: los veredictos ya dados (con marcas sin microsegundos), el
   golpe con su caja, «Ya apuntado» con ledger_id null (y una entrada de Revisión rápida sin golpe_id ni vista), la
   furgoneta sin revisión con su asignada, y el lado de la otra furgoneta que no tiene foto anterior. */
test('Repaso · el fichero del servidor: lo ya decidido, el golpe, «Ya apuntado» y el lado sin foto anterior', async ({ page }) => {
  const fallos = vigilar(page)
  const srv = await abrir(page, copia(FIXTURE))
  const [r0, r1] = FIXTURE.revisiones
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  // Cada pestaña lleva el veredicto que dio el servidor.
  for (const l of r0.lados) await expect(tab(page, l.photo_index)).toHaveAttribute('data-veredicto', l.veredicto || '')
  await expect(page.getByTestId('foto-hoy').getByTestId('sello-foto')).toContainText(r0.hora)
  // «Ya apuntado»: una fila por entrada, aunque ninguna tenga ledger_id.
  expect(r0.ya_apuntado.every((a) => a.ledger_id === null)).toBe(true)
  await expect(page.getByTestId('ya-apuntado').locator('li')).toHaveCount(r0.ya_apuntado.length)
  for (const a of r0.ya_apuntado) await expect(page.getByTestId('ya-apuntado')).toContainText(a.pieza)
  // El golpe ya marcado: su pieza, quién y a qué hora, y su caja sobre la foto de hoy.
  const conGolpe = r0.lados.find((l) => l.golpe)
  await tab(page, conGolpe.photo_index).click()
  const decidido = page.getByTestId('decidido')
  await expect(decidido).toContainText(conGolpe.golpe.pieza)
  await expect(decidido).toContainText(`Golpe apuntado por ${conGolpe.veredicto_por} a las ${hora(conGolpe.veredicto_at)}.`)
  await expect(page.getByTestId('foto-hoy-caja')).toBeVisible()
  // El que no se ve bien, igual.
  const noSeVe = r0.lados.find((l) => l.veredicto === 'no_se_ve')
  if (noSeVe) {
    await tab(page, noSeVe.photo_index).click()
    await expect(decidido).toContainText(`Marcado «no se ve bien» por ${noSeVe.veredicto_por} a las ${hora(noSeVe.veredicto_at)}.`)
  }
  // La furgoneta sin revisión, con a quién estaba asignada.
  for (const v of FIXTURE.sin_revision) {
    if (v.asignada_a?.nombre) await expect(page.getByTestId('sin-revision')).toContainText(`asignada a ${v.asignada_a.nombre}`)
  }
  // Se termina la primera (sus lados sin decidir) y pasa a la segunda furgoneta.
  const pendientes = r0.lados.filter((l) => !l.veredicto)
  await tab(page, pendientes[0].photo_index).click()
  for (let i = 0; i < pendientes.length; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 1)
  }
  expect(srv.posts.map((p) => `${p.id}:${p.body.photo_index}:${p.body.veredicto}`))
    .toEqual(pendientes.map((l) => `${r0.id}:${l.photo_index}:igual`))
  await expect(page.getByTestId('mesa').getByTestId('matricula').first()).toContainText(r1.vehiculo.matricula)
  // El lado de la segunda sin foto anterior: punto de partida, sin «Antes».
  const sinAnt = r1.lados.find((l) => !l.anterior)
  expect(sinAnt, 'el fichero del servidor trae un lado sin foto anterior').toBeTruthy()
  await tab(page, sinAnt.photo_index).click()
  await expect(page.getByTestId('sin-anterior')).toHaveText('No hay foto anterior de este lado. Esta queda como punto de partida.')
  await expect(page.getByTestId('foto-antes')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tiene un golpe' })).toBeVisible()
  expect(fallos).toEqual([])
})

test('Repaso · el recorrido entero con el ratón, hasta «Repaso terminado»', async ({ page, baseURL }) => {
  const fallos = vigilar(page)
  const srv = await abrir(page, dia(baseURL))
  await expect(page.getByTestId('foto-antes')).toBeVisible()
  await expect(page.getByTestId('foto-hoy')).toBeVisible()
  await expect(page.getByTestId('foto-hoy').getByTestId('sello-foto')).toContainText('07:58')
  await expect(page.getByText('la llevó')).toBeVisible()
  for (let i = 0; i < 6; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 1)
  }
  await expect(page.getByTestId('terminado')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Repaso terminado' })).toBeVisible()
  expect(srv.posts.map((p) => `${p.id}:${p.body.photo_index}:${p.body.veredicto}`)).toEqual([
    'rev-a:1:igual', 'rev-a:2:igual', 'rev-a:3:igual', 'rev-a:4:igual', 'rev-b:1:igual', 'rev-b:2:igual',
  ])
  await expect(page.getByTestId('res-sinnuevos')).toContainText('2')
  await expect(page.getByTestId('res-pendientes')).toContainText('0')
  expect(fallos).toEqual([])
})

test('Repaso · con el teclado: → igual, N no se ve, ← vuelve, Z amplía y Esc cierra', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'el teclado es del ordenador')
  const srv = await abrir(page, dia(baseURL))
  await expect(tab(page, 1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(tab(page, 2)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('n')
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 2)).toHaveAttribute('data-veredicto', 'no_se_ve')
  // ← vuelve al lado anterior (ya decidido) y → pasa sin volver a mandar nada.
  await page.keyboard.press('ArrowLeft')
  await expect(tab(page, 2)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('decidido')).toContainText('no se ve bien')
  await page.keyboard.press('ArrowRight')
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  expect(srv.posts).toHaveLength(2)
  await page.keyboard.press('z')
  await expect(page.getByTestId('ampliada')).toBeVisible()
  await expect(page.getByTestId('ampliada').locator('img')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ampliada')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(tab(page, 4)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('g')
  await expect(page.getByTestId('form-golpe')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('form-golpe')).toHaveCount(0)
  expect(srv.posts.map((p) => p.body)).toEqual([
    { photo_index: 1, veredicto: 'igual' }, { photo_index: 2, veredicto: 'no_se_ve' }, { photo_index: 3, veredicto: 'igual' },
  ])
  await expect(page.getByTestId('teclas')).toBeVisible()
})

test('Repaso · golpe nuevo: la caja sobre la foto de hoy, la pieza, la gravedad y la nota', async ({ page, baseURL }) => {
  const fallos = vigilar(page)
  const srv = await abrir(page, dia(baseURL))
  await tab(page, 3).click()   // lateral izquierdo
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  const form = page.getByTestId('form-golpe')
  await expect(form).toBeVisible()
  await expect(form.getByRole('button', { name: 'Guardar el golpe' })).toBeDisabled()
  await expect(page.getByTestId('golpe-falta')).toHaveText('Falta la caja sobre la foto de hoy.')
  // La caja: del 25 % al 50 % de ancho y del 40 % al 65 % de alto de la foto de hoy.
  const capa = page.getByTestId('foto-hoy-capa')
  await capa.scrollIntoViewIfNeeded()
  const b = await capa.boundingBox()
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.40)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5, { steps: 4 })
  await page.mouse.move(b.x + b.width * 0.50, b.y + b.height * 0.65, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('foto-hoy-caja')).toBeVisible()
  await form.getByRole('button', { name: 'Puerta lateral corredera izquierda' }).click()
  await expect(page.getByTestId('golpe-falta')).toHaveText('Falta la gravedad.')
  await form.getByRole('button', { name: 'Moderado' }).click()
  await form.getByLabel('Nota (opcional)').fill('Bollo con pintura saltada')
  await foto(page, 'repaso-golpe')
  await form.getByRole('button', { name: 'Guardar el golpe' }).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  const { body } = srv.posts[0]
  expect(body).toMatchObject({
    photo_index: 3, veredicto: 'golpe', part: 'Puerta lateral corredera izquierda', severity: 'moderado',
    description: 'Bollo con pintura saltada',
  })
  const esperada = [400, 250, 650, 500]
  expect(body.box_2d).toHaveLength(4)
  body.box_2d.forEach((v, i) => expect(Math.abs(v - esperada[i])).toBeLessThanOrEqual(4))
  // Pasa al lado siguiente, y el golpe ya sale en «Ya apuntado en esta furgoneta».
  await expect(tab(page, 4)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 3)).toHaveAttribute('data-veredicto', 'golpe')
  await expect(page.getByTestId('ya-apuntado')).toContainText('Puerta lateral corredera izquierda')
  await expect(page.getByTestId('res-golpe')).toContainText('1')
  // Se acaba el día (el lateral derecho, luego los dos primeros lados que se saltaron y la otra furgoneta): el golpe
  // sale en «Golpes nuevos» y abre su revisión.
  for (let i = 0; i < 5; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 2)
  }
  await expect(page.getByTestId('terminado')).toBeVisible()
  await page.getByTestId('golpes-del-dia').getByRole('button').first().click()
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('decidido')).toContainText('Puerta lateral corredera izquierda')
  await expect(page.getByTestId('foto-hoy-caja')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Repaso · deshacer el último veredicto, y el de un lado ya decidido', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL))
  await botonIgual(page).click()
  await expect(tab(page, 2)).toHaveAttribute('aria-selected', 'true')
  const ultimo = page.getByTestId('ultimo')
  await expect(ultimo).toContainText('Frontal de 5678 KLM, igual')
  await ultimo.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(() => srv.deletes).toEqual([{ id: 'rev-a', k: 1 }])
  await expect(tab(page, 1)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 1)).toHaveAttribute('data-veredicto', '')
  await expect(botonIgual(page)).toBeVisible()
  // Un lado decidido se deshace desde el propio lado.
  await page.getByRole('button', { name: 'No se ve bien' }).click()
  await tab(page, 1).click()
  await page.getByTestId('decidido').getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(() => srv.deletes.length).toBe(2)
  await expect(tab(page, 1)).toHaveAttribute('data-veredicto', '')
})

test('Repaso · un lado sin foto anterior queda como punto de partida', async ({ page, baseURL }) => {
  const elDia = dia(baseURL, {
    revisiones: [revision(baseURL, { id: 'rev-a', matricula: '5678 KLM', conductor: 'Ana L.', hora: '07:58', sinAnterior: ['frontal'] })],
  })
  const srv = await abrir(page, elDia)
  await expect(page.getByTestId('sin-anterior')).toHaveText('No hay foto anterior de este lado. Esta queda como punto de partida.')
  await expect(page.getByTestId('foto-antes')).toHaveCount(0)
  await expect(page.getByTestId('foto-hoy')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiene un golpe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hay un golpe nuevo' })).toHaveCount(0)
  await foto(page, 'repaso-sin-anterior')
  await page.getByRole('button', { name: 'Sin golpes a la vista' }).click()
  await expect.poll(() => srv.posts.map((p) => p.body)).toEqual([{ photo_index: 1, veredicto: 'igual' }])
  await tab(page, 1).click()
  await expect(page.getByTestId('decidido')).toContainText('sin golpes a la vista')
})

test('Repaso · un día sin revisiones lo dice, con las furgonetas que faltan', async ({ page, baseURL }) => {
  const fallos = vigilar(page)
  await abrir(page, dia(baseURL, { revisiones: [], esHoy: true }))
  await expect(page.getByTestId('repaso-vacio')).toContainText('Hoy todavía no ha llegado ninguna revisión')
  for (const v of FIXTURE.sin_revision) {
    if (v.matricula) await expect(page.getByTestId('sin-revision')).toContainText(v.matricula)
  }
  await foto(page, 'repaso-vacio')
  expect(fallos).toEqual([])
})

test('Repaso · error del servidor con «Reintentar», y sin conexión', async ({ page, baseURL }) => {
  let modo = 'error'
  const srv = await abrir(page, dia(baseURL))
  await page.route(/\/api\/repaso\/dia(\?|$)/, (r) => {
    if (modo === 'error') return r.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' })
    if (modo === 'red') return r.abort('internetdisconnected')
    return r.fulfill({ json: srv.dia })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const caja = page.getByTestId('repaso-error')
  await expect(caja).toContainText('No se ha podido cargar el repaso')
  await expect(caja).toContainText('El servidor ha dado un error')
  await foto(page, 'repaso-error')
  modo = 'red'
  await caja.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByTestId('repaso-error')).toContainText('Sin conexión')
  modo = 'bien'
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByTestId('mesa')).toBeVisible()
  await expect(page.getByTestId('repaso-error')).toHaveCount(0)
})

test('Repaso · a 390 px no hay nada que se salga de lado', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await abrir(page, dia(baseURL))
  await expect(page.getByTestId('foto-hoy')).toBeVisible()
  await foto(page, 'repaso-390')
  const sobra = () => page.evaluate(() => {
    const el = document.scrollingElement
    const main = document.querySelector('main')
    return Math.max(el.scrollWidth - el.clientWidth, main ? main.scrollWidth - main.clientWidth : 0)
  })
  expect(await sobra()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  await expect(page.getByTestId('form-golpe')).toBeVisible()
  expect(await sobra()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Cancelar' }).click()
  for (let i = 0; i < 6; i++) await botonIgual(page).click()
  await expect(page.getByTestId('terminado')).toBeVisible()
  expect(await sobra()).toBeLessThanOrEqual(0)
})

test('Repaso · el número del menú baja al repasar', async ({ page, baseURL, isMobile }) => {
  await abrir(page, dia(baseURL, { esHoy: true }))
  await expect(page.getByTestId('mesa')).toBeVisible()
  const numero = isMobile
    ? () => page.getByRole('button', { name: /^Menú/ }).first()
    : () => page.locator('aside a[href="/panel/repaso"] span')
  if (isMobile) await expect(numero()).toHaveAttribute('aria-label', /· 2$/)
  else await expect(numero()).toHaveText('2')
  for (let i = 0; i < 4; i++) await botonIgual(page).click()
  await expect(page.getByRole('tab')).toHaveCount(2)   // ya en la segunda furgoneta
  if (isMobile) await expect(numero()).toHaveAttribute('aria-label', /· 1$/)
  else await expect(numero()).toHaveText('1')
  await botonIgual(page).click()
  await botonIgual(page).click()
  await expect(page.getByTestId('terminado')).toBeVisible()
  if (isMobile) await expect(numero()).toHaveAttribute('aria-label', 'Menú')
  else await expect(numero()).toHaveCount(0)
})

test('Repaso · el deslizador y la vuelta a las dos fotos', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'el conmutador va a partir de la anchura de tableta')
  await abrir(page, dia(baseURL))
  await page.getByRole('button', { name: 'Con deslizador' }).click()
  await expect(page.getByTestId('deslizador')).toBeVisible()
  await expect(page.getByTestId('deslizador').getByTestId('sello-foto')).toHaveCount(2)
  await foto(page, 'repaso-deslizador')
  await page.getByRole('button', { name: 'Una junto a otra' }).click()
  await expect(page.getByTestId('foto-antes')).toBeVisible()
})

/* Las fotos para mirar: la mesa en los tres temas del panel, y lo demás en el de por defecto. */
for (const tema of ['hibrido', 'light', 'dark']) {
  test(`Repaso · fotos de la pantalla (tema ${tema})`, async ({ page, baseURL }) => {
    test.skip(!fotos, 'solo con FOTOS_REPASO')
    const elDia = dia(baseURL, { esHoy: true })
    elDia.revisiones[0].ya_apuntado = [{
      ledger_id: null, golpe_id: null, pieza: 'Paragolpes trasero', panel: 'paragolpes', gravedad: 'leve', desde: '2026-10-02',
      inspection_id: 'otra', vista: null, origen: 'revision_rapida', en_taller: true, de_esta_revision: false,
    }]
    await abrir(page, elDia, { tema })
    await expect(page.getByTestId('foto-hoy').locator('img')).toBeVisible()
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="foto-"] img')].every((i) => i.complete && i.naturalWidth > 0))
    await foto(page, `repaso-mesa-${tema}`)
    if (tema !== 'hibrido') return
    await page.keyboard.press('z').catch(() => {})
    if (await page.getByTestId('ampliada').count()) {
      await foto(page, 'repaso-ampliada')
      await page.keyboard.press('Escape')
    }
    for (let i = 0; i < 6; i++) await botonIgual(page).click()
    await expect(page.getByTestId('terminado')).toBeVisible()
    await foto(page, 'repaso-terminado')
  })
}
