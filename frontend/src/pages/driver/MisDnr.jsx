/* diseño compacto */
/* MIS DNR (11-11-2026, tanda 2). Dani: «que cuando yo suba los daily report y aparezcan las DNRs ellos puedan ver la DNR
   que le cae a ellos». Las 4 últimas semanas de Amazon (domingo a sábado); de cada DNR, el día, el código postal, el
   paquete, si le cuenta y cómo fue la entrega. Sin euros, nunca (lo decide el servidor, GET /diarios/mias, que además
   solo da las de quien llama).

   V5, MENOS TEXTO (Dani, 11-11-2026: «es como demasiado texto… la gente hoy en día ve mucho texto y pasa de leer»). Un
   repartidor la abre diez segundos en la calle: se entiende con color + icono + una o dos palabras. Cinco bloques:
     1. El resumen de ESTA semana: «Esta semana llevas» y, muy grande, el número con «DNR» (rojo si alguna le cuenta);
        debajo, los contadores de color que no son cero («1 te cuenta», «1 no cuenta», «1 pendiente») y hasta cuándo hay
        datos. Sin DNR, una frase corta con su icono: «Esta semana, ninguna» con la marca verde SOLO si hay datos de esta
        semana y nada en revisión (F3/F6, G3); si no, neutra y diciendo qué pasa (casoSemana, en dnrVistas.js).
     2. El recordatorio, con la CONDICIÓN arriba y con peso (Dani: «deja bien claro que debe tener preferencia de entrega
        para que no te cuente lo de arriba»): «Solo si el cliente tiene preferencia de entrega» y, debajo, llama + foto
        clara → no te cuenta. El lector de pantalla lee la frase entera.
     3. Una tarjeta por DNR: el estado (y «Nueva» o «Actualizada») y el día; el paquete, entero en su línea (F27); el CP
        y, si se sabe el día de la entrega, el de la DNR (F8/F9: qué día es cada cosa); y QUÉ PASÓ como etiquetas cortas de
        color, solo lo que el servidor entiende con seguridad (lo que llega a null no se dice). Cada etiqueta lleva su
        frase larga para el lector de pantalla. La que le cuenta, con su banda roja.
     4. Las semanas anteriores, una fila cada una con sus mini contadores de color; se abren al tocarlas.
     5. «Qué es cada color», plegado, y «¿Alguna no es tuya? Díselo a la oficina.» si hay alguna en pantalla: qué ID es de
        quién lo decide la oficina (revisión de seguridad, 11-11-2026); la app no tiene otra forma de saberlo.

   R9 (Dani, 11-11-2026, al verla): «en los fallos de contacto, ponles que dando tono no podemos colgar nosotros la llamada
   y mínimo deben ser 30 segundos, aunque llames y te abra en la puerta». La llamada de menos de 30 s es «Llamada corta»
   (fallo) y cada DNR con fallo de contacto lleva, una vez, el aviso de los 30 segundos. Y dos cosas EN PAUSA
   (dnrPausas.js), sin borrarlas: el recordatorio de la entrega con preferencia (el bloque 2) y si le cuenta o no (el
   estado, su banda, los contadores, «Qué es cada color» y «Actualizada»). En pausa, la tarjeta empieza por el día.

   R11 (Dani, 11-11-2026): VUELVE el recordatorio de la preferencia, con su ejemplo corregido («¿Cómo sé si tiene
   preferencia?»: la preferencia es lo PRIMERO que aparece al entregar, no las notas). El estado SIGUE en pausa.

   R12 (11-11-2026, con un Daily Report real que mandó Dani): el informe dice si hubo «llamada o mensaje» sin decir cuál
   («Contactaste») y dos motivos de foto más (en la mano, en el buzón). Y el ejemplo de la preferencia dice también cómo
   se ve SIN ella: lo primero es «Miembro del hogar».

   R12, retoque (11-11-2026, revisión M1-M3): el informe trae «0» segundos en TODAS sus filas de contacto (y la subida
   guarda 0 una celda vacía), así que el 0 no es una medida: el servidor ya no lo manda y aquí nunca se pinta «0 s». La
   llamada que Amazon apunta sin segundos es «Llamada corta» a secas. Y la fila de fallo de contacto con 30 s o más (los
   datos se contradicen) dice «Llamaste · n s» sin verde, más «Fallo de contacto», y sin el aviso de los 30 s.

   R14 (11-11-2026, Dani: «monta lo que consideres necesario, que dé buena información y sea útil; si consideras lo de
   preferencia respetada, mételo, y lo de la columna esa de Mailbox Eligible, delivered elsewhere, también»): más cosas
   del informe, cada una en su etiqueta y solo cuando el servidor dice true: «Fuera de la dirección» junto a la distancia,
   «Llamaste» / «Escribiste» cuando el informe dice cuál fue, y, en su propio bloque bajo una raya fina (con todas a la
   vez, diez etiquetas seguidas eran un borrón), «Preferencia respetada», «Cabía en el buzón», «Varios a la vez», «El
   cliente dice otra cosa» y «Alto valor, no en mano» (nunca el importe). El estado SIGUE en pausa. */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Camera, CameraOff, Check, ChevronDown, ChevronUp, CircleHelp, Clock, ConciergeBell, DoorOpen, Gem, Hand, Info,
  Layers, Loader2, LocateOff, Lock, Mailbox, MapPin, MapPinOff, MessageCircleQuestion, MessageSquareText, Phone, PhoneCall,
  PhoneOff, Store, Target, Timer, Trees, Truck, UserCheck, UserX, Users,
} from 'lucide-react'
import { PAUSAS } from './dnrPausas'
import { getMisDnr } from '../../services/api'
import { tx, locale, useIdioma } from '../../lib/idioma'
import { lista } from '../../lib/lista'
import { Aviso, Cabecera, ContenedorLista, Etiqueta, EtiquetaHecho } from './piezas'
import icono from './piezas/icono'
import EjemploPreferencia, { PasosNoCuenta } from './EjemploPreferencia'
import {
  IconoDnr, apuntarSinDnr, casoSemana, contar, cuantasActualizadas, cuantasNuevas, guardarVistas, leerVistas, novedades,
  novedadesEnCorto, recordarDnr, vaciaAnterior, yo,
} from './dnrVistas'

