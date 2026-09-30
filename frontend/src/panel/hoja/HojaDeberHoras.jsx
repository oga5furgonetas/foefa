import { useMemo, useState } from 'react'
import { Trash2, Search } from 'lucide-react'
import { useRejilla } from './useRejilla'

/* DEBER HORAS — su registro de quién hizo horas o días de más y cómo se
   saldó (la tercera hoja de su Excel). Una fila por persona y día; sin nada
   en «Cómo se saldó», sigue pendiente. Arriba, a quién se le debe todavía.
   La última fila está vacía: se escribe en ella para apuntar una nueva, como
   en Excel. */

const COLS = [
  { k: 'fecha', titulo: 'Fecha', ancho: 'w-28' },
  { k: 'persona', titulo: 'Quién', ancho: 'min-w-[14rem]' },
  { k: 'cuanto', titulo: 'Cuánto', ancho: 'w-28' },
  { k: 'nota', titulo: 'Nota', ancho: 'min-w-[12rem]' },
  { k: 'saldado', titulo: 'Cómo se saldó', ancho: 'min-w-[13rem]' },
]

const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const fechaVista = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

/* «30/09/2026», «30/09» (este año), «30-9-26» o «2026-09-30» -> ISO; '' vacía;
   null si no es una fecha (no se adivina). */
