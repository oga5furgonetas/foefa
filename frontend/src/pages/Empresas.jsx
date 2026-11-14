import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, useIdioma, idioma, locale } from '../lib/idioma'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { selloDeFecha } from '../lib/sello'
import { PLANES_EMPRESA, DESCUENTOS_VOLUMEN, MESES_ANUAL, DIAS_PRUEBA_EMPRESA, precioMes, descuentoVolumen } from '../lib/precios'
import { COMPANY } from '../legal/config'
import Matricula from '../components/Matricula'
import { EJEMPLO_HEROE } from '../lib/expedienteEjemplo'
import SelloFoto from '../components/SelloFoto'
import Vehiculo from './devolucion/Vehiculo'
import { ANCHO, BTN_PRIMARIO, BTN_SECUNDARIO, CabeceraPortada, ENLACE, Pie, useTemaWeb } from './portadaComun'

/* ── LA PORTADA PARA EMPRESAS CON FURGONETAS (/ y /empresas, 14-11-2026, «Antes del perito») ──────────────────────
   Desde el 14-11-2026 «/» es esta página (antes, la de la app de reparto, que sigue en /repartidores y se enlaza
   abajo). /empresas enseña la misma, con la canónica en «/» (functions/empresas.js).

   Lo que se vende: enterarse del golpe el día que aparece. Cada conductor fotografía su furgoneta; en el repaso del día
   una PERSONA ve la foto de hoy junto a la anterior del mismo lado y marca lo nuevo; cada golpe queda con su día (y con
   su conductor solo cuando es seguro: una sola persona entre las dos fotos, un día o menos y la foto anterior repasada
   como igual), y cada furgoneta con su expediente para imprimir. La IA no se promete en ninguna frase.

   REGLAS: nada que la app no haga hoy; sin testimonios ni cifras de ahorro; los precios salen de lib/precios.js y, si
   contesta, de /billing/planes (como /planes); las cifras de la casa, de CIFRAS_CASA, tal cual; los datos del ejemplo,
   inventados y dichos como tales. Se mide con medirAccion('emp_*') y el embudo «empresas» de backend/analitica.py.
   Identidad (busqueda/interfaces.md §3): tinta sobre papel, el cian solo en la acción principal, reglas finas en vez
   de tarjetas, las fotos con su sello de fecha y la matrícula como pieza. Sin degradados, brillos ni rótulos en
   mayúsculas espaciadas. Los colores, de las variables --ld-* de index.css. */

/* Cifras reales de la empresa donde nació FDS, leídas en su panel el 13-11-2026. No inflarlas: si cambian, se cambian
   aquí. Las revisiones son «unas 200»: así se dicen. */
const CIFRAS_CASA = { naves: 3, furgonetas: 63, revisionesSemana: 200 }

/* El alta a la que lleva la página: la de FLOTA, no el selector de sectores. Con «otra» la cuenta nace con el panel de
   flota y su guía de primeros pasos. Registro.jsx lee `sector`, `plan` y `flota` y, con los dos primeros, salta el
   selector de sector y el de plan. El plan y las furgonetas son los que estén puestos en la calculadora, así el precio
   que se ve es el que se contrata; sin tocarla, el Esencial (el del «Desde 5 €») con sus 20 furgonetas. Las claves,
   las de PLAN_TARIFAS en backend/server.py: `operacion` (Esencial) y `completo` (Pro). */
const ALTA_EMPRESA = '/registro?sector=otra'
const PLAN_DE_ENTRADA = 'operacion'
/* El expediente de ejemplo, público (lo construye la zona del expediente en esta misma tanda). */
const EXPEDIENTE_EJEMPLO = '/expediente-ejemplo'
/* La calculadora no pinta precio por encima de esto: lib/precios.js no tiene umbral numérico para el plan «Empresa»
   (solo el texto «100 vehículos o más») y /planes corta su campo en 5000 (Planes.jsx). */
const TOPE_CALCULADORA = 5000
/* Desde aquí la calculadora recuerda que existe el plan Empresa, a medida: el «100 vehículos o más» de lib/precios.js. */
const DESDE_PLAN_A_MEDIDA = 100
const TRAMOS_FLOTA = ['1-9', '10-29', '30-99', '100+']
/* Lo que cabe en cada campo del formulario: /auth/lead guarda el nombre y la empresa hasta 120 caracteres y `plan` hasta
   1.000 (el prefijo con las furgonetas, el teléfono y el idioma ocupa menos de 100). El campo no deja escribir más, en
   vez de recortarlo sin avisar al enviar; el mensaje dice cuánto queda al acercarse. */
const LARGO = { nombre: 120, empresa: 120, correo: 254, telefono: 30, mensaje: 800 }

/* El ejemplo del héroe y de los recortes: datos INVENTADOS (lo dice debajo). Sale de lib/expedienteEjemplo.js, así que
   es la MISMA furgoneta y el MISMO golpe que /expediente-ejemplo: el de la puerta corredera del lateral derecho, que
   aparece el 12 de noviembre de 2026; la foto anterior de ese lado es del 11 y las dos las hizo Luis P., con la anterior
   repasada como «igual»: por la regla del servidor (`_perito_atribucion`) ese golpe SÍ tiene conductor atribuible. Las
   horas, en la hora local de quien mira, como el sello de verdad. El 12-11-2026 es jueves. */
const EJEMPLO = EJEMPLO_HEROE
/* Las fotos del ejemplo (las de la demo: la misma furgoneta, lateral derecho, sin golpe y con un golpe dibujado en la
   puerta corredera). El encuadre acerca la puerta: la foto se pinta al 190 % del ancho y se mueve; el cerco va en
   coordenadas de la foto entera (el golpe está hacia x 610-715 e y 400-460 de 1200 × 675). */
const FOTO_ANTES = '/demo/van-lateral.jpg'
const FOTO_HOY = '/demo/van-lateral-golpe-puerta.jpg'

/* Las compañías que cubre /devolucion-renting, escritas: las de COMPANIAS en lib/guiasRenting.js, en su orden y con su
   nombre (portada.spec.js lo compara; aquí no se importa ese fichero, que es grande, solo para ocho nombres). */
const COMPANIAS_DEVOLUCION = ['Ayvens', 'Alphabet', 'Volkswagen Financial Services', 'BMW Financial Services', 'Athlon', 'Arval', 'Hertz', 'Europcar']

/* Las preguntas: [pregunta, clave de la respuesta]. */
const PREGUNTAS_EMPRESA = [
  ['¿Quién decide si hay un golpe?', 'decide'],
  ['¿Dice quién llevaba la furgoneta?', 'conductor'],
  ['¿Los conductores tienen que instalar algo?', 'instalar'],
  ['¿Sirve si las furgonetas son mías y no de renting?', 'propias'],
  ['¿Mis datos se mezclan con los de otras empresas?', 'datos'],
  ['¿Cuánto cuesta y hay permanencia?', 'precio'],
  ['¿Cuánto se tarda en ponerlo en marcha?', 'tiempo'],
]

