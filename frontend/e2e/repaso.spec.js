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

/* El servidor de mentira: guarda lo que se le manda y contesta con la forma del contrato.
   `srv.retraso` (ms) hace que tarde en contestar a los POST; `srv.falloPost` / `srv.falloDelete` ({ status, detail })
   hacen que conteste con ese error; `srv.libro` cambia lo que dice del libro al apuntar un golpe (y `srv.libroDeshacer`
   al deshacerlo: «borrado» si no se dice); `srv.diaDe(fecha)`
   da otro día cuando se pide una fecha concreta, y `srv.retrasoDia` hace que tarde en darlo. */
async function abrir(page, elDia, { tema = null, idioma = null } = {}) {
  const srv = { dia: elDia, posts: [], deletes: [], pedidas: [], retraso: 0, retrasoDia: 0, falloPost: null, falloDelete: null, libro: null, libroDeshacer: null, diaDe: null }
  await entrarComoAdmin(page)
  if (tema) {
    await page.addInitScript((t) => {
      localStorage.setItem('panel_theme', t)
      localStorage.setItem('panel_theme_elegido', '1')
    }, tema)
  }
  if (idioma) await page.addInitScript((l) => localStorage.setItem('flota_lang', l), idioma)
  await simularApi(page, 'vacio')
  // Las fotos del fichero de ejemplo apuntan a un dominio que no existe: sin red, se cortan al momento.
  await page.route(/^https?:\/\/fotos\.ejemplo\//, (r) => r.abort())
  await page.route(/\/api\/repaso\/dia(\?|$)/, async (r) => {
    const q = new URL(r.request().url()).searchParams
    srv.pedidas.push(q.toString())
    const otro = q.get('fecha') && srv.diaDe ? srv.diaDe(q.get('fecha')) : null
    if (otro && srv.retrasoDia) await new Promise((ok) => setTimeout(ok, srv.retrasoDia))
    return r.fulfill({ json: otro || srv.dia })
  })
  await page.route(/\/api\/inspections\/[^/]+\/repaso(\/\d+)?(\?|$)/, async (r) => {
    const req = r.request()
    const m = new URL(req.url()).pathname.match(/inspections\/([^/]+)\/repaso(?:\/(\d+))?$/)
    const rev = srv.dia.revisiones.find((x) => x.id === m[1])
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      srv.posts.push({ id: m[1], body })
      if (srv.retraso) await new Promise((ok) => setTimeout(ok, srv.retraso))
      if (srv.falloPost) return r.fulfill({ status: srv.falloPost.status, json: { detail: srv.falloPost.detail } })
      const lado = rev.lados.find((l) => l.photo_index === body.photo_index)
      Object.assign(lado, {
        veredicto: body.veredicto, veredicto_por: 'Admin Test', veredicto_at: '2026-11-12T16:05:00.000000+00:00',
        golpe: body.veredicto !== 'golpe' ? null : {
          golpe_id: `g-${srv.posts.length}`, pieza: body.part, pieza_clave: body.pieza_clave ?? null, panel: 'puerta',
          gravedad: body.severity, descripcion: body.description ?? null, box_2d: body.box_2d,
          ya_estaba: !lado.anterior && !!lado.vista, libro: { accion: srv.libro?.accion || 'nuevo', ledger_id: null },
        },
      })
      recontar(srv.dia)
      return r.fulfill({ json: {
        ok: true, inspection_id: rev.id, lado,
        libro: !lado.golpe ? null : srv.libro || {
          accion: 'nuevo', ledger_id: null, pieza: lado.golpe.pieza, pieza_clave: lado.golpe.pieza_clave, panel: 'puerta',
          desde: srv.dia.fecha, golpe_id: lado.golpe.golpe_id,
        },
        estado: rev.estado,
        cuentas_revision: { lados: rev.lados.length, con_veredicto: rev.lados.filter((l) => l.veredicto).length, golpes: rev.lados.filter((l) => l.golpe).length },
      } })
    }
    if (req.method() === 'DELETE') {
      const k = Number(m[2])
      srv.deletes.push({ id: m[1], k })
      if (srv.falloDelete) return r.fulfill({ status: srv.falloDelete.status, json: { detail: srv.falloDelete.detail } })
      const lado = rev.lados.find((l) => l.photo_index === k)
      const eraGolpe = !!lado.golpe
      Object.assign(lado, { veredicto: null, veredicto_por: null, veredicto_at: null, golpe: null })
      recontar(srv.dia)
      return r.fulfill({ json: {
        ok: true, inspection_id: rev.id, photo_index: k, libro: eraGolpe ? (srv.libroDeshacer || { accion: 'borrado' }) : null, estado: rev.estado,
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
    photo_index: 3, veredicto: 'golpe', pieza_clave: 'corredera_izq', part: 'Puerta lateral corredera izquierda',
    severity: 'moderado', description: 'Bollo con pintura saltada',
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

/* ── Lo que encontró la revisión del 14-11-2026 (ARREGLOS-1, zona Repaso) ── */

// Una caja del 25 % al 50 % de ancho y del 40 % al 65 % de alto de la foto de hoy.
async function dibujarCaja(page) {
  const capa = page.getByTestId('foto-hoy-capa')
  await capa.scrollIntoViewIfNeeded()
  const b = await capa.boundingBox()
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.40)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5, { steps: 4 })
  await page.mouse.move(b.x + b.width * 0.50, b.y + b.height * 0.65, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('foto-hoy-caja')).toBeVisible()
}
const fotosCargadas = (page) => page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('[data-testid="mesa"] img')]
  return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
})

test('Repaso · si mientras guarda se cambia de lado, al contestar no salta a otro', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL))
  srv.retraso = 1200
  await botonIgual(page).click()
  await tab(page, 3).click()
  await expect(tab(page, 1)).toHaveAttribute('data-veredicto', 'igual')
  await page.waitForTimeout(200)
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  expect(srv.posts).toHaveLength(1)
})

