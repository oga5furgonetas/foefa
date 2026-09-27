/**
 * Tarjeta tipográfica que ocupa el hueco de la imagen cuando no hay una
 * fotografía con licencia verificada. Es claramente un gráfico, no una foto:
 * Histor nunca rellena con imágenes que puedan confundirse con el hecho.
 */
export function TypoCard({ category, label }: { category?: string | null; label: string }) {
  return (
    <div className="typo-card" role="img" aria-label={label}>
      <span className="mark" aria-hidden>
        <i />
        <b />
        <i />
      </span>
      <span className="cat">{category ?? 'Histor'}</span>
    </div>
  );
}
