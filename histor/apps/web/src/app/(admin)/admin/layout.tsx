import '@fontsource-variable/newsreader';
import '@fontsource-variable/inter';
import '@/styles/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { demoMode } from '@histor/core/services/content';
import { LogoMark } from '@/components/Logo';
import { currentUser } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Panel · Histor', robots: { index: false, follow: false } };

const NAV: [string, string][] = [
  ['/admin', 'Resumen'],
  ['/admin/stories', 'Historias'],
  ['/admin/tasks', 'Revisión'],
  ['/admin/sources', 'Fuentes'],
  ['/admin/settings', 'Umbrales y pesos'],
  ['/admin/pricing', 'Precios'],
  ['/admin/taxonomy', 'Secciones e idiomas'],
  ['/admin/users', 'Usuarios'],
  ['/admin/experiments', 'Experimentos'],
  ['/admin/ops', 'Operación'],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es">
      <body>
        <div className="admin">
          <aside className="admin-side" aria-label="Panel">
            <Link href="/admin" className="brand" style={{ color: 'var(--paper)', marginBottom: 14, justifyContent: 'flex-start' }}>
              <span style={{ color: 'var(--paper)' }}>
                <LogoMark size={22} />
              </span>
              <strong style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>histor</strong>
            </Link>
            {demoMode() && <p className="badge badge-demo">MODO DEMO</p>}
            <nav>
              {NAV.map(([h, l]) => (
                <Link key={h} href={h}>
                  {l}
                </Link>
              ))}
            </nav>
            <hr style={{ borderColor: 'rgba(255,255,255,.15)', margin: '14px 0' }} />
            <Link href="/es">← Web</Link>
            {user && (
              <p style={{ fontSize: 12, opacity: 0.7, wordBreak: 'break-all' }}>
                {user.email}
                <br />
                {user.role}
                {user.totpEnabled ? ' · 2FA' : ''}
              </p>
            )}
          </aside>
          <main className="admin-main" id="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