test('Repaso · lo que contesta el servidor después de cambiar de día no se mete en el día nuevo', async ({ page, baseURL }) => {
  const fallos = vigilar(page)
  const srv = await abrir(page, dia(baseURL))
  const otro = dia(baseURL, { revisiones: [revision(baseURL, { id: 'rev-c', matricula: '1111 BBB', conductor: 'Rosa M.', hora: '09:10' })] })
  otro.fecha = '2026-11-11'
  srv.diaDe = () => otro
  srv.retraso = 800
  srv.retrasoDia = 1800      // el día nuevo llega DESPUÉS que la respuesta del veredicto
  await expect(page.getByTestId('mesa')).toBeVisible()
  await botonIgual(page).click()
  await page.getByRole('button', { name: 'Día anterior' }).click()
  await expect(page.getByTestId('mesa').getByTestId('matricula').first()).toContainText('1111 BBB')
  await expect(page.getByTestId('repaso-aviso'))
    .toHaveText('Se ha guardado lo que marcaste antes de cambiar de día: Frontal de 5678 KLM, igual.')
  await expect(page.getByTestId('ultimo')).toHaveCount(0)
  await expect(tab(page, 1)).toHaveAttribute('data-veredicto', '')
  await expect(page.getByText('Sin conexión')).toHaveCount(0)
  expect(srv.posts).toHaveLength(1)
  expect(fallos).toEqual([])
})

for (const idioma of ['es', 'de']) {
  test(`Repaso · a 1280 px los lados caben con sus marcas, sin cortar nada (${idioma})`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'es la anchura de un portátil')
    await page.setViewportSize({ width: 1280, height: 800 })
    await abrir(page, copia(FIXTURE), { idioma })
    const lista = page.getByRole('tablist')
    await expect(lista.getByRole('tab')).toHaveCount(FIXTURE.revisiones[0].lados.length)
    const caja = await lista.boundingBox()
    for (const t of await lista.getByRole('tab').all()) {
      const b = await t.boundingBox()
      expect(b.x).toBeGreaterThanOrEqual(caja.x - 0.5)
      expect(b.x + b.width).toBeLessThanOrEqual(caja.x + caja.width + 0.5)
    }
    expect(await lista.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    const mesa = await page.getByTestId('mesa').boundingBox()
    const modo = await page.getByTestId('mesa').getByRole('group').boundingBox()
    expect(modo.x + modo.width).toBeLessThanOrEqual(mesa.x + mesa.width + 0.5)
    // El paso «1 de 2» va en la misma línea que la matrícula, no suelto en otra.
    const mat = await page.getByTestId('mesa').getByTestId('matricula').first().boundingBox()
    const paso = await page.getByTestId('paso').boundingBox()
    expect(Math.abs((paso.y + paso.height / 2) - (mat.y + mat.height / 2))).toBeLessThan(8)
  })
}

test('Repaso · con el foco en una pestaña o en un botón, las teclas son suyas', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'el teclado es del ordenador')
  const srv = await abrir(page, dia(baseURL))
  // Un solo punto de tabulación para las pestañas: la elegida.
  await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
  await tab(page, 2).click()
  await page.keyboard.press('ArrowRight')
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 3)).toBeFocused()
  await page.keyboard.press('End')
  await expect(tab(page, 4)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(tab(page, 3)).toBeFocused()
  await page.keyboard.press('n')
  await page.getByRole('button', { name: 'Con deslizador' }).focus()
  await page.keyboard.press('n')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  expect(srv.posts).toHaveLength(0)
  // Tras decidir con el ratón, el foco vuelve a la mesa y las teclas siguen sirviendo.
  await botonIgual(page).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  await expect(tab(page, 4)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => srv.posts.map((p) => p.body.photo_index)).toEqual([3, 4])
})

