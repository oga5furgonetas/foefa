#!/usr/bin/env node
/* LAS PROMOCIONES TIENEN UNA SOLA FECHA Y UN SOLO IMPORTE.
   ═══════════════════════════════════════════════════════
   «Gratis y sin límite hasta el 31-12» y «10 € por invitado hasta el 31-12» viven
   en el servidor (server.py: REP_GRATIS_HASTA, _REF_PROMO_HASTA_DIA, _REF_PROMO_CENT,
   _BONO_CENT, REP_GRATIS_PARADAS_DIA, _REF_CENT) y, como respaldo mientras el
   servidor no contesta, en la web (frontend/src/lib/precios.js). El 17-10-2026 la
   fecha se alargó y hubo que tocarla en cuatro sitios; si uno se queda atrás, la
   portada anuncia una promoción que el servidor ya no da (o al revés). Esto lo para. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const servidor = readFileSync(path.join(RAIZ, 'backend', 'server.py'), 'utf8').replace(/^﻿/, '')
const web = readFileSync(path.join(RAIZ, 'frontend', 'src', 'lib', 'precios.js'), 'utf8')
let fallos = 0
const fallo = (msg) => { console.error('FALLO:', msg); fallos++ }

/* Una sola definición de cada constante; si hay dos, la segunda manda y nadie se entera. */
function unaVez(texto, re, donde) {
  const todas = [...texto.matchAll(re)]
  if (todas.length !== 1) { fallo(`${donde}: ${re} aparece ${todas.length} veces (esperaba 1)`); return null }
  return todas[0][1]
}

const srv = {
  gratis_hasta: unaVez(servidor, /^REP_GRATIS_HASTA = \(os\.environ\.get\("REP_GRATIS_HASTA", "(\d{4}-\d{2}-\d{2})"\)/gm, 'server.py'),
  ref_promo_hasta: unaVez(servidor, /^_REF_PROMO_HASTA_DIA = "(\d{4}-\d{2}-\d{2})"/gm, 'server.py'),
  ref_promo_cent: unaVez(servidor, /^_REF_PROMO_CENT = (\d+)/gm, 'server.py'),
  bono_cent: unaVez(servidor, /^_BONO_CENT = (\S+)/gm, 'server.py'),
  paradas_gratis: unaVez(servidor, /^REP_GRATIS_PARADAS_DIA = max\(1, int\(os\.environ\.get\("REP_GRATIS_PARADAS", "(\d+)"\)/gm, 'server.py'),
  ref_cent: unaVez(servidor, /^_REF_CENT = int\(round\(float\(os\.environ\.get\("REF_EUROS", "([\d.]+)"\)/gm, 'server.py'),
}
if (srv.bono_cent === '_REF_PROMO_CENT') srv.bono_cent = srv.ref_promo_cent
if (srv.ref_cent) srv.ref_cent = String(Math.round(parseFloat(srv.ref_cent) * 100))

/* La fecha-hora de fin del «invita y gana» sale de la fecha, no de otro literal. */
if (!/^_REF_PROMO_HASTA = datetime\.fromisoformat\(_REF_PROMO_HASTA_DIA\)/m.test(servidor)) {
  fallo('server.py: _REF_PROMO_HASTA tiene que salir de _REF_PROMO_HASTA_DIA (una sola fecha que cambiar)')
}

const fr = {
  gratis_hasta: unaVez(web, /^export const GRATIS_SIN_LIMITE_HASTA = '(\d{4}-\d{2}-\d{2})'/gm, 'precios.js'),
  ref_promo_hasta: unaVez(web, /^export const REF_PROMO_HASTA = '(\d{4}-\d{2}-\d{2})'/gm, 'precios.js'),
  ref_promo_cent: unaVez(web, /^export const REF_PROMO_CENT = (\d+)/gm, 'precios.js'),
  bono_cent: unaVez(web, /^export const BONO_CENT = (\d+)/gm, 'precios.js'),
  paradas_gratis: unaVez(web, /^export const PARADAS_GRATIS = (\d+)/gm, 'precios.js'),
  ref_cent: unaVez(web, /^export const REF_CENT = (\d+)/gm, 'precios.js'),
}

for (const k of Object.keys(srv)) {
  if (srv[k] == null || fr[k] == null) continue       // ya se ha avisado arriba
  if (srv[k] !== fr[k]) fallo(`${k}: el servidor dice ${srv[k]} y la web ${fr[k]}`)
}

if (fallos) { console.error(`check-promo: ${fallos} fallo(s)`); process.exit(1) }
console.log(`check-promo: servidor y web de acuerdo (gratis hasta ${srv.gratis_hasta}, invita y gana hasta ${srv.ref_promo_hasta}, ${Object.keys(srv).length} valores)`)
