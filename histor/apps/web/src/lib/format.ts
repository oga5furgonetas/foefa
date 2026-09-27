import { localeFor } from '@histor/core/config/languages';

export function fmtDateTime(d: Date | string, lang: string, tz?: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'long', timeStyle: 'short', timeZone: tz }).format(new Date(d));
}

export function fmtDate(d: Date | string, lang: string, tz?: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date(d));
}

export function fmtTime(d: Date | string, lang: string, tz?: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(d));
}

export function fmtToday(lang: string, tz?: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date());
}

export function fmtMoney(cents: number, currency: string, lang: string, country?: string | null): string {
  const zero = ['JPY', 'CLP', 'KRW'].includes(currency);
  return new Intl.NumberFormat(localeFor(lang, country ?? null), { style: 'currency', currency, maximumFractionDigits: zero ? 0 : 2, minimumFractionDigits: zero ? 0 : cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

/** "hace 5 min", "hace 3 h" en el idioma del lector. */
export function fmtRelative(d: Date | string, lang: string): string {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
