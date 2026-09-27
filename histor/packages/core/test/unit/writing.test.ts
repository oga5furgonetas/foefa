/**
 * Redacción y control de alucinaciones: el redactor determinista debe
 * producir artículos que pasen sus propios controles, y cualquier texto
 * (de IA o manual) con cifras, nombres, fechas o citas inventadas debe
 * ser rechazado.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITORIAL_SETTINGS } from '../../src/config/settings';
import type { ArticleBlock } from '../../src/db/schema';
import { claimRef, writeDeterministic } from '../../src/writing/deterministic';
import type { Draft } from '../../src/writing/draft';
import { buildFactSheet } from '../../src/writing/factsheet';
import { longestCommonRun, runQualityChecks } from '../../src/writing/quality';
import { validateDraft } from '../../src/writing/validate';
import { item, NOW, run, source } from './helpers';

function granadaStory() {
  const efe = source('EFE', 'wire_agency');
  const diario = source('Diario Uno', 'reputable_media');
  const radio = source('Radio Dos', 'reputable_media');
  const items = [
    item(efe, 'Un terremoto de magnitud 5,8 sacude Granada', 'Un terremoto de magnitud 5,8 sacudió Granada este domingo y causó daños en 40 viviendas, según el Instituto Geográfico Nacional. No hay víctimas mortales.', { minutesAgo: 90 }),
    item(diario, 'Seísmo de 5,8 en Granada: daños en 40 viviendas', 'El seísmo, de magnitud 5,8, se sintió en toda la provincia de Granada. Los técnicos municipales contabilizan daños en 40 viviendas del casco antiguo.', { minutesAgo: 70 }),
    item(radio, 'Granada registra un terremoto de magnitud 5,8', 'Protección Civil de Granada confirma que el terremoto de magnitud 5,8 dañó 40 viviendas; los bomberos revisan edificios públicos.', { minutesAgo: 60 }),
  ];
  const sources = [efe, diario, radio];
  const analysis = run(items, sources);
  const fs = buildFactSheet(analysis, items, new Map(sources.map((s) => [s.id, s])), { language: 'es' });
  return { analysis, fs, items, sources };
}

function qc(draft: Draft, story = granadaStory()) {
  return runQualityChecks({
    draft,
    factSheet: story.fs,
    state: story.analysis.nextState,
    flags: story.analysis.flags,
    confidence: story.analysis.confidence,
    settings: DEFAULT_EDITORIAL_SETTINGS,
    storyBlocked: false,
    recentPublished: [],
    storyId: 1,
    forbiddenSourceIds: new Set(),
    now: NOW,
  });
}

describe('redactor determinista', () => {
  it('escribe una ficha verificada que pasa todos los controles críticos', () => {
    const story = granadaStory();
    expect(story.analysis.decision).toBe('publish');
    const d = writeDeterministic(story.fs, { countryCode: 'ES' })!;
    expect(d).not.toBeNull();
    expect(d.headline.length).toBeGreaterThan(20);
    expect(d.headline).toMatch(/5,8/);
    expect(d.isDeveloping).toBe(false);
    const v = validateDraft(d, story.fs);
    expect(v.issues).toEqual([]);
    const report = qc(d, story);
    const failed = report.checks.filter((c) => !c.passed && c.critical);
    expect(failed).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('en una historia "en desarrollo" todo va atribuido', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const items = [item(d1, 'La empresa Ejemplo cerrará su planta de Zaragoza', 'La empresa Ejemplo cerrará su planta de Zaragoza en 2027 y despedirá a 300 trabajadores, según ha podido saber este diario.', { minutesAgo: 30 })];
    const analysis = run(items, [d1]);
    expect(analysis.decision).toBe('publish_developing');
    const fs = buildFactSheet(analysis, items, new Map([[d1.id, d1]]), { language: 'es' });
    const d = writeDeterministic(fs, { countryCode: 'ES' })!;
    expect(d.isDeveloping).toBe(true);
    expect(d.headline).toMatch(/según Diario Norte/);
    expect(validateDraft(d, fs).issues).toEqual([]);
  });

  it('no escribe nada si no hay material en ese idioma', () => {
    const story = granadaStory();
    const fsDe = buildFactSheet(story.analysis, story.items, new Map(story.sources.map((s) => [s.id, s])), { language: 'de' });
    expect(writeDeterministic(fsDe)).toBeNull();
  });
});

describe('control de alucinaciones (texto manipulado, como el de una IA que se inventa cosas)', () => {
  function tamper(mut: (body: ArticleBlock[], d: Draft) => void) {
    const story = granadaStory();
    const d = writeDeterministic(story.fs, { countryCode: 'ES' })!;
    const copy: Draft = JSON.parse(JSON.stringify(d));
    mut(copy.body, copy);
    return { story, draft: copy };
  }
  const anyRef = (s: ReturnType<typeof granadaStory>) => claimRef(s.fs.confirmed[0]);

  it('cifra inventada → rechazo', () => {
    const { story, draft } = tamper((b) => b.unshift({ type: 'p', text: 'El terremoto causó 12 muertos.', claimIds: [] }));
    draft.body[0] = { type: 'p', text: 'El terremoto causó 12 muertos.', claimIds: [anyRef(story)] };
    const v = validateDraft(draft, story.fs);
    expect(v.issues.some((i) => i.check === 'number')).toBe(true);
    expect(qc(draft, story).passed).toBe(false);
  });

  it('nombre inventado → rechazo', () => {
    const { story, draft } = tamper(() => {});
    draft.body.unshift({ type: 'p', text: 'El alcalde Juan Martínez Soto visitó las viviendas dañadas.', claimIds: [anyRef(story)] });
    expect(validateDraft(draft, story.fs).issues.some((i) => i.check === 'entity')).toBe(true);
  });

  it('cita inventada → rechazo', () => {
    const { story, draft } = tamper(() => {});
    draft.body.unshift({ type: 'p', text: '«Ha sido el peor terremoto de nuestra historia reciente», dijo el delegado del Gobierno.', claimIds: [anyRef(story)] });
    expect(validateDraft(draft, story.fs).issues.some((i) => i.check === 'quote')).toBe(true);
  });

  it('fecha inventada → rechazo', () => {
    const { story, draft } = tamper(() => {});
    draft.body.unshift({ type: 'p', text: 'El terremoto ocurrió el 14 de marzo de 2026 en Granada.', claimIds: [anyRef(story)] });
    expect(validateDraft(draft, story.fs).issues.some((i) => i.check === 'date')).toBe(true);
  });

  it('frase sin respaldo → rechazo', () => {
    const { story, draft } = tamper(() => {});
    draft.body.unshift({ type: 'p', text: 'Los expertos temen nuevas réplicas en los próximos días.', claimIds: [] });
    expect(validateDraft(draft, story.fs).issues.some((i) => i.check === 'citation')).toBe(true);
  });

  it('titular sensacionalista → rechazo', () => {
    const { story, draft } = tamper((_b, d) => {
      d.headline = '¡¡IMPACTANTE!! No creerás lo que pasó en Granada';
    });
    const r = qc(draft, story);
    expect(r.checks.find((c) => c.name === 'HEADLINE_INTEGRITY')?.passed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('copia literal larga de una fuente → rechazo legal', () => {
    const { story, draft } = tamper(() => {});
    const long =
      'Un terremoto de magnitud 5,8 sacudió Granada este domingo y causó daños en 40 viviendas del casco antiguo, donde los técnicos municipales revisan desde primera hora de la mañana las fachadas, las cubiertas y los muros de carga de los edificios más antiguos del barrio.';
    story.fs.sourceTexts.push({ sourceId: story.sources[0].id, text: long });
    draft.body.unshift({ type: 'p', text: long, claimIds: [anyRef(story)] });
    const r = qc(draft, story);
    expect(r.checks.find((c) => c.name === 'LEGAL_CHECK')?.passed).toBe(false);
  });

  it('acusación grave sin atribución ni presunción → rechazo legal', () => {
    const { story, draft } = tamper(() => {});
    draft.body.push({ type: 'p', text: 'El constructor del edificio es un estafador.', claimIds: [anyRef(story)] });
    const r = qc(draft, story);
    expect(r.checks.find((c) => c.name === 'LEGAL_CHECK')?.messages.join(' ')).toMatch(/acusación grave/);
  });
});

describe('utilidades legales', () => {
  it('mide el tramo literal más largo', () => {
    expect(longestCommonRun('uno dos tres cuatro cinco', 'cero uno dos tres cuatro seis')).toBe(4);
  });
});
