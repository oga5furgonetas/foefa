/* El enlace de «Invita a un compañero» (/invita?ref=…), con la tarjeta de la app de ruta al pasarlo por WhatsApp (14-11-2026): ver
 * `conTarjetaDeReparto` en ./repartidores.js. La página es la misma; solo cambia la vista previa. */
import { conTarjetaDeReparto } from './repartidores.js'

export const onRequestGet = (context) => conTarjetaDeReparto(context, '/invita')
