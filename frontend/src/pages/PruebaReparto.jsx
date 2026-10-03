import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Building2, Truck, Loader2, ScanLine, Camera, ShieldCheck, User } from 'lucide-react'
import { API_BASE, DRIVER_TOKEN_KEY } from '../services/api'
import { saveSession, guardarSesionPrevia } from '../panel/auth'
import { MARCA, origen } from '../marca'

/* ── PRUEBA DEL REPARTO, SIN REGISTRARSE ─────────────────────────────────────
   El enlace que se manda por WhatsApp al encargado de un súper: entra como la
   oficina en el ordenador y sus repartidores, cada uno como «Repartidor 1, 2
   o 3», en el móvil. Datos inventados en A Coruña que vuelven a empezar cada
   día; se puede usar de verdad (escanear, entregar, repartir), solo el reparto.

   Para probar el escáner hacen falta códigos: están aquí mismo, en pantalla,
   para apuntar con el móvil. Y un ticket de mentira para la foto. */

const CODIGOS = [
  ['DEMO1005', 'Sin repartidor: al escanearlo pasa a tu ruta'],
  ['DEMO1007', 'Otro sin repartidor (Os Mallos)'],
  ['DEMO1001', 'Ya es del Repartidor 1: si lo escanea otro, avisa'],
  ['DEMO2001', 'No está en la lista: prueba la foto del ticket'],
]

function Qr({ texto, tam = 150 }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(texto, { margin: 1, width: tam }).then(setSrc).catch(() => setSrc(''))
  }, [texto, tam])
  return src ? <img src={src} alt={`Código ${texto}`} width={tam} height={tam} className="rounded-lg bg-white p-1" /> : <div style={{ width: tam, height: tam }} />
}

