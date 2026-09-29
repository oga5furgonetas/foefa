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
  ['plantilla', 'Plantilla del día'], ['diarios', 'DNR diaria'], ['horas', 'Horas · WHC'],
  ['turnos', 'Turnos'], ['cuadrante', 'Cuadrante'], ['checklist-operativo', 'Checklist'],
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
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
  const OPORTUNIDAD = {
    id: 7, evento_id: 'e1', mercado: '1x2', linea: null, seleccion: 'local', casa: 'gamdom',
    cuota: 2.3, prob_justa: 0.46, ev: 0.058, importe: 40, importe_max: 40, ya_apostado: 0, en_vivo: 0,
    fallo: 'casa lenta', fuente: 'oddspapi',
    motivos: ['CASA LENTA: pinnacle ha bajado esta cuota de 2.30 a 2.10 en 25 min.'], avisos: [],
    local: 'Betis', visitante: 'Sevilla', liga: 'LaLiga', inicio: '2030-01-01T19:00:00+00:00',
    estado: 'valida', motivo: '', detectada: hace(2), ts_cuota: hace(2), ts_referencia: hace(2),
    valida_hasta: new Date(Date.now() + 8 * 60000).toISOString(),
    detalle: { referencias: { pinnacle: 2.1 }, otras: { 'codere.es': 2.05 },
               por_metodo: { proporcional: 0.47, shin: 0.46 } },
  }
  const CADUCADA = {
    ...OPORTUNIDAD, id: 8, casa: 'codere.es', local: 'Getafe', visitante: 'Osasuna', estado: 'caducada',
    motivo: 'Sus cuotas tienen más de 10 min: ya no se sabe si siguen ahí.', ts_cuota: hace(30),
    valida_hasta: hace(20),
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
      body: JSON.stringify({ banca: 1000, items: new URL(route.request().url()).searchParams.get('vivo') ? [] : [OPORTUNIDAD, CADUCADA] }),
    }))
    await page.route('**/api/valor/reglas', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ actuales: { prob_minima: 0.6, cuota_minima: 1.7 }, por_defecto: { prob_minima: 0.6, cuota_minima: 1.7 },
        elegidas: false, horas: 24, simulacion: [0.6, 0.55, 0.5].flatMap((p, i) => [[1.7, 1.5], [1.6, 1.6], [1.55, 1.55], [1.5, 1.5]]
          .map(([c, su], j) => ({ prob_minima: p, cuota_minima: c, cuota_suelo: su, senales: 10 * i + j + 1 }))) }),
    }))
    await page.route('**/api/valor/casi', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [{ ...OPORTUNIDAD, id: 9, casa: 'gamdom', local: 'Fresno State', visitante: 'Rice',
        mercado: 'handicap', linea: -14.5, seleccion: 'visitante', cuota: 1.75, prob_justa: 0.588, ev: 0.028,
        avisos: ['Sale el 59 % de las veces; tu mínimo es el 60 %.'] }] }),
    }))
    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => tieneContenido(page), { timeout: 15000 }).toBe(true)
    const entrada = page.locator('a[href="/panel/valor"]').first()
    await expect(entrada).toBeAttached()

    await page.goto('/panel/valor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Métele\s*40 €\s*a que gana Betis en/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Buscar ahora' })).toBeVisible()
    // «Lo más cerca»: dice por qué no vale y no deja apostarla.
    await expect(page.getByText('Lo más cerca (no cumple tus reglas)')).toBeVisible()
    const casi = page.locator('li', { hasText: 'Fresno State' })
    await expect(casi.getByText('NO RECOMENDADA')).toBeVisible()
    await expect(casi.getByText('Sale el 59 % de las veces; tu mínimo es el 60 %.')).toBeVisible()
    await expect(casi.getByText(/Rice \+14,5 de hándicap/)).toBeVisible()
    await expect(casi.getByRole('button')).toHaveCount(0)
    await expect(page.getByText('DESTACADA')).toBeVisible()
    await expect(page.getByText('50/50 · 46 %').first()).toBeVisible()          // prob. 0,46: se dice claro
    await expect(page.getByText(/VÁLIDA · \d+ min más/)).toBeVisible()
    await expect(page.getByText('CASA LENTA', { exact: true }).first()).toBeVisible()
    // Entre 2 y 9: los datos de arriba se fechan al CARGAR el fichero, y con la
    // batería entera esta prueba llega a correr un minuto o más tarde (salía
    // «hace 3 min» y fallaba en falso; sola pasaba siempre).
    await expect(page.getByText(/datos hace [2-9] min/).first()).toBeVisible()
    // La caducada sigue a la vista, marcada, sin «Métele» ni botón.
    await expect(page.getByText('CADUCADA', { exact: true })).toBeVisible()
    await expect(page.getByText(/No apostar\./)).toBeVisible()
    const tarjetaCaducada = page.locator('article', { hasText: 'Getafe' })
    await expect(tarjetaCaducada.getByText(/Métele/)).toHaveCount(0)
    await expect(tarjetaCaducada.getByRole('button', { name: 'La he metido' })).toHaveCount(0)
    // «La he metido»: la ventana trae la cuota y el importe detectados.
    await page.getByRole('button', { name: 'La he metido' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Apuntar la apuesta' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo.locator('input').first()).toHaveValue('2,30')
    await expect(dialogo.locator('input').nth(1)).toHaveValue('40')
    await dialogo.locator('input').first().fill('2,10')
    await expect(dialogo.getByText(/ya no hay ventaja/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    for (const pest of ['Mis apuestas', 'Aprendizaje', 'Datos']) {
      await page.getByRole('button', { name: new RegExp(`^${pest}`) }).click()
    }
    await expect(page.getByText('Tus casas')).toBeVisible()
    // Tus reglas: 3 × 3 con lo que habría salido, y la tuya marcada.
    await expect(page.getByText('Tus reglas', { exact: true })).toBeVisible()
    await expect(page.getByText('(la tuya)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Usar estas' })).toBeDisabled()
    // Con los datos de arriba: 60 % y «desde 1,70*» → 1; 60 % y «desde 1,55» → 3.
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Usar estas' })).toBeEnabled()
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
    await expect(page.getByText('1 de 2 conductores con furgoneta')).toBeVisible()
    await expect(page.getByText('Nota 8/10')).toBeVisible()
    await expect(page.getByText(/Lleva la .* 4 de sus últimos 6 días/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Asignársela' })).toBeVisible()
    await expect(page.getByText(/Los golpes se muestran solo como dato/)).toBeVisible()
    // Al abrir a Ana, su nota (8) sale marcada y cada interruptor dice lo que hace.
    await page.getByRole('button', { name: /Editar/ }).first().click()
    await expect(page.locator('#ff-r-c1 button[aria-pressed="true"]')).toHaveText('8')
    await expect(page.getByText('Tiene preferencia si la comparte')).toBeVisible()
    await page.getByRole('tab', { name: /Fila de aparcamiento/ }).click()
    await expect(page.getByText('Fila 1')).toBeVisible()
    await expect(page.getByText(/Sin apuntar en ninguna fila/).locator('..')).toContainText('5678 DEF')   // la que queda sin apuntar
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* HORAS (WHC): el plan guardado se analiza solo al entrar y «pasado» es solo
   lo cerrado; quien está en ruta sale como «se pasa hoy si acaba». */
test.describe('Horas · WHC', () => {
  const conductor = (nombre, trabajado, extra) => ({
    nombre, trabajado, planificado: 0, bloques: [], dias_trabajados: 5, margen_semanal: 3270 - trabajado,
    supera_semanal: false, pasara_hoy: false, cerrado: trabajado, al_limite: false, trabajando_ahora: false,
    riesgo_diario: [], bloques_pasados: [], incumple_propio: false, cuadra: true, trabajado_origen: 'portal', ...extra,
  })
  const ANALISIS = {
    centro: 'NORTE', semana_del_plan: '2026-09-27', guardado: true, aviso_guardado: null,
    whc: { conductores_con_actividad: 3, excepciones: null, excepciones_conocidas: false, porcentaje: null,
      tier: null, coste_por_excepcion: 33.33 },
    whc_propio: { conductores: 3, incumplen: 1, por_semanal: 1, por_bloque: 0, porcentaje: 66.7,
      limite_semanal_min: 3270, limite_bloque_min: 660, quien: [] },
    ritmo: { dia_semana: 6, dia_leido_del_plan: true, bloques_ref: 6, horas_ref_min: 3240, pasados: 1, peligro: 1,
      justos: 0, en_ruta_ahora: 1, avisos: [
        { nombre: 'ANA PÉREZ', trabajado: 3540, estado: 'peligro', exceso: 300, proyeccion: 3540,
          proyeccion_pasa: true, bloques: 6, bloques_leidos: 6, bloques_hechos: 6, bloques_restantes: 0, trabajando_ahora: true },
      ] },
    conductores: [
      conductor('ANA PÉREZ', 3540, { pasara_hoy: true, cerrado: 3000, trabajando_ahora: true }),
      conductor('LUIS GÓMEZ', 3420, { supera_semanal: true, incumple_propio: true }),
      conductor('SARA VIDAL', 1620, {}),
    ],
    resumen: { total: 3, superan: 1, pasaran_hoy: 1, bloque_pasado: 0, incumplen_propio: 1, al_limite: 0,
      con_riesgo_diario: 0, no_cuadran: 0 },
    aviso_diario: 'Los bloques largos son un aviso de riesgo, no un incumplimiento.',
  }

  test('con el plan guardado dice cómo vamos sin pegar nada', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    await page.route(/\/api\/whc\/estado/, json({ semana_en_curso: '2026-09-27', faltan: [], como_se_arregla: '',
      naves: [{ centro: 'NORTE', semana: '2026-09-27', al_dia: true, conductores: 3, semanas_atras: 0 }] }))
    await page.route(/\/api\/whc\/plan/, json({ hay: true, semana: '2026-09-27', texto: 'ANA PÉREZ\n59h 00m / 60h\n'.repeat(4),
      excepciones: null, updated_at: new Date().toISOString() }))
    await page.route(/\/api\/whc\/analizar/, json(ANALISIS))
    await page.goto('/panel/horas', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Cómo vamos · NORTE/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('1 ya pasados (horas cerradas)')).toBeVisible()
    await expect(page.getByText('1 se pasan hoy si acaban la ruta')).toBeVisible()
    await expect(page.getByText('Se pasa hoy si acaba')).toBeVisible()
    await expect(page.getByText('WHC de Amazon: todavía no se sabe.')).toBeVisible()
    await expect(page.getByText('al día · 3 conductores')).toBeVisible()
    // El plan guardado no obliga a volver a pegar: la caja no está.
    await expect(page.locator('#horas-plan')).toHaveCount(0)
    await page.getByRole('button', { name: 'Pegar uno nuevo' }).click()
    await expect(page.locator('#horas-plan')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* PLANTILLA DEL DÍA (30-09-2026): cada columna de hora se puede quitar por
   separado, la hora se escribe bien al salir de la celda y «Poner móviles»
   rellena los vacíos con el de la ficha. */
test.describe('Plantilla del día · columnas, horas y móviles', () => {
  const FILA = (conductor, movil = '') => ({ ruta: 'CA_A1', conductor, movil, furgo: '', h_llegada: '', h_bajada: '',
    h_salida: '', observaciones: '' })
  const BORRADOR = { id: 'b1', revision: 1, updated_by: 'Admin Test',
    state: { week: '40', date: '30/09/2026', rows: [FILA('ANA PÉREZ'), FILA('LUIS GÓMEZ')] } }
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  test('se quitan columnas sueltas, la hora queda bien y se ponen los móviles', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    let revision = 1
    await page.route(/\/api\/tools\/plantilla-compartida/, (route) => (route.request().method() === 'PATCH'
      ? json({ revision: ++revision, updated_by: 'Admin Test' })(route) : json(BORRADOR)(route)))
    await page.route(/\/api\/tools\/plantilla-moviles/, json({
      propuestas: [{ fila: 0, movil: '612345678', de: 'personal' }], sin_ficha: [], sin_movil: [1] }))
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    const cabecera = page.locator('thead')
    await expect(cabecera.getByText('H. llegada')).toBeVisible({ timeout: 15000 })
    // Llegada fuera, carga y salida se quedan: ya no van juntas.
    await page.getByRole('checkbox', { name: 'H. llegada' }).uncheck()
    await expect(cabecera.getByText('H. llegada')).toHaveCount(0)
    await expect(cabecera.getByText('H. carga')).toBeVisible()
    await expect(cabecera.getByText('H. salida')).toBeVisible()
    // «930» pasa a «09:30» al salir de la celda, no mientras se escribe.
    const salida = page.getByRole('textbox', { name: 'H. salida' }).first()
    await salida.fill('930')
    await expect(salida).toHaveValue('930')
    await salida.press('Tab')
    await expect(salida).toHaveValue('09:30')
    // «Poner móviles» rellena el vacío de Ana y dice por qué no el de Luis.
    await page.getByRole('button', { name: 'Poner móviles' }).click()
    await expect(page.getByRole('textbox', { name: 'Móvil' }).first()).toHaveValue('612345678')
    await expect(page.getByText(/1 móviles puestos · 1 sin móvil en su ficha/)).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* CUADRANTE: la hoja como la de Dani (rutas, máxima, diferencia), la propuesta
   del motor con lo que cambia, y el chat que enseña lo entendido y NO aplica
   nada hasta confirmar (29-09-2026). */
test.describe('Cuadrante', () => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const lunes = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })()
  const dia = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d) }
  const DATOS = () => {
    const personas = [
      { id: 'p1', nombre: 'ANA PÉREZ', tipo: 'normal', ficha_activa: true, apodos: [], nota: 'solo trabaja 4 días',
        reglas: { dias_semana: 4 }, entendido: ['Trabaja 4 días por semana, sin día extra'], sin_entender: '', reglas_fijas: [] },
      { id: 'p2', nombre: 'LUIS GÓMEZ', tipo: 'empresa', ficha_activa: true, apodos: [], nota: '', reglas: {},
        entendido: [], sin_entender: '', reglas_fijas: [] },
      { id: 'p3', nombre: 'SARA VIDAL', tipo: 'normal', ficha_activa: true, apodos: ['sari'], nota: '', reglas: {},
        entendido: [], sin_entender: '', reglas_fijas: [], inactivo_desde: dia(10) },
    ]
    const celdas = {}
    for (let i = 0; i < 14; i++) {
      celdas[`p1|${dia(i)}`] = { cod: i % 7 < 4 ? '1' : 'N/T', extra: false, fijada: i === 2 }
      celdas[`p2|${dia(i)}`] = { cod: i % 7 < 5 ? '1' : 'N/T', extra: false, fijada: false }
      celdas[`p3|${dia(i)}`] = { cod: i === 3 ? 'V' : '1', extra: i === 5, fijada: false }
    }
    const maximas = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [dia(i), 1]))
    return {
      center: 'NORTE', desde: dia(0), hasta: dia(13), hoy: dia(1), personas, celdas, maximas, objetivos: {},
      config: { colchon: 2, permitir_extra: true }, ajustes: [], aprobados: [],
      propuesta: { id: 'pr1', desde: dia(2), hasta: dia(13), n_cambios: 1, extras: 1, faltan_conductores: 1,
        resumen_dias: [{ fecha: dia(2), maxima: 1, colchon: 2, objetivo: 3, planificadas: 3, diferencia: 2 }],
        avisos: ['1 días EXTRA (6º día de la semana) para llegar a +2.'],
        cambios: [{ driver_id: 'p1', fecha: dia(4), antes: 'N/T', valor: '1', extra: true, antes_extra: false }] },
      ultimo_cambio: { id: 'c1', que: 'Importar la hoja MENSUAL', en: new Date().toISOString(), por: 'Admin' },
      tipos: ['normal', 'empresa', 'finde', 'inactivo'],
    }
  }
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  test('pinta la hoja con rutas, máxima y diferencia, y la propuesta del motor', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/cuadrante\?/, json(DATOS()))
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Diferencia (objetivo +2)')).toBeVisible()
    await expect(page.getByText('Propuesta del motor')).toBeVisible()
    await expect(page.getByText(/harían falta un conductor más/)).toBeVisible()
    await expect(page.getByRole('button', { name: /ANA PÉREZ/ })).toBeVisible()
    await expect(page.getByText(/SE VA/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deshacer último cambio' })).toBeVisible()
    // Con la propuesta a la vista, tocar una celda no cambia nada: avisa.
    await page.getByRole('button', { name: 'Ver lo actual' }).click()
    await expect(page.getByRole('button', { name: 'Ver la propuesta' })).toBeVisible()
    // La nota de Ana: lo que aplica el motor, en su editor.
    await page.route(/\/api\/cuadrante\/nota/, json({ reglas: { dias_semana: 4 },
      entendido: ['Trabaja 4 días por semana, sin día extra'], sin_entender: '' }))
    await page.getByRole('button', { name: /ANA PÉREZ/ }).click()
    await expect(page.getByText(/El motor aplicará: Trabaja 4 días/)).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el asistente enseña lo entendido y solo aplica al confirmar', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.setViewportSize({ width: 1500, height: 900 })
    await page.route(/\/api\/cuadrante\?/, json(DATOS()))
    let confirmado = false
    await page.route(/\/api\/cuadrante\/chat\/m1\/confirmar/, (route) => {
      confirmado = true
      return json({ ok: true, hechas: ['SARA VIDAL: N/D en 5 días'], malas: [], propuesta: null, error: '' })(route)
    })
    await page.route(/\/api\/cuadrante\/chat$/, (route) => (route.request().method() === 'POST'
      ? json({ id: 'm1', rol: 'asistente', estado: 'pendiente', fuente: 'reglas', resumen: 'Sari no puede.',
        acciones: [{ accion: 'marcar_ausencia', conductor_id: 'p3', desde: dia(2), hasta: dia(6), codigo: 'N/D' },
          { accion: 'recalcular' }],
        lineas: ['SARA VIDAL → N/D (no disponible) del … al …', 'Rehacer el cuadrante'], malas: [] })(route)
      : json({ mensajes: [] })(route)))
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Asistente', exact: true }).click()
    await page.getByLabel('Mensaje para el asistente del cuadrante').fill('Sari esta semana no puede')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('He entendido esto:')).toBeVisible()
    expect(confirmado).toBe(false)
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('✓ SARA VIDAL: N/D en 5 días')).toBeVisible()
    expect(confirmado).toBe(true)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* FICHAS SIN CENTRO: salen en la lista marcadas, y el alta nace en el centro
   que se está mirando (27-09-2026: «no se pueden crear fichas»). */
test.describe('Conductores sin centro', () => {
  test('la ficha sin centro se ve y el alta nace en el centro elegido', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'd1', name: 'Estela Alen Lage', email: 'estela@ejemplo.es', center: '', active: true },
        { id: 'd2', name: 'Ana Pérez', center: 'NORTE', active: true, transporter_id: 'A2S2HK9FC8JOUX' },
      ]) }))
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Estela Alen Lage')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('sin centro', { exact: true })).toBeVisible()
    await expect(page.getByText(/ficha no tiene centro/)).toBeVisible()
    // La ficha de Ana enseña su ID de reparto.
    await page.getByText('Ana Pérez').click()
    await expect(page.getByText('A2S2HK9FC8JOUX')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Añadir conductor' }).first().click()
    await expect(page.locator('#driver-form select').first()).toHaveValue('NORTE')
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
