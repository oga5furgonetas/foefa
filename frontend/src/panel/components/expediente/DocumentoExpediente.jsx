import { useT, LANG_LOCALE } from '../../../i18n'
import { MARCA } from '../../../marca'
import Matricula from '../../../components/Matricula'
import { selloDeFecha } from '../../../lib/sello'
import CalendarioDias from './CalendarioDias'
import FotoConCaja from './FotoConCaja'
import { momento, fechaLarga, numero, euros, comoLista } from './formato'
import './expediente.css'

/* EL EXPEDIENTE DEL VEHÍCULO (14-11-2026, «Antes del perito»): el documento que el dueño de una flota imprime, o
   guarda en PDF, y pone encima de la mesa el día que devuelve la furgoneta al renting o le pasan un cargo.
   UNA sola pieza para el panel (/panel/vehiculos/:id/expediente, con los datos de GET /vehicles/{id}/antes-del-perito)
   y para el ejemplo público (/expediente-ejemplo, con datos inventados): `datos` tiene la forma EXACTA de esa respuesta
   (CONTRATO.md §C).
   Lo que sale y lo que no, a propósito:
   - solo golpes confirmados por una persona (el servidor no manda otros); nada de la IA, ni importes estimados: el
     coste es el que se apuntó al repararlo;
   - «quién la llevaba» solo cuando el servidor dice `atribuible`; si no, «Sin conductor atribuible» y el motivo en
     llano. Nunca quién dio el golpe;
   - las fechas son las de llegada al servidor, en la zona de la empresa, tal como vienen (formato.js);
   - al imprimir: A4, márgenes de 14 mm, un golpe nunca partido entre dos hojas, y en el pie de cada hoja la frase de
     las fechas y el número de página (expediente.css y el <style> de abajo, con los textos en su idioma);
   - lo ÚNICO de la IA es el anexo del final (`posibles_ia`, CONTRATO R8), y solo si trae algo: lo que marcó y nadie ha
     confirmado ni descartado, en pequeño y en gris, sin conductor, sin gravedad, sin coste y fuera de toda cifra y del
     calendario. Se dice que no está confirmado. El ejemplo público no lo lleva. Es para el dueño, no para el perito
     (tanda 5, E1): en pantalla sale siempre; en PAPEL, solo con `iaEnPapel` (la casilla junto a «Imprimir»). Sus
     fechas, en el mismo formato que las de los golpes (E3). */

const VISTAS = ['frontal', 'trasera', 'lateral_izq', 'lateral_der']

// El pie de cada hoja impresa: letra pequeña y gris, pegado arriba de su margen.
const CAJA_PIE = 'font-size: 8pt; color: #545e66; vertical-align: top; padding-top: 3mm;'
// Una cadena para `content:` de CSS: entre comillas y sin nada que la rompa.
const cadenaCss = (s) => `"${String(s ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`

function Linea({ etiqueta, children, testid }) {
  return (
    <div className="exp-linea" data-testid={testid}>
      <span>{etiqueta}</span>
      <div>{children}</div>
    </div>
  )
}

