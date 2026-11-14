import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, useIdioma } from '../lib/idioma'
import { ANCHO, BTN_PRIMARIO, BTN_SECUNDARIO, CabeceraSimple, Pie, useTemaWeb } from './portadaComun'

/* «QUÉ LE ENSEÑAS AL PERITO» (/peritaje-tecnico, rehecha el 14-11-2026 con la portada nueva). A donde lleva el pie de
   las páginas públicas. Antes era «Cómo funciona la IA de daños»: desde esta tanda la IA no se vende ni se promete (de
   cada 100 golpes que marca, unos 25 son reales, backend/fiabilidad.py), así que la página cuenta lo que queda guardado
   y quién decide. Cada frase tiene detrás lo que hace el servidor al acabar la tanda «Antes del perito»:
   - la revisión: una por conductor, furgoneta y día (server.py, crear inspección, 409); la fecha de cada foto es la de
     llegada al servidor (lib/sello.js), nunca «hecha a las…»;
   - el repaso del día (GET /api/repaso/dia y POST /api/inspections/{id}/repaso): una persona marca cada golpe;
   - el expediente (GET /api/vehicles/{id}/antes-del-perito): solo golpes confirmados por una persona, y «quién la
     llevaba» solo con `atribuible: true` (un único conductor entre las dos fotos, un día o menos y la foto anterior de
     ese lado marcada «igual»); si no, sin conductor atribuible y el motivo;
   - la firma (POST /inspections/{id}/sign, solo con el plan Pro, `forensics`): quién, cuándo, la IP y un código; el PDF
     (GET /inspections/{id}/forensic-pdf) y la comprobación pública (GET /verify/{hash}), que dice si el código está
     registrado y enseña fecha, firmante y matrícula en parte oculta. NO vuelve a calcular el código, así que aquí no se
     dice que «cualquier cambio se nota».
   NUNCA «quién dio el golpe», «admisible en juicio», «certificado» ni «inmutable». */

const ALTA = '/registro?sector=otra&plan=completo'   // la misma alta que la portada (Empresas.jsx, ALTA_EMPRESA)

const GUARDADO = [
  ['Cada revisión, con sus fotos', 'El conductor fotografía la furgoneta desde el móvil: frontal, trasera y los dos laterales. Cada foto queda con la fecha y la hora en que llegó al servidor, y con quién la hizo. Cada conductor hace una revisión por furgoneta y día.'],
  ['Cada golpe, marcado por una persona', 'En el repaso del día, alguien de tu oficina ve la foto de hoy junto a la anterior del mismo lado y marca lo nuevo sobre la foto. El expediente solo lleva los golpes que ha marcado o confirmado una persona.'],
  ['Quién la llevaba, solo cuando es seguro', 'Si entre las dos fotos la llevó una sola persona, en un día o menos, y la foto anterior de ese lado se repasó y estaba igual, el golpe dice quién la llevaba. Si no, queda sin conductor atribuible y se dice por qué.'],
  ['El expediente de cada furgoneta', 'Cómo entró, cómo está, cada golpe con su foto y la anterior del mismo lado, y un calendario con los días revisados y los que no. Listo para imprimir.'],
]

const NO_ES = [
  ['No dice quién dio el golpe.', 'Dice quién la llevaba, y solo cuando es seguro.'],
  ['No es una firma electrónica avanzada ni asesoría jurídica.', 'Es el registro de cada revisión: el valor que tenga ante un renting, un cliente o un juzgado lo decide quien lo recibe.'],
  ['No da nada por golpe sin una persona.', 'Un golpe entra en el expediente cuando alguien de tu oficina lo marca o lo confirma.'],
]

