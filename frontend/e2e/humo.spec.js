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
