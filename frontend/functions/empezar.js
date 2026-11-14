/* La puerta de la app para quien no tiene cuenta (/empezar), con la tarjeta de la app de ruta al pasarlo por WhatsApp (14-11-2026): ver
 * `conTarjetaDeReparto` en ./repartidores.js. La página es la misma; solo cambia la vista previa. */
import { conTarjetaDeReparto } from './repartidores.js'

export const onRequestGet = (context) => conTarjetaDeReparto(context, '/empezar')
