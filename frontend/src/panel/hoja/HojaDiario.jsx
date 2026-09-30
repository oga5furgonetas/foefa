import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { useRejilla } from './useRejilla'
import { ABREV, DIA, claseCodigo, claseDif, signo, wd, leerCodigo } from '../cuadranteComun'
import { textoCelda, colorNombre, AYUDA_CODIGOS } from './HojaMensual'

/* DIARIO — un día, como su hoja DIARIO: cada persona con su código de ese día
   y sus apuntes (la wave o quién le sustituye, la rosterización, los días
   libres), más las notas del día («furgonetas que pueden entrar en la Illa»).
   El código es el MISMO turno que el mensual: no se pega un día encima del
   otro, que es lo que le creaba días de más (30-09-2026). */

const COLS = [
  { k: 'cod', titulo: 'Día', ancho: 'w-20' },
  { k: 'nota', titulo: 'Nota (wave, quién sustituye…)', ancho: 'min-w-[14rem]' },
  { k: 'roster', titulo: 'Rosterización', ancho: 'min-w-[14rem]' },
  { k: 'libres', titulo: 'Días libres', ancho: 'min-w-[12rem]' },
]

// Semana ISO, la que pone su hoja («SEMANA 40» el 30-09-2026).
export function semanaIso(iso) {
  const [y, m, dd] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, dd))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))   // el jueves de esa semana
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - inicio) / 86400000 + 1) / 7)
}

