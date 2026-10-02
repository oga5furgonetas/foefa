// Foto de perfil (1080x1080) y portada (1640x624) de la página de Facebook de Histor.
const { chromium } = require('../../node_modules/playwright');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const fonts = path.join(dir, '../../node_modules/@fontsource-variable').replace(/\\/g, '/');
const base = fs.readFileSync(path.join(dir, 'perfil.html'), 'utf8')
  .replace('FONT_SERIF', 'file:///' + fonts + '/newsreader/files/newsreader-latin-opsz-normal.woff2')
  .replace('FONT_SANS', 'file:///' + fonts + '/inter/files/inter-latin-wght-normal.woff2');

const variants = [
  { name: 'histor-perfil', w: 1080, h: 1080, body: '<div class="mark">H<span class="dot">.</span></div>' },
  { name: 'histor-portada', w: 1640, h: 624, body: '<div class="cover"><div class="word">Histor<span class="dot">.</span></div><div class="tag">Noticias verificadas, sin atajos</div></div>' },
];

(async () => {
  const browser = await chromium.launch();
  for (const v of variants) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    const file = path.join(dir, v.name + '.tmp.html');
    fs.writeFileSync(file, base.replace('BODY', v.body).replace('<html lang="es">', `<html lang="es" style="--w:${v.w}px;--h:${v.h}px">`));
    await page.goto('file:///' + file.replace(/\\/g, '/'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, v.name + '.png') });
    fs.unlinkSync(file);
    console.log('ok', v.name);
  }
  await browser.close();
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
