/* global Buffer */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* PRUEBAS DE HUMO — recorren TODA la aplicación.

   Lo que buscan es lo que un usuario nota en el primer segundo y ningún
   checker anterior detectaba: pantalla en blanco, error de React, o algo
   escupido por consola. Se ejecutan en escritorio y en móvil.

   Se prueba con el DSP VACÍO a propósito: es donde más se rompen las
   pantallas (divisiones por cero, listas indefinidas, `.map` de un undefined). */

const PANEL = [
  ['', 'Dashboard'], ['mi-dia', 'Mi día'], ['chat', 'Chat'], ['centro-ia', 'Centro de IA'],
  ['vehiculos', 'Vehículos'], ['estado-flota', 'Estado de la flota'], ['inspecciones', 'Inspecciones'],
  ['revision', 'Revisión rápida'], ['origen-danos', 'Origen de daños'],
  ['vencimientos', 'Vencimientos'], ['aparcamiento', 'Aparcamiento'],
  ['incidencias', 'Incidencias'], ['ordenes', 'Órdenes de taller'],
  ['talleres', 'Talleres'], ['asignacion', 'Asignación'],
  ['plantilla', 'Plantilla del día'], ['diarios', 'DNR diaria'], ['horas', 'Horas · WHC'],
  ['reparto', 'Reparto'],
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
  ['/', 'Landing'], ['/login', 'Login'], ['/planes', 'Planes'], ['/invita?ref=ABCDE1', 'Landing de invitación'],
  ['/registro', 'Registro'], ['/contacto', 'Contacto'], ['/iphone', 'Guía de iPhone'],
  ['/security', 'Seguridad'], ['/peritaje-tecnico', 'Peritaje'],
  ['/verify', 'Verificador'], ['/privacidad', 'Privacidad'],
  ['/terminos', 'Términos'], ['/encargo', 'Encargo del tratamiento'], ['/cookies', 'Cookies'],
  ['/aviso-legal', 'Aviso legal'], ['/conductor', 'Portal del conductor'],
  // El alta CON plan y flota elegidos: es lo que ve el cliente justo despues
  // de pulsar contratar, y se rompio al cambiar la tarifa (una llamada con la
  // firma vieja dejaba la pantalla en el aviso de error).
  ['/registro?plan=completo&billing=monthly&flota=120', 'Alta con plan elegido'],
  // El primer paso nuevo (03-10-2026): qué tipo de empresa es.
  ['/registro?sector=supermercado&plan=completo', 'Alta de un supermercado'],
  ['/prueba-reparto', 'Prueba del reparto sin registro'],
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

/* MÓVILES DE EMPRESA (30-09-2026): la pestaña de la plantilla da de alta las
   extensiones, pone a cada uno el suyo y el de reserva, avisa si dos comparten
   el mismo y entiende la lista pegada de su hoja sin inventarse a nadie. */
test.describe('Plantilla del día · móviles de empresa', () => {
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  test('extensiones, el suyo y el de reserva, y pegar la lista', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const estado = {
      center: 'NORTE',
      moviles: [{ id: 'm1', extension: '4114', numero: '', nota: '', activo: true, de: [{ id: 'd1', nombre: 'ANA PÉREZ', como: 'suyo' }, { id: 'd2', nombre: 'LUIS GÓMEZ', como: 'suyo' }] },
        { id: 'm2', extension: '1117', numero: '', nota: '', activo: true, de: [] }],
      conductores: [{ id: 'd1', nombre: 'ANA PÉREZ', center: 'NORTE', suyo: 'm1', reserva: null },
        { id: 'd2', nombre: 'LUIS GÓMEZ', center: 'NORTE', suyo: 'm1', reserva: null },
        { id: 'd3', nombre: 'SARA VIDAL', center: 'NORTE', suyo: null, reserva: null }],
    }
    const pedidos = []
    await page.route(/\/api\/moviles(\?|$)/, (route) => {
      if (route.request().method() === 'POST') {
        pedidos.push(['alta', route.request().postDataJSON()])
        return json({ anadidas: ['4864'], repetidas: ['4114'], malas: [] })(route)
      }
      return json(estado)(route)
    })
    await page.route(/\/api\/moviles\/conductor\//, (route) => {
      pedidos.push(['asignar', route.request().postDataJSON()])
      return json({ ok: true })(route)
    })
    await page.route(/\/api\/moviles\/pegar/, json({ lineas: [
      { linea: 1, nombre: 'SARA VIDAL', moviles: ['1117', '4114'], driver_id: 'd3', ficha: 'SARA VIDAL', estado: 'ok' },
      { linea: 2, nombre: 'PEPITO', moviles: ['4552'], driver_id: null, ficha: '', estado: 'sin_ficha' }] }))
    await page.addInitScript(() => localStorage.setItem('plantilla.vista', JSON.stringify('moviles')))
    await page.goto('/panel/plantilla', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Quién lleva cada uno')).toBeVisible({ timeout: 15000 })
    // Ana y Luis comparten el 4114: se avisa, no se prohíbe.
    await expect(page.getByText(/también es de LUIS/)).toBeVisible()
    // Alta de varias de golpe.
    await page.getByLabel('Extensiones nuevas').fill('4864 4114')
    await page.getByRole('button', { name: 'Añadir' }).click()
    await expect(page.getByText('Añadidos: 4864 · ya estaban: 4114.')).toBeVisible()
    expect(pedidos[0]).toEqual(['alta', { center: 'NORTE', extensiones: '4864 4114' }])
    // A Sara, el suyo y el de reserva: se guarda al elegirlo.
    await page.getByLabel('Su móvil: SARA VIDAL').selectOption('m2')
    await expect.poll(() => pedidos.length).toBe(2)
    expect(pedidos[1]).toEqual(['asignar', { center: 'NORTE', suyo: 'm2', reserva: null }])
    // Pegar: lo que no casa sin duda se dice y no se aplica.
    await page.getByRole('button', { name: 'Pegar la lista de tu hoja' }).click()
    await page.getByLabel('Lista de conductores y móviles').fill('SARA VIDAL 1117 4114\nPEPITO 4552')
    await page.getByRole('button', { name: 'Ver qué entiendo' }).click()
    await expect(page.getByText('no sé quién es: no se toca')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aplicar 1' })).toBeEnabled()
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

  test('gente que baja de otros centros: fila editable que suma a la diferencia, y se guarda', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const d = DATOS()
    d.ajustes = [{ id: 'a1', center: 'NORTE', tipo: 'refuerzo_dia', fecha: dia(1), refuerzo: 3 }]
    await page.route(/\/api\/cuadrante\?/, json(d))
    let guardado = null
    await page.route(/\/api\/cuadrante\/ajustes$/, async (route) => { guardado = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }) })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Bajan de otros centros', { exact: true })).toBeVisible({ timeout: 15000 })
    // El día con 3 que bajan viene ya puesto.
    await expect(page.getByLabel(new RegExp(`Bajan de otros centros el ${dia(1).slice(8, 10)}/`))).toHaveValue('3')
    // Poner 2 otro día lo guarda como orden del centro.
    const otro = page.getByLabel(new RegExp(`Bajan de otros centros el ${dia(3).slice(8, 10)}/`))
    await otro.fill('2')
    await otro.blur()
    await expect.poll(() => guardado).toMatchObject({ tipo: 'refuerzo_dia', fecha: dia(3), refuerzo: 2 })
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

  /* LA HOJA (30-09-2026, Dani: «que si le clicas se expanda y sea un propio
     Excel con su diario, su mensual y lo de deber horas, y se pueda editar»). */
  test('la hoja se maneja como Excel: flechas al escribir, espacios, copiar y confirmar', async ({ page, context }) => {
    const fallos = vigilar(page)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const datos = DATOS()
    datos.propuesta = null
    // Siete seguidos de ANA desde el lunes: el domingo (7º) sale en rojo.
    for (let i = 0; i < 7; i++) datos.celdas[`p1|${dia(i)}`] = { cod: '1', extra: false, fijada: false }
    await page.route(/\/api\/cuadrante\?/, json(datos))
    const pedidos = []
    await page.route(/\/api\/cuadrante\/celdas/, (route) => {
      pedidos.push(route.request().postDataJSON().cambios)
      return json({ ok: true, guardadas: 1, bloqueadas: [], cambio_id: 'c1' })(route)
    })
    await page.addInitScript(() => localStorage.setItem('cuadrante.hoja', 'MENSUAL'))
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Abrir como hoja (Excel)' }).click()
    const hoja = page.getByLabel('Hoja MENSUAL')
    await expect(hoja).toBeVisible()
    await expect(page.locator('[data-celda="0-6"]')).toHaveAttribute('title', /7º DÍA SEGUIDO/)
    // Escribir y flecha a la derecha: guarda y se mueve, como en Excel.
    await page.locator('[data-celda="1-2"]').click()
    await page.keyboard.type('v')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => pedidos.length).toBe(1)
    expect(pedidos[0]).toEqual([{ driver_id: 'p2', fecha: dia(2), cod: 'V', extra: false }])
    await expect(page.locator('[data-celda="1-3"]')).toHaveClass(/outline-brand-400/)
    // Un espacio suelto no vacía nada.
    await page.keyboard.type(' ')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    expect(pedidos.length).toBe(1)
    // Ctrl+C copia la selección con tabuladores, lista para pegar en Excel.
    await page.locator('[data-celda="0-0"]').click()
    await page.locator('[data-celda="1-1"]').click({ modifiers: ['Shift'] })
    await page.keyboard.press('Control+c')
    const copiado = await page.evaluate(() => navigator.clipboard.readText())
    expect(copiado).toBe('1\t1\n1\t1')
    // Ctrl+A y Supr: se pregunta antes de vaciar el mes entero. Si se dice que no, nada.
    let pregunta = ''
    page.once('dialog', (d) => { pregunta = d.message(); d.dismiss() })
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await expect.poll(() => pregunta).toMatch(/Vas a vaciar \d+ celdas/)
    await page.waitForTimeout(300)
    expect(pedidos.length).toBe(1)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la hoja a tamaño real (68 personas × 42 días) se mueve fluida', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const datos = DATOS()
    datos.propuesta = null
    datos.personas = Array.from({ length: 68 }, (_, i) => ({ id: `q${i}`, nombre: `PERSONA ${i + 1} DE PRUEBA`, tipo: i % 9 ? 'normal' : 'empresa',
      ficha_activa: true, apodos: [], nota: '', reglas: {}, entendido: [], sin_entender: '', reglas_fijas: [] }))
    datos.celdas = {}
    datos.hasta = dia(41)
    for (const p of datos.personas) for (let i = -7; i < 42; i++) datos.celdas[`${p.id}|${dia(i)}`] = { cod: (i + Number(p.id.slice(1))) % 7 < 5 ? '1' : 'N/T' }
    datos.maximas = Object.fromEntries(Array.from({ length: 42 }, (_, i) => [dia(i), 40]))
    await page.route(/\/api\/cuadrante\?/, json(datos))
    await page.addInitScript(() => localStorage.setItem('cuadrante.hoja', 'MENSUAL'))
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Abrir como hoja (Excel)' }).click()
    await expect(page.getByLabel('Hoja MENSUAL')).toBeVisible()
    // Seis semanas, como su hoja de septiembre-octubre.
    await page.getByRole('dialog', { name: 'Hoja del cuadrante' }).getByLabel('Hasta').fill(dia(41))
    await expect(page.locator('[data-celda="67-41"]')).toBeVisible({ timeout: 15000 })
    await page.locator('[data-celda="0-0"]').click()
    /* Medido DENTRO del navegador (lo de fuera mide sobre todo a Playwright) y
       solo el trabajo de cada tecla —pintar lo que cambia, maquetar y llevar la
       celda a la vista—, no la espera al fotograma, que depende de lo cargada
       que vaya la máquina. Medianas, para que un parón suelto no cuente.
       Lo que se exige no es un número de milisegundos (en el CI, más lento, un
       límite fino falla sin que nada se haya roto) sino una PROPORCIÓN medida en
       la misma página y a la vez: moverse tiene que costar mucho menos que
       repintar la hoja entera (Ctrl+A cambia todas las filas). Con las filas
       memorizadas da 0,03 (0,07 con todas las pruebas en paralelo); sin
       memorizar, cada tecla repinta todo y da 0,20. */
    const { tecla, todo } = await page.evaluate(async () => {
      const caja = document.querySelector('[aria-label="Hoja MENSUAL"]')
      const fotograma = () => new Promise((r) => requestAnimationFrame(() => r()))
      const medir = async (ev) => {
        await fotograma()
        const t0 = performance.now()
        caja.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...ev }))
        await Promise.resolve() // React pinta lo de la tecla en esta microtarea
        caja.getBoundingClientRect() // y el navegador lo maqueta aquí
        return performance.now() - t0
      }
      const mediana = (t) => t.sort((a, b) => a - b)[Math.floor(t.length / 2)]
      const teclas = []
      for (let i = 0; i < 50; i++) teclas.push(await medir({ key: i < 20 ? 'ArrowRight' : 'ArrowDown' }))
      const enteras = []
      for (let i = 0; i < 12; i++) {
        enteras.push(await medir({ key: 'a', ctrlKey: true }))
        await medir({ key: 'ArrowUp' }) // deshace la selección (esa no se cuenta)
      }
      return { tecla: mediana(teclas), todo: mediana(enteras) }
    })
    console.log(`Cada tecla: ${tecla.toFixed(1)} ms; repintar la hoja entera: ${todo.toFixed(1)} ms (${(tecla / todo).toFixed(2)})`)
    expect(tecla / todo).toBeLessThan(0.12)
    expect(tecla).toBeLessThan(16) // y en cualquier caso, dentro de un fotograma
    // Las teclas de la medida han movido de verdad: Ctrl+A llevó a la última
    // celda, ↑ a la última persona, e Inicio vuelve a su primer día.
    await page.keyboard.press('Home')
    await expect(page.locator('[data-celda="67-0"]')).toHaveClass(/outline-brand-400/)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la hoja: escribir, pegar de Excel, Ctrl+Z y las tres pestañas', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const datos = DATOS()
    datos.propuesta = null
    await page.route(/\/api\/cuadrante\?/, json(datos))
    const pedidos = []
    let n = 0
    await page.route(/\/api\/cuadrante\/celdas/, (route) => {
      pedidos.push(['celdas', route.request().postDataJSON().cambios])
      return json({ ok: true, guardadas: 1, bloqueadas: [], cambio_id: `c${++n}` })(route)
    })
    await page.route(/\/api\/cuadrante\/deshacer/, (route) => {
      pedidos.push(['deshacer', route.request().postDataJSON()])
      return json({ ok: true, que: 'Celdas' })(route)
    })
    await page.route(/\/api\/cuadrante\/diario/, (route) => {
      if (route.request().method() === 'PUT') pedidos.push(['diario', route.request().postDataJSON()])
      return json({ center: 'NORTE', fecha: dia(1), filas: {}, notas: '' })(route)
    })
    await page.route(/\/api\/cuadrante\/deber-horas/, (route) => {
      if (route.request().method() === 'POST') {
        pedidos.push(['deber', route.request().postDataJSON()])
        return json({ id: 'f1', ...route.request().postDataJSON() })(route)
      }
      return json({ filas: [{ id: 'f0', fecha: '2026-09-05', persona: 'PORTILLA', saldado: '' }] })(route)
    })
    await page.addInitScript(() => localStorage.setItem('cuadrante.hoja', 'MENSUAL'))
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Abrir como hoja (Excel)' }).click()
    const hoja = page.getByLabel('Hoja MENSUAL')
    await expect(hoja).toBeVisible()
    // Escribir encima: V y Enter. Luego «1e» es un día extra (en rosa).
    await page.locator('[data-celda="0-5"]').click()
    await page.keyboard.type('v')
    await page.keyboard.press('Enter')
    await expect.poll(() => pedidos.length).toBe(1)
    expect(pedidos[0]).toEqual(['celdas', [{ driver_id: 'p1', fecha: dia(5), cod: 'V', extra: false }]])
    await page.locator('[data-celda="1-5"]').click()
    await page.keyboard.type('1e')
    await page.keyboard.press('Enter')
    await expect.poll(() => pedidos.length).toBe(2)
    expect(pedidos[1][1][0]).toMatchObject({ driver_id: 'p2', cod: '1', extra: true })
    // Lo que no se entiende no se guarda: se dice.
    await page.locator('[data-celda="2-5"]').click()
    await page.keyboard.type('zz')
    await page.keyboard.press('Enter')
    await expect(page.getByText(/No se ha cambiado lo que no se entiende: «zz»/)).toBeVisible()
    expect(pedidos.length).toBe(2)
    // Pegar un bloque copiado de Excel: un solo guardado con las cuatro celdas.
    await page.locator('[data-celda="0-7"]').click()
    await hoja.evaluate((el, txt) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', txt)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, 'N/T\tBAJA\n1.EXTRA\tV\n')
    await expect.poll(() => pedidos.length).toBe(3)
    expect(pedidos[2][1]).toHaveLength(4)
    // La respuesta del pegado trae el `cambio_id` que Ctrl+Z manda en `solo_si`: hay que esperar a que la hoja
    // la haya APLICADO («Guardado: 4 celdas.» sale en el mismo render que apila el c3), no solo a ver salir la
    // petición. El 29-10-2026, con la máquina cargada, el Ctrl+Z llegó antes que la respuesta y mandó `c2` (dos
    // veces seguidas en la batería; aislada, la prueba pasaba siempre).
    await expect(page.getByText('Guardado: 4 celdas.')).toBeVisible()
    // Ctrl+Z: deshace lo último de ESTA hoja, y solo si sigue siendo lo último.
    await page.keyboard.press('Control+z')
    await expect.poll(() => pedidos.length).toBe(4)
    expect(pedidos[3]).toEqual(['deshacer', { center: 'NORTE', solo_si: 'c3' }])
    // DIARIO: un apunte en la columna de nota.
    await page.getByRole('button', { name: 'DIARIO', exact: true }).click()
    await expect(page.getByLabel('Hoja DIARIO')).toBeVisible()
    await page.locator('[data-celda="0-1"]').click()
    await page.keyboard.type('2wave')
    await page.keyboard.press('Enter')
    await expect.poll(() => pedidos.length).toBe(5)
    expect(pedidos[4][1].cambios).toEqual([{ driver_id: 'p1', campo: 'nota', valor: '2wave' }])
    // DEBER HORAS: escribir en la fila vacía apunta una nueva.
    await page.getByRole('button', { name: 'DEBER HORAS', exact: true }).click()
    await expect(page.getByText('Se debe todavía a')).toBeVisible()
    await page.locator('[data-celda="1-1"]').click()
    await page.keyboard.type('KARIM')
    await page.keyboard.press('Enter')
    await expect.poll(() => pedidos.length).toBe(6)
    expect(pedidos[5][1]).toMatchObject({ center: 'NORTE', persona: 'KARIM' })
    await page.getByRole('button', { name: 'Cerrar la hoja' }).click()
    await expect(hoja).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* Día concedido en Días libres: sale con candado y el menú no deja cambiarlo
     de un clic; quien aprueba días le quita el candado (30-09-2026). */
  test('un día concedido sale con candado y se desbloquea a propósito', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const datos = DATOS()
    datos.propuesta = null
    datos.celdas[`p2|${dia(5)}`] = { cod: 'N/T APROB', extra: false, fijada: true, aprobado: true }
    await page.route(/\/api\/cuadrante\?/, json(datos))
    let pedido = null
    await page.route(/\/api\/cuadrante\/celdas/, (route) => {
      pedido = route.request().postDataJSON()
      return json({ ok: true, guardadas: 1, bloqueadas: [] })(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByTitle(/LUIS GÓMEZ .*N\/T APROB/).click()
    await expect(page.getByText(/Día concedido: tiene candado/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vaciar', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Quitar candado para cambiarlo' }).click()
    await expect.poll(() => pedido).toEqual({ center: 'NORTE', cambios: [{ driver_id: 'p2', fecha: dia(5), desbloquear: true }] })
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* 30-09-2026: con DGA1 elegido arriba, la hoja de OGA5 salió con 67 «no
     tiene ficha» y «Crear ficha nueva» ya elegido. Ahora se avisa, no se deja
     importar ahí y un botón cambia de centro y vuelve a leer la misma hoja. */
  test('Google Sheets: se conecta, enseña qué cambiaría sin tocar nada y se activa', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/cuadrante\?/, json(DATOS()))
    let estado = { conectado: false }
    const modos = []
    await page.route(/\/api\/cuadrante\/sync\?/, (route) => json(estado)(route))
    await page.route(/\/api\/cuadrante\/sync\/conectar/, (route) => {
      estado = { conectado: true, modo: 'prueba', hoja_nombre: 'CUADRANTE OGA5', hoja_url: null, ultimo_contacto: null,
        ultima: null, historial: [] }
      return json({ llave: 'fs_x', script: "var FLOTA_LLAVE = 'fs_x';\nfunction instalar() {}", aviso: 'Cópialo ahora: la llave no se vuelve a enseñar.' })(route)
    })
    const emparejados = []
    await page.route(/\/api\/cuadrante\/sync\/emparejar/, (route) => {
      emparejados.push(route.request().postDataJSON())
      return json({ ok: true })(route)
    })
    await page.route(/\/api\/cuadrante\/sync\/modo/, (route) => {
      modos.push(route.request().postDataJSON())
      estado = { ...estado, modo: 'activo' }
      return json({ ok: true, modo: 'activo' })(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Google Sheets' }).click()
    const v = page.getByTestId('sync-sheets')
    await v.getByRole('button', { name: 'Conectar mi hoja de Google' }).click()
    await expect(v.getByText('Extensiones → Apps Script')).toBeVisible()
    await expect(v.getByText("var FLOTA_LLAVE = 'fs_x';")).toBeVisible()
    await expect(v.getByRole('button', { name: 'Copiar el código' })).toBeVisible()
    await expect(v.getByText('En prueba: no toca nada', { exact: true })).toBeVisible()
    await expect(v.getByRole('button', { name: /Activar/ })).toBeDisabled()        // sin ver antes qué cambiaría, no
    // Llega la hoja: en prueba enseña lo que haría.
    estado = { ...estado, ultimo_contacto: new Date().toISOString(), ultima: {
      modo: 'prueba', mensaje: 'Modo prueba, no se ha tocado nada: cambiaría 2 celdas en Flota y 1 en esta hoja.',
      pestanas: [{ nombre: '12 A 26', desde: '2026-10-01', hasta: '2026-11-02', personas: 73, emparejadas: 72, usada: true }],
      saltadas: [{ nombre: 'DIARIO', motivo: 'sin días' }], sin_ficha: ['PERSONA NUEVA'], ambiguos: [],
      codigos_desconocidos: { '1.EXTRA': 1 },
      personas: { entran: ['MANUEL POMBO'], fichas_nuevas: ['MARCOS NUEVO'], vuelven: [], retenidas: 0,
        salen: [{ nombre: 'SARA VILA', desde: '2026-10-19', por: 'fuera', dias: 7, desactiva: true }], en_app_no_en_hoja: ['MELVIN ESPINOSA'],
        revisar: [{ nombre: 'ANA PERES', motivo: 'parecido', sugerida: 'd1', opciones: [{ id: 'd1', name: 'ANA PÉREZ', activa: true, centro: null }] }] },
      cambios: [{ hacia: 'app', nombre: 'ANA PÉREZ', fecha: dia(1), antes: '1', ahora: 'N/T', por_que: 'hoja' },
        { hacia: 'hoja', nombre: 'LUIS GÓMEZ', fecha: dia(2), antes: '1', ahora: 'N/T APROB', por_que: 'día concedido en la app' }] } }
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Google Sheets' }).click()
    await expect(v.getByText('cambiaría 2 celdas en Flota y 1 en esta hoja')).toBeVisible()
    await expect(v.getByText('Pestaña «12 A 26» (01/10 → 02/11): 72 de 73 personas')).toBeVisible()
    await expect(v.getByText(/1\.EXTRA \(1\)/)).toBeVisible()
    await expect(v.getByRole('cell', { name: 'día concedido en la app' })).toBeVisible()
    const g = v.getByTestId('gente')
    await expect(g.getByText('Entrarían en el cuadrante de la app: MANUEL POMBO.')).toBeVisible()
    await expect(g.getByText(/Ficha nueva \(se haría.*MARCOS NUEVO/)).toBeVisible()
    await expect(g.getByText('Saldrían del cuadrante: SARA VILA desde el 19/10 (se quitarían 7 días), y su ficha se desactivaría.')).toBeVisible()
    await expect(g.getByText(/MELVIN ESPINOSA/)).toBeVisible()
    await g.getByTestId('revisar').getByRole('button', { name: 'Es ANA PÉREZ' }).click()
    await expect(g.getByText('Es ANA PÉREZ. Entra en la próxima sincronización.')).toBeVisible()
    expect(emparejados).toEqual([{ center: 'NORTE', nombre: 'ANA PERES', eleccion: 'd1' }])
    await v.getByRole('button', { name: /Activar/ }).click()
    await expect(v.getByText('Activa', { exact: true })).toBeVisible()
    expect(modos).toEqual([{ center: 'NORTE', modo: 'activo' }])
    // La hoja llega con un código antiguo: se avisa; y sacar otro código pide confirmación (18-10-2026).
    estado = { ...estado, llave_vieja_en: new Date().toISOString() }
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Google Sheets' }).click()
    await expect(v.getByRole('alert')).toContainText('con un código antiguo y no se ha aceptado')
    await v.getByRole('button', { name: 'Volver a sacar el script' }).click()
    await expect(v.getByText(/El que tienes pegado en la hoja dejará de funcionar/)).toBeVisible()
    await v.getByRole('button', { name: 'No', exact: true }).click()
    await expect(v.getByRole('button', { name: 'Volver a sacar el script' })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('la hoja de otro centro se avisa y se vuelve a leer en el suyo', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/cuadrante\?/, json(DATOS()))
    const leidas = []
    await page.route(/\/api\/cuadrante\/importar/, (route) => {
      const sur = /name="center"\r\n\r\nSUR\r\n/.test(route.request().postData() || '')
      leidas.push(sur ? 'SUR' : 'NORTE')
      return json({ hoja: 'SEP', desde: dia(0), hasta: dia(13), dias: 14, personas: 60, extras: 3, maximas: 14,
        tipos: { normal: 60 }, emparejadas: sur ? 59 : 1, avisos: [], ambiguos: [], detalle: [], guardado: false,
        otro_centro: sur ? null : { centro: 'SUR', casan_alli: 58, casan_aqui: 1 },
        revisar: sur ? [{ nombre: 'CAROLINA CRESPO', motivo: 'parecido', opciones: [], sugerida: null }]
          : [{ nombre: 'ALBERTO FERNANDEZ', motivo: 'parecido', opciones: [], sugerida: null }] })(route)
    })
    await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rutas (cuenta de 1)')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Importar hoja' }).click()
    await page.getByLabel('Fichero Excel del cuadrante').setInputFiles({ name: 'hoja.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') })
    await expect(page.getByText('Esta hoja es de SUR')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importar en NORTE' })).toBeDisabled()
    await expect(page.getByText('ALBERTO FERNANDEZ')).toHaveCount(0)
    await page.getByRole('button', { name: 'Cambiar a SUR' }).click()
    await expect(page.getByText('59 casan solos con su ficha.')).toBeVisible()
    await expect(page.getByText('Esta hoja es de SUR')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Importar y crear 1 ficha nueva' })).toBeEnabled()
    expect(leidas).toEqual(['NORTE', 'SUR'])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* USUARIOS: la lista de permisos es la del menú, las pantallas que van con
   otra salen detrás de la suya y la tabla dice quién ve cada una con la MISMA
   cuenta que el menú (30-09-2026: «ver quién puede ver cada cosa»). Y el
   Cuadrante con su casilla («¿no puedo marcarle cuadrante?»). */
test.describe('Usuarios', () => {
  test('quién ve cada pantalla, y editar desde la tabla', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins/, (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'a1', name: 'Dani', username: 'dani', super_admin: true },
        { id: 'a2', name: 'Mery', username: 'Mery', permissions: ['cuadrante', 'conductores'], allowed_centers: ['OGA5'], admin_role: 'dispatcher' },
        { id: 'a3', name: 'Luis', username: 'luis', permissions: null },
      ]) }))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Mery', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('ve 7 de 31 pantallas')).toBeVisible()
    await page.getByRole('button', { name: 'Quién ve cada pantalla' }).click()
    const fila = (nombre) => page.locator('tr', { has: page.locator('td', { hasText: new RegExp(`^${nombre}$`) }) })
    // Mery: el Cuadrante sí y los Días libres no (van cada uno por su lado);
    // las Órdenes, no (van con Talleres, que no tiene).
    await expect(fila('Cuadrante').locator('td').nth(2).getByLabel('la ve')).toBeVisible()
    await expect(fila('Días libres').locator('td').nth(2).getByLabel('no la ve')).toBeVisible()
    await expect(fila('Órdenes de taller').locator('td').nth(2).getByLabel('no la ve')).toBeVisible()
    // El estado de la flota va con Vehículos: Mery no los tiene, Luis (sin lista) sí.
    await expect(fila('Estado de la flota').locator('td').nth(2).getByLabel('no la ve')).toBeVisible()
    await expect(fila('Estado de la flota').locator('td').nth(3).getByLabel('la ve')).toBeVisible()
    await expect(fila('Asignación diaria').locator('td').nth(2)).toHaveText('siempre')
    await expect(fila('Vehículos').locator('td').nth(3).getByLabel('la ve')).toBeVisible()
    await page.getByRole('button', { name: 'Editar' }).first().click()
    await expect(page.getByText('Ve 7 de 31 pantallas del menú.')).toBeVisible()
    await expect(page.getByText('· va con Talleres')).toBeVisible()
    await expect(page.getByText('· va con Vehículos')).toBeVisible()
    // El Cuadrante se marca y desmarca como cualquier otra.
    const cuadrante = page.getByRole('button', { name: 'Cuadrante', exact: true })
    await expect(cuadrante).toHaveAttribute('aria-pressed', 'true')
    await cuadrante.click()
    await expect(cuadrante).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Ve 6 de 31 pantallas del menú.')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* PORTAL DEL CONDUCTOR · TUS PETICIONES (30-09-2026, Dani: «añádeles cancelar
   peticiones enviadas o cambiarlas, y que nos salte una notificación»). Lo
   pendiente se cambia (sigue siendo UNA petición) o se cancela; un aprobado
   que aún no ha llegado se devuelve. */
test.describe('Portal del conductor · tus peticiones', () => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dia = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return iso(d) }
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  const PET = (id, n, status, grupo) => ({ id, grupo, date: dia(n), status, type: 'libre', motivo: 'asuntos',
    motivo_label: 'Asuntos propios', note: 'boda de mi prima', driver_id: 'd1' })

  test('cambiar lo pendiente y devolver un día aprobado', async ({ page }) => {
    const fallos = vigilar(page)
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'NORTE' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    const pedidos = []
    await page.route(/\/api\/shifts\/mine/, json({ shifts: [], sin_ver: [], requests: [
      PET('p1', 10, 'pendiente', 'g1'), PET('p2', 11, 'pendiente', 'g1'), PET('a1', 15, 'aprobado', 'g2')] }))
    await page.route(/\/api\/shift-requests\/mias\/cambiar/, (route) => {
      pedidos.push(['cambiar', route.request().postDataJSON()])
      return json({ ok: true, dias: [dia(10)], anadidos: [], quitados: [dia(11)] })(route)
    })
    await page.route(/\/api\/shift-requests\/mias\/cancelar/, (route) => {
      pedidos.push(['cancelar', route.request().postDataJSON()])
      return json({ canceladas: [dia(15)], no: [] })(route)
    })
    page.on('dialog', (d) => d.accept())
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.getByText('Pedir días libres').first().click()
    await expect(page.getByText('Tus peticiones')).toBeVisible({ timeout: 15000 })
    // Devolver el aprobado: la oficina lo sabrá.
    await page.getByRole('button', { name: 'Ya no lo necesito' }).click()
    await expect(page.getByText('Cancelado 1 día. La oficina ya lo sabe.')).toBeVisible()
    expect(pedidos[0]).toEqual(['cancelar', { ids: ['a1'] }])
    // Cambiar lo pendiente: sus días vuelven al calendario; se quita uno y se guarda.
    await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Cambiar tu petición' })).toBeVisible()
    const d11 = Number(dia(11).slice(8))
    if (dia(11).slice(5, 7) !== dia(10).slice(5, 7)) await page.getByRole('button', { name: 'Mes siguiente' }).click()
    await page.getByRole('button', { name: String(d11), exact: true }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Petición cambiada')).toBeVisible()
    expect(pedidos[1]).toEqual(['cambiar', { grupo: 'g1', dates: [dia(10)], motivo: 'asuntos', note: 'boda de mi prima' }])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* 25-10-2026, Dani: «he entrado en 2 cuentas y no me salía ningún día para pedir». El mes en curso estaba
     cerrado por la oficina hasta fin de mes y la pantalla se abría ahí, sin un solo día que tocar. */
  test('si este mes ya no se puede pedir nada, se abre el siguiente y se dice por qué', async ({ page }) => {
    const fallos = vigilar(page)
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'NORTE' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    const hoy = new Date(); hoy.setHours(12)
    const finDeMes = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
    await page.route(/\/api\/shifts\/mine/, json({ shifts: [], sin_ver: [], requests: [] }))
    await page.route(/\/api\/shift-blocks\/mios/, json({ bloqueos: [
      { id: 'b1', center: 'NORTE', driver_id: null, desde: dia(-12), hasta: finDeMes, motivo: 'cuadrante realizado' }] }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.getByText('Pedir días libres').first().click()
    await expect(page.getByText(`${MESES[sig.getMonth()]} ${sig.getFullYear()}`)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('status').filter({ hasText: 'ya no queda ningún día que pedir' })).toHaveText(
      `En ${MESES[hoy.getMonth()]} ya no queda ningún día que pedir: la oficina lo ha cerrado hasta el ${finDeMes.slice(8, 10)}/${finDeMes.slice(5, 7)} (cuadrante realizado). Te enseñamos ${MESES[sig.getMonth()]}.`)
    // El día 1 del mes siguiente ya se puede marcar.
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByText('1 día seleccionado')).toBeVisible()
    // Al volver al mes cerrado, lo dice arriba y deja pasar al siguiente.
    await page.getByRole('button', { name: 'Mes anterior' }).click()
    await expect(page.getByText('Este mes no queda ningún día que puedas pedir.')).toBeVisible()
    await page.getByRole('button', { name: `Ver ${MESES[sig.getMonth()]} →` }).click()
    await expect(page.getByText(`${MESES[sig.getMonth()]} ${sig.getFullYear()}`)).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* La otra punta: la oficina aprueba con la bandeja abierta y, entretanto,
     quien lo pidió ha cancelado uno de los días. Ese día contesta 409; los
     demás se aprueban igual y se dice cuántos estaban cancelados (antes se
     paraba a la mitad y al reintentar volvía a chocar). */
  test('la oficina aprueba aunque un día ya lo haya cancelado quien lo pidió', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    let pendientes = [{ ...PET('p1', 10, 'pendiente', 'g1'), driver_name: 'ANA PÉREZ', center: 'NORTE' },
      { ...PET('p2', 11, 'pendiente', 'g1'), driver_name: 'ANA PÉREZ', center: 'NORTE' }]
    await page.route(/\/api\/shift-requests\?/, (route) => json({
      requests: new URL(route.request().url()).searchParams.get('status') === 'pendiente' ? pendientes : [] })(route))
    const aprobadas = []
    await page.route(/\/api\/shift-requests\/p\d\/resolve/, (route) => {
      const id = route.request().url().match(/shift-requests\/(p\d)\//)[1]
      if (id === 'p2') {
        return route.fulfill({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ detail: 'El conductor ha cancelado esta petición' }) })
      }
      aprobadas.push(id)
      pendientes = []
      return json({ success: true, status: 'aprobado' })(route)
    })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ANA PÉREZ')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Aprobar' }).click()
    await expect(page.getByText('1 de esos días ya los había cancelado ANA PÉREZ: esos no se han tocado.')).toBeVisible()
    expect(aprobadas).toEqual(['p1'])
    await expect(page.getByText('ANA PÉREZ', { exact: true })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* REFUERZOS (18-10-2026): la oficina pide gente para un día y se apunta quien libra. Lo que se prueba es la pantalla:
   publicar (y el aviso de a cuántos se ha avisado), aprobar a quien se apunta, y en el portal «Trabajar más»
   con sus vacantes. Quién lo ve y qué pasa en el cuadrante lo prueba el servidor (backend/tests/test_refuerzos.py). */
test.describe('Refuerzos', () => {
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dia = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return iso(d) }

  test('la oficina publica, ve a quién avisó y aprueba a quien se apunta', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const creados = [], resueltos = []
    let refuerzos = []
    await page.route(/\/api\/refuerzos(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        creados.push(route.request().postDataJSON())
        refuerzos = [{ id: 'r1', center: 'NORTE', date: dia(1), plazas: 2, nota: 'Salida 9:00', estado: 'abierto', avisados: 3,
          libran_ahora: 3, aprobados: 0, pendientes: 1, pasado: false,
          apuntados: [{ id: 'q1', driver_id: 'd1', driver_name: 'ANA PÉREZ', status: 'pendiente', nota: 'Puedo desde las 8',
            dias_semana: 4, ya_no_libra: false }] }]
        return json({ refuerzo: refuerzos[0], avisados: 3 })(route)
      }
      return json({ refuerzos, puede_aprobar: true })(route)
    })
    await page.route(/\/api\/shift-requests\/q1\/resolve/, (route) => {
      resueltos.push(route.request().postDataJSON())
      refuerzos = [{ ...refuerzos[0], aprobados: 1, pendientes: 0, apuntados: [{ ...refuerzos[0].apuntados[0], status: 'aprobado' }] }]
      return json({ success: true, status: 'aprobado' })(route)
    })
    await page.goto('/panel/turnos?vista=refuerzos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Pedir refuerzos' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('No hay refuerzos pedidos para los próximos días.')).toBeVisible()
    await page.getByLabel('Nota (opcional)').fill('Salida 9:00')
    await page.getByRole('button', { name: 'Publicar y avisar' }).click()
    await expect(page.getByText('Publicado. Se ha avisado a 3 personas que libran ese día.')).toBeVisible()
    expect(creados).toEqual([{ center: 'NORTE', date: dia(1), plazas: 2, nota: 'Salida 9:00' }])
    const r = page.getByTestId('refuerzo')
    await expect(r.getByText('ANA PÉREZ')).toBeVisible()
    await expect(r.getByText('«Puedo desde las 8»')).toBeVisible()
    await expect(r.getByText('4 días más esa semana')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Refuerzos · 1$/ })).toBeVisible()
    await r.getByRole('button', { name: 'Aprobar' }).click()
    await expect(page.getByText('ANA PÉREZ: aprobado. Ya está en el cuadrante como EXTRA.')).toBeVisible()
    expect(resueltos).toEqual([{ action: 'aprobar' }])
    await expect(r.getByText('1/2 aprobados')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('los días que no llegan a la máxima se piden con un clic, y quien no puede no se aprueba', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    const creados = []
    await page.route(/\/api\/refuerzos\/faltas/, json({ dias: 14, con_maximas: true, faltas: [
      { date: dia(1), dia: 'lunes 19/10', maximo: 50, en_ruta: 46, falta: 4, pueden: 9, refuerzo: null },
      { date: dia(2), dia: 'martes 20/10', maximo: 50, en_ruta: 48, falta: 2, pueden: 5, refuerzo: null },
      { date: dia(3), dia: 'miércoles 21/10', maximo: 50, en_ruta: 49, falta: 1, pueden: 0, refuerzo: null }] }))
    await page.route(/\/api\/refuerzos(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        creados.push(route.request().postDataJSON())
        return json({ refuerzo: {}, avisados: 3 })(route)
      }
      return json({ puede_aprobar: true, refuerzos: [{ id: 'r1', center: 'NORTE', date: dia(1), plazas: 4, nota: '', estado: 'abierto',
        avisados: 9, libran_ahora: 9, aprobados: 0, pendientes: 1, pasado: false, apuntados: [
          { id: 'q1', driver_id: 'd1', driver_name: 'LUIS RUIZ', status: 'pendiente', nota: '', dias_semana: 6, ya_no_libra: false,
            no_puede: 'Serían 7 días seguidos trabajando (máximo 6)' }] }] })(route)
    })
    await page.goto('/panel/turnos?vista=refuerzos', { waitUntil: 'domcontentloaded' })
    const faltas = page.getByTestId('faltas')
    await expect(faltas.getByText('faltan 4')).toBeVisible({ timeout: 15000 })
    await expect(faltas.getByText('nadie puede (trabajan o lo impide la ley)')).toBeVisible()
    await faltas.getByRole('button', { name: 'Pedir todos (2)' }).click()
    await expect(page.getByText('Pedidos 2 días. Se ha avisado a 6 personas que libran y pueden.')).toBeVisible()
    expect(creados).toEqual([{ center: 'NORTE', date: dia(1), plazas: 4, nota: '' }, { center: 'NORTE', date: dia(2), plazas: 2, nota: '' }])
    const r = page.getByTestId('refuerzo')
    await expect(r.getByText('No se puede aprobar: serían 7 días seguidos trabajando (máximo 6)')).toBeVisible()
    await expect(r.getByRole('button', { name: 'Aprobar' })).toBeDisabled()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  /* TRABAJAR MÁS (24-10-2026): las vacantes de los días bajo la máxima, a la vista en el inicio; se solicita una y
     abajo queda la constancia de sus días EXTRA. Quién ve qué (solo quien libra y puede) lo prueba el servidor. */
  const comoConductor = async (page) => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'NORTE' }))
    }, token)
    await simularApi(page, 'vacio')
  }

  test('en el portal salen las vacantes para trabajar más, se solicita y queda la constancia de EXTRA', async ({ page }) => {
    const fallos = vigilar(page)
    await comoConductor(page)
    let pedido = false
    const solicitudes = []
    await page.route(/\/api\/trabajar-mas(\?|$)/, (route) => json({
      plazas: pedido ? 1 : 3, dias: pedido ? 1 : 2,
      vacantes: [
        { date: dia(1), dia: 'lunes 19/10', quedan: 2, nota: '', refuerzo_id: pedido ? 'r1' : null, de_la_oficina: false, mi_estado: pedido ? 'pendiente' : null },
        { date: dia(3), dia: 'miércoles 21/10', quedan: 1, nota: 'Ruta de tarde', refuerzo_id: 'r2', de_la_oficina: true, mi_estado: null }],
      extras: [{ id: 'x1', date: dia(5), dia: 'viernes 23/10', center: 'NORTE', confirmado_por: 'Oficina', confirmado_en: '2026-10-18T19:40:00Z',
        en_cuadrante: true, pasado: false, puede_soltar: true }] })(route))
    await page.route(/\/api\/trabajar-mas\/[\d-]+\/solicitar/, (route) => {
      solicitudes.push({ url: route.request().url(), body: route.request().postDataJSON() })
      pedido = true
      return json({ ok: true })(route)
    })
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByTestId('trabajar-mas')
    await expect(tarjeta).toBeVisible({ timeout: 15000 })
    await expect(tarjeta).toContainText('3 vacantes')
    await expect(tarjeta).toContainText('Nos falta gente en 2 días que libras.')
    await tarjeta.click()
    await expect(page.getByRole('heading', { name: 'Trabajar más' })).toBeVisible()
    await expect(page.getByText('Hay 3 vacantes en 2 días que libras.')).toBeVisible()
    const lunes = page.getByRole('region', { name: 'Vacante del lunes 19/10' })
    await expect(lunes.getByText('2 vacantes')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Vacante del miércoles 21/10' }).getByText('Lo ha pedido la oficina')).toBeVisible()
    await lunes.getByLabel('Nota para la oficina').fill('Puedo desde las 8')
    await lunes.getByRole('button', { name: 'Solicitar este día' }).click()
    await expect(lunes.getByText('Solicitado. La oficina te confirmará.')).toBeVisible()
    expect(solicitudes).toEqual([{ url: expect.stringContaining(`/api/trabajar-mas/${dia(1)}/solicitar`), body: { nota: 'Puedo desde las 8' } }])
    const extra = page.getByTestId('dias-extra')
    await expect(extra.getByText('EXTRA', { exact: true })).toBeVisible()
    await expect(extra).toContainText('Viernes 23/10')
    await expect(extra).toContainText('Confirmado por Oficina')
    await expect(extra.getByRole('button', { name: 'Al final no puedo' })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin vacantes en sus días libres, la tarjeta no sale', async ({ page }) => {
    await comoConductor(page)
    await page.route(/\/api\/trabajar-mas(\?|$)/, (route) => json({ vacantes: [], plazas: 0, dias: 0, extras: [] })(route))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Pedir días libres').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('trabajar-mas')).toHaveCount(0)
  })
})

/* SUSPENSIONES (18-10-2026): la oficina suspende a alguien de un día a otro; él lo ve en el portal y en sus turnos, y no
   puede auditar. Qué días se tocan y qué no, y que nada lo pise, lo prueba el servidor (test_suspensiones.py). */
test.describe('Suspensiones', () => {
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dia = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return iso(d) }

  test('la oficina suspende de un día a otro, ve el resumen y la levanta', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, json([{ id: 'd1', name: 'PEPE GÓMEZ', center: 'NORTE', active: true }]))
    const creadas = [], levantadas = []
    let lista = []
    await page.route(/\/api\/suspensiones(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        creadas.push(route.request().postDataJSON())
        lista = [{ id: 's1', driver_id: 'd1', driver_name: 'PEPE GÓMEZ', center: 'NORTE', desde: dia(1), hasta: dia(5),
          motivo: 'Sanción por carta del 15-10', estado: 'activa', en_curso: false, por_venir: true, creado_por: 'Admin Test',
          respetados: [{ date: dia(5), cod: 'V', etiqueta: 'Vacaciones' }] }]
        return json({ suspension: lista[0], dias_trabajo: [dia(1), dia(2), dia(3)], dias_libres: [dia(4)],
          respetados: lista[0].respetados, extras_contestados: 0 })(route)
      }
      return json({ suspensiones: lista, puede: true })(route)
    })
    await page.route(/\/api\/suspensiones\/s1\/levantar/, (route) => { levantadas.push('s1'); lista = []; return json({ ok: true, dias_devueltos: 4 })(route) })
    await page.goto('/panel/turnos', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Suspensiones', exact: true }).click({ timeout: 15000 })
    await expect(page.getByText('No hay nadie suspendido ahora ni más adelante.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Suspender esos días' })).toBeDisabled()      // falta todo
    await page.getByLabel('Conductor').selectOption('d1')
    await page.getByLabel('Hasta (incluido)').fill(dia(5))
    await page.getByLabel('Motivo (lo ve solo la oficina)').fill('Sanción por carta del 15-10')
    await page.getByRole('button', { name: 'Suspender esos días' }).click()
    expect(creadas).toEqual([{ driver_id: 'd1', desde: dia(1), hasta: dia(5), motivo: 'Sanción por carta del 15-10' }])
    await expect(page.getByText(/PEPE GÓMEZ suspendido: 3 días de trabajo pasan a SUSP \(y 1 día que ya libraba\)/)).toBeVisible()
    await expect(page.getByText(/No se han tocado: .*\(Vacaciones\)/)).toBeVisible()
    const fila = page.getByTestId('suspension')
    await expect(fila.getByText('Empieza más adelante')).toBeVisible()
    await fila.getByRole('button', { name: 'Levantar' }).click()
    await fila.getByRole('button', { name: 'Sí, levantar' }).click()
    await expect(page.getByText('Suspensión levantada: 4 días vuelven a como estaban en el cuadrante.')).toBeVisible()
    expect(levantadas).toEqual(['s1'])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el conductor lo ve en su portal, no puede auditar y sus turnos dicen «Suspendido»', async ({ page }) => {
    const fallos = vigilar(page)
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'PEPE GÓMEZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'PEPE GÓMEZ', center: 'NORTE' }))
    }, token)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/shifts\/mine/, json({ shifts: [{ date: dia(0), type: 'libre', cod: 'SUSP' }, { date: dia(1), type: 'libre', cod: 'SUSP' }],
      sin_ver: [], requests: [], suspension: { desde: dia(0), hasta: dia(1) } }))
    await page.route(/\/api\/vehicles\/portal/, json({ vehicles: [], puede_auditar: false, motivo: 'suspendido' }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status').filter({ hasText: 'estás suspendido' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Hoy no trabajas')).toBeVisible()
    await expect(page.getByText('En el cuadrante de hoy no tienes furgoneta asignada', { exact: false })).toHaveCount(0)
    await page.getByRole('button', { name: /Mis turnos/ }).click()
    await expect(page.getByText('Suspendido').first()).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* LA TIENDA PÚBLICA (03-10-2026, el anuncio de FDs): la marca y no «Tienda» +
   la plataforma, la foto de cada prenda —antes era una lista de nombres—, el
   10 % de primera compra y el correo, que viaja al comprar. Una prenda sin
   límite de unidades se puede comprar (salía «Agotado» y «quedan null»). */
test.describe('Tienda pública', () => {
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

  test('la marca, las fotos y el 10 %, y el correo viaja al comprar', async ({ page }) => {
    const fallos = vigilar(page)
    // El aviso de cookies va fijo abajo y en el móvil tapa el primer «Comprar»:
    // quien llega de verdad lo cierra antes, como en el resto de pruebas.
    await page.addInitScript(() => localStorage.setItem('cookie_consent', '1'))
    await simularApi(page, 'vacio')
    await page.route(/\/api\/tienda\/publico\/tok$/, json({
      abierta: true, pasarela: 'stripe', nombre: 'FDs', descuento_pct: 0.1, envio_fuera: 15,
      prendas: [
        { id: 'g1', nombre: 'Gorra FDs', tipo: 'gorra', color: 'negro', tallas: ['U'], precio: 79,
          recargo_talla: 0, tallas_grandes: ['XXL'], quedan: 20, foto_ver: 'v1' },
        { id: 's1', nombre: 'Sudadera FDs', tipo: 'sudadera', color: 'negro', tallas: ['M', 'L'], precio: 129,
          recargo_talla: 3, tallas_grandes: ['XXL'], quedan: null, foto_ver: null },
      ] }))
    await page.route(/\/api\/tienda\/publico\/tok\/foto\/g1/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    const compras = []
    await page.route(/\/api\/tienda\/publico\/tok\/comprar/, (route) => {
      compras.push(route.request().postDataJSON())
      return json({ url: '/t/tok?pago=ok&ref=W-1', ref: 'W-1', descuento_pct: 0.1 })(route)
    })
    await page.goto('/t/tok', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'FDs' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('-10 % en tu primera compra.')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Gorra FDs' })).toBeVisible()
    // Las dos se pueden comprar: la de unidades sin límite no sale agotada.
    await expect(page.getByRole('button', { name: 'Comprar' })).toHaveCount(2)
    await expect(page.getByText(/quedan null/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Comprar' }).first().click()
    // Un correo mal escrito se dice y no se manda nada.
    await page.getByLabel(/Tu correo/).fill('ana@')
    await page.getByRole('button', { name: 'Ir a pagar' }).click()
    await expect(page.getByText('Ese correo no parece correcto. Revísalo o déjalo en blanco.')).toBeVisible()
    expect(compras).toHaveLength(0)
    await page.getByLabel(/Tu correo/).fill('ana@correo.es')
    // Envío fuera de España: suma el suplemento que dice el servidor y avisa
    // de la aduana (el anuncio va a todo el mundo).
    await expect(page.getByText('79,00 €', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Fuera de España/ }).click()
    await expect(page.getByText('94,00 €', { exact: true })).toBeVisible()
    await expect(page.getByText(/la aduana de tu país puede cobrarte/)).toBeVisible()
    await page.getByRole('button', { name: 'Ir a pagar' }).click()
    await expect(page.getByText('¡Pedido hecho!')).toBeVisible()
    expect(compras).toEqual([{ prenda: 'g1', talla: 'U', cantidad: 1, envio: 'fuera', email: 'ana@correo.es' }])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
  /* La tarjeta de UNA prenda en el anuncio en secuencia lleva ?prenda=: se
     abre ya elegida, sin pasar por el catálogo. */
  test('?prenda= abre esa prenda directamente', async ({ page }) => {
    const fallos = vigilar(page)
    await page.addInitScript(() => localStorage.setItem('cookie_consent', '1'))
    await simularApi(page, 'vacio')
    await page.route(/\/api\/tienda\/publico\/tok$/, json({
      abierta: true, pasarela: 'stripe', nombre: 'FDs', descuento_pct: 0.1, envio_fuera: 15,
      prendas: [
        { id: 'g1', nombre: 'Gorra FDs', tipo: 'gorra', tallas: ['U'], precio: 79, recargo_talla: 0, tallas_grandes: [], quedan: 20 },
        { id: 's1', nombre: 'Sudadera FDs', tipo: 'sudadera', tallas: ['M', 'L'], precio: 129, recargo_talla: 3, tallas_grandes: ['XXL'], quedan: 15 },
      ] }))
    await page.goto('/t/tok?prenda=sudadera&utm_source=facebook', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Ir a pagar' })).toBeVisible({ timeout: 15000 })
    // La gorra sigue con su «Comprar»; la sudadera ya está abierta.
    await expect(page.getByRole('button', { name: 'Comprar' })).toHaveCount(1)
    await expect(page.getByText('129,00 €', { exact: true })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* CAMBIO DE CENTRO PROGRAMADO (30-09-2026, Fran Gil pasa a OGA5 el día 5):
   la ficha lo programa, la lista lo enseña y el servidor lo aplica ese día. */
test.describe('Cambio de centro programado', () => {
  test('se programa desde la ficha y se ve en la lista', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { centros: ['NORTE', 'SUR'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/drivers(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'd1', name: 'Fran Gil', center: 'NORTE', active: true, traslado: { centro: 'SUR', desde: '2026-10-05', por: 'Dani' } },
        { id: 'd2', name: 'Ana Pérez', center: 'NORTE', active: true },
      ]) }))
    let pedido = null
    await page.route(/\/api\/drivers\/d2\/traslado/, (route) => {
      pedido = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ aplicado: false, traslado: { ...pedido, por: 'Admin Test' } }) })
    })
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('→ SUR 05/10')).toBeVisible({ timeout: 15000 })
    await page.getByText('Ana Pérez').click()
    await page.getByRole('button', { name: 'Programar…' }).click()
    await page.getByLabel('Día del cambio').fill('2026-10-05')
    await page.getByRole('button', { name: 'Programar', exact: true }).click()
    await expect(page.getByText('Pasa a SUR el 05/10/2026')).toBeVisible()
    expect(pedido).toEqual({ centro: 'SUR', desde: '2026-10-05' })
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

  /* 06-10-2026: /planes vende colaboradores a 3 € y campaña a 0,30 €/día, y Pro promete
     exportar a Excel. La ficha tiene que poder marcarlo y la lista bajarse. */
  test('la ficha dice cómo se factura cada furgoneta y la lista se baja en Excel', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'lleno')
    let cuerpo = null
    await page.route('**/api/vehicles/*', (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback()
      cuerpo = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
    })
    await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('1234 ABC')).toBeVisible({ timeout: 15000 })

    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: /Excel/ }).click()
    expect((await descarga).suggestedFilename()).toMatch(/^furgonetas-\d{4}-\d{2}-\d{2}\.csv$/)

    await page.getByText('1234 ABC').first().click()
    await expect(page.getByText('Cómo se factura')).toBeVisible()
    await page.getByRole('button', { name: 'De colaborador' }).click()
    await expect.poll(() => cuerpo).toEqual({ alta: 'colaborador' })
    await expect(page.getByText('Subcontrata con su furgoneta: 3 € al mes, fuera del plan.')).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* REPARTO A DOMICILIO (03-10-2026): la oficina ve los pedidos con su
   conductor, y el conductor su ruta; la ubicación no se comparte sin leer
   antes el aviso. */
const PEDIDOS = {
  fecha: '2026-10-03', ve_datos: true, sin_ubicar: 0,
  base: { direccion: 'Almacén', lat: 43.36, lng: -8.41 },
  pedidos: [
    { id: 'p1', fecha: '2026-10-03', codigo: '8412345', cliente: 'Marta Ríos', telefono: '600111222',
      direccion: 'Avda. Montero Ríos 12, 15003', lat: 43.369, lng: -8.405, contenido: '3 cajas y agua',
      bultos: 4, escaneos: 2, conductor_id: 'd1', conductor_nombre: 'ANA PÉREZ', estado: 'pendiente', orden: 1, geo: 'ok' },
  ],
  conductores: [{ conductor_id: 'd1', nombre: 'ANA PÉREZ', total: 1, entregados: 0, fallidos: 0, pendientes: 1, bultos: 4, km: 1.2 }],
}

test.describe('Reparto', () => {
  test('la oficina ve el pedido con su conductor', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/reparto\/pedidos/, (r) => r.fulfill({ json: PEDIDOS }))
    await page.goto('/panel/reparto', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Marta Ríos')).toBeVisible()
    await expect(page.getByText('1/1 entregados').or(page.getByText('0/1 entregados'))).toBeVisible()
    await page.getByRole('button', { name: /Zonas y ajustes/ }).click()
    await expect(page.getByText('Cómo se protegen los datos')).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('el conductor ve su ruta y el aviso antes de compartir ubicación', async ({ page }) => {
    const fallos = vigilar(page)
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
    await page.addInitScript((t) => {
      localStorage.setItem('flota_driver_token', t)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
      activo: true, fecha: '2026-10-03', pedidos: PEDIDOS.pedidos, base: PEDIDOS.base,
      ia_tickets: true, jornada: { empezada: null, terminada: null }, aviso_aceptado: false } }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Mi ruta/ }).click()
    await expect(page.getByText('Marta Ríos')).toBeVisible()
    await expect(page.getByText('3 cajas y agua')).toBeVisible()
    await page.getByRole('button', { name: /Empezar jornada/ }).click()
    await expect(page.getByText('Antes de empezar: tu ubicación')).toBeVisible()
    expect(fallos).toEqual([])
  })
})

/* LA FOTO DEL TICKET SE LEE EN EL MÓVIL (03-10-2026): sin IA de Google, con
   el OCR servido desde /ocr/. Un ticket de mentira y se comprueba que la
   dirección, el código postal y el teléfono llegan al formulario. */
test('Reparto · el ticket se lee en el móvil sin mandarlo a nadie', async ({ page }) => {
  test.setTimeout(90000)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const alServidor = []
  await page.route(/\/api\/reparto\/ticket/, (r) => { alServidor.push(1); r.fulfill({ status: 500, json: {} }) })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, fecha: '2026-10-03', pedidos: [], base: null, ia_tickets: false,
    jornada: { empezada: null, terminada: null }, aviso_aceptado: true } }))
  await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Mi ruta/ }).click()
  await page.getByRole('button', { name: /Añadir un pedido sin código/ }).click()
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles('e2e/fixtures/ticket.png')
  await expect(page.getByPlaceholder('Dirección completa')).toHaveValue(/Juana de Vega 14/, { timeout: 60000 })
  await expect(page.getByPlaceholder('Dirección completa')).toHaveValue(/15004/)
  await expect(page.getByPlaceholder('Teléfono')).toHaveValue('981123456')
  await expect(page.getByRole('button', { name: 'Añadir a mi ruta' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Revisa lo leído del ticket/ }).check()
  await expect(page.getByRole('button', { name: 'Añadir a mi ruta' })).toBeEnabled()
  expect(alServidor).toEqual([])
})

/* NADA DE UNA EMPRESA EN OTRA (03-10-2026): un aviso que dejó guardado OTRA
   sesión en este navegador no puede salir al entrar con otra cuenta. Pasó en
   la demo con «Candidatos nuevos · OGA5». */
test('Sesión · los avisos de otra empresa no se ven', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sembrado')) return
    sessionStorage.setItem('sembrado', '1')
    localStorage.setItem('flota_huella', 'otra-empresa|otro-usuario')
    localStorage.setItem('ln_pending', JSON.stringify([{ key: 'x', icon: 'candidato', title: 'Candidatos nuevos · OGA5',
      body: 'de otra empresa', to: '/panel/empleo', ts: Date.now() }]))
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.goto('/panel/configuracion', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByText('Candidatos nuevos · OGA5')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('ln_pending'))).not.toContain('OGA5')
})

