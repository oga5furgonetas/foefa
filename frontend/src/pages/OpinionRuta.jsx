/* diseño compacto */
import { useEffect, useState } from 'react'
import { Star, Lightbulb, ChevronDown } from 'lucide-react'
import { opinionEstado, opinionEnviar } from '../panel/api'
import { tx, useIdioma, txError } from '../lib/idioma'
import Boton from './driver/piezas/Boton'
import Campo from './driver/piezas/Campo'

/* ¿QUÉ TAL TE VA? (05-10-2026): a quien se registró y ya ha hecho entregas de
   verdad se le pregunta UNA vez qué le falta. Lo decide el servidor (`pedir`):
   cuenta de más de 20 h y 2 entregas reales. «Ahora no» no vuelve a preguntar.
   Compacta desde el 07-11-2026 (§5.1 i): el título, las estrellas y el campo al tocar una estrella.
   A todo el ancho de la columna (08-11-2026): con `mx-auto` solo, un flex en columna la encogía a lo que mide su contenido. */
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
    <section className="mx-auto w-full max-w-md rounded-xl bg-dark-900 p-3" aria-label={tx('¿Qué tal te va la app?')}>
      {hecho ? <p role="status" className="text-center text-nombre text-ruta-marca">{tx('¡Gracias! Lo leo yo personalmente.')}</p> : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-nombre text-dark-50">{tx('¿Qué tal te va la app?')}</p>
            <Boton variante="texto" tono="neutro" texto={tx('Ahora no')} onClick={saltar} className="shrink-0" />
          </div>
          <div className="mt-1 flex" role="group" aria-label={tx('Nota de 1 a 5')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setNota(n)} aria-label={String(n)} aria-pressed={nota === n}
                className="flex h-12 w-12 items-center justify-center rounded-lg"><Star size={28} className={n <= nota ? 'fill-ruta-aviso-texto text-ruta-aviso-texto' : 'text-dark-400'} aria-hidden="true" /></button>
            ))}
          </div>
          {nota > 0 && (
            <>
              <Campo multilinea filas={3} valor={texto} onChange={setTexto} maxLength={1500} ejemplo={tx('Escribe aquí qué te falta o qué mejorarías')} className="mt-2" />
              {err && <p role="alert" className="mt-1 text-sec text-ruta-peligro-texto">{err}</p>}
              <Boton variante="normal" texto={tx('Enviar mi opinión')} onClick={enviar} disabled={ocupado || (!nota && !texto.trim())} cargando={ocupado} className="mt-2 w-full" />
            </>
          )}
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
      // El error entero (no solo su `data`): en el iPhone txError mira también el código HTTP (cualquier 402 sale neutro).
      setErr(txError(e, 'No se ha podido enviar. Inténtalo otra vez.'))
    } finally { setOcupado(false) }
  }
  return (
    <section className="mt-4 rounded-xl bg-dark-900 p-4">
      <button type="button" onClick={() => { setAbierto((v) => !v); setHecho(false); setErr('') }} aria-expanded={abierto}
        className="flex w-full items-center gap-3 text-left">
        <Lightbulb size={20} className="shrink-0 text-ruta-marca" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-nombre text-dark-50">{tx('Mándanos una idea')}</span>
          <span className="block text-sec text-dark-400">{tx('¿Algo que no va o que echas en falta? Lo leo yo y te contesto por correo.')}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-dark-400 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {abierto && (hecho ? (
        <p role="status" className="mt-3 text-nombre text-ruta-marca">{tx('¡Recibido! Gracias.')}</p>
      ) : (
        <div className="mt-3">
          <Campo multilinea filas={4} valor={texto} onChange={setTexto} maxLength={1500} autoFocus
            nombre={tx('Mándanos una idea')} ejemplo={tx('Escribe tu idea o lo que no te funciona')} />
          {err && <p role="alert" className="mt-1 text-sec text-ruta-peligro-texto">{err}</p>}
          <Boton variante="normal" texto={tx('Enviar')} onClick={enviar} disabled={ocupado || !texto.trim()} cargando={ocupado} className="mt-2 w-full" />
        </div>
      ))}
    </section>
  )
}
