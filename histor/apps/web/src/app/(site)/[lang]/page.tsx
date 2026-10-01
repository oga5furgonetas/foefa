import type { Metadata } from 'next';
import Link from 'next/link';
import { category } from '@histor/core/config/categories';
import { country } from '@histor/core/config/countries';
import { CITIES } from '@histor/core/config/cities';
import { dict } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { getHome } from '@histor/core/services/content';
import { absoluteUrl, organizationJsonLd, websiteJsonLd, hreflangAlternates } from '@histor/core/seo/index';
import { ACTIVE_LANGUAGES } from '@histor/core/config/languages';
import { LeadCard, ListItem, StoryCard } from '@/components/Cards';
import { JsonLd } from '@/components/JsonLd';
import { ForYou } from '@/components/client/ForYou';
import { ReadTracker } from '@/components/client/ReadTracker';
import { ExperimentTracker } from '@/components/client/ExperimentTracker';
import { withHeadlineTests } from '@/lib/experiments';
import { currentGeo, db } from '@/lib/server';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const d = dict(lang);
  return {
    title: { absolute: `Histor — ${d.tagline}` },
    alternates: { canonical: absoluteUrl(href.home(lang)), languages: hreflangAlternates(Object.fromEntries(ACTIVE_LANGUAGES.map((l) => [l, href.home(l)])), '/') },
    openGraph: { title: `Histor — ${d.tagline}`, description: d.footer.about, url: absoluteUrl(href.home(lang)) },
  };
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const d = dict(lang);
  const geo = await currentGeo(lang);
  const raw = await getHome(db(), { lang, countryCode: geo.countryCode, regionCode: geo.regionCode, cityKey: geo.cityKey });
  // Titulares A/B (solo con consentimiento de medición; el ganador lo decide la lectura real).
  const [top, secondary, breaking, latest, trending, national, local, world, ...sectionItems] = await withHeadlineTests([
    raw.top ? [raw.top] : [],
    raw.secondary,
    raw.breaking,
    raw.latest,
    raw.trending,
    raw.national,
    raw.local,
    raw.world,
    ...raw.sections.map((s) => s.items),
  ]);
  // Cada noticia aparece una sola vez en la portada (la columna lateral cuenta).
  const seen = new Set<number>();
  const take = <T extends { id: number }>(xs: T[], n: number) => {
    const out = xs.filter((x) => !seen.has(x.id)).slice(0, n);
    out.forEach((x) => seen.add(x.id));
    return out;
  };
  const lead = top[0] ?? null;
  if (lead) seen.add(lead.id);
  const second = take(secondary, 3);
  const sideItems = take(breaking.length ? breaking : latest, 6);
  const home = {
    top: lead,
    breaking,
    side: sideItems,
    local: take(local, 3),
    national: take(national, 4),
    latest: take(latest, 8),
    trending: take(trending, 3),
    world: take(world, 4),
    sections: raw.sections.map((s, i) => ({ ...s, items: take(sectionItems[i], 4) })).filter((s) => s.items.length > 0),
  };
  const edition = country(geo.countryCode);
  const city = geo.cityKey ? CITIES.find((c) => c.key === geo.cityKey) : null;
  const side = home.side;
  const empty = !home.top;

  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd(lang)]} />
      <ReadTracker />
      <ExperimentTracker />
      <h1 className="sr-only">Histor — {d.tagline}</h1>
      {empty ? (
        <section className="page">
          <p>{d.home.empty}</p>
          <p className="muted ui">{d.home.trustLine}</p>
        </section>
      ) : (
        <>
          <div className="front">
            <div>
              <LeadCard a={home.top!} lang={lang} d={d} />
              {second.length > 0 && (
                <div className="grid grid-3 lead-row">
                  {second.map((a) => (
                    <StoryCard key={a.id} a={a} lang={lang} d={d} compact />
                  ))}
                </div>
              )}
              <div className="trust">
                <span aria-hidden>✓</span> {d.home.trustLine}{' '}
                <Link href={href.page(lang, 'howItWorks')}>{d.footer.howItWorks} →</Link>
              </div>
            </div>
            <aside className="side-list" aria-label={home.breaking.length ? d.home.breakingNow : d.home.latest}>
              <h2>
                {home.breaking.length ? (
                  <>
                    <span className="dot pulse" style={{ color: 'var(--accent)' }} aria-hidden /> {d.home.breakingNow}
                  </>
                ) : (
                  d.home.latest
                )}
              </h2>
              <ol className="list">
                {side.map((a) => (
                  <ListItem key={a.id} a={a} lang={lang} d={d} tz={geo.timezone} showTime />
                ))}
              </ol>
            </aside>
          </div>

          <ForYou lang={lang} labels={{ title: d.home.forYou, explain: d.home.forYouExplain, seeAll: d.home.seeAll }} seeAllHref={href.list(lang, 'forYou')} />

          {home.local.length > 0 && (
            <Section title={city ? `${d.home.local} · ${city.names[lang] ?? city.names.en}` : d.home.local} more={city ? href.city(lang, city.key) : undefined} moreLabel={d.home.seeAll}>
              <div className="grid grid-3">
                {home.local.map((a) => (
                  <StoryCard key={a.id} a={a} lang={lang} d={d} />
                ))}
              </div>
            </Section>
          )}

          {home.national.length > 0 && edition && (
            <Section title={edition.names[lang] ?? edition.names.en} more={href.country(lang, edition.code)} moreLabel={d.home.seeAll}>
              <div className="grid grid-4">
                {home.national.map((a) => (
                  <StoryCard key={a.id} a={a} lang={lang} d={d} />
                ))}
              </div>
            </Section>
          )}

          {/* Primero tu país; justo después, el mundo (lo que no es de tu país). */}
          {home.world.length > 0 && (
            <Section title={d.home.world} more={href.category(lang, 'world')} moreLabel={d.home.seeAll}>
              <div className="grid grid-4">
                {home.world.map((a) => (
                  <StoryCard key={a.id} a={a} lang={lang} d={d} />
                ))}
              </div>
            </Section>
          )}

          {home.latest.length > 0 && (
          <Section title={d.home.latest} more={href.list(lang, 'latest')} moreLabel={d.home.seeAll}>
            <div className="grid grid-4">
              {home.latest.map((a) => (
                <StoryCard key={a.id} a={a} lang={lang} d={d} image={false} compact />
              ))}
            </div>
          </Section>
          )}

          {home.trending.length > 0 && (
            <Section title={d.home.trending} more={href.list(lang, 'trending')} moreLabel={d.home.seeAll}>
              <div className="grid grid-3">
                {home.trending.map((a) => (
                  <StoryCard key={a.id} a={a} lang={lang} d={d} />
                ))}
              </div>
            </Section>
          )}

          {home.sections.map((s) => (
            <Section key={s.categoryId} title={category(s.categoryId)?.names[lang] ?? s.categoryId} more={href.category(lang, s.categoryId)} moreLabel={d.home.seeAll}>
              <div className="grid grid-4">
                {s.items.map((a) => (
                  <StoryCard key={a.id} a={a} lang={lang} d={d} compact />
                ))}
              </div>
            </Section>
          ))}
        </>
      )}
    </>
  );
}

function Section({ title, more, moreLabel, children }: { title: string; more?: string; moreLabel: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="section-head">
        <h2>{title}</h2>
        {more && <Link href={more}>{moreLabel} →</Link>}
      </div>
      {children}
    </section>
  );
}
