/**
 * Limitación de ritmo (ventana deslizante aproximada con dos ventanas fijas).
 * En memoria por defecto (una instancia); con REDIS_URL, compartida entre
 * instancias. Se usa en login, registro, denuncias, búsqueda, analítica y API.
 */
import { env } from '../env';

export type Limit = { key: string; limit: number; windowSec: number };
export type LimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

interface Store {
  incr(key: string, windowSec: number): Promise<{ current: number; previous: number; elapsedFraction: number }>;
}

class MemoryStore implements Store {
  private m = new Map<string, { count: number; expires: number }>();
  async incr(key: string, windowSec: number) {
    const now = Date.now();
    const win = Math.floor(now / 1000 / windowSec);
    const cur = `${key}:${win}`;
    const prev = `${key}:${win - 1}`;
    const e = this.m.get(cur) ?? { count: 0, expires: (win + 2) * windowSec * 1000 };
    e.count++;
    this.m.set(cur, e);
    if (this.m.size > 50_000) for (const [k, v] of this.m) if (v.expires < now) this.m.delete(k);
    return { current: e.count, previous: this.m.get(prev)?.count ?? 0, elapsedFraction: ((now / 1000) % windowSec) / windowSec };
  }
}

class RedisStore implements Store {
  constructor(private client: import('ioredis').Redis) {}
  async incr(key: string, windowSec: number) {
    const now = Date.now();
    const win = Math.floor(now / 1000 / windowSec);
    const cur = `rl:${key}:${win}`;
    const prev = `rl:${key}:${win - 1}`;
    const res = await this.client.multi().incr(cur).expire(cur, windowSec * 2).get(prev).exec();
    return { current: Number(res?.[0]?.[1] ?? 1), previous: Number(res?.[2]?.[1] ?? 0), elapsedFraction: ((now / 1000) % windowSec) / windowSec };
  }
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (store) return store;
  const url = env().REDIS_URL;
  if (url) {
    const { default: Redis } = await import('ioredis');
    store = new RedisStore(new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }));
  } else store = new MemoryStore();
  return store;
}

export async function rateLimit(l: Limit): Promise<LimitResult> {
  try {
    const s = await getStore();
    const { current, previous, elapsedFraction } = await s.incr(l.key, l.windowSec);
    const estimated = previous * (1 - elapsedFraction) + current;
    const allowed = estimated <= l.limit;
    return { allowed, remaining: Math.max(0, Math.floor(l.limit - estimated)), retryAfterSec: allowed ? 0 : Math.ceil(l.windowSec * (1 - elapsedFraction)) };
  } catch {
    // Si el almacén falla, no se bloquea a los lectores (pero sí se registra en logs).
    return { allowed: true, remaining: l.limit, retryAfterSec: 0 };
  }
}

export const LIMITS = {
  login: (id: string) => ({ key: `login:${id}`, limit: 8, windowSec: 600 }),
  register: (id: string) => ({ key: `register:${id}`, limit: 5, windowSec: 3600 }),
  reset: (id: string) => ({ key: `reset:${id}`, limit: 5, windowSec: 3600 }),
  report: (id: string) => ({ key: `report:${id}`, limit: 10, windowSec: 3600 }),
  newsletter: (id: string) => ({ key: `nl:${id}`, limit: 10, windowSec: 3600 }),
  search: (id: string) => ({ key: `search:${id}`, limit: 60, windowSec: 60 }),
  events: (id: string) => ({ key: `ev:${id}`, limit: 240, windowSec: 60 }),
  api: (id: string) => ({ key: `api:${id}`, limit: 300, windowSec: 60 }),
};

/** Solo para tests. */
export function resetRateLimitStore() {
  store = null;
}
