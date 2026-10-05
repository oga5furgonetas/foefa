// SPOT «TIPO TELE» (05-10-2026): locución neuronal + planos de archivo (Pexels, licencia comercial)
// + la app real + subtítulos + música sintetizada. Sin testimonios ni cifras inventadas.
//   node scripts/montar-spot-tele.mjs      → docs/anuncios/reales/salida/spot-tele-{9x16,4x5,1x1}.mp4
// Requiere: docs/anuncios/reales/stock/*.mp4 (Pexels), docs/anuncios/reales/spot/vo1..7.mp3 (edge-tts)
// y frontend/test-results/spot-material/es.webm + es.json (grabación limpia de la app).
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FF = process.env.FFMPEG || path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe')
const RAIZ = process.cwd()
const STOCK = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'stock')
const SPOT = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida')
const APP = path.join(RAIZ, 'frontend', 'test-results', 'spot-material')
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spot-'))
const BS = String.fromCharCode(92), NL = String.fromCharCode(10)
const FUENTE = `C${BS}:/Windows/Fonts/arialbd.ttf`
const esc = (p) => p.split(BS).join('/').split(':').join(BS + ':').split("'").join(BS + "'")
const run = (args) => execFileSync(FF, ['-y', '-v', 'error', ...args], { stdio: 'inherit' })
const marcas = JSON.parse(fs.readFileSync(path.join(APP, 'es.json'), 'utf8')).marcas

// La locución: cuándo empieza cada frase y qué se lee en pantalla.
const VO = [
  [0.3, 'Seis de la mañana.' + NL + 'La furgoneta, cargada.'],
  [5.6, 'Y tú, con una libreta,' + NL + 'ordenando la ruta a mano.'],
  [10.2, 'Hay otra forma.'],
  [12.7, 'Con FDS haces una foto' + NL + 'a la etiqueta y la dirección' + NL + 'entra sola.'],
  [18.2, 'La app ordena las paradas' + NL + 'y te guía por voz' + NL + 'hasta cada puerta.'],
  [23.7, 'Más tiempo repartiendo.' + NL + 'Menos tiempo ordenando.'],
]
const FIN = 38.2

// Los planos: [fichero, desde dentro del clip, duración en el spot, inicio en el spot]
const PLANOS = [
  ['pexels-6170595.mp4', 0.0, 5.6, 0],
  ['pexels-6170785.mp4', 1.5, 4.6, 5.6],
  ['pexels-4170839.mp4', 2.0, 2.5, 10.2],
  ['pexels-6868197.mp4', 0.0, 5.3, 23.7],
]
const FONDO_FINAL = ['pexels-6405956.mp4', 3.0]

