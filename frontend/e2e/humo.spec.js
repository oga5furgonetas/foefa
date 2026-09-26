import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* PRUEBAS DE HUMO — recorren TODA la aplicación.

   Lo que buscan es lo que un usuario nota en el primer segundo y ningún
   checker anterior detectaba: pantalla en blanco, error de React, o algo
   escupido por consola. Se ejecutan en escritorio y en móvil.

   Se prueba con el DSP VACÍO a propósito: es donde más se rompen las
   pantallas (divisiones por cero, listas indefinidas, `.map` de un undefined). */

const PANEL = [
  ['', 'Dashboard'], ['mi-dia', 'Mi día'], ['chat', 'Chat'],
  ['vehiculos', 'Vehículos'], ['inspecciones', 'Inspecciones'],
  ['revision', 'Revisión rápida'], ['origen-danos', 'Origen de daños'],
  ['vencimientos', 'Vencimientos'], ['aparcamiento', 'Aparcamiento'],
  ['incidencias', 'Incidencias'], ['ordenes', 'Órdenes de taller'],
  ['talleres', 'Talleres'], ['asignacion', 'Asignación'],
  ['plantilla', 'Plantilla del día'], ['diarios', 'DNR diaria'],
  ['turnos', 'Turnos'], ['checklist-operativo', 'Checklist'],
  ['conductores', 'Conductores'], ['incorporaciones', 'Incorporaciones'],
  ['empleo', 'Empleo'], ['contactos', 'Contactos'],
  ['conversaciones', 'Conversaciones'], ['actividad', 'Actividad'],
  ['importaciones', 'Importaciones'], ['ia-peritaje', 'IA Peritaje'],
  ['tienda', 'Tienda'], ['configuracion', 'Configuración'],
  ['avisos-itv', 'Avisos ITV'], ['renting', 'Renting'],
  ['casas-alquiler', 'Casas de alquiler'], ['usuarios', 'Usuarios'],
  ['perfil', 'Perfil'], ['portal-conductor', 'Portal conductor'],
  ['bandeja', 'Bandeja'], ['correo', 'Correo'], ['gastos', 'Gastos'],
  ['analitica', 'Analítica'], ['admin', 'Administración'],
]

const PUBLICAS = [
  ['/', 'Landing'], ['/login', 'Login'], ['/planes', 'Planes'],
  ['/registro', 'Registro'], ['/contacto', 'Contacto'],
  ['/security', 'Seguridad'], ['/peritaje-tecnico', 'Peritaje'],
  ['/verify', 'Verificador'], ['/privacidad', 'Privacidad'],
  ['/terminos', 'Términos'], ['/cookies', 'Cookies'],
  ['/aviso-legal', 'Aviso legal'], ['/conductor', 'Portal del conductor'],
  // El alta CON plan y flota elegidos: es lo que ve el cliente justo despues
  // de pulsar contratar, y se rompio al cambiar la tarifa (una llamada con la
  // firma vieja dejaba la pantalla en el aviso de error).
  ['/registro?plan=completo&billing=monthly&flota=120', 'Alta con plan elegido'],
]

/** Recoge los errores de consola y los fallos de JS de una página. */
function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // Ruido conocido que no indica un bug del código: recursos que la API
    // simulada no sirve (imágenes, fuentes) y avisos de red del navegador.
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/** La pantalla tiene contenido de verdad (no está en blanco ni es un error). */
async function tieneContenido(page) {
  const texto = (await page.locator('body').innerText().catch(() => '')) || ''
  return texto.trim().length > 20
}