test('Repaso · el deslizador pone «Antes» a la izquierda y «Hoy» a la derecha, con la caja del golpe', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el conmutador va a partir de la anchura de tableta')
  await abrir(page, copia(FIXTURE))
  const conGolpe = FIXTURE.revisiones[0].lados.find((l) => l.golpe)
  await tab(page, conGolpe.photo_index).click()
  await page.getByRole('button', { name: 'Con deslizador' }).click()
  const d = page.getByTestId('deslizador')
  const antes = d.getByText('Antes', { exact: true })
  const hoyR = d.getByText('Hoy', { exact: true })
  expect((await antes.boundingBox()).x).toBeLessThan((await hoyR.boundingBox()).x)
  expect(await antes.evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px')
  // Los sellos, cada uno debajo de su foto: el de la anterior a la izquierda.
  const sellos = d.getByTestId('sello-foto')
  await expect(sellos.nth(0)).toContainText(conGolpe.anterior.hora)
  await expect(sellos.nth(1)).toContainText(FIXTURE.revisiones[0].hora)
  expect((await sellos.nth(0).boundingBox()).x).toBeLessThan((await sellos.nth(1).boundingBox()).x)
  await expect(d.getByTestId('deslizador-caja')).toHaveCount(1)
  await expect(d.getByRole('img', { name: 'Foto de hoy de este lado' })).toHaveCount(1)
  await expect(d.getByRole('img', { name: 'Foto anterior de este lado' })).toHaveCount(1)
})

test('Repaso · con fotos verticales del móvil el sello no se corta', async ({ page, baseURL }) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1400" viewBox="0 0 600 1400"><rect width="600" height="1400" fill="#7d8a90"/><rect x="80" y="500" width="440" height="500" fill="#e9edef"/></svg>'
  await page.route(/\/vertical\.svg$/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: svg }))
  const rv = revision(baseURL, { id: 'rev-v', matricula: '5678 KLM', conductor: 'Ana L.', hora: '07:58' })
  for (const l of rv.lados) { l.foto_url = `${baseURL}/vertical.svg`; l.anterior.foto_url = `${baseURL}/vertical.svg` }
  await abrir(page, dia(baseURL, { revisiones: [rv] }))
  await fotosCargadas(page)
  for (const id of ['foto-antes', 'foto-hoy']) {
    const sello = page.getByTestId(id).getByTestId('sello-foto')
    await expect(sello).toContainText('Ana L.')
    expect(await sello.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    const s = await sello.boundingBox()
    const f = await page.getByTestId(id).boundingBox()
    expect(s.x + s.width).toBeLessThanOrEqual(f.x + f.width + 0.5)
    // El marco tiene la forma de la foto (sin franjas a los lados).
    expect(Math.abs(f.width / f.height - 600 / 1400)).toBeLessThan(0.02)
  }
})

