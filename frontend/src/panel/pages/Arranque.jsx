import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useT, LANG_LOCALE } from '../../i18n'
import { useTitulo } from '../../lib/titulo'
import { isAuthed } from '../auth'
import { getAltaEstado, altaFurgonetas, altaConductores, getAccesosConductores } from '../api'
import AccesoConductor, { useAcceso, claseDeEstado } from '../components/AccesoConductor'
import Matricula from '../../components/Matricula'
import SelloFoto from '../../components/SelloFoto'
import { BTN_PRIMARIO, BTN_SECUNDARIO, LogoMarca } from '../../pages/portadaComun'
import { nocheElegida } from '../../pages/entradaComun'
import { MARCA } from '../../marca'
import { diaSello, codigoDe, textoConCodigo } from '../../lib/accesoConductor'
import { selloDeFecha } from '../../lib/sello'
import { verTelefono } from '../../lib/telefono'

/* EL ARRANQUE DE UNA FLOTA (14-11-2026, «Una flota empieza sola en diez minutos»; CONTRATO-ALTA §3).
   De «Cuenta creada» a «ha llegado la primera revisión», en una sola pantalla y cuatro pasos: tus furgonetas, tus
   conductores, dales acceso y la primera revisión. No se guarda ninguna marca: en qué paso va sale de los datos
   (GET /alta/estado), así que se puede dejar a medias y el inicio del panel lo retoma.
   Va FUERA de PanelLayout, como el expediente: su guardián decide por el último tramo de la dirección («arranque», que
   no es un módulo) y echaría a cualquier empresa con lista de módulos. Abre para cualquier sesión del panel; lo que se
   puede hacer lo decide el servidor (require_admin). Con la identidad nueva: papel, una acción principal por paso. */

const PASOS = [
  { id: 'furgonetas', titulo: 'alta.p1.titulo' },
  { id: 'conductores', titulo: 'alta.p2.titulo' },
  { id: 'acceso', titulo: 'alta.p3.titulo' },
  { id: 'revision', titulo: 'alta.p4.titulo' },
]
const VISTAS = { frontal: 'alta.vista.frontal', trasera: 'alta.vista.trasera', lateral_izq: 'alta.vista.izq', lateral_der: 'alta.vista.der' }
const ORDEN_VISTAS = ['frontal', 'trasera', 'lateral_izq', 'lateral_der']
const CADA_REVISION_MS = 5000
const CADA_ACCESOS_MS = 15000

const ANCHO = 'mx-auto w-full max-w-[760px] px-4 sm:px-8'
const TITULAR = 'text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[38px]'
const TEXTO = 'text-[17px] leading-relaxed text-[color:var(--ld-text2)]'
const GRIS = 'text-[14px] text-[color:var(--ld-muted)]'
const CAMPO = 'w-full rounded-[12px] border-[1.5px] border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3.5 py-3 text-[16px] text-[color:var(--ld-text)] placeholder:text-[color:var(--ld-muted)] focus:border-[color:var(--ld-text)] focus:outline-none focus-visible:ring-0'
const ERROR = 'text-[15px] font-semibold text-[color:var(--ld-warn)]'

/* Los porqués del servidor, por su `codigo` y en el idioma del panel (tercera tanda, A11 y CONTRATO R12); sin código, su
   texto tal cual. */
function textoDeError(t, e) {
  if (!e?.response) return t('alta.err.red')
  const d = e.response.data?.detail
  return textoConCodigo(t, codigoDe(e.response.data), typeof d === 'string' && d ? d : t('alta.err.servidor'), { nombre: e.response.data?.dato })
}

/* Lo que dice cada línea revisada, igual: por su código y, si no lo trae (o le falta un dato para decirlo), el texto
   del servidor. `dato`: el nombre con el que ya está dado de alta, o el trozo de móvil que no se entiende
   (CONTRATO-ALTA, «Códigos»). */
const motivoDe = (t, l) => textoConCodigo(t, l.codigo, l.motivo || '', { nombre: l.dato, movil: l.dato })
const avisoDe = (t, l) => textoConCodigo(t, l.aviso_codigo, l.aviso || '')

/* Una línea con letras y cifras que no tiene forma de matrícula («Furgo 1», «VAN 12»): el servidor la manda `dudosa`
   y no entra salvo que se confirme (A11). Las confirmadas vuelven `nueva` con `confirmada: true`. */
const esRara = (l) => l.estado === 'dudosa' || (l.estado !== 'nueva' && l.codigo === 'matricula_dudosa')

/* Guardar con las confirmadas: el cuerpo de siempre más `confirmadas` (los textos tal como se pegaron). */
const guardarFurgonetas = (texto, sede, guardar, confirmadas) => altaFurgonetas(texto, sede, guardar, confirmadas)

