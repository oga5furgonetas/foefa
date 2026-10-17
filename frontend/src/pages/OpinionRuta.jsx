import { useEffect, useState } from 'react'
import { Star, Loader2, Lightbulb, ChevronDown } from 'lucide-react'
import { opinionEstado, opinionEnviar } from '../panel/api'
import { tx, useIdioma, txError } from '../lib/idioma'

/* ¿QUÉ TAL TE VA? (05-10-2026): a quien se registró y ya ha hecho entregas de
   verdad se le pregunta UNA vez qué le falta. Lo decide el servidor (`pedir`):
   cuenta de más de 20 h y 2 entregas reales. «Ahora no» no vuelve a preguntar. */
export default function OpinionRuta() {
  useIdioma()
  const [ver, setVer] = useState(false)
  const [nota, setNota] = useState(0)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    try { if (sessionStorage.getItem('opinion_vista')) return undefined } catch { /* nada */ }
    opinionEstado().then(({ data }) => { if (vivo && data?.pedir) setVer(true) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!ver) return null
  const cerrar = () => { try { sessionStorage.setItem('opinion_vista', '1') } catch { /* nada */ } setVer(false) }
  const saltar = async () => { try { await opinionEnviar({ saltar: true }) } catch { /* nada */ } cerrar() }
  const enviar = async () => {
    setOcupado(true); setErr('')
    try {
      await opinionEnviar({ valor: nota || undefined, texto })
      setHecho(true)
      setTimeout(cerrar, 2500)
    } catch { setErr(tx('No se ha podido enviar. Inténtalo otra vez.')) } finally { setOcupado(false) }
  }
  return (
    <section className="mx-auto mb-4 max-w-md rounded-3xl border border-brand-400/30 bg-brand-500/[.07] p-4" aria-label={tx('¿Qué tal te va la app?')}>
      {hecho ? <p role="status" className="text-center text-[14.5px] font-semibold text-brand-200">{tx('¡Gracias! Lo leo yo personalmente.')}</p> : (
        <>
          <p className="text-[15px] font-bold text-dark-50">{tx('¿Qué tal te va la app?')}</p>
          <p className="mt-1 text-[13px] leading-snug text-dark-300">{tx('Tu opinión nos ayuda a mejorarla. Cuéntanos qué te falta o qué te estorba, aunque sea corto.')}</p>
          <div className="mt-2 flex gap-1" role="group" aria-label={tx('Nota de 1 a 5')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setNota(n)} aria-label={String(n)} aria-pressed={nota === n}
                className="p-1"><Star size={26} className={n <= nota ? 'fill-amber-300 text-amber-300' : 'text-dark-600'} /></button>
            ))}
          </div>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1500}
            placeholder={tx('Escribe aquí qué te falta o qué mejorarías')}
            className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[16px] text-dark-50" />
          {err && <p role="alert" className="mt-1 text-[13px] text-red-300">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={enviar} disabled={ocupado || (!nota && !texto.trim())}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[14.5px] font-bold text-[#04121a] disabled:opacity-50">
              {ocupado && <Loader2 size={16} className="animate-spin" />} {tx('Enviar mi opinión')}
            </button>
            <button onClick={saltar} className="rounded-xl border border-dark-700 px-4 py-3 text-[14px] font-semibold text-dark-300">{tx('Ahora no')}</button>
          </div>
        </>
      )}
    </section>
  )
}

/* MÁNDANOS UNA IDEA (17-10-2026), en la pestaña Cuenta: siempre a mano, no solo cuando la app pregunta.
   Le llega a Dani al correo, y «Responder» le escribe a quien la mandó. */
export function IdeaRuta() {
  useIdioma()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [err, setErr] = useState('')
  const enviar = async () => {
    setOcupado(true); setErr('')
    try {
      await opinionEnviar({ tipo: 'sugerencia', texto })
      setHecho(true); setTexto('')
    } catch (e) {
      setErr(txError(e?.response?.data, 'No se ha podido enviar. Inténtalo otra vez.'))
    } finally { setOcupado(false) }
  }
  return (
    <section className="mt-4 rounded-3xl border border-dark-700 bg-dark-900 p-4">
      <button type="button" onClick={() => { setAbierto((v) => !v); setHecho(false); setErr('') }} aria-expanded={abierto}
        className="flex w-full items-center gap-3 text-left">
        <Lightbulb size={20} className="shrink-0 text-brand-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-dark-50">{tx('Mándanos una idea')}</span>
          <span className="block text-[12.5px] leading-snug text-dark-400">{tx('¿Algo que no va o que echas en falta? Lo leo yo y te contesto por correo.')}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-dark-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (hecho ? (
        <p role="status" className="mt-3 text-[14.5px] font-semibold text-brand-200">{tx('¡Recibido! Gracias.')}</p>
      ) : (
        <div className="mt-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={1500} autoFocus
            aria-label={tx('Mándanos una idea')} placeholder={tx('Escribe tu idea o lo que no te funciona')}
            className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[16px] text-dark-50" />
          {err && <p role="alert" className="mt-1 text-[13px] text-red-300">{err}</p>}
          <button type="button" onClick={enviar} disabled={ocupado || !texto.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[14.5px] font-bold text-brand-tinta disabled:opacity-50">
            {ocupado && <Loader2 size={16} className="animate-spin" />} {tx('Enviar')}
          </button>
        </div>
      ))}
    </section>
  )
}
