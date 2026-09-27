/**
 * Tests adversariales del motor de verificación (sección 40 del encargo).
 * Cada caso reproduce un patrón real de desinformación y exige que el
 * sistema lo rechace o lo marque correctamente. Los textos son inventados
 * para la prueba y NO se publican nunca.
 */
import { describe, expect, it } from 'vitest';
import { item, NOW, run, source } from './helpers';

const DAY = 86400000;

describe('casos que se deben publicar', () => {
  it('historia con tres fuentes independientes creíbles → VERIFIED', () => {
    const efe = source('EFE', 'wire_agency');
    const diario = source('Diario Uno', 'reputable_media');
    const radio = source('Radio Dos', 'reputable_media', { ownershipGroup: 'Grupo Radio' });
    const bbc = source('World Service', 'reputable_media', { countryCode: 'GB' });
    const items = [
      item(efe, 'Un terremoto de magnitud 5,8 sacude Granada', 'Un terremoto de magnitud 5,8 sacudió Granada este domingo y causó daños en 40 viviendas, según el Instituto Geográfico Nacional. No hay víctimas mortales.', { minutesAgo: 90 }),
      item(diario, 'Seísmo de 5,8 en Granada: daños en 40 viviendas', 'El seísmo, de magnitud 5,8, se sintió en toda la provincia de Granada. Los técnicos municipales contabilizan daños en 40 viviendas del casco antiguo.', { minutesAgo: 70 }),
      item(radio, 'Granada registra un terremoto de magnitud 5,8', 'Protección Civil de Granada confirma que el terremoto de magnitud 5,8 dañó 40 viviendas; los bomberos revisan edificios públicos.', { minutesAgo: 60 }),
      item(bbc, 'Magnitude 5.8 earthquake hits Granada, Spain', 'A magnitude 5.8 earthquake struck Granada in southern Spain on Sunday, damaging 40 homes, local authorities said.', { minutesAgo: 50 }),
    ];
    const a = run(items, [efe, diario, radio, bbc]);
    expect(a.confidenceBreakdown.independentCredible).toBeGreaterThanOrEqual(3);
    expect(a.decision).toBe('publish');
    expect(a.nextState).toBe('VERIFIED');
    expect(a.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('fuente primaria oficial con dato propio (organismo sísmico) → publicable', () => {
    const ign = source('Instituto Sísmico Oficial', 'primary_official', { homepageUrl: 'https://sismos.example.gob.es' });
    const items = [
      item(ign, 'Terremoto de magnitud 4,1 en Murcia', 'El Instituto Sísmico Oficial ha registrado un terremoto de magnitud 4,1 con epicentro en Murcia a las 10:12 hora local, a 12 km de profundidad.', {
        minutesAgo: 20,
        structured: { magnitude: 4.1, depthKm: 12 },
      }),
    ];
    const a = run(items, [ign]);
    expect(a.decision).toBe('publish');
  });
});

describe('adversariales', () => {
  it('noticia falsa viral: muchas publicaciones en redes sin ninguna fuente fiable → no se publica', () => {
    const posts = Array.from({ length: 25 }, (_, i) => source(`Cuenta ${i}`, 'social_media', { countryCode: i % 2 ? 'MX' : 'ES' }));
    const items = posts.map((s, i) =>
      item(s, 'URGENTE: cierran todos los aeropuertos de España', `Me dicen que el Gobierno cierra todos los aeropuertos de España esta noche, compartid ${i}`, { minutesAgo: 5 + i }),
    );
    const a = run(items, posts);
    expect(a.momentum).toBeGreaterThan(0.5);
    expect(a.flags).toContain('social_only');
    expect(a.flags).toContain('viral_unverified');
    expect(a.confidence).toBeLessThanOrEqual(0.2);
    expect(['hold', 'reject']).toContain(a.decision);
  });

  it('VIRAL ≠ VERDADERO: el momentum no sube la confianza', () => {
    const diario = source('Diario Uno', 'reputable_media');
    const base = [item(diario, 'El Ayuntamiento de Vigo aprueba el presupuesto de 2027', 'El pleno del Ayuntamiento de Vigo aprobó el presupuesto municipal con 15 votos a favor.', { minutesAgo: 60 })];
    const calm = run(base, [diario]);
    const viralSources = Array.from({ length: 30 }, (_, i) => source(`Perfil ${i}`, 'social_media'));
    const viralItems = viralSources.map((s) => item(s, 'Vigo aprueba presupuesto', 'Vigo ya tiene presupuesto de 2027, increíble', { minutesAgo: 3 }));
    const viral = run([...base, ...viralItems], [diario, ...viralSources]);
    expect(viral.momentum).toBeGreaterThan(calm.momentum);
    expect(viral.confidence).toBeLessThanOrEqual(calm.confidence);
  });

  it('fuente única creíble → nunca VERIFIED; como mucho "en desarrollo" atribuido', () => {
    const diario = source('Diario Uno', 'reputable_media');
    const items = [
      item(diario, 'La empresa Ejemplo cerrará su planta de Zaragoza', 'La empresa Ejemplo cerrará su planta de Zaragoza en 2027 y despedirá a 300 trabajadores, según ha podido saber este diario.', { minutesAgo: 30 }),
    ];
    const a = run(items, [diario]);
    expect(a.flags).toContain('single_source');
    expect(a.confidence).toBeLessThanOrEqual(0.6);
    expect(a.decision).not.toBe('publish');
    expect(a.nextState).not.toBe('VERIFIED');
  });

  it('múltiples fuentes copiándose (todas citan a la misma agencia) → cuentan como UNA', () => {
    const outlets = Array.from({ length: 6 }, (_, i) => source(`Medio ${i}`, 'reputable_media'));
    const text = 'MADRID (EFE) — El Ministerio de Ejemplo anunció este lunes un plan de 200 millones de euros para renovar trenes de cercanías, según fuentes del departamento.';
    const items = outlets.map((s, i) => item(s, 'Plan de 200 millones para renovar trenes', text + (i ? ` Actualización ${i}.` : ''), { minutesAgo: 60 - i * 5 }));
    const a = run(items, outlets);
    expect(a.groups).toHaveLength(1);
    expect(a.confidenceBreakdown.independentCredible).toBe(1);
    expect(a.decision).not.toBe('publish');
  });

  it('copias literales sin citar a nadie también se agrupan como una sola fuente', () => {
    const outlets = Array.from({ length: 4 }, (_, i) => source(`Web ${i}`, 'reputable_media'));
    const text = 'El consejo de administración de Ejemplo Energía aprobó ayer la venta de su filial solar por 900 millones de euros a un fondo de inversión con sede en Luxemburgo.';
    const items = outlets.map((s, i) => item(s, 'Ejemplo Energía vende su filial solar', text, { minutesAgo: 120 - i * 10 }));
    const a = run(items, outlets);
    expect(a.groups).toHaveLength(1);
    expect(a.flags).toContain('copied_network');
  });

  it('imagen antigua reutilizada → flag old_image', () => {
    const a1 = source('Diario Uno', 'reputable_media');
    const a2 = source('Diario Dos', 'reputable_media');
    const phash = 'f0f0f0f0a5a5a5a5';
    const items = [
      item(a1, 'Incendio en un polígono de Lugo', 'Un incendio calcinó este domingo una nave del polígono de O Ceao, en Lugo, sin causar heridos.', { minutesAgo: 60, imagePhash: phash }),
      item(a2, 'Arde una nave en O Ceao (Lugo)', 'Los bomberos de Lugo apagaron el incendio de una nave industrial en O Ceao; no hubo heridos.', { minutesAgo: 40 }),
    ];
    const a = run(items, [a1, a2], { priorImageFingerprints: [{ phash: 'f0f0f0f0a5a5a5a4', firstSeenAt: new Date(NOW.getTime() - 400 * DAY), url: 'https://archivo.example/2025/foto.jpg' }] });
    expect(a.flags).toContain('old_image');
  });

  it('fecha incorrecta: fuentes sitúan el hecho en días distintos → contradicción de fecha', () => {
    const a1 = source('Diario Uno', 'reputable_media');
    const a2 = source('Diario Dos', 'reputable_media');
    const items = [
      item(a1, 'El puente de Rande reabrirá el 14 de octubre de 2026', 'La Xunta confirmó que el puente de Rande reabrirá al tráfico el 14 de octubre de 2026 tras las obras de mantenimiento.', { minutesAgo: 80 }),
      item(a2, 'Rande reabrirá el 2 de diciembre de 2026', 'La Xunta confirmó que el puente de Rande reabrirá al tráfico el 2 de diciembre de 2026 tras las obras de mantenimiento.', { minutesAgo: 70 }),
    ];
    const a = run(items, [a1, a2]);
    expect(a.contradictions.some((c) => c.field === 'date')).toBe(true);
    expect(a.flags).toContain('date_mismatch');
    expect(a.decision).not.toBe('publish');
  });

  it('persona equivocada: la misma cita atribuida a dos personas distintas → crítica, se retiene', () => {
    const a1 = source('Diario Uno', 'reputable_media');
    const a2 = source('Diario Dos', 'reputable_media');
    const items = [
      item(a1, 'Polémica por unas declaraciones sobre la vivienda', '«No vamos a permitir ni un solo desahucio más este invierno», dijo Laura Gómez en el pleno municipal.', { minutesAgo: 50 }),
      item(a2, 'Declaraciones sobre desahucios en el pleno', '«No vamos a permitir ni un solo desahucio más este invierno», dijo Marta Ruiz durante el pleno municipal.', { minutesAgo: 45 }),
    ];
    const a = run(items, [a1, a2]);
    expect(a.contradictions.some((c) => c.field === 'quote' && c.severity === 'critical')).toBe(true);
    expect(a.flags).toContain('fabricated_quote');
    expect(a.decision).toBe('hold');
  });

  it('cita inventada: un blog atribuye una frase que ninguna fuente fiable recoge', () => {
    const blog = source('Blog Opina', 'blog');
    const d1 = source('Diario Uno', 'reputable_media');
    const d2 = source('Diario Dos', 'reputable_media');
    const items = [
      item(d1, 'La alcaldesa de Ourense presenta el plan de movilidad', 'La alcaldesa de Ourense, Carmen Vidal, presentó el plan de movilidad que peatonaliza 12 calles del centro.', { minutesAgo: 90 }),
      item(d2, 'Ourense peatonalizará 12 calles del centro', 'El plan de movilidad de Ourense, presentado por la alcaldesa Carmen Vidal, peatonaliza 12 calles del centro.', { minutesAgo: 80 }),
      item(blog, 'La alcaldesa de Ourense contra los coches', '«Los coches son el cáncer de esta ciudad y los vamos a echar a todos», dijo Carmen Vidal al presentar el plan de movilidad de Ourense.', { minutesAgo: 30 }),
    ];
    const a = run(items, [blog, d1, d2]);
    const quoteClaim = a.claims.find((c) => c.quote?.text.startsWith('Los coches'));
    expect(quoteClaim).toBeDefined();
    expect(a.assessments.find((x) => x.claimKey === quoteClaim!.key)?.status).toBe('unsupported');
    expect(a.flags).toContain('fabricated_quote');
  });

  it('cifra contradictoria entre fuentes simultáneas → contradicción mayor y menos confianza', () => {
    const d1 = source('Agencia Uno', 'wire_agency');
    const d2 = source('Diario Dos', 'reputable_media');
    const d3 = source('Diario Tres', 'reputable_media');
    const ok = [
      item(d1, 'Accidente de autobús en Toledo', 'Un accidente de autobús en la A-42, en Toledo, dejó 12 muertos y 30 heridos, según Protección Civil.', { minutesAgo: 30 }),
      item(d2, 'Accidente de autobús en la A-42', 'El accidente del autobús en la A-42, en Toledo, dejó 12 muertos y 30 heridos, confirmó Protección Civil.', { minutesAgo: 28 }),
    ];
    const conflicting = [
      ...ok,
      item(d3, 'Accidente de autobús en Toledo: 45 muertos', 'El accidente del autobús en la A-42, en Toledo, dejó 45 muertos y 30 heridos, según Protección Civil.', { minutesAgo: 27 }),
    ];
    const clean = run(ok, [d1, d2]);
    const dirty = run(conflicting, [d1, d2, d3]);
    expect(dirty.contradictions.some((c) => c.field === 'number' && c.severity === 'major')).toBe(true);
    expect(dirty.confidence).toBeLessThan(clean.confidence);
  });

  it('una cifra que cambia con horas de diferencia es un balance que evoluciona, no una contradicción grave', () => {
    const d1 = source('Agencia Uno', 'wire_agency');
    const d2 = source('Diario Dos', 'reputable_media');
    const items = [
      item(d1, 'Inundaciones en Valencia', 'Las inundaciones en Valencia han causado 3 muertos, según el último balance de Emergencias.', { minutesAgo: 400 }),
      item(d2, 'Sube el balance de las inundaciones en Valencia', 'Las inundaciones en Valencia han causado 5 muertos, según el último balance de Emergencias.', { minutesAgo: 30 }),
    ];
    const a = run(items, [d1, d2]);
    const numC = a.contradictions.filter((c) => c.field === 'number');
    expect(numC.length).toBeGreaterThan(0);
    expect(numC.every((c) => c.severity === 'minor')).toBe(true);
  });

  it('rumor de X/Twitter ("según me cuentan") → pista, no evidencia', () => {
    const x = source('@cuenta_anonima', 'social_media');
    const items = [item(x, 'Dimite el ministro de Ejemplo', 'Reportedly el ministro de Ejemplo ha dimitido esta mañana, me lo confirman fuentes, atentos', { minutesAgo: 10 })];
    const a = run(items, [x]);
    expect(a.flags).toContain('social_only');
    expect(a.confidence).toBeLessThanOrEqual(0.2);
    expect(a.decision).toBe('hold');
  });

  it('noticia satírica → rechazada aunque parezca verosímil', () => {
    const sat = source('El Mundo Today Demo', 'reputable_media', { isSatire: true });
    const d1 = source('Diario Uno', 'reputable_media');
    const items = [
      item(sat, 'El Gobierno prohíbe los lunes a partir de 2027', 'El Consejo de Ministros aprobó ayer eliminar los lunes del calendario laboral a partir de 2027.', { minutesAgo: 60 }),
      item(d1, 'El Gobierno prohíbe los lunes', 'Circula la noticia de que el Gobierno eliminará los lunes a partir de 2027.', { minutesAgo: 20 }),
    ];
    const a = run(items, [sat, d1]);
    expect(a.flags).toContain('satire_source');
    expect(a.decision).toBe('reject');
    expect(a.confidence).toBe(0);
  });

  it('artículo antiguo que vuelve a hacerse viral → rechazado como reciclado', () => {
    const d1 = source('Diario Uno', 'reputable_media');
    const d2 = source('Agencia Uno', 'wire_agency');
    const posts = Array.from({ length: 8 }, (_, i) => source(`Usuario ${i}`, 'social_media'));
    const twoYearsAgo = new Date(NOW.getTime() - 730 * DAY);
    const items = [
      item(d1, 'Nevada histórica en Sevilla', 'Una nevada histórica cubrió Sevilla de blanco, algo que no ocurría desde 1954.', { publishedAt: twoYearsAgo }),
      item(d2, 'Sevilla, cubierta de nieve', 'La nieve cubrió Sevilla por primera vez desde 1954.', { publishedAt: new Date(twoYearsAgo.getTime() + 3600000) }),
      ...posts.map((s) => item(s, 'Nieva en Sevilla ahora mismo', 'Increíble, nieva en Sevilla hoy, mirad la foto', { minutesAgo: 15 })),
    ];
    const a = run(items, [d1, d2, ...posts]);
    expect(a.flags).toContain('old_resurfaced');
    expect(a.decision).toBe('reject');
  });

  it('desmentido oficial tras publicar → retirada o revisión', () => {
    const d1 = source('Diario Uno', 'reputable_media');
    const d2 = source('Diario Dos', 'reputable_media');
    const gov = source('Ministerio de Ejemplo', 'primary_official');
    const items = [
      item(d1, 'Ana Torres dimite como ministra de Ejemplo', 'Ana Torres ha dimitido como ministra de Ejemplo, según fuentes de su entorno.', { minutesAgo: 120 }),
      item(d2, 'Dimisión de Ana Torres', 'Ana Torres deja el Ministerio de Ejemplo, según ha podido saber este periódico.', { minutesAgo: 110 }),
      item(gov, 'Comunicado sobre Ana Torres', 'El Ministerio de Ejemplo desmiente la dimisión de Ana Torres, que sigue en su puesto. Es falso que haya dimitido.', { minutesAgo: 20 }),
    ];
    const a = run(items, [d1, d2, gov], { state: 'PUBLISHED', published: true, publishedConfidence: 0.7 });
    expect(a.contradictions.some((c) => c.field === 'denial' && c.severity === 'critical')).toBe(true);
    expect(['retract', 'review']).toContain(a.decision);
  });

  it('predicción no se convierte en hecho', () => {
    const d1 = source('Diario Uno', 'reputable_media');
    const d2 = source('Diario Dos', 'reputable_media');
    const items = [
      item(d1, 'El Banco Central podría subir los tipos en diciembre', 'Los analistas creen que el Banco Central podría subir los tipos de interés en diciembre.', { minutesAgo: 60 }),
      item(d2, 'Posible subida de tipos en diciembre', 'El Banco Central podría subir los tipos en diciembre, según los analistas consultados.', { minutesAgo: 50 }),
    ];
    const a = run(items, [d1, d2]);
    const headline = a.claims.find((c) => c.isHeadline && c.itemId === items[0].id)!;
    expect(headline.modality).toBe('predicted');
    expect(headline.kind).toBe('prediction');
  });
});