/* EL AUTÓNOMO: foto de la etiqueta -> dirección y teléfono -> en su ruta con
   llamar y WhatsApp, y sin nada de jornada ni ubicación para una oficina. */
test('Reparto · el autónomo mete un paquete con foto y le salen llamar y WhatsApp', async ({ page }) => {
  test.setTimeout(90000)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'demo-a-1', role: 'driver', name: 'Autónomo', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'demo-a-1', name: 'Autónomo (prueba)' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const guardados = []
  await page.route(/\/api\/reparto\/mis-pedidos/, async (r) => {
    const b = r.request().postDataJSON(); guardados.push(b)
    await r.fulfill({ json: { id: 'n1', ...b, estado: 'pendiente', bultos: 1 } })
  })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-03', base: null, ia_tickets: false, jornada: {}, aviso_aceptado: false,
    pedidos: guardados.map((g, i) => ({ id: `n${i}`, estado: 'pendiente', bultos: 1, orden: i + 1, eta: '10:42', ...g })) } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Empezar jornada')).toHaveCount(0)
  await page.locator('label', { hasText: 'Foto etiqueta' }).locator('input[type=file]').setInputFiles('e2e/fixtures/ticket.png')
  await expect(page.getByPlaceholder('Teléfono')).toHaveValue('981123456', { timeout: 60000 })
  // Un fijo: llamar sí, WhatsApp no. Se cambia a un móvil para ver los dos.
  await page.getByPlaceholder('Teléfono').fill('600 11 22 33')
  await page.getByRole('checkbox', { name: /Revisa lo leído del ticket/ }).check() // El OCR no debe poder guardar una dirección sin revisión explícita.
  await page.getByRole('button', { name: 'Añadir a mi ruta' }).click()
  await expect(page.getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:600 11 22 33')
  await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /wa\.me\/34600112233/)
  await expect(page.getByText('≈ 10:42')).toBeVisible()
})

