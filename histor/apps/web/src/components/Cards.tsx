import Link from 'next/link';
import { category } from '@histor/core/config/categories';
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
      <Badges d={d} a={{ isBreaking: a.isBreaking, isDeveloping: a.isDeveloping, isDemo: a.isDemo, verified: a.evidenceConfidence >= 0.75 }} />
      <time dateTime={new Date(a.updatedAt).toISOString()} className="tnum">
        {fmtRelative(a.updatedAt, lang)}
      </time>
      {a.sourcesCount > 0 && <span>· {t(d.label.sources, { n: a.sourcesCount })}</span>}
    </div>
  );
}

/**
 * Solo se muestra imagen si hay una fotografía con licencia verificada. Sin
 * ella, la tarjeta es tipográfica (como un periódico impreso): nunca se
 * rellena con imágenes que puedan confundirse con el acontecimiento.
 */
function Art({ a, big }: { a: ArticleCard; big?: boolean }) {
  if (!a.imageUrl) return null;
  return (
    <div className={big ? 'lead-art' : 'card-art'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.imageUrl} alt={a.imageAlt ?? ''} loading={big ? 'eager' : 'lazy'} decoding="async" width={big ? 1200 : 600} height={big ? 675 : 400} />
    </div>
  );
}

export function LeadCard({ a, lang, d }: P) {
  return (
    <article className="lead-story" {...expAttrs(a)}>
      {a.imageUrl && (
        <Link href={a.url} aria-label={a.headline}>
          <Art a={a} big />
        </Link>
      )}
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
    <article className={`card${compact ? ' card-compact' : ''}${image && a.imageUrl ? '' : ' card-text'}`} {...expAttrs(a)}>
      {image && a.imageUrl && (
        <Link href={a.url} tabIndex={-1} aria-hidden>
          <Art a={a} />
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
