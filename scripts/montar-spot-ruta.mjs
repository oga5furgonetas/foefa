// ANUNCIO «LA RUTA HECHA» (29-10-2026, docs/anuncios/super-anuncio/GUION.md). Montaje heredado del spot v5
// (transiciones encadenadas, píldoras, subtítulos al tiempo real de cada palabra, sonido medido) con:
//   · el gancho y el pago emocional sobre los FOTOGRAMAS de los planos generados en Artlist (los vídeos no se
//     pueden descargar desde esta sesión: en cuanto estén en clips/, se usan solos; ver GENERADO.md),
//   · la app grabada por e2e/spot-ruta.spec.js: ESCANEAR dos paquetes (bip, «Añadida a tu ruta»), foto a la
//     etiqueta, ordenar con la hora de cada parada, el mapa con las ZONAS DE CARGA Y DESCARGA encendiéndose,
//     la guía parada a parada y la entrega CON PRUEBA,
//   · la voz de Puck (Gemini TTS, la que eligió Dani; las 6 frases grabadas el 24-10 con el tiempo de cada
//     palabra), la oferta sin fecha («Empieza gratis») y dos cierres: B (móvil: toca el botón) y A (QR a Play).
//   node scripts/montar-spot-ruta.mjs  → docs/anuncios/super-anuncio/salida/spot-ruta-*.mp4
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const V4 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
const V5 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v5')
const SA = path.join(RAIZ, 'docs', 'anuncios', 'super-anuncio')
const CAPAS = path.join(SA, 'capas')
const STILLS = path.join(SA, 'stills')
const CLIPS = path.join(SA, 'clips')          // los vídeos de Artlist, si Dani los deja aquí (plano-1.mp4, plano-2.mp4…)
const SALIDA = path.join(SA, 'salida')
const GRAB = process.env.GRAB || path.join(RAIZ, 'frontend', 'test-results', 'spot-ruta')
const VOZ = process.env.VOZ || 'Puck'
const GANCHO = process.env.GANCHO || 'mano'   // 'mano' (voz de Puck) | '112' (solo texto)
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotruta-'))
const run = (args, cwd) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', ...args], { stdio: 'inherit', cwd })
const leeErr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || ''
const W = 1080, H = 1920, FPS = 30, AH = 2340
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS)]
const existe = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }

// ── La grabación → vídeo de 30 fps ───────────────────────────────────────────────────────────────
const grab = JSON.parse(fs.readFileSync(path.join(GRAB, 'marcas.json'), 'utf8'))
const T0 = grab.frames[0].t
const M = {}
for (const m of grab.marcas) M[m.texto] = { ...m, t: m.t - T0 }
fs.writeFileSync(path.join(tmp, 'frames.txt'), grab.frames.map((f, i) => {
  const sig = grab.frames[i + 1] ? grab.frames[i + 1].t : f.t + 0.5
  return `file '${path.join(GRAB, 'frames', f.f)}'\nduration ${Math.max(0.001, sig - f.t).toFixed(4)}`
}).join('\n') + `\nfile '${path.join(GRAB, 'frames', grab.frames.at(-1).f)}'\n`)
const app = path.join(tmp, 'app.mp4')
run(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'frames.txt'), '-vf', `fps=${FPS},scale=1080:-2,crop=1080:${AH}:0:0,format=yuv420p`, ...enc, app])
console.log('marcas:', Object.entries(M).map(([k, v]) => `${k}@${v.t.toFixed(2)}`).join(' '))

// ── La voz ───────────────────────────────────────────────────────────────────────────────────────
const voz = JSON.parse(fs.readFileSync(path.join(V5, 'voces', VOZ, 'voz.json'), 'utf8')).frases
const vd = (n) => voz[n - 1].dur

