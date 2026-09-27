'use client';
import { useRouter } from 'next/navigation';
import { setCookie } from './api';

export function EditionSwitcher({ lang, current, editions, languages, labels }: { lang: string; current: string | null; editions: { code: string; name: string }[]; languages: { code: string; name: string }[]; labels: { edition: string; language: string } }) {
  const router = useRouter();
  return (
    <form className="ui" style={{ display: 'flex', gap: 10, alignItems: 'center' }} onSubmit={(e) => e.preventDefault()}>
      <label>
        <span className="sr-only">{labels.edition}</span>
        <select
          aria-label={labels.edition}
          value={current ?? ''}
          onChange={(e) => {
            setCookie('histor_edition', e.target.value);
            router.refresh();
          }}
          style={{ border: 0, background: 'transparent', fontSize: 13 }}
        >
          <option value="" disabled>
            {labels.edition}
          </option>
          {editions.map((e) => (
            <option key={e.code} value={e.code}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">{labels.language}</span>
        <select
          aria-label={labels.language}
          value={lang}
          onChange={(e) => {
            setCookie('histor_lang', e.target.value);
            location.href = `/${e.target.value}`;
          }}
          style={{ border: 0, background: 'transparent', fontSize: 13 }}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
