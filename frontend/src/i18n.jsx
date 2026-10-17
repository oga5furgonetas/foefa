import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { activarZh, desactivarZh, zhActivo } from './lib/traductorZh'

export const LANGS = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', zh: '中文' }

/* LOS DICCIONARIOS, BAJO DEMANDA (17-10-2026). Viven en i18nDict.js: se piden la primera vez que una pantalla
   llama a useT() y esa pantalla espera (Suspense, el cargador de las rutas) hasta tenerlos. La portada del
   anuncio y la app del repartidor no los usan y ya no los descargan. Si la descarga falla, se sigue con las
   claves en vez de quedarse esperando para siempre. */
let DICT = null
let ZH = {}
let pidiendo = null
function cargarDict() {
  if (!pidiendo) {
    pidiendo = import('./i18nDict')
      .then((m) => { DICT = m.DICT; ZH = m.ZH })
      .catch(() => { DICT = {}; ZH = {} })
  }
  return pidiendo
}

// Locale BCP-47 por idioma (para toLocaleDateString / toLocaleTimeString)
export const LANG_LOCALE = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', zh: 'zh-CN' }

const LangCtx = createContext({ lang: 'es', setLang: () => {}, t: (k) => k })

function detect() {
  const saved = localStorage.getItem('flota_lang')
  if (saved && LANGS[saved]) return saved
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase()
  return LANGS[nav] ? nav : 'en'
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detect)
  const setLang = useCallback((l) => { localStorage.setItem('flota_lang', l); setLangState(l) }, [])
  // En chino, además, el traductor de las frases escritas tal cual en las
  // pantallas. Al salir del chino se recarga: los textos ya cambiados no
  // tienen vuelta atrás sin re-pintar todo.
  useEffect(() => {
    if (lang === 'zh') { activarZh(); return }
    if (zhActivo()) { desactivarZh(); window.location.reload() }
  }, [lang])
  const t = useCallback((key) => {
    const e = DICT && DICT[key]
    if (!e) return key
    // El chino va en su propio fichero (i18nZh.js) para no tocar 1.400 líneas.
    if (lang === 'zh') return ZH[key] || e.en || key
    return e[lang] || e.en || key
  }, [lang])
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}

export const useT = () => {
  const ctx = useContext(LangCtx)
  if (!DICT) throw cargarDict()                  // la pantalla espera a los diccionarios (Suspense)
  return ctx
}
