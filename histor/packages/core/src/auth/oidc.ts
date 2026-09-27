/**
 * Inicio de sesión con Google y Apple (OpenID Connect, flujo de código con
 * PKCE, state y nonce). La firma del id_token se verifica con las claves
 * públicas (JWKS) del proveedor. Solo se activan si hay credenciales.
 */
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { authTokens, oauthAccounts, users } from '../db/schema';
import { env } from '../env';
import { randomToken, sha256 } from '../security/crypto';
import { consumeToken, createSession, findUserByEmail, normalizeEmail } from './users';

export type OidcProvider = 'google' | 'apple';

const CONF = {
  google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['https://accounts.google.com', 'accounts.google.com'] },
  apple: { auth: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', jwks: 'https://appleid.apple.com/auth/keys', issuers: ['https://appleid.apple.com'] },
} as const;

export function oidcEnabled(p: OidcProvider): boolean {
  const e = env();
  return p === 'google' ? !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) : !!(e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY);
}

export function redirectUri(p: OidcProvider): string {
  return `${env().PUBLIC_BASE_URL.replace(/\/$/, '')}/api/v1/auth/oauth/${p}/callback`;
}

export async function authorizeUrl(db: Db, p: OidcProvider, opts: { lang: string; returnTo: string }): Promise<string> {
  const state = randomToken(24);
  const nonce = randomToken(16);
  const verifier = randomToken(32);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  await db.insert(authTokens).values({
    tokenHash: sha256(state),
    kind: 'oauth_state',
    data: { provider: p, nonce, verifier, lang: opts.lang, returnTo: opts.returnTo.startsWith('/') ? opts.returnTo : '/' },
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  const e = env();
  const params = new URLSearchParams({
    client_id: p === 'google' ? e.GOOGLE_CLIENT_ID! : e.APPLE_CLIENT_ID!,
    redirect_uri: redirectUri(p),
    response_type: 'code',
    scope: p === 'google' ? 'openid email profile' : 'name email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (p === 'apple') params.set('response_mode', 'form_post');
  return `${CONF[p].auth}?${params.toString()}`;
}

function appleClientSecret(): string {
  const e = env();
  const header = { alg: 'ES256', kid: e.APPLE_KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: e.APPLE_TEAM_ID, iat: now, exp: now + 3600, aud: 'https://appleid.apple.com', sub: e.APPLE_CLIENT_ID };
  const data = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: e.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}

type Jwk = crypto.JsonWebKey & { kid?: string };
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();

export async function verifyJwt(
  token: string,
  opts: { jwksUrl: string; issuers: readonly string[]; audience: string; nonce?: string; fetchImpl?: typeof fetch; jwks?: Jwk[] },
): Promise<Record<string, unknown>> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('JWT mal formado');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { alg: string; kid?: string };
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
  let keys = opts.jwks;
  if (!keys) {
    const cached = jwksCache.get(opts.jwksUrl);
    if (cached && Date.now() - cached.at < 3600_000) keys = cached.keys;
    else {
      const res = await (opts.fetchImpl ?? fetch)(opts.jwksUrl, { signal: AbortSignal.timeout(10_000) });
      keys = ((await res.json()) as { keys: Jwk[] }).keys;
      jwksCache.set(opts.jwksUrl, { keys, at: Date.now() });
    }
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('clave de firma desconocida');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(`${h}.${p}`);
  const sig = Buffer.from(s, 'base64url');
  let ok = false;
  if (header.alg === 'RS256') ok = crypto.verify('sha256', data, key, sig);
  else if (header.alg === 'ES256') ok = crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig);
  else throw new Error(`algoritmo no permitido: ${header.alg}`);
  if (!ok) throw new Error('firma inválida');
  if (!opts.issuers.includes(String(payload.iss))) throw new Error('emisor inválido');
  const aud = payload.aud;
  if (!(aud === opts.audience || (Array.isArray(aud) && aud.includes(opts.audience)))) throw new Error('audiencia inválida');
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() - 60_000) throw new Error('token caducado');
  if (opts.nonce && payload.nonce !== opts.nonce) throw new Error('nonce inválido');
  return payload;
}

export async function handleCallback(
  db: Db,
  p: OidcProvider,
  input: { code: string; state: string; userJson?: string | null; userAgent?: string | null; ipHash?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; returnTo: string; lang: string }> {
  const st = await consumeToken(db, input.state, 'oauth_state');
  if (!st || st.data.provider !== p) throw new Error('state inválido o caducado');
  const e = env();
  const clientId = p === 'google' ? e.GOOGLE_CLIENT_ID! : e.APPLE_CLIENT_ID!;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: redirectUri(p),
    client_id: clientId,
    client_secret: p === 'google' ? e.GOOGLE_CLIENT_SECRET! : appleClientSecret(),
    code_verifier: String(st.data.verifier),
  });
  const res = await fetchImpl(CONF[p].token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`intercambio de código: HTTP ${res.status}`);
  const tok = (await res.json()) as { id_token?: string };
  if (!tok.id_token) throw new Error('sin id_token');
  const claims = await verifyJwt(tok.id_token, { jwksUrl: CONF[p].jwks, issuers: CONF[p].issuers, audience: clientId, nonce: String(st.data.nonce), fetchImpl });
  const email = typeof claims.email === 'string' ? normalizeEmail(claims.email) : null;
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  const sub = String(claims.sub);
  if (!email || !verified) throw new Error('el proveedor no confirma el correo');

  const [linked] = await db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, p), eq(oauthAccounts.providerAccountId, sub))).limit(1);
  let userId = linked?.userId ?? null;
  if (!userId) {
    const existing = await findUserByEmail(db, email);
    if (existing) userId = existing.id;
    else {
      let name: string | null = typeof claims.name === 'string' ? claims.name : null;
      if (!name && input.userJson) {
        try {
          const u = JSON.parse(input.userJson) as { name?: { firstName?: string; lastName?: string } };
          name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ') || null;
        } catch {
          /* Apple solo manda el nombre la primera vez; si falla, sin nombre */
        }
      }
      const [u] = await db.insert(users).values({ email, name, emailVerifiedAt: new Date(), language: String(st.data.lang ?? 'en') }).returning({ id: users.id });
      userId = u.id;
    }
    await db.insert(oauthAccounts).values({ provider: p, providerAccountId: sub, userId }).onConflictDoNothing();
  }
  const token = await createSession(db, userId, { userAgent: input.userAgent, ipHash: input.ipHash });
  return { token, returnTo: String(st.data.returnTo ?? '/'), lang: String(st.data.lang ?? 'en') };
}
