#!/usr/bin/env node
/* TESTS QUE NO EJECUTA NADIE, QUE ES PEOR QUE NO TENERLOS.
 * ═══════════════════════════════════════════════════════════════════════════
 * Los ficheros de `backend/tests/` se corren de dos maneras: `pytest` (que es
 * lo que usa CI) y `run_all.py`, que ejecuta cada fichero como script. Los que
 * llevan su propio arranque —`if __name__ == "__main__": ...`— recorren los
 * `globals()` que existen EN ESE MOMENTO.
 *
 * Y ahi esta la trampa: un caso escrito DEBAJO de ese bloque no existe
 * todavia cuando el bloque corre, asi que no se ejecuta. No falla, no avisa y
 * el fichero sale en verde — parece cubierto y no lo esta. Es el gotcha 36 con
 * otra cara, y ha pasado TRES veces: en `test_analitica.py` (dos casos
 * huerfanos, uno de ellos el trinquete del contador de segmentos) y en
 * `test_ia_en_la_sala.py` el 19-09-2026, con el trinquete del falso positivo
 * de «los peores conductores» recien escrito.
 *
 * La regla es simple: el arranque va AL FINAL del fichero. Esto lo comprueba.
 *
 * Probado reintroduciendo el fallo: moviendo el bloque de `test_analitica.py`
 * a la mitad, da 1 aviso con el nombre de los casos que se quedarian fuera.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'backend', 'tests')
const avisos = []

for (const f of readdirSync(DIR).filter((x) => x.startsWith('test_') && x.endsWith('.py'))) {
  const src = readFileSync(join(DIR, f), 'utf8')
  const arranque = src.indexOf('if __name__ == "__main__":')
  if (arranque === -1) continue          // se corre solo con pytest: no aplica

  // ¿Hay algún `def test_...` DESPUÉS del arranque?
  const despues = src.slice(arranque)
  const huerfanos = [...despues.matchAll(/^def (test_[a-z0-9_]+)\(/gm)].map((m) => m[1])
  if (huerfanos.length) {
    avisos.push({ fichero: f, casos: huerfanos })
  }
}

if (!avisos.length) {
  console.log('tests OK: ningun caso queda debajo del arranque')
  process.exit(0)
}

console.log('TESTS QUE NO SE EJECUTAN — estan debajo del `if __name__ == "__main__"`:')
console.log('')
for (const a of avisos) {
  console.log(`  backend/tests/${a.fichero}`)
  for (const c of a.casos) console.log(`     ${c}`)
}
console.log('')
console.log('El arranque recorre los `globals()` que existen cuando corre, asi que')
console.log('lo escrito debajo no esta todavia: sale en verde SIN EJECUTARSE.')
console.log('Mueve el bloque `if __name__ == "__main__":` al final del fichero.')
process.exit(1)
