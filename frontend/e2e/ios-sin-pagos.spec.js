import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'
import { hablaDePagos, detalleSinPagos, TEXTO_NEUTRO } from '../src/lib/plataforma.js'

/* LA APP DE IPHONE NO MENCIONA NI VENDE NADA CON PAGOS (09-11-2026). Apple rechazó la 2.4.1 por la 2.1(b) («la app incluye
   referencias a suscripción pero los productos de compra dentro de la app no se han enviado») y por la 3.1.1 («usa códigos
   promocionales para desbloquear la suscripción»). En el iPhone la app es gratuita para quien reparte y nada la limita ni la
   vende: ni suscripción, ni plan, ni prueba con días, ni precios, ni «gratis hasta…», ni tope de paradas, ni códigos de regalo,
   cupones, bonos o «Invita y gana», ni enlaces a pagar o a «Ver mi plan» (docs/APP_STORE.md, «Rechazo del 09-11-2026»).

   Esta prueba SIMULA la app (window.Capacitor con getPlatform() 'ios' y el agente «FDSApp», como app-iphone-zona.spec.js),
   recorre con la API simulada las pantallas y los estados por los que pasa quien reparte (cuenta nueva en prueba, plan activo,
   prueba terminada, regalo, suspendida, promoción, con bono y referidos, el error del tope al añadir paradas, el portal del
   conductor, el registro, la entrada, el panel y los textos legales) y en CADA una (y en cada hoja o diálogo abierto) comprueba
   que el texto visible —con los nombres accesibles, los marcadores y los títulos— no casa con ninguna expresión prohibida en
   los seis idiomas. Y la misma ruta SIN simular el iPhone (el control) sigue enseñando esas cosas donde hoy las enseña: así la
   prueba mide de verdad y nada cambia fuera del iPhone. */

const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const dentroDe = (n) => new Date(Date.now() + n * 864e5).toISOString()
const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FDSApp/2.4.1 (iOS)'
const FOTO = 'e2e/fixtures/ticket.png'

/* ── Lo prohibido, por idioma ─────────────────────────────────────────────────────────────────────────────────────────────
   COMUN va siempre. BASICO es el vocabulario de suscripciones, planes, pruebas, promociones, regalos, bonos e invitaciones de
   cada idioma; el de la pantalla se suma y, en las que no están en español, también el español (si algo se queda sin traducir
   y habla de planes, también cuenta). ESTRICTO es para la app de reparto, el alta y la entrada: además, precios, «gratis» y los
   verbos de pagar y comprar. En los textos legales y en el mercadillo (los anuncios llevan el precio del objeto y el consejo
   «no pagues por adelantado») solo vale lo básico. \p{L} y no \b: en JS el \b no entiende las tildes. */
const SOLO = (p) => new RegExp(`(?<![\\p{L}\\d])(?:${p})(?![\\p{L}\\d])`, 'iu')
const COMUN = [
  ['marca de pago', /stripe|lemon\s*squeezy|google play billing/i],
  ['premium o upgrade', SOLO('premium|upgrade')],
  ['precio por periodo', /\d\s*(?:€|eur|euros?|\$|£)\s*(?:\/|al|por|a|per|pro|par)\s*(?:mes|month|mois|mese|monat|mês|año|year|an|anno|jahr|ano)(?![\p{L}])/iu],
  ['€/mes', /(?:€|\$|£)\s*\/\s*(?:mes|month|mois|mese|monat|mês|año|year|an|anno|jahr|ano)(?![\p{L}])/iu],
]
const BASICO = {
  es: [
    ['suscripción', /suscr/i],
    ['plan', SOLO('plan(?:es)?')],     // «plan Repartidor», «tu plan», «Ver mi plan» y «planes» (antes solo casaba «planes»)
    ['prueba gratuita o con días', /prueba gratis|prueba gratuita|d[ií]as? de prueba|periodo de prueba|prueba con (?:tarjeta|google)|prueba terminada|prueba ha terminado|prueba empieza/i],
    ['promoción', /promo(?:ci[oó]n(?:es)?|cional(?:es)?)?(?![\p{L}])/iu],
    ['cupón', /cup[oó]n/i],
    ['código de regalo o promocional', /c[oó]digos? (?:de )?(?:regalo|promocional)/i],
    ['regalo', /regal(?:o|a|ar|os|ado|ada)(?![\p{L}])/iu],
    ['bono', SOLO('bonos?')],
    ['invita y gana', /invita y gana|invitar y ganar|invitar a un compañero|por cada compañero|comparte y gana|te ha invitado/i],
    ['gana N €', /gan(?:a|as|ar)\s+(?:\d|€|\{)/i],
    ['gratis hasta', /gratis hasta|gratis y sin l[ií]mite|sin l[ií]mite hasta/i],
    ['tope de paradas', /paradas (?:nuevas )?al d[ií]a|paradas gratis|tope de paradas|sin tope|quitar el tope|el tope/i],
    ['cartera', SOLO('cartera')],
    ['premios', /premiaremos|incentivos? para/i],
  ],
  en: [
    ['subscription', /subscri/i],
    ['plan', SOLO('plans?')],
    ['trial', SOLO('trials?|free trial|trial days?|test days?')],
    ['promo', /promo(?:tion|tional)?(?![\p{L}])/iu],
    ['coupon', /coupon|voucher/i],
    ['gift', SOLO('gifts?|gifted')],
    ['bonus o reward', SOLO('bonus(?:es)?|rewards?|prizes?|incentives?')],
    ['invite and earn', /invite (?:and|&) earn|refer(?:ral| a)|invite (?:a|your) (?:colleague|co-?worker|friend)|per colleague|your wallet|my wallet|(?<![\p{L}])wallet(?![\p{L}])/iu],
    ['earn N €', /earn\s+(?:[€$£]|\d)/i],
    ['free until', /free (?:until|for (?:now|good))|unlimited/i],
    ['stops a day', /stops? (?:a|per) day|daily (?:stop )?(?:limit|cap)/i],
  ],
  pt: [
    ['assinatura', /assinatura|assinar/i],
    ['plano', SOLO('planos?')],
    ['teste', /teste gr[aá]t|dias de teste|per[ií]odo de teste|dias? gr[aá]t/i],
    ['promoção', /promo(?:ção|cional|ções)?(?![\p{L}])/iu],
    ['cupão', /cup[oã]o|cupom/i],
    ['presente', SOLO('presentes?')],
    ['bónus', /b[oó]nus|recompensa|pr[eé]mio/i],
    ['convida e ganha', /convid(?:a|e|ar) e ganh|por cada colega|carteira|ganh(?:a|e|ar|as)\s+(?:\d|€)/i],
    ['grátis até', /gr[aá]tis at[eé]|sem limite|ilimitad/i],
    ['paragens por dia', /(?:paragens|paradas) por dia|limite de paragens/i],
  ],
  fr: [
    ['abonnement', /abonn/i],
    ['forfait, offre o plan', SOLO('forfaits?|offres?|plans?')],
    ['essai', SOLO('essais?|essai gratuit')],
    ['promo', /promo(?:tion|tionnel(?:le)?s?)?(?![\p{L}])|code (?:cadeau|promo)/iu],
    ['cadeau', /cadeau/i],
    ['bonus', SOLO('bonus|primes?|récompenses?')],
    ['invite et gagne', /invite[rz]? (?:et|un) (?:gagne|coll[eè]gue)|parrain|portefeuille|cagnotte|gagne[rz]?\s+(?:\d|€)|par coll[eè]gue/i],
    ['arrêts par jour', /arrêts? par jour|sans limite|illimit/i],
  ],
  it: [
    ['abbonamento', /abbonament/i],
    ['piano', SOLO('piani|piano')],
    ['prova', /prova gratuita|prova gratis|giorni di prova|periodo di prova|prova terminata/i],
    ['promo', /promo(?:zione|zionale)?(?![\p{L}])|codice (?:regalo|promozionale)/iu],
    ['regalo', /regal/i],
    ['bonus', /bonus|premio|ricompensa/i],
    ['invita e guadagna', /invita e guadagna|invita (?:un|il tuo) collega|per ogni collega|portafoglio|guadagn(?:a|i|are)\s+(?:\d|€)/i],
    ['fermate al giorno', /fermate al giorno|senza limite|illimitat/i],
  ],
  de: [
    ['abo', /abonnement|(?<![\p{L}])abo(?![\p{L}])/iu],
    ['tarif o plan', SOLO('tarife?|tarifs?|pl[aä]ne|plan')],
    ['test', /testphase|testtage?|testzeit|probezeit|probetage?|probe(?:abo|zeitraum)|gratis-test/i],
    ['promo', /promo(?:tion|aktion)?(?![\p{L}])|gutschein|aktionscode/iu],
    ['geschenk', /geschenk/i],
    ['bonus', /bonus|prämie|belohnung/i],
    ['einladen und verdienen', /einladen und verdienen|kollegen einladen|pro kollege|guthaben|verdien(?:e|st|en)\s+(?:\d|€)/i],
    ['stopps pro tag', /stopps? pro tag|ohne limit|unbegrenzt/i],
  ],
}
const ESTRICTO = {
  es: [['precio', /precios?(?![\p{L}])/iu], ['pagar o comprar', SOLO('pagar|pagarlo|comprar|compra|comprarlo')], ['gratis', /gratis|gratuit/i]],
  en: [['price', /pric(?:e|es|ing)/i], ['pay o buy', SOLO('pay|buy|purchase')], ['free', SOLO('free')]],
  pt: [['preço', /pre[cç]o/i], ['pagar o comprar', SOLO('pagar|comprar|compra')], ['grátis', /gr[aá]tis|gratuit/i]],
  fr: [['prix', SOLO('prix|tarifs?')], ['payer o acheter', SOLO('payer|acheter|achat')], ['gratuit', /gratuit/i]],
  it: [['prezzo', /prezz/i], ['pagare o acquistare', SOLO('pagare|acquistare|acquisto|comprare')], ['gratis', /gratis|gratuit/i]],
  de: [['preis', /preis/i], ['bezahlen o kaufen', SOLO('bezahlen|kaufen|kauf')], ['kostenlos', /kostenlos|gratis/i]],
}

function prohibidas(texto, idioma, perfil) {
  const idiomas = idioma === 'es' ? ['es'] : ['es', idioma]
  const reglas = [...COMUN, ...idiomas.flatMap((i) => BASICO[i] || []), ...(perfil === 'estricto' ? idiomas.flatMap((i) => ESTRICTO[i] || []) : [])]
  const hallados = []
  for (const [nombre, re] of reglas) {
    const m = re.exec(texto)
    if (!m) continue
    const a = Math.max(0, m.index - 28)
    hallados.push(`${nombre}: «${texto.slice(a, m.index + m[0].length + 28).replace(/\s+/g, ' ').trim()}»`)
  }
  return hallados
}

/** Todo lo que lee quien usa la pantalla: su texto visible, los nombres accesibles, los marcadores, los títulos y las imágenes. */
async function lo(page) {
  return page.evaluate(() => {
    const partes = [document.body.innerText, document.title]
    for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) { const v = el.getAttribute(a); if (v) partes.push(v) }
    }
    return partes.join('\n')
  })
}

