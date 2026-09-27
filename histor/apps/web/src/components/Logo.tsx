/** Marca de Histor: dos pilares (dos fuentes independientes) unidos por la corroboración. */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="32" height="32" rx="4" fill="currentColor" />
      <rect x="8" y="7" width="4.5" height="18" fill="var(--paper)" />
      <rect x="19.5" y="7" width="4.5" height="18" fill="var(--paper)" />
      <rect x="12.5" y="14" width="7" height="4" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark() {
  return <span className="brand-word">histor</span>;
}
