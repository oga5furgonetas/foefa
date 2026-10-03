/**
 * 03-10-2026. Dani: «que las noticias sean correctas según el estándar, no mezclemos noticias, lo
 * más recientes posible y con un orden coherente». Casos sacados de la portada de ese día.
 */
import { describe, expect, it } from 'vitest';
import { nonNewsReason } from '../../src/text/nonnews';
import { tidyHeadline } from '../../src/writing/tidy';
import { countryVotes } from '../../src/pipeline/normalize';
import { classify } from '../../src/pipeline/classify';

const top = (v: Record<string, number>) => Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0];
const src = (cc: string | null) => ({ countryCode: cc, slug: 'x', ownershipGroup: null, categoryHint: null, feedUrl: null });

describe('lo que no es noticia', () => {
  it.each([
    'Super Astro Luna entrega el número 4014 y el signo Acuario como ganador',
    'Resultados de El Sinuano Día y Noche, 2 de octubre',
    'Prepárese antes de salir: Este es el pronóstico del clima en Culiacán Rosales este 3 de octubre',
    'Clima CDMX y resto de México hoy sábado 3 de octubre: Rachel se aleja, pero seguirán las lluvias',
    'Dólar HOY 30 de septiembre 2026 en Colombia: la divisa internacional pierde 8,4 pesos colombianos',
    'Sábado de andar en Metro: Hoy No Circula del sábado 3 de octubre en CDMX y Edomex',
    'Temblor hoy en Perú EN VIVO: últimos sismos, epicentro y reporte del IGP',
    'Sismo de magnitud 4,0 se registró esta mañana en el Callao',
  ])('fuera: %s', (t) => expect(nonNewsReason(t, 'https://x.example/a')).not.toBeNull());

  it.each([
    'Reportera y camarógrafo atropellados en vivo en Monterrey',
    'Un terremoto de magnitud 6,8 sacude el sur de Japón',
    'Aemet cancela los avisos naranjas por lluvias para este sábado en la Comunidad Valenciana',
    'Biden says this is the last chance for a deal',
    'El Gordo de la Lotería de Navidad cae en Madrid',
  ])('se queda: %s', (t) => {
    // La Lotería de Navidad ya la filtraba la regla anterior («lotería nacional» no; esta sí es noticia).
    expect(nonNewsReason(t, 'https://x.example/a')).toBeNull();
  });
});

describe('titulares sin los adornos de la fuente', () => {
  it('quita el marcador de agencia, las etiquetas y las coletillas', () => {
    expect(tidyHeadline('0-1. Paraguay, fiel a su fórmula, vence a Colombia')).toBe('Paraguay, fiel a su fórmula, vence a Colombia');
    expect(tidyHeadline('Desarrollan modelo nacional de gobernanza para IA en Costa Rica (desarrollo)')).toBe('Desarrollan modelo nacional de gobernanza para IA en Costa Rica');
    expect(tidyHeadline('ÚLTIMA HORA | Dimite el ministro de Transportes')).toBe('Dimite el ministro de Transportes');
    expect(tidyHeadline('Así fue el rescate en la cueva | Vídeo')).toBe('Así fue el rescate en la cueva');
    expect(tidyHeadline('El Real Madrid gana 3-1 al Barcelona')).toBe('El Real Madrid gana 3-1 al Barcelona');
  });
});

describe('el país de cada noticia', () => {
  it('Boca no es España aunque juegue Enner Valencia', () => {
    expect(top(countryVotes({ title: 'Carlos Palacios ingresó en momento clave y Boca terminó goleando', summary: 'Arruabarrena renovó el ataque con los ingresos de Carlos Palacios, Enner Valencia y Flores', contentText: null }, src('ES')))).toBe('AR');
  });
  it('un ataque en Neiva con las FARC es de Colombia', () => {
    expect(top(countryVotes({ title: 'Muere soldado en ataque con drones explosivos en Neiva', summary: 'Un soldado colombiano falleció, vinculado a la disidencia de las FARC.', contentText: null }, src('ES')))).toBe('CO');
  });
  it('«la selección peruana… contra Canadá» es de Perú', () => {
    expect(top(countryVotes({ title: 'Selección peruana realizó su último entrenamiento antes del amistoso contra Canadá', summary: 'La selección peruana asumirá su tercer amistoso ante Canadá', contentText: null }, src(null)))).toBe('PE');
  });
  it('Cali no es Italia', () => {
    expect(top(countryVotes({ title: 'Avanza el plan de reactivación económica en Cali tras el terremoto', summary: 'Los empresarios trazan ruta de reactivación en el Valle', contentText: null }, src(null)))).toBe('CO');
  });
  it('«En Valencia…» al principio de frase sigue siendo Valencia', () => {
    expect(top(countryVotes({ title: 'En Valencia, las lluvias dejan 145 litros en 12 horas', summary: null, contentText: null }, src(null)))).toBe('ES');
  });
});

describe('la sección de cada noticia', () => {
  const sec = (title: string, body = '') => classify(`${title}\n${title}\n${title}\n${body}`, 'es').categoryId;
  it('los sucesos van a Sociedad, no a Salud', () => {
    expect(sec('El derrumbe de un bar en La Rioja deja al menos 11 heridos y 30 personas atrapadas', 'Los heridos fueron trasladados al hospital.')).toBe('society');
    expect(sec('Reportera y camarógrafo atropellados en vivo en Monterrey', 'Sufrieron lesiones y fueron atendidos en un hospital.')).toBe('society');
  });
  it('un plan económico tras un terremoto es Economía, no Ciencia', () => {
    expect(sec('Avanza el plan de reactivación económica en Cali tras el terremoto: proponen día sin IVA')).toBe('economy');
  });
});
