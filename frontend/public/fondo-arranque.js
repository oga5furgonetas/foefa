/* EL FONDO DE ARRANQUE DE LAS PÁGINAS PÚBLICAS CLARAS (14-11-2026)
   ---------------------------------------------------------------------------
   index.html es el mismo para todo: el panel, la app de reparto y las páginas
   públicas. Su fondo, hasta que pinta React, es el oscuro del panel (body en
   index.css). Desde que la portada y las páginas públicas son de papel claro,
   cada carga de una de ellas daba un fogonazo oscuro y luego claro.

   Este script, clásico y externo (la CSP no admite scripts en línea), va en el
   <head> y antes de que se pinte nada marca <html> con `arranque-papel` (o
   `arranque-noche` si la persona eligió la noche en el pie, la misma clave que
   portadaComun.jsx) SOLO en esas páginas, y pone el color de la barra del
   navegador a juego. El panel, la app de reparto y todo lo demás no se marcan y
   arrancan en oscuro, como siempre. Dentro de la app de iPhone no hace nada:
   allí «/» lleva a la app de reparto. Los colores, en index.css. */
(function () {
  'use strict'
  try {
    if (window.Capacitor || /^(capacitor|ionic|file):$/.test(location.protocol)) return
    var ruta = location.pathname.replace(/\/+$/, '') || '/'
    var CLARAS = /^\/(?:empresas|planes|peritaje-tecnico|expediente-ejemplo|devolucion-renting(?:\/[^/]+)?|contacto|privacidad|terminos|encargo|cookies|aviso-legal|security|seguridad)?$/
    /* /registro es también el alta oscura de quien reparte solo: esa llega siempre con `sector=autonomo` (la app, el
       login y los anuncios); sin él, o con el de una empresa, la página es de papel (Registro.jsx decide igual). */
    var altaEmpresa = ruta === '/registro' && !/(?:^|[?&])sector=autonomo(?:&|$)/.test(location.search)
    /* LA PUERTA DEL CONDUCTOR (14-11-2026): /c (su enlace) y /conductor sin sesión (su entrada con el correo) son de
       papel, y de noche solo si la eligió: la MISMA regla que `nocheElegida()` y `esPuertaConductor()` de
       src/lib/tema.js (manda el tema elegido del panel o de la app, «auto» con el móvil en oscuro; si no hay ninguno
       elegido, el del pie de la web). Con sesión, /conductor es su portal y arranca como siempre. */
    var puerta = false
    try {
      puerta = /^\/c(?:\/|$)/.test(ruta) || (/^\/conductor(?:\/|$)/.test(ruta) && !localStorage.getItem('flota_driver'))
    } catch (e) { puerta = /^\/c(?:\/|$)|^\/conductor(?:\/|$)/.test(ruta) }
    if (!CLARAS.test(ruta) && !altaEmpresa && !puerta) return
    var noche = false
    try {
      if (puerta) {
        var elegido = localStorage.getItem('panel_theme_elegido')
        var tema = elegido ? (localStorage.getItem('panel_theme') || 'hibrido') : 'hibrido'
        var oscuroMovil = false
        try { oscuroMovil = window.matchMedia('(prefers-color-scheme: dark)').matches } catch (e) { /* sin matchMedia */ }
        if (tema === 'dark' || (tema === 'auto' && oscuroMovil)) noche = true
        else if (!elegido) noche = localStorage.getItem('fds_tema_web') === 'dark'
      } else {
        noche = localStorage.getItem('fds_tema_web') === 'dark'
      }
    } catch (e) { /* modo privado */ }
    document.documentElement.classList.add(noche ? 'arranque-noche' : 'arranque-papel')
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', noche ? '#0b1012' : '#f5f6f3')
  } catch (e) { /* nunca impide que arranque la página */ }
})()
