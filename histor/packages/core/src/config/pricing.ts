/**
 * Precios iniciales de Histor Premium por mercado (editables en el panel →
 * Precios). Criterio (ver docs/PRICING.md): referencia de medios de calidad
 * (El País Premium 15 €/mes o 144 €/año; NYT Basic Digital 16 $/mes) y un
 * producto nuevo que compite por conversión: 40-60 % de esos precios en
 * mercados de renta alta y ajuste por poder adquisitivo en Latinoamérica.
 * Anual ≈ 25 % de descuento. Prueba de 14 días donde el ticket lo justifica.
 */
import { EUROZONE } from './countries';

export type PlanSeed = {
  market: string;
  countryCodes: string[];
  currency: string;
  monthlyCents: number;
  yearlyCents: number;
  trialDays: number;
  isDefault?: boolean;
};

export const PLAN_SEEDS: PlanSeed[] = [
  { market: 'ES', countryCodes: ['ES'], currency: 'EUR', monthlyCents: 599, yearlyCents: 5400, trialDays: 14 },
  { market: 'PT', countryCodes: ['PT'], currency: 'EUR', monthlyCents: 499, yearlyCents: 4500, trialDays: 14 },
  { market: 'EUROZONE', countryCodes: EUROZONE.filter((c) => c !== 'ES' && c !== 'PT'), currency: 'EUR', monthlyCents: 699, yearlyCents: 6300, trialDays: 14 },
  { market: 'US', countryCodes: ['US'], currency: 'USD', monthlyCents: 799, yearlyCents: 7200, trialDays: 14 },
  { market: 'GB', countryCodes: ['GB'], currency: 'GBP', monthlyCents: 599, yearlyCents: 5400, trialDays: 14 },
  { market: 'CH', countryCodes: ['CH', 'LI'], currency: 'CHF', monthlyCents: 890, yearlyCents: 8000, trialDays: 14 },
  { market: 'CA', countryCodes: ['CA'], currency: 'CAD', monthlyCents: 899, yearlyCents: 8100, trialDays: 14 },
  { market: 'MX', countryCodes: ['MX'], currency: 'MXN', monthlyCents: 7900, yearlyCents: 71000, trialDays: 7 },
  { market: 'BR', countryCodes: ['BR'], currency: 'BRL', monthlyCents: 1990, yearlyCents: 17900, trialDays: 7 },
  { market: 'CO', countryCodes: ['CO'], currency: 'COP', monthlyCents: 1490000, yearlyCents: 13400000, trialDays: 7 },
  { market: 'CL', countryCodes: ['CL'], currency: 'CLP', monthlyCents: 399000, yearlyCents: 3590000, trialDays: 7 },
  // Inflación alta: se cobra en USD para no reajustar cada mes.
  { market: 'AR', countryCodes: ['AR', 'VE'], currency: 'USD', monthlyCents: 299, yearlyCents: 2700, trialDays: 7 },
  { market: 'JP', countryCodes: ['JP'], currency: 'JPY', monthlyCents: 98000, yearlyCents: 880000, trialDays: 14 },
  { market: 'WORLD', countryCodes: [], currency: 'USD', monthlyCents: 599, yearlyCents: 5400, trialDays: 7, isDefault: true },
];

/** Monedas sin decimales en Stripe (el importe va en unidades, no en céntimos). */
export const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'CLP', 'VND', 'XAF', 'XOF', 'PYG', 'UGX']);

/** Convierte nuestro "céntimos" interno (siempre ×100) al importe que espera Stripe. */
export function toStripeAmount(cents: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(cents / 100) : cents;
}

export function fromStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? amount * 100 : amount;
}
