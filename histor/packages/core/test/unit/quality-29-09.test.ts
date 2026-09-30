/**
 * Fallos vistos en la portada de producción el 29-09-2026:
 * - «S&aacute;nchez ha clausurado…», «desaceleraci&oacute;n»: entidades sin decodificar.
 * - «MADRID, 29 OpenAI ha decidido…»: la firma de agencia se colaba en la entradilla.
 * - Infobae copiaba el teletipo de Europa Press y contaba como fuente independiente.
 * - La historia se quedaba con la sección y el país de su PRIMERA pieza («Francia» para OpenAI).
 */
import { describe, expect, it } from 'vitest';
import { countryFromHeaders } from '../../src/geo/detect';
import { domesticDesk } from '../../src/pipeline/normalize';
import { storyConsensus } from '../../src/pipeline/verify';
import { detectAttribution, stripDateline, wireOrigin } from '../../src/text/attribution';
import { decodeEntities } from '../../src/text/normalize';
import { cleanTitle } from '../../src/ingest/parsers';
import { extractEntities } from '../../src/text/entities';
import { numberOverlap } from '../../src/text/similarity';
import { nonNewsReason, pressReleaseReason } from '../../src/text/nonnews';
import { extractClaims } from '../../src/verification/claims';
import { compressClaim } from '../../src/writing/compress';
import { goodHeadline, standsAlone, usableSentence } from '../../src/writing/deterministic';
import { personalDataIn } from '../../src/writing/quality';
import { run, item, source } from './helpers';

describe('entidades HTML', () => {
  it('decodifica las letras acentuadas y respeta mayúsculas', () => {
    expect(decodeEntities('S&aacute;nchez ha clausurado en Barcelona')).toBe('Sánchez ha clausurado en Barcelona');
    expect(decodeEntities('desaceleraci&oacute;n, Espa&ntilde;a, a&ccedil;&atilde;o, Stra&szlig;e')).toBe('desaceleración, España, ação, Straße');
    expect(decodeEntities('&Aacute;frica y &Eacute;cija')).toBe('África y Écija');
    expect(decodeEntities('&laquo;hola&raquo; &mdash; 3&nbsp;%')).toBe('«hola» — 3 %');
  });

  it('resuelve el doble escapado de algunos feeds', () => {
    expect(decodeEntities('S&amp;aacute;nchez')).toBe('Sánchez');
  });

  it('deja intacto lo que no es una entidad', () => {
    expect(decodeEntities('AT&T y R&D')).toBe('AT&T y R&D');
    expect(decodeEntities('&inventada;')).toBe('&inventada;');
  });
});

describe('firma de agencia', () => {
  it('se quita del principio de la frase', () => {
    expect(stripDateline('MADRID, 29 Sep. (EUROPA PRESS) - OpenAI ha decidido cancelar el lanzamiento de su modelo.')).toBe('OpenAI ha decidido cancelar el lanzamiento de su modelo.');
    expect(stripDateline('MADRID, 29 OpenAI ha decidido cancelar el lanzamiento de su modelo.')).toBe('OpenAI ha decidido cancelar el lanzamiento de su modelo.');
    expect(stripDateline('WASHINGTON (AP) — The Senate passed the bill on Monday after a long debate.')).toBe('The Senate passed the bill on Monday after a long debate.');
    expect(stripDateline('Ciudad de México, 29 sep (EFE).- El Gobierno anunció un nuevo plan de seguridad.')).toBe('El Gobierno anunció un nuevo plan de seguridad.');
    expect(stripDateline('BERLIN, 29. September (dpa) - Die Regierung hat am Montag entschieden.')).toBe('Die Regierung hat am Montag entschieden.');
  });

  it('no toca frases normales', () => {
    const s = 'El Gobierno (PSOE y Sumar) - según fuentes - aprobó la ley.';
    expect(stripDateline(s)).toBe(s);
    expect(stripDateline('La ONU, 29 países y la UE firmaron el acuerdo.')).toBe('La ONU, 29 países y la UE firmaron el acuerdo.');
  });

  it('reconoce la agencia aunque la firma lleve fecha', () => {
    expect(detectAttribution('MADRID, 29 (EUROPA PRESS) - OpenAI ha decidido cancelar el lanzamiento.')).toBe('Europa Press');
    expect(wireOrigin('MADRID, 29 Sep. (EUROPA PRESS) - OpenAI ha decidido cancelar el lanzamiento.')).toBe('Europa Press');
    expect(wireOrigin('Texto largo del artículo que termina con el crédito de la agencia. (EFE)')).toBe('EFE');
  });

  it('con el artículo completo, un «según» a mitad de texto no convierte la pieza en teletipo', () => {
    expect(wireOrigin('El Gobierno aprobó la ley. En el tercer párrafo, según EFE, hubo protestas. El debate sigue abierto en el Congreso.')).toBeNull();
  });

  it('la afirmación no empieza por la firma', () => {
    const ep = source('Europa Press', 'wire_agency');
    const claims = extractClaims(item(ep, 'OpenAI cancela GPT-6.1 Astra', 'MADRID, 29 (EUROPA PRESS) - OpenAI ha decidido cancelar el lanzamiento de GPT-6.1 Astra por problemas de seguridad.'));
    expect(claims.some((c) => c.text.startsWith('OpenAI ha decidido cancelar'))).toBe(true);
    expect(claims.some((c) => /^MADRID/.test(c.text))).toBe(false);
  });
});

