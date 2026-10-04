import { useState } from 'react'
import { dominio } from '../marca'

/* ── EL PRODUCTO, NO UNA PROMESA ──────────────────────────────────────────
   Capturas de la aplicación de verdad, con datos de ejemplo. No están
   dibujadas a mano: las genera Playwright contra la app (`e2e/capturas.spec.js`,
   escenario «lleno» de la API simulada). Si cambia una pantalla se relanza y se
   actualizan solas, en vez de quedarse viejas como las maquetas hechas a mano.

   Si una imagen no existe todavía (un despliegue sin capturas generadas), la
   sección entera se esconde: un marco de navegador vacío es peor que no
   enseñar nada. */

const T = {
  titulo: { zh: '后台界面一览', es: 'Así es por dentro', en: 'This is what it looks like', fr: 'Voici l’intérieur', de: 'So sieht es innen aus', it: 'Ecco com’è dentro', pt: 'É assim por dentro' },
  sub: { zh: '真实应用截图，使用示例数据，每次界面更新都会自动重新生成（后台目前为西班牙语界面）。', es: 'Capturas de la aplicación con datos de ejemplo. Se generan solas desde la propia app cada vez que cambia una pantalla.', en: 'Screenshots of the app with sample data. They are generated from the app itself whenever a screen changes.', fr: 'Captures de l’application avec des données d’exemple, générées automatiquement à chaque changement d’écran.', de: 'Screenshots der App mit Beispieldaten, automatisch erzeugt, sobald sich ein Bildschirm ändert.', it: 'Screenshot dell’app con dati di esempio, generati automaticamente quando cambia una schermata.', pt: 'Capturas da aplicação com dados de exemplo, geradas automaticamente sempre que muda um ecrã.' },
}

const PANTALLAS = [
  { img: '/capturas/dashboard.png',
    t: { zh: '首页', es: 'Portada', en: 'Home', fr: 'Accueil', de: 'Startseite', it: 'Home', pt: 'Início' },
    d: { zh: '今天有多少车辆已检查、谁未检查就出车，以及发生了什么：碰痕、故障和每班的检查清单。', es: 'Cuánta flota tiene hoy su revisión, quién sale sin ella y lo que ha pasado: golpes, incidencias y el checklist de cada turno.', en: 'How much of the fleet is inspected today, who is going out without it and what happened: dents, incidents and each shift’s checklist.', fr: 'Quelle part de la flotte est inspectée aujourd’hui, qui sort sans inspection et ce qui s’est passé : chocs, incidents et checklist de chaque équipe.', de: 'Wie viel der Flotte heute geprüft ist, wer ungeprüft losfährt und was passiert ist: Schäden, Vorfälle und die Checkliste jeder Schicht.', it: 'Quanta flotta è ispezionata oggi, chi esce senza ispezione e cosa è successo: colpi, incidenti e checklist di ogni turno.', pt: 'Quanta frota está inspecionada hoje, quem sai sem inspeção e o que aconteceu: danos, incidências e a checklist de cada turno.' } },
  { img: '/capturas/flota.png',
    t: { zh: '车队', es: 'Flota', en: 'Fleet', fr: 'Flotte', de: 'Flotte', it: 'Flotta', pt: 'Frota' },
    d: { zh: '每辆车的年检、保养、未处理的损伤，以及今天由谁驾驶。', es: 'Cada vehículo con su ITV, su mantenimiento, sus daños abiertos y quién lo lleva hoy.', en: 'Every vehicle with its MOT, servicing, open damage and who is driving it today.', fr: 'Chaque véhicule avec son contrôle technique, son entretien, ses dommages ouverts et qui le conduit aujourd’hui.', de: 'Jedes Fahrzeug mit HU, Wartung, offenen Schäden und wer es heute fährt.', it: 'Ogni veicolo con revisione, manutenzione, danni aperti e chi lo guida oggi.', pt: 'Cada veículo com a inspeção, a manutenção, os danos abertos e quem o leva hoje.' } },
  { img: '/capturas/revision-ia.png',
    t: { zh: 'AI 复核', es: 'Revisión IA', en: 'AI review', fr: 'Revue IA', de: 'KI-Prüfung', it: 'Revisione IA', pt: 'Revisão IA' },
    d: { zh: 'AI 在照片中发现的问题逐一列出：一键确认或忽略。', es: 'Lo que la IA ha visto en las fotos, uno detrás de otro: validar o descartar con una tecla.', en: 'What the AI saw in the photos, one after another: approve or dismiss with a key.', fr: 'Ce que l’IA a vu sur les photos, l’un après l’autre : valider ou écarter d’une touche.', de: 'Was die KI auf den Fotos gesehen hat, eins nach dem anderen: mit einer Taste bestätigen oder verwerfen.', it: 'Ciò che l’IA ha visto nelle foto, uno dopo l’altro: convalida o scarta con un tasto.', pt: 'O que a IA viu nas fotos, um a seguir ao outro: validar ou descartar com uma tecla.' } },
  { img: '/capturas/taller.png',
    t: { zh: '维修', es: 'Taller', en: 'Workshop', fr: 'Garage', de: 'Werkstatt', it: 'Officina', pt: 'Oficina' },
    d: { zh: '每辆车的维修单、报价以及当前进度。', es: 'Las órdenes de reparación de cada vehículo, con su presupuesto y en qué punto está cada una.', en: 'Each vehicle’s repair orders, with their quote and where each one stands.', fr: 'Les ordres de réparation de chaque véhicule, avec leur devis et leur état.', de: 'Die Reparaturaufträge jedes Fahrzeugs, mit Angebot und Stand.', it: 'Gli ordini di riparazione di ogni veicolo, con preventivo e stato.', pt: 'As ordens de reparação de cada veículo, com o orçamento e o estado de cada uma.' } },
  { img: '/capturas/vencimientos.png',
    t: { zh: '到期提醒', es: 'Vencimientos', en: 'Renewals', fr: 'Échéances', de: 'Fristen', it: 'Scadenze', pt: 'Vencimentos' },
    d: { zh: '全部车辆的年检、保险和租赁，按到期先后排序。', es: 'ITV, seguro y renting de toda la flota, ordenados por lo que caduca antes.', en: 'MOT, insurance and leasing for the whole fleet, sorted by what expires first.', fr: 'Contrôle technique, assurance et location de toute la flotte, triés par échéance.', de: 'HU, Versicherung und Leasing der ganzen Flotte, sortiert nach Ablauf.', it: 'Revisione, assicurazione e noleggio di tutta la flotta, ordinati per scadenza.', pt: 'Inspeção, seguro e renting de toda a frota, ordenados pelo que caduca primeiro.' } },
]

