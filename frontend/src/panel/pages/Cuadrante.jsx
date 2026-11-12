import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  Loader2, ChevronLeft, ChevronRight, Sparkles, MessageSquare, Undo2, Download, Upload,
  Lock, StickyNote, X, Check, AlertTriangle, Users, SlidersHorizontal, Gift, Eraser, Plus,
  Brush, CalendarRange, Unlock, Sheet, RefreshCw, Search, Bell, BellOff,
} from 'lucide-react'
import {
  getCuadrante, cuadranteCeldas, cuadranteMaximas, cuadranteConfig, cuadrantePersona,
  cuadrantePersonaNueva, cuadranteFichas, cuadranteNota, cuadranteAjuste, cuadranteAjusteBorrar,
  cuadranteProponer, cuadranteAceptar, cuadranteDescartar, cuadranteDeshacer, cuadranteEstudio,
  cuadranteExportar, cuadranteImportar, getSyncHoja, cuadranteAvisosPrevia, cuadranteAvisosEnviar,
} from '../api'
import { lista } from '../../lib/lista'
import { hoyLocal, diaMesLocal } from '../../lib/fecha'
import { canSee } from '../auth'
import CuadranteChat from '../components/CuadranteChat'
import SincronizarSheets from '../components/SincronizarSheets'
import HojaCuadrante from '../hoja/HojaCuadrante'
import ElegirNave from '../components/ElegirNave'
import {
  TRABAJO, LETRA, DIA, MES, PALETA, ABREV, DOMINGO_TRABAJA, COLUMNA_DOMINGO, CABECERA_DIA, NOMBRE_EMPRESA, NOMBRE_FINDE, NOMBRE_SE_VA, claseCodigo, claseNombre, wd,
  sumaDias, rangoDias, fmt, lunesDe, signo, claseDif, resumenDias, septimosDe,
} from '../cuadranteComun'

/* ── EL CUADRANTE CON MOTOR ────────────────────────────────────────────────
   Dani, 29-09-2026: una sección donde «simplemente corregir los días libres o
   cosas tontas», y que el cuadrante se rehaga solo con sus reglas: máxima +2
   cada día, 5 días y 2 libres, nunca 7 seguidos, y lo que ya es de alguien
   (vacaciones, bajas, días aprobados) no se toca.

   Se parece a SU hoja a propósito: el 1 neutro, el N/T en crema, el domingo en
   naranja, el día extra en ROSA, y debajo las tres filas que él mira —rutas
   (la cuenta de 1), máxima y diferencia en verde, amarillo o rojo—.

   Lo que se toca a mano se guarda en el acto y queda con CANDADO: el motor no
   lo mueve al rehacer. El motor nunca escribe solo: deja una PROPUESTA (borde
   morado en lo que cambia) que se acepta o se descarta. Y todo se deshace. */

const TIPOS = [
  ['normal', 'Normal (5 + 2)', 'Trabaja 5 y libra 2 donde haga falta'],
  ['empresa', 'Horario fijo', 'De lunes a viernes, o su patrón'],
  ['finde', 'Solo fin de semana', 'Sábado y domingo'],
  ['inactivo', 'No entra en rutas', 'Oficina, baja larga…'],
]

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* BUSCAR A ALGUIEN (11-11-2026, cuadrante-9). Con 60-70 filas, en el móvil había que bajar con el dedo hasta dar con
   el nombre cuando un conductor llama («¿qué tengo el jueves?»). Se busca por nombre o por apodo, sin acentos ni
   mayúsculas, y cada palabra tiene que estar («jose cas» encuentra a JOSÉ MANUEL PÉREZ CASTRO). Solo se esconden filas:
   las de totales (rutas, máxima, diferencia) siguen contando a todos. */
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function casaBusqueda(p, busca) {
  const palabras = sinAcentos(busca).split(/\s+/).filter(Boolean)
  if (!palabras.length) return true
  const texto = sinAcentos([p.nombre, ...lista(p.apodos)].join(' '))
  return palabras.every((w) => texto.includes(w))
}

/* EL NOMBRE CORTO DEL MÓVIL (11-11-2026, cuadrante-10). La columna de nombres se comía la pantalla: en un móvil se
   veían dos días y medio. En pantallas estrechas va el nombre y la inicial del segundo («ANTONIO G.»); si dos
   coinciden, el segundo entero (lo que no quepa se corta). El completo, al tocar el nombre (abre su ficha).
   Si aun así siguen iguales (11-11-2026): «JOSÉ GARCÍA PÉREZ» y «JOSÉ GARCÍA LÓPEZ» salían los dos «JOSÉ GARCÍA», y en
   el móvil no se sabía cuál era cuál. Ahora se van añadiendo iniciales («JOSÉ G. P.» / «JOSÉ G. L.») hasta que se
   distinguen (y, si no, el nombre entero). Las partículas (DE, DEL, LA, LAS, LOS, Y) no cuentan para la inicial:
   «MARÍA DE LOS ÁNGELES RUIZ» es «MARÍA Á.», no «MARÍA D.». */
const NEXOS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
function nombresCortos(personas) {
  // Las formas de un nombre, de la más corta a la entera.
  const formas = (n) => {
    const w = String(n || '').trim().split(/\s+/).filter(Boolean)
    if (w.length < 2) return [w[0] || '']
    const sig = w.slice(1).filter((x) => !NEXOS.has(sinAcentos(x)))
    const ini = (k) => sig.slice(0, k).map((x) => `${x[0]}.`).join(' ')
    const f = sig.length ? [`${w[0]} ${ini(1)}`, `${w[0]} ${sig[0]}`] : []
    for (let k = 2; k <= sig.length; k++) f.push(`${w[0]} ${ini(k)}`)
    f.push(w.join(' '))
    return [...new Set(f)]
  }
  const fs = Object.fromEntries(personas.map((p) => [p.id, formas(p.nombre)]))
  const nivel = Object.fromEntries(personas.map((p) => [p.id, 0]))
  // Mientras dos enseñen lo mismo, los dos pasan a su forma siguiente (acaba: cada vuelta alarga alguno).
  for (let movido = true; movido;) {
    movido = false
    const quien = {}
    for (const p of personas) (quien[fs[p.id][nivel[p.id]]] ||= []).push(p.id)
    for (const ids of Object.values(quien)) {
      if (ids.length < 2) continue
      for (const id of ids) if (nivel[id] < fs[id].length - 1) { nivel[id] += 1; movido = true }
    }
  }
  return Object.fromEntries(personas.map((p) => [p.id, fs[p.id][nivel[p.id]]]))
}

/* LAS PETICIONES SIN CONTESTAR (11-11-2026, cuadrante-1). El servidor las manda en `pendientes` ({"did|fecha": {id,
   tipo, grupo}}); uno viejo, o el simulado, no las manda y todo sale como antes. Solo se ENSEÑAN: el motor no las mira
   (eso se le pregunta a Dani). Los días seguidos de una persona van juntos: «16-17/11». */
const enlaceDiasLibres = (center) => `/panel/turnos?centro=${encodeURIComponent(center)}`
function tramosDeFechas(fechas) {
  const out = []
  let ini = null
  let fin = null
  for (const f of [...fechas].sort()) {
    if (fin && sumaDias(fin, 1) === f) { fin = f; continue }
    if (ini) out.push([ini, fin])
    ini = f; fin = f
  }
  if (ini) out.push([ini, fin])
  return out.map(([a, b]) => (a === b ? fmt(a) : `${a.slice(5, 7) === b.slice(5, 7) ? a.slice(8, 10) : fmt(a)}-${fmt(b)}`))
}
/* «Ana 15/11, Luis 16-17/11» de una lista de claves «did|fecha», con los nombres del cuadrante. */
function quienesYCuando(claves, personas) {
  const nombre = Object.fromEntries(lista(personas).map((p) => [p.id, p.nombre]))
  const por = {}
  for (const k of claves) {
    const [did, f] = k.split('|')
    if (!por[did]) por[did] = []
    por[did].push(f)
  }
  return Object.entries(por)
    .sort(([a], [b]) => String(nombre[a] || a).localeCompare(String(nombre[b] || b)))
    .map(([did, fs]) => `${nombre[did] || did} ${tramosDeFechas(fs).join(' · ')}`)
}

function Modal({ titulo, onCerrar, children, ancho = 'max-w-2xl' }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])
  /* Opaca y por encima de la burbuja del asistente (z-95). Con `.card` (fondo
     al 70 %) se veía la página de detrás y el texto quedaba apagado (30-09-2026,
     captura de Dani importando la hoja). Se queda dentro de <main> para tener
     los colores del tema Mixto. */
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        className={`w-full ${ancho} rounded-xl border border-dark-700 bg-dark-900 p-4 shadow-2xl shadow-black/40 sm:p-5`}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-bold text-dark-50">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="ml-auto text-dark-500 hover:text-dark-200"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── AVISAR A LOS CONDUCTORES (11-11-2026, cuadrante-8) ──────────────────────
   Al cambiar el cuadrante al conductor no le llegaba nada. Un botón, nunca solo: primero se ve a quién y qué (de hoy a
   14 días, solo lo que de verdad cambia para él), se desmarca a quien no se quiera avisar, y se manda UN aviso por
   persona (a la bandeja de la app y como notificación). El servidor lo vuelve a calcular al mandar: no se fía de esta
   lista. Van los marcados y los desmarcados por separado (11-11-2026, revisión): a quien aparezca después de abrir la
   ventana no se le toca nada y sale la próxima vez.
   12-11-2026 (X2, X6): cada día dice lo de ahora, lo de antes (lo que el conductor sabe) y desde cuándo está sin avisar;
   y van las marcas de TODO lo que se enseñó, también de los marcados, para que a nadie se le diga lo que la oficina no
   vio (lo que cambió con la ventana abierta sale la próxima vez). */
/* A quién no se avisó y por qué (12-11-2026, X7), con nombres: «A Juan no se le ha avisado: su día cambió mientras
   tenías la ventana abierta. Vuelve a abrirla.». El servidor manda `no_avisados` [{nombre, motivo, parcial, nave?}]; uno de
   antes no lo manda y la pantalla dice lo de siempre. */
const conY = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '')
function textoNoAvisados(noAvisados) {
  const grupos = new Map()
  for (const x of lista(noAvisados)) {
    // `otra_nave` (12-11-2026, revisión 5) lleva la nave que ahora lo enseña y lo avisa: van juntos los de la misma.
    const nave = x?.motivo === 'otra_nave' ? String(x?.nave || '') : ''
    const k = `${x?.motivo || ''}|${x?.parcial ? 1 : 0}|${nave}`
    if (!grupos.has(k)) grupos.set(k, { motivo: x?.motivo, parcial: !!x?.parcial, nave, nombres: [] })
    grupos.get(k).nombres.push(x?.nombre || x?.driver_id || '?')
  }
  return [...grupos.values()].map(({ motivo, parcial, nave, nombres }) => {
    const varios = nombres.length > 1
    const por = motivo === 'ya_avisado' ? `otra persona acababa de avisar${varios ? 'les' : 'le'}`
      : motivo === 'no_guardado' ? 'no se ha podido guardar el aviso. Inténtalo otra vez'
        : motivo === 'otra_nave'
          ? `${varios ? 'sus días han pasado' : 'su día ha pasado'} a otra nave${nave ? ` (${nave})` : ''} y se ${varios ? 'avisan' : 'avisa'} desde allí`
          : `${varios ? 'sus días cambiaron' : 'su día cambió'} mientras tenías la ventana abierta. Vuelve a abrirla`
    return `A ${conY(nombres)} no se ${varios ? 'les' : 'le'} ha avisado${parcial ? ' de algún día' : ''}: ${por}.`
  }).join(' ')
}