/** Que no salga nada prohibido en la pantalla que se ve ahora. Devuelve lo que se leía, por si hace falta algo más. */
async function limpia(page, donde, { idioma = 'es', perfil = 'estricto' } = {}) {
  const texto = await lo(page)
  expect(texto.replace(/\s/g, '').length, `${donde}: la pantalla está en blanco`).toBeGreaterThan(20)
  const faltas = prohibidas(texto, idioma, perfil)
  expect(faltas, `${donde}: se lee algo prohibido en el iPhone → ${faltas.join(' | ')}`).toEqual([])
  return texto
}

/** Las excepciones de JavaScript de la página (no el ruido de la consola): lo que se rompe por esconder cosas. */
function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

const quieta = (page, ms = 700) => page.waitForTimeout(ms)
/** Lo que prueba que la pantalla se pintó: un texto o, si es una función, el localizador que devuelve. */
const anclaDe = (page, a) => (typeof a === 'function' ? a(page) : page.getByText(a, { exact: false })).first()

/* ── La app y su API simulada ──────────────────────────────────────────────────────────────────────────────────────────── */
/** Lo que deja Capacitor dentro de la app: su puente nativo (window.webkit.messageHandlers.bridge) y el objeto global. Con el
 *  puente, @capacitor/core se inicia de verdad (isNativePlatform() y getPlatform() dicen «ios») y los plugins, como el de la barra
 *  de estado, cargan; con el objeto congelado de app-iphone-zona.spec.js el plugin fallaba al cargar y main.jsx recargaba la
 *  página (la auto-curación de vite:preloadError), que aquí estropeaba la prueba. `chunk_curacion` agotado: esa recarga no se
 *  hace nunca. `flags`: claves de localStorage a poner (o a quitar con null); va DESPUÉS de entrarComoAdmin, que pone el recorrido
 *  como visto. */
async function arrancar(page, { ios = true, flags = {} } = {}) {
  await page.addInitScript(({ ios, flags }) => {
    if (ios) {
      window.webkit = window.webkit || {}
      window.webkit.messageHandlers = { ...(window.webkit.messageHandlers || {}), bridge: { postMessage() {} } }
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', nativePromise: () => new Promise(() => {}), nativeCallback() {} }
    }
    try { sessionStorage.setItem('chunk_curacion', JSON.stringify({ t: Date.now(), n: 3 })) } catch { /* nada */ }
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_aviso_manana', 'no')
    localStorage.setItem('ruta_vista', 'lista')
    for (const [k, v] of Object.entries(flags)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) }
  }, { ios, flags })
}

const BILLING_BASE = {
  plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], pais: 'es',
  precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
}
/* Los estados de la cuenta que manda /org/billing (con los campos de verdad de server.py): lo que cambia lo que la web enseña. */
const ESTADOS = {
  prueba: { status: 'trial', days_left: 6, required: false, trial_ends: dentroDe(6), gratis: { activo: false, tope: 15, usadas: 0 } },
  prueba2: { status: 'trial', days_left: 2, required: false, trial_ends: dentroDe(2), gratis: { activo: false, tope: 15, usadas: 0 } },
  pruebaTarjeta: { status: 'trial', days_left: 7, required: false, falta_tarjeta: true, cobro_al_suscribir: dentroDe(7).slice(0, 10) },
  tope: { status: 'trial', days_left: 0, required: true, trial_ends: dentroDe(-1), bloqueo: '', gratis: { activo: true, tope: 15, usadas: 4 } },
  muro: { status: 'trial', days_left: 0, required: true, trial_ends: dentroDe(-1), bloqueo: 'Tu prueba gratis ha terminado. Suscríbete en «Cuenta» para seguir repartiendo.' },
  muroTarjeta: { status: 'trial', days_left: 7, required: false, falta_tarjeta: true, cobro_al_suscribir: dentroDe(7).slice(0, 10),
    bloqueo: 'Añade tu tarjeta para empezar los 7 días gratis (hoy no se cobra nada).' },
  suscrito: { status: 'active', suscrito: true, pago_proveedor: 'stripe', stripe_status: 'active', stripe_intervalo: 'anual', stripe_proximo_cobro: dentroDe(30) },
  suscritoPrueba: { status: 'active', suscrito: true, pago_proveedor: 'stripe', stripe_status: 'trialing', stripe_proximo_cobro: dentroDe(5) },
  cancelada: { status: 'active', suscrito: true, cancela_al_final: true, pago_proveedor: 'stripe', stripe_proximo_cobro: dentroDe(12) },
  regalo: { status: 'active', pago_proveedor: 'regalo', pagado_hasta: dentroDe(20) },
  regaloAcabado: { status: 'vencido', pagado_hasta: dentroDe(-2), bloqueo: 'Tu regalo ha terminado. Suscríbete en «Cuenta» para seguir repartiendo.' },
  suspendida: { status: 'suspended', pago_proveedor: 'stripe', stripe_status: 'past_due', required: true,
    bloqueo: 'Tu suscripción está pausada: hay un pago pendiente. Revísalo en «Cuenta».' },
  promo: { status: 'trial', days_left: 20, required: false, trial_ends: dentroDe(20), promo: { activa: true, hasta: '2026-12-31' }, gratis: { activo: false, tope: 15, usadas: 0 } },
}
const BONO = { cent: 2500, pagado: false, objetivo: 20, dias_objetivo: 2, entregas: 3, dias: 1, hasta: '2026-12-31' }
const REFERIDO = {
  codigo: 'ANA123', invitados: 4, premiados: 3, saldo: 4500, ganado: 4500, por_invitado: 1000, retirada_min: 6000, promo_hasta: '2026-12-31', promo_cent: 1000,
  entregas_cartera: 20, dias_distintos: 2, metodos: ['bizum', 'iban'], cartera: true, pendiente: false, retiradas: [],
  bono: BONO, regalo: 1000, regalo_clave: 'regalo-17-10',
}
const SIN_PREMIOS = { ...REFERIDO, bono: null, regalo: 0 }
const dos = (n) => String(n).padStart(2, '0')
const parada = (n, estado, extra = {}) => ({
  id: `p${n}`, codigo: `COD${n}`, cliente: `Cliente ${n}`, direccion: `Rúa Real ${n}`, estado, bultos: 1, orden: n, eta: `10:${dos(n)}`,
  lat: 43.36 + n / 1000, lng: -8.41, cobrar: 0, notas: '', telefono: '',
  ...(estado === 'entregado' ? { cerrado_en: `${HOY}T09:${dos(n)}:00Z` } : {}), ...extra })
const SIGUIENTE = (page) => page.getByRole('region', { name: 'Siguiente parada' })

/** La app de quien reparte solo (/ruta) con sesión y su API: el estado de la cuenta, el código de invitación, la ruta de hoy. */
async function appDelRepartidor(page, { ios = true, estado = 'prueba', billing = {}, referido = null, pedidos = [], ruta = {}, flags = {}, merc = null } = {}) {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await arrancar(page, { ios, flags })
  const cuenta = { ...BILLING_BASE, ...(typeof estado === 'string' ? ESTADOS[estado] : estado), ...billing }
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: cuenta }))
  await page.route(/\/api\/referidos$/, (r) => (referido
    ? r.fulfill({ json: referido })
    : r.fulfill({ status: 403, json: { detail: 'Los enlaces de invitación son de cada cuenta' } })))
  await page.route(/\/api\/billing\/regalos$/, (r) => r.fulfill({ json: { regalos: [{ id: 'g1', codigo: 'ABCDEFGH', meses: 1, estado: 'pagado' }] } }))
  await page.route(/\/api\/mercadillo\/estado/, (r) => r.fulfill({ json: merc || { visible: false } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, pais: 'es', prefijo: '34',
    ruta: pedidos.length ? { fin: '11:00', minutos: 45, km: 6, trafico: true } : null, pedidos, ...ruta } }))
}

