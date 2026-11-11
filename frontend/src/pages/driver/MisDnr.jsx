/* diseño compacto */
/* MIS DNR (11-11-2026, tanda 2). Dani: «que cuando yo suba los daily report y aparezcan las DNRs ellos puedan ver la DNR
   que le cae a ellos». Las 4 últimas semanas de Amazon (domingo a sábado); de cada DNR, el día, el código postal, el
   paquete, si le cuenta y cómo fue la entrega. Sin euros, nunca (lo decide el servidor, GET /diarios/mias, que además
   solo da las de quien llama).

   Cómo se monta (Dani, 11-11-2026: «que le ponga "esta semana llevas 1 DNR" y cuál es, o "llevas 5"», y después: «hazlo
   más bonito y mejor… entrega tipo "marcaste puerta y no llamaste ni sacaste bien la foto"… y un recordatorio»):
     1. Arriba y en grande, la frase de ESTA semana con su número (todas las DNR de la semana, cuenten o no), o «Esta semana
        no llevas ninguna» con su marca verde SOLO si hay datos de esta semana (revisión final, F3/F6: de domingo a
        martes, más o menos, aún no hay ninguno; entonces lo dice, sin marca verde, y abre «La semana pasada», que es la
        que acaba de llegar). Debajo, en pequeño, el desglose (solo con 2 o más) y hasta qué día hay datos.
     2. El recordatorio, siempre a la vista bajo la frase, con las palabras de Dani.
     3. Cuáles son: una tarjeta por DNR con qué día es cada cosa (revisión final, F8/F9: «Entregado el sáb, 7/11» si el
        servidor sabe el día de la entrega, y siempre «DNR del lun, 9/11», el día por el que cuenta), su CP, su paquete
        (entero en su línea), su estado y, debajo, QUÉ PASÓ en frases cortas con su icono, solo lo que el servidor ha
        entendido con seguridad (lo que llega a null no se dice). Si se sabe que no llamó, que la foto falló o que le
        apuntaron un fallo de contacto, la tarjeta lo destaca como «lo que puedes hacer la próxima vez».
     4. Las semanas anteriores, discretas: una línea por semana con su recuento y su desglose, que se abre al tocarla.
     5. Qué es cada estado y, siempre, «¿Alguna no es tuya? Díselo a la oficina.»: qué ID es de quién lo decide la oficina
        (revisión de seguridad, 11-11-2026); la app no tiene otra forma de saberlo. */
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Camera, CameraOff, Check, ChevronDown, ChevronUp, Clock, ConciergeBell, DoorOpen, Hand, Lightbulb,
  Loader2, Lock, Mailbox, MapPin, MapPinOff, MessageCircleQuestion, Phone, PhoneCall, PhoneOff, Store, Trees, Users,
} from 'lucide-react'
import { getMisDnr } from '../../services/api'
import { tx, locale, useIdioma } from '../../lib/idioma'
import { lista } from '../../lib/lista'
import { Aviso, Cabecera, ContenedorLista, Etiqueta } from './piezas'
import icono from './piezas/icono'
import {
  IconoDnr, casoSemana, contar, cuantasActualizadas, cuantasNuevas, guardarVistas, leerVistas, novedades, novedadesEnCorto,
  recordarDnr, yo,
} from './dnrVistas'

// Cada estado con su color Y su icono (el color solo no se distingue al sol ni sin ver colores), y lo que quiere decir.
// «No te cuenta» va en gris (revisión final, F31): en verde relleno pesaba más a la vista que «Te cuenta», que es la que
// importa. Con las piezas que hay, la de peligro (tinte rojo) destaca sobre la neutra.
const ESTADO = {
  cuenta: { texto: 'Te cuenta', tono: 'peligro', icono: AlertTriangle, explica: 'Amazon te la apunta como fallo.' },
  no_cuenta: { texto: 'No te cuenta', tono: 'neutro', icono: Check, explica: 'Amazon la revisó y no te la apunta.' },
  sin_clasificar: { texto: 'Sin clasificar', tono: 'aviso', icono: Clock, explica: 'Amazon aún no la ha revisado; suele tardar unos días.' },
}

