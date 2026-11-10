import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { UA_APP, lo, limpia, prohibidas, vigilar, quieta, arrancar } from './iphone.js'
import { hablaDePagos } from '../src/lib/plataforma.js'

/* BLOQUEAR A UNA PERSONA EN EL MERCADILLO (10-11-2026; el plan B por si Apple pide la guideline 1.2).
   Apple exige a una app con contenido de sus usuarios que se pueda denunciar el contenido Y bloquear a quien molesta. Aquí se
   prueba la pantalla con la API simulada, con el contrato del servidor TAL CUAL (nombres de campos y códigos de error):
     POST   /mercadillo/bloquear         {anuncio_id} o {conversacion_id} → {ok, bloqueo: {id, nombre, desde}}
     GET    /mercadillo/bloqueados       → {bloqueados: [{id, nombre, desde, titulo}]}
     DELETE /mercadillo/bloqueados/{id}  → {ok}  (404 «Ese bloqueo ya no está»)
     GET    /mercadillo                  → los anuncios ya sin los de la persona bloqueada, y `bloqueados: n`
   Las reglas (quién deja de ver qué, quién puede escribir a quién) las prueba el servidor en backend/tests/test_mercadillo.py.
   Cada caso va dos veces: en la web y SIMULANDO LA APP DE IPHONE (window.Capacitor con getPlatform() 'ios'), que es donde lo
   va a buscar el revisor; allí, además, ninguna de estas pantallas puede decir nada del vocabulario prohibido (e2e/iphone.js). */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64')
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const LISTAS = {
  categorias: { movil: 'Móviles y electrónica', furgoneta: 'Furgoneta y accesorios', otros: 'Otras cosas' },
  estados_articulo: { nuevo: 'Nuevo', como_nuevo: 'Como nuevo', buen_estado: 'Buen estado' },
  motivos_denuncia: { prohibido: 'Está prohibido o es ilegal', estafa: 'Es un engaño o una posible estafa', acoso: 'Me insulta o me acosa', otro: 'Otra cosa' },
}
const YO = { nombre: 'Ana P.', tipo: 'autonomo' }
/* `persona` es cosa de esta simulación (quién es quién por dentro): NUNCA viaja a la web, como la `clave` del servidor. */
const anuncio = (id, persona, vendedor, titulo, precio_cent, extra = {}) => ({
  id, persona, titulo, descripcion: 'Poco uso.', precio_cent, categoria: 'movil', estado_articulo: 'como_nuevo', zona: 'A Coruña',
  fotos: [`f-${id}`], estado: 'publicado', mio: false, publicado_en: '2026-11-08T10:00:00+00:00', vendedor, ...extra })
// Con una descripción LARGA a propósito: «Bloquear a…» tiene que seguir en la primera pantalla del anuncio (va antes que ella).
const IPHONE = anuncio('a1', 'fds', { nombre: 'Dani · FDS', tipo: 'fds' }, 'iPhone 18 Pro · 256 GB', 130000,
  { descripcion: 'Con su caja, el cargador y dos fundas. Lo vendo porque me han dado otro en el trabajo. '.repeat(9).trim() })
const SOPORTE = anuncio('a2', 'luis', { nombre: 'Luis G.', tipo: 'conductor' }, 'Soporte de móvil para la furgoneta', 1500)
const CARRETILLA = anuncio('a3', 'marta', { nombre: 'Marta R.', tipo: 'autonomo', entregas: 420 }, 'Carretilla plegable', 2500)
const GORRA = anuncio('m1', 'yo', { nombre: 'Ana P.', tipo: 'autonomo' }, 'Gorra de invierno', 800, { mio: true })
const CONVERSACIONES = [
  { id: 'c1', persona: 'luis', con: 'Luis G.', soy: 'vendedor', anuncio: GORRA, ultimo: '2026-11-09T18:00:00+00:00', ultimo_texto: '¿Me la dejas en 5?', sin_leer: true,
    mensajes: [{ id: 'm1', mio: false, texto: '¿Me la dejas en 5?', ts: '2026-11-09T18:00:00+00:00' }] },
  { id: 'c2', persona: 'marta', con: 'Marta R.', soy: 'comprador', anuncio: CARRETILLA, ultimo: '2026-11-09T12:00:00+00:00', ultimo_texto: 'Sí, sigue disponible', sin_leer: false,
    mensajes: [{ id: 'm2', mio: true, texto: 'Hola, ¿sigue disponible?', ts: '2026-11-09T11:00:00+00:00' }, { id: 'm3', mio: false, texto: 'Sí, sigue disponible', ts: '2026-11-09T12:00:00+00:00' }] },
]
const YA_BLOQUEADO = { id: '00b10c0e00000001', persona: 'fds', nombre: 'Dani · FDS', desde: '2026-11-09T09:00:00+00:00', titulo: IPHONE.titulo }
const DEL_MODERADOR = 'Tú moderas el mercadillo: retira el anuncio o cierra la conversación en Negocio'

