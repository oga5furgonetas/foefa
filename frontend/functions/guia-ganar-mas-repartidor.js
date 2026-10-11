/* GUÍA «CÓMO GANAR MÁS COMO REPARTIDOR» (11-10-2026). Para Google, en español neutro. Sin cifras de sueldos
 * (cambian por empresa y país): cómo saber lo que te queda y cómo subirlo. Versión de Brasil:
 * guia-ganhar-mais-entregador.js. Plantilla en functions_lib/guia.js. */
import { respuestaGuia } from '../functions_lib/guia.js'

const GUIA = {
  ruta: '/guia-ganar-mas-repartidor', lang: 'es', utm: 'guia_ganar_es',
  alternas: [['pt-BR', '/guia-ganhar-mais-entregador']],
  titulo: 'Cómo ganar más como repartidor de paquetería: 8 consejos',
  descripcion: 'Cómo saber cuánto te queda de verdad por día y por hora, y qué cambiar para ganar más repartiendo: menos kilómetros, menos fallidos y más paradas por hora.',
  h1: 'Cómo ganar más como repartidor de paquetería',
  entradilla: 'Lo que te pagan por paquete casi nunca lo decides tú. Lo que sí está en tu mano es cuánto tardas, cuántos kilómetros haces y cuántas entregas se te quedan sin hacer. Ahí está la diferencia.',
  secciones: [
    ['1. Saca tus números de verdad', 'Lo que te pagan por entrega (o por día), menos la gasolina, la cuota y lo que te cuesta el vehículo. Dividido entre las horas que estás en la calle. Ese es tu sueldo real por hora, y es la cifra que hay que subir. Si no la tienes, hazla con la <a href="/calculadora-repartidor">calculadora para repartidores</a>.'],
    ['2. Menos kilómetros por parada', 'Cada kilómetro de más es gasolina y tiempo que nadie te paga. Agrupa las paradas por zonas y ordénalas por tiempo, no por el orden en que te dieron los paquetes. Tienes la <a href="/guia-ruta-de-reparto">guía para ordenar la ruta</a> paso a paso.'],
    ['3. Menos minutos en cada parada', 'Carga en orden inverso (lo último, al fondo) y separa por tramos. Buscar un paquete en la furgoneta o en el maletero es tiempo muerto: en un día de muchas paradas, se nota al final.'],
    ['4. Menos entregas fallidas', 'Un «no estaba» es una parada que haces dos veces. Avisa al cliente antes de llegar con tu hora aproximada y, si no está, déjalo para el final de su zona en vez de volver atrás.'],
    ['5. Los horarios, primero', 'Coloca primero las entregas con franja horaria y ordena el resto alrededor. Llegar tarde a una franja suele ser un reintento al día siguiente.'],
    ['6. Cuida el gasto del vehículo', 'Ruedas con la presión correcta, mantenimiento al día y conducción suave: el consumo baja y las averías también. Una avería en plena ruta es el día perdido.'],
    ['7. Apunta tu día', 'Paradas, kilómetros, horas y lo que has ganado. Con una semana de datos sabes qué rutas o qué días te salen a cuenta y cuáles no.'],
    ['8. Negocia con datos', 'Si sabes tus paradas por hora y tu coste por kilómetro, puedes comparar ofertas de verdad y pedir mejor tarifa para las zonas que te hacen perder dinero.'],
  ],
  caja: {
    titulo: 'Una app que te ayuda con todo esto',
    intro: '<b>FDS</b> es una app para repartidores que reparten por su cuenta:',
    puntos: [
      'Foto a la etiqueta o escaneo del código: la dirección entra sola.',
      'Ordena las paradas por tiempo, con el tráfico típico de cada hora.',
      '«Mi dinero hoy»: cuánto llevas ganado, la gasolina y lo que te queda, en la moneda de tu país.',
      'Te guía con voz y, en Android, con manos libres: dices «entregado» y sigues conduciendo.',
    ],
    boton: 'Probar FDS gratis',
  },
  oferta: {
    promo: 'Gratis y sin límite hasta el 31 de diciembre de 2026, sin tarjeta. Después, gratis hasta 15 paradas al día.',
    siempre: 'Gratis hasta 15 paradas al día, sin tarjeta.',
  },
  titPreguntas: 'Preguntas frecuentes',
  preguntas: [
    ['¿Cuánto gana un repartidor por paquete?', 'Depende de la empresa, la zona y el país, así que la única cifra que vale es la tuya: lo que te pagan por entrega, menos lo que gastas por kilómetro y tus gastos fijos. La calculadora lo hace con tus números.'],
    ['¿Cómo sé si una ruta me sale a cuenta?', 'Mira lo que te queda por hora en esa ruta (lo cobrado menos la gasolina, entre las horas) y compáralo con tus otras rutas. Si una zona tiene muchos kilómetros entre paradas, es la que más te cuesta.'],
    ['¿Qué es lo que más tiempo hace perder?', 'Normalmente tres cosas: dar vueltas por no llevar la ruta ordenada, buscar el paquete en cada parada y las entregas fallidas que hay que repetir.'],
  ],
  pie: { legal: 'Aviso legal', privacidad: 'Privacidad', otros: [['Em português', '/guia-ganhar-mais-entregador', 'pt-BR'], ['Cómo ordenar la ruta', '/guia-ruta-de-reparto'], ['Ruta con más de 10 paradas', '/guia-mas-de-10-paradas']] },
}

export async function onRequestGet() {
  return respuestaGuia(GUIA)
}
