import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Upload, Keyboard, Loader2, Check, AlertTriangle, Sheet } from 'lucide-react'
import {
  getCuadrante, cuadranteCeldas, cuadranteMaximas, cuadranteDeshacer, getDiario, guardarDiario,
  getDeberHoras, anadirDeberHoras, editarDeberHoras, borrarDeberHoras, importarDeberHoras,
} from '../api'
import { lista } from '../../lib/lista'
import { hoyLocal } from '../../lib/fecha'
import { rangoDias, sumaDias, resumenDias } from '../cuadranteComun'
import HojaMensual from './HojaMensual'
import HojaDiario from './HojaDiario'
import HojaDeberHoras from './HojaDeberHoras'

/* LA HOJA DEL CUADRANTE — el cuadrante en grande, como su Excel.

   Dani, 30-09-2026: «nosotros usamos un Excel, que es mayor maniobrabilidad
   + accesibilidad; ¿se puede mejorar en la app, que si le clicas se expanda y
   sea un propio Excel con su diario, su mensual y lo de deber horas, y se
   pueda editar?». A pantalla completa, con las pestañas abajo como en Excel:
     DIARIO       el día, con el código de cada uno y sus apuntes;
     MENSUAL      la rejilla de siempre, con RUTAS, MÁXIMA y DIFERENCIA;
     DEBER HORAS  quién hizo de más y cómo se saldó.
   El DIARIO y el MENSUAL son los MISMOS turnos: se acabó pegar un día encima
   del otro. Cada cambio se guarda al momento y Ctrl+Z lo deshace — solo lo
   que ha hecho esta hoja: si entre medias otra persona cambió el cuadrante,
   no se pisa lo suyo. */

const HOJAS = [['DIARIO', 'DIARIO'], ['MENSUAL', 'MENSUAL'], ['DEBER', 'DEBER HORAS']]

function leerHoja() {
  try { return localStorage.getItem('cuadrante.hoja') || 'MENSUAL' } catch { return 'MENSUAL' }
}

function colchonDe(datos) {
  return (f) => {
    const a = lista(datos?.ajustes).find((x) => x.tipo === 'colchon_dia' && x.fecha === f)
    return a ? a.colchon : (datos?.config?.colchon ?? 2)
  }
}

const ATAJOS = [
  ['Flechas', 'moverse (con Mayús, seleccionar)'], ['Escribir', 'sustituye lo que hay'],
  ['Enter / Tab', 'guarda y baja / pasa a la derecha'], ['F2 o doble clic', 'editar lo que hay'],
  ['Esc', 'dejarlo como estaba'], ['Supr', 'vaciar la selección'],
  ['Ctrl+C / Ctrl+V', 'copiar y pegar (también con tu Excel)'], ['Ctrl+Z', 'deshacer lo último de esta hoja'],
  ['1E', 'un día extra (en rosa)'],
]

