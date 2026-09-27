import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { oidcEnabled } from '@histor/core/auth/oidc';
import { premiumStatus, paymentsEnabled, resolvePlan, yearlySavingPercent } from '@histor/core/billing/index';
import { COUNTRIES } from '@histor/core/config/countries';
import { LANGUAGES } from '@histor/core/config/languages';
import { articles, newsletters, savedArticles, users } from '@histor/core/db/schema';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { env } from '@histor/core/env';
import { cardsByIds } from '@histor/core/services/content';
import { StoryCard } from '@/components/Cards';
import { AccountActions, PreferencesForm, PushToggle, TwoFactor } from '@/components/client/Account';
import { CheckoutButton, LoginForm, NewsletterSignup, OAuthButtons, RegisterForm, ReportForm, ResetForm } from '@/components/client/Forms';
import { fmtDate, fmtMoney } from '@/lib/format';
import { currentGeo, currentUser, db } from '@/lib/server';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

function Narrow({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="page" style={{ maxWidth: 520 }}>
      <h1>{title}</h1>
      {intro && <p className="muted ui" style={{ fontSize: 15 }}>{intro}</p>}
      {children}
    </section>
  );
}

export async function LoginPage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  const next = one(sp.next) ?? `/${lang}`;
  const user = await currentUser();
  if (user) redirect(next.startsWith('/') && !next.startsWith('//') ? next : `/${lang}`);
  const err = one(sp.error);
  return (
    <Narrow title={d.account.login}>
      {err && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 14 }}>
          {err === 'token' ? d.account.errors.token : d.account.errors.generic}
        </div>
      )}
      {one(sp.verified) === '1' && (
        <div className="alert alert-ok" role="status" style={{ marginBottom: 14 }}>
          ✓ {d.account.email}
        </div>
      )}
      <OAuthButtons lang={lang} next={next} a={d.account} google={oidcEnabled('google')} apple={oidcEnabled('apple')} />
      <LoginForm lang={lang} a={d.account} next={next} registerHref={href.page(lang, 'register')} resetHref={href.page(lang, 'resetPassword')} />
    </Narrow>
  );
}

export async function RegisterPage({ lang, d }: { lang: string; d: Dict }) {
  if (await currentUser()) redirect(href.page(lang, 'account'));
  const geo = await currentGeo(lang);
  return (
    <Narrow title={d.account.register}>
      <OAuthButtons lang={lang} next={`/${lang}`} a={d.account} google={oidcEnabled('google')} apple={oidcEnabled('apple')} />
      <RegisterForm
        lang={lang}
        country={geo.countryCode}
        a={d.account}
        loginHref={href.page(lang, 'login')}
        termsHref={href.page(lang, 'terms')}
        privacyHref={href.page(lang, 'privacy')}
        termsLabel={d.footer.terms}
        privacyLabel={d.footer.privacy}
      />
    </Narrow>
  );
}

export function ResetPage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  return (
    <Narrow title={d.account.reset}>
      <ResetForm lang={lang} a={d.account} token={one(sp.token)} loginHref={href.page(lang, 'login')} />
    </Narrow>
  );
}

