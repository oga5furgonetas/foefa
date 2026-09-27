'use client';
/**
 * Formularios del lector (cuenta, suscripción, newsletters, avisos de error,
 * seguir temas). Todos pasan por la API con CSRF de doble envío.
 */
import { useState } from 'react';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { api, ApiClientError } from './api';

type A = Dict['account'];

function errorText(e: unknown, a: A): string {
  if (e instanceof ApiClientError) {
    if (e.status === 429) return a.errors.rate;
    const map: Record<string, string> = { invalid: a.errors.invalid, locked: a.errors.rate, taken: a.errors.taken, weak: a.errors.weak, token: a.errors.token, totp: a.errors.totp, invalid_email: a.errors.invalid };
    return map[e.code] ?? a.errors.generic;
  }
  return a.errors.generic;
}

function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function OAuthButtons({ lang, next, a, google, apple }: { lang: string; next: string; a: A; google: boolean; apple: boolean }) {
  if (!google && !apple) return null;
  const q = `?lang=${lang}&next=${encodeURIComponent(next)}`;
  return (
    <div className="form" style={{ marginBottom: 18 }}>
      {google && (
        <a className="btn" href={`/api/v1/auth/oauth/google${q}`}>
          {a.google}
        </a>
      )}
      {apple && (
        <a className="btn" href={`/api/v1/auth/oauth/apple${q}`}>
          {a.apple}
        </a>
      )}
      <div className="muted" style={{ textAlign: 'center' }}>
        — {a.or} —
      </div>
    </div>
  );
}

export function LoginForm({ lang, a, next, registerHref, resetHref }: { lang: string; a: A; next?: string; registerHref: string; resetHref: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ ok: boolean; needsTotp?: boolean }>('/api/v1/auth/login', { body: { email: f.get('email'), password: f.get('password'), totp: f.get('totp') || undefined } });
          if (r.needsTotp) setNeedsTotp(true);
          else location.href = safeNext(next, `/${lang}`);
        } catch (e) {
          if (e instanceof ApiClientError && e.code === 'totp') setNeedsTotp(true);
          setErr(errorText(e, a));
        } finally {
          setBusy(false);
        }
      }}
    >
      {err && (
        <div className="alert alert-error" role="alert">
          {err}
        </div>
      )}
      <label>
        {a.email}
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>
      <label>
        {a.password}
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      {needsTotp && (
        <label>
          {a.totpCode}
          <input name="totp" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required maxLength={6} />
        </label>
      )}
      <button className="btn btn-solid" disabled={busy}>
        {a.login}
      </button>
      <div className="row">
        <a href={resetHref}>{a.forgot}</a>
        <span className="muted">·</span>
        <span>
          {a.noAccount} <a href={registerHref}>{a.register}</a>
        </span>
      </div>
    </form>
  );
}

export function RegisterForm({ lang, country, a, loginHref, termsHref, privacyHref, termsLabel, privacyLabel }: { lang: string; country: string | null; a: A; loginHref: string; termsHref: string; privacyHref: string; termsLabel: string; privacyLabel: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done)
    return (
      <div className="alert alert-ok" role="status">
        {a.verifySent}
      </div>
    );
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        setBusy(true);
        setErr(null);
        try {
          await api('/api/v1/auth/register', { body: { email: f.get('email'), password: f.get('password'), name: f.get('name') || null, lang, country, marketing: f.get('marketing') === 'on' } });
          setDone(true);
        } catch (e) {
          setErr(errorText(e, a));
        } finally {
          setBusy(false);
        }
      }}
    >
      {err && (
        <div className="alert alert-error" role="alert">
          {err}
        </div>
      )}
      <label>
        {a.email}
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>
      <label>
        {a.password}
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} aria-describedby="pw-hint" />
        <span id="pw-hint" className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
          {a.passwordHint}
        </span>
      </label>
      <label>
        {a.name}
        <input name="name" autoComplete="name" maxLength={100} />
      </label>
      <label className="check">
        <input type="checkbox" name="marketing" /> {a.marketing}
      </label>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        <a href={termsHref}>{termsLabel}</a> · <a href={privacyHref}>{privacyLabel}</a>
      </p>
      <button className="btn btn-solid" disabled={busy}>
        {a.register}
      </button>
      <div>
        {a.haveAccount} <a href={loginHref}>{a.login}</a>
      </div>
    </form>
  );
}

