import { useEffect } from 'react'
import { isAuthed, getAdmin } from '../panel/auth'
import Mercadillo from './mercadillo/Mercadillo'

/* /mercadillo (17-10-2026): el mercadillo con la sesión de la cuenta. Es el enlace de los correos para
   el repartidor autónomo y la VISTA PREVIA de Dani (super-admin) antes de encenderlo para todos.
   Sin sesión, a entrar y de vuelta aquí. Los conductores de empresa lo tienen en su portal. */
export default function MercadilloPagina() {
  const dentro = isAuthed()
  useEffect(() => {
    if (!dentro) window.location.replace('/login?next=/mercadillo')
  }, [dentro])
  if (!dentro) return null
  const volver = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.href = getAdmin()?.super_admin ? '/panel/admin' : '/ruta'
  }
  return (
    <main className="app-ruta min-h-screen bg-dark-950">
      <Mercadillo onBack={volver} />
    </main>
  )
}