// ── Escenas ──────────────────────────────────────────────────────────────────────────────────────
// 'still': un fotograma de un plano de IA con movimiento (Ken Burns) + una capa de texto; si existe el clip en
// CLIPS (plano-N.mp4) se usa el vídeo. 'app': la grabación (a = inicio, vel = velocidad, fx/fy = centro del zoom,
// toques = anillos, et = píldora). 'tarjeta': capa sobre fondo.
const toqueEntrega = M.tap_hacer_foto ? 'tap_hacer_foto' : 'tap_sin_foto'
const S = [
  GANCHO !== 'mano'
    ? { id: 'gancho', tipo: 'still', still: 'plano-1-furgoneta-llena.jpg', clip: 'plano-1.mp4', capa: path.join(CAPAS, `gancho-${GANCHO}.png`), d: GANCHO === '25' ? 2.9 : 2.6, kb: [1.0, 1.1], tr: ['zoomin', 0.32] }
    : { id: 'gancho', tipo: 'still', still: 'plano-1-furgoneta-llena.jpg', clip: 'plano-1.mp4', capa: path.join(V4, 'gancho.png'), d: +(vd(1) + 0.65).toFixed(2), kb: [1.0, 1.1], tr: ['zoomin', 0.32] },
  { id: 'escanea', tipo: 'app', a: M.visor.t - 0.05, hasta: M.bip2.t + 1.0, dMax: 3.4, fx: 540, fy: 1000, z0: 1.0, z1: 1.05, toques: ['tap_otro'], bips: ['bip1', 'bip2'], tit: 'escaneo', tr: ['slideup', 0.28] },
  { id: 'foto', tipo: 'app', a: M.leido.t - 0.05, hasta: M.lista3.t + 0.4, dMax: 2.0, fx: 540, fy: 760, z0: 1.0, z1: 1.05, toques: ['tap_anadir'], tit: 'escaneo', tr: ['slideup', 0.3] },
  { id: 'ordenar', tipo: 'app', a: M.tap_ordenar.t - 0.4, d: 2.5, fx: 540, fy: 1100, z0: 1.0, z1: 1.04, toques: ['tap_ordenar'], tit: 'ordenar', tr: ['smoothup', 0.26] },
  { id: 'lista', tipo: 'app', a: M.baja_lista.t + 0.1, d: 1.8, vel: 1.6, fx: 540, fy: 1170, z0: 1.0, z1: 1.0, tr: ['smoothleft', 0.3] },
  { id: 'mapa', tipo: 'app', a: (M.tap_zonas || M.mapa).t - 0.9, d: 2.9, fx: 540, fy: 930, z0: 1.0, z1: 1.06, toques: M.tap_zonas ? ['tap_zonas'] : [], tit: 'zonas', tr: ['zoomin', 0.3] },
  { id: 'navega', tipo: 'app', a: M.navegacion.t + 0.25, d: 2.6, vel: 2.3, fx: 540, fy: 880, z0: 1.0, z1: 1.08, tit: 'voz', tr: ['slideup', 0.26] },
  { id: 'entregado', tipo: 'app', a: M.tap_entregado.t + 0.35, hasta: M.entregado.t + 1.6, dMax: 2.6, fx: 540, fy: 1600, z0: 1.0, z1: 1.03, toques: [toqueEntrega], tit: 'entregado', tr: ['circleopen', 0.36] },
  { id: 'manana', tipo: 'still', still: 'plano-2-repartidor.jpg', clip: 'plano-9.mp4', capa: path.join(CAPAS, 'manana.png'), d: 2.3, kb: [1.08, 1.0], tr: ['smoothup', 0.36] },
  { id: 'oferta', tipo: 'tarjeta', d: +(vd(5) + 0.85).toFixed(2), png: path.join(CAPAS, 'oferta.png'), fondo: M.lista_abajo.t, tr: ['smoothup', 0.36] },
  { id: 'cierre', tipo: 'tarjeta', d: +(vd(6) + 1.45).toFixed(2), png: path.join(CAPAS, 'cierre-B.png'), fondoPng: path.join(V4, 'fondo-marca.png') },
]
for (const e of S) {
  if (e.hasta !== undefined) { const real = e.hasta - e.a; e.vel = e.vel || Math.max(1, +(real / e.dMax).toFixed(3)); e.d = +(real / e.vel).toFixed(3) }
}
let acum = 0
for (const e of S) { e.d = +e.d.toFixed(3); e.t0 = +acum.toFixed(3); acum += e.d - (e.tr ? e.tr[1] : 0) }
const FIN = +acum.toFixed(2)
const T = Object.fromEntries(S.map((e) => [e.id, e.t0]))
const TRANS = S.filter((e) => e.tr).map((e) => ({ de: e.id, t: e.t0 + e.d - e.tr[1] / 2, tipo: e.tr[0] }))
console.log('voz', VOZ, '· gancho', GANCHO, '· duración', FIN, 's ·', S.map((e) => `${e.id}@${e.t0.toFixed(2)}(${e.d}s${e.vel ? ' x' + e.vel : ''})`).join(' '))

