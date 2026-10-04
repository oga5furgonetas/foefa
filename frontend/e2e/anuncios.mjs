// Genera los anuncios de la app del repartidor (feed 4:5 y historia 9:16).
// Uso, desde frontend/:  node e2e/anuncios.mjs [idioma …]   (la plantilla: tools/anuncios/anuncio.html)
// Sin idiomas, todos. Salida: docs/anuncios/<idioma>/{1-feed,2-feed-pasos,3-historia-reels}.png
import { chromium } from '@playwright/test'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const aqui = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'anuncios')
const docs = join(aqui, '..', '..', 'docs', 'anuncios')
const idiomas = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'pt', 'fr', 'it', 'de', 'zh']
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 2000 } })
for (const lang of idiomas) {
  mkdirSync(join(docs, lang), { recursive: true })
  await p.goto(`${pathToFileURL(join(aqui, 'anuncio.html')).href}?lang=${lang}`)
  await p.waitForLoadState('load')
  await p.waitForTimeout(400)
  for (const [id, nombre] of [['a', '1-feed'], ['b', '2-feed-pasos'], ['c', '3-historia-reels']]) {
    await p.locator(`#${id}`).screenshot({ path: join(docs, lang, `${nombre}.png`) })
  }
}
await b.close()
console.log('anuncios:', idiomas.join(' '))
