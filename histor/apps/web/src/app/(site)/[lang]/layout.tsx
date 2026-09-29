import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/inter';
import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { isActiveLanguage, languageDef, localeFor } from '@histor/core/config/languages';
import { env } from '@histor/core/env';
import { dict } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { demoMode } from '@histor/core/services/content';
import { absoluteUrl } from '@histor/core/seo/index';
import { Footer, Header } from '@/components/Chrome';
import { CookieConsent } from '@/components/client/CookieConsent';
import { currentGeo } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#111317' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isActiveLanguage(lang)) return {};
  const d = dict(lang);
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: `Histor — ${d.tagline}`, template: '%s · Histor' },
    description: d.footer.about,
    applicationName: 'Histor',
    icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192' }], apple: '/icon-180.png' },
    manifest: '/manifest.webmanifest',
    alternates: { types: { 'application/rss+xml': `/${lang}/rss.xml` } },
    openGraph: { siteName: 'Histor', locale: localeFor(lang).replace('-', '_'), type: 'website' },
    twitter: { card: 'summary_large_image' },
    // Verificación de Google Search Console y Bing Webmaster Tools (se pegan como secretos).
    verification: {
      google: env().GOOGLE_SITE_VERIFICATION,
      other: env().BING_SITE_VERIFICATION ? { 'msvalidate.01': env().BING_SITE_VERIFICATION! } : undefined,
    },
    // El modo DEMO no se indexa nunca: su contenido es ficticio.
    robots: demoMode() ? { index: false, follow: false } : { index: true, follow: true, 'max-image-preview': 'large' },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isActiveLanguage(lang)) notFound();
  const d = dict(lang);
  const geo = await currentGeo(lang);
  const demo = demoMode();
  return (
    <html lang={localeFor(lang, geo.countryCode)} dir={languageDef(lang).rtl ? 'rtl' : 'ltr'}>
      <body>
        <Header lang={lang} d={d} countryCode={geo.countryCode} tz={geo.timezone} demo={demo} />
        <main id="main" className="wrap">
          {children}
        </main>
        <Footer lang={lang} d={d} />
        <CookieConsent labels={d.cookies} policyHref={href.page(lang, 'cookies')} />
      </body>
    </html>
  );
}