export function ResetForm({ lang, a, token, loginHref }: { lang: string; a: A; token: string | null; loginHref: string }) {
  const [state, setState] = useState<'idle' | 'sent' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);
  if (state === 'sent')
    return (
      <div className="alert alert-ok" role="status">
        {a.resetSent}
      </div>
    );
  if (state === 'done')
    return (
      <div className="alert alert-ok" role="status">
        {a.resetDone} <a href={loginHref}>{a.login}</a>
      </div>
    );
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        setErr(null);
        try {
          if (token) {
            await api('/api/v1/auth/reset/confirm', { body: { token, password: f.get('password') } });
            setState('done');
          } else {
            await api('/api/v1/auth/reset/request', { body: { email: f.get('email'), lang } });
            setState('sent');
          }
        } catch (e) {
          setErr(errorText(e, a));
        }
      }}
    >
      {err && (
        <div className="alert alert-error" role="alert">
          {err}
        </div>
      )}
      {token ? (
        <label>
          {a.newPassword}
          <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
        </label>
      ) : (
        <label>
          {a.email}
          <input name="email" type="email" autoComplete="email" required maxLength={320} />
        </label>
      )}
      <button className="btn btn-solid">{a.reset}</button>
    </form>
  );
}

export function ReportForm({ r, url, articleId }: { r: Dict['report']; url: string; articleId: number | null }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);
  if (done)
    return (
      <div className="alert alert-ok" role="status">
        {r.thanks}
      </div>
    );
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        try {
          await api('/api/v1/reports', {
            body: { kind: f.get('kind'), url: f.get('url') || null, articleId, description: f.get('description'), name: f.get('name') || null, email: f.get('email') || null, website: f.get('website') || '' },
          });
          setDone(true);
        } catch {
          setErr(true);
        }
      }}
    >
      {err && (
        <div className="alert alert-error" role="alert">
          ✕
        </div>
      )}
      <label>
        {r.kind}
        <select name="kind" required defaultValue="factual_error">
          {Object.entries(r.kinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        {r.url}
        <input name="url" type="text" defaultValue={url} maxLength={500} />
      </label>
      <label>
        {r.description}
        <textarea name="description" required minLength={10} maxLength={5000} />
      </label>
      <label>
        {r.name}
        <input name="name" maxLength={100} autoComplete="name" />
      </label>
      <label>
        {r.email}
        <input name="email" type="email" maxLength={320} autoComplete="email" />
      </label>
      {/* Campo trampa para bots: invisible para personas. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <button className="btn btn-solid">{r.submit}</button>
    </form>
  );
}

export function NewsletterSignup({ slug, lang, n, defaultEmail, premiumLocked }: { slug: string; lang: string; n: Dict['newsletter']; defaultEmail?: string | null; premiumLocked: boolean }) {
  const [state, setState] = useState<'idle' | 'sent' | 'already' | 'error'>('idle');
  if (premiumLocked) return <span className="badge badge-review">{n.premiumOnly}</span>;
  if (state === 'sent' || state === 'already')
    return (
      <span className="alert alert-ok" role="status">
        {n.confirmSent}
      </span>
    );
  return (
    <form
      className="form"
      style={{ gridTemplateColumns: 'minmax(0,1fr) auto', maxWidth: 520, alignItems: 'end' }}
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        try {
          const r = await api<{ status: string }>('/api/v1/newsletters/subscribe', { body: { slug, email: f.get('email'), lang } });
          setState(r.status === 'already' ? 'already' : 'sent');
        } catch {
          setState('error');
        }
      }}
    >
      <label>
        <span className="sr-only">{n.email}</span>
        <input name="email" type="email" required placeholder={n.email} defaultValue={defaultEmail ?? ''} maxLength={320} />
      </label>
      <button className="btn btn-solid">{n.subscribe}</button>
      {state === 'error' && (
        <span className="alert alert-error" role="alert" style={{ gridColumn: '1 / -1' }}>
          ✕
        </span>
      )}
    </form>
  );
}

export function CheckoutButton({ interval, label, loginHref, lang, solid }: { interval: 'month' | 'year'; label: string; loginHref: string | null; lang: string; solid?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        className={`btn ${solid ? 'btn-solid' : ''}`}
        disabled={busy}
        onClick={async () => {
          if (loginHref) {
            location.href = loginHref;
            return;
          }
          setBusy(true);
          try {
            const r = await api<{ url: string }>('/api/v1/billing/checkout', { body: { interval, lang } });
            location.href = r.url;
          } catch (e) {
            setErr(e instanceof ApiClientError ? e.code : 'error');
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
      {err && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}
    </>
  );
}

export function FollowButton({ kind, refId, following: initial, labels, loginHref }: { kind: string; refId: string; following: boolean; labels: { follow: string; following: string }; loginHref: string | null }) {
  const [following, setFollowing] = useState(initial);
  return (
    <button
      className={`btn btn-small ${following ? '' : 'btn-solid'}`}
      aria-pressed={following}
      onClick={async () => {
        if (loginHref) {
          location.href = loginHref;
          return;
        }
        try {
          await api('/api/v1/follow', { method: following ? 'DELETE' : 'POST', body: { kind, ref: refId } });
          setFollowing(!following);
        } catch {
          /* sin cambios */
        }
      }}
    >
      {following ? `✓ ${labels.following}` : `+ ${labels.follow}`}
    </button>
  );
}
