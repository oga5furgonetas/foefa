'use client';
import { useEffect, useState } from 'react';
import { api, ApiClientError } from './api';
import { track } from './ReadTracker';

export function ArticleActions({
  articleId,
  title,
  labels,
  reportHref,
  loginHref,
}: {
  articleId: number;
  title: string;
  labels: { save: string; saved: string; share: string; copied: string; reportError: string };
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
        className="btn btn-small"
        onClick={async () => {
          const url = location.href;
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
