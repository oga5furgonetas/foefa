/**
 * Historias que derivaban (29-09-2026): una historia sobre la ansiedad ante los exámenes acabó
 * con 264 piezas sin relación porque se comparaba con el centroide acumulado. Ahora una pieza
 * tiene que parecerse también a las que abrieron la historia (anclas).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITORIAL_SETTINGS } from '../../src/config/settings';
import { anchorOf, anchorSimilarity, itemFeatures } from '../../src/pipeline/cluster';
import { extractEntities } from '../../src/text/entities';

const T = DEFAULT_EDITORIAL_SETTINGS.clusterThreshold;
const row = (title: string, summary: string, language = 'en', contentText: string | null = null) => ({
  title,
  summary,
  contentText,
  language,
  entities: extractEntities(`${title}\n${summary}`, language).map((e) => ({ name: e.name, type: e.type })),
  meta: { places: [] },
  minhash: null,
});
const probe = (r: ReturnType<typeof row>) => {
  const f = itemFeatures(r);
  return { vec: f.simVec, entities: f.ents, places: f.places, minhash: null, at: new Date('2026-09-29T12:00:00Z') };
};
const storyWith = (...rs: ReturnType<typeof row>[]) => ({ id: 1, isDemo: false, countryCode: null, lastItemAt: new Date('2026-09-29T12:00:00Z'), anchors: rs.map((r) => anchorOf(itemFeatures(r))) });

describe('anclas de la historia', () => {
  const seed = row('Lindsay Clancy is back in court after her murder case ended in a mistrial', 'Lindsay Clancy, accused of killing her three children in Duxbury, returned to court on Monday after a mistrial.');

  it('la misma noticia contada por otro medio encaja con el origen', () => {
    const same = row("Lindsay Clancy's lawyer suggests prosecutors didn't prove she killed her children", 'At a hearing on Monday, the lawyer for Lindsay Clancy argued that prosecutors did not prove the case after the mistrial.');
    expect(anchorSimilarity(probe(same), storyWith(seed))).toBeGreaterThanOrEqual(T * 0.85);
  });

  it('una pieza sin relación no encaja aunque la historia sea grande', () => {
    const junk = row("'Índice do medo' da Bolsa vai a máxima histórica com proximidade das eleições", 'O índice que mede o medo dos investidores atingiu 45 pontos nesta segunda-feira.', 'pt');
    const junk2 = row('Calendario laboral 2027: estos son todos los festivos y puentes en España', 'El BOE publica los 12 festivos nacionales de 2027.', 'es');
    expect(anchorSimilarity(probe(junk), storyWith(seed))).toBeLessThan(T * 0.85);
    expect(anchorSimilarity(probe(junk2), storyWith(seed))).toBeLessThan(T * 0.85);
  });

  it('el relleno final común de un medio no hace parecidas dos piezas', () => {
    const boiler = ' This article is republished from The Conversation under a Creative Commons license. Read the original article. '.repeat(20);
    const a = row('Year 12 students might feel anxious as exams approach. Here is what can help', 'Exam stress affects many final-year students.', 'en', `Exam stress affects many final-year students in Victoria.${' '.repeat(1300)}${boiler}`);
    const b = row('Victorian poll has Coalition two-party lead narrowing', 'A new poll shows the Coalition ahead in Victoria.', 'en', `A new poll shows the Coalition ahead.${' '.repeat(1300)}${boiler}`);
    expect(anchorSimilarity(probe(b), storyWith(a))).toBeLessThan(T * 0.85);
  });
});