/* CADA EMPRESA, SU PANEL (03-10-2026): un súper no ve la portada de flota ni
   los cierres de turno; ve su reparto, «Tiendas» y «Repartidores». */
test('Sector · un súper ve el panel de reparto, no el de paquetería', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    status: 'active', plan: 'completo', sector: 'supermercado',
    modulos: ['dashboard', 'reparto', 'vehiculos', 'conductores', 'configuracion'] } }))
  await page.route(/\/api\/reparto\/pedidos/, (r) => r.fulfill({ json: PEDIDOS }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'El reparto de hoy' })).toBeVisible()
  await expect(page.getByText('Pedidos hoy')).toBeVisible()
  await page.goto('/panel/configuracion', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Tiendas', { exact: true })).toBeVisible()
  await expect(page.getByText('Cierre del turno de mañana')).toHaveCount(0)
  await expect(page.getByPlaceholder('Nueva tienda (ej. Centro)')).toBeVisible()
  expect(fallos).toEqual([])
})

/* EL CLIENTE SIGUE SU PEDIDO: estado, hora y paradas antes; nada personal. */
test('Reparto · la página de seguimiento del cliente', async ({ page }) => {
  const fallos = vigilar(page)
  await simularApi(page, 'vacio')   // la analítica y la versión también van a la API
  await page.route(/\/api\/seguimiento\//, (r) => r.fulfill({ json: {
    empresa: 'Supermercado de prueba', estado: 'pendiente', eta: '10:42', paradas_antes: 2, franja: ['10:00', '12:00'], tipo: 'entrega' } }))
  await page.goto('/s/abcdefghijklmnopqrstuv', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Llegada aproximada')).toBeVisible()
  await expect(page.getByText('10:42')).toBeVisible()
  await expect(page.getByText('Quedan 2 paradas antes de la tuya.')).toBeVisible()
  expect(fallos).toEqual([])
})

/* COBRO A LA ENTREGA: con importe, «Entregado» pide cómo ha pagado. */
test('Reparto · al entregar un pedido a cobrar se elige cómo pagó', async ({ page }) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const enviados = []
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => { enviados.push(r.request().postDataJSON()); await r.fulfill({ json: {} }) })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Súper', fecha: '2026-10-03', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    pedidos: [{ id: 'p1', cliente: 'Cliente 1', direccion: 'Rúa Real 5', telefono: '600111222', estado: 'pendiente',
      bultos: 1, orden: 1, eta: '10:42', cobrar: 23.5, seguimiento: 'tok123tok123tok123' }] } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('COBRAR 23,50 €')).toBeVisible()
  await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /s%2Ftok123tok123tok123/)
  await page.getByRole('button', { name: 'Entregado', exact: true }).click()
  await expect(page.getByText('¿Cómo ha pagado?')).toBeVisible()
  await page.getByRole('button', { name: 'Bizum' }).click()
  // Tras el cobro, la prueba de entrega (opcional); aquí sin foto.
  await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect.poll(() => enviados.length).toBe(1)
  expect(enviados[0]).toMatchObject({ estado: 'entregado', metodo: 'bizum' })
})

/* LA DEMO NO PISA TU SESIÓN (03-10-2026): Dani entró en la demo del reparto y
   «le desapareció todo» porque la demo había sustituido su sesión. Ahora la
   real se guarda y se vuelve con un botón. */
test('Sesión · entrar en la demo no te quita tu cuenta', async ({ page }) => {
  // Sesión real puesta UNA vez (no en cada carga, como hace entrarComoAdmin:
  // eso volvería a poner la real encima de la demo y no probaría nada).
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const tokenReal = `${b64({ alg: 'HS256' })}.${b64({ sub: 'a1', role: 'admin', name: 'Admin Test', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('sesion_puesta')) return
    sessionStorage.setItem('sesion_puesta', '1')
    localStorage.setItem('flota_token', t)
    localStorage.setItem('flota_admin', JSON.stringify({ id: 'a1', name: 'Admin Test', role: 'admin', centers: ['NORTE'] }))
    localStorage.setItem('panel_center', 'NORTE'); localStorage.setItem('flota_lang', 'es')
    localStorage.setItem('cookie_consent', '1'); localStorage.setItem('ayuda_vista_a1', '1')
  }, tokenReal)
  await simularApi(page, 'vacio')
  const _b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const demoTok = `${_b64({ alg: 'HS256' })}.${_b64({ sub: 'demo-oficina', role: 'admin', name: 'Oficina (prueba)', demo: true, db_name: 'dsp_demo_reparto', org_id: 'demo-reparto', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.route(/\/api\/auth\/demo-reparto/, (r) => r.fulfill({ json: { access_token: demoTok, role: 'admin', name: 'Oficina (prueba)', id: 'demo-oficina', demo: true, centers: ['TIENDA'] } }))
  await page.route(/\/api\/reparto\/pedidos/, (r) => r.fulfill({ json: PEDIDOS }))
  await page.goto('/prueba-reparto', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Entrar como la oficina/ }).click()
  await expect(page).toHaveURL(/\/panel\/reparto/)
  await expect(page.getByText(/Demo de reparto/)).toBeVisible()
  await page.getByRole('button', { name: 'Volver a mi cuenta' }).click()
  await expect(page).toHaveURL(/\/panel$/)
  expect(await page.evaluate(() => localStorage.getItem('flota_token'))).toBe(tokenReal)
  expect(await page.evaluate(() => localStorage.getItem('flota_sesion_previa'))).toBeNull()
})

test('Alta · la tarjeta de DSP de Amazon y la de autónomo están', async ({ page }) => {
  await page.goto('/registro', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /DSP de Amazon/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Repartir yo mismo/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mensajería y paquetería/ })).toBeVisible()
  await page.getByRole('button', { name: /DSP de Amazon/ }).click()
  await expect(page).toHaveURL(/sector=dsp_amazon/)
})

/* PRUEBA DE ENTREGA: al entregar sin cobro se ofrece la foto; «sin foto»
   manda la nota; en la oficina la foto se pide una a una. */
test('Reparto · prueba de entrega con nota y la oficina ve la foto', async ({ page }) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const enviados = []
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => { enviados.push(r.request().postDataJSON()); await r.fulfill({ json: {} }) })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, fecha: '2026-10-03', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    pedidos: [{ id: 'p1', cliente: 'Cliente 1', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1 }] } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Entregado', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible()
  await page.getByPlaceholder(/Nota \(opcional\)/).fill('En el buzón')
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect.poll(() => enviados.length).toBe(1)
  expect(enviados[0]).toMatchObject({ estado: 'entregado', nota: 'En el buzón' })
})

/* EL AUTÓNOMO NO ELIGE PLAN: 7 días gratis y 9,99 €/mes fijos, sin «sedes». */
test('Alta · quien reparte solo va directo a su plan: 7 días, 9,99 €, tres campos', async ({ page }) => {
  await page.goto('/registro', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Repartir yo mismo/ }).click()
  await expect(page).toHaveURL(/plan=autonomo/)
  // Lo primero que ve es que es gratis; el precio, solo como «sin tope» (10-10-2026).
  // Promoción (10-10-2026): gratis y sin límite hasta el 31 de diciembre; después, 15 paradas o 9,99 €.
  await expect(page.getByText('Gratis y sin límite hasta el 31 de diciembre · sin tarjeta')).toBeVisible()
  await expect(page.getByText(/Después, gratis hasta 15 paradas al día, o sin tope por 9,99 €\/mes/)).toBeVisible()
  await expect(page.getByText('Plan elegido')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cambiar' })).toHaveCount(0)
  await expect(page.getByText('Tus sedes')).toHaveCount(0)
  await expect(page.getByText('La URL de tu empresa')).toHaveCount(0)
  await expect(page.getByPlaceholder('Pepe')).toBeVisible()
  await expect(page.getByText('Entrarás con tu correo y esta contraseña.')).toBeVisible()
})

/* QUIEN REPARTE SOLO tiene su app (/ruta), no el panel: Hoy, Historial,
   Ajustes y Cuenta; si entra al panel se le trae aquí. */
test('App · quien reparte solo ve su app y no el panel de empresa', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'trial', days_left: 6, plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-04', pedidos: [], base: null, ia_tickets: false, jornada: {}, aviso_aceptado: false } }))
  await page.route(/\/api\/reparto\/estadisticas/, (r) => r.fulfill({ json: { total: 3, entregados: 2, tasa_entrega: 67, por_dia: [{ fecha: '2026-10-03', total: 3, entregados: 2, fallidos: 1 }] } }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await expect(page.getByRole('button', { name: /Cargar paquetes/ })).toBeVisible()
  await expect(page.getByText('Vehículos')).toHaveCount(0)
  await expect(page.getByText('Empezar jornada')).toHaveCount(0)
  await page.getByRole('button', { name: 'Historial' }).click()
  await expect(page.getByText(/3 paradas, 2 entregadas/)).toBeVisible()
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByText('Desde dónde sales')).toBeVisible()
  await expect(page.getByText('Zonas', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText(/Quedan 6 días: hasta el/)).toBeVisible()
  expect(fallos).toEqual([])
})

/* EL TRADUCTOR DEL NAVEGADOR NO TUMBA LA APP (11-10-2026): como hace Chrome al traducir, se cambia un texto
   de React por <font> y luego React lo quita; sin la defensa de main.jsx, «removeChild… not a child». */
test('Traductor · si el navegador traduce la página, React no revienta al pulsar «Entrar»', async ({ page }) => {
  const fallos = vigilar(page)
  // El servidor tarda y dice que no: lo que importa es el momento en que el botón pasa a «Entrando…».
  await page.route(/\/api\/auth\/login/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 400))
    return r.fulfill({ status: 401, json: { detail: 'Usuario o contraseña incorrectos' } })
  })
  await page.goto('/panel/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input:not([type=password]):not([type=checkbox]):not([type=hidden])').first().fill('prueba@ejemplo.test')
  await page.locator('input[type=password]').fill('clave-de-prueba')
  // Lo que hace Google Traductor: el texto «Entrar», cambiado por un <font> suyo.
  await page.evaluate(() => {
    const boton = [...document.querySelectorAll('button')].find((b) => /^\s*Entrar/.test(b.textContent))
    for (const t of [...boton.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())) {
      const f = document.createElement('font'); f.textContent = 'Log in'
      t.replaceWith(f)
    }
  })
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible()
  await expect(page.getByText('Algo ha ido mal')).toHaveCount(0)
  expect(fallos.filter((f) => !/401/.test(f))).toEqual([])
})

/* EMPLEO: SI EL CURRÍCULUM NO SE PUEDE SUBIR, LA CANDIDATURA ENTRA SIN ÉL (11-10-2026). Visto en los errores
   guardados: con un CV de la nube el envío moría sin respuesta siempre igual; una persona entró al quitarlo y
   otra se fue. Aquí el servidor «se cae» cada vez que llega con fichero, como pasaba en esos móviles. */
test('Empleo · si el currículum no se puede subir, la candidatura entra sin él y se avisa', async ({ page }) => {
  test.setTimeout(60000)
  const fallos = vigilar(page)
  let conCv = 0
  let sinCv = 0
  let datosEnviados = null
  await page.route(/\/api\/empleo\/publica\/fds\/repartidor/, async (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ json: { titulo: 'Repartidor/a de paquetería', ciudad: 'Vigo', descripcion: 'Reparto de paquetería.', preguntas: [] } })
    }
    const cuerpo = (r.request().postDataBuffer() || Buffer.from('')).toString('latin1')
    if (cuerpo.includes('name="cv"')) { conCv += 1; return r.abort('failed') }
    const json = cuerpo.match(/name="datos"\r\n\r\n([\s\S]*?)\r\n--/)
    if (json) datosEnviados = JSON.parse(json[1])
    sinCv += 1
    return r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/client-error/, (r) => r.fulfill({ json: { ok: true } }))
  await page.goto('/empleo/fds/repartidor', { waitUntil: 'domcontentloaded' })
  const cookies = page.getByRole('dialog', { name: 'Cookies' })
  if (await cookies.isVisible().catch(() => false)) await cookies.getByRole('button', { name: 'Solo necesarias' }).click()
  const cajas = page.locator('input[type=text], input[type=tel], input:not([type])')
  await cajas.nth(0).fill('Ana Pérez López')
  await page.locator('input[type=tel]').fill('612345678')
  await page.getByPlaceholder('12345678A o X1234567A').fill('12345678Z')
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: 'Sí', exact: true }).click()
  await page.getByRole('button', { name: 'Ya mismo' }).click()
  const novedades = page.getByRole('checkbox', { name: /Quiero recibir novedades y promociones de FDS/ })
  await expect(novedades).not.toBeChecked()
  await novedades.check()
  // El CV se lee al elegirlo: aparece su nombre.
  await page.locator('input[type=file]').setInputFiles({ name: 'cv-ana.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 cv de prueba') })
  await expect(page.getByText('cv-ana.pdf')).toBeVisible()
  await page.locator('input[type=checkbox]').first().check()
  await page.getByRole('button', { name: /Enviar candidatura/ }).click()
  await expect(page.getByText(/Escribe un correo válido para recibir novedades de FDS/)).toBeVisible()
  await page.getByRole('button', { name: 'Atrás' }).click()
  await page.locator('input[type=email]').fill('ana@example.com')
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /Enviar candidatura/ }).click()
  await expect(page.getByText('¡Listo! Ya la tenemos')).toBeVisible({ timeout: 45000 })
  await expect(page.getByText(/Tu currículum no se ha podido subir desde el móvil/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver Flota y crear mi enlace/ })).toHaveAttribute('href', /utm_source=empleo/)
  expect(datosEnviados).toMatchObject({ novedades_fds: true, email: 'ana@example.com' })
  expect(conCv).toBeGreaterThan(0)
  expect(sinCv).toBe(1)
  expect(fallos).toEqual([])
})

/* LA APP ARRANCA DIRECTA EN LA RUTA para quien reparte por su cuenta (11-10-2026): la primera vez pasa por el
   panel, que lo manda a /ruta; desde entonces /app va directo, sin cargar el panel. Otra cuenta no lo hereda. */
test('App · quien reparte solo abre la app directo en su ruta, sin pasar por el panel', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'trial', days_left: 6, plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-04', pedidos: [], base: null, ia_tickets: false, jornada: {}, aviso_aceptado: false } }))
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await expect(page.getByRole('button', { name: /Cargar paquetes/ })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('flota_inicio'))).toContain('/ruta')
  // Segunda apertura: /app → /ruta sin una sola visita a /panel.
  const pasos = []
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) pasos.push(new URL(f.url()).pathname) })
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await expect(page.getByRole('button', { name: /Cargar paquetes/ })).toBeVisible()
  expect(pasos.filter((p) => p.startsWith('/panel'))).toEqual([])
  // Lo apuntado es de ESA cuenta: con otro usuario en el mismo móvil, /app va al panel como siempre.
  await page.evaluate(() => localStorage.setItem('flota_inicio', JSON.stringify({ id: 'otro', ruta: '/ruta' })))
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'active', plan: 'pro', sector: 'mensajeria' } }))
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/panel/)
  expect(fallos).toEqual([])
})

/* LA APP ARRANCA EN «EMPEZAR» si no hay sesión; «Repartir yo mismo» lleva al alta. */
test('App · sin sesión arranca en Empezar: crear cuenta, entrar y probar a la vista; empresas plegado', async ({ page }) => {
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/empezar/)
  await expect(page.getByRole('heading', { name: 'Tu ruta de reparto, ordenada sola.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ya tengo cuenta/ })).toHaveAttribute('href', '/panel/login')
  // Crear cuenta es gratis: aquí no hay «probar sin cuenta» (sería una incongruencia).
  await expect(page.getByRole('button', { name: 'Probar sin cuenta' })).toHaveCount(0)
  // Lo de empresas, plegado hasta que se pide.
  await expect(page.getByRole('link', { name: /Gestiono una empresa/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Soy de una empresa' }).click()
  await expect(page.getByRole('link', { name: /Gestiono una empresa/ })).toHaveAttribute('href', '/panel/login')
  await expect(page.getByRole('link', { name: /Soy repartidor de una empresa/ })).toBeVisible()
  await page.getByRole('link', { name: /Crear mi cuenta gratis/ }).click()
  await expect(page).toHaveURL(/registro\?sector=autonomo/)
  await expect(page.getByText('Gratis y sin límite hasta el 31 de diciembre · sin tarjeta')).toBeVisible()
})

/* LA PORTADA (21-10-2026): primero la app de reparto gratis con todo lo que hace; detrás, la IA y la empresa. */
test('Portada · vende la app de reparto gratis primero, con la IA y la empresa detrás, y cambia de idioma', async ({ page }) => {
  const fallos = vigilar(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La app de reparto gratis')
  await expect(page).toHaveTitle(/La app de reparto gratis/)
  // El alta del repartidor, arriba y sin tarjeta; el precio sale de lib/precios.js.
  await expect(page.getByRole('link', { name: /Crear mi cuenta gratis/ }).first()).toHaveAttribute('href', '/registro?sector=autonomo&plan=autonomo')
  await expect(page.getByText(/^(Gratis y sin límite hasta el 31 de diciembre|Gratis hasta 15 paradas al día) · sin tarjeta$/).first()).toBeVisible()
  // Todas las funciones, la IA y la empresa con su panel (que dice que los datos son de ejemplo).
  await expect(page.getByRole('heading', { name: 'Todo lo que hace por ti, gratis' })).toBeVisible()
  await expect(page.getByText('Escanea un paquete y te dice en qué parada va')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'La IA que mira por tu flota' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '¿Tienes una empresa de reparto o una flota?' })).toBeVisible()
  await expect(page.getByText('Vista del panel · datos de ejemplo')).toBeVisible()
  await expect(page.getByRole('link', { name: /Crear cuenta de empresa/ })).toHaveAttribute('href', '/registro')
  // El tablón de empleo, en la cabecera al lado de Funciones (y en el pie).
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'Empleo', exact: true })).toHaveAttribute('href', '/empleo')
  await expect(page.getByRole('link', { name: 'Ofertas de empleo' })).toHaveAttribute('href', '/empleo')
  // El idioma que se elige aquí es el que luego tiene la app.
  await page.getByLabel('Idioma / Language').selectOption('en')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The free delivery app')
  await expect(page.getByRole('heading', { name: 'Everything it does for you, free' })).toBeVisible()
  expect(fallos).toEqual([])
})

test('Planes · el repartidor sale aparte con su precio fijo aunque el servidor no lo mande', async ({ page }) => {
  await page.route(/\/api\/billing\/planes/, (r) => r.fulfill({ json: { planes: [
    { clave: 'operacion', nombre: 'Esencial', para: 'Una delegación', por_vehiculo: 5, minimo_vehiculos: 10 }] } }))
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('¿Repartes tú solo?')).toBeVisible()
  await expect(page.getByText(/9,99€ al mes/)).toBeVisible()
})

/* PRECIOS DEL 06-10-2026 (docs/PRECIOS.md): Esencial, Pro y Empresa, descuento por volumen
   y complementos. 150 vehículos en Pro = 9 € − 15 % = 7,65 € → 1.147,50 € al mes. */
test('Planes · con 150 vehículos, Pro sale con el −15 % por volumen y hay complementos', async ({ page }) => {
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Pro', { exact: true })).toBeVisible()
  await expect(page.getByText('Esencial', { exact: true })).toBeVisible()
  await page.getByLabel('Número de vehículos').fill('150')
  await expect(page.getByText('−15 % por volumen')).toBeVisible()
  await expect(page.getByText('1147,50€').first()).toBeVisible()          // en español, 4 cifras van sin punto
  await expect(page.getByText('7,65€').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Complementos' })).toBeVisible()
  await expect(page.getByText('Vehículos de colaboradores')).toBeVisible()
})

/* PLAN REPARTO (06-10-2026): súper y distribución pagan por repartidor activo (12 €, mínimo 3),
   con las furgonetas incluidas. En su alta no sale Esencial (mínimo 10 furgonetas). */
test('Planes · Reparto se cobra por repartidor y el alta del súper lo propone con Pro, sin Esencial', async ({ page }) => {
  await page.goto('/planes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Plan Reparto: por repartidor/ })).toBeVisible()
  await page.getByLabel('Número de repartidores').fill('2')
  await expect(page.getByText('36€', { exact: true })).toBeVisible()          // mínimo 3 × 12 €
  await page.getByLabel('Número de repartidores').fill('5')
  await expect(page.getByText('60€', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Empezar 14 días gratis →' }).last().click()
  await expect(page).toHaveURL(/registro\?sector=supermercado&plan=reparto/)
  await expect(page.getByText('Plan elegido')).toBeVisible()
  await expect(page.getByText(/60€\/mes · con 5 repartidores activos/)).toBeVisible()

  // Entrando por el alta, el súper elige entre Reparto (destacado) y Pro.
  await page.goto('/registro?sector=supermercado', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Empezar con Reparto →' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar con Pro →' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar con Esencial →' })).toHaveCount(0)
  await expect(page.getByText(/furgonetas incluidas/).first()).toBeVisible()

  // Una DSP o una mensajería sigue viendo Esencial y Pro, sin Reparto.
  await page.goto('/registro?sector=mensajeria', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Empezar con Esencial →' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar con Reparto →' })).toHaveCount(0)
})

/* LA CUENTA DEL REPARTIDOR (06-10-2026): con qué entra, cambiar el correo (el usuario cambia con
   él y pide la contraseña) y la contraseña. Y desde «entrar como» la plataforma solo mira:
   franja arriba y sin botones de tarjeta, plan ni contraseña (antes daban «Solo la propia empresa»). */
test('Cuenta del repartidor · ve con qué entra, cambia correo y contraseña; «entrar como» solo mira', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    status: 'trial', required: false, days_left: 5, plan: 'autonomo', sector: 'autonomo', suscrito: true,
    pago_proveedor: 'stripe', stripe_status: 'trialing', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.route(/\/api\/billing\/config/, (r) => r.fulfill({ json: { provider: 'stripe', ready: true, planes: ['autonomo'], checkout: {} } }))
  await page.route(/\/api\/auth\/me$/, (r) => r.fulfill({ json: { id: 'a1', role: 'admin', name: 'Admin Test', username: 'dani@correo.es', email: 'dani@correo.es' } }))
  const correos = []
  const claves = []
  await page.route(/\/api\/auth\/my-email/, async (r) => {
    correos.push(r.request().postDataJSON())
    await r.fulfill({ json: { success: true, email: 'nuevo@correo.es', username: 'nuevo@correo.es' } })
  })
  await page.route(/\/api\/auth\/change-my-password/, async (r) => {
    claves.push(r.request().postDataJSON())
    await r.fulfill({ json: { success: true } })
  })

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  const acceso = page.getByRole('region', { name: 'Tu acceso' })
  await expect(acceso.getByText('dani@correo.es')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tarjeta, facturas y cancelar/ })).toBeVisible()

  // Correo: entra con él, así que pide la contraseña y el usuario cambia con él.
  await acceso.getByRole('button', { name: 'Cambiar correo' }).click()
  await acceso.getByLabel('Nuevo correo').fill('nuevo@correo.es')
  await acceso.getByRole('button', { name: 'Guardar' }).click()
  await expect(acceso.getByText('Escribe tu contraseña actual.')).toBeVisible()
  await acceso.getByLabel('Contraseña actual').fill('clave-buena')
  await acceso.getByRole('button', { name: 'Guardar' }).click()
  await expect(acceso.getByText('nuevo@correo.es')).toBeVisible()
  expect(correos).toEqual([{ email: 'nuevo@correo.es', tambien_usuario: true, password: 'clave-buena' }])

  // Contraseña: mínimo 8 y luego al servidor.
  await acceso.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await acceso.getByLabel('Contraseña actual').fill('clave-buena')
  await acceso.getByLabel('Nueva contraseña').fill('corta')
  await acceso.getByRole('button', { name: 'Guardar' }).click()
  await expect(acceso.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible()
  await acceso.getByLabel('Nueva contraseña').fill('una-clave-larga')
  await acceso.getByRole('button', { name: 'Guardar' }).click()
  await expect(acceso.getByRole('button', { name: 'Cambiar contraseña' })).toBeVisible()
  expect(claves).toEqual([{ current_password: 'clave-buena', new_password: 'una-clave-larga' }])

  // «Entrar como» desde la plataforma: franja con «Volver a mi cuenta» y nada que pueda fallar.
  await page.addInitScript(() => localStorage.setItem('flota_token_super', 'token-de-la-plataforma'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Estás viendo la cuenta de Admin Test como plataforma/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volver a mi cuenta' })).toBeVisible()
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Tu acceso' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tarjeta, facturas y cancelar/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cambiar contraseña' })).toHaveCount(0)
})

/* SUSCRIBIRSE CON STRIPE desde el aviso de prueba: el servidor crea la sesión
   y el navegador va a su URL; al volver con ?pago=ok se espera al webhook. */
test('Suscripción · el botón de pagar va a Stripe y la vuelta espera la activación', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'trial', required: false, days_left: 5, plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.route(/\/api\/billing\/config/, (r) => r.fulfill({ json: { provider: 'stripe', ready: true, planes: ['autonomo'], checkout: {} } }))
  const pedidos = []
  await page.route(/\/api\/billing\/stripe\/suscripcion/, async (r) => {
    pedidos.push(r.request().postDataJSON())
    await r.fulfill({ json: { url: 'http://localhost:4173/ruta?pago=ok', id: 'cs_test' } })
  })
  // Quien reparte solo entra al panel y se le lleva a su app; se suscribe desde «Cuenta».
  await page.goto('/panel/reparto', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText(/Quedan 5 días/)).toBeVisible()
  await page.getByRole('button', { name: 'Suscribirme' }).click()
  await expect(page).toHaveURL(/pago=ok|\/ruta$/)
  expect(pedidos[0]).toMatchObject({ plan: 'autonomo' })
  await expect(page.getByText('Tarjeta añadida. Activando tu cuenta…')).toBeVisible()
})

/* FDS EN IPHONE (23-10-2026): la guía con los pasos de Safari, enlazada desde Empezar (solo en iPhone),
   la portada, /repartidores y la tarjeta de instalar. Nada de App Store. */
test.describe('iPhone · la guía de instalar y usar la app', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' })
  test('Empezar enlaza a /iphone y la guía tiene los 4 pasos de Safari y lo que no funciona', async ({ page }) => {
    const fallos = vigilar(page)
    await page.goto('/empezar', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: /iPhone\? Así se instala y se usa/ }).click()
    await expect(page).toHaveURL(/\/iphone/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('iPhone')
    await expect(page.getByText('Pulsa Compartir')).toBeVisible()
    await expect(page.getByText('Elige «Añadir a pantalla de inicio»')).toBeVisible()
    await expect(page.getByText(/App Store/)).toBeVisible()
    await expect(page.getByText('Dictar direcciones con la voz: en iPhone se escriben')).toBeVisible()
    await expect(page.getByRole('link', { name: /Crear mi cuenta gratis/ })).toHaveAttribute('href', '/registro?sector=autonomo&plan=autonomo')
    // En iPhone no se ofrece «Android».
    await expect(page.getByText('¿Tienes Android?')).toHaveCount(0)
    expect(fallos).toEqual([])
  })
  test('en Instagram avisa de salir al navegador', async ({ page, browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0' })
    const p = await ctx.newPage()
    await p.goto('/iphone', { waitUntil: 'domcontentloaded' })
    await expect(p.getByText(/navegador de Instagram/)).toBeVisible()
    await ctx.close()
    await page.close()
  })
})

