import { describe, expect, it } from 'vitest';
import { detectAttribution } from '../../src/text/attribution';
import { extractDates, parseFeedDate } from '../../src/text/dates';
import { extractEntities, findPlaces } from '../../src/text/entities';
import { detectLanguage } from '../../src/text/langdetect';
import { detectModality } from '../../src/text/modality';
import { slugify } from '../../src/text/normalize';
import { extractNumbers, numbersAgree, parseLocaleNumber } from '../../src/text/numbers';
import { extractQuotes, quoteAppearsIn, sameSpeaker } from '../../src/text/quotes';
import { cosine, minhash, minhashSimilarity, termVector } from '../../src/text/similarity';
import { sentences } from '../../src/text/tokenize';

describe('normalización', () => {
  it('slugify quita tildes y caracteres especiales', () => {
    expect(slugify('Galicia: A Coruña y Ourense')).toBe('galicia-a-coruna-y-ourense');
    expect(slugify('Straße in München')).toBe('strasse-in-munchen');
    expect(slugify('Économie & société')).toBe('economie-and-societe');
  });
});

describe('idioma', () => {
  it('distingue los seis idiomas', () => {
    expect(detectLanguage('El Gobierno ha aprobado este martes una ley que regula el uso de los datos de los ciudadanos.').lang).toBe('es');
    expect(detectLanguage('The government approved on Tuesday a law that regulates the use of citizens data.').lang).toBe('en');
    expect(detectLanguage('Die Regierung hat am Dienstag ein Gesetz beschlossen, das die Nutzung der Daten regelt.').lang).toBe('de');
    expect(detectLanguage("Le gouvernement a adopté mardi une loi qui encadre l'utilisation des données des citoyens.").lang).toBe('fr');
    expect(detectLanguage('Il governo ha approvato martedì una legge che regola l’uso dei dati dei cittadini.').lang).toBe('it');
    expect(detectLanguage('O governo aprovou nesta terça-feira uma lei que regula o uso dos dados dos cidadãos.').lang).toBe('pt');
  });
});

describe('frases', () => {
  it('respeta abreviaturas y decimales', () => {
    const s = sentences('El Sr. García llegó a las 3.5 horas. Después habló con la Dra. López. ¿Y ahora qué?');
    expect(s).toHaveLength(3);
  });
  it('no corta en ordinales («1. Januar», «19. Jahrhundert») pero sí tras una cifra final', () => {
    expect(sentences('Die Stadtwerke senken zum 1. Januar 2027 den Strompreis um 8 Prozent. Das teilte das Unternehmen mit.')).toHaveLength(2);
    expect(sentences('Im 19. Jahrhundert wuchs die Stadt stark. Heute leben dort 2 Millionen Menschen.')).toHaveLength(2);
    expect(sentences('El equipo ganó por 3. El entrenador lo celebró.')).toHaveLength(2);
  });
});

