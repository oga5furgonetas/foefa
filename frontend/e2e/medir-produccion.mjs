// Mide producción como la vería un móvil: TTFB, FCP, LCP, peso transferido, peticiones y tareas largas.
// Sin Lighthouse (no está instalado): Chromium de Playwright con emulación de móvil y red 4G acotada.
//   node e2e/medir-produccion.mjs https://flotadsp.com/ https://flotadsp.com/planes
import { chromium, devices } from '@playwright/test'

const urls = process.argv.slice(2)
const browser = await chromium.launch()
for (const url of urls) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  // 4G normalito: 9 Mbps bajada, 1,5 Mbps subida, 150 ms de ida y vuelta; CPU x4 más lenta.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  let bytes = 0, n = 0
  const porTipo = {}
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; n += 1 })
  cdp.on('Network.responseReceived', (e) => { const t = e.type || '?'; porTipo[t] = (porTipo[t] || 0) + 1 })
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0; window.__long = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration }).observe({ type: 'longtask', buffered: true })
  })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(4000)
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return { ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
             fcp: Math.round(fcp ? fcp.startTime : 0), lcp: Math.round(window.__lcp), cls: Math.round(window.__cls * 1000) / 1000,
             tareasLargas: Math.round(window.__long), titulo: document.title, h1: (document.querySelector('h1') || {}).innerText || '' }
  })
  console.log(JSON.stringify({ url, ...m, peticiones: n, kB: Math.round(bytes / 1024), porTipo, segundosTotales: Math.round((Date.now() - t0) / 100) / 10 }))
  await ctx.close()
}
await browser.close()
