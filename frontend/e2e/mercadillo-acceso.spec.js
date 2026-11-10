import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { UA_APP, lo, limpia, prohibidas, vigilar, quieta, arrancar } from './iphone.js'
import { hablaDePagos } from '../src/lib/plataforma.js'

/* QUIÉN ENTRA AL MERCADILLO (10-11-2026; la ampliación del plan B por si Apple pide la guideline 1.2).
   A una app con contenido de sus usuarios Apple le pide, además de denunciar y bloquear (e2e/mercadillo-bloqueo.spec.js), que
   quien entra acepte antes unas normas, y que a quien abusa se le pueda echar. Aquí se prueba la pantalla con la API simulada,
   con el contrato del servidor TAL CUAL (nombres de campos, códigos y textos):
     GET  /mercadillo y /mercadillo/estado  → `normas_ok: bool` (la pantalla de normas sale SOLO con `false`)
     POST /mercadillo/normas {acepto: true} → {ok, normas_ok: true}  (400 «Tienes que aceptar las normas…»)
     GET  /mercadillo/estado (sin acceso)   → {visible, abierto, expulsado: true, texto, sin_leer: 0, yo}; lo demás, 403 con ese texto
     POST /admin/mercadillo/expulsar  {clave, motivo, nota} → {ok, expulsado, anuncios, conversaciones}
     POST /admin/mercadillo/readmitir {clave}               → {ok}
     GET  /admin/mercadillo → `expulsados`, `motivos_expulsion`, `totales.expulsados` y `personas` en cada denuncia
   Las reglas (qué pasa con los anuncios y las conversaciones de quien se queda sin acceso, quién puede quitarlo) las prueba el
   servidor en backend/tests/test_mercadillo.py. Lo de la persona va dos veces: en la web y SIMULANDO LA APP DE IPHONE, donde
   ninguna de estas pantallas puede decir nada del vocabulario prohibido (e2e/iphone.js) y «Avisarme en el móvil» no sale.
   Aquí va también (10-11-2026, cuarta tanda) lo que pasa al salir de las normas a los Términos o a la Privacidad dentro del
   iPhone: de la página legal se vuelve a donde se estaba («De una página legal se vuelve a donde se estaba»). */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64')
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const LISTAS = {
  categorias: { movil: 'Móviles y electrónica', furgoneta: 'Furgoneta y accesorios', otros: 'Otras cosas' },
  estados_articulo: { nuevo: 'Nuevo', como_nuevo: 'Como nuevo', buen_estado: 'Buen estado' },
  // Los del servidor TAL CUAL (backend/mercadillo.py, MOTIVOS_DENUNCIA). «acoso» no existe: el acoso se denuncia con «ofensivo».
  motivos_denuncia: { prohibido: 'Está prohibido o es ilegal', estafa: 'Es un engaño o una posible estafa', robado: 'Es robado o de una empresa',
    ofensivo: 'Es ofensivo o es acoso', otro: 'Otra cosa' },
}
const YO = { nombre: 'Ana P.', tipo: 'autonomo' }
const SOPORTE = { id: 'a2', titulo: 'Soporte de móvil para la furgoneta', descripcion: 'Poco uso.', precio_cent: 1500, categoria: 'movil', estado_articulo: 'como_nuevo',
  zona: 'A Coruña', fotos: ['f-a2'], estado: 'publicado', mio: false, publicado_en: '2026-11-08T10:00:00+00:00', vendedor: { nombre: 'Luis G.', tipo: 'conductor' } }
const MENSAJES = [{ id: 'm2', mio: true, texto: 'Hola, ¿sigue disponible?', ts: '2026-11-09T11:00:00+00:00' }, { id: 'm3', mio: false, texto: 'Sí, sigue disponible', ts: '2026-11-09T12:00:00+00:00' }]

/* Lo que dice el servidor (backend/mercadillo.py y server.py), TAL CUAL. */
const MOTIVOS_EXPULSION = {
  ofensivo: 'Has publicado o enviado contenido ofensivo.',
  acoso: 'Has acosado o molestado a otra persona.',
  prohibido: 'Has intentado vender algo que las normas no permiten.',
  estafa: 'Hemos visto un engaño o un intento de estafa.',
  repetido: 'Has incumplido las normas varias veces.',
  otro: 'Has incumplido las normas del mercadillo.',
}
const CONTACTO = 'contacto@flotadsp.com'
const sinAcceso = (motivo, nota = '') => `Te hemos quitado el acceso al mercadillo. Motivo: ${MOTIVOS_EXPULSION[motivo]}${nota ? ` ${nota}` : ''} Si crees que es un error, escribe a ${CONTACTO} y lo revisamos.`
const SIN_ACEPTAR = 'Tienes que aceptar las normas para usar el mercadillo'

/** El mercadillo del servidor, simulado y CON MEMORIA. `normas`: lo que vale `normas_ok` (sin decirlo, el campo NO viene, como en
 *  un servidor de antes); `normasEn`: en qué respuesta viene ('las dos', 'estado' o 'lista'); `expulsado`: el texto de quien se
 *  ha quedado sin acceso (entonces todo contesta 403 con él, salvo /estado). Se pueden cambiar a mitad de la prueba (`s.…`).
 *  `demora`: lo que tardan en contestar el estado y la lista (ms), para ver qué se pinta mientras tanto.
 *  `estadoCae` y `listaCae`: /mercadillo/estado o la lista NO llegan: un código de error (500…) o 'red' (se corta la conexión).
 *  `oculto`: el texto del 403 de quien el servidor no deja pasar por `_merc_yo` (la ficha de baja, una empresa sin el
 *  mercadillo): entonces /estado contesta 200 `{visible: false}`, sin más, y todo lo demás 403 con ese texto.
 *  `apagado`: el texto del 404 de cuando Dani apaga el mercadillo: /estado contesta 200 `{visible: false}` y todo lo demás 404.
 *  `listaNo`: con el estado bueno, la lista contesta 403 con ese texto (lo demás, como siempre).
 *  `apagado`, `listaNo` y `listaCae` también se pueden cambiar a mitad de la prueba (`s.…`). */
async function mercadillo(page, { normas, normasEn = 'las dos', expulsado = '', oculto = '', apagado = '', listaNo = '', errorNormas = null, demora = 0, estadoCae = null, listaCae = null } = {}) {
  const s = { normas, expulsado, oculto, apagado, listaNo, listaCae, llamadas: [], aceptado: null, pedidas: [] }
  const campo = (donde) => (s.normas === undefined || (normasEn !== 'las dos' && normasEn !== donde) ? {} : { normas_ok: s.normas })
  await page.route(/\/api\/mercadillo(?:\/[^?]*)?(?:\?.*)?$/, async (x) => {
    const pet = x.request()
    const metodo = pet.method()
    const ruta = new URL(pet.url()).pathname.replace(/^.*\/api\/mercadillo/, '')
    const json = (j, status = 200) => x.fulfill({ status, json: j })
    // Lo que no llega: sin red, o con el error de un servidor caído (que no trae ningún `detail` del mercadillo).
    const caida = (como) => (como === 'red' ? x.abort('connectionfailed') : x.fulfill({ status: como, contentType: 'text/plain', body: 'Internal Server Error' }))
    s.pedidas.push(`${metodo} ${ruta || '/'}`)
    if (demora && (ruta === '/estado' || ruta === '')) await new Promise((r) => setTimeout(r, demora))
    if (ruta === '/estado') {
      if (estadoCae) return caida(estadoCae)
      if (s.oculto || s.apagado) return json({ visible: false })
      return json(s.expulsado
        ? { visible: true, abierto: true, expulsado: true, texto: s.expulsado, sin_leer: 0, yo: YO }
        : { visible: true, abierto: true, sin_leer: 1, yo: YO, avisos_movil: false, ...campo('estado') })
    }
    if (s.listaCae && ruta === '' && metodo === 'GET') return caida(s.listaCae)
    if (s.expulsado) return json({ detail: s.expulsado }, 403)
    if (s.oculto) return json({ detail: s.oculto }, 403)
    if (s.apagado) return json({ detail: s.apagado }, 404)
    if (s.listaNo && ruta === '' && metodo === 'GET') return json({ detail: s.listaNo }, 403)
    if (ruta === '' && metodo === 'GET') return json({ anuncios: [SOPORTE], mios: [], ...LISTAS, activos_max: 3, dias: 30, yo: YO, bloqueados: 0, ...campo('lista') })
    if (ruta === '/normas' && metodo === 'POST') {
      s.llamadas.push('normas')
      try { s.aceptado = pet.postDataJSON() } catch { s.aceptado = null }
      if (errorNormas) return json({ detail: errorNormas.detail }, errorNormas.status)
      if (s.aceptado?.acepto !== true) return json({ detail: SIN_ACEPTAR }, 400)
      s.normas = true
      return json({ ok: true, normas_ok: true })
    }
    if (ruta.startsWith('/foto/')) return x.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    if (ruta === '/anuncio/a2' && metodo === 'GET') return json({ ...SOPORTE, conversacion_id: 'c2' })
    if (ruta === '/buzon') {
      return json({ conversaciones: [{ id: 'c2', anuncio_id: 'a2', titulo: SOPORTE.titulo, precio_cent: SOPORTE.precio_cent, foto: 'f-a2', estado_anuncio: 'publicado',
        con: 'Luis G.', soy: 'comprador', ultimo: '2026-11-09T12:00:00+00:00', ultimo_texto: 'Sí, sigue disponible', bloqueada: false, sin_leer: true }], avisos: [] })
    }
    if (ruta === '/conversacion/c2' && metodo === 'GET') return json({ id: 'c2', soy: 'comprador', con: 'Luis G.', bloqueada: false, anuncio: SOPORTE, mensajes: MENSAJES })
    return json({ ok: true })
  })
  return s
}

/** Al mercadillo: por su dirección (/mercadillo) o, con `porLaApp`, por la app de quien reparte por su cuenta (Cuenta → Mercadillo). */
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
  return s
}

