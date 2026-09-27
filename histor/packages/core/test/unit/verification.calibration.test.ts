/**
 * Calibración del modelo de confianza: fija los comportamientos que la
 * redacción espera (regla de las dos fuentes, tope de fuente única, pistas).
 */
import { describe, expect, it } from 'vitest';
import { item, run, source } from './helpers';

describe('calibración de la confianza', () => {
  it('dos fuentes independientes creíbles que coinciden → supera el umbral de verificado', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const d2 = source('Diario Sur', 'reputable_media');
    const a = run(
      [
        item(d1, 'El Parlamento de Galicia aprueba la ley de montes', 'El Parlamento de Galicia aprobó la ley de montes con 38 votos a favor y 37 en contra.', { minutesAgo: 90 }),
        item(d2, 'Galicia aprueba la ley de montes por un voto', 'La ley de montes salió adelante en el Parlamento de Galicia con 38 votos a favor y 37 en contra.', { minutesAgo: 60 }),
      ],
      [d1, d2],
    );
    expect(a.confidenceBreakdown.independentCredible).toBe(2);
    expect(a.confidence).toBeGreaterThanOrEqual(0.75);
    expect(a.decision).toBe('publish');
  });

  it('una sola fuente creíble queda como mucho en 0,60 ("en desarrollo")', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const a = run([item(d1, 'El Parlamento de Galicia aprueba la ley de montes', 'El Parlamento de Galicia aprobó la ley de montes con 38 votos a favor.', { minutesAgo: 30 })], [d1]);
    expect(a.confidence).toBeLessThanOrEqual(0.6);
    expect(a.confidenceBreakdown.capReason).toMatch(/una sola fuente/);
  });

  it('las pistas (redes) suman como mucho un poco, nunca verifican', () => {
    const d1 = source('Diario Norte', 'reputable_media');
    const posts = Array.from({ length: 40 }, (_, i) => source(`p${i}`, 'social_media'));
    const a = run(
      [
        item(d1, 'Corte de luz en Santiago de Compostela', 'Un corte de luz dejó sin suministro a 20.000 hogares de Santiago de Compostela.', { minutesAgo: 30 }),
        ...posts.map((p) => item(p, 'Sin luz en Santiago', 'Sin luz en Santiago de Compostela desde hace un rato', { minutesAgo: 10 })),
      ],
      [d1, ...posts],
    );
    expect(a.confidence).toBeLessThanOrEqual(0.6);
    expect(a.decision).not.toBe('publish');
  });
});
