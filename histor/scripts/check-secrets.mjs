#!/usr/bin/env node
/**
 * Falla si algún archivo versionado contiene algo con forma de secreto o si
 * se ha versionado un .env. Se ejecuta en CI y antes de publicar.
 *   node scripts/check-secrets.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['Stripe secret key', /\b(sk|rk)_(live|test)_[0-9A-Za-z]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[0-9A-Za-z]{16,}/],
  ['Anthropic API key', /\bsk-ant-[0-9A-Za-z_-]{20,}/],
  ['OpenAI API key', /\bsk-(proj-)?[0-9A-Za-z]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[0-9A-Za-z]{36,}\b/],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/],
  ['Resend API key', /\bre_[0-9A-Za-z]{8}_[0-9A-Za-z]{20,}/],
  ['Clave privada', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['URL con contraseña', /\b(postgres(ql)?|redis|mysql):\/\/[^:\s/]+:(?!histor@|password@|pass@|postgres@)[^@\s]{6,}@(?!localhost|127\.0\.0\.1|db[:/]|postgres[:/])/],
];

const files = execSync('git ls-files', { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|lock)$/.test(f) && !f.endsWith('package-lock.json'));

const problems = [];
for (const f of files) {
  if (/(^|\/)\.env(\.[^/]+)?$/.test(f) && !f.endsWith('.env.example')) problems.push(`${f}: archivo .env versionado`);
  let text;
  try {
    text = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of PATTERNS) if (re.test(line)) problems.push(`${f}:${i + 1}: posible ${name}`);
  });
}

if (problems.length) {
  console.error('✕ Posibles secretos en el repositorio:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Sin secretos en ${files.length} archivos versionados.`);
