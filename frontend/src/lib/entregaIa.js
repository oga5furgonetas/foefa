// LA ENTREGA VERIFICADA (01-11-2026): lo que la IA dijo de la foto de entrega, en una frase para el repartidor. El
// servidor manda un código (`aviso`) y los datos; la frase se hace aquí para que salga en su idioma. La nativa tiene
// la misma en ui/hoy/Hojas.kt (textoAvisoIa).
import { tx } from './idioma'

export function textoAvisoIa(ia) {
  const a = ia?.aviso
  if (a === 'personas') return tx('Se ven personas en la foto: repítela sin ellas.')
  if (a === 'sin_paquete') return tx('No se ve el paquete en la foto: repítela con el paquete donde lo dejas.')
  if (a === 'otro_numero') return tx('En la foto se lee el número {a} y la parada es el {b}: comprueba que es la puerta buena.', { a: ia.numero || '', b: ia.portal || '' })
  if (a === 'sin_numero') return tx('No se ve el número del portal: la próxima vez, con el número o la puerta en la foto.')
  return ''
}