test('Repaso · mientras se dibuja la caja no hay nada encima de la foto, y Esc no tira lo apuntado', async ({ page, baseURL, isMobile }) => {
  const srv = await abrir(page, dia(baseURL))
  await tab(page, 3).click()
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  const form = page.getByTestId('form-golpe')
  await expect(form).toContainText('Dibuja una caja sobre el golpe en la foto de hoy.')
  await expect(page.getByTestId('foto-hoy')).not.toContainText('Dibuja')
  await dibujarCaja(page)
  await form.getByRole('button', { name: 'Otra pieza' }).click()
  const campo = form.getByPlaceholder('¿Qué pieza es?')
  await campo.fill('Moldura del techo')
  await form.getByRole('button', { name: 'Leve' }).click()
  if (!isMobile) {
    // Esc en el campo solo lo suelta; otro Esc cierra el formulario, y al volver a abrirlo está todo.
    await campo.click()
    await page.keyboard.press('Escape')
    await expect(form).toBeVisible()
    await expect(campo).not.toBeFocused()
    await page.keyboard.press('Escape')
    await expect(form).toHaveCount(0)
    await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
    await expect(form.getByPlaceholder('¿Qué pieza es?')).toHaveValue('Moldura del techo')
    await expect(form.getByRole('button', { name: 'Otra pieza' })).toHaveAttribute('aria-pressed', 'true')
    await expect(form.getByRole('button', { name: 'Leve' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('foto-hoy-caja')).toBeVisible()
  }
  await form.getByRole('button', { name: 'Guardar el golpe' }).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  expect(srv.posts[0].body).toMatchObject({ pieza_clave: 'otra', part: 'Moldura del techo', severity: 'leve' })
  // «Cancelar» sí lo tira.
  await tab(page, 4).click()
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  await dibujarCaja(page)
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  await expect(page.getByTestId('foto-hoy-caja')).toHaveCount(0)
})

test('Repaso · una sola revisión: «Has repasado la revisión», en singular', async ({ page, baseURL }) => {
  const elDia = dia(baseURL, { esHoy: true, revisiones: [revision(baseURL, { id: 'rev-b', matricula: '3456 BCD', conductor: 'Luis P.', hora: '08:21', vistas: ['frontal', 'trasera'] })] })
  const srv = await abrir(page, elDia)
  await botonIgual(page).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  await botonIgual(page).click()
  await expect(page.getByTestId('terminado')).toContainText('Has repasado la revisión con fotos de hoy.')
})

test('Repaso · en un lado sin foto anterior, «Lo último» dice «sin golpes a la vista»', async ({ page, baseURL }) => {
  const elDia = dia(baseURL, {
    revisiones: [revision(baseURL, { id: 'rev-a', matricula: '5678 KLM', conductor: 'Ana L.', hora: '07:58', sinAnterior: ['frontal'] })],
  })
  await abrir(page, elDia)
  await page.getByRole('button', { name: 'Sin golpes a la vista' }).click()
  await expect(page.getByTestId('ultimo')).toContainText('Lo último: Frontal de 5678 KLM, sin golpes a la vista.')
  await expect(tab(page, 1)).toHaveAttribute('aria-label', 'Frontal: sin golpes a la vista')
})

test('Repaso · la vista ampliada retiene el foco y no decide nada', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'el teclado es del ordenador')
  const srv = await abrir(page, dia(baseURL))
  await expect(page.getByTestId('foto-hoy')).toBeVisible()
  await page.keyboard.press('z')
  const amp = page.getByTestId('ampliada')
  await expect(amp).toBeVisible()
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab')
    expect(await amp.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('n')
  await page.waitForTimeout(300)
  await expect(amp).toBeVisible()
  expect(srv.posts).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(amp).toHaveCount(0)
})

test('Repaso · si la foto de hoy no carga, no se puede abrir un golpe y se dice qué hacer', async ({ page, baseURL }) => {
  const elDia = dia(baseURL)
  elDia.revisiones[0].lados[0].foto_url = 'https://fotos.ejemplo/rota.jpg'
  const srv = await abrir(page, elDia)
  await expect(page.getByTestId('foto-hoy-fallo')).toBeVisible()
  await expect(page.getByTestId('hoy-rota')).toContainText('márcalo como «No se ve bien»')
  await expect(page.getByRole('button', { name: 'Hay un golpe nuevo' })).toBeDisabled()
  await page.keyboard.press('g')
  await expect(page.getByTestId('form-golpe')).toHaveCount(0)
  await page.getByRole('button', { name: 'No se ve bien' }).click()
  await expect.poll(() => srv.posts.map((p) => p.body)).toEqual([{ photo_index: 1, veredicto: 'no_se_ve' }])
})

test('Repaso · las dos fotos llenan el ancho de la mesa, enteras', async ({ page, baseURL, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 800 })
  await abrir(page, dia(baseURL))
  await fotosCargadas(page)
  const mesa = await page.getByTestId('mesa').boundingBox()
  const a = await page.getByTestId('foto-antes').boundingBox()
  const h = await page.getByTestId('foto-hoy').boundingBox()
  if (isMobile) {
    expect(Math.abs(a.width - mesa.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(h.width - mesa.width)).toBeLessThanOrEqual(1)
  } else {
    expect(Math.abs((h.x + h.width) - a.x - mesa.width)).toBeLessThanOrEqual(1)
    expect(a.width).toBeGreaterThan(300)
  }
  // Cada marco tiene la forma de su foto: sin franjas grises dentro.
  for (const id of ['foto-antes', 'foto-hoy']) {
    const r = await page.getByTestId(id).evaluate((el) => {
      const img = el.querySelector('img')
      return { marco: el.clientWidth / el.clientHeight, foto: img.naturalWidth / img.naturalHeight }
    })
    expect(Math.abs(r.marco - r.foto)).toBeLessThan(0.02)
  }
})

test('Repaso · los errores del servidor salen en el idioma de quien mira, y se pone al día', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL), { idioma: 'en' })
  await expect(page.getByTestId('mesa')).toBeVisible()
  const antes = srv.pedidas.length
  srv.falloPost = { status: 409, detail: 'Ese lado ya tiene veredicto. Deshazlo antes de cambiarlo.' }
  await botonIgual(page).click()
  await expect(page.getByTestId('repaso-aviso')).toHaveText('Someone else has already decided that side. You now see what they marked.')
  await expect.poll(() => srv.pedidas.length).toBe(antes + 1)
  // Uno que la pantalla no conoce se enseña tal cual, como último recurso.
  Object.assign(srv, { falloPost: { status: 400, detail: 'Algo que el servidor dice nuevo' } })
  await botonIgual(page).click()
  await expect(page.getByTestId('repaso-aviso')).toHaveText('Algo que el servidor dice nuevo')
})

test('Repaso · deshacer lo que otra persona ya deshizo: lo dice y trae el día como está', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL))
  await botonIgual(page).click()
  await expect(page.getByTestId('ultimo')).toBeVisible()
  // Otra persona lo deshace por su cuenta.
  Object.assign(srv.dia.revisiones[0].lados[0], { veredicto: null, veredicto_por: null, veredicto_at: null })
  srv.falloDelete = { status: 404, detail: 'Ese lado no tiene veredicto' }
  const antes = srv.pedidas.length
  await page.getByTestId('ultimo').getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByTestId('repaso-aviso')).toHaveText('Ese lado ya estaba sin decidir: otra persona lo había deshecho. Ya ves cómo está ahora.')
  await expect.poll(() => srv.pedidas.length).toBe(antes + 1)
  await expect(tab(page, 1)).toHaveAttribute('data-veredicto', '')
  await expect(page.getByTestId('ultimo')).toHaveCount(0)
})

