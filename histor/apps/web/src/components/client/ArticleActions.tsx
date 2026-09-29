'use client';
import { useEffect, useState } from 'react';
import { api, ApiClientError } from './api';
import { track } from './ReadTracker';

/**
 * Accesos directos para compartir. En España y Latinoamérica las noticias corren por WhatsApp;
 * en el ordenador `navigator.share` casi nunca existe y el botón solo copiaba el enlace.
 * Son enlaces normales (sin scripts de terceros ni rastreo): nada sale hasta que el lector pulsa.
 */
function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { id: 'whatsapp', name: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { id: 'telegram', name: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'x', name: 'X', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: 'facebook', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'linkedin', name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'email', name: '✉', href: `mailto:?subject=${t}&body=${t}%0A%0A${u}` },
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
  useEffect(() => {
    fetch(`/api/v1/saved/${articleId}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { saved: false }))
      .then((j: { saved: boolean }) => setSaved(!!j.saved))
      .catch(() => {});
  }, [articleId]);
  return (
    <div className="actions ui">
      <button
        className="btn btn-small"
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
        {saved ? `✓ ${labels.saved}` : labels.save}
      </button>
      <button
        className="btn btn-small share-native"
        onClick={async () => {
          track([{ type: 'share', articleId }]);
          if (navigator.share) {
            await navigator.share({ title, url }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(url).catch(() => {});
            setMsg(labels.copied);
          }
        }}
      >
        {labels.share}
      </button>
      <span className="share-links" role="group" aria-label={labels.share}>
        {shareLinks(url, title).map((s) => (
          <a
            key={s.id}
            className={`btn btn-small share-${s.id}`}
            href={s.href}
            target={s.id === 'email' ? undefined : '_blank'}
            rel="noopener nofollow"
            aria-label={`${labels.share}: ${s.id === 'email' ? 'e-mail' : s.name}`}
            onClick={() => track([{ type: 'share', articleId }])}
          >
            {s.name}
          </a>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            setMsg(labels.copied);
          }}
        >
          {labels.copyLink}
        </button>
      </span>
      <a className="btn btn-small" href={`${reportHref}?article=${articleId}`} rel="nofollow">
        {labels.reportError}
      </a>
      {msg && (
        <span className="muted" role="status">
          {msg}
        </span>
      )}
    </div>
  );
}
