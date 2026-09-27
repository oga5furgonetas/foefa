/**
 * Cuentas: registro, login con bloqueo progresivo, sesiones de servidor,
 * verificación de correo, recuperación, preferencias y derechos GDPR
 * (exportar y borrar). Solo se piden los datos imprescindibles.
 */
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { authTokens, readingHistory, savedArticles, sessions, subscriptions, invoices, userFollows, users, newsletterSubscriptions, pushSubscriptions, notifications, interestProfiles, analyticsEvents, oauthAccounts } from '../db/schema';
import type { Role } from '../domain';
import { emailLayout, escapeHtml, sendEmail } from '../email/send';
import { env } from '../env';
import { href } from '../i18n/routes';
import { audit } from '../services/audit';
import { decrypt, encrypt, randomToken, sha256 } from '../security/crypto';
import { hashPassword, passwordProblems, verifyPassword } from './password';
import { verifyTotp } from './totp';

export const SESSION_COOKIE = 'histor_session';
export const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  language: string | null;
  countryCode: string | null;
  regionId: number | null;
  cityId: number | null;
  totpEnabled: boolean;
  mfaPassed: boolean;
  emailVerified: boolean;
  personalization: boolean;
};

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function isValidEmail(e: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 320;
}

export async function findUserByEmail(db: Db, email: string) {
  const [u] = await db.select().from(users).where(and(sql`lower(${users.email}) = ${normalizeEmail(email)}`, isNull(users.deletedAt))).limit(1);
  return u ?? null;
}

export async function createSession(db: Db, userId: string, meta: { userAgent?: string | null; ipHash?: string | null; mfaPassed?: boolean } = {}): Promise<string> {
  const token = randomToken(32);
  await db.insert(sessions).values({
    idHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ipHash: meta.ipHash ?? null,
    mfaPassed: meta.mfaPassed ?? false,
  });
  return token;
}

/** Valida el token de la cookie; renueva la caducidad (sesión deslizante). */
export async function getSessionUser(db: Db, token: string | null | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20) return null;
  const idHash = sha256(token);
  const [row] = await db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
    .limit(1);
  if (!row) return null;
  if (Date.now() - row.s.lastSeenAt.getTime() > 3600_000) {
    await db.update(sessions).set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) }).where(eq(sessions.idHash, idHash));
  }
  const u = row.u;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    language: u.language,
    countryCode: u.countryCode,
    regionId: u.regionId,
    cityId: u.cityId,
    totpEnabled: u.totpEnabled,
    mfaPassed: row.s.mfaPassed,
    emailVerified: !!u.emailVerifiedAt,
    personalization: u.personalization,
  };
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, sha256(token)));
}

export async function destroyAllSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export type RegisterResult = { ok: true; userId: string } | { ok: false; error: 'invalid_email' | 'weak' | 'taken' };

export async function registerUser(db: Db, input: { email: string; password: string; name?: string | null; language: string; countryCode?: string | null; marketingConsent?: boolean }): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };
  if (passwordProblems(input.password).length) return { ok: false, error: 'weak' };
  if (await findUserByEmail(db, email)) return { ok: false, error: 'taken' };
  const passwordHash = await hashPassword(input.password);
  const [u] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: input.name?.trim().slice(0, 120) || null,
      language: input.language,
      countryCode: input.countryCode ?? null,
      marketingConsent: !!input.marketingConsent,
    })
    .returning({ id: users.id });
  await sendVerification(db, u.id, email, input.language);
  await audit(db, { actor: `user:${u.id}`, action: 'user.register', targetType: 'user', targetId: u.id });
  return { ok: true, userId: u.id };
}

export type LoginResult = { ok: true; token: string; user: SessionUser; needsTotp: boolean } | { ok: false; error: 'invalid' | 'locked' | 'totp' };

