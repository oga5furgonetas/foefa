import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Columns2, EyeOff, Loader2, SquareSplitHorizontal, Undo2 } from 'lucide-react'
import { useT, LANG_LOCALE } from '../../i18n'
import { getRepasoDia, marcarRepaso, deshacerRepaso } from '../../services/api'
import Matricula from '../../components/Matricula'
import Pareja from '../components/repaso/Pareja'
import Ampliar from '../components/repaso/Ampliar'
import FormGolpe from '../components/repaso/FormGolpe'
import Terminado from '../components/repaso/Terminado'
import ElegirDia from '../components/repaso/ElegirDia'
import { YaApuntado, ResumenDia } from '../components/repaso/Lateral'
import {
  nombreLado, nombreLadoCorto, nombrePieza, porRepasar, cuentasDelDia, golpesNuevosDelDia, siguienteFoco, primerFoco, ladoVecino,
  fechaDeSello, sumarDias, fechaLarga, horaDe, hoyLocal, conLado, cuerpoGolpe, textoDeError,
} from '../components/repaso/logica'

/* EL REPASO DEL DÍA (14-11-2026, «Antes del perito»).
   ─────────────────────────────────────────────────────────────────────────
   Cada tarde, quien lleva la flota mira las revisiones que han llegado hoy: por cada lado de cada furgoneta, la foto
   de hoy junto a la anterior del mismo lado, y decide él (nadie más) si está igual, si hay un golpe nuevo o si la foto
   no deja verlo. Un toque o una tecla por lado; con 48 furgonetas tiene que salir en unos minutos.
   Lo que se decide aquí es lo único que sale en el expediente de la furgoneta: por eso aquí no hay nada automático.
   El servidor: `GET /repaso/dia`, `POST` y `DELETE /inspections/{id}/repaso` (CONTRATO «Antes del perito», §A y §B).

   Mientras se guarda un veredicto se puede seguir mirando (otro lado, otra furgoneta, otro día): la respuesta solo
   mueve la pantalla si quien repasa sigue donde pulsó, y si ya está en otro día no toca ese día: dice que se guardó. */

const MODO = 'repaso_modo'
const leerModo = () => { try { return localStorage.getItem(MODO) === 'deslizador' ? 'deslizador' : 'juntas' } catch { return 'juntas' } }
const GOLPE_VACIO = { caja: null, pieza: '', piezaClave: null, gravedad: null, nota: '' }
const conAlgo = (g) => !!g && !!(g.caja || g.piezaClave || g.pieza.trim() || g.gravedad || g.nota.trim())
// Lo marcado en un lado, en palabras: en un lado sin foto anterior, «igual» es «sin golpes a la vista».
const textoEstado = (t, veredicto, sinAnterior) => (!veredicto ? t('repaso.est.sinver')
  : veredicto === 'igual' && sinAnterior ? t('repaso.est.singolpes') : t(`repaso.est.${veredicto}`))
// Con el foco en un control, las teclas son suyas (una pestaña, un botón, un enlace); salvo donde se diga lo contrario.
const ES_CONTROL = 'button, a[href], select, summary, [role="tab"], [role="tablist"], [role="button"], [role="slider"]'

function Tecla({ k, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="inline-flex min-w-[22px] items-center justify-center rounded-[5px] border border-b-2 border-dark-700 bg-dark-900 px-1.5 font-mono text-[11.5px] leading-[18px] text-dark-100">{k}</kbd>
      {children}
    </span>
  )
}

// La marca de cada pestaña de lado: nada si está sin ver; ✓ igual; un punto rojo, golpe; un ojo tachado, no se ve.
function MarcaLado({ veredicto, activo }) {
  if (veredicto === 'igual') return <Check size={14} strokeWidth={3} className={activo ? '' : 'text-ruta-ok-texto'} aria-hidden="true" />
  if (veredicto === 'golpe') return <span className={`h-2 w-2 rounded-full ${activo ? 'bg-current' : 'bg-ruta-peligro-texto'}`} aria-hidden="true" />
  if (veredicto === 'no_se_ve') return <EyeOff size={14} className={activo ? '' : 'text-ruta-aviso-texto'} aria-hidden="true" />
  return null
}

