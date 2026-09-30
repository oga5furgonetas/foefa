import { memo, useMemo } from 'react'
import { Lock } from 'lucide-react'
import { useRejilla } from './useRejilla'
import {
  ABREV, TRABAJO, LETRA, MES, claseCodigo, claseDif, signo, wd, COLUMNA_DOMINGO, leerCodigo, septimosDe,
} from '../cuadranteComun'

/* MENSUAL — la rejilla del cuadrante como su hoja MENSUAL, pero sin copiar y
   pegar: lo que se escribe aquí es el turno de verdad. Personas en filas, días
   en columnas, y abajo RUTAS (cuenta de 1), MÁXIMA (se escribe) y DIFERENCIA.
   El nombre lleva el color de su hoja: azul horario fijo, melocotón solo
   finde, amarillo se va; el rosa de la celda es el día extra. */

export const AYUDA_CODIGOS = 'Escribe 1, N/T, V, BAJA, N/D, BKP, RA, S, N/P, o 1E para un día extra.'

/* Un espacio suelto tecleado encima no vacía la celda (para vaciar está Supr).
   Lo que llega vacío de verdad —Supr, o una celda vacía pegada de Excel— sí. */
export const soloEspacios = (v) => v !== '' && v != null && String(v).trim() === ''

/* Vaciar o pegar mucho de golpe (Ctrl+A y Supr se lleva el mes entero) se
   confirma antes: se puede deshacer, pero mejor no tener que hacerlo. */
export function confirmarMucho(n, que) {
  if (n <= (que === 'pegar' ? 200 : 40)) return true
  return window.confirm(que === 'pegar'
    ? `Vas a pegar ${n} celdas. ¿Seguro?`
    : `Vas a vaciar ${n} celdas. ¿Seguro? (Ctrl+Z lo deshace)`)
}

// Lo que sale al copiar y lo que se ve al editar: el extra como en su DIARIO.
export function textoCelda(c) {
  if (!c?.cod) return ''
  return c.extra && c.cod === '1' ? '1.EXTRA' : c.cod
}

export function colorNombre(p, desde, hasta) {
  if (p.inactivo_desde && p.inactivo_desde <= hasta) return 'bg-yellow-400/30'
  if (p.tipo === 'empresa') return 'bg-sky-500/25'
  if (p.tipo === 'finde') return 'bg-orange-300/35'
  return ''
}

/* Una fila de persona. Memorizada: al moverse por la hoja solo se vuelven a
   pintar las filas que tocan la selección (antes, las 68 en cada tecla). */
