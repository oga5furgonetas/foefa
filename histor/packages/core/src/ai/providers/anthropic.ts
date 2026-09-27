/**
 * Proveedor Anthropic (Claude) con el SDK oficial.
 * - Salida estructurada: output_config.format = json_schema.
 * - Si el modelo declina una petición (stop_reason "refusal"), el propio API
 *   la reintenta en el modelo de respaldo recomendado (fallbacks: "default").
 */
import Anthropic from '@anthropic-ai/sdk';
import { costUsd } from '../pricing';
import type { JsonRequest, JsonResponse, LlmProvider } from '../types';

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(
    readonly model: string,
    apiKey?: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      output_config: {
        effort: req.effort ?? 'medium',
        format: { type: 'json_schema', schema: req.schema },
      },
    });
    const inputTokens = response.usage.input_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? 0;
    const base = {
      provider: this.name,
      model: response.model ?? this.model,
      inputTokens,
      outputTokens,
      costUsd: costUsd(this.model, inputTokens, outputTokens),
    };
    if (response.stop_reason === 'refusal') return { ...base, data: null, refused: true };
    let text = '';
    for (const block of response.content) if (block.type === 'text') text += block.text;
    return { ...base, data: text ? JSON.parse(text) : null, refused: false };
  }
}
