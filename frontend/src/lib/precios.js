/* LOS PLANES PARA EMPRESAS, EN UN SOLO SITIO (06-10-2026). Antes la página de precios y el
   alta tenían cada una su copia y se descuadraban (la web decía mínimo 15 y el alta 20).
   El porqué de cada precio está en docs/PRECIOS.md; el servidor manda (/billing/planes) y
   esto es el respaldo si no contesta. Las claves no cambian: hay cuentas con ellas. */

export const PLANES_EMPRESA = [
  {
    clave: 'operacion', nombre: 'Esencial', para: 'Una delegación',
    por_vehiculo: 5, minimo_vehiculos: 10, color: '#64748b',
    incluye: [
      'Vehículos, documentos y vencimientos (ITV, seguro, renting)',
      'Inspección diaria con fotos y daños detectados por IA',
      'Incidencias, talleres y órdenes de reparación con su coste',
      'Conductores y su portal en el móvil',
      'Chat interno, importar de Excel y avisos por correo',
      'Usuarios y conductores ilimitados',
    ],
    no_incluye: ['Quién causa los golpes', 'Qué furgoneta lleva cada uno', 'Cuadrante, turnos y días libres', 'Informe pericial firmado', 'Varias delegaciones'],
  },
  {
    clave: 'completo', nombre: 'Pro', para: 'Varias delegaciones y la operación diaria',
    por_vehiculo: 9, minimo_vehiculos: 20, recomendado: true, color: '#fb923c',
    incluye: [
      'Todo lo de Esencial, con delegaciones ilimitadas y un jefe por delegación',
      'Revisión rápida de daños y quién causa los golpes',
      'Qué furgoneta lleva cada uno: asignación y furgonetas fijas',
      'Cuadrante con motor, turnos y días libres desde el móvil',
      'Plantilla de salida, checklist de apertura y cierre, aparcamiento',
      'Incorporaciones, empleo y contactos',
      'Informe pericial firmado, sin límite, para reclamar al renting o al seguro',
      'Exportar a Excel',
    ],
    no_incluye: [],
  },
  {
    clave: 'holding', nombre: 'Empresa', para: '100 vehículos o más',
    por_vehiculo: 0, minimo_vehiculos: 0, desde: 12, color: '#a78bfa',
    incluye: [
      'Todo lo de Pro',
      'WhatsApp con conductores y talleres (2.000 mensajes al mes)',
      'API de solo lectura para sacar flota y taller a vuestros sistemas',
      'Implantación y formación por delegación incluidas',
      'Soporte prioritario con persona asignada',
    ],
    no_incluye: [],
  },
]

/* REPARTO (06-10-2026): el súper o el distribuidor compra el reparto por REPARTIDOR, no la flota por
   furgoneta: tiene 2–4 furgonetas por tienda y con Esencial (mínimo 10) pagaba furgonetas que no
   existen. 12 € por repartidor activo al mes (el que tuvo pedidos), mínimo 3, furgonetas incluidas.
   Si quieren lo de Pro (quién causa los golpes, cuadrante), ese es Pro por vehículo + la app a 6 €. */
export const PLAN_REPARTO = {
  clave: 'reparto', nombre: 'Reparto', para: 'Súper y distribución: por repartidor, furgonetas incluidas',
  por_repartidor: 12, minimo_repartidores: 3, color: '#22c55e', sectores: ['supermercado', 'distribucion'],
  incluye: [
    'Pedidos sin límite: a mano, pegados de vuestro programa o escaneando la caja',
    'Zonas por repartidor y ruta ordenada por tiempo, con franjas y hora estimada',
    'Navegación con voz, prueba de entrega con foto y cobro a la entrega',
    'Enlace de seguimiento para el cliente',
    'La oficina ve el progreso y dónde va cada repartidor en jornada',
    'Vuestras furgonetas incluidas: fichas, ITV y seguro, inspección con fotos e IA, taller',
    'Tiendas o almacenes y usuarios sin límite',
  ],
  no_incluye: ['Quién causa los golpes, cuadrante y asignación (eso es Pro, por vehículo)'],
}

export const DESCUENTOS_VOLUMEN = [{ desde: 50, pct: 10 }, { desde: 150, pct: 15 }, { desde: 300, pct: 20 }]

/** Porcentaje de descuento por tamaño de flota. */
export function descuentoVolumen(n, tramos = DESCUENTOS_VOLUMEN) {
  let pct = 0
  for (const t of tramos) if (Number(n) >= t.desde) pct = t.pct
  return pct
}