const FilaPersona = memo(function FilaPersona({ p, r, dias, celdas, sc0, sc1, activaC, septimosFila, hoy, desde, hasta, editorC, editor }) {
  let dTrab = 0
  let dExt = 0
  return (
    <tr>
      <td className="sticky left-0 z-10 border-b border-r border-dark-800 bg-dark-900 px-1 text-center text-[10px] text-dark-500">{r + 1}</td>
      <td className="sticky left-8 z-10 max-w-[9.5rem] truncate border-b sm:max-w-[16rem] border-r border-dark-700 bg-dark-900 px-2 font-semibold text-dark-100"
        title={[p.nombre, p.nota].filter(Boolean).join(' · ')}>
        <span className={`-mx-2 block truncate px-2 ${colorNombre(p, desde, hasta)}`}>{p.nombre}</span>
      </td>
      {dias.map((f, c) => {
        const cel = celdas?.[f] || null
        if (cel && TRABAJO.has(cel.cod) && !cel.otro_centro) dTrab += 1
        if (cel?.extra) dExt += 1
        const cod = cel?.cod || ''
        const septimo = septimosFila?.has(f)
        return (
          <td key={f} data-celda={`${r}-${c}`}
            title={`${p.nombre} · ${f.split('-').reverse().join('/')}${cel?.aprobado ? ' · día concedido' : ''}${cel?.fijada ? ' · con candado' : ''}${
              cel?.otro_centro ? ` · en ${cel.otro_centro}` : ''}${septimo ? ' · 7º DÍA SEGUIDO' : ''}`}
            className={`relative h-6 cursor-cell select-none scroll-mb-[4.75rem] scroll-ml-[11.5rem] scroll-mt-[3.6rem] sm:scroll-ml-[18.5rem] border-b border-r border-dark-800 p-0 text-center font-bold ${
              wd(f) === 6 ? COLUMNA_DOMINGO : f === hoy ? 'bg-amber-400/[0.06]' : ''} ${
              wd(f) === 0 && f !== desde ? 'border-l-2 border-l-dark-600' : ''} ${c >= sc0 && c <= sc1 ? 'bg-brand-500/20' : ''} ${
              c === activaC ? 'outline outline-2 -outline-offset-2 outline-brand-400' : ''}`}>
            <span className={`mx-[1px] flex h-[22px] items-center justify-center rounded-[3px] text-[11px] ${cod ? claseCodigo(cod, cel?.extra, wd(f) === 6) : ''} ${
              cel?.otro_centro ? 'opacity-40' : ''} ${septimo ? 'ring-2 ring-inset ring-red-500' : ''}`}>
              {cod ? (ABREV[cod] || cod) : ''}
              {cel?.fijada && <Lock size={7} className="absolute right-[3px] top-[3px] opacity-60" />}
            </span>
            {c === editorC ? editor : null}
          </td>
        )
      })}
      <td className="border-b border-dark-800 px-2 text-center font-semibold text-dark-300">{dTrab}</td>
      <td className="border-b border-dark-800 px-2 text-center text-dark-400">{dExt || ''}</td>
    </tr>
  )
})

