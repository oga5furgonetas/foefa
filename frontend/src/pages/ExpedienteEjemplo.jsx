import { useEffect, useRef } from 'react'
import { useT, LANGS } from '../i18n'
import { tx, useIdioma } from '../lib/idioma'
import { MARCA } from '../marca'
import DocumentoExpediente from '../panel/components/expediente/DocumentoExpediente'
import { EXPEDIENTE_EJEMPLO, EMPRESA_EJEMPLO } from '../lib/expedienteEjemplo'
import { CabeceraSimple, Pie, useTemaWeb } from './portadaComun'

/* EL EXPEDIENTE DE EJEMPLO (/expediente-ejemplo, 14-11-2026): el MISMO documento que saca el panel de cada
   furgoneta, con datos inventados (lib/expedienteEjemplo.js, la misma furgoneta que el héroe de la portada), para que
   quien llega desde la portada vea lo que se lleva antes de darse de alta. Va con la cabecera y el pie de las páginas
   públicas (portadaComun.jsx: la vuelta a la portada, los precios, lo legal, el idioma y día o noche) y, arriba, una
   franja que dice que es un ejemplo y la única acción: probarlo con sus furgonetas (la misma alta que /empresas).
   Nada de eso se imprime; la hoja sí, igual que en el panel. */

const ALTA = '/registro?sector=otra&plan=completo'

export default function ExpedienteEjemplo() {
  const lang = useIdioma()   // los textos llegan un instante después en otro idioma: se repinta al tenerlos
  const [tema, setTema] = useTemaWeb()
  /* La hoja es la pieza del panel y habla en el idioma del panel (i18n.jsx); la franja y el pie, en el de las páginas
     públicas (lib/idioma.js). Para que no salga la hoja en un idioma y lo de alrededor en otro, la hoja sigue al de la
     página: al llegar, si en este navegador nadie ha elegido idioma del panel, y siempre que se cambie aquí abajo. */
  const { lang: langHoja, setLang: setLangHoja } = useT()
  const primera = useRef(true)
  useEffect(() => {
    let elegido = null
    try { elegido = localStorage.getItem('flota_lang') } catch { /* modo privado */ }
    const seguir = !primera.current || !elegido
    primera.current = false
    if (seguir && lang !== langHoja && LANGS[lang]) setLangHoja(lang)
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const titulo = `${tx('Ejemplo con datos inventados')} · ${MARCA.nombre}`
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    return () => { document.title = antes }
  }, [titulo])
  const enlace = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-[15px] font-medium text-[color:var(--ld-text)] underline-offset-4 hover:underline'
  return (
    <div className="ld-root exp-publico min-h-screen overflow-x-clip font-sans antialiased" data-theme={tema}>
      <div className="exp-no-imprimir">
        <CabeceraSimple>
          <a href="/planes" className={`${enlace} hidden sm:inline-flex`}>{tx('Precios')}</a>
          <a href="/panel/login" className={enlace}>{tx('Entrar')}</a>
        </CabeceraSimple>
      </div>
      <div className="exp-publico-cuerpo">
        <div className="exp-franja exp-no-imprimir" data-testid="franja-ejemplo">
          <div>
            <b>{tx('Ejemplo con datos inventados')}</b>
            <p>{tx('Así sale el expediente de cada furgoneta: el documento que pones encima de la mesa cuando la devuelves al renting o te pasan un cargo.')}</p>
          </div>
          <a href={ALTA} className="exp-boton exp-boton-firma">{tx('Probar con mis furgonetas')}</a>
        </div>
        <DocumentoExpediente datos={EXPEDIENTE_EJEMPLO} empresa={EMPRESA_EJEMPLO} />
      </div>
      <div className="exp-no-imprimir" data-testid="pie-ejemplo">
        <Pie lang={lang} tema={tema} setTema={setTema} />
      </div>
    </div>
  )
}
