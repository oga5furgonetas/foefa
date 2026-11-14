import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Camera, ClipboardList, FileText, Loader2, Smartphone, Upload, CalendarClock, CheckCircle2, Send, Warehouse } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, useIdioma, idioma, locale } from '../lib/idioma'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { PLANES_EMPRESA, DESCUENTOS_VOLUMEN, MESES_ANUAL, DIAS_PRUEBA_EMPRESA, precioMes, descuentoVolumen } from '../lib/precios'
import { COMPANY } from '../legal/config'
import { BTN_PRIMARIO, BTN_SECUNDARIO, MODULOS_EMPRESA, Seccion, VistaPanel, Pie, useDemoPanel } from './portadaComun'

/* ── LA PÁGINA DE VENTA PARA EMPRESAS (/empresas, 14-11-2026) ─────────────────────────────────────────────────────
   El destino de los correos y llamadas a dueños de empresas con furgonetas (docs/AUDITORIA-2026-11-01.md §7 y §8:
   «primero clientes con jefe»). Tiene que convencer en un minuto con verdades comprobables.

   REGLA: cada frase que dice que el producto hace algo tiene detrás código que existe hoy (la tabla frase → fichero
   está en el informe del encargo). Los precios salen de lib/precios.js y, si contesta, de /billing/planes, como en
   /planes: ninguno escrito aquí. Lo que es solo del plan Pro lleva su etiqueta. Sin testimonios, sin logotipos, sin
   cifras de terceros. Se mide con medirAccion('emp_*') y el embudo «empresas» de backend/analitica.py.
   Ronda 2 (14-11-2026): sin «cada mañana» ni «antes de salir» (cuándo se revisa lo decide cada empresa; en la nave
   donde nació se revisa sobre todo al volver, Inspecciones.jsx lo mide), y la rejilla ya no se titula «Todo lo que
   lleva»: cada casilla dice si es de Pro, si se activa a petición o si es un complemento. */

/* Cifras reales de la empresa donde nació FDS, leídas en su panel el 13-11-2026. Las confirma Dani antes de publicar.
   No inflarlas: si cambian, se cambian aquí. */
const CIFRAS_CASA = { naves: 3, furgonetas: 63, revisionesSemana: 200 }

/* El alta a la que lleva la página: la de FLOTA, no el selector de sectores. Con «Mensajería» la cuenta nace con la
   pantalla de rutas (lib/sector.js, Dashboard.jsx → InicioReparto); con «otra» nace con el panel de flota y su guía de
   primeros pasos. `plan=completo` (Pro): así la prueba enseña Revisión rápida y Origen de daños. Registro.jsx lee
   `sector`, `plan` y `flota` y, con los dos primeros, salta el selector de sector y el de plan. */
const ALTA_EMPRESA = '/registro?sector=otra&plan=completo'
/* La calculadora no pinta precio por encima de esto: lib/precios.js no tiene umbral numérico para el plan «Empresa»
   (solo el texto «100 vehículos o más») y /planes corta su campo en 5000 (Planes.jsx). */
const TOPE_CALCULADORA = 5000
/* Desde aquí la calculadora recuerda que existe el plan Empresa, a medida (14-11-2026, M9): es el «100 vehículos o más»
   con que lo describen lib/precios.js y /planes. El precio de Pro se sigue pintando. */
const DESDE_PLAN_A_MEDIDA = 100
const TRAMOS_FLOTA = ['1-9', '10-29', '30-99', '100+']

/* Los tres problemas: título, una frase y lo que se ve en el panel en líneas cortas. `true`: solo con el plan Pro
   (server.py, _MODULOS_SOLO_PRO y «forensics» en PLAN_LIMITS). */
