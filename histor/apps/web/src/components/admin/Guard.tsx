import { dict } from '@histor/core/i18n/dictionaries';
import type { Guard } from '@/lib/admin';
import { TwoFactor } from '@/components/client/Account';
import { MfaForm } from './AdminClient';

/** Pantalla que se muestra cuando la guardia no deja pasar. */
export function GuardBlock({ g }: { g: Extract<Guard, { ok: false }> }) {
  const d = dict('es');
  return (
    <section style={{ maxWidth: 520 }}>
      <h1>Acceso restringido</h1>
      {g.reason === 'forbidden' && <p>Tu cuenta no tiene permiso para esta sección.</p>}
      {g.reason === 'ip' && <p>El panel solo admite conexiones desde las IP autorizadas (ADMIN_IP_ALLOWLIST).</p>}
      {g.reason === 'mfa_setup' && (
        <>
          <p>Para usar el panel tienes que activar la verificación en dos pasos (TOTP).</p>
          <TwoFactor a={d.account} enabled={false} />
        </>
      )}
      {g.reason === 'mfa' && (
        <>
          <p>Introduce el código de tu aplicación de autenticación.</p>
          <MfaForm />
        </>
      )}
    </section>
  );
}