/** El mercadillo del servidor, simulado y CON MEMORIA: lo que se bloquea deja de salir, como en el de verdad. Devuelve lo que
 *  ha pasado (`llamadas`, en orden, y el cuerpo de cada una) para poder decir qué mandó la web y cuándo. */
async function mercadillo(page, { bloqueos = [], errorBloquear = null, cuentaEn = 'lista' } = {}) {
  const s = { bloqueos: bloqueos.map((b) => ({ ...b })), llamadas: [], bloqueo: null, denuncia: null, desbloqueo: null }
  const bloqueada = (persona) => s.bloqueos.some((b) => b.persona === persona)
  const publico = ({ persona: _persona, ...a }) => a
  await page.route(/\/api\/mercadillo(?:\/[^?]*)?(?:\?.*)?$/, async (x) => {
    const pet = x.request()
    const metodo = pet.method()
    const ruta = new URL(pet.url()).pathname.replace(/^.*\/api\/mercadillo/, '')
    const json = (j, status = 200) => x.fulfill({ status, json: j })
    const cuerpo = () => { try { return pet.postDataJSON() || {} } catch { return {} } }
    if (ruta === '/estado') {
      return json({ visible: true, abierto: true, sin_leer: CONVERSACIONES.filter((c) => c.sin_leer && !bloqueada(c.persona)).length, yo: YO, avisos_movil: false,
        ...(cuentaEn === 'estado' ? { bloqueados: s.bloqueos.length } : {}) })
    }
    if (ruta === '' && metodo === 'GET') {
      return json({ anuncios: [IPHONE, SOPORTE, CARRETILLA].filter((a) => !bloqueada(a.persona)).map(publico), mios: [publico(GORRA)], ...LISTAS,
        activos_max: 3, dias: 30, yo: YO, ...(cuentaEn === 'lista' ? { bloqueados: s.bloqueos.length } : {}) })
    }
    if (ruta.startsWith('/foto/')) return x.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    if (ruta.startsWith('/anuncio/') && metodo === 'GET') {
      const a = [IPHONE, SOPORTE, CARRETILLA, GORRA].find((y) => `/anuncio/${y.id}` === ruta)
      if (!a || bloqueada(a.persona)) return json({ detail: 'Ese anuncio ya no está' }, 404)
      return json({ ...publico(a), conversacion_id: (CONVERSACIONES.find((c) => c.anuncio.id === a.id && c.soy === 'comprador') || {}).id || null })
    }
    if (ruta === '/buzon') {
      return json({ conversaciones: CONVERSACIONES.filter((c) => !bloqueada(c.persona)).map((c) => ({ id: c.id, anuncio_id: c.anuncio.id, titulo: c.anuncio.titulo,
        precio_cent: c.anuncio.precio_cent, foto: c.anuncio.fotos[0], estado_anuncio: 'publicado', con: c.con, soy: c.soy, ultimo: c.ultimo, ultimo_texto: c.ultimo_texto,
        bloqueada: false, sin_leer: c.sin_leer })),
      avisos: [{ id: 'v1', texto: 'Tu anuncio «Gorra de invierno» ya está publicado.', ts: '2026-11-08T12:00:00+00:00', leido: true }] })
    }
    if (ruta.startsWith('/conversacion/') && metodo === 'GET') {
      const c = CONVERSACIONES.find((y) => `/conversacion/${y.id}` === ruta)
      if (!c || bloqueada(c.persona)) return json({ detail: 'Esa conversación ya no está' }, 404)
      return json({ id: c.id, soy: c.soy, con: c.con, bloqueada: false, anuncio: publico(c.anuncio), mensajes: c.mensajes })
    }
    if (ruta === '/avisos/leidos') return json({ ok: true })
    if (ruta === '/denunciar' && metodo === 'POST') {
      s.llamadas.push('denunciar'); s.denuncia = cuerpo()
      return json({ ok: true })
    }
    if (ruta === '/bloquear' && metodo === 'POST') {
      s.llamadas.push('bloquear'); s.bloqueo = cuerpo()
      if (errorBloquear) return json({ detail: errorBloquear.detail }, errorBloquear.status)
      const a = [IPHONE, SOPORTE, CARRETILLA].find((y) => y.id === s.bloqueo.anuncio_id)
      const c = CONVERSACIONES.find((y) => y.id === s.bloqueo.conversacion_id)
      if (!s.bloqueo.anuncio_id && !s.bloqueo.conversacion_id) return json({ detail: 'Falta a quién bloqueas' }, 400)
      if (!a && !c) return json({ detail: 'Ese anuncio ya no está' }, 404)
      const persona = a ? a.persona : c.persona
      const previo = s.bloqueos.find((b) => b.persona === persona)
      if (previo) return json({ ok: true, ya: true, bloqueo: { id: previo.id, nombre: previo.nombre, desde: previo.desde } })
      const nuevo = { id: `00b10c0e0000000${s.bloqueos.length + 2}`, persona, nombre: a ? a.vendedor.nombre : c.con, desde: new Date().toISOString(),
        titulo: a ? a.titulo : c.anuncio.titulo }
      s.bloqueos.push(nuevo)
      return json({ ok: true, bloqueo: { id: nuevo.id, nombre: nuevo.nombre, desde: nuevo.desde } })
    }
    if (ruta === '/bloqueados' && metodo === 'GET') {
      return json({ bloqueados: [...s.bloqueos].reverse().map((b) => ({ id: b.id, nombre: b.nombre, desde: b.desde, titulo: b.titulo })) })
    }
    if (ruta.startsWith('/bloqueados/') && metodo === 'DELETE') {
      s.llamadas.push('desbloquear'); s.desbloqueo = ruta.slice('/bloqueados/'.length)
      const i = s.bloqueos.findIndex((b) => b.id === s.desbloqueo)
      if (i < 0) return json({ detail: 'Ese bloqueo ya no está' }, 404)
      s.bloqueos.splice(i, 1)
      return json({ ok: true })
    }
    return json({})
  })
  return s
}

