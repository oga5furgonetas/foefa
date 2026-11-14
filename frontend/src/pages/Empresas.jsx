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
import SelloFoto from '../components/SelloFoto'
import { ANCHO, BTN_CORTO, BTN_PRIMARIO, BTN_SECUNDARIO, ENLACE, LogoMarca, Pie, useTemaWeb } from './portadaComun'

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
   flota y su guía de primeros pasos; `plan=completo` (Pro): la prueba de 14 días enseña todas las pantallas. Registro.jsx
   lee `sector`, `plan` y `flota` y, con los dos primeros, salta el selector de sector y el de plan. */
const ALTA_EMPRESA = '/registro?sector=otra&plan=completo'
/* El expediente de ejemplo, público (lo construye la zona del expediente en esta misma tanda). */
const EXPEDIENTE_EJEMPLO = '/expediente-ejemplo'
/* La calculadora no pinta precio por encima de esto: lib/precios.js no tiene umbral numérico para el plan «Empresa»
   (solo el texto «100 vehículos o más») y /planes corta su campo en 5000 (Planes.jsx). */
const TOPE_CALCULADORA = 5000
/* Desde aquí la calculadora recuerda que existe el plan Empresa, a medida: el «100 vehículos o más» de lib/precios.js. */
const DESDE_PLAN_A_MEDIDA = 100
const TRAMOS_FLOTA = ['1-9', '10-29', '30-99', '100+']

/* El ejemplo del héroe y de los recortes: datos INVENTADOS (lo dice debajo). Las horas, en la hora local de quien mira,
   como el sello de verdad. El 12-11-2026 es jueves. */
const EJEMPLO = {
  matricula: '5678KLM',
  antes: { fecha: new Date(2026, 10, 11, 18, 12), quien: 'Ana L.' },
  hoy: { fecha: new Date(2026, 10, 12, 18, 7), quien: 'Luis P.' },
}
/* Las fotos del ejemplo (las de la demo: la misma furgoneta, lateral derecho, sin golpe y con un golpe dibujado en la
   puerta corredera). El encuadre acerca la puerta: la foto se pinta al 190 % del ancho y se mueve; el cerco va en
   coordenadas de la foto entera (el golpe está hacia x 610-715 e y 400-460 de 1200 × 675). */
const FOTO_ANTES = '/demo/van-lateral.jpg'
const FOTO_HOY = '/demo/van-lateral-golpe-puerta.jpg'
const FOTO_FRENTE = '/demo/van-frontal.jpg'

