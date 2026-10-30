import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LO QUE PIDE LA CALLE (30-10-2026, docs/NECESIDADES-REPARTIDOR-30-10.md), con la API simulada:
     · el cliente contesta en su enlace de seguimiento (si estará, dónde dejarlo, el portal) y ve que el
       repartidor llamó y esperó cuando no se pudo entregar;
     · el repartidor ve en la parada lo que dijo el cliente, la puerta conocida y la ZBE; «Reordenar desde aquí»
       cuando va tarde; «Aparcada aquí»; las fallidas en el dinero; los atajos del horario;
     · en el mapa, lo que dice la DGT (cortes y obras, y zonas de bajas emisiones) con su fuente.
   Nada de red de verdad: la DGT y el servidor están simulados. */

const RESPUESTA = { estare: 'no', dejar: 'vecino', franja: null, portal: '1234', nota: '', cuando: '2026-10-30T09:00:00Z' }

test.describe('lo que pide la calle', () => {
  test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('el cliente contesta en su enlace y, si no se pudo entregar, ve que se llamó', async ({ page }) => {
    let estado = { empresa: 'Ana reparte', estado: 'pendiente', fecha: '2026-10-30', eta: '10:20', franja: null, paradas_antes: 2,
      tipo: 'entrega', dejado: null, respuesta: null, puede_contestar: true, intento: null }
    const enviado = []
    await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: estado }))
    await page.route(/\/api\/seguimiento\/tok1234567890abcdef\/respuesta$/, async (r) => {
      enviado.push(r.request().postDataJSON())
      estado = { ...estado, respuesta: RESPUESTA }
      await r.fulfill({ json: { ok: true, cliente_dice: RESPUESTA } })
    })
    await page.goto('/s/tok1234567890abcdef', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('En reparto')).toBeVisible()
    const form = page.getByTestId('formulario')
    await expect(form.getByText('¿Estarás en casa?')).toBeVisible()
    // Sin contestar, no se envía; con «No estaré» hay que decir dónde.
    await expect(form.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await form.getByRole('radio', { name: 'No estaré' }).click()
    await expect(form.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await form.getByRole('radio', { name: 'Al vecino' }).click()
    await form.getByLabel('Código del portal o instrucciones (opcional)').fill('1234')
    await form.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByTestId('respuesta')).toContainText('Gracias. El repartidor ya lo sabe:')
    await expect(page.getByTestId('respuesta')).toContainText('No estará · Al vecino · Portal: 1234')
    expect(enviado).toEqual([{ estare: 'no', dejar: 'vecino', franja_desde: '', franja_hasta: '', portal: '1234' }])
    // «Cambiar» vuelve al formulario con lo contestado.
    await page.getByRole('button', { name: 'Cambiar' }).click()
    await expect(page.getByTestId('formulario').getByRole('radio', { name: 'No estaré' })).toHaveAttribute('aria-checked', 'true')

    // No se pudo entregar: el cliente ve que el repartidor llamó y esperó.
    estado = { ...estado, estado: 'fallido', puede_contestar: false, intento: { llegada: '2026-10-30T10:00:00Z', llamada: '2026-10-30T10:02:10Z', whatsapp: null, espera_s: 185, llamadas: 1 } }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('No se ha podido entregar')).toBeVisible()
    await expect(page.getByTestId('intento')).toContainText('El repartidor llamó a las 11:02 y esperó 3 min')
    await expect(page.getByTestId('formulario')).toHaveCount(0)
  })

  test('el repartidor ve lo que dijo el cliente, la DGT en el mapa y reordena cuando va tarde', async ({ page, context }) => {
    // Las 10:30 de un día YA PASADO (si fuese futuro, la sesión simulada saldría caducada): la siguiente parada
    // tenía que estar a las 10:05, va 25 min tarde.
    await page.clock.install({ time: new Date('2026-10-29T10:30:00+01:00') })
    await page.clock.resume()   // que el tiempo corra (como en capturas-ruta.spec): sin esto los temporizadores de la app no disparan
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
      localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
      localStorage.setItem('ruta_vista', 'lista')
    })
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
    const pedidos = [
      { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
        lat: 43.363889, lng: -8.409899, cliente_dice: RESPUESTA },
      { id: 'p2', cliente: 'Lucía M.', direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109, geo: 'puerta' },
      { id: 'p3', cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5, A Coruña', estado: 'fallido', motivo: 'No había nadie', bultos: 2, orden: 3, cerrado_en: '2026-10-29T09:40:00+01:00', lat: 43.36219, lng: -8.407002 },
    ]
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
      precios: { mensual: 9.99, anual: 99 }, status: 'active', suscrita: true } }))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, empresa: '', fecha: '2026-10-29', ia_tickets: false, jornada: {},
      aviso_aceptado: true, base: null, ruta: { fin: '10:40', minutos: 30, km: 2.2, trafico: true }, pedidos,
      ganancias: { pago_parada: 110, pago_dia: 0, coste_km: 12 }, pais: 'es', prefijo: '34' } }))
    await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { fuente: 'linea_recta', linea: [] } }))
    await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga/, (r) => r.fulfill({ json: { zonas: [], incompleto: false } }))
    await page.route(/\/api\/reparto\/mi-ruta\/incidencias/, (r) => r.fulfill({ json: { fuente: 'DGT', publicado: '2026-10-30T10:11:52+01:00', incompleto: false, incidencias: [
      { id: '1', clase: 'corte', que: 'calzada cortada (obras)', gravedad: 'alta', carretera: 'N-550', pk: '12.1', municipio: 'Culleredo', provincia: 'A Coruña',
        lat: 43.352, lng: -8.408, lat2: 43.35, lng2: -8.41, desde: '2025-12-12T08:05:19+01:00', distancia_km: 0.9, parada: 2 }] } }))
    await page.route(/\/api\/reparto\/mi-ruta\/zbe/, (r) => r.fulfill({ json: { fuente: 'DGT', incompleto: false, paradas: { p2: { id: 'z1', nombre: 'A Coruña - Marina' } },
      zonas: [{ id: 'z1', ciudad: 'ACoruña', nombre: 'A Coruña - Marina', descripcion: 'Carga y descarga de 6h a 11h.', estado: 'active', url: '', version: '2023-10-25',
        etiquetas: ['ECO', 'C'], negado: true, poligonos: [[[43.368, -8.406], [43.37, -8.406], [43.37, -8.404], [43.368, -8.404]]] }] } }))
    let reordenado = 0
    await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, (r) => { reordenado += 1; r.fulfill({ json: { ordenados: 2, ruta: { fin: '10:50', km: 2.2 } } }) })

    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Siguiente parada', { exact: false }).first()).toBeVisible()
    // Lo que dijo el cliente, en la parada; la puerta conocida y la ZBE, en sus chips.
    await expect(page.getByTestId('cliente-dice').first()).toContainText('El cliente dice: No estará · Al vecino · Portal: 1234')
    await expect(page.getByText('Puerta conocida')).toBeVisible()
    await expect(page.getByText('ZBE', { exact: true })).toBeVisible()
    // Las fallidas, en el dinero: 1 sin entregar a 1,10 €.
    await expect(page.getByText('1 sin entregar = 1,10 € sin cobrar', { exact: false })).toBeVisible()
    // Va 25 minutos tarde: «Reordenar desde aquí».
    await expect(page.getByText('Vas 25 min por detrás de lo previsto')).toBeVisible()
    await page.getByTestId('reordenar').click()
    await expect.poll(() => reordenado).toBe(1)
    // «Aparcada aquí» guarda la furgoneta y dice a cuántos metros está.
    await page.getByTestId('aparcar').click()
    await expect(page.getByTestId('furgo')).toContainText(/Furgoneta/)
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('fds_furgo')))).toMatchObject({ lat: 43.3636, lng: -8.4118 })
    // Los atajos del horario, al editar una parada.
    await page.getByRole('button', { name: /Editar parada: Farmacia Sol/ }).click()
    await page.getByRole('button', { name: 'Cierra a las 14:00' }).click()
    await expect(page.getByPlaceholder('Horario del cliente (ej. de 10 a 12)')).toHaveValue('8-14')
    await page.getByRole('button', { name: 'Cerrar' }).click()
    // El mapa: lo que dice la DGT, con su fuente.
    await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Mapa' }).click()
    await expect(page.getByTestId('dgt')).toContainText('Cortes y obras (DGT): 1 cerca de tu ruta · calzada cortada (obras) · N-550 · a 0,9 km de la parada 2')
    await expect(page.getByTestId('zbe')).toContainText('Zonas de bajas emisiones (DGT): A Coruña - Marina · 1 parada dentro · Carga y descarga de 6h a 11h.')

    // LO QUE SE TOCA EN EL MAPA (30-10-2026): la chincheta abre una ventana con lo que dijo el cliente y qué hacer
    // (ir, llamar, abrir); el corte de la DGT dice qué es y dónde; mantener pulsado (aquí, el botón derecho) deja la
    // furgoneta en ese punto y no donde está el móvil; y la capa de la DGT se apaga y se enciende.
    await page.locator('.leaflet-marker-icon[title="Farmacia Sol"]').click()
    // `.last()`: la ventana que se cierra se desvanece 200 ms antes de irse del DOM, y mientras hay dos.
    const ventana = page.locator('.leaflet-popup').last()
    await expect(ventana).toContainText('1 · Farmacia Sol')
    await expect(ventana).toContainText('≈ 10:05 · Rúa Sinfónica de Galicia 8, A Coruña')
    await expect(ventana).toContainText('El cliente dice: No estará · Al vecino · Portal: 1234')
    await expect(ventana.getByRole('button', { name: 'Ir', exact: true })).toBeVisible()
    await expect(ventana.getByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:600000001')
    await ventana.getByRole('button', { name: 'Abrir' }).click()
    await expect(ventana).toHaveCount(0)
    // El corte está a 0,9 km de la ruta: fuera del encuadre hasta alejar el mapa.
    await page.getByRole('button', { name: 'Zoom out' }).click()
    await page.getByRole('button', { name: 'Zoom out' }).click()
    await page.locator('.leaflet-marker-icon[title="calzada cortada (obras)"]').click()
    await expect(ventana).toContainText('Calzada cortada (obras)')
    await expect(ventana).toContainText('N-550 · pk 12.1 · Culleredo')
    await expect(ventana).toContainText('a 0,9 km de la parada 2')
    await expect(ventana).toContainText('Desde el 12/12/2025')
    await expect(ventana.getByRole('link', { name: 'Ver en Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=43.352,-8.408')
    await page.locator('.leaflet-container').click({ button: 'right', position: { x: 60, y: 330 } })
    await expect(ventana).toContainText('¿Dejar aquí la furgoneta?')
    await ventana.getByRole('button', { name: 'Aparcada aquí' }).click()
    await expect(ventana).toHaveCount(0)
    const furgo = JSON.parse(await page.evaluate(() => localStorage.getItem('fds_furgo')))
    expect(furgo).not.toMatchObject({ lat: 43.3636, lng: -8.4118 })
    expect(Math.abs(furgo.lat - 43.36)).toBeLessThan(0.05)
    await expect(page.locator('.leaflet-marker-icon[title="Tu furgoneta"]')).toHaveCount(1)
    const capaDgt = page.getByRole('group', { name: 'Capas del mapa' }).getByRole('button', { name: 'DGT 1' })
    await capaDgt.click()
    await expect(page.locator('.leaflet-marker-icon[title="calzada cortada (obras)"]')).toHaveCount(0)
    await capaDgt.click()
    await expect(page.locator('.leaflet-marker-icon[title="calzada cortada (obras)"]')).toHaveCount(1)
  })
})
