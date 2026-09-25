#!/usr/bin/env node
/* EL AVISO DE «HAY VERSION NUEVA» NO PUEDE SALTAR SI NO LA HAY.
   ══════════════════════════════════════════════════════════════════════════
   El 21-09-2026 el aviso de recargar salia siempre, y recargar no lo quitaba.
   La causa no estaba en la app: `flotadsp.com/build.json` lo servia la cache
   del borde de Cloudflare con el nombre de un bundle de hacia un dia, asi que
   toda pestaña lo comparaba con el suyo y lo veia distinto. `cache: 'no-store'`
   solo habla con la cache del navegador.

   Se ejecuta la funcion REAL (`src/lib/versionApp.js`, gotcha 40) con un
   `document`, un `fetch` y un `sessionStorage` de mentira, y se vigila lo que,
   si se rompe, no da ningun error:
     · que la peticion lleve un numero detras (si no, vuelve la cache del borde);
     · que un bundle IGUAL al de la pestaña no avise;
     · que uno distinto avise una sola vez;
     · que un `build.json` ausente (index.html con 200) o roto no avise;
     · que la recarga automatica no se encadene: una cada diez minutos.
*/
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..')
let fallos = 0
const ok = (c, msg) => { if (!c) { console.error('FALLO:', msg); fallos++ } }

const escuchas = {}
const guardado = {}
let recargas = 0
let hidden = false
globalThis.document = {
  get hidden() { return hidden },
  querySelectorAll: () => [{ getAttribute: () => '/assets/v2/index-MIO123.js' }],
  addEventListener: (e, f) => { (escuchas[e] ||= []).push(f) },
  removeEventListener: () => {},
}
globalThis.window = {
  addEventListener: () => {}, removeEventListener: () => {},
  location: { reload: () => { recargas++ } },
}
globalThis.sessionStorage = {
  getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = String(v) },
}

let urls = []
function servir(cuerpo, ct = 'application/json') {
  globalThis.fetch = async (u) => {
    urls.push(String(u))
    return { ok: true, headers: { get: () => ct }, json: async () => { if (typeof cuerpo === 'string') throw new Error('no es json'); return cuerpo } }
  }
}

const { vigilarVersion, recargarCuandoNadieMira } = await import(pathToFileURL(path.join(RAIZ, 'frontend-v2', 'src', 'lib', 'versionApp.js')).href)

async function una(cuerpo, ct) {
  servir(cuerpo, ct); urls = []
  let avisos = 0
  const parar = vigilarVersion(() => { avisos++ }, 3600_000)
  for (const f of escuchas.visibilitychange || []) await f()
  await new Promise((r) => setTimeout(r, 20))
  parar()
  return avisos
}

ok(await una({ bundle: 'index-MIO123.js' }) === 0, 'el mismo bundle NO debe avisar')
ok(urls.length > 0 && /build\.json\?t=\d+/.test(urls[0]), `la peticion debe llevar un numero detras, era: ${urls[0]}`)
ok(await una({ bundle: 'index-OTRO456.js' }) === 1, 'un bundle distinto debe avisar UNA vez')
ok(await una('<!doctype html>', 'text/html') === 0, 'un index.html con 200 no es un build.json: no debe avisar')
ok(await una({ bundle: 'basura' }) === 0, 'un nombre que no parece un bundle no debe avisar')
ok(await una({}) === 0, 'un build.json sin bundle no debe avisar')

// La recarga automatica no se encadena.
hidden = true
const parar = recargarCuandoNadieMira(5)
await new Promise((r) => setTimeout(r, 30))
ok(recargas === 1, `en segundo plano debe recargar una vez, recargo ${recargas}`)
for (const f of escuchas.visibilitychange || []) f()
await new Promise((r) => setTimeout(r, 30))
ok(recargas === 1, `no debe recargar otra vez a los pocos segundos: llevaba ${recargas}`)
parar()

if (fallos) { console.error(`\nversion-app: ${fallos} fallo(s)`); process.exit(1) }
console.log('version-app OK: no avisa sin version nueva, salta la cache del borde y no encadena recargas')
process.exit(0)