export default function Repaso() {
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  const ctx = useOutletContext() || {}
  const center = ctx.center || 'Todos'
  const setAvisoRepaso = ctx.setAvisoRepaso

  const [fecha, setFecha] = useState(null)          // null = hoy (lo decide el servidor)
  const [hoy, setHoy] = useState(null)              // el «hoy» del servidor, en cuanto lo dice
  const [carga, setCarga] = useState({ estado: 'cargando' })
  const [dia, setDia] = useState(null)
  const [foco, setFoco] = useState(null)            // { r: id de revisión, k: photo_index } | null
  const [modo, setModo] = useState(leerModo)
  const [golpe, setGolpe] = useState(null)          // el golpe que se está apuntando, o null
  const [borrador, setBorrador] = useState(null)    // { r, k, valor }: lo apuntado de un golpe que se cerró sin guardar
  const [ampliada, setAmpliada] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)          // { tono: 'error' | 'info', texto }
  const [pila, setPila] = useState([])              // lo decidido en esta sesión, para «Deshacer»
  const [rotas, setRotas] = useState(() => new Set())   // las fotos que no han cargado (por su dirección)
  const diaRef = useRef(null)
  diaRef.current = dia
  const focoRef = useRef(null)
  focoRef.current = foco
  // El día que se está mirando: cambia justo cuando se pide otro día u otro centro.
  const claveRef = useRef('')
  claveRef.current = `${fecha || ''}|${center}`
  const pedida = useRef(0)
  const mesaRef = useRef(null)
  const lista = useRef(null)

  const cargar = useCallback((silencio = false) => {
    const n = ++pedida.current
    if (!silencio) setCarga({ estado: 'cargando' })
    getRepasoDia(fecha, center)
      .then((r) => {
        if (n !== pedida.current) return
        const d = r.data && typeof r.data === 'object' ? r.data : {}
        const limpio = { ...d, revisiones: Array.isArray(d.revisiones) ? d.revisiones : [], sin_revision: Array.isArray(d.sin_revision) ? d.sin_revision : [] }
        setDia(limpio)
        if (limpio.es_hoy && limpio.fecha) setHoy(limpio.fecha)
        setCarga({ estado: 'ok' })
        setFoco((f) => {
          // Al recargar en silencio (otro ha decidido un lado a la vez) se sigue donde se estaba.
          if (silencio && f && limpio.revisiones.some((x) => x.id === f.r)) return f
          return primerFoco(limpio.revisiones)
        })
      })
      .catch((e) => {
        if (n !== pedida.current) return
        if (silencio) { setAviso({ tono: 'error', texto: textoDeError(t, e) }); return }
        setCarga({ estado: 'error', texto: textoDeError(t, e), red: !e?.response })
      })
  }, [fecha, center, t])

  useEffect(() => {
    setGolpe(null); setBorrador(null); setAmpliada(false); setAviso(null); setPila([]); setDia(null); setFoco(null)
    cargar()
  }, [cargar])

  // El número del menú: las revisiones de HOY que quedan por repasar, en cuanto cambian.
  const cuentas = useMemo(() => cuentasDelDia(dia), [dia])
  useEffect(() => {
    if (dia?.es_hoy && setAvisoRepaso) setAvisoRepaso(cuentas.porRepasar)
  }, [dia, cuentas.porRepasar, setAvisoRepaso])

  /* Terminado y sin golpes nuevos: el siguiente paso es el día anterior, si quedó algo por repasar. Se mira SOLO ese
     día (las revisiones viejas sin repasar no son deuda) y sin tocar la pantalla: si no hay nada, no se dice nada. */
  const [anterior, setAnterior] = useState(null)   // { de: 'fecha|centro' del día terminado, fecha: la del anterior }
  const acabado = !!dia?.fecha && !foco && (dia.revisiones || []).some((r) => r.lados?.length)
    && !(dia.revisiones || []).some((r) => r.lados?.length && porRepasar(r)) && !golpesNuevosDelDia(dia).length
  const deAcabado = acabado ? `${dia.fecha}|${center}` : ''
  useEffect(() => {
    if (!deAcabado) return undefined
    let vale = true
    const previo = sumarDias(deAcabado.split('|')[0], -1)
    getRepasoDia(previo, center)
      .then((r) => { if (vale && cuentasDelDia(r.data).porRepasar > 0) setAnterior({ de: deAcabado, fecha: previo }) })
      .catch(() => { /* sin el día anterior, no se ofrece: no es un error de este día */ })
    return () => { vale = false }
  }, [deAcabado]) // eslint-disable-line react-hooks/exhaustive-deps

  const revs = dia?.revisiones || []
  const ri = foco ? revs.findIndex((r) => r.id === foco.r) : -1
  const rev = ri >= 0 ? revs[ri] : null
  const lado = rev ? rev.lados.find((l) => l.photo_index === foco.k) || null : null
  const conLados = revs.filter((r) => r.lados?.length)
  const esHoy = !!dia?.es_hoy
  // Sin la foto de hoy no hay dónde dibujar la caja de un golpe.
  const hoyRota = !!lado && (!lado.foto_url || rotas.has(lado.foto_url))

  // Lo que se enseña de cada foto: la de hoy con la fecha del día y la hora de llegada; la anterior, con la suya.
  const fotoHoy = rev && dia ? { fecha: fechaDeSello(dia.fecha, rev.hora, rev.recibida_at), quien: rev.conductor?.nombre || '' } : null
  const fotoAntes = lado?.anterior ? {
    url: lado.anterior.foto_url,
    fecha: fechaDeSello(lado.anterior.fecha, lado.anterior.hora, lado.anterior.recibida_at),
    quien: lado.anterior.conductor?.nombre || '',
  } : null

  /* RÁPIDA: las dos fotos del lado que viene después ya se piden mientras se mira este. */
  useEffect(() => {
    if (!dia || !foco) return
    const sig = siguienteFoco(revs, foco)
    const r = sig && revs.find((x) => x.id === sig.r)
    const l = r?.lados.find((x) => x.photo_index === sig.k)
    for (const u of [l?.foto_url, l?.anterior?.foto_url]) {
      if (u) { const img = new Image(); img.src = u }
    }
  }, [dia, foco]) // eslint-disable-line react-hooks/exhaustive-deps

  /* La pestaña elegida, siempre a la vista: si la fila de lados se desliza (un idioma largo en el móvil), se mueve
     SOLO la fila, nunca la página (scrollIntoView movería también la página hacia arriba). */
  useEffect(() => {
    const fila = lista.current
    const el = fila?.querySelector('[aria-selected="true"]')
    if (!fila || !el || fila.scrollWidth <= fila.clientWidth) return
    const izq = el.offsetLeft - 4
    const der = el.offsetLeft + el.offsetWidth + 4
    if (izq < fila.scrollLeft) fila.scrollLeft = izq
    else if (der > fila.scrollLeft + fila.clientWidth) fila.scrollLeft = der - fila.clientWidth
  }, [foco, dia])

  // Tras decidir, el foco del teclado vuelve a la mesa (si estaba en ella o en ninguna parte), para seguir con teclas.
  const enfocarMesa = () => {
    const a = document.activeElement
    if (!a || a === document.body || mesaRef.current?.contains(a)) mesaRef.current?.focus({ preventScroll: true })
  }

  // Lo apuntado de un golpe sin guardar no se pierde al irse a otro lado: queda como borrador de su lado.
  const apartarGolpe = () => {
    if (golpe && conAlgo(golpe) && focoRef.current) setBorrador({ ...focoRef.current, valor: golpe })
    setGolpe(null)
  }
  const irA = (r, k) => { apartarGolpe(); setAmpliada(false); setFoco({ r, k }) }

  function aplicarRespuesta(d0, revId, ladoNuevo, libro) {
    let d = conLado(d0, revId, ladoNuevo)
    const r = d.revisiones.find((x) => x.id === revId)
    const g = ladoNuevo.golpe
    /* El golpe recién apuntado entra en «Ya apuntado» de esa furgoneta (en todas sus revisiones del día). También
       con «ya_apuntado»: el servidor da una fila por GOLPE (CONTRATO M3), con el mismo `ledger_id` que la entrada que
       ya estaba; así no se vuelve a marcar al día siguiente. */
    if (g && libro && (libro.accion === 'nuevo' || libro.accion === 'sustituye_ia' || libro.accion === 'ya_apuntado')) {
      const entrada = {
        ledger_id: libro.ledger_id ?? null, golpe_id: g.golpe_id, pieza: g.pieza, pieza_clave: g.pieza_clave ?? null,
        panel: g.panel, gravedad: g.gravedad, desde: d.fecha, inspection_id: revId, vista: ladoNuevo.vista,
        origen: 'repaso', en_taller: false, de_esta_revision: true, foto_url: ladoNuevo.foto_url ?? null, box_2d: g.box_2d ?? null,
      }
      d = { ...d, revisiones: d.revisiones.map((x) => (x.vehiculo?.id !== r?.vehiculo?.id ? x : {
        ...x, ya_apuntado: [entrada, ...(x.ya_apuntado || []).filter((a) => a.golpe_id !== g.golpe_id)],
      })) }
    }
    return d
  }

  async function responder(veredicto, cuerpo = null) {
    if (!rev || !lado || ocupado) return
    const clave = claveRef.current
    const desde = { r: rev.id, k: lado.photo_index }
    const sinAnterior = !lado.anterior
    const quePone = { matricula: rev.vehiculo?.matricula, lado: nombreLado(t, lado) }
    setOcupado(true); setAviso(null)
    try {
      const res = await marcarRepaso(rev.id, cuerpo || { photo_index: lado.photo_index, veredicto })
      const nuevo = res.data?.lado || { veredicto }
      const libro = res.data?.libro || null
      const v = nuevo.veredicto || veredicto
      const d0 = diaRef.current
      // Quien repasa ya está en otro día (o en otro centro): ese día no se toca; se dice que lo de antes se guardó.
      if (claveRef.current !== clave || !d0) {
        setAviso({ tono: 'info', texto: t('repaso.guardado.otrodia').replace('{lado}', quePone.lado)
          .replace('{matricula}', quePone.matricula || '—').replace('{veredicto}', textoEstado(t, v, sinAnterior)) })
        return
      }
      const d = aplicarRespuesta(d0, desde.r, { ...nuevo, photo_index: desde.k }, libro)
      setDia(d)
      setPila((p) => [...p, { ...desde, veredicto: v, sinAnterior, matricula: quePone.matricula, lado: quePone.lado }])
      if (libro?.accion === 'ya_apuntado') {
        setAviso({ tono: 'info', texto: t('repaso.libro.yaapuntado').replace('{pieza}', nombrePieza(t, libro.pieza_clave, libro.pieza) || '—') })
      }
      setBorrador((b) => (b && b.r === desde.r && b.k === desde.k ? null : b))
      // Solo se avanza si sigue donde pulsó: si mientras guardaba se fue a otro lado, se queda allí.
      const f = focoRef.current
      if (f && f.r === desde.r && f.k === desde.k) {
        setGolpe(null); setAmpliada(false)
        setFoco(siguienteFoco(d.revisiones, desde))
        enfocarMesa()
      }
    } catch (e) {
      setAviso({ tono: 'error', texto: textoDeError(t, e) })
      // Otra persona lo ha decidido a la vez, o la revisión ya no está: se trae lo que hay ahora.
      const st = e?.response?.status
      if ((st === 409 || st === 404) && claveRef.current === clave) cargar(true)
    } finally {
      setOcupado(false)
    }
  }

  async function deshacer(objetivo) {
    if (!objetivo || ocupado) return
    const clave = claveRef.current
    setOcupado(true); setAviso(null)
    try {
      const res = await deshacerRepaso(objetivo.r, objetivo.k)
      const accion = res.data?.libro?.accion
      let d = diaRef.current
      if (claveRef.current !== clave || !d) return
      const r0 = d.revisiones.find((x) => x.id === objetivo.r)
      const l0 = r0?.lados.find((x) => x.photo_index === objetivo.k)
      const golpeId = l0?.golpe?.golpe_id
      d = conLado(d, objetivo.r, { photo_index: objetivo.k, veredicto: null, veredicto_por: null, veredicto_at: null, golpe: null })
      /* La fila de ese golpe sale de «Ya apuntado» sea cual sea lo que hizo el libro (CONTRATO M3/M4: una fila por
         golpe). Con «pasa_a_otro» la entrada pasa a otro golpe y con «queda_revision_rapida» se queda con lo que
         confirmó otra persona: esas filas las sabe el servidor, así que el día se vuelve a pedir sin moverse de aquí. */
      if (golpeId) {
        d = { ...d, revisiones: d.revisiones.map((x) => ({ ...x, ya_apuntado: (x.ya_apuntado || []).filter((a) => a.golpe_id !== golpeId) })) }
      }
      setDia(d)
      setPila((p) => p.filter((x) => !(x.r === objetivo.r && x.k === objetivo.k)))
      irA(objetivo.r, objetivo.k)
      enfocarMesa()
      if (accion === 'pasa_a_otro' || accion === 'queda_revision_rapida') cargar(true)
    } catch (e) {
      setAviso({ tono: 'error', texto: textoDeError(t, e) })
      /* Otra persona ya lo deshizo (404) o el golpe pasó al taller (409): lo de la pantalla ya no es verdad. Se trae
         el día como está y ese lado sale de «Lo último», que ya no se puede deshacer desde aquí. */
      const st = e?.response?.status
      if ((st === 404 || st === 409) && claveRef.current === clave) {
        setPila((p) => p.filter((x) => !(x.r === objetivo.r && x.k === objetivo.k)))
        cargar(true)
      }
    } finally {
      setOcupado(false)
    }
  }

  const abrirGolpe = () => {
    if (!lado || lado.veredicto || ocupado || hoyRota) return
    setAmpliada(false); setAviso(null)
    const b = borrador && foco && borrador.r === foco.r && borrador.k === foco.k ? borrador.valor : null
    setGolpe(b ? { ...b } : { ...GOLPE_VACIO })
  }
  const cancelarGolpe = () => {
    setGolpe(null)
    setBorrador((b) => (b && foco && b.r === foco.r && b.k === foco.k ? null : b))
  }
  const elegirModo = (m) => { setModo(m); try { localStorage.setItem(MODO, m) } catch { /* modo privado */ } }
  const ladoAnterior = () => { const v = ladoVecino(rev, lado?.photo_index, -1); if (v) irA(rev.id, v.photo_index) }
  const ladoSiguiente = () => {
    const v = ladoVecino(rev, lado?.photo_index, 1)
    if (v) { irA(rev.id, v.photo_index); return }
    const sig = siguienteFoco(revs, foco)
    if (sig) irA(sig.r, sig.k)
    else setFoco(null)
  }
  const marcarRota = (url) => setRotas((s) => (s.has(url) ? s : new Set(s).add(url)))

  /* LAS PESTAÑAS DE LOS LADOS, como pide una lista de pestañas: un solo punto de tabulación (la elegida) y las flechas,
     Inicio y Fin para ir de una a otra. Con el foco en ellas, las flechas son suyas: no deciden nada. */
  const teclaPestanas = (e) => {
    if (!rev || !lado) return
    const lados = rev.lados
    const i = lados.findIndex((l) => l.photo_index === lado.photo_index)
    let j = null
    if (e.key === 'ArrowRight') j = (i + 1) % lados.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + lados.length) % lados.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = lados.length - 1
    if (j === null) return
    e.preventDefault(); e.stopPropagation()
    const k = lados[j].photo_index
    irA(rev.id, k)
    setTimeout(() => lista.current?.querySelector(`[data-testid="lado-${k}"]`)?.focus(), 0)
  }

  /* EL TECLADO, para quien repasa desde el ordenador: → o Intro, está igual (o al siguiente lado si ya está decidido);
     G, golpe nuevo; N, no se ve; ←, el lado anterior; Z, ampliar; Esc cierra. Nada de esto con Ctrl, Alt o ⌘ (son
     atajos del navegador), ni mientras se escribe en un campo (allí Esc solo suelta el campo), ni con el foco en un
     botón, una pestaña o un enlace (las teclas son suyas). Con la vista ampliada abierta, solo Esc y Z, que la cierran. */
  useEffect(() => {
    const h = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target
      const tag = el?.tagName
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (ampliada) {
        if (k === 'Escape' || k === 'z') { e.preventDefault(); setAmpliada(false) }
        return
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) {
        if (k === 'Escape') { e.preventDefault(); el.blur() }
        return
      }
      if (k === 'Escape') {
        if (golpe) { e.preventDefault(); apartarGolpe() }
        return
      }
      if (golpe || !lado || ocupado) return
      // En un control solo valen las teclas que no deciden nada (ampliar y abrir el golpe).
      if (el && el !== document.body && el.closest?.(ES_CONTROL) && !el.closest('[data-atajos]') && k !== 'z' && k !== 'g') return
      if (k === 'ArrowRight' || k === 'Enter') {
        e.preventDefault()
        if (lado.veredicto) ladoSiguiente()
        else responder('igual')
      } else if (k === 'ArrowLeft') {
        e.preventDefault(); ladoAnterior()
      } else if (k === 'g') {
        e.preventDefault(); abrirGolpe()
      } else if (k === 'n') {
        if (!lado.veredicto) { e.preventDefault(); responder('no_se_ve') }
      } else if (k === 'z') {
        e.preventDefault(); setAmpliada(true)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  })

  /* ── Cabecera: el día, el selector y el avance ── */
  const hoyTope = hoy || hoyLocal()
  const fechaDia = dia?.fecha || fecha || null
  const irDia = (f) => { if (!f) return; setFecha(hoy && f === hoy ? null : f) }
  const cabecera = (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-dark-50">
          {fechaDia && !esHoy && carga.estado !== 'cargando'
            ? t('repaso.titulo.dia').replace('{fecha}', fechaLarga(fechaDia, locale, false))
            : t('repaso.titulo.hoy')}
        </h1>
        {fechaDia && (esHoy || carga.estado === 'cargando') && <p className="mt-0.5 text-sm text-dark-400 first-letter:uppercase">{fechaLarga(fechaDia, locale)}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:w-auto sm:justify-end sm:gap-x-5">
        {conLados.length > 0 && (
          <div className="flex items-center gap-3" data-testid="avance"
            aria-label={t('repaso.avance').replace('{a}', cuentas.repasadas).replace('{b}', cuentas.revisiones)}>
            <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-dark-800 min-[400px]:w-24 sm:w-40">
              <span className="block h-full bg-dark-50" style={{ width: `${cuentas.revisiones ? (cuentas.repasadas / cuentas.revisiones) * 100 : 0}%` }} />
            </span>
            <b className="font-mono text-sm font-semibold tabular-nums text-dark-50">{cuentas.repasadas} / {cuentas.revisiones}</b>
          </div>
        )}
        {fechaDia && <div className="flex items-center gap-1.5">
          <ElegirDia t={t} locale={locale} fecha={fechaDia} tope={hoyTope} esHoy={esHoy} onIr={irDia} />
          {fecha && (
            <button type="button" onClick={() => setFecha(null)}
              className="h-9 rounded-lg px-2.5 text-sm font-semibold text-dark-200 underline-offset-4 hover:underline">
              {t('repaso.dia.hoy')}
            </button>
          )}
        </div>}
      </div>
    </div>
  )

  /* ── Cargando, error, vacío ── */
  let cuerpo
  if (carga.estado === 'cargando' && !dia) {
    cuerpo = (
      <div className="flex items-center gap-3 py-16 text-dark-400" role="status">
        <Loader2 size={18} className="animate-spin" /> {t('repaso.cargando')}
      </div>
    )
  } else if (carga.estado === 'error') {
    cuerpo = (
      <div className="mt-6 max-w-xl rounded-xl border border-dark-700 bg-dark-900 p-5" role="alert" data-testid="repaso-error">
        <h2 className="text-[17px] font-bold text-dark-50">{carga.red ? t('repaso.err.red.tit') : t('repaso.err.tit')}</h2>
        <p className="mt-1 text-[15px] text-dark-300">{carga.texto}</p>
        <button type="button" onClick={() => cargar()}
          className="mt-4 h-11 rounded-xl border border-ruta-borde px-5 text-[15px] font-semibold text-dark-50 hover:bg-dark-800">
          {t('repaso.reintentar')}
        </button>
      </div>
    )
  }

  const golpesDia = golpesNuevosDelDia(dia)
  const terminado = dia && !foco && conLados.length > 0 && !conLados.some(porRepasar)
  const sinNada = dia && conLados.length === 0

  const avisoEl = aviso && (
    <p role={aviso.tono === 'error' ? 'alert' : 'status'} data-testid="repaso-aviso"
      className={`mt-3 border-l-[3px] pl-3 text-sm ${aviso.tono === 'error' ? 'border-ruta-peligro-texto text-ruta-peligro-texto' : 'border-dark-400 text-dark-200'}`}>
      {aviso.texto}
    </p>
  )

  // La mesa: la revisión que se mira, el día terminado o el día sin revisiones.
  const ultimo = pila[pila.length - 1]
  let mesa = null
  let avisoEnMesa = false
  if (!cuerpo && sinNada) {
    mesa = (
      <div className="rounded-xl border border-dark-700 bg-dark-900 p-5 md:p-7" data-testid="repaso-vacio">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-dark-50">{esHoy ? t('repaso.vacio.hoy.tit') : t('repaso.vacio.dia.tit')}</h2>
        <p className="mt-1.5 max-w-xl text-[15px] text-dark-300">{esHoy ? t('repaso.vacio.hoy') : t('repaso.vacio.dia')}</p>
        {cuentas.sinLados > 0 && <p className="mt-3 text-sm text-dark-400">{t('repaso.sinlados.nota').replace('{n}', cuentas.sinLados)}</p>}
      </div>
    )
  } else if (!cuerpo && terminado) {
    mesa = (
      <Terminado t={t} locale={locale} esHoy={esHoy} cuentas={cuentas} golpes={golpesDia}
        anterior={anterior && anterior.de === `${dia.fecha}|${center}` ? anterior.fecha : null}
        onAbrir={(r, k) => irA(r, k)} onIrDia={irDia}
        onRevisar={() => { const r = conLados[0]; if (r) irA(r.id, r.lados[0].photo_index) }} />
    )
  } else if (!cuerpo && rev && lado) {
    avisoEnMesa = true
    const sinAnterior = !lado.anterior
    const partida = sinAnterior && !!lado.vista
    const nombre = nombreLado(t, lado)
    const quienDecidio = lado.veredicto_por || ''
    const horaDecidio = horaDe(lado.veredicto_at, locale)
    const textoHecho = lado.veredicto === 'igual' ? (sinAnterior ? 'repaso.hecho.partida' : 'repaso.hecho.igual')
      : lado.veredicto === 'golpe' ? 'repaso.hecho.golpe' : 'repaso.hecho.nosevee'
    const idxRev = conLados.findIndex((r) => r.id === rev.id)

    mesa = (
      <div className="min-w-0 focus:outline-none" data-testid="mesa" ref={mesaRef} tabIndex={-1}>
        {/* La furgoneta: matrícula, modelo, quién la llevaba y cuándo llegó la revisión; a la derecha, el paso. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-nowrap">
          {rev.vehiculo?.matricula
            ? <Matricula texto={rev.vehiculo.matricula} className="shrink-0 text-[22px]" />
            : <span className="shrink-0 text-[17px] font-semibold text-dark-50">{t('repaso.sinmatricula')}</span>}
          <p className="order-last w-full min-w-0 text-[15px] text-dark-400 md:order-none md:w-auto md:flex-1">
            {rev.vehiculo?.modelo ? <span>{rev.vehiculo.modelo} · </span> : null}
            {rev.conductor
              ? (rev.conductor.nombre
                ? <span>{t('repaso.llevo.a')} <b className="font-semibold text-dark-50">{rev.conductor.nombre}</b></span>
                : <span>{t('repaso.conductor.borrado')}</span>)
              : <span>{t('repaso.sin.conductor')}</span>}
            {rev.hora ? <span className="whitespace-nowrap"> · {t('repaso.recibida').replace('{hora}', rev.hora)}</span> : null}
          </p>
          {conLados.length > 1 && (
            <div className="ml-auto flex shrink-0 items-center gap-1" data-testid="paso">
              <button type="button" aria-label={t('repaso.rev.anterior')} title={t('repaso.rev.anterior')}
                disabled={idxRev <= 0} onClick={() => { const r = conLados[idxRev - 1]; irA(r.id, (r.lados.find((l) => !l.veredicto) || r.lados[0]).photo_index) }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 disabled:opacity-30">
                <ChevronLeft size={17} />
              </button>
              <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-dark-400">
                {t('repaso.rev.de').replace('{a}', idxRev + 1).replace('{b}', conLados.length)}
              </span>
              <button type="button" aria-label={t('repaso.rev.siguiente')} title={t('repaso.rev.siguiente')}
                disabled={idxRev >= conLados.length - 1} onClick={() => { const r = conLados[idxRev + 1]; irA(r.id, (r.lados.find((l) => !l.veredicto) || r.lados[0]).photo_index) }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 disabled:opacity-30">
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>

        {/* Los lados, con lo que ya se ha decidido de cada uno; a la derecha, cómo ver las dos fotos. Siempre en UNA
            línea: en el móvil los laterales van con su nombre corto («Izquierdo», «Derecho»), y si aun así no caben
            (un idioma largo) la fila se desliza y la pestaña elegida se trae a la vista. */}
        <div className="mt-4 flex items-start gap-3">
          <div ref={lista} className="relative -mx-1 flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden"
            role="tablist" aria-label={t('repaso.lados')} onKeyDown={teclaPestanas} data-testid="lados">
            {rev.lados.map((l) => {
              const activo = l.photo_index === lado.photo_index
              const estado = textoEstado(t, l.veredicto, !l.anterior)
              const corto = nombreLadoCorto(t, l)
              return (
                <button key={l.photo_index} type="button" role="tab" aria-selected={activo} tabIndex={activo ? 0 : -1}
                  title={estado} aria-label={`${nombreLado(t, l)}: ${estado}`}
                  data-testid={`lado-${l.photo_index}`} data-veredicto={l.veredicto || ''}
                  onClick={() => irA(rev.id, l.photo_index)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${activo
                    ? 'border-dark-50 bg-dark-50 text-dark-950'
                    : l.veredicto ? 'border-dark-700 text-dark-400 hover:bg-dark-800' : 'border-ruta-borde/60 bg-dark-900 text-dark-100 hover:bg-dark-800'}`}>
                  <MarcaLado veredicto={l.veredicto} activo={activo} />
                  <span className="sm:hidden">{corto}</span>
                  <span className="hidden sm:inline">{nombreLado(t, l)}</span>
                </button>
              )
            })}
          </div>
          {fotoAntes && !golpe && (
            <div className="hidden shrink-0 items-center rounded-lg border border-dark-700 p-0.5 sm:flex" role="group" aria-label={t('repaso.modo')}>
              {[['juntas', Columns2], ['deslizador', SquareSplitHorizontal]].map(([m, Icono]) => (
                <button key={m} type="button" aria-pressed={modo === m} onClick={() => elegirModo(m)}
                  aria-label={t(`repaso.modo.${m}`)} title={t(`repaso.modo.${m}`)}
                  className={`flex h-8 w-9 items-center justify-center rounded-md ${modo === m ? 'bg-dark-800 text-dark-50' : 'text-dark-400 hover:text-dark-100'}`}>
                  <Icono size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Las dos fotos. */}
        <div className="mt-3">
          {sinAnterior && (
            <p className="mb-2.5 text-[15px] text-dark-200" data-testid="sin-anterior">
              {lado.vista ? t('repaso.sinant.texto') : t('repaso.sinvista.texto')}
            </p>
          )}
          <Pareja t={t} idioma={lang} lado={lado} hoy={fotoHoy} antes={fotoAntes} modo={modo}
            dibujar={!!golpe} caja={golpe ? golpe.caja : (lado.golpe?.box_2d || null)}
            onCaja={(c) => setGolpe((g) => (g ? { ...g, caja: c } : g))}
            onFallo={marcarRota}
            onAmpliar={() => setAmpliada(true)} />
          {hoyRota && !lado.veredicto && (
            <p className="mt-2.5 text-sm text-dark-300" data-testid="hoy-rota">{t('repaso.foto.fallo.golpe')}</p>
          )}
        </div>

        {avisoEl}

        {/* Las respuestas. */}
        <div className="mt-4">
          {golpe ? (
            <FormGolpe t={t} vista={lado.vista} valor={golpe} ocupado={ocupado} sinFoto={hoyRota}
              titulo={(partida ? t('repaso.golpe.titulo.partida') : t('repaso.golpe.titulo')).replace('{lado}', nombre)}
              onCambio={(c) => setGolpe((g) => ({ ...g, ...c }))}
              onCancelar={cancelarGolpe}
              onGuardar={() => responder('golpe', cuerpoGolpe(lado.photo_index, golpe))} />
          ) : lado.veredicto ? (
            <div className="flex flex-col gap-3 rounded-xl border border-dark-700 bg-dark-900 p-4 sm:flex-row sm:items-center" data-testid="decidido">
              <div className="min-w-0 flex-1 text-[15px] text-dark-100">
                <p>{t(textoHecho).replace('{quien}', quienDecidio || '—').replace('{hora}', horaDecidio || '—')}</p>
                {lado.golpe && (
                  <p className="mt-1 text-sm text-dark-400">
                    <b className="font-semibold text-dark-50">{nombrePieza(t, lado.golpe.pieza_clave, lado.golpe.pieza)}</b>
                    {lado.golpe.gravedad ? ` · ${t(`repaso.grav.${lado.golpe.gravedad}`)}` : ''}
                    {lado.golpe.descripcion ? ` · ${lado.golpe.descripcion}` : ''}
                    {lado.golpe.ya_estaba ? <span className="block">{t('repaso.hecho.yaestaba')}</span> : null}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => deshacer({ r: rev.id, k: lado.photo_index })} disabled={ocupado}
                  className="flex h-11 items-center gap-2 rounded-xl border border-ruta-borde px-4 text-sm font-semibold text-dark-50 hover:bg-dark-800 disabled:opacity-50">
                  <Undo2 size={15} /> {t('repaso.deshacer')}
                </button>
                <button type="button" onClick={() => { ladoSiguiente(); enfocarMesa() }}
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-dark-50 px-4 text-sm font-semibold text-dark-950">
                  {t('repaso.siguiente')} <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                <button type="button" onClick={() => responder('no_se_ve')} disabled={ocupado}
                  title={t('repaso.nosevee.ayuda')}
                  className="h-[52px] rounded-xl px-4 text-[15px] font-semibold text-dark-200 hover:bg-dark-800 disabled:opacity-50 sm:order-1">
                  {t('repaso.btn.nosevee')}
                </button>
                <button type="button" onClick={abrirGolpe} disabled={ocupado || hoyRota}
                  title={hoyRota ? t('repaso.foto.fallo.golpe') : undefined}
                  className={`h-[52px] whitespace-nowrap rounded-xl border-[1.5px] px-3 text-[15px] font-bold disabled:cursor-not-allowed sm:order-2 sm:px-5 ${hoyRota
                    ? 'border-dark-800 bg-dark-800 text-dark-400'
                    : 'border-ruta-peligro-texto text-ruta-peligro-texto hover:bg-dark-800 disabled:opacity-50'}`}>
                  {sinAnterior ? t('repaso.btn.tienegolpe') : t('repaso.btn.golpe')}
                </button>
                <button type="button" onClick={() => responder('igual')} disabled={ocupado} data-testid="btn-igual"
                  className="order-first col-span-2 flex h-[52px] items-center justify-center gap-2 rounded-xl bg-brand-400 px-6 text-[15px] font-bold text-brand-tinta disabled:opacity-60 sm:order-3">
                  {ocupado && <Loader2 size={16} className="animate-spin" />}
                  {sinAnterior ? t('repaso.btn.singolpes') : t('repaso.btn.igual')}
                </button>
              </div>
              <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-dark-400 md:flex sm:justify-end" data-testid="teclas">
                <Tecla k="→">{sinAnterior ? t('repaso.teclas.singolpes') : t('repaso.teclas.igual')}</Tecla>
                <Tecla k="G">{sinAnterior ? t('repaso.teclas.tienegolpe') : t('repaso.teclas.golpe')}</Tecla>
                <Tecla k="N">{t('repaso.teclas.nosevee')}</Tecla>
                <Tecla k="←">{t('repaso.teclas.anterior')}</Tecla>
                <Tecla k="Z">{t('repaso.teclas.ampliar')}</Tecla>
              </div>
            </div>
          )}
        </div>

        {ampliada && (
          <Ampliar t={t} idioma={lang} matricula={rev.vehiculo?.matricula} nombre={nombre} lado={lado} hoy={fotoHoy} antes={fotoAntes}
            onCerrar={() => setAmpliada(false)} />
        )}
      </div>
    )
  }

  // «Ya apuntado»: si el servidor no trae la foto del golpe, la de una revisión que esté en pantalla.
  const miniatura = (a) => {
    for (const r of revs) {
      if (r.id !== a.inspection_id) continue
      const l = r.lados.find((x) => x.vista && x.vista === a.vista && (!a.golpe_id || x.golpe?.golpe_id === a.golpe_id)) || r.lados.find((x) => x.vista && x.vista === a.vista)
      if (l) return { url: l.foto_url, caja: l.golpe?.golpe_id === a.golpe_id ? l.golpe?.box_2d : null }
    }
    for (const l of rev?.lados || []) {
      if (l.anterior && l.anterior.inspection_id === a.inspection_id && l.vista && l.vista === a.vista) return { url: l.anterior.foto_url, caja: null }
    }
    return null
  }

  return (
    <div className="mx-auto max-w-[1440px]" data-testid="repaso">
      {cabecera}
      {cuerpo || (
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-7 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:gap-8">
          <div className="min-w-0">
            {!avisoEnMesa && avisoEl}
            {mesa}
            {/* Deshacer lo último que se decidió en esta sesión, esté donde esté. */}
            {ultimo && !golpe && !(lado && ultimo.r === rev?.id && ultimo.k === lado.photo_index) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dark-400" data-testid="ultimo">
                <span>
                  {t('repaso.ultimo').replace('{lado}', ultimo.lado).replace('{matricula}', ultimo.matricula || '—')
                    .replace('{veredicto}', textoEstado(t, ultimo.veredicto, ultimo.sinAnterior))}
                </span>
                <button type="button" onClick={() => deshacer(ultimo)} disabled={ocupado}
                  className="inline-flex items-center gap-1.5 font-semibold text-dark-100 underline underline-offset-4 hover:text-dark-50 disabled:opacity-50">
                  <Undo2 size={13} /> {t('repaso.deshacer')}
                </button>
              </div>
            )}
          </div>
          <aside className="flex min-w-0 flex-col gap-5 border-t border-dark-700 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 2xl:pl-7">
            {rev && !terminado && <YaApuntado t={t} locale={locale} lista={rev.ya_apuntado || []} miniatura={miniatura} />}
            <ResumenDia t={t} cuentas={cuentas} esHoy={esHoy} sinRevision={dia?.sin_revision || []} />
            {cuentas.sinLados > 0 && !sinNada && (
              <p className="text-[13px] text-dark-400">{t('repaso.sinlados.nota').replace('{n}', cuentas.sinLados)}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