export default function DocumentoExpediente({ datos, empresa, iaEnPapel = false }) {
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  const marca = MARCA.nombre
  const v = datos?.vehiculo || {}
  const periodo = datos?.periodo || {}
  const c = datos?.cuentas || {}
  const golpes = comoLista(datos?.golpes).filter((g) => g && typeof g === 'object')
  const nuevos = golpes.filter((g) => !g.ya_estaba)
  const yaEstaban = golpes.filter((g) => g.ya_estaba)
  const fotosEntro = comoLista(datos?.como_entro?.fotos).filter((f) => f && VISTAS.includes(f.vista))
  const fotosEsta = comoLista(datos?.como_esta?.fotos).filter((f) => f && VISTAS.includes(f.vista))
  // Los lados que salen en «Cómo entró» o en «Cómo está hoy», en su orden: cada uno ocupa el mismo sitio en las dos.
  const vistasJuntas = VISTAS.filter((k) => fotosEntro.some((f) => f.vista === k) || fotosEsta.some((f) => f.vista === k))
  const hayRevisiones = Boolean(periodo.desde && periodo.hasta)
  const posiblesIA = comoLista(datos?.posibles_ia).filter((p) => p && typeof p === 'object')
  const posiblesMas = typeof datos?.posibles_ia_mas === 'number' && datos.posibles_ia_mas > 0 ? datos.posibles_ia_mas : 0

  const largo = (x) => fechaLarga(x, locale)
  const vista = (k) => (VISTAS.includes(k) ? t(`exp.vista.${k}`) : '')
  const persona = (p) => (p && p.nombre) || t('exp.sinNombre')
  // La pieza en el idioma del documento: por su clave (la misma lista que el repaso, `repaso.p.<clave>`); sin clave, con
  // «otra» o con una que este panel no conozca, lo que escribió la persona, tal cual (CONTRATO.md R2).
  const pieza = (g) => {
    const k = typeof g.pieza_clave === 'string' && g.pieza_clave && g.pieza_clave !== 'otra' ? `repaso.p.${g.pieza_clave}` : ''
    const traducida = k ? t(k) : ''
    return (traducida && traducida !== k ? traducida : g.pieza) || t('exp.g.sinPieza')
  }
  const sev = (s) => { const x = t(`sev.${s}`); return s && x !== `sev.${s}` ? x : '' }
  const cifra = (n) => (typeof n === 'number' && Number.isFinite(n) ? numero(n, locale) : '0')

  const modelo = [
    v.modelo,
    v.fin_renting ? t('exp.renting').replace('{f}', largo(v.fin_renting)) : '',
    typeof v.km === 'number'
      ? (v.km_fecha
        ? t('exp.km').replace('{n}', numero(v.km, locale)).replace('{f}', largo(v.km_fecha))
        : t('exp.km.sinFecha').replace('{n}', numero(v.km, locale)))
      : '',
  ].filter(Boolean)

  const motivo = (a) => {
    switch (a?.motivo) {
      case 'varios_conductores': {
        const nombres = comoLista(a.conductores).map(persona)
        return nombres.length
          ? t('exp.m.varios_conductores').replace('{n}', nombres.join(', '))
          : t('exp.m.varios_conductores.sin')
      }
      case 'varios_dias':
        return typeof a.dias === 'number' ? t('exp.m.varios_dias').replace('{n}', numero(a.dias, locale)) : t('exp.m.varios_dias.sin')
      case 'anterior_sin_repasar': return t('exp.m.anterior_sin_repasar')
      case 'sin_foto_anterior': return t('exp.m.sin_foto_anterior')
      case 'ya_estaba': return t('exp.m.ya_estaba')
      case 'sin_conductor': return t('exp.m.sin_conductor')
      default: return ''
    }
  }

  const dias = (n) => (n === 0 ? t('exp.dias0') : n === 1 ? t('exp.dias1') : t('exp.diasN').replace('{n}', numero(n, locale)))

  const estado = (r) => {
    switch (r?.estado) {
      case 'abierto': return t('exp.e.abierto')
      case 'en_taller': return r.orden_numero != null && r.orden_numero !== ''
        ? t('exp.e.en_tallerOrden').replace('{n}', String(r.orden_numero)) : t('exp.e.en_taller')
      case 'reparado': return r.reparado_at ? t('exp.e.reparado').replace('{f}', largo(r.reparado_at)) : t('exp.e.reparadoSin')
      default: return t('exp.e.desconocido')
    }
  }

  // Las líneas que van debajo de las fotos de cada golpe.
  const detalle = (g, { conConductor }) => {
    const a = g.atribucion || {}
    const coste = euros(g.reparacion?.coste, locale)
    return (
      <div className="exp-lineas">
        {conConductor && (a.atribuible && a.conductor
          ? (
            <Linea etiqueta={t('exp.g.llevo')} testid="atribucion">
              <b>{persona(a.conductor)}</b>{typeof a.dias === 'number' ? ` (${dias(a.dias)})` : ''}
            </Linea>
          ) : (
            <Linea etiqueta={t('exp.g.conductor')} testid="atribucion">
              <b>{t('exp.g.sinAtribuible')}</b>
              {motivo(a) && <span className="exp-motivo" data-testid="motivo">{motivo(a)}</span>}
            </Linea>
          ))}
        {sev(g.gravedad) && <Linea etiqueta={t('exp.g.gravedad')}>{sev(g.gravedad)}</Linea>}
        {g.confirmado_por && (
          <Linea etiqueta={t('exp.g.marcado')}>
            {g.confirmado_at
              ? t('exp.g.marcadoEl').replace('{p}', g.confirmado_por).replace('{f}', largo(g.confirmado_at))
              : g.confirmado_por}
          </Linea>
        )}
        <Linea etiqueta={t('exp.g.estado')} testid="estado"><b>{estado(g.reparacion)}</b></Linea>
        {coste && <Linea etiqueta={t('exp.g.coste')} testid="coste">{coste}</Linea>}
      </div>
    )
  }

  const titulo = (g, frase) => (
    <h3 className="exp-golpe-t">
      <b>{pieza(g)}</b>
      {frase && <span> · {frase}</span>}
    </h3>
  )

  const sello = (f) => momento(f?.fecha, f?.hora, f?.recibida_at)
  // Cuántos hay en cada lista, junto a su título: la cifra de arriba (todos los confirmados) es la suma de las dos.
  const cuantos = (n) => (n > 0 ? <span className="exp-cuenta" data-testid="cuantos">{numero(n, locale)}</span> : null)
  const pie = t('exp.pie').replace('{marca}', marca)
  const matricula = v.matricula || ''

  return (
    <article className="exp-hoja" data-testid="expediente">
      {/* El pie y el número de cada hoja impresa, con los textos en el idioma del panel. */}
      <style>{`@page { size: A4; margin: 14mm;
  @bottom-left { content: ${cadenaCss(pie)}; ${CAJA_PIE} font-family: 'Archivo Variable', Archivo, system-ui, sans-serif; }
  @bottom-right { content: ${cadenaCss(matricula ? `${matricula} · ` : '')} counter(page) " / " counter(pages); ${CAJA_PIE} font-family: 'IBM Plex Mono', ui-monospace, monospace; } }`}</style>

      <header className="exp-cabecera">
        <div className="exp-enc">
          <span><b>{marca}</b></span>
          {datos?.generado_at && (
            <span className="exp-mono" data-testid="generado">
              {t('exp.generado').replace('{f}', selloDeFecha(datos.generado_at, { idioma: lang }))}
            </span>
          )}
        </div>
        <h1>{t('exp.titulo')}</h1>
        {empresa && <p className="exp-empresa" data-testid="empresa">{empresa}</p>}
        <div className="exp-matricula"><Matricula texto={matricula} /></div>
        {modelo.length > 0 && <p className="exp-modelo">{modelo.join(' · ')}</p>}
        <p className="exp-periodo" data-testid="periodo">
          {!hayRevisiones ? t('exp.periodo.nada')
            : periodo.desde === periodo.hasta ? t('exp.periodo.uno').replace('{d}', largo(periodo.desde))
              : t('exp.periodo').replace('{d}', largo(periodo.desde)).replace('{h}', largo(periodo.hasta))}
        </p>
        <dl className="exp-cifras" data-testid="cifras">
          <div><dt>{t('exp.c.revisiones')}</dt><dd>{cifra(c.revisiones)}</dd></div>
          <div><dt>{t('exp.c.conductores')}</dt><dd>{cifra(c.conductores)}</dd></div>
          <div><dt>{t('exp.c.golpes')}</dt><dd>{cifra(c.golpes)}</dd></div>
          <div><dt>{t('exp.c.reparados')}</dt><dd>{cifra(c.reparados)}</dd></div>
        </dl>
      </header>

      {hayRevisiones && (
        <section className="exp-seccion exp-seccion-cal" data-testid="bloque-calendario">
          <h2>{t('exp.cal.t')}</h2>
          <CalendarioDias desde={periodo.desde} hasta={periodo.hasta} calendario={datos?.calendario} locale={locale}
            textos={{ revisada: t('exp.cal.revisada'), sin: t('exp.cal.sin'), golpe: t('exp.cal.golpe') }}
            cuantosDias={(n) => (n === 1 ? t('exp.dias1') : t('exp.diasN').replace('{n}', numero(n, locale)))} />
        </section>
      )}

      <section className="exp-seccion" data-testid="bloque-golpes">
        <h2>{t('exp.golpes.t')}{cuantos(nuevos.length)}</h2>
        {nuevos.length === 0 ? (
          <p className="exp-nota" data-testid="sin-golpes">
            {yaEstaban.length ? t('exp.golpes.ningunoNuevo') : t('exp.golpes.ninguno')}
          </p>
        ) : yaEstaban.length > 0 && <p className="exp-sub">{t('exp.golpes.aparte')}</p>}
        {nuevos.map((g) => {
          /* El nombre en el sello de cada foto, solo si el golpe es atribuible: al lado de «Sin conductor atribuible»,
             el nombre de quien hizo la revisión anterior se leería como una insinuación. Sin él, fecha y hora. */
          const conNombre = Boolean(g.atribucion?.atribuible)
          return (
            <div className="exp-golpe" key={g.id} data-testid="golpe">
              {titulo(g, g.fecha ? t('exp.g.aparece').replace('{f}', largo(g.fecha)) : '')}
              {g.descripcion && <p className="exp-desc">{g.descripcion}</p>}
              <div className="exp-par">
                {g.anterior?.foto_url
                  ? <FotoConCaja src={g.anterior.foto_url} alt={`${vista(g.vista)} · ${largo(g.anterior.fecha)}`}
                      etiqueta={t('exp.g.fotoAntes')} sello={sello(g.anterior)}
                      quien={conNombre ? g.anterior.conductor?.nombre : ''}
                      rota={t('exp.fotoRota')} idioma={lang} />
                  : <FotoConCaja src={null} rota={t('exp.g.sinAnterior')} etiqueta={t('exp.g.fotoAntes')} />}
                <FotoConCaja src={g.foto_url} alt={`${vista(g.vista)} · ${largo(g.fecha)}`} caja={g.box_2d}
                  etiqueta={t('exp.g.fotoGolpe')} sello={sello(g)}
                  quien={conNombre ? g.atribucion?.conductor?.nombre : ''}
                  rota={t('exp.fotoRota')} idioma={lang} />
              </div>
              {detalle(g, { conConductor: true })}
            </div>
          )
        })}
      </section>

      <section className="exp-seccion" data-testid="bloque-ya-estaba">
        <h2>{t('exp.ya.t')}{cuantos(yaEstaban.length)}</h2>
        {yaEstaban.length === 0
          ? <p className="exp-nota">{hayRevisiones ? t('exp.ya.ninguno') : t('exp.periodo.nada')}</p>
          : <p className="exp-sub">{t('exp.ya.sub')}</p>}
        {yaEstaban.map((g) => (
          <div className="exp-golpe exp-golpe-ya" key={g.id} data-testid="golpe-ya">
            {titulo(g, g.fecha ? t('exp.ya.cuando').replace('{f}', largo(g.fecha)) : '')}
            {g.descripcion && <p className="exp-desc">{g.descripcion}</p>}
            <div className="exp-par">
              <FotoConCaja src={g.foto_url} alt={`${vista(g.vista)} · ${largo(g.fecha)}`} caja={g.box_2d}
                sello={sello(g)} rota={t('exp.fotoRota')} idioma={lang} />
              {detalle(g, { conConductor: true })}
            </div>
          </div>
        ))}
      </section>

      {/* Cómo entró y cómo está hoy, en una fila de dos columnas (como «Antes / Con el golpe»): cada lado en el mismo
          sitio de las dos, para compararlos de un vistazo, y una hoja menos al imprimir. Las dos van juntas en la hoja. */}
      <div className="exp-dos" data-testid="entro-esta">
        {[
          ['entro', fotosEntro, t('exp.entro.t'), t(fotosEntro.length === 1 ? 'exp.entro.sub1' : 'exp.entro.sub')],
          ['esta', fotosEsta, t('exp.esta.t'), t(fotosEsta.length === 1 ? 'exp.esta.sub1' : 'exp.esta.sub')],
        ]
          .map(([clave, fotos, h, sub]) => (
            <section className="exp-seccion" key={clave} data-testid={`bloque-${clave}`}>
              <h2>{h}</h2>
              {fotos.length === 0
                ? <p className="exp-nota">{hayRevisiones ? t('exp.sinFotos') : t('exp.periodo.nada')}</p>
                : <p className="exp-sub">{sub}</p>}
              {fotos.length > 0 && (
                /* Cada lado, siempre del tamaño de su celda de la rejilla 2×2, también cuando solo hay uno (E2, tanda 5):
                   una foto sola a todo el ancho de la columna empujaba «Qué prueba» a una tercera hoja. */
                <div className="exp-galeria" data-lados={vistasJuntas.length}>
                  {vistasJuntas.map((k) => {
                    const f = fotos.find((x) => x.vista === k)
                    // El lado que esta columna no tiene deja su hueco: así cada lado cae en el mismo sitio de las dos.
                    if (!f) return <div key={k} className="exp-galeria-hueco" aria-hidden="true" />
                    return (
                      <figure key={`${f.vista}-${f.inspection_id}-${f.photo_index}`}>
                        {/* El lado, en la esquina de la foto, como «Antes» y «Con el golpe» (E2, tanda 5: una línea
                            menos por foto, y así «Qué prueba» entra en la hoja); el pie queda para los lectores. */}
                        <FotoConCaja src={f.foto_url} alt={`${vista(f.vista)} · ${largo(f.fecha)}`} sello={sello(f)}
                          etiqueta={vista(f.vista)} rota={t('exp.fotoRota')} idioma={lang} />
                        <figcaption className="exp-oculto">{vista(f.vista)}</figcaption>
                      </figure>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
      </div>

      <section className="exp-seccion exp-prueba" data-testid="bloque-prueba">
        <h2>{t('exp.prueba.t')}</h2>
        <div className="exp-prueba-cols">
          <div>
            <h3>{t('exp.prueba.siT')}</h3>
            <p>{t('exp.prueba.si').replace('{marca}', marca)}</p>
          </div>
          <div>
            <h3>{t('exp.prueba.noT')}</h3>
            <p>{t('exp.prueba.no')}</p>
          </div>
        </div>
        <p className="exp-prueba-lee">{t('exp.prueba.lee')}</p>
      </section>

      {posiblesIA.length > 0 && (
        <section className={`exp-seccion exp-ia${iaEnPapel ? '' : ' exp-no-imprimir'}`} data-testid="bloque-posibles-ia"
          data-en-papel={iaEnPapel ? 'si' : 'no'}>
          <h2>{t('exp.ia.t')}</h2>
          <p className="exp-sub">{t('exp.ia.nota')}</p>
          {!iaEnPapel && <p className="exp-sub exp-ia-fuera" data-testid="ia-fuera-papel">{t('exp.ia.fueraPapel')}</p>}
          {posiblesIA.map((p, i) => (
            <div className="exp-ia-item" key={`${p.inspeccion_id || ''}-${i}`} data-testid="posible-ia">
              <p className="exp-ia-texto">
                <b>{(typeof p.pieza === 'string' && p.pieza.trim()) || t('exp.g.sinPieza')}</b>
                {largo(p.fecha) && <span> · {t('exp.ia.cuando').replace('{f}', largo(p.fecha))}</span>}
              </p>
              <div className="exp-ia-fotos">
                {p.anterior?.foto_url && (
                  <figure>
                    <FotoConCaja src={p.anterior.foto_url} alt={`${vista(p.vista)} · ${largo(p.anterior.fecha)}`}
                      rota={t('exp.fotoRota')} idioma={lang} />
                    <figcaption>{largo(p.anterior.fecha) ? t('exp.ia.antes').replace('{f}', largo(p.anterior.fecha)) : t('exp.g.fotoAntes')}</figcaption>
                  </figure>
                )}
                <figure>
                  <FotoConCaja src={p.foto_url || null} alt={`${vista(p.vista)} · ${largo(p.fecha)}`} caja={p.box_2d} tono="ia"
                    rota={p.foto_url ? t('exp.fotoRota') : t('exp.ia.sinFoto')} idioma={lang} />
                  {p.foto_url && <figcaption>{t('exp.ia.marca')}</figcaption>}
                </figure>
              </div>
            </div>
          ))}
          {posiblesMas > 0 && <p className="exp-ia-mas" data-testid="posibles-ia-mas">{t('exp.ia.mas').replace('{n}', numero(posiblesMas, locale))}</p>}
        </section>
      )}

      <footer className="exp-pie-pantalla">{pie}</footer>
    </article>
  )
}