// Cada estado con su color Y su icono (el color solo no se distingue al sol ni sin ver colores), y lo que quiere decir.
// «No cuenta» va en gris (revisión final, F31): en verde relleno pesaba más a la vista que «Te cuenta», que es la que
// importa. V5: nombres cortos («No cuenta», «Pendiente»); «Pendiente» no dice que Amazon no la haya revisado, porque también
// sale cuando la oficina no ha vuelto a subir ese reporte.
const ESTADO = {
  cuenta: { texto: 'Te cuenta', tono: 'peligro', icono: AlertTriangle, explica: 'Amazon te la apunta como fallo.' },
  no_cuenta: { texto: 'No cuenta', tono: 'neutro', icono: Check, explica: 'Amazon la revisó y no te la apunta.' },
  sin_clasificar: { texto: 'Pendiente', tono: 'aviso', icono: Clock, explica: 'Aún no se sabe si te cuenta.' },
}

// Cómo la marcó: [lo que se ve, la frase para el lector de pantalla, su icono]. Una clave que no esté aquí no se dice (el
// servidor ya manda null lo que no entiende; esto es por si un día manda una clave nueva antes de que la web la conozca).
const COMO = {
  puerta: ['Puerta', 'Lo marcaste en la puerta', DoorOpen],
  puerta_trasera: ['Puerta trasera', 'Lo marcaste en la puerta de atrás', DoorOpen],
  buzon: ['Buzón', 'Lo marcaste en el buzón', Mailbox],
  en_mano: ['En mano', 'Lo marcaste como entregado en mano', Hand],
  familiar: ['Familiar', 'Lo marcaste como entregado a alguien de la casa', Hand],
  recepcion: ['Recepción', 'Lo marcaste en recepción', ConciergeBell],
  conserjeria: ['Conserjería', 'Lo marcaste en conserjería', ConciergeBell],
  vecino: ['Vecino', 'Lo marcaste como entregado a un vecino', Users],
  locker: ['Locker', 'Lo marcaste en un locker', Lock],
  comercio: ['Comercio', 'Lo marcaste en un comercio', Store],
  jardin: ['Jardín', 'Lo marcaste en el jardín', Trees],
  lugar_seguro: ['Lugar seguro', 'Lo marcaste en un lugar seguro', MapPin],
  garaje: ['Garaje', 'Lo marcaste en el garaje', MapPin],
  cobertizo: ['Cobertizo', 'Lo marcaste en el cobertizo', MapPin],
}
// Por qué no pasó la foto: [lo que se ve, el motivo dentro de la frase larga]. R12 (11-11-2026, con un reporte real y su
// leyenda): dos motivos más, el paquete en la mano y en el buzón.
const FOTO = {
  borrosa: ['Foto borrosa', 'salió borrosa'],
  oscura: ['Foto oscura', 'salió muy oscura'],
  sin_paquete: ['Sin paquete en la foto', 'no se veía el paquete'],
  muy_cerca: ['Foto muy cerca', 'estaba hecha demasiado cerca'],
  persona: ['Persona en la foto', 'salía una persona'],
  en_furgoneta: ['Foto en la furgoneta', 'el paquete estaba en la furgoneta'],
  en_mano: ['Paquete en la mano', 'el paquete estaba en la mano'],
  en_buzon: ['Paquete en el buzón', 'el paquete estaba en el buzón'],
  sin_foto: ['Sin foto', 'no había foto'],
}