test('Repaso · la pieza va por su clave y se nombra traducida; «ya había un golpe» dice cuál', async ({ page, baseURL }) => {
  const elDia = dia(baseURL)
  elDia.revisiones[0].ya_apuntado = [{
    ledger_id: null, golpe_id: 'g-viejo', pieza: 'Paragolpes trasero', pieza_clave: 'paragolpes_tras', panel: 'paragolpes',
    gravedad: 'leve', desde: '2026-11-03', inspection_id: 'otra', vista: 'trasera', origen: 'repaso', en_taller: false,
    de_esta_revision: false, foto_url: `${baseURL}/demo/van-lateral-golpe-paragolpes.jpg`, box_2d: [500, 600, 800, 900],
  }]
  const srv = await abrir(page, elDia, { idioma: 'en' })
  const lista = page.getByTestId('ya-apuntado')
  await expect(lista).toContainText('Rear bumper')
  await expect(lista.getByTestId('miniatura').locator('img')).toHaveAttribute('src', `${baseURL}/demo/van-lateral-golpe-paragolpes.jpg`)
  await expect(lista.getByTestId('miniatura-caja')).toBeVisible()
  srv.libro = { accion: 'ya_apuntado', ledger_id: 'l1', pieza: 'Puerta lateral corredera izquierda', pieza_clave: 'corredera_izq', panel: 'puerta', desde: '2026-11-03', golpe_id: null }
  await tab(page, 3).click()
  await page.getByRole('button', { name: "There's new damage" }).click()
  await dibujarCaja(page)
  const form = page.getByTestId('form-golpe')
  await form.getByRole('button', { name: 'Front left door' }).click()
  await form.getByRole('button', { name: 'Moderate' }).click()
  await form.getByRole('button', { name: 'Save the damage' }).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  expect(srv.posts[0].body).toMatchObject({ pieza_clave: 'puerta_del_izq', part: 'Puerta delantera izquierda' })
  await expect(page.getByTestId('repaso-aviso'))
    .toHaveText('The log already had open damage on: Left sliding door. This one has been recorded alongside it.')
  // Una fila por golpe (CONTRATO M3): el que se acaba de apuntar junto al que ya estaba sale también en «Ya apuntado».
  await expect(lista).toContainText('Front left door')
  await expect(lista).toContainText('Rear bumper')
  await tab(page, 3).click()
  await expect(page.getByTestId('decidido')).toContainText('Front left door')
})

test('Repaso · los errores nuevos del servidor: el lado deshecho mientras se guardaba y los permisos', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL))
  await expect(page.getByTestId('mesa')).toBeVisible()
  const antes = srv.pedidas.length
  srv.falloPost = { status: 409, detail: 'Ese lado se ha deshecho mientras se guardaba el golpe. Vuelve a mirarlo.' }
  await botonIgual(page).click()
  await expect(page.getByTestId('repaso-aviso'))
    .toHaveText('Otra persona ha deshecho ese lado mientras se guardaba el golpe. No ha quedado nada a medias: ya ves cómo está ahora.')
  // Como el otro 409: se trae el día como está.
  await expect.poll(() => srv.pedidas.length).toBe(antes + 1)
  Object.assign(srv, { falloPost: { status: 403, detail: 'No tienes permiso para esa pantalla' } })
  await botonIgual(page).click()
  await expect(page.getByTestId('repaso-aviso')).toHaveText('Tu usuario no tiene permiso para esta pantalla. Pídeselo a quien administra la cuenta.')
  Object.assign(srv, { falloPost: { status: 403, detail: 'Tu cuenta no tiene esa pantalla' } })
  await botonIgual(page).click()
  await expect(page.getByTestId('repaso-aviso')).toHaveText('Tu cuenta no tiene esta pantalla activada.')
})

for (const accion of ['pasa_a_otro', 'queda_revision_rapida']) {
  test(`Repaso · deshacer un golpe cuando el libro dice «${accion}»: su fila sale de «Ya apuntado» y el día se pone al día`, async ({ page, baseURL }) => {
    const srv = await abrir(page, dia(baseURL))
    await tab(page, 3).click()
    await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
    await dibujarCaja(page)
    const form = page.getByTestId('form-golpe')
    await form.getByRole('button', { name: 'Puerta lateral corredera izquierda' }).click()
    await form.getByRole('button', { name: 'Moderado' }).click()
    await form.getByRole('button', { name: 'Guardar el golpe' }).click()
    const lista = page.getByTestId('ya-apuntado')
    await expect(lista).toContainText('Puerta lateral corredera izquierda')
    // En el servidor, al deshacerlo, la entrada del libro se queda con otro golpe (o con lo que confirmó otra persona
    // en «Revisión rápida»): esa fila solo la sabe el servidor.
    srv.libroDeshacer = { accion }
    const otra = accion === 'pasa_a_otro'
      ? { golpe_id: 'g-otro', pieza: 'Puerta trasera derecha', pieza_clave: 'puerta_tras_der', vista: 'lateral_der', origen: 'repaso' }
      : { golpe_id: null, pieza: 'Puerta lateral corredera izquierda', pieza_clave: null, vista: null, origen: 'revision_rapida' }
    srv.dia.revisiones[0].ya_apuntado = [{
      ledger_id: null, panel: 'puerta', gravedad: 'leve', desde: '2026-11-10', inspection_id: 'otra', en_taller: false,
      de_esta_revision: false, foto_url: null, box_2d: null, ...otra,
    }]
    const antes = srv.pedidas.length
    await page.getByTestId('ultimo').getByRole('button', { name: 'Deshacer' }).click()
    await expect.poll(() => srv.deletes.length).toBe(1)
    await expect.poll(() => srv.pedidas.length).toBe(antes + 1)
    await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 3)).toHaveAttribute('data-veredicto', '')
    await expect(lista.locator('li')).toHaveCount(1)
    await expect(lista).toContainText(otra.pieza)
  })
}