const PROBLEMAS = [
  { icono: Camera, titulo: 'El golpe que nadie hizo',
    texto: 'Aparece una abolladura y nadie sabe cuándo fue, así que la acaba pagando la empresa.',
    ve: [
      ['Cada revisión, con sus fotos, su fecha, su hora y quién la hizo.', false],
      ['La detección de daños revisa sola cada foto: la compara con la anterior del mismo lado y marca los golpes que parecen nuevos. No acierta siempre.', false],
      ['Qué furgonetas no se han revisado hoy y cuáles llevan más de una semana sin mirarse.', false],
      ['Revisión rápida: confirmas o descartas, uno a uno, los golpes marcados.', true],
      ['Origen de daños: para cada golpe, la última foto en la que estaba bien y quién la llevó desde entonces. Dice quién la llevaba, no quién dio el golpe.', true],
    ] },
  { icono: FileText, titulo: 'El cargo al devolver la furgoneta',
    texto: 'Al devolverla llega una lista de daños: si no demuestras cuándo apareció cada uno, lo pagas tú.',
    ve: [
      ['Cada furgoneta guarda en su ficha todas sus revisiones con foto, cada una con su fecha y su conductor.', false],
      ['Su historial sale en un parte para imprimir o guardar en PDF, con la foto del golpe y la de la misma vista en la revisión anterior, de los últimos daños nuevos.', false],
      ['Informe pericial: la revisión firmada sale en PDF con sus fotos marcadas y un código que cualquiera comprueba en nuestra web (matrícula en parte oculta, fecha y quién la firmó). No es una firma electrónica avanzada.', true],
    ] },
  { icono: CalendarClock, titulo: 'La ITV que se pasó',
    texto: 'Con muchas furgonetas alguna fecha se escapa, y te enteras cuando ya no puede salir.',
    ve: [
      ['La lista de ITV de toda la flota, por lo que caduca antes, también las que no tienen fecha.', false],
      ['Un calendario con la ITV, el fin de cada renting y las citas de taller, y una fecha estimada para el aceite, las ruedas y las pastillas, según los kilómetros que hace cada furgoneta.', false],
    ] },
]

const PASOS_EMPRESA = [
  [Upload, 'Creas la cuenta y metes tus furgonetas y tu gente', 'Subes tu Excel o CSV de furgonetas y el de conductores, o los pegas desde Excel: antes de guardar ves cómo queda. También se pueden dar de alta a mano.'],
  [Smartphone, 'Cada conductor entra desde su móvil', 'Desde el navegador, con el enlace de tu empresa y su correo: no tiene que instalar nada.'],
  /* 14-11-2026 (ronda 3, V11): «Cuándo se hace…» se podía leer como «cuándo y cuántas veces». El servidor deja a cada
     conductor una revisión por furgoneta y día (server.py, crear inspección: 409 «Ya enviaste la inspección de esta
     furgoneta hoy»; solo un admin puede repetir). */
  [ClipboardList, 'Ves quién ha revisado su furgoneta y qué ha salido', 'En Inspecciones, cada revisión con sus fotos, quién la hizo y los golpes que ha marcado la detección de daños, y aparte las furgonetas sin revisar. A qué hora se hace la revisión lo decide cada empresa (cada conductor hace una por furgoneta y día).'],
]