/* Las preguntas: [pregunta, clave de la respuesta]. */
const PREGUNTAS_EMPRESA = [
  ['¿Quién decide si hay un golpe?', 'decide'],
  ['¿Dice qué conductor dio el golpe?', 'conductor'],
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
const altaCon = (texto) => { const n = flotaValida(texto); return n ? `${ALTA_EMPRESA}&flota=${n}` : ALTA_EMPRESA }

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
          <span aria-hidden="true" data-testid="emp-cerco" className="absolute rounded-[10px] border-[2.5px] border-[#B42318]"
            style={{ left: '49%', top: '56.5%', width: '13%', height: '15.5%', boxShadow: '0 0 0 1.5px rgba(255,255,255,.85)' }} />
        )}
      </div>
      <span className={`absolute left-2.5 top-2.5 rounded-[4px] px-2 py-1 text-[12px] font-bold leading-none ${hoy ? 'bg-[#10181A] text-white' : 'bg-white text-[#10181A]'}`}>{rotulo}</span>
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
          <Matricula texto={EJEMPLO.matricula} className="text-[17px] sm:text-[19px]" />
          <span className="text-[15px] font-semibold text-[color:var(--ld-text)]">{tx('Lateral derecho')}</span>
        </div>
        <span className="text-[14px] text-[color:var(--ld-muted)]">{tx('Repaso del {fecha}', { fecha: diaLargo(EJEMPLO.hoy.fecha) })}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <FotoEjemplo src={FOTO_ANTES} rotulo={tx('Antes')} fecha={EJEMPLO.antes.fecha} quien={EJEMPLO.antes.quien} lang={lang}
          alt={tx('La foto anterior del lateral derecho de la furgoneta, sin golpes.')} />
        <FotoEjemplo src={FOTO_HOY} rotulo={tx('Hoy')} hoy cerco fecha={EJEMPLO.hoy.fecha} quien={EJEMPLO.hoy.quien} lang={lang}
          alt={tx('La foto de hoy del mismo lado, con el golpe nuevo de la puerta corredera marcado.')} />
      </div>
      <figcaption className="px-1 pt-4">
        <p className="flex items-center gap-2.5 text-[17px] font-bold text-[color:var(--ld-text)]">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--ld-warn)]" />
          {tx('Golpe nuevo en la puerta corredera')}
        </p>
        <p className="mt-1 text-[14.5px] leading-snug text-[color:var(--ld-muted)]">
          {tx('Solo la llevó {conductor} entre las dos fotos. Lo marcó la oficina al repasar el día.', { conductor: EJEMPLO.hoy.quien }).split(EJEMPLO.hoy.quien).map((trozo, i) => (
            <span key={i}>{i > 0 && <b className="font-semibold text-[color:var(--ld-text)]">{EJEMPLO.hoy.quien}</b>}{trozo}</span>
          ))}
        </p>
        <p className="mt-3 text-[13px] text-[color:var(--ld-muted)]" data-testid="emp-ejemplo-inventado">{tx('Ejemplo con datos inventados')}</p>
      </figcaption>
    </figure>
  )
}

/* ── Los recortes de «Así funciona», hechos en HTML (no capturas) ── */

const RECORTE = 'rounded-[12px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)]'

