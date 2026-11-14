import { Link } from 'react-router-dom'
import { ShieldCheck, FileLock2, Camera, AlertTriangle, Check, ArrowRight } from 'lucide-react'
import { LANGS, useT } from '../i18n'
import { MARCA } from '../marca'
import { DIAS_PRUEBA_EMPRESA } from '../lib/precios'

/* «CÓMO FUNCIONA LA IA DE DAÑOS» (/peritaje-tecnico): a donde lleva el pie de /empresas y de la portada.
   Reescrita el 14-11-2026 (ronda 3, V1) con el tono de /empresas: decía «Demuestra quién golpeó cada vehículo. Sin
   discusión.», «al salir y al volver», «90 segundos», «800-3.000€», «Imposible falsificar», «paga 3 veces el plan» y un
   «Acceso anticipado» que ningún código respalda. Ahora cada frase tiene detrás lo que hace el servidor hoy (la tabla
   frase → fichero está en el informe del encargo):
   - la revisión: una por conductor, furgoneta y día (server.py, crear inspección, 409); la firma, de la oficina
     (Inspecciones.jsx, ForensicSignBlock). 14-11-2026: aquí NO se dice que firme el conductor: la tarjeta de firma de
     driver/InspectionDone.jsx lee `result.id` y /inspections/upload contesta `inspection_id`, así que su botón se queda
     apagado y hoy el conductor no firma desde el portal (la app nativa no firma);
   - la IA: `confidence` por golpe; por debajo de 0,65 queda como sugerido; el PDF pone el % y separa lo que no llega;
   - la firma: POST /inspections/{id}/sign guarda quién, cuándo, la IP y un SHA-256 de un subconjunto fijo de la
     revisión (_canonical_inspection_payload: las DIRECCIONES de las fotos, no la imagen) encadenado con la firma
     anterior de la empresa; solo con el plan Pro (`forensics`);
   - el PDF (GET /inspections/{id}/forensic-pdf, solo la oficina) y la comprobación pública (GET /verify/{hash}), que
     dice si el código está registrado y enseña fecha, firmante y matrícula en parte oculta. NO vuelve a calcular el
     código, así que aquí no se dice que «cualquier cambio se nota»;
   - los avisos de trampa (_calculate_fraud_score): la primera foto casi igual a otra de los últimos 30 días, o la
     matrícula leída distinta. 14-11-2026: el aviso de «foto hecha más de un día antes» (old_photo) se quitó de aquí:
     lee el EXIF de la foto YA GUARDADA y _process_image_sync la vuelve a guardar sin EXIF, así que no salta nunca.
   NUNCA «admisible en juicio» ni «quién dio el golpe». Solo en español, como antes. */

const ALTA = '/registro?sector=otra&plan=completo'   // la misma alta que /empresas (Empresas.jsx, ALTA_EMPRESA)

const PASOS = [
  [Camera, 'El conductor revisa la furgoneta con fotos',
    'Desde el móvil, a la hora que decida tu empresa: cada conductor hace una revisión por furgoneta y día. Con el plan Pro, la oficina la firma después desde el panel.'],
  [ShieldCheck, 'La IA marca los golpes que parecen nuevos',
    'Compara cada foto con la anterior del mismo lado y marca la pieza, la gravedad y cuánto está de segura. Se equivoca a menudo, sobre todo con los golpes leves: sirve para saber dónde mirar, no es un veredicto. Lo que no tiene claro queda como sugerencia, y con el plan Pro confirmas o descartas cada golpe en Revisión rápida.'],
  [FileLock2, 'La revisión firmada sale en un informe en PDF',
    'Con el plan Pro: las fotos y los golpes marcados, quién la firmó, cuándo y desde qué IP, y un código que cualquiera puede comprobar en nuestra web.'],
]

const INFORME = [
  ['Las fotos con los golpes marcados', 'Cada golpe con su pieza, su gravedad, su coste estimado y su % de confianza. Los que no llegan al 50 % o no tienen la caja clara salen aparte, como sugerencias para que los mire una persona.'],
  ['La firma', 'Quién firmó, la fecha y la hora, la IP desde la que firmó y el texto que quedó con la firma.'],
  ['Un código SHA-256', 'Calculado al firmar con los datos de la revisión (fecha, furgoneta, conductor, las direcciones de sus fotos y el resumen del análisis) y encadenado con el de la firma anterior de tu empresa.'],
  ['Un QR a la comprobación', 'Cualquiera puede ver en nuestra web, con ese código, que la firma está registrada, la fecha de la revisión y de la firma, quién la firmó y la matrícula en parte oculta.'],
]