/** Dentro del mercadillo: en la web, por su dirección; en el iPhone se puede entrar también por la app (Cuenta → Mercadillo). */
async function entrar(page, { ios = false, porLaApp = false, ...opciones } = {}) {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await arrancar(page, { ios })
  const s = await mercadillo(page, opciones)
  if (porLaApp) {
    // Lo mínimo de la app de quien reparte por su cuenta (/ruta), con los campos de verdad del servidor.
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], pais: 'es',
      status: 'trial', days_left: 6, required: false, precios: { mensual: 9.99, anual: 99 }, gratis: { activo: false, tope: 15, usadas: 0 } } }))
    await page.route(/\/api\/referidos$/, (r) => r.fulfill({ status: 403, json: { detail: 'Los enlaces de invitación son de cada cuenta' } }))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {},
      aviso_aceptado: true, base: null, pais: 'es', prefijo: '34', ruta: null, pedidos: [] } }))
    await page.goto('/ruta?tab=cuenta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Mercadillo de repartidores/ }).click()
  } else {
    await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
  }
  await expect(page.getByRole('button', { name: /Vender algo que no uses/ })).toBeVisible()
  return s
}

const BLOQUEADO = 'Bloqueado. Ya no verás sus anuncios ni podrá escribirte.'
const LO_QUE_PASA = 'Dejarás de ver sus anuncios y no podrá escribirte. Tampoco verá los tuyos. No se le avisa. Puedes desbloquearle cuando quieras en “Personas bloqueadas”.'
const tarjeta = (page, a) => page.getByRole('button', { name: new RegExp(a.titulo.slice(0, 12)) })
const dialogo = (page, nombre) => page.getByRole('dialog', { name: `¿Bloquear a ${nombre}?` })
/** «Sin buscarlo»: el botón entero en la primera pantalla (sin desplazar nada) y por encima de la barra fija de abajo
 *  («Me interesa» en el anuncio, el cuadro de escribir en la conversación), que si no lo taparía. */
