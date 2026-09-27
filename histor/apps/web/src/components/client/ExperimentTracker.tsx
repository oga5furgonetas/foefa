'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from './ReadTracker';

/**
 * Mide impresiones (titular visible al menos un 50 %) y clics de las
 * tarjetas que participan en un experimento de titular. El ganador lo decide
 * la lectura real en la noticia, no el clic.
 */
export function ExperimentTracker() {
  const path = usePathname();
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-exp]'));
    if (!els.length) return;
    const seen = new Set<Element>();
    const props = (el: HTMLElement) => ({ exp: el.dataset.exp, variant: el.dataset.variant });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || seen.has(e.target)) continue;
          seen.add(e.target);
          const el = e.target as HTMLElement;
          track([{ type: 'impression', articleId: Number(el.dataset.article), path, props: props(el) }]);
        }
      },
      { threshold: 0.5 },
    );
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-exp]');
      if (el && (ev.target as HTMLElement).closest('a')) track([{ type: 'click', articleId: Number(el.dataset.article), path, props: props(el) }]);
    };
    els.forEach((el) => io.observe(el));
    document.addEventListener('click', onClick, true);
    return () => {
      io.disconnect();
      document.removeEventListener('click', onClick, true);
    };
  }, [path]);
  return null;
}
