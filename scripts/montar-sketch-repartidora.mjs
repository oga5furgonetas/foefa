// SKETCH «¿AÚN REPARTES A OJO?» (05-10-2026), formato de TikTok: rótulos grandes encima de la
// persona (como los vídeos de «X en 30 s» que funcionan en esa red), voz femenina neuronal,
// ritmo rápido (≈20 s) y la app REAL en los tres pasos. Sin testimonios ni cifras inventadas.
//
//   node scripts/montar-sketch-repartidora.mjs
//   → docs/anuncios/reales/salida/sketch-repartidora-9x16.mp4 (1080x1920) y -720p.mp4
//
// Necesita (fuera de git, ver docs/anuncios/reales/.gitignore):
//   docs/anuncios/reales/stock/pexels-*.mp4   planos de Pexels (licencia en stock/LICENCIAS.txt)
//   docs/anuncios/reales/sketch/s1..s8.mp3    la voz (edge-tts es-ES-ElviraNeural, +12 %; texto en guion.txt)
//   frontend/test-results/spot-material/es.webm  la app grabada limpia
//     (npx playwright test e2e/spot-material.spec.js --project=escritorio --update-snapshots)
//
// LICENCIA DE PEXELS: las personas que salen NO pueden aparecer usando ni recomendando FDS.
// Por eso los planos de archivo solo cuentan el problema (buscar calles, apuntar a mano) y la app
// sale aparte, en su propia pantalla. No cambiar eso.
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FF = process.env.FFMPEG || 'ffmpeg'
const RAIZ = process.cwd()
const STOCK = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'stock')
const VOZ = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'sketch')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'salida')
const APP = process.env.APP_WEBM || path.join(RAIZ, 'frontend', 'test-results', 'spot-material', 'es.webm')
fs.mkdirSync(SALIDA, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-'))
// Las fuentes se copian al directorio de trabajo: así el filtro no lleva rutas con «C:».
fs.copyFileSync('C:/Windows/Fonts/georgiab.ttf', path.join(tmp, 'serif.ttf'))
fs.copyFileSync('C:/Windows/Fonts/arialbd.ttf', path.join(tmp, 'sans.ttf'))
const run = (args) => execFileSync(FF, ['-y', '-v', 'error', ...args], { stdio: 'inherit', cwd: tmp })

const FONDO = '0x061a1f'
// LA VOZ MANDA EL RITMO: cada escena dura lo que su frase (s1..s8) más un respiro.
// Se mide dónde acaba de hablar cada fichero (silencedetect), así se puede cambiar
// la voz —otra voz sintética o una persona de verdad— sin tocar ningún número.
const finDeVoz = (f) => {
  const r = spawnSync(FF, ['-v', 'info', '-i', f, '-af', 'silencedetect=n=-40dB:d=0.15', '-f', 'null', '-'], { encoding: 'utf8' })
  const m = [...(r.stderr || '').matchAll(/silence_start: ([0-9.]+)/g)].map((x) => parseFloat(x[1]))
  const total = parseFloat((spawnSync(FF.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout || '0').trim())
  return m.length ? m[m.length - 1] : total
}
const RESPIRO = 0.12
// Cada rótulo: [texto, fuente, tamaño, color, y, desde (s dentro de la escena)]
const R = (texto, y, { fuente = 'serif', tam = 92, color = 'white', desde = 0 } = {}) => ({ texto, fuente, tam, color, y, desde })
// VARIANTES DEL GANCHO: en anuncios gana quien prueba varios primeros segundos a la vez y se
// queda con el que trae altas. Solo cambia la primera frase (voz y rótulo); el resto es igual.
//   VARIANTE=pov|directo|nadie node scripts/montar-sketch-repartidora.mjs
const GANCHOS = {
  base: [R('SI ERES REPARTIDOR/A', 1030, { fuente: 'sans', tam: 44, color: '0x5eead4' }), R('¿AÚN REPARTES', 1100), R('A OJO?', 1205)],
  pov: [R('POV:', 1000, { tam: 84 }), R('PRIMER DÍA', 1100), R('REPARTIENDO', 1205)],
  directo: [R('REPARTIDORES', 1000, { tam: 88 }), R('DE PAQUETERÍA:', 1100, { tam: 88 }), R('ESTO OS INTERESA', 1205, { tam: 80 })],
  nadie: [R('LO QUE NADIE', 1000), R('TE CUENTA AL', 1100), R('EMPEZAR A REPARTIR', 1205, { tam: 78 })],
}
const VARIANTE = process.env.VARIANTE || 'base'
if (!GANCHOS[VARIANTE]) throw new Error(`VARIANTE desconocida: ${VARIANTE}`)
const VOCES = []
let t = 0
for (let i = 1; i <= 8; i++) {
  const f = path.join(VOZ, i === 1 && VARIANTE !== 'base' ? `h_${VARIANTE}.mp3` : `s${i}.mp3`)
  const fin = finDeVoz(f)
  VOCES.push({ f, t, fin })
  t += fin + RESPIRO
}
const FIN = Math.round((VOCES[7].t + VOCES[7].fin + 1.1) * 10) / 10
// Cada escena va de que empieza su frase a que empieza la siguiente (el corte, justo antes de hablar).
const tramo = (i) => {
  const t0 = i === 0 ? 0 : VOCES[i].t + 0.1
  const t1 = i === 7 ? FIN : VOCES[i + 1].t + 0.1
  return { t0, d: Math.round((t1 - t0) * 100) / 100 }
}

// Escenas (una por frase): de archivo (el problema) o de la app (la solución), sin huecos.
const ESCENAS = [
  { stock: 'pexels-13433120.mp4', ss: 3.0, rotulos: GANCHOS[VARIANTE] },
  { stock: 'pexels-13441291.mp4', ss: 4.0, rotulos: [
    R('Dando vueltas', 1120, { tam: 84 }), R('buscando la calle…', 1215, { tam: 84 })] },
  { stock: 'pexels-5054453.mp4', ss: 3.0, rotulos: [
    R('…y la ruta,', 1120, { tam: 84 }), R('en un papel', 1220, { tam: 84 })] },
  { stock: 'pexels-13441317.mp4', ss: 1.5, rotulos: [
    R('Mira, en 3 pasos', 1150, { tam: 90 })] },
  { app: 0.8, rotulos: [
    R('1. FOTO A LA ETIQUETA', 150, { tam: 70 }), R('y la dirección se pone sola', 245, { fuente: 'sans', tam: 46, color: '0x5eead4' })] },
  { app: 8.7, rotulos: [
    R('2. RUTA ORDENADA SOLA', 150, { tam: 70 }), R('por tiempo, con hora de llegada', 245, { fuente: 'sans', tam: 46, color: '0x5eead4' })] },
  { app: 12.2, rotulos: [
    R('3. TE LLEVA A CADA PUERTA', 150, { tam: 66 }), R('con voz, sin pensar', 245, { fuente: 'sans', tam: 46, color: '0x5eead4' })] },
  { cierre: 16.8, rotulos: [
    R('FDS', 640, { fuente: 'sans', tam: 150, color: '0x0FC2BC' }),
    R('PRUÉBALA GRATIS', 830, { tam: 96 }), R('7 DÍAS', 945, { tam: 120 }),
    R('Sin tarjeta', 1100, { fuente: 'sans', tam: 56, color: '0x5eead4', desde: 0.6 }),
    R('flotadsp.com/repartidores', 1210, { fuente: 'sans', tam: 52, desde: 1.2 })] },
].map((e, i) => ({ ...e, ...tramo(i) }))
console.log('duración', FIN, 's; escenas', ESCENAS.map((e) => e.d).join(' '))

// drawtext con el texto en un fichero (tildes, «¿» y comas sin escapar nada) y aparición rápida.
let nTexto = 0
const dibujar = (rs) => rs.map((r) => {
  const f = `t${nTexto++}.txt`
  fs.writeFileSync(path.join(tmp, f), r.texto)
  return `drawtext=fontfile=${r.fuente}.ttf:textfile=${f}:fontsize=${r.tam}:fontcolor=${r.color}` +
    ':shadowcolor=black@0.7:shadowx=4:shadowy=4:borderw=3:bordercolor=black@0.45' +
    `:x=(w-text_w)/2:y=${r.y}:enable='gte(t,${r.desde})':alpha='min(1,(t-${r.desde})/0.12)'`
}).join(',')

const partes = []
ESCENAS.forEach((e, i) => {
  const out = `e${i}.mp4`
  if (e.stock) {
    // Vertical a pantalla completa, con un empuje lento y el tono un poco más vivo.
    run(['-ss', String(e.ss), '-t', String(e.d), '-i', path.join(STOCK, e.stock), '-an', '-vf',
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,' +
      `scale=w='1080*(1+0.07*t/${e.d})':h=-2:eval=frame,crop=1080:1920,fps=30,` +
      'eq=contrast=1.06:saturation=1.12,' +
      // Sombra abajo para que el rótulo se lea sobre cualquier fondo.
      "drawbox=x=0:y=950:w=1080:h=420:color=black@0.28:t=fill," + dibujar(e.rotulos) + ',format=yuv420p',
      '-t', String(e.d), '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', out])
  } else if (e.app !== undefined) {
    // La app dentro de un marco sobre el fondo de marca, el rótulo arriba.
    run(['-f', 'lavfi', '-i', `color=c=${FONDO}:s=1080x1920:r=30:d=${e.d}`,
      '-ss', String(e.app), '-t', String(e.d), '-i', APP, '-filter_complex',
      '[1:v]scale=900:1600,fps=30[app];[0:v][app]overlay=90:330,' +
      "drawbox=x=86:y=326:w=908:h=1608:color=0x0FC2BC@0.55:t=4," + dibujar(e.rotulos) + ',format=yuv420p[v]',
      '-map', '[v]', '-t', String(e.d), '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', out])
  } else {
    // Cierre: la app entregando, oscurecida y desenfocada, con la oferta encima.
    run(['-ss', String(e.cierre), '-i', APP, '-f', 'lavfi', '-i', `color=c=${FONDO}:s=1080x1920:r=30:d=${e.d}`,
      '-filter_complex',
      '[0:v]trim=duration=0.1,loop=loop=-1:size=3,setpts=N/30/TB,scale=1080:1920,gblur=sigma=30,eq=brightness=-0.55:saturation=0.6[f];' +
      `[1:v][f]overlay=0:0:shortest=1,` + dibujar(e.rotulos) + ',format=yuv420p[v]',
      '-map', '[v]', '-t', String(e.d), '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', out])
  }
  partes.push(out)
})
fs.writeFileSync(path.join(tmp, 'lista.txt'), partes.map((p) => `file '${p}'`).join('\n'))
run(['-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', 'video.mp4'])

// Música: 120 pulsaciones (bombo, charles y bajo) sintetizada aquí; sin derechos de nadie.
const bombo = '0.55*sin(2*PI*52*t)*exp(-14*mod(t,0.5))'
const charles = '0.05*(random(0)*2-1)*exp(-70*mod(t+0.25,0.5))'
const bajo = '0.10*sin(2*PI*(55+27.5*lt(mod(t,4),2))*t)*(0.6+0.4*exp(-6*mod(t,0.25)))'
run(['-f', 'lavfi', '-i', `aevalsrc='${bombo}+${charles}+${bajo}|${bombo}+${charles}+${bajo}':s=44100:d=${FIN}`,
  '-af', `afade=t=in:d=0.3,afade=t=out:st=${FIN - 1.2}:d=1.2,volume=0.9`, 'musica.wav'])

// Voz encima de la música, con la música bajando cuando habla (sidechain). La voz se trata
// como una grabación de móvil en una habitación: sin graves de estudio, compresión, un
// eco de sala cortísimo y ruido de fondo muy bajo. Así no suena a locutor ni a máquina.
const entradas = VOCES.flatMap((v) => ['-i', v.f])
const retardos = VOCES.map((v, i) => `[${i + 1}:a]adelay=${Math.round(v.t * 1000)}|${Math.round(v.t * 1000)}[v${i}]`).join(';')
const nRuido = VOCES.length + 2
const cadena = `${retardos};${VOCES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${VOCES.length}:normalize=0,volume=1.7,` +
  'highpass=f=120,lowpass=f=8500,equalizer=f=2800:t=q:w=1.2:g=3,' +
  'acompressor=threshold=-22dB:ratio=3.5:attack=6:release=90:makeup=2,aecho=0.85:0.6:14|27:0.10|0.06,asplit=2[voz][llave];' +
  `[${VOCES.length + 1}:a][llave]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=250[mus];` +
  `[${nRuido}:a]volume=0.5[sala];` +
  '[voz][mus][sala]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9[a]'
const sufijo = VARIANTE === 'base' ? '' : `-${VARIANTE}`
const final = path.join(SALIDA, `sketch-repartidora${sufijo}-9x16.mp4`)
execFileSync(FF, ['-y', '-v', 'error', '-i', path.join(tmp, 'video.mp4'), ...entradas, '-i', path.join(tmp, 'musica.wav'),
  '-f', 'lavfi', '-i', `anoisesrc=color=brown:amplitude=0.006:d=${FIN}`,
  '-filter_complex', cadena, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-ar', '44100', '-t', String(FIN), '-movflags', '+faststart', final], { stdio: 'inherit' })
execFileSync(FF, ['-y', '-v', 'error', '-i', final, '-vf', 'scale=720:1280', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '23', '-c:a', 'copy', '-movflags', '+faststart', path.join(SALIDA, `sketch-repartidora${sufijo}-720p.mp4`)], { stdio: 'inherit' })
console.log('listo:', final)