const pestana = (page, nombre) => page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: nombre, exact: true })
const irACuenta = async (page) => { await page.goto('/ruta?tab=cuenta', { waitUntil: 'domcontentloaded' }) }
const irAHoy = async (page) => { await page.goto('/ruta', { waitUntil: 'domcontentloaded' }) }
const irAAjustes = async (page) => { await irAHoy(page); await pestana(page, 'Ajustes').click() }

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   1. LA APP DEL REPARTIDOR (/ruta): cada estado de la cuenta, en cada pestaña. En cada escenario: `montar` prepara la API, `ver`
   llega a la pantalla, `ancla` prueba que de verdad se pintó (en el iPhone) y `web` lo que la web SÍ enseña (el control: con el
   iPhone simulado no está; sin simularlo, sí). `anclaWeb`: lo que prueba que se pintó en la web, si es otra cosa (el muro).
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const VACIA = 'Carga tus paradas de hoy'
const CUENTA = 'Tu cuenta'
const ESCENARIOS = [
  // ── La pestaña «Cuenta» en cada estado ──
  { nombre: 'Cuenta · en prueba (días que quedan, suscribirse, regalar, código de regalo, invitar)', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO }), ver: irACuenta,
    web: [/Plan Repartidor/, /Prueba gratis/, /Quedan 6 días/, /Suscribirte/, /Regala FDS/, /¿Te han regalado la app\?/, /Canjear/, /Invita y gana/, /Tu saldo/] },
  { nombre: 'Cuenta · prueba terminada con el plan gratis y su tope', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'tope' }), ver: irACuenta,
    web: [/Plan gratis/, /Sigues gratis con hasta 15 paradas nuevas al día/, /¿Te han regalado la app\?/] },
  { nombre: 'Cuenta · prueba con tarjeta (hoy 0 €)', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'pruebaTarjeta' }), ver: irACuenta,
    web: [/Añade tu tarjeta para empezar los 7 días gratis/, /Añadir tarjeta: hoy 0 €/] },
  { nombre: 'Cuenta · suscrita con tarjeta (plan anual, gestionar, cancelar)', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'suscrito' }), ver: irACuenta,
    web: [/Suscrito/, /Plan anual/, /Tarjeta, facturas y cancelar/, /Pasar al plan mensual/] },
  { nombre: 'Cuenta · suscrita en prueba con tarjeta', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'suscritoPrueba' }), ver: irACuenta,
    web: [/Prueba con tarjeta/, /Si cancelas antes, no se cobra nada/] },
  { nombre: 'Cuenta · suscripción cancelada (la puedes usar hasta…)', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'cancelada' }), ver: irACuenta,
    web: [/Cancelada/, /no se volverá a cobrar/] },
  { nombre: 'Cuenta · con un regalo de suscripción en marcha', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'regalo' }), ver: irACuenta,
    web: [/Pagado hasta el/, /Sin cobros hasta entonces/] },
  { nombre: 'Cuenta · regalo terminado', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'regaloAcabado' }), ver: irACuenta,
    web: [/Regalo terminado/, /Tu regalo acabó el/] },
  { nombre: 'Cuenta · pago pendiente (suspendida)', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'suspendida' }), ver: irACuenta,
    web: [/Pausada/, /Hay un pago pendiente\. Revisa tu tarjeta\./, /Revisar mi tarjeta y pagar/] },
  { nombre: 'Cuenta · con la promoción «gratis y sin límite» y la cartera de invitaciones', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'promo', referido: REFERIDO }), ver: irACuenta,
    web: [/Gratis sin límite/, /no tienes tope de paradas ni pagas nada/, /Bono de bienvenida/, /Regalo: 10 € ya en tu saldo/, /Promoción hasta el 31 de diciembre/] },
  { nombre: 'Cuenta · cambiar correo, cambiar contraseña, borrar la cuenta y cerrar sesión', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO }), ver: irACuenta,
    despues: async (page, ios, donde) => {
      for (const [boton, cierra] of [['Cambiar correo', 'Cancelar'], ['Cambiar contraseña', 'Cancelar'], ['Borrar mi cuenta', 'Cancelar'], ['Cerrar sesión', 'Cancelar']]) {
        await page.getByRole('button', { name: boton, exact: true }).click()
        await quieta(page, 250)
        await limpia(page, `${donde} · «${boton}»`)
        await page.getByRole('button', { name: cierra, exact: true }).first().click()
      }
    } },
  { nombre: 'Cuenta · con el mercadillo abierto', ancla: CUENTA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', merc: { visible: true, sin_leer: 2 } }), ver: irACuenta },

  // ── «Hoy»: los avisos de la cuenta y la línea final ──
  { nombre: 'Hoy · un regalo de saldo en la cartera (aviso)', ancla: VACIA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO }), ver: irAHoy,
    web: [/\+10 € en tu cartera/, /Verlo/] },
  { nombre: 'Hoy · la prueba se acaba (aviso «Ver mi plan»)', ancla: VACIA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba2' }), ver: irAHoy,
    web: [/Quedan 2 días de prueba/, /Ver mi plan/] },
  { nombre: 'Hoy · plan gratis con tope de paradas (aviso «Quitar el tope»)', ancla: VACIA,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'tope' }), ver: irAHoy,
    web: [/Gratis: 15 paradas al día/, /Quitar el tope/] },
  { nombre: 'Hoy · con paradas: la línea «Invita y gana» al final de la lista', ancla: SIGUIENTE,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'promo', referido: SIN_PREMIOS, ruta: { puede_pegar: true },
      pedidos: [parada(1, 'pendiente'), parada(2, 'pendiente'), parada(3, 'pendiente')] }), ver: irAHoy,
    web: [/Gana 10 € por cada compañero que la use/, /Mi cartera/, /Promo hasta el 31 de diciembre/],
    despues: async (page, ios, donde) => {
      if (!ios) return
      await page.getByRole('button', { name: /Ver la parada \d+: Cliente 2/ }).click()
      await quieta(page, 300)
      await limpia(page, `${donde} · la hoja de una parada`)
      await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first().click()
      await page.getByRole('button', { name: 'Añadir paradas' }).click()
      await quieta(page, 300)
      await limpia(page, `${donde} · «Añadir paradas»`)
      await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'Lista u hoja' }).click()
      await quieta(page, 300)
      await limpia(page, `${donde} · pegar una lista`)
    } },
  { nombre: 'Hoy · el bono de bienvenida de la primera ruta real (y sus condiciones)', ancla: SIGUIENTE,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO, ruta: { bono: BONO },
      pedidos: [parada(1, 'pendiente'), parada(2, 'pendiente')] }), ver: irAHoy,
    web: [/25 € por tu primera ruta real/, /3\/20/, /Haz 20 entregas con la app en 2 días distintos/],
    despues: async (page, ios) => {
      if (ios) { await expect(page.getByTestId('bono')).toHaveCount(0); return }
      await page.getByTestId('bono').getByRole('button').first().click()
      await expect(page.getByRole('dialog')).toContainText('Haz 20 entregas')
    } },
  { nombre: 'Hoy · el bono ganado (celebración de tres días)', ancla: SIGUIENTE,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO, ruta: { bono: { ...BONO, pagado: true, nuevo: true, entregas: 20, dias: 2 } },
      pedidos: [parada(1, 'pendiente'), parada(2, 'pendiente')] }), ver: irAHoy,
    web: [/¡Has ganado 25 €!/, /Ya están en tu cartera/] },
  { nombre: 'Hoy · tras la primera entrega, la tarjeta de invitar a un compañero (y su hoja)', ancla: SIGUIENTE,
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: SIN_PREMIOS,
      pedidos: [parada(1, 'entregado'), parada(2, 'pendiente'), parada(3, 'pendiente')] }), ver: irAHoy,
    web: [/Gana 10 € por compañero/],
    despues: async (page, ios) => {
      if (ios) { await expect(page.getByTestId('invitar-entrega')).toHaveCount(0); return }
      await page.getByTestId('invitar-entrega').getByRole('button', { name: /Gana 10 € por compañero/ }).click()
      await expect(page.getByRole('dialog', { name: 'Invitar a un compañero' })).toContainText('Lo cobras cuando haga 20 entregas')
    } },
  { nombre: 'Hoy · el cierre del día (resumen, «Comparte tu día» e invitar a un compañero)', ancla: 'Ruta terminada',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: null,
      pedidos: [1, 2, 3, 4, 5].map((n) => parada(n, 'entregado')).concat([parada(6, 'fallido', { motivo: 'No había nadie' })]) }), ver: irAHoy,
    web: [/Invitar a un compañero/, /Comparte tu día/] },
  { nombre: 'Hoy · la bienvenida de la primera vez (con el bono que no sale) y el recorrido', ancla: 'Te damos la bienvenida a FDS',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO, ruta: { bono: BONO }, flags: { fds_tour_ruta: null } }), ver: irAHoy,
    web: [/Tu primera ruta real te da 25 €/],
    despues: async (page, ios, donde) => {
      const hoja = page.getByRole('dialog', { name: 'Te damos la bienvenida a FDS' })
      await hoja.getByRole('button', { name: 'Todavía no' }).click()
      await quieta(page, 300)
      if (ios) await limpia(page, `${donde} · «Todavía no»`)
      await hoja.getByRole('button', { name: 'Ver cómo funciona en 3 pasos' }).click()
      await quieta(page, 300)
      if (ios) await limpia(page, `${donde} · el recorrido, paso 1`)
    } },
  // Los muros (prueba terminada, falta la tarjeta, regalo acabado, pago pendiente): en el iPhone nada bloquea, así que «Hoy» sale normal.
  { nombre: 'Hoy · «tu prueba ha terminado»: en el iPhone no hay muro', ancla: VACIA, anclaWeb: 'Tu prueba ha terminado',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'muro' }), ver: irAHoy,
    web: [/Tu prueba ha terminado/, /Elige tu plan/, /Para seguir repartiendo con la app, activa tu suscripción/] },
  { nombre: 'Hoy · «añade tu tarjeta para los 7 días»: en el iPhone no hay muro', ancla: VACIA, anclaWeb: 'Empieza tus 7 días gratis',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'muroTarjeta' }), ver: irAHoy,
    web: [/Empieza tus 7 días gratis/, /Cancela antes y no pagas nada/] },
  { nombre: 'Hoy · «tu regalo ha terminado»: en el iPhone no hay muro', ancla: VACIA, anclaWeb: 'Tu regalo ha terminado',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'regaloAcabado' }), ver: irAHoy,
    web: [/Tu regalo ha terminado/] },
  { nombre: 'Hoy · «hay un pago pendiente»: en el iPhone no hay muro', ancla: VACIA, anclaWeb: 'Hay un pago pendiente',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'suspendida' }), ver: irAHoy,
    web: [/Hay un pago pendiente/, /Revisar mi tarjeta y pagar/] },
  { nombre: 'Ajustes · con el muro de la prueba terminada: en el iPhone, los ajustes de siempre', ancla: 'Desde dónde sales', anclaWeb: 'Tu prueba ha terminado',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'muro' }), ver: irAAjustes,
    web: [/Tu prueba ha terminado/] },

  // ── Ajustes e Historial, que no cambian con el plan (sin control: no hay nada que esconder) ──
  { nombre: 'Ajustes · la pantalla entera', ancla: 'Desde dónde sales',
    montar: (page, ios) => appDelRepartidor(page, { ios, estado: 'prueba' }), ver: irAAjustes },
  { nombre: 'Historial · la semana y un día', ancla: 'Últimos 30 días',
    montar: async (page, ios) => {
      await appDelRepartidor(page, { ios, estado: 'prueba' })
      await page.route(/\/api\/reparto\/estadisticas/, (r) => r.fulfill({ json: { total: 12, entregados: 10, tasa_entrega: 83,
        por_dia: [{ fecha: HOY, total: 12, entregados: 10, fallidos: 2 }] } }))
      await page.route(/\/api\/reparto\/pedidos/, (r) => r.fulfill({ json: { pedidos: [parada(1, 'entregado'), parada(2, 'fallido', { motivo: 'No había nadie' })], conductores: [] } }))
    },
    ver: async (page) => { await irAHoy(page); await pestana(page, 'Historial').click() },
    despues: async (page, ios, donde) => {
      await page.getByRole('button', { name: /entregados/ }).first().click()
      await expect(page.getByText('Prueba de entrega').or(page.getByText('Entregados', { exact: true })).first()).toBeVisible()
      await quieta(page, 400)
      if (ios) await limpia(page, `${donde} · el día`)
    } },
]

