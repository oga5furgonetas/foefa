/* API simulada para las pruebas de humo.

   Devuelve respuestas con la MISMA forma que el backend real. La gracia de
   simularla es poder probar dos escenarios que en producción no se pueden
   forzar a voluntad:
     · "vacio"   — empresa recién registrada, todo a cero (donde más se rompen las
                   pantallas: divisiones por cero, listas indefinidas…)
     · "lleno"   — flota con datos, para que se pinten tablas y tarjetas
*/

const HOY = new Date().toISOString().slice(0, 10)

const VEHICULO = {
  id: 'v1', license_plate: '1234 ABC', brand: 'Toyota', model: 'Proace',
  center: 'NORTE', status: 'active', mileage: 45000, fuel_type: 'Diésel',
  vehicle_type: 'Furgoneta', itv_date: '2027-03-15', renting_end_date: '2027-12-01',
}
const CONDUCTOR = {
  id: 'd1', name: 'Ana López', email: 'ana@transportes-ruiz.es', center: 'NORTE',
  active: true, phone: '600111222',
}
const INSPECCION = {
  id: 'i1', vehicle_id: 'v1', driver_id: 'd1', created_at: `${HOY}T08:30:00Z`,
  photos: [], analysis_status: 'ok', deleted: false,
  analysis: {
    severity: 'moderado', summary: 'Dos daños', total_damages_count: 2,
    total_estimated_cost: 760,
    // Uno por gestionar y otro ya cerrado: el barrido prueba los dos estados
    damages: [
      { part: 'Puerta lateral izquierda', severity: 'moderado', estimated_cost: 420,
        description: 'Bollo con arañazo de unos 15 cm' },
      { part: 'Paragolpes trasero', severity: 'leve', estimated_cost: 340,
        actual_cost: 298, repair_status: 'done', workshop_id: 'w1' },
    ],
  },
}

/* Respuesta por defecto según el final de la ruta. Cualquier endpoint no
   contemplado devuelve algo inofensivo en vez de romper la pantalla. */
const dentroDe = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

function respuesta(ruta, escenario) {
  const lleno = escenario === 'lleno'
  const t = {
    '/admin/cobros': {
      mes: '2026-08',
      resumen: { facturado: 732.05, cobrado: 387.2, pendiente: 344.85, en_prueba: 0 },
      cobros: [
        { id: 'c1', org_nombre: 'Transportes Ruiz SL', plan: 'completo', vehiculos: 40, base: 320, total: 387.2, estado: 'cobrado' },
        { id: 'c2', org_nombre: 'Logística Vega', plan: 'operacion', vehiculos: 25, base: 125, total: 151.25, estado: 'pendiente' },
        { id: 'c3', org_nombre: 'Reparto Norte SL', plan: 'completo', vehiculos: 30, base: 240, total: 290.4, estado: 'en_prueba' },
      ],
    },
    '/admin/planes': {
      moneda: 'EUR', descuento_anual_meses: 2, iva_pct: 21,
      planes: [
        { clave: 'operacion', nombre: 'Operación', para: 'Un centro', por_vehiculo: 5, minimo_vehiculos: 20 },
        { clave: 'completo', nombre: 'Completo', para: 'Varios centros', por_vehiculo: 8, minimo_vehiculos: 20, recomendado: true },
        { clave: 'holding', nombre: 'Holding', para: 'Cinco sedes o más', por_vehiculo: 0, minimo_vehiculos: 0 },
      ],
    },
    '/suggested-workshops': {
      workshops: [{ id: 'w1', name: 'Toyota Compostela' },
                  { id: 'w2', name: 'Chapistería Riazor' },
                  { id: 'w3', name: 'Carglass Santiago' }],
      total_matched: 3,
    },
    // Va ANTES que '/vehicles': el emparejador de abajo es `ruta.includes(clave)`
    // y para "/vehicles/faltan" ambas claves casan, así que la más específica
    // tiene que aparecer primero o nunca se alcanza (server.py siempre devuelve
    // resumen y campos; sin este mock caía en el `{}` de defecto y «Revisar
    // datos» reventaba con `Object.entries(undefined)`).
    '/vehicles/faltan': {
      activas: lleno ? 1 : 0,
      resumen: lleno ? { itv_date: 0, insurance_date: 1, oil_last_change_km: 1,
                         oil_interval_km: 0, mileage: 0, model: 0, brand: 0, vin: 1 } : {},
      campos: {
        itv_date: 'Fecha de ITV', insurance_date: 'Fecha del seguro',
        oil_last_change_km: 'Km del último cambio de aceite',
        oil_interval_km: 'Cada cuántos km toca el aceite',
        mileage: 'Kilometraje', model: 'Modelo', brand: 'Marca', vin: 'VIN',
      },
    },
    '/vehicles': lleno ? [VEHICULO] : [],
    // Igual que '/vehicles/faltan' arriba: va ANTES que '/drivers', que si no
    // la tapa. Formas reales de server.py — todas devuelven listas
    // vacías cuando no hay nada, nunca `undefined`, así que sin este mock caían
    // en el `{}` de defecto y los paneles de Conductores reventaban con
    // `Cannot read properties of undefined (reading 'map')`.
    '/drivers/duplicados': { grupos: [], total: 0, fichas_de_mas: 0 },
    '/drivers': lleno ? [CONDUCTOR] : [],
    '/inspections': lleno ? [INSPECCION] : [],
    '/incidents': [],
    '/alerts/itv': [],
    '/alerts/renting': [],
    '/workshops': [],
    '/contacts': [],
    '/rentals': [],
    '/onboarding': {
      pasos: [
        { id: 'vehiculos', hecho: lleno, n: lleno ? 1 : 0 },
        { id: 'conductores', hecho: lleno, n: lleno ? 1 : 0 },
        { id: 'inspeccion', hecho: lleno, n: lleno ? 1 : 0 },
      ],
      hechos: lleno ? 3 : 0, total: 3, completo: lleno,
    },
    /* El dia de la flota (/stats/hoy). Con datos: una salida revisada y otra
       sin revisar, para que la portada pinte los dos estados. */
    '/stats/hoy': lleno ? {
      dia: HOY,
      salidas: { total: 2, revisadas: 1, lista: [
        { vehicle_id: 'v2', matricula: '5678 DEF', conductor: 'Luis Pérez', ruta: 'ZONA 3', center: 'NORTE', revisada: false, gravedad: null },
        { vehicle_id: 'v1', matricula: '1234 ABC', conductor: 'Ana López', ruta: 'ZONA 1', center: 'NORTE', revisada: true, gravedad: 'moderado' },
      ] },
      revision: { hechas: 1, flota: 2 },
      checklist: [{ turno: 'manana', hechas: 5, total: 7 }],
      golpes: { n: 2, lista: [] },
      incidencias: { nuevas: 1, graves: 0 },
    } : {
      dia: HOY, salidas: { total: 0, revisadas: 0, lista: [] }, revision: { hechas: 0, flota: 0 },
      checklist: [], golpes: { n: 0, lista: [] }, incidencias: { nuevas: 0, graves: 0 },
    },
    // La forma REAL de /stats/dashboard (server.py): con otra, la portada no
    // pinta nada y la prueba no ve lo que ve un cliente.
    '/stats/dashboard': {
      total_vehicles: lleno ? 2 : 0, vehicles_in_workshop: 0, total_drivers: lleno ? 2 : 0,
      total_inspections: lleno ? 14 : 0, unread_alerts: 0, open_incidents: lleno ? 1 : 0,
      severity_breakdown: lleno ? { sin_danos: 9, leve: 3, moderado: 2, grave: 0, critico: 0 } : {},
      weekly_activity: lleno ? { [HOY]: { inspecciones: 1, danos: 1 } } : {},
    },
    '/stats/damage-costs': { total_eur: 0, por_conductor: [] },
    '/vehicles/last-inspections': [],
    '/inspections/review-queue': [],
    '/parking/state': { layout: { zones: [] }, day: HOY, assignments: [] },
    '/assignments/daily': { date: HOY, slots: [] },
    '/checklist': { items: [], date: HOY },
    '/chat': { messages: [] },
    '/shifts/mine': {
      shifts: [0, 1, 2, 4, 5].map((i) => ({ date: dentroDe(i), type: i === 4 ? 'extra' : 'trabaja' })),
      requests: [{ id: 'r1', date: dentroDe(3), type: 'libre', status: 'pendiente' }],
    },
    '/shifts/coverage': { coverage: {}, min: 2 },
    '/shifts/generate-auto': { success: true, assignments: [], resumen: 'Cuadrante de prueba', coverage: {} },
    '/shifts/import': { success: true, saved: 0 },
    '/shifts/bulk': { success: true, saved: 0 },
    '/shifts': { shifts: [] },
    '/shift-requests': { requests: [] },
    '/route-demand': { demand: {} },
    '/me': { id: 'a1', name: 'Admin Test', role: 'admin' },
  }
  for (const [clave, valor] of Object.entries(t)) {
    if (ruta.includes(clave)) return valor
  }
  return {}   // nada explota por un endpoint no contemplado
}