/* LO QUE PIDIERON QUIENES PROBARON LA APP EN GOOGLE PLAY (20-10-2026): ver la contraseña al
   escribirla y no cerrar sesión de un toque sin querer. */
test('Comentarios de Play · el login deja ver la contraseña y cerrar sesión pide confirmación', async ({ page }) => {
  await page.goto('/panel/login', { waitUntil: 'domcontentloaded' })
  const clave = page.locator('input[type=password]')
  await clave.fill('mi-clave')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  expect(await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => i.value === 'mi-clave' && i.type === 'text'))).toBe(true)
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(page.locator('input[type=password]')).toHaveCount(1)

  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'active', required: false, plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.goto('/panel/reparto', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByText('¿Cerrar sesión en este móvil?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page).toHaveURL(/\/ruta/)
  await expect(page.getByText('¿Cerrar sesión en este móvil?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByRole('button', { name: 'Sí, cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/empezar/)
})

/* DENTRO DE LA APP DE PLAY STORE no se enseña el botón de pagar mientras la app
   no esté en el programa de ofertas externas de Google. */
test('Suscripción · dentro de la app no sale el botón de pagar sin el programa de Google', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.addInitScript(() => sessionStorage.setItem('flota_app', '1'))
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { status: 'trial', required: false, days_left: 5, plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'] } }))
  await page.route(/\/api\/billing\/config/, (r) => r.fulfill({ json: { provider: 'stripe', ready: true, pago_en_app: false, planes: ['autonomo'], checkout: {} } }))
  await page.goto('/panel/reparto', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText(/Quedan 5 días/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Suscribirme|Añadir tarjeta|Comprar regalo/ })).toHaveCount(0)
  await expect(page.getByLabel('Código de regalo')).toBeVisible()
})

/* LA APP DE RUTA, COMO CIRCUIT O FLEX (04-10-2026): siguiente parada
   destacada, progreso del día, dónde va cada paquete en la furgoneta, Waze o
   Google Maps, buscar, mapa, cambiar el orden a mano y el resumen al acabar. */
/* COMO CIRCUIT/SPOKE (10-10-2026): al entregar, dónde lo deja de un toque, quién lo recoge y su firma;
   con un paquete en la mano, el escáner dice su parada en grande; y la fachada en Street View. */
test('Reparto · entregar con «dónde lo dejas», firma, y el buscador de paquetes', async ({ page }) => {
  const fallos = vigilar(page)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  const pedidos = [
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.37, lng: -8.40, codigo: 'ABC123' },
    { id: 'p2', cliente: 'Farmacia Sol', direccion: 'Avda Montero Ríos 12', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:20', lat: 43.36, lng: -8.41 },
  ]
  const estados = []
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => { estados.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  await page.route(/\/api\/reparto\/escanear/, (r) => r.fulfill({ json: { encontrado: true, pedido: { ...pedidos[1], escaneos: 1 } } }))
  await page.route(/\/api\/reparto\/pedidos\/p1\/fachada/, (r) => r.fulfill({ json: { lat: 43.3697, lng: -8.4, rumbo: 12 } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null, km: null, minutos: null } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Súper', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:40', minutos: 40, km: 9.5, trafico: true }, pedidos } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  const primera = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  // Ver la puerta: desde la calle y mirando a la casa (rumbo que da el servidor).
  await expect(primera.getByRole('link', { name: 'Ver la puerta' })).toHaveAttribute('href', /map_action=pano&viewpoint=43\.3697,-8\.4&heading=12/)

  // Entregar: al vecino, quién lo recoge y firma con el dedo.
  await primera.getByRole('button', { name: 'Entregado', exact: true }).click()
  await page.getByRole('button', { name: 'Al vecino' }).click()
  await page.getByPlaceholder('¿Quién lo recoge? (opcional)').fill('Marta (2ºB)')
  await page.getByRole('button', { name: 'Que firme en la pantalla' }).click()
  const lienzo = page.getByLabel('Firma aquí con el dedo').first()
  await expect(page.getByRole('button', { name: 'Listo' })).toBeDisabled()
  const caja = await lienzo.boundingBox()
  await page.mouse.move(caja.x + 30, caja.y + 40)
  await page.mouse.down()
  await page.mouse.move(caja.x + 120, caja.y + 90, { steps: 8 })
  await page.mouse.move(caja.x + 220, caja.y + 30, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('button', { name: 'Firmado · repetir' })).toBeVisible()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect.poll(() => estados.length).toBe(1)
  expect(estados[0]).toMatchObject({ estado: 'entregado', donde: 'vecino', recibe: 'Marta (2ºB)' })
  expect(estados[0].firma).toMatch(/^data:image\/png;base64,/)

  // El buscador de paquetes: escribir el código de uno que ya está en la ruta dice su parada en grande.
  await page.getByRole('button', { name: /Más formas de añadir/ }).click()
  await page.getByPlaceholder('o escribe el código').fill('XYZ')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const hoja = page.getByRole('dialog', { name: 'Este paquete va en la parada' })
  await expect(hoja.getByText('Farmacia Sol')).toBeVisible()
  await expect(hoja.getByText('2', { exact: true })).toBeVisible()
  await expect(hoja.getByRole('button', { name: 'Escanear el siguiente' })).toBeVisible()
  expect(fallos).toEqual([])
})

/* 10-10-2026, lo que pidió Dani: el micrófono (bloqueado por la cabecera; ahora, si no hay dictado, el del
   teclado), un código que ya trae la dirección, y que un no entregado se pueda reintentar o entregar. */
async function rutaDeAna(page, pedidos, extra = {}) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Súper', fecha: '2026-10-04', jornada: {}, aviso_aceptado: true, ruta: { fin: '10:40' }, pedidos, ...extra } }))
}

/* 25-10-2026: lo que quedó de otros días se trae a hoy si lo pide, de noche la ruta dice a qué hora sale, y el récord
   y lo que lleva hecho salen de sus datos (el servidor cuenta; aquí solo se pinta). */
const hechaHoy = (i) => ({ id: `h${i}`, cliente: `Cliente ${i}`, direccion: `Calle ${i}`, estado: 'entregado', bultos: 1, orden: i, cerrado_en: '2026-10-04T10:00:00Z' })

test('Reparto · lo de otros días se trae a hoy, de noche dice a qué hora sale y celebra el récord de verdad', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidos = [...Array.from({ length: 12 }, (_, i) => hechaHoy(i + 1)),
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 13, eta: '09:20', lat: 43.37, lng: -8.40 }]
  await rutaDeAna(page, pedidos, { autonomo: true, previas: 3,
    ruta: { fin: '09:40', minutos: 40, km: 9.5, trafico: true, programada: true, salida: '09:00' } })
  let traidas = 0
  await page.route(/\/api\/reparto\/mi-ruta\/traer-previas/, (r) => { traidas += 1; return r.fulfill({ json: { traidas: 3 } }) })
  await page.route(/\/api\/reparto\/mis-marcas/, (r) => r.fulfill({ json: { total: 300, hoy: 12, dias: 9, semana: 3, mejor: 11, mejor_fecha: '2026-10-01', record_hoy: true } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Sales a las 09:00 ·')).toBeVisible()
  await expect(page.getByTestId('record')).toHaveText('🏆 ¡Récord de entregas!')
  const previas = page.getByTestId('previas')
  await expect(previas).toContainText('Tienes 3 paradas sin entregar de días anteriores.')
  await previas.getByRole('button', { name: 'Pasarlas a hoy' }).click()
  await expect.poll(() => traidas).toBe(1)
  await expect(page.getByText('3 paradas pasadas a hoy. Pulsa «Ordenar ruta» para ponerlas en su sitio.')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Reparto · «Ahora no» a lo de otros días no mueve nada; con pocas entregas no hay récord', async ({ page }) => {
  const pedidos = [...Array.from({ length: 3 }, (_, i) => hechaHoy(i + 1)),
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 4, eta: '17:20', lat: 43.37, lng: -8.40 }]
  await rutaDeAna(page, pedidos, { autonomo: true, previas: 1, ruta: { fin: '17:40', minutos: 20, km: 3, trafico: true, salida: '17:00' } })
  let traidas = 0
  await page.route(/\/api\/reparto\/mi-ruta\/traer-previas/, (r) => { traidas += 1; return r.fulfill({ json: { traidas: 1 } }) })
  await page.route(/\/api\/reparto\/mis-marcas/, (r) => r.fulfill({ json: { total: 50, hoy: 3, dias: 4, semana: 2, mejor: 30, mejor_fecha: '2026-10-01', record_hoy: false } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('previas')).toContainText('Tienes 1 parada sin entregar de otro día.')
  await page.getByTestId('previas').getByRole('button', { name: 'Ahora no' }).click()
  await expect(page.getByTestId('previas')).toHaveCount(0)
  expect(traidas).toBe(0)
  await expect(page.getByText('Sales a las')).toHaveCount(0)            // de día sale «ahora»: no se dice
  await expect(page.getByTestId('record')).toHaveCount(0)
  await expect(page.getByText('Tu récord: 30')).toBeVisible()
})

test('Reparto · un consejo cuando viene a cuento: «Ordenar ahora» ordena y no vuelve a salir', async ({ page }) => {
  const fallos = vigilar(page)
  const pend = (i) => ({ id: `p${i}`, cliente: `Cliente ${i}`, direccion: `Calle ${i}`, estado: 'pendiente', bultos: 1, lat: 43.37, lng: -8.40 })
  await rutaDeAna(page, [pend(1), pend(2), pend(3)], { ruta: null })
  let ordenadas = 0
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, (r) => { ordenadas += 1; return r.fulfill({ json: { ordenados: 3, ruta: { fin: '10:40' } } }) })
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  const consejo = page.getByTestId('consejo')
  await expect(consejo).toContainText('Deja que la app ponga el orden')
  await consejo.getByRole('button', { name: 'Ordenar ahora' }).click()
  await expect.poll(() => ordenadas).toBe(1)
  await expect(page.getByTestId('consejo')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('3 por entregar')).toBeVisible()
  await expect(page.getByTestId('consejo')).toHaveCount(0)               // «Entendido» es para siempre
  expect(fallos).toEqual([])
})

test('Reparto · al escribir una dirección, primero las que ya conoce, y rellena cliente y teléfono', async ({ page }) => {
  const fallos = vigilar(page)
  await rutaDeAna(page, [], { autonomo: true, ruta: null })
  let pedido = ''
  await page.route(/\/api\/reparto\/mis-direcciones/, (r) => { pedido = new URL(r.request().url()).searchParams.get('q'); return r.fulfill({ json: { direcciones: [
    { direccion: 'Rúa Real 5, A Coruña', cp: '15003', localidad: 'A Coruña', lat: 43.37, lng: -8.39, cliente: 'Bar Pepe', telefono: '600111222', veces: 3, ultima: '2026-10-02' }] } }) })
  await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { features: [
    { geometry: { coordinates: [-8.39, 43.37] }, properties: { street: 'Rúa Real', housenumber: '5', postcode: '15003', city: 'A Coruña', countrycode: 'ES' } },
    { geometry: { coordinates: [-8.4, 43.36] }, properties: { street: 'Rúa Real', housenumber: '50', postcode: '15003', city: 'A Coruña', countrycode: 'ES' } }] } }))
  await page.route(/\/api\/reparto\/mis-marcas/, (r) => r.fulfill({ json: { total: 0, hoy: 0, dias: 0, semana: 0, mejor: 0, mejor_fecha: null, record_hoy: false } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Añadir un pedido sin código/ }).click()
  await page.getByRole('dialog').getByPlaceholder('Dirección completa').fill('real 5')
  const sugeridas = page.getByRole('dialog').getByRole('list', { name: 'Direcciones sugeridas' })
  await expect(sugeridas.getByText('Ya estuviste aquí · 3 veces · Bar Pepe')).toBeVisible()
  expect(pedido).toBe('real 5')
  await sugeridas.getByRole('button', { name: /Ya estuviste aquí/ }).click()
  const hoja = page.getByRole('dialog')
  await expect(hoja.getByPlaceholder('Cliente', { exact: true })).toHaveValue('Bar Pepe')
  await expect(hoja.getByPlaceholder('Teléfono', { exact: true })).toHaveValue('600111222')
  await expect(hoja.getByText('Sitio encontrado en el mapa')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Reparto · al terminar, el resumen dice su mejor día y cuántas lleva con la app', async ({ page }) => {
  await rutaDeAna(page, Array.from({ length: 6 }, (_, i) => hechaHoy(i + 1)), { autonomo: true })
  await page.route(/\/api\/reparto\/mis-marcas/, (r) => r.fulfill({ json: { total: 140, hoy: 6, dias: 5, semana: 2, mejor: 40, mejor_fecha: '2026-10-01', record_hoy: false } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  const m = page.getByTestId('marcas')
  await expect(m).toContainText('Tu mejor día: 40 entregas.')
  await expect(m).toContainText('Llevas 140 entregas con FDS.')
})

test('Reparto · sin dictado en el navegador, el micro lleva al del teclado; un código con dirección la rellena', async ({ page }) => {
  const fallos = vigilar(page)
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await rutaDeAna(page, [])
  await page.route(/\/api\/reparto\/escanear/, (r) => r.fulfill({ json: { encontrado: false, codigo: 'GLS123' } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  // Solo la calle (sin CP ni población): se abre la hoja para completarla. Con todo, entraría sola (25-10-2026).
  await page.getByPlaceholder('o escribe el código').fill('GLS123|Rúa Real 5|Marta|612345678')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await expect(hoja.getByPlaceholder('Dirección completa')).toHaveValue(/Rúa Real 5/)
  await hoja.getByRole('button', { name: 'Dictar la dirección' }).click()
  await expect(page.getByText('Toca la dirección y usa el micrófono de tu teclado 🎤 para dictarla.')).toBeVisible()
  await expect(hoja.getByPlaceholder('Dirección completa')).toBeFocused()
  expect(fallos).toEqual([])
})

test('Reparto · un no entregado se puede volver a intentar o dar por entregado después', async ({ page }) => {
  const fallos = vigilar(page)
  await rutaDeAna(page, [
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1, lat: 43.37, lng: -8.40 },
    { id: 'p2', cliente: 'Farmacia Sol', direccion: 'Avda Montero Ríos 12', estado: 'fallido', motivo: 'No había nadie', bultos: 1, orden: 2 },
  ])
  const estados = []
  await page.route(/\/api\/reparto\/pedidos\/p2\/estado/, async (r) => { estados.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('1 sin entregar')).toBeVisible()
  await page.getByRole('button', { name: 'Volver a intentarlo' }).click()
  await expect.poll(() => estados.length).toBe(1)
  expect(estados[0]).toMatchObject({ estado: 'pendiente', motivo: '' })
  expect(fallos).toEqual([])
})

test('Historial · cada día en su pantalla, con la prueba de entrega y «Pasar a hoy»', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6 })
  await page.route(/\/api\/reparto\/estadisticas/, (r) => r.fulfill({ json: { total: 3, entregados: 2, tasa_entrega: 67,
    por_dia: [{ fecha: '2026-10-08', total: 3, entregados: 2, fallidos: 1 }] } }))
  await page.route(/\/api\/reparto\/pedidos\?/, (r) => r.fulfill({ json: { fecha: '2026-10-08', pedidos: [
    { id: 'h1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'entregado', cerrado_en: '2026-10-08T08:15:00Z', entrega_donde: 'vecino', entrega_recibe: 'Marta', tiene_foto: true },
    { id: 'h2', cliente: 'Kiosko Luz', direccion: 'San Andrés 30', estado: 'entregado', cerrado_en: '2026-10-08T11:40:00Z' },
    { id: 'h3', cliente: 'Farmacia Sol', direccion: 'Avda Montero Ríos 12', estado: 'fallido', motivo: 'No había nadie' },
  ], conductores: [{ ruta: { km: 23.5 } }] } }))
  await page.route(/\/api\/reparto\/pedidos\/h1\/foto/, (r) => r.fulfill({ json: { foto: '', firma: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', donde: 'Al vecino', recibe: 'Marta', nota: '', cuando: '2026-10-08T08:15:00Z' } }))
  const movidos = []
  await page.route(/\/api\/reparto\/pedidos\/h3$/, async (r) => { movidos.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  await page.goto('/ruta?tab=historial', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /8 de octubre/ }).click()
  await expect(page.getByText('23.5 km')).toBeVisible()
  await expect(page.getByText('Al vecino')).toBeVisible()
  // La prueba de entrega con la firma.
  await page.getByRole('button', { name: /Bar Pepe/ }).click()
  await page.getByRole('button', { name: 'Ver prueba de entrega' }).click()
  await expect(page.getByRole('dialog', { name: 'Prueba de entrega' }).getByRole('img', { name: 'Firma' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Prueba de entrega' }).getByRole('button', { name: 'Cerrar' }).click()
  // El no entregado, a la ruta de hoy.
  await page.getByRole('button', { name: /Farmacia Sol/ }).click()
  await page.getByRole('button', { name: 'Pasar a hoy' }).click()
  await expect.poll(() => movidos.length).toBe(1)
  expect(movidos[0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(fallos).toEqual([])
})

test('Reparto · la ruta del repartidor: siguiente, furgoneta, Waze, orden a mano y resumen', async ({ page }) => {
  const fallos = vigilar(page)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  let pedidos = [
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.37, lng: -8.40 },
    { id: 'p2', cliente: 'Farmacia Sol', direccion: 'Avda Montero Ríos 12', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:20', lat: 43.36, lng: -8.41 },
    { id: 'p3', cliente: 'Kiosko Luz', direccion: 'Calle San Andrés 30', estado: 'entregado', bultos: 1, orden: 3, cobrado_importe: 12, cobrado_metodo: 'bizum', cerrado_en: '2026-10-04T08:00:00Z' },
  ]
  const editados = []
  const ordenes = []
  await page.route(/\/api\/reparto\/mis-pedidos\/p2\/editar/, async (r) => {
    const b = r.request().postDataJSON(); editados.push(b)
    pedidos = pedidos.map((p) => (p.id === 'p2' ? { ...p, ...b } : p))
    await r.fulfill({ json: { ok: true, ...b } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/orden/, async (r) => {
    const { ids } = r.request().postDataJSON(); ordenes.push(ids)
    pedidos = pedidos.map((p) => (ids.includes(p.id) ? { ...p, orden: ids.indexOf(p.id) + 1 } : p))
    await r.fulfill({ json: { ordenados: ids.length, ruta: { fin: '11:00', manual: true } } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: {
    linea: [[43.37, -8.40], [43.365, -8.405], [43.36, -8.41]], fuente: 'carreteras', km: 3.1, minutos: 9 } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Súper', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:40', minutos: 40, km: 9.5, trafico: true }, pedidos } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })

  // Progreso y siguiente parada.
  const cab = page.getByLabel('Progreso del día')
  await expect(cab.getByText('Quedan 2 paradas')).toBeVisible()
  await expect(cab.getByText('de 3')).toBeVisible()
  await expect(cab.getByText('Cobrado 12,00 €')).toBeVisible()
  await expect(page.getByText('Siguiente parada')).toBeVisible()
  const primera = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(primera.getByText('Bar Pepe')).toBeVisible()

  // Waze en vez de Google Maps, y se recuerda.
  // Por defecto guía la propia app (botón); con Google Maps o Waze, enlace a su app.
  await expect(primera.getByRole('button', { name: 'Ir' })).toBeVisible()
  await page.getByLabel('Navegador').selectOption('google')
  await expect(primera.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', /google\.com\/maps/)
  await page.getByLabel('Navegador').selectOption('waze')
  await expect(primera.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', 'https://waze.com/ul?ll=43.37,-8.4&navigate=yes')

  // Dónde va en la furgoneta.
  // Las demás van plegadas: se despliega al tocarla.
  await expect(page.getByRole('link', { name: 'Ir a Farmacia Sol' })).toBeVisible()
  await page.getByRole('button', { name: /Ver la parada 2: Farmacia Sol/ }).click()
  await page.locator('div.rounded-2xl', { hasText: 'Parada 2' }).getByRole('button', { name: /Dónde va en la furgoneta/ }).click()
  await page.getByRole('button', { name: 'Detrás · izq' }).click()
  await expect(page.getByText('En la furgoneta: Detrás · izq')).toBeVisible()
  expect(editados).toEqual([{ hueco: 'Detrás · izq' }])

  // Orden a mano: Farmacia primero.
  await page.getByRole('button', { name: 'A mano' }).click()
  await page.getByRole('button', { name: 'Subir Farmacia Sol' }).click()
  await page.getByRole('button', { name: 'Guardar este orden' }).click()
  await expect(page.getByText('Orden guardado. Con este orden acabas ≈ 11:00')).toBeVisible()
  expect(ordenes).toEqual([['p2', 'p1']])
  await expect(page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' }).getByText('Farmacia Sol')).toBeVisible()

  // Mapa con el recorrido por las calles y las próximas paradas en Google Maps.
  await page.getByRole('button', { name: 'Mapa' }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByText('Por las calles:')).toBeVisible()
  await expect(page.getByText('3,1 km')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Las próximas 2 paradas en Google Maps' }))
    .toHaveAttribute('href', /destination=43\.37,-8\.4&waypoints=43\.36%2C-8\.41/)
  await page.getByRole('button', { name: 'Lista' }).click()

  // Entregar enseña «Deshacer», y deshacer la devuelve a pendiente.
  const estados = []
  await page.route(/\/api\/reparto\/pedidos\/p2\/estado/, async (r) => {
    const b = r.request().postDataJSON(); estados.push(b.estado)
    pedidos = pedidos.map((p) => (p.id === 'p2' ? { ...p, estado: b.estado } : p))
    await r.fulfill({ json: {} })
  })
  await page.getByRole('button', { name: 'Entregado', exact: true }).click()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect(page.getByRole('status').getByText('Entregado · Farmacia Sol')).toBeVisible()
  await expect(page.getByRole('status').getByText('Siguiente: Bar Pepe ≈ 10:05')).toBeVisible()
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByText('Vuelve a tu ruta: Farmacia Sol')).toBeVisible()
  expect(estados).toEqual(['entregado', 'pendiente'])

  // Todo hecho: resumen del día con lo cobrado.
  pedidos = pedidos.map((p) => ({ ...p, estado: p.id === 'p1' ? 'fallido' : 'entregado', motivo: p.id === 'p1' ? 'No había nadie' : undefined }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  const resumen = page.getByLabel('Resumen del día')
  await expect(resumen.getByText('Ruta terminada')).toBeVisible()
  await expect(resumen.getByText('Bizum')).toBeVisible()
  await expect(resumen.getByText('12,00 €').first()).toBeVisible()
  await expect(resumen.getByText('Ruta planificada: 9.5 km.')).toBeVisible()
  expect(fallos).toEqual([])
})


/* LA GUÍA DENTRO DE LA APP: con el móvil moviéndose por las calles, la
   maniobra en grande, «Has llegado» al llegar, Entregado y a la siguiente. */
/* CASO ARTURO (06-10-2026): su única parada no se encontró en el mapa y no le salía «Empezar a
   navegar» sin decir por qué. Ahora la cabecera lo explica y lleva a corregir la dirección. */
test('Reparto · si ninguna parada está en el mapa, dice por qué no se navega y lleva a corregirla', async ({ page }) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ARTURO', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ARTURO' }))
    localStorage.setItem('cookie_consent', '1')
  }, token)
  await simularApi(page, 'vacio')
  let pedidos = [{ id: 'p1', cliente: 'Cliente', direccion: 'Rua inventada 99', estado: 'pendiente', bultos: 1, orden: 1, lat: null, lng: null, geo: 'no' }]
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Yo', fecha: '2026-10-06', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta: null, pedidos } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/No encontramos la dirección en el mapa/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar a navegar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Corregir la dirección' }).click()
  await expect(page.locator('input[value="Rua inventada 99"]')).toBeVisible()          // abre su ficha para corregirla
  // Mientras se está buscando no se da por perdida.
  pedidos = [{ ...pedidos[0], geo: 'pendiente' }]
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Queda 1 parada/)).toBeVisible()
  await expect(page.getByText(/No encontramos la dirección en el mapa/)).toHaveCount(0)
})

test('Reparto · navegar dentro de la app: maniobras, llegada, entregar y a la siguiente', async ({ page, context }) => {
  const fallos = vigilar(page)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
    localStorage.setItem('guia_voz', '0')
  }, token)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3665, longitude: -8.4065 })
  await simularApi(page, 'vacio')
  let pedidos = [
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Galera 10', estado: 'pendiente', bultos: 1, orden: 1, lat: 43.3704, lng: -8.4003, hueco: 'Detrás · izq' },
    { id: 'p2', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 2, lat: 43.3690, lng: -8.4010 },
  ]
  const pedidas = []
  await page.route(/\/api\/reparto\/mi-ruta\/navegar/, async (r) => {
    const b = r.request().postDataJSON(); pedidas.push(b.id)
    await r.fulfill({ json: b.id === 'p1' ? {
      fuente: 'carreteras', metros: 999, minutos: 4.1,
      linea: [[43.3665, -8.4065], [43.3675, -8.4074], [43.3679, -8.4066], [43.3713, -8.4006], [43.3704, -8.4003]],
      pasos: [
        { texto: 'Sal por Túnel Praza de Lugo', icono: 'recto', punto: [43.3665, -8.4065], metros: 140 },
        { texto: 'Gira a la derecha por Praza de Pontevedra', icono: 'derecha', punto: [43.3675, -8.4074], metros: 86 },
        { texto: 'Sigue recto por Rúa San Andrés', icono: 'recto', punto: [43.3679, -8.4066], metros: 620 },
        { texto: 'Gira a la derecha por Rúa Torreiro', icono: 'derecha', punto: [43.3713, -8.4006], metros: 99 },
        { texto: 'Has llegado', icono: 'llegada', punto: [43.3704, -8.4003], metros: 0 },
      ] } : {
      fuente: 'carreteras', metros: 200, minutos: 1,
      linea: [[43.3704, -8.4003], [43.3690, -8.4010]],
      pasos: [{ texto: 'Sal por Rúa Galera', icono: 'recto', punto: [43.3704, -8.4003], metros: 200 },
        { texto: 'Has llegado', icono: 'llegada', punto: [43.3690, -8.4010], metros: 0 }] } })
  })
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado' } : p))
    await r.fulfill({ json: {} })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Súper', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:40', minutos: 40, km: 9.5, trafico: true }, pedidos } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Empezar a navegar' }).click()

  const nav = page.getByRole('dialog', { name: 'Navegación' })
  await expect(nav.getByTestId('guia-texto')).toHaveText('Gira a la derecha por Praza de Pontevedra')
  await expect(nav.getByTestId('guia-distancia')).toHaveText(/^1[23]0 m$/)
  await expect(nav.getByText('Bar Pepe')).toBeVisible()
  await expect(nav.getByText(/Llegas ≈ \d\d:\d\d/)).toBeVisible()
  await expect(nav.locator('.leaflet-container')).toBeVisible()

  // Gira y avanza: la siguiente maniobra.
  await context.setGeolocation({ latitude: 43.3677, longitude: -8.4070 })
  await expect(nav.getByTestId('guia-texto')).toHaveText('Sigue recto por Rúa San Andrés')
  await context.setGeolocation({ latitude: 43.3700, longitude: -8.4029 })
  await expect(nav.getByTestId('guia-texto')).toHaveText('Gira a la derecha por Rúa Torreiro')

  // En la puerta: has llegado, dónde está el paquete, y entregar.
  await context.setGeolocation({ latitude: 43.37038, longitude: -8.40032 })
  await expect(nav.getByText('Has llegado')).toBeVisible()
  await expect(nav.getByText('Búscalo: Detrás · izq')).toBeVisible()
  await nav.getByRole('button', { name: 'Entregado', exact: true }).click()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()

  // Y sola, a la siguiente.
  await expect(nav.getByText('Farmacia Sol')).toBeVisible()
  await expect(nav.getByTestId('guia-texto')).toHaveText('Llegas a tu parada')   // solo queda llegar: 200 m en línea
  expect(pedidas).toEqual(['p1', 'p2'])
  await nav.getByRole('button', { name: 'Salir de la navegación' }).click()
  await expect(nav).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* AVISO DE LA MAÑANA (11-10-2026): se ofrece una vez y suscribe el móvil a los avisos. Desde el 18-10 la hora
   la elige él (la de cargar la furgoneta) y se guarda en el servidor. */
test('Ruta · aviso de la mañana: elige la hora, se activa y no se vuelve a preguntar', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  await page.addInitScript(() => {
    // Un navegador con avisos: permiso que se concede y una suscripción de mentira.
    window.Notification = { permission: 'default', requestPermission: async () => 'granted' }
    window.PushManager = function () {}
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => ({ toJSON: () => ({ endpoint: 'https://push.example/e1', keys: {} }) }) } }
    Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true })
  })
  const suscritas = []
  await page.route(/\/api\/push\/vapid-key/, (r) => r.fulfill({ json: { key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', enabled: true } }))
  await page.route(/\/api\/push\/subscribe/, async (r) => { suscritas.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  const horas = []
  await page.route(/\/api\/reparto\/aviso-manana$/, async (r) => { horas.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, hora: '07:30' } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const tarjeta = page.getByRole('region', { name: 'Aviso por la mañana' })
  await expect(tarjeta.getByText('¿Te aviso por la mañana para cargar tu ruta?')).toBeVisible()
  await expect(tarjeta.getByRole('radio', { name: '8:00' })).toHaveAttribute('aria-checked', 'true')     // sin elegir, las 8
  await tarjeta.getByRole('radio', { name: '7:30' }).click()
  await tarjeta.getByRole('button', { name: 'Avísame a las 7:30' }).click()
  await expect.poll(() => suscritas.length).toBe(1)
  expect(suscritas[0].subscription.endpoint).toBe('https://push.example/e1')
  await expect.poll(() => horas).toEqual([{ hora: '07:30' }])
  await expect(page.getByText('Listo: te aviso a las 7:30 los días que aún no tengas paquetes.')).toBeVisible()
  await expect(tarjeta).toHaveCount(0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('region', { name: 'Aviso por la mañana' })).toHaveCount(0)    // no se vuelve a preguntar
  expect(fallos).toEqual([])
})

/* «Cuenta»: la hora del aviso se ve y se cambia (18-10-2026). */
test('Cuenta · el aviso de la mañana se cambia de hora', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  await page.addInitScript(() => {
    // Un móvil que ya tiene los avisos activados.
    window.Notification = { permission: 'granted', requestPermission: async () => 'granted' }
    window.PushManager = function () {}
    const sub = { toJSON: () => ({ endpoint: 'https://push.example/e1', keys: {} }) }
    const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub } }
    Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true })
  })
  const horas = []
  await page.route(/\/api\/reparto\/aviso-manana$/, async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { hora: '08:00' } })
    horas.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, hora: '06:30' } })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  const aviso = page.getByRole('region', { name: 'Aviso por la mañana' })
  const hora = aviso.getByRole('combobox', { name: '¿A qué hora cargas la furgoneta?' })
  await expect(hora).toHaveValue('08:00')
  await hora.selectOption('06:30')
  await expect.poll(() => horas).toEqual([{ hora: '06:30' }])
  await expect(page.getByText('Te aviso a las 6:30.')).toBeVisible()
  expect(fallos).toEqual([])
})

/* MANOS LIBRES (11-10-2026): en la guía, órdenes de voz cortas. El reconocimiento del navegador se simula. */
test('Reparto · manos libres: «he llegado» y «entregado» por voz, sin foto y a la siguiente', async ({ page, context }) => {
  const fallos = vigilar(page)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA' }))
    localStorage.setItem('cookie_consent', '1')
    localStorage.setItem('guia_voz', '0')
    window.webkitSpeechRecognition = class {
      constructor() { window.__rec = this }
      start() { window.__escuchando = (window.__escuchando || 0) + 1 }
      abort() {}
      stop() {}
    }
    window.SpeechRecognition = window.webkitSpeechRecognition
    window.__decir = (frase) => window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: frase }], { isFinal: true })] })
  }, token)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3665, longitude: -8.4065 })
  await simularApi(page, 'vacio')
  let pedidos = [
    { id: 'p1', cliente: 'Bar Pepe', direccion: 'Rúa Galera 10', estado: 'pendiente', bultos: 1, orden: 1, lat: 43.3704, lng: -8.4003 },
    { id: 'p2', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 2, lat: 43.3690, lng: -8.4010 },
  ]
  await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: {
    fuente: 'carreteras', metros: 600, minutos: 3, linea: [[43.3665, -8.4065], [43.3704, -8.4003]],
    pasos: [{ texto: 'Sigue recto por Rúa San Andrés', icono: 'recto', punto: [43.3665, -8.4065], metros: 600 },
      { texto: 'Has llegado', icono: 'llegada', punto: [43.3704, -8.4003], metros: 0 }] } }))
  const estados = []
  await page.route(/\/api\/reparto\/pedidos\/p\d\/estado/, async (r) => {
    estados.push(r.request().postDataJSON())
    pedidos = pedidos.map((p) => (r.request().url().includes(`/${p.id}/`) ? { ...p, estado: 'entregado' } : p))
    await r.fulfill({ json: {} })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-11', jornada: {}, aviso_aceptado: true, base: null,
    ruta: { fin: '10:40', minutos: 40, km: 9.5, trafico: true }, pedidos } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Empezar a navegar' }).click()
  const nav = page.getByRole('dialog', { name: 'Navegación' })
  await expect(nav.getByText('Bar Pepe')).toBeVisible()

  await nav.getByRole('button', { name: 'Manos libres' }).click()
  await expect(nav.getByText(/Di «entregado», «no entregado»/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__escuchando || 0)).toBeGreaterThan(0)
  // Una frase larga (o la propia voz de la guía) no es una orden.
  await page.evaluate(() => window.__decir('ya casi he llegado y luego lo dejo entregado'))
  await expect(nav.getByText('Has llegado')).toHaveCount(0)
  await page.evaluate(() => window.__decir('he llegado'))
  await expect(nav.getByText('Has llegado')).toBeVisible()
  await expect(nav.getByText('Entendido: «he llegado»')).toBeVisible()
  await page.waitForTimeout(2600)                                  // entre orden y orden, 2,5 s
  await page.evaluate(() => window.__decir('Entregado'))
  await expect.poll(() => estados.length).toBe(1)
  expect(estados[0]).toMatchObject({ estado: 'entregado' })
  await expect(page.getByRole('button', { name: 'Entregar sin foto' })).toHaveCount(0)   // por voz no pide la foto
  await expect(nav.getByText('Farmacia Sol')).toBeVisible()                              // y sola, a la siguiente
  // Se queda activado para la próxima vez.
  expect(await page.evaluate(() => localStorage.getItem('guia_manos'))).toBe('1')
  expect(fallos).toEqual([])
})