export default function HojaMensual({ datos, dias, celda, porDia, guardarCeldas, guardarMaximas, deshacer, avisar }) {
  const personas = useMemo(() => datos?.personas || [], [datos])
  const P = personas.length
  const hoy = datos?.hoy
  const desde = dias[0]
  const hasta = dias[dias.length - 1]
  // El 7º día seguido, en rojo como en la rejilla: escribiendo rápido es donde se cuela.
  const septimos = useMemo(() => septimosDe(personas, celda, desde, hasta), [personas, celda, desde, hasta])
  // Por fila y estables mientras no cambien los datos: es lo que deja a las
  // filas memorizadas no pintarse de nuevo al mover la selección.
  const porFila = useMemo(() => {
    const m = {}
    for (const p of personas) {
      const x = {}
      for (const f of dias) x[f] = celda(p.id, f)
      m[p.id] = x
    }
    return m
  }, [personas, dias, celda])
  const septimosPorFila = useMemo(() => {
    const m = {}
    for (const k of septimos) {
      const [pid, f] = k.split('|')
      ;(m[pid] = m[pid] || new Set()).add(f)
    }
    return m
  }, [septimos])

  // Filas 0..P-1 personas; fila P, la MÁXIMA (se escribe). Columnas: los días.
  const texto = (r, c) => {
    const f = dias[c]
    if (r === P) return datos?.maximas?.[f] ?? ''
    return textoCelda(celda(personas[r]?.id, f))
  }
  const editable = (r, c) => {
    if (r === P) return true
    const cel = celda(personas[r]?.id, dias[c])
    return !cel?.otro_centro
  }

  const aCambios = (valores) => {
    // valores: [{r, c, valor}] -> {celdas: [...], maximas: {...}, malos: [...]}
    const celdas = []
    const maximas = {}
    const malos = []
    for (const { r, c, valor } of valores) {
      const f = dias[c]
      if (!f || r > P || soloEspacios(valor)) continue
      if (r === P) {
        const t = String(valor ?? '').trim()
        if (t === '') { maximas[f] = null; continue }
        const n = Number(t.replace(',', '.'))
        if (!Number.isInteger(n) || n < 0 || n > 999) { malos.push(t); continue }
        maximas[f] = n
        continue
      }
      const p = personas[r]
      const cel = celda(p.id, f)
      if (cel?.otro_centro) { malos.push(`${p.nombre} el ${f.slice(8)}: está en ${cel.otro_centro}`); continue }
      const leido = leerCodigo(valor)
      if (!leido) { malos.push(String(valor).trim()); continue }
      if ((cel?.cod || '') === leido.cod && Boolean(cel?.extra) === leido.extra) continue
      celdas.push({ driver_id: p.id, fecha: f, cod: leido.cod, extra: leido.extra })
    }
    return { celdas, maximas, malos }
  }

  const aplicar = async (valores) => {
    const { celdas, maximas, malos } = aCambios(valores)
    if (malos.length) {
      avisar(`No se ha cambiado lo que no se entiende: «${malos.slice(0, 4).join('», «')}»${malos.length > 4 ? '…' : ''}. ${AYUDA_CODIGOS}`, true)
    }
    if (celdas.length) await guardarCeldas(celdas)
    if (Object.keys(maximas).length) await guardarMaximas(maximas)
  }

  const g = useRejilla({
    filas: P + 1,
    cols: dias.length,
    texto,
    editable,
    onGuardar: (r, c, valor) => aplicar([{ r, c, valor }]),
    onBorrar: (rg) => {
      const v = []
      for (let r = rg.r0; r <= rg.r1; r++) for (let c = rg.c0; c <= rg.c1; c++) if (texto(r, c) !== '') v.push({ r, c, valor: '' })
      return v.length && confirmarMucho(v.length, 'vaciar') ? aplicar(v) : null
    },
    onPegar: (r0, c0, matriz) => {
      const v = []
      matriz.forEach((fila, i) => fila.forEach((valor, j) => {
        if (r0 + i <= P && c0 + j < dias.length) v.push({ r: r0 + i, c: c0 + j, valor })
      }))
      return v.length && confirmarMucho(v.length, 'pegar') ? aplicar(v) : null
    },
    onDeshacer: deshacer,
  })

  const clase = (r, c) => `${g.enSel(r, c) ? 'bg-brand-500/20' : ''} ${
    g.activa.r === r && g.activa.c === c ? 'outline outline-2 -outline-offset-2 outline-brand-400' : ''}`
  const editor = (r, c) => (g.editando && g.editando.r === r && g.editando.c === c
    ? <input {...g.propsEditor} aria-label="Editar celda"
        className="absolute inset-0 z-10 w-full bg-dark-900 px-1 text-center text-[12px] font-bold uppercase text-dark-50 outline outline-2 outline-brand-400" />
    : null)

  return (
    <div {...g.propsCaja} className="h-full overflow-auto outline-none" aria-label="Hoja MENSUAL">
      <table className="border-separate border-spacing-0 text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-8 min-w-[2rem] border-b border-r border-dark-700 bg-dark-900 px-1 text-[10px] text-dark-500">#</th>
            <th className="sticky left-8 top-0 z-30 min-w-[8.5rem] border-b sm:min-w-[14rem] border-r border-dark-700 bg-dark-900 px-2 text-left text-[10px] uppercase tracking-wide text-dark-500">Nombre</th>
            {dias.map((f) => (
              <th key={f} className={`sticky top-0 z-20 min-w-[2.9rem] border-b border-r border-dark-800 bg-dark-900 p-0 text-center font-semibold ${
                wd(f) === 0 && f !== desde ? 'border-l-2 border-l-dark-600' : ''}`}>
                {/* Fondo opaco en la celda fija y el tinte dentro: si no, lo que
                    pasa por debajo al bajar se transparenta. */}
                <span className={`block px-0.5 py-1 ${wd(f) === 6 ? 'bg-orange-500/15 text-orange-300' : f === hoy ? 'bg-amber-400/10 text-amber-300' : 'text-dark-400'}`}>
                  {f.slice(8) === '01' && <span className="block text-[8.5px] font-bold text-red-400">{MES[Number(f.slice(5, 7)) - 1]}</span>}
                  <span className="block text-[9px]">{LETRA[wd(f)]}</span>
                  <span className="block">{Number(f.slice(8))}</span>
                </span>
              </th>
            ))}
            <th className="sticky top-0 z-20 border-b border-dark-700 bg-dark-900 px-2 text-[10px] text-dark-500" title="Días trabajados en lo que ves">Días</th>
            <th className="sticky top-0 z-20 border-b border-dark-700 bg-dark-900 px-2 text-[10px] text-dark-500" title="Días extra en lo que ves">Ext</th>
          </tr>
        </thead>
        <tbody>
          {personas.map((p, r) => {
            const enFila = r >= g.rango.r0 && r <= g.rango.r1
            return (
              <FilaPersona key={p.id} p={p} r={r} dias={dias} celdas={porFila[p.id]} hoy={hoy} desde={desde} hasta={hasta}
                sc0={enFila ? g.rango.c0 : -1} sc1={enFila ? g.rango.c1 : -2} activaC={g.activa.r === r ? g.activa.c : -1}
                septimosFila={septimosPorFila[p.id]} editorC={g.editando?.r === r ? g.editando.c : -1}
                editor={g.editando?.r === r ? editor(r, g.editando.c) : null} />
            )
          })}
          {/* RUTAS, MÁXIMA y DIFERENCIA se quedan abajo a la vista mientras se
              baja por la gente, como con paneles inmovilizados en Excel. */}
          <tr>
            <td className="sticky bottom-12 left-0 z-20 h-6 border-t-2 border-dark-600 bg-dark-900" />
            <td className="sticky bottom-12 left-8 z-20 h-6 border-r border-t-2 border-dark-600 bg-dark-900 px-2 text-[11px] font-bold text-dark-200">RUTAS (cuenta de 1)</td>
            {dias.map((f) => (
              <td key={f} className="sticky bottom-12 z-10 h-6 border-r border-t-2 border-dark-600 bg-dark-900 p-0 text-center">
                <span className={`block h-full py-0.5 ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                  <span className="mx-[1px] block rounded-[3px] bg-sky-500/20 py-0.5 text-[11px] font-bold text-sky-300">{porDia[f]?.rutas}</span>
                </span>
              </td>
            ))}
            <td colSpan={2} className="sticky bottom-12 z-10 h-6 border-t-2 border-dark-600 bg-dark-900" />
          </tr>
          <tr>
            <td className="sticky bottom-6 left-0 z-20 h-6 bg-dark-900" />
            <td className="sticky bottom-6 left-8 z-20 h-6 border-r border-dark-700 bg-dark-900 px-2 text-[11px] font-bold text-dark-200">MÁXIMA</td>
            {dias.map((f, c) => (
              <td key={f} {...g.propsCelda(P, c)}
                className={`sticky bottom-6 z-10 h-6 cursor-cell select-none border-b border-r border-dark-800 bg-dark-900 p-0 text-center text-[11px] font-bold text-dark-100`}>
                <span className={`flex h-6 items-center justify-center ${wd(f) === 6 ? COLUMNA_DOMINGO : ''} ${clase(P, c)}`}>
                  {datos?.maximas?.[f] ?? ''}
                </span>
                {editor(P, c)}
              </td>
            ))}
            <td colSpan={2} className="sticky bottom-6 z-10 h-6 bg-dark-900" />
          </tr>
          <tr>
            <td className="sticky bottom-0 left-0 z-20 h-6 bg-dark-900" />
            <td className="sticky bottom-0 left-8 z-20 h-6 border-r border-dark-700 bg-dark-900 px-2 text-[11px] font-bold text-dark-200">DIFERENCIA</td>
            {dias.map((f) => {
              const d = porDia[f] || {}
              return (
                <td key={f} className="sticky bottom-0 z-10 h-6 border-r border-dark-800 bg-dark-900 p-0 text-center">
                  <span className={`block h-full py-0.5 ${wd(f) === 6 ? COLUMNA_DOMINGO : ''}`}>
                    <span className={`mx-[1px] block rounded-[3px] py-0.5 text-[11px] font-bold ${claseDif(d)}`}>{signo(d.dif)}</span>
                  </span>
                </td>
              )
            })}
            <td colSpan={2} className="sticky bottom-0 z-10 h-6 bg-dark-900" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
