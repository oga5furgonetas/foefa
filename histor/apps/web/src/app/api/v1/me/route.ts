import { premiumStatus } from '@histor/core/billing/index';
import { handler, json, sessionUser } from '@/lib/api';
import { db } from '@/lib/server';

export const GET = handler(async (req) => {
  const u = await sessionUser(req);
  if (!u) return json({ user: null, premium: false });
  const { premium } = await premiumStatus(db(), u.id);
  return json({ user: { name: u.name, email: u.email, role: u.role, language: u.language, emailVerified: u.emailVerified, totpEnabled: u.totpEnabled, mfaPassed: u.mfaPassed }, premium });
});
