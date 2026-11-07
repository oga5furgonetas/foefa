/* diseño compacto */
import { useEffect, useMemo, useState } from 'react'
import { ScanLine, Loader2, Check, List, Truck, Search } from 'lucide-react'
import { repEscanearCarga, repMiCargado } from '../../services/api'
import { tx, useIdioma, txError } from '../../lib/idioma'
import { decir, vozActiva } from '../../lib/voz'
import { huecoHablado } from '../../lib/briefing'
import { medirAccion } from '../../lib/analitica'
import { useAtras } from '../../lib/atras'
import Ayuda from './piezas/Ayuda'
import Boton from './piezas/Boton'
import Cabecera from './piezas/Cabecera'
import Campo from './piezas/Campo'
import Chip from './piezas/Chip'
import ContenedorLista from './piezas/ContenedorLista'
import Etiqueta from './piezas/Etiqueta'
import LetraMax from './piezas/LetraMax'
import Segmentado from './piezas/Segmentado'

/* ── LA CARGA GUIADA (01-11-2026) ────────────────────────────────────────────
   En la nave, con la ruta ya ordenada: escaneas cada paquete y la app te dice en qué hueco de la furgoneta va (el
   servidor se lo puso a cada parada al ordenar: lo primero que se entrega, junto a la puerta por la que se carga; lo
   último, al fondo). Lo dice en grande y por voz, y cuenta cuántos van. Al llegar a cada parada, su ficha ya dice el
   hueco. Quien carga sin escanear tiene la lista por hueco con una casilla por paquete. Es la queja literal de las
   reseñas de Routal («en ruta no puedes ver qué paquetes entran en cada parada») y lo que Bettermile mide en 2-3 min
   por parada. Los huecos son los seis de siempre (`HUECOS` en MiRuta), con sus traducciones.

   Diseño compacto (07-11-2026, §5.6): cabecera de 56 con el chip «{a}/{b}» (nombre «{a} de {b} cargados») y el «?» (la
   explicación de antes va ahí, con sus claves), segmentado de 40, lo escaneado ARRIBA (antes iba al final y en los
   móviles pequeños quedaba fuera de la vista), la furgoneta plana con celdas de 64 y «{a}/{b}», el chip «{n} sin hueco ›»,
   el campo del código a la vista (es la vía del iPhone), la lista por hueco en un ContenedorLista con casillas de 48 y
   la barra de abajo con la zona segura: «Escanear» (52, ok) y «Salir ({n} faltan)» (48). Lo que hace cada botón y lo
   que se manda al servidor, igual que antes. */
export const HUECOS = ['Delante · izq', 'Delante · der', 'Medio · izq', 'Medio · der', 'Detrás · izq', 'Detrás · der']
const FILAS = [['Delante · izq', 'Delante · der'], ['Medio · izq', 'Medio · der'], ['Detrás · izq', 'Detrás · der']]

