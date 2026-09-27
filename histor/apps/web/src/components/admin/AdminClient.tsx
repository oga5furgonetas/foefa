'use client';
/** Acciones del panel: envían JSON a /api/v1/admin/{acción} y refrescan la vista. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiClientError } from '@/components/client/api';

export function MfaForm() {
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const code = String(new FormData(ev.currentTarget).get('code'));
        try {
          await api('/api/v1/auth/mfa', { body: { code } });
          location.reload();
        } catch {
          setErr('Código incorrecto.');
        }
      }}
    >
      <label>
        Código
        <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus />
      </label>
      {err && <div className="alert alert-error">{err}</div>}
      <button className="btn btn-solid">Verificar</button>
    </form>
  );
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (action: string, body: Record<string, unknown>, okText = 'Hecho') => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; message?: string }>(`/api/v1/admin/${action}`, { body });
      setMsg({ ok: true, text: r.message ?? okText });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError ? e.code : 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <span className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status" style={{ padding: '4px 8px' }}>
      {msg.text}
    </span>
  );
}

/** Botón de una sola acción, con confirmación opcional. */
export function ActionButton({ action, body, label, confirm, danger }: { action: string; body: Record<string, unknown>; label: string; confirm?: string; danger?: boolean }) {
  const { busy, msg, run } = useAction();
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button
        className={`btn btn-small${danger ? ' btn-accent' : ''}`}
        disabled={busy}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(action, body);
        }}
      >
        {label}
      </button>
      <Msg msg={msg} />
    </span>
  );
}

type Field = { name: string; label: string; type?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'json'; options?: { value: string; label: string }[]; defaultValue?: string | number | boolean; required?: boolean; min?: number; max?: number; step?: number; hint?: string };

/** Formulario genérico: recoge los campos y los envía como JSON a la acción. */
export function ActionForm({ action, fixed = {}, fields, submit, inline, danger }: { action: string; fixed?: Record<string, unknown>; fields: Field[]; submit: string; inline?: boolean; danger?: boolean }) {
  const { busy, msg, run } = useAction();
  return (
    <form
      className="form"
      style={inline ? { display: 'flex', flexWrap: 'wrap', alignItems: 'end', maxWidth: 'none' } : undefined}
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const body: Record<string, unknown> = { ...fixed };
        for (const x of fields) {
          const raw = f.get(x.name);
          if (x.type === 'checkbox') body[x.name] = raw === 'on';
          else if (x.type === 'number') body[x.name] = raw === '' || raw === null ? undefined : Number(raw);
          else if (x.type === 'json') {
            try {
              body[x.name] = JSON.parse(String(raw));
            } catch {
              window.alert(`JSON no válido en ${x.label}`);
              return;
            }
          } else body[x.name] = raw === null ? undefined : String(raw);
        }
        await run(action, body);
      }}
    >
      {fields.map((x) =>
        x.type === 'checkbox' ? (
          <label key={x.name} className="check">
            <input type="checkbox" name={x.name} defaultChecked={!!x.defaultValue} /> {x.label}
          </label>
        ) : (
          <label key={x.name}>
            {x.label}
            {x.type === 'textarea' || x.type === 'json' ? (
              <textarea name={x.name} defaultValue={String(x.defaultValue ?? '')} required={x.required} style={x.type === 'json' ? { fontFamily: 'var(--mono)', fontSize: 12, minHeight: 220 } : undefined} />
            ) : x.type === 'select' ? (
              <select name={x.name} defaultValue={String(x.defaultValue ?? '')}>
                {x.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input name={x.name} type={x.type ?? 'text'} defaultValue={x.defaultValue === undefined ? undefined : String(x.defaultValue)} required={x.required} min={x.min} max={x.max} step={x.step} />
            )}
            {x.hint && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{x.hint}</span>}
          </label>
        ),
      )}
      <div className="row">
        <button className={`btn btn-small ${danger ? 'btn-accent' : 'btn-solid'}`} disabled={busy}>
          {submit}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  );
}