export default function ProductoReal({ lang = 'es' }) {
  const [i, setI] = useState(0)
  const [rota, setRota] = useState(false)
  const txt = (o) => o[lang] || o.es
  const p = PANTALLAS[i]
  if (rota) return null

  return (
    <section className="border-y border-[color:var(--ld-border)] bg-[color:var(--ld-surface)]">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:py-24">
        <header className="max-w-2xl">
          <h2 className="font-display text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-[color:var(--ld-text)] [text-wrap:balance]">
            {txt(T.titulo)}
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[color:var(--ld-muted)]">{txt(T.sub)}</p>
        </header>

        <div role="tablist" aria-label={txt(T.titulo)} className="mt-8 flex flex-wrap gap-2">
          {PANTALLAS.map((s, n) => (
            <button key={s.img} type="button" role="tab" aria-selected={n === i} onClick={() => setI(n)}
              className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${
                n === i
                  ? 'bg-[color:var(--ld-text)] text-[color:var(--ld-bg)]'
                  : 'border border-[color:var(--ld-border-strong)] text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`}>
              {txt(s.t)}
            </button>
          ))}
        </div>

        {/* Marco de navegador: la captura se lee como una app abierta ahora
            mismo y no como una imagen suelta. */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--ld-border-strong)] bg-[#0a0c10] shadow-[0_30px_80px_-30px_rgba(0,0,0,.55)]">
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#11151b] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="ml-3 truncate font-mono text-[11.5px] text-white/45">{dominio()}/panel</span>
          </div>
          <img key={p.img} src={p.img} alt={txt(p.t)} width={1440} height={900} loading="lazy"
            onError={() => setRota(true)} className="block h-auto w-full" />
        </div>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[color:var(--ld-muted)]">{txt(p.d)}</p>
      </div>
    </section>
  )
}
