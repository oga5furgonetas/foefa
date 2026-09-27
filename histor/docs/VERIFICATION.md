# Cómo verifica Histor

> **Regla que no se rompe:** no se publica como hecho nada que no se pueda
> verificar. Si hay que elegir, exactitud antes que rapidez.

Todo el motor es **determinista y explicable** (`packages/core/src/verification`).
La IA, si está configurada, solo redacta a partir de hechos ya verificados, y
un validador comprueba cada frase. Cada decisión queda en la tabla
`verifications` con su desglose, y el panel la muestra en «Historias → cadena
de evidencia».

## 1. Estados editoriales

```
DISCOVERED → UNVERIFIED → INVESTIGATING → PARTIALLY_VERIFIED → VERIFIED → PUBLISHED → UPDATED
                                      ↘ HELD (retenida)  ↘ REJECTED (descartada)  ↘ BLOCKED (editor)
PUBLISHED/UPDATED → RETRACTED (retirada, texto visible y marcado)
```

Las transiciones permitidas están en `domain.ts` (`STORY_TRANSITIONS`); cualquier
otra es un error de programación.

## 2. Tipos de fuente

`primary_official`, `official`, `wire_agency`, `reputable_media`,
`identified_journalist`, `academic`, `company`, `witness`, `social_media`, `ugc`,
`blog`, `aggregator`, `anonymous`, `unverifiable`. Cada tipo tiene un peso y un
indicador «creíble» configurables en el panel (con límites: redes sociales,
contenido de usuarios, anónimos, agregadores y no verificables **no pueden**
marcarse como creíbles). La fiabilidad aprendida de cada fuente es una
distribución Beta (aciertos / contradicciones) que se actualiza con el tiempo.

## 3. Los pasos, uno por uno

1. **Agrupar** en una historia todas las piezas que hablan del mismo acontecimiento
   (similitud de términos con IDF, entidades compartidas, lugar, cifras como anclas
   entre idiomas).
2. **Independencia:** se cuentan fuentes, no enlaces.
   - Lo que cita a una agencia («según EFE», «(AP)») cuenta como esa agencia.
   - Textos casi idénticos (MinHash) se agrupan como una copia.
   - Medios del mismo grupo propietario son una sola fuente.
   - La pieza más antigua del grupo es el «original probable».
3. **Afirmaciones:** de cada pieza se extraen frases con quién, qué, cuándo, dónde,
   cuántos (cifras con unidad), citas con su autor y modalidad:
   afirmado, atribuido, con reservas, predicción, negado o pregunta.
4. **Evidencia:** para cada afirmación se buscan en las demás fuentes pruebas que
   la respaldan, la mencionan o la contradicen (entidades, cifras compatibles,
   lugares, fechas, cita literal y mismo autor). Compartir protagonistas y lugar
   no basta: si no coinciden cifras, la otra pieza tiene que contener al menos la
   mitad de lo que se afirma (sus palabras de contenido, sin nombres ni cifras);
   si no, solo la «menciona» y la afirmación queda atribuida, no confirmada
   («negocia comprar terrenos» no se confirma con «estudia abrir un campus»).
5. **Contradicciones:**

   | Tipo | Gravedad |
   |---|---|
   | cita atribuida a otra persona | crítica |
   | desmentido de fuente primaria/oficial | crítica |
   | cifra distinta a la vez | mayor |
   | cifra que cambia con horas de diferencia (balance) | menor |
   | fecha o lugar incompatibles | mayor |

6. **Tiempo:** fechas del texto frente a la de publicación; noticias antiguas que
   vuelven a circular (`old_resurfaced`); desfase de fechas (`date_mismatch`).
7. **Imágenes:** huella perceptual (dHash) para detectar fotos recicladas
   (`old_image`); una imagen reciclada nunca se usa.
8. **Sátira:** una fuente satírica solo puede ser el origen a desmentir; nunca
   aporta evidencia.
9. **Pistas:** redes sociales, blogs y testigos anónimos avisan de que algo puede
   estar pasando; como mucho suman +0,3 al logit y **nunca** bastan para publicar.
10. **Confianza en la evidencia** (EVIDENCE CONFIDENCE, 0–1), modelo de log-odds:

    ```
    logit = −1,2 (previo)
          + Σ peso × 1,8 × (1; 0,85; 0,7; 0,6…)   por cada grupo independiente creíble
          + min(0,3; pistas)
          + 0,8 fuente primaria oficial | 0,6 oficial
          + (ratio de afirmaciones clave respaldadas − 0,5) × 1,5
          + 0,5 si hay documento oficial o dato estructurado
          − 2,0 × críticas − 1,0 × mayores − 0,15 × menores
    p = sigmoide(logit) × coherencia temporal × coherencia geográfica × frescura
    ```

    Topes duros: sátira → 0; solo pistas → ≤ 0,20; ninguna fuente creíble → ≤ 0,30;
    una sola creíble → ≤ 0,60 (la excepción para la fuente oficial primaria que
    produce el dato existe como ajuste del panel, **desactivada** por defecto).

