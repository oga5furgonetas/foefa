// SPOT V2 «COMO PARA LA TELE» (14-10-2026). Metraje de archivo (Pexels, licencia comercial) con corrección de
// color y empuje lento, la APP REAL dentro de un móvil que flota sobre un fondo de marca, títulos animados,
// transiciones, locución neuronal (edge-tts), música propia (numpy) con ducking bajo la voz, y tarjetas de
// oferta, premio y cierre. Sin testimonios ni cifras inventadas: la app se ve haciendo lo que hace.
//   node scripts/montar-spot-v2.mjs   → docs/anuncios/reales/salida/spot-v2-{9x16,4x5,1x1}.mp4
// Necesita: scripts/spot-v2/{tarjetas.mjs,voz.py,musica.py} ya ejecutados y frontend/test-results/spot-v2/es.webm+es.json
// (npx playwright test spot-v2 --project=escritorio --update-snapshots).
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FF = process.env.FFMPEG || ['ffmpeg', path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe')]
  .find((f) => { try { execFileSync(f, ['-version'], { stdio: 'ignore' }); return true } catch { return false } })
const STOCK = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'stock')
const V2 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v2')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida')
const APP = path.join(RAIZ, 'frontend', 'test-results', 'spot-v2')
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotv2-'))
const run = (args) => execFileSync(FF, ['-y', '-v', 'error', '-nostdin', ...args], { stdio: 'inherit' })
const W = 1080, H = 1920, FPS = 30
const sl = (p) => p.split(String.fromCharCode(92)).join('/')

const marcas = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(APP, 'es.json'), 'utf8')).marcas.map((m) => [m.texto, m.t]))
const voz = JSON.parse(fs.readFileSync(path.join(V2, 'voz.json'), 'utf8'))
const vd = (n) => voz[n - 1].dur

// ── El guion: escenas con su duración, y las transiciones entre ellas ─────────────────────────────
const ESCENAS = [
  { id: 'gancho', d: 5.2, tr: ['fade', 0.5] },
  { id: 'problema', d: 3.8, tr: ['fadeblack', 0.4] },
  { id: 'marca', d: 1.5, tr: ['smoothup', 0.5] },
  { id: 'movil', d: 15.6, tr: ['smoothleft', 0.5] },
  { id: 'oferta', d: 5.4, tr: ['smoothleft', 0.4] },
  { id: 'gana', d: 5.6, tr: ['fade', 0.4] },
  { id: 'cierre', d: 5.2, tr: null },
]
// Dónde empieza cada escena en el vídeo final (las transiciones solapan).
let acum = 0
for (const e of ESCENAS) { e.t0 = acum; acum += e.d - (e.tr ? e.tr[1] : 0) }
const FIN = acum
const T = Object.fromEntries(ESCENAS.map((e) => [e.id, e.t0]))
console.log('duración', FIN.toFixed(1), 's; escenas', ESCENAS.map((e) => `${e.id}@${e.t0.toFixed(1)}`).join(' '))

// ── Utilidades de capas ───────────────────────────────────────────────────────────────────────────
// Un PNG como capa animada (entrada con fundido y deslizamiento) sobre un vídeo base.
const capa = (base, png, { desde, hasta, dy = 40, fundido = 0.45 }, out) => {
  const d = hasta - desde
  run(['-i', base, '-loop', '1', '-t', String(d), '-i', png, '-filter_complex',
    `[1:v]format=rgba,fade=t=in:st=0:d=${fundido}:alpha=1,fade=t=out:st=${Math.max(0, d - 0.3).toFixed(2)}:d=0.3:alpha=1,setpts=PTS-STARTPTS+${desde}/TB[c];` +
    `[0:v][c]overlay=x=0:y='${dy}*(1-min(1,(t-${desde})/${fundido}))':enable='between(t,${desde},${hasta})':eof_action=pass[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out])
}
// Un plano de archivo: vertical, empuje lento, color de cine (teal/naranja suave, viñeta).
const plano = (fichero, ss, d, out, zoom = 0.06) => {
  run(['-ss', String(ss), '-t', String(d + 0.3), '-i', path.join(STOCK, fichero), '-an', '-filter_complex',
    `[0:v]scale=${W * 1.2}:${H * 1.2}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
    `scale=w='iw*(1+${zoom}*min(1,t/${d}))':h=-2:eval=frame,crop=${W}:${H},fps=${FPS},` +
    `eq=contrast=1.07:saturation=1.12:brightness=-0.03,colorbalance=rs=0.03:bs=-0.03:rm=0.02:bm=-0.04:gs=0.0,` +
    `vignette=angle=PI/4.2,unsharp=5:5:0.4,format=yuv420p,trim=duration=${d},setpts=PTS-STARTPTS[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', out])
}
// Una tarjeta (PNG opaco) con un zoom muy lento, como vídeo.
// (zoompan y no scale con `t`: una imagen en bucle no trae tiempos y scale daba tamaños inválidos.)
const tarjeta = (png, d, out, zoom = 0.035) => {
  run(['-loop', '1', '-framerate', String(FPS), '-t', String(d), '-i', png, '-filter_complex',
    `[0:v]zoompan=z='1+${zoom}*min(1,on/${Math.round(d * FPS)})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${d},setpts=PTS-STARTPTS[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', out])
}

