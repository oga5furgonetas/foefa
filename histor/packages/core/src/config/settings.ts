/**
 * Reglas y umbrales editoriales. Viven en la tabla `settings` (clave
 * 'editorial') y se cambian desde el panel; estos son los valores por
 * defecto y su esquema. Todo cambio queda en audit_log.
 */
import { z } from 'zod';

export const editorialSettingsSchema = z.object({
  /** Confianza mínima para publicar como hecho confirmado. */
  verifiedMin: z.number().min(0.5).max(1).default(0.75),
  /** Confianza mínima para publicar como "en desarrollo" (todo atribuido). */
  developingMin: z.number().min(0.3).max(0.95).default(0.5),
  /** Grupos independientes creíbles mínimos para VERIFIED. */
  minIndependentVerified: z.number().int().min(1).max(10).default(2),
  /**
   * Grupos independientes creíbles mínimos para publicar, aunque sea "en desarrollo".
   * 2 por defecto (27-09-2026, con fuentes reales): con 1, la portada alemana era el
   * feed de DER SPIEGEL con «, berichtet DER SPIEGEL» pegado a su titular, incluidos
   * comentarios de opinión y viñetas. Con 2, una historia espera a que otra fuente
   * independiente la recoja (el agrupador las une en minutos).
   */
  minIndependentDeveloping: z.number().int().min(1).max(5).default(2),
  /**
   * Una fuente primaria oficial basta para verificar SUS PROPIOS datos.
   * Desactivado por defecto: nada de una sola fuente se presenta como verificado
   * (como mucho, «en desarrollo» y atribuido: «según el BOE…»).
   */
  primaryOfficialSelfSufficient: z.boolean().default(false),
  /** Por debajo de esto, una noticia publicada se retira si hay desmentido creíble. */
  retractBelow: z.number().min(0).max(0.5).default(0.25),
  /** Días a partir de los cuales una información se considera antigua. */
  staleDays: z.number().min(1).max(60).default(3),
  /** Horas que una historia puede seguir en investigación sin avanzar. */
  investigationTtlHours: z.number().min(1).max(168).default(36),
  /** Similitud mínima (0-1) para unir una pieza a una historia existente. */
  clusterThreshold: z.number().min(0.2).max(0.95).default(0.42),
  /** Similitud MinHash a partir de la cual una pieza es copia de otra. */
  copyThreshold: z.number().min(0.3).max(1).default(0.55),
  /** Momentum mínimo para marcar "última hora" (solo si ya es publicable). */
  breakingMomentum: z.number().min(0).max(1).default(0.7),
  /** Máximo de palabras seguidas copiadas de una misma fuente. */
  maxVerbatimWords: z.number().int().min(8).max(60).default(30),
  /** Proporción máxima del cuerpo que puede coincidir con una sola fuente. */
  maxSourceOverlap: z.number().min(0.1).max(0.9).default(0.5),
  /** Idiomas en que se publica (si hay material o traductor). */
  publishLanguages: z.array(z.string()).default(['es', 'en', 'de', 'fr', 'it', 'pt']),
  /** Publicación automática activada (si false, todo queda en cola para un editor). */
  autoPublish: z.boolean().default(true),
  /** Publicación automática en redes activada. */
  autoSocial: z.boolean().default(false),
  /** Alertas push automáticas activadas. */
  autoAlerts: z.boolean().default(true),
  /** Confianza mínima para enviar una alerta. */
  alertMinConfidence: z.number().min(0.5).max(1).default(0.8),
  /** Importancia mínima para enviar una alerta. */
  alertMinImportance: z.number().min(0).max(1).default(0.65),
});

export type EditorialSettings = z.infer<typeof editorialSettingsSchema>;

export const DEFAULT_EDITORIAL_SETTINGS: EditorialSettings = editorialSettingsSchema.parse({});

/** Pesos de cada tipo de fuente (0-1) y si cuenta como "creíble" para corroborar. */
export const sourceTypeWeightsSchema = z.record(z.string(), z.object({ weight: z.number().min(0).max(1), credible: z.boolean() }));

export const DEFAULT_SOURCE_TYPE_WEIGHTS: z.infer<typeof sourceTypeWeightsSchema> = {
  primary_official: { weight: 1.0, credible: true },
  official: { weight: 0.9, credible: true },
  wire_agency: { weight: 0.85, credible: true },
  academic: { weight: 0.8, credible: true },
  reputable_media: { weight: 0.75, credible: true },
  identified_journalist: { weight: 0.55, credible: true },
  company: { weight: 0.5, credible: false },
  witness: { weight: 0.3, credible: false },
  blog: { weight: 0.2, credible: false },
  social_media: { weight: 0.08, credible: false },
  ugc: { weight: 0.08, credible: false },
  anonymous: { weight: 0.05, credible: false },
  aggregator: { weight: 0, credible: false },
  unverifiable: { weight: 0, credible: false },
};
