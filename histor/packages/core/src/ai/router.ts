/**
 * Elige proveedor por tarea a partir del entorno:
 *   AI_PROVIDER_WRITING=anthropic:claude-opus-5
 *   AI_PROVIDER_TRANSLATION=openai:<modelo>
 *   AI_PROVIDER_EXTRACTION=gemini:<modelo>
 * Sin variable o sin clave → null → la tarea usa su versión determinista.
 * El presupuesto mensual (AI_MONTHLY_BUDGET_USD) se comprueba antes de cada
 * llamada; si se agota, también se vuelve a lo determinista.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { aiUsage } from '../db/schema';
import { env } from '../env';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { OpenAiCompatibleProvider } from './providers/openaiCompatible';
import type { AiTask, JsonRequest, JsonResponse, LlmProvider } from './types';

const cache = new Map<string, LlmProvider | null>();

export function providerFor(task: AiTask): LlmProvider | null {
  const e = env();
  const spec =
    task === 'writing' || task === 'editing'
      ? e.AI_PROVIDER_WRITING
      : task === 'translation'
        ? (e.AI_PROVIDER_TRANSLATION ?? e.AI_PROVIDER_WRITING)
        : (e.AI_PROVIDER_EXTRACTION ?? e.AI_PROVIDER_WRITING);
  if (!spec) return null;
  if (cache.has(spec)) return cache.get(spec)!;
  const [name, ...rest] = spec.split(':');
  const model = rest.join(':');
  let p: LlmProvider | null = null;
  if (name === 'anthropic' && e.ANTHROPIC_API_KEY && model) p = new AnthropicProvider(model, e.ANTHROPIC_API_KEY);
  else if (name === 'openai' && e.OPENAI_API_KEY && model) p = new OpenAiCompatibleProvider(model, e.OPENAI_API_KEY, e.OPENAI_BASE_URL);
  else if (name === 'gemini' && e.GEMINI_API_KEY && model) p = new GeminiProvider(model, e.GEMINI_API_KEY);
  cache.set(spec, p);
  return p;
}

export async function monthSpendUsd(db: Db): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(sql`${aiUsage.ts} >= date_trunc('month', now())`);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Llama al proveedor registrando consumo y coste. Devuelve null si no hay
 * proveedor, si el presupuesto está agotado o si la llamada falla.
 */
export async function callJson(
  db: Db,
  req: JsonRequest,
  meta: { storyId?: number | null; provider?: LlmProvider | null } = {},
): Promise<JsonResponse | null> {
  const provider = meta.provider === undefined ? providerFor(req.task) : meta.provider;
  if (!provider) return null;
  const budget = env().AI_MONTHLY_BUDGET_USD;
  if (budget > 0 && (await monthSpendUsd(db)) >= budget) return null;
  try {
    const res = await provider.generateJson(req);
    await db.insert(aiUsage).values({
      task: req.task,
      provider: res.provider,
      model: res.model,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsd: res.costUsd,
      storyId: meta.storyId ?? null,
      ok: !res.refused,
      error: res.refused ? 'refusal' : null,
    });
    return res.refused ? null : res;
  } catch (err) {
    await db.insert(aiUsage).values({
      task: req.task,
      provider: provider.name,
      model: provider.model,
      storyId: meta.storyId ?? null,
      ok: false,
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
    });
    return null;
  }
}