/* ── EL COBRO DE QUIEN REPARTE SOLO (04-10-2026) ─────────────────────────────
   Prueba con tarjeta (hoy 0 €), muro al acabar, pasar a anual, regalos y la
   app de Play sin botones de pago. */
const BILLING_BASE = {
  plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
  precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
}
async function entrarRepartidor(page, billing, { enApp = false } = {}) {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  if (enApp) await page.addInitScript(() => sessionStorage.setItem('flota_app', '1'))
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { ...BILLING_BASE, ...billing } }))
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-04', pedidos: [], jornada: {}, aviso_aceptado: true } }))
}

/* PLAN GRATIS (10-10-2026): con la prueba acabada y sin pagar ya no hay muro: se reparte con un
   tope de paradas al día, y la app lo dice y ofrece quitarlo. */
test('Cobro · plan gratis: sin pagar se sigue repartiendo con tope y «Quitar el tope» lleva a Cuenta', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 0, required: true, trial_ends: new Date(Date.now() - 86400000).toISOString(),
    bloqueo: '', gratis: { activo: true, tope: 15, usadas: 4 } })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Plan gratis: hasta 15 paradas nuevas al día.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu prueba ha terminado' })).toHaveCount(0)          // sin muro
  await page.getByRole('button', { name: 'Quitar el tope' }).click()
  await expect(page.getByText('Plan gratis', { exact: true })).toBeVisible()
  await expect(page.getByText(/Sigues gratis con hasta 15 paradas nuevas al día/)).toBeVisible()
  expect(fallos).toEqual([])
})

/* EL ÚLTIMO PASO DEL ALTA (10-10-2026): recién creada la cuenta, instalar la app antes que nada.
   En el ordenador, un QR con un pase de un solo uso; dentro de TikTok, salir a Chrome ya con la cuenta. */
test('Alta · recién creada la cuenta pide instalar la app (QR en el ordenador) y se puede saltar', async ({ page }) => {
  // El QR es para el ORDENADOR: en el móvil el paso ofrece instalar, no un QR (lo prueban los de Android/iPhone).
  test.skip(test.info().project.name === 'movil', 'el QR solo sale en el ordenador')
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 7, required: false })
  await page.addInitScript(() => { if (!sessionStorage.getItem('ya')) { localStorage.setItem('fds_recien_alta', '1'); sessionStorage.setItem('ya', '1') } })
  await page.route(/\/api\/auth\/pase-movil$/, (r) => r.fulfill({ json: { pase: 'pase-de-prueba', minutos: 10 } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const paso = page.getByRole('dialog', { name: 'Último paso: instala la app' })
  await expect(paso.getByRole('img', { name: 'Código QR para abrir tu cuenta en el móvil' })).toBeVisible()
  await paso.getByRole('button', { name: 'Ahora no, seguir en la web' }).click()
  await expect(paso).toHaveCount(0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Último paso: instala la app' })).toHaveCount(0)
  expect(fallos).toEqual([])
})

test('Alta · el pase del QR entra en la cuenta y quita el pase de la dirección', async ({ page }) => {
  await simularApi(page, 'vacio')
  let pedido = null
  await page.route(/\/api\/auth\/pase-movil\/canjear/, async (r) => {
    pedido = r.request().postDataJSON()
    await r.fulfill({ json: { access_token: 'tok-pase', role: 'admin', name: 'Rosa', id: 'a1', account_type: 'dsp', slug: 'rosa' } })
  })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { ...BILLING_BASE, status: 'trial', days_left: 7 } }))
  await page.goto('/pase?p=pase-de-prueba', { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/ruta')
  expect(pedido).toEqual({ pase: 'pase-de-prueba' })
  expect(await page.evaluate(() => localStorage.getItem('flota_token'))).toBe('tok-pase')
})

/* EL CORREO ENTRA SIN CONTRASEÑA (24-10-2026): el pase va tras «#» y `ir` dice a dónde; las utm se quedan. */
test('Correo · el enlace del correo entra con su pase y deja su ruta con las utm', async ({ page }) => {
  await simularApi(page, 'vacio')
  let pedido = null
  await page.route(/\/api\/auth\/pase-movil\/canjear/, async (r) => {
    pedido = r.request().postDataJSON()
    await r.fulfill({ json: { access_token: 'tok-correo', role: 'admin', name: 'Rosa', id: 'a1', account_type: 'dsp', slug: 'rosa' } })
  })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { ...BILLING_BASE, status: 'trial', days_left: 7 } }))
  await page.goto('/pase?ir=ruta&utm_source=correo&utm_content=primer_dia#p=pase-del-correo', { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/ruta?utm_source=correo&utm_content=primer_dia')
  expect(pedido).toEqual({ pase: 'pase-del-correo' })
  expect(await page.evaluate(() => localStorage.getItem('flota_token'))).toBe('tok-correo')
})

test('Correo · sin sesión, la ruta lleva a «Entra en FDS» con el correo y no a crear cuenta', async ({ page }) => {
  await page.goto('/ruta?utm_source=correo', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe('/ruta?utm_source=correo')
  await expect(page.getByRole('heading', { name: 'Entra en FDS' })).toBeVisible()
  await expect(page.getByText('Tu correo')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Crear cuenta gratis' })).toHaveAttribute('href', '/registro?sector=autonomo&plan=autonomo')
})

test('Correo · un pase caducado dice qué pasa y ofrece entrar volviendo a la ruta', async ({ page }) => {
  await page.route(/\/api\/auth\/pase-movil\/canjear/, (r) => r.fulfill({ status: 401, json: { detail: 'El enlace ha caducado. Entra con tu correo y tu contraseña.' } }))
  await page.goto('/pase?ir=cuenta#p=viejo', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('El enlace ha caducado. Entra con tu correo y tu contraseña.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', `/login?next=${encodeURIComponent('/ruta?tab=cuenta')}`)
  expect(page.url()).not.toContain('viejo')
})

test.describe('Alta desde el navegador de TikTok (Android)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36 musical_ly_2023607030 BytedanceWebview/d8a21c6' })
  test('le dice dónde está y saca un pase para abrir Chrome, sin ofrecer el APK desde dentro', async ({ page }) => {
    await entrarRepartidor(page, { status: 'trial', days_left: 7, required: false })
    await page.addInitScript(() => localStorage.setItem('fds_recien_alta', '1'))
    let pases = 0
    await page.route(/\/api\/auth\/pase-movil$/, (r) => { pases += 1; return r.fulfill({ json: { pase: 'p1', minutos: 10 } }) })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const paso = page.getByRole('dialog', { name: 'Último paso: instala la app' })
    await expect(paso.getByText('Estás en el navegador de TikTok: desde aquí el móvil no deja instalar nada.')).toBeVisible()
    // Desde dentro de TikTok/Instagram el APK se descargaba y no se abría con la cuenta (18-10): solo Chrome con el pase.
    await expect(paso.getByRole('link', { name: 'Descargar la app para Android' })).toHaveCount(0)
    await paso.getByRole('button', { name: 'Abrir en Chrome' }).click()
    await expect(paso.getByText(/¿No se ha abierto\? Pulsa ⋮/)).toBeVisible({ timeout: 6000 })
    expect(pases).toBe(1)
  })
})

/* IPHONE DENTRO DE FACEBOOK (17-10-2026): Wanger pulsó «Abrir en Safari» 4 veces y no salía (Facebook no deja).
   Ahora, si no sale, un aviso visible con el enlace de entrada para copiarlo y pegarlo en Safari. */
test.describe('Alta desde el navegador de Facebook (iPhone)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBLC/es_ES]' })
  test('si no se abre Safari, deja copiar el enlace de entrada para pegarlo allí', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await entrarRepartidor(page, { status: 'trial', days_left: 7, required: false })
    await page.addInitScript(() => localStorage.setItem('fds_recien_alta', '1'))
    await page.route(/\/api\/auth\/pase-movil$/, (r) => r.fulfill({ json: { pase: 'p1', minutos: 10 } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const paso = page.getByRole('dialog', { name: 'Último paso: instala la app' })
    await expect(paso.getByText('Estás en el navegador de Facebook: desde aquí el móvil no deja instalar nada.')).toBeVisible()
    await expect(paso.getByRole('link', { name: 'Descargar la app para Android' })).toHaveCount(0)   // en iPhone, nada de APK
    await paso.getByRole('button', { name: 'Abrir en Safari' }).click()
    const aviso = paso.getByTestId('no-se-abrio')
    await expect(aviso).toBeVisible({ timeout: 6000 })
    await expect(aviso.getByRole('textbox', { name: 'Enlace para entrar' })).toHaveValue(/\/pase\?p=p1$/)
    await aviso.getByRole('button', { name: 'Copiar el enlace' }).click()
    await expect(aviso.getByRole('button', { name: 'Copiado: ábrelo en Safari y pégalo arriba' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/pase\?p=p1$/)
  })
})

test.describe('Instalar en iPhone desde Safari', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' })
  test('dice que no se descarga de la App Store y cómo añadirla', async ({ page }) => {
    await entrarRepartidor(page, { status: 'trial', days_left: 7, required: false })
    await page.addInitScript(() => localStorage.setItem('fds_recien_alta', '1'))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const paso = page.getByRole('dialog', { name: 'Último paso: instala la app' })
    await expect(paso.getByText('Elige «Añadir a pantalla de inicio».', { exact: false })).toBeVisible()
    await expect(paso.getByText('En iPhone no se descarga de la App Store: se instala así, desde Safari, y funciona como una app.')).toBeVisible()
    await expect(paso.getByText(/llegará próximamente/)).toHaveCount(0)
  })
})

/* PROMOCIÓN (10-10-2026): gratis y sin límite hasta el 31-12. La app no habla de prueba ni de cobros. */
test('Cobro · con la promoción: «Gratis sin límite», sin aviso de prueba ni ofertas de pago', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 1, required: false, trial_ends: new Date(Date.now() + 86400000).toISOString(),
    gratis: { activo: false, tope: 15, usadas: 20 }, promo: { activa: true, hasta: '2026-12-31' } })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible()
  await expect(page.getByText(/Queda 1 día de prueba/)).toHaveCount(0)
  await expect(page.getByText('Plan gratis: hasta 15 paradas nuevas al día.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText('Gratis sin límite', { exact: true })).toBeVisible()
  await expect(page.getByText(/Hasta el 31\/12\/2026 no tienes tope de paradas ni pagas nada|Hasta el .* no tienes tope de paradas ni pagas nada/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Pagar con tarjeta|Suscribirme/ })).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* LA CARTERA «INVITA Y GANA» (10-10-2026): saldo, invitar y pedir el pago por Bizum. */
test('Cartera · ve su saldo, invita y pide cobrar por Bizum', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  // 14-10-2026: promoción de 10 € (desde el 17-10, hasta el 31-12; lo dice el servidor) y retirada desde 60 €,
  // que NO se enseña hasta que pulsa «Cobrar» con menos saldo.
  let ref = { codigo: 'ABC123', invitados: 4, premiados: 3, saldo: 4500, ganado: 4500, por_invitado: 1000, retirada_min: 6000,
    promo_hasta: '2026-12-31', promo_cent: 1000, entregas_cartera: 20, dias_distintos: 2, pendiente: false, retiradas: [] }
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: ref }))
  const pedidos = []
  await page.route(/\/api\/cartera\/retirar/, async (r) => {
    pedidos.push(r.request().postDataJSON())
    ref = { ...ref, saldo: 0, pendiente: true, retiradas: [{ id: 'r1', importe: 7500, metodo: 'bizum', destino: '•••• 5678', estado: 'pendiente', creada: '2026-10-10T12:00:00Z' }] }
    await r.fulfill({ json: { ok: true } })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Gana 10 € por cada compañero que la use/)).toBeVisible()
  await expect(page.getByText('Promo hasta el 31 de diciembre')).toBeVisible()
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  const cartera = page.getByRole('region', { name: 'Tu cartera' })
  await expect(cartera.getByText('45 €', { exact: true })).toBeVisible()
  await expect(cartera.getByText('Invitados: 4 · ya la usan: 3 · ganado: 45 €')).toBeVisible()
  await expect(cartera.getByText('Promoción hasta el 31 de diciembre: 10 € por cada compañero que se registre con tu enlace.')).toBeVisible()
  await expect(cartera.getByText(/desde \d+ €/)).toHaveCount(0)          // el mínimo no está a la vista
  await cartera.getByRole('button', { name: 'Enseñar mi QR a un compañero' }).click()
  await expect(cartera.getByRole('img', { name: 'Código QR de tu invitación' })).toBeVisible()
  await cartera.getByRole('button', { name: 'Ocultar el QR' }).click()
  await cartera.getByRole('button', { name: 'Cobrar 45 €' }).click()      // con 45 €: ahora sí se entera del mínimo
  await expect(page.getByText('Se puede cobrar a partir de 60 €. Te faltan 15 €.')).toBeVisible()
  await expect(cartera.getByPlaceholder('Nombre y apellidos del titular')).toHaveCount(0)
  ref = { ...ref, saldo: 7500, ganado: 7500 }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await cartera.getByRole('button', { name: 'Cobrar 75 €' }).click()
  await cartera.getByPlaceholder('Nombre y apellidos del titular').fill('Pepe Pérez')
  await cartera.getByPlaceholder('Móvil con Bizum').fill('612 345 678')
  await cartera.getByRole('button', { name: 'Pedir el pago de 75 €' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ titular: 'Pepe Pérez', metodo: 'bizum', destino: '612 345 678' })
  await expect(cartera.getByText('Tienes un pago en revisión. Te avisamos por correo cuando lo enviemos.')).toBeVisible()
  await expect(cartera.getByText('En revisión', { exact: true })).toBeVisible()
  expect(fallos).toEqual([])
})

/* EL BONO DE BIENVENIDA (17-10-2026): 10 € por la primera ruta de verdad (20 entregas en 2 días), con lo que
   lleva a la vista; las paradas de ejemplo no cuentan y se dice; ganado, se celebra y lleva a la cartera. */
test('Bono · la tarjeta de la primera ruta: progreso, ejemplos que no cuentan y ganado lleva a la cartera', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
  let bono = { cent: 1000, pagado: false, hasta: '2026-12-31', objetivo: 20, dias_objetivo: 2, entregas: 0, dias: 0, revisar: false }
  let pedidos = []
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-17', pedidos, jornada: {}, aviso_aceptado: true, bono } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: {
    codigo: 'ABC123', invitados: 0, premiados: 0, saldo: bono.pagado ? 1000 : 0, ganado: bono.pagado ? 1000 : 0, por_invitado: 1000,
    retirada_min: 6000, promo_hasta: '2026-12-31', promo_cent: 1000, entregas_cartera: 20, dias_distintos: 2, pendiente: false,
    retiradas: [], bono: bono.pagado ? { cent: 1000, pagado: true, pagado_en: bono.pagado_en } : bono } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const tarjeta = page.getByTestId('bono')
  await expect(tarjeta.getByText('10 € por tu primera ruta real')).toBeVisible()
  await expect(tarjeta.getByText('Haz 20 entregas con la app en 2 días distintos y son tuyos. Hasta el 31 de diciembre.')).toBeVisible()
  await expect(tarjeta.getByText('0 de 20 entregas')).toBeVisible()
  await expect(tarjeta.getByText(/foto a la etiqueta de cada uno, aquí abajo/)).toBeVisible()
  // Con la tarjeta a la vista, el aviso de «invitar» de arriba no se repite.
  await expect(page.getByText(/Gana 10 € por cada compañero que la use/)).toHaveCount(0)
  // Solo paradas de ejemplo: no cuentan, y se dice.
  pedidos = [{ id: 'e1', cliente: 'Ejemplo', direccion: 'Calle Real 1', estado: 'pendiente', orden: 1, ejemplo: true }]
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(tarjeta.getByText('Las paradas de ejemplo no cuentan: quítalas y mete las tuyas.')).toBeVisible()
  // Con entregas de verdad: lo que lleva.
  pedidos = []
  bono = { ...bono, entregas: 12, dias: 1 }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(tarjeta.getByText('12 de 20 entregas')).toBeVisible()
  await expect(tarjeta.getByText('1 de 2 días')).toBeVisible()
  await expect(tarjeta.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12')
  // Ganado: se celebra y lleva a la cartera, que lo dice.
  bono = { cent: 1000, pagado: true, pagado_en: new Date().toISOString(), nuevo: true }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('bono')).toHaveCount(0)
  await page.getByTestId('bono-ganado').click()
  const cartera = page.getByRole('region', { name: 'Tu cartera' })
  await expect(cartera.getByText('Bono de bienvenida: 10 € ganados con tu primera ruta.')).toBeVisible()
  await expect(cartera.getByText('10 €', { exact: true })).toBeVisible()
  expect(fallos).toEqual([])
})

/* COMO UNA APP (17-10-2026): en «Hoy», tirar hacia abajo desde arriba recarga la ruta; en el mapa no. Y si el
   historial no carga, se dice y se puede reintentar (antes salía «Últimos 30 días: {total} paradas…»). */
test.describe('App del repartidor en el móvil', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test('tirar hacia abajo en «Hoy» recarga la ruta', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    let veces = 0
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => { veces += 1; r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-17', pedidos: [], jornada: {}, aviso_aceptado: true } }) })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Escanear' })).toBeVisible()
    await expect.poll(() => veces).toBeGreaterThan(0)
    const antes = veces
    const tirar = (desde, hasta, selector = 'body') => page.evaluate(([y0, y1, sel]) => {
      const el = document.querySelector(sel)
      const toque = (y) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [toque(y0)], bubbles: true }))
      for (let y = y0; y <= y1; y += 20) el.dispatchEvent(new TouchEvent('touchmove', { touches: [toque(y)], bubbles: true }))
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }))
    }, [desde, hasta, selector])
    await tirar(150, 200)                                            // poco: no recarga
    await page.waitForTimeout(300)
    expect(veces).toBe(antes)
    await tirar(150, 360)                                            // de verdad: recarga
    await expect.poll(() => veces).toBe(antes + 1)
    expect(fallos).toEqual([])
  })

  /* SIN COBERTURA (17-10-2026): «Entregado» sin red se guarda en el móvil, se ve hecho, y se envía al volver
     la red con la hora a la que se hizo. Deshacer algo que aún no salió del móvil no manda nada. */
  test('sin cobertura, la entrega se guarda en el móvil y se envía al volver la red con su hora', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    const parada = (id, cliente, estado = 'pendiente') => ({ id, cliente, direccion: `Rúa Real ${id.slice(1)}, A Coruña`, estado, orden: Number(id.slice(1)), lat: 43.37, lng: -8.40 })
    const servidor = { p1: 'pendiente', p2: 'pendiente' }
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-17', jornada: {}, aviso_aceptado: true,
      pedidos: [parada('p1', 'Farmacia Sol', servidor.p1), parada('p2', 'Bar Pepe', servidor.p2)] } }))
    await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
    let red = false
    const recibidos = []
    await page.route(/\/api\/reparto\/pedidos\/p\d\/estado/, async (r) => {
      if (!red) return r.abort('internetdisconnected')
      const body = r.request().postDataJSON()
      recibidos.push({ id: r.request().url().match(/p\d/)[0], ...body })
      servidor[recibidos.at(-1).id] = body.estado
      return r.fulfill({ json: {} })
    })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const entregar = async () => {
      await page.getByRole('button', { name: /^Entregado$/ }).first().click()
      await page.getByRole('button', { name: /^Entregar sin foto$/ }).click()
    }
    await entregar()                                                      // Farmacia Sol, sin red
    await expect(page.getByText('Sin cobertura: guardado en el móvil. Se envía solo cuando vuelva la conexión.')).toBeVisible()
    await expect(page.getByTestId('sin-enviar')).toContainText('1 cambio guardado en el móvil')
    await expect(page.getByText('Bar Pepe').first()).toBeVisible()        // la siguiente ya es Bar Pepe
    // Deshacer algo que no ha salido del móvil: se olvida, sin mandar nada.
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByTestId('sin-enviar')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('fds_cola_entregas'))).toBeNull()
    await entregar()                                                      // otra vez, sin red
    await expect(page.getByTestId('sin-enviar')).toBeVisible()
    const guardada = JSON.parse(await page.evaluate(() => localStorage.getItem('fds_cola_entregas')))
    expect(guardada).toHaveLength(1)
    expect(guardada[0]).toMatchObject({ id: 'p1', estado: 'entregado' })
    // Recargar la app sin red no la pierde: se sigue viendo hecha.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('sin-enviar')).toBeVisible()
    expect(recibidos).toEqual([])
    // Vuelve la red: «Enviar ahora» la manda con la hora a la que se hizo.
    red = true
    await page.getByRole('button', { name: 'Enviar ahora' }).click()
    await expect(page.getByText('Ya hay conexión: enviado lo que estaba guardado.')).toBeVisible()
    await expect(page.getByTestId('sin-enviar')).toHaveCount(0)
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0]).toMatchObject({ id: 'p1', estado: 'entregado', hecho_en: guardada[0].hecho_en })
    expect(fallos.filter((f) => !/internetdisconnected|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(f))).toEqual([])
  })

  /* LA ÚLTIMA VEZ EN ESA PUERTA (17-10-2026): la parada recuerda dónde se dejó, la nota o que no había nadie. */
  test('la parada recuerda lo que pasó la última vez en esa puerta', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-17', jornada: {}, aviso_aceptado: true,
      pedidos: [
        { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5', estado: 'pendiente', orden: 1,
          antes: { fecha: '2026-10-10', estado: 'entregado', donde: 'porteria', nota: 'conserje Manolo', motivo: '' } },
        { id: 'p2', cliente: 'Bar Pepe', direccion: 'Rúa Nova 2', estado: 'pendiente', orden: 2,
          antes: { fecha: '2026-10-12', estado: 'fallido', donde: '', nota: 'timbre roto', motivo: 'No había nadie' } },
      ] } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('antes').first()).toHaveText('La última vez (10 oct): En portería o recepción · «conserje Manolo»')
    await page.getByText('Bar Pepe').first().click()                      // se despliega la segunda
    await expect(page.getByText('La última vez (12 oct) no se pudo: No había nadie · «timbre roto»')).toBeVisible()
    expect(fallos).toEqual([])
  })

  /* AJUSTES DEL MÓVIL (17-10-2026): claro, oscuro o automático (sigue al móvil) y letra más grande; se recuerdan. */
  test('en Ajustes se elige claro, oscuro o automático y la letra más grande', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const tema = () => page.evaluate(() => document.documentElement.getAttribute('data-panel-theme'))
    expect(await tema()).toBe('hibrido')
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
    await page.getByRole('radio', { name: 'Oscuro' }).click()
    expect(await tema()).toBe('dark')
    await page.getByRole('radio', { name: 'Claro' }).click()
    expect(await tema()).toBe('hibrido')
    await page.getByRole('radio', { name: 'Automático' }).click()
    expect(await tema()).toBe('dark')                                            // el móvil está en oscuro
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(tema).toBe('hibrido')                                       // y lo sigue al cambiar
    const letra = () => page.evaluate(() => getComputedStyle(document.querySelector('.app-ruta .text-\\[12px\\]')).fontSize)
    expect(await letra()).toBe('12px')
    await page.getByRole('checkbox', { name: 'Letra más grande' }).check()
    expect(await letra()).toBe('14px')
    await page.reload({ waitUntil: 'domcontentloaded' })                         // se recuerda
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-letra'))).toBe('grande')
    expect(await tema()).toBe('hibrido')
    expect(fallos).toEqual([])
  })

  /* HISTORIAL (17-10-2026): la semana en barras frente a la anterior, lo ganado con su tarifa, y el mes para la
     gestoría en un CSV para Excel. */
  test('historial: la semana de un vistazo y el mes para la gestoría', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    const dias = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000)
      return { fecha: d.toISOString().slice(0, 10), total: i < 7 ? 10 : 12, entregados: i < 7 ? 9 : (i === 13 ? 0 : 11), fallidos: 1 }
    })
    await page.route(/\/api\/reparto\/estadisticas/, (r) => r.fulfill({ json: { total: 150, entregados: 129, tasa_entrega: 90, por_dia: dias } }))
    await page.route(/\/api\/reparto\/ajustes/, (r) => r.fulfill({ json: { pago_parada: 180, pago_dia: 0, coste_km: 12, dias_conservar: 30 } }))
    let pedido = ''
    await page.route(/\/api\/reparto\/entregas-mes/, (r) => { pedido = r.request().url(); return r.fulfill({ status: 200, contentType: 'text/csv', body: '\ufeffFecha;Hora\r\n' }) })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Historial', exact: true }).click()
    const semana = page.getByTestId('resumen-semana')
    await expect(semana.getByText('66 entregas')).toBeVisible()                  // 6 días × 11 (hoy, 0)
    await expect(semana.getByText('la anterior: 63')).toBeVisible()              // 7 × 9
    await expect(semana.getByText('Ganado ≈ 118,80 €')).toBeVisible()            // 66 × 1,80
    await expect(page.getByText(/se borran a los 30 días/)).toBeVisible()
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar', exact: true }).click()
    const d = await descarga
    expect(d.suggestedFilename()).toMatch(/^entregas-\d{4}-\d{2}\.csv$/)
    expect(pedido).toMatch(/mes=\d{4}-\d{2}/)
    expect(fallos).toEqual([])
  })

  test('si el historial no carga, lo dice y se puede reintentar', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    let falla = true
    await page.route(/\/api\/reparto\/estadisticas/, (r) => (falla
      ? r.fulfill({ status: 503, json: { detail: 'caído' } })
      : r.fulfill({ json: { total: 12, entregados: 11, tasa_entrega: 92, por_dia: [] } })))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Historial', exact: true }).click()
    await expect(page.getByText('No se pudo cargar el historial.')).toBeVisible()
    await expect(page.getByText(/\{total\}|Aún no hay repartos/)).toHaveCount(0)
    falla = false
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByText('Últimos 30 días: 12 paradas, 11 entregadas (92 % a la primera).')).toBeVisible()
    expect(fallos.filter((f) => !/503|caído/.test(f))).toEqual([])
  })
})