/* La unidad que se cobra: el repartidor activo en Reparto, la furgoneta en los demás. */
const unidad = (p) => (p.por_repartidor
  ? { precio: Number(p.por_repartidor), minimo: p.minimo_repartidores || 0 }
  : { precio: Number(p.por_vehiculo) || 0, minimo: p.minimo_vehiculos || 0 })

/** Lo que paga al mes con `unidades` (furgonetas o repartidores) en ese plan: mínimo y
    descuento por volumen. 0 = a medida. */
export function precioMes(p, unidades, tramos) {
  if (p.mensual) return p.mensual
  const u = unidad(p)
  if (!u.precio) return 0
  const n = Math.max(Number(unidades) || 0, u.minimo)
  return Math.round(u.precio * n * (100 - descuentoVolumen(n, tramos))) / 100
}

/** Precio por unidad (vehículo o repartidor) ya con el descuento por volumen. */
export function precioVehiculo(p, unidades, tramos) {
  const u = unidad(p)
  const n = Math.max(Number(unidades) || 0, u.minimo)
  return Math.round(u.precio * (100 - descuentoVolumen(n, tramos))) / 100
}

/* PLAN GRATIS DEL REPARTIDOR (10-10-2026): sin pagar, hasta estas paradas nuevas al día
   (REP_GRATIS_PARADAS_DIA en server.py; /billing/planes la devuelve como `paradas_gratis`). */
export const PARADAS_GRATIS = 15

/* Pagando un año se pagan 10 meses: dos salen gratis. */
export const MESES_ANUAL = 10

export const eur = (n) => (Number.isInteger(n) ? n.toLocaleString('es-ES') : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export const COMPLEMENTOS = [
  { clave: 'reparto', nombre: 'App de reparto', precio: '6 € por conductor que la use en el mes',
    que: 'Para los planes de flota (Esencial, Pro y Empresa): escanear o foto a la etiqueta, ruta ordenada por tiempo, navegación, prueba de entrega, seguimiento para el cliente y cobro. Súper y distribución la llevan incluida en el plan Reparto.' },
  { clave: 'whatsapp', nombre: 'WhatsApp', precio: '150 € de alta + mensajes a precio de Meta + 20 %',
    que: 'Avisos y conversaciones con conductores y talleres desde vuestro número. Incluido en Empresa.' },
  { clave: 'colaboradores', nombre: 'Vehículos de colaboradores', precio: '3 € por vehículo y mes',
    que: 'Furgonetas de subcontratas: inspección, documentos y vencimientos. Se marcan en la ficha.' },
  { clave: 'campana', nombre: 'Vehículos de campaña', precio: '0,30 € por día de alta',
    que: 'Furgonetas de refuerzo en Black Friday o Navidad, solo los días que estén. Se cobran a mes vencido.' },
  { clave: 'implantacion', nombre: 'Implantación asistida', precio: '490 € hasta 50 vehículos · 990 € hasta 200',
    que: 'Cargamos flota y conductores, configuramos delegaciones y permisos y formamos al equipo. Gratis con contrato anual de 100 vehículos o más.' },
  { clave: 'formacion', nombre: 'Formación presencial', precio: '300 € por jornada + desplazamiento',
    que: 'En vuestras delegaciones.' },
]

/* Las reglas que siempre se preguntan (docs/PRECIOS.md §6). */
export const REGLAS = [
  ['¿Qué vehículo cuenta?', 'Los que tienes de alta el día que se hace la factura del mes. Los que están en el taller cuentan; los dados de baja, no.'],
  ['¿Pago por usuario o por conductor?', 'No. Usuarios de oficina y conductores ilimitados en todos los planes: se paga por vehículo. Solo el reparto va por repartidor: como complemento (6 €) en los planes de flota, o como plan Reparto (12 €, furgonetas incluidas) si sois un súper o un distribuidor.'],
  ['¿Y si la flota crece o baja a mitad de mes?', 'Ese mes no se toca: la factura siguiente ya sale con los vehículos que tengas. Nunca se cobra a toro pasado.'],
  ['¿Furgonetas de subcontratas o de campaña?', 'Se marcan en la ficha de cada una: las de colaboradores a 3 € al mes y las de campaña a 0,30 € por día que estén, fuera del plan.'],
  ['¿Tengo permanencia?', 'Mensual: no, cancelas cuando quieras. Anual: un año, con 2 meses gratis.'],
  ['¿Mis datos?', 'Son tuyos. Si os vais, os los devolvemos o los borramos, lo que elijáis: lo dice el contrato de encargo del tratamiento, que va incluido.'],
]