test.describe('iPhone · la app del repartidor no menciona ni vende nada con pagos', () => {
  test.use({ userAgent: UA_APP })
  for (const e of ESCENARIOS) {
    test(e.nombre, async ({ page }) => {
      const fallos = vigilar(page)
      let cuentas = 0
      page.on('response', (r) => { if (/\/api\/org\/billing/.test(r.url())) cuentas += 1 })
      await e.montar(page, true)
      await e.ver(page)
      await expect(anclaDe(page, e.ancla), `la pantalla «${e.nombre}» no se pintó`).toBeVisible()
      await quieta(page)
      expect(cuentas, 'la app no pidió el estado de la cuenta: este escenario no mediría nada').toBeGreaterThan(0)
      await limpia(page, e.nombre)
      if (e.despues) await e.despues(page, true, e.nombre)
      await limpia(page, `${e.nombre} (tras abrir lo que se abre)`)
      expect(fallos).toEqual([])
    })
  }
})

test.describe('control · la web (sin simular el iPhone) sigue enseñando lo que hoy enseña', () => {
  for (const e of ESCENARIOS.filter((x) => x.web)) {
    test(e.nombre, async ({ page }) => {
      await e.montar(page, false)
      await e.ver(page)
      await expect(anclaDe(page, e.anclaWeb || e.ancla)).toBeVisible()
      await quieta(page, 1200)
      const antes = await lo(page)
      if (e.despues) await e.despues(page, false, e.nombre)
      const texto = `${antes}
${await lo(page)}`
      for (const re of e.web) expect(texto, `la web ya no enseña ${re} en «${e.nombre}»`).toMatch(re)
    })
  }
})