function AvisarConductores({ center, onCerrar, onHecho }) {
  const [previa, setPrevia] = useState(null)
  const [err, setErr] = useState('')
  const [marcados, setMarcados] = useState(() => new Set())
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    let vivo = true
    cuadranteAvisosPrevia(center)
      .then(({ data }) => {
        if (!vivo) return
        const personas = lista(data?.personas).filter((p) => p?.driver_id)
        setPrevia({ hasta: data?.hasta || '', personas })
        setMarcados(new Set(personas.map((p) => p.driver_id)))
      })
      .catch((e) => {
        if (!vivo) return
        setErr([404, 405].includes(e?.response?.status) ? 'El servidor todavía no tiene esta función: prueba un poco más tarde.'
          : e?.response?.data?.detail || 'No se ha podido preparar la lista.')
      })
    return () => { vivo = false }
  }, [center])
  const cambiar = (did) => setMarcados((s) => { const n = new Set(s); if (n.has(did)) n.delete(did); else n.add(did); return n })
  const enviar = async () => {
    setEnviando(true); setErr('')
    try {
      const desmarcados = lista(previa?.personas).filter((p) => !marcados.has(p.driver_id))
      // Las marcas de los días que se enseñaron (11-11-2026, segunda ronda; de todos desde el 12-11-2026, X2): el
      // servidor solo descarta, y solo dice, lo que la oficina vio; lo que cambió después vuelve a salir. Sin marcas (un
      // servidor anterior), no van.
      const dias = lista(previa?.personas).flatMap((p) => lista(p.dias))
      const vistas = dias.length > 0 && dias.every((d) => d?.marca) ? dias.map((d) => d.marca) : undefined
      const { data } = await cuadranteAvisosEnviar(center, [...marcados], desmarcados.map((p) => p.driver_id), vistas)
      onHecho(data, { pedidos: marcados.size })
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se han podido mandar los avisos.')
      setEnviando(false)
    }
  }
  const personas = previa?.personas || []
  return (
    <Modal titulo="Avisar a los conductores" onCerrar={onCerrar}>
      <div className="space-y-3 text-[13px] text-dark-300" data-testid="avisar-previa">
        {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">{err}</p>}
        {!previa && !err && (
          <p className="flex items-center gap-2 text-dark-500"><Loader2 size={14} className="animate-spin" /> Mirando qué ha cambiado…</p>
        )}
        {previa && personas.length === 0 && (
          <p className="text-dark-300">Nadie tiene cambios sin avisar de hoy a 14 días.</p>
        )}
        {personas.length > 0 && (
          <>
            <p>Tienen cambios sin avisar de hoy al {fmt(previa.hasta)}. A cada uno le llega un aviso con sus días:</p>
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {personas.map((p) => (
                <li key={p.driver_id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-dark-700 px-3 py-2 hover:bg-dark-800/60">
                    <input type="checkbox" className="mt-0.5" checked={marcados.has(p.driver_id)} onChange={() => cambiar(p.driver_id)}
                      aria-label={`Avisar a ${p.nombre}`} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-dark-100">{p.nombre}</span>
                      {/* Un día por línea (12-11-2026, X6): «sáb 14/11: libras (antes: trabajas)» y, debajo, desde
                          cuándo está sin avisar. Se parte en dos líneas si no cabe: en el móvil no se desliza de lado. */}
                      {lista(p.dias).map((d) => (
                        <span key={d.fecha} className="mt-0.5 block break-words text-[12px] text-dark-400" data-testid="avisar-dia">
                          <span className="text-dark-200">{`${DIA[wd(d.fecha)].slice(0, 3)} ${fmt(d.fecha)}: ${d.ahora}`}</span>
                          {d.antes && <span>{` (antes: ${d.antes})`}</span>}
                          {diaMesLocal(d.desde) && (
                            <span className="block text-[11px] text-dark-500">{`cambiado el ${diaMesLocal(d.desde)}`}</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-dark-500" data-testid="avisar-como-llega">
              Le llega a la bandeja de avisos de la app de Android y, si tiene las notificaciones activadas, también como
              notificación. En el portal web no hay bandeja: allí solo lo ve quien activó las notificaciones.
            </p>
            <p className="text-[11.5px] text-dark-500" data-testid="avisar-desmarcados">
              A quien desmarques no se le avisa de estos cambios; volverá a salir aquí si su cuadrante cambia otra vez.
            </p>
            {/* Todos desmarcados (11-11-2026, segunda ronda): el botón sirve para descartarlos a todos de una vez. */}
            {marcados.size === 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300" data-testid="avisar-nadie">
                No hay nadie marcado: con «No avisar a nadie» no se manda nada y salen todos de esta lista hasta que su
                cuadrante cambie otra vez.
              </p>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {personas.length > 0 && (
            <button onClick={enviar} disabled={enviando}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
              {enviando ? <Loader2 size={15} className="animate-spin" /> : marcados.size === 0 ? <BellOff size={15} /> : <Bell size={15} />}
              {marcados.size === 0 ? 'No avisar a nadie' : marcados.size === 1 ? 'Avisar a 1' : `Avisar a ${marcados.size}`}
            </button>
          )}
          <button onClick={onCerrar} className="rounded-lg border border-dark-700 px-3 py-2 text-sm text-dark-300 hover:bg-dark-800">
            {personas.length > 0 ? 'Cancelar' : 'Cerrar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── REHACER EL CUADRANTE: lo que el motor necesita, preguntado antes ───────
   Las fechas, las máximas de cada día (sin máxima no se calcula ese día) y
   quién sigue de baja: una baja que acaba el día 7 en la hoja no dice si la
   persona vuelve el 8, y el motor la pondría a trabajar. */
function Asistente({ center, datos, onCerrar, onHecho }) {
  const manana = sumaDias(datos?.hoy || hoyLocal(), 1)
  const ultimaMax = Object.keys(datos?.maximas || {}).filter((f) => f >= manana).sort().pop()
  const [desde, setDesde] = useState(manana)
  const [hasta, setHasta] = useState(ultimaMax && ultimaMax > manana ? ultimaMax : sumaDias(lunesDe(manana), 13))
  const [colchon, setColchon] = useState(datos?.config?.colchon ?? 2)
  const [extra, setExtra] = useState(datos?.config?.permitir_extra ?? true)
  const [info, setInfo] = useState(null)
  const [maximas, setMaximas] = useState({})
  const [bajas, setBajas] = useState({})       // did -> 'sigue' | 'vuelve:<fecha>' | 'nada'
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')

  const dias = useMemo(() => rangoDias(desde, hasta, 63), [desde, hasta])

  useEffect(() => {
    let vivo = true
    if (!desde || !hasta || hasta < desde) return () => { vivo = false }
    const id = setTimeout(() => {
      getCuadrante(center, sumaDias(desde, -7), hasta)
        .then((r) => {
          if (!vivo) return
          setInfo(r.data)
          setMaximas((m) => {
            const n = { ...m }
            for (const [f, v] of Object.entries(r.data?.maximas || {})) if (n[f] == null) n[f] = String(v)
            return n
          })
        })
        .catch((e) => { if (vivo) setErr(e?.response?.data?.detail || 'No se han podido leer las máximas.') })
    }, 300)
    return () => { vivo = false; clearTimeout(id) }
  }, [center, desde, hasta])

  const faltan = dias.filter((f) => maximas[f] == null || maximas[f] === '')

  /* De baja el día de antes y sin nada puesto después: hay que preguntar. */
  const enBaja = useMemo(() => {
    if (!info) return []
    const out = []
    for (const p of lista(info.personas)) {
      let ultimo = null
      for (let f = sumaDias(desde, -1); f >= sumaDias(desde, -7); f = sumaDias(f, -1)) {
        const c = info.celdas?.[`${p.id}|${f}`]
        if (c?.cod) { ultimo = c.cod; break }
      }
      if (ultimo !== 'BAJA') continue
      const vacios = dias.filter((f) => !info.celdas?.[`${p.id}|${f}`]?.cod).length
      if (vacios > 0) out.push({ ...p, vacios })
    }
    return out
  }, [info, desde, dias])

  const seVan = lista(info?.personas).filter((p) => p.inactivo_desde && p.inactivo_desde >= desde && p.inactivo_desde <= hasta)
  const entran = lista(info?.personas).filter((p) => p.alta_desde && p.alta_desde >= desde && p.alta_desde <= hasta)
  // Las peticiones sin contestar de estas fechas (11-11-2026, cuadrante-1): el motor no las mira, así que se dicen.
  const sinContestar = Object.keys(info?.pendientes && typeof info.pendientes === 'object' ? info.pendientes : {})
    .filter((k) => { const f = k.split('|')[1]; return f >= desde && f <= hasta })

  const rellenarComoAntes = () => setMaximas((m) => {
    const n = { ...m }
    for (const f of dias) {
      if (n[f] != null && n[f] !== '') continue
      const antes = n[sumaDias(f, -7)] ?? n[sumaDias(f, -14)]
      if (antes != null && antes !== '') n[f] = antes
    }
    return n
  })

  const calcular = async () => {
    setErr('')
    if (faltan.length) { setErr(`Faltan las máximas de ${faltan.map(fmt).join(', ')}.`); return }
    setOcupado(true)
    try {
      const cambiadas = {}
      for (const f of dias) {
        if (String(info?.maximas?.[f] ?? '') !== String(maximas[f] ?? '')) cambiadas[f] = maximas[f]
      }
      if (Object.keys(cambiadas).length) await cuadranteMaximas(center, cambiadas)
      const celdas = []
      for (const p of enBaja) {
        const dec = bajas[p.id] || 'sigue'
        if (dec === 'nada') continue
        const hastaBaja = dec === 'sigue' ? hasta : sumaDias(dec.split(':')[1], -1)
        for (const f of dias) {
          if (f > hastaBaja) break
          if (!info?.celdas?.[`${p.id}|${f}`]?.cod) celdas.push({ driver_id: p.id, fecha: f, cod: 'BAJA' })
        }
      }
      if (celdas.length) await cuadranteCeldas(center, celdas)
      const r = await cuadranteProponer({ center, desde, hasta, colchon: Number(colchon), permitir_extra: extra })
      onHecho(r.data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido calcular.')
    } finally { setOcupado(false) }
  }

  return (
    <Modal titulo="Rehacer el cuadrante" onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="space-y-5 text-[13px] text-dark-300">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">1 · Qué días</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-dark-400">Desde
              <input type="date" value={desde} min={manana} onChange={(e) => setDesde(e.target.value)}
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-dark-400">Hasta
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)}
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-dark-400">Rutas por encima de la máxima
              <input type="number" min={0} max={10} value={colchon} onChange={(e) => setColchon(e.target.value)}
                className="w-24 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-dark-300">
              <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
              Poner días extra (6º día) si no se llega
            </label>
          </div>
          <p className="mt-1.5 text-[11.5px] text-dark-500">
            Hoy no se toca: el día ya está en marcha. {dias.length} días.
          </p>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">2 · Máximas de cada día</h3>
            {faltan.length > 0 && <span className="text-[11.5px] text-amber-300">Faltan {faltan.length}</span>}
            <button onClick={rellenarComoAntes}
              className="ml-auto rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800">
              Rellenar las vacías como la semana anterior
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {dias.map((f) => (
              <label key={f} className={`flex flex-col items-center rounded-lg border px-1 py-1 text-[11px] ${
                wd(f) === 6 ? 'border-orange-500/40' : 'border-dark-700'}`}>
                <span className={wd(f) === 6 ? 'text-orange-300' : 'text-dark-400'}>{LETRA[wd(f)]} {fmt(f)}</span>
                <input type="number" min={0} max={999} value={maximas[f] ?? ''} aria-label={`Máxima del ${fmt(f)}`}
                  onChange={(e) => setMaximas((m) => ({ ...m, [f]: e.target.value }))}
                  className={`mt-0.5 w-14 rounded border bg-dark-900 px-1 py-0.5 text-center text-sm text-dark-100 ${
                    maximas[f] == null || maximas[f] === '' ? 'border-amber-500/60' : 'border-dark-700'}`} />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">3 · Antes de calcular</h3>
          {!info ? (
            <p className="flex items-center gap-2 text-dark-500"><Loader2 size={14} className="animate-spin" /> Mirando la plantilla…</p>
          ) : (
            <div className="space-y-2">
              {enBaja.length === 0 && seVan.length === 0 && entran.length === 0 && (
                <p className="text-dark-400">Nadie de baja sin fecha de vuelta, nadie que entre ni que se vaya en estas fechas.</p>
              )}
              {enBaja.map((p) => {
                const dec = bajas[p.id] || 'sigue'
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                    <span className="font-semibold text-dark-100">{p.nombre}</span>
                    <span className="text-xs text-dark-400">está de baja y no tiene nada puesto en {p.vacios} días.</span>
                    <select value={dec.startsWith('vuelve') ? 'vuelve' : dec} aria-label={`Qué pasa con ${p.nombre}`}
                      onChange={(e) => setBajas((b) => ({ ...b, [p.id]: e.target.value === 'vuelve' ? `vuelve:${sumaDias(desde, 1)}` : e.target.value }))}
                      className="ml-auto rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100">
                      <option value="sigue">Sigue de baja todo el periodo</option>
                      <option value="vuelve">Vuelve un día</option>
                      <option value="nada">Ya ha vuelto (que el motor decida)</option>
                    </select>
                    {dec.startsWith('vuelve') && (
                      <input type="date" value={dec.split(':')[1]} min={desde} max={hasta} aria-label="Día que vuelve"
                        onChange={(e) => setBajas((b) => ({ ...b, [p.id]: `vuelve:${e.target.value}` }))}
                        className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
                    )}
                  </div>
                )
              })}
              {seVan.length > 0 && (
                <p className="text-xs text-dark-400">Se van: {seVan.map((p) => `${p.nombre} (${fmt(p.inactivo_desde)})`).join(' · ')}</p>
              )}
              {entran.length > 0 && (
                <p className="text-xs text-dark-400">Entran: {entran.map((p) => `${p.nombre} (${fmt(p.alta_desde)})`).join(' · ')}</p>
              )}
              {sinContestar.length > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200" data-testid="asistente-pendientes">
                  Peticiones sin contestar en estas fechas: {sinContestar.length} {sinContestar.length === 1 ? 'día' : 'días'} de
                  {' '}{new Set(sinContestar.map((k) => k.split('|')[0])).size}{' '}
                  {new Set(sinContestar.map((k) => k.split('|')[0])).size === 1 ? 'persona' : 'personas'}
                  {' '}({quienesYCuando(sinContestar, info?.personas).join(', ')}). El motor no las tiene en cuenta.{' '}
                  <Link to={enlaceDiasLibres(center)} className="font-semibold text-amber-100 underline">Ver en Días libres</Link>
                </p>
              )}
              <p className="text-[11.5px] text-dark-500">
                ¿Alguien más de baja, que se va o que entra? Díselo al asistente o cámbialo en «Personas y notas».
              </p>
            </div>
          )}
        </section>

        {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={calcular} disabled={ocupado || !info || hasta < desde}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {ocupado ? 'Calculando…' : 'Calcular la propuesta'}
          </button>
          <span className="text-[11.5px] text-dark-500">No cambia nada todavía: te enseña la propuesta y tú la aceptas.</span>
        </div>
      </div>
    </Modal>
  )
}

/* ── UNA PERSONA: cómo trabaja y su NOTA ────────────────────────────────────
   La nota se escribe normal («solo trabaja 4 días», «días alternos», «nunca
   los martes») y debajo se ve, mientras se escribe, lo que va a aplicar el
   motor y lo que NO sabe aplicar. Nada se aplica en silencio. */
function EditorPersona({ center, persona, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState(persona.tipo || 'normal')
  const [patron, setPatron] = useState(persona.patron || [0, 1, 2, 3, 4])
  const [nota, setNota] = useState(persona.nota || '')
  const [apodos, setApodos] = useState((persona.apodos || []).join(', '))
  const [alta, setAlta] = useState(persona.alta_desde || '')
  const [baja, setBaja] = useState(persona.inactivo_desde || '')
  const [lectura, setLectura] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    if (!nota.trim()) { setLectura(null); return () => { vivo = false } }
    const id = setTimeout(() => {
      cuadranteNota(nota).then((r) => { if (vivo) setLectura(r.data) }).catch(() => {})
    }, 350)
    return () => { vivo = false; clearTimeout(id) }
  }, [nota])

  const guardar = async (extra = {}) => {
    setOcupado(true); setErr('')
    try {
      await cuadrantePersona(persona.id, center, {
        tipo, patron: tipo === 'empresa' ? patron : null, nota, apodos,
        alta_desde: alta || null, inactivo_desde: baja || null, ...extra,
      })
      onGuardado()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido guardar.')
    } finally { setOcupado(false) }
  }

  return (
    <Modal titulo={persona.nombre} onCerrar={onCerrar}>
      <div className="space-y-4 text-[13px] text-dark-300">
        {!persona.ficha_activa && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            Su ficha está de baja en Conductores aunque sale en el cuadrante.
          </p>
        )}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dark-500">Cómo trabaja</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {TIPOS.map(([k, t, d]) => (
              <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
                tipo === k ? 'border-brand-500/60 bg-brand-500/10' : 'border-dark-700 hover:bg-dark-800'}`}>
                <input type="radio" name="tipo" checked={tipo === k} onChange={() => setTipo(k)} className="mt-0.5" />
                <span><b className="text-dark-100">{t}</b><span className="block text-[11.5px] text-dark-500">{d}</span></span>
              </label>
            ))}
          </div>
          {tipo === 'empresa' && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-dark-400">Días que trabaja:</span>
              {LETRA.map((l, i) => (
                <button key={i} type="button" aria-pressed={patron.includes(i)} title={DIA[i]}
                  onClick={() => setPatron((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()))}
                  className={`h-7 w-7 rounded-md text-xs font-bold ${patron.includes(i)
                    ? 'bg-brand-500/25 text-dark-50 ring-1 ring-brand-400/60' : 'bg-dark-800 text-dark-400'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-dark-500">Nota</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={500}
            placeholder="Por ejemplo: solo trabaja 4 días · días alternos · nunca los martes · sin días extra"
            className="w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[13px] text-dark-100 placeholder:text-dark-500" />
        </label>
        {lectura && (
          <div className="space-y-1 rounded-lg border border-dark-700 px-3 py-2 text-xs">
            {lista(lectura.entendido).length > 0 ? (
              <p className="text-emerald-300">El motor aplicará: {lista(lectura.entendido).join(' · ')}</p>
            ) : (
              <p className="text-dark-400">De esta nota el motor no saca ninguna regla.</p>
            )}
            {lectura.sin_entender && (
              <p className="text-amber-300">No sé aplicar: «{lectura.sin_entender}». Queda como nota para vosotros.</p>
            )}
          </div>
        )}
        {lista(persona.reglas_fijas).length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-dark-400">
            Regla del chat: nunca {persona.reglas_fijas.map((d) => DIA[d]).join(', ')}
            <button onClick={() => guardar({ reglas_fijas: { dias_no: [] } })}
              className="rounded border border-dark-700 px-1.5 py-0.5 text-dark-300 hover:bg-dark-800">Quitar</button>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-dark-400">Apodos (para el chat)
            <input value={apodos} onChange={(e) => setApodos(e.target.value)} placeholder="juanmi, biri"
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100 placeholder:text-dark-500" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-dark-400">Empieza el
            <input type="date" value={alta} onChange={(e) => setAlta(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-dark-400">Deja el cuadrante el
            <input type="date" value={baja} onChange={(e) => setBaja(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
          </label>
        </div>
        {err && <p className="text-red-300">{err}</p>}
        <div className="flex gap-2">
          <button onClick={() => guardar()} disabled={ocupado}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar
          </button>
          <span className="self-center text-[11.5px] text-dark-500">Se aplica la próxima vez que se rehaga el cuadrante.</span>
        </div>
      </div>
    </Modal>
  )
}

function NuevaPersona({ center, dentro, onCerrar, onGuardado }) {
  const [fichas, setFichas] = useState(null)
  const [elegida, setElegida] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('normal')
  const [alta, setAlta] = useState('')
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let vivo = true
    cuadranteFichas(center).then((r) => { if (vivo) setFichas(lista(r.data?.fichas)) }).catch(() => { if (vivo) setFichas([]) })
    return () => { vivo = false }
  }, [center])
  const fuera = lista(fichas).filter((f) => !dentro.has(f.id))
  const guardar = async () => {
    setOcupado(true); setErr('')
    try {
      await cuadrantePersonaNueva({ center, driver_id: elegida || undefined, nombre: elegida ? undefined : nombre,
        tipo, alta_desde: alta || undefined })
      onGuardado()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido añadir.')
    } finally { setOcupado(false) }
  }
  return (
    <Modal titulo="Añadir al cuadrante" onCerrar={onCerrar}>
      <div className="space-y-3 text-[13px] text-dark-300">
        <label className="flex flex-col gap-1 text-xs text-dark-400">Una ficha del centro que no está en el cuadrante
          <select value={elegida} onChange={(e) => setElegida(e.target.value)}
            className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100">
            <option value="">— Ninguna: es alguien nuevo —</option>
            {fuera.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        {!elegida && (
          <label className="flex flex-col gap-1 text-xs text-dark-400">Nombre y apellidos (se le crea la ficha)
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-dark-400">Cómo trabaja
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100">
              {TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-dark-400">Empieza el
            <input type="date" value={alta} onChange={(e) => setAlta(e.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-dark-100" />
          </label>
        </div>
        {err && <p className="text-red-300">{err}</p>}
        <button onClick={guardar} disabled={ocupado || (!elegida && nombre.trim().length < 3)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Añadir
        </button>
      </div>
    </Modal>
  )
}

/* ── IMPORTAR LA HOJA DEL MES ───────────────────────────────────────────── */
const NUEVA = '__nueva__'
const FUERA = '__fuera__'

function Importar({ center, centers, setCenter, onCerrar, onHecho }) {
  const [file, setFile] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [elec, setElec] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const [forzar, setForzar] = useState(false)
  const leer = async (f, centro = center) => {
    setFile(f); setPrevia(null); setErr(''); setOcupado(true); setForzar(false)
    try {
      const r = await cuadranteImportar(f, centro, false, false)
      setPrevia(r.data)
      /* Lo propuesto, ya elegido: la ficha sugerida; a quien no se parece a
         nadie, ficha nueva; y si hay varias igual de buenas, sin elegir (se
         tiene que decidir una persona). */
      const e = {}
      for (const x of lista(r.data?.revisar)) {
        e[x.nombre] = x.sugerida || (lista(x.opciones).length ? '' : NUEVA)
      }
      setElec(e)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido leer el Excel.')
    } finally { setOcupado(false) }
  }
  /* Al cambiar de centro arriba (o con el botón del aviso), la misma hoja se
     vuelve a leer contra el centro nuevo. */
  const centroLeido = useRef(center)
  useEffect(() => {
    if (centroLeido.current === center) return
    centroLeido.current = center
    if (file) leer(file, center)
  }, [center]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinElegir = Object.values(elec).filter((v) => !v).length
  const nuevas = Object.values(elec).filter((v) => v === NUEVA).length
  /* La hoja es de otro centro (30-09-2026: con DGA1 elegido, la de OGA5 salió
     con 67 «no tiene ficha»). Se dice, se ofrece cambiar y no se importa aquí
     salvo que se marque a propósito. */
  const oc = previa?.otro_centro
  const destino = oc ? lista(centers).find((c) => c.toUpperCase() === String(oc.centro).toUpperCase())
    || lista(centers).find((c) => String(oc.centro).toUpperCase().includes(c.toUpperCase())) : null
  const bloqueada = Boolean(oc) && !forzar
  const confirmar = async () => {
    setOcupado(true); setErr('')
    try {
      const r = await cuadranteImportar(file, center, true, false, elec, forzar)
      onHecho(r.data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido importar.')
    } finally { setOcupado(false) }
  }
  const revisar = bloqueada ? [] : lista(previa?.revisar)
  const nombresRevisar = new Set(revisar.map((x) => x.nombre))
  const otrosAmbiguos = lista(previa?.ambiguos).filter((a) => !nombresRevisar.has(a))
  const TIPO_NOMBRE = { normal: 'normales', empresa: 'horario fijo', finde: 'solo finde', inactivo: 'no entran en rutas' }
  return (
    <Modal titulo="Importar la hoja del mes" onCerrar={onCerrar}>
      <div className="space-y-3 text-[13px] text-dark-300">
        <p className="text-dark-400">
          La hoja MENSUAL tal cual: fechas de verdad arriba, un nombre por fila y las máximas abajo. El color del nombre
          dice cómo trabaja cada uno (azul horario fijo, melocotón solo finde, amarillo se va el día 1) y el rosa de una
          celda es el día extra.
        </p>
        <input type="file" accept=".xlsx,.xlsm" aria-label="Fichero Excel del cuadrante"
          onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
          className="block w-full text-xs text-dark-300" />
        {ocupado && !previa && <p className="flex items-center gap-2 text-dark-400"><Loader2 size={14} className="animate-spin" /> Leyendo…</p>}
        {previa && (
          <div className="space-y-2 rounded-lg border border-dark-700 p-3">
            <p className="text-dark-100">
              Del <b>{fmt(previa.desde)}</b> al <b>{fmt(previa.hasta)}</b> · {previa.personas} personas ·
              {' '}{previa.extras} días extra · máximas de {previa.maximas} días
            </p>
            <p className="text-xs text-dark-400">
              {Object.entries(previa.tipos || {}).map(([k, n]) => `${n} ${TIPO_NOMBRE[k] || k}`).join(' · ')}
            </p>
            {oc && (
              <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-300">
                <p className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-px flex-none text-amber-300" />
                  <span>
                    <b>Esta hoja es de {oc.centro}</b>: {oc.casan_alli} personas tienen allí su ficha
                    {oc.casan_aqui ? ` y solo ${oc.casan_aqui} en ${center}` : ` y ninguna en ${center}`}.
                    {' '}Importada aquí saldrían todas como gente nueva, con fichas repetidas.
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {destino && setCenter && (
                    <button onClick={() => setCenter(destino)} disabled={ocupado}
                      className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">
                      Cambiar a {destino}
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-dark-300">
                    <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
                    Es de {center} de verdad: importar aquí igualmente
                  </label>
                </div>
              </div>
            )}
            {!bloqueada && <p className="text-xs text-emerald-300">{previa.emparejadas} casan solos con su ficha.</p>}
            {revisar.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-300">
                  {revisar.length} no casan solos. Te propongo con quién (queda guardado para los meses siguientes):
                </p>
                {revisar.map((x) => (
                  <label key={x.nombre} className="flex flex-wrap items-center gap-2 rounded-lg border border-dark-800 px-2.5 py-1.5 text-xs">
                    <span className="min-w-[12rem] font-semibold text-dark-100">{x.nombre}</span>
                    <span className="text-dark-500">{x.motivo === 'duplicada' ? 'dos fichas con su nombre' : lista(x.opciones).length ? 'se parece a' : 'no tiene ficha'}</span>
                    <select value={elec[x.nombre] ?? ''} aria-label={`Ficha de ${x.nombre}`}
                      onChange={(e) => setElec((m) => ({ ...m, [x.nombre]: e.target.value }))}
                      className={`ml-auto max-w-[18rem] rounded-lg border bg-dark-900 px-2 py-1 text-xs text-dark-100 ${
                        elec[x.nombre] ? 'border-dark-700' : 'border-amber-500/60'}`}>
                      <option value="">— elige —</option>
                      {lista(x.opciones).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}{o.centro ? ` (de ${o.centro})` : ''}{o.activa ? '' : ' (ficha de baja)'}{o.tid ? ' · con ID' : ''}
                        </option>
                      ))}
                      <option value={NUEVA}>Crear ficha nueva</option>
                      <option value={FUERA}>No importar</option>
                    </select>
                  </label>
                ))}
              </div>
            )}
            {otrosAmbiguos.length > 0 && (
              <p className="text-xs text-amber-300">No se importan: {otrosAmbiguos.join(' · ')}.</p>
            )}
            {lista(previa.avisos).map((a, i) => <p key={i} className="text-xs text-amber-300">{a}</p>)}
            <button onClick={confirmar} disabled={ocupado || bloqueada || sinElegir > 0}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {bloqueada ? `Importar en ${center}`
                : sinElegir > 0 ? `Elige la ficha de ${sinElegir}`
                  : nuevas ? `Importar y crear ${nuevas} ${nuevas === 1 ? 'ficha nueva' : 'fichas nuevas'}` : 'Importar'}
            </button>
            <p className="text-[11px] text-dark-500">Los días concedidos en la app no se pisan. Se puede deshacer entero.</p>
          </div>
        )}
        {err && <p className="text-red-300">{err}</p>}
      </div>
    </Modal>
  )
}

/* ── AJUSTES Y ESTUDIO ──────────────────────────────────────────────────── */
function Ajustes({ center, datos, personas, onCambio }) {
  const [estudio, setEstudio] = useState(null)
  const [nuevo, setNuevo] = useState({ tipo: 'colchon_dia', fecha: '', colchon: 3, driver_id: '', lunes: '', max_dias: 4, refuerzo: 2, driver_a: '', driver_b: '' })
  const [err, setErr] = useState('')
  useEffect(() => {
    let vivo = true
    cuadranteEstudio(center).then((r) => { if (vivo) setEstudio(r.data) }).catch(() => { if (vivo) setEstudio({}) })
    return () => { vivo = false }
  }, [center])
  const nombre = useMemo(() => Object.fromEntries(personas.map((p) => [p.id, p.nombre])), [personas])
  const config = datos?.config || { colchon: 2, permitir_extra: true }
  const cambiaConfig = async (body) => {
    setErr('')
    try { await cuadranteConfig(center, body); onCambio() } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido guardar.') }
  }
  const crear = async () => {
    setErr('')
    try {
      await cuadranteAjuste({ center, ...nuevo })
      onCambio()
    } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido guardar.') }
  }
  const borrar = async (id) => {
    try { await cuadranteAjusteBorrar(id); onCambio() } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido borrar.') }
  }
  const conReglas = personas.filter((p) => lista(p.entendido).length || p.sin_entender)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3 p-4 text-[13px]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">Reglas del centro</h2>
        <label className="flex items-center gap-3 text-dark-300">
          Rutas por encima de la máxima, cada día
          {/* Con `key`, el campo se vuelve a montar con el colchón de la nave que llega (10-11-2026): no controlado,
              se quedaba con el valor con el que nació (el de la otra nave o el 2 por defecto) y al salir de él lo
              guardaba en la nueva. */}
          <input key={`${center}-${config.colchon}`} type="number" min={0} max={10} defaultValue={config.colchon} aria-label="Colchón"
            onBlur={(e) => Number(e.target.value) !== config.colchon && cambiaConfig({ colchon: Number(e.target.value) })}
            className="w-16 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-sm text-dark-100" />
        </label>
        <label className="flex items-center gap-2 text-dark-300">
          <input type="checkbox" checked={config.permitir_extra} onChange={(e) => cambiaConfig({ permitir_extra: e.target.checked })} />
          Si con 5 días no se llega, poner un 6º día extra (en rosa)
        </label>
        <p className="text-[11.5px] text-dark-500">Siempre: como mucho 6 días seguidos, y la semana de lunes a domingo con 5 días y 2 libres.</p>

        <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">Órdenes puntuales</h3>
        {lista(datos?.ajustes).length === 0 && <p className="text-dark-500">Ninguna.</p>}
        <ul className="space-y-1">
          {lista(datos?.ajustes).map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-dark-800 px-2.5 py-1.5">
              <span className="text-dark-200">
                {a.tipo === 'colchon_dia' ? `El ${fmt(a.fecha)} a +${a.colchon}`
                  : a.tipo === 'refuerzo_dia' ? `El ${fmt(a.fecha)} bajan ${a.refuerzo} de otros centros`
                    : a.tipo === 'libran_juntos' ? `${nombre[a.driver_ids?.[0]] || 'Alguien'} y ${nombre[a.driver_ids?.[1]] || 'alguien'}: librar los mismos días`
                      : `${nombre[a.driver_id] || 'Alguien'}: como mucho ${a.max_dias} días la semana del ${fmt(a.lunes)}`}
              </span>
              <button onClick={() => borrar(a.id)} aria-label="Quitar" className="ml-auto text-dark-500 hover:text-red-300"><X size={14} /></button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dark-800 p-2">
          <select value={nuevo.tipo} onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value }))} aria-label="Tipo de orden"
            className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100">
            <option value="colchon_dia">Un día con otro colchón</option>
            <option value="limite_semana">Máximo de días de alguien en una semana</option>
            <option value="refuerzo_dia">Un día en que bajan personas de otros centros</option>
            <option value="libran_juntos">Que dos personas libren los mismos días</option>
          </select>
          {nuevo.tipo === 'refuerzo_dia' ? (
            <>
              <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} aria-label="Día"
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
              <input type="number" min={0} max={60} value={nuevo.refuerzo} aria-label="Cuántos bajan de otros centros"
                onChange={(e) => setNuevo((n) => ({ ...n, refuerzo: Number(e.target.value) }))}
                className="w-14 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
            </>
          ) : nuevo.tipo === 'libran_juntos' ? (
            <>
              {['driver_a', 'driver_b'].map((k, i) => (
                <select key={k} value={nuevo[k]} onChange={(e) => setNuevo((n) => ({ ...n, [k]: e.target.value }))} aria-label={`Persona ${i + 1}`}
                  className="max-w-[12rem] rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100">
                  <option value="">— persona {i + 1} —</option>
                  {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              ))}
            </>
          ) : nuevo.tipo === 'colchon_dia' ? (
            <>
              <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} aria-label="Día"
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
              <input type="number" min={0} max={10} value={nuevo.colchon} aria-label="Colchón de ese día"
                onChange={(e) => setNuevo((n) => ({ ...n, colchon: Number(e.target.value) }))}
                className="w-14 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
            </>
          ) : (
            <>
              <select value={nuevo.driver_id} onChange={(e) => setNuevo((n) => ({ ...n, driver_id: e.target.value }))} aria-label="Persona"
                className="max-w-[12rem] rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100">
                <option value="">— persona —</option>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="date" value={nuevo.lunes} onChange={(e) => setNuevo((n) => ({ ...n, lunes: e.target.value }))} aria-label="Un día de esa semana"
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
              <input type="number" min={0} max={6} value={nuevo.max_dias} aria-label="Días como mucho"
                onChange={(e) => setNuevo((n) => ({ ...n, max_dias: Number(e.target.value) }))}
                className="w-14 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100" />
            </>
          )}
          <button onClick={crear} className="rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-200 hover:bg-dark-800">Añadir</button>
        </div>
        {err && <p className="text-red-300">{err}</p>}
      </section>

      <section className="card space-y-3 p-4 text-[13px]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">Notas que aplica el motor</h2>
        {conReglas.length === 0 ? <p className="text-dark-500">Nadie tiene notas todavía. Se ponen pulsando en el nombre.</p> : (
          <ul className="space-y-1.5">
            {conReglas.map((p) => (
              <li key={p.id} className="rounded-lg border border-dark-800 px-2.5 py-1.5">
                <b className="text-dark-100">{p.nombre}</b>
                {lista(p.entendido).length > 0 && <span className="block text-xs text-emerald-300">{p.entendido.join(' · ')}</span>}
                {p.sin_entender && <span className="block text-xs text-amber-300">Sin aplicar: «{p.sin_entender}»</span>}
              </li>
            ))}
          </ul>
        )}

        <h2 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">¿Se queda corto el +{config.colchon}?</h2>
        {!estudio ? <p className="text-dark-500">…</p> : !estudio.desde ? (
          <p className="text-dark-400">
            Empieza a medir desde que el cuadrante se lleva aquí. Cada día compara quién estaba puesto con quién salió de
            verdad (la asignación del día), y en unas semanas dice qué días de la semana falla más gente.
          </p>
        ) : lista(estudio.por_dia).length === 0 ? (
          <p className="text-dark-400">Midiendo desde el {fmt(estudio.desde)}. Aún no hay días con asignación que comparar.</p>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="text-dark-500"><th className="text-left">Día</th><th>Días medidos</th><th>No salen (media)</th><th>Colchón que haría falta</th></tr></thead>
            <tbody>
              {estudio.por_dia.map((d) => (
                <tr key={d.dia} className="border-t border-dark-800">
                  <td className="py-1 capitalize text-dark-200">{d.dia}</td>
                  <td className="text-center text-dark-300">{d.muestras}</td>
                  <td className="text-center text-dark-300">{String(d.media).replace('.', ',')}</td>
                  <td className={`text-center font-semibold ${d.sugerido == null ? 'text-dark-500' : d.sugerido > config.colchon ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {d.sugerido == null ? 'pocos datos' : `+${d.sugerido}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default function Cuadrante() {
  const { center, centers, setCenter } = useOutletContext()
  const noCenter = !center || center === 'Todos'
  const [rango, setRango] = useState(() => {
    const l = lunesDe(hoyLocal())
    return { desde: l, hasta: sumaDias(l, 13) }
  })
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [pestana, setPestana] = useState('cuadrante')
  const [verChat, setVerChat] = useState(false)
  const [pincel, setPincel] = useState(null)
  const [menu, setMenu] = useState(null)
  const [verPropuesta, setVerPropuesta] = useState(true)
  const [asistente, setAsistente] = useState(false)
  const [diaExtra, setDiaExtra] = useState(null)
  const [persona, setPersona] = useState(null)
  const [nueva, setNueva] = useState(false)
  const [importar, setImportar] = useState(false)
  const [avisar, setAvisar] = useState(false)               // la ventana de «Avisar a los conductores»
  const [trasAceptar, setTrasAceptar] = useState('')        // el aviso verde de aceptar (su texto) lleva el mismo botón
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [sheets, setSheets] = useState(false)
  // Si hay un borrador en la sincronización con la hoja, el botón lo dice (31-10-2026): lo que se cambia en esas
  // fechas no va a la hoja hasta marcarlo definitivo, y conviene verlo sin abrir el diálogo.
  const [borradorHoja, setBorradorHoja] = useState(null)
  useEffect(() => {
    if (noCenter) { setBorradorHoja(null); return }
    getSyncHoja(center).then(({ data }) => setBorradorHoja(data?.conectado ? data.borrador || null : null))
      .catch(() => setBorradorHoja(null))
  }, [center, sheets, noCenter])
  const [ocupado, setOcupado] = useState('')
  const [maxEdit, setMaxEdit] = useState({})
  const [refEdit, setRefEdit] = useState({})
  const pedida = useRef(0)

  /* AL CAMBIAR DE NAVE, FUERA LO DE LA OTRA (10-11-2026). La página no se
     vuelve a montar al cambiar la nave de arriba: la tabla, la propuesta y sus
     botones seguían siendo los de la nave anterior hasta que llegaba la
     respuesta, y una celda tocada en ese rato se guardaba con la nave nueva
     para un conductor de la vieja. Se vacía todo, sale «Cargando el
     cuadrante…» y no queda nada que tocar. */
  useEffect(() => {
    setDatos(null); setErr(''); setAviso(''); setMenu(null); setPincel(null)
  }, [center])
  /* La nave que está arriba AHORA (revisión del 10-11-2026). Guardar una celda,
     una máxima, aceptar… llaman al `cargar` de su render, que lleva dentro la
     nave de entonces: si se cambia de nave mientras la llamada va por el aire,
     ese cargar viejo pedía la otra nave con un número más alto que el de la
     nueva, la respuesta buena se tiraba y la tabla de NORTE quedaba bajo SUR. */
  const naveRef = useRef(center)
  naveRef.current = center
  /* Y el periodo (segunda revisión, 11-11-2026): con un guardado por el aire y
     «Semana siguiente», el cargar viejo pedía las fechas de antes y su tabla
     quedaba bajo las de ahora (máximas vacías, otras personas). */
  const vistaRef = useRef('')
  vistaRef.current = `${center}|${rango.desde}|${rango.hasta}`

  const cargar = useCallback(async (silencio = false) => {
    if (noCenter || vistaRef.current !== `${center}|${rango.desde}|${rango.hasta}`) return
    const n = ++pedida.current
    if (!silencio) setCargando(true)
    try {
      const r = await getCuadrante(center, rango.desde, rango.hasta)
      if (n === pedida.current) { setDatos(r.data); setMaxEdit({}); setRefEdit({}) }
    } catch (e) {
      if (n === pedida.current) setErr(e?.response?.data?.detail || 'No se ha podido cargar el cuadrante.')
    } finally {
      if (n === pedida.current) setCargando(false)
    }
  }, [center, rango, noCenter])

  useEffect(() => { cargar() }, [cargar])

  const dias = useMemo(() => rangoDias(rango.desde, rango.hasta, 92), [rango])
  const personas = useMemo(() => lista(datos?.personas), [datos])
  const hoy = datos?.hoy || hoyLocal()
  const propuesta = datos?.propuesta || null
  // «Avisar a los conductores» lleva un interruptor en el servidor (11-11-2026): solo con `avisar_activo: true` en lo
  // último que contestó GET /cuadrante. Sin la clave (un servidor de antes) o con false, ni botón ni ventana.
  const avisarActivo = datos?.avisar_activo === true
  const mostrarProp = Boolean(propuesta) && verPropuesta
  const cambiosProp = useMemo(() => {
    const m = {}
    for (const c of lista(propuesta?.cambios)) m[`${c.driver_id}|${c.fecha}`] = c
    return m
  }, [propuesta])
  // Las peticiones sin contestar (11-11-2026, cuadrante-1); sin la clave (servidor viejo), ninguna.
  const pendientes = useMemo(() => (datos?.pendientes && typeof datos.pendientes === 'object' ? datos.pendientes : {}), [datos])
  // Lo que la propuesta pone a trabajar justo el día que alguien ha pedido librar y aún no se le ha contestado.
  const propuestaPisaPendientes = useMemo(() => Object.entries(cambiosProp)
    .filter(([k, c]) => pendientes[k]?.tipo === 'libre' && TRABAJO.has(c.valor)).map(([k]) => k).sort(),
  [cambiosProp, pendientes])

  const celda = useCallback((did, f) => {
    const k = `${did}|${f}`
    const base = datos?.celdas?.[k] || null
    const c = mostrarProp ? cambiosProp[k] : null
    if (c) return { ...(base || {}), cod: c.valor, extra: c.extra, propuesta: c.valor !== c.antes, antes: c.antes }
    return base
  }, [datos, mostrarProp, cambiosProp])

  const colchonDe = useCallback((f) => {
    const a = lista(datos?.ajustes).find((x) => x.tipo === 'colchon_dia' && x.fecha === f)
    return a ? a.colchon : (datos?.config?.colchon ?? 2)
  }, [datos])

  const refuerzoDe = useCallback((f) => {
    const a = lista(datos?.ajustes).find((x) => x.tipo === 'refuerzo_dia' && x.fecha === f)
    return a ? a.refuerzo : 0
  }, [datos])

  const porDia = useMemo(() => resumenDias(dias, personas, celda, datos?.maximas, colchonDe, refuerzoDe),
    [dias, personas, celda, datos, colchonDe, refuerzoDe])

  /* El 7º día seguido, contando la semana de antes (viene en los datos). */
  const septimos = useMemo(() => septimosDe(personas, celda, rango.desde, rango.hasta), [personas, celda, rango])

  const totales = useMemo(() => {
    const m = {}
    for (const p of personas) {
      let d = 0
      let e = 0
      for (const f of dias) {
        const c = celda(p.id, f)
        if (c && TRABAJO.has(c.cod)) d += 1
        if (c?.extra) e += 1
      }
      m[p.id] = { d, e }
    }
    return m
  }, [personas, dias, celda])

  const dentro = useMemo(() => new Set(personas.map((p) => p.id)), [personas])
  // Lo que se pinta: las filas que casan con el buscador. Las cuentas de arriba usan `personas`, todas (11-11-2026).
  const [busca, setBusca] = useState('')
  const visibles = useMemo(() => personas.filter((p) => casaBusqueda(p, busca)), [personas, busca])
  const cortos = useMemo(() => nombresCortos(personas), [personas])

  const guardarCeldas = async (cambios, msg) => {
    setErr(''); setAviso('')
    setDatos((d) => {
      if (!d) return d
      const cel = { ...d.celdas }
      for (const c of cambios) {
        const k = `${c.driver_id}|${c.fecha}`
        if (c.desbloquear) cel[k] = { ...(cel[k] || {}), fijada: false }
        else if (!c.cod) delete cel[k]
        else cel[k] = { ...(cel[k] || {}), cod: c.cod, fijada: true, extra: false }
      }
      return { ...d, celdas: cel }
    })
    try {
      const r = await cuadranteCeldas(center, cambios)
      const b = lista(r.data?.bloqueadas)
      if (naveRef.current !== center) return        // ya se está viendo otra nave: su aviso no va aquí
      if (b.length) setErr(`${b.length === 1 ? 'Una celda no se ha cambiado' : `${b.length} celdas no se han cambiado`}: ${b[0].motivo}.`)
      else if (msg) setAviso(msg)
    } catch (e) {
      if (naveRef.current !== center) return
      setErr(e?.response?.data?.detail || 'No se ha podido guardar.')
    }
    cargar(true)
  }

  const pulsarCelda = (e, p, f) => {
    if (mostrarProp) { setAviso('Estás viendo la propuesta: acéptala, descártala o pulsa «Ver lo actual» para tocar celdas.'); return }
    const c = celda(p.id, f)
    if (c?.otro_centro) { setErr(`Ese día ${p.nombre} está en ${c.otro_centro}.`); return }
    // Un día concedido con candado no lo pisa el pincel: primero se le quita.
    if (pincel !== null && c?.aprobado && c?.fijada) {
      setErr(`El ${fmt(f)} de ${p.nombre} es un día concedido con candado: púlsalo sin pincel para quitárselo.`)
      return
    }
    if (pincel !== null) { guardarCeldas([{ driver_id: p.id, fecha: f, cod: pincel }]); return }
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ p, f, c, x: Math.max(8, Math.min(r.left, window.innerWidth - 260)), y: Math.min(r.bottom + 4, window.innerHeight - 260) })
  }

  const guardarMaxima = async (f) => {
    const v = maxEdit[f]
    if (v === undefined || String(v) === String(datos?.maximas?.[f] ?? '')) return
    try {
      await cuadranteMaximas(center, { [f]: v === '' ? null : v })
      cargar(true)
    } catch (e) {
      if (naveRef.current !== center) return        // como en guardarCeldas: su error no va en otra nave
      setErr(e?.response?.data?.detail || 'No se ha podido guardar la máxima.')
    }
  }

  const guardarRefuerzo = async (f) => {
    const v = refEdit[f]
    if (v === undefined || String(v || 0) === String(refuerzoDe(f) || 0)) return
    try {
      await cuadranteAjuste({ center, tipo: 'refuerzo_dia', fecha: f, refuerzo: v === '' ? 0 : Number(v) })
      cargar(true)
    } catch (e) {
      if (naveRef.current !== center) return
      setErr(e?.response?.data?.detail || 'No se ha podido guardar.')
    }
  }

  const aceptar = async () => {
    if (!propuesta) return
    setOcupado('aceptar'); setErr('')
    try {
      const r = await cuadranteAceptar(propuesta.id)
      const n = r.data?.n_saltadas || 0
      const texto = `Propuesta aplicada: ${r.data?.aplicadas ?? 0} celdas.` +
        (n ? ` ${n} no se han tocado porque alguien las cambió mientras tanto.` : '')
      setAviso(texto)
      setTrasAceptar(texto)
      await cargar()
    } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido aplicar.') } finally { setOcupado('') }
  }
  const descartar = async () => {
    if (!propuesta) return
    setOcupado('descartar')
    try { await cuadranteDescartar(propuesta.id); setAviso('Propuesta descartada. El cuadrante está como estaba.'); await cargar() }
    catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido descartar.') } finally { setOcupado('') }
  }
  const deshacer = async () => {
    const u = datos?.ultimo_cambio
    if (!u || !window.confirm(`¿Deshacer «${u.que}»?`)) return
    setOcupado('deshacer'); setErr('')
    try { const r = await cuadranteDeshacer(center); setAviso(`Deshecho: ${r.data?.que}.`); await cargar() }
    catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido deshacer.') } finally { setOcupado('') }
  }
  const excel = async () => {
    setOcupado('excel'); setErr('')
    try {
      const r = await cuadranteExportar(center, rango.desde, rango.hasta)
      descargar(r.data, `cuadrante-${center}-${rango.desde}-a-${rango.hasta}.xlsx`)
    } catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido generar el Excel.') } finally { setOcupado('') }
  }
  const mover = (n) => setRango((r) => ({ desde: sumaDias(r.desde, n), hasta: sumaDias(r.hasta, n) }))

  if (noCenter) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-semibold text-dark-50">Cuadrante</h1>
        {/* Un botón por centro ahí mismo, no «elige arriba» (11-11-2026, portal_inicio-9). */}
        <ElegirNave className="mt-4" centers={centers} setCenter={setCenter} texto="El cuadrante va por centro: ¿cuál quieres ver?" />
      </div>
    )
  }

  const ultimaMax = Object.keys(datos?.maximas || {}).sort().pop()
  const hayExtras = dias.some((f) => porDia[f]?.extras > 0)

  // El mismo buscador en la rejilla y en «Personas y notas»: lo escrito se mantiene al cambiar de pestaña.
  const buscador = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative w-full sm:w-72">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar persona"
          placeholder="Buscar por nombre o apodo…"
          className="min-h-[44px] w-full rounded-lg border border-dark-700 bg-dark-900 py-2 pl-9 pr-3 text-[13px] text-dark-100 placeholder:text-dark-500 sm:min-h-0 sm:py-1.5" />
      </label>
      {busca.trim() && (
        <span className="text-[12px] text-dark-400" data-testid="busca-cuenta">
          {visibles.length} de {personas.length}
          <button onClick={() => setBusca('')}
            className="ml-1 inline-flex min-h-[44px] items-center px-2 font-semibold text-brand-300 hover:text-brand-200 sm:min-h-0">Ver a todos</button>
        </span>
      )}
    </div>
  )

  /* Con el chat abierto en pantalla ancha, TODA la página deja su hueco a la
     derecha: antes solo la tabla, y la cabecera y los botones quedaban debajo
     del chat. */
  return (
    <div className={`space-y-4 ${verChat ? 'xl:pr-[376px]' : ''}`}>
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-brand-400/80">{center}</p>
          <h1 className="mt-1 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">
            Cuadrante
          </h1>
          <p className="mt-2 max-w-[74ch] text-[13px] text-dark-400">
            Quién trabaja cada día. El motor lo cuadra a máxima +{datos?.config?.colchon ?? 2}, con 5 días y 2 libres y nunca
            7 seguidos. Lo que tocas a mano queda con candado; lo que propone el motor lo aceptas tú.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setAsistente(true)} className="btn-primary flex items-center gap-2 px-3.5 py-2 text-sm">
            <Sparkles size={15} /> Rehacer cuadrante
          </button>
          <button onClick={() => setVerChat((v) => !v)} aria-pressed={verChat}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${verChat
              ? 'border-brand-500/60 bg-brand-500/15 text-dark-50' : 'border-dark-700 text-dark-200 hover:bg-dark-800'}`}>
            <MessageSquare size={15} /> Asistente
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {[['cuadrante', 'Cuadrante', CalendarRange], ['personas', 'Personas y notas', Users], ['ajustes', 'Ajustes y estudio', SlidersHorizontal]]
          .map(([k, t, Icono]) => (
            <button key={k} onClick={() => setPestana(k)} aria-pressed={pestana === k}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${pestana === k
                ? 'bg-brand-500/20 text-dark-50' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'}`}>
              <Icono size={14} /> {t}
            </button>
          ))}
        {avisarActivo ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {datos?.ultimo_cambio && (
              <button onClick={deshacer} disabled={ocupado === 'deshacer'} title={`Deshacer «${datos.ultimo_cambio.que}»`}
                className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
                {ocupado === 'deshacer' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Deshacer último cambio
              </button>
            )}
            {/* Nunca solo: abre la lista de a quién y qué, y se manda al pulsar (11-11-2026, cuadrante-8). */}
            <button onClick={() => setAvisar(true)} title="Manda a cada conductor sus días cambiados de hoy a 14 días. Antes ves la lista."
              className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs text-dark-300 hover:bg-dark-800">
              <Bell size={13} /> Avisar a los conductores
            </button>
          </div>
        ) : datos?.ultimo_cambio && (
          // Con el aviso apagado, la barra de siempre: «Deshacer» solo, sin envoltorio (11-11-2026).
          <button onClick={deshacer} disabled={ocupado === 'deshacer'} title={`Deshacer «${datos.ultimo_cambio.que}»`}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
            {ocupado === 'deshacer' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Deshacer último cambio
          </button>
        )}
      </div>

      {err && (
        <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {err}
          <button onClick={() => setErr('')} aria-label="Cerrar aviso" className="ml-auto"><X size={14} /></button>
        </p>
      )}
      {aviso && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          <Check size={15} className="mt-0.5 shrink-0" /> {avisarActivo ? (
            <span>{aviso}
              {trasAceptar === aviso && (
                <>
                  {' '}
                  <button onClick={() => setAvisar(true)} data-testid="avisar-tras-aceptar"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-200 underline hover:text-emerald-100">
                    <Bell size={12} /> Avisar a los conductores
                  </button>
                </>
              )}
            </span>
          ) : aviso}
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso" className="ml-auto"><X size={14} /></button>
        </p>
      )}

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {pestana === 'cuadrante' && (
            <>
              {propuesta && (
                <section className="card space-y-2 border-violet-500/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles size={16} className="text-violet-300" />
                    <h2 className="text-sm font-bold text-dark-50">Propuesta del motor</h2>
                    <span className="text-xs text-dark-400">
                      del {fmt(propuesta.desde)} al {fmt(propuesta.hasta)} · {propuesta.n_cambios} cambios ·
                      {' '}{propuesta.extras} días extra
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button onClick={() => setVerPropuesta((v) => !v)}
                        className="rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs text-dark-300 hover:bg-dark-800">
                        {verPropuesta ? 'Ver lo actual' : 'Ver la propuesta'}
                      </button>
                      <button onClick={descartar} disabled={Boolean(ocupado)}
                        className="rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
                        Descartar
                      </button>
                      <button onClick={aceptar} disabled={Boolean(ocupado)}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40">
                        {ocupado === 'aceptar' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aceptar
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {lista(propuesta.resumen_dias).map((d) => (
                      <span key={d.fecha} title={`${d.planificadas} rutas · máxima ${d.maxima}`}
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${claseDif({ dif: d.diferencia, colchon: d.colchon })}`}>
                        {fmt(d.fecha)} {signo(d.diferencia)}
                      </span>
                    ))}
                  </div>
                  {propuestaPisaPendientes.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-300" data-testid="propuesta-pendientes">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>
                        La propuesta pone a trabajar {propuestaPisaPendientes.length === 1 ? 'un día' : `${propuestaPisaPendientes.length} días`} que
                        {' '}alguien ha pedido librar (sin contestar): {quienesYCuando(propuestaPisaPendientes, personas).join(', ')}.{' '}
                        <Link to={enlaceDiasLibres(center)} className="font-semibold underline">Ver en Días libres</Link>
                      </span>
                    </p>
                  )}
                  {propuesta.faltan_conductores > 0 && (
                    <p className="text-xs text-amber-300">
                      Para no depender de días extra harían falta {propuesta.faltan_conductores === 1
                        ? 'un conductor más' : `unos ${propuesta.faltan_conductores} conductores más`} (a 5 días por semana).
                    </p>
                  )}
                  {lista(propuesta.avisos).length > 0 && (
                    <details className="text-xs text-dark-400">
                      <summary className="cursor-pointer text-dark-300">{propuesta.avisos.length} avisos del motor</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{propuesta.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </details>
                  )}
                  <p className="text-[11px] text-dark-500">
                    Con borde morado, lo que cambia. En rosa, los días extra. Aceptar no pisa lo que alguien toque mientras tanto.
                  </p>
                </section>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {/* En el móvil, la fila de fechas ocupa el ancho y los dos campos encogen: con su ancho de siempre la
                    flecha «Semana siguiente» quedaba fuera y la página se deslizaba de lado (11-11-2026). Desde sm, igual. */}
                <div className="flex items-center gap-1 max-sm:w-full">
                  <button onClick={() => mover(-7)} aria-label="Semana anterior" className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
                  <input type="date" value={rango.desde} aria-label="Desde"
                    onChange={(e) => e.target.value && setRango((r) => ({ ...r, desde: e.target.value, hasta: r.hasta < e.target.value ? e.target.value : r.hasta }))}
                    className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100 max-sm:min-w-0 max-sm:flex-1" />
                  <span className="text-dark-500">–</span>
                  <input type="date" value={rango.hasta} aria-label="Hasta" min={rango.desde}
                    onChange={(e) => e.target.value && setRango((r) => ({ ...r, hasta: e.target.value }))}
                    className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-xs text-dark-100 max-sm:min-w-0 max-sm:flex-1" />
                  <button onClick={() => mover(7)} aria-label="Semana siguiente" className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
                </div>
                <button onClick={() => { const l = lunesDe(hoyLocal()); setRango({ desde: l, hasta: sumaDias(l, 13) }) }}
                  className="rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800">Estas 2 semanas</button>
                {ultimaMax && ultimaMax > rango.hasta && (
                  <button onClick={() => setRango((r) => ({ ...r, hasta: ultimaMax }))}
                    className="rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800">
                    Hasta el {fmt(ultimaMax)}
                  </button>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {/* El cuadrante en grande, como su Excel: DIARIO, MENSUAL y DEBER HORAS. */}
                  <button onClick={() => setHojaAbierta(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20">
                    <Sheet size={13} /> Abrir como hoja (Excel)
                  </button>
                  {hayExtras && (
                    <button onClick={() => setDiaExtra(dias.find((f) => f > hoy && porDia[f]?.extras) || dias.find((f) => porDia[f]?.extras))}
                      className="flex items-center gap-1.5 rounded-lg border border-pink-400/40 px-2.5 py-1 text-xs text-dark-200 hover:bg-dark-800">
                      <Gift size={13} /> Día extra → libre
                    </button>
                  )}
                  <button onClick={excel} disabled={ocupado === 'excel'}
                    className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
                    {ocupado === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Excel
                  </button>
                  <button onClick={() => setImportar(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800">
                    <Upload size={13} /> Importar hoja
                  </button>
                  <button onClick={() => setSheets(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-800">
                    <RefreshCw size={13} /> Google Sheets
                    {borradorHoja && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200"
                        title={`Borrador del ${String(borradorHoja.desde).slice(8, 10)}/${String(borradorHoja.desde).slice(5, 7)} al ${String(borradorHoja.hasta).slice(8, 10)}/${String(borradorHoja.hasta).slice(5, 7)}: esas fechas no van a la hoja hasta marcarlo definitivo`}>
                        borrador
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="flex items-center gap-1 text-dark-500"><Brush size={12} /> Pincel:</span>
                <button onClick={() => setPincel(null)} aria-pressed={pincel === null}
                  className={`rounded-md px-2 py-1 font-semibold ${pincel === null ? 'bg-brand-500/20 text-dark-50' : 'text-dark-400 hover:bg-dark-800'}`}>
                  Ninguno (menú)
                </button>
                {PALETA.map(([cod, t]) => (
                  <button key={cod} onClick={() => setPincel(cod)} title={t} aria-pressed={pincel === cod}
                    className={`rounded-md px-2 py-1 font-bold ${claseCodigo(cod)} ${pincel === cod ? 'ring-2 ring-brand-400' : ''}`}>
                    {ABREV[cod] || cod}
                  </button>
                ))}
                <button onClick={() => setPincel('')} title="Vaciar" aria-pressed={pincel === ''}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-dark-300 ${pincel === '' ? 'ring-2 ring-brand-400' : ''}`}>
                  <Eraser size={12} /> vaciar
                </button>
              </div>

              {personas.length > 0 && buscador}

              {cargando && !datos ? (
                <div className="card flex items-center gap-2 p-8 text-dark-400"><Loader2 className="animate-spin" size={18} /> Cargando el cuadrante…</div>
              ) : personas.length === 0 ? (
                <div className="card space-y-2 p-6 text-[13px] text-dark-300">
                  <p className="text-dark-100">Todavía no hay nadie en el cuadrante de {center} para estas fechas.</p>
                  <p>Importa la hoja del mes o añade a la gente en «Personas y notas».</p>
                  <button onClick={() => setImportar(true)} className="btn-primary mt-1 flex items-center gap-2 px-3 py-2 text-sm">
                    <Upload size={14} /> Importar la hoja del mes
                  </button>
                </div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="border-collapse text-[11px]">
                    <thead>
                      <tr>
                        {/* En el móvil, la columna del nombre se estrecha (nombre corto) para que quepan más días;
                            desde sm, como siempre (11-11-2026, cuadrante-10). */}
                        <th className="sticky left-0 z-20 bg-dark-900 px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-dark-500 sm:min-w-[13rem] sm:px-2">
                          Conductor
                        </th>
                        {dias.map((f) => (
                          <th key={f} className={`px-0.5 pb-0.5 pt-1 text-center font-semibold ${f === hoy ? 'text-amber-300' : 'text-dark-400'} ${
                            wd(f) === 0 ? 'border-l border-dark-600' : ''}`}>
                            {f.slice(8) === '01' && <span className="block text-[8.5px] font-bold text-red-300">{MES[Number(f.slice(5, 7)) - 1]}</span>}
                            <span className={`block rounded-t-[3px] text-[9px] ${wd(f) === 6 ? DOMINGO_TRABAJA : ''}`}>{LETRA[wd(f)]}</span>
                            <span className={`block rounded-b-[3px] text-[11px] font-bold ${CABECERA_DIA} ${f === hoy ? 'ring-2 ring-amber-300' : ''}`}>{Number(f.slice(8))}</span>
                          </th>
                        ))}
                        <th className="px-1.5 text-[10px] font-semibold text-dark-500" title="Días trabajados en lo que ves">Días</th>
                        <th className="px-1.5 text-[10px] font-semibold text-dark-500" title="Días extra en lo que ves">Ext</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.length === 0 && (
                        <tr className="border-t border-dark-800/70">
                          <td className="sticky left-0 z-10 bg-dark-900 px-2 py-3 text-[12px] text-dark-400" colSpan={3}>
                            Nadie en este cuadrante se llama «{busca.trim()}».
                          </td>
                        </tr>
                      )}
                      {visibles.map((p) => (
                        <tr key={p.id} className="border-t border-dark-800/70">
                          <td className="sticky left-0 z-10 bg-dark-900 px-1 py-0.5 sm:px-2">
                            {/* En el móvil, el nombre corto, sin las etiquetas de horario (el color del nombre ya dice
                                horario fijo o findes) y con «SE VA» / «ENTRA» debajo, en su segunda línea, para no
                                ensanchar la columna; al tocarlo se abre su ficha con el nombre entero. */}
                            <button onClick={() => setPersona(p)}
                              className="flex w-full max-w-[7.5rem] flex-wrap items-center gap-1 text-left sm:max-w-none sm:flex-nowrap sm:gap-1.5"
                              title={[p.nombre, ...lista(p.entendido), p.nota,
                                p.alta_desde ? `entra ${fmt(p.alta_desde)}` : '', p.inactivo_desde ? `se va ${fmt(p.inactivo_desde)}` : '']
                                .filter(Boolean).join(' · ')}>
                              <span className={`max-w-[6.5rem] truncate rounded-[3px] px-1 text-[12px] sm:max-w-[11rem] ${claseNombre(p, rango.hasta) || (p.ficha_activa ? 'text-dark-100' : 'text-dark-400 italic')}`}>
                                {/* El corto solo se ve; el entero es el que se lee en voz alta (y el nombre del botón). */}
                                <span className="sm:hidden" aria-hidden="true">{cortos[p.id] || p.nombre}</span>
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">{p.nombre}</span>
                              </span>
                              {p.tipo === 'empresa' && (
                                <span className="hidden shrink-0 rounded bg-sky-500/20 px-1 text-[9px] font-bold text-sky-300 sm:inline">
                                  {p.patron ? p.patron.map((d) => LETRA[d]).join('') : 'L-V'}
                                </span>
                              )}
                              {p.tipo === 'finde' && <span className="hidden shrink-0 rounded bg-orange-500/15 px-1 text-[9px] font-bold text-orange-300 sm:inline">FINDE</span>}
                              {p.tipo === 'inactivo' && <span className="hidden shrink-0 rounded bg-dark-800 px-1 text-[9px] font-bold text-dark-400 sm:inline">FUERA</span>}
                              {p.inactivo_desde && p.inactivo_desde <= rango.hasta && (
                                <span className="order-last shrink-0 rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300 sm:order-none">SE VA {fmt(p.inactivo_desde)}</span>
                              )}
                              {p.alta_desde && p.alta_desde >= rango.desde && (
                                <span className="order-last shrink-0 rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300 sm:order-none">ENTRA {fmt(p.alta_desde)}</span>
                              )}
                              {(p.nota || lista(p.reglas_fijas).length > 0) && <StickyNote size={11} className="shrink-0 text-amber-300" />}
                            </button>
                          </td>
                          {dias.map((f) => {
                            const k = `${p.id}|${f}`
                            const c = celda(p.id, f)
                            const cod = c?.cod || ''
                            const septimo = septimos.has(k)
                            const pend = pendientes[k]
                            return (
                              <td key={f} className={`px-[1px] py-[1px] text-center ${
                                wd(f) === 6 ? COLUMNA_DOMINGO : f === hoy ? 'bg-amber-400/[0.06]' : ''} ${
                                wd(f) === 0 ? 'border-l border-dark-600' : ''}`}>
                                <button onClick={(e) => pulsarCelda(e, p, f)}
                                  style={{ scrollMarginRight: '5rem' }}
                                  title={`${p.nombre} · ${DIA[wd(f)]} ${fmt(f)} · ${cod || 'sin poner'}${c?.hora ? ` (${c.hora})` : ''}${
                                    c?.extra ? ' · DÍA EXTRA' : ''}${c?.fijada ? ' · fijada a mano' : ''}${c?.otro_centro ? ` · en ${c.otro_centro}` : ''}${
                                    c?.propuesta ? ` · antes: ${c.antes || 'vacío'}` : ''}${septimo ? ' · 7º DÍA SEGUIDO' : ''}${
                                    pend ? (pend.tipo === 'extra' ? ' · pidió día extra (sin contestar)' : ' · pidió librar (sin contestar)') : ''}`}
                                  className={`relative h-6 w-8 sm:w-9 rounded-[3px] text-[10px] font-bold leading-none ${cod
                                    ? claseCodigo(cod, c?.extra, wd(f) === 6)
                                    : `border border-dashed text-dark-500 ${wd(f) === 6 ? 'border-orange-500/40' : 'border-dark-800'}`} ${
                                    c?.otro_centro ? 'opacity-40' : ''} ${c?.propuesta ? 'outline outline-2 outline-violet-400' : ''} ${
                                    septimo ? 'outline outline-2 outline-red-500' : ''}`}>
                                  {cod ? (ABREV[cod] || cod) : '·'}
                                  {c?.fijada && <Lock size={7} className="absolute right-[1px] top-[1px] opacity-70" />}
                                  {/* Petición sin contestar: un punto ámbar arriba a la izquierda (el candado va a la derecha). */}
                                  {pend && <span aria-hidden="true" data-testid="punto-pendiente"
                                    className="absolute left-[1px] top-[1px] h-[5px] w-[5px] rounded-full bg-amber-500 ring-1 ring-black/40" />}
                                </button>
                              </td>
                            )
                          })}
                          <td className="px-1.5 text-center text-[11px] font-semibold text-dark-300">{totales[p.id]?.d ?? 0}</td>
                          <td className="px-1.5 text-center text-[11px] font-semibold text-dark-400">{totales[p.id]?.e || ''}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-dark-600">
                        <td className="sticky left-0 z-10 bg-dark-900 px-2 py-1 text-[11px] font-bold text-dark-200">Rutas (cuenta de 1)</td>
                        {dias.map((f) => (
                          <td key={f} className={`px-[1px] py-1 text-center ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                            <span className="inline-block w-8 sm:w-9 rounded-[3px] bg-sky-500/20 py-0.5 text-[11px] font-bold text-sky-300">{porDia[f]?.rutas}</span>
                          </td>
                        ))}
                        <td colSpan={2} />
                      </tr>
                      <tr>
                        <td className="sticky left-0 z-10 bg-dark-900 px-2 py-1 text-[11px] font-bold text-dark-200">Máxima</td>
                        {dias.map((f) => (
                          <td key={f} className={`px-[1px] py-0.5 text-center ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                            <input type="number" min={0} max={999} aria-label={`Máxima del ${fmt(f)}`}
                              value={maxEdit[f] ?? datos?.maximas?.[f] ?? ''}
                              onChange={(e) => setMaxEdit((m) => ({ ...m, [f]: e.target.value }))}
                              onBlur={() => guardarMaxima(f)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              className="w-8 sm:w-9 rounded-[3px] border border-dark-700 bg-dark-900 px-0 py-0.5 text-center text-[11px] font-bold text-dark-100" />
                          </td>
                        ))}
                        <td colSpan={2} />
                      </tr>
                      <tr>
                        <td className="sticky left-0 z-10 bg-dark-900 px-2 py-1 text-[11px] font-bold text-violet-200"
                          title="Gente que baja de otros centros ese día: cuenta como rutas hechas, así hacen falta menos de aquí y se encadenan menos días">
                          Bajan de otros centros
                        </td>
                        {dias.map((f) => (
                          <td key={f} className={`px-[1px] py-0.5 text-center ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                            <input type="number" min={0} max={60} aria-label={`Bajan de otros centros el ${fmt(f)}`}
                              value={refEdit[f] ?? (refuerzoDe(f) || '')}
                              onChange={(e) => setRefEdit((m) => ({ ...m, [f]: e.target.value }))}
                              onBlur={() => guardarRefuerzo(f)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              className="w-8 sm:w-9 rounded-[3px] border border-violet-500/40 bg-dark-900 px-0 py-0.5 text-center text-[11px] font-bold text-violet-200" />
                          </td>
                        ))}
                        <td colSpan={2} />
                      </tr>
                      <tr>
                        <td className="sticky left-0 z-10 bg-dark-900 px-2 py-1 text-[11px] font-bold text-dark-200">
                          Diferencia (objetivo +{datos?.config?.colchon ?? 2})
                        </td>
                        {dias.map((f) => {
                          const d = porDia[f] || {}
                          return (
                            <td key={f} className={`px-[1px] py-1 text-center ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                              <button onClick={() => d.extras && setDiaExtra(f)} disabled={!d.extras}
                                title={d.extras ? `${d.extras} días extra: pulsa para dar libres` : `Objetivo +${d.colchon}`}
                                className={`w-8 sm:w-9 rounded-[3px] py-0.5 text-[11px] font-bold ${claseDif(d)} ${d.extras ? 'cursor-pointer ring-1 ring-pink-400/50' : 'cursor-default'}`}>
                                {signo(d.dif)}
                              </button>
                            </td>
                          )
                        })}
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-dark-400">
                {[['1', 'Trabaja'], ['N/T', 'Libra'], ['V', 'Vacaciones'], ['BAJA', 'Baja'], ['N/D', 'No disponible'],
                  ['APROBADO', 'Aprobado (no se toca)'], ['SUSP', 'Suspendido'], ['BKP', 'Backup'], ['RA', 'Ride along'], ['S', 'Oficina']].map(([c, t]) => (
                  <span key={c} className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${claseCodigo(c)}`} /> {t}</span>
                ))}
                <span className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${claseCodigo('1', true)}`} /> Día extra (6º día, se puede quitar)</span>
                <span className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${DOMINGO_TRABAJA}`} /> Domingo</span>
                <span className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${NOMBRE_EMPRESA}`} /> Nombre: horario fijo</span>
                <span className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${NOMBRE_FINDE}`} /> Nombre: solo findes o días fijos</span>
                <span className="flex items-center gap-1.5"><i className={`inline-block h-3 w-5 rounded-sm ${NOMBRE_SE_VA}`} /> Nombre: deja el cuadrante</span>
                <span className="flex items-center gap-1.5"><Lock size={11} /> Fijada a mano</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-5 rounded-sm outline outline-2 outline-violet-400" /> Cambio propuesto</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-5 rounded-sm outline outline-2 outline-red-500" /> 7º día seguido</span>
                {Object.keys(pendientes).length > 0 && (
                  <span className="flex items-center gap-1.5"><i className="inline-block h-[5px] w-[5px] rounded-full bg-amber-500" /> Pidió el día y aún no se le ha contestado</span>
                )}
              </div>
            </>
          )}

          {/* Al cambiar de nave, «Personas y notas» y «Ajustes y estudio» esperan como la tabla (10-11-2026): sin
              esto salía «0 personas en el cuadrante» con «Añadir» activo, o el colchón 2 por defecto. */}
          {pestana !== 'cuadrante' && cargando && !datos ? (
            <div className="card flex items-center gap-2 p-8 text-dark-400"><Loader2 className="animate-spin" size={18} /> Cargando el cuadrante…</div>
          ) : pestana === 'personas' && (
            <section className="card overflow-x-auto p-0">
              <div className="flex items-center gap-2 border-b border-dark-800 px-4 py-3">
                <h2 className="text-sm font-bold text-dark-100">{personas.length} personas en el cuadrante</h2>
                <button onClick={() => setNueva(true)} className="ml-auto flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-200 hover:bg-dark-800">
                  <Plus size={13} /> Añadir
                </button>
              </div>
              {personas.length > 0 && <div className="border-b border-dark-800 px-4 py-2.5">{buscador}</div>}
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-dark-500">
                    <th className="px-4 py-2">Nombre</th><th className="px-2">Cómo trabaja</th><th className="px-2">Nota</th>
                    <th className="px-2">Lo que aplica el motor</th><th className="px-2">Entra / se va</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.length > 0 && visibles.length === 0 && (
                    <tr className="border-t border-dark-800"><td colSpan={5} className="px-4 py-3 text-dark-400">Nadie en este cuadrante se llama «{busca.trim()}».</td></tr>
                  )}
                  {visibles.map((p) => (
                    <tr key={p.id} onClick={() => setPersona(p)} className="cursor-pointer border-t border-dark-800 hover:bg-dark-800/50">
                      <td className="px-4 py-2 text-dark-100">{p.nombre}{!p.ficha_activa && <span className="ml-1 text-[10px] text-amber-300">(ficha de baja)</span>}</td>
                      <td className="px-2 text-dark-300">
                        {(TIPOS.find(([k]) => k === p.tipo) || TIPOS[0])[1]}
                        {p.tipo === 'empresa' && p.patron && <span className="ml-1 text-dark-500">({p.patron.map((d) => LETRA[d]).join('')})</span>}
                      </td>
                      <td className="max-w-[16rem] truncate px-2 text-dark-400" title={p.nota}>{p.nota || '—'}</td>
                      <td className="px-2 text-xs">
                        {lista(p.entendido).length ? <span className="text-emerald-300">{p.entendido.join(' · ')}</span> : <span className="text-dark-500">—</span>}
                        {p.sin_entender && <span className="block text-amber-300">Sin aplicar: «{p.sin_entender}»</span>}
                      </td>
                      <td className="px-2 text-xs text-dark-400">
                        {p.alta_desde ? `entra ${fmt(p.alta_desde)}` : ''}{p.alta_desde && p.inactivo_desde ? ' · ' : ''}
                        {p.inactivo_desde ? `se va ${fmt(p.inactivo_desde)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {pestana === 'ajustes' && !(cargando && !datos) && <Ajustes center={center} datos={datos} personas={personas} onCambio={() => cargar(true)} />}
        </div>

      </div>

      {/* UN solo chat: en pantalla ancha, fijo a la derecha de la hoja; en el
          móvil, a pantalla completa. Dos montados (uno escondido) serían dos
          conversaciones pidiendo lo mismo y dos cajas de texto iguales.
          Termina 6 rem por ENCIMA del borde de abajo a propósito: ahí vive la
          burbuja de la IA general, y tapaba el botón de enviar (lo cazó la
          prueba de humo: el clic caía en la burbuja). */}
      {verChat && (
        <div className="fixed inset-0 z-50 bg-black/60 p-2 pb-20 xl:inset-auto xl:bottom-24 xl:right-4 xl:top-20 xl:z-40 xl:w-[360px] xl:bg-transparent xl:p-0">
          <div className="mx-auto h-full max-w-lg xl:max-w-none">
            <CuadranteChat center={center} desde={sumaDias(hoy, 1)} hasta={rango.hasta > hoy ? rango.hasta : sumaDias(hoy, 14)}
              onAplicado={() => cargar(true)} onCerrar={() => setVerChat(false)} />
          </div>
        </div>
      )}

      {!verChat && (
        <button onClick={() => setVerChat(true)} aria-label="Abrir el asistente del cuadrante"
          className="btn-primary fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg xl:hidden">
          <MessageSquare size={20} />
        </button>
      )}

      {menu && (
        <div className="fixed inset-0 z-50" onMouseDown={() => setMenu(null)}>
          <div className="absolute w-60 space-y-2 rounded-xl border border-dark-700 bg-dark-900 p-2.5 shadow-xl shadow-black/30" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
            <p className="truncate text-[11.5px] text-dark-400">{menu.p.nombre} · {DIA[wd(menu.f)]} {fmt(menu.f)}</p>
            {/* En el móvil no hay title: lo de la petición sin contestar, dicho aquí (11-11-2026, cuadrante-1). */}
            {pendientes[`${menu.p.id}|${menu.f}`] && (
              <p className="text-[11.5px] leading-snug text-amber-300" data-testid="menu-pendiente">
                {pendientes[`${menu.p.id}|${menu.f}`].tipo === 'extra'
                  ? 'Pidió trabajar este día de más y aún no se le ha contestado.'
                  : 'Pidió librar este día y aún no se le ha contestado.'}{' '}
                <Link to={enlaceDiasLibres(center)} className="font-semibold text-amber-200 underline">Ver en Días libres</Link>
              </p>
            )}
            {/* Día concedido con candado (Dani: «que si lo apruebo aparezca en el
                cuadrante y bloqueado, aunque yo lo pueda desbloquear»). */}
            {menu.c?.aprobado && menu.c?.fijada ? (
              <div className="space-y-2">
                <p className="flex items-start gap-1.5 text-[12px] leading-snug text-emerald-300">
                  <Lock size={12} className="mt-0.5 shrink-0" /> Día concedido: tiene candado. Ni el motor ni nadie lo cambia sin quitárselo.
                </p>
                {canSee('aprobar-dias') ? (
                  <button onClick={() => { guardarCeldas([{ driver_id: menu.p.id, fecha: menu.f, desbloquear: true }], 'Candado quitado: ya puedes cambiar ese día.'); setMenu(null) }}
                    className="flex items-center gap-1 rounded-md border border-dark-700 px-2 py-1 text-[11px] text-dark-200 hover:bg-dark-800">
                    <Unlock size={11} /> Quitar candado para cambiarlo
                  </button>
                ) : (
                  <p className="text-[11px] text-dark-500">Solo quien aprueba días puede quitarle el candado.</p>
                )}
              </div>
            ) : (<>
            <div className="grid grid-cols-4 gap-1">
              {PALETA.map(([cod, t]) => (
                <button key={cod} title={t}
                  onClick={() => { guardarCeldas([{ driver_id: menu.p.id, fecha: menu.f, cod }]); setMenu(null) }}
                  className={`rounded-md py-1.5 text-[11px] font-bold ${claseCodigo(cod)} ${menu.c?.cod === cod ? 'ring-2 ring-brand-400' : ''}`}>
                  {ABREV[cod] || cod}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => { guardarCeldas([{ driver_id: menu.p.id, fecha: menu.f, cod: '' }]); setMenu(null) }}
                className="flex items-center gap-1 rounded-md border border-dark-700 px-2 py-1 text-[11px] text-dark-300 hover:bg-dark-800">
                <Eraser size={11} /> Vaciar
              </button>
              {menu.c?.fijada && (
                <button onClick={() => { guardarCeldas([{ driver_id: menu.p.id, fecha: menu.f, desbloquear: true }]); setMenu(null) }}
                  className="flex items-center gap-1 rounded-md border border-dark-700 px-2 py-1 text-[11px] text-dark-300 hover:bg-dark-800">
                  <Unlock size={11} /> Quitar candado
                </button>
              )}
            </div>
            {menu.c?.aprobado && (
              <p className="text-[10.5px] text-amber-300">Es un día concedido: si lo cambias, deja de ser el de su petición.</p>
            )}
            <p className="text-[10.5px] text-dark-500">Lo que pongas queda fijado: el motor no lo moverá.</p>
            </>)}
          </div>
        </div>
      )}

      {diaExtra && (
        <Modal titulo={`Día extra → libre · ${DIA[wd(diaExtra)]} ${fmt(diaExtra)}`} onCerrar={() => setDiaExtra(null)}>
          <div className="space-y-3 text-[13px] text-dark-300">
            <div className="flex flex-wrap gap-1">
              {dias.filter((f) => porDia[f]?.extras).map((f) => (
                <button key={f} onClick={() => setDiaExtra(f)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${f === diaExtra ? 'bg-pink-500/35 text-dark-50' : 'border border-dark-700 text-dark-300 hover:bg-dark-800'}`}>
                  {LETRA[wd(f)]} {fmt(f)} · {porDia[f].extras}
                </button>
              ))}
            </div>
            {(() => {
              const d = porDia[diaExtra] || {}
              const rosas = personas.filter((p) => celda(p.id, diaExtra)?.extra)
              return (
                <>
                  <p>
                    Ese día vais a <b className="text-dark-50">{signo(d.dif)}</b> (objetivo +{d.colchon}).
                    {rosas.length > 0 && d.dif != null && <> Cada libre que des lo baja en 1: con uno, quedáis a <b className="text-dark-50">{signo(d.dif - 1)}</b>.</>}
                  </p>
                  {rosas.length === 0 ? <p className="text-dark-500">Ese día no hay nadie en rosa.</p> : (
                    <ul className="space-y-1">
                      {rosas.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 rounded-lg border border-pink-400/30 px-3 py-1.5">
                          <span className="text-dark-100">{p.nombre}</span>
                          <button onClick={() => guardarCeldas([{ driver_id: p.id, fecha: diaExtra, cod: 'N/T' }], `${p.nombre} libra el ${fmt(diaExtra)}.`)}
                            disabled={mostrarProp}
                            className="ml-auto rounded-lg border border-dark-700 px-2.5 py-1 text-xs text-dark-200 hover:bg-dark-800 disabled:opacity-40">
                            Darle libre
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11.5px] text-dark-500">
                    Quitar un día rosa nunca provoca 7 días seguidos: esa persona vuelve a su semana de 5 + 2.
                    {mostrarProp && ' Primero acepta o descarta la propuesta.'}
                  </p>
                </>
              )
            })()}
          </div>
        </Modal>
      )}

      {asistente && datos && (
        <Asistente center={center} datos={datos} onCerrar={() => setAsistente(false)}
          onHecho={(p) => {
            setAsistente(false); setVerPropuesta(true)
            setAviso(`Propuesta lista: ${p?.n_cambios ?? 0} cambios y ${p?.extras ?? 0} días extra. Revísala y acéptala arriba.`)
            if (p?.desde && p?.hasta) setRango((r) => ({ desde: r.desde < p.desde ? r.desde : lunesDe(p.desde), hasta: r.hasta > p.hasta ? r.hasta : p.hasta }))
            cargar(true)
          }} />
      )}
      {persona && (
        <EditorPersona center={center} persona={persona} onCerrar={() => setPersona(null)}
          onGuardado={() => { setPersona(null); setAviso('Guardado. Se aplica al rehacer el cuadrante.'); cargar(true) }} />
      )}
      {nueva && (
        <NuevaPersona center={center} dentro={dentro} onCerrar={() => setNueva(false)}
          onGuardado={() => { setNueva(false); setAviso('Añadido al cuadrante.'); cargar(true) }} />
      )}
      {hojaAbierta && (
        <HojaCuadrante center={center} desde={rango.desde} hasta={rango.hasta}
          onCerrar={() => { setHojaAbierta(false); cargar(true) }} />
      )}

      {avisar && avisarActivo && (
        <AvisarConductores center={center} onCerrar={() => setAvisar(false)}
          onHecho={(r, { pedidos = 0 } = {}) => {
            setAvisar(false)
            const n = r?.avisados ?? 0
            const d = r?.descartados ?? 0
            // A quién no se avisó y por qué, con nombres (12-11-2026, X7); un servidor de antes no lo dice.
            const noAvisados = textoNoAvisados(r?.no_avisados)
            // Sin avisar a nadie, lo que pasó de verdad (11-11-2026, segunda ronda): se pidió avisar y no se pudo coger
            // ningún día (otra persona acababa de avisar, o cambiaron), o se quitó a todos de la lista.
            setAviso(n > 0
              ? `Avisado${n === 1 ? '' : 's'} ${n === 1 ? '1 conductor' : `${n} conductores`}: ${lista(r?.personas).map((p) => p.nombre).join(', ')}.${noAvisados ? ` ${noAvisados}` : ''}`
              : noAvisados
                ? noAvisados + (d > 0 ? ` ${d === 1 ? '1 conductor sale' : `${d} conductores salen`} de la lista hasta que su cuadrante cambie otra vez.` : '')
                : pedidos > 0
                  ? 'No se ha avisado a nadie: otra persona acababa de avisar de estos cambios, o han cambiado mientras tanto. Abre otra vez «Avisar a los conductores» para ver lo que quede.'
                  : d > 0
                    ? `No se ha avisado a nadie: ${d === 1 ? '1 conductor sale' : `${d} conductores salen`} de la lista hasta que su cuadrante cambie otra vez.`
                    : 'No se ha avisado a nadie y nadie ha salido de la lista: sus días han cambiado mientras tanto. Ábrela otra vez para verlos.')
          }} />
      )}

      {sheets && (
        <Modal titulo="Sincronizar con Google Sheets" onCerrar={() => { setSheets(false); cargar(true) }} ancho="max-w-3xl">
          <SincronizarSheets center={center} />
        </Modal>
      )}

      {importar && (
        <Importar center={center} centers={centers} setCenter={setCenter} onCerrar={() => setImportar(false)}
          onHecho={(r) => {
            setImportar(false)
            setAviso(`Hoja importada: ${r?.celdas ?? 0} celdas de ${r?.emparejadas ?? 0} personas` +
              (lista(r?.fichas_creadas).length ? `; fichas nuevas: ${r.fichas_creadas.join(', ')}` : '') +
              (r?.respetados ? `; ${r.respetados} días concedidos en la app se han respetado` : '') + '.')
            if (r?.desde) setRango({ desde: lunesDe(hoyLocal()) < r.desde ? r.desde : lunesDe(hoyLocal()), hasta: r.hasta })
            cargar(true)
          }} />
      )}
    </div>
  )
}
