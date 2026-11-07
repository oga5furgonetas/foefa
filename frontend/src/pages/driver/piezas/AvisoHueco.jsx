/* diseño compacto */
/* El hueco de aviso de «Hoy» (07-11-2026, §5.1 b de la especificación): un solo Aviso, el primero que toque, en este
   orden: 1 recién añadida · 2 cambios sin enviar · 3 sin conexión · 4 la placa no circula hoy · 5 paradas de otros días ·
   6 ruta de prueba · 7 paradas de ejemplo · 8 lo de la cuenta (lo elige RutaApp y llega ya pintado, `avisoApp`) · 9 el
   consejo del día. Cada uno llega como un objeto con sus datos y sus funciones (null si no toca); lo que hace cada botón
   es lo de siempre. Lo pasajero no va aquí: va al AvisoFlotante. */
import { AlertTriangle, CalendarClock, Check, Lightbulb, MapPinOff, PackageOpen, Sparkles, WifiOff } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Aviso from './Aviso'

const abrir = (url) => window.open(url, '_blank', 'noopener')

export default function AvisoHueco({ anadida, sinEnviar, sinConexion, placa, previas, prueba, ejemplos, avisoApp, consejo }) {
  if (anadida) {
    const { p, onEscanear, onSituar, onCorregir, onCerrar } = anadida
    // SIN SITIO EN EL MAPA (02-11-2026): se dice al momento, con «Situar», y no al ir a navegar.
    const sinSitio = p.lat == null && (p.geo === 'no' || p.geo === 'zona')
    return (
      <Aviso tono="ok" icono={Check} texto={`✓ ${tx('Añadida a tu ruta')} · ${p.cliente || p.direccion}`} onCerrar={onCerrar}
        acciones={[sinSitio ? { texto: tx('Situar'), onClick: onSituar } : { texto: tx('Escanear otro'), onClick: onEscanear }, { texto: tx('Corregir'), onClick: onCorregir }]}>
        {sinSitio && <p className="mt-0.5 flex items-center gap-1 text-sec text-ruta-aviso-texto"><MapPinOff size={14} aria-hidden="true" /> {tx('No la encuentro en el mapa')}</p>}
      </Aviso>
    )
  }
  if (sinEnviar) {
    return (
      <Aviso testid="sin-enviar" tono="aviso" icono={WifiOff} texto={sinEnviar.n === 1 ? tx('1 sin enviar') : tx('{n} sin enviar', { n: sinEnviar.n })}
        accion={tx('Enviar ahora')} onAccion={sinEnviar.onEnviar} />
    )
  }
  if (sinConexion) return <Aviso tono="neutro" icono={WifiOff} texto={tx('Sin conexión · ruta de las {h}', { h: sinConexion.hora })} />
  if (placa) return <Aviso tono="peligro" icono={AlertTriangle} texto={tx('Hoy tu placa no puede circular.')} accion={tx('Fuente oficial')} onAccion={() => abrir(placa.url)} />
  if (previas) {
    return (
      <Aviso testid="previas" tono="aviso" icono={CalendarClock} texto={previas.n === 1 ? tx('1 parada de otro día') : tx('{n} paradas de otros días', { n: previas.n })}
        acciones={[{ texto: tx('Traer a hoy'), onClick: previas.onTraer }]} onCerrar={previas.onCerrar} nombreCerrar={tx('Ahora no')} />
    )
  }
  if (prueba) {
    // LA PRUEBA SIN CUENTA: se dice que lo es y cómo quedársela. Quien ya tiene cuenta tiene que poder SALIR de la demo.
    return (
      <Aviso tono="aviso" icono={Sparkles} texto={tx('Ruta de prueba · se borra mañana')}
        acciones={[{ texto: tx('Crear mi cuenta'), href: '/registro?sector=autonomo&plan=autonomo' }, { texto: tx('Ya tengo cuenta'), onClick: prueba.onYaTengo }]} />
    )
  }
  if (ejemplos) return <Aviso tono="neutro" icono={PackageOpen} texto={tx('Paradas de ejemplo')} accion={tx('Quitar')} onAccion={ejemplos.onQuitar} />
  if (avisoApp) return avisoApp
  if (consejo) {
    const { c, onAccion, onEntendido } = consejo
    // La línea corta de cada consejo (§6.2); el párrafo largo de CONSEJOS muere.
    const esOrdenar = c.id === 'ordenar'
    const esHueco = c.id === 'hueco'
    const corta = tx(esOrdenar ? 'El orden que menos tarda, con la hora de cada parada.'
      : esHueco ? 'Apunta el hueco al cargar y lo encuentras al llegar.' : 'Te guía con voz hasta la puerta, sin salir de la app.')
    return (
      <Aviso testid="consejo" tono="aviso" icono={Lightbulb} texto={tx(c.titulo)} onCerrar={onEntendido} nombreCerrar={tx('Entendido')}
        acciones={c.boton ? [{ texto: tx(c.boton), onClick: onAccion }] : []}>
        <p className="text-sec">{corta}</p>
      </Aviso>
    )
  }
  return null
}
