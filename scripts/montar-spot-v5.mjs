// SPOT V5 (24-10-2026). Dani sobre el v4: «mejorable: las transiciones, las imágenes de la app; busca una voz
// que no sea robótica; cuida el volumen de los sonidos, sé meticuloso». Cambios:
//   · Un DÍA DE REPARTO de verdad (15 paradas en calles reales de A Coruña, ruta por carretera, hora de cada
//     parada), no tres paradas de juguete. La lista ordenada baja con sus horas y el mapa se acerca a la ruta.
//   · Transiciones encadenadas (zoom al pasar a la foto, destello del obturador, deslizamientos) en vez de cortes.
//   · Etiqueta arriba con la función que se ve («Ruta ordenada sola», «Te guía con voz»…).
//   · Voz de Gemini TTS (entona como una persona), leída de una vez y cortada por frases. Los subtítulos van al
//     tiempo REAL de cada palabra (scripts/spot-v5/alinear.py, faster-whisper), no al reparto por sílabas.
//   · 4x5 y 1x1 con la pantalla entera en el centro (recortar el 9x16 dejaba fuera píldoras y botones).
//   · Sonido MEDIDO: cada pieza a un nivel objetivo calculado de su sonoridad (LUFS) y su pico, la música
//     agachándose bajo la voz, y el máster a -14 LUFS en modo lineal (no cambia el equilibrio). Al final se
//     comprueba la mezcla: la voz por encima de todo y ningún efecto por encima de la voz.
//   VOZ=Achird node scripts/montar-spot-v5.mjs  → docs/anuncios/reales/salida/spot-v5-{9x16,4x5,1x1}.mp4
// Necesita: e2e/spot-v5.spec.js (--update-snapshots), scripts/spot-v5/{voz_gemini.py,alinear.py,capas.mjs} y lo del v4
// (scripts/spot-v4/{etiqueta,capas}.mjs, sonido.py).
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const V4 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
const V5 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v5')
const STOCK = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'stock')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida')
const GRAB = path.join(RAIZ, 'frontend', 'test-results', 'spot-v5')
const VOZ = process.env.VOZ || 'Achird'
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotv5-'))
const run = (args, cwd) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', ...args], { stdio: 'inherit', cwd })
// Lo que ffmpeg escribe en stderr (medidas de sonoridad, picos…), haya ido bien o no.
const leeErr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || ''
const W = 1080, H = 1920, FPS = 30, AH = 2340
const sl = (p) => p.split(String.fromCharCode(92)).join('/')
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS)]

// ── La grabación → vídeo de 30 fps ───────────────────────────────────────────────────────────────
const grab = JSON.parse(fs.readFileSync(path.join(GRAB, 'marcas.json'), 'utf8'))
const T0 = grab.frames[0].t
const M = {}
for (const m of grab.marcas) M[m.texto] = { ...m, t: m.t - T0 }
fs.writeFileSync(path.join(tmp, 'frames.txt'), grab.frames.map((f, i) => {
  const sig = grab.frames[i + 1] ? grab.frames[i + 1].t : f.t + 0.5
  return `file '${sl(path.join(GRAB, 'frames', f.f))}'\nduration ${Math.max(0.001, sig - f.t).toFixed(4)}`
}).join('\n') + `\nfile '${sl(path.join(GRAB, 'frames', grab.frames.at(-1).f))}'\n`)
const app = path.join(tmp, 'app.mp4')
run(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'frames.txt'), '-vf', `fps=${FPS},scale=1080:-2,crop=1080:${AH}:0:0,format=yuv420p`, ...enc, app])

// ── La voz ───────────────────────────────────────────────────────────────────────────────────────
const voz = JSON.parse(fs.readFileSync(path.join(V5, 'voces', VOZ, 'voz.json'), 'utf8')).frases
const vd = (n) => voz[n - 1].dur

