'use client';
/** Cliente de la API con CSRF de doble envío. */

function readCookie(name: string): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

let pending: Promise<string> | null = null;

export async function csrfToken(): Promise<string> {
  const existing = readCookie('histor_csrf');
  if (existing) return existing;
  pending ??= fetch('/api/v1/csrf', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((j: { token: string }) => j.token)
    .finally(() => {
      pending = null;
    });
  return pending;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers['x-csrf-token'] = await csrfToken();
  }
  const res = await fetch(path, { method, headers, credentials: 'same-origin', body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiClientError(res.status, (data as { error?: string }).error ?? 'error');
  return data;
}

export function consentOf(): Set<string> {
  return new Set((readCookie('histor_consent') ?? '').split(',').filter(Boolean));
}

export function setCookie(name: string, value: string, days = 365) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${days * 86400}; SameSite=Lax${secure}`;
}