test.describe('Panel de administración', () => {
  for (const [ruta, nombre] of PANEL) {
    test(`${nombre} carga sin errores`, async ({ page }) => {
      const fallos = vigilar(page)
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')

      await page.goto(`/panel/${ruta}`, { waitUntil: 'domcontentloaded' })
      /* Se espera a que la pantalla TENGA contenido, no a un reloj fijo. Con
         1200 ms clavados, «Contactos» fallaba al correr las 146 pruebas a la
         vez —tres navegadores compitiendo— y pasaba 3 de 3 al correrla sola:
         no fallaba la app, fallaba el cronometro. Un test que falla uno de
         cada diez deja de leerse, igual que un checker que grita en falso.
         Si el contenido no llega nunca, la comprobacion de abajo sigue
         fallando: esto no debilita nada, solo deja de medir el reloj. */
      await page
        .waitForFunction(() => (document.body.innerText || '').trim().length > 20,
                         null, { timeout: 15000 })
        .catch(() => {})

      // GUARDIA CONTRA FALSOS VERDES: si la sesión no se acepta, el panel
      // redirige a login — y esa pantalla también tiene texto, así que la
      // prueba pasaría sin haber entrado. Se comprueba que seguimos dentro.
      expect(page.url(), `${nombre}: redirigió a login (sesión no aceptada)`)
        .not.toContain('/login')

      /* Con `expect.poll` y no con una lectura suelta: una pantalla que pinta su
         cascaron y enseguida suspende un trozo perezoso (Informes -> pestana WHC)
         esconde por un instante todo lo que ya se veia, y una lectura suelta
         justo en ese instante decia «en blanco» 1 de cada 6 veces con la maquina
         cargada. Si la pantalla NO llega a tener contenido, el poll se agota y
         falla igual: no mira menos, deja de mirar solo un fotograma. */
      await expect.poll(() => tieneContenido(page), { message: `${nombre}: pantalla en blanco`, timeout: 15000 }).toBe(true)
      // El límite de la app: si React se cae, sale su pantalla de error
      const rota = await page.getByText(/Algo ha fallado|Error inesperado/i).count()
      expect(rota, `${nombre}: la aplicación mostró su pantalla de error`).toBe(0)
      expect(fallos, `${nombre}: ${fallos.join(' | ')}`).toHaveLength(0)
    })
  }
})

test.describe('Páginas públicas', () => {
  for (const [ruta, nombre] of PUBLICAS) {
    test(`${nombre} carga sin errores`, async ({ page }) => {
      const fallos = vigilar(page)
      await simularApi(page, 'vacio')

      await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)

      /* Con `expect.poll` y no con una lectura suelta: una pantalla que pinta su
         cascaron y enseguida suspende un trozo perezoso (Informes -> pestana WHC)
         esconde por un instante todo lo que ya se veia, y una lectura suelta
         justo en ese instante decia «en blanco» 1 de cada 6 veces con la maquina
         cargada. Si la pantalla NO llega a tener contenido, el poll se agota y
         falla igual: no mira menos, deja de mirar solo un fotograma. */
      await expect.poll(() => tieneContenido(page), { message: `${nombre}: pantalla en blanco`, timeout: 15000 }).toBe(true)
      expect(fallos, `${nombre}: ${fallos.join(' | ')}`).toHaveLength(0)
    })
  }
})

/* VALOR es SOLO del super-admin. Quien no lo es no la ve en el menú (ni en el
   de escritorio ni en el del móvil) y, si escribe la dirección, se le echa.
   El servidor además contesta 403: eso lo prueba backend/tests/test_valor_acceso.py. */
