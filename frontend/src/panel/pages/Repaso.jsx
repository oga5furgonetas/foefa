import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, EyeOff, Loader2, Undo2 } from 'lucide-react'
import { useT, LANG_LOCALE } from '../../i18n'
import { getRepasoDia, marcarRepaso, deshacerRepaso } from '../../services/api'
import Matricula from '../../components/Matricula'
import Pareja from '../components/repaso/Pareja'
import Ampliar from '../components/repaso/Ampliar'
import FormGolpe from '../components/repaso/FormGolpe'
import Terminado from '../components/repaso/Terminado'
import { YaApuntado, ResumenDia } from '../components/repaso/Lateral'
import {
  nombreLado, porRepasar, cuentasDelDia, golpesNuevosDelDia, siguienteFoco, primerFoco, ladoVecino,
  fechaDeSello, sumarDias, fechaLarga, horaDe, hoyLocal, conLado, cuerpoGolpe,
} from '../components/repaso/logica'

/* EL REPASO DEL DÍA (14-11-2026, «Antes del perito»).
   ─────────────────────────────────────────────────────────────────────────
   Cada tarde, quien lleva la flota mira las revisiones que han llegado hoy: por cada lado de cada furgoneta, la foto
   de hoy junto a la anterior del mismo lado, y decide él (nadie más) si está igual, si hay un golpe nuevo o si la foto
   no deja verlo. Un toque o una tecla por lado; con 48 furgonetas tiene que salir en unos minutos.
   Lo que se decide aquí es lo único que sale en el expediente de la furgoneta: por eso aquí no hay nada automático.
   El servidor: `GET /repaso/dia`, `POST` y `DELETE /inspections/{id}/repaso` (CONTRATO «Antes del perito», §A y §B). */

const MODO = 'repaso_modo'
const leerModo = () => { try { return localStorage.getItem(MODO) === 'deslizador' ? 'deslizador' : 'juntas' } catch { return 'juntas' } }
const GOLPE_VACIO = { caja: null, pieza: '', piezaClave: null, gravedad: null, nota: '' }

