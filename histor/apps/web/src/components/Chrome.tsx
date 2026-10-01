import Link from 'next/link';
import { CATEGORIES } from '@histor/core/config/categories';
import { country, COUNTRIES } from '@histor/core/config/countries';
import { LANGUAGES } from '@histor/core/config/languages';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { telegramChannel } from '@histor/core/social/index';
import { fmtToday } from '@/lib/format';
import { EditionSwitcher } from './client/EditionSwitcher';
import { CookieSettingsLink } from './client/CookieConsent';
import { UserMenu } from './client/UserMenu';
import { Wordmark } from './Logo';

const NAV_CATEGORIES = ['politics', 'economy', 'world', 'technology', 'science', 'health', 'sports', 'culture', 'entertainment', 'society', 'business', 'weather', 'travel', 'lifestyle'];

export function Header({ lang, d, countryCode, tz, demo }: { lang: string; d: Dict; countryCode: string | null; tz: string; demo: boolean }) {
  const edition = countryCode ? country(countryCode) : undefined;
  const editions = COUNTRIES.filter((c) => c.edition).map((c) => ({ code: c.code, name: c.names[lang] ?? c.names.en }));
  const langs = LANGUAGES.filter((l) => l.enabled).map((l) => ({ code: l.code, name: l.nativeName }));
  return (
    <>
      <a href="#main" className="skip">
        {d.nav.skip}
      </a>
      {demo && <div className="demo-banner">{d.demoBanner}</div>}
      <div className="topbar">
        <div className="wrap">
          <span className="tnum" suppressHydrationWarning>
            {fmtToday(lang, tz)}
          </span>
          <div className="right">
            <EditionSwitcher lang={lang} current={edition?.code ?? null} editions={editions} languages={langs} labels={{ edition: d.nav.edition, language: d.nav.language }} />
          </div>
        </div>
      </div>
      <header className="masthead">
        <div className="wrap">
          <div className="left ui">
            <Link href={href.search(lang)}>{d.nav.search}</Link>
          </div>
          <div className="brand-box">
            <Link href={href.home(lang)} className="brand" aria-label="Histor">
              <Wordmark />
            </Link>
            <div className="brand-tag">{d.tagline}</div>
          </div>
          <div className="right">
            <UserMenu lang={lang} labels={{ login: d.nav.login, account: d.nav.account, subscribe: d.nav.subscribe }} loginHref={href.page(lang, 'login')} accountHref={href.page(lang, 'account')} subscribeHref={href.page(lang, 'subscribe')} />
          </div>
        </div>
      </header>
      <nav className="nav" aria-label={d.nav.sections}>
        <div className="wrap">
          <Link href={href.home(lang)}>{d.nav.home}</Link>
          <Link href={href.list(lang, 'breaking')} className="hot">
            {d.nav.breaking}
          </Link>
          <Link href={href.list(lang, 'today')}>{d.nav.today}</Link>
          <Link href={href.list(lang, 'latest')}>{d.nav.latest}</Link>
          {edition && <Link href={href.country(lang, edition.code)}>{edition.names[lang]}</Link>}
          {NAV_CATEGORIES.map((id) => {
            const c = CATEGORIES.find((x) => x.id === id)!;
            return (
              <Link key={id} href={href.category(lang, id)}>
                {c.names[lang]}
              </Link>
            );
          })}
          <Link href={href.list(lang, 'trending')}>{d.nav.trending}</Link>
          <Link href={href.list(lang, 'forYou')}>{d.nav.forYou}</Link>
        </div>
      </nav>
    </>
  );
}

export function Footer({ lang, d }: { lang: string; d: Dict }) {
  // Canal público de Telegram del idioma (TELEGRAM_CHANNELS=«es=@historNoticias»), si lo hay.
  const channel = telegramChannel(lang);
  const telegram = channel?.startsWith('@') ? channel.slice(1) : null;
  const P = (w: Parameters<typeof href.page>[1], label: string) => (
    <li>
      <Link href={href.page(lang, w)}>{label}</Link>
    </li>
  );
  return (
    <footer className="footer">
      <div className="wrap cols">
        <div>
          <Link href={href.home(lang)} className="brand" style={{ justifyContent: 'flex-start' }} aria-label="Histor">
            <span className="brand-word" style={{ fontSize: 34 }}>
              Histor<span className="brand-dot">.</span>
            </span>
          </Link>
          <p>{d.footer.about}</p>
          {telegram && (
            <p>
              <a href={`https://t.me/${telegram}`} rel="noopener" target="_blank">
                {d.footer.telegram} →
              </a>
            </p>
          )}
          <p className="muted">
            {d.footer.automation} <Link href={href.page(lang, 'howItWorks')}>{d.footer.howItWorks} →</Link>
          </p>
          <p className="muted">{t(d.footer.rights, { year: new Date().getFullYear() })}</p>
          {/* Crédito que exige la licencia CC BY 4.0 de la base de geolocalización por IP. */}
          <p className="muted" style={{ fontSize: 12 }}>
            <a href="https://db-ip.com" rel="noopener" target="_blank">IP Geolocation by DB-IP</a>
          </p>
        </div>
        <div>
          <h3>Histor</h3>
          <ul>
            {P('howItWorks', d.footer.howItWorks)}
            {P('editorialPolicy', d.footer.editorialPolicy)}
            {P('corrections', d.footer.corrections)}
            {P('sources', d.footer.sources)}
            {P('report', d.footer.report)}
          </ul>
        </div>
        <div>
          <h3>{d.nav.subscribe}</h3>
          <ul>
            {P('subscribe', d.nav.subscribe)}
            {P('newsletters', d.nav.newsletters)}
            {P('account', d.nav.account)}
            {P('contact', d.footer.contact)}
          </ul>
        </div>
        <div>
          <h3>Legal</h3>
          <ul>
            {P('privacy', d.footer.privacy)}
            {P('cookies', d.footer.cookies)}
            {P('terms', d.footer.terms)}
            {P('subscriptionTerms', d.footer.subscriptionTerms)}
            {P('legalNotice', d.footer.legalNotice)}
            <li>
              <CookieSettingsLink label={d.footer.cookieSettings} />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
