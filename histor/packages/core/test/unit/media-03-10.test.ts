/**
 * 03-10-2026. Dani: «deja de poner "según 20 minutos"… no escribas nada sobre otros periódicos» y
 * «actualiza todo más rápido».
 */
import { describe, expect, it } from 'vitest';
import { cleanStoredArticle, namesMedia, stripMediaAttribution } from '../../src/writing/media';
import { sameFact, tidyParagraphs } from '../../src/writing/tidy';
import { fitToLimit, requestLimitFrom } from '../../src/ai/router';
import { nextCheckDelayMinutes } from '../../src/pipeline/verify';

const names = ['20minutos', 'La Vanguardia', 'El País', 'EFE', 'AS', 'AP', 'APA', 'Marca', 'BBC News'];
const strip = (s: string) => stripMediaAttribution(s, names);

describe('sin periódicos en el texto', () => {
  it('quita «Según X y Y,» del principio y deja la frase en mayúscula', () => {
    expect(strip('Según 20minutos y La Vanguardia, Álex Grimaldo ha tenido que abandonar la concentración de España.')).toBe('Álex Grimaldo ha tenido que abandonar la concentración de España.');
  });
  it('quita la atribución del final, del medio, entre paréntesis y como sujeto', () => {
    expect(strip('El lateral no pudo jugar este martes, según 20 Minutos.')).toBe('El lateral no pudo jugar este martes.');
    expect(strip('El ministro, según El País, dimitirá mañana.')).toBe('El ministro dimitirá mañana.');
    expect(strip('El incendio ha arrasado 500 hectáreas (EFE).')).toBe('El incendio ha arrasado 500 hectáreas.');
    expect(strip('20minutos informa de que el seleccionador ha llamado a Fran García.')).toBe('El seleccionador ha llamado a Fran García.');
    expect(strip('El club confirmó la baja, informa EFE.')).toBe('El club confirmó la baja.');
    expect(strip('El jugador explicó en declaraciones a Marca que está bien.')).toBe('El jugador explicó que está bien.');
    expect(strip('The minister told BBC News that he would resign.')).toBe('The minister said that he would resign.');
  });
  it('no toca la atribución a personas o instituciones ni palabras que se parecen a un medio', () => {
    expect(strip('Según la Policía, el detenido tiene 30 años.')).toBe('Según la Policía, el detenido tiene 30 años.');
    expect(strip('El mapa indica que hay lluvia.')).toBe('El mapa indica que hay lluvia.');
    expect(namesMedia('El mapa indica que hay lluvia.', names)).toBe(false);
    expect(namesMedia('As reported earlier, prices rose.', names)).toBe(false);
  });
  it('detecta lo que no se puede quitar', () => {
    expect(namesMedia('Según El País, el Gobierno dimitirá.', names)).toBe(true);
    expect(namesMedia('El Gobierno dimitirá, informa EFE.', names)).toBe(true);
    expect(namesMedia('the AP said nothing more', names)).toBe(true);
  });
});

describe('limpieza de lo ya publicado', () => {
  it('quita los «según X», cambia el subtítulo con la lista de medios y deja lo demás', () => {
    const out = cleanStoredArticle(
      {
        subheadline: 'Lo confirman 3 fuentes independientes: 20minutos, La Vanguardia y Marca.',
        summary: 'Según 20minutos, Grimaldo abandona la concentración.',
        seoDescription: 'Grimaldo abandona la concentración.',
        body: [
          { type: 'p', text: 'Según 20minutos y La Vanguardia, Álex Grimaldo ha tenido que abandonar la concentración. Luis de la Fuente ha llamado a Fran García.', claimIds: [1] },
          { type: 'h2', text: 'Datos clave' },
          { type: 'list', items: [{ text: 'Heridos: 3 (según EFE)', claimIds: [] }] },
        ],
      },
      'es',
      names,
    )!;
    expect(out.subheadline).toBe('Verificada con 3 fuentes independientes.');
    expect(out.summary).toBe('Grimaldo abandona la concentración.');
    expect(out.body[0]).toMatchObject({ text: 'Álex Grimaldo ha tenido que abandonar la concentración. Luis de la Fuente ha llamado a Fran García.' });
    expect(out.body[2]).toMatchObject({ items: [{ text: 'Heridos: 3' }] });
  });
  it('sin nada que limpiar, no toca la noticia', () => {
    expect(cleanStoredArticle({ subheadline: null, summary: 'Hola.', seoDescription: 'Hola.', body: [{ type: 'p', text: 'Texto limpio.', claimIds: [] }] }, 'es', names)).toBeNull();
  });
});

