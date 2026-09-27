/**
 * Precios por millón de tokens (USD) para calcular el coste de IA por
 * noticia. Se revisan al cambiar de modelo; un modelo desconocido se
 * contabiliza con AI_PRICE_OVERRIDES (JSON) o, si falta, con coste 0 y un
 * aviso en el panel (nunca se inventa un precio).
 */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  // Anthropic (tarifas de la API de primera parte)
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-fable-5-1': { input: 10, output: 50 },
};

export function priceFor(model: string): { input: number; output: number } | null {
  try {
    const overrides = process.env.AI_PRICE_OVERRIDES ? (JSON.parse(process.env.AI_PRICE_OVERRIDES) as Record<string, { input: number; output: number }>) : {};
    return overrides[model] ?? PRICES_PER_MTOK[model] ?? null;
  } catch {
    return PRICES_PER_MTOK[model] ?? null;
  }
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  if (!p) return 0;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 1e6) / 1e6;
}
