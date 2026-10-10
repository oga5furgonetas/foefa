import QRCode from 'qrcode'
import { tx } from './idioma'
import { medirAccion } from './analitica'
import { getReferidos } from '../services/api'
import { enlaceInvitar } from './compartir'

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

export async function imagenDelDia({ paradas, minutos, km, enlace }) {
  // El QR primero (es lo único que espera): luego se dibuja todo de un tirón.
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, enlace, { margin: 1, width: 360 })
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
  lineas.forEach((l, i) => texto(ctx, l, 90, 790 + i * 80, { tam: 58, peso: 700, color: '#a9c2c6' }))

  texto(ctx, tx('Con FDS la ruta se ordena sola'), 90, 1080, { tam: 52, color: '#ffffff' })
  texto(ctx, tx('Foto a la etiqueta · guía con voz'), 90, 1150, { tam: 40, peso: 600, color: '#a9c2c6' })

  // El QR de su invitación, en una tarjeta blanca.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(90, 1260, 420, 420, 32) : ctx.rect(90, 1260, 420, 420)
  ctx.fill()
  ctx.drawImage(qr, 120, 1290, 360, 360)
  texto(ctx, tx('Escanéalo y'), 560, 1400, { tam: 46, color: '#ffffff' })
  texto(ctx, tx('pruébala gratis'), 560, 1460, { tam: 46, color: '#ffd43b' })
  texto(ctx, new URL(enlace).host, 560, 1540, { tam: 40, peso: 700, color: '#a9c2c6' })
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/png'))
}

export async function compartirDia({ paradas, minutos, km }) {
  medirAccion('compartir_dia')
  let codigo = ''
  try { codigo = (await getReferidos()).data?.codigo || '' } catch { /* sin código: enlace normal */ }
  const enlace = enlaceInvitar(codigo).replace('utm_medium=compartir', 'utm_medium=dia')
  const blob = await imagenDelDia({ paradas, minutos, km, enlace })
  const texto = `${tx('Hoy he hecho {n} paradas con FDS: la ruta se ordena sola. Pruébala gratis:', { n: paradas })} ${enlace}`
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
