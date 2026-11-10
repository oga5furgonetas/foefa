import { expect } from '@playwright/test'

/* LA APP DE IPHONE SIMULADA Y LO QUE EN ELLA NO SE PUEDE LEER (09-11-2026; en su fichero desde el 10-11-2026).
   Lo comparten e2e/ios-sin-pagos.spec.js (la app de iPhone no menciona ni vende nada con pagos),
   e2e/mercadillo-bloqueo.spec.js (bloquear a una persona en el mercadillo, también dentro del iPhone) y
   e2e/mercadillo-acceso.spec.js (las normas que se aceptan al entrar y quien se queda sin acceso): un solo
   vocabulario prohibido y una sola forma de simular la app (window.Capacitor con getPlatform() 'ios'). */

export const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FDSApp/2.4.1 (iOS)'

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
  // 10-11-2026 (Apple, guideline 2.3.10): dentro de la app de iPhone tampoco se nombra otra plataforma ni su tienda.
  ['otra plataforma', /android|google play|play ?store/i],
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

export function prohibidas(texto, idioma, perfil) {
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
export async function lo(page) {
  return page.evaluate(() => {
    const partes = [document.body.innerText, document.title]
    for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) { const v = el.getAttribute(a); if (v) partes.push(v) }
    }
    return partes.join('\n')
  })
}

/** Que no salga nada prohibido en la pantalla que se ve ahora. Devuelve lo que se leía, por si hace falta algo más. */
export async function limpia(page, donde, { idioma = 'es', perfil = 'estricto' } = {}) {
  const texto = await lo(page)
  expect(texto.replace(/\s/g, '').length, `${donde}: la pantalla está en blanco`).toBeGreaterThan(20)
  const faltas = prohibidas(texto, idioma, perfil)
  expect(faltas, `${donde}: se lee algo prohibido en el iPhone → ${faltas.join(' | ')}`).toEqual([])
  return texto
}

/** Las excepciones de JavaScript de la página (no el ruido de la consola): lo que se rompe por esconder cosas. */
export function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

export const quieta = (page, ms = 700) => page.waitForTimeout(ms)

/** Lo que deja Capacitor dentro de la app: su puente nativo (window.webkit.messageHandlers.bridge) y el objeto global. Con el
 *  puente, @capacitor/core se inicia de verdad (isNativePlatform() y getPlatform() dicen «ios») y los plugins, como el de la barra
 *  de estado, cargan; con el objeto congelado de app-iphone-zona.spec.js el plugin fallaba al cargar y main.jsx recargaba la
 *  página (la auto-curación de vite:preloadError), que aquí estropeaba la prueba. `chunk_curacion` agotado: esa recarga no se
 *  hace nunca. `flags`: claves de localStorage a poner (o a quitar con null); va DESPUÉS de entrarComoAdmin, que pone el recorrido
 *  como visto. */
export async function arrancar(page, { ios = true, flags = {} } = {}) {
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
