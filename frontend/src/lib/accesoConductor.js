import { origen } from '../marca'

/* EL ENLACE PERSONAL DEL CONDUCTOR, VISTO DESDE EL PANEL (14-11-2026, CONTRATO-ALTA §1.3 y §3.5).
   El servidor solo guarda la huella del enlace: una vez creado, no lo puede volver a enseñar. Por eso el último que se
   ha creado en esta pestaña se recuerda aquí, en memoria (nunca en el almacén del navegador): «Copiar enlace» y
   «Mandar por WhatsApp» usan el MISMO mientras no se abra, en vez de crear otro que dejaría sin valor el primero.
   Al recargar se olvida y, si hace falta mandarlo otra vez, se crea uno nuevo (el viejo deja de valer). */
const creados = new Map()   // driver_id → ruta («/c#…»)

export const rutaRecordada = (driverId) => creados.get(driverId) || null
export const recordarRuta = (driverId, ruta) => { if (driverId && ruta) creados.set(driverId, ruta) }
export const olvidarRuta = (driverId) => { creados.delete(driverId) }

/** La dirección entera, con el dominio donde se sirve la web (nunca escrito a mano). */
export const enlaceCompleto = (ruta) => `${origen()}${ruta}`

/** «ANA LÓPEZ» → «Ana»: la primera palabra, con solo la inicial en mayúscula. */
export function nombreCorto(nombre) {
  const p = String(nombre || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toLocaleUpperCase('es') + p.slice(1).toLocaleLowerCase('es') : ''
}

/** El mensaje ya escrito, en el idioma del panel. `t()` no rellena huecos: se rellenan aquí. */
export function mensajeAcceso(t, { nombre, empresa, enlace }) {
  return t('alta.wa.mensaje')
    .replace('{nombre}', nombreCorto(nombre))
    .replace('{empresa}', String(empresa || '').trim())
    .replace('{enlace}', enlace)
}

/** WhatsApp con el mensaje puesto; sin móvil, WhatsApp pregunta a quién. */
export const urlWhatsApp = (whatsapp, texto) =>
  `https://wa.me/${String(whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`

/** «2026-11-14» → «14-11», el día como se dice en la pantalla. */
export function diaCorto(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}` : ''
}
