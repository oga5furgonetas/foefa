import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync, copyFileSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { OCR_RUTA, ZXING_WASM } from './src/lib/ocrRuta.js'

/* LOS MAPAS DE FUENTE NO SE PUBLICAN.
   Hasta el 26-09-2026 cada `.js` servido llevaba su `.map` al lado, y el `.map`
   ES el código fuente entero, comentarios incluidos: nombres de personas,
   incidencias, notas internas. Cualquiera lo bajaba sin sesión (HTTP 200).
   Se siguen generando —la fuente tiene que poder recuperarse para leer un
   error—, pero sin referencia en el `.js` (`sourcemap: 'hidden'`) y FUERA de
   la carpeta que se sube: en `frontend/mapas/<fecha>/`, que no va a git. */
function mapasFuera() {
  let salida = ''
  return {
    name: 'mapas-fuera',
    apply: 'build',
    configResolved(c) { salida = resolve(c.root, c.build.outDir) },
    closeBundle() {
      if (!salida || !existsSync(salida)) return
      const destino = join(process.cwd(), 'mapas', new Date().toISOString().replace(/[:.]/g, '-'))
      const recorre = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? recorre(join(dir, e.name)) : e.name.endsWith('.map') ? [join(dir, e.name)] : [])
      const mapas = recorre(salida)
      for (const f of mapas) {
        const a = join(destino, relative(salida, f))
        mkdirSync(dirname(a), { recursive: true })
        renameSync(f, a)
      }
      if (mapas.length) console.log(`[mapas-fuera] ${mapas.length} mapas guardados fuera de la web, en ${relative(process.cwd(), destino)}`)
    },
  }
}

/* LA CSP CONOCE AL BACKEND SIN ESCRIBIRLO A MANO.
   `public/_headers` lleva `__BACKEND_ORIGIN__` en el `connect-src`. Al terminar
   el build se cambia por el origen de VITE_API_URL (si la API está en otro
   dominio) o se quita (si va en el mismo, que ya cubre 'self'). Así la misma
   carpeta sirve para cualquier despliegue y la política no se abre de más. */
function cspConBackend(apiUrl) {
  let origen = ''
  try { if (/^https?:\/\//.test(apiUrl || '')) origen = new URL(apiUrl).origin } catch { origen = '' }
  return {
    name: 'csp-con-backend',
    apply: 'build',
    closeBundle() {
      const f = join(process.cwd(), 'dist', '_headers')
      if (!existsSync(f)) return
      const t = readFileSync(f, 'utf8').replaceAll(' __BACKEND_ORIGIN__', origen ? ' ' + origen : '')
      writeFileSync(f, t)
    },
  }
}

/* LECTOR DE TICKETS EN EL PROPIO MÓVIL (03-10-2026).
   El OCR (tesseract.js) se sirve desde NUESTRO dominio, no desde un CDN: así
   la foto del ticket no sale del móvil del conductor —ni a Google ni a nadie—
   y la CSP no tiene que abrirse a terceros. Se copian del node_modules a
   `dist/ocr/` al compilar; en git no hay binarios. */
function ocrLocal() {
  const nm = (p) => join(process.cwd(), 'node_modules', p)
  const ficheros = [
    [nm('tesseract.js/dist/worker.min.js'), 'worker.min.js'],
    [nm('tesseract.js-core/tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
    [nm('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
    [nm('tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
    [nm('@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz'), 'spa.traineddata.gz'],
    [nm('zxing-wasm/dist/reader/zxing_reader.wasm'), ZXING_WASM.split('/').pop()],
  ]
  let salida = ''
  return {
    name: 'ocr-local',
    apply: 'build',
    configResolved(c) { salida = resolve(c.root, c.build.outDir) },
    closeBundle() {
      const dest = join(salida, ...OCR_RUTA.split('/').filter(Boolean))
      mkdirSync(dest, { recursive: true })
      for (const [de, a] of ficheros) {
        if (!existsSync(de)) throw new Error(`[ocr-local] falta ${de}: npm install`)
        copyFileSync(de, join(dest, a))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: '/',
  plugins: [react(), cspConBackend(env.VITE_API_URL), mapasFuera(), ocrLocal()],
  server: {
    // En desarrollo la API va por el mismo origen: sin CORS y sin configurar nada.
    proxy: { '/api': { target: env.API_DEV_URL || 'http://localhost:8000', changeOrigin: true } },
  },
  build: {
    // Nunca más un bundle sin fuente recuperable, pero sin publicarla: ver mapasFuera().
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Subcarpeta versionada: el edge de Cloudflare llegó a cachear el HTML
        // del fallback SPA bajo URLs /assets/*.js (carrera de deploy) y lo
        // sirvió envenenado durante horas → panel roto para todos. Rutas
        // nuevas = caché limpio garantizado; subir v2→v3 si volviera a pasar.
        entryFileNames: 'assets/v2/[name]-[hash].js',
        chunkFileNames: 'assets/v2/[name]-[hash].js',
        assetFileNames: 'assets/v2/[name]-[hash][extname]',
      },
    },
  },
  }
})
