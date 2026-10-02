// Genera las imágenes de los anuncios de lanzamiento de Histor (cuadrado 1080x1080 y vertical 1080x1920).
const { chromium } = require('C:/Users/Usuario/Downloads/histor_work/histor/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const fonts = 'C:/Users/Usuario/Downloads/histor_work/histor/node_modules/@fontsource-variable';
const base = fs.readFileSync(path.join(dir, 'anuncio.html'), 'utf8')
  .replace('FONT_SERIF', 'file:///' + fonts + '/newsreader/files/newsreader-latin-opsz-normal.woff2')
  .replace('FONT_SANS', 'file:///' + fonts + '/inter/files/inter-latin-wght-normal.woff2');

const variants = [
  { name: 'histor-anuncio-A-cuadrado', w: 1080, h: 1080, u: 19, pad: 56, kicker: 'Última hora, confirmada', headline: 'Lo que pasa hoy, contado solo cuando está confirmado.' },
  { name: 'histor-anuncio-A-vertical', w: 1080, h: 1920, u: 30, pad: 84, kicker: 'Última hora, confirmada', headline: 'Lo que pasa hoy, contado solo cuando está confirmado.' },
  { name: 'histor-anuncio-B-cuadrado', w: 1080, h: 1080, u: 20, pad: 56, kicker: '¿Harto de bulos?', headline: 'Solo publicamos lo que podemos verificar.' },
];

(async () => {
  const browser = await chromium.launch();
  for (const v of variants) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    const html = base
      .replace('KICKER', v.kicker)
      .replace('HEADLINE', v.headline)
      .replace('<html lang="es">', `<html lang="es" style="--w:${v.w}px;--h:${v.h}px;--u:${v.u}px;--pad:${v.pad}px">`);
    const file = path.join(dir, v.name + '.html');
    fs.writeFileSync(file, html);
    await page.goto('file:///' + file.replace(/\\/g, '/'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, v.name + '.png') });
    console.log('ok', v.name);
  }
  await browser.close();
})().catch((e) => { console.error("ERROR", e); process.exit(1); });