const vender = (page) => page.getByRole('button', { name: /Vender algo que no uses/ })
const acepto = (page) => page.getByRole('button', { name: 'Acepto las normas', exact: true })
const anuncio = (page) => page.getByRole('button', { name: /Soporte de móvil/ })
const cabecera = (page, titulo) => page.locator('main').getByText(titulo, { exact: true })
const normas = (page) => page.locator('main').getByRole('listitem')
const ANTES_DE_ENTRAR = 'Antes de entrar, lee las normas y acéptalas.'
const apartadoDelMercadillo = (pagina) => pagina.getByRole('heading', { name: /Mercadillo de repartidores|Couriers’ marketplace/ })
// «Volver» («Back» en inglés) de una página legal: solo sale dentro de la app. Y la barra en la que va, pegada arriba.
const volverDeLaLegal = (pagina) => pagina.getByRole('button', { name: /^(?:Volver|Back)$/ })
const barraDeVolver = (pagina) => pagina.locator('div.sticky', { has: volverDeLaLegal(pagina) })
/** «Llega a su apartado»: la página se ha desplazado y el título del apartado del mercadillo está entero en la pantalla y ARRIBA
 *  (en su tercio de arriba: no vale que asome por abajo), con algo de aire encima: no pegado al borde, que dentro de la app de
 *  iPhone es donde va la barra de estado (allí el hueco es ese aire MÁS la barra: `env(safe-area-inset-top)`, que aquí vale 0).
 *  Dentro de la app, además, la página lleva arriba la barra de «Volver», que se queda pegada: el título queda DEBAJO de ella,
 *  con su aire, no tapado. */
async function enSuApartado(pagina, donde) {
  const apartado = apartadoDelMercadillo(pagina)
  await expect(apartado, `${donde}: el apartado del mercadillo no está en la pantalla`).toBeInViewport({ ratio: 1 })
  const { desplazado, alto } = await pagina.evaluate(() => ({ desplazado: window.scrollY, alto: window.innerHeight }))
  expect(desplazado, `${donde}: la página no se ha desplazado hasta el apartado`).toBeGreaterThan(300)
  const y = (await apartado.boundingBox()).y
  expect(y, `${donde}: el título del apartado no queda pegado al borde de arriba`).toBeGreaterThanOrEqual(8)
  expect(y, `${donde}: el apartado queda arriba, no asomando por abajo`).toBeLessThan(alto / 3)
  if (await volverDeLaLegal(pagina).count()) {
    const barra = await barraDeVolver(pagina).boundingBox()
    expect(y, `${donde}: la barra de «Volver» no tapa el título del apartado`).toBeGreaterThanOrEqual(barra.y + barra.height + 8)
  }
}

