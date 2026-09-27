import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { can, type Permission } from '@histor/core/domain';
import { adminIpAllowed, adminRequires2fa } from '@histor/core/env';
import type { SessionUser } from '@histor/core/auth/users';
import { currentUser } from './server';

export type Guard = { ok: true; user: SessionUser } | { ok: false; reason: 'forbidden' | 'ip' | 'mfa_setup' | 'mfa'; user: SessionUser | null };

/**
 * Guardia del panel. Se llama en CADA página (no basta el layout: en la
 * navegación del cliente el layout no se vuelve a ejecutar).
 */
export async function adminGuard(p: Permission = 'admin.view'): Promise<Guard> {
  const user = await currentUser();
  if (!user) redirect(`/es/entrar?next=${encodeURIComponent('/admin')}`);
  const h = await headers();
  const ip = h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!adminIpAllowed(ip)) return { ok: false, reason: 'ip', user };
  if (!can(user.role, p)) return { ok: false, reason: 'forbidden', user };
  if (adminRequires2fa() && !user.totpEnabled) return { ok: false, reason: 'mfa_setup', user };
  if (user.totpEnabled && !user.mfaPassed) return { ok: false, reason: 'mfa', user };
  return { ok: true, user };
}
