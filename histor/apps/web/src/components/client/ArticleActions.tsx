'use client';
import { useEffect, useState } from 'react';
import { api, ApiClientError } from './api';
import { track } from './ReadTracker';

/**
 * Accesos directos para compartir. En España y Latinoamérica las noticias corren por WhatsApp;
 * en el ordenador `navigator.share` casi nunca existe y el botón solo copiaba el enlace.
 * Son enlaces normales (sin scripts de terceros ni rastreo): nada sale hasta que el lector pulsa.
 * Una sola fila de iconos discretos: la barra de diez botones de texto tapaba la noticia (01-10-2026).
 */
const ICONS: Record<string, string> = {
  whatsapp: 'M4 20l1.3-3.9A8 8 0 1 1 8 18.8zM9 8.5c0 3 2.5 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1-.4-2.4-1.8-2.8-2.8l.8-1-1-2z',
  telegram: 'M21 4 3 11l6 2 2 6 3-4 5 4zM9 13l10-7',
  x: 'M5 4l14 16M19 4 5 20',
  facebook: 'M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.6 1.7-1.6H18V3a20 20 0 0 0-2.6-.1C12.9 2.9 11 4.4 11 7.2v2.3H8V13h3v8',
  linkedin: 'M5 9v11M5 4.5v.5M10 20v-7a3 3 0 0 1 6 0v7M10 11v9M4 4h2v2H4z',
  email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  save: 'M6 3h12v18l-6-4-6 4z',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
};

function Icon({ name, filled }: { name: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { id: 'whatsapp', name: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { id: 'telegram', name: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'x', name: 'X', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: 'facebook', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'linkedin', name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'email', name: 'e-mail', href: `mailto:?subject=${t}&body=${t}%0A%0A${u}` },
  ];
}

export function ArticleActions({
  articleId,
  title,
  url,
  labels,
  reportHref,
  loginHref,
}: {
  articleId: number;
  title: string;
  url: string;
  labels: { save: string; saved: string; share: string; copyLink: string; copied: string; reportError: string };
  reportHref: string;
  loginHref: string;
}) {
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    fetch(`/api/v1/saved/${articleId}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { saved: false }))
      .then((j: { saved: boolean }) => setSaved(!!j.saved))
      .catch(() => {});
  }, [articleId]);
  const copy = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setMsg(labels.copied);
    setTimeout(() => setMsg(null), 2500);
  };
  return (
    <div className="actions ui">
      <div className="share-links" role="group" aria-label={labels.share}>
        {native && (
          <button
            className="icon-btn share-native"
            title={labels.share}
            aria-label={labels.share}
            onClick={async () => {
              track([{ type: 'share', articleId }]);
              await navigator.share({ title, url }).catch(() => {});
            }}
          >
            <Icon name="share" />
          </button>
        )}
        {shareLinks(url, title).map((s) => (
          <a
            key={s.id}
            className={`icon-btn share-${s.id}`}
            href={s.href}
            target={s.id === 'email' ? undefined : '_blank'}
            rel="noopener nofollow"
            title={s.name}
            aria-label={`${labels.share}: ${s.name}`}
            onClick={() => track([{ type: 'share', articleId }])}
          >
            <Icon name={s.id} />
          </a>
        ))}
        <button className="icon-btn" title={labels.copyLink} aria-label={labels.copyLink} onClick={copy}>
          <Icon name="link" />
        </button>
        {msg && (
          <span className="muted copied" role="status">
            {msg}
          </span>
        )}
      </div>
      <div className="actions-right">
        <button
          className={`text-btn${saved ? ' is-on' : ''}`}
          onClick={async () => {
            try {
              await api(`/api/v1/saved/${articleId}`, { method: saved ? 'DELETE' : 'POST', body: {} });
              setSaved(!saved);
              if (!saved) track([{ type: 'save', articleId }]);
            } catch (e) {
              if (e instanceof ApiClientError && e.status === 401) location.href = `${loginHref}?next=${encodeURIComponent(location.pathname)}`;
            }
          }}
          aria-pressed={saved}
        >
          <Icon name="save" filled={saved} /> {saved ? labels.saved : labels.save}
        </button>
        <a className="text-btn muted" href={`${reportHref}?article=${articleId}`} rel="nofollow">
          {labels.reportError}
        </a>
      </div>
    </div>
  );
}