for (const [donde, ios] of [['web', false], ['iPhone', true]]) {
  test.describe(`Mercadillo · las normas la primera vez y quien se queda sin acceso (${donde})`, () => {
    if (ios) test.use({ userAgent: UA_APP })
    /** En el iPhone, además, que la pantalla de ahora no diga nada de lo prohibido (planes, pagos, otra plataforma…). */
    const sinVocabulario = async (page, que) => { if (ios) { await quieta(page, 250); await limpia(page, `mercadillo en el iPhone · ${que}`, { perfil: 'basico' }) } }

    test('con normas_ok: false, antes que nada salen las normas; «Acepto las normas» lo apunta en el servidor y deja pasar', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, normas: false })
      await expect(cabecera(page, 'Normas del mercadillo')).toBeVisible()
      await expect(page.getByText(ANTES_DE_ENTRAR, { exact: true })).toBeVisible()
      await expect(normas(page)).toHaveCount(10)
      await expect(normas(page).first()).toHaveText('Solo particulares: vende cosas tuyas que ya no usas. Nada de tiendas ni reventa.')
      /* 10-11-2026 (cuarta tanda): son 10. La de los mensajes dice que solo los lee una persona si se denuncian, y la última
         es nueva: el filtro automático y lo que se le dice a quien se queda sin mercadillo. La de la tolerancia cero es ahora
         la penúltima. */
      await expect(normas(page).nth(5)).toHaveText('Habla por los mensajes de aquí: son privados entre los dos. Solo los lee una persona si alguien los denuncia.')
      await expect(page.getByText('Solo los miramos si alguien los denuncia.'), 'la frase de antes ya no está').toHaveCount(0)
      await expect(normas(page).nth(8)).toContainText('No se tolera el contenido ofensivo ni el acoso: quien lo haga se queda sin mercadillo.')
      await expect(normas(page).last()).toHaveText('Un filtro automático no deja enviar insultos ni amenazas. A quien se queda sin mercadillo le decimos por qué, y puede pedir que lo revisemos.')
      await expect(page.getByRole('link', { name: 'Términos', exact: true })).toHaveAttribute('href', '/terminos#mercadillo')
      await expect(page.getByRole('link', { name: 'Privacidad', exact: true })).toHaveAttribute('href', '/privacidad')
      // En la web se abren en otra pestaña; dentro de la app de iPhone, en la misma ventana (allí un target="_blank" no abre nada).
      for (const nombre of ['Términos', 'Privacidad']) {
        const enlace = page.getByRole('link', { name: nombre, exact: true })
        if (ios) await expect(enlace, `en el iPhone «${nombre}» se abre en la misma ventana`).not.toHaveAttribute('target')
        else await expect(enlace, `en la web «${nombre}» se abre en otra pestaña`).toHaveAttribute('target', '_blank')
      }
      // «Acepto las normas», a la vista sin desplazar nada; y detrás no hay mercadillo: ni «Vender», ni anuncios, ni buzón.
      await expect(acepto(page)).toBeInViewport({ ratio: 1 })
      expect(await page.evaluate(() => window.scrollY), 'la prueba no ha desplazado la pantalla').toBe(0)
      await expect(vender(page)).toHaveCount(0)
      await expect(anuncio(page)).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Mensajes/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Mis anuncios' })).toHaveCount(0)
      await sinVocabulario(page, 'las normas que se aceptan al entrar')
      expect(s.llamadas, 'leerlas no las acepta').toEqual([])

      await acepto(page).click()
      await expect(vender(page)).toBeVisible()
      expect(s.llamadas).toEqual(['normas'])
      expect(s.aceptado, 'el POST lleva la aceptación').toEqual({ acepto: true })
      await expect(anuncio(page)).toBeVisible()
      await expect(acepto(page)).toHaveCount(0)
      await sinVocabulario(page, 'la lista tras aceptar las normas')

      // «Normas y seguridad», al pie de la lista, sigue igual: se leen, sin nada que aceptar.
      await page.getByRole('button', { name: 'Normas y seguridad' }).click()
      await expect(cabecera(page, 'Normas del mercadillo')).toBeVisible()
      await expect(normas(page)).toHaveCount(10)
      await expect(page.getByText(ANTES_DE_ENTRAR)).toHaveCount(0)
      await expect(acepto(page)).toHaveCount(0)
      // Y al volver a la lista (que vuelve a preguntar al servidor) no se piden otra vez.
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(vender(page)).toBeVisible()
      await expect(acepto(page)).toHaveCount(0)
      expect(s.llamadas).toEqual(['normas'])
      expect(fallos).toEqual([])
    })

    /* «Términos», desde la pantalla en la que se aceptan las normas, se tiene que poder leer Y LLEGAR A SU APARTADO (10-11-2026).
       En la web se abre en otra pestaña. Dentro de la app de iPhone un enlace con target="_blank" a una página de la propia app no
       abre nada (Capacitor se lo pasa al sistema, y `capacitor://localhost/…` fuera de la app no existe): va en la misma
       ventana, en su versión de dentro de la app (sin nada de pagos). Antes la página se abría ARRIBA (las páginas legales no se
       desplazaban solas a `#mercadillo`: el título del apartado quedaba 1.281 px más abajo en 375 × 647). */
    test(ios ? 'dentro del iPhone, «Términos» se abre en la misma ventana y llega a su apartado del mercadillo, sin nada prohibido'
      : 'en la web, «Términos» se abre en otra pestaña y llega a su apartado del mercadillo', async ({ page, context }) => {
      const fallos = vigilar(page)
      await entrar(page, { ios, normas: false })
      const enlace = page.getByRole('link', { name: 'Términos', exact: true })
      let terminos = page
      if (ios) await enlace.click()
      else [terminos] = await Promise.all([context.waitForEvent('page'), enlace.click()])
      await expect(terminos).toHaveURL(/\/terminos#mercadillo$/)
      await expect(terminos.getByRole('heading', { level: 1 })).toHaveText('Términos y Condiciones de Uso')
      await enSuApartado(terminos, 'los términos abiertos desde las normas')
      await expect(terminos.getByText('Para usar el mercadillo tienes que aceptar sus normas la primera vez que entras', { exact: false })).toBeVisible()
      expect(context.pages(), ios ? 'no se ha abierto otra ventana' : 'se ha abierto en otra pestaña').toHaveLength(ios ? 1 : 2)
      if (ios) {
        await quieta(terminos, 400)
        await limpia(terminos, 'los términos abiertos desde las normas del mercadillo', { perfil: 'basico' })
      }
      expect(fallos).toEqual([])
    })

    test('volver sin aceptar es salir del mercadillo; al entrar otra vez, se vuelven a pedir', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, porLaApp: true, normas: false })
      await expect(acepto(page)).toBeVisible()
      await page.getByRole('button', { name: 'Volver' }).click()
      const tarjeta = page.getByRole('button', { name: /Mercadillo de repartidores/ })
      await expect(tarjeta, 'de vuelta en «Cuenta»').toBeVisible()
      await expect(acepto(page)).toHaveCount(0)
      expect(s.llamadas, 'volver no acepta nada').toEqual([])
      await tarjeta.click()
      await expect(acepto(page)).toBeVisible()
      await expect(vender(page)).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    test('si el servidor no deja aceptar, se lee lo que contesta y no se pasa', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, normas: false, errorNormas: { status: 400, detail: SIN_ACEPTAR } })
      await acepto(page).click()
      await expect(page.getByRole('alert')).toHaveText(SIN_ACEPTAR)
      expect(s.llamadas).toEqual(['normas'])
      await expect(acepto(page), 'se puede volver a intentar').toBeEnabled()
      await expect(vender(page)).toHaveCount(0)
      await sinVocabulario(page, 'las normas con el error del servidor')
      expect(fallos).toEqual([])
    })

    test('a quien se le ha quitado el acceso: solo la cabecera y el porqué; ni lista, ni «Vender», ni buzón', async ({ page }) => {
      const fallos = vigilar(page)
      const TEXTO = sinAcceso('acoso', 'Varias personas nos han avisado.')
      // La tarjeta de fuera («Cuenta») no cambia: por ella se entra, y volver lleva otra vez a ella.
      const s = await entrar(page, { ios, porLaApp: true, expulsado: TEXTO })
      const porque = page.getByRole('alert')
      await expect(porque).toHaveText(TEXTO)
      await expect(porque, 'el porqué se dice una vez (el 403 de la lista no se pinta además)').toHaveCount(1)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(porque.getByRole('link', { name: CONTACTO })).toHaveAttribute('href', `mailto:${CONTACTO}`)
      for (const nombre of [/Vender algo que no uses/, /^Mensajes/, 'Mis anuncios', 'Normas y seguridad', /Personas bloqueadas/, 'Acepto las normas']) {
        await expect(page.getByRole('button', { name: nombre }), `a quien no tiene acceso no se le ofrece ${nombre}`).toHaveCount(0)
      }
      await expect(anuncio(page)).toHaveCount(0)
      await sinVocabulario(page, 'quien se ha quedado sin acceso')
      // No ha pedido nada de dentro: solo el estado y la lista (que le contesta 403).
      expect([...new Set(s.pedidas)].sort()).toEqual(['GET /', 'GET /estado'])
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(page.getByRole('button', { name: /Mercadillo de repartidores/ }), 'de vuelta en «Cuenta»').toBeVisible()
      await expect(porque).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    test('si le quitan el acceso con el mercadillo abierto: la pantalla de dentro dice el porqué y, al volver, ya no hay mercadillo', async ({ page }) => {
      const fallos = vigilar(page)
      const TEXTO = sinAcceso('ofensivo')
      const s = await entrar(page, { ios })
      await expect(anuncio(page)).toBeVisible()
      s.expulsado = TEXTO                                              // se lo quitan ahora, con la lista delante
      await anuncio(page).click()
      await expect(page.getByRole('alert'), 'el 403 del anuncio se lee tal cual').toHaveText(TEXTO)
      await sinVocabulario(page, 'el anuncio que ya no se puede abrir')
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(page.getByRole('alert')).toHaveText(TEXTO)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(vender(page)).toHaveCount(0)
      await expect(anuncio(page)).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    /* SI EL ESTADO NO LLEGA Y LA LISTA DICE 403 (10-11-2026, cuarta tanda). Quien no puede pasar se entera por /mercadillo/estado
       (`expulsado` y su `texto`). Si justo esa petición no llega (se corta la conexión, o un 5xx) y la lista contesta 403, se
       pintaba la portada entera —«Vender», «Mis anuncios», el buzón, las normas— con el error encima. Ahora sale la pantalla de
       quien no puede pasar, con lo que diga ese 403. */
    for (const [como, estadoCae] of [['con un 500', 500], ['sin conexión', 'red']]) {
      test(`si /mercadillo/estado no llega (${como}) y la lista contesta 403: la pantalla de quien no puede pasar con el texto de ese 403, no la portada`, async ({ page }) => {
        const fallos = vigilar(page)
        const TEXTO = sinAcceso('prohibido')
        const s = await entrar(page, { ios, expulsado: TEXTO, estadoCae })
        const porque = page.getByRole('alert')
        await expect(porque).toHaveText(TEXTO)
        await expect(porque, 'el porqué se dice una vez').toHaveCount(1)
        await expect(cabecera(page, 'Mercadillo')).toBeVisible()
        await expect(porque.getByRole('link', { name: CONTACTO })).toHaveAttribute('href', `mailto:${CONTACTO}`)
        for (const nombre of [/Vender algo que no uses/, /^Mensajes/, 'Mis anuncios', 'Normas y seguridad', /Personas bloqueadas/, 'Acepto las normas', 'Todo']) {
          await expect(page.getByRole('button', { name: nombre }), `a quien no puede pasar no se le ofrece ${nombre}`).toHaveCount(0)
        }
        expect(await page.locator('main').getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim())),
          'lo único que se puede pulsar es «Volver»').toEqual(['Volver'])
        await expect(anuncio(page)).toHaveCount(0)
        await sinVocabulario(page, 'quien no puede pasar, con el estado sin llegar')
        expect([...new Set(s.pedidas)].sort(), 'ha pedido el estado (que no ha llegado) y la lista (403)').toEqual(['GET /', 'GET /estado'])
        expect(fallos).toEqual([])
      })
    }

    /* SI EL ESTADO DICE `{visible: false}` Y LA LISTA 403 (10-11-2026, quinta tanda). A quien el servidor no deja pasar por
       `_merc_yo` (la ficha de baja, una empresa sin el mercadillo), el estado le contesta 200 `{visible: false}`, sin `texto`.
       Se pintaba la portada con el error encima y, si ya tenía la lista cargada, los anuncios de antes. */
    const NO_ES_SUYO = 'Tu empresa no tiene el mercadillo'
    test('si el estado dice {visible: false} y la lista contesta 403: solo la cabecera y el texto de ese 403, sin «Vender»', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, oculto: NO_ES_SUYO })
      const porque = page.getByRole('alert')
      await expect(porque).toHaveText(NO_ES_SUYO)
      await expect(porque, 'el texto se dice una vez').toHaveCount(1)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(vender(page)).toHaveCount(0)
      expect(await page.locator('main').getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim())),
        'lo único que se puede pulsar es «Volver»').toEqual(['Volver'])
      await expect(anuncio(page)).toHaveCount(0)
      await sinVocabulario(page, 'quien no puede pasar, con el estado en {visible: false}')
      expect([...new Set(s.pedidas)].sort()).toEqual(['GET /', 'GET /estado'])
      expect(fallos).toEqual([])
    })

    test('con la lista ya cargada, si al volver a la portada el estado dice {visible: false} y la lista 403: no queda ningún anuncio de antes', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios })
      await expect(anuncio(page)).toBeVisible()
      await page.getByRole('button', { name: /^Mensajes/ }).click()
      await expect(page.getByRole('button', { name: /Luis G\./ })).toBeVisible()
      s.oculto = NO_ES_SUYO                                            // le dan de baja con el buzón delante
      await page.getByRole('button', { name: 'Volver' }).click()
      await expect(page.getByRole('alert')).toHaveText(NO_ES_SUYO)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(anuncio(page), 'los anuncios de antes no se quedan pintados').toHaveCount(0)
      await expect(vender(page)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Normas y seguridad' })).toHaveCount(0)
      await sinVocabulario(page, 'quien se queda fuera con la lista ya cargada')
      expect(fallos).toEqual([])
    })

    /* LO MISMO CON EL MERCADILLO APAGADO (10-11-2026, sexta tanda). Cuando Dani lo apaga, a los demás el estado les contesta
       `{visible: false}` y la lista 404 «El mercadillo todavía no está abierto». La puerta solo miraba el 403: se volvía a la
       portada con el error, «Vender» y los anuncios de antes. */
    const APAGADO = 'El mercadillo todavía no está abierto'
    const soloVolver = async (page) => expect(await page.locator('main').getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim())),
      'lo único que se puede pulsar es «Volver»').toEqual(['Volver'])
    /** Con la lista ya cargada, al buzón; ahí `cambio(s)` cambia el servidor, y «Volver» a la portada lo recarga. */
    async function cargadaYVolver(page, cambio) {
      const s = await entrar(page, { ios })
      await expect(anuncio(page)).toBeVisible()
      await page.getByRole('button', { name: /^Mensajes/ }).click()
      await expect(page.getByRole('button', { name: /Luis G\./ })).toBeVisible()
      cambio(s)
      await page.getByRole('button', { name: 'Volver' }).click()
      return s
    }

    test('si el estado dice {visible: false} y la lista contesta 404 (el mercadillo apagado): solo la cabecera y el texto de ese 404, sin «Vender»', async ({ page }) => {
      const fallos = vigilar(page)
      const s = await entrar(page, { ios, apagado: APAGADO })
      const porque = page.getByRole('alert')
      await expect(porque).toHaveText(APAGADO)
      await expect(porque, 'el texto se dice una vez').toHaveCount(1)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(vender(page)).toHaveCount(0)
      await soloVolver(page)
      await expect(anuncio(page)).toHaveCount(0)
      await sinVocabulario(page, 'el mercadillo apagado, en la primera carga')
      expect([...new Set(s.pedidas)].sort()).toEqual(['GET /', 'GET /estado'])
      expect(fallos).toEqual([])
    })

    test('con la lista ya cargada, si al volver a la portada el mercadillo está apagado ({visible: false} y la lista 404): solo la cabecera y ese texto, ningún anuncio de antes', async ({ page }) => {
      const fallos = vigilar(page)
      await cargadaYVolver(page, (s) => { s.apagado = APAGADO })       // Dani lo apaga con el buzón delante
      await expect(page.getByRole('alert')).toHaveText(APAGADO)
      await expect(cabecera(page, 'Mercadillo')).toBeVisible()
      await expect(anuncio(page), 'los anuncios de antes no se quedan pintados').toHaveCount(0)
      await expect(vender(page)).toHaveCount(0)
      await soloVolver(page)
      await sinVocabulario(page, 'el mercadillo apagado con la lista ya cargada')
      expect(fallos).toEqual([])
    })

    // El control: con el estado en `{visible: false}`, un fallo pasajero de la lista (500 o sin red) no cierra a nadie.
    for (const [como, cae] of [['con un 500', 500], ['sin conexión', 'red']]) {
      test(`control · con la lista ya cargada, si al volver el estado dice {visible: false} y la lista no llega (${como}): la portada con su aviso, no la pantalla de quien no puede pasar`, async ({ page }) => {
        const fallos = vigilar(page)
        await cargadaYVolver(page, (s) => { s.apagado = APAGADO; s.listaCae = cae })
        await expect(page.getByRole('alert')).toHaveText('No se ha podido abrir el mercadillo.')
        await expect(vender(page)).toBeVisible()
        await expect(page.getByRole('button', { name: 'Normas y seguridad' })).toBeVisible()
        expect(fallos).toEqual([])
      })
    }

    /* «NO QUEDAN LOS ANUNCIOS DE ANTES», SUJETO (sexta tanda). Con el estado bueno (visible, sin `expulsado`) y la lista en 403
       no es la pantalla de quien no puede pasar, sino la portada con su aviso; pero sin los anuncios que tenía cargados. */
    test('con la lista ya cargada, si al volver el estado es el bueno y la lista contesta 403: la portada con su aviso y ningún anuncio de antes', async ({ page }) => {
      const fallos = vigilar(page)
      await cargadaYVolver(page, (s) => { s.listaNo = NO_ES_SUYO })
      await expect(page.getByRole('alert')).toHaveText(NO_ES_SUYO)
      await expect(vender(page), 'es la portada, no la pantalla de quien no puede pasar').toBeVisible()
      await expect(anuncio(page), 'los anuncios de antes no se quedan pintados').toHaveCount(0)
      await sinVocabulario(page, 'la portada con la lista en 403')
      expect(fallos).toEqual([])
    })

    test('control · con el estado bueno y la lista en 500: la portada con su aviso, como siempre', async ({ page }) => {
      const fallos = vigilar(page)
      await entrar(page, { ios, listaCae: 500 })
      await expect(page.getByRole('alert')).toHaveText('No se ha podido abrir el mercadillo.')
      await expect(vender(page)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Normas y seguridad' })).toBeVisible()
      expect(fallos).toEqual([])
    })

    // El control: lo de arriba es SOLO para el 403. Si lo que falla es otra cosa (todo caído), a nadie se le cierra el mercadillo.
    test('control · si no llegan ni el estado ni la lista (500 los dos), no es la pantalla de quien no puede pasar: la portada con su aviso, como siempre', async ({ page }) => {
      const fallos = vigilar(page)
      await entrar(page, { ios, estadoCae: 500, listaCae: 500 })
      await expect(page.getByRole('alert')).toHaveText('No se ha podido abrir el mercadillo.')
      await expect(vender(page)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Normas y seguridad' })).toBeVisible()
      await expect(page.getByText(/Te hemos quitado el acceso/)).toHaveCount(0)
      expect(fallos).toEqual([])
    })

    /* «Avisarme en el móvil» son los avisos del navegador. Dentro de la app de iPhone no existen, y el botón solo sabía contestar
       «Este navegador no permite avisos. En iPhone, primero añade la app a la pantalla de inicio…»: allí no se pinta. */
    test(ios ? '«Avisarme en el móvil» no sale dentro de la app de iPhone: ni en el buzón ni después de escribir' : 'control · en la web «Avisarme en el móvil» sigue en el buzón y después de escribir', async ({ page }) => {
      const fallos = vigilar(page)
      await entrar(page, { ios })
      await page.getByRole('button', { name: 'Mensajes, 1 sin leer' }).click()
      await expect(page.getByText('Privados entre quien compra y quien vende')).toBeVisible()
      await expect(page.getByText('Sí, sigue disponible')).toBeVisible()
      const interruptor = page.getByRole('switch', { name: 'Avisarme en el móvil' })
      if (ios) {
        await expect(interruptor).toHaveCount(0)
        expect(await lo(page), 'el buzón del iPhone no habla de avisos al móvil').not.toMatch(/en el móvil|navegador|pantalla de inicio/i)
      } else {
        await expect(interruptor).toBeVisible()
        await expect(page.getByText('Cuando alguien te escriba o se revise tu anuncio')).toBeVisible()
      }
      await sinVocabulario(page, 'el buzón sin «Avisarme en el móvil»')
      await page.getByRole('button', { name: /Luis G\./ }).click()
      await expect(page.getByText('Hola, ¿sigue disponible?')).toBeVisible()
      const pregunta = page.getByText('¿Te avisamos en el móvil cuando te contesten?')
      const si = page.getByRole('button', { name: 'Sí, avísame en el móvil' })
      if (ios) {
        await expect(pregunta).toHaveCount(0)
        await expect(si).toHaveCount(0)
        expect(await lo(page), 'la conversación del iPhone no habla de avisos al móvil').not.toMatch(/en el móvil|navegador|pantalla de inicio/i)
      } else {
        await expect(pregunta).toBeVisible()
        await expect(si).toBeVisible()
      }
      await sinVocabulario(page, 'la conversación sin la pregunta de los avisos')
      expect(fallos).toEqual([])
    })
  })
}