describe('copias de teletipo', () => {
  it('Infobae con el texto de Europa Press no suma una fuente independiente', () => {
    const ep = source('Europa Press', 'wire_agency', { ownershipGroup: 'europa-press' });
    const infobae = source('Infobae', 'reputable_media', { ownershipGroup: 'infobae', countryCode: 'AR' });
    const lemonde = source('Le Monde', 'reputable_media', { ownershipGroup: 'groupe-le-monde', countryCode: 'FR' });
    const body = 'MADRID, 29 (EUROPA PRESS) - OpenAI ha decidido cancelar el lanzamiento de su modelo GPT-6.1 Astra por problemas de seguridad detectados en las pruebas.';
    const a = run(
      [
        item(ep, 'OpenAI cancela el lanzamiento de GPT-6.1 Astra', body, { minutesAgo: 90 }),
        item(infobae, 'OpenAI cancela el lanzamiento de GPT-6.1 Astra por seguridad', body, { minutesAgo: 60 }),
        item(lemonde, 'OpenAI renonce à lancer GPT-6.1 Astra', 'OpenAI a décidé de ne pas lancer son modèle GPT-6.1 Astra pour des raisons de sécurité.', { minutesAgo: 30 }),
      ],
      [ep, infobae, lemonde],
    );
    const groups = new Set(Object.values(a.itemGroup).map((g) => g.key));
    expect(groups.size).toBe(2);
  });
});

describe('sección y país por consenso', () => {
  const row = (categoryId: string | null, countryCode: string | null, classification: Record<string, number>, places: { countryCode: string }[] = []) => ({
    categoryId,
    countryCode,
    meta: { classification, places: places.map((p) => ({ kind: 'country', countryCode: p.countryCode, regionCode: null, cityKey: null, name: p.countryCode })) },
  });

  it('manda la mayoría, no la primera pieza', () => {
    const c = storyConsensus([
      row('sports', 'ES', { sports: 1.5 }),
      row('technology', 'US', { technology: 2.5 }),
      row('technology', 'FR', { technology: 2 }),
    ]);
    expect(c.categoryId).toBe('technology');
  });

  it('sin lugar citado, el país de las fuentes solo si coinciden la mayoría; si no, ninguno', () => {
    expect(storyConsensus([row('technology', 'FR', {}), row('technology', 'ES', {}), row('technology', 'AR', {})]).countryCode).toBeNull();
    expect(storyConsensus([row('politics', 'US', {}), row('politics', 'US', {}), row('politics', 'GB', {})]).countryCode).toBe('US');
  });

  it('el lugar citado por más piezas gana al país de la fuente', () => {
    expect(storyConsensus([row('world', 'ES', {}, [{ countryCode: 'ZA' }]), row('world', 'GB', {}, [{ countryCode: 'ZA' }])]).countryCode).toBe('ZA');
  });
});

describe('país del lector', () => {
  it('usa la cabecera de la CDN si existe y, si no, no inventa nada sin base de IP', () => {
    const h = (m: Record<string, string>) => (k: string) => m[k] ?? null;
    expect(countryFromHeaders(h({ 'cf-ipcountry': 'mx' }))).toBe('MX');
    expect(countryFromHeaders(h({ 'cf-ipcountry': 'XX' }))).toBeNull();
    expect(countryFromHeaders(h({ 'fly-client-ip': 'no-es-una-ip' }))).toBeNull();
  });
});