/* Euros en el idioma de la pantalla: «5 €» en español, «€5» en inglés, con el separador de miles de cada uno. */
function euros(n) {
  const dec = Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' })
      .format(n).replace(/[\u00a0\u202f]/g, ' ')
  } catch { return `${n} €` }
}
/* Un número con el separador de miles del idioma («5.000», «5,000»). */
function cifra(n) {
  try { return new Intl.NumberFormat(locale(), { useGrouping: 'always' }).format(n).replace(/[\u00a0\u202f]/g, ' ') } catch { return String(n) }
}
/* «jueves, 12 de noviembre» en el idioma de la pantalla. */
function diaLargo(d) {
  try { return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return d.toDateString() }
}

/* Cuántas furgonetas dice la calculadora, si es un número que se puede mandar al alta (1 … tope); si no, null. */
function flotaValida(texto) {
  const n = Math.floor(Number(texto))
  return Number.isFinite(n) && n >= 1 && n <= TOPE_CALCULADORA ? n : null
}
/* El alta con el plan y las furgonetas de la calculadora (sin un número que valga, sin `flota`). */
function altaCon(plan, texto) {
  const n = flotaValida(texto)
  return `${ALTA_EMPRESA}&plan=${encodeURIComponent(plan || PLAN_DE_ENTRADA)}${n ? `&flota=${n}` : ''}`
}

/* Los planes como los ve /planes: los de lib/precios.js y, encima, los que mande el servidor (Planes.jsx, el mismo
   cruce). Si no contesta, se quedan los de respaldo. */
