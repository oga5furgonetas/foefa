/* ¿Se usa en una pantalla algo NUESTRO que no está importado en ella?
 *
 * POR QUÉ EXISTE
 * ──────────────
 * El 04-09-2026 a las 16:34 un commit añadió `useOrden()` a cuatro pantallas y
 * puso el `import` en tres. La cuarta —Vehículos— quedó llamando a una función
 * que en ese fichero no existe: **pantalla en negro con «useOrden is not
 * defined» durante 19 horas**, en producción, y lo reportó Mery.
 *
 * Ni el build ni el linter lo vieron: `useOrden()` es JavaScript perfectamente
 * válido, y esbuild no resuelve identificadores libres — revienta en el
 * navegador, no al compilar. Es el gotcha 19 (los `undefined name` que caza
 * pyflakes en el backend) del lado del cliente, donde no había nada.
 *
 * QUÉ MIRA, Y POR QUÉ ASÍ: solo los nombres que ESTE repositorio exporta desde
 * `src/lib/` y `src/panel/api.js` —lo nuestro, lo que se importa a mano—. No
 * intenta resolver React, los iconos ni los globales del navegador: un checker
 * que grita en falso deja de leerse, y aquí se busca la clase exacta de fallo
 * que ya ha pasado.
 *
 * Y se miran los usos sobre el código SIN comentarios, cadenas, regex ni texto
 * de JSX (ver `limpio`): en la primera pasada dio dos avisos en falso, uno de
 * ellos porque la palabra «lista» dentro de «no los lista (datos viejos)»
 * parecía una llamada a `lista(`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const problemas = []

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(jsx?|tsx?)$/.test(n)) out.push(p)
  }
  return out
}

const NL = String.fromCharCode(10)

/* Deja solo CÓDIGO: fuera comentarios, el contenido de las cadenas y de las
   plantillas (las expresiones `${…}` se quedan), las expresiones regulares y
   el texto suelto del JSX.

   Hasta el 29-10-2026 esto eran seis sustituciones encadenadas, y así salían
   cuatro avisos en falso que nadie podía quitar sin tapar el checker:
     · una regex con un número IMPAR de acentos graves (`[^`]+`, en CentroIA)
       desplazaba el emparejado de las plantillas, se tragaba 120 líneas de
       código y con ellas la definición de `Pasos` en su propio fichero;
     · `\B(` dentro de una regex parecía una llamada a `B(`;
     · «en la lista (como DEMO2001)», texto de un párrafo JSX, parecía una
       llamada a `lista(`.
   Un recorrido carácter a carácter con una pila de modos no se confunde con
   nada de eso: sabe en cada momento si está en código, dentro de una
   etiqueta, en el texto entre etiquetas, en una plantilla o en una regex. */
const PALABRAS_ANTES_DE_VALOR = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of',
  'instanceof', 'new', 'delete', 'void', 'throw', 'yield', 'await'])

