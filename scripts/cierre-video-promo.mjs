// CIERRE NUEVO PARA LOS VÍDEOS DE LA APP (11-10-2026). Los vídeos de docs/videos/tiktok-<idioma>.mp4 acaban con
// «GRATIS 7 días», la oferta de antes. La voz de la app (edge-tts) da 403 y no se pueden volver a grabar, así que
// se corta el vídeo justo antes del cierre y se le pega un cierre de 4 s con la oferta de ahora.
// Salen docs/videos/shorts-*.mp4 (vertical, para Shorts/Reels/TikTok).
//   cd frontend && node ../scripts/cierre-video-promo.mjs
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const VIDEOS = path.join(RAIZ, 'docs', 'videos')
const FFMPEG = ['ffmpeg', path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe')]
  .find((f) => { try { execFileSync(f, ['-version'], { stdio: 'ignore' }); return true } catch { return false } })
const DURA = 4
// [vídeo de origen, segundo del corte (justo antes del cierre viejo), idioma del cierre, vídeo de salida]
const VIDEOS_A_CORTAR = [
  ['tiktok-es.mp4', 16.4, 'es', 'shorts-es.mp4'], ['tiktok-pt.mp4', 16.4, 'pt', 'shorts-pt.mp4'],
  ['tiktok-es-llama.mp4', 9.2, 'es', 'shorts-es-llama.mp4'], ['tiktok-pt-llama.mp4', 9.2, 'pt', 'shorts-pt-llama.mp4'],
]

// Lo que dice el cierre en cada idioma (nada que la app no cumpla: ver src/lib/precios.js y Terminos 5 bis).
const CIERRES = {
  es: { gratis: 'GRATIS y sin límite', hasta: 'hasta el 31 de diciembre · sin tarjeta', gana: 'Y gana 2,50 € por cada compañero que la use' },
  pt: { gratis: 'GRÁTIS e sem limite', hasta: 'até 31 de dezembro · sem cartão', gana: 'E ganhe 2,50 € por cada colega que usar' },
}

const html = (c) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:1920px; overflow:hidden; font-family:Inter, system-ui, sans-serif; color:#f4fbfb;
    background: radial-gradient(circle at 50% 18%, #0d5a5a 0, #05141a 55%) }
  .caja { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:34px; padding:0 70px; text-align:center }
  .logo { width:170px; height:170px; border-radius:38px; background:#14e7d8; color:#04121a; font:900 64px/170px Inter, sans-serif }
  .pildora { background:#FFD43B; color:#1a1300; font:900 82px/1.05 Inter, sans-serif; border-radius:34px; padding:22px 46px; transform:rotate(-3deg); box-shadow:0 16px 50px rgba(255,212,59,.35) }
  .hasta { font:800 46px/1.2 Inter, sans-serif; color:#d7fff9 }
  .gana { font:800 44px/1.25 Inter, sans-serif; color:#14e7d8; max-width:900px }
  .web { font:700 44px/1.2 Inter, sans-serif; color:#a9c2c6; margin-top:20px }
</style></head><body><div class="caja">
  <div class="logo">FDS</div>
  <div class="pildora">${c.gratis}</div>
  <div class="hasta">${c.hasta}</div>
  <div class="gana">${c.gana}</div>
  <div class="web">flotadsp.com</div>
</div></body></html>`

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cierre-'))
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [idioma, c] of Object.entries(CIERRES)) {
  await pagina.setContent(html(c), { waitUntil: 'networkidle' })
  await pagina.screenshot({ path: path.join(tmp, `cierre-${idioma}.png`) })
}
for (const [fuente, CORTE, idioma, destino] of VIDEOS_A_CORTAR) {
  const origen = path.join(VIDEOS, fuente)
  if (!fs.existsSync(origen)) continue
  const png = path.join(tmp, `cierre-${idioma}.png`)
  const salida = path.join(VIDEOS, destino)
  // [0] el vídeo hasta el corte (audio con un fundido final); [1] el cierre fijo 4 s, en silencio.
  execFileSync(FFMPEG, ['-y', '-v', 'error',
    '-t', String(CORTE), '-i', origen,
    '-loop', '1', '-t', String(DURA), '-i', png,
    '-f', 'lavfi', '-t', String(DURA), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex',
    `[0:v]scale=1080:1920,setsar=1,fps=30[v0];[1:v]scale=1080:1920,setsar=1,fps=30,fade=t=in:st=0:d=0.3[v1];` +
    `[0:a]aresample=44100,aformat=channel_layouts=stereo,afade=t=out:st=${CORTE - 0.4}:d=0.4[a0];[2:a]aformat=channel_layouts=stereo[a1];` +
    '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', salida])
  console.log('ok', path.relative(RAIZ, salida), (fs.statSync(salida).size / 1e6).toFixed(1), 'MB')
}
await navegador.close()
