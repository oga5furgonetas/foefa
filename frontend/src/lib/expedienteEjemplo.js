/* EL EXPEDIENTE DE EJEMPLO (14-11-2026) para /expediente-ejemplo. TODO INVENTADO: la empresa, la matrícula, las
   personas (nombre e inicial), las fechas y los golpes. Tiene la forma EXACTA de GET /vehicles/{id}/antes-del-perito
   (CONTRATO.md §C), así que lo pinta la misma pieza que el panel. Las fotos son las de la demo (public/demo/): la
   furgoneta limpia, con un roce en el paragolpes, con el bollo de la puerta y con la puerta y la aleta.
   La historia, coherente con las fotos:
   - entra el 18 de mayo de 2026 con un roce en el paragolpes trasero (ya estaba; se repara el 4 de junio);
   - el 27 de octubre aparece un bollo en la puerta corredera: la foto anterior (26 de octubre, Luis P.) está marcada
     «igual» y entre las dos solo la llevó él → atribuible, y está en el taller;
   - el 10 de noviembre aparece otro en la aleta trasera: la foto anterior es del viernes 6 (el lunes 9 no se revisó)
     → pasaron 4 días, sin conductor atribuible. */

const FOTO = {
  limpia: '/demo/van-lateral.jpg',
  paragolpes: '/demo/van-lateral-golpe-paragolpes.jpg',
  puerta: '/demo/van-lateral-golpe-puerta.jpg',
  puertaAleta: '/demo/van-lateral-golpe-puerta-aleta.jpg',
}
const ANA = { id: 'ej-ana', nombre: 'Ana L.' }
const LUIS = { id: 'ej-luis', nombre: 'Luis P.' }
const IVAN = { id: 'ej-ivan', nombre: 'Iván R.' }

const DESDE = '2026-05-18'
const HASTA = '2026-11-13'
// Días laborables sin revisión: una semana de agosto (vacaciones), dos sueltos y el lunes 9 de noviembre.
const SIN_REVISION = new Set(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-06-24',
  '2026-09-29', '2026-11-09'])
const GOLPE_EL = new Set(['2026-10-27', '2026-11-10'])

const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`

function dias() {
  const out = []
  const [y, m, d] = DESDE.split('-').map(Number)
  for (let x = new Date(y, m - 1, d); iso(x) <= HASTA; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) {
    const finde = x.getDay() === 0 || x.getDay() === 6
    const f = iso(x)
    out.push({ fecha: f, estado: finde || SIN_REVISION.has(f) ? 'sin_revisar' : GOLPE_EL.has(f) ? 'golpe' : 'revisada' })
  }
  return out
}

const calendario = dias().map((d) => ({ ...d, revisiones: d.estado === 'sin_revisar' ? 0 : 1 }))
const conRevision = calendario.filter((d) => d.revisiones > 0).length

// La hora local y la marca UTC de una revisión (en noviembre Madrid va a UTC+1; en verano, a UTC+2).
function llegada(fecha, hora) {
  const verano = fecha < '2026-10-25'
  const [h, mi] = hora.split(':').map(Number)
  return { fecha, hora, recibida_at: `${fecha}T${dos(h - (verano ? 2 : 1))}:${dos(mi)}:00+00:00` }
}
const lado = (url, fecha, hora, insp) => ({ vista: 'lateral_izq', photo_index: 3, foto_url: url, inspection_id: insp, ...llegada(fecha, hora) })

export const EMPRESA_EJEMPLO = 'Transportes del Noroeste, S. L. (ejemplo)'

export const EXPEDIENTE_EJEMPLO = {
  generado_at: '2026-11-14T08:20:00+00:00',
  vehiculo: {
    id: 'ejemplo-5678', matricula: '5678 KLM', modelo: 'Mercedes-Benz Sprinter', centro: null,
    fin_renting: '2027-12-01', km: 61480, km_fecha: '2026-11-13',
  },
  periodo: { desde: DESDE, hasta: HASTA, dias: calendario.length },
  cuentas: {
    revisiones: conRevision, conductores: 3, golpes: 3, reparados: 1, abiertos: 1, en_taller: 1,
    atribuibles: 1, ya_estaban: 1, dias_con_revision: conRevision, dias_sin_revision: calendario.length - conRevision,
  },
  como_entro: {
    fotos: [lado(FOTO.paragolpes, '2026-05-18', '07:52', 'ej-r-0518')],
    golpes_ya_estaban: ['ej-g-paragolpes'],
  },
  como_esta: {
    fotos: [lado(FOTO.puertaAleta, '2026-11-13', '07:46', 'ej-r-1113')],
  },
  golpes: [
    {
      id: 'ej-g-paragolpes', origen: 'repaso',
      pieza: 'Paragolpes trasero, esquina izquierda', panel: 'paragolpes', gravedad: 'leve',
      descripcion: 'Roce con la pintura levantada',
      ...lado(FOTO.paragolpes, '2026-05-18', '07:52', 'ej-r-0518'),
      box_2d: [690, 215, 790, 290],
      confirmado_por: 'Marta R.', confirmado_at: '2026-05-18T07:31:00+00:00',
      ya_estaba: true, anterior: null,
      reparacion: { estado: 'reparado', orden_numero: 371, reparado_at: '2026-06-04', coste: 145 },
      atribucion: { atribuible: false, motivo: 'ya_estaba', dias: null, conductor: null, conductores: [] },
    },
    {
      id: 'ej-g-puerta', origen: 'repaso',
      pieza: 'Puerta lateral corredera izquierda', panel: 'puerta', gravedad: 'moderado',
      descripcion: 'Bollo con la pintura saltada, a media altura',
      ...lado(FOTO.puerta, '2026-10-27', '08:04', 'ej-r-1027'),
      box_2d: [570, 495, 715, 610],
      confirmado_por: 'Marta R.', confirmado_at: '2026-10-27T08:12:00+00:00',
      ya_estaba: false,
      anterior: {
        inspection_id: 'ej-r-1026', photo_index: 3, foto_url: FOTO.limpia,
        ...llegada('2026-10-26', '07:58'), conductor: LUIS, veredicto: 'igual',
      },
      reparacion: { estado: 'en_taller', orden_numero: 412, reparado_at: null, coste: null },
      atribucion: { atribuible: true, motivo: null, dias: 1, conductor: LUIS, conductores: [LUIS] },
    },
    {
      id: 'ej-g-aleta', origen: 'repaso',
      pieza: 'Aleta trasera izquierda', panel: 'aleta', gravedad: 'leve',
      descripcion: 'Rozadura larga por encima de la rueda',
      ...lado(FOTO.puertaAleta, '2026-11-10', '07:49', 'ej-r-1110'),
      box_2d: [570, 315, 720, 420],
      confirmado_por: 'Marta R.', confirmado_at: '2026-11-10T08:05:00+00:00',
      ya_estaba: false,
      anterior: {
        inspection_id: 'ej-r-1106', photo_index: 3, foto_url: FOTO.puerta,
        ...llegada('2026-11-06', '07:55'), conductor: IVAN, veredicto: 'igual',
      },
      reparacion: { estado: 'abierto', orden_numero: null, reparado_at: null, coste: null },
      atribucion: { atribuible: false, motivo: 'varios_dias', dias: 4, conductor: null, conductores: [IVAN, ANA] },
    },
  ],
  calendario,
}
