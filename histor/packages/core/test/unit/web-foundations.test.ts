/** SEO, rutas localizadas, geolocalización, seguridad y experimentos. */
import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { checkCsrf, checkOrigin, newCsrfToken } from '../../src/auth/csrf';
import { hashPassword, verifyPassword } from '../../src/auth/password';
import { base32Decode, base32Encode, generateTotpSecret, totp, verifyTotp } from '../../src/auth/totp';
import { verifyJwt } from '../../src/auth/oidc';
import { assignVariant, probabilityBest, validateHeadlineVariant } from '../../src/experiments';
import { detectGeo, parseAcceptLanguage } from '../../src/geo/detect';
import { href, resolveRoute } from '../../src/i18n/routes';
import { dict, DICTIONARIES } from '../../src/i18n/dictionaries';
import { alertPriority, inQuietHours } from '../../src/notify';
import { decrypt, encrypt, sign, unsign } from '../../src/security/crypto';
import { rateLimit, resetRateLimitStore } from '../../src/security/ratelimit';
import { hreflangAlternates, jsonLdString, newsArticleJsonLd, newsSitemapXml, robotsTxt, urlsetXml } from '../../src/seo';
import { socialText } from '../../src/social';
import crypto from 'node:crypto';

describe('rutas localizadas', () => {
  it('ida y vuelta en los 6 idiomas', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'it', 'pt']) {
      expect(resolveRoute(lang, href.category(lang, 'technology').split('/').slice(2))).toEqual({ kind: 'category', categoryId: 'technology' });
      expect(resolveRoute(lang, href.country(lang, 'ES').split('/').slice(2))).toEqual({ kind: 'country', countryCode: 'ES' });
      expect(resolveRoute(lang, href.page(lang, 'howItWorks').split('/').slice(2))).toEqual({ kind: 'page', page: 'howItWorks' });
    }
    expect(resolveRoute('es', ['espana', 'galicia', 'vigo'])).toMatchObject({ kind: 'city', cityKey: 'es-vigo' });
    expect(resolveRoute('de', ['deutschland', 'bayern', 'muenchen'])).toEqual({ kind: 'notFound' });
    expect(resolveRoute('de', ['deutschland', 'bayern', 'munchen'])).toMatchObject({ kind: 'city', cityKey: 'de-munchen' });
    expect(resolveRoute('en', ['united-states', 'california', 'los-angeles'])).toMatchObject({ kind: 'city' });
    expect(resolveRoute('es', ['2026', '09', '27', 'un-titular-1'])).toMatchObject({ kind: 'article', slug: 'un-titular-1' });
    expect(href.article('es', new Date('2026-09-27T10:00:00Z'), 'x')).toBe('/es/2026/09/27/x');
  });

  it('todos los diccionarios tienen las mismas claves que el español', () => {
    const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const ref = keys(dict('es')).sort();
    for (const [lang, d] of Object.entries(DICTIONARIES)) expect(keys(d).sort(), lang).toEqual(ref);
  });
});

describe('geolocalización', () => {
  const h = (m: Record<string, string>) => (k: string) => m[k.toLowerCase()] ?? null;
  it('usa la cabecera del CDN para la edición y el navegador para el idioma', () => {
    const g = detectGeo(h({ 'cf-ipcountry': 'DE', 'accept-language': 'en-GB,en;q=0.9,de;q=0.5' }));
    expect(g.lang).toBe('en');
    expect(g.countryCode).toBe('DE');
  });
  it('sin geolocalización, deduce el país de la región del idioma (es-MX → México)', () => {
    const g = detectGeo(h({ 'accept-language': 'es-MX,es;q=0.9' }));
    expect(g).toMatchObject({ lang: 'es', countryCode: 'MX' });
  });
  it('la preferencia guardada manda sobre todo', () => {
    const g = detectGeo(h({ 'cf-ipcountry': 'US', 'accept-language': 'en-US' }), { lang: 'fr', country: 'FR' });
    expect(g).toMatchObject({ lang: 'fr', countryCode: 'FR' });
  });
  it('región y ciudad desde cabeceras de Vercel', () => {
    const g = detectGeo(h({ 'x-vercel-ip-country': 'ES', 'x-vercel-ip-country-region': 'GA', 'x-vercel-ip-city': 'Vigo', 'accept-language': 'gl-ES,es;q=0.8' }));
    expect(g).toMatchObject({ lang: 'es', countryCode: 'ES', regionCode: 'ES-GA', cityKey: 'es-vigo' });
  });
  it('parsea Accept-Language con pesos', () => {
    expect(parseAcceptLanguage('de;q=0.5, fr-CH, en;q=0.8').map((x) => x.lang)).toEqual(['fr', 'en', 'de']);
  });
});