/* ── LOS TÉRMINOS, EN SU APARTADO (10-11-2026) ────────────────────────────────────────────────────────────────────────────────
   Las normas enlazan a /terminos#mercadillo. Una página de React no se desplaza sola al `#…` (cuando el navegador lo busca, el
   texto aún no está pintado) y se abría arriba. Ahora llega a su apartado: en la pantalla más pequeña (375 × 647), en la web y en
   la app de iPhone, en español y en inglés. Sin `#` en la dirección no cambia nada: arriba, como siempre. De paso, la fecha de
   «Última actualización» de los Términos, que han cambiado hoy (como la de la Privacidad). */
for (const [donde, ios] of [['web', false], ['iPhone', true]]) {
  for (const [idioma, locale] of [['es', 'es-ES'], ['en', 'en-GB']]) {
    test.describe(`Términos · su apartado del mercadillo (${donde}, ${locale})`, () => {
      test.use({ locale, viewport: { width: 375, height: 647 }, ...(ios ? { userAgent: UA_APP } : {}) })
      test('/terminos#mercadillo deja «Mercadillo de repartidores» dentro de la pantalla (375 × 647); /terminos, arriba como siempre', async ({ page }) => {
        const fallos = vigilar(page)
        await simularApi(page, 'vacio')
        await arrancar(page, { ios })
        await page.goto('/terminos#mercadillo', { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(idioma === 'es' ? 'Términos y Condiciones de Uso' : 'Terms and Conditions of Use')
        await enSuApartado(page, `/terminos#mercadillo (${donde}, ${locale})`)
        await expect(apartadoDelMercadillo(page)).toHaveText(new RegExp(idioma === 'es' ? 'Mercadillo de repartidores$' : 'Couriers’ marketplace$'))
        await expect(page.getByText(idioma === 'es' ? 'Última actualización: 2026-11-10' : 'Last updated: 2026-11-10', { exact: true })).toHaveCount(1)
        if (ios) {
          await quieta(page, 400)
          await limpia(page, `/terminos#mercadillo en el iPhone (${locale})`, { idioma, perfil: 'basico' })
        }
        // Y quieta: se desplaza al llegar, no cada vez que se pinta. Tras subir a mano, la página no vuelve sola al apartado.
        await page.evaluate(() => document.fonts.ready)
        await page.evaluate(() => window.scrollTo(0, 0))
        await quieta(page, 500)
        expect(await page.evaluate(() => window.scrollY), 'tras subir a mano, la página no vuelve sola al apartado').toBe(0)

        // El control: sin apartado en la dirección, la página se abre arriba y no se mueve.
        await page.goto('/terminos', { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 })
        await page.evaluate(() => document.fonts.ready)
        await quieta(page, 500)
        expect(await page.evaluate(() => window.scrollY), '/terminos sin apartado: arriba').toBe(0)
        await expect(apartadoDelMercadillo(page)).not.toBeInViewport()
        expect(fallos).toEqual([])
      })
    })
  }
}

/* ── DE UNA PÁGINA LEGAL SE VUELVE A DONDE SE ESTABA (10-11-2026, cuarta tanda) ───────────────────────────────────────────────
   Dentro de la app de iPhone «Términos» y «Privacidad» se abren en la misma ventana, y la única salida de la página legal era su
   logotipo, que va a «/». Allí «/» mandaba SIEMPRE a /ruta: un conductor de empresa (que solo tiene su sesión de conductor)
   acababa en la entrada de oficina, y con la zona de arranque (`fds_app_zona`) cambiada a /ruta: la app le arrancaba ahí para
   siempre. Ahora, dentro de la app:
     · la página legal lleva arriba «Volver» («Back» en inglés), siempre a la vista, que vuelve a donde se estaba (y si no hay a
       dónde volver, a la zona guardada);
     · su logotipo, y cualquier página que allí no existe, llevan a la zona de cada uno (el portal del conductor con su empresa,
       la ruta o el panel), no siempre a /ruta.
   En la web no cambia nada: ni «Volver», ni zona; el logotipo va a la portada. */
const zonaDeArranque = (pagina) => pagina.evaluate(() => localStorage.getItem('fds_app_zona'))
const logotipo = (pagina) => pagina.locator('nav a').first()
const HOLA = 'Hola, ANA'

/** La sesión de un conductor de empresa y NADA MÁS (ni `flota_token` ni `flota_admin`): como en su móvil. `donde`: la página o,
 *  para que valga también en las ventanas que se abran, el contexto. */
async function sesionDeConductor(donde) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await donde.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA LÓPEZ', center: 'NORTE' }))
  }, token)
}
/** El conductor, dentro del portal de su empresa (/conductor/oga5), con el mercadillo abierto para todos. */
async function conductor(page, { ios = true, ...opciones } = {}) {
  await sesionDeConductor(page)
  await simularApi(page, 'vacio')
  await arrancar(page, { ios })
  const s = await mercadillo(page, opciones)
  await page.goto('/conductor/oga5', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(HOLA)).toBeVisible()
  expect(await page.evaluate(() => [localStorage.getItem('flota_token'), localStorage.getItem('flota_admin')]), 'solo tiene su sesión de conductor').toEqual([null, null])
  return s
}
/* Los tres que usan la app: `entrar` les deja delante de las normas del mercadillo (que aún no han aceptado), cada uno por su
   camino; `zona`, la suya; `deVuelta`, lo que se ve al volver a donde estaban; `enSuZona`, lo que se ve en su zona. */
