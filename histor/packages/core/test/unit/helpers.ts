import { DEFAULT_EDITORIAL_SETTINGS } from '../../src/config/settings';
import type { SourceType } from '../../src/domain';
import { findPlaces } from '../../src/text/entities';
import { detectAttribution } from '../../src/text/attribution';
import { detectLanguage } from '../../src/text/langdetect';
import { minhash } from '../../src/text/similarity';
import { analyseStory, type EngineInput } from '../../src/verification/engine';
import type { VItem, VSource } from '../../src/verification/types';

export const NOW = new Date('2026-09-27T12:00:00Z');

let nextSource = 1;
let nextItem = 1;

export function source(name: string, type: SourceType, extra: Partial<VSource> = {}): VSource {
  const id = nextSource++;
  return {
    id,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    sourceType: type,
    ownershipGroup: null,
    isSatire: false,
    countryCode: 'ES',
    reliability: { alpha: 8, beta: 2 },
    homepageUrl: `https://${id}.example.org`,
    ...extra,
  };
}

export function item(src: VSource, title: string, text: string, opts: { minutesAgo?: number; publishedAt?: Date; url?: string; imagePhash?: string; structured?: Record<string, unknown> } = {}): VItem {
  const id = nextItem++;
  const published = opts.publishedAt ?? new Date(NOW.getTime() - (opts.minutesAgo ?? 30) * 60000);
  const full = `${title}. ${text}`;
  return {
    id,
    sourceId: src.id,
    url: opts.url ?? `${src.homepageUrl}/n/${id}`,
    title,
    summary: null,
    text,
    language: detectLanguage(full).lang,
    publishedAt: published,
    fetchedAt: new Date(published.getTime() + 5 * 60000),
    attributedTo: detectAttribution(text),
    minhash: minhash(full),
    imageUrl: null,
    imagePhash: opts.imagePhash ?? null,
    places: findPlaces(full),
    structured: opts.structured ?? null,
  };
}

export function run(items: VItem[], sources: VSource[], extra: Partial<EngineInput> = {}) {
  const firstSeen = new Date(Math.min(...items.map((i) => (i.publishedAt ?? i.fetchedAt).getTime())));
  return analyseStory({
    items,
    sources: new Map(sources.map((s) => [s.id, s])),
    state: 'UNVERIFIED',
    now: NOW,
    settings: DEFAULT_EDITORIAL_SETTINGS,
    firstSeenAt: firstSeen,
    ...extra,
  });
}
