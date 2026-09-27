import Link from 'next/link';
import { CATEGORIES } from '@histor/core/config/categories';
import { country } from '@histor/core/config/countries';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { LEGAL_PAGES } from '@histor/core/legal/pages';
import { legalVars } from '@histor/core/legal/vars';
import { getStoryTimeline, listPublicSources, recentCorrections, searchArticles, transparencyStats } from '@histor/core/services/content';
import { getSourceTypeWeights } from '@histor/core/services/settings';
import { StoryCard } from '@/components/Cards';
import { ReadTracker } from '@/components/client/ReadTracker';
import { fmtDateTime } from '@/lib/format';
import { db } from '@/lib/server';
import { TextPageView } from './TextPageView';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function SearchPage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  const q = one(sp.q).slice(0, 200);
  const cat = one(sp.cat);
  const when = one(sp.when);
  const since = when === 'day' ? new Date(Date.now() - 86400000) : when === 'week' ? new Date(Date.now() - 7 * 86400000) : undefined;
  const res = q ? await searchArticles(db(), lang, q, { categoryId: CATEGORIES.some((c) => c.id === cat) ? cat : undefined, since, limit: 30 }) : null;
  return (
    <section style={{ padding: '26px 0' }}>
      <ReadTracker />
      <h1 style={{ fontSize: 40, margin: '0 0 14px' }}>{d.search.title}</h1>
      <form role="search" action={href.search(lang)} method="get" className="form" style={{ maxWidth: 760, gridTemplateColumns: 'minmax(0,1fr)' }}>
        <label>
          <span className="sr-only">{d.search.title}</span>
          <input type="search" name="q" defaultValue={q} placeholder={d.search.placeholder} maxLength={200} autoFocus={!q} />
        </label>
        <div className="row">
          <select name="cat" defaultValue={cat} aria-label={d.search.filters} style={{ width: 'auto' }}>
            <option value="">{d.search.anyCategory}</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.names[lang]}
              </option>
            ))}
          </select>
          <select name="when" defaultValue={when} aria-label={d.search.filters} style={{ width: 'auto' }}>
            <option value="">{d.search.anyTime}</option>
            <option value="day">{d.search.lastDay}</option>
            <option value="week">{d.search.lastWeek}</option>
          </select>
          <button className="btn btn-solid">{d.search.submit}</button>
        </div>
      </form>
      {res && (
        <>
          <p className="muted ui" role="status" style={{ marginTop: 22 }}>
            {res.items.length ? t(d.search.results, { n: res.total, q }) : t(d.search.none, { q })}
          </p>
          <div className="grid grid-3">
            {res.items.map((a) => (
              <StoryCard key={a.id} a={a} lang={lang} d={d} compact />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export async function SourcesDirectory({ lang, d }: { lang: string; d: Dict }) {
  const rows = await listPublicSources(db());
  const weights = await getSourceTypeWeights(db());
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.s.sourceType, [...(groups.get(r.s.sourceType) ?? []), r]);
  const order = Object.keys(d.source.typeNames);
  const types = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return (
    <section className="page" style={{ maxWidth: 920 }}>
      <h1>{d.source.directory}</h1>
      <p className="muted ui" style={{ fontSize: 16 }}>
        {d.source.directoryIntro}
      </p>
      {types.map((type) => {
        const w = weights[type];
        return (
          <section key={type}>
            <h2>
              {(d.source.typeNames as Record<string, string>)[type] ?? type}{' '}
              {w && (
                <span className="muted ui" style={{ fontSize: 14, fontWeight: 400 }}>
                  · {Math.round(w.weight * 100)} %{!w.credible && ' · ⚠'}
                </span>
              )}
            </h2>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {groups.get(type)!.map(({ s, r }) => {
                    const rel = r ? r.alpha / (r.alpha + r.beta) : null;
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link href={href.source(lang, s.slug)}>{s.name}</Link>
                          {s.isSatire && <span className="badge badge-review" style={{ marginLeft: 6 }}>satire</span>}
                          {s.isDemo && <span className="badge badge-demo" style={{ marginLeft: 6 }}>{d.label.demo}</span>}
                        </td>
                        <td>{s.countryCode ? (country(s.countryCode)?.names[lang] ?? s.countryCode) : '—'}</td>
                        <td>{s.languages.join(', ')}</td>
                        <td style={{ minWidth: 90 }}>
                          {rel !== null && (
                            <div className="bar" title={`${Math.round(rel * 100)} %`}>
                              <span style={{ width: `${Math.round(rel * 100)}%` }} />
                            </div>
                          )}
                        </td>
                        <td>
                          <a href={s.homepageUrl} rel="noopener nofollow" target="_blank">
                            ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </section>
  );
}

export async function CorrectionsPage({ lang, d, tz }: { lang: string; d: Dict; tz: string }) {
  const page = LEGAL_PAGES.corrections?.[lang] ?? LEGAL_PAGES.corrections!.en;
  const list = await recentCorrections(db(), lang, 100);
  const KIND: Record<string, string> = { correction: d.label.correction, clarification: d.label.clarification, retraction: d.label.retracted };
  return (
    <TextPageView page={page} vars={legalVars(lang)}>
      <h2>{d.article.corrections}</h2>
      {!list.length ? (
        <p className="muted">{d.list.empty}</p>
      ) : (
        <ul className="list">
          {list.map((c, i) => (
            <li key={i}>
              <div className="meta">
                <span className={`badge ${c.kind === 'retraction' ? 'badge-retracted' : 'badge-developing'}`}>{KIND[c.kind] ?? c.kind}</span>
                <time className="tnum">{fmtDateTime(c.createdAt, lang, tz)}</time>
              </div>
              <Link className="h" href={href.article(c.language, c.publishedAt ?? c.createdAt, c.slug)}>
                {c.headline}
              </Link>
              <p className="ui" style={{ fontSize: 15, margin: '4px 0 0' }}>
                {c.note}
              </p>
            </li>
          ))}
        </ul>
      )}
    </TextPageView>
  );
}

export async function StoryPage({ lang, d, slug, tz }: { lang: string; d: Dict; slug: string; tz: string }) {
  const data = await getStoryTimeline(db(), slug, lang);
  if (!data) return null;
  const { story, article, items, versions } = data;
  return (
    <section className="article">
      <div className="kicker">{d.article.timeline}</div>
      <h1 style={{ fontSize: 'clamp(28px,4.5vw,40px)', lineHeight: 1.1 }}>{article?.headline ?? story.headlineHint}</h1>
      {article && article.status !== 'draft' && (
        <p>
          <Link className="btn btn-small" href={href.article(article.language, article.publishedAt ?? article.updatedAt, article.slug)}>
            → {d.list.latest}
          </Link>
        </p>
      )}
      <h2 className="kicker" style={{ color: 'var(--ink)', fontSize: 14, marginTop: 26 }}>
        {d.article.sources}
      </h2>
      <ol className="timeline">
        {items.map((it, i) => (
          <li key={i}>
            <time className="tnum muted" dateTime={new Date(it.at).toISOString()}>
              {fmtDateTime(it.at, lang, tz)}
            </time>{' '}
            — <Link href={href.source(lang, it.sourceSlug)}>{it.source}</Link> <span className="muted">({(d.source.typeNames as Record<string, string>)[it.sourceType] ?? it.sourceType})</span>
            {it.isCopy && <span className="muted"> · copy</span>}{' '}
            <a href={it.url} rel="noopener nofollow" target="_blank">
              ↗
            </a>
          </li>
        ))}
      </ol>
      {versions.length > 0 && (
        <>
          <h2 className="kicker" style={{ color: 'var(--ink)', fontSize: 14, marginTop: 26 }}>
            {d.article.history}
          </h2>
          <ol className="timeline">
            {versions.map((v) => (
              <li key={v.version}>
                <strong>{t(d.article.version, { n: v.version })}</strong> · <span className="muted tnum">{fmtDateTime(v.createdAt, lang, tz)}</span>
                <div>{v.changeSummary ?? v.kind}</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** «Cómo funciona» con las cifras reales: lo que se descarta y se corrige también se cuenta. */
export async function HowItWorksPage({ lang, d }: { lang: string; d: Dict }) {
  const page = LEGAL_PAGES.howItWorks?.[lang] ?? LEGAL_PAGES.howItWorks!.en;
  const s = await transparencyStats(db(), 30);
  const T = d.transparency;
  const rows: [string, number][] = [
    [T.analysed, s.analysed],
    [T.published, s.published],
    [T.rejected, s.rejected],
    [T.held, s.held],
    [T.updates, s.updates],
    [T.corrections, s.corrections],
    [T.retractions, s.retractions],
    [T.sources, s.activeSources],
  ];
  return (
    <TextPageView page={page} vars={legalVars(lang)}>
      <section aria-labelledby="stats-h" className="verify" style={{ marginTop: 32 }}>
        <h2 id="stats-h">{t(T.title, { n: s.days })}</h2>
        <table className="table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>
                  {value.toLocaleString(lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </TextPageView>
  );
}
