import { API_BASE, DRIVER_TOKEN_KEY } from '../services/api'
import { txError } from './idioma'
import { paisDelMovil } from './region'

/* PROBARLA SIN CUENTA (04-10-2026; por país el 11-10-2026). Abre la ruta de prueba con 8 paquetes de
   ejemplo: en una ciudad del país de quien la prueba (lo dice la hora del móvil) y a su hora. Se usa en
   la portada de repartidores y en la primera pantalla de la app. Si va bien, no vuelve: navega a la ruta. */
export async function abrirDemoReparto() {
  let zona = ''
  try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { /* sin Intl */ }
  const r = await fetch(`${API_BASE}/auth/demo-reparto`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol: 'autonomo', pais: paisDelMovil(), zona_horaria: zona }),
  })
  const j = await r.json()
  if (!r.ok || !j.access_token) throw new Error(txError(j, 'No se pudo abrir la prueba'))
  localStorage.setItem(DRIVER_TOKEN_KEY, j.access_token)
  localStorage.setItem('flota_driver', JSON.stringify(j.driver))
  window.location.href = '/conductor?vista=ruta'
}
