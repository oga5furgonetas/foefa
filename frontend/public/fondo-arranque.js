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
    if (!CLARAS.test(ruta)) return
    var noche = false
    try { noche = localStorage.getItem('fds_tema_web') === 'dark' } catch (e) { /* modo privado */ }
    document.documentElement.classList.add(noche ? 'arranque-noche' : 'arranque-papel')
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', noche ? '#0b1012' : '#f5f6f3')
  } catch (e) { /* nunca impide que arranque la página */ }
})()
