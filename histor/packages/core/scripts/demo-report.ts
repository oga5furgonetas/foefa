/** Informe legible del estado de cada historia (útil para depurar el pipeline). */
import { desc, eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/db/client';
import { articles, qualityReports, stories, storyItems, rawItems, sources, verifications } from '../src/db/schema';

const db = getDb();
const all = await db.select().from(stories).orderBy(stories.id);
for (const s of all) {
  const [v] = await db.select().from(verifications).where(eq(verifications.storyId, s.id)).orderBy(desc(verifications.runAt)).limit(1);
  const arts = await db.select({ l: articles.language, h: articles.headline, d: articles.isDeveloping }).from(articles).where(eq(articles.storyId, s.id));
  const qrs = await db.select().from(qualityReports).where(eq(qualityReports.storyId, s.id));
  const its = await db.select({ t: rawItems.title, src: sources.slug, lang: rawItems.language, at: rawItems.attributedTo }).from(storyItems).innerJoin(rawItems, eq(rawItems.id, storyItems.itemId)).innerJoin(sources, eq(sources.id, rawItems.sourceId)).where(eq(storyItems.storyId, s.id));
  console.log(`\n#${s.id} [${s.state}] conf=${s.evidenceConfidence} mom=${s.momentum} flags=${s.flags.join(',')} :: ${s.headlineHint}`);
  console.log('   items:', its.map((i) => `${i.src}(${i.lang}${i.at ? ',attr=' + i.at : ''})`).join(' '));
  if (v) console.log('   decision:', v.decision, '|', v.reasons.join(' | '), '| cap:', (v.breakdown as any).confidence?.capReason, 'indep:', (v.breakdown as any).confidence?.independentCredible);
  for (const a of arts) console.log(`   art[${a.l}]${a.d ? '(dev)' : ''}: ${a.h}`);
  for (const q of qrs.filter((q) => !q.passed)) console.log(`   QC FAIL [${q.language}] ${q.writer}:`, q.checks.filter((c) => !c.passed && c.critical).map((c) => `${c.name}: ${c.messages.join('; ')}`).join(' || '));
}
await closeDb();