export async function AccountPage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  const su = await currentUser();
  if (!su) redirect(`${href.page(lang, 'login')}?next=${encodeURIComponent(href.page(lang, 'account'))}`);
  const [u] = await db().select().from(users).where(eq(users.id, su.id)).limit(1);
  const status = await premiumStatus(db(), su.id);
  const sub = status.subscription;
  const checkout = one(sp.checkout);
  return (
    <section className="page">
      <h1>{t(d.account.welcome, { name: su.name ?? su.email })}</h1>
      {checkout === 'success' && (
        <div className="alert alert-ok" role="status">
          {d.subscribe.success}
        </div>
      )}
      <h2>{d.account.subscription}</h2>
      <p className="ui" style={{ fontSize: 16 }}>
        {d.account.plan}: <strong>{status.premium ? d.account.premium : d.account.free}</strong>
        {sub && status.premium && sub.currentPeriodEnd && (
          <span className="muted">
            {' '}
            · {fmtMoney(sub.amountCents, sub.currency, lang)}
            {sub.interval === 'year' ? d.subscribe.perYear : d.subscribe.perMonth} · {fmtDate(sub.currentPeriodEnd, lang)}
            {sub.status === 'past_due' && ' · ⚠'}
          </span>
        )}
      </p>
      {!status.premium && (
        <p>
          <Link className="btn btn-solid" href={href.page(lang, 'subscribe')}>
            {d.nav.subscribe}
          </Link>
        </p>
      )}

      <h2>{d.account.preferences}</h2>
      <PreferencesForm
        a={d.account}
        prefs={{
          language: u.language ?? lang,
          countryCode: u.countryCode,
          personalization: u.personalization,
          marketingConsent: u.marketingConsent,
          alertsMaxPerDay: u.alertsMaxPerDay,
          quietHoursStart: u.quietHoursStart,
          quietHoursEnd: u.quietHoursEnd,
        }}
        languages={LANGUAGES.filter((l) => l.enabled).map((l) => ({ code: l.code, name: l.nativeName }))}
        countries={COUNTRIES.map((c) => ({ code: c.code, name: c.names[lang] ?? c.names.en })).sort((a, b) => a.name.localeCompare(b.name))}
      />

      <h2>{d.account.alerts}</h2>
      <PushToggle label={d.account.alerts} vapidKey={env().VAPID_PUBLIC_KEY ?? null} />

      <h2>{d.account.twoFactor}</h2>
      <TwoFactor a={d.account} enabled={u.totpEnabled} />

      <h2>
        <Link href={href.page(lang, 'saved')}>{d.nav.saved} →</Link>
      </h2>
      <h2>
        <Link href={href.page(lang, 'newsletters')}>{d.nav.newsletters} →</Link>
      </h2>

      <h2>{d.account.exportData}</h2>
      <AccountActions a={d.account} lang={lang} hasBilling={!!u.stripeCustomerId && paymentsEnabled()} />
    </section>
  );
}

export async function SavedPage({ lang, d }: { lang: string; d: Dict }) {
  const su = await currentUser();
  if (!su) redirect(`${href.page(lang, 'login')}?next=${encodeURIComponent(href.page(lang, 'saved'))}`);
  const rows = await db()
    .select({ id: articles.id })
    .from(savedArticles)
    .innerJoin(articles, eq(articles.id, savedArticles.articleId))
    .where(and(eq(savedArticles.userId, su.id), eq(articles.language, lang)))
    .orderBy(desc(savedArticles.createdAt))
    .limit(100);
  const items = await cardsByIds(db(), rows.map((r) => r.id));
  return (
    <section style={{ padding: '26px 0' }}>
      <h1 style={{ fontSize: 40, margin: '0 0 18px' }}>{d.nav.saved}</h1>
      {!items.length ? (
        <p className="muted">{d.account.savedEmpty}</p>
      ) : (
        <div className="grid grid-3">
          {items.map((a) => (
            <StoryCard key={a.id} a={a} lang={lang} d={d} compact />
          ))}
        </div>
      )}
    </section>
  );
}

