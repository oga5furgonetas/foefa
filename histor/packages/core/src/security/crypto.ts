/**
 * Criptografía con el módulo nativo de Node (sin dependencias).
 * - Firmas con SESSION_SECRETS (lista separada por comas: la primera firma,
 *   todas verifican → rotación de claves sin cerrar sesiones).
 * - Cifrado AES-256-GCM con DATA_ENCRYPTION_KEY para secretos en BD (TOTP).
 */
import crypto from 'node:crypto';
import { env } from '../env';

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function secrets(): string[] {
  const list = env()
    .SESSION_SECRETS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length) return list;
  if (env().NODE_ENV === 'production') throw new Error('SESSION_SECRETS es obligatorio en producción');
  return ['histor-dev-only-secret-do-not-use-in-production'];
}

export function hmac(data: string, secret = secrets()[0]): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Firma "valor.firma" y verifica con cualquiera de las claves vigentes. */
export function sign(value: string): string {
  return `${value}.${hmac(value)}`;
}

export function unsign(signed: string): string | null {
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  return secrets().some((s) => safeEqual(hmac(value, s), mac)) ? value : null;
}

function encKey(): Buffer {
  const k = env().DATA_ENCRYPTION_KEY;
  if (!k) {
    if (env().NODE_ENV === 'production') throw new Error('DATA_ENCRYPTION_KEY es obligatoria en producción');
    return crypto.createHash('sha256').update('histor-dev-only-encryption-key').digest();
  }
  return crypto.createHash('sha256').update(k).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split('.');
  if (v !== 'v1') throw new Error('formato de cifrado desconocido');
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

/** Hash de IP con sal diaria: sirve para limitar abusos sin guardar la IP. */
export function ipHash(ip: string | null | undefined, day = new Date().toISOString().slice(0, 10)): string | null {
  if (!ip) return null;
  return sha256(`${env().ANALYTICS_SALT || 'histor-dev-salt'}|${day}|${ip}`).slice(0, 32);
}
