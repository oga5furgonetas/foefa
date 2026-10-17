import { useEffect, useState } from 'react'
import { Loader2, Star, CheckCircle2 } from 'lucide-react'
import { opinionCorreoEstado, opinionCorreoEnviar } from '../panel/api'
import { tx, useIdioma, txError } from '../lib/idioma'
import { MARCA } from '../marca'

/* LA RESPUESTA DEL CORREO «¿QUÉ TAL TE VA?» (17-10-2026). Cada opción del correo trae aquí la respuesta
   ya marcada (?r=nota o ?m=motivo). Abrir el enlace NO guarda nada: los antivirus del correo abren todos
   los enlaces y eso no puede contar como respuesta; cuenta al pulsar «Enviar». Sin sesión: el enlace va
   firmado y solo vale para esa cuenta. Lo que manda le llega a Dani al correo.
   La pregunta abierta es la de la NECESIDAD (Dani, 17-10: «si cubres una necesidad, la aplicación se vende
   sola; la clave es saber qué necesidad real hay que cubrir»): qué le complica el día de reparto. */
const MOTIVOS = [
  ['no_ruta', 'Todavía no he tenido reparto'],
  ['no_supe', 'No supe cómo meter los paquetes'],
  ['otra_app', 'Ya uso otra app'],
  ['empresa', 'Mi empresa no me deja'],
  ['otro', 'Otra cosa'],
]

export default function OpinionCorreo() {
  useIdioma()
  const [q] = useState(() => new URLSearchParams(window.location.search))
  const o = q.get('o') || ''
  const t = q.get('t') || ''
  const [estado, setEstado] = useState(null)
  const [invalido, setInvalido] = useState('')
  const [nota, setNota] = useState(() => { const n = Number(q.get('r')); return n >= 1 && n <= 5 ? n : 0 })
  const [motivo, setMotivo] = useState(() => (MOTIVOS.some(([k]) => k === q.get('m')) ? q.get('m') : ''))
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    opinionCorreoEstado(o, t).then(({ data }) => { if (vivo) setEstado(data || {}) })
      .catch((e) => {
        if (!vivo) return
        setInvalido(e?.response?.status === 404
          ? tx('Este enlace no es válido. Escríbenos a {correo} y te contestamos.', { correo: MARCA.correo })
          : tx('No se ha podido cargar. Inténtalo otra vez.'))
      })
    return () => { vivo = false }
  }, [o, t])

  // La pregunta es la del botón que pulsó en el correo; si llega sin respuesta marcada, la de su cuenta.
  const usa = q.has('r') ? true : q.has('m') ? false : !!estado?.usa
  const etiquetas = [tx('Mal'), tx('Regular'), tx('Normal'), tx('Bien'), tx('Me encanta')]
  const listo = usa ? nota > 0 || texto.trim() : motivo || texto.trim()

  const enviar = async () => {
    setOcupado(true); setErr('')
    try {
      await opinionCorreoEnviar({ o, t, texto, ...(usa ? { valor: nota || undefined } : { motivo: motivo || undefined }) })
      setHecho(true)
    } catch (e) {
      setErr(txError(e?.response?.data, 'No se ha podido enviar. Inténtalo otra vez.'))
    } finally { setOcupado(false) }
  }

  return (
    <main className="app-ruta min-h-screen bg-dark-950 px-4 py-8 text-dark-100">
      <div className="mx-auto max-w-md">
        <img src="/favicon.svg" alt="" width="36" height="36" className="mb-5 h-9 w-9" />
        {invalido ? (
          <p role="alert" className="rounded-3xl border border-dark-700 bg-dark-900 p-5 text-[15px] leading-snug">{invalido}</p>
        ) : !estado ? (
          <Loader2 size={28} className="mx-auto mt-16 animate-spin text-brand-300" aria-label={tx('Cargando…')} />
        ) : hecho ? (
          <section role="status" className="rounded-3xl border border-dark-700 bg-dark-900 p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-300" />
            <p className="mt-3 text-[18px] font-bold text-dark-50">{tx('¡Gracias! Lo leo yo personalmente.')}</p>
            {!usa && motivo === 'no_supe' && (
              <p className="mt-3 text-[14px] leading-snug text-dark-300">
                {tx('Es muy fácil: abre la app, pulsa este botón y haz una foto a cada etiqueta:')}{' '}
                <b className="text-dark-100">«{tx('Cargar paquetes: uno tras otro')}»</b>
              </p>
            )}
            <a href="/ruta" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-brand-500 py-3.5 text-[15px] font-bold text-brand-tinta">
              {tx('Abrir la app')}
            </a>
          </section>
        ) : (
          <section className="rounded-3xl border border-dark-700 bg-dark-900 p-5">
            <h1 className="text-[21px] font-bold leading-tight text-dark-50">{usa ? tx('¿Qué tal te va la app?') : tx('¿Qué te frenó?')}</h1>
            {estado.ya && <p className="mt-1 text-[13px] text-dark-400">{tx('Ya nos contestaste. Si quieres añadir algo, escríbelo aquí.')}</p>}
            {usa ? (
              <>
                <p className="mt-3 text-[14px] text-dark-300">{tx('Tu nota:')}</p>
                <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label={tx('Nota de 1 a 5')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} · ${etiquetas[n - 1]}`}
                      onClick={() => setNota(n)} className="p-1">
                      <Star size={34} className={n <= nota ? 'fill-amber-300 text-amber-300' : 'text-dark-600'} />
                    </button>
                  ))}
                </div>
                {nota > 0 && <p className="mt-1 text-[14px] font-semibold text-dark-100">{etiquetas[nota - 1]}</p>}
              </>
            ) : (
              <>
                <p className="mt-3 text-[14px] text-dark-300">{tx('Elige la que más se parezca:')}</p>
                <div className="mt-2 space-y-2" role="radiogroup" aria-label={tx('¿Qué te frenó?')}>
                  {MOTIVOS.map(([k, texto_]) => (
                    <button key={k} type="button" role="radio" aria-checked={motivo === k} onClick={() => setMotivo(k)}
                      className={`flex w-full items-center rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold ${motivo === k ? 'border-brand-400 bg-brand-500/15 text-brand-100' : 'border-dark-700 text-dark-100'}`}>
                      {tx(texto_)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label htmlFor="opinion-texto" className="mt-4 block text-[14px] text-dark-300">{tx('¿Qué es lo que más te complica en tu día de reparto? (opcional)')}</label>
            <textarea id="opinion-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={1500}
              className="mt-1 w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[16px] text-dark-50" />
            {err && <p role="alert" className="mt-1 text-[13px] text-red-300">{err}</p>}
            <button type="button" onClick={enviar} disabled={ocupado || !listo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta disabled:opacity-50">
              {ocupado && <Loader2 size={16} className="animate-spin" />} {tx('Enviar')}
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