function usePlanes() {
  const [planes, setPlanes] = useState(PLANES_EMPRESA)
  const [tramos, setTramos] = useState(DESCUENTOS_VOLUMEN)
  useEffect(() => {
    let vivo = true
    fetch(`${API_BASE}/billing/planes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return
        const lista = Array.isArray(d?.planes) ? d.planes : []
        setPlanes(PLANES_EMPRESA.map((f) => {
          const s = lista.find((p) => p.clave === f.clave)
          return s ? { ...f, ...s, desde: f.desde ?? d?.desde_empresa, color: f.color } : f
        }))
        if (Array.isArray(d?.descuentos_volumen) && d.descuentos_volumen.length) setTramos(d.descuentos_volumen)
      })
      .catch(() => { /* respaldo local */ })
    return () => { vivo = false }
  }, [])
  return { planes, tramos }
}

/* ── El producto, tal cual: una foto del mismo lado, antes y hoy ── */

/* Una foto del ejemplo, acercada a la puerta. `cerco`: el golpe marcado. `sello`: [fecha, quien]. */
function FotoEjemplo({ src, rotulo, hoy = false, cerco = false, fecha, quien, lang, alt }) {
  return (
    <div className="relative aspect-[8/7] overflow-hidden rounded-[10px] bg-[#d9dcd7]">
      <div className="absolute left-[-55%] top-[-21.5%] aspect-[1200/675] w-[190%]">
        <img src={src} alt={alt} width="1200" height="675" decoding="async" className="block h-full w-full" />
        {cerco && (
          <span aria-hidden="true" data-testid="emp-cerco" className="absolute rounded-[10px] border-[2.5px] border-[color:var(--ld-warn)]"
            style={{ left: '49%', top: '56.5%', width: '13%', height: '15.5%', boxShadow: '0 0 0 1.5px rgba(255,255,255,.85)' }} />
        )}
      </div>
      <span className={`absolute left-2.5 top-2.5 rounded-[4px] px-2 py-1 text-[0.75rem] font-bold leading-none ${hoy ? 'bg-[#10181A] text-white' : 'bg-white text-[#10181A]'}`}>{rotulo}</span>
      {/* En el móvil, sin el año ni el nombre: no caben en media pantalla (quién la llevaba lo dice la línea de debajo). */}
      <SelloFoto fecha={fecha} quien={quien} idioma={lang} className="hidden sm:block" />
      <SelloFoto fecha={fecha} idioma={lang} corto className="sm:hidden" />
    </div>
  )
}

function ProductoHeroe({ lang }) {
  return (
    <figure className="rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-3.5 sm:p-[18px]" data-testid="emp-producto">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 pb-3.5 pt-0.5">
        <div className="flex items-center gap-3">
          <Matricula texto={EJEMPLO.matricula} className="text-[1.0625rem] sm:text-[1.1875rem]" />
          <span className="text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('Lateral derecho')}</span>
        </div>
        <span className="text-[0.875rem] text-[color:var(--ld-muted)]">{tx('Repaso del {fecha}', { fecha: diaLargo(EJEMPLO.hoy.fecha) })}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <FotoEjemplo src={FOTO_ANTES} rotulo={tx('Antes')} fecha={EJEMPLO.antes.fecha} quien={EJEMPLO.antes.quien} lang={lang}
          alt={tx('La foto anterior del lateral derecho de la furgoneta, sin golpes.')} />
        <FotoEjemplo src={FOTO_HOY} rotulo={tx('Hoy')} hoy cerco fecha={EJEMPLO.hoy.fecha} quien={EJEMPLO.hoy.quien} lang={lang}
          alt={tx('La foto de hoy del mismo lado, con el golpe nuevo de la puerta corredera marcado.')} />
      </div>
      <figcaption className="px-1 pt-4">
        <p className="flex items-center gap-2.5 text-[1.0625rem] font-bold text-[color:var(--ld-text)]">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--ld-warn)]" />
          {tx('Golpe nuevo en la puerta corredera')}
        </p>
        <p className="mt-1 text-[0.9062rem] leading-snug text-[color:var(--ld-muted)]">
          {tx('Solo la llevó {conductor} entre las dos fotos. Lo marcó la oficina al repasar el día.', { conductor: EJEMPLO.hoy.quien }).split(EJEMPLO.hoy.quien).map((trozo, i) => (
            <span key={i}>{i > 0 && <b className="font-semibold text-[color:var(--ld-text)]">{EJEMPLO.hoy.quien}</b>}{trozo}</span>
          ))}
        </p>
        <p className="mt-3 text-[0.8125rem] text-[color:var(--ld-muted)]" data-testid="emp-ejemplo-inventado">{tx('Ejemplo con datos inventados')}</p>
      </figcaption>
    </figure>
  )
}

/* ── Los recortes de «Así funciona», hechos en HTML (no capturas) ── */

const RECORTE = 'rounded-[12px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)]'

/* La furgoneta del ejemplo dibujada de línea (como los planos de devolucion/Vehiculo.jsx): una de techo alto con la
   puerta corredera, vista de frente, de detrás o de lado (el morro a la derecha; `espejo`, a la izquierda). Las cuatro
   vistas del paso 1 van dibujadas: la demo no tiene foto de los cuatro lados de la misma furgoneta. */
const TRAZO = { fill: 'none', stroke: 'var(--ld-text)', strokeWidth: 1.3, strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }
const FINO = { ...TRAZO, stroke: 'var(--ld-muted)', strokeWidth: 1 }
function FurgonetaDibujo({ vista }) {
  const caja = 'M31 47 V13 Q31 8 36 8 H64 Q69 8 69 13 V47 Z'
  return (
    <svg viewBox="0 0 100 56" className="h-full w-full" aria-hidden="true" focusable="false" data-vista={vista}>
      {vista === 'lado' || vista === 'lado-espejo' ? (
        <g transform={vista === 'lado-espejo' ? 'matrix(-1 0 0 1 100 0)' : undefined}>
          <path d="M7 45 V12 Q7 9 10 9 H69 Q75 9 78 13 L87 26 Q94 28 95 32 V45 Z" {...TRAZO} fill="var(--ld-surface)" />
          <path d="M71 13 H77 L85 26 H71 Z" {...FINO} fill="var(--ld-surface2)" />
          <path d="M52 12 V44 M69 12 V44 M7 37 H95" {...FINO} />
          <circle cx="23" cy="45" r="5.5" {...TRAZO} fill="var(--ld-text)" />
          <circle cx="79" cy="45" r="5.5" {...TRAZO} fill="var(--ld-text)" />
        </g>
      ) : (
        <g>
          <path d="M32 47 h6 v5 h-6 Z M62 47 h6 v5 h-6 Z" {...TRAZO} fill="var(--ld-text)" />
          <path d={caja} {...TRAZO} fill="var(--ld-surface)" />
          {vista === 'frente' ? <>
            <path d="M34 15 H66 L67 28 H33 Z" {...FINO} fill="var(--ld-surface2)" />
            <path d="M31 21 h-5 v6 h5 M69 21 h5 v6 h-5" {...TRAZO} />
            <path d="M41 34 H59 V38 H41 Z M34 32.5 h5 v3.5 h-5 Z M61 32.5 h5 v3.5 h-5 Z M31 42 H69" {...FINO} />
          </> : <>
            <path d="M50 9 V47 M31 42 H69" {...TRAZO} />
            <path d="M35 13 h12 v10 h-12 Z M53 13 h12 v10 h-12 Z" {...FINO} fill="var(--ld-surface2)" />
            <path d="M31.5 26 h2.5 v10 h-2.5 Z M66 26 h2.5 v10 h-2.5 Z" {...FINO} fill="var(--ld-hueco)" />
          </>}
        </g>
      )}
    </svg>
  )
}

function RecorteFotos({ lang }) {
  /* Las cuatro vistas de la revisión de la MISMA furgoneta, las cuatro dibujadas (tanda 4): la demo solo tiene foto del
     lateral derecho, y tres dibujos y una foto juntos se leían como dos cosas distintas. Es un dibujo del móvil, no una
     captura. */
  const vistas = [['frente', tx('Frontal')], ['lado-espejo', tx('Izquierdo')], ['lado', tx('Derecho')], ['detras', tx('Trasera')]]
  return (
    <div className={`${RECORTE} p-3.5`} aria-hidden="true" data-testid="emp-recorte-fotos">
      <div className="grid grid-cols-4 gap-1.5">
        {vistas.map(([vista, nombre]) => (
          <div key={vista} className="min-w-0">
            <div className="relative aspect-[10/7] overflow-hidden rounded-[6px] bg-[color:var(--ld-fill)]">
              <FurgonetaDibujo vista={vista} />
            </div>
            <p className="mt-1.5 text-center text-[0.75rem] leading-tight text-[color:var(--ld-muted)] [overflow-wrap:anywhere]">{nombre}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[0.8125rem]">
        <span className="font-mono text-[color:var(--ld-muted)]">{selloDeFecha(EJEMPLO.hoy.fecha, { corto: true, idioma: lang })}</span>
        <b className="font-bold text-[color:var(--ld-ok)]">{tx('Enviada')}</b>
      </div>
    </div>
  )
}

function RecorteRepaso() {
  const filas = [[tx('Iguales que la anterior'), 29, false], [tx('Con un golpe nuevo'), 2, true], [tx('Sin revisar hoy'), 3, false]]
  return (
    <div className={`${RECORTE} px-3.5 py-3`} aria-hidden="true">
      <div className="flex justify-between text-[0.875rem] font-bold text-[color:var(--ld-text)]">
        <span>{tx('Repaso de hoy')}</span><span className="font-mono font-medium">31 / 48</span>
      </div>
      <div className="my-2.5 h-2 overflow-hidden rounded-[4px] bg-[color:var(--ld-hueco)]"><i className="block h-full w-[65%] bg-[color:var(--ld-text)]" /></div>
      {filas.map(([t, n, rojo]) => (
        <div key={t} className="flex justify-between border-t border-[color:var(--ld-border)] py-1.5 text-[0.875rem] text-[color:var(--ld-text)]">
          <span>{t}</span><b className={`font-mono font-semibold ${rojo ? 'text-[color:var(--ld-warn)]' : ''}`}>{n}</b>
        </div>
      ))}
    </div>
  )
}

/* Un mes de revisiones de una furgoneta: casi todos los días revisada, cuatro sin revisar y un golpe (fijo, sin azar). */
const SIN_REVISAR = [8, 15, 22, 29]
const DIA_GOLPE = 12
function RecorteExpediente() {
  return (
    <div className={`${RECORTE} px-4 py-3.5`} aria-hidden="true">
      <p className="text-[0.7812rem] font-semibold text-[color:var(--ld-muted)]">{tx('Expediente del vehículo')}</p>
      <Matricula texto={EJEMPLO.matricula} className="mt-1.5 text-[0.9375rem]" />
      <div className="mt-3 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[2px]">
        {Array.from({ length: 30 }, (_, k) => k + 1).map((d) => (
          <i key={d} className={`block h-[10px] rounded-[1.5px] ${d === DIA_GOLPE ? 'bg-[color:var(--ld-warn)]' : SIN_REVISAR.includes(d) ? 'bg-[color:var(--ld-hueco)]' : 'bg-[color:var(--ld-text)]'}`} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.75rem] text-[color:var(--ld-muted)]">
        {[[tx('Revisada'), 'bg-[color:var(--ld-text)]'], [tx('Sin revisar'), 'bg-[color:var(--ld-hueco)]'], [tx('Golpe nuevo'), 'bg-[color:var(--ld-warn)]']].map(([t, c]) => (
          <span key={t} className="inline-flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-[1.5px] ${c}`} />{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ── El precio: la cuenta con tus furgonetas ── */

/* El precio sale de precioMes(), la misma función que /planes, con su mínimo y su descuento. `furgonetas` y `clave` (el
   plan) viven en la página: el alta se lleva los dos (`&plan=…&flota=N`), así lo que se contrata es lo que se ve. */
function Calculadora({ planes, tramos, furgonetas, setFurgonetas, clave, setClave }) {
  const porVehiculo = planes.filter((p) => Number(p.por_vehiculo) > 0)
  const aMedida = planes.find((p) => !Number(p.por_vehiculo)) || PLANES_EMPRESA[2]
  const [cargo, setCargo] = useState('')
  const medida = useRef(false)
  const usar = () => { if (!medida.current) { medida.current = true; medirAccion('emp_calculadora') } }

  const plan = porVehiculo.find((p) => p.clave === clave) || porVehiculo[0]
  if (!plan) return null
  const escrito = Number(furgonetas)
  const hayN = escrito >= 1
  const demasiadas = escrito > TOPE_CALCULADORA
  const n = Math.max(1, Math.min(TOPE_CALCULADORA, Math.floor(escrito) || 0))
  const mes = precioMes(plan, n, tramos)
  const pct = descuentoVolumen(Math.max(n, plan.minimo_vehiculos || 0), tramos)
  const euroCargo = Number(String(cargo).replace(',', '.'))
  const meses = euroCargo > 0 && mes > 0 ? Math.floor(euroCargo / mes) : null
  // Al salir del campo, el número que se ve es el entero con el que se calcula («2.5» → «2»).
  const alSalir = () => { if (escrito >= 1 && !Number.isInteger(escrito)) setFurgonetas(String(Math.floor(escrito))) }

  const campo = 'h-[52px] w-full rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 text-[1.0625rem] font-semibold text-[color:var(--ld-text)] tabular-nums focus:border-[color:var(--ld-text)] focus:outline-none'
  const nota = 'mt-2 text-[0.875rem] text-[color:var(--ld-muted)]'
  return (
    <div className="grid gap-6 rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-5 sm:p-7 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="emp-furgonetas" className="block text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('¿Cuántas furgonetas tienes?')}</label>
          <input id="emp-furgonetas" type="number" inputMode="numeric" min="1" step="1" value={furgonetas}
            onChange={(e) => { usar(); setFurgonetas(e.target.value) }} onBlur={alSalir} className={`${campo} mt-2 font-mono`} />
        </div>
        {/* Un conmutador de dos: botones con aria-pressed (un role=radio pide flechas y un solo Tab). */}
        {/* Los dos del mismo ancho, en dos líneas: el nombre del plan y su precio por vehículo. */}
        <div role="group" aria-label={tx('Plan')} className="grid grid-cols-2 gap-2">
          {porVehiculo.map((p) => (
            <button key={p.clave} type="button" aria-pressed={p.clave === plan.clave}
              onClick={() => { usar(); setClave(p.clave) }}
              className={`min-h-[56px] rounded-[10px] border-[1.5px] px-3.5 py-2 text-left transition-colors ${p.clave === plan.clave
                ? 'border-[color:var(--ld-text)] text-[color:var(--ld-text)]'
                : 'border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`}>
              <span className="block text-[0.9375rem] font-bold leading-tight">{tx('Plan {plan}', { plan: tx(p.nombre) })}</span>
              <span className="mt-0.5 block text-[0.8125rem] font-medium leading-tight">{tx('{precio}/vehículo', { precio: euros(Number(p.por_vehiculo)) })}</span>
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="emp-cargo" className="block text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('¿De cuánto fue el último cargo por daños que te pasaron?')}</label>
          <div className="relative mt-2">
            <input id="emp-cargo" type="number" inputMode="decimal" min="0" step="1" value={cargo} placeholder={tx('En euros')}
              onChange={(e) => { usar(); setCargo(e.target.value) }} className={`${campo} pr-10 font-mono placeholder:font-sans placeholder:font-normal placeholder:text-[color:var(--ld-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
            <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[1rem] text-[color:var(--ld-muted)]">€</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-start border-t border-[color:var(--ld-border)] pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0" aria-live="polite" data-testid="emp-resultado">
        {demasiadas ? (
          /* Por encima del tope no se pinta un precio que no corresponde al número escrito. */
          <p className="text-[1.0625rem] leading-snug text-[color:var(--ld-text)]" data-testid="emp-a-medida">
            {tx('Para más de {n} vehículos, el plan {plan} es a medida.', { n: cifra(TOPE_CALCULADORA), plan: tx(aMedida.nombre) })}{' '}
            <a href="#demo" onClick={() => medirAccion('emp_demo_calculadora')} className={ENLACE}>{tx('Cuéntanos tu flota')}</a>
          </p>
        ) : hayN ? (<>
          {/* En tres líneas (tanda 4): la etiqueta pequeña, la cifra sola y las notas. Antes, una frase con la cifra en
              grande dentro que se partía por la mitad. */}
          <p className="text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('Al mes, con el plan {plan}', { plan: tx(plan.nombre) })}</p>
          <p data-testid="emp-precio" data-precio={mes} className="ld-titular mt-2 text-[2.75rem] leading-none tabular-nums text-[color:var(--ld-text)]">{euros(mes)}</p>
          {n < (plan.minimo_vehiculos || 0) && (
            <p className={nota}>{tx('El plan {plan} factura como mínimo {n} vehículos.', { plan: tx(plan.nombre), n: plan.minimo_vehiculos })}</p>
          )}
          {pct > 0 && <p className={nota}>{tx('Ya con el {pct} % de descuento por volumen.', { pct })}</p>}
          {n >= DESDE_PLAN_A_MEDIDA && (
            <p className={nota} data-testid="emp-plan-a-medida">
              {tx('Con {n} vehículos o más también tienes el plan {plan}, a medida.', { n: DESDE_PLAN_A_MEDIDA, plan: tx(aMedida.nombre) })}{' '}
              <a href="#demo" onClick={() => medirAccion('emp_demo_calculadora')} className={ENLACE}>{tx('Cuéntanos tu flota')}</a>
            </p>
          )}
          {meses != null && (
            /* Solo la cuenta: cuántos meses de la cuota son ese cargo. No promete que se vaya a evitar. */
            <p className="mt-4 text-[1.0625rem] font-semibold leading-snug text-[color:var(--ld-text)]" data-testid="emp-meses">
              {meses > 120 ? tx('Un cargo así equivale a más de 10 años de {marca} para tu flota.', { marca: MARCA.nombre })
                : meses >= 2 ? tx('Un cargo así equivale a {n} meses de {marca} para tu flota.', { n: cifra(meses), marca: MARCA.nombre })
                  : meses === 1 ? tx('Un cargo así equivale a un mes de {marca} para tu flota.', { marca: MARCA.nombre })
                    : tx('Un cargo así no llega a un mes de {marca} para tu flota.', { marca: MARCA.nombre })}
            </p>
          )}
          <p className="mt-4 text-[0.8125rem] text-[color:var(--ld-muted)]">{tx('Precios sin IVA. Pago mensual, sin permanencia.')}</p>
        </>) : (
          <p className="text-[0.9375rem] text-[color:var(--ld-muted)]">{tx('Pon cuántas furgonetas tienes.')}</p>
        )}
      </div>
    </div>
  )
}

/* ── «Que me la enseñen»: va a POST /auth/lead (capture_lead en server.py), que lo guarda en el CRM y en la Bandeja y
   avisa al dueño. `plan` empieza por «DEMO EMPRESAS» para distinguirlo en la Bandeja. `alEnviar`: la página esconde
   entonces el «Que me la enseñen» del cierre (ya está pedida). ── */
function FormularioDemo({ alEnviar }) {
  const [f, setF] = useState({ nombre: '', empresa: '', correo: '', telefono: '', flota: '', mensaje: '' })
  const [estado, setEstado] = useState('')        // '' | 'enviando' | 'ok' | 'error'
  const [aviso, setAviso] = useState('')           // el texto del recibido o del error
  const [falta, setFalta] = useState(null)         // { texto, campo }: el primer campo que no vale
  const enviando = useRef(false)                    // dos toques seguidos no mandan dos veces
  const abierto = useRef(false)
  const recibido = useRef(null)
  const soltar = () => { enviando.current = false }   // tras un error, se puede volver a enviar
  const cambia = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))
  const alAbrir = () => { if (!abierto.current) { abierto.current = true; medirAccion('emp_form_abrir') } }

  // El recibido sustituye a un formulario mucho más alto: se lleva a la vista y recibe el foco (si no, en el móvil
  // queda fuera de la pantalla y el foco cae al body).
  useEffect(() => {
    if (estado !== 'ok' || !recibido.current) return
    try { recibido.current.scrollIntoView({ block: 'center' }) } catch { /* navegador viejo */ }
    recibido.current.focus({ preventScroll: true })
  }, [estado])
  // El aviso de un campo mal, a la vista aunque el campo quede justo al borde de la pantalla (el foco ya está en él).
  useEffect(() => {
    if (!falta) return
    try { document.getElementById('emp-falta')?.scrollIntoView({ block: 'nearest' }) } catch { /* navegador viejo */ }
  }, [falta])

  async function enviar(e) {
    e.preventDefault()
    if (enviando.current) return
    const correo = f.correo.trim()
    const mal = !f.nombre.trim() ? { texto: tx('Pon tu nombre.'), campo: 'emp-nombre' }
      : !f.empresa.trim() ? { texto: tx('Pon el nombre de tu empresa.'), campo: 'emp-empresa' }
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? { texto: tx('Pon un correo válido.'), campo: 'emp-correo' }
          : !f.flota ? { texto: tx('Elige cuántas furgonetas tienes.'), campo: 'emp-flota' } : null
    setFalta(mal)
    if (mal) { document.getElementById(mal.campo)?.focus(); return }
    enviando.current = true
    setEstado('enviando'); setAviso('')
    medirAccion('emp_form_enviar')
    const plan = [
      'DEMO EMPRESAS', `furgonetas: ${f.flota}`, `tel: ${f.telefono.trim() || '-'}`, `idioma: ${idioma()}`,
      f.mensaje.trim() && `mensaje: ${f.mensaje.trim()}`,
    ].filter(Boolean).join(' · ').slice(0, 1000)
    try {
      const r = await fetch(`${API_BASE}/auth/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.nombre.trim().slice(0, 120), company: f.empresa.trim().slice(0, 120), email: correo, plan }),
      })
      let j = null
      try { j = await r.json() } catch { /* sin cuerpo */ }
      if (!r.ok) {
        const d = j?.detail
        throw new Error(typeof d === 'string' && d.trim() ? tx(d) : tx('No se ha podido enviar. Inténtalo otra vez en un momento.'))
      }
      medirAccion('emp_form_ok')
      // El recibido es el de la página (sin exclamaciones, como todo lo demás): el del servidor no cambia lo que dice.
      setAviso(tx('Recibido. Te respondemos en menos de 24 horas hábiles.'))
      setEstado('ok')
      alEnviar?.()
    } catch (err) {
      medirAccion('emp_form_error')
      const red = err instanceof TypeError   // fetch sin red
      setAviso(red || !err?.message ? tx('No se ha podido enviar: parece que no hay conexión. Inténtalo otra vez.') : err.message)
      setEstado('error')
      soltar()
    }
  }

  if (estado === 'ok') {
    return (
      <div ref={recibido} tabIndex={-1} role="status" data-testid="emp-recibido"
        className="rounded-[20px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-7 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--ld-text)]">
        <p className="flex items-start gap-3 text-[1.125rem] font-semibold text-[color:var(--ld-text)]">
          <span aria-hidden="true" className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--ld-ok)]" />{aviso}
        </p>
      </div>
    )
  }
  const quedan = LARGO.mensaje - f.mensaje.length
  const campo = 'mt-1.5 h-[52px] w-full rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 text-[1rem] text-[color:var(--ld-text)] focus:border-[color:var(--ld-text)] focus:outline-none aria-[invalid=true]:border-[color:var(--ld-warn)]'
  const etiqueta = 'block text-[0.9375rem] font-semibold text-[color:var(--ld-text)]'
  // El campo que falla lleva aria-invalid y apunta al aviso.
  const marca = (id) => (falta?.campo === id ? { 'aria-invalid': true, 'aria-describedby': 'emp-falta' } : {})
  /* El aviso, justo debajo del campo que falla: al pie del formulario, en el móvil quedaba fuera de la pantalla. */
  const avisoDe = (id) => (falta?.campo === id
    ? <p id="emp-falta" role="alert" className="mt-1.5 text-[0.875rem] font-semibold text-[color:var(--ld-warn)]">{falta.texto}</p> : null)
  return (
    <form noValidate onSubmit={enviar} onFocus={alAbrir} className="rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="emp-nombre" className={etiqueta}>{tx('Tu nombre')}</label>
          <input id="emp-nombre" autoComplete="name" maxLength={LARGO.nombre} value={f.nombre} onChange={cambia('nombre')} className={campo} {...marca('emp-nombre')} />{avisoDe('emp-nombre')}</div>
        {/* «Tu empresa»: «Empresa» es también el nombre del plan a medida («Enterprise» en inglés). */}
        <div><label htmlFor="emp-empresa" className={etiqueta}>{tx('Tu empresa')}</label>
          <input id="emp-empresa" autoComplete="organization" maxLength={LARGO.empresa} value={f.empresa} onChange={cambia('empresa')} className={campo} {...marca('emp-empresa')} />{avisoDe('emp-empresa')}</div>
        {/* El correo, a lo ancho; el teléfono y las furgonetas, juntos (tanda 4): la de las furgonetas iba sola a media fila. */}
        <div className="sm:col-span-2"><label htmlFor="emp-correo" className={etiqueta}>{tx('Correo')}</label>
          <input id="emp-correo" type="email" autoComplete="email" inputMode="email" maxLength={LARGO.correo} value={f.correo} onChange={cambia('correo')} className={campo} {...marca('emp-correo')} />{avisoDe('emp-correo')}</div>
        <div><label htmlFor="emp-telefono" className={etiqueta}>{tx('Teléfono (opcional)')}</label>
          <input id="emp-telefono" type="tel" autoComplete="tel" maxLength={LARGO.telefono} value={f.telefono} onChange={cambia('telefono')} className={campo} /></div>
        <div><label htmlFor="emp-flota" className={etiqueta}>{tx('¿Cuántas furgonetas?')}</label>
          <select id="emp-flota" value={f.flota} onChange={cambia('flota')} className={campo} {...marca('emp-flota')}>
            <option value="">{tx('Elige')}</option>
            {TRAMOS_FLOTA.map((t) => <option key={t} value={t}>{t === '100+' ? tx('100 o más') : t}</option>)}
          </select>{avisoDe('emp-flota')}</div>
        <div className="sm:col-span-2"><label htmlFor="emp-mensaje" className={etiqueta}>{tx('Mensaje (opcional)')}</label>
          <textarea id="emp-mensaje" rows={3} maxLength={LARGO.mensaje} value={f.mensaje} onChange={cambia('mensaje')} className={`${campo} h-auto py-3`}
            aria-describedby={quedan <= 100 ? 'emp-quedan' : undefined} />
          {quedan <= 100 && <p id="emp-quedan" aria-live="polite" data-testid="emp-quedan" className="mt-1.5 text-[0.875rem] text-[color:var(--ld-muted)]">
            {quedan === 1 ? tx('Queda 1 carácter.') : tx('Quedan {n} caracteres.', { n: quedan })}</p>}</div>
      </div>
      {estado === 'error' && <p role="alert" data-testid="emp-error" className="mt-4 text-[0.875rem] font-semibold text-[color:var(--ld-warn)]">{aviso}</p>}
      {/* Con borde (tanda 4): el único cian de la portada es «Probar con mis furgonetas». */}
      <button type="submit" disabled={estado === 'enviando'} className={`${BTN_SECUNDARIO} mt-6 w-full sm:w-auto`}>
        {estado === 'enviando' ? <><Loader2 size={16} className="animate-spin" /> {tx('Enviando…')}</> : tx('Pedir la demostración')}
      </button>
      <p className="mt-4 text-[0.8125rem] leading-relaxed text-[color:var(--ld-muted)]">
        {tx('Trata estos datos {titular}, responsable de {marca}, solo para contestarte y enseñarte el producto.', { titular: COMPANY.legalName, marca: MARCA.nombre })}{' '}
        <a href="/privacidad" className={ENLACE}>{tx('Política de privacidad')}</a>
      </p>
    </form>
  )
}

