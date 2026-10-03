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
  ['', 'Dashboard'], ['mi-dia', 'Mi día'], ['chat', 'Chat'],
  ['vehiculos', 'Vehículos'], ['inspecciones', 'Inspecciones'],
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
  ['/', 'Landing'], ['/login', 'Login'], ['/planes', 'Planes'],
  ['/registro', 'Registro'], ['/contacto', 'Contacto'],
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
    await expect(page.getByText('ve 7 de 30 pantallas')).toBeVisible()
    await page.getByRole('button', { name: 'Quién ve cada pantalla' }).click()
    const fila = (nombre) => page.locator('tr', { has: page.locator('td', { hasText: new RegExp(`^${nombre}$`) }) })
    // Mery: el Cuadrante sí y los Días libres no (van cada uno por su lado);
    // las Órdenes, no (van con Talleres, que no tiene).
    await expect(fila('Cuadrante').locator('td').nth(2).getByLabel('la ve')).toBeVisible()
    await expect(fila('Días libres').locator('td').nth(2).getByLabel('no la ve')).toBeVisible()
    await expect(fila('Órdenes de taller').locator('td').nth(2).getByLabel('no la ve')).toBeVisible()
    await expect(fila('Asignación diaria').locator('td').nth(2)).toHaveText('siempre')
    await expect(fila('Vehículos').locator('td').nth(3).getByLabel('la ve')).toBeVisible()
    await page.getByRole('button', { name: 'Editar' }).first().click()
    await expect(page.getByText('Ve 7 de 30 pantallas del menú.')).toBeVisible()
    await expect(page.getByText('· va con Talleres')).toBeVisible()
    // El Cuadrante se marca y desmarca como cualquier otra.
    const cuadrante = page.getByRole('button', { name: 'Cuadrante', exact: true })
    await expect(cuadrante).toHaveAttribute('aria-pressed', 'true')
    await cuadrante.click()
    await expect(cuadrante).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Ve 6 de 30 pantallas del menú.')).toBeVisible()
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
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/ticket.png')
  await expect(page.getByPlaceholder('Dirección completa')).toHaveValue(/Juana de Vega 14/, { timeout: 60000 })
  await expect(page.getByPlaceholder('Dirección completa')).toHaveValue(/15004/)
  await expect(page.getByPlaceholder('Teléfono')).toHaveValue('981123456')
  expect(alServidor).toEqual([])
})
