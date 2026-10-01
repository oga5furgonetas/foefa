/**
 * SEO técnico: datos estructurados (schema.org), sitemaps, News Sitemap,
 * hreflang y RSS propio. Todo determinista (sin IA) y probado.
 * Principio: cada página indexable debe aportar valor real; las páginas
 * finas (búsquedas, temas con pocas noticias, contenido DEMO) van con noindex.
 */
import { ACTIVE_LANGUAGES, languageDef } from '../config/languages';
import { env } from '../env';
import { href } from '../i18n/routes';

export const BRAND = { name: 'Histor', legalName: () => env().LEGAL_ENTITY_NAME ?? null };

export function absoluteUrl(path: string): string {
  const base = env().PUBLIC_BASE_URL.replace(/\/$/, '');
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** JSON seguro para <script type="application/ld+json"> (evita cerrar la etiqueta). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function organizationJsonLd() {
  const legal = BRAND.legalName();
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': absoluteUrl('/#organization'),
    name: BRAND.name,
    ...(legal ? { legalName: legal } : {}),
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png'), width: 512, height: 512 },
    publishingPrinciples: absoluteUrl(href.page('en', 'editorialPolicy')),
    correctionsPolicy: absoluteUrl(href.page('en', 'corrections')),
    verificationFactCheckingPolicy: absoluteUrl(href.page('en', 'howItWorks')),
    ethicsPolicy: absoluteUrl(href.page('en', 'editorialPolicy')),
    ...(env().CONTACT_EMAIL ? { email: env().CONTACT_EMAIL } : {}),
  };
}

export function websiteJsonLd(lang: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl(`/${lang}#website`),
    name: BRAND.name,
    url: absoluteUrl(`/${lang}`),
    inLanguage: languageDef(lang).locale,
    publisher: { '@id': absoluteUrl('/#organization') },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl(href.search(lang))}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.url) })),
  };
}

export type ArticleForSeo = {
  language: string;
  slug: string;
  headline: string;
  summary: string;
  bodyText: string;
  publishedAt: Date;
  updatedAt: Date;
  wordCount: number;
  categoryName?: string | null;
  authorName: string;
  authorSlug: string;
  authorKind: 'desk' | 'human';
  authorSameAs?: string[];
  imageUrl?: string | null;
  sources: { name: string; url: string }[];
  corrections: { note: string; createdAt: Date }[];
  retracted: boolean;
  isDemo: boolean;
  keywords: string[];
  placeName?: string | null;
};

export function newsArticleJsonLd(a: ArticleForSeo) {
  const url = absoluteUrl(href.article(a.language, a.publishedAt, a.slug));
  // Histor no inventa periodistas: si el autor es una mesa automatizada se declara como Organization.
  const author =
    a.authorKind === 'human'
      ? { '@type': 'Person', name: a.authorName, url: absoluteUrl(href.author(a.language, a.authorSlug)), ...(a.authorSameAs?.length ? { sameAs: a.authorSameAs } : {}) }
      : { '@type': 'Organization', name: a.authorName, url: absoluteUrl(href.author(a.language, a.authorSlug)) };
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: a.headline.slice(0, 110),
    description: a.summary,
    inLanguage: languageDef(a.language).locale,
    datePublished: a.publishedAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    wordCount: a.wordCount,
    articleSection: a.categoryName ?? undefined,
    keywords: a.keywords.join(', ') || undefined,
    author,
    // El editor completo (nombre y logo): Google solo resuelve el @id dentro de la misma página, y
    // en una noticia la organización no está; sin nombre ni logo no entra en «Noticias destacadas».
    publisher: { '@type': 'NewsMediaOrganization', '@id': absoluteUrl('/#organization'), name: BRAND.name, url: absoluteUrl('/'), logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png'), width: 512, height: 512 } },
    image: a.imageUrl ? [a.imageUrl] : [absoluteUrl(`/api/og?lang=${a.language}&slug=${encodeURIComponent(a.slug)}`)],
    isAccessibleForFree: true,
    citation: a.sources.map((s) => ({ '@type': 'CreativeWork', name: s.name, url: s.url })),
    ...(a.placeName ? { contentLocation: { '@type': 'Place', name: a.placeName } } : {}),
    ...(a.corrections.length
      ? { correction: a.corrections.map((c) => ({ '@type': 'CorrectionComment', text: c.note, datePublished: c.createdAt.toISOString() })) }
      : {}),
    ...(a.retracted ? { creativeWorkStatus: 'Retracted' } : {}),
  };
}