// Cómo la marcó, con su frase y su icono. Una clave que no esté aquí no se dice (el servidor ya manda null lo que no
// entiende; esto es por si un día manda una clave nueva antes de que la web la conozca).
const COMO = {
  puerta: ['Lo marcaste en la puerta', DoorOpen],
  puerta_trasera: ['Lo marcaste en la puerta de atrás', DoorOpen],
  buzon: ['Lo marcaste en el buzón', Mailbox],
  en_mano: ['Lo marcaste como entregado en mano', Hand],
  familiar: ['Lo marcaste como entregado a alguien de la casa', Hand],
  recepcion: ['Lo marcaste en recepción', ConciergeBell],
  conserjeria: ['Lo marcaste en conserjería', ConciergeBell],
  vecino: ['Lo marcaste como entregado a un vecino', Users],
  locker: ['Lo marcaste en un locker', Lock],
  comercio: ['Lo marcaste en un comercio', Store],
  jardin: ['Lo marcaste en el jardín', Trees],
  lugar_seguro: ['Lo marcaste en un lugar seguro', MapPin],
  garaje: ['Lo marcaste en el garaje', MapPin],
  cobertizo: ['Lo marcaste en el cobertizo', MapPin],
}
const MOTIVO_FOTO = {
  borrosa: 'salió borrosa',
  oscura: 'salió muy oscura',
  sin_paquete: 'no se veía el paquete',
  muy_cerca: 'estaba hecha demasiado cerca',
  persona: 'salía una persona',
  en_furgoneta: 'el paquete estaba en la furgoneta',
  sin_foto: 'no había foto',
}
// El color del icono dice si es para fijarse (aviso), si es lo que le hizo fallar (peligro) o si es un dato sin más.
const COLOR = { dato: 'text-dark-400', bien: 'text-ruta-ok-texto', aviso: 'text-ruta-aviso-texto', mal: 'text-ruta-peligro-texto' }

// QUÉ PASÓ: solo lo que se sabe, en el orden en que pasó (dónde lo dejó, a qué distancia, la llamada y la foto).
function quePaso(x) {
  const out = []
  const como = COMO[x.como]
  if (como) out.push({ k: 'como', texto: tx(como[0]), icono: como[1], color: 'dato' })
  if (x.lejos === true) out.push({ k: 'lejos', texto: tx('Lo marcaste a más de 25 m del sitio'), icono: MapPinOff, color: 'aviso' })
  if (x.lejos === false) out.push({ k: 'lejos', texto: tx('Lo marcaste a menos de 25 m del sitio'), icono: MapPin, color: 'bien' })
  if (x.llamada === 'si') {
    out.push({ k: 'llamada', texto: x.segundos ? tx('Llamaste al cliente ({n} s)', { n: x.segundos }) : tx('Llamaste al cliente'), icono: PhoneCall, color: 'dato' })
  }
  if (x.llamada === 'no') out.push({ k: 'llamada', texto: tx('No llamaste al cliente'), icono: PhoneOff, color: 'mal' })
  else if (x.fallo_contacto === true) out.push({ k: 'contacto', texto: tx('Te apuntaron un fallo de contacto con el cliente'), icono: Phone, color: 'mal' })
  if (x.foto === 'mal') {
    const motivo = MOTIVO_FOTO[x.foto_motivo]
    out.push({ k: 'foto', icono: CameraOff, color: 'mal',
      texto: motivo ? tx('La foto no pasó la revisión: {motivo}', { motivo: tx(motivo) }) : tx('La foto no pasó la revisión') })
  }
  if (x.foto === 'bien') out.push({ k: 'foto', texto: tx('La foto pasó la revisión'), icono: Camera, color: 'bien' })
  return out
}

// Lo que puede hacer la próxima vez: solo si SE SABE que no llamó, que le apuntaron un fallo de contacto o que la foto
// falló. Con el fallo de contacto, un consejo prudente que no afirma que no llamara (revisión final, F30).
function proximaVez(x) {
  const out = []
  if (x.llamada === 'no') out.push(tx('Llama al cliente antes de dejar el paquete.'))
  else if (x.fallo_contacto === true) out.push(tx('Contacta con el cliente antes de dejar el paquete.'))
  if (x.foto === 'mal') out.push(tx('Saca la foto con el paquete y el sitio bien a la vista.'))
  return out
}