async function enLaPrimeraPantalla(page, boton, loDeLaBarra, donde) {
  await expect(boton, `«Bloquear a…» no está en la primera pantalla de ${donde}`).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => window.scrollY), `${donde}: la prueba no ha desplazado la pantalla`).toBe(0)
  const caja = await boton.boundingBox()
  const barra = await page.locator('div.fixed.bottom-0', { has: loDeLaBarra }).boundingBox()
  expect(caja.y + caja.height, `la barra de abajo tapa «Bloquear a…» en ${donde}`).toBeLessThanOrEqual(barra.y)
}

for (const [donde, ios] of [['web', false], ['iPhone', true]]) {
  test.describe(`Mercadillo · bloquear a una persona (${donde})`, () => {
    if (ios) test.use({ userAgent: UA_APP })
    /** En el iPhone, además, que la pantalla de ahora no diga nada de lo prohibido (planes, pagos, otra plataforma…). */
    const sinVocabulario = async (page, que) => { if (ios) { await quieta(page, 250); await limpia(page, `mercadillo en el iPhone · ${que}`, { perfil: 'basico' }) } }

    test('desde la ficha de un anuncio: el botón a la vista, la confirmación, el POST con su anuncio y la lista ya sin él', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, porLaApp: ios })
      for (const a of [IPHONE, SOPORTE, CARRETILLA]) await expect(tarjeta(page, a)).toBeVisible()
      await expect(page.getByRole('button', { name: /Personas bloqueadas/ }), 'sin nadie bloqueado, la lista no lo ofrece').toHaveCount(0)
      await tarjeta(page, IPHONE).click()

      // A la vista y con su texto (lo que busca el revisor), en la tarjeta de quien vende y junto a «Denunciar».
      const bloquear = page.getByRole('button', { name: 'Bloquear a Dani · FDS', exact: true })
      await expect(bloquear).toBeVisible()
      await enLaPrimeraPantalla(page, bloquear, page.getByRole('button', { name: 'Me interesa' }), 'la ficha del anuncio')
      await expect(page.getByRole('button', { name: 'Denunciar', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Denunciar anuncio' }), 'la banderita de siempre sigue').toBeVisible()
      await sinVocabulario(page, 'la ficha con «Bloquear a…»')

      // La confirmación: qué pasa, la casilla de denunciar (sin marcar) y sus dos botones. «Cancelar» no manda nada.
      await bloquear.click()
      const d = dialogo(page, 'Dani · FDS')
      await expect(d).toBeVisible()
      await expect(d).toHaveAttribute('aria-modal', 'true')
      await expect(d.getByText(LO_QUE_PASA)).toBeVisible()
      await expect(d.getByRole('checkbox', { name: 'Denunciar también este anuncio' })).not.toBeChecked()
      await sinVocabulario(page, 'la confirmación de bloquear')
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(d).toHaveCount(0)
      expect(s.llamadas, '«Cancelar» no bloquea ni denuncia').toEqual([])

      // «Bloquear»: un POST con el anuncio (nunca una clave), y de vuelta a la lista, ya sin lo suyo.
      await bloquear.click()
      await d.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Bloqueado.' })).toHaveText(BLOQUEADO)
      expect(s.llamadas).toEqual(['bloquear'])
      expect(s.bloqueo, 'a quién se bloquea se dice con su anuncio').toEqual({ anuncio_id: 'a1' })
      await expect(tarjeta(page, IPHONE)).toHaveCount(0)
      await expect(tarjeta(page, SOPORTE)).toBeVisible()
      await expect(tarjeta(page, CARRETILLA)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true })).toBeVisible()
      await sinVocabulario(page, 'la lista tras bloquear')
      expect(fallos).toEqual([])
    })

    test('con «Denunciar también este anuncio»: primero la denuncia y después el bloqueo', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios })
      await tarjeta(page, IPHONE).click()
      await page.getByRole('button', { name: 'Bloquear a Dani · FDS', exact: true }).click()
      const d = dialogo(page, 'Dani · FDS')
      await d.getByRole('checkbox', { name: 'Denunciar también este anuncio' }).check()
      await d.getByRole('button', { name: 'Bloquear', exact: true }).click()

      // Se abre la denuncia y todavía NO se ha bloqueado. Cerrarla sin enviar vuelve a la confirmación, sin bloquear.
      const denuncia = page.getByRole('dialog', { name: 'Denunciar' })
      await expect(denuncia).toBeVisible()
      await expect(d, 'mientras se denuncia, la confirmación no está encima').toHaveCount(0)
      await sinVocabulario(page, 'la denuncia que va antes del bloqueo')
      await denuncia.getByRole('button', { name: 'Cerrar' }).click()
      await expect(d).toBeVisible()
      expect(s.llamadas, 'cerrar la denuncia sin enviarla no bloquea').toEqual([])

      // Ahora sí: la denuncia se envía y, solo entonces, el bloqueo. Y la lista dice las dos cosas.
      await d.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await denuncia.getByRole('radio', { name: 'Me insulta o me acosa' }).click()
      await denuncia.getByLabel('Explícalo').fill('Me ha escrito con insultos')
      await denuncia.getByRole('button', { name: 'Enviar denuncia' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Bloqueado.' }))
        .toHaveText(`${BLOQUEADO} Hemos recibido tu denuncia: te diremos en tu buzón qué hemos decidido.`)
      expect(s.llamadas, 'primero la denuncia (después del bloqueo ese anuncio ya no se puede abrir) y luego el bloqueo').toEqual(['denunciar', 'bloquear'])
      expect(s.denuncia).toEqual({ anuncio_id: 'a1', motivo: 'acoso', texto: 'Me ha escrito con insultos' })
      expect(s.bloqueo).toEqual({ anuncio_id: 'a1' })
      await expect(tarjeta(page, IPHONE)).toHaveCount(0)
      await sinVocabulario(page, 'la lista tras denunciar y bloquear')
      expect(fallos).toEqual([])
    })

    test('desde la conversación: «Bloquear a…» junto a «Denunciar», el POST con la conversación y el buzón ya sin ella', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios })
      await page.getByRole('button', { name: 'Mensajes, 1 sin leer' }).click()
      await expect(page.getByText('¿Me la dejas en 5?')).toBeVisible()
      await expect(page.getByText('Sí, sigue disponible')).toBeVisible()
      // «Personas bloqueadas» está siempre en el buzón (es donde la confirmación dice que se deshace), aún sin nadie.
      await expect(page.getByRole('button', { name: 'Personas bloqueadas', exact: true })).toBeVisible()
      await sinVocabulario(page, 'el buzón')
      await page.getByRole('button', { name: /Luis G\./ }).click()

      const bloquear = page.getByRole('button', { name: 'Bloquear a Luis G.', exact: true })
      await expect(bloquear).toBeVisible()
      await enLaPrimeraPantalla(page, bloquear, page.getByLabel('Escribe un mensaje'), 'la conversación')
      await expect(page.getByRole('button', { name: 'Denunciar', exact: true })).toBeVisible()
      await sinVocabulario(page, 'la conversación con «Bloquear a…»')
      await bloquear.click()
      const d = dialogo(page, 'Luis G.')
      await expect(d.getByText(LO_QUE_PASA)).toBeVisible()
      await expect(d.getByRole('checkbox', { name: 'Denunciar también esta conversación' })).not.toBeChecked()
      await d.getByRole('button', { name: 'Bloquear', exact: true }).click()

      // Al buzón, ya sin esa persona: su conversación no está, la otra sí, y el globito ya no la cuenta.
      await expect(page.getByRole('status').filter({ hasText: 'Bloqueado.' })).toHaveText(BLOQUEADO)
      expect(s.llamadas).toEqual(['bloquear'])
      expect(s.bloqueo, 'a quién se bloquea se dice con la conversación').toEqual({ conversacion_id: 'c1' })
      await expect(page.getByText('Privados entre quien compra y quien vende')).toBeVisible()
      await expect(page.getByText('¿Me la dejas en 5?')).toHaveCount(0)
      await expect(page.getByText('Sí, sigue disponible')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true })).toBeVisible()
      await sinVocabulario(page, 'el buzón tras bloquear')
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(page.getByRole('button', { name: 'Mensajes', exact: true }), 'lo de la persona bloqueada no cuenta como sin leer').toBeVisible()
      expect(fallos).toEqual([])
    })

    test('«Personas bloqueadas»: a quién, desde cuándo y desde qué anuncio; «Desbloquear» manda el DELETE y lo devuelve todo', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, bloqueos: [YA_BLOQUEADO] })
      await expect(tarjeta(page, IPHONE), 'bloqueado: su anuncio no sale').toHaveCount(0)
      await page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true }).click()
      await expect(page.getByText('No ves sus anuncios ni pueden escribirte')).toBeVisible()
      const fila = page.getByRole('listitem').filter({ hasText: 'Dani · FDS' })
      await expect(fila).toContainText(/Bloqueado el 9 nov/)
      await expect(fila).toContainText('Desde «iPhone 18 Pro · 256 GB»')
      await sinVocabulario(page, 'las personas bloqueadas')
      await fila.getByRole('button', { name: 'Desbloquear a Dani · FDS' }).click()
      await expect(page.getByRole('status')).toHaveText('Has desbloqueado a Dani · FDS. Vuelves a ver sus anuncios y puede escribirte.')
      expect(s.llamadas).toEqual(['desbloquear'])
      expect(s.desbloqueo, 'el DELETE lleva el id del bloqueo').toBe(YA_BLOQUEADO.id)
      await expect(fila).toHaveCount(0)
      await expect(page.getByText(/No tienes a nadie bloqueado\. Si alguien te molesta, bloquéale desde su anuncio o desde la conversación\./)).toBeVisible()
      await sinVocabulario(page, 'las personas bloqueadas, vacía')
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(tarjeta(page, IPHONE), 'desbloqueado: su anuncio vuelve').toBeVisible()
      await expect(page.getByRole('button', { name: /Personas bloqueadas/ })).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    test('lo que dice el servidor cuando no deja (quien modera no bloquea): se lee en la confirmación y no se sale de la ficha', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, errorBloquear: { status: 400, detail: DEL_MODERADOR } })
      await tarjeta(page, SOPORTE).click()
      await page.getByRole('button', { name: 'Bloquear a Luis G.', exact: true }).click()
      const d = dialogo(page, 'Luis G.')
      await d.getByRole('button', { name: 'Bloquear', exact: true }).click()
      await expect(d.getByRole('alert')).toHaveText(DEL_MODERADOR)
      expect(s.llamadas).toEqual(['bloquear'])
      await sinVocabulario(page, 'la confirmación con el error del servidor')
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Bloquear a Luis G.', exact: true }), 'sigue en la ficha').toBeVisible()
      expect(fallos).toEqual([])
    })

    test('un bloqueo que ya no estaba (404 al desbloquear): lo dice y lo quita de la lista', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, bloqueos: [YA_BLOQUEADO] })
      await page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true }).click()
      const fila = page.getByRole('listitem').filter({ hasText: 'Dani · FDS' })
      await expect(fila).toBeVisible()
      s.bloqueos.length = 0                                            // lo quitó desde otro móvil
      await fila.getByRole('button', { name: 'Desbloquear a Dani · FDS' }).click()
      await expect(page.getByRole('alert')).toHaveText('Ese bloqueo ya no está')
      await expect(fila).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    test('las normas: bloquear a quien molesta, las 24 horas de las denuncias y la tolerancia cero', async ({ page }) => {
      const fallos = vigilar(page)
      await entrar(page, { ios })
      await page.getByRole('button', { name: 'Normas y seguridad' }).click()
      await expect(page.getByText('Si alguien te molesta, bloquéale desde su anuncio o desde la conversación: dejarás de ver sus anuncios y no podrá escribirte.', { exact: true })).toBeVisible()
      await expect(page.getByText('Si algo no cumple, pulsa «Denunciar». Lo revisamos en 24 horas como mucho y te decimos qué hemos hecho. No se tolera el contenido ofensivo ni el acoso: quien lo haga se queda sin mercadillo.', { exact: true })).toBeVisible()
      await expect(page.getByText('Lo revisamos y te decimos qué hemos hecho.'), 'la norma de antes, sin plazo, ya no está').toHaveCount(0)
      await sinVocabulario(page, 'las normas')
      expect(fallos).toEqual([])
    })

    // El revisor de Apple suele abrir las apps de iPhone en un iPad, donde se ven a tamaño de iPhone pequeño.
    if (ios) {
      test('en la pantalla más pequeña (375 × 647: un iPhone SE o la app abierta en un iPad), «Bloquear a…» sigue en la primera pantalla', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 647 })
        await entrar(page, { ios })
        await tarjeta(page, IPHONE).click()
        await enLaPrimeraPantalla(page, page.getByRole('button', { name: 'Bloquear a Dani · FDS', exact: true }), page.getByRole('button', { name: 'Me interesa' }), 'la ficha del anuncio (375 × 647)')
        await page.getByRole('button', { name: 'Volver' }).click()
        await page.getByRole('button', { name: 'Mensajes, 1 sin leer' }).click()
        await page.getByRole('button', { name: /Luis G\./ }).click()
        await enLaPrimeraPantalla(page, page.getByRole('button', { name: 'Bloquear a Luis G.', exact: true }), page.getByLabel('Escribe un mensaje'), 'la conversación (375 × 647)')
      })
    }
  })
}

