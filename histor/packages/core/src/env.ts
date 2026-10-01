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
  // Planes gratuitos (Groq, Gemini): tokens por modelo en 24 h (0 = sin tope) y la importancia
  // mínima (0-1) de una historia para gastar IA en ella; el resto usa el redactor determinista.
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().nonnegative().default(0),
  AI_MIN_IMPORTANCE: z.coerce.number().min(0).max(1).default(0),
  // Tope de tokens por petición (entrada + salida máxima). Groq gratuito cuenta las dos contra su
  // límite por minuto (8.000): con 7800, la salida pedida cabe en lo que deja la entrada. 0 = sin tope.
  AI_REQUEST_TOKEN_CAP: z.coerce.number().nonnegative().default(0),
  // Modelos con razonamiento (gpt-oss, o-series): «low» gasta muchos menos tokens.
  AI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).optional(),
  // Zona horaria en la que el proveedor renueva el cupo diario (Groq y Gemini: medianoche de California).
  AI_QUOTA_RESET_TZ: z.string().default('America/Los_Angeles'),
  // Idiomas a los que la IA traduce (lista separada por comas; vacío = todos los activos).
  AI_TRANSLATE_TO: z.string().optional(),
  // Redes: bot y canal de Telegram por idioma («es=@histor_es,en=@histor_en»), importancia mínima
  // para publicar y ritmo máximo por red.
  // Anuncios: identificador de Google AdSense («ca-pub-1234…»). Sin él, ni script ni ads.txt.
  ADSENSE_CLIENT: z.string().regex(/^ca-pub-\d{10,20}$/).optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNELS: z.string().optional(),
  SOCIAL_MIN_IMPORTANCE: z.coerce.number().min(0).max(1).default(0.3),
  SOCIAL_MAX_PER_HOUR: z.coerce.number().int().min(1).max(60).default(6),
  // Minutos mínimos entre dos publicaciones en la misma red (0 = sin espera).
  SOCIAL_MIN_INTERVAL_MIN: z.coerce.number().min(0).max(240).default(10),
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
  // Difusión: IndexNow (Bing y otros buscadores al instante) y verificación de Google Search Console y Bing Webmaster.
  INDEXNOW_KEY: z.string().regex(/^[a-zA-Z0-9-]{8,128}$/).optional(),
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  BING_SITE_VERIFICATION: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  // Almacenamiento S3 compatible (copias de seguridad: infra/backup.sh)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Datos legales del titular (placeholders visibles si faltan)
  LEGAL_ENTITY_NAME: z.string().optional(),
  LEGAL_ADDRESS: z.string().optional(),
  LEGAL_TAX_ID: z.string().optional(),
  LEGAL_REGISTRY: z.string().optional(),
  LEGAL_REPRESENTATIVE: z.string().optional(),
  LEGAL_EDITOR_IN_CHARGE: z.string().optional(),
  DPO_EMAIL: z.string().optional(),
  ADMIN_IP_ALLOWLIST: z.string().optional(),
  /** '1' obliga a editores y administradores a usar 2FA (por defecto: sí en producción). */
  ADMIN_REQUIRE_2FA: z.enum(['0', '1']).optional(),
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

export function adminRequires2fa(e: Env = env()): boolean {
  return e.ADMIN_REQUIRE_2FA ? e.ADMIN_REQUIRE_2FA === '1' : e.NODE_ENV === 'production';
}

/** ¿La IP puede entrar al panel? Lista separada por comas de IPs o rangos IPv4 CIDR. Vacía = sin restricción. */
export function adminIpAllowed(ip: string | null, e: Env = env()): boolean {
  const list = (e.ADMIN_IP_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  if (!ip) return false;
  const v4 = (s: string) => {
    const p = s.split('.').map(Number);
    return p.length === 4 && p.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) ? ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0 : null;
  };
  const addr = v4(ip);
  return list.some((entry) => {
    if (!entry.includes('/')) return entry === ip;
    const [base, bitsRaw] = entry.split('/');
    const b = v4(base);
    const bits = Number(bitsRaw);
    if (b === null || addr === null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (addr & mask) === (b & mask);
  });
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
