// Capturas de lo que pide la calle (30-10-2026): el enlace del cliente, la parada con lo que dijo, el dinero con las
// fallidas, «Reordenar desde aquí», «Aparcada aquí», los atajos del horario y la DGT en el mapa. La app de verdad con
// la API simulada (los mismos datos que e2e/calle.spec.js), no maquetas.
// Uso: node e2e/capturas-30-10.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const RESPUESTA = { estare: 'no', dejar: 'porteria', franja: null, portal: '1234', nota: '2º izq, el timbre no va', cuando: '2026-10-29T09:00:00Z' }
const browser = await chromium.launch()

async function contexto() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES',
    timezoneId: 'Europe/Madrid', userAgent: UA, geolocation: { latitude: 43.3636, longitude: -8.4118 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
    localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
  })
  return { ctx, page }
}
async function foto(page, nombre, espera = 900) {
  await page.waitForTimeout(espera)
  await page.screenshot({ path: join(OUT, `${nombre}.png`) })
  console.log(nombre)
}

// 1. El enlace del cliente: el formulario, y después de contestar.
{
  const { ctx, page } = await contexto()
  let estado = { empresa: 'Ana reparte', estado: 'pendiente', fecha: '2026-10-29', eta: '10:20', franja: null, paradas_antes: 2, tipo: 'entrega',
    dejado: null, respuesta: null, puede_contestar: true, intento: null }
  await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: estado }))
  await page.route(/\/api\/seguimiento\/tok1234567890abcdef\/respuesta$/, async (r) => { estado = { ...estado, respuesta: RESPUESTA }; await r.fulfill({ json: { ok: true, cliente_dice: RESPUESTA } }) })
  await page.goto(`${BASE}/s/tok1234567890abcdef`, { waitUntil: 'networkidle' })
  await page.getByRole('radio', { name: 'No estaré' }).click()
  await page.getByRole('radio', { name: 'En portería o recepción' }).click()
  await page.getByLabel('Código del portal o instrucciones (opcional)').fill('1234')
  await foto(page, 'web-01-enlace-cliente-formulario')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await foto(page, 'web-02-enlace-cliente-contestado')
  estado = { ...estado, estado: 'fallido', puede_contestar: false, intento: { llegada: '2026-10-29T09:00:00Z', llamada: '2026-10-29T09:02:10Z', whatsapp: null, espera_s: 185, llamadas: 1 } }
  await page.reload({ waitUntil: 'networkidle' })
  await foto(page, 'web-03-enlace-cliente-no-entregado')
  await ctx.close()
}

