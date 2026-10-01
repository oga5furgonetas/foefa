'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

const DISMISSED = 'histor_alerts_dismissed';

/**
 * Invitación a las alertas de última hora del navegador, al acabar de leer. Solo si el navegador las
 * admite, el lector no las tiene ya, no las ha bloqueado y no ha cerrado el aviso. Hasta el
 * 01-10-2026 solo se podían activar desde la cuenta y nadie lo hacía (0 suscriptores).
 */
export function AlertsCta({ vapidKey, label, pitch, enable }: { vapidKey: string | null; label: string; pitch: string; enable: string }) {
  const [state, setState] = useState<'hidden' | 'idle' | 'busy' | 'on'>('hidden');
  useEffect(() => {
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      /* sin almacenamiento: se muestra igual */
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'hidden' : 'idle'))
      .catch(() => setState('idle'));
  }, [vapidKey]);
  if (state === 'hidden' || !vapidKey) return null;
  return (
    <div className="follow-cta alerts-cta ui" role="region" aria-label={label}>
      <span aria-hidden>🔔</span>
      <span className="alerts-text">
        <strong>{label}</strong> <span className="muted">· {pitch}</span>
      </span>
      {state === 'on' ? (
        <span className="badge badge-verified">✓</span>
      ) : (
        <button
          className="btn btn-small btn-solid"
          disabled={state === 'busy'}
          onClick={async () => {
            setState('busy');
            try {
              const perm = await Notification.requestPermission();
              if (perm !== 'granted') return setState('hidden');
              const reg = await navigator.serviceWorker.register('/sw.js');
              const key = Uint8Array.from(atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
              const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
              await api('/api/v1/push/subscribe', { body: { subscription: sub.toJSON(), lang: document.documentElement.lang.slice(0, 2) } });
              setState('on');
            } catch {
              setState('idle');
            }
          }}
        >
          {enable}
        </button>
      )}
      <button
        className="alerts-close"
        aria-label="×"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED, '1');
          } catch {
            /* nada */
          }
          setState('hidden');
        }}
      >
        ×
      </button>
    </div>
  );
}
