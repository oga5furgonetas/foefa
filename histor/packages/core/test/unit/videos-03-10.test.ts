/**
 * Vídeos de la noticia (03-10-2026): RSS de YouTube, título limpio y emparejado conservador.
 * Los casos salen de los canales reales el día de la votación de los decretos de vivienda.
 */
import { describe, expect, it } from 'vitest';
import { cleanVideoTitle, parseYoutubeFeed, videoMatchScore } from '../../src/media/videos';

const DECRETO = 'España: el Congreso de los Diputados rechaza en votación el primer decreto de vivienda';

describe('vídeos de la noticia', () => {
  it('lee el RSS de un canal', () => {
    const xml = `<feed><entry><yt:videoId>abc123</yt:videoId><title>El Congreso tumba &quot;los&quot; decretos</title>
      <published>2026-10-03T08:00:00+00:00</published><media:group><media:description>Texto</media:description></media:group></entry>
      <entry><title>sin id</title></entry></feed>`;
    const [e, ...rest] = parseYoutubeFeed(xml);
    expect(rest).toHaveLength(0);
    expect(e).toMatchObject({ videoId: 'abc123', title: 'El Congreso tumba "los" decretos', description: 'Texto' });
  });

  it('quita el rótulo de urgencia y el nombre del canal', () => {
    expect(cleanVideoTitle('ÚLTIMA HORA | El Congreso tumba los dos decretos de vivienda | RTVE Noticias', 'RTVE Noticias')).toBe('El Congreso tumba los dos decretos de vivienda');
    expect(cleanVideoTitle('Congreso español tumba los decretos sobre vivienda | AFP', 'AFP Español')).toBe('Congreso español tumba los decretos sobre vivienda');
    expect(cleanVideoTitle('Gaza: alto el fuego', 'Euronews')).toBe('Gaza: alto el fuego');
  });

  it('empareja el vídeo con la historia que cuenta lo mismo', () => {
    expect(videoMatchScore('El Congreso tumba los dos decretos de vivienda', [DECRETO])).toBeGreaterThan(0);
    expect(videoMatchScore('Congreso español tumba los decretos sobre vivienda y agrava la presión sobre Sánchez', ['Congreso de España rechaza dos decretos sobre vivienda y Pedro Sánchez decidirá el fin de semana si adelanta elecciones'])).toBeGreaterThan(0);
  });

  it('no empareja por compartir solo un nombre o palabras comunes', () => {
    expect(videoMatchScore('El Congreso aprueba la ley de presupuestos', [DECRETO])).toBe(0);
    expect(videoMatchScore('Sánchez visita Brasil', ['Sánchez anuncia elecciones anticipadas en España'])).toBe(0);
    // Palabras en común pero ningún nombre propio compartido.
    expect(videoMatchScore('rechaza votación decreto vivienda', [DECRETO])).toBe(0);
  });
});