export function leerFecha(texto, hoyIso) {
  const t = String(texto ?? '').trim()
  if (!t) return ''
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  let y, mo, d
  if (m) { [, y, mo, d] = m.map(Number) } else {
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/)
    if (!m) return null
    d = Number(m[1]); mo = Number(m[2])
    y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(String(hoyIso).slice(0, 4))
  }
  const f = new Date(Date.UTC(y, mo - 1, d))
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function HojaDeberHoras({ filas, hoyIso, crear, editar, borrar, deshacer, avisar }) {
  const [busca, setBusca] = useState('')
  const [soloPend, setSoloPend] = useState(false)
  const [nueva, setNueva] = useState({}) // lo escrito en la fila vacía antes de tener «quién»

  const visibles = useMemo(() => {
    const q = clave(busca)
    return filas.filter((f) => (!soloPend || !f.saldado) && (!q || clave(f.persona).includes(q)))
  }, [filas, busca, soloPend])

  // A quién se le debe todavía: por ficha si la tiene, si no por el nombre escrito.
  const pendientes = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      if (f.saldado) continue
      const k = f.driver_id || clave(f.persona)
      const x = m.get(k) || { nombre: f.persona, n: 0 }
      x.n += 1
      m.set(k, x)
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
  }, [filas])

  const N = visibles.length // la fila N es la vacía, para apuntar una nueva
  const texto = (r, c) => {
    const k = COLS[c].k
    const f = r < N ? visibles[r] : nueva
    if (!f) return ''
    return k === 'fecha' ? fechaVista(f.fecha) : (f[k] || '')
  }

  const aplicar = async (valores) => {
    const porFila = new Map()
    const malos = []
    for (const { r, c, valor } of valores) {
      if (r > N || c >= COLS.length) continue
      const k = COLS[c].k
      let v = String(valor ?? '').trim()
      if (k === 'fecha') {
        const f = leerFecha(v, hoyIso)
        if (f === null) { malos.push(v); continue }
        v = f
      }
      const x = porFila.get(r) || {}
      x[k] = v
      porFila.set(r, x)
    }
    if (malos.length) avisar(`Eso no es una fecha: «${malos.slice(0, 3).join('», «')}». Escríbela como 30/09 o 30/09/2026.`, true)
    for (const [r, campos] of porFila) {
      if (r < N) {
        const f = visibles[r]
        const cambios = Object.fromEntries(Object.entries(campos).filter(([k, v]) => v !== (f[k] || '')))
        if (!Object.keys(cambios).length) continue
        if ('persona' in cambios && !cambios.persona) { avisar('«Quién» no se puede dejar vacío: para quitar la fila, usa la papelera.', true); continue }
        await editar(f, cambios)
      } else {
        const junto = { ...nueva, ...campos }
        if (!String(junto.persona || '').trim()) { setNueva(junto); continue }
        setNueva({})
        await crear({ fecha: junto.fecha || '', persona: junto.persona, cuanto: junto.cuanto || '',
          nota: junto.nota || '', saldado: junto.saldado || '' })
      }
    }
  }

  const g = useRejilla({
    filas: N + 1,
    cols: COLS.length,
    texto,
    editable: () => true,
    onGuardar: (r, c, valor) => aplicar([{ r, c, valor }]),
    onBorrar: (rg) => {
      const v = []
      for (let r = rg.r0; r <= rg.r1; r++) {
        for (let c = rg.c0; c <= rg.c1; c++) {
          if (COLS[c].k === 'persona' && r < N) continue // «quién» no se vacía: se quita la fila
          if (texto(r, c) !== '') v.push({ r, c, valor: '' })
        }
      }
      return v.length ? aplicar(v) : null
    },
    onPegar: (r0, c0, matriz) => {
      // Pegar filas enteras debajo crea filas nuevas, una por línea.
      const v = []
      const nuevas = []
      matriz.forEach((fila, i) => {
        const r = r0 + i
        if (r < N) fila.forEach((valor, j) => { if (c0 + j < COLS.length) v.push({ r, c: c0 + j, valor }) })
        else {
          const x = {}
          fila.forEach((valor, j) => { if (c0 + j < COLS.length) x[COLS[c0 + j].k] = String(valor ?? '').trim() })
          nuevas.push(x)
        }
      })
      return (async () => {
        await aplicar(v)
        for (const x of nuevas) {
          if (!x.persona) continue
          const f = x.fecha ? leerFecha(x.fecha, hoyIso) : ''
          if (f === null) { avisar(`Fila sin apuntar: «${x.fecha}» no es una fecha.`, true); continue }
          await crear({ fecha: f, persona: x.persona, cuanto: x.cuanto || '', nota: x.nota || '', saldado: x.saldado || '' })
        }
      })()
    },
    onDeshacer: deshacer,
  })

  const clase = (r, c) => `${g.enSel(r, c) ? 'bg-brand-500/20' : ''} ${
    g.activa.r === r && g.activa.c === c ? 'outline outline-2 -outline-offset-2 outline-brand-400' : ''}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-dark-700 bg-dark-900 px-3 py-2">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-dark-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar a alguien…" aria-label="Buscar en deber horas"
            className="input w-52 py-1 pl-7 text-[12.5px]" />
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-dark-300">
          <input type="checkbox" checked={soloPend} onChange={(e) => setSoloPend(e.target.checked)} /> Solo lo pendiente
        </label>
        <p className="ml-auto text-[12px] text-dark-400">
          {pendientes.length
            ? <>Se debe todavía a <b className="text-amber-300">{pendientes.length}</b>: {pendientes.slice(0, 8).map((x) => `${x.nombre}${x.n > 1 ? ` (${x.n})` : ''}`).join(' · ')}{pendientes.length > 8 ? '…' : ''}</>
            : 'No se le debe nada a nadie.'}
        </p>
      </div>
      <div {...g.propsCaja} className="min-h-0 flex-1 overflow-auto outline-none" aria-label="Hoja DEBER HORAS">
        <table className="border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-8 border-b border-r border-dark-700 bg-dark-900 px-1 text-[10px] text-dark-500">#</th>
              {COLS.map((col) => (
                <th key={col.k} className={`sticky top-0 z-10 border-b border-r border-dark-700 bg-dark-900 px-2 py-1.5 text-left text-[10px] uppercase tracking-wide text-dark-500 ${col.ancho}`}>{col.titulo}</th>
              ))}
              <th className="sticky top-0 z-10 border-b border-dark-700 bg-dark-900 px-2 text-[10px] uppercase tracking-wide text-dark-500">Estado</th>
              <th className="sticky top-0 z-10 w-8 border-b border-dark-700 bg-dark-900" />
            </tr>
          </thead>
          <tbody>
            {[...visibles, null].map((f, r) => (
              <tr key={f ? f.id : 'nueva'} className={f && !f.saldado ? 'bg-amber-500/[0.05]' : ''}>
                <td className="sticky left-0 z-10 border-b border-r border-dark-800 bg-dark-900 px-1 text-center text-[10px] text-dark-500">{f ? r + 1 : '+'}</td>
                {COLS.map((col, c) => (
                  <td key={col.k} {...g.propsCelda(r, c)}
                    className={`relative h-7 cursor-cell select-none border-b border-r border-dark-800 px-0 ${f ? 'text-dark-100' : 'text-dark-500'} ${clase(r, c)}`}>
                    <span className="block truncate px-2">
                      {texto(r, c) || (!f && c === 1 ? <span className="italic text-dark-500">escribe aquí para apuntar otra…</span> : '')}
                    </span>
                    {g.editando && g.editando.r === r && g.editando.c === c && (
                      <input {...g.propsEditor} aria-label="Editar celda"
                        className="absolute inset-0 z-10 w-full bg-dark-900 px-2 text-[12.5px] text-dark-50 outline outline-2 outline-brand-400" />
                    )}
                  </td>
                ))}
                <td className="border-b border-dark-800 px-2">
                  {f && (f.saldado
                    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">saldado</span>
                    : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">pendiente</span>)}
                </td>
                <td className="border-b border-dark-800 px-1 text-center">
                  {f && (
                    <button onClick={() => { if (window.confirm(`¿Quitar la fila de ${f.persona}${f.fecha ? ` del ${fechaVista(f.fecha)}` : ''}?`)) borrar(f) }}
                      aria-label={`Quitar la fila de ${f.persona}`} className="text-dark-500 hover:text-red-300">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
