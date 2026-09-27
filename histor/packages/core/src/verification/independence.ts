/**
 * ¿Cuántas fuentes INDEPENDIENTES hay de verdad?
 *
 * Reglas (en este orden):
 * 1. Si la pieza cita un origen ("según EFE", "(Reuters)"), pertenece al grupo
 *    de ese origen — igual que la propia pieza de la agencia.
 * 2. Si su texto es casi idéntico al de una pieza anterior de otra fuente,
 *    es una copia: se une al grupo de la pieza copiada.
 * 3. Medios del mismo grupo propietario forman un solo grupo.
 * 4. Si no, la fuente es su propio grupo.
 * Los agregadores y las fuentes inverificables pesan 0.
 */
import { DEFAULT_SOURCE_TYPE_WEIGHTS } from '../config/settings';
import type { SourceType } from '../domain';
import { KNOWN_ORIGINS } from '../text/attribution';
import { fold } from '../text/normalize';
import { minhashSimilarity } from '../text/similarity';
import type { IndependenceGroup, VItem, VSource } from './types';

export type TypeWeights = Record<string, { weight: number; credible: boolean }>;

/** Media de la Beta de fiabilidad. */
export function reliabilityMean(r: { alpha: number; beta: number }): number {
  const s = r.alpha + r.beta;
  return s > 0 ? r.alpha / s : 0.5;
}

/** Nombre de origen canónico que representa una fuente (si es una agencia conocida). */
export function sourceOriginName(source: VSource): string | null {
  const n = fold(source.name);
  for (const [canon, aliases] of Object.entries(KNOWN_ORIGINS)) {
    if (fold(canon) === n || aliases.includes(n)) return canon;
  }
  return null;
}

const TYPE_RANK: SourceType[] = [
  'primary_official',
  'official',
  'wire_agency',
  'academic',
  'reputable_media',
  'identified_journalist',
  'company',
  'witness',
  'blog',
  'social_media',
  'ugc',
  'anonymous',
  'aggregator',
  'unverifiable',
];

export function betterType(a: SourceType, b: SourceType): SourceType {
  return TYPE_RANK.indexOf(a) <= TYPE_RANK.indexOf(b) ? a : b;
}

export function analyseIndependence(
  items: VItem[],
  sources: Map<number, VSource>,
  opts: { copyThreshold: number; weights?: TypeWeights },
): { groups: IndependenceGroup[]; itemGroup: Record<number, { key: string; isCopy: boolean; copyOf: number | null }> } {
  const weights = opts.weights ?? DEFAULT_SOURCE_TYPE_WEIGHTS;
  const ordered = [...items].sort((a, b) => time(a) - time(b) || a.id - b.id);
  const itemGroup: Record<number, { key: string; isCopy: boolean; copyOf: number | null }> = {};

  for (const it of ordered) {
    const src = sources.get(it.sourceId);
    if (!src) continue;
    // 1) Origen citado
    if (it.attributedTo) {
      const own = sourceOriginName(src);
      // Si la propia agencia se cita a sí misma, es su grupo igualmente.
      itemGroup[it.id] = { key: `origin:${it.attributedTo}`, isCopy: own !== it.attributedTo, copyOf: null };
      continue;
    }
    const ownOrigin = sourceOriginName(src);
    if (ownOrigin) {
      itemGroup[it.id] = { key: `origin:${ownOrigin}`, isCopy: false, copyOf: null };
      continue;
    }
    // 2) Copia casi literal de una pieza anterior de OTRA fuente
    let copyOf: VItem | null = null;
    let best = 0;
    for (const prev of ordered) {
      if (prev === it) break;
      if (prev.sourceId === it.sourceId) continue;
      const sim = minhashSimilarity(it.minhash, prev.minhash);
      if (sim >= opts.copyThreshold && sim > best) {
        best = sim;
        copyOf = prev;
      }
    }
    if (copyOf && itemGroup[copyOf.id]) {
      itemGroup[it.id] = { key: itemGroup[copyOf.id].key, isCopy: true, copyOf: copyOf.id };
      continue;
    }
    // 3) Grupo propietario
    if (src.ownershipGroup) {
      itemGroup[it.id] = { key: `group:${fold(src.ownershipGroup)}`, isCopy: false, copyOf: null };
      continue;
    }
    // 4) La propia fuente
    itemGroup[it.id] = { key: `source:${src.id}`, isCopy: false, copyOf: null };
  }

  const byKey = new Map<string, IndependenceGroup>();
  for (const it of ordered) {
    const g = itemGroup[it.id];
    if (!g) continue;
    const src = sources.get(it.sourceId)!;
    let grp = byKey.get(g.key);
    if (!grp) {
      grp = {
        key: g.key,
        itemIds: [],
        sourceIds: [],
        bestType: src.sourceType,
        weight: 0,
        credible: false,
        originalItemId: it.id,
        isPrimary: false,
      };
      byKey.set(g.key, grp);
    }
    grp.itemIds.push(it.id);
    if (!grp.sourceIds.includes(src.id)) grp.sourceIds.push(src.id);
    // Las copias no mejoran el tipo del grupo: el grupo vale lo que su original.
    if (!g.isCopy) grp.bestType = betterType(grp.bestType, src.sourceType);
  }
  for (const grp of byKey.values()) {
    const w = weights[grp.bestType] ?? { weight: 0, credible: false };
    // Fiabilidad aprendida de la mejor fuente del grupo (media Beta), acotada.
    const rel = Math.max(
      ...grp.sourceIds.map((id) => {
        const s = sources.get(id)!;
        return s.sourceType === grp.bestType ? reliabilityMean(s.reliability) : 0;
      }),
      0.5,
    );
    grp.weight = w.weight * (0.5 + 0.5 * rel);
    grp.credible = w.credible && !grp.sourceIds.some((id) => sources.get(id)?.isSatire);
    grp.isPrimary = grp.bestType === 'primary_official' || grp.bestType === 'official';
  }
  return { groups: [...byKey.values()], itemGroup };
}

function time(it: VItem): number {
  return (it.publishedAt ?? it.fetchedAt).getTime();
}
