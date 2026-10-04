import { A } from './textosRutaA'
import { B } from './textosRutaB'

/* El diccionario de la app de reparto: { 'texto en español': { en, pt, … } }.
   Comprobación: node scripts/check-textos-ruta.mjs (cada tx() tiene sus 6). */
const ORDEN = ['en', 'pt', 'fr', 'it', 'de', 'zh']

export const TEXTOS = {}
for (const [es, lista] of Object.entries({ ...A, ...B })) {
  const t = {}
  ORDEN.forEach((l, i) => { t[l] = lista[i] })
  TEXTOS[es] = t
}
