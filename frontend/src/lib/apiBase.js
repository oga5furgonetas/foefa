// Única fuente de la URL del backend. Módulo sin dependencias a propósito:
// main.jsx lo importa para el reporte de errores y NO debe arrastrar axios
// al chunk inicial (services/api.js sí importa axios).
//
// Por defecto `/api`, en el MISMO dominio que la web: en desarrollo lo sirve
// el proxy de Vite (vite.config.js) y en producción basta con publicar la API
// bajo `/api`. Si la API vive en otro dominio, se da al compilar:
//     VITE_API_URL=https://api.tu-dominio.com/api npm run build
// y la CSP de `_headers` se completa sola con ese origen (vite.config.js).
// (Hasta el 29-10-2026 había un desvío para China por el Worker del dominio; China ya no se atiende.)
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
