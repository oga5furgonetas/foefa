/**
 * Publicidad propia: la ropa FDs de Dani (03-10-2026, «añádele anuncios, por ejemplo la ropa de
 * FDs»). Siempre rotulada «Publicidad» y con aspecto distinto al de una noticia. Las fotos son las
 * de la tienda, copiadas en /public/promo (no depende de que otra web responda). Cada prenda abre
 * la tienda con esa prenda ya elegida (?prenda=…) y la visita se mide con utm_source=histor.
 */
const STORE = 'https://flotadsp.com/t/c9d87d2c73589c989e11';

const ITEMS = [
  { key: 'gorra', img: '/promo/fds-gorra.jpg', price: 79, names: { es: 'Gorra FDs', en: 'FDs cap' } },
  { key: 'sudadera', img: '/promo/fds-hoodie.jpg', price: 129, names: { es: 'Hoodie FDs', en: 'FDs hoodie' } },
  { key: 'chubasquero', img: '/promo/fds-cortavientos.jpg', price: 149, names: { es: 'Cortavientos FDs', en: 'FDs windbreaker' } },
] as const;

const TEXT = {
  es: { label: 'Publicidad', title: 'FDs · Built for speed', dek: 'Ropa de edición limitada. −10 % en tu primera compra.', buy: 'Ver' },
  en: { label: 'Advertisement', title: 'FDs · Built for speed', dek: 'Limited-edition apparel. 10% off your first order.', buy: 'Shop' },
} as const;

export function HouseAd({ lang, placement }: { lang: string; placement: string }) {
  const tx = lang === 'es' ? TEXT.es : TEXT.en;
  const link = (prenda: string) => `${STORE}?prenda=${prenda}&utm_source=histor&utm_medium=house&utm_campaign=${placement}`;
  const price = (n: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  return (
    <aside className="house-ad" aria-label={tx.label}>
      <div className="house-ad-head">
        <span className="house-ad-label">{tx.label}</span>
        <strong>{tx.title}</strong>
        <span className="house-ad-dek">{tx.dek}</span>
      </div>
      <div className="house-ad-items">
        {ITEMS.map((it) => (
          <a key={it.key} href={link(it.key)} target="_blank" rel="sponsored noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.img} alt={lang === 'es' ? it.names.es : it.names.en} width={480} height={480} loading="lazy" decoding="async" />
            <span className="house-ad-name">{lang === 'es' ? it.names.es : it.names.en}</span>
            <span className="house-ad-price">
              {price(it.price)} · {tx.buy} →
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