/* La sede, solo si la empresa tiene varias: sin ella el servidor no sabría dónde darlas de alta. */
function Sede({ centros, valor, onCambio, etiqueta }) {
  const { t } = useT()
  if (!Array.isArray(centros) || centros.length < 2) return null
  return (
    <label className="mt-5 block">
      <span className="text-[15px] font-semibold">{etiqueta}</span>
      <select value={valor} onChange={(e) => onCambio(e.target.value)} className={`mt-1.5 ${CAMPO} sm:max-w-xs`}>
        <option value="">{t('alta.sede.elige')}</option>
        {centros.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  )
}

/* Lo que pasará con cada línea, antes de guardar. */
function Lineas({ lineas, pinta }) {
  return (
    <ul className="mt-5 border-t border-[color:var(--ld-border)]" data-testid="alta-lineas">
      {lineas.map((l) => (
        <li key={l.n} className="flex items-center gap-3 border-b border-[color:var(--ld-border)] py-2.5" data-estado={l.estado}>
          <span className="w-7 shrink-0 font-mono text-[13px] tabular-nums text-[color:var(--ld-muted)]">{l.n}</span>
          {pinta(l)}
        </li>
      ))}
    </ul>
  )
}

const claseEstado = (estado) => (estado === 'nueva' || estado === 'nuevo'
  ? 'text-[color:var(--ld-ok)]' : estado === 'error' ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-muted)]')

