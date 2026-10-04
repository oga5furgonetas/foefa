// Única fuente de la URL del backend. Módulo sin dependencias a propósito:
// main.jsx lo importa para el reporte de errores y NO debe arrastrar axios
// al chunk inicial (services/api.js sí importa axios).
//
// Por defecto `/api`, en el MISMO dominio que la web: en desarrollo lo sirve
// el proxy de Vite (vite.config.js) y en producción basta con publicar la API
// bajo `/api`. Si la API vive en otro dominio, se da al compilar:
//     VITE_API_URL=https://api.tu-dominio.com/api npm run build
// y la CSP de `_headers` se completa sola con ese origen (vite.config.js).
//
// DESDE CHINA (04-10-2026): *.fly.dev no siempre llega, flotadsp.com sí. En
// flotadsp.com el Worker del dominio (infra/web-dominio) reenvía /api al
// servidor, así que desde China se usa `/api` del mismo dominio. Solo desde
// allí: el resto sigue directo y no gasta cuota del Worker. Se reconoce por la
// zona horaria del móvil o el idioma zh-CN; `fds_api_dominio=1` lo fuerza.
const CHINA = ['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Kashgar', 'PRC']

export function desdeChina() {
  try { if (localStorage.getItem('fds_api_dominio') === '1') return true } catch { /* sin almacenamiento */ }
  try {
    if (CHINA.includes(Intl.DateTimeFormat().resolvedOptions().timeZone)) return true
  } catch { /* sin Intl */ }
  try { return /^zh-(cn|hans-cn)$/i.test(navigator.language || '') } catch { return false }
}

const configurada = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const enNuestroDominio = typeof location !== 'undefined' && /(^|\.)flotadsp\.com$/.test(location.hostname)

export const API_BASE = enNuestroDominio && configurada.startsWith('http') && desdeChina() ? '/api' : configurada