const PREGUNTAS_EMPRESA = [
  ['¿Mis datos se mezclan con los de otras empresas?', 'datos'],
  ['¿Los conductores tienen que instalar algo?', 'instalar'],
  ['¿Sirve si las furgonetas son mías y no de renting?', 'propias'],
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

/* Lo que solo es de Pro, lo que se activa a petición y lo que es un complemento: la etiqueta, con un color del tema
   que se lee en claro y en oscuro (--ld-mid: #c2410c / #fb923c). */
function Etiqueta({ children }) {
  return <span className="mr-1.5 inline-block rounded-md border border-[color:var(--ld-mid)] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-[color:var(--ld-mid)]">{children}</span>
}

/* «Haz la cuenta»: el precio sale de precioMes(), la misma función que /planes, con su mínimo y su descuento.
   `furgonetas` vive en la página: el alta se lleva el número (`&flota=N`). */
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

  const campo = 'w-full rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-bg)] px-3.5 py-3 text-[16px] font-semibold text-[color:var(--ld-text)] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-400'
  return (
    <div className="grid gap-6 rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <div>
          <label htmlFor="emp-furgonetas" className="block text-[14.5px] font-semibold text-[color:var(--ld-text)]">{tx('¿Cuántas furgonetas tienes?')}</label>
          <input id="emp-furgonetas" type="number" inputMode="numeric" min="1" step="1" value={furgonetas}
            onChange={(e) => { usar(); setFurgonetas(e.target.value) }} onBlur={alSalir} className={`${campo} mt-2`} />
        </div>
        <div>
          <label htmlFor="emp-cargo" className="block text-[14.5px] font-semibold text-[color:var(--ld-text)]">{tx('¿De cuánto fue el último cargo por daños que te pasaron?')}</label>
          <div className="relative mt-2">
            <input id="emp-cargo" type="number" inputMode="decimal" min="0" step="1" value={cargo} placeholder={tx('En euros')}
              onChange={(e) => { usar(); setCargo(e.target.value) }} className={`${campo} pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
            <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[color:var(--ld-dim)]">€</span>
          </div>
        </div>
        {/* Un conmutador de dos: botones con aria-pressed (un role=radio pide flechas y un solo Tab). */}
        <div role="group" aria-label={tx('Plan')} className="flex flex-wrap gap-2">
          {porVehiculo.map((p) => (
            <button key={p.clave} type="button" aria-pressed={p.clave === plan.clave}
              onClick={() => { usar(); setClave(p.clave) }}
              className={`min-h-[44px] rounded-xl border px-4 py-2 text-[14px] font-semibold transition ${p.clave === plan.clave
                ? 'border-brand-400 bg-brand-400/15 text-[color:var(--ld-text)]'
                : 'border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`}>
              {tx('Plan {plan}', { plan: tx(p.nombre) })} · {tx('{precio}/vehículo', { precio: euros(Number(p.por_vehiculo)) })}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-xl bg-[color:var(--ld-fill)] p-5 sm:p-6" aria-live="polite" data-testid="emp-resultado">
        {demasiadas ? (
          /* Por encima del tope no se pinta un precio que no corresponde al número escrito. */
          <p className="text-[17px] leading-snug text-[color:var(--ld-text)]" data-testid="emp-a-medida">
            {tx('Para más de {n} vehículos, el plan {plan} es a medida.', { n: cifra(TOPE_CALCULADORA), plan: tx(aMedida.nombre) })}{' '}
            <a href="#demo" onClick={() => medirAccion('emp_demo_calculadora')} className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Cuéntanos tu flota')}</a>
          </p>
        ) : hayN ? (<>
          {/* La frase entera se traduce de una vez (cada idioma pone el precio donde le toca); el precio va en grande. */}
          <p className="text-[17px] leading-snug text-[color:var(--ld-text)]">
            {tx('{marca} te cuesta {precio} al mes con el plan {plan}.', { marca: MARCA.nombre, plan: tx(plan.nombre) }).split('{precio}').map((trozo, i) => (
              <span key={i}>{i > 0 && <b data-testid="emp-precio" data-precio={mes} className="font-display text-[32px] font-extrabold tracking-[-0.03em] tabular-nums">{euros(mes)}</b>}{trozo}</span>
            ))}
          </p>
          {n < (plan.minimo_vehiculos || 0) && (
            <p className="mt-2 text-[13.5px] text-[color:var(--ld-muted)]">{tx('El plan {plan} factura como mínimo {n} vehículos.', { plan: tx(plan.nombre), n: plan.minimo_vehiculos })}</p>
          )}
          {pct > 0 && <p className="mt-2 text-[13.5px] text-[color:var(--ld-muted)]">{tx('Ya con el {pct} % de descuento por volumen.', { pct })}</p>}
          {n >= DESDE_PLAN_A_MEDIDA && (
            <p className="mt-2 text-[13.5px] text-[color:var(--ld-muted)]" data-testid="emp-plan-a-medida">
              {tx('Con {n} vehículos o más también tienes el plan {plan}, a medida.', { n: DESDE_PLAN_A_MEDIDA, plan: tx(aMedida.nombre) })}{' '}
              <a href="#demo" onClick={() => medirAccion('emp_demo_calculadora')} className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Cuéntanos tu flota')}</a>
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
          <p className="mt-4 text-[12.5px] text-[color:var(--ld-muted)]">{tx('Precios sin IVA. Pago mensual, sin permanencia.')}</p>
        </>) : (
          <p className="text-[15px] text-[color:var(--ld-muted)]">{tx('Pon cuántas furgonetas tienes.')}</p>
        )}
      </div>
    </div>
  )
}

/* «Que me la enseñen»: va a POST /auth/lead (capture_lead en server.py), que lo guarda en el CRM y en la Bandeja y
   avisa al dueño. `plan` empieza por «DEMO EMPRESAS» para distinguirlo en la Bandeja. `alEnviar`: la página esconde
   entonces el «Que me la enseñen» del cierre (ya está pedida). */
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
      <div ref={recibido} tabIndex={-1} role="status" data-testid="emp-recibido" className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-7 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <CheckCircle2 size={34} className="mx-auto text-[color:var(--ld-ok)]" />
        <p className="mt-3 text-[18px] font-semibold text-[color:var(--ld-text)]">{aviso}</p>
      </div>
    )
  }
  const campo = 'mt-1.5 w-full rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-bg)] px-3.5 py-3 text-[16px] text-[color:var(--ld-text)] placeholder:text-[color:var(--ld-dim)] focus:outline-none focus:ring-2 focus:ring-brand-400 aria-[invalid=true]:border-[color:var(--ld-warn)]'
  const etiqueta = 'block text-[14px] font-semibold text-[color:var(--ld-text)]'
  // El campo que falla lleva aria-invalid y apunta al aviso.
  const marca = (id) => (falta?.campo === id ? { 'aria-invalid': true, 'aria-describedby': 'emp-falta' } : {})
  /* El aviso, justo debajo del campo que falla (14-11-2026, M8): antes salía al pie del formulario y en el móvil quedaba
     unos 700 px más abajo, fuera de la pantalla, con el foco ya en el campo. */
  const avisoDe = (id) => (falta?.campo === id
    ? <p id="emp-falta" role="alert" className="mt-1.5 text-[14px] font-semibold text-[color:var(--ld-warn)]">{falta.texto}</p> : null)
  return (
    <form noValidate onSubmit={enviar} onFocus={alAbrir} className="rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="emp-nombre" className={etiqueta}>{tx('Tu nombre')}</label>
          <input id="emp-nombre" autoComplete="name" value={f.nombre} onChange={cambia('nombre')} className={campo} {...marca('emp-nombre')} />{avisoDe('emp-nombre')}</div>
        {/* «Tu empresa» (14-11-2026, ronda 3): «Empresa» es también el nombre del plan a medida, que en inglés se llama
            «Enterprise»; con su propia clave, el campo dice «Your company». */}
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
          <textarea id="emp-mensaje" rows={3} value={f.mensaje} onChange={cambia('mensaje')} className={campo} /></div>
      </div>
      {estado === 'error' && <p role="alert" data-testid="emp-error" className="mt-4 text-[14px] font-semibold text-[color:var(--ld-warn)]">{aviso}</p>}
      <button type="submit" disabled={estado === 'enviando'} className={`${BTN_PRIMARIO} mt-6 w-full sm:w-auto`}>
        {estado === 'enviando' ? <><Loader2 size={16} className="animate-spin" /> {tx('Enviando…')}</> : <><Send size={16} /> {tx('Pedir la demostración')}</>}
      </button>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[color:var(--ld-muted)]">
        {tx('Trata estos datos {titular}, responsable de {marca}, solo para contestarte y enseñarte el producto.', { titular: COMPANY.legalName, marca: MARCA.nombre })}{' '}
        <a href="/privacidad" className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Política de privacidad')}</a>
      </p>
    </form>
  )
}

export default function Empresas() {
  const lang = useIdioma()
  const titulo = tx('{marca} para empresas con furgonetas: revisiones con foto, golpes y vencimientos', { marca: MARCA.nombre })
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = lang } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo, lang])
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('ld_theme') || 'dark' } catch { return 'dark' } })
  useEffect(() => { try { localStorage.setItem('ld_theme', tema) } catch { /* modo privado */ } }, [tema])
  const [demo, abrirDemoPanel] = useDemoPanel('emp_demo_panel')
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
  const lineaPrecio = tx('Desde {precio} por vehículo y mes · sin tarjeta', { precio: euros(desde) })
  const etiquetaPro = tx('Plan {plan}', { plan: tx(pro.nombre) })
  // Las etiquetas de la rejilla compartida (el cuarto elemento de MODULOS_EMPRESA; la portada no las pinta).
  const etiquetaModulo = (k) => (k === 'pro' ? etiquetaPro : k === 'peticion' ? tx('Se activa a petición') : k === 'complemento' ? tx('Complemento') : '')

  function respuesta(k) {
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
      tx('Los {n} primeros días son gratis y sin tarjeta. Precios sin IVA.', { n: DIAS_PRUEBA_EMPRESA }),
    ].join(' ')
  }

  // Zonas de toque de 44 px en el móvil (enlaces de la cabecera y «Ver precios»).
  const enlaceMenu = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1.5 text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'
  return (
    /* overflow-x-clip (no hidden): recorta los halos sin crear un contenedor de desplazamiento, así la cabecera
       `sticky` se queda arriba al deslizar. */
    <div className="ld-root min-h-screen overflow-x-clip font-sans antialiased" data-theme={tema}>
      {/* ── Cabecera ── */}
      <nav className="sticky top-0 z-50 border-b border-[color:var(--ld-border)] bg-[color:var(--ld-nav)] backdrop-blur-xl" data-testid="emp-cabecera">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-2 px-4 sm:px-5">
          <a href="/" className="flex shrink-0 items-center gap-2 text-[color:var(--ld-text)]">
            <img src="/favicon.svg" alt="" width="30" height="30" className="rounded-lg" />
            <span className="font-display text-[18px] font-bold tracking-[-0.02em]">{MARCA.nombre}</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-4">
            <a href="/planes" onClick={() => medirAccion('emp_precios_menu')} className={enlaceMenu}>{tx('Precios')}</a>
            <a href="/panel/login" className={enlaceMenu}>{tx('Entrar')}</a>
            <a href={alta} onClick={() => medirAccion('emp_probar_menu')} data-testid="emp-probar-menu"
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-3 text-[13.5px] font-semibold text-[#04121a] hover:brightness-110">{tx('Probar gratis')}</a>
          </div>
        </div>
      </nav>

      {/* ── Arriba: lo que se ve sin deslizar ── */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-[-10%] h-[520px] w-[720px] rounded-full bg-brand-400/[0.10] blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 px-5 pb-16 pt-7 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-400/10 px-3 py-1 text-[13px] font-semibold text-[color:var(--ld-text)]">
              <Warehouse size={14} className="text-[color:var(--ld-accent)]" /> {tx('Para empresas con furgonetas')}
            </p>
            <h1 className="mt-4 font-display text-[clamp(34px,5.4vw,60px)] font-extrabold leading-[1.03] tracking-[-0.045em] text-[color:var(--ld-text)] [text-wrap:balance]">
              {tx('Deja de pagar golpes que no son tuyos')}
            </h1>
            <p className="mt-4 max-w-[34rem] text-[16.5px] leading-relaxed text-[color:var(--ld-muted)] sm:mt-6 sm:text-[17.5px]">
              {tx('Cada conductor revisa su furgoneta con fotos desde el móvil. Si aparece un golpe, ves en qué revisión apareció y quién la llevaba. Y cuando te pasan un cargo al devolverla, tienes las fotos con fecha.')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
              <a href={alta} onClick={() => medirAccion('emp_probar_arriba')} className={BTN_PRIMARIO} data-testid="emp-probar">
                {tx('Probar gratis {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} />
              </a>
              <a href="#demo" onClick={() => medirAccion('emp_demo_boton')} className={BTN_SECUNDARIO} data-testid="emp-ensenar">
                {tx('Que me la enseñen en 15 minutos')}
              </a>
            </div>
            <p className="mt-3 text-[13px] text-[color:var(--ld-muted)]" data-testid="emp-linea-precio">
              {lineaPrecio} · <a href="/planes" onClick={() => medirAccion('emp_precios_arriba')} className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Ver precios')}</a>
            </p>
          </div>
          <VistaPanel />
        </div>
      </header>

      {/* ── De dónde sale ── */}
      <Seccion eyebrow={tx('De dónde sale')} titulo={tx('No salió de una oficina. Salió de una nave.')}
        sub={tx('{marca} se hizo dentro de una empresa de reparto, para su propio día a día. Allí se hacen unas {n} revisiones con foto cada semana, y la oficina ve cada día quién la ha hecho y quién no.', { marca: MARCA.nombre, n: CIFRAS_CASA.revisionesSemana })}
        className="border-t border-[color:var(--ld-border)]">
        <dl className="grid grid-cols-3 gap-3 sm:gap-6">
          {[[CIFRAS_CASA.naves, tx('naves')], [CIFRAS_CASA.furgonetas, tx('furgonetas')],
            [tx('unas {n}', { n: CIFRAS_CASA.revisionesSemana }), tx('revisiones con foto cada semana')]].map(([n, t]) => (
            <div key={t} className="flex flex-col-reverse justify-end rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] px-3 py-5 sm:p-6">
              <dt className="mt-2 text-[13px] leading-snug text-[color:var(--ld-muted)] sm:text-[14.5px]">{t}</dt>
              <dd className="font-display text-[clamp(26px,4.4vw,44px)] font-extrabold leading-none tracking-[-0.04em] text-[color:var(--ld-text)] tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </Seccion>

      {/* ── Tres problemas, con su respuesta ── */}
      <Seccion eyebrow={tx('Lo que te cuesta dinero')} titulo={tx('Tres problemas que acaba pagando la empresa')}
        className="border-t border-[color:var(--ld-border)]">
        <div className="grid gap-5 lg:grid-cols-3">
          {PROBLEMAS.map(({ icono: Icono, titulo: t, texto, ve }) => (
            <article key={t} className="flex flex-col rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)] p-5 sm:p-6" data-testid="emp-problema">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/[0.12] ring-1 ring-brand-400/25"><Icono size={17} className="text-[color:var(--ld-accent)]" /></span>
                <h3 className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--ld-text)]">{tx(t)}</h3>
              </div>
              <p className="mt-2.5 text-[15px] leading-snug text-[color:var(--ld-muted)]">{tx(texto)}</p>
              <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ld-accent)]">{tx('Cómo se ve en {marca}', { marca: MARCA.nombre })}</p>
              <ul className="mt-2.5 space-y-2">
                {ve.map(([linea, soloPro]) => (
                  <li key={linea} className="flex gap-2 text-[14px] leading-snug text-[color:var(--ld-text)]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[color:var(--ld-ok)]" />
                    <span>{soloPro && <Etiqueta>{etiquetaPro}</Etiqueta>}{tx(linea)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        {/* Una pantalla REAL del panel (Inspecciones, el detalle de una revisión) con una revisión de ejemplo: la sacó un
            guion de Playwright con la API simulada (scratchpad/crecer/empresas/captura/captura.mjs), en español y en inglés
            (el panel en ese idioma); los demás idiomas ven la española. */}
        <figure className="mx-auto mt-8 max-w-[560px]">
          <img src={lang === 'en' ? '/empresas/inspeccion-golpe-en.jpg' : '/empresas/inspeccion-golpe.jpg'} loading="lazy" decoding="async" width="1200" height="1184" data-testid="emp-captura"
            alt={tx('El detalle de una revisión en el panel: la foto del lateral de la furgoneta con el golpe marcado en la puerta lateral.')}
            className="h-auto w-full rounded-2xl border border-[color:var(--ld-border-strong)] shadow-[0_30px_70px_-40px_rgba(0,0,0,.6)]" />
          {/* 14-11-2026 (ronda 3, M3): la foto de la demo no tiene ningún golpe y la caja marca chapa limpia: el pie lo dice. */}
          <figcaption className="mt-2 text-center text-[12.5px] text-[color:var(--ld-muted)]">{tx('Pantalla real del panel. La foto y el golpe marcado son de ejemplo.')}</figcaption>
        </figure>
      </Seccion>

      {/* ── Las pantallas del panel: la misma rejilla que la portada, con su etiqueta donde toca ── */}
      <Seccion eyebrow={tx('Las pantallas del panel')} titulo={tx('El panel de la oficina y el móvil de cada conductor')}
        sub={tx('Lo que entra en cada plan está en la página de precios.')}
        className="border-t border-[color:var(--ld-border)]">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-border)] sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS_EMPRESA.map(([Icono, t, d, etiquetas = [], partes]) => (
            <li key={t} className="bg-[color:var(--ld-bg)] p-5" data-testid="emp-modulo">
              <Icono size={19} className="text-[color:var(--ld-accent)]" />
              <h3 className="mt-3 text-[15.5px] font-semibold text-[color:var(--ld-text)]">{tx(t)}</h3>
              {etiquetas.length > 0 && <p className="mt-1.5">{etiquetas.map((k) => <Etiqueta key={k}>{etiquetaModulo(k)}</Etiqueta>)}</p>}
              {/* Una casilla con una parte de Pro y otra que no (el quinto elemento): la etiqueta, solo en su frase. */}
              {Array.isArray(partes) ? partes.map(([frase, k]) => (
                <p key={frase} className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--ld-muted)]" data-testid={k ? `emp-modulo-${k}` : undefined}>
                  {k && <Etiqueta>{etiquetaModulo(k)}</Etiqueta>}{tx(frase)}
                </p>
              )) : <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[14px]"><a href="/planes" onClick={() => medirAccion('emp_precios_modulos')} className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Ver qué lleva cada plan')} <ArrowRight size={14} /></a></p>
      </Seccion>

      {/* ── Haz la cuenta ── */}
      <Seccion id="cuenta" eyebrow={tx('Haz la cuenta')} titulo={tx('Lo que te cuesta, frente a lo que te ahorras')}
        className="border-t border-[color:var(--ld-border)]">
        <Calculadora planes={planes} tramos={tramos} furgonetas={furgonetas} setFurgonetas={setFurgonetas} />
      </Seccion>

      {/* ── Cómo se empieza ── */}
      <Seccion eyebrow={tx('Cómo se empieza')} titulo={tx('Tres pasos para empezar')}
        className="border-t border-[color:var(--ld-border)]">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {PASOS_EMPRESA.map(([Icono, t, d], i) => (
            <li key={t}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/[0.12] ring-1 ring-brand-400/25"><Icono size={18} className="text-[color:var(--ld-accent)]" /></span>
                <span className="font-mono text-[12px] font-semibold text-[color:var(--ld-dim)]">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] text-[color:var(--ld-text)]">{tx(t)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button type="button" onClick={abrirDemoPanel} disabled={demo === 'cargando'} className={BTN_SECUNDARIO}>
            {demo === 'cargando' ? <Loader2 size={16} className="animate-spin" /> : null} {tx('Ver la demo del panel')}
          </button>
          <span className="text-[13px] text-[color:var(--ld-muted)]">{tx('Un panel de ejemplo, de solo lectura, sin registrarte.')}</span>
        </div>
        {demo === 'error' && (
          <p role="status" className="mt-2 text-[13px] text-[color:var(--ld-warn)]">
            {tx('La demo no responde ahora mismo. Puedes crear la cuenta o pedir que te la enseñemos.')}{' '}
            <a href="#demo" className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--ld-accent)] hover:underline">{tx('Pedir la demostración')}</a>
          </p>
        )}
      </Seccion>

      {/* ── Preguntas ── */}
      <Seccion eyebrow={tx('Preguntas frecuentes')} titulo={tx('Lo que pregunta el dueño de una flota')} className="border-t border-[color:var(--ld-border)]">
        <div className="divide-y divide-[color:var(--ld-border)] overflow-hidden rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-surface)]">
          {PREGUNTAS_EMPRESA.map(([q, k]) => (
            <details key={k} className="group px-5">
              {/* El relleno va en el summary: toda la fila abre la pregunta. */}
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 py-4 text-[16px] font-semibold text-[color:var(--ld-text)]">
                {tx(q)} <span className="text-[color:var(--ld-accent)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{respuesta(k)}</p>
            </details>
          ))}
        </div>
      </Seccion>

      {/* ── Que me la enseñen ── */}
      <Seccion id="demo" eyebrow={tx('Demostración')} titulo={tx('Que te la enseñemos en 15 minutos')}
        sub={tx('Déjanos tus datos y te contestamos para quedar. Si lo prefieres, empieza la prueba ya: son {n} días gratis.', { n: DIAS_PRUEBA_EMPRESA })}
        className="scroll-mt-16 border-t border-[color:var(--ld-border)]">
        <FormularioDemo alEnviar={() => setDemoPedida(true)} />
      </Seccion>

      {/* ── Cierre ── */}
      <section className="mx-auto max-w-[1120px] px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-brand-400/25 bg-[color:var(--ld-surface)] px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-brand-400/[0.14] blur-[90px]" />
          <h2 className="relative font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[color:var(--ld-text)] [text-wrap:balance]">{tx('El próximo golpe, con sus fotos y su fecha')}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{lineaPrecio}</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <a href={alta} onClick={() => medirAccion('emp_probar_cierre')} className={BTN_PRIMARIO} data-testid="emp-probar-cierre">{tx('Probar gratis {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} /></a>
            {/* Con la demo ya pedida, no se vuelve a ofrecer. */}
            {!demoPedida && <a href="#demo" onClick={() => medirAccion('emp_demo_cierre')} className={BTN_SECUNDARIO} data-testid="emp-ensenar-cierre">{tx('Que me la enseñen en 15 minutos')}</a>}
          </div>
        </div>
      </section>

      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
