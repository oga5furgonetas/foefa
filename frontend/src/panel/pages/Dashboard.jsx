import InicioReparto from './InicioReparto'
import { usePlan } from '../../lib/usePlan'
import { esReparto } from '../../lib/sector'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { getDashboardStats, getItvAlerts, getDamageCosts, getStatsHoy, getReviewQueue, getEstadoFlota, getCentrosHoy } from '../api'
import casarCentro from '../casarCentro'
import { useT, LANG_LOCALE } from '../../i18n'
import { lista } from '../../lib/lista'
import { PageSkeleton } from '../components/Skeleton'
import Activacion from '../components/Activacion'
import EntradaArranque, { arranqueYaHecho } from '../components/EntradaArranque'
import Matricula from '../../components/Matricula'
import { mercEstado, getRepasoPendientes } from '../../services/api'
import { hoyLocal, isoLocal } from '../../lib/fecha'

/* EL INICIO DEL PANEL (rehecho el 14-11-2026, ARREGLOS-5 I1-I7: «que no se note que es IA»). Es lo primero que ve cada
   cliente cada día, y se compone como una página de un periódico de trabajo, con el mismo idioma que el Repaso:
   tinta sobre papel, reglas finas de 1 px, cifras en Plex Mono tabular, la matrícula como pieza y UN solo cian (la
   acción del día). Fuera la rejilla de tarjetas con un icono en un cuadradito, los rótulos en mono mayúscula espaciada,
   las barras verde menta, las pastillas de color y los números que «cuentan» al cargar. Lo que hay es lo MISMO que
   antes (mismos atajos, en el mismo orden, con los mismos enlaces y cifras): cambia cómo se compone, no lo que hay.
     · Arriba, la fecha en gris, el saludo y la frase del día.
     · El Repaso de hoy (la empresa con el módulo y `avisar !== false`): una línea con su acción.
     · Los atajos, en una lista con reglas; a la derecha, en mono, lo pendiente.
     · El día de hoy, las salidas con su matrícula, y lo de detalle plegado.
   La empresa con el arranque a medias ve SOLO el arranque (EntradaArranque). */