export default function CargaGuiada({ pedidos, cargaPor = 'traseras', Escaner, onClose, onCambio }) {
  useIdioma()
  useAtras(true, onClose)
  const [vista, setVista] = useState('furgoneta')      // furgoneta | lista
  const [escaner, setEscaner] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [ultimo, setUltimo] = useState(null)           // lo último escaneado: { pedido, cargados, total }
  const [error, setError] = useState('')
  useEffect(() => { medirAccion('ruta_carga') }, [])

  const { porHueco, sinHueco } = useMemo(() => {
    const m = {}
    HUECOS.forEach((h) => { m[h] = [] })
    const sin = []
    pedidos.forEach((p) => { if (m[p.hueco]) m[p.hueco].push(p); else sin.push(p) })
    const orden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9)
    Object.values(m).forEach((l) => l.sort(orden))
    sin.sort(orden)
    return { porHueco: m, sinHueco: sin }
  }, [pedidos])
  const cargados = pedidos.filter((p) => p.cargado_en).length
  const total = pedidos.length
  const faltan = total - cargados
  const lateral = cargaPor === 'lateral'
  // El orden de carga: la fila de la puerta primero (detrás con puertas traseras; delante con la lateral).
  const filasEnOrden = lateral ? FILAS : [...FILAS].reverse()

  async function escaneado(c) {
    const valores = (Array.isArray(c) ? c : [c]).map((v) => String(v || '').trim()).filter(Boolean)
    if (!valores.length) return
    setOcupado('escaneo'); setError('')
    try {
      const { data } = await repEscanearCarga(valores)
      if (!data.encontrado) {
        setError(tx('No es de tu ruta de hoy.'))
        if (navigator.vibrate) navigator.vibrate([60, 60, 60])
        return
      }
      setUltimo(data)
      if (navigator.vibrate) navigator.vibrate(80)
      if (vozActiva()) decir(data.pedido?.hueco ? huecoHablado(data.pedido.hueco) : tx('Sin hueco'))
      setCodigo('')
      onCambio?.()
    } catch (e) {
      setError(txError(e, 'No se ha podido'))
    } finally { setOcupado('') }
  }

  async function marcar(p, cargado) {
    setOcupado(`marca-${p.id}`); setError('')
    try { await repMiCargado(p.id, cargado); onCambio?.() } catch (e) { setError(txError(e, 'No se ha podido')) } finally { setOcupado('') }
  }

  const ordenUltimo = ultimo?.pedido?.orden ?? '–'
  const cuenta = tx('{a} de {b} cargados', { a: cargados, b: total })
  // Lo último escaneado: la parada y, en grande, el hueco (lo mismo arriba y en la barra del escáner).
  const nombreUltimo = ultimo?.pedido ? `${tx('Parada {n}', { n: ordenUltimo })} · ${ultimo.pedido.cliente || ultimo.pedido.direccion}` : ''
  const huecoUltimo = ultimo?.pedido ? `→ ${ultimo.pedido.hueco ? tx(ultimo.pedido.hueco) : tx('Sin hueco')}` : ''
  const puerta = lateral ? `← ${tx('Puerta lateral')}` : `↓ ${tx('Puertas traseras')}`
  const secciones = [...filasEnOrden.flat().map((h) => [h, porHueco[h]]), [tx('Sin hueco'), sinHueco]].filter(([, l]) => l.length)

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-dark-950 text-dark-50" role="dialog" aria-label={tx('Cargar la furgoneta')}>
      <Cabecera titulo={tx('Cargar la furgoneta')} onVolver={onClose} className="mx-auto w-full max-w-md"
        acciones={(
          <>
            <span role="status" aria-label={cuenta} title={cuenta} className="mr-1"><Etiqueta tono="ok" texto={`${cargados}/${total}`} /></span>
            <Ayuda titulo={tx('Cargar la furgoneta')}>
              <p>{tx('La ruta ya está ordenada: lo primero que se entrega va junto a la puerta y lo último, al fondo.')} {lateral ? tx('Cargas por la puerta lateral.') : tx('Cargas por las puertas traseras.')}</p>
              <p className="mt-2">{lateral ? tx('Lo de delante se entrega primero.') : tx('Lo de detrás se entrega primero.')}</p>
              {/* Nada se borra (riesgo 17): lo que explicaba el aviso de «sin hueco», con su clave, se queda aquí; en pantalla, el chip. */}
              {sinHueco.length > 0 && (
                <p className="mt-2">{tx('{n} paradas sin hueco (sin ubicar o sin ordenar): salen en «Lista por hueco».', { n: sinHueco.length })}</p>
              )}
            </Ayuda>
          </>
        )} />

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <Segmentado valor={vista} onChange={setVista}
          opciones={[{ valor: 'furgoneta', texto: tx('Furgoneta'), icono: Truck }, { valor: 'lista', texto: tx('Lista por hueco'), icono: List }]} />

        {ultimo?.pedido && (
          <div className="mt-3 rounded-xl border-2 border-ruta-ok bg-dark-900 p-3" aria-live="polite">
            <p className="text-nombre">{nombreUltimo}</p>
            <p className="text-cifra text-ruta-ok-texto">{huecoUltimo}</p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-ruta-peligro/10 px-3 py-2 text-texto text-ruta-peligro-texto">{error}</p>}

        {vista === 'furgoneta' ? (
          <div className="mt-3 rounded-xl bg-dark-900 p-2">
            <p className="py-1 text-center text-sec text-dark-400">{tx('Cabina')}</p>
            {lateral && <p className="pb-1 text-sec text-dark-400">{puerta}</p>}
            <div className="grid grid-cols-2 gap-2">
              {FILAS.flat().map((h) => {
                const l = porHueco[h]
                const c = l.filter((p) => p.cargado_en).length
                const activo = ultimo?.pedido?.hueco === h
                return (
                  <div key={h} data-hueco={h} role="group" aria-label={`${tx(h)}: ${tx('{a} de {b} cargados', { a: c, b: l.length })}`}
                    className={`flex min-h-16 flex-col items-center justify-center rounded-lg ${activo ? 'border-2 border-ruta-ok' : 'border border-dark-800'} ${l.length ? 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto' : 'text-dark-50'}`}>
                    <LetraMax className="text-etiqueta">{tx(h)}</LetraMax>
                    <LetraMax base={18} max={21} className="text-titulo tabular-nums">{c}/{l.length}</LetraMax>
                  </div>
                )
              })}
            </div>
            {!lateral && <p className="pt-1 text-center text-sec text-dark-400">{puerta}</p>}
            {sinHueco.length > 0 && (
              <div className="pt-2">
                <Chip tono="aviso" nombre={tx('{n} sin hueco', { n: sinHueco.length })} onClick={() => setVista('lista')}
                  texto={<>{tx('{n} sin hueco', { n: sinHueco.length })} <span aria-hidden="true">›</span></>} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {secciones.map(([h, l]) => (
              <section key={h}>
                <p className="mb-1 px-1 text-etiqueta text-dark-400">{HUECOS.includes(h) ? tx(h) : h} · {l.length}</p>
                <ContenedorLista>
                  {l.map((p) => (
                    <li key={p.id} className="flex min-h-14 items-center gap-3 px-3 py-1">
                      <button type="button" onClick={() => marcar(p, !p.cargado_en)} disabled={ocupado === `marca-${p.id}`} role="checkbox" aria-checked={!!p.cargado_en}
                        aria-label={`${p.cliente || p.direccion}: ${tx('cargado')}`}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${p.cargado_en ? 'bg-ruta-ok text-white' : 'border border-ruta-borde text-dark-400'}`}>
                        {ocupado === `marca-${p.id}` ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : p.cargado_en ? <Check size={24} aria-hidden="true" /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-nombre">{p.orden ? `${p.orden}. ` : ''}{p.cliente || p.direccion}</p>
                        <p className="truncate text-texto text-dark-400">{p.cliente ? p.direccion : ''}{p.bultos > 1 ? ` · ${tx('{n} bultos', { n: p.bultos })}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ContenedorLista>
              </section>
            ))}
          </div>
        )}

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); escaneado(codigo) }}>
          <Campo valor={codigo} onChange={setCodigo} ejemplo={tx('Escribe o pega un código')} inputMode="text" autoComplete="off" className="min-w-0 flex-1" />
          <Boton variante="icono" type="submit" icono={Search} tono="neutro" relleno nombre={tx('Buscar')}
            disabled={!codigo.trim() || ocupado === 'escaneo'} cargando={ocupado === 'escaneo'} />
        </form>
      </div>

      <div className="shrink-0 border-t border-dark-800 bg-dark-950 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Boton variante="principal" tono="ok" icono={ScanLine} texto={tx('Escanear')} nombre={tx('Escanear para cargar')} className="flex-1"
            onClick={() => { setError(''); setEscaner(true) }} />
          <Boton variante="normal" contorno tono="neutro" texto={faltan > 0 ? tx('Salir ({n} faltan)', { n: faltan }) : tx('Todo cargado')} onClick={onClose} />
        </div>
      </div>

      {escaner && Escaner && (
        <Escaner seguido onCodigo={escaneado} onClose={() => setEscaner(false)} estado={cuenta} ultimo={nombreUltimo} grande={huecoUltimo} aviso={error} />
      )}
    </div>
  )
}
