'use client';
import { useEffect, useState } from 'react';
import { consentOf, setCookie } from './api';

type Labels = { title: string; text: string; acceptAll: string; rejectAll: string; customize: string; save: string; categories: Record<string, [string, string]> };
const OPTIONAL = ['preferences', 'analytics', 'personalization', 'marketing'] as const;
const CONSENT_VERSION = '1';

export function CookieConsent({ labels, policyHref }: { labels: Labels; policyHref: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choice, setChoice] = useState<Set<string>>(new Set());

  useEffect(() => {
    const has = document.cookie.includes('histor_consent_v=');
    if (!has) setOpen(true);
    setChoice(consentOf());
    const reopen = () => {
      setOpen(true);
      setCustom(true);
    };
    window.addEventListener('histor:consent', reopen);
    return () => window.removeEventListener('histor:consent', reopen);
  }, []);

  const save = (set: Set<string>) => {
    setCookie('histor_consent', [...set].join(','), 365);
    setCookie('histor_consent_v', CONSENT_VERSION, 365);
    if (set.has('analytics') && !document.cookie.includes('histor_aid=')) setCookie('histor_aid', crypto.randomUUID(), 395);
    if (!set.has('analytics')) setCookie('histor_aid', '', 0);
    setOpen(false);
    window.dispatchEvent(new Event('histor:consent-changed'));
  };

  if (!open) return null;
  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-modal="false">
      <h2 id="consent-title">{labels.title}</h2>
      <p style={{ margin: 0 }}>
        {labels.text} <a href={policyHref}>→</a>
      </p>
      {custom && (
        <fieldset>
          <label className="check" style={{ display: 'flex', gap: 8 }}>
            <input type="checkbox" checked disabled /> <span><strong>{labels.categories.necessary[0]}</strong> — {labels.categories.necessary[1]}</span>
          </label>
          {OPTIONAL.map((c) => (
            <label key={c} className="check" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={choice.has(c)}
                onChange={(e) => {
                  const n = new Set(choice);
                  if (e.target.checked) n.add(c);
                  else n.delete(c);
                  setChoice(n);
                }}
              />
              <span>
                <strong>{labels.categories[c][0]}</strong> — {labels.categories[c][1]}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="row">
        <button className="btn btn-solid" onClick={() => save(new Set(['preferences', 'analytics', 'personalization']))}>
          {labels.acceptAll}
        </button>
        <button className="btn" onClick={() => save(new Set())}>
          {labels.rejectAll}
        </button>
        {custom ? (
          <button className="btn" onClick={() => save(choice)}>
            {labels.save}
          </button>
        ) : (
          <button className="btn" onClick={() => setCustom(true)}>
            {labels.customize}
          </button>
        )}
      </div>
    </div>
  );
}

export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('histor:consent'))} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
      {label}
    </button>
  );
}
