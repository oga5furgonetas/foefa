/* diseño compacto */
/* Las piezas de la app de reparto (06-11-2026, §4 de la especificación): una por fichero, y aquí reunidas para poder
   importarlas de una vez (`{ Hoja, Boton }` desde esta carpeta) y para que `check-huerfanos` las vea mientras las
   pantallas (W2-W7) las van usando. Cada pantalla puede importar el fichero de cada pieza directamente. */
export { default as Atribucion } from './Atribucion'
export { default as Aviso } from './Aviso'
export { default as AvisoFlotante } from './AvisoFlotante'
export { default as Ayuda } from './Ayuda'
export { default as Boton } from './Boton'
export { default as BotonMapa } from './BotonMapa'
export { default as Cabecera } from './Cabecera'
export { default as Campo } from './Campo'
export { default as Chip, ChipOpcion } from './Chip'
export { default as ContenedorLista } from './ContenedorLista'
export { default as Etiqueta } from './Etiqueta'
export { default as FilaChips } from './FilaChips'
export { default as FilaCierre } from './FilaCierre'
export { default as FilaDato } from './FilaDato'
export { default as FilaParada } from './FilaParada'
export { default as Hoja } from './Hoja'
export { default as LetraMax } from './LetraMax'
export { default as LineaEstado } from './LineaEstado'
export { default as Menu } from './Menu'
export { default as NumeroParada } from './NumeroParada'
export { default as Pastilla } from './Pastilla'
export { default as Promo } from './Promo'
export { default as Segmentado } from './Segmentado'
// «¿Dónde?» corto, para los chips de «Prueba de entrega» y de la memoria (W3); aquí hasta que lo importe quien lo pinta.
export { DONDE_CORTO } from '../../../lib/dejar'
