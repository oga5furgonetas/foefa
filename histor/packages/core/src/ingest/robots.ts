/**
 * robots.txt (RFC 9309): Histor solo pide lo que el sitio permite a su
 * agente ("HistorBot") o a "*", y respeta Crawl-delay.
 *
 * También lee `Content-Signal` (p. ej. `search=yes, ai-train=no, ai-input=no`):
 * con `ai-input=no` el editor no quiere que su contenido entre en modelos de IA,
 * así que esa fuente se trata como reservada (ver `aiInputReserved`).
 */

export type RobotsRules = { allow: string[]; disallow: string[]; crawlDelay: number | null; contentSignals: Record<string, string> };

const emptyRules = (): RobotsRules => ({ allow: [], disallow: [], crawlDelay: null, contentSignals: {} });

function parseSignals(value: string, into: Record<string, string>) {
  for (const part of value.split(',')) {
    const [k, v] = part.split('=').map((x) => x?.trim().toLowerCase());
    if (k && v) into[k] = v;
  }
}

export function parseRobots(txt: string, agent = 'historbot'): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  const globalSignals: Record<string, string> = {};
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: emptyRules() };
        groups.push(current);
      }
      if (value) current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'content-signal') {
      parseSignals(value, current ? current.rules.contentSignals : globalSignals);
      continue;
    }
    if (!current) continue;
    if (key === 'allow' && value) current.rules.allow.push(value);
    else if (key === 'disallow' && value) current.rules.disallow.push(value);
    else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n)) current.rules.crawlDelay = n;
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const star = groups.find((g) => g.agents.includes('*'));
  const rules = (mine ?? star)?.rules ?? emptyRules();
  return { ...rules, contentSignals: { ...globalSignals, ...rules.contentSignals } };
}

/** El editor pide que su contenido no se use como entrada de modelos de IA. */
export function aiInputReserved(rules: RobotsRules): boolean {
  return rules.contentSignals['ai-input'] === 'no';
}

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith('$');
  const body = (anchored ? p.slice(0, -1) : p)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** ¿Está permitida esta ruta? Gana la regla más específica (más larga); en empate, Allow. */
export function isAllowed(rules: RobotsRules, pathWithQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const [list, allow] of [
    [rules.allow, true],
    [rules.disallow, false],
  ] as const) {
    for (const p of list) {
      if (patternToRegex(p).test(pathWithQuery)) {
        const len = p.length;
        if (!best || len > best.len || (len === best.len && allow)) best = { len, allow };
      }
    }
  }
  return best ? best.allow : true;
}
