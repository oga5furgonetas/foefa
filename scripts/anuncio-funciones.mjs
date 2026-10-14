// IMAGEN «LO QUE HACE LA APP» PARA EL ANUNCIO (14-10-2026). Dani: el anuncio tiene que decir de qué va la
// app y qué hace, no solo el premio. Una tarjeta 4:5 (feed) y otra 9:16 (historias/reels) con las funciones
// reales (nada que la app no haga: ver src/pages/Repartidores.jsx VENTAJAS) y la promoción.
//   cd frontend && node ../scripts/anuncio-funciones.mjs
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'tiktok-fotos')

const FUNCIONES = [
  ['📸', 'Foto a la etiqueta', 'la dirección y el teléfono entran solos'],
  ['🗺️', 'Ruta ordenada sola', 'todas tus paradas por tiempo, con el tráfico'],
  ['🔊', 'Voz hasta cada puerta', 'y manos libres: di «entregado» y sigue'],
  ['📋', 'La hoja de reparto, en una foto', 'entran todas las paradas de golpe'],
  ['💶', 'Cuánto llevas ganado hoy', 'y lo que se va en gasolina'],
]

const html = (alto) => { const g = alto > 1500; return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:${alto}px; overflow:hidden; font-family:Inter, system-ui, sans-serif; color:#f4fbfb;
    background: radial-gradient(circle at 50% 12%, #0d5a5a 0, #05141a 58%) }
  .caja { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:${g ? 30 : 13}px; padding:${g ? 60 : 36}px ${g ? 70 : 60}px }
  .nueva { align-self:flex-start; background:#FFD43B; color:#1a1300; font:900 ${g ? 34 : 27}px/1 Inter, sans-serif; border-radius:16px; padding:${g ? 14 : 11}px 22px; letter-spacing:.04em }
  h1 { font:900 ${g ? 78 : 58}px/1.04 Inter, sans-serif; letter-spacing:-.02em }
  h1 span { color:#14e7d8 }
  .sub { font:700 ${g ? 36 : 29}px/1.3 Inter, sans-serif; color:#d7fff9 }
  .lista { display:flex; flex-direction:column; gap:${g ? 20 : 9}px; margin-top:4px }
  .f { display:flex; align-items:center; gap:20px; background:rgba(255,255,255,.07); border:2px solid rgba(20,231,216,.25); border-radius:22px; padding:${g ? 20 : 11}px 24px }
  .f .i { font-size:${g ? 52 : 40}px; width:${g ? 70 : 56}px; text-align:center }
  .f b { display:block; font:800 ${g ? 36 : 30}px/1.15 Inter, sans-serif }
  .f small { display:block; font:600 ${g ? 28 : 24}px/1.25 Inter, sans-serif; color:#a9c2c6; margin-top:3px }
  .gratis { background:#14e7d8; color:#04121a; font:900 ${g ? 40 : 32}px/1.15 Inter, sans-serif; border-radius:22px; padding:${g ? 20 : 14}px 28px; text-align:center }
  .gana { background:#FFD43B; color:#1a1300; font:900 ${g ? 44 : 36}px/1.15 Inter, sans-serif; border-radius:22px; padding:${g ? 22 : 15}px 28px; text-align:center; transform:rotate(-1.5deg); box-shadow:0 14px 40px rgba(255,212,59,.3) }
  .gana small { display:block; font:700 ${g ? 26 : 22}px/1.3 Inter, sans-serif; margin-top:6px; transform:none }
  .web { font:700 ${g ? 38 : 30}px/1.2 Inter, sans-serif; color:#a9c2c6; text-align:center }
</style></head><body><div class="caja">
  <div class="nueva">APP NUEVA PARA REPARTIDORES</div>
  <h1>Tu ruta de reparto, <span>ordenada sola</span></h1>
  <div class="sub">Lo que hoy haces a mano, lo hace la app:</div>
  <div class="lista">${FUNCIONES.map(([i, t, s]) => `<div class="f"><div class="i">${i}</div><div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>
  <div class="gratis">GRATIS y sin límite hasta el 31 de diciembre · sin tarjeta</div>
  <div class="gana">GANA 10 € por cada compañero que invites y la use<small>promoción hasta el 31 de octubre · cuenta con 20 entregas en 2 días · condiciones en la web</small></div>
  <div class="web">flotadsp.com/repartidores</div>
</div></body></html>` }

const navegador = await chromium.launch()
for (const [nombre, alto] of [['funciones-4x5.png', 1350], ['funciones-9x16.png', 1920]]) {
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: alto } })
  await pagina.setContent(html(alto), { waitUntil: 'networkidle' })
  const destino = path.join(SALIDA, nombre)
  await pagina.screenshot({ path: destino })
  console.log('ok', path.relative(RAIZ, destino), (fs.statSync(destino).size / 1024).toFixed(0), 'KB')
  await pagina.close()
}
await navegador.close()
