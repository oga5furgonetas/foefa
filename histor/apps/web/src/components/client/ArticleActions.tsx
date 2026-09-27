'use client';
import { useState } from 'react';
import { api } from './api';
import { track } from './ReadTracker';

export function ArticleActions({ articleId, title, labels, reportHref }: { articleId: number; title: string; labels: { save: string; saved: string; share: string; copied: string; reportError: string }; reportHref: string }) {
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="actions ui">
      <button
        className="btn btn-small"
        onClick={async () => {
          try {
            await api(`/api/v1/saved/${articleId}`, { method: saved ? 'DELETE' : 'POST', body: {} });
            setSaved(!saved);
            track([{ type: 'save', articleId }]);
          } catch {
            location.href = `${reportHref.split('/').slice(0, 2).join('/')}/${document.documentElement.lang === 'en' ? 'login' : ''}`;
          }
        }}
        aria-pressed={saved}
      >
        {saved ? labels.saved : labels.save}
      </button>
      <button
        className="btn btn-small"
        onClick={async () => {
          const url = location.href;
          track([{ type: 'share', articleId }]);
          if (navigator.share) {
            await navigator.share({ title, url }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(url);
            setMsg(labels.copied);
          }
        }}
      >
        {labels.share}
      </button>
      <a className="btn btn-small" href={`${reportHref}?url=${encodeURIComponent(typeof location !== 'undefined' ? location.pathname : '')}`}>
        {labels.reportError}
      </a>
      {msg && <span className="muted" role="status">{msg}</span>}
    </div>
  );
}
