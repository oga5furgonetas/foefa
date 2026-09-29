/**
 * Proveedor genérico compatible con la API de Chat Completions (OpenAI,
 * Mistral, OpenRouter, vLLM/Ollama locales…). Permite no depender de un
 * único proveedor. Se usa con AI_PROVIDER_*=openai:<modelo> y
 * OPENAI_API_KEY / OPENAI_BASE_URL.
 */
import { costUsd } from '../pricing';
import type { JsonRequest, JsonResponse, LlmProvider } from '../types';

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    readonly model: string,
    private apiKey: string,
    private baseUrl = 'https://api.openai.com/v1',
    private fetchImpl: typeof fetch = fetch,
    /** Parámetros extra del proveedor (p. ej. `reasoning_effort` en Groq/OpenAI). */
    private extraBody: Record<string, unknown> = {},
  ) {}

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 8000,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
        response_format: { type: 'json_schema', json_schema: { name: `histor_${req.task}`, schema: req.schema, strict: true } },
        ...this.extraBody,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`openai-compatible ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      model?: string;
      choices: { message: { content: string | null; refusal?: string | null }; finish_reason: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const choice = body.choices[0];
    const inputTokens = body.usage?.prompt_tokens ?? 0;
    const outputTokens = body.usage?.completion_tokens ?? 0;
    const refused = !!choice?.message.refusal;
    return {
      data: !refused && choice?.message.content ? JSON.parse(choice.message.content) : null,
      provider: this.name,
      model: body.model ?? this.model,
      inputTokens,
      outputTokens,
      costUsd: costUsd(this.model, inputTokens, outputTokens),
      refused,
    };
  }
}
