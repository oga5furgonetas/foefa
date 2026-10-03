'use client';
import { useEffect, useState } from 'react';
import { consentOf, setCookie } from './api';

type Labels = { title: string; text: string; acceptAll: string; rejectAll: string; customize: string; save: string; categories: Record<string, readonly string[]> };
const OPTIONAL = ['preferences', 'analytics', 'personalization', 'marketing'] as const;
const CONSENT_VERSION = '1';

type TcData = { gdprApplies?: boolean; eventStatus?: string; purpose?: { consents?: Record<string, boolean> } };
type TcfWindow = Window & {
  __tcfapi?: (cmd: string, version: number, cb: (tc: TcData, ok: boolean) => void) => void;
  googlefc?: { callbackQueue: unknown[]; showRevocationMessage?: () => void };
};

/**
 * Con anuncios (AdSense), en el EEE, Reino Unido y Suiza manda el mensaje de consentimiento de
 * Google (CMP certificada, obligatoria para servir anuncios): el nuestro no sale para no pedir
 * dos veces, y lo que el lector elige allí (propósitos TCF) se traslada a nuestras categorías.
 * Fuera de esa zona Google no pregunta y sale el nuestro, como siempre; también si su CMP no
 * carga (bloqueadores). 03-10-2026.
 */
function fromTcf(tc: TcData): Set<string> {
  const p = tc.purpose?.consents ?? {};
  const out = new Set<string>();
  if (!p['1']) return out; // sin «guardar y leer información en el dispositivo», nada
  out.add('preferences');
  if (p['8'] || p['9']) out.add('analytics');
  if (p['5'] || p['6']) out.add('personalization');
  if (p['3'] || p['4']) out.add('marketing');
  return out;
}

export function CookieConsent({ labels, policyHref, ads = false }: { labels: Labels; policyHref: string; ads?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choice, setChoice] = useState<Set<string>>(new Set());

  useEffect(() => {
    const w = window as TcfWindow;
    const has = document.cookie.includes('histor_consent_v=');
    setChoice(consentOf());
    let googleAsks = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (ads) {
      let tries = 0;
      const attach = () => {
        if (!w.__tcfapi) {
          // Sin CMP de Google al cabo de 4 s (bloqueador de anuncios): el nuestro.
          if (++tries > 20) {
            if (!has) setOpen(true);
            return;
          }
          timer = setTimeout(attach, 200);
          return;
        }
        w.__tcfapi('addEventListener', 2, (tc, ok) => {
          if (!ok) return;
          if (tc.gdprApplies === false) {
            if (!has) setOpen(true);
            return;
          }
          googleAsks = true;
          if (tc.eventStatus === 'useractioncomplete' || tc.eventStatus === 'tcloaded') save(fromTcf(tc));
        });
      };
      attach();
    } else if (!has) setOpen(true);
    const reopen = () => {
      // «Configurar cookies» del pie: donde pregunta Google, se reabre su mensaje.
      if (googleAsks && w.googlefc?.showRevocationMessage) {
        w.googlefc.callbackQueue.push(w.googlefc.showRevocationMessage);
        return;
      }
      setOpen(true);
      setCustom(true);
    };
    window.addEventListener('histor:consent', reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('histor:consent', reopen);
    };
  }, [ads]);

  const save = (set: Set<string>) => {
    setCookie('histor_consent', [...set].join(','), 365);
    setCookie('histor_consent_v', CONSENT_VERSION, 365);
    const needsId = set.has('analytics') || set.has('personalization');
    if (needsId && !document.cookie.includes('histor_aid=')) setCookie('histor_aid', crypto.randomUUID(), 395);
    if (!needsId) setCookie('histor_aid', '', 0);
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