function limpio(txt) {
  const n = txt.length
  let out = ''
  let i = 0
  let prev = ''         // último carácter significativo de código
  let palabra = ''      // la palabra de código que se está escribiendo
  let prevPalabra = ''  // la última palabra completa de código
  /* Pila de modos: js (código; `cierre` cuando lo abrió un `{` de JSX o un
     `${` de plantilla), tag (<etiqueta …>), hijos (texto entre etiquetas) y
     plantilla (`…`). */
  const pila = [{ modo: 'js', llaves: 0, cierre: false }]
  const cima = () => pila[pila.length - 1]
  const blanco = (c) => (c === '\n' ? '\n' : ' ')
  /* ¿Puede empezar aquí un valor (una regex o un elemento JSX)? Tras un
     operador o un paréntesis de apertura, sí; tras un nombre, un número, `)`
     o `]` lo que viene es una división o una comparación. */
  const valorPosible = () => {
    if (!prev) return true
    if (prev === ')' || prev === ']') return false
    if (/[\w$]/.test(prev)) return PALABRAS_ANTES_DE_VALOR.has(palabra || prevPalabra)
    return true
  }
  const emite = (c) => {
    out += c
    if (/[\w$]/.test(c)) { palabra += c } else { if (palabra) prevPalabra = palabra; palabra = '' }
    if (!/\s/.test(c)) prev = c
  }
  const salta = (k) => { for (let j = 0; j < k && i < n; j++, i++) out += blanco(txt[i]) }
  const valorCerrado = () => { if (palabra) prevPalabra = palabra; palabra = ''; prev = ')' }
  /* Una cadena con comillas: se deja el par de comillas y se vacía lo de
     dentro. Si no se cierra en la línea, se para en el salto. */
  const cadena = (q) => {
    out += q; i++
    while (i < n && txt[i] !== q && txt[i] !== '\n') {
      if (txt[i] === '\\') { salta(2); continue }
      salta(1)
    }
    if (i < n && txt[i] === q) { out += q; i++ }
    valorCerrado()
  }
  const abreJs = () => { out += txt[i]; i++; pila.push({ modo: 'js', llaves: 0, cierre: true }); valorCerrado(); prev = '{' }

  while (i < n) {
    const c = txt[i]
    const d = txt[i + 1]
    const f = cima()

    if (f.modo === 'plantilla') {
      if (c === '\\') { salta(2); continue }
      if (c === '`') { out += c; i++; pila.pop(); valorCerrado(); continue }
      if (c === '$' && d === '{') { out += '$'; i++; abreJs(); continue }
      salta(1); continue
    }

    if (f.modo === 'hijos') {
      if (c === '<' && d === '/') {           // </etiqueta>: se cierra este elemento
        while (i < n && txt[i] !== '>') { out += txt[i]; i++ }
        if (i < n) { out += '>'; i++ }
        pila.pop(); valorCerrado(); continue
      }
      if (c === '<' && (/[A-Za-z_$]/.test(d) || d === '>')) { out += c; i++; pila.push({ modo: 'tag' }); continue }
      if (c === '{') { abreJs(); continue }
      salta(1); continue                       // texto suelto
    }

    if (f.modo === 'tag') {
      if (c === '"' || c === "'") { cadena(c); continue }
      if (c === '{') { abreJs(); continue }
      if (c === '/' && d === '>') { out += '/>'; i += 2; pila.pop(); valorCerrado(); continue }
      if (c === '>') { out += c; i++; f.modo = 'hijos'; continue }
      out += c; i++; continue
    }

    // modo js
    if (c === '/' && d === '/') { while (i < n && txt[i] !== '\n') salta(1); continue }
    if (c === '/' && d === '*') {
      const fin = txt.indexOf('*/', i + 2)
      salta((fin < 0 ? n : fin + 2) - i); continue
    }
    if (c === '"' || c === "'") { cadena(c); continue }
    if (c === '`') { out += c; i++; pila.push({ modo: 'plantilla' }); continue }
    if (c === '/' && valorPosible()) {         // expresión regular
      salta(1)
      let clase = false
      while (i < n && txt[i] !== '\n') {
        if (txt[i] === '\\') { salta(2); continue }
        if (txt[i] === '[') clase = true
        else if (txt[i] === ']') clase = false
        else if (txt[i] === '/' && !clase) break
        salta(1)
      }
      if (i < n && txt[i] === '/') salta(1)
      while (i < n && /[a-z]/.test(txt[i])) salta(1)   // las banderas
      valorCerrado(); continue
    }
    if (c === '<' && (/[A-Za-z_$]/.test(d) || d === '>') && valorPosible()) {  // elemento JSX
      out += c; i++; pila.push({ modo: 'tag' }); continue
    }
    if (f.cierre) {
      if (c === '{') f.llaves++
      else if (c === '}') {
        if (f.llaves === 0) { out += c; i++; pila.pop(); valorCerrado(); continue }
        f.llaves--
      }
    }
    emite(c); i++
  }
  return out
}

