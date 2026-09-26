import { useCallback, useEffect, useState } from 'react'
import { Loader2, Key, Copy, Check, Trash2, Eye } from 'lucide-react'
import {
  getLlavesPartner, crearLlavePartner, revocarLlavePartner, getAccesosPartner,
} from '../api'
import { fechaHoraLocal } from '../../lib/fecha'

/* ACCESO PARA TERCEROS
   ═══════════════════════════════════════════════════════════════════════════
   Lo que le importa a quien audita un DSP no es ver una pantalla: es poder
   sacar el dato a SUS sistemas cuando quiera. Un informe que hay que pedir por
   correo no es trazabilidad, es un favor.

   Tres cosas que esta pantalla tiene que dejar claras, porque son las que
   preguntan antes de aceptar una llave:
     · qué se lleva (y qué no: aquí no sale un solo dato personal),
     · quién ha mirado y cuándo,
     · que se corta en un clic. */

export default function LlavesPartner() {
  const [llaves, setLlaves] = useState(null)
  const [accesos, setAccesos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [nueva, setNueva] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(() => {
    setCargando(true)
    Promise.all([
      getLlavesPartner().then((r) => r.data.llaves).catch(() => []),
      getAccesosPartner().then((r) => r.data.accesos).catch(() => []),
    ]).then(([l, a]) => { setLlaves(l); setAccesos(a) }).finally(() => setCargando(false))
  }, [])
  useEffect(cargar, [cargar])

  const crear = async () => {
    if (!nombre.trim()) { setMsg({ mal: true, txt: 'Dile de quién es la llave.' }); return }
    setCreando(true); setMsg(null)
    try {
      const r = await crearLlavePartner({ partner: nombre.trim(), dias: 365 })
      setNueva(r.data)
      cargar()
    } catch (e) {
      setMsg({ mal: true, txt: e?.response?.data?.detail || 'No se pudo crear.' })
    } finally { setCreando(false) }
  }

  const revocar = async (id) => {
    try { await revocarLlavePartner(id); cargar() }
    catch { setMsg({ mal: true, txt: 'No se pudo cortar el acceso.' }) }
  }

  const copiar = (t) => {
    navigator.clipboard?.writeText(t)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-dark-400">
        <Loader2 size={14} className="animate-spin" /> Cargando accesos…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* La llave recién creada. Se enseña UNA vez: a partir de aquí en la base
          solo queda su huella, así que si se pierde hay que hacer otra. */}
      {nueva && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-3">
          <p className="mb-2 text-[13px] font-semibold text-emerald-200">
            Llave para {nueva.partner}. Cópiala ahora: no se puede volver a ver.
          </p>
          <div className="flex gap-2">
            <input readOnly value={nueva.token}
              className="min-w-0 flex-1 rounded-lg border border-emerald-500/30 bg-dark-900 px-2.5 py-2 font-mono text-[12px] text-dark-200" />
            <button onClick={() => copiar(nueva.token)}
              className="rounded-lg border border-emerald-500/30 bg-dark-900 px-3 text-emerald-300 hover:bg-emerald-500/15">
              {copiado ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-emerald-300">
            {nueva.como_se_usa}
          </p>
          <button onClick={() => setNueva(null)}
            className="mt-2 text-[12px] text-emerald-300 hover:underline">Ya la he copiado</button>
        </div>
      )}

      {msg && <p className={`text-[12.5px] ${msg.mal ? 'text-red-300' : 'text-emerald-300'}`}>{msg.txt}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del cliente o de su sistema"
          className="min-w-0 flex-1 rounded-lg border border-dark-700 px-2.5 py-2 text-[13px]" />
        <button onClick={crear} disabled={creando}
          className="flex items-center gap-1.5 rounded-lg bg-dark-100 px-3 py-2 text-[13px] font-semibold text-dark-950 hover:bg-dark-50 disabled:opacity-50">
          <Key size={14} /> {creando ? 'Creando…' : 'Dar acceso'}
        </button>
      </div>

      {llaves?.length ? (
        <div className="overflow-hidden rounded-lg border border-dark-800">
          {llaves.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 border-b border-dark-800/60 px-3 py-2.5 last:border-b-0">
              <span className="text-[13.5px] font-semibold">{l.partner}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                l.activa ? 'bg-emerald-500/15 text-emerald-300' : 'bg-dark-800 text-dark-300'}`}>
                {l.activa ? 'activa' : l.revocado ? 'cortada' : 'caducada'}
              </span>
              <span className="text-[12.5px] text-dark-400">
                <span className="tabular-nums">{l.accesos}</span> consultas
                {l.ultimo_uso && <> · última el {String(l.ultimo_uso).slice(0, 10)}</>}
              </span>
              <span className="text-[12.5px] text-dark-500">caduca {String(l.expira_en).slice(0, 10)}</span>
              {l.activa && (
                <button onClick={() => revocar(l.id)}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-dark-700 px-2 py-1 text-[12px] text-dark-300 hover:bg-red-500/10 hover:text-red-300">
                  <Trash2 size={13} /> Cortar
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-[13px] text-dark-400">
          Todavía no le has dado acceso a nadie.
        </p>
      )}

      {/* Quién ha mirado y cuándo. La transparencia va en los dos sentidos: si
          les abres tus datos, tienes que poder ver qué consultan. */}
      {!!accesos?.length && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-dark-300">
            <Eye size={14} /> Lo que han consultado
          </div>
          <div className="overflow-hidden rounded-lg border border-dark-800">
            {accesos.slice(0, 6).map((a, i) => (
              <div key={`${a.at}-${i}`} className="flex flex-wrap items-baseline gap-2 border-b border-dark-800/60 px-3 py-2 text-[12.5px] last:border-b-0">
                <span className="font-mono tabular-nums text-dark-500">
                  {fechaHoraLocal(a.at)}
                </span>
                <span className="font-semibold text-dark-200">{a.partner}</span>
                <span className="text-dark-400">consultó {a.recurso}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-dark-400">
        La llave es de solo lectura y no lleva ningún dato personal: ni nombres de
        conductores, ni teléfonos, ni quién conducía cuándo. Se guarda cifrada, así
        que si se pierde hay que cortarla y hacer otra.
      </p>
    </div>
  )
}