/* ── El error del tope al añadir una parada ────────────────────────────────────────────────────────────────────────────── */
const MENSAJE_TOPE = 'Has llegado al tope de paradas gratis de hoy. Pasa a ilimitado en «Cuenta» o sigue mañana.'
const GEMINI_429 = 'Se ha agotado la cuota gratuita de Gemini por hoy (20 peticiones/día). No es un fallo de la app: hay que subir el plan de la API en Google AI Studio. Mientras tanto, el análisis de daños de las inspecciones tampoco funcionará.'
async function anadirParadaA(page, error) {
  await page.route(/\/api\/reparto\/mis-pedidos$/, (r) => r.fulfill({ status: error.status, json: { detail: error.detail } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Añadir paradas' }).click()
  await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'A mano', exact: true }).click()
  const ficha = page.getByRole('dialog', { name: 'Nueva parada' })
  await ficha.getByRole('textbox', { name: 'Dirección completa' }).fill('Rúa Real 5, A Coruña')
  await ficha.getByRole('button', { name: 'Añadir a mi ruta' }).click()
  await quieta(page, 900)
}
const ERRORES = [
  ['402 del servidor («Has llegado al tope de paradas gratis de hoy…»)', { status: 402, detail: MENSAJE_TOPE }, /tope de paradas gratis/],
  ['403 («Has llegado al tope de paradas del plan gratis»)', { status: 403, detail: 'Has llegado al tope de paradas del plan gratis.' }, /tope de paradas del plan gratis/],
  ['402 con la prueba terminada («Suscríbete en «Cuenta»…»)', { status: 402, detail: 'Tu prueba gratis ha terminado. Suscríbete en «Cuenta» para seguir repartiendo.' }, /Suscríbete/],
  ['403 de otra función («Tu plan X no incluye esta función»)', { status: 403, detail: 'Tu plan Reparto no incluye esta función. Actualiza tu suscripción en /planes.' }, /no incluye esta función/],
  // Frases REALES de backend/server.py que hablan del «plan» en singular o de la cuota (las que dejaba pasar la expresión vieja).
  ['400 de la opinión («La opinión es para el plan Repartidor»)', { status: 400, detail: 'La opinión es para el plan Repartidor' }, /La opinión es para el plan Repartidor/],
  ['400 de la invitación («La invitación es para el plan Repartidor»)', { status: 400, detail: 'La invitación es para el plan Repartidor' }, /La invitación es para el plan Repartidor/],
  ['400 de la cartera («La cartera es para el plan Repartidor»)', { status: 400, detail: 'La cartera es para el plan Repartidor' }, /La cartera es para el plan Repartidor/],
  ['400 «Plan no válido»', { status: 400, detail: 'Plan no válido' }, /Plan no válido/],
  ['400 «Ya estás en ese plan»', { status: 400, detail: 'Ya estás en ese plan' }, /Ya estás en ese plan/],
  ['429 de la cuota gratuita de Gemini', { status: 429, detail: GEMINI_429 }, /cuota gratuita de Gemini/],
]
test.describe('iPhone · los errores del servidor que hablan del plan salen neutros', () => {
  test.use({ userAgent: UA_APP })
  for (const [nombre, error] of ERRORES) {
    test(nombre, async ({ page }) => {
      const fallos = vigilar(page)
      await appDelRepartidor(page, { ios: true, estado: 'tope', pedidos: [parada(1, 'pendiente')] })
      await anadirParadaA(page, error)
      const texto = await limpia(page, `error · ${nombre}`)
      expect(texto, 'el aviso del error no salió').toMatch(/No se pudo guardar|No se ha podido completar/)
      expect(fallos).toEqual([])
    })
  }
})
test.describe('control · en la web el mismo error se enseña tal cual', () => {
  for (const [nombre, error, esperado] of ERRORES) {
    test(nombre, async ({ page }) => {
      await appDelRepartidor(page, { ios: false, estado: 'tope', pedidos: [parada(1, 'pendiente')] })
      await anadirParadaA(page, error)
      expect(await lo(page)).toMatch(esperado)
    })
  }
})

test.describe('iPhone · la dirección no canjea regalos ni cobra al volver de pagar', () => {
  test.use({ userAgent: UA_APP })
  test('?canjear=, ?regalo_propio=, ?regalo= y ?pago=ok no hacen nada y se limpian', async ({ page }) => {
    const fallos = vigilar(page)
    const llamadas = []
    await appDelRepartidor(page, { ios: true, estado: 'prueba' })
    await page.addInitScript(() => sessionStorage.setItem('regalo_pendiente', 'ABCD-EFGH'))
    for (const re of [/\/api\/billing\/regalos/, /\/api\/billing\/regalo\/canjear/, /\/api\/regalos/, /\/api\/billing\/stripe/]) {
      await page.route(re, (r) => { llamadas.push(r.request().url()); return r.fulfill({ json: {} }) })
    }
    for (const q of ['?canjear=ABCD-EFGH', '?regalo_propio=g1', '?regalo=g1', '?pago=ok']) {
      await page.goto(`/ruta${q}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(VACIA)).toBeVisible()
      await quieta(page)
      await limpia(page, `la dirección ${q}`)
      await expect(page).toHaveURL(/\/ruta$/)
    }
    expect(llamadas, 'la app habló con el cobro o con los regalos').toEqual([])
    expect(await page.evaluate(() => sessionStorage.getItem('regalo_pendiente'))).toBeNull()
    expect(fallos).toEqual([])
  })
})

/* ── «Comparte tu día»: el texto que sale al compartir ─────────────────────────────────────────────────────────────────── */
for (const [titulo, ios] of [['iPhone', true], ['control · web', false]]) {
  test.describe(`${titulo} · el texto de «Comparte tu día»`, () => {
    if (ios) test.use({ userAgent: UA_APP })
    test(`${ios ? 'sin' : 'con'} «pruébala gratis», ${ios ? 'sin' : 'con'} enlace de invitación`, async ({ page }) => {
      const pedidos = [1, 2, 3, 4, 5].map((n) => parada(n, 'entregado'))
      await appDelRepartidor(page, { ios, estado: 'prueba', referido: REFERIDO, pedidos })
      await page.addInitScript(() => {
        navigator.canShare = () => true
        navigator.share = async (d) => { window.__compartido = { text: d.text || '', ficheros: (d.files || []).length } }
      })
      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Comparte tu día' }).click()
      await expect.poll(() => page.evaluate(() => window.__compartido?.text || '')).not.toBe('')
      const { text, ficheros } = await page.evaluate(() => window.__compartido)
      expect(ficheros).toBe(1)
      expect(text).toContain('Hoy he hecho 5 paradas con FDS: la ruta se ordena sola.')
      if (ios) {
        const faltas = prohibidas(text, 'es', 'estricto')
        expect(faltas, `el texto que se comparte: ${text}`).toEqual([])
        expect(text).not.toMatch(/\/invita|ref=|ANA123|Pruébala/)
      } else {
        expect(text).toMatch(/Pruébala gratis/)
        expect(text).toMatch(/\/invita\?ref=ANA123/)
      }
    })
  })
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   2. LOS SEIS IDIOMAS: la cuenta, «Hoy», el alta y la entrada, con el móvil en cada uno de ellos
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const IDIOMAS = [['en', 'en-GB'], ['pt', 'pt-PT'], ['pt', 'pt-BR'], ['fr', 'fr-FR'], ['it', 'it-IT'], ['de', 'de-DE']]
for (const [idioma, locale] of IDIOMAS) {
  test.describe(`iPhone · con el móvil en ${locale}`, () => {
    test.use({ userAgent: UA_APP, locale })
    const opc = { idioma }

    test('la cuenta: con la prueba que acaba, suscrita y con un regalo', async ({ page }) => {
      const fallos = vigilar(page)
      for (const estado of ['prueba2', 'suscrito', 'regalo', 'suspendida', 'promo']) {
        await appDelRepartidor(page, { estado, referido: REFERIDO })
        await page.goto('/ruta?tab=cuenta', { waitUntil: 'domcontentloaded' })
        await expect(page.locator('nav.ruta-pestanas')).toBeVisible()
        await quieta(page, 1400)
        await limpia(page, `la cuenta (${estado}) en ${locale}`, opc)
        await page.unrouteAll({ behavior: 'ignoreErrors' })
      }
      expect(fallos).toEqual([])
    })

    test('«Hoy»: los avisos, el bono, la invitación, el cierre del día y la bienvenida', async ({ page }) => {
      const fallos = vigilar(page)
      await appDelRepartidor(page, { estado: 'prueba2', referido: REFERIDO, ruta: { bono: BONO },
        pedidos: [parada(1, 'entregado'), parada(2, 'pendiente'), parada(3, 'pendiente')] })
      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('nav.ruta-pestanas')).toBeVisible()
      await quieta(page, 1600)
      await limpia(page, `«Hoy» en ${locale}`, opc)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await appDelRepartidor(page, { estado: 'prueba', referido: null, ruta: { bono: BONO }, pedidos: [1, 2, 3, 4, 5].map((n) => parada(n, 'entregado')) })
      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await quieta(page, 1600)
      await limpia(page, `el cierre del día en ${locale}`, opc)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await appDelRepartidor(page, { estado: 'prueba', referido: REFERIDO, ruta: { bono: BONO }, flags: { fds_tour_ruta: null } })
      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('dialog')).toBeVisible()
      await quieta(page, 1200)
      await limpia(page, `la bienvenida en ${locale}`, opc)
      expect(fallos).toEqual([])
    })

    test('la entrada, el acceso y el alta', async ({ page }) => {
      const fallos = vigilar(page)
      await simularApi(page, 'vacio')
      await arrancar(page)
      for (const ruta of ['/empezar', '/login?next=%2Fruta', '/registro?sector=autonomo&plan=autonomo', '/registro']) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' })
        await quieta(page, 1000)
        await limpia(page, `${ruta} en ${locale}`, opc)
      }
      await page.goto('/empezar', { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { expanded: false }).last().click()
      await quieta(page, 400)
      await limpia(page, `/empezar abierto en ${locale}`, opc)
      expect(fallos).toEqual([])
    })
  })
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   3. LA ENTRADA, EL ACCESO Y EL ALTA («Crear mi cuenta»)
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const ENTRADA = [
  { nombre: 'la entrada (/empezar)', ruta: '/empezar', ancla: 'Tu ruta de reparto, ordenada sola.', web: [/Gratis y sin límite hasta el|Gratis para siempre hasta 15 paradas al día/, /Crear mi cuenta gratis/] },
  { nombre: 'el acceso de quien reparte (/login?next=/ruta)', ruta: '/login?next=%2Fruta', ancla: 'Entra en FDS', web: [/Crear cuenta gratis/] },
  { nombre: 'el acceso sin más (/login)', ruta: '/login', ancla: 'Entra en tu empresa', web: [/Crear empresa/] },
  { nombre: 'el alta de quien reparte (/registro?sector=autonomo)', ruta: '/registro?sector=autonomo&plan=autonomo', ancla: 'Tu nombre',
    web: [/Gratis y sin límite hasta el|Gratis hasta 15 paradas al día/, /Crear cuenta con plan Repartidor/, /Gratis · sin tarjeta · hoy 0 €/, /€\/mes/] },
  { nombre: 'el alta sin sector (/registro): el selector de empresas no sale; sale el alta de quien reparte', ruta: '/registro', ancla: 'Tu nombre', anclaWeb: '¿Qué vas a hacer con FDS?',
    web: [/¿Qué vas a hacer con FDS\?/, /DSP de Amazon/] },
  { nombre: 'el alta de una empresa con plan (/registro?sector=supermercado&plan=reparto): sale el alta de quien reparte', ruta: '/registro?sector=supermercado&plan=reparto&billing=annual', ancla: 'Tu nombre', anclaWeb: /Plan elegido/i,
    web: [/Plan elegido/i, /días gratis/] },
  { nombre: 'recuperar la contraseña (/reset-password)', ruta: '/reset-password', ancla: null, web: null },
]
test.describe('iPhone · la entrada, el acceso y el alta', () => {
  test.use({ userAgent: UA_APP })
  for (const e of ENTRADA) {
    test(e.nombre, async ({ page }) => {
      const fallos = vigilar(page)
      await simularApi(page, 'vacio')
      await arrancar(page)
      await page.goto(e.ruta, { waitUntil: 'domcontentloaded' })
      if (e.ancla) await expect(anclaDe(page, e.ancla)).toBeVisible()
      await quieta(page)
      await limpia(page, e.nombre)
      expect(fallos).toEqual([])
    })
  }

  test('«Soy de una empresa» y las opciones de la entrada', async ({ page }) => {
    await simularApi(page, 'vacio')
    await arrancar(page)
    await page.goto('/empezar', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: /Crear mi cuenta/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Así se instala y se usa/ })).toHaveCount(0)    // la guía de Safari no va dentro de la app
    await page.getByRole('button', { name: /Soy de una empresa/ }).click()
    await expect(page.getByText('Soy repartidor de una empresa')).toBeVisible()
    await limpia(page, 'la entrada con lo de las empresas abierto')
  })

  test('el alta entera: rellenar, crear la cuenta y la pantalla de «Cuenta creada»; y un error del servidor que habla del plan', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    await arrancar(page)
    const cuerpos = []
    let fallar = true
    await page.route(/\/api\/auth\/register$/, async (r) => {
      cuerpos.push(r.request().postDataJSON())
      if (fallar) { fallar = false; return r.fulfill({ status: 400, json: { detail: 'Plan no válido. Elige un plan con prueba gratis y suscripción.' } }) }
      return r.fulfill({ json: { access_token: 'tok-alta', role: 'admin', name: 'Ana', id: 'a1', account_type: 'dsp', slug: 'ana-1' } })
    })
    await page.goto('/registro?sector=autonomo&plan=autonomo&ref=ANA123', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Tu nombre', { exact: false }).first()).toBeVisible()
    await page.getByPlaceholder('Pepe').fill('Ana')
    await page.getByPlaceholder('tu@correo.com').fill('ana@correo.es')
    await page.locator('input[type=password]').first().fill('una-clave-larga')
    await page.getByRole('checkbox').check()
    await expect(page.getByRole('button', { name: 'Crear mi cuenta', exact: true })).toBeVisible()
    await limpia(page, 'el alta rellena')
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click()
    await expect(page.getByText('No se ha podido completar')).toBeVisible()
    await expect(page.getByText('Plan no válido')).toHaveCount(0)
    await limpia(page, 'el alta con el error del servidor')
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click()
    await expect(page.getByText('¡Cuenta creada!')).toBeVisible()
    await limpia(page, 'la cuenta creada')
    expect(cuerpos[1].plan).toBe('autonomo')
    expect(cuerpos[1].ref, 'en el iPhone el alta no manda código de invitación').toBeUndefined()
    expect(await page.evaluate(() => localStorage.getItem('fds_ref')), 'ni lo guarda').toBeNull()
    expect(fallos).toEqual([])
  })
})
test.describe('control · la web (sin simular el iPhone) sigue enseñando la entrada y el alta de siempre', () => {
  for (const e of ENTRADA.filter((x) => x.web)) {
    test(e.nombre, async ({ page }) => {
      await simularApi(page, 'vacio')
      await arrancar(page, { ios: false })
      await page.goto(e.ruta, { waitUntil: 'domcontentloaded' })
      await expect(anclaDe(page, e.anclaWeb || e.ancla)).toBeVisible()
      await quieta(page, 900)
      const texto = await lo(page)
      for (const re of e.web) expect(texto, `la web ya no enseña ${re} en «${e.nombre}»`).toMatch(re)
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   4. EL PORTAL DEL CONDUCTOR DE EMPRESA (/conductor): entrar, el inicio, Mi ruta, Turnos, Extras, la cartera, la tienda, la
   auditoría y su final
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const VEHICULO = { id: 'v1', license_plate: '1234 ABC', brand: 'Toyota', model: 'Proace' }
const OFERTA = { id: 'o1', emoji: '🎁', title: 'Descuento del 20 % en neumáticos', description: 'Con el código FLOTA20', url: 'https://example.com/oferta', cta: 'Ver oferta' }
async function portal(page, ios) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA LÓPEZ', center: 'NORTE' }))
  }, token)
  await simularApi(page, 'vacio')
  await arrancar(page, { ios })
  await page.route(/\/api\/tienda\/escaparate/, (r) => r.fulfill({ json: { visible: true, prendas: [{ id: 'pr1', nombre: 'Polo del equipo', precio: 19.9 }, { id: 'pr2', nombre: 'Chaleco', precio: 29.5 }] } }))
  await page.route(/\/api\/mercadillo\/estado/, (r) => r.fulfill({ json: { visible: true, sin_leer: 1 } }))
  await page.route(/\/api\/trabajar-mas/, (r) => r.fulfill({ json: { plazas: 2, dias: 2, vacantes: [{ id: 'x1', dia: 'martes 10/11', quedan: 1, mi_estado: null }], extras: [] } }))
  await page.route(/\/api\/vehicles\/portal/, (r) => r.fulfill({ json: { vehicles: [VEHICULO], puede_auditar: true, motivo: null } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: false, empresa: 'Transportes Ruiz', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, pais: 'es', prefijo: '34',
    ruta: { fin: '11:00', minutos: 45, km: 6, trafico: true }, pedidos: [parada(1, 'pendiente'), parada(2, 'pendiente')] } }))
  await page.route(/\/api\/conductor\/referidos/, (r) => r.fulfill({ json: { enlace: 'https://flotadsp.com/invita?ref=XYZ', por_invitado: 250, saldo: 500, invitados: 1, premiados: 0, metodos: ['bizum', 'iban'], retiradas: [] } }))
  await page.route(/\/api\/driver-offers$/, (r) => r.fulfill({ json: { offers: [OFERTA] } }))
}
const HOLA = 'Hola, ANA'
const PORTAL = [
  { nombre: 'el acceso (sin sesión)', ruta: '/conductor', sinSesion: true },
  { nombre: 'el acceso de la empresa (/conductor/oga5)', ruta: '/conductor/oga5', sinSesion: true },
  { nombre: 'el inicio (Mi ruta, auditoría, turnos, extras, mercadillo…)', ruta: '/conductor', ancla: HOLA, web: [/Comparte y gana/, /Ropa del equipo/, /Desde 19,90 €/] },
  { nombre: 'Mi ruta (portal)', ruta: '/conductor?vista=ruta', ancla: SIGUIENTE },
  { nombre: 'Pedir días libres', ruta: '/conductor', ancla: HOLA, clic: 'Pedir días libres' },
  { nombre: 'Mis turnos', ruta: '/conductor', ancla: HOLA, clic: 'Mis turnos' },
  { nombre: 'Trabajar más (la tarjeta del inicio)', ruta: '/conductor', ancla: HOLA, clic: 'Ver y solicitar' },
  { nombre: 'Trabajar más (extras)', ruta: '/conductor?vista=extra' },
  { nombre: 'Cambiar mi contraseña', ruta: '/conductor', ancla: HOLA, clic: 'Cambiar mi contraseña' },
  { nombre: 'Correo de recuperación', ruta: '/conductor', ancla: HOLA, clic: 'Correo de recuperación' },
  { nombre: 'Mercadillo (portal)', ruta: '/conductor?vista=mercadillo', perfil: 'basico' },
]
test.describe('iPhone · el portal del conductor de empresa', () => {
  test.use({ userAgent: UA_APP })
  for (const e of PORTAL) {
    test(e.nombre, async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      if (e.sinSesion) { await simularApi(page, 'vacio'); await arrancar(page) } else await portal(page, true)
      await page.goto(e.ruta, { waitUntil: 'domcontentloaded' })
      if (e.ancla) await expect(anclaDe(page, e.ancla)).toBeVisible()
      if (e.clic) {
        await page.getByRole('button', { name: new RegExp(e.clic) }).first().click()
        await expect(page.getByText(HOLA)).toHaveCount(0)
      }
      await quieta(page, 1000)
      await limpia(page, e.nombre, { perfil: e.perfil || 'estricto' })
      if (e.web) {
        await expect(page.getByRole('button', { name: /Comparte y gana/ })).toHaveCount(0)
        await expect(page.getByRole('button', { name: /Ropa del equipo/ })).toHaveCount(0)
        await expect(page.getByRole('button', { name: /Mercadillo/ })).toBeVisible()      // lo que no vende nada se queda
      }
      expect(fallos).toEqual([])
    })
  }

  test('la auditoría entera y su final (firma y «inspección enviada»), sin incentivos ni ofertas patrocinadas', async ({ page }) => {
    test.setTimeout(90000)
    const fallos = vigilar(page)
    const pedidos = []
    await portal(page, true)
    await page.route(/\/api\/auth\/me\/assigned-vehicle/, (r) => r.fulfill({ json: {} }))
    await page.route(/\/api\/inspections\/validate-photo/, (r) => r.fulfill({ json: { valid: true, checked: false } }))
    await page.route(/\/api\/vehicles\/v1\/odometer-photo/, (r) => r.fulfill({ json: { aceptada: true, km: 45010, manual_min: 0, manual_max: 999999, dias: 1, current_mileage: 45000 } }))
    await page.route(/\/api\/inspections\/upload/, (r) => r.fulfill({ json: { id: 'i1', analysis: { severity: 'leve', total_damages_count: 0 } } }))
    await page.route(/\/api\/inspections\/i1\/sign/, (r) => r.fulfill({ json: { hash: 'a'.repeat(64) } }))
    await page.route(/\/api\/driver-offers\/o1\/click/, (r) => { pedidos.push('click'); return r.fulfill({ json: {} }) })
    await page.route(/\/api\/driver-offers$/, (r) => { pedidos.push('oferta'); return r.fulfill({ json: { offers: [OFERTA] } }) })
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Hacer la auditoría/ }).click()
    await expect(page.getByText('Inspección diaria')).toBeVisible()
    await quieta(page, 500)
    await limpia(page, 'la auditoría, paso 1 (elegir furgoneta)')
    await page.getByRole('button', { name: /1234 ABC/ }).click()
    const archivos = page.locator('input[type=file]')
    await expect(archivos).toHaveCount(6)
    for (const i of [0, 1, 2, 3, 4, 5]) { await archivos.nth(i).setInputFiles(FOTO); await quieta(page, 500) }
    await page.getByRole('button', { name: '½', exact: true }).click()
    await page.getByRole('button', { name: /Continuar al checklist/ }).click()
    await limpia(page, 'la auditoría, paso 3 (checklist)')
    await page.getByRole('button', { name: 'Sí, la lleva' }).click()
    await page.getByRole('button', { name: /Revisar y enviar/ }).click()
    await limpia(page, 'la auditoría, paso 4 (resumen)')
    await page.getByRole('button', { name: /Enviar inspección/ }).click()
    await expect(page.getByText('Inspección completada')).toBeVisible()
    await quieta(page, 700)
    await limpia(page, 'la inspección completada (firma)')
    await page.getByRole('checkbox').check({ force: true })
    await page.getByRole('button', { name: /Firmar electrónicamente/ }).click()
    await expect(page.getByRole('button', { name: /Nueva inspección/ }).first()).toBeVisible()
    await quieta(page, 700)
    const final = await limpia(page, 'la inspección firmada (final)')
    expect(final).not.toMatch(/neumáticos|FLOTA20|Ver oferta|🎁/)
    expect(pedidos, 'en el iPhone no se piden ni se cuentan las ofertas patrocinadas').toEqual([])
    expect(fallos).toEqual([])
  })
})
test.describe('control · el portal del conductor de la web sigue con «Comparte y gana», la ropa y las ofertas', () => {
  test('el inicio, la cartera, la tienda, la auditoría con sus incentivos y el final con la oferta', async ({ page }) => {
    test.setTimeout(90000)
    await portal(page, false)
    await page.route(/\/api\/auth\/me\/assigned-vehicle/, (r) => r.fulfill({ json: {} }))
    await page.route(/\/api\/inspections\/validate-photo/, (r) => r.fulfill({ json: { valid: true, checked: false } }))
    await page.route(/\/api\/vehicles\/v1\/odometer-photo/, (r) => r.fulfill({ json: { aceptada: true, km: 45010, manual_min: 0, manual_max: 999999, dias: 1, current_mileage: 45000 } }))
    await page.route(/\/api\/inspections\/upload/, (r) => r.fulfill({ json: { id: 'i1', analysis: { severity: 'leve', total_damages_count: 0 } } }))
    await page.route(/\/api\/inspections\/i1\/sign/, (r) => r.fulfill({ json: { hash: 'a'.repeat(64) } }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /Comparte y gana/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Ropa del equipo/ })).toBeVisible()
    await page.getByRole('button', { name: /Comparte y gana/ }).click()
    await expect(page.getByText(/Invita · comparte · gana/)).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    await page.getByRole('button', { name: /Hacer la auditoría/ }).click()
    await expect(page.getByText(/Próximamente: incentivos para conductores/)).toBeVisible()
    await page.getByRole('button', { name: /1234 ABC/ }).click()
    const archivos = page.locator('input[type=file]')
    await expect(archivos).toHaveCount(6)
    for (const i of [0, 1, 2, 3, 4, 5]) { await archivos.nth(i).setInputFiles(FOTO); await quieta(page, 500) }
    await page.getByRole('button', { name: '½', exact: true }).click()
    await page.getByRole('button', { name: /Continuar al checklist/ }).click()
    await page.getByRole('button', { name: 'Sí, la lleva' }).click()
    await page.getByRole('button', { name: /Revisar y enviar/ }).click()
    await page.getByRole('button', { name: /Enviar inspección/ }).click()
    await expect(page.getByText('Inspección completada')).toBeVisible()
    await page.getByRole('checkbox').check({ force: true })
    await page.getByRole('button', { name: /Firmar electrónicamente/ }).click()
    await expect(page.getByText('Descuento del 20 % en neumáticos')).toBeVisible()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   5. LAS PÁGINAS DE LA WEB QUE EN EL IPHONE NO EXISTEN (venden, tarifan o promocionan): llevan a la app del repartidor
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const SOLO_WEB = [
  ['la portada (/)', '/'], ['los planes y precios (/planes)', '/planes'], ['el regalo (/regalo/ABCD-EFGH)', '/regalo/ABCD-EFGH'],
  ['la invitación (/invita)', '/invita?ref=ANA123&utm_source=referido'], ['los repartidores (/repartidores)', '/repartidores'],
  ['la calculadora (/calculadora-repartidor)', '/calculadora-repartidor'], ['la guía de Safari (/iphone)', '/iphone'],
  ['los avisos de empleo de pago (/empleo/prioridad)', '/empleo/prioridad'], ['el peritaje con precio (/peritaje-tecnico)', '/peritaje-tecnico'],
  ['la tienda pública (/t/abc)', '/t/abcdefghijklmnop'],
]
test.describe('iPhone · lo que solo existe en la web lleva a la app del repartidor', () => {
  test.use({ userAgent: UA_APP })
  for (const [nombre, ruta] of SOLO_WEB) {
    test(nombre, async ({ page }) => {
      const fallos = vigilar(page)
      await appDelRepartidor(page, { ios: true, estado: 'prueba' })
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/ruta$/)
      await expect(page.getByText(VACIA)).toBeVisible()
      await quieta(page)
      await limpia(page, nombre)
      expect(fallos).toEqual([])
    })
  }
  test('sin sesión, igual: la portada y los planes acaban en el acceso, no en una página de ventas', async ({ page }) => {
    await simularApi(page, 'vacio')
    await arrancar(page)
    for (const ruta of ['/', '/planes', '/regalo/ABCD-EFGH', '/invita']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/login\?next=/)
      await expect(page.getByRole('heading', { name: 'Entra en FDS' })).toBeVisible()
    }
  })
})
test.describe('control · en la web esas páginas siguen donde estaban', () => {
  for (const [nombre, ruta, texto] of [['los planes y precios (/planes)', '/planes', /plan|precio/i], ['la invitación (/invita)', '/invita', /gana|invita/i],
    ['la portada (/)', '/', /FDS/], ['el regalo (/regalo/ABCD-EFGH)', '/regalo/ABCD-EFGH', /regalo|FDS/i]]) {
    test(nombre, async ({ page }) => {
      await simularApi(page, 'vacio')
      await arrancar(page, { ios: false })
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await quieta(page, 900)
      expect(new URL(page.url()).pathname).toBe(ruta.split('?')[0])
      expect(await lo(page)).toMatch(texto)
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   6. LOS TEXTOS LEGALES que se abren desde el alta y la cuenta, en español y en inglés
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const LEGALES = [
  ['/terminos', /Términos|Terms/, /Suscripción, prueba y pagos|Invita y gana|Subscription, trial and payments|Invite and earn/],
  ['/privacidad', /Privacidad|Privacy/, /Invita y gana|Stripe|Invite and earn/],
  ['/cookies', /Cookie/, /Stripe|flota_plan/],
  ['/seguridad', /Seguridad|Security/, /Stripe/],
  ['/aviso-legal', /Aviso|Legal/, /suscripción|subscription/],
  ['/encargo', /Encargo|Processing/, /suscripción|subscription|Stripe/],
  ['/contacto', /Contacto|Contact/, null],
]
for (const [idioma, locale] of [['es', 'es-ES'], ['en', 'en-GB']]) {
  test.describe(`iPhone · los textos legales (${locale})`, () => {
    test.use({ userAgent: UA_APP, locale })
    for (const [ruta, titulo] of LEGALES) {
      test(ruta, async ({ page }) => {
        const fallos = vigilar(page)
        await simularApi(page, 'vacio')
        await arrancar(page)
        await page.goto(ruta, { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(titulo)
        await quieta(page)
        await limpia(page, `${ruta} en ${locale}`, { idioma, perfil: 'basico' })
        expect(fallos).toEqual([])
      })
    }
    test('el logotipo de una página legal vuelve a la app, no a la portada de ventas', async ({ page }) => {
      await appDelRepartidor(page, { ios: true, estado: 'prueba' })
      await page.goto('/terminos', { waitUntil: 'domcontentloaded' })
      await page.locator('nav a').first().click()
      await expect(page).toHaveURL(/\/ruta$/)
    })
  })
}
test.describe('control · los textos legales de la web siguen con su suscripción, su prueba y su «Invita y gana»', () => {
  for (const [ruta, , esperado] of LEGALES.filter((x) => x[2])) {
    test(ruta, async ({ page }) => {
      await simularApi(page, 'vacio')
      await arrancar(page, { ios: false })
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await quieta(page, 600)
      expect(await lo(page)).toMatch(esperado)
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   7. EL PANEL DE LA EMPRESA dentro de la app: ni la prueba, ni el plan, ni el pago
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
async function panel(page, ios, { superAdmin = false } = {}) {
  await entrarComoAdmin(page, { superAdmin })
  await simularApi(page, 'lleno')
  await arrancar(page, { ios })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'trial', days_left: 5, required: false, plan: 'completo', sector: 'mensajeria', precios: { mensual: 9.99, anual: 99 } } }))
  await page.route(/\/api\/billing\/config/, (r) => r.fulfill({ json: { provider: 'stripe', ready: true, pago_en_app: true, planes: ['completo'], checkout: {} } }))
  await page.route(/\/api\/billing\/uso/, (r) => r.fulfill({ json: { en_flota: 40, colaboradores: 2, campana: 1, pagadas: 38, desfase: 2 } }))
}
// El título de la pantalla, dentro del contenido principal: el texto suelto casaba antes con el menú (escondido en el móvil).
const TITULO_DEL_PANEL = (page) => page.locator('main h1').first()
const PANEL = [
  { nombre: 'la portada del panel con el aviso de la prueba', ruta: '/panel', ancla: TITULO_DEL_PANEL, web: [/Prueba gratis/i, /5 días/, /Pasar a Pro/] },
  { nombre: 'la configuración con el plan y la suscripción', ruta: '/panel/configuracion', ancla: TITULO_DEL_PANEL, web: [/Plan y suscripción/, /Ver planes/, /Estado:/] },
  { nombre: 'el perfil con la facturación', ruta: '/panel/perfil', ancla: TITULO_DEL_PANEL, web: [/Lemon Squeezy/] },
]
test.describe('iPhone · el panel de la empresa', () => {
  test.use({ userAgent: UA_APP })
  for (const e of PANEL) {
    test(e.nombre, async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      await panel(page, true)
      await page.goto(e.ruta, { waitUntil: 'domcontentloaded' })
      await expect(anclaDe(page, e.ancla)).toBeVisible({ timeout: 15000 })
      await quieta(page, 1500)
      await limpia(page, e.nombre, { perfil: 'basico' })
      expect(fallos).toEqual([])
    })
  }
  test('el acceso del panel', async ({ page }) => {
    await simularApi(page, 'vacio')
    await arrancar(page)
    await page.goto('/panel/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Bienvenido de nuevo')).toBeVisible()
    await quieta(page)
    await limpia(page, 'el acceso del panel', { perfil: 'basico' })
  })
  test('las pantallas del dueño del producto (negocio, tienda, analítica, gastos) no existen: llevan al panel y no están en el menú', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    await panel(page, true, { superAdmin: true })
    for (const ruta of ['/panel/admin', '/panel/tienda', '/panel/analitica', '/panel/gastos']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await expect(page).not.toHaveURL(new RegExp(`${ruta}$`))
      await expect(page.getByRole('link', { name: /Negocio|Super-admin|Gastos|Cómo va el negocio|Ropa|Tienda/ })).toHaveCount(0)
      await quieta(page, 900)
      await limpia(page, `${ruta} lleva al panel`, { perfil: 'basico' })
    }
    expect(fallos).toEqual([])
  })
  test('la ficha de una furgoneta, sin «cómo se factura»', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    await panel(page, true)
    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('1234 ABC').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('1234 ABC').first().click()
    await expect(page.getByText('Identificación QR')).toBeVisible()
    await quieta(page, 800)
    await limpia(page, 'la ficha de la furgoneta', { perfil: 'basico' })
    await expect(page.getByText('Cómo se factura')).toHaveCount(0)
    expect(fallos).toEqual([])
  })
})
test.describe('control · el panel de la web sigue con su prueba, su plan y su facturación', () => {
  test('y el super-admin sigue con su negocio, su analítica y sus gastos', async ({ page }) => {
    test.setTimeout(60000)
    await panel(page, false, { superAdmin: true })
    for (const ruta of ['/panel/admin', '/panel/analitica', '/panel/gastos']) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await quieta(page, 1500)
      expect(new URL(page.url()).pathname, `la web ya no abre ${ruta}`).toBe(ruta)
    }
  })
  for (const e of PANEL) {
    test(e.nombre, async ({ page }) => {
      test.setTimeout(60000)
      await panel(page, false)
      await page.goto(e.ruta, { waitUntil: 'domcontentloaded' })
      await expect(anclaDe(page, e.ancla)).toBeVisible({ timeout: 15000 })
      await quieta(page, 1500)
      const texto = await lo(page)
      for (const re of e.web) expect(texto, `el panel de la web ya no enseña ${re} en «${e.nombre}»`).toMatch(re)
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   8. EL MERCADILLO (anuncios entre repartidores): lo único que lleva precios, los del objeto que se vende; sin planes ni pagos
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
test.describe('iPhone · el mercadillo no habla de planes (los precios son los de lo que se vende)', () => {
  test.use({ userAgent: UA_APP })
  test('desde «Cuenta», el listado', async ({ page }) => {
    test.setTimeout(60000)
    const fallos = vigilar(page)
    await appDelRepartidor(page, { ios: true, estado: 'prueba', merc: { visible: true, sin_leer: 0 } })
    await page.route(/\/api\/mercadillo$/, (r) => r.fulfill({ json: { anuncios: [{ id: 'a1', titulo: 'Soporte de móvil', precio_cent: 1500, categoria: 'vehiculo', zona: 'A Coruña', estado: 'publicado', fotos: [] }] } }))
    await page.goto('/ruta?tab=cuenta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Mercadillo de repartidores/ }).click()
    await expect(page.getByText('Soporte de móvil')).toBeVisible()
    await quieta(page, 800)
    await limpia(page, 'el mercadillo', { perfil: 'basico' })
    expect(fallos).toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   9. LOS ERRORES REALES DEL SERVIDOR: la red de seguridad de lib/plataforma.js (hablaDePagos, detalleSinPagos)
   Apple rechazó la 2.4.1 por lo que la app DICE: un error del servidor que cuente planes, cuotas, regalos o la cartera, pintado en
   una pantalla del iPhone, es una referencia más. La expresión de HABLA_DE_PAGOS sale de clasificar con ast los 1.219 mensajes de
   HTTPException de backend/server.py (898 textos distintos). Aquí van los que importan, TAL CUAL los manda el servidor (con un
   valor de ejemplo donde él pone un dato): los que se cambian por el texto neutro y los que NO (si no, la expresión se comería
   un error legítimo: el cobro de un cliente en una entrega, el «plano» del parking, un enlace caducado…).
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const SE_NEUTRALIZAN = [
  'Plan no válido', 'Ya estás en ese plan', 'Plan desconocido: oro', 'La opinión es para el plan Repartidor',
  'La invitación es para el plan Repartidor', 'La cartera es para el plan Repartidor', 'Esta suscripción es para el plan Repartidor',
  'Este regalo es para el plan Repartidor', GEMINI_429, 'Hoy has llegado al tope de gasto del Centro de IA (5.00 $). Mañana se reinicia.',
  'Tu plan Reparto no incluye esta función. Actualiza tu suscripción en /planes.',
  'Has llegado al tope de paradas gratis de hoy. Pasa a ilimitado en «Cuenta» o sigue mañana.',
  'Has alcanzado el límite de centros de tu plan. Amplía tu suscripción para añadir más.',
  'Para subir de plan hay que completar el pago. El plan se activa solo cuando el pago se confirma.',
  'Modo demo: solo lectura. Crea tu cuenta gratis para editar.', 'La suscripción la contrata la propia empresa',
  'Esta cuenta no tiene suscripción que pagar', 'Esa compra no es de nuestra suscripción', 'No encontramos ninguna suscripción con ese correo',
  'El pago con tarjeta no está configurado todavía', 'No se ha podido abrir el pago. Inténtalo en un minuto.',
  'El cobro con tarjeta no está activo todavía (falta la clave de Stripe)', 'Stripe no responde ahora mismo. Inténtalo en un momento.',
  'Google Play no reconoce esa compra', 'El cobro con Google Play no está configurado todavía', 'Los regalos los compra la propia cuenta',
  'Se puede regalar 1 mes o 1 año', 'Ese regalo ha caducado', 'Ese regalo ya se ha usado', 'El regalo va de 0,01 a 50 € por cuenta',
  'Los enlaces de invitación son de cada cuenta', 'No se pudo crear tu enlace de invitación. Inténtalo de nuevo.',
  'El programa de invitaciones no está disponible en tu país', '«Invita y gana» no está disponible en tu país', 'La cartera es de cada cuenta',
  'La cartera individual solo está disponible en una cuenta real de conductor', 'Tu saldo ha cambiado: vuelve a abrir la cartera',
  'Ya tienes una retirada en revisión: espera a que te la paguemos', 'Fuera de España se cobra por PayPal', 'Elige Bizum, transferencia o PayPal',
  'Esa retirada ya no está pendiente',
]
const SE_ENSENAN = [
  'Usuario o contraseña incorrectos', 'Correo/usuario o contraseña incorrectos', 'Email o contraseña incorrectos', 'Se requiere autenticación',
  'Tu sesión ha caducado: entra otra vez', 'Token inválido: Signature has expired', 'El enlace no es válido o ha caducado. Solicita uno nuevo.',
  'El enlace no es válido o ha caducado. Pide a la oficina que lo envíe de nuevo.', 'El código no es válido o ha caducado. Solicita uno nuevo.',
  'Este acceso ya no está disponible. Solicita un código por correo.', 'El enlace ha caducado. Entra con tu correo y tu contraseña.',
  'Este enlace ha caducado. Pídele uno nuevo a la oficina.', 'La contraseña debe tener al menos 8 caracteres', 'Ese usuario ya existe, elige otro',
  'Demasiados intentos fallidos. Espera 5 minutos.', 'Escribe un correo válido.', 'Ese email ya está en uso por otra cuenta',
  'Ya hay un conductor activo con el correo ana@correo.es.', 'La matrícula 1234 ABC ya está dada de alta.',
  'Pega el plan de la semana desde el portal', 'Di cómo ha pagado: efectivo, tarjeta, Bizum, Pix o transferencia',
  'El Bizum es un móvil español de 9 cifras', 'Pon un importe válido, en euros', 'La plaza A12 no existe en el plano de NORTE',
  'Indica un centro concreto para ver su plano', 'Hemos recibido muchas candidaturas hoy. Prueba mañana.',
  'Ya nos llego tu candidatura para esta oferta. Gracias.', 'Esta oferta ya no esta disponible', 'Es para hoy: avisa a la oficina directamente',
  'Tu ficha no tiene centro: habla con la oficina', 'Cuenta un poco de qué va: quien lo aprueba necesita saberlo',
  'Ese numero no parece correcto. Escribelo con los 9 digitos.', 'No se ha podido mandar el correo ahora mismo. Inténtalo en unos minutos.',
  'Esa foto no se puede abrir. Prueba con otra (JPG o PNG).', 'Has subido muchas fotos hoy. Prueba mañana.', 'Escribe una pregunta',
  'El asistente no ha podido responder, prueba en un minuto', 'Esa prenda ya no está a la venta', 'Ese anuncio ya no está a la venta',
  'Puedes tener 5 anuncios a la vez. Marca alguno como vendido o quítalo.', 'No tienes la jornada empezada', 'La foto es demasiado grande',
  'Falta la oferta', 'Ese centro ya existe', 'Has mandado 5 correos en la ultima hora: espera un poco',
]
const EN_OTROS_IDIOMAS = [
  'You exceeded your current quota, please check your plan and billing details.', 'Choose a plan', 'Your plans have changed',
  'Votre plan a expiré', 'Ihre Pläne', 'Il tuo piano è scaduto', 'Unlimited stops',
]

/** Lo que haría `fn` con la app de iPhone (window.Capacitor 'ios') y luego deja el entorno como estaba. */
function conIPhone(fn) {
  const antes = globalThis.window
  globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }
  try { return fn() } finally { if (antes === undefined) delete globalThis.window; else globalThis.window = antes }
}
const enElIPhone = (mensaje, status = 400) => conIPhone(() => detalleSinPagos({ detail: mensaje }, status).detail)

test.describe('la red de seguridad de los errores del servidor (lib/plataforma.js)', () => {
  test('los mensajes reales del plan, la cuota, los pagos, los regalos y la cartera se cambian por el texto neutro', () => {
    const sueltos = SE_NEUTRALIZAN.filter((m) => !hablaDePagos(m))
    expect(sueltos, `se le escapan al iPhone: ${sueltos.join(' | ')}`).toEqual([])
    const sinCambiar = SE_NEUTRALIZAN.filter((m) => enElIPhone(m) !== TEXTO_NEUTRO)
    expect(sinCambiar, `la respuesta del servidor sigue diciéndolo: ${sinCambiar.join(' | ')}`).toEqual([])
  })

  test('los errores legítimos salen tal cual (credenciales, validaciones, enlaces caducados, el cobro de un cliente, el plano del parking…)', () => {
    const comidos = SE_ENSENAN.filter((m) => hablaDePagos(m))
    expect(comidos, `la expresión se come errores legítimos: ${comidos.join(' | ')}`).toEqual([])
    const cambiados = SE_ENSENAN.filter((m) => enElIPhone(m) !== m)
    expect(cambiados, `el iPhone los cambia: ${cambiados.join(' | ')}`).toEqual([])
  })

  test('«plan» en singular y en plural, en los idiomas de la app, y la cuota o la factura que llegue de fuera', () => {
    const sueltos = EN_OTROS_IDIOMAS.filter((m) => !hablaDePagos(m))
    expect(sueltos, `se le escapan al iPhone: ${sueltos.join(' | ')}`).toEqual([])
    for (const m of ['plan', 'Plan', 'tu plan', 'Ver mi plan', 'planes', 'Planes', 'plans', 'Plans']) expect(hablaDePagos(m), m).toBe(true)
    for (const m of ['planificar la ruta', 'explanada', 'planta baja', 'Plantilla de turnos', 'el plano del almacén', 'la cuenta es correcta']) expect(hablaDePagos(m), m).toBe(false)
  })

  test('cualquier 402 sale neutro en el iPhone, y solo en el iPhone', () => {
    expect(enElIPhone('Tu cuenta no puede continuar', 402)).toBe(TEXTO_NEUTRO)
    expect(enElIPhone('Tu cuenta no puede continuar', 400)).toBe('Tu cuenta no puede continuar')
    expect(enElIPhone('Tu cuenta no puede continuar', 403)).toBe('Tu cuenta no puede continuar')
    expect(detalleSinPagos({ detail: 'Tu cuenta no puede continuar' }, 402).detail, 'sin el iPhone no se cambia nada').toBe('Tu cuenta no puede continuar')
    for (const m of SE_NEUTRALIZAN) expect(detalleSinPagos({ detail: m }, 400).detail, `sin el iPhone: ${m}`).toBe(m)
  })
})

const OPINION_400 = 'La opinión es para el plan Repartidor'
for (const [titulo, ios] of [['iPhone', true], ['control · web', false]]) {
  test.describe(`${titulo} · el error real del servidor, en la pantalla donde se pinta`, () => {
    if (ios) test.use({ userAgent: UA_APP })

    test('Cuenta · «Mándanos una idea»: 400 «La opinión es para el plan Repartidor»', async ({ page }) => {
      const fallos = vigilar(page)
      let envios = 0
      await appDelRepartidor(page, { ios, estado: 'prueba' })
      await page.route(/\/api\/opinion$/, (r) => { envios += 1; return r.fulfill({ status: 400, json: { detail: OPINION_400 } }) })
      await irACuenta(page)
      await page.getByRole('button', { name: /Mándanos una idea/ }).click()
      await page.getByRole('textbox', { name: 'Mándanos una idea' }).fill('Que se vea el mapa más grande')
      await page.getByRole('button', { name: 'Enviar', exact: true }).click()
      const aviso = page.getByRole('alert').filter({ hasText: /plan Repartidor|No se ha podido completar/ })
      await expect(aviso).toBeVisible()
      expect(envios, 'la idea no llegó a mandarse al servidor').toBe(1)
      if (ios) {
        await expect(aviso).toHaveText(TEXTO_NEUTRO)
        await limpia(page, 'la idea con el error del servidor')
      } else {
        await expect(aviso).toHaveText(OPINION_400)
      }
      expect(fallos).toEqual([])
    })

    test('el asistente «FDS IA» del panel: 429 de la cuota gratuita de Gemini', async ({ page }) => {
      test.setTimeout(60000)
      const fallos = vigilar(page)
      let preguntas = 0
      await panel(page, ios)
      await page.route(/\/api\/ai\/asistente\/historial/, (r) => r.fulfill({ json: { mensajes: [] } }))
      await page.route(/\/api\/ai\/asistente$/, (r) => { preguntas += 1; return r.fulfill({ status: 429, json: { detail: GEMINI_429 } }) })
      await page.goto('/panel', { waitUntil: 'domcontentloaded' })
      await expect(TITULO_DEL_PANEL(page)).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: 'FDS IA' }).click()
      const pregunta = page.getByPlaceholder('Escribe tu pregunta…')
      await pregunta.fill('¿Qué ITV caducan este mes?')
      await pregunta.press('Enter')
      const aviso = page.getByText(/cuota gratuita de Gemini|No se ha podido completar/).last()
      await expect(aviso).toBeVisible()
      expect(preguntas, 'la pregunta no llegó al servidor').toBe(1)
      if (ios) {
        await expect(aviso).toHaveText(TEXTO_NEUTRO)
        await limpia(page, 'el asistente con la cuota agotada', { perfil: 'basico' })
      } else {
        await expect(aviso).toHaveText(GEMINI_429)
      }
      expect(fallos).toEqual([])
    })
  })
}