// R14, revisión N6 (11-11-2026): el contacto fue un mensaje y aun así sale una llamada «no» o «corta». No se habla de una
// llamada (ni en la etiqueta ni con el aviso de los 30 segundos de llamada).
const mensajeConFallo = (x) => x.contacto_como === 'mensaje' && (x.llamada === 'no' || x.llamada === 'corta')

// QUÉ PASÓ: solo lo que se sabe, en el orden en que pasó (dónde lo dejó, a qué distancia, la llamada y la foto). Cada cosa
// con su etiqueta corta, su frase larga y su tono: dato (sin juicio), bien o fallo.
function quePaso(x) {
  const out = []
  const como = COMO[x.como]
  // Retoque de R12 (revisión M1/M2): los segundos, de 1 en adelante. El 0 no es una medida (el informe real lo trae en
  // todas sus filas de contacto y la subida guarda 0 una celda vacía): «0 s» no se pinta nunca, ni aunque llegue.
  const seg = Number.isInteger(x.segundos) && x.segundos > 0 ? x.segundos : null
  if (como) out.push({ k: 'como', corto: tx(como[0]), frase: tx(como[1]), icono: como[2], tono: 'dato' })
  if (x.lejos === true) out.push({ k: 'lejos', corto: tx('A más de 25 m'), frase: tx('Lo marcaste a más de 25 m del sitio'), icono: MapPinOff, tono: 'fallo' })
  // R14, revisión N3 (11-11-2026): con «Fuera de la dirección» no se dice «En el sitio» (son dos columnas del informe con
  // criterios distintos, la de los 25 m y la de la dirección del cliente, y en la misma tarjeta se contradecían).
  if (x.lejos === false && x.a_distancia !== true) out.push({ k: 'lejos', corto: tx('En el sitio'), frase: tx('Lo marcaste a menos de 25 m del sitio'), icono: MapPin, tono: 'bien' })
  // R14: «Delivery Exception» del informe, junto a la distancia (Amazon dice que no estaba en la dirección del cliente).
  // N3: «Fuera de la dirección», no «Marcado a distancia», que sonaba a lo mismo que los 25 m.
  if (x.a_distancia === true) out.push({ k: 'a_distancia', corto: tx('Fuera de la dirección'), frase: tx('Lo marcaste como entregado sin estar en la dirección del cliente'), icono: LocateOff, tono: 'fallo' })
  // «si» sin segundos (R12) sale de la columna del reporte que dice que hubo «llamada o mensaje», sin decir cuál:
  // «Contactaste», no «Llamaste». Con fallo de contacto (revisión M3: una fila de fallo con 30 s o más, los datos se
  // contradicen) se dice lo que pasó sin el verde: la llamada como dato y, aparte, el fallo. R14: si el informe dice cuál
  // («Contact Details»: una llamada o un mensaje), se dice: «Llamaste» o «Escribiste».
  if (x.llamada === 'si') {
    const tono = x.fallo_contacto === true ? 'dato' : 'bien'
    out.push(seg != null
      ? { k: 'llamada', corto: tx('Llamaste · {n} s', { n: seg }), frase: tx('Llamaste al cliente ({n} s)', { n: seg }), icono: PhoneCall, tono }
      : x.contacto_como === 'llamada'
        ? { k: 'llamada', corto: tx('Llamaste'), frase: tx('Llamaste al cliente'), icono: PhoneCall, tono }
        : x.contacto_como === 'mensaje'
          ? { k: 'llamada', corto: tx('Escribiste'), frase: tx('Escribiste al cliente'), icono: MessageSquareText, tono }
          : { k: 'llamada', corto: tx('Contactaste'), frase: tx('Llamaste o escribiste al cliente'), icono: PhoneCall, tono })
  }
  // «Sin llamada» y «Llamada corta» ya dicen el fallo de contacto: el de contacto sale si no se ha dicho nada de la llamada
  // o si se dijo que llamó. La corta con sus segundos dice cuánto duró; sin ellos (Amazon apunta una llamada que no bastó,
  // sin medirla), «Llamada corta» a secas. R14, revisión N6: si el informe dice que el contacto fue un MENSAJE, ni «Sin
  // llamada» ni «Llamada corta» (no habla de una llamada que no hubo): «Fallo de contacto» a secas.
  if (mensajeConFallo(x)) out.push({ k: 'contacto', corto: tx('Fallo de contacto'), frase: tx('Te apuntaron un fallo de contacto con el cliente'), icono: MessageSquareText, tono: 'fallo' })
  else if (x.llamada === 'no') out.push({ k: 'llamada', corto: tx('Sin llamada'), frase: tx('No llamaste al cliente'), icono: PhoneOff, tono: 'fallo' })
  else if (x.llamada === 'corta') {
    out.push(seg != null
      ? { k: 'llamada', corto: tx('Llamada corta · {n} s', { n: seg }), icono: PhoneCall, tono: 'fallo',
        frase: tx('Tu llamada al cliente duró {n} segundos; tiene que durar 30 como mínimo', { n: seg }) }
      : { k: 'llamada', corto: tx('Llamada corta'), icono: PhoneCall, tono: 'fallo',
        frase: tx('Tu llamada al cliente fue demasiado corta; tiene que durar 30 segundos como mínimo') })
  } else if (x.fallo_contacto === true) {
    out.push({ k: 'contacto', corto: tx('Fallo de contacto'), frase: tx('Te apuntaron un fallo de contacto con el cliente'), icono: Phone, tono: 'fallo' })
  }
  if (x.foto === 'mal') {
    const f = FOTO[x.foto_motivo]
    out.push({ k: 'foto', icono: CameraOff, tono: 'fallo', corto: f ? tx(f[0]) : tx('Foto mal'),
      frase: f ? tx('La foto no pasó la revisión: {motivo}', { motivo: tx(f[1]) }) : tx('La foto no pasó la revisión') })
  }
  if (x.foto === 'bien') out.push({ k: 'foto', corto: tx('Foto bien'), frase: tx('La foto pasó la revisión'), icono: Camera, tono: 'bien' })
  // R14 (Dani, 11-11-2026: «monta lo que consideres necesario, que dé buena información y sea útil; si consideras lo de
  // preferencia respetada, mételo, y lo de la columna esa de Mailbox Eligible, delivered elsewhere, también»): lo demás que
  // dice el informe, después de lo de arriba. Cada una solo con true (con null no se sabe y no se dice: un «N» del PHR no
  // dice si no había preferencia o si no se respetó). Nunca el importe del paquete de alto valor.
  // Revisión N1 (11-11-2026): «Preferencia respetada» es un DATO del informe (gris), no un veredicto, y con un icono que
  // no es el del recordatorio de arriba: junto a «Llamaste» y sin fallo de foto, en verde y con el mismo icono, se leía
  // «esta no me cuenta», y eso lo dice otra columna. Cuando el estado («te cuenta / no cuenta») deje de estar en pausa, se
  // verá si vuelve al verde.
  if (x.preferencia === true) out.push({ k: 'preferencia', grupo: 2, corto: tx('Preferencia respetada'), frase: tx('Lo entregaste donde el cliente pedía'), icono: Target, tono: 'dato' })
  if (x.buzon_otro === true) out.push({ k: 'buzon_otro', grupo: 2, corto: tx('Cabía en el buzón'), frase: tx('Se podía dejar en el buzón y lo dejaste en otro sitio'), icono: Mailbox, tono: 'aviso' })
  if (x.varios_a_la_vez === true) out.push({ k: 'varios_a_la_vez', grupo: 2, corto: tx('Varios a la vez'), frase: tx('Marcaste varios paquetes como entregados a la vez'), icono: Layers, tono: 'aviso' })
  if (x.cliente_no_confirma === true) out.push({ k: 'cliente_no_confirma', grupo: 2, corto: tx('El cliente dice otra cosa'), frase: tx('El cliente dice que la entrega no fue como la marcaste'), icono: UserX, tono: 'fallo' })
  if (x.alto_valor === true) out.push({ k: 'alto_valor', grupo: 2, corto: tx('Alto valor, no en mano'), frase: tx('Era un paquete de alto valor y no se entregó al cliente en mano'), icono: Gem, tono: 'fallo' })
  return out
}

