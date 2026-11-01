// Rasteriza un SVG a PNG con el Chromium de Playwright (para mandarlo al móvil).
//   node svg_a_png.mjs entrada.svg salida.png
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [entrada, salida] = process.argv.slice(2)
const svg = readFileSync(entrada, 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 760 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0d10">${svg}</body></html>`)
await page.waitForTimeout(300)
await page.screenshot({ path: salida, fullPage: false })
await browser.close()
console.log('png:', salida)
