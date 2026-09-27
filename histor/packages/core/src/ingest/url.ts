/** URLs: canonicalización (para no ingerir dos veces lo mismo) y validación. */

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|ref_src|cmpid|ocid|_ga|spm|smid|at_medium|at_campaign|ito|xtor)$/i;

export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = '';
  for (const [k, v] of params) u.searchParams.append(k, v);
  let s = u.toString();
  if (u.pathname !== '/' && s.endsWith('/') && !u.search) s = s.slice(0, -1);
  return s.replace(/^http:\/\//, 'https://');
}

export function isHttpUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

/** ¿Es una IP de red interna, de bucle local, enlace local o CGNAT? (IPv4 e IPv6). */
export function isPrivateIp(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = a.startsWith('::ffff:') ? a.slice(7) : a;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [x, y] = v4.split('.').map(Number);
    return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || x >= 224;
  }
  return a === '::' || a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
}

/**
 * Comprueba en qué IP resuelve de verdad un nombre (evita que un dominio
 * público apunte a la red interna). Si no resuelve, no se permite.
 */
export async function resolvesToPublic(hostname: string, lookup: (h: string) => Promise<{ address: string }[]> = defaultLookup): Promise<boolean> {
  if (!isPublicHost(hostname)) return false;
  try {
    const addrs = await lookup(hostname);
    return addrs.length > 0 && addrs.every((x) => !isPrivateIp(x.address));
  } catch {
    return false;
  }
}

async function defaultLookup(h: string) {
  const dns = await import('node:dns/promises');
  return dns.lookup(h, { all: true });
}

/** Evita que un feed nos haga pedir a la red interna (SSRF). */
export function isPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h === '::1' || h.startsWith('[')) return false;
  return true;
}
