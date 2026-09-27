import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { category } from '@histor/core/config/categories';
import { CITIES } from '@histor/core/config/cities';
import { country } from '@histor/core/config/countries';
import { ACTIVE_LANGUAGES } from '@histor/core/config/languages';
import { REGIONS } from '@histor/core/config/regions';
import { userFollows } from '@histor/core/db/schema';
import { dict, t, type Dict } from '@histor/core/i18n/dictionaries';
import { href, resolveRoute, ROUTE_WORDS, type RouteMatch, type RouteWord } from '@histor/core/i18n/routes';
import { LEGAL_PAGES } from '@histor/core/legal/pages';
import { legalVars } from '@histor/core/legal/vars';
import { cityIdByKey, getArticleDetail, getAuthorBySlug, getEntityBySlug, getSourceBySlug, listArticles, regionIdByCode, type ListOpts } from '@histor/core/services/content';
import { absoluteUrl, breadcrumbJsonLd, hreflangAlternates, newsArticleJsonLd } from '@histor/core/seo/index';
import { headlineAssignments } from '@histor/core/experiments/index';
import { JsonLd } from '@/components/JsonLd';
import { ForYou } from '@/components/client/ForYou';
import { FollowButton } from '@/components/client/Forms';
import { experimentUnit, withHeadlineTests } from '@/lib/experiments';
import { currentGeo, currentUser, db } from '@/lib/server';
import { ArticleView } from '@/views/ArticleView';
import { CorrectionsPage, HowItWorksPage, SearchPage, SourcesDirectory, StoryPage } from '@/views/InfoPages';
import { ListingView, PAGE_SIZE } from '@/views/ListingView';
import { AccountPage, LoginPage, NewslettersPage, RegisterPage, ReportPage, ResetPage, SavedPage, SubscribePage } from '@/views/ReaderPages';
import { TextPageView } from '@/views/TextPageView';

type Params = Promise<{ lang: string; path: string[] }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const route = cache((lang: string, path: string) => resolveRoute(lang, path.split('/')));
const article = cache((lang: string, slug: string) => getArticleDetail(db(), lang, slug));

/** Páginas privadas o de utilidad: no se indexan. */
const NOINDEX: RouteWord[] = ['account', 'login', 'register', 'resetPassword', 'saved', 'report'];

function pageNum(sp: Record<string, string | string[] | undefined>): number {
  const n = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  return Number.isInteger(n) && n > 1 && n < 500 ? n : 1;
}

/** hreflang para una ruta que existe en todos los idiomas. */
function alternatesFor(build: (l: string) => string, lang: string) {
  return { canonical: absoluteUrl(build(lang)), languages: hreflangAlternates(Object.fromEntries(ACTIVE_LANGUAGES.map((l) => [l, build(l)]))) };
}

