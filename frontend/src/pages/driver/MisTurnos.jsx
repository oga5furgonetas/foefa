import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, CalendarDays, Loader2, Check, Clock, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { getMyShifts, createShiftRequest } from '../../services/api'
import { lista } from '../../lib/lista'
import { isoLocal } from '../../lib/fecha'
import { useT } from '../../i18n'

/* MIS TURNOS, COMO UN CALENDARIO (18-10-2026)
   Era una lista de 28 días uno debajo de otro. Dani: «me gustaba más como salía
   antes su calendario; ahora así hacia abajo no me gusta». Vuelve a ser el mes
   en rejilla (L M X J V S D), como el de «Pedir días»: cada día con el color de
   lo que tiene, y al tocarlo se ve el detalle y se puede pedir. */

const ATRAS = 2      // meses hacia atrás que se pueden mirar
const ADELANTE = 3   // y hacia delante

// Cómo se pinta cada día. La leyenda usa estas MISMAS clases: si no
// coincidieran, la leyenda confundiría más de lo que aclara.
const TIPO = {
  trabaja: { k: 'dr.sh.works', cls: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300', celda: 'bg-emerald-500/20 text-emerald-200' },
  extra:   { k: 'dr.sh.extra', cls: 'border-amber-500/40 bg-amber-500/12 text-amber-300', celda: 'bg-amber-500/25 text-amber-200' },
  libre:   { k: 'dr.sh.off',   cls: 'border-dark-700 bg-dark-800/50 text-dark-500', celda: 'bg-dark-800/70 text-dark-500' },
  susp:    { k: 'dr.sh.susp',  cls: 'border-red-500/40 bg-red-500/10 text-red-300', celda: 'bg-red-500/20 text-red-300' },
}
const ESTADO = {
  aprobado:  { k: 'dr.sh.approved', icono: Check, cls: 'text-emerald-400', punto: 'bg-emerald-400' },
  pendiente: { k: 'dr.sh.pending',  icono: Clock, cls: 'text-amber-400', punto: 'bg-sky-400' },
  rechazado: { k: 'dr.sh.rejected', icono: X,     cls: 'text-red-400', punto: 'bg-red-400' },
}

const primeroDe = (d) => new Date(d.getFullYear(), d.getMonth(), 1, 12)
// «octubre de 2026» → «Octubre de 2026» (con `capitalize` salía «Octubre De 2026»).
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function MisTurnos({ onBack }) {
  const { t, lang } = useT()
  const hoyIso = isoLocal(new Date())
  const esteMes = useMemo(() => primeroDe(new Date()), [])
  const [ref, setRef] = useState(esteMes)           // el día 1 del mes que se ve
  const [turnos, setTurnos] = useState(null)
  const [peticiones, setPeticiones] = useState([])
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [sel, setSel] = useState(hoyIso)            // el día tocado: su detalle va debajo
  const [pidiendo, setPidiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const desfase = (ref.getFullYear() - esteMes.getFullYear()) * 12 + ref.getMonth() - esteMes.getMonth()
  const mover = (n) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() + n, 1, 12)
    setRef(d)
    setPidiendo(false)
    // Al cambiar de mes se marca hoy si está en ese mes; si no, el día 1.
    setSel(isoLocal(d).slice(0, 7) === hoyIso.slice(0, 7) ? hoyIso : isoLocal(d))
  }

  // Las casillas del mes, empezando en lunes (null = hueco antes del día 1).
  const celdas = useMemo(() => {
    const n = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
    const hueco = (ref.getDay() + 6) % 7
    return [...Array(hueco).fill(null),
      ...Array.from({ length: n }, (_, i) => isoLocal(new Date(ref.getFullYear(), ref.getMonth(), i + 1, 12)))]
  }, [ref])

  const cargar = useCallback(async () => {
    setErr('')
    const dias = celdas.filter(Boolean)
    try {
      const r = await getMyShifts(dias[0], dias[dias.length - 1])
      const m = {}
      for (const s of lista(r.data?.shifts)) m[s.date] = s.cod === 'SUSP' ? 'susp' : s.type
      setTurnos(m)
      setPeticiones(lista(r.data?.requests))
    } catch {
      setErr(t('dr.sh.error'))
      setTurnos({})
    }
  }, [celdas])

  useEffect(() => { setTurnos(null); cargar() }, [cargar])

  const pedir = async (fecha, tipo) => {
    setEnviando(true); setErr(''); setAviso('')
    try {
      const r = await createShiftRequest(fecha, tipo, '')
      setPidiendo(false)
      // El backend auto-aprueba si queda cobertura suficiente: díselo al conductor.
      setAviso(r.data?.auto ? t('dr.sh.auto.ok') : t('dr.sh.sent'))
      await cargar()
    } catch (e) {
      setErr(e?.response?.data?.detail || t('dr.sh.req.err'))
    } finally { setEnviando(false) }
  }

  const porFecha = useMemo(() => {
    const m = {}
    for (const p of peticiones) m[p.date] = p
    return m
  }, [peticiones])

  // Las iniciales y el nombre del mes en el idioma de la app (L M X J V S D en español).
  const iniciales = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 9, 19 + i, 12).toLocaleDateString(lang, { weekday: 'narrow' })), [lang])
  const titulo = mayus(ref.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))
  const largo = (f) => mayus(new Date(`${f}T12:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }))

  const tipoSel = turnos?.[sel]
  const uiSel = TIPO[tipoSel] || null
  const petSel = porFecha[sel]
  const estSel = petSel ? ESTADO[petSel.status] : null
  const IconoSel = estSel?.icono
  const puedePedir = sel >= hoyIso && !petSel && tipoSel !== 'susp'

  return (
    <div className="min-h-screen bg-dark-950 pb-10">
      <header
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-dark-800/60 bg-dark-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <button onClick={onBack} className="btn-ghost p-1.5" aria-label={t('dr.sh.back')}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex items-center gap-2 text-base font-bold text-dark-50">
          <CalendarDays size={17} /> {t('dr.sh.title')}
        </h1>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
        {aviso && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{aviso}</p>}

        <div className="rounded-2xl border border-dark-800 bg-dark-900/60 p-3.5" data-testid="mis-turnos">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => mover(-1)} disabled={desfase <= -ATRAS}
              className="rounded-lg border border-dark-700 p-1.5 text-dark-400 disabled:opacity-25" aria-label={t('dr.sh.prev')}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[15px] font-bold text-dark-50">{titulo}</span>
            <button onClick={() => mover(1)} disabled={desfase >= ADELANTE}
              className="rounded-lg border border-dark-700 p-1.5 text-dark-400 disabled:opacity-25" aria-label={t('dr.sh.next')}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {iniciales.map((d, i) => (
              <span key={i} className="pb-1 text-center font-mono text-[10px] uppercase text-dark-500">{d}</span>
            ))}
          </div>

          {turnos === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-dark-500">
              <Loader2 size={15} className="animate-spin" /> {t('ui.loading')}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {celdas.map((f, i) => {
                if (!f) return <span key={i} />
                const ui = TIPO[turnos[f]]
                const pet = porFecha[f]
                const pasado = f < hoyIso
                return (
                  <button key={f} onClick={() => { setSel(f); setPidiendo(false); setAviso('') }}
                    aria-label={`${largo(f)}: ${ui ? t(ui.k) : t('dr.sh.none')}`} aria-pressed={sel === f}
                    className={`relative aspect-square rounded-lg text-[13px] tabular-nums transition-colors ${
                      ui ? ui.celda : 'text-dark-200 hover:bg-dark-800'} ${pasado ? 'opacity-45' : ''} ${
                      sel === f ? 'ring-2 ring-brand-400' : f === hoyIso ? 'ring-1 ring-brand-500/60' : ''} ${
                      f === hoyIso ? 'font-bold' : ''}`}>
                    {Number(f.slice(8, 10))}
                    {pet && ESTADO[pet.status] && (
                      <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${ESTADO[pet.status].punto}`} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-dark-800 pt-3 text-[10.5px] text-dark-500">
            {Object.values(TIPO).map((x) => (
              <span key={x.k} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${x.celda}`} /> {t(x.k)}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> {t('dr.sh.pending')}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t('dr.sh.approved')}</span>
          </div>
        </div>

        {/* El día tocado: qué tiene y, si se puede, pedirlo. */}
        {turnos !== null && sel.slice(0, 7) === isoLocal(ref).slice(0, 7) && (
          <div className="rounded-2xl border border-dark-800 bg-dark-900/60 p-3.5">
            <p className="text-[14px] font-bold text-dark-50">{largo(sel)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {uiSel ? (
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${uiSel.cls}`}>{t(uiSel.k)}</span>
              ) : (
                <span className="text-[12px] text-dark-500">{t('dr.sh.none')}</span>
              )}
              {estSel && (
                <span className={`flex items-center gap-1 text-[11px] font-semibold ${estSel.cls}`}>
                  <IconoSel size={12} /> {t(estSel.k)}
                </span>
              )}
            </div>
            {puedePedir && (
              pidiendo ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button disabled={enviando} onClick={() => pedir(sel, 'libre')}
                    className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-[12px] font-semibold text-sky-300 disabled:opacity-50">
                    {t('dr.sh.ask.off')}
                  </button>
                  <button disabled={enviando} onClick={() => pedir(sel, 'extra')}
                    className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-[12px] font-semibold text-amber-300 disabled:opacity-50">
                    {t('dr.sh.ask.extra')}
                  </button>
                  <button onClick={() => setPidiendo(false)} className="btn-ghost px-2.5 py-1.5 text-[12px]">
                    {t('dr.sh.cancel')}
                  </button>
                </div>
              ) : (
                <button onClick={() => { setPidiendo(true); setAviso('') }}
                  className="mt-3 rounded-lg border border-dark-700 px-3 py-1.5 text-[12px] font-medium text-dark-300">
                  {t('dr.sh.ask')}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