// ── Escenas y transiciones ───────────────────────────────────────────────────────────────────────
// tr: transición HACIA la siguiente escena [tipo, duración]. app: a = inicio en la grabación, vel = velocidad.
const S = [
  { id: 'gancho', tipo: 'stock', d: +(vd(1) + 0.75).toFixed(2), tr: ['zoomin', 0.32] },
  { id: 'camara', tipo: 'camara', d: 1.0, tr: ['fadewhite', 0.24] },
  { id: 'form', tipo: 'app', a: M.leido.t - 0.05, d: Math.max(2.6, vd(2) + 0.25 - 0.76), fx: 540, fy: 760, z0: 1.0, z1: 1.05, et: 'foto', tr: ['slideup', 0.3] },
  { id: 'ordenar', tipo: 'app', a: M.tap_ordenar.t - 0.4, d: 2.5, fx: 540, fy: 1100, z0: 1.0, z1: 1.04, toques: ['tap_ordenar'], et: 'ordenar', tr: ['smoothup', 0.26] },
  { id: 'lista', tipo: 'app', a: M.baja_lista.t + 0.1, d: 2.1, vel: 1.6, fx: 540, fy: 1170, z0: 1.0, z1: 1.0, et: 'horas', tr: ['smoothleft', 0.3] },
  // El mapa a pantalla completa: zoom hasta que la tarjeta del mapa llena el encuadre.
  { id: 'mapa', tipo: 'app', a: M.mapa.t + 0.2, d: 2.2, fx: 640, fy: 1385, z0: 1.72, z1: 1.95, et: 'mapa', tr: ['zoomin', 0.3] },
  // La etiqueta, debajo de la tarjeta verde del giro (encima la tapaba).
  { id: 'navega', tipo: 'app', a: M.navegacion.t + 0.25, d: 2.8, vel: 2.3, fx: 540, fy: 880, z0: 1.0, z1: 1.08, et: 'voz', etDy: 330, tr: ['slideup', 0.26] },
  { id: 'entregado', tipo: 'app', a: M.tap_entregado.t + 0.35, d: 2.0, fx: 540, fy: 1700, z0: 1.0, z1: 1.03, toques: ['tap_sin_foto'], et: 'entregado', tr: ['circleopen', 0.36] },
  { id: 'oferta', tipo: 'tarjeta', d: +(vd(5) + 0.85).toFixed(2), png: path.join(V4, 'oferta.png'), fondo: M.lista_abajo.t, tr: ['smoothup', 0.36] },
  { id: 'cierre', tipo: 'tarjeta', d: +(vd(6) + 1.7).toFixed(2), png: path.join(V4, 'cierre.png'), fondoPng: path.join(V4, 'fondo-marca.png') },
]
let acum = 0
for (const e of S) { e.d = +e.d.toFixed(3); e.t0 = +acum.toFixed(3); acum += e.d - (e.tr ? e.tr[1] : 0) }
const FIN = +acum.toFixed(2)
const T = Object.fromEntries(S.map((e) => [e.id, e.t0]))
// Momento central de cada transición (ahí va el barrido).
const TRANS = S.filter((e) => e.tr).map((e) => ({ de: e.id, t: e.t0 + e.d - e.tr[1] / 2, tipo: e.tr[0] }))
console.log('voz', VOZ, '· duración', FIN, 's ·', S.map((e) => `${e.id}@${e.t0.toFixed(2)}`).join(' '))

const zoomEn = (e, k) => e.z0 + (e.z1 - e.z0) * Math.min(1, k / e.d)
const enPantalla = (e, k, x, y) => {
  const z = zoomEn(e, k)
  const cx = Math.min(Math.max(e.fx * z - W / 2, 0), W * z - W)
  const cy = Math.min(Math.max(e.fy * z - H / 2, 0), AH * z - H)
  return [Math.round(x * z - cx), Math.round(y * z - cy)]
}