export async function loginUser(db: Db, email: string, password: string, meta: { userAgent?: string | null; ipHash?: string | null; totp?: string | null } = {}): Promise<LoginResult> {
  const u = await findUserByEmail(db, email);
  if (u?.lockedUntil && u.lockedUntil > new Date()) return { ok: false, error: 'locked' };
  const ok = await verifyPassword(password, u?.passwordHash);
  if (!u || !ok) {
    if (u) {
      const failed = u.failedLogins + 1;
      await db
        .update(users)
        .set({ failedLogins: failed, lockedUntil: failed >= 8 ? new Date(Date.now() + Math.min(60, 2 ** (failed - 8)) * 60_000) : null })
        .where(eq(users.id, u.id));
    }
    return { ok: false, error: 'invalid' };
  }
  let mfa = false;
  if (u.totpEnabled && u.totpSecret) {
    if (!meta.totp) {
      // Sesión sin 2FA superado: el panel exigirá el código.
      mfa = false;
    } else if (!verifyTotp(decrypt(u.totpSecret), meta.totp)) {
      return { ok: false, error: 'totp' };
    } else mfa = true;
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
  const token = await createSession(db, u.id, { ...meta, mfaPassed: mfa });
  const user = (await getSessionUser(db, token))!;
  await audit(db, { actor: `user:${u.id}`, action: 'user.login', targetType: 'user', targetId: u.id, ipHash: meta.ipHash });
  return { ok: true, token, user, needsTotp: u.totpEnabled && !mfa };
}

async function issueToken(db: Db, userId: string | null, kind: string, hours: number, data: Record<string, unknown> = {}): Promise<string> {
  const token = randomToken(32);
  await db.insert(authTokens).values({ tokenHash: sha256(token), userId, kind, data, expiresAt: new Date(Date.now() + hours * 3600000) });
  return token;
}

export async function consumeToken(db: Db, token: string, kind: string) {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.kind, kind), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .returning();
  return row ?? null;
}

const MAIL_TEXT: Record<string, { verifySubject: string; verifyBody: string; resetSubject: string; resetBody: string; button: string; ignore: string }> = {
  es: { verifySubject: 'Confirma tu correo en Histor', verifyBody: 'Confirma tu dirección de correo para activar tu cuenta:', resetSubject: 'Restablece tu contraseña de Histor', resetBody: 'Has pedido restablecer tu contraseña. El enlace caduca en 1 hora:', button: 'Continuar', ignore: 'Si no has sido tú, ignora este correo.' },
  en: { verifySubject: 'Confirm your email for Histor', verifyBody: 'Confirm your email address to activate your account:', resetSubject: 'Reset your Histor password', resetBody: 'You asked to reset your password. The link expires in 1 hour:', button: 'Continue', ignore: 'If this wasn’t you, ignore this email.' },
  de: { verifySubject: 'Bestätige deine E-Mail bei Histor', verifyBody: 'Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:', resetSubject: 'Histor-Passwort zurücksetzen', resetBody: 'Du möchtest dein Passwort zurücksetzen. Der Link ist 1 Stunde gültig:', button: 'Weiter', ignore: 'Warst du das nicht? Dann ignoriere diese E-Mail.' },
  fr: { verifySubject: 'Confirmez votre e-mail sur Histor', verifyBody: 'Confirmez votre adresse e-mail pour activer votre compte :', resetSubject: 'Réinitialisez votre mot de passe Histor', resetBody: 'Vous avez demandé à réinitialiser votre mot de passe. Le lien expire dans 1 heure :', button: 'Continuer', ignore: "Si ce n'était pas vous, ignorez cet e-mail." },
  it: { verifySubject: 'Conferma la tua email su Histor', verifyBody: "Conferma il tuo indirizzo email per attivare l'account:", resetSubject: 'Reimposta la password di Histor', resetBody: 'Hai chiesto di reimpostare la password. Il link scade tra 1 ora:', button: 'Continua', ignore: 'Se non sei stato tu, ignora questa email.' },
  pt: { verifySubject: 'Confirme seu e-mail no Histor', verifyBody: 'Confirme seu endereço de e-mail para ativar sua conta:', resetSubject: 'Redefina sua senha do Histor', resetBody: 'Você pediu para redefinir sua senha. O link expira em 1 hora:', button: 'Continuar', ignore: 'Se não foi você, ignore este e-mail.' },
};

function mailBody(lang: string, intro: string, url: string, button: string, ignore: string): { html: string; text: string } {
  return {
    html: emailLayout({
      lang,
      title: intro,
      bodyHtml: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#16181d;color:#fff;padding:10px 18px;text-decoration:none;font-family:Arial,sans-serif">${escapeHtml(button)}</a></p><p style="font-size:13px;color:#5b6070;word-break:break-all">${escapeHtml(url)}</p>`,
      footer: escapeHtml(ignore),
    }),
    text: `${intro}\n\n${url}\n\n${ignore}`,
  };
}

export async function sendVerification(db: Db, userId: string, email: string, lang: string): Promise<void> {
  const token = await issueToken(db, userId, 'verify_email', 72);
  const T = MAIL_TEXT[lang] ?? MAIL_TEXT.en;
  const url = `${env().PUBLIC_BASE_URL}/api/v1/auth/verify?token=${token}&lang=${lang}`;
  await sendEmail(db, { to: email, subject: T.verifySubject, ...mailBody(lang, T.verifyBody, url, T.button, T.ignore), kind: 'verify_email' });
}