describe('sin contar dos veces lo mismo', () => {
  it('la misma noticia con otras palabras es el mismo hecho', () => {
    expect(
      sameFact(
        'Álex Grimaldo ha tenido que abandonar la concentración de España por unas molestias musculares.',
        'La lesión muscular también llevó a Grimaldo a abandonar la concentración de España.',
      ),
    ).toBe(true);
  });
  it('un dato nuevo (una cifra) es información, aunque hable de lo mismo', () => {
    expect(sameFact('The Chicago Demo City Council approved a plan to build 40 miles of protected bike lanes in Chicago.', 'Chicago will add 40 miles of protected bike lanes after the Chicago Demo City Council voted 38 to 12.')).toBe(false);
  });
  it('la noticia de Grimaldo: fuera la frase repetida y sin una frase por párrafo', () => {
    const p = (text: string, id: number) => ({ type: 'p' as const, text, claimIds: [id] });
    const out = tidyParagraphs([
      p('Álex Grimaldo ha tenido que abandonar la concentración de España por unas molestias musculares.', 1),
      p('La lesión muscular también llevó a Grimaldo a abandonar la concentración de España.', 2),
      p('Luis de la Fuente ha incluido a Fran García como sustituto de Grimaldo, el lateral izquierdo del Atlético de Madrid.', 3),
      p('El lateral del Atlético no pudo participar este martes en la Nations League contra Croacia.', 4),
      p('La baja será cubierta por el futbolista de Bolaños de Calatrava, que ya ha jugado en la absoluta a órdenes de Luis de la Fuente.', 5),
      { type: 'h2' as const, text: 'Datos clave' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ claimIds: [1] });
    expect((out[1] as { text: string }).text).not.toMatch(/lesión muscular también/);
    expect((out[1] as { claimIds: number[] }).claimIds).toEqual([3, 4, 5]);
    expect(out[2]).toMatchObject({ type: 'h2' });
  });
  it('dos hechos distintos sobre las mismas personas no se confunden', () => {
    expect(sameFact('Álex Grimaldo ha tenido que abandonar la concentración de España.', 'Luis de la Fuente ha incluido a Fran García como sustituto de Grimaldo, el lateral izquierdo del Atlético de Madrid.')).toBe(false);
  });
});

describe('más rápido', () => {
  it('aprende el tope de salida de un modelo y no vuelve a pedirle lo que no le cabe', () => {
    const msg = 'openai-compatible 429: Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1639.';
    const lim = requestLimitFrom(msg)!;
    expect(lim).toEqual({ limit: 1000, output: true });
    const req = { task: 'writing' as const, system: 's', prompt: 'p', schema: {}, maxTokens: 5000 };
    expect(fitToLimit(req, lim)).toBeNull();
    expect(fitToLimit(req, { limit: 3000, output: true })?.maxTokens).toBe(3000);
    expect(fitToLimit(req, undefined)).toBe(req);
  });
  it('el tope total (entrada + salida) recorta la salida', () => {
    const lim = requestLimitFrom('Request too large for model `x` on tokens per minute (TPM): Limit 6000, Requested 7712')!;
    expect(lim.output).toBe(false);
    const req = { task: 'writing' as const, system: 'x'.repeat(3200), prompt: 'y'.repeat(3200), schema: {}, maxTokens: 5000 };
    const fitted = fitToLimit(req, lim)!;
    expect(fitted.maxTokens).toBeLessThan(5000);
    expect(fitted.maxTokens).toBeGreaterThanOrEqual(1200);
  });
  it('una historia sin piezas nuevas se mira cada vez menos y, tras un día en silencio, se deja', () => {
    expect(nextCheckDelayMinutes('DISCOVERED', 0.5, 0.2)).toBe(10);
    expect(nextCheckDelayMinutes('DISCOVERED', 3, 2)).toBe(45);
    expect(nextCheckDelayMinutes('DISCOVERED', 10, 8)).toBe(180);
    expect(nextCheckDelayMinutes('DISCOVERED', 30, 25)).toBeNull();
    // Las publicadas siguen su calendario (correcciones, versiones).
    expect(nextCheckDelayMinutes('PUBLISHED', 3, 3)).toBe(30);
  });
});
