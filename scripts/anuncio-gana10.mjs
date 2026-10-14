// ANUNCIO «INVITA Y GANA 10 €» (14-10-2026, Dani). Las grabaciones de origen del sketch no están en el
// repo (test-results se limpia), así que se parte de los vídeos ya montados con la tarjeta «GANA 2,50 €»
// (docs/anuncios/reales/salida/meta/FDS-*-gana250-9x16.mp4): se corta esa tarjeta (los últimos 3,9 s)
// y se pega una nueva de 4,5 s con la promoción. Salen 9:16 (Reels/Stories/TikTok) y 4:5 (feed).
// El mínimo de retirada no se dice (lo pidió así); las condiciones completas están en la web.
//   cd frontend && node ../scripts/anuncio-gana10.mjs
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const META = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida', 'meta')
const FFMPEG = ['ffmpeg', path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe')]
  .find((f) => { try { execFileSync(f, ['-version'], { stdio: 'ignore' }); return true } catch { return false } })
const TARJETA_VIEJA = 3.9          // EXTRA_D de montar-sketch-repartidora.mjs
const DURA = 4.5

const html = () => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:1920px; overflow:hidden; font-family:Inter, system-ui, sans-serif; color:#f4fbfb;
    background: radial-gradient(circle at 50% 18%, #0d5a5a 0, #05141a 55%) }
  .caja { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; padding:0 70px; text-align:center }
  .ademas { font:800 54px/1.2 Inter, sans-serif; color:#5eead4 }
  .pildora { background:#FFD43B; color:#1a1300; font:900 150px/1 Inter, sans-serif; border-radius:40px; padding:26px 70px; transform:rotate(-3deg); box-shadow:0 16px 50px rgba(255,212,59,.35) }
  .por { font:800 72px/1.15 Inter, sans-serif; max-width:940px }
  .hasta { font:900 50px/1.2 Inter, sans-serif; color:#14e7d8; margin-top:6px }
  .cobro { font:700 44px/1.3 Inter, sans-serif; color:#d7fff9; max-width:900px }
  .web { font:700 46px/1.2 Inter, sans-serif; color:#a9c2c6; margin-top:14px }
  .peq { font:600 30px/1.3 Inter, sans-serif; color:#a9c2c6; max-width:900px }
</style></head><body><div class="caja">
  <div class="ademas">Y ADEMÁS…</div>
  <div class="pildora">GANA 10 €</div>
  <div class="por">por cada compañero que invites y la use</div>
  <div class="hasta">Promoción hasta el 31 de octubre</div>
  <div class="cobro">Lo cobras por Bizum o transferencia</div>
  <div class="web">flotadsp.com/repartidores</div>
  <div class="peq">Cuenta cuando se registra con tu enlace hasta el 31-10 y hace 20 entregas en 2 días distintos · condiciones en la web</div>
</div></body></html>`

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gana10-'))
const png = path.join(tmp, 'tarjeta.png')
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } })
await pagina.setContent(html(), { waitUntil: 'networkidle' })
await pagina.screenshot({ path: png })
await navegador.close()
fs.copyFileSync(png, path.join(RAIZ, 'docs', 'anuncios', 'tiktok-fotos', 'gana10-9x16.png'))

const dur = (f) => parseFloat(execFileSync(FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
for (const variante of ['directo', 'pov']) {
  const origen = path.join(META, `FDS-${variante}-gana250-9x16.mp4`)
  if (!fs.existsSync(origen)) { console.warn('falta', origen); continue }
  const CORTE = Math.round((dur(origen) - TARJETA_VIEJA) * 10) / 10
  const base = path.join(tmp, `${variante}-9x16.mp4`)
  execFileSync(FFMPEG, ['-y', '-v', 'error',
    '-t', String(CORTE), '-i', origen,
    '-loop', '1', '-t', String(DURA), '-i', png,
    '-f', 'lavfi', '-t', String(DURA), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex',
    `[0:v]scale=1080:1920,setsar=1,fps=30[v0];[1:v]scale=1080:1920,setsar=1,fps=30,fade=t=in:st=0:d=0.3[v1];` +
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st=${CORTE - 0.5}:d=0.5[a0];[2:a]aformat=channel_layouts=stereo[a1];` +
    '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', base])
  const salidas = [[`FDS-${variante}-gana10-9x16.mp4`, null], [`FDS-${variante}-gana10-4x5.mp4`, 'crop=1080:1350:0:285']]
  for (const [nombre, vf] of salidas) {
    const dest = path.join(META, nombre)
    execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', base, ...(vf ? ['-vf', vf] : []), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'copy', '-movflags', '+faststart', dest])
    console.log('ok', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB', 'corte en', CORTE, 's')
  }
}
fs.rmSync(tmp, { recursive: true, force: true })