test('Cobro · alta nueva: muro de «7 días gratis» con tarjeta, hoy 0 €, y elegir anual', async ({ page }) => {
  const fallos = vigilar(page)
  const fin = new Date(Date.now() + 7 * 86400000).toISOString()
  await entrarRepartidor(page, { status: 'trial', days_left: 7, trial_ends: fin, falta_tarjeta: true,
    bloqueo: 'Añade tu tarjeta para empezar los 7 días gratis (hoy no se cobra nada).', cobro_al_suscribir: fin })
  const pedidos = []
  await page.route(/\/api\/billing\/stripe\/suscripcion/, async (r) => { pedidos.push(r.request().postDataJSON()); await r.fulfill({ json: { url: '/ruta?pago=cancelado' } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Empieza tus 7 días gratis' })).toBeVisible()
  await expect(page.getByText('Hoy: 0 €')).toBeVisible()
  await expect(page.getByRole('button', { name: /Cargar paquetes/ })).toHaveCount(0)   // sin tarjeta, la ruta no
  await page.getByRole('radio', { name: /Anual/ }).click()
  await expect(page.getByText(/Hoy pagas 0 €\. El .* se cobran 99 € al año/)).toBeVisible()
  await page.getByRole('button', { name: 'Añadir tarjeta: hoy 0 €' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ plan: 'autonomo', anual: true })
  // El historial y la cuenta siguen abiertos.
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText('Añade tu tarjeta para empezar los 7 días gratis. Hoy no se cobra nada.')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Cobro · suscrito: pasar al plan anual explica el cobro y lo pide', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'active', suscrito: true, pago_proveedor: 'stripe', stripe_status: 'active',
    stripe_intervalo: 'mensual', stripe_proximo_cobro: '2026-11-04T10:00:00+00:00' })
  const cambios = []
  await page.route(/\/api\/billing\/stripe\/cambiar-plan/, async (r) => { cambios.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText(/Plan mensual: 9,99 €\/mes\. Próximo cobro el 4 de noviembre de 2026\./)).toBeVisible()
  await page.getByRole('button', { name: /Pasar al plan anual/ }).click()
  await expect(page.getByText(/Se cobran ahora 99 € menos la parte que no has usado de este mes/)).toBeVisible()
  await page.getByRole('button', { name: 'Sí, cambiar' }).click()
  await expect.poll(() => cambios.length).toBe(1)
  expect(cambios[0]).toEqual({ anual: true })
  await expect(page.getByRole('button', { name: 'Tarjeta, facturas y cancelar' })).toBeVisible()
  expect(fallos).toEqual([])
})

test('Cobro · regalar: comprar un año y mandar el código por WhatsApp o correo', async ({ page }) => {
  const fallos = vigilar(page)
  const fin = new Date(Date.now() + 5 * 86400000).toISOString()
  await entrarRepartidor(page, { status: 'trial', days_left: 5, trial_ends: fin, cobro_al_suscribir: fin })
  const compras = []
  await page.route(/\/api\/billing\/regalos$/, async (r) => {
    if (r.request().method() === 'POST') { compras.push(r.request().postDataJSON()); return r.fulfill({ json: { url: '/ruta?regalo=cancelado' } }) }
    return r.fulfill({ json: { regalos: [{ id: 'r1', codigo: 'ABCDEFGH', meses: 12, estado: 'pagado' }, { id: 'r2', codigo: 'JKLMNPQR', meses: 1, estado: 'canjeado' }] } })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText('ABCD-EFGH')).toBeVisible()
  await expect(page.getByText('1 año · Sin usar')).toBeVisible()
  await expect(page.getByText('1 mes · Usado')).toBeVisible()
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=.*%2Fregalo%2FABCDEFGH/)
  await expect(page.getByRole('link', { name: 'Correo' })).toHaveAttribute('href', /^mailto:\?subject=Te%20regalo%201%20a%C3%B1o/)
  await page.getByRole('radio', { name: /1 año/ }).click()
  await page.getByRole('button', { name: 'Comprar regalo' }).click()
  await expect.poll(() => compras.length).toBe(1)
  expect(compras[0]).toEqual({ meses: 12 })
  expect(fallos).toEqual([])
})

test('Cobro · en la app de Play no hay botones de pago, pero se puede canjear un regalo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 0, required: true, trial_ends: new Date(Date.now() - 86400000).toISOString(),
    bloqueo: 'Tu prueba gratis ha terminado. Suscríbete en «Cuenta» para seguir repartiendo.' }, { enApp: true })
  const canjes = []
  await page.route(/\/api\/billing\/regalos\/canjear/, async (r) => { canjes.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, mensaje: 'Regalo aplicado: tienes la app pagada hasta el 04/11/2026.' } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Tu prueba ha terminado' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Suscribirme|Añadir tarjeta|Comprar regalo/ })).toHaveCount(0)
  await page.getByLabel('Código de regalo').fill('abcd-efgh')
  await page.getByRole('button', { name: 'Canjear' }).click()
  await expect.poll(() => canjes.length).toBe(1)
  expect(canjes[0]).toEqual({ codigo: 'ABCD-EFGH' })
  await expect(page.getByText('Regalo aplicado: tienes la app pagada hasta el 04/11/2026.')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Cobro · el enlace del regalo: qué es, y al entrar se canjea solo', async ({ page }) => {
  const fallos = vigilar(page)
  await page.addInitScript(() => localStorage.setItem('cookie_consent', '1'))
  await simularApi(page, 'vacio')
  await page.route(/\/api\/regalo\/ABCDEFGH/, (r) => r.fulfill({ json: { estado: 'pagado', meses: 12 } }))
  await page.route(/\/api\/regalo\/USADO123/, (r) => r.fulfill({ json: { estado: 'canjeado', meses: 1 } }))
  await page.goto('/regalo/ABCDEFGH', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /1 año de/ })).toBeVisible()
  await expect(page.getByText('Sin tarjeta: no se te cobrará nada por este regalo.')).toBeVisible()
  await page.getByRole('button', { name: 'Crear mi cuenta y activarlo' }).click()
  await expect(page).toHaveURL(/registro\?sector=autonomo/)
  expect(await page.evaluate(() => sessionStorage.getItem('regalo_pendiente'))).toBe('ABCDEFGH')
  await page.goto('/regalo/USADO123', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Este regalo ya se ha usado.')).toBeVisible()
  expect(fallos).toEqual([])
})

test('Cobro · con un regalo pendiente, al entrar en la app se canjea antes de mirar el pago', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'active', pago_proveedor: 'regalo', pagado_hasta: '2027-10-11T10:00:00+00:00' })
  await page.addInitScript(() => sessionStorage.setItem('regalo_pendiente', 'ABCDEFGH'))
  const canjes = []
  await page.route(/\/api\/billing\/regalos\/canjear/, async (r) => { canjes.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, mensaje: 'Regalo aplicado: tienes la app pagada hasta el 11/10/2027.' } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => canjes.length).toBe(1)
  expect(canjes[0]).toEqual({ codigo: 'ABCDEFGH' })
  await expect(page.getByText('Regalo aplicado: tienes la app pagada hasta el 11/10/2027.')).toBeVisible()
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText(/Pagado hasta el 11 de octubre de 2027/)).toBeVisible()
  expect(fallos).toEqual([])
})

/* GOOGLE PLAY DENTRO DE LA APP: precios de Google, prueba gratis, la compra se
   comprueba en el servidor antes de cerrar el pago, y al reinstalar se
   recupera la suscripción. Digital Goods y PaymentRequest, simulados. */
async function simularPlay(page, { compras = [] } = {}) {
  await page.addInitScript((compras) => {
    sessionStorage.setItem('flota_app', '1')
    window.__pagos = []
    window.getDigitalGoodsService = async () => ({
      getDetails: async (ids) => [
        { itemId: 'repartidor_mensual', price: { currency: 'EUR', value: '9.99' }, subscriptionPeriod: 'P1M', freeTrialPeriod: 'P7D' },
        { itemId: 'repartidor_anual', price: { currency: 'EUR', value: '99.00' }, subscriptionPeriod: 'P1Y', freeTrialPeriod: 'P7D' },
      ].filter((d) => ids.includes(d.itemId)),
      listPurchases: async () => compras,
    })
    window.PaymentRequest = class {
      constructor(metodos) { this.metodos = metodos }
      async show() {
        const datos = this.metodos[0].data
        return { details: { purchaseToken: `tok-${datos.sku}-0123456789abcdef` }, complete: async (r) => { window.__pagos.push({ ...datos, metodo: this.metodos[0].supportedMethods, r }) } }
      }
    }
  }, compras)
}
const PLAY = { listo: true, productos: { repartidor_mensual: 'mensual', repartidor_anual: 'anual' }, paquete: 'com.flotadsp.flota', cuenta: 'c'.repeat(64) }

test('Cobro · en la app de Play: 7 días gratis con Google Play y la compra se comprueba antes de cerrar', async ({ page }) => {
  const fallos = vigilar(page)
  const fin = new Date(Date.now() + 7 * 86400000).toISOString()
  await entrarRepartidor(page, { status: 'trial', days_left: 7, trial_ends: fin, falta_tarjeta: true,
    bloqueo: 'Añade tu tarjeta para empezar los 7 días gratis (hoy no se cobra nada).', play: PLAY })
  await simularPlay(page)
  const verificados = []
  await page.route(/\/api\/billing\/play\/verificar/, async (r) => { verificados.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, vigente: true, en_prueba: true } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Empieza tus 7 días gratis' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Mensual/ })).toContainText('9,99 €')
  await expect(page.getByRole('radio', { name: /Anual/ })).toContainText('99,00 €')
  await expect(page.getByText(/Hoy pagas 0 €\. Al acabar los 7 días gratis, Google Play cobra 9,99\s€ al mes/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Añadir tarjeta|Comprar regalo/ })).toHaveCount(0)   // nada de Stripe en la app
  await page.getByRole('radio', { name: /Anual/ }).click()
  await page.getByRole('button', { name: 'Empezar 7 días gratis' }).click()
  await expect(page.getByText('Prueba activada. Hoy no se te cobra nada.')).toBeVisible()
  expect(verificados).toEqual([{ token: 'tok-repartidor_anual-0123456789abcdef' }])
  expect(await page.evaluate(() => window.__pagos)).toEqual([{ sku: 'repartidor_anual', cuenta: 'c'.repeat(64), metodo: 'https://play.google.com/billing', r: 'success' }])
  expect(fallos).toEqual([])
})

test('Cobro · en la app de Play: si el servidor no acepta la compra, el pago se cierra como fallido', async ({ page }) => {
  await entrarRepartidor(page, { status: 'trial', days_left: 0, required: true, bloqueo: 'Tu prueba gratis ha terminado.', play: PLAY })
  await simularPlay(page)
  await page.route(/\/api\/billing\/play\/verificar/, (r) => r.fulfill({ status: 403, json: { detail: 'Esa compra no es de esta cuenta' } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Empezar 7 días gratis' }).click()
  await expect(page.getByText('Esa compra no es de esta cuenta')).toBeVisible()
  expect((await page.evaluate(() => window.__pagos))[0].r).toBe('fail')
})

test('Cobro · en la app de Play: al reinstalar se recupera la suscripción que ya tenía', async ({ page }) => {
  await entrarRepartidor(page, { status: 'trial', days_left: 0, required: true, bloqueo: 'Tu prueba gratis ha terminado.', play: PLAY })
  await simularPlay(page, { compras: [{ itemId: 'otra_app', purchaseToken: 'x' }, { itemId: 'repartidor_mensual', purchaseToken: 'tok-viejo-0123456789abcdef' }] })
  const verificados = []
  await page.route(/\/api\/billing\/play\/verificar/, async (r) => { verificados.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, vigente: true } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => verificados.length).toBe(1)
  expect(verificados[0]).toEqual({ token: 'tok-viejo-0123456789abcdef' })
})

test('Cobro · suscrito con Google Play: se gestiona en Google Play, sin botones de Stripe', async ({ page }) => {
  await entrarRepartidor(page, { status: 'active', pago_proveedor: 'play',
    play: { ...PLAY, producto: 'repartidor_mensual', hasta: '2026-10-11T10:00:00Z', renueva: true, en_prueba: true } })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByText('Prueba con Google Play')).toBeVisible()
  await expect(page.getByText(/Primer cobro el 11 de octubre de 2026, con Google Play/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Gestionar o cancelar en Google Play' }))
    .toHaveAttribute('href', 'https://play.google.com/store/account/subscriptions?sku=repartidor_mensual&package=com.flotadsp.flota')
  await expect(page.getByRole('button', { name: /Suscribirme|Añadir tarjeta/ })).toHaveCount(0)
})

/* FUERA DE ESPAÑA (04-10-2026): WhatsApp con el prefijo del país de la cuenta. */
test('Reparto · en México el WhatsApp lleva el prefijo 52, y con + se respeta el número', async ({ page }) => {
  const fallos = vigilar(page)
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'JUAN', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
  await page.addInitScript((t) => {
    localStorage.setItem('flota_driver_token', t)
    localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'JUAN' }))
    localStorage.setItem('cookie_consent', '1')
    localStorage.setItem('ruta_nav2', 'google')
  }, token)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, empresa: 'Juan Envíos', fecha: '2026-10-04', jornada: {}, aviso_aceptado: true, pais: 'mx', prefijo: '52',
    pedidos: [
      { id: 'p1', cliente: 'Tienda Roma', direccion: 'Av. Álvaro Obregón 120, CDMX', telefono: '55 1234 5678', estado: 'pendiente', bultos: 1, orden: 1 },
      { id: 'p2', cliente: 'Café Condesa', direccion: 'Calle Ámsterdam 50, CDMX', telefono: '+1 305 555 0100', estado: 'pendiente', bultos: 1, orden: 2 },
    ] } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: /WhatsApp/ }).first()).toHaveAttribute('href', /wa\.me\/525512345678\?/)
  await page.getByRole('button', { name: /Ver la parada 2/ }).click()
  await expect(page.locator('div.rounded-2xl', { hasText: 'Parada 2' }).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /wa\.me\/13055550100\?/)
  expect(fallos).toEqual([])
})

/* INSTALAR DESDE LA WEB (04-10-2026): mientras Play valida, la app se instala
   desde el navegador. Con el aviso de Chrome, un botón; sin él, instrucciones. */
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
test.describe('App · instalar desde la web en Android', () => {
  test.use({ userAgent: UA_ANDROID })
  test('ofrece el APK y, si Chrome deja, instalar en un toque (y no sale si ya es app)', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 6, trial_ends: new Date(Date.now() + 6 * 86400000).toISOString() })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const tarjeta = page.getByLabel('Instalar la app')
    await expect(tarjeta).toBeVisible()
    // Sin aviso de Chrome: el APK.
    await expect(tarjeta.getByRole('link', { name: 'Descargar la app para Android' })).toHaveAttribute('href', '/descargas/FDS.apk')
    // Con el aviso de Chrome: el botón lo lanza.
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt')
      e.prompt = () => { window.__pedido = true }
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })
    await page.getByLabel('Instalar la app').getByRole('button', { name: 'Instalar la app' }).click()
    await expect.poll(() => page.evaluate(() => window.__pedido)).toBe(true)
    await expect(page.getByLabel('Instalar la app')).toHaveCount(0)
    expect(fallos).toEqual([])
  })
})

test.describe('App · dentro de la app (Play o el APK) no se ofrece instalar', () => {
  test.use({ userAgent: UA_ANDROID })
  test('ni la tarjeta ni el paso de después del alta', async ({ page }) => {
    await entrarRepartidor(page, { status: 'trial', days_left: 6 }, { enApp: true })
    await page.addInitScript(() => localStorage.setItem('fds_recien_alta', '1'))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Ruta', exact: false }).first()).toBeVisible()
    await expect(page.getByLabel('Instalar la app')).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Último paso: instala la app' })).toHaveCount(0)
  })
})

test.describe('Idiomas · la app de reparto sigue el idioma del móvil', () => {
  test.use({ locale: 'zh-CN' })
  test('móvil en chino: Empezar y la ruta salen en chino, y se puede volver al español', async ({ page }) => {
    const fallos = vigilar(page)
    await page.goto('/empezar', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '你的配送路线，自动排好。' })).toBeVisible()
    await expect(page.getByRole('link', { name: /免费创建我的账号/ })).toBeVisible()
    await page.getByRole('combobox', { name: /Idioma/ }).selectOption('es')
    await expect(page.getByRole('heading', { name: 'Tu ruta de reparto, ordenada sola.' })).toBeVisible()
    await page.getByRole('combobox', { name: /Idioma/ }).selectOption('zh')
    await entrarRepartidor(page, { status: 'active', plan: 'autonomo', days_left: 0 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '设置', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '账号', exact: true }).click()
    await expect(page.getByText('你的账号')).toBeVisible()
    expect(fallos).toEqual([])
  })
  test('móvil en chino: el alta del repartidor sale en chino y no promete «sin tarjeta»', async ({ page }) => {
    await page.goto('/empezar', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: /免费创建我的账号/ }).click()
    await expect(page).toHaveURL(/sector=autonomo/)
    // Lo primero, que es gratis (10-10-2026), y en chino.
    await expect(page.getByText('12月31日前免费且不限 · 无需绑卡')).toBeVisible()
    await expect(page.getByText('免费 · 无需绑卡 · 今天 0 欧元')).toBeVisible()
    await expect(page.getByText(/sin tarjeta/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: '隐私政策' })).toHaveAttribute('href', '/privacidad')
    await expect(page.getByRole('button', { name: /以配送员套餐创建账号/ })).toBeVisible()
    // PIPL: consentimiento aparte para tratar los datos fuera de China.
    await page.getByPlaceholder('Pepe').fill('李师傅')
    await page.getByPlaceholder('tu@correo.com').fill('li@example.cn')
    await page.locator('input[type=password]').first().fill('12345678')
    // Quien reparte solo no repite la contraseña (un campo menos en el móvil) y puede verla.
    await expect(page.locator('input[type=password]')).toHaveCount(1)
    await page.getByRole('button', { name: '显示密码' }).click()
    await expect(page.locator('input[type=password]')).toHaveCount(0)
    await page.getByRole('checkbox').first().check()
    await expect(page.getByText(/传输至中国境外/)).toBeVisible()
    await page.getByRole('button', { name: /以配送员套餐创建账号/ }).click()
    await expect(page.getByText('在中国使用本应用，需要你同意在中国境外处理你的数据。')).toBeVisible()
  })
})

test('Portada en chino · /cn entera en chino, con la app del repartidor y su alta en chino', async ({ page }) => {
  const fallos = vigilar(page)
  await page.goto('/cn', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('免费的送货应用')
  await expect(page).toHaveTitle(/免费送货应用/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { name: '它为你做的一切，全部免费' })).toBeVisible()
  // En China se navega con Amap o Baidu, no con Google Maps, y no hay Google Play: el APK se descarga.
  await expect(page.getByText('应用内语音导航到每个门口，也可用高德或百度地图')).toBeVisible()
  await expect(page.getByRole('link', { name: /下载安卓应用/ })).toHaveAttribute('href', '/descargas/FDS-china.apk')
  await expect(page.getByRole('button', { name: '知道了' })).toBeVisible()                   // cookies en chino
  await page.getByRole('link', { name: /免费创建我的账号/ }).first().click()
  await expect(page).toHaveURL(/registro\?sector=autonomo/)
  await expect(page.getByText('12月31日前免费且不限 · 无需绑卡')).toBeVisible()
  expect(fallos).toEqual([])
})

test.describe('Idiomas · errores del servidor en la app de ruta', () => {
  test.use({ locale: 'zh-CN' })
  test('el aviso de pago del servidor sale traducido, y un 422 no rompe la pantalla', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'active', plan: 'autonomo', days_left: 0 })
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ status: 402,
      json: { detail: 'Tu prueba gratis ha terminado. Suscríbete en «Cuenta» para seguir repartiendo.' } }))
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('免费试用已结束。请在「账号」中订阅以继续配送。')).toBeVisible()
    await page.unroute(/\/api\/reparto\/mi-ruta$/)
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ status: 422,
      json: { detail: [{ loc: ['body', 'x'], msg: 'field required', type: 'value_error' }] } }))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('x: field required')).toBeVisible()   // services/api.js lo aplana
    await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
    expect(fallos.filter((f) => !/402|422/.test(f))).toEqual([])
  })
})

test.describe('Reparto · en México se cobra en pesos', () => {
  test.use({ locale: 'es-MX' })
  test('el importe sale en pesos y en vez de Bizum se ofrece transferencia', async ({ page }) => {
    const fallos = vigilar(page)
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'JUAN', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
    await page.addInitScript((t) => {
      localStorage.setItem('flota_driver_token', t)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'JUAN' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    const estados = []
    await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => { estados.push(r.request().postDataJSON()); await r.fulfill({ json: {} }) })
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
      activo: true, empresa: 'Juan Envíos', fecha: '2026-10-04', jornada: {}, aviso_aceptado: true, pais: 'mx', prefijo: '52',
      pedidos: [{ id: 'p1', cliente: 'Tienda Roma', direccion: 'Av. Álvaro Obregón 120, CDMX', estado: 'pendiente', bultos: 1, orden: 1, cobrar: 250 }] } }))
    await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('COBRAR $250.00')).toBeVisible()
    await page.getByRole('button', { name: 'Entregado', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Bizum' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Transferencia' }).click()
    await page.getByRole('button', { name: 'Entregar sin foto' }).click()
    await expect.poll(() => estados.length).toBe(1)
    expect(estados[0]).toMatchObject({ estado: 'entregado', metodo: 'transferencia' })
    expect(fallos).toEqual([])
  })
})

test('Idiomas · el panel en chino: diccionario y frases fijas de las pantallas', async ({ page }) => {
  const fallos = vigilar(page)
  await simularApi(page, 'lleno')
  await entrarComoAdmin(page)
  await page.addInitScript(() => { localStorage.setItem('cookie_consent', '1'); localStorage.setItem('flota_lang', 'zh') })
  await page.goto('/panel/vehiculos', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('添加车辆').first()).toBeVisible()          // frase fija (traductorZh)
  await page.goto('/panel/asignacion', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('添加一行').first()).toBeVisible()          // t('asgn.add.row')
  await expect(page.getByText('Añadir fila')).toHaveCount(0)
  expect(fallos).toEqual([])
})

test.describe('Reparto · en China', () => {
  test.use({ locale: 'zh-CN' })
  test('navega con Amap/Baidu, avisa por SMS y cobra en yuanes', async ({ page }) => {
    const fallos = vigilar(page)
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'd1', role: 'driver', name: 'LI', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
    await page.addInitScript((t) => {
      localStorage.setItem('flota_driver_token', t)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'LI' }))
      localStorage.setItem('cookie_consent', '1')
      localStorage.setItem('ruta_nav2', 'google')            // lo de otro país no vale aquí
    }, token)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
      activo: true, empresa: '', fecha: '2026-10-04', jornada: {}, aviso_aceptado: true, pais: 'cn', prefijo: '86',
      pedidos: [{ id: 'p1', cliente: '王记超市', direccion: '上海市黄浦区南京东路 100 号', telefono: '138 0013 8000', estado: 'pendiente', bultos: 1, orden: 1, cobrar: 88, lat: 31.2397, lng: 121.4998 }] } }))
    await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
    const sel = page.getByLabel('导航应用')
    await expect(sel).toHaveValue('app')
    await expect(sel.locator('option')).toHaveText(['本应用', '高德地图', '百度地图'])
    await sel.selectOption('amap')
    await expect(page.getByRole('link', { name: /出发/ }).first()).toHaveAttribute('href', /uri\.amap\.com\/navigation\?to=121\.4998,31\.2397,.*coordinate=wgs84/)
    await expect(page.getByRole('link', { name: /短信/ })).toHaveAttribute('href', /^sms:13800138000\?&body=/)
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0)
    await expect(page.getByText(/代收.*¥88\.00/).first()).toBeVisible()
    expect(fallos).toEqual([])
  })
})

test('Cobro · en China se ofrece pagar el año de una vez y a la vuelta se canjea solo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 7, pais: 'cn', falta_tarjeta: true })
  const pedidos = []
  await page.route(/\/api\/billing\/regalos$/, async (r) => {
    if (r.request().method() === 'POST') { pedidos.push(r.request().postDataJSON()); await r.fulfill({ json: { url: '/ruta?regalo_propio=r1', id: 'r1' } }) }
    else await r.fulfill({ json: { regalos: [{ id: 'r1', meses: 12, estado: 'pagado', codigo: 'ABCDEFGH' }] } })
  })
  const canjes = []
  await page.route(/\/api\/billing\/regalos\/canjear/, async (r) => { canjes.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true, mensaje: 'Regalo aplicado' } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'O paga el año de una vez' })).toBeVisible()
  await page.getByRole('button', { name: 'Pagar 1 año' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ meses: 12, para_mi: true })
  await expect.poll(() => canjes.length).toBe(1)
  expect(canjes[0]).toEqual({ codigo: 'ABCDEFGH' })
  expect(fallos).toEqual([])
})

test.describe('App · en China se descarga la app (sin Play ni Chrome)', () => {
  test.use({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: UA_ANDROID })
  test('la tarjeta de instalar ofrece el APK de China', async ({ page }) => {
    await entrarRepartidor(page, { status: 'active', plan: 'autonomo', days_left: 0 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: '下载安卓应用' })).toHaveAttribute('href', '/descargas/FDS-china.apk')
  })
})

test('Anuncio · quien llega del anuncio ve la app y la prueba con paradas antes del alta', async ({ page }) => {
  const fallos = vigilar(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/auth\/demo-reparto/, (r) => r.fulfill({ json: { access_token: 'tok', role: 'driver', driver: { id: 'demo-a-1', name: 'Repartidor (prueba)' }, autonomo: true } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, prueba: true, fecha: '2026-10-04', jornada: {}, aviso_aceptado: true, pais: 'es',
    pedidos: [{ id: 'p1', cliente: 'Cliente 1 (prueba)', direccion: 'Rúa Real 21, 15003 A Coruña', estado: 'pendiente', bultos: 3, orden: 1, lat: 43.37, lng: -8.398 }] } }))
  await page.goto('/registro?sector=autonomo&plan=autonomo&utm_source=facebook', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/repartidores\?/)
  await expect(page.getByRole('heading', { name: 'Tu ruta de reparto, ordenada sola.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Crear mi cuenta/ }).first()).toHaveAttribute('href', '/registro?sector=autonomo&plan=autonomo')
  await expect(page.getByText(/^Haz una foto a la etiqueta/).first()).toBeVisible()      // en España, como siempre
  // El vídeo de la app, mudo y en bucle (sin muted el navegador no lo arranca solo).
  const video = page.locator('video')
  await expect(video).toHaveAttribute('src', /[/]videos[/]web-es[.]mp4([?]v=[0-9]+)?$/)
  await expect(video).toHaveJSProperty('muted', true)
  await expect(video).toHaveAttribute('autoplay', '')
  await expect(video).toHaveAttribute('playsinline', '')
  await page.getByRole('button', { name: /Probarla ahora/ }).first().click()
  await expect(page).toHaveURL(/\/conductor\?vista=ruta/)
  await expect(page.getByText('Ruta de prueba con paradas de ejemplo. Se borra mañana.')).toBeVisible()
  await expect(page.getByText('Cliente 1 (prueba)')).toBeVisible()
  expect(fallos).toEqual([])
})

/* LA PORTADA DE REPARTIDORES EN PRUEBA A/B (06-10-2026): la versión b enseña primero la app y
   abre el alta al pulsar; las dos miden si la gente se queda (10 s) y si baja (la mitad). */
test('Anuncio · versión b: primero el vídeo, el alta se abre al pulsar y no promete cobrar sin tarjeta', async ({ page }) => {
  const fallos = vigilar(page)
  await simularApi(page, 'vacio')
  await page.goto('/repartidores?v=b', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('video')).toHaveCount(1)
  await expect(page.locator('form[aria-label="Crear mi cuenta gratis"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Crear mi cuenta gratis' }).click()
  await expect(page.getByRole('textbox', { name: 'Tu nombre' })).toBeFocused()
  await expect(page.getByText(/sin tarjeta no se cobra nunca/)).toBeVisible()
  await expect(page.getByText(/salvo cancelación/)).toHaveCount(0)
  expect(fallos).toEqual([])
})

test('Anuncio · versión a: el alta arriba, igual que antes', async ({ page }) => {
  await simularApi(page, 'vacio')
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('form[aria-label="Crear mi cuenta gratis"]')).toBeVisible()
  await expect(page.getByText(/salvo cancelación/)).toHaveCount(0)
})

test('Anuncio · mide si la gente se queda: a los 10 s y al llegar a la mitad', async ({ page }) => {
  await page.clock.install()
  await simularApi(page, 'vacio')
  const acciones = []
  await page.route(/\/api\/analitica\/evento/, (r) => {
    const j = r.request().postDataJSON()
    if (j && j.tipo === 'accion') acciones.push(j.nombre)
    return r.fulfill({ json: { ok: true } })
  })
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Tu ruta de reparto, ordenada sola.' })).toBeVisible()
  await page.clock.fastForward(11_000)
  await expect.poll(() => acciones).toContain('rep_10s')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => acciones).toContain('rep_mitad')
  expect(acciones.filter((a) => a === 'rep_10s')).toHaveLength(1)
})

