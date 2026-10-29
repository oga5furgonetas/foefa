import { A } from './textosRutaA'
import { B } from './textosRutaB'
import { C } from './textosRutaC'

/* El diccionario de la app de reparto: { 'texto en español': { en, pt, … } }.
   Comprobación: node scripts/check-textos-ruta.mjs (cada tx() tiene sus 5). */
const ORDEN = ['en', 'pt', 'fr', 'it', 'de']

export const TEXTOS = {}
for (const [es, lista] of Object.entries({ ...A, ...B, ...C })) {
  const t = {}
  ORDEN.forEach((l, i) => { t[l] = lista[i] })
  TEXTOS[es] = t
}
