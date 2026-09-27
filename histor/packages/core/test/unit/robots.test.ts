/**
 * robots.txt con casos reales vistos al validar las fuentes (27-09-2026).
 */
import { describe, expect, it } from 'vitest';
import { aiInputReserved, isAllowed, parseRobots } from '../../src/ingest/robots';
import { aiMayUse } from '../../src/writing/llm';

describe('robots.txt', () => {
  it('UN News: «Disallow: */news/» para todos cierra sus feeds aunque Google tenga permiso propio', () => {
    const txt = ['User-agent: *', 'Disallow: /admin/', 'Disallow: */news/', '', 'User-agent: Feedfetcher-Google', 'Allow: /feed/subscribe/'].join('\n');
    const rules = parseRobots(txt);
    expect(isAllowed(rules, '/feed/subscribe/en/news/all/rss.xml')).toBe(false);
    expect(isAllowed(rules, '/en/story/2026/09/1')).toBe(true);
    expect(isAllowed(parseRobots(txt, 'Feedfetcher-Google'), '/feed/subscribe/en/news/all/rss.xml')).toBe(true);
  });

  it('un grupo propio de HistorBot manda sobre el de «*»', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: HistorBot\nAllow: /rss\nDisallow: /');
    expect(isAllowed(rules, '/rss/portada.xml')).toBe(true);
    expect(isAllowed(rules, '/noticia')).toBe(false);
  });

  it('una línea «User-agent:» vacía no se interpreta como un grupo para HistorBot', () => {
    const rules = parseRobots('User-agent:\nDisallow: /\n\nUser-agent: *\nAllow: /');
    expect(isAllowed(rules, '/feed')).toBe(true);
  });

  it('lee Content-Signal: ai-input=no reserva la fuente para la IA', () => {
    const txt = 'User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-train=yes, ai-input=no\nDisallow: /privacy.shtml';
    const rules = parseRobots(txt);
    expect(rules.contentSignals).toEqual({ search: 'yes', 'ai-train': 'yes', 'ai-input': 'no' });
    expect(aiInputReserved(rules)).toBe(true);
    expect(isAllowed(rules, '/feed-hp/homepage.xml')).toBe(true);
  });

  it('sin Content-Signal, o con ai-input=yes, no hay reserva', () => {
    expect(aiInputReserved(parseRobots('User-agent: *\nDisallow: /admin'))).toBe(false);
    expect(aiInputReserved(parseRobots('Content-Signal: ai-input=yes\nUser-agent: *\nDisallow:'))).toBe(false);
  });

  it('un Content-Signal fuera de grupo vale para todos; el del grupo lo concreta', () => {
    const rules = parseRobots('Content-Signal: ai-input=no, search=yes\nUser-agent: *\nContent-Signal: search=no\nDisallow:');
    expect(rules.contentSignals).toEqual({ 'ai-input': 'no', search: 'no' });
  });
});

describe('uso de la IA', () => {
  it('una sola pieza reservada deja la historia fuera de la IA', () => {
    expect(aiMayUse([{ reserved: false }, { reserved: true }])).toBe(false);
    expect(aiMayUse([{ reserved: false }, {}])).toBe(true);
  });
});
