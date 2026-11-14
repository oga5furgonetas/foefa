import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { useT } from '../../i18n'
import { usePlan } from '../../lib/usePlan'
import { isAuthed, canSee } from '../auth'
import { getExpedienteAntesDelPerito } from '../../services/api'
import DocumentoExpediente from '../components/expediente/DocumentoExpediente'

/* EL EXPEDIENTE DE UNA FURGONETA, EN EL PANEL (14-11-2026): /panel/vehiculos/:id/expediente.
   Una hoja A4 sobre el fondo del panel y, encima y fuera de ella (no se imprime), la barra con «Imprimir o guardar en
   PDF» y la vuelta a la furgoneta. El documento es components/expediente/DocumentoExpediente.jsx, el mismo del
   ejemplo público.
   VA FUERA DE PanelLayout a propósito: su guardián decide por el ÚLTIMO tramo de la dirección («expediente»), que no es
   ningún módulo, y a toda empresa con su lista de módulos la echaría a otra pantalla. Aquí se hace la misma cuenta que
   haría con «vehiculos»: sesión abierta, la empresa con ese módulo y la persona con ese permiso. Y así la hoja ocupa la
   pantalla sin el menú, que es lo que se quiere al leerla y al imprimirla. El fondo va en un <main> para que el tema
   «híbrido» (que solo aclara <main>) también lo pinte de papel. */

const ERRORES_EXP = {
  'Esa furgoneta no existe': 'exp.err.noexiste',
  'No tienes acceso a esa furgoneta': 'exp.err.acceso',
  'No tienes permiso para esa pantalla': 'repaso.err.permiso',
  'Tu cuenta no tiene esa pantalla': 'repaso.err.modulo',
}

export default function Expediente() {
  const { id } = useParams()
  const { t } = useT()
  const { billing, modulos } = usePlan()
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: '' })
  const [intento, setIntento] = useState(0)
  const dentro = isAuthed()
  const sinModulo = Array.isArray(modulos) && !modulos.includes('vehiculos')
  const puede = dentro && canSee('vehiculos') && !sinModulo

  useEffect(() => {
    if (!puede || !id) return undefined
    let vivo = true
    setEstado({ cargando: true, datos: null, error: '' })
    getExpedienteAntesDelPerito(id)
      .then((r) => {
        if (!vivo) return
        const d = r?.data
        // Una respuesta que no tiene la forma del contrato no se pinta a medias: se dice que no se pudo.
        if (!d || typeof d !== 'object' || Array.isArray(d) || !d.vehiculo || typeof d.vehiculo !== 'object') {
          setEstado({ cargando: false, datos: null, error: t('exp.error') })
          return
        }
        setEstado({ cargando: false, datos: d, error: '' })
      })
      .catch((e) => {
        if (!vivo) return
        const det = e?.response?.data?.detail
        // Los mensajes fijos del servidor (CONTRATO §C y M6), en el idioma de quien mira; otro, tal cual.
        const clave = typeof det === 'string' ? ERRORES_EXP[det.trim()] : null
        setEstado({ cargando: false, datos: null, error: clave ? t(clave) : (typeof det === 'string' && det ? det : t('exp.error')) })
      })
    return () => { vivo = false }
  }, [id, puede, intento]) // eslint-disable-line react-hooks/exhaustive-deps

  // El título de la pestaña es el nombre que el navegador propone al guardar en PDF.
  const matricula = estado.datos?.vehiculo?.matricula
  useEffect(() => {
    if (!matricula) return undefined
    const antes = document.title
    document.title = t('exp.docTitulo').replace('{mat}', matricula)
    return () => { document.title = antes }
  }, [matricula, t])

  if (!dentro) return <Navigate to="/panel/login" replace />

  const volver = `/panel/vehiculos${id ? `?open=${encodeURIComponent(id)}` : ''}`
  const sinGolpes = estado.datos && !(Array.isArray(estado.datos.golpes) && estado.datos.golpes.some((g) => g && !g.ya_estaba))

  return (
    <main className="min-h-screen bg-dark-950 px-4 pt-4 text-dark-100 md:px-6 md:pt-6">
      <div className="exp-fondo">
        <div className="exp-barra exp-no-imprimir">
          <Link to={volver} className="exp-boton exp-boton-linea border-dark-700 text-dark-200 hover:border-dark-600 hover:text-dark-50">
            <ArrowLeft size={16} aria-hidden="true" /> {t('exp.volver')}
          </Link>
          {estado.datos && (
            <button type="button" className="exp-boton exp-boton-firma" onClick={() => window.print()}>
              <Printer size={18} aria-hidden="true" /> {t('exp.imprimir')}
            </button>
          )}
        </div>

        {!puede ? (
          <p className="exp-aviso exp-no-imprimir rounded-xl border border-dark-700 p-5 text-sm text-dark-300" data-testid="sin-acceso">
            {t('exp.sinAcceso')}
          </p>
        ) : estado.cargando ? (
          <p className="exp-aviso flex items-center gap-2 p-5 text-sm text-dark-400">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> {t('exp.cargando')}
          </p>
        ) : estado.error ? (
          <div className="exp-aviso exp-no-imprimir rounded-xl border border-dark-700 p-5 text-sm" role="alert">
            <p className="text-dark-100">{estado.error}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)}
              className="mt-3 rounded-lg border border-dark-700 px-3 py-1.5 text-dark-200 hover:border-dark-600">
              {t('exp.reintentar')}
            </button>
          </div>
        ) : (
          <>
            {sinGolpes && (
              <p className="exp-aviso exp-no-imprimir rounded-xl border border-dark-700 px-4 py-3 text-sm text-dark-300" data-testid="aviso-repaso">
                {t('exp.aviso.repaso')}{' '}
                <Link to="/panel/repaso" className="font-semibold text-dark-50 underline underline-offset-2">{t('exp.aviso.ir')}</Link>
              </p>
            )}
            <DocumentoExpediente datos={estado.datos} empresa={billing?.org_name || ''} />
          </>
        )}
      </div>
    </main>
  )
}
