/**
 * IA con plan gratuito (Groq, compatible con OpenAI): el conector manda los parámetros extra
 * (`reasoning_effort` para gastar menos cupo) y un 429 se propaga como error con su código,
 * que el enrutador usa para dejar descansar el modelo 15 minutos.
 */
import { describe, expect, it } from 'vitest';
import { OpenAiCompatibleProvider } from '../../src/ai/providers/openaiCompatible';
import { retryAfterMs } from '../../src/ai/router';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('conector compatible con OpenAI (Groq)', () => {
  it('manda reasoning_effort y el esquema JSON, y lee la respuesta', async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return ok({ model: 'openai/gpt-oss-120b', choices: [{ message: { content: '{"headline":"Titular"}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
    }) as unknown as typeof fetch;
    const p = new OpenAiCompatibleProvider('openai/gpt-oss-120b', 'gsk_prueba', 'https://api.groq.com/openai/v1', fetchImpl, { reasoning_effort: 'low' });
    const res = await p.generateJson({ task: 'writing', system: 's', prompt: 'p', schema: { type: 'object' } });
    expect(sent.reasoning_effort).toBe('low');
    expect((sent.response_format as { type: string }).type).toBe('json_schema');
    expect(res.data).toEqual({ headline: 'Titular' });
    expect(res.inputTokens + res.outputTokens).toBe(1500);
    expect(res.costUsd).toBe(0); // modelo sin precio conocido: coste 0, nunca inventado
  });

  it('un 429 llega como error con su código', async () => {
    const fetchImpl = (async () => new Response('rate limit', { status: 429 })) as unknown as typeof fetch;
    const p = new OpenAiCompatibleProvider('openai/gpt-oss-120b', 'gsk_prueba', 'https://api.groq.com/openai/v1', fetchImpl);
    await expect(p.generateJson({ task: 'writing', system: 's', prompt: 'p', schema: {} })).rejects.toThrow(/429/);
  });
});

describe('espera tras un 429', () => {
  it('respeta el «try again in» del límite por minuto y también del diario (ventana móvil: se repone poco a poco)', () => {
    expect(retryAfterMs('Rate limit reached ... on tokens per minute (TPM): Limit 8000, Used 6333, Requested 2095. Please try again in 3.21s.')).toBe(4210);
    expect(retryAfterMs('Please try again in 1m30.5s.')).toBe(91500);
    expect(retryAfterMs('Please try again in 120ms')).toBe(2000);
    expect(retryAfterMs('Rate limit reached ... on tokens per day (TPD): Limit 200000. Please try again in 7m12s')).toBe(433000);
    expect(retryAfterMs('Rate limit reached ... on tokens per day (TPD): Limit 200000. Please try again in 20s')).toBe(60000);
    expect(retryAfterMs('Rate limit reached ... on requests per day (RPD): Limit 1000')).toBe(3600000);
    expect(retryAfterMs('429 Too Many Requests')).toBe(900000);
  });
});
