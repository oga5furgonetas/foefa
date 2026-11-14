/* EL EXPEDIENTE DE EJEMPLO (14-11-2026) para /expediente-ejemplo. TODO INVENTADO: la empresa, la matrícula, las
   personas (nombre e inicial), las fechas y los golpes. Tiene la forma EXACTA de GET /vehicles/{id}/antes-del-perito
   (CONTRATO.md §C y R2), así que lo pinta la misma pieza que el panel.

   Es LA MISMA furgoneta que el héroe de la portada (Empresas.jsx): la portada lee de aquí `EJEMPLO_HEROE`, para que
   quien pulsa «Ver un expediente de ejemplo» encuentre lo que acaba de ver. Las fotos son las de la demo (public/demo/):
   la misma furgoneta vista desde su LADO DERECHO (el morro mira a la derecha), limpia, con un roce en el paragolpes,
   con el golpe de la puerta corredera y con la puerta y el panel trasero.

   La historia, coherente con las fotos, con sus sellos y con la regla del servidor (`_perito_atribucion`: cuentan los
   conductores de TODAS las revisiones entre la foto anterior y la del golpe, las dos incluidas):
   - entra el lunes 18 de mayo de 2026 con un roce en el paragolpes trasero (ya estaba; se repara el 4 de junio);
   - el miércoles 11 de noviembre (18:12) Luis P. hace su revisión y la oficina marca ese lado «igual»;
   - el jueves 12, en la revisión de Luis P. (18:07), aparece el golpe de la puerta corredera. Entre las dos fotos
     solo la llevó él, pasó un día y la anterior se marcó «igual» → atribuible: «la llevaba Luis P.». Lo marca la
     oficina (Marta R.) ese día. Es el golpe del héroe de la portada;
   - el viernes 13 Iván R. hace la suya y la oficina marca ese lado «igual» (el golpe de la puerta ya estaba apuntado);
   - el sábado 14, en la de Ana L., aparece una rozadura en el panel trasero: entre las dos fotos hay dos personas
     (Iván R. y Ana L.) → SIN conductor atribuible (`varios_conductores`). */

const FOTO = {
  limpia: '/demo/van-lateral.jpg',
  paragolpes: '/demo/van-lateral-golpe-paragolpes.jpg',
  puerta: '/demo/van-lateral-golpe-puerta.jpg',
  puertaPanel: '/demo/van-lateral-golpe-puerta-aleta.jpg',
}
const ANA = { id: 'ej-ana', nombre: 'Ana L.' }
const LUIS = { id: 'ej-luis', nombre: 'Luis P.' }
const IVAN = { id: 'ej-ivan', nombre: 'Iván R.' }
const OFICINA = 'Marta R.'

const DESDE = '2026-05-18'
const HASTA = '2026-11-14'
// Días laborables sin revisión: una semana de agosto (vacaciones) y tres sueltos.
const SIN_REVISION = new Set(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-06-24',
  '2026-09-29', '2026-11-09'])
// Sábados con revisión (la temporada alta de noviembre).
const SABADO_CON_REVISION = new Set(['2026-11-14'])
const GOLPE_EL = new Set(['2026-11-12', '2026-11-14'])