describe('titulares y entradillas que se entienden solos (portada del 29-09-2026)', () => {
  it('rechaza titulares que no son titulares', () => {
    expect(goodHeadline('Alba Carrillo')).toBe(false);
    expect(goodHeadline('"Los españoles no necesitan un Gobierno que se lave las manos')).toBe(false);
    expect(goodHeadline('«Llevamos mucho tiempo sin perder», dice Flick')).toBe(false);
    expect(goodHeadline('Serbia: Aleksandar Vucic renuncia a la Presidencia para buscar ser primer ministro')).toBe(true);
    expect(goodHeadline('Sánchez pide «privilegiar» la vivienda residencial frente a la turística')).toBe(true);
  });

  it('una entradilla no empieza por un posesivo, un demostrativo o una transición', () => {
    expect(standsAlone('Su partido, el SNS, ganó con mayoría absoluta las elecciones de diciembre de 2023.')).toBe(false);
    expect(standsAlone('Esta empresa fue fundada por Claudio Rivas y administrada por Pedro Antonio Marín.')).toBe(false);
    expect(standsAlone('Es que después del 6 de octubre comenzará la era post Lionel Messi.')).toBe(false);
    expect(standsAlone('Siguiendo esta línea, ha reconocido que el modelo no siempre fue honesto.')).toBe(false);
    expect(standsAlone('Este lunes, el Gobierno aprobó el decreto de vivienda en el Consejo de Ministros.')).toBe(true);
    expect(standsAlone('Ce mardi, le gouvernement a présenté son budget pour 2027.')).toBe(true);
    expect(standsAlone('Es la primera vez que la Starship de SpaceX alcanza la órbita.')).toBe(true);
    expect(standsAlone('OpenAI ha decidido cancelar el lanzamiento de GPT-6.1 Astra.')).toBe(true);
  });
});

describe('borradores reales del 29-09-2026 (huelga en Francia, nombramiento en Marruecos)', () => {
  it('una cantidad con separador de miles no es un teléfono; un móvil sí', () => {
    expect(personalDataIn('Montant: 54 000 000 000 € (selon RFI)')).toBeNull();
    expect(personalDataIn('Personnes: 300 000 (selon Le Monde)\nPersonnes: 170 000 (selon RFI)')).toBeNull();
    expect(personalDataIn('Ont manifesté 1.250.000 personas en todo el país.')).toBeNull();
    expect(personalDataIn('Para más información, llame al 612 345 678.')?.kind).toBe('teléfono');
    expect(personalDataIn('Escriba a lector@example.org')?.kind).toBe('correo');
  });

  it('un «selon X» en mitad de la frase es un inciso, no la coletilla final', () => {
    const s = "Depuis 2017, le point d'indice a été revalorisé de 5 % alors que sur la période, selon l'Insee, l'inflation cumulée a atteint plus de 24 %";
    const out = compressClaim(s, 40);
    expect(out).toContain('24 %');
    expect(compressClaim('El Gobierno aprobó el decreto de vivienda en el Consejo de Ministros, según fuentes oficiales')).toBe('El Gobierno aprobó el decreto de vivienda en el Consejo de Ministros');
  });

  it('corta la finalidad cuando no cabe, sin tocar el hecho', () => {
    expect(compressClaim('Grève du 29 septembre : plus de 200 000 personnes ont manifesté en France pour demander plus de moyens dans la fonction publique', 16, { commaCut: false })).toBe(
      'Grève du 29 septembre : plus de 200 000 personnes ont manifesté en France',
    );
  });

  it('la publicidad de la web del medio no es una afirmación', () => {
    const rfi = source('RFI', 'reputable_media');
    const claims = extractClaims(item(rfi, 'Maroc: Fatima Ezzahra El Mansouri nommée cheffe du gouvernement', "Le roi Mohammed VI a reçu mardi Fatima Ezzahra El Mansouri au palais royal de Rabat. Suivez toute l'actualité internationale en téléchargeant l'application RFI. À lire aussiFrance: Sébastien Lecornu présente un budget pour 2027."));
    expect(claims.some((c) => /application RFI|lire aussi/i.test(c.text))).toBe(false);
    expect(usableSentence('« On a perdu énormément en pouvoir d\'achat, dénonce Sylvie Aébischer')).toBe(false);
  });
});

