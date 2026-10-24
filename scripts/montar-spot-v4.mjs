// SPOT V4 (24-10-2026). Dani: «el anterior parece una app del 2001; estudia cómo funcionan los anuncios».
// Cómo son los anuncios de apps que convierten en TikTok/Reels, y cómo se aplica aquí:
//   · gancho en 2 s que nombra al público y su problema  → «📦 REPARTIDORES · ¿Todavía ordenas la ruta a mano?»
//   · la app A PANTALLA COMPLETA haciendo el trabajo, no un móvil pequeño con pantallazos → grabación de 1080 px
//   · cortes rápidos (1,5-3 s), zoom hacia donde se toca y el toque marcado
//   · subtítulos grandes palabra a palabra (en Reels casi todo se ve sin sonido)
//   · oferta clara y cierre con DÓNDE entrar y QUÉ pulsar (flotadsp.com · «Toca el botón de abajo»)
// Sin testimonios ni cifras inventadas: la app se ve haciendo lo que hace (API simulada, trazado real).
//   node scripts/montar-spot-v4.mjs   → docs/anuncios/reales/salida/spot-v4-{9x16,4x5,1x1}{,-sin-voz}.mp4
// Necesita: e2e/spot-v4.spec.js (--update-snapshots) y scripts/spot-v4/{etiqueta.mjs,capas.mjs,voz.py,sonido.py}.
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const V4 = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
const STOCK = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'stock')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida')
const GRAB = path.join(RAIZ, 'frontend', 'test-results', 'spot-v4')
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spotv4-'))
const run = (args, cwd) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', ...args], { stdio: 'inherit', cwd })
const W = 1080, H = 1920, FPS = 30
const sl = (p) => p.split(String.fromCharCode(92)).join('/')
const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS)]

// ── La grabación: de fotogramas sueltos (cuando cambia la pantalla) a vídeo de 30 fps ───────────────
const grab = JSON.parse(fs.readFileSync(path.join(GRAB, 'marcas.json'), 'utf8'))
const T0 = grab.frames[0].t
const M = {}
for (const m of grab.marcas) M[m.texto] = { ...m, t: m.t - T0 }
const lista = grab.frames.map((f, i) => {
  const sig = grab.frames[i + 1] ? grab.frames[i + 1].t : f.t + 0.5
  return `file '${sl(path.join(GRAB, 'frames', f.f))}'\nduration ${Math.max(0.001, sig - f.t).toFixed(4)}`
}).join('\n') + `\nfile '${sl(path.join(GRAB, 'frames', grab.frames.at(-1).f))}'\n`
fs.writeFileSync(path.join(tmp, 'frames.txt'), lista)
const app = path.join(tmp, 'app.mp4')
run(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'frames.txt'), '-vf', `fps=${FPS},scale=1080:-2,crop=1080:2340:0:0,format=yuv420p`, ...enc, app])
const AH = 2340

// ── Voz y tiempos ────────────────────────────────────────────────────────────────────────────────
const voz = JSON.parse(fs.readFileSync(path.join(V4, 'voz.json'), 'utf8'))
const vd = (n) => voz[n - 1].dur