/* ── 1 · Tus furgonetas ─────────────────────────────────────────────────────────────────────────────────────── */
function PasoFurgonetas({ estado, sede, setSede, onCambio, onSeguir }) {
  const { t } = useT()
  const [texto, setTexto] = useState('')
  const [vista, setVista] = useState(null)
  const [guardadas, setGuardadas] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const [siSon, setSiSon] = useState([])           // las «raras» que la persona confirma que sí son matrículas
  const tiene = estado.furgonetas || 0

  const enviar = async (guardar) => {
    setError(''); setOcupado(guardar ? 'guardar' : 'revisar')
    try {
      const { data } = await guardarFurgonetas(texto, sede, guardar, guardar ? siSon : [])
      if (guardar) {
        setGuardadas((data.creadas || []).length)
        setTexto(''); setVista(null); setSiSon([])
        onCambio()
      } else {
        setVista(data); setGuardadas(null); setSiSon([])
      }
    } catch (e) { setError(textoDeError(t, e)) } finally { setOcupado('') }
  }

  const lineas = Array.isArray(vista?.lineas) ? vista.lineas : []
  const raras = lineas.filter(esRara)
  const confirmadas = raras.filter((l) => siSon.includes(l.texto)).length
  const nuevas = (vista?.nuevas || 0) + confirmadas
  return (
    <>
      <p className={`mt-3 ${TEXTO}`}>{t('alta.p1.sub')}</p>
      {tiene > 0 && guardadas == null && (
        <p className={`mt-2 ${GRIS}`} data-testid="alta-ya-tienes">{t(tiene === 1 ? 'alta.p1.yaTienes1' : 'alta.p1.yaTienes').replace('{n}', tiene)}</p>
      )}
      <Sede centros={estado.centros} valor={sede} onCambio={setSede} etiqueta={t('alta.p1.sede')} />
      <label className="mt-5 block">
        <span className="sr-only">{t('alta.p1.sub')}</span>
        <textarea value={texto} rows={6} spellCheck={false} autoCapitalize="characters"
          onChange={(e) => { setTexto(e.target.value); setVista(null); setGuardadas(null) }}
          placeholder={'1234 ABC\n5678 KLM'} data-testid="alta-furgonetas-texto"
          className={`${CAMPO} font-mono leading-relaxed`} />
      </label>

      {vista && (
        <>
          <Lineas lineas={lineas.filter((l) => !esRara(l))} pinta={(l) => (
            <>
              <span className="min-w-0 flex-1">
                {l.matricula ? <Matricula texto={l.matricula} className="text-[15px]" /> : <span className="break-all font-mono text-[15px]">{l.texto}</span>}
              </span>
              <span className={`shrink-0 text-right text-[14px] font-semibold ${claseEstado(l.estado)}`}>
                {l.estado === 'nueva' ? t('alta.p1.nueva') : motivoDe(t, l)}
              </span>
            </>
          )} />
          {raras.length > 0 && (
            <fieldset className="mt-7" data-testid="alta-raras">
              <legend className="text-[17px] font-bold">{t('alta.p1.rarasTitulo')}</legend>
              <p className={`mt-1 ${GRIS}`}>{t('alta.p1.rarasSub')}</p>
              <ul className="mt-3 border-t border-[color:var(--ld-border)]">
                {raras.map((l) => (
                  <li key={l.n} className="border-b border-[color:var(--ld-border)]">
                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
                      <span className="w-7 shrink-0 font-mono text-[13px] tabular-nums text-[color:var(--ld-muted)]">{l.n}</span>
                      <span className="min-w-0 flex-1 break-all font-mono text-[15px]">{l.texto}</span>
                      <span className="shrink-0 text-[14px] font-semibold">{t('alta.p1.rarasSi')}</span>
                      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[color:var(--ld-text)]"
                        checked={siSon.includes(l.texto)}
                        onChange={(e) => setSiSon((xs) => (e.target.checked ? [...xs, l.texto] : xs.filter((x) => x !== l.texto)))} />
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <p className={`mt-3 ${GRIS}`} data-testid="alta-resumen">
            {t('alta.p1.resumen').replace('{nuevas}', nuevas).replace('{ya}', vista.ya_estaban || 0).replace('{mal}', lineas.filter((l) => l.estado === 'error' && !esRara(l)).length)}
          </p>
        </>
      )}
      {guardadas != null && (
        <p role="status" className="mt-5 flex items-center gap-2 text-[16px] font-semibold text-[color:var(--ld-ok)]">
          <Check size={18} aria-hidden="true" /> {t(guardadas === 1 ? 'alta.p1.guardadas1' : 'alta.p1.guardadas').replace('{n}', guardadas)}
        </p>
      )}
      {error && <p role="alert" className={`mt-4 ${ERROR}`}>{error}</p>}

      <div className="mt-7 flex flex-wrap gap-3">
        {vista && nuevas > 0 ? (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled={!!ocupado} aria-busy={ocupado === 'guardar' || undefined} onClick={() => enviar(true)}>
              {ocupado === 'guardar' ? t('alta.guardando') : t(nuevas === 1 ? 'alta.p1.guardar1' : 'alta.p1.guardar').replace('{n}', nuevas)}
            </button>
            <button type="button" className={BTN_SECUNDARIO} disabled={!!ocupado} onClick={() => setVista(null)}>{t('alta.cambiarLista')}</button>
          </>
        ) : texto.trim() && !vista ? (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled={!!ocupado} aria-busy={ocupado === 'revisar' || undefined} onClick={() => enviar(false)}>
              {ocupado === 'revisar' ? t('alta.revisando') : t('alta.revisar')}
            </button>
            <Link to="/panel/importaciones?t=furgonetas" className={BTN_SECUNDARIO}>{t('alta.excel')}</Link>
          </>
        ) : tiene > 0 ? (
          <>
            <button type="button" className={BTN_PRIMARIO} onClick={onSeguir}>{t('alta.seguir')}</button>
            {vista && <button type="button" className={BTN_SECUNDARIO} onClick={() => setVista(null)}>{t('alta.cambiarLista')}</button>}
          </>
        ) : (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled>{t('alta.revisar')}</button>
            <Link to="/panel/importaciones?t=furgonetas" className={BTN_SECUNDARIO}>{t('alta.excel')}</Link>
          </>
        )}
      </div>
    </>
  )
}

/* ── 2 · Tus conductores ────────────────────────────────────────────────────────────────────────────────────── */
const FILA_VACIA = { nombre: '', movil: '', email: '' }
const limpio = (x) => String(x || '').replace(/[\t\r\n]+/g, ' ').trim()

function PasoConductores({ estado, sede, setSede, onCambio, onSeguir }) {
  const { t } = useT()
  const [modo, setModo] = useState('filas')            // 'filas' | 'pegar'
  const [filas, setFilas] = useState([{ ...FILA_VACIA }, { ...FILA_VACIA }])
  const [pegado, setPegado] = useState('')
  const [vista, setVista] = useState(null)
  const [guardados, setGuardados] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const tiene = estado.conductores || 0

  /* Fila a fila va a la MISMA ruta que la lista pegada: una persona por línea, sus datos separados por tabuladores. */
  const texto = modo === 'pegar' ? pegado
    : filas.map((f) => [f.nombre, f.movil, f.email].map(limpio).filter(Boolean).join('\t')).filter(Boolean).join('\n')
  const cambiar = () => { setVista(null); setGuardados(null) }
  const ponFila = (i, k, v) => { setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f))); cambiar() }

  const enviar = async (guardar) => {
    setError(''); setOcupado(guardar ? 'guardar' : 'revisar')
    try {
      const { data } = await altaConductores(texto, sede, guardar)
      if (guardar) {
        setGuardados((data.creados || []).length)
        setVista(null); setPegado(''); setFilas([{ ...FILA_VACIA }, { ...FILA_VACIA }])
        onCambio()
      } else {
        setVista(data); setGuardados(null)
      }
    } catch (e) { setError(textoDeError(t, e)) } finally { setOcupado('') }
  }

  const nuevos = vista?.nuevos || 0
  /* Pestañas de verdad (A11): cada una dice qué panel lleva, solo la elegida entra con el tabulador y las flechas
     cambian de una a otra, como en cualquier lista de pestañas. */
  const elegir = (id) => { setModo(id); cambiar() }
  const flechas = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const id = e.key === 'Home' ? 'filas' : e.key === 'End' ? 'pegar' : modo === 'filas' ? 'pegar' : 'filas'
    elegir(id)
    document.getElementById(`alta-pestana-${id}`)?.focus()
  }
  const pestana = (id, k) => (
    <button type="button" role="tab" id={`alta-pestana-${id}`} aria-selected={modo === id} aria-controls="alta-panel-conductores"
      tabIndex={modo === id ? 0 : -1} onClick={() => elegir(id)} onKeyDown={flechas}
      className={`min-h-[44px] border-b-2 px-1 text-[15px] font-semibold ${modo === id
        ? 'border-[color:var(--ld-text)] text-[color:var(--ld-text)]' : 'border-transparent text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`}>
      {t(k)}
    </button>
  )
  return (
    <>
      <p className={`mt-3 ${TEXTO}`}>{t('alta.p2.sub')}</p>
      {tiene > 0 && guardados == null && (
        <p className={`mt-2 ${GRIS}`} data-testid="alta-ya-tienes">{t(tiene === 1 ? 'alta.p2.yaTienes1' : 'alta.p2.yaTienes').replace('{n}', tiene)}</p>
      )}
      <Sede centros={estado.centros} valor={sede} onCambio={setSede} etiqueta={t('alta.p2.sede')} />

      <div role="tablist" className="mt-5 flex gap-6 border-b border-[color:var(--ld-border)]">
        {pestana('filas', 'alta.p2.filas')}
        {pestana('pegar', 'alta.p2.pegar')}
      </div>

      <div role="tabpanel" id="alta-panel-conductores" aria-labelledby={`alta-pestana-${modo}`}>
      {modo === 'filas' ? (
        <div className="mt-4 space-y-3">
          {filas.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1.2fr]" data-testid="alta-fila">
              <input aria-label={t('alta.p2.nombre')} placeholder={t('alta.p2.nombre')} value={f.nombre} autoComplete="off"
                onChange={(e) => ponFila(i, 'nombre', e.target.value)} className={CAMPO} />
              <input aria-label={t('alta.p2.movil')} placeholder={t('alta.p2.movil')} value={f.movil} inputMode="tel" autoComplete="off"
                onChange={(e) => ponFila(i, 'movil', e.target.value)} className={`${CAMPO} font-mono`} />
              <input aria-label={t('alta.p2.correo')} placeholder={t('alta.p2.correo')} value={f.email} type="email" autoComplete="off"
                onChange={(e) => ponFila(i, 'email', e.target.value)} className={CAMPO} />
            </div>
          ))}
          <button type="button" onClick={() => { setFilas((fs) => [...fs, { ...FILA_VACIA }]); cambiar() }}
            className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[color:var(--ld-accent)] underline-offset-4 hover:underline">
            {t('alta.p2.otraFila')}
          </button>
        </div>
      ) : (
        <textarea value={pegado} rows={6} spellCheck={false} data-testid="alta-conductores-texto"
          onChange={(e) => { setPegado(e.target.value); cambiar() }} aria-label={t('alta.p2.pegar')}
          placeholder={'Ana López, 612 345 678\nLuis Pérez, 698 765 432, luis@ejemplo.es'}
          className={`mt-4 ${CAMPO} leading-relaxed`} />
      )}
      </div>

      {vista && (
        <>
          <Lineas lineas={vista.lineas || []} pinta={(l) => (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{l.nombre || l.texto}</span>
                <span className="block truncate text-[13.5px] text-[color:var(--ld-muted)]">
                  {[l.movil && <span key="m" className="font-mono">{verTelefono(l.movil)}</span>, l.email].filter(Boolean).reduce((a, x, i) => (i ? [...a, ' · ', x] : [x]), [])}
                </span>
                {(l.aviso || l.aviso_codigo) && <span className="block text-[13.5px] text-[color:var(--ld-mid)]">{avisoDe(t, l)}</span>}
              </span>
              <span className={`max-w-[48%] shrink-0 text-right text-[14px] font-semibold ${claseEstado(l.estado)}`}>
                {l.estado === 'nuevo' ? t('alta.p2.nuevo') : motivoDe(t, l)}
              </span>
            </>
          )} />
          <p className={`mt-3 ${GRIS}`} data-testid="alta-resumen">
            {t('alta.p2.resumen').replace('{nuevos}', nuevos).replace('{ya}', vista.ya_estaban || 0).replace('{mal}', vista.errores || 0)}
          </p>
        </>
      )}
      {guardados != null && (
        <p role="status" className="mt-5 flex items-center gap-2 text-[16px] font-semibold text-[color:var(--ld-ok)]">
          <Check size={18} aria-hidden="true" /> {t(guardados === 1 ? 'alta.p2.guardados1' : 'alta.p2.guardados').replace('{n}', guardados)}
        </p>
      )}
      {error && <p role="alert" className={`mt-4 ${ERROR}`}>{error}</p>}

      <div className="mt-7 flex flex-wrap gap-3">
        {vista && nuevos > 0 ? (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled={!!ocupado} aria-busy={ocupado === 'guardar' || undefined} onClick={() => enviar(true)}>
              {ocupado === 'guardar' ? t('alta.guardando') : t(nuevos === 1 ? 'alta.p2.guardar1' : 'alta.p2.guardar').replace('{n}', nuevos)}
            </button>
            <button type="button" className={BTN_SECUNDARIO} disabled={!!ocupado} onClick={() => setVista(null)}>{t('alta.cambiarLista')}</button>
          </>
        ) : texto.trim() && !vista ? (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled={!!ocupado} aria-busy={ocupado === 'revisar' || undefined} onClick={() => enviar(false)}>
              {ocupado === 'revisar' ? t('alta.revisando') : t('alta.revisar')}
            </button>
            <Link to="/panel/importaciones?t=conductores" className={BTN_SECUNDARIO}>{t('alta.excel')}</Link>
          </>
        ) : tiene > 0 ? (
          <>
            <button type="button" className={BTN_PRIMARIO} onClick={onSeguir}>{t('alta.seguir')}</button>
            {vista && <button type="button" className={BTN_SECUNDARIO} onClick={() => setVista(null)}>{t('alta.cambiarLista')}</button>}
          </>
        ) : (
          <>
            <button type="button" className={BTN_PRIMARIO} disabled>{t('alta.revisar')}</button>
            <Link to="/panel/importaciones?t=conductores" className={BTN_SECUNDARIO}>{t('alta.excel')}</Link>
          </>
        )}
      </div>
    </>
  )
}

