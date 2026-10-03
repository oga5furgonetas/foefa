import Link from 'next/link';
import { category } from '@histor/core/config/categories';
import { country } from '@histor/core/config/countries';
import { LANGUAGES } from '@histor/core/config/languages';
import type { ArticleBlock, VerificationBox } from '@histor/core/db/schema';
import type { Dict } from '@histor/core/i18n/dictionaries';
import { t } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { findPlaces } from '@histor/core/text/entities';
import { absoluteUrl } from '@histor/core/seo/index';
import { telegramChannel } from '@histor/core/social/index';
import { env } from '@histor/core/env';
import type { getArticleDetail } from '@histor/core/services/content';
import { NOTES } from '@histor/core/writing/notes';
import { Badges } from '@/components/Badges';
import { StoryCard } from '@/components/Cards';
import { ArticleActions } from '@/components/client/ArticleActions';
import { AlertsCta } from '@/components/client/AlertsCta';
import { ReadTracker } from '@/components/client/ReadTracker';
import { fmtDateTime, fmtTime } from '@/lib/format';

export type ArticleDetail = NonNullable<Awaited<ReturnType<typeof getArticleDetail>>>;

const KIND_LABEL = (d: Dict, kind: string) =>
  ({ correction: d.label.correction, clarification: d.label.clarification, update: d.label.update, retraction: d.label.retracted })[kind] ?? d.label.update;