const QUIENES = [
  { nombre: 'un conductor de empresa (solo su sesión de conductor)', zona: '/conductor/oga5',
    entrar: async (page) => { await conductor(page, { normas: false }); await page.getByRole('button', { name: /Mercadillo/ }).click() },
    deVuelta: (page) => page.getByText(HOLA), enSuZona: (page) => page.getByText(HOLA) },
  { nombre: 'quien reparte por su cuenta', zona: '/ruta',
    entrar: (page) => entrar(page, { ios: true, porLaApp: true, normas: false }),
    deVuelta: (page) => page.getByRole('button', { name: /Mercadillo de repartidores/ }), enSuZona: (page) => page.getByRole('navigation', { name: 'Secciones' }) },
  { nombre: 'alguien de oficina', zona: '/panel',
    entrar: async (page) => {
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      await arrancar(page, { ios: true })
      await mercadillo(page, { normas: false })
      await page.goto('/panel', { waitUntil: 'domcontentloaded' })
      await expect.poll(() => zonaDeArranque(page)).toBe('/panel')
      await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
    },
    deVuelta: acepto, enSuZona: (page) => page.locator('main h1').first() },
]

test.describe('De una página legal se vuelve a donde se estaba (iPhone)', () => {
  test.use({ userAgent: UA_APP })
  for (const quien of QUIENES) {
    test(`${quien.nombre}: normas → «Términos» → «Volver» le devuelve a donde estaba, y su zona de arranque no cambia`, async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      await quien.entrar(page)
      await expect(acepto(page)).toBeVisible()
      expect(await zonaDeArranque(page), 'la zona de arranque, antes de salir a la página legal').toBe(quien.zona)
      const estaba = page.url()

      await page.getByRole('link', { name: 'Términos', exact: true }).click()
      await expect(page).toHaveURL(/\/terminos#mercadillo$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Términos y Condiciones de Uso')
      await enSuApartado(page, `los términos abiertos por ${quien.nombre}`)
      // «Volver», uno solo y a la vista SIN subir (la página ha llegado desplazada a su apartado): la barra va pegada arriba.
      const volver = volverDeLaLegal(page)
      await expect(volver).toHaveCount(1)
      await expect(volver).toHaveText('Volver')
      await expect(volver, '«Volver» está a la vista sin desplazar nada').toBeInViewport({ ratio: 1 })
      expect((await barraDeVolver(page).boundingBox()).y, 'la barra de «Volver» está pegada arriba').toBeLessThanOrEqual(1)
      await quieta(page, 300)
      await limpia(page, `la página legal con «Volver» (${quien.nombre})`, { perfil: 'basico' })

      await volver.click()
      await expect(page, 'está otra vez donde estaba: ni en la entrada de oficina ni en /ruta').toHaveURL(estaba)
      await expect(quien.deVuelta(page)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Entra en FDS' }), 'no ha acabado en la entrada').toHaveCount(0)
      expect(await zonaDeArranque(page), 'la zona de arranque no ha cambiado').toBe(quien.zona)
      expect(fallos).toEqual([])
    })

    test(`${quien.nombre}: el logotipo de la página legal le lleva a su zona (${quien.zona}), no a la entrada de oficina`, async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      await quien.entrar(page)
      await expect(acepto(page)).toBeVisible()
      await page.getByRole('link', { name: 'Privacidad', exact: true }).click()
      await expect(page).toHaveURL(/\/privacidad$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de Privacidad')
      await logotipo(page).click()
      await expect(page, 'el logotipo lleva a su zona').toHaveURL(new RegExp(`${quien.zona}$`))
      await expect(quien.enSuZona(page)).toBeVisible()
      await quieta(page, 500)                                             // por si algo redirige después (la entrada de oficina)
      expect(new URL(page.url()).pathname, 'y ahí se queda').toBe(quien.zona)
      expect(await zonaDeArranque(page), 'la zona de arranque no ha cambiado').toBe(quien.zona)
      expect(fallos).toEqual([])
    })
  }

  /* Si no hay a dónde volver (la página legal es lo primero que se abre en esa ventana: su historial solo la tiene a ella),
     «Volver» lleva a la zona guardada. Aquí, una ventana nueva que nace en la Privacidad, con la sesión de un conductor. */
  test('si no hay a dónde volver, «Volver» lleva a la zona guardada (el portal del conductor), no a /ruta ni a la entrada', async ({ context }) => {
    test.setTimeout(60000)
    await sesionDeConductor(context)
    await simularApi(context, 'vacio')
    await arrancar(context, { ios: true })
    await mercadillo(context, { normas: true })
    const page = await context.newPage()
    await page.goto('/conductor/oga5', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(HOLA)).toBeVisible()
    await expect.poll(() => zonaDeArranque(page)).toBe('/conductor/oga5')
    const [legal] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => { window.open('/privacidad', '_blank', 'noopener') })])
    await expect(legal.getByRole('heading', { level: 1 })).toHaveText('Política de Privacidad')
    expect(await legal.evaluate(() => window.history.length), 'la prueba: en esa ventana no hay nada detrás').toBe(1)
    await volverDeLaLegal(legal).click()
    await expect(legal).toHaveURL(/\/conductor\/oga5$/)
    await expect(legal.getByText(HOLA)).toBeVisible()
    expect(await zonaDeArranque(legal)).toBe('/conductor/oga5')
  })

  /* Y sin zona guardada (quien abre la app por primera vez y va derecho a una página legal desde la entrada), como hasta ahora:
     a la app del repartidor, que sin sesión manda a entrar. El logotipo lo prueba también e2e/ios-sin-pagos.spec.js. */
  test('sin zona guardada, «Volver» (sin historial) y el logotipo llevan a /ruta, como hasta ahora', async ({ context }) => {
    test.setTimeout(60000)
    await simularApi(context, 'vacio')
    await arrancar(context, { ios: true })
    const page = await context.newPage()
    await page.goto('/terminos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await zonaDeArranque(page), 'la prueba: no hay zona guardada').toBeNull()
    const aLaRuta = async (pagina, que) => {
      await pagina.waitForURL(/\/login\?next=/)                             // /ruta, que sin sesión manda a entrar
      expect(decodeURIComponent(pagina.url()), `${que} lleva a /ruta`).toMatch(/\/login\?next=\/ruta$/)
    }
    const [legal] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => { window.open('/privacidad', '_blank', 'noopener') })])
    await expect(legal.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await legal.evaluate(() => window.history.length), 'la prueba: en esa ventana no hay nada detrás').toBe(1)
    await volverDeLaLegal(legal).click()
    await aLaRuta(legal, '«Volver» sin historial y sin zona')
    await legal.close()
    await page.evaluate(() => localStorage.removeItem('fds_app_zona'))    // la ha dejado la otra ventana al pasar por /ruta
    await logotipo(page).click()
    await aLaRuta(page, 'el logotipo sin zona')
  })
})

for (const [idioma, locale, nombre] of [['es', 'es-ES', 'Volver'], ['en', 'en-GB', 'Back']]) {
  test.describe(`Las páginas legales dentro del iPhone llevan «${nombre}» (${locale})`, () => {
    test.use({ userAgent: UA_APP, locale })
    test(`en todas, arriba y a la vista; y no dice nada prohibido`, async ({ page }) => {
      const fallos = vigilar(page)
      await simularApi(page, 'vacio')
      await arrancar(page, { ios: true })
      for (const ruta of ['/terminos', '/privacidad', '/cookies', '/aviso-legal', '/encargo', '/contacto', '/seguridad']) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        const volver = volverDeLaLegal(page)
        await expect(volver, `${ruta}: un «${nombre}»`).toHaveCount(1)
        await expect(volver).toHaveText(nombre)
        await expect(volver).toBeInViewport({ ratio: 1 })
        // Bien visible: una zona de toque de 44 px de alto como poco, y por encima de la navegación de la página.
        const caja = await volver.boundingBox()
        expect(caja.height, `${ruta}: «${nombre}» se puede pulsar con el dedo`).toBeGreaterThanOrEqual(44)
        expect(caja.y + caja.height, `${ruta}: «${nombre}» va arriba, antes que el logotipo`).toBeLessThanOrEqual((await logotipo(page).boundingBox()).y)
      }
      await quieta(page, 300)
      await limpia(page, `una página legal con «${nombre}» (${locale})`, { idioma, perfil: 'basico' })
      expect(fallos).toEqual([])
    })
  })
}

test('control · en la web las páginas legales no llevan «Volver», y su logotipo va a la portada aunque haya una zona guardada', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fds_app_zona', '/conductor/oga5'))
  await simularApi(page, 'vacio')
  await arrancar(page, { ios: false })
  for (const ruta of ['/terminos#mercadillo', '/privacidad', '/cookies', '/aviso-legal', '/encargo', '/contacto', '/seguridad']) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(volverDeLaLegal(page), `${ruta}: en la web no hay «Volver»`).toHaveCount(0)
    await expect(page.locator('div.sticky'), `${ruta}: ni barra pegada arriba`).toHaveCount(0)
  }
  await logotipo(page).click()
  await quieta(page, 700)
  expect(new URL(page.url()).pathname, 'el logotipo de la web va a la portada').toBe('/')
  expect(await zonaDeArranque(page), 'y la web no toca la zona').toBe('/conductor/oga5')
})

/* ── `normas_ok === false`, ESTRICTO ─────────────────────────────────────────────────────────────────────────────────────────
   La pantalla de normas la impone la web, no el servidor (la app de iPhone que está en revisión y las webs en caché no la
   conocen). Por eso solo sale cuando el servidor dice `false`: con `true`, sin el campo (un servidor de antes) o con cualquier
   otra cosa se entra como siempre, y nadie se queda fuera por esto. */
test('Mercadillo · las normas solo se piden con normas_ok === false: con true, sin el campo o con null se entra directo', async ({ page }) => {
  const s = await entrar(page, { normas: true })
  for (const valor of [true, undefined, null]) {
    s.normas = valor
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(vender(page), `con normas_ok ${valor === undefined ? 'sin venir' : valor} se entra directo`).toBeVisible()
    await expect(anuncio(page)).toBeVisible()
    await expect(acepto(page)).toHaveCount(0)
    await expect(page.getByText(ANTES_DE_ENTRAR)).toHaveCount(0)
  }
  // El control, en la misma página: con `false`, sí.
  s.normas = false
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(acepto(page)).toBeVisible()
  await expect(vender(page)).toHaveCount(0)
  expect(s.llamadas).toEqual([])
})

