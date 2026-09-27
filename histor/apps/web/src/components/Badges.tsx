import type { Dict } from '@histor/core/i18n/dictionaries';

export function Badges({ d, a }: { d: Dict; a: { isBreaking?: boolean; isDeveloping?: boolean; isDemo?: boolean; status?: string; verified?: boolean } }) {
  return (
    <>
      {a.isDemo && <span className="badge badge-demo">{d.label.demo}</span>}
      {a.status === 'retracted' && <span className="badge badge-retracted">{d.label.retracted}</span>}
      {a.isBreaking && a.status !== 'retracted' && (
        <span className="badge badge-breaking">
          <span className="dot pulse" aria-hidden /> {d.label.breaking}
        </span>
      )}
      {a.isDeveloping && a.status !== 'retracted' && <span className="badge badge-developing">{d.label.developing}</span>}
      {a.verified && !a.isDeveloping && a.status !== 'retracted' && <span className="badge badge-verified">✓ {d.label.verified}</span>}
    </>
  );
}
