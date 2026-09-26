import { useEffect, useState } from 'react'
import {
  Camera, ScanSearch, MousePointerClick, ClipboardCheck, Wrench, CalendarClock,
  CalendarDays, Users, Sparkles, ShieldCheck, KeyRound, Fingerprint, ArrowRight,
  Sun, Moon, Truck, Package, KeySquare, HardHat, Building2, Cable,
} from 'lucide-react'
import { useT, LANGS } from '../i18n'
import { API_BASE } from '../lib/apiBase'
import { saveSession } from '../panel/auth'
import { MARCA } from '../marca'
import { LANDING } from './landingTextos'
import Landing3DShowcase from './Landing3DShowcase'
import ProductoReal from './ProductoReal'

/* ── LA PORTADA PÚBLICA ───────────────────────────────────────────────────
   Una sola pregunta que contestar: «¿esto me sirve para MI flota?». Por eso
   el orden es el de quien decide la compra: qué es (héroe), cómo se usa (tres
   pasos), qué trae (módulos), cómo es por dentro (capturas y 3D), si es para
   él (sectores), cuánto cuesta y si sus datos están seguros.

   La vista del héroe es una reproducción de la portada del panel con datos de
   ejemplo, y lo dice. No hay cifras de clientes ni logos de empresas: el
   producto es nuevo y cualquier número de ese tipo sería inventado. */

function useTexto() {
  const { lang } = useT()
  return (k) => {
    const e = LANDING[k]
    if (!e) return k
    return e[lang] || e.es || k
  }
}

/* El botón principal: cian de la marca con tinta oscura. La tinta es fija
   (no sale de la rampa del tema) para que se lea igual de día y de noche. */
