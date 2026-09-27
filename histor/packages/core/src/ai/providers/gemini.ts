/**
 * Proveedor Google Gemini (API generateContent con salida JSON).
 * AI_PROVIDER_*=gemini:<modelo> y GEMINI_API_KEY.
 */
import { costUsd } from '../pricing';
import type { JsonRequest, JsonResponse, LlmProvider } from '../types';

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    readonly model: string,
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: req.schema, maxOutputTokens: req.maxTokens ?? 8000 },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      modelVersion?: string;
    };
    const cand = body.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const refused = cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT';
    const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      data: !refused && text ? JSON.parse(text) : null,
      provider: this.name,
      model: body.modelVersion ?? this.model,
      inputTokens,
      outputTokens,
      costUsd: costUsd(this.model, inputTokens, outputTokens),
      refused,
    };
  }
}
