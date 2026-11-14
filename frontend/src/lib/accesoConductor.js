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

/** «2026-11-14» → «14 nov», el día como se dice en la pantalla: igual que el sello de las fotos («14 NOV · 09:31»), para
    que en todo el arranque una misma fecha se escriba de una sola forma (tercera tanda, A11). `idioma`, el del panel. */
export function diaCorto(iso, idioma = 'es') {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  let mes
  try { mes = new Intl.DateTimeFormat(idioma, { month: 'short' }).format(d) } catch { mes = '' }
  mes = String(mes || '').replace(/\./g, '').slice(0, 4)
  return mes ? `${Number(m[3])} ${mes}` : `${m[3]}-${m[2]}`
}

/** «2026-11-14» → «14 NOV»: el día con el sello de la casa (`lib/sello.js`, el de las fotos), para el arranque y la
    ventana del acceso (cuarta tanda, C2). Con `anio`, «14 NOV 2026». El servidor solo da el día en que se abrió el
    enlace, no la hora: por eso aquí no hay hora. */
export function diaSello(iso, idioma = 'es', { anio = false } = {}) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  let mes
  try { mes = new Intl.DateTimeFormat(idioma, { month: 'short' }).format(d) } catch { mes = '' }
  mes = String(mes || '').replace(/\./g, '').toUpperCase().slice(0, 4)
  if (!mes) return `${m[3]}-${m[2]}`
  return `${m[3]} ${mes}${anio ? ` ${m[1]}` : ''}`
}

/* LOS PORQUÉS DEL SERVIDOR, EN EL IDIOMA DE LA PANTALLA (tercera tanda, A11 y CONTRATO R12). Las rutas del alta y del
   enlace mandan, además del texto en español, un `codigo` corto y fijo: con él se dice en el idioma del panel
   (`alta.cod.<codigo>` en i18nDict.js). Un código que esta pantalla aún no conoce, o un servidor que no lo manda: el
   texto del servidor, tal cual. `huecos` rellena {nombre}, {texto}… */
export function codigoDe(x) {
  if (!x || typeof x !== 'object') return ''
  const c = x.codigo || (x.detalle && typeof x.detalle === 'object' ? x.detalle.codigo : '') ||
    (x.detail && typeof x.detail === 'object' ? x.detail.codigo : '')
  return typeof c === 'string' && /^[a-z_]{2,40}$/.test(c) ? c : ''
}
export function textoConCodigo(t, codigo, siNo = '', huecos = {}) {
  const clave = codigo ? `alta.cod.${codigo}` : ''
  if (!clave || t(clave) === clave) return siNo
  // Si al texto traducido le falta un dato que el servidor no ha mandado, vale más su texto entero que un hueco.
  let falta = false
  const texto = t(clave).replace(/\{([a-z]+)\}/g, (_, k) => {
    const v = huecos[k]
    if (v === undefined || v === null || v === '') { falta = true; return '' }
    return String(v)
  })
  return falta && siNo ? siNo : texto
}