export async function verifyEmail(db: Db, token: string): Promise<boolean> {
  const row = await consumeToken(db, token, 'verify_email');
  if (!row?.userId) return false;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  return true;
}

/** Siempre responde igual exista o no la cuenta (no revela qué correos están registrados). */
export async function requestPasswordReset(db: Db, email: string, lang: string): Promise<void> {
  const u = await findUserByEmail(db, email);
  if (!u) return;
  const token = await issueToken(db, u.id, 'reset_password', 1);
  const T = MAIL_TEXT[lang] ?? MAIL_TEXT.en;
  const url = `${env().PUBLIC_BASE_URL}${href.page(lang, 'resetPassword')}?token=${token}`;
  await sendEmail(db, { to: u.email, subject: T.resetSubject, ...mailBody(lang, T.resetBody, url, T.button, T.ignore), kind: 'reset_password' });
}

export async function resetPassword(db: Db, token: string, newPassword: string): Promise<'ok' | 'weak' | 'token'> {
  if (passwordProblems(newPassword).length) return 'weak';
  const row = await consumeToken(db, token, 'reset_password');
  if (!row?.userId) return 'token';
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null }).where(eq(users.id, row.userId));
  await destroyAllSessions(db, row.userId); // cualquier sesión abierta con la contraseña vieja se cierra
  await audit(db, { actor: `user:${row.userId}`, action: 'user.password_reset', targetType: 'user', targetId: row.userId });
  return 'ok';
}

export async function enableTotp(db: Db, userId: string, secretB32: string, code: string): Promise<boolean> {
  if (!verifyTotp(secretB32, code)) return false;
  await db.update(users).set({ totpSecret: encrypt(secretB32), totpEnabled: true }).where(eq(users.id, userId));
  await audit(db, { actor: `user:${userId}`, action: 'user.totp_enabled', targetType: 'user', targetId: userId });
  return true;
}

export async function passMfa(db: Db, token: string, userId: string, code: string): Promise<boolean> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.totpSecret || !verifyTotp(decrypt(u.totpSecret), code)) return false;
  await db.update(sessions).set({ mfaPassed: true }).where(eq(sessions.idHash, sha256(token)));
  return true;
}

/** Derecho de acceso/portabilidad (GDPR art. 15 y 20). */
export async function exportUserData(db: Db, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const { passwordHash: _p, totpSecret: _t, ...profile } = u;
  return {
    exportedAt: new Date().toISOString(),
    profile,
    follows: await db.select().from(userFollows).where(eq(userFollows.userId, userId)),
    saved: await db.select().from(savedArticles).where(eq(savedArticles.userId, userId)),
    readingHistory: await db.select().from(readingHistory).where(eq(readingHistory.userId, userId)).orderBy(desc(readingHistory.lastReadAt)),
    subscriptions: await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    invoices: await db.select().from(invoices).where(eq(invoices.userId, userId)),
    newsletters: await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.userId, userId)),
    interestProfile: await db.select().from(interestProfiles).where(eq(interestProfiles.key, `u:${userId}`)),
    notifications: await db.select().from(notifications).where(eq(notifications.userId, userId)),
  };
}

/**
 * Derecho de supresión (GDPR art. 17). Se borran perfil, sesiones,
 * preferencias, historial, perfiles de interés y analítica asociada. Las
 * facturas se conservan SIN el vínculo al usuario por obligación fiscal.
 * La cancelación en el proveedor de pagos la hace la capa de facturación antes.
 */
export async function deleteUser(db: Db, userId: string, actor: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(analyticsEvents).where(eq(analyticsEvents.userId, userId));
    await tx.delete(interestProfiles).where(eq(interestProfiles.key, `u:${userId}`));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await tx.delete(newsletterSubscriptions).where(eq(newsletterSubscriptions.userId, userId));
    await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
    await tx.update(invoices).set({ userId: null }).where(eq(invoices.userId, userId));
    await tx.delete(users).where(eq(users.id, userId)); // cascada: sesiones, follows, guardados, historial, suscripciones
  });
  await audit(db, { actor, action: 'user.delete', targetType: 'user', targetId: userId });
}

export async function ensureAdmin(db: Db, email: string, password: string): Promise<'created' | 'exists'> {
  const existing = await findUserByEmail(db, email);
  if (existing) {
    if (existing.role !== 'admin') await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
    return 'exists';
  }
  await db.insert(users).values({ email: normalizeEmail(email), passwordHash: await hashPassword(password), role: 'admin', emailVerifiedAt: new Date(), language: 'es' });
  return 'created';
}