export default function PruebaReparto() {
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')

  async function entrar(rol, n) {
    setOcupado(rol + (n || '')); setErr('')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-reparto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol, n }),
      })
      const j = await r.json()
      if (!r.ok || !j.access_token) throw new Error(j.detail || 'No se pudo entrar')
      if (rol === 'conductor' || rol === 'autonomo') {
        // Igual para un conductor real que prueba la demo en su móvil.
        const previo = localStorage.getItem(DRIVER_TOKEN_KEY)
        if (previo && !/\.eyJ.*ZGVtbyI6dHJ1ZQ/.test(previo)) {
          try {
            const p = JSON.parse(atob(previo.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            if (!p.demo) localStorage.setItem('flota_driver_previo', JSON.stringify({ token: previo, driver: localStorage.getItem('flota_driver') }))
          } catch { /* token raro: no se guarda */ }
        }
        localStorage.setItem(DRIVER_TOKEN_KEY, j.access_token)
        localStorage.setItem('flota_driver', JSON.stringify(j.driver))
        window.location.href = '/conductor?vista=ruta'
      } else {
        guardarSesionPrevia()   // tu cuenta de verdad se queda guardada: se vuelve con un botón
        saveSession(j)
        // La bienvenida general del panel tapaba el reparto nada más entrar.
        try { localStorage.setItem(`ayuda_vista_${j.id}`, '1') } catch { /* sin almacenamiento: sale la bienvenida */ }
        window.location.href = '/panel/reparto'
      }
    } catch (e) { setErr(e.message || 'Sin conexión'); setOcupado('') }
  }

  const enlace = `${origen()}/prueba-reparto`

  return (
    <div className="min-h-screen bg-dark-950 px-4 py-8 text-dark-100">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-[14px] font-bold text-dark-50">{MARCA.nombre}</a>
        <h1 className="mt-6 font-display text-[clamp(26px,5vw,38px)] font-extrabold leading-tight text-dark-50">
          Prueba el reparto a domicilio
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-dark-400">
          El repartidor escanea la caja y le sale la dirección y lo que lleva; la ruta se ordena sola; la oficina ve
          en el mapa por dónde va cada uno. Sin registrarte: un supermercado de prueba en A Coruña con pedidos
          inventados que vuelven a empezar cada día.
        </p>

        <section className="mt-7 rounded-2xl border border-amber-400/40 bg-amber-500/[.06] p-5">
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-dark-50"><User className="text-amber-300" size={20} /> ¿Repartes tú mismo?</h2>
          <p className="mt-1 text-[13px] text-dark-400">
            Tu ruta empieza vacía: escanea tus paquetes o hazle una foto a la etiqueta y la dirección y el teléfono
            entran solos. La ruta se ordena por tiempo y en cada parada tienes llamar y WhatsApp. Lo que metas solo lo ves tú.
          </p>
          <button onClick={() => entrar('autonomo')} disabled={!!ocupado}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-[15px] font-bold text-dark-950 disabled:opacity-50 md:w-auto md:px-8">
            {ocupado === 'autonomo' && <Loader2 size={16} className="animate-spin" />} Probar con mi propia ruta
          </button>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-dark-700 bg-dark-900 p-5">
            <Building2 className="text-sky-400" />
            <h2 className="mt-2 text-[18px] font-bold text-dark-50">La oficina</h2>
            <p className="mt-1 text-[13px] text-dark-400">En el ordenador: los pedidos del día, el mapa, las zonas de cada repartidor y quién va por dónde.</p>
            <button onClick={() => entrar('oficina')} disabled={!!ocupado}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-white disabled:opacity-50">
              {ocupado === 'oficina' && <Loader2 size={16} className="animate-spin" />} Entrar como la oficina
            </button>
          </section>

          <section className="rounded-2xl border border-dark-700 bg-dark-900 p-5">
            <Truck className="text-emerald-400" />
            <h2 className="mt-2 text-[18px] font-bold text-dark-50">Los repartidores</h2>
            <p className="mt-1 text-[13px] text-dark-400">En el móvil: escanear, ver la ruta en orden, ir con el navegador y marcar las entregas. Cada uno elige un repartidor.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => entrar('conductor', n)} disabled={!!ocupado}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-[14px] font-bold text-white disabled:opacity-50">
                  {ocupado === `conductor${n}` && <Loader2 size={14} className="animate-spin" />} Repartidor {n}
                </button>
              ))}
            </div>
            <div className="mt-4 hidden items-center gap-3 md:flex">
              <Qr texto={enlace} tam={96} />
              <p className="text-[12.5px] text-dark-400">¿Estás en el ordenador? Apunta con la cámara del móvil aquí para abrir esta página en él.</p>
            </div>
          </section>
        </div>
        {err && <p className="mt-3 text-[13px] text-red-300">{err}</p>}

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-dark-50"><ScanLine size={18} /> Códigos para probar el escáner</h2>
          <p className="mt-1 text-[13px] text-dark-400">
            En el móvil, como repartidor: «Mi ruta» → «Escanear bulto», y apunta a uno de estos en la pantalla del ordenador.
            En la tienda serían los códigos de los tickets o de las cajas.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CODIGOS.map(([c, que]) => (
              <div key={c} className="flex flex-col items-center rounded-2xl border border-dark-700 bg-dark-900 p-3 text-center">
                <Qr texto={c} />
                <b className="mt-2 font-mono text-[13px] text-dark-100">{c}</b>
                <span className="mt-1 text-[11.5px] leading-snug text-dark-400">{que}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid items-start gap-5 md:grid-cols-[300px_1fr]">
          <div className="rounded-sm bg-white px-5 py-4 font-mono text-[14px] leading-6 text-black shadow-lg" aria-label="Ticket de prueba">
            <div className="text-center font-bold">SUPERMERCADO DE PRUEBA</div>
            <div>FACTURA SIMPLIFICADA: 0123-004567</div>
            <div>REPARTO A DOMICILIO</div>
            <div>Cliente: Ana Pérez (prueba)</div>
            <div>C/ Juana de Vega 20</div>
            <div>2º Dcha</div>
            <div>15004 A Coruña</div>
            <div>TOTAL 63,40 EUR</div>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-dark-50"><Camera size={18} /> Y la foto del ticket</h2>
            <p className="mt-1 text-[13px] text-dark-400">
              Si un código no está en la lista (como DEMO2001), el repartidor le hace una foto al ticket y el móvil lee la
              dirección. Prueba con este. La foto se lee en el propio teléfono: no se envía a ningún sitio.
            </p>
            <p className="mt-4 flex items-start gap-2 text-[12.5px] text-dark-400">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
              En una cuenta de verdad, los datos de los clientes son del supermercado: nosotros no los vemos, cada
              repartidor ve solo los suyos, la ubicación solo se comparte en jornada y todo se borra solo.
            </p>
            <a href="/registro?sector=supermercado" className="mt-5 inline-block rounded-xl border border-brand-500/50 px-4 py-2.5 text-[14px] font-semibold text-brand-300">
              ¿Te convence? Crea la cuenta de tu tienda →
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
