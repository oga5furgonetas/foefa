import Link from 'next/link';
import type { CSSProperties } from 'react';
import { category } from '@histor/core/config/categories';
import { country } from '@histor/core/config/countries';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import type { ArticleCard } from '@histor/core/services/content';
import { fmtRelative, fmtTime } from '@/lib/format';
import { Badges } from './Badges';

type Card = ArticleCard & { exp?: { key: string; variant: string } };
type P = { a: Card; lang: string; d: Dict; tz?: string };

/** Atributos para medir impresiones y clics de los titulares A/B. */
function expAttrs(a: Card) {
  return a.exp ? { 'data-exp': a.exp.key, 'data-variant': a.exp.variant, 'data-article': a.id } : {};
}

function Meta({ a, lang, d }: P) {
  return (
    <div className="meta">
      <Badges d={d} a={{ isBreaking: a.isBreaking, isDeveloping: a.isDeveloping, isDemo: a.isDemo, verified: !a.isDeveloping }} />
      <time dateTime={new Date(a.updatedAt).toISOString()} className="tnum">
        {fmtRelative(a.updatedAt, lang)}
      </time>
      {a.sourcesCount > 0 && <span>· {a.sourcesCount === 1 ? d.label.sourceOne : t(d.label.sources, { n: a.sourcesCount })}</span>}
    </div>
  );
}

/**
 * Portadilla de cada sección (icono propio, trazo de 24×24) para las noticias sin foto con
 * licencia: la portada queda pareja sin rellenar con fotos que puedan confundirse con el
 * acontecimiento (Dani, 01-10-2026: «van mal escalonadas, algunas sin foto»).
 */
const SECTION_ART: Record<string, { hue: number; icon: string }> = {
  politics: { hue: 218, icon: 'M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8' },
  economy: { hue: 152, icon: 'M3 3v18h18M7 15l4-4 3 3 6-7M16 7h4v4' },
  business: { hue: 200, icon: 'M4 7h16v12H4zM9 7V5h6v2M4 12h16' },
  technology: { hue: 262, icon: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4' },
  science: { hue: 186, icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10' },
  health: { hue: 350, icon: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z' },
  sports: { hue: 28, icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7l4 3-1.5 5h-5L8 10zM12 3v4M16 10l4.5-1.5M14.5 15l2.5 4M9.5 15 7 19M8 10 3.5 8.5' },
  entertainment: { hue: 320, icon: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8l-5.4 2.7 1.2-6-4.5-4.2 6.1-.7z' },
  culture: { hue: 38, icon: 'M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14M8 7h8' },
  society: { hue: 12, icon: 'M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M16 13c2.8 0 5 2.2 5 5' },
  world: { hue: 205, icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18' },
  weather: { hue: 196, icon: 'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18zM15 4v2M19.5 6.5 18 8M21 11h-2' },
  travel: { hue: 172, icon: 'M3 12l18-8-6 18-3-7zM12 15l9-11' },
  lifestyle: { hue: 95, icon: 'M5 8h12v5a6 6 0 0 1-12 0zM17 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2' },
  opinion: { hue: 0, icon: 'M4 5h16v11H9l-5 4z' },
};
const NEWS_ICON = 'M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4';

/**
 * Foto con licencia verificada (Wikimedia Commons o de la fuente oficial) y, si no la hay, la
 * portadilla de la sección con el país: nunca una foto que pueda confundirse con el acontecimiento.
 * Los retratos se encuadran por arriba para no cortar la cara.
 */
function Art({ a, lang, big }: { a: ArticleCard; lang: string; big?: boolean }) {
  const cls = big ? 'lead-art' : 'card-art';
  if (a.imageUrl) {
    return (
      <div className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={a.imagePortrait ? 'portrait' : undefined} src={a.imageUrl} alt={a.imageAlt ?? ''} loading={big ? 'eager' : 'lazy'} decoding="async" width={big ? 1200 : 600} height={big ? 675 : 400} />
      </div>
    );
  }
  const art = SECTION_ART[a.categoryId ?? ''];
  const place = country(a.countryCode)?.names[lang];
  const label = [category(a.categoryId)?.names[lang], place].filter(Boolean).join(' · ');
  return (
    <div className={`${cls} art-fallback`} style={{ '--h': art?.hue ?? 220 } as CSSProperties} aria-hidden>
      <svg viewBox="0 0 24 24" width={big ? 72 : 44} height={big ? 72 : 44} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <path d={art?.icon ?? NEWS_ICON} />
      </svg>
      {label && <span className="art-label">{label}</span>}
    </div>
  );
}

/**
 * Cada foto, una vez por página: la del Congreso en cinco noticias de política seguidas parece
 * un error. Las repeticiones van con la portadilla de su sección. `seen` se comparte entre los
 * bloques de una misma página, en el orden en que se pintan.
 */
export function onePhotoEach<T extends { imageUrl: string | null }>(cards: T[], seen: Set<string> = new Set()): T[] {
  return cards.map((c) => {
    if (!c.imageUrl) return c;
    if (seen.has(c.imageUrl)) return { ...c, imageUrl: null };
    seen.add(c.imageUrl);
    return c;
  });
}

export function LeadCard({ a, lang, d }: P) {
  return (
    <article className="lead-story" {...expAttrs(a)}>
      <Link href={a.url} aria-label={a.headline} tabIndex={-1}>
        <Art a={a} lang={lang} big />
      </Link>
      <div className="kicker">{category(a.categoryId)?.names[lang]}</div>
      <h1>
        <Link href={a.url}>{a.headline}</Link>
      </h1>
      <p className="dek">{a.summary}</p>
      <Meta a={a} lang={lang} d={d} />
    </article>
  );
}

export function StoryCard({ a, lang, d, image = true, compact = false }: P & { image?: boolean; compact?: boolean }) {
  return (
    <article className={`card${compact ? ' card-compact' : ''}${image ? '' : ' card-text'}`} {...expAttrs(a)}>
      {image && (
        <Link href={a.url} tabIndex={-1} aria-hidden>
          <Art a={a} lang={lang} />
        </Link>
      )}
      <div className="kicker">{category(a.categoryId)?.names[lang]}</div>
      <h3 className="h">
        <Link href={a.url}>{a.headline}</Link>
      </h3>
      {!compact && <p className="s">{a.summary}</p>}
      <Meta a={a} lang={lang} d={d} />
    </article>
  );
}

export function ListItem({ a, lang, d, tz, showTime }: P & { showTime?: boolean }) {
  return (
    <li {...expAttrs(a)}>
      {showTime && (
        <time className="time tnum" dateTime={new Date(a.publishedAt).toISOString()}>
          {fmtTime(a.publishedAt, lang, tz)}
        </time>
      )}
      <Link className="h" href={a.url}>
        {a.headline}
      </Link>
      <div className="meta" style={{ marginTop: 4 }}>
        <Badges d={d} a={{ isDeveloping: a.isDeveloping, isDemo: a.isDemo }} />
      </div>
    </li>
  );
}