const fecha = (iso, op) => {
  const d = new Date(`${iso}T12:00:00`)
  return isNaN(d) ? iso : d.toLocaleDateString(locale(), op)
}
const corta = (iso) => fecha(iso, { day: 'numeric', month: 'numeric' })
// «sáb 7/11»: el día de la semana y la fecha, sin la coma que pone el navegador entre los dos.
const diaCorto = (iso) => `${fecha(iso, { weekday: 'short' })} ${corta(iso)}`
// El día de la entrega solo si llega como fecha ISO (el servidor ya manda null lo dudoso; esto es por si acaso).
const esDia = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const rango = (s) => tx('Del {desde} al {hasta}', { desde: corta(s.semana), hasta: corta(s.hasta) })

// Los contadores, con su singular y su plural: el número y lo que es.
const CONTADORES = [
  { k: 'cuentan', tono: 'peligro', icono: AlertTriangle, uno: () => tx('1 te cuenta'), varios: (n) => tx('{n} te cuentan', { n }) },
  { k: 'no_cuentan', tono: 'neutro', icono: Check, uno: () => tx('1 no cuenta'), varios: (n) => tx('{n} no cuentan', { n }) },
  { k: 'sin_clasificar', tono: 'aviso', icono: Clock, uno: () => tx('1 pendiente'), varios: (n) => tx('{n} pendientes', { n }) },
]
const contadores = (s) => CONTADORES.map((c) => ({ ...c, n: s?.[c.k] || 0 })).filter((c) => c.n > 0)
  .map((c) => ({ ...c, texto: c.n === 1 ? c.uno() : c.varios(c.n) }))
const desglose = (s) => contadores(s).map((c) => c.texto).join(' · ')