/* ── Lo que encontró la revisión de diseño del 14-11-2026 (tanda 4, zona Repaso) ── */

// Contraste WCAG entre el color del texto y el del fondo de un elemento (los dos opacos).
const contrasteDe = (loc) => loc.evaluate((el) => {
  const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number)
  const lum = ([r, g, b]) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const s = getComputedStyle(el)
  const a = lum(rgb(s.color))
  const b = lum(rgb(s.backgroundColor))
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color: s.color, fondo: s.backgroundColor }
})

for (const ancho of [360, 390]) {
  for (const idioma of ['es', 'it']) {
    test(`Repaso · a ${ancho} px las pestañas de los lados van en una línea y la elegida se ve entera (${idioma})`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrir(page, dia(baseURL), { idioma })
      const fila = page.getByTestId('lados')
      await expect(fila.getByRole('tab')).toHaveCount(4)
      // Se marcan tres lados para que lleven su marca (más anchas) y se va al cuarto, el último.
      for (let i = 0; i < 3; i++) await botonIgual(page).click()
      await expect(tab(page, 4)).toHaveAttribute('aria-selected', 'true')
      const centros = []
      for (const t of await fila.getByRole('tab').all()) {
        const b = await t.boundingBox()
        centros.push(b.y + b.height / 2)
      }
      // Una sola línea: todas a la misma altura.
      expect(Math.max(...centros) - Math.min(...centros)).toBeLessThan(1)
      // La elegida, entera dentro de lo que se ve de la fila.
      const caja = await fila.boundingBox()
      const activa = await tab(page, 4).boundingBox()
      expect(activa.x).toBeGreaterThanOrEqual(caja.x - 0.5)
      expect(activa.x + activa.width).toBeLessThanOrEqual(caja.x + caja.width + 0.5)
      // Y la página no se sale de lado.
      expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(0)
    })
  }
}

test('Repaso · el día es un botón en mono («jue 12 nov») que abre el selector del sistema', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    window.__selector = 0
    HTMLInputElement.prototype.showPicker = function showPicker() { window.__selector += 1 }
  })
  await abrir(page, dia(baseURL))
  const boton = page.getByRole('button', { name: 'Elegir el día' })
  await expect(boton).toHaveText('jue 12 nov')
  await expect(boton).toHaveAccessibleName('Elegir el día, jue 12 nov')
  expect(await boton.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Plex Mono/i)
  // El campo de fecha del navegador no se ve (está, debajo del botón, para el selector).
  const campo = page.getByTestId('dia-campo')
  await expect(campo).toHaveCSS('opacity', '0')
  await boton.click()
  await expect.poll(() => page.evaluate(() => window.__selector)).toBe(1)
  // Con el teclado, igual.
  await boton.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__selector)).toBe(2)
})

test('Repaso · sin showPicker, el campo del día recibe el foco y se puede escribir', async ({ page, baseURL }) => {
  await page.addInitScript(() => { Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { value: undefined, configurable: true }) })
  const srv = await abrir(page, dia(baseURL))
  await page.getByRole('button', { name: 'Elegir el día' }).click()
  const campo = page.getByTestId('dia-campo')
  await expect(campo).toBeFocused()
  await expect(campo).toHaveCSS('opacity', '1')
  await campo.fill('2026-11-10')
  await expect.poll(() => srv.pedidas.some((q) => q.includes('fecha=2026-11-10'))).toBe(true)
  // Al soltarlo vuelve el botón.
  await page.getByRole('heading', { level: 1 }).click()
  await expect(page.getByRole('button', { name: 'Elegir el día' })).toBeVisible()
})

test('Repaso · el día en el idioma del panel', async ({ page, baseURL }) => {
  await abrir(page, dia(baseURL), { idioma: 'en' })
  await expect(page.getByRole('button', { name: 'Choose the day' })).toHaveText('Thu 12 Nov')
})