describe('alertas verdes de GDACS', () => {
  it('no son noticia; las naranjas y rojas sí', () => {
    expect(nonNewsReason('Green forest fire notification in Australia', 'https://www.gdacs.org/report.aspx?eventid=1')).toMatch(/verde/);
    expect(nonNewsReason('Green earthquake (Magnitude 6.6M, Depth:10km) in Vanuatu 25/09/2026 21:00 UTC', 'https://www.gdacs.org/x')).toMatch(/verde/);
    expect(nonNewsReason('Orange earthquake (Magnitude 7.1M) in Japan', 'https://www.gdacs.org/x')).toBeNull();
    expect(nonNewsReason('Green party wins seats in regional election', 'https://example.org/news/1')).toBeNull();
  });
});

describe('redacciones de internacional', () => {
  it('sin lugar citado, la sección de internacional o una cadena internacional no ponen su país', () => {
    const s = (slug: string, ownershipGroup: string | null, feedUrl: string, categoryHint: string | null = null) => ({ slug, ownershipGroup, feedUrl, categoryHint });
    expect(domesticDesk(s('bbc-world', 'bbc', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'world'))).toBe(false);
    expect(domesticDesk(s('bbc-uk', 'bbc', 'https://feeds.bbci.co.uk/news/uk/rss.xml'))).toBe(true);
    expect(domesticDesk(s('the-independent', 'independent', 'https://www.independent.co.uk/news/world/rss'))).toBe(false);
    expect(domesticDesk(s('dw-es', 'deutsche-welle', 'https://rss.dw.com/rdf/rss-sp-all'))).toBe(false);
    expect(domesticDesk(s('la-tercera', 'grupo-copesa', 'https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml'))).toBe(true);
    expect(domesticDesk(s('nyt-us', 'new-york-times', 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml'))).toBe(true);
  });
});

describe('pies de foto, anuncios y agrupación entre idiomas (29-09-2026, tarde)', () => {
  it('un crédito de imagen no es afirmación ni titular', () => {
    expect(goodHeadline(', CC BY-NC, according to The Conversation')).toBe(false);
    const tc = source('The Conversation', 'academic');
    const claims = extractClaims(item(tc, 'The cycle of hate: how Canada and the US entered a cycle of hostility', 'Protesters gather in Ottawa, Getty Images. Photo: John Smith / Reuters. Relations between Canada and the United States deteriorated sharply in 2026.'));
    expect(claims.some((c) => /Getty|Photo:/i.test(c.text))).toBe(false);
  });

  it('el contenido patrocinado no es noticia', () => {
    expect(nonNewsReason('¿Fitogénicos y nutracéuticos para perros y gatos? Conéctese al webinar de SEMANA este 29 de septiembre', 'https://www.semana.com/x')).toMatch(/patrocinado/);
    expect(nonNewsReason('El Senado aprueba la ley de vivienda', 'https://www.semana.com/y')).toBeNull();
  });

  it('dos artículos largos que comparten 2 cifras de 30 no son la misma noticia', () => {
    const many = (base: number) => Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`#${base + i * 7}`, 1]));
    const a = { ...many(100), '#737': 1, '#10': 1 };
    const b = { ...many(5000), '#737': 1, '#10': 1 };
    expect(numberOverlap(a, b)).toBeLessThan(0.1);
    expect(numberOverlap({ '#27': 1, '#25': 1, terms: 1 }, { '#27': 1, '#25': 1, otros: 2 })).toBe(1);
  });
});

describe('validador y nombres (29-09-2026, noche)', () => {
  it('un mes en inglés no se pega a un nombre propio', () => {
    const names = extractEntities('Security minister Alejandra Monteoliva September said the plan would start soon.', 'en').map((e) => e.name);
    expect(names).toContain('Alejandra Monteoliva');
    expect(names.some((n) => /September/.test(n))).toBe(false);
  });
});

describe('nombres que son meses', () => {
  it('Theresa May, June Carter y August Diehl siguen enteros', () => {
    const names = extractEntities('Former prime minister Theresa May met June Carter and August Diehl in London on Monday.', 'en').map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['Theresa May', 'June Carter', 'August Diehl']));
  });
});

