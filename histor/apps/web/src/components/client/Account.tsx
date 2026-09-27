'use client';
import { useState } from 'react';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { api, ApiClientError, setCookie } from './api';

type A = Dict['account'];
export type AccountPrefs = {
  language: string;
  countryCode: string | null;
  personalization: boolean;
  marketingConsent: boolean;
  alertsMaxPerDay: number;
  quietHoursStart: number;
  quietHoursEnd: number;
};

export function PreferencesForm({ a, prefs, languages, countries }: { a: A; prefs: AccountPrefs; languages: { code: string; name: string }[]; countries: { code: string; name: string }[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const body = {
          language: String(f.get('language')),
          countryCode: String(f.get('countryCode') || '') || null,
          personalization: f.get('personalization') === 'on',
          marketingConsent: f.get('marketingConsent') === 'on',
          alertsMaxPerDay: Number(f.get('alertsMaxPerDay')),
          quietHoursStart: Number(f.get('quietHoursStart')),
          quietHoursEnd: Number(f.get('quietHoursEnd')),
        };
        try {
          await api('/api/v1/account', { method: 'PATCH', body });
          setCookie('histor_lang', body.language);
          if (body.countryCode) setCookie('histor_edition', body.countryCode);
          setMsg(a.saved);
        } catch {
          setMsg(a.errors.generic);
        }
      }}
    >
      <label>
        {a.language}
        <select name="language" defaultValue={prefs.language}>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {a.country}
        <select name="countryCode" defaultValue={prefs.countryCode ?? ''}>
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" name="personalization" defaultChecked={prefs.personalization} /> {a.personalization}
      </label>
      <label className="check">
        <input type="checkbox" name="marketingConsent" defaultChecked={prefs.marketingConsent} /> {a.marketing}
      </label>
      <label>
        {a.alertsMax}
        <input name="alertsMaxPerDay" type="number" min={0} max={20} defaultValue={prefs.alertsMaxPerDay} />
      </label>
      <div className="row">
        <label>
          ⏾
          <input name="quietHoursStart" type="number" min={0} max={23} defaultValue={prefs.quietHoursStart} aria-label="from" />
        </label>
        <label>
          ☀
          <input name="quietHoursEnd" type="number" min={0} max={23} defaultValue={prefs.quietHoursEnd} aria-label="to" />
        </label>
      </div>
      <button className="btn btn-solid">{a.save}</button>
      {msg && (
        <span className="muted" role="status">
          {msg}
        </span>
      )}
    </form>
  );
}

export function PushToggle({ label, vapidKey }: { label: string; vapidKey: string | null }) {
  const [state, setState] = useState<'idle' | 'on' | 'denied' | 'unsupported'>('idle');
  if (!vapidKey) return null;
  return (
    <button
      className="btn btn-small"
      disabled={state === 'on'}
      onClick={async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return setState('denied');
        const reg = await navigator.serviceWorker.register('/sw.js');
        const key = Uint8Array.from(atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api('/api/v1/push/subscribe', { body: { subscription: sub.toJSON(), lang: document.documentElement.lang.slice(0, 2) } });
        setState('on');
      }}
    >
      {state === 'on' ? `✓ ${label}` : label}
      {state === 'denied' && ' ✕'}
    </button>
  );
}

export function TwoFactor({ a, enabled }: { a: A; enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [on, setOn] = useState(enabled);
  const [err, setErr] = useState<string | null>(null);
  if (on) return <p className="alert alert-ok">✓ {a.twoFactor}</p>;
  return (
    <div className="form">
      {!setup ? (
        <button className="btn btn-small" onClick={async () => setSetup(await api<{ secret: string; uri: string }>('/api/v1/account/totp', { body: {} }))}>
          {a.twoFactor}
        </button>
      ) : (
        <form
          className="form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const code = String(new FormData(ev.currentTarget).get('code'));
            try {
              await api('/api/v1/account/totp', { method: 'PUT', body: { secret: setup.secret, code } });
              setOn(true);
            } catch {
              setErr(a.errors.totp);
            }
          }}
        >
          <p style={{ fontSize: 14, margin: 0, wordBreak: 'break-all' }}>
            <code>{setup.secret}</code>
          </p>
          <a href={setup.uri} className="muted" style={{ fontSize: 13 }}>
            otpauth://
          </a>
          <label>
            {a.totpCode}
            <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
          </label>
          {err && <div className="alert alert-error">{err}</div>}
          <button className="btn btn-solid btn-small">{a.save}</button>
        </form>
      )}
    </div>
  );
}

export function AccountActions({ a, lang, hasBilling }: { a: A; lang: string; hasBilling: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const word = a.deleteConfirm.match(/\b[A-ZÁÉÍÓÚÄÖÜ]{5,}\b/)?.[0] ?? 'DELETE';
  return (
    <div className="form" style={{ maxWidth: 520 }}>
      <div className="row">
        {hasBilling && (
          <button
            className="btn btn-small"
            onClick={async () => {
              try {
                const r = await api<{ url: string }>('/api/v1/billing/portal', { body: { lang } });
                location.href = r.url;
              } catch (e) {
                setErr(e instanceof ApiClientError ? e.code : a.errors.generic);
              }
            }}
          >
            {a.manage}
          </button>
        )}
        <a className="btn btn-small" href="/api/v1/account/export" download>
          {a.exportData}
        </a>
        <button
          className="btn btn-small"
          onClick={async () => {
            await api('/api/v1/auth/logout', { body: {} }).catch(() => {});
            location.href = `/${lang}`;
          }}
        >
          {a.logout}
        </button>
      </div>
      {err && <div className="alert alert-error">{err}</div>}
      {!confirmOpen ? (
        <button className="btn btn-small" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', justifySelf: 'start' }} onClick={() => setConfirmOpen(true)}>
          {a.deleteAccount}
        </button>
      ) : (
        <form
          className="form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const v = String(new FormData(ev.currentTarget).get('confirm'));
            if (v.trim() !== word) return setErr(a.errors.generic);
            try {
              await api('/api/v1/account', { method: 'DELETE', body: { confirm: true } });
              location.href = `/${lang}`;
            } catch {
              setErr(a.errors.generic);
            }
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>{a.deleteConfirm}</p>
          <input name="confirm" required autoComplete="off" />
          <button className="btn btn-accent btn-small">{a.deleteAccount}</button>
        </form>
      )}
    </div>
  );
}