describe('SEO', () => {
  const base = {
    language: 'es',
    slug: 'titular-1',
    headline: 'Un titular de prueba',
    summary: 'Resumen',
    bodyText: 'Cuerpo',
    publishedAt: new Date('2026-09-27T10:00:00Z'),
    updatedAt: new Date('2026-09-27T12:00:00Z'),
    wordCount: 120,
    authorName: 'Redacción Histor',
    authorSlug: 'redaccion',
    authorKind: 'desk' as const,
    sources: [{ name: 'Agencia', url: 'https://agencia.example/1' }],
    corrections: [{ note: 'Se corrige una cifra', createdAt: new Date('2026-09-27T12:00:00Z') }],
    retracted: false,
    isDemo: false,
    keywords: ['ciencia'],
  };
  it('NewsArticle declara la mesa automatizada como Organization (no inventa personas) y las correcciones', () => {
    const j = newsArticleJsonLd(base);
    expect(j['@type']).toBe('NewsArticle');
    expect(j.author['@type']).toBe('Organization');
    expect(j.citation).toHaveLength(1);
    expect(j.correction?.[0]['@type']).toBe('CorrectionComment');
    expect(j.dateModified).toBe('2026-09-27T12:00:00.000Z');
  });
  it('el JSON-LD no puede cerrar la etiqueta script', () => {
    expect(jsonLdString({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
  it('sitemaps XML válidos con hreflang', () => {
    const xml = urlsetXml([{ loc: '/es/2026/09/27/a', lastmod: new Date(), alternates: hreflangAlternates({ es: '/es/2026/09/27/a', en: '/en/2026/09/27/b' }, '/') }]);
    const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
    expect(doc.urlset.url['xhtml:link']).toHaveLength(3);
    const news = newsSitemapXml([{ loc: '/es/x', language: 'es', title: 'A & B <c>', publishedAt: new Date() }]);
    expect(() => new XMLParser().parse(news)).not.toThrow();
    expect(news).toContain('A &amp; B &lt;c&gt;');
  });
  it('en modo DEMO robots.txt prohíbe indexar todo', () => {
    expect(robotsTxt({ demo: true })).toContain('Disallow: /');
    expect(robotsTxt({ demo: false })).toContain('Sitemap:');
  });
});

describe('seguridad', () => {
  it('scrypt verifica y rechaza', async () => {
    const h = await hashPassword('una clave muy larga');
    expect(await verifyPassword('una clave muy larga', h)).toBe(true);
    expect(await verifyPassword('otra', h)).toBe(false);
  });
  it('firma con rotación y cifrado AES-GCM', () => {
    const s = sign('hola');
    expect(unsign(s)).toBe('hola');
    expect(unsign(`${s}x`)).toBeNull();
    const c = encrypt('secreto');
    expect(c).not.toContain('secreto');
    expect(decrypt(c)).toBe('secreto');
  });
  it('CSRF: doble envío firmado y origen', () => {
    const t = newCsrfToken();
    expect(checkCsrf(t, t)).toBe(true);
    expect(checkCsrf(t, `${t}x`)).toBe(false);
    expect(checkCsrf('forjado.firma', 'forjado.firma')).toBe(false);
    expect(checkOrigin('http://localhost:3000', null, 'localhost:3000')).toBe(true);
    expect(checkOrigin('https://malicioso.example', null, 'localhost:3000')).toBe(false);
  });
  it('TOTP RFC 6238 (vector de prueba) y base32', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totp(secret, 59_000, 30, 8).slice(-6)).toBe('287082');
    expect(base32Decode(base32Encode(Buffer.from('histor'))).toString()).toBe('histor');
    const s = generateTotpSecret();
    expect(verifyTotp(s, totp(s))).toBe(true);
  });
  it('limitación de ritmo', async () => {
    resetRateLimitStore();
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await rateLimit({ key: 'k', limit: 3, windowSec: 60 })).allowed);
    expect(results.filter(Boolean).length).toBe(3);
  });
  it('verifica la firma de un id_token (JWKS)', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'cid', exp: Math.floor(Date.now() / 1000) + 60, nonce: 'n1', email: 'a@b.c' })).toString('base64url');
    const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    const ok = await verifyJwt(`${header}.${payload}.${sig}`, { jwksUrl: 'x', issuers: ['https://accounts.google.com'], audience: 'cid', nonce: 'n1', jwks: [jwk] });
    expect(ok.email).toBe('a@b.c');
    await expect(verifyJwt(`${header}.${payload}.${sig}`, { jwksUrl: 'x', issuers: ['https://accounts.google.com'], audience: 'otra', jwks: [jwk] })).rejects.toThrow(/audiencia/);
  });
});