const zoomEn = (e, k) => e.z0 + (e.z1 - e.z0) * Math.min(1, k / e.d)
const enPantalla = (e, k, x, y) => {
  const z = zoomEn(e, k)
  const cx = Math.min(Math.max(e.fx * z - W / 2, 0), W * z - W)
  const cy = Math.min(Math.max(e.fy * z - H / 2, 0), AH * z - H)
  return [Math.round(x * z - cx), Math.round(y * z - cy)]
}
const grado = `eq=contrast=1.08:saturation=1.06:brightness=-0.03,colorbalance=rs=0.03:bs=-0.04:bm=-0.03,vignette=angle=PI/4.5`

const clips = []
for (const e of S) {
  const out = path.join(tmp, `${e.id}.mp4`)
  if (e.tipo === 'still') {
    const clip = path.join(CLIPS, e.clip || '')
    const n = Math.round(e.d * FPS)
    const [z0, z1] = e.kb
    if (e.clip && existe(clip)) {
      // El clip de Artlist: recortado a 9:16, con la capa de texto encima.
      run(['-ss', '0.3', '-t', String(e.d + 0.3), '-i', clip, '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.capa, '-an', '-filter_complex',
        `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},${grado},setsar=1[f];` +
        `[1:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1[g];[f][g]overlay=0:'44*(1-min(1,max(0,t-0.1)/0.25))',trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`,
        '-map', '[v]', ...enc, out])
    } else {
      // El fotograma del plano, con un movimiento lento (zoompan sobre una imagen más grande para que no tiemble).
      run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(STILLS, e.still), '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.capa, '-an', '-filter_complex',
        `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
        `zoompan=z='${z0}+(${z1}-${z0})*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},${grado},setsar=1[f];` +
        `[1:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1[g];[f][g]overlay=0:'44*(1-min(1,max(0,t-0.1)/0.25))',trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`,
        '-map', '[v]', ...enc, out])
    }
  } else if (e.tipo === 'app') {
    const vel = e.vel || 1
    const anillos = (e.toques || []).filter((n) => M[n] && M[n].x).map((n) => ({ k: (M[n].t - e.a) / vel, x: M[n].x, y: M[n].y }))
    e.bipsT = (e.bips || []).filter((n) => M[n]).map((n) => (M[n].t - e.a) / vel)
    const ins = ['-ss', e.a.toFixed(3), '-t', String(e.d * vel + 0.1), '-i', app]
    anillos.forEach(() => ins.push('-framerate', String(FPS), '-i', path.join(V4, 'toque_%02d.png')))
    // El móvil: fondo de marca, cuerpo del móvil, máscara de la pantalla y el titular de la franja de arriba.
    const iBg = 1 + anillos.length
    for (const f of ['fondo-marca.png']) ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, f))
    for (const f of ['marco-fondo.png', 'marco-mask.png']) ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(CAPAS, f))
    const iTit = iBg + 3
    if (e.tit) ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(CAPAS, `titulo-${e.tit}.png`))
    let fc = `[0:v]setpts=(PTS-STARTPTS)/${vel},fps=${FPS},scale=w='${W}*(${e.z0}+(${e.z1}-${e.z0})*min(1,t/${e.d}))':h=-2:eval=frame,` +
      `crop=${W}:${H}:x='clip(${e.fx}*iw/${W}-${W / 2},0,iw-${W})':y='clip(${e.fy}*iw/${W}-${H / 2},0,ih-${H})',setsar=1,format=yuv420p[b0]`
    anillos.forEach((r, i) => {
      const [x, y] = enPantalla(e, r.k, r.x, r.y)
      fc += `;[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${Math.max(0, r.k).toFixed(3)}/TB[r${i}];[b${i}][r${i}]overlay=x=${x - 160}:y=${y - 160}:eof_action=pass[b${i + 1}]`
      e.pops = (e.pops || []).concat([Math.max(0, r.k)])
    })
    const ult = `b${anillos.length}`
    // La pantalla (972×1728) con esquinas redondas y fundido abajo, sobre el cuerpo del móvil y el fondo de marca.
    fc += `;[${ult}]trim=duration=${e.d},setpts=PTS-STARTPTS,scale=972:1728,format=rgba[sc];[${iBg + 2}:v]format=gray[mk];[sc][mk]alphamerge[sm];` +
      `[${iBg}:v][${iBg + 1}:v]overlay=0:0:format=auto[g1];[g1][sm]overlay=54:330:format=auto[g2]`
    if (e.tit) {
      fc += `;[${iTit}:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1,fade=t=out:st=${(e.d - 0.3).toFixed(2)}:d=0.22:alpha=1[ti];[g2][ti]overlay=0:'-28*(1-min(1,max(0,t-0.1)/0.25))':format=auto[g3]`
      fc += `;[g3]trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`
    } else fc += `;[g2]trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`
    run([...ins, '-filter_complex', fc, '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'tarjeta') {
    let fondo = e.fondoPng
    if (!fondo) {
      fondo = path.join(tmp, `${e.id}-fondo.png`)
      run(['-ss', e.fondo.toFixed(3), '-i', app, '-frames:v', '1', '-vf', `crop=${W}:${H}:0:200,boxblur=45:4,eq=brightness=-0.36:saturation=1.1`, fondo])
    }
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', fondo, '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.png, '-filter_complex',
      `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,10),1.1-0.1*on/10,1+0.02*(on-10)/${Math.round(e.d * FPS)})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  }
  clips.push(out)
}

// ── Transiciones ─────────────────────────────────────────────────────────────────────────────────
const unir = (lista, salida) => {
  const ins = []; lista.forEach((c) => ins.push('-i', c))
  let cadena = ''; let prev = '0:v'; let off = 0
  S.forEach((e, i) => {
    if (!e.tr) return
    off += e.d - e.tr[1]
    const sal = i === S.length - 2 ? 'vx' : `x${i}`
    cadena += `[${prev}][${i + 1}:v]xfade=transition=${e.tr[0]}:duration=${e.tr[1]}:offset=${off.toFixed(3)}[${sal}];`
    prev = sal
  })
  run([...ins, '-filter_complex', cadena.replace(/;$/, ''), '-map', '[vx]', ...enc, salida])
}
const unido = path.join(tmp, 'unido.mp4')
unir(clips, unido)

// ── Subtítulos palabra a palabra (frases 2-4, sobre la app) ─────────────────────────────────────
const INICIO = { 1: T.gancho + 0.3, 2: T.escanea + 0.15, 3: T.ordenar + 0.12, 4: T.mapa + 0.1, 5: T.oferta + 0.3, 6: T.cierre + 0.35 }
if (GANCHO !== 'mano') delete INICIO[1]   // el gancho de texto va sin voz
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
Style: Sub,Inter Display,88,&H00FFFFFF,&H00FFFFFF,&H00000000,&H1E000000,-1,0,0,0,100,100,0,0,4,18,0,2,90,90,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos}`)
// Sin subtítulos encima de la app (Dani, 29-10): la voz cuenta y el titular va en su franja.
fs.copyFileSync(path.join(tmp, 'unido.mp4'), path.join(tmp, 'con-subs.mp4'))

// ── Sonido medido (como el v5) ───────────────────────────────────────────────────────────────────
// El bip del escáner, sintetizado: 1.9 kHz, 80 ms, ataque corto.
run(['-f', 'lavfi', '-i', 'sine=frequency=1900:duration=0.09:sample_rate=48000', '-af', 'afade=t=in:st=0:d=0.004,afade=t=out:st=0.06:d=0.03,volume=0.8,aformat=channel_layouts=stereo', path.join(tmp, 'bip.wav')])
const SFX = { whoosh: path.join(V4, 'whoosh.wav'), ding: path.join(V4, 'ding.wav'), subida: path.join(V4, 'subida.wav'), pop: path.join(V4, 'pop.wav'), obturador: path.join(V4, 'obturador.wav'), bip: path.join(tmp, 'bip.wav') }
const medir = (f) => {
  const out = leeErr(['-i', f, '-af', 'volumedetect,ebur128=framelog=quiet'])
  return { I: parseFloat((out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), pico: parseFloat((out.match(/max_volume: (-?[\d.]+) dB/) || [])[1]) }
}
const OBJ = { whoosh: { I: -29 }, ding: { I: -29 }, subida: { I: -28 }, pop: { pico: -24 }, obturador: { pico: -11 }, bip: { pico: -16 } }
const G = Object.fromEntries(Object.keys(OBJ).map((n) => {
  const m = medir(SFX[n]); const o = OBJ[n]
  return [n, +((o.I !== undefined && isFinite(m.I) && m.I > -60 ? o.I - m.I : o.pico - m.pico)).toFixed(2)]
}))
const mMus = medir(path.join(V4, 'musica.wav'))
G.musica = +(-22 - mMus.I).toFixed(2)
console.log('ganancias (dB):', JSON.stringify(G))

const vozLista = []
for (const n of Object.keys(INICIO).map(Number)) {
  const src = path.join(V5, voz[n - 1].fichero)
  const pre = 'highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=1.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=1'
  const m = leeErr(['-i', src, '-af', `${pre},loudnorm=I=-16:TP=-2:LRA=7:print_format=json`])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  const dst = path.join(tmp, `voz${n}.wav`)
  run(['-i', src, '-af', `${pre},loudnorm=I=-16:TP=-2:LRA=7:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000,aformat=channel_layouts=stereo`, dst])
  vozLista.push({ n, f: dst, t: INICIO[n] })
}

const efectos = []
const fx = (nombre, t) => efectos.push({ f: SFX[nombre], t: Math.max(0, t), g: G[nombre], nombre })
for (const tr of TRANS) fx('whoosh', tr.t - 0.21)
for (const e of S) {
  for (const k of e.pops || []) fx('pop', e.t0 + k)
  for (const k of e.bipsT || []) fx('bip', e.t0 + k - 0.05)
}
fx('obturador', T.foto + 0.02)
fx('ding', T.entregado + Math.min(S.find((e) => e.id === 'entregado').d - 0.5, ((M.entregado.t - M.tap_entregado.t - 0.35) / (S.find((e) => e.id === 'entregado').vel || 1)) + 0.15))
fx('subida', T.cierre - 1.3)

const mezcla = (conVoz, salida, video) => {
  const aIn = ['-i', video]
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
  } else fc += `[mus][sfx]amix=inputs=2:normalize=0[pre]`
  const crudo = path.join(tmp, `crudo-${path.basename(salida)}.wav`)
  run([...aIn, '-filter_complex', fc, '-map', '[pre]', '-t', String(FIN), '-c:a', 'pcm_s16le', crudo])
  const m = leeErr(['-i', crudo, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json'])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  const master = path.join(tmp, `master-${path.basename(salida)}.wav`)
  run(['-i', crudo, '-af', `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', '48000', master])
  run(['-i', video, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(FIN), '-movflags', '+faststart', salida])
  const t = medir(master)
  console.log(`${path.basename(salida)}: máster ${t.I} LUFS · pico ${t.pico} dBFS`)
  return master
}

// ── Salidas ──────────────────────────────────────────────────────────────────────────────────────
const conSubs = path.join(tmp, 'con-subs.mp4')
const finalB = path.join(tmp, 'final-B.mp4'); mezcla(true, finalB, conSubs)
const mudoB = path.join(tmp, 'mudo-B.mp4'); mezcla(false, mudoB, conSubs)
// La salida A: el mismo vídeo con el cierre del QR.
const iC = S.length - 1
const cierreA = path.join(tmp, 'cierreA.mp4')
run(['-loop', '1', '-framerate', String(FPS), '-t', String(S[iC].d), '-i', path.join(V4, 'fondo-marca.png'), '-loop', '1', '-framerate', String(FPS), '-t', String(S[iC].d), '-i', path.join(CAPAS, 'cierre-A.png'), '-filter_complex',
  `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,10),1.06-0.06*on/10,1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${S[iC].d},setpts=PTS-STARTPTS[v]`, '-map', '[v]', ...enc, cierreA])
const unidoA = path.join(tmp, 'unido-A.mp4'); unir([...clips.slice(0, -1), cierreA], unidoA)
fs.copyFileSync(unidoA, path.join(tmp, 'con-subs-A.mp4'))
const finalA = path.join(tmp, 'final-A.mp4'); mezcla(true, finalA, path.join(tmp, 'con-subs-A.mp4'))

const v = (base, nombre, args) => {
  const dest = path.join(SALIDA, `spot-ruta-${nombre}.mp4`)
  run(['-i', base, ...args, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dest])
  console.log('→', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB')
}
const columna = (an, al) => ['-filter_complex', `[0:v]split[a][b];[a]scale=${an}:${al}:force_original_aspect_ratio=increase,crop=${an}:${al},boxblur=40:3,eq=brightness=-0.3:saturation=0.9[bg];[b]scale=-2:${al}[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]`, '-map', '[v]', '-map', '0:a']
const suf = GANCHO === 'mano' ? '' : `-${GANCHO}`
v(finalB, `9x16-B${suf}`, [])
v(finalA, `9x16-A-qr${suf}`, [])
v(finalB, `4x5-B${suf}`, columna(1080, 1350))
v(finalB, `1x1-B${suf}`, columna(1080, 1080))
v(finalA, `16x9-A-qr${suf}`, columna(1920, 1080))
v(mudoB, `9x16-B-sin-voz${suf}`, [])
fs.writeFileSync(path.join(SA, `montaje${suf}.json`), JSON.stringify({ voz: VOZ, gancho: GANCHO, fin: FIN, ganancias: G, escenas: S.map(({ id, t0, d, vel }) => ({ id, t0, d, vel })), efectos: efectos.map(({ nombre, t, g }) => ({ nombre, t: +t.toFixed(3), g })) }, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
