import { listPlans } from '@histor/core/services/admin';
import { paymentsEnabled, yearlySavingPercent } from '@histor/core/billing/index';
import { revenueSummary } from '@histor/core/billing/index';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionForm } from '@/components/admin/AdminClient';
import { fmtMoney } from '@/lib/format';

export default async function Pricing() {
  const g = await adminGuard('pricing.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const plans = await listPlans(db());
  const rev = await revenueSummary(db(), new Date(Date.now() - 30 * 86400000));
  return (
    <>
      <h1>Precios por mercado</h1>
      {!paymentsEnabled() && <div className="notice notice-developing">Stripe no está configurado (STRIPE_SECRET_KEY). Los precios se muestran, pero no se puede cobrar.</div>}
      <p className="muted">
        Importes en la unidad mínima ×100 (5,99 € = 599; ¥980 = 98000). Si se indica un Price ID de Stripe, se usa ese; si no, Checkout crea el precio al vuelo con estos importes. Los impuestos se calculan con Stripe Tax si STRIPE_AUTOMATIC_TAX=1.
      </p>
      <section className="panel">
        <h2>Últimos 30 días</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(rev, null, 2)}</pre>
      </section>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {plans.map((p) => (
          <section key={p.id} className="panel">
            <h2>
              {p.market} {p.isDefault && <span className="badge">por defecto</span>} {!p.active && <span className="badge badge-review">inactivo</span>}
            </h2>
            <p style={{ margin: '0 0 8px' }}>
              {fmtMoney(p.monthlyCents, p.currency, 'es')}/mes · {fmtMoney(p.yearlyCents, p.currency, 'es')}/año · ahorro {yearlySavingPercent(p)} %
              <br />
              <span className="muted" style={{ fontSize: 12 }}>
                {p.countryCodes.join(', ') || 'resto del mundo'}
              </span>
            </p>
            <ActionForm
              action="plan.update"
              fixed={{ id: p.id }}
              fields={[
                { name: 'monthlyCents', label: 'Mensual (×100)', type: 'number', defaultValue: p.monthlyCents, min: 50 },
                { name: 'yearlyCents', label: 'Anual (×100)', type: 'number', defaultValue: p.yearlyCents, min: 50 },
                { name: 'trialDays', label: 'Días de prueba', type: 'number', defaultValue: p.trialDays, min: 0, max: 60 },
                { name: 'stripePriceMonthly', label: 'Stripe Price ID mensual (opcional)', defaultValue: p.stripePriceMonthly ?? '' },
                { name: 'stripePriceYearly', label: 'Stripe Price ID anual (opcional)', defaultValue: p.stripePriceYearly ?? '' },
                { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: p.active },
              ]}
              submit="Guardar"
            />
          </section>
        ))}
      </div>
    </>
  );
}
