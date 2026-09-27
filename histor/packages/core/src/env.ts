/**
 * Configuración por entorno. Ningún secreto vive en el código: todo sale de
 * variables de entorno (ver .env.example, que explica cada una).
 * Sin claves externas, el sistema arranca en modo local/DEMO y cada
 * integración ausente se desactiva de forma explícita (nunca se simula).
 */
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === '1' || v === 'true' || v === 'yes');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('postgres://histor:histor@localhost:5432/histor_dev'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRETS: z.string().default(''),
  DATA_ENCRYPTION_KEY: z.string().default(''),
  ANALYTICS_SALT: z.string().default(''),
  DEMO_MODE: bool,
  INGEST_ENABLED: bool,
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  CONTACT_EMAIL: z.string().email().optional(),
  BOT_CONTACT_URL: z.string().optional(),
  // IA (todas opcionales; sin ellas, redacción determinista)
  AI_PROVIDER_WRITING: z.string().optional(),
  AI_PROVIDER_EXTRACTION: z.string().optional(),
  AI_PROVIDER_TRANSLATION: z.string().optional(),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(0),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  // Pagos
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_AUTOMATIC_TAX: bool,
  // Correo
  EMAIL_FROM: z.string().default('Histor <no-reply@localhost>'),
  RESEND_API_KEY: z.string().optional(),
  // Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  // Fuentes con API autorizada (opcionales)
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  // Redes (publicación)
  BLUESKY_HANDLE: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),
  MASTODON_BASE_URL: z.string().optional(),
  MASTODON_TOKEN: z.string().optional(),
  // Observabilidad
  SENTRY_DSN: z.string().optional(),
  METRICS_TOKEN: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  // Almacenamiento S3 compatible (imágenes propias, copias)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  // Datos legales del titular (placeholders visibles si faltan)
  LEGAL_ENTITY_NAME: z.string().optional(),
  LEGAL_ADDRESS: z.string().optional(),
  LEGAL_TAX_ID: z.string().optional(),
  LEGAL_REGISTRY: z.string().optional(),
  LEGAL_REPRESENTATIVE: z.string().optional(),
  LEGAL_EDITOR_IN_CHARGE: z.string().optional(),
  DPO_EMAIL: z.string().optional(),
  ADMIN_IP_ALLOWLIST: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/** Solo para tests. */
export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

/** Comprueba lo imprescindible para producción y devuelve la lista de problemas. */
export function productionProblems(e: Env = env()): string[] {
  const problems: string[] = [];
  if (!e.SESSION_SECRETS || e.SESSION_SECRETS.split(',')[0].length < 32)
    problems.push('SESSION_SECRETS: falta o es corta (mínimo 32 caracteres).');
  if (!e.DATA_ENCRYPTION_KEY || e.DATA_ENCRYPTION_KEY.length < 32)
    problems.push('DATA_ENCRYPTION_KEY: falta o es corta (mínimo 32 caracteres).');
  if (!e.ANALYTICS_SALT) problems.push('ANALYTICS_SALT: falta.');
  if (e.PUBLIC_BASE_URL.startsWith('http://localhost')) problems.push('PUBLIC_BASE_URL apunta a localhost.');
  if (e.DEMO_MODE) problems.push('DEMO_MODE está activo en producción.');
  return problems;
}