const fecha = (iso, op) => {
  const d = new Date(`${iso}T12:00:00`)
  return isNaN(d) ? iso : d.toLocaleDateString(locale(), op)
}
const corta = (iso) => fecha(iso, { day: 'numeric', month: 'numeric' })
const diaCorto = (iso) => fecha(iso, { weekday: 'short', day: 'numeric', month: 'numeric' })
// El día de la entrega solo si llega como fecha ISO (el servidor ya manda null lo dudoso; esto es por si acaso).
const esDia = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const rango = (s) => tx('Del {desde} al {hasta}', { desde: corta(s.semana), hasta: corta(s.hasta) })

// La frase grande con su número destacado: se traduce con un hueco en el sitio del número y el número se pinta aparte,
// así cada idioma lo pone donde le toca. El singular lleva su propia clave ({uno}) porque en inglés y en alemán cambia
// («1 DNR» / «5 DNRs»), aunque en español se escriba igual. El número va en rojo si alguna le cuenta; si no, en blanco:
// una sin clasificar o que no cuenta no es para alarmarse.
const HUECO = '\u0001'
function FraseSemana({ n, cuentan }) {
  const frase = n === 1 ? tx('Esta semana llevas {uno} DNR', { uno: HUECO }) : tx('Esta semana llevas {n} DNR', { n: HUECO })
  const [antes, despues = ''] = frase.split(HUECO)
  return (
    <h2 data-testid="dnr-frase" className="text-cifra text-dark-50">
      {antes}<span data-testid="dnr-numero" className={`text-paquete ${cuentan ? 'text-ruta-peligro-texto' : 'text-dark-50'}`}>{n}</span>{despues}
    </h2>
  )
}

// El desglose de la semana («1 te cuenta · 1 sin clasificar»): solo lo que hay, con su singular y su plural.
function desglose(s) {
  const partes = []
  const c = s.cuentan || 0
  const nc = s.no_cuentan || 0
  const sc = s.sin_clasificar || 0
  if (c) partes.push(c === 1 ? tx('1 te cuenta') : tx('{n} te cuentan', { n: c }))
  if (nc) partes.push(nc === 1 ? tx('1 no te cuenta') : tx('{n} no te cuentan', { n: nc }))
  if (sc) partes.push(sc === 1 ? tx('1 sin clasificar') : tx('{n} sin clasificar', { n: sc }))
  return partes.join(' · ')
}

