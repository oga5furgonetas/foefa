// Monta los vídeos de TikTok/Reels a partir de la grabación de
// e2e/video-tiktok.spec.js: escala a 1080×1920, pone la VOZ EN OFF de cada
// idioma sincronizada con los rótulos (los instantes están en <idioma>.json)
// y una base musical suave debajo. Sin voz un anuncio de vídeo no vende
// (04-10-2026, Dani: «los vídeos van sin sonido… lamentables»).
//
//   node e2e/video-montar.mjs            → docs/videos/tiktok-<idioma>.mp4 y public/videos/
//
// Necesita: ffmpeg (winget Gyan.FFmpeg) y `py -3 -m pip install edge-tts`
// (voces neuronales de Microsoft, gratis, sin cuenta).
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FFMPEG = process.env.FFMPEG || [
  'ffmpeg',
  path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'),
].find((f) => { try { execFileSync(f, ['-version'], { stdio: 'ignore' }); return true } catch { return false } })
if (!FFMPEG) throw new Error('No encuentro ffmpeg')

const ORIGEN = path.join(process.cwd(), 'test-results', 'video-tiktok')
const SALIDAS = [path.join(process.cwd(), '..', 'docs', 'videos'), path.join(process.cwd(), 'public', 'videos')]

/* Lo que dice la voz en cada rótulo (misma promesa que el anuncio y la landing,
   nada que la app no haga). La última frase va sobre el cierre «GRATIS 7 días». */
const GUION = {
  es: { voz: 'es-ES-AlvaroNeural', frases: [
    '¿Todavía ordenas la ruta a mano?',
    'Haz una foto a la etiqueta y la dirección entra sola.',
    'La ruta se ordena sola por tiempo, con el tráfico.',
    'Y te guía con voz hasta cada puerta.',
    'Entregado. Siguiente.',
    'Pruébala gratis siete días, sin registrarte. FDS, en flotadsp punto com.'] },
  en: { voz: 'en-US-GuyNeural', frases: [
    'Still planning your route by hand?',
    'Snap the label and the address goes in by itself.',
    'The route sorts itself by time, with traffic.',
    'And it guides you by voice to every door.',
    'Delivered. Next.',
    'Try it free for seven days, no sign-up. FDS, at flotadsp dot com.'] },
  pt: { voz: 'pt-PT-DuarteNeural', frases: [
    'Ainda ordenas a rota à mão?',
    'Tira uma foto à etiqueta e a morada entra sozinha.',
    'A rota ordena-se sozinha por tempo, com o trânsito.',
    'E guia-te por voz até cada porta.',
    'Entregue. Seguinte.',
    'Experimenta grátis sete dias, sem registo. FDS, em flotadsp ponto com.'] },
  fr: { voz: 'fr-FR-HenriNeural', frases: [
    'Vous triez encore votre tournée à la main ?',
    'Photographiez l’étiquette : l’adresse est saisie toute seule.',
    'La tournée se trie toute seule, avec le trafic.',
    'Et elle vous guide à la voix jusqu’à chaque porte.',
    'Livré. Suivant.',
    'Essayez gratuitement sept jours, sans inscription. FDS, sur flotadsp point com.'] },
  it: { voz: 'it-IT-DiegoNeural', frases: [
    'Ordini ancora il giro a mano?',
    'Fai una foto all’etichetta e l’indirizzo entra da solo.',
    'Il percorso si ordina da solo per tempo, con il traffico.',
    'E ti guida con la voce fino a ogni porta.',
    'Consegnato. Avanti.',
    'Provala gratis per sette giorni, senza registrarti. FDS, su flotadsp punto com.'] },
  de: { voz: 'de-DE-ConradNeural', frases: [
    'Planst du deine Tour noch von Hand?',
    'Etikett fotografieren, und die Adresse ist drin.',
    'Die Route sortiert sich von selbst nach Zeit, mit Verkehr.',
    'Und sie führt dich per Sprache bis zu jeder Tür.',
    'Zugestellt. Weiter.',
    'Teste sie sieben Tage gratis, ohne Anmeldung. FDS, auf flotadsp punkt com.'] },
  zh: { voz: 'zh-CN-YunxiNeural', frases: [
    '还在手动排路线吗？',
    '拍一下面单，地址自动录入。',
    '路线按时间自动排好，还考虑路况。',
    '并用中文语音导航到每个门口。',
    '已送达，下一站。',
    '免注册，免费试用七天。FDS，flotadsp 点 com。'] },
}