// 2. La ruta del repartidor: lo que dijo el cliente, la puerta, la ZBE, el dinero con las fallidas, el retraso.
{
  const { ctx, page } = await contexto()
  await page.clock.install({ time: new Date('2026-10-29T10:30:00+01:00') })
  await page.clock.resume()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const pedidos = [
    { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
      lat: 43.363889, lng: -8.409899, cliente_dice: RESPUESTA, antes: { fecha: '2026-10-21', estado: 'entregado', donde: 'porteria', nota: '' } },
    { id: 'p2', cliente: 'Lucía M.', direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109, geo: 'puerta', cobrar: 24.5 },
    { id: 'p4', cliente: 'Café Marina', direccion: 'Avenida da Mariña 8, A Coruña', estado: 'pendiente', bultos: 3, orden: 3, eta: '10:28', lat: 43.3692, lng: -8.3940 },
    { id: 'p5', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'pendiente', bultos: 1, orden: 4, eta: '10:36', lat: 43.3713, lng: -8.4007, hueco: 'Detrás · der' },
    { id: 'p3', cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5, A Coruña', estado: 'fallido', motivo: 'No había nadie', bultos: 2, orden: 5, cerrado_en: '2026-10-29T09:40:00+01:00', lat: 43.36219, lng: -8.407002 },
  ]
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'], precios: { mensual: 9.99, anual: 99 }, status: 'active', suscrita: true } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, empresa: '', fecha: '2026-10-29', ia_tickets: false, jornada: { empezada: '2026-10-29T08:30:00+01:00' },
    aviso_aceptado: true, base: null, ruta: { fin: '10:50', minutos: 34, km: 3.1, trafico: true }, pedidos, ganancias: { pago_parada: 110, pago_dia: 0, coste_km: 12 }, pais: 'es', prefijo: '34' } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { fuente: 'linea_recta', linea: [] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga/, (r) => r.fulfill({ json: { zonas: [{ id: 'z1', lat: 43.3645, lng: -8.4085, horario: 'Mo-Fr 08:00-14:00', maximo: '', calle: 'Rúa Sinfónica de Galicia' }], incompleto: false } }))
  await page.route(/\/api\/reparto\/mi-ruta\/incidencias/, (r) => r.fulfill({ json: { fuente: 'DGT', publicado: '2026-10-29T10:11:52+01:00', incompleto: false, incidencias: [
    { id: '1', clase: 'corte', que: 'calzada cortada (obras)', gravedad: 'alta', carretera: 'N-550', pk: '12.1', municipio: 'Culleredo', provincia: 'A Coruña', lat: 43.3585, lng: -8.4045, lat2: 43.3570, lng2: -8.4020, desde: '2025-12-12T08:05:19+01:00', distancia_km: 0.6, parada: 1 },
    { id: '2', clase: 'retencion', que: 'retención', gravedad: 'media', carretera: 'AC-12', pk: '2.0', municipio: 'A Coruña', provincia: 'A Coruña', lat: 43.3660, lng: -8.3985, lat2: null, lng2: null, desde: '2026-10-29T09:50:00+01:00', distancia_km: 0.4, parada: 3 }] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/zbe/, (r) => r.fulfill({ json: { fuente: 'DGT', incompleto: false, paradas: { p4: { id: 'z1', nombre: 'A Coruña - Marina' } },
    zonas: [{ id: 'z1', ciudad: 'ACoruña', nombre: 'A Coruña - Marina', descripcion: 'Carga y descarga de 6h a 11h.', estado: 'active', url: '', version: '2023-10-25', etiquetas: ['ECO', 'C'], negado: true,
      poligonos: [[[43.3680, -8.3960], [43.3705, -8.3960], [43.3705, -8.3920], [43.3680, -8.3920]]] }] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, (r) => r.fulfill({ json: { ordenados: 4, ruta: { fin: '10:55', km: 3.1 } } }))
  await page.goto(`${BASE}/ruta`, { waitUntil: 'networkidle' })
  await foto(page, 'web-04-ruta-cliente-dice-dinero-retraso', 1500)
  await page.getByTestId('aparcar').click()
  await page.waitForTimeout(600)
  await page.evaluate(() => window.scrollTo(0, 0))
  await foto(page, 'web-05-ruta-furgoneta-aparcada')
  await page.getByRole('button', { name: /Editar parada: Farmacia Sol/ }).click()
  await page.getByRole('button', { name: 'Cierra a las 14:00' }).click()
  await foto(page, 'web-06-editar-atajos-horario')
  await page.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Mapa' }).click()
  await page.waitForTimeout(3500)
  await page.evaluate(() => window.scrollBy(0, 330))
  await foto(page, 'web-07-mapa-dgt-cortes-zbe', 1200)
  // Lo que se toca en el mapa (30-10-2026): la ventana de una parada, la de un corte de la DGT y «mantener pulsado»
  // para dejar la furgoneta ahí.
  await page.evaluate(() => document.querySelector('.leaflet-container').scrollIntoView({ block: 'center' }))
  await page.locator('.leaflet-marker-icon[title="Farmacia Sol"]').click()
  await foto(page, 'web-08-mapa-ventana-parada', 700)
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.locator('.leaflet-marker-icon[title="calzada cortada (obras)"]').click()
  await foto(page, 'web-09-mapa-ventana-dgt', 700)
  await page.locator('.leaflet-container').click({ button: 'right', position: { x: 90, y: 120 } })
  await foto(page, 'web-10-mapa-aparcar-aqui', 700)
  await ctx.close()
}

await browser.close()
console.log('capturas en', OUT)