// ── Las escenas ──────────────────────────────────────────────────────────────────────────────────
// app: [desde, duración] en el tiempo de la grabación; foco (fx, fy) en píxeles del fotograma; zoom z0→z1.
const S = []
S.push({ id: 'gancho', d: +(vd(1) + 0.45).toFixed(2), tipo: 'stock' })
S.push({ id: 'camara', d: 0.95, tipo: 'camara' })
const dForm = Math.max(2.3, vd(2) + 0.45 - 0.95)
S.push({ id: 'form', d: +dForm.toFixed(2), tipo: 'app', a: M.leido.t - 0.05, fx: 540, fy: 700, z0: 1.0, z1: 1.04 })
const dOrd = 2.75
S.push({ id: 'ordenar', d: dOrd, tipo: 'app', a: M.tap_ordenar.t - 0.35, fx: 540, fy: 1180, z0: 1.0, z1: 1.04, toques: ['tap_ordenar'] })
const dMapa = Math.max(1.7, vd(3) + 0.45 - dOrd)
S.push({ id: 'mapa', d: +dMapa.toFixed(2), tipo: 'app', a: M.tap_mapa.t - 0.12, fx: 540, fy: 1250, z0: 1.04, z1: 1.16, toques: ['tap_mapa'] })
S.push({ id: 'navega', d: +(vd(4) + 0.5).toFixed(2), tipo: 'app', a: M.tap_navegar.t - 0.1, fx: 540, fy: 820, z0: 1.0, z1: 1.1, toques: [] })
S.push({ id: 'entregado', d: 1.5, tipo: 'app', a: M.tap_entregado.t - 0.3, fx: 540, fy: 2000, z0: 1.0, z1: 1.04, toques: ['tap_entregado'] })
S.push({ id: 'oferta', d: +(vd(5) + 0.45).toFixed(2), tipo: 'tarjeta', png: 'oferta.png', fondo: M.ordenada.t + 1.5 })
S.push({ id: 'cierre', d: +(vd(6) + 1.6).toFixed(2), tipo: 'tarjeta', png: 'cierre.png', fondoPng: 'fondo-marca.png' })
let acum = 0
for (const e of S) { e.t0 = +acum.toFixed(3); acum += e.d }
const FIN = +acum.toFixed(2)
const T = Object.fromEntries(S.map((e) => [e.id, e.t0]))
console.log('duración', FIN, 's ·', S.map((e) => `${e.id}@${e.t0.toFixed(1)}(${e.d})`).join(' '))

// Dónde cae un punto del fotograma en pantalla, en el instante k (s) de una escena de app.
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
    // El problema: metraje de archivo (Pexels) con color de cine, empuje lento y el gancho encima.
    run(['-ss', '2.0', '-t', String(e.d + 0.3), '-i', path.join(STOCK, 'pexels-5054368.mp4'), '-loop', '1', '-t', String(e.d), '-i', path.join(V4, 'gancho.png'), '-an', '-filter_complex',
      `[0:v]scale=${W * 1.15}:${H * 1.15}:force_original_aspect_ratio=increase,crop=${W}:${H},scale=w='iw*(1+0.07*min(1,t/${e.d}))':h=-2:eval=frame,crop=${W}:${H},fps=${FPS},` +
      `eq=contrast=1.1:saturation=1.08:brightness=-0.05,colorbalance=rs=0.04:bs=-0.05:bm=-0.04,vignette=angle=PI/4,setsar=1[f];` +
      `[1:v]format=rgba,fade=t=in:st=0.12:d=0.22:alpha=1[g];[f][g]overlay=0:'40*(1-min(1,max(0,t-0.12)/0.22))',trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'camara') {
    // La foto: la etiqueta en el visor, acercándose, y el destello del obturador.
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, 'camara.png'), '-filter_complex',
      `[0:v]zoompan=z='1.0+0.16*on/${Math.round(e.d * FPS)}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
      `fade=t=out:st=${(e.d - 0.14).toFixed(2)}:d=0.14:color=white,format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'app') {
    const anillos = (e.toques || []).filter((n) => M[n]).map((n) => ({ k: M[n].t - e.a, x: M[n].x, y: M[n].y }))
    const ins = ['-ss', e.a.toFixed(3), '-t', String(e.d), '-i', app]
    anillos.forEach(() => ins.push('-framerate', String(FPS), '-i', path.join(V4, 'toque_%02d.png')))
    let fc = `[0:v]scale=w='${W}*(${e.z0}+(${e.z1}-${e.z0})*min(1,t/${e.d}))':h=-2:eval=frame,` +
      `crop=${W}:${H}:x='clip(${e.fx}*iw/${W}-${W / 2},0,iw-${W})':y='clip(${e.fy}*iw/${W}-${H / 2},0,ih-${H})',setsar=1,fps=${FPS},format=yuv420p[b0]`
    anillos.forEach((r, i) => {
      const [x, y] = enPantalla(e, r.k, r.x, r.y)
      fc += `;[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${Math.max(0, r.k).toFixed(3)}/TB[r${i}];[b${i}][r${i}]overlay=x=${x - 160}:y=${y - 160}:eof_action=pass[b${i + 1}]`
      e.pops = (e.pops || []).concat([Math.max(0, r.k)])
    })
    fc += `;[b${anillos.length}]trim=duration=${e.d},setpts=PTS-STARTPTS[v]`
    run([...ins, '-filter_complex', fc, '-map', '[v]', ...enc, out])
  } else if (e.tipo === 'tarjeta') {
    // La app de fondo, desenfocada y oscurecida, y la tarjeta encima con un pequeño «golpe» de zoom al entrar.
    let fondo = path.join(tmp, `${e.id}-fondo.png`)
    if (e.fondoPng) fondo = path.join(V4, e.fondoPng)
    else run(['-ss', e.fondo.toFixed(3), '-i', app, '-frames:v', '1', '-vf', `crop=${W}:${H}:0:200,boxblur=45:4,eq=brightness=-0.46:saturation=1.1`, fondo])
    run(['-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', fondo, '-loop', '1', '-framerate', String(FPS), '-t', String(e.d), '-i', path.join(V4, e.png), '-filter_complex',
      `[0:v][1:v]overlay=0:0,zoompan=z='if(lt(on,9),1.13-0.13*on/9,1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${e.d},setpts=PTS-STARTPTS[v]`,
      '-map', '[v]', ...enc, out])
  }
  clips.push(out)
}