const BTN_PRIMARIO = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-5 py-3 text-[15px] font-semibold text-[#04121a] shadow-[0_10px_30px_-10px_rgba(20,231,216,.55)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'
const BTN_SECUNDARIO = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-5 py-3 text-[15px] font-semibold text-[color:var(--ld-text)] transition hover:border-[color:var(--ld-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60'

function Seccion({ id, eyebrow, titulo, sub, children, className = '' }) {
  return (
    <section id={id} className={`mx-auto max-w-[1120px] px-5 py-14 sm:py-20 ${className}`}>
      {(eyebrow || titulo) && (
        <header className="mb-10 max-w-2xl">
          {eyebrow && (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ld-accent)]">{eyebrow}</p>
          )}
          {titulo && (
            <h2 className="mt-3 font-display text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-[color:var(--ld-text)] [text-wrap:balance]">
              {titulo}
            </h2>
          )}
          {sub && <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{sub}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

/* ── LA VISTA DEL HÉROE ──────────────────────────────────────────────────
   Una reproducción fiel de «El día de hoy» del panel: las mismas cifras, el
   mismo orden y el mismo color para lo que pide atención. Los datos son de
   ejemplo y la tarjeta lo dice en su pie. */
const SALIDAS = [
  { m: '5678 KLM', c: 'Luis P.', r: 'Zona 3', ok: false },
  { m: '1234 BCD', c: 'Ana L.', r: 'Zona 1', ok: true, sev: 'moderado' },
  { m: '9012 FGH', c: 'Marta G.', r: 'Zona 2', ok: true },
  { m: '3456 JKL', c: 'Iván R.', r: 'Zona 4', ok: true },
]

function VistaPanel({ tx }) {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] shadow-[0_40px_90px_-40px_rgba(0,0,0,.6)]">
        {/* Barra de ventana: sitúa la vista como una pantalla, no como un dibujo. */}
        <div className="flex items-center gap-1.5 border-b border-[color:var(--ld-border)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ld-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ld-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ld-border-strong)]" />
          <span className="ml-3 truncate font-mono text-[11px] text-[color:var(--ld-dim)]">{MARCA.nombre.toLowerCase()} · panel</span>
        </div>

        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--ld-dim)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {tx('vista.titulo')}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-[color:var(--ld-text)] tabular-nums">86</span>
                <span className="text-lg font-medium text-[color:var(--ld-dim)]">%</span>
              </div>
              <p className="mt-1 text-[12.5px] text-[color:var(--ld-muted)]">{tx('vista.revisada')}</p>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-3">
              {[['2', 'vista.salen', true], ['3', 'vista.golpes', true], ['1', 'vista.itv', false]].map(([n, k, alerta]) => (
                <div key={k}>
                  <dt className="sr-only">{tx(k)}</dt>
                  <dd className={`font-display text-[22px] font-semibold leading-none tabular-nums ${alerta ? 'text-[color:var(--ld-warn)]' : 'text-[color:var(--ld-text)]'}`}>{n}</dd>
                  <dd className="mt-1 text-[11.5px] text-[color:var(--ld-dim)]">{tx(k)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--ld-fill)]">
            <div className="h-full w-[86%] rounded-full bg-emerald-400/85" />
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-2">
            {SALIDAS.map((s) => (
              <li key={s.m} className={`rounded-xl border p-2.5 ${s.ok ? 'border-[color:var(--ld-border)]' : 'border-[color:var(--ld-warn)]'} bg-[color:var(--ld-surface2)]`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11.5px] font-bold text-[color:var(--ld-text)]">{s.m}</span>
                  <span className="font-mono text-[10px] text-[color:var(--ld-dim)]">{s.r}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[color:var(--ld-muted)]">{s.c}</div>
                <div className={`mt-1.5 text-[10.5px] font-semibold ${!s.ok ? 'text-[color:var(--ld-warn)]' : s.sev ? 'text-[color:var(--ld-mid)]' : 'text-[color:var(--ld-ok)]'}`}>
                  {!s.ok ? tx('vista.pendiente') : s.sev ? 'moderado' : tx('vista.ok')}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="border-t border-[color:var(--ld-border)] px-5 py-2 text-[11px] text-[color:var(--ld-dim)]">{tx('vista.ejemplo')}</p>
      </div>

      {/* El aviso de la IA, por encima de la tarjeta: es lo que pasa cuando un
          conductor sube sus fotos, y lo que diferencia esto de una hoja. */}
      <div className="absolute -bottom-12 right-6 hidden w-[250px] rounded-xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,.55)] sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-400/15">
            <ScanSearch size={15} className="text-[color:var(--ld-accent)]" />
          </span>
          <span className="text-[12.5px] font-semibold text-[color:var(--ld-text)]">{tx('vista.ia')}</span>
        </div>
        <p className="mt-2 text-[12px] text-[color:var(--ld-muted)]">{tx('vista.iaPieza')}</p>
        <p className="mt-1 font-mono text-[11px] text-[color:var(--ld-dim)]">1234 BCD · 08:42</p>
      </div>
    </div>
  )
}

const PASOS = [
  { icono: Camera, t: 'como.1t', d: 'como.1d' },
  { icono: ScanSearch, t: 'como.2t', d: 'como.2d' },
  { icono: MousePointerClick, t: 'como.3t', d: 'como.3d' },
]

const MODULOS = [
  { icono: ClipboardCheck, t: 'mod.1t', d: 'mod.1d' },
  { icono: Wrench, t: 'mod.2t', d: 'mod.2d' },
  { icono: CalendarClock, t: 'mod.3t', d: 'mod.3d' },
  { icono: CalendarDays, t: 'mod.4t', d: 'mod.4d' },
  { icono: Users, t: 'mod.5t', d: 'mod.5d' },
  { icono: Sparkles, t: 'mod.6t', d: 'mod.6d' },
]

const SECTORES = [
  { icono: Package, k: 'quien.1' }, { icono: Truck, k: 'quien.2' }, { icono: KeySquare, k: 'quien.3' },
  { icono: Cable, k: 'quien.4' }, { icono: HardHat, k: 'quien.5' }, { icono: Building2, k: 'quien.6' },
]

const SEGURIDAD = [
  { icono: ShieldCheck, t: 'seg.1t', d: 'seg.1d' },
  { icono: KeyRound, t: 'seg.2t', d: 'seg.2d' },
  { icono: Fingerprint, t: 'seg.3t', d: 'seg.3d' },
]

export default function Landing() {
  const { lang, setLang } = useT()
  const tx = useTexto()
  const [demo, setDemo] = useState('')          // '' | 'cargando' | 'error'
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('ld_theme') || 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    try { localStorage.setItem('ld_theme', tema) } catch { /* modo privado */ }
  }, [tema])

  /* La demo entra con un usuario de solo lectura. Si el servidor no
     contesta se DICE, en vez de dejar el botón girando sin fin. */
  async function abrirDemo() {
    if (demo === 'cargando') return
    setDemo('cargando')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-login`, { method: 'POST' })
      const j = await r.json()
      if (j?.access_token) {
        saveSession(j)
        window.location.href = '/panel'
        return
      }
    } catch { /* se dice abajo */ }
    setDemo('error')
  }

  return (
    <div className="ld-root min-h-screen overflow-x-hidden font-sans antialiased" data-theme={tema}>
      {/* ── Cabecera ── */}
      <nav className="sticky top-0 z-50 border-b border-[color:var(--ld-border)] bg-[color:var(--ld-nav)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5">
          <a href="/" className="flex items-center gap-2.5 text-[color:var(--ld-text)]">
            <img src="/favicon.svg" alt="" width="30" height="30" className="rounded-lg" />
            <span className="font-display text-[18px] font-bold tracking-[-0.02em]">{MARCA.nombre}</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-5">
            <a href="#producto" className="hidden text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] md:inline">{tx('nav.producto')}</a>
            <a href="/planes" className="hidden text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)] sm:inline">{tx('nav.precios')}</a>
            <a href="/panel/login" className="px-2 text-[14px] font-medium text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx('nav.entrar')}</a>
            <a href="/registro" className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-3.5 py-2 text-[13.5px] font-semibold text-[#04121a] hover:brightness-110">{tx('nav.probar')}</a>
          </div>
        </div>
      </nav>

      {/* ── Héroe ── */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-[-10%] h-[520px] w-[720px] rounded-full bg-brand-400/[0.10] blur-[120px]" />
          <div className="absolute -bottom-40 left-[-10%] h-[420px] w-[620px] rounded-full bg-brand-600/[0.10] blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-14 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-3 py-1 text-[12.5px] font-medium text-[color:var(--ld-muted)]">
              <Sparkles size={13} className="text-[color:var(--ld-accent)]" /> {tx('hero.chip')}
            </p>
            <h1 className="mt-5 font-display text-[clamp(38px,5.6vw,64px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-[color:var(--ld-text)] [text-wrap:balance]">
              {tx('hero.t1')}
              <span className="block bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, var(--ld-grad-a), var(--ld-grad-b))' }}>{tx('hero.t2')}</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('hero.sub')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/registro" className={BTN_PRIMARIO}>{tx('hero.cta')} <ArrowRight size={16} /></a>
              <button type="button" onClick={abrirDemo} disabled={demo === 'cargando'} className={BTN_SECUNDARIO}>
                {demo === 'cargando' ? '…' : tx('hero.demo')}
              </button>
            </div>
            <p className="mt-4 text-[13px] text-[color:var(--ld-dim)]">{tx('hero.mini')}</p>
            {demo === 'error' && (
              <p role="status" className="mt-3 max-w-md text-[13px] text-[color:var(--ld-warn)]">{tx('hero.demoErr')}</p>
            )}
          </div>
          <VistaPanel tx={tx} />
        </div>
      </header>

      {/* ── Cómo funciona: tres pasos que SÍ son una secuencia ── */}
      <Seccion id="producto" eyebrow={tx('como.eyebrow')} titulo={tx('como.titulo')}
        className="border-t border-[color:var(--ld-border)]">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {PASOS.map(({ icono: Icono, t, d }, i) => (
            <li key={t} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/[0.12] ring-1 ring-brand-400/25">
                  <Icono size={18} className="text-[color:var(--ld-accent)]" />
                </span>
                <span className="font-mono text-[12px] font-semibold text-[color:var(--ld-dim)]">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] text-[color:var(--ld-text)]">{tx(t)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* ── Qué incluye ── */}
      <Seccion eyebrow={tx('mod.eyebrow')} titulo={tx('mod.titulo')}>
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-[color:var(--ld-border)] bg-[color:var(--ld-border)] sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map(({ icono: Icono, t, d }) => (
            <li key={t} className="bg-[color:var(--ld-bg)] p-6">
              <Icono size={20} className="text-[color:var(--ld-accent)]" />
              <h3 className="mt-4 text-[16.5px] font-semibold text-[color:var(--ld-text)]">{tx(t)}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* ── Capturas reales de la app ── */}
      <ProductoReal lang={lang} />

      {/* ── El gemelo 3D ── */}
      <Seccion eyebrow={tx('twin.eyebrow')} titulo={tx('twin.titulo')} sub={tx('twin.sub')}>
        <Landing3DShowcase inline t={{ hint: tx('twin.hint'), loading: tx('twin.loading'), sinTresD: tx('twin.sin3d'), fotoAlt: tx('twin.foto') }} />
      </Seccion>

      {/* ── Para quién ── */}
      <Seccion titulo={tx('quien.titulo')} className="border-t border-[color:var(--ld-border)]">
        <ul className="flex flex-wrap gap-2.5">
          {SECTORES.map(({ icono: Icono, k }) => (
            <li key={k} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-fill)] px-4 py-2 text-[14px] text-[color:var(--ld-text)]">
              <Icono size={15} className="text-[color:var(--ld-accent)]" /> {tx(k)}
            </li>
          ))}
        </ul>
      </Seccion>

      {/* ── Precio y seguridad ── */}
      <section className="mx-auto max-w-[1120px] px-5 pb-16 sm:pb-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col justify-between rounded-2xl border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-7">
            <div>
              <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] text-[color:var(--ld-text)]">{tx('precio.desde')}</p>
              <p className="mt-2 text-[15px] text-[color:var(--ld-muted)]">{tx('precio.unidad')}</p>
              <p className="mt-5 text-[14.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('precio.sub')}</p>
            </div>
            <a href="/planes" className={`${BTN_SECUNDARIO} mt-6 self-start`}>{tx('precio.cta')} <ArrowRight size={16} /></a>
          </div>
          <div className="rounded-2xl border border-[color:var(--ld-border)] p-7">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-[color:var(--ld-text)]">{tx('seg.titulo')}</h2>
            <ul className="mt-5 grid gap-5 sm:grid-cols-3">
              {SEGURIDAD.map(({ icono: Icono, t, d }) => (
                <li key={t}>
                  <Icono size={18} className="text-[color:var(--ld-accent)]" />
                  <h3 className="mt-2.5 text-[14.5px] font-semibold text-[color:var(--ld-text)]">{tx(t)}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx(d)}</p>
                </li>
              ))}
            </ul>
            <a href="/peritaje-tecnico" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[color:var(--ld-accent)] hover:underline underline-offset-4">
              {tx('seg.ver')} <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ── Cierre ── */}
      <section className="mx-auto max-w-[1120px] px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-brand-400/25 bg-[color:var(--ld-surface)] px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-brand-400/[0.14] blur-[90px]" />
          <h2 className="relative font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[color:var(--ld-text)] [text-wrap:balance]">{tx('fin.titulo')}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('fin.sub')}</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <a href="/registro" className={BTN_PRIMARIO}>{tx('hero.cta')} <ArrowRight size={16} /></a>
            <a href="/planes" className={BTN_SECUNDARIO}>{tx('precio.cta')}</a>
          </div>
          <p className="relative mt-4 text-[13px] text-[color:var(--ld-dim)]">{tx('hero.mini')}</p>
        </div>
      </section>

      {/* ── Pie ── */}
      <footer className="border-t border-[color:var(--ld-border)]">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <a href="/" className="flex items-center gap-2.5 text-[color:var(--ld-text)]">
              <img src="/favicon.svg" alt="" width="26" height="26" className="rounded-md" />
              <span className="font-display text-[16px] font-bold">{MARCA.nombre}</span>
            </a>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[color:var(--ld-dim)]">{MARCA.lema}</p>
            <div className="mt-5 flex items-center gap-2">
              <label htmlFor="ld-idioma" className="sr-only">Idioma</label>
              <select id="ld-idioma" value={lang} onChange={(e) => setLang(e.target.value)}
                className="rounded-lg border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2.5 py-1.5 text-[13px] text-[color:var(--ld-text)]">
                {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" onClick={() => setTema((v) => (v === 'dark' ? 'light' : 'dark'))}
                aria-label={tx('pie.tema')} title={tx('pie.tema')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">
                {tema === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
          <nav aria-label={tx('pie.producto')}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('pie.producto')}</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              {[['/planes', 'nav.precios'], ['/security', 'pie.seguridad'], ['/peritaje-tecnico', 'pie.peritaje'], ['/contacto', 'pie.contacto'], ['/panel/login', 'nav.entrar']].map(([h, k]) => (
                <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx(k)}</a></li>
              ))}
            </ul>
          </nav>
          <nav aria-label={tx('pie.legal')}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ld-dim)]">{tx('pie.legal')}</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              {[['/privacidad', 'pie.privacidad'], ['/terminos', 'pie.terminos'], ['/cookies', 'pie.cookies'], ['/aviso-legal', 'pie.aviso']].map(([h, k]) => (
                <li key={h}><a href={h} className="text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]">{tx(k)}</a></li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="border-t border-[color:var(--ld-border)] px-5 py-5 text-center text-[12.5px] text-[color:var(--ld-dim)]">
          © {new Date().getFullYear()} {MARCA.nombre}
        </p>
      </footer>
    </div>
  )
}
