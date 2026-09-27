import Link from 'next/link';
import { category } from '@histor/core/config/categories';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import type { ArticleCard } from '@histor/core/services/content';
import { fmtRelative, fmtTime } from '@/lib/format';
import { Badges } from './Badges';
import { TypoCard } from './TypoCard';

type P = { a: ArticleCard; lang: string; d: Dict; tz?: string };

function Meta({ a, lang, d }: P) {
  return (
    <div className="meta">
      <Badges d={d} a={{ isBreaking: a.isBreaking, isDeveloping: a.isDeveloping, isDemo: a.isDemo, verified: a.evidenceConfidence >= 0.75 }} />
      <time dateTime={new Date(a.updatedAt).toISOString()} className="tnum">
        {fmtRelative(a.updatedAt, lang)}
      </time>
      {a.sourcesCount > 0 && <span>· {t(d.label.sources, { n: a.sourcesCount })}</span>}
    </div>
  );
}

function Art({ a, lang, big }: { a: ArticleCard; lang: string; big?: boolean }) {
  const cat = category(a.categoryId)?.names[lang];
  return (
    <div className={big ? 'lead-art' : 'card-art'}>
      {a.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.imageUrl} alt={a.imageAlt ?? ''} loading={big ? 'eager' : 'lazy'} decoding="async" width={big ? 1200 : 600} height={big ? 675 : 400} />
      ) : (
        <TypoCard category={cat} label={cat ?? 'Histor'} />
      )}
    </div>
  );
}

export function LeadCard({ a, lang, d }: P) {
  return (
    <article className="lead-story">
      <Link href={a.url} aria-label={a.headline}>
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
    <article className={`card${compact ? ' card-compact' : ''}`}>
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
    <li>
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