// ── 1. Gancho y problema (archivo + texto grande) ─────────────────────────────────────────────────
const g0 = path.join(tmp, 'gancho0.mp4'); plano('pexels-6170595.mp4', 0.3, 5.2, g0)
const g1 = path.join(tmp, 'gancho.mp4'); capa(g0, path.join(V2, 'gancho1.png'), { desde: 1.9, hasta: 5.2 }, g1)
const p0 = path.join(tmp, 'problema0.mp4'); plano('pexels-5054368.mp4', 2.0, 3.8, p0, 0.08)
const p1 = path.join(tmp, 'problema.mp4'); capa(p0, path.join(V2, 'gancho2.png'), { desde: 0.3, hasta: 3.8 }, p1)

// ── 2. La marca (revelación con escala) ───────────────────────────────────────────────────────────
const marca = path.join(tmp, 'marca.mp4')
run(['-loop', '1', '-framerate', String(FPS), '-t', '1.5', '-i', path.join(V2, 'marca.png'), '-filter_complex',
  `[0:v]zoompan=z='1.16-0.16*min(1,on/14)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},fade=t=in:st=0:d=0.25,format=yuv420p,trim=duration=1.5,setpts=PTS-STARTPTS[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', marca])

// ── 3. El móvil con la app real ───────────────────────────────────────────────────────────────────
// La grabación de Playwright (webm, fps variable) → mp4 a 30 fps constantes para poder cortarla por tiempo.
const app30 = path.join(tmp, 'app30.mp4')
run(['-i', path.join(APP, 'es.webm'), '-vf', `fps=${FPS},scale=720:1280,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', app30])
const seg = (ss, d, nombre) => {
  const out = path.join(tmp, nombre)
  run(['-ss', String(Math.max(0, ss)), '-t', String(d), '-i', app30, '-an', '-vf', `fps=${FPS},format=yuv420p,trim=duration=${d},setpts=PTS-STARTPTS`, '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', out])
  return out
}
const TRAMOS = [
  { d: 4.2, ss: marcas.etiqueta - 0.7, titulo: 'titulo1.png' },
  { d: 4.4, ss: marcas.mapa - 0.5, titulo: 'titulo2.png' },
  { d: 3.6, ss: marcas.entregado - 2.3, titulo: 'titulo3.png' },
  { d: 3.4, ss: marcas.dinero - 0.5, titulo: 'titulo4.png' },
]
const segs = TRAMOS.map((t, i) => seg(t.ss, t.d, `seg${i}.mp4`))
const lista = path.join(tmp, 'segs.txt')
fs.writeFileSync(lista, segs.map((f) => `file '${sl(f)}'`).join('\n') + '\n')
const appJunto = path.join(tmp, 'app-junto.mp4')
run(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', appJunto])
const DM = TRAMOS.reduce((a, t) => a + t.d, 0)
// Fondo + móvil (bisel y app recortada a la pantalla), flotando: giro y vaivén suaves.
const movil0 = path.join(tmp, 'movil0.mp4')
run(['-loop', '1', '-t', String(DM), '-i', path.join(V2, 'fondo.png'),
  '-loop', '1', '-t', String(DM), '-i', path.join(V2, 'telefono.png'),
  '-i', appJunto, '-loop', '1', '-t', String(DM), '-i', path.join(V2, 'mascara.png'),
  '-filter_complex',
  `[3:v]crop=720:1280:180:320,format=gray[m];[2:v]format=rgba[a];[a][m]alphamerge[ar];` +
  `[1:v]format=rgba[tel];[tel][ar]overlay=180:320:format=auto[ph];` +
  `[ph]rotate='0.016*sin(2*PI*t/7.5)':c=none:ow=iw:oh=ih,scale=w='iw*(1.00+0.025*sin(2*PI*t/11))':h=-1:eval=frame[phr];` +
  `[0:v]fps=${FPS}[bg];[bg][phr]overlay=x='(W-w)/2+12*sin(2*PI*t/9)':y='(H-h)/2+10*sin(2*PI*t/6)':eval=frame:format=auto,format=yuv420p,trim=duration=${DM},setpts=PTS-STARTPTS[v]`,
  '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', movil0])
// Los títulos de cada tramo.
let movil = movil0
let tAcum = 0
TRAMOS.forEach((t, i) => {
  const out = path.join(tmp, `movil${i + 1}.mp4`)
  capa(movil, path.join(V2, t.titulo), { desde: tAcum + 0.15, hasta: tAcum + t.d - 0.05, dy: -30 }, out)
  movil = out
  tAcum += t.d
})

// ── 4. Tarjetas ───────────────────────────────────────────────────────────────────────────────────
const oferta = path.join(tmp, 'oferta.mp4'); tarjeta(path.join(V2, 'oferta.png'), 5.4, oferta)
const gana = path.join(tmp, 'gana.mp4'); tarjeta(path.join(V2, 'gana.png'), 5.6, gana)
const cierre = path.join(tmp, 'cierre.mp4'); tarjeta(path.join(V2, 'cierre.png'), 5.2, cierre, 0.02)

// ── 5. Transiciones (xfade encadenado) ────────────────────────────────────────────────────────────
const ficheros = { gancho: g1, problema: p1, marca, movil, oferta, gana, cierre }
const inputs = []
ESCENAS.forEach((e) => inputs.push('-i', ficheros[e.id]))
let cadena = ''
let prev = '0:v'
let offset = 0
ESCENAS.forEach((e, i) => {
  if (!e.tr) return
  offset += e.d - e.tr[1]
  const sal = i === ESCENAS.length - 2 ? 'vx' : `x${i}`
  cadena += `[${prev}][${i + 1}:v]xfade=transition=${e.tr[0]}:duration=${e.tr[1]}:offset=${offset.toFixed(3)}[${sal}];`
  prev = sal
})
const video = path.join(tmp, 'video.mp4')
run([...inputs, '-filter_complex', cadena.replace(/;$/, ''), '-map', '[vx]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', video])

// ── 6. Locución y música (ducking bajo la voz) ────────────────────────────────────────────────────
const VO = [
  [1, T.gancho + 0.35], [2, T.problema + 0.15], [3, T.movil + 0.1], [4, T.movil + 4.3], [5, T.movil + 8.7], [6, T.movil + 12.3],
  [7, T.oferta + 0.15], [8, T.gana + 0.15], [9, T.cierre + 0.2],
]
const aIn = ['-i', video]
VO.forEach(([n]) => aIn.push('-i', path.join(V2, `vo${n}.mp3`)))
aIn.push('-i', path.join(V2, 'musica.wav'))
const iMus = VO.length + 1
const delays = VO.map(([, t], i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=1.0[vo${i}]`).join(';')
const audio = `${delays};${VO.map((_, i) => `[vo${i}]`).join('')}amix=inputs=${VO.length}:normalize=0,alimiter=limit=0.9[voz];` +
  `[${iMus}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${FIN.toFixed(2)},afade=t=out:st=${(FIN - 2.2).toFixed(2)}:d=2.2,volume=0.9[mus];` +
  `[voz]asplit=2[vz1][vz2];[mus][vz2]sidechaincompress=threshold=0.03:ratio=8:attack=25:release=350:makeup=1[musd];` +
  `[vz1][musd]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[aud]`
const final = path.join(tmp, 'final.mp4')
run([...aIn, '-filter_complex', audio, '-map', '0:v', '-map', '[aud]', '-t', FIN.toFixed(2), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final])

// ── 7. Formatos ───────────────────────────────────────────────────────────────────────────────────
const v = (sufijo, vf) => {
  const dest = path.join(SALIDA, `spot-v2-${sufijo}.mp4`)
  run(['-i', final, ...(vf ? ['-vf', vf] : []), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'copy', '-movflags', '+faststart', dest])
  console.log('→', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB')
}
v('9x16', null)
v('4x5', 'crop=1080:1350:0:285')
v('1x1', 'crop=1080:1080:0:420')
fs.rmSync(tmp, { recursive: true, force: true })