function textoDeError(t, e) {
  if (!e?.response) return e?.code === 'ECONNABORTED' ? t('repaso.err.lento') : t('repaso.err.red')
  const d = e.response.data?.detail
  return typeof d === 'string' && d ? d : t('repaso.err.servidor')
}

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
  const [ampliada, setAmpliada] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)          // { tono: 'error' | 'info', texto }
  const [pila, setPila] = useState([])              // lo decidido en esta sesión, para «Deshacer»
  const diaRef = useRef(null)
  diaRef.current = dia
  const pedida = useRef(0)

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
    setGolpe(null); setAmpliada(false); setAviso(null); setPila([]); setDia(null); setFoco(null)
    cargar()
  }, [cargar])

  // El número del menú: las revisiones de HOY que quedan por repasar, en cuanto cambian.
  const cuentas = useMemo(() => cuentasDelDia(dia), [dia])
  useEffect(() => {
    if (dia?.es_hoy && setAvisoRepaso) setAvisoRepaso(cuentas.porRepasar)
  }, [dia, cuentas.porRepasar, setAvisoRepaso])

  const revs = dia?.revisiones || []
  const ri = foco ? revs.findIndex((r) => r.id === foco.r) : -1
  const rev = ri >= 0 ? revs[ri] : null
  const lado = rev ? rev.lados.find((l) => l.photo_index === foco.k) || null : null
  const conLados = revs.filter((r) => r.lados?.length)
  const esHoy = !!dia?.es_hoy

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

  const irA = (r, k) => { setGolpe(null); setAmpliada(false); setFoco({ r, k }) }

  function aplicarRespuesta(revId, ladoNuevo, libro) {
    let d = conLado(diaRef.current, revId, ladoNuevo)
    const r = d.revisiones.find((x) => x.id === revId)
    const g = ladoNuevo.golpe
    // El golpe recién apuntado entra en «Ya apuntado» de esa furgoneta (en todas sus revisiones del día).
    if (g && libro && (libro.accion === 'nuevo' || libro.accion === 'sustituye_ia')) {
      const entrada = {
        ledger_id: libro.ledger_id ?? null, golpe_id: g.golpe_id, pieza: g.pieza, panel: g.panel, gravedad: g.gravedad,
        desde: d.fecha, inspection_id: revId, vista: ladoNuevo.vista, origen: 'repaso', en_taller: false, de_esta_revision: true,
      }
      d = { ...d, revisiones: d.revisiones.map((x) => (x.vehiculo?.id !== r?.vehiculo?.id ? x : {
        ...x, ya_apuntado: [entrada, ...(x.ya_apuntado || []).filter((a) => a.golpe_id !== g.golpe_id)],
      })) }
    }
    return d
  }

  async function responder(veredicto, cuerpo = null) {
    if (!rev || !lado || ocupado) return
    setOcupado(true); setAviso(null)
    const desde = { r: rev.id, k: lado.photo_index }
    try {
      const res = await marcarRepaso(rev.id, cuerpo || { photo_index: lado.photo_index, veredicto })
      const nuevo = res.data?.lado || { veredicto }
      const libro = res.data?.libro || null
      const d = aplicarRespuesta(rev.id, { ...nuevo, photo_index: lado.photo_index }, libro)
      setDia(d)
      setPila((p) => [...p, { r: rev.id, k: lado.photo_index, veredicto: nuevo.veredicto || veredicto, matricula: rev.vehiculo?.matricula, lado: nombreLado(t, lado) }])
      if (libro?.accion === 'ya_apuntado') {
        setAviso({ tono: 'info', texto: t('repaso.libro.yaapuntado').replace('{fecha}', libro.desde ? fechaLarga(libro.desde, locale, false) : '—') })
      }
      setGolpe(null); setAmpliada(false)
      setFoco(siguienteFoco(d.revisiones, desde))
    } catch (e) {
      setAviso({ tono: 'error', texto: textoDeError(t, e) })
      // Otra persona lo ha decidido a la vez: se trae lo que hay ahora.
      if (e?.response?.status === 409) cargar(true)
    } finally {
      setOcupado(false)
    }
  }

  async function deshacer(objetivo) {
    if (!objetivo || ocupado) return
    setOcupado(true); setAviso(null)
    try {
      const res = await deshacerRepaso(objetivo.r, objetivo.k)
      const accion = res.data?.libro?.accion
      let d = diaRef.current
      const r0 = d.revisiones.find((x) => x.id === objetivo.r)
      const l0 = r0?.lados.find((x) => x.photo_index === objetivo.k)
      const golpeId = l0?.golpe?.golpe_id
      d = conLado(d, objetivo.r, { photo_index: objetivo.k, veredicto: null, veredicto_por: null, veredicto_at: null, golpe: null })
      if (golpeId && (accion === 'borrado' || accion === 'devuelto_a_ia')) {
        d = { ...d, revisiones: d.revisiones.map((x) => ({ ...x, ya_apuntado: (x.ya_apuntado || []).filter((a) => a.golpe_id !== golpeId) })) }
      }
      setDia(d)
      setPila((p) => p.filter((x) => !(x.r === objetivo.r && x.k === objetivo.k)))
      irA(objetivo.r, objetivo.k)
    } catch (e) {
      setAviso({ tono: 'error', texto: textoDeError(t, e) })
    } finally {
      setOcupado(false)
    }
  }

  const abrirGolpe = () => {
    if (!lado || lado.veredicto || ocupado) return
    setAmpliada(false); setAviso(null)
    setGolpe({ ...GOLPE_VACIO })
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

  /* EL TECLADO, para quien repasa desde el ordenador: → o Intro, está igual (o al siguiente lado si ya está decidido);
     G, golpe nuevo; N, no se ve; ←, el lado anterior; Z, ampliar; Esc cierra. Nada de esto con Ctrl, Alt o ⌘ (son
     atajos del navegador) ni mientras se escribe en un campo. */
  useEffect(() => {
    const h = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) {
        if (e.key === 'Escape' && golpe) { e.preventDefault(); setGolpe(null) }
        return
      }
      if (e.key === 'Escape') {
        if (ampliada) setAmpliada(false)
        else if (golpe) setGolpe(null)
        return
      }
      if (golpe || !lado || ocupado) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (k === 'ArrowRight' || (k === 'Enter' && tag !== 'BUTTON' && tag !== 'A')) {
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
        e.preventDefault(); setAmpliada((a) => !a)
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {conLados.length > 0 && (
          <div className="flex items-center gap-3" data-testid="avance"
            aria-label={t('repaso.avance').replace('{a}', cuentas.repasadas).replace('{b}', cuentas.revisiones)}>
            <span className="block h-1.5 w-28 overflow-hidden rounded-full bg-dark-800 sm:w-40">
              <span className="block h-full bg-dark-50" style={{ width: `${cuentas.revisiones ? (cuentas.repasadas / cuentas.revisiones) * 100 : 0}%` }} />
            </span>
            <b className="font-mono text-sm font-semibold tabular-nums text-dark-50">{cuentas.repasadas} / {cuentas.revisiones}</b>
          </div>
        )}
        {fechaDia && <div className="flex items-center gap-1.5">
          <button type="button" aria-label={t('repaso.dia.anterior')} title={t('repaso.dia.anterior')}
            disabled={!fechaDia} onClick={() => irDia(sumarDias(fechaDia, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-dark-700 text-dark-200 hover:bg-dark-800 disabled:opacity-40">
            <ChevronLeft size={17} />
          </button>
          <input type="date" aria-label={t('repaso.dia.elegir')} value={fechaDia || ''} max={hoyTope}
            onChange={(e) => { const v = e.target.value; if (v && v <= hoyTope) irDia(v) }}
            className="h-9 rounded-lg border border-dark-700 bg-dark-900 px-2 font-mono text-[13px] text-dark-100" />
          <button type="button" aria-label={t('repaso.dia.siguiente')} title={t('repaso.dia.siguiente')}
            disabled={!fechaDia || esHoy || fechaDia >= hoyTope} onClick={() => irDia(sumarDias(fechaDia, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-dark-700 text-dark-200 hover:bg-dark-800 disabled:opacity-40">
            <ChevronRight size={17} />
          </button>
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

  // La mesa: la revisión que se mira, el día terminado o el día sin revisiones.
  const ultimo = pila[pila.length - 1]
  let mesa = null
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
      <Terminado t={t} esHoy={esHoy} cuentas={cuentas} golpes={golpesDia}
        onAbrir={(r, k) => irA(r, k)}
        onRevisar={() => { const r = conLados[0]; if (r) irA(r.id, r.lados[0].photo_index) }} />
    )
  } else if (!cuerpo && rev && lado) {
    const sinAnterior = !lado.anterior
    const partida = sinAnterior && !!lado.vista
    const nombre = nombreLado(t, lado)
    const quienDecidio = lado.veredicto_por || ''
    const horaDecidio = horaDe(lado.veredicto_at, locale)
    const textoHecho = lado.veredicto === 'igual' ? (sinAnterior ? 'repaso.hecho.partida' : 'repaso.hecho.igual')
      : lado.veredicto === 'golpe' ? 'repaso.hecho.golpe' : 'repaso.hecho.nosevee'
    const idxRev = conLados.findIndex((r) => r.id === rev.id)

    mesa = (
      <div className="min-w-0" data-testid="mesa">
        {/* La furgoneta: matrícula, modelo, quién la llevaba y cuándo llegó la revisión. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {rev.vehiculo?.matricula
            ? <Matricula texto={rev.vehiculo.matricula} className="text-[22px]" />
            : <span className="text-[17px] font-semibold text-dark-50">{t('repaso.sinmatricula')}</span>}
          <p className="min-w-0 text-[15px] text-dark-400">
            {rev.vehiculo?.modelo ? <span>{rev.vehiculo.modelo} · </span> : null}
            {rev.conductor
              ? (rev.conductor.nombre
                ? <span>{t('repaso.llevo.a')} <b className="font-semibold text-dark-50">{rev.conductor.nombre}</b></span>
                : <span>{t('repaso.conductor.borrado')}</span>)
              : <span>{t('repaso.sin.conductor')}</span>}
            {rev.hora ? <span> · {t('repaso.recibida').replace('{hora}', rev.hora)}</span> : null}
          </p>
          {conLados.length > 1 && (
            <div className="ml-auto flex items-center gap-1">
              <button type="button" aria-label={t('repaso.rev.anterior')} title={t('repaso.rev.anterior')}
                disabled={idxRev <= 0} onClick={() => { const r = conLados[idxRev - 1]; irA(r.id, (r.lados.find((l) => !l.veredicto) || r.lados[0]).photo_index) }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 disabled:opacity-30">
                <ChevronLeft size={17} />
              </button>
              <span className="font-mono text-[13px] tabular-nums text-dark-400">
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

        {/* Los lados, con lo que ya se ha decidido de cada uno. */}
        <div className="-mx-1 mt-4 flex items-center gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t('repaso.lados')}>
          {rev.lados.map((l) => {
            const activo = l.photo_index === lado.photo_index
            const estado = l.veredicto ? t(`repaso.est.${l.veredicto}`) : t('repaso.est.sinver')
            return (
              <button key={l.photo_index} type="button" role="tab" aria-selected={activo}
                title={estado} aria-label={`${nombreLado(t, l)}: ${estado}`}
                data-testid={`lado-${l.photo_index}`} data-veredicto={l.veredicto || ''}
                onClick={() => irA(rev.id, l.photo_index)}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${activo
                  ? 'border-dark-50 bg-dark-50 text-dark-950'
                  : l.veredicto ? 'border-dark-700 text-dark-400 hover:bg-dark-800' : 'border-ruta-borde/60 bg-dark-900 text-dark-100 hover:bg-dark-800'}`}>
                <MarcaLado veredicto={l.veredicto} activo={activo} />
                {nombreLado(t, l)}
              </button>
            )
          })}
          {fotoAntes && !golpe && (
            <div className="ml-auto hidden shrink-0 items-center rounded-lg border border-dark-700 p-0.5 sm:flex" role="group" aria-label={t('repaso.modo')}>
              {['juntas', 'deslizador'].map((m) => (
                <button key={m} type="button" aria-pressed={modo === m} onClick={() => elegirModo(m)}
                  className={`h-8 rounded-md px-2.5 text-[13px] font-semibold ${modo === m ? 'bg-dark-800 text-dark-50' : 'text-dark-400 hover:text-dark-100'}`}>
                  {t(`repaso.modo.${m}`)}
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
          <Pareja t={t} lado={lado} hoy={fotoHoy} antes={fotoAntes} modo={modo}
            dibujar={!!golpe} caja={golpe ? golpe.caja : (lado.golpe?.box_2d || null)}
            onCaja={(c) => setGolpe((g) => (g ? { ...g, caja: c } : g))}
            onAmpliar={() => setAmpliada(true)} />
        </div>

        {aviso && (
          <p role={aviso.tono === 'error' ? 'alert' : 'status'} data-testid="repaso-aviso"
            className={`mt-3 border-l-[3px] pl-3 text-sm ${aviso.tono === 'error' ? 'border-ruta-peligro-texto text-ruta-peligro-texto' : 'border-dark-400 text-dark-200'}`}>
            {aviso.texto}
          </p>
        )}

        {/* Las respuestas. */}
        <div className="mt-4">
          {golpe ? (
            <FormGolpe t={t} vista={lado.vista} valor={golpe} ocupado={ocupado}
              titulo={(partida ? t('repaso.golpe.titulo.partida') : t('repaso.golpe.titulo')).replace('{lado}', nombre)}
              onCambio={(c) => setGolpe((g) => ({ ...g, ...c }))}
              onCancelar={() => setGolpe(null)}
              onGuardar={() => responder('golpe', cuerpoGolpe(lado.photo_index, golpe))} />
          ) : lado.veredicto ? (
            <div className="flex flex-col gap-3 rounded-xl border border-dark-700 bg-dark-900 p-4 sm:flex-row sm:items-center" data-testid="decidido">
              <div className="min-w-0 flex-1 text-[15px] text-dark-100">
                <p>{t(textoHecho).replace('{quien}', quienDecidio || '—').replace('{hora}', horaDecidio || '—')}</p>
                {lado.golpe && (
                  <p className="mt-1 text-sm text-dark-400">
                    <b className="font-semibold text-dark-50">{lado.golpe.pieza}</b>
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
                <button type="button" onClick={ladoSiguiente}
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
                <button type="button" onClick={abrirGolpe} disabled={ocupado}
                  className="h-[52px] whitespace-nowrap rounded-xl border-[1.5px] border-ruta-peligro-texto px-3 text-[15px] sm:px-5 font-bold text-ruta-peligro-texto hover:bg-dark-800 disabled:opacity-50 sm:order-2">
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
          <Ampliar t={t} matricula={rev.vehiculo?.matricula} nombre={nombre} lado={lado} hoy={fotoHoy} antes={fotoAntes}
            onCerrar={() => setAmpliada(false)} />
        )}
      </div>
    )
  }

  // «Ya apuntado»: la miniatura sale de una foto que esté en pantalla (la de esta revisión o la anterior de ese lado).
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
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
          <div className="min-w-0">
            {mesa}
            {/* Deshacer lo último que se decidió en esta sesión, esté donde esté. */}
            {ultimo && !golpe && !(lado && ultimo.r === rev?.id && ultimo.k === lado.photo_index) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dark-400" data-testid="ultimo">
                <span>
                  {t('repaso.ultimo').replace('{lado}', ultimo.lado).replace('{matricula}', ultimo.matricula || '—')
                    .replace('{veredicto}', t(`repaso.est.${ultimo.veredicto}`))}
                </span>
                <button type="button" onClick={() => deshacer(ultimo)} disabled={ocupado}
                  className="inline-flex items-center gap-1.5 font-semibold text-dark-100 underline underline-offset-4 hover:text-dark-50 disabled:opacity-50">
                  <Undo2 size={13} /> {t('repaso.deshacer')}
                </button>
              </div>
            )}
          </div>
          <aside className="flex min-w-0 flex-col gap-5 xl:border-l xl:border-dark-700 xl:pl-7">
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
