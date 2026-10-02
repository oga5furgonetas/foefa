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
import { bodyText, type Draft } from '../../src/writing/draft';
import { buildFactSheet } from '../../src/writing/factsheet';
import { extractArticleText, parseRss } from '../../src/ingest/parsers';
import { compressClaim } from '../../src/writing/compress';
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
    // Las fichas de prueba son de dos o tres frases: el mínimo de palabras se prueba aparte.
    minBodyWords: 0,
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

  it('en una historia "en desarrollo" no se nombra al periódico: lo dice la etiqueta', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const items = [item(d1, 'La empresa Ejemplo cerrará su planta de Zaragoza', 'La empresa Ejemplo cerrará su planta de Zaragoza en 2027 y despedirá a 300 trabajadores, según ha podido saber este diario.', { minutesAgo: 30 })];
    // Por defecto una sola fuente no se publica; el redactor se prueba con el umbral a 1 (ajustable en el panel).
    expect(run(items, [d1]).decision).toBe('hold');
    const analysis = run(items, [d1], { settings: { ...DEFAULT_EDITORIAL_SETTINGS, minIndependentDeveloping: 1 } });
    expect(analysis.decision).toBe('publish_developing');
    const fs = buildFactSheet(analysis, items, new Map([[d1.id, d1]]), { language: 'es' });
    const d = writeDeterministic(fs, { countryCode: 'ES' })!;
    expect(d.isDeveloping).toBe(true);
    // Ni en el titular ni en el texto (Dani, 03-10-2026: «deja de poner según 20 minutos»).
    expect(d.headline).not.toMatch(/según/);
    expect(bodyText(d.body)).not.toMatch(/Diario Norte/);
    expect(d.subheadline).not.toMatch(/Diario Norte/);
    expect(bodyText(d.body)).toMatch(/Zaragoza/);
    expect(validateDraft(d, fs).issues).toEqual([]);
  });

  it('una frase que atribuye algo a un periódico no pasa el control; a una persona o institución, sí', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const items = [item(d1, 'La empresa Ejemplo cerrará su planta de Zaragoza', 'La empresa Ejemplo cerrará su planta de Zaragoza en 2027 y despedirá a 300 trabajadores, según ha podido saber este diario.', { minutesAgo: 30 })];
    const analysis = run(items, [d1], { settings: { ...DEFAULT_EDITORIAL_SETTINGS, minIndependentDeveloping: 1 } });
    const fs = buildFactSheet(analysis, items, new Map([[d1.id, d1]]), { language: 'es' });
    const d = writeDeterministic(fs, { countryCode: 'ES' })!;
    const ids = fs.claims.map(claimRef);
    const para = (text: string): Draft => ({ ...d, body: [{ type: 'p', text, claimIds: ids }] });
    const issues = (x: Draft, check: string) => validateDraft(x, fs).issues.filter((i) => i.check === check);
    expect(issues(para('Según Diario Norte, la empresa Ejemplo cerrará su planta de Zaragoza.'), 'media')).toHaveLength(1);
    expect(issues(para('La empresa Ejemplo cerrará su planta de Zaragoza, informa Diario Norte.'), 'media')).toHaveLength(1);
    expect(issues(para('La empresa Ejemplo cerrará su planta de Zaragoza. Despedirá a 300 trabajadores.'), 'media')).toEqual([]);
    expect(issues(para('La empresa Ejemplo cerrará su planta de Zaragoza. Despedirá a 300 trabajadores.'), 'status')).toEqual([]);
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

describe('entradilla distinta del titular', () => {
  it('si la primera frase repite el titular, la entradilla usa la siguiente', () => {
    const { fs } = granadaStory();
    const d = writeDeterministic(fs, { countryCode: 'ES' })!;
    const n = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    expect(n(d.summary)).not.toBe(n(d.headline));
  });
});

describe('plantilla de terremotos (dato estructurado de una fuente oficial)', () => {
  // Visto con datos reales el 27-09-2026: «USGS registró a las 26 de septiembre a las 11:01…».
  function quake(lang: string) {
    const usgs = source('USGS Earthquake Hazards Program', 'primary_official', { slug: 'usgs-earthquakes', homepageUrl: 'https://earthquake.usgs.gov', countryCode: 'US' });
    const it = item(usgs, 'M 5.1 - 12 km NNE of Tadine, New Caledonia', 'M 5.1 - 12 km NNE of Tadine, New Caledonia', {
      minutesAgo: 40,
      structured: { type: 'earthquake', magnitude: 5.1, depthKm: 10, place: '12 km NNE of Tadine, New Caledonia', time: new Date(NOW.getTime() - 40 * 60000).toISOString(), tsunami: false },
    });
    const analysis = run([it], [usgs]);
    const fs = buildFactSheet(analysis, [it], new Map([[usgs.id, usgs]]), { language: lang });
    return writeDeterministic(fs, { timeZone: 'UTC' })!;
  }

  it('una sola fuente: la agencia va en la entrada, no en el titular, y la noticia va «en desarrollo»', () => {
    expect(quake('es').headline).toBe('Terremoto de magnitud 5,1 cerca de Tadine, New Caledonia');
    expect(quake('en').headline).not.toMatch(/according to/);
    expect(quake('es').isDeveloping).toBe(true);
    expect((quake('es').body[0] as { text: string }).text).toMatch(/^USGS/);
  });

  it('la fecha lleva la preposición de cada idioma, no «a las 26 de septiembre»', () => {
    const lead = (lang: string) => (quake(lang).body[0] as { text: string }).text;
    expect(lead('es')).toMatch(/^USGS registró el \d+ de septiembre/);
    expect(lead('en')).toMatch(/^USGS recorded a magnitude 5\.1 earthquake near Tadine, New Caledonia on /);
    expect(lead('de')).toMatch(/^USGS registrierte am \d+\. September/);
    expect(lead('fr')).toMatch(/^USGS a enregistré le \d+ septembre/);
    expect(lead('it')).toMatch(/^USGS ha registrato il \d+ settembre/);
    expect(lead('pt')).toMatch(/^USGS registrou em \d+ de setembro/);
    for (const l of ['es', 'en', 'de', 'fr', 'it', 'pt']) expect(lead(l)).not.toMatch(/\b(a las|at|um|à|alle|às) \d+ (de )?[a-zé]+/i);
  });
});

describe('fuentes reales: frases cortadas o pegadas (visto el 27-09-2026 con The Guardian)', () => {
  it('una subordinada inicial no se publica sola: se queda la oración principal', () => {
    const s = 'While in Washington DC for a three-day summit with Donald Trump, Chinese president Xi Jinping announced that the pandas would arrive in Atlanta in the coming days';
    const out = compressClaim(s, 22)!;
    expect(out).toBe('Chinese president Xi Jinping announced that the pandas would arrive in Atlanta in the coming days');
    expect(compressClaim('Mientras se celebraba la cumbre de tres días en Washington con el presidente, el líder chino anunció que los osos panda llegarían a Atlanta en pocos días', 22)).toBe('El líder chino anunció que los osos panda llegarían a Atlanta en pocos días');
    // Si la principal tampoco cabe, la afirmación no se usa: nunca se publica la subordinada sola.
    expect(compressClaim('Mientras se celebraba la cumbre de tres días en Washington con el presidente, el líder chino anunció que los osos panda llegarían a Atlanta en los próximos días tras un largo viaje en avión de carga', 22)).toBeNull();
  });

  it('los enlaces no meten espacios ni los párrafos se pegan', () => {
    const html = '<p>Pandas departed Chengdu as part of agreement between Chinese and US governments</p><p>Two giant pandas departed <a href="https://x.test/china">China</a> for <a href="https://x.test/atlanta">Atlanta</a>, Georgia. While in Washington DC for a <a href="https://x.test/1">three</a>-<a href="https://x.test/2">day</a> summit.</p>';
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Pandas</title><link>https://x.test/p</link><description><![CDATA[${html}]]></description></item></channel></rss>`;
    const [it] = parseRss(rss);
    expect(it.summary).toContain('US governments. Two giant pandas');
    expect(it.summary).toContain('Atlanta, Georgia');
    expect(it.summary).toContain('three-day summit');
  });
});

describe('titulares reales mal cortados o con etiquetas (27-09-2026)', () => {
  it('no corta dejando la frase colgando («…, warnen aber davor»)', () => {
    const t = 'Wirtschaftsforscher sehen Aufschwung in Deutschland, warnen aber davor, die Zahlen als Beginn eines neuen Wirtschaftsbooms zu verstehen';
    const out = compressClaim(t, 16);
    expect(out ?? '').not.toMatch(/davor$/);
  });

  it('quita la etiqueta de directo del titular del medio', () => {
    const rss = (title: string) => `<?xml version="1.0"?><rss version="2.0"><channel><item><title>${title}</title><link>https://x.test/a</link></item></channel></rss>`;
    expect(parseRss(rss('Live: Pope Leo XIV urges Church to face failings'))[0].title).toBe('Pope Leo XIV urges Church to face failings');
    expect(parseRss(rss('En directo: León XIV insta a la Iglesia a reconocer sus errores'))[0].title).toBe('León XIV insta a la Iglesia a reconocer sus errores');
    expect(parseRss(rss('Liveticker: Bundestag stimmt ab'))[0].title).toBe('Bundestag stimmt ab');
    // «Live» como palabra del titular no se toca.
    expect(parseRss(rss('Live Aid veterans reunite in London'))[0].title).toBe('Live Aid veterans reunite in London');
  });
});

describe('más casos reales del 27-09-2026 (Le Monde, franceinfo, RTP, El Mundo, Europa Press)', () => {
  const rss = (title: string, desc = '') => `<?xml version="1.0"?><rss version="2.0"><channel><item><title>${title}</title><link>https://x.test/a</link><description><![CDATA[${desc}]]></description></item></channel></rss>`;

  it('quita «EN DIRECT,» y la hora de las entradas de directo', () => {
    expect(parseRss(rss('EN DIRECT, Mondiaux de cyclisme : les coureurs entrent dans Montréal'))[0].title).toBe('Mondiaux de cyclisme : les coureurs entrent dans Montréal');
    expect(parseRss(rss('16h Papa fala de eutanásia numa visita a doentes em França'))[0].title).toBe('Papa fala de eutanásia numa visita a doentes em França');
    expect(parseRss(rss('14.30 Uhr Bundestag stimmt ab'))[0].title).toBe('Bundestag stimmt ab');
    // Un número que forma parte del titular no se toca.
    expect(parseRss(rss('5 claves para entender la cumbre'))[0].title).toBe('5 claves para entender la cumbre');
  });

  it('el resumen pierde el «Leer» final y la frase que el feed dejó a medias', () => {
    expect(parseRss(rss('Detenido tras matar a su pareja', 'El agresor, de 56 años, se entrega tras la intervención de la Guardia Civil Leer'))[0].summary).toBe('El agresor, de 56 años, se entrega tras la intervención de la Guardia Civil');
    const cut = parseRss(rss('Detenido el atrincherado', 'La Guardia Civil ha detenido este domingo al hombre de 56 años. Al respecto, el subdelegado del Gobierno en Sevilla, Francisco Toscano…'))[0].summary;
    expect(cut).toBe('La Guardia Civil ha detenido este domingo al hombre de 56 años.');
  });

  it('una frase truncada o que anuncia lo que sigue no es una afirmación', () => {
    const s = source('Agencia Uno', 'wire_agency');
    const it = item(s, 'La Guardia Civil detiene al hombre atrincherado en La Campana', 'La Guardia Civil ha detenido al hombre de 56 años atrincherado en La Campana. Al respecto, el subdelegado del Gobierno en Sevilla, Francisco Toscano… El alcalde declaró:');
    const texts = run([it], [s]).claims.map((c) => c.text);
    expect(texts.some((t) => /Toscano/.test(t))).toBe(false);
    expect(texts.some((t) => /declaró:$/.test(t))).toBe(false);
  });

  it('en titulares no se corta por comas; en el cuerpo, nunca dentro de una oración de relativo', () => {
    expect(compressClaim('Au Maroc, un an après le mouvement de la « gen Z », des centaines de détenus et une chape de plomb sur le pays', 16, { commaCut: false })).toBeNull();
    const s = 'Le jeune coureur français, qui est déjà monté sur le podium du contre-la-montre, rêve de titre mondial sur la course en ligne dimanche, à 20 ans seulement';
    expect(compressClaim(s, 16) ?? '').not.toMatch(/contre-la-montre$/);
  });
});

describe('última tanda real (27-09-2026, noche)', () => {
  it('no deja la subordinada de «that while…» sin su verbo', () => {
    const s = "Iranian officials that while they were aware of Trump's comments on rejecting the new proposal, they had not received a formal message rejecting the plan";
    expect(compressClaim(s, 22) ?? '').not.toMatch(/proposal$/);
  });

  it('la entradilla no sale de «Datos clave» ni de una frase que depende de la anterior', () => {
    const tag = source('Nachrichten Eins', 'reputable_media', { countryCode: 'DE' });
    const zdf = source('Nachrichten Zwei', 'reputable_media', { countryCode: 'DE', ownershipGroup: 'zwei' });
    const items = [
      item(tag, 'Trump lehnt Irans Vorschlag zur Öffnung der Straße von Hormus ab', 'Iran unterbreitete den USA am Rande der UN-Generalversammlung einen Vorschlag zur Öffnung der Straße von Hormus. Den lehnte US-Präsident Trump nun ab.', { minutesAgo: 60 }),
      item(zdf, 'Trump lehnt Vorschlag Irans zu Hormus ab', 'US-Präsident Trump lehnt den Vorschlag Irans zur Öffnung der Straße von Hormus ab. Den lehnte US-Präsident Trump nun ab.', { minutesAgo: 50 }),
    ];
    const analysis = run(items, [tag, zdf]);
    const fs = buildFactSheet(analysis, items, new Map([tag, zdf].map((s) => [s.id, s])), { language: 'de' });
    const d = writeDeterministic(fs, {})!;
    expect(d.summary).not.toMatch(/^Den /);
    expect(d.summary).not.toMatch(/^[\p{L} ]+: \d/u);
  });
});

describe('cortes seguros y titulares que se entienden solos (27-09-2026, RTP y DW)', () => {
  it('no deja sujeto + inciso sin el verbo principal', () => {
    const s = 'O número de palestinianos mortos na Faixa de Gaza, em consequência da ofensiva militar de Israel, que dura há quase três anos, ultrapassou os 74.000';
    const out = compressClaim(s, 22);
    expect(out ?? '').not.toMatch(/Israel$/);
  });
  it('corta antes de una oración de relativo final, que sí deja la idea completa', () => {
    expect(compressClaim('El Gobierno aprobó este martes un plan de vivienda para jóvenes en toda España, que costará 1.200 millones de euros según las primeras estimaciones del ministerio', 18)).toBe('El Gobierno aprobó este martes un plan de vivienda para jóvenes en toda España');
  });
});

describe('terremoto verificado con fuentes en otro idioma', () => {
  it('el recuadro de verificación no queda vacío: muestra el dato y quién lo confirma', () => {
    const usgs = source('USGS Earthquake Hazards Program', 'primary_official', { slug: 'usgs-earthquakes', homepageUrl: 'https://earthquake.usgs.gov', countryCode: 'US' });
    const wire = source('Demo Wire US', 'wire_agency', { countryCode: 'US' });
    const t = new Date(NOW.getTime() - 40 * 60000).toISOString();
    const items = [
      item(usgs, 'M 5.6 - 35 km NNE of Demo Point', 'A magnitude 5.6 earthquake was recorded 35 km NNE of Demo Point at a depth of 10.2 km, according to the USGS.', { minutesAgo: 40, structured: { type: 'earthquake', magnitude: 5.6, depthKm: 10.2, place: '35 km NNE of Demo Point', time: t, tsunami: false } }),
      item(wire, 'Magnitude 5.6 earthquake strikes near Demo Point', 'A magnitude 5.6 earthquake struck 35 km north-northeast of Demo Point at a depth of 10.2 km, the seismic service said.', { minutesAgo: 20 }),
    ];
    const analysis = run(items, [usgs, wire]);
    const fs = buildFactSheet(analysis, items, new Map([usgs, wire].map((s) => [s.id, s])), { language: 'es' });
    const d = writeDeterministic(fs, { timeZone: 'UTC' })!;
    expect(d.isDeveloping).toBe(false);
    expect(d.verification.confirmed.length).toBeGreaterThan(0);
    expect(d.verification.confirmed[0].text).toMatch(/Terremoto de magnitud 5,6/);
  });
});

describe('más etiquetas de formato en titulares (27-09-2026)', () => {
  const rss = (title: string) => `<?xml version="1.0"?><rss version="2.0"><channel><item><title>${title}</title><link>https://x.test/a</link></item></channel></rss>`;
  it('quita «Watch:» y «- The Latest»', () => {
    expect(parseRss(rss('Watch: mass Madrid protests over eviction and housing crisis'))[0].title).toBe('Mass Madrid protests over eviction and housing crisis');
    expect(parseRss(rss('Protests erupt as Netanyahu gives UN speech - The Latest'))[0].title).toBe('Protests erupt as Netanyahu gives UN speech');
    expect(parseRss(rss('Rescate en el Mediterráneo (en directo)'))[0].title).toBe('Rescate en el Mediterráneo');
  });
});

describe('coletilla de atribución solo tras coma', () => {
  it('«ganó su segundo maratón» no se corta en «segundo» (que en portugués es «según»)', () => {
    const s = 'El etíope Guye Adola ganó su segundo maratón de Berlín mejorando en dos minutos su mejor marca personal';
    expect(compressClaim(s, 22)).toBe(s);
    expect(compressClaim('La policía detuvo a cinco hombres cerca de la base aérea de Fairford, según la Policía Metropolitana', 22)).toBe('La policía detuvo a cinco hombres cerca de la base aérea de Fairford');
  });
});

describe('texto completo de la noticia en su página', () => {
  const long = 'El etíope Guye Adola ganó su segundo maratón de Berlín mejorando en dos minutos su mejor marca personal. '.repeat(4);
  it('usa el articleBody que declara el medio', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: 'x', articleBody: long })}</script></head><body></body></html>`;
    expect(extractArticleText(html).text).toMatch(/^El etíope Guye Adola/);
  });
  it('si no, los párrafos de <article>, sin avisos de cookies ni «lee también»', () => {
    const p = (t: string) => `<p>${t}</p>`;
    const html = `<article>${p('Su compatriota Tigst Assefa ganó por tercera vez la edición femenina, pero se le escapó el récord mundial por pocos segundos.')}${p('Lee también: los diez maratones más rápidos de la historia y dónde se corrieron')}${p('La carrera reunió a 56.000 corredores de más de cien países en las calles de Berlín este domingo por la mañana.')}${p('Aceptamos cookies para mejorar tu experiencia de navegación en este sitio web y otras cosas')}${p('Adola cruzó la meta con una ventaja de casi un minuto sobre el segundo clasificado, según la organización de la prueba.')}</article>`;
    const out = extractArticleText(html).text!;
    expect(out).toContain('56.000 corredores');
    expect(out).not.toMatch(/Lee también|cookies/);
  });
  it('no lee una página que se declara de pago (no se salta muros)', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', isAccessibleForFree: false, articleBody: long })}</script>`;
    expect(extractArticleText(html)).toEqual({ text: null, reason: 'de pago' });
  });
});
