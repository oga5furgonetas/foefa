/* LA GRAVEDAD Y LOS DAÑOS DE UNA REVISIÓN, CON EL REPASO (14-11-2026). Cuando una persona marca un golpe a mano en el
   Repaso sobre lo que dijo la IA, el servidor no toca las cuentas de la IA (`severity`, `total_damages_count`) y manda
   aparte las que suman las dos cosas (`severidad_con_repaso`, `total_con_repaso`; CONTRATO M9 y S14). Toda pantalla que
   enseña la gravedad o el número de daños de una revisión lee estas, para que un golpe grave confirmado nunca se lea
   «Sin daños · 0 daños». La cola de «Revisión rápida» NO las usa: allí se juzga lo que dijo la IA. */

/** La gravedad de la revisión: la del repaso si la hay; si no, la de la IA. */
export const gravedadDe = (analysis) => analysis?.severidad_con_repaso ?? analysis?.severity

/** Cuántos daños tiene la revisión: con los del repaso si los hay; si no, los de la IA. */
export const danosDe = (analysis) => analysis?.total_con_repaso ?? analysis?.total_damages_count