describe('experimentos, alertas y redes', () => {
  it('asignación estable y rechazo de titulares engañosos', () => {
    const v = [{ key: 'a', weight: 1, payload: {} }, { key: 'b', weight: 1, payload: {} }];
    expect(assignVariant('e', 'u1', v).key).toBe(assignVariant('e', 'u1', v).key);
    const art = { headline: 'Madrid acoge la feria con 120 expositores', bodyText: 'La feria de tecnología de Madrid reúne 120 expositores de 14 países.' };
    expect(validateHeadlineVariant('¡¡No creerás lo que pasa en Madrid!!', art).length).toBeGreaterThan(0);
    expect(validateHeadlineVariant('La feria de Madrid reúne 500 expositores', art)).toContain('cifra no presente en el artículo: 500');
    expect(validateHeadlineVariant('La feria de tecnología de Madrid reúne 120 expositores', art)).toEqual([]);
    const p = probabilityBest([{ successes: 10, trials: 100 }, { successes: 30, trials: 100 }]);
    expect(p[1]).toBeGreaterThan(0.95);
  });
  it('alertas: nunca "en desarrollo" ni con poca confianza; respeta horas de silencio', () => {
    const s = { alertMinConfidence: 0.8, alertMinImportance: 0.65 };
    const base = { importance: 0.9, evidenceConfidence: 0.9, isDeveloping: false, countryCode: 'ES', categoryId: 'politics' };
    expect(alertPriority(base, { countryCode: 'ES', categories: [] }, s).send).toBe(true);
    expect(alertPriority({ ...base, isDeveloping: true }, { countryCode: 'ES', categories: [] }, s).send).toBe(false);
    expect(alertPriority({ ...base, evidenceConfidence: 0.6 }, { countryCode: 'ES', categories: [] }, s).send).toBe(false);
    expect(alertPriority({ ...base, importance: 0.7 }, { countryCode: 'FR', categories: [] }, s).send).toBe(false);
    expect(inQuietHours('UTC', 22, 7, new Date('2026-09-27T23:30:00Z'))).toBe(true);
    expect(inQuietHours('UTC', 22, 7, new Date('2026-09-27T12:00:00Z'))).toBe(false);
  });
  it('texto para redes dentro del límite de cada red', () => {
    const t = socialText('x'.repeat(400), 'https://histor.example/es/2026/09/27/a', 'x');
    expect(t.length).toBeLessThanOrEqual(280);
  });
});