const clips = []
for (const e of S) {
  const out = path.join(tmp, `${e.id}.mp4`)
  if (e.tipo === 'stock') {
    run(['-ss', '2.0', '-t', String(e.d + 0.3), '-i', path.join(STOCK, 'pexels-5054368.mp4'), '-loop', '1', '-t', String(e.d), '-i', path.join(V4, 'gancho.png'), '-an', '-filter_complex',
      `[0:v]scale=${W * 1.15}:${H * 1.15}:force_original_aspect_ratio=increase,crop=${W}:${H},scale=w='iw*(1+0.08*min(1,t/${e.d}))':h=-2:eval=frame,crop=${W}:${H},fps=${FPS},` +
      `eq=contrast=1.1:saturation=1.08:brightness=-0.05,colorbalance=rs=0.04:bs=-0.05:bm=-0.04,vignette=angle=PI/4,setsar=1[f];` +
      `[1:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1[g];[f][g]overlay=0:'48*(1-min(1,max(0,t-0.1)/0.25))',trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'camara') {
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, 'camara.png'), '-filter_complex',
      `[0:v]zoompan=z='1.0+0.18*on/${Math.round(e.d * FPS)}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'app') {
    const vel = e.vel || 1
    const anillos = (e.toques || []).filter((n) => M[n]).map((n) => ({ k: (M[n].t - e.a) / vel, x: M[n].x, y: M[n].y }))
    const ins = ['-ss', e.a.toFixed(3), '-t', String(e.d * vel + 0.1), '-i', app]
    anillos.forEach(() => ins.push('-framerate', String(FPS), '-i', path.join(V4, 'toque_%02d.png')))
    const iEt = 1 + anillos.length
    if (e.et) ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V5, `etiqueta-${e.et}.png`))
    let fc = `[0:v]setpts=(PTS-STARTPTS)/${vel},fps=${FPS},scale=w='${W}*(${e.z0}+(${e.z1}-${e.z0})*min(1,t/${e.d}))':h=-2:eval=frame,` +
      `crop=${W}:${H}:x='clip(${e.fx}*iw/${W}-${W / 2},0,iw-${W})':y='clip(${e.fy}*iw/${W}-${H / 2},0,ih-${H})',setsar=1,format=yuv420p[b0]`
    anillos.forEach((r, i) => {
      const [x, y] = enPantalla(e, r.k, r.x, r.y)
      fc += `;[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${Math.max(0, r.k).toFixed(3)}/TB[r${i}];[b${i}][r${i}]overlay=x=${x - 160}:y=${y - 160}:eof_action=pass[b${i + 1}]`
      e.pops = (e.pops || []).concat([Math.max(0, r.k)])
    })
    let ult = `b${anillos.length}`
    if (e.et) {
      // La etiqueta entra bajando y con fundido a los 0,12 s, y se va antes del final de la escena.
      fc += `;[${iEt}:v]format=rgba,fade=t=in:st=0.12:d=0.22:alpha=1,fade=t=out:st=${(e.d - 0.3).toFixed(2)}:d=0.22:alpha=1[e];` +
        `[${ult}][e]overlay=0:'${e.etDy || 0}-36*(1-min(1,max(0,t-0.12)/0.22))'[be]`
      ult = 'be'
    }
    fc += `;[${ult}]trim=duration=${e.d},setpts=PTS-STARTPTS[v]`
    run([...ins, '-filter_complex', fc, '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'tarjeta') {
    let fondo = e.fondoPng
    if (!fondo) {
      fondo = path.join(tmp, `${e.id}-fondo.png`)
      run(['-ss', e.fondo.toFixed(3), '-i', app, '-frames:v', '1', '-vf', `crop=${W}:${H}:0:200,boxblur=45:4,eq=brightness=-0.46:saturation=1.1`, fondo])
    }
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', fondo, '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.png, '-filter_complex',
      `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,10),1.1-0.1*on/10,1+0.02*(on-10)/${Math.round(e.d * FPS)})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  }
  clips.push(out)
}

// ── Transiciones (xfade encadenado) ──────────────────────────────────────────────────────────────
const ins = []; clips.forEach((c) => ins.push('-i', c))
let cadena = ''; let prev = '0:v'; let off = 0
S.forEach((e, i) => {
  if (!e.tr) return
  off += e.d - e.tr[1]
  const sal = i === S.length - 2 ? 'vx' : `x${i}`
  cadena += `[${prev}][${i + 1}:v]xfade=transition=${e.tr[0]}:duration=${e.tr[1]}:offset=${off.toFixed(3)}[${sal}];`
  prev = sal
})
const unido = path.join(tmp, 'unido.mp4')
run([...ins, '-filter_complex', cadena.replace(/;$/, ''), '-map', '[vx]', ...enc, unido])

// ── Subtítulos palabra a palabra (frases 2-4, sobre la app) ─────────────────────────────────────
const INICIO = { 1: T.gancho + 0.3, 2: T.camara + 0.06, 3: T.ordenar + 0.12, 4: T.mapa + 0.1, 5: T.oferta + 0.3, 6: T.cierre + 0.35 }
const ass = (t) => { const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${s}` }
let eventos = ''
for (const n of [2, 3, 4]) {
  const ws = voz[n - 1].palabras
  const vistas = voz[n - 1].visto.split(/\s+/)
  const trozos = []; let actual = []
  ws.forEach((w, i) => {
    actual.push({ ...w, i })
    if (/[,.:…?]$/.test(w.p) || actual.length === 3 || i === ws.length - 1) { trozos.push(actual); actual = [] }
  })
  trozos.forEach((tr, ti) => {
    const sig = trozos[ti + 1]
    tr.forEach((w, j) => {
      const ini = INICIO[n] + w.ini
      const fin = tr[j + 1] ? INICIO[n] + tr[j + 1].ini : sig ? INICIO[n] + sig[0].ini : INICIO[n] + tr.at(-1).fin + 0.25
      const texto = tr.map((x, k) => { const p = (vistas[x.i] || x.p).replace(/[{}]/g, ''); return k === j ? `{\\c&H3BD4FF&}${p}{\\c&HFFFFFF&}` : p }).join(' ')
      eventos += `Dialogue: 0,${ass(ini)},${ass(fin)},Sub,,0,0,0,,${texto}\n`
    })
  })
}
fs.writeFileSync(path.join(tmp, 'subs.ass'), `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI Black,90,&H00FFFFFF,&H00FFFFFF,&H00000000,&H1E000000,-1,0,0,0,100,100,0,0,4,18,0,2,90,90,470,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos}`)
fs.mkdirSync(path.join(tmp, 'fuentes'), { recursive: true })
fs.copyFileSync('C:/Windows/Fonts/seguibl.ttf', path.join(tmp, 'fuentes', 'seguibl.ttf'))
run(['-i', 'unido.mp4', '-vf', 'subtitles=subs.ass:fontsdir=fuentes', ...enc, 'con-subs.mp4'], tmp)

// ── Sonido medido ────────────────────────────────────────────────────────────────────────────────
// Sonoridad integrada (LUFS) y pico (dBFS) de un fichero.
const medir = (f) => {
  const err = leeErr(['-i', f, '-af', 'volumedetect,ebur128=framelog=quiet'])
  const out = err || ''
  const I = parseFloat((out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1])
  const pico = parseFloat((out.match(/max_volume: (-?[\d.]+) dB/) || [])[1])
  return { I, pico }
}
// Niveles objetivo (antes del máster): voz -16 LUFS; música -22 LUFS (bajo la voz se agacha ~6 dB);
// barrido -29 LUFS, campanita -27, subida -31; los clics por pico (son demasiado cortos para medir LUFS).
// Ajustado midiendo las pistas sueltas (24-10): obturador +8 y subida +10 (no se oían), campanita -2 (destacaba).
const OBJ = { whoosh: { I: -29 }, ding: { I: -29 }, subida: { I: -28 }, pop: { pico: -24 }, obturador: { pico: -11 } }
const ganancia = (nombre) => {
  const m = medir(path.join(V4, `${nombre}.wav`))
  const o = OBJ[nombre]
  const g = o.I !== undefined && isFinite(m.I) && m.I > -60 ? o.I - m.I : o.pico - m.pico
  return +g.toFixed(2)
}
const G = Object.fromEntries(Object.keys(OBJ).map((n) => [n, ganancia(n)]))
const mMus = medir(path.join(V4, 'musica.wav'))
G.musica = +(-22 - mMus.I).toFixed(2)
console.log('ganancias (dB):', JSON.stringify(G))

// La voz: cada frase con un poco de compresión y a -16 LUFS (normalización en dos pasadas, lineal).
const vozLista = []
for (const n of [1, 2, 3, 4, 5, 6]) {
  const src = path.join(V5, voz[n - 1].fichero)
  const pre = 'highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=1.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=1'
  const m = leeErr(['-i', src, '-af', `${pre},loudnorm=I=-16:TP=-2:LRA=7:print_format=json`])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  const dst = path.join(tmp, `voz${n}.wav`)
  run(['-i', src, '-af', `${pre},loudnorm=I=-16:TP=-2:LRA=7:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000,aformat=channel_layouts=stereo`, dst])
  vozLista.push({ n, f: dst, t: INICIO[n] })
}

const efectos = []
const fx = (nombre, t) => efectos.push({ f: path.join(V4, `${nombre}.wav`), t: Math.max(0, t), g: G[nombre], nombre })
for (const tr of TRANS) if (tr.de !== 'camara') fx('whoosh', tr.t - 0.21)       // el barrido centrado en la transición
fx('obturador', T.camara + S[1].d - 0.24 - 0.05)                                // el destello de la foto
for (const e of S) for (const k of e.pops || []) fx('pop', e.t0 + k)
fx('ding', T.entregado + 0.62)
fx('subida', T.cierre - 1.3)

const mezcla = (conVoz, salida) => {
  const aIn = ['-i', path.join(tmp, 'con-subs.mp4')]
  const fil = []; let i = 1
  const vz = []
  if (conVoz) for (const v of vozLista) { aIn.push('-i', v.f); const ms = Math.round(v.t * 1000); fil.push(`[${i}:a]adelay=${ms}|${ms}[v${v.n}]`); vz.push(`[v${v.n}]`); i++ }
  aIn.push('-i', path.join(V4, 'musica.wav')); const iMus = i++
  efectos.forEach((e, k) => { aIn.push('-i', e.f); const ms = Math.round(e.t * 1000); fil.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${e.g}dB,adelay=${ms}|${ms}[e${k}]`); i++ })
  let fc = fil.join(';') + ';'
  fc += `[${iMus}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${FIN},volume=${G.musica + (conVoz ? 0 : 3)}dB,afade=t=in:st=0:d=0.25,afade=t=out:st=${(FIN - 1.8).toFixed(2)}:d=1.8[mus];`
  fc += `${efectos.map((_, k) => `[e${k}]`).join('')}amix=inputs=${efectos.length}:normalize=0[sfx];`
  if (conVoz) {
    fc += `${vz.join('')}amix=inputs=${vz.length}:normalize=0[voz];[voz]asplit=2[vz1][vz2];` +
      `[mus][vz2]sidechaincompress=threshold=0.05:ratio=2.2:attack=40:release=500:makeup=1[musd];` +
      `[vz1][musd][sfx]amix=inputs=3:normalize=0[pre]`
  } else {
    fc += `[mus][sfx]amix=inputs=2:normalize=0[pre]`
  }
  const crudo = path.join(tmp, `crudo${conVoz ? '' : '-mudo'}.wav`)
  run([...aIn, '-filter_complex', fc, '-map', '[pre]', '-t', String(FIN), '-c:a', 'pcm_s16le', crudo])
  // Máster: -14 LUFS, pico real -1 dBTP, en dos pasadas y lineal (sube o baja todo igual, sin comprimir).
  const m = leeErr(['-i', crudo, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json'])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  const master = path.join(tmp, `master${conVoz ? '' : '-mudo'}.wav`)
  run(['-i', crudo, '-af', `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', '48000', master])
  run(['-i', path.join(tmp, 'con-subs.mp4'), '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(FIN), '-movflags', '+faststart', salida])
  // Las pistas sueltas (voz, música agachada, efectos) con la MISMA ganancia que el máster, para comprobar cada una.
  const gm = (-14 - parseFloat(j.input_i)).toFixed(2)
  if (conVoz) {
    try {
      const fcP = fc.replace('[vz1][musd][sfx]amix=inputs=3:normalize=0[pre]',
        `[vz1]volume=${gm}dB[pv];[musd]volume=${gm}dB[pm];[sfx]volume=${gm}dB[ps]`)
      run([...aIn, '-filter_complex', fcP, '-t', String(FIN),
        '-map', '[pv]', '-c:a', 'pcm_s16le', path.join(tmp, 'pista-voz.wav'),
        '-map', '[pm]', '-c:a', 'pcm_s16le', path.join(tmp, 'pista-musica.wav'),
        '-map', '[ps]', '-c:a', 'pcm_s16le', path.join(tmp, 'pista-efectos.wav')])
    } catch (e) { console.log('pistas sueltas: no se pudieron sacar', String(e).slice(0, 200)) }
  }
  return master
}

// Comprobación de la mezcla con las pistas sueltas: sonoridad momentánea (ventana de 400 ms).
const momentanea = (f) => {
  const out = leeErr(['-i', f, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M'])
  const pts = []; let t = null
  for (const l of out.split(/\r?\n/)) {
    const a = l.match(/pts_time:([\d.]+)/); if (a) t = parseFloat(a[1])
    const b = l.match(/lavfi\.r128\.M=(-?[\d.]+)/); if (b && t !== null) pts.push([t, parseFloat(b[1])])
  }
  return pts
}
const comprobar = (master) => {
  const en = (pts, a, b) => pts.filter(([x]) => x >= a && x <= b).map(([, y]) => y).filter((y) => y > -70)
  const med = (l) => { const s2 = [...l].sort((x, y) => x - y); return s2.length ? s2[Math.floor(s2.length / 2)] : NaN }
  const pv = momentanea(path.join(tmp, 'pista-voz.wav'))
  const pm = momentanea(path.join(tmp, 'pista-musica.wav'))
  const pe = momentanea(path.join(tmp, 'pista-efectos.wav'))
  const vozMed = med(vozLista.flatMap((v) => en(pv, v.t + 0.2, v.t + vd(v.n) - 0.2)))
  const musBajoVoz = med(vozLista.flatMap((v) => en(pm, v.t + 0.3, v.t + vd(v.n) - 0.3)))
  const sinVoz = []
  for (let t = 0; t < FIN; t += 0.1) if (!vozLista.some((v) => t >= v.t - 0.3 && t <= v.t + vd(v.n) + 0.3)) sinVoz.push(t)
  const musSola = med(sinVoz.flatMap((t) => en(pm, t, t + 0.1)))
  const fxs = efectos.map((e) => ({ n: e.nombre, t: e.t, max: Math.max(...en(pe, e.t, e.t + 0.6)) }))
  const total = medir(master)
  const r = { master: total, voz: +vozMed.toFixed(1), musicaBajoVoz: +musBajoVoz.toFixed(1), musicaSola: +musSola.toFixed(1),
    efectos: fxs.map((x) => ({ ...x, max: +x.max.toFixed(1), bajoVoz: +(vozMed - x.max).toFixed(1) })) }
  console.log(`máster ${total.I} LUFS · pico ${total.pico} dBFS`)
  console.log(`voz ${r.voz} · música bajo la voz ${r.musicaBajoVoz} (${(r.voz - r.musicaBajoVoz).toFixed(1)} LU por debajo) · música sola ${r.musicaSola}`)
  console.log('efectos (LU por debajo de la voz):', r.efectos.map((x) => `${x.n}@${x.t.toFixed(1)} ${x.bajoVoz}`).join(' · '))
  return r
}

const final = path.join(tmp, 'final.mp4')
const master = mezcla(true, final)
const chk = comprobar(master)
const final2 = path.join(tmp, 'mudo.mp4'); mezcla(false, final2)
const formatos = (base, sufijo) => {
  const v = (fmt, args) => {
    const dest = path.join(SALIDA, `spot-v5-${fmt}${sufijo}.mp4`)
    run(['-i', base, ...args, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dest])
    console.log('→', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB')
  }
  // 4x5 y 1x1: la pantalla ENTERA en el centro sobre la misma imagen desenfocada. Recortar el 9x16 dejaba
  // fuera las píldoras de arriba, la tarjeta de giro y el botón «Entregar sin foto» (revisado el 24-10).
  const columna = (an, al) => ['-filter_complex', `[0:v]split[a][b];[a]scale=${an}:${al}:force_original_aspect_ratio=increase,crop=${an}:${al},boxblur=40:3,eq=brightness=-0.3:saturation=0.9[bg];[b]scale=-2:${al}[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]`, '-map', '[v]', '-map', '0:a']
  v('9x16', [])
  v('4x5', columna(1080, 1350))
  v('1x1', columna(1080, 1080))
}
formatos(final, `-${VOZ.toLowerCase()}`)
formatos(final2, '-sin-voz')
fs.writeFileSync(path.join(V5, `mezcla-${VOZ}.json`), JSON.stringify({ voz: VOZ, fin: FIN, ganancias: G, comprobacion: chk, escenas: S.map(({ id, t0, d }) => ({ id, t0, d })), efectos: efectos.map(({ nombre, t, g }) => ({ nombre, t: +t.toFixed(3), g })) }, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
