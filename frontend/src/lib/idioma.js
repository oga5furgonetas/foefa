import { useEffect, useState } from 'react'
import { TEXTOS } from './textosRuta'

/* IDIOMA DE LA APP DE REPARTO (04-10-2026)
   La app del repartidor (ruta, navegación, cuenta, alta, regalo, seguimiento)
   en 7 idiomas. La CLAVE es el propio texto en español: así el código se lee
   igual que antes y, si falta una traducción, sale el español (nunca una
   clave rara ni un hueco). Variables con {nombre}: tx('Quedan {n} paradas',
   { n: 3 }). El idioma: el que elija en «Cuenta», si no el del móvil, y si el
   móvil está en un idioma que no tenemos, inglés. */

export const IDIOMAS = {
  es: 'Español', en: 'English', pt: 'Português', fr: 'Français', it: 'Italiano', de: 'Deutsch', zh: '中文',
}
// Para la voz de la navegación y las fechas.
export const LOCALES = { es: 'es-ES', en: 'en-GB', pt: 'pt-PT', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', zh: 'zh-CN' }

const CLAVE = 'fds_idioma'

/* PORTUGUÉS DE BRASIL (11-10-2026). Los textos están en portugués de Portugal; en Brasil se cambian las
   palabras que allí suenan de fuera (senha, paradas, celular, cadastro…) y la voz y las fechas van en
   pt-BR. Solo sustantivos y verbos que no cambian el género ni la frase. */
const BRASIL = (() => {
  try {
    const l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase()
    if (l === 'pt-br') return true
    return /^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Maceio|Araguaina|Santarem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Noronha)$/
      .test(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch { return false }
})()
const PALABRAS_BR = {
  'palavra-passe': 'senha', 'palavras-passe': 'senhas', paragem: 'parada', paragens: 'paradas',
  'telemóvel': 'celular', 'telemóveis': 'celulares', registo: 'cadastro', registos: 'cadastros',
  registar: 'cadastrar', registe: 'cadastre', registado: 'cadastrado', registada: 'cadastrada',
  equipa: 'equipe', equipas: 'equipes', utilizador: 'usuário', utilizadores: 'usuários',
  partilhar: 'compartilhar', partilhe: 'compartilhe', partilhado: 'compartilhado', descarregar: 'baixar',
  descarregue: 'baixe', ficheiro: 'arquivo', ficheiros: 'arquivos', contacto: 'contato', contactos: 'contatos',
  estafeta: 'entregador', estafetas: 'entregadores',
}
const RE_BR = new RegExp(String.raw`\b(${Object.keys(PALABRAS_BR).join('|')})\b`, 'gi')
export function aBrasil(s) {
  return s.replace(RE_BR, (m) => {
    const r = PALABRAS_BR[m.toLowerCase()]
    return m[0] !== m[0].toLowerCase() ? r[0].toUpperCase() + r.slice(1) : r
  })
}
const oyentes = new Set()

export function idiomaDelMovil() {
  try {
    const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'es'
    const base = l.toLowerCase().split('-')[0]
    return IDIOMAS[base] ? base : 'en'
  } catch { return 'es' }
}

let actual = (() => {
  try { const g = localStorage.getItem(CLAVE); if (g && IDIOMAS[g]) return g } catch { /* nada */ }
  return typeof navigator === 'undefined' ? 'es' : idiomaDelMovil()
})()

export const idioma = () => actual
export const locale = () => (actual === 'pt' && BRASIL ? 'pt-BR' : LOCALES[actual] || 'es-ES')

export function cambiarIdioma(l) {
  if (!IDIOMAS[l]) return
  actual = l
  try { localStorage.setItem(CLAVE, l) } catch { /* nada */ }
  try { document.documentElement.lang = l } catch { /* nada */ }
  oyentes.forEach((f) => f(l))
}

export function tx(texto, vars) {
  let s = (actual !== 'es' && TEXTOS[texto] && TEXTOS[texto][actual]) || texto
  if (actual === 'pt' && BRASIL && s !== texto) s = aBrasil(s)
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
  return s
}

/* El mensaje de un error del servidor, traducido si lo conocemos, o el de por
   defecto. Vale para axios (e.response.data) y para fetch (el JSON, e.detail).
   Con fetch no pasa por el normalizador de services/api.js y un 422 trae
   `detail` como LISTA: pintarla rompería la pantalla, así que solo se usa si
   es texto. */
export function txError(e, porDefecto, vars) {
  const d = e?.response?.data?.detail ?? e?.detail
  return typeof d === 'string' && d.trim() ? tx(d) : tx(porDefecto, vars)
}

/* Para que una pantalla se repinte al cambiar de idioma. */
export function useIdioma() {
  const [l, setL] = useState(actual)
  useEffect(() => { oyentes.add(setL); return () => oyentes.delete(setL) }, [])
  return l
}