describe('fechas', () => {
  const ref = new Date('2026-09-27T10:00:00Z');
  it('parsea fechas de feeds', () => {
    expect(parseFeedDate('Sun, 27 Sep 2026 08:15:00 GMT')?.toISOString()).toBe('2026-09-27T08:15:00.000Z');
    expect(parseFeedDate('2026-09-27T10:15:00+02:00')?.toISOString()).toBe('2026-09-27T08:15:00.000Z');
    expect(parseFeedDate('Sun, 27 Sep 2026 10:15:00 CEST')?.toISOString()).toBe('2026-09-27T08:15:00.000Z');
    expect(parseFeedDate('no es una fecha')).toBeNull();
  });
  it('extrae fechas afirmadas en varios idiomas', () => {
    expect(extractDates('ocurrió el 3 de marzo de 2019 en Vigo', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('happened on March 3, 2019', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('am 3. März 2019 in Berlin', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('le 3 mars 2019 à Paris', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('il 3 marzo 2019 a Roma', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('em 3 de março de 2019', ref)[0].iso).toBe('2019-03-03');
    expect(extractDates('ayer por la tarde', ref).map((d) => d.iso)).toContain('2026-09-26');
  });
});

describe('cifras', () => {
  it('separadores por idioma', () => {
    expect(parseLocaleNumber('1.200', 'es')).toBe(1200);
    expect(parseLocaleNumber('1,200', 'en')).toBe(1200);
    expect(parseLocaleNumber('3,5', 'es')).toBe(3.5);
    expect(parseLocaleNumber('3.5', 'en')).toBe(3.5);
    expect(parseLocaleNumber('2.480.000', 'es')).toBe(2480000);
  });
  it('extrae cifras con su magnitud', () => {
    const n = extractNumbers('Al menos 12 muertos y 40 heridos tras el terremoto de magnitud 6,2', 'es');
    expect(n.find((x) => x.unit === 'deaths')?.value).toBe(12);
    expect(n.find((x) => x.unit === 'injured')?.value).toBe(40);
    expect(n.find((x) => x.unit === 'magnitude')?.value).toBe(6.2);
    const e = extractNumbers('The company will cut 1,200 jobs and invest €2.5 billion', 'en');
    expect(e.find((x) => x.unit === 'jobs')?.value).toBe(1200);
    expect(e.find((x) => x.unit === 'currency:EUR')?.value).toBe(2.5e9);
    expect(extractNumbers('La inflación subió al 3,1 % en agosto', 'es')[0]).toMatchObject({ value: 3.1, unit: 'percent' });
  });
  it('compara cifras con tolerancia razonable', () => {
    const a = { value: 12, unit: 'deaths', raw: '12', approximate: false };
    const b = { value: 15, unit: 'deaths', raw: '15', approximate: false };
    expect(numbersAgree(a, b)).toBe(false);
    expect(numbersAgree({ ...a, value: 6.2, unit: 'magnitude' }, { ...a, value: 6.1, unit: 'magnitude' })).toBe(true);
  });
});

describe('citas', () => {
  it('extrae citas con su hablante', () => {
    const q = extractQuotes('«Vamos a reconstruir cada vivienda afectada», dijo Ana Pérez en rueda de prensa.');
    expect(q[0].text).toBe('Vamos a reconstruir cada vivienda afectada');
    expect(q[0].speaker).toBe('Ana Pérez');
    const en = extractQuotes('John Smith said: "We will not raise taxes this year at all."');
    expect(en[0].speaker).toBe('John Smith');
  });
  it('comprueba si una cita existe en las fuentes', () => {
    expect(quoteAppearsIn('vamos a reconstruir cada vivienda', ['Dijo: «Vamos a reconstruir cada vivienda afectada»'])).toBe(true);
    expect(quoteAppearsIn('vamos a subir los impuestos', ['Dijo: «Vamos a reconstruir cada vivienda afectada»'])).toBe(false);
  });
  it('distingue hablantes', () => {
    expect(sameSpeaker('Pedro Sánchez', 'Sánchez')).toBe(true);
    expect(sameSpeaker('Pedro Sánchez', 'María Sánchez')).toBe(false);
  });
});

describe('atribución', () => {
  it('detecta agencias como origen', () => {
    expect(detectAttribution('MADRID (EFE) — El Gobierno aprobó hoy...')).toBe('EFE');
    expect(detectAttribution('Según informa la agencia Reuters, el banco...')).toBe('Reuters');
    expect(detectAttribution('Laut dpa wurde der Minister...')).toBe('dpa');
    expect(detectAttribution("Selon l'AFP, le président...")).toBe('AFP');
    expect(detectAttribution('El alcalde inauguró el puente.')).toBeNull();
  });
});

describe('modalidad', () => {
  it('distingue hecho, predicción, rumor y desmentido', () => {
    expect(detectModality('El Congreso aprobó la ley por 180 votos.').modality).toBe('asserted');
    expect(detectModality('El Gobierno podría subir el IVA el próximo año.').modality).toBe('predicted');
    expect(detectModality('The minister reportedly resigned.').modality).toBe('hedged');
    expect(detectModality('La policía desmintió la detención.').modality).toBe('denied');
    expect(detectModality('Der Minister sagte, das Gesetz sei beschlossen.').modality).toBe('attributed');
    expect(detectModality('The festival opened on May 3 in Madrid.').modality).toBe('asserted');
  });
});

describe('entidades y lugares', () => {
  it('encuentra topónimos en cualquier idioma', () => {
    const p = findPlaces('Fuertes lluvias en A Coruña y Vigo; también en Múnich.');
    expect(p.map((x) => x.cityKey)).toEqual(expect.arrayContaining(['es-a-coruna', 'es-vigo', 'de-munchen']));
  });
  it('extrae personas y organizaciones', () => {
    const e = extractEntities('La ministra Ana Pérez se reunió con la Organización Mundial de la Salud en Ginebra.');
    expect(e.find((x) => x.name === 'Ana Pérez')?.type).toBe('person');
    expect(e.find((x) => x.name.startsWith('Organización Mundial'))?.type).toBe('organization');
  });
});

describe('similitud', () => {
  it('MinHash detecta copias casi literales', () => {
    const a = 'Un terremoto de magnitud 6,2 sacudió este domingo el sur del país y causó daños en varias viviendas antiguas del centro histórico.';
    const b = 'Un terremoto de magnitud 6,2 sacudió este domingo el sur del país y causó daños en varias viviendas antiguas del casco histórico.';
    const c = 'El Ayuntamiento aprobó los presupuestos municipales con los votos de la mayoría tras un largo debate en el pleno.';
    expect(minhashSimilarity(minhash(a), minhash(b))).toBeGreaterThan(0.6);
    expect(minhashSimilarity(minhash(a), minhash(c))).toBeLessThan(0.1);
  });
  it('coseno agrupa el mismo hecho contado distinto', () => {
    const a = termVector('Terremoto de magnitud 6,2 sacude el sur y daña viviendas antiguas', 'es');
    const b = termVector('Un sismo de magnitud 6,2 daña viviendas antiguas en el sur', 'es');
    const c = termVector('El Ayuntamiento aprueba los presupuestos municipales', 'es');
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});