export default function PeritajeTecnico() {
  const { lang, setLang } = useT()
  return (
    <div className="min-h-screen bg-dark-950 text-dark-50">
      {/* Nav */}
      <nav className="border-b border-dark-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width="32" height="32" className="rounded-lg" />
            <b>{MARCA.nombre}</b>
          </Link>
          {/* En el móvil (375 px) no caben los cinco: «Precios» y «Contacto» se pisaban con la marca (14-11-2026). */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/planes" className="hidden text-sm text-dark-300 hover:text-dark-100 sm:inline">Precios</Link>
            <Link to="/contacto" className="hidden text-sm text-dark-300 hover:text-dark-100 sm:inline">Contacto</Link>
            <Link to="/panel/login" className="rounded-lg border border-dark-700 px-3 py-1.5 text-sm hover:bg-dark-800">Entrar</Link>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-dark-800 bg-dark-900 px-2 py-1 text-xs">
              {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </nav>

      {/* Arriba */}
      <section className="mx-auto max-w-4xl px-5 py-14 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-300">
          <ShieldCheck size={14} /> Revisiones con foto e IA
        </span>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Cómo funciona la <span className="text-sky-400">IA de daños</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-dark-300">
          Marca los golpes que parecen nuevos en cada revisión con foto y te dice quién llevaba la furgoneta en cada revisión. No dice quién dio el golpe.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to={ALTA} className="rounded-lg bg-gradient-to-r from-sky-500 to-sky-700 px-6 py-3 text-base font-bold text-white shadow-lg shadow-sky-900/40 hover:from-sky-400 hover:to-sky-600">
            Probar gratis {DIAS_PRUEBA_EMPRESA} días
          </Link>
          <Link to="/empresas" className="rounded-lg border border-dark-700 px-5 py-3 text-base font-semibold text-dark-200 hover:bg-dark-800">
            Ver todo lo que hace para tu empresa →
          </Link>
        </div>
        <p className="mt-3 text-xs text-dark-500">Sin tarjeta durante la prueba.</p>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-dark-800 bg-dark-900/40 py-14">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="mb-12 text-center text-3xl font-extrabold">En tres pasos</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {PASOS.map(([Icono, titulo, texto], i) => (
              <Step key={titulo} n={i + 1} icon={<Icono size={26} />} title={titulo} text={texto} />
            ))}
          </div>
        </div>
      </section>

      {/* El informe */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="mb-3 text-center text-3xl font-extrabold">Qué lleva el informe pericial</h2>
        <p className="mb-10 text-center text-dark-400">Va en el plan Pro. Lo descarga la oficina desde el detalle de cada revisión firmada.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {INFORME.map(([t, d]) => (
            <div key={t} className="flex gap-3 rounded-xl border border-dark-800 bg-dark-900/50 p-4">
              <Check className="mt-0.5 shrink-0 text-emerald-400" size={18} />
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-sm text-dark-400">{d}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-dark-400">
          Además, en todos los planes de flota, el detalle de cada revisión avisa si su primera foto es casi igual a la de otra revisión de esa furgoneta de los últimos 30 días o si la matrícula que lee la IA no es la suya.
        </p>
      </section>

      {/* Lo que no es */}
      <section className="mx-auto max-w-3xl px-5 pb-14">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-amber-300">
            <AlertTriangle size={16} /> Lo que no es
          </div>
          <ul className="space-y-2 text-sm leading-relaxed text-dark-300">
            <li><b>No dice quién dio el golpe.</b> Dice en qué revisión apareció y quién llevaba la furgoneta.</li>
            <li><b>No es una firma electrónica avanzada</b> ni asesoría jurídica. Es un registro técnico de la revisión: el valor que tenga ante un cliente, un renting o un juzgado lo decide quien lo recibe.</li>
            <li><b>La IA se equivoca a veces.</b> Por eso cada golpe lleva su % de confianza en el informe, y con el plan Pro lo confirmas o lo descartas tú.</li>
          </ul>
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <h2 className="mb-3 text-2xl font-extrabold">¿Cuánto te cuesta y cuánto te ahorra?</h2>
        <p className="mb-7 text-dark-400">Haz la cuenta con tus furgonetas y con el último cargo por daños que te pasaron.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/empresas#cuenta" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-sky-700 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-900/40 hover:from-sky-400 hover:to-sky-600">
            Hacer la cuenta <ArrowRight size={17} />
          </Link>
          <Link to="/contacto?asunto=Peritaje" className="rounded-lg border border-dark-700 px-5 py-3.5 text-base font-semibold text-dark-200 hover:bg-dark-800">
            Escríbenos
          </Link>
        </div>
      </section>

      <footer className="border-t border-dark-800 py-6 text-center text-xs text-dark-500">
        © {new Date().getFullYear()} {MARCA.nombre} · <Link to="/privacidad" className="hover:text-dark-300">Privacidad</Link> · <Link to="/terminos" className="hover:text-dark-300">Términos</Link> · <Link to="/contacto" className="hover:text-dark-300">Contacto</Link>
      </footer>
    </div>
  )
}

function Step({ n, icon, title, text }) {
  return (
    <div className="relative rounded-2xl border border-dark-800 bg-dark-900 p-6">
      <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-sm font-extrabold text-white">{n}</div>
      <div className="mb-3 text-sky-400">{icon}</div>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="text-sm text-dark-400">{text}</p>
    </div>
  )
}
