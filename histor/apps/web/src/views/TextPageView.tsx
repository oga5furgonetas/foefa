import type { LegalPage } from '@histor/core/legal/pages';
import { fillVars, type LegalVars } from '@histor/core/legal/vars';

const PENDING_RE = /(\[(?:PENDIENTE|PENDING|AUSSTEHEND|À COMPLÉTER|DA COMPLETARE|PENDENTE)[^\]]*\])/g;
const IS_PENDING = /^\[(?:PENDIENTE|PENDING|AUSSTEHEND|À COMPLÉTER|DA COMPLETARE|PENDENTE)/;

/** Resalta los datos que el propietario aún no ha configurado: nunca se inventan. */
function Rich({ text }: { text: string }) {
  const parts = text.split(PENDING_RE);
  return (
    <>
      {parts.map((p, i) =>
        IS_PENDING.test(p) ? (
          <mark key={i} className="pending">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function TextPageView({ page, vars, children, updated }: { page: LegalPage; vars: LegalVars; children?: React.ReactNode; updated?: string }) {
  return (
    <article className="page">
      <h1>{fillVars(page.title, vars)}</h1>
      <p className="muted ui" style={{ fontSize: 15 }}>
        {fillVars(page.description, vars)}
      </p>
      {page.sections.map((s, i) => (
        <section key={i}>
          {s.h && <h2>{fillVars(s.h, vars)}</h2>}
          {s.p.map((p, j) => (
            <p key={j}>
              <Rich text={fillVars(p, vars)} />
            </p>
          ))}
        </section>
      ))}
      {children}
      {updated && <p className="muted ui" style={{ fontSize: 13, marginTop: 30 }}>{updated}</p>}
    </article>
  );
}
