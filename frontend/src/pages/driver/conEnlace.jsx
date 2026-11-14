/* diseño compacto */
import { ArrowLeft } from 'lucide-react'
import { tx } from '../../lib/idioma'
import { Boton } from './piezas'

/* QUIEN ENTRA CON SU ENLACE NO TIENE CONTRASEÑA QUE CAMBIAR (14-11-2026). Con la sesión del enlace (`via: "enlace"` o
   `lk`) el servidor no deja crear ni cambiar la contraseña, ni poner un correo de recuperación (403
   `enlace_sin_contrasena`). En vez de casillas que acaban en un error, y del consejo «sal y vuelve a entrar» (que con
   el enlace no sirve), esta línea tranquila. */
export function LineaEnlace({ className = '' }) {
  return <p className={`text-sec text-dark-400 ${className}`} data-testid="portal-con-enlace">{tx('Entras con tu enlace. Si quieres contraseña, pídesela a tu empresa.')}</p>
}

/** La pantalla entera (contraseña, correo de recuperación), por si se llega a ella con la sesión del enlace. */
export function PantallaEnlace({ titulo, onBack }) {
  return (
    <div className="min-h-[100dvh] bg-dark-950 px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md">
        {onBack && <Boton variante="texto" tono="marca" icono={ArrowLeft} texto={tx('Volver')} onClick={onBack} className="-ml-2 mb-4" />}
        <h1 className="text-titulo text-dark-50">{tx(titulo)}</h1>
        <LineaEnlace className="mt-2" />
      </div>
    </div>
  )
}
