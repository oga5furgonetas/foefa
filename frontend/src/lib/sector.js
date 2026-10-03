/* CÓMO HABLA LA APP SEGÚN A QUÉ SE DEDIQUE LA EMPRESA (03-10-2026).

   Un súper no tiene «centros» ni «conductores»: tiene tiendas y repartidores.
   Un distribuidor, almacenes. Un autónomo no tiene ni lo uno ni lo otro. Con
   el vocabulario de una subcontrata de paquetería, el producto le dice a cada
   uno de ellos que no es para él. El sector lo elige la empresa al darse de
   alta y lo devuelve /org/billing; sin sector, se habla como siempre. */

export const SECTORES_REPARTO = new Set(['supermercado', 'distribucion', 'autonomo', 'mensajeria'])

export const esReparto = (sector) => SECTORES_REPARTO.has(sector)

const VOCES = {
  supermercado: { centro: 'Tienda', centros: 'Tiendas', nuevoCentro: 'Nueva tienda (ej. Centro)', conductores: 'Repartidores', conductor: 'repartidor' },
  distribucion: { centro: 'Almacén', centros: 'Almacenes', nuevoCentro: 'Nuevo almacén (ej. Norte)', conductores: 'Repartidores', conductor: 'repartidor' },
  mensajeria: { centro: 'Base', centros: 'Bases', nuevoCentro: 'Nueva base (ej. Norte)', conductores: 'Repartidores', conductor: 'repartidor' },
  autonomo: { centro: 'Base', centros: 'Bases', nuevoCentro: 'Nueva base', conductores: 'Repartidores', conductor: 'repartidor' },
}

/** Palabras para ese sector, o null para usar las de siempre (las traducidas). */
export const voces = (sector) => VOCES[sector] || null