export async function SubscribePage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  const geo = await currentGeo(lang);
  const plan = await resolvePlan(db(), geo.countryCode);
  const user = await currentUser();
  const premium = user ? (await premiumStatus(db(), user.id)).premium : false;
  const loginHref = user ? null : `${href.page(lang, 'register')}?next=${encodeURIComponent(href.page(lang, 'subscribe'))}`;
  const enabled = paymentsEnabled();
  const s = d.subscribe;
  return (
    <section className="page" style={{ maxWidth: 920 }}>
      <h1>{s.title}</h1>
      <p className="dek" style={{ fontSize: 21, color: 'var(--ink-2)' }}>
        {s.subtitle}
      </p>
      {one(sp.checkout) === 'canceled' && (
        <div className="alert alert-error" role="status">
          {s.canceled}
        </div>
      )}
      {premium && (
        <div className="alert alert-ok" role="status">
          {s.already}
        </div>
      )}
      {!enabled && (
        <div className="notice notice-developing" role="note">
          {s.notConfigured}
        </div>
      )}
      <div className="plans">
        <div className="plan">
          <h2 style={{ marginTop: 0 }}>{s.freeTitle}</h2>
          <div className="price">{plan ? fmtMoney(0, plan.currency, lang, geo.countryCode) : '0'}</div>
          <ul>
            {s.freeFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        {plan && (
          <div className="plan featured">
            <h2 style={{ marginTop: 0 }}>{s.title}</h2>
            <div className="price tnum">
              {fmtMoney(plan.monthlyCents, plan.currency, lang, geo.countryCode)}
              <span style={{ fontSize: 16, fontFamily: 'var(--sans)', fontWeight: 400 }}>{s.perMonth}</span>
            </div>
            <p className="muted tnum" style={{ margin: '4px 0 0' }}>
              {s.yearly}: {fmtMoney(plan.yearlyCents, plan.currency, lang, geo.countryCode)}
              {s.perYear} · {t(s.save, { n: yearlySavingPercent(plan) })}
            </p>
            {plan.trialDays > 0 && <p className="badge badge-verified">{t(s.trial, { n: plan.trialDays })}</p>}
            <ul>
              {s.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {enabled && !premium && (
              <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <CheckoutButton interval="month" label={`${plan.trialDays ? s.ctaTrial : s.cta} · ${s.monthly}`} loginHref={loginHref} lang={lang} solid />
                <CheckoutButton interval="year" label={`${s.cta} · ${s.yearly}`} loginHref={loginHref} lang={lang} />
              </div>
            )}
            {!user && enabled && <p className="muted" style={{ fontSize: 13 }}>{s.loginFirst}</p>}
            <p className="muted" style={{ fontSize: 13 }}>
              {s.cancelAnytime} {s.taxes} <Link href={href.page(lang, 'subscriptionTerms')}>{d.footer.subscriptionTerms}</Link>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export async function NewslettersPage({ lang, d, sp }: { lang: string; d: Dict; sp: SP }) {
  const user = await currentUser();
  const premium = user ? (await premiumStatus(db(), user.id)).premium : false;
  const list = await db().select().from(newsletters).where(eq(newsletters.enabled, true)).orderBy(newsletters.language, newsletters.slug);
  const mine = list.filter((n) => n.language === lang || n.names[lang]);
  const others = list.filter((n) => !mine.includes(n));
  const Row = ({ n }: { n: (typeof list)[number] }) => (
    <li style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>
        {n.names[lang] ?? n.names[n.language] ?? n.slug} {n.isPremium && <span className="badge badge-review">{d.label.premium}</span>}
      </h2>
      <p className="muted ui" style={{ fontSize: 14, margin: '0 0 8px' }}>
        {t(d.newsletter.daily, { h: String(n.sendHourLocal).padStart(2, '0') })} ({n.timezone}) · {LANGUAGES.find((l) => l.code === n.language)?.nativeName}
      </p>
      <NewsletterSignup slug={n.slug} lang={lang} n={d.newsletter} defaultEmail={user?.email} premiumLocked={n.isPremium && !premium} />
    </li>
  );
  return (
    <section className="page">
      <h1>{d.newsletter.title}</h1>
      <p className="muted ui" style={{ fontSize: 16 }}>
        {d.newsletter.intro}
      </p>
      {one(sp.confirmed) && (
        <div className="alert alert-ok" role="status">
          {d.newsletter.confirmed}
        </div>
      )}
      {one(sp.unsubscribed) && (
        <div className="alert alert-ok" role="status">
          {d.newsletter.unsubscribed}
        </div>
      )}
      {one(sp.error) && (
        <div className="alert alert-error" role="status">
          {d.account.errors.token}
        </div>
      )}
      <ul className="list">
        {mine.map((n) => (
          <Row key={n.id} n={n} />
        ))}
      </ul>
      {others.length > 0 && (
        <details style={{ marginTop: 24 }}>
          <summary className="ui" style={{ cursor: 'pointer' }}>
            {LANGUAGES.filter((l) => l.enabled && l.code !== lang)
              .map((l) => l.nativeName)
              .join(' · ')}
          </summary>
          <ul className="list">
            {others.map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function ReportPage({ d, sp }: { d: Dict; sp: SP }) {
  const articleId = Number(one(sp.article)) || null;
  return (
    <section className="page" style={{ maxWidth: 620 }}>
      <h1>{d.report.title}</h1>
      <p className="muted ui" style={{ fontSize: 16 }}>
        {d.report.intro}
      </p>
      <ReportForm r={d.report} url={one(sp.url) ?? ''} articleId={articleId} />
    </section>
  );
}