/* ERRATA EN EL CORREO (10-10-2026): «gmial.com» sugiere «gmail.com» y un toque lo corrige. */
test('Portada repartidores · sugiere el correo bien escrito si hay una errata en el dominio', async ({ page }) => {
  await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })
  const correo = page.getByLabel('Tu correo')
  await correo.fill('pepe@gmial.com')
  await page.getByRole('button', { name: '¿Querías decir pepe@gmail.com?' }).click()
  await expect(correo).toHaveValue('pepe@gmail.com')
  await expect(page.getByRole('button', { name: /¿Querías decir/ })).toHaveCount(0)
  await correo.fill('pepe@empresa.es')
  await expect(page.getByRole('button', { name: /¿Querías decir/ })).toHaveCount(0)
})

/* «MI DINERO HOY» (11-10-2026): el autónomo pone su tarifa y la cabecera dice cuánto lleva ganado,
   la gasolina de lo hecho y el neto. */
test('Ruta · Mi dinero hoy: poner la tarifa y ver lo ganado', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  let gan = { pago_parada: 0, pago_dia: 0, coste_km: 0 }
  const guardado = []
  const hecho = (n) => ({ id: `h${n}`, cliente: `Cliente ${n}`, direccion: `Calle ${n}`, estado: 'entregado', orden: n, lat: 43.36, lng: -8.41 })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-11', jornada: {}, aviso_aceptado: true, ganancias: gan,
    ruta: { km: 20 }, pedidos: [hecho(1), hecho(2)] } }))
  await page.route(/\/api\/reparto\/ganancias/, async (r) => {
    guardado.push(r.request().postDataJSON())
    gan = r.request().postDataJSON()
    await r.fulfill({ json: gan })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pon tu tarifa/ }).click()
  const hoja = page.getByRole('dialog', { name: 'Mi dinero hoy' })
  await hoja.getByPlaceholder('1,10').fill('1,10')
  await hoja.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => guardado.length).toBe(1)
  expect(guardado[0]).toEqual({ pago_parada: 110, pago_dia: 0, coste_km: 12 })
  // 2 entregas × 1,10 € = 2,20 €; gasolina de lo hecho: 20 km × 2/2 × 0,12 € = 2,40 €.
  const tarjeta = page.getByRole('button', { name: 'Mi dinero hoy' })
  await expect(tarjeta).toContainText('2,20')
  await expect(tarjeta).toContainText('2,40')
  expect(fallos).toEqual([])
})

/* En Latinoamérica la tarifa va en su moneda y con sus miles: «2.500» pesos son 2500, no 2,5. */
test('Ruta · Mi dinero hoy en Colombia: en pesos y con punto de miles', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, pais: 'co', promo: { activa: true, hasta: '2026-12-31' } })
  const guardado = []
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, pais: 'co', fecha: '2026-10-11', jornada: {}, aviso_aceptado: true,
    ganancias: { pago_parada: 0, pago_dia: 0, coste_km: 0 }, ruta: { km: 20 },
    pedidos: [{ id: 'h1', cliente: 'Cliente 1', direccion: 'Calle 1', estado: 'entregado', orden: 1, lat: 4.6, lng: -74.08 }] } }))
  await page.route(/\/api\/reparto\/ganancias/, async (r) => { guardado.push(r.request().postDataJSON()); await r.fulfill({ json: r.request().postDataJSON() }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pon tu tarifa/ }).click()
  const hoja = page.getByRole('dialog', { name: 'Mi dinero hoy' })
  await expect(hoja.getByText(/Te pagan por cada entrega/)).not.toContainText('€')
  await expect(hoja.getByText('Pon lo que gasta tu vehículo por km. Solo lo ves tú.')).toBeVisible()
  await hoja.getByText(/Te pagan por cada entrega/).locator('..').getByRole('textbox').fill('2.500')
  await hoja.getByText(/Gasolina por km/).locator('..').getByRole('textbox').fill('450')
  await hoja.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => guardado.length).toBe(1)
  expect(guardado[0]).toEqual({ pago_parada: 250000, pago_dia: 0, coste_km: 45000 })
  expect(fallos).toEqual([])
})

/* LATINOAMÉRICA (11-10-2026): quien llega desde México ve con quién se reparte allí, no MRW ni Nacex. */
test.describe('Portada de repartidores desde México', () => {
  test.use({ locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  test('enseña las empresas de su país y «Invita y gana»', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    await page.goto('/repartidores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Mercado Libre', { exact: true })).toBeVisible()
    await expect(page.getByText('Estafeta', { exact: true })).toBeVisible()
    await expect(page.getByText('MRW', { exact: true })).toHaveCount(0)
    // Con la promoción (hasta el 31-12-2026), 10 € por su primera ruta y 10 € por compañero; después, 2,50 €.
    await expect(page.getByText(/Gana (10 € con tu primera ruta real y 10 €|2[,.]50 €) por cada compañero/).first()).toBeVisible()
    // Español de allí: «toma una foto», no «haz una foto» (lib/idioma.js, aLatam).
    await expect(page.getByText(/^Toma una foto a la etiqueta/).first()).toBeVisible()
    await expect(page.getByText(/Haz una foto a la etiqueta/)).toHaveCount(0)
    // «Probarla ahora» pide la demo con su país y su hora: paradas en Ciudad de México, no en A Coruña.
    const pedida = []
    await page.route(/\/api\/auth\/demo-reparto/, (r) => { pedida.push(r.request().postDataJSON()); r.fulfill({ status: 503, json: { detail: 'parada en el test' } }) })
    await page.getByRole('button', { name: 'Probarla ahora, sin registrarme' }).first().click()
    await expect.poll(() => pedida.length).toBe(1)
    expect(pedida[0]).toEqual({ rol: 'autonomo', pais: 'mx', zona_horaria: 'America/Mexico_City' })
    expect(fallos.filter((f) => !/503|parada en el test/.test(f))).toEqual([])
  })
})

/* BRASIL (11-10-2026): portugués de allí (senha, paradas, cadastro) y sus empresas. */
test.describe('Portada de repartidores desde Brasil', () => {
  test.use({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  test('habla como en Brasil y enseña sus empresas', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    await page.goto('/repartidores?v=a', { waitUntil: 'domcontentloaded' })      // la versión con el alta arriba
    await expect(page.getByPlaceholder('Senha')).toBeVisible()
    await expect(page.getByPlaceholder('Palavra-passe')).toHaveCount(0)
    await expect(page.getByText('Mercado Livre', { exact: true })).toBeVisible()
    await expect(page.getByText(/paragens/)).toHaveCount(0)
    expect(fallos).toEqual([])
  })
  // Gramática de Brasil, no solo palabras (11-10-2026): antes salía «guia-o por voz», «a app», «Ganha… que a use».
  test('la portada está escrita en portugués de Brasil (você, «o app»), no en el de Portugal', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    await page.goto('/repartidores', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Sua rota de entregas, organizada sozinha.' })).toBeVisible()
    await expect(page.getByText(/Tire uma foto da etiqueta ou escaneie o pacote: o app organiza as paradas/)).toBeVisible()
    await expect(page.getByText(/Ganhe .* por cada colega que usar o app/)).toBeVisible()
    const texto = await page.locator('body').innerText()
    expect(texto).not.toMatch(/guia-o|\ba app\b|Ganha |telemóvel|morada|paragem/)
    expect(fallos).toEqual([])
  })
})

/* «COMPARTE TU DÍA» (11-10-2026): al acabar la ruta, una imagen del día con SU QR de invitación. */
test('Ruta · Comparte tu día: al acabar, imagen con el enlace de invitación', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  await page.addInitScript(() => {
    window.__compartido = null
    navigator.canShare = () => true
    navigator.share = async (d) => { window.__compartido = { texto: d.text, tipo: d.files?.[0]?.type, tam: d.files?.[0]?.size } }
  })
  const hecho = (n) => ({ id: `h${n}`, cliente: `Cliente ${n}`, direccion: `Calle ${n}`, estado: 'entregado', orden: n, lat: 43.36, lng: -8.41 })
  const pedidos = [1, 2, 3, 4, 5].map(hecho)
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-11', aviso_aceptado: true,
    jornada: { empezada: '2026-10-11T07:00:00Z', terminada: '2026-10-11T10:30:00Z' }, ruta: { km: 42.5 }, pedidos } }))
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'ANA123', invitados: 0, premiados: 0, saldo: 0, ganado: 0 } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Comparte tu día' }).click()
  await expect.poll(() => page.evaluate(() => window.__compartido)).not.toBeNull()
  const c = await page.evaluate(() => window.__compartido)
  expect(c.tipo).toBe('image/png')
  expect(c.tam).toBeGreaterThan(10000)
  expect(c.texto).toContain('Hoy he hecho 5 paradas')
  expect(c.texto).toMatch(/\/invita\?ref=ANA123&utm_source=referido&utm_medium=dia/)
  expect(fallos).toEqual([])
})

/* Con paradas pendientes todavía no se ofrece. */
test('Ruta · Comparte tu día no sale con paradas pendientes', async ({ page }) => {
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  const p = (n, estado) => ({ id: `h${n}`, cliente: `Cliente ${n}`, direccion: `Calle ${n}`, estado, orden: n, lat: 43.36, lng: -8.41 })
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, fecha: '2026-10-11', aviso_aceptado: true, jornada: {}, ruta: { km: 10 },
    pedidos: [1, 2, 3, 4, 5].map((n) => p(n, 'entregado')).concat([p(6, 'pendiente')]) } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Cliente 6').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Comparte tu día' })).toHaveCount(0)
})

/* CALCULADORA (11-10-2026): página pública para Google; calcula con los números de cada uno. */
test('Calculadora repartidor · calcula lo que queda al mes y lleva a la app', async ({ page }) => {
  const fallos = vigilar(page)
  await page.goto('/calculadora-repartidor', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '¿Cuánto gana un repartidor autónomo?' })).toBeVisible()
  // 100 × 1,10 × 22 = 2420; 120 × 0,15 × 22 = 396; 2420 − 396 − 600 = 1424 (en español, sin punto con 4 cifras)
  const resultado = page.getByRole('region', { name: 'Resultado' })
  await expect(resultado).toContainText('1424 €')
  await page.getByLabel('Paradas entregadas al día').fill('120')
  await expect(resultado).toContainText('1908 €')
  await expect(page.getByRole('link', { name: /Probar FDS gratis/ })).toHaveAttribute('href', /utm_source=calculadora/)
  expect(fallos).toEqual([])
})

/* RECORRIDO DE BIENVENIDA (11-10-2026): la primera vez que el autónomo abre su ruta vacía. */
/* LA PRIMERA VEZ (17-10 → 23-10-2026): «¿Tienes ya tus paradas de hoy?». Sí → «¿Cómo te llegan las paradas?» y
   cada forma abre su herramienta (etiquetas → la carga; lista de WhatsApp → pegar); todavía no → el ejemplo (y el
   aviso de mañana si el móvil lo admite) o los 3 pasos. Sale una vez. Sin paradas, el hueco vacío de la ruta enseña
   las mismas formas (antes era una frase y el botón grande del ejemplo). */
test('Ruta · la primera vez pregunta cómo le llegan las paradas y abre esa herramienta; todavía no ofrece el ejemplo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, promo: { activa: true, hasta: '2026-12-31' } })
  // El admin de la cuenta puede pegar listas (como en producción): salen las cuatro formas.
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: { activo: true, autonomo: true, puede_pegar: true, fecha: '2026-10-04', pedidos: [], jornada: {}, aviso_aceptado: true } }))
  await page.addInitScript(() => localStorage.removeItem('fds_tour_ruta'))
  let ejemplo = 0
  await page.route(/\/api\/reparto\/mis-pedidos\/ejemplo/, async (r) => { ejemplo += 1; await r.fulfill({ json: { ok: true, n: 3 } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const hoja = page.getByRole('dialog', { name: 'Te damos la bienvenida a FDS' })
  await expect(hoja.getByText('¿Tienes ya tus paradas de hoy?')).toBeVisible()
  await hoja.getByRole('button', { name: 'Sí, cargarlas ahora' }).click()
  await expect(hoja.getByText('¿Cómo te llegan las paradas?')).toBeVisible()
  await hoja.getByRole('button', { name: /Etiquetas en los paquetes/ }).click()
  await expect(page.getByRole('dialog', { name: 'Cargar paquetes' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fds_tour_ruta'))).toBe('1')
  // Una lista de WhatsApp o Excel abre la caja de pegar.
  await page.evaluate(() => localStorage.removeItem('fds_tour_ruta'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await hoja.getByRole('button', { name: 'Sí, cargarlas ahora' }).click()
  await hoja.getByRole('button', { name: /Una lista en WhatsApp, Excel o correo/ }).click()
  await expect(page.getByRole('dialog', { name: 'Pegar una lista de direcciones' })).toBeVisible()
  // Otra vez desde cero: «Todavía no» lleva al ejemplo y a los 3 pasos.
  await page.evaluate(() => localStorage.removeItem('fds_tour_ruta'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await hoja.getByRole('button', { name: 'Todavía no' }).click()
  await expect(hoja.getByText(/Cuando cargues la furgoneta, abre la app/)).toBeVisible()
  await hoja.getByRole('button', { name: 'Ver cómo funciona en 3 pasos' }).click()
  const pasos = page.getByRole('dialog', { name: 'Así funciona' })
  await expect(pasos.getByText('1. Mete tus paquetes')).toBeVisible()
  await pasos.getByRole('button', { name: 'Cerrar' }).click()
  // Sin paradas, el hueco vacío es la acción misma: las formas de cargar, y la hoja en papel va a la foto de la hoja.
  await expect(page.getByText('Carga tus paradas de hoy')).toBeVisible()
  await page.getByRole('button', { name: /Una hoja de reparto en papel/ }).click()
  await expect(page.getByRole('dialog', { name: 'Pegar una lista de direcciones' })).toBeVisible()
  await expect(page.getByText('Pulsa «Foto de la hoja» y se leen todas las paradas de golpe.')).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('fds_tour_ruta'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await hoja.getByRole('button', { name: 'Todavía no' }).click()
  await hoja.getByRole('button', { name: 'Mientras, verlo en acción con 3 paradas de ejemplo' }).click()
  await expect.poll(() => ejemplo).toBe(1)
  await expect(hoja).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* LA RUTA EN MARCHA (17-10-2026): con paradas, añadir va en el botón «+» (hoja con todo), el bono en una línea y
   «con qué navegar» se elige en Ajustes. */
test('Ruta · con la ruta en marcha, añadir va en el «+» y el navegador se elige en Ajustes', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-17', jornada: {}, aviso_aceptado: true,
    bono: { cent: 1000, pagado: false, hasta: '2026-12-31', objetivo: 20, dias_objetivo: 2, entregas: 3, dias: 0 },
    pedidos: [{ id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5', estado: 'pendiente', orden: 1, lat: 43.37, lng: -8.40 },
      { id: 'p2', cliente: 'Bar Pepe', direccion: 'Rúa Nova 2', estado: 'pendiente', orden: 2, lat: 43.36, lng: -8.41 }] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: null } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Siguiente parada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escanear', exact: true })).toHaveCount(0)      // no estorba arriba
  await expect(page.getByTestId('bono')).toContainText('3/20')
  await expect(page.getByLabel('Navegador')).toHaveCount(0)                                       // ni «Ir con» en la lista
  await page.getByRole('button', { name: 'Añadir paradas' }).click()
  const hoja = page.getByRole('dialog', { name: 'Añadir paradas' })
  await expect(hoja.getByRole('button', { name: 'Escanear', exact: true })).toBeVisible()
  await expect(hoja.getByPlaceholder('o escribe el código')).toBeVisible()
  await hoja.getByRole('button', { name: /Añadir un pedido sin código/ }).click()
  await expect(hoja).toHaveCount(0)                                                               // se cierra al elegir
  await page.keyboard.press('Escape')
  // Con qué navegar, en Ajustes; se recuerda y «Ir» abre Waze.
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('Navegador').selectOption('waze')
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  const primera = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(primera.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', 'https://waze.com/ul?ll=43.37,-8.4&navigate=yes')
  expect(fallos).toEqual([])
})

/* INVITA Y GANA EN LATINOAMÉRICA (11-10-2026): fuera de España se cobra por PayPal. */
test('Cartera · fuera de España se cobra por PayPal', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 6, pais: 'mx', promo: { activa: true, hasta: '2026-12-31' } })
  // Sin promoción (el servidor no manda promo_hasta): 2,50 € y ningún aviso de promoción.
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'MX1234', invitados: 5, premiados: 4, saldo: 6000, ganado: 6000,
    por_invitado: 250, retirada_min: 6000, entregas_cartera: 20, dias_distintos: 2, pendiente: false, retiradas: [], cartera: true, metodos: ['paypal'] } }))
  const pedidos = []
  await page.route(/\/api\/cartera\/retirar/, async (r) => { pedidos.push(r.request().postDataJSON()); await r.fulfill({ json: { ok: true } }) })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Gana 2,50 € por cada compañero que la use/)).toBeVisible()
  await expect(page.getByText(/Promo hasta el/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  const cartera = page.getByRole('region', { name: 'Tu cartera' })
  await expect(cartera.getByText(/Lo cobras por PayPal\./)).toBeVisible()
  await expect(cartera.getByText(/Promoción/)).toHaveCount(0)
  await cartera.getByRole('button', { name: 'Cobrar 60 €' }).click()
  await expect(cartera.getByRole('button', { name: 'Bizum' })).toHaveCount(0)
  await cartera.getByPlaceholder('Nombre y apellidos del titular').fill('Juan Pérez')
  await cartera.getByPlaceholder('Correo de tu PayPal').fill('juan@correo.mx')
  await cartera.getByRole('button', { name: 'Pedir el pago de 60 €' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ titular: 'Juan Pérez', metodo: 'paypal', destino: 'juan@correo.mx' })
  expect(fallos).toEqual([])
})

/* OPINIÓN DE LOS REPARTIDORES (17-10-2026). El correo «¿Qué tal te va?» se contesta con un clic sin entrar:
   abrir el enlace NO guarda nada (lo abren los antivirus del correo); cuenta al pulsar «Enviar». La pregunta
   abierta es la de la necesidad: qué le complica el día de reparto. Y «Mándanos una idea», siempre en Cuenta. */
test.describe('Opinión de los repartidores', () => {
  async function correo(page, estado) {
    const r = { enviado: null }
    await page.route(/\/api\/opinion\/correo/, async (ruta) => {
      if (ruta.request().method() === 'POST') { r.enviado = ruta.request().postDataJSON(); return ruta.fulfill({ json: { ok: true } }) }
      return ruta.fulfill(estado ? { json: estado } : { status: 404, json: { detail: 'Este enlace no es válido' } })
    })
    return r
  }

  test('desde el correo, la nota viene marcada y solo cuenta al pulsar Enviar', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    const r = await correo(page, { usa: true, ya: false })
    await page.goto('/opinion?o=o1&t=firma&utm_source=correo&utm_content=opinion&r=4', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '¿Qué tal te va la app?' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '4 · Bien' })).toHaveAttribute('aria-checked', 'true')
    expect(r.enviado).toBeNull()                                                // abrir el enlace no cuenta
    await page.getByLabel('¿Qué es lo que más te complica en tu día de reparto? (opcional)').fill('Los portales sin número')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText('¡Gracias! Lo leo yo personalmente.')).toBeVisible()
    expect(r.enviado).toEqual({ o: 'o1', t: 'firma', valor: 4, texto: 'Los portales sin número' })
    expect(fallos).toEqual([])
  })

  test('desde el correo, qué le frenó; y si no supo cargar paquetes, cómo se hace', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    const r = await correo(page, { usa: false, ya: false })
    await page.goto('/opinion?o=o1&t=firma&m=no_supe', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '¿Qué te frenó?' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'No supe cómo meter los paquetes' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText('«Cargar paquetes: uno tras otro»')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir la app' })).toHaveAttribute('href', '/ruta')
    expect(r.enviado).toEqual({ o: 'o1', t: 'firma', texto: '', motivo: 'no_supe' })
    expect(fallos).toEqual([])
  })

  test('un enlace que no vale lo dice y no deja enviar', async ({ page }) => {
    const fallos = vigilar(page)
    await simularApi(page, 'vacio')
    await correo(page, null)
    await page.goto('/opinion?o=o1&t=mala&r=5', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('contacto@flotadsp.com')
    await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('en Cuenta, «Mándanos una idea» se puede mandar siempre', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
    let enviado = null
    await page.route(/\/api\/opinion$/, async (ruta) => { enviado = ruta.request().postDataJSON(); await ruta.fulfill({ json: { ok: true } }) })
    await page.goto('/ruta?tab=cuenta', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Mándanos una idea/ }).click()
    await page.getByRole('textbox', { name: 'Mándanos una idea' }).fill('Que avise si un cliente cierra a mediodía')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText('¡Recibido! Gracias.')).toBeVisible()
    expect(enviado).toEqual({ tipo: 'sugerencia', texto: 'Que avise si un cliente cierra a mediodía' })
    expect(fallos).toEqual([])
  })

  test('Negocio enseña las opiniones y qué les frena', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/admin\/opiniones/, (ruta) => ruta.fulfill({ json: {
      opiniones: [
        { id: 'a', org: 'Pepe', email: 'pepe@x.es', valor: 2, texto: 'Se me cierra con la cámara', tipo: 'opinion', origen: 'correo', paradas: 40, entregas: 35, ts: '2026-10-18T09:00:00+00:00' },
        { id: 'b', org: 'Ana', email: 'ana@x.es', motivo: 'no_supe', texto: '', tipo: 'opinion', origen: 'correo', paradas: 0, entregas: 0, ts: '2026-10-18T08:00:00+00:00' },
        { id: 'c', org: 'Luis', texto: 'Modo noche', tipo: 'sugerencia', origen: 'app', paradas: 3, entregas: 2, ts: '2026-10-17T20:00:00+00:00' },
      ],
      resumen: { total: 3, media: 2, con_nota: 1, con_texto: 2, pedidas_por_correo: 12, motivos: [{ motivo: 'no_supe', texto: 'No supe cómo meter los paquetes', n: 1 }] },
    } }))
    await page.goto('/panel/admin?s=opiniones', { waitUntil: 'domcontentloaded' })
    const s = page.getByRole('region', { name: 'Opiniones de los repartidores' })
    await expect(s.getByText('Se me cierra con la cámara')).toBeVisible()
    await expect(s.getByText('No supe cómo meter los paquetes · 1')).toBeVisible()
    await expect(s.getByRole('link', { name: 'Contestar' }).first()).toHaveAttribute('href', 'mailto:pepe@x.es')
    await expect(s.getByText('Idea', { exact: true })).toBeVisible()
    await expect(s.getByText('2 de 5 (1)')).toBeVisible()
    expect(fallos).toEqual([])
  })
})

/* REGALO DE SALDO (17-10-2026, Dani: «añádeles 10 € de saldo a todo el mundo para que vea que es real»). Se ve
   al abrir la app (una vez), en la cartera, y se cobra con las reglas de siempre (desde 60 €). */
test('Regalo · 10 € en la cartera: aviso en Hoy una vez, línea en la cartera y se cobra desde 60 €', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarRepartidor(page, { status: 'trial', days_left: 60, promo: { activa: true, hasta: '2026-12-31' } })
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: {
    codigo: 'ABCD1234', invitados: 0, premiados: 0, saldo: 1000, ganado: 1000, regalo: 1000, regalo_clave: '2026-10-17',
    por_invitado: 1000, retirada_min: 6000, promo_hasta: '2026-12-31', promo_cent: 1000, cartera: true,
    metodos: ['bizum', 'iban', 'paypal'], entregas_cartera: 20, dias_distintos: 2, pendiente: false, retiradas: [],
    bono: { cent: 1000, pagado: false, hasta: '2026-12-31', objetivo: 20, dias_objetivo: 2 },
  } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const aviso = page.getByTestId('aviso-regalo')
  await expect(aviso).toContainText('Te hemos regalado 10 €: ya están en tu cartera.')
  await aviso.getByRole('button', { name: 'Verlo' }).click()
  const cartera = page.getByRole('region', { name: 'Tu cartera' })
  await expect(cartera.getByTestId('cartera-regalo')).toContainText('Regalo: 10 € ya en tu saldo')
  await expect(cartera.getByTestId('cartera-bono')).toContainText('Bono de bienvenida')        // el bono sigue aparte
  await cartera.getByRole('button', { name: 'Cobrar 10 €' }).click()
  await expect(page.getByText('Se puede cobrar a partir de 60 €. Te faltan 50 €.')).toBeVisible()
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })                                // ya lo ha visto
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByTestId('aviso-regalo')).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* PORTAL DEL CONDUCTOR EN CASILLAS (17-10-2026). La auditoría a lo ancho; lo demás en casillas de tres.
   «Comparte y gana» ya no es una tarjeta enorme en el inicio: es una casilla que abre la cartera.
   «Mis turnos» se abre a quien tiene turnos cargados (OGA5) y dice «Pronto» a quien no. */
