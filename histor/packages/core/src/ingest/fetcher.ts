/**
 * Cliente HTTP "educado" para la ingesta:
 * - se identifica (User-Agent con URL de contacto);
 * - respeta robots.txt y Crawl-delay; un intervalo mínimo por host;
 * - GET condicional (ETag / Last-Modified) para no descargar lo mismo;
 * - lee la reserva de minería de textos (cabecera `tdm-reservation`, TDMRep):
 *   si el editor se reserva el derecho, solo se guardan metadatos;
 * - límite de tamaño y de tiempo; nunca pide a redes internas.
 * NO evade muros de pago, CAPTCHAs ni bloqueos: si el sitio dice que no, es que no.
 */
import { env } from '../env';
import { isAllowed, parseRobots, type RobotsRules } from './robots';
import { isPublicHost } from './url';

export type FetchResult = {
  url: string;
  status: number;
  ok: boolean;
  notModified: boolean;
  body: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  tdmReserved: boolean;
  bytes: number;
  durationMs: number;
  blockedByRobots: boolean;
};

export type FetcherOptions = {
  fetchImpl?: typeof fetch;
  minHostIntervalMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
  /** Solo para tests y fixtures locales. */
  allowPrivateHosts?: boolean;
  respectRobots?: boolean;
};

export function userAgent(): string {
  const e = env();
  const contact = e.BOT_CONTACT_URL ?? `${e.PUBLIC_BASE_URL.replace(/\/$/, '')}/en/how-it-works`;
  return `HistorBot/0.1 (+${contact})`;
}

export class PoliteFetcher {
  private lastHit = new Map<string, number>();
  private robots = new Map<string, { rules: RobotsRules; at: number }>();
  private readonly fetchImpl: typeof fetch;

  constructor(private opts: FetcherOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async pace(host: string, crawlDelaySec: number | null) {
    const min = Math.max(this.opts.minHostIntervalMs ?? 1000, (crawlDelaySec ?? 0) * 1000);
    const last = this.lastHit.get(host) ?? 0;
    const wait = last + min - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 30_000)));
    this.lastHit.set(host, Date.now());
  }

  async robotsFor(u: URL): Promise<RobotsRules> {
    const key = `${u.protocol}//${u.host}`;
    const cached = this.robots.get(key);
    if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.rules;
    let rules: RobotsRules = { allow: [], disallow: [], crawlDelay: null };
    try {
      const res = await this.fetchImpl(`${key}/robots.txt`, {
        headers: { 'user-agent': userAgent() },
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      });
      if (res.ok) rules = parseRobots(await res.text());
      // 401/403 en robots.txt = no permitido (criterio conservador).
      else if (res.status === 401 || res.status === 403) rules = { allow: [], disallow: ['/'], crawlDelay: null };
    } catch {
      /* sin robots.txt accesible: se permite (RFC 9309 §2.3.1.3 para 4xx) */
    }
    this.robots.set(key, { rules, at: Date.now() });
    return rules;
  }

  async get(url: string, cond: { etag?: string | null; lastModified?: string | null; accept?: string; headers?: Record<string, string> } = {}): Promise<FetchResult> {
    const started = Date.now();
    const u = new URL(url);
    const base: Omit<FetchResult, 'status' | 'ok' | 'body'> = {
      url,
      notModified: false,
      contentType: null,
      etag: null,
      lastModified: null,
      tdmReserved: false,
      bytes: 0,
      durationMs: 0,
      blockedByRobots: false,
    };
    if (!['http:', 'https:'].includes(u.protocol) || (!this.opts.allowPrivateHosts && !isPublicHost(u.hostname))) {
      return { ...base, status: 0, ok: false, body: 'URL no permitida' };
    }
    let crawlDelay: number | null = null;
    if (this.opts.respectRobots !== false) {
      const rules = await this.robotsFor(u);
      crawlDelay = rules.crawlDelay;
      if (!isAllowed(rules, u.pathname + u.search)) {
        return { ...base, status: 0, ok: false, body: 'bloqueado por robots.txt', blockedByRobots: true, durationMs: Date.now() - started };
      }
    }
    await this.pace(u.host, crawlDelay);
    const headers: Record<string, string> = {
      'user-agent': userAgent(),
      accept: cond.accept ?? 'application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
      ...cond.headers,
    };
    if (cond.etag) headers['if-none-match'] = cond.etag;
    if (cond.lastModified) headers['if-modified-since'] = cond.lastModified;
    const res = await this.fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000) });
    const tdm = res.headers.get('tdm-reservation');
    const common = {
      ...base,
      status: res.status,
      contentType: res.headers.get('content-type'),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      tdmReserved: tdm === '1',
    };
    if (res.status === 304) return { ...common, ok: true, notModified: true, body: '', durationMs: Date.now() - started };
    const max = this.opts.maxBytes ?? 5_000_000;
    const buf = await readLimited(res, max);
    return { ...common, ok: res.ok, body: buf, bytes: Buffer.byteLength(buf), durationMs: Date.now() - started };
  }
}

async function readLimited(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}
