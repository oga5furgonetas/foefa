import { useCallback, useEffect, useRef, useState } from 'react'

/* LA REJILLA COMO UN EXCEL — lo que comparten las tres hojas del cuadrante.

   Dani, 30-09-2026: «usamos un Excel, que es mayor maniobrabilidad». Lo que
   hace que un Excel se maneje rápido, y que aquí funciona igual:
     · clic selecciona; arrastrar o Mayús+clic, un rectángulo;
     · flechas, Tab y Enter mueven (Mayús+flechas amplía la selección);
     · escribir encima sustituye; Enter o Tab guarda y Esc lo deja como estaba;
     · F2 o doble clic edita lo que hay; Supr o Retroceso vacía la selección;
     · Ctrl+C copia la selección con tabuladores (se pega tal cual en Excel) y
       Ctrl+V pega un bloque copiado de Excel empezando en la celda activa;
     · Ctrl+Z deshace (cada hoja dice qué es deshacer).
   Cada hoja pone sus datos y qué pasa al guardar; esto solo lleva la
   selección y el teclado. */

export function useRejilla({ filas, cols, texto, editable, onGuardar, onBorrar, onPegar, onDeshacer }) {
  const [activa, setActiva] = useState({ r: 0, c: 0 })
  const [ancla, setAncla] = useState({ r: 0, c: 0 })
  const [editando, setEditando] = useState(null) // { r, c, valor }
  // La edición también en una ref: al guardar con Enter el campo desaparece y
  // el navegador dispara además su «blur». Sin esto se guardaba dos veces.
  const edicion = useRef(null)
  const arrastrando = useRef(false)
  const caja = useRef(null)

  const limitar = useCallback((r, c) => ({
    r: Math.max(0, Math.min(Math.max(filas - 1, 0), r)),
    c: Math.max(0, Math.min(Math.max(cols - 1, 0), c)),
  }), [filas, cols])

  // Si cambian las dimensiones (otro rango, filtro), la selección se queda dentro.
  useEffect(() => {
    setActiva((a) => limitar(a.r, a.c))
    setAncla((a) => limitar(a.r, a.c))
  }, [limitar])

  const rango = {
    r0: Math.min(activa.r, ancla.r), r1: Math.max(activa.r, ancla.r),
    c0: Math.min(activa.c, ancla.c), c1: Math.max(activa.c, ancla.c),
  }
  const enSel = (r, c) => r >= rango.r0 && r <= rango.r1 && c >= rango.c0 && c <= rango.c1

  // La celda activa siempre a la vista.
  useEffect(() => {
    const el = caja.current?.querySelector(`[data-celda="${activa.r}-${activa.c}"]`)
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activa])

  const ir = (r, c, extender) => {
    const n = limitar(r, c)
    setActiva(n)
    if (!extender) setAncla(n)
  }

  const empezar = (r, c, valor) => {
    if (!editable(r, c)) return
    const e = { r, c, valor: valor ?? String(texto(r, c) ?? '') }
    edicion.current = e
    setEditando(e)
  }

  const terminar = async (guardar, dr = 0, dc = 0) => {
    const e = edicion.current
    if (!e) return
    edicion.current = null
    setEditando(null)
    ir(e.r + dr, e.c + dc, false)
    caja.current?.focus({ preventScroll: true })
    if (guardar && e.valor !== String(texto(e.r, e.c) ?? '')) await onGuardar(e.r, e.c, e.valor)
  }

  const onKeyDown = (ev) => {
    if (edicion.current) return // lo lleva el campo de edición
    const mod = ev.ctrlKey || ev.metaKey
    const k = ev.key
    if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); onDeshacer?.(); return }
    if (mod && k.toLowerCase() === 'a') {
      ev.preventDefault(); setAncla({ r: 0, c: 0 }); setActiva(limitar(filas - 1, cols - 1)); return
    }
    if (mod || ev.altKey) return // Ctrl+C y Ctrl+V van por los eventos de copiar y pegar
    const mover = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]
    if (mover) { ev.preventDefault(); ir(activa.r + mover[0], activa.c + mover[1], ev.shiftKey); return }
    if (k === 'Tab') { ev.preventDefault(); ir(activa.r, activa.c + (ev.shiftKey ? -1 : 1), false); return }
    if (k === 'Enter') { ev.preventDefault(); ir(activa.r + (ev.shiftKey ? -1 : 1), activa.c, false); return }
    if (k === 'Home') { ev.preventDefault(); ir(activa.r, 0, ev.shiftKey); return }
    if (k === 'End') { ev.preventDefault(); ir(activa.r, cols - 1, ev.shiftKey); return }
    if (k === 'F2') { ev.preventDefault(); empezar(activa.r, activa.c); return }
    if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); onBorrar?.(rango); return }
    if (k.length === 1) { ev.preventDefault(); empezar(activa.r, activa.c, k) }
  }

  const onCopy = (ev) => {
    if (edicion.current) return
    const lineas = []
    for (let r = rango.r0; r <= rango.r1; r++) {
      const fila = []
      for (let c = rango.c0; c <= rango.c1; c++) fila.push(String(texto(r, c) ?? '').replace(/[\t\n]/g, ' '))
      lineas.push(fila.join('\t'))
    }
    ev.clipboardData?.setData('text/plain', lineas.join('\n'))
    ev.preventDefault()
  }

  const onPaste = (ev) => {
    if (edicion.current) return
    const t = ev.clipboardData?.getData('text/plain') || ''
    if (!t) return
    ev.preventDefault()
    const matriz = t.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'))
    onPegar?.(activa.r, activa.c, matriz)
  }

  useEffect(() => {
    const suelta = () => { arrastrando.current = false }
    window.addEventListener('mouseup', suelta)
    return () => window.removeEventListener('mouseup', suelta)
  }, [])

  // Al abrir la hoja, el teclado ya va a la rejilla: se puede escribir sin hacer clic.
  useEffect(() => { caja.current?.focus({ preventScroll: true }) }, [])

  const propsCelda = (r, c) => ({
    'data-celda': `${r}-${c}`,
    onMouseDown: (ev) => {
      if (ev.button !== 0) return
      if (edicion.current && (edicion.current.r !== r || edicion.current.c !== c)) terminar(true)
      if (edicion.current) return
      ev.preventDefault() // sin esto, arrastrar seleccionaría el texto de la página
      caja.current?.focus({ preventScroll: true })
      setActiva({ r, c })
      if (!ev.shiftKey) setAncla({ r, c })
      arrastrando.current = true
    },
    onMouseEnter: () => { if (arrastrando.current) setActiva({ r, c }) },
    onDoubleClick: () => { setActiva({ r, c }); setAncla({ r, c }); empezar(r, c) },
  })

  const propsEditor = editando ? {
    autoFocus: true,
    value: editando.valor,
    onChange: (e) => {
      const valor = e.target.value
      if (edicion.current) edicion.current = { ...edicion.current, valor }
      setEditando((x) => (x ? { ...x, valor } : x))
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); terminar(true, e.shiftKey ? -1 : 1, 0) }
      else if (e.key === 'Tab') { e.preventDefault(); terminar(true, 0, e.shiftKey ? -1 : 1) }
      else if (e.key === 'Escape') { e.preventDefault(); terminar(false) }
      e.stopPropagation()
    },
    onBlur: () => terminar(true),
    onMouseDown: (e) => e.stopPropagation(),
  } : null

  const propsCaja = { ref: caja, tabIndex: 0, onKeyDown, onCopy, onPaste }
  return { activa, rango, enSel, editando, propsCaja, propsCelda, propsEditor, ir, caja }
}