function RecorteFotos({ lang }) {
  /* Las cuatro vistas de la revisión: la frontal y el lateral de la demo; el izquierdo, el lateral en espejo; la
     trasera, el lateral acercado a las puertas de atrás. Es un dibujo del móvil, no una captura. */
  const vistas = [
    [tx('Frontal'), FOTO_FRENTE, {}],
    [tx('Lateral izq.'), FOTO_ANTES, { transform: 'scaleX(-1)' }],
    [tx('Lateral dcho.'), FOTO_ANTES, {}],
    [tx('Trasera'), FOTO_ANTES, { objectPosition: '18% 62%', transform: 'scale(1.5)', transformOrigin: '18% 62%' }],
  ]
  return (
    <div className={`${RECORTE} p-3.5`} aria-hidden="true">
      <div className="grid grid-cols-4 gap-1.5">
        {vistas.map(([nombre, src, estilo]) => (
          <div key={nombre}>
            <div className="h-[62px] overflow-hidden rounded-[6px] bg-[#d9dcd7]">
              <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" style={estilo} />
            </div>
            <p className="mt-1.5 truncate text-center text-[12px] text-[color:var(--ld-muted)]">{nombre}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[13px]">
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
      <div className="flex justify-between text-[14px] font-bold text-[color:var(--ld-text)]">
        <span>{tx('Repaso de hoy')}</span><span className="font-mono font-medium">31 / 48</span>
      </div>
      <div className="my-2.5 h-2 overflow-hidden rounded-[4px] bg-[color:var(--ld-hueco)]"><i className="block h-full w-[65%] bg-[color:var(--ld-text)]" /></div>
      {filas.map(([t, n, rojo]) => (
        <div key={t} className="flex justify-between border-t border-[color:var(--ld-border)] py-1.5 text-[14px] text-[color:var(--ld-text)]">
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
      <p className="text-[12.5px] font-semibold text-[color:var(--ld-muted)]">{tx('Expediente del vehículo')}</p>
      <Matricula texto={EJEMPLO.matricula} className="mt-1.5 text-[15px]" />
      <div className="mt-3 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[2px]">
        {Array.from({ length: 30 }, (_, k) => k + 1).map((d) => (
          <i key={d} className={`block h-[10px] rounded-[1.5px] ${d === DIA_GOLPE ? 'bg-[color:var(--ld-warn)]' : SIN_REVISAR.includes(d) ? 'bg-[color:var(--ld-hueco)]' : 'bg-[color:var(--ld-text)]'}`} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-[color:var(--ld-muted)]">
        {[[tx('Revisada'), 'bg-[color:var(--ld-text)]'], [tx('Sin revisar'), 'bg-[color:var(--ld-hueco)]'], [tx('Golpe nuevo'), 'bg-[color:var(--ld-warn)]']].map(([t, c]) => (
          <span key={t} className="inline-flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-[1.5px] ${c}`} />{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ── El precio: la cuenta con tus furgonetas ── */

/* El precio sale de precioMes(), la misma función que /planes, con su mínimo y su descuento. `furgonetas` vive en la
   página: el alta se lleva el número (`&flota=N`). */
function Calculadora({ planes, tramos, furgonetas, setFurgonetas }) {
  const porVehiculo = planes.filter((p) => Number(p.por_vehiculo) > 0)
  const aMedida = planes.find((p) => !Number(p.por_vehiculo)) || PLANES_EMPRESA[2]
  const [cargo, setCargo] = useState('')
  const [clave, setClave] = useState(() => (porVehiculo.find((p) => p.recomendado) || porVehiculo[0])?.clave)
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

  const campo = 'h-[52px] w-full rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 text-[17px] font-semibold text-[color:var(--ld-text)] tabular-nums focus:border-[color:var(--ld-text)] focus:outline-none'
  const nota = 'mt-2 text-[14px] text-[color:var(--ld-muted)]'
  return (
    <div className="grid gap-6 rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-5 sm:p-7 md:grid-cols-[1fr_1.1fr] md:gap-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="emp-furgonetas" className="block text-[15px] font-semibold text-[color:var(--ld-text)]">{tx('¿Cuántas furgonetas tienes?')}</label>
          <input id="emp-furgonetas" type="number" inputMode="numeric" min="1" step="1" value={furgonetas}
            onChange={(e) => { usar(); setFurgonetas(e.target.value) }} onBlur={alSalir} className={`${campo} mt-2 font-mono`} />
        </div>
        {/* Un conmutador de dos: botones con aria-pressed (un role=radio pide flechas y un solo Tab). */}
        <div role="group" aria-label={tx('Plan')} className="flex flex-wrap gap-2">
          {porVehiculo.map((p) => (
            <button key={p.clave} type="button" aria-pressed={p.clave === plan.clave}
              onClick={() => { usar(); setClave(p.clave) }}
              className={`min-h-[44px] rounded-[10px] border-[1.5px] px-3.5 py-2 text-[14px] font-semibold transition-colors ${p.clave === plan.clave
                ? 'border-[color:var(--ld-text)] text-[color:var(--ld-text)]'
                : 'border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`}>
              {tx('Plan {plan}', { plan: tx(p.nombre) })} · {tx('{precio}/vehículo', { precio: euros(Number(p.por_vehiculo)) })}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="emp-cargo" className="block text-[15px] font-semibold text-[color:var(--ld-text)]">{tx('¿De cuánto fue el último cargo por daños que te pasaron?')}</label>
          <div className="relative mt-2">
            <input id="emp-cargo" type="number" inputMode="decimal" min="0" step="1" value={cargo} placeholder={tx('En euros')}
              onChange={(e) => { usar(); setCargo(e.target.value) }} className={`${campo} pr-10 font-mono placeholder:font-sans placeholder:font-normal placeholder:text-[color:var(--ld-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
            <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[16px] text-[color:var(--ld-muted)]">€</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center border-t border-[color:var(--ld-border)] pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0" aria-live="polite" data-testid="emp-resultado">
        {demasiadas ? (
          /* Por encima del tope no se pinta un precio que no corresponde al número escrito. */
          <p className="text-[17px] leading-snug text-[color:var(--ld-text)]" data-testid="emp-a-medida">
            {tx('Para más de {n} vehículos, el plan {plan} es a medida.', { n: cifra(TOPE_CALCULADORA), plan: tx(aMedida.nombre) })}{' '}
            <a href="#demo" onClick={() => medirAccion('emp_demo_calculadora')} className={ENLACE}>{tx('Cuéntanos tu flota')}</a>
          </p>
        ) : hayN ? (<>
          {/* La frase entera se traduce de una vez (cada idioma pone el precio donde le toca); el precio va en grande. */}
          <p className="text-[17px] leading-snug text-[color:var(--ld-text)]">
            {tx('{marca} te cuesta {precio} al mes con el plan {plan}.', { marca: MARCA.nombre, plan: tx(plan.nombre) }).split('{precio}').map((trozo, i) => (
              <span key={i}>{i > 0 && <b data-testid="emp-precio" data-precio={mes} className="text-[36px] font-extrabold tracking-[-0.03em] tabular-nums">{euros(mes)}</b>}{trozo}</span>
            ))}
          </p>
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
            <p className="mt-4 text-[17px] font-semibold leading-snug text-[color:var(--ld-ok)]" data-testid="emp-meses">
              {meses > 120 ? tx('Con evitar un cargo así, tienes pagados más de 10 años.')
                : meses >= 2 ? tx('Con evitar un cargo así, tienes pagados {n} meses.', { n: cifra(meses) })
                  : meses === 1 ? tx('Con evitar un cargo así, tienes pagado un mes.')
                    : tx('Un cargo así no llega a pagar un mes.')}
            </p>
          )}
          <p className="mt-4 text-[13px] text-[color:var(--ld-muted)]">{tx('Precios sin IVA. Pago mensual, sin permanencia.')}</p>
        </>) : (
          <p className="text-[15px] text-[color:var(--ld-muted)]">{tx('Pon cuántas furgonetas tienes.')}</p>
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
      setAviso(typeof j?.mensaje === 'string' && j.mensaje ? tx(j.mensaje) : tx('¡Recibido! Te respondemos en menos de 24 horas hábiles.'))
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
        <p className="flex items-start gap-3 text-[18px] font-semibold text-[color:var(--ld-text)]">
          <span aria-hidden="true" className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--ld-ok)]" />{aviso}
        </p>
      </div>
    )
  }
  const campo = 'mt-1.5 h-[52px] w-full rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 text-[16px] text-[color:var(--ld-text)] focus:border-[color:var(--ld-text)] focus:outline-none aria-[invalid=true]:border-[color:var(--ld-warn)]'
  const etiqueta = 'block text-[15px] font-semibold text-[color:var(--ld-text)]'
  // El campo que falla lleva aria-invalid y apunta al aviso.
  const marca = (id) => (falta?.campo === id ? { 'aria-invalid': true, 'aria-describedby': 'emp-falta' } : {})
  /* El aviso, justo debajo del campo que falla: al pie del formulario, en el móvil quedaba fuera de la pantalla. */
  const avisoDe = (id) => (falta?.campo === id
    ? <p id="emp-falta" role="alert" className="mt-1.5 text-[14px] font-semibold text-[color:var(--ld-warn)]">{falta.texto}</p> : null)
  return (
    <form noValidate onSubmit={enviar} onFocus={alAbrir} className="rounded-[20px] border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="emp-nombre" className={etiqueta}>{tx('Tu nombre')}</label>
          <input id="emp-nombre" autoComplete="name" value={f.nombre} onChange={cambia('nombre')} className={campo} {...marca('emp-nombre')} />{avisoDe('emp-nombre')}</div>
        {/* «Tu empresa»: «Empresa» es también el nombre del plan a medida («Enterprise» en inglés). */}
        <div><label htmlFor="emp-empresa" className={etiqueta}>{tx('Tu empresa')}</label>
          <input id="emp-empresa" autoComplete="organization" value={f.empresa} onChange={cambia('empresa')} className={campo} {...marca('emp-empresa')} />{avisoDe('emp-empresa')}</div>
        <div><label htmlFor="emp-correo" className={etiqueta}>{tx('Correo')}</label>
          <input id="emp-correo" type="email" autoComplete="email" inputMode="email" value={f.correo} onChange={cambia('correo')} className={campo} {...marca('emp-correo')} />{avisoDe('emp-correo')}</div>
        <div><label htmlFor="emp-telefono" className={etiqueta}>{tx('Teléfono (opcional)')}</label>
          <input id="emp-telefono" type="tel" autoComplete="tel" value={f.telefono} onChange={cambia('telefono')} className={campo} /></div>
        <div><label htmlFor="emp-flota" className={etiqueta}>{tx('¿Cuántas furgonetas?')}</label>
          <select id="emp-flota" value={f.flota} onChange={cambia('flota')} className={campo} {...marca('emp-flota')}>
            <option value="">{tx('Elige')}</option>
            {TRAMOS_FLOTA.map((t) => <option key={t} value={t}>{t === '100+' ? tx('100 o más') : t}</option>)}
          </select>{avisoDe('emp-flota')}</div>
        <div className="sm:col-span-2"><label htmlFor="emp-mensaje" className={etiqueta}>{tx('Mensaje (opcional)')}</label>
          <textarea id="emp-mensaje" rows={3} value={f.mensaje} onChange={cambia('mensaje')} className={`${campo} h-auto py-3`} /></div>
      </div>
      {estado === 'error' && <p role="alert" data-testid="emp-error" className="mt-4 text-[14px] font-semibold text-[color:var(--ld-warn)]">{aviso}</p>}
      <button type="submit" disabled={estado === 'enviando'} className={`${BTN_PRIMARIO} mt-6 w-full sm:w-auto`}>
        {estado === 'enviando' ? <><Loader2 size={16} className="animate-spin" /> {tx('Enviando…')}</> : tx('Pedir la demostración')}
      </button>
      <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--ld-muted)]">
        {tx('Trata estos datos {titular}, responsable de {marca}, solo para contestarte y enseñarte el producto.', { titular: COMPANY.legalName, marca: MARCA.nombre })}{' '}
        <a href="/privacidad" className={ENLACE}>{tx('Política de privacidad')}</a>
      </p>
    </form>
  )
}

/* Un título de sección: Archivo 800, sin rótulo encima. */
function H2({ children, className = '' }) {
  return <h2 className={`ld-titular text-[30px] leading-[1.06] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[40px] ${className}`}>{children}</h2>
}

export default function Empresas() {
  const lang = useIdioma()
  const titulo = tx('{marca} para empresas con furgonetas · El golpe, el día que aparece', { marca: MARCA.nombre })
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = lang } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo, lang])
  const [tema, setTema] = useTemaWeb()
  const { planes, tramos } = usePlanes()
  const [furgonetas, setFurgonetas] = useState('20')   // el de la calculadora: el alta se lo lleva
  const [demoPedida, setDemoPedida] = useState(false)
  const alta = altaCon(furgonetas)
  // Sigue en la página a los 10 s: una vez por visita (como rep_10s en /repartidores).
  useEffect(() => { const t = setTimeout(() => medirAccion('emp_10s'), 10000); return () => clearTimeout(t) }, [])

  const esencial = planes.find((p) => p.clave === 'operacion') || PLANES_EMPRESA[0]
  const pro = planes.find((p) => p.clave === 'completo') || PLANES_EMPRESA[1]
  const aMedida = planes.find((p) => !Number(p.por_vehiculo)) || PLANES_EMPRESA[2]
  const desde = Math.min(...planes.map((p) => Number(p.por_vehiculo)).filter((x) => x > 0))

  function respuesta(k) {
    if (k === 'decide') return tx('Una persona de tu oficina. En el repaso del día ve la foto de hoy junto a la anterior del mismo lado y marca lo que sea nuevo, sobre la foto. El expediente de cada furgoneta solo lleva los golpes que ha marcado o confirmado una persona.')
    if (k === 'conductor') return tx('No. Dice quién la llevaba, y solo cuando es seguro: si entre las dos fotos la llevó una sola persona, en un día o menos, y la foto anterior de ese lado se repasó y estaba igual. Si no, el golpe queda sin conductor atribuible y se dice por qué.')
    if (k === 'datos') return tx('No. Cada empresa tiene su propia base de datos, separada de las de las demás. Y los datos son tuyos: si te vas, te los devolvemos o los borramos, lo que elijas.')
    if (k === 'instalar') return tx('No. Entran desde el navegador del móvil, con el enlace de tu empresa y su correo.')
    if (k === 'propias') return tx('Sí. La revisión con fotos, el taller, la ITV y los mantenimientos funcionan igual. El proveedor y el fin del renting solo se rellenan si los tienes.')
    if (k === 'tiempo') return tx('Depende de lo que tardes en tres pasos: crear la cuenta, subir el Excel de furgonetas y el de conductores (antes de guardar ves cómo queda) y mandar a cada conductor el enlace de tu empresa. La primera revisión llega cuando el primer conductor la haga.')
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

  const enlaceMenu = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-[15px] font-medium text-[color:var(--ld-text)] hover:underline underline-offset-4'
  const PASOS = [
    ['01', tx('El conductor hace cuatro fotos'), tx('Frontal, trasera y los dos laterales, más los kilómetros. Desde su móvil, a la hora que decida tu empresa: una revisión por furgoneta y día.'), <RecorteFotos key="r1" lang={lang} />],
    ['02', tx('Tú repasas el día en unos minutos'), tx('Cada foto de hoy aparece junto a la anterior del mismo lado. Si está igual, pasas a la siguiente. Si hay algo nuevo, lo marcas sobre la foto.'), <RecorteRepaso key="r2" />],
    ['03', tx('Cada golpe queda con su día'), tx('Y con su conductor, solo cuando entre las dos fotos la llevó una sola persona. Cada furgoneta tiene su expediente: cómo entró, qué le ha pasado y cuándo, listo para imprimir el día que te pasan un cargo.'), <RecorteExpediente key="r3" />],
  ]

  return (
    /* overflow-x-clip (no hidden): no crea un contenedor de desplazamiento, así la cabecera `sticky` se queda arriba. */
    <div className="ld-root min-h-screen overflow-x-clip font-sans text-[17px] leading-normal antialiased" data-theme={tema} data-testid="portada-empresas">
      {/* ── Cabecera ── */}
      <nav className="sticky top-0 z-50 border-b border-[color:var(--ld-border)] bg-[color:var(--ld-nav)]" data-testid="emp-cabecera">
        <div className={`${ANCHO} flex h-[68px] items-center justify-between gap-2`}>
          <a href="/" className="inline-flex shrink-0 items-center gap-2.5 text-[color:var(--ld-text)]">
            <LogoMarca />
            <span className="text-[19px] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </a>
          <div className="flex items-center gap-2 sm:gap-6">
            <a href="#como" className={`${enlaceMenu} hidden lg:inline-flex`}>{tx('Cómo funciona')}</a>
            <a href="#precio" onClick={() => medirAccion('emp_precios_menu')} className={`${enlaceMenu} hidden lg:inline-flex`}>{tx('Precio')}</a>
            <a href="/repartidores" onClick={() => medirAccion('emp_repartidores_menu')} className={`${enlaceMenu} hidden !text-[color:var(--ld-muted)] lg:inline-flex`}>{tx('¿Repartes tú? La app de ruta')}</a>
            <a href="/panel/login" className={enlaceMenu}>{tx('Entrar')}</a>
            <a href={alta} onClick={() => medirAccion('emp_probar_menu')} data-testid="emp-probar-menu" className={BTN_CORTO}>{tx('Probar con mis furgonetas')}</a>
          </div>
        </div>
      </nav>

      {/* ── Héroe: el titular y, a la derecha, el producto ── */}
      <header className={`${ANCHO} grid items-center gap-10 pb-16 pt-9 sm:pb-20 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[540px_minmax(0,1fr)] xl:gap-16`}>
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--ld-accent)]">{tx('Para empresas con furgonetas')}</p>
          <h1 className="ld-titular mt-4 text-[44px] leading-[0.98] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[58px] xl:text-[64px]">
            {tx('El golpe, el día que aparece. No el día que te lo cobran.')}
          </h1>
          <p className="mt-6 max-w-[500px] text-[18px] leading-[1.5] text-[color:var(--ld-text2)] sm:text-[19px]">
            {tx('Cada conductor fotografía su furgoneta desde el móvil. Tú ves la foto de hoy junto a la anterior del mismo lado y marcas lo que sea nuevo. Así puedes arreglarlo en tu taller antes de que lo vea el perito del renting.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={alta} onClick={() => medirAccion('emp_probar_arriba')} className={BTN_PRIMARIO} data-testid="emp-probar">{tx('Probar con mis furgonetas')}</a>
            <a href={EXPEDIENTE_EJEMPLO} onClick={() => medirAccion('emp_expediente_arriba')} className={BTN_SECUNDARIO} data-testid="emp-expediente">{tx('Ver un expediente de ejemplo')}</a>
          </div>
          <p className="mt-4 text-[14.5px] text-[color:var(--ld-muted)]" data-testid="emp-linea-precio">
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
            <p className="mt-3.5 text-[15.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('Sin aparatos en la furgoneta ni nada que instalar en la oficina. Los conductores entran desde el móvil con el enlace de tu empresa.')}</p>
          </div>
          <ol>
            {PASOS.map(([n, t, d, recorte]) => (
              <li key={n} className="grid gap-5 border-t border-[color:var(--ld-border)] py-7 last:border-b md:grid-cols-[minmax(0,1fr)_300px] md:gap-10" data-testid="emp-paso">
                <div>
                  <span className="mb-2.5 block font-mono text-[14px] font-medium text-[color:var(--ld-muted)]">{n}</span>
                  <h3 className="text-[23px] font-bold leading-[1.15] tracking-[-0.015em] text-[color:var(--ld-text)] sm:text-[25px]">{t}</h3>
                  <p className="mt-2 max-w-[470px] text-[16.5px] leading-relaxed text-[color:var(--ld-text2)]">{d}</p>
                </div>
                {recorte}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── De dónde sale: las cifras de la casa ── */}
      <section className="mt-12 bg-[color:var(--ld-banda)] text-[color:var(--ld-banda-texto)] sm:mt-16" data-testid="emp-nave">
        <div className={`${ANCHO} grid items-end gap-10 py-14 sm:py-[76px] lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-16`}>
          <div>
            <h2 className="ld-titular text-[30px] leading-[1.06] [text-wrap:balance] sm:text-[40px]">{tx('No salió de una oficina. Salió de una nave.')}</h2>
            <p className="mt-4 max-w-[430px] text-[17px] leading-relaxed text-[color:var(--ld-banda-suave)]">
              {tx('{marca} se hizo dentro de una empresa de reparto, para su propio día a día. Allí la usan cada día con sus conductores.', { marca: MARCA.nombre })}
            </p>
          </div>
          <dl className="grid grid-cols-3 border-t border-[color:var(--ld-banda-linea)]">
            {[[String(CIFRAS_CASA.naves), tx('naves'), ''], [String(CIFRAS_CASA.furgonetas), tx('furgonetas'), ''],
              [String(CIFRAS_CASA.revisionesSemana), tx('revisiones con foto cada semana'), tx('unas')]].map(([n, t, antes], i) => (
              <div key={t} className={`flex flex-col-reverse justify-end pt-5 ${i ? 'border-l border-[color:var(--ld-banda-linea)] pl-4 sm:pl-7' : 'pr-2'}`}>
                <dt className="mt-2.5 text-[14px] leading-snug text-[color:var(--ld-banda-suave)] sm:text-[15px]">{t}</dt>
                <dd className="ld-titular text-[34px] leading-none tabular-nums sm:text-[64px]">
                  {antes && <span className="align-baseline text-[15px] font-semibold tracking-normal sm:text-[22px]">{antes} </span>}{n}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Precio ── */}
      <section id="precio" className={`${ANCHO} grid scroll-mt-20 gap-8 py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16`}>
        <div>
          <H2>{tx('Lo que cuesta')}</H2>
          <p className="mt-3.5 text-[15.5px] leading-relaxed text-[color:var(--ld-muted)]">
            {tx('Pagas por furgoneta y mes. Usuarios y conductores, sin límite. {n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}
          </p>
          <p className="mt-2 text-[15px]"><a href="/planes" onClick={() => medirAccion('emp_precios_modulos')} className={`${ENLACE} gap-1.5`}>{tx('Ver qué lleva cada plan')} <ArrowRight size={15} /></a></p>
        </div>
        <Calculadora planes={planes} tramos={tramos} furgonetas={furgonetas} setFurgonetas={setFurgonetas} />
      </section>

      {/* ── Que me la enseñen ── */}
      <section id="demo" className={`${ANCHO} scroll-mt-20`}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <div>
            <H2>{tx('Que me la enseñen en 15 minutos')}</H2>
            <p className="mt-3.5 text-[15.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('Déjanos tus datos y te contestamos para quedar. Si lo prefieres, empieza la prueba ya: son {n} días, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}</p>
          </div>
          <FormularioDemo alEnviar={() => setDemoPedida(true)} />
        </div>
      </section>

      {/* ── Preguntas ── */}
      <section className={ANCHO}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <H2>{tx('Lo que pregunta el dueño de una flota')}</H2>
          <div className="border-b border-[color:var(--ld-border)]">
            {PREGUNTAS_EMPRESA.map(([q, k]) => (
              <details key={k} className="group border-t border-[color:var(--ld-border)]">
                {/* Toda la fila abre la pregunta. */}
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold text-[color:var(--ld-text)] [&::-webkit-details-marker]:hidden">
                  {tx(q)} <span aria-hidden="true" className="text-[22px] font-normal leading-none text-[color:var(--ld-muted)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-[640px] pb-5 text-[16px] leading-relaxed text-[color:var(--ld-text2)]">{respuesta(k)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ── */}
      <section className={ANCHO}>
        <div className="grid items-center gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-[72px] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div>
            <H2>{tx('Empieza con tus furgonetas esta semana.')}</H2>
            <p className="mt-3 max-w-[560px] text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('Das de alta las matrículas, mandas el enlace a tus conductores y la primera revisión llega en cuanto la hace el primero.')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={alta} onClick={() => medirAccion('emp_probar_cierre')} className={BTN_PRIMARIO} data-testid="emp-probar-cierre">{tx('Probar con mis furgonetas')}</a>
            {/* Con la demo ya pedida, no se vuelve a ofrecer. */}
            {!demoPedida && <a href="#demo" onClick={() => medirAccion('emp_demo_cierre')} className={BTN_SECUNDARIO} data-testid="emp-ensenar-cierre">{tx('Que me la enseñen en 15 minutos')}</a>}
          </div>
        </div>
        {/* La puerta a la app de reparto: quien reparte por su cuenta tiene su propia página. */}
        <a href="/repartidores" onClick={() => medirAccion('emp_repartidores')} data-testid="emp-repartidores"
          className="group flex min-h-[64px] items-center gap-2 border-t border-[color:var(--ld-border)] py-5 text-[15px] text-[color:var(--ld-muted)]">
          <span><b className="font-semibold text-[color:var(--ld-text)]">{tx('¿Repartes tú?')}</b>{' '}{tx('La app de ruta de {marca} ordena tus paradas y guarda la prueba de cada entrega.', { marca: MARCA.nombre })}</span>
          <ArrowRight size={16} className="shrink-0 text-[color:var(--ld-text)] transition-transform group-hover:translate-x-0.5" />
        </a>
      </section>

      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