test('Repaso · «Guardar el golpe» sin completar se lee como «todavía no», y las piezas van en rejilla regular', async ({ page, baseURL, isMobile }) => {
  await abrir(page, dia(baseURL))
  await tab(page, 3).click()
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  const guardar = page.getByTestId('golpe-guardar')
  await expect(guardar).toBeDisabled()
  const c = await contrasteDe(guardar)
  // Nunca letra blanca, nunca el cian de la marca lavado: tinta apagada sobre el hueco, y que se lea.
  expect(c.color).not.toBe('rgb(255, 255, 255)')
  expect(c.fondo).not.toMatch(/^rgba?\((95, 227, 216|20, 231, 216)/)
  expect(await guardar.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  expect(c.ratio).toBeGreaterThanOrEqual(4.5)
  // Las piezas: 2 columnas en el móvil, 3 en el ordenador; todas del mismo alto y con el nombre entero.
  const piezas = page.getByTestId('piezas').getByRole('button')
  const cajas = []
  for (const p of await piezas.all()) {
    cajas.push(await p.boundingBox())
    expect(await p.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  }
  const columnas = new Set(cajas.map((b) => Math.round(b.x))).size
  expect(columnas).toBe(isMobile ? 2 : 3)
  const altos = cajas.map((b) => Math.round(b.height))
  expect(Math.max(...altos) - Math.min(...altos)).toBeLessThanOrEqual(1)
  // Completo, vuelve el cian con la tinta encima.
  await dibujarCaja(page)
  await page.getByTestId('piezas').getByRole('button', { name: 'Puerta lateral corredera izquierda' }).click()
  await page.getByRole('button', { name: 'Moderado' }).click()
  await expect(guardar).toBeEnabled()
  expect((await contrasteDe(guardar)).ratio).toBeGreaterThanOrEqual(4.5)
})

test('Repaso · «Ya apuntado» sin foto: una regla con el nombre del lado, no un recuadro vacío', async ({ page, baseURL }) => {
  const elDia = dia(baseURL)
  elDia.revisiones[0].ya_apuntado = [
    { ledger_id: null, golpe_id: 'g1', pieza: 'Paragolpes trasero', pieza_clave: 'paragolpes_tras', panel: 'paragolpes', gravedad: 'leve',
      desde: '2026-11-03', inspection_id: 'otra', vista: 'trasera', origen: 'repaso', en_taller: false, de_esta_revision: false, foto_url: null, box_2d: null },
    { ledger_id: null, golpe_id: null, pieza: 'Retrovisor derecho', pieza_clave: null, panel: 'retrovisor', gravedad: 'leve',
      desde: '2026-10-28', inspection_id: 'otra', vista: null, origen: 'revision_rapida', en_taller: true, de_esta_revision: false, foto_url: null, box_2d: null },
  ]
  await abrir(page, elDia)
  const sin = page.getByTestId('ya-apuntado').getByTestId('miniatura-sinfoto')
  await expect(sin).toHaveCount(2)
  await expect(sin.nth(0)).toHaveText('Trasera')
  await expect(sin.nth(1)).toHaveText('Sin foto')
  expect(await sin.nth(0).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px')
  expect(await sin.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
})

// Marca un golpe en el lateral izquierdo de la primera furgoneta y da por iguales los demás lados del día.
async function terminarConGolpe(page, srv) {
  await tab(page, 3).click()
  await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
  await dibujarCaja(page)
  const form = page.getByTestId('form-golpe')
  await form.getByRole('button', { name: 'Puerta lateral corredera izquierda' }).click()
  await form.getByRole('button', { name: 'Moderado' }).click()
  await form.getByRole('button', { name: 'Guardar el golpe' }).click()
  await expect.poll(() => srv.posts.length).toBe(1)
  for (let i = 0; i < 5; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 2)
  }
  await expect(page.getByTestId('terminado')).toBeVisible()
}

test('Repaso · terminado con golpes: sin tarjeta ni cuentas repetidas, «Ver los golpes» y el expediente de cada uno', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL, { esHoy: true }))
  await terminarConGolpe(page, srv)
  const fin = page.getByTestId('terminado')
  // Sin tarjeta: ni fondo ni borde alrededor; solo la regla de arriba.
  const estilo = await fin.evaluate((el) => { const s = getComputedStyle(el); return { fondo: s.backgroundColor, izq: s.borderLeftWidth, arriba: s.borderTopWidth } })
  expect(estilo).toMatchObject({ fondo: 'rgba(0, 0, 0, 0)', izq: '0px' })
  expect(parseFloat(estilo.arriba)).toBeGreaterThan(0)
  // Las cuentas ya están en la columna «Hoy»: aquí no se repiten.
  await expect(fin).not.toContainText('Sin golpes nuevos')
  await expect(fin).not.toContainText('Con un golpe nuevo')
  await expect(fin.getByTestId('terminado-sin-golpes')).toHaveCount(0)
  // Cada golpe, con el enlace al expediente de su furgoneta.
  const exp = fin.getByTestId('golpe-expediente')
  await expect(exp).toHaveCount(1)
  await expect(exp).toHaveAttribute('href', '/panel/vehiculos/veh-rev-a/expediente')
  await expect(exp).toHaveAccessibleName('Abrir el expediente de 5678 KLM')
  // El siguiente paso: ver los golpes (abre el primero en la mesa).
  await fin.getByRole('button', { name: 'Ver los golpes de hoy' }).click()
  await expect(tab(page, 3)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('decidido')).toContainText('Puerta lateral corredera izquierda')
})

test('Repaso · terminado sin golpes: una frase tranquila y, si el día anterior quedó sin repasar, el enlace', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL, { esHoy: true }))
  const ayer = dia(baseURL, { revisiones: [revision(baseURL, { id: 'rev-y', matricula: '1111 BBB', conductor: 'Rosa M.', hora: '09:10' })] })
  ayer.fecha = '2026-11-11'
  srv.diaDe = (f) => (f === '2026-11-11' ? ayer : null)
  for (let i = 0; i < 6; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 1)
  }
  const fin = page.getByTestId('terminado')
  await expect(fin.getByTestId('terminado-sin-golpes')).toContainText('Hoy no hay nada nuevo.')
  await expect(fin.getByTestId('ver-golpes')).toHaveCount(0)
  const enlace = fin.getByRole('button', { name: 'Repasar el 11 de noviembre' })
  await expect(enlace).toBeVisible()
  await enlace.click()
  await expect(page.getByTestId('mesa').getByTestId('matricula').first()).toContainText('1111 BBB')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Repaso del 11 de noviembre')
})

