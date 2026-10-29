// ANUNCIO CON LA VOZ DE DANI (29-10-2026, tarde). Dani grabó la locución (30 s, nota de voz de WhatsApp) y pidió
// «móntame el vídeo acorde al audio» y «mete lo de los 25 € como gancho inicial». Aquí el tiempo lo manda la voz:
// cada escena arranca donde empieza la frase que ilustra (tiempos de docs/anuncios/spot-dani/voz.json, sacados con
// whisper), y antes de la voz va el gancho «¿Quieres 25 € gratis?» (1,7 s, solo texto y música).
//   · planos de ambiente: los fotogramas de Artlist (o los clips, si están en super-anuncio/clips/),
//   · la app grabada por e2e/spot-ruta.spec.js, ahora con el MAPA REAL de A Coruña (scripts/spot-ruta/teselas.py),
//   · el panel de empresa (docs/play-store/captura-4-oficina-mapa.png) para «el control de flotas»,
//   · sonido medido: voz a -16 LUFS, música que se agacha bajo la voz, efectos, máster a -14 LUFS / -1 dBTP.
//   GRAB=<grabación> VOZ=<wav limpio> node scripts/montar-spot-dani.mjs  → docs/anuncios/spot-dani/salida/spot-dani-*.mp4
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const V4 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
const SA = path.join(RAIZ, 'docs', 'anuncios', 'super-anuncio')
const SD = path.join(RAIZ, 'docs', 'anuncios', 'spot-dani')
const CAPAS = path.join(SD, 'capas')
const CAPAS_RUTA = path.join(SA, 'capas')              // los titulares de escanear/ordenar/zonas/voz/entregado y el móvil
const STILLS = path.join(SA, 'stills')
const CLIPS = path.join(SA, 'clips')
const PANEL = path.join(RAIZ, 'docs', 'play-store', 'captura-4-oficina-mapa.png')
const SALIDA = path.join(SD, 'salida')
const GRAB = process.env.GRAB || path.join(RAIZ, 'frontend', 'test-results', 'spot-ruta')
const VOZ = process.env.VOZ || path.join(SD, 'voz-dani.flac')
const BONO = process.env.BONO !== '0'                   // BONO=0: sin el gancho de los 25 € (empieza con la voz)
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotdani-'))
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

// ── La voz manda el tiempo ───────────────────────────────────────────────────────────────────────
// voz.json: las frases que oyó whisper en la nota de voz de Dani, con su inicio y fin (segundos del audio).
const frases = JSON.parse(fs.readFileSync(path.join(SD, 'voz.json'), 'utf8')).frases
const F = (clave) => frases.find((f) => f.id === clave)
const VO = BONO ? 1.7 : 0.35                        // cuándo empieza la voz en el vídeo
const A = (s) => +(s + VO).toFixed(3)               // segundo del audio → segundo del vídeo
const dVoz = +leeErr(['-i', VOZ]).match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((acc, v, i) => acc + +v * [3600, 60, 1][i], 0).toFixed(2)
const FIN = +(VO + dVoz + 0.45).toFixed(2)