export default function HojaDiario({ fecha, datos, apuntes, celda, resumen, guardarCeldas, guardarApuntes, guardarNotas, deshacer, avisar }) {
  const personas = useMemo(() => datos?.personas || [], [datos])
  const [notas, setNotas] = useState(apuntes?.notas || '')
  useEffect(() => { setNotas(apuntes?.notas || '') }, [apuntes?.notas, fecha])
  const filas = apuntes?.filas || {}

  const texto = (r, c) => {
    const p = personas[r]
    if (!p) return ''
    if (c === 0) return textoCelda(celda(p.id, fecha))
    return filas[p.id]?.[COLS[c].k] || ''
  }
  const editable = (r, c) => c > 0 || !celda(personas[r]?.id, fecha)?.otro_centro

  const aplicar = async (valores) => {
    const celdas = []
    const textos = []
    const malos = []
    for (const { r, c, valor } of valores) {
      const p = personas[r]
      if (!p || c >= COLS.length) continue
      if (c === 0) {
        const cel = celda(p.id, fecha)
        if (cel?.otro_centro) { malos.push(`${p.nombre}: está en ${cel.otro_centro}`); continue }
        const leido = leerCodigo(valor)
        if (!leido) { malos.push(String(valor).trim()); continue }
        if ((cel?.cod || '') === leido.cod && Boolean(cel?.extra) === leido.extra) continue
        celdas.push({ driver_id: p.id, fecha, cod: leido.cod, extra: leido.extra })
      } else {
        const v = String(valor ?? '').trim()
        if (v === (filas[p.id]?.[COLS[c].k] || '')) continue
        textos.push({ driver_id: p.id, campo: COLS[c].k, valor: v, antes: filas[p.id]?.[COLS[c].k] || '' })
      }
    }
    if (malos.length) {
      avisar(`No se ha cambiado lo que no se entiende: «${malos.slice(0, 4).join('», «')}»${malos.length > 4 ? '…' : ''}. ${AYUDA_CODIGOS}`, true)
    }
    if (celdas.length) await guardarCeldas(celdas)
    if (textos.length) await guardarApuntes(textos)
  }

  const g = useRejilla({
    filas: personas.length,
    cols: COLS.length,
    texto,
    editable,
    onGuardar: (r, c, valor) => aplicar([{ r, c, valor }]),
    onBorrar: (rg) => {
      const v = []
      for (let r = rg.r0; r <= rg.r1; r++) for (let c = rg.c0; c <= rg.c1; c++) if (texto(r, c) !== '') v.push({ r, c, valor: '' })
      return v.length ? aplicar(v) : null
    },
    onPegar: (r0, c0, matriz) => {
      const v = []
      matriz.forEach((fila, i) => fila.forEach((valor, j) => {
        if (r0 + i < personas.length && c0 + j < COLS.length) v.push({ r: r0 + i, c: c0 + j, valor })
      }))
      return aplicar(v)
    },
    onDeshacer: deshacer,
  })

  const clase = (r, c) => `${g.enSel(r, c) ? 'bg-brand-500/20' : ''} ${
    g.activa.r === r && g.activa.c === c ? 'outline outline-2 -outline-offset-2 outline-brand-400' : ''}`
  const r0 = resumen || {}
  const domingo = wd(fecha) === 6

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div {...g.propsCaja} className="min-h-0 flex-1 overflow-auto outline-none" aria-label="Hoja DIARIO">
        <div className="sticky left-0 top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-dark-700 bg-dark-900 px-3 py-2 text-[12.5px]">
          <span className="font-mono text-[11px] font-bold tracking-wider text-brand-400">SEMANA {semanaIso(fecha)}</span>
          <span className={`font-semibold capitalize ${domingo ? 'text-orange-300' : 'text-dark-100'}`}>{DIA[wd(fecha)]} {fecha.split('-').reverse().join('/')}</span>
          <span className="text-dark-300">Rutas <b className="text-sky-300">{r0.rutas ?? '—'}</b></span>
          <span className="text-dark-300">Máxima <b className="text-dark-100">{r0.maxima ?? '—'}</b></span>
          <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${claseDif(r0)}`}>{signo(r0.dif)}</span>
        </div>
        <table className="border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-9 z-20 w-8 border-b border-r border-dark-700 bg-dark-900 px-1 text-[10px] text-dark-500">#</th>
              <th className="sticky left-8 top-9 z-20 min-w-[14rem] border-b border-r border-dark-700 bg-dark-900 px-2 text-left text-[10px] uppercase tracking-wide text-dark-500">Nombre</th>
              {COLS.map((col) => (
                <th key={col.k} className={`sticky top-9 z-10 border-b border-r border-dark-700 bg-dark-900 px-2 py-1.5 text-left text-[10px] uppercase tracking-wide text-dark-500 ${col.ancho}`}>{col.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personas.map((p, r) => {
              const cel = celda(p.id, fecha)
              const cod = cel?.cod || ''
              return (
                <tr key={p.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-dark-800 bg-dark-900 px-1 text-center text-[10px] text-dark-500">{r + 1}</td>
                  <td className="sticky left-8 z-10 max-w-[16rem] truncate border-b border-r border-dark-700 bg-dark-900 px-2 font-semibold text-dark-100">
                    <span className={`-mx-2 block truncate px-2 ${colorNombre(p, fecha, fecha)}`}>{p.nombre}</span>
                  </td>
                  {COLS.map((col, c) => (
                    <td key={col.k} {...g.propsCelda(r, c)}
                      title={c === 0 && cel?.aprobado ? 'Día concedido' : undefined}
                      className={`relative h-7 cursor-cell select-none border-b border-r border-dark-800 px-0 ${c === 0 ? 'text-center font-bold' : 'text-dark-200'} ${clase(r, c)}`}>
                      {c === 0 ? (
                        <span className={`mx-[2px] flex h-[24px] items-center justify-center rounded-[3px] text-[11.5px] ${cod ? claseCodigo(cod, cel?.extra, domingo) : ''} ${cel?.otro_centro ? 'opacity-40' : ''}`}>
                          {cod ? (ABREV[cod] || cod) : ''}
                          {cel?.fijada && <Lock size={7} className="absolute right-[4px] top-[4px] opacity-60" />}
                        </span>
                      ) : (
                        <span className="block truncate px-2">{filas[p.id]?.[col.k] || ''}</span>
                      )}
                      {g.editando && g.editando.r === r && g.editando.c === c && (
                        <input {...g.propsEditor} aria-label="Editar celda"
                          className={`absolute inset-0 z-10 w-full bg-dark-900 px-2 text-[12.5px] text-dark-50 outline outline-2 outline-brand-400 ${c === 0 ? 'text-center font-bold uppercase' : ''}`} />
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <aside className="flex w-full flex-col border-t border-dark-700 bg-dark-900 p-3 lg:w-80 lg:border-l lg:border-t-0">
        <label htmlFor="notas-dia" className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-dark-500">Notas del día</label>
        <textarea id="notas-dia" value={notas} onChange={(e) => setNotas(e.target.value)} rows={8}
          onBlur={() => { if (notas !== (apuntes?.notas || '')) guardarNotas(notas) }}
          placeholder="Lo que haya que saber hoy: furgonetas que pueden entrar en la Illa, quién no puede mañana…"
          className="input min-h-[9rem] w-full flex-1 resize-y text-[12.5px]" />
        <p className="mt-2 text-[11px] leading-snug text-dark-500">Se guarda al salir del cuadro. {apuntes?.por ? `Último cambio: ${apuntes.por}.` : ''}</p>
      </aside>
    </div>
  )
}
