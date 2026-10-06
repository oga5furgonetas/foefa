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

export const DESCUENTOS_VOLUMEN = [{ desde: 50, pct: 10 }, { desde: 150, pct: 15 }, { desde: 300, pct: 20 }]

/** Porcentaje de descuento por tamaño de flota. */
export function descuentoVolumen(n, tramos = DESCUENTOS_VOLUMEN) {
  let pct = 0
  for (const t of tramos) if (Number(n) >= t.desde) pct = t.pct
  return pct
}

/** Lo que paga al mes esa flota en ese plan: mínimo y descuento por volumen. 0 = a medida. */
export function precioMes(p, furgonetas, tramos) {
  if (p.mensual) return p.mensual
  if (!p.por_vehiculo) return 0
  const n = Math.max(Number(furgonetas) || 0, p.minimo_vehiculos || 0)
  return Math.round(p.por_vehiculo * n * (100 - descuentoVolumen(n, tramos))) / 100
}

/** Precio por vehículo ya con el descuento por volumen. */
export function precioVehiculo(p, furgonetas, tramos) {
  const n = Math.max(Number(furgonetas) || 0, p.minimo_vehiculos || 0)
  return Math.round(p.por_vehiculo * (100 - descuentoVolumen(n, tramos))) / 100
}

/* Pagando un año se pagan 10 meses: dos salen gratis. */
export const MESES_ANUAL = 10

export const eur = (n) => (Number.isInteger(n) ? n.toLocaleString('es-ES') : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export const COMPLEMENTOS = [
  { clave: 'reparto', nombre: 'Reparto', precio: '6 € por conductor que la use en el mes',
    que: 'App de ruta: escanear o foto a la etiqueta, ruta ordenada por tiempo, navegación, prueba de entrega, seguimiento para el cliente y cobro.' },
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
  ['¿Pago por usuario o por conductor?', 'No. Usuarios de oficina y conductores ilimitados en todos los planes: se paga por vehículo. Solo la app de reparto, si la usáis, va por conductor.'],
  ['¿Y si la flota crece o baja a mitad de mes?', 'Ese mes no se toca: la factura siguiente ya sale con los vehículos que tengas. Nunca se cobra a toro pasado.'],
  ['¿Furgonetas de subcontratas o de campaña?', 'Se marcan en la ficha de cada una: las de colaboradores a 3 € al mes y las de campaña a 0,30 € por día que estén, fuera del plan.'],
  ['¿Tengo permanencia?', 'Mensual: no, cancelas cuando quieras. Anual: un año, con 2 meses gratis.'],
  ['¿Mis datos?', 'Son tuyos. Si os vais, os los devolvemos o los borramos, lo que elijáis: lo dice el contrato de encargo del tratamiento, que va incluido.'],
]
