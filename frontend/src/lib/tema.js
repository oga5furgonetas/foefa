/* EL TEMA Y LA LETRA (17-10-2026).
   El tema solo se cambiaba con el botón del panel de empresas: 'hibrido' (el de por defecto), 'dark' o 'light'
   en `panel_theme`, y `panel_theme_elegido` marca que lo eligió alguien a mano (lo demás es basura del código
   viejo). La app del repartidor lo elige en Ajustes y añade 'auto', que sigue al móvil: oscuro si el móvil está
   en modo oscuro. «Letra más grande» (`fds_letra`) sube un 15 % los textos de la app (index.css, data-letra). */
const CLAVE = 'panel_theme'
const ELEGIDO = 'panel_theme_elegido'
const LETRA = 'fds_letra'
const consulta = () => { try { return window.matchMedia('(prefers-color-scheme: dark)') } catch { return null } }

export function temaGuardado() {
  try { return localStorage.getItem(ELEGIDO) ? (localStorage.getItem(CLAVE) || 'hibrido') : 'hibrido' } catch { return 'hibrido' }
}

export function temaEfectivo(t = temaGuardado()) {
  if (t === 'auto') return consulta()?.matches ? 'dark' : 'hibrido'
  return ['hibrido', 'dark', 'light'].includes(t) ? t : 'hibrido'
}

let escuchando = false
export function aplicarTema(t = temaGuardado()) {
  try { document.documentElement.setAttribute('data-panel-theme', temaEfectivo(t)) } catch { /* sin documento */ }
  if (t === 'auto' && !escuchando) {
    // Si el móvil cambia de modo con la app abierta (de día a noche), la app cambia con él.
    const q = consulta()
    if (q?.addEventListener) {
      q.addEventListener('change', () => { if (temaGuardado() === 'auto') aplicarTema('auto') })
      escuchando = true
    }
  }
}

export function elegirTema(t) {
  try { localStorage.setItem(ELEGIDO, '1'); localStorage.setItem(CLAVE, t) } catch { /* modo privado */ }
  aplicarTema(t)
}

export const letraGrande = () => { try { return localStorage.getItem(LETRA) === 'grande' } catch { return false } }

export function aplicarLetra(grande = letraGrande()) {
  try {
    if (grande) document.documentElement.setAttribute('data-letra', 'grande')
    else document.documentElement.removeAttribute('data-letra')
  } catch { /* sin documento */ }
}

export function elegirLetra(grande) {
  try { if (grande) localStorage.setItem(LETRA, 'grande'); else localStorage.removeItem(LETRA) } catch { /* modo privado */ }
  aplicarLetra(grande)
}
