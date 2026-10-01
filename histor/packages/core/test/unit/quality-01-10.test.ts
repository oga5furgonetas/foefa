/**
 * Casos del 01-10-2026 (Dani: «sin noticia en sí, como que no tienen sentido», «lo de la fuente
 * en el titular no sé a qué viene», «van mal escalonadas, algunas sin foto»).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITORIAL_SETTINGS } from '../../src/config/settings';
import { imageCandidates, findStoryImage, topicOverlap } from '../../src/media/wikimedia';
import { nonNewsReason } from '../../src/text/nonnews';
import { bodyHeadlineOk, goodHeadline, SourceShares } from '../../src/writing/deterministic';
import { ownBodyWords } from '../../src/writing/quality';

describe('titulares que no dicen nada', () => {
  it('una fecha no es un titular (ni con «según EFE»)', () => {
    expect(goodHeadline('Miércoles 30 septiembre de 2026, según EFE')).toBe(false);
    expect(goodHeadline('Wednesday, 30 September 2026')).toBe(false);
    expect(goodHeadline('El Gobierno aprueba los dos decretos de vivienda el 30 de septiembre')).toBe(true);
  });

  it('la agenda del día no es noticia', () => {
    expect(nonNewsReason('Miércoles 30 septiembre de 2026', 'https://efe.com/x')).toMatch(/agenda/);
    expect(nonNewsReason('Jueves, 1 de octubre de 2026', 'https://efe.com/x')).toMatch(/agenda/);
    expect(nonNewsReason('Miércoles negro en la bolsa de Madrid', 'https://efe.com/x')).toBeNull();
  });

  it('una frase del cuerpo solo es titular si nombra algo y no empieza por cuándo', () => {
    expect(bodyHeadlineOk('Ambos equipos tuvieron que esperar hasta la última semana')).toBe(false);
    expect(bodyHeadlineOk('Este martes 29 de septiembre se sentaron juntos con Pablo Motos')).toBe(false);
    expect(bodyHeadlineOk('El Tribunal Supremo rechaza la demanda de Julio Iglesias')).toBe(true);
    expect(bodyHeadlineOk('La inflación sube al 3,2 % en septiembre')).toBe(true);
  });
});

describe('cuánto texto se toma de cada fuente', () => {
  it('una nota de agencia reproducida en dos periódicos cuenta para los dos', () => {
    const wire = 'El Tribunal Supremo ha rechazado la demanda por falta de competencia y la remite a los juzgados de Madrid';
    const shares = new SourceShares([`${wire}. Otra cosa del primero.`, `Texto propio del segundo. ${wire}.`, 'Un tercer medio cuenta otra parte de la historia con palabras distintas']);
    expect(shares.holders(wire)).toEqual([0, 1]);
    shares.add(wire);
    shares.add('Un tercer medio cuenta otra parte de la historia con palabras distintas');
    // Otra frase de la misma agencia dejaría a los dos textos por encima del 45 %.
    expect(shares.fits('El Tribunal Supremo ha rechazado la demanda por falta de competencia')).toBe(false);
    expect(shares.sameHolder(wire, 'remite a los juzgados de Madrid la demanda por falta de competencia del Supremo')).toBe(true);
  });

  it('las coletillas fijas no cuentan como texto de la noticia', () => {
    const body = [
      { type: 'p' as const, text: 'Uno dos tres cuatro cinco.', claimIds: [1] },
      { type: 'p' as const, text: 'Histor seguirá actualizando esta información.', claimIds: [] },
    ];
    expect(ownBodyWords({ body, boilerplate: ['Histor seguirá actualizando esta información.'] })).toBe(5);
    expect(DEFAULT_EDITORIAL_SETTINGS.minBodyWords).toBe(50);
  });
});

type Page = { title: string; pageimage?: string; coordinates?: unknown[]; pageprops?: Record<string, string>; extract?: string; missing?: boolean };

function wiki(pages: Record<string, Page>, file: { mime?: string } = {}): typeof fetch {
  return (async (input: string | URL) => {
    const u = new URL(String(input));
    const titles = u.searchParams.get('titles') ?? '';
    const body = u.hostname.endsWith('wikipedia.org')
      ? { query: { pages: [pages[titles] ?? { title: titles, missing: true }] } }
      : {
          query: {
            pages: [
              {
                title: titles,
                imageinfo: [
                  {
                    mime: file.mime ?? 'image/jpeg',
                    width: 3000,
                    height: 4000,
                    url: `https://upload.example/${titles}`,
                    thumburl: `https://upload.example/thumb/${titles}`,
                    thumbwidth: 1280,
                    thumbheight: 1707,
                    descriptionurl: `https://commons.wikimedia.org/wiki/${titles}`,
                    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'Ana Pérez' } },
                  },
                ],
              },
            ],
          },
        };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('foto del protagonista (Wikimedia Commons)', () => {
  const story = 'Milei nombró a Adolfo Cambiaso embajador del deporte argentino. El polista argentino, estrella del polo, recibió el decreto en Buenos Aires.';

  it('la persona del titular, si su página habla de lo mismo que la noticia', async () => {
    const f = wiki({ 'Adolfo Cambiaso': { title: 'Adolfo Cambiaso', pageimage: 'Cambiaso.jpg', extract: 'Adolfo Cambiaso es un jugador de polo argentino, considerado el mejor polista del mundo.' } });
    const img = await findStoryImage([{ name: 'Adolfo Cambiaso', lang: 'es', place: false }], { fetchImpl: f, storyText: story });
    expect(img).toMatchObject({ title: 'Adolfo Cambiaso', kind: 'subject', attribution: 'Ana Pérez / Wikimedia Commons' });
  });

  it('no si la página es de otra cosa con el mismo nombre («Yamal», la península)', async () => {
    const f = wiki({ 'Lamine Yamal': { title: 'Yamal', pageimage: 'Yamal_tundra.jpg', extract: 'La península de Yamal está situada en Siberia, en el distrito autónomo de Yamalia-Nenetsia, Rusia.' } });
    const futbol = 'Lamine Yamal marca un doblete en la victoria del Barcelona por 4-1 en el Camp Nou.';
    expect(await findStoryImage([{ name: 'Lamine Yamal', lang: 'es', place: false }], { fetchImpl: f, storyText: futbol })).toBeNull();
    expect(topicOverlap('La península de Yamal está situada en Siberia, Rusia.', futbol, 'Yamal')).toBe(0);
  });

  it('una palabra sola vale si Wikipedia la lleva a un nombre completo que la contiene', async () => {
    const extract = 'Javier Milei es un economista y político argentino, presidente de Argentina desde 2023.';
    const ctx = 'Milei nombró embajador al polista. El presidente argentino firmó el decreto que publica el Boletín Oficial de Argentina.';
    const ok = wiki({ Milei: { title: 'Javier Milei', pageimage: 'Milei.jpg', extract } });
    expect(await findStoryImage([{ name: 'Milei', lang: 'es', place: false }], { fetchImpl: ok, storyText: ctx })).toMatchObject({ title: 'Javier Milei' });
    const other = wiki({ Hombre: { title: 'Ser humano', pageimage: 'Humanos.jpg', extract: 'El ser humano es una especie de primate; presidente argentino decreto.' } });
    expect(await findStoryImage([{ name: 'Hombre', lang: 'es', place: false }], { fetchImpl: other, storyText: ctx })).toBeNull();
  });

  it('en sucesos, nunca una cara: solo el lugar', async () => {
    const f = wiki({ 'Jhon Jairo Torres': { title: 'Jhon Jairo Torres', pageimage: 'JJT.jpg', extract: 'Político colombiano, exalcalde de Yopal en Casanare.' } });
    const text = 'Atentan contra Jhon Jairo Torres, exalcalde de Yopal, en Casanare.';
    expect(await findStoryImage([{ name: 'Jhon Jairo Torres', lang: 'es', place: false }], { fetchImpl: f, storyText: text, placesOnly: true })).toBeNull();
  });

  it('nada de logos, escudos ni banderas aunque sean JPEG', async () => {
    const f = wiki({ 'Real Madrid': { title: 'Real Madrid Club de Fútbol', pageimage: 'Logo_Real_Madrid.jpg', extract: 'Club de fútbol de Madrid que juega en LaLiga.' } });
    expect(await findStoryImage([{ name: 'Real Madrid', lang: 'es', place: false }], { fetchImpl: f, storyText: 'El Real Madrid gana en LaLiga con un gol en el último minuto en Madrid.' })).toBeNull();
  });

  it('candidatos: protagonistas del titular primero; un país, por su capital; las fuentes citadas, fuera', () => {
    const c = imageCandidates(
      [{ language: 'es', headline: 'Brasil: Lula tilda a Flávio Bolsonaro de mequetrefe, según EFE', summary: 'La campaña en Brasil se endurece.' }],
      { context: 'Luiz Inácio Lula da Silva habló en Brasilia.', exclude: ['EFE'] },
    );
    expect(c.map((x) => x.name)).toEqual(['Luiz Inácio Lula da Silva', 'Flávio Bolsonaro', 'Brasília']);
    expect(c.find((x) => x.name === 'Brasília')).toMatchObject({ lang: 'en', place: true });
  });

  it('un apellido suelto se completa con el nombre entero que da el texto', () => {
    const c = imageCandidates([{ language: 'es', headline: 'Nuevo estadio: Galán revela las razones del retraso', summary: '' }], { context: 'El alcalde Carlos Fernando Galán explicó el retraso.' });
    expect(c.map((x) => x.name)).toContain('Carlos Fernando Galán');
  });
});

describe('país de la noticia', () => {
  it('el titular pesa más que una mención de pasada en el cuerpo', async () => {
    const { countryVotes } = await import('../../src/pipeline/normalize');
    const src = { countryCode: 'ES', slug: 'marca', ownershipGroup: null, categoryHint: 'sports', feedUrl: 'https://e.example/rss' };
    const v = countryVotes(
      { title: 'Oficial: Fernando Alonso renueva con Aston Martin', summary: 'El piloto seguirá en la Fórmula 1 hasta 2027.', contentText: 'Su próxima carrera será el Gran Premio de Estados Unidos.' },
      src,
    );
    expect(v.ES).toBeGreaterThan(v.US ?? 0);
    const fr = countryVotes({ title: 'Francia condena a la española Swiftair por el siniestro aéreo de Malí', summary: null, contentText: 'El vuelo despegó de Uagadugú.' }, { ...src, slug: 'infobae-mundo', categoryHint: 'world' });
    expect(Object.entries(fr).sort((a, b) => b[1] - a[1])[0][0]).toBe('FR');
  });
});

describe('foto de una historia con versiones distintas', () => {
  it('manda la versión principal: lo que solo nombra otra versión no da la foto', () => {
    const c = imageCandidates([
      { language: 'es', headline: 'Justicia argentina elimina límites a la compra de tierras por parte de extranjeros', summary: 'La Corte Suprema de Argentina elimina restricciones.' },
      { language: 'fr', headline: 'Javier Milei à Paris : un président VRP au secours d’une économie argentine', summary: 'Le président argentin est à Paris.' },
    ], { categoryId: 'politics', countryCode: 'AR' });
    const names = c.map((x) => x.name);
    expect(names).not.toContain('Paris');
    expect(names).not.toContain('Javier Milei');
    expect(names).toContain('Palace of the Argentine National Congress');
  });
});
