/** Cuentas, sesiones, recuperación, 2FA y derechos GDPR contra PostgreSQL. */
import { desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateTotpSecret, totp } from '../../src/auth/totp';
import {
  deleteUser,
  destroySession,
  enableTotp,
  exportUserData,
  getSessionUser,
  loginUser,
  passMfa,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '../../src/auth/users';
import type { Db } from '../../src/db/client';
import { outbox, sessions, users } from '../../src/db/schema';
import { done, freshDb } from './db';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
}, 60_000);
afterAll(done);

const lastMail = async (to: string) => (await db.select().from(outbox).where(eq(outbox.to, to)).orderBy(desc(outbox.id)).limit(1))[0];
const tokenFrom = (text: string) => text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';

describe('registro y acceso', () => {
  it('rechaza correo inválido, contraseña débil y correo repetido', async () => {
    expect(await registerUser(db, { email: 'no-es-correo', password: 'unaclavelarga123', language: 'es' })).toEqual({ ok: false, error: 'invalid_email' });
    expect(await registerUser(db, { email: 'ana@example.org', password: 'corta', language: 'es' })).toEqual({ ok: false, error: 'weak' });
    const ok = await registerUser(db, { email: 'Ana@Example.org', password: 'unaclavelarga123', language: 'es' });
    expect(ok.ok).toBe(true);
    expect(await registerUser(db, { email: 'ana@example.org', password: 'otraclavelarga123', language: 'es' })).toEqual({ ok: false, error: 'taken' });
  });

  it('la contraseña se guarda con scrypt, nunca en claro', async () => {
    const [u] = await db.select().from(users).where(eq(users.email, 'ana@example.org'));
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    expect(u.passwordHash).not.toContain('unaclavelarga123');
  });

  it('envía verificación de correo y el enlace la confirma una sola vez', async () => {
    const mail = await lastMail('ana@example.org');
    expect(mail.kind).toBe('verify_email');
    expect(mail.status).toBe('logged'); // sin RESEND_API_KEY no se simula el envío
    const token = tokenFrom(mail.textBody);
    expect(await verifyEmail(db, token)).toBe(true);
    expect(await verifyEmail(db, token)).toBe(false);
  });

  it('login correcto crea sesión; el token de la cookie no se guarda en claro', async () => {
    const r = await loginUser(db, 'ANA@example.org', 'unaclavelarga123', { userAgent: 'test' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const all = await db.select().from(sessions);
    expect(all.some((s) => s.idHash === r.token)).toBe(false);
    const u = await getSessionUser(db, r.token);
    expect(u?.email).toBe('ana@example.org');
    await destroySession(db, r.token);
    expect(await getSessionUser(db, r.token)).toBeNull();
  });

  it('bloquea la cuenta tras intentos fallidos repetidos', async () => {
    await registerUser(db, { email: 'bruto@example.org', password: 'claveverdadera123', language: 'en' });
    for (let i = 0; i < 8; i++) expect((await loginUser(db, 'bruto@example.org', 'mala-clave-123')).ok).toBe(false);
    const locked = await loginUser(db, 'bruto@example.org', 'claveverdadera123');
    expect(locked).toEqual({ ok: false, error: 'locked' });
  });

  it('recuperación: no revela si el correo existe; el enlace cambia la contraseña y cierra sesiones', async () => {
    await requestPasswordReset(db, 'nadie@example.org', 'es');
    expect(await lastMail('nadie@example.org')).toBeUndefined();
    const s = await loginUser(db, 'ana@example.org', 'unaclavelarga123');
    await requestPasswordReset(db, 'ana@example.org', 'es');
    const token = tokenFrom((await lastMail('ana@example.org')).textBody);
    expect(await resetPassword(db, token, 'corta')).toBe('weak');
    expect(await resetPassword(db, token, 'nuevaclavelarga456')).toBe('ok');
    expect(await resetPassword(db, token, 'otraclavelarga789')).toBe('token');
    if (s.ok) expect(await getSessionUser(db, s.token)).toBeNull();
    expect((await loginUser(db, 'ana@example.org', 'nuevaclavelarga456')).ok).toBe(true);
  });
});

describe('verificación en dos pasos (TOTP)', () => {
  it('activa TOTP y exige el código para superar el segundo paso', async () => {
    const [u] = await db.select().from(users).where(eq(users.email, 'ana@example.org'));
    const secret = generateTotpSecret();
    expect(await enableTotp(db, u.id, secret, '000000')).toBe(false);
    expect(await enableTotp(db, u.id, secret, totp(secret))).toBe(true);
    const [stored] = await db.select().from(users).where(eq(users.id, u.id));
    expect(stored.totpSecret).toMatch(/^v1\./); // cifrado AES-GCM
    const r = await loginUser(db, 'ana@example.org', 'nuevaclavelarga456');
    expect(r.ok && r.needsTotp).toBe(true);
    if (!r.ok) return;
    expect(await passMfa(db, r.token, u.id, '123456')).toBe(false);
    expect(await passMfa(db, r.token, u.id, totp(secret))).toBe(true);
    expect((await getSessionUser(db, r.token))?.mfaPassed).toBe(true);
  });
});

describe('derechos GDPR', () => {
  it('exporta los datos sin secretos y borra la cuenta', async () => {
    const [u] = await db.select().from(users).where(eq(users.email, 'ana@example.org'));
    const data = await exportUserData(db, u.id);
    expect(data?.profile.email).toBe('ana@example.org');
    expect(JSON.stringify(data)).not.toContain('scrypt$');
    expect(JSON.stringify(data)).not.toContain('totpSecret');
    await deleteUser(db, u.id, 'test');
    expect(await db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
  });
});
