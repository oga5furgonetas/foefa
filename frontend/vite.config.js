import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: '/',
  plugins: [react(), cspConBackend(env.VITE_API_URL)],
  server: {
    // En desarrollo la API va por el mismo origen: sin CORS y sin configurar nada.
    proxy: { '/api': { target: env.API_DEV_URL || 'http://localhost:8000', changeOrigin: true } },
  },
  build: {
    sourcemap: true, // nunca más un bundle sin fuente recuperable
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