/* ── 3 · Dales acceso ───────────────────────────────────────────────────────────────────────────────────────── */
function PasoAcceso({ estado, onSeguir, onAtras }) {
  const { t } = useT()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const cargar = useCallback(() => getAccesosConductores()
    .then((r) => { setDatos(r.data); setError('') })
    .catch((e) => setError(textoDeError(t, e))), [t])

  // Se vuelve a mirar cada poco mientras se ve: así «Abierto el 14-11» sale en cuanto el conductor toca su enlace.
  useEffect(() => {
    cargar()
    const id = setInterval(() => { if (document.visibilityState === 'visible') cargar() }, CADA_ACCESOS_MS)
    return () => clearInterval(id)
  }, [cargar])

  const lista = Array.isArray(datos?.conductores) ? datos.conductores : []
  const abiertos = lista.filter((c) => c.acceso?.estado === 'abierto').length
  const cambia = (id, acceso) => setDatos((d) => ({ ...d, conductores: d.conductores.map((c) => (c.driver_id === id ? { ...c, acceso } : c)) }))

  return (
    <>
      <p className={`mt-3 ${TEXTO}`}>{t('alta.p3.sub')}</p>
      {error && <p role="alert" className={`mt-4 ${ERROR}`}>{error}</p>}
      {datos && lista.length === 0 && (
        <p className={`mt-5 ${TEXTO}`}>{t('alta.p3.nadie')}</p>
      )}
      {lista.length > 0 && (
        <>
          <p className={`mt-4 ${GRIS}`} data-testid="alta-abiertos">
            {t('alta.p3.cuenta').replace('{n}', abiertos).replace('{total}', lista.length)}
          </p>
          <ul className="mt-3 border-t border-[color:var(--ld-border)]">
            {lista.map((c) => (
              <li key={c.driver_id} className="grid gap-2 border-b border-[color:var(--ld-border)] py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6" data-testid="alta-conductor">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-bold">{c.nombre}</p>
                  <p className={`truncate text-[13.5px] text-[color:var(--ld-muted)] ${c.movil ? 'font-mono' : ''}`}>{c.movil ? verTelefono(c.movil) : t('alta.p3.sinMovil')}</p>
                </div>
                <AccesoConductor c={c} empresa={datos.empresa || estado.empresa} onCambio={(a) => cambia(c.driver_id, a)} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        {datos && lista.length === 0
          ? <button type="button" className={BTN_PRIMARIO} onClick={onAtras}>{t('alta.p3.anadir')}</button>
          : <button type="button" className={BTN_PRIMARIO} onClick={onSeguir}>{t('alta.p3.seguir')}</button>}
      </div>
    </>
  )
}

/* ── 4 · La primera revisión ────────────────────────────────────────────────────────────────────────────────── */
/* LAS CUATRO FOTOS (cuarta tanda, C1 y C2), en una rejilla de 2×2, la MISMA en la espera y en «Ha llegado»: en la espera,
   cuatro casillas vacías (borde de puntos de 1 px y el nombre del lado en gris) que dicen qué va a llegar; al llegar,
   las fotos ocupan esas mismas casillas, con el lado en la esquina de arriba (como «Antes»/«Hoy» en el repaso) y el
   sello de llegada abajo. */
function CuatroFotos({ fotos, fecha, testid }) {
  const { t, lang } = useT()
  const llenas = Array.isArray(fotos) && fotos.length > 0
  const casillas = llenas ? fotos : ORDEN_VISTAS.map((v) => ({ photo_index: v, vista: v, url: null }))
  return (
    <ul className="grid grid-cols-2 gap-2.5" data-testid={testid}>
      {casillas.map((f) => {
        const lado = t(VISTAS[f.vista] || 'alta.vista.otra')
        return (
          <li key={f.photo_index}>
            {f.url ? (
              <figure className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-[color:var(--ld-hueco)]">
                <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                <figcaption className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded bg-white px-2 py-1 text-[13px] font-bold leading-none text-[#10181a]">
                  {lado}
                </figcaption>
                <SelloFoto fecha={fecha} corto idioma={lang} />
              </figure>
            ) : (
              <figure className="flex aspect-[4/3] items-center justify-center rounded-[10px] border border-dotted border-[color:var(--ld-muted)]" data-vacia="si">
                <figcaption className="px-2 text-center text-[14px] text-[color:var(--ld-muted)]">{lado}</figcaption>
              </figure>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* Un conductor en la espera: su nombre, en qué está su enlace (en mono, con su color) y, si aún no lo ha abierto,
   «Mandar otra vez» (o «Mandar su acceso», si nunca se le mandó), que hace lo mismo que «Mandar por WhatsApp» en «Dales
   acceso»: si el enlace de esta pestaña sigue sin abrir, el mismo; si no, uno nuevo. */
function FilaEspera({ c, empresa, onCambio }) {
  const { t, lang } = useT()
  const a = useAcceso(c, empresa, onCambio)
  const e = a.estado
  const texto = e === 'abierto' ? t('alta.p4.abrio').replace('{dia}', diaSello(c.acceso?.abierto_dia, lang))
    : e === 'sin_abrir' ? t('alta.acc.chip.sinAbrir') : e === 'caducado' ? t('alta.acc.chip.caducado') : t('alta.acc.sinEnlace')
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[color:var(--ld-border)] py-3"
      data-testid="alta-espera-conductor" data-estado={e}>
      <div className="min-w-0">
        <p className="truncate text-[16px] font-semibold">{c.nombre}</p>
        <p className={claseDeEstado(e)} data-testid="alta-espera-estado">{texto}</p>
      </div>
      {e !== 'abierto' && (
        <button type="button" disabled={!!a.ocupado} onClick={() => a.mandar(false)}
          className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[color:var(--ld-text)] underline decoration-[color:var(--ld-border-strong)] underline-offset-4 hover:decoration-[color:var(--ld-text)] disabled:opacity-60">
          {a.ocupado === 'wa' ? t('alta.acc.creando') : t(e === 'sin_enlace' ? 'alta.acc.mandar' : 'alta.p4.mandarOtra')}
        </button>
      )}
      {(a.error || a.confirmar) && <p role="alert" className="w-full text-[13.5px] font-semibold text-[color:var(--ld-warn)]">{a.error || a.confirmar}</p>}
    </li>
  )
}

/* LA ESPERA (tercera tanda, A11; cuarta, C1): no una página en blanco. Dice que está mirando y hace cuánto miró (cuenta
   sola, segundo a segundo: es la señal de que esto está vivo, sin animaciones), las cuatro fotos que van a llegar, cada
   conductor con su enlace y «Mandar otra vez», qué hacer si no llega y cómo volver a «Dales acceso». La lista de
   conductores se pide al entrar y cada 15 s mientras se ve, como en el paso 3. */
function Espera({ comprobado, empresa, onAcceso }) {
  const { t } = useT()
  const [accesos, setAccesos] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    let vivo = true
    const cargar = () => {
      if (document.visibilityState !== 'visible') return
      getAccesosConductores().then((r) => { if (vivo && Array.isArray(r?.data?.conductores)) setAccesos(r.data.conductores) }).catch(() => {})
    }
    cargar()
    const id = setInterval(cargar, CADA_ACCESOS_MS)
    return () => { vivo = false; clearInterval(id) }
  }, [])
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const cambia = (id, acceso) => setAccesos((xs) => (xs || []).map((c) => (c.driver_id === id ? { ...c, acceso } : c)))
  const lista = accesos || []
  const abiertos = lista.filter((c) => c.acceso?.estado === 'abierto').length
  const hace = comprobado ? Math.max(0, Math.round((ahora - comprobado.getTime()) / 1000)) : null
  const textoHace = hace == null ? ''
    : hace < 60 ? t('alta.p4.haceS').replace('{n}', hace) : t('alta.p4.haceMin').replace('{n}', Math.floor(hace / 60))
  return (
    <>
      <p className={`mt-3 ${TEXTO}`}>{t('alta.p4.espera')}</p>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1" data-testid="alta-esperando">
        <p className={`flex items-center gap-2.5 ${GRIS}`}>
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ok)]" aria-hidden="true" />
          {t('alta.p4.mirando')}
        </p>
        {textoHace && <p className="font-mono text-[13.5px] tabular-nums text-[color:var(--ld-muted)]" data-testid="alta-comprobado">{textoHace}</p>}
      </div>

      <div className="mt-6">
        <CuatroFotos testid="alta-fotos-vacias" />
      </div>

      {lista.length > 0 && (
        <section className="mt-10" aria-labelledby="alta-espera-titulo">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="alta-espera-titulo" className="text-[19px] font-bold tracking-[-0.01em]">{t('alta.p2.titulo')}</h2>
            <p className={GRIS}>{t('alta.p3.cuenta').replace('{n}', abiertos).replace('{total}', lista.length)}</p>
          </div>
          <ul className="mt-3 border-t border-[color:var(--ld-border)]" data-testid="alta-espera-accesos">
            {lista.map((c) => <FilaEspera key={c.driver_id} c={c} empresa={empresa} onCambio={(a) => cambia(c.driver_id, a)} />)}
          </ul>
        </section>
      )}

      <h2 className="mt-10 text-[19px] font-bold tracking-[-0.01em]">{t('alta.p4.siNoLlega')}</h2>
      <ol className="mt-3 space-y-2.5 text-[16px] leading-relaxed text-[color:var(--ld-text2)]">
        {['alta.p4.paso1', 'alta.p4.paso2', 'alta.p4.paso3'].map((k, i) => (
          <li key={k} className="flex gap-3">
            <span className="w-5 shrink-0 font-mono text-[14px] leading-[1.7] tabular-nums text-[color:var(--ld-muted)]">{i + 1}</span>
            <span>{t(k)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" className={BTN_SECUNDARIO} onClick={onAcceso} data-testid="alta-volver-acceso">{t('alta.p4.volverAcceso')}</button>
      </div>
    </>
  )
}

function PasoRevision({ estado, primera, comprobado, onRepasar, onAcceso }) {
  const { t, lang } = useT()
  const r = estado.revision
  if (!r) return <Espera comprobado={comprobado} empresa={estado.empresa} onAcceso={onAcceso} />
  const fotos = Array.isArray(r.fotos) ? r.fotos : []
  const conductor = r.conductor?.nombre
  const datos = [
    typeof r.km === 'number' && t('alta.p4.km').replace('{km}', r.km.toLocaleString(LANG_LOCALE[lang] || 'es-ES')),
    typeof r.combustible_pct === 'number' && t('alta.p4.deposito').replace('{pct}', r.combustible_pct),
  ].filter(Boolean)
  // La fecha con el sello de la casa («14 NOV 2026 · 09:31»), como en las fotos (cuarta tanda, C2).
  const sello = selloDeFecha(r.recibida_at, { idioma: lang }) || [diaSello(r.dia, lang, { anio: true }), r.hora].filter(Boolean).join(' · ')
  return (
    <div data-testid="alta-revision">
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Matricula texto={r.furgoneta?.matricula} className="text-[26px]" />
        {r.furgoneta?.modelo && <span className="text-[17px] text-[color:var(--ld-muted)]">{r.furgoneta.modelo}</span>}
      </div>
      <div className="mt-5 border-t border-[color:var(--ld-border)] text-[16px]">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-[color:var(--ld-border)] py-2.5" data-testid="alta-recibida">
          <span className="text-[color:var(--ld-muted)]">{t('alta.p4.recibidaEn')}</span>
          <span className="font-mono text-[15px] tabular-nums">{sello}</span>
        </p>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-[color:var(--ld-border)] py-2.5">
          <span className="font-semibold">{conductor ? t('alta.p4.hechaPor').replace('{nombre}', conductor) : t('alta.p4.sinConductor')}</span>
          {datos.length > 0 && <span className="text-[15px] tabular-nums text-[color:var(--ld-muted)]">{datos.join(' · ')}</span>}
        </p>
      </div>
      {/* Cada foto dice qué lado es (en su esquina) y cuándo llegó (su sello): cuatro sellos iguales no decían cuál era cuál. */}
      {fotos.length > 0 && (
        <div className="mt-6">
          <CuatroFotos fotos={fotos} fecha={r.recibida_at} testid="alta-fotos" />
        </div>
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" className={BTN_PRIMARIO} onClick={onRepasar}>{t(primera ? 'alta.p4.repasarla' : 'alta.p4.repasar')}</button>
        <Link to="/panel" className={BTN_SECUNDARIO}>{t('alta.irPanel')}</Link>
      </div>
    </div>
  )
}

export default function Arranque() {
  const { t } = useT()
  const navigate = useNavigate()
  const dentro = isAuthed()
  useTitulo(t('alta.titulo'))
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [paso, setPaso] = useState(null)
  const [sede, setSede] = useState(() => { try { return localStorage.getItem('panel_center') || '' } catch { return '' } })
  // ¿Se estaba esperando cuando llegó? Entonces es «la primera»; si al abrir ya había varias, es «la última».
  const esperando = useRef(false)
  const [llegoAhora, setLlegoAhora] = useState(false)
  const [comprobado, setComprobado] = useState(null)   // cuándo se miró por última vez (la espera lo enseña)
  /* El panel en noche, el arranque también: sin el salto de un papel blanco en mitad de un panel oscuro. Y si en el
     panel no se ha elegido nada pero se eligió la noche en la web (el pie de /registro), también (cuarta tanda, C5). */
  const [tema] = useState(() => (nocheElegida() ? 'dark' : 'light'))

  const cargar = useCallback(() => getAltaEstado()
    .then((r) => {
      const d = r.data
      if (!d || !Array.isArray(d.pasos)) throw new Error('forma')
      setEstado(d); setError(''); setComprobado(new Date())
      if (d.revision && esperando.current) setLlegoAhora(true)
      esperando.current = !d.revision
      setPaso((p) => p ?? (d.paso_actual || 4))
      return d
    })
    .catch((e) => { setError(textoDeError(t, e)) }), [t])

  useEffect(() => { if (dentro) cargar() }, [dentro, cargar])

  // La sede elegida tiene que ser de la empresa; si no, nada (el servidor elige la única que haya).
  useEffect(() => {
    if (estado && sede && !(estado.centros || []).includes(sede)) setSede('')
  }, [estado, sede])

  /* La espera: se pregunta cada 5 s mientras la pantalla se ve, y en cuanto vuelve a verse; se para al llegar. */
  const enEspera = paso === 4 && estado && !estado.revision
  useEffect(() => {
    if (!enEspera) return undefined
    const mirar = () => { if (document.visibilityState === 'visible') cargar() }
    const id = setInterval(mirar, CADA_REVISION_MS)
    document.addEventListener('visibilitychange', mirar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', mirar) }
  }, [enEspera, cargar])

  if (!dentro) return <Navigate to="/panel/login" replace />

  const hecho = (i) => !!estado?.pasos?.[i]?.hecho
  const ir = (n) => { setPaso(n); window.scrollTo(0, 0) }
  const revisiones = estado?.revisiones || 0
  const primera = llegoAhora || revisiones === 1
  const titulo = paso === 4 && estado?.revision
    ? t(primera ? 'alta.p4.llego' : 'alta.p4.ultima')
    : paso ? t(PASOS[paso - 1].titulo) : ''

  return (
    <div role="main" className="ld-root min-h-screen overflow-x-clip font-sans text-[17px] leading-normal antialiased" data-theme={tema} data-testid="arranque">
      <nav className="border-b border-[color:var(--ld-border)]">
        <div className={`${ANCHO} flex h-[64px] items-center justify-between gap-3`}>
          <span className="inline-flex items-center gap-2.5">
            <LogoMarca size={28} />
            <span className="text-[18px] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </span>
          <Link to="/panel" className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">
            {t('alta.irPanel')}
          </Link>
        </div>
      </nav>

      <div className={`${ANCHO} pb-20 pt-6 sm:pt-10`}>
        {estado && paso && (
          <ol className="grid grid-cols-4 gap-2" aria-label={t('alta.pasos')}>
            {PASOS.map((p, i) => {
              const n = i + 1
              const actual = paso === n
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => ir(n)} aria-current={actual ? 'step' : undefined}
                    aria-label={`${n} · ${t(p.titulo)}${hecho(i) ? ` · ${t('alta.hecho')}` : ''}`}
                    className="group block w-full min-h-[44px] text-left">
                    {/* El paso en curso, en tinta; los hechos, en tinta al 40 %; los que faltan, hueco (cuarta tanda, C2). */}
                    <span data-testid="alta-barra" data-cual={actual ? 'actual' : hecho(i) ? 'hecho' : 'falta'}
                      className={`block h-[5px] rounded-full ${actual ? 'bg-[color:var(--ld-text)]' : hecho(i) ? 'bg-[color:var(--ld-text)] opacity-40' : 'bg-[color:var(--ld-hueco)]'}`} />
                    <span className={`mt-2 flex items-center gap-1.5 text-[13.5px] ${actual ? 'font-bold text-[color:var(--ld-text)]' : 'text-[color:var(--ld-muted)] group-hover:text-[color:var(--ld-text)]'}`}>
                      {hecho(i) ? <Check size={14} aria-label={t('alta.hecho')} className="shrink-0 text-[color:var(--ld-ok)]" /> : <span className="font-mono tabular-nums">{n}</span>}
                      {/* En el móvil, solo el número (el nombre del paso va en el título de debajo). */}
                      <span className="hidden truncate sm:inline">{t(p.titulo)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {!estado && !error && <p className={`mt-10 ${GRIS}`}>{t('alta.cargando')}</p>}
        {!estado && error && (
          <div className="mt-10">
            <p role="alert" className={ERROR}>{error}</p>
            <button type="button" className={`mt-5 ${BTN_PRIMARIO}`} onClick={cargar}>{t('alta.reintentar')}</button>
          </div>
        )}

        {estado && paso && (
          <section className="mt-9 sm:mt-12" aria-labelledby="alta-titulo">
            {/* Sin «Paso 1 de 4» encima: ya lo dice la barra (cuarta tanda, C2). */}
            <h1 id="alta-titulo" className={TITULAR}>{titulo}</h1>
            {paso === 1 && <PasoFurgonetas estado={estado} sede={sede} setSede={setSede} onCambio={cargar} onSeguir={() => ir(2)} />}
            {paso === 2 && <PasoConductores estado={estado} sede={sede} setSede={setSede} onCambio={cargar} onSeguir={() => ir(3)} />}
            {paso === 3 && <PasoAcceso estado={estado} onSeguir={() => ir(4)} onAtras={() => ir(2)} />}
            {paso === 4 && <PasoRevision estado={estado} primera={primera} comprobado={comprobado} onRepasar={() => navigate('/panel/repaso')} onAcceso={() => ir(3)} />}
            {error && estado && <p role="alert" className={`mt-4 ${ERROR}`}>{error}</p>}
          </section>
        )}
      </div>
    </div>
  )
}
