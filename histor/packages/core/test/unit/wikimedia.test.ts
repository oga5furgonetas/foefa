/**
 * Imágenes ilustrativas de Wikimedia Commons: solo lugares, solo licencias libres,
 * solo fotos. Sin red: respuestas de la API simuladas.
 */
import { describe, expect, it } from 'vitest';
import { findPlaceImage } from '../../src/media/wikimedia';

type Page = { title: string; pageimage?: string; coordinates?: unknown[]; pageprops?: Record<string, string>; missing?: boolean };
type File = { missing?: boolean; mime?: string; width?: number; license?: string; artist?: string };

function fakeFetch(wiki: Record<string, Page>, files: Record<string, File>): typeof fetch {
  return (async (input: string | URL) => {
    const u = new URL(String(input));
    const titles = u.searchParams.get('titles') ?? '';
    let body: unknown;
    if (u.hostname.endsWith('wikipedia.org')) {
      body = { query: { pages: [wiki[titles] ?? { title: titles, missing: true }] } };
    } else {
      const f = files[titles.replace(/^File:/, '')];
      body = {
        query: {
          pages: [
            !f || f.missing
              ? { title: titles, missing: true }
              : {
                  title: titles,
                  imageinfo: [
                    {
                      mime: f.mime ?? 'image/jpeg',
                      width: f.width ?? 4000,
                      height: 3000,
                      url: `https://upload.example/${titles}`,
                      thumburl: `https://upload.example/thumb/${titles}`,
                      thumbwidth: 1200,
                      thumbheight: 900,
                      descriptionurl: `https://commons.wikimedia.org/wiki/${titles}`,
                      extmetadata: { LicenseShortName: { value: f.license ?? 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' }, Artist: { value: f.artist ?? '<a href="x">Ana Pérez</a>' } },
                    },
                  ],
                },
          ],
        },
      };
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('imagen ilustrativa de Wikimedia Commons', () => {
  it('toma la foto principal del lugar con licencia libre, autor y enlace a la ficha', async () => {
    const f = fakeFetch({ Bangkok: { title: 'Bangkok', pageimage: 'Bangkok_skyline.jpg', coordinates: [{}] } }, { 'Bangkok_skyline.jpg': {} });
    const img = await findPlaceImage(['Bangkok'], { fetchImpl: f });
    expect(img).toMatchObject({ title: 'Bangkok', license: 'CC BY-SA 4.0', author: 'Ana Pérez', attribution: 'Ana Pérez / Wikimedia Commons' });
    expect(img!.sourceUrl).toMatch(/commons\.wikimedia\.org/);
  });

  it('nunca personas (sin coordenadas) ni páginas de desambiguación', async () => {
    const f = fakeFetch(
      { 'Emmanuel Macron': { title: 'Emmanuel Macron', pageimage: 'Macron.jpg' }, Lourdes: { title: 'Lourdes', pageimage: 'L.jpg', coordinates: [{}], pageprops: { disambiguation: '' } } },
      { 'Macron.jpg': {}, 'L.jpg': {} },
    );
    expect(await findPlaceImage(['Emmanuel Macron', 'Lourdes'], { fetchImpl: f })).toBeNull();
  });

  it('rechaza banderas y mapas (SVG), licencias NC/ND, imágenes que no están en Commons y fotos pequeñas', async () => {
    const wiki = (file: string): Record<string, Page> => ({ X: { title: 'X', pageimage: file, coordinates: [{}] } });
    expect(await findPlaceImage(['X'], { fetchImpl: fakeFetch(wiki('Flag.svg'), { 'Flag.svg': { mime: 'image/svg+xml' } }) })).toBeNull();
    expect(await findPlaceImage(['X'], { fetchImpl: fakeFetch(wiki('a.jpg'), { 'a.jpg': { license: 'CC BY-NC-SA 4.0' } }) })).toBeNull();
    expect(await findPlaceImage(['X'], { fetchImpl: fakeFetch(wiki('b.jpg'), { 'b.jpg': { license: 'CC BY-ND 2.0' } }) })).toBeNull();
    expect(await findPlaceImage(['X'], { fetchImpl: fakeFetch(wiki('c.jpg'), { 'c.jpg': { missing: true } }) })).toBeNull();
    expect(await findPlaceImage(['X'], { fetchImpl: fakeFetch(wiki('d.jpg'), { 'd.jpg': { width: 300 } }) })).toBeNull();
  });

  it('acepta dominio público y CC0, y prueba el siguiente candidato si el primero no vale', async () => {
    const f = fakeFetch(
      { España: { title: 'España', pageimage: 'Flag.svg', coordinates: [{}] }, Madrid: { title: 'Madrid', pageimage: 'Madrid.jpg', coordinates: [{}] } },
      { 'Flag.svg': { mime: 'image/svg+xml' }, 'Madrid.jpg': { license: 'Public domain', artist: '' } },
    );
    const img = await findPlaceImage(['España', 'Madrid'], { fetchImpl: f });
    expect(img).toMatchObject({ title: 'Madrid', license: 'Public domain', author: null, attribution: 'Wikimedia Commons' });
  });
});

describe('fotos en espectáculos y deportes (03-10-2026)', () => {
  it('nunca la foto del lugar: el concierto de BTS en Bogotá no lleva una autopista', async () => {
    const { imageCandidates } = await import('../../src/media/wikimedia');
    const arts = [{ language: 'es', headline: 'BTS conquistó Bogotá: estos fueron los momentos de su primer concierto en El Campín', summary: 'BTS hizo vibrar Bogotá en su primer concierto.' }];
    const c = imageCandidates(arts, { categoryId: 'entertainment', countryCode: 'CO' });
    expect(c.some((x) => x.place)).toBe(false);
    expect(imageCandidates(arts, { categoryId: 'society', countryCode: 'CO' }).some((x) => x.place)).toBe(true);
  });
});
