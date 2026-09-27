/**
 * Genera los iconos PNG de Histor a partir de la geometría del logo
 * (public/favicon.svg): cuadrado de tinta, dos pilares de papel y un
 * travesaño rojo. Sin dependencias: rasteriza rectángulos y escribe PNG.
 *   node scripts/generate-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INK = [0x15, 0x17, 0x1c];
const PAPER = [0xfb, 0xfa, 0xf7];
const RED = [0xb3, 0x26, 0x1e];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Dibuja el logo en un lienzo de `size` px; `pad` = margen de seguridad (iconos maskable). */
function render(size, { pad = 0, radius = 4 / 32, transparentCorners = true } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const s = (size - 2 * pad) / 32;
  const inRect = (x, y, rx, ry, rw, rh) => x >= pad + rx * s && x < pad + (rx + rw) * s && y >= pad + ry * s && y < pad + (ry + rh) * s;
  const r = radius * (size - 2 * pad);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = INK;
      let alpha = 255;
      // Esquinas redondeadas (solo iconos normales; los maskable llenan el lienzo).
      if (transparentCorners && pad === 0) {
        const cx = x < r ? r : x > size - r ? size - r : x;
        const cy = y < r ? r : y > size - r ? size - r : y;
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if ((x < r || x > size - r) && (y < r || y > size - r) && dist > r) alpha = 0;
      }
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (inRect(cx, cy, 8, 7, 4.5, 18) || inRect(cx, cy, 19.5, 7, 4.5, 18)) color = PAPER;
      if (inRect(cx, cy, 12.5, 14, 7, 4)) color = RED;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = alpha;
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../apps/web/public/', import.meta.url);
for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-180.png', 180, { transparentCorners: false }],
  ['icon-maskable-512.png', 512, { pad: 0, transparentCorners: false }],
  ['favicon-32.png', 32, {}],
]) {
  writeFileSync(new URL(name, out), render(size, opts));
  console.log('ok', name);
}
