import Link from 'next/link';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { absoluteUrl, breadcrumbJsonLd, collectionPageJsonLd } from '@histor/core/seo/index';
import { StoryCard, LeadCard, onePhotoEach } from '@/components/Cards';
import { HouseAd } from '@/components/HouseAd';
import { JsonLd } from '@/components/JsonLd';
import { ExperimentTracker } from '@/components/client/ExperimentTracker';
import { ReadTracker } from '@/components/client/ReadTracker';
import type { CardWithExp } from '@/lib/experiments';

export const PAGE_SIZE = 20;

export function ListingView({
  lang,
  d,
  kicker,
  title,
  intro,
  items,
  page,
  basePath,
  crumbs,
  aside,
  actions,
  emptyText,
  keys,
  compact,
}: {
  lang: string;
  d: Dict;
  kicker?: string;
  title: string;
  intro?: React.ReactNode;
  items: CardWithExp[];
  page: number;
  basePath: string;
  crumbs: { name: string; url: string }[];
  aside?: React.ReactNode;
  actions?: React.ReactNode;
  emptyText?: string;
  /** Tras la apertura, los N titulares siguientes en lista numerada («Las claves»). */
  keys?: { label: string; n: number };
  /** Cabecera corta: en el móvil la primera noticia tiene que verse sin bajar. */
  compact?: boolean;
}) {
  // Cada foto, una vez por página.
  const cards = onePhotoEach(items);
  const [first, ...others] = cards;
  const keyItems = page === 1 && keys ? others.slice(0, keys.n) : [];
  const rest = others.slice(keyItems.length);
  const hasNext = items.length >= PAGE_SIZE;
  return (
    <>
      <JsonLd data={[collectionPageJsonLd(title, absoluteUrl(basePath), items.map((a) => ({ url: absoluteUrl(a.url), name: a.headline }))), breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: absoluteUrl(c.url) })))]} />
      <ReadTracker />
      <ExperimentTracker />
      <header style={{ margin: compact ? '14px 0 4px' : '26px 0 8px' }}>
        {kicker && <div className="kicker">{kicker}</div>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: compact ? 'clamp(24px, 4vw, 36px)' : 'clamp(30px, 5vw, 44px)', margin: '4px 0', lineHeight: 1.1 }}>{title}</h1>
          {actions}
        </div>
        {intro && <div className="muted ui" style={{ fontSize: compact ? 14 : 15, maxWidth: 760 }}>{intro}</div>}
      </header>
      {aside}
      {!items.length ? (
        <p className="muted" style={{ margin: '28px 0' }}>
          {emptyText ?? d.list.empty}
        </p>
      ) : (
        <>
          {page === 1 && first && (
            <div style={{ margin: compact ? '12px 0 8px' : '20px 0 8px', maxWidth: 860 }}>
              <LeadCard a={first} lang={lang} d={d} />
            </div>
          )}
          {keyItems.length > 0 && (
            <section className="key-list" aria-label={keys!.label}>
              <h2 className="kicker">{keys!.label}</h2>
              <ol>
                {keyItems.map((a) => (
                  <li key={a.id}>
                    <Link href={a.url}>{a.headline}</Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {keyItems.length > 0 && <HouseAd lang={lang} placement="hoy" />}
          <div className="grid grid-3" style={{ marginTop: 26 }}>
            {(page === 1 ? rest : cards).map((a) => (
              <StoryCard key={a.id} a={a} lang={lang} d={d} />
            ))}
          </div>
        </>
      )}
      {(page > 1 || hasNext) && (
        <nav className="actions ui" aria-label="pagination" style={{ justifyContent: 'center', marginTop: 30 }}>
          {page > 1 && (
            <Link className="btn btn-small" href={page === 2 ? basePath : `${basePath}?page=${page - 1}`} rel="prev">
              ← {d.common.prev}
            </Link>
          )}
          {hasNext && (
            <Link className="btn btn-small" href={`${basePath}?page=${page + 1}`} rel="next">
              {d.common.next} →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
