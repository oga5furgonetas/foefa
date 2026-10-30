// Voces de Artlist para el anuncio «La ruta hecha» en otros idiomas (30-10-2026, docs/anuncios/internacional/).
// Las voces se generan con el conector de Artlist desde la sesión (una por frase + el anuncio de Spotify) y se
// bajan a voces/<idioma>/f1..f6.mp3 y spotify.mp3; este script escribe voces/<idioma>/voz.json (duración de cada
// frase medida con ffprobe) con el formato que lee scripts/montar-spot-ruta.mjs.
//   node scripts/spot-ruta/voces-internacional.mjs [urls.json]   (urls.json: { en: [7 urls], pt: [...] } para bajarlas)
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const INT = path.join(RAIZ, 'docs', 'anuncios', 'internacional')
const TX = JSON.parse(fs.readFileSync(path.join(INT, 'textos.json'), 'utf8'))
const dur = (f) => +parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' })).toFixed(3)

const urls = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {}
for (const [idioma, lista] of Object.entries(urls)) {
  const dir = path.join(INT, 'voces', idioma)
  fs.mkdirSync(dir, { recursive: true })
  for (let i = 0; i < lista.length; i++) {
    const nombre = i < 6 ? `f${i + 1}.mp3` : 'spotify.mp3'
    const r = await fetch(lista[i])
    if (!r.ok) throw new Error(`${idioma} ${nombre}: ${r.status}`)
    fs.writeFileSync(path.join(dir, nombre), Buffer.from(await r.arrayBuffer()))
    console.log('bajada', idioma, nombre)
  }
}

for (const idioma of Object.keys(TX).filter((k) => k !== '_' && k !== 'es')) {
  const dir = path.join(INT, 'voces', idioma)
  if (!fs.existsSync(path.join(dir, 'f6.mp3'))) { console.log(idioma, 'sin voces todavía'); continue }
  const t = TX[idioma]
  const frases = t.frases.map((visto, i) => {
    const fichero = `voces/${idioma}/f${i + 1}.mp3`
    return { n: i + 1, leido: i === 5 ? t.leido6 : visto, visto, fichero, dur: dur(path.join(INT, fichero)), palabras: [] }
  })
  const spotify = fs.existsSync(path.join(dir, 'spotify.mp3')) ? dur(path.join(dir, 'spotify.mp3')) : null
  fs.writeFileSync(path.join(dir, 'voz.json'), JSON.stringify({ voz: t.voz.nombre, modelo: 'Artlist (Eleven v3)', settings: t.voz.settings, frases, spotify_dur: spotify }, null, 1))
  console.log(idioma, frases.map((f) => f.dur).join(' '), '· spotify', spotify)
}
