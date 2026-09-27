import Link from 'next/link';

export function Kpi({ v, l, href }: { v: string | number; l: string; href?: string }) {
  const inner = (
    <>
      <div className="v tnum">{typeof v === 'number' ? v.toLocaleString('es-ES') : v}</div>
      <div className="l">{l}</div>
    </>
  );
  return href ? (
    <Link className="kpi" href={href}>
      {inner}
    </Link>
  ) : (
    <div className="kpi">{inner}</div>
  );
}

export function Bar({ v, mom }: { v: number; mom?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} title={`${pct} %`}>
      <div className={`bar${mom ? ' mom' : ''}`} style={{ flex: 1 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="tnum" style={{ fontSize: 12, minWidth: 30 }}>{pct}</span>
    </div>
  );
}

export function When({ d }: { d: Date | string | null | undefined }) {
  if (!d) return <>—</>;
  const x = new Date(d);
  return <time dateTime={x.toISOString()}>{x.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })}</time>;
}
