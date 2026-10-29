import { createContext, useContext, useState, useCallback } from 'react'

export const LANGS = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português' }

/* LOS DICCIONARIOS, BAJO DEMANDA (17-10-2026). Viven en i18nDict.js: se piden la primera vez que una pantalla
   llama a useT() y esa pantalla espera (Suspense, el cargador de las rutas) hasta tenerlos. La portada del
   anuncio y la app del repartidor no los usan y ya no los descargan. Si la descarga falla, se sigue con las
   claves en vez de quedarse esperando para siempre. */
let DICT = null
let pidiendo = null
function cargarDict() {
  if (!pidiendo) {
    pidiendo = import('./i18nDict')
      .then((m) => { DICT = m.DICT })
      .catch(() => { DICT = {} })
  }
  return pidiendo
}

// Locale BCP-47 por idioma (para toLocaleDateString / toLocaleTimeString)
export const LANG_LOCALE = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' }

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
  const t = useCallback((key) => {
    const e = DICT && DICT[key]
    if (!e) return key
    return e[lang] || e.en || key
  }, [lang])
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}

export const useT = () => {
  const ctx = useContext(LangCtx)
  if (!DICT) throw cargarDict()                  // la pantalla espera a los diccionarios (Suspense)
  return ctx
}
