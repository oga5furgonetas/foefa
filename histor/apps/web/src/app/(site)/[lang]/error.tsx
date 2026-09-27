'use client';
import { useEffect } from 'react';

const T: Record<string, [string, string, string]> = {
  es: ['Algo ha fallado', 'Estamos trabajando en ello. Inténtalo de nuevo en un momento.', 'Reintentar'],
  en: ['Something went wrong', 'We are working on it. Please try again in a moment.', 'Try again'],
  de: ['Etwas ist schiefgelaufen', 'Wir arbeiten daran. Bitte versuche es gleich noch einmal.', 'Erneut versuchen'],
  fr: ['Une erreur est survenue', 'Nous y travaillons. Réessayez dans un instant.', 'Réessayer'],
  it: ['Qualcosa è andato storto', 'Ci stiamo lavorando. Riprova tra un momento.', 'Riprova'],
  pt: ['Algo deu errado', 'Estamos trabalhando nisso. Tente novamente em instantes.', 'Tentar de novo'],
};

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);
  const lang = typeof document !== 'undefined' ? document.documentElement.lang.slice(0, 2) : 'en';
  const [title, text, retry] = T[lang] ?? T.en;
  return (
    <section className="page" style={{ textAlign: 'center' }}>
      <h1>{title}</h1>
      <p>{text}</p>
      {error.digest && <p className="muted ui" style={{ fontSize: 12 }}>ref: {error.digest}</p>}
      <button className="btn btn-solid" onClick={reset}>
        {retry}
      </button>
    </section>
  );
}
