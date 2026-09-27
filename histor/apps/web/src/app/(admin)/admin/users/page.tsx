import { ROLES } from '@histor/core/domain';
import { listUsers } from '@histor/core/services/admin';
import { adminGuard } from '@/lib/admin';
import { db } from '@/lib/server';
import { GuardBlock } from '@/components/admin/Guard';
import { ActionForm } from '@/components/admin/AdminClient';
import { When } from '@/components/admin/Bits';

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const g = await adminGuard('users.manage');
  if (!g.ok) return <GuardBlock g={g} />;
  const q = (await searchParams).q;
  const rows = await listUsers(db(), q);
  return (
    <>
      <h1>Usuarios</h1>
      <form className="form" style={{ display: 'flex', gap: 10, maxWidth: 'none', alignItems: 'end' }}>
        <label>
          Correo
          <input name="q" defaultValue={q} />
        </label>
        <button className="btn btn-small btn-solid">Buscar</button>
      </form>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Alta</th>
              <th>Último acceso</th>
              <th>Rol</th>
              <th>Premium manual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.email}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {u.name ?? ''} {u.verified ? '· correo verificado' : '· sin verificar'} {u.totpEnabled ? '· 2FA' : ''}
                  </div>
                </td>
                <td>
                  <When d={u.createdAt} />
                </td>
                <td>
                  <When d={u.lastLoginAt} />
                </td>
                <td>
                  <ActionForm action="user.role" fixed={{ id: u.id }} inline fields={[{ name: 'role', label: '', type: 'select', options: ROLES.map((r) => ({ value: r, label: r })), defaultValue: u.role }]} submit="Cambiar" />
                </td>
                <td>
                  <ActionForm action="user.premium" fixed={{ id: u.id }} inline fields={[{ name: 'days', label: 'Días', type: 'number', min: 1, max: 3650, defaultValue: 30 }]} submit="Conceder" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
