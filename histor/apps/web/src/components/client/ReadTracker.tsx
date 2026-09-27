'use client';
/**
 * Medición de lectura real (no solo clics): vista, profundidad de lectura y
 * tiempo activo. Sin consentimiento se envía sin identificador (el servidor
 * lo descarta). Se usa sendBeacon para no bloquear la navegación.
 */
import { useEffect } from 'react';

type Ev = { type: string; articleId?: number; value?: number; path?: string; props?: Record<string, unknown> };

export function track(events: Ev[]) {
  const body = JSON.stringify({ events });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/v1/events', new Blob([body], { type: 'application/json' }));
  else fetch('/api/v1/events', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
}

export function ReadTracker({ articleId, experiment }: { articleId?: number; experiment?: { key: string; variant: string } }) {
  useEffect(() => {
    const path = location.pathname;
    const props = experiment ? { exp: experiment.key, variant: experiment.variant } : undefined;
    track([{ type: 'page_view', articleId, path, props }]);
    if (!articleId) return;
    let maxScroll = 0;
    let active = 0;
    let last = Date.now();
    let visible = document.visibilityState === 'visible';
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.min(1, (h.scrollTop + window.innerHeight) / Math.max(1, h.scrollHeight));
      if (pct > maxScroll) maxScroll = pct;
    };
    const tick = () => {
      const now = Date.now();
      if (visible) active += (now - last) / 1000;
      last = now;
    };
    const onVis = () => {
      tick();
      visible = document.visibilityState === 'visible';
      if (!visible) flush();
    };
    let sent = false;
    const flush = () => {
      tick();
      if (sent && active < 5) return;
      sent = true;
      track([
        { type: 'read_progress', articleId, value: Math.round(maxScroll * 100) / 100, props },
        { type: 'dwell', articleId, value: Math.round(active) },
      ]);
      active = 0;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    const iv = setInterval(tick, 5000);
    onScroll();
    return () => {
      flush();
      clearInterval(iv);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [articleId, experiment]);
  return null;
}
