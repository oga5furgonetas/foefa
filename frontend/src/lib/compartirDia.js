import QRCode from 'qrcode'
import { tx } from './idioma'
import { importe } from './region'
import { medirAccion } from './analitica'
import { getReferidos } from '../services/api'
import { enlaceInvitar } from './compartir'
import { sinPagos } from './plataforma'

/* «COMPARTE TU DÍA» (11-10-2026). Al acabar, el repartidor saca una imagen de su jornada (paradas, horas,
   km) para su estado de WhatsApp o sus redes, con SU código QR de invitación: quien la ve y se registra
   con él le da «Invita y gana». Lo hace el propio móvil (canvas): no se sube nada a ningún sitio. */

const ANCHO = 1080
const ALTO = 1920

function texto(ctx, t, x, y, { tam = 60, peso = 800, color = '#f4fbfb', alinear = 'left' } = {}) {
  ctx.font = `${peso} ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = alinear
  ctx.fillText(t, x, y)
}

/* EL DÍA EN UNA TARJETA (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §10): lo que un repartidor enseña a otro es cuánto
   hizo, a la primera, cuánto le quedó por hora y a qué hora acabó. Cada dato sale solo si se tiene (sin tarifa no hay
   €/hora; sin fallidas, «100 % a la primera»). */
export async function imagenDelDia({ paradas, minutos, km, enlace, aLaPrimera = null, porHora = null, horaFin = '' }) {
  // El QR primero (es lo único que espera): luego se dibuja todo de un tirón. Sin `enlace` (la app de iPhone, 09-11-2026: no hay
  // invitaciones ni «pruébala gratis») la imagen va sin QR.
  const qr = document.createElement('canvas')
  if (enlace) await QRCode.toCanvas(qr, enlace, { margin: 1, width: 360 })
  const c = document.createElement('canvas')
  c.width = ANCHO
  c.height = ALTO
  const ctx = c.getContext('2d')
  const fondo = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  fondo.addColorStop(0, '#0b3b3d')
  fondo.addColorStop(0.55, '#05141a')
  fondo.addColorStop(1, '#05141a')
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  texto(ctx, tx('HOY HE REPARTIDO').toUpperCase(), 90, 330, { tam: 46, color: '#14e7d8' })
  texto(ctx, String(paradas), 90, 560, { tam: 230, color: '#ffffff' })
  texto(ctx, paradas === 1 ? tx('parada') : tx('paradas'), 90, 660, { tam: 80, color: '#ffffff' })
  const h = Math.floor((minutos || 0) / 60)
  const m = Math.round((minutos || 0) % 60)
  const lineas = []
  if (minutos > 0) lineas.push(tx('en {h} h {m} min', { h, m }))
  if (km > 0) lineas.push(`${String(Math.round(km * 10) / 10).replace('.', ',')} km`)
  if (aLaPrimera != null) lineas.push(tx('{p} % a la primera', { p: aLaPrimera }))
  if (porHora != null && porHora > 0) lineas.push(tx('{c}/hora limpio', { c: importe(porHora) }))
  if (horaFin) lineas.push(tx('acabé a las {h}', { h: horaFin }))
  // Hasta cinco líneas caben entre el número y la frase de abajo (que baja si hace falta).
  lineas.slice(0, 5).forEach((l, i) => texto(ctx, l, 90, 770 + i * 66, { tam: 50, peso: 700, color: i >= 2 ? '#ffd43b' : '#a9c2c6' }))

  // Lo de abajo baja con las líneas que haya (de dos a cinco): nada se pisa.
  const yFrase = 770 + Math.min(lineas.length, 5) * 66 + 44
  texto(ctx, tx('Con FDS la ruta se ordena sola'), 90, yFrase, { tam: 52, color: '#ffffff' })
  texto(ctx, tx('Foto a la etiqueta · guía con voz'), 90, yFrase + 70, { tam: 40, peso: 600, color: '#a9c2c6' })

  // El QR de su invitación, en una tarjeta blanca.
  if (enlace) {
    const yQr = yFrase + 180
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(90, yQr, 420, 420, 32) : ctx.rect(90, yQr, 420, 420)
    ctx.fill()
    ctx.drawImage(qr, 120, yQr + 30, 360, 360)
    texto(ctx, tx('Escanéalo y'), 560, yQr + 140, { tam: 46, color: '#ffffff' })
    texto(ctx, tx('pruébala gratis'), 560, yQr + 200, { tam: 46, color: '#ffd43b' })
    texto(ctx, new URL(enlace).host, 560, yQr + 280, { tam: 40, peso: 700, color: '#a9c2c6' })
  }
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/png'))
}

export async function compartirDia({ paradas, minutos, km, aLaPrimera = null, porHora = null, horaFin = '' }) {
  medirAccion('compartir_dia')
  // En la app de iPhone (09-11-2026) no hay invitaciones: ni código, ni QR, ni enlace, ni «pruébala gratis»; solo el día.
  const sin = sinPagos()
  let codigo = ''
  if (!sin) { try { codigo = (await getReferidos()).data?.codigo || '' } catch { /* sin código: enlace normal */ } }
  const enlace = sin ? '' : enlaceInvitar(codigo).replace('utm_medium=compartir', 'utm_medium=dia')
  const blob = await imagenDelDia({ paradas, minutos, km, enlace, aLaPrimera, porHora, horaFin })
  const extra = aLaPrimera != null ? `${tx('{p} % a la primera', { p: aLaPrimera })}. ` : ''
  const texto = sin
    ? `${tx('Hoy he hecho {n} paradas con FDS: la ruta se ordena sola.', { n: paradas })} ${extra}`.trim()
    : `${tx('Hoy he hecho {n} paradas con FDS: la ruta se ordena sola. Pruébala gratis:', { n: paradas })} ${extra}${enlace}`
  const fichero = new File([blob], 'mi-dia-fds.png', { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [fichero] })) { await navigator.share({ files: [fichero], text: texto }); return 'compartido' }
  } catch { return 'cancelado' }
  // Sin «compartir» con imagen (ordenador, algunos navegadores): se descarga y se copia el texto.
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'mi-dia-fds.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  try { await navigator.clipboard?.writeText(texto) } catch { /* sin portapapeles */ }
  return 'descargado'
}