const dos = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`

function dias() {
  const out = []
  const [y, m, d] = DESDE.split('-').map(Number)
  for (let x = new Date(y, m - 1, d); iso(x) <= HASTA; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) {
    const f = iso(x)
    const finde = (x.getDay() === 0 || x.getDay() === 6) && !SABADO_CON_REVISION.has(f)
    out.push({ fecha: f, estado: finde || SIN_REVISION.has(f) ? 'sin_revisar' : GOLPE_EL.has(f) ? 'golpe' : 'revisada' })
  }
  return out
}

const calendario = dias().map((d) => ({ ...d, revisiones: d.estado === 'sin_revisar' ? 0 : 1 }))
const conRevision = calendario.filter((d) => d.revisiones > 0).length

// La hora local y la marca UTC de una revisión (Madrid: UTC+2 hasta el 25 de octubre, UTC+1 después).
function llegada(fecha, hora) {
  const verano = fecha < '2026-10-25'
  const [h, mi] = hora.split(':').map(Number)
  return { fecha, hora, recibida_at: `${fecha}T${dos(h - (verano ? 2 : 1))}:${dos(mi)}:00+00:00` }
}
const lado = (url, [fecha, hora], insp) => ({ vista: 'lateral_der', photo_index: 4, foto_url: url, inspection_id: insp, ...llegada(fecha, hora) })

// Las revisiones que cuenta la historia: [día, hora de llegada al servidor].
const R = {
  entra: ['2026-05-18', '07:52'],
  antes: ['2026-11-11', '18:12'],
  puerta: ['2026-11-12', '18:07'],
  igual: ['2026-11-13', '18:15'],
  panel: ['2026-11-14', '14:40'],
}

/* Lo que enseña el héroe de la portada, sacado de la misma historia: la matrícula, el lado, la pieza (su clave es la
   de `repaso.p.<clave>`), la foto anterior y la del golpe con su fecha y quién hizo cada revisión, quién lo marcó y la
   atribución que da el servidor (atribuible: las dos fotos las hizo Luis P., con un día entre ellas y la anterior
   repasada como «igual»). Las fechas son Date locales
   con los mismos números que el sello del expediente. */
const fechaLocal = ([f, h]) => {
  const [y, m, d] = f.split('-').map(Number)
  const [hh, mm] = h.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}
export const EJEMPLO_HEROE = {
  matricula: '5678 KLM',
  lado: 'lateral_der',
  pieza: 'Puerta lateral corredera derecha',
  piezaClave: 'corredera_der',
  antes: { fecha: fechaLocal(R.antes), quien: LUIS.nombre },
  hoy: { fecha: fechaLocal(R.puerta), quien: LUIS.nombre },
  marcadoPor: OFICINA,
  atribuible: true,
  motivo: null,
}

export const EMPRESA_EJEMPLO = 'Transportes del Noroeste, S. L. (ejemplo)'

export const EXPEDIENTE_EJEMPLO = {
  generado_at: '2026-11-14T14:05:00+00:00',
  vehiculo: {
    id: 'ejemplo-5678', matricula: EJEMPLO_HEROE.matricula, modelo: 'Mercedes-Benz Sprinter', centro: null,
    fin_renting: '2027-12-01', km: 61480, km_fecha: R.panel[0],
  },
  periodo: { desde: DESDE, hasta: HASTA, dias: calendario.length },
  cuentas: {
    revisiones: conRevision, conductores: 3, golpes: 3, reparados: 1, abiertos: 2, en_taller: 0,
    atribuibles: 1, ya_estaban: 1, dias_con_revision: conRevision, dias_sin_revision: calendario.length - conRevision,
  },
  como_entro: {
    fotos: [lado(FOTO.paragolpes, R.entra, 'ej-r-0518')],
    golpes_ya_estaban: ['ej-g-paragolpes'],
  },
  como_esta: {
    fotos: [lado(FOTO.puertaPanel, R.panel, 'ej-r-1114')],
  },
  golpes: [
    {
      id: 'ej-g-paragolpes', origen: 'repaso',
      pieza: 'Paragolpes trasero', pieza_clave: 'paragolpes_tras', panel: 'paragolpes', gravedad: 'leve',
      descripcion: 'Roce con la pintura levantada en la esquina',
      ...lado(FOTO.paragolpes, R.entra, 'ej-r-0518'),
      box_2d: [690, 215, 790, 290],
      confirmado_por: OFICINA, confirmado_at: '2026-05-18T07:31:00+00:00',
      ya_estaba: true, anterior: null,
      reparacion: { estado: 'reparado', orden_numero: 371, reparado_at: '2026-06-04', coste: 145 },
      atribucion: { atribuible: false, motivo: 'ya_estaba', dias: null, conductor: null, conductores: [] },
    },
    {
      id: 'ej-g-puerta', origen: 'repaso',
      pieza: EJEMPLO_HEROE.pieza, pieza_clave: EJEMPLO_HEROE.piezaClave, panel: 'puerta', gravedad: 'moderado',
      descripcion: 'Bollo con la pintura saltada, a media altura',
      ...lado(FOTO.puerta, R.puerta, 'ej-r-1112'),
      box_2d: [570, 495, 715, 610],
      confirmado_por: OFICINA, confirmado_at: '2026-11-12T17:31:00+00:00',
      ya_estaba: false,
      anterior: {
        inspection_id: 'ej-r-1111', photo_index: 4, foto_url: FOTO.limpia,
        ...llegada(...R.antes), conductor: LUIS, veredicto: 'igual',
      },
      reparacion: { estado: 'abierto', orden_numero: null, reparado_at: null, coste: null },
      atribucion: { atribuible: EJEMPLO_HEROE.atribuible, motivo: EJEMPLO_HEROE.motivo, dias: 1, conductor: LUIS, conductores: [LUIS] },
    },
    {
      id: 'ej-g-panel', origen: 'repaso',
      pieza: 'Panel lateral trasero derecho', pieza_clave: 'lateral_der', panel: 'lateral', gravedad: 'leve',
      descripcion: 'Rozadura larga por encima de la rueda',
      ...lado(FOTO.puertaPanel, R.panel, 'ej-r-1114'),
      box_2d: [570, 315, 720, 420],
      confirmado_por: OFICINA, confirmado_at: '2026-11-14T13:58:00+00:00',
      ya_estaba: false,
      anterior: {
        inspection_id: 'ej-r-1113', photo_index: 4, foto_url: FOTO.puerta,
        ...llegada(...R.igual), conductor: IVAN, veredicto: 'igual',
      },
      reparacion: { estado: 'abierto', orden_numero: null, reparado_at: null, coste: null },
      atribucion: { atribuible: false, motivo: 'varios_conductores', dias: 1, conductor: null, conductores: [IVAN, ANA] },
    },
  ],
  calendario,
}