/* 1. EL RESUMEN DE ESTA SEMANA. El número va aparte de su frase, que se traduce con un hueco en su sitio: así cada idioma
   lo pone donde le toca y «DNR» lleva su plural («1 DNR» / «5 DNRs»; el singular tiene su propia clave, {uno}). Con un ID
   en revisión (G3) la frase de arriba no dice «llevas»: el número no es el total. */
const HUECO = '\u0001'
function Cuantas({ s, n, revision }) {
  const frase = n === 1 ? tx('Esta semana llevas {uno} DNR', { uno: HUECO }) : tx('Esta semana llevas {n} DNR', { n: HUECO })
  const [antes, despues = ''] = frase.split(HUECO)
  const arriba = revision ? tx('Esta semana, sin las que están en revisión') : antes.trim()
  return (
    <h2 data-testid="dnr-frase" className="min-w-0 text-dark-50">
      <span data-testid="dnr-frase-arriba" className="block text-texto text-dark-400">{arriba}</span>{' '}
      <span className="flex items-baseline gap-2">
        <span data-testid="dnr-numero" className={`text-paquete ${s.cuentan && !PAUSAS.estado ? 'text-ruta-peligro-texto' : 'text-dark-50'}`}>{n}</span>{' '}
        <span className="text-titulo">{despues.trim()}</span>
      </span>
    </h2>
  )
}

const fraseSin = (caso) => (caso === 'ninguna' ? tx('Esta semana, ninguna')
  : caso === 'sin_reportes' ? tx('Aún no hay reportes de tu centro')
    : caso === 'en_revision' ? tx('Tu ID de reparto está en revisión')
      : tx('De esta semana aún no hay reportes'))