// 1. Cada plano de archivo → vertical 1080x1920 con un empuje lento y tono unificado.
const clips = []
PLANOS.forEach(([f, ss, d, t0], i) => {
  const out = path.join(tmp, `p${i}.mp4`)
  run(['-ss', String(ss), '-t', String(d + 0.2), '-i', path.join(STOCK, f), '-an',
    '-vf', `scale=1296:2304:force_original_aspect_ratio=increase,crop=1080:1920:x='(iw-1080)/2':y='(ih-1920)/2',scale=w='1080*(1+0.05*t/${d})':h=-2:eval=frame,crop=1080:1920,fps=30,eq=contrast=1.06:saturation=1.08,vignette=PI/6,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', out])
  clips.push({ out, t0, d })
})

// 2. La app dentro de un móvil, sobre un fondo de marca (12.7 – 23.7).
const fondo = path.join(tmp, 'fondo.mp4')
run(['-f', 'lavfi', '-i', 'color=c=0x061a1f:s=1080x1920:r=30:d=11.2', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', fondo])
const m = (i) => marcas[i].t
const appSeg = (ss, d, nombre) => {
  const out = path.join(tmp, nombre)
  run(['-ss', String(ss), '-t', String(d), '-i', appMp4, '-an',
    '-vf', 'scale=640:1138:flags=lanczos,pad=680:1178:20:20:color=0x0b0f14,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', out])
  return out
}
// El .webm de Playwright no se corta bien por tiempo: primero a mp4 de 30 fps constantes.
const appMp4 = path.join(tmp, 'app30.mp4')
run(['-i', path.join(APP, 'es.webm'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', appMp4])
const a1 = appSeg(m(1) + 0.2, 2.7, 'a1.mp4')    // la foto / pedido nuevo
const a2 = appSeg(m(2) + 0.1, 2.9, 'a2.mp4')    // el mapa con la ruta
const a3 = appSeg(m(3) + 0.1, 5.6, 'a3.mp4')    // la navegación y la entrega
const lista = path.join(tmp, 'app.txt')
fs.writeFileSync(lista, [a1, a2, a3].map((f) => `file '${f.split(BS).join('/')}'`).join(NL) + NL)
const appJunto = path.join(tmp, 'app-junto.mp4')
run(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', appJunto])

// 3. Final: plano oscurecido + oferta (31.5 – 38.2).
const finalBg = path.join(tmp, 'final.mp4')
run(['-ss', String(FONDO_FINAL[1]), '-t', '7', '-i', path.join(STOCK, FONDO_FINAL[0]), '-an',
  '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.28:contrast=1.0,gblur=sigma=4,fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', finalBg])

// 4. Locución y música.
const entradasAudio = []
VO.forEach(([t], i) => entradasAudio.push(['-i', path.join(SPOT, `vo${i + 1}.mp3`), t]))
entradasAudio.push(['-i', path.join(SPOT, 'vo7.mp3'), 31.0])
const musica = path.join(tmp, 'musica.wav')
const pad = (f) => `0.07*sin(2*PI*${f}*t)*(0.6+0.4*sin(2*PI*0.2*t))`
const expr = `${pad(110)}+${pad(164.8)}+${pad(220)}+${pad(277.2)}+0.35*sin(2*PI*55*t)*exp(-9*(t-0.6*floor(t/0.6)))`
run(['-f', 'lavfi', '-i', `aevalsrc=${expr}|${expr}:s=44100:d=${FIN + 1}`, '-af', `lowpass=f=1600,afade=t=in:d=2,afade=t=out:st=${FIN - 2.5}:d=2.5,volume=0.8`, musica])

// 5. Composición: planos + app sobre el fondo + textos, todo con overlay y enable.
const textos = (arr) => arr.map(([t, txt, a, b, y = 1380, size = 64]) => {
  const f = path.join(tmp, `t${a}.txt`); fs.writeFileSync(f, txt)
  return `drawtext=fontfile='${FUENTE}':textfile='${esc(f)}':fontsize=${size}:fontcolor=white:borderw=4:bordercolor=black@0.9:box=1:boxcolor=black@0.38:boxborderw=20:line_spacing=12:x=(w-text_w)/2:y=${y}:enable='between(t,${a},${b})'`
}).join(',')
const subs = VO.map(([t, txt], i) => [i, txt, t + 0.05, t + [4.9, 4.3, 2.1, 5.2, 5.1, 4.9][i] + 0.1])
const final = path.join(tmp, 'spot.mp4')
const inputs = ['-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=30:d=${FIN}`]
clips.forEach((c) => inputs.push('-i', c.out))
inputs.push('-i', fondo, '-i', appJunto, '-i', finalBg)
entradasAudio.forEach((a) => inputs.push(a[0], a[1]))
inputs.push('-i', musica)
const nClips = clips.length
const iFondo = 1 + nClips, iApp = iFondo + 1, iFinal = iApp + 1
const iVo0 = iFinal + 1
let cadena = '[0:v]null[v0];'
let etiqueta = 'v0'
clips.forEach((c, i) => {
  const sig = `v${i + 1}`
  cadena += `[${1 + i}:v]setpts=PTS-STARTPTS+${c.t0}/TB[s${i}];[${etiqueta}][s${i}]overlay=0:0:enable='between(t,${c.t0},${(c.t0 + c.d).toFixed(2)})'[${sig}];`
  etiqueta = sig
})
// fondo + app
cadena += `[${iFondo}:v]setpts=PTS-STARTPTS+12.7/TB[sf];[${etiqueta}][sf]overlay=0:0:enable='between(t,12.7,23.9)'[vf];` +
  `[${iApp}:v]setpts=PTS-STARTPTS+12.7/TB[sa];[vf][sa]overlay=x=200:y=190:enable='between(t,12.7,23.9)'[va];` +
  `[${iFinal}:v]setpts=PTS-STARTPTS+31.2/TB[sg];[va][sg]overlay=0:0:enable='between(t,31.2,${FIN})'[vg];[vg]`
// textos de la locución, rótulos y la oferta
const oferta = textos([
  [0, 'Pruébala 7 días gratis', 31.9, FIN, 760, 92],
  [0, 'Sin tarjeta', 32.2, FIN, 900, 76],
  [0, 'flotadsp.com/repartidores', 32.6, FIN, 1100, 62],
  [0, 'FDS', 31.5, FIN, 560, 150],
])
cadena += `${textos(subs.map(([, txt, a, b]) => [0, txt, a.toFixed(2), b.toFixed(2)]))},${oferta}[vout];`
// audio: voces retrasadas + música
const delays = entradasAudio.map((a, i) => `[${iVo0 + i}:a]adelay=${Math.round(a[2] * 1000)}|${Math.round(a[2] * 1000)},volume=1.6[vo${i}]`).join(';')
const iMus = iVo0 + entradasAudio.length
cadena += `${delays};${entradasAudio.map((_, i) => `[vo${i}]`).join('')}amix=inputs=${entradasAudio.length}:normalize=0[voz];` +
  `[${iMus}:a]volume=0.55[mus];[voz][mus]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-15:TP=-1.5:LRA=9[aud]`
run([...inputs, '-filter_complex', cadena, '-map', '[vout]', '-map', '[aud]', '-t', String(FIN), '-r', '30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final])

// 6. Formatos.
const v = (sufijo, vf) => {
  const dest = path.join(SALIDA, `spot-tele-${sufijo}.mp4`)
  run(['-i', final, ...(vf ? ['-vf', vf] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-c:a', 'copy', '-movflags', '+faststart', dest])
  console.log('→', dest)
}
v('9x16', null)
v('4x5', 'crop=1080:1350:0:285')
v('1x1', 'crop=1080:1080:0:420')
fs.rmSync(tmp, { recursive: true, force: true })
