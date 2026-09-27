/**
 * Capa de IA intercambiable. Ningún módulo editorial conoce al proveedor:
 * piden "genera JSON que cumpla este esquema" y reciben datos + consumo.
 * Si no hay proveedor configurado (o se agota el presupuesto), la tarea
 * cae a su versión determinista. La IA nunca es la última palabra: todo lo
 * que produce pasa por validadores deterministas antes de publicarse.
 */

export type AiTask = 'writing' | 'extraction' | 'translation' | 'editing';

export type JsonRequest = {
  task: AiTask;
  system: string;
  prompt: string;
  /** JSON Schema (draft 2020-12, sin $ref) que debe cumplir la respuesta. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
};

export type JsonResponse = {
  data: unknown;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  refused: boolean;
};

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateJson(req: JsonRequest): Promise<JsonResponse>;
}

export class AiUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AiUnavailableError';
  }
}
