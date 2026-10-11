/* GUÍA «RUTA CON MÁS DE 10 PARADAS» (11-10-2026). Para quien busca cómo pasar del tope de paradas del
 * navegador del móvil. Los datos del límite, de la ayuda oficial del propio navegador (hasta 10 puntos:
 * la salida y 9 paradas; el orden se cambia arrastrando; la hora de salida solo cuenta con un destino).
 * Versión de Brasil: guia-mais-de-10-paradas.js. Plantilla en functions_lib/guia.js. */
import { respuestaGuia, enPromo } from '../functions_lib/guia.js'

const AYUDA = 'https://support.google.com/maps/answer/144339?hl=es'

const guia = () => ({
  ruta: '/guia-mas-de-10-paradas', lang: 'es', utm: 'guia_10paradas_es',
  alternas: [['pt-BR', '/guia-mais-de-10-paradas']],
  titulo: 'Ruta con más de 10 paradas: cómo hacerla y ordenarla sola',
  descripcion: 'Google Maps admite como mucho 10 puntos por ruta y no las ordena por ti. Cómo planificar un día de reparto con muchas más paradas, gratis o con una app.',
  h1: 'Cómo hacer una ruta con más de 10 paradas',
  entradilla: 'Google Maps deja meter como mucho 10 puntos en una ruta (la salida y 9 paradas), las visita en el orden en que las escribes y, con varias paradas, no calcula la ruta según la hora a la que sales. Para un día de reparto con decenas de paquetes se queda corto. Estas son las salidas que hay.',
  secciones: [
    ['1. Lo que permite Google Maps', `Según su <a href="${AYUDA}" rel="nofollow">propia ayuda</a>: hasta 10 puntos por ruta contando la salida, el orden lo cambias tú arrastrando cada parada y la previsión por hora de salida solo funciona con un único destino. Sirve para un recado con tres sitios; para repartir, no.`],
    ['2. Gratis: partir la ruta en tramos de 9', 'Agrupa los paquetes por zonas y monta una ruta por zona, de 9 en 9. Al acabar un tramo, abres el siguiente. Funciona, pero el orden de cada tramo lo decides tú, y si un cliente no está o te cambian algo, toca rehacerlo a mano.'],
    ['3. Ordenar a mano sin perder tiempo', 'Empieza por la zona más lejana o por la más cercana, pero no saltes de una a otra. Dentro de cada zona, recorre las calles en un solo sentido, sin volver atrás. Las entregas con horario, primero, y el resto alrededor. Tienes el paso a paso en la <a href="/guia-ruta-de-reparto">guía para ordenar la ruta de reparto</a>.'],
    ['4. Con una app que ordena las paradas', 'Metes todas las direcciones del día de una vez (escaneando el código, con una foto a la etiqueta o pegando la lista) y la app calcula el orden por tiempo, no solo por distancia. Si algo cambia a mitad de ruta, se vuelve a ordenar lo que queda con un toque. Es lo que hace la diferencia cuando pasas de 30 o 40 paradas.'],
    ['5. Qué mirar antes de elegir una app', 'Que no ponga tope de paradas o que el tope te sobre; que ordene por tiempo con el tráfico de cada hora; que respete los horarios de entrega; que funcione solo con el móvil, sin ordenador; y cuánto cuesta de verdad cuando se acaba la prueba.'],
    ['6. Y al cargar el vehículo', 'Carga en orden inverso: lo último de la ruta, al fondo. Así cada paquete está a mano cuando llegas a su puerta y no pierdes minutos buscándolo en cada parada.'],
  ],
  caja: {
    titulo: 'Una app para repartir con todas tus paradas',
    intro: '<b>FDS</b> es una app para repartidores que reparten por su cuenta:',
    puntos: [
      'Foto a la etiqueta o escaneo del código: la dirección entra sola.',
      'Ordena todas las paradas por tiempo, con el tráfico típico de cada hora.',
      'Te guía con voz hasta cada puerta y, en Android, con manos libres: dices «entregado» y sigues.',
      '«Mi dinero hoy»: cuánto llevas ganado, la gasolina y lo que te queda, en tu moneda.',
    ],
    boton: 'Probar FDS gratis',
  },
  oferta: {
    promo: 'Gratis y sin límite de paradas hasta el 31 de diciembre de 2026, sin tarjeta. Después, gratis hasta 15 paradas al día.',
    siempre: 'Gratis hasta 15 paradas al día, sin tarjeta.',
  },
  titPreguntas: 'Preguntas frecuentes',
  preguntas: [
    ['¿Cuántas paradas permite Google Maps?', 'Hasta 10 puntos por ruta: el punto de salida y 9 paradas más, la última de las cuales es el destino final.'],
    ['¿Google Maps ordena las paradas para hacer la ruta más corta?', 'No. Las recorre en el orden en que las escribes; puedes arrastrarlas para cambiarlo, pero el mejor orden lo tienes que decidir tú.'],
    ['¿Cuántas paradas admite FDS?', enPromo()
      ? 'Hasta el 31 de diciembre de 2026, todas las que quieras y gratis. Después, el plan gratis permite 15 paradas nuevas al día y el de pago no tiene tope.'
      : 'El plan gratis permite 15 paradas nuevas al día y el de pago no tiene tope.'],
  ],
  pie: { legal: 'Aviso legal', privacidad: 'Privacidad', otros: [['Em português', '/guia-mais-de-10-paradas', 'pt-BR'], ['Cómo ordenar la ruta', '/guia-ruta-de-reparto']] },
})

export async function onRequestGet() {
  return respuestaGuia(guia())
}