export function collectionPageJsonLd(name: string, url: string, items: { url: string; name: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(url),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.slice(0, 20).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(it.url), name: it.name })),
    },
  };
}

/** Alternativas hreflang: una por idioma disponible + x-default. */
export function hreflangAlternates(paths: Partial<Record<string, string>>, xDefault?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lang of ACTIVE_LANGUAGES) {
    const p = paths[lang];
    if (p) out[languageDef(lang).hreflang] = absoluteUrl(p);
  }
  if (xDefault) out['x-default'] = absoluteUrl(xDefault);
  return out;
}

export function sitemapIndexXml(entries: { loc: string; lastmod?: Date }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `<sitemap><loc>${xmlEscape(absoluteUrl(e.loc))}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</sitemap>`).join('\n')}
</sitemapindex>`;
}

export function urlsetXml(entries: { loc: string; lastmod?: Date; alternates?: Record<string, string> }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) =>
      `<url><loc>${xmlEscape(absoluteUrl(e.loc))}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}${Object.entries(e.alternates ?? {})
        .map(([hl, u]) => `<xhtml:link rel="alternate" hreflang="${hl}" href="${xmlEscape(u)}"/>`)
        .join('')}</url>`,
  )
  .join('\n')}
</urlset>`;
}

/** Google News sitemap: solo artículos de las últimas 48 horas. */
export function newsSitemapXml(items: { loc: string; language: string; title: string; publishedAt: Date }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items
  .map(
    (i) =>
      `<url><loc>${xmlEscape(absoluteUrl(i.loc))}</loc><news:news><news:publication><news:name>${BRAND.name}</news:name><news:language>${i.language}</news:language></news:publication><news:publication_date>${i.publishedAt.toISOString()}</news:publication_date><news:title>${xmlEscape(i.title)}</news:title></news:news></url>`,
  )
  .join('\n')}
</urlset>`;
}

export function rssXml(opts: { lang: string; title: string; link: string; description: string; items: { title: string; link: string; description: string; publishedAt: Date; guid: string }[] }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xmlEscape(opts.title)}</title>
<link>${xmlEscape(absoluteUrl(opts.link))}</link>
<atom:link href="${xmlEscape(absoluteUrl(`/${opts.lang}/rss.xml`))}" rel="self" type="application/rss+xml"/>
<description>${xmlEscape(opts.description)}</description>
<language>${languageDef(opts.lang).locale}</language>
${opts.items
  .map(
    (i) => `<item><title>${xmlEscape(i.title)}</title><link>${xmlEscape(absoluteUrl(i.link))}</link><guid isPermaLink="false">${xmlEscape(i.guid)}</guid><pubDate>${i.publishedAt.toUTCString()}</pubDate><description>${xmlEscape(i.description)}</description></item>`,
  )
  .join('\n')}
</channel>
</rss>`;
}

export function robotsTxt(opts: { demo: boolean }): string {
  if (opts.demo) return `# Modo DEMO: contenido ficticio, no indexar.\nUser-agent: *\nDisallow: /\n`;
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Allow: /api/og
${ACTIVE_LANGUAGES.map((l) => `Disallow: ${href.search(l)}`).join('\n')}

Sitemap: ${absoluteUrl('/sitemap.xml')}
Sitemap: ${absoluteUrl('/news-sitemap.xml')}
`;
}