function run(args, input) {
  return execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { input, stdio: ['pipe', 'pipe', 'inherit'] })
}
function duracion(f) {
  const out = execFileSync(FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()
  return parseFloat(out)
}

function voz(lang, i, texto, destino) {
  if (fs.existsSync(destino)) return
  execFileSync('py', ['-3', '-m', 'edge_tts', '--voice', GUION[lang].voz, '--rate=+8%', '--text', texto, '--write-media', destino], { stdio: 'inherit' })
}

/* Base musical: un «pad» de dos acordes y un pulso suave a 100 bpm, hecha con
   el sintetizador de ffmpeg. Sin derechos de nadie y siempre por debajo de la voz. */
function musica(destino, segundos) {
  const pad = (f) => `0.08*sin(2*PI*${f}*t)*(0.6+0.4*sin(2*PI*0.25*t))`
  const expr = `${pad(110)}+${pad(164.8)}+${pad(220)}+${pad(261.6)}+0.5*sin(2*PI*55*t)*exp(-12*(t-0.6*floor(t/0.6)))`
  run(['-f', 'lavfi', '-i', `aevalsrc=${expr}|${expr}:s=44100:d=${segundos}`, '-af', 'lowpass=f=1800,volume=0.9', destino])
}

for (const [lang, g] of Object.entries(GUION)) {
  const webm = path.join(ORIGEN, `${lang}.webm`)
  const marcasF = path.join(ORIGEN, `${lang}.json`)
  if (!fs.existsSync(webm) || !fs.existsSync(marcasF)) { console.log(`(${lang}) sin grabación, salto`); continue }
  const { marcas } = JSON.parse(fs.readFileSync(marcasF, 'utf8'))
  const total = duracion(webm)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `tiktok-${lang}-`))

  // La voz: un clip por frase, colocado en el instante de su rótulo.
  const clips = g.frases.map((t, i) => { const f = path.join(tmp, `v${i}.mp3`); voz(lang, i, t, f); return f })
  const inicios = clips.map((_, i) => Math.max(0.3, (marcas[i] ?? total - 4) + 0.15))
  const musicaF = path.join(tmp, 'musica.wav'); musica(musicaF, Math.ceil(total) + 1)

  const entradas = ['-i', webm, '-i', musicaF]
  clips.forEach((c) => entradas.push('-i', c))
  const delays = clips.map((_, i) => `[${i + 2}:a]adelay=${Math.round(inicios[i] * 1000)}|${Math.round(inicios[i] * 1000)},volume=1.6[v${i}]`).join(';')
  const mezcla = clips.map((_, i) => `[v${i}]`).join('')
  const filtro = `${delays};${mezcla}amix=inputs=${clips.length}:normalize=0[voz];` +
    `[1:a]volume=0.35,afade=t=out:st=${(total - 1.5).toFixed(2)}:d=1.5[mus];` +
    `[voz][mus]amix=inputs=2:normalize=0,alimiter=limit=0.95[a];` +
    `[0:v]scale=1080:1920:flags=lanczos,format=yuv420p[v]`
  const salida = path.join(tmp, `tiktok-${lang}.mp4`)
  run([...entradas, '-filter_complex', filtro, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', salida])
  for (const d of SALIDAS) { fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(salida, path.join(d, `tiktok-${lang}.mp4`)) }
  console.log(`${lang}: ${total.toFixed(1)} s, voz en ${inicios.map((s) => s.toFixed(1)).join(' / ')} s`)
}