export function ArticleView({ data, lang, d, tz, experiment }: { data: ArticleDetail; lang: string; d: Dict; tz: string; experiment?: { key: string; variant: string; headline: string } }) {
  const { article: a, story, author, image, video, versions, corrections, alternates, entities, related } = data;
  const retracted = a.status === 'retracted';
  const underReviewNote = NOTES[lang]?.underReview;
  const underReview = !retracted && corrections.some((c) => c.note === underReviewNote && c.version === a.version);
  const cat = category(a.categoryId);
  const place = country(a.countryCode);
  const channel = telegramChannel(lang);
  const telegram = channel?.startsWith('@') ? channel.slice(1) : null;
  const authorName = author ? ((author.names as Record<string, string>)[lang] ?? (author.names as Record<string, string>).en ?? author.slug) : 'Histor';
  const publishedAt = a.publishedAt ?? a.updatedAt;
  const updated = a.version > 1 && a.updatedAt.getTime() - publishedAt.getTime() > 60_000;
  const headline = experiment?.headline || a.headline;
  const verification = a.verification as VerificationBox;
  const body = a.body as ArticleBlock[];
  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.nativeName ?? code;
  // «En esta noticia»: solo personas y organizaciones que aparecen en ESTE texto. Salían «USA»,
  // «EUA» y «Stati Uniti» a la vez, y nombres de otra historia (30-09-2026).
  const articleText = [headline, a.summary, ...body.map((b) => ('text' in b ? b.text : b.type === 'list' ? b.items.map((i) => i.text).join(' ') : ''))].join(' ');
  const shownEntities = entities.filter((e) => e.type !== 'place' && articleText.includes(e.name) && !findPlaces(e.name).length).slice(0, 8);

  return (
    <>
      <ReadTracker articleId={a.id} experiment={experiment ? { key: experiment.key, variant: experiment.variant } : undefined} />
      <article className="article" lang={lang}>
        <header className="article-head">
          <div className="meta">
            {cat && (
              <Link className="kicker" href={href.category(lang, cat.id)}>
                {cat.names[lang]}
              </Link>
            )}
            {place && (
              <Link className="kicker" href={href.country(lang, place.code)}>
                · {place.names[lang] ?? place.names.en}
              </Link>
            )}
            <Badges d={d} a={{ isBreaking: a.isBreaking, isDeveloping: a.isDeveloping, isDemo: a.isDemo, status: a.status, verified: !a.isDeveloping }} />
          </div>
          <h1>{headline}</h1>
          <p className="dek">{a.summary}</p>
          {a.subheadline && !a.isDeveloping && !retracted && (
            <p className="trust" style={{ marginTop: 0 }}>
              <span className="v-ok" aria-hidden>
                ✓
              </span>{' '}
              {a.subheadline}
            </p>
          )}

          {retracted && (
            <div className="notice notice-retracted" role="note">
              <strong>{d.article.retractedNotice}.</strong> {a.retractionNote}
            </div>
          )}
          {underReview && (
            <div className="notice notice-review" role="note">
              <strong>{d.label.underReview}.</strong> {underReviewNote}
            </div>
          )}
          {!retracted && !underReview && a.isDeveloping && (
            <div className="notice notice-developing" role="note">
              <strong>{d.label.developing}.</strong> {d.article.developingNotice}
            </div>
          )}
          {a.isDemo && (
            <div className="notice" style={{ borderColor: 'var(--demo)', background: 'var(--demo-soft)', color: 'var(--demo)' }} role="note">
              {d.demoBanner}
            </div>
          )}

          <div className="byline">
            <span>
              {author ? (
                <Link href={href.author(lang, author.slug)}>
                  <strong>{t(d.article.writtenBy, { author: authorName })}</strong>
                </Link>
              ) : (
                <strong>{t(d.article.writtenBy, { author: authorName })}</strong>
              )}
              {' · '}
              <span className="muted">{t(d.label.readingTime, { n: a.readingMinutes })}</span>
            </span>
            <span className="muted tnum">
              <time dateTime={publishedAt.toISOString()}>{t(d.label.publishedAt, { date: fmtDateTime(publishedAt, lang, tz) })}</time>
              {updated && (
                <>
                  {' · '}
                  <time dateTime={a.updatedAt.toISOString()}>{t(d.label.updatedAt, { time: fmtTime(a.updatedAt, lang, tz) })}</time>
                </>
              )}
            </span>
          </div>
        </header>

        {image && (
          <figure style={{ margin: '0 0 22px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={(image.alt as Record<string, string>)[lang] ?? ''} width={image.width ?? 1200} height={image.height ?? 675} />
            <figcaption className="meta" style={{ marginTop: 6 }}>
              {(image.caption as Record<string, string>)[lang] && <span>{(image.caption as Record<string, string>)[lang]}</span>}
              {image.isIllustrative && <span className="badge badge-developing">{d.article.illustrative}</span>}
              {image.isAiGenerated && <span className="badge badge-review">{d.article.aiImage}</span>}
              <span>
                {t(d.article.imageCredit, { credit: image.attribution })}
                {image.licenseUrl ? (
                  <>
                    {' '}
                    (<a href={image.licenseUrl} rel="license noopener" target="_blank">
                      {image.license}
                    </a>
                    )
                  </>
                ) : (
                  ` (${image.license})`
                )}
              </span>
            </figcaption>
          </figure>
        )}

        {video && !retracted && (
          <figure className="article-video" style={{ margin: '0 0 22px' }}>
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.externalId}?rel=0`}
                title={video.title}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <figcaption className="meta" style={{ marginTop: 6 }}>
              <span>{t(d.article.videoCredit, { channel: video.channelName })}</span>
              <span className="muted">· {video.title}</span>
            </figcaption>
          </figure>
        )}

        <ArticleActions
          articleId={a.id}
          title={headline}
          url={absoluteUrl(href.article(a.language, publishedAt, a.slug))}
          reportHref={href.page(lang, 'report')}
          loginHref={href.page(lang, 'login')}
          labels={{ share: d.article.share, copyLink: d.article.copyLink, save: d.article.save, saved: d.article.saved, copied: d.article.copied, reportError: d.article.reportError }}
        />

        <div className="article-body" style={retracted ? { opacity: 0.75 } : undefined}>
          {body.map((b, i) => {
            // La entrada ya se muestra como entradilla: no se repite.
            if (i === 0 && b.type === 'p' && b.text.trim() === a.summary.trim()) return null;
            switch (b.type) {
              case 'h2':
                return <h2 key={i}>{b.text}</h2>;
              case 'quote':
                return (
                  <blockquote key={i}>
                    <p style={{ margin: 0 }}>«{b.text}»</p>
                    <footer>
                      — {b.speaker}
                      {b.sourceUrl && (
                        <>
                          {' · '}
                          <a href={b.sourceUrl} rel="noopener nofollow" target="_blank">
                            {d.article.sources}
                          </a>
                        </>
                      )}
                    </footer>
                  </blockquote>
                );
              case 'list':
                return (
                  <ul key={i}>
                    {b.items.map((it, j) => (
                      <li key={j}>{it.text}</li>
                    ))}
                  </ul>
                );
              default:
                return <p key={i}>{b.text}</p>;
            }
          })}
        </div>

        {/* Al acabar de leer: las alertas de última hora y el canal de Telegram (así vuelve el lector). */}
        <AlertsCta vapidKey={env().VAPID_PUBLIC_KEY ?? null} label={d.account.alerts} pitch={d.account.alertsPitch} enable={d.account.enable} />
        {telegram && (
          <a className="follow-cta ui" href={`https://t.me/${telegram}`} rel="noopener" target="_blank">
            <span aria-hidden>✈</span> {d.footer.telegram} <span className="muted">· t.me/{telegram}</span>
          </a>
        )}

        {/* La gente viene a leer la noticia: la verificación, las fuentes y la cronología están a
            un clic, plegadas (30-09-2026, «todo este ruido… pon un ver más»). */}
        <details className="verify-more" id="verificacion">
          <summary className="ui">
            <span className="v-ok" aria-hidden>
              ✓
            </span>{' '}
            {t(d.article.seeHowWeVerified, { n: a.sourcesList.length })}
          </summary>

        <VerifyBox v={verification} d={d} />

        <section className="sources" aria-labelledby="sources-h">
          <h2 id="sources-h" className="kicker" style={{ fontSize: 14, color: 'var(--ink)' }}>
            {d.article.sources}
          </h2>
          <p className="muted ui" style={{ fontSize: 14 }}>
            {d.article.sourcesIntro}
          </p>
          <ol>
            {a.sourcesList.map((s, i) => (
              <li key={i}>
                <a href={s.url} rel="noopener nofollow" target="_blank">
                  {s.name}
                </a>{' '}
                <span className="muted">
                  · {(d.source.typeNames as Record<string, string>)[s.sourceType] ?? s.sourceType}
                  {s.isPrimary && ` · ${d.article.primary}`}
                  {s.publishedAt && ` · ${fmtDateTime(s.publishedAt, lang, tz)}`}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {a.timeline.length > 1 && (
          <section aria-labelledby="timeline-h" style={{ margin: '28px 0' }}>
            <h2 id="timeline-h" className="kicker" style={{ fontSize: 14, color: 'var(--ink)' }}>
              {d.article.timeline}
            </h2>
            <ol className="timeline">
              {a.timeline.map((e, i) => (
                <li key={i}>
                  <time className="tnum muted" dateTime={e.at}>
                    {fmtDateTime(e.at, lang, tz)}
                  </time>{' '}
                  — {e.text}
                </li>
              ))}
            </ol>
          </section>
        )}
        </details>

        {(corrections.length > 0 || versions.length > 1) && (
          <section aria-labelledby="corr-h" style={{ margin: '28px 0' }}>
            <h2 id="corr-h" className="kicker" style={{ fontSize: 14, color: 'var(--ink)' }}>
              {d.article.corrections}
            </h2>
            {corrections.length > 0 && (
              <ul className="ui" style={{ fontSize: 15, paddingLeft: 18 }}>
                {corrections.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <strong>{KIND_LABEL(d, c.kind)}</strong> <span className="muted tnum">({fmtDateTime(c.createdAt, lang, tz)})</span>: {c.note}
                  </li>
                ))}
              </ul>
            )}
            {versions.length > 1 && (
              <details className="history">
                <summary>{d.article.history}</summary>
                <ol className="timeline" style={{ marginTop: 10 }}>
                  {versions.map((v) => (
                    <li key={v.version}>
                      <strong>{t(d.article.version, { n: v.version })}</strong> · <span className="muted tnum">{fmtDateTime(v.createdAt, lang, tz)}</span>
                      <div>{v.changeSummary ?? KIND_LABEL(d, v.kind)}</div>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        )}

        {shownEntities.length > 0 && (
          <section aria-labelledby="ent-h">
            <h2 id="ent-h" className="kicker" style={{ fontSize: 14, color: 'var(--ink)' }}>
              {d.article.entities}
            </h2>
            <ul className="tag-list">
              {shownEntities.map((e) => (
                <li key={e.id}>
                  <Link href={href.topic(lang, e.slug)}>{e.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {alternates.length > 0 && (
          <p className="meta" style={{ marginTop: 18 }}>
            {d.article.otherLanguages}:{' '}
            {alternates.map((x, i) => (
              <span key={x.language}>
                {i > 0 && ' · '}
                <Link href={href.article(x.language, x.publishedAt ?? publishedAt, x.slug)} hrefLang={x.language} lang={x.language}>
                  {langName(x.language)}
                </Link>
              </span>
            ))}
          </p>
        )}

        <p className="meta" style={{ marginTop: 18 }}>
          {d.article.automated}{' '}
          <Link href={href.page(lang, 'howItWorks')}>{d.footer.howItWorks} →</Link>
          {story && (
            <>
              {' · '}
              <Link href={href.story(lang, story.slug)}>{d.article.timeline}</Link>
            </>
          )}
          {' · '}
          <Link href={`${href.page(lang, 'report')}?article=${a.id}`}>{d.article.reportError}</Link>
        </p>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="rel-h">
          <div className="section-head">
            <h2 id="rel-h">{d.article.related}</h2>
          </div>
          <div className="grid grid-3">
            {related.slice(0, 6).map((r) => (
              <StoryCard key={r.id} a={r} lang={lang} d={d} compact />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** «Cómo verificamos esta noticia»: qué está confirmado, por quién, qué no y en qué discrepan las fuentes. */
export function VerifyBox({ v, d }: { v: VerificationBox; d: Dict }) {
  return (
    <aside className="verify" aria-labelledby="verify-h">
      <h2 id="verify-h">
        <span className="v-ok" aria-hidden>
          ✓
        </span>{' '}
        {d.article.howWeVerified}
      </h2>
      {v.confirmed.length > 0 && (
        <>
          <h3 className="v-ok">{d.article.confirmed}</h3>
          <ul>
            {v.confirmed.map((c, i) => (
              <li key={i}>
                {c.text} {c.by.length > 0 && <span className="by">— {t(d.article.confirmedBy, { list: c.by.join(', ') })}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {v.attributed.length > 0 && (
        <>
          <h3 className="v-attr">{d.article.attributed}</h3>
          <ul>
            {v.attributed.map((c, i) => (
              <li key={i}>
                {c.text} {c.by.length > 0 && <span className="by">— {c.by.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {v.unconfirmed.length > 0 && (
        <>
          <h3 className="v-no">{d.article.unconfirmed}</h3>
          <ul>
            {v.unconfirmed.map((c, i) => (
              <li key={i}>
                {c.text} {c.by.length > 0 && <span className="by">— {c.by.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {!!v.superseded?.length && (
        <>
          <h3 className="v-no">{d.article.superseded}</h3>
          <ul>
            {v.superseded.map((c, i) => (
              <li key={i} className="v-no">
                <s>{c.text}</s> {c.by.length > 0 && <span className="by">— {c.by.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {v.contradictions.length > 0 && (
        <>
          <h3 className="v-attr">{d.article.discrepancies}</h3>
          <ul>
            {v.contradictions.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
        </>
      )}
      <p className="by" style={{ marginTop: 12 }}>
        {v.method}
      </p>
    </aside>
  );
}
