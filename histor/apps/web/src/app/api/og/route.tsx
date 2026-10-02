import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { category } from '@histor/core/config/categories';
import { isActiveLanguage } from '@histor/core/config/languages';
import { articles } from '@histor/core/db/schema';
import { dict } from '@histor/core/i18n/dictionaries';
import { db } from '@/lib/server';

export const runtime = 'nodejs';

/**
 * Imagen para redes (1200×630). Es un gráfico tipográfico, no una foto:
 * Histor no ilustra noticias con imágenes que puedan confundirse con el hecho.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const l = p.get('lang') ?? 'en';
  const lang = isActiveLanguage(l) ? l : 'en';
  const d = dict(lang);
  const slug = (p.get('slug') ?? '').slice(0, 200);
  const [a] = slug
    ? await db()
        .select({ headline: articles.headline, categoryId: articles.categoryId, isDeveloping: articles.isDeveloping, isDemo: articles.isDemo, status: articles.status, evidenceConfidence: articles.evidenceConfidence })
        .from(articles)
        .where(and(eq(articles.language, lang), eq(articles.slug, slug)))
        .limit(1)
    : [];
  const headline = a?.headline ?? d.tagline;
  const label = !a ? 'Histor' : a.status === 'retracted' ? d.label.retracted : a.isDeveloping ? d.label.developing : `✓ ${d.label.verified}`;
  const color = !a ? '#15171c' : a.status === 'retracted' ? '#15171c' : a.isDeveloping ? '#8f5400' : '#0b6b55';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fbfaf7', padding: '64px 72px', borderBottom: '14px solid #b3261e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 64, height: 64, background: '#15171c', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, gap: 0 }}>
            <div style={{ width: 9, height: 36, background: '#fbfaf7' }} />
            <div style={{ width: 14, height: 8, background: '#b3261e' }} />
            <div style={{ width: 9, height: 36, background: '#fbfaf7' }} />
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#15171c', letterSpacing: -1 }}>Histor.</div>
          {a?.isDemo && <div style={{ marginLeft: 'auto', fontSize: 26, color: '#6b2fb3', border: '3px solid #6b2fb3', padding: '4px 12px' }}>DEMO</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {a?.categoryId && <div style={{ fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: '#5d6270' }}>{category(a.categoryId)?.names[lang]}</div>}
          <div style={{ fontSize: headline.length > 90 ? 50 : 62, lineHeight: 1.1, fontWeight: 700, color: '#15171c' }}>{headline.slice(0, 160)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, color: '#5d6270' }}>
          {label && <div style={{ color, fontWeight: 700 }}>{label}</div>}
          <div>{d.tagline}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
