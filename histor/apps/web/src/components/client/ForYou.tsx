'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { consentOf } from './api';

type Item = { id: number; url: string; headline: string; summary: string; reason: string; isDeveloping: boolean; isDemo: boolean };

/**
 * «Para ti»: solo con consentimiento de personalización (o sesión con la
 * opción activa, que el servidor comprueba). El recomendador mezcla
 * intereses con noticias importantes y exploración para no encerrar al
 * lector en una burbuja.
 */
export function ForYou({ lang, labels, seeAllHref, limit = 4 }: { lang: string; labels: { title: string; explain: string; seeAll: string }; seeAllHref: string; limit?: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    const load = () => {
      if (!consentOf().has('personalization')) {
        setItems(null);
        return;
      }
      fetch(`/api/v1/recommendations?lang=${encodeURIComponent(lang)}&limit=${limit}`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items: Item[] }) => setItems(j.items))
        .catch(() => setItems([]));
    };
    load();
    window.addEventListener('histor:consent-changed', load);
    return () => window.removeEventListener('histor:consent-changed', load);
  }, [lang, limit]);
  if (!items?.length) return null;
  return (
    <section aria-labelledby="foryou-h">
      <div className="section-head">
        <h2 id="foryou-h">{labels.title}</h2>
        <Link href={seeAllHref}>{labels.seeAll} →</Link>
      </div>
      <p className="muted ui" style={{ fontSize: 13, marginTop: -6 }}>
        {labels.explain}
      </p>
      <div className="grid grid-4">
        {items.map((a) => (
          <article key={a.id} className="card card-compact" data-reason={a.reason}>
            <h3 className="h">
              <Link href={a.url}>{a.headline}</Link>
            </h3>
            <p className="s">{a.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