for (const [solo, de] of [['estado', '/mercadillo/estado'], ['lista', '/mercadillo']]) {
  test(`Mercadillo · si normas_ok: false viene solo en ${de}, las normas se piden igual y aceptarlas deja pasar`, async ({ page }) => {
    const s = await entrar(page, { normas: false, normasEn: solo })
    await expect(acepto(page)).toBeVisible()
    await expect(vender(page)).toHaveCount(0)
    await acepto(page).click()
    await expect(vender(page)).toBeVisible()
    await expect(anuncio(page)).toBeVisible()
    expect(s.aceptado).toEqual({ acepto: true })
  })
}

/* Hasta que el servidor contesta la primera vez (quién es, si tiene acceso, si ha aceptado las normas) el mercadillo pinta solo su
   cabecera. Así quien no puede pasar no llega a ver, ni un momento, «Vender», los anuncios ni el buzón. */
test('Mercadillo · mientras el servidor no ha contestado solo se ve la cabecera: quien no puede pasar no llega a ver «Vender» ni el buzón', async ({ page }) => {
  const TEXTO = sinAcceso('repetido')
  await entrar(page, { expulsado: TEXTO, demora: 1500 })
  await expect(cabecera(page, 'Mercadillo')).toBeVisible()
  // Sin `expect` que reintente (esperaría a que llegase la respuesta): AHORA MISMO lo único que se puede pulsar es «Volver».
  expect(await page.locator('main').getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim())),
    'mientras carga no hay nada del mercadillo que pulsar').toEqual(['Volver'])
  expect(await page.getByRole('alert').count(), 'todavía no ha contestado').toBe(0)
  await expect(page.getByRole('alert')).toHaveText(TEXTO)
  await expect(vender(page)).toHaveCount(0)
})

/* Lo que contesta el servidor en lo nuevo (backend/mercadillo.py y server.py, TAL CUAL el 10-11-2026): el texto de quien se queda
   sin acceso (con cada motivo, y con nota), el de las normas sin aceptar, los dos del filtro de palabras y el aviso de que se le
   devuelve el acceso (sale en su buzón). Dentro de la app de iPhone, un error que hable de planes o de topes se cambia por un
   texto neutro (lib/plataforma.js): estos tienen que leerse como son (dicen qué pasa y qué hacer) y no pueden llevar nada del
   vocabulario prohibido allí. */
const DEL_SERVIDOR = [
  ...Object.keys(MOTIVOS_EXPULSION).map((k) => sinAcceso(k)), sinAcceso('acoso', 'Varias personas nos han avisado.'),
  SIN_ACEPTAR,
  'Ese mensaje no se puede enviar: no se permiten insultos, amenazas ni contenido ofensivo. Cámbialo y vuelve a enviarlo.',
  'Ese anuncio no se puede enviar: quita los insultos o el contenido ofensivo del texto.',
  'Vuelves a tener acceso al mercadillo. Los anuncios que se retiraron no vuelven solos: si todavía vendes algo, publícalo otra vez. Y recuerda cumplir las normas.',
]
test('Mercadillo · lo que contesta el servidor (sin acceso, normas y filtro de palabras) se lee tal cual también en el iPhone', () => {
  const neutros = DEL_SERVIDOR.filter((m) => hablaDePagos(m))
  expect(neutros, `en el iPhone se cambiarían por el texto neutro: ${neutros.join(' | ')}`).toEqual([])
  const faltas = DEL_SERVIDOR.flatMap((m) => prohibidas(m, 'es', 'basico'))
  expect(faltas, `dicen algo prohibido en el iPhone: ${faltas.join(' | ')}`).toEqual([])
})

/* ── El panel de Dani (Negocio → Mercadillo): quitar a una persona del mercadillo y devolverle el acceso ─────────────────────
   Solo el super-admin, y solo en la web (dentro de la app de iPhone Negocio no existe). Aquí sí sale la clave de cada persona:
   es con lo que se le quita el acceso. A quien modera (`fds`) no se le ofrece. */
const LUIS = { clave: 'd:org1:d7', nombre: 'Luis G.' }
const MARTA = { clave: 'o:org9', nombre: 'Marta R.' }
const PEDRO = { clave: 'a:org2:u3', nombre: 'Pedro S.' }
const YA_SIN_ACCESO = { ...PEDRO, ts: '2026-11-09T08:15:00+00:00', motivo_clave: 'estafa', motivo: MOTIVOS_EXPULSION.estafa, nota: 'Pedía Bizum por adelantado.' }
const delAdmin = (id, persona, titulo, estado = 'publicado') => ({ ...SOPORTE, id, titulo, estado, caduca: '2026-12-08T10:00:00+00:00', interesados: 1,
  vendedor: { nombre: persona.nombre, tipo: persona.tipo || 'conductor', clave: persona.clave, org_id: 'org1' } })
const LO_QUE_PASA = 'No podrá entrar al mercadillo. Sus anuncios se retiran y sus conversaciones se cierran. Se le dice el motivo y cómo reclamar. Puedes devolverle el acceso cuando quieras.'
const QUITAR = { name: 'Quitar del mercadillo', exact: true }

/* Las claves de verdad son largas y sin espacios: `d:<empresa>:<conductor>`, con dos identificadores de 32 letras. */
const claveLarga = (clave) => clave.split(':').map((parte, n) => (n ? `${parte}9f3c1a7e5b2d4c6f8a0b1c2d3e4f5a6b`.slice(0, 32) : parte)).join(':')

/** Negocio → Mercadillo con memoria: a quién se le quita el acceso sale después en `expulsados`. `antiguo`: un servidor de antes
 *  de todo esto (sin `expulsados`, sin `motivos_expulsion`, sin `personas` en las denuncias y sin `totales.expulsados`).
 *  `clavesLargas`: cada clave, con el largo que tienen las de verdad. `s.lecturas`: cuántas veces se ha leído el panel. */