11. **Impulso** (NEWS MOMENTUM, 0–1): ritmo de piezas nuevas, fuentes distintas,
    idiomas y países, lectura. **Es independiente de la confianza**: una historia
    viral sin pruebas tiene impulso alto y confianza baja, y no se publica.
    La importancia editorial (0,65 × impulso + 0,35 × confianza) solo ordena lo que
    ya es publicable.
12. **Decisión** (umbrales editables en el panel):

    | Condición | Resultado |
    |---|---|
    | confianza ≥ 0,75 **y** ≥ 2 fuentes independientes creíbles **y** hecho principal respaldado | publicar como **verificada** |
    | confianza ≥ 0,50 y ≥ 2 fuentes independientes creíbles | publicar **en desarrollo**, todo atribuido («según X…») |
    | una sola fuente independiente | no se publica: espera a que otra la recoja (el agrupador las une) |
    | solo boletines oficiales y alertas automáticas (`corroborateOnly`: BOE, GDACS, GOV.UK, BCE, Fed, NASA) | no se publica: sirven para corroborar, no originan noticia |
    | contradicción crítica | retener y abrir tarea de revisión |
    | solo pistas | investigar; si es viral, tarea «viral sin verificar» |
    | sátira, noticia antigua reciclada, sin avances en 36 h | descartar |
    | ya publicada y aparece un desmentido oficial con confianza < 0,25 | **retirar** (texto visible y marcado) |
    | ya publicada y cae la confianza o surge una contradicción crítica | nota pública «en revisión» y tarea |
    | ya publicada y hay datos nuevos | **actualizar** (versión nueva, nota con lo que cambió, misma URL) |

13. **Vigilancia:** cada historia publicada se vuelve a comprobar cada 30 min
    durante las primeras 6 h, cada 2 h hasta las 48 h y cada 12 h hasta la semana;
    después se cierra y se reabre si llegan piezas nuevas. Las que están en
    investigación se revisan cada 10–30 min.

## 4. De los hechos al texto

1. **Ficha de hechos** (`writing/factsheet.ts`): afirmaciones confirmadas,
   atribuidas, sin confirmar, datos superados (cifras que han cambiado),
   predicciones, citas verificadas, cifras con sus fuentes, discrepancias,
   fuentes y cronología.
2. **Redacción:** si hay IA configurada, el modelo recibe SOLO la ficha y debe
   devolver JSON con cada frase ligada a sus afirmaciones; si no, redactor
   determinista con frases propias de cada idioma (no traducción literal).
   Nunca se copian más de 30 palabras seguidas de una fuente (60 si es un texto
   oficial, que suele ser de reutilización libre).
3. **Validador** (`writing/validate.ts`), frase a frase: cada cifra, fecha,
   nombre y cita debe existir en la evidencia; lo no confirmado debe ir atribuido;
   las predicciones, en futuro o condicional.
4. **Once controles** (`writing/quality.ts`). Si falla uno crítico, no se publica:

   | Control | Crítico |
   |---|---|
   | FACT_CHECK (citas, cifras, fechas, estado, predicciones, titular) | sí |
   | SOURCE_CHECK (fuentes creíbles, ninguna bloqueada ni satírica) | sí |
   | DUPLICATE_CHECK (no repetir una noticia ya publicada) | sí |
   | DATE_CHECK | sí |
   | ENTITY_CHECK | sí |
   | QUOTE_CHECK (cita literal y mismo autor) | sí |
   | GEO_CHECK | si la historia está verificada |
   | LANGUAGE_CHECK | sí |
   | SEO_CHECK (longitudes, sin clickbait) | no |
   | LEGAL_CHECK (copia literal, solapamiento, datos personales, difamación) | sí |
   | FINAL_EDITORIAL_CHECK (estado, umbrales, bloqueo, coherencia titular-cuerpo) | sí |

## 5. Transparencia pública

Cada noticia muestra el recuadro **«Cómo verificamos esta noticia»**: qué está
confirmado y por quién, qué se atribuye sin confirmación independiente, qué
sigue sin confirmar, qué datos anteriores han quedado superados y en qué
discrepan las fuentes. Debajo: la lista de fuentes con enlace al original, la
cronología, las correcciones y el historial de versiones.

## 6. Pruebas

`packages/core/test/unit/verification.adversarial.test.ts` recorre los casos
adversarios: noticia falsa viral, fuente única, copias de una agencia, copias
literales, imagen antigua, fecha incorrecta, persona equivocada, cita inventada,
cifra contradictoria, balance que evoluciona, rumor de X, sátira, noticia
antigua viral, desmentido oficial tras publicar y predicción presentada como
hecho. `verification.calibration.test.ts` fija la calibración (dos fuentes
creíbles ≥ 0,75; una sola no pasa de «en desarrollo»). La prueba de integración
`pipeline.test.ts` pasa el escenario DEMO completo por el pipeline real.
