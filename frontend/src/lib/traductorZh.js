/* EL PANEL EN CHINO, TAMBIÉN LO QUE NO PASA POR t().
   Las ~1.400 frases del diccionario van por t() (i18nZh.js). Pero las
   pantallas tienen además unas 1.500 frases escritas tal cual en el JSX.
   Pasarlas todas a t() en los 7 idiomas eran días de trabajo; para el chino,
   este traductor cambia en pantalla cada texto que coincide EXACTO con una
   frase del diccionario de literales (i18nZhLit.js, que se carga solo en
   chino).

   Lo que NO toca: lo que se escribe (input, textarea, contenteditable), el
   código, y cualquier cosa dentro de translate="no". Solo cambia el texto de
   un nodo o los atributos placeholder/title/aria-label/alt cuando el texto
   ENTERO coincide: un nombre de cliente no se parece a una frase del panel.
   React sigue mandando: si re-pinta un texto, el observador lo vuelve a
   traducir. */

let mapa = null
let obs = null
const NO = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT'])
const ATRS = ['placeholder', 'title', 'aria-label', 'alt']

function excluido(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (NO.has(e.tagName) || e.isContentEditable || e.getAttribute('translate') === 'no') return true
  }
  return false
}

function buscar(t) {
  return mapa[t] || mapa[t.replace(/\s+/g, ' ')]
}

function texto(n) {
  const v = n.nodeValue
  if (!v) return
  const t = v.trim()
  if (t.length < 2 || !/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(t)) return
  const z = buscar(t)
  if (!z || excluido(n.parentElement)) return
  n.nodeValue = v.replace(t, z)
}

function atributos(el) {
  for (const a of ATRS) {
    const v = el.getAttribute?.(a)
    if (!v) continue
    const z = buscar(v.trim())
    if (z && !excluido(el)) el.setAttribute(a, z)
  }
}

function recorrer(raiz) {
  if (raiz.nodeType === 3) { texto(raiz); return }
  if (raiz.nodeType !== 1 || NO.has(raiz.tagName)) return
  atributos(raiz)
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) texto(n)
    else atributos(n)
  }
}

let cargando = null

export function activarZh() {
  if (typeof document === 'undefined') return Promise.resolve()
  // Una sola carga aunque se llame dos veces seguidas.
  if (!cargando) cargando = import('../i18nZhLit').then(({ ZH_LIT }) => { mapa = ZH_LIT; observar() })
  return cargando
}

function observar() {
  if (obs) return
  recorrer(document.body)
  obs = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'characterData') texto(c.target)
      else if (c.type === 'attributes') atributos(c.target)
      else c.addedNodes.forEach(recorrer)
    }
  })
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRS })
}

export function zhActivo() { return !!obs }

export function desactivarZh() {
  if (!obs) return
  obs.disconnect()
  obs = null
  cargando = null
}