test.describe('Portal del conductor · casillas', () => {
  async function entrarConductor(page, turnos) {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/shifts\/mine/, (r) => r.fulfill({ json: { shifts: turnos, sin_ver: [], requests: [] } }))
    await page.route(/\/api\/conductor\/referidos/, (r) => r.fulfill({ json: {
      enlace: 'https://flotadsp.com/invita?ref=ABCD', saldo: 0, invitados: 0, premiados: 0, por_invitado: 1000,
      metodos: ['bizum', 'iban'], retirada_min: 6000, retiradas: [], pendiente: false } }))
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Pedir días libres').first()).toBeVisible({ timeout: 15000 })
  }

  test('la cartera es una casilla que abre su pantalla y se vuelve', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarConductor(page, [{ date: '2026-10-20', type: 'trabaja' }])
    await expect(page.getByRole('region', { name: 'Invita a probar Flota' })).toHaveCount(0)   // ya no ocupa el inicio
    await page.getByRole('button', { name: /Comparte y gana/ }).click()
    await expect(page.getByRole('region', { name: 'Invita a probar Flota' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(page.getByRole('button', { name: /Hacer la auditoría/ })).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('«Mis turnos» se abre a quien tiene turnos cargados', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarConductor(page, [{ date: '2026-10-20', type: 'trabaja' }])
    await expect(page.getByRole('button', { name: /Mis turnos/ })).toBeEnabled()
    expect(fallos).toEqual([])
  })

  test('«Mis turnos» es el mes en calendario: cada día con su color, y al tocarlo se ve y se pide', async ({ page }) => {
    const fallos = vigilar(page)
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hoy = new Date()
    const pedidas = []
    await entrarConductor(page, [{ date: iso(hoy), type: 'trabaja', cod: '1' }])
    await page.route(/\/api\/shift-requests/, (r) => {
      if (r.request().method() === 'POST') pedidas.push(r.request().postDataJSON())
      return r.fulfill({ json: { ok: true, auto: false } })
    })
    await page.getByRole('button', { name: /Mis turnos/ }).click()
    const cal = page.getByTestId('mis-turnos')
    await expect(cal.getByText('L', { exact: true })).toBeVisible()                // la semana empieza en lunes
    await expect(cal.getByText('D', { exact: true })).toBeVisible()
    const dias = cal.locator('button[aria-pressed]')
    await expect(dias).toHaveCount(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate())   // el mes entero
    await expect(cal.getByRole('button', { name: /: Trabajas$/ })).toHaveAttribute('aria-pressed', 'true')  // hoy, marcado
    await expect(page.getByText('Trabajas', { exact: true }).last()).toBeVisible()
    await page.getByRole('button', { name: 'Pedir', exact: true }).click()
    await page.getByRole('button', { name: 'Pedir libre' }).click()
    await expect(page.getByText('Solicitud enviada, pendiente de aprobación')).toBeVisible()
    expect(pedidas.length).toBe(1)
    await cal.getByRole('button', { name: 'Mes siguiente' }).click()
    await expect(dias.first()).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('«Mis turnos» dice «Pronto» a quien todavía no tiene turnos', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarConductor(page, [])
    await expect(page.getByRole('button', { name: /Mis turnos/ })).toBeDisabled()
    await expect(page.getByText('Pronto')).toBeVisible()
    expect(fallos).toEqual([])
  })
})

/* EL MERCADILLO (17-10-2026). API simulada: lo que se prueba aquí es la pantalla (que se entienda, que mande lo
   que tiene que mandar y que no rompa); las reglas (aprobar, quién ve qué, fotos limpias) las prueba el
   servidor en backend/tests/test_mercadillo.py. */
test.describe('Mercadillo de repartidores', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64')
  const LISTAS = {
    categorias: { movil: 'Móviles y electrónica', furgoneta: 'Furgoneta y accesorios', herramientas: 'Herramientas y carga', ropa: 'Ropa de trabajo', otros: 'Otras cosas' },
    estados_articulo: { nuevo: 'Nuevo', como_nuevo: 'Como nuevo', buen_estado: 'Buen estado', con_marcas: 'Con marcas de uso' },
    motivos_denuncia: { prohibido: 'Está prohibido o es ilegal', estafa: 'Es un engaño o una posible estafa', otro: 'Otra cosa' },
  }
  const IPHONE = { id: 'a1', titulo: 'iPhone 18 Pro · 256 GB', descripcion: 'Con su caja.', precio_cent: 130000, categoria: 'movil',
    estado_articulo: 'como_nuevo', zona: 'A Coruña', fotos: ['f1', 'f2'], estado: 'publicado', mio: false,
    publicado_en: '2026-10-17T10:00:00+00:00', vendedor: { nombre: 'Dani · FDS', tipo: 'fds' } }

  async function simular(page, { anuncios = [], mios = [], abierto = true, sinLeer = 0 } = {}) {
    const r = { creado: null, contacto: null, denuncia: null, respuesta: null, subidas: 0 }
    await page.route(/\/api\/mercadillo\/estado/, (x) => x.fulfill({ json: { visible: true, abierto, sin_leer: sinLeer, yo: { nombre: 'Ana P.', tipo: 'conductor' } } }))
    await page.route(/\/api\/mercadillo\/foto\//, (x) => x.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await page.route(/\/api\/mercadillo\/fotos/, (x) => { r.subidas += 1; return x.fulfill({ json: { id: `nueva${r.subidas}`, bytes: 1000 } }) })
    await page.route(/\/api\/mercadillo(\?.*)?$/, async (x) => {
      if (x.request().method() === 'POST') { r.creado = x.request().postDataJSON(); return x.fulfill({ json: { id: 'n1', estado: 'pendiente' } }) }
      return x.fulfill({ json: { anuncios, mios, ...LISTAS, activos_max: 3, dias: 30, yo: { nombre: 'Ana P.', tipo: 'conductor' } } })
    })
    await page.route(/\/api\/mercadillo\/anuncio\/a1$/, (x) => x.fulfill({ json: { ...IPHONE, conversacion_id: null } }))
    await page.route(/\/api\/mercadillo\/anuncio\/a1\/contactar/, (x) => { r.contacto = x.request().postDataJSON(); return x.fulfill({ json: { ok: true, conversacion_id: 'c1' } }) })
    await page.route(/\/api\/mercadillo\/conversacion\/c1$/, async (x) => {
      if (x.request().method() === 'POST') { r.respuesta = x.request().postDataJSON(); return x.fulfill({ json: { id: 'm2', mio: true, texto: r.respuesta.texto, ts: '2026-10-17T18:01:00+00:00' } }) }
      return x.fulfill({ json: { id: 'c1', soy: 'comprador', con: 'Dani · FDS', bloqueada: false, anuncio: IPHONE,
        mensajes: [{ id: 'm1', mio: true, texto: 'Hola, ¿sigue disponible?', ts: '2026-10-17T18:00:00+00:00' }] } })
    })
    await page.route(/\/api\/mercadillo\/buzon/, (x) => x.fulfill({ json: {
      conversaciones: [{ id: 'c1', anuncio_id: 'a1', titulo: IPHONE.titulo, precio_cent: 130000, foto: 'f1', estado_anuncio: 'publicado',
        con: 'Luis G.', soy: 'vendedor', ultimo: '2026-10-17T18:00:00+00:00', ultimo_texto: '¿Me lo dejas en 1.200?', sin_leer: true }],
      avisos: [{ id: 'v1', texto: 'Tu anuncio «Gorra» ya está publicado.', ts: '2026-10-17T12:00:00+00:00', leido: false }] } }))
    await page.route(/\/api\/mercadillo\/avisos\/leidos/, (x) => x.fulfill({ json: { ok: true } }))
    await page.route(/\/api\/mercadillo\/denunciar/, (x) => { r.denuncia = x.request().postDataJSON(); return x.fulfill({ json: { ok: true } }) })
    return r
  }

  test('vista previa de Dani: aviso de que está oculto y vender con foto, que entra en revisión', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    const r = await simular(page, { abierto: false })
    await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Vista previa: los repartidores todavía no lo ven/)).toBeVisible()
    await expect(page.getByText('Todavía no hay nada a la venta')).toBeVisible()
    await page.getByRole('button', { name: /Vender algo que no uses/ }).click()
    await page.getByLabel('Añadir fotos').setInputFiles({ name: 'iphone.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('button', { name: 'Quitar la foto 1' })).toBeVisible()
    await page.getByLabel(/Qué vendes/).fill('iPhone 18 Pro · 256 GB')
    await page.getByLabel(/Precio/).fill('1.300')
    await page.getByRole('button', { name: 'Móviles y electrónica' }).click()
    await page.getByRole('button', { name: 'Como nuevo' }).click()
    await page.getByLabel(/Zona/).fill('A Coruña')
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText(/Enviado\. Lo revisamos/)).toBeVisible()
    expect(r.creado).toMatchObject({ titulo: 'iPhone 18 Pro · 256 GB', precio: '1.300', categoria: 'movil',
      estado_articulo: 'como_nuevo', zona: 'A Coruña', fotos: ['nueva1'], acepto: true })
    expect(fallos).toEqual([])
  })

  test('ficha del anuncio: «Me interesa» manda el mensaje y abre la conversación', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    const r = await simular(page, { anuncios: [IPHONE] })
    await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /iPhone 18 Pro/ }).click()
    await expect(page.getByText('1.300 €').first()).toBeVisible()
    await expect(page.getByText('Como nuevo')).toBeVisible()
    await expect(page.getByText(/No pagues nunca por adelantado/)).toBeVisible()
    await page.getByRole('button', { name: 'Me interesa' }).click()
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Hola, ¿sigue disponible?')).toBeVisible()
    expect(r.contacto).toEqual({ texto: 'Hola, ¿sigue disponible?' })
    await page.getByLabel('Escribe un mensaje').fill('¿Quedamos mañana?')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('¿Quedamos mañana?')).toBeVisible()
    expect(r.respuesta).toEqual({ texto: '¿Quedamos mañana?' })
    expect(fallos).toEqual([])
  })

  test('denunciar un anuncio y el buzón con avisos y mensajes sin leer', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    const r = await simular(page, { anuncios: [IPHONE], sinLeer: 2 })
    await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /iPhone 18 Pro/ }).click()
    await page.getByRole('button', { name: 'Denunciar anuncio' }).click()
    await page.getByRole('radio', { name: 'Es un engaño o una posible estafa' }).click()
    await page.getByLabel('Explícalo').fill('Pide Bizum por adelantado')
    await page.getByRole('button', { name: 'Enviar denuncia' }).click()
    await expect(page.getByText(/Recibido\. Lo revisamos/)).toBeVisible()
    expect(r.denuncia).toEqual({ anuncio_id: 'a1', motivo: 'estafa', texto: 'Pide Bizum por adelantado' })
    await page.getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Volver' }).click()
    await page.getByRole('button', { name: 'Mensajes, 2 sin leer' }).click()
    await expect(page.getByText('Tu anuncio «Gorra» ya está publicado.')).toBeVisible()
    await expect(page.getByText('¿Me lo dejas en 1.200?')).toBeVisible()
    await expect(page.getByLabel('Sin leer')).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('en el portal del conductor sale la casilla solo si está abierto', async ({ page }) => {
    const fallos = vigilar(page)
    const exp = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'd1', role: 'driver', name: 'ANA PÉREZ', exp })}.firma`
    await page.addInitScript((tk) => {
      localStorage.setItem('flota_driver_token', tk)
      localStorage.setItem('flota_driver', JSON.stringify({ id: 'd1', name: 'ANA PÉREZ', center: 'OGA5' }))
      localStorage.setItem('cookie_consent', '1')
    }, token)
    await simularApi(page, 'vacio')
    await simular(page, { anuncios: [IPHONE], sinLeer: 1 })
    await page.goto('/conductor', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Mercadillo/ }).click()
    await expect(page.getByRole('button', { name: /iPhone 18 Pro/ })).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).first().click()
    await expect(page.getByRole('button', { name: /Hacer la auditoría/ })).toBeVisible()
    await page.unroute(/\/api\/mercadillo\/estado/)
    await page.route(/\/api\/mercadillo\/estado/, (x) => x.fulfill({ json: { visible: false } }))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Pedir días libres').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Mercadillo/ })).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test('Negocio: encenderlo, aprobar y rechazar con motivo', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    const hechos = []
    await page.route(/\/api\/mercadillo\/foto\//, (x) => x.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await page.route(/\/api\/admin\/mercadillo$/, (x) => x.fulfill({ json: {
      conf: { visible: false }, publicados: [], denuncias: [],
      por_revisar: [{ ...IPHONE, estado: 'pendiente', vendedor: { nombre: 'Ana P.', tipo: 'conductor', clave: 'd:owner:d1' } },
        { ...IPHONE, id: 'a2', titulo: 'Escáner de la nave', estado: 'pendiente', vendedor: { nombre: 'Luis G.', tipo: 'conductor' } }],
      motivos_rechazo: { empresa: 'Parece material de una empresa…', otro: 'No cumple las normas del mercadillo.' },
      motivos_denuncia: LISTAS.motivos_denuncia, categorias: LISTAS.categorias, estados_articulo: LISTAS.estados_articulo,
      totales: { por_revisar: 2, publicados: 0, denuncias: 0, conversaciones: 0, vendidos: 0 } } }))
    await page.route(/\/api\/admin\/mercadillo\/(visible|anuncio\/.*)/, (x) => {
      hechos.push([x.request().url().split('/api/admin/mercadillo/')[1], x.request().postDataJSON()])
      return x.fulfill({ json: { ok: true, visible: true } })
    })
    page.on('dialog', (d) => d.accept())
    await page.goto('/panel/admin?s=mercadillo', { waitUntil: 'domcontentloaded' })
    const s = page.getByRole('region', { name: 'Mercadillo de repartidores' })
    await expect(s.getByText(/Oculto: solo lo ves tú/)).toBeVisible()
    await expect(s.getByRole('link', { name: /Verlo como repartidor/ })).toHaveAttribute('href', '/mercadillo')
    await s.getByRole('button', { name: 'Aprobar' }).first().click()
    await expect.poll(() => hechos.length).toBe(1)
    expect(hechos[0]).toEqual(['anuncio/a1', { accion: 'aprobar' }])
    const rechazar = s.getByRole('button', { name: 'Rechazar' }).nth(1)
    await expect(rechazar).toBeDisabled()
    await s.getByLabel('Motivo').nth(1).selectOption('empresa')
    await s.getByLabel('Nota').nth(1).fill('Es de la nave')
    await rechazar.click()
    await expect.poll(() => hechos.length).toBe(2)
    expect(hechos[1]).toEqual(['anuncio/a2', { accion: 'rechazar', motivo: 'empresa', nota: 'Es de la nave' }])
    await s.getByRole('button', { name: 'Hacerlo visible para todos' }).click()
    await expect.poll(() => hechos.length).toBe(3)
    expect(hechos[2]).toEqual(['visible', { visible: true }])
    expect(fallos).toEqual([])
  })
})

test('Panel · la casilla del mercadillo sale a la oficina solo si está abierto', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  let visible = true
  await page.route(/\/api\/mercadillo\/estado/, (x) => x.fulfill({ json: visible ? { visible: true, abierto: true, sin_leer: 2 } : { visible: false } }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const casilla = page.getByRole('button', { name: /^Mercadillo\. 2 sin leer/ })
  await expect(casilla).toBeVisible()
  visible = false
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /^Vehículos/ })).toBeVisible()
  await page.waitForTimeout(400)
  await expect(page.getByRole('button', { name: /^Mercadillo/ })).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* EL INICIO EN CASILLAS (17-10-2026). Dani: «cámbiame el dashboard y añade este estilo de iconos». */
test('Inicio · casillas con su número; lo urgente con globito y cada una lleva a su pantalla', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  await page.route(/\/api\/alerts\/itv/, (x) => x.fulfill({ json: [{ vehicle_id: 'v1', plate: '1234ABC', status: 'caducada' }, { vehicle_id: 'v2', plate: '5678DEF', status: 'proxima' }] }))
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const venc = page.getByRole('button', { name: /^Vencimientos\. 1 ITV vencida/ })
  await expect(venc).toBeVisible()
  await expect(venc).toContainText('1')
  for (const n of ['Vehículos', 'Revisión rápida', 'Asignación diaria', 'Inspecciones', 'Incidencias', 'Talleres', 'Conductores']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${n}`) })).toBeVisible()
  }
  await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
  // La lista de decisiones ya no se repite debajo: lo urgente va en las casillas.
  await venc.click()
  await expect(page).toHaveURL(/\/panel\/vencimientos/)
  expect(fallos).toEqual([])
})

/* En el móvil, la IA ya no tapa «Menú» de la barra de abajo (Dani, 17-10-2026: «es muy incómodo»). */
test('Panel en el móvil · la burbuja de la IA queda por encima de la barra de abajo', async ({ page }) => {
  const fallos = vigilar(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const menu = page.getByRole('button', { name: 'Menú', exact: true }).last()
  await expect(menu).toBeVisible()
  const barra = await menu.boundingBox()
  const burbuja = page.getByTitle(/IA$/).last()                         // el botón de la IA (icono, con su título)
  const caja = await burbuja.boundingBox()
  expect(caja.y + caja.height).toBeLessThanOrEqual(barra.y)              // no la pisa
  // Y «Menú» se puede pulsar.
  await menu.click()
  expect(fallos).toEqual([])
})

test('Mercadillo · avisos al móvil: se activan si el móvil deja y, si no, dice por qué', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page, { superAdmin: true })
  await simularApi(page, 'vacio')
  // El permiso y la suscripción del navegador, simulados (en las pruebas no hay servicio de avisos de verdad).
  await page.addInitScript(() => {
    window.__permiso = 'granted'
    window.Notification = { requestPermission: async () => window.__permiso, permission: 'default' }
    const sub = { endpoint: 'https://push.example/1', toJSON: () => ({ endpoint: 'https://push.example/1', keys: {} }) }
    const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub } }
    Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true })
    window.PushManager = function PushManager() {}
  })
  const hechos = []
  await page.route(/\/api\/push\/vapid-key/, (x) => x.fulfill({ json: { enabled: true, key: 'AAAA' } }))
  await page.route(/\/api\/push\/subscribe/, (x) => { hechos.push('suscrito'); return x.fulfill({ json: { ok: true } }) })
  await page.route(/\/api\/mercadillo\/estado/, (x) => x.fulfill({ json: { visible: true, abierto: true, sin_leer: 0, avisos_movil: false } }))
  await page.route(/\/api\/mercadillo(\?.*)?$/, (x) => x.fulfill({ json: { anuncios: [], mios: [], categorias: {}, estados_articulo: {}, motivos_denuncia: {} } }))
  await page.route(/\/api\/mercadillo\/buzon/, (x) => x.fulfill({ json: { conversaciones: [], avisos: [] } }))
  await page.route(/\/api\/mercadillo\/avisos-movil/, (x) => { hechos.push(x.request().postDataJSON()); return x.fulfill({ json: { avisos_movil: x.request().postDataJSON().activo } }) })
  await page.goto('/mercadillo', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Mensajes' }).click()
  const interruptor = page.getByRole('switch', { name: 'Avisarme en el móvil' })
  await expect(interruptor).not.toBeChecked()
  await interruptor.check()
  await expect(interruptor).toBeChecked()
  expect(hechos).toEqual(['suscrito', { activo: true }])
  await interruptor.uncheck()
  await expect(interruptor).not.toBeChecked()
  expect(hechos[2]).toEqual({ activo: false })
  await page.evaluate(() => { window.__permiso = 'denied' })
  await interruptor.click()                                       // (check() esperaría a que quede marcado)
  await expect(page.getByRole('alert')).toContainText('bloqueados los avisos')
  await expect(interruptor).not.toBeChecked()
  expect(fallos).toEqual([])
})

/* NEGOCIO EN CASILLAS (17-10-2026). Dani: «ordénamelo en cuadraditos que clique y entre». */
test('Negocio · casillas con lo que hay que hacer; se entra, se vuelve y el enlace lleva directo', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page, { superAdmin: true })
  await simularApi(page, 'vacio')
  await page.route(/\/api\/admin\/mercadillo$/, (x) => x.fulfill({ json: { conf: { visible: true }, por_revisar: [], publicados: [], denuncias: [],
    motivos_rechazo: {}, motivos_denuncia: {}, categorias: {}, estados_articulo: {}, avisos: { activo: false, movil: false },
    totales: { por_revisar: 2, publicados: 1, denuncias: 1, conversaciones: 1, vendidos: 0 } } }))
  await page.route(/\/api\/admin\/cartera\/retiradas/, (x) => x.fulfill({ json: { retiradas: [{ id: 'r1', estado: 'pendiente', importe: 6000, invitados: [] }] } }))
  await page.goto('/panel/admin', { waitUntil: 'domcontentloaded' })
  const merc = page.getByRole('button', { name: /^Mercadillo\. 3 por revisar/ })
  await expect(merc).toBeVisible()
  await expect(merc).toContainText('3')
  await expect(page.getByRole('button', { name: /^Pagos de la cartera\. 1 por pagar/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Empresas/ })).toBeVisible()
  await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)                 // con datos a medias, nunca «undefined»
  // Nada de listados en el inicio: solo casillas.
  await expect(page.getByRole('region', { name: 'Mercadillo de repartidores' })).toHaveCount(0)
  await merc.click()
  await expect(page).toHaveURL(/\/panel\/admin\?s=mercadillo$/)
  await expect(page.getByRole('region', { name: 'Mercadillo de repartidores' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Avisarme en el móvil' })).toBeVisible()
  await page.getByRole('button', { name: 'Negocio', exact: true }).click()
  await expect(page).toHaveURL(/\/panel\/admin$/)
  await expect(page.getByRole('button', { name: /^Opiniones/ })).toBeVisible()
  expect(fallos).toEqual([])
})

/* ESTADO DE LA FLOTA (17-10-2026). Lo que se prueba aquí es la pantalla: de la peor a la mejor con su puesto,
   los números que filtran, la ficha con las fotos y los daños, y que «Mandar al taller» abra en Órdenes el parte
   ya redactado. El baremo (qué cuenta y cuánto) lo prueba el servidor en backend/tests/test_salud_flota.py. */
test.describe('Estado de la flota', () => {
  const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='
  const hoy = new Date().toISOString().slice(0, 10)
  const furgo = (id, matricula, salud, nivel, extra = {}) => ({
    vehicle_id: id, matricula, modelo: 'Toyota Proace', center: 'NORTE', salud, puntos: 100 - salud, nivel,
    urgencias: [], zonas: [], resumen: 'Sin daños pendientes', danos: 0, confirmados: 0, sin_confirmar: 0,
    mecanica: [], averias: 0, itv_vencida: false, itv_dias: null, portada: null,
    ultima: { fecha: hoy, dias: 0, conductor: 'Ana', km: 52854 }, ...extra,
  })
  const PEOR = furgo('v1', '1111 AAA', 34, 'urgente', {
    resumen: 'Lateral derecho grave · Lateral izquierdo grave · Motor', danos: 3, mecanica: ['Motor'], itv_vencida: true,
    zonas: [{ zona: 'lat_der', nombre: 'Lateral derecho', peor: 'grave', n: 2 }, { zona: 'lat_izq', nombre: 'Lateral izquierdo', peor: 'grave', n: 1 }],
  })
  const LISTA = {
    // Desordenada a propósito: el orden lo pone la pantalla.
    furgonetas: [furgo('v2', '2222 BBB', 100, 'bien'), PEOR, furgo('v3', '3333 CCC', 74, 'taller', { resumen: 'Frontal grave' })],
    en_taller: [{ vehicle_id: 'v9', matricula: '9999 ZZZ', center: 'NORTE', orden: 'OT-7', taller: 'Talleres Pepe', estado: 'En reparación', entrega: null }],
    niveles: { urgente: 1, taller: 1, vigilar: 0, bien: 1, sin_datos: 0 }, salud_media: 69, evaluadas: 3, itv_vencida: 1,
    baremo: { urgente: 45, taller: 22, vigilar: 7 },
  }
  const PARTE = 'Lateral izquierdo: Puerta delantera izquierda (grave)\nAvisa el conductor: Motor'
  const FICHA = {
    ...PEOR, mecanica: [{ categoria: 'motor', nombre: 'Motor', puntos: 18, urgente: false, origen: 'nota' }],
    motivos: [{ puntos: 18, texto: 'Puerta delantera izquierda: grave' }, { puntos: 18, texto: 'Motor: lo escribe el conductor' }],
    ultima: { ...PEOR.ultima, nota: 'Luz motor encendida', id: 'i1', circulation_safe: true },
    fotos: [{ vista: 'frontal', nombre: 'Frontal', url: FOTO, anotada: null },
            { vista: 'lateral_izq', nombre: 'Lateral izquierdo', url: FOTO, anotada: FOTO }],
    danos_detalle: [{ zona: 'Lateral izquierdo', pieza: 'Puerta delantera izquierda', severity: 'grave', gravedad: 'grave',
                      humano: true, en_ultima: true, desde: '2026-07-01', foto: FOTO, foto_fecha: hoy }],
    averias_detalle: [], checklist_mal: [{ item: 'Espejos', valor: 'dañado' }], notas_anteriores: [],
    parte: PARTE, en_taller: null, itv_fecha: '2025-01-01',
  }

  async function abrir(page) {
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/estado-flota(\?|$)/, (r) => r.fulfill({ json: LISTA }))
    await page.route(/\/api\/estado-flota\/v1/, (r) => r.fulfill({ json: FICHA }))
    await page.route(/\/api\/work-orders\/preparar\/v1/, (r) => r.fulfill({ json: {
      vehicle_id: 'v1', matricula: '1111 AAA', sugerido: 'w1', problema: 'grave: Puerta corredera izquierda',
      falta_problema: false, ledger_ids: ['l1'], danos: [], talleres: [{ id: 'w1', name: 'Talleres Pepe' }] } }))
    await page.goto('/panel/estado-flota', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Estado de la flota' })).toBeVisible({ timeout: 15000 })
  }
  const tarjetas = async (page) => (await page.getByRole('button', { name: /\d{4} [A-Z]{3}/ }).allInnerTexts())
    .map((x) => x.match(/\d{4} [A-Z]{3}/)[0])

  test('de la peor a la mejor, con su puesto, y los números filtran', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page)
    expect(await tarjetas(page)).toEqual(['1111 AAA', '3333 CCC', '2222 BBB'])
    await expect(page.getByRole('button', { name: /1111 AAA/ })).toContainText('#1')
    await expect(page.getByRole('button', { name: /1111 AAA/ })).toContainText('ITV vencida en la ficha')
    await page.getByRole('button', { name: /^1\s*Taller urgente/ }).click()
    expect(await tarjetas(page)).toEqual(['1111 AAA'])
    await page.getByRole('combobox', { name: 'Ordenar' }).selectOption('mejor')
    await page.getByRole('button', { name: /^1\s*Taller urgente/ }).click()          // quita el filtro
    expect(await tarjetas(page)).toEqual(['2222 BBB', '3333 CCC', '1111 AAA'])
    await expect(page.getByRole('button', { name: /2222 BBB/ })).toContainText('#3')   // el puesto no cambia al ordenar
    await expect(page.getByText('Ya en el taller (1)')).toBeVisible()
    await expect(page.getByText('9999 ZZZ')).toBeVisible()
    expect(fallos).toEqual([])
  })

  test('la ficha enseña las fotos y los daños, y «Mandar al taller» abre el parte redactado', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page)
    await page.getByRole('button', { name: /1111 AAA/ }).click()
    const ficha = page.getByRole('dialog', { name: 'Estado de 1111 AAA' })
    await expect(ficha.getByText('Fotos de la última inspección')).toBeVisible()
    await expect(ficha.getByRole('button', { name: 'Ampliar: Puerta delantera izquierda' })).toBeVisible()   // el daño, con su foto
    await expect(ficha.getByText('«Luz motor encendida»')).toBeVisible()
    await expect(ficha.getByText('Checklist: Espejos dañado')).toBeVisible()
    await expect(page).toHaveURL(/[?&]v=v1/)
    // Una foto a pantalla completa; Escape cierra la foto y no la ficha.
    await ficha.getByRole('button', { name: 'Ampliar: Frontal' }).click()
    await expect(page.getByRole('dialog', { name: 'Foto ampliada' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Foto ampliada' })).toHaveCount(0)
    await expect(ficha).toBeVisible()
    await ficha.getByRole('button', { name: /Mandar al taller/ }).click()
    await expect(page).toHaveURL(/\/panel\/ordenes$/)
    await expect(page.locator('textarea')).toHaveValue(PARTE)
    expect(fallos).toEqual([])
  })
})

/* CENTRO DE IA (19-10-2026). API simulada: se prueba la pantalla —preguntar, ver los pasos mientras piensa, la
   respuesta con formato y confirmar una propuesta—; la IA y sus herramientas las prueba backend/tests/test_centro_ia.py. */
test.describe('Centro de IA', () => {
  const json = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  test('se pregunta, se ven los pasos, contesta y una propuesta se confirma con un botón', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    const enviados = []
    const decididas = []
    let conv = { id: 'c1', titulo: 'Conversación nueva', estado: 'lista', vista: [], propuestas: {}, coste_usd: 0 }
    let vueltas = 0
    await page.route(/\/api\/centro-ia\/estado/, json({ configurada: true, modelo: 'Claude Sonnet 5.5', gastado_hoy_usd: 0.12, tope_diario_usd: 5 }))
    await page.route(/\/api\/centro-ia\/conversaciones$/, (route) => (route.request().method() === 'POST'
      ? json(conv)(route) : json({ conversaciones: conv.vista.length ? [{ id: 'c1', titulo: conv.titulo, actualizado_en: new Date().toISOString() }] : [] })(route)))
    await page.route(/\/api\/centro-ia\/conversaciones\/c1\/mensaje/, (route) => {
      enviados.push(route.request().postDataJSON())
      conv = { ...conv, titulo: 'Mañana nos piden 44', estado: 'pensando',
        vista: [{ tipo: 'usuario', texto: 'Mañana nos piden 44' }, { tipo: 'paso', texto: 'Miro el cuadrante (NORTE, 20/10 → 20/10)' }] }
      return json({ ok: true })(route)
    })
    await page.route(/\/api\/centro-ia\/conversaciones\/c1$/, (route) => {
      vueltas += 1
      if (conv.estado === 'pensando' && vueltas > 2) {
        conv = { ...conv, estado: 'lista', vista: [...conv.vista,
          { tipo: 'ia', texto: 'Mañana sacan ruta **48**: sobran 4.\n- Pongo N/T a cuatro que ya iban a 6 días seguidos.' },
          { tipo: 'propuesta', id: 'p1' }],
        propuestas: { p1: { id: 'p1', titulo: 'Cuadrante de NORTE: 4 cambios', estado: 'pendiente', aviso: '',
          lineas: ['Amazon pide 44', 'ANA PÉREZ — mar 20/10: 1 → N/T'] } } }
      }
      return json(conv)(route)
    })
    await page.route(/\/api\/centro-ia\/conversaciones\/c1\/propuestas\/p1/, (route) => {
      decididas.push(route.request().postDataJSON())
      conv = { ...conv, propuestas: { p1: { ...conv.propuestas.p1, estado: 'hecha', por: 'Admin Test' } } }
      return json({ ok: true, estado: 'hecha' })(route)
    })
    await page.goto('/panel/centro-ia', { waitUntil: 'domcontentloaded' })
    const v = page.getByTestId('centro-ia')
    await expect(v.getByRole('heading', { name: 'Centro de IA' })).toBeVisible({ timeout: 15000 })
    await expect(v.getByText('Hoy: 0.12 $ de 5 $')).toBeVisible()
    await expect(v.getByRole('button', { name: '¿Hay alguien con dos fichas en NORTE?' })).toBeVisible()
    await v.getByLabel('Mensaje para la IA').fill('Mañana nos piden 44')
    await v.getByLabel('Mensaje para la IA').press('Enter')
    await expect(v.getByText('Miro el cuadrante (NORTE, 20/10 → 20/10)')).toBeVisible()
    expect(enviados).toEqual([{ texto: 'Mañana nos piden 44', center: 'NORTE' }])
    await expect(v.getByText('sobran 4.')).toBeVisible({ timeout: 10000 })
    await expect(v.locator('b', { hasText: '48' })).toBeVisible()                        // la negrita se pinta
    await expect(v.getByText('1 consulta')).toBeVisible()                                 // los pasos, plegados
    const p = v.getByTestId('propuesta')
    await expect(p.getByText('ANA PÉREZ — mar 20/10: 1 → N/T')).toBeVisible()
    await p.getByRole('button', { name: 'Confirmar' }).click()
    await expect(p.getByText('Hecho · Admin Test')).toBeVisible()
    expect(decididas).toEqual([{ accion: 'confirmar' }])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('una empresa cliente no lo ve en el menú ni puede abrirlo', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await page.goto('/panel/centro-ia', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/centro-ia/, { timeout: 15000 })
    await expect(page.getByRole('link', { name: 'Centro de IA' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
