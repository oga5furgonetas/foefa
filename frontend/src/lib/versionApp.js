/* ¿ESTOY CORRIENDO LA ÚLTIMA VERSIÓN DE LA APP?
 * ═══════════════════════════════════════════════════════════════════════════
 * El 16-09-2026 Dani dijo «Eddy no me aparece para enviarle la formación».
 * Eddy estaba bien en los datos; su pestaña llevaba horas abierta con una
 * compilación anterior. La app no fallaba: simplemente enseñaba lo de antes.
 *
 * Eso es peor que un error. Un error se ve; esto no, y lleva a desconfiar de
 * los datos cuando el problema es la pestaña.
 *
 * `build.json` lo escribe el despliegue con el nombre del bundle recién subido
 * (ver `scripts/sellar-build.mjs`). Aquí se compara con el que está corriendo.
 * Si no coinciden, hay versión nueva.
 */

/** El bundle que tiene cargado ESTA pestaña, sacado del propio `<script>`. */
function bundleActual() {
  try {
    const s = [...document.querySelectorAll('script[type="module"][src]')]
      .map((x) => x.getAttribute('src'))
      .find((x) => /\/index-[^/]+\.js$/.test(x || ''))
    return s ? s.split('/').pop() : ''
  } catch { return '' }
}

/**
 * Llama a `alHaberNueva()` cuando se publica una compilación distinta.
 * Mira cada `cadaMs` y también al volver a la pestaña — que es cuando de
 * verdad importa: alguien vuelve del café y sigue con lo de hace dos horas.
 */
export function vigilarVersion(alHaberNueva, cadaMs = 5 * 60 * 1000) {
  const mio = bundleActual()
  if (!mio) return () => {}          // sin saber el mío no se puede comparar
  const estado = { parado: false }

  const mirar = async () => {
    if (estado.parado || document.hidden) return
    try {
      /* CON UN NUMERO DETRAS, SIEMPRE. `cache: 'no-store'` solo habla con la
         cache del NAVEGADOR, no con la del borde de Cloudflare, y ahi este
         fichero se quedaba dias: el 21-09-2026 flotadsp.com/build.json seguia
         diciendo «index-Bhs56xBs.js» cuando el servido era «index-CTFAZs37.js»,
         asi que TODA pestaña creia que habia version nueva —para siempre— y el
         aviso de recargar no se iba ni recargando. Con una query distinta cada
         vez el borde no tiene esa URL guardada y va al origen. */
      const r = await fetch(`/build.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) return
      // Sin `build.json` en el despliegue, el comodin de `_redirects` devuelve
      // el index.html con 200: no es JSON y `json()` lanza, o sea «no se sabe».
      const ct = r.headers.get('content-type') || ''
      if (!/json/i.test(ct)) return
      const j = await r.json()
      // Un nombre que no parece un bundle no es un dato: no se compara.
      if (!j || typeof j.bundle !== 'string' || !/^index-[\w-]+\.js$/.test(j.bundle)) return
      // Falso positivo: `parado` solo pasa de false a true, nunca vuelve atras.
      // eslint-disable-next-line require-atomic-updates
      if (j.bundle !== mio) { estado.parado = true; alHaberNueva(j) }
    } catch { /* sin red: se vuelve a mirar en la siguiente vuelta */ }
  }

  const t = setInterval(mirar, cadaMs)
  const alVolver = () => { if (!document.hidden) mirar() }
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('focus', alVolver)
  // La primera, a los diez segundos: al arrancar acaba de bajar el bundle.
  const t0 = setTimeout(mirar, 10000)
  return () => {
    estado.parado = true
    clearInterval(t); clearTimeout(t0)
    document.removeEventListener('visibilitychange', alVolver)
    window.removeEventListener('focus', alVolver)
  }
}


/* SE ACTUALIZA SOLA CUANDO NADIE ESTA MIRANDO.
 *
 * El aviso de arriba funciona, pero hay que verlo: el 19-09-2026 Mery dijo que
 * «no le sale el chat interno» y el chat estaba desplegado y con su permiso
 * puesto — lo que tenia era la pestaña de por la mañana, con el JavaScript de
 * antes. Es el mismo caso que Eddy el 16-09 y el mismo que el gotcha 56: un
 * despliegue no cierra el navegador de nadie.
 *
 * Asi que cuando hay version nueva y la pestaña lleva un rato EN SEGUNDO PLANO
 * se recarga sola. En segundo plano no hay nadie escribiendo, ningun formulario
 * a medias y ningun guardado con el dedo encima: recargar ahi no puede quitarle
 * el trabajo a nadie, y al volver del cafe se encuentra la version buena sin
 * tener que hacer nada.
 *
 * Con la pestaña delante NO se toca nada: ahi manda el aviso, porque recargarle
 * la pagina a alguien que esta escribiendo es peor que enseñarle algo viejo.
 */
export function recargarCuandoNadieMira(esperaMs = 60000) {
  let reloj = null
  const cancelar = () => { if (reloj) { clearTimeout(reloj); reloj = null } }
  /* UNA VEZ CADA DIEZ MINUTOS COMO MUCHO. Si por lo que sea el aviso de version
     nueva fuera un falso positivo, recargar no lo arregla —vuelve a salir— y
     una pestaña en segundo plano se quedaria recargandose sin parar. Recargar
     una vez y comprobar es prudente; encadenarlas es un bucle. */
  const recargadaHace = () => {
    try { return Date.now() - Number(sessionStorage.getItem('recarga_auto_en') || 0) } catch { return Infinity }
  }
  const recargar = () => {
    if (!document.hidden || recargadaHace() < 10 * 60 * 1000) return
    try { sessionStorage.setItem('recarga_auto_en', String(Date.now())) } catch { /* incognito */ }
    window.location.reload()
  }
  const mirar = () => {
    cancelar()
    if (document.hidden) reloj = setTimeout(recargar, esperaMs)
  }
  document.addEventListener('visibilitychange', mirar)
  mirar()
  return () => { cancelar(); document.removeEventListener('visibilitychange', mirar) }
}
