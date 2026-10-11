import { useEffect, useState } from 'react'
import { TEXTOS } from './textosRuta'
import { BR } from './textosBrasil'

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
// Cambia palabras de un diccionario respetando la mayúscula inicial; las frases largas, antes.
const cambiador = (mapa) => {
  const re = new RegExp(String.raw`\b(${Object.keys(mapa).sort((a, b) => b.length - a.length).join('|')})\b`, 'gi')
  return (s) => s.replace(re, (m) => {
    const r = mapa[m.toLowerCase()]
    return m[0] !== m[0].toLowerCase() ? r[0].toUpperCase() + r.slice(1) : r
  })
}
export const aBrasil = cambiador(PALABRAS_BR)

/* ESPAÑOL DE LATINOAMÉRICA (11-10-2026). La app está escrita en español de España; quien está allí (hora
   de un país latino o el móvil en es-MX, es-AR…) lee «celular», «camioneta», «toma una foto». Mismo
   cuidado que con Brasil: solo cambios que no rompen el género ni la frase. */
const LATAM = (() => {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (/^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana|Bogota|Lima|Santiago|Punta_Arenas|Caracas|Guayaquil|La_Paz|Asuncion|Montevideo|Argentina\/.+|Buenos_Aires|Cordoba|Costa_Rica|Panama|Guatemala|Tegucigalpa|El_Salvador|Managua|Santo_Domingo|Puerto_Rico|Havana)$/.test(z)) return true
    const l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase()
    return /^es-/.test(l) && l !== 'es-es'
  } catch { return false }
})()
export const aLatam = cambiador({
  'haz una foto': 'toma una foto', 'hazle una foto': 'tómale una foto', 'haces una foto': 'tomas una foto',
  'hacer una foto': 'tomar una foto', 'hacerle una foto': 'tomarle una foto',
  'móvil': 'celular', 'móviles': 'celulares', furgoneta: 'camioneta', furgonetas: 'camionetas',
  'el ordenador': 'la computadora', 'un ordenador': 'una computadora', 'del ordenador': 'de la computadora',
  'tu ordenador': 'tu computadora', 'al ordenador': 'a la computadora',
  aparcar: 'estacionar', aparca: 'estaciona', 'gasóleo': 'diésel', coche: 'auto', coches: 'autos',
})
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
  // Brasil: el texto escrito para allí (textosBrasil.js) y, si no lo hay, el de Portugal con la capa de palabras.
  if (actual === 'pt' && BRASIL) s = BR[texto] || (s !== texto ? aBrasil(s) : s)
  else if (actual === 'es' && LATAM) s = aLatam(s)
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
