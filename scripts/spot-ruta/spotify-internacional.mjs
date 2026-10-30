// Anuncio de audio de Spotify en los idiomas de la app (30-10-2026): la voz de Artlist de voces/<idioma>/spotify.mp3
// sobre la música del spot v4, a la norma de Spotify (-16 LUFS ±1,5, pico ≤ -2 dBTP, ≤ 30 s, MP3 44,1 kHz 192 kbps).
// Si la voz pasa de 28,5 s se acelera lo justo (hasta un 15 %) para entrar con medio segundo de silencio a cada lado.
//   node scripts/spot-ruta/spotify-internacional.mjs [idioma…]  → docs/anuncios/internacional/spotify/fds-spotify-<idioma>.mp3
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const INT = path.join(RAIZ, 'docs', 'anuncios', 'internacional')
const MUSICA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4', 'musica.wav')
const SALIDA = path.join(INT, 'spotify')
fs.mkdirSync(SALIDA, { recursive: true })
const run = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', ...args], { stdio: 'inherit' })
const leeErr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || ''
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }))
const medir = (f) => {
  const out = leeErr(['-i', f, '-af', 'ebur128=peak=true:framelog=quiet'])
  return { I: parseFloat((out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), tp: parseFloat((out.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1]) }
}
const loudnorm2 = (src, dst, I, TP, LRA, extra = '') => {
  const m = leeErr(['-i', src, '-af', `${extra}loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  run(['-i', src, '-af', `${extra}loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=44100,aformat=channel_layouts=stereo`, dst])
}

const idiomas = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(INT, 'voces')).filter((d) => fs.existsSync(path.join(INT, 'voces', d, 'spotify.mp3')))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotify-'))
const resumen = {}
for (const idioma of idiomas) {
  const voz = path.join(INT, 'voces', idioma, 'spotify.mp3')
  const d0 = dur(voz)
  const ritmo = d0 > 28.5 ? Math.min(1.15, d0 / 28.5) : 1
  const pre = `highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=1.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=1${ritmo > 1 ? `,atempo=${ritmo.toFixed(3)}` : ''},`
  const vozN = path.join(tmp, `voz-${idioma}.wav`)
  loudnorm2(voz, vozN, -16, -2, 7, pre)
  const dv = dur(vozN)
  const total = +(dv + 1.0).toFixed(2)
  if (total > 30) throw new Error(`${idioma}: ${total}s, pasa de 30 s`)
  // Música 11 LU por debajo de la voz mientras habla (sidechain), un poco más alta en el último segundo.
  const mezcla = path.join(tmp, `mezcla-${idioma}.wav`)
  run(['-i', vozN, '-i', MUSICA, '-filter_complex',
    `[0:a]adelay=500|500,apad=pad_dur=0.5,atrim=duration=${total},asplit=2[v1][v2];` +
    `[1:a]aresample=44100,aformat=channel_layouts=stereo,atrim=duration=${total},volume=-13dB,afade=t=in:st=0:d=0.3,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[m];` +
    `[m][v2]sidechaincompress=threshold=0.05:ratio=2.2:attack=40:release=500:makeup=1[md];[v1][md]amix=inputs=2:normalize=0[out]`,
    '-map', '[out]', '-t', String(total), '-c:a', 'pcm_s16le', mezcla])
  const master = path.join(tmp, `master-${idioma}.wav`)
  loudnorm2(mezcla, master, -16, -2, 9)
  const dest = path.join(SALIDA, `fds-spotify-${idioma}.mp3`)
  run(['-i', master, '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', dest])
  const m = medir(dest)
  resumen[idioma] = { voz_s: +d0.toFixed(2), acelerada: ritmo > 1 ? +ritmo.toFixed(3) : 1, total_s: +dur(dest).toFixed(2), lufs: m.I, pico_dbtp: m.tp, mb: +(fs.statSync(dest).size / 1e6).toFixed(2) }
  console.log(idioma, JSON.stringify(resumen[idioma]))
}
fs.writeFileSync(path.join(SALIDA, 'medidas.json'), JSON.stringify(resumen, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
