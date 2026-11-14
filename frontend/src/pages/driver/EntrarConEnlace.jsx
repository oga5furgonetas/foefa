import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useT } from '../../i18n'
import { useTitulo } from '../../lib/titulo'
import { API_BASE, DRIVER_TOKEN_KEY } from '../../services/api'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../portadaComun'
import { MarcoEntrada, TITULO, TEXTO, ERROR, AVISO } from '../entradaComun'

/* ENTRAR CON EL ENLACE PERSONAL (14-11-2026, CONTRATO-ALTA §1.6–1.9). El dueño le manda a cada conductor, por su
   WhatsApp, un enlace `/c#<token>`. Con un toque en «Entrar» queda dentro de su portal: sin correo, sin contraseña y sin
   instalar nada. Lo que hay que cuidar:
   · El token va detrás de «#»: no llega a ningún servidor. Nada más cargar se guarda en memoria y se QUITA de la
     dirección, antes de pedir nada (ni la analítica ni el historial lo ven).
   · El canje sale al TOCAR «Entrar», nunca solo: un programa que abra el enlace (la vista previa de WhatsApp, un
     antivirus) no lo ata a su máquina.
   · El enlace se ata al primer teléfono que entra con él: el navegador guarda un secreto suyo (`fds_dispositivo`, uno
     por teléfono, el mismo para todos los enlaces) y lo manda en cada canje. Salir del portal no lo borra; si se
     borrara, el siguiente toque al enlace diría «otro teléfono».
   · El canje va con `fetch` y SIN la sesión del panel (el interceptor de services/api la pondría).
   · Si en este navegador hay una sesión del PANEL, avisa antes: el dueño probando el enlace de un conductor lo ataría
     a su propio teléfono. */

const CLAVE_DISPOSITIVO = 'fds_dispositivo'
let dispositivoEnMemoria = ''   // sin almacén (modo privado): vale para esta vez

function base64url(bytes) {
  let s = ''
  bytes.forEach((b) => { s += String.fromCharCode(b) })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** El secreto de este teléfono: se crea la primera vez (32 bytes al azar) y se reutiliza siempre. */
export function secretoDelTelefono() {
  try {
    const guardado = localStorage.getItem(CLAVE_DISPOSITIVO)
    if (guardado && /^[A-Za-z0-9_-]{43,128}$/.test(guardado)) return guardado
  } catch { /* sin almacén */ }
  if (!dispositivoEnMemoria) dispositivoEnMemoria = base64url(crypto.getRandomValues(new Uint8Array(32)))
  try { localStorage.setItem(CLAVE_DISPOSITIVO, dispositivoEnMemoria) } catch { /* se queda en memoria */ }
  return dispositivoEnMemoria
}

/* El token, leído una sola vez al cargar el módulo de la pantalla (y no en cada pintado): después ya no está en la
   dirección. Se acepta también escrito como ruta (`/c/<token>`), por si alguien lo copia así. */
function leerToken(deRuta) {
  const delFragmento = (window.location.hash || '').replace(/^#/, '').trim()
  return delFragmento || String(deRuta || '').trim()
}

function haySesionDelPanel() {
  try { return !!localStorage.getItem('flota_token') } catch { return false }
}

export default function EntrarConEnlace() {
  const { t } = useT()
  const { token: deRuta } = useParams()
  useTitulo(t('alta.c.titulo'))
  const [token] = useState(() => leerToken(deRuta))
  const [avisoPanel, setAvisoPanel] = useState(() => haySesionDelPanel())
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(() => (leerToken(deRuta) ? null : { texto: t('alta.c.e401'), final: true }))

  // Fuera de la dirección cuanto antes, y que esta página no mande la dirección a nadie.
  useEffect(() => {
    try { window.history.replaceState(null, '', '/c') } catch { /* sin historial */ }
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])

  async function entrar() {
    if (!token || ocupado) return
    setOcupado(true); setError(null)
    let r
    try {
      r = await fetch(`${API_BASE}/auth/enlace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, dispositivo: secretoDelTelefono() }),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      setError({ texto: t('alta.c.eRed') }); setOcupado(false); return
    }
    let j = null
    try { j = await r.json() } catch { j = null }
    const detalle = typeof j?.detail === 'string' && j.detail ? j.detail : ''
    if (r.ok && j?.access_token) {
      try {
        localStorage.setItem(DRIVER_TOKEN_KEY, j.access_token)
        localStorage.setItem('flota_driver', JSON.stringify({
          id: j.id, name: j.name, email: j.email || null, center: j.center || null, configurar_cuenta: false,
        }))
      } catch {
        setError({ texto: t('alta.c.eOtro') }); setOcupado(false); return
      }
      window.location.replace(`/conductor${j.slug ? `#${j.slug}` : ''}`)
      return
    }
    if (r.status === 401) setError({ texto: detalle || t('alta.c.e401'), final: true })
    else if (r.status === 409) setError({ texto: detalle || t('alta.c.e409'), final: true })
    else if (r.status === 429) setError({ texto: t('alta.c.e429'), final: true })
    else setError({ texto: t('alta.c.eOtro') })
    setOcupado(false)
  }

  return (
    <MarcoEntrada testid="entrar-con-enlace">
      {avisoPanel && !error ? (
        <section className="flex flex-1 flex-col" aria-labelledby="c-titulo">
          <h1 id="c-titulo" className={TITULO}>{t('alta.c.titulo')}</h1>
          <p role="alert" className={`mt-4 ${AVISO}`}>{t('alta.c.avisoPanel')}</p>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            <a href="/panel" className={`${BTN_PRIMARIO} w-full`}>{t('alta.c.noAbrir')}</a>
            <button type="button" className={`${BTN_SECUNDARIO} w-full`} onClick={() => setAvisoPanel(false)}>{t('alta.c.abrirIgual')}</button>
          </div>
        </section>
      ) : error?.final ? (
        <section className="flex flex-1 flex-col" aria-labelledby="c-titulo">
          <h1 id="c-titulo" className={TITULO}>{t('alta.c.noEntra')}</h1>
          <p role="alert" className={`mt-3 ${TEXTO}`} data-testid="c-error">{error.texto}</p>
          <div className="mt-auto pt-10">
            <a href="/conductor" className={`${BTN_SECUNDARIO} w-full`}>{t('alta.c.conCorreo')}</a>
          </div>
        </section>
      ) : (
        <section className="flex flex-1 flex-col" aria-labelledby="c-titulo">
          <h1 id="c-titulo" className={TITULO}>{t('alta.c.titulo')}</h1>
          <p className={`mt-3 ${TEXTO}`}>{t('alta.c.sub')}</p>
          {error && <p role="alert" className={`mt-4 ${ERROR}`} data-testid="c-error">{error.texto}</p>}
          <div className="mt-auto pt-10">
            <button type="button" className={`${BTN_PRIMARIO} w-full`} disabled={ocupado} onClick={entrar}>
              {ocupado ? t('alta.c.entrando') : t('alta.c.entrar')}
            </button>
          </div>
        </section>
      )}
    </MarcoEntrada>
  )
}
