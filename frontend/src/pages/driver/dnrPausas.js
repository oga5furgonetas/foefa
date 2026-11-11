/* «Mis DNR»: lo que está EN PAUSA (11-11-2026). Dani, al ver la pantalla: «lo de entrega preferencial déjalo parado por
   ahora, que estoy mirando otra cosa; no les pongas lo de te cuenta o no, déjalo en pausa también».

   Nada se ha borrado: con `true` no se enseña; para volver a enseñarlo, se pone a `false` y se vuelve a publicar la web
   (las pruebas de cada cosa vuelven solas: tanda2-dnr.spec.js lee esta misma constante). No es un ajuste del conductor:
   ni el móvil ni la dirección lo cambian.
     - estado:      si una DNR le cuenta o no («Te cuenta», «No cuenta», «Pendiente»), su banda roja, los contadores de
                    color, «Qué es cada color» y «Actualizada» (una DNR que solo cambia de estado no es novedad). Las
                    semanas anteriores dicen su total («2 DNR») en lugar de los mini contadores.
     - preferencia: el recordatorio de la entrega con preferencia («Solo si el cliente tiene preferencia de entrega…»). */
export const PAUSAS = { estado: true, preferencia: true }