// Sin DNR esta semana: verde y con su marca SOLO si se sabe (caso «ninguna»); si no, neutra, con el reloj.
function SinNinguna({ caso }) {
  const ninguna = caso === 'ninguna'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span data-testid={ninguna ? 'dnr-marca-verde' : 'dnr-sin-marca'} aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ninguna ? 'bg-ruta-ok text-white' : 'bg-dark-800 text-dark-400'}`}>
        {ninguna ? <Check size={24} /> : <Clock size={22} />}
      </span>
      <h2 data-testid="dnr-frase" className="min-w-0 text-titulo text-dark-50">{fraseSin(caso)}</h2>
    </div>
  )
}

function Resumen({ s, caso, hasta }) {
  const n = lista(s.dnr).length
  // Los contadores de color dicen cuántas le cuentan: con el estado en pausa, no salen.
  const cs = PAUSAS.estado ? [] : contadores(s)
  return (
    <div data-testid="dnr-resumen" className="rounded-xl bg-dark-900 p-4">
      <div className="flex items-start justify-between gap-3">
        {n > 0 ? <Cuantas s={s} n={n} revision={caso === 'lleva_revision'} /> : <SinNinguna caso={caso} />}
        <p data-testid="dnr-rango" className="shrink-0 pt-0.5 text-sec text-dark-400">{rango(s)}</p>
      </div>
      {n > 0 && cs.length > 0 && (
        <div data-testid="dnr-desglose" className="mt-3 flex flex-wrap gap-1">
          {cs.map((c) => <Etiqueta key={c.k} testid={`dnr-contador-${c.k}`} tono={c.tono} icono={c.icono} texto={c.texto} />)}
        </div>
      )}
      {hasta && <p data-testid="dnr-hasta" className="mt-3 text-sec text-dark-400">{hasta}</p>}
    </div>
  )
}

/* 2. EL RECORDATORIO, con la condición arriba y con peso, y los pasos debajo en una fila. Lo que se ve es para la vista; el
   lector de pantalla lee la frase entera, que dice lo mismo sin flechas. «No te cuenta» es la REGLA, no el estado de una
   DNR: con el estado en pausa (dnrPausas.js) sigue saliendo y ninguna tarjeta dice si le cuenta. Debajo, «¿Cómo sé si
   tiene preferencia?» abre el ejemplo de la pantalla de entrega (EjemploPreferencia.jsx, R11: la preferencia es lo
   PRIMERO que aparece al entregar; las notas no lo son); al cerrarlo, el foco vuelve a ese botón. */
function Recordatorio() {
  const [ejemplo, setEjemplo] = useState(false)
  const boton = useRef(null)
  const cerrarEjemplo = useCallback(() => { setEjemplo(false); boton.current?.focus() }, [])
  return (
    <div data-testid="dnr-recordatorio" className="rounded-xl border border-ruta-marca bg-ruta-marca-tinte p-3 text-ruta-marca-tinte-texto">
      <p data-testid="dnr-recordatorio-frase" className="sr-only">
        {tx('Recuerda: para que no te cuente, el cliente tiene que tener preferencia de entrega, y tú llamar y sacar bien la foto.')}
      </p>
      <div aria-hidden="true">
        <p data-testid="dnr-recordatorio-condicion" className="flex items-start gap-2 text-nombre">
          {icono(UserCheck, 20, 'mt-0.5 shrink-0')}
          <span className="min-w-0">{tx('Solo si el cliente tiene preferencia de entrega')}</span>
        </p>
        <PasosNoCuenta testid="dnr-recordatorio-pasos" className="mt-3 border-t border-ruta-marca/40 pt-3" />
      </div>
      <button ref={boton} type="button" data-testid="dnr-ver-ejemplo" aria-haspopup="dialog" onClick={() => setEjemplo(true)}
        className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg text-left text-texto underline underline-offset-4 active:opacity-80">
        {icono(CircleHelp, 18, 'shrink-0')}
        <span className="min-w-0">{tx('¿Cómo sé si tiene preferencia?')}</span>
      </button>
      {ejemplo && <EjemploPreferencia onClose={cerrarEjemplo} />}
    </div>
  )
}

/* 3. UNA DNR, en su tarjeta. Arriba, su estado (y «Nueva» en el tono de marca o «Actualizada» en gris, G17) y el día: el de
   la entrega con su furgoneta si se sabe, o «DNR lun 9/11». El paquete, entero en su línea. Debajo, el CP y, si arriba va
   el de la entrega, el de la DNR, para que se sepa qué día es cada cosa (F8/F9); si los dos son el mismo día, la fecha
   sale una sola vez (G13/G18). Y qué pasó, en etiquetas. */
function Tarjeta({ x, marca }) {
  const e = ESTADO[x.estado] || ESTADO.sin_clasificar
  const hechos = quePaso(x)
  const entrega = esDia(x.entrega) && x.entrega !== x.dia ? x.entrega : null
  const dnrDia = tx('DNR {dia}', { dia: diaCorto(x.dia) })
  // Con el estado en pausa (dnrPausas.js) ni su etiqueta ni la banda roja; la fila de arriba empieza por el día y, si es
  // nueva, «Nueva» a la derecha.
  const verEstado = !PAUSAS.estado
  const cuenta = verEstado && x.estado === 'cuenta'
  // R9: un fallo de contacto (sin llamada, una llamada corta o el fallo que dice el informe) lleva el aviso de los 30 s.
  // Con «Llamaste» no (revisión M3, 11-11-2026): sí llamó 30 s o más, y el aviso le diría lo contrario.
  // N6: si el contacto fue un mensaje, tampoco (habla de una llamada).
  const falloContacto = !mensajeConFallo(x) && (x.llamada === 'no' || x.llamada === 'corta' || (x.fallo_contacto === true && x.llamada !== 'si'))
  const etiquetas = (verEstado || marca) && (
    <div className="flex min-w-0 flex-wrap gap-1">
      {verEstado && <Etiqueta testid="dnr-estado" tono={e.tono} icono={e.icono} texto={tx(e.texto)} />}
      {marca && <Etiqueta testid="dnr-nueva" tono={marca === 'nueva' ? 'marca' : 'neutro'} texto={marca === 'nueva' ? tx('Nueva') : tx('Actualizada')} />}
    </div>
  )
  const dia = (
    <p className="flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap text-sec text-dark-400">
      {entrega && icono(Truck, 14, 'shrink-0')}
      {entrega && <span data-testid="dnr-dia-frase" className="sr-only">{tx('Entregado el {dia}', { dia: diaCorto(entrega) })}</span>}
      <span data-testid="dnr-dia" aria-hidden={entrega ? 'true' : undefined}>{entrega ? diaCorto(entrega) : dnrDia}</span>
    </p>
  )
  return (
    <li data-testid="dnr-fila" data-cuenta={verEstado ? (cuenta ? 'si' : 'no') : undefined}
      className={`rounded-xl bg-dark-900 p-3 ${cuenta ? 'border-l-4 border-ruta-peligro pl-2' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        {verEstado ? <>{etiquetas}{dia}</> : <>{dia}{etiquetas}</>}
      </div>
      <p data-testid="dnr-paquete" className="mt-2 whitespace-nowrap font-mono text-nombre text-dark-50">{x.paquete}</p>
      {(x.cp || entrega) && (
        <p className="text-sec text-dark-400">
          {x.cp && <span data-testid="dnr-cp" className="whitespace-nowrap">{tx('CP {cp}', { cp: x.cp })}</span>}
          {x.cp && entrega && ' · '}
          {entrega && <span data-testid="dnr-concesion" className="whitespace-nowrap">{dnrDia}</span>}
        </p>
      )}
      {hechos.length > 0 && (
        <ul data-testid="dnr-que-paso" aria-label={tx('Qué pasó')} className="mt-3 flex flex-wrap gap-1">
          {hechos.map((h, i) => (
            <Fragment key={h.k}>
              {/* R14: lo demás del informe, en su propio bloque bajo una raya fina (con todas a la vez, un solo montón de diez
                  etiquetas no se leía de un golpe). La raya es solo para la vista. */}
              {h.grupo === 2 && i > 0 && hechos[i - 1].grupo !== 2 && (
                <li aria-hidden="true" data-testid="dnr-que-paso-raya" className="basis-full border-t border-dark-800" />
              )}
              <li className="max-w-full">
                <EtiquetaHecho testid={`dnr-hecho-${h.k}`} tono={h.tono} icono={h.icono} texto={h.corto} frase={h.frase} />
              </li>
            </Fragment>
          ))}
        </ul>
      )}
      {falloContacto && (
        <p data-testid="dnr-aviso-llamada" className="mt-2 flex items-start gap-2 rounded-lg bg-ruta-aviso p-2 text-sec text-ruta-aviso-texto">
          {icono(Timer, 16, 'mt-0.5 shrink-0')}
          <span className="min-w-0">{tx('La llamada, mínimo 30 segundos. No cuelgues tú mientras da tono, aunque te abran la puerta.')}</span>
        </p>
      )}
    </li>
  )
}