test('Repaso · terminado sin golpes y con el día anterior al día: no ofrece nada más', async ({ page, baseURL }) => {
  const srv = await abrir(page, dia(baseURL, { esHoy: true }))
  for (let i = 0; i < 6; i++) {
    await botonIgual(page).click()
    await expect.poll(() => srv.posts.length).toBe(i + 1)
  }
  await expect(page.getByTestId('terminado-sin-golpes')).toContainText('Hoy no hay nada nuevo.')
  // Se ha mirado el día anterior (el servidor de mentira lo da repasado) y no se ofrece.
  await expect.poll(() => srv.pedidas.some((q) => q.includes('fecha=2026-11-11'))).toBe(true)
  await expect(page.getByTestId('dia-sin-repasar')).toHaveCount(0)
})

/* Las fotos para mirar: a 1280 px en los tres temas del panel (la mesa, el golpe a medias y completo, y «terminado» con
   y sin golpes); a 390 px, lo mismo en el tema de por defecto. */
const YA_APUNTADO_FOTO = (baseURL) => [{
  ledger_id: null, golpe_id: 'g-viejo', pieza: 'Paragolpes trasero', pieza_clave: 'paragolpes_tras', panel: 'paragolpes',
  gravedad: 'leve', desde: '2026-10-02', inspection_id: 'otra', vista: 'trasera', origen: 'repaso', en_taller: false,
  de_esta_revision: false, foto_url: `${baseURL}/demo/van-lateral-golpe-paragolpes.jpg`, box_2d: [560, 70, 760, 330],
}, {
  ledger_id: null, golpe_id: null, pieza: 'Retrovisor derecho', pieza_clave: null, panel: 'retrovisor', gravedad: 'leve',
  desde: '2026-10-28', inspection_id: 'otra', vista: null, origen: 'revision_rapida', en_taller: true, de_esta_revision: false,
  foto_url: null, box_2d: null,
}]
for (const tema of ['hibrido', 'light', 'dark']) {
  test(`Repaso · fotos de la pantalla (tema ${tema})`, async ({ page, baseURL, isMobile }) => {
    test.skip(!fotos, 'solo con FOTOS_REPASO')
    test.skip(isMobile && tema !== 'hibrido', 'en el móvil, solo el tema de por defecto')
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1280, height: 800 })
    const n = (x) => `${x}-${tema}`
    const elDia = dia(baseURL, { esHoy: true })
    elDia.revisiones[0].ya_apuntado = YA_APUNTADO_FOTO(baseURL)
    const srv = await abrir(page, elDia, { tema })
    await expect(page.getByTestId('foto-hoy').locator('img')).toBeVisible()
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="foto-"] img')].every((i) => i.complete && i.naturalWidth > 0))
    await foto(page, n('repaso-mesa'))
    // El golpe a medias (la caja y la pieza, sin la gravedad) y completo.
    await tab(page, 3).click()
    await page.getByRole('button', { name: 'Hay un golpe nuevo' }).click()
    await dibujarCaja(page)
    const form = page.getByTestId('form-golpe')
    await form.getByRole('button', { name: 'Puerta lateral corredera izquierda' }).click()
    await foto(page, n('repaso-golpe-medias'))
    await form.getByRole('button', { name: 'Moderado' }).click()
    await foto(page, n('repaso-golpe-completo'))
    if (tema === 'hibrido' && !isMobile) {
      await page.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByRole('button', { name: 'Con deslizador' }).click()
      await foto(page, n('repaso-deslizador'))
      await page.getByRole('button', { name: 'Una junto a otra' }).click()
    } else {
      await page.getByRole('button', { name: 'Cancelar' }).click()
    }
    await terminarConGolpe(page, srv)
    await foto(page, n('repaso-terminado-golpes'))
  })

  test(`Repaso · fotos de «terminado» sin golpes (tema ${tema})`, async ({ page, baseURL, isMobile }) => {
    test.skip(!fotos, 'solo con FOTOS_REPASO')
    test.skip(isMobile && tema !== 'hibrido', 'en el móvil, solo el tema de por defecto')
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1280, height: 800 })
    const srv = await abrir(page, dia(baseURL, { esHoy: true }), { tema })
    const ayer = dia(baseURL, { revisiones: [revision(baseURL, { id: 'rev-y', matricula: '1111 BBB', conductor: 'Rosa M.', hora: '09:10' })] })
    srv.diaDe = (f) => (f === '2026-11-11' ? ayer : null)
    for (let i = 0; i < 6; i++) {
      await botonIgual(page).click()
      await expect.poll(() => srv.posts.length).toBe(i + 1)
    }
    await expect(page.getByTestId('dia-sin-repasar')).toBeVisible()
    await foto(page, `repaso-terminado-${tema}`)
  })
}