describe('portada de producción del 29-09-2026 (noche)', () => {
  it('servicios y frases en primera persona fuera; la UE sigue siendo noticia', () => {
    expect(nonNewsReason('Comprobar Bonoloto: resultados del domingo 27 de septiembre de 2026', 'https://x.es/a')).toMatch(/servicio/);
    expect(goodHeadline('Era un piso de 50 metros cuadrados, con tres perros y yo sin habitación')).toBe(false);
    expect(goodHeadline('EU sanctions Russian oil tankers over Baltic sabotage')).toBe(true);
    expect(goodHeadline('Eu não sabia de nada, diz o ministro da Saúde')).toBe(false);
  });

  it('un tuit incrustado no es una afirmación', () => {
    const src = source('Infobae', 'reputable_media');
    const claims = extractClaims(item(src, 'El Gobierno aprueba el decreto de vivienda', 'Te explicamos muy rápidamente lo que debe incluir el decreto Maricarmen: pic.twitter.com/Y6zhmlId5k. El Consejo de Ministros aprobó este martes el decreto de vivienda.'));
    expect(claims.some((c) => /pic\.twitter/.test(c.text))).toBe(false);
  });
});

describe('ladillos en mayúsculas', () => {
  it('no son afirmaciones; las siglas dentro de una frase normal no molestan', () => {
    const src = source('Infobae', 'reputable_media');
    const claims = extractClaims(item(src, 'Conde-Pumpido critica al Supremo por no amnistiar la malversación', 'VE VULNERADO EL DERECHO A LA TUTELA JUDICIAL. El presidente del TC y la ONU coinciden en que el PSOE y ERC negociaron con el CGPJ.'));
    expect(claims.some((c) => /TUTELA JUDICIAL/.test(c.text))).toBe(false);
    expect(claims.some((c) => /presidente del TC/.test(c.text))).toBe(true);
  });
});

describe('firma de agencia sin ciudad', () => {
  it('«AGI - …» y «EFE.- …» se quitan; un guion normal no', () => {
    expect(stripDateline('AGI - Todavía no se conoce el autor del asesinato de Giulio Regeni.')).toBe('Todavía no se conoce el autor del asesinato de Giulio Regeni.');
    expect(stripDateline('EFE.- El Gobierno aprobó este martes el decreto de vivienda.')).toBe('El Gobierno aprobó este martes el decreto de vivienda.');
    expect(stripDateline('Real Madrid - Barcelona terminó con empate a dos en el Bernabéu.')).toBe('Real Madrid - Barcelona terminó con empate a dos en el Bernabéu.');
  });
});

describe('titulares largos y notas de prensa (30-09-2026)', () => {
  it('una nota de prensa de pago no es noticia', () => {
    expect(pressReleaseReason('LORETO, Baja California Sur, 29 de septiembre de 2026 /PRNewswire/ -- El turismo de bienestar crece.')).toMatch(/nota de prensa/);
    expect(pressReleaseReason('El huracán Polo tocó tierra en Baja California Sur.')).toBeNull();
  });
});

describe('portada de última hora (30-09-2026)', () => {
  it('las guías de partidos y los directos no son noticia; el resultado sí', () => {
    const u = 'https://x.com/a';
    expect(nonNewsReason('Argentina vs. Bolivia, por un amistoso internacional: día, horario, TV y cómo ver online', u)).toMatch(/partido/);
    expect(nonNewsReason('España vs Croacia EN VIVO: ¿a qué hora juegan y dónde ver vía TV la final?', u)).toMatch(/partido/);
    expect(nonNewsReason('Medellín vs. Millonarios - en vivo Liga BetPlay: siga el minuto a minuto del partido', u)).toMatch(/partido/);
    expect(nonNewsReason('Posible alineación de Perú vs. México por partido amistoso de fecha FIFA', u)).toMatch(/partido/);
    expect(nonNewsReason('España gana a Croacia (2-1) y se clasifica para la final', u)).toBeNull();
    expect(nonNewsReason('Cómo verificamos los datos del paro, explicado', u)).toBeNull();
  });
});

describe('titulares de partido (30-09-2026, España 4-1 Croacia)', () => {
  it('fuera la etiqueta «| VIDEO» y las exclamaciones', () => {
    expect(cleanTitle('¡Está intratable! Doblete de Lamine Yamal para el 3-1 de España vs Croacia | VIDEO')).toBe('¡Está intratable! Doblete de Lamine Yamal para el 3-1 de España vs Croacia');
    expect(cleanTitle('Así fue el rescate en el puerto de Vigo (FOTOS)')).toBe('Así fue el rescate en el puerto de Vigo');
    expect(cleanTitle('El Gobierno aprueba el decreto de vivienda - EN VÍDEO')).toBe('El Gobierno aprueba el decreto de vivienda');
    expect(goodHeadline('¡Está intratable! Doblete de Lamine Yamal para el 3-1 de España vs Croacia')).toBe(false);
  });
});
