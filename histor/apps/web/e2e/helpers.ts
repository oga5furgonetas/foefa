import crypto from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';

/** TOTP (RFC 6238) para completar el 2FA en las pruebas. */
export function totp(secretB32: string, time = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretB32.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / 30)));
  const h = crypto.createHmac('sha1', bytes).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Cliente de la API con CSRF (como hace la web). */
export async function apiPost(request: APIRequestContext, base: string, path: string, data: unknown, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') {
  const r = await request.get(`${base}/api/v1/csrf`);
  const { token } = (await r.json()) as { token: string };
  return request.fetch(`${base}${path}`, { method, data, headers: { 'x-csrf-token': token, origin: base, 'content-type': 'application/json' } });
}

export async function acceptCookies(page: Page) {
  const btn = page.getByRole('button', { name: /Aceptar todo|Accept all/ });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

export async function firstArticleUrl(request: APIRequestContext, base: string, lang = 'es'): Promise<string> {
  const r = await request.get(`${base}/api/v1/articles?lang=${lang}&limit=20`);
  const items = ((await r.json()) as { items: { url: string; isDeveloping: boolean }[] }).items;
  return (items.find((i) => !i.isDeveloping) ?? items[0]).url;
}
