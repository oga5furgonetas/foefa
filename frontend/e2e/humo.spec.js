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

test('Reparto · sin dictado en el navegador, el micro lleva al del teclado; un código con dirección la rellena', async ({ page }) => {
  const fallos = vigilar(page)
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await rutaDeAna(page, [])
  await page.route(/\/api\/reparto\/escanear/, (r) => r.fulfill({ json: { encontrado: false, codigo: 'GLS123' } }))
  await page.goto('/conductor?vista=ruta', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('o escribe el código').fill('GLS123|Rúa Real 5|15003 A Coruña|Marta|612345678')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await expect(hoja.getByPlaceholder('Dirección completa')).toHaveValue(/Rúa Real 5.*15003/)
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

test.describe('Alta desde el navegador de TikTok (Android)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36 musical_ly_2023607030 BytedanceWebview/d8a21c6' })
  test('le dice dónde está, saca un pase para abrir Chrome y ofrece el APK', async ({ page }) => {
    await entrarRepartidor(page, { status: 'trial', days_left: 7, required: false })
    await page.addInitScript(() => localStorage.setItem('fds_recien_alta', '1'))
    let pases = 0
    await page.route(/\/api\/auth\/pase-movil$/, (r) => { pases += 1; return r.fulfill({ json: { pase: 'p1', minutos: 10 } }) })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const paso = page.getByRole('dialog', { name: 'Último paso: instala la app' })
    await expect(paso.getByText('Estás en el navegador de TikTok: desde aquí el móvil no deja instalar nada.')).toBeVisible()
    await expect(paso.getByRole('link', { name: 'Descargar la app para Android' })).toHaveAttribute('href', '/descargas/FDS.apk')
    await paso.getByRole('button', { name: 'Abrir en Chrome' }).click()
    await expect(paso.getByText(/¿No se ha abierto\? Pulsa ⋮/)).toBeVisible({ timeout: 6000 })
    expect(pases).toBe(1)
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你的车队')
  await expect(page).toHaveTitle(/中文配送 App/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { name: /用中文的配送 App/ })).toBeVisible()
  await expect(page.getByText('管理后台目前提供西班牙语', { exact: false })).toBeVisible()   // no promete el panel en chino
  await expect(page.getByRole('button', { name: '知道了' })).toBeVisible()                   // cookies en chino
  await page.getByRole('link', { name: /开始免费试用/ }).click()
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