test.describe('Valor, solo super-admin', () => {
  const OPORTUNIDAD = {
    id: 7, evento_id: 'e1', mercado: '1x2', linea: null, seleccion: 'local', casa: 'bet365',
    cuota: 2.3, prob_justa: 0.46, ev: 0.058, importe: 40, en_vivo: 0, fallo: 'casa lenta',
    motivos: ['CASA LENTA: pinnacle ha bajado esta cuota de 2.30 a 2.10 en 25 min.'], avisos: [],
    local: 'Betis', visitante: 'Sevilla', liga: 'LaLiga', inicio: '2030-01-01T19:00:00+00:00',
  }

  test('quien no es super-admin no la ve y la ruta le echa', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => tieneContenido(page), { timeout: 15000 }).toBe(true)
    await expect(page.locator('a[href="/panel/valor"]')).toHaveCount(0)

    await page.goto('/panel/valor', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).not.toBe('/panel/valor')
    await expect(page.getByText('Métele')).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el super-admin la ve, la abre y lee la orden', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    await page.route('**/api/valor/oportunidades**', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ banca: 1000, items: new URL(route.request().url()).searchParams.get('vivo') ? [] : [OPORTUNIDAD] }),
    }))
    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => tieneContenido(page), { timeout: 15000 }).toBe(true)
    const entrada = page.locator('a[href="/panel/valor"]').first()
    await expect(entrada).toBeAttached()

    await page.goto('/panel/valor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Métele\s*40 €\s*a que gana Betis en/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('LA MEJOR AHORA')).toBeVisible()
    await expect(page.getByText('CASA LENTA', { exact: true })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/panel/valor')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* FURGONETAS FIJAS (pestaña de la Plantilla del día): la tabla de conductores
   con su principal, la nota de responsabilidad y la fila de aparcamiento. */
test.describe('Furgonetas fijas', () => {
  const AFINIDAD = {
    center: 'NORTE',
    cuidado_activo: false, cuidado_motivo: 'solo 1 golpes seguros en la segunda mitad',
    resumen: { conductores: 2, con_principal: 1, sin_auto: 0, operativas: 2, sugerencias: 1 },
    conductores: [
      { id: 'c1', nombre: 'Ana López', center: 'NORTE', dias_30: 12, ultima: '1234ABC',
        fija: { principal: 'v1', secundaria: null, titular: true, sin_auto: false, vetadas: [], responsabilidad: 8 },
        cuidado: { dias: 40, seguros: 0, posibles: 1 }, sugerencia: null },
      { id: 'c2', nombre: 'Luis Pérez', center: 'NORTE', dias_30: 9, ultima: '5678DEF',
        fija: { principal: null, secundaria: null, titular: false, sin_auto: false, vetadas: [], responsabilidad: null },
        cuidado: { dias: 30, seguros: 0, posibles: 0 },
        sugerencia: { furgo: 'v2', matricula: '5678DEF', veces: 4, de: 6 } },
    ],
    furgos: [
      { id: 'v1', matricula: '1234ABC', estado: 'active', bloqueada: false, operativa: true, trato: 'nueva', valor: 1,
        valor_por: 'nueva', danos_abiertos: 0, principal_de: ['c1'], secundaria_de: [], titular: 'c1' },
      { id: 'v2', matricula: '5678DEF', estado: 'taller', bloqueada: false, operativa: false, trato: '', valor: 0.4,
        valor_por: '', danos_abiertos: 2, principal_de: [], secundaria_de: [], titular: null },
    ],
  }

  test('la pestaña enseña conductores, nota, sugerencia y la fila', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/afinidad\?/, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(AFINIDAD) }))
    await page.route(/\/api\/afinidad\/fila/, (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ center: 'NORTE', filas: [['1234ABC']], actualizado_en: new Date().toISOString() }) }))
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Furgonetas fijas' }).click()
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('#ff-r-c1')).toHaveValue('8')
    await expect(page.getByText(/ha llevado la 5678DEF 4 de sus últimos 6 días/)).toBeVisible()
    await expect(page.getByText(/todavía NO cuentan en el reparto/)).toBeVisible()
    await page.getByRole('button', { name: 'Fila de aparcamiento' }).click()
    await expect(page.getByText('Fila 1')).toBeVisible()
    await expect(page.getByText(/Sin apuntar en ninguna fila/)).toContainText('5678DEF')   // la que queda sin apuntar
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

test.describe('Con datos', () => {
  test('el panel pinta una flota con contenido', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'lleno')

    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)

    await expect(page.getByText('1234 ABC')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
