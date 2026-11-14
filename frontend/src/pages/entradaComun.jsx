import { useState } from 'react'
import { LogoMarca } from './portadaComun'
import { MARCA } from '../marca'
import { nocheElegida } from '../lib/tema'

/* LA PUERTA DEL CONDUCTOR (14-11-2026): la entrada con su correo (/conductor sin sesión) y la del enlace personal (/c).
   No son pantallas de reparto sino la puerta de la casa, así que van con la identidad de la web de la que viene el dueño
   y del mensaje que recibe el conductor: tinta sobre papel, el cian solo en la acción principal, sin brillos ni
   degradados. Los colores salen de las variables `--ld-*` (index.css, `.ld-root`), como la portada (portadaComun.jsx).
   Una sola columna de 440 px como mucho: es una pantalla de móvil. */

export const TITULO = 'mt-10 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]'
export const TEXTO = 'text-[17px] leading-relaxed text-[color:var(--ld-text2)]'
export const NOTA = 'text-[14px] leading-relaxed text-[color:var(--ld-muted)]'
export const ETIQUETA = 'mb-1.5 block text-[15px] font-semibold text-[color:var(--ld-text)]'
/* Un solo anillo de foco (cuarta tanda, C4): el borde pasa a tinta y nada más. El anillo cian general de
   `:focus-visible` (index.css) se quita aquí; si no, salían dos, el cian por fuera y la tinta por dentro. */
export const CAMPO = 'w-full rounded-[12px] border-[1.5px] border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 py-3 text-[16px] text-[color:var(--ld-text)] placeholder:text-[color:var(--ld-muted)] focus:border-[color:var(--ld-text)] focus:outline-none focus-visible:ring-0'
export const CAMPO_CODIGO = 'text-center font-mono text-[24px] tracking-[0.35em]'
export const ENLACE = 'inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] disabled:opacity-60'
// Un enlace en voz baja, dentro de una nota (la entrada de la oficina en /conductor): subrayado fino, sin negrita.
export const ENLACE_NOTA = 'mt-1 inline-flex min-h-[44px] items-center underline decoration-[color:var(--ld-border-strong)] underline-offset-4 hover:text-[color:var(--ld-text)] hover:decoration-[color:var(--ld-text)]'
export const FUERTE = 'font-semibold text-[color:var(--ld-text)]'
export const ERROR = 'text-[16px] font-semibold text-[color:var(--ld-warn)]'
// Un aviso que hay que leer antes de seguir (la sesión caducada, el enlace abierto con el panel): borde ámbar, sin relleno de color.
export const AVISO = 'rounded-[12px] border-[1.5px] border-[color:var(--ld-ambar)] bg-[color:var(--ld-surface)] px-4 py-3 text-[16px] leading-relaxed'
export const AVISO_TITULO = 'text-[15px] font-semibold'
export const AVISO_TEXTO = 'mt-0.5 text-[14px] leading-relaxed text-[color:var(--ld-text2)]'

/* Dónde va la acción: en el móvil, abajo, al alcance del pulgar; en una pantalla ancha, justo debajo del texto (en el
   ordenador quedaba a 530 px de lo que explica; cuarta tanda, C4). */
export const ABAJO = 'mt-auto pt-10 md:mt-8 md:pt-0'

/* ¿Ha elegido la noche quien mira? La regla vive en lib/tema.js (la usan también el cargador de ruta y, escrita sin
   módulos, public/fondo-arranque.js). Sin elegir nada, papel: es la puerta de la casa. */
export { nocheElegida }

/** El tema de la puerta, leído una vez al abrir (no cambia a mitad). */
export function useTemaEntrada() {
  const [tema] = useState(() => (nocheElegida() ? 'dark' : 'light'))
  return tema
}

/** El papel de la pantalla, con la marca arriba. Un `div` con papel propio, no un `main`: el tema «híbrido» del panel
    pinta todos los `main` con su fondo y su esquina redondeada. */
export function MarcoEntrada({ children, testid }) {
  const tema = useTemaEntrada()
  return (
    <div role="main" className="ld-root flex min-h-[100dvh] flex-col font-sans antialiased" data-theme={tema} data-testid={testid}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 pb-8 pt-6">
        <span className="inline-flex items-center gap-2.5">
          <LogoMarca size={28} />
          <span className="text-[18px] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
        </span>
        {children}
      </div>
    </div>
  )
}