/* Las dos columnas de las secciones del precio hacia abajo: el título en 5/12 y lo demás en 7/12. */
const COLUMNAS = 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16'

/* Un título de sección: Archivo 800, sin rótulo encima. */
function H2({ children, className = '', id }) {
  return <h2 id={id} className={`ld-titular text-[1.875rem] leading-[1.06] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[2.5rem] ${className}`}>{children}</h2>
}

export default function Empresas() {
  const lang = useIdioma()
  const titulo = tx('{marca} para empresas con furgonetas · El golpe, el día que aparece', { marca: MARCA.nombre })
  useEffect(() => {
    document.title = titulo
    try { document.documentElement.lang = lang } catch { /* nada */ }
    // Al salir, el título neutro de la marca (el de index.html), no el de la portada: lo heredaría la página siguiente.
    return () => { document.title = MARCA.nombre }
  }, [titulo, lang])
  const [tema, setTema] = useTemaWeb()
  const { planes, tramos } = usePlanes()
  // Los de la calculadora: el alta se los lleva. Sin tocarla, el Esencial (el del «Desde 5 €»).
  const [furgonetas, setFurgonetas] = useState('20')
  const [clave, setClave] = useState(PLAN_DE_ENTRADA)
  const [demoPedida, setDemoPedida] = useState(false)
  const alta = altaCon(clave, furgonetas)
  // Sigue en la página a los 10 s: una vez por visita (como rep_10s en /repartidores).
  useEffect(() => { const t = setTimeout(() => medirAccion('emp_10s'), 10000); return () => clearTimeout(t) }, [])

  const esencial = planes.find((p) => p.clave === 'operacion') || PLANES_EMPRESA[0]
  const pro = planes.find((p) => p.clave === 'completo') || PLANES_EMPRESA[1]
  const aMedida = planes.find((p) => !Number(p.por_vehiculo)) || PLANES_EMPRESA[2]
  const desde = Math.min(...planes.map((p) => Number(p.por_vehiculo)).filter((x) => x > 0))

  function respuesta(k) {
    if (k === 'decide') return tx('Una persona de tu oficina. En el repaso del día ve la foto de hoy junto a la anterior del mismo lado y marca lo que sea nuevo, sobre la foto. El expediente de cada furgoneta solo lleva los golpes que ha marcado o confirmado una persona.')
    if (k === 'conductor') return tx('Solo cuando se sabe con seguridad: si entre las dos fotos la llevó una sola persona, en un día o menos, y la foto anterior de ese lado se repasó y estaba igual. Si no, el golpe queda sin conductor atribuible y se dice por qué.')
    if (k === 'datos') return tx('No. Cada empresa tiene su propia base de datos, separada de las de las demás. Y los datos son tuyos: si te vas, te los devolvemos o los borramos, lo que elijas.')
    if (k === 'instalar') return tx('No. Cada uno entra desde el navegador del móvil con su propio enlace, que le mandas por WhatsApp: sin correo, sin contraseña y sin instalar nada.')
    if (k === 'propias') return tx('Sí. La revisión con fotos, el taller, la ITV y los mantenimientos funcionan igual. El proveedor y el fin del renting solo se rellenan si los tienes.')
    if (k === 'tiempo') return tx('Son cuatro pasos y puedes dejarlos a medias: pegas las matrículas, pegas la lista de conductores con su nombre y su móvil, le mandas a cada uno su enlace por WhatsApp y esperas la primera revisión, que llega en cuanto el primero hace sus fotos.')
    return [
      tx('{plan1}: {p1} por vehículo y mes, con un mínimo de {m1} vehículos facturados. {plan2}: {p2} por vehículo y mes, con un mínimo de {m2}. Para flotas grandes, el plan {plan3}, a medida.', {
        plan1: tx(esencial.nombre), p1: euros(Number(esencial.por_vehiculo)), m1: esencial.minimo_vehiculos,
        plan2: tx(pro.nombre), p2: euros(Number(pro.por_vehiculo)), m2: pro.minimo_vehiculos, plan3: tx(aMedida.nombre) }),
      tx('Usuarios y conductores, sin límite. Descuento por volumen: {lista}.', {
        lista: tramos.map((t) => tx('un {pct} % desde {n} vehículos', { pct: t.pct, n: t.desde })).join(', ') }),
      tx('Con pago mensual no hay permanencia: cancelas cuando quieras y sigues hasta el final del mes pagado. Con pago anual pagas {meses} meses y tienes el año entero.', { meses: MESES_ANUAL }),
      tx('Pruébalo {n} días con tus furgonetas, sin tarjeta. Precios sin IVA.', { n: DIAS_PRUEBA_EMPRESA }),
    ].join(' ')
  }

  const PASOS = [
    ['01', tx('El conductor hace cuatro fotos'), tx('Frontal, trasera y los dos laterales, más los kilómetros. Desde su móvil, cuando lo diga tu empresa: cada conductor, una revisión por furgoneta y día.'), <RecorteFotos key="r1" lang={lang} />],
    ['02', tx('Tú repasas el día en unos minutos'), tx('Cada foto de hoy aparece junto a la anterior del mismo lado. Si está igual, pasas a la siguiente. Si hay algo nuevo, lo marcas sobre la foto.'), <RecorteRepaso key="r2" />],
    ['03', tx('Cada golpe queda con su día'), tx('Y con quién la llevaba, solo cuando se sabe con seguridad. Cada furgoneta tiene su expediente: cómo entró, qué le ha pasado y cuándo, listo para imprimir.'), <RecorteExpediente key="r3" />],
  ]
  /* Los cuatro pasos del arranque, con los verbos de la pantalla (alta.p1-p4 en i18nDict.js). */
  const ARRANQUE = [
    [tx('Pegas las matrículas'), tx('Una por línea. Antes de guardar ves cuáles entran y cuáles no.')],
    [tx('Pegas la lista de conductores'), tx('Nombre y móvil, uno por línea.')],
    [tx('Le mandas a cada uno su enlace por WhatsApp'), tx('Con un toque entra desde su móvil: sin correo, sin contraseña y sin instalar nada.')],
    [tx('Ves llegar la primera revisión'), tx('Llega en cuanto el primero hace las fotos de su furgoneta.')],
  ]

  return (
    /* overflow-x-clip (no hidden): no crea un contenedor de desplazamiento, así la cabecera `sticky` se queda arriba. */
    <div className="ld-root min-h-screen overflow-x-clip font-sans text-[1.0625rem] leading-normal antialiased" data-theme={tema} data-testid="portada-empresas">
      {/* ── La cabecera (la misma que /planes: portadaComun.jsx) ── */}
      <CabeceraPortada alta={alta} enPortada />

      {/* ── Héroe: el titular y, a la derecha, el producto ── */}
      <header className={`${ANCHO} grid items-center gap-10 pb-16 pt-9 sm:pb-20 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[540px_minmax(0,1fr)] xl:gap-16`}>
        <div>
          <p className="text-[0.9375rem] font-semibold text-[color:var(--ld-accent)]">{tx('Para empresas con furgonetas')}</p>
          <h1 className="ld-titular mt-4 text-[2.75rem] leading-[0.98] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[3.625rem] xl:text-[4rem]">
            {tx('El golpe, el día que aparece. No el día que te lo cobran.')}
          </h1>
          <p className="mt-6 max-w-[500px] text-[1.125rem] leading-[1.5] text-[color:var(--ld-text2)] sm:text-[1.1875rem]">
            {tx('Cada conductor fotografía su furgoneta desde el móvil. Tú ves la foto de hoy junto a la anterior del mismo lado y marcas lo que sea nuevo. Así puedes arreglarlo en tu taller antes de que lo vea el perito del renting.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={alta} onClick={() => medirAccion('emp_probar_arriba')} className={`${BTN_PRIMARIO} w-full sm:w-auto`} data-testid="emp-probar">{tx('Probar con mis furgonetas')}</a>
            <a href={EXPEDIENTE_EJEMPLO} onClick={() => medirAccion('emp_expediente_arriba')} className={`${BTN_SECUNDARIO} w-full sm:w-auto`} data-testid="emp-expediente">{tx('Ver un expediente de ejemplo')}</a>
          </div>
          <p className="mt-4 text-[0.9062rem] text-[color:var(--ld-muted)]" data-testid="emp-linea-precio">
            <b className="font-semibold text-[color:var(--ld-text)]">{tx('Desde {precio} por furgoneta y mes.', { precio: euros(desde) })}</b>{' '}
            {tx('{n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}
          </p>
        </div>
        <ProductoHeroe lang={lang} />
      </header>

      {/* ── Así funciona ── */}
      <section id="como" className={`${ANCHO} scroll-mt-20`}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] pb-10 pt-14 sm:pt-[72px] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <div>
            <H2>{tx('Así funciona')}</H2>
            <p className="mt-3.5 text-[0.9688rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Sin aparatos en la furgoneta ni nada que instalar en la oficina. Cada conductor entra desde el móvil con su propio enlace, sin correo ni contraseña.')}</p>
          </div>
          <div>
          <ol>
            {PASOS.map(([n, t, d, recorte]) => (
              <li key={n} className="grid gap-5 border-t border-[color:var(--ld-border)] py-7 md:grid-cols-[minmax(0,1fr)_300px] md:gap-10" data-testid="emp-paso">
                <div>
                  <span className="mb-2.5 block font-mono text-[0.875rem] font-medium text-[color:var(--ld-muted)]">{n}</span>
                  <h3 className="text-[1.4375rem] font-bold leading-[1.15] tracking-[-0.015em] text-[color:var(--ld-text)] sm:text-[1.5625rem]">{t}</h3>
                  <p className="mt-2 max-w-[470px] text-[1.0312rem] leading-relaxed text-[color:var(--ld-text2)]">{d}</p>
                </div>
                {recorte}
              </li>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* ── La herramienta gratuita (/devolucion-renting), con banda propia (tanda 4): antes era una línea suelta al final de
          «Así funciona». Las compañías, escritas (sin logotipos) y las mismas que lib/guiasRenting.js (lo vigila
          portada.spec.js). El dibujo es el de la propia herramienta (devolucion/Vehiculo.jsx), con una zona marcada en tinta (el único cian es «Probar con mis furgonetas»). Sin
          prometer ahorro ni decir «te lo cobrarán». ── */}
      <section className={ANCHO} data-testid="emp-banda-devolucion" aria-labelledby="emp-devolucion-titulo">
        <div className="grid items-center gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-[72px] lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <div className="order-2 lg:order-1">
            <H2 id="emp-devolucion-titulo">{tx('¿Qué te van a cobrar al devolverlo?')}</H2>
            <p className="mt-4 max-w-[540px] text-[1.0625rem] leading-relaxed text-[color:var(--ld-text2)]">
              {tx('Elige tu compañía de renting y da una vuelta a la furgoneta con su propia guía de devolución. Sale lo que no da por bueno, con su página.')}
            </p>
            {/* Cada compañía, entera en su línea, con el «·» DELANTE (tanda 5, U6): detrás se quedaba colgado al final de
                la línea («Alphabet ·»). La lista entra 2ch por la izquierda en una caja que recorta, así el «·» de la
                primera de cada línea cae fuera y no se ve: ni cuelga al final ni abre la línea siguiente. */}
            <div className="mt-6 max-w-[560px] overflow-hidden">
              <ul className="-ml-[2ch] flex flex-wrap font-mono text-[0.875rem] leading-[1.7] text-[color:var(--ld-muted)]" data-testid="emp-companias">
                {COMPANIAS_DEVOLUCION.map((c) => (
                  <li key={c} className="whitespace-nowrap before:inline-block before:w-[2ch] before:text-center before:content-['·']">{c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <a href="/devolucion-renting" onClick={() => medirAccion('emp_devolucion')} data-testid="emp-devolucion" className={`${BTN_SECUNDARIO} w-full sm:w-auto`}>
                {tx('Repasar mi furgoneta')}
              </a>
            </div>
            <p className="mt-3 text-[0.9062rem] text-[color:var(--ld-muted)]">{tx('Gratis. Sin registro. No guardamos nada de tu vehículo.')}</p>
          </div>
          <figure aria-hidden="true" data-testid="emp-devolucion-dibujo"
            className="order-1 flex items-center justify-center rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] py-8 lg:order-2 lg:py-12">
            {/* El plano va tumbado (el morro a la derecha): de pie, la caja era el doble de alta que el texto. El hueco es
                el del dibujo ya girado; el SVG conserva su caja de pie y se gira en su centro. */}
            <span className="flex h-[110px] w-[220px] items-center justify-center lg:h-[150px] lg:w-[300px]">
              <Vehiculo tipo="furgoneta" zona="paragolpes" marca="var(--ld-text)" className="h-[220px] w-[110px] rotate-90 lg:h-[300px] lg:w-[150px]" />
            </span>
          </figure>
        </div>
      </section>

      {/* ── De dónde sale: las cifras de la casa ── */}
      {/* La columna del título a 500 en todo el ordenador (tanda 6; en la 5, solo desde 1280): en 440, en alemán («Es
          entstand nicht im Büro…») caía en tres líneas entre 1024 y 1279 px. */}
      <section className="bg-[color:var(--ld-banda)] text-[color:var(--ld-banda-texto)]" data-testid="emp-nave">
        <div className={`${ANCHO} grid items-end gap-10 py-14 sm:py-[76px] lg:grid-cols-[500px_minmax(0,1fr)] lg:gap-16`}>
          <div>
            <h2 className="ld-titular text-[1.875rem] leading-[1.06] [text-wrap:balance] sm:text-[2.5rem]">{tx('No salió de una oficina. Salió de una nave.')}</h2>
            <p className="mt-4 max-w-[430px] text-[1.0625rem] leading-relaxed text-[color:var(--ld-banda-suave)]">
              {tx('{marca} se hizo dentro de una empresa de reparto, para su propio día a día. Allí la usan cada día con sus conductores.', { marca: MARCA.nombre })}
            </p>
          </div>
          <dl className="grid grid-cols-3 border-t border-[color:var(--ld-banda-linea)]">
            {[[String(CIFRAS_CASA.naves), tx('naves'), ''], [String(CIFRAS_CASA.furgonetas), tx('furgonetas'), ''],
              [String(CIFRAS_CASA.revisionesSemana), tx('revisiones con foto a la semana, más o menos')]].map(([n, t], i) => (
              <div key={t} className={`flex flex-col-reverse justify-end pt-5 ${i ? 'border-l border-[color:var(--ld-banda-linea)] pl-4 sm:pl-7' : 'pr-2'}`}>
                <dt className="mt-2.5 text-[0.875rem] leading-snug text-[color:var(--ld-banda-suave)] sm:text-[0.9375rem]">{t}</dt>
                {/* La cifra sola; el «más o menos» va en la etiqueta (tanda 4): delante, en pequeño, descuadraba la cifra. */}
                <dd className="ld-titular text-[2.125rem] leading-none tabular-nums sm:text-[4rem]">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Precio ── */}
      {/* Del precio hacia abajo, la columna del título es 5/12 (tanda 4): en 300 px los títulos largos caían en 3 y 4 líneas. */}
      <section id="precio" className={`${ANCHO} grid scroll-mt-20 gap-8 py-14 sm:py-20 ${COLUMNAS}`}>
        <div>
          <H2>{tx('Lo que cuesta')}</H2>
          <p className="mt-3.5 text-[0.9688rem] leading-relaxed text-[color:var(--ld-muted)]">
            {tx('Pagas por furgoneta y mes. Usuarios y conductores, sin límite. {n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}
          </p>
          <p className="mt-2 text-[0.9375rem]"><a href="/planes" onClick={() => medirAccion('emp_precios_modulos')} className={`${ENLACE} gap-1.5`}>{tx('Ver qué lleva cada plan')} <ArrowRight size={15} /></a></p>
        </div>
        <Calculadora planes={planes} tramos={tramos} furgonetas={furgonetas} setFurgonetas={setFurgonetas} clave={clave} setClave={setClave} />
      </section>

      {/* ── Que me la enseñen ── */}
      <section id="demo" className={`${ANCHO} scroll-mt-20`}>
        <div className={`grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 ${COLUMNAS}`}>
          <div>
            <H2>{tx('Que me la enseñen en 15 minutos')}</H2>
            <p className="mt-3.5 text-[0.9688rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Déjanos tus datos y te contestamos para quedar. Si lo prefieres, empieza la prueba ya: son {n} días, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}</p>
          </div>
          <FormularioDemo alEnviar={() => setDemoPedida(true)} />
        </div>
      </section>

      {/* ── Preguntas ── */}
      <section className={ANCHO}>
        <div className={`grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 ${COLUMNAS}`}>
          <H2>{tx('Lo que pregunta el dueño de una flota')}</H2>
          <div className="border-b border-[color:var(--ld-border)]">
            {PREGUNTAS_EMPRESA.map(([q, k]) => (
              <details key={k} className="group border-t border-[color:var(--ld-border)]">
                {/* Toda la fila abre la pregunta. */}
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.0625rem] font-semibold text-[color:var(--ld-text)] [&::-webkit-details-marker]:hidden">
                  {tx(q)} <span aria-hidden="true" className="text-[1.375rem] font-normal leading-none text-[color:var(--ld-muted)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-[640px] pb-5 text-[1rem] leading-relaxed text-[color:var(--ld-text2)]">{respuesta(k)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre: cómo se empieza, tal como es el arranque del panel (/panel/arranque, Arranque.jsx): cuatro pasos y
          se puede dejar a medias. Cada conductor entra con SU enlace personal (CONTRATO-ALTA §1), sin correo ni contraseña. ── */}
      <section className={ANCHO} data-testid="emp-arranque">
        {/* El cierre en el ordenador (tanda 6): se lee de arriba abajo, sin huecos. El título y su frase juntos; debajo,
            los cuatro pasos en una fila de cuatro columnas, cada uno con su regla encima; y debajo, a la izquierda, los dos
            botones. (En la tanda 5 la frase se quedaba sola en una columna vacía y los botones caían abajo a la derecha.)
            En el móvil, como antes: el título, la frase, los botones y los pasos. */}
        <div className="grid gap-y-8 border-t border-[color:var(--ld-border)] py-14 sm:py-[72px] lg:gap-y-10">
          <div className="lg:row-start-1">
            <H2>{tx('Empieza con tus furgonetas esta semana.')}</H2>
            <p className="mt-3 max-w-[460px] text-[1.0312rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Son cuatro pasos y puedes dejarlos a medias.')}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:row-start-3" data-testid="emp-cierre-botones">
            <a href={alta} onClick={() => medirAccion('emp_probar_cierre')} className={`${BTN_PRIMARIO} w-full sm:w-auto`} data-testid="emp-probar-cierre">{tx('Probar con mis furgonetas')}</a>
            {/* Con la demo ya pedida, no se vuelve a ofrecer. */}
            {!demoPedida && <a href="#demo" onClick={() => medirAccion('emp_demo_cierre')} className={`${BTN_SECUNDARIO} w-full sm:w-auto`} data-testid="emp-ensenar-cierre">{tx('Que me la enseñen en 15 minutos')}</a>}
          </div>
          {/* En el ordenador, el número encima del título de cada paso: en una columna de la cuarta parte, al lado le
              quitaba el ancho que necesita «Le mandas a cada uno su enlace por WhatsApp». */}
          <ol className="border-b border-[color:var(--ld-border)] lg:row-start-2 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:border-b-0">
            {ARRANQUE.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-t border-[color:var(--ld-border)] py-5 lg:grid-cols-1 lg:content-start lg:gap-y-3 lg:pb-0" data-testid="emp-arranque-paso">
                <span className="pt-[3px] font-mono text-[0.875rem] font-medium tabular-nums text-[color:var(--ld-muted)] lg:pt-0">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-[1.1875rem] font-bold leading-snug tracking-[-0.01em] text-[color:var(--ld-text)]">{t}</h3>
                  <p className="mt-1 text-[1rem] leading-relaxed text-[color:var(--ld-text2)]">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {/* La puerta a la app de reparto: quien reparte por su cuenta tiene su propia página. */}
        <a href="/repartidores" onClick={() => medirAccion('emp_repartidores')} data-testid="emp-repartidores"
          className="group flex min-h-[64px] items-center gap-2 border-t border-[color:var(--ld-border)] py-5 text-[0.9375rem] text-[color:var(--ld-muted)]">
          <span><b className="font-semibold text-[color:var(--ld-text)]">{tx('¿Repartes tú?')}</b>{' '}{tx('La app de ruta de {marca} ordena tus paradas y guarda la prueba de cada entrega.', { marca: MARCA.nombre })}</span>
          <ArrowRight size={16} className="shrink-0 text-[color:var(--ld-text)] transition-transform group-hover:translate-x-0.5" />
        </a>
      </section>

      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