export default function HojaCuadrante({ center, desde: desde0, hasta: hasta0, onCerrar }) {
  const [hoja, setHoja] = useState(leerHoja)
  const [desde, setDesde] = useState(desde0)
  const [hasta, setHasta] = useState(hasta0)
  const [fecha, setFecha] = useState(() => hoyLocal())
  const [mes, setMes] = useState(null)
  const [dia, setDia] = useState(null)
  const [apuntes, setApuntes] = useState(null)
  const [deber, setDeber] = useState(null)
  const [pila, setPila] = useState([])
  const [estado, setEstado] = useState({ txt: '', error: false })
  const [ayuda, setAyuda] = useState(false)
  const [previa, setPrevia] = useState(null)
  const fichero = useRef(null)

  const avisar = useCallback((txt, error = false) => setEstado({ txt, error }), [])
  const cambiarHoja = (h) => {
    setHoja(h)
    try { localStorage.setItem('cuadrante.hoja', h) } catch { /* sin almacenamiento: da igual */ }
  }

  const cargarMes = useCallback(async () => {
    try { setMes((await getCuadrante(center, desde, hasta)).data) } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido cargar el cuadrante.', true)
    }
  }, [center, desde, hasta, avisar])
  const cargarDia = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([getCuadrante(center, fecha, fecha), getDiario(center, fecha)])
      setDia(a.data); setApuntes(b.data)
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido cargar el día.', true)
    }
  }, [center, fecha, avisar])
  const cargarDeber = useCallback(async () => {
    try { setDeber(lista((await getDeberHoras(center)).data?.filas)) } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido cargar «deber horas».', true)
    }
  }, [center, avisar])

  useEffect(() => { if (hoja === 'MENSUAL') cargarMes() }, [hoja, cargarMes])
  useEffect(() => { if (hoja === 'DIARIO') cargarDia() }, [hoja, cargarDia])
  useEffect(() => { if (hoja === 'DEBER') cargarDeber() }, [hoja, cargarDeber])

  const recargarTurnos = useCallback(async () => {
    await Promise.all([mes ? cargarMes() : null, dia ? cargarDia() : null])
  }, [mes, dia, cargarMes, cargarDia])

  /* ── Guardar ─────────────────────────────────────────────────────────── */
  const guardarCeldas = useCallback(async (cambios) => {
    const enPantalla = (d) => {
      if (!d) return d
      const cel = { ...d.celdas }
      for (const c of cambios) {
        const k = `${c.driver_id}|${c.fecha}`
        if (!c.cod) delete cel[k]
        else cel[k] = { ...(cel[k] || {}), cod: c.cod, extra: Boolean(c.extra), fijada: true }
      }
      return { ...d, celdas: cel }
    }
    setMes(enPantalla); setDia(enPantalla)
    avisar('Guardando…')
    const bloqueadas = []
    const ids = []
    try {
      for (let i = 0; i < cambios.length; i += 500) {
        const r = await cuadranteCeldas(center, cambios.slice(i, i + 500))
        bloqueadas.push(...lista(r.data?.bloqueadas))
        if (r.data?.cambio_id) ids.push(r.data.cambio_id)
      }
      if (ids.length) setPila((p) => [...p, ...ids.map((id) => ({ tipo: 'servidor', id }))])
      const n = cambios.length - bloqueadas.length
      if (bloqueadas.length) {
        const m = bloqueadas[0].motivo || ''
        avisar(`${bloqueadas.length === 1 ? 'Una celda no se ha cambiado' : `${bloqueadas.length} celdas no se han cambiado`}: ${m}${
          m.includes('candado') ? ' (se quita en la rejilla del cuadrante, pulsando la celda)' : ''}.`, true)
      } else avisar(`Guardado: ${n} ${n === 1 ? 'celda' : 'celdas'}.`)
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido guardar.', true)
    }
    await recargarTurnos()
  }, [center, avisar, recargarTurnos])

  const guardarMaximas = useCallback(async (mapa) => {
    avisar('Guardando…')
    try {
      const r = await cuadranteMaximas(center, mapa)
      if (r.data?.cambio_id) setPila((p) => [...p, { tipo: 'servidor', id: r.data.cambio_id }])
      avisar('Máximas guardadas.')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido guardar la máxima.', true)
    }
    await recargarTurnos()
  }, [center, avisar, recargarTurnos])

  const guardarApuntes = useCallback(async (textos) => {
    setApuntes((a) => {
      const filas = { ...(a?.filas || {}) }
      for (const t of textos) {
        filas[t.driver_id] = { ...(filas[t.driver_id] || {}) }
        if (t.valor) filas[t.driver_id][t.campo] = t.valor
        else delete filas[t.driver_id][t.campo]
      }
      return { ...(a || {}), filas }
    })
    try {
      await guardarDiario(center, fecha, textos.map(({ driver_id, campo, valor }) => ({ driver_id, campo, valor })))
      setPila((p) => [...p, { tipo: 'diario', fecha, cambios: textos.map(({ driver_id, campo, antes }) => ({ driver_id, campo, valor: antes })) }])
      avisar('Guardado.')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido guardar.', true)
    }
    await cargarDia()
  }, [center, fecha, avisar, cargarDia])

  const guardarNotas = useCallback(async (notas) => {
    const antes = apuntes?.notas || ''
    try {
      await guardarDiario(center, fecha, [], notas)
      setPila((p) => [...p, { tipo: 'notas', fecha, antes }])
      avisar('Notas del día guardadas.')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se han podido guardar las notas.', true)
    }
    await cargarDia()
  }, [center, fecha, apuntes, avisar, cargarDia])

  const crearDeber = useCallback(async (body) => {
    try {
      const r = await anadirDeberHoras({ center, ...body })
      setPila((p) => [...p, { tipo: 'deber_nueva', id: r.data?.id }])
      avisar(`Apuntado: ${body.persona}.`)
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido apuntar.', true)
    }
    await cargarDeber()
  }, [center, avisar, cargarDeber])
  const editarDeber = useCallback(async (f, cambios) => {
    try {
      await editarDeberHoras(f.id, cambios)
      setPila((p) => [...p, { tipo: 'deber', id: f.id, antes: Object.fromEntries(Object.keys(cambios).map((k) => [k, f[k] || ''])) }])
      avisar('Guardado.')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido guardar.', true)
    }
    await cargarDeber()
  }, [avisar, cargarDeber])
  const borrarDeber = useCallback(async (f) => {
    try {
      await borrarDeberHoras(f.id)
      setPila((p) => [...p, { tipo: 'deber_borrada', fila: f }])
      avisar(`Quitada la fila de ${f.persona}.`)
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido quitar.', true)
    }
    await cargarDeber()
  }, [avisar, cargarDeber])

  /* ── Ctrl+Z ──────────────────────────────────────────────────────────── */
  const deshacer = useCallback(async () => {
    const u = pila[pila.length - 1]
    if (!u) { avisar('No hay nada que deshacer de esta hoja.'); return }
    setPila((p) => p.slice(0, -1))
    avisar('Deshaciendo…')
    try {
      if (u.tipo === 'servidor') await cuadranteDeshacer(center, u.id)
      else if (u.tipo === 'diario') await guardarDiario(center, u.fecha, u.cambios)
      else if (u.tipo === 'notas') await guardarDiario(center, u.fecha, [], u.antes)
      else if (u.tipo === 'deber') await editarDeberHoras(u.id, u.antes)
      else if (u.tipo === 'deber_nueva' && u.id) await borrarDeberHoras(u.id)
      else if (u.tipo === 'deber_borrada') {
        const { fecha: f, persona, cuanto, nota, saldado } = u.fila
        await anadirDeberHoras({ center, fecha: f || '', persona, cuanto: cuanto || '', nota: nota || '', saldado: saldado || '' })
      }
      avisar('Deshecho.')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido deshacer.', true)
    }
    if (u.tipo === 'servidor') await recargarTurnos()
    else if (u.tipo === 'diario' || u.tipo === 'notas') await cargarDia()
    else await cargarDeber()
  }, [pila, center, avisar, recargarTurnos, cargarDia, cargarDeber])

  /* ── Traer «deber horas» de su Excel ─────────────────────────────────── */
  const leerExcel = async (file) => {
    avisar('Leyendo el Excel…')
    try {
      const r = await importarDeberHoras(file, center, false)
      setPrevia({ file, ...r.data })
      avisar('')
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido leer el Excel.', true)
    }
  }
  const confirmarExcel = async () => {
    if (!previa?.file) return
    try {
      const r = await importarDeberHoras(previa.file, center, true)
      avisar(`Traídas ${r.data?.nuevas ?? 0} filas de tu Excel.`)
      setPrevia(null)
    } catch (e) {
      avisar(e?.response?.data?.detail || 'No se ha podido traer.', true)
    }
    await cargarDeber()
  }

  /* ── Datos de cada hoja ──────────────────────────────────────────────── */
  const dias = useMemo(() => rangoDias(desde, hasta, 92), [desde, hasta])
  const celdaMes = useCallback((did, f) => mes?.celdas?.[`${did}|${f}`] || null, [mes])
  const porDia = useMemo(() => resumenDias(dias, lista(mes?.personas), celdaMes, mes?.maximas, colchonDe(mes)),
    [dias, mes, celdaMes])
  const celdaDia = useCallback((did, f) => dia?.celdas?.[`${did}|${f}`] || null, [dia])
  const resumenDia = useMemo(() => resumenDias([fecha], lista(dia?.personas), celdaDia, dia?.maximas, colchonDe(dia))[fecha],
    [fecha, dia, celdaDia])

  const moverRango = (n) => { setDesde((d) => sumaDias(d, n)); setHasta((h) => sumaDias(h, n)) }
  const cargando = (hoja === 'MENSUAL' && !mes) || (hoja === 'DIARIO' && (!dia || !apuntes)) || (hoja === 'DEBER' && !deber)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-dark-950" role="dialog" aria-modal="true" aria-label="Hoja del cuadrante">
      <header className="flex flex-wrap items-center gap-2 border-b border-dark-700 bg-dark-900 px-3 py-2">
        <Sheet size={17} className="text-emerald-400" />
        <h2 className="text-[14px] font-bold text-dark-50">Cuadrante · {center}</h2>
        {hoja === 'MENSUAL' && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => moverRango(-7)} aria-label="Una semana antes" className="rounded-md border border-dark-700 p-1 text-dark-300 hover:bg-dark-800"><ChevronLeft size={15} /></button>
            <input type="date" value={desde} onChange={(e) => e.target.value && e.target.value <= hasta && setDesde(e.target.value)} aria-label="Desde"
              className="input py-1 text-[12.5px]" />
            <span className="text-dark-500">–</span>
            <input type="date" value={hasta} onChange={(e) => e.target.value && e.target.value >= desde && setHasta(e.target.value)} aria-label="Hasta"
              className="input py-1 text-[12.5px]" />
            <button onClick={() => moverRango(7)} aria-label="Una semana después" className="rounded-md border border-dark-700 p-1 text-dark-300 hover:bg-dark-800"><ChevronRight size={15} /></button>
          </div>
        )}
        {hoja === 'DIARIO' && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFecha((f) => sumaDias(f, -1))} aria-label="Día anterior" className="rounded-md border border-dark-700 p-1 text-dark-300 hover:bg-dark-800"><ChevronLeft size={15} /></button>
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Día" className="input py-1 text-[12.5px]" />
            <button onClick={() => setFecha((f) => sumaDias(f, 1))} aria-label="Día siguiente" className="rounded-md border border-dark-700 p-1 text-dark-300 hover:bg-dark-800"><ChevronRight size={15} /></button>
            <button onClick={() => setFecha(hoyLocal())} className="rounded-md border border-dark-700 px-2 py-1 text-[12px] text-dark-300 hover:bg-dark-800">Hoy</button>
            <button onClick={() => setFecha(sumaDias(hoyLocal(), 1))} className="rounded-md border border-dark-700 px-2 py-1 text-[12px] text-dark-300 hover:bg-dark-800">Mañana</button>
          </div>
        )}
        {hoja === 'DEBER' && (
          <>
            <input ref={fichero} type="file" accept=".xlsx,.xlsm" className="hidden" aria-label="Excel con la hoja deber horas"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) leerExcel(f) }} />
            <button onClick={() => fichero.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-dark-700 px-2.5 py-1 text-[12.5px] text-dark-200 hover:bg-dark-800">
              <Upload size={13} /> Traer de tu Excel
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setAyuda((a) => !a)} aria-pressed={ayuda}
            className="flex items-center gap-1.5 rounded-md border border-dark-700 px-2 py-1 text-[12px] text-dark-300 hover:bg-dark-800">
            <Keyboard size={13} /> Atajos
          </button>
          <button onClick={onCerrar} aria-label="Cerrar la hoja" className="rounded-md p-1.5 text-dark-400 hover:bg-dark-800 hover:text-dark-100"><X size={18} /></button>
        </div>
      </header>

      {ayuda && (
        <div className="grid gap-x-6 gap-y-1 border-b border-dark-700 bg-dark-900 px-4 py-2.5 text-[12px] sm:grid-cols-3">
          {ATAJOS.map(([k, t]) => <p key={k}><b className="font-mono text-dark-100">{k}</b> <span className="text-dark-400">{t}</span></p>)}
        </div>
      )}

      {previa && (
        <div className="flex flex-wrap items-center gap-3 border-b border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-[12.5px] text-dark-100">
          <span>En tu hoja «{previa.hoja}» hay <b>{previa.leidas}</b> filas; <b>{previa.nuevas}</b> no están aquí todavía
            ({previa.pendientes} pendientes{previa.sin_fecha ? `, ${previa.sin_fecha} sin fecha` : ''}).</span>
          <button onClick={confirmarExcel} disabled={!previa.nuevas}
            className="btn-primary px-3 py-1 text-xs disabled:opacity-40">Traer {previa.nuevas}</button>
          <button onClick={() => setPrevia(null)} className="text-xs text-dark-400 hover:text-dark-100">Ahora no</button>
        </div>
      )}

      <main className="min-h-0 flex-1 bg-dark-950">
        {cargando ? (
          <p className="flex items-center gap-2 p-6 text-dark-400"><Loader2 size={16} className="animate-spin" /> Cargando…</p>
        ) : hoja === 'MENSUAL' ? (
          <HojaMensual datos={mes} dias={dias} celda={celdaMes} porDia={porDia}
            guardarCeldas={guardarCeldas} guardarMaximas={guardarMaximas} deshacer={deshacer} avisar={avisar} />
        ) : hoja === 'DIARIO' ? (
          <HojaDiario fecha={fecha} datos={dia} apuntes={apuntes} celda={celdaDia} resumen={resumenDia}
            guardarCeldas={guardarCeldas} guardarApuntes={guardarApuntes} guardarNotas={guardarNotas}
            deshacer={deshacer} avisar={avisar} />
        ) : (
          <HojaDeberHoras filas={deber || []} hoyIso={hoyLocal()} crear={crearDeber} editar={editarDeber}
            borrar={borrarDeber} deshacer={deshacer} avisar={avisar} />
        )}
      </main>

      <footer className="flex items-stretch border-t border-dark-700 bg-dark-900 text-[12.5px]">
        <nav className="flex" aria-label="Hojas">
          {HOJAS.map(([k, t]) => (
            <button key={k} onClick={() => cambiarHoja(k)} aria-pressed={hoja === k}
              className={`border-r border-dark-700 px-4 py-2 font-semibold ${hoja === k
                ? 'bg-dark-950 text-emerald-300 shadow-[inset_0_2px_0_0] shadow-emerald-400' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-100'}`}>
              {t}
            </button>
          ))}
        </nav>
        {estado.txt && (
          <p className={`ml-auto flex items-center gap-1.5 truncate px-3 py-2 ${estado.error ? 'text-red-300' : 'text-dark-300'}`} role="status">
            {estado.error ? <AlertTriangle size={13} /> : estado.txt.startsWith('Guardando') || estado.txt.startsWith('Deshaciendo') || estado.txt.startsWith('Leyendo')
              ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} className="text-emerald-400" />}
            {estado.txt}
          </p>
        )}
      </footer>
    </div>
  )
}