// ── Unir (cortes secos, como en TikTok) ──────────────────────────────────────────────────────────
const ins = []; clips.forEach((c) => ins.push('-i', c))
const unido = path.join(tmp, 'unido.mp4')
run([...ins, '-filter_complex', clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${clips.length}:v=1:a=0[v]`, '-map', '[v]', ...enc, unido])

// ── Subtítulos palabra a palabra (ASS): las frases 2-4, las que van sobre la app ─────────────────────
const ass = (t) => { const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${s}` }
const INICIO = { 2: T.camara + 0.08, 3: T.ordenar + 0.12, 4: T.navega + 0.12, 5: T.oferta + 0.15, 6: T.cierre + 0.2, 1: T.gancho + 0.25 }
let eventos = ''
for (const n of [2, 3, 4]) {
  const ws = voz[n - 1].palabras
  const trozos = []
  let actual = []
  ws.forEach((w, i) => {
    actual.push({ ...w, i })
    const corte = /[,.…?]$/.test(w.p) || actual.length === 3
    if (corte || i === ws.length - 1) { trozos.push(actual); actual = [] }
  })
  // Lo que se ve: la palabra como se escribe (el texto «visto» de la frase, mismas palabras en el mismo orden).
  const vistas = voz[n - 1].visto.split(/\s+/)
  trozos.forEach((tr, ti) => {
    const siguiente = trozos[ti + 1]
    tr.forEach((w, j) => {
      const ini = INICIO[n] + w.ini
      const sig = tr[j + 1] ? INICIO[n] + tr[j + 1].ini
        : siguiente ? INICIO[n] + siguiente[0].ini : INICIO[n] + tr.at(-1).fin + 0.25
      const texto = tr.map((x, k) => {
        const p = (vistas[x.i] || x.p).replace(/[{}]/g, '')
        return k === j ? `{\\c&H3BD4FF&}${p}{\\c&HFFFFFF&}` : p
      }).join(' ')
      eventos += `Dialogue: 0,${ass(ini)},${ass(sig)},Sub,,0,0,0,,${texto}\n`
    })
  })
}
const ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI Black,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H1E000000,-1,0,0,0,100,100,0,0,4,18,0,2,90,90,500,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos}`
fs.writeFileSync(path.join(tmp, 'subs.ass'), ASS)
fs.mkdirSync(path.join(tmp, 'fuentes'), { recursive: true })
fs.copyFileSync('C:/Windows/Fonts/seguibl.ttf', path.join(tmp, 'fuentes', 'seguibl.ttf'))
const conSubs = path.join(tmp, 'con-subs.mp4')
run(['-i', 'unido.mp4', '-vf', 'subtitles=subs.ass:fontsdir=fuentes', ...enc, 'con-subs.mp4'], tmp)

// ── Sonido: voz tratada, música que se agacha bajo la voz, y efectos donde pasa algo ─────────────────
const efectos = []
const fx = (f, t, g = 1) => efectos.push({ f: path.join(V4, f), t, g })
for (const id of ['camara', 'form', 'ordenar', 'mapa', 'navega', 'entregado', 'oferta']) fx('whoosh.wav', Math.max(0, T[id] - 0.18), 0.55)
fx('obturador.wav', T.form - 0.12, 0.9)
for (const e of S) for (const k of e.pops || []) fx('pop.wav', e.t0 + k, 0.8)
fx('ding.wav', T.entregado + 0.55, 0.75)
fx('subida.wav', T.cierre - 1.25, 0.45)
fx('whoosh.wav', T.cierre - 0.15, 0.7)

const mezcla = (conVoz, salida) => {
  const aIn = ['-i', conSubs]
  const filtros = []
  const etiquetas = []
  let i = 1
  if (conVoz) {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      aIn.push('-i', path.join(V4, voz[n - 1].fichero))
      const ms = Math.round(INICIO[n] * 1000)
      filtros.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,equalizer=f=3200:t=q:w=1.0:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,aecho=0.8:0.6:18:0.08,adelay=${ms}|${ms}[v${n}]`)
      etiquetas.push(`[v${n}]`)
      i++
    }
  }
  aIn.push('-i', path.join(V4, 'musica.wav'))
  const iMus = i++
  efectos.forEach((e, k) => {
    aIn.push('-i', e.f)
    const ms = Math.round(e.t * 1000)
    filtros.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${e.g},adelay=${ms}|${ms}[e${k}]`)
    i++
  })
  let fc = filtros.join(';') + ';'
  fc += `[${iMus}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${FIN},afade=t=in:st=0:d=0.3,afade=t=out:st=${(FIN - 1.6).toFixed(2)}:d=1.6,volume=${conVoz ? 0.62 : 0.9}[mus];`
  const efx = efectos.map((_, k) => `[e${k}]`).join('')
  fc += `${efx}amix=inputs=${efectos.length}:normalize=0[sfx];`
  if (conVoz) {
    fc += `${etiquetas.join('')}amix=inputs=${etiquetas.length}:normalize=0,alimiter=limit=0.92[voz];[voz]asplit=2[vz1][vz2];` +
      `[mus][vz2]sidechaincompress=threshold=0.025:ratio=10:attack=20:release=300:makeup=1[musd];` +
      `[vz1][musd][sfx]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=9[aud]`
  } else {
    fc += `[mus][sfx]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=9[aud]`
  }
  run([...aIn, '-filter_complex', fc, '-map', '0:v', '-map', '[aud]', '-t', String(FIN), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida])
}

const formatos = (base, sufijo) => {
  const v = (fmt, args) => {
    const dest = path.join(SALIDA, `spot-v4-${fmt}${sufijo}.mp4`)
    run(['-i', base, ...args, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dest])
    console.log('→', path.relative(RAIZ, dest), (fs.statSync(dest).size / 1e6).toFixed(1), 'MB')
  }
  v('9x16', [])
  v('4x5', ['-vf', 'crop=1080:1350:0:190'])
  v('1x1', ['-filter_complex', '[0:v]split[a][b];[a]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=28:4,eq=brightness=-0.2[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]', '-map', '[v]', '-map', '0:a'])
}
const final = path.join(tmp, 'final.mp4'); mezcla(true, final); formatos(final, '')
const mudo = path.join(tmp, 'mudo.mp4'); mezcla(false, mudo); formatos(mudo, '-sin-voz')
fs.writeFileSync(path.join(V4, 'escenas.json'), JSON.stringify({ fin: FIN, escenas: S.map(({ id, t0, d }) => ({ id, t0, d })) }, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