export default function PeritajeTecnico() {
  const lang = useIdioma()
  const [tema, setTema] = useTemaWeb()
  const titulo = tx('Qué le enseñas al perito · {marca}', { marca: MARCA.nombre })
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    try { document.documentElement.lang = lang } catch { /* nada */ }
    return () => { document.title = antes }
  }, [titulo, lang])
  const enlace = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-[15px] font-medium text-[color:var(--ld-text)] underline-offset-4 hover:underline'
  const h2 = 'ld-titular text-[30px] leading-[1.06] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[40px]'

  return (
    <div className="ld-root min-h-screen overflow-x-clip font-sans text-[17px] leading-normal antialiased" data-theme={tema}>
      <CabeceraSimple>
        <a href="/planes" className={`${enlace} hidden sm:inline-flex`}>{tx('Precios')}</a>
        <a href="/contacto" className={`${enlace} hidden sm:inline-flex`}>{tx('Contacto')}</a>
        <a href="/panel/login" className={enlace}>{tx('Entrar')}</a>
      </CabeceraSimple>

      <header className={`${ANCHO} pb-14 pt-10 sm:pb-20 sm:pt-16`}>
        <p className="text-[15px] font-semibold text-[color:var(--ld-accent)]">{tx('Para empresas con furgonetas')}</p>
        <h1 className="ld-titular mt-4 max-w-[760px] text-[40px] leading-[1] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[56px]">{tx('Qué le enseñas al perito del renting')}</h1>
        <p className="mt-6 max-w-[620px] text-[18px] leading-[1.5] text-[color:var(--ld-text2)] sm:text-[19px]">
          {tx('Cuando devuelves una furgoneta, el perito apunta los daños y te pasa el cargo. Lo que puedes enseñarle es lo que guardaste: la foto de cada lado, con la fecha y la hora en que llegó al servidor, y los golpes que tu oficina marcó el día que aparecieron.')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={ALTA} className={BTN_PRIMARIO}>{tx('Probar con mis furgonetas')}</a>
          <a href="/expediente-ejemplo" className={BTN_SECUNDARIO}>{tx('Ver un expediente de ejemplo')}</a>
        </div>
      </header>

      <section className={ANCHO}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <h2 className={h2}>{tx('Lo que queda guardado')}</h2>
          <ol className="border-b border-[color:var(--ld-border)]">
            {GUARDADO.map(([t, d], i) => (
              <li key={t} className="grid gap-2 border-t border-[color:var(--ld-border)] py-6 sm:grid-cols-[56px_minmax(0,1fr)]">
                <span className="font-mono text-[14px] font-medium text-[color:var(--ld-muted)]">0{i + 1}</span>
                <div>
                  <h3 className="text-[21px] font-bold leading-[1.2] tracking-[-0.015em] text-[color:var(--ld-text)]">{tx(t)}</h3>
                  <p className="mt-2 max-w-[640px] text-[16.5px] leading-relaxed text-[color:var(--ld-text2)]">{tx(d)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={ANCHO}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <h2 className={h2}>{tx('La firma de una revisión')}</h2>
          <div className="max-w-[680px]">
            <p className="text-[17px] leading-relaxed text-[color:var(--ld-text2)]">
              {tx('Con el plan Pro, la oficina puede firmar una revisión desde el panel. Queda quién la firmó, cuándo y desde qué IP, y un código que cualquiera puede comprobar en nuestra web: dice si la firma está registrada y enseña la fecha, quién firmó y la matrícula en parte oculta. La revisión firmada se descarga en PDF con sus fotos.')}
            </p>
          </div>
        </div>
      </section>

      <section className={ANCHO}>
        <div className="grid gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-20 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <h2 className={h2}>{tx('Lo que no es')}</h2>
          <ul className="max-w-[680px] space-y-4" data-testid="perito-no-es">
            {NO_ES.map(([t, d]) => (
              <li key={t} className="flex gap-3 text-[16.5px] leading-relaxed text-[color:var(--ld-text2)]">
                <span aria-hidden="true" className="mt-[11px] inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ld-ambar)]" />
                <span><b className="font-semibold text-[color:var(--ld-text)]">{tx(t)}</b> {tx(d)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={ANCHO}>
        <div className="grid items-center gap-8 border-t border-[color:var(--ld-border)] py-14 sm:py-[72px] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div>
            <h2 className={h2}>{tx('¿Cuánto te cuesta?')}</h2>
            <p className="mt-3 max-w-[560px] text-[16.5px] leading-relaxed text-[color:var(--ld-muted)]">{tx('Haz la cuenta con tus furgonetas y con el último cargo por daños que te pasaron.')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/#precio" className={BTN_PRIMARIO}>{tx('Hacer la cuenta')} <ArrowRight size={17} /></a>
            <a href="/contacto?asunto=Peritaje" className={BTN_SECUNDARIO}>{tx('Escríbenos')}</a>
          </div>
        </div>
      </section>

      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