// ── Escenas (t0 absoluto; la duración sale de la siguiente, más la transición que las encadena) ──
const toqueEntrega = M.tap_hacer_foto ? 'tap_hacer_foto' : 'tap_sin_foto'
const S = [
  ...(BONO ? [{ id: 'gancho', tipo: 'still', still: 'plano-1-furgoneta-llena.jpg', clip: 'plano-1.mp4', capa: path.join(CAPAS, 'gancho-25.png'), t0: 0, kb: [1.0, 1.12], tr: ['zoomin', 0.3] }] : []),
  { id: 'pregunta1', tipo: 'still', still: 'plano-7a-cabina.jpg', clip: 'plano-7a.mp4', capa: path.join(CAPAS, 'pregunta-1.png'), t0: BONO ? 1.6 : 0, kb: [1.1, 1.0], tr: ['slideup', 0.28] },
  { id: 'pregunta2', tipo: 'app', t0: A(F('pregunta2').ini), a: M.baja_lista.t - 0.4, vel: 1.25, fx: 540, fy: 1100, z0: 1.0, z1: 1.04, tit: path.join(CAPAS, 'titulo-pregunta2.png'), tr: ['smoothleft', 0.3] },
  { id: 'interesa', tipo: 'tarjeta', t0: A(F('interesa').ini), png: path.join(CAPAS, 'interesa.png'), tr: ['fade', 0.04] },
  { id: 'logo', tipo: 'tarjeta', t0: A(F('llega').ini), png: path.join(CAPAS, 'logo.png'), tr: ['zoomin', 0.3] },
  // El mapa ya pintado (justo después del toque hay un fotograma en blanco mientras carga) y a cámara lenta, para
  // que acabe justo antes del toque de las zonas, que es la escena siguiente.
  { id: 'mapa1', tipo: 'app', t0: A(F('app').ini), a: M.mapa.t + 0.1, vel: 0.85, fx: 540, fy: 900, z0: 1.0, z1: 1.07, tit: path.join(CAPAS, 'titulo-ruta.png'), tr: ['smoothleft', 0.3] },
  { id: 'panel', tipo: 'panel', t0: A(F('flotas').ini), tit: path.join(CAPAS, 'titulo-flota.png'), tr: ['slideup', 0.28] },
  { id: 'escanea', tipo: 'app', t0: A(F('organizar').ini), a: M.visor.t - 0.05, hasta: M.bip2.t + 0.9, fx: 540, fy: 1000, z0: 1.0, z1: 1.05, toques: ['tap_otro'], bips: ['bip1', 'bip2'], tit: path.join(CAPAS_RUTA, 'titulo-escaneo.png'), tr: ['slideup', 0.28] },
  { id: 'ordenar', tipo: 'app', t0: A(F('eficiente').ini), a: M.tap_ordenar.t - 0.5, vel: 1, fx: 540, fy: 1100, z0: 1.0, z1: 1.04, toques: ['tap_ordenar'], tit: path.join(CAPAS_RUTA, 'titulo-ordenar.png'), tr: ['smoothup', 0.26] },
  { id: 'zonas', tipo: 'app', t0: A(F('cuenta').ini), a: M.tap_zonas.t - 0.45, vel: 1, fx: 540, fy: 930, z0: 1.0, z1: 1.06, toques: ['tap_zonas'], tit: path.join(CAPAS_RUTA, 'titulo-zonas.png'), tr: ['zoomin', 0.3] },
  { id: 'navega', tipo: 'app', t0: A(F('empresa').ini), a: M.navegacion.t + 0.3, vel: 2.3, fx: 540, fy: 880, z0: 1.0, z1: 1.08, tit: path.join(CAPAS_RUTA, 'titulo-voz.png'), tr: ['slideup', 0.26] },
  { id: 'entregado', tipo: 'app', t0: A(F('evoluciona').ini), a: M.tap_entregado.t + 0.3, hasta: M.entregado.t + 1.0, fx: 540, fy: 1600, z0: 1.0, z1: 1.03, toques: [toqueEntrega], tit: path.join(CAPAS_RUTA, 'titulo-entregado.png'), tr: ['circleopen', 0.36] },
  { id: 'cambio', tipo: 'still', still: 'plano-2-repartidor.jpg', clip: 'plano-9.mp4', capa: path.join(CAPAS, 'cambio.png'), t0: A(F('cambio').ini), kb: [1.08, 1.0], tr: ['smoothup', 0.36] },
  { id: 'cierre', tipo: 'tarjeta', t0: A(F('descubre').ini), png: path.join(CAPAS, 'cierre-B.png'), extra: [{ png: path.join(CAPAS, 'lema.png'), t: A(F('lema').ini) }] },
]
S.forEach((e, i) => {
  const sig = S[i + 1]
  e.d = +((sig ? sig.t0 - e.t0 + e.tr[1] : FIN - e.t0)).toFixed(3)
  if (e.hasta !== undefined) e.vel = +(((e.hasta - e.a) / e.d)).toFixed(3)
})
const T = Object.fromEntries(S.map((e) => [e.id, e.t0]))
const TRANS = S.filter((e) => e.tr && e.tr[1] > 0.1).map((e) => ({ de: e.id, t: e.t0 + e.d - e.tr[1] / 2, tipo: e.tr[0] }))
console.log('voz', path.basename(VOZ), dVoz, 's desde', VO, '· fin', FIN, 's ·', S.map((e) => `${e.id}@${e.t0.toFixed(2)}(${e.d}s${e.vel ? ' x' + e.vel : ''})`).join(' '))

