import { useEffect, useState } from 'react'
import { API_BASE } from '../services/api'

/* «INVITA A UN COMPAÑERO»: el código que llega en el enlace (?ref=ABC123) se
   guarda en el móvil y viaja con el alta, para que el que invitó gane su mes y
   el invitado empiece con 14 días. Solo se ENSEÑA «14 días» si el servidor dice
   que el código vale (nunca prometer lo que no se va a cumplir). */
const CLAVE = 'fds_ref'

export function guardarRef() {
  try {
    const r = new URLSearchParams(window.location.search).get('ref')
    const limpio = String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    if (limpio.length >= 5) localStorage.setItem(CLAVE, limpio)
  } catch { /* sin almacenamiento */ }
}

export function leerRef() {
  try { return localStorage.getItem(CLAVE) || '' } catch { return '' }
}

/* {valido, dias} para el código guardado; null mientras se comprueba o si no hay. */
export function useInvitacion() {
  const [inv, setInv] = useState(null)
  useEffect(() => {
    guardarRef()
    const c = leerRef()
    if (!c) return undefined
    let vivo = true
    fetch(`${API_BASE}/referidos/${encodeURIComponent(c)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j?.valido) setInv({ dias: 7 + (Number(j.dias_extra) || 7), por_invitado: Number(j.por_invitado) || 250, promo_hasta: j.promo_hasta || '' }) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  return inv
}