/* ── helpers ── */
function greeting(t) {
  const h = new Date().getHours()
  // De madrugada es «buenas noches»: a las 2:00 decía «buenos días».
  if (h >= 6 && h < 13) return t('greet.morning')
  if (h >= 13 && h < 20) return t('greet.afternoon')
  return t('greet.evening')
}
function fmtDate(locale) {
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/* Los colores con significado de la casa (los mismos del Repaso): hecho, aviso y fallo. Solo en el TEXTO, y solo
   cuando hay algo: un cero en color entrena a no mirar el color. */
const TONO_TEXTO = { ok: 'text-ruta-ok-texto', aviso: 'text-ruta-aviso-texto', fallo: 'text-ruta-peligro-texto' }

/* Una fila de cifra, como «Hoy» en el Repaso: etiqueta en gris, la cifra en mono tabular a la derecha. Con `onClick`,
   la fila entera lleva a su pantalla (y lo dice con la flecha). */
function Cifra({ n, label, tono, onClick, testId }) {
  if (n == null) return null
  const dentro = (
    <>
      <span className={`block text-[13.5px] first-letter:uppercase ${onClick ? 'text-dark-200 group-hover:underline group-hover:underline-offset-4' : 'text-dark-300'}`}>{label}</span>
      <span className="flex items-center gap-1.5">
        <b className={`font-mono text-[17px] font-semibold tabular-nums ${tono && n > 0 ? TONO_TEXTO[tono] : 'text-dark-50'}`}>{n}</b>
        {onClick && <ChevronRight size={15} aria-hidden="true" className="text-dark-500" />}
      </span>
    </>
  )
  const clase = 'flex min-h-[44px] w-full items-center justify-between gap-4 border-b border-dark-800 py-2 text-left'
  return onClick
    ? <button type="button" onClick={onClick} data-testid={testId} className={`group ${clase}`}>{dentro}</button>
    : <div data-testid={testId} className={clase}>{dentro}</div>
}

/* ── ANILLO ───────────────────────────────────────────────────────────────────
   Donut en SVG puro: sin librería de gráficos, sin peso extra en el bundle y
   sin dependencias que mantener. Un `stroke-dasharray` sobre un círculo hace
   exactamente lo mismo que una librería para este caso. El hueco va en la
   línea de la casa (currentColor) y los tramos en los colores con significado. */
function Anillo({ segmentos, centro, sub, size = 132 }) {
  const R = (size - 14) / 2
  const C = 2 * Math.PI * R
  const total = segmentos.reduce((a, s) => a + s.n, 0) || 1
  let acc = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 text-dark-800" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="currentColor" strokeWidth="9" />
        {segmentos.map((s) => {
          const frac = s.n / total
          const el = (
            <circle key={s.k} cx={size / 2} cy={size / 2} r={R} fill="none"
              stroke={s.color} strokeWidth="9" strokeLinecap="butt"
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-acc * C} />
          )
          acc += frac
          return s.n > 0 ? el : null
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-dark-50">{centro}</span>
        {sub && <span className="mt-1 text-[11px] text-dark-500">{sub}</span>}
      </div>
    </div>
  )
}

/* Barras de los últimos 7 días. También SVG-libre: divs con altura relativa.
   El día de hoy va en tinta porque es el único sobre el que aún se puede
   actuar; los demás, en gris. */
function Barras({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.n))
  /* ALTURA EN PÍXELES, no en %. Con `height: X%` dentro de un contenedor cuya
     altura la decide flexbox, el navegador no tiene contra qué resolver el
     porcentaje y las barras salían con altura CERO: el panel enseñaba "321
     inspecciones" y debajo un hueco vacío. Con píxeles calculados no hay
     ambigüedad posible. */
  const ALTO = 84
  return (
    <div className="flex items-end gap-1.5" style={{ height: ALTO + 22 }}>
      {dias.map((d, i) => (
        <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
          <span className="font-mono text-[10.5px] tabular-nums text-dark-400">
            {d.n > 0 ? d.n : ''}
          </span>
          <div className={`w-full rounded-t-sm ${i === dias.length - 1 ? 'bg-dark-50' : 'bg-dark-600'}`}
            style={{ height: Math.max(2, Math.round((d.n / max) * ALTO)) }} />
          <span className="text-[11px] text-dark-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── LAS SALIDAS DE HOY ───────────────────────────────────────────────────────
   Una fila por vehículo del cuadrante de hoy: la matrícula como pieza, quién lo lleva, la zona en gris y, a la
   derecha, si ya tiene su revisión de salida, en texto con su color (sin pastillas). Una furgoneta que sale sin fotos
   es un golpe que luego no se puede atribuir a nadie: por eso «sin revisar» va en el color de aviso. Se pincha y lleva
   a Asignación, donde se ve el día entero. */
// `centro` (11-11-2026, portal_inicio-1): con «Todos» las filas mezclaban las naves sin decir de cuál es cada
// furgoneta; ahora lo dicen, y al tocarla se entra en Asignación con ESE centro ya elegido.
function SalidaFila({ s, onIr, t, centro }) {
  const sev = s.gravedad && SEV_KEYS[s.gravedad]
  const estado = !s.revisada
    ? { texto: t('hoy.pendiente'), tono: 'aviso' }
    : sev ? { texto: t(sev.key), tono: sev.tono } : { texto: t('hoy.revisada'), tono: 'ok' }
  const zona = [s.ruta, centro].filter(Boolean).join(' · ')
  return (
    <li className="border-b border-dark-800">
      <button type="button" onClick={onIr}
        className="group flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
        {s.matricula
          ? <Matricula texto={s.matricula} className="shrink-0 text-[13px]" />
          : <span className="shrink-0 text-[13px] text-dark-400">—</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-dark-100 group-hover:underline group-hover:underline-offset-4">{s.conductor || t('dh.sinConductor')}</span>
          {zona && <span className="block truncate text-[12.5px] text-dark-500">{zona}</span>}
        </span>
        <span className={`shrink-0 text-[13px] font-semibold ${TONO_TEXTO[estado.tono]}`}>{estado.texto}</span>
      </button>
    </li>
  )
}

/* La gravedad en el color de la casa: sin daños en «hecho», leve y moderado en «aviso», grave y crítico en «fallo».
   El color del anillo de «Gráficos» sale de las mismas variables: leve en el gris de la casa y grave, un poco más claro
   que crítico (tanda 6: de noche, ámbar al 50 % y rojo al 60 % salían los dos marrón y no se distinguían). */
const SEV_KEYS = {
  sin_danos: { key: 'sev.sin_danos', tono: 'ok',    color: 'rgb(var(--r-ok-texto))' },
  leve:      { key: 'sev.leve',      tono: 'aviso', color: 'rgb(var(--dk-500))' },
  moderado:  { key: 'sev.moderado',  tono: 'aviso', color: 'rgb(var(--r-aviso-texto))' },
  grave:     { key: 'sev.grave',     tono: 'fallo', color: 'rgb(var(--r-peligro-texto) / 0.75)' },
  critico:   { key: 'sev.critico',   tono: 'fallo', color: 'rgb(var(--r-peligro-texto))' },
}
const SEV_ORDER = ['sin_danos', 'leve', 'moderado', 'grave', 'critico']

/* ── CÓMO VA CADA CENTRO (11-11-2026, revisión de la flota propia: portal_inicio-6 y -2, historia-6, dia-10) ──
   Con «Todos», el Inicio sumaba las naves en una cifra: para saber cuál iba atrasada había que cambiar de nave arriba
   y mirar tres veces, y para saber si estaba la plantilla de hoy o el plan de horas de la semana, entrar en cada
   pantalla. Una fila por centro: sus salidas revisadas y si cada dato está y de cuándo es (sin ninguna cifra de
   Amazon). Cada dato lleva a su pantalla con ese centro ya elegido; el nombre del centro, al Inicio de ese centro.
   Solo salen los datos de pantallas que esta persona puede abrir (`puede`, la regla del menú).
   Desde el 14-11-2026 (I7) sin cajas ni pastillas de color: cada dato es una fila con regla, su nombre en gris y su
   estado en el color de la casa (hecho o aviso). */
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const TONO_DATO = { ok: 'text-ruta-ok-texto', falta: 'text-ruta-aviso-texto', neutro: 'text-dark-200' }

/* La DNR llega con unos dos días de retraso: hasta 4 días sin subir es lo normal; más, se pinta en ámbar (11-11-2026,
   revisión: la de hace una semana salía en gris, igual que la de antes de ayer). El umbral lo puede afinar Dani. */
const DNR_DIAS_NORMAL = 4
const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000)

/* «Plantilla del día: sin guardar hoy» → el nombre en gris y el estado en su color, en la misma frase (el nombre
   accesible del botón sigue siendo la frase entera). */
function TextoDato({ texto, tono }) {
  const i = texto.indexOf(': ')
  if (i < 0) return <span className={TONO_DATO[tono]}>{texto}</span>
  return <><span className="text-dark-400">{texto.slice(0, i + 1)}</span> <span className={TONO_DATO[tono]}>{texto.slice(i + 2)}</span></>
}

function ComoVaCadaCentro({ centers, datos, porCentro, hoyIso, puede, ir, t }) {
  /* En el móvil, cada centro va plegado en una línea con su resumen y sus datos se abren al tocarla (11-11-2026,
     revisión): abiertos, dos centros ocupaban una pantalla entera y «El día de hoy» quedaba muy abajo. En el
     ordenador (sm: en adelante) se ven siempre, como antes. */
  const [abiertos, setAbiertos] = useState({})
  const filas = centers.map((c) => ({
    c,
    d: (datos || []).find((x) => casarCentro(x.centro, [c]) === c) || null,
    p: (porCentro || []).find((x) => casarCentro(x.centro, [c]) === c) || null,
  }))
  const viejo = (iso) => !iso || iso < hoyIso
  return (
    <section className="border-t border-dark-700 py-7" data-testid="como-va-cada-centro">
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{t('centros.hoy.titulo')}</h2>
      <p className="mt-1 text-[13px] text-dark-400">{t('centros.hoy.sub')}</p>
      <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
        {filas.map(({ c, d, p }) => {
          const datosC = [
            p && puede('/panel/asignacion') && {
              to: '/panel/asignacion',
              texto: p.salidas > 0 ? t('centros.hoy.salidas').replace('{n}', p.revisadas).replace('{t}', p.salidas) : t('centros.hoy.sin.salidas'),
              tono: p.salidas === 0 ? 'neutro' : p.revisadas === p.salidas ? 'ok' : 'falta',
            },
            d && puede('/panel/plantilla') && {
              to: '/panel/plantilla',
              texto: `${t('nav.template')}: ${d.plantilla
                ? (d.plantilla.por ? t('centros.hoy.guardada.por').replace('{n}', d.plantilla.por) : t('centros.hoy.guardada'))
                : t('centros.hoy.sin.guardar')}`,
              tono: d.plantilla ? 'ok' : 'falta',
            },
            d && puede('/panel/horas') && {
              to: '/panel/horas',
              texto: `${t('nav.horas')}: ${!d.horas ? t('centros.hoy.sin.plan')
                : d.horas.al_dia ? t('centros.hoy.esta.semana') : t('centros.hoy.semana.del').replace('{f}', ddmm(d.horas.semana))}`,
              tono: d.horas?.al_dia ? 'ok' : 'falta',
            },
            d && puede('/panel/diarios') && {
              to: '/panel/diarios',
              texto: `${t('nav.dnr')}: ${d.dnr_ultimo ? t('centros.hoy.ultimo').replace('{f}', ddmm(d.dnr_ultimo)) : t('centros.hoy.nada')}`,
              tono: d.dnr_ultimo && diasEntre(d.dnr_ultimo, hoyIso) <= DNR_DIAS_NORMAL ? 'neutro' : 'falta',
            },
            d && puede('/panel/cuadrante') && {
              to: '/panel/cuadrante',
              texto: `${t('nav.cuadrante')}: ${d.cuadrante_hasta ? t('centros.hoy.hasta').replace('{f}', ddmm(d.cuadrante_hasta)) : t('centros.hoy.nada')}`,
              tono: viejo(d.cuadrante_hasta) ? 'falta' : 'ok',
            },
            d && puede('/panel/cuadrante') && {
              to: '/panel/cuadrante',
              texto: `${t('centros.hoy.maximas')}: ${d.maximas_hasta ? t('centros.hoy.hasta').replace('{f}', ddmm(d.maximas_hasta)) : t('centros.hoy.nada')}`,
              tono: viejo(d.maximas_hasta) ? 'falta' : 'ok',
            },
          ].filter(Boolean)
          const porMirar = datosC.filter((x) => x.tono === 'falta').length
          /* Sin lo de /stats/centros-hoy (aún no ha llegado, ha fallado o es un servidor de antes) y con pantallas de
             las que sí podría traer datos, no se sabe si está todo: el resumen no dice «Todo al día» (11-11-2026,
             revisión), dice solo las salidas, que sí se saben, en su tono. */
          const sinSaber = !d && ['/panel/plantilla', '/panel/horas', '/panel/diarios', '/panel/cuadrante'].some((r) => puede(r))
          const resumen = sinSaber && p
            ? { texto: p.salidas > 0 ? t('centros.hoy.salidas.corto').replace('{n}', p.revisadas).replace('{t}', p.salidas) : t('centros.hoy.sin.salidas'),
              tono: p.salidas === 0 ? 'neutro' : p.revisadas === p.salidas ? 'ok' : 'falta' }
            : { texto: porMirar ? t('centros.hoy.por.mirar').replace('{n}', porMirar) : t('centros.hoy.al.dia'), tono: porMirar ? 'falta' : 'ok' }
          const abierto = !!abiertos[c]
          return (
            <div key={c} className="border-t border-dark-800" data-centro={c}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => ir(c, '/panel')} aria-label={t('centros.hoy.entrar').replace('{c}', c)}
                  className="group flex min-h-[44px] w-full min-w-0 flex-1 items-center gap-1.5 text-left font-mono text-[15px] font-semibold tracking-normal text-dark-50" data-testid="centro-nombre">
                  <span className="group-hover:underline group-hover:underline-offset-4">{c}</span> <ChevronRight size={15} className="shrink-0 text-dark-500" />
                </button>
                {/* Solo en el móvil: el resumen de la fila, que abre y cierra sus datos. */}
                {datosC.length > 0 && (
                  <button type="button" aria-expanded={abierto} onClick={() => setAbiertos((a) => ({ ...a, [c]: !a[c] }))}
                    className={`flex min-h-[44px] shrink-0 items-center gap-1.5 text-[13px] font-semibold sm:hidden ${TONO_DATO[resumen.tono]}`}>
                    {resumen.texto}
                    <ChevronDown size={14} aria-hidden="true" className={`text-dark-500 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              {datosC.length > 0 && (
                <ul className={`${abierto ? 'block' : 'hidden'} sm:block`}>
                  {datosC.map((x, i) => (
                    <li key={i} className="border-t border-dark-800">
                      <button type="button" onClick={() => ir(c, x.to)} data-tono={x.tono}
                        className="group flex min-h-[40px] w-full items-center justify-between gap-3 py-1.5 text-left text-[13.5px] leading-snug">
                        <span className="min-w-0"><TextoDato texto={x.texto} tono={x.tono} /></span>
                        <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-dark-600 group-hover:text-dark-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── Próximos vencimientos: la matrícula como pieza, la fecha en gris y los días en mono con su color ── */
function ItvAlerts({ items }) {
  const nav = useNavigate()
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  if (!items?.length) return <p className="py-4 text-[13.5px] text-dark-400">{t('dash.no.itv')}</p>
  return (
    <ul className="border-t border-dark-800">
      {items.slice(0, 6).map((a, i) => {
        const daysLeft = a.days_until_expiry ?? a.days_left
        const urgent = daysLeft != null && daysLeft <= 7
        const plate = a.license_plate || a.vehicle_plate || ''
        return (
          <li key={a.id || i} className="border-b border-dark-800">
            <button type="button" onClick={() => nav('/panel/avisos-itv')}
              className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left">
              {plate ? <Matricula texto={plate} className="shrink-0 text-[13px]" /> : <span className="text-dark-400">—</span>}
              <span className="min-w-0 flex-1 truncate text-[13px] text-dark-400">
                {a.itv_expiry || a.expiry_date
                  ? `${t('itv.expires')} ${new Date(a.itv_expiry || a.expiry_date).toLocaleDateString(locale)}`
                  : t('itv.pending')}
              </span>
              {daysLeft != null && (
                <span className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${urgent ? 'text-ruta-peligro-texto' : 'text-ruta-aviso-texto'}`}>
                  {daysLeft <= 0 ? t('itv.vencida') : `${daysLeft}d`}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ── UN ATAJO: nombre en tinta, su dato debajo en gris y, a la derecha, lo pendiente en mono ──────────────────────
   Sustituye a la casilla con icono (I2). Lo pendiente va en el color de aviso de la casa (rojo si no puede esperar)
   y SOLO si hay algo; si no, una flecha. El nombre accesible es el de antes («Vehículos. 2 de 2 · vehículos activos»):
   quien ya llegaba a un atajo con el lector de pantalla, o una prueba, lo sigue encontrando igual. */
function Atajo({ titulo, detalle, aviso, avisoTono = 'rojo', onClick }) {
  return (
    <li className="border-t border-dark-800">
      <button type="button" onClick={onClick} aria-label={detalle ? `${titulo}. ${detalle}` : titulo}
        className="group flex min-h-[60px] w-full items-center justify-between gap-4 py-2.5 text-left">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight text-dark-50 group-hover:underline group-hover:underline-offset-4">{titulo}</span>
          {detalle && <span className="mt-0.5 block truncate text-[13px] text-dark-400">{detalle}</span>}
        </span>
        {aviso > 0
          ? <b className={`shrink-0 font-mono text-[17px] font-semibold tabular-nums ${avisoTono === 'ambar' ? TONO_TEXTO.aviso : TONO_TEXTO.fallo}`}>{aviso}</b>
          : <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-dark-500" />}
      </button>
    </li>
  )
}

/* ── EL REPASO DE HOY, en una línea con su acción (I4) ────────────────────────────────────────────────────────────
   Para la empresa que trabaja con el Repaso (el módulo, el permiso y `avisar !== false` en /repaso/pendientes). El
   número es el MISMO que el del menú (revisiones de hoy por repasar); sin inventar rutas, la línea no dice más que
   eso. El botón cian «Repasar» es el único cian de la pantalla; con todo repasado, la línea lo dice y el botón va con
   borde. */
/* Una frase traducida con sus cifras en mono tabular («<b>31</b> de <b>48</b> repasadas»): cada `{x}` de `cifras`
   se pinta en negrita, el resto tal cual. */
function ConCifras({ texto, cifras, className = 'font-mono font-semibold tabular-nums text-dark-50' }) {
  return texto.split(/(\{[a-z]+\})/).map((trozo, i) => {
    const k = /^\{([a-z]+)\}$/.exec(trozo)?.[1]
    return k && k in cifras ? <b key={i} className={className}>{cifras[k]}</b> : trozo
  })
}

/* Una frase con un trozo «[entre corchetes]» que es un enlace subrayado (sin `to`, el trozo va como texto). */
function FraseConEnlace({ texto, to, testId }) {
  const m = /^(.*)\[(.+)\](.*)$/s.exec(texto)
  if (!m) return texto
  return (
    <>
      {m[1]}
      {to
        ? <Link to={to} data-testid={testId} className="font-semibold text-dark-50 underline underline-offset-4 hover:text-dark-200">{m[2]}</Link>
        : m[2]}
      {m[3]}
    </>
  )
}

/* «Repaso de hoy · 31 de 48 repasadas · 2 golpes nuevos» (tanda 6): con `revisiones`, `repasadas` y `golpes` de
   /repaso/pendientes, la línea dice lo que hay y no solo lo que falta. Sin golpes, no habla de golpes; los golpes, en
   el color de aviso. Sin revisiones aún, lo de siempre («aún no ha llegado ninguna revisión»); con un servidor de
   antes (sin esos campos), «N por repasar» como hasta ahora. */
function LineaRepaso({ pendientes, revisiones, repasadas, golpes, llegadas, t }) {
  const hay = pendientes > 0
  const conCuentas = typeof revisiones === 'number' && typeof repasadas === 'number' && revisiones > 0
  const nGolpes = conCuentas && typeof golpes === 'number' && golpes > 0 ? golpes : 0
  const claveDe = revisiones === 1 ? 'inicio.repaso.de.1' : 'inicio.repaso.de'
  const claveGolpes = nGolpes === 1 ? 'inicio.repaso.golpes.1' : 'inicio.repaso.golpes'
  const estado = conCuentas
    ? [t(claveDe).replace('{r}', repasadas).replace('{n}', revisiones),
      nGolpes ? t(claveGolpes).replace('{n}', nGolpes) : null].filter(Boolean).join(' · ')
    : hay ? t('inicio.repaso.pend').replace('{n}', pendientes)
      : llegadas > 0 ? t('inicio.repaso.hecho') : t('inicio.repaso.nada')
  return (
    <section data-testid="inicio-repaso" aria-labelledby="inicio-repaso-tit"
      className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-dark-700 py-5">
      {/* En el móvil (menos de 640 px), cada trozo en su línea y sin «·»: pegados y sin espacios, el título se partía
          («Repaso de / hoy») y «2 golpes nuevos» se salía de la pantalla. Desde 640 px, en línea, con espacios de
          verdad a los lados de cada «·» para que la línea pueda partirse entre trozos. */}
      <p className="min-w-0 text-[16px] leading-relaxed text-dark-300">
        <b id="inicio-repaso-tit" className="block whitespace-nowrap text-[18px] font-extrabold tracking-[-0.02em] text-dark-50 sm:inline">{t('repaso.titulo.hoy')}</b>
        {' '}<span aria-hidden="true" className="mx-1 hidden text-dark-600 sm:inline">·</span>{' '}
        {conCuentas ? (
          <>
            <span data-testid="inicio-repaso-cuenta" className="block whitespace-nowrap sm:inline"><ConCifras texto={t(claveDe)} cifras={{ r: repasadas, n: revisiones }} /></span>
            {nGolpes > 0 && (
              <>
                {' '}<span aria-hidden="true" className="mx-1 hidden text-dark-600 sm:inline">·</span>{' '}
                <span data-testid="inicio-repaso-golpes" className="block whitespace-nowrap text-ruta-aviso-texto sm:inline">
                  <ConCifras texto={t(claveGolpes)} cifras={{ n: nGolpes }} className="font-mono font-semibold tabular-nums" />
                </span>
              </>
            )}
          </>
        ) : hay
          ? <span className="block sm:inline"><b className="font-mono font-semibold tabular-nums text-dark-50">{pendientes}</b>{t('inicio.repaso.pend').replace('{n}', '')}</span>
          : <span className="block sm:inline">{estado}</span>}
      </p>
      <Link to="/panel/repaso" aria-label={`${t(hay ? 'inicio.repaso.boton' : 'inicio.repaso.abrir')}. ${estado}`}
        className={`${hay ? 'btn-primary' : 'btn-secondary'} inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-7 text-[15px] font-bold sm:w-auto`}>
        {t(hay ? 'inicio.repaso.boton' : 'inicio.repaso.abrir')} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}

/* ── Main ── */
/* Una empresa que reparte ve su reparto; las demás, la portada de flota. Va
   en una función aparte para no romper el orden de los hooks de la portada. */
export default function Dashboard() {
  const { billing } = usePlan()
  if (esReparto(billing?.sector)) return <InicioReparto sector={billing.sector} />
  return <DashboardFlota />
}

function DashboardFlota() {
  // `ve(ruta)`: la MISMA regla que el menú (PanelLayout). Un atajo de una pantalla que no puede abrir sería
  // una puerta que se cierra al tocarla.
  const { center, centers, setCenter, admin, ve } = useOutletContext?.() || {}
  const puede = (to) => (typeof ve === 'function' ? ve(to) : true)
  const { billing, modulos } = usePlan()
  // «Todos» con más de un centro: es cuando hace falta decir de qué centro es cada cosa y llevar a él (11-11-2026).
  const todos = center === 'Todos' && (centers?.length || 0) > 1
  const [merc, setMerc] = useState(null)
  useEffect(() => {
    mercEstado().then(({ data }) => setMerc(data?.visible ? data : null)).catch(() => setMerc(null))
  }, [])
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  const [data,   setData]   = useState(null)
  const [itv,    setItv]    = useState([])
  const [costs,  setCosts]  = useState(null)
  const [err,    setErr]    = useState('')

  /* EL ARRANQUE (I5): null = aún no se sabe; true = a medias (el Inicio es SOLO el arranque); false = ya va sola. Lo
     dice EntradaArranque con lo que contesta /alta/estado; quien ya lo acabó en este navegador ni pregunta. Si la
     respuesta no llega en 4 s, el Inicio sale como siempre (un servidor lento no deja la pantalla en blanco). */
  const [arranque, setArranque] = useState(() => (arranqueYaHecho() ? false : null))
  useEffect(() => {
    if (arranque !== null) return undefined
    const id = setTimeout(() => setArranque((a) => (a === null ? false : a)), 4000)
    return () => clearTimeout(id)
  }, [arranque])

  // € de daños nuevos (mes actual vs anterior) — carga independiente, no bloquea
  useEffect(() => {
    setCosts(null)
    getDamageCosts(center).then(r => setCosts(r.data)).catch(() => {})
  }, [center])

  /* EL DÍA DE LA FLOTA, en vivo: cuadrante, revisiones, checklist, golpes e
     incidencias de hoy (/stats/hoy) más la cola de revisión. Se refresca cada
     minuto: es lo único de la portada que cambia mientras la miras. */
  const [hoy, setHoy] = useState(null)
  const [cola, setCola] = useState(0)
  // El estado de la flota (17-10-2026): cuántas furgonetas necesitan taller y la salud media. Sustituye a los
  // «daños abiertos» del libro, que contaban golpes sueltos; esto cuenta furgonetas, y por qué.
  const [ef, setEf] = useState(null)
  const navTop = useNavigate()
  useEffect(() => {
    let stop = false
    setHoy(null)
    const load = () => Promise.all([
      getStatsHoy(center).catch(() => ({ data: null })),
      getReviewQueue(center).catch(() => ({ data: [] })),
    ]).then(([h, q]) => {
      if (stop) return
      setHoy(h.data || null)
      setCola(lista(q.data).length || (q.data?.items || []).length || 0)
    })
    load()
    const iv = setInterval(load, 60000)
    return () => { stop = true; clearInterval(iv) }
  }, [center])

  // Cómo va cada centro: solo con «Todos». Si falla (un servidor de antes), el bloque sale solo con las salidas.
  /* Se vuelve a pedir cada minuto, al mismo ritmo que /stats/hoy (11-11-2026, revisión): pedido una sola vez, si María
     guardaba la plantilla de OGA5 a las 7:20, el Inicio de Dani seguía diciendo «sin guardar hoy» hasta recargar (y
     de un día para otro, igual). Si una vez falla, se queda lo último bueno: un fallo suelto no borra lo que se sabía. */
  const [centrosHoy, setCentrosHoy] = useState(null)
  useEffect(() => {
    if (!todos) { setCentrosHoy(null); return undefined }
    let stop = false
    const cargar = () => getCentrosHoy().then((r) => { if (!stop && r.data) setCentrosHoy(r.data) }).catch(() => {})
    cargar()
    const iv = setInterval(cargar, 60000)
    return () => { stop = true; clearInterval(iv) }
  }, [todos])

  useEffect(() => {
    setData(null)
    setErr('')
    Promise.all([
      getDashboardStats(center),
      /* Ya NO se pide /vehicles/last-inspections. Ese endpoint devuelve un MAPA
         {vehicle_id: fecha} para el semáforo de la lista de vehículos, no una
         lista de inspecciones: el dashboard lo interpretaba como lista y el
         resultado era SIEMPRE vacío, así que el panel "Actividad reciente"
         nunca pudo enseñar nada — con 41 inspecciones ese mismo día. Se ha
         quitado el panel y con él la petición, que además se hacía en cada
         carga para nada. */
      getItvAlerts(center).catch(() => ({ data: [] })),
      getEstadoFlota(center).catch(() => ({ data: null })),
    ]).then(([stats, alerts, estado]) => {
      const ra   = alerts.data
      setEf(estado?.data || null)
      const itvList    = Array.isArray(ra)  ? ra  : (ra?.items  || ra?.alerts       || [])

      /* Los contadores vienen ya acotados al centro desde /stats/dashboard
         (02-09-2026). Antes el backend ignoraba el centro y esto los
         recalculaba en el navegador a partir de /vehicles… filtrando por
         `status === 'workshop'`, un valor que no existe (el real es 'taller'):
         con OGA5 seleccionado salía "En taller 0 · 100 % de disponibilidad"
         teniendo 9 furgonetas en el taller. Un filtro por un valor que no
         existe no da error, da cero (gotcha 33). Y de paso se ahorran dos
         peticiones por carga, una de ellas el listado entero de furgonetas. */
      setData(stats.data)
      // /alerts/itv tambien viene acotado al centro desde el servidor.
      setItv(itvList)
    }).catch(() => setErr(t('dash.error')))
  }, [center])

  /* EL REPASO DE HOY (I4): el mismo número que el menú (`/repaso/pendientes`), solo cuando ya se sabe que la empresa
     tiene el módulo y esta persona la pantalla (antes de llegar /org/billing el menú dice que sí a todo: aquí no se
     pregunta hasta saberlo) y solo con flota (sin furgonetas no hay nada que repasar). Nunca el día entero. */
  const conModuloRepaso = !!billing && (!Array.isArray(modulos) || modulos.includes('repaso')) && puede('/panel/repaso')
  const hayFlota = (data?.total_vehicles || 0) > 0
  const [repaso, setRepaso] = useState(null)
  useEffect(() => {
    setRepaso(null)
    if (!conModuloRepaso || !hayFlota) return undefined
    let stop = false
    const cargar = () => getRepasoPendientes(center).then((r) => {
      const n = r.data?.pendientes
      // `revisiones`, `repasadas` y `golpes` solo con un servidor del 14-11-2026 en adelante (si no, undefined).
      const num = (x) => (typeof x === 'number' && x >= 0 ? x : undefined)
      if (!stop && typeof n === 'number') {
        setRepaso({ pendientes: n, avisar: r.data?.avisar !== false,
          revisiones: num(r.data?.revisiones), repasadas: num(r.data?.repasadas), golpes: num(r.data?.golpes) })
      }
    }).catch(() => {})
    cargar()
    const iv = setInterval(cargar, 60000)
    return () => { stop = true; clearInterval(iv) }
  }, [center, conModuloRepaso, hayFlota])

  const firstName = (admin?.name || '').trim().split(/\s+/)[0] || ''
  /* La cabecera: la fecha y la sede en la letra de la casa, en gris (sin mono ni mayúsculas espaciadas), como en el
     Repaso (I1); el saludo; y, cuando ya hay día, la frase que dice cómo va. Va SIEMPRE en el primer hueco y la entrada
     del arranque en el segundo: así EntradaArranque no se vuelve a montar al pasar de «cargando» a «listo». */
  const cabecera = (frase) => (
    <header className={frase ? 'pb-8 pt-3' : 'pb-7 pt-3'}>
      <p className="text-[14px] text-dark-400 first-letter:uppercase" data-testid="inicio-fecha">
        {fmtDate(locale)}{center && center !== 'Todos' ? ` · ${center}` : ''}
      </p>
      <h1 className="mt-1.5 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-dark-50">
        {greeting(t)}{firstName ? `, ${firstName}` : ''}.
      </h1>
      {frase && <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-dark-400">{frase}</p>}
    </header>
  )
  const entrada = <EntradaArranque onEnCurso={setArranque} />

  // Arranque a medias: SOLO el arranque (I5). Ni atajos a cero, ni «Todavía no hay flota».
  if (arranque === true) {
    return (
      <div className="mx-auto max-w-5xl">
        {cabecera(null)}
        {entrada}
      </div>
    )
  }
  if (err) return <p className="text-red-400 p-4">{err}</p>
  if (!data || arranque === null) {
    return (
      <div className="mx-auto max-w-5xl">
        {null}
        {entrada}
        <PageSkeleton kpis={4} rows={6} />
      </div>
    )
  }

  const fleet = data.total_vehicles || 0
  const inShop = data.vehicles_in_workshop || 0
  const active = fleet - inShop
  const breakdown = data.severity_breakdown || {}
  const todayKey = hoyLocal()
  const todayInsp = data.weekly_activity?.[todayKey]?.inspecciones || 0
  /* La ITV en tres cajones, porque no son lo mismo: vencida (no puede salir),
     próxima (pedir cita) y SIN FECHA (no se sabe). Antes las 79 iban juntas
     como "vencidas o inminentes" y 57 eran simplemente desconocidas: el
     aviso exageraba, y un aviso que exagera deja de leerse (gotcha 41). */
  const itvVencidas = itv.filter((a) => a.status === 'caducada')
  /* `urgente` (7 días o menos) TAMBIÉN es próxima. Contando solo `proxima`,
     las ITV que caducaban esa misma semana —las que más urgen— no salían en
     el dashboard (16-09-2026). El backend reparte en caducada / urgente /
     proxima / sin_fecha. */
  const itvProximas = itv.filter((a) => a.status === 'proxima' || a.status === 'urgente')
  const itvSinFecha = itv.filter((a) => a.status === 'sin_fecha')

  /* LAS SALIDAS DEL CUADRANTE, solo para quien puede abrir Asignación (I1 de diseno3, g): una empresa sin ese módulo
     no tiene cuadrante, y el Inicio no le habla de «salidas del cuadrante» ni le lleva a una puerta cerrada. */
  const veSalidas = puede('/panel/asignacion')

  /* ── LO QUE PIDE UNA DECISIÓN, ORDENADO POR LO QUE CUESTA NO HACERLO ──────
     Antes esto era una lista plana donde "31 incidencias abiertas" —un backlog
     de semanas— pesaba lo mismo que "5 ITV vencidas", que es no poder circular
     legalmente. Y encima se repetía entera abajo como "tu trabajo de hoy", con
     los mismos números.

     Ahora cada línea lleva por qué importa, y van en este orden:
       1. ITV vencida  → la furgoneta no puede salir. Es lo único que para la
          operación de mañana.
       2. Salidas sin revisar → sin fotos de salida, un golpe que aparezca a
          la vuelta no se puede atribuir a nadie. Se arregla HOY o no se arregla.
       3. Inspecciones por validar → daños sin peritar es dinero sin reclamar.
       4. Incidencias / taller → importan, pero aguantan a mañana. */
  const sinRevisar = hoy && veSalidas ? hoy.salidas.total - hoy.salidas.revisadas : 0
  const decisiones = [
    { n: itvVencidas.length, tono: 'red' },
    { n: sinRevisar, tono: 'amber' },
    { n: itvProximas.length, tono: 'amber' },
    { n: itvSinFecha.length, tono: 'dark' },
    { n: cola, tono: 'amber' },
    { n: data.open_incidents || 0, tono: 'dark' },
    { n: inShop, tono: 'dark' },
  ].filter((u) => u.n > 0)
  // Sólo cuenta como "urgente" lo que no aguanta a mañana. Meter el backlog en
  // ese número lo volvía enorme siempre y, por tanto, inútil.
  const urgentTotal = decisiones.filter((d) => d.tono !== 'dark')
    .reduce((a, u) => a + u.n, 0)

  /* Cuánta flota lleva ya su revisión de hoy. Sin vehículos (empresa recién
     creada) no hay porcentaje: un «0 %» diría que se ha dejado trabajo sin hacer. */
  const pctRev = hoy?.revision?.flota
    ? Math.round((hoy.revision.hechas / hoy.revision.flota) * 100) : null
  /* LA CIFRA GRANDE, SOBRE LAS SALIDAS (11-11-2026, portal_inicio-4). Con furgonetas de reserva que no salen, el
     porcentaje de toda la flota no llegaba nunca al 100 % aunque todo lo que salió estuviera revisado, y parecía que
     faltaba trabajo. Con salidas en el cuadrante, la cifra grande y la frase son «salidas revisadas X de Y»; lo de
     toda la flota va debajo, en pequeño. Sin cuadrante hoy, como antes. */
  const conSalidas = veSalidas && (hoy?.salidas?.total || 0) > 0
  const pctGrande = conSalidas ? Math.round((hoy.salidas.revisadas / hoy.salidas.total) * 100) : pctRev

  /* A QUÉ CENTRO LLEVAR, con «Todos» (11-11-2026, portal_inicio-1). Asignación y el checklist son de un centro: si
     solo hay UN centro con algo pendiente (o con salidas, o con ese turno), se elige ese y se entra; si hay varios,
     se entra sin elegir y la pantalla ofrece los centros ahí mismo. El centro de /stats/hoy se casa con las pastillas
     de arriba (puede venir escrito largo): uno que no case haría volver a «Todos» y el toque no serviría. */
  const porCentro = hoy?.por_centro || []
  const unico = (pred) => {
    if (!todos) return null
    const cs = [...new Set(porCentro.filter(pred).map((x) => casarCentro(x.centro, centers)).filter(Boolean))]
    return cs.length === 1 ? cs[0] : null
  }
  const centroAsignacion = unico((x) => x.salidas > x.revisadas) || unico((x) => x.salidas > 0)
  const centroChecklist = (tk) => unico((x) => (x.checklist || []).some((c) => c.turno === tk && c.hechas < c.total))
    || unico((x) => (x.checklist || []).some((c) => c.turno === tk))
  const irAlCentro = (c, to) => {
    if (c && setCenter) setCenter(c)
    if (to) navTop(to)
  }

  /* Los 7 últimos días de inspecciones, del backend (`weekly_activity`). El día
     de hoy va el último y es el único marcado: es sobre el que aún se actúa. */
  const semana = (() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = isoLocal(d)          // en UTC el dia se corria (gotcha 11)
      out.push({
        key,
        label: i === 0 ? t('chart.today') : d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3),
        n: data.weekly_activity?.[key]?.inspecciones || 0,
      })
    }
    return out
  })()

  /* ── LOS ATAJOS (17-10-2026; en lista desde el 14-11-2026, I2) ─────────────────────────────────────────────────
     Los mismos que eran casillas, en el mismo orden, con los mismos enlaces y cifras. `aviso` es lo que no puede
     esperar (rojo) o conviene mirar hoy (`avisoTono: 'ambar'`). */
  const semanaTotal = semana.reduce((a, d) => a + d.n, 0)
  const salidasHoy = veSalidas ? hoy?.salidas?.total || 0 : 0
  // El turno que toca a esta hora (10-11-2026): por la tarde enseñaba siempre el de mañana. Las 15:00 son
  // el cierre del de mañana por defecto (turno_manana en _HORARIOS_DEF, server.py). Si solo hay uno, ese.
  const turnos = hoy?.checklist || []
  const turno = turnos.find((c) => c.turno === (new Date().getHours() >= 15 ? 'tarde' : 'manana')) || turnos[0]
  const abiertas = data.open_incidents || 0
  const urgentes = ef?.niveles?.urgente || 0
  const aTaller = urgentes + (ef?.niveles?.taller || 0)
  const ordenesAbiertas = (ef?.en_taller || []).filter((x) => x.orden).length
  const mercAviso = merc ? (merc.por_revisar || merc.sin_leer || 0) : 0
  /* Cada atajo lleva SIEMPRE su línea de dato (tanda 6): uno sin ella quedaba centrado a otra altura que su vecino de
     fila y la lista se veía desigual. Sin dato todavía, lo dice en gris. */
  const sinDatos = t('inicio.atajo.sinDatos')
  const casillas = [
    { to: '/panel/vehiculos', titulo: t('nav.vehicles'), detalle: fleet ? `${active} ${t('ops.of')} ${fleet} · ${t('ops.active.veh')}` : sinDatos },
    // La que peor está, la siguiente…: el número son las que no pueden esperar.
    { to: '/panel/estado-flota', titulo: t('nav.estadoFlota'), aviso: urgentes,
      detalle: ef?.salud_media != null ? `${t('ef.salud.media')} ${ef.salud_media}/100${aTaller ? ` · ${aTaller} ${t('ef.a.taller')}` : ''}` : sinDatos },
    { to: '/panel/revision', titulo: t('nav.revision'), aviso: cola, avisoTono: 'ambar',
      detalle: `${cola} ${t(cola === 1 ? 'ops.validate.1' : 'ops.validate')}` },
    { to: '/panel/asignacion', centro: centroAsignacion, titulo: t('nav.assign'), aviso: sinRevisar, avisoTono: 'ambar',
      detalle: sinRevisar > 0 ? `${sinRevisar} ${t(sinRevisar === 1 ? 'ops.sinrevisar.1' : 'ops.sinrevisar')}`
        : hoy?.salidas ? `${salidasHoy} ${t('hoy.salidas')}` : sinDatos },
    { to: '/panel/inspecciones', titulo: t('nav.inspections'), detalle: `${semanaTotal} · ${t('ops.week').toLowerCase()}` },
    { to: '/panel/vencimientos', titulo: t('nav.grp.expiry'), aviso: itvVencidas.length,
      detalle: itvVencidas.length ? `${itvVencidas.length} ${t(itvVencidas.length === 1 ? 'ops.itv.expired.1' : 'ops.itv.expired')}`
        : itvProximas.length ? `${itvProximas.length} ${t('ops.itv.soon')}` : t('ops.itv.nada') },
    // «1 abiertas» en la foto del 10-11-2026: singular y plural.
    { to: '/panel/ordenes', titulo: t('nav.ordenes'),
      detalle: ef ? `${ordenesAbiertas} ${t(ordenesAbiertas === 1 ? 'ops.ordenes.abierta' : 'ops.ordenes.abiertas')}` : sinDatos },
    { to: '/panel/incidencias', titulo: t('nav.incidents'), detalle: `${abiertas} ${t(abiertas === 1 ? 'ops.incidents.1' : 'ops.incidents')}` },
    { to: '/panel/talleres', titulo: t('nav.workshops'), detalle: `${inShop} ${t(inShop === 1 ? 'ops.workshop.1' : 'ops.workshop')}` },
    { to: '/panel/conductores', titulo: t('nav.drivers'), detalle: data.total_drivers != null ? String(data.total_drivers) : sinDatos },
    ...(turno ? [{ to: '/panel/checklist-operativo', centro: centroChecklist(turno.turno), titulo: t('nav.checklist'), detalle: `${turno.hechas}/${turno.total}` }] : []),
    // El mercadillo de repartidores, también para la oficina (solo si está abierto; lo decide el servidor).
    ...(merc ? [{ to: merc.por_revisar ? '/panel/admin?s=mercadillo' : '/mercadillo', siempre: true, titulo: 'Mercadillo',
      aviso: mercAviso, avisoTono: 'ambar',
      detalle: merc.por_revisar ? `${merc.por_revisar} por revisar` : merc.sin_leer ? `${merc.sin_leer} sin leer` : 'Vende lo que no uses' }] : []),
  ].filter((c) => c.siempre || puede(c.to.split('?')[0]))
  const irA = (to, centro) => (to.startsWith('/panel') ? irAlCentro(centro, to) : window.location.assign(to))

  const availPct = fleet > 0 ? Math.round((active / fleet) * 100) : null
  /* Sin ninguna furgoneta (el arranque acabado y la flota borrada, o una empresa de antes del arranque), la frase lleva
     a añadirlas: a donde las añade el arranque (importar o pegar la lista); sin esa pantalla, a Vehículos. */
  const destinoAlta = puede('/panel/importaciones') ? '/panel/importaciones?t=furgonetas'
    : puede('/panel/vehiculos') ? '/panel/vehiculos' : null

  /* «2 golpes nuevos» LLEVA a algún sitio (I3): al Repaso del día si la empresa lo usa; si no, a Revisión rápida si
     la tiene; si no tiene ninguna de las dos, es una cifra sin más. */
  const usaRepaso = !!repaso?.avisar
  const destinoGolpes = usaRepaso ? '/panel/repaso' : puede('/panel/revision') ? '/panel/revision' : null
  const checklistHoy = puede('/panel/checklist-operativo') ? (hoy?.checklist || []) : []

  return (
    <div className="mx-auto max-w-5xl">
      {/* La frase de arriba contesta "¿cómo va el día?" en una línea: cuánta flota lleva su revisión de salida y
          cuántas salen sin ella. */}
      {cabecera(
        <>
          {conSalidas ? (
            <><b className="font-semibold text-dark-50">{hoy.salidas.revisadas} {t('ops.of')} {hoy.salidas.total}</b>{' '}
              {t('hoy.brief.salidas')}
              {sinRevisar > 0 && (
                <> · <b className="font-semibold text-ruta-aviso-texto">{sinRevisar}</b> {t(sinRevisar === 1 ? 'hoy.sinrevisar.1' : 'hoy.sinrevisar')}</>
              )}.
            </>
          ) : pctRev != null && fleet > 0 ? (
            <><b className="font-semibold text-dark-50">{hoy.revision.hechas} {t('ops.of')} {hoy.revision.flota}</b>{' '}
              {t('hoy.brief.rev')}
              {sinRevisar > 0 && (
                <> · <b className="font-semibold text-ruta-aviso-texto">{sinRevisar}</b> {t(sinRevisar === 1 ? 'hoy.sinrevisar.1' : 'hoy.sinrevisar')}</>
              )}.
            </>
          ) : fleet === 0
            /* Sin una sola furgoneta, «la flota está en orden» es mentira: no
               hay flota. Una empresa recien registrada lo leia el primer dia. */
            ? <FraseConEnlace texto={t('ops.brief.empty')} to={destinoAlta} testId="inicio-anadir-furgonetas" />
            : urgentTotal > 0
            ? (<><b className="font-semibold text-dark-50">{urgentTotal}</b> {t('ops.brief.items')}.</>)
            : t('ops.brief.calm')}
          {availPct != null && (
            <> <b className="font-semibold text-dark-50">{availPct}%</b> {t('ops.avail')}.</>
          )}
        </>,
      )}
      {entrada}

      {/* La acción del día: el Repaso (solo la empresa que trabaja con él). */}
      {usaRepaso && (
        <div>
          <LineaRepaso pendientes={repaso.pendientes} revisiones={repaso.revisiones} repasadas={repaso.repasadas}
            golpes={repaso.golpes} llegadas={hoy?.revision?.hechas || 0} t={t} />
        </div>
      )}

      {/* Cada sede, por separado (solo las empresas con varias naves y algo pendiente en alguna). */}
      <Activacion />

      {/* Los atajos: una lista con reglas, dos columnas en el ordenador y una en el móvil. */}
      <nav aria-label={t('inicio.atajos')}>
        <ul className="grid sm:grid-cols-2 sm:gap-x-10" data-testid="inicio-atajos">
          {casillas.map((c) => <Atajo key={c.to} {...c} onClick={() => irA(c.to, c.centro)} />)}
        </ul>
      </nav>

      {todos && (
        <ComoVaCadaCentro centers={centers} datos={centrosHoy?.centros} porCentro={porCentro}
          hoyIso={centrosHoy?.dia || hoy?.dia || todayKey} puede={puede} ir={irAlCentro} t={t} />
      )}

      {fleet === 0 ? null : (
      <div>
      {/* ── 1 · EL DÍA DE HOY ───────────────────────────────────────────────
          Lo único que se mueve mientras miras la pantalla: cuánta flota tiene su revisión, quién sale, y lo que ha
          pasado hoy (golpes nuevos, incidencias, checklist de turno). Rótulo normal, barra en tinta, cifras en mono. */}
      {hoy && (hoy.revision.flota > 0 || conSalidas) && (
        <section className="border-t border-dark-700 py-7" aria-labelledby="inicio-hoy-tit" data-testid="inicio-hoy">
          <h2 id="inicio-hoy-tit" className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">{t('hoy.titulo')}</h2>

          <div className="mt-4 grid gap-x-12 gap-y-6 md:grid-cols-2">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[46px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-dark-50" data-testid="hoy-cifra">
                  {pctGrande}
                </span>
                <span className="font-mono text-[18px] text-dark-400">%</span>
              </div>
              {conSalidas ? (
                <>
                  <p className="mt-2 text-[13.5px] text-dark-300" data-testid="hoy-salidas-revisadas">
                    {t('hoy.salidas.rev.sub').replace('{n}', hoy.salidas.revisadas).replace('{t}', hoy.salidas.total)}
                  </p>
                  {hoy.revision.flota > 0 && (
                    <p className="mt-0.5 text-[12.5px] text-dark-500">
                      {t('hoy.revisados.sub').replace('{n}', hoy.revision.hechas).replace('{t}', hoy.revision.flota)}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-[13.5px] text-dark-300">
                  {t('hoy.revisados.sub').replace('{n}', hoy.revision.hechas).replace('{t}', hoy.revision.flota)}
                </p>
              )}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-dark-800" aria-hidden="true">
                <div className="h-full bg-dark-50" style={{ width: `${pctGrande || 0}%` }} />
              </div>
            </div>

            <div className="border-t border-dark-800">
              {conSalidas && <Cifra n={hoy.salidas.total} label={t('hoy.salidas')} />}
              {conSalidas && <Cifra n={sinRevisar} label={t('hoy.sinrevisar')} tono="aviso" />}
              <Cifra n={hoy.golpes.n} label={t('hoy.golpes')} tono="fallo" testId="hoy-golpes"
                onClick={destinoGolpes ? () => navTop(destinoGolpes) : undefined} />
              <Cifra n={hoy.incidencias.nuevas} label={t('hoy.incid')} tono={hoy.incidencias.graves > 0 ? 'fallo' : undefined} />
            </div>
          </div>

          {/* El checklist de cada turno, solo si ese turno existe hoy y esta persona puede abrirlo. */}
          {checklistHoy.length > 0 && (
            <ul className="mt-6 grid border-t border-dark-800 sm:grid-cols-2 sm:gap-x-12">
              {checklistHoy.map((c) => (
                <li key={c.turno} className="border-b border-dark-800">
                  <button type="button" onClick={() => irAlCentro(centroChecklist(c.turno), '/panel/checklist-operativo')}
                    className="group flex min-h-[52px] w-full items-center gap-4 py-2 text-left">
                    <span className="min-w-0 flex-1 text-[13.5px] text-dark-200 group-hover:underline group-hover:underline-offset-4">{t(c.turno === 'manana' ? 'hoy.turno.manana' : 'hoy.turno.tarde')}</span>
                    <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-dark-800" aria-hidden="true">
                      <span className="block h-full bg-dark-50" style={{ width: `${c.total ? Math.round((c.hechas / c.total) * 100) : 0}%` }} />
                    </span>
                    <b className="w-12 shrink-0 text-right font-mono text-[14px] font-semibold tabular-nums text-dark-50">{c.hechas}/{c.total}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── 1-bis · LAS SALIDAS DE HOY ───────────────────────────────────────
          Cada vehículo del cuadrante, con lo que hay que mirar primero: las
          que salen sin revisión y las que vuelven con el peor daño. */}
      {veSalidas && hoy?.salidas?.lista?.length > 0 && (
        <section className="border-t border-dark-700 py-7" aria-labelledby="inicio-salidas-tit">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="inicio-salidas-tit" className="text-[17px] font-bold tracking-[-0.01em] text-dark-50">
              {t('hoy.muro')}
              <span className="ml-2 font-mono text-[14px] font-normal tabular-nums text-dark-500">{hoy.salidas.total}</span>
            </h2>
            <button type="button" onClick={() => irAlCentro(centroAsignacion, '/panel/asignacion')}
              className="min-h-[44px] text-[13px] font-semibold text-dark-300 underline-offset-4 hover:underline">
              {t('dash.see.all')} →
            </button>
          </div>
          <ul className="grid border-t border-dark-800 sm:grid-cols-2 sm:gap-x-10">
            {hoy.salidas.lista.slice(0, 12).map((x) => {
              const suCentro = todos ? casarCentro(x.center, centers) : null
              return (
                <SalidaFila key={x.vehicle_id} s={x} t={t} centro={suCentro}
                  onIr={() => irAlCentro(suCentro, '/panel/asignacion')} />
              )
            })}
          </ul>
          {hoy.salidas.total > 12 && (
            <p className="mt-3 text-[12.5px] text-dark-500">
              {t('hoy.muro.mas').replace('{n}', hoy.salidas.total - 12)}
            </p>
          )}
        </section>
      )}

      {/* Lo de más detalle (gráficos, resumen y vencimientos), plegado: el inicio son los atajos y lo de hoy. */}
      <details className="group border-t border-dark-700 py-5">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-dark-100">
          <ChevronDown size={16} className="text-dark-500 transition-transform group-open:rotate-180" /> {t('ops.fleet.graphs')}
        </summary>
      {/* ── 2-bis · LA FLOTA, EN IMÁGENES ────────────────────────────────────
          Tres piezas y las tres con datos REALES. En el mockup de referencia
          había tarjetas con "↑5%" y curvas de tendencia: eso aquí no se puede
          calcular para casi ningún dato (no hay serie histórica de daños por
          semana), y una flecha verde inventada en una pantalla que se enseña a
          un cliente es lo peor que podríamos poner. Va lo que hay. Sin cajas: tres columnas con su regla. */}
      <section className="py-5">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">

          {/* Disponibilidad: cuántas furgonetas pueden salir mañana. */}
          <div className="border-t border-dark-800 pt-4">
            <p className="mb-4 text-[13.5px] font-semibold text-dark-200">{t('ops.availability')}</p>
            <div className="flex items-center gap-5">
              <Anillo size={116}
                centro={`${availPct ?? 0}%`} sub={t('ops.ready')}
                segmentos={[
                  { k: 'ok', n: active, color: 'rgb(var(--r-ok-texto))' },
                  { k: 'shop', n: inShop, color: 'rgb(var(--r-aviso-texto))' },
                ]} />
              <div className="min-w-0 flex-1 space-y-2 text-[13px]">
                <p className="flex items-center gap-2 text-dark-300">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-ruta-ok-texto" />
                  {t('ops.ready')} <b className="ml-auto font-mono font-semibold tabular-nums text-dark-50">{active}</b>
                </p>
                <p className="flex items-center gap-2 text-dark-300">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-ruta-aviso-texto" />
                  {t('dash.workshop')} <b className="ml-auto font-mono font-semibold tabular-nums text-dark-50">{inShop}</b>
                </p>
                <p className="flex items-center gap-2 text-dark-400">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-dark-600" />
                  {t('nav.drivers')} <b className="ml-auto font-mono font-semibold tabular-nums text-dark-200">{data.total_drivers}</b>
                </p>
              </div>
            </div>
          </div>

          {/* Severidad de los daños. Se dice CLARAMENTE que es el acumulado de
              todas las inspecciones, no de esta semana: es lo que hay, y
              etiquetarlo como semanal sería mentir. */}
          <div className="border-t border-dark-800 pt-4">
            <p className="mb-4 text-[13.5px] font-semibold text-dark-200">{t('ops.damage.split')}</p>
            <div className="flex items-center gap-5">
              <Anillo size={116}
                centro={data.total_inspections?.toLocaleString(locale) ?? '—'}
                sub={t(data.total_inspections === 1 ? 'ops.inspections.1' : 'ops.inspections')}
                segmentos={SEV_ORDER.map((k) => ({ k, n: breakdown?.[k] || 0, color: SEV_KEYS[k].color }))} />
              <div className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
                {SEV_ORDER.map((k) => (
                  <p key={k} className="flex items-center gap-2 text-dark-300">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEV_KEYS[k].color }} />
                    {t(SEV_KEYS[k].key)}
                    <b className="ml-auto font-mono font-semibold tabular-nums text-dark-100">{breakdown?.[k] || 0}</b>
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Actividad real de los últimos 7 días. */}
          <div className="border-t border-dark-800 pt-4">
            <p className="text-[13.5px] font-semibold text-dark-200">{t('ops.week')}</p>
            <p className="mb-4 mt-0.5 text-[13px] text-dark-400">
              <b className="font-mono font-semibold tabular-nums text-dark-50">{semanaTotal}</b> {t(semanaTotal === 1 ? 'ops.inspections.1' : 'ops.inspections')}
            </p>
            <Barras dias={semana} />
          </div>
        </div>
      </section>

      {/* ── 3 · LA FLOTA, EN UNA LÍNEA ───────────────────────────────────── */}
      <section className="border-t border-dark-800 py-6">
        <h2 className="text-[15px] font-bold text-dark-50">{t('ops.control')}</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-dark-400">
          <b className="font-mono font-semibold tabular-nums text-dark-50">{active}</b> {t('ops.active.veh')}
          <span className="mx-2 text-dark-600">·</span>
          <b className="font-mono font-semibold tabular-nums text-dark-50">{data.total_drivers}</b> {t('nav.drivers').toLowerCase()}
          <span className="mx-2 text-dark-600">·</span>
          <b className="font-mono font-semibold tabular-nums text-dark-50">{todayInsp}</b> {t(todayInsp === 1 ? 'ops.insp.today.1' : 'ops.insp.today')}
          {costs && costs.month_eur > 0 && (
            <><span className="mx-2 text-dark-600">·</span>
            <b className={`font-mono font-semibold tabular-nums ${costs.prev_month_eur && costs.month_eur < costs.prev_month_eur ? 'text-ruta-ok-texto' : 'text-ruta-aviso-texto'}`}>{Math.round(costs.month_eur).toLocaleString('es-ES')} €</b> {t('ops.damage.month')}</>
          )}
        </p>
        {costs && (costs.month_real_eur > 0 || costs.en_taller > 0 || costs.sin_gestionar > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            {costs.month_real_eur > 0 && (
              <span className="text-dark-400">
                <b className="font-mono font-semibold tabular-nums text-ruta-ok-texto">{Math.round(costs.month_real_eur).toLocaleString('es-ES')} €</b> {t('eur.real')}
              </span>
            )}
            {costs.sin_gestionar > 0 && (
              <span className="text-ruta-aviso-texto">{t('eur.unmanaged').replace('{n}', costs.sin_gestionar)}</span>
            )}
          </div>
        )}
      </section>

      {/* ── Próximos vencimientos (ancho completo) ── */}
      {itv.length > 0 && (
        <section className="border-t border-dark-800 py-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold text-dark-50">{t('ops.upcoming')}</h2>
            <button type="button" onClick={() => navTop('/panel/vencimientos')} className="min-h-[44px] text-[13px] font-semibold text-dark-300 underline-offset-4 hover:underline">
              {t('dash.see.all')} →
            </button>
          </div>
          <ItvAlerts items={itv} />
        </section>
      )}
      </details>
      </div>
      )}
    </div>
  )
}