const zoomEn = (e, k) => e.z0 + (e.z1 - e.z0) * Math.min(1, k / e.d)
const enPantalla = (e, k, x, y) => {
  const z = zoomEn(e, k)
  const cx = Math.min(Math.max(e.fx * z - W / 2, 0), W * z - W)
  const cy = Math.min(Math.max(e.fy * z - H / 2, 0), AH * z - H)
  return [Math.round(x * z - cx), Math.round(y * z - cy)]
}
const grado = `eq=contrast=1.08:saturation=1.06:brightness=-0.03,colorbalance=rs=0.03:bs=-0.04:bm=-0.03,vignette=angle=PI/4.5`
const capaIn = (i, d) => `[${i}:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1[g${i}]`

const clips = []
for (const e of S) {
  const out = path.join(tmp, `${e.id}.mp4`)
  if (e.tipo === 'still') {
    const clip = path.join(CLIPS, e.clip || '')
    const n = Math.round(e.d * FPS)
    const [z0, z1] = e.kb
    if (e.clip && existe(clip)) {
      run(['-ss', '0.3', '-t', String(e.d + 0.3), '-i', clip, '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.capa, '-an', '-filter_complex',
        `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},${grado},setsar=1[f];` +
        `${capaIn(1)};[f][g1]overlay=0:'44*(1-min(1,max(0,t-0.1)/0.25))',trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`,
        '-map', '[v]', ...enc, out])
    } else {
      run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(STILLS, e.still), '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.capa, '-an', '-filter_complex',
        `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
        `zoompan=z='${z0}+(${z1}-${z0})*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},${grado},setsar=1[f];` +
        `${capaIn(1)};[f][g1]overlay=0:'44*(1-min(1,max(0,t-0.1)/0.25))',trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`,
        '-map', '[v]', ...enc, out])
    }
  } else if (e.tipo === 'app') {
    const vel = e.vel || 1
    const anillos = (e.toques || []).filter((n) => M[n] && M[n].x).map((n) => ({ k: (M[n].t - e.a) / vel, x: M[n].x, y: M[n].y })).filter((r) => r.k > -0.2 && r.k < e.d)
    e.bipsT = (e.bips || []).filter((n) => M[n]).map((n) => (M[n].t - e.a) / vel)
    const ins = ['-ss', e.a.toFixed(3), '-t', String(e.d * vel + 0.1), '-i', app]
    anillos.forEach(() => ins.push('-framerate', String(FPS), '-i', path.join(V4, 'toque_%02d.png')))
    const iBg = 1 + anillos.length
    ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, 'fondo-marca.png'))
    for (const f of ['marco-fondo.png', 'marco-mask.png']) ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(CAPAS_RUTA, f))
    const iTit = iBg + 3
    ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.tit)
    let fc = `[0:v]setpts=(PTS-STARTPTS)/${vel},fps=${FPS},scale=w='${W}*(${e.z0}+(${e.z1}-${e.z0})*min(1,t/${e.d}))':h=-2:eval=frame,` +
      `crop=${W}:${H}:x='clip(${e.fx}*iw/${W}-${W / 2},0,iw-${W})':y='clip(${e.fy}*iw/${W}-${H / 2},0,ih-${H})',setsar=1,format=yuv420p[b0]`
    anillos.forEach((r, i) => {
      const [x, y] = enPantalla(e, r.k, r.x, r.y)
      fc += `;[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${Math.max(0, r.k).toFixed(3)}/TB[r${i}];[b${i}][r${i}]overlay=x=${x - 160}:y=${y - 160}:eof_action=pass[b${i + 1}]`
      e.pops = (e.pops || []).concat([Math.max(0, r.k)])
    })
    const ult = `b${anillos.length}`
    fc += `;[${ult}]trim=duration=${e.d},setpts=PTS-STARTPTS,scale=972:1728,format=rgba[sc];[${iBg + 2}:v]format=gray[mk];[sc][mk]alphamerge[sm];` +
      `[${iBg}:v][${iBg + 1}:v]overlay=0:0:format=auto[g1];[g1][sm]overlay=54:330:format=auto[g2]` +
      `;[${iTit}:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1,fade=t=out:st=${(e.d - 0.3).toFixed(2)}:d=0.22:alpha=1[ti];[g2][ti]overlay=0:'-28*(1-min(1,max(0,t-0.1)/0.25))':format=auto[g3]` +
      `;[g3]trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`
    run([...ins, '-filter_complex', fc, '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'panel') {
    // El panel de empresa: la captura dentro de un marco, con la cámara entrando hacia el mapa.
    const n = Math.round(e.d * FPS)
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, 'fondo-marca.png'),
      '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(CAPAS, 'panel-fondo.png'),
      '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', PANEL,
      '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(CAPAS, 'panel-mask.png'),
      '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.tit, '-filter_complex',
      `[2:v]scale=2000:1250,zoompan=z='1.08+0.85*on/${n}':d=1:x='(iw-iw/zoom)*0.70':y='(ih-ih/zoom)*0.76':s=1000x625:fps=${FPS},format=rgba[p];[3:v]format=gray[m];[p][m]alphamerge[pm];` +
      `[0:v][1:v]overlay=0:0:format=auto[a];[a][pm]overlay=40:760:format=auto[b];` +
      `[4:v]format=rgba,fade=t=in:st=0.1:d=0.25:alpha=1,fade=t=out:st=${(e.d - 0.3).toFixed(2)}:d=0.22:alpha=1[ti];[b][ti]overlay=0:'-28*(1-min(1,max(0,t-0.1)/0.25))':format=auto,trim=duration=${e.d},setpts=PTS-STARTPTS,format=yuv420p[v]`,
      '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'tarjeta') {
    const ins = ['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, 'fondo-marca.png'), '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', e.png]
    let fc = `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,10),1.1-0.1*on/10,1+0.02*(on-10)/${Math.round(e.d * FPS)})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}[c0]`
    ;(e.extra || []).forEach((x, i) => {
      ins.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', x.png)
      const st = Math.max(0, x.t - e.t0).toFixed(2)
      fc += `;[${2 + i}:v]format=rgba,fade=t=in:st=${st}:d=0.3:alpha=1[x${i}];[c${i}][x${i}]overlay=0:'30*(1-min(1,max(0,t-${st})/0.3))':format=auto[c${i + 1}]`
    })
    fc += `;[c${(e.extra || []).length}]format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`
    run([...ins, '-filter_complex', fc, '-map', '[v]', ...enc, out])
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

// ── Sonido medido ────────────────────────────────────────────────────────────────────────────────
run(['-f', 'lavfi', '-i', 'sine=frequency=1900:duration=0.09:sample_rate=48000', '-af', 'afade=t=in:st=0:d=0.004,afade=t=out:st=0.06:d=0.03,volume=0.8,aformat=channel_layouts=stereo', path.join(tmp, 'bip.wav')])
const SFX = { whoosh: path.join(V4, 'whoosh.wav'), ding: path.join(V4, 'ding.wav'), subida: path.join(V4, 'subida.wav'), pop: path.join(V4, 'pop.wav'), bip: path.join(tmp, 'bip.wav') }
const medir = (f) => {
  const out = leeErr(['-i', f, '-af', 'volumedetect,ebur128=framelog=quiet'])
  return { I: parseFloat((out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), pico: parseFloat((out.match(/max_volume: (-?[\d.]+) dB/) || [])[1]) }
}
const OBJ = { whoosh: { I: -29 }, ding: { I: -29 }, subida: { I: -28 }, pop: { pico: -24 }, bip: { pico: -16 } }
const G = Object.fromEntries(Object.keys(OBJ).map((n) => {
  const m = medir(SFX[n]); const o = OBJ[n]
  return [n, +((o.I !== undefined && isFinite(m.I) && m.I > -60 ? o.I - m.I : o.pico - m.pico)).toFixed(2)]
}))
const mMus = medir(path.join(V4, 'musica.wav'))
G.musica = +(-23 - mMus.I).toFixed(2)
console.log('ganancias (dB):', JSON.stringify(G))

const efectos = []
const fx = (nombre, t) => efectos.push({ f: SFX[nombre], t: Math.max(0, t), g: G[nombre], nombre })
for (const tr of TRANS) fx('whoosh', tr.t - 0.21)
for (const e of S) {
  for (const k of e.pops || []) fx('pop', e.t0 + k)
  for (const k of e.bipsT || []) fx('bip', e.t0 + k - 0.05)
}
if (BONO) fx('pop', 0.12)
fx('whoosh', T.interesa - 0.15)
const eEnt = S.find((e) => e.id === 'entregado')
fx('ding', T.entregado + Math.min(eEnt.d - 0.5, (M.entregado.t - eEnt.a) / (eEnt.vel || 1) + 0.15))
fx('subida', T.cierre - 1.3)
fx('pop', A(F('lema').ini) + 0.05)

const mezcla = (salida, video) => {
  const aIn = ['-i', video, '-i', VOZ, '-i', path.join(V4, 'musica.wav')]
  const fil = []; let i = 3
  efectos.forEach((e, k) => { aIn.push('-i', e.f); const ms = Math.round(e.t * 1000); fil.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${e.g}dB,adelay=${ms}|${ms}[e${k}]`); i++ })
  const msVoz = Math.round(VO * 1000)
  let fc = fil.join(';') + ';'
  fc += `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${msVoz}|${msVoz}[voz];[voz]asplit=2[vz1][vz2];`
  fc += `[2:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${FIN},volume=${G.musica}dB,afade=t=in:st=0:d=0.25,afade=t=out:st=${(FIN - 1.8).toFixed(2)}:d=1.8[mus];`
  fc += `${efectos.map((_, k) => `[e${k}]`).join('')}amix=inputs=${efectos.length}:normalize=0[sfx];`
  fc += `[mus][vz2]sidechaincompress=threshold=0.05:ratio=2.2:attack=40:release=500:makeup=1[musd];[vz1][musd][sfx]amix=inputs=3:normalize=0[pre]`
  const crudo = path.join(tmp, `crudo-${path.basename(salida)}.wav`)
  run([...aIn, '-filter_complex', fc, '-map', '[pre]', '-t', String(FIN), '-c:a', 'pcm_s16le', crudo])
  const m = leeErr(['-i', crudo, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json'])
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  const master = path.join(tmp, `master-${path.basename(salida)}.wav`)
  run(['-i', crudo, '-af', `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', '48000', master])
  run(['-i', video, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(FIN), '-movflags', '+faststart', salida])
  const t = medir(master)
  console.log(`${path.basename(salida)}: máster ${t.I} LUFS · pico ${t.pico} dBFS`)
}

// ── Salidas ──────────────────────────────────────────────────────────────────────────────────────
const finalB = path.join(tmp, 'final-B.mp4'); mezcla(finalB, unido)
// A: el mismo vídeo con el cierre del QR.
const iC = S.length - 1
const cierreA = path.join(tmp, 'cierreA.mp4')
run(['-loop', '1', '-framerate', String(FPS), '-t', String(S[iC].d), '-i', path.join(V4, 'fondo-marca.png'), '-loop', '1', '-framerate', String(FPS), '-t', String(S[iC].d), '-i', path.join(CAPAS, 'cierre-A.png'),
  '-loop', '1', '-framerate', String(FPS), '-t', String(S[iC].d), '-i', path.join(CAPAS, 'lema-A.png'), '-filter_complex',
  `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,10),1.06-0.06*on/10,1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}[c0];` +
  `[2:v]format=rgba,fade=t=in:st=${Math.max(0, S[iC].extra[0].t - S[iC].t0).toFixed(2)}:d=0.3:alpha=1[x0];[c0][x0]overlay=0:0:format=auto,format=yuv420p,trim=duration=${S[iC].d},setpts=PTS-STARTPTS[v]`,
  '-map', '[v]', ...enc, cierreA])
const unidoA = path.join(tmp, 'unido-A.mp4'); unir([...clips.slice(0, -1), cierreA], unidoA)
const finalA = path.join(tmp, 'final-A.mp4'); mezcla(finalA, unidoA)

const suf = BONO ? '' : '-sin-gancho'
const v = (base, nombre, args) => {
  const dest = path.join(SALIDA, `spot-dani-${nombre}${suf}.mp4`)
  run(['-i', base, ...args, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', dest])
  console.log('→', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB')
}
const columna = (an, al) => ['-filter_complex', `[0:v]split[a][b];[a]scale=${an}:${al}:force_original_aspect_ratio=increase,crop=${an}:${al},boxblur=40:3,eq=brightness=-0.3:saturation=0.9[bg];[b]scale=-2:${al}[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]`, '-map', '[v]', '-map', '0:a']
v(finalB, '9x16-B', [])
v(finalA, '9x16-A-qr', [])
v(finalB, '4x5-B', columna(1080, 1350))
v(finalB, '1x1-B', columna(1080, 1080))
v(finalA, '16x9-A-qr', columna(1920, 1080))
// Spotify (vídeo de 30 s como máximo): desde que empieza la voz, 30,0 s justos.
if (BONO) v(finalB, '9x16-B-30s', ['-ss', String(T.pregunta1), '-t', '30'])
fs.writeFileSync(path.join(SD, `montaje${suf}.json`), JSON.stringify({ voz: path.basename(VOZ), inicioVoz: VO, fin: FIN, ganancias: G, escenas: S.map(({ id, t0, d, vel }) => ({ id, t0, d, vel })), efectos: efectos.map(({ nombre, t, g }) => ({ nombre, t: +t.toFixed(3), g })) }, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