async function negocio(page, { errorExpulsar = null, errorReadmitir = null, antiguo = false, clavesLargas = false } = {}) {
  const s = { expulsados: [YA_SIN_ACCESO], llamadas: [], cuerpos: [], lecturas: 0 }
  const conSusClaves = (j) => (clavesLargas ? JSON.parse(JSON.stringify(j).replace(/"([doa]:org\d[^"]*)"/g, (_, clave) => JSON.stringify(claveLarga(clave)))) : j)
  const personas = (lista) => (antiguo ? {} : { personas: lista })
  const datos = () => ({
    conf: { visible: true }, avisos: { activo: false, movil: false }, motivos_rechazo: { otro: 'No cumple las normas del mercadillo.' },
    motivos_denuncia: LISTAS.motivos_denuncia, categorias: LISTAS.categorias, estados_articulo: LISTAS.estados_articulo,
    por_revisar: [delAdmin('p1', LUIS, 'Escáner de la nave', 'pendiente')],
    publicados: [delAdmin('a1', { clave: 'fds', nombre: 'Dani · FDS', tipo: 'fds' }, 'iPhone 18 Pro · 256 GB'), delAdmin('a3', MARTA, 'Carretilla plegable')],
    denuncias: [
      { id: 'n1', objetivo: { tipo: 'anuncio', id: 'a3', titulo: 'Carretilla plegable' }, motivo: 'estafa', de_nombre: 'Ana P.', ts: '2026-11-10T08:00:00+00:00',
        texto: 'Pide el dinero antes de quedar', ...personas([{ ...MARTA, papel: 'vendedor' }]) },
      { id: 'n2', objetivo: { tipo: 'conversacion', id: 'c9', titulo: 'Gorra de invierno' }, motivo: 'ofensivo', de_nombre: 'Ana P.', ts: '2026-11-10T08:30:00+00:00', texto: '',
        mensajes: [{ de: 'Luis G.', texto: 'Te vas a enterar', ts: '2026-11-10T08:20:00+00:00' }],
        ...personas([{ clave: 'o:org5', nombre: 'Ana P.', papel: 'vendedor' }, { ...LUIS, papel: 'comprador' }]) },
    ],
    bloqueos: [
      { id: '00b10c0e00000003', de_nombre: 'Marta R.', a_nombre: 'Luis G.', a_clave: LUIS.clave, ts: '2026-11-10T09:30:00+00:00', origen: { tipo: 'conversacion', titulo: 'Gorra de invierno' } },
      { id: '00b10c0e00000002', de_nombre: 'Ana P.', a_nombre: 'Luis G.', a_clave: LUIS.clave, ts: '2026-11-09T18:05:00+00:00', origen: { tipo: 'anuncio', titulo: 'Escáner de la nave' } },
      { id: '00b10c0e00000001', de_nombre: 'Ana P.', a_nombre: 'Pedro S.', a_clave: PEDRO.clave, ts: '2026-11-08T09:00:00+00:00', origen: { tipo: 'anuncio', titulo: 'Batería externa' } },
    ],
    bloqueados_varios: [{ clave: LUIS.clave, nombre: 'Luis G.', n: 2 }],
    ...(antiguo ? {} : { expulsados: s.expulsados, motivos_expulsion: MOTIVOS_EXPULSION }),
    totales: { por_revisar: 1, publicados: 2, denuncias: 2, conversaciones: 3, vendidos: 0, bloqueos: 3, ...(antiguo ? {} : { expulsados: s.expulsados.length }) },
  })
  await entrarComoAdmin(page, { superAdmin: true })
  await simularApi(page, 'vacio')
  await arrancar(page, { ios: false })
  await page.route(/\/api\/mercadillo\/foto\//, (x) => x.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await page.route(/\/api\/admin\/mercadillo$/, (x) => { s.lecturas += 1; return x.fulfill({ json: conSusClaves(datos()) }) })
  await page.route(/\/api\/admin\/mercadillo\/(?:expulsar|readmitir)$/, (x) => {
    const que = x.request().url().split('/').pop()
    const cuerpo = x.request().postDataJSON()
    s.llamadas.push(que); s.cuerpos.push(cuerpo)
    const error = que === 'expulsar' ? errorExpulsar : errorReadmitir
    // Sin `detail`: un error que no es del mercadillo (el servidor caído), que no trae texto que enseñar.
    if (error) return x.fulfill({ status: error.status, json: error.detail ? { detail: error.detail } : {} })
    if (que === 'readmitir') {
      s.expulsados = s.expulsados.filter((e) => e.clave !== cuerpo.clave)
      return x.fulfill({ json: { ok: true } })
    }
    const p = [LUIS, MARTA].find((y) => y.clave === cuerpo.clave)
    const nuevo = { clave: p.clave, nombre: p.nombre, ts: '2026-11-10T09:45:00+00:00', motivo_clave: cuerpo.motivo, motivo: MOTIVOS_EXPULSION[cuerpo.motivo], nota: cuerpo.nota || '' }
    s.expulsados = [nuevo, ...s.expulsados]
    return x.fulfill({ json: { ok: true, expulsado: nuevo, anuncios: 2, conversaciones: 1 } })
  })
  await page.goto('/panel/admin?s=mercadillo', { waitUntil: 'domcontentloaded' })
  const seccion = page.getByRole('region', { name: 'Mercadillo de repartidores' })
  await expect(seccion.getByText('Visible: lo ven todos los repartidores', { exact: false })).toBeVisible()
  return { s, seccion }
}
const casilla = (seccion, nombre) => seccion.locator('div.grid > div').filter({ hasText: nombre })
const sinAccesoEn = (seccion) => seccion.getByRole('group', { name: 'Sin acceso al mercadillo' })

test.describe('Negocio · quitar a una persona del mercadillo y devolverle el acceso', () => {
  test('«Quitar del mercadillo» junto a cada persona; con su motivo lo manda, y desde entonces dice «Sin acceso desde el…»', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const { s, seccion } = await negocio(page)
    await seccion.getByText('Publicados (2)').click()                 // los publicados van plegados

    // Junto a cada persona con clave: quien vende (por revisar y publicados), las personas de cada denuncia y a quien han bloqueado.
    const porRevisar = seccion.getByRole('listitem').filter({ hasText: 'Escáner de la nave · ' })
    const publicado = seccion.getByRole('listitem').filter({ hasText: 'Carretilla plegable · ' })
    const deDani = seccion.getByRole('listitem').filter({ hasText: 'iPhone 18 Pro · 256 GB · ' })
    // (con mayúscula y su motivo: «desde la conversación sobre «Gorra de invierno»» es también una fila de los bloqueos)
    const denunciaAnuncio = seccion.getByRole('listitem').filter({ hasText: /Anuncio «Carretilla plegable» · Es un engaño/ })
    const denunciaConversacion = seccion.getByRole('listitem').filter({ hasText: /Conversación sobre «Gorra de invierno» · Es ofensivo o es acoso/ })
    const bloqueos = seccion.getByRole('group', { name: 'Bloqueos' })
    const variosLuis = bloqueos.getByRole('listitem').filter({ hasText: 'Bloqueado por 2 personas: Luis G.' })
    const bloqueosLuis = bloqueos.getByRole('listitem').filter({ hasText: 'bloqueó a Luis G.' })
    const bloqueoPedro = bloqueos.getByRole('listitem').filter({ hasText: 'bloqueó a Pedro S.' })
    await expect(porRevisar.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(publicado.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(denunciaAnuncio.getByText('Vende: Marta R.')).toBeVisible()
    await expect(denunciaAnuncio.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(denunciaConversacion.getByText('Vende: Ana P.')).toBeVisible()
    await expect(denunciaConversacion.getByText('Compra: Luis G.')).toBeVisible()
    await expect(denunciaConversacion.getByRole('button', QUITAR), 'en una conversación, las dos personas').toHaveCount(2)
    await expect(variosLuis.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(bloqueosLuis).toHaveCount(2)
    await expect(bloqueosLuis.getByRole('button', QUITAR)).toHaveCount(2)
    // A quien modera no se le ofrece; y quien ya no tiene acceso lo dice en lugar del botón.
    await expect(deDani).toHaveCount(1)
    await expect(deDani.getByRole('button', QUITAR), 'a quien modera no se le quita el mercadillo').toHaveCount(0)
    await expect(bloqueoPedro.getByText('Sin acceso desde el 09/11/2026', { exact: true })).toBeVisible()
    await expect(bloqueoPedro.getByRole('button', QUITAR)).toHaveCount(0)
    // Lo de siempre sigue en su sitio: aprobar, rechazar, retirar y resolver denuncias.
    await expect(porRevisar.getByRole('button', { name: 'Aprobar' })).toBeEnabled()
    await expect(porRevisar.getByRole('button', { name: 'Rechazar' })).toBeDisabled()
    await expect(publicado.getByRole('button', { name: 'Retirar', exact: true })).toBeDisabled()
    await expect(denunciaConversacion.getByRole('button', { name: 'Cerrar la conversación' })).toBeEnabled()
    await expect(denunciaAnuncio.getByRole('button', { name: 'No incumple' })).toBeEnabled()

    // La hoja: a quién (con su clave), qué pasa, el motivo (obligatorio) y la nota. «Cancelar» no manda nada.
    await porRevisar.getByRole('button', QUITAR).click()
    const hoja = page.getByRole('dialog', { name: 'Quitar del mercadillo a Luis G.' })
    await expect(hoja).toBeVisible()
    await expect(hoja).toHaveAttribute('aria-modal', 'true')
    await expect(hoja.getByText(LUIS.clave, { exact: true })).toBeVisible()
    await expect(hoja.getByText(LO_QUE_PASA, { exact: true })).toBeVisible()
    const motivo = hoja.getByLabel('Por qué se le quita')
    await expect(motivo.locator('option')).toHaveText(['Motivo (se le dice a esa persona)…', ...Object.values(MOTIVOS_EXPULSION)])
    const quitar = hoja.getByRole('button', { name: 'Quitar el acceso', exact: true })
    await expect(quitar, 'sin motivo no se quita').toBeDisabled()
    await hoja.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(hoja).toHaveCount(0)
    expect(s.llamadas, '«Cancelar» no quita nada').toEqual([])

    await porRevisar.getByRole('button', QUITAR).click()
    await expect(quitar, 'la hoja se abre limpia cada vez').toBeDisabled()
    await motivo.selectOption('acoso')
    await hoja.getByLabel('Algo más que decirle').fill('  Insultos en dos conversaciones.  ')
    await quitar.click()
    await expect(seccion.getByRole('status')).toHaveText('Luis G. ya no tiene acceso al mercadillo: 2 anuncios retirados y 1 conversación cerrada.')
    expect(s.llamadas).toEqual(['expulsar'])
    expect(s.cuerpos[0], 'se quita a una persona: su clave, el motivo y la nota').toEqual({ clave: 'd:org1:d7', motivo: 'acoso', nota: 'Insultos en dos conversaciones.' })
    await expect(hoja).toHaveCount(0)

    // Desde entonces, donde salía «Quitar del mercadillo» junto a Luis dice desde cuándo no tiene acceso. Los demás, igual.
    for (const [fila, n] of [[porRevisar, 1], [denunciaConversacion, 1], [variosLuis, 1], [bloqueosLuis, 2]]) {
      await expect(fila.getByText('Sin acceso desde el 10/11/2026', { exact: true })).toHaveCount(n)
    }
    await expect(porRevisar.getByRole('button', QUITAR)).toHaveCount(0)
    await expect(bloqueos.getByRole('button', QUITAR)).toHaveCount(0)
    await expect(denunciaConversacion.getByRole('button', QUITAR), 'a la otra persona de la conversación se le sigue pudiendo quitar').toHaveCount(1)
    await expect(publicado.getByRole('button', QUITAR)).toHaveCount(1)
    // Y está en «Sin acceso al mercadillo», el primero, con su clave, cuándo, el motivo que se le dijo y la nota.
    const filas = sinAccesoEn(seccion).getByRole('listitem')
    await expect(filas).toHaveCount(2)
    await expect(filas.nth(0)).toContainText('Luis G. (d:org1:d7)')
    await expect(filas.nth(0)).toContainText(/10\/11\/2026 \d\d:45 · Has acosado o molestado a otra persona\./)
    await expect(filas.nth(0)).toContainText('Nota: Insultos en dos conversaciones.')
    await expect(filas.nth(0).getByRole('button', { name: 'Devolver el acceso' })).toBeVisible()
    await expect(filas.nth(1)).toContainText('Pedro S. (a:org2:u3)')
    await expect(casilla(seccion, 'Sin acceso')).toContainText('2')
    await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  /* Con el teclado (10-11-2026), como la confirmación de bloquear: al abrirse el foco entra en la hoja (a «Cancelar»), Escape la
     cierra y el foco vuelve al «Quitar del mercadillo» que la abrió. */
  test('la hoja con el teclado: el foco va a «Cancelar», Escape la cierra sin quitar nada y el foco vuelve a «Quitar del mercadillo»', async ({ page }) => {
    test.skip(test.info().project.name !== 'escritorio', 'el teclado es del ordenador')
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const { s, seccion } = await negocio(page)
    const abrir = seccion.getByRole('listitem').filter({ hasText: 'Escáner de la nave · ' }).getByRole('button', QUITAR)
    const hoja = page.getByRole('dialog', { name: 'Quitar del mercadillo a Luis G.' })
    await abrir.focus()
    await page.keyboard.press('Enter')
    await expect(hoja).toBeVisible()
    await expect(hoja.getByRole('button', { name: 'Cancelar', exact: true }), 'al abrirse, el foco está dentro: en «Cancelar»').toBeFocused()
    await hoja.getByLabel('Por qué se le quita').selectOption('otro')
    await page.keyboard.press('Escape')
    await expect(hoja, 'Escape la cierra').toHaveCount(0)
    await expect(abrir, 'al cerrarse, el foco vuelve al botón que la abrió').toBeFocused()
    expect(s.llamadas, 'Escape no quita nada').toEqual([])
    // Y se abre limpia otra vez, con el foco dentro.
    await page.keyboard.press('Enter')
    await expect(hoja.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
    await expect(hoja.getByRole('button', { name: 'Quitar el acceso', exact: true })).toBeDisabled()
    expect(fallos).toEqual([])
  })

  test('lo que conteste el servidor al quitar el acceso se lee tal cual en la hoja, que no se cierra', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const NO_HA_USADO = 'Esa persona no ha usado el mercadillo'
    const { s, seccion } = await negocio(page, { errorExpulsar: { status: 404, detail: NO_HA_USADO } })
    await seccion.getByRole('listitem').filter({ hasText: 'Bloqueado por 2 personas: Luis G.' }).getByRole('button', QUITAR).click()
    const hoja = page.getByRole('dialog', { name: 'Quitar del mercadillo a Luis G.' })
    await hoja.getByLabel('Por qué se le quita').selectOption('otro')
    await hoja.getByRole('button', { name: 'Quitar el acceso', exact: true }).click()
    await expect(hoja.getByRole('alert')).toHaveText(NO_HA_USADO)
    expect(s.cuerpos[0], 'sin nota, la nota va vacía').toEqual({ clave: 'd:org1:d7', motivo: 'otro', nota: '' })
    await expect(hoja.getByRole('button', { name: 'Quitar el acceso', exact: true }), 'se puede volver a intentar').toBeEnabled()
    await expect(seccion.getByRole('status')).toHaveCount(0)
    await expect(sinAccesoEn(seccion).getByRole('listitem')).toHaveCount(1)
    expect(fallos).toEqual([])
  })

  test('«Sin acceso al mercadillo»: a quién, cuándo y por qué; «Devolver el acceso» pregunta, lo manda y le quita de la lista', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const { s, seccion } = await negocio(page)
    const fila = sinAccesoEn(seccion).getByRole('listitem').filter({ hasText: 'Pedro S.' })
    await expect(fila).toContainText('Pedro S. (a:org2:u3)')
    await expect(fila).toContainText(/09\/11\/2026 \d\d:15 · Hemos visto un engaño o un intento de estafa\./)
    await expect(fila).toContainText('Nota: Pedía Bizum por adelantado.')
    await expect(casilla(seccion, 'Sin acceso')).toContainText('1')

    // Antes pregunta (se le avisa, y sus anuncios no vuelven solos). Decir que no, no manda nada.
    const preguntas = []
    let si = false
    page.on('dialog', (d) => { preguntas.push(d.message()); return si ? d.accept() : d.dismiss() })
    await fila.getByRole('button', { name: 'Devolver el acceso' }).click()
    await expect.poll(() => preguntas.length).toBe(1)
    expect(preguntas[0]).toBe('¿Devolver el acceso al mercadillo a Pedro S.? Se le avisa. Sus anuncios no vuelven solos: tendrá que enviarlos otra vez.')
    await expect(fila).toHaveCount(1)
    expect(s.llamadas, 'decir que no, no devuelve nada').toEqual([])

    si = true
    await fila.getByRole('button', { name: 'Devolver el acceso' }).click()
    await expect(sinAccesoEn(seccion).getByText('Nadie ha perdido el acceso.')).toBeVisible()
    expect(s.llamadas).toEqual(['readmitir'])
    expect(s.cuerpos[0], 'se le devuelve a una persona: su clave').toEqual({ clave: 'a:org2:u3' })
    await expect(fila).toHaveCount(0)
    await expect(casilla(seccion, 'Sin acceso')).toContainText('0')
    // Y donde decía «Sin acceso desde el…» vuelve a ofrecer «Quitar del mercadillo».
    const bloqueoPedro = seccion.getByRole('listitem').filter({ hasText: 'bloqueó a Pedro S.' })
    await expect(bloqueoPedro.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(bloqueoPedro.getByText(/Sin acceso/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  /* «ESA PERSONA YA TIENE ACCESO» (404; 10-11-2026, cuarta tanda). Pasa cuando el panel va atrasado: se le devolvió desde otra
     pestaña, o sus datos se han borrado. Antes se leía el aviso y la fila se quedaba ahí, con su «Devolver el acceso» que ya no
     podía hacer nada. Ahora se lee el aviso Y se vuelve a leer el panel: la fila que sobraba desaparece. */
  test('si al devolver el acceso el servidor dice que esa persona ya lo tiene (404), se lee el aviso y el panel se recarga: la fila desaparece', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const YA_TIENE = 'Esa persona ya tiene acceso al mercadillo'
    const { s, seccion } = await negocio(page, { errorReadmitir: { status: 404, detail: YA_TIENE } })
    const fila = sinAccesoEn(seccion).getByRole('listitem')
    await expect(fila).toHaveCount(1)
    await expect(fila).toContainText('Pedro S. (a:org2:u3)')
    s.expulsados = []                                                 // en el servidor ya no está sin acceso: el panel va atrasado
    const leidas = s.lecturas
    page.on('dialog', (d) => d.accept())
    await fila.getByRole('button', { name: 'Devolver el acceso' }).click()
    await expect(seccion.getByRole('alert')).toHaveText(YA_TIENE)
    expect(s.llamadas).toEqual(['readmitir'])
    await expect(fila, 'la fila que sobraba desaparece').toHaveCount(0)
    await expect(sinAccesoEn(seccion).getByText('Nadie ha perdido el acceso.')).toBeVisible()
    await expect(casilla(seccion, 'Sin acceso')).toContainText('0')
    expect(s.lecturas, 'el panel se ha leído otra vez').toBe(leidas + 1)
    await expect(seccion.getByRole('alert'), 'y el aviso sigue a la vista después de recargar').toHaveText(YA_TIENE)
    // Donde decía «Sin acceso desde el…» vuelve a ofrecer «Quitar del mercadillo».
    const bloqueoPedro = seccion.getByRole('listitem').filter({ hasText: 'bloqueó a Pedro S.' })
    await expect(bloqueoPedro.getByRole('button', QUITAR)).toHaveCount(1)
    await expect(bloqueoPedro.getByText(/Sin acceso/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  // El control: otro error (el servidor caído) no dice que esa persona tenga acceso. Se lee, y la fila sigue ahí para reintentar.
  test('control · con otro error al devolver el acceso (un 500), se lee el aviso, la persona sigue en la lista y el panel no se recarga', async ({ page }) => {
    test.setTimeout(60000)
    const { s, seccion } = await negocio(page, { errorReadmitir: { status: 500 } })
    const leidas = s.lecturas
    page.on('dialog', (d) => d.accept())
    await sinAccesoEn(seccion).getByRole('button', { name: 'Devolver el acceso' }).click()
    await expect(seccion.getByRole('alert')).toHaveText('No se pudo hacer')
    expect(s.llamadas).toEqual(['readmitir'])
    await expect(sinAccesoEn(seccion).getByRole('button', { name: 'Devolver el acceso' }), 'se puede reintentar').toBeEnabled()
    await expect(sinAccesoEn(seccion).getByRole('listitem')).toHaveCount(1)
    await quieta(page, 400)
    expect(s.lecturas, 'el panel no se vuelve a leer').toBe(leidas)
  })

  /* LAS CLAVES LARGAS NO SE SALEN DE LADO EN UN MÓVIL (10-11-2026, cuarta tanda). La clave de una persona es
     `d:<empresa>:<conductor>`: dos identificadores largos, sin un espacio por donde partirla. En un móvil se salía de su fila (y de
     la hoja «Quitar del mercadillo») por la derecha. Ahora se parte por donde haga falta, en los tres sitios donde Negocio la
     pinta: la hoja, «Sin acceso al mercadillo» y los bloqueos. */
  test.describe('en un móvil (375 px de ancho)', () => {
    test.use({ viewport: { width: 375, height: 740 } })
    test('las claves largas no se salen de lado: ni en la hoja «Quitar del mercadillo», ni en «Sin acceso al mercadillo», ni en los bloqueos', async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      const { seccion } = await negocio(page, { clavesLargas: true })
      const LARGA = claveLarga(LUIS.clave)
      expect(LARGA.length, 'la prueba: una clave del largo de las de verdad').toBeGreaterThan(60)
      /** Las cajas a las que se les sale algo por la derecha (lo que se sale, ensancha lo que su caja puede desplazar). */
      const seSalen = (cajas) => cajas.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim().slice(0, 70)))
      const bloqueos = seccion.getByRole('group', { name: 'Bloqueos' })
      await expect(bloqueos.getByRole('listitem').filter({ hasText: `Bloqueado por 2 personas: Luis G. (${LARGA})` })).toHaveCount(1)
      await expect(bloqueos.getByRole('listitem').filter({ hasText: `· ${LARGA}` })).toHaveCount(2)
      expect(await seSalen(bloqueos.getByRole('listitem')), 'en los bloqueos, una clave se sale de su fila').toEqual([])
      const filas = sinAccesoEn(seccion).getByRole('listitem')
      await expect(filas).toContainText(`Pedro S. (${claveLarga(PEDRO.clave)})`)
      expect(await seSalen(filas), 'en «Sin acceso al mercadillo», una clave se sale de su fila').toEqual([])
      // La hoja, con la clave entera dentro.
      await seccion.getByRole('listitem').filter({ hasText: 'Escáner de la nave · ' }).getByRole('button', QUITAR).click()
      const hoja = page.getByRole('dialog', { name: 'Quitar del mercadillo a Luis G.' })
      await expect(hoja.getByText(LARGA, { exact: true })).toBeVisible()
      expect(await seSalen(hoja.locator(':scope > div')), 'en la hoja «Quitar del mercadillo», la clave se sale').toEqual([])
      // Y la página no se puede desplazar de lado.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'la página no se desplaza de lado').toBeLessThanOrEqual(0)
      expect(fallos).toEqual([])
    })
  })

  test('con un servidor de antes (sin expulsados, sin motivos y sin personas en las denuncias): «Nadie ha perdido el acceso» y nada se rompe', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    const { seccion } = await negocio(page, { antiguo: true })
    await expect(sinAccesoEn(seccion).getByText('Nadie ha perdido el acceso.')).toBeVisible()
    await expect(sinAccesoEn(seccion).getByRole('listitem')).toHaveCount(0)
    await expect(casilla(seccion, 'Sin acceso')).toContainText('0')
    await expect(seccion.getByText(/^(?:Vende|Compra): /)).toHaveCount(0)
    await expect(seccion.getByText(/Sin acceso desde/)).toHaveCount(0)
    await expect(seccion.getByRole('button', { name: 'Cerrar la conversación' })).toBeEnabled()
    await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })
})
