/**
 * Envío de correo. Con RESEND_API_KEY se envía por Resend; sin clave, el
 * correo queda en `mail_outbox` con estado "logged" (visible en el panel)
 * y NO se envía: nunca se simula un envío que no ha ocurrido.
 */
import type { Db } from '../db/client';
import { outbox } from '../db/schema';
import { env } from '../env';

export type Email = { to: string; subject: string; html: string; text: string; kind: string };

export async function sendEmail(db: Db, m: Email, fetchImpl: typeof fetch = fetch): Promise<'sent' | 'logged' | 'failed'> {
  const e = env();
  if (!e.RESEND_API_KEY) {
    await db.insert(outbox).values({ to: m.to, subject: m.subject, html: m.html, textBody: m.text, kind: m.kind, status: 'logged', provider: null });
    return 'logged';
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const ok = res.ok;
    await db.insert(outbox).values({
      to: m.to,
      subject: m.subject,
      html: m.html,
      textBody: m.text,
      kind: m.kind,
      status: ok ? 'sent' : 'failed',
      provider: 'resend',
      error: ok ? null : `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
      sentAt: ok ? new Date() : null,
    });
    return ok ? 'sent' : 'failed';
  } catch (err) {
    await db.insert(outbox).values({ to: m.to, subject: m.subject, html: m.html, textBody: m.text, kind: m.kind, status: 'failed', provider: 'resend', error: String(err).slice(0, 300) });
    return 'failed';
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plantilla sobria y accesible (tablas para clientes de correo). */
export function emailLayout(opts: { lang: string; title: string; bodyHtml: string; footer: string }): string {
  return `<!doctype html><html lang="${opts.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;background:#f6f3ec;font-family:Georgia,'Times New Roman',serif;color:#16181d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" style="max-width:600px;background:#ffffff;border-top:4px solid #16181d" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e6e1d6"><span style="font-size:26px;font-weight:700;letter-spacing:-0.5px">histor</span></td></tr>
<tr><td style="padding:24px 28px;font-size:16px;line-height:1.55">${opts.bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e6e1d6;font-family:Arial,sans-serif;font-size:12px;color:#5b6070">${opts.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function escapeHtml(s: string): string {
  return esc(s);
}
