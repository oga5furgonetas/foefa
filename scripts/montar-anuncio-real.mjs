// Monta un anuncio a partir de UNA grabación REAL (móvil de una persona de verdad).
//   node scripts/montar-anuncio-real.mjs <video.mp4> [subtitulos.srt] [--sin-cierre]
// Hace: vertical 1080x1920 (rellena y recorta), sonido normalizado, subtítulos grandes
// quemados (el 80 % ve los anuncios sin sonido), tarjeta final de 3 s con la oferta y
// versiones 9:16 (TikTok/Reels), 4:5 (feed de Facebook) y 1:1. Sin música con derechos.
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FF = process.env.FFMPEG || [
  'ffmpeg',
  path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'),
].find((f) => { try { execFileSync(f, ['-version'], { stdio: 'ignore' }); return true } catch { return false } })
if (!FF) throw new Error('No encuentro ffmpeg')

const [entrada, srtArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const sinCierre = process.argv.includes('--sin-cierre')
if (!entrada || !fs.existsSync(entrada)) { console.error('Uso: node scripts/montar-anuncio-real.mjs <video.mp4> [subtitulos.srt]'); process.exit(1) }
const nombre = path.basename(entrada, path.extname(entrada))
const salida = path.join(process.cwd(), 'docs', 'anuncios', 'reales', 'salida')
fs.mkdirSync(salida, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anuncio-'))
const BS = String.fromCharCode(92)
const FUENTE = `C${BS}:/Windows/Fonts/arialbd.ttf`
const srt = srtArg || path.join(path.dirname(entrada), nombre + '.srt')
const run = (args) => execFileSync(FF, ['-y', '-v', 'error', ...args], { stdio: 'inherit' })
const esc = (p) => p.split(BS).join('/').split(':').join(BS + ':').split("'").join(BS + "'")

// 1. Cuerpo: vertical, 30 fps, audio normalizado y subtítulos.
const filtros = ['scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920', 'fps=30', 'format=yuv420p']
if (fs.existsSync(srt)) {
  // El filtro `subtitles` de ffmpeg no encuentra fuentes en Windows y no pinta nada: se dibuja cada línea con drawtext.
  const segs = (n) => { const [h, m, r] = n.trim().replace(',', '.').split(':'); return +h * 3600 + +m * 60 + +r }
  const CR = String.fromCharCode(13), NL = String.fromCharCode(10)
  const bloques = fs.readFileSync(srt, 'utf8').split(CR).join('').split(NL + NL).map((b) => b.trim()).filter(Boolean)
  bloques.forEach((b, k) => {
    const l = b.split(NL); const t = l[1].split('-->')
    const palabras = l.slice(2).join(' ').split(' '); const lineas = []; let cur = ''
    for (const w of palabras) { if ((cur + ' ' + w).trim().length > 20) { lineas.push(cur.trim()); cur = w } else cur += ' ' + w }
    lineas.push(cur.trim())
    const f = path.join(tmp, `sub${k}.txt`); fs.writeFileSync(f, lineas.join(NL))
    filtros.push(`drawtext=fontfile='${FUENTE}':textfile='${esc(f)}':fontsize=66:fontcolor=white:borderw=4:bordercolor=black:box=1:boxcolor=black@0.35:boxborderw=18:line_spacing=10:x=(w-text_w)/2:y=1460:enable='between(t,${segs(t[0])},${segs(t[1])})'`)
  })
} else console.warn('Sin subtítulos (.srt): se monta sin ellos. Mejor con ellos.')
const cuerpo = path.join(tmp, 'cuerpo.mp4')
run(['-i', entrada, '-vf', filtros.join(','), '-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', cuerpo])

// 2. Tarjeta final (oferta clara, sin promesas que la app no cumpla).
let final = cuerpo
if (!sinCierre) {
  const cierre = path.join(tmp, 'cierre.mp4')
  const t = (txt, y, size, color) => `drawtext=fontfile='${FUENTE}':text='${txt}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`
  run(['-f', 'lavfi', '-i', 'color=c=0x061a1f:s=1080x1920:r=30:d=3', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', [t('FDS', 640, 150, '0x14e7d8'), t('Prueba la app 7 días gratis', 860, 62, 'white'), t('Sin tarjeta', 950, 62, 'white'),
      t('flotadsp.com/repartidores', 1180, 52, '0xffd43b')].join(','),
    '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', cierre])
  final = path.join(tmp, 'completo.mp4')
  fs.writeFileSync(path.join(tmp, 'lista.txt'), `file '${cuerpo.split(BS).join('/')}'\nfile '${cierre.split(BS).join('/')}'\n`)
  run(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'lista.txt'), '-c', 'copy', final])
}

// 3. Formatos: 9:16 tal cual; 4:5 y 1:1 recortando por el centro (los subtítulos caen dentro).
const v = (sufijo, vf) => {
  const dest = path.join(salida, `${nombre}-${sufijo}.mp4`)
  run(['-i', final, ...(vf ? ['-vf', vf] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-c:a', 'copy', '-movflags', '+faststart', dest])
  console.log('→', dest)
}
v('9x16', null)
v('4x5', 'crop=1080:1350:0:285')
v('1x1', 'crop=1080:1080:0:420')
fs.rmSync(tmp, { recursive: true, force: true })