export async function simularApi(page, escenario = 'vacio') {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(respuesta(url.pathname, escenario)),
    })
  })
}

/* Sesión de administrador ya iniciada.

   OJO: el token TIENE que ser un JWT con la forma correcta. La app lee su
   payload para saber si la sesión sigue viva (isAuthed) y si es super-admin.
   Con una cadena cualquiera, el panel redirige a /panel/login... y como esa
   pantalla también tiene texto, las pruebas pasarían sin haber entrado nunca.
   Ya pasó: 30 pruebas en verde que en realidad no probaban nada. */
function jwtDePrueba(payload) {
  const b64 = (o) => btoa(JSON.stringify(o))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  // La firma no importa: la valida el backend, y aquí el backend está simulado.
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma-de-prueba`
}

export async function entrarComoAdmin(page, { superAdmin = false, centros = ['NORTE'] } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  await page.addInitScript(
    ({ token, centros, superAdmin }) => {
      localStorage.setItem('flotia_token', token)
      localStorage.setItem('flotia_admin', JSON.stringify({
        id: 'a1', name: 'Admin Test', role: 'admin',
        centers: centros, super_admin: superAdmin,
      }))
      // UN SOLO centro a proposito: con varios, el selector se queda en
      // "Todos" y media docena de pantallas solo dicen "elige un centro",
      // asi que el barrido no probaria nada de su contenido real.
      localStorage.setItem('panel_center', centros[0])
      localStorage.setItem('flota_lang', 'es')
      // Nombres reales de CookieBanner.jsx y Ayuda.jsx: sin esto los dos
      // overlays de bienvenida (el segundo es `fixed inset-0 z-[80]`, a
      // pantalla completa) tapan todos los botones y el barrido no pulsa
      // ninguno en ninguna pantalla.
      localStorage.setItem('cookie_consent', '1')
      localStorage.setItem('ayuda_vista_a1', '1')
    },
    {
      centros,
      superAdmin,
      token: jwtDePrueba({
        sub: 'a1', role: 'admin', name: 'Admin Test', exp,
        org_id: 'org1', db_name: 'test_db', centers: centros,
        ...(superAdmin ? { sa: true } : {}),
      }),
    },
  )
}