// Una DNR, en su tarjeta: arriba su estado, en su propia fila (al lado del día, en el móvil unas veces cabía y otras no, y
// cada tarjeta salía de una forma); qué día es (y el CP); el paquete, entero en su propia línea (revisión final, F27: se
// compara con la etiqueta y partido se lee mal); y, debajo de una línea, qué pasó
// y, si toca, lo que puede hacer la próxima vez. Con el día de la entrega, ese arriba y el de la DNR, más discreto, bajo el
// paquete; sin él, solo el de la DNR (revisión final, F8/F9: era la fecha de concesión sin decirlo, y se leía como el día
// del reparto).
function Tarjeta({ x, marca }) {
  const e = ESTADO[x.estado] || ESTADO.sin_clasificar
  const hechos = quePaso(x)
  const consejos = proximaVez(x)
  const entrega = esDia(x.entrega) ? x.entrega : null
  const dnrDel = tx('DNR del {dia}', { dia: diaCorto(x.dia) })
  return (
    <li data-testid="dnr-fila" className="rounded-xl bg-dark-900 p-3">
      <div className="flex flex-wrap items-center gap-1">
        <Etiqueta testid="dnr-estado" tono={e.tono} icono={e.icono} texto={tx(e.texto)} />
        {marca && <Etiqueta testid="dnr-nueva" tono="marca" texto={marca === 'nueva' ? tx('Nueva') : tx('Actualizada')} />}
      </div>
      <p data-testid="dnr-dia" className="mt-2 text-sec text-dark-400">
        <span className="whitespace-nowrap">{entrega ? tx('Entregado el {dia}', { dia: diaCorto(entrega) }) : dnrDel}</span>
        {x.cp && <> · <span data-testid="dnr-cp" className="whitespace-nowrap">{tx('CP {cp}', { cp: x.cp })}</span></>}
      </p>
      <p data-testid="dnr-paquete" className="whitespace-nowrap font-mono text-nombre text-dark-50">{x.paquete}</p>
      {entrega && <p data-testid="dnr-concesion" className="text-pie text-dark-400">{dnrDel}</p>}
      {hechos.length > 0 && (
        <ul data-testid="dnr-que-paso" aria-label={tx('Qué pasó')} className="mt-3 flex flex-col gap-2 border-t border-dark-800 pt-3">
          {hechos.map((h) => (
            <li key={h.k} data-testid={`dnr-hecho-${h.k}`} className="flex items-start gap-2 text-texto text-dark-50">
              {icono(h.icono, 18, `mt-0.5 shrink-0 ${COLOR[h.color]}`)}
              <span className="min-w-0">{h.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {consejos.length > 0 && (
        <div data-testid="dnr-proxima" className="mt-3 rounded-lg bg-ruta-aviso p-3 text-ruta-aviso-texto">
          {/* El título manda sobre sus consejos (revisión final, F29): con peso, y ellos en letra normal. */}
          <p data-testid="dnr-proxima-titulo" className="flex items-center gap-2 text-boton">
            {icono(Lightbulb, 16, 'shrink-0')} {tx('Lo que puedes hacer la próxima vez')}
          </p>
          {/* Alineados con el texto del título, no con su icono. */}
          {consejos.map((c) => <p key={c} data-testid="dnr-consejo" className="mt-1 pl-6 text-texto">{c}</p>)}
        </div>
      )}
    </li>
  )
}

const Tarjetas = ({ dnr, marcas, nombre }) => (
  <ul aria-label={nombre} className="flex flex-col gap-2">
    {dnr.map((x) => <Tarjeta key={x.paquete} x={x} marca={marcas[x.paquete]} />)}
  </ul>
)

// El recordatorio de Dani, siempre a la vista bajo la frase grande.
function Recordatorio() {
  return (
    <div data-testid="dnr-recordatorio" className="flex items-start gap-3 rounded-xl bg-ruta-marca-tinte p-3 text-ruta-marca-tinte-texto">
      {icono(Lightbulb, 20, 'mt-0.5 shrink-0')}
      <p className="text-texto">{tx('Recuerda: si el cliente tiene preferencia de entrega, llama y saca bien la foto; así no te cuenta.')}</p>
    </div>
  )
}

// La frase grande cuando no lleva ninguna. Verde y con su marca SOLO si hay datos de esta semana; si no, neutra y diciendo
// lo que pasa (revisión final, F3/F6).
function SinNinguna({ caso }) {
  const ninguna = caso === 'ninguna'
  return (
    <div className="mt-1 flex items-center gap-3">
      <span data-testid={ninguna ? 'dnr-marca-verde' : undefined} aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ninguna ? 'bg-ruta-ok text-white' : 'bg-dark-800 text-dark-400'}`}>
        {ninguna ? <Check size={24} /> : <Clock size={22} />}
      </span>
      <h2 data-testid="dnr-frase" className="text-cifra text-dark-50">
        {ninguna ? tx('Esta semana no llevas ninguna')
          : caso === 'sin_reportes' ? tx('Aún no hay reportes de tu centro') : tx('De esta semana aún no hay reportes')}
      </h2>
    </div>
  )
}

// ESTA semana: la frase grande, el desglose, hasta cuándo hay datos, el recordatorio y, debajo, cuáles son.
function EstaSemana({ s, caso, marcas, hasta }) {
  const dnr = lista(s.dnr)
  const n = dnr.length
  return (
    <section data-testid="dnr-esta-semana" aria-label={tx('Esta semana')} className="flex flex-col gap-4">
      <div className="px-1">
        <p className="text-sec text-dark-400">{rango(s)}</p>
        {n > 0 ? <FraseSemana n={n} cuentan={s.cuentan || 0} /> : <SinNinguna caso={caso} />}
        {n > 1 && <p data-testid="dnr-desglose" className="mt-1 text-texto text-dark-400">{desglose(s)}</p>}
        {hasta && <p data-testid="dnr-hasta" className="mt-1 text-sec text-dark-400">{hasta}</p>}
      </div>
      <Recordatorio />
      {n > 0 && <Tarjetas dnr={dnr} marcas={marcas} nombre={tx('Esta semana')} />}
    </section>
  )
}

// Una semana anterior: una línea con su recuento y, bajo su rango, su desglose (revisión final, F17), que se abre al
// tocarla. La que no tuvo ninguna lo dice en esa línea y no se abre (no hay nada que ver). Las nuevas y las actualizadas,
// cada una en su etiqueta y aparte (F4/F16).
function SemanaAnterior({ s, i, marcas, abierta, onTocar }) {
  const dnr = lista(s.dnr)
  const n = dnr.length
  const titulo = i === 1 ? tx('La semana pasada') : rango(s)
  const suyas = Object.fromEntries(dnr.filter((x) => marcas[x.paquete]).map((x) => [x.paquete, marcas[x.paquete]]))
  const nuevas = contar(suyas, 'nueva')
  const actualizadas = contar(suyas, 'actualizada')
  const izquierda = (
    <span className="min-w-0 flex-1">
      <span className="block text-texto text-dark-50">{titulo}</span>
      {i === 1 && <span className="block text-sec text-dark-400">{rango(s)}</span>}
      {n > 0 && <span data-testid="dnr-semana-desglose" className="block text-sec text-dark-400">{desglose(s)}</span>}
      {(nuevas > 0 || actualizadas > 0) && (
        <span className="mt-1 flex flex-wrap gap-1">
          {nuevas > 0 && <Etiqueta testid="dnr-semana-nuevas" tono="marca" texto={cuantasNuevas(nuevas)} />}
          {actualizadas > 0 && <Etiqueta testid="dnr-semana-actualizadas" tono="neutro" texto={cuantasActualizadas(actualizadas)} />}
        </span>
      )}
    </span>
  )
  if (!n) {
    return (
      <li data-testid="dnr-semana" className="flex min-h-12 items-center gap-2 px-3 py-2">
        {izquierda}
        <span data-testid="dnr-recuento" className="flex shrink-0 items-center gap-1 text-boton text-ruta-ok-texto">
          <Check size={18} className="shrink-0" aria-hidden="true" /> {tx('Ninguna')}
        </span>
      </li>
    )
  }
  // El foco del teclado, por dentro (revisión final, F28): la lista recorta lo que sale de sus bordes y el anillo de
  // fuera no se veía.
  return (
    <li data-testid="dnr-semana">
      <button type="button" onClick={onTocar} aria-expanded={abierta}
        className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left ring-inset active:opacity-80">
        {izquierda}
        <span data-testid="dnr-recuento" className="shrink-0 text-boton text-dark-50">
          {n === 1 ? tx('1 DNR') : tx('{n} DNR', { n })}
        </span>
        {icono(abierta ? ChevronUp : ChevronDown, 20, 'shrink-0 text-dark-400')}
      </button>
      {abierta && (
        <div className="border-t border-dark-800 bg-dark-950 p-2">
          <Tarjetas dnr={dnr} marcas={marcas} nombre={titulo} />
        </div>
      )}
    </li>
  )
}

// Qué quiere decir cada estado: al final, con la etiqueta tal cual se ve en las tarjetas y su frase DEBAJO (revisión
// final, F32: en dos columnas, a 360 px en alemán o francés la etiqueta larga dejaba a la frase una columna estrecha).
function QueEsCadaEstado() {
  return (
    <section data-testid="dnr-estados" aria-label={tx('Qué es cada estado')} className="flex flex-col gap-2 px-1">
      <h2 className="text-etiqueta text-dark-400">{tx('Qué es cada estado')}</h2>
      <dl className="flex flex-col gap-3">
        {Object.entries(ESTADO).map(([k, e]) => (
          <div key={k} className="flex flex-col items-start gap-1">
            <dt><Etiqueta tono={e.tono} icono={e.icono} texto={tx(e.texto)} /></dt>
            <dd data-testid="dnr-estado-explica" className="text-sec text-dark-400">{tx(e.explica)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function MisDnr({ onBack, driverId }) {
  useIdioma()
  const id = yo(driverId)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(false)
  const [marcas, setMarcas] = useState({})
  const [abiertas, setAbiertas] = useState({})

  const cargar = useCallback(() => {
    setError(false)
    getMisDnr()
      .then((r) => {
        const d = r.data || {}
        // Lo nuevo se calcula con lo apuntado la vez anterior y, al momento, se apunta lo de hoy: la marca se ve esta vez
        // y la próxima ya no. La casilla del inicio se queda con esta misma respuesta (no vuelve a pedirla al volver).
        setMarcas(novedades(d, leerVistas(id)))
        guardarVistas(id, d)
        recordarDnr(id, d)
        setDatos(d)
      })
      .catch(() => { setDatos(null); setError(true) })
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  const semanas = lista(datos?.semanas)
  const [estaSemana, ...anteriores] = semanas
  const caso = casoSemana(datos)
  // Sin punto final: en alemán la fecha ya acaba en uno («10.11.»; revisión final, F19).
  const hasta = datos?.datos_hasta
    ? tx('Hay datos hasta el {fecha}', { fecha: fecha(datos.datos_hasta, { weekday: 'long', day: 'numeric', month: 'numeric' }) })
    : null
  // De esta semana aún no hay datos: «La semana pasada», la que acaba de llegar, sale abierta sin tocarla (F3/F6).
  const abiertaSinTocar = (k) => k === 0 && caso === 'sin_datos_semana'

  return (
    <div className="min-h-[100dvh] bg-dark-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md" data-testid="mis-dnr">
        <Cabecera titulo={tx('Mis DNR')} onVolver={onBack} subtitulo={novedadesEnCorto(marcas) || undefined} />
        <div className="flex flex-col gap-6 px-4 pt-2">
          {error && (
            <Aviso tono="peligro" texto={tx('No se han podido cargar tus DNR.')} accion={tx('Reintentar')} onAccion={cargar} />
          )}
          {!datos && !error && (
            <p className="flex min-h-12 items-center gap-2 text-texto text-dark-400">
              <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> {tx('Cargando…')}
            </p>
          )}

          {datos && !datos.tiene_id && (
            <Aviso tono="neutro" icono={IconoDnr} testid="dnr-sin-id"
              texto={tx('La oficina aún no ha enlazado tu ID de reparto. Cuando lo haga, aquí verás tus DNR.')} />
          )}
          {datos?.en_revision && (
            <Aviso tono="aviso" icono={Clock} testid="dnr-en-revision"
              texto={semanas.length
                ? tx('La oficina está revisando uno de tus ID de reparto: puede que aquí falte alguna.')
                : tx('La oficina está revisando tu ID de reparto. Cuando lo confirme, aquí verás tus DNR.')} />
          )}

          {estaSemana && <EstaSemana s={estaSemana} caso={caso} marcas={marcas} hasta={hasta} />}

          {anteriores.length > 0 && (
            <section data-testid="dnr-anteriores" aria-label={tx('Semanas anteriores')} className="flex flex-col gap-2">
              <h2 className="px-1 text-etiqueta text-dark-400">{tx('Semanas anteriores')}</h2>
              <ContenedorLista nombre={tx('Semanas anteriores')}>
                {anteriores.map((s, k) => {
                  const abierta = s.semana in abiertas ? abiertas[s.semana] : abiertaSinTocar(k)
                  return (
                    <SemanaAnterior key={s.semana} s={s} i={k + 1} marcas={marcas} abierta={abierta}
                      onTocar={() => setAbiertas((a) => ({ ...a, [s.semana]: !abierta }))} />
                  )
                })}
              </ContenedorLista>
            </section>
          )}

          {semanas.length > 0 && <QueEsCadaEstado />}
          {datos?.tiene_id && (
            <p data-testid="dnr-no-es-mia" className="flex items-start gap-2 px-1 text-sec text-dark-400">
              {icono(MessageCircleQuestion, 16, 'mt-0.5 shrink-0')} {tx('¿Alguna no es tuya? Díselo a la oficina.')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
