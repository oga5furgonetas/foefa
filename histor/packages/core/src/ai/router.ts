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

/**
 * Proveedores de una tarea, en orden. La variable admite una lista separada por comas
 * («openai:openai/gpt-oss-120b,openai:qwen/qwen3.8-27b»): en los planes gratuitos cada modelo
 * tiene su propio cupo diario y, cuando se agota uno, se pasa al siguiente.
 */
export function providersFor(task: AiTask): LlmProvider[] {
  const e = env();
  const specs =
    task === 'writing' || task === 'editing'
      ? e.AI_PROVIDER_WRITING
      : task === 'translation'
        ? (e.AI_PROVIDER_TRANSLATION ?? e.AI_PROVIDER_WRITING)
        : (e.AI_PROVIDER_EXTRACTION ?? e.AI_PROVIDER_WRITING);
  if (!specs) return [];
  return specs
    .split(',')
    .map((s) => buildProvider(s.trim()))
    .filter((p): p is LlmProvider => !!p);
}

export function providerFor(task: AiTask): LlmProvider | null {
  return providersFor(task)[0] ?? null;
}

function buildProvider(spec: string): LlmProvider | null {
  const e = env();
  if (!spec) return null;
  if (cache.has(spec)) return cache.get(spec)!;
  const [name, ...rest] = spec.split(':');
  const model = rest.join(':');
  let p: LlmProvider | null = null;
  if (name === 'anthropic' && e.ANTHROPIC_API_KEY && model) p = new AnthropicProvider(model, e.ANTHROPIC_API_KEY);
  else if (name === 'openai' && e.OPENAI_API_KEY && model)
    p = new OpenAiCompatibleProvider(model, e.OPENAI_API_KEY, e.OPENAI_BASE_URL, fetch, e.AI_REASONING_EFFORT ? { reasoning_effort: e.AI_REASONING_EFFORT } : {});
  else if (name === 'gemini' && e.GEMINI_API_KEY && model) p = new GeminiProvider(model, e.GEMINI_API_KEY);
  cache.set(spec, p);
  return p;
}

/**
 * Tokens gastados por un modelo desde que su proveedor renovó el cupo diario. Groq y Gemini lo
 * renuevan a medianoche de California (AI_QUOTA_RESET_TZ). Con una ventana de 24 h, lo gastado
 * de madrugada seguía bloqueando la IA horas después de la renovación (30-09-2026).
 */
export async function dayTokens(db: Db, model: string): Promise<number> {
  const tz = env().AI_QUOTA_RESET_TZ;
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)` })
    .from(aiUsage)
    .where(sql`${aiUsage.model} = ${model} AND ${aiUsage.ts} >= (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`);
  return Number(rows[0]?.total ?? 0);
}

/** Tras un 429 («demasiadas peticiones»), el modelo descansa lo que diga el proveedor. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 15 * 60_000;

/**
 * Cuánto esperar tras un 429. Groq dice «Please try again in 3.21s» cuando es el límite por
 * minuto (se espera eso) y habla de «per day» cuando se acabó el cupo diario (una hora).
 */
export function retryAfterMs(message: string): number {
  const daily = /per day|\bRPD\b|\bTPD\b|daily/i.test(message);
  // «m» son minutos solo si no va seguida de «s» («120ms» no son 120 minutos).
  const m = message.match(/try again in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(\d+(?:\.\d+)?)?(ms|s)?/i);
  const parsed = m && (m[1] || m[2] || m[3]) ? Number(m[1] ?? 0) * 3_600_000 + Number(m[2] ?? 0) * 60_000 + (m[3] ? Number(m[3]) * (m[4] === 'ms' ? 1 : 1000) : 0) : null;
  // El cupo diario de Groq se repone poco a poco (ventana móvil): el «try again in 9m10s» de su
  // aviso es fiable. Sin plazo, una hora.
  if (daily) return parsed == null ? 60 * 60_000 : Math.min(Math.max(parsed + 1000, 60_000), 2 * 3_600_000);
  if (parsed != null) return Math.min(Math.max(parsed + 1000, 2000), COOLDOWN_MS);
  return COOLDOWN_MS;
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
  const chain = meta.provider === undefined ? providersFor(req.task) : meta.provider ? [meta.provider] : [];
  if (!chain.length) return null;
  const budget = env().AI_MONTHLY_BUDGET_USD;
  if (budget > 0 && (await monthSpendUsd(db)) >= budget) return null;
  const daily = env().AI_DAILY_TOKEN_LIMIT;
  // En orden: si uno descansa (429), agotó su cupo del día o falla, se prueba el siguiente.
  for (const provider of chain) {
    const key = `${provider.name}:${provider.model}`;
    if ((cooldownUntil.get(key) ?? 0) > Date.now()) continue;
    if (daily > 0 && (await dayTokens(db, provider.model)) >= daily) continue;
    try {
      const res = await provider.generateJson(req);
      await db.insert(aiUsage).values({
        task: req.task,
        provider: res.provider,
        model: provider.model,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costUsd: res.costUsd,
        storyId: meta.storyId ?? null,
        ok: !res.refused,
        error: res.refused ? 'refusal' : null,
      });
      return res.refused ? null : res;
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      if (/\b429\b/.test(msg)) cooldownUntil.set(key, Date.now() + retryAfterMs(msg));
      await db.insert(aiUsage).values({
        task: req.task,
        provider: provider.name,
        model: provider.model,
        storyId: meta.storyId ?? null,
        ok: false,
        error: msg.slice(0, 500),
      });
    }
  }
  return null;
}