const Tarjetas = ({ dnr, marcas, nombre }) => (
  <ul aria-label={nombre} className="flex flex-col gap-2">
    {dnr.map((x) => <Tarjeta key={x.paquete} x={x} marca={marcas[x.paquete]} />)}
  </ul>
)

/* 4. UNA SEMANA ANTERIOR: una fila con su nombre y, a la derecha, sus mini contadores de color (el desglose en palabras va
   para el lector de pantalla), que se abre al tocarla. La que no tuvo ninguna lo dice y no se abre: «Ninguna» con la marca
   verde solo si hay datos de esa semana y nada en revisión; si no hay datos, «Sin datos», neutra (G5/G7). Las nuevas y las
   actualizadas, cada una en su etiqueta y aparte (F4/F16). */
function SemanaAnterior({ s, i, marcas, abierta, onTocar, vacia }) {
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
      {(nuevas > 0 || actualizadas > 0) && (
        <span className="mt-1 flex flex-wrap gap-1">
          {nuevas > 0 && <Etiqueta testid="dnr-semana-nuevas" tono="marca" texto={cuantasNuevas(nuevas)} />}
          {actualizadas > 0 && <Etiqueta testid="dnr-semana-actualizadas" tono="neutro" texto={cuantasActualizadas(actualizadas)} />}
        </span>
      )}
    </span>
  )
  if (!n) {
    const verde = vacia === 'ninguna'
    return (
      <li data-testid="dnr-semana" className="flex min-h-12 items-center gap-2 px-3 py-2">
        {izquierda}
        <span data-testid="dnr-recuento" data-vacia={vacia}
          className={`flex shrink-0 items-center gap-1 text-boton ${verde ? 'text-ruta-ok-texto' : 'text-dark-400'}`}>
          {verde && <Check size={18} className="shrink-0" aria-hidden="true" />}
          {vacia === 'sin_datos' && <Clock size={16} className="shrink-0" aria-hidden="true" />}
          {vacia === 'sin_datos' ? tx('Sin datos') : tx('Ninguna')}
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
        {/* Con el estado en pausa, a la derecha solo el total («2 DNR»), que también lee el lector de pantalla. */}
        {PAUSAS.estado ? (
          <span data-testid="dnr-recuento" className="shrink-0 whitespace-nowrap text-boton text-dark-50">
            {n === 1 ? tx('1 DNR') : tx('{n} DNR', { n })}
          </span>
        ) : (
          <>
            <span data-testid="dnr-recuento" aria-hidden="true" className="flex shrink-0 flex-wrap justify-end gap-1">
              {contadores(s).map((c) => <Etiqueta key={c.k} testid={`dnr-mini-${c.k}`} tono={c.tono} icono={c.icono} texto={String(c.n)} titulo={c.texto} />)}
            </span>
            <span data-testid="dnr-semana-desglose" className="sr-only">{desglose(s)}</span>
          </>
        )}
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

/* 5. QUÉ ES CADA COLOR, plegado: un toque lo abre. Cada etiqueta tal cual se ve en las tarjetas y su frase DEBAJO (revisión
   final, F32: en dos columnas, a 360 px en alemán o francés la etiqueta larga dejaba a la frase una columna estrecha). */
function QueEsCadaColor() {
  const [abierto, setAbierto] = useState(false)
  return (
    <section data-testid="dnr-estados" aria-label={tx('Qué es cada color')} className="overflow-hidden rounded-xl bg-dark-900">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}
        className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left ring-inset active:opacity-80">
        {icono(Info, 18, 'shrink-0 text-dark-400')}
        <span className="min-w-0 flex-1 text-texto text-dark-50">{tx('Qué es cada color')}</span>
        {icono(abierto ? ChevronUp : ChevronDown, 20, 'shrink-0 text-dark-400')}
      </button>
      {abierto && (
        <dl className="flex flex-col gap-3 border-t border-dark-800 p-3">
          {Object.entries(ESTADO).map(([k, e]) => (
            <div key={k} className="flex flex-col items-start gap-1">
              <dt><Etiqueta tono={e.tono} icono={e.icono} texto={tx(e.texto)} /></dt>
              <dd data-testid="dnr-estado-explica" className="text-sec text-dark-400">{tx(e.explica)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

export default function MisDnr({ onBack, driverId }) {
  useIdioma()
  const id = yo(driverId)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(false)
  const [fuera, setFuera] = useState(false)
  const [marcas, setMarcas] = useState({})
  const [abiertas, setAbiertas] = useState({})

  /* SOLO LA ÚLTIMA PETICIÓN, Y CON LA PANTALLA ABIERTA (revisión 4, H6, 11-11-2026). Con poca cobertura el conductor ve
     «Cargando…», pulsa Volver y la respuesta llega igual: antes se apuntaban sus DNR como vistas sin haberlas visto (al
     volver, ni «Nueva» ni el número rojo, y lo apuntado dura 5 semanas). Y con dos peticiones a la vez («Reintentar»), la
     más vieja, si llegaba después, calculaba las novedades contra lo que acababa de apuntar la otra. Ahora cada petición
     lleva su número: una que ya no es la última no hace nada; si la pantalla ya se cerró, la casilla se queda con la
     respuesta (recordarDnr no apunta nada como visto: calcula las nuevas con lo apuntado), pero ni se apunta ni se marca. */
  const peticion = useRef(0)
  const enPantalla = useRef(true)
  useEffect(() => {
    enPantalla.current = true
    return () => { enPantalla.current = false }
  }, [])
  const cargar = useCallback(() => {
    const esta = ++peticion.current
    setError(false)
    getMisDnr()
      .then((r) => {
        if (esta !== peticion.current) return
        const d = r.data || {}
        recordarDnr(id, d)
        if (!enPantalla.current) return
        // Lo nuevo se calcula con lo apuntado la vez anterior y, al momento, se apunta lo de hoy: la marca se ve esta vez
        // y la próxima ya no. La casilla del inicio se queda con esta misma respuesta (no vuelve a pedirla al volver).
        setMarcas(novedades(d, leerVistas(id)))
        guardarVistas(id, d)
        setDatos(d)
      })
      .catch((e) => {
        if (esta !== peticion.current) return
        // 404 (su empresa no tiene la DNR diaria) o 403: aquí no hay nada para él; vuelve al inicio, que ya no enseña la
        // casilla (G8). El «Reintentar» queda para los fallos de red y del servidor.
        if (apuntarSinDnr(id, e)) { if (enPantalla.current) setFuera(true); return }
        if (!enPantalla.current) return
        setDatos(null); setError(true)
      })
  }, [id])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (fuera) onBack() }, [fuera, onBack])

  const semanas = lista(datos?.semanas)
  const [estaSemana, ...anteriores] = semanas
  const caso = casoSemana(datos)
  const hayAlguna = semanas.some((s) => lista(s.dnr).length > 0)
  // Sin punto final: en alemán la fecha ya acaba en uno («10.11.»; revisión final, F19).
  const hasta = datos?.datos_hasta ? tx('Datos hasta el {fecha}', { fecha: diaCorto(datos.datos_hasta) }) : null
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

          {estaSemana && (
            <section data-testid="dnr-esta-semana" aria-label={tx('Esta semana')} className="flex flex-col gap-3">
              <Resumen s={estaSemana} caso={caso} hasta={hasta} />
              {!PAUSAS.preferencia && <Recordatorio />}
              {lista(estaSemana.dnr).length > 0 && <Tarjetas dnr={lista(estaSemana.dnr)} marcas={marcas} nombre={tx('Esta semana')} />}
            </section>
          )}

          {anteriores.length > 0 && (
            <section data-testid="dnr-anteriores" aria-label={tx('Semanas anteriores')} className="flex flex-col gap-2">
              <h2 className="px-1 text-etiqueta text-dark-400">{tx('Semanas anteriores')}</h2>
              <ContenedorLista nombre={tx('Semanas anteriores')}>
                {anteriores.map((s, k) => {
                  const abierta = s.semana in abiertas ? abiertas[s.semana] : abiertaSinTocar(k)
                  return (
                    <SemanaAnterior key={s.semana} s={s} i={k + 1} marcas={marcas} abierta={abierta} vacia={vaciaAnterior(datos, s)}
                      onTocar={() => setAbiertas((a) => ({ ...a, [s.semana]: !abierta }))} />
                  )
                })}
              </ContenedorLista>
            </section>
          )}

          {semanas.length > 0 && !PAUSAS.estado && <QueEsCadaColor />}
          {hayAlguna && (
            <p data-testid="dnr-no-es-mia" className="flex items-start gap-2 px-1 text-sec text-dark-400">
              {icono(MessageCircleQuestion, 16, 'mt-0.5 shrink-0')} {tx('¿Alguna no es tuya? Díselo a la oficina.')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
