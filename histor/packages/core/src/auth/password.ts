/** Contraseñas con scrypt (nativo de Node, resistente a GPU). */
import crypto from 'node:crypto';

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

const COMMON = new Set(['1234567890', 'contraseña', 'password123', 'qwertyuiop', '1234567891', 'abcdefghij', 'iloveyou12', 'passwort12', 'motdepasse']);

export function passwordProblems(pw: string): string[] {
  const p: string[] = [];
  if (pw.length < 10) p.push('weak');
  if (pw.length > 256) p.push('too_long');
  if (COMMON.has(pw.toLowerCase())) p.push('common');
  return p;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((res, rej) => crypto.scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (e, k) => (e ? rej(e) : res(k))));
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Mismo coste aunque el usuario no exista (evita enumerar cuentas por tiempo).
    await hashPassword(pw);
    return false;
  }
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64url');
  const key = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(pw, Buffer.from(saltB64, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2 }, (e, k) => (e ? rej(e) : res(k))),
  );
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}
