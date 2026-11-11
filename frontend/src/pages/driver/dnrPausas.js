/* «Mis DNR»: lo que está EN PAUSA (11-11-2026). Dani, al ver la pantalla: «lo de entrega preferencial déjalo parado por
   ahora, que estoy mirando otra cosa; no les pongas lo de te cuenta o no, déjalo en pausa también».

   Nada se ha borrado: con `true` no se enseña; para volver a enseñarlo, se pone a `false` y se vuelve a publicar la web
   (las pruebas de cada cosa vuelven solas: tanda2-dnr.spec.js lee esta misma constante). No es un ajuste del conductor:
   ni el móvil ni la dirección lo cambian.
     - estado:      si una DNR le cuenta o no («Te cuenta», «No cuenta», «Pendiente»), su banda roja, los contadores de
                    color, «Qué es cada color» y «Actualizada» (una DNR que solo cambia de estado no es novedad). Las
                    semanas anteriores dicen su total («2 DNR») en lugar de los mini contadores. SIGUE EN PAUSA.
     - preferencia: el recordatorio de la entrega con preferencia («Solo si el cliente tiene preferencia de entrega…») y su
                    ejemplo («¿Cómo sé si tiene preferencia?», EjemploPreferencia.jsx). VUELVE el 11-11-2026 (R11), con el
                    ejemplo corregido. Dani: «monta lo de no cuentan, foto de ejemplo, marca bien que debe ser entrega
                    preferencial en ese ejemplo… y no lo de notas de entrega ni notas de cliente», y «la preferencia de
                    entrega es buzón de correos, es lo primero que aparece en la app». El recordatorio dice «No te cuenta»
                    porque es la REGLA, no el estado de una DNR: con el estado en pausa, ninguna DNR dice si le cuenta. */
export const PAUSAS = { estado: true, preferencia: false }