/* El contrato dice que la lista (GET /mercadillo) trae `bloqueados: n`; de GET /mercadillo/estado dice «igual», que se puede leer de
   dos maneras. La web coge el número de donde venga: aquí, solo en el estado. */
test('Mercadillo · si cuántos hay bloqueados viene solo en /mercadillo/estado, «Personas bloqueadas (n)» sale igual', async ({ page }) => {
  await entrar(page, { bloqueos: [YA_BLOQUEADO], cuentaEn: 'estado' })
  await expect(page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true })).toBeVisible()
})

test('Mercadillo · la web no manda ni enseña ninguna clave: a quién se bloquea se dice con el anuncio y qué se desbloquea, con el id del bloqueo', async ({ page }) => {
  const cuerpos = []
  page.on('request', (r) => { if (/\/api\/mercadillo\/(bloquear|bloqueados)/.test(r.url())) cuerpos.push(`${r.method()} ${new URL(r.url()).pathname} ${r.postData() || ''}`) })
  const s = await entrar(page)
  await tarjeta(page, SOPORTE).click()
  await page.getByRole('button', { name: 'Bloquear a Luis G.', exact: true }).click()
  await dialogo(page, 'Luis G.').getByRole('button', { name: 'Bloquear', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Bloqueado.' })).toBeVisible()
  await page.getByRole('button', { name: 'Personas bloqueadas (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Desbloquear a Luis G.' }).click()
  await expect(page.getByText(/No tienes a nadie bloqueado/)).toBeVisible()
  expect(s.llamadas).toEqual(['bloquear', 'desbloquear'])
  expect(cuerpos.join('\n')).not.toMatch(/clave|persona|\b[oda]:[\w-]+/)
  expect(await lo(page)).not.toMatch(/\b[oda]:[\w-]+:/)
})

/* Lo que contesta el servidor cuando no deja bloquear, desbloquear o escribir (backend/server.py, TAL CUAL el 10-11-2026). Dentro
   de la app de iPhone, un error que hable de planes o de topes se cambia por un texto neutro (lib/plataforma.js): estos tienen
   que leerse como son (dicen qué hacer) y no pueden llevar nada del vocabulario prohibido allí. */
const DEL_SERVIDOR = [
  DEL_MODERADOR, 'Es tu anuncio', 'No puedes bloquearte a ti', 'Falta a quién bloqueas', 'Esa persona ya no está en el mercadillo',
  'Tienes 200 personas bloqueadas, que es el máximo. Desbloquea a alguna en «Personas bloqueadas» para bloquear a otra.',
  'Has bloqueado a mucha gente hoy. Prueba mañana.', 'Ese bloqueo ya no está', 'Ese anuncio ya no está', 'Ese anuncio ya no está a la venta',
  'Esta conversación está cerrada', 'Has bloqueado a esta persona. Desbloquéala para escribirle.',
]
test('Mercadillo · lo que contesta el servidor al bloquear se lee tal cual también en el iPhone', () => {
  const neutros = DEL_SERVIDOR.filter((m) => hablaDePagos(m))
  expect(neutros, `en el iPhone se cambiarían por el texto neutro: ${neutros.join(' | ')}`).toEqual([])
  const faltas = DEL_SERVIDOR.flatMap((m) => prohibidas(m, 'es', 'basico'))
  expect(faltas, `dicen algo prohibido en el iPhone: ${faltas.join(' | ')}`).toEqual([])
})

/* ── El panel de Dani (Negocio → Mercadillo): quién ha bloqueado a quién, solo para mirar ────────────────────────────────────
   Apple pide que el bloqueo «avise al desarrollador». GET /admin/mercadillo trae `bloqueos` (los 200 últimos), `bloqueados_varios`
   (a quién han bloqueado dos personas o más) y `totales.bloqueos`. Aquí sí sale la clave: es el panel del super-admin. */
const ADMIN = { conf: { visible: true }, por_revisar: [], publicados: [], denuncias: [], avisos: { activo: false, movil: false },
  motivos_rechazo: {}, motivos_denuncia: {}, categorias: {}, estados_articulo: {} }
async function negocio(page, datos) {
  await entrarComoAdmin(page, { superAdmin: true })
  await simularApi(page, 'vacio')
  await arrancar(page, { ios: false })
  await page.route(/\/api\/admin\/mercadillo$/, (x) => x.fulfill({ json: { ...ADMIN, ...datos } }))
  await page.goto('/panel/admin?s=mercadillo', { waitUntil: 'domcontentloaded' })
  const s = page.getByRole('region', { name: 'Mercadillo de repartidores' })
  await expect(s.getByText('Visible: lo ven todos los repartidores', { exact: false })).toBeVisible()
  return s
}

test.describe('Negocio · los bloqueos del mercadillo', () => {
  test('quién ha bloqueado a quién, cuándo y desde dónde; arriba, a quién han bloqueado varias personas; y nada que pulsar', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const s = await negocio(page, {
      bloqueos: [
        { id: '00b10c0e00000003', de_nombre: 'Marta R.', a_nombre: 'Luis G.', a_clave: 'd:org1:d7', ts: '2026-11-10T09:30:00+00:00', origen: { tipo: 'conversacion', titulo: 'Gorra de invierno' } },
        { id: '00b10c0e00000002', de_nombre: 'Ana P.', a_nombre: 'Luis G.', a_clave: 'd:org1:d7', ts: '2026-11-09T18:05:00+00:00', origen: { tipo: 'anuncio', titulo: 'Escáner de la nave' } },
        { id: '00b10c0e00000001', de_nombre: 'Ana P.', a_nombre: 'Dani · FDS', a_clave: 'fds', ts: '2026-11-09T09:00:00+00:00', origen: { tipo: 'anuncio', titulo: '' } },
      ],
      bloqueados_varios: [{ clave: 'd:org1:d7', nombre: 'Luis G.', n: 2 }],
      totales: { por_revisar: 0, publicados: 1, denuncias: 0, conversaciones: 2, vendidos: 0, bloqueos: 3 },
    })
    const b = s.getByRole('group', { name: 'Bloqueos' })
    await expect(b.getByText('Bloqueado por 2 personas: Luis G. (d:org1:d7)')).toBeVisible()
    const filas = b.getByRole('listitem').filter({ hasText: 'bloqueó a' })
    await expect(filas).toHaveCount(3)
    await expect(filas.nth(0)).toContainText('Marta R. bloqueó a Luis G.')
    await expect(filas.nth(0)).toContainText(/10\/11\/2026 \d\d:30 · desde la conversación sobre «Gorra de invierno» · d:org1:d7/)
    await expect(filas.nth(1)).toContainText('Ana P. bloqueó a Luis G.')
    await expect(filas.nth(1)).toContainText(/09\/11\/2026 \d\d:05 · desde el anuncio «Escáner de la nave» · d:org1:d7/)
    await expect(filas.nth(2)).toContainText('Ana P. bloqueó a Dani · FDS')
    await expect(filas.nth(2)).toContainText(/desde el anuncio «sin título» · fds/)
    await expect(b.getByRole('button'), 'los bloqueos son solo para mirar').toHaveCount(0)
    await expect(s.locator('div.grid > div').filter({ hasText: 'Bloqueos' })).toContainText('3')
    await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('sin bloqueos (o con un servidor que aún no los manda): «Nadie ha bloqueado a nadie» y nada se rompe', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const s = await negocio(page, { totales: { por_revisar: 0, publicados: 0, denuncias: 0, conversaciones: 0, vendidos: 0 } })
    const b = s.getByRole('group', { name: 'Bloqueos' })
    await expect(b.getByText('Nadie ha bloqueado a nadie.')).toBeVisible()
    await expect(b.getByText(/Bloqueado por/)).toHaveCount(0)
    await expect(s.locator('div.grid > div').filter({ hasText: 'Bloqueos' })).toContainText('0')
    await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })
})
