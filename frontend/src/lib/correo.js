/* ¿ERRATA EN EL CORREO? (10-10-2026)
   Quien se da de alta desde el móvil escribe deprisa: «gmial.com», «hotmal.es»,
   «gmail.con». Con el correo mal, no le llega la bienvenida ni puede recuperar la
   contraseña, y la cuenta se pierde. Aquí solo se sugiere: la persona decide. */

const DOMINIOS = [
  'gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'live.com', 'msn.com', 'telefonica.net', 'protonmail.com', 'proton.me', 'gmx.es', 'gmx.com',
  'me.com', 'aol.com', 'mail.com', 'ymail.com', 'hotmail.fr', 'outlook.fr', 'hotmail.it', 'libero.it',
  'gmx.de', 'web.de', 'sapo.pt', 'qq.com', '163.com',
]

/* Letras de diferencia (borrar, añadir, cambiar o dos seguidas cambiadas de sitio,
   como «gmial»). Los dominios son cortos: la tabla entera no cuesta nada. */
function distancia(a, b) {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return 3
  const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[m][n]
}

/* El correo corregido si el dominio parece una errata de uno conocido; si no, ''. */
export function sugerenciaCorreo(email) {
  const e = String(email || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1 || at === e.length - 1) return ''
  const usuario = e.slice(0, at)
  const dominio = e.slice(at + 1)
  if (DOMINIOS.includes(dominio)) return ''
  let mejor = ''
  let d = 3
  for (const c of DOMINIOS) {
    const x = distancia(dominio, c)
    if (x < d) { d = x; mejor = c }
  }
  // Con dominios cortos una letra ya es mucho: «me.com» no debe sugerir «mail.com».
  const limite = dominio.length <= 6 ? 1 : 2
  return mejor && d <= limite ? `${usuario}@${mejor}` : ''
}