function titleFor(m: RouteMatch, lang: string, d: Dict): { title: string; build?: (l: string) => string } | null {
  switch (m.kind) {
    case 'category': {
      const c = category(m.categoryId);
      return c ? { title: c.names[lang], build: (l) => href.category(l, m.categoryId) } : null;
    }
    case 'country': {
      const c = country(m.countryCode);
      return c ? { title: c.names[lang] ?? c.names.en, build: (l) => href.country(l, m.countryCode) } : null;
    }
    case 'region': {
      const r = REGIONS.find((x) => x.code === m.regionCode);
      return r ? { title: r.names[lang] ?? r.names.en, build: (l) => href.region(l, m.regionCode) } : null;
    }
    case 'city': {
      const c = CITIES.find((x) => x.key === m.cityKey);
      return c ? { title: c.names[lang] ?? c.names.en, build: (l) => href.city(l, m.cityKey) } : null;
    }
    case 'list':
      return { title: d.list[m.list], build: (l) => href.list(l, m.list) };
    case 'search':
      return { title: d.search.title, build: (l) => href.search(l) };
    case 'page': {
      const legal = LEGAL_PAGES[m.page]?.[lang];
      const names: Partial<Record<RouteWord, string>> = {
        report: d.report.title,
        newsletters: d.newsletter.title,
        subscribe: d.subscribe.title,
        account: d.nav.account,
        login: d.account.login,
        register: d.account.register,
        resetPassword: d.account.reset,
        saved: d.nav.saved,
        sources: d.source.directory,
      };
      return { title: legal?.title ?? names[m.page] ?? m.page, build: (l) => href.page(l, m.page) };
    }
    default:
      return null;
  }
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SP }): Promise<Metadata> {
  const { lang, path } = await params;
  const sp = await searchParams;
  const d = dict(lang);
  const m = route(lang, path.join('/'));
  const page = pageNum(sp);

  if (m.kind === 'article') {
    const data = await article(lang, m.slug);
    if (!data) return { title: d.notFound.title, robots: { index: false } };
    const a = data.article;
    const pub = a.publishedAt ?? a.updatedAt;
    const languages: Record<string, string> = { [lang]: href.article(lang, pub, a.slug) };
    for (const alt of data.alternates) languages[alt.language] = href.article(alt.language, alt.publishedAt ?? pub, alt.slug);
    const og = absoluteUrl(`/api/og?lang=${lang}&slug=${encodeURIComponent(a.slug)}`);
    return {
      title: a.seoTitle,
      description: a.seoDescription,
      alternates: { canonical: absoluteUrl(href.article(lang, pub, a.slug)), languages: hreflangAlternates(languages) },
      openGraph: {
        type: 'article',
        title: a.headline,
        description: a.seoDescription,
        url: absoluteUrl(href.article(lang, pub, a.slug)),
        publishedTime: pub.toISOString(),
        modifiedTime: a.updatedAt.toISOString(),
        section: category(a.categoryId)?.names[lang],
        images: [{ url: data.image?.url ?? og, width: 1200, height: 630, alt: a.headline }],
      },
      twitter: { card: 'summary_large_image', title: a.headline, description: a.seoDescription, images: [data.image?.url ?? og] },
      // Lo retirado sigue visible por transparencia pero no se promociona en buscadores.
      robots: a.status === 'retracted' || a.isDemo ? { index: false, follow: true } : undefined,
      other: { 'article:published_time': pub.toISOString(), 'article:modified_time': a.updatedAt.toISOString() },
    };
  }
  if (m.kind === 'topic' || m.kind === 'author' || m.kind === 'source' || m.kind === 'story') {
    let title = '';
    if (m.kind === 'topic') title = (await getEntityBySlug(db(), m.slug))?.name ?? '';
    if (m.kind === 'author') {
      const au = await getAuthorBySlug(db(), m.slug);
      title = au ? ((au.names as Record<string, string>)[lang] ?? au.slug) : '';
    }
    if (m.kind === 'source') title = (await getSourceBySlug(db(), m.slug))?.s.name ?? '';
    if (m.kind === 'story') title = d.article.timeline;
    if (!title) return { title: d.notFound.title, robots: { index: false } };
    const build = (l: string) => (m.kind === 'topic' ? href.topic(l, m.slug) : m.kind === 'author' ? href.author(l, m.slug) : m.kind === 'source' ? href.source(l, m.slug) : href.story(l, m.slug));
    return { title, alternates: alternatesFor(build, lang), robots: m.kind === 'story' ? { index: false, follow: true } : undefined };
  }
  const info = titleFor(m, lang, d);
  if (!info) return { title: d.notFound.title, robots: { index: false } };
  const legal = m.kind === 'page' ? LEGAL_PAGES[m.page]?.[lang] : undefined;
  const noindex = (m.kind === 'page' && NOINDEX.includes(m.page)) || m.kind === 'search' || (m.kind === 'list' && m.list === 'forYou') || page > 1;
  return {
    title: page > 1 ? `${info.title} · ${page}` : info.title,
    description: legal?.description,
    alternates: info.build ? alternatesFor(info.build, lang) : undefined,
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { lang, path } = await params;
  const sp = await searchParams;
  const d = dict(lang);
  const m = route(lang, path.join('/'));
  const geo = await currentGeo(lang);
  const tz = geo.timezone;
  const page = pageNum(sp);
  const offset = (page - 1) * PAGE_SIZE;
  const home = { name: 'Histor', url: href.home(lang) };

  const listing = async (opts: Omit<ListOpts, 'lang' | 'limit' | 'offset'>) => {
    const items = await listArticles(db(), { lang, limit: PAGE_SIZE, offset, ...opts });
    const [withExp] = await withHeadlineTests([items]);
    return withExp;
  };
  const follow = async (kind: string, ref: string) => {
    const user = await currentUser();
    const following = user ? (await db().select().from(userFollows).where(and(eq(userFollows.userId, user.id), eq(userFollows.kind, kind), eq(userFollows.ref, ref))).limit(1)).length > 0 : false;
    return (
      <FollowButton kind={kind} refId={ref} following={following} labels={{ follow: d.entity.follow, following: d.entity.following }} loginHref={user ? null : `${href.page(lang, 'login')}?next=${encodeURIComponent(`/${lang}/${path.join('/')}`)}`} />
    );
  };

  switch (m.kind) {
    case 'article': {
      const data = await article(lang, m.slug);
      if (!data) notFound();
      const a = data.article;
      const pub = a.publishedAt ?? a.updatedAt;
      const canonical = href.article(lang, pub, a.slug);
      // Fecha equivocada en la URL: redirige a la canónica (los slugs no cambian).
      if (canonical !== `/${lang}/${path.join('/')}`) permanentRedirect(canonical);
      const unit = await experimentUnit();
      const assigned = (await headlineAssignments(db(), [a.id], unit)).get(a.id);
      const cat = category(a.categoryId);
      return (
        <>
          <JsonLd
            data={[
              newsArticleJsonLd({
                language: lang,
                slug: a.slug,
                headline: a.headline,
                summary: a.summary,
                bodyText: a.bodyText,
                publishedAt: pub,
                updatedAt: a.updatedAt,
                wordCount: a.wordCount,
                categoryName: cat?.names[lang],
                authorName: data.author ? ((data.author.names as Record<string, string>)[lang] ?? data.author.slug) : 'Histor',
                authorSlug: data.author?.slug ?? 'redaccion',
                authorKind: data.author?.kind === 'human' && data.author.verifiedIdentity ? 'human' : 'desk',
                authorSameAs: data.author?.sameAs,
                imageUrl: data.image?.url,
                sources: a.sourcesList.map((s) => ({ name: s.name, url: s.url })),
                corrections: data.corrections.filter((c) => c.kind !== 'update').map((c) => ({ note: c.note, createdAt: c.createdAt })),
                retracted: a.status === 'retracted',
                isDemo: a.isDemo,
                keywords: data.entities.map((e) => e.name),
                placeName: country(a.countryCode)?.names[lang] ?? null,
              }),
              breadcrumbJsonLd([
                { name: 'Histor', url: absoluteUrl(href.home(lang)) },
                ...(cat ? [{ name: cat.names[lang], url: absoluteUrl(href.category(lang, cat.id)) }] : []),
                { name: a.headline, url: absoluteUrl(canonical) },
              ]),
            ]}
          />
          <ArticleView data={data} lang={lang} d={d} tz={tz} experiment={assigned ? { key: assigned.exp, variant: assigned.variant, headline: assigned.headline } : undefined} />
        </>
      );
    }

    case 'category': {
      const c = category(m.categoryId)!;
      const items = await listing({ categoryId: c.id });
      return <ListingView lang={lang} d={d} kicker={d.nav.sections} title={c.names[lang]} items={items} page={page} basePath={href.category(lang, c.id)} crumbs={[home, { name: c.names[lang], url: href.category(lang, c.id) }]} actions={await follow('category', c.id)} />;
    }

    case 'country': {
      const c = country(m.countryCode)!;
      const items = await listing({ countryCode: c.code, orderBy: page === 1 ? 'importance' : 'recent', since: page === 1 ? new Date(Date.now() - 7 * 86400000) : undefined });
      const regions = REGIONS.filter((r) => r.countryCode === c.code);
      const cities = CITIES.filter((x) => x.countryCode === c.code && x.population >= 300_000).slice(0, 24);
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={d.nav.edition}
          title={c.names[lang] ?? c.names.en}
          items={items}
          page={page}
          basePath={href.country(lang, c.code)}
          crumbs={[home, { name: c.names[lang] ?? c.names.en, url: href.country(lang, c.code) }]}
          actions={await follow('country', c.code)}
          aside={
            (regions.length > 0 || cities.length > 0) && (
              <nav className="tag-list" aria-label={d.nav.local} style={{ margin: '10px 0' }}>
                {(regions.length ? regions.map((r) => ({ k: r.code, n: r.names[lang] ?? r.names.en, h: href.region(lang, r.code) })) : cities.map((x) => ({ k: x.key, n: x.names[lang] ?? x.names.en, h: href.city(lang, x.key) }))).map((x) => (
                  <a key={x.k} href={x.h}>
                    {x.n}
                  </a>
                ))}
              </nav>
            )
          }
        />
      );
    }

    case 'region': {
      const r = REGIONS.find((x) => x.code === m.regionCode)!;
      const id = await regionIdByCode(db(), r.code);
      const items = id ? await listing({ regionId: id }) : [];
      const cities = CITIES.filter((x) => x.regionCode === r.code);
      const c = country(r.countryCode)!;
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={c.names[lang] ?? c.names.en}
          title={r.names[lang] ?? r.names.en}
          items={items}
          page={page}
          basePath={href.region(lang, r.code)}
          crumbs={[home, { name: c.names[lang] ?? c.names.en, url: href.country(lang, c.code) }, { name: r.names[lang] ?? r.names.en, url: href.region(lang, r.code) }]}
          actions={await follow('region', r.code)}
          aside={
            cities.length > 0 && (
              <nav className="tag-list" aria-label={d.nav.local} style={{ margin: '10px 0' }}>
                {cities.map((x) => (
                  <a key={x.key} href={href.city(lang, x.key)}>
                    {x.names[lang] ?? x.names.en}
                  </a>
                ))}
              </nav>
            )
          }
        />
      );
    }

    case 'city': {
      const city = CITIES.find((x) => x.key === m.cityKey)!;
      const id = await cityIdByKey(db(), city.key);
      const items = id ? await listing({ cityId: id }) : [];
      const c = country(city.countryCode)!;
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={`${d.nav.local} · ${c.names[lang] ?? c.names.en}`}
          title={city.names[lang] ?? city.names.en}
          items={items}
          page={page}
          basePath={href.city(lang, city.key)}
          crumbs={[home, { name: c.names[lang] ?? c.names.en, url: href.country(lang, c.code) }, { name: city.names[lang] ?? city.names.en, url: href.city(lang, city.key) }]}
          actions={await follow('city', city.key)}
        />
      );
    }

    case 'topic': {
      const e = await getEntityBySlug(db(), m.slug);
      if (!e) notFound();
      const items = await listing({ entityId: e.id });
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={d.entity.topic}
          title={e.name}
          intro={(e.description as Record<string, string>)[lang]}
          items={items}
          page={page}
          basePath={href.topic(lang, e.slug)}
          crumbs={[home, { name: e.name, url: href.topic(lang, e.slug) }]}
          actions={await follow('entity', e.slug)}
        />
      );
    }

    case 'author': {
      const au = await getAuthorBySlug(db(), m.slug);
      if (!au) notFound();
      const name = (au.names as Record<string, string>)[lang] ?? au.slug;
      const items = await listing({ authorId: au.id });
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={au.kind === 'desk' ? d.author.desk : d.label.by}
          title={name}
          intro={
            <>
              <p style={{ margin: '4px 0' }}>{(au.bio as Record<string, string>)[lang]}</p>
              {au.kind === 'desk' && <p style={{ margin: '4px 0' }}>{d.author.notAPerson}</p>}
            </>
          }
          items={items}
          page={page}
          basePath={href.author(lang, au.slug)}
          crumbs={[home, { name, url: href.author(lang, au.slug) }]}
        />
      );
    }

    case 'source': {
      const row = await getSourceBySlug(db(), m.slug);
      if (!row) notFound();
      const { s, r } = row;
      const items = await listing({ sourceId: s.id });
      const rel = r ? Math.round((r.alpha / (r.alpha + r.beta)) * 100) : null;
      return (
        <ListingView
          lang={lang}
          d={d}
          kicker={d.source.title}
          title={s.name}
          intro={
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '8px 0' }}>
              <dt>{d.source.type}</dt>
              <dd style={{ margin: 0 }}>{(d.source.typeNames as Record<string, string>)[s.sourceType] ?? s.sourceType}</dd>
              {s.countryCode && (
                <>
                  <dt>{d.source.country}</dt>
                  <dd style={{ margin: 0 }}>{country(s.countryCode)?.names[lang] ?? s.countryCode}</dd>
                </>
              )}
              {rel !== null && (
                <>
                  <dt>{d.source.reliability}</dt>
                  <dd style={{ margin: 0 }}>
                    {rel} % · ✓ {r!.confirmedCount} · ✕ {r!.contradictedCount}
                  </dd>
                </>
              )}
              <dt>Web</dt>
              <dd style={{ margin: 0 }}>
                <a href={s.homepageUrl} rel="noopener nofollow" target="_blank">
                  {s.homepageUrl.replace(/^https?:\/\//, '')}
                </a>
              </dd>
            </dl>
          }
          items={items}
          page={page}
          basePath={href.source(lang, s.slug)}
          crumbs={[home, { name: d.source.directory, url: href.page(lang, 'sources') }, { name: s.name, url: href.source(lang, s.slug) }]}
          emptyText={d.list.empty}
        />
      );
    }

    case 'story': {
      const view = await StoryPage({ lang, d, slug: m.slug, tz });
      if (!view) notFound();
      return view;
    }

    case 'list': {
      const base = href.list(lang, m.list);
      if (m.list === 'forYou') {
        const items = await listing({ orderBy: 'importance', since: new Date(Date.now() - 48 * 3600000) });
        return (
          <>
            <ForYou lang={lang} labels={{ title: d.home.forYou, explain: d.home.forYouExplain, seeAll: d.home.seeAll }} seeAllHref={base} limit={12} />
            <ListingView lang={lang} d={d} title={d.home.topStory} intro={t(d.home.forYouExplain, {})} items={items} page={page} basePath={base} crumbs={[home, { name: d.list.forYou, url: base }]} />
          </>
        );
      }
      const items =
        m.list === 'breaking'
          ? await listing({ breaking: true, since: new Date(Date.now() - 48 * 3600000) })
          : m.list === 'trending'
            ? await listing({ orderBy: 'momentum', since: new Date(Date.now() - 72 * 3600000) })
            : await listing({});
      return <ListingView lang={lang} d={d} title={d.list[m.list]} items={items} page={page} basePath={base} crumbs={[home, { name: d.list[m.list], url: base }]} />;
    }

    case 'search':
      return <SearchPage lang={lang} d={d} sp={sp} />;

    case 'page': {
      switch (m.page) {
        case 'login':
          return <LoginPage lang={lang} d={d} sp={sp} />;
        case 'register':
          return <RegisterPage lang={lang} d={d} />;
        case 'resetPassword':
          return <ResetPage lang={lang} d={d} sp={sp} />;
        case 'account':
          return <AccountPage lang={lang} d={d} sp={sp} />;
        case 'saved':
          return <SavedPage lang={lang} d={d} />;
        case 'subscribe':
          return <SubscribePage lang={lang} d={d} sp={sp} />;
        case 'newsletters':
          return <NewslettersPage lang={lang} d={d} sp={sp} />;
        case 'report':
          return <ReportPage d={d} sp={sp} />;
        case 'sources':
          return <SourcesDirectory lang={lang} d={d} />;
        case 'corrections':
          return <CorrectionsPage lang={lang} d={d} tz={tz} />;
        case 'howItWorks':
          return <HowItWorksPage lang={lang} d={d} />;
        default: {
          const legal = LEGAL_PAGES[m.page]?.[lang] ?? LEGAL_PAGES[m.page]?.en;
          if (!legal) notFound();
          return <TextPageView page={legal} vars={legalVars(lang)} />;
        }
      }
    }

    default:
      // Palabra de ruta de otro idioma (p. ej. /es/search): redirige a la de este idioma.
      if (path.length === 1) {
        for (const byLang of Object.values(ROUTE_WORDS) as Record<string, string>[]) {
          if (Object.values(byLang).includes(path[0]) && byLang[lang] && byLang[lang] !== path[0]) permanentRedirect(`/${lang}/${byLang[lang]}`);
        }
      }
      notFound();
  }
}