/* Lo que una función recibe también está «a mano»: el `tx` de
   `distanciaHablada(m, tx)` en guia.js no es el `tx` de idioma.js sin
   importar, es el suyo. Parámetros de `function`, de las flechas y de
   `catch`, y de los métodos de objetos y clases (`nombre(a, b) {`). */
function parametros(txt, out) {
  const nombres = (s) => { for (const m of s.matchAll(/[A-Za-z_$][\w$]*/g)) out.add(m[0]) }
  // Desde un `(`: lo de dentro (con paréntesis anidados) y dónde cierra.
  const dentro = (desde) => {
    let p = 0
    for (let j = desde; j < txt.length; j++) {
      if (txt[j] === '(') p++
      else if (txt[j] === ')') { p--; if (p === 0) return [txt.slice(desde + 1, j), j] }
    }
    return ['', -1]
  }
  for (const m of txt.matchAll(/\b(?:function|catch)\b[^(\n]*\(/g)) nombres(dentro(m.index + m[0].length - 1)[0])
  for (const m of txt.matchAll(/^\s*(?:static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\(/gm)) {
    if (/^(?:if|for|while|switch|catch|function|return|await|typeof)$/.test(m[1])) continue
    const [lista, fin] = dentro(m.index + m[0].length - 1)
    if (fin >= 0 && /^\s*\{/.test(txt.slice(fin + 1))) nombres(lista)   // solo si es un método: `) {`
  }
  for (const m of txt.matchAll(/=>/g)) {       // (a, b) => … y a => …
    let j = m.index - 1
    while (j >= 0 && /\s/.test(txt[j])) j--
    if (txt[j] === ')') {
      let p = 0
      for (let k = j; k >= 0; k--) {
        if (txt[k] === ')') p++
        else if (txt[k] === '(') { p--; if (p === 0) { nombres(txt.slice(k + 1, j)); break } }
      }
    } else {
      let k = j
      while (k >= 0 && /[\w$]/.test(txt[k])) k--
      nombres(txt.slice(k + 1, j + 1))
    }
  }
  // Lo que se declara desestructurando (`const { a, b } = x`) o en un `for`.
  for (const m of txt.matchAll(/\b(?:const|let|var)\s*([{[][^}\]]*[}\]])/g)) nombres(m[1])
  for (const m of txt.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1])
}

const todos = ficheros(RAIZ)

/* Lo que exportan nuestros modulos propios. */
const nuestros = new Set()
for (const f of todos) {
  /* `lib/`, `api.js` Y `panel/components/`. Los componentes faltaban en la
     primera version, y por eso NO cazo `ThOrden`: se arreglo `useOrden`, se
     desplego, y la misma pantalla volvio a caer con el import de al lado — dos
     olvidados en el mismo fichero por el mismo commit. Un checker que cubre la
     mitad de una clase de fallo deja pasar la otra mitad y encima da la
     sensacion de que esta cubierta, que es peor que no tenerlo. */
  if (!/[\\/]lib[\\/]|[\\/]components[\\/]|[\\/]api\.js$/.test(f)) continue
  const src = readFileSync(f, 'utf8').split(String.fromCharCode(13)).join('')
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    nuestros.add(m[1])
  }
  /* Un componente se exporta por DEFECTO y su nombre es el del fichero: asi lo
     importan los demas (`import ThOrden from '../components/ThOrden'`) y asi es
     como se olvida. */
  if (/^export\s+default\b/m.test(src)) {
    const base = f.split(/[\\/]/).pop().replace(/\.\w+$/, '')
    if (/^[A-Z]/.test(base)) nuestros.add(base)
  }
}

for (const f of todos) {
  /* Fuera el retorno de carro: estos ficheros van en CRLF y el resto que deja
     impide que `.*$` cierre la linea, asi que el comentario NO se borraba y
     salia un aviso en falso. */
  // `.*$` no cruza: el comentario NO se borraba y salia un aviso en falso.
  const bruto = readFileSync(f, 'utf8').split(String.fromCharCode(13)).join('')
  const txt = limpio(bruto)

  /* Lo que este fichero tiene a mano: lo importado y lo que define el mismo.
     Los imports se leen del texto BRUTO y linea a linea: una sola expresion que
     cruce lineas se come el siguiente `import` y deja nombres fuera — asi salio
     el primer aviso en falso, con `ToastProvider`, que si estaba importado. */
  const disponibles = new Set()
  let dentro = false
  let acumulado = ''
  for (const linea of bruto.split(NL)) {
    // `import './index.css'` no trae nombres: si no se salta, deja el
    // acumulador abierto y se come los imports de debajo — asi salia
    // 'ToastProvider' como no importado estandolo.
    if (/^\s*import\s*['"]/.test(linea)) continue
    if (!dentro && /^\s*import\b/.test(linea)) { dentro = true; acumulado = '' }
    if (!dentro) continue
    acumulado += ' ' + linea
    if (!/\bfrom\b\s*['"]/.test(acumulado)) continue
    dentro = false
    const nombres = acumulado.replace(/^\s*import\s+/, '').split(/\bfrom\b/)[0]
    for (const n of nombres.replace(/[{}]/g, ' ').split(',')) {
      const nombre = n.trim().split(/\s+as\s+/).pop().trim()
      if (nombre && nombre !== '*') disponibles.add(nombre)
    }
  }
  for (const m of txt.matchAll(
    // El `default` no es opcional aqui: sin el, un componente
    // (`export default function ThOrden`) no se reconoce como definido en su
    // PROPIO fichero y sale acusandose a si mismo — 18 avisos en falso.
    /(?:^|\n)\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
    disponibles.add(m[1])
  }
  parametros(txt, disponibles)

  /* ── Y LOS DE REACT ROUTER, QUE SON LISTA CERRADA ──────────────────────
     El 14-09-2026 volvió a pasar, esta vez con `<Navigate>`: se añadieron dos
     redirecciones en `main.jsx` y el import se quedó fuera. El build pasó, los
     23 checkers pasaron, y **el panel entero se quedó en blanco** con
     «Navigate is not defined» — main.jsx es el fichero donde monta todo, así
     que ahí no se cae una pantalla: se caen todas. Lo vi al abrirlo en el
     navegador antes de entregarlo; si no, habría salido a producción.

     El checker solo miraba lo NUESTRO a propósito, para no gritar en falso con
     React ni con los iconos. Pero estos siete son una lista CERRADA y sus
     nombres no se parecen a nada más: o vienen de react-router-dom o no
     existen. Cubrirlos no puede dar un aviso en falso y cierra la mitad de la
     clase de fallo que quedaba abierta. */
  const ROUTER = ['Navigate', 'NavLink', 'Outlet', 'Routes', 'Route', 'BrowserRouter', 'Link']
  for (const nombre of ROUTER) {
    if (disponibles.has(nombre)) continue
    if (new RegExp('<' + nombre + '[\\s/>]').test(txt)) {
      problemas.push(`${f.slice(RAIZ.length + 1).replace(/\\/g, '/')} usa <${nombre}> de react-router-dom `
        + `y no lo importa: pantalla en blanco con «${nombre} is not defined»`)
    }
  }

  for (const nombre of nuestros) {
    if (disponibles.has(nombre)) continue
    // Se usa como llamada `nombre(` o como componente `<Nombre`.
    const usa = new RegExp('(?:^|[^\\w$.])' + nombre + '\\s*\\(|<' + nombre + '[\\s/>]')
    if (usa.test(txt)) {
      problemas.push(`${f.slice(RAIZ.length + 1).replace(/\\/g, '/')} usa '${nombre}' y no lo importa: `
        + `pantalla en blanco con «${nombre} is not defined»`)
    }
  }
}

if (problemas.length) {
  for (const p of problemas) console.error('  ' + p)
  console.error(`${NL}importaciones: ${problemas.length} problema(s).`)
  process.exit(1)
}
console.log(`importaciones OK: ${nuestros.size} nombres propios comprobados en ${todos.length} ficheros`)
